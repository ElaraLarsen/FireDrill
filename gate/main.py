"""Run firedrill-gate, or probe a live Switch server.

    python -m gate.main            run the gate (WebSocket in, HTTP out)
    python -m gate.main --probe    check health, ops schemas and our addressing, then exit

`--probe` is how ARCHITECTURE §0.4 unknowns get closed: paste its output into
RELAY_STATE.md.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import signal
import sys

from gate import telemetry
from gate.config import Config
from gate.courtroom import Courtroom
from gate.identity import IdentityBook
from gate.merger import Merger
from gate.switch_client import FatalConnectionError, OpError, SwitchClient

log = logging.getLogger("firedrill.gate")

ADDRESSING_OK = ("anyone", "owner_and_owner_agents", "custom")


def build(cfg: Config) -> tuple[SwitchClient, Courtroom]:
    client = SwitchClient(
        cfg.switch_url, cfg.agent_id, cfg.api_key, cfg.state_dir,
        client_name=cfg.agent_name, client_version=cfg.client_version,
    )
    merger = Merger(cfg.evidence_remote, cfg.state_dir / "work", cfg.gate_key)
    identity = IdentityBook(cfg.state_dir / "pins.json", cfg.fixer_name, cfg.breaker_name, cfg.approvers)
    court = Courtroom(cfg, client, merger, identity)
    client.on_event(court.handle)
    return client, court


def addressing_state(detail: dict) -> str:
    """Who may address this agent, from `get_agent_detail`.

    Switch 0.31.0 (observed live against a local stack) returns `addressing_policy`: null means the agent
    is open to anyone; otherwise `{"rules": [{rooms, room_groups, users, agents, owner, owner_agents,
    platform}, ...]}`. Older builds returned an `addressing` object with a `policy` string, still honoured.
    """
    if "addressing_policy" in detail:
        pol = detail["addressing_policy"]
        if pol is None:
            return "anyone"
        rules = pol.get("rules") if isinstance(pol, dict) else None
        if not rules:
            return "custom"
        if any(r.get("owner_agents") for r in rules):
            return "owner_and_owner_agents"
        if all(r.get("owner") and not (r.get("users") or r.get("agents") or r.get("platform")) for r in rules):
            return "owner_only"
        return "custom"
    legacy = detail.get("addressing")
    return legacy.get("policy") if isinstance(legacy, dict) else (legacy or "unknown")


async def preflight(client: SwitchClient, cfg: Config, *, strict: bool) -> dict:
    report: dict = {"switch_url": cfg.switch_url, "agent_id": cfg.agent_id}
    report["health"] = await client.health()
    schemas = await client.discover_ops()
    report["ops_count"] = len(schemas)
    report["ops_schema_problems"] = client.check_ops()
    (cfg.state_dir).mkdir(parents=True, exist_ok=True)
    (cfg.state_dir / "ops_schema.json").write_text(json.dumps(schemas, indent=2, sort_keys=True))
    try:
        detail = await client.op("get_agent_detail", agent_id=cfg.agent_id)
        report["addressing_policy"] = (detail or {}).get("addressing_policy")
        report["owner"] = (detail or {}).get("owner_name")
        policy = addressing_state(detail or {})
    except OpError as e:
        report["addressing_error"] = str(e)
        policy = None
    report["addressing"] = policy
    if strict and policy not in ADDRESSING_OK:
        raise SystemExit(
            f"firedrill-gate addressing is '{policy}'. The fixer and breaker can't reach it like that.\n"
            "Set it to 'Anyone' in Switch Console (agent settings) or Gateway; an agent can't change its own."
        )
    if strict and report["ops_schema_problems"]:
        raise SystemExit("ops schema mismatch:\n  " + "\n  ".join(report["ops_schema_problems"]))
    return report


async def run(cfg: Config) -> None:
    client, _court = build(cfg)
    log.info("preflight: %s", json.dumps(await preflight(client, cfg, strict=True)))
    await telemetry.start()  # dashboard feed on :8787; if it can't bind, the gate runs on without it
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop.set)
    runner = asyncio.create_task(client.run_forever())
    stopper = asyncio.create_task(stop.wait())
    done, _ = await asyncio.wait({runner, stopper}, return_when=asyncio.FIRST_COMPLETED)
    await client.stop()
    await telemetry.stop()
    for t in done:
        if t is runner and t.exception():
            raise t.exception()  # type: ignore[misc]


async def probe(cfg: Config) -> None:
    client, _ = build(cfg)
    try:
        report = await preflight(client, cfg, strict=False)
        print(json.dumps(report, indent=2, default=str))
        print(f"\nops schemas written to {cfg.state_dir / 'ops_schema.json'}")
    finally:
        await client.stop()


def main() -> None:
    ap = argparse.ArgumentParser(prog="firedrill-gate")
    ap.add_argument("--probe", action="store_true", help="check the server and exit")
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args()
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    cfg = Config.from_env()
    if cfg.missing:
        sys.exit(f"missing settings in .env: {', '.join(cfg.missing)} (run scripts/register_gate.py and scripts/bootstrap_evidence.sh)")
    try:
        asyncio.run(probe(cfg) if args.probe else run(cfg))
    except FatalConnectionError as e:
        sys.exit(f"fatal: {e}")


if __name__ == "__main__":
    main()
