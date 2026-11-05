# FireDrill trailer (Remotion)

A 60-second, 1080p, silent trailer built with [Remotion](https://www.remotion.dev) (free for teams of up to 3; see its license).
The live-run scene is drawn from `docs/evidence/live-switch-idempotency-race.jsonl`, a real run on Switch 0.31.0:
`extract_trace.py` writes `src/liveTrace.ts` from that file, so no line is invented. The participants in that run were scripted
(one Mattermost user posted the commands), and the video says so.

```bash
cd video/demo && npm i
python3 extract_trace.py      # regenerate src/liveTrace.ts from the evidence
npx remotion studio           # preview and edit
npx remotion render FireDrillDemo out/firedrill-demo.mp4
```

The Remotion agent skills were installed with `npx skills add remotion-dev/skills -a claude-code` (project level, git-ignored; `skills-lock.json` records them).
