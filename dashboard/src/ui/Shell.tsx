// The frame around every case page: the bar on top and the ink tab rail. The console lives in Console.tsx.
import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";
import type { Run } from "../fixtures";
import * as I from "../icons";
import { INCIDENTS } from "../model";
import { PAGE_META, PAGES, type Page, type PageState } from "../pages";
import { INCIDENT_META } from "../views";
import { INCIDENT_ICON, INK, PAGE_INK } from "./theme";

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
