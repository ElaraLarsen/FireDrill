import { describe, expect, it } from "vitest";
import { attackMatrix, latest, replay, signOff, stamp } from "./model";
import { fixtureRuns } from "./fixtures";

describe("replaying the idempotency-race drill", () => {
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

describe("full courtroom recordings (real gate.verify, scripted participants)", () => {
  const ids = ["idempotency-race", "ratelimit-boundary", "pagination-cursor"];
  const runs = fixtureRuns();

  it("ships one recording per incident, all from the real verifier", () => {
    expect(runs.map((r) => r.id).sort()).toEqual([...ids].sort());
    for (const r of runs) {
      expect(r.verifier).toBe("gate.verify");
      expect(r.scripted).toBe(true);
      expect(r.provenance).toMatch(/stand-in/);
    }
  });

  for (const id of ids) {
    it(`${id}: GREEN on repro only -> refused -> RED by attack -> GREEN -> refused -> signed off -> MERGED`, () => {
      const run = runs.find((r) => r.id === id)!;
      const labels: string[] = [];
      for (let i = 1; i <= run.frames.length; i++) {
        const k = run.frames[i - 1].kind;
        if (k === "verdict" || k === "merge") labels.push(stamp(replay(run.frames, i)).label);
      }
      expect(labels).toEqual([
        "GREEN ON REPRO ONLY — NO ATTACK YET",
        "RED — BROKEN BY RED-TEAM",
        "GREEN — SURVIVED ALL ATTACKS",
        "MERGED TO MAIN",
      ]);

      const end = replay(run.frames, run.frames.length);
      expect(end.incident).toBe(id);
      expect(end.brief.length).toBeGreaterThan(10);
      expect(end.approvers).toEqual(["creator"]);
      expect(end.fixes).toHaveLength(2);
      expect(end.attacks).toHaveLength(1);
      expect(end.rejections.map((r) => r.reason)).toEqual([
        expect.stringMatching(/no attack, no sign-off/),
        expect.stringMatching(/not an approver/),
      ]);
      expect(end.messages.length).toBeGreaterThan(8);
      expect(signOff(end).phase).toBe("merged");
      expect(latest(end.verdicts)!.signoff?.by).toBe("creator");
    });

    it(`${id}: the naive fix cannot be signed off until an attack has faced it`, () => {
      const run = runs.find((r) => r.id === id)!;
      const s = replay(run.frames, run.frames.findIndex((f) => f.kind === "verdict") + 1);
      expect(stamp(s).tone).toBe("pending");
      expect(signOff(s).phase).toBe("no_attack");
    });

    it(`${id}: the attack matrix shows the R3 discard and the surviving valid attacks`, () => {
      const run = runs.find((r) => r.id === id)!;
      const end = replay(run.frames, run.frames.length);
      const red = end.verdicts.find((v) => v.result === "RED")!;
      const redRows = attackMatrix(red);
      expect(redRows.some((r) => r.discarded)).toBe(true);
      expect(redRows.some((r) => r.reference === "pass" && r.fix === "fail")).toBe(true);
      const green = latest(end.verdicts)!;
      const greenRows = attackMatrix(green);
      expect(greenRows.some((r) => r.discarded)).toBe(true);
      expect(greenRows.filter((r) => !r.discarded).every((r) => r.reference === "pass" && r.fix === "pass")).toBe(true);
    });
  }

  it("no recording mentions a host path", () => {
    for (const r of runs) {
      const text = JSON.stringify(r.frames);
      expect(text).not.toMatch(/\/Users\/|\/home\/|\/private\/|\/var\/folders|\/tmp\/|C:\\\\|AppData|\.venv/);
    }
  });
});
