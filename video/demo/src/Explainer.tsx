import { AbsoluteFill, Audio, Easing, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame } from "remotion";
import script from "../script.json";
import durations from "./durations.json";
import { C, Eyebrow, FPS, Flame, Fonts, Grain, MONO, SANS, SERIF, SceneFade, ease, useIn } from "./Trailer";

// A ~3 minute explainer: narration (Kokoro-82M, local), motion graphics, and real footage of the app and of the
// live Switch room. Every scene's length comes from its narration clip, so picture and voice stay together.

type Id = keyof typeof durations;
const ORDER = script.map((s) => s.id as Id);
const TEXT = Object.fromEntries(script.map((s) => [s.id, s.text])) as Record<Id, string>;
const LEAD = Math.round(0.5 * FPS);
const TAIL = Math.round(0.35 * FPS);
// Scenes that show footage at a fixed speed can need more time than their narration.
const MIN_SECONDS: Partial<Record<Id, number>> = { s08: 55.4 / 2 + 0.3 };

const lenOf = (id: Id) => Math.ceil(Math.max(durations[id], MIN_SECONDS[id] ?? 0) * FPS) + TAIL;
const startOf = (id: Id) => LEAD + ORDER.slice(0, ORDER.indexOf(id)).reduce((a, k) => a + lenOf(k), 0);
export const EXPLAINER_DURATION = LEAD + ORDER.reduce((a, k) => a + lenOf(k), 0) + FPS;

const splitLong = (t: string): string[] => {
  if (t.length <= 96) return [t];
  const commas = [...t.matchAll(/,\s+/g)].map((m) => m.index! + 1);
  if (!commas.length) return [t];
  const mid = t.length / 2;
  const cut = commas.reduce((a, b) => (Math.abs(b - mid) < Math.abs(a - mid) ? b : a));
  return [...splitLong(t.slice(0, cut).trim()), ...splitLong(t.slice(cut).trim())];
};

// ── captions: burned in, so the video also works on mute and for viewers who need them ──────────
const Caption: React.FC<{ id: Id }> = ({ id }) => {
  const f = useCurrentFrame();
  const parts = TEXT[id].split(/(?<=[.?!])\s+/).flatMap(splitLong);
  const total = parts.reduce((a, p) => a + p.length, 0);
  const speech = (durations[id] - 0.35) * FPS;
  let acc = 0;
  let current = parts[parts.length - 1];
  for (const p of parts) {
    const end = acc + (p.length / total) * speech;
    if (f < end) { current = p; break; }
    acc = end;
  }
  const inP = interpolate(f - acc, [0, 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 140, right: 140, bottom: 34, display: "flex", justifyContent: "center", opacity: inP }}>
      <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 36, lineHeight: 1.26, color: C.cream, background: "#07180fdd", padding: "12px 30px", borderRadius: 18, textAlign: "center", maxWidth: 1640 }}>{current}</div>
    </div>
  );
};

const Narrated: React.FC<{ id: Id; children: React.ReactNode }> = ({ id, children }) => (
  <Sequence from={startOf(id)} durationInFrames={lenOf(id)}>
    <Audio src={staticFile(`audio/${id}.wav`)} />
    <SceneFade len={lenOf(id)}>
      {children}
      <Caption id={id} />
    </SceneFade>
  </Sequence>
);

const Chip: React.FC<{ children: React.ReactNode; hex: string; style?: React.CSSProperties }> = ({ children, hex, style }) => (
  <div style={{ fontFamily: MONO, fontSize: 24, color: C.forest, background: hex, padding: "8px 20px", borderRadius: 999, ...style }}>{children}</div>
);

// ── 1. the problem ──────────────────────────────────────────────────────────
const Hook: React.FC = () => {
  const a = useIn(8, 26), b = useIn(78, 26), c = useIn(160, 26), d = useIn(250, 26);
  return (
    <AbsoluteFill style={{ background: C.forest, justifyContent: "center", padding: "0 150px 120px" }}>
      <Grain dark />
      <div style={{ fontFamily: SERIF, fontSize: 142, lineHeight: 1.02, color: C.cream, letterSpacing: "-0.02em" }}>
        <div style={a}>A bug is in production.</div>
        <div style={{ ...b, color: C.on2 }}>An AI wrote the fix.</div>
        <div style={{ ...c, color: C.mint }}>The tests pass.</div>
        <div style={{ ...d, fontStyle: "italic", color: C.lime }}>Should it merge?</div>
      </div>
    </AbsoluteFill>
  );
};

// ── 2. the idea ─────────────────────────────────────────────────────────────
const Idea: React.FC = () => {
  const f = useCurrentFrame();
  const pop = spring({ frame: f - 4, fps: FPS, config: { damping: 12, stiffness: 120 } });
  const sub = useIn(30, 24);
  const items = [
    { t: "One agent writes the fix", hex: C.lime, at: 100 },
    { t: "Another attacks it", hex: C.rose, at: 190 },
    { t: "A referee runs real tests", hex: C.sky, at: 270 },
    { t: "A named human signs last", hex: C.lilac, at: 335 },
  ];
  return (
    <AbsoluteFill style={{ background: C.forest, alignItems: "center", justifyContent: "center", paddingBottom: 110 }}>
      <Grain dark />
      <div style={{ transform: `scale(${0.7 + 0.3 * pop})`, opacity: Math.min(1, pop * 1.4), display: "flex", alignItems: "center", gap: 40 }}>
        <Flame size={170} fg={C.forest} bg={C.lime} />
        <div style={{ fontFamily: SERIF, fontSize: 220, color: C.cream, letterSpacing: "-0.03em", lineHeight: 1 }}>Fire<i>Drill</i></div>
      </div>
      <div style={{ ...sub, marginTop: 28, fontFamily: SANS, fontWeight: 600, fontSize: 50, color: C.on2 }}>An adversarial hotfix courtroom, inside a Switch chat room.</div>
      <div style={{ display: "flex", gap: 20, marginTop: 52 }}>
        {items.map((it) => <ItemChip key={it.t} {...it} />)}
      </div>
    </AbsoluteFill>
  );
};
const ItemChip: React.FC<{ t: string; hex: string; at: number }> = ({ t, hex, at }) => {
  const s = useIn(at, 20);
  return <div style={{ ...s, fontFamily: SANS, fontWeight: 700, fontSize: 32, color: C.forest, background: hex, padding: "16px 28px", borderRadius: 18 }}>{t}</div>;
};

// ── 3. the cast ─────────────────────────────────────────────────────────────
const CAST = [
  { name: "Fixer", who: "a Claude agent", does: "Writes the patch.", hex: C.lime, at: 78 },
  { name: "Breaker", who: "a Codex agent", does: "Writes hostile tests to break it.", hex: C.rose, at: 160 },
  { name: "Gate", who: "the referee", does: "Runs every test in a fresh workspace. Holds the only key to main.", hex: C.sky, at: 250 },
  { name: "Human", who: "a named approver", does: "Signs off, but only after the patch survives an attack.", hex: C.lilac, at: 400 },
];
const Cast: React.FC = () => {
  const head = useIn(4, 22);
  return (
    <AbsoluteFill style={{ background: C.cream, padding: "70px 110px 0" }}>
      <Grain />
      <div style={head}>
        <Eyebrow color={C.forest}>Four roles, one room</Eyebrow>
        <div style={{ fontFamily: SERIF, fontSize: 96, color: C.forest, marginTop: 4, letterSpacing: "-0.02em" }}>Who is in <i>the room</i></div>
      </div>
      <div style={{ display: "flex", gap: 26, marginTop: 40 }}>
        {CAST.map((c) => <CastCard key={c.name} {...c} />)}
      </div>
    </AbsoluteFill>
  );
};
const CastCard: React.FC<(typeof CAST)[number]> = ({ name, who, does, hex, at }) => {
  const s = useIn(at, 26);
  return (
    <div style={{ ...s, flex: 1, background: C.forest, borderRadius: 34, padding: "36px 32px", minHeight: 520 }}>
      <div style={{ width: 90, height: 90, borderRadius: "50%", background: hex }} />
      <div style={{ fontFamily: SERIF, fontSize: 78, color: C.cream, marginTop: 26 }}>{name}</div>
      <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 23, letterSpacing: "0.14em", textTransform: "uppercase", color: hex, marginTop: 4 }}>{who}</div>
      <div style={{ fontFamily: SANS, fontSize: 33, lineHeight: 1.3, color: C.on2, marginTop: 20 }}>{does}</div>
    </div>
  );
};

// ── 4. how it works with Switch ─────────────────────────────────────────────
const Arrow: React.FC<{ x1: number; y1: number; x2: number; y2: number; at: number; color: string; label?: string; lx?: number; ly?: number }> = ({ x1, y1, x2, y2, at, color, label, lx, ly }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + 28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ang = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  return (
    <>
      <svg style={{ position: "absolute", inset: 0, width: 1920, height: 1080, pointerEvents: "none", opacity: p > 0 ? 1 : 0 }}>
        <line x1={x1} y1={y1} x2={x1 + (x2 - x1) * p} y2={y1 + (y2 - y1) * p} stroke={color} strokeWidth={5} strokeLinecap="round" strokeDasharray="14 10" />
        <g transform={`translate(${x2} ${y2}) rotate(${ang})`} opacity={p > 0.95 ? 1 : 0}><path d="M-6 -14 L16 0 L-6 14 Z" fill={color} /></g>
      </svg>
      {label && <div style={{ position: "absolute", left: lx ?? (x1 + x2) / 2 - 150, top: ly ?? (y1 + y2) / 2 - 46, width: 300, textAlign: "center", opacity: p, fontFamily: MONO, fontSize: 21, color: C.on2 }}>{label}</div>}
      <span style={{ display: "none" }}>{len}</span>
    </>
  );
};
const Box: React.FC<{ x: number; y: number; w: number; h: number; at: number; hex: string; title: string; lines: string[]; dark?: boolean; r?: string }> = ({ x, y, w, h, at, hex, title, lines, dark, r }) => {
  const s = useIn(at, 22);
  return (
    <div style={{ ...s, position: "absolute", left: x, top: y, width: w, height: h, borderRadius: r ?? 30, background: dark ? "#0a1f15" : C.p1, border: `2.5px solid ${hex}`, padding: "22px 28px", boxSizing: "border-box" }}>
      <div style={{ fontFamily: SERIF, fontSize: 52, color: hex, lineHeight: 1 }}>{title}</div>
      {lines.map((l) => <div key={l} style={{ fontFamily: MONO, fontSize: 24, color: C.on2, marginTop: 10 }}>{l}</div>)}
    </div>
  );
};
const HowItWorks: React.FC = () => {
  const head = useIn(2, 20);
  return (
    <AbsoluteFill style={{ background: C.forest }}>
      <Grain dark />
      <div style={{ ...head, position: "absolute", left: 110, top: 52 }}>
        <Eyebrow color={C.lime}>How it works</Eyebrow>
      </div>
      <Box x={90} y={120} w={560} h={250} at={14} hex={C.lilac} title="Switch room" lines={["agents and people in one chat", "bridged to Mattermost", "SUBMIT  ATTACK  APPROVE"]} r="14px 54px 14px 54px" />
      <Box x={90} y={420} w={560} h={130} at={40} hex={C.on3} title="Commands" lines={["@firedrill-gate SUBMIT fix/… <sha>"]} dark />
      <Box x={1010} y={120} w={780} h={180} at={120} hex={C.sky} title="firedrill-gate" lines={["a custom Switch agent", "agent WebSocket  ·  /connection/ws"]} />
      <Arrow x1={650} y1={225} x2={1008} y2={215} at={110} color={C.sky} label="commands in, rulings out" lx={650} ly={160} />
      <Box x={90} y={590} w={560} h={180} at={250} hex={C.mint} title="Room documents" lines={["firedrill-docket", "firedrill-verdicts · gate-only"]} dark />
      <Arrow x1={1010} y1={290} x2={652} y2={650} at={240} color={C.mint} />
      <Box x={1010} y={365} w={780} h={180} at={300} hex={C.lime} title="Fresh workspace" lines={["pytest: repro, attacks, invariant", "same checks run on the correct fix"]} dark />
      <Arrow x1={1400} y1={302} x2={1400} y2={363} at={292} color={C.lime} />
      <Box x={1010} y={610} w={780} h={130} at={380} hex={C.rose} title="main branch" lines={["guarded git hook · only the gate's key"]} dark />
      <Arrow x1={1400} y1={547} x2={1400} y2={608} at={372} color={C.rose} />
      <Box x={90} y={800} w={1700} h={96} at={470} hex={C.lilac} title="Sign-off is checked against the Switch participant id, not typed words" lines={[]} dark r="22px" />
    </AbsoluteFill>
  );
};

// ── 5. the rule ─────────────────────────────────────────────────────────────
const Rule: React.FC = () => {
  const f = useCurrentFrame();
  const a = spring({ frame: f - 8, fps: FPS, config: { damping: 14, stiffness: 110 } });
  const b = useIn(80, 24);
  const chip = useIn(150, 22);
  return (
    <AbsoluteFill style={{ background: C.rose, alignItems: "center", justifyContent: "center", textAlign: "center", paddingBottom: 100 }}>
      <Grain />
      <div style={{ transform: `scale(${0.8 + 0.2 * a})`, opacity: Math.min(1, a * 1.5), fontFamily: SERIF, fontSize: 220, lineHeight: 0.95, color: C.forest, letterSpacing: "-0.03em" }}>
        No attack,<br /><i>no sign-off.</i>
      </div>
      <div style={{ ...b, marginTop: 36, fontFamily: SANS, fontWeight: 600, fontSize: 42, color: C.forest }}>A person typing APPROVE is not enough.</div>
      <div style={{ ...chip, marginTop: 28 }}><Chip hex={C.forest} style={{ color: C.cream, fontSize: 30 }}>green on repro only · cannot be approved yet</Chip></div>
    </AbsoluteFill>
  );
};

// ── real footage in a framed panel ──────────────────────────────────────────
const Panel: React.FC<{ clip: string; start?: number; rate?: number; label: string; hex?: string; fit?: "cover" | "contain" }> = ({ clip, start = 0, rate = 1, label, hex = C.lime }) => (
  <AbsoluteFill style={{ background: C.forest }}>
    <Grain dark />
    <div style={{ position: "absolute", left: 220, top: 84, width: 1480, height: 833, borderRadius: 26, overflow: "hidden", boxShadow: "0 40px 100px -30px #000c", border: "1.5px solid #ffffff26" }}>
      <OffthreadVideo src={staticFile(`clips/${clip}.mp4`)} startFrom={Math.round(start * FPS)} playbackRate={rate} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </div>
    <div style={{ position: "absolute", left: 220, top: 22 }}><Chip hex={hex}>{label}</Chip></div>
  </AbsoluteFill>
);

const SplitFootage: React.FC<{ id: Id }> = ({ id }) => {
  const f = useCurrentFrame();
  const cut = Math.round((lenOf(id) - TAIL) * 0.55);
  return f < cut
    ? <Panel clip="landing" start={0.5} rate={1} label="The dashboard · landing page" hex={C.sky} />
    : <Panel clip="cases" start={1.5} rate={1} label="Pick a case" hex={C.lilac} />;
};

const Phone: React.FC = () => {
  const a = useIn(6, 24), b = useIn(70, 22), c = useIn(110, 22), d = useIn(150, 22);
  const items = [
    { t: "Fits down to a 375 px phone", s: b }, { t: "Axe: no serious or critical issues", s: c }, { t: "WCAG AA colour contrast", s: d },
  ];
  return (
    <AbsoluteFill style={{ background: C.cream }}>
      <Grain />
      <div style={{ position: "absolute", left: 250, top: 34, width: 436, height: 876, borderRadius: 60, background: C.forest, padding: 14, boxSizing: "border-box", boxShadow: "0 40px 90px -30px #0009" }}>
        <div style={{ width: "100%", height: "100%", borderRadius: 48, overflow: "hidden" }}>
          <OffthreadVideo src={staticFile("clips/phone.mp4")} startFrom={Math.round(1.2 * FPS)} playbackRate={1.4} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      </div>
      <div style={{ position: "absolute", left: 800, top: 230, right: 140 }}>
        <div style={a}><Eyebrow color={C.forest}>Made for everyone</Eyebrow>
          <div style={{ fontFamily: SERIF, fontSize: 110, color: C.forest, lineHeight: 1, marginTop: 8 }}>On a phone <i>too</i></div></div>
        <div style={{ marginTop: 50, display: "grid", gap: 22 }}>
          {items.map((it) => <div key={it.t} style={{ ...it.s, fontFamily: SANS, fontWeight: 600, fontSize: 42, color: C.forest, display: "flex", alignItems: "center", gap: 18 }}>
            <span style={{ width: 22, height: 22, borderRadius: "50%", background: C.lime, border: `3px solid ${C.forest}` }} />{it.t}</div>)}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── 11. what is real ────────────────────────────────────────────────────────
const REAL = ["The gate, the verifier and the merge", "3 incidents on a live Switch 0.31.0", "Verdicts from real pytest runs", "Merge through a guarded git hook", "73 backend tests · 93 browser checks"];
const FAKE = ["The cast: one person posted every command", "No Claude or Codex session took part", "Labelled as scripted everywhere"];
const Proof: React.FC = () => {
  const head = useIn(2, 22);
  return (
    <AbsoluteFill style={{ background: C.forest, padding: "64px 110px" }}>
      <Grain dark />
      <div style={head}><Eyebrow color={C.lime}>What is real</Eyebrow>
        <div style={{ fontFamily: SERIF, fontSize: 92, color: C.cream, marginTop: 4, letterSpacing: "-0.02em" }}>Real, and <i style={{ color: C.on2 }}>scripted</i></div></div>
      <div style={{ display: "flex", gap: 36, marginTop: 34 }}>
        <Column title="Real" hex={C.mint} items={REAL} base={50} step={78} />
        <Column title="Scripted" hex={C.rose} items={FAKE} base={560} step={90} />
      </div>
    </AbsoluteFill>
  );
};
const Column: React.FC<{ title: string; hex: string; items: string[]; base: number; step: number }> = ({ title, hex, items, base, step }) => {
  const h = useIn(base - 24, 20);
  return (
    <div style={{ flex: 1, background: C.p1, borderRadius: 30, padding: "30px 36px", minHeight: 560 }}>
      <div style={{ ...h, fontFamily: SERIF, fontSize: 64, color: hex }}>{title}</div>
      {items.map((t, i) => <Line key={t} t={t} hex={hex} at={base + i * step} />)}
    </div>
  );
};
const Line: React.FC<{ t: string; hex: string; at: number }> = ({ t, hex, at }) => {
  const s = useIn(at, 20);
  return <div style={{ ...s, display: "flex", gap: 18, alignItems: "flex-start", fontFamily: SANS, fontWeight: 600, fontSize: 36, lineHeight: 1.25, color: C.cream, marginTop: 24 }}>
    <span style={{ marginTop: 12, flex: "0 0 18px", height: 18, borderRadius: "50%", background: hex }} />{t}</div>;
};

// ── 12. close ───────────────────────────────────────────────────────────────
const Close: React.FC = () => {
  const f = useCurrentFrame();
  const pop = spring({ frame: f - 4, fps: FPS, config: { damping: 12, stiffness: 120 } });
  const a = useIn(34, 24), b = useIn(60, 24);
  return (
    <AbsoluteFill style={{ background: C.forest, alignItems: "center", justifyContent: "center", paddingBottom: 100 }}>
      <Grain dark />
      <div style={{ transform: `scale(${0.7 + 0.3 * pop})`, opacity: Math.min(1, pop * 1.4), display: "flex", alignItems: "center", gap: 40 }}>
        <Flame size={170} fg={C.forest} bg={C.lime} />
        <div style={{ fontFamily: SERIF, fontSize: 220, color: C.cream, letterSpacing: "-0.03em", lineHeight: 1 }}>Fire<i>Drill</i></div>
      </div>
      <div style={{ ...a, marginTop: 30, fontFamily: SERIF, fontSize: 70, color: C.lime, fontStyle: "italic" }}>A fix must survive an attack before a human signs.</div>
      <div style={{ ...b, marginTop: 18, fontFamily: MONO, fontSize: 32, color: C.on2 }}>github.com/ElaraLarsen/FireDrill · Flip the Switch hackathon</div>
    </AbsoluteFill>
  );
};

export const FireDrillExplainer: React.FC = () => (
  <AbsoluteFill style={{ background: C.forest }}>
    <Fonts />
    <Narrated id="s01"><Hook /></Narrated>
    <Narrated id="s02"><Idea /></Narrated>
    <Narrated id="s03"><Cast /></Narrated>
    <Narrated id="s04"><HowItWorks /></Narrated>
    <Narrated id="s05"><Rule /></Narrated>
    <Narrated id="s06"><Panel clip="mm" start={0} rate={1.45} label="A real Switch 0.31.0 room · Mattermost" hex={C.mint} /></Narrated>
    <Narrated id="s07"><SplitFootage id="s07" /></Narrated>
    <Narrated id="s08"><Panel clip="run" start={0} rate={2} label="A live-recorded drill · 2× speed" hex={C.lime} /></Narrated>
    <Narrated id="s09"><Panel clip="console" start={0} rate={2.4} label="The console · 2.4× speed" hex={C.sky} /></Narrated>
    <Narrated id="s10"><Phone /></Narrated>
    <Narrated id="s11"><Proof /></Narrated>
    <Narrated id="s12"><Close /></Narrated>
  </AbsoluteFill>
);

void Easing;
