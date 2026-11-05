"""get_agent_detail shapes for addressing, including the one a live Switch 0.31.0 returned."""

from gate.main import ADDRESSING_OK, addressing_state


def test_null_policy_is_open_to_anyone():
    # Observed live: a freshly opened agent has `addressing_policy: null`.
    assert addressing_state({"addressing_policy": None, "owner_name": "Admin"}) == "anyone"
    assert addressing_state({"addressing_policy": None}) in ADDRESSING_OK


def test_the_default_for_a_new_agent_is_owner_and_owner_agents():
    # Observed live right after registration, before it was opened up.
    rule = {"rooms": "*", "room_groups": "*", "users": [], "agents": [], "owner": True, "owner_agents": True, "platform": False}
    assert addressing_state({"addressing_policy": {"rules": [rule]}}) == "owner_and_owner_agents"


def test_owner_only_is_refused():
    rule = {"users": [], "agents": [], "owner": True, "owner_agents": False, "platform": False}
    assert addressing_state({"addressing_policy": {"rules": [rule]}}) == "owner_only"
    assert addressing_state({"addressing_policy": {"rules": [rule]}}) not in ADDRESSING_OK


def test_other_rule_sets_are_custom():
    assert addressing_state({"addressing_policy": {"rules": [{"users": ["u1"], "owner": False, "owner_agents": False}]}}) == "custom"
    assert addressing_state({"addressing_policy": {"rules": []}}) == "custom"


def test_older_builds_with_an_addressing_object_still_work():
    assert addressing_state({"addressing": {"policy": "anyone"}}) == "anyone"
    assert addressing_state({}) == "unknown"
