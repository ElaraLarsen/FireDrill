"""Courtroom command grammar (ARCHITECTURE.md §3). Pure functions, no I/O."""

from __future__ import annotations

import re
from dataclasses import dataclass

_LEADING_MENTIONS = re.compile(r"^(?:\s*@[\w.\-]+[:,]?\s*)+")
_SHA = r"[0-9a-fA-F]{7,40}"
_PATTERNS = {
    "SUBMIT": re.compile(rf"^SUBMIT\s+(fix/[a-z0-9][a-z0-9-]*)\s+({_SHA})\b", re.IGNORECASE),
    "ATTACK": re.compile(rf"^ATTACK\s+(attack/[a-z0-9][a-z0-9-]*)\s+({_SHA})\b", re.IGNORECASE),
    "APPROVE": re.compile(r"^APPROVE\s+(V-[a-z0-9-]+-\d{3,})\s*$", re.IGNORECASE),
    "STATUS": re.compile(r"^STATUS\b", re.IGNORECASE),
}

USAGE = (
    "Commands (address me, one per message):\n"
    "- `SUBMIT fix/<incident> <sha>` (fixer)\n"
    "- `ATTACK attack/<incident> <sha>` (breaker)\n"
    "- `APPROVE <verdict id>` (approver, only the latest GREEN verdict)\n"
    "- `STATUS` (anyone)"
)


@dataclass(frozen=True)
class Command:
    verb: str  # SUBMIT | ATTACK | APPROVE | STATUS
    branch: str | None = None
    sha: str | None = None
    verdict_id: str | None = None

    @property
    def incident(self) -> str | None:
        return self.branch.split("/", 1)[1] if self.branch else None


def parse(body: str) -> Command | None:
    """The command in a message body, after any leading @mentions, or None."""
    text = _LEADING_MENTIONS.sub("", body or "").strip()
    # Chat clients wrap things in backticks; strip them so `SUBMIT ...` works.
    text = text.replace("`", "").strip()
    first = text.splitlines()[0].strip() if text else ""
    for verb, pattern in _PATTERNS.items():
        m = pattern.match(first)
        if not m:
            continue
        if verb in ("SUBMIT", "ATTACK"):
            return Command(verb, branch=m.group(1).lower(), sha=m.group(2).lower())
        if verb == "APPROVE":
            return Command(verb, verdict_id=normalize_verdict_id(m.group(1)))
        return Command(verb)
    return None


def normalize_verdict_id(vid: str) -> str:
    return "V-" + vid[2:].lower() if vid.upper().startswith("V-") else vid
