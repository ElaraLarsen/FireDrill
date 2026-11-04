import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CasePanel, Docket, RoomPanel, VerdictPanel } from "./components";
import { fixtureRuns, gateRuns, type Run } from "./fixtures";
import * as I from "./icons";
import { INCIDENTS, replay } from "./model";
import { useLive } from "./useLive";
import { INCIDENT_META } from "./views";

// The gate runs on the same machine as the dashboard. On a hosted copy (Vercel, Pages, ...) there is
// no gate to follow, so unless VITE_TELEMETRY_URL says otherwise the dashboard is replay-only.
const host = typeof location !== "undefined" ? location.hostname : "";
const isLocal = host === "" || host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host.endsWith(".local");
const WS_URL: string | null = (import.meta.env.VITE_TELEMETRY_URL as string | undefined) ?? (isLocal ? `ws://${host || "localhost"}:8787/telemetry` : null);
const HTTP_URL = WS_URL ? WS_URL.replace(/^ws/, "http").replace(/\/telemetry$/, "") : null;
const SPEEDS = [1, 2];

export default function App() {
  const { state: liveState, link } = useLive(WS_URL);
  const [runs, setRuns] = useState<Run[]>(() => fixtureRuns());
  // Deep link: ?replay=<run id>&step=<n|end> opens a recorded drill paused at that frame.
  const deep = useMemo(() => {
    const q = new URLSearchParams(typeof location !== "undefined" ? location.search : "");
    const id = q.get("replay");
    const run = id ? fixtureRuns().find((r) => r.id === id) : undefined;
    if (!run) return null;
    const st = q.get("step");
    return { id: run.id, step: st === "end" || st === null ? run.frames.length : Math.max(0, Math.min(run.frames.length, Number(st) || 0)) };
  }, []);
  const [runId, setRunId] = useState<string | null>(deep?.id ?? null);
  const [step, setStep] = useState(deep?.step ?? 0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showEvidence, setShowEvidence] = useState(false);
  const chosen = useRef(Boolean(deep));

  useEffect(() => {
    let alive = true;
    if (!HTTP_URL) return;
    gateRuns(HTTP_URL).then((g) => { if (alive && g.length) setRuns((r) => [...g, ...r.filter((x) => x.source === "fixture")]); });
    return () => { alive = false; };
  }, [link]);

  // No gate to follow (hosted copy, or a local gate that isn't running): open the first recording,
  // paused on its final frame, so the page is never an empty courtroom. Only until someone picks.
  useEffect(() => {
    if (chosen.current || runId || !runs.length) return;
    if (link === "static" || link === "offline") {
      setRunId(runs[0].id);
      setStep(runs[0].frames.length);
    }
  }, [link, runs, runId]);

  const run = useMemo(() => runs.find((r) => r.id === runId) ?? null, [runs, runId]);
  const total = run?.frames.length ?? 0;

  useEffect(() => {
    if (!playing || !run) return;
    if (step >= total) { setPlaying(false); return; }
    // Check rows stream quickly, verdicts and room events linger so the stamp can land.
    const next = run.frames[step]?.kind;
    const base = next === "check" ? 260 : next === "verdict" ? 1300 : 800;
    const t = window.setTimeout(() => setStep((s) => Math.min(total, s + 1)), base / speed);
    return () => window.clearTimeout(t);
  }, [playing, step, total, speed, run]);

  const startReplay = useCallback((id: string) => { chosen.current = true; setRunId(id); setStep(0); setPlaying(true); }, []);
  const exitReplay = () => { chosen.current = true; setRunId(null); setPlaying(false); };
  const togglePlay = useCallback(() => {
    if (!run) return;
    if (step >= total) { setStep(0); setPlaying(true); } else setPlaying((p) => !p);
  }, [run, step, total]);
  const stepBy = useCallback((d: number) => { setPlaying(false); setStep((s) => Math.max(0, Math.min(total, s + d))); }, [total]);

  // Space plays/pauses, arrows step, while no form control has focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!run || (e.target as HTMLElement)?.closest?.("input, select, textarea, summary, button")) return;
      if (e.key === " ") { e.preventDefault(); togglePlay(); }
      else if (e.key === "ArrowRight") stepBy(1);
      else if (e.key === "ArrowLeft") stepBy(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run, togglePlay, stepBy]);

  const state = run ? replay(run.frames, step) : liveState;
  const curFrame = run && step > 0 ? run.frames[step - 1] : null;
  const runFor = (incident: string) => runs.find((r) => r.incident === incident);
  const activeIncident = run?.incident ?? liveState.incident;
  const canGoLive = link === "live" || link === "connecting";

  return (
    <div className="flex min-h-full flex-col lg:h-full">
      <header className="shrink-0 border-b border-line bg-bg">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-2.5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber/12 text-amber ring-1 ring-inset ring-amber/35"><I.Flame size={18} /></span>
            <div className="leading-tight">
              <h1 className="text-[15px] font-semibold tracking-tight text-fg">FireDrill</h1>
              <div className="text-[11px] text-faint">Adversarial hotfix courtroom on Switch</div>
            </div>
          </div>

          <StatusBadge run={run} link={link} />

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {run && (
              <>
                <div className="flex items-center rounded-lg bg-raise p-1 ring-1 ring-line">
                  <IconBtn label="Step back (←)" onClick={() => stepBy(-1)} disabled={step === 0}><I.StepBack size={15} /><span className="hidden xl:inline">Step back</span></IconBtn>
                  <button
                    onClick={togglePlay}
                    className="mx-1 inline-flex h-8 items-center gap-1.5 rounded-md bg-amber px-3.5 text-[12.5px] font-semibold text-sunk transition-colors hover:bg-[#ffb83d]"
                    aria-label={playing ? "Pause" : "Play"}
                    title="Play / pause (space)"
                  >
                    {playing ? <><I.Pause size={14} /> Pause</> : step >= total ? <><I.Restart size={14} /> Replay</> : <><I.Play size={14} /> Play</>}
                  </button>
                  <IconBtn label="Step forward (→)" onClick={() => stepBy(1)} disabled={step >= total}><span className="hidden xl:inline">Step forward</span><I.StepFwd size={15} /></IconBtn>
                </div>
                <div className="flex items-center gap-1 rounded-lg bg-raise p-1 ring-1 ring-line" role="group" aria-label="Auto-play speed">
                  <span className="px-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-faint">Auto-play</span>
                  {SPEEDS.map((x) => (
                    <button key={x} onClick={() => setSpeed(x)} className={`h-7 rounded-md px-2 font-mono text-[12px] transition-colors ${speed === x ? "bg-raise2 text-fg ring-1 ring-line2" : "text-faint hover:text-mute"}`}>{x}×</button>
                  ))}
                </div>
              </>
            )}
            {run && canGoLive && (
              <button onClick={exitReplay} className="h-9 rounded-lg px-3 text-[12px] font-medium text-mute ring-1 ring-line transition-colors hover:text-fg">Go live</button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line bg-panel/60 px-5 py-2">
          <nav className="flex flex-wrap gap-1.5" aria-label="Incidents">
            {INCIDENTS.map((inc) => {
              const meta = INCIDENT_META[inc];
              const r = runFor(inc);
              const active = activeIncident === inc;
              return (
                <button
                  key={inc}
                  disabled={!r}
                  onClick={() => r && startReplay(r.id)}
                  title={r ? `Replay the recorded ${inc} drill` : "No recording for this incident yet"}
                  className={`inline-flex h-8 items-center gap-2 rounded-full px-3 text-[12.5px] font-medium ring-1 ring-inset transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${active ? "bg-amber/12 text-fg ring-amber/60" : "text-mute ring-line hover:bg-raise hover:text-fg"}`}
                >
                  <span className={`font-mono text-[11px] ${active ? "text-amber" : "text-faint"}`}>{meta.n}</span>
                  {meta.label}
                </button>
              );
            })}
          </nav>

          {run ? (
            <div className="flex min-w-0 basis-[260px] flex-1 items-center gap-3">
              <div className="relative h-1.5 flex-1 rounded-full bg-raise2">
                <div className="absolute inset-y-0 left-0 rounded-full bg-amber transition-[width] duration-200" style={{ width: `${total ? (step / total) * 100 : 0}%` }} />
                <input
                  type="range" min={0} max={total} value={step}
                  onChange={(e) => { setPlaying(false); setStep(Number(e.target.value)); }}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label="Replay position"
                />
              </div>
              <span className="shrink-0 font-mono text-[11.5px] tabular-nums text-mute">
                {String(step).padStart(2, "0")}/{total}
                <span className="text-faint"> · {curFrame ? curFrame.kind : "start"}</span>
              </span>
            </div>
          ) : (
            <div className="flex-1 truncate font-mono text-[11.5px] text-faint">{WS_URL ? `following ${WS_URL}` : "no gate to follow"}</div>
          )}

          {run && (
            <button onClick={() => setShowEvidence(!showEvidence)} className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11.5px] text-mute ring-1 ring-line transition-colors hover:text-fg">
              <I.Info size={13} /> What's real
            </button>
          )}
        </div>

        {run && showEvidence && (
          <div className="fade border-t border-line bg-panel px-5 py-2.5 text-[12px] leading-relaxed text-mute">
            {run.provenance} Frames are replayed in the browser; nothing is sent to the gate.
          </div>
        )}
      </header>

      <main key={run?.id ?? "live"} className="fade grid flex-1 grid-cols-1 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)_minmax(0,1fr)]">
        <RoomPanel s={state} />
        <CasePanel s={state} />
        <VerdictPanel s={state} />
      </main>
      <Docket s={state} />
    </div>
  );
}

function StatusBadge({ run, link }: { run: Run | null; link: string }) {
  if (run) {
    const real = run.verifier !== "test-stand-in";
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex h-7 items-center gap-2 rounded-full bg-emerald/10 px-3 text-[11.5px] font-semibold tracking-wide text-emerald ring-1 ring-inset ring-emerald/40">
          <span className="dot h-2 w-2 rounded-full bg-emerald" />
          REPLAY MODE {real ? "(REAL VERIFIER EVIDENCE)" : "(TEST VERIFIER)"}
        </span>
        {run.scripted && (
          <span className="inline-flex h-7 items-center rounded-full px-2.5 text-[11px] font-semibold tracking-wide text-amber ring-1 ring-inset ring-amber/40" title={run.provenance}>
            SCRIPTED PARTICIPANTS
          </span>
        )}
      </div>
    );
  }
  const s: Record<string, [string, string]> = {
    live: ["● LIVE", "text-emerald ring-emerald/40 bg-emerald/10"],
    connecting: ["CONNECTING…", "text-amber ring-amber/40"],
    offline: ["GATE OFFLINE", "text-red ring-red/40"],
    static: ["STATIC DEMO · REPLAY ONLY", "text-amber ring-amber/40"],
  };
  const [text, cls] = s[link] ?? s.offline;
  return <span className={`inline-flex h-7 items-center rounded-full px-3 text-[11.5px] font-semibold tracking-wide ring-1 ring-inset ${cls}`}>{text}</span>;
}

function IconBtn({ children, onClick, label, disabled }: { children: ReactNode; onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium text-mute transition-colors hover:bg-raise2 hover:text-fg disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </button>
  );
}
