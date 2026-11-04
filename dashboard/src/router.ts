// A tiny hash router: every page has its own address, so back/forward and shared links work on any
// static host. Routes: #/ (the landing page; old #/landing links land there too), #/cases (pick a
// case; the route named "home"), #/case/<run>/<page>?step=<n|end>, #/live/<page>.

import { useEffect, useState } from "react";
import { isPage, type Page } from "./pages";

export type Route =
  | { name: "home" }
  | { name: "landing" }
  | { name: "case"; run: string; page: Page; step: number | "end" | null }
  | { name: "live"; page: Page };

export function parse(hash: string): Route {
  const [path, query = ""] = hash.replace(/^#/, "").split("?");
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  const q = new URLSearchParams(query);
  if (parts[0] === "case" && parts[1]) {
    const st = q.get("step");
    return { name: "case", run: parts[1], page: isPage(parts[2]) ? parts[2] : "case", step: st === "end" ? "end" : st === null ? null : Math.max(0, Number(st) || 0) };
  }
  if (parts[0] === "live") return { name: "live", page: isPage(parts[1]) ? parts[1] : "case" };
  if (parts[0] === "cases") return { name: "home" };
  return { name: "landing" };
}

export function href(r: Route): string {
  if (r.name === "case") return `#/case/${encodeURIComponent(r.run)}/${r.page}${r.step !== null ? `?step=${r.step}` : ""}`;
  if (r.name === "live") return `#/live/${r.page}`;
  if (r.name === "home") return "#/cases";
  return "#/";
}

/** True when the page opened from an old ?replay= link: the app then picks the page from the step. */
export let fromLegacyLink = false;

/** Old links used ?replay=<run>&step=<n|end>; turn them into the matching page address once. */
function upgradeLegacy(): void {
  if (typeof location === "undefined") return;
  const q = new URLSearchParams(location.search);
  const run = q.get("replay");
  if (!run || location.hash.length > 2) return;
  const step = q.get("step");
  fromLegacyLink = true;
  history.replaceState(null, "", `${location.pathname}${href({ name: "case", run, page: "case", step: step === "end" ? "end" : step === null ? null : Number(step) || 0 })}`);
}

export function useRoute(): [Route, (r: Route, opts?: { replace?: boolean }) => void] {
  const [route, setRoute] = useState<Route>(() => { upgradeLegacy(); return parse(typeof location !== "undefined" ? location.hash : ""); });
  useEffect(() => {
    const on = () => setRoute(parse(location.hash));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const go = (r: Route, opts?: { replace?: boolean }) => {
    const h = href(r);
    if (h === location.hash) return;
    if (opts?.replace) history.replaceState(null, "", h);
    else history.pushState(null, "", h);
    setRoute(r);
  };
  return [route, go];
}
