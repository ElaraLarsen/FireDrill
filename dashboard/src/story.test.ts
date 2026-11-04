import { describe, expect, it } from "vitest";
import { fixtureRuns } from "./fixtures";
import { narrate, stageSteps } from "./story";

describe("plain-language narration", () => {
  for (const run of fixtureRuns()) {
    it(`${run.id}: every frame gets a sentence, and the gate's rulings read as rulings`, () => {
      const lines = run.frames.map((f) => narrate(f, ["creator"]));
      expect(lines.every((l) => l.title.length > 0)).toBe(true);
      const rulings = lines.filter((l) => l.title.startsWith("The gate's ruling on"));
      expect(rulings.map((l) => l.title.split(": ")[1])).toEqual(["GREEN", "RED", "GREEN"]);
      expect(lines.some((l) => l.title === "Merged into main")).toBe(true);
      expect(lines.some((l) => l.title === "guest tried to approve")).toBe(true);
    });

    it(`${run.id}: jump points for every stage, in order`, () => {
      const s = stageSteps(run.frames);
      const order = ["docket", "patch", "attack", "fix", "green", "signoff", "merged"].map((k) => s[k]);
      expect(order.every((n) => typeof n === "number")).toBe(true);
      expect([...order].sort((a, b) => a - b)).toEqual(order);
    });
  }
});
