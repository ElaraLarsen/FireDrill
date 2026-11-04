"""Scripted Breaker tests. The deliberately overbroad assertion proves R3."""
import multiprocessing
from concurrent.futures import ProcessPoolExecutor
from fastapi.testclient import TestClient
from app.db import connect
from app.main import create_app


def _charge_worker(path, barrier):
    client = TestClient(create_app(path, before_charge_insert=lambda: barrier.wait(timeout=10)))
    response = client.post("/charges", json={"amount": 4500}, headers={"Idempotency-Key": "shared-invoice"})
    assert response.status_code == 200
    return response.json()


def test_two_processes_share_one_idempotency_constraint(tmp_path):
    path = str(tmp_path / "shared.sqlite3")
    create_app(path)  # initialize the schema before concurrent worker startup
    context = multiprocessing.get_context("spawn")
    with context.Manager() as manager:
        barrier = manager.Barrier(2)
        with ProcessPoolExecutor(max_workers=2, mp_context=context) as pool:
            futures = [pool.submit(_charge_worker, path, barrier) for _ in range(2)]
            results = [future.result(timeout=25) for future in futures]
    assert results[0] == results[1]
    with connect(path) as db:
        assert db.execute("SELECT COUNT(*) FROM charges WHERE idempotency_key = 'shared-invoice'").fetchone()[0] == 1


def test_overbroad_distinct_keys_must_be_the_same_charge(tmp_path):
    # Invalid: independent keys are independent operations, even at equal amounts.
    client = TestClient(create_app(tmp_path / "bad-attack.sqlite3"))
    a = client.post("/charges", json={"amount": 100}, headers={"Idempotency-Key": "a"}).json()
    b = client.post("/charges", json={"amount": 100}, headers={"Idempotency-Key": "b"}).json()
    assert a["id"] == b["id"]
