// The landing page (#/landing): a front door for people who have never seen FireDrill. Its order
// follows a cinematic landing (a drawn world under the title, a story band with figures, a pinned
// reel of cases, the five steps, a closing word, a footer), built neo-brutalist in the dashboard's
// palette. Every figure is counted from the bundled recordings, and says that they are scripted.
import { AnimatePresence, animate, motion, useInView, useMotionValueEvent, useScroll, useTransform } from "motion/react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Run } from "../fixtures";
import * as I from "../icons";
import { INCIDENTS, replay, type Verdict } from "../model";
import { PAGE_META, PAGES, type Page } from "../pages";
import { INCIDENT_META } from "../views";
import { CourtScene } from "./CourtScene";
import { Cursor, useLandingFx } from "./landingFx";
import { Brand, pageIcon } from "./Shell";
import { Avatar, Headline, INCIDENT_HEX, INCIDENT_ICON, INCIDENT_PLAIN, INK, PAGE_INK, ROLE, type Role } from "./theme";

interface Props {
  runs: Run[];
  onPick: (id: string) => void;
  onOpen: (page: Page) => void;
  onEnter: () => void;
  scrollTo: (id: string) => void;
}

const ease = [0.16, 1, 0.3, 1] as const;
const WHO: Record<Page, Role> = { case: "gate", room: "fixer", attack: "breaker", ruling: "gate", signoff: "approver" };
const NAV = [["story", "Story"], ["cases", "Cases"], ["steps", "Steps"], ["verdict", "Verdict"]] as const;
const RULES = ["No attack, no sign-off", "Fair tests only", "One key to main", "A named human signs"];
const LADDER = ["RED", "GREEN", "SIGNED", "MERGED"];

/** What the bundled recordings add up to: counted, never typed in. */
function useRecord(runs: Run[]) {
  return useMemo(() => {
    const order = (r: Run) => (INCIDENTS as readonly string[]).indexOf(r.incident ?? "");
    const cases = runs
      .filter((r) => r.source === "fixture")
      .sort((a, b) => order(a) - order(b))
      .map((run) => ({ run, s: replay(run.frames, run.frames.length) }));
    const sum = (f: (c: (typeof cases)[number]) => number) => cases.reduce((n, c) => n + f(c), 0);
    return {
      cases,
      drills: cases.length,
      tests: sum((c) => c.s.verdicts.reduce((n, v) => n + v.checks.length, 0)),
      attacks: sum((c) => c.s.attacks.length),
      merges: sum((c) => c.s.verdicts.filter((v) => v.merged).length),
    };
  }, [runs]);
}

export const LANDING_BOARD = { board: INK.cream, on: INK.forest };

let curtainDone = false;

export function Landing(p: Props) {
  const rec = useRecord(p.runs);
  const first = rec.cases[0]?.run;
  const watch = () => first && p.onPick(first.id);
  const root = useRef<HTMLDivElement>(null);
  useLandingFx(root);
  return (
    <div id="top" ref={root} className="relative z-10 overflow-x-clip bg-cream text-forest">
      <Cursor />
      <Curtain />
      <Nav onTop={() => p.scrollTo("top")} scrollTo={p.scrollTo} onEnter={p.onEnter} />
      <Hero onWatch={watch} onHow={() => p.scrollTo("story")} first={rec.cases[0]} />
      <Story rec={rec} onWatch={watch} />
      <Bands />
      <Cases cases={rec.cases} onPick={p.onPick} />
      <Steps onOpen={p.onOpen} />
      <Verdict onEnter={p.onEnter} onWatch={watch} />
      <Footer cases={rec.cases.map((c) => c.run)} onPick={p.onPick} onOpen={p.onOpen} onEnter={p.onEnter} />
    </div>
  );
}

/** The opening curtain: it lifts as soon as the type has loaded, once per visit. */
function Curtain() {
  const [up, setUp] = useState(curtainDone || matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    if (up) return;
    let alive = true;
    const t0 = performance.now();
    document.fonts.ready.then(() => {
      window.setTimeout(() => { if (alive) { curtainDone = true; setUp(true); } }, Math.max(0, 900 - (performance.now() - t0)));
    });
    return () => { alive = false; };
  }, [up]);
  return (
    <AnimatePresence>
      {!up && (
        <motion.div
          key="curtain"
          exit={{ y: "-100%" }}
          transition={{ duration: 0.9, ease }}
          className="fixed inset-0 z-[80] grid place-items-center bg-forest text-cream"
        >
          <div className="flex flex-col items-center gap-5">
            <motion.span initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 300, damping: 14 }} className="grid h-20 w-20 place-items-center rounded-full border-[3px] border-cream bg-lime text-forest">
              <I.Flame size={38} />
            </motion.span>
            <span className="label text-cream/80">Convening the court</span>
            <span className="relative h-[3px] w-48 overflow-hidden bg-cream/20">
              <motion.span initial={{ x: "-100%" }} animate={{ x: "0%" }} transition={{ duration: 0.9, ease }} className="absolute inset-0 bg-lime" />
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Nav({ onTop, scrollTo, onEnter }: { onTop: () => void; scrollTo: (id: string) => void; onEnter: () => void }) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-5">
      <nav aria-label="Landing" className="nb mx-auto flex h-16 max-w-[1400px] items-center gap-3 rounded-full bg-cream pl-2.5 pr-2 sm:pl-3">
        <Brand onHome={onTop} light />
        <span className="label ml-1 hidden text-forest/65 xl:block">Adversarial hotfix courtroom</span>
        <ul className="ml-auto hidden items-center gap-1 md:flex">
          {NAV.map(([id, label]) => (
            <li key={id}>
              <button onClick={() => scrollTo(id)} className="tap rounded-full px-4 py-2 text-[15px] font-semibold hover:bg-forest/10">{label}</button>
            </li>
          ))}
        </ul>
        <span data-magnet className="ml-auto inline-block md:ml-2">
          <button onClick={onEnter} className="tap nb-btn inline-flex h-11 items-center gap-2 rounded-full bg-lime px-4 text-[15px] font-bold sm:px-5">
            <span className="sm:hidden">Open</span><span className="hidden sm:inline">Open the courtroom</span> <I.Chevron size={16} />
          </button>
        </span>
      </nav>
    </header>
  );
}

function Tag({ children, hex = INK.cream, className = "" }: { children: ReactNode; hex?: string; className?: string }) {
  return (
    <span className={`label inline-flex items-center gap-2 rounded-full border-[2.5px] border-forest px-3.5 py-1.5 text-forest ${className}`} style={{ background: hex }}>
      {children}
    </span>
  );
}

function Hero({ onWatch, onHow, first }: { onWatch: () => void; onHow: () => void; first?: { run: Run; s: ReturnType<typeof replay> } }) {
  return (
    <section className="relative isolate flex h-[100svh] min-h-[680px] flex-col overflow-hidden bg-sky" aria-label="Introduction">
      <CourtScene />
      <div data-gsap="hero-copy" className="relative mx-auto w-full max-w-[1440px] px-4 pt-24 sm:px-8">
        <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6, ease, delay: 0.2 }}>
          <Tag><span className="h-2.5 w-2.5 rounded-full border-2 border-forest bg-rose" />Step 00 · The gate is open</Tag>
        </motion.div>
        <Headline as="h1" text="Put the hotfix on trial." duration={1.1} className="mt-4 max-w-[9.5ch] text-[clamp(46px,min(12vw,8.5svh),60px)] sm:text-[clamp(56px,min(9vw,10.5svh),104px)]" />
        <motion.p initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6, ease, delay: 0.45 }} className="mt-4 max-w-[40ch] text-[16px] font-medium leading-relaxed sm:text-[18px] 2xl:text-[19px]">
          One agent writes the fix. Another attacks it. A referee runs real tests, and nothing reaches main until the fix survives and a named human signs.
        </motion.p>
        <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6, ease, delay: 0.6 }} className="mt-6 flex flex-wrap gap-3">
          <span data-magnet className="inline-block">
            <button onClick={onWatch} className="tap nb-btn inline-flex h-14 items-center gap-3 rounded-full bg-lime pl-6 pr-2 text-[17px] font-bold">
              Watch a drill <span className="grid h-10 w-10 place-items-center rounded-full bg-forest text-lime"><I.Play size={16} className="translate-x-[1px]" /></span>
            </button>
          </span>
          <button onClick={onHow} className="tap nb-btn hidden h-14 items-center rounded-full bg-cream px-6 text-[17px] font-bold sm:inline-flex">How it works</button>
        </motion.div>
      </div>

      <div className="vtext label pointer-events-none absolute right-6 top-32 hidden text-forest/80 lg:block">No attack · no sign-off</div>

      {first && (
        <motion.div initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.7, ease, delay: 0.9 }} className="absolute bottom-32 right-8 hidden xl:block">
        <button
          onClick={onWatch}
          className="tap nb-btn flex w-[290px] items-center gap-4 rounded-[20px] bg-cream p-3 text-left"
        >
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-[14px] border-[3px] border-forest text-forest" style={{ background: INCIDENT_HEX[first.run.incident ?? ""] }}>{INCIDENT_ICON[first.run.incident ?? ""]?.(26)}</span>
          <span className="min-w-0">
            <span className="label block text-forest/60">Now showing · scripted</span>
            <span className="serif mt-1 block text-[24px]">{INCIDENT_META[first.run.incident ?? ""]?.label ?? first.run.title}</span>
            <span className="block text-[13px] font-medium text-forest/70">{first.run.frames.length} moments · tap to play</span>
          </span>
        </button>
        </motion.div>
      )}

      <div className="relative mt-auto mx-auto flex w-full max-w-[1440px] items-end gap-6 px-4 pb-5 text-cream sm:px-8 sm:pb-7">
        <span className="label hidden items-center gap-3 sm:flex">Scroll to enter <motion.span animate={{ scaleX: [0.3, 1, 0.3] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }} className="h-[2px] w-12 origin-left bg-cream" /></span>
        <ol className="ml-auto flex gap-4 sm:gap-8">
          {PAGES.map((pg, i) => (
            <li key={pg} className="flex flex-col">
              <span className="display text-[30px] sm:text-[40px]">0{i + 1}</span>
              <span className="mt-1 h-[3px] w-full rounded-full" style={{ background: PAGE_INK[pg].board === INK.forest ? INK.lime : PAGE_INK[pg].board }} />
              <span className="label mt-2 hidden text-cream/75 md:block">{PAGE_META[pg].short}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** A number that counts up the first time it scrolls into view. */
function Count({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true, margin: "-80px" });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!seen) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setN(to); return; }
    const c = animate(0, to, { duration: 1.4, ease, onUpdate: (v) => setN(Math.round(v)) });
    return () => c.stop();
  }, [seen, to]);
  return <span ref={ref} className="tnum">{n}</span>;
}

const rise = (i = 0) => ({ initial: { y: 40, opacity: 0 }, whileInView: { y: 0, opacity: 1 }, viewport: { once: true, margin: "-60px" }, transition: { duration: 0.7, ease, delay: i * 0.08 } });

function Story({ rec, onWatch }: { rec: ReturnType<typeof useRecord>; onWatch: () => void }) {
  const stats = [
    { n: rec.drills, label: "Recorded drills", hex: INK.lime },
    { n: rec.tests, label: "Test runs by the gate", hex: INK.sky },
    { n: rec.attacks, label: "Attacks filed", hex: INK.rose },
    { n: rec.merges, label: "Merges to main", hex: INK.lilac },
  ];
  return (
    <section id="story" className="dots relative scroll-mt-24 bg-cream" aria-labelledby="story-h">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-4 py-24 sm:px-8 sm:py-32 lg:grid-cols-12">
        <motion.div {...rise()} className="lg:col-span-6">
          <Tag hex={INK.lime}>Why FireDrill</Tag>
          <span id="story-h"><Headline as="h2" text="A patch, a hostile test, one gate left open." className="mt-6 max-w-[14ch] text-[48px] sm:text-[76px]" /></span>
        </motion.div>
        <motion.div {...rise(1)} className="space-y-5 text-[18px] leading-relaxed lg:col-span-5 lg:col-start-8 lg:pt-16">
          <p data-gsap="lines">FireDrill begins where an incident begins: a bug in production. In a shared Switch room, a fixer agent submits a patch, and a breaker agent writes hostile tests aimed straight at it.</p>
          <p data-gsap="lines" className="text-forest/80">The gate is the referee. It runs every test for real in a fresh workspace, throws out attacks that are unfair, and holds the only key to main. A human signs off by their Switch participant id, not by what they type, and only after the patch has survived.</p>
          <span data-magnet className="mt-3 inline-block">
            <button onClick={onWatch} className="tap nb-btn inline-flex h-14 items-center gap-3 rounded-full bg-forest px-6 text-[17px] font-bold text-cream">
              Cross the threshold <I.Chevron size={18} />
            </button>
          </span>
        </motion.div>

        <motion.div {...rise(2)} className="lg:col-span-12">
          <dl className="nb-lg grid grid-cols-2 overflow-hidden rounded-[26px] bg-cream lg:grid-cols-4">
            {stats.map((s, i) => (
              <div key={s.label} className={`relative p-6 sm:p-8 ${i % 2 ? "border-l-[3px] border-forest" : ""} ${i >= 2 ? "border-t-[3px] border-forest lg:border-t-0" : ""} ${i === 2 ? "lg:border-l-[3px]" : ""}`}>
                <span className="absolute right-5 top-5 h-5 w-5 rounded-full border-[3px] border-forest" style={{ background: s.hex }} />
                <dd className="display text-[64px] sm:text-[96px]"><Count to={s.n} /></dd>
                <dt className="label mt-3 text-forest/75">{s.label}</dt>
              </div>
            ))}
          </dl>
          <p className="mt-5 max-w-[80ch] text-[14px] leading-relaxed text-forest/70">
            Counted from the three drills bundled with FireDrill. They are scripted replays: the Switch room is a recording and the fixer, breaker and approver are scripted participants. The gate's pytest runs and the merge through the gate-key hook were real.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

/** Two crossing tickers: the rules in serif on lime, the ladder in mono on rose. */
function Bands() {
  const row = (items: string[], cls: string) => (
    <div className={`marquee flex w-max ${cls}`}>
      {[0, 1].map((k) => (
        <span key={k} className="flex shrink-0" aria-hidden={k === 1}>
          {[...items, ...items].map((t, i) => <span key={i} className="flex items-center gap-6 px-6">{t}<span className="text-[0.7em]">✦</span></span>)}
        </span>
      ))}
    </div>
  );
  return (
    <section aria-label="The rules" className="relative overflow-hidden bg-cream py-16 sm:py-20">
      <div data-gsap="band" className="relative -mx-[10vw] rotate-[2deg] border-y-[3px] border-forest bg-rose py-3 font-mono text-[18px] font-bold uppercase tracking-[0.12em] sm:text-[20px]">
        {row(LADDER, "rev")}
      </div>
      <div data-gsap="band" className="relative -mx-[10vw] -mt-3 -rotate-[2deg] border-y-[3px] border-forest bg-lime py-4 shadow-[0_8px_0_var(--color-forest)]">
        <div className="display text-[38px] italic sm:text-[54px]">{row(RULES, "")}</div>
      </div>
    </section>
  );
}

function useWide(q = "(min-width: 1024px)") {
  const [on, setOn] = useState(() => matchMedia(q).matches);
  useEffect(() => {
    const m = matchMedia(q);
    const f = () => setOn(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, [q]);
  return on;
}

type CaseItem = { run: Run; s: ReturnType<typeof replay> };

/** The cases as a reel: on wide screens the section pins and the cards slide past as you scroll. */
function Cases({ cases, onPick }: { cases: CaseItem[]; onPick: (id: string) => void }) {
  const wide = useWide();
  const ref = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [dist, setDist] = useState(0);
  const [at, setAt] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const x = useTransform(scrollYProgress, [0.08, 0.92], [0, -dist], { clamp: true });
  useMotionValueEvent(scrollYProgress, "change", (v) => setAt(Math.min(cases.length - 1, Math.max(0, Math.floor(v * cases.length)))));
  useEffect(() => {
    const t = track.current;
    if (!t || !wide) return;
    const ro = new ResizeObserver(() => setDist(Math.max(0, t.scrollWidth - window.innerWidth)));
    ro.observe(t);
    return () => ro.disconnect();
  }, [wide]);

  const head = (
    <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-end gap-6 px-4 sm:px-8">
      <div className="min-w-0 flex-1">
        <Tag hex={INK.lilac}>Scripted replays · real verifier</Tag>
        <span id="cases-h"><Headline as="h2" text="Three bugs. Three trials." className="mt-5 text-[48px] text-cream sm:text-[76px]" /></span>
      </div>
      {wide && <div className="display text-[44px] text-cream"><span className="text-lime">0{at + 1}</span> / 0{cases.length}</div>}
    </div>
  );

  if (!wide) {
    return (
      <section id="cases" ref={ref} className="dots-light scroll-mt-24 bg-forest py-24" aria-labelledby="cases-h">
        {head}
        <div className="mx-auto mt-12 grid max-w-[1440px] gap-8 px-4 sm:px-8">
          {cases.map((c, i) => <motion.div key={c.run.id} {...rise(i)}><CaseCard c={c} onPick={onPick} /></motion.div>)}
        </div>
      </section>
    );
  }
  return (
    <section id="cases" ref={ref} className="relative bg-forest" style={{ height: `${cases.length * 100 + 40}vh` }} aria-labelledby="cases-h">
      <div className="dots-light sticky top-0 flex h-screen flex-col justify-center gap-10 overflow-hidden pt-20">
        {head}
        <motion.div ref={track} style={{ x }} className="flex w-max gap-10 pl-[max(32px,calc((100vw-1440px)/2+32px))] pr-[12vw]">
          {cases.map((c) => <div key={c.run.id} className="w-[min(72vw,900px)] shrink-0"><CaseCard c={c} onPick={onPick} /></div>)}
        </motion.div>
      </div>
    </section>
  );
}

function verdictChips(vs: Verdict[]) {
  return vs.flatMap((v) => {
    const out: { k: string; hex: string; text: string; icon: ReactNode }[] = [{ k: v.id, hex: v.result === "GREEN" ? INK.jade : v.result === "RED" ? INK.scarlet : INK.sky, text: v.result, icon: v.result === "GREEN" ? <I.Check size={14} /> : v.result === "RED" ? <I.Cross size={14} /> : <I.Sparkle size={14} /> }];
    if (v.merged) out.push({ k: `${v.id}-m`, hex: INK.lime, text: "MERGED", icon: <I.Merge size={14} /> });
    return out;
  });
}

function CaseCard({ c, onPick }: { c: CaseItem; onPick: (id: string) => void }) {
  const inc = c.run.incident ?? "";
  const hex = INCIDENT_HEX[inc] ?? INK.cream;
  const tests = c.s.verdicts.reduce((n, v) => n + v.checks.length, 0);
  return (
    <motion.article whileHover={{ rotate: -0.6, y: -6 }} transition={{ type: "spring", stiffness: 260, damping: 18 }} className="nb-lg nb-on-dark flex min-h-[460px] flex-col rounded-[28px] p-6 text-forest sm:p-9 lg:h-[min(62vh,560px)]" style={{ background: hex }}>
      <div className="flex items-start justify-between gap-4">
        <span className="grid h-16 w-16 place-items-center rounded-full border-[3px] border-forest bg-forest" style={{ color: hex }}>{INCIDENT_ICON[inc]?.(28)}</span>
        <span className="display text-[64px] italic leading-none sm:text-[88px]">{INCIDENT_META[inc]?.n}</span>
      </div>
      <h3 className="serif mt-auto text-[44px] leading-[0.95] sm:text-[64px]">{INCIDENT_META[inc]?.label ?? c.run.title}</h3>
      <p className="mt-3 text-[18px] font-medium sm:text-[21px]">{INCIDENT_PLAIN[inc]}.</p>
      <div className="mt-6">
        <span className="label text-forest/70">How it went</span>
        <ol className="mt-2 flex flex-wrap items-center gap-2">
          {verdictChips(c.s.verdicts).map((v, i) => (
            <li key={v.k} className="flex items-center gap-2">
              {i > 0 && <I.Chevron size={14} className="text-forest/60" />}
              <span className="inline-flex h-9 items-center gap-1.5 rounded-full border-[2.5px] border-forest bg-forest px-3 font-mono text-[13px] font-bold text-cream">
                <span className="grid h-5 w-5 place-items-center rounded-full text-forest" style={{ background: v.hex }}>{v.icon}</span>{v.text}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3 border-t-[3px] border-forest/25 pt-5 text-[15px] font-semibold">
        <span>{c.run.frames.length} moments</span><span aria-hidden>·</span><span>{tests} test runs</span><span aria-hidden>·</span><span>{c.s.attacks.length} {c.s.attacks.length === 1 ? "attack" : "attacks"}</span>
        <button onClick={() => onPick(c.run.id)} className="tap nb-btn ml-auto inline-flex h-12 items-center gap-2 rounded-full bg-forest px-5 text-[16px] font-bold text-cream">
          Watch this drill <I.Play size={14} />
        </button>
      </div>
    </motion.article>
  );
}

function Steps({ onOpen }: { onOpen: (p: Page) => void }) {
  return (
    <section id="steps" className="dots scroll-mt-24 bg-lilac" aria-labelledby="steps-h">
      <div className="mx-auto max-w-[1440px] px-4 py-24 sm:px-8 sm:py-32">
        <Tag hex={INK.cream}>How a drill runs</Tag>
        <span id="steps-h"><Headline as="h2" text="Five steps. One gate. Zero shortcuts." className="mt-6 max-w-[16ch] text-[48px] sm:text-[76px]" /></span>
        <ol className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {PAGES.map((pg, i) => {
            const ink = PAGE_INK[pg];
            const who = ROLE[WHO[pg]];
            return (
              <motion.li key={pg} {...rise(i)}>
                <motion.button
                  whileHover={{ y: -8, rotate: i % 2 ? 1.2 : -1.2 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onOpen(pg)}
                  className="tap nb-lg flex h-full min-h-[330px] w-full flex-col rounded-[24px] p-6 text-left"
                  style={{ background: ink.board, color: ink.on }}
                >
                  <span className="flex w-full items-start justify-between">
                    <span className="grid h-12 w-12 place-items-center rounded-full border-[3px]" style={{ borderColor: ink.on }}>{pageIcon(pg, 22)}</span>
                    <span className="display text-[56px] italic leading-none">0{i + 1}</span>
                  </span>
                  <span className="serif mt-auto block text-[34px]">{PAGE_META[pg].label}</span>
                  <span className="mt-2 block text-[16px] leading-snug opacity-85">{PAGE_META[pg].plain}.</span>
                  <span className="mt-5 flex items-center gap-2 border-t-[2.5px] pt-4 text-[14px] font-semibold" style={{ borderColor: ink.on === INK.cream ? "rgb(243 238 223 / .3)" : "rgb(15 42 29 / .25)" }}>
                    <Avatar role={WHO[pg]} size={28} /> {who.name} acts
                    <I.Chevron size={16} className="ml-auto" />
                  </span>
                </motion.button>
              </motion.li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function Verdict({ onEnter, onWatch }: { onEnter: () => void; onWatch: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["18%", "-18%"]);
  return (
    <section id="verdict" ref={ref} className="dots-light relative scroll-mt-24 overflow-hidden bg-forest text-cream" aria-labelledby="verdict-h">
      <motion.div style={{ y }} aria-hidden className="vtext display outline-text pointer-events-none absolute -right-4 top-0 hidden select-none text-[200px] leading-none md:block xl:text-[260px]">
        Merged
      </motion.div>
      <div className="relative mx-auto max-w-[1440px] px-4 py-28 sm:px-8 sm:py-40">
        <motion.div {...rise()} className="max-w-[760px]">
          <Tag hex={INK.lime}>Step 05 · The verdict</Tag>
          <span id="verdict-h"><Headline as="h2" text="Nothing merges until it survives." className="mt-6 max-w-[12ch] text-[52px] sm:text-[92px]" /></span>
          <p data-gsap="lines" className="mt-7 max-w-[46ch] text-[18px] leading-relaxed text-on2 sm:text-[20px]">
            When the patch is GREEN after an attack and a named approver signs, the gate merges it with its own key. Every move stays in the room, ready to replay.
          </p>
          <div className="mt-9 flex flex-wrap gap-4">
            <span data-magnet className="inline-block"><button onClick={onEnter} className="tap nb-btn on-dark inline-flex h-14 items-center gap-3 rounded-full bg-lime px-7 text-[17px] font-bold text-forest">Open the courtroom <I.Chevron size={18} /></button></span>
            <span data-magnet className="inline-block"><button onClick={onWatch} className="tap nb-btn on-dark inline-flex h-14 items-center gap-3 rounded-full bg-cream px-7 text-[17px] font-bold text-forest">Watch a drill <I.Play size={14} /></button></span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Footer({ cases, onPick, onOpen, onEnter }: { cases: Run[]; onPick: (id: string) => void; onOpen: (p: Page) => void; onEnter: () => void }) {
  const link = "text-left text-[16px] font-medium underline-offset-4 hover:underline";
  return (
    <footer className="border-t-[3px] border-forest bg-cream">
      <div className="mx-auto grid max-w-[1440px] gap-12 px-4 py-16 sm:px-8 lg:grid-cols-12">
        <div className="flex items-start gap-4 lg:col-span-5">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full border-[3px] border-forest bg-lime"><I.Flame size={26} /></span>
          <p className="serif text-[28px] leading-[1.1] sm:text-[32px]">An adversarial hotfix courtroom. Two agents argue in a Switch room, a deterministic gate decides, and a named human signs.</p>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-6 lg:col-start-7">
          <div>
            <h3 className="label mb-4 text-forest/60">Steps</h3>
            <ul className="space-y-2.5">{PAGES.map((pg) => <li key={pg}><button onClick={() => onOpen(pg)} className={link}>{PAGE_META[pg].label}</button></li>)}</ul>
          </div>
          <div>
            <h3 className="label mb-4 text-forest/60">Cases</h3>
            <ul className="space-y-2.5">{cases.map((r) => <li key={r.id}><button onClick={() => onPick(r.id)} className={link}>{INCIDENT_META[r.incident ?? ""]?.label ?? r.title}</button></li>)}</ul>
          </div>
          <div>
            <h3 className="label mb-4 text-forest/60">Elsewhere</h3>
            <ul className="space-y-2.5">
              <li><button onClick={onEnter} className={link}>The courtroom</button></li>
              <li><a href="https://github.com/ElaraLarsen/FireDrill" target="_blank" rel="noreferrer" className={link}>Source on GitHub</a></li>
              <li><a href="https://docs.switchagents.ai" target="_blank" rel="noreferrer" className={link}>Switch docs</a></li>
            </ul>
          </div>
        </div>
      </div>
      <div className="overflow-hidden border-t-[3px] border-forest">
        <div data-gsap="chars" aria-hidden className="display select-none px-4 pb-3 pt-8 text-center text-[21vw] leading-[0.82] [text-shadow:0.035em_0.035em_0_var(--color-lime)] sm:px-8">
          Fire<em>Drill</em>
        </div>
      </div>
      <div className="border-t-[3px] border-forest">
        <div className="label mx-auto flex max-w-[1440px] flex-wrap justify-between gap-3 px-4 py-5 text-forest/70 sm:px-8">
          <span>© 2026 FireDrill · Flip the Switch hackathon</span>
          <span>Instrument Serif · Bricolage Grotesque · Built on Switch</span>
        </div>
      </div>
    </footer>
  );
}
