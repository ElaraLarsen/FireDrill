import { describe, expect, it } from "vitest";
import { fixtureRuns } from "./fixtures";
import { milestones } from "./milestones";
import { latest, replay } from "./model";

describe("recorded docket navigation", () => {
  for (const run of fixtureRuns()) it(`seeks to real verdicts and security events in ${run.id}`, () => {
    const beats = milestones(run.frames);
    expect(beats.filter((b) => b.label === "Approval refused")).toHaveLength(2);
    expect(beats.some((b) => b.label === "Repro only")).toBe(true);
    expect(beats.some((b) => b.label === "Red-team break")).toBe(true);
    for (const beat of beats) {
      const state = replay(run.frames, beat.step);
      const frame = run.frames[beat.step - 1];
      if (frame.kind === "verdict") expect(latest(state.verdicts)?.result).toBe(frame.data.result);
      if (frame.kind === "rejected") expect(latest(state.rejections)?.reason).toBe(frame.data.reason);
      if (frame.kind === "signoff") expect(latest(state.verdicts)?.signoff?.participant).toBe(frame.data.participant);
      if (frame.kind === "merge") expect(latest(state.verdicts)?.merged?.main_sha).toBe(frame.data.main_sha);
    }
    expect(beats.map((b) => b.step)).toEqual([...beats.map((b) => b.step)].sort((a, b) => a - b));
  });
});
