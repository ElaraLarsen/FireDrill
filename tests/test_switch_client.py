"""SwitchClient against a local WebSocket server that speaks the frame shapes
from Switch's handlers.py / stream.py (connection_state, ping, refused, evicted,
domain events with `id`). This tests our client's behaviour, not Switch."""

from __future__ import annotations

import asyncio
import json
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from websockets.asyncio.server import serve

from gate.switch_client import EXPECTED_OPS, FatalConnectionError, SwitchClient


async def _server(script):
    """Start a WS server; `script(ws, query, n)` runs per connection n."""
    seen: list[dict] = []

    async def handler(ws):
        q = parse_qs(urlparse(ws.request.path).query)
        seen.append({"path": urlparse(ws.request.path).path, "query": q, "auth": ws.request.headers.get("Authorization")})
        await script(ws, q, len(seen))

    srv = await serve(handler, "127.0.0.1", 0)
    port = srv.sockets[0].getsockname()[1]
    return srv, port, seen


async def test_connect_pong_dispatch_and_resume(tmp_path):
    pongs: list[dict] = []

    async def script(ws, q, n):
        await ws.send(json.dumps({"event": "connection_state", "data": {"rooms": ["r1"], "cursor": 10, "heartbeat_interval_seconds": 2}}))
        await ws.send(json.dumps({"event": "ping", "data": {}}))
        pongs.append(json.loads(await ws.recv()))
        if n == 1:
            await ws.send(json.dumps({"event": "message", "id": 11, "data": {"type": "message", "room_id": "r1", "payload": {"addressed": True, "body": "hi"}, "sequence": 11}}))
            await asyncio.sleep(0.05)
            await ws.close()  # drop: the client must reconnect on the same id
        else:
            await asyncio.sleep(5)

    srv, port, seen = await _server(script)
    client = SwitchClient(f"http://127.0.0.1:{port}", "agent-1", "key-1", tmp_path)
    got: list[dict] = []

    async def on_event(frame):
        got.append(frame)

    client.on_event(on_event)
    task = asyncio.create_task(client.run_forever())
    for _ in range(100):
        if len(seen) >= 2 and len(pongs) >= 2:
            break
        await asyncio.sleep(0.05)
    await client.stop()
    task.cancel()
    srv.close()

    assert seen[0]["path"] == "/agents/agent-1/connection/ws"
    assert seen[0]["auth"] == "Bearer key-1"
    assert seen[0]["query"]["scope"] == ["all"] and seen[0]["query"]["filter"] == ["all"]
    assert pongs[0] == {"type": "pong", "cursor": 10}
    assert got and got[0]["event"] == "message" and got[0]["data"]["payload"]["body"] == "hi"
    # Reconnect: same connection id, resume from the last event id.
    assert seen[1]["query"]["connection_id"] == seen[0]["query"]["connection_id"]
    assert seen[1]["query"]["start_from"] == ["11"]
    # Connection id persisted for the next process.
    assert (tmp_path / "connection_id").read_text() == seen[0]["query"]["connection_id"][0]


async def test_refused_401_is_fatal(tmp_path):
    async def script(ws, q, n):
        await ws.send(json.dumps({"event": "refused", "data": {"status": 401, "detail": "bad key"}}))
        await ws.close(code=4401)

    srv, port, _ = await _server(script)
    client = SwitchClient(f"http://127.0.0.1:{port}", "a", "k", tmp_path)
    with pytest.raises(FatalConnectionError):
        await asyncio.wait_for(client.run_forever(), 5)
    await client.stop()
    srv.close()


async def test_taken_over_is_fatal(tmp_path):
    async def script(ws, q, n):
        await ws.send(json.dumps({"event": "connection_state", "data": {"rooms": [], "cursor": 0}}))
        await ws.send(json.dumps({"event": "evicted", "data": {"code": "taken_over", "reason": "x"}}))

    srv, port, _ = await _server(script)
    client = SwitchClient(f"http://127.0.0.1:{port}", "a", "k", tmp_path)
    with pytest.raises(FatalConnectionError):
        await asyncio.wait_for(client.run_forever(), 5)
    await client.stop()
    srv.close()


async def test_check_ops_flags_schema_drift(tmp_path):
    ops = {name: {"input_schema": {"properties": {a: {} for a in args}}} for name, args in EXPECTED_OPS.items()}
    ops["post_message"] = {"input_schema": {"properties": {"text": {}}}}
    del ops["read_context"]

    def handler(req: httpx.Request) -> httpx.Response:
        assert req.headers["Authorization"] == "Bearer k"
        return httpx.Response(200, json={"operations": ops})

    http = httpx.AsyncClient(base_url="http://x", headers={"Authorization": "Bearer k"}, transport=httpx.MockTransport(handler))
    client = SwitchClient("http://x", "a", "k", tmp_path, http=http)
    await client.discover_ops()
    problems = client.check_ops()
    assert any("post_message" in p for p in problems)
    assert any("read_context" in p for p in problems)
    assert len(problems) == 2
    await client.stop()


async def test_op_accepts_an_argument_called_name(tmp_path):
    seen = {}

    def handler(req: httpx.Request) -> httpx.Response:
        seen["path"], seen["body"] = req.url.path, json.loads(req.content)
        return httpx.Response(200, json={"result": {"document_id": "d1"}})

    http = httpx.AsyncClient(base_url="http://x", transport=httpx.MockTransport(handler))
    client = SwitchClient("http://x", "a", "k", tmp_path, http=http)
    res = await client.op("create_room_document", name="firedrill-verdicts", description="d", instructions="i", content="c")
    assert res == {"document_id": "d1"}
    assert seen["path"] == "/agents/a/ops/create_room_document"
    assert seen["body"]["name"] == "firedrill-verdicts"
    await client.stop()
