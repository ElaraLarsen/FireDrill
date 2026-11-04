# FireDrill: 3-minute demo script

Target length 3:00. Screen: Mattermost on the left half, the courtroom dashboard (`http://localhost:5173`) on the right half. Spoken lines are in quotes and are meant to be read as written (~430 words, about 2:50 at a calm pace).

**Before recording:** stack up, template run for `idempotency-race`, dashboard showing LIVE. For a take without Docker or API keys, use Judge Replay Mode instead (see the note at the end); every beat below still applies, and the on-screen banner will say "scripted".

---

### 0:00–0:20  The hook
*On screen: Switch's incident-response docs, the sentence about approval highlighted. Cut to the empty dashboard.*

"Switch's own incident-response guide says that human approval isn't enforced: the agent's credentials would allow the change, so the instructions are the only control. That is the whole problem with agents merging hotfixes. FireDrill makes the approval real."

### 0:20–0:45  The room
*On screen: the Mattermost room `firedrill-idempotency-race`. Point at the four members.*

"One Switch room. Me, a Claude fixer, a Codex breaker, and a custom agent called firedrill-gate. The gate is the only thing that holds the merge key. The incident: retried payments are charging customers twice."

### 0:45–1:15  A naive fix
*On screen: the fixer posts `@firedrill-gate SUBMIT fix/idempotency-race <sha>`. Dashboard: verdict row animates in, stamp reads GREEN ON REPRO ONLY.*

"The fixer wraps the handler in a lock and submits it. The gate checks it in a clean container. The repro passes. Look at the stamp: green on repro only. And the sign-off box says, no attack, no sign-off. I can't approve this, even though it's green."

*On screen: type `@firedrill-gate APPROVE <verdict id>`; the gate refuses. Dashboard: refusal line appears.*

"Watch. I try anyway. Refused."

### 1:15–1:50  The breaker attacks
*On screen: the breaker posts `ATTACK attack/idempotency-race <sha>`. Dashboard centre panel: attack matrix fills in. Stamp slams to RED.*

"Now the breaker writes a hostile test: two app processes on one database firing the same key. The gate re-runs the fix against it. Red. Broken by red-team. A lock only protects one process. The attack matrix shows which test broke it, and any attack that fails on the gate's private reference fix would be thrown out under rule R3, so the breaker can't win by cheating."

### 1:50–2:25  The real fix
*On screen: the fixer posts a second SUBMIT. Docket timeline gains V-003. Stamp turns GREEN, survived all attacks. Sign-off box: Awaiting APPROVE.*

"The fixer goes back to the root cause: a unique constraint and an insert that handles the conflict. Resubmit. Green, and this time it survived the attack. Only now does the sign-off box ask for a human."

### 2:25–2:50  The human, and the merge
*On screen: type `@firedrill-gate APPROVE <verdict id>` as the approver. Stamp: MERGED TO MAIN. Docket: sign-off chip, merge chip.*

"I type approve. The gate checks that I'm the approver by my Switch participant id, not by my words, that this is the latest verdict, that it's green, that it faced an attack, and that the branch hasn't moved. Then it merges with the key only it holds. The whole story is in the docket, and in a room document that only the gate can edit."

### 2:50–3:00  Close
*On screen: the README's five Switch primitives table.*

"One room, real identity, gate-owned documents, addressing, exclusive roles. That's Switch doing the work. FireDrill: agents that have to prove it before a human is asked."

---

## Replay-mode take (no Docker, no keys)
Run `cd dashboard && npm run dev`, open the dashboard, click **▶ Replay Recorded Drill**, and drive it with Step ▶ in time with the narration. The room mirror shows the same messages in the same order. Say once, near 0:20: "This is a recorded drill: real courtroom code and a real guarded merge, with a test verifier standing in for the container runner." Do not describe the replay as a live Switch run.

## Shot checklist
- [ ] Dashboard font size readable at 1080p side by side with Mattermost
- [ ] Stamp visible at every beat (PENDING → GREEN on repro only → RED → GREEN → MERGED)
- [ ] The refused APPROVE on screen
- [ ] The docket timeline in frame at the end
