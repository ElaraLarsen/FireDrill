// The drill told as five pages, one per process. Which page a frame belongs to is derived from the
// frame itself, so auto-play walks from page to page exactly when the recording moves on.

import { COMMAND_RE, latest, signOff, type Frame, type State } from "./model";
import type { Stage } from "./views";

export const PAGES = ["case", "room", "attack", "ruling", "signoff"] as const;
export type Page = (typeof PAGES)[number];

export const PAGE_META: Record<Page, { label: string; short: string; plain: string }> = {
  case: { label: "The case", short: "Case", plain: "What broke, and who is in the room" },
  room: { label: "The room", short: "Room", plain: "The fixer sends a patch" },
  attack: { label: "The attack", short: "Attack", plain: "The red team tries to break it" },
  ruling: { label: "The ruling", short: "Ruling", plain: "The gate runs real tests" },
  signoff: { label: "Sign-off", short: "Sign-off", plain: "A named human signs, the gate merges" },
};

export const isPage = (x: string | undefined): x is Page => PAGES.includes(x as Page);

const verbOf = (body: string): string | null => {
  const m = [...body.matchAll(COMMAND_RE)][0];
  return m ? m[1].toUpperCase() : null;
};

/** The page a single frame moves the story to, or null when it stays where it is. */
export function pageOfFrame(f: Frame): Page | null {
  switch (f.kind) {
    case "gate_state": return "case";
    case "submission": return "room";
    case "attack": return "attack";
    case "verdict_started": case "check": case "verdict": return "ruling";
    case "signoff": case "merge": case "rejected": return "signoff";
    case "room_message": {
      // The gate quotes commands back ("type APPROVE V-…"); only the cast's own commands move the story.
      if (f.actor?.role === "gate") return null;
      const verb = verbOf(String(f.data?.body ?? ""));
      if (verb === "SUBMIT") return "room";
      if (verb === "ATTACK") return "attack";
      if (verb === "APPROVE") return "signoff";
      return null;
    }
  }
}

/**
 * For each replay step (0..frames.length), the page that step belongs to. Frames before the docket
 * opens are the case's prelude; frames that don't move the story keep the page they arrive on.
 */
export function pageTrack(frames: Frame[]): Page[] {
  const opened = frames.findIndex((f) => f.kind === "gate_state");
  const out: Page[] = ["case"];
  let cur: Page = "case";
  frames.forEach((f, i) => {
    if (i >= opened) cur = pageOfFrame(f) ?? cur;
    out.push(cur);
  });
  return out;
}

/** The first step after `from` whose page is `page` (to "continue" the story there), if any. */
export function nextStepOn(track: Page[], page: Page, from: number): number | undefined {
  for (let i = from + 1; i < track.length; i++) if (track[i] === page && track[i - 1] !== page) return i;
  return undefined;
}

/** Following a live gate there is no frame cursor: pick the page from what the state shows. */
export function pageForState(s: State): Page {
  const v = latest(s.verdicts);
  const so = signOff(s);
  if (so.phase === "signed" || so.phase === "merged" || so.phase === "awaiting") return "signoff";
  if (v && v.result === "PENDING") return "ruling";
  if (v) return "ruling";
  if (s.attacks.length) return "attack";
  if (s.fixes.length) return "room";
  return "case";
}

export type PageState = "done" | "failed" | "active" | "pending";

/** How far each page's process has got, from the seven docket stages. */
export function pageStates(stages: Stage[]): Record<Page, PageState> {
  const by = Object.fromEntries(stages.map((s) => [s.key, s.state])) as Record<string, Stage["state"]>;
  const pick = (...keys: string[]): PageState => {
    const xs = keys.map((k) => by[k]).filter(Boolean);
    if (xs.includes("failed")) return "failed";
    if (xs.includes("active")) return "active";
    if (xs.length && xs.every((x) => x === "done" || x === "skipped")) return "done";
    if (xs.some((x) => x === "done")) return "active";
    return "pending";
  };
  return {
    case: pick("docket"),
    room: by.fix === "done" || (by.patch === "done" && by.fix === "skipped") ? "done" : pick("patch"),
    attack: by.attack === "failed" ? (by.green === "done" ? "done" : "failed") : pick("attack"),
    ruling: pick("green"),
    signoff: pick("signoff", "merged"),
  };
}
