"""Render narration lines to WAV with Kokoro-82M (Apache-2.0, runs locally, no account).

usage: speak.py script.json outdir [voice]
script.json: [{"id": "s01", "text": "..."}, ...]
Writes outdir/<id>.wav (24 kHz mono) and outdir/durations.json (seconds).
"""
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

here = Path(__file__).parent
script = json.loads(Path(sys.argv[1]).read_text())
out = Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
voice = sys.argv[3] if len(sys.argv) > 3 else "af_heart"
k = Kokoro(str(here / "kokoro-v1.0.int8.onnx"), str(here / "voices-v1.0.bin"))
durations = {}
for item in script:
    samples, sr = k.create(item["text"], voice=voice, speed=item.get("speed", 0.98), lang="en-us")
    # a little breath at the end of each line so cuts don't feel clipped
    samples = np.concatenate([samples, np.zeros(int(sr * 0.35), dtype=samples.dtype)])
    sf.write(out / f"{item['id']}.wav", samples, sr)
    durations[item["id"]] = round(len(samples) / sr, 3)
    print(item["id"], durations[item["id"]], flush=True)
(out / "durations.json").write_text(json.dumps(durations, indent=2))
