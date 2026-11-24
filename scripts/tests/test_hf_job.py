"""scripts/hf_job.sh: the per-sample deadlines, run in bash as the job runs them."""
import shutil
import subprocess
from pathlib import Path

import pytest

JOB = Path(__file__).resolve().parents[1] / "hf_job.sh"


def deadline_lines() -> list[str]:
    return [ln.strip() for ln in JOB.read_text().splitlines() if '[[ "$S" = lorem-500 ]]' in ln and "T=" in ln]


@pytest.mark.skipif(not shutil.which("bash"), reason="needs bash")
def test_every_sample_step_outlasts_three_timed_out_attempts_of_one_engine():
    # Outside review (codex, 2026-11-23): the retake kept the 30-minute deadline in a 15-minute step,
    # so three timed-out attempts were killed (after 60 minutes) before the results were written.
    lines = deadline_lines()
    assert len(lines) == 2, lines  # the full pass (editors) and the retake
    for line in lines:
        for s in ("showcase", "redline", "lorem-500"):
            out = subprocess.run(["bash", "-c", f'OD_TIMEOUT_S=1800; S={s}; {line}; echo "$T $OD_TIMEOUT_S"'],
                                 capture_output=True, text=True, check=True).stdout.split()
            t, per_attempt = int(out[0]), int(out[1])
            # WAIT_MIN is the step's budget for waiting on a busy host, spent before or between runs;
            # when it is all spent, the three attempts have only T left (CodeRabbit on #98).
            assert 3 * per_attempt <= t * 60, (line, s, t, per_attempt)
            assert per_attempt == (1800 if s == "lorem-500" else 600), (line, s, per_attempt)
