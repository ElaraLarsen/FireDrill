"""Gate configuration, read from the environment and the repo's .env."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KNOWN_INCIDENTS = ("idempotency-race", "ratelimit-boundary", "path-traversal")


def load_dotenv(path: Path = ROOT / ".env") -> None:
    """Fill os.environ from a KEY=VALUE file without overriding what is set."""
    if not path.exists():
        return
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key.strip(), value)


def _list(name: str, default: str = "") -> tuple[str, ...]:
    return tuple(s.strip() for s in os.environ.get(name, default).split(",") if s.strip())


@dataclass(frozen=True)
class Config:
    switch_url: str
    agent_id: str
    api_key: str
    agent_name: str
    gate_key: str
    evidence_remote: str
    state_dir: Path
    fixer_name: str
    breaker_name: str
    approvers: tuple[str, ...]
    incidents: tuple[str, ...] = KNOWN_INCIDENTS
    verify_cmd: tuple[str, ...] = ("python3", "-m", "gate.verify")
    verify_timeout_s: int = 900
    client_version: str = "0.1.0"
    missing: tuple[str, ...] = field(default=())

    @classmethod
    def from_env(cls) -> "Config":
        load_dotenv()
        e = os.environ
        required = {
            "SWITCH_URL": e.get("SWITCH_URL", "http://localhost:8000"),
            "FIREDRILL_GATE_AGENT_ID": e.get("FIREDRILL_GATE_AGENT_ID", ""),
            "FIREDRILL_GATE_API_KEY": e.get("FIREDRILL_GATE_API_KEY", ""),
            "FIREDRILL_GATE_KEY": e.get("FIREDRILL_GATE_KEY", ""),
            "FIREDRILL_APPROVERS": e.get("FIREDRILL_APPROVERS", ""),
        }
        return cls(
            switch_url=required["SWITCH_URL"].rstrip("/"),
            agent_id=required["FIREDRILL_GATE_AGENT_ID"],
            api_key=required["FIREDRILL_GATE_API_KEY"],
            agent_name=e.get("FIREDRILL_GATE_NAME", "firedrill-gate"),
            gate_key=required["FIREDRILL_GATE_KEY"],
            evidence_remote=e.get("FIREDRILL_EVIDENCE_REMOTE", "/tmp/firedrill/evidence.git"),
            state_dir=Path(e.get("FIREDRILL_STATE_DIR", str(ROOT / "gate" / "state"))),
            fixer_name=e.get("FIREDRILL_FIXER_NAME", "firedrill-fixer"),
            breaker_name=e.get("FIREDRILL_BREAKER_NAME", "firedrill-breaker"),
            approvers=_list("FIREDRILL_APPROVERS"),
            incidents=_list("FIREDRILL_INCIDENTS", ",".join(KNOWN_INCIDENTS)),
            verify_cmd=tuple(e.get("FIREDRILL_VERIFY_CMD", "python3 -m gate.verify").split()),
            verify_timeout_s=int(e.get("FIREDRILL_VERIFY_TIMEOUT_S", "900")),
            missing=tuple(k for k, v in required.items() if not v),
        )
