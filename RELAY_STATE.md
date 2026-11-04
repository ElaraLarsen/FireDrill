# RELAY_STATE — FireDrill live ledger

## Last Active Agent
**Presentation lane (Teammate 2)**: 2026-11-04 ~11:40 IST. Previous: Codex Lane 2, 11:11 IST.

## Winning Project
**FireDrill: an adversarial hotfix courtroom in chat.**
A Claude fixer patches a live incident, a Codex breaker writes hostile tests to break that patch, and a custom Switch agent (`firedrill-gate`) holds the only merge credential. It merges only after the patch survives every attack in a clean container *and* a named human types `APPROVE <verdict id>` in the room.
Hook: Switch's own incident-response docs admit human approval is "instructions only, Switch doesn't enforce it". FireDrill enforces it.

## Locked Switch Room Architecture (details: ARCHITECTURE.md)
- Template: `templates/firedrill.template.yaml` (v1: `agents:` + `room:` + `kickoff:`).
- Room members: `{$creator}`, `firedrill-fixer` (claude, `owner-agents`), `firedrill-breaker` (codex, `owner-agents`), `firedrill-gate` (custom protocol agent, `anyone`).
- Rules = room `instructions` R0–R6. Roles = `patch-author`, `red-team` (exclusive). Decisions = gate-owned room doc `firedrill-verdicts`. Docket = gate-owned room doc `firedrill-docket`. History = room log.
- Gate transport: **WebSocket** `/agents/{id}/connection/ws` + HTTP ops. **No SSE.**

## Agent Directory Map
| Runtime agent (inside Switch) | Directory | Built by |
|---|---|---|
| firedrill-fixer | `{$agents_dir}/firedrill-fixer` (clones incident-lab) | template |
| firedrill-breaker | `{$agents_dir}/firedrill-breaker` (clones incident-lab) | template |
| firedrill-gate | this repo `gate/` (private `gate/reference/`) | Claude-1 + Codex |
| evidence remote | `/tmp/firedrill/evidence.git` | `scripts/bootstrap_evidence.sh` |

| Builder (this repo) | Person | Lane |
|---|---|---|
| Claude-1 | team lead | Switch layer: template, gate client/courtroom/merger, bootstrap scripts |
| Claude-2 | Teammate 2 | dashboard, `gate/telemetry.py`, compose, README/blog/demo script |
| Codex | Teammate 3 | incident-lab, 3 scenarios, `gate/verify.py`, reference + scripted patches |

## Completed Milestones
- [x] Switch docs + source reviewed; vocabulary corrected (ARCHITECTURE §0).
- [x] Winner selected (FireDrill, sharpened).
- [x] CLAUDE.md / AGENTS.md / RELAY_STATE.md / ARCHITECTURE.md written.
- [x] **Claude-1 Phase 2 lane built and unit-tested** (see below). Not yet run against a live Switch server.
- [x] Codex lane (incident-lab, subprocess verifier, three scenarios, nine patches, hostile attacks, verification matrix and real local recordings)
- [x] Presentation lane built and tested (telemetry, dashboard, compose, README, demo script, blog). Compose unrun (no Docker daemon); no live Switch yet.
- [ ] First live end-to-end drill

## Completed in This Turn (presentation lane, phase 3B)
Pulled `origin/main` (`0eb8f1c`, Codex) by rebase, then:
- Dashboard (`dashboard/src/*`): incident tabs now `idempotency-race | ratelimit-boundary | pagination-cursor`; verify-only recordings render without room traffic (candidate panel from `state` + `candidate_sha`, "attack faced" is read from attack checks because those frames carry no `attack` ref, stamp/docket labelled baseline / naive fix / naive fix + attack / reference fix + attack); sign-off box says "This recording stops at the verdict: no human sign-off or merge was recorded" when there is no room traffic; runs with `verifier: test-stand-in` sort after real ones; replay pacing by frame kind; `?replay=<run id>&step=<n|end>` deep links; long check names truncate.
- Static hosting: `dashboard/vercel.json`, `base: "./"` in `vite.config.ts`, and replay-only mode (`static demo · replay only`) when the page isn't on localhost and `VITE_TELEMETRY_URL` is unset. Not deployed to anything.
- `Dockerfile.gate` now copies `incident-lab/` and installs its requirements (pytest), and drops docker.io and the docker.sock mount (D16). `docker-compose.firedrill.yml` sets `FIREDRILL_INCIDENTS` to the three real incident ids.
- My stand-in fixture meta now has `verifier: test-stand-in` and a title that says so (`tests/test_telemetry_fixture.py` updated).
- `docs/dashboard.jpg` retaken (3200x1800, headless Chrome) from `recorded-idempotency-race`. `README.md`, `docs/blog.md`, `docs/demo-script.md` updated: fresh-workspace wording, three incidents, the two kinds of recording, test counts, honest limits.

Verification (run here, real output; macOS arm64, Python 3.12.14 via uv, real pytest-asyncio, no shim):
```
$ .venv/bin/python -m pytest -q -p no:cacheprovider
50 passed, 1 warning in 98.08s (0:01:38)
$ cd dashboard && npm run build     -> ✓ built in 57ms
$ cd dashboard && npx vitest run    -> Tests 8 passed (8)
```
- Browser check on the static build (`npm run build && npm run preview`, opened on the LAN address so it was not "localhost"): "Replay Recorded Drill" stepped through all four verdicts with no backend and no console errors. Per-incident behaviour for `ratelimit-boundary` and `pagination-cursor` is covered by vitest (stamp sequence, R3 discard, no sign-off/merge), not by eyeballing each in the browser.
- `tests/test_evidence_hook.py::test_bootstrap_is_idempotent` passes on macOS here (it is the Windows/Git Bash failure Codex logged); not reproduced, not fixed.

Not verified: `docker compose up` (no daemon; `docker compose config` clean); a Vercel deploy; the gate against a live Switch server.

## Previous turn (Codex — Phase 2 Lane 2)

Files added (all three incident ids are `idempotency-race`, `ratelimit-boundary`, `pagination-cursor`):
- `incident-lab/.gitattributes`, `incident-lab/.gitignore`, `incident-lab/README.md`, `incident-lab/requirements.txt`, `incident-lab/pytest.ini`; `demo/scripted/.gitattributes` and `gate/reference/.gitattributes` preserve LF patch/source files on Windows and allow meaningful patch context whitespace.
- `incident-lab/app/__init__.py`, `db.py`, `main.py`, `payments.py`, `limiter.py`, `pagination.py`: real FastAPI/SQLite service, seeded inventory, injectable clocks and bounded race scheduling hooks available only to Python tests.
- `incident-lab/incidents/<id>/brief.md`, `repro_test.py`, `invariant.py` for each incident.
- `gate/reference/<id>.patch` for each incident: private authoritative database uniqueness, sliding log, compound keyset cursor fixes.
- `demo/scripted/README.md`; `demo/scripted/<id>/naive.patch`, `fix.patch`, `attack/__init__.py`, `attack/test_attack.py` for each incident. Correct scripted fixes are independently written; all patches apply from a baseline lab root with `git apply --index`.
- `gate/verify.py`: importable `verify(incident, fix_dir, attack_dir=None)` plus exact courtroom CLI, JSON + matching 0/1/2 exit statuses. Fresh workspaces/processes, gate-owned repro/invariant files, reference constructed from trusted baseline, per-node R3 filtering. Empty/broken/all-invalid/skipped attacks fail closed. Runner metadata explicitly says local Python and inherited networking; it is not a security sandbox.
- `tests/test_verify_matrix.py`: 26 real tests (12 matrix cells, three independent scripted correct fixes, three CLI exit codes, trusted-check tampering, six invalid inputs, timeout).
- `dashboard/fixtures/recorded-<id>.jsonl` and `.meta.json` for each incident: real local verification actions only, labelled scripted, actual candidate commit SHAs, R3 discard evidence, RED/GREEN/RED/GREEN. No invented room events, approval, or merge. Regenerate with `FIREDRILL_RECORD_FIXTURES=1 python -m pytest tests/test_verify_matrix.py -q`.
- `RELAY_STATE.md` updated; other lanes' files unchanged by Codex. Fast-forwarded presentation commit `1cf4da8` before integrating.

Verification (real Python 3.12.14 output; final recording run complete):
```
$ FIREDRILL_RECORD_FIXTURES=1 .venv/Scripts/python.exe -m pytest tests/test_verify_matrix.py -q
26 passed in 196.60s (0:03:16)
$ .venv/Scripts/python.exe -m pytest tests/test_verify_matrix.py -q -x
25 passed, 1 warning in 204.15s (0:03:24)
$ .venv/Scripts/python.exe -m pytest tests/test_verify_matrix.py -q -k skipped-attack
1 passed, 25 deselected in 4.76s
$ .venv/Scripts/python.exe -m pytest tests --ignore=tests/test_verify_matrix.py -q
FAILED tests/test_evidence_hook.py::test_bootstrap_is_idempotent
1 failed, 23 passed, 1 warning in 54.93s
```
- The existing bootstrap idempotency regression fails when Git Bash reloads a Windows path from `test.env`: script exits 1 asking for a lab seed although the remote was already initialized. No script changes made (explicit lane prohibition). Other courtroom, guarded merge, Switch client, telemetry and fixture tests pass.
- `python -m compileall -q gate/verify.py incident-lab demo/scripted tests/test_verify_matrix.py`: exit 0; `git diff --cached --check`: exit 0. All nine patches passed `git apply --check`, and matrix tests additionally apply each patch with `--index` in standalone lab repos.
- Sandbox-only TestClient runs timed out: Windows asyncio's socketpair loopback is blocked there. Loopback-enabled runs pass. Early blocked runs were terminated; no outcomes from them were used as fixture results.
- PyPI downloads failed (DNS/reset/timeout). Used existing wheel cache for lab dependencies and official tagged GitHub sources for websockets 15.0.1 / pytest-asyncio 1.3.0 (real plugin, no async shim). The first matrix warning was missing asyncio plugin; the plugin was present for the skipped-attack and fleet regression runs.

## Previous turn (presentation lane)
Files:
- `gate/telemetry.py`: `async publish(kind, room_id, seq, actor, data)` (stamps `ts`, appends `gate/state/<room>.jsonl`, fans out to WS clients; unknown kinds refused). FastAPI app: `WS /telemetry[?room=<id>|all]` (replays the newest room's JSONL, then live), `GET /health`, `GET /api/incidents`, `POST /api/replay/{incident}` (returns recorded frames; never re-broadcasts). `start()`/`stop()` embed it in the gate process on `FIREDRILL_TELEMETRY_HOST:PORT` (default 127.0.0.1:8787) without taking over signal handlers; a bind failure is logged and the gate runs on.
- `dashboard/` (React + Vite + TS + Tailwind 4): four locked panels, Judge Replay stepper, live WS client with reset-on-reconnect, reducer in `src/model.ts`, vitest in `src/model.test.ts`, `dashboard/fixtures/idempotency-race.{jsonl,meta.json}`, `Dockerfile`.
- `docker-compose.firedrill.yml`, `Dockerfile.gate`, `README.md`, `docs/demo-script.md`, `docs/blog.md`, `docs/dashboard.jpg`.
- `tests/test_telemetry.py` (5), `tests/test_telemetry_fixture.py` (2). Re-record the fixture: `FIREDRILL_RECORD_FIXTURE=1 python3 -m pytest tests/test_telemetry_fixture.py`.
- Edits in Switch-layer files (see D13-D15): `gate/courtroom.py`, `gate/merger.py`, `gate/main.py`, `gate/requirements.txt`, `tests/conftest.py`.

Verification (run here, real output):
```
$ python3 -m pytest -q                      # /usr/bin/python3 3.9.6; see environment note
........................                                                 [100%]
24 passed in 18.06s
$ cd dashboard && npm run build
> tsc -b && vite build
✓ built in 55ms
$ cd dashboard && npx vitest run
 Test Files  1 passed (1)   Tests  4 passed (4)
```
- Browser check (Vite dev + Browser pane): Replay Recorded Drill stepped through V-001 GREEN (repro only) -> V-002 RED -> V-003 GREEN -> sign-off -> MERGED. Live mode connected to a real `gate.telemetry` server serving a copy of the fixture JSONL and rebuilt the case from history (that server was a throwaway; stopped).
- Environment note: PyPI was unreachable from this machine, so `pytest-asyncio` couldn't be installed. The async tests were run with a small throwaway shim plugin that runs coroutine tests via `asyncio.run` (not committed). On a normal machine, `pip install -r requirements-dev.txt` and plain `pytest` is the real run; please confirm.

What is NOT verified: the gate with telemetry against a live Switch server; `docker compose up` (no daemon here; `docker compose config` is clean); `npm ci` from the committed lockfile inside the dashboard image; Python 3.12 (ran on 3.9.6).

## Previous turn (Claude-1)
Files:
- `gate/switch_client.py`: WS connect (`/agents/{id}/connection/ws`, scope=all, filter=all), persistent connection id, `connection_state`, ping→pong `{"type":"pong","cursor":n}`, resume via `start_from`, `refused`/`evicted taken_over` are fatal, `GET /ops` discovery + schema check, `op()`, `use_room()`.
- `gate/courtroom.py`: SUBMIT/ATTACK/APPROVE/STATUS, verdict numbering, calls `gate.verify` CLI, gate-owned room docs `firedrill-docket` + `firedrill-verdicts`, telemetry adapter onto `gate.telemetry.publish`.
- `gate/commands.py` (grammar), `gate/identity.py` (name→participant-id pinning), `gate/merger.py` (worktrees + guarded merge), `gate/config.py`, `gate/main.py` (`--probe`).
- `scripts/bootstrap_stack.sh` (Switch 0.31.0 standalone compose, secrets, health wait), `scripts/register_gate.py`, `scripts/bootstrap_evidence.sh` + `scripts/hooks/update`, `scripts/replay_demo.py`.
- `.env.example`, `gate/requirements.txt`, `requirements-dev.txt`, `pytest.ini`, `tests/*`.
- Template: rule R4 now says "no attack, no sign-off" and names the configured approvers.

Verification (run here, real output):
```
$ python3 -m pytest -q
.................                                                        [100%]
17 passed in 3.21s
```
- `tests/test_evidence_hook.py`: real `git push` against a remote built by `bootstrap_evidence.sh`. main is rejected without the key, with a wrong key, with a swapped keyhash file, on non-fast-forward and on delete. fix/* and attack/* are open, other refs rejected, bootstrap is idempotent.
- `tests/test_switch_client.py`: against a local WS server using Switch's documented frame shapes. Checks pong + cursor, dispatch, reconnect on the same connection id with `start_from`, fatal 401 / `taken_over`, ops schema drift, and `op(..., name=...)`.
- `tests/test_courtroom_flow.py`: full drill with real git merges through the guarded hook. naive GREEN can't be approved → attack → RED → impostor/role/stale-sha rejections → root-cause GREEN → stale-push rejection → APPROVE merges → decision log. Uses `tests/fake_verify.py` (stand-in for Codex's CLI, **test only**) and a recording stand-in for Switch.

Bugs the tests caught and fixed:
1. `op("create_room_document", name=...)` collided with `op(self, name, ...)` and would have crashed live. `op` now takes a positional-only `op_name`.
2. The update hook trusted `FIREDRILL_KEYHASH_FILE` from the pusher's env, so a fixer could swap in their own key hash. It now reads only the remote's git config.
3. A naive fix is GREEN before any attack, so a human could approve it unattacked. New rule: **no attack, no sign-off.**

## Current System State
- Local incident service and all three patch/attack scenarios run on Python 3.12.14; no persistent lab server or container was started. Tests use ephemeral databases and loopback-enabled TestClient. Local `.venv/` contains dependencies and is gitignored.
- Lane 2's local subprocess runner replaces Docker execution (D16). `Dockerfile.gate` now packages `incident-lab/` and pytest and no longer assumes sibling Docker (unbuilt: no daemon here). Live Switch has not been verified.
- `gate/config.py` and template enum still name `path-traversal`; Claude-1 must align them to `pagination-cursor`. Until then use `FIREDRILL_INCIDENTS=idempotency-race,ratelimit-boundary,pagination-cursor` for the gate and update the template before using that third room.
- Windows `scripts/bootstrap_evidence.sh` idempotency regression remains failing; see exact output above and Claude-1 handoff. Existing presentation stand-in-verifier fixture is retained separately from new real local verification recordings.
- Nothing running (the dev servers used for checking were stopped). No live Switch server has been reached yet: this workspace's network blocks `ghcr.io`, so the Switch images can't be pulled here.
- GitHub repo exists: `ElaraLarsen/firedrill` (public). Codex uses the configured human Git identity (`Kaustubh-Negi-01`); no AI co-author trailer.
- Pinned `SWITCH_VERSION=0.31.0` (latest stable tag `switch-v0.31.0`).
- Open unknowns (close with `python -m gate.main --probe` on a live server; paste the output here):
  1. Live op schemas match `EXPECTED_OPS` (source says yes at main @7e1316f; 0.31.0 unconfirmed).
  2. `sender_name` for agents equals their agent name, and for Mattermost humans equals their username. Identity pinning and `FIREDRILL_APPROVERS` depend on this.
  3. Whether `post_message(thread_id=…)` threads in Mattermost. The gate falls back to top-level on 400.
  4. Whether the seeded Mattermost `user` is the `{$creator}` when the template is run from Console. `replay_demo.py` assumes it can see the channel.

## Decisions Log
- D16 (2026-11-04, Codex; explicit Lane 2 handoff): third incident is `pagination-cursor`, superseding §6's `path-traversal`. Verify uses fresh local subprocess workspaces (`python -m pytest`), not Docker; runner metadata says network is inherited, not isolated. Claude-1 must update configured incident names and container wording in their lane.
- D18 (2026-11-04, presentation lane): dashboard incident list follows D16 (`pagination-cursor`). `gate/telemetry.py` still reports `KNOWN_INCIDENTS` from `gate/config.py` (still `path-traversal`) in `/api/incidents`; it is display-only. Claude-1 fixes it with the config alignment.
- D17 (2026-11-04, Codex; explicit Lane 2 handoff): write only `dashboard/fixtures/recorded-*` JSONL and provenance metadata in the presentation lane, recording actual verification actions, labelled scripted; no invented room messages, signoffs, or merges.
- D1 (2026-11-04, Claude-1): Transport = WebSocket, not SSE (SSE deprecated since 0.30.0; verified in `handlers.py`).
- D2: Don't use Switch task ops (docs: "not ready for use").
- D3: Gate is registered via `POST /agents`, not created by the template (templates only create provider-run agents).
- D4: Verdicts/docket are room docs created by the gate, so only the gate can edit them.
- D5: Reference fixes live in `gate/reference/`, never in the incident-lab repo the agents clone.
- D6: Fixer = Claude, breaker = Codex. Different vendors so they don't share blind spots.
- D7: Gate must be registered with a **personal** Gateway API key from the template runner (bootstrap token → different owner → fixer/breaker ignore it).
- D8: Gate addressing is set by the owner in Console/Gateway; agents can't change their own (`refuse_managing_self`). Gate preflight refuses to start if it's `owner_only`.
- D9: **No attack, no sign-off.** APPROVE needs the latest GREEN verdict to have run against an attack/ branch.
- D10: Approvers may also SUBMIT/ATTACK (flagged `manual`). That's what makes scripted replay possible without pretending to be the agents.
- D11: The gate assigns `verdict_id` and fills `fix`/`attack`/`incident`; verify needn't.
- D12: Commits are authored by the human team only (no AI co-author trailers), per the team lead.
- D13 (2026-11-04, presentation lane): `gate/main.py::run()` starts the telemetry server (`await telemetry.start()` after preflight, `await telemetry.stop()` on shutdown). Same process as the gate, as the handoff suggested. `fastapi` and `uvicorn` added to `gate/requirements.txt`.
- D14: `gate/courtroom.py` now (a) mirrors the gate's own posts as `room_message` frames (it skips its own echoes, so the dashboard would otherwise never show gate replies), (b) adds `room_name`, `brief`, `approvers` to the `gate_state docket_open` frame, (c) adds `diff_stat` to `submission`/`attack` frames via new `Merger.diff_stat()` (`git diff --numstat origin/main...<sha>`). All additive; the §4.3 envelope and kinds are unchanged.
- D15: `tests/conftest.py` gains an autouse fixture pointing `FIREDRILL_STATE_DIR` at a tmp dir, so telemetry JSONL from tests never lands in `gate/state/`.

## Next Handoff Queue

### Claude-1 (team lead's machine; needs Docker + Switch Console)
0. Lane 2 is ready. Align `gate/config.py::KNOWN_INCIDENTS`, template enum, and architecture §6 from `path-traversal` to `pagination-cursor` (explicit user override D16). Adjust courtroom wording from clean container to fresh local subprocess workspace. Publish the contents of `incident-lab/` as the lab repo, excluding private `gate/reference/`. The verifier consumes a lab-root checkout and `attacks/<id>/`, exactly as replay_demo.py expects. Investigate `tests/test_evidence_hook.py::test_bootstrap_is_idempotent` on Windows/Git Bash: reloading Windows paths from `test.env` makes a seeded remote appear absent. Do not claim this regression passed.
1. `scripts/bootstrap_stack.sh` → Console: add server `http://localhost:8000`, sign in to Claude Code + Codex.
2. Gateway (`:3000`, admin creds in `.env`) → API Keys → new key → `.env` `FIREDRILL_REGISTRATION_TOKEN`. Mint it **as the same user** who will run the template.
3. `python scripts/register_gate.py` → Console: set firedrill-gate addressing to **Anyone**.
4. `pip install -r gate/requirements.txt && python -m gate.main --probe` → paste the output here (closes unknowns 1–2).
5. Upload `templates/firedrill.template.yaml` in Console → Templates; paste lint warnings here.
6. Once Codex's incident-lab is pushed: `scripts/bootstrap_evidence.sh <lab repo>`, `python -m gate.main`, run the template, and drive one incident live.

### Codex: incident lab + verify engine (complete)
0. Heads-up from the presentation lane: the `output_tail` fields in `dashboard/fixtures/recorded-*.jsonl` contain the recording machine's absolute Windows paths (`C:\\Users\\Kaustubh\\Documents\\firedrill\\.venv...`). Consider normalising them in the recorder before the repo is shown to judges.
1. Install `incident-lab/requirements.txt` plus `requirements-dev.txt` into Python 3.12; run `python -m pytest tests/test_verify_matrix.py -q`. Restricted Windows sandbox requires loopback-enabled execution for asyncio/TestClient.
2. All nine patches and 12 requested matrix cells are covered. Regenerate only the new local recordings with `FIREDRILL_RECORD_FIXTURES=1`; `FIREDRILL_RECORD_FIXTURE` (singular) belongs to the old presentation stand-in fixture, not these recordings.
3. After other lanes align config and container packaging, help run one real Switch courtroom with this verifier. Keep `tests/fake_verify.py` confined to its existing isolated courtroom unit tests; do not report its fixture as a real verify run.

### Claude-2: presentation layer (built; follow-ups)
0. (Done in phase 3B: dashboard handles the recordings, Dockerfile.gate repackaged; remaining: build the image and `compose up` where Docker exists.) Three real local verification fixtures now exist as `recorded-<id>.jsonl` plus provenance metadata; fixture glob auto-loads them. They intentionally contain only verdict_started/check/verdict actions, not room conversation or authenticated approval. Correctly distinguish their local scripted provenance from live Switch. Update Dockerfile.gate to COPY `incident-lab/` and install its requirements (pytest is required by gate.verify); remove obsolete sibling-Docker assumptions. Coordinate config changes with Claude-1. Keep frontend files in your lane.
1. Once a live drill exists: `python -m gate.main`, run the template, then record that drill (copy `gate/state/<room>.jsonl` to `dashboard/fixtures/<incident>.jsonl` with a `.meta.json` whose `provenance` says it is live) and replace the stand-in-verifier fixture. Update `tests/test_telemetry_fixture.py` expectations if the frame order differs.
2. Run `docker compose -f docker-compose.firedrill.yml up --build` on a machine with Docker; fix what breaks. Known risk: verify's sibling containers need checkout paths identical on host and in the gate container.
3. Re-record the dashboard screenshot (`docs/dashboard.jpg`) from the live drill; capture the other two incidents once Codex's scenarios exist and add fixtures for them (the incident tabs enable themselves when a fixture exists).
4. Check the `check` frames from Codex's real `gate/verify.py`: the attack matrix shows "Passed against Reference Fix" only if `verify` emits `kind: "attack", against: "reference"` checks. If it doesn't, the matrix falls back to fix-only rows and the discarded list.
