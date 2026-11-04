"""Stand-in for gate.verify (Codex's lane) used ONLY by tests/test_courtroom_flow.py.

It implements the CLI contract of ARCHITECTURE §4.2 with a trivial rule so the
courtroom's logic can be tested before the real engine exists:
  app.py containing ROOT_CAUSE_FIXED passes everything; containing NAIVE passes
  the repro but fails any attack; anything else fails the repro.
It is never used by the running gate.
"""

import argparse
import json
import sys
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("--incident", required=True)
ap.add_argument("--fix-dir", required=True)
ap.add_argument("--attack-dir")
ap.add_argument("--json", action="store_true")
a = ap.parse_args()
code = (Path(a.fix_dir) / "app.py").read_text()
checks = [{"name": "repro_test", "kind": "repro", "against": "fix",
           "status": "pass" if ("NAIVE" in code or "ROOT_CAUSE_FIXED" in code) else "fail",
           "duration_ms": 1, "output_tail": ""}]
if a.attack_dir:
    for t in sorted(Path(a.attack_dir).glob("test_*.py")):
        checks.append({"name": t.stem, "kind": "attack", "against": "fix",
                       "status": "pass" if "ROOT_CAUSE_FIXED" in code else "fail",
                       "duration_ms": 1, "output_tail": "AssertionError: 2 charges for one key" if "NAIVE" in code else ""})
ok = all(c["status"] == "pass" for c in checks)
print(json.dumps({"checks": checks, "discarded_attacks": [], "result": "GREEN" if ok else "RED",
                  "runner": {"image": "test-stand-in", "network": "none"}}))
sys.exit(0 if ok else 1)
