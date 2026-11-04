"""gate.telemetry: persistence, WebSocket replay + live fan-out, REST for Judge Replay.

Sync tests on purpose (asyncio.run inside), so they don't depend on a pytest plugin.
"""

from __future__ import annotations

import asyncio
import json
import socket

import websockets
from fastapi.testclient import TestClient

from gate import telemetry

ROOM = "room-t"
ACTOR = {"id": "@switch-agent-fix:local", "name": "firedrill-fixer", "role": "fixer"}


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def test_publish_stamps_persists_and_rejects_unknown_kinds(telemetry_state):
    async def go():
        frame = await telemetry.publish("submission", ROOM, 7, ACTOR, {"branch": "fix/idempotency-race", "sha": "abc"})
        assert frame and set(frame) == {"ts", "kind", "room_id", "seq", "actor", "data"}
        assert await telemetry.publish("made_up", ROOM, None, ACTOR, {}) is None

    asyncio.run(go())
    lines = (telemetry_state / f"{ROOM}.jsonl").read_text().splitlines()
    assert len(lines) == 1
    saved = json.loads(lines[0])
    assert saved["kind"] == "submission" and saved["seq"] == 7 and saved["data"]["sha"] == "abc"


def test_ws_replays_history_then_streams_live(telemetry_state):
    async def go():
        await telemetry.publish("gate_state", ROOM, None, {"role": "gate"}, {"state": "docket_open", "incident": "idempotency-race"})
        await telemetry.publish("room_message", ROOM, 1, ACTOR, {"body": "hi", "addressed": False})
        port = free_port()
        task = await telemetry.start("127.0.0.1", port)
        assert task is not None
        try:
            async with websockets.connect(f"ws://127.0.0.1:{port}/telemetry") as ws:
                got = [json.loads(await asyncio.wait_for(ws.recv(), 5)) for _ in range(2)]
                assert [f["kind"] for f in got] == ["gate_state", "room_message"]
                await telemetry.publish("verdict_started", ROOM, None, {"role": "gate"}, {"verdict_id": "V-x-001"})
                live = json.loads(await asyncio.wait_for(ws.recv(), 5))
                assert live["kind"] == "verdict_started" and live["data"]["verdict_id"] == "V-x-001"
            # a second client sees all three as history, in order, exactly once
            async with websockets.connect(f"ws://127.0.0.1:{port}/telemetry") as ws2:
                kinds = [json.loads(await asyncio.wait_for(ws2.recv(), 5))["kind"] for _ in range(3)]
                assert kinds == ["gate_state", "room_message", "verdict_started"]
        finally:
            await telemetry.stop()

    asyncio.run(go())


def test_ws_room_filter_only_streams_that_room(telemetry_state):
    async def go():
        port = free_port()
        assert await telemetry.start("127.0.0.1", port) is not None
        try:
            async with websockets.connect(f"ws://127.0.0.1:{port}/telemetry?room=wanted") as ws:
                await telemetry.publish("room_message", "other", 1, ACTOR, {"body": "no"})
                await telemetry.publish("room_message", "wanted", 2, ACTOR, {"body": "yes"})
                f = json.loads(await asyncio.wait_for(ws.recv(), 5))
                assert f["room_id"] == "wanted" and f["data"]["body"] == "yes"
        finally:
            await telemetry.stop()

    asyncio.run(go())


def test_rest_health_incidents_and_replay(telemetry_state, tmp_path, monkeypatch):
    monkeypatch.setenv("FIREDRILL_FIXTURES_DIR", str(tmp_path / "no-fixtures"))

    async def seed():
        await telemetry.publish("gate_state", ROOM, None, {"role": "gate"}, {"state": "docket_open", "incident": "path-traversal"})
        await telemetry.publish("verdict", ROOM, None, {"role": "gate"}, {"verdict_id": "V-path-traversal-001", "incident": "path-traversal", "result": "RED"})

    asyncio.run(seed())
    c = TestClient(telemetry.app)
    h = c.get("/health").json()
    assert h["ok"] is True and h["latest_room"] == ROOM

    runs = c.get("/api/incidents").json()["runs"]
    assert runs[0]["incident"] == "path-traversal" and runs[0]["verdicts"] == ["RED"] and runs[0]["source"] == "recorded"

    r = c.post("/api/replay/path-traversal")
    assert r.status_code == 200
    body = r.json()
    assert body["replay"] is True and [f["kind"] for f in body["frames_data"]] == ["gate_state", "verdict"]
    assert c.post("/api/replay/ratelimit-boundary").status_code == 404

    # Replay serves frames; it must not re-broadcast them as live events.
    assert (telemetry_state / f"{ROOM}.jsonl").read_text().count("\n") == 2


def test_courtroom_adapter_finds_publish():
    from gate.courtroom import Telemetry

    assert Telemetry()._publish is telemetry.publish
