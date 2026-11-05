# FireDrill videos (Remotion)

Two compositions, both 1920x1080 at 30 fps, built with [Remotion](https://www.remotion.dev) (free for teams of up to 3; check its license
for a team of 4):

- `FireDrillExplainer`: a 3 minute 12 second narrated explainer with captions burned in. Why and how the app works, real footage of the
  dashboard and of the live Switch room in Mattermost, and what is real versus scripted.
- `FireDrillTrailer`: a 60 second silent trailer.

## How the explainer was made

- **Voice:** [Kokoro-82M](https://github.com/thewh1teagle/kokoro-onnx) (Apache-2.0), run locally through `kokoro-onnx`, voice `af_heart`.
  No account, no cloud. `tools/speak.py script.json out/` writes one WAV per line plus `durations.json`; every scene is as long as its line.
- **Footage:** real screen captures, recorded with Chrome's screencast API at the page's own frame rate (`tools/capture.mjs` for the
  dashboard served by the compose stack, `tools/mm.mjs` for the Mattermost room the gate ruled in). Nothing is mocked up.
- **Trace in the trailer:** `extract_trace.py` writes `src/liveTrace.ts` from `docs/evidence/live-switch-idempotency-race.jsonl`.
- **Render:** `npx remotion render FireDrillExplainer out/explainer.mp4 --codec=h264 --crf=16 --x264-preset=slow --audio-bitrate=192k`,
  then loudness-normalised to -16 LUFS (YouTube's range) with `ffmpeg -af loudnorm=I=-16:TP=-1.5:LRA=11`.

The captured clips (`public/clips`) and narration (`public/audio`) are git-ignored; regenerate them with the tools above.

```bash
cd video/demo && npm i
python3 extract_trace.py
npx remotion studio                                   # preview and edit
```

The scripted-cast label is part of the video: the live run's commands were posted by one Mattermost user.
