// Plain-language narration of what just happened, so anyone (not just engineers) can follow the drill.
// Every sentence is derived from one real frame; nothing is invented.

import { COMMAND_RE, emptyState, faced, latest, reduce, type Frame, type State } from "./model";
import { stages, testName } from "./views";

export type Tone = "fixer" | "breaker" | "gate" | "approver" | "human" | "pass" | "fail" | "wait";
export interface Line { tone: Tone; title: string; detail: string }

const commandOf = (body: string): string | null => {
  const m = [...body.matchAll(COMMAND_RE)][0];
  return m ? m[1].toUpperCase() : null;
};

export function narrate(f: Frame | null, approvers: string[] = []): Line {
  if (!f) return { tone: "wait", title: "Ready when you are", detail: "Press Enter to run the first step, or type run." };
  const d = f.data ?? {};
  const who = f.actor?.name ?? "someone";
  switch (f.kind) {
    case "gate_state":
      return { tone: "gate", title: "Court is in session", detail: `The gate opened a case for ${d.incident ?? "this incident"}.` };
    case "room_message": {
      const body = String(d.body ?? "");
      const cmd = commandOf(body);
      const role = f.actor?.role;
      if (role === "gate") {
        if (body.startsWith("Rejected:")) return { tone: "fail", title: "The gate said no", detail: body.replace(/^Rejected:\s*/, "") };
        if (body.startsWith("MERGED.")) return { tone: "pass", title: "Merged!", detail: "The gate used its key to merge the approved fix." };
        if (body.startsWith("Docket open")) return { tone: "gate", title: "Court is in session", detail: "The gate posted the incident brief and the rules." };
        const ruled = body.match(/^\*\*(V-[\w-]+?-(\d+)): (GREEN|RED|ERROR)\*\*/);
        if (ruled) {
          const [, , n, res] = ruled;
          const attacked = /vs attack/.test(body.split("\n")[0]);
          const tone: Tone = res === "GREEN" ? (attacked ? "pass" : "wait") : "fail";
          const detail = res === "GREEN" ? (attacked ? "Survived the attacks. A human may now sign off." : "It fixes the bug, but the red team hasn't attacked yet.")
            : res === "RED" ? (attacked ? "Broken under attack. Back to the fixer." : "The bug test still fails.") : "Infrastructure problem. Nothing merges.";
          return { tone, title: `The gate's ruling on V-${n}: ${res}`, detail };
        }
        if (/^Fix `/.test(body)) return { tone: "gate", title: "The gate received the patch", detail: "Testing it in a fresh workspace…" };
        if (/^Attack `/.test(body)) return { tone: "gate", title: "The gate received the attack", detail: "Re-testing the current patch against it…" };
        return { tone: "gate", title: "The gate posted an update", detail: body.split("\n")[0].replace(/\*\*|`/g, "").slice(0, 140) };
      }
      if (cmd === "SUBMIT") return { tone: "fixer", title: "The fixer submitted a patch", detail: "It goes on trial in a fresh workspace." };
      if (cmd === "ATTACK") return { tone: "breaker", title: "The red team attacked", detail: "Hostile tests aimed straight at the patch." };
      if (cmd === "APPROVE") {
        return approvers.includes(who)
          ? { tone: "approver", title: `${who} asked to sign off`, detail: "The gate checks who they really are before anything merges." }
          : { tone: "human", title: `${who} tried to approve`, detail: "Only a named approver can sign off." };
      }
      return { tone: role === "fixer" ? "fixer" : role === "breaker" ? "breaker" : "human", title: `${who} spoke up`, detail: body.slice(0, 140) };
    }
    case "submission":
      return { tone: "fixer", title: "A patch is on trial", detail: `${d.branch ?? "fix"} at ${String(d.sha ?? "").slice(0, 7)}` };
    case "attack":
      return { tone: "breaker", title: "Hostile tests filed", detail: `${d.branch ?? "attack"} at ${String(d.sha ?? "").slice(0, 7)}` };
    case "verdict_started":
      return { tone: "wait", title: "The gate is testing it", detail: "Real tests, fresh workspace, no shortcuts." };
    case "check": {
      const ok = d.status === "pass";
      const vsRef = d.against === "reference";
      return {
        tone: ok ? "pass" : "fail",
        title: `${testName(String(d.name ?? "check"))} ${ok ? "passed" : "failed"}`,
        detail: vsRef
          ? ok ? "Checked against the gate's correct fix: this test is fair." : "It fails even on correct code, so it gets thrown out (Rule R3)."
          : ok ? "Run against the submitted patch: it held." : "Run against the submitted patch: it broke.",
      };
    }
    case "verdict": {
      const attacked = Boolean(d.attack) || (Array.isArray(d.checks) && d.checks.some((c: { kind?: string }) => c.kind === "attack"));
      if (d.result === "GREEN") return attacked
        ? { tone: "pass", title: "It survived every attack!", detail: "Now, and only now, a human can sign off." }
        : { tone: "wait", title: "Passed the bug test, but nobody has attacked it yet", detail: "No attack, no sign-off." };
      if (d.result === "RED") return attacked
        ? { tone: "fail", title: "Broken! The red team found a hole", detail: "Back to the fixer for a real root-cause fix." }
        : { tone: "fail", title: "The patch doesn't fix the bug", detail: "The original repro still fails." };
      return { tone: "fail", title: "The gate hit an error", detail: "Nothing merges on an error." };
    }
    case "signoff":
      return { tone: "approver", title: `${d.by ?? who} signed off`, detail: "Identity confirmed by Switch participant id, not by the words typed." };
    case "merge":
      return { tone: "pass", title: "Merged into main", detail: `The gate turned its key. main is now ${String(d.main_sha ?? "").slice(0, 7)}.` };
    case "rejected":
      return { tone: "fail", title: "Refused", detail: String(d.reason ?? "") };
  }
}

/** When following a live gate there's no frame cursor, so describe the latest verdict. */
export function narrateState(s: State): Line {
  const v = latest(s.verdicts);
  if (!v) return { tone: "wait", title: "Waiting for the first move", detail: "The gate mirrors the room as soon as anyone speaks." };
  if (v.merged) return { tone: "pass", title: "Merged into main", detail: `main is now ${v.merged.main_sha.slice(0, 7)}.` };
  if (v.result === "PENDING") return { tone: "wait", title: "The gate is testing it", detail: "Real tests, fresh workspace." };
  if (v.result === "GREEN") return faced(v)
    ? { tone: "pass", title: "It survived every attack!", detail: "Waiting for a human to sign off." }
    : { tone: "wait", title: "Passed the bug test", detail: "No attack, no sign-off." };
  return { tone: "fail", title: v.result === "RED" ? "Broken" : "Error", detail: v.id };
}

/** For each docket stage, the replay step at which it first happened (for jump-to-stage). */
export function stageSteps(frames: Frame[]): Record<string, number> {
  const out: Record<string, number> = {};
  let s = emptyState();
  frames.forEach((f, i) => {
    s = reduce(s, f);
    for (const st of stages(s)) {
      if (!(st.key in out) && (st.state === "done" || st.state === "failed" || st.state === "skipped")) out[st.key] = i + 1;
    }
  });
  return out;
}
