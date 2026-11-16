"""uv run --with pytest pytest scripts/tests"""
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import measure_lib as lib  # noqa: E402


def test_pkill_pattern_is_delimited_so_it_is_not_read_as_an_option():
    """`pkill -f --user-data-dir=…` exits 2 ("illegal option") on macOS and procps: nothing is killed."""
    assert lib.pkill_args("/tmp/p")[:3] == ["pkill", "-f", "--"]
    undelimited = subprocess.run(["pkill", "-f", "--user-data-dir=/nonexistent-od-test"], capture_output=True)
    assert undelimited.returncode == 2
    # Delimited: 1 = it ran and matched nothing, which is not a failure to report.
    assert lib.end_chrome("/nonexistent-od-test") is None


def test_end_chrome_reports_a_pkill_that_could_not_run(monkeypatch):
    monkeypatch.setattr(lib.subprocess, "run", lambda *a, **k: subprocess.CompletedProcess(a, 3, b"", b"boom"))
    assert "pkill exited 3" in lib.end_chrome("/tmp/p")


def test_sample_row_keeps_an_error_that_came_after_the_load_was_timed():
    """A run with loadMs AND an error (metrics timed out) is a loaded run whose reading is incomplete."""
    xs = [{"loadMs": 100, "rendererRssReady": 10, "rendererRss": 30, "error": "TimeoutError: Performance.getMetrics"}]
    row = lib.sample_row(xs)
    assert row["loadMs"] == 100
    assert row["failed"] is None  # it did open
    assert row["incomplete"] == "TimeoutError: Performance.getMetrics"
    assert row["heapBytes"] is None  # the missing metric is null, not a crash


def test_sample_row_failed_is_the_reason_a_run_did_not_load():
    row = lib.sample_row([{"error": "not ready within 300s"}, {"loadMs": 50}])
    assert row["failed"] == "not ready within 300s"
    assert row["incomplete"] is None
    assert row["runs"] == [None, 50]


def test_memory_growth_is_the_median_of_each_runs_own_difference():
    """Medians of before and after are different runs' readings; their difference is not a run's growth."""
    xs = [
        {"loadMs": 1, "rendererRssReady": 100, "rendererRss": 110},
        {"loadMs": 1, "rendererRssReady": 300, "rendererRss": 316},
        {"loadMs": 1, "rendererRssReady": 200, "rendererRss": 290},
    ]
    row = lib.sample_row(xs)
    assert row["rendererRss"] - row["rendererRssReady"] == 90  # what the page used to print
    assert row["rendererGrowth"] == 16


def test_settle_timeout_is_kept_when_any_run_never_went_quiet():
    row = lib.sample_row([{"loadMs": 10, "settleTimedOut": True}, {"loadMs": 10, "settledMs": 40}])
    assert row["settledMs"] == 40
    assert row["settleTimedOut"] == 1


def test_merge_stamps_each_row_with_the_run_that_measured_it():
    old = {"measuredAt": "2026-11-15", "environment": "Darwin arm64", "base": "https://x",
           "samples": {"redline": {"folio": {"loadMs": 1}, "plate": {"loadMs": 2}}}}
    new_meta = {"measuredAt": "2026-11-20", "environment": "Linux x86_64", "base": "https://x"}
    out = lib.merge_latest(old, {"redline": {"plate": {"loadMs": 3}}}, new_meta)
    rows = out["samples"]["redline"]
    assert rows["plate"]["loadMs"] == 3 and rows["plate"]["measuredAt"] == "2026-11-20" and rows["plate"]["environment"] == "Linux x86_64"
    # The row that was not re-measured keeps the provenance it was published under.
    assert rows["folio"]["measuredAt"] == "2026-11-15" and rows["folio"]["environment"] == "Darwin arm64"
    assert out["measuredAt"] == "2026-11-20"


def test_a_rejected_lighthouse_report_carries_no_scores():
    challenge = {"lighthouseVersion": "13", "finalDisplayedUrl": "https://x/cdn-cgi/challenge-platform",
                 "categories": {"performance": {"score": 1}}, "audits": {"largest-contentful-paint": {"numericValue": 10}}}
    s = lib.summarize(challenge)
    assert "Cloudflare challenge" in s["error"]
    assert "performance" not in s and "lcpMs" not in s
    hung = lib.summarize({"runtimeError": {"code": "PAGE_HUNG", "message": "x"}, "categories": {"performance": {"score": 0.3}}})
    assert hung["error"].startswith("PAGE_HUNG") and "performance" not in hung
    ok = lib.summarize({"categories": {"performance": {"score": 0.4}}, "audits": {"cumulative-layout-shift": {"numericValue": 0.12345}}})
    assert ok["performance"] == 40 and ok["cls"] == 0.123 and "error" not in ok


def test_a_challenge_score_does_not_enter_the_median():
    xs = [{"desktop": {"performance": 40}, "mobile": {"performance": 30}},
          {"desktop": lib.summarize({"finalUrl": "https://x/challenge", "categories": {"performance": {"score": 1}}}), "mobile": {"performance": 32}}]
    e = lib.page_entry(xs, limit_s=240)
    assert e["desktop"]["performance"] == 40
    assert e["desktop"]["performanceRuns"] == [40, None]
    assert "challenge" in e["desktop"]["error"]
    assert e["mobile"]["performance"] == 31 and e["mobile"]["error"] is None


def test_a_form_factor_that_never_arrived_has_its_own_error():
    e = lib.page_entry([{"desktop": {"performance": 90}}], limit_s=240)
    assert e["desktop"]["error"] is None
    assert e["mobile"]["performance"] is None
    assert "no mobile result within 240 s" in e["mobile"]["error"]


def test_a_labelled_population_keeps_its_own_provenance():
    result = {"measuredAt": "2026-11-10", "environment": "Lighthouse 13.5, 3 analyses", "base": "https://x", "pages": {"e/folio": {}}}
    meta = {"measuredAt": "2026-11-16", "environment": "Lighthouse 13.6, 1 analyses", "base": "https://x"}
    out = lib.merge_pagespeed(result, {"e/folio": {"desktop": {}}}, "lorem-500", meta)
    assert out["measuredAt"] == "2026-11-10"  # the blank-page table was not re-measured
    assert out["docsMeta"]["lorem-500"] == meta
    assert out["docs"]["lorem-500"]["e/folio"] == {"desktop": {}}
    out = lib.merge_pagespeed(out, {"e/folio": {"mobile": {}}}, None, meta)
    assert out["measuredAt"] == "2026-11-16" and out["pages"]["e/folio"] == {"mobile": {}}
    assert out["docsMeta"]["lorem-500"] == meta


def test_lorem_options_do_not_become_the_output_path():
    a = lib.lorem_args(["--chapters", "2"])
    assert a.out is None and a.chapters == 2 and a.words == 4450
    a = lib.lorem_args(["out.docx", "--words", "1000"])
    assert a.out == "out.docx" and a.words == 1000 and a.chapters == 50
