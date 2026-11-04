"""Run with: python -m uvicorn app.main:app --port 8080.

Clock and race hooks are injected by tests; public requests cannot override them.
"""
import os
import time
from pathlib import Path
from typing import Callable
from fastapi import FastAPI, Header, HTTPException, Query
from pydantic import BaseModel, Field
from app.payments import ChargeStore
from app.limiter import RateLimiter
from app.pagination import ItemStore


class Charge(BaseModel):
    amount: int = Field(gt=0)


def create_app(db_path: str | Path, *, clock: Callable[[], float] = time.time,
               limit: int = 3, window: float = 10.0,
               before_charge_insert: Callable[[], None] | None = None) -> FastAPI:
    api = FastAPI(title="FireDrill incident lab", version="1.0.0")
    charges = ChargeStore(db_path, before_charge_insert)
    limiter = RateLimiter(db_path, clock, limit, window)
    items = ItemStore(db_path)

    @api.get("/health")
    def health():
        return {"status": "ok", "mode": "deliberately vulnerable incident lab"}

    @api.post("/charges")
    def charge(body: Charge, idempotency_key: str = Header(min_length=1, max_length=200)):
        return charges.charge(idempotency_key, body.amount)

    @api.post("/limited")
    def limited(x_client_id: str = Header(default="judge", max_length=200)):
        if not limiter.allow(x_client_id):
            raise HTTPException(429, "rate limit exceeded")
        return {"accepted": True}

    @api.get("/items")
    def page(cursor: str | None = None, limit: int = Query(default=2, ge=1, le=100)):
        try:
            return items.page(cursor, limit)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc

    return api


app = create_app(os.environ.get("FIREDRILL_DB", "firedrill.sqlite3"))
