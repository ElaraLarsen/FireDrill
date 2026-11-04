"""Full courtroom drills with the real verifier, recorded for the dashboard's Judge Replay Mode.

For each incident this drives the real `gate/courtroom.py`, the real `gate/verify.py` (local pytest
subprocesses) and a real guarded git merge through the evidence remote's `update` hook, with the
scripted patches in `demo/scripted/<incident>/`:

  docket_open + brief
  fixer   SUBMIT naive patch      -> GREEN on the repro only
  creator APPROVE (too early)     -> refused: no attack has faced it
  breaker ATTACK                  -> Rule R3 discards the over-broad test, naive patch goes RED
  fixer   SUBMIT real fix         -> GREEN: survives the valid attacks and the invariant
  guest   APPROVE                 -> refused: not an approver
  creator APPROVE                 -> signoff, then merge to main (gate key checked by the hook)

What is not real, and is labelled so in the recording's meta file: the Switch room is a recording
stand-in and the three participants are scripted, so no live Claude, Codex or Switch took part.

Re-record:  FIREDRILL_RECORD_FIXTURES=1 python -m pytest tests/test_courtroom_recordings.py
"""

from __future__ import annotations

import asyncio
import json
import os
import shutil
import sys
from pathlib import Path
from typing import Any

import pytest
from conftest import GIT_ID, ROOT, build_evidence, git

from gate import telemetry
from gate.config import KNOWN_INCIDENTS, Config
from gate.courtroom import VERDICTS_DOC, Courtroom
from gate.identity import IdentityBook
from gate.merger import Merger

FIXTURES = ROOT / "dashboard" / "fixtures"
SCRIPTED = ROOT / "demo" / "scripted"
KINDS = set(telemetry.KINDS)
FIXER = {"sender": "@switch-agent-fixer:local", "sender_name": "firedrill-fixer"}
BREAKER = {"sender": "@switch-agent-breaker:local", "sender_name": "firedrill-breaker"}
CREATOR = {"sender": "@switch-user-creator:local", "sender_name": "creator"}
GUEST = {"sender": "@switch-user-guest:local", "sender_name": "guest"}
HOST_MARKERS = ("/Users/", "/home/", "/private/", "/var/folders", "/tmp/", "C:\\\\", "AppData", ".venv")

PROVENANCE = (
    "Full courtroom drill. Real: gate/courtroom.py, gate/verify.py (local pytest subprocesses, network "
    "inherited, not a sandbox), and a git merge through the evidence remote's update hook, which checks the "
    "gate key. Scripted: the Switch room is a recording stand-in, and firedrill-fixer, firedrill-breaker and "
    "creator are scripted participants posting demo/scripted/<incident>/ patches and tests; no live Claude, "
    "Codex or Switch took part. Participant ids are test ids."
)


class RoomSwitch:
    """Records what the courtroom asks Switch to do (stand-in for the Switch connection)."""

    def __init__(self, room_name: str) -> None:
        self.room_name = room_name
        self.posts: list[str] = []
        self.docs: dict[str, dict[str, str]] = {}
        self.current: str | None = None
        self._lock = asyncio.Lock()

    def room(self) -> asyncio.Lock:
        return self._lock

    async def use_room(self, room_id: str) -> dict[str, Any] | None:
        if self.current == room_id:
            return None
        self.current = room_id
        return {"name": self.room_name, "participants": [], "documents": []}

    async def op(self, op_name: str, /, **args: Any) -> Any:
        if op_name == "post_message":
            self.posts.append(args["body"])
            return {"event_id": str(len(self.posts))}
        if op_name == "connect_to_room":
            return {"name": self.room_name, "participants": [], "documents": []}
        if op_name == "create_room_document":
            doc_id = f"doc-{len(self.docs) + 1}"
            self.docs[doc_id] = {"name": args["name"], "content": args["content"]}
            return {"document_id": doc_id}
        if op_name == "update_room_document":
            self.docs[args["document_id"]]["content"] = args["content"]
            return {"document_id": args["document_id"], "status": "ok"}
        raise AssertionError(f"unexpected op {op_name}")


def lab_repo(tmp_path: Path) -> Path:
    """incident-lab/ as the evidence repo's root: this is what the fixer and breaker clone."""
    lab = tmp_path / "lab"
    shutil.copytree(
        ROOT / "incident-lab", lab,
        ignore=shutil.ignore_patterns("__pycache__", "*.pyc", "*.sqlite*", "*.db*", ".pytest_cache", ".git", ".venv"),
    )
    git("init", "-q", "-b", "main", cwd=lab)
    git("add", ".", cwd=lab)
    git("commit", "-q", "-m", "Incident baseline", cwd=lab)
    return lab


def push(work: Path, branch: str, *, patch: Path | None = None, attack: tuple[str, Path] | None = None) -> str:
    git("fetch", "-q", "origin", cwd=work)
    git("checkout", "-q", "-B", branch, "origin/main", cwd=work)
    if patch is not None:
        git("apply", "--index", str(patch), cwd=work)
    if attack is not None:
        incident, src = attack
        shutil.copytree(src, work / "attacks" / incident, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
    git("add", "-A", cwd=work)
    git("commit", "-q", "-m", f"[scripted] {branch}", cwd=work)
    git("push", "-q", "-f", "origin", f"HEAD:refs/heads/{branch}", cwd=work)
    return git("rev-parse", "HEAD", cwd=work).stdout.strip()


def say(room: str, who: dict[str, str], body: str) -> dict[str, Any]:
    return {"event": "message", "id": 1, "data": {"room_id": room, "payload": {**who, "body": body, "addressed": True, "message_id": "m"}}}


@pytest.mark.parametrize("incident", KNOWN_INCIDENTS)
async def test_full_courtroom_drill_with_real_verifier(incident, tmp_path, monkeypatch, telemetry_state):
    for k, v in GIT_ID.items():
        monkeypatch.setenv(k, v)
    ev = build_evidence(tmp_path, lab_repo(tmp_path))
    work: Path = ev["work"]  # type: ignore[assignment]
    room = f"firedrill-{incident}"
    cfg = Config(
        switch_url="http://unused", agent_id="gate-id", api_key="k", agent_name="firedrill-gate",
        gate_key=str(ev["key"]), evidence_remote=str(ev["remote"]), state_dir=tmp_path / "state",
        fixer_name="firedrill-fixer", breaker_name="firedrill-breaker", approvers=("creator",),
        verify_cmd=(sys.executable, "-m", "gate.verify"), verify_timeout_s=600,
    )
    switch = RoomSwitch(room)
    merger = Merger(cfg.evidence_remote, cfg.state_dir / "work", cfg.gate_key)
    court = Courtroom(cfg, switch, merger, IdentityBook(cfg.state_dir / "pins.json", "firedrill-fixer", "firedrill-breaker", cfg.approvers))
    last = lambda: switch.posts[-1]  # noqa: E731
    vid = lambda n: f"V-{incident}-{n:03d}"  # noqa: E731
    script = SCRIPTED / incident

    # b) naive patch: passes the repro, so GREEN, but only on the repro
    naive = push(work, f"fix/{incident}", patch=script / "naive.patch")
    await court.handle(say(room, FIXER, f"@firedrill-gate SUBMIT fix/{incident} {naive[:10]}"))
    assert f"{vid(1)}: GREEN" in last()
    assert "No attack, no sign-off" in last()
    assert any("Docket open" in p for p in switch.posts)

    # d) early APPROVE is refused
    await court.handle(say(room, CREATOR, f"@firedrill-gate APPROVE {vid(1)}"))
    assert "no attack, no sign-off" in last()

    # c) hostile attack: R3 discards the over-broad test, the naive patch goes RED
    atk = push(work, f"attack/{incident}", attack=(incident, script / "attack"))
    await court.handle(say(room, BREAKER, f"@firedrill-gate ATTACK attack/{incident} {atk[:10]}"))
    assert f"{vid(2)}: RED" in last() and "discarded attack" in last()

    # e) the real fix survives the repro, the valid attacks and the invariant
    good = push(work, f"fix/{incident}", patch=script / "fix.patch")
    await court.handle(say(room, FIXER, f"@firedrill-gate SUBMIT fix/{incident} {good[:10]}"))
    assert f"{vid(3)}: GREEN" in last() and f"APPROVE {vid(3)}" in last()

    # d) a non-approver cannot sign off
    await court.handle(say(room, GUEST, f"@firedrill-gate APPROVE {vid(3)}"))
    assert "not an approver" in last()

    # f) the authenticated approver signs off and the gate merges through the guarded hook
    await court.handle(say(room, CREATOR, f"@firedrill-gate APPROVE {vid(3)}"))
    assert last().startswith(f"MERGED. `{vid(3)}` signed off by creator")
    main = git("rev-parse", "main", cwd=ev["remote"]).stdout.strip()  # type: ignore[arg-type]
    assert git("merge-base", "--is-ancestor", good, main, cwd=ev["remote"], check=False).returncode == 0  # type: ignore[arg-type]
    assert git("merge-base", "--is-ancestor", naive, main, cwd=ev["remote"], check=False).returncode != 0  # type: ignore[arg-type]
    log = next(d["content"] for d in switch.docs.values() if d["name"] == VERDICTS_DOC)
    for needle in (f"{vid(1)}: GREEN", f"{vid(2)}: RED", f"{vid(3)}: GREEN", "SIGNED OFF by creator", "MERGED to main"):
        assert needle in log

    # What the dashboard will replay
    path = telemetry_state / f"{room}.jsonl"
    text = path.read_text()
    frames = telemetry.read_frames(path)
    assert len(frames) == len(text.splitlines())
    assert KINDS <= {f["kind"] for f in frames}, KINDS - {f["kind"] for f in frames}
    verdicts = [f["data"] for f in frames if f["kind"] == "verdict"]
    assert [v["result"] for v in verdicts] == ["GREEN", "RED", "GREEN"]
    assert verdicts[1]["discarded_attacks"] and verdicts[2]["discarded_attacks"]
    assert not verdicts[0]["checks"] or all(c["kind"] != "attack" for c in verdicts[0]["checks"])
    assert sum(f["kind"] == "rejected" for f in frames) >= 2
    assert [f["kind"] for f in frames if f["kind"] in ("signoff", "merge")] == ["signoff", "merge"]
    assert verdicts[2]["runner"]["isolation"] == "fresh-workspace-and-process"
    leaks = [m for m in (*HOST_MARKERS, str(ROOT), str(tmp_path)) if m in text]
    assert not leaks, f"host paths in the recording: {leaks}"

    if os.environ.get("FIREDRILL_RECORD_FIXTURES") == "1":
        FIXTURES.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, FIXTURES / f"{incident}.jsonl")
        (FIXTURES / f"{incident}.meta.json").write_text(json.dumps({
            "title": f"Full courtroom drill, real verifier: {incident}",
            "incident": incident,
            "scripted": True,
            "verifier": "gate.verify",
            "provenance": PROVENANCE.replace("<incident>", incident),
        }, indent=2) + "\n")


@pytest.mark.parametrize("incident", KNOWN_INCIDENTS)
def test_committed_recording_is_a_full_courtroom_run(incident):
    jsonl, meta_path = FIXTURES / f"{incident}.jsonl", FIXTURES / f"{incident}.meta.json"
    assert jsonl.exists(), f"record it: FIREDRILL_RECORD_FIXTURES=1 python -m pytest tests/test_courtroom_recordings.py -k {incident}"
    text = jsonl.read_text()
    frames = telemetry.read_frames(jsonl)
    assert len(frames) == len(text.splitlines()), "every line must be a valid frame"
    assert KINDS <= {f["kind"] for f in frames}
    assert [f["data"]["result"] for f in frames if f["kind"] == "verdict"] == ["GREEN", "RED", "GREEN"]
    assert [f["kind"] for f in frames if f["kind"] in ("signoff", "merge")] == ["signoff", "merge"]
    assert any(f["kind"] == "gate_state" and f["data"].get("brief") for f in frames)
    assert {f["room_id"] for f in frames} == {f"firedrill-{incident}"}
    leaks = [m for m in (*HOST_MARKERS, "Kaustubh", "firedrill-check-") if m in text]
    assert not leaks, f"host paths in the committed recording: {leaks}"
    meta = json.loads(meta_path.read_text())
    assert meta["incident"] == incident and meta["verifier"] == "gate.verify" and meta["scripted"] is True
    assert "scripted" in meta["provenance"].lower() and "stand-in" in meta["provenance"]


def test_no_fixture_carries_host_paths():
    for p in FIXTURES.glob("*"):
        text = p.read_text()
        leaks = [m for m in (*HOST_MARKERS, "Kaustubh", "C:\\\\Users") if m in text]
        assert not leaks, f"{p.name}: {leaks}"
