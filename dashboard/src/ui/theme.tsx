// Who is who, and which colour they wear. One place, so every page agrees.
import { motion } from "motion/react";
import type { ReactNode } from "react";
import * as I from "../icons";
import type { Page } from "../pages";
import type { Tone } from "../story";
import { Scramble } from "./Scramble";

export type Role = "fixer" | "breaker" | "gate" | "approver" | "human";

/**
 * The palette: cream paper and deep forest as the ground, then four hues that each mean one thing:
 * lime the fixer, rose the attack, sky the gate, lilac the human. Jade is a pass, scarlet a fail.
 */
export const INK = {
  forest: "#0f2a1d", pine: "#2f5d3f", moss: "#7fb77e", sage: "#a9c5a0", cream: "#f3eedf", lime: "#c6f432",
  rose: "#ff8fb1", sky: "#8fcbf2", lilac: "#c4b3f6",
  jade: "#1fa463", scarlet: "#e5383b", stone: "#b9c4b0",
} as const;

/** Each step has its own board: who is acting on that page wears the same colour. */
export const PAGE_INK: Record<Page, { board: string; on: string }> = {
  case: { board: INK.cream, on: INK.forest },
  room: { board: INK.sky, on: INK.forest },
  attack: { board: INK.rose, on: INK.forest },
  ruling: { board: INK.forest, on: INK.cream },
  signoff: { board: INK.lilac, on: INK.forest },
};

export const ROLE: Record<Role, { name: string; who: string; does: string; tag: string; hex: string; icon: (s?: number) => ReactNode }> = {
  fixer: { name: "Fixer", who: "Claude agent", does: "Writes the patch that fixes the bug.", tag: "FIXER", hex: INK.lime, icon: (s = 16) => <I.Wrench size={s} /> },
  breaker: { name: "Breaker", who: "Codex agent", does: "Writes hostile tests to break the patch.", tag: "BREAKER", hex: INK.rose, icon: (s = 16) => <I.Zap size={s} /> },
  gate: { name: "Gate", who: "The referee", does: "Runs every test for real. Holds the only key to main.", tag: "GATE", hex: INK.sky, icon: (s = 16) => <I.Gavel size={s} /> },
  approver: { name: "Approver", who: "A named human", does: "Signs off, but only after the patch survives an attack.", tag: "APPROVER", hex: INK.lilac, icon: (s = 16) => <I.Key size={s} /> },
  human: { name: "Guest", who: "Anyone else", does: "Can talk, but can't sign off.", tag: "GUEST", hex: INK.stone, icon: (s = 16) => <I.User size={s} /> },
};

export const TONE: Record<Tone, { hex: string; icon: (s?: number) => ReactNode }> = {
  fixer: { hex: ROLE.fixer.hex, icon: (s = 24) => <I.Wrench size={s} /> },
  breaker: { hex: ROLE.breaker.hex, icon: (s = 24) => <I.Zap size={s} /> },
  gate: { hex: ROLE.gate.hex, icon: (s = 24) => <I.Gavel size={s} /> },
  approver: { hex: ROLE.approver.hex, icon: (s = 24) => <I.Key size={s} /> },
  human: { hex: ROLE.human.hex, icon: (s = 24) => <I.Hand size={s} /> },
  pass: { hex: INK.jade, icon: (s = 24) => <I.Check size={s} /> },
  fail: { hex: INK.scarlet, icon: (s = 24) => <I.Cross size={s} /> },
  wait: { hex: INK.sky, icon: (s = 24) => <I.Sparkle size={s} /> },
};

export const INCIDENT_ICON: Record<string, (s?: number) => ReactNode> = {
  "idempotency-race": (s = 22) => <I.CreditCard size={s} />,
  "ratelimit-boundary": (s = 22) => <I.Gauge size={s} />,
  "pagination-cursor": (s = 22) => <I.Pages size={s} />,
};
export const INCIDENT_HEX: Record<string, string> = {
  "idempotency-race": INK.rose,
  "ratelimit-boundary": INK.sky,
  "pagination-cursor": INK.lilac,
};
export const INCIDENT_PLAIN: Record<string, string> = {
  "idempotency-race": "Customers get charged twice",
  "ratelimit-boundary": "The speed limit lets too much through",
  "pagination-cursor": "Pages repeat or skip items",
};

/** A face for each member of the cast: a disc of their colour with their tool drawn in forest. */
export function Avatar({ role, size = 36 }: { role: Role; size?: number }) {
  const r = ROLE[role];
  return (
    <span className="relative grid shrink-0 place-items-center rounded-full text-forest" style={{ width: size, height: size, background: r.hex }} aria-hidden>
      {r.icon(Math.round(size * 0.48))}
    </span>
  );
}

/** Split a title so its last word can be set in italic, the way an editorial headline lands. */
export function Headline({ text, className = "", as = "h1", duration = 0.8 }: { text: string; className?: string; as?: "h1" | "h2" | "span"; duration?: number }) {
  const cut = text.trimEnd().lastIndexOf(" ");
  const head = cut > 0 ? text.slice(0, cut + 1) : "";
  const tail = cut > 0 ? text.slice(cut + 1) : text;
  const Tag = as;
  return (
    <Tag className={`display ${className}`}>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {head && <Scramble text={head} duration={duration} />}
        <em><Scramble text={tail} duration={duration} delay={0.12} /></em>
      </span>
    </Tag>
  );
}

/** The heading every page opens with. It scrambles in and rises, with a lead in plain words under it. */
export function PageTitle({ title, lead, right, k, eyebrow }: { title: string; lead: string; right?: ReactNode; k?: string; eyebrow?: string }) {
  return (
    <header className="flex flex-wrap items-end gap-x-8 gap-y-5">
      <div className="min-w-0 flex-1 basis-[340px]">
        {eyebrow && <div className="label on-board-2 mb-4">{eyebrow}</div>}
        <motion.div key={k ?? title} initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}>
          <Headline text={title} className="max-w-[18ch] text-[48px] sm:text-[76px] xl:text-[96px]" />
        </motion.div>
        <motion.p
          initial={{ y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          className="on-board-2 mt-5 max-w-[58ch] text-[18px] leading-relaxed sm:text-[19px]"
        >
          {lead}
        </motion.p>
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </header>
  );
}

/** A section of a page on a forest panel: a serif heading, then its content. */
export function Panel({ title, hint, right, children, className = "", delay = 0 }: { title: string; hint?: string; right?: ReactNode; children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.section
      initial={{ y: 28, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay }}
      className={`panel min-w-0 p-5 sm:p-7 ${className}`}
    >
      <div className="mb-5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="serif text-[30px] text-on sm:text-[34px]">{title}</h2>
        {hint && <p className="text-[15px] text-on3">{hint}</p>}
        {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
      </div>
      {children}
    </motion.section>
  );
}

/** `code` and **bold** inside plain sentences from the room and the brief. */
export function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((t, i) =>
        t.startsWith("**") && t.endsWith("**") && t.length > 4 ? <strong key={i} className="font-bold">{t.slice(2, -2)}</strong>
        : t.startsWith("`") && t.endsWith("`") && t.length > 2 ? <code key={i} className="rounded-md bg-white/10 px-1.5 py-px font-mono text-[0.86em]">{t.slice(1, -1)}</code>
        : t)}
    </>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="inset px-5 py-6 text-center text-[16px] leading-relaxed text-on2">{children}</p>;
}

/** A small tag: a fact on a pill of its colour, or plain on a forest panel. */
export function Chip({ children, hex, mono, className = "" }: { children: ReactNode; hex?: string; mono?: boolean; className?: string }) {
  return (
    <span
      className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-semibold ${mono ? "font-mono text-[13px] font-normal" : ""} ${className}`}
      style={hex ? { color: INK.forest, background: hex } : { background: "var(--color-p3)", color: "var(--color-on)" }}
    >
      {children}
    </span>
  );
}
