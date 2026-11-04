"""Every telemetry frame kind comes out of a real courtroom drill (fast, test-verifier version).

The dashboard's replay recordings come from tests/test_courtroom_recordings.py, which uses the real
gate.verify. This one keeps `tests/fake_verify.py` so the frame-kind and diff-stat contract is checked in
seconds.
"""

from __future__ import annotations

import asyncio
import sys

from test_courtroom_flow import ALICE, BREAKER, FIXER, INC, ROOM, RecordingSwitch, msg, push

from conftest import ROOT
from gate import telemetry
from gate.config import Config
from gate.courtroom import Courtroom
from gate.identity import IdentityBook
from gate.merger import Merger

ALL_KINDS = set(telemetry.KINDS)


async def drill(evidence, tmp_path) -> None:
    cfg = Config(
        switch_url="http://unused", agent_id="gate-id", api_key="k", agent_name="firedrill-gate",
        gate_key=evidence["key"], evidence_remote=str(evidence["remote"]), state_dir=tmp_path / "state",
        fixer_name="firedrill-fixer", breaker_name="firedrill-breaker", approvers=("alice",),
        verify_cmd=(sys.executable, str(ROOT / "tests" / "fake_verify.py")),
    )
    merger = Merger(cfg.evidence_remote, cfg.state_dir / "work", cfg.gate_key)
    court = Courtroom(cfg, RecordingSwitch(), merger, IdentityBook(cfg.state_dir / "pins.json", "firedrill-fixer", "firedrill-breaker", cfg.approvers))
    work = evidence["work"]
    await court.handle(msg(FIXER, "starting on the idempotency race", addressed=False))
    naive = push(work, f"fix/{INC}", {"app.py": "NAIVE lock\n"})
    await court.handle(msg(FIXER, f"@firedrill-gate SUBMIT fix/{INC} {naive[:10]}"))
    await court.handle(msg(ALICE, f"@firedrill-gate APPROVE V-{INC}-001"))  # refused: no attack yet
    atk = push(work, f"attack/{INC}", {f"attacks/{INC}/test_two_processes.py": "def test_x(): ...\n"})
    await court.handle(msg(BREAKER, f"@firedrill-gate ATTACK attack/{INC} {atk[:10]}"))
    good = push(work, f"fix/{INC}", {"app.py": "ROOT_CAUSE_FIXED unique constraint\n"})
    await court.handle(msg(FIXER, f"@firedrill-gate SUBMIT fix/{INC} {good[:10]}"))
    await court.handle(msg(ALICE, f"@firedrill-gate APPROVE V-{INC}-003"))


def test_drill_emits_every_frame_kind(evidence, tmp_path, telemetry_state):
    asyncio.run(drill(evidence, tmp_path))
    log = telemetry_state / f"{ROOM}.jsonl"
    frames = telemetry.read_frames(log)
    kinds = [f["kind"] for f in frames]
    assert ALL_KINDS <= set(kinds), f"missing kinds: {ALL_KINDS - set(kinds)}"

    verdicts = [f["data"] for f in frames if f["kind"] == "verdict"]
    assert [v["result"] for v in verdicts] == ["GREEN", "RED", "GREEN"]
    assert kinds[-3:] == ["signoff", "merge", "room_message"]  # gate's MERGED post is mirrored last
    sub = next(f for f in frames if f["kind"] == "submission")
    assert sub["data"]["diff_stat"]["files"] == 1 and sub["data"]["diff_stat"]["names"] == ["app.py"]
    opened = next(f for f in frames if f["kind"] == "gate_state")
    assert opened["data"]["approvers"] == ["alice"] and "Double charges" in opened["data"]["brief"]
