import { useEffect, useRef, useState, type ReactNode } from "react";
import * as I from "./icons";
import { badge, faced, latest, short, signOff, stamp, type Check, type Msg, type State } from "./model";
import { brief, failedAgainstFix, groupChecks, testName } from "./views";
import "./panels.css";

const vshort = (id: string) => id.replace(/^V-.*-(\d+)$/, "V-$1");
const time = (ts: string) => ts ? new Date(ts).toLocaleTimeString([], { hour12: false }) : "";

function Inline({ text }: { text: string }) {
  return <>{text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) =>
    part.startsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong>
    : part.startsWith("`") ? <code key={i}>{part.slice(1, -1)}</code> : part)}</>;
}
function Empty({ children }: { children: ReactNode }) { return <p className="empty-state">{children}</p>; }
function PanelHeader({ title, meta, icon }: { title: string; meta: ReactNode; icon: ReactNode }) {
  return <header className="panel-header"><h2>{icon}{title}</h2><span>{meta}</span></header>;
}

function Message({ message, approvers }: { message: Msg; approvers: string[] }) {
  const [open, setOpen] = useState(false);
  const role = badge(message.actor, approvers).tone;
  const roleNames = { fixer: "FIXER · CLAUDE", breaker: "RED-TEAM · CODEX", gate: "GATE · ARBITER", approver: "APPROVER · HUMAN", human: message.actor.name === "guest" ? "UNAUTHORIZED · GUEST" : "PARTICIPANT · HUMAN" };
  const command = message.body.match(/@firedrill-gate\s+(SUBMIT|ATTACK|APPROVE|STATUS)\b\s*([^\n]*)/i);
  const verdict = message.actor.role === "gate" ? message.body.match(/\*\*(V-[^:]+):\s*(GREEN|RED|ERROR)\*\*/) : null;
  const rejected = message.actor.role === "gate" && message.body.startsWith("Rejected:");
  const merged = message.actor.role === "gate" && message.body.startsWith("MERGED.");
  const long = message.body.length > 230 || message.body.split("\n").length > 4;
  const label = command?.[1].toUpperCase() ?? (rejected ? "REJECTED" : merged ? "MERGED" : verdict?.[2]);
  const detail = command?.[2] ?? verdict?.[1];
  return <li className={`trace-entry role-${role}`}>
    <span className="trace-dot" aria-hidden="true" />
    <div className="trace-meta"><span>{roleNames[role]}</span><time dateTime={message.ts}>{time(message.ts)}</time></div>
    <article className={`message-card ${rejected ? "message-rejected" : ""}`}>
      <div className="message-author">{message.actor.name ?? "Unknown participant"}</div>
      {label && <div className={`protocol-pill protocol-${label.toLowerCase()}`}><strong>{label}</strong>{detail && <code title={detail}>{detail}</code>}</div>}
      <p className={long && !open ? "message-collapsed" : ""}><Inline text={message.body} /></p>
      {long && <button className="text-button" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Collapse message" : "Read full message"}<I.Chevron size={11} /></button>}
    </article>
  </li>;
}

export function RoomPanel({ s }: { s: State }) {
  const body = useRef<HTMLDivElement>(null);
  const previous = useRef(0);
  const following = useRef(true);
  useEffect(() => {
    const el = body.current;
    if (!el) return;
    const onScroll = () => { following.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24; };
    const resize = new ResizeObserver(() => {
      if (following.current) el.scrollTo({ top: el.scrollHeight, behavior: "instant" });
    });
    el.addEventListener("scroll", onScroll);
    resize.observe(el);
    return () => { resize.disconnect(); el.removeEventListener("scroll", onScroll); };
  }, []);
  useEffect(() => {
    const el = body.current;
    if (!el) return;
    const smooth = previous.current > 0 && s.messages.length > previous.current && !matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    following.current = true;
    previous.current = s.messages.length;
  }, [s.messages.length]);
  return <section className="panel room-panel" aria-label="Switch room protocol trace">
    <PanelHeader title="Switch room" meta={`${s.messages.length} MESSAGES`} icon={<I.Branch size={15} />} />
    <div className="room-label"><span className="room-hash">#</span><code>{s.roomName || s.roomId || "Awaiting room"}</code><span className="trace-status">TRACE</span></div>
    <div className="panel-body room-body" ref={body} tabIndex={0} role="region" aria-label="Scrollable room messages">
      {s.messages.length ? <ol className="trace-list">{s.messages.map((message) => <Message key={message.key} message={message} approvers={s.approvers} />)}</ol>
        : <Empty>{s.frames ? "This record has no room messages yet. Verification evidence will appear as it arrives." : "The courtroom is ready. Play the recording or select a docket milestone to begin."}</Empty>}
    </div>
    <div className="panel-footer"><I.Lock size={12} /><span>Room log · chronological protocol trace</span></div>
  </section>;
}

function BriefCard({ s }: { s: State }) {
  const [tab, setTab] = useState("brief");
  const [more, setMore] = useState(false);
  const b = brief(s.brief);
  const fix = latest(s.fixes);
  const candidate = latest(s.verdicts)?.candidate;
  return <section className="case-inspector">
    <div className="case-tabs" role="tablist" aria-label="Case inspector" onKeyDown={(event) => {
      if (["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        const next = event.key === "Home" ? "brief" : event.key === "End" ? "patch" : tab === "brief" ? "patch" : "brief";
        setTab(next); document.getElementById(`tab-${next}`)?.focus();
      }
    }}>
      <button id="tab-brief" role="tab" aria-selected={tab === "brief"} aria-controls="case-content" tabIndex={tab === "brief" ? 0 : -1} onClick={() => setTab("brief")}>Incident brief & rule</button>
      <button id="tab-patch" role="tab" aria-selected={tab === "patch"} aria-controls="case-content" tabIndex={tab === "patch" ? 0 : -1} onClick={() => setTab("patch")}>Active patch & diff</button>
    </div>
    <div id="case-content" role="tabpanel" aria-labelledby={`tab-${tab}`} className="case-content">
      {tab === "brief" ? b ? <>
        <h3>{b.title || s.incident}</h3>
        <p className={more ? "brief-overview" : "brief-overview brief-preview"}><Inline text={b.overview} /></p>
        {b.rest && <><button className="text-button" aria-expanded={more} onClick={() => setMore(!more)}>{more ? "Hide reproduction details" : "Read full brief & invariant"}<I.Chevron size={11} /></button>{more && <p className="brief-rest"><Inline text={b.rest} /></p>}</>}
        <div className="rule-note"><I.Shield size={15} /><p><strong>R2 · Prove the fix.</strong> Repro + valid attacks + invariant. All GREEN in a fresh workspace.</p></div>
      </> : <Empty>The incident brief appears when the gate opens the docket.</Empty>
        : fix ? <>
          <div className="patch-title"><I.Branch size={20} /><h3>Submitted patch {s.fixes.length}</h3></div>
          <dl className="patch-details"><div><dt>Branch</dt><dd>{fix.branch}</dd></div><div><dt>Commit</dt><dd>{fix.sha}</dd></div><div><dt>Author</dt><dd>{fix.by}{fix.manual ? " · manual submission" : ""}</dd></div></dl>
          {fix.diff_stat ? <><div className="diff-summary"><span><b>+{fix.diff_stat.insertions}</b> additions</span><span><b>−{fix.diff_stat.deletions}</b> deletions</span><span>{fix.diff_stat.files} files</span></div><div className="diff-bar" aria-hidden="true"><span style={{ flex: fix.diff_stat.insertions || 0.01 }} /><span style={{ flex: fix.diff_stat.deletions || 0.01 }} /></div><ul className="changed-files">{fix.diff_stat.names.map((name) => <li key={name}><code>{name}</code></li>)}</ul></> : <Empty>Diff statistics were not included in this submission.</Empty>}
        </> : <Empty>{candidate ? `Recorded candidate ${short(candidate)}. No branch or diff statistics in this recording.` : "No patch submitted yet."}</Empty>}
    </div>
    <div className="patch-strip"><span><I.Branch size={12} />{fix?.branch ?? "No active branch"}</span><code title={fix?.sha}>{short(fix?.sha ?? candidate)}</code>{fix?.diff_stat && <span className="compact-diff"><b>+{fix.diff_stat.insertions}</b><em>−{fix.diff_stat.deletions}</em></span>}</div>
  </section>;
}

function CheckRow({ c }: { c: Check }) {
  const ok = c.status === "pass";
  return <li className="qa-row"><details>
    <summary aria-label={`${testName(c.name)} against ${c.against}: ${c.status}, ${c.duration_ms ?? "unknown"} ms`}>
      <span className={ok ? "check-pass" : "check-fail"}>{ok ? <I.Check size={14} /> : <I.Cross size={14} />}</span>
      <code className="check-name" title={c.name}>{testName(c.name)}</code><span className="dashed-leader" />
      <span className="against-label">{c.against === "fix" ? "FIX" : "REF"}</span><code className="check-duration">{c.duration_ms ?? "—"}<span> ms</span></code>
      <span className={`check-result ${ok ? "check-pass" : "check-fail"}`}>{c.status.toUpperCase()}</span><I.Chevron className="chev" size={11} />
    </summary>
    <div className="stdout"><div><span>STDOUT / STDERR</span><code>{c.name}</code></div><pre>{c.output_tail ? c.output_tail.split("\n").map((line, index) => <span key={index} className={/FAIL|Error|^E\s|assert /.test(line) ? "output-error" : /\d+ passed/.test(line) ? "output-pass" : ""}>{line}{"\n"}</span>) : "No output was included in this frame."}</pre></div>
  </details></li>;
}

export function CasePanel({ s }: { s: State }) {
  const [pick, setPick] = useState<string | null>(null);
  const current = latest(s.verdicts);
  useEffect(() => setPick(null), [current?.id, s.roomId]);
  const shown = s.verdicts.find((v) => v.id === pick) ?? current;
  const checks = groupChecks(shown);
  const historical = shown && shown.id !== current?.id;
  return <section className="panel case-panel" aria-label="Case and verification matrix">
    <PanelHeader title="Case inspector" meta="EVIDENCE / QA" icon={<I.Info size={15} />} />
    <div className="panel-body case-body">
      <BriefCard s={s} />
      <section className="verification-section">
        <div className="section-heading"><h3>Verification matrix</h3><span>{shown ? vshort(shown.id) : "NO VERDICT"}</span></div>
        <div className="verdict-tabs" role="group" aria-label="Inspect verdict checks">{s.verdicts.map((v) => <button key={v.id} aria-pressed={v.id === shown?.id} onClick={() => setPick(v.id)}><code>{vshort(v.id)}</code><span className={`result-${v.result.toLowerCase()}`}>{v.result}</span></button>)}</div>
        {historical && <p className="historical-note">Inspecting earlier evidence. The verdict and merge gate show the current state.</p>}
        {shown?.discarded.length ? <div className="r3-filter"><div className="r3-title"><I.Shield size={16} /><h4>Rule R3 filter</h4><span>{shown.discarded.length} DISCARDED</span></div><p>Overbroad tests failed against the reference fix and were excluded from the verdict.</p><details className="discarded-details"><summary>Inspect excluded tests<I.Chevron size={11} className="chev" /></summary>{shown.discarded.map((discard) => <div key={discard.name} className="discarded-test"><code>{testName(discard.name)}</code><span>{discard.reason}</span></div>)}</details></div> : null}
        <div className="qa-heading"><span>AGAINST THE SUBMITTED FIX</span><span>EXPAND A CHECK FOR OUTPUT</span></div>
        {checks.fix.length ? <ul className="qa-list">{checks.fix.map((c, i) => <CheckRow key={`${shown?.id}-${c.name}-${i}`} c={c} />)}</ul> : <Empty>{shown?.result === "PENDING" ? "Verification running. Check results will appear here." : "The gate has not run checks against a submitted patch yet."}</Empty>}

        {checks.reference.length > 0 && <details className="reference-checks"><summary><I.Shield size={13} /><span>Reference validation · Rule R3</span><code>{checks.reference.length} checks</code><I.Chevron size={12} className="chev" /></summary><ul className="qa-list">{checks.reference.map((c, i) => <CheckRow key={`${shown?.id}-${c.name}-${i}`} c={c} />)}</ul></details>}
        {shown?.notes.map((note, i) => <p className="verifier-note" key={i}>{note}</p>)}
        {shown?.attack && <div className="attack-reference"><I.Branch size={12} /><code>{shown.attack.branch}</code><code title={shown.attack.sha}>{short(shown.attack.sha)}</code></div>}
      </section>
    </div>
    <div className="panel-footer"><I.Shield size={12} /><span>R3 validates the test before it judges the patch.</span></div>
  </section>;
}

export function VerdictPanel({ s }: { s: State }) {
  const v = latest(s.verdicts);
  const st = stamp(s);
  const failed = failedAgainstFix(v);
  const so = signOff(s);
  const attackExecuted = Boolean(v && v.checks.some((c) => c.kind === "attack" && c.against === "fix"));
  const fixChecks = v?.checks.filter((c) => c.against === "fix") ?? [];
  const allGreen = Boolean(v?.result === "GREEN" && fixChecks.length && fixChecks.every((c) => c.status === "pass") && fixChecks.some((c) => c.kind === "invariant"));
  const signed = Boolean(v?.signoff?.participant);
  const reproOnly = v?.result === "GREEN" && !faced(v);
  const headline = st.tone === "merged" ? "MERGED" : reproOnly ? "GREEN" : v?.result ?? "READY";
  const subtitle = st.tone === "merged" ? "TO MAIN" : reproOnly ? "REPRO ONLY · AWAITING RED-TEAM" : st.tone === "red" ? (v && faced(v) ? "BROKEN BY RED-TEAM" : "ORIGINAL REPRO FAILED") : st.tone === "green" ? "SURVIVED ALL CHECKS" : st.tone === "pending" ? "VERIFICATION IN PROGRESS" : st.tone === "error" ? "GATE FAULT · SIGN-OFF LOCKED" : "AWAITING FIRST SUBMISSION";
  const locks = [
    { done: attackExecuted, title: "Red-team attack executed", note: "Adversarial checks against this patch" },
    { done: allGreen, title: "Fix checks + invariant GREEN", note: "Verified in a fresh workspace" },
    { done: signed, title: "Authenticated human sign-off", note: v?.signoff ? `@${v.signoff.by}` : s.approvers.length ? s.approvers.map((a) => `@${a}`).join(" / ") + " required" : "Named Switch participant required" },
  ];
  return <section className="panel verdict-panel" aria-label="Verdict and enforced merge gate">
    <PanelHeader title="The verdict" meta={v ? vshort(v.id) : "GATE IDLE"} icon={<I.Shield size={15} />} />
    <div className="panel-body verdict-body" tabIndex={0} role="region" aria-label="Scrollable verdict and sign-off evidence">
      <section className={`verdict-monument monument-${st.tone}`} aria-label={st.label}>
        <div className="monument-meta"><span>DETERMINISTIC GATE</span>{st.tone === "merged" ? <I.Merge size={23} /> : st.tone === "red" ? <I.Cross size={23} /> : <I.Shield size={23} />}</div>
        <h3>{headline}</h3><p className="verdict-subtitle" role="status"><span className="sr-only">{headline}. </span>{subtitle}</p>
        <div className="verdict-explanation">
          {st.tone === "merged" && v?.merged ? <><code>main @ {short(v.merged.main_sha)}</code><p>Verified patch. Authenticated approval. Guarded merge.</p></>
          : reproOnly ? <p>Passes original repro, but sign-off remains locked until red-team testing completes.</p>
          : st.tone === "red" && failed ? <><p>{failed.failed} of {failed.total} checks against the fix failed.</p><code>{failed.names.join(", ")}</code></>
          : st.tone === "green" && failed ? <p><strong>{failed.total - failed.failed}/{failed.total}</strong> checks against the fix passed.</p>
          : st.tone === "pending" ? <p>Running the repro, attacks and invariant. Sign-off is locked.</p>
          : st.tone === "error" ? <p>The verifier reported an error. Inspect the check output before continuing.</p>
          : <p>No verdict has been issued. Follow the docket to inspect the trial.</p>}
        </div>
        {v && <div className="monument-id"><code>{v.id}</code><span>{st.tone === "merged" ? "SEALED" : "GATE-ISSUED"}</span></div>}
      </section>
      <section className="merge-vault">
        <div className="vault-heading"><h3><I.Lock size={16} />Human sign-off vault</h3><span className={so.phase === "merged" ? "vault-sealed" : "vault-locked"}>{so.phase === "merged" ? "SEALED" : so.phase === "awaiting" ? "AWAITING" : "LOCKED"}</span></div>
        <div className="enforcement-contrast"><span>Switch default <s>Instructions only</s></span><strong><I.Shield size={12} />FireDrill enforces</strong></div>
        <ol className="lock-list">{locks.map((lock) => <li key={lock.title} className={lock.done ? "lock-passed" : "lock-waiting"}><span className="lock-icon">{lock.done ? <I.Check size={14} /> : <I.Lock size={12} />}</span><div><strong><span className="sr-only">{lock.done ? "Passed: " : "Pending: "}</span>{lock.title}</strong><span>{lock.note}</span></div></li>)}</ol>
        {so.phase === "awaiting" && <div className="approve-command"><span>In the Switch room, a named approver can send:</span><code>@firedrill-gate APPROVE {so.verdictId}</code></div>}
        {v?.merged ? <div className="merge-receipt"><I.Shield size={15} /><div><strong>Gate key hook verified</strong><code>Merged to main @ {short(v.merged.main_sha)}</code>{v.signoff?.participant && <span title={v.signoff.participant}>{v.signoff.participant}</span>}</div></div> : <p className="signoff-state">{so.text}</p>}
        {s.rejections.length > 0 && <div className="security-audit"><h4><I.Shield size={13} />Blocked by the gate <span>{s.rejections.length}</span></h4>{s.rejections.map((rejection, i) => <div key={`${rejection.ts}-${i}`}><strong>@{rejection.by}</strong><p>{rejection.reason}</p></div>)}</div>}
      </section>
      {v?.runner && <div className="runner-note"><span>EXECUTION ENVIRONMENT</span><code>{v.runner.image ?? "Unspecified runner"}</code><span>Fresh workspace · network {v.runner.network ?? "unspecified"}</span></div>}
    </div>
  </section>;
}
