"""Scripted cursor attacks while rows before the cursor change."""
from fastapi.testclient import TestClient
from app.db import connect
from app.main import create_app


def test_deleting_seen_tied_row_does_not_skip_unseen_rows(tmp_path):
    path = tmp_path / "delete.sqlite3"
    client = TestClient(create_app(path))
    first = client.get("/items", params={"limit": 2}).json()
    with connect(path) as db:
        db.execute("DELETE FROM items WHERE id = 1")
    second = client.get("/items", params={"limit": 2, "cursor": first["next_cursor"]}).json()
    assert [row["id"] for row in second["items"]] == [3, 4]


def test_inserting_historical_tied_row_does_not_repeat_seen_items(tmp_path):
    path = tmp_path / "insert.sqlite3"
    client = TestClient(create_app(path))
    first = client.get("/items", params={"limit": 2}).json()
    with connect(path) as db:
        db.execute("INSERT INTO items (id, created_at, name) VALUES (0, '2026-11-04T09:00:00Z', 'Historical import')")
    second = client.get("/items", params={"limit": 2, "cursor": first["next_cursor"]}).json()
    assert [row["id"] for row in second["items"]] == [3, 4]


def test_malformed_cursor_returns_400(tmp_path):
    client = TestClient(create_app(tmp_path / "bad-cursor.sqlite3"))
    assert client.get("/items", params={"cursor": "not-a-valid-cursor"}).status_code == 400


def test_overbroad_every_item_must_fit_in_one_page(tmp_path):
    # Invalid: the caller explicitly requested a two-item page.
    client = TestClient(create_app(tmp_path / "bad-attack.sqlite3"))
    assert len(client.get("/items", params={"limit": 2}).json()["items"]) == 5
