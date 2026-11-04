"""Execute the deterministic incident gate in fresh local pytest subprocesses.

Library: verify(incident, fix_dir, attack_dir=None) -> Verdict dictionary.
CLI: python -m gate.verify --incident ID --fix-dir LAB [--attack-dir DIR] --json

Only submitted app/ code is copied. Repros and invariants come from the gate's
trusted lab, never the submitted checkout. Reference patches are applied to the
trusted baseline, never to the submitted fix. Local processes inherit networking;
this runner is for trusted demo code and is not an untrusted-code sandbox.
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

ROOT = Path(__file__).resolve().parent.parent
LAB = ROOT / "incident-lab"
INCIDENTS = ("idempotency-race", "ratelimit-boundary", "pagination-cursor")
EXIT_CODES = {"GREEN": 0, "RED": 1, "ERROR": 2}
EventSink = Callable[[str, dict[str, Any]], None]


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


_WIN_HOME = re.compile(r"[A-Za-z]:[\\/]+Users[\\/]+[^\\/\s\"']+", re.IGNORECASE)
_POSIX_HOME = re.compile(r"(?:/private)?/(?:Users|home)/[^/\s\"']+")
_POSIX_TMP = re.compile(r"(?:/private)?/(?:var/folders/[^/\s]+/[^/\s]+/T|tmp)(?=/|\b)")
_WIN_TMP = re.compile(r"[A-Za-z]:[\\/]+(?:Windows[\\/]+Temp|Users[\\/]+[^\\/\s]+[\\/]+AppData[\\/]+Local[\\/]+Temp)", re.IGNORECASE)


def _scrub(text: str, *workspaces: Path) -> str:
    """Replace host-specific absolute paths so verdicts carry nothing about the machine that ran them.

    Known roots first, longest first (the check workspace, the interpreter, the repo, the temp dir, the
    home dir), then generic patterns for any other user, temp or home path that a traceback or warning
    names (including Windows `C:\\Users\\<name>`).
    """
    roots: list[tuple[str, str]] = [(str(w), "<workspace>") for w in workspaces]
    roots += [(str(ROOT), "<repo>"), (sys.prefix, "<python>"), (sys.base_prefix, "<python>"),
              (tempfile.gettempdir(), "<tmp>"), (str(Path.home()), "<home>")]
    for root, label in sorted(roots, key=lambda r: -len(r[0])):
        if len(root) > 3:
            for variant in {root, root.replace("\\", "/"), os.path.realpath(root)}:
                text = text.replace(variant, label)
    text = _WIN_TMP.sub("<tmp>", text)
    text = _WIN_HOME.sub("<home>", text)
    text = _POSIX_TMP.sub("<tmp>", text)
    return _POSIX_HOME.sub("<home>", text)


def _copy(source: Path, destination: Path) -> None:
    if any(p.is_symlink() for p in [source, *source.rglob("*")]):
        raise ValueError(f"symlinks are not supported in verification inputs: {source}")
    shutil.copytree(source, destination, ignore=shutil.ignore_patterns(
        "__pycache__", "*.pyc", ".pytest_cache", ".git", ".venv", "*.sqlite*", "*.db*"
    ))


def _run(command: list[str], cwd: Path, timeout_s: float) -> tuple[int, str, int]:
    env = {**os.environ, "PYTHONPATH": str(cwd), "PYTEST_DISABLE_PLUGIN_AUTOLOAD": "1",
           "PYTHONIOENCODING": "utf-8", "FIREDRILL_DB": str(cwd / "lab.sqlite")}
    env.pop("PYTEST_ADDOPTS", None)
    env.pop("PYTEST_PLUGINS", None)
    started = time.monotonic()
    options: dict[str, Any] = {}
    if os.name == "nt":
        options["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        options["start_new_session"] = True
    proc = subprocess.Popen(command, cwd=cwd, env=env, stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT, text=True, encoding="utf-8",
                            errors="replace", **options)
    try:
        output, _ = proc.communicate(timeout=timeout_s)
        code = proc.returncode
    except subprocess.TimeoutExpired:
        if os.name == "nt":
            subprocess.run(["taskkill", "/PID", str(proc.pid), "/T", "/F"],
                           capture_output=True, timeout=10)
        else:
            os.killpg(proc.pid, signal.SIGKILL)
        proc.kill()
        output, _ = proc.communicate()
        output += f"\nverification subprocess timed out after {timeout_s}s"
        code = 124
    return code, _scrub(output, cwd), round((time.monotonic() - started) * 1000)


def _pytest(tree: Path, node: str, timeout_s: float, *, collect: bool = False) -> tuple[int, str, int]:
    # One fresh app + database for every check, including reference validation.
    with tempfile.TemporaryDirectory(prefix="firedrill-check-") as tmp:
        work = Path(tmp)
        for directory in ("app", "checks", "attacks"):
            if (tree / directory).exists():
                _copy(tree / directory, work / directory)
        (work / "pytest.ini").write_text(
            "[pytest]\npythonpath = .\naddopts = --import-mode=importlib\n", encoding="utf-8")
        command = [sys.executable, "-m", "pytest", "-c", "pytest.ini", "--rootdir=.",
                   "-p", "no:cacheprovider", "-q", "--tb=short"]
        if collect:
            command += ["--collect-only"]
        else:
            command += ["--junitxml=report.xml"]
        code, output, elapsed = _run([*command, node], work, timeout_s)
        if not collect and code == 0:
            report = work / "report.xml"
            try:
                cases = ET.parse(report).findall(".//testcase")
                if not cases or any(case.find("skipped") is not None for case in cases):
                    return 3, output + "\ncheck did not execute all tests (skip/xfail is not a pass)", elapsed
            except (OSError, ET.ParseError) as exc:
                return 3, output + f"\nmissing or invalid pytest execution report: {exc}", elapsed
        return code, output, elapsed


def verify(incident: str, fix_dir: str | Path, attack_dir: str | Path | None = None,
           *, timeout_s: float = 30, event_sink: EventSink | None = None) -> dict[str, Any]:
    """Return a §4.2 verdict. R3 filtering is per collected pytest test node.

    event_sink receives actual verdict_started/check/verdict actions, suitable
    for recording scripted local verification without fabricating room events.
    """
    verdict: dict[str, Any] = {
        "incident": incident, "checks": [], "discarded_attacks": [], "result": "ERROR",
        "runner": {"image": f"local-python:{platform.python_version()}",
                   "network": "inherited", "isolation": "fresh-workspace-and-process",
                   "command": "python -m pytest"},
        "started_at": now(), "finished_at": None,
    }

    def emit(kind: str, data: dict[str, Any]) -> None:
        if event_sink is not None:
            event_sink(kind, data)

    def check(tree: Path, node: str, kind: str, against: str) -> dict[str, Any]:
        code, output, elapsed = _pytest(tree, node, timeout_s)
        item = {"name": node, "kind": kind, "against": against,
                "status": "pass" if code == 0 else "fail" if code == 1 else "error",
                "duration_ms": elapsed, "output_tail": "\n".join(output.splitlines()[-40:])[-8000:]}
        verdict["checks"].append(item)
        emit("check", item)
        return item

    emit("verdict_started", {"incident": incident,
                             "started_at": verdict["started_at"]})
    try:
        if incident not in INCIDENTS:
            raise ValueError(f"unknown incident: {incident}")
        if timeout_s <= 0:
            raise ValueError("timeout_s must be positive")
        source = Path(fix_dir).resolve()
        if not (source / "app").is_dir():
            raise ValueError(f"fix-dir must be a lab root containing app/: {source}")
        if attack_dir is not None and not Path(attack_dir).is_dir():
            raise ValueError(f"attack directory does not exist: {attack_dir}")
        with tempfile.TemporaryDirectory(prefix="firedrill-verdict-") as tmp:
            base = Path(tmp)
            candidate, reference = base / "fix", base / "reference"
            candidate.mkdir()
            reference.mkdir()
            _copy(source / "app", candidate / "app")
            _copy(LAB / "app", reference / "app")
            for tree in (candidate, reference):
                _copy(LAB / "incidents" / incident, tree / "checks")
                if attack_dir is not None:
                    _copy(Path(attack_dir).resolve(), tree / "attacks")
            patch = ROOT / "gate" / "reference" / f"{incident}.patch"
            code, output, _ = _run(["git", "init", "-q"], reference, timeout_s)
            if code != 0:
                raise RuntimeError(f"cannot initialize reference workspace: {output.strip()}")
            code, output, _ = _run(["git", "apply", str(patch)], reference, timeout_s)
            if code != 0:
                raise RuntimeError(f"cannot apply private reference patch: {output.strip()}")
            # A broken oracle must never bless or invalidate an attack.
            for node in ("checks/repro_test.py", "checks/invariant.py"):
                item = check(reference, node, "repro" if "repro" in node else "invariant", "reference")
                if item["status"] != "pass":
                    raise RuntimeError("reference fix failed its trusted checks")

            accepted: list[str] = []
            if attack_dir is not None:
                code, output, _ = _pytest(reference, "attacks", timeout_s, collect=True)
                if code != 0:
                    raise RuntimeError(f"attack collection failed (exit {code}): {output[-4000:]}")
                nodes = [line.strip() for line in output.splitlines()
                         if line.strip().startswith("attacks/") and "::" in line]
                if not nodes:
                    raise ValueError("attack directory collected no tests")
                for node in nodes:
                    item = check(reference, node, "attack", "reference")
                    if item["status"] == "pass":
                        accepted.append(node)
                    elif item["status"] == "fail":
                        verdict["discarded_attacks"].append({
                            "name": node, "reason": "fails against reference fix"})
                    else:
                        raise RuntimeError(f"reference attack execution error: {node}")
                if not accepted:
                    raise ValueError("no valid attacks remain after reference validation")

            for node, kind in [("checks/repro_test.py", "repro"),
                               *[(node, "attack") for node in accepted],
                               ("checks/invariant.py", "invariant")]:
                check(candidate, node, kind, "fix")
            statuses = [item["status"] for item in verdict["checks"] if item["against"] == "fix"]
            verdict["result"] = "ERROR" if "error" in statuses else "RED" if "fail" in statuses else "GREEN"
    except (OSError, ValueError, RuntimeError, subprocess.SubprocessError) as exc:
        verdict["result"] = "ERROR"
        verdict.setdefault("notes", []).append(_scrub(str(exc)))
    verdict["finished_at"] = now()
    emit("verdict", verdict)
    return verdict


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--incident", required=True)
    parser.add_argument("--fix-dir", required=True, type=Path)
    parser.add_argument("--attack-dir", type=Path)
    parser.add_argument("--json", action="store_true", help="emit Verdict JSON (also the default)")
    args = parser.parse_args(argv)
    verdict = verify(args.incident, args.fix_dir, args.attack_dir)
    print(json.dumps(verdict, ensure_ascii=True))
    return EXIT_CODES[verdict["result"]]


if __name__ == "__main__":
    raise SystemExit(main())
