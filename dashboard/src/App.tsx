import Lenis from "lenis";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fixtureRuns, gateRuns, type Run } from "./fixtures";
import { confetti, installTapFeedback } from "./fx";
import * as I from "./icons";
import { INCIDENTS, replay } from "./model";
import { nextStepOn, PAGE_META, PAGES, pageForState, pageStates, pageTrack, type Page } from "./pages";
import { fromLegacyLink, useRoute } from "./router";
import { narrate, narrateState } from "./story";
import type { Cmd } from "./console";
import { AttackPage } from "./ui/AttackPage";
import { CasePage } from "./ui/CasePage";
import { Console } from "./ui/Console";
import { HOME_BOARD, Home } from "./ui/Home";
import { RoomPage } from "./ui/RoomPage";
import { RulingPage } from "./ui/RulingPage";
import { pageIcon, TopBar, Trail } from "./ui/Shell";
import { SignoffPage } from "./ui/SignoffPage";
import { INK, PAGE_INK } from "./ui/theme";
import { useLive } from "./useLive";
import { stages } from "./views";

// The gate runs on the same machine as the dashboard. On a hosted copy (Vercel, Pages, ...) there is
// no gate to follow, so unless VITE_TELEMETRY_URL says otherwise the dashboard is replay-only.
const host = typeof location !== "undefined" ? location.hostname : "";
const isLocal = host === "" || host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host.endsWith(".local");
const WS_URL: string | null = (import.meta.env.VITE_TELEMETRY_URL as string | undefined) ?? (isLocal ? `ws://${host || "localhost"}:8787/telemetry` : null);
const HTTP_URL = WS_URL ? WS_URL.replace(/^ws/, "http").replace(/\/telemetry$/, "") : null;

const VIEW: Record<Page, typeof CasePage> = { case: CasePage, room: RoomPage, attack: AttackPage, ruling: RulingPage, signoff: SignoffPage };

export default function App() {
  const { state: liveState, link } = useLive(WS_URL);
  const [runs, setRuns] = useState<Run[]>(() => fixtureRuns());
  const [route, go] = useRoute();
  const runId = route.name === "case" ? route.run : null;
  const run = useMemo(() => runs.find((r) => r.id === runId) ?? null, [runs, runId]);
  const total = run?.frames.length ?? 0;
  const track = useMemo(() => (run ? pageTrack(run.frames) : ["case" as Page]), [run]);
  const resolve = useCallback((st: number | "end" | null) => (st === "end" ? total : st === null ? 0 : Math.min(total, st)), [total]);

  // Open on the step the address names, so a link to a finished drill doesn't replay its celebration.
  const [step, setStep] = useState(() => (route.name === "case" ? resolve(route.step) : 0));
  const [playing, setPlaying] = useState(false);
  // While true, the page follows the story: every step lands on the page its frame belongs to.
  const follow = useRef(fromLegacyLink);
  const lenis = useRef<Lenis | null>(null);

  useEffect(() => installTapFeedback(), []);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const l = new Lenis({ autoRaf: true, lerp: 0.12, prevent: (n) => n.hasAttribute?.("data-lenis-prevent") });
    lenis.current = l;
    return () => { l.destroy(); lenis.current = null; };
  }, []);

  useEffect(() => {
    let alive = true;
    if (!HTTP_URL) return;
    gateRuns(HTTP_URL).then((g) => { if (alive && g.length) setRuns((r) => [...g, ...r.filter((x) => x.source === "fixture")]); });
    return () => { alive = false; };
  }, [link]);

  // A new case (or its recording arriving): start where the address says. This happens during render,
  // not in an effect, so no frame ever shows the old case's step. A stale step would be written back
  // to the address, fight the address's own step, and fire the merge confetti on every swing.
  const [stepRun, setStepRun] = useState(run?.id ?? null);
  if (stepRun !== (run?.id ?? null)) {
    setStepRun(run?.id ?? null);
    setStep(route.name === "case" ? resolve(route.step) : 0);
  }

  // Back/forward in the browser: take the step from the address.
  useEffect(() => {
    if (route.name !== "case" || !run) return;
    const want = resolve(route.step);
    if (want !== step) { follow.current = false; setPlaying(false); setStep(want); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  // Keep the address in step with the replay; while following, move to the frame's page.
  useEffect(() => {
    if (!run || route.name !== "case") return;
    const page = follow.current ? track[Math.min(step, track.length - 1)] : route.page;
    go({ name: "case", run: run.id, page, step }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, run?.id]);

  // Following a live gate: move to the page the latest state belongs to.
  useEffect(() => {
    if (route.name !== "live" || !follow.current) return;
    go({ name: "live", page: pageForState(liveState) }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveState.frames]);

  useEffect(() => {
    if (!playing || !run) return;
    if (step >= total) { setPlaying(false); return; }
    // Check rows stream quickly; verdicts and room events linger so people can read them.
    const next = run.frames[step]?.kind;
    // A page that just opened gets a moment of its own before the story moves on.
    const arrived = step > 0 && track[step] !== track[step - 1];
    const base = Math.max(arrived ? 2200 : 0, next === "check" ? 320 : next === "verdict" || next === "merge" ? 1500 : 1000);
    const t = window.setTimeout(() => { follow.current = true; setStep((s) => Math.min(total, s + 1)); }, base);
    return () => window.clearTimeout(t);
  }, [playing, step, total, run, track]);

  const pick = useCallback((id: string) => {
    follow.current = true;
    go({ name: "case", run: id, page: "case", step: 0 });
    setStep(0);
    setPlaying(false);
  }, [go]);
  const home = () => { setPlaying(false); go({ name: "home" }); };
  const goLive = () => { follow.current = true; setPlaying(false); go({ name: "live", page: pageForState(liveState) }); };
  const stepBy = useCallback((d: number) => { follow.current = true; setPlaying(false); setStep((s) => Math.max(0, Math.min(total, s + d))); }, [total]);
  const openPage = useCallback((p: Page) => {
    follow.current = false;
    if (route.name === "case") go({ ...route, page: p, step });
    else if (route.name === "live") go({ name: "live", page: p });
  }, [route, step, go]);
  /** "Continue": move the story on to the next page's process, or just open the page if it never comes. */
  const continueTo = useCallback((p: Page) => {
    const n = run ? nextStepOn(track, p, step) : undefined;
    if (n === undefined) { openPage(p); return; }
    follow.current = true;
    setStep(n);
  }, [run, track, step, openPage]);

  /** The prompt's commands. Whatever can't be done returns a sentence for the console to print. */
  const exec = useCallback((c: Cmd): string | void => {
    if (route.name === "home") return;
    switch (c.t) {
      case "next":
        if (!run) return "Following a live gate: there are no recorded steps to run.";
        if (step >= total) return "That is the end of the drill. Try reset, back, or case <name>.";
        stepBy(c.n);
        return;
      case "back":
        if (!run || step === 0) return "Already at the start.";
        stepBy(-c.n);
        return;
      case "run":
        if (!run) return "Following a live gate: there is nothing to run.";
        if (step >= total) return "That is the end of the drill. Try reset first.";
        follow.current = true;
        setPlaying(true);
        return;
      case "reset":
        if (!run) return "Following a live gate: there is nothing to rewind.";
        follow.current = true; setPlaying(false); setStep(0);
        return;
      case "goto": openPage(c.page); return;
      case "case": {
        const r = runFor(c.id);
        if (!r) return `No case called ${c.id}. Try ${INCIDENTS.join(", ")}.`;
        pick(r.id);
        return;
      }
      case "home": home(); return;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, run, step, total, stepBy, openPage, pick, runs]);

  // While it runs on its own, any key stops it. Arrows step when the prompt isn't holding focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!run || e.metaKey || e.altKey || ["Shift", "Control", "Meta", "Alt"].includes(e.key)) return;
      if (playing) { e.preventDefault(); setPlaying(false); return; }
      if ((e.target as HTMLElement)?.closest?.("input, select, textarea, summary, button")) return;
      if (e.key === "ArrowRight") stepBy(1);
      else if (e.key === "ArrowLeft") stepBy(-1);
      else if (e.key === "/") { e.preventDefault(); document.querySelector<HTMLInputElement>(".term-input")?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run, playing, stepBy]);

  const state = run ? replay(run.frames, step) : liveState;
  const frame = run && step > 0 ? run.frames[step - 1] : null;
  const line = run ? narrate(frame, state.approvers) : narrateState(state);
  const nextLine = run && step < total ? narrate(run.frames[step], state.approvers) : null;
  const page: Page = route.name === "home" ? "case" : route.page;

  // Celebrate the moment the gate merges (not when a page simply opens on a merged drill).
  const merged = state.verdicts.some((v) => v.merged);
  const wasMerged = useRef<boolean | null>(null);
  const mergedFor = useRef<string | null>(null);
  useEffect(() => {
    // Opening a different case (or going home) sets a new baseline instead of celebrating.
    const id = runId ?? "live";
    if (mergedFor.current === id && wasMerged.current === false && merged) confetti();
    mergedFor.current = id;
    wasMerged.current = merged;
  }, [merged, runId]);

  // A new page starts at the top.
  const pageKey = `${route.name}:${runId}:${page}`;
  const lastPage = useRef<Page>(page);
  const dir = PAGES.indexOf(page) >= PAGES.indexOf(lastPage.current) ? 1 : -1;
  useEffect(() => {
    lastPage.current = page;
    if (lenis.current) lenis.current.scrollTo(0, { duration: 0.8 });
    else window.scrollTo({ top: 0 });
  }, [pageKey, page]);

  // The page you are on is printed in its own ink: the whole board turns that colour.
  const ink = route.name === "home" ? HOME_BOARD : PAGE_INK[page];
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--board", ink.board);
    root.style.setProperty("--on-board", ink.on);
    root.classList.toggle("board-dark", ink.board === INK.forest);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", ink.board);
  }, [ink]);

  const runFor = (inc: string) => runs.find((r) => r.incident === inc);

  if (route.name === "home") {
    return (
      <MotionConfig reducedMotion="user">
        <a href="#cases" className="skip">Skip to the cases</a>
        <div className="grain" aria-hidden />
        <Home runFor={runFor} onPick={pick} onHome={home} link={link} onLive={link === "live" ? goLive : undefined} />
      </MotionConfig>
    );
  }

  const View = VIEW[page];
  const at = PAGES.indexOf(page);
  const prev = PAGES[at - 1];
  const next = PAGES[at + 1];

  return (
    <MotionConfig reducedMotion="user">
      <a href="#page" className="skip">Skip to the page</a>
      <div className="grain" aria-hidden />
      <div className="relative mx-auto max-w-[1440px] pb-[calc(var(--dock,200px)+32px)]">
        <TopBar
          run={run} link={link}
          runFor={runFor}
          activeIncident={run?.incident ?? liveState.incident}
          onPick={pick}
          onHome={home}
          onLive={run && (link === "live" || link === "connecting") ? goLive : undefined}
        />
        <Trail page={page} states={pageStates(stages(state))} onGo={openPage} />

        <main id="page" tabIndex={-1} className="relative z-10 px-4 pt-8 outline-none sm:px-8">
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div
              key={pageKey}
              custom={dir}
              variants={{
                enter: (d: number) => ({ x: d * 60, opacity: 0 }),
                show: { x: 0, opacity: 1 },
                leave: (d: number) => ({ x: d * -60, opacity: 0 }),
              }}
              initial="enter"
              animate="show"
              exit="leave"
              transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
            >
              <View s={state} />
            </motion.div>
          </AnimatePresence>

          <nav aria-label="Previous and next step" className="mt-10 flex flex-wrap items-center gap-1.5">
            {prev && (
              <motion.button whileHover={{ x: -4 }} whileTap={{ scale: 0.95 }} onClick={() => openPage(prev)} className="tap inline-flex h-16 items-center gap-3 pl-3 pr-6 text-[17px] font-semibold text-forest" style={{ background: PAGE_INK[prev].board, color: PAGE_INK[prev].on }}>
                <I.Chevron size={20} className="rotate-180" /> {PAGE_META[prev].label}
              </motion.button>
            )}
            {next && (
              <motion.button
                whileHover={{ x: 6 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => continueTo(next)}
                className="tap group ml-auto inline-flex h-16 items-center gap-4 bg-forest pl-6 pr-2 text-[18px] font-semibold text-on"
              >
                Next: {PAGE_META[next].label}
                <span className="grid h-12 w-12 place-items-center transition-transform duration-300 group-hover:translate-x-1" style={{ background: PAGE_INK[next].board === INK.forest ? INK.lime : PAGE_INK[next].board, color: INK.forest }}>{pageIcon(next, 22)}</span>
              </motion.button>
            )}
            {!next && run && (
              <motion.button whileHover={{ x: 6 }} whileTap={{ scale: 0.95 }} onClick={home} className="tap ml-auto inline-flex h-16 items-center gap-3 bg-forest px-7 text-[18px] font-semibold text-on">
                Pick another case <I.Chevron size={20} />
              </motion.button>
            )}
          </nav>
        </main>
      </div>

      <Console
        title={run?.incident ?? liveState.incident ?? "live"}
        meta={run ? `${run.scripted ? "scripted cast" : "recorded room"} · ${run.verifier === "test-stand-in" ? "test verifier" : "real verifier"} · replay` : "live gate"}
        frames={run?.frames ?? null} step={step}
        running={playing} state={state} page={page}
        line={line} nextLine={nextLine}
        onCommand={exec} onStop={() => setPlaying(false)}
      />
    </MotionConfig>
  );
}
