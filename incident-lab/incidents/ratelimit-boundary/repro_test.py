from fastapi.testclient import TestClient
from app.main import create_app


def test_fourth_request_is_rejected(tmp_path):
    client = TestClient(create_app(tmp_path / "rate.sqlite3", clock=lambda: 1.0))
    assert [client.post("/limited").status_code for _ in range(4)] == [200, 200, 200, 429]
