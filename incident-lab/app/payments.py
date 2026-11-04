"""Charge persistence; the baseline intentionally has a check/insert race."""
from pathlib import Path
from typing import Callable
from app.db import connect


class ChargeStore:
    def __init__(self, path: str | Path, before_insert: Callable[[], None] | None = None):
        self.path = path
        self.before_insert = before_insert or (lambda: None)
        with connect(path) as db:
            db.execute("CREATE TABLE IF NOT EXISTS charges (id INTEGER PRIMARY KEY, idempotency_key TEXT NOT NULL, amount INTEGER NOT NULL)")

    def charge(self, key: str, amount: int) -> dict:
        with connect(self.path) as db:
            row = db.execute("SELECT * FROM charges WHERE idempotency_key = ?", (key,)).fetchone()
        if row is not None:
            return dict(row)
        self.before_insert()
        with connect(self.path) as db:
            cursor = db.execute("INSERT INTO charges (idempotency_key, amount) VALUES (?, ?)", (key, amount))
            row = db.execute("SELECT * FROM charges WHERE id = ?", (cursor.lastrowid,)).fetchone()
        return dict(row)
