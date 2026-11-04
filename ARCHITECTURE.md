# FireDrill — Architecture (LOCKED v1, 2026-11-04)

> **An adversarial hotfix courtroom in chat.** A Claude fixer patches a live incident, a Codex breaker writes hostile tests to break that patch, and a custom gate agent holds the only merge credential. It merges only after the patch survives every attack in a clean container *and* a named human types `APPROVE <verdict id>` in the Switch room.

**The pain, in Switch's own words.** Switch's incident-response guide says of human approval: *"Switch doesn't enforce this. The agent's credentials would allow the change, so the instructions are the only control."* ([source](https://docs.switchagents.ai/switch-rooms/use-cases/incident-response.md)). FireDrill makes that approval **enforced by code, not by instructions**, and makes the agents prove the fix adversarially before a human is even asked.

Changes to anything marked **LOCKED** need a note in `RELAY_STATE.md → Decisions Log` first.

---

## 0. Grounding: what Switch actually provides (verified 2026-11-04)

Sources: docs.switchagents.ai pages listed below, plus `github.com/sandbox-quantum/switch` at commit `7e1316f` (2026-11-04), files `docs/TEMPLATES.md`, `docs/official/internals/agent-protocol.md`, `core/switch_core/bridges/agent/api/handlers.py`, `core/switch_core/template_lint.py`, `core/switch_core/rooms_yaml.py`, `deploy/local/standalone-docker-compose.yml`, `examples/`.

### 0.1 Corrections to the hackathon brief's vocabulary

| Brief says | Reality in Switch (verified) | What FireDrill uses |
|---|---|---|
| "SSE in, HTTP out" | Since **0.30.0** the agent connection is **one WebSocket**: `WS /agents/{agent_id}/connection/ws`. SSE (`GET /agents/{id}/events`, `Accept: text/event-stream`) is kept only for older runtimes "for a compatibility window". Live docs: *"SSE is deprecated. Update SSE clients to WebSocket."* | **WebSocket in, HTTP out.** The gate never uses SSE. |
| Room material: History, Rules, Tasks, Decisions | **None of these are Switch terms.** Real primitives: room **`instructions`**, **`roles`** (`{name, instructions, exclusive}`), room **`docs`** (room documents: *everyone can read, only the agent that wrote one can edit*), **`references`**, **library documents**, **`packages`**, and the room's append-only message log (per-room `seq`, read via `read_context`). | History → room log. Rules → room `instructions`. Decisions → gate-owned room doc `firedrill-verdicts`. Tasks → gate-owned room doc `firedrill-docket`. |
| Switch Tasks | Task ops/events (`delegate_task`, `task_delegate` …) exist but docs say: *"present but not ready for use. Handle the frames; build nothing on them."* | **Do not build on Switch tasks.** |
| `addressing: anyone \| owner-agents` | Template values: `owner` (default), `owner-agents`, `anyone` (v2 adds `{anyone_in: [room keys]}`). API values for `update_agent_detail`: `owner_only`, `owner_and_owner_agents`, `anyone`. | Fixer/breaker: `owner-agents`. Gate: `anyone` (set via API). |

### 0.2 Template facts that constrain us
- A template can only **create** agents run by a provider: `claude | codex | opencode | antigravity | cursor`. Every created agent needs `provider`, `location`/`machine`, `directory`.
- **A custom protocol agent (our gate) cannot be created by a template.** It is registered with `POST /agents` using a registration token. The room template then names it in `room.agents` (an agent that already exists on the server), picked through a `type: agent` param.
- `kickoff:` is posted on the creator's behalf. Agents only start when a message addresses them, so kickoff must `@mention` them.
- Room `docs:` created by a template aren't owned by our gate. So the gate creates `firedrill-verdicts` and `firedrill-docket` itself via `create_room_document`, which makes it the **sole editor**: a tamper-evident decision log.

### 0.3 Agent protocol facts (gate implements these)
- Auth: `Authorization: Bearer <agent api key>`. Registration token used **only** for `POST /agents`. `GET /health` is a public probe of the bridge base URL (usually not the Gateway URL).
- Register: `POST /agents` with `name` (`^[a-z0-9][a-z0-9._-]*$`), `description`, `connector_type`, `integration_profile` `{connection_model, message_exchange, pre_invocation_mediation: [], post_invocation_mediation: [], event_reporting: []}` → `{id, api_key}` (**returned once**: persist it). 409 on duplicate name. Don't use `/agents/register-known`.
- Connection model: `always_on`.
- Open: `WS /agents/{id}/connection/ws?connection_id=<uuid, generated once and reused>&scope=all&filter=all&rooms=<ids>&client=firedrill-gate&client_version=<semver>`. Declare rooms **on the URL**, not afterwards.
- Frames arrive as JSON `{"event", "data", "id"}`. First is `connection_state` (`rooms`, `cursor`, `heartbeat_interval_seconds`, …). The server sends `ping`; the client answers `{"type": "pong", "cursor": n}`. Open refusal: a `refused` frame, then close code `4000 + HTTP status`.
- Domain events: `message` (`addressed`, `sender`, `sender_name`, `message_id`, `body`, `timestamp`, `thread_id`, `attachments`, optional `sender_kind`/`on_behalf_of`), `command`, `room_join`. Envelope carries `type`, `room_id`, `bridge_id`, `channel_type`, `payload`, `sequence`. Control: `gap`, `evicted`, `subscription_changed`, `room_released`.
- **Act only when `payload.addressed` is true.** With `filter=all` the gate still *sees* every message, which is how the dashboard mirrors the whole room.
- Ops: `GET /agents/{id}/ops` (discover, **don't hard-code argument names**), `POST /agents/{id}/ops/{op}` with `X-Switch-Connection-Id` and the unwrapped args → `{"result": …}`. Errors: 400/403/404/409.
- Post without a connection: `POST /agents/{id}/message` `{room_id, content}`.
- **Addressing cannot be set by the agent itself.** `update_agent_detail` calls `refuse_managing_self` (definitions.py), and a new agent answers only its owner. The owner sets it in Switch Console agent settings or the Gateway (`PUT /gateway/agents/{id}/addressing-policy`, owner session). `python -m gate.main --probe` reads it back via `get_agent_detail` (`addressing.policy`).
- **Ownership:** a registration key makes its minter the owner. The shared `AGENT_REGISTRATION_TOKEN` (bootstrap key) assigns a separate service account, so register the gate with a **personal** key (Gateway → API Keys), minted by the person who runs the template. Otherwise the fixer/breaker (`owner-agents`) ignore it.
- **Ids:** `list_participants` returns agent UUIDs, but `message.sender` is a participant id (`@switch-…:server`). They are different id spaces, so the gate pins name→participant id on first sight (`gate/identity.py`) and refuses conflicts.
- **Op signatures** (main @7e1316f): `connect_to_room(room_id, include_general_instructions)`, `post_message(body, thread_id)`, `create_room_document(name, description, instructions, content)` → `{document_id}`, `update_room_document(document_id, …, content)`, `list_participants()` → `[{id,name,type,status,alias}]`, `get_agent_detail(agent_id)`, `read_context(limit, since, before, room_id)`. Room documents cap at 1 MiB. The gate re-checks these against the live `GET /ops` at startup.
- Participant ids (`sender`) are opaque (`@switch-user-…:server`). **Match, never parse.**

### 0.4 Unverified: confirm at runtime before relying on it
1. Exact argument names for `create_room_document`, `update_room_document`, `post_message`, `send_targeted_message`, `list_participants`, `connect_to_room`. **Read them from `GET /ops` `input_schema` at startup** and log them in RELAY_STATE.
2. How to map the approver's messaging-app username → participant id (expected via `list_participants`).
3. Whether thread replies from the gate land in the same Mattermost thread (`thread_id` arg on `post_message`?).
4. Exact `SWITCH_VERSION` to pin in `.env` (check `oras repo tags ghcr.io/sandbox-quantum/standalone-compose`; must be ≥ 0.31.0).

---

## 1. System diagram

```
            ┌──────────────────────── Switch server (docker, :8000) ───────────────────────┐
            │  room "firedrill-<incident>"   (bridged to Mattermost :8065)                  │
  human ───▶│   members: {$creator}, firedrill-fixer, firedrill-breaker, firedrill-gate    │
 (Mattermost│   instructions = Rules R0–R6     roles = patch-author*, red-team*  (*exclusive)│
  or Console│   docs (gate-owned): firedrill-verdicts, firedrill-docket                     │
            └──────┬───────────────────────┬───────────────────────────┬───────────────────┘
                   │ Console session        │ Console session            │ WebSocket in / HTTP out
         ┌─────────▼────────┐    ┌──────────▼─────────┐      ┌───────────▼──────────────────────────┐
         │ firedrill-fixer  │    │ firedrill-breaker  │      │ firedrill-gate  (Python, :8787)       │
         │ provider: claude │    │ provider: codex    │      │  switch_client  → WS + ops            │
         │ dir: agents/fixer│    │ dir: agents/breaker│      │  courtroom      → SUBMIT/ATTACK/APPROVE│
         │ push fix/*       │    │ push attack/*      │      │  verify         → docker --network none│
         └─────────┬────────┘    └──────────┬─────────┘      │  merger         → only writer of main  │
                   │                         │                │  telemetry      → WS /telemetry ──────┼──▶ Courtroom dashboard
                   └──────────┬──────────────┘                └───────────┬──────────────────────────┘     (React, :5173)
                              ▼                                           │ fetch fix/*, attack/*
                 /tmp/firedrill/evidence.git  ◀───────────────────────────┘ push main (gate key only)
```

---

## 2. Agents and addressing (LOCKED)

| Switch agent | Runs on | Working dir | Addressing | Why |
|---|---|---|---|---|
| `firedrill-fixer` | `provider: claude` (via Switch Console) | `{$agents_dir}/firedrill-fixer`, clones incident-lab | `owner-agents` | Only the deployer and the deployer's agents (the gate) can direct it. Random room members can't push it to "just merge". |
| `firedrill-breaker` | `provider: codex` (via Switch Console) | `{$agents_dir}/firedrill-breaker`, clones incident-lab | `owner-agents` | Same. A different model family than the fixer, so the two don't share blind spots. |
| `firedrill-gate` | **Custom agent protocol client** (`gate/`), registered via `POST /agents` with a personal key, `connection_model: always_on` | repo `gate/`, private `gate/reference/` | `anyone` (set by the owner in Console/Gateway) | Any room member may *ask* it things. Only commands from the right sender count (see §3). |

**Why Switch is load-bearing (rubric pillar 1):** remove Switch and you lose (a) the one place a human, two vendor agents and a custom service share context; (b) the participant-identity layer the gate uses to authenticate `APPROVE`; (c) gate-only-editable room docs as the decision log; (d) addressing that stops anyone but the owner's agents from steering fixer/breaker; (e) exclusive roles that stop two agents both claiming "patch-author".

---

## 3. The courtroom protocol (LOCKED)

Plain-text commands addressed to `@firedrill-gate`, one per message, at the start of the body after the mention:

| Command | Accepted only from | Gate does |
|---|---|---|
| `SUBMIT <branch> <sha>` | fixer (pinned participant id), or an approver (flagged `manual`) | Fetch, record in docket, run verify (with latest accepted attack, if any) |
| `ATTACK <branch> <sha>` | breaker (pinned participant id), or an approver (flagged `manual`) | Fetch. **Validate attacks against the reference fix (R3)**: drop and name any that fail on correct code. Re-run verify on the latest fix. |
| `APPROVE <verdict_id>` | sender ∈ `FIREDRILL_APPROVERS`, **and** the verdict is the latest and `GREEN`, **and** it ran against an attack (**no attack, no sign-off**), **and** its fix sha is still the head of `fix/<incident>` | Merge fix sha into `main` on the evidence remote, append sign-off + merge sha to `firedrill-verdicts`, post confirmation |
| `STATUS` | anyone | Post the docket summary |

Anything else gets a one-line usage reply. A verdict goes stale (needs a re-run) whenever a newer fix or attack arrives.

**Verdict rule (R2):** `GREEN` ⇔ in a fresh container, against the submitted fix: original repro passes ∧ every valid attack passes ∧ the invariant check passes. Otherwise `RED` (a check failed) or `ERROR` (infrastructure).

**Enforcement (honest scope):** the evidence remote's `update` hook rejects `refs/heads/main` unless `FIREDRILL_GATE_KEY` matches `/tmp/firedrill/gate.keyhash`. That key lives only in the gate's environment. This is local-demo enforcement. The production equivalent is a protected branch plus a GitHub App held by the gate; fixer/breaker get only `connections: [{service: github, access: read}]`. Say this plainly in the README.

---

## 4. Locked interfaces (all three builders code against these)

### 4.1 Repo layout
```
/
├─ CLAUDE.md  AGENTS.md  RELAY_STATE.md  ARCHITECTURE.md  README.md
├─ templates/firedrill.template.yaml        # Switch room template (Claude-1)
├─ incident-lab/                            # vulnerable service + scenarios (Codex)
│   ├─ app/                                 # FastAPI service, SQLite
│   └─ incidents/<id>/{brief.md, repro_test.py, invariant.py}
├─ gate/                                    # custom Switch agent (Claude-1) + verify engine (Codex)
│   ├─ switch_client.py  courtroom.py  merger.py  telemetry.py  main.py
│   ├─ verify.py                            # CLI + library, Codex
│   └─ reference/<id>.patch                 # PRIVATE reference fixes, never in incident-lab
├─ demo/scripted/<id>/{naive.patch, attack/, fix.patch}  # real code for replay mode, clearly labelled
├─ dashboard/                               # React + Vite courtroom UI (Claude-2)
├─ scripts/{bootstrap_stack.sh, bootstrap_evidence.sh, register_gate.py, replay_demo.py}
└─ docker-compose.firedrill.yml             # gate + dashboard (Claude-2)
```
`incident-lab/` is also pushed as its own repo (the template's `lab_repo`) so fixer and breaker clone it without the reference fixes.

### 4.2 Verdict JSON (output of `gate/verify.py`, stored in `firedrill-verdicts`)
```json
{
  "verdict_id": "V-idempotency-race-003",
  "incident": "idempotency-race",
  "fix":    {"branch": "fix/idempotency-race",    "sha": "…"},
  "attack": {"branch": "attack/idempotency-race", "sha": "…"} ,
  "checks": [
    {"name": "repro_test", "kind": "repro|attack|invariant", "against": "fix|reference",
     "status": "pass|fail|error", "duration_ms": 812, "output_tail": "last 40 lines"}
  ],
  "discarded_attacks": [{"name": "test_x", "reason": "fails against reference fix"}],
  "result": "GREEN|RED|ERROR",
  "runner": {"image": "python:3.12-slim@sha256:…", "network": "none"},
  "started_at": "ISO-8601", "finished_at": "ISO-8601"
}
```
CLI: `python -m gate.verify --incident <id> --fix-dir <path> [--attack-dir <path>] --json`. Exit 0 = GREEN, 1 = RED, 2 = ERROR. The JSON object goes on stdout (last line if there's other output).
**The gate overwrites `verdict_id`, `incident`, `fix` and `attack`** (it owns numbering and the shas), so verify may omit them. If the exit code and `result` disagree, the gate records ERROR. `--attack-dir` points at `<attack checkout>/attacks/<incident>/`.

### 4.3 Telemetry (gate → dashboard), `ws://localhost:8787/telemetry`, one JSON object per frame
```json
{"ts": "ISO-8601", "kind": "room_message|submission|attack|verdict_started|check|verdict|signoff|merge|rejected|gate_state",
 "room_id": "…", "seq": 123, "actor": {"id": "@switch-…", "name": "firedrill-fixer", "role": "fixer|breaker|gate|human"},
 "data": {}}
```
Producer API (frozen, implemented by Claude-2 in `gate/telemetry.py`, called by `gate/courtroom.py`): `publish(kind: str, room_id: str, seq: int | None, actor: dict, data: dict)`, sync or async. The courtroom calls it for `room_message`, `submission`, `attack`, `verdict_started`, `check`, `verdict`, `signoff`, `merge`, `rejected`, `gate_state`. `room_message.data = {body, thread_id, addressed}`; `check.data` = one `checks[]` entry; `verdict.data` = full verdict JSON. On connect the gate replays the current incident's events from its JSONL log (`gate/state/<room_id>.jsonl`), so a refreshed dashboard rebuilds itself. Every telemetry frame comes from a real room event or a real gate action. **No synthetic frames.**

### 4.4 Ports
Switch API `8000` · Mattermost `8065` · Gateway `3000` · gate `8787` · dashboard `5173`.

---

## 5. Room template (LOCKED shape)

Source of truth: `templates/firedrill.template.yaml` (version 1, `agents:` + `room:` + `kickoff:`). It follows `docs/TEMPLATES.md` and the `triage-pair` example's shape, and was checked by reading Switch's own linter (`template_lint.py`: param specs, enum defaults, runtime settings). It hasn't been run through the linter yet. **Claude-1: upload it to a real server and paste the lint/warnings into RELAY_STATE.**

Key choices:
- `provider` is **literal per agent** (`claude` for fixer, `codex` for breaker): the cross-vendor split is the point.
- `gate` is a `type: agent` param with default chain `[firedrill-gate, $first]`. The gate must already be registered.
- `roles:` `patch-author` and `red-team`, both `exclusive: true`.
- Room `instructions` carry the rules R0–R6 (this is "Rules").
- `channel_type: channel_private`, `users: ["{$creator}"]`, `bridge` default `[Mattermost, $first]`.

---

## 6. The three pre-seeded incidents (Codex builds; real code, real bugs)

Each ships a real bug, a repro test, an invariant, a **naive fix that passes the repro but is wrong**, a **hostile attack that exposes it**, and a private reference fix. That gives the demo its key beat: *patch 1 REJECTED by an attack → patch 2 GREEN → human APPROVE → merge.*

| id | Bug | Naive fix (passes repro) | Breaker's attack | Reference fix | Invariant |
|---|---|---|---|---|---|
| `idempotency-race` | `POST /charges` with `Idempotency-Key` does check-then-insert; concurrent retries double-charge | `threading.Lock` around the handler | Two app **processes** on one SQLite file firing the same key concurrently → 2 charges | `UNIQUE(idempotency_key)` + `INSERT … ON CONFLICT DO NOTHING`, return stored result | exactly 1 charge row per key |
| `ratelimit-boundary` | Fixed-window limiter allows 2N requests across a window edge; off-by-one `>` vs `>=` | Flip comparison to `>=` | Hypothesis property test: burst N at `t=W-ε` and N at `t=W+ε` | Sliding-window log (or token bucket) | no interval of length W admits > N |
| `path-traversal` | `GET /files/{name}` joins user input onto base dir | `name.replace("../", "")` | `....//etc/passwd`, `%2e%2e%2f`, absolute path, symlink inside base | `resolve()` + `is_relative_to(base)` + reject symlink escapes | every served file's real path ⊂ base |

**Replay mode (for judges without API credits):** `scripts/replay_demo.py` pushes `naive.patch` → `attack/` → `fix.patch` from `demo/scripted/<id>/` and posts SUBMIT/ATTACK into the Mattermost channel as the seeded human user. The gate accepts them because that user is an approver, and flags them `manual`. The gate verifies them for real in Docker. Label it "scripted submissions" in the UI and README. **Live mode** uses the real Claude and Codex agents.

---

## 7. Courtroom dashboard (Claude-2)

One screen, readable in 10 seconds, recorded side by side with Mattermost:
- **Left, "Room":** live feed of room messages (from telemetry `room_message`), colour-coded by actor role.
- **Centre, "The Case":** incident brief; current fix sha with diff stats; attack list (valid ✓ / discarded ✗ with reason).
- **Right, "Verdict":** big `RED / GREEN / PENDING` stamp, per-check rows animating in as `check` frames arrive, then a sign-off panel: "Awaiting APPROVE V-…-003 from @creator", flipping to "MERGED abc123 by @creator".
- **Bottom, "Docket":** timeline of verdicts (V-001 RED, V-002 GREEN, signed, merged).

---

## 8. Local bring-up (target: a judge runs 4 commands)

1. `scripts/bootstrap_stack.sh`: pull the published standalone compose (`ghcr.io/sandbox-quantum/standalone-compose`, pinned `SWITCH_VERSION`), generate secrets, `docker compose --profile collab --profile gateway up -d`, wait on `GET :8000/health`.
2. In Switch Console: point it at `http://localhost:8000`, sign in to Claude Code and Codex (docs: *Set up agent providers*).
3. `python scripts/register_gate.py`, then `docker compose -f docker-compose.firedrill.yml up -d` (gate + dashboard), then `scripts/bootstrap_evidence.sh`.
4. Console → Templates → use `templates/firedrill.template.yaml`, pick an incident. Kickoff starts the drill. Open `http://localhost:5173`.

Known friction to document honestly: Mattermost team-edition image is amd64-only (runs emulated on Apple Silicon); Switch Console is required to run the Claude/Codex sessions.
