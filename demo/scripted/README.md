# Scripted submissions, real verification

Each incident contains three standalone patches/tests for the vulnerable lab:

1. `naive.patch` passes the original repro and invariant.
2. `attack/` exposes the remaining edge cases. One intentionally invalid test
   fails on correct code and is discarded by Rule R3.
3. `fix.patch` is an independently written correct fix that survives the attacks.

Both patches apply to the **baseline**, not to each other. Their paths start at
`app/`, because the evidence repository root is the contents of `incident-lab/`.
This matches `scripts/replay_demo.py`'s `git apply --index` convention.

From the FireDrill repository, install `incident-lab/requirements.txt` and
`requirements-dev.txt` into Python 3.12, then run:

```sh
python -m pytest tests/test_verify_matrix.py -q
python -m gate.verify --incident idempotency-race --fix-dir incident-lab --json
```

The second command intentionally returns RED (exit 1) for the buggy baseline.
`--fix-dir` is a lab checkout, with the candidate code under `app/`.
`--attack-dir` is the corresponding `attack/` directory, or the evidence
checkout's `attacks/<incident>/`. The verifier keeps submitted trees unchanged.
Repros/invariants and reference patches are gate-owned and loaded independently
of the submission; every test runs in a fresh workspace and subprocess.

The dashboard's replay recordings are made by `tests/test_courtroom_recordings.py`, which drives
the full courtroom (real `gate/courtroom.py`, real `gate/verify.py`, a guarded git merge) with these patches
and tests: set `FIREDRILL_RECORD_FIXTURES=1` to regenerate `dashboard/fixtures/<incident>.jsonl`. The
participants and the Switch room are scripted stand-ins; the recording's meta file says so.
`FIREDRILL_RECORD_FIXTURES=1` on `tests/test_verify_matrix.py` writes its verification-only recordings
to `gate/state/verify-recordings/` (override with `FIREDRILL_RECORD_DIR`), not to the dashboard.

The requested local runner inherits network access and host permissions. It is
for trusted scripted demo code; a fresh process is not a security sandbox.
On restricted Windows hosts, Python's async runtime still needs local loopback
access even when FastAPI is exercised in-process with TestClient.
