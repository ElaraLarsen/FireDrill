"""Storage invariant over retries in the original single-worker envelope."""
from fastapi.testclient import TestClient
from app.db import connect
from app.main import create_app


def test_exactly_one_charge_per_key_and_original_result(tmp_path):
    path = tmp_path / "invariant.sqlite3"
    client = TestClient(create_app(path))
    for key in ("invoice-a", "invoice-b", "invoice-c"):
        original = client.post("/charges", json={"amount": 100}, headers={"Idempotency-Key": key}).json()
        for amount in (100, 200, 300):
            retry = client.post("/charges", json={"amount": amount}, headers={"Idempotency-Key": key})
            assert retry.status_code == 200
            assert retry.json() == original
    with connect(path) as db:
        assert db.execute("SELECT COUNT(*) FROM charges").fetchone()[0] == 3
        assert db.execute("SELECT idempotency_key FROM charges GROUP BY idempotency_key HAVING COUNT(*) <> 1").fetchall() == []
