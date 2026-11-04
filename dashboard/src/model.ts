// Frame model + reducer. Every field here comes from a telemetry frame
// (ARCHITECTURE.md §4.3); nothing is invented on the client.

export type Kind =
  | "room_message" | "submission" | "attack" | "verdict_started" | "check"
  | "verdict" | "signoff" | "merge" | "rejected" | "gate_state";

export interface Actor { id?: string; name?: string; role?: string }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Data = Record<string, any>;
export interface Frame { ts: string; kind: Kind; room_id: string; seq: number | null; actor: Actor; data: Data }

export interface Check { name: string; kind: string; against: string; status: string; duration_ms?: number; output_tail?: string }
export interface Ref { branch: string; sha: string }
export interface DiffStat { files: number; insertions: number; deletions: number; names: string[] }
export interface Submission extends Ref { by: string; manual: boolean; at: string; diff_stat?: DiffStat | null }
export type Result = "PENDING" | "GREEN" | "RED" | "ERROR";

export interface Verdict {
  id: string;
  result: Result;
  fix?: Ref;
  attack?: Ref | null;
  checks: Check[];
  discarded: { name: string; reason: string }[];
  runner?: { image?: string; network?: string };
  notes: string[];
  signoff?: { by: string; participant?: string; at: string };
  merged?: { main_sha: string; fix_sha: string; by: string; at: string };
  startedTs: string;
  finishedTs?: string;
}

export interface Msg { key: number; ts: string; actor: Actor; body: string; addressed: boolean; threadId?: string | null }
export interface Rejection { ts: string; by: string; reason: string }

export interface State {
  roomId: string;
  roomName: string;
  incident: string | null;
  brief: string;
  approvers: string[];
  messages: Msg[];
  fixes: Submission[];
  attacks: Submission[];
  verdicts: Verdict[];
  rejections: Rejection[];
  frames: number;
  lastTs: string;
}

export const INCIDENTS = ["idempotency-race", "ratelimit-boundary", "path-traversal"] as const;

export const emptyState = (): State => ({
  roomId: "", roomName: "", incident: null, brief: "", approvers: [],
  messages: [], fixes: [], attacks: [], verdicts: [], rejections: [], frames: 0, lastTs: "",
});

const sub = (d: Data): Submission => ({
  branch: String(d.branch ?? ""), sha: String(d.sha ?? ""), by: String(d.by ?? ""),
  manual: Boolean(d.manual), at: String(d.at ?? ""), diff_stat: d.diff_stat ?? null,
});

const blankVerdict = (id: string, ts: string): Verdict => ({
  id, result: "PENDING", checks: [], discarded: [], notes: [], startedTs: ts,
});

const findVerdict = (s: State, id: string): Verdict | undefined => s.verdicts.find((v) => v.id === id);

function incidentFromBranch(branch: string): string | null {
  const i = branch.indexOf("/");
  return i > 0 ? branch.slice(i + 1) : null;
}

export function reduce(prev: State, f: Frame): State {
  const d = f.data ?? {};
  // A new docket in another room starts a new case; stray frames from other rooms are ignored.
  let s = prev;
  if (!s.roomId) s = { ...s, roomId: f.room_id };
  else if (f.room_id !== s.roomId) {
    if (f.kind === "gate_state" && d.state === "docket_open") s = { ...emptyState(), roomId: f.room_id };
    else return prev;
  }
  const next: State = { ...s, frames: s.frames + 1, lastTs: f.ts };

  switch (f.kind) {
    case "room_message":
      next.messages = [...s.messages, {
        key: s.messages.length, ts: f.ts, actor: f.actor ?? {}, body: String(d.body ?? ""),
        addressed: Boolean(d.addressed), threadId: d.thread_id ?? null,
      }];
      break;
    case "gate_state":
      if (d.state === "docket_open") {
        next.incident = d.incident ?? next.incident;
        next.roomName = String(d.room_name ?? next.roomName);
        next.brief = String(d.brief ?? next.brief);
        next.approvers = Array.isArray(d.approvers) ? d.approvers.map(String) : next.approvers;
      }
      break;
    case "submission": {
      const e = sub(d);
      next.fixes = [...s.fixes, e];
      next.incident = next.incident ?? incidentFromBranch(e.branch);
      break;
    }
    case "attack": {
      const e = sub(d);
      next.attacks = [...s.attacks, e];
      next.incident = next.incident ?? incidentFromBranch(e.branch);
      break;
    }
    case "verdict_started": {
      const v = blankVerdict(String(d.verdict_id), f.ts);
      v.fix = d.fix ? { branch: d.fix.branch, sha: d.fix.sha } : undefined;
      v.attack = d.attack ? { branch: d.attack.branch, sha: d.attack.sha } : null;
      next.verdicts = [...s.verdicts.filter((x) => x.id !== v.id), v];
      break;
    }
    case "check": {
      const id = String(d.verdict_id);
      const c: Check = {
        name: String(d.name), kind: String(d.kind), against: String(d.against),
        status: String(d.status), duration_ms: d.duration_ms, output_tail: d.output_tail,
      };
      const v = findVerdict(s, id) ?? blankVerdict(id, f.ts);
      next.verdicts = [...s.verdicts.filter((x) => x.id !== id), { ...v, checks: [...v.checks, c] }];
      break;
    }
    case "verdict": {
      const id = String(d.verdict_id);
      const v = findVerdict(s, id) ?? blankVerdict(id, f.ts);
      const done: Verdict = {
        ...v,
        result: (d.result as Result) ?? "ERROR",
        fix: d.fix ?? v.fix,
        attack: d.attack ?? null,
        checks: Array.isArray(d.checks) ? d.checks : v.checks,
        discarded: Array.isArray(d.discarded_attacks) ? d.discarded_attacks : [],
        runner: d.runner,
        notes: Array.isArray(d.notes) ? d.notes : [],
        finishedTs: f.ts,
      };
      next.incident = next.incident ?? d.incident ?? null;
      next.verdicts = [...s.verdicts.filter((x) => x.id !== id), done];
      break;
    }
    case "signoff": {
      const id = String(d.verdict_id);
      next.verdicts = s.verdicts.map((v) =>
        v.id === id ? { ...v, signoff: { by: String(d.by), participant: d.participant, at: String(d.at) } } : v);
      break;
    }
    case "merge": {
      const id = String(d.verdict_id);
      next.verdicts = s.verdicts.map((v) =>
        v.id === id ? { ...v, merged: { main_sha: String(d.main_sha), fix_sha: String(d.fix_sha), by: String(d.by), at: String(d.at) } } : v);
      break;
    }
    case "rejected":
      next.rejections = [...s.rejections, { ts: f.ts, by: f.actor?.name ?? "?", reason: String(d.reason ?? "") }];
      break;
  }
  return next;
}

export function replay(frames: Frame[], upTo: number): State {
  let s = emptyState();
  for (let i = 0; i < Math.min(upTo, frames.length); i++) s = reduce(s, frames[i]);
  return s;
}

// ── derived views ─────────────────────────────────────────────────────────
export const latest = <T,>(xs: T[]): T | undefined => xs[xs.length - 1];
export const short = (sha: string | undefined) => (sha ? sha.slice(0, 7) : "—");

export type Stamp = { label: string; tone: "pending" | "red" | "green" | "merged" | "error" | "idle" };

export function stamp(s: State): Stamp {
  const v = latest(s.verdicts);
  if (!v) return { label: "NO CASE FILED", tone: "idle" };
  if (v.merged) return { label: "MERGED TO MAIN", tone: "merged" };
  switch (v.result) {
    case "PENDING": return { label: "PENDING", tone: "pending" };
    case "RED": return { label: v.attack ? "RED — BROKEN BY RED-TEAM" : "RED — REPRO FAILED", tone: "red" };
    case "ERROR": return { label: "ERROR — GATE FAULT", tone: "error" };
    case "GREEN": return v.attack
      ? { label: "GREEN — SURVIVED ALL ATTACKS", tone: "green" }
      : { label: "GREEN ON REPRO ONLY — NO ATTACK YET", tone: "pending" };
  }
}

export type SignOff =
  | { phase: "no_attack"; text: string }
  | { phase: "blocked"; text: string }
  | { phase: "awaiting"; text: string; verdictId: string }
  | { phase: "signed"; text: string }
  | { phase: "merged"; text: string };

export function signOff(s: State): SignOff {
  const v = latest(s.verdicts);
  if (!v) return { phase: "no_attack", text: "No attack, no sign-off." };
  if (v.merged) return { phase: "merged", text: `MERGED ${short(v.merged.main_sha)} (Gate Key Verified)` };
  if (v.signoff) return { phase: "signed", text: `Signed off by ${v.signoff.by}. Gate is merging…` };
  if (v.result === "PENDING") return { phase: "blocked", text: "Verification running in a clean container." };
  if (v.result !== "GREEN") return { phase: "blocked", text: `${v.id} is ${v.result}. Sign-off is locked until a fix is GREEN.` };
  if (!v.attack) return { phase: "no_attack", text: "No attack, no sign-off." };
  const who = s.approvers.length ? s.approvers.map((a) => `@${a}`).join(" / ") : "a named approver";
  return { phase: "awaiting", verdictId: v.id, text: `Awaiting APPROVE ${v.id} from ${who}` };
}

export interface AttackRow { name: string; reference?: string; fix?: string; discarded?: string }

/** Attack matrix of one verdict: what the verifier recorded per attack test, and what it discarded. */
export function attackMatrix(v: Verdict | undefined): AttackRow[] {
  if (!v) return [];
  const rows = new Map<string, AttackRow>();
  for (const c of v.checks) {
    if (c.kind !== "attack") continue;
    const r = rows.get(c.name) ?? { name: c.name };
    if (c.against === "reference") r.reference = c.status;
    else r.fix = c.status;
    rows.set(c.name, r);
  }
  for (const dsc of v.discarded) rows.set(dsc.name, { ...(rows.get(dsc.name) ?? { name: dsc.name }), discarded: dsc.reason });
  return [...rows.values()];
}

export type RoleBadge = { text: string; tone: "fixer" | "breaker" | "gate" | "approver" | "human" };

export function badge(a: Actor, approvers: string[]): RoleBadge {
  switch (a.role) {
    case "fixer": return { text: "[FIXER :: claude]", tone: "fixer" };
    case "breaker": return { text: "[BREAKER :: codex]", tone: "breaker" };
    case "gate": return { text: "[GATE :: arbiter]", tone: "gate" };
    default:
      return approvers.includes(a.name ?? "")
        ? { text: "[APPROVER :: human]", tone: "approver" }
        : { text: "[HUMAN]", tone: "human" };
  }
}

export const COMMAND_RE = /@firedrill-gate\s+(SUBMIT|ATTACK|APPROVE|STATUS)\b/gi;

export function parseJsonl(text: string): Frame[] {
  const out: Frame[] = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      const o = JSON.parse(t);
      if (o && typeof o.kind === "string") out.push(o as Frame);
    } catch { /* skip a torn line */ }
  }
  return out;
}
