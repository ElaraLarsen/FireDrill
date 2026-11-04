// The console at the foot of every case: the room log scrolls by as a transcript and a real prompt
// drives the replay. It is a viewer for recorded frames, so it never sends anything anywhere.
import { motion } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { complete, HELP, parse, statusLines, transcript, type Cmd, type Entry, type Ink } from "../console";
import type { Frame, State } from "../model";
import type { Page } from "../pages";
import type { Line } from "../story";
import { INK } from "./theme";

const TERM: Record<Ink, string> = {
  fixer: INK.lime, breaker: INK.rose, gate: INK.sky, human: INK.lilac,
  pass: "#5ce6a6", fail: "#ff7d7d", mute: "#8aa584",
};

type Sys = { id: number; after: number; kind: "echo" | "out" | "err"; text: string };

interface Props {
  title: string;
  /** One honest line about what the frames are (scripted cast, real verifier, …). */
  meta: string;
  frames: Frame[] | null;
  step: number;
  running: boolean;
  state: State;
  page: Page;
  line: Line;
  nextLine: Line | null;
  /** Run a command that changes the replay. Returns a message to print when it could not. */
  onCommand: (c: Cmd) => string | void;
  onStop: () => void;
}

export function Console(p: Props) {
  const total = p.frames?.length ?? 0;
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [sys, setSys] = useState<Sys[]>([]);
  const [cleared, setCleared] = useState(0);
  const history = useRef<string[]>([]);
  const cursor = useRef(-1);
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const dock = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  const entries = useMemo(() => (p.frames ? transcript(p.frames, p.step) : []), [p.frames, p.step]);
  const floor = Math.min(cleared, p.step);
  const shown = entries.filter((e) => e.step > floor);
  const mine = sys.filter((s) => s.after <= p.step);

  // The page below the dock keeps a clear margin equal to the dock's own height.
  useLayoutEffect(() => {
    const el = dock.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty("--dock", `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // New line, new scroll: the log always follows the newest line.
  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [shown.length, mine.length, open, p.step]);

  // A different case is a fresh screen.
  const caseKey = p.title;
  useEffect(() => { setSys([]); setCleared(0); setValue(""); }, [caseKey]);

  // Desktop: the prompt is ready as soon as the case opens. On touch screens it stays closed so the keyboard doesn't jump up.
  useEffect(() => {
    if (matchMedia("(pointer: fine)").matches) input.current?.focus({ preventScroll: true });
  }, [caseKey]);

  const print = (kind: Sys["kind"], lines: string[]) =>
    setSys((xs) => [...xs, ...lines.map((text) => ({ id: seq.current++, after: p.step, kind, text }))]);

  const submit = (raw: string) => {
    const text = raw.trim();
    if (text) { history.current = [...history.current, text]; }
    cursor.current = -1;
    setValue("");
    const cmd: Cmd | null = parse(text);
    const run: Cmd = cmd ?? { t: "next", n: 1 };
    const echo = text || "next";
    switch (run.t) {
      case "help": print("echo", [echo]); print("out", HELP.map(([a, b]) => `${a.padEnd(14)}${b}`)); return;
      case "status": print("echo", [echo]); print("out", statusLines(p.state, p.step, total, p.page)); return;
      case "clear": setSys([]); setCleared(p.step); return;
      case "unknown": print("echo", [echo]); print("err", [`command not found: ${run.word}. Type help to see what this prompt knows.`]); return;
      default: {
        print("echo", [echo]);
        const msg = p.onCommand(run);
        if (msg) print("out", [msg]);
      }
    }
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (p.running) { e.preventDefault(); p.onStop(); return; }
    if (e.key === "Enter") { e.preventDefault(); submit(value); }
    else if (e.key === "Tab") {
      const c = complete(value);
      if (c) { e.preventDefault(); setValue(c); }
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const h = history.current;
      if (!h.length) return;
      e.preventDefault();
      cursor.current = e.key === "ArrowUp" ? (cursor.current < 0 ? h.length - 1 : Math.max(0, cursor.current - 1)) : cursor.current < 0 ? -1 : cursor.current + 1;
      if (cursor.current >= h.length) cursor.current = -1;
      setValue(cursor.current < 0 ? "" : h[cursor.current]);
    } else if (e.ctrlKey && e.key.toLowerCase() === "l") { e.preventDefault(); setSys([]); setCleared(p.step); }
    else if (e.ctrlKey && e.key.toLowerCase() === "c") { e.preventDefault(); setValue(""); }
  };

  const ghost = complete(value);
  const atEnd = p.frames ? p.step >= total : true;
  const hint = !p.frames ? "following the live gate" : atEnd ? "end of the drill · try reset, back or case <name>" : p.nextLine?.title ?? "next step";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-3 sm:px-8 sm:pb-5">
      <div ref={dock} className="term pointer-events-auto mx-auto max-w-[1440px] overflow-hidden" onClick={(e) => { if (!(e.target as HTMLElement).closest("button, a")) input.current?.focus({ preventScroll: true }); }}>
        <div className="flex h-10 items-center gap-3 border-b border-white/[.07] px-4 font-mono text-[12.5px] text-on3">
          <span className="inline-flex gap-1.5" aria-hidden><i className="h-2.5 w-2.5 rounded-full bg-white/15" /><i className="h-2.5 w-2.5 rounded-full bg-white/15" /><i className="h-2.5 w-2.5 rounded-full bg-white/15" /></span>
          <span className="truncate text-on2">firedrill <span className="text-on3">~/</span>{p.title}</span>
          <span className="ml-auto hidden truncate sm:inline">{p.meta}</span>
          <button
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label={open ? "Shrink the console" : "Grow the console"}
            title={open ? "Shrink" : "Grow"}
            className="tap grid h-7 w-7 shrink-0 place-items-center text-on3 hover:bg-white/10 hover:text-on"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d={open ? "M6 9l6 6 6-6" : "M6 15l6-6 6 6"} />
            </svg>
          </button>
        </div>

        <div
          ref={log}
          data-lenis-prevent
          role="log"
          aria-live="polite"
          aria-label="Room log"
          className="term-log overflow-y-auto px-4 py-3 font-mono text-[13px] leading-[1.7] transition-[height] duration-300 ease-out"
          style={{ height: open ? "min(46vh, 520px)" : 132 }}
        >
          {floor === 0 && <Intro p={p} />}
          {p.frames && shown.length === 0 && mine.length === 0 && floor === 0 && <div className="text-on3">{"# nothing has happened yet"}</div>}
          {sysAt(mine, 0)}
          {shown.map((e) => (
            <div key={e.step}>
              <Row e={e} />
              {sysAt(mine, e.step)}
            </div>
          ))}
          {p.frames && p.step > 0 && shown.length > 0 && (
            <motion.div key={`n${p.step}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15, duration: 0.4 }} className="text-on3">
              <span className="select-none">{"# "}</span>{p.line.title}<span className="hidden sm:inline"> — {p.line.detail}</span>
            </motion.div>
          )}
          {!p.frames && <div className="text-on3"><span className="select-none"># </span>{p.line.title} — {p.line.detail}</div>}
        </div>

        <div className="flex items-center gap-3 border-t border-white/[.07] px-4 py-2.5 font-mono text-[14px]">
          <span className="select-none text-lime" aria-hidden>{p.running ? "…" : "❯"}</span>
          <div className="relative min-w-0 flex-1">
            <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center whitespace-pre text-on3">
              <span className="invisible">{value}</span>
              {ghost && <span>{ghost.slice(value.trimStart().length)}</span>}
              {!value && <span className="truncate">{p.running ? "running… press any key to stop" : hint}</span>}
            </div>
            <input
              ref={input}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={onKey}
              readOnly={p.running}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              enterKeyHint="go"
              aria-label="Command prompt. Press Enter to run the next step, or type help."
              className="term-input h-8 w-full bg-transparent text-on outline-none"
            />
          </div>
          <div className="flex shrink-0 items-center gap-1 text-[13px]">
            <Soft label="back" onClick={() => submit("back")} disabled={!p.frames || p.step === 0 || p.running} />
            <Soft label="next" kbd="⏎" onClick={() => submit("next")} disabled={!p.frames || atEnd || p.running} primary />
            <Soft label={p.running ? "stop" : "run"} onClick={() => (p.running ? p.onStop() : submit("run"))} disabled={!p.frames || (atEnd && !p.running)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Intro({ p }: { p: Props }) {
  return (
    <div className="mb-1 text-on3">
      <div><span className="text-on2">firedrill</span> · {p.frames ? `replaying ${p.title}` : "following the live gate"} · {p.meta}</div>
      <div>Enter runs the next step. <span className="text-on2">run</span> plays on its own, <span className="text-on2">help</span> lists the rest.</div>
    </div>
  );
}

function sysAt(xs: Sys[], after: number) {
  return xs.filter((s) => s.after === after).map((s) => (
    <div key={s.id} className={`row-in whitespace-pre-wrap break-words ${s.kind === "err" ? "text-[#ff9a9a]" : s.kind === "echo" ? "text-on" : "text-on2"}`}>
      {s.kind === "echo" && <span className="select-none text-lime">❯ </span>}
      {s.text}
    </div>
  ));
}

function Row({ e }: { e: Entry }) {
  return (
    <div className="row-in flex gap-x-3">
      <span className="hidden shrink-0 select-none text-on3 sm:inline">{e.time}</span>
      <span className="w-[7.5rem] shrink-0 truncate sm:w-[10.5rem]" style={{ color: TERM[e.ink] }}>{e.who}</span>
      <span className="min-w-0 flex-1 truncate text-on" title={e.text}>
        {e.text}
        {e.note && <span className="text-on3"> · {e.note}</span>}
      </span>
    </div>
  );
}

function Soft({ label, kbd, onClick, disabled, primary }: { label: string; kbd?: string; onClick: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.92 }}
      transition={{ type: "spring", stiffness: 600, damping: 18 }}
      className={`tap inline-flex h-8 items-center gap-1.5 px-2.5 disabled:cursor-not-allowed disabled:opacity-30 ${primary ? "bg-lime text-forest hover:brightness-110" : "text-on2 hover:bg-white/10 hover:text-on"}`}
    >
      {label}
      {kbd && <span className="hidden text-[12px] opacity-70 sm:inline">{kbd}</span>}
    </motion.button>
  );
}

