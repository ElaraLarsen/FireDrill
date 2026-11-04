// Page 2: the room. The conversation in the Switch room, and the patch on trial.
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as I from "../icons";
import { COMMAND_RE, badge, latest, short, stateLabel, type Msg, type State } from "../model";
import { Avatar, Chip, Empty, INK, Inline, PageTitle, Panel, ROLE, type Role } from "./theme";

const hhmm = (ts: string) => (ts ? new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : "");
const VERB_HEX: Record<string, string> = { SUBMIT: ROLE.fixer.hex, ATTACK: ROLE.breaker.hex, APPROVE: ROLE.approver.hex, STATUS: ROLE.human.hex };

// The gate wraps test output in ``` fences: show those as small code blocks.
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/```([\s\S]*?)```/g).map((part, i) =>
        i % 2 === 1
          ? <code key={i} className="my-1.5 block max-h-28 overflow-hidden whitespace-pre-wrap bg-forest px-3 py-2 font-mono text-[12px] leading-snug text-on2">{part.trim()}</code>
          : <Body key={i} text={part} />)}
    </>
  );
}

function Body({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(COMMAND_RE)) {
    const i = m.index ?? 0;
    const verb = m[1].toUpperCase();
    out.push(<Inline key={`t${i}`} text={text.slice(last, i)} />);
    out.push(
      <span key={i} className="mr-1 inline-flex items-center align-middle font-mono text-[12.5px] font-bold">
        <span className="bg-p3 px-1.5 py-0.5 text-on2">@firedrill-gate</span>
        <span className="px-1.5 py-0.5 text-forest" style={{ background: VERB_HEX[verb] ?? VERB_HEX.STATUS }}>{verb}</span>
      </span>,
    );
    last = i + m[0].length;
  }
  out.push(<Inline key="tail" text={text.slice(last)} />);
  return <>{out}</>;
}

function Bubble({ m, role, selected, dim, onSelect }: { m: Msg; role: Role; selected: boolean; dim: boolean; onSelect: () => void }) {
  const r = ROLE[role];
  const mine = role === "approver" || role === "human";
  const refused = role === "gate" && m.body.startsWith("Rejected:");
  const merged = role === "gate" && m.body.startsWith("MERGED.");
  const long = m.body.length > 220 || m.body.split("\n").length > 4;
  const edge = refused ? INK.scarlet : merged ? INK.jade : r.hex;
  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: mine ? 40 : -40 }}
      animate={{ opacity: dim ? 0.5 : 1, x: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className={`flex items-start gap-3 ${mine ? "flex-row-reverse" : ""}`}
    >
      <Avatar role={role} size={40} />
      <motion.button
        layout
        onClick={onSelect}
        aria-pressed={selected}
        whileTap={{ scale: 0.98 }}
        className={`tap max-w-[86%] px-4 py-3 text-left transition-colors ${selected ? "bg-p3" : "bg-p2 hover:bg-p3"}`}
        style={{ [mine ? "borderRight" : "borderLeft"]: `5px solid ${edge}` }}
      >
        <span className={`mb-1.5 flex flex-wrap items-center gap-2 ${mine ? "flex-row-reverse" : ""}`}>
          <span className="text-[13px] tracking-serif" style={{ color: r.hex }}>{r.tag}</span>
          <span className="text-[13px] font-medium text-on3">{m.actor.name}</span>
          {refused && <span className="inline-flex items-center gap-1 bg-scarlet px-2 py-0.5 text-[12px] font-semibold text-forest"><I.Hand size={12} />refused</span>}
          {merged && <span className="inline-flex items-center gap-1 bg-jade px-2 py-0.5 text-[12px] font-semibold text-forest"><I.Sparkle size={12} />merged</span>}
          <span className="tnum font-mono text-[12px] text-on3">{hhmm(m.ts)}</span>
        </span>
        <span className={`whitespace-pre-wrap break-words text-[16px] leading-[1.55] text-on ${long && !selected ? "line-clamp-4" : "block"}`}>
          <Rich text={m.body} />
        </span>
        {long && <span className="mt-2 block text-[13px] font-semibold" style={{ color: r.hex }}>{selected ? "Tap to fold" : "Tap to read all"}</span>}
      </motion.button>
    </motion.li>
  );
}

function Chat({ s }: { s: State }) {
  const [only, setOnly] = useState<Role | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const settled = useRef(false);
  const withRole = useMemo(() => s.messages.map((m) => ({ m, role: badge(m.actor, s.approvers).tone as Role })), [s.messages, s.approvers]);
  const cast = useMemo(() => (["fixer", "breaker", "gate", "approver", "human"] as Role[]).map((r) => ({ r, n: withRole.filter((x) => x.role === r).length })).filter((x) => x.n), [withRole]);
  const shown = only ? withRole.filter((x) => x.role === only) : withRole;

  useEffect(() => setOnly(null), [s.roomId]);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: settled.current ? "smooth" : "auto" });
    settled.current = true;
  }, [s.messages.length, only]);

  return (
    <Panel title="The room" hint="Tap a name to follow one voice." right={<Chip mono>{s.messages.length} msgs</Chip>} delay={0.1}>
      {cast.length > 0 && (
        <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
          {cast.map(({ r, n }) => {
            const on = only === r;
            return (
              <motion.button
                key={r}
                onClick={() => setOnly(on ? null : r)}
                aria-pressed={on}
                whileTap={{ scale: 0.92 }}
                animate={{ opacity: only && !on ? 0.5 : 1 }}
                className="tap flex h-12 shrink-0 items-center gap-2 pl-1 pr-3 text-[15px] font-semibold"
                style={{ background: on ? ROLE[r].hex : "var(--color-p2)", color: on ? INK.forest : ROLE[r].hex }}
              >
                <Avatar role={r} size={40} />
                {ROLE[r].name}
                <span className="tnum px-1.5 font-mono text-[13px]" style={{ background: on ? "rgb(0 0 0 / .14)" : "var(--color-p3)" }}>{n}</span>
              </motion.button>
            );
          })}
        </div>
      )}
      {s.messages.length === 0 ? (
        <Empty>{s.frames > 0 ? "This record has no room messages: it holds the gate's verification only." : "Nobody has spoken yet. The gate mirrors every message in the room it guards."}</Empty>
      ) : (
        <div ref={box} data-lenis-prevent className="max-h-[60vh] overflow-y-auto pr-1">
          <ul className="space-y-3">
            <AnimatePresence initial={false}>
              {shown.map(({ m, role }) => (
                <Bubble key={m.key} m={m} role={role} selected={selected === m.key} dim={selected !== null && selected !== m.key} onSelect={() => setSelected(selected === m.key ? null : m.key)} />
              ))}
            </AnimatePresence>
          </ul>
        </div>
      )}
    </Panel>
  );
}

function Patch({ s }: { s: State }) {
  const fix = latest(s.fixes);
  const trial = latest(s.verdicts);
  const d = fix?.diff_stat;
  const total = d ? Math.max(1, d.insertions + d.deletions) : 1;
  return (
    <Panel title="The patch on trial" hint="Every patch runs in a fresh workspace." delay={0.18}>
      {fix ? (
        <motion.div key={fix.sha} initial={{ rotateX: -70, opacity: 0 }} animate={{ rotateX: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 20 }} style={{ transformPerspective: 800 }} className="bg-lime p-5 text-forest">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center bg-forest text-lime">{ROLE.fixer.icon(24)}</span>
            <div className="min-w-0">
              <div className="text-[15px] font-bold">Patch {s.fixes.length} by {fix.by}</div>
              <div className="truncate font-mono text-[16px] font-bold">{fix.branch}</div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="inline-flex h-9 items-center bg-forest px-3 font-mono text-[13px] text-on">{short(fix.sha)}</span>
            {d && (
              <span className="inline-flex items-center gap-2" title={`${d.insertions} lines added, ${d.deletions} removed in ${d.names.join(", ")}`}>
                <span className="flex h-4 w-28 overflow-hidden bg-forest">
                  <motion.span initial={{ width: 0 }} animate={{ width: `${(d.insertions / total) * 100}%` }} transition={{ duration: 0.8, ease: "easeOut" }} className="bg-jade" />
                  <motion.span initial={{ width: 0 }} animate={{ width: `${(d.deletions / total) * 100}%` }} transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }} className="bg-scarlet" />
                </span>
                <span className="tnum font-mono text-[15px] font-bold">+{d.insertions} −{d.deletions}</span>
              </span>
            )}
          </div>
          {d && d.names.length > 0 && <div className="mt-3 truncate font-mono text-[13px]">{d.names.join(", ")}</div>}
        </motion.div>
      ) : trial?.candidate ? (
        <p className="bg-p2 p-5 text-[16px] font-bold text-lime">{stateLabel(trial.state)} · <span className="font-mono">{short(trial.candidate)}</span></p>
      ) : (
        <Empty>No patch on trial yet.</Empty>
      )}

      {s.fixes.length > 1 && (
        <div className="mt-6">
          <h3 className="mb-2 text-[15px] font-semibold text-on2">Every patch so far</h3>
          <ol className="space-y-1.5">
            {s.fixes.map((f, i) => {
              const v = s.verdicts.filter((x) => x.fix?.sha === f.sha).pop();
              const hex = v?.result === "GREEN" ? INK.jade : v?.result === "RED" ? INK.scarlet : INK.stone;
              return (
                <motion.li key={f.sha} initial={{ x: -16, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.06 }} className="flex items-center gap-3 bg-p2 py-2 pl-2 pr-4">
                  <span className="grid h-9 w-9 place-items-center bg-sky text-[15px] font-bold text-forest">{i + 1}</span>
                  <span className="font-mono text-[14px] text-on">{short(f.sha)}</span>
                  <span className="ml-auto px-2 py-0.5 text-[13px] font-semibold text-forest" style={{ background: hex }}>{v ? v.result : "not ruled yet"}</span>
                </motion.li>
              );
            })}
          </ol>
        </div>
      )}
    </Panel>
  );
}

export function RoomPage({ s }: { s: State }) {
  return (
    <div className="space-y-4">
      <PageTitle
        title="The fixer sends a patch"
        lead="Everything happens in one Switch chat room. The fixer files a patch with SUBMIT; the gate takes it and tests it in a clean workspace."
      />
      <div className="grid gap-4 pt-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Chat s={s} />
        <Patch s={s} />
      </div>
    </div>
  );
}
