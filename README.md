# FireDrill

**An adversarial hotfix courtroom in chat.** A Claude fixer patches a live incident. A Codex breaker writes hostile tests to break that patch. A custom Switch agent, `firedrill-gate`, holds the only merge credential and merges only after the patch survives every attack in a fresh verification workspace **and** a named human types `APPROVE <verdict id>` in the room.

> Switch's own incident-response guide says of human approval: *"Switch doesn't enforce this. The agent's credentials would allow the change, so the instructions are the only control."* ([source](https://docs.switchagents.ai/switch-rooms/use-cases/incident-response.md))
>
> FireDrill enforces it. In code, not in instructions.

Built for the Flip the Switch hackathon (Nov 4–7, 2026).

![Courtroom dashboard: room mirror, the case and attack matrix, the verdict and enforced gate, the docket](docs/dashboard.jpg)

## What it does

```
            ┌──────────────── Switch server (:8000) ───────────────────┐
  human ───▶│ room "firedrill-<incident>"  (bridged to Mattermost)     │
            │  members: you, fixer (claude), breaker (codex), gate     │
            └───┬────────────────┬──────────────────────┬──────────────┘
                │                │                      │ WebSocket in / HTTP out
         ┌──────▼─────┐   ┌──────▼──────┐        ┌──────▼──────────────────────┐
         │   fixer    │   │   breaker   │        │ firedrill-gate  (:8787)     │
         │ push fix/* │   │ push attack/*│       │  courtroom → SUBMIT/ATTACK/ │
         └──────┬─────┘   └──────┬──────┘        │             APPROVE/STATUS  │
                └───────┬────────┘               │  verify    → fresh workspace│
                        ▼                        │  merger    → only writer of │
              evidence remote (git)  ◀───────────┤             main            │
                                                 │  telemetry → ws /telemetry ─┼──▶ dashboard (:5173)
                                                 └─────────────────────────────┘
```

1. The fixer pushes `fix/<incident>` and posts `@firedrill-gate SUBMIT <branch> <sha>`.
2. The gate verifies it in a fresh workspace and process (`gate/verify.py`, local `python -m pytest`): the original repro, every valid attack, and an invariant. The repro and invariant files come from the gate's own trusted copy, never from the submission. A naive fix passes the repro and is still **GREEN on repro only**.
3. **No attack, no sign-off.** A human cannot approve a fix that no attack has faced.
4. The breaker pushes `attack/<incident>`. Attacks that fail on the private reference fix are discarded (Rule R3). The rest run against the submitted fix. The naive fix goes **RED**.
5. The fixer submits a root-cause fix. It goes **GREEN, survived all attacks**.
6. An approver types `@firedrill-gate APPROVE <verdict id>`. The gate checks the sender's Switch participant id, that the verdict is the latest and GREEN, that it faced an attack, and that the fix is still the branch head. Then it merges with a key only it holds.

Every decision lands in `firedrill-verdicts`, a room document that only the gate can edit.

## The five Switch primitives it leans on

Remove Switch and each of these has to be rebuilt by hand.

| Primitive | What FireDrill uses it for |
|---|---|
| **One room for humans and agents** | A person, a Claude agent, a Codex agent and a custom service share one context and one message log. |
| **Participant identity** | `APPROVE` is authenticated by the sender's participant id, pinned on first sight, not by message text. |
| **Gate-owned room documents** | A room document is editable only by the agent that wrote it, so `firedrill-verdicts` and `firedrill-docket` are a tamper-evident decision log. |
| **Agent addressing** | Fixer and breaker are `owner-agents`: random room members can't push them to "just merge". |
| **Exclusive roles + room instructions** | `patch-author` and `red-team` are exclusive roles; rules R0–R6 live in the room `instructions`. |

## Three things we found in Switch's source

Read from `github.com/sandbox-quantum/switch` at `7e1316f`, not from the brief.

1. **The agent connection is a WebSocket, not SSE.** Since 0.30.0 it is `WS /agents/{id}/connection/ws`; SSE is deprecated. The gate never touches SSE.
2. **An agent can't set its own addressing, and registration ownership decides who can reach it.** `update_agent_detail` refuses to manage the calling agent, and a key minted from the shared bootstrap token makes a *different* owner, so an `owner-agents` fixer would ignore the gate. The gate must be registered with a personal key and its addressing set by the owner.
3. **Two id spaces.** `list_participants` returns agent UUIDs; `message.sender` is an opaque participant id (`@switch-…:server`). They don't match, so the gate pins name→participant id and refuses conflicts.

Details and the full vocabulary corrections are in [ARCHITECTURE.md](ARCHITECTURE.md) §0.

## Bring-up (4 commands)

Needs Docker, a Switch Console, and Claude Code + Codex sign-ins for live mode.

```bash
scripts/bootstrap_stack.sh                                     # 1. Switch + Mattermost + Gateway
python scripts/register_gate.py                                # 2. register the gate (mint a personal key first, see RELAY_STATE.md)
scripts/bootstrap_evidence.sh <incident-lab repo>              # 3. evidence remote + gate key
docker compose -f docker-compose.firedrill.yml up -d --build   # 4. gate (:8787) + dashboard (:5173)
```

Then in Switch Console: Templates → `templates/firedrill.template.yaml`, pick an incident, and open <http://localhost:5173> beside Mattermost.

Without Docker for the gate and dashboard, run the two processes directly:

```bash
pip install -r gate/requirements.txt && python -m gate.main     # gate + telemetry on :8787
cd dashboard && npm ci && npm run dev                           # dashboard on :5173
```

## Live evidence

A real Switch 0.31.0 stack, a bridged room, the gate over its agent WebSocket, real pytest verdicts and a guarded merge, for all three incidents. The commands were posted by one Mattermost user (scripted authorship, labelled). Read [docs/evidence/live-switch-run.md](docs/evidence/live-switch-run.md); the gate's own recordings are `docs/evidence/live-switch-*.jsonl`, and [docs/demo-dashboard.mp4](docs/demo-dashboard.mp4) is a 62-second screen recording of the dashboard stepping through one of them from its console (silent; narrate it for your own cut).

## Judge Replay Mode (no Docker, no API keys, no backend)

```bash
cd dashboard && npm ci && npm run dev          # or: npm run build && npm run preview
```

Open <http://localhost:5173> and pick an incident card. The dashboard shows one page per step of the drill. A glass console, hidden until you click the pill at the foot (or press `/`), shows the room log as a transcript, and a real prompt drives a recorded full drill from `dashboard/fixtures/`. Press Enter for the next step, or type `next 5`, `back`, `run` (plays on its own; any key stops it), `reset`, `goto attack`, `status`, `case ratelimit-boundary` or `help`. The three cases (`idempotency-race`, `ratelimit-boundary`, `pagination-cursor`) switch recordings. A link like `/#/case/ratelimit-boundary/signoff?step=end` opens one at a frame. Every transcript line is printed from one recorded frame, and the console is labelled "scripted cast" because the fixer, breaker and approver in these recordings are scripted.

**Hosted demo.** `dashboard/` deploys as a static site with no backend. `dashboard/vercel.json` is set up for Vercel (import the repo, root directory `dashboard`), and `dist/` uses relative asset paths so it also works on Netlify or GitHub Pages. On a hosted copy the dashboard is replay-only and says "static demo · replay only"; it only looks for a gate on `localhost` unless `VITE_TELEMETRY_URL` is set at build time.

**What each recording is.** One per incident, produced by `tests/test_courtroom_recordings.py`. Every one runs the same sequence:

1. `docket_open` with the incident brief
2. fixer `SUBMIT`s the naive patch → **GREEN on repro only**, "no attack, no sign-off"
3. an early `APPROVE` is **refused** by the gate
4. breaker `ATTACK`s → Rule R3 **discards** the over-broad test, the naive patch goes **RED**
5. fixer `SUBMIT`s the real fix (`demo/scripted/<id>/fix.patch`) → **GREEN**, survives the valid attacks and the invariant
6. a non-approver `APPROVE` is **refused**
7. the approver `APPROVE`s → `signoff` → `merge` through the evidence remote's guarded `update` hook

| | Real | Scripted |
|---|---|---|
| Courtroom | `gate/courtroom.py`, unchanged | |
| Verifier | `gate/verify.py` on Python 3.12: repro, invariant, every valid attack, R3 discards (local pytest subprocesses; network inherited; not a sandbox) | |
| Merge | A git merge through the evidence remote's `update` hook, which checks the gate key | |
| Participants | | `firedrill-fixer`, `firedrill-breaker` and `creator` post the patches in `demo/scripted/<id>/` and are not live agents. Participant ids are test ids. |
| Switch room | | A recording stand-in. No live Claude, Codex or Switch took part. |

The banner on every replay says "scripted". Sizes: `idempotency-race` 48 frames and 18 verifier checks, `ratelimit-boundary` 60 and 30, `pagination-cursor` 56 and 26. Re-record with `FIREDRILL_RECORD_FIXTURES=1 python -m pytest tests/test_courtroom_recordings.py`.

Host paths are scrubbed: `gate/verify.py` replaces the workspace, repo, interpreter, temp and home directories (including `C:\Users\<name>`) with `<workspace>`, `<repo>`, `<python>`, `<tmp>` and `<home>` before anything leaves it, and a test fails if any recording or fixture contains a host path.

Replay is stepped in the browser and never sent to the gate. When a gate is running, the dashboard also lists the runs that gate recorded (`POST /api/replay/<incident>`).

## Telemetry

`ws://localhost:8787/telemetry` streams one JSON frame per real room event or gate action (`room_message`, `submission`, `attack`, `verdict_started`, `check`, `verdict`, `signoff`, `merge`, `rejected`, `gate_state`), persists each to `gate/state/<room>.jsonl`, and replays that history to every new connection. `GET /health`, `GET /api/incidents` and `POST /api/replay/<incident>` support the dashboard. There are no synthetic frames.

## Tests

```bash
pip install -r gate/requirements.txt -r requirements-dev.txt -r incident-lab/requirements.txt
python -m pytest -q           # 73 tests: courtroom, evidence hook, Switch client, telemetry, verify matrix, full drills
cd dashboard && npm test      # 56 tests: reducer, stages, narration, console commands; `npm run e2e` runs 82 Playwright checks
cd dashboard && npm run build
```

Last run (macOS arm64, Python 3.12.14, real `pytest-asyncio`): `73 passed in 149s`; dashboard `56 passed`, Playwright `82 passed` (desktop and phone), build clean. The slow parts are `tests/test_verify_matrix.py` (every matrix cell against real subprocesses) and `tests/test_courtroom_recordings.py` (one full drill per incident).

## Honest limits

- **Driven against a live Switch server, but not with the real agents.** On 2026-11-05 all three incidents ran end to end against a real Switch 0.31.0 stack (see [docs/evidence/live-switch-run.md](docs/evidence/live-switch-run.md)): the gate registered, held its WebSocket, ruled in a bridged Mattermost room and merged through the guarded hook. The commands were posted by one Mattermost human via `scripts/replay_demo.py`, so no Claude Code or Codex session took part. Still open: a drill with the real fixer and breaker (needs Switch Console sign-ins), Mattermost threading, and the template run through Console.
- **The verifier is not a sandbox.** `gate/verify.py` runs each check in a fresh local workspace and process, but the processes inherit the network and run as the gate's user. It is for trusted demo code. The earlier plan of `docker --network none` was replaced by this (D16).
- **The recordings are scripted.** The verifier and the merge are real, but the participants are scripted and the Switch room is a stand-in, so they show what the gate does, not that Claude and Codex can win the drill. The `creator` approval is a scripted participant, not an authenticated Switch user.
- **Merge enforcement is local-demo grade.** The evidence remote's `update` hook rejects `main` unless the gate's key is presented. The production equivalent is a protected branch plus a GitHub App held by the gate, with fixer and breaker limited to read access.
- **`docker-compose.firedrill.yml` was built and brought up once** (2026-11-05, Docker Desktop on macOS arm64): both images built, the gate container reported healthy, passed its preflight against the live Switch stack through `host.docker.internal`, and served the dashboard on :5173 with the gate's live recordings. The merge path was not exercised inside the container: the compose file mounts `/tmp/firedrill` for the evidence remote and that run used host paths.
- **Windows Git Bash is untested here.** `scripts/bootstrap_evidence.sh` used `sed` to write `.env`, which mangled Windows backslash paths so a second run no longer found its own remote. It now writes values through `awk`'s `ENVIRON`. A test with backslash-bearing values fails on the old script and passes on the new one on macOS; I have not run it on Windows.
- Mattermost's team-edition image is amd64-only (emulated on Apple Silicon), and Switch Console is required to run the Claude and Codex sessions.
- FireDrill is not a triage bot or a PR linter. Every workflow ends at a deterministic gate before a human is asked to sign off.
