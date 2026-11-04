import type { Frame } from "./model";

export interface Milestone {
  step: number;
  label: string;
  detail: string;
  tone: "neutral" | "warn" | "red" | "green";
}

/** Navigation indexes point at the actual recorded frame, never an inferred verdict. */
export function milestones(frames: Frame[]): Milestone[] {
  return frames.flatMap((frame, index): Milestone[] => {
    const d = frame.data;
    const step = index + 1;
    if (frame.kind === "gate_state" && d.state === "docket_open")
      return [{ step, label: "Docket open", detail: "Case filed", tone: "neutral" }];
    if (frame.kind === "verdict") {
      const attacked = Boolean(d.attack) || (d.checks ?? []).some((c: { kind: string }) => c.kind === "attack");
      const id = String(d.verdict_id).replace(/^V-.*-(\d+)$/, "V-$1");
      return [{ step, label: d.result === "RED" ? (attacked ? "Red-team break" : "Repro failed")
        : d.result === "GREEN" ? (attacked ? "Fix survived" : "Repro only") : "Gate error",
      detail: `${id} · ${d.result}`, tone: d.result === "RED" ? "red" : d.result === "GREEN" && attacked ? "green" : "warn" }];
    }
    if (frame.kind === "rejected") {
      const message = frames.slice(0, index).reverse().find((f) => f.kind === "room_message" && f.actor.name === frame.actor.name);
      const approval = /@firedrill-gate\s+APPROVE\b/i.test(String(message?.data.body ?? ""));
      return [{ step, label: approval ? "Approval refused" : "Command refused", detail: `${frame.actor.name ?? "Unknown"} · ${d.reason}`, tone: "red" }];
    }
    if (frame.kind === "signoff")
      return [{ step, label: "Human sign-off", detail: `@${d.by}`, tone: "green" }];
    if (frame.kind === "merge")
      return [{ step, label: "Merged to main", detail: String(d.main_sha).slice(0, 7), tone: "green" }];
    return [];
  });
}
