import { parseJsonl, type Frame } from "./model";

export interface Run {
  id: string;
  title: string;
  incident: string | null;
  source: "fixture" | "recorded";
  scripted: boolean;
  /** "test-stand-in" runs sort after runs from the real gate.verify. */
  verifier: string;
  provenance: string;
  frames: Frame[];
}

const raw = import.meta.glob("../fixtures/*.jsonl", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const metas = import.meta.glob("../fixtures/*.meta.json", { import: "default", eager: true }) as Record<string, Record<string, unknown>>;

/** Recorded drills committed in dashboard/fixtures/: they replay with no gate, Docker or API keys. */
export function fixtureRuns(): Run[] {
  const runs = Object.entries(raw).map(([path, text]) => {
    const id = path.split("/").pop()!.replace(/\.jsonl$/, "");
    const meta = metas[path.replace(/\.jsonl$/, ".meta.json")] ?? {};
    return {
      id,
      title: String(meta.title ?? id),
      incident: (meta.incident as string) ?? id,
      source: "fixture" as const,
      scripted: meta.scripted !== false,
      verifier: String(meta.verifier ?? "gate.verify"),
      provenance: String(meta.provenance ?? "Recorded frames."),
      frames: parseJsonl(text),
    };
  });
  const rank = (r: Run) => (r.verifier === "test-stand-in" ? 1 : 0);
  return runs.sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id));
}

/** Runs the gate itself recorded (POST /api/replay/<incident>); empty if the gate is unreachable. */
export async function gateRuns(base: string): Promise<Run[]> {
  try {
    const r = await fetch(`${base}/api/incidents`);
    if (!r.ok) return [];
    const j = (await r.json()) as { runs: { source: string; name: string; incident: string | null; frames: number }[] };
    const out: Run[] = [];
    for (const run of j.runs.filter((x) => x.source === "recorded")) {
      const rr = await fetch(`${base}/api/replay/${encodeURIComponent(run.name)}?source=recorded`, { method: "POST" });
      if (!rr.ok) continue;
      const body = (await rr.json()) as { frames_data: Frame[] };
      out.push({
        id: `gate:${run.name}`, title: `Gate run · ${run.incident ?? run.name}`, incident: run.incident,
        source: "recorded", verifier: "gate.verify", scripted: body.frames_data.some((f) => f.data?.manual === true),
        provenance: "Recorded by this gate from a live room.", frames: body.frames_data,
      });
    }
    return out;
  } catch {
    return [];
  }
}
