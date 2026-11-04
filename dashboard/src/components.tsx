import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  COMMAND_RE, INCIDENTS, attackMatrix, badge, faced, latest, short, signOff, stamp, stateLabel,
  type Msg, type RoleBadge, type State, type Verdict,
} from "./model";

const TONE: Record<RoleBadge["tone"], string> = {
  fixer: "text-steel border-steel/60",
  breaker: "text-hot border-hot/60",
  gate: "text-amber border-amber/70",
  approver: "text-ok border-ok/60",
  human: "text-dim border-line",
};

const hhmmss = (ts: string) => (ts ? new Date(ts).toLocaleTimeString([], { hour12: false }) : "");

export function Panel({ title, sub, children, follow }: { title: string; sub?: string; children: ReactNode; follow?: number }) {
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (follow !== undefined && body.current) body.current.scrollTop = body.current.scrollHeight;
  }, [follow]);
  return (
    <section className="flex min-h-0 flex-col border-r border-line bg-panel last:border-r-0">
      <header className="flex items-baseline justify-between border-b border-line bg-raise px-4 py-2">
        <h2 className="text-[13px] font-bold uppercase tracking-[0.18em] text-amber">{title}</h2>
        {sub && <span className="text-[11px] text-dim">{sub}</span>}
      </header>
      <div ref={body} className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
    </section>
  );
}

// ── Left: Switch Room Mirror ─────────────────────────────────────────────
function Body({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(COMMAND_RE)) {
    const i = m.index ?? 0;
    parts.push(text.slice(last, i));
    parts.push(
      <span key={i} className="mx-0.5 rounded-sm bg-amber px-1.5 py-px font-bold text-ink">
        @firedrill-gate <span className="uppercase">{m[1]}</span>
      </span>,
    );
    last = i + m[0].length;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}

function Line({ m, approvers }: { m: Msg; approvers: string[] }) {
  const [open, setOpen] = useState(false);
  const b = badge(m.actor, approvers);
  const long = m.body.length > 280 || m.body.split("\n").length > 5;
  return (
    <li className={`rowin mb-3 border-l-2 pl-3 ${m.addressed ? "border-amber" : "border-line"}`}>
      <div className="mb-0.5 flex items-center gap-2 text-[11px]">
        <span className={`rounded-sm border px-1.5 py-px font-bold ${TONE[b.tone]}`}>{b.text}</span>
        <span className="text-dim">{m.actor.name}</span>
        <span className="ml-auto text-dim">{hhmmss(m.ts)}</span>
      </div>
      <p
        className={`whitespace-pre-wrap break-words text-[13px] leading-snug ${long && !open ? "line-clamp-5" : ""} ${m.actor.role === "gate" ? "text-bone" : "text-bone/90"}`}
        onClick={() => long && setOpen(!open)}
      >
        <Body text={m.body} />
      </p>
      {long && (
        <button className="mt-0.5 text-[11px] text-dim hover:text-bone" onClick={() => setOpen(!open)}>
          {open ? "collapse" : "expand"}
        </button>
      )}
    </li>
  );
}

export function RoomPanel({ s }: { s: State }) {
  return (
    <Panel title="Switch Room Mirror" sub={s.roomName || s.roomId || "waiting for a room"} follow={s.messages.length}>
      {s.messages.length === 0 ? (
        <Empty>
          {s.frames > 0
            ? "This record has no room traffic: it holds the gate's verification actions only."
            : "No room traffic yet. The gate mirrors every message in the room it guards."}
        </Empty>
      ) : (
        <ul>{s.messages.map((m) => <Line key={m.key} m={m} approvers={s.approvers} />)}</ul>
      )}
    </Panel>
  );
}

// ── Centre: The Case & Adversarial Matrix ────────────────────────────────
function Chip({ children, tone = "dim" }: { children: ReactNode; tone?: "dim" | "amber" | "ok" | "hot" }) {
  const c = { dim: "border-line text-dim", amber: "border-amber text-amber", ok: "border-ok text-ok", hot: "border-hot text-hot" }[tone];
  return <span className={`rounded-sm border px-1.5 py-px text-[11px] font-bold uppercase ${c}`}>{children}</span>;
}

export function CasePanel({ s, hasRun, onPickIncident }: { s: State; hasRun: (incident: string) => boolean; onPickIncident: (incident: string) => void }) {
  const fix = latest(s.fixes);
  const atk = latest(s.attacks);
  const matrixVerdict = [...s.verdicts].reverse().find((v) => faced(v) && v.result !== "PENDING");
  const trial = latest(s.verdicts);
  const rows = attackMatrix(matrixVerdict);
  return (
    <Panel title="The Case & Adversarial Matrix" sub={s.incident ?? "no incident"}>
      <div className="mb-4 flex flex-wrap gap-2">
        {INCIDENTS.map((i) => {
          const active = s.incident === i;
          const rec = hasRun(i);
          return (
            <button
              key={i}
              disabled={!rec && !active}
              onClick={() => onPickIncident(i)}
              title={rec ? "Replay the recorded drill for this incident" : "No recorded drill for this incident yet"}
              className={`rounded-sm border px-2.5 py-1 text-[12px] font-bold ${active ? "border-amber bg-amber text-ink" : rec ? "border-line text-bone hover:border-amber" : "cursor-not-allowed border-line/60 text-dim/60"}`}
            >
              {i}
            </button>
          );
        })}
      </div>

      {s.brief && (
        <pre className="mb-4 max-h-28 overflow-y-auto whitespace-pre-wrap border border-line bg-ink p-2 text-[12px] leading-snug text-bone/90">{s.brief}</pre>
      )}

      <h3 className="mb-1 text-[11px] uppercase tracking-[0.18em] text-dim">Fix under trial</h3>
      {fix ? (
        <div className="mb-5 border border-line bg-raise p-3">
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="font-bold text-steel">{fix.branch}</span>
            <span className="text-bone">@ {short(fix.sha)}</span>
            {fix.manual && <Chip tone="amber">manual / scripted</Chip>}
          </div>
          <div className="mt-1 text-[12px] text-dim">submitted by {fix.by}{fix.at ? ` · ${hhmmss(fix.at)}` : ""}</div>
          {fix.diff_stat ? (
            <div className="mt-2 text-[12px]">
              <span className="text-bone">{fix.diff_stat.files} file{fix.diff_stat.files === 1 ? "" : "s"}</span>{" "}
              <span className="text-ok">+{fix.diff_stat.insertions}</span>{" "}
              <span className="text-hot">−{fix.diff_stat.deletions}</span>
              <div className="mt-0.5 text-dim">{fix.diff_stat.names.join(" · ")}</div>
            </div>
          ) : (
            <div className="mt-2 text-[12px] text-dim">diff stat not in telemetry</div>
          )}
          <div className="mt-2 text-[11px] text-dim">{s.fixes.length} submission{s.fixes.length === 1 ? "" : "s"} so far</div>
        </div>
      ) : trial?.candidate ? (
        <div className="mb-5 border border-line bg-raise p-3">
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="font-bold text-steel">{stateLabel(trial.state) ?? "Candidate"}</span>
            <span className="text-bone">@ {short(trial.candidate)}</span>
            <Chip tone="amber">scripted</Chip>
          </div>
          <div className="mt-1 text-[12px] text-dim">
            A real commit verified by the gate. No submission message was recorded for it.
          </div>
        </div>
      ) : (
        <Empty>No fix submitted.</Empty>
      )}

      <h3 className="mb-1 text-[11px] uppercase tracking-[0.18em] text-dim">
        Red-team attack matrix{atk ? ` · ${atk.branch} @ ${short(atk.sha)} by ${atk.by}${atk.manual ? " (manual)" : ""}` : matrixVerdict ? ` · ${matrixVerdict.id}` : ""}
      </h3>
      {rows.length === 0 ? (
        <Empty>{atk ? "Attack filed. Waiting on a verdict that ran it." : "No attack has faced a fix yet. No attack, no sign-off."}</Empty>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.name} className="rowin border border-line bg-raise p-2.5 text-[12px]">
              <div className="break-all font-bold text-bone">{r.name}</div>
              {r.discarded ? (
                <div className="mt-1 text-hot">✗ Discarded by Rule R3 — {r.discarded}</div>
              ) : (
                <>
                  {r.reference && (
                    <div className={r.reference === "pass" ? "mt-1 text-ok" : "mt-1 text-hot"}>
                      {r.reference === "pass" ? "✓ Passed against Reference Fix (valid attack)" : `✗ ${r.reference} against Reference Fix`}
                    </div>
                  )}
                  {r.fix && (
                    <div className={r.fix === "pass" ? "mt-0.5 text-ok" : "mt-0.5 text-hot"}>
                      {r.fix === "pass" ? "✓ Fix survived this attack" : "✗ Fix broken by this attack"}
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// ── Right: The Verdict & Enforced Gate ───────────────────────────────────
const STAMP: Record<string, string> = {
  idle: "border-line text-dim",
  pending: "border-amber text-amber",
  red: "border-hot text-hot bg-hot/10",
  green: "border-ok text-ok bg-ok/10",
  merged: "border-ok bg-ok text-ink",
  error: "border-violet text-violet",
};

function CheckRow({ c }: { c: Verdict["checks"][number] }) {
  const ok = c.status === "pass";
  return (
    <li className="rowin border-b border-line/70 py-1.5 text-[12px]">
      <details>
        <summary className="flex cursor-pointer list-none items-center gap-2">
          <span className={`w-4 font-bold ${ok ? "text-ok" : "text-hot"}`}>{ok ? "✓" : "✗"}</span>
          <span className="min-w-0 truncate font-bold text-bone" title={c.name}>{c.name}</span>
          <span className="shrink-0 text-dim">{c.kind} vs {c.against}</span>
          <span className="ml-auto shrink-0 text-dim">{c.duration_ms ?? "—"} ms</span>
        </summary>
        <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap bg-ink p-2 text-[11px] text-dim">{c.output_tail?.trim() || "(no output captured)"}</pre>
      </details>
    </li>
  );
}

export function VerdictPanel({ s }: { s: State }) {
  const st = stamp(s);
  const v = latest(s.verdicts);
  const so = signOff(s);
  const lastRej = latest(s.rejections);
  const soTone = { no_attack: "border-amber text-amber", blocked: "border-hot text-hot", awaiting: "border-amber bg-amber/10 text-amber", signed: "border-ok text-ok", merged: "border-ok bg-ok text-ink" }[so.phase];
  return (
    <Panel title="The Verdict & Enforced Gate" sub={v ? v.id : ""}>
      <div key={st.label} className={`slam mb-4 border-4 px-3 py-4 text-center text-xl font-black uppercase leading-tight tracking-wide ${STAMP[st.tone]}`}>
        {st.label}
      </div>

      {v && v.result === "PENDING" && <div className="pulse-bar mb-3 h-1 bg-amber" />}
      {v ? (
        <>
          <ul className="mb-2">{v.checks.map((c, i) => <CheckRow key={`${c.name}-${c.against}-${i}`} c={c} />)}</ul>
          {v.runner && <div className="mb-3 text-[11px] text-dim">runner {v.runner.image ?? "?"} · network {v.runner.network ?? "?"}</div>}
          {v.notes.map((n, i) => <div key={i} className="mb-1 text-[12px] text-violet">note: {n}</div>)}
        </>
      ) : (
        <Empty>Verdicts appear here as the gate runs the repro, the attacks and the invariant.</Empty>
      )}

      <div className={`mt-5 border-2 p-3 ${soTone}`}>
        <div className="mb-1 text-[11px] uppercase tracking-[0.18em] opacity-80">Enforced sign-off</div>
        <div className="text-[14px] font-bold leading-snug">{so.text}</div>
        {so.phase === "awaiting" && (
          <div className="mt-2 break-all text-[12px] text-bone">@firedrill-gate APPROVE {so.verdictId}</div>
        )}
        {s.messages.length === 0 && s.fixes.length === 0 && so.phase !== "merged" && (
          <div className="mt-2 text-[12px] font-bold text-bone">This recording stops at the verdict: no human sign-off or merge was recorded.</div>
        )}
        <div className="mt-2 text-[11px] opacity-80">
          Authenticated by Switch participant id, not message text. The gate alone holds the merge key.
        </div>
      </div>
      {lastRej && !v?.merged && (
        <div className="mt-3 border border-hot/60 p-2 text-[12px] text-hot">
          Last refusal ({lastRej.by}): {lastRej.reason}
        </div>
      )}
    </Panel>
  );
}

// ── Bottom: Courtroom Docket Timeline ────────────────────────────────────
export function Docket({ s }: { s: State }) {
  const chips: { key: string; head: string; line: string; tone: string }[] = [];
  for (const v of s.verdicts) {
    const tone = v.result === "GREEN" ? "border-ok text-ok" : v.result === "RED" ? "border-hot text-hot" : v.result === "ERROR" ? "border-violet text-violet" : "border-amber text-amber";
    const note = stateLabel(v.state, "short") ?? (v.result === "RED" ? (faced(v) ? "broken by red-team" : "repro failed") : v.result === "GREEN" ? (faced(v) ? "survived attacks" : "repro only") : v.result.toLowerCase());
    chips.push({ key: v.id, head: v.id.replace(/^V-.*-(\d+)$/, "V-$1"), line: `${v.result} · ${note} · ${short(v.fix?.sha ?? v.candidate)}`, tone });
    if (v.signoff) chips.push({ key: `${v.id}-so`, head: "Human sign-off", line: `${v.signoff.by} approved ${v.id}`, tone: "border-ok text-ok" });
    if (v.merged) chips.push({ key: `${v.id}-m`, head: "Merged", line: `main ${short(v.merged.main_sha)}`, tone: "border-ok bg-ok text-ink" });
  }
  return (
    <footer className="border-t border-line bg-raise px-4 py-2">
      <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-amber">Courtroom docket</div>
      {chips.length === 0 ? (
        <div className="py-2 text-[12px] text-dim">Docket empty.</div>
      ) : (
        <ol className="flex items-stretch gap-2 overflow-x-auto pb-1">
          {chips.map((c, i) => (
            <li key={c.key} className="rowin flex shrink-0 items-center gap-2">
              {i > 0 && <span className="text-dim">→</span>}
              <div className={`border-2 px-3 py-1.5 ${c.tone}`}>
                <div className="text-[13px] font-black">{c.head}</div>
                <div className="text-[11px]">{c.line}</div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </footer>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="border border-dashed border-line p-3 text-[12px] text-dim">{children}</p>;
}
