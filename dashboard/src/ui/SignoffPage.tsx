// Page 5: sign-off. The lock only a named human can open, and the gate's merge.
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import * as I from "../icons";
import { latest, short, signOff, type State } from "../model";
import { Avatar, Chip, Empty, INK, PageTitle, Panel, ROLE } from "./theme";

/** A padlock whose shackle lifts when the lock opens. */
function Padlock({ open, hex }: { open: boolean; hex: string }) {
  return (
    <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke={hex} strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" aria-hidden>
      <motion.path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" animate={{ y: open ? -2.6 : 0, rotate: open ? -18 : 0 }} style={{ originX: "8px", originY: "10.5px" }} transition={{ type: "spring", stiffness: 300, damping: 12 }} />
      <rect x="4.5" y="10.5" width="15" height="10" fill={hex} />
      <motion.rect x="11" y="14" width="2" height="3.4" fill={INK.forest} stroke="none" animate={{ scaleY: open ? [1, 1.5, 1] : 1 }} transition={{ duration: 0.5 }} />
    </svg>
  );
}

export function SignoffPage({ s }: { s: State }) {
  const so = signOff(s);
  const v = latest(s.verdicts);
  const [copied, setCopied] = useState(false);
  const cmd = so.phase === "awaiting" ? `@firedrill-gate APPROVE ${so.verdictId}` : "";
  const copy = async () => {
    try { await navigator.clipboard.writeText(cmd); } catch { /* clipboard blocked: still show feedback */ }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };
  const look = {
    no_attack: { hex: INK.stone, title: "Locked: no attack yet", open: false },
    blocked: { hex: v?.result === "PENDING" ? INK.sky : INK.scarlet, title: "Locked", open: false },
    awaiting: { hex: INK.jade, title: "Ready for a human", open: true },
    signed: { hex: INK.jade, title: "Signed off", open: true },
    merged: { hex: INK.jade, title: "Merged by the gate", open: true },
  }[so.phase];
  const refusals = [...s.rejections].reverse();

  return (
    <div className="space-y-4">
      <PageTitle
        title="A human signs, the gate merges"
        lead="The gate checks who is signing by their Switch participant id, not by the words they type. Only the gate holds the key to main."
      />

      <div className="grid gap-4 pt-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <motion.section
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="panel flex flex-col items-center gap-6 p-6 text-center sm:flex-row sm:items-start sm:p-8 sm:text-left"
        >
          <motion.div key={so.phase} initial={{ scale: 0.6, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 320, damping: 14 }} className="grid h-40 w-40 shrink-0 place-items-center bg-p2">
            {so.phase === "merged" ? (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 12, delay: 0.15 }} className="grid h-28 w-28 place-items-center rounded-full text-forest" style={{ background: look.hex }}>
                <I.Merge size={56} />
              </motion.span>
            ) : <Padlock open={look.open} hex={look.hex} />}
          </motion.div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-bold uppercase text-on3">Human sign-off · enforced</div>
            <AnimatePresence mode="wait">
              <motion.h2 key={look.title} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} className="display mt-2 text-[32px] sm:text-[42px]" style={{ color: look.hex }}>
                {look.title}
              </motion.h2>
            </AnimatePresence>
            <div className="mt-3 text-[17px] leading-relaxed text-on2">
              {so.phase === "no_attack" && "No attack, no sign-off. A human can only approve a patch that stayed GREEN after the red team attacked it."}
              {so.phase === "blocked" && so.text}
              {so.phase === "signed" && so.text}
              {so.phase === "merged" && v?.signoff && (
                <>
                  <span className="font-mono text-[15px] font-bold text-mint">{so.text}</span>
                  <span className="mt-1 block">Signed off by <b className="text-on">{v.signoff.by}</b>{v.signoff.participant && <> · <span className="font-mono text-[14px]">{v.signoff.participant}</span></>}</span>
                </>
              )}
              {so.phase === "awaiting" && (
                <>
                  Type this in the room to sign off:
                  <motion.button whileTap={{ scale: 0.96 }} onClick={copy} className="tap mt-3 flex w-full items-center gap-3 bg-p2 py-2 pl-4 pr-2 text-left outline outline-2 -outline-offset-2 outline-jade/60 hover:outline-jade">
                    <code className="min-w-0 flex-1 truncate font-mono text-[15px] font-bold text-mint">{cmd}</code>
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span key={copied ? "y" : "n"} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} className={`inline-flex h-10 shrink-0 items-center gap-1.5 px-3 text-[14px] font-semibold ${copied ? "bg-cream text-forest" : "bg-jade text-forest"}`}>
                        {copied ? <><I.Check size={14} /> Copied</> : <><I.Copy size={14} /> Copy</>}
                      </motion.span>
                    </AnimatePresence>
                  </motion.button>
                  <span className="mt-2 block text-[15px] text-on3">Approvers: {s.approvers.length ? s.approvers.map((a) => `@${a}`).join(", ") : "a named approver"}</span>
                </>
              )}
            </div>
            {s.messages.length === 0 && s.fixes.length === 0 && so.phase !== "merged" && v && (
              <div className="mt-3 text-[15px] font-bold text-on">This recording stops at the ruling: no human sign-off or merge was recorded.</div>
            )}
          </div>
        </motion.section>

        <Panel title="Who tried to sign" hint="Every refusal the gate gave, newest first." delay={0.12}>
          {refusals.length === 0 ? (
            <Empty>Nobody has been refused yet.</Empty>
          ) : (
            <ul className="space-y-1.5">
              {refusals.map((r, i) => (
                <motion.li key={`${r.ts}-${i}`} initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 24, delay: i * 0.06 }} className="flex gap-3 bg-p2 p-4" style={{ borderLeft: `5px solid ${INK.scarlet}` }}>
                  <Avatar role="human" size={40} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-[16px] font-semibold text-flare"><I.Hand size={16} /> Refused · {r.by}</span>
                    <span className="mt-1 block text-[15px] leading-relaxed text-on2">{r.reason}</span>
                  </span>
                </motion.li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {v?.merged && (
        <Panel title="The merge receipt" hint="What the gate wrote to main." delay={0.2}>
          <div className="grid gap-1.5 sm:grid-cols-3">
            {[
              { k: "Fix merged", val: short(v.merged.fix_sha), hex: ROLE.fixer.hex },
              { k: "main is now", val: short(v.merged.main_sha), hex: ROLE.approver.hex },
              { k: "Merged by", val: v.merged.by, hex: ROLE.gate.hex },
            ].map((x, i) => (
              <motion.div key={x.k} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 + i * 0.07 }} className="p-5 text-forest" style={{ background: x.hex }}>
                <div className="text-[14px] font-semibold">{x.k}</div>
                <div className="mt-1 truncate font-mono text-[22px] font-bold">{x.val}</div>
              </motion.div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            <Chip hex={INK.jade}><I.Shield size={15} /> Checked by participant id</Chip>
            <Chip hex={INK.sky}><I.Key size={15} /> Only the gate holds the key</Chip>
          </div>
        </Panel>
      )}
    </div>
  );
}
