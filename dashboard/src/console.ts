// The console under every case: a transcript of the room log and a prompt that drives the replay.
// Each transcript line is printed from exactly one recorded frame; nothing is invented.

import { short, type Frame, type State } from "./model";
import { PAGES, type Page } from "./pages";
import { testName } from "./views";

export type Ink = "fixer" | "breaker" | "gate" | "human" | "pass" | "fail" | "mute";

export interface Entry {
  /** Replay step this line appears at (1-based: the frame's index + 1). */
  step: number;
  time: string;
  who: string;
  ink: Ink;
  text: string;
  /** A dimmer second part: durations, diff sizes, which side a check ran against. */
  note?: string;
}

const firstLine = (body: string, max = 150): string => {
  const line = body.split("\n").find((l) => l.trim()) ?? "";
  const plain = line.replace(/\*\*|`/g, "").trim();
  return plain.length > max ? `${plain.slice(0, max - 1)}…` : plain;
};

const roleInk = (role: string | undefined): Ink =>
  role === "fixer" ? "fixer" : role === "breaker" ? "breaker" : role === "gate" ? "gate" : "human";

/** `HH:MM:SS` in UTC, as the frame carries it. */
export const clock = (ts: string): string => (/T(\d\d:\d\d:\d\d)/.exec(ts)?.[1] ?? "--:--:--");

export function entryOf(f: Frame, step: number): Entry {
  const d = f.data ?? {};
  const time = clock(f.ts);
  const who = f.actor?.name ?? "someone";
  const ink = roleInk(f.actor?.role);
  switch (f.kind) {
    case "room_message":
      return { step, time, who, ink, text: firstLine(String(d.body ?? "")) };
    case "gate_state":
      return { step, time, who, ink: "gate", text: `docket open · ${d.incident ?? "incident"}` };
    case "submission":
    case "attack": {
      const st = d.diff_stat as { insertions?: number; deletions?: number; files?: number } | null | undefined;
      return {
        step, time, who, ink: f.kind === "attack" ? "breaker" : "fixer",
        text: `${f.kind} ${d.branch ?? ""} @ ${short(String(d.sha ?? ""))}`,
        note: st ? `+${st.insertions ?? 0} −${st.deletions ?? 0} in ${st.files ?? 0} file${st.files === 1 ? "" : "s"}` : undefined,
      };
    }
    case "verdict_started":
      return { step, time, who, ink: "gate", text: `testing ${d.verdict_id ?? "verdict"} in a fresh workspace` };
    case "check": {
      const ok = d.status === "pass";
      return {
        step, time, who, ink: ok ? "pass" : "fail",
        text: `${ok ? "✓" : "✗"} ${testName(String(d.name ?? "check"))}`,
        note: `${d.against === "reference" ? "on the correct fix" : "on the patch"}${d.duration_ms ? ` · ${d.duration_ms}ms` : ""}`,
      };
    }
    case "verdict": {
      const checks = Array.isArray(d.checks) ? (d.checks as { against?: string; status?: string }[]) : [];
      const onFix = checks.filter((c) => c.against !== "reference");
      const passed = onFix.filter((c) => c.status === "pass").length;
      const res = String(d.result ?? "ERROR");
      return {
        step, time, who, ink: res === "GREEN" ? "pass" : "fail",
        text: `verdict ${d.verdict_id ?? ""} ${res}`,
        note: onFix.length ? `${passed}/${onFix.length} checks on the patch passed` : undefined,
      };
    }
    case "signoff":
      return { step, time, who: String(d.by ?? who), ink: "human", text: `sign-off ${d.verdict_id ?? ""}`, note: "identity pinned to the Switch participant id" };
    case "merge":
      return { step, time, who, ink: "pass", text: `merged into main @ ${short(String(d.main_sha ?? ""))}`, note: `${d.verdict_id ?? ""}` };
    case "rejected":
      return { step, time, who, ink: "fail", text: `refused: ${firstLine(String(d.reason ?? ""))}` };
  }
}

export const transcript = (frames: Frame[], upTo: number): Entry[] =>
  frames.slice(0, Math.max(0, upTo)).map((f, i) => entryOf(f, i + 1));

// ── the prompt ────────────────────────────────────────────────────────────────

export type Cmd =
  | { t: "next"; n: number }
  | { t: "back"; n: number }
  | { t: "run" }
  | { t: "reset" }
  | { t: "goto"; page: Page }
  | { t: "case"; id: string }
  | { t: "status" }
  | { t: "help" }
  | { t: "clear" }
  | { t: "home" }
  | { t: "unknown"; word: string };

export const HELP: [string, string][] = [
  ["next [n]", "run the next step (or n steps). Plain Enter does this too"],
  ["back [n]", "undo a step"],
  ["run", "keep going on its own. Any key stops it"],
  ["reset", "start the case again from nothing"],
  ["goto <page>", "open case, room, attack, ruling or sign-off"],
  ["case <name>", "switch to idempotency-race, ratelimit-boundary or pagination-cursor"],
  ["status", "where the drill stands right now"],
  ["clear", "empty the screen (the room log is untouched)"],
  ["home", "back to the case list"],
];

export function parse(input: string): Cmd | null {
  const [raw, ...args] = input.trim().split(/\s+/);
  if (!raw) return null;
  const w = raw.toLowerCase();
  const count = (x: string | undefined) => Math.max(1, Math.min(99, Number.parseInt(x ?? "1", 10) || 1));
  switch (w) {
    case "next": case "n": case "step": return { t: "next", n: count(args[0]) };
    case "back": case "b": case "undo": return { t: "back", n: count(args[0]) };
    case "run": case "go": case "all": return { t: "run" };
    case "reset": case "restart": case "rewind": return { t: "reset" };
    case "goto": case "open": case "page": {
      const key = (args[0] ?? "").toLowerCase().replace(/^sign-?off$/, "signoff");
      const page = PAGES.find((p) => p === key);
      return page ? { t: "goto", page } : { t: "unknown", word: `${w} ${args[0] ?? ""}`.trim() };
    }
    case "case": return args[0] ? { t: "case", id: args[0] } : { t: "unknown", word: w };
    case "status": case "st": return { t: "status" };
    case "help": case "?": case "h": return { t: "help" };
    case "clear": case "cls": return { t: "clear" };
    case "home": case "exit": case "quit": return { t: "home" };
    default: return { t: "unknown", word: w };
  }
}

/** Completion for the prompt: the single command that starts with what has been typed. */
const WORDS = ["next", "back", "run", "reset", "goto", "case", "status", "help", "clear", "home"];
export function complete(input: string): string | null {
  const t = input.trimStart().toLowerCase();
  if (!t || t.includes(" ")) {
    if (/^goto\s+(\S*)$/.test(t)) {
      const stem = t.split(/\s+/)[1] ?? "";
      const hit = PAGES.map((p) => (p === "signoff" ? "sign-off" : p)).filter((p) => p.startsWith(stem) && p !== stem);
      return hit.length === 1 ? `goto ${hit[0]}` : null;
    }
    return null;
  }
  const hit = WORDS.filter((w) => w.startsWith(t) && w !== t);
  return hit.length === 1 ? hit[0] : null;
}

/** What `status` prints, from the state the replay has reached. */
export function statusLines(s: State, step: number, total: number, page: Page): string[] {
  const last = s.verdicts[s.verdicts.length - 1];
  const merged = s.verdicts.find((v) => v.merged);
  return [
    `case        ${s.incident ?? "(docket not open yet)"}`,
    `step        ${step} of ${total}    page: ${page}`,
    `patches     ${s.fixes.length}    attacks: ${s.attacks.length}    verdicts: ${s.verdicts.length}`,
    `latest      ${last ? `${last.id} ${last.result}` : "none yet"}`,
    `main        ${merged ? `merged @ ${short(merged.merged!.main_sha)}` : "untouched"}`,
  ];
}
