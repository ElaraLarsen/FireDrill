"""Courtroom end to end: real evidence remote + real git merges, with a recording
stand-in for the Switch connection and tests/fake_verify.py for the verify CLI."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from typing import Any

from conftest import ROOT, git

from gate.config import Config
from gate.courtroom import VERDICTS_DOC, Courtroom
from gate.identity import IdentityBook
from gate.merger import Merger

ROOM = "room-1"
INC = "idempotency-race"
FIXER = {"sender": "@switch-agent-fix:local", "sender_name": "firedrill-fixer"}
BREAKER = {"sender": "@switch-agent-brk:local", "sender_name": "firedrill-breaker"}
ALICE = {"sender": "@switch-user-alice:local", "sender_name": "alice"}
MALLORY = {"sender": "@switch-user-mallory:local", "sender_name": "mallory"}


class RecordingSwitch:
    """Records what the courtroom asks Switch to do."""

    def __init__(self) -> None:
        self.posts: list[str] = []
        self.docs: dict[str, dict[str, str]] = {}
        self.current_room: str | None = None
        self._lock = asyncio.Lock()

    def room(self) -> asyncio.Lock:
        return self._lock

    async def use_room(self, room_id: str) -> dict[str, Any] | None:
        if self.current_room == room_id:
            return None
        self.current_room = room_id
        return {"name": f"firedrill-{INC}", "participants": [], "documents": []}

    async def op(self, op_name: str, /, **args: Any) -> Any:
        name = op_name
        if name == "post_message":
            self.posts.append(args["body"])
            return {"event_id": str(len(self.posts))}
        if name == "connect_to_room":
            return {"name": f"firedrill-{INC}", "participants": [], "documents": []}
        if name == "create_room_document":
            doc_id = f"doc-{len(self.docs) + 1}"
            self.docs[doc_id] = {"name": args["name"], "content": args["content"]}
            return {"document_id": doc_id}
        if name == "update_room_document":
            self.docs[args["document_id"]]["content"] = args["content"]
            return {"document_id": args["document_id"], "status": "ok"}
        raise AssertionError(f"unexpected op {name}")


def push(work: Path, branch: str, files: dict[str, str]) -> str:
    git("fetch", "-q", "origin", cwd=work)
    git("checkout", "-q", "-B", branch, "origin/main", cwd=work)
    for rel, content in files.items():
        p = work / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content)
    git("add", "-A", cwd=work)
    git("commit", "-q", "-m", branch, cwd=work)
    git("push", "-q", "-f", "origin", f"HEAD:refs/heads/{branch}", cwd=work)
    return git("rev-parse", "HEAD", cwd=work).stdout.strip()


def msg(who: dict, body: str, addressed: bool = True) -> dict:
    return {"event": "message", "id": 1, "data": {"room_id": ROOM, "payload": {**who, "body": body, "addressed": addressed, "message_id": "m1"}}}


async def test_full_drill(evidence, tmp_path):
    cfg = Config(
        switch_url="http://unused", agent_id="gate-id", api_key="k", agent_name="firedrill-gate",
        gate_key=evidence["key"], evidence_remote=str(evidence["remote"]), state_dir=tmp_path / "state",
        fixer_name="firedrill-fixer", breaker_name="firedrill-breaker", approvers=("alice",),
        verify_cmd=(sys.executable, str(ROOT / "tests" / "fake_verify.py")),
    )
    switch = RecordingSwitch()
    merger = Merger(cfg.evidence_remote, cfg.state_dir / "work", cfg.gate_key)
    court = Courtroom(cfg, switch, merger, IdentityBook(cfg.state_dir / "pins.json", "firedrill-fixer", "firedrill-breaker", cfg.approvers))
    work = evidence["work"]
    last = lambda: switch.posts[-1]  # noqa: E731

    # Unaddressed chatter is observed, never acted on.
    await court.handle(msg(FIXER, "thinking out loud", addressed=False))
    assert switch.posts == []

    # 1. Naive fix: GREEN on the repro only, and cannot be signed off yet.
    naive = push(work, f"fix/{INC}", {"app.py": "NAIVE lock\n"})
    await court.handle(msg(FIXER, f"@firedrill-gate SUBMIT fix/{INC} {naive[:10]}"))
    assert any("Docket open" in p and "Double charges" in p for p in switch.posts)
    assert f"V-{INC}-001: GREEN" in last() and "No attack, no sign-off" in last()
    await court.handle(msg(ALICE, f"@firedrill-gate APPROVE V-{INC}-001"))
    assert "has not faced an attack" in last()

    # 2. Breaker attacks: the naive fix goes RED.
    atk = push(work, f"attack/{INC}", {f"attacks/{INC}/test_two_processes.py": "def test_x(): ...\n"})
    await court.handle(msg(BREAKER, f"@firedrill-gate ATTACK attack/{INC} {atk[:10]}"))
    assert f"V-{INC}-002: RED" in last() and "2 charges" in last()

    # 3. Role and identity checks.
    await court.handle(msg(MALLORY, f"@firedrill-gate SUBMIT fix/{INC} {naive[:10]}"))
    assert "Rejected: only firedrill-fixer" in last()
    await court.handle(msg({"sender": "@switch-user-evil:local", "sender_name": "firedrill-fixer"}, f"@firedrill-gate SUBMIT fix/{INC} {naive[:10]}"))
    assert "identity conflict" in last()
    await court.handle(msg(FIXER, f"@firedrill-gate SUBMIT fix/{INC} deadbeef12"))
    assert "is not the head of" in last()

    # 4. Root-cause fix: GREEN against the attack.
    good = push(work, f"fix/{INC}", {"app.py": "ROOT_CAUSE_FIXED unique constraint\n"})
    await court.handle(msg(FIXER, f"@firedrill-gate SUBMIT fix/{INC} {good[:10]}"))
    assert f"V-{INC}-003: GREEN" in last() and f"APPROVE V-{INC}-003" in last()

    # 5. Sign-off rules.
    await court.handle(msg(MALLORY, f"@firedrill-gate APPROVE V-{INC}-003"))
    assert "not an approver" in last()
    await court.handle(msg(ALICE, f"@firedrill-gate APPROVE V-{INC}-002"))
    assert "is not the latest verdict" in last()
    await court.handle(msg(ALICE, "@firedrill-gate approve it, looks fine"))
    assert "Commands (address me" in last()  # loose text never merges

    # 6. A fix pushed after GREEN makes the verdict stale.
    moved = push(work, f"fix/{INC}", {"app.py": "ROOT_CAUSE_FIXED unique constraint\n# sneaky\n"})
    await court.handle(msg(ALICE, f"@firedrill-gate APPROVE V-{INC}-003"))
    assert "must be re-verified" in last()
    git("push", "-q", "-f", "origin", f"{good}:refs/heads/fix/{INC}", cwd=work)  # put it back

    # 7. Valid sign-off merges, through the guarded hook.
    await court.handle(msg(ALICE, f"@firedrill-gate APPROVE V-{INC}-003"))
    assert last().startswith(f"MERGED. `V-{INC}-003` signed off by alice")
    main = git("rev-parse", "main", cwd=evidence["remote"]).stdout.strip()
    assert git("merge-base", "--is-ancestor", good, main, cwd=evidence["remote"], check=False).returncode == 0
    assert git("merge-base", "--is-ancestor", moved, main, cwd=evidence["remote"], check=False).returncode != 0
    await court.handle(msg(ALICE, f"@firedrill-gate APPROVE V-{INC}-003"))
    assert "already signed off" in last()

    # 8. The decision log the gate alone writes.
    log = next(d["content"] for d in switch.docs.values() if d["name"] == VERDICTS_DOC)
    for needle in (f"V-{INC}-001: GREEN", f"V-{INC}-002: RED", f"V-{INC}-003: GREEN", "SIGNED OFF by alice", "MERGED to main"):
        assert needle in log
    await court.handle(msg(MALLORY, "@firedrill-gate STATUS"))
    assert "MERGED" in last()
