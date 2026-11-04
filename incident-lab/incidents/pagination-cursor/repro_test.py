from fastapi.testclient import TestClient
from app.main import create_app


def test_tied_page_boundary_advances(tmp_path):
    client = TestClient(create_app(tmp_path / "items.sqlite3"))
    first = client.get("/items", params={"limit": 2}).json()
    second = client.get("/items", params={"limit": 2, "cursor": first["next_cursor"]}).json()
    assert [row["id"] for row in first["items"]] == [1, 2]
    assert [row["id"] for row in second["items"]] == [3, 4]
