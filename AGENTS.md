# Fleet Operating Rules — FireDrill (Flip the Switch Hackathon, Nov 4–7 2026)

You are one of three builders on this repo: **Claude-1**, **Claude-2**, **Codex**. `CLAUDE.md` and `AGENTS.md` are identical copies of these rules. Edit both or neither.

## 0. Who you are
- Codex reads this as `AGENTS.md`: you are **Codex**.
- A Claude instance takes its identity from the human's prompt ("you are Claude-2"). If the prompt doesn't say, check `RELAY_STATE.md → Next Handoff Queue` for whichever Claude slot is waiting, and ask the human in one line before writing any code.
- Stay in your lane (§4). Touching another lane's files needs a line in `RELAY_STATE.md → Decisions Log` first.

## 1. Mandatory state sync, every turn
**Before acting:** read `RELAY_STATE.md` and `ARCHITECTURE.md` in full. Run `git status` and `git log --oneline -15`. If RELAY_STATE disagrees with git, trust git and fix RELAY_STATE.

**Before ending a turn:** update `RELAY_STATE.md`:
1. `Last Active Agent`: your id plus an IST timestamp.
2. `Completed in This Turn`: exact files touched, plus the verification commands you ran and their real output (trimmed).
3. `Current System State`: what runs, on which ports and containers, and what is broken.
4. `Next Handoff Queue`: self-contained instructions per agent (a fresh agent must be able to act without this chat).

Commit with a message prefixed by your id, e.g. `[Codex] incident-lab: idempotency-race scenario`. Don't rewrite history. Don't force-push.

## 2. Ground truth for Switch (never invent keys or endpoints)
- Query the `switch-docs` MCP server (`https://docs.switchagents.ai/mcp`) when it's connected. Otherwise read `https://docs.switchagents.ai/llms.txt` and the Switch repo `github.com/sandbox-quantum/switch` (`docs/TEMPLATES.md`, `docs/official/internals/agent-protocol.md`, `core/switch_core/`).
- `ARCHITECTURE.md §0` lists what is verified and what is **not**. Anything you rely on from §0.4 gets confirmed at runtime and recorded in RELAY_STATE.
- Known corrections, don't regress them:
  - The agent connection is **WebSocket** `/agents/{id}/connection/ws`. SSE is deprecated. Never build on SSE.
  - "History / Rules / Tasks / Decisions" are **not** Switch primitives. Use room log / room `instructions` / gate-owned room docs.
  - Switch task ops are "not ready for use". Don't build on them.
  - Template addressing values: `owner | owner-agents | anyone`. API values: `owner_only | owner_and_owner_agents | anyone`.
- Discover op argument names from `GET /agents/{id}/ops` at runtime. Never hard-code a guess.

## 3. Zero mock, zero fake results
- Never report a test, verdict, or command result you didn't run. Paste real output.
- No synthetic telemetry, no hard-coded verdicts, no `if DEMO: return GREEN`.
- Replay mode = real pre-written patches executed for real, labelled "scripted" everywhere it shows.
- If something can't run in your environment (no Docker, no Switch server), say so in RELAY_STATE and leave a runnable check for the next agent. Don't fake it.

## 4. Lanes (LOCKED for Phase 2)
| Agent | Owns |
|---|---|
| **Claude-1**, Switch layer | `templates/`, `gate/switch_client.py`, `gate/courtroom.py`, `gate/merger.py`, `gate/main.py`, `scripts/bootstrap_stack.sh`, `scripts/register_gate.py`, `scripts/bootstrap_evidence.sh`, `scripts/replay_demo.py` |
| **Codex**, incident lab + verify engine | `incident-lab/`, `gate/verify.py`, `gate/reference/`, `demo/scripted/`, tests for those |
| **Claude-2**, presentation layer | `dashboard/`, `gate/telemetry.py`, `docker-compose.firedrill.yml`, `README.md`, `docs/` (blog, demo script) |

Interfaces between lanes are frozen in `ARCHITECTURE.md §4`. Change one only via the Decisions Log, and tell the affected agent in the handoff queue.

## 5. Anti-generic guardrails
- FireDrill is not a triage pair, standup bot, PR linter or Q&A bot. Don't drift toward one.
- Every workflow ends at a **deterministic gate** (repro + attacks + invariant in a clean container) **before** a human is asked to sign off.
- Human sign-off is authenticated by Switch participant id, never by message text alone.

## 6. Voice prompts (Wispr Flow)
The operator often dictates. Map spoken phrases onto real paths and symbols in the repo before acting ("the gate thing" → `gate/`, "the race one" → `incident-lab/incidents/idempotency-race/`). If two mappings fit, say which one you picked in your first line.

## 7. Engineering defaults
Python 3.12 + FastAPI + `websockets`/`httpx` for the gate; pytest; React + Vite + TypeScript for the dashboard. Secrets only in `.env` (gitignored). `.env.example` is committed.
