#!/usr/bin/env python3
"""Register firedrill-gate with Switch (POST /agents) and save its key to .env.

    python scripts/register_gate.py [--overwrite]

Needs in .env (or the environment):
  SWITCH_URL                    agent bridge base URL (default http://localhost:8000)
  FIREDRILL_REGISTRATION_TOKEN  a PERSONAL registration key: Gateway (http://localhost:3000)
                                -> API Keys -> new key. Mint it as the same person who will
                                run the FireDrill template in Switch Console.

Why personal, not AGENT_REGISTRATION_TOKEN: a registration key makes its minter
the agent's owner. The deployment-wide bootstrap token assigns a separate
service account. The fixer and breaker use `owner-agents` addressing, so they
only listen to their owner's agents; a gate owned by anyone else could not
wake them.

Afterwards, set the gate's addressing to "Anyone" in Switch Console (agent
settings) or Gateway. An agent cannot change its own addressing
(`update_agent_detail` refuses self-management), and a new agent answers only
its owner, which would shut out the fixer and breaker. `python -m gate.main
--probe` shows the current setting.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from gate.config import load_dotenv  # noqa: E402

ENV = ROOT / ".env"
NAME = "firedrill-gate"


def set_env(key: str, value: str) -> None:
    lines = ENV.read_text().splitlines() if ENV.exists() else []
    for i, line in enumerate(lines):
        if line.startswith(f"{key}="):
            lines[i] = f"{key}={value}"
            break
    else:
        lines.append(f"{key}={value}")
    ENV.write_text("\n".join(lines) + "\n")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--overwrite", action="store_true", help="re-register: issues a NEW key and invalidates the old one")
    args = ap.parse_args()
    if not ENV.exists() and (ROOT / ".env.example").exists():
        ENV.write_text((ROOT / ".env.example").read_text())
    load_dotenv(ENV)
    import os

    base = os.environ.get("SWITCH_URL", "http://localhost:8000").rstrip("/")
    token = os.environ.get("FIREDRILL_REGISTRATION_TOKEN", "")
    if not token:
        sys.exit("Set FIREDRILL_REGISTRATION_TOKEN in .env: Gateway -> API Keys -> new key (minted by the person who runs the template).")

    health = httpx.get(f"{base}/health", timeout=10)
    if health.status_code != 200:
        sys.exit(f"{base}/health answered {health.status_code}; is SWITCH_URL the agent bridge base URL?")

    body = {
        "name": NAME,
        "display_name": "FireDrill Gate",
        "description": "Verifies hotfixes against adversarial attacks in a clean container and merges only on GREEN plus human sign-off.",
        "connector_type": "firedrill-gate",
        "integration_profile": {
            "connection_model": "always_on",
            "message_exchange": True,
            "pre_invocation_mediation": [],
            "post_invocation_mediation": [],
            "event_reporting": [],
        },
        "overwrite": args.overwrite,
    }
    r = httpx.post(f"{base}/agents", json=body, headers={"Authorization": f"Bearer {token}"}, timeout=30)
    if r.status_code == 409:
        sys.exit(f"'{NAME}' is already registered. Keep using the key in .env, or rerun with --overwrite to rotate it (the old key stops working).")
    if r.status_code == 401:
        sys.exit("401: the registration token was refused. Mint a personal key in Gateway -> API Keys.")
    if r.status_code >= 300:
        sys.exit(f"registration failed {r.status_code}: {r.text[:500]}")
    data = r.json()
    set_env("FIREDRILL_GATE_AGENT_ID", data["id"])
    set_env("FIREDRILL_GATE_API_KEY", data["api_key"])
    print(f"registered {NAME}: id={data['id']} (API key saved to .env; it is shown only once)")
    print("\nNext:")
    print("  1. Switch Console -> Agents -> firedrill-gate -> settings: set who can address it to 'Anyone'.")
    print("  2. python -m gate.main --probe   (expect addressing.policy == 'anyone')")


if __name__ == "__main__":
    main()
