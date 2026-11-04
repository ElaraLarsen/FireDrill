"""Who sent a message, for the courtroom's purposes.

Switch tells us two things about a sender: `sender`, an opaque participant id
(`@switch-...:server`; docs: match it, never parse it), and `sender_name`.
When the Switch app posts for a person, `sender_kind == "platform"` and
`on_behalf_of` names that person.

Names alone are spoofable display text, ids alone mean nothing to a config
file. So each role is pinned: the first time a configured name is seen, its
participant id is recorded (trust on first use, persisted). From then on that
name is only honoured from that id, and the same name arriving from another id
is an identity conflict the gate refuses and announces.

Pins are seeded early from the room's history and `room_join` events, before
any command is accepted, so the first sighting is normally the agent's
own join, not a command.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

FIXER, BREAKER, APPROVER, OTHER = "fixer", "breaker", "approver", "other"


@dataclass(frozen=True)
class Sender:
    id: str
    name: str
    role: str
    conflict: str | None = None  # set when a pinned name arrives from another id


class IdentityBook:
    def __init__(self, path: Path, fixer: str, breaker: str, approvers: tuple[str, ...]) -> None:
        self.path = path
        self.roles: dict[str, str] = {fixer: FIXER, breaker: BREAKER}
        for a in approvers:
            self.roles.setdefault(a, APPROVER)
        self.pins: dict[str, str] = {}  # name -> participant id
        if path.exists():
            self.pins = json.loads(path.read_text())

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self.pins, indent=2, sort_keys=True))

    @staticmethod
    def effective_name(payload: dict[str, Any]) -> str:
        if payload.get("sender_kind") == "platform" and payload.get("on_behalf_of"):
            return str(payload["on_behalf_of"])
        return str(payload.get("sender_name") or "")

    def observe(self, sender_id: str, name: str) -> None:
        """Seed a pin from a join or history entry (no conflict reporting)."""
        if name in self.roles and sender_id and name not in self.pins:
            self.pins[name] = sender_id
            self._save()

    def resolve(self, payload: dict[str, Any]) -> Sender:
        sender_id = str(payload.get("sender") or "")
        name = self.effective_name(payload)
        role = self.roles.get(name, OTHER)
        if role == OTHER or not sender_id:
            return Sender(sender_id, name, OTHER)
        pinned = self.pins.get(name)
        if pinned is None:
            # A participant already pinned under another role can't take a second one.
            for other_name, other_id in self.pins.items():
                if other_id == sender_id and other_name != name:
                    return Sender(sender_id, name, OTHER, conflict=f"{sender_id} is already pinned as {other_name}")
            self.pins[name] = sender_id
            self._save()
            return Sender(sender_id, name, role)
        if pinned != sender_id:
            return Sender(sender_id, name, OTHER, conflict=f"'{name}' is pinned to another participant")
        return Sender(sender_id, name, role)
