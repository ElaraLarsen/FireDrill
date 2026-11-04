import type { ReactNode } from "react";
import type { Run } from "../fixtures";
import * as I from "../icons";
import { INCIDENTS } from "../model";
import { INCIDENT_META } from "../views";
import { INCIDENT_GRAD, INCIDENT_ICON, INCIDENT_PLAIN } from "./theme";

interface Props {
  run: Run | null;
  link: string;
  runFor: (incident: string) => Run | undefined;
  activeIncident: string | null;
  onPick: (id: string) => void;
  playing: boolean;
  atEnd: boolean;
  atStart: boolean;
  speed: number;
  onToggle: () => void;
  onStep: (d: number) => void;
  onSpeed: (x: number) => void;
  onLive?: () => void;
  evidence: boolean;
  onEvidence: () => void;
}

export function Header(p: Props) {
  return (
    <header className="relative z-10 px-4 pt-4 sm:px-6">
      <div className="glass flex flex-wrap items-center gap-x-5 gap-y-3 rounded-3xl border border-white/70 px-4 py-3 shadow-[0_12px_40px_-20px_rgb(20_26_51/.3)] sm:px-5">
        <Brand />
        <Badges run={p.run} link={p.link} onEvidence={p.onEvidence} evidence={p.evidence} />
        {p.run && <Player {...p} />}
      </div>

      <nav className="mt-3 grid gap-3 sm:grid-cols-3" aria-label="Pick an incident">
        {INCIDENTS.map((inc) => {
          const r = p.runFor(inc);
          const active = p.activeIncident === inc;
          const meta = INCIDENT_META[inc];
          return (
            <button
              key={inc}
              disabled={!r}
              onClick={() => r && p.onPick(r.id)}
              className={`tap lift press group flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50 ${active ? "border-transparent bg-white text-fixer shadow-[0_0_0_2px_var(--color-fixer),0_14px_30px_-14px_rgb(124_58_237/.55)]" : "glass border-white/70 text-ink2 hover:bg-white"}`}
            >
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${INCIDENT_GRAD[inc]} text-white shadow-md transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105`}>
                {INCIDENT_ICON[inc]}
              </span>
              <span className="min-w-0">
                <span className="flex items-baseline gap-2">
                  <span className="font-mono text-[11px] font-semibold text-ink3">{meta.n}</span>
                  <span className="truncate text-[15px] font-bold text-ink">{meta.label}</span>
                </span>
                <span className="block truncate text-[12.5px] text-ink2">{INCIDENT_PLAIN[inc]}</span>
              </span>
              <span className={`ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-full transition-all ${active ? "bg-fixer text-white" : "bg-soft text-ink3 group-hover:translate-x-0.5 group-hover:text-fixer"}`}>
                {active ? <I.Eye size={14} /> : <I.Play size={11} />}
              </span>
            </button>
          );
        })}
      </nav>
    </header>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <span className="tap press grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 via-blue-600 to-teal-500 text-white shadow-[0_8px_20px_-6px_rgb(79_70_229/.6)] transition-transform hover:rotate-[-8deg]">
        <I.Gavel size={22} />
      </span>
      <div className="leading-tight">
        <h1 className="bg-gradient-to-r from-violet-700 via-blue-700 to-teal-600 bg-clip-text text-[21px] font-extrabold tracking-tight text-transparent">FireDrill</h1>
        <p className="text-[12.5px] font-medium text-ink2">The hotfix courtroom: no attack, no sign-off.</p>
      </div>
    </div>
  );
}

function Badges({ run, link, evidence, onEvidence }: { run: Run | null; link: string; evidence: boolean; onEvidence: () => void }) {
  if (!run) {
    const s: Record<string, [string, string]> = {
      live: ["Live", "bg-emerald-50 text-pass ring-emerald-200"],
      connecting: ["Connecting…", "bg-sky-50 text-wait ring-sky-200"],
      offline: ["Gate offline", "bg-rose-50 text-fail ring-rose-200"],
      static: ["Replay only", "bg-sky-50 text-wait ring-sky-200"],
    };
    const [t, c] = s[link] ?? s.offline;
    return <span className={`inline-flex h-8 items-center gap-2 rounded-full px-3 text-[12.5px] font-semibold ring-1 ${c}`}><span className="breathe h-2 w-2 rounded-full bg-current" />{t}</span>;
  }
  const real = run.verifier !== "test-stand-in";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex h-8 items-center gap-2 rounded-full bg-emerald-50 px-3 text-[12.5px] font-semibold text-pass ring-1 ring-emerald-200">
        <span className="breathe h-2 w-2 rounded-full bg-pass2" /> Replay · {real ? "real verifier evidence" : "test verifier"}
      </span>
      {run.scripted && (
        <span className="inline-flex h-8 items-center rounded-full bg-violet-50 px-3 text-[12.5px] font-semibold text-fixer ring-1 ring-violet-200">Scripted participants</span>
      )}
      <button onClick={onEvidence} aria-expanded={evidence} className={`tap press inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold ring-1 transition-colors ${evidence ? "bg-ink text-white ring-ink" : "bg-white text-ink2 ring-line hover:text-ink"}`}>
        <I.Info size={14} /> What's real?
      </button>
    </div>
  );
}

function Round({ children, onClick, label, disabled, big }: { children: ReactNode; onClick: () => void; label: string; disabled?: boolean; big?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`tap press grid place-items-center rounded-full transition-all disabled:cursor-not-allowed disabled:opacity-35 ${big
        ? "h-14 w-14 bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white shadow-[0_10px_24px_-8px_rgb(124_58_237/.75)] hover:scale-105 hover:shadow-[0_14px_30px_-8px_rgb(124_58_237/.85)]"
        : "h-11 w-11 bg-white text-ink2 ring-1 ring-line hover:text-fixer hover:ring-violet-300"}`}
    >
      {children}
    </button>
  );
}

function Player(p: Props) {
  return (
    <div className="ml-auto flex items-center gap-2.5">
      <Round label="Step back (←)" onClick={() => p.onStep(-1)} disabled={p.atStart}><I.StepBack size={17} /></Round>
      <Round big label={p.playing ? "Pause (space)" : p.atEnd ? "Play again" : "Play (space)"} onClick={p.onToggle}>
        {p.playing ? <I.Pause size={22} /> : p.atEnd ? <I.Restart size={22} /> : <I.Play size={22} className="translate-x-[1px]" />}
      </Round>
      <Round label="Step forward (→)" onClick={() => p.onStep(1)} disabled={p.atEnd}><I.StepFwd size={17} /></Round>
      <div className="ml-1 flex items-center rounded-full bg-soft p-1 ring-1 ring-line" role="group" aria-label="Auto-play speed">
        {[1, 2].map((x) => (
          <button key={x} onClick={() => p.onSpeed(x)} className={`tap press h-9 rounded-full px-3 text-[13px] font-bold transition-all ${p.speed === x ? "bg-white text-fixer shadow-sm" : "text-ink3 hover:text-ink"}`}>{x}×</button>
        ))}
      </div>
      {p.onLive && (
        <button onClick={p.onLive} className="tap press h-11 rounded-full bg-white px-4 text-[13px] font-semibold text-ink2 ring-1 ring-line hover:text-ink">Go live</button>
      )}
    </div>
  );
}
