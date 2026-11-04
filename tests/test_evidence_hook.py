"""The evidence remote's update hook, exercised with real git pushes."""

from __future__ import annotations

from pathlib import Path

from conftest import git


def commit(work: Path, name: str, branch: str, base: str = "origin/main") -> str:
    git("checkout", "-q", "-B", branch, base, cwd=work)
    (work / name).write_text(name)
    git("add", name, cwd=work)
    git("commit", "-q", "-m", name, cwd=work)
    return git("rev-parse", "HEAD", cwd=work).stdout.strip()


def test_fix_and_attack_branches_are_open(evidence):
    work = evidence["work"]
    commit(work, "f", "fix/idempotency-race")
    assert git("push", "-q", "origin", "HEAD:refs/heads/fix/idempotency-race", cwd=work, check=False).returncode == 0
    commit(work, "a", "attack/idempotency-race")
    assert git("push", "-q", "origin", "HEAD:refs/heads/attack/idempotency-race", cwd=work, check=False).returncode == 0


def test_main_rejected_without_key(evidence):
    work = evidence["work"]
    commit(work, "x", "main")
    r = git("push", "origin", "HEAD:refs/heads/main", cwd=work, check=False)
    assert r.returncode != 0
    assert "only firedrill-gate may update main" in r.stderr


def test_main_rejected_with_wrong_key(evidence):
    work = evidence["work"]
    commit(work, "x", "main")
    r = git("push", "origin", "HEAD:refs/heads/main", cwd=work, env={"FIREDRILL_GATE_KEY": "nope"}, check=False)
    assert r.returncode != 0 and "bad key" in r.stderr


def test_pusher_cannot_swap_the_keyhash_file(evidence):
    import hashlib

    work = evidence["work"]
    commit(work, "x", "main")
    fake = evidence["tmp"] / "fake.keyhash"
    fake.write_text(hashlib.sha256(b"mine").hexdigest())
    r = git(
        "push", "origin", "HEAD:refs/heads/main", cwd=work, check=False,
        env={"FIREDRILL_GATE_KEY": "mine", "FIREDRILL_KEYHASH_FILE": str(fake)},
    )
    assert r.returncode != 0 and "bad key" in r.stderr


def test_main_accepted_with_gate_key(evidence):
    work = evidence["work"]
    sha = commit(work, "x", "main")
    r = git("push", "origin", "HEAD:refs/heads/main", cwd=work, env={"FIREDRILL_GATE_KEY": evidence["key"]}, check=False)
    assert r.returncode == 0, r.stderr
    assert git("rev-parse", "main", cwd=evidence["remote"]).stdout.strip() == sha


def test_main_non_fast_forward_and_delete_rejected(evidence):
    work = evidence["work"]
    key = {"FIREDRILL_GATE_KEY": evidence["key"]}
    git("fetch", "-q", "origin", cwd=work)
    root = git("rev-list", "--max-parents=0", "origin/main", cwd=work).stdout.strip()
    git("checkout", "-q", "--orphan", "rogue", cwd=work)
    (work / "rogue").write_text("r")
    git("add", "rogue", cwd=work)
    git("commit", "-q", "-m", "rogue", cwd=work)
    r = git("push", "-f", "origin", "HEAD:refs/heads/main", cwd=work, env=key, check=False)
    assert r.returncode != 0 and "non-fast-forward" in r.stderr
    r = git("push", "origin", ":refs/heads/main", cwd=work, env=key, check=False)
    assert r.returncode != 0
    assert git("rev-list", "--max-parents=0", "main", cwd=evidence["remote"]).stdout.strip() == root


def test_other_refs_rejected(evidence):
    work = evidence["work"]
    commit(work, "o", "feature/x")
    r = git("push", "origin", "HEAD:refs/heads/feature/x", cwd=work, check=False)
    assert r.returncode != 0 and "only fix/* and attack/*" in r.stderr


def test_bootstrap_is_idempotent(evidence, monkeypatch):
    import os
    import subprocess

    from conftest import GIT_ID, ROOT

    env_file = evidence["tmp"] / "test.env"
    before = env_file.read_text()
    out = subprocess.run(
        ["bash", str(ROOT / "scripts" / "bootstrap_evidence.sh")],
        text=True, capture_output=True, env={**os.environ, **GIT_ID, "FIREDRILL_ENV_FILE": str(env_file)},
    )
    assert out.returncode == 0, out.stderr
    assert "kept existing" in out.stdout
    assert env_file.read_text() == before  # same key kept
