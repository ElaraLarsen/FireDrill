// Page 1: the case. What broke, in plain words, and who is in the room.
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import * as I from "../icons";
import { badge, type State } from "../model";
import { INCIDENT_META, brief } from "../views";
import { Avatar, Empty, INCIDENT_PLAIN, INK, Inline, PageTitle, Panel, ROLE, type Role } from "./theme";

const CAST: Role[] = ["fixer", "breaker", "gate", "approver"];

const RULES = [
  { icon: <I.Zap size={22} />, hex: INK.tangerine, title: "No attack, no sign-off", text: "A patch that only passes its own bug test isn't trusted yet." },
  { icon: <I.Hand size={22} />, hex: INK.sky, title: "Fair tests only", text: "An attack must pass on the gate's own correct fix, or it's thrown out." },
  { icon: <I.Key size={22} />, hex: INK.lilac, title: "One key to main", text: "Only the gate can merge, and only after a named human signs." },
];

export function CasePage({ s }: { s: State }) {
  const [open, setOpen] = useState(false);
  const b = brief(s.brief);
  const inc = s.incident ?? "";
  const meta = INCIDENT_META[inc];
  const said = (r: Role) => s.messages.filter((m) => badge(m.actor, s.approvers).tone === r).length;

  return (
    <div className="space-y-4">
      <PageTitle
        k={inc}
        title={b?.title || meta?.label || "Waiting for the docket"}
        lead={meta ? `Case ${meta.n}: ${INCIDENT_PLAIN[inc]}. Here is what broke, and who will argue about the fix.` : "The gate opens a case as soon as the fixer files the first patch."}
      />

      <div className="grid gap-4 pt-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Panel title="What broke" hint="The incident brief the gate posted." delay={0.1}>
          {b ? (
            <button onClick={() => setOpen(!open)} aria-expanded={open} className="tap group block w-full bg-p2 p-5 text-left transition-colors hover:bg-p3 sm:p-6">
              <p className="text-[19px] font-medium leading-relaxed text-on"><Inline text={b.overview} /></p>
              <AnimatePresence initial={false}>
                {open && b.rest && (
                  <motion.p
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden whitespace-pre-wrap text-[16px] leading-relaxed text-on2"
                  >
                    <span className="block pt-4"><Inline text={b.rest} /></span>
                  </motion.p>
                )}
              </AnimatePresence>
              {b.rest && (
                <span className="mt-5 inline-flex h-10 items-center gap-2 bg-lime px-4 text-[15px] font-semibold text-forest">
                  {open ? "Show less" : "Read the whole brief"}
                  <I.Chevron size={16} className={`transition-transform duration-300 ${open ? "-rotate-90" : "rotate-90"}`} />
                </span>
              )}
            </button>
          ) : (
            <Empty>No brief yet. The gate posts one when the case opens.</Empty>
          )}
        </Panel>

        <Panel title="House rules" hint="Enforced by the gate, not by trust." delay={0.18}>
          <ul className="space-y-1.5">
            {RULES.map((r, i) => (
              <motion.li
                key={r.title}
                initial={{ x: 24, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.25 + i * 0.08, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ x: 6 }}
                className="flex gap-4 bg-p2 p-4"
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center text-forest" style={{ background: r.hex }}>{r.icon}</span>
                <span>
                  <span className="block text-[18px] font-bold text-on">{r.title}</span>
                  <span className="mt-0.5 block text-[15px] leading-relaxed text-on2">{r.text}</span>
                </span>
              </motion.li>
            ))}
          </ul>
        </Panel>
      </div>

      <section aria-labelledby="cast-h" className="pt-6">
        <div className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h2 id="cast-h" className="serif text-[26px]">Meet the cast</h2>
          <p className="on-board-2 text-[16px] font-medium">Tap a card to see what they do.</p>
        </div>
        <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-4">
          {CAST.map((r, i) => <CastCard key={r} role={r} said={said(r)} index={i} />)}
        </div>
      </section>
    </div>
  );
}

function CastCard({ role, said, index }: { role: Role; said: number; index: number }) {
  const [flip, setFlip] = useState(false);
  const r = ROLE[role];
  return (
    <motion.button
      initial={{ y: 30, opacity: 0, rotate: index % 2 ? 2 : -2 }}
      animate={{ y: 0, opacity: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.3 + index * 0.07 }}
      whileHover={{ y: -6 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => setFlip(!flip)}
      aria-pressed={flip}
      className={`flip h-[230px] w-full text-left ${flip ? "is-flipped" : ""}`}
    >
      <span className="flip-inner block">
        <span className="flip-face tap flex flex-col items-start bg-forest p-5 text-on">
          <motion.span whileHover={{ rotate: [0, -12, 10, -6, 0] }} transition={{ duration: 0.6 }}>
            <Avatar role={role} size={60} />
          </motion.span>
          <span className="serif mt-auto block text-[26px]" style={{ color: r.hex }}>{r.name}</span>
          <span className="mt-1.5 block text-[15px] text-on2">{r.who}</span>
        </span>
        <span className="flip-face flip-back flex flex-col p-5 text-forest" style={{ background: r.hex }}>
          <span className="text-[14px] font-semibold">{r.name}</span>
          <span className="mt-2 text-[18px] font-bold leading-snug">{r.does}</span>
          <span className="mt-auto text-[15px] font-bold">{said ? `${said} message${said === 1 ? "" : "s"} so far` : "Quiet so far"}</span>
        </span>
      </span>
    </motion.button>
  );
}
