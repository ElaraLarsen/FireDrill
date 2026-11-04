# FireDrill incident lab

This service intentionally ships three bugs: `idempotency-race`,
`ratelimit-boundary`, and `pagination-cursor`. It is an exercise target.

Install with `python -m pip install -r requirements.txt`, then run
`python -m uvicorn app.main:app --host 127.0.0.1 --port 8080`.
Open `/docs` to exercise the endpoints. SQLite is created at `FIREDRILL_DB`
(default `firedrill.sqlite3`); five realistic inventory items are seeded.

Run an incident's checks with
`python -m pytest incidents/idempotency-race/repro_test.py incidents/idempotency-race/invariant.py`.
The baseline is supposed to fail. Private reference fixes stay outside this repo.
The scripted replay patches are real patches applied from this directory's root.

Contracts: identical idempotency keys return the original stored charge, even
if a retry changes the amount. Rate limits apply per client to `(now-W, now]`.
Pagination orders by `(created_at, id)` and promises forward progress for rows
after the last cursor; it does not promise a historical snapshot under writes.

Tests inject clocks and a charge-insert scheduling hook through `create_app`;
neither is controllable through HTTP. The invariant files cover the original
incident envelope. Breaker suites extend that envelope to process concurrency,
window edges, and cursor ties during writes. Replay submissions are scripted.
