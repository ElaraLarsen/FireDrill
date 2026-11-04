import { describe, expect, it } from "vitest";
import { attackMatrix, latest, replay, signOff, stamp } from "./model";
import { fixtureRuns } from "./fixtures";

describe("replaying the recorded idempotency-race drill", () => {
  const run = fixtureRuns().find((r) => r.id === "idempotency-race")!;

  it("loads the committed fixture", () => {
    expect(run).toBeTruthy();
    expect(run.frames.length).toBeGreaterThan(20);
    expect(run.scripted).toBe(true);
  });

  it("walks naive GREEN -> attack RED -> fixed GREEN -> merged", () => {
    const results: string[] = [];
    let prev = "";
    for (let i = 1; i <= run.frames.length; i++) {
      const s = replay(run.frames, i);
      const v = latest(s.verdicts);
      const key = v ? `${v.id}:${v.result}` : "";
      if (key && key !== prev && v!.result !== "PENDING") { results.push(v!.result); prev = key; }
    }
    expect(results).toEqual(["GREEN", "RED", "GREEN"]);

    const end = replay(run.frames, run.frames.length);
    expect(stamp(end).label).toBe("MERGED TO MAIN");
    expect(signOff(end).phase).toBe("merged");
    expect(end.incident).toBe("idempotency-race");
    expect(end.rejections.length).toBeGreaterThan(0);
  });

  it("keeps a naive GREEN unsignable until an attack has faced it", () => {
    const firstGreen = run.frames.findIndex((f) => f.kind === "verdict") + 1;
    const s = replay(run.frames, firstGreen);
    expect(stamp(s).tone).toBe("pending");
    expect(signOff(s).phase).toBe("no_attack");
  });

  it("builds an attack matrix from the RED verdict", () => {
    const red = replay(run.frames, run.frames.length).verdicts.find((v) => v.result === "RED")!;
    const rows = attackMatrix(red);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].fix).toBe("fail");
  });
});
