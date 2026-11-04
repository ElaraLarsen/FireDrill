import { describe, expect, it } from "vitest";
import { fixtureRuns } from "./fixtures";
import { replay } from "./model";
import { brief, failedAgainstFix, stages, testName } from "./views";

const runs = fixtureRuns();

describe("docket stages are derived from the frames", () => {
  for (const run of runs) {
    it(`${run.id}: every stage completes, the red-team stage is RED`, () => {
      const end = stages(replay(run.frames, run.frames.length));
      expect(end.map((s) => s.label)).toEqual([
        "Docket Open", "Naive Patch", "Red-Team Attack (RED)", "Root-Cause Fix", "Adversarial Test (GREEN)", "Sign-off", "Merged",
      ]);
      expect(end.map((s) => s.state)).toEqual(["done", "done", "failed", "done", "done", "done", "done"]);
    });

    it(`${run.id}: midway, only what has happened is done and the next stage is active`, () => {
      const firstVerdict = run.frames.findIndex((f) => f.kind === "verdict") + 1;
      const mid = stages(replay(run.frames, firstVerdict));
      // Before the attack nobody knows the first patch is naive, so it is just "Patch".
      expect(mid.map((s) => [s.label, s.state])).toEqual([
        ["Docket Open", "done"], ["Patch", "done"], ["Red-Team Attack", "active"], ["Root-Cause Fix", "pending"],
        ["Adversarial Test (GREEN)", "pending"], ["Sign-off", "pending"], ["Merged", "pending"],
      ]);
    });
  }

  it("an empty state has nothing done and nothing active", () => {
    expect(stages(replay([], 0)).every((s) => s.state === "pending")).toBe(true);
  });
});

describe("small view helpers", () => {
  it("names tests by their leaf", () => {
    expect(testName("attacks/test_attack.py::test_two_processes")).toBe("test_two_processes");
    expect(testName("checks/repro_test.py")).toBe("repro_test");
  });

  it("splits the markdown brief", () => {
    expect(brief("# Title\n\nFirst para\nwraps.\n\nSecond.")).toEqual({ title: "Title", overview: "First para wraps.", rest: "Second." });
  });

  it("summarises failed fix checks from the RED verdict", () => {
    const end = replay(runs[0].frames, runs[0].frames.length);
    const red = end.verdicts.find((v) => v.result === "RED");
    const f = failedAgainstFix(red)!;
    expect(f.failed).toBeGreaterThan(0);
    expect(f.failed).toBeLessThan(f.total);
  });
});
