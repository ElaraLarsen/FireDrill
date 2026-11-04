// Text that resolves out of noise when it changes, after motion-primitives' Text Scramble.
// Screen readers get the real text at once; under reduced motion the text simply swaps.
import { useEffect, useState, type ElementType } from "react";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=?";

export function Scramble({ text, as: Tag = "span", className, duration = 0.7, delay = 0 }: { text: string; as?: ElementType; className?: string; duration?: number; delay?: number }) {
  const [out, setOut] = useState(text);

  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { setOut(text); return; }
    let raf = 0;
    let start = 0;
    const total = duration * 1000;
    const tick = (now: number) => {
      if (!start) start = now + delay * 1000;
      const p = Math.max(0, Math.min(1, (now - start) / total));
      const shown = Math.floor(p * text.length);
      let s = "";
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        s += i < shown || ch === " " || ch === "\n" ? ch : CHARS[(Math.random() * CHARS.length) | 0];
      }
      setOut(s);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, duration, delay]);

  return (
    <Tag className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden>{out}</span>
    </Tag>
  );
}
