"""Git side of the gate: fetch submissions from the evidence remote and merge.

The gate keeps one working clone per room under the state dir. Submissions are
checked out as detached worktrees, so a fix and an attack never share a tree
and the verify engine gets clean, read-only-able directories.

Only this module pushes to main, and only with FIREDRILL_GATE_KEY in the push
environment, which the evidence remote's `update` hook checks.
"""

from __future__ import annotations

import asyncio
import os
import re
import shutil
from dataclasses import dataclass
from pathlib import Path

SHA_RE = re.compile(r"^[0-9a-f]{7,40}$")
BRANCH_RE = re.compile(r"^(fix|attack)/[a-z0-9][a-z0-9-]*$")


class MergeError(RuntimeError):
    """A git step the gate refuses or failed; the message is room-safe."""


@dataclass(frozen=True)
class Checkout:
    branch: str
    sha: str  # full sha
    path: Path


async def _git(*args: str, cwd: Path | None = None, env: dict[str, str] | None = None) -> str:
    proc = await asyncio.create_subprocess_exec(
        "git",
        *args,
        cwd=str(cwd) if cwd else None,
        env={**os.environ, "GIT_TERMINAL_PROMPT": "0", **(env or {})},
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    out, err = await proc.communicate()
    if proc.returncode != 0:
        raise MergeError(
            f"git {' '.join(args[:2])} failed: {err.decode(errors='replace').strip()[-400:]}"
        )
    return out.decode().strip()


class Merger:
    def __init__(
        self,
        evidence_remote: str,
        work_root: Path,
        gate_key: str,
        author_name: str = "firedrill-gate",
        author_email: str = "firedrill-gate@localhost",
    ) -> None:
        self.remote = evidence_remote
        self.work_root = work_root
        self.gate_key = gate_key
        self.ident = {
            "GIT_AUTHOR_NAME": author_name,
            "GIT_AUTHOR_EMAIL": author_email,
            "GIT_COMMITTER_NAME": author_name,
            "GIT_COMMITTER_EMAIL": author_email,
        }
        self._lock = asyncio.Lock()

    def _clone_dir(self, room_id: str) -> Path:
        return self.work_root / _safe(room_id) / "clone"

    async def _ensure_clone(self, room_id: str) -> Path:
        clone = self._clone_dir(room_id)
        if not (clone / ".git").exists():
            clone.parent.mkdir(parents=True, exist_ok=True)
            await _git("clone", "-q", self.remote, str(clone))
        await _git("fetch", "-q", "--prune", "origin", cwd=clone)
        return clone

    async def branch_head(self, room_id: str, branch: str) -> str:
        """The full sha the evidence remote has for `branch` right now."""
        _check_branch(branch)
        clone = await self._ensure_clone(room_id)
        try:
            return await _git("rev-parse", f"refs/remotes/origin/{branch}", cwd=clone)
        except MergeError as e:
            raise MergeError(f"branch {branch} is not on the evidence remote") from e

    async def checkout(self, room_id: str, branch: str, sha: str) -> Checkout:
        """Check out `sha`, which must be the current head of `branch`."""
        _check_branch(branch)
        if not SHA_RE.match(sha):
            raise MergeError(f"'{sha}' is not a commit sha")
        async with self._lock:
            head = await self.branch_head(room_id, branch)
            if not head.startswith(sha):
                raise MergeError(
                    f"{sha} is not the head of {branch} (head is {head[:12]}); push first, then submit the head"
                )
            clone = self._clone_dir(room_id)
            path = self.work_root / _safe(room_id) / "trees" / f"{branch.replace('/', '-')}-{head[:12]}"
            if not path.exists():
                path.parent.mkdir(parents=True, exist_ok=True)
                await _git("worktree", "add", "-q", "--detach", str(path), head, cwd=clone)
            return Checkout(branch=branch, sha=head, path=path)

    async def diff_stat(self, room_id: str, sha: str) -> dict:
        """What `sha` changes relative to main: {files, insertions, deletions, names}."""
        if not SHA_RE.match(sha):
            raise MergeError(f"'{sha}' is not a commit sha")
        async with self._lock:
            clone = self._clone_dir(room_id)
            out = await _git("diff", "--numstat", f"refs/remotes/origin/main...{sha}", cwd=clone)
        names: list[str] = []
        ins = dele = 0
        for line in out.splitlines():
            a, _, rest = line.partition("\t")
            d, _, name = rest.partition("\t")
            ins += int(a) if a.isdigit() else 0  # "-" for binary files
            dele += int(d) if d.isdigit() else 0
            names.append(name)
        return {"files": len(names), "insertions": ins, "deletions": dele, "names": names[:8]}

    async def main_checkout(self, room_id: str) -> Checkout:
        async with self._lock:
            clone = await self._ensure_clone(room_id)
            head = await _git("rev-parse", "refs/remotes/origin/main", cwd=clone)
            path = self.work_root / _safe(room_id) / "trees" / f"main-{head[:12]}"
            if not path.exists():
                path.parent.mkdir(parents=True, exist_ok=True)
                await _git("worktree", "add", "-q", "--detach", str(path), head, cwd=clone)
            return Checkout(branch="main", sha=head, path=path)

    async def merge_to_main(self, room_id: str, fix_sha: str, verdict_id: str, approver: str) -> str:
        """Merge `fix_sha` into main and push it. Returns the new main sha."""
        async with self._lock:
            clone = await self._ensure_clone(room_id)
            await _git("checkout", "-q", "-B", "main", "refs/remotes/origin/main", cwd=clone)
            await _git(
                "merge",
                "--no-ff",
                "-m",
                f"FireDrill: merge {verdict_id}\n\nVerdict {verdict_id} GREEN; signed off by {approver}.",
                fix_sha,
                cwd=clone,
                env=self.ident,
            )
            merged = await _git("rev-parse", "HEAD", cwd=clone)
            await _git("push", "-q", "origin", "main", cwd=clone, env={"FIREDRILL_GATE_KEY": self.gate_key})
            return merged

    async def cleanup(self, room_id: str) -> None:
        shutil.rmtree(self.work_root / _safe(room_id) / "trees", ignore_errors=True)
        clone = self._clone_dir(room_id)
        if clone.exists():
            await _git("worktree", "prune", cwd=clone)


def _check_branch(branch: str) -> None:
    if branch != "main" and not BRANCH_RE.match(branch):
        raise MergeError(f"'{branch}' is not a fix/<incident> or attack/<incident> branch")


def _safe(room_id: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]", "_", room_id)
