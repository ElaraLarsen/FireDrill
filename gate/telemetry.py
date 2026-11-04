"""Gate -> dashboard telemetry (ARCHITECTURE.md §4.3).

The courtroom calls `publish(kind, room_id, seq, actor, data)` for every real room
event or gate action. Each call

  1. stamps the frame (`ts`),
  2. appends it to `<state dir>/<room id>.jsonl` (the replayable record),
  3. pushes it to every connected `ws://<host>:8787/telemetry` client.

A client that connects gets the JSONL history of one room replayed first (the
most recently active room unless `?room=<id>` / `?room=all` says otherwise), so a
refreshed dashboard rebuilds itself. Nothing is synthesised here: there is no frame
that did not come from `publish`.

REST, for the dashboard's Judge Replay Mode:
  GET  /health                  liveness + connection counts
  GET  /api/incidents           recorded runs (gate state dir + committed fixtures)
  POST /api/replay/{incident}   the recorded frames of that run, for client-side
                                stepping. It never re-broadcasts, so a replay can't
                                be mistaken for a live event.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

import uvicorn
from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from gate.config import KNOWN_INCIDENTS, ROOT

log = logging.getLogger("firedrill.telemetry")

KINDS = (
    "room_message", "submission", "attack", "verdict_started", "check",
    "verdict", "signoff", "merge", "rejected", "gate_state",
)
DEFAULT_PORT = 8787
QUEUE_MAX = 1000  # a client this far behind is dropped and reconnects (history replays)


# ── paths ────────────────────────────────────────────────────────────────
def state_dir() -> Path:
    """Same rule as gate.config: FIREDRILL_STATE_DIR, else <repo>/gate/state."""
    return Path(os.environ.get("FIREDRILL_STATE_DIR") or ROOT / "gate" / "state")


def fixtures_dir() -> Path:
    return Path(os.environ.get("FIREDRILL_FIXTURES_DIR") or ROOT / "dashboard" / "fixtures")


def _safe(room_id: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]", "_", room_id or "_unscoped")


def room_log(room_id: str) -> Path:
    return state_dir() / f"{_safe(room_id)}.jsonl"


# ── frames and JSONL ─────────────────────────────────────────────────────
def _now() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


def read_frames(path: Path) -> List[Dict[str, Any]]:
    frames: List[Dict[str, Any]] = []
    try:
        lines = path.read_text().splitlines()
    except OSError:
        return frames
    for line in lines:
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except ValueError:
            log.warning("skipping unreadable line in %s", path)
            continue
        if isinstance(obj, dict) and obj.get("kind") in KINDS:
            frames.append(obj)
    return frames


def derive_incident(frames: List[Dict[str, Any]]) -> Optional[str]:
    """The incident a recorded run belongs to, read from its own frames."""
    for f in frames:
        data = f.get("data") or {}
        inc = data.get("incident")
        if f.get("kind") in ("gate_state", "verdict") and isinstance(inc, str) and inc:
            return inc
    for f in frames:
        data = f.get("data") or {}
        branch = data.get("branch") or ((data.get("fix") or {}).get("branch") if isinstance(data.get("fix"), dict) else None)
        if f.get("kind") in ("submission", "attack", "verdict_started") and isinstance(branch, str) and "/" in branch:
            return branch.split("/", 1)[1]
    return None


def summarise(source: str, name: str, frames: List[Dict[str, Any]], meta: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    verdicts = [f for f in frames if f.get("kind") == "verdict"]
    return {
        "source": source,  # "recorded" (this gate's state dir) | "fixture" (committed with the dashboard)
        "name": name,
        "room_id": frames[0].get("room_id") if frames else None,
        "incident": derive_incident(frames),
        "frames": len(frames),
        "first_ts": frames[0].get("ts") if frames else None,
        "last_ts": frames[-1].get("ts") if frames else None,
        "verdicts": [(v.get("data") or {}).get("result") for v in verdicts],
        "merged": any(f.get("kind") == "merge" for f in frames),
        "meta": meta or None,
    }


def _runs() -> List[Dict[str, Any]]:
    """Every recorded run we can serve: gate state JSONL first, then committed fixtures."""
    runs: List[Dict[str, Any]] = []
    sdir = state_dir()
    if sdir.is_dir():
        for p in sorted(sdir.glob("*.jsonl"), key=lambda p: p.stat().st_mtime, reverse=True):
            frames = read_frames(p)
            if frames:
                run = summarise("recorded", p.stem, frames)
                run["_frames"] = frames
                runs.append(run)
    fdir = fixtures_dir()
    if fdir.is_dir():
        for p in sorted(fdir.glob("*.jsonl")):
            frames = read_frames(p)
            if not frames:
                continue
            meta: Optional[Dict[str, Any]] = None
            meta_path = p.with_suffix(".meta.json")
            if meta_path.exists():
                with contextlib.suppress(ValueError, OSError):
                    meta = json.loads(meta_path.read_text())
            run = summarise("fixture", p.stem, frames, meta)
            run["_frames"] = frames
            runs.append(run)
    return runs


def _public_run(run: Dict[str, Any]) -> Dict[str, Any]:
    return {k: v for k, v in run.items() if k != "_frames"}


# ── hub ──────────────────────────────────────────────────────────────────
class Hub:
    def __init__(self) -> None:
        self.clients: Dict["asyncio.Queue[Dict[str, Any]]", Optional[str]] = {}  # queue -> room filter

    def subscribe(self, room: Optional[str]) -> "asyncio.Queue[Dict[str, Any]]":
        q: "asyncio.Queue[Dict[str, Any]]" = asyncio.Queue(maxsize=QUEUE_MAX)
        self.clients[q] = room
        return q

    def unsubscribe(self, q: "asyncio.Queue[Dict[str, Any]]") -> None:
        self.clients.pop(q, None)

    def broadcast(self, frame: Dict[str, Any]) -> None:
        for q, room in list(self.clients.items()):
            if room and room != "all" and room != frame.get("room_id"):
                continue
            try:
                q.put_nowait(frame)
            except asyncio.QueueFull:
                log.warning("dropping a telemetry client that fell %d frames behind", QUEUE_MAX)
                self.clients.pop(q, None)
                with contextlib.suppress(asyncio.QueueFull):
                    q.get_nowait()
                    q.put_nowait({"kind": "_closed"})


hub = Hub()


async def publish(kind: str, room_id: Optional[str], seq: Optional[int], actor: Optional[Dict[str, Any]], data: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Record one frame and fan it out. Returns the frame, or None if `kind` is unknown."""
    if kind not in KINDS:
        log.warning("refusing unknown telemetry kind %r", kind)
        return None
    frame = {
        "ts": _now(),
        "kind": kind,
        "room_id": room_id or "",
        "seq": seq,
        "actor": actor or {},
        "data": data or {},
    }
    line = json.dumps(frame, default=str, separators=(",", ":"))
    try:
        path = room_log(room_id or "")
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as fh:
            fh.write(line + "\n")
    except OSError:
        log.exception("could not persist telemetry frame (%s); still broadcasting", kind)
    hub.broadcast(json.loads(line))  # the same bytes the log holds
    return frame


def latest_room() -> Optional[str]:
    sdir = state_dir()
    if not sdir.is_dir():
        return None
    files = sorted(sdir.glob("*.jsonl"), key=lambda p: p.stat().st_mtime, reverse=True)
    for p in files:
        frames = read_frames(p)
        if frames:
            return str(frames[0].get("room_id") or p.stem)
    return None


# ── app ──────────────────────────────────────────────────────────────────
app = FastAPI(title="firedrill-telemetry", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$",
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> Dict[str, Any]:
    return {
        "ok": True,
        "service": "firedrill-telemetry",
        "clients": len(hub.clients),
        "latest_room": latest_room(),
        "state_dir": str(state_dir()),
    }


@app.get("/api/incidents")
async def incidents() -> Dict[str, Any]:
    runs = _runs()
    return {"incidents": list(KNOWN_INCIDENTS), "runs": [_public_run(r) for r in runs]}


@app.post("/api/replay/{incident}")
async def replay(incident: str, source: Optional[str] = Query(None, pattern="^(recorded|fixture)$")) -> Dict[str, Any]:
    """Frames of the newest recorded run of `incident` (or the run named `incident`)."""
    for run in _runs():
        if source and run["source"] != source:
            continue
        if incident in (run["incident"], run["name"], run["room_id"]):
            return {**_public_run(run), "replay": True, "frames_data": run["_frames"]}
    raise HTTPException(status_code=404, detail=f"no recorded run for '{incident}'")


@app.websocket("/telemetry")
async def telemetry_ws(ws: WebSocket, room: Optional[str] = None) -> None:
    await ws.accept()
    # Subscribe and snapshot history in one step with no await between them, so a
    # frame published meanwhile is neither lost nor sent twice.
    q = hub.subscribe(room)
    target = room if room and room != "all" else (None if room == "all" else latest_room())
    history: List[Dict[str, Any]] = []
    if room == "all":
        for p in sorted(state_dir().glob("*.jsonl"), key=lambda p: p.stat().st_mtime) if state_dir().is_dir() else []:
            history.extend(read_frames(p))
    elif target:
        history = read_frames(room_log(target))
    try:
        for frame in history:
            await ws.send_json(frame)
        while True:
            frame = await q.get()
            if frame.get("kind") == "_closed":
                break
            await ws.send_json(frame)
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        hub.unsubscribe(q)
        with contextlib.suppress(Exception):
            await ws.close()


# ── embedding in the gate process ────────────────────────────────────────
class _EmbeddedServer(uvicorn.Server):
    """uvicorn without its signal handlers: the gate owns SIGINT/SIGTERM."""

    def install_signal_handlers(self) -> None:  # older uvicorn
        pass

    @contextlib.contextmanager
    def capture_signals(self):  # newer uvicorn
        yield


_server: Optional[_EmbeddedServer] = None
_task: Optional["asyncio.Task[None]"] = None


async def start(host: Optional[str] = None, port: Optional[int] = None) -> Optional["asyncio.Task[None]"]:
    """Serve the telemetry app on this event loop. Returns None (and logs) if it can't bind:
    a dashboard problem must never stop the gate from guarding main."""
    global _server, _task
    host = host or os.environ.get("FIREDRILL_TELEMETRY_HOST", "127.0.0.1")
    port = port if port is not None else int(os.environ.get("FIREDRILL_TELEMETRY_PORT", DEFAULT_PORT))
    server = _EmbeddedServer(uvicorn.Config(app, host=host, port=port, log_level="warning", lifespan="off"))
    task = asyncio.create_task(server.serve())
    for _ in range(100):  # up to ~5 s to bind
        if server.started:
            break
        if task.done():
            log.error("telemetry server did not start on %s:%s (port in use?): %s", host, port, task.exception() if not task.cancelled() else "cancelled")
            return None
        await asyncio.sleep(0.05)
    else:
        log.error("telemetry server did not start on %s:%s in time", host, port)
        server.should_exit = True
        return None
    _server, _task = server, task
    log.info("telemetry: ws://%s:%s/telemetry  http://%s:%s/health", host, port, host, port)
    return task


async def stop() -> None:
    global _server, _task
    if _server is not None:
        _server.should_exit = True
    if _task is not None:
        with contextlib.suppress(Exception):
            await asyncio.wait_for(_task, timeout=5)
    _server = _task = None
