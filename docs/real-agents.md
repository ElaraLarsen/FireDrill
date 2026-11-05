# Run the drill with real Claude Code and Codex agents

Everything the gate needs is already running on this Mac (set up 2026-11-05): a local Switch 0.31.0 stack, the registered
`firedrill-gate` agent, a clean evidence remote, and a lab repo. What is left is the part only a person can do: sign the two
coding agents in to Switch Console and run the template once.

Sources: [Install Switch Console](https://docs.switchagents.ai/switch-rooms/getting-started/install-switch-console),
[Add a server](https://docs.switchagents.ai/switch-rooms/getting-started/add-a-server),
[Set up agent providers](https://docs.switchagents.ai/switch-rooms/getting-started/set-up-agent-providers).

## What is already in place

| Thing | Where |
|---|---|
| Switch API | `http://localhost:8000` |
| Gateway (admin UI) | `http://localhost:3000`, user `admin@switch.local`, password = `GATEWAY_ADMIN_PASSWORD` in `.env` |
| Mattermost | `http://localhost:8065`, user `user`, password = `MATTERMOST_USER_PASSWORD` in `.env` |
| `firedrill-gate` | registered, addressing open to anyone, **owned by the Gateway admin account** |
| Lab repo | `/Users/ansh/firedrill-live/lab` |
| Evidence remote | `/Users/ansh/firedrill-live/evidence.git` (main guarded by the gate key) |
| Dashboard | `http://localhost:5173` (lists the gate's recordings, including your real run) |

Start (or restart) the gate natively, from the repo root:

```bash
PATH="$HOME/firedrill-live/venv/bin:$PATH" python -m gate.main
```

The `PATH` part matters: the verifier runs `python -m pytest`, so the Python it finds must have pytest, fastapi and httpx.
With the system Python the verdicts come back `ERROR`.

## 1. Install Switch Console

Download the macOS Apple-silicon build and drag it to Applications:
<https://github.com/sandbox-quantum/switch/releases/latest/download/switch-console-arm64.dmg>

## 2. Add the server and sign in as the gate's owner

1. Open Switch Console. In **Setting up Switch**, choose **Add a server**, then **Connect to an existing server**.
2. Enter `http://localhost:8000`.
3. Sign in with the **Gateway admin** account (`admin@switch.local`, password from `.env`). Use this account, not a new one:
   the fixer and breaker use `owner-agents` addressing, so they only listen to agents their own owner runs, and the gate
   belongs to this account.
4. When asked to link a messaging account, link the Mattermost user `user`.

## 3. Sign in to Claude Code and Codex

1. In the sidebar choose **Settings → Agent providers**.
2. Select **Claude Code**. If the line under the name says **CLI not installed**, install it, press the refresh icon,
   and quit Switch Console completely (Cmd+Q) and reopen it if it still doesn't see it.
3. If it says **Not signed in**, copy the sign-in command shown under *Run in a terminal on this computer, then Recheck*,
   run it in Terminal, sign in, then press **Recheck**. The line should now read **Signed in**.
4. Do the same for **Codex**.

Switch Console cannot sign in for you; the provider's own CLI does it, under your own account.

## 4. Run the FireDrill template

1. In Switch Console open **Templates** and upload `templates/firedrill.template.yaml`. Fix anything its lint reports and
   paste the warnings into `RELAY_STATE.md`.
2. Run it with these values:
   - **Drill name:** `firedrill` (default)
   - **Incident:** `idempotency-race` (or either of the other two)
   - **Gate agent:** `firedrill-gate`
   - **incident-lab repository:** `/Users/ansh/firedrill-live/lab`
   - **Evidence remote** (advanced): `/Users/ansh/firedrill-live/evidence.git`
   - **Bridge:** Mattermost
3. The template creates `firedrill-fixer` (Claude Code) and `firedrill-breaker` (Codex) and the room `firedrill-<incident>`.

## 5. Watch it, and approve

1. Open the room in Mattermost (`http://localhost:8065`, channel `firedrill-<incident>`) or in Switch Console.
2. The fixer submits a patch, the breaker attacks, the gate rules. When the latest verdict is **GREEN after an attack**,
   type in the room, as the Mattermost user `user` (the configured approver):
   `@firedrill-gate APPROVE <verdict id>`
3. Open `http://localhost:5173`. The gate's new recording appears in the case list and the console replays it.

## 6. Record what happened

Paste into `RELAY_STATE.md`: the template lint warnings, the verdict ids, whether the fixer and breaker really got through
Rule R3 and the attack, and `git --git-dir=/Users/ansh/firedrill-live/evidence.git log --oneline main`. Copy the gate's
JSONL from `gate/state/` to `docs/evidence/live-agents-<incident>.jsonl`. This is the only run in which Claude and Codex
are real participants, so label it that way, and keep the scripted runs labelled as scripted.

## If something doesn't work

- **The agents don't answer the gate / the gate can't wake them:** they are owned by a different account than the gate.
  Sign in to Switch Console as `admin@switch.local` and run the template again.
- **Verdicts are `ERROR`:** the gate was started without the venv on `PATH` (see above).
- **Port already in use on 8787:** the compose gate container is running; stop it with
  `docker compose -f docker-compose.firedrill.yml stop gate`.
- **A session never starts:** Claude Code and Codex may be waiting for a folder-trust prompt; Switch Console's
  *Auto-trust worktree directories* (Settings → General) is on by default.
