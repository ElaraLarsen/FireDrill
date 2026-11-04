# Rate limit admits too many requests

`POST /limited` limits each `X-Client-Id` to N=3 accepted requests in any
rolling W=10-second interval `(now-W, now]`. The original report sends N+1
requests inside a single fixed window and sees them all admitted.

Reproduce with `python -m pytest incidents/ratelimit-boundary/repro_test.py`.
The service runs in multiple processes on a shared SQLite file. Independent
clients must retain independent budgets; slots expire exactly at age W.
