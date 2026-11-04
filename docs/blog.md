---
title: "Enforcing human approval for AI hotfixes: building FireDrill on Switch"
published: false
description: "Switch's incident-response docs admit human approval is instructions only. We built a courtroom where a gate agent enforces it in code, after a second AI has tried to break the fix."
tags: ai, agents, devops, python
cover_image: 
---

Switch's incident-response guide has an unusually honest sentence about human approval:

> "Switch doesn't enforce this. The agent's credentials would allow the change, so the instructions are the only control."

That is true of nearly every agent workflow I've seen. You tell the agent "wait for a human before merging", and the only thing standing between your main branch and a wrong merge is the agent deciding to comply. For a hotfix, at 3 a.m., written by a model that wants to be helpful, that isn't a control. It's a hope.

For the Flip the Switch hackathon we built **FireDrill** to turn the hope into a mechanism. This post is about the design, the three things we found by reading Switch's source instead of the brief, and where it still falls short.

## The shape of it: a courtroom in a chat room

One Switch room holds four participants:

- a human (the approver),
- `firedrill-fixer`, a Claude agent that patches the incident,
- `firedrill-breaker`, a Codex agent that writes hostile tests against the patch,
- `firedrill-gate`, a custom agent we wrote, and the only holder of the merge credential.

The fixer and breaker are different model families on purpose, so they don't share blind spots. The gate is not a model at all. It is a Python service that speaks Switch's agent protocol and makes decisions by running code.

The flow has four commands, all addressed to `@firedrill-gate`:

| Command | Who may send it | What the gate does |
|---|---|---|
| `SUBMIT <branch> <sha>` | the fixer | fetch the commit, verify it in a clean container |
| `ATTACK <branch> <sha>` | the breaker | fetch the attack, re-verify the latest fix against it |
| `APPROVE <verdict id>` | a named approver | merge, if every condition holds |
| `STATUS` | anyone | post the docket |

A verdict is **GREEN** only when, in a fresh container with no network, the original repro passes, every *valid* attack passes, and an invariant check passes. Otherwise it is RED (something failed) or ERROR (the gate itself had a problem).

## "No attack, no sign-off"

The first bug our own tests caught was a design bug. A naive fix, such as wrapping a handler in a lock, passes the original repro. That makes it GREEN before the breaker has done anything, and a human could approve it unattacked.

So we added a rule the gate enforces: `APPROVE` is refused unless the latest verdict is GREEN **and** it ran against an attack. A naive fix shows as "GREEN on repro only", and the sign-off box on the dashboard says exactly that. The human is only asked once a second AI has failed to break the fix.

The breaker can't cheat either. Attacks are validated against a private reference fix the agents never see. An attack that fails on correct code is discarded and named (Rule R3), so the red team can't win with a test that is simply wrong.

## Making the approval real

`APPROVE <verdict id>` is where "instructions only" would normally live. Here the gate checks, in code:

1. **Who sent it.** The sender must be a configured approver, identified by Switch's participant id, not by the words in the message.
2. **Which verdict.** It must be the latest, and it must be GREEN.
3. **That it faced an attack.** No attack, no sign-off.
4. **That nothing moved.** The fix's commit must still be the head of its branch; a push after GREEN makes the verdict stale.

Then the gate merges using a key that exists only in its environment. In our local setup the "protected branch" is a bare git remote whose `update` hook rejects `main` unless that key is presented. Our tests push to it for real and check that `main` is rejected with no key, with a wrong key, with a swapped key-hash file, on non-fast-forward and on delete.

Each decision is written to `firedrill-verdicts`, a Switch room document. Switch lets everyone read a room document but only the agent that wrote it edit it, so the gate's decision log is tamper-evident to everyone else in the room.

## Three things Switch's source told us that the brief didn't

We read `sandbox-quantum/switch` at commit `7e1316f` rather than trusting our vocabulary.

**1. It's a WebSocket, not SSE.** Since 0.30.0 an agent holds a single `WS /agents/{id}/connection/ws`; the SSE endpoint is kept only for a compatibility window and the live docs say to move off it. The gate connects over WebSocket, answers the server's `ping` with a `pong` carrying its cursor, and resumes from that cursor on reconnect.

**2. An agent can't set its own addressing, and who registered it decides who can reach it.** `update_agent_detail` refuses to act on the calling agent, so our gate can't open itself to "anyone". The owner has to do that in Console or the Gateway. Worse, a registration key minted from the shared bootstrap token creates the agent under a *different owner*, and a fixer set to `owner-agents` will ignore it. The gate has to be registered with a personal key from the person running the template. Without this, everything looks fine and nothing talks to anything.

**3. There are two id spaces.** `list_participants` returns agent UUIDs. `message.sender` is an opaque participant id like `@switch-…:server`. They don't match. Since the gate authenticates `APPROVE` by participant id, it pins each name to the first participant id it sees and refuses a name that later arrives from another id. A message from someone *named* `firedrill-fixer` who isn't the pinned participant is an identity conflict, announced and ignored.

We also dropped three words from the brief that aren't Switch primitives: History, Rules and Decisions. The real ones are the room's message log, the room `instructions`, and gate-owned room documents.

## The courtroom dashboard

The dashboard is a React and Vite app on `:5173` built to be read in ten seconds beside Mattermost:

- **Left, the room mirror.** Every room message, with role badges and the `@firedrill-gate` commands highlighted.
- **Centre, the case.** The incident, the fix under trial with its diff stat, and the attack matrix: valid attacks and the ones the gate discarded.
- **Right, the verdict.** A stamp (PENDING, RED, GREEN, MERGED), per-check rows with durations and expandable output, and the enforced sign-off box.
- **Bottom, the docket.** The verdicts in order: V-001 → V-002 → V-003 → sign-off → merged.

It is fed by `ws://localhost:8787/telemetry`. The gate publishes a frame for each real room event or gate action and appends it to a JSONL file; a freshly opened dashboard gets the file replayed, so refreshing mid-drill loses nothing. The design rule is that there are no synthetic frames: if the dashboard shows it, the gate did it or the room said it.

### Replay mode for judges

Judges often have no Docker and no API credits, so the dashboard has a **Replay Recorded Drill** button that steps through recorded frames in the browser. The recording came from our test harness running the real courtroom and a real guarded merge. Its verifier is a test stand-in, and the banner and the verdict's `runner` field say so. A replay is labelled "scripted" everywhere it appears. We think a replay that admits what it is beats a demo that quietly fakes a result.

## What we haven't done

- **We haven't driven it against a live Switch server yet.** Our build environment couldn't pull the Switch images. The gate's WebSocket client is tested against a local server that speaks Switch's documented frames, but a few runtime details, such as the exact op argument names at 0.31.0, are still to be confirmed with the gate's `--probe` command.
- **The merge enforcement is a local-demo version.** A git hook and a key is a stand-in for what you'd run in production: a protected branch and a GitHub App held by the gate, with the agents limited to read access.
- **The recorded replay uses a stand-in verifier**, not the container verifier.

## Why Switch

Take Switch away and FireDrill needs a shared room for a human and two vendors' agents, an identity layer to authenticate a sign-off, a store only one writer can edit, a way to stop strangers steering the agents, and exclusive roles. Switch provides all five. The part we added is small and deliberately boring: a gate that runs code and refuses to be talked into anything.

The code is at [github.com/ElaraLarsen/firedrill](https://github.com/ElaraLarsen/firedrill).
