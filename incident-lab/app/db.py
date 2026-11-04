"""Small SQLite connection helper shared by the three incident stores."""
from contextlib import contextmanager
from pathlib import Path
import sqlite3


@contextmanager
def connect(path: str | Path):
    db = sqlite3.connect(str(path), timeout=10)
    db.row_factory = sqlite3.Row
    try:
        yield db
        db.commit()
    except BaseException:
        db.rollback()
        raise
    finally:
        db.close()
