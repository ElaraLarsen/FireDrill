import { useMemo } from "react";
import { milestones } from "./milestones";
import { stages } from "./views";
import type { Frame, State } from "./model";
import * as I from "./icons";

export function Docket({ s, frames, step, onSeek }: { s: State; frames?: Frame[]; step: number; onSeek: (step: number) => void }) {
  const beats = useMemo(() => frames ? milestones(frames) : [], [frames]);
  const total = frames?.length ?? 0;
  const active = beats.reduce((last, beat, index) => beat.step <= step ? index : last, -1);
  return <footer className="docket">
    <div className="docket-heading">
      <h2><I.Branch size={15} />Courtroom docket</h2>
      <span>{frames ? "SELECT A MILESTONE TO INSPECT THE EVIDENCE" : "DERIVED FROM ROOM EVENTS"}</span>
      {frames && <span className="docket-position">{step} / {total}</span>}
    </div>
    {frames ? <>
      <div className="scrubber">
        <div className="scrubber-track"><span style={{ transform: `scaleX(${total ? step / total : 0})` }} /></div>
        <input type="range" min={0} max={total} value={step} onChange={(e) => onSeek(Number(e.target.value))} aria-label="Replay position" aria-valuetext={`Step ${step} of ${total}`} />
      </div>
      <ol className="milestone-list">
        {beats.map((beat, index) => <li key={beat.step}>
          <button className={`milestone ${step >= beat.step ? "reached" : "upcoming"} milestone-${beat.tone}`} aria-current={index === active ? "step" : undefined} title={`Step ${beat.step}: ${beat.label} — ${beat.detail}`} onClick={() => onSeek(beat.step)}>
            <span className="milestone-top"><span className="milestone-dot">{step >= beat.step ? beat.tone === "red" ? <I.Cross size={10} /> : <I.Check size={10} /> : <span />}</span><code>{String(beat.step).padStart(2, "0")}</code></span>
            <strong>{beat.label}</strong><small>{beat.detail}</small>
          </button>
        </li>)}
      </ol>
    </> : <ol className="live-stages">{stages(s).map((stage) => <li key={stage.key} data-state={stage.state}><strong>{stage.label}</strong><span>{stage.detail || stage.state}</span></li>)}</ol>}
  </footer>;
}
