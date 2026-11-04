import { useEffect, useReducer, useState } from "react";
import { emptyState, reduce, type Frame, type State } from "./model";

type Action = { t: "reset" } | { t: "frame"; f: Frame };
const live = (s: State, a: Action): State => (a.t === "reset" ? emptyState() : reduce(s, a.f));

export type Link = "connecting" | "live" | "offline";

/** Follows ws://<gate>:8787/telemetry. The gate replays the room's JSONL on every (re)connect. */
export function useLive(url: string): { state: State; link: Link } {
  const [state, dispatch] = useReducer(live, undefined, emptyState);
  const [link, setLink] = useState<Link>("connecting");

  useEffect(() => {
    let ws: WebSocket | null = null;
    let timer: number | undefined;
    let closed = false;
    let wait = 500;

    const open = () => {
      setLink("connecting");
      ws = new WebSocket(url);
      ws.onopen = () => { wait = 500; dispatch({ t: "reset" }); setLink("live"); };
      ws.onmessage = (e) => {
        try { dispatch({ t: "frame", f: JSON.parse(e.data as string) as Frame }); } catch { /* ignore */ }
      };
      ws.onclose = () => {
        if (closed) return;
        setLink("offline");
        timer = window.setTimeout(open, wait);
        wait = Math.min(wait * 2, 5000);
      };
      ws.onerror = () => ws?.close();
    };
    open();
    return () => { closed = true; window.clearTimeout(timer); ws?.close(); };
  }, [url]);

  return { state, link };
}
