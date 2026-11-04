// GSAP for the landing page only: the scroll-driven and pointer-driven touches that motion's
// component animations don't cover. Everything here is skipped under reduced motion, and the
// cursor and magnets only run on a fine pointer (a mouse or trackpad, not a finger).
//
//   data-gsap="hero-copy"  the hero's words drift up and fade as the hero scrolls away
//   data-gsap="lines"      a paragraph rises in line by line (SplitText, masked lines)
//   data-gsap="band"       the rule tickers skew with the speed of the scroll
//   data-gsap="chars"      the footer wordmark assembles letter by letter, tied to the scroll
//   data-magnet            the element leans towards the pointer and springs back
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useEffect, useRef, type RefObject } from "react";

gsap.registerPlugin(ScrollTrigger, SplitText);

const MOTION = "(prefers-reduced-motion: no-preference)";
const FINE = "(prefers-reduced-motion: no-preference) and (pointer: fine)";

export function useLandingFx(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const mm = gsap.matchMedia();

    mm.add(MOTION, () => {
      const q = gsap.utils.selector(el);

      const hero = q('[data-gsap="hero-copy"]')[0];
      if (hero) {
        gsap.to(hero, {
          yPercent: -22, opacity: 0, ease: "none",
          scrollTrigger: { trigger: hero.closest("section"), start: "top top", end: "bottom 30%", scrub: 0.6 },
        });
      }

      for (const p of q('[data-gsap="lines"]')) {
        SplitText.create(p, {
          type: "lines", mask: "lines", autoSplit: true, aria: "none",
          onSplit: (self) => gsap.from(self.lines, {
            yPercent: 110, duration: 1, ease: "expo.out", stagger: 0.09,
            scrollTrigger: { trigger: p, start: "top 85%", once: true },
          }),
        });
      }

      const bands = q('[data-gsap="band"]');
      if (bands.length) {
        const skew = gsap.quickTo(bands, "skewX", { duration: 0.5, ease: "power3.out" });
        const settle = gsap.delayedCall(0.12, () => skew(0)).pause();
        ScrollTrigger.create({
          start: 0, end: "max",
          onUpdate: (self) => { skew(gsap.utils.clamp(-14, 14, self.getVelocity() / -260)); settle.restart(true); },
        });
      }

      for (const w of q('[data-gsap="chars"]')) {
        SplitText.create(w, {
          type: "chars", autoSplit: true,
          onSplit: (self) => gsap.from(self.chars, {
            yPercent: 115, rotate: () => gsap.utils.random(-14, 14), ease: "back.out(1.6)", stagger: 0.05,
            // The wordmark sits at the foot of the page, so it finishes exactly where the scroll does.
            scrollTrigger: { trigger: w, start: "top bottom", end: "max", scrub: 0.8 },
          }),
        });
      }

      // Text and fonts move the page around after the first paint: measure again once they settle.
      document.fonts.ready.then(() => ScrollTrigger.refresh());
    });

    mm.add(FINE, () => {
      const off: (() => void)[] = [];
      for (const m of el.querySelectorAll<HTMLElement>("[data-magnet]")) {
        const x = gsap.quickTo(m, "x", { duration: 0.5, ease: "power3.out" });
        const y = gsap.quickTo(m, "y", { duration: 0.5, ease: "power3.out" });
        const move = (e: PointerEvent) => {
          const r = m.getBoundingClientRect();
          x((e.clientX - (r.left + r.width / 2)) * 0.32);
          y((e.clientY - (r.top + r.height / 2)) * 0.32);
        };
        const leave = () => gsap.to(m, { x: 0, y: 0, duration: 0.9, ease: "elastic.out(1, 0.35)" });
        m.addEventListener("pointermove", move);
        m.addEventListener("pointerleave", leave);
        off.push(() => { m.removeEventListener("pointermove", move); m.removeEventListener("pointerleave", leave); });
      }
      return () => off.forEach((f) => f());
    });

    return () => mm.revert();
  }, [root]);
}

/** A ring that trails the pointer and swells over anything you can press. Mouse and trackpad only. */
export function Cursor() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const mm = gsap.matchMedia();
    mm.add(FINE, () => {
      gsap.set(c, { xPercent: -50, yPercent: -50, autoAlpha: 0 });
      const x = gsap.quickTo(c, "x", { duration: 0.35, ease: "power3.out" });
      const y = gsap.quickTo(c, "y", { duration: 0.35, ease: "power3.out" });
      let over = false;
      const move = (e: PointerEvent) => {
        x(e.clientX); y(e.clientY);
        const hit = !!(e.target as HTMLElement | null)?.closest?.("button, a");
        if (hit !== over) {
          over = hit;
          gsap.to(c, { scale: hit ? 2.3 : 1, backgroundColor: hit ? "rgb(198 244 50 / .45)" : "rgb(198 244 50 / 0)", duration: 0.35, ease: "power3.out" });
        }
        gsap.to(c, { autoAlpha: 1, duration: 0.2, overwrite: "auto" });
      };
      const gone = () => gsap.to(c, { autoAlpha: 0, duration: 0.2 });
      const down = () => gsap.to(c, { scale: over ? 1.8 : 0.7, duration: 0.15 });
      const up = () => gsap.to(c, { scale: over ? 2.3 : 1, duration: 0.3, ease: "back.out(3)" });
      window.addEventListener("pointermove", move, { passive: true });
      document.documentElement.addEventListener("pointerleave", gone);
      window.addEventListener("pointerdown", down);
      window.addEventListener("pointerup", up);
      return () => {
        window.removeEventListener("pointermove", move);
        document.documentElement.removeEventListener("pointerleave", gone);
        window.removeEventListener("pointerdown", down);
        window.removeEventListener("pointerup", up);
      };
    });
    return () => mm.revert();
  }, []);
  return <div ref={ref} aria-hidden className="pointer-events-none fixed left-0 top-0 z-[90] h-7 w-7 rounded-full border-[2.5px] border-forest opacity-0" />;
}
