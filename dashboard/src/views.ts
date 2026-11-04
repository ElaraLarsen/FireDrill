// Read-only views over the reducer's State, for the UI. Nothing here changes state, and every value
// is derived from frames the gate emitted; when a stage hasn't happened, it says so.

import { faced, latest, short, type Check, type State, type Verdict } from "./model";

export const INCIDENT_META: Record<string, { n: string; label: string }> = {
  "idempotency-race": { n: "01", label: "Idempotency Race" },
  "ratelimit-boundary": { n: "02", label: "Rate Limit Boundary" },
  "pagination-cursor": { n: "03", label: "Cursor Pagination" },
};

/** `attacks/test_attack.py::test_two_processes` -> `test_two_processes`; `checks/repro_test.py` -> `repro_test`. */
export function testName(name: string): string {
  const leaf = name.includes("::") ? name.split("::").pop()! : name.split("/").pop()!;
  return leaf.replace(/\.py$/, "");
}

export interface Brief { title: string; overview: string; rest: string }

/** The incident brief is markdown: a `# title`, then paragraphs. */
export function brief(text: string): Brief | null {
  const t = text.trim();
  if (!t) return null;
  const lines = t.split("\n");
  const title = lines[0].startsWith("#") ? lines.shift()!.replace(/^#+\s*/, "") : "";
  const paras = lines.join("\n").trim().split(/\n\s*\n/);
  return { title, overview: (paras.shift() ?? "").replace(/\s*\n\s*/g, " "), rest: paras.join("\n\n") };
}

export interface FailedSummary { failed: number; total: number; names: string[] }

/** Checks run against the submitted fix that did not pass. */
export function failedAgainstFix(v: Verdict | undefined): FailedSummary | null {
  if (!v) return null;
  const fix = v.checks.filter((c) => c.against === "fix");
  const bad = fix.filter((c) => c.status !== "pass");
  return { failed: bad.length, total: fix.length, names: bad.map((c) => testName(c.name)) };
}

export function groupChecks(v: Verdict | undefined): { reference: Check[]; fix: Check[] } {
  const checks = v?.checks ?? [];
  return { reference: checks.filter((c) => c.against === "reference"), fix: checks.filter((c) => c.against !== "reference") };
}

export type StageState = "done" | "failed" | "active" | "pending" | "skipped";
export interface Stage { key: string; label: string; state: StageState; detail: string }

/**
 * The trial as seven stages. A stage is done only when the frames show it happened:
 * "Naive Patch" is the first patch if an attack later broke it, "Root-Cause Fix" is a later patch
 * after that RED verdict, and so on. If the first patch survives, the root-cause stage is skipped.
 */
export function stages(s: State): Stage[] {
  const vs = s.verdicts;
  const red = vs.find((v) => faced(v) && v.result === "RED");
  const green = [...vs].reverse().find((v) => faced(v) && v.result === "GREEN");
  const signed = vs.find((v) => v.signoff);
  const merged = vs.find((v) => v.merged);
  const first = s.fixes[0];
  const firstBroken = Boolean(red && first && red.fix?.sha === first.sha);
  const rootFix = red ? [...s.fixes].reverse().find((f) => f.sha !== red.fix?.sha) : undefined;
  const firstVerdict = first ? vs.find((v) => v.fix?.sha === first.sha) : undefined;
  const attackRan = vs.some((v) => faced(v) && v.result !== "PENDING");

  const raw: Omit<Stage, "state">[] = [];
  const st: (StageState | null)[] = [];
  const push = (key: string, label: string, state: StageState | null, detail = "") => { raw.push({ key, label, detail }); st.push(state); };

  push("docket", "Docket Open", s.frames > 0 && (s.brief || s.roomName || s.fixes.length) ? "done" : null, s.incident ?? "");
  push("patch", firstBroken ? "Naive Patch" : "Patch", first ? "done" : null,
    first ? `${short(first.sha)}${firstVerdict && firstVerdict.result !== "PENDING" ? ` · ${firstVerdict.result}${faced(firstVerdict) ? "" : " on repro"}` : ""}` : "");
  push("attack", red ? "Red-Team Attack (RED)" : "Red-Team Attack", red ? "failed" : attackRan ? "done" : null,
    red ? `${red.id.replace(/^V-.*-(\d+)$/, "V-$1")} · ${short(red.fix?.sha)} broken` : s.attacks[0] ? short(s.attacks[0].sha) : "");
  push("fix", "Root-Cause Fix", rootFix ? "done" : !red && green ? "skipped" : null,
    rootFix ? short(rootFix.sha) : !red && green ? "not needed" : "");
  push("green", "Adversarial Test (GREEN)", green ? "done" : null, green ? green.id.replace(/^V-.*-(\d+)$/, "V-$1") : "");
  push("signoff", "Sign-off", signed ? "done" : null, signed?.signoff ? signed.signoff.by : "");
  push("merged", "Merged", merged ? "done" : null, merged?.merged ? `main ${short(merged.merged.main_sha)}` : "");

  // The first stage that hasn't happened is the one in progress (once anything has happened).
  const lastDone = st.reduce<number>((acc, x, i) => (x ? i : acc), -1);
  return raw.map((r, i) => {
    const known = st[i];
    if (known) return { ...r, state: known };
    if (lastDone >= 0 && i === lastDone + 1 && !latest(vs)?.merged) return { ...r, state: "active" };
    return { ...r, state: "pending" };
  });
}
