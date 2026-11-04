import { useEffect, useRef, useState, type ReactNode } from "react";
import * as I from "./icons";
import {
  COMMAND_RE, attackMatrix, badge, faced, latest, short, signOff, stamp, stateLabel,
  type AttackRow, type Check, type Msg, type RoleBadge, type State, type Verdict,
} from "./model";
import { INCIDENT_META, brief, failedAgainstFix, groupChecks, stages, testName, type Stage } from "./views";

const hhmmss = (ts: string) => (ts ? new Date(ts).toLocaleTimeString([], { hour12: false }) : "");
const vshort = (id: string) => id.replace(/^V-.*-(\d+)$/, "V-$1");

// ── shared ──────────────────────────────────────────────────────────────
const ROLE: Record<RoleBadge["tone"], { chip: string; accent: string }> = {
  fixer: { chip: "text-indigo bg-indigo/10 ring-indigo/35", accent: "bg-indigo" },
  breaker: { chip: "text-emerald bg-emerald/10 ring-emerald/35", accent: "bg-emerald" },
  gate: { chip: "text-amber bg-amber/10 ring-amber/40", accent: "bg-amber" },
  approver: { chip: "text-cyan bg-cyan/10 ring-cyan/35", accent: "bg-cyan" },
  human: { chip: "text-mute bg-raise2 ring-line2", accent: "bg-line2" },
};
const VERB: Record<string, string> = {
  SUBMIT: "text-indigo bg-indigo/12 ring-indigo/40",
  ATTACK: "text-emerald bg-emerald/12 ring-emerald/40",
  APPROVE: "text-cyan bg-cyan/12 ring-cyan/40",
  STATUS: "text-mute bg-raise2 ring-line2",
};

export function Panel({ title, meta, children, follow }: { title: string; meta?: ReactNode; children: ReactNode; follow?: number }) {
  const body = useRef<HTMLDivElement>(null);
  const settled = useRef(false);
  useEffect(() => {
    // Jump straight to the newest message on first paint (deep links, refresh); glide after that.
    if (follow === undefined || !body.current) return;
    body.current.scrollTo({ top: body.current.scrollHeight, behavior: settled.current ? "smooth" : "auto" });
    settled.current = true;
  }, [follow]);
  return (
    <section className="flex min-w-0 flex-col border-b border-line bg-panel lg:min-h-0 lg:border-b-0 lg:border-r lg:last:border-r-0">
      <header className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-line px-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mute">{title}</h2>
        <div className="min-w-0 truncate font-mono text-[11px] text-faint">{meta}</div>
      </header>
      <div ref={body} className="max-h-[70vh] flex-1 overflow-y-auto px-4 py-3 lg:max-h-none lg:min-h-0">{children}</div>
    </section>
  );
}

function Pill({ tone, children, title }: { tone: "ok" | "bad" | "warn" | "muted" | "info"; children: ReactNode; title?: string }) {
  const c = {
    ok: "text-emerald bg-emerald/10 ring-emerald/35",
    bad: "text-red bg-red/12 ring-red/40",
    warn: "text-amber/90 bg-amber/[.07] ring-amber/30",
    muted: "text-faint bg-raise2 ring-line2",
    info: "text-cyan bg-cyan/10 ring-cyan/35",
  }[tone];
  return (
    <span title={title} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${c}`}>
      {children}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-dashed border-line2 px-3 py-3 text-[12.5px] leading-relaxed text-faint">{children}</p>;
}

function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 mt-5 flex items-center justify-between gap-3 first:mt-0">
      <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-faint">{children}</h3>
      {right}
    </div>
  );
}

// Mattermost renders the gate's markdown; mirror the two forms it uses (**bold**, `code`).
function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((t, i) =>
        t.startsWith("**") && t.endsWith("**") && t.length > 4 ? <strong key={i} className="font-semibold text-fg">{t.slice(2, -2)}</strong>
        : t.startsWith("`") && t.endsWith("`") && t.length > 2 ? <code key={i} className="rounded bg-sunk px-1 py-px font-mono text-[11.5px] text-fg/90 ring-1 ring-line">{t.slice(1, -1)}</code>
        : t)}
    </>
  );
}

// ── Left: Switch Room live stream ────────────────────────────────────────
function Body({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(COMMAND_RE)) {
    const i = m.index ?? 0;
    const verb = m[1].toUpperCase();
    parts.push(<Inline key={`t${i}`} text={text.slice(last, i)} />);
    parts.push(
      <span key={i} className={`mr-1 inline-flex items-center gap-1 rounded px-1.5 py-px align-baseline font-mono text-[11.5px] ring-1 ring-inset ${VERB[verb] ?? VERB.STATUS}`}>
        <span className="opacity-60">@firedrill-gate</span>
        <span className="font-bold tracking-wide">{verb}</span>
      </span>,
    );
    last = i + m[0].length;
  }
  parts.push(<Inline key="tail" text={text.slice(last)} />);
  return <>{parts}</>;
}

function Message({ m, approvers }: { m: Msg; approvers: string[] }) {
  const [open, setOpen] = useState(false);
  const b = badge(m.actor, approvers);
  const refused = m.actor.role === "gate" && m.body.startsWith("Rejected:");
  const merged = m.actor.role === "gate" && m.body.startsWith("MERGED.");
  const long = m.body.length > 260 || m.body.split("\n").length > 5;
  const accent = refused ? "bg-red" : merged ? "bg-emerald" : ROLE[b.tone].accent;
  return (
    <li className={`rise relative overflow-hidden rounded-md border border-line bg-raise py-2 pl-3.5 pr-3 transition-colors ${m.addressed || m.actor.role === "gate" ? "" : "opacity-60"}`}>
      <span className={`absolute inset-y-0 left-0 w-[3px] ${accent}`} />
      <div className="mb-1 flex items-center gap-2">
        <span className={`rounded px-1.5 py-px font-mono text-[10.5px] font-semibold ring-1 ring-inset ${ROLE[b.tone].chip}`}>{b.text}</span>
        <span className="truncate text-[11.5px] text-mute">{m.actor.name}</span>
        {refused && <Pill tone="bad"><I.Cross size={10} /> refused</Pill>}
        <span className="ml-auto shrink-0 font-mono text-[10.5px] text-faint">{hhmmss(m.ts)}</span>
      </div>
      <p className={`whitespace-pre-wrap break-words text-[13px] leading-[1.5] text-fg/90 ${long && !open ? "line-clamp-4" : ""}`}>
        <Body text={m.body} />
      </p>
      {long && (
        <button className="mt-1 text-[11px] font-medium text-faint transition-colors hover:text-fg" onClick={() => setOpen(!open)}>
          {open ? "Show less" : "Show more"}
        </button>
      )}
    </li>
  );
}

export function RoomPanel({ s }: { s: State }) {
  return (
    <Panel title="Switch Room · live stream" meta={s.roomName || s.roomId || "no room"} follow={s.messages.length}>
      {s.messages.length === 0 ? (
        <Empty>
          {s.frames > 0
            ? "This record has no room traffic: it holds the gate's verification actions only."
            : "No room traffic yet. The gate mirrors every message in the room it guards."}
        </Empty>
      ) : (
        <ul className="space-y-2">{s.messages.map((m) => <Message key={m.key} m={m} approvers={s.approvers} />)}</ul>
      )}
    </Panel>
  );
}

// ── Centre: The Case & Adversarial Matrix ────────────────────────────────
function BriefCard({ s }: { s: State }) {
  const [more, setMore] = useState(false);
  const b = brief(s.brief);
  const fix = latest(s.fixes);
  const trial = latest(s.verdicts);
  const meta = s.incident ? INCIDENT_META[s.incident] : undefined;
  return (
    <section className="rounded-lg border border-line bg-raise">
      <div className="px-4 pb-3 pt-3.5">
        <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-faint">
          {meta && <span className="font-mono text-amber">{meta.n}</span>}
          <span>Incident brief</span>
          {s.incident && <span className="ml-auto font-mono normal-case tracking-normal">{s.incident}</span>}
        </div>
        {b ? (
          <>
            <h3 className="mt-1.5 text-[16px] font-semibold leading-snug text-fg">{b.title || meta?.label}</h3>
            <p className={`mt-1.5 text-[13px] leading-relaxed text-mute ${more ? "" : "line-clamp-3"}`}><Inline text={b.overview} /></p>
            {more && b.rest && <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-mute"><Inline text={b.rest} /></p>}
            {(b.rest || b.overview.length > 180) && (
              <button className="mt-1 text-[11px] font-medium text-faint hover:text-fg" onClick={() => setMore(!more)}>{more ? "Less" : "Full brief"}</button>
            )}
          </>
        ) : (
          <p className="mt-1.5 text-[13px] text-faint">The brief appears when the gate opens the docket.</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line px-4 py-2.5">
        {fix ? (
          <>
            <span className="inline-flex items-center gap-1.5 font-mono text-[12px] text-indigo"><I.Branch size={13} />{fix.branch}</span>
            <span className="rounded bg-sunk px-1.5 py-px font-mono text-[12px] text-fg ring-1 ring-line">{short(fix.sha)}</span>
            {fix.diff_stat && (
              <span className="font-mono text-[11.5px]">
                <span className="text-emerald">+{fix.diff_stat.insertions}</span> <span className="text-red">−{fix.diff_stat.deletions}</span>
                <span className="text-faint"> · {fix.diff_stat.names.join(", ")}</span>
              </span>
            )}
            {fix.manual && <Pill tone="warn">manual</Pill>}
            <span className="ml-auto text-[11.5px] text-faint">patch {s.fixes.length} · {fix.by}</span>
          </>
        ) : trial?.candidate ? (
          <>
            <span className="text-[12px] font-medium text-indigo">{stateLabel(trial.state) ?? "Candidate"}</span>
            <span className="rounded bg-sunk px-1.5 py-px font-mono text-[12px] text-fg ring-1 ring-line">{short(trial.candidate)}</span>
            <Pill tone="warn">scripted</Pill>
          </>
        ) : (
          <span className="text-[12px] text-faint">No fix submitted yet.</span>
        )}
      </div>
    </section>
  );
}

const R3 = "Rule R3: an attack counts only if it also passes against the gate's private reference fix. A test that fails on correct code is thrown out, so the red team can't win with a wrong test.";

function MatrixRow({ r }: { r: AttackRow }) {
  return (
    <li className="rise grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-t border-line px-3 py-2 first:border-t-0">
      <span className="truncate font-mono text-[12px] text-fg" title={r.name}>{testName(r.name)}</span>
      {r.discarded ? (
        <Pill tone="warn" title={`${R3}\n\nVerifier: ${r.discarded}`}><I.Cross size={10} /> Discarded: Failed on Reference Code <I.Info size={11} /></Pill>
      ) : r.reference === "pass" ? (
        <Pill tone="ok" title="Passes against the private reference fix, so it is a valid attack (Rule R3).">
          <I.Check size={11} /> Hostile Test Validated
        </Pill>
      ) : r.reference ? (
        <Pill tone="bad">✗ {r.reference} on reference</Pill>
      ) : (
        <Pill tone="muted">no reference run</Pill>
      )}
      {r.discarded ? (
        <span className="w-[112px] text-right font-mono text-[11px] text-faint">not run</span>
      ) : r.fix === "fail" ? (
        <span className="w-[112px] text-right"><Pill tone="bad"><I.Cross size={10} /> Exposed the flaw</Pill></span>
      ) : r.fix === "pass" ? (
        <span className="w-[112px] text-right"><Pill tone="ok"><I.Check size={11} /> Fix survived</Pill></span>
      ) : (
        <span className="w-[112px] text-right font-mono text-[11px] text-faint">—</span>
      )}
    </li>
  );
}

export function CasePanel({ s }: { s: State }) {
  const attacked = s.verdicts.filter((v) => faced(v) && v.result !== "PENDING");
  const [pick, setPick] = useState<string | null>(null);
  useEffect(() => setPick(null), [s.roomId, attacked.length]);
  const shown = attacked.find((v) => v.id === pick) ?? latest(attacked);
  const rows = attackMatrix(shown);
  const atk = latest(s.attacks);
  return (
    <Panel title="The Case · adversarial matrix" meta={s.incident ?? "no incident"}>
      <BriefCard s={s} />

      <SectionLabel
        right={attacked.length > 1 && (
          <div className="flex rounded-md bg-sunk p-0.5 ring-1 ring-line">
            {attacked.map((v) => (
              <button
                key={v.id}
                onClick={() => setPick(v.id)}
                className={`rounded px-2 py-0.5 font-mono text-[11px] transition-colors ${v.id === shown?.id ? "bg-raise2 text-fg" : "text-faint hover:text-mute"}`}
              >
                {vshort(v.id)} <span className={v.result === "GREEN" ? "text-emerald" : v.result === "RED" ? "text-red" : "text-violet"}>{v.result}</span>
              </button>
            ))}
          </div>
        )}
      >
        Breaker's attack matrix
      </SectionLabel>
      {atk && (
        <div className="mb-2 flex flex-wrap items-center gap-2 text-[11.5px] text-faint">
          <span className="inline-flex items-center gap-1.5 font-mono text-emerald"><I.Branch size={13} />{atk.branch}</span>
          <span className="rounded bg-sunk px-1.5 py-px font-mono text-fg ring-1 ring-line">{short(atk.sha)}</span>
          <span>by {atk.by}{atk.manual ? " (manual)" : ""}</span>
        </div>
      )}
      {rows.length === 0 ? (
        <Empty>{atk ? "Attack filed. Waiting for a verdict that runs it." : "No attack has faced a fix yet. No attack, no sign-off."}</Empty>
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-raise">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 border-b border-line bg-raise2/60 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
            <span>Hostile test</span><span>vs reference (R3)</span><span className="w-[112px] text-right">vs fix · {shown ? vshort(shown.id) : ""}</span>
          </div>
          <ul>{rows.map((r) => <MatrixRow key={r.name} r={r} />)}</ul>
        </div>
      )}
      {rows.some((r) => r.discarded) && (
        <p className="mt-2 flex gap-1.5 text-[11.5px] leading-relaxed text-faint"><I.Info size={13} className="mt-0.5 shrink-0" />{R3}</p>
      )}
    </Panel>
  );
}

// ── Right: The Verdict & Enforced Gate ───────────────────────────────────
const HERO: Record<string, string> = {
  idle: "border-line bg-raise text-faint",
  pending: "border-amber/60 bg-amber/[.06] text-amber beat",
  red: "border-red/80 bg-red/[.13] text-red",
  green: "border-emerald/80 bg-emerald/[.10] text-emerald",
  merged: "border-emerald bg-emerald text-sunk",
  error: "border-violet/70 bg-violet/10 text-violet",
};

function Hero({ s, v }: { s: State; v: Verdict | undefined }) {
  const st = stamp(s);
  const failed = failedAgainstFix(v);
  const icon = st.tone === "merged" ? <I.Lock size={26} /> : st.tone === "red" ? <I.Cross size={26} /> : st.tone === "green" ? <I.Check size={26} /> : <span className="dot inline-block h-3 w-3 rounded-full bg-current" />;
  return (
    <div key={`${v?.id}-${st.label}`} className={`stamp rounded-lg border-2 px-4 py-3.5 ${HERO[st.tone]}`}>
      <div className="flex items-center gap-3">
        {icon}
        <div className="min-w-0">
          <div className="text-[19px] font-extrabold uppercase leading-tight tracking-[0.04em]">{st.label}</div>
          <div className={`mt-0.5 text-[12px] font-medium ${st.tone === "merged" ? "text-sunk/80" : "opacity-85"}`}>
            {st.tone === "merged" && v?.merged ? (
              <span className="inline-flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded bg-sunk/15 px-1.5 py-px font-semibold"><I.Shield size={12} /> GATE KEY VERIFIED</span>
                <span className="font-mono">main {short(v.merged.main_sha)}</span>
                <span>· signed off by {v.merged.by}</span>
              </span>
            ) : st.tone === "red" && failed ? (
              <>{failed.failed} of {failed.total} checks against the fix failed: <span className="font-mono">{failed.names.join(", ")}</span></>
            ) : st.tone === "green" && failed ? (
              <>{failed.total}/{failed.total} checks passed against the fix · {v?.discarded.length ?? 0} attack discarded by R3</>
            ) : v?.result === "PENDING" ? (
              <>Running in a fresh workspace…</>
            ) : v?.result === "GREEN" ? (
              <>Passed the repro. Waiting for the red team to attack it.</>
            ) : v ? (
              <>{v.id}</>
            ) : (
              <>Waiting for the first submission.</>
            )}
          </div>
        </div>
      </div>
      {v?.result === "PENDING" && <div className="sweep mt-3 h-[3px] rounded-full bg-amber/15" />}
    </div>
  );
}

function CheckRow({ c }: { c: Check }) {
  const ok = c.status === "pass";
  const kind = { repro: "repro_test", attack: "attack", invariant: "invariant" }[c.kind] ?? c.kind;
  return (
    <li className="rise border-t border-line first:border-t-0">
      <details>
        <summary className="grid cursor-pointer list-none grid-cols-[16px_minmax(0,1fr)_auto_64px_12px] items-center gap-2.5 px-3 py-[7px] transition-colors hover:bg-raise2/60">
          <span className={ok ? "text-emerald" : "text-red"}>{ok ? <I.Check size={14} /> : <I.Cross size={14} />}</span>
          <span className="truncate font-mono text-[12px] text-fg" title={c.name}>{testName(c.name)}</span>
          <span className="rounded bg-sunk px-1.5 py-px font-mono text-[10.5px] text-faint ring-1 ring-line">{kind}</span>
          <span className="text-right font-mono text-[11.5px] tabular-nums text-mute">{c.duration_ms ?? "—"} ms</span>
          <I.Chevron size={12} className="chev text-faint transition-transform" />
        </summary>
        <pre className="max-h-52 overflow-auto border-t border-line bg-sunk px-3 py-2 font-mono text-[11px] leading-relaxed text-mute">{c.output_tail?.trim() || "(no output captured)"}</pre>
      </details>
    </li>
  );
}

function CheckGroup({ title, checks, note }: { title: string; checks: Check[]; note?: string }) {
  if (!checks.length) return null;
  const passed = checks.filter((c) => c.status === "pass").length;
  return (
    <>
      <SectionLabel right={<span className="font-mono text-[11px] text-faint">{passed}/{checks.length} pass{note ? ` · ${note}` : ""}</span>}>{title}</SectionLabel>
      <ul className="overflow-hidden rounded-lg border border-line bg-raise">
        {checks.map((c, i) => <CheckRow key={`${c.name}-${c.against}-${i}`} c={c} />)}
      </ul>
    </>
  );
}

function SignOffBox({ s, v }: { s: State; v: Verdict | undefined }) {
  const so = signOff(s);
  const lastRej = latest(s.rejections);
  const running = v?.result === "PENDING";
  const tone = {
    no_attack: "border-line2 bg-raise",
    blocked: running ? "border-amber/45 bg-amber/[.05]" : "border-red/50 bg-red/[.06]",
    awaiting: "border-cyan/60 bg-cyan/[.07] shadow-[0_0_0_4px_rgb(60_200_240/0.06)]",
    signed: "border-emerald/60 bg-emerald/[.07]",
    merged: "border-emerald/70 bg-emerald/[.09]",
  }[so.phase];
  const title = {
    no_attack: "Sign-off locked",
    blocked: "Sign-off locked",
    awaiting: "Awaiting human sign-off",
    signed: "Signed off",
    merged: "Merged by the gate",
  }[so.phase];
  const icon = so.phase === "awaiting" ? <I.Unlock size={16} className="text-cyan" />
    : so.phase === "merged" || so.phase === "signed" ? <I.Merge size={16} className="text-emerald" />
    : <I.Lock size={16} className={so.phase === "blocked" && !running ? "text-red" : "text-amber"} />;
  return (
    <section className={`mt-5 rounded-lg border px-4 py-3.5 transition-colors ${tone}`}>
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-[13.5px] font-semibold text-fg">{title}</h3>
        <span className="ml-auto text-[10.5px] font-semibold uppercase tracking-[0.16em] text-faint">Enforced</span>
      </div>
      <div className="mt-2 text-[13px] leading-relaxed text-mute">
        {so.phase === "no_attack" ? (
          <>No attack, no sign-off. Approval unlocks only for a verdict that is GREEN <em className="not-italic text-fg">after</em> the red team has attacked it.</>
        ) : so.phase === "awaiting" ? (
          <>
            Type <code className="mx-0.5 rounded bg-sunk px-1.5 py-0.5 font-mono text-[12.5px] font-semibold text-cyan ring-1 ring-cyan/40">@firedrill-gate APPROVE {so.verdictId}</code> to sign off.
            <div className="mt-1.5 text-[12px] text-faint">Approvers: {s.approvers.length ? s.approvers.map((a) => `@${a}`).join(", ") : "a named approver"}</div>
          </>
        ) : so.phase === "merged" && v?.signoff ? (
          <>
            <span className="font-mono font-semibold text-emerald">{so.text}</span>
            <div className="mt-1 text-[12px] text-faint">
              Signed off by <span className="text-fg">{v.signoff.by}</span>
              {v.signoff.participant && <> · <span className="font-mono">{v.signoff.participant}</span></>}
            </div>
          </>
        ) : (
          so.text
        )}
      </div>
      {s.messages.length === 0 && s.fixes.length === 0 && so.phase !== "merged" && v && (
        <div className="mt-2 text-[12px] font-medium text-fg">This recording stops at the verdict: no human sign-off or merge was recorded.</div>
      )}
      <div className="mt-3 flex items-start gap-1.5 border-t border-line pt-2.5 text-[11.5px] leading-relaxed text-faint">
        <I.Shield size={13} className="mt-0.5 shrink-0" />
        Authenticated by Switch participant id, not message text. Only the gate holds the merge key.
      </div>
      {lastRej && !v?.merged && (
        <div className="mt-2.5 flex items-start gap-1.5 rounded-md bg-red/[.07] px-2.5 py-2 text-[12px] text-red ring-1 ring-inset ring-red/25">
          <I.Cross size={12} className="mt-0.5 shrink-0" />
          <span><span className="font-semibold">Refused</span> ({lastRej.by}): {lastRej.reason}</span>
        </div>
      )}
    </section>
  );
}

export function VerdictPanel({ s }: { s: State }) {
  const v = latest(s.verdicts);
  const g = groupChecks(v);
  return (
    <Panel title="The Verdict · enforced gate" meta={v ? v.id : ""}>
      <Hero s={s} v={v} />
      {v && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-faint">
          {v.fix && <span>fix {short(v.fix.sha)}</span>}
          {v.attack && <span>attack {short(v.attack.sha)}</span>}
          {v.runner && <span>{v.runner.image ?? "?"} · network {v.runner.network ?? "?"}</span>}
        </div>
      )}
      {v ? (
        <>
          <CheckGroup title="Reference validation · Rule R3" checks={g.reference} note={v.discarded.length ? `${v.discarded.length} discarded` : undefined} />
          <CheckGroup title="Against the submitted fix" checks={g.fix} />
          {v.result === "PENDING" && !v.checks.length && <div className="mt-4"><Empty>Checks stream in as the verifier runs them.</Empty></div>}
          {v.notes.map((n, i) => <div key={i} className="mt-2 text-[12px] text-violet">note: {n}</div>)}
        </>
      ) : (
        <div className="mt-4"><Empty>Verdicts appear here as the gate runs the repro, the attacks and the invariant.</Empty></div>
      )}
      <SignOffBox s={s} v={v} />
    </Panel>
  );
}

// ── Bottom: Courtroom docket ─────────────────────────────────────────────
function Node({ st }: { st: Stage["state"] }) {
  const c = {
    done: "bg-emerald text-sunk",
    failed: "bg-red text-white",
    active: "bg-amber/15 text-amber ring-2 ring-amber beat",
    pending: "bg-panel text-faint ring-1 ring-line2",
    skipped: "bg-panel text-faint border border-dashed border-line2",
  }[st];
  return (
    <span className={`relative z-10 grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full transition-colors duration-300 ${c}`}>
      {st === "done" ? <I.Check size={13} /> : st === "failed" ? <I.Cross size={12} /> : st === "active" ? <span className="dot h-2 w-2 rounded-full bg-amber" /> : st === "skipped" ? <span className="h-px w-2 bg-faint" /> : <span className="h-1.5 w-1.5 rounded-full bg-line2" />}
    </span>
  );
}

export function Docket({ s }: { s: State }) {
  const list = stages(s);
  return (
    <footer className="shrink-0 border-t border-line bg-panel px-5 pb-3 pt-2.5">
      <div className="mb-2.5 flex items-center gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mute">Courtroom docket</h2>
        <div className="flex flex-wrap gap-1.5">
          {s.verdicts.map((v) => (
            <span key={v.id} className={`rounded px-1.5 py-px font-mono text-[10.5px] ring-1 ring-inset ${v.result === "GREEN" ? "text-emerald ring-emerald/35" : v.result === "RED" ? "text-red ring-red/40" : v.result === "ERROR" ? "text-violet ring-violet/40" : "text-amber ring-amber/40"}`}>
              {vshort(v.id)} {v.result}
            </span>
          ))}
        </div>
      </div>
      <ol className="flex overflow-x-auto pb-0.5">
        {list.map((st, i) => {
          const next = list[i + 1];
          const lit = next && next.state !== "pending" && next.state !== "active";
          return (
            <li key={st.key} className="flex min-w-[128px] flex-1 flex-col">
              <div className="flex items-center">
                <Node st={st.state} />
                {next && <span className={`mx-1.5 h-[2px] flex-1 rounded-full transition-colors duration-500 ${lit ? (next.state === "failed" ? "bg-red/70" : "bg-emerald/70") : "bg-line2"}`} />}
              </div>
              <div className={`mt-1.5 pr-3 text-[12px] font-semibold leading-tight ${st.state === "pending" || st.state === "skipped" ? "text-faint" : st.state === "failed" ? "text-red" : st.state === "active" ? "text-amber" : "text-fg"}`}>
                {st.label}
              </div>
              <div className="mt-0.5 truncate pr-3 font-mono text-[10.5px] text-faint">{st.detail || (st.state === "active" ? "in progress" : " ")}</div>
            </li>
          );
        })}
      </ol>
    </footer>
  );
}
