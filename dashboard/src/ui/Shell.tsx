// The frame around every case page: the black bar on top, the ink tab rail, and the player dock.
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState, type ReactNode } from "react";
import type { Run } from "../fixtures";
import * as I from "../icons";
import { INCIDENTS, type Frame } from "../model";
import { PAGE_META, PAGES, type Page, type PageState } from "../pages";
import type { Line } from "../story";
import { INCIDENT_META } from "../views";
import { Scramble } from "./Scramble";
import { INCIDENT_ICON, INK, PAGE_INK, TONE } from "./theme";

const spring = { type: "spring", stiffness: 520, damping: 34 } as const;

export function Brand({ onHome, light }: { onHome: () => void; light?: boolean }) {
  return (
    <a href="#/" onClick={(e) => { e.preventDefault(); onHome(); }} className="group flex items-center gap-3" aria-label="FireDrill home">
      <motion.span
        whileHover={{ rotate: -12 }}
        whileTap={{ scale: 0.85 }}
        transition={{ type: "spring", stiffness: 500, damping: 14 }}
        className={`grid h-11 w-11 place-items-center rounded-full ${light ? "bg-forest text-lime" : "bg-lime text-forest"}`}
      >
        <I.Flame size={24} />
      </motion.span>
      <span className={`display text-[30px] ${light ? "text-forest" : "text-on"}`}>Fire<em>Drill</em></span>
    </a>
  );
}

interface TopProps {
  run: Run | null;
  link: string;
  runFor: (incident: string) => Run | undefined;
  activeIncident: string | null;
  onPick: (id: string) => void;
  onHome: () => void;
  onLive?: () => void;
}

export function TopBar(p: TopProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bar relative z-20 bg-forest text-on">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-8">
        <Brand onHome={p.onHome} />
        <nav aria-label="Switch case" className="flex items-center gap-1">
          {INCIDENTS.map((inc) => {
            const r = p.runFor(inc);
            const on = p.activeIncident === inc;
            return (
              <button
                key={inc}
                disabled={!r}
                onClick={() => r && p.onPick(r.id)}
                title={INCIDENT_META[inc].label}
                aria-current={on ? "page" : undefined}
                className={`tap press relative flex h-11 items-center gap-2 px-3 text-[15px] font-bold disabled:opacity-40 ${on ? "text-forest" : "text-on2 hover:text-on"}`}
              >
                {on && <motion.span layoutId="case-pill" transition={spring} className="brand-mark absolute inset-0 -z-10" style={{ background: "var(--board)" }} />}
                {INCIDENT_ICON[inc](18)}
                <span className="hidden lg:inline">{INCIDENT_META[inc].label}</span>
              </button>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <Status run={p.run} link={p.link} />
          {p.onLive && <button onClick={p.onLive} className="tap press h-11 bg-p2 px-3 text-[15px] font-bold text-on hover:bg-p3 sm:px-4">Go live</button>}
          {p.run && (
            <button onClick={() => setOpen(!open)} aria-expanded={open} aria-label="What's real?" className={`tap press inline-flex h-11 items-center gap-2 px-3 text-[15px] font-bold sm:px-4 ${open ? "bg-cream text-forest" : "bg-p2 text-on hover:bg-p3"}`}>
              <I.Info size={17} /> <span className="hidden sm:inline">What's real?</span>
            </button>
          )}
        </div>
      </div>
      <AnimatePresence>
        {p.run && open && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
            <p className="mx-auto max-w-[1440px] px-4 pb-4 text-[16px] leading-relaxed text-on2 sm:px-8">
              <b className="text-on">What's real here: </b>{p.run.provenance} Frames are replayed in your browser; nothing is sent to the gate.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Status({ run, link }: { run: Run | null; link: string }) {
  if (!run) {
    const s: Record<string, [string, string]> = { live: ["Live", INK.jade], connecting: ["Connecting…", INK.sky], offline: ["Gate offline", INK.scarlet], static: ["Replay only", INK.lime] };
    const [t, c] = s[link] ?? s.offline;
    return <span className="inline-flex h-11 items-center gap-2 px-3 text-[15px] font-bold" style={{ color: c }}><span className="blink h-2.5 w-2.5 bg-current" />{t}</span>;
  }
  const real = run.verifier !== "test-stand-in";
  const full = `Replay · ${real ? "real test evidence" : "test verifier"}${run.scripted ? " · scripted cast" : ""}`;
  return (
    <span className="inline-flex h-11 items-center gap-2 px-2 text-[15px] font-bold text-jade" title={full}>
      <span className="blink h-2.5 w-2.5 bg-current" />
      <span className="sr-only sm:not-sr-only">Replay</span><span className="hidden 2xl:inline">{full.slice(6)}</span>
    </span>
  );
}

const PAGE_ICON: Record<Page, (s: number) => ReactNode> = {
  case: (s) => <I.Folder size={s} />,
  room: (s) => <I.Wrench size={s} />,
  attack: (s) => <I.Zap size={s} />,
  ruling: (s) => <I.Gavel size={s} />,
  signoff: (s) => <I.Pen size={s} />,
};
export const pageIcon = (p: Page, s = 22) => PAGE_ICON[p](s);

const STATE_WORD: Record<PageState, string> = { done: "done", failed: "broken", active: "now", pending: "" };

/**
 * Five tabs, each printed in its page's ink. The current tab grows down into the board, so the
 * page you are on is the tab you pressed.
 */
export function Trail({ page, states, onGo }: { page: Page; states: Record<Page, PageState>; onGo: (p: Page) => void }) {
  return (
    <nav aria-label="Steps of the drill" className="relative z-10 bg-forest">
      <ol className="mx-auto flex max-w-[1440px] items-end gap-1 px-4 pt-2 sm:gap-1.5 sm:px-8">
        {PAGES.map((p) => {
          const on = p === page;
          const st = states[p];
          const ink = PAGE_INK[p];
          const dark = p === "ruling";
          return (
            <li key={p} className={`min-w-0 ${on ? "flex-[2.4] md:flex-[1.6]" : "flex-1"}`}>
              <motion.button
                onClick={() => onGo(p)}
                aria-current={on ? "step" : undefined}
                aria-label={`${PAGE_META[p].label}${STATE_WORD[st] ? `: ${STATE_WORD[st]}` : ""}`}
                animate={{ height: on ? 76 : 58 }}
                whileHover={on ? undefined : { height: 64 }}
                whileTap={{ scale: 0.97 }}
                transition={spring}
                className={`tap relative flex w-full items-center gap-3 overflow-hidden px-3 text-left sm:px-4 ${dark && !on ? "outline outline-2 -outline-offset-2 outline-p3" : ""}`}
                style={{ background: ink.board, color: ink.on }}
              >
                <span className="relative grid h-9 w-9 shrink-0 place-items-center">
                  {st === "done" && !on ? <DrawnCheck /> : st === "failed" && !on ? <I.Cross size={20} /> : PAGE_ICON[p](20)}
                  {on && st === "active" && <span className="pingring absolute inset-0" />}
                </span>
                <span className={`min-w-0 ${on ? "" : "hidden md:block"}`}>
                  <span className="block truncate text-[16px] font-semibold leading-tight">{PAGE_META[p].short}</span>
                  {on && <span className="hidden truncate text-[13px] font-medium opacity-80 sm:block">{PAGE_META[p].plain}</span>}
                </span>
                {st === "failed" && <span className="ml-auto hidden bg-forest px-1.5 py-0.5 text-[11px] font-semibold text-scarlet xl:inline">broken</span>}
              </motion.button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function DrawnCheck() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="square" aria-hidden>
      <motion.path d="M4.5 12.5l5 5L19.5 7" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, ease: "easeOut" }} />
    </svg>
  );
}

/** The narrator: one sentence about what just happened, resolving out of noise. */
export function Narrator({ line, k }: { line: Line; k: string }) {
  const t = TONE[line.tone];
  return (
    <div className="flex min-w-0 items-center gap-4" aria-live="polite">
      <motion.span
        key={`i${k}`}
        initial={{ scale: 0.4, rotate: -45 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 520, damping: 16 }}
        className="grid h-12 w-12 shrink-0 place-items-center text-forest"
        style={{ background: t.hex }}
      >
        {t.icon(24)}
      </motion.span>
      <span className="min-w-0">
        <Scramble key={`t${k}`} text={line.title} duration={0.5} className="serif block truncate text-[24px] leading-tight sm:text-[28px]" />
        <motion.span key={`d${k}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="mt-0.5 block truncate text-[15px] text-on2">
          {line.detail}
        </motion.span>
      </span>
    </div>
  );
}

interface DockProps {
  line: Line;
  k: string;
  frames: Frame[] | null;
  track: Page[];
  step: number;
  playing: boolean;
  speed: number;
  onToggle: () => void;
  onStep: (d: number) => void;
  onJump: (n: number) => void;
  onSpeed: (x: number) => void;
}

/** The player, a black strip across the foot of every case page. */
export function Dock(p: DockProps) {
  const total = p.frames?.length ?? 0;
  const atEnd = p.step >= total;
  const t = TONE[p.line.tone];
  // The progress bar is the drill's own page track, printed in each page's ink.
  const segments = useMemo(() => {
    const out: { page: Page; from: number; to: number }[] = [];
    p.track.slice(1).forEach((pg, i) => {
      const last = out[out.length - 1];
      if (last && last.page === pg) last.to = i + 1;
      else out.push({ page: pg, from: i, to: i + 1 });
    });
    return out;
  }, [p.track]);
  return (
    <div className="dock fixed inset-x-0 bottom-0 z-30 bg-forest text-on">
      {p.frames && (
        <div className="relative h-4 sm:h-5" aria-hidden>
          {segments.map((s, i) => (
            <span key={i} className="absolute inset-y-0" style={{ left: `${(s.from / total) * 100}%`, width: `${((s.to - s.from) / total) * 100}%`, background: PAGE_INK[s.page].board === INK.forest ? INK.pine : PAGE_INK[s.page].board, opacity: 0.35 }} />
          ))}
          <motion.div className="absolute inset-y-0 left-0 overflow-hidden" animate={{ width: `${total ? (p.step / total) * 100 : 0}%` }} transition={{ type: "spring", stiffness: 260, damping: 32 }}>
            {segments.map((s, i) => (
              <span key={i} className="absolute inset-y-0" style={{ left: `${total && p.step ? (s.from / p.step) * 100 : 0}%`, width: `${total && p.step ? ((s.to - s.from) / p.step) * 100 : 0}%`, background: PAGE_INK[s.page].board === INK.forest ? INK.pine : PAGE_INK[s.page].board }} />
            ))}
          </motion.div>
        </div>
      )}
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-8 sm:py-4">
        <div className="min-w-0 flex-1 basis-[280px]"><Narrator line={p.line} k={p.k} /></div>
        {p.frames && (
          <div className="flex items-center gap-2">
            <Square label="Step back (←)" onClick={() => p.onStep(-1)} disabled={p.step === 0}><I.StepBack size={20} /></Square>
            <motion.button
              onClick={p.onToggle}
              aria-label={p.playing ? "Pause (space)" : atEnd ? "Play again" : "Play (space)"}
              title={p.playing ? "Pause (space)" : atEnd ? "Play again" : "Play (space)"}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.88 }}
              transition={{ type: "spring", stiffness: 520, damping: 15 }}
              className="tap grid h-14 w-14 place-items-center text-forest sm:h-16 sm:w-20"
              style={{ background: t.hex, transition: "background-color .4s" }}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span key={p.playing ? "pause" : atEnd ? "again" : "play"} initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, rotate: 90 }} transition={{ type: "spring", stiffness: 600, damping: 22 }}>
                  {p.playing ? <I.Pause size={26} /> : atEnd ? <I.Restart size={26} /> : <I.Play size={26} className="translate-x-[2px]" />}
                </motion.span>
              </AnimatePresence>
            </motion.button>
            <Square label="Step forward (→)" onClick={() => p.onStep(1)} disabled={atEnd}><I.StepFwd size={20} /></Square>
            <div className="ml-1 flex items-center bg-p2 p-1" role="group" aria-label="Auto-play speed">
              {[1, 2].map((x) => (
                <button key={x} onClick={() => p.onSpeed(x)} aria-pressed={p.speed === x} className="tap press relative h-11 px-3.5 text-[16px] font-bold">
                  {p.speed === x && <motion.span layoutId="speed-pill" transition={spring} className="absolute inset-0 -z-10 bg-cream" />}
                  <span className={p.speed === x ? "text-forest" : "text-on2"}>{x}×</span>
                </button>
              ))}
            </div>
            <span className="tnum ml-2 hidden font-mono text-[14px] text-on3 xl:inline">{p.step}/{total}</span>
          </div>
        )}
      </div>
      {p.frames && (
        <input type="range" min={0} max={total} value={p.step} onChange={(e) => p.onJump(Number(e.target.value))} aria-label="Replay position" className="scrub absolute inset-x-0 -top-3 z-10 w-full cursor-pointer" />
      )}
    </div>
  );
}

function Square({ children, onClick, label, disabled }: { children: ReactNode; onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      whileHover={disabled ? undefined : { y: -2 }}
      whileTap={disabled ? undefined : { scale: 0.86 }}
      transition={{ type: "spring", stiffness: 520, damping: 15 }}
      className="tap grid h-12 w-12 place-items-center bg-p2 text-on hover:bg-p3 disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </motion.button>
  );
}
