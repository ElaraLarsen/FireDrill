import type { ReactNode } from "react";
import * as I from "../icons";
import type { Frame } from "../model";
import type { Stage } from "../views";

const ICON: Record<string, ReactNode> = {
  docket: <I.Folder size={19} />,
  patch: <I.Wrench size={19} />,
  attack: <I.Zap size={19} />,
  fix: <I.Hammer size={19} />,
  green: <I.Shield size={19} />,
  signoff: <I.Pen size={19} />,
  merged: <I.Merge size={19} />,
};

const NODE: Record<Stage["state"], string> = {
  done: "bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-[0_8px_18px_-6px_rgb(16_185_129/.7)]",
  failed: "bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-[0_8px_18px_-6px_rgb(225_29_72/.7)]",
  active: "pingring bg-white text-wait ring-2 ring-wait",
  pending: "bg-white text-ink3 ring-1 ring-line2",
  skipped: "bg-white text-ink3 border-2 border-dashed border-line2",
};

interface Props {
  stages: Stage[];
  steps: Record<string, number>;
  frames: Frame[] | null;
  step: number;
  onJump: (step: number) => void;
}

export function Journey({ stages, steps, frames, step, onJump }: Props) {
  const total = frames?.length ?? 0;
  const verdictMarks = frames ? frames.map((f, i) => ({ f, i })).filter(({ f }) => f.kind === "verdict" || f.kind === "merge") : [];
  return (
    <section className="glass relative z-10 mx-4 mt-3 rounded-3xl border border-white/70 px-4 pb-4 pt-4 shadow-[0_12px_40px_-20px_rgb(20_26_51/.3)] sm:mx-6 sm:px-6">
      <ol className="flex overflow-x-auto pb-1">
        {stages.map((st, i) => {
          const next = stages[i + 1];
          const at = steps[st.key];
          const can = frames && at !== undefined;
          const lit = next && (next.state === "done" || next.state === "failed" || next.state === "skipped");
          return (
            <li key={st.key} className="flex min-w-[118px] flex-1 flex-col">
              <div className="flex items-center">
                <button
                  disabled={!can}
                  onClick={() => can && onJump(at)}
                  title={can ? `Jump to “${st.label}”` : st.label}
                  className={`tap press relative grid h-11 w-11 shrink-0 place-items-center rounded-full transition-all duration-300 enabled:hover:scale-110 disabled:cursor-default ${NODE[st.state]}`}
                >
                  {st.state === "failed" ? <I.Cross size={18} /> : st.state === "done" ? <I.Check size={19} /> : ICON[st.key]}
                </button>
                {next && (
                  <span className="relative mx-2 h-[5px] flex-1 overflow-hidden rounded-full bg-line">
                    <span className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${lit ? "w-full" : "w-0"} ${next.state === "failed" ? "bg-gradient-to-r from-emerald-400 to-rose-500" : st.state === "failed" ? "bg-gradient-to-r from-rose-500 to-emerald-400" : "bg-gradient-to-r from-emerald-400 to-teal-400"}`} />
                  </span>
                )}
              </div>
              <div className={`mt-2 pr-3 text-[13px] font-bold leading-tight ${st.state === "failed" ? "text-fail" : st.state === "active" ? "text-wait" : st.state === "pending" || st.state === "skipped" ? "text-ink3" : "text-ink"}`}>
                {st.label}
              </div>
              <div className="mt-0.5 truncate pr-3 font-mono text-[11px] text-ink3">{st.detail || (st.state === "active" ? "happening now…" : " ")}</div>
            </li>
          );
        })}
      </ol>

      {frames && (
        <div className="mt-3 flex items-center gap-5 pl-2">
          <div className="relative h-3 flex-1 rounded-full bg-soft ring-1 ring-line">
            <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-violet-500 via-blue-500 to-teal-400 transition-[width] duration-200" style={{ width: `${total ? (step / total) * 100 : 0}%` }} />
            <div className="pointer-events-none absolute inset-y-0 left-2 right-2">
            {verdictMarks.map(({ f, i }) => (
              <button
                key={i}
                onClick={() => onJump(i + 1)}
                title={f.kind === "merge" ? "Merged" : `${f.data?.verdict_id ?? "verdict"}: ${f.data?.result ?? ""}`}
                className={`tap pointer-events-auto absolute top-1/2 z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow transition-transform hover:scale-125 ${f.kind === "merge" ? "bg-teal-500" : f.data?.result === "GREEN" ? "bg-emerald-500" : f.data?.result === "RED" ? "bg-rose-500" : "bg-purple-500"}`}
                style={{ left: `${((i + 1) / total) * 100}%` }}
              />
            ))}
            </div>
            <input type="range" min={0} max={total} value={step} onChange={(e) => onJump(Number(e.target.value))} aria-label="Replay position" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
          </div>
          <span className="shrink-0 font-mono text-[12px] font-medium tabular-nums text-ink2">
            {step}/{total} <span className="text-ink3">· {step > 0 ? frames[step - 1].kind.replace("_", " ") : "start"}</span>
          </span>
        </div>
      )}
    </section>
  );
}
