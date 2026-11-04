// The console: a glass window that is hidden until you ask for it. The room log scrolls by as a
// transcript and a real prompt drives the replay. It only views recorded frames and sends nothing.
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { complete, HELP, parse, statusLines, transcript, type Cmd, type Entry } from "../console";
import type { Frame, State } from "../model";
import type { Page } from "../pages";
import type { Line } from "../story";

type Sys = { id: number; after: number; kind: "echo" | "out" | "err"; text: string };
/** closed: only the pill. mini: just the prompt. normal and large: the prompt with its log. */
type Mode = "closed" | "mini" | "normal" | "large";

// Motion can only tween numbers, so the tall size is worked out from the window when it is asked for.
const heightOf = (m: "normal" | "large"): number => (m === "normal" ? 168 : Math.min(Math.round((typeof window === "undefined" ? 800 : window.innerHeight) * 0.6), 640));
const ease = [0.16, 1, 0.3, 1] as const;
const spring = { type: "spring", stiffness: 420, damping: 32 } as const;

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
  const [mode, setMode] = useState<Mode>("closed");
  const [value, setValue] = useState("");
  const [sys, setSys] = useState<Sys[]>([]);
  const [cleared, setCleared] = useState(0);
  const history = useRef<string[]>([]);
  const cursor = useRef(-1);
  const input = useRef<HTMLInputElement>(null);
  const pill = useRef<HTMLButtonElement>(null);
  const log = useRef<HTMLDivElement>(null);
  // The shell is state, not a ref: the pill and the window swap in and out, and the margin must follow whichever is showing.
  const [shell, setShell] = useState<HTMLDivElement | null>(null);
  const returnFocus = useRef(false);
  const seq = useRef(0);
  const open = mode !== "closed";

  const entries = useMemo(() => (p.frames ? transcript(p.frames, p.step) : []), [p.frames, p.step]);
  const floor = Math.min(cleared, p.step);
  const shown = entries.filter((e) => e.step > floor);
  const mine = sys.filter((s) => s.after <= p.step);

  const show = (m: Mode = "normal") => setMode(m);
  const hide = () => { returnFocus.current = true; setMode("closed"); if (p.running) p.onStop(); };

  // The page keeps a clear margin equal to whatever is showing at the foot.
  useLayoutEffect(() => {
    const el = shell;
    const set = () => document.documentElement.style.setProperty("--dock", `${el ? el.offsetHeight : 64}px`);
    set();
    if (!el) return;
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, [shell]);

  // New line, new scroll: the log always follows the newest line.
  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [shown.length, mine.length, mode, p.step]);

  // A different case is a fresh screen.
  useEffect(() => { setSys([]); setCleared(0); setValue(""); }, [p.title]);

  // "/" or a backtick opens it from anywhere; Escape puts it away.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest?.("input, textarea, select");
      if (e.key === "Escape" && open) { e.preventDefault(); hide(); }
      else if ((e.key === "/" || e.key === "`") && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); show(open ? mode : "normal"); input.current?.focus({ preventScroll: true }); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, p.running]);

  const print = (kind: Sys["kind"], lines: string[]) =>
    setSys((xs) => [...xs, ...lines.map((text) => ({ id: seq.current++, after: p.step, kind, text }))]);

  const submit = (raw: string) => {
    const text = raw.trim();
    if (text) history.current = [...history.current, text];
    cursor.current = -1;
    setValue("");
    const run: Cmd = parse(text) ?? { t: "next", n: 1 };
    const echo = text || "next";
    if (mode === "mini") setMode("normal"); // a command that prints wants somewhere to print
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
    if (e.key === "Escape") return; // handled globally
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
  const atStart = p.step === 0;
  const atEnd = p.frames ? p.step >= total : true;
  const hint = !p.frames ? "following the live gate" : atEnd ? "end of the drill · try reset, back or case <name>" : p.nextLine?.title ?? "next step";
  const stepBy = (cmd: "back" | "next") => { if (p.running) p.onStop(); submitQuiet(cmd); };
  // The pill's arrows move the replay without printing into a console nobody is looking at.
  const submitQuiet = (cmd: "back" | "next") => { const r = parse(cmd)!; const msg = p.onCommand(r); if (msg) setSys((xs) => [...xs, { id: seq.current++, after: p.step, kind: "out", text: msg }]); };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-3 sm:px-8 sm:pb-5">
      <AnimatePresence mode="wait" initial={false}>
        {!open ? (
          <motion.div
            key="pill"
            ref={setShell}
            initial={{ opacity: 0, y: 24, scale: 0.9 }}
            onAnimationStart={() => { if (returnFocus.current) { returnFocus.current = false; pill.current?.focus({ preventScroll: true }); } }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.9 }}
            transition={{ duration: 0.28, ease }}
            className="glass-pill pointer-events-auto flex items-center gap-1 p-1.5"
            style={{ transformOrigin: "50% 100%" }}
          >
            <PillBtn label="Back one step" onClick={() => stepBy("back")} disabled={!p.frames || atStart}><Arrow dir="left" /></PillBtn>
            <button
              ref={pill}
              onClick={() => show("normal")}
              aria-label="Open the console"
              aria-expanded={false}
              className="tap press glass-btn inline-flex h-10 items-center gap-2.5 rounded-full px-4 font-mono text-[14px] font-medium"
            >
              <span className="orb" aria-hidden />
              Console
              {p.frames && <span className="tnum text-[12.5px] text-[var(--fg3)]">{p.step}/{total}</span>}
            </button>
            <PillBtn label="Next step" onClick={() => stepBy("next")} disabled={!p.frames || atEnd}><Arrow dir="right" /></PillBtn>
          </motion.div>
        ) : (
          <motion.div
            key="window"
            ref={setShell}
            role="dialog"
            onAnimationStart={() => input.current?.focus({ preventScroll: true })}
            aria-label="Console"
            initial={{ opacity: 0, y: 36, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 36, scale: 0.94 }}
            transition={{ duration: 0.36, ease }}
            style={{ transformOrigin: "50% 100%" }}
            className="pointer-events-auto relative w-full max-w-[1040px] pt-5"
            onClick={(e) => { if (!(e.target as HTMLElement).closest("button, a")) input.current?.focus({ preventScroll: true }); }}
          >
            {/* A tab that overhangs the window: the size steps, the title, and the fold that puts it away. */}
            <div className="glass-tab absolute left-5 top-0 z-10 flex h-10 max-w-[calc(100%-2.5rem)] items-center gap-3 pl-3.5 pr-2 sm:left-9">
              <Steps mode={mode} onPick={setMode} />
              <span className="min-w-0 truncate font-mono text-[13px] text-[var(--fg2)]">firedrill <span className="text-[var(--fg3)]">~/</span>{p.title}</span>
              <Fold onClick={hide} />
            </div>

            <div className="glass-win overflow-hidden">
            <div className="glass-bar relative flex h-9 items-center justify-end pl-5 pr-10 font-mono text-[12.5px]">
              <span className="hidden truncate text-[var(--fg3)] sm:inline">{p.meta}</span>
            </div>

            <motion.div
              animate={{ height: mode === "mini" ? 0 : heightOf(mode as "normal" | "large"), opacity: mode === "mini" ? 0 : 1 }}
              initial={false}
              transition={spring}
              className="overflow-hidden"
              {...(mode === "mini" ? { inert: true } : {})}
            >
              <div
                ref={log}
                data-lenis-prevent
                role="log"
                aria-live="polite"
                aria-label="Room log"
                tabIndex={0}
                className="term-log h-full overflow-y-auto px-4 py-3 font-mono text-[13px] leading-[1.7] text-[var(--fg)]"
              >
                {floor === 0 && <Intro p={p} />}
                {p.frames && shown.length === 0 && mine.length === 0 && floor === 0 && <div className="text-[var(--fg3)]">{"# nothing has happened yet"}</div>}
                {sysAt(mine, 0)}
                {shown.map((e) => (
                  <div key={e.step}>
                    <Row e={e} />
                    {sysAt(mine, e.step)}
                  </div>
                ))}
                {p.frames && p.step > 0 && shown.length > 0 && (
                  <motion.div key={`n${p.step}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15, duration: 0.4 }} className="text-[var(--fg3)]">
                    <span className="select-none">{"# "}</span>{p.line.title}<span className="hidden sm:inline"> — {p.line.detail}</span>
                  </motion.div>
                )}
                {!p.frames && <div className="text-[var(--fg3)]"><span className="select-none"># </span>{p.line.title} — {p.line.detail}</div>}
              </div>
            </motion.div>

            <div className="glass-bar flex items-center gap-3 border-t pl-5 pr-9 py-2.5 font-mono text-[14px]">
              <span className="select-none text-[var(--t-accent)]" aria-hidden>{p.running ? "…" : "❯"}</span>
              <div className="relative min-w-0 flex-1">
                <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center whitespace-pre text-[var(--fg3)]">
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
                  className="term-input h-8 w-full bg-transparent text-[var(--fg)] outline-none"
                />
              </div>
              <div className="flex shrink-0 items-center gap-1 text-[13px]">
                <Soft label="back" onClick={() => submit("back")} disabled={!p.frames || atStart || p.running} />
                <Soft label="next" kbd="⏎" onClick={() => submit("next")} disabled={!p.frames || atEnd || p.running} primary />
                <Soft label={p.running ? "stop" : "run"} onClick={() => (p.running ? p.onStop() : submit("run"))} disabled={!p.frames || (atEnd && !p.running)} />
              </div>
            </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Three bars of rising height: the size of the console. The bar you are on is lit in colour; press
 * another to change size. The first leaves just the prompt, the last opens the log wide.
 */
function Steps({ mode, onPick }: { mode: Mode; onPick: (m: Mode) => void }) {
  const set: { m: Mode; label: string; h: number }[] = [
    { m: "mini", label: "Prompt only", h: 11 },
    { m: "normal", label: "Normal size", h: 17 },
    { m: "large", label: "Large", h: 24 },
  ];
  return (
    <div role="group" aria-label="Console size" className="flex h-7 items-end gap-1">
      {set.map((x) => {
        const on = mode === x.m;
        return (
          <button key={x.m} onClick={() => onPick(x.m)} aria-pressed={on} aria-label={x.label} title={x.label} className="step grid h-7 w-3 place-items-end">
            <span className={`step-bar block w-2 ${on ? "on" : ""}`} style={{ height: x.h }} />
          </button>
        );
      })}
    </div>
  );
}

/** Puts the console away. A tilted lozenge with a fold mark that opens as you reach for it. */
function Fold({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label="Close the console" title="Close (Esc)" className="fold grid h-8 w-8 place-items-center">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="fold-mark">
        <path d="M5 9l7 7 7-7" />
      </svg>
    </button>
  );
}

function Intro({ p }: { p: Props }) {
  return (
    <div className="mb-1 text-[var(--fg3)]">
      <div><span className="text-[var(--fg2)]">firedrill</span> · {p.frames ? `replaying ${p.title}` : "following the live gate"} · {p.meta}</div>
      <div>Enter runs the next step. <span className="text-[var(--fg2)]">run</span> plays on its own, <span className="text-[var(--fg2)]">help</span> lists the rest.</div>
    </div>
  );
}

function sysAt(xs: Sys[], after: number) {
  return xs.filter((s) => s.after === after).map((s) => (
    <div key={s.id} className={`row-in whitespace-pre-wrap break-words ${s.kind === "err" ? "text-[var(--t-fail)]" : s.kind === "echo" ? "text-[var(--fg)]" : "text-[var(--fg2)]"}`}>
      {s.kind === "echo" && <span className="select-none text-[var(--t-accent)]">❯ </span>}
      {s.text}
    </div>
  ));
}

function Row({ e }: { e: Entry }) {
  return (
    <div className="row-in flex gap-x-3">
      <span className="hidden shrink-0 select-none text-[var(--fg3)] sm:inline">{e.time}</span>
      <span className="w-[7.5rem] shrink-0 truncate sm:w-[10.5rem]" style={{ color: `var(--t-${e.ink})` }}>{e.who}</span>
      <span className="min-w-0 flex-1 truncate" title={e.text}>
        {e.text}
        {e.note && <span className="text-[var(--fg3)]"> · {e.note}</span>}
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
      className={`tap inline-flex h-8 items-center gap-1.5 px-2.5 disabled:cursor-not-allowed disabled:opacity-35 ${primary ? "glass-primary" : "text-[var(--fg2)] hover:bg-[var(--wash)] hover:text-[var(--fg)]"}`}
    >
      {label}
      {kbd && <span className="hidden text-[12px] opacity-70 sm:inline">{kbd}</span>}
    </motion.button>
  );
}

function PillBtn({ children, label, onClick, disabled }: { children: ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      whileTap={disabled ? undefined : { scale: 0.88 }}
      transition={{ type: "spring", stiffness: 600, damping: 18 }}
      className="tap glass-btn grid h-10 w-10 place-items-center rounded-full disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </motion.button>
  );
}

const Arrow = ({ dir }: { dir: "left" | "right" }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={dir === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
  </svg>
);
