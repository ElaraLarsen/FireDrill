import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as I from "../icons";
import { COMMAND_RE, badge, type Msg, type State } from "../model";
import { Avatar, Card, ROLE, type Role } from "./theme";

const hhmm = (ts: string) => (ts ? new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : "");
const VERB: Record<string, string> = {
  SUBMIT: "bg-fixer text-white",
  ATTACK: "bg-breaker text-white",
  APPROVE: "bg-approver text-white",
  STATUS: "bg-human text-white",
};

function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((t, i) =>
        t.startsWith("**") && t.endsWith("**") && t.length > 4 ? <strong key={i} className="font-bold text-ink">{t.slice(2, -2)}</strong>
        : t.startsWith("`") && t.endsWith("`") && t.length > 2 ? <code key={i} className="rounded-md bg-soft px-1.5 py-px font-mono text-[12px] text-ink ring-1 ring-line">{t.slice(1, -1)}</code>
        : t)}
    </>
  );
}

// The gate wraps test output in ``` fences: show those as small code blocks.
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/```([\s\S]*?)```/g).map((part, i) =>
        i % 2 === 1
          ? <code key={i} className="my-1 block max-h-24 overflow-hidden whitespace-pre-wrap rounded-lg bg-white/80 px-2 py-1.5 font-mono text-[11px] leading-snug text-ink2 ring-1 ring-line">{part.trim()}</code>
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
      <span key={i} className="mr-1 inline-flex items-center overflow-hidden rounded-lg align-middle font-mono text-[12px] font-semibold shadow-sm ring-1 ring-black/5">
        <span className="bg-white px-1.5 py-0.5 text-ink3">@firedrill-gate</span>
        <span className={`px-1.5 py-0.5 tracking-wide ${VERB[verb] ?? VERB.STATUS}`}>{verb}</span>
      </span>,
    );
    last = i + m[0].length;
  }
  out.push(<Inline key="tail" text={text.slice(last)} />);
  return <>{out}</>;
}

function Bubble({ m, role, selected, onSelect }: { m: Msg; role: Role; selected: boolean; onSelect: () => void }) {
  const r = ROLE[role];
  const mine = role === "approver" || role === "human";
  const refused = role === "gate" && m.body.startsWith("Rejected:");
  const merged = role === "gate" && m.body.startsWith("MERGED.");
  const long = m.body.length > 220 || m.body.split("\n").length > 4;
  const tone = refused
    ? "bg-rose-50 ring-rose-200"
    : merged
      ? "bg-gradient-to-br from-emerald-50 to-teal-50 ring-emerald-200"
      : role === "gate" ? "bg-blue-50/80 ring-blue-100"
      : mine ? `${r.soft} ring-transparent` : "bg-white ring-line";
  return (
    <li className={`slideup flex items-end gap-2.5 ${mine ? "flex-row-reverse" : ""}`}>
      <Avatar role={role} size={32} />
      <button
        onClick={onSelect}
        aria-pressed={selected}
        className={`tap lift max-w-[88%] rounded-2xl px-3.5 py-2.5 text-left ring-1 transition-all ${tone} ${mine ? "rounded-br-md" : "rounded-bl-md"} ${selected ? `ring-2 ${r.on} shadow-lg` : ""}`}
      >
        <span className={`mb-1 flex items-center gap-2 ${mine ? "flex-row-reverse" : ""}`}>
          <span className={`font-mono text-[10.5px] font-bold tracking-wide ${r.text}`}>[{r.tag}]</span>
          <span className="text-[11.5px] font-medium text-ink3">{m.actor.name}</span>
          {refused && <span className="inline-flex items-center gap-1 rounded-full bg-fail px-1.5 py-px text-[10px] font-bold uppercase text-white"><I.Hand size={10} />refused</span>}
          {merged && <span className="inline-flex items-center gap-1 rounded-full bg-pass px-1.5 py-px text-[10px] font-bold uppercase text-white"><I.Sparkle size={10} />merged</span>}
          <span className="font-mono text-[10.5px] text-ink3">{hhmm(m.ts)}</span>
        </span>
        <span className={`whitespace-pre-wrap break-words text-[13.5px] leading-[1.55] text-ink2 ${long && !selected ? "line-clamp-4" : "block"}`}>
          <Rich text={m.body} />
        </span>
        {long && <span className="mt-1 block text-[11.5px] font-semibold text-ink3">{selected ? "Tap to fold" : "Tap to read all"}</span>}
      </button>
    </li>
  );
}

export function Room({ s }: { s: State }) {
  const [only, setOnly] = useState<Role | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const settled = useRef(false);
  const withRole = useMemo(() => s.messages.map((m) => ({ m, role: badge(m.actor, s.approvers).tone as Role })), [s.messages, s.approvers]);
  const cast = useMemo(() => (["fixer", "breaker", "gate", "approver", "human"] as Role[]).map((r) => ({ r, n: withRole.filter((x) => x.role === r).length })).filter((x) => x.n), [withRole]);
  const shown = only ? withRole.filter((x) => x.role === only) : withRole;

  useEffect(() => setOnly(null), [s.roomId]);
  useEffect(() => {
    const el = list.current?.parentElement;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: settled.current ? "smooth" : "auto" });
    settled.current = true;
  }, [s.messages.length, only]);

  return (
    <Card
      title="The incident room"
      hint="Everyone in the Switch room, in order. Tap a face to follow one voice."
      icon={<I.Bot size={18} />}
      right={<span className="rounded-full bg-soft px-2.5 py-1 font-mono text-[11.5px] font-semibold text-ink2 ring-1 ring-line">{s.messages.length} msgs</span>}
    >
      {cast.length > 0 && (
        <div className="sticky top-0 z-10 -mx-5 mb-3 flex gap-2 overflow-x-auto bg-gradient-to-b from-white/95 to-white/70 px-5 py-2 backdrop-blur">
          {cast.map(({ r, n }) => {
            const on = only === r;
            return (
              <button
                key={r}
                onClick={() => setOnly(on ? null : r)}
                aria-pressed={on}
                className={`tap press flex shrink-0 items-center gap-2 rounded-full py-1 pl-1 pr-3 text-[12px] font-semibold ring-1 transition-all ${on ? `bg-white ${ROLE[r].text} ring-2 ${ROLE[r].on} shadow` : only ? "bg-white/60 text-ink3 opacity-60 ring-line" : "bg-white text-ink2 ring-line hover:ring-line2"}`}
              >
                <Avatar role={r} size={26} />
                {ROLE[r].name}
                <span className="rounded-full bg-soft px-1.5 font-mono text-[10.5px] text-ink3">{n}</span>
              </button>
            );
          })}
        </div>
      )}
      {s.messages.length === 0 ? (
        <Empty>{s.frames > 0 ? "This record has no room messages: it holds the gate's verification only." : "Nobody has spoken yet. The gate mirrors every message in the room it guards."}</Empty>
      ) : (
        <div ref={list}>
          <ul className="space-y-3">
            {shown.map(({ m, role }) => (
              <Bubble key={m.key} m={m} role={role} selected={selected === m.key} onSelect={() => setSelected(selected === m.key ? null : m.key)} />
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border-2 border-dashed border-line2 bg-white/60 px-4 py-5 text-center text-[13.5px] leading-relaxed text-ink3">{children}</p>;
}
