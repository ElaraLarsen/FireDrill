// Page 3: the attack. The red team's hostile tests, one tile each, flipped to show their output.
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import * as I from "../icons";
import { attackMatrix, faced, latest, short, type AttackRow, type State, type Verdict } from "../model";
import { testName } from "../views";
import { Empty, INK, PageTitle, Panel } from "./theme";

const R3 = "Rule R3: a hostile test only counts if it passes on the gate's own correct fix. A test that fails even on correct code is unfair, so it is thrown out.";

function Tile({ r, v, index }: { r: AttackRow; v: Verdict; index: number }) {
  const [flipped, setFlipped] = useState(false);
  const ref = v.checks.find((c) => c.name === r.name && c.against === "reference");
  const onFix = v.checks.find((c) => c.name === r.name && c.against === "fix");
  const kind = r.discarded ? "out" : r.fix === "fail" ? "broke" : r.fix === "pass" ? "held" : "wait";
  const face = {
    broke: { bg: INK.scarlet, fg: INK.forest, icon: <I.Zap size={26} />, word: "Broke the patch", sub: "Fair test · found a real hole" },
    held: { bg: INK.jade, fg: INK.forest, icon: <I.Shield size={26} />, word: "Patch held", sub: "Fair test · the fix survived" },
    out: { bg: "var(--color-p3)", fg: INK.cream, icon: <I.Hand size={26} />, word: "Thrown out", sub: "Unfair: fails on correct code (R3)" },
    wait: { bg: "var(--color-p2)", fg: INK.cream, icon: <I.Sparkle size={26} />, word: "Not run yet", sub: "" },
  }[kind];
  const tail = (onFix?.output_tail ?? ref?.output_tail ?? "").trim().split("\n").slice(-5).join("\n");
  const pill = (ok: boolean | null) => (ok === null ? "bg-p3 text-on2" : ok ? "bg-jade text-forest" : "bg-scarlet text-forest");
  return (
    <motion.button
      initial={{ y: 40, opacity: 0, rotateZ: index % 2 ? 3 : -3 }}
      animate={{ y: 0, opacity: 1, rotateZ: 0 }}
      transition={{ type: "spring", stiffness: 240, damping: 18, delay: index * 0.08 }}
      whileHover={{ y: -6 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => setFlipped(!flipped)}
      aria-pressed={flipped}
      title={r.discarded ? R3 : "Tap to flip"}
      className={`flip h-[200px] w-full text-left ${flipped ? "is-flipped" : ""}`}
    >
      <span className="flip-inner block">
        <span className={`flip-face tap flex flex-col p-5 ${kind === "out" ? "hatch" : ""} ${kind === "broke" ? "shake" : ""}`} style={{ background: face.bg, color: face.fg, animationDelay: `${0.4 + index * 0.08}s` }}>
          <span className="flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-forest" style={{ color: kind === "out" || kind === "wait" ? INK.cream : face.bg }}>{face.icon}</span>
            <span className="serif text-[22px] leading-[0.95]">{face.word}</span>
          </span>
          <span className="mt-3 line-clamp-2 break-all font-mono text-[13.5px] font-bold">{testName(r.name)}</span>
          <span className="mt-auto flex items-center justify-between gap-2 text-[14px] font-bold">
            <span>{face.sub}</span>
            <span className="shrink-0 bg-forest px-2.5 py-1 text-[12.5px] text-on">flip ↻</span>
          </span>
        </span>
        <span className="flip-face flip-back flex flex-col bg-p3 p-4 text-on">
          <span className="flex flex-wrap gap-1.5 text-[13px] font-bold">
            <span className={`px-2.5 py-1 ${pill(ref ? ref.status === "pass" : null)}`}>correct fix: {ref?.status ?? "—"}{ref?.duration_ms ? ` · ${ref.duration_ms}ms` : ""}</span>
            <span className={`px-2.5 py-1 ${pill(onFix ? onFix.status === "pass" : null)}`}>patch: {onFix?.status ?? "not run"}{onFix?.duration_ms ? ` · ${onFix.duration_ms}ms` : ""}</span>
          </span>
          <span className="mt-2 min-h-0 flex-1 overflow-hidden whitespace-pre-wrap bg-forest p-2.5 font-mono text-[11.5px] leading-snug text-on2">{tail || "(no output)"}</span>
        </span>
      </span>
    </motion.button>
  );
}

export function AttackPage({ s }: { s: State }) {
  const attacked = s.verdicts.filter((v) => faced(v) && v.result !== "PENDING");
  const [pick, setPick] = useState<string | null>(null);
  useEffect(() => setPick(null), [s.roomId, attacked.length]);
  const shown = attacked.find((v) => v.id === pick) ?? latest(attacked);
  const rows = attackMatrix(shown);
  const atk = latest(s.attacks);
  const broke = rows.filter((r) => !r.discarded && r.fix === "fail").length;
  const held = rows.filter((r) => !r.discarded && r.fix === "pass").length;
  const out = rows.filter((r) => r.discarded).length;

  return (
    <div className="space-y-4">
      <PageTitle
        title="The red team attacks"
        lead="The breaker writes hostile tests aimed straight at the patch. If any fair test breaks it, the patch goes back to the fixer."
        right={atk ? <span className="inline-flex h-10 items-center gap-2 rounded-full bg-forest px-4 font-mono text-[13px] text-tangerine"><I.Branch size={14} />{atk.branch} · {short(atk.sha)}</span> : undefined}
      />

      {rows.length > 0 && shown && (
        <div className="grid grid-cols-3 gap-1.5 pt-4">
          {[
            { n: broke, label: "broke the patch", hex: INK.scarlet },
            { n: held, label: "the patch held", hex: INK.jade },
            { n: out, label: "thrown out as unfair", hex: INK.stone },
          ].map((x, i) => (
            <motion.div key={x.label} initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 + i * 0.08 }} className="rounded-[22px] bg-forest p-4 sm:p-6">
              <motion.div key={`${shown.id}-${x.n}`} initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="display tnum text-[52px] sm:text-[88px]" style={{ color: x.hex }}>{x.n}</motion.div>
              <div className="mt-2 text-[15px] font-bold text-on2 sm:text-[17px]">{x.label}</div>
            </motion.div>
          ))}
        </div>
      )}

      <Panel
        title="The scoreboard"
        hint="Tap a tile to flip it and see the test's real output."
        delay={0.15}
        right={attacked.length > 1 ? (
          <div className="flex bg-p2 p-1" role="group" aria-label="Pick a ruling">
            {attacked.map((v) => {
              const on = v.id === shown?.id;
              const hex = v.result === "GREEN" ? INK.jade : INK.scarlet;
              return (
                <button key={v.id} onClick={() => setPick(v.id)} aria-pressed={on} className="tap press relative isolate h-10 px-4 text-[14px] font-semibold" style={{ color: on ? INK.forest : hex }}>
                  {on && <motion.span layoutId="verdict-pill" className="absolute inset-0 -z-10" style={{ background: hex }} />}
                  {v.id.replace(/^V-.*-(\d+)$/, "V-$1")} {v.result}
                </button>
              );
            })}
          </div>
        ) : undefined}
      >
        {rows.length === 0 || !shown ? (
          <Empty>{atk ? "Hostile tests are filed. Waiting for the gate to run them." : "No attacks yet. Until the red team attacks, nobody can sign off."}</Empty>
        ) : (
          <>
            <div key={shown.id} className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((r, i) => <Tile key={`${shown.id}-${r.name}`} r={r} v={shown} index={i} />)}
            </div>
            {rows.some((r) => r.discarded) && <p className="mt-4 flex gap-3 bg-p2 px-4 py-3.5 text-[15px] leading-relaxed text-on2"><I.Info size={18} className="mt-0.5 shrink-0 text-sky" />{R3}</p>}
          </>
        )}
      </Panel>
    </div>
  );
}
