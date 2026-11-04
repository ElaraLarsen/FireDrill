import { useEffect, useState } from "react";
import * as I from "../icons";
import { attackMatrix, faced, latest, short, stateLabel, type AttackRow, type State, type Verdict } from "../model";
import { INCIDENT_META, brief, testName } from "../views";
import { Empty } from "./Room";
import { Card, INCIDENT_GRAD, INCIDENT_ICON, INCIDENT_PLAIN } from "./theme";

const R3 = "Rule R3: a hostile test only counts if it passes on the gate's own correct fix. A test that fails even on correct code is unfair, so it is thrown out.";

function Inline({ text }: { text: string }) {
  return <>{text.split(/(`[^`]+`)/g).map((t, i) => (t.startsWith("`") && t.endsWith("`") && t.length > 2 ? <code key={i} className="rounded-md bg-soft px-1 py-px font-mono text-[12px] text-ink ring-1 ring-line">{t.slice(1, -1)}</code> : t))}</>;
}

function BriefCard({ s }: { s: State }) {
  const [open, setOpen] = useState(false);
  const b = brief(s.brief);
  const fix = latest(s.fixes);
  const trial = latest(s.verdicts);
  const inc = s.incident ?? "";
  const meta = INCIDENT_META[inc];
  const d = fix?.diff_stat;
  const total = d ? Math.max(1, d.insertions + d.deletions) : 1;
  return (
    <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-line">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="tap block w-full px-4 pb-3 pt-4 text-left transition-colors hover:bg-soft/60">
        <div className="flex items-start gap-3">
          <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${INCIDENT_GRAD[inc] ?? "from-slate-400 to-slate-500"} text-white shadow-md`}>
            {INCIDENT_ICON[inc] ?? <I.Folder size={20} />}
          </span>
          <div className="min-w-0">
            <div className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink3">{meta ? `Case ${meta.n} · ${INCIDENT_PLAIN[inc]}` : "Case file"}</div>
            <h3 className="mt-0.5 text-[17px] font-extrabold leading-snug text-ink">{b?.title || meta?.label || "Waiting for the docket"}</h3>
          </div>
          <I.Chevron size={16} className={`ml-auto mt-1 shrink-0 text-ink3 transition-transform ${open ? "rotate-90" : ""}`} />
        </div>
        {b && <p className={`mt-2.5 text-[13.5px] leading-relaxed text-ink2 ${open ? "" : "line-clamp-2"}`}><Inline text={b.overview} /></p>}
        {open && b?.rest && <p className="mt-2 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink2"><Inline text={b.rest} /></p>}
      </button>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line bg-soft/60 px-4 py-3">
        {fix ? (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 font-mono text-[12px] font-semibold text-fixer ring-1 ring-violet-200"><I.Branch size={13} />{fix.branch}</span>
            <span className="rounded-full bg-white px-2.5 py-1 font-mono text-[12px] font-semibold text-ink ring-1 ring-line">{short(fix.sha)}</span>
            {d && (
              <span className="inline-flex items-center gap-2" title={`${d.insertions} lines added, ${d.deletions} removed in ${d.names.join(", ")}`}>
                <span className="flex h-2 w-16 overflow-hidden rounded-full bg-line">
                  <span className="bg-emerald-500" style={{ width: `${(d.insertions / total) * 100}%` }} />
                  <span className="bg-rose-500" style={{ width: `${(d.deletions / total) * 100}%` }} />
                </span>
                <span className="font-mono text-[12px] font-semibold"><span className="text-pass">+{d.insertions}</span> <span className="text-fail">−{d.deletions}</span></span>
              </span>
            )}
            <span className="ml-auto text-[12px] font-medium text-ink3">Patch #{s.fixes.length} by {fix.by}</span>
          </>
        ) : trial?.candidate ? (
          <span className="text-[12.5px] font-semibold text-fixer">{stateLabel(trial.state)} · <span className="font-mono">{short(trial.candidate)}</span></span>
        ) : (
          <span className="text-[12.5px] text-ink3">No patch on trial yet.</span>
        )}
      </div>
    </div>
  );
}

function Tile({ r, v }: { r: AttackRow; v: Verdict }) {
  const [flipped, setFlipped] = useState(false);
  const ref = v.checks.find((c) => c.name === r.name && c.against === "reference");
  const onFix = v.checks.find((c) => c.name === r.name && c.against === "fix");
  const kind = r.discarded ? "out" : r.fix === "fail" ? "broke" : r.fix === "pass" ? "held" : "wait";
  const face = {
    broke: { cls: "bg-gradient-to-br from-rose-500 to-pink-600 text-white", icon: <I.Zap size={22} />, word: "Broke the patch", sub: "Fair test · found a real hole" },
    held: { cls: "bg-gradient-to-br from-emerald-500 to-teal-500 text-white", icon: <I.Shield size={22} />, word: "Patch held", sub: "Fair test · the fix survived" },
    out: { cls: "striped bg-slate-100 text-slate-600 ring-1 ring-slate-200", icon: <I.Hand size={22} />, word: "Thrown out", sub: "Unfair: fails on correct code (R3)" },
    wait: { cls: "bg-white text-ink2 ring-1 ring-line", icon: <I.Sparkle size={22} />, word: "Not run yet", sub: "" },
  }[kind];
  const tail = (onFix?.output_tail ?? ref?.output_tail ?? "").trim().split("\n").slice(-4).join("\n");
  return (
    <button onClick={() => setFlipped(!flipped)} aria-pressed={flipped} title={r.discarded ? R3 : "Tap to flip"} className={`flip press h-[150px] w-full text-left ${flipped ? "is-flipped" : ""}`}>
      <span className="flip-inner block">
        <span className={`flip-face tap lift flex flex-col rounded-2xl p-3.5 shadow-md ${face.cls}`}>
          <span className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/25">{face.icon}</span>
            <span className="text-[16px] font-extrabold leading-tight">{face.word}</span>
          </span>
          <span className="mt-2 line-clamp-2 break-all font-mono text-[11.5px] font-semibold opacity-90">{testName(r.name)}</span>
          <span className="mt-auto flex items-center justify-between text-[11.5px] font-semibold opacity-90">
            <span>{face.sub}</span>
            <span className="rounded-full bg-white/25 px-2 py-0.5 text-[10.5px]">flip ↻</span>
          </span>
        </span>
        <span className="flip-face flip-back flex flex-col rounded-2xl bg-white p-3.5 text-ink shadow-md ring-1 ring-line">
          <span className="flex gap-2 text-[12px] font-semibold">
            <span className={`rounded-full px-2 py-0.5 ${ref?.status === "pass" ? "bg-emerald-50 text-pass" : "bg-rose-50 text-fail"}`}>correct fix: {ref?.status ?? "—"}{ref?.duration_ms ? ` · ${ref.duration_ms}ms` : ""}</span>
            <span className={`rounded-full px-2 py-0.5 ${!onFix ? "bg-soft text-ink3" : onFix.status === "pass" ? "bg-emerald-50 text-pass" : "bg-rose-50 text-fail"}`}>patch: {onFix?.status ?? "not run"}{onFix?.duration_ms ? ` · ${onFix.duration_ms}ms` : ""}</span>
          </span>
          <span className="mt-2 min-h-0 flex-1 overflow-hidden whitespace-pre-wrap rounded-lg bg-soft p-2 font-mono text-[10.5px] leading-snug text-ink2">{tail || "(no output)"}</span>
        </span>
      </span>
    </button>
  );
}

export function CaseFile({ s }: { s: State }) {
  const attacked = s.verdicts.filter((v) => faced(v) && v.result !== "PENDING");
  const [pick, setPick] = useState<string | null>(null);
  useEffect(() => setPick(null), [s.roomId, attacked.length]);
  const shown = attacked.find((v) => v.id === pick) ?? latest(attacked);
  const rows = attackMatrix(shown);
  const atk = latest(s.attacks);
  return (
    <Card
      title="The case file"
      hint="The bug, the patch on trial, and the tests trying to break it."
      icon={<I.Folder size={18} />}
    >
      <BriefCard s={s} />

      <div className="mb-3 mt-5 flex flex-wrap items-center gap-2">
        <h3 className="text-[14px] font-bold text-ink">Red-team scoreboard</h3>
        {atk && <span className="rounded-full bg-pink-50 px-2.5 py-0.5 font-mono text-[11.5px] font-semibold text-breaker ring-1 ring-pink-200">{atk.branch} · {short(atk.sha)}</span>}
        {attacked.length > 1 && (
          <div className="ml-auto flex rounded-full bg-soft p-1 ring-1 ring-line">
            {attacked.map((v) => (
              <button key={v.id} onClick={() => setPick(v.id)} className={`tap press rounded-full px-3 py-1 text-[12px] font-bold transition-all ${v.id === shown?.id ? "bg-white shadow-sm" : "opacity-60 hover:opacity-100"} ${v.result === "GREEN" ? "text-pass" : "text-fail"}`}>
                {v.id.replace(/^V-.*-(\d+)$/, "V-$1")} {v.result}
              </button>
            ))}
          </div>
        )}
      </div>
      {rows.length === 0 || !shown ? (
        <Empty>{atk ? "Hostile tests are filed. Waiting for the gate to run them." : "No attacks yet. Until the red team attacks, nobody can sign off."}</Empty>
      ) : (
        <>
          <div key={shown.id} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {rows.map((r) => <Tile key={`${shown.id}-${r.name}`} r={r} v={shown} />)}
          </div>
          {rows.some((r) => r.discarded) && <p className="mt-3 flex gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-[12.5px] leading-relaxed text-ink2 ring-1 ring-slate-200"><I.Info size={15} className="mt-0.5 shrink-0 text-ink3" />{R3}</p>}
        </>
      )}
    </Card>
  );
}
