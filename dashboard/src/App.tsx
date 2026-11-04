import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CasePanel, RoomPanel, VerdictPanel } from "./components";
import { Docket } from "./Docket";
import { fixtureRuns, gateRuns, type Run } from "./fixtures";
import * as I from "./icons";
import { INCIDENTS, replay, stamp } from "./model";
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

  const jumpTo = (position: number) => { setPlaying(false); setStep(position); };
  const tone = stamp(state).tone;

  return (
    <div className={"console-shell tone-" + tone} data-ui>
      <a className="skip-link" href="#workspace">Skip to courtroom</a>
      <header className="command-bar">
        <div className="command-top">
          <div className="brand">
            <span className="brand-mark"><I.Flame size={25} /></span>
            <div>
              <h1>FIREDRILL <span>// COURTROOM</span></h1>
              <p>Enforced Multi-Agent Hotfix Gate on Switch</p>
            </div>
          </div>
          <div className="mode-cluster">
            <StatusBadge run={run} link={link} />
            <button className="quiet-button" disabled={!runs.length} onClick={() => startReplay(run?.id ?? runs[0].id)}><I.Play size={12} />Judge Demo Mode</button>
            {run && <button className="quiet-button evidence-button" aria-expanded={showEvidence} aria-controls="evidence-note" onClick={() => setShowEvidence(!showEvidence)}><I.Info size={14} /> Evidence</button>}
            {run && canGoLive && <button className="quiet-button" onClick={exitReplay}>Go live</button>}
          </div>
        </div>
        <div className="command-controls">
          <nav className="incident-switcher" aria-label="Incidents">
            {INCIDENTS.map((inc) => {
              const r = runFor(inc);
              return <button key={inc} disabled={!r} aria-pressed={activeIncident === inc} onClick={() => r && startReplay(r.id)} title={r ? "Replay " + inc : "No recording available"}>
                <span>{INCIDENT_META[inc].n}</span>{inc}
              </button>;
            })}
          </nav>
          {run ? <div className="transport" role="group" aria-label="Replay transport">
            <IconBtn label="Reset replay" onClick={() => jumpTo(0)} disabled={step === 0}><I.Restart size={14} /><span>Reset</span></IconBtn>
            <IconBtn label="Previous step (left arrow)" onClick={() => stepBy(-1)} disabled={step === 0}><I.StepBack size={14} /><span>Prev</span></IconBtn>
            <button className="play-button" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"} aria-keyshortcuts="Space" title="Play / pause (space)">
              {playing ? <I.Pause size={14} /> : <I.Play size={14} />}{playing ? "Pause" : "Play"}<kbd>␣</kbd>
            </button>
            <IconBtn label="Next step (right arrow)" onClick={() => stepBy(1)} disabled={step >= total}><span>Next</span><I.StepFwd size={14} /></IconBtn>
            <IconBtn label="Jump to end" onClick={() => jumpTo(total)} disabled={step >= total}><span>End</span><I.StepFwd size={14} /></IconBtn>
            <button className="speed-button" aria-label={"Playback speed " + speed + " times"} title="Toggle playback speed" onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}>{speed}×</button>
            <span className="step-counter">STEP <strong>{String(step).padStart(2, "0")}</strong> / {total}</span>
          </div> : <button className="play-button" disabled={!runs.length} onClick={() => runs[0] && startReplay(runs[0].id)}><I.Play size={14} />Judge Demo Mode</button>}
        </div>
        {run && showEvidence && <div id="evidence-note" className="evidence-note">{run.provenance} Frames are replayed in the browser; nothing is sent to the gate.</div>}
      </header>
      <div className="workspace-caption">
        <div><span className="connection-mark" aria-hidden="true" /><span>{activeIncident ?? "Waiting for a docket"}</span><span className="caption-divider">/</span><span>Adversarial verification</span></div>
        <span>{run ? "RECORDED EVIDENCE · " + total + " FRAMES" : "ROOM TELEMETRY"}</span>
      </div>
      <main id="workspace" key={run?.id ?? "live"} className="workspace" tabIndex={-1}>
        <RoomPanel s={state} />
        <CasePanel s={state} />
        <VerdictPanel s={state} />
      </main>
      <Docket s={state} frames={run?.frames} step={step} onSeek={jumpTo} />
      <div className="console-footnote"><span>SWITCH CONNECTS THE ROOM. FIREDRILL ENFORCES THE GATE.</span><span>{run?.scripted ? `SCRIPTED PARTICIPANTS / ${run.verifier === "test-stand-in" ? "TEST VERIFIER" : "REAL VERIFIER"}` : run ? "RECORDED ROOM" : "LIVE CONNECTION"}{curFrame ? " · " + curFrame.kind : ""}</span></div>
    </div>
  );
}

function StatusBadge({ run, link }: { run: Run | null; link: string }) {
  if (run) return <div className="status-badges">
    <span className="mode-badge"><span aria-hidden="true" />{run.verifier !== "test-stand-in" ? "VERIFIED REPLAY" : "TEST VERIFIER REPLAY"}</span>
    {run.scripted && <span className="scripted-badge" title={run.provenance}>SCRIPTED PARTICIPANTS</span>}
  </div>;
  const labels: Record<string, string> = { live: "LIVE TELEMETRY WS", connecting: "CONNECTING…", offline: "GATE OFFLINE", static: "REPLAY ONLY" };
  return <span className={"mode-badge link-" + link}><span aria-hidden="true" />{labels[link] ?? "GATE OFFLINE"}</span>;
}

function IconBtn({ children, onClick, label, disabled }: { children: ReactNode; onClick: () => void; label: string; disabled?: boolean }) {
  return <button className="transport-button" onClick={onClick} disabled={disabled} title={label} aria-label={label}>{children}</button>;
}
