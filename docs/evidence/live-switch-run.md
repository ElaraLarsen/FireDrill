# A live run against a real Switch server

On 2026-11-05 the gate ran against a real, self-hosted **Switch 0.31.0** stack (Docker: switch-core,
Gateway, Mattermost, Postgres, from `scripts/bootstrap_stack.sh`), not a stand-in. The recording is
[`live-switch-idempotency-race.jsonl`](live-switch-idempotency-race.jsonl): 42 telemetry frames the gate wrote
as it went.

## What was real

- `firedrill-gate` registered through `POST /agents` with a personal Gateway API key, was opened to "anyone"
  (addressing policy `null`), and held its agent WebSocket (`/agents/{id}/connection/ws`) to Switch.
- `python -m gate.main --probe` against the live server: health ok, **53 ops, no schema problems**
  (`ops_schema_problems: []`).
- A bridged room, `firedrill-idempotency-race`, was created with Switch's `create_room` op (gate invited, the
  seeded Mattermost user added). The commands below were posted into that room through Mattermost's API and
  reached the gate as Switch room messages.
- The verifier ran the incident lab's own pytest checks in fresh local workspaces for every verdict.
- The gate wrote its decision log as room documents (`update_room_document`) and posted its rulings back into
  the room (`post_message`).
- The merge went through the guarded `update` hook on the evidence remote with the gate's key. Its `main`
  now reads `35bf8d7 FireDrill: merge V-idempotency-race-003` on top of `611c939 [scripted] root-cause fix`.

## What the run showed

| Step | Command (as posted) | Gate's verdict |
|---|---|---|
| naive patch | `@firedrill-gate SUBMIT fix/idempotency-race …` | `V-idempotency-race-001` **GREEN** (repro only) |
| hostile tests | `@firedrill-gate ATTACK attack/idempotency-race …` | `V-idempotency-race-002` **RED** |
| root-cause patch | `@firedrill-gate SUBMIT fix/idempotency-race …` | `V-idempotency-race-003` **GREEN** |
| sign-off | `@firedrill-gate APPROVE V-idempotency-race-003` | signed off by `user`, merged to `main` |

`signoff.by` was `user`: the Mattermost sender name Switch reported for the human, pinned by the gate to that
participant id. That closes the open question about `sender_name` for Mattermost humans (RELAY_STATE unknown 2).

## What was scripted (and labelled so)

There was **no Claude Code or Codex session** in this run. `scripts/replay_demo.py` pushed the pre-written
patches and attack and posted every command as the one Mattermost human, so the "fixer", "breaker" and
"approver" are all that person. The gate treats such commands as `manual`, only because that person is a
configured approver. Nothing in the recording claims agent authorship. A drill with the real fixer and breaker
still needs a Switch Console with Claude Code and Codex signed in.

## A bug this run found

Against Switch 0.31.0 the gate would not have started. Its preflight read an `addressing` object from
`get_agent_detail`; 0.31.0 returns `addressing_policy` (`null` means open to anyone), so the check saw
"unknown" and refused. Fixed in `gate/main.py` (`addressing_state`) with `tests/test_addressing_state.py`, using
the shapes observed live.

## Not covered

- Real fixer and breaker agents (needs Console sign-ins).
- Whether `post_message(thread_id=…)` threads in Mattermost (RELAY_STATE unknown 3).
- Running the FireDrill template through Console (`run_template` exists as an op; not exercised).
- Windows.

## Reproduce

```bash
scripts/bootstrap_stack.sh                       # Switch 0.31.0 + Mattermost + Gateway
# Gateway -> API Keys -> new key -> .env FIREDRILL_REGISTRATION_TOKEN, then:
python scripts/register_gate.py
# open the gate to "anyone" (Console or Gateway), then:
scripts/bootstrap_evidence.sh <incident-lab repo>
python -m gate.main --probe
# create the room (Switch create_room with agent_names=[firedrill-gate], add the Mattermost user), then:
python -m gate.main &
python scripts/replay_demo.py --incident idempotency-race --room firedrill-idempotency-race --approve
```
