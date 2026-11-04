# RELAY_STATE — FireDrill live ledger

## Last Active Agent
**Claude-1 (Lead Architect, bootstrap session)**: 2026-11-04 ~09:50 IST

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
| evidence remote | `/tmp/firedrill/evidence.git` | Claude-1 script |

| Builder (this repo) | Lane |
|---|---|
| Claude-1 | Switch layer: template, gate client/courtroom/merger, bootstrap scripts |
| Codex | incident-lab, 3 scenarios, `gate/verify.py`, reference + scripted patches |
| Claude-2 | dashboard, `gate/telemetry.py`, compose, README/blog/demo script |

## Completed Milestones
- [x] Switch docs + source reviewed; vocabulary corrected (ARCHITECTURE §0).
- [x] Winner selected (FireDrill, sharpened).
- [x] CLAUDE.md / AGENTS.md / RELAY_STATE.md / ARCHITECTURE.md written.
- [x] Room template drafted; hand-checked against `template_lint.py` and `ParamSpec`. **Not yet run through the linter or a live server.**
- [ ] Phase 2 (below)

## Current System State
- Repo: initialized, nothing runnable yet. No containers, no ports in use.
- Switch stack: **not started**. `SWITCH_VERSION` not yet chosen.
- Reference checked: `sandbox-quantum/switch` @ `7e1316f` (2026-11-04).
- Open unknowns: ARCHITECTURE §0.4 (op argument names, username→participant id mapping, thread replies, version pin).

## Decisions Log
- D1 (2026-11-04, Claude-1): Transport = WebSocket, not SSE (SSE deprecated since 0.30.0; verified in `handlers.py`).
- D2: Don't use Switch task ops (docs: "not ready for use").
- D3: Gate is registered via `POST /agents`, not created by the template (templates only create provider-run agents).
- D4: Verdicts/docket are room docs created by the gate, so only the gate can edit them.
- D5: Reference fixes live in `gate/reference/`, never in the incident-lab repo the agents clone.
- D6: Fixer = Claude, breaker = Codex. Different vendors so they don't share blind spots.

## Next Handoff Queue (Phase 2, parallel; interfaces frozen in ARCHITECTURE §4)

### Claude-1: Switch layer
1. `scripts/bootstrap_stack.sh`: list tags (`oras repo tags ghcr.io/sandbox-quantum/standalone-compose`), pin `SWITCH_VERSION` ≥ 0.31.0 in `.env.example`, pull the compose artifact, run `deploy/local/generate-env-secrets.sh`-equivalent, `docker compose --profile collab --profile gateway up -d`, wait on `curl :8000/health`.
2. `scripts/register_gate.py`: `POST /agents` (registration token from Gateway) with `connection_model: always_on`; persist `{id, api_key}` to `.env`; then `update_agent_detail` addressing `anyone`. Handle 409.
3. `gate/switch_client.py`: WS connect (UUID connection id persisted in `gate/state/connection_id`), `connection_state` parse, pong `{"type":"pong","cursor":n}`, reconnect with the same id, `gap` handling, `GET /ops` discovery. **Log every op's input_schema into RELAY_STATE §Current System State** (closes unknown #1).
4. `gate/courtroom.py`: parse `SUBMIT/ATTACK/APPROVE/STATUS`; authenticate by sender participant id (fixer/breaker ids from `list_participants`, approver = creator); call `gate.verify` (Codex's contract); post verdicts; create + append `firedrill-verdicts` and `firedrill-docket` room docs.
5. `gate/merger.py` + `scripts/bootstrap_evidence.sh`: bare repo + `update` hook that guards `refs/heads/main` with the gate key hash.
6. Upload the template to the live server; paste lint output here.
**Done when:** in Mattermost, `@firedrill-gate STATUS` gets a real reply, and `firedrill-verdicts` exists and is edited only by the gate.

### Codex: incident lab + verify engine
1. `incident-lab/app`: FastAPI + SQLite service with the 3 bugs in ARCHITECTURE §6 (`/charges`, rate limiter, `/files/{name}`).
2. Per incident: `brief.md`, `repro_test.py` (fails on buggy code), `invariant.py`.
3. `gate/reference/<id>.patch` (correct fix), `demo/scripted/<id>/naive.patch` (passes repro, wrong), `demo/scripted/<id>/attack/` (hostile tests: fail on naive, pass on reference).
4. `gate/verify.py`: CLI + library per ARCHITECTURE §4.2. Runs in `docker run --rm --network none` (python:3.12-slim pinned by digest), mounts read-only. Validates attacks against the reference fix and discards invalid ones. Exit codes 0/1/2.
5. `tests/test_verify_matrix.py`: for each incident assert buggy → RED, naive (no attack) → GREEN, naive + attack → RED, reference + attack → GREEN. **Paste the real pytest output here.**
**Done when:** that matrix passes locally, and `python -m gate.verify ... --json` emits schema-valid JSON.

### Claude-2: presentation layer
1. `gate/telemetry.py`: FastAPI WS `/telemetry` on :8787 per ARCHITECTURE §4.3; JSONL append and replay on connect; a `publish(kind, room_id, seq, actor, data)` function Claude-1's courtroom calls.
2. `dashboard/`: React + Vite + TS, four panels per ARCHITECTURE §7. Develop against telemetry recorded from Codex's **real** verify runs (record them to `dashboard/fixtures/recorded-*.jsonl` once Codex's matrix passes, and label them "recorded"). Until then, build against the schema with unit tests, no invented data.
3. `docker-compose.firedrill.yml`: gate + dashboard services; `.env.example`.
4. `README.md`: the 10-second pitch at the top, a GIF slot, the 4-command bring-up, honest limits (local git-hook enforcement vs. prod branch protection; amd64 Mattermost; Console required).
5. `docs/demo-script.md` (3-minute video beat sheet: incident → naive patch → breaker attack → RED → real fix → GREEN → APPROVE → merge) and a `docs/blog.md` outline for the Best Blog side track.
**Done when:** the dashboard renders a recorded real run end to end and `docker compose -f docker-compose.firedrill.yml config` validates.
