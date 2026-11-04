"""Original report: concurrent requests handled by one app process."""
from concurrent.futures import ThreadPoolExecutor
import threading
from fastapi.testclient import TestClient
from app.main import create_app
from app.db import connect


def test_concurrent_retries_create_one_charge(tmp_path):
    barrier = threading.Barrier(2)

    def at_insert():
        # A lock-only hotfix serializes here; release its single caller boundedly.
        try:
            barrier.wait(timeout=0.5)
        except threading.BrokenBarrierError:
            pass

    path = tmp_path / "charges.sqlite3"
    client = TestClient(create_app(path, before_charge_insert=at_insert))
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda _: client.post("/charges", json={"amount": 4500}, headers={"Idempotency-Key": "invoice-42"}), range(2)))
    assert [r.status_code for r in responses] == [200, 200]
    assert len({r.json()["id"] for r in responses}) == 1
    with connect(path) as db:
        assert db.execute("SELECT COUNT(*) FROM charges WHERE idempotency_key = 'invoice-42'").fetchone()[0] == 1
