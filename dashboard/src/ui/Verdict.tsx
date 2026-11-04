import { useState, type ReactNode } from "react";
import { confetti } from "../fx";
import * as I from "../icons";
import { latest, short, signOff, stamp, type Check, type State, type Verdict as V } from "../model";
import { failedAgainstFix, groupChecks, testName } from "../views";
import { Empty } from "./Room";
import { Card } from "./theme";

const SEAL: Record<string, { ring: string; core: string; word: string; plain: string; icon: ReactNode }> = {
  idle: { ring: "#d3d8e8", core: "from-slate-100 to-slate-200 text-slate-500", word: "NO CASE", plain: "Waiting for the first patch.", icon: <I.Gavel size={34} /> },
  pending: { ring: "#0284c7", core: "from-sky-400 to-blue-500 text-white", word: "TESTING", plain: "The gate is running real tests.", icon: <I.Sparkle size={34} /> },
  red: { ring: "#e11d48", core: "from-rose-500 to-pink-600 text-white", word: "RED", plain: "Broken by the red team.", icon: <I.Cross size={36} /> },
  green: { ring: "#10b981", core: "from-emerald-500 to-teal-500 text-white", word: "GREEN", plain: "Survived every attack.", icon: <I.Shield size={34} /> },
  merged: { ring: "#0d9488", core: "from-teal-500 via-emerald-500 to-sky-500 text-white", word: "MERGED", plain: "Signed off and merged to main.", icon: <I.Merge size={34} /> },
  error: { ring: "#9333ea", core: "from-purple-500 to-violet-600 text-white", word: "ERROR", plain: "The gate hit a problem. Nothing merges.", icon: <I.Info size={34} /> },
};

function Seal({ s, v }: { s: State; v: V | undefined }) {
  const st = stamp(s);
  const [wig, setWig] = useState(0);
  const key = st.label === "GREEN ON REPRO ONLY — NO ATTACK YET" ? "pending" : st.tone;
  const look = SEAL[key];
  const f = failedAgainstFix(v);
  const pct = f && f.total ? ((f.total - f.failed) / f.total) * 100 : v?.result === "PENDING" ? 0 : 100;
  const repro = st.label.startsWith("GREEN ON REPRO");
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-white px-4 pb-4 pt-5 ring-1 ring-line sm:flex-row sm:items-center sm:gap-5">
      <button
        key={`${v?.id}-${st.label}`}
        onClick={() => { setWig((n) => n + 1); if (key === "green" || key === "merged") confetti(60); }}
        title="Tap the seal"
        className={`tap pop relative grid h-[132px] w-[132px] shrink-0 place-items-center rounded-full ${key === "pending" ? "pingring text-wait" : ""}`}
        style={{ background: `conic-gradient(${look.ring} ${pct}%, #e9ecf5 ${pct}% 100%)` }}
      >
        <span key={wig} className={`grid h-[112px] w-[112px] place-items-center rounded-full bg-gradient-to-br ${look.core} shadow-[inset_0_2px_0_rgb(255_255_255/.35),0_10px_24px_-10px_rgb(20_26_51/.5)] ${wig ? "wiggle" : ""}`}>
          <span className="flex flex-col items-center">
            {look.icon}
            <span className="mt-1 text-[13px] font-extrabold tracking-[0.16em]">{repro ? "REPRO OK" : look.word}</span>
          </span>
        </span>
      </button>
      <div className="min-w-0 text-center sm:text-left">
        <div className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink3">{v ? v.id : "The ruling"}</div>
        <div className="mt-0.5 text-[20px] font-extrabold leading-tight text-ink">{st.label}</div>
        <div className="mt-1 text-[13.5px] text-ink2">{repro ? "It fixes the bug, but nobody has attacked it yet." : look.plain}</div>
        {v?.merged && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-1 text-[12px] font-bold text-approver ring-1 ring-teal-200">
            <I.Key size={13} /> Gate key verified · main <span className="font-mono">{short(v.merged.main_sha)}</span>
          </div>
        )}
        {st.tone === "red" && f && f.failed > 0 && (
          <div className="mt-2 flex flex-wrap justify-center gap-1.5 sm:justify-start">
            <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[12px] font-bold text-fail ring-1 ring-rose-200">{f.failed} of {f.total} failed</span>
            {f.names.slice(0, 2).map((n) => <span key={n} className="max-w-[220px] truncate rounded-full bg-white px-2.5 py-1 font-mono text-[11px] text-fail ring-1 ring-rose-200">{n}</span>)}
          </div>
        )}
        {v?.result === "PENDING" && <div className="shimmer mt-2.5 h-2 w-48 rounded-full bg-sky-100" />}
      </div>
    </div>
  );
}

function CheckBar({ c, max }: { c: Check; max: number }) {
  const ok = c.status === "pass";
  const w = Math.max(6, ((c.duration_ms ?? 0) / max) * 100);
  return (
    <li className="slideup">
      <details className="group rounded-xl ring-1 ring-transparent transition-all open:bg-white open:ring-line">
        <summary className="tap press flex cursor-pointer list-none items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-white">
          <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${ok ? "bg-emerald-100 text-pass" : "bg-rose-100 text-fail"}`}>{ok ? <I.Check size={15} /> : <I.Cross size={14} />}</span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate font-mono text-[12.5px] font-semibold text-ink" title={c.name}>{testName(c.name)}</span>
              {c.kind === "attack" && <span className="shrink-0 rounded-md bg-pink-50 px-1.5 py-px text-[10.5px] font-semibold text-breaker">attack</span>}
            </span>
            <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-soft">
              <span className={`block h-full rounded-full ${ok ? "bg-gradient-to-r from-emerald-400 to-teal-400" : "bg-gradient-to-r from-rose-400 to-pink-500"}`} style={{ width: `${w}%` }} />
            </span>
          </span>
          <span className="shrink-0 font-mono text-[12px] tabular-nums text-ink2">{c.duration_ms ?? "—"} ms</span>
          <I.Chevron size={13} className="shrink-0 text-ink3 transition-transform group-open:rotate-90" />
        </summary>
        <pre className="mx-2.5 mb-2.5 max-h-48 overflow-auto rounded-lg bg-[#f4f6fb] p-2.5 font-mono text-[11px] leading-relaxed text-ink2 ring-1 ring-line">{c.output_tail?.trim() || "(no output captured)"}</pre>
      </details>
    </li>
  );
}

function Group({ title, hint, checks }: { title: string; hint: string; checks: Check[] }) {
  if (!checks.length) return null;
  const max = Math.max(...checks.map((c) => c.duration_ms ?? 0), 1);
  const passed = checks.filter((c) => c.status === "pass").length;
  return (
    <div className="mt-4">
      <div className="mb-1.5 flex items-baseline justify-between gap-2 px-1">
        <h3 className="text-[13.5px] font-bold text-ink">{title}</h3>
        <span className="font-mono text-[11.5px] font-semibold text-ink3">{passed}/{checks.length} pass</span>
      </div>
      <p className="mb-1.5 px-1 text-[12px] text-ink3">{hint}</p>
      <ul className="space-y-1 rounded-2xl bg-soft/70 p-1.5 ring-1 ring-line">{checks.map((c, i) => <CheckBar key={`${c.name}-${c.against}-${i}`} c={c} max={max} />)}</ul>
    </div>
  );
}

function Lock({ s, v }: { s: State; v: V | undefined }) {
  const so = signOff(s);
  const [copied, setCopied] = useState(false);
  const lastRej = latest(s.rejections);
  const cmd = so.phase === "awaiting" ? `@firedrill-gate APPROVE ${so.verdictId}` : "";
  const copy = async () => {
    try { await navigator.clipboard.writeText(cmd); } catch { /* clipboard blocked: still show feedback */ }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };
  const look = {
    no_attack: { box: "bg-white ring-line", chip: "bg-slate-100 text-slate-600", icon: <I.Lock size={26} />, title: "Locked: no attack yet", tint: "from-slate-400 to-slate-500" },
    blocked: { box: v?.result === "PENDING" ? "bg-sky-50/60 ring-sky-200" : "bg-rose-50/70 ring-rose-200", chip: "", icon: <I.Lock size={26} />, title: "Locked", tint: v?.result === "PENDING" ? "from-sky-400 to-blue-500" : "from-rose-500 to-pink-600" },
    awaiting: { box: "bg-gradient-to-br from-teal-50 to-sky-50 ring-teal-300", chip: "", icon: <I.Unlock size={26} />, title: "Ready for a human", tint: "from-teal-500 to-emerald-500" },
    signed: { box: "bg-emerald-50 ring-emerald-200", chip: "", icon: <I.Pen size={24} />, title: "Signed off", tint: "from-emerald-500 to-teal-500" },
    merged: { box: "bg-gradient-to-br from-emerald-50 to-teal-50 ring-emerald-300", chip: "", icon: <I.Key size={26} />, title: "Merged by the gate", tint: "from-teal-500 via-emerald-500 to-sky-500" },
  }[so.phase];
  return (
    <section className={`mt-5 rounded-2xl p-4 ring-1 transition-colors ${look.box}`}>
      <div className="flex items-center gap-3">
        <span key={so.phase} className={`pop grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${look.tint} text-white shadow-md`}>{look.icon}</span>
        <div className="min-w-0">
          <div className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink3">Human sign-off · enforced</div>
          <h3 className="text-[16.5px] font-extrabold leading-tight text-ink">{look.title}</h3>
        </div>
      </div>
      <div className="mt-3 text-[13.5px] leading-relaxed text-ink2">
        {so.phase === "no_attack" && "No attack, no sign-off. A human can only approve a patch that stayed GREEN after the red team attacked it."}
        {so.phase === "blocked" && so.text}
        {so.phase === "awaiting" && (
          <>
            Type this in the room to sign off:
            <button onClick={copy} className="tap press mt-2 flex w-full items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-left shadow-sm ring-2 ring-teal-300 transition-all hover:ring-teal-500">
              <code className="min-w-0 flex-1 truncate font-mono text-[13px] font-bold text-approver">{cmd}</code>
              <span className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11.5px] font-bold transition-colors ${copied ? "bg-pass text-white" : "bg-teal-50 text-approver"}`}>
                {copied ? <><I.Check size={12} /> Copied</> : <><I.Copy size={12} /> Copy</>}
              </span>
            </button>
            <div className="mt-2 text-[12px] text-ink3">Approvers: {s.approvers.length ? s.approvers.map((a) => `@${a}`).join(", ") : "a named approver"}</div>
          </>
        )}
        {so.phase === "signed" && so.text}
        {so.phase === "merged" && v?.signoff && (
          <>
            <span className="font-mono text-[13px] font-bold text-pass">{so.text}</span>
            <div className="mt-1 text-[12.5px]">Signed off by <b className="text-ink">{v.signoff.by}</b>{v.signoff.participant && <> · <span className="font-mono text-[12px]">{v.signoff.participant}</span></>}</div>
          </>
        )}
      </div>
      {s.messages.length === 0 && s.fixes.length === 0 && so.phase !== "merged" && v && (
        <div className="mt-2 text-[12.5px] font-semibold text-ink">This recording stops at the verdict: no human sign-off or merge was recorded.</div>
      )}
      <div className="mt-3 flex items-start gap-2 rounded-xl bg-white/70 px-3 py-2 text-[12px] leading-relaxed text-ink3 ring-1 ring-line">
        <I.Shield size={14} className="mt-0.5 shrink-0 text-gate" />
        Checked by Switch participant id, not by the words typed. Only the gate holds the key to main.
      </div>
      {lastRej && !v?.merged && (
        <div className="slideup mt-2.5 flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-[12.5px] text-fail ring-1 ring-rose-200">
          <I.Hand size={14} className="mt-0.5 shrink-0" />
          <span><b>Refused</b> ({lastRej.by}): {lastRej.reason}</span>
        </div>
      )}
    </section>
  );
}

export function Verdict({ s }: { s: State }) {
  const v = latest(s.verdicts);
  const g = groupChecks(v);
  return (
    <Card title="The ruling" hint="Nothing merges until it's GREEN after an attack and a human signs." icon={<I.Gavel size={18} />}>
      <Seal s={s} v={v} />
      {v ? (
        <>
          <Group title="Is each attack fair? (Rule R3)" hint="Run on the gate's own correct fix. Unfair tests get thrown out." checks={g.reference} />
          <Group title="Does the patch hold?" hint="The bug test, every fair attack, and the safety rule, run on the patch." checks={g.fix} />
          {v.notes.map((n, i) => <div key={i} className="mt-2 text-[12.5px] text-err">note: {n}</div>)}
        </>
      ) : (
        <div className="mt-4"><Empty>The gate's tests appear here, one by one, as they run.</Empty></div>
      )}
      <Lock s={s} v={v} />
    </Card>
  );
}
