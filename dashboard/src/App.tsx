import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fixtureRuns, gateRuns, type Run } from "./fixtures";
import { confetti, installTapFeedback } from "./fx";
import { replay } from "./model";
import { narrate, narrateState, stageSteps } from "./story";
import { Caption } from "./ui/Caption";
import { CaseFile } from "./ui/CaseFile";
import { Header } from "./ui/Header";
import { Journey } from "./ui/Journey";
import { Room } from "./ui/Room";
import { Verdict } from "./ui/Verdict";
import { useLive } from "./useLive";
import { stages } from "./views";

// The gate runs on the same machine as the dashboard. On a hosted copy (Vercel, Pages, ...) there is
// no gate to follow, so unless VITE_TELEMETRY_URL says otherwise the dashboard is replay-only.
const host = typeof location !== "undefined" ? location.hostname : "";
const isLocal = host === "" || host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host.endsWith(".local");
const WS_URL: string | null = (import.meta.env.VITE_TELEMETRY_URL as string | undefined) ?? (isLocal ? `ws://${host || "localhost"}:8787/telemetry` : null);
const HTTP_URL = WS_URL ? WS_URL.replace(/^ws/, "http").replace(/\/telemetry$/, "") : null;

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
  const [evidence, setEvidence] = useState(false);
  const chosen = useRef(Boolean(deep));

  useEffect(() => installTapFeedback(), []);

  useEffect(() => {
    let alive = true;
    if (!HTTP_URL) return;
    gateRuns(HTTP_URL).then((g) => { if (alive && g.length) setRuns((r) => [...g, ...r.filter((x) => x.source === "fixture")]); });
    return () => { alive = false; };
  }, [link]);

  // No gate to follow: open the first recording at its start, ready to play, until someone picks.
  useEffect(() => {
    if (chosen.current || runId || !runs.length) return;
    if (link === "static" || link === "offline") { setRunId(runs[0].id); setStep(0); }
  }, [link, runs, runId]);

  const run = useMemo(() => runs.find((r) => r.id === runId) ?? null, [runs, runId]);
  const total = run?.frames.length ?? 0;
  const steps = useMemo(() => (run ? stageSteps(run.frames) : {}), [run]);

  useEffect(() => {
    if (!playing || !run) return;
    if (step >= total) { setPlaying(false); return; }
    // Check rows stream quickly; verdicts and room events linger so people can read them.
    const next = run.frames[step]?.kind;
    const base = next === "check" ? 320 : next === "verdict" || next === "merge" ? 1500 : 1000;
    const t = window.setTimeout(() => setStep((s) => Math.min(total, s + 1)), base / speed);
    return () => window.clearTimeout(t);
  }, [playing, step, total, speed, run]);

  const pick = useCallback((id: string) => { chosen.current = true; setRunId(id); setStep(0); setPlaying(true); }, []);
  const goLive = () => { chosen.current = true; setRunId(null); setPlaying(false); };
  const toggle = useCallback(() => {
    if (!run) return;
    if (step >= total) { setStep(0); setPlaying(true); } else setPlaying((p) => !p);
  }, [run, step, total]);
  const stepBy = useCallback((d: number) => { setPlaying(false); setStep((s) => Math.max(0, Math.min(total, s + d))); }, [total]);
  const jump = useCallback((n: number) => { setPlaying(false); setStep(Math.max(0, Math.min(total, n))); }, [total]);

  // Space plays/pauses, arrows step, while no control has focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!run || (e.target as HTMLElement)?.closest?.("input, select, textarea, summary, button")) return;
      if (e.key === " ") { e.preventDefault(); toggle(); }
      else if (e.key === "ArrowRight") stepBy(1);
      else if (e.key === "ArrowLeft") stepBy(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run, toggle, stepBy]);

  const state = run ? replay(run.frames, step) : liveState;
  const frame = run && step > 0 ? run.frames[step - 1] : null;
  const line = run ? narrate(frame, state.approvers) : narrateState(state);

  // Celebrate the moment the gate merges (not when a page simply opens on a merged drill).
  const merged = state.verdicts.some((v) => v.merged);
  const wasMerged = useRef<boolean | null>(null);
  useEffect(() => {
    if (wasMerged.current === false && merged) confetti();
    wasMerged.current = merged;
  }, [merged]);

  return (
    <div className="relative min-h-full pb-4 lg:flex lg:h-full lg:flex-col lg:pb-0">
      <a href="#evidence" className="skip">Skip to the evidence</a>
      <div className="aurora" aria-hidden><i /><i /><i /><i /></div>

      <Header
        run={run} link={link}
        runFor={(inc) => runs.find((r) => r.incident === inc)}
        activeIncident={run?.incident ?? liveState.incident}
        onPick={pick}
        playing={playing} atEnd={step >= total} atStart={step === 0} speed={speed}
        onToggle={toggle} onStep={stepBy} onSpeed={setSpeed}
        onLive={run && (link === "live" || link === "connecting") ? goLive : undefined}
        evidence={evidence} onEvidence={() => setEvidence(!evidence)}
      />

      {run && evidence && (
        <div className="slideup relative z-10 mx-4 mt-3 rounded-2xl bg-white/95 px-5 py-3 text-[13px] leading-relaxed text-ink2 shadow-sm ring-1 ring-line sm:mx-6">
          <b className="text-ink">What's real here: </b>{run.provenance} Frames are replayed in your browser; nothing is sent to the gate.
        </div>
      )}

      <Journey stages={stages(state)} steps={steps} frames={run?.frames ?? null} step={step} onJump={jump} />
      <Caption line={line} k={`${run?.id}-${step}`} onTap={run && step < total ? () => stepBy(1) : undefined} />

      <main id="evidence" tabIndex={-1} key={run?.id ?? "live"} className="slideup outline-none relative z-10 grid gap-4 px-4 pb-4 pt-3 sm:px-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)]">
        <Room s={state} />
        <CaseFile s={state} />
        <Verdict s={state} />
      </main>
    </div>
  );
}
