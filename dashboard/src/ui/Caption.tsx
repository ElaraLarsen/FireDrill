import type { Line } from "../story";
import { TONE } from "./theme";

/** One big sentence about what just happened, in plain words. */
export function Caption({ line, k, onTap }: { line: Line; k: string; onTap?: () => void }) {
  const t = TONE[line.tone];
  return (
    <div className="relative z-10 mx-4 mt-3 sm:mx-6" aria-live="polite">
      <button
        onClick={onTap}
        className="tap lift group flex w-full items-center gap-4 rounded-3xl border border-white/70 bg-white/90 px-5 py-3.5 text-left shadow-[0_12px_40px_-22px_rgb(20_26_51/.35)]"
        title={onTap ? "Next step (→)" : undefined}
      >
        <span key={`i${k}`} className={`pop grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${t.grad} text-white shadow-md`}>{t.icon}</span>
        <span key={`t${k}`} className="slideup min-w-0">
          <span className={`block text-[19px] font-extrabold leading-tight sm:text-[21px] ${t.text}`}>{line.title}</span>
          <span className="mt-0.5 block truncate text-[14px] text-ink2">{line.detail}</span>
        </span>
        {onTap && <span className="ml-auto hidden shrink-0 rounded-full bg-soft px-3 py-1 text-[12px] font-semibold text-ink3 transition-colors group-hover:bg-violet-50 group-hover:text-fixer sm:block">Tap for next →</span>}
      </button>
    </div>
  );
}
