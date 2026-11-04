// The landing hero's world, drawn here instead of shipped as a picture: a courthouse whose five
// columns wear the five steps' colours, the gate's seal for a sun, the wordmark standing behind the
// front steps, two lanterns for the "fire", and outlined confetti drifting down. Flat fills, thick
// forest outlines and hard offset shadows: the neo-brutalist build of the dashboard's palette.
// Layers move apart with the pointer and the scroll; under reduced motion everything holds still.
import { motion, useScroll, useSpring, useTransform, type MotionValue } from "motion/react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { INK } from "./theme";

const F = INK.forest;
const COLUMNS = [INK.cream, INK.sky, INK.rose, INK.forest, INK.lilac];

/** Two compositions: a wide one, and a tall one for phones and portrait tablets. */
function geometry(tall: boolean) {
  return tall
    ? {
        W: 400, H: 900, gy: 800, sw: 3,
        word: { x: 14, y: 826, fs: 98, len: 372, sh: 5 },
        court: { cx: 200, half: 168, apex: 548, eave: 594, beam: 622, base: 770, colW: 30, gap: 60, cap: 9, text: 9.5, sh: 7, seal: 13 },
        sun: null,
        clouds: [{ x: 330, y: 520, w: 84 }],
        lanterns: [],
        hedge: { r: 0.32 },
      }
    : {
        W: 1440, H: 900, gy: 768, sw: 4,
        word: { x: 120, y: 826, fs: 250, len: 1200, sh: 9 },
        court: { cx: 856, half: 286, apex: 310, eave: 426, beam: 474, base: 718, colW: 50, gap: 106, cap: 14, text: 15, sh: 12, seal: 27 },
        sun: { x: 1196, y: 226, r: 136 },
        clouds: [{ x: 1300, y: 470, w: 170 }, { x: 640, y: 150, w: 130 }],
        lanterns: [1196],
        hedge: { r: 0.78 },
      };
}
type Geo = ReturnType<typeof geometry> & { L: number; R: number };

/**
 * A portrait screen wider than a phone (a tablet, a narrow window) would otherwise be zoomed into,
 * cropping the sky and lifting the courthouse into the headline. Instead the tall world widens
 * sideways: the extra room goes to the left, where the words are, and the wordmark spans it all.
 */
function fit(tall: boolean, aspect: number): Geo {
  const g = geometry(tall);
  const extra = tall ? Math.max(0, g.H * aspect - g.W) : 0;
  if (!extra) return { ...g, L: 0, R: g.W };
  const len = g.word.len + extra;
  return { ...g, L: -extra, R: g.W, word: { ...g.word, x: g.word.x - extra, len, fs: g.word.fs * Math.min(1.6, len / g.word.len) } };
}

function useAspect(ref: RefObject<HTMLDivElement | null>): number {
  const [aspect, setAspect] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => { const { width, height } = e.contentRect; if (height) setAspect(width / height); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return aspect;
}

function useTall(): boolean {
  const q = "(max-aspect-ratio: 1/1)";
  const [tall, setTall] = useState(() => typeof matchMedia !== "undefined" && matchMedia(q).matches);
  useEffect(() => {
    const m = matchMedia(q);
    const on = () => setTall(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return tall;
}

const still = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Pointer position across the window, -1..1, eased with a spring so the layers glide. */
function usePointer(): [MotionValue<number>, MotionValue<number>] {
  const x = useSpring(0, { stiffness: 60, damping: 18 });
  const y = useSpring(0, { stiffness: 60, damping: 18 });
  useEffect(() => {
    if (still()) return;
    const on = (e: PointerEvent) => { x.set((e.clientX / innerWidth) * 2 - 1); y.set((e.clientY / innerHeight) * 2 - 1); };
    window.addEventListener("pointermove", on, { passive: true });
    return () => window.removeEventListener("pointermove", on);
  }, [x, y]);
  return [x, y];
}

export function CourtScene() {
  const tall = useTall();
  const box = useRef<HTMLDivElement>(null);
  const g = fit(tall, useAspect(box));
  const [px, py] = usePointer();
  const { scrollY } = useScroll();
  const p = useTransform(scrollY, [0, 900], [0, 1], { clamp: true });
  const calm = still();
  // How far each layer travels: the far ones barely, the front ones most.
  const layer = (depth: number, rise: number) => ({
    x: useTransform(px, (v) => (calm ? 0 : v * -depth)),
    y: useTransform([py, p] as MotionValue<number>[], ([a, b]: number[]) => (calm ? 0 : a * -depth * 0.35 + b * rise)),
  });
  const sun = layer(8, 130), cloud = layer(16, 90), court = layer(22, 50), word = layer(32, -110), front = layer(46, 0);

  return (
    <div ref={box} className="absolute inset-0" aria-hidden>
      <svg viewBox={`${g.L} 0 ${g.R - g.L} ${g.H}`} preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full">
        <defs>
          <pattern id="sky-dots" width={tall ? 16 : 22} height={tall ? 16 : 22} patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r={tall ? 1.1 : 1.5} fill={F} opacity=".16" />
          </pattern>
        </defs>
        <rect x={g.L - 50} y="-50" width={g.R - g.L + 100} height={g.H + 100} fill={INK.sky} />
        <rect x={g.L - 50} y="-50" width={g.R - g.L + 100} height={g.H + 100} fill="url(#sky-dots)" />

        {g.sun && <motion.g style={sun}><Seal {...g.sun} sw={g.sw} /></motion.g>}
        <motion.g style={cloud}>{g.clouds.map((c, i) => <Cloud key={i} {...c} sw={g.sw} slow={i % 2 === 1} />)}</motion.g>
        <motion.g style={court}><Courthouse g={g} /></motion.g>
        <motion.g style={word}><Wordmark g={g} /></motion.g>
        <motion.g style={front}><Front g={g} /></motion.g>
      </svg>
      <Confetti count={tall ? 16 : 34} />
    </div>
  );
}

/** The gate's seal as a sun: a lime disc, a slowly turning ring of ticks, and a check. */
function Seal({ x, y, r, sw }: { x: number; y: number; r: number; sw: number }) {
  return (
    <g>
      <circle cx={x + 12} cy={y + 12} r={r} fill={F} />
      <circle cx={x} cy={y} r={r} fill={INK.lime} stroke={F} strokeWidth={sw} />
      <g className="spin-seal">
        {Array.from({ length: 48 }, (_, i) => {
          const a = (i / 48) * Math.PI * 2;
          const r1 = r - 30, r2 = r - (i % 4 === 0 ? 12 : 20);
          return <line key={i} x1={x + Math.cos(a) * r1} y1={y + Math.sin(a) * r1} x2={x + Math.cos(a) * r2} y2={y + Math.sin(a) * r2} stroke={F} strokeWidth={3} strokeLinecap="round" />;
        })}
      </g>
      <polyline points={`${x - 52},${y + 4} ${x - 14},${y + 42} ${x + 56},${y - 38}`} fill="none" stroke={F} strokeWidth={20} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

/** A flat cloud: the shapes are stroked first and filled after, so only the outer outline shows. */
function Cloud({ x, y, w, sw, slow }: { x: number; y: number; w: number; sw: number; slow?: boolean }) {
  const h = w * 0.3;
  const parts = (fill: string, stroke?: number, dx = 0) => (
    <g fill={fill} stroke={stroke ? F : "none"} strokeWidth={stroke}>
      <rect x={x - w / 2 + dx} y={y - h / 2 + dx} width={w} height={h} rx={h / 2} />
      <circle cx={x - w * 0.14 + dx} cy={y - h * 0.45 + dx} r={h * 0.62} />
      <circle cx={x + w * 0.16 + dx} cy={y - h * 0.32 + dx} r={h * 0.48} />
    </g>
  );
  return (
    <g className={`drift ${slow ? "slow" : ""}`}>
      {parts(F, sw * 2, 7)}
      {parts(F, sw * 2)}
      {parts(INK.cream)}
    </g>
  );
}

function Courthouse({ g }: { g: Geo }) {
  const { cx, half, apex, eave, beam, base, colW, gap, cap, text, sh, seal } = g.court;
  const sw = g.sw;
  const ped = (dx: number) => `${cx - half + dx},${eave + dx} ${cx + dx},${apex + dx} ${cx + half + dx},${eave + dx}`;
  const stepH = (g.gy - base) / 2;
  return (
    <g>
      {/* one hard shadow for the whole building */}
      <g fill={F}>
        <polygon points={ped(sh)} />
        <rect x={cx - half + 10 + sh} y={eave + sh} width={half * 2 - 20} height={beam - eave} />
        <rect x={cx - half + 30 + sh} y={beam + sh} width={half * 2 - 60} height={base - beam} />
      </g>
      <rect x={cx - half + 30} y={beam} width={half * 2 - 60} height={base - beam} fill={INK.pine} stroke={F} strokeWidth={sw} />
      {COLUMNS.map((c, i) => {
        const x = cx + (i - 2) * gap;
        return (
          <g key={i} stroke={F} strokeWidth={sw}>
            <rect x={x - colW / 2} y={beam} width={colW} height={base - beam} fill={c} />
            {[0.33, 0.66].map((t) => <line key={t} x1={x - colW / 2 + colW * t} y1={beam + cap + 6} x2={x - colW / 2 + colW * t} y2={base - cap - 6} strokeWidth={sw * 0.6} opacity={c === INK.forest ? 0 : 0.35} />)}
            <rect x={x - colW / 2 - cap * 0.6} y={beam} width={colW + cap * 1.2} height={cap} fill={c} />
            <rect x={x - colW / 2 - cap * 0.6} y={base - cap} width={colW + cap * 1.2} height={cap} fill={c} />
          </g>
        );
      })}
      <rect x={cx - half + 10} y={eave} width={half * 2 - 20} height={beam - eave} fill={INK.cream} stroke={F} strokeWidth={sw} />
      <text x={cx} y={(eave + beam) / 2 + text * 0.36} textAnchor="middle" fontFamily="Bricolage, sans-serif" fontWeight={700} fontSize={text} letterSpacing={text * 0.24} fill={F}>
        THE GATE · ONE KEY TO MAIN
      </text>
      <polygon points={ped(0)} fill={INK.lime} stroke={F} strokeWidth={sw} strokeLinejoin="round" />
      <circle cx={cx} cy={eave - (eave - apex) * 0.36} r={seal} fill={F} />
      <polyline
        points={`${cx - seal * 0.45},${eave - (eave - apex) * 0.36} ${cx - seal * 0.1},${eave - (eave - apex) * 0.36 + seal * 0.35} ${cx + seal * 0.5},${eave - (eave - apex) * 0.36 - seal * 0.35}`}
        fill="none" stroke={INK.lime} strokeWidth={seal * 0.22} strokeLinecap="round" strokeLinejoin="round"
      />
      <g stroke={F} strokeWidth={sw} fill={INK.cream}>
        <rect x={cx - half - 6} y={base} width={half * 2 + 12} height={stepH} />
        <rect x={cx - half - 34} y={base + stepH} width={half * 2 + 68} height={stepH} />
      </g>
    </g>
  );
}

/** FIREDRILL cut like an inscription, its feet hidden behind the front steps. */
function Wordmark({ g }: { g: Geo }) {
  const { x, y, fs, len, sh } = g.word;
  const t = (dx: number, fill: string, stroke = 0) => (
    <text x={x + dx} y={y + dx} fontFamily="'Instrument Serif', Georgia, serif" fontSize={fs} textLength={len} lengthAdjust="spacingAndGlyphs" fill={fill} stroke={stroke ? F : "none"} strokeWidth={stroke} paintOrder="stroke" strokeLinejoin="round">
      FIREDRILL
    </text>
  );
  return <g>{t(sh, F)}{t(0, INK.cream, g.sw * 1.6)}</g>;
}

/** The front steps, the hedges at either end, and two lanterns. */
function Front({ g }: { g: Geo }) {
  const band = (g.H - g.gy) / 3;
  const k = g.hedge.r;
  const hedge = (side: 1 | -1) => {
    const X = (v: number) => (side === 1 ? g.L + v : g.R - v);
    const back = [[X(30 * k), g.gy - 70 * k, 92 * k], [X(150 * k), g.gy - 22 * k, 66 * k]] as const;
    const fore = [[X(-10 * k), g.gy - 10 * k, 80 * k], [X(96 * k), g.gy + 14 * k, 58 * k], [X(200 * k), g.gy + 30 * k, 44 * k]] as const;
    const blob = (cs: readonly (readonly [number, number, number])[], fill: string) => (
      <g>
        <g fill={F}>{cs.map(([cx, cy, r], i) => <circle key={i} cx={cx + 6} cy={cy + 6} r={r + g.sw} />)}</g>
        <g fill={F}>{cs.map(([cx, cy, r], i) => <circle key={i} cx={cx} cy={cy} r={r + g.sw} />)}</g>
        <g fill={fill}>{cs.map(([cx, cy, r], i) => <circle key={i} cx={cx} cy={cy} r={r - g.sw / 2} />)}</g>
      </g>
    );
    return <g>{blob(back, INK.moss)}{blob(fore, INK.lime)}</g>;
  };
  return (
    <g>
      {g.lanterns.map((x) => <Lantern key={x} x={x} gy={g.gy} sw={g.sw} />)}
      {[INK.forest, "#143322", "#1b3f2b"].map((c, i) => (
        <g key={c}>
          <rect x={g.L - 60} y={g.gy + band * i} width={g.R - g.L + 120} height={band + 2} fill={c} />
          <line x1={g.L - 60} x2={g.R + 60} y1={g.gy + band * i} y2={g.gy + band * i} stroke={INK.pine} strokeWidth={g.sw} />
        </g>
      ))}
      {hedge(1)}
      {hedge(-1)}
    </g>
  );
}

function Lantern({ x, gy, sw }: { x: number; gy: number; sw: number }) {
  const top = gy - 230;
  return (
    <g stroke={F} strokeWidth={sw} strokeLinejoin="round">
      <rect x={x - 6} y={top + 70} width={12} height={gy - top - 70} fill={F} />
      <rect x={x - 28 + 7} y={top + 14 + 7} width={56} height={58} fill={F} stroke="none" />
      <rect x={x - 28} y={top + 14} width={56} height={58} fill={INK.rose} />
      <ellipse className="flicker" cx={x} cy={top + 46} rx={11} ry={18} fill={INK.cream} strokeWidth={sw * 0.75} />
      <polygon points={`${x - 40},${top + 16} ${x},${top - 12} ${x + 40},${top + 16}`} fill={F} />
    </g>
  );
}

/** Outlined confetti falling slowly, pushed sideways by the pointer. Paused when off-screen. */
function Confetti({ count }: { count: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx || still()) return;
    const colors = [INK.lime, INK.rose, INK.lilac, INK.cream];
    let w = 0, h = 0, raf = 0, visible = true, wind = 0;
    const size = () => {
      const dpr = Math.min(2, devicePixelRatio || 1);
      w = c.clientWidth; h = c.clientHeight;
      c.width = w * dpr; c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    const bits = Array.from({ length: count }, (_, i) => ({
      x: Math.random() * w, y: Math.random() * h, vy: 0.35 + Math.random() * 0.6, sway: Math.random() * Math.PI * 2,
      rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.04, bw: 9 + Math.random() * 7, bh: 5 + Math.random() * 4, color: colors[i % colors.length],
    }));
    const frame = () => {
      ctx.clearRect(0, 0, w, h);
      wind *= 0.96;
      for (const b of bits) {
        b.sway += 0.012;
        b.y += b.vy;
        b.x += Math.sin(b.sway) * 0.45 + wind;
        b.rot += b.vr;
        if (b.y > h + 20) { b.y = -20; b.x = Math.random() * w; }
        if (b.x < -20) b.x = w + 20; else if (b.x > w + 20) b.x = -20;
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rot);
        ctx.scale(1, Math.abs(Math.cos(b.sway * 2)) * 0.7 + 0.3);
        ctx.fillStyle = b.color;
        ctx.strokeStyle = F;
        ctx.lineWidth = 1.6;
        ctx.fillRect(-b.bw / 2, -b.bh / 2, b.bw, b.bh);
        ctx.strokeRect(-b.bw / 2, -b.bh / 2, b.bw, b.bh);
        ctx.restore();
      }
      raf = visible && !document.hidden ? requestAnimationFrame(frame) : 0;
    };
    const kick = () => { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame); };
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; kick(); });
    const ro = new ResizeObserver(size);
    const onMove = (e: PointerEvent) => { wind = Math.max(-2.5, Math.min(2.5, wind + e.movementX * 0.012)); };
    io.observe(c);
    ro.observe(c);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("visibilitychange", kick);
    kick();
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", kick);
    };
  }, [count]);
  return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full" />;
}
