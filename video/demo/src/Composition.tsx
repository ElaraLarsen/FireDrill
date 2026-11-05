import { AbsoluteFill, Easing, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { liveTrace } from "./liveTrace";

// FireDrill's palette, the same one the dashboard uses.
const C = {
  forest: "#0f2a1d", p1: "#143322", p2: "#1b3f2b", cream: "#f3eedf", lime: "#c6f432", sky: "#8fcbf2",
  lilac: "#c4b3f6", rose: "#ff8fb1", mint: "#5ce6a6", flare: "#ff8a8a", on2: "#cdd8c4", on3: "#9bb092",
};
const SERIF = "'Instrument Serif', Georgia, serif";
const SANS = "Bricolage, 'Helvetica Neue', sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const ease = Easing.bezier(0.16, 1, 0.3, 1);

export const FPS = 30;
export const DURATION = 60 * FPS;

const Fonts = () => (
  <style>{`
    @font-face { font-family: 'Instrument Serif'; font-style: normal; src: url(${staticFile("fonts/instrument-serif-latin-400.woff2")}) format('woff2'); }
    @font-face { font-family: 'Instrument Serif'; font-style: italic; src: url(${staticFile("fonts/instrument-serif-latin-400-italic.woff2")}) format('woff2'); }
    @font-face { font-family: Bricolage; font-weight: 200 800; src: url(${staticFile("fonts/bricolage-grotesque-latin-standard.woff2")}) format('woff2-variations'); }
    @font-face { font-family: 'JetBrains Mono'; src: url(${staticFile("fonts/jetbrains-mono-latin.woff2")}) format('woff2'); }
  `}</style>
);

/** Rise and fade in at `at` (frames, relative to the scene), over `len` frames. */
const useIn = (at: number, len = 22) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + len], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  return { opacity: p, transform: `translateY(${(1 - p) * 34}px)` };
};

/** Fade a whole scene out over its last frames so cuts are soft. */
const SceneFade: React.FC<{ len: number; children: React.ReactNode }> = ({ len, children }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [len - 10, len], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
};

const Grain: React.FC<{ dark?: boolean }> = ({ dark }) => (
  <AbsoluteFill
    style={{
      opacity: dark ? 0.06 : 0.07,
      mixBlendMode: dark ? "screen" : "multiply",
      backgroundImage:
        "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .9 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
    }}
  />
);

const Flame: React.FC<{ size: number; fg: string; bg: string }> = ({ size, fg, bg }) => (
  <div style={{ width: size, height: size, borderRadius: "50%", background: bg, display: "grid", placeItems: "center" }}>
    <svg width={size * 0.54} height={size * 0.54} viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3c1 3.5 5.5 5.5 5.5 10.2A5.5 5.5 0 0 1 12 19a5.5 5.5 0 0 1-5.5-5.8C6.5 10.5 8.5 9 9 6.5c1.2.9 2 2 2.2 3.3C11.9 7.8 12 5.5 12 3z" />
      <path d="M8 21.5h8" />
    </svg>
  </div>
);

const Eyebrow: React.FC<{ children: React.ReactNode; color: string; style?: React.CSSProperties }> = ({ children, color, style }) => (
  <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 26, letterSpacing: "0.18em", textTransform: "uppercase", color, ...style }}>{children}</div>
);

// ── 1. the hook ──────────────────────────────────────────────────────────────
const Hook: React.FC = () => {
  const a = useIn(6, 26);
  const b = useIn(48, 26);
  const c = useIn(92, 26);
  return (
    <SceneFade len={150}>
      <AbsoluteFill style={{ background: C.forest, justifyContent: "center", padding: "0 150px" }}>
        <Grain dark />
        <div style={{ fontFamily: SERIF, fontSize: 150, lineHeight: 1, color: C.cream, letterSpacing: "-0.02em" }}>
          <div style={a}>A bug is in production.</div>
          <div style={{ ...b, color: C.on2 }}>An AI wrote the fix.</div>
          <div style={{ ...c, fontStyle: "italic", color: C.lime }}>Should it merge?</div>
        </div>
      </AbsoluteFill>
    </SceneFade>
  );
};

// ── 2. the problem ───────────────────────────────────────────────────────────
const Problem: React.FC = () => {
  const f = useCurrentFrame();
  const a = useIn(4, 26);
  const chip = useIn(70, 18);
  const b = useIn(112, 26);
  const bounce = spring({ frame: f - 74, fps: FPS, config: { damping: 11, stiffness: 160 } });
  return (
    <SceneFade len={180}>
      <AbsoluteFill style={{ background: C.cream, padding: "0 150px", justifyContent: "center" }}>
        <Grain />
        <div style={{ ...a, fontFamily: SERIF, fontSize: 118, lineHeight: 1.04, color: C.forest, maxWidth: 1500, letterSpacing: "-0.02em" }}>
          The tests the author writes only prove what the author <i>thought of.</i>
        </div>
        <div style={{ ...chip, marginTop: 56, display: "flex", alignItems: "center", gap: 22 }}>
          <div style={{ transform: `scale(${0.6 + 0.4 * bounce})`, background: C.mint, color: C.forest, fontFamily: MONO, fontSize: 40, padding: "14px 30px", borderRadius: 18 }}>✓ repro_test passed</div>
        </div>
        <div style={{ ...b, marginTop: 40, fontFamily: SANS, fontWeight: 600, fontSize: 56, color: C.forest }}>
          Green is not the same as safe.
        </div>
      </AbsoluteFill>
    </SceneFade>
  );
};

// ── 3. the name ──────────────────────────────────────────────────────────────
const Name: React.FC = () => {
  const f = useCurrentFrame();
  const pop = spring({ frame: f - 4, fps: FPS, config: { damping: 12, stiffness: 120 } });
  const sub = useIn(34, 24);
  const sub2 = useIn(58, 24);
  return (
    <SceneFade len={150}>
      <AbsoluteFill style={{ background: C.forest, alignItems: "center", justifyContent: "center" }}>
        <Grain dark />
        <div style={{ transform: `scale(${0.7 + 0.3 * pop})`, opacity: Math.min(1, pop * 1.4), display: "flex", alignItems: "center", gap: 44 }}>
          <Flame size={190} fg={C.forest} bg={C.lime} />
          <div style={{ fontFamily: SERIF, fontSize: 240, color: C.cream, letterSpacing: "-0.03em", lineHeight: 1 }}>
            Fire<i>Drill</i>
          </div>
        </div>
        <div style={{ ...sub, marginTop: 40, fontFamily: SANS, fontWeight: 600, fontSize: 54, color: C.on2 }}>An adversarial hotfix courtroom.</div>
        <div style={{ ...sub2, marginTop: 14, fontFamily: SANS, fontSize: 38, color: C.on3 }}>Inside a Switch chat room. Built for Flip the Switch.</div>
      </AbsoluteFill>
    </SceneFade>
  );
};

// ── 4. the cast ──────────────────────────────────────────────────────────────
const CAST = [
  { name: "Fixer", who: "a Claude agent", does: "Writes the patch.", hex: C.lime },
  { name: "Breaker", who: "a Codex agent", does: "Writes hostile tests to break it.", hex: C.rose },
  { name: "Gate", who: "the referee", does: "Runs every test for real. Holds the only key to main.", hex: C.sky },
  { name: "Human", who: "a named approver", does: "Signs off, but only after the patch survives an attack.", hex: C.lilac },
];
const Cast: React.FC = () => {
  const head = useIn(2, 22);
  return (
    <SceneFade len={300}>
      <AbsoluteFill style={{ background: C.cream, padding: "110px 110px" }}>
        <Grain />
        <div style={head}>
          <Eyebrow color={C.forest}>Four roles, one room</Eyebrow>
          <div style={{ fontFamily: SERIF, fontSize: 104, color: C.forest, marginTop: 8, letterSpacing: "-0.02em" }}>
            Who is in <i>the room</i>
          </div>
        </div>
        <div style={{ display: "flex", gap: 26, marginTop: 56 }}>
          {CAST.map((c, i) => (
            <CastCard key={c.name} {...c} delay={30 + i * 34} />
          ))}
        </div>
      </AbsoluteFill>
    </SceneFade>
  );
};
const CastCard: React.FC<(typeof CAST)[number] & { delay: number }> = ({ name, who, does, hex, delay }) => {
  const s = useIn(delay, 26);
  return (
    <div style={{ ...s, flex: 1, background: C.forest, borderRadius: 34, padding: "40px 34px", minHeight: 470 }}>
      <div style={{ width: 96, height: 96, borderRadius: "50%", background: hex }} />
      <div style={{ fontFamily: SERIF, fontSize: 80, color: C.cream, marginTop: 30 }}>{name}</div>
      <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 24, letterSpacing: "0.14em", textTransform: "uppercase", color: hex, marginTop: 4 }}>{who}</div>
      <div style={{ fontFamily: SANS, fontSize: 34, lineHeight: 1.3, color: C.on2, marginTop: 22 }}>{does}</div>
    </div>
  );
};

// ── 5. a real run ────────────────────────────────────────────────────────────
const INK: Record<string, string> = { human: C.lilac, pass: C.mint, fail: C.flare };
const BEATS = [
  { from: 0, text: "1 · A naive patch", sub: "The repro passes. GREEN, but nobody has attacked it." },
  { from: 4, text: "2 · The breaker attacks", sub: "A hostile test finds the race. RED." },
  { from: 9, text: "3 · A real fix", sub: "It survives the attack. GREEN." },
  { from: 14, text: "4 · A named human signs", sub: "The gate checks who, then merges with its key." },
];
// When each trace line appears, in frames from the start of this scene.
const timeFor = (i: number) => 70 + i * 31 + (i >= 9 ? 12 : 0);

const Trace: React.FC = () => {
  const f = useCurrentFrame();
  const head = useIn(0, 20);
  const shown = liveTrace.filter((_, i) => f >= timeFor(i)).length;
  const beat = [...BEATS].reverse().find((b) => shown > b.from) ?? BEATS[0];
  const lineH = 44;
  return (
    <SceneFade len={660}>
      <AbsoluteFill style={{ background: "#0b2116" }}>
        <Grain dark />
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(60% 70% at 8% 0%, ${C.lime}33, transparent 62%), radial-gradient(55% 70% at 100% 12%, ${C.sky}3a, transparent 64%), radial-gradient(60% 80% at 80% 110%, ${C.lilac}38, transparent 64%), radial-gradient(40% 60% at 0% 100%, ${C.rose}30, transparent 66%)` }} />
        <div style={{ ...head, position: "absolute", left: 110, top: 70 }}>
          <Eyebrow color={C.lime}>A real run · Switch 0.31.0</Eyebrow>
          <div style={{ fontFamily: SERIF, fontSize: 84, color: C.cream, marginTop: 6, letterSpacing: "-0.02em" }}>Idempotency race</div>
        </div>

        {/* the beat caption */}
        <div key={beat.text} style={{ position: "absolute", left: 110, top: 258, width: 560 }}>
          <BeatCaption text={beat.text} sub={beat.sub} />
        </div>

        {/* a leaf-shaped glass console with a tab */}
        <div style={{ position: "absolute", left: 740, top: 110, width: 1070, height: 860 }}>
          <div style={{ position: "absolute", left: 40, top: 0, height: 56, padding: "0 28px 0 24px", display: "flex", alignItems: "center", gap: 18, zIndex: 2, borderRadius: "26px 26px 6px 26px", background: "#12301fee", border: `1.5px solid ${C.sky}88` }}>
            <div style={{ display: "flex", gap: 5, alignItems: "flex-end" }}>
              {[11, 17, 24].map((h, i) => <div key={i} style={{ width: 9, height: h, borderRadius: 3, background: i === 1 ? `linear-gradient(${C.sky},${C.lime})` : "#ffffff44" }} />)}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 24, color: C.on2 }}>firedrill <span style={{ color: C.on3 }}>~/</span>idempotency-race</div>
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, top: 36, bottom: 0, borderRadius: "16px 64px 16px 64px", background: "linear-gradient(145deg, #ffffff22, #ffffff08 55%, #ffffff16), #0a1f15f2", border: "1.5px solid #ffffff30", boxShadow: "0 40px 90px -30px #000a", overflow: "hidden" }}>
            <div style={{ position: "absolute", right: 70, top: 22, fontFamily: MONO, fontSize: 21, color: C.on3 }}>scripted cast · real verifier</div>
            <div style={{ position: "absolute", left: 40, right: 40, top: 86, bottom: 28, display: "flex", flexDirection: "column", justifyContent: "flex-end", overflow: "hidden" }}>
              {liveTrace.map((l, i) => {
                const at = timeFor(i);
                if (f < at) return null;
                const p = interpolate(f, [at, at + 12], [0, 1], { extrapolateRight: "clamp", easing: ease });
                const strong = l.step === "verdict" || l.step === "merge" || l.step === "signoff";
                return (
                  <div key={i} style={{ height: lineH, display: "flex", gap: 26, alignItems: "center", fontFamily: MONO, fontSize: 24, opacity: p, transform: `translateY(${(1 - p) * 10}px)`, background: strong ? "#ffffff10" : "transparent", borderRadius: 10, padding: "0 12px", marginBottom: 2 }}>
                    <span style={{ color: C.on3, width: 130, flexShrink: 0 }}>{l.time}</span>
                    <span style={{ color: l.who === "firedrill-gate" ? C.sky : C.lilac, width: 250, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.who}</span>
                    <span style={{ color: l.ink === "human" ? C.cream : INK[l.ink], fontWeight: strong ? 700 : 400, whiteSpace: "nowrap", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{l.text.replace(/attacks\/test_attack::/, "")}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </SceneFade>
  );
};
const BeatCaption: React.FC<{ text: string; sub: string }> = ({ text, sub }) => {
  const s = useIn(0, 16);
  return (
    <div style={s}>
      <div style={{ fontFamily: SERIF, fontSize: 68, lineHeight: 1.02, color: C.cream, letterSpacing: "-0.015em" }}>{text}</div>
      <div style={{ fontFamily: SANS, fontSize: 36, lineHeight: 1.3, color: C.on2, marginTop: 18 }}>{sub}</div>
    </div>
  );
};

// ── 6. the rule ──────────────────────────────────────────────────────────────
const Rule: React.FC = () => {
  const f = useCurrentFrame();
  const a = spring({ frame: f - 4, fps: FPS, config: { damping: 14, stiffness: 110 } });
  const b = useIn(40, 24);
  return (
    <SceneFade len={150}>
      <AbsoluteFill style={{ background: C.rose, alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <Grain />
        <div style={{ transform: `scale(${0.8 + 0.2 * a})`, opacity: Math.min(1, a * 1.5), fontFamily: SERIF, fontSize: 230, lineHeight: 0.95, color: C.forest, letterSpacing: "-0.03em" }}>
          No attack,<br /><i>no sign-off.</i>
        </div>
        <div style={{ ...b, marginTop: 40, fontFamily: SANS, fontWeight: 600, fontSize: 44, color: C.forest }}>The gate enforces it. A person typing APPROVE is not enough.</div>
      </AbsoluteFill>
    </SceneFade>
  );
};

// ── 7. proof and close ───────────────────────────────────────────────────────
const STATS = [
  { n: "3", l: "incidents merged on a live Switch 0.31.0", hex: C.lime },
  { n: "73", l: "backend tests, real pytest verdicts", hex: C.sky },
  { n: "93", l: "browser checks, desktop and phone", hex: C.lilac },
];
const Close: React.FC = () => {
  const head = useIn(2, 22);
  const foot = useIn(110, 24);
  return (
    <AbsoluteFill style={{ background: C.forest }}>
      <Grain dark />
      <div style={{ padding: "100px 110px" }}>
        <div style={head}>
          <Eyebrow color={C.lime}>What is real</Eyebrow>
          <div style={{ fontFamily: SERIF, fontSize: 96, color: C.cream, marginTop: 6, letterSpacing: "-0.02em" }}>The gate, the tests, the merge. <i style={{ color: C.on2 }}>The cast is scripted.</i></div>
        </div>
        <div style={{ display: "flex", gap: 28, marginTop: 56 }}>
          {STATS.map((s, i) => <Stat key={s.n} {...s} delay={26 + i * 22} />)}
        </div>
        <div style={{ ...foot, marginTop: 60, display: "flex", alignItems: "center", gap: 28 }}>
          <Flame size={96} fg={C.forest} bg={C.lime} />
          <div>
            <div style={{ fontFamily: SERIF, fontSize: 84, color: C.cream, lineHeight: 1 }}>Fire<i>Drill</i></div>
            <div style={{ fontFamily: MONO, fontSize: 30, color: C.on2, marginTop: 6 }}>github.com/ElaraLarsen/FireDrill · Flip the Switch</div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
const Stat: React.FC<{ n: string; l: string; hex: string; delay: number }> = ({ n, l, hex, delay }) => {
  const s = useIn(delay, 24);
  return (
    <div style={{ ...s, flex: 1, background: C.p1, borderRadius: 30, padding: "34px 36px" }}>
      <div style={{ fontFamily: SERIF, fontSize: 170, lineHeight: 1, color: hex }}>{n}</div>
      <div style={{ fontFamily: SANS, fontSize: 32, lineHeight: 1.3, color: C.on2, marginTop: 8 }}>{l}</div>
    </div>
  );
};

export const FireDrillDemo: React.FC = () => {
  const { fps } = useVideoConfig();
  const sec = (s: number) => Math.round(s * fps);
  return (
    <AbsoluteFill>
      <Fonts />
      <Sequence from={0} durationInFrames={sec(5)}><Hook /></Sequence>
      <Sequence from={sec(5)} durationInFrames={sec(6)}><Problem /></Sequence>
      <Sequence from={sec(11)} durationInFrames={sec(5)}><Name /></Sequence>
      <Sequence from={sec(16)} durationInFrames={sec(10)}><Cast /></Sequence>
      <Sequence from={sec(26)} durationInFrames={sec(22)}><Trace /></Sequence>
      <Sequence from={sec(48)} durationInFrames={sec(5)}><Rule /></Sequence>
      <Sequence from={sec(53)} durationInFrames={sec(7)}><Close /></Sequence>
    </AbsoluteFill>
  );
};
