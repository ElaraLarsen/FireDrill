# FireDrill

**An adversarial hotfix courtroom in chat.** A Claude fixer patches a live incident. A Codex breaker writes hostile tests to break that patch. A custom Switch agent, `firedrill-gate`, holds the only merge credential and merges only after the patch survives every attack in a clean container **and** a named human types `APPROVE <verdict id>` in the room.

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
                └───────┬────────┘               │  verify    → clean container│
                        ▼                        │  merger    → only writer of │
              evidence remote (git)  ◀───────────┤             main            │
                                                 │  telemetry → ws /telemetry ─┼──▶ dashboard (:5173)
                                                 └─────────────────────────────┘
```

1. The fixer pushes `fix/<incident>` and posts `@firedrill-gate SUBMIT <branch> <sha>`.
2. The gate verifies it in a fresh container: the original repro, every valid attack, and an invariant. A naive fix passes the repro and is still **GREEN on repro only**.
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

## Judge Replay Mode (no Docker, no API keys)

```bash
cd dashboard && npm ci && npm run dev
```

Open <http://localhost:5173> and click **▶ Replay Recorded Drill**. The dashboard steps through a recorded drill from `dashboard/fixtures/`: play, pause, step either way, scrub, 1×/2×/4×.

What the replay is, exactly:

- The frames are real telemetry frames written by the real courtroom and `gate.telemetry`, including a real guarded git merge. They come from `tests/test_telemetry_fixture.py`.
- The verify engine in that recording is `tests/fake_verify.py`, a **test stand-in** (the verdicts say `runner test-stand-in`), not the container verifier. The banner says so.
- Replay is labelled **scripted** wherever it shows. Frames are stepped in the browser and never sent to the gate.
- When a gate is running, the dashboard also lists the runs that gate recorded (`POST /api/replay/<incident>`).

## Telemetry

`ws://localhost:8787/telemetry` streams one JSON frame per real room event or gate action (`room_message`, `submission`, `attack`, `verdict_started`, `check`, `verdict`, `signoff`, `merge`, `rejected`, `gate_state`), persists each to `gate/state/<room>.jsonl`, and replays that history to every new connection. `GET /health`, `GET /api/incidents` and `POST /api/replay/<incident>` support the dashboard. There are no synthetic frames.

## Tests

```bash
python3 -m pytest -q          # gate, courtroom, evidence hook, telemetry
cd dashboard && npm test      # the reducer replays the recorded drill
cd dashboard && npm run build
```

## Honest limits

- **Not yet driven against a live Switch server.** The Switch images couldn't be pulled in our build environment. The first live drill, and the unknowns in ARCHITECTURE §0.4 (op schemas at 0.31.0, `sender_name` mapping, Mattermost threading), are still open and tracked in [RELAY_STATE.md](RELAY_STATE.md).
- **Merge enforcement is local-demo grade.** The evidence remote's `update` hook rejects `main` unless the gate's key is presented. The production equivalent is a protected branch plus a GitHub App held by the gate, with fixer and breaker limited to read access.
- **The recorded replay uses a test verifier**, as above. A replay recorded from a live drill will replace it.
- **`docker-compose.firedrill.yml` has not been run** (no Docker daemon in the authoring environment). It passes `docker compose config`. The gate starts sibling verify containers through the host Docker socket, so checkout paths must match on host and container; running the gate directly avoids that.
- Mattermost's team-edition image is amd64-only (emulated on Apple Silicon), and Switch Console is required to run the Claude and Codex sessions.
- FireDrill is not a triage bot or a PR linter. Every workflow ends at a deterministic gate before a human is asked to sign off.
