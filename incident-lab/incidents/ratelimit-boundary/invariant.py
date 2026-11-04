"""Original envelope: a burst wholly contained within one window."""
from fastapi.testclient import TestClient
from app.main import create_app


def test_each_clients_single_window_budget(tmp_path):
    client = TestClient(create_app(tmp_path / "invariant.sqlite3", clock=lambda: 2.0))
    for identity in ("checkout", "inventory"):
        statuses = [client.post("/limited", headers={"X-Client-Id": identity}).status_code for _ in range(12)]
        assert statuses.count(200) == 3
        assert statuses.count(429) == 9
