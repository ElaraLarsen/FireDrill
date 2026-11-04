// Page 4: the ruling. The gate's seal over a chrome field poured in the verdict's ink, and every real test it ran.
import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";
import { confetti } from "../fx";
import * as I from "../icons";
import { latest, short, stamp, type Check, type State, type Verdict as V } from "../model";
import { failedAgainstFix, groupChecks, testName } from "../views";
import { LiquidChrome } from "./LiquidChrome";
import { Chip, Empty, INK, PageTitle, Panel } from "./theme";

export const SEAL: Record<string, { hex: string; word: string; plain: string; icon: ReactNode }> = {
  idle: { hex: INK.stone, word: "NO CASE", plain: "Waiting for the first patch.", icon: <I.Gavel size={40} /> },
  pending: { hex: INK.sky, word: "TESTING", plain: "The gate is running real tests.", icon: <I.Sparkle size={40} /> },
  red: { hex: INK.scarlet, word: "RED", plain: "Broken by the red team.", icon: <I.Cross size={42} /> },
  green: { hex: INK.jade, word: "GREEN", plain: "Survived every attack.", icon: <I.Shield size={40} /> },
  merged: { hex: INK.lime, word: "MERGED", plain: "Signed off and merged to main.", icon: <I.Merge size={40} /> },
  error: { hex: INK.rose, word: "ERROR", plain: "The gate hit a problem. Nothing merges.", icon: <I.Info size={40} /> },
};

export function sealKey(s: State): string {
  const st = stamp(s);
  return st.label === "GREEN ON REPRO ONLY — NO ATTACK YET" ? "pending" : st.tone;
}

function Seal({ s, v }: { s: State; v: V | undefined }) {
  const st = stamp(s);
  const [wig, setWig] = useState(0);
  const key = sealKey(s);
  const look = SEAL[key];
  const f = failedAgainstFix(v);
  const pct = f && f.total ? ((f.total - f.failed) / f.total) * 100 : v?.result === "PENDING" ? 0 : 100;
  const repro = st.label.startsWith("GREEN ON REPRO");
  return (
    <div className="relative isolate overflow-hidden rounded-[28px] outline outline-1 -outline-offset-1 outline-cream/20">
      <div className="absolute inset-0 -z-10"><LiquidChrome color={look.hex} depth={0.17} speed={key === "pending" ? 0.4 : 0.2} /></div>
      <div className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:items-end sm:gap-10 sm:p-10">
        <motion.button
          key={`${v?.id}-${st.label}`}
          initial={{ scale: 1.8, rotate: -25, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 14 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.9, rotate: -6 }}
          onClick={() => { setWig((n) => n + 1); if (key === "green" || key === "merged") confetti(70); }}
          aria-label={`The seal: ${look.word}. Tap it.`}
          className={`relative grid h-[210px] w-[210px] shrink-0 place-items-center rounded-full ${key === "pending" ? "pingring text-sky" : ""}`}
        >
          <svg className={`absolute inset-0 ${key === "pending" ? "spin-slow" : ""}`} viewBox="0 0 200 200" aria-hidden>
            <circle cx="100" cy="100" r="92" fill="none" stroke={INK.forest} strokeWidth="14" />
            <motion.circle
              cx="100" cy="100" r="92" fill="none" stroke={look.hex} strokeWidth="14"
              transform="rotate(-90 100 100)"
              initial={{ pathLength: 0 }} animate={{ pathLength: pct / 100 }} transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
            />
          </svg>
          <motion.span
            key={wig}
            animate={wig ? { rotate: [0, -10, 8, -5, 3, 0] } : undefined}
            transition={{ duration: 0.6 }}
            className="grid h-[156px] w-[156px] place-items-center rounded-full text-forest"
            style={{ background: look.hex }}
          >
            <span className="flex flex-col items-center">
              {look.icon}
              <span className="serif mt-1.5 text-[18px] tracking-[0.06em]">{repro ? "REPRO OK" : look.word}</span>
            </span>
          </motion.span>
        </motion.button>
        <div className="min-w-0 rounded-[22px] bg-forest/90 p-5 text-center backdrop-blur-sm sm:p-7 sm:text-left">
          <div className="text-[15px] font-bold uppercase text-on3">{v ? `Ruling ${v.id}` : "The ruling"}</div>
          <AnimatePresence mode="wait">
            <motion.div key={st.label} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} className="display mt-2 text-[44px] sm:text-[64px]" style={{ color: look.hex }}>
              {/* The gate shouts its verdict in capitals; the seal says it in a sentence. */}
              {st.label.charAt(0) + st.label.slice(1).toLowerCase()}
            </motion.div>
          </AnimatePresence>
          <div className="mt-3 text-[18px] font-medium text-on2">{repro ? "It fixes the bug, but nobody has attacked it yet." : look.plain}</div>
          <div className="mt-4 flex flex-wrap justify-center gap-1.5 sm:justify-start">
            {v?.merged && <Chip hex={INK.jade}><I.Key size={15} /> Gate key verified · main <span className="font-mono">{short(v.merged.main_sha)}</span></Chip>}
            {st.tone === "red" && f && f.failed > 0 && (
              <>
                <Chip hex={INK.scarlet}>{f.failed} of {f.total} failed</Chip>
                {f.names.slice(0, 2).map((n) => <Chip key={n} hex={INK.scarlet} mono className="max-w-[260px] truncate">{n}</Chip>)}
              </>
            )}
            {f && f.total > 0 && st.tone !== "red" && v?.result !== "PENDING" && <Chip hex={INK.jade}>{f.total - f.failed} of {f.total} passed</Chip>}
          </div>
          {v?.result === "PENDING" && <div className="shimmer mt-4 h-3 w-56 bg-sky/40" />}
        </div>
      </div>
    </div>
  );
}

function CheckRow({ c, max, index }: { c: Check; max: number; index: number }) {
  const ok = c.status === "pass";
  const w = Math.max(6, ((c.duration_ms ?? 0) / max) * 100);
  const [open, setOpen] = useState(false);
  return (
    <motion.li initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: index * 0.05, duration: 0.35 }}>
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="tap press flex w-full items-center gap-4 px-3 py-3 text-left hover:bg-p3">
        <motion.span
          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 14, delay: 0.1 + index * 0.05 }}
          className={`grid h-10 w-10 shrink-0 place-items-center text-forest ${ok ? "bg-jade" : "bg-scarlet"}`}
        >
          {ok ? <I.Check size={20} /> : <I.Cross size={18} />}
        </motion.span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-mono text-[14.5px] font-bold text-on" title={c.name}>{testName(c.name)}</span>
            {c.kind === "attack" && <span className="shrink-0 bg-rose px-2 py-0.5 text-[12px] font-semibold text-forest">attack</span>}
          </span>
          <span className="mt-1.5 block h-2 overflow-hidden bg-p3">
            <motion.span initial={{ width: 0 }} animate={{ width: `${w}%` }} transition={{ duration: 0.7, delay: 0.15 + index * 0.05, ease: "easeOut" }} className={`block h-full ${ok ? "bg-jade" : "bg-scarlet"}`} />
          </span>
        </span>
        <span className="tnum shrink-0 font-mono text-[14px] text-on2">{c.duration_ms ?? "—"} ms</span>
        <I.Chevron size={16} className={`shrink-0 text-on3 transition-transform duration-300 ${open ? "rotate-90" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.pre initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <span data-lenis-prevent className="mx-3 mb-3 block max-h-60 overflow-auto whitespace-pre-wrap bg-forest p-3 font-mono text-[12.5px] leading-relaxed text-on2">{c.output_tail?.trim() || "(no output captured)"}</span>
          </motion.pre>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

function Group({ title, hint, checks, delay }: { title: string; hint: string; checks: Check[]; delay: number }) {
  if (!checks.length) return null;
  const max = Math.max(...checks.map((c) => c.duration_ms ?? 0), 1);
  const passed = checks.filter((c) => c.status === "pass").length;
  return (
    <Panel title={title} hint={hint} delay={delay} right={<Chip hex={passed === checks.length ? INK.jade : INK.scarlet}>{passed}/{checks.length} pass</Chip>} className="outline outline-2 -outline-offset-2 outline-p3">
      <ul className="space-y-0.5 bg-p2 p-1.5">{checks.map((c, i) => <CheckRow key={`${c.name}-${c.against}-${i}`} c={c} max={max} index={i} />)}</ul>
    </Panel>
  );
}

export function RulingPage({ s }: { s: State }) {
  const v = latest(s.verdicts);
  const g = groupChecks(v);
  return (
    <div className="space-y-4">
      <PageTitle
        title="The gate rules"
        lead="Real tests, in a fresh workspace, with no shortcuts. Nothing merges until the patch is GREEN after an attack."
      />
      <div className="pt-4"><Seal s={s} v={v} /></div>
      {v ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Group title="Is each attack fair?" hint="Rule R3: run on the gate's own correct fix." checks={g.reference} delay={0.1} />
          <Group title="Does the patch hold?" hint="The bug test, every fair attack and the safety rule." checks={g.fix} delay={0.18} />
          {v.notes.map((n, i) => <div key={i} className="text-[15px] text-sage lg:col-span-2">note: {n}</div>)}
        </div>
      ) : (
        <Empty>The gate's tests appear here, one by one, as they run.</Empty>
      )}
    </div>
  );
}
