from __future__ import annotations

import os
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
GIT_ID = {
    "GIT_AUTHOR_NAME": "test", "GIT_AUTHOR_EMAIL": "t@example.com",
    "GIT_COMMITTER_NAME": "test", "GIT_COMMITTER_EMAIL": "t@example.com",
    "GIT_CONFIG_GLOBAL": "/dev/null",  # no signing, no user config in tests
}


def git(*args: str, cwd: Path, env: dict[str, str] | None = None, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *args], cwd=cwd, text=True, capture_output=True, check=check,
        env={**os.environ, **GIT_ID, **(env or {})},
    )


@pytest.fixture(autouse=True)
def telemetry_state(tmp_path_factory: pytest.TempPathFactory, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Keep gate.telemetry's JSONL out of the repo's gate/state during tests."""
    d = tmp_path_factory.mktemp("telemetry-state")
    monkeypatch.setenv("FIREDRILL_STATE_DIR", str(d))
    return d


@pytest.fixture
def evidence(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> dict[str, object]:
    """A real lab repo + evidence remote built by scripts/bootstrap_evidence.sh."""
    for k, v in GIT_ID.items():
        monkeypatch.setenv(k, v)
    lab = tmp_path / "lab"
    lab.mkdir()
    git("init", "-q", "-b", "main", cwd=lab)
    (lab / "incidents" / "idempotency-race").mkdir(parents=True)
    (lab / "incidents" / "idempotency-race" / "brief.md").write_text("Double charges under concurrent retries.\n")
    (lab / "app.py").write_text("BUG = True\n")
    git("add", ".", cwd=lab)
    git("commit", "-q", "-m", "lab", cwd=lab)
    return build_evidence(tmp_path, lab)


def build_evidence(tmp_path: Path, lab: Path) -> dict[str, object]:
    """Run scripts/bootstrap_evidence.sh against `lab` (a git repo) and clone a working copy of the result."""
    env_file = tmp_path / "test.env"
    remote = tmp_path / "evidence.git"
    keyhash = tmp_path / "gate.keyhash"
    env_file.write_text(f"FIREDRILL_EVIDENCE_REMOTE={remote}\nFIREDRILL_KEYHASH_FILE={keyhash}\nFIREDRILL_GATE_KEY=\n")
    out = subprocess.run(
        ["bash", str(ROOT / "scripts" / "bootstrap_evidence.sh"), str(lab)],
        text=True, capture_output=True, env={**os.environ, **GIT_ID, "FIREDRILL_ENV_FILE": str(env_file)},
    )
    assert out.returncode == 0, out.stderr
    key = next(l.split("=", 1)[1] for l in env_file.read_text().splitlines() if l.startswith("FIREDRILL_GATE_KEY="))
    work = tmp_path / "dev"
    git("clone", "-q", str(remote), str(work), cwd=tmp_path)
    return {"remote": remote, "keyhash": keyhash, "key": key, "work": work, "tmp": tmp_path, "bootstrap_out": out.stdout}
