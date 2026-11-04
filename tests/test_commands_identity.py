from __future__ import annotations

from gate.commands import parse
from gate.identity import APPROVER, BREAKER, FIXER, OTHER, IdentityBook


def test_parse_commands():
    c = parse("@firedrill-gate SUBMIT fix/idempotency-race a1b2c3d4e5")
    assert (c.verb, c.branch, c.sha, c.incident) == ("SUBMIT", "fix/idempotency-race", "a1b2c3d4e5", "idempotency-race")
    c = parse("@firedrill-gate: `attack attack/pagination-cursor DEADBEEF1`")
    assert (c.verb, c.branch, c.sha) == ("ATTACK", "attack/pagination-cursor", "deadbeef1")
    assert parse("@firedrill-gate APPROVE V-idempotency-race-002").verdict_id == "V-idempotency-race-002"
    assert parse("@firedrill-gate approve v-idempotency-race-002").verdict_id == "V-idempotency-race-002"
    assert parse("@firedrill-gate STATUS please").verb == "STATUS"


def test_parse_rejects_loose_text():
    assert parse("@firedrill-gate looks good, approve it") is None
    assert parse("@firedrill-gate APPROVE V-idempotency-race-002 and also merge x") is None
    assert parse("@firedrill-gate SUBMIT main abcdef1") is None
    assert parse("@firedrill-gate SUBMIT fix/x not-a-sha") is None
    assert parse("") is None


def test_identity_pins_and_conflicts(tmp_path):
    book = IdentityBook(tmp_path / "pins.json", "firedrill-fixer", "firedrill-breaker", ("alice",))
    book.observe("@switch-agent-f1:x", "firedrill-fixer")
    assert book.resolve({"sender": "@switch-agent-f1:x", "sender_name": "firedrill-fixer"}).role == FIXER
    # Same name, different participant: refused.
    s = book.resolve({"sender": "@switch-user-evil:x", "sender_name": "firedrill-fixer"})
    assert s.role == OTHER and s.conflict
    # First sighting pins.
    assert book.resolve({"sender": "@switch-agent-b1:x", "sender_name": "firedrill-breaker"}).role == BREAKER
    assert book.resolve({"sender": "@switch-user-a:x", "sender_name": "alice"}).role == APPROVER
    # A pinned participant can't claim a second role.
    book2 = IdentityBook(tmp_path / "pins.json", "firedrill-fixer", "firedrill-breaker", ("alice", "bob"))
    s = book2.resolve({"sender": "@switch-user-a:x", "sender_name": "bob"})
    assert s.role == OTHER and s.conflict
    # Platform posts speak for the person they carry.
    s = book2.resolve({"sender": "@switch-user-a:x", "sender_name": "Switch", "sender_kind": "platform", "on_behalf_of": "alice"})
    assert s.role == APPROVER
    # Unknown names are just OTHER, no conflict.
    assert book2.resolve({"sender": "@switch-user-z:x", "sender_name": "zed"}).role == OTHER
