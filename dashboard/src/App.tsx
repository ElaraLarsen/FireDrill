import { useCallback, useEffect, useMemo, useState } from "react";
import { CasePanel, Docket, RoomPanel, VerdictPanel } from "./components";
import { fixtureRuns, gateRuns, type Run } from "./fixtures";
import { emptyState, replay } from "./model";
import { useLive } from "./useLive";

const host = typeof location !== "undefined" ? location.hostname || "localhost" : "localhost";
const WS_URL = (import.meta.env.VITE_TELEMETRY_URL as string | undefined) ?? `ws://${host}:8787/telemetry`;
const HTTP_URL = WS_URL.replace(/^ws/, "http").replace(/\/telemetry$/, "");
const SPEEDS = [1, 2, 4];

export default function App() {
  const { state: liveState, link } = useLive(WS_URL);
  const [runs, setRuns] = useState<Run[]>(() => fixtureRuns());
  const [runId, setRunId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    let alive = true;
    gateRuns(HTTP_URL).then((g) => { if (alive && g.length) setRuns((r) => [...g, ...r.filter((x) => x.source === "fixture")]); });
    return () => { alive = false; };
  }, [link]);

  const run = useMemo(() => runs.find((r) => r.id === runId) ?? null, [runs, runId]);
  const total = run?.frames.length ?? 0;

  useEffect(() => {
    if (!playing || !run) return;
    if (step >= total) { setPlaying(false); return; }
    const t = window.setTimeout(() => setStep((s) => Math.min(total, s + 1)), 900 / speed);
    return () => window.clearTimeout(t);
  }, [playing, step, total, speed, run]);

  const startReplay = useCallback((id: string) => { setRunId(id); setStep(0); setPlaying(true); }, []);
  const exitReplay = () => { setRunId(null); setPlaying(false); };

  const state = run ? replay(run.frames, step) : liveState;
  const empty = emptyState();
  const hasRun = (incident: string) => runs.some((r) => r.incident === incident);
  const pickIncident = (incident: string) => {
    const r = runs.find((x) => x.incident === incident);
    if (r) startReplay(r.id);
  };
  const defaultRun = runs.find((r) => r.incident === (liveState.incident ?? "")) ?? runs[0];
  const curFrame = run && step > 0 ? run.frames[step - 1] : null;

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b-2 border-amber bg-ink px-4 py-2">
        <h1 className="text-lg font-black tracking-[0.25em] text-amber">FIREDRILL</h1>
        <span className="text-[11px] uppercase tracking-[0.18em] text-dim">adversarial hotfix courtroom</span>

        {run ? (
          <span className="rounded-sm border-2 border-amber bg-amber px-2 py-0.5 text-[12px] font-black uppercase text-ink">
            Replay{run.scripted ? " · scripted" : ""} · {run.title}
          </span>
        ) : (
          <span className={`rounded-sm border px-2 py-0.5 text-[12px] font-bold uppercase ${link === "live" ? "border-ok text-ok" : link === "connecting" ? "border-amber text-amber" : "border-hot text-hot"}`}>
            {link === "live" ? "● live" : link === "connecting" ? "connecting…" : "gate offline"}
          </span>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2 text-[12px]">
          {run ? (
            <>
              <Btn onClick={() => { setStep(0); setPlaying(false); }}>⏮</Btn>
              <Btn onClick={() => { setPlaying(false); setStep((s) => Math.max(0, s - 1)); }}>◀ Step</Btn>
              <Btn hot onClick={() => (step >= total ? (setStep(0), setPlaying(true)) : setPlaying(!playing))}>{playing ? "❚❚ Pause" : step >= total ? "↻ Again" : "▶ Play"}</Btn>
              <Btn onClick={() => { setPlaying(false); setStep((s) => Math.min(total, s + 1)); }}>Step ▶</Btn>
              <Btn onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}>{speed}×</Btn>
              <input type="range" min={0} max={total} value={step} onChange={(e) => { setPlaying(false); setStep(Number(e.target.value)); }} className="w-40 accent-amber" aria-label="replay position" />
              <span className="w-28 text-dim">{step}/{total}{curFrame ? ` · ${curFrame.kind}` : ""}</span>
              <Btn onClick={exitReplay}>✕ Live</Btn>
            </>
          ) : (
            <>
              {runs.length > 1 && (
                <select className="border border-line bg-panel px-2 py-1 text-bone" value={defaultRun?.id} onChange={(e) => startReplay(e.target.value)}>
                  {runs.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
                </select>
              )}
              <Btn hot disabled={!defaultRun} onClick={() => defaultRun && startReplay(defaultRun.id)}>▶ Replay Recorded Drill</Btn>
            </>
          )}
        </div>
      </header>

      {run && (
        <div className="border-b border-line bg-raise px-4 py-1 text-[11px] text-dim">
          {run.provenance} Frames are replayed in the browser; nothing is sent to the gate.
        </div>
      )}

      <main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1fr)]">
        <RoomPanel s={state} />
        <CasePanel s={state ?? empty} hasRun={hasRun} onPickIncident={pickIncident} />
        <VerdictPanel s={state} />
      </main>
      <Docket s={state} />
    </div>
  );
}

function Btn({ children, onClick, hot, disabled }: { children: React.ReactNode; onClick: () => void; hot?: boolean; disabled?: boolean }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`rounded-sm border px-2.5 py-1 font-bold disabled:cursor-not-allowed disabled:opacity-40 ${hot ? "border-amber bg-amber text-ink hover:bg-bone" : "border-line text-bone hover:border-amber"}`}
    >
      {children}
    </button>
  );
}
