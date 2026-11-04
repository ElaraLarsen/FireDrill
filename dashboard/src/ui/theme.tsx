// Who is who, in colour. One place, so every panel agrees.
import type { ReactNode } from "react";
import * as I from "../icons";
import type { Tone } from "../story";

export type Role = "fixer" | "breaker" | "gate" | "approver" | "human";

export const ROLE: Record<Role, { name: string; who: string; tag: string; text: string; bg: string; soft: string; ring: string; on: string; grad: string; icon: ReactNode }> = {
  fixer: { name: "Fixer", who: "Claude agent", tag: "FIXER :: claude", text: "text-fixer", bg: "bg-fixer", soft: "bg-fixer/8", ring: "ring-fixer/30", on: "ring-fixer/70", grad: "from-violet-500 to-fuchsia-500", icon: <I.Wrench size={16} /> },
  breaker: { name: "Breaker", who: "Codex agent", tag: "BREAKER :: codex", text: "text-breaker", bg: "bg-breaker", soft: "bg-breaker/8", ring: "ring-breaker/30", on: "ring-breaker/70", grad: "from-pink-500 to-rose-500", icon: <I.Zap size={16} /> },
  gate: { name: "Gate", who: "The arbiter", tag: "GATE :: arbiter", text: "text-gate", bg: "bg-gate", soft: "bg-gate/8", ring: "ring-gate/30", on: "ring-gate/70", grad: "from-blue-600 to-indigo-500", icon: <I.Gavel size={16} /> },
  approver: { name: "Approver", who: "Named human", tag: "APPROVER :: human", text: "text-approver", bg: "bg-approver", soft: "bg-approver/8", ring: "ring-approver/30", on: "ring-approver/70", grad: "from-teal-500 to-emerald-500", icon: <I.Key size={16} /> },
  human: { name: "Guest", who: "Anyone else", tag: "HUMAN", text: "text-human", bg: "bg-human", soft: "bg-human/8", ring: "ring-human/30", on: "ring-human/70", grad: "from-slate-400 to-slate-500", icon: <I.User size={16} /> },
};

export const TONE: Record<Tone, { text: string; grad: string; icon: ReactNode }> = {
  fixer: { text: "text-fixer", grad: ROLE.fixer.grad, icon: <I.Wrench size={22} /> },
  breaker: { text: "text-breaker", grad: ROLE.breaker.grad, icon: <I.Zap size={22} /> },
  gate: { text: "text-gate", grad: ROLE.gate.grad, icon: <I.Gavel size={22} /> },
  approver: { text: "text-approver", grad: ROLE.approver.grad, icon: <I.Key size={22} /> },
  human: { text: "text-human", grad: ROLE.human.grad, icon: <I.Hand size={22} /> },
  pass: { text: "text-pass", grad: "from-emerald-500 to-teal-500", icon: <I.Check size={22} /> },
  fail: { text: "text-fail", grad: "from-rose-500 to-pink-600", icon: <I.Cross size={22} /> },
  wait: { text: "text-wait", grad: "from-sky-500 to-blue-500", icon: <I.Sparkle size={22} /> },
};

export const INCIDENT_ICON: Record<string, ReactNode> = {
  "idempotency-race": <I.CreditCard size={20} />,
  "ratelimit-boundary": <I.Gauge size={20} />,
  "pagination-cursor": <I.Pages size={20} />,
};
export const INCIDENT_GRAD: Record<string, string> = {
  "idempotency-race": "from-violet-500 to-indigo-500",
  "ratelimit-boundary": "from-sky-500 to-cyan-500",
  "pagination-cursor": "from-teal-500 to-emerald-500",
};
export const INCIDENT_PLAIN: Record<string, string> = {
  "idempotency-race": "Customers get charged twice",
  "ratelimit-boundary": "The speed limit lets too much through",
  "pagination-cursor": "Pages repeat or skip items",
};

export function Avatar({ role, size = 34, pulse }: { role: Role; size?: number; pulse?: boolean }) {
  const r = ROLE[role];
  return (
    <span
      className={`relative grid shrink-0 place-items-center rounded-full bg-gradient-to-br ${r.grad} text-white shadow-sm ${pulse ? `pingring ${r.text}` : ""}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span className="text-white">{r.icon}</span>
    </span>
  );
}

export function Card({ title, hint, icon, right, children, className = "" }: { title: string; hint: string; icon: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`glass flex min-h-0 min-w-0 flex-col rounded-3xl border border-white/70 shadow-[0_1px_0_rgb(255_255_255/.8)_inset,0_12px_40px_-18px_rgb(20_26_51/.25)] ${className}`}>
      <header className="flex shrink-0 items-center gap-3 px-5 pb-3 pt-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-soft text-ink2 ring-1 ring-line">{icon}</span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold leading-tight text-ink">{title}</h2>
          <p className="truncate text-[12px] text-ink3">{hint}</p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">{right}</div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
    </section>
  );
}
