"""Timestamp-only pagination deliberately repeats tied boundary rows."""
import base64
import json
from pathlib import Path
from app.db import connect


def encode_cursor(value: dict) -> str:
    return base64.urlsafe_b64encode(json.dumps(value).encode()).decode()


def decode_cursor(value: str) -> dict:
    try:
        decoded = json.loads(base64.urlsafe_b64decode(value.encode()))
        if not isinstance(decoded, dict):
            raise ValueError("cursor must be an object")
        return decoded
    except (ValueError, UnicodeError, TypeError) as exc:
        raise ValueError("invalid cursor") from exc


class ItemStore:
    def __init__(self, path: str | Path):
        self.path = path
        with connect(path) as db:
            db.execute("CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, created_at TEXT NOT NULL, name TEXT NOT NULL)")
            if db.execute("SELECT COUNT(*) FROM items").fetchone()[0] == 0:
                db.executemany("INSERT INTO items (created_at, name) VALUES (?, ?)", [
                    ("2026-11-04T09:00:00Z", "Relay adapter"),
                    ("2026-11-04T09:00:00Z", "Circuit breaker"),
                    ("2026-11-04T09:00:00Z", "Smoke sensor"),
                    ("2026-11-04T09:01:00Z", "Alarm controller"),
                    ("2026-11-04T09:02:00Z", "Backup battery"),
                ])

    def page(self, cursor: str | None, limit: int) -> dict:
        last = decode_cursor(cursor) if cursor else {}
        timestamp = last.get("timestamp", "")
        if not isinstance(timestamp, str):
            raise ValueError("invalid cursor timestamp")
        with connect(self.path) as db:
            rows = db.execute("SELECT * FROM items WHERE created_at >= ? ORDER BY created_at, id LIMIT ?", (timestamp, limit)).fetchall()
        items = [dict(row) for row in rows]
        next_cursor = encode_cursor({"timestamp": items[-1]["created_at"]}) if items else None
        return {"items": items, "next_cursor": next_cursor}
