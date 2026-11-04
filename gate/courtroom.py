"""The courtroom: turns addressed room messages into verified, signed-off merges.

Flow per room (ARCHITECTURE.md §3):
  fixer   SUBMIT fix/<incident> <sha>    -> checkout, verify (with latest attack)
  breaker ATTACK attack/<incident> <sha> -> checkout, verify the latest fix again
  human   APPROVE <verdict id>           -> latest + GREEN + fix still at head -> merge
  anyone  STATUS                         -> docket summary

Every verdict comes from running `gate.verify` (the verify engine's CLI). The gate
never decides a result itself: it only assigns the verdict id, records the
branches and shas, and refuses to merge anything that is not the latest GREEN.

Decisions live in two room documents the gate creates, so only the gate can
edit them (Switch: a room document is editable only by the agent that wrote it):
  firedrill-docket    what was submitted, by whom, and the current state
  firedrill-verdicts  every verdict, discarded attack, sign-off and merge
"""

from __future__ import annotations

import asyncio
import inspect
import json
import logging
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from gate import commands
from gate.commands import Command
from gate.config import ROOT, Config
from gate.identity import APPROVER, BREAKER, FIXER, IdentityBook, Sender
from gate.merger import Checkout, Merger, MergeError
from gate.switch_client import OpError, SwitchClient

log = logging.getLogger("firedrill.courtroom")

DOCKET_DOC = "firedrill-docket"
VERDICTS_DOC = "firedrill-verdicts"


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@dataclass
class Case:
    room_id: str
    room_name: str = ""
    incident: str | None = None
    opened: bool = False
    doc_ids: dict[str, str] = field(default_factory=dict)
    fixes: list[dict[str, Any]] = field(default_factory=list)
    attacks: list[dict[str, Any]] = field(default_factory=list)
    verdicts: list[dict[str, Any]] = field(default_factory=list)
    merges: list[dict[str, Any]] = field(default_factory=list)

    @property
    def latest_fix(self) -> dict[str, Any] | None:
        return self.fixes[-1] if self.fixes else None

    @property
    def latest_attack(self) -> dict[str, Any] | None:
        return self.attacks[-1] if self.attacks else None

    @property
    def latest_verdict(self) -> dict[str, Any] | None:
        return self.verdicts[-1] if self.verdicts else None


class Telemetry:
    """Adapter onto gate.telemetry.publish (Claude-2's lane). No-op until it exists."""

    def __init__(self) -> None:
        try:
            from gate import telemetry  # type: ignore[attr-defined]

            self._publish = getattr(telemetry, "publish", None)
        except ImportError:
            self._publish = None
        if self._publish is None:
            log.info("gate.telemetry.publish not available yet; dashboard frames are skipped")

    async def __call__(self, kind: str, room_id: str, seq: int | None, actor: dict[str, Any], data: dict[str, Any]) -> None:
        if self._publish is None:
            return
        try:
            result = self._publish(kind, room_id, seq, actor, data)
            if inspect.isawaitable(result):
                await result
        except Exception:
            log.exception("telemetry publish failed (%s)", kind)


class Courtroom:
    def __init__(
        self,
        cfg: Config,
        client: SwitchClient,
        merger: Merger,
        identity: IdentityBook,
        telemetry: Telemetry | None = None,
    ) -> None:
        self.cfg = cfg
        self.client = client
        self.merger = merger
        self.identity = identity
        self.telemetry = telemetry or Telemetry()
        self.cases: dict[str, Case] = {}
        self._locks: dict[str, asyncio.Lock] = {}
        self.cases_dir = cfg.state_dir / "cases"

    # ── persistence ───────────────────────────────────────────────────────
    def case(self, room_id: str) -> Case:
        if room_id not in self.cases:
            path = self.cases_dir / f"{_safe(room_id)}.json"
            if path.exists():
                self.cases[room_id] = Case(**json.loads(path.read_text()))
            else:
                self.cases[room_id] = Case(room_id=room_id)
        return self.cases[room_id]

    def save(self, case: Case) -> None:
        self.cases_dir.mkdir(parents=True, exist_ok=True)
        (self.cases_dir / f"{_safe(case.room_id)}.json").write_text(json.dumps(asdict(case), indent=2))

    def lock(self, room_id: str) -> asyncio.Lock:
        return self._locks.setdefault(room_id, asyncio.Lock())

    # ── event entry point ─────────────────────────────────────────────────
    async def handle(self, frame: dict[str, Any]) -> None:
        event, data, seq = frame.get("event"), frame.get("data") or {}, frame.get("id")
        room_id = data.get("room_id")
        payload = data.get("payload") or {}
        if not room_id:
            return
        if event == "room_join":
            self.identity.observe(str(payload.get("member") or ""), str(payload.get("member_name") or ""))
            return
        if event != "message":
            return

        name = IdentityBook.effective_name(payload)
        if name == self.cfg.agent_name:
            return  # our own posts
        sender = self.identity.resolve(payload)
        await self.telemetry(
            "room_message",
            room_id,
            seq,
            self._actor(sender),
            {"body": payload.get("body", ""), "thread_id": payload.get("thread_id"), "addressed": bool(payload.get("addressed"))},
        )
        if not payload.get("addressed"):
            return  # see everything, act only when addressed (protocol rule)

        thread = payload.get("thread_id") or payload.get("message_id")
        cmd = commands.parse(str(payload.get("body") or ""))
        async with self.lock(room_id):
            case = self.case(room_id)
            if not case.opened:
                await self.open_docket(case)
            if sender.conflict:
                await self.reject(case, sender, f"identity conflict: {sender.conflict}. Command ignored.", thread)
                return
            if cmd is None:
                await self.post(case, commands.USAGE, thread)
                return
            if cmd.verb == "STATUS":
                await self.post(case, self.status_text(case), thread)
            elif cmd.verb == "SUBMIT":
                await self.on_submit(case, sender, cmd, thread)
            elif cmd.verb == "ATTACK":
                await self.on_attack(case, sender, cmd, thread)
            elif cmd.verb == "APPROVE":
                await self.on_approve(case, sender, cmd, thread)

    # ── room I/O ──────────────────────────────────────────────────────────
    async def post(self, case: Case, body: str, thread_id: str | None = None) -> None:
        async with self.client.room():
            await self.client.use_room(case.room_id)
            try:
                await self.client.op("post_message", body=body, thread_id=thread_id)
            except OpError as e:
                if thread_id and e.status == 400:
                    await self.client.op("post_message", body=body)  # thread id not accepted: post top-level
                else:
                    raise
        # The gate never hears its own posts (handle() skips them), so mirror them here.
        await self.telemetry("room_message", case.room_id, None, self._gate_actor(), {"body": body, "thread_id": thread_id, "addressed": False})

    async def reject(self, case: Case, sender: Sender, reason: str, thread: str | None) -> None:
        await self.telemetry("rejected", case.room_id, None, self._actor(sender), {"reason": reason})
        await self.post(case, f"Rejected: {reason}", thread)

    async def open_docket(self, case: Case) -> None:
        async with self.client.room():
            ctx = await self.client.use_room(case.room_id)
            if ctx is None:  # already connected to it; fetch details explicitly
                ctx = await self.client.op("connect_to_room", room_id=case.room_id, include_general_instructions=False)
            ctx = ctx or {}
            case.room_name = str(ctx.get("name") or case.room_id)
            case.incident = case.incident or _incident_from_name(case.room_name, self.cfg.incidents)
            for p in ctx.get("participants") or []:
                # Agents by name; their participant ids are pinned when they speak or join.
                log.info("participant: %s (%s)", p.get("name"), p.get("type"))
            existing = {d.get("name"): d.get("id") for d in ctx.get("documents") or [] if isinstance(d, dict)}
            for name, desc in (
                (DOCKET_DOC, "FireDrill docket: submissions and current state (written only by firedrill-gate)"),
                (VERDICTS_DOC, "FireDrill decision log: verdicts, sign-offs, merges (written only by firedrill-gate)"),
            ):
                if name in case.doc_ids:
                    continue
                if existing.get(name):
                    case.doc_ids[name] = str(existing[name])
                    continue
                res = await self.client.op(
                    "create_room_document",
                    name=name,
                    description=desc,
                    instructions="Read-only record kept by firedrill-gate. Cite verdict ids from it; never restate results from memory.",
                    content="(opening)",
                )
                case.doc_ids[name] = str(res["document_id"])
        case.opened = True
        self.save(case)
        await self.write_docs(case)
        brief = await self._brief(case)
        incident = case.incident or "unknown (room name has no known incident)"
        await self.post(
            case,
            f"Docket open for **{incident}**. Decision log: `{VERDICTS_DOC}` (only I can edit it).\n\n"
            + (f"{brief}\n\n" if brief else "")
            + commands.USAGE,
        )
        await self.telemetry("gate_state", case.room_id, None, self._gate_actor(), {"state": "docket_open", "incident": case.incident, "room_name": case.room_name, "brief": brief, "approvers": list(self.cfg.approvers)})

    async def write_docs(self, case: Case) -> None:
        async with self.client.room():
            await self.client.use_room(case.room_id)
            if DOCKET_DOC in case.doc_ids:
                await self.client.op("update_room_document", document_id=case.doc_ids[DOCKET_DOC], content=render_docket(case))
            if VERDICTS_DOC in case.doc_ids:
                await self.client.op("update_room_document", document_id=case.doc_ids[VERDICTS_DOC], content=render_verdicts(case))

    async def _brief(self, case: Case) -> str:
        if not case.incident:
            return ""
        try:
            main = await self.merger.main_checkout(case.room_id)
        except MergeError as e:
            log.warning("no main checkout for brief: %s", e)
            return ""
        for rel in (f"incidents/{case.incident}/brief.md", f"incident-lab/incidents/{case.incident}/brief.md"):
            p = main.path / rel
            if p.exists():
                return p.read_text()[:3000]
        return ""

    # ── commands ──────────────────────────────────────────────────────────
    def _check_incident(self, case: Case, cmd: Command) -> str | None:
        if cmd.incident not in self.cfg.incidents:
            return f"unknown incident '{cmd.incident}'"
        if case.incident and cmd.incident != case.incident:
            return f"this room drills '{case.incident}', not '{cmd.incident}'"
        return None

    async def on_submit(self, case: Case, sender: Sender, cmd: Command, thread: str | None) -> None:
        if sender.role not in (FIXER, APPROVER):
            return await self.reject(case, sender, f"only {self.cfg.fixer_name} (or an approver, flagged manual) may SUBMIT", thread)
        if problem := self._check_incident(case, cmd):
            return await self.reject(case, sender, problem, thread)
        try:
            co = await self.merger.checkout(case.room_id, cmd.branch or "", cmd.sha or "")
        except MergeError as e:
            return await self.reject(case, sender, str(e), thread)
        case.incident = case.incident or cmd.incident
        entry = {"branch": co.branch, "sha": co.sha, "by": sender.name, "manual": sender.role == APPROVER, "at": now(), "path": str(co.path)}
        case.fixes.append(entry)
        self.save(case)
        await self.telemetry("submission", case.room_id, None, self._actor(sender), {**_public(entry), "diff_stat": await self._diff_stat(case, co.sha)})
        await self.post(case, f"Fix `{co.sha[:12]}` on `{co.branch}` received. Verifying in a clean container…", thread)
        await self.run_verdict(case, thread)

    async def on_attack(self, case: Case, sender: Sender, cmd: Command, thread: str | None) -> None:
        if sender.role not in (BREAKER, APPROVER):
            return await self.reject(case, sender, f"only {self.cfg.breaker_name} (or an approver, flagged manual) may ATTACK", thread)
        if problem := self._check_incident(case, cmd):
            return await self.reject(case, sender, problem, thread)
        try:
            co = await self.merger.checkout(case.room_id, cmd.branch or "", cmd.sha or "")
        except MergeError as e:
            return await self.reject(case, sender, str(e), thread)
        if not (co.path / "attacks" / (cmd.incident or "")).is_dir():
            return await self.reject(case, sender, f"`{co.branch}` @ {co.sha[:12]} has no attacks/{cmd.incident}/ directory", thread)
        case.incident = case.incident or cmd.incident
        entry = {"branch": co.branch, "sha": co.sha, "by": sender.name, "manual": sender.role == APPROVER, "at": now(), "path": str(co.path)}
        case.attacks.append(entry)
        self.save(case)
        await self.telemetry("attack", case.room_id, None, self._actor(sender), {**_public(entry), "diff_stat": await self._diff_stat(case, co.sha)})
        if case.latest_fix is None:
            await self.post(case, f"Attack `{co.sha[:12]}` recorded. It runs as soon as a fix is submitted.", thread)
            await self.write_docs(case)
            return
        await self.post(case, f"Attack `{co.sha[:12]}` received. Re-verifying fix `{case.latest_fix['sha'][:12]}` against it…", thread)
        await self.run_verdict(case, thread)

    async def run_verdict(self, case: Case, thread: str | None) -> None:
        fix = case.latest_fix
        assert fix is not None and case.incident
        # The trees checked out when each was recorded: the exact shas submitted,
        # whatever has been pushed to those branches since.
        fix_co = Checkout(fix["branch"], fix["sha"], Path(fix["path"]))
        attack = case.latest_attack
        attack_dir: Path | None = None
        if attack is not None:
            attack_dir = Path(attack["path"]) / "attacks" / case.incident
        if not fix_co.path.is_dir() or (attack_dir is not None and not attack_dir.is_dir()):
            await self.post(case, "Checked-out trees are missing (state dir cleaned?). Re-SUBMIT / re-ATTACK the heads.", thread)
            return
        verdict_id = f"V-{case.incident}-{len(case.verdicts) + 1:03d}"
        await self.telemetry("verdict_started", case.room_id, None, self._gate_actor(), {"verdict_id": verdict_id, "fix": _public(fix), "attack": _public(attack) if attack else None})
        verdict = await self.verify(case.incident, fix_co, attack_dir)
        verdict.update(
            verdict_id=verdict_id,
            incident=case.incident,
            fix={"branch": fix["branch"], "sha": fix["sha"]},
            attack={"branch": attack["branch"], "sha": attack["sha"]} if attack else None,
        )
        case.verdicts.append(verdict)
        self.save(case)
        for check in verdict.get("checks") or []:
            await self.telemetry("check", case.room_id, None, self._gate_actor(), {"verdict_id": verdict_id, **check})
        await self.telemetry("verdict", case.room_id, None, self._gate_actor(), verdict)
        await self.write_docs(case)
        await self.post(case, render_verdict_message(verdict, self.cfg), thread)

    async def verify(self, incident: str, fix: Checkout, attack_dir: Path | None) -> dict[str, Any]:
        """Run the verify engine CLI (ARCHITECTURE §4.2). Exit 0 GREEN, 1 RED, 2 ERROR."""
        cmd = [*self.cfg.verify_cmd, "--incident", incident, "--fix-dir", str(fix.path), "--json"]
        if attack_dir is not None:
            cmd += ["--attack-dir", str(attack_dir)]
        started = now()
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd, cwd=str(ROOT), stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
            )
            out, err = await asyncio.wait_for(proc.communicate(), timeout=self.cfg.verify_timeout_s)
        except asyncio.TimeoutError:
            proc.kill()
            return _error_verdict(started, f"verify timed out after {self.cfg.verify_timeout_s}s")
        except OSError as e:
            return _error_verdict(started, f"could not start verify: {e}")
        stdout, stderr = out.decode(errors="replace"), err.decode(errors="replace")
        parsed = _last_json_object(stdout)
        if parsed is None:
            return _error_verdict(started, f"verify exited {proc.returncode} without JSON: {(stderr or stdout).strip()[-600:]}")
        expected = {0: "GREEN", 1: "RED", 2: "ERROR"}.get(proc.returncode or 0, "ERROR")
        if parsed.get("result") != expected:
            parsed["result"] = "ERROR"
            parsed.setdefault("notes", []).append(
                f"verify exit code {proc.returncode} disagrees with its JSON result; treated as ERROR"
            )
        return parsed

    async def on_approve(self, case: Case, sender: Sender, cmd: Command, thread: str | None) -> None:
        if sender.role != APPROVER:
            return await self.reject(case, sender, f"{sender.name or 'sender'} is not an approver", thread)
        latest = case.latest_verdict
        if latest is None:
            return await self.reject(case, sender, "there is no verdict yet", thread)
        if cmd.verdict_id != latest["verdict_id"]:
            return await self.reject(case, sender, f"{cmd.verdict_id} is not the latest verdict ({latest['verdict_id']})", thread)
        if latest.get("result") != "GREEN":
            return await self.reject(case, sender, f"{latest['verdict_id']} is {latest.get('result')}, not GREEN", thread)
        if not latest.get("attack"):
            return await self.reject(case, sender, f"{latest['verdict_id']} has not faced an attack yet; no attack, no sign-off", thread)
        if latest.get("signoff"):
            return await self.reject(case, sender, f"{latest['verdict_id']} is already signed off", thread)
        try:
            head = await self.merger.branch_head(case.room_id, latest["fix"]["branch"])
        except MergeError as e:
            return await self.reject(case, sender, str(e), thread)
        if head != latest["fix"]["sha"]:
            return await self.reject(case, sender, f"{latest['fix']['branch']} moved to {head[:12]} after {latest['verdict_id']}; it must be re-verified", thread)
        latest["signoff"] = {"by": sender.name, "participant": sender.id, "at": now()}
        await self.telemetry("signoff", case.room_id, None, self._actor(sender), {"verdict_id": latest["verdict_id"], **latest["signoff"]})
        try:
            merged = await self.merger.merge_to_main(case.room_id, latest["fix"]["sha"], latest["verdict_id"], sender.name)
        except MergeError as e:
            latest["merge_error"] = str(e)
            self.save(case)
            await self.write_docs(case)
            return await self.post(case, f"Signed off, but the merge failed: {e}", thread)
        merge = {"verdict_id": latest["verdict_id"], "fix_sha": latest["fix"]["sha"], "main_sha": merged, "by": sender.name, "at": now()}
        case.merges.append(merge)
        latest["merged"] = merge
        self.save(case)
        await self.telemetry("merge", case.room_id, None, self._gate_actor(), merge)
        await self.write_docs(case)
        await self.post(case, f"MERGED. `{latest['verdict_id']}` signed off by {sender.name}. main is now `{merged[:12]}`.", thread)

    async def _diff_stat(self, case: Case, sha: str) -> dict[str, Any] | None:
        """Files/lines a submission changes against main, for the dashboard. Best effort."""
        try:
            return await self.merger.diff_stat(case.room_id, sha)
        except MergeError as e:
            log.info("no diff stat for %s: %s", sha[:12], e)
            return None

    # ── text ──────────────────────────────────────────────────────────────
    def status_text(self, case: Case) -> str:
        v = case.latest_verdict
        lines = [f"**Docket: {case.incident or 'unknown incident'}**"]
        lines.append(f"Latest fix: `{case.latest_fix['sha'][:12]}` by {case.latest_fix['by']}" if case.latest_fix else "Latest fix: none")
        lines.append(f"Latest attack: `{case.latest_attack['sha'][:12]}` by {case.latest_attack['by']}" if case.latest_attack else "Latest attack: none")
        if v:
            if v.get("merged"):
                state = "MERGED"
            elif v.get("result") == "GREEN":
                state = "awaiting APPROVE" if v.get("attack") else "awaiting an attack"
            else:
                state = "needs a new fix"
            lines.append(f"Latest verdict: `{v['verdict_id']}` **{v.get('result')}** ({state})")
        else:
            lines.append("Latest verdict: none")
        return "\n".join(lines)

    def _actor(self, sender: Sender) -> dict[str, Any]:
        role = {FIXER: "fixer", BREAKER: "breaker"}.get(sender.role, "human")
        return {"id": sender.id, "name": sender.name, "role": role}

    def _gate_actor(self) -> dict[str, Any]:
        return {"id": self.cfg.agent_id, "name": self.cfg.agent_name, "role": "gate"}


# ── rendering (room docs and messages) ────────────────────────────────────
def render_verdict_message(v: dict[str, Any], cfg: Config) -> str:
    result = v.get("result", "ERROR")
    checks = v.get("checks") or []
    failed = [c for c in checks if c.get("status") != "pass"]
    lines = [f"**{v['verdict_id']}: {result}**  fix `{v['fix']['sha'][:12]}`" + (f" vs attack `{v['attack']['sha'][:12]}`" if v.get("attack") else "")]
    lines.append(f"{len(checks) - len(failed)}/{len(checks)} checks passed.")
    for c in failed[:5]:
        tail = (c.get("output_tail") or "").strip().splitlines()[-3:]
        lines.append(f"- {c.get('status', '?').upper()} `{c.get('name')}` ({c.get('kind')}, vs {c.get('against')})" + (f"\n  ```\n  {chr(10).join(tail)}\n  ```" if tail else ""))
    for d in v.get("discarded_attacks") or []:
        lines.append(f"- discarded attack `{d.get('name')}`: {d.get('reason')}")
    for n in v.get("notes") or []:
        lines.append(f"- note: {n}")
    if result == "GREEN" and not v.get("attack"):
        lines.append(f"\nGREEN on the repro only. @{cfg.breaker_name}: attack it. No attack, no sign-off.")
    elif result == "GREEN":
        lines.append(f"\nApprovers ({', '.join(cfg.approvers)}): reply `@{cfg.agent_name} APPROVE {v['verdict_id']}` to merge.")
    elif result == "RED":
        lines.append(f"\n@{cfg.fixer_name}: fix the root cause, push, and SUBMIT again.")
    return "\n".join(lines)


def render_docket(case: Case) -> str:
    out = [f"# FireDrill docket: {case.incident or 'unknown'}", f"Room: {case.room_name}", f"Updated: {now()}", "", "## Fixes"]
    out += [f"- `{f['sha'][:12]}` {f['branch']} by {f['by']}{' (manual)' if f.get('manual') else ''} at {f['at']}" for f in case.fixes] or ["- none"]
    out += ["", "## Attacks"]
    out += [f"- `{a['sha'][:12]}` {a['branch']} by {a['by']}{' (manual)' if a.get('manual') else ''} at {a['at']}" for a in case.attacks] or ["- none"]
    v = case.latest_verdict
    out += ["", "## State", f"- latest verdict: {v['verdict_id']} {v.get('result')}" if v else "- no verdict yet"]
    return "\n".join(out)


def render_verdicts(case: Case) -> str:
    out = [f"# FireDrill decision log: {case.incident or 'unknown'}", "Written only by firedrill-gate. Newest last.", ""]
    for v in case.verdicts:
        out.append(f"## {v['verdict_id']}: {v.get('result')}")
        out.append(f"- fix: {v['fix']['branch']} `{v['fix']['sha']}`")
        if v.get("attack"):
            out.append(f"- attack: {v['attack']['branch']} `{v['attack']['sha']}`")
        runner = v.get("runner") or {}
        if runner:
            out.append(f"- runner: {runner.get('image')} network={runner.get('network')}")
        for c in v.get("checks") or []:
            out.append(f"  - {c.get('status')} {c.get('kind')}:{c.get('name')} vs {c.get('against')} ({c.get('duration_ms')} ms)")
        for d in v.get("discarded_attacks") or []:
            out.append(f"  - discarded {d.get('name')}: {d.get('reason')}")
        if v.get("signoff"):
            s = v["signoff"]
            out.append(f"- SIGNED OFF by {s['by']} ({s['participant']}) at {s['at']}")
        if v.get("merged"):
            out.append(f"- MERGED to main `{v['merged']['main_sha']}`")
        if v.get("merge_error"):
            out.append(f"- merge failed: {v['merge_error']}")
        out.append("")
    if not case.verdicts:
        out.append("(no verdicts yet)")
    return "\n".join(out)


# ── helpers ───────────────────────────────────────────────────────────────
def _incident_from_name(room_name: str, incidents: tuple[str, ...]) -> str | None:
    for inc in sorted(incidents, key=len, reverse=True):
        if room_name.endswith(inc):
            return inc
    return None


def _last_json_object(text: str) -> dict[str, Any] | None:
    text = text.strip()
    try:
        obj = json.loads(text)
        return obj if isinstance(obj, dict) else None
    except ValueError:
        pass
    for line in reversed(text.splitlines()):
        line = line.strip()
        if line.startswith("{"):
            try:
                obj = json.loads(line)
                return obj if isinstance(obj, dict) else None
            except ValueError:
                continue
    return None


def _error_verdict(started: str, reason: str) -> dict[str, Any]:
    return {"checks": [], "discarded_attacks": [], "result": "ERROR", "notes": [reason], "started_at": started, "finished_at": now()}


def _public(entry: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in entry.items() if k != "path"}


def _safe(room_id: str) -> str:
    return "".join(ch if ch.isalnum() or ch in "._-" else "_" for ch in room_id)
