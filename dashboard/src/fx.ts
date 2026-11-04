// Touch feedback that every tappable element gets for free, plus the merge celebration.

const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Any element with class `tap` gets a ripple from the touch point (and a tiny buzz on phones). */
export function installTapFeedback(): () => void {
  const onDown = (e: PointerEvent) => {
    const el = (e.target as HTMLElement | null)?.closest?.(".tap") as HTMLElement | null;
    if (!el || el.hasAttribute("disabled")) return;
    if (e.pointerType === "touch" && "vibrate" in navigator) navigator.vibrate?.(6);
    if (reduced()) return;
    const r = el.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2.2;
    const dot = document.createElement("span");
    dot.className = "ripple";
    dot.style.width = dot.style.height = `${size}px`;
    dot.style.left = `${e.clientX - r.left - size / 2}px`;
    dot.style.top = `${e.clientY - r.top - size / 2}px`;
    el.appendChild(dot);
    dot.addEventListener("animationend", () => dot.remove(), { once: true });
  };
  document.addEventListener("pointerdown", onDown);
  return () => document.removeEventListener("pointerdown", onDown);
}

const COLORS = ["#7c3aed", "#db2777", "#2563eb", "#0d9488", "#10b981", "#0284c7", "#a78bfa", "#f472b6", "#22d3ee"];

/** A short burst of confetti from the top of the screen. */
export function confetti(pieces = 90): void {
  if (reduced() || typeof document === "undefined") return;
  const host = document.createElement("div");
  host.className = "confetti";
  for (let i = 0; i < pieces; i++) {
    const b = document.createElement("b");
    b.style.left = `${Math.random() * 100}vw`;
    b.style.background = COLORS[i % COLORS.length];
    b.style.setProperty("--dx", `${(Math.random() - 0.5) * 30}vw`);
    b.style.setProperty("--rot", `${(Math.random() - 0.5) * 1080}deg`);
    b.style.animationDuration = `${1.6 + Math.random() * 1.6}s`;
    b.style.animationDelay = `${Math.random() * 0.25}s`;
    if (i % 3 === 0) b.style.borderRadius = "50%";
    host.appendChild(b);
  }
  document.body.appendChild(host);
  window.setTimeout(() => host.remove(), 3800);
}
