from fastapi.testclient import TestClient
from app.main import create_app


def test_static_traversal_has_no_missing_or_duplicate_items(tmp_path):
    client = TestClient(create_app(tmp_path / "invariant.sqlite3"))
    cursor, seen = None, []
    for _ in range(8):
        page = client.get("/items", params={"limit": 2, **({"cursor": cursor} if cursor else {})}).json()
        if not page["items"]:
            break
        seen.extend(row["id"] for row in page["items"])
        cursor = page["next_cursor"]
    assert seen == [1, 2, 3, 4, 5]
