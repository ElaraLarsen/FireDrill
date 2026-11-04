"""Real subprocess matrix and opt-in recordings for the scripted incident demo.

Regenerate fixtures with FIREDRILL_RECORD_FIXTURES=1 python -m pytest
tests/test_verify_matrix.py. Recordings contain local gate actions only; they do
not claim a Switch room, agent conversation, approval, or merge occurred.
"""

from __future__ import annotations

import copy
import json
import os
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pytest

from gate.verify import EXIT_CODES, INCIDENTS, verify

ROOT = Path(__file__).resolve().parent.parent
LAB = ROOT / "incident-lab"
STATES = (
    ("buggy", None, False, "RED"),
    ("naive", "naive.patch", False, "GREEN"),
    ("naive-attacked", "naive.patch", True, "RED"),
    ("reference-attacked", "reference", True, "GREEN"),
)


def git(cwd: Path, *args: str) -> str:
    process = subprocess.run(
        ["git", "-c", "core.autocrlf=false", "-c", "commit.gpgsign=false",
         "-c", "user.name=FireDrill test", "-c", "user.email=test@example.invalid", *args],
        cwd=cwd, text=True, encoding="utf-8", capture_output=True, timeout=30,
    )
    assert process.returncode == 0, process.stdout + process.stderr
    return process.stdout.strip()


def checkout(tmp_path: Path, incident: str, patch_name: str | None) -> Path:
    destination = tmp_path / "lab"
    shutil.copytree(LAB, destination, ignore=shutil.ignore_patterns(
        "__pycache__", "*.pyc", "*.sqlite*", "*.db*", ".pytest_cache", ".git"))
    git(destination, "init", "-q", "-b", "main")
    git(destination, "add", ".")
    git(destination, "commit", "-q", "-m", "Incident baseline")
    if patch_name is not None:
        patch = (ROOT / "gate" / "reference" / f"{incident}.patch"
                 if patch_name == "reference"
                 else ROOT / "demo" / "scripted" / incident / patch_name)
        # replay_demo.py applies each patch independently from origin/main.
        git(destination, "apply", "--index", str(patch))
        git(destination, "commit", "-q", "-m", f"[scripted] {incident}: {patch_name}")
    return destination


def assert_verdict_schema(verdict: dict[str, Any], incident: str) -> None:
    assert verdict["incident"] == incident
    assert verdict["result"] in EXIT_CODES
    assert isinstance(verdict["checks"], list)
    assert isinstance(verdict["discarded_attacks"], list)
    for check in verdict["checks"]:
        assert isinstance(check["name"], str) and check["name"]
        assert check["kind"] in {"repro", "attack", "invariant"}
        assert check["against"] in {"fix", "reference"}
        assert check["status"] in {"pass", "fail", "error"}
        assert isinstance(check["duration_ms"], int) and check["duration_ms"] >= 0
        assert isinstance(check["output_tail"], str)
        assert len(check["output_tail"].splitlines()) <= 40
    for discarded in verdict["discarded_attacks"]:
        assert isinstance(discarded["name"], str) and discarded["name"]
        assert isinstance(discarded["reason"], str) and discarded["reason"]
    assert verdict["runner"]["image"].startswith("local-python:")
    assert verdict["runner"]["network"] == "inherited"
    assert verdict["runner"]["isolation"] == "fresh-workspace-and-process"
    started = datetime.fromisoformat(verdict["started_at"])
    finished = datetime.fromisoformat(verdict["finished_at"])
    assert started.tzinfo is not None and finished.tzinfo is not None
    assert finished >= started


@pytest.fixture(scope="session")
def recordings() -> Any:
    recorded: dict[str, dict[str, list[dict[str, Any]]]] = {}
    yield recorded
    if os.environ.get("FIREDRILL_RECORD_FIXTURES") != "1":
        return
    # Not dashboard/fixtures: the dashboard replays the full courtroom recordings (tests/test_courtroom_recordings.py).
    fixtures = Path(os.environ.get("FIREDRILL_RECORD_DIR") or ROOT / "gate" / "state" / "verify-recordings")
    fixtures.mkdir(parents=True, exist_ok=True)
    for incident, runs in recorded.items():
        if set(runs) != {state[0] for state in STATES}:
            continue  # Never publish an incomplete or failed matrix.
        frames = [frame for state, *_ in STATES for frame in runs[state]]
        path = fixtures / f"recorded-{incident}.jsonl"
        path.write_text("".join(json.dumps(frame, ensure_ascii=True) + "\n" for frame in frames), encoding="utf-8")
        path.with_suffix(".meta.json").write_text(json.dumps({
            "title": "Scripted local matrix: " + incident,
            "incident": incident, "scripted": True,
            "provenance": "Real Python 3.12 local subprocess verification: baseline RED, naive GREEN, "
                          "attacked naive RED, attacked reference GREEN. Gate actions only; no Switch "
                          "room, human signoff or merge was recorded.",
        }, indent=2) + "\n", encoding="utf-8")


@pytest.mark.parametrize("incident", INCIDENTS)
@pytest.mark.parametrize("state,patch_name,attacked,expected", STATES, ids=[state[0] for state in STATES])
def test_verify_matrix(tmp_path: Path, recordings: dict[str, Any], incident: str,
                       state: str, patch_name: str | None, attacked: bool, expected: str) -> None:
    fix = checkout(tmp_path, incident, patch_name)
    sha = git(fix, "rev-parse", "HEAD")
    attack = ROOT / "demo" / "scripted" / incident / "attack" if attacked else None
    frames: list[dict[str, Any]] = []
    index = next(i for i, entry in enumerate(STATES, start=1) if entry[0] == state)
    verdict_id = f"V-{incident}-{index:03d}"

    def record(kind: str, data: dict[str, Any]) -> None:
        frames.append({
            "ts": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
            "kind": kind, "room_id": f"local-scripted-{incident}", "seq": None,
            "actor": {"id": "local:gate-verify", "name": "firedrill-gate", "role": "gate"},
            "data": {**copy.deepcopy(data), "verdict_id": verdict_id,
                     "scripted": True, "source": "local pytest verification matrix",
                     "state": state, "candidate_sha": sha},
        })

    verdict = verify(incident, fix, attack, event_sink=record)
    assert_verdict_schema(verdict, incident)
    assert verdict["result"] == expected, json.dumps(verdict, indent=2)
    candidate = [check for check in verdict["checks"] if check["against"] == "fix"]
    assert {"repro", "invariant"} <= {check["kind"] for check in candidate}
    if not attacked:
        assert verdict["discarded_attacks"] == []
        assert not any(check["kind"] == "attack" for check in verdict["checks"])
    else:
        discarded = verdict["discarded_attacks"]
        assert len(discarded) == 1, discarded
        assert "test_overbroad" in discarded[0]["name"]
        assert discarded[0]["reason"] == "fails against reference fix"
        assert any(check["against"] == "reference" and check["kind"] == "attack"
                   and check["status"] == "fail" and check["name"] == discarded[0]["name"]
                   for check in verdict["checks"])
        attacks = [check for check in candidate if check["kind"] == "attack"]
        assert attacks and all(check["name"] != discarded[0]["name"] for check in attacks)
        if state == "naive-attacked":
            assert any(check["status"] == "fail" for check in attacks)
        else:
            assert all(check["status"] == "pass" for check in attacks)
    if expected == "GREEN":
        assert all(check["status"] == "pass" for check in candidate)
    assert frames[0]["kind"] == "verdict_started"
    assert frames[-1]["kind"] == "verdict"
    assert [frame["data"]["status"] for frame in frames if frame["kind"] == "check"] == [
        check["status"] for check in verdict["checks"]]
    recordings.setdefault(incident, {})[state] = frames


@pytest.mark.parametrize("incident", INCIDENTS)
def test_scripted_correct_fix_survives_attack(tmp_path: Path, incident: str) -> None:
    fix = checkout(tmp_path, incident, "fix.patch")
    verdict = verify(incident, fix, ROOT / "demo" / "scripted" / incident / "attack")
    assert_verdict_schema(verdict, incident)
    assert verdict["result"] == "GREEN", json.dumps(verdict, indent=2)
    assert len(verdict["discarded_attacks"]) == 1


@pytest.mark.parametrize("patch_name,incident,expected", [
    (None, "ratelimit-boundary", "RED"),
    ("naive.patch", "ratelimit-boundary", "GREEN"),
    (None, "unknown-incident", "ERROR"),
])
def test_cli_json_and_exit_codes(tmp_path: Path, patch_name: str | None, incident: str, expected: str) -> None:
    fix = checkout(tmp_path, "ratelimit-boundary", patch_name)
    result = subprocess.run(
        [sys.executable, "-m", "gate.verify", "--incident", incident,
         "--fix-dir", str(fix), "--json"], cwd=ROOT,
        capture_output=True, text=True, encoding="utf-8", timeout=120,
    )
    assert result.returncode == EXIT_CODES[expected], result.stdout + result.stderr
    verdict = json.loads(result.stdout)
    assert_verdict_schema(verdict, incident)
    assert verdict["result"] == expected


def test_submission_cannot_replace_trusted_repro(tmp_path: Path) -> None:
    incident = "ratelimit-boundary"
    fix = checkout(tmp_path, incident, None)
    (fix / "incidents" / incident / "repro_test.py").write_text("def test_fake(): pass\n", encoding="utf-8")
    (fix / "incidents" / incident / "invariant.py").write_text("def test_fake(): pass\n", encoding="utf-8")
    (fix / "conftest.py").write_text("raise RuntimeError('candidate test configuration executed')\n", encoding="utf-8")
    verdict = verify(incident, fix)
    assert verdict["result"] == "RED", json.dumps(verdict, indent=2)
    assert any(check["against"] == "fix" and check["kind"] == "repro"
               and check["status"] == "fail" for check in verdict["checks"])


@pytest.mark.parametrize("case", ["missing-fix", "missing-attack", "empty-attack", "invalid-attack", "skipped-attack", "all-discarded"])
def test_invalid_inputs_fail_closed(tmp_path: Path, case: str) -> None:
    incident = "ratelimit-boundary"
    fix = checkout(tmp_path, incident, "naive.patch")
    attack: Path | None = None
    if case == "missing-fix":
        fix = tmp_path / "missing-fix"
    else:
        attack = tmp_path / "attack"
        if case != "missing-attack":
            attack.mkdir()
        if case == "invalid-attack":
            (attack / "test_attack.py").write_text("this is invalid python !\n", encoding="utf-8")
        elif case == "skipped-attack":
            (attack / "test_attack.py").write_text(
                "import pytest\n\n@pytest.mark.skip(reason='not an executed attack')\ndef test_skipped():\n    assert False\n",
                encoding="utf-8",
            )
        elif case == "all-discarded":
            (attack / "test_attack.py").write_text("def test_impossible():\n    assert False\n", encoding="utf-8")
    verdict = verify(incident, fix, attack)
    assert_verdict_schema(verdict, incident)
    assert verdict["result"] == "ERROR", json.dumps(verdict, indent=2)
    assert verdict.get("notes")
    if case == "all-discarded":
        assert len(verdict["discarded_attacks"]) == 1


def test_subprocess_timeout_is_error(tmp_path: Path) -> None:
    fix = checkout(tmp_path, "ratelimit-boundary", "naive.patch")
    verdict = verify("ratelimit-boundary", fix, timeout_s=0.001)
    assert verdict["result"] == "ERROR", json.dumps(verdict, indent=2)
    assert verdict.get("notes")
