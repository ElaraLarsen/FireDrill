import { describe, expect, it } from "vitest";
import { clock, complete, entryOf, parse, statusLines, transcript } from "./console";
import { parseJsonl, replay, type Frame } from "./model";

const raw = import.meta.glob("../fixtures/*.jsonl", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const frames = (name: string): Frame[] => parseJsonl(raw[`../fixtures/${name}.jsonl`]);

describe("transcript", () => {
  const fs = frames("idempotency-race");

  it("prints exactly one line per frame, in order, tagged with its replay step", () => {
    const t = transcript(fs, fs.length);
    expect(t).toHaveLength(fs.length);
    expect(t.map((e) => e.step)).toEqual(fs.map((_, i) => i + 1));
    expect(transcript(fs, 3)).toHaveLength(3);
    expect(transcript(fs, 0)).toEqual([]);
  });

  it("reads the clock from the frame, not from now", () => {
    expect(clock("2026-11-04T06:47:35.861+00:00")).toBe("06:47:35");
    expect(clock("garbage")).toBe("--:--:--");
  });

  it("shows who spoke, and the gate's ruling with its colour", () => {
    const t = transcript(fs, fs.length);
    expect(t[0].who).toBe("firedrill-fixer");
    expect(t[0].text).toContain("SUBMIT");
    const verdicts = t.filter((e) => e.text.startsWith("verdict "));
    expect(verdicts.length).toBeGreaterThan(0);
    for (const v of verdicts) expect(v.ink).toBe(/GREEN$/.test(v.text) ? "pass" : "fail");
    expect(t.find((e) => e.text.startsWith("merged into main"))?.text).toMatch(/^merged into main @ [0-9a-f]{7}$/);
  });

  it("marks a failing check with a cross and a passing one with a tick", () => {
    const checks = transcript(fs, fs.length).filter((e) => /^[✓✗] /.test(e.text));
    expect(checks.length).toBeGreaterThan(0);
    for (const c of checks) expect(c.ink).toBe(c.text.startsWith("✓") ? "pass" : "fail");
  });

  it("counts only the checks on the patch in a verdict line, never the reference ones", () => {
    const e = entryOf({
      ts: "2026-11-04T06:00:00+00:00", kind: "verdict", room_id: "r", seq: null, actor: { name: "gate", role: "gate" },
      data: { verdict_id: "V-x-001", result: "GREEN", checks: [
        { against: "reference", status: "pass" }, { against: "fix", status: "pass" }, { against: "fix", status: "fail" },
      ] },
    }, 1);
    expect(e.note).toBe("1/2 checks on the patch passed");
  });
});

describe("prompt", () => {
  it("treats an empty line as nothing, so the caller can read it as Enter = next", () => {
    expect(parse("   ")).toBeNull();
  });
  it("parses the verbs and their aliases", () => {
    expect(parse("next")).toEqual({ t: "next", n: 1 });
    expect(parse("N 5")).toEqual({ t: "next", n: 5 });
    expect(parse("back 2")).toEqual({ t: "back", n: 2 });
    expect(parse("run")).toEqual({ t: "run" });
    expect(parse("rewind")).toEqual({ t: "reset" });
    expect(parse("goto sign-off")).toEqual({ t: "goto", page: "signoff" });
    expect(parse("goto attack")).toEqual({ t: "goto", page: "attack" });
    expect(parse("case pagination-cursor")).toEqual({ t: "case", id: "pagination-cursor" });
    expect(parse("help")).toEqual({ t: "help" });
  });
  it("caps a runaway count and rejects what it does not know", () => {
    expect(parse("next 5000")).toEqual({ t: "next", n: 99 });
    expect(parse("next 0")).toEqual({ t: "next", n: 1 });
    expect(parse("goto nowhere")).toEqual({ t: "unknown", word: "goto nowhere" });
    expect(parse("sudo merge")).toEqual({ t: "unknown", word: "sudo" });
    expect(parse("case")).toEqual({ t: "unknown", word: "case" });
  });
  it("completes only when exactly one command fits", () => {
    expect(complete("ru")).toBe("run");
    expect(complete("st")).toBe("status");
    expect(complete("re")).toBe("reset");
    expect(complete("n")).toBe("next");
    expect(complete("he")).toBe("help");
    expect(complete("h")).toBeNull();
    expect(complete("c")).toBeNull();
    expect(complete("goto sig")).toBe("goto sign-off");
    expect(complete("")).toBeNull();
  });
});

describe("status", () => {
  it("is printed from the state the replay has reached", () => {
    const fs = frames("idempotency-race");
    const none = statusLines(replay(fs, 0), 0, fs.length, "case");
    expect(none.join("\n")).toContain("main        untouched");
    const end = statusLines(replay(fs, fs.length), fs.length, fs.length, "signoff");
    expect(end.join("\n")).toMatch(/main\s+merged @ [0-9a-f]{7}/);
    expect(end[1]).toContain(`${fs.length} of ${fs.length}`);
  });
});
