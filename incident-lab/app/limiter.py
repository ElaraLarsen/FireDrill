"""Deliberately vulnerable fixed-window limiter backed by SQLite."""
from pathlib import Path
from typing import Callable
from app.db import connect


class RateLimiter:
    def __init__(self, path: str | Path, clock: Callable[[], float], limit: int = 3, window: float = 10):
        self.path, self.clock, self.limit, self.window = path, clock, limit, window
        with connect(path) as db:
            db.execute("CREATE TABLE IF NOT EXISTS rate_windows (client TEXT PRIMARY KEY, bucket INTEGER NOT NULL, count INTEGER NOT NULL)")

    def allow(self, client: str) -> bool:
        bucket = int(self.clock() // self.window)
        with connect(self.path) as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT bucket, count FROM rate_windows WHERE client = ?", (client,)).fetchone()
            count = row["count"] if row is not None and row["bucket"] == bucket else 0
            if count > self.limit:
                return False
            db.execute("INSERT INTO rate_windows VALUES (?, ?, ?) ON CONFLICT(client) DO UPDATE SET bucket=excluded.bucket, count=excluded.count", (client, bucket, count + 1))
        return True
