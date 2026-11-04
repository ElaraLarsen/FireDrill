import { describe, expect, it } from "vitest";
import { fixtureRuns } from "./fixtures";
import { replay } from "./model";
import { nextStepOn, pageForState, pageStates, pageTrack } from "./pages";
import { parse, href } from "./router";
import { stages } from "./views";

const frames = fixtureRuns().find((r) => r.id === "idempotency-race")!.frames;

describe("pageTrack", () => {
  const track = pageTrack(frames);

  it("has one page per replay step, starting on the case", () => {
    expect(track).toHaveLength(frames.length + 1);
    expect(track[0]).toBe("case");
  });

  it("keeps the prelude on the case page until the docket opens", () => {
    const opened = frames.findIndex((f) => f.kind === "gate_state") + 1;
    expect(track.slice(0, opened + 1).every((p) => p === "case")).toBe(true);
  });

  it("walks every page in story order and ends on sign-off", () => {
    const visits = track.filter((p, i) => i === 0 || track[i - 1] !== p);
    expect(visits.slice(0, 3)).toEqual(["case", "room", "ruling"]);
    expect(visits).toContain("attack");
    expect(track[track.length - 1]).toBe("signoff");
  });

  it("puts each ruling on the ruling page", () => {
    frames.forEach((f, i) => { if (f.kind === "verdict") expect(track[i + 1]).toBe("ruling"); });
  });

  it("continues to the next time a page comes up", () => {
    const at = nextStepOn(track, "attack", 0)!;
    expect(frames[at - 1].kind === "room_message" || frames[at - 1].kind === "attack").toBe(true);
    expect(track[at]).toBe("attack");
    expect(nextStepOn(track, "case", 5)).toBeUndefined();
  });

  it("moves to sign-off on a person's APPROVE, not on the gate quoting the command", () => {
    track.forEach((p, i) => {
      if (i > 0 && p === "signoff" && track[i - 1] !== "signoff") expect(frames[i - 1].actor.role).not.toBe("gate");
    });
  });
});

describe("page states", () => {
  it("are all pending before anything happens", () => {
    expect(Object.values(pageStates(stages(replay(frames, 0))))).toEqual(["pending", "pending", "pending", "pending", "pending"]);
  });
  it("are all done once the fix is merged", () => {
    expect(pageStates(stages(replay(frames, frames.length)))).toEqual({ case: "done", room: "done", attack: "done", ruling: "done", signoff: "done" });
  });
  it("live mode lands on sign-off when merged", () => {
    expect(pageForState(replay(frames, frames.length))).toBe("signoff");
  });
});

describe("router", () => {
  it("round-trips a case address", () => {
    const r = parse("#/case/idempotency-race/attack?step=17");
    expect(r).toEqual({ name: "case", run: "idempotency-race", page: "attack", step: 17 });
    expect(href(r)).toBe("#/case/idempotency-race/attack?step=17");
  });
  it("accepts step=end and falls back to the landing page", () => {
    expect(parse("#/case/x/ruling?step=end")).toMatchObject({ step: "end" });
    expect(parse("#/nope")).toEqual({ name: "landing" });
    expect(parse("#/case/x/bogus")).toMatchObject({ page: "case", step: null });
  });
  it("opens on the landing page and keeps the case list at #/cases", () => {
    expect(parse("")).toEqual({ name: "landing" });
    expect(parse("#/")).toEqual({ name: "landing" });
    expect(href({ name: "landing" })).toBe("#/");
    expect(parse("#/landing")).toEqual({ name: "landing" });
    expect(parse("#/cases")).toEqual({ name: "home" });
    expect(href({ name: "home" })).toBe("#/cases");
  });
});
