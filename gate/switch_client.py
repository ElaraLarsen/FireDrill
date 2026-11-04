"""Switch agent-protocol client for firedrill-gate: WebSocket in, HTTP out.

Wire contract (verified against sandbox-quantum/switch @7e1316f,
core/switch_core/bridges/agent/api/handlers.py and protocol/stream.py):

* Open   WS {base}/agents/{agent_id}/connection/ws?connection_id=...&scope=...&filter=...
         with `Authorization: Bearer <api key>`. The connection id is a UUID
         the client generates once and reuses: reopening it resumes (a takeover
         of any older socket on the same id).
* Frames arrive as JSON {"event", "data", "id"?}. `id` is the event sequence;
         a reconnecting client passes the last one back as `start_from`.
* First frame is `connection_state`. The server sends {"event": "ping"} every
         heartbeat interval; the client answers {"type": "pong", "cursor": n}.
* Refusal on open: a `refused` frame {status, detail}, then close code 4000+status.
* `evicted` {code, reason}: `taken_over` is final for this client (another
         process opened our connection id); anything else, reconnect.
* Ops     GET  {base}/agents/{id}/ops  -> {"operations": {name: {description, input_schema}}}
          POST {base}/agents/{id}/ops/{name}  body = the args object, unwrapped,
               header X-Switch-Connection-Id binds the call to our connected room.
* Post without a connection: POST {base}/agents/{id}/message {room_id, content}.

SSE (`GET /agents/{id}/events`) is deprecated and deliberately not used.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

import httpx
from websockets.asyncio.client import connect as ws_connect
from websockets.exceptions import ConnectionClosed, InvalidStatus

log = logging.getLogger("firedrill.switch")

# Argument names the gate passes, as defined in Switch's operations module.
# Checked against the live server's published schemas at startup, because the
# server validates by signature and refuses unexpected keys.
EXPECTED_OPS: dict[str, set[str]] = {
    "connect_to_room": {"room_id", "include_general_instructions"},
    "post_message": {"body", "thread_id"},
    "create_room_document": {"name", "description", "instructions", "content"},
    "update_room_document": {"document_id", "content"},
    "get_agent_detail": {"agent_id"},
    "list_participants": set(),
    "read_context": {"limit", "since", "room_id"},
}

EventHandler = Callable[[dict[str, Any]], Awaitable[None]]


class OpError(RuntimeError):
    def __init__(self, op: str, status: int, detail: str) -> None:
        super().__init__(f"{op} -> HTTP {status}: {detail}")
        self.op, self.status, self.detail = op, status, detail


class FatalConnectionError(RuntimeError):
    """The server refused us in a way reconnecting will not fix."""


@dataclass
class ConnectionInfo:
    connection_id: str
    rooms: list[str] = field(default_factory=list)
    cursor: int | None = None
    heartbeat_interval_s: float | None = None
    protocol: Any = None
    open: bool = False


class SwitchClient:
    def __init__(
        self,
        base_url: str,
        agent_id: str,
        api_key: str,
        state_dir: Path,
        *,
        client_name: str = "firedrill-gate",
        client_version: str = "0.1.0",
        scope: str = "all",
        event_filter: str = "all",
        http: httpx.AsyncClient | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.agent_id = agent_id
        self.api_key = api_key
        self.state_dir = state_dir
        self.client_name = client_name
        self.client_version = client_version
        self.scope = scope
        self.event_filter = event_filter
        self.http = http or httpx.AsyncClient(
            base_url=self.base_url,
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=httpx.Timeout(30.0, connect=10.0),
        )
        self.conn = ConnectionInfo(connection_id=self._load_connection_id())
        self.ops_schema: dict[str, Any] = {}
        self.current_room: str | None = None
        self._room_lock = asyncio.Lock()
        self._handlers: list[EventHandler] = []
        self._control_handlers: list[EventHandler] = []
        self._tasks: set[asyncio.Task[None]] = set()
        self._ready = asyncio.Event()
        self._stopping = False

    # ── identity ──────────────────────────────────────────────────────────
    def _load_connection_id(self) -> str:
        """One UUID per gate install, reused across restarts (docs: reuse it)."""
        path = self.state_dir / "connection_id"
        if path.exists():
            value = path.read_text().strip()
            if value:
                return value
        path.parent.mkdir(parents=True, exist_ok=True)
        value = str(uuid.uuid4())
        path.write_text(value)
        return value

    def on_event(self, handler: EventHandler) -> None:
        """Domain events: message, command, room_join, task_* (dispatched as tasks)."""
        self._handlers.append(handler)

    def on_control(self, handler: EventHandler) -> None:
        """Control frames: connection_state, gap, evicted, subscription_changed, room_released."""
        self._control_handlers.append(handler)

    async def wait_ready(self, timeout: float | None = None) -> None:
        await asyncio.wait_for(self._ready.wait(), timeout)

    # ── HTTP side ─────────────────────────────────────────────────────────
    async def health(self) -> dict[str, Any]:
        r = await self.http.get("/health")
        r.raise_for_status()
        try:
            return r.json()
        except ValueError:
            return {"status": r.text}

    async def discover_ops(self) -> dict[str, Any]:
        r = await self.http.get(f"/agents/{self.agent_id}/ops")
        if r.status_code != 200:
            raise OpError("GET /ops", r.status_code, r.text[:300])
        self.ops_schema = r.json().get("operations", {})
        return self.ops_schema

    def check_ops(self) -> list[str]:
        """Problems between the args we send and the server's published schemas."""
        problems: list[str] = []
        for op, args in EXPECTED_OPS.items():
            spec = self.ops_schema.get(op)
            if spec is None:
                problems.append(f"operation {op} is not offered by this server")
                continue
            props = set((spec.get("input_schema") or {}).get("properties", {}) or {})
            unknown = args - props
            if unknown:
                problems.append(f"{op}: server schema lacks {sorted(unknown)} (has {sorted(props)})")
        return problems

    async def op(self, op_name: str, /, **args: Any) -> Any:
        """Invoke an operation, bound to our connection (and so our room).

        Positional-only so an operation argument called `name` (create_room_document) can't collide.
        """
        headers = {"X-Switch-Connection-Id": self.conn.connection_id} if self.conn.open else {}
        body = {k: v for k, v in args.items() if v is not None}
        r = await self.http.post(f"/agents/{self.agent_id}/ops/{op_name}", json=body, headers=headers)
        if r.status_code != 200:
            raise OpError(op_name, r.status_code, _detail(r))
        return r.json().get("result")

    async def message_without_connection(self, room_id: str, content: str) -> Any:
        r = await self.http.post(
            f"/agents/{self.agent_id}/message", json={"room_id": room_id, "content": content}
        )
        if r.status_code >= 300:
            raise OpError("POST /message", r.status_code, _detail(r))
        return r.json() if r.content else None

    async def use_room(self, room_id: str) -> dict[str, Any] | None:
        """Make `room_id` this connection's room (ops like post_message act on it).

        Callers must hold `room()` so two handlers don't switch rooms under each other.
        Returns connect_to_room's payload when it switched, else None.
        """
        if self.current_room == room_id:
            return None
        ctx = await self.op("connect_to_room", room_id=room_id, include_general_instructions=False)
        self.current_room = room_id
        if isinstance(ctx, dict) and ctx.get("warning"):
            log.warning("connect_to_room(%s): %s", room_id, ctx["warning"])
        return ctx

    def room(self) -> asyncio.Lock:
        return self._room_lock

    # ── WebSocket side ────────────────────────────────────────────────────
    def ws_url(self, rooms: list[str] | None = None) -> str:
        base = self.base_url.replace("https://", "wss://", 1).replace("http://", "ws://", 1)
        query: dict[str, str] = {
            "connection_id": self.conn.connection_id,
            "scope": self.scope,
            "filter": self.event_filter,
            "start_from": str(self.conn.cursor) if self.conn.cursor is not None else "head",
            "client": self.client_name,
            "client_version": self.client_version,
        }
        if rooms:
            query["rooms"] = ",".join(rooms)
        return f"{base}/agents/{self.agent_id}/connection/ws?{urlencode(query)}"

    async def run_forever(self, rooms: list[str] | None = None) -> None:
        """Hold the connection open, reconnecting on the same connection id."""
        backoff = 1.0
        while not self._stopping:
            try:
                await self._run_once(rooms)
                backoff = 1.0
            except FatalConnectionError:
                raise
            except (OSError, ConnectionClosed, InvalidStatus, asyncio.TimeoutError) as e:
                log.warning("connection dropped (%s); reconnecting in %.0fs", e, backoff)
            self.conn.open = False
            self.current_room = None
            self._ready.clear()
            if self._stopping:
                break
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 30.0)

    async def stop(self) -> None:
        self._stopping = True
        for t in list(self._tasks):
            t.cancel()
        await self.http.aclose()

    async def _run_once(self, rooms: list[str] | None) -> None:
        url = self.ws_url(rooms)
        log.info("opening %s", url.split("?")[0])
        async with ws_connect(
            url,
            additional_headers={"Authorization": f"Bearer {self.api_key}"},
            open_timeout=15,
            ping_interval=None,  # Switch runs its own application-level ping
            max_size=8 * 1024 * 1024,
        ) as ws:
            async for raw in ws:
                frame = json.loads(raw)
                event = frame.get("event")
                data = frame.get("data") or {}
                if event == "ping":
                    await ws.send(json.dumps({"type": "pong", "cursor": self.conn.cursor or 0}))
                    continue
                if event == "refused":
                    status = int(data.get("status", 0))
                    detail = str(data.get("detail"))
                    if status in (400, 401, 403):
                        raise FatalConnectionError(f"connection refused {status}: {detail}")
                    log.warning("connection refused %s: %s", status, detail)
                    return
                if event == "evicted":
                    self.conn.open = False
                    if data.get("code") == "taken_over":
                        raise FatalConnectionError(
                            "evicted: another process opened this connection id "
                            f"({self.conn.connection_id}); refusing to fight over it"
                        )
                    log.warning("evicted: %s", data)
                    return
                if event == "connection_state":
                    self.conn.rooms = list(data.get("rooms") or [])
                    if data.get("cursor") is not None:
                        self.conn.cursor = int(data["cursor"])
                    self.conn.heartbeat_interval_s = data.get("heartbeat_interval_seconds")
                    self.conn.protocol = data.get("protocol")
                    self.conn.open = True
                    self.current_room = None
                    self._ready.set()
                    log.info(
                        "connected: rooms=%s cursor=%s heartbeat=%ss",
                        self.conn.rooms, self.conn.cursor, self.conn.heartbeat_interval_s,
                    )
                    await self._dispatch(self._control_handlers, {"event": event, "data": data})
                    continue
                if event == "subscription_changed":
                    self.conn.rooms = list(data.get("rooms") or self.conn.rooms)
                if event in ("gap", "subscription_changed", "room_released"):
                    if event == "room_released" and data.get("room_id") == self.current_room:
                        self.current_room = None
                    await self._dispatch(self._control_handlers, {"event": event, "data": data})
                    continue
                # Domain event. `id` is the agent-wide sequence (our cursor).
                if frame.get("id") is not None:
                    self.conn.cursor = int(frame["id"])
                self._spawn(self._dispatch(self._handlers, {"event": event, "data": data, "id": frame.get("id")}))

    async def _dispatch(self, handlers: list[EventHandler], frame: dict[str, Any]) -> None:
        for h in handlers:
            try:
                await h(frame)
            except Exception:  # a handler bug must not drop the connection
                log.exception("handler failed on %s", frame.get("event"))

    def _spawn(self, coro: Awaitable[None]) -> None:
        # Handlers run off the read loop so a slow verify never delays a pong.
        task = asyncio.ensure_future(coro)
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)


def _detail(r: httpx.Response) -> str:
    with contextlib.suppress(ValueError):
        body = r.json()
        if isinstance(body, dict) and "detail" in body:
            return str(body["detail"])[:400]
    return r.text[:400]
