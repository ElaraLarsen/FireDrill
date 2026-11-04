"""Scripted edge sweeps over rolling-window semantics, plus one invalid claim."""
import pytest
from fastapi.testclient import TestClient
from app.main import create_app


@pytest.mark.parametrize("epsilon", [0.001, 0.1, 1.0])
def test_boundary_burst_never_doubles_budget(tmp_path, epsilon):
    now = [10.0 - epsilon]
    client = TestClient(create_app(tmp_path / "boundary.sqlite3", clock=lambda: now[0]))
    assert [client.post("/limited").status_code for _ in range(3)] == [200] * 3
    now[0] = 10.0 + epsilon
    assert [client.post("/limited").status_code for _ in range(3)] == [429] * 3
    now[0] = 20.0
    assert client.post("/limited").status_code == 200


def test_expiry_is_exact_and_client_budgets_are_independent(tmp_path):
    now = [4.0]
    client = TestClient(create_app(tmp_path / "expiry.sqlite3", clock=lambda: now[0]))
    assert [client.post("/limited").status_code for _ in range(3)] == [200] * 3
    now[0] = 13.999
    assert client.post("/limited").status_code == 429
    assert client.post("/limited", headers={"X-Client-Id": "other"}).status_code == 200
    now[0] = 14.0
    assert client.post("/limited").status_code == 200


def test_overbroad_all_requests_must_be_rejected(tmp_path):
    # Invalid: a fresh client has a full budget.
    client = TestClient(create_app(tmp_path / "bad-attack.sqlite3", clock=lambda: 1.0))
    assert client.post("/limited").status_code == 429
