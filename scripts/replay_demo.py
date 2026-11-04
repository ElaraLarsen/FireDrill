#!/usr/bin/env python3
"""Scripted judge replay: drive a FireDrill room without live Claude/Codex sessions.

    python scripts/replay_demo.py --incident idempotency-race --room firedrill-idempotency-race [--approve]

What it does (everything is executed for real; only the *authorship* is scripted):
  1. pushes demo/scripted/<incident>/naive.patch onto main as fix/<incident>
     and posts `@firedrill-gate SUBMIT ...` into the room as the Mattermost user,
  2. waits for the gate's verdict,
  3. pushes demo/scripted/<incident>/attack/ as attack/<incident>, posts ATTACK, waits,
  4. pushes demo/scripted/<incident>/fix.patch (a correct fix) as a new fix/<incident>
     commit, posts SUBMIT, waits,
  5. with --approve, posts `APPROVE <verdict id>`; otherwise prints the line for the
     human to type in Mattermost (the better demo).

Because these commands come from a person and not from firedrill-fixer/breaker,
the gate accepts them only from configured approvers and flags them `manual`
in the docket. Nothing is labelled as agent work that wasn't.

Needs .env: MATTERMOST_HOST_PORT, MATTERMOST_USER, MATTERMOST_USER_PASSWORD,
MATTERMOST_TEAM_NAME, FIREDRILL_EVIDENCE_REMOTE, FIREDRILL_GATE_NAME.
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from gate.config import load_dotenv  # noqa: E402

VERDICT_RE = re.compile(r"\*\*(V-[a-z0-9-]+-\d{3,}): (GREEN|RED|ERROR)\*\*")


def git(*args: str, cwd: Path) -> str:
    return subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True, text=True).stdout.strip()


class Mattermost:
    def __init__(self, base: str, user: str, password: str, team: str) -> None:
        self.http = httpx.Client(base_url=base, timeout=20)
        r = self.http.post("/api/v4/users/login", json={"login_id": user, "password": password})
        if r.status_code != 200:
            sys.exit(f"Mattermost login as {user} failed: {r.status_code} {r.text[:200]}")
        self.http.headers["Authorization"] = f"Bearer {r.headers['Token']}"
        self.team_id = self._get(f"/api/v4/teams/name/{team}")["id"]

    def _get(self, path: str, **params: object) -> dict | list:
        r = self.http.get(path, params=params)
        r.raise_for_status()
        return r.json()

    def channel(self, room: str) -> str:
        for ch in self._get(f"/api/v4/users/me/teams/{self.team_id}/channels"):
            if room in (ch.get("display_name"), ch.get("name")):
                return ch["id"]
        sys.exit(f"no channel named '{room}' visible to this user; is the user in the room ({{$creator}})?")

    def post(self, channel_id: str, message: str) -> int:
        r = self.http.post("/api/v4/posts", json={"channel_id": channel_id, "message": message})
        r.raise_for_status()
        return int(r.json()["create_at"])

    def wait_verdict(self, channel_id: str, since_ms: int, incident: str, timeout_s: int) -> tuple[str, str]:
        deadline = time.time() + timeout_s
        while time.time() < deadline:
            posts = self._get(f"/api/v4/channels/{channel_id}/posts", since=since_ms)
            for p in sorted(posts.get("posts", {}).values(), key=lambda p: p["create_at"]):
                m = VERDICT_RE.search(p.get("message", ""))
                if m and m.group(1).startswith(f"V-{incident}-"):
                    return m.group(1), m.group(2)
            time.sleep(3)
        sys.exit(f"no verdict within {timeout_s}s; check the gate's log")


def push_patch(clone: Path, base: str, patch: Path, branch: str, msg: str) -> str:
    git("checkout", "-q", "-B", branch, base, cwd=clone)
    git("apply", "--index", str(patch), cwd=clone)
    git("commit", "-q", "-m", msg, cwd=clone)
    git("push", "-q", "-f", "origin", f"HEAD:refs/heads/{branch}", cwd=clone)
    return git("rev-parse", "HEAD", cwd=clone)


def push_attack(clone: Path, src: Path, incident: str) -> str:
    branch = f"attack/{incident}"
    git("checkout", "-q", "-B", branch, "origin/main", cwd=clone)
    dest = clone / "attacks" / incident
    shutil.rmtree(dest, ignore_errors=True)
    shutil.copytree(src, dest)
    git("add", "attacks", cwd=clone)
    git("commit", "-q", "-m", f"[scripted] hostile tests for {incident}", cwd=clone)
    git("push", "-q", "-f", "origin", f"HEAD:refs/heads/{branch}", cwd=clone)
    return git("rev-parse", "HEAD", cwd=clone)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--incident", required=True)
    ap.add_argument("--room", required=True, help="room / channel display name, e.g. firedrill-idempotency-race")
    ap.add_argument("--approve", action="store_true", help="post APPROVE automatically after GREEN")
    ap.add_argument("--timeout", type=int, default=900)
    a = ap.parse_args()
    load_dotenv(ROOT / ".env")
    e = os.environ
    scripted = ROOT / "demo" / "scripted" / a.incident
    naive, attack, good = scripted / "naive.patch", scripted / "attack", scripted / "fix.patch"
    for p in (naive, attack, good):
        if not p.exists():
            sys.exit(f"missing {p.relative_to(ROOT)} (Codex lane: demo/scripted/)")

    gate = e.get("FIREDRILL_GATE_NAME", "firedrill-gate")
    mm = Mattermost(
        f"http://localhost:{e.get('MATTERMOST_HOST_PORT', '8065')}",
        e.get("MATTERMOST_USER", "user"),
        e.get("MATTERMOST_USER_PASSWORD", ""),
        e.get("MATTERMOST_TEAM_NAME", "switch"),
    )
    channel = mm.channel(a.room)

    with tempfile.TemporaryDirectory() as tmp:
        clone = Path(tmp) / "evidence"
        subprocess.run(["git", "clone", "-q", e.get("FIREDRILL_EVIDENCE_REMOTE", "/tmp/firedrill/evidence.git"), str(clone)], check=True)
        fix_branch = f"fix/{a.incident}"

        sha = push_patch(clone, "origin/main", naive, fix_branch, f"[scripted] naive hotfix for {a.incident}")
        t = mm.post(channel, f"@{gate} SUBMIT {fix_branch} {sha}")
        print("naive fix submitted:", sha[:12], "->", mm.wait_verdict(channel, t, a.incident, a.timeout))

        asha = push_attack(clone, attack, a.incident)
        t = mm.post(channel, f"@{gate} ATTACK attack/{a.incident} {asha}")
        print("attack submitted:", asha[:12], "->", mm.wait_verdict(channel, t, a.incident, a.timeout))

        git("fetch", "-q", "origin", cwd=clone)
        sha2 = push_patch(clone, "origin/main", good, fix_branch, f"[scripted] root-cause fix for {a.incident}")
        t = mm.post(channel, f"@{gate} SUBMIT {fix_branch} {sha2}")
        vid, result = mm.wait_verdict(channel, t, a.incident, a.timeout)
        print("real fix submitted:", sha2[:12], "->", (vid, result))

    if result != "GREEN":
        sys.exit(f"{vid} is {result}; not approving")
    line = f"@{gate} APPROVE {vid}"
    if a.approve:
        mm.post(channel, line)
        print("approved:", line)
    else:
        print(f"\nNow type this in Mattermost as an approver:\n  {line}")


if __name__ == "__main__":
    main()
