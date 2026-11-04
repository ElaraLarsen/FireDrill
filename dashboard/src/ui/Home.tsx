// The first page: a liquid field under the serif title that turns slowly through the four hues, then
// the three cases and the five steps. Pointing at a case pours that case's colour.
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import type { Run } from "../fixtures";
import * as I from "../icons";
import { INCIDENTS } from "../model";
import { PAGE_META, PAGES } from "../pages";
import { INCIDENT_META } from "../views";
import { LiquidChrome } from "./LiquidChrome";
import { Brand, pageIcon } from "./Shell";
import { Headline, INCIDENT_HEX, INCIDENT_ICON, INCIDENT_PLAIN, INK, PAGE_INK } from "./theme";

interface Props {
  runFor: (incident: string) => Run | undefined;
  onPick: (id: string) => void;
  onHome: () => void;
  link: string;
  onLive?: () => void;
}

const ease = [0.16, 1, 0.3, 1] as const;
const TIME: Record<string, string> = { case: "Step one", room: "Step two", attack: "Step three", ruling: "Step four", signoff: "Step five" };
const FACTS = ["Every test runs for real", "An attack before any sign-off", "Only the gate can merge"];
const FACT_HEX = [INK.sky, INK.tangerine, INK.lilac];
const CYCLE = [INK.lime, INK.sky, INK.lilac, INK.tangerine];

export function Home(p: Props) {
  const [pour, setPour] = useState<string | null>(null);
  const [turn, setTurn] = useState(0);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setTurn((t) => (t + 1) % CYCLE.length), 4500);
    return () => window.clearInterval(id);
  }, []);
  const hue = pour ?? CYCLE[turn];
  return (
    <div className="relative z-10">
      <section className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-forest text-cream" aria-label="Introduction">
        <div className="absolute inset-0 -z-10"><LiquidChrome color={hue} depth={pour ? 0.14 : 0.115} /></div>
        {/* Forest settles at the top and bottom edges so the words always sit on dark ground. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(15_42_29/.78)_0%,rgb(15_42_29/0)_22%,rgb(15_42_29/0)_36%,rgb(15_42_29/.82)_100%)]" />
        <div className="mx-auto flex w-full max-w-[1440px] items-center gap-4 px-4 pt-5 sm:px-8">
          <Brand onHome={p.onHome} />
          <ul className="label ml-6 hidden gap-6 text-cream/80 lg:flex">
            {FACTS.map((f, i) => <li key={f}><span className="tnum mr-2 font-mono" style={{ color: FACT_HEX[i] }}>0{i + 1}</span>{f}</li>)}
          </ul>
          {p.onLive && (
            <button onClick={p.onLive} className="tap press ml-auto inline-flex h-12 items-center gap-2 rounded-full bg-cream px-5 text-[15px] font-semibold text-forest">
              <span className="blink h-2.5 w-2.5 bg-jade" /> Follow the live gate
            </button>
          )}
        </div>
        <div className="mx-auto mt-auto w-full max-w-[1440px] px-4 pb-14 sm:px-8 sm:pb-20">
          <div className="label mb-5 flex items-center gap-3 text-cream/85"><span className="h-px w-10 bg-cream/60" />An adversarial hotfix courtroom</div>
          <Headline as="h1" text="Put the hotfix on trial." duration={1.1} className="max-w-[12ch] text-[64px] text-cream sm:text-[112px] xl:text-[150px]" />
          <div className="mt-8 flex flex-wrap items-end gap-x-12 gap-y-8">
            <motion.p
              initial={{ y: 18, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.7, ease, delay: 0.4 }}
              className="max-w-[44ch] text-[19px] leading-relaxed text-cream/90 sm:text-[21px]"
            >
              One AI writes a fix. Another attacks it. A referee runs real tests, and nothing reaches main until the fix survives and a named human signs.
            </motion.p>
            <motion.a
              href="#cases"
              initial={{ y: 18, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.7, ease, delay: 0.55 }}
              whileHover={{ x: 6 }}
              whileTap={{ scale: 0.96 }}
              className="tap inline-flex h-16 items-center gap-4 rounded-full bg-cream pl-7 pr-2 text-[18px] font-semibold text-forest"
            >
              Pick a case <span className="grid h-12 w-12 place-items-center rounded-full text-forest transition-colors duration-1000" style={{ background: hue }}><I.Chevron size={20} className="rotate-90" /></span>
            </motion.a>
          </div>
        </div>
      </section>

      <section id="cases" className="bg-cream text-forest" aria-labelledby="cases-h">
        <div className="mx-auto max-w-[1440px] px-4 py-20 sm:px-8 sm:py-28">
          <div className="label mb-4 text-forest/70">Three recorded drills</div>
          <Headline as="h2" text="Pick a case to watch." className="text-[48px] sm:text-[80px]" />
          <p className="mt-5 max-w-[52ch] text-[18px] leading-relaxed text-forest/75">Each one is a real recording: a bug, a naive patch the red team breaks, a real fix, a signature.</p>
          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {INCIDENTS.map((inc, i) => {
              const r = p.runFor(inc);
              return <CaseBlock key={inc} incident={inc} run={r} index={i} onPick={() => r && p.onPick(r.id)} onHover={(on) => setPour(on ? INCIDENT_HEX[inc] : null)} />;
            })}
          </div>
        </div>
      </section>

      <section className="bg-forest text-cream" aria-labelledby="how">
        <div className="mx-auto max-w-[1440px] px-4 py-20 sm:px-8 sm:py-28">
          <div className="label mb-4 text-sky">How a drill runs</div>
          <Headline as="h2" text="Five steps, one gate." className="text-[48px] sm:text-[80px]" />
          <p className="mt-5 max-w-[52ch] text-[18px] leading-relaxed text-on2">Every drill walks the same road. The page you are on takes the colour of its step.</p>
          <ol className="mt-12 grid gap-3 sm:grid-cols-5">
            {PAGES.map((pg, i) => {
              const ink = PAGE_INK[pg];
              return (
                <motion.li
                  key={pg}
                  initial={{ y: 40, opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.6, delay: i * 0.08, ease }}
                  whileHover={{ y: -8 }}
                  className={`flex min-h-[250px] flex-col rounded-[22px] p-6 ${pg === "ruling" ? "outline outline-1 -outline-offset-1 outline-cream/25" : ""}`}
                  style={{ background: ink.board, color: ink.on }}
                >
                  <span className="flex items-start justify-between">
                    <span className="label opacity-80">{TIME[pg]}</span>
                    <span className="display text-[44px] italic">{i + 1}</span>
                  </span>
                  <span className="mt-auto">{pageIcon(pg, 26)}</span>
                  <h3 className="serif mt-3 text-[30px]">{PAGE_META[pg].label}</h3>
                  <p className="mt-1.5 text-[16px] leading-snug opacity-85">{PAGE_META[pg].plain}.</p>
                </motion.li>
              );
            })}
          </ol>
        </div>
      </section>
    </div>
  );
}

function CaseBlock({ incident, run, index, onPick, onHover }: { incident: string; run: Run | undefined; index: number; onPick: () => void; onHover: (on: boolean) => void }) {
  const hex = INCIDENT_HEX[incident];
  const meta = INCIDENT_META[incident];
  const verdicts = run ? run.frames.filter((f) => f.kind === "verdict").length : 0;
  const merged = run ? run.frames.some((f) => f.kind === "merge") : false;
  return (
    <motion.button
      initial={{ y: 50, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, delay: index * 0.08, ease }}
      whileHover={{ y: -10 }}
      whileTap={{ scale: 0.97 }}
      disabled={!run}
      onClick={onPick}
      onPointerEnter={() => onHover(true)}
      onPointerLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      className="tap group flex min-h-[360px] flex-col rounded-[26px] p-7 text-left text-forest disabled:opacity-50 sm:p-8"
      style={{ background: hex }}
    >
      <span className="flex w-full items-start justify-between">
        <motion.span whileHover={{ rotate: -12 }} className="grid h-16 w-16 place-items-center rounded-full bg-forest" style={{ color: hex }}>{INCIDENT_ICON[incident](30)}</motion.span>
        <span className="display text-[40px] italic">{meta.n}</span>
      </span>
      <span className="serif mt-auto block text-[38px] leading-[0.95] sm:text-[44px]">{meta.label}</span>
      <span className="mt-3 block text-[18px] leading-snug">{INCIDENT_PLAIN[incident]}.</span>
      <span className="mt-7 flex w-full items-center gap-2 border-t border-forest/20 pt-4 text-[15px] font-medium">
        {run ? <><span>{run.frames.length} moments</span><span aria-hidden>·</span><span>{verdicts} rulings</span>{merged && <><span aria-hidden>·</span><span>merged</span></>}</> : <span>No recording</span>}
        <span className="ml-auto grid h-12 w-12 place-items-center rounded-full bg-forest transition-transform duration-300 group-hover:translate-x-1" style={{ color: hex }}><I.Play size={20} className="translate-x-[2px]" /></span>
      </span>
    </motion.button>
  );
}

export const HOME_BOARD = { board: INK.forest, on: INK.cream };
