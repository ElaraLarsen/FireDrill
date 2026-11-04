"""gate.verify must not leak the host's paths into verdicts (they end up in recordings and the UI)."""

from __future__ import annotations

from pathlib import Path

import pytest

from gate.verify import ROOT, _scrub


@pytest.mark.parametrize(
    "raw, expected",
    [
        ('File "/var/folders/ab/cd123/T/firedrill-check-xyz/app/x.py", line 3', 'File "<workspace>/app/x.py", line 3'),
        ("C:\\Users\\Someone\\AppData\\Local\\Temp\\firedrill-check-9\\app.py", "<tmp>\\firedrill-check-9\\app.py"),
        ("C:\\Users\\Someone\\Documents\\lab\\app.py:1", "<home>\\Documents\\lab\\app.py:1"),
        ("C:/Users/Someone/lab/app.py", "<home>/lab/app.py"),
        ("/Users/someone/lab/app.py", "<home>/lab/app.py"),
        ("/home/runner/work/lab/app.py", "<home>/work/lab/app.py"),
        ("/tmp/firedrill/evidence.git", "<tmp>/firedrill/evidence.git"),
        ("nothing host specific: checks/repro_test.py:24", "nothing host specific: checks/repro_test.py:24"),
    ],
)
def test_scrub_replaces_host_paths(raw: str, expected: str) -> None:
    assert _scrub(raw, Path("/var/folders/ab/cd123/T/firedrill-check-xyz")) == expected


def test_scrub_replaces_the_repo_and_interpreter_roots() -> None:
    out = _scrub(f"{ROOT}/gate/verify.py and {ROOT}/incident-lab/app/main.py")
    assert str(ROOT) not in out and out.startswith("<repo>/gate/verify.py")
