"""The gate's verdict post must count only checks against the submitted fix.

Reference checks validate attacks (Rule R3). A reference failure means the attack was discarded, so
counting it made a GREEN verdict read "6/7 checks passed. - FAIL test_overbroad…".
"""

from __future__ import annotations

from pathlib import Path

from gate.config import Config
from gate.courtroom import render_verdict_message

CFG = Config(
    switch_url="http://unused", agent_id="g", api_key="k", agent_name="firedrill-gate", gate_key="x",
    evidence_remote="/unused", state_dir=Path("/unused"), fixer_name="firedrill-fixer",
    breaker_name="firedrill-breaker", approvers=("creator",),
)
OVERBROAD = "attacks/test_attack.py::test_overbroad"
VALID = "attacks/test_attack.py::test_two_processes"


def verdict(result: str, fix_attack: str) -> dict:
    return {
        "verdict_id": "V-idempotency-race-003", "result": result,
        "fix": {"branch": "fix/idempotency-race", "sha": "b49cd39804b3aaaa"},
        "attack": {"branch": "attack/idempotency-race", "sha": "1e9b2d042282aaaa"},
        "checks": [
            {"name": "checks/repro_test.py", "kind": "repro", "against": "reference", "status": "pass"},
            {"name": VALID, "kind": "attack", "against": "reference", "status": "pass"},
            {"name": OVERBROAD, "kind": "attack", "against": "reference", "status": "fail", "output_tail": "boom"},
            {"name": "checks/repro_test.py", "kind": "repro", "against": "fix", "status": "pass"},
            {"name": VALID, "kind": "attack", "against": "fix", "status": fix_attack, "output_tail": "2 charges"},
            {"name": "checks/invariant.py", "kind": "invariant", "against": "fix", "status": "pass"},
        ],
        "discarded_attacks": [{"name": OVERBROAD, "reason": "fails against reference fix"}],
    }


def test_green_counts_fix_checks_only_and_lists_the_discard_separately():
    msg = render_verdict_message(verdict("GREEN", "pass"), CFG)
    assert "3/3 checks against the fix passed." in msg
    assert "FAIL" not in msg
    assert f"- discarded attack `{OVERBROAD}`: fails against reference fix" in msg
    assert "APPROVE V-idempotency-race-003" in msg


def test_red_names_the_attack_that_broke_the_fix_not_the_discarded_one():
    msg = render_verdict_message(verdict("RED", "fail"), CFG)
    assert "2/3 checks against the fix passed." in msg
    assert f"- FAIL `{VALID}` (attack, vs fix)" in msg
    assert f"FAIL `{OVERBROAD}`" not in msg
