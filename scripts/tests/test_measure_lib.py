"""uv run --with pytest pytest scripts/tests"""
import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import measure_lib as lib  # noqa: E402 - sys.path is set above so the sibling module imports


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
    assert out["docs"]["lorem-500"]["e/folio"] == {"desktop": {}, **meta}
    out = lib.merge_pagespeed(out, {"e/folio": {"mobile": {}}}, None, meta)
    assert out["measuredAt"] == "2026-11-16" and out["pages"]["e/folio"] == {"mobile": {}, **meta}
    assert out["docsMeta"]["lorem-500"] == meta


def test_lorem_options_do_not_become_the_output_path():
    a = lib.lorem_args(["--chapters", "2"])
    assert a.out is None and a.chapters == 2 and a.words == 4450
    a = lib.lorem_args(["out.docx", "--words", "1000"])
    assert a.out == "out.docx" and a.words == 1000 and a.chapters == 50


def test_merge_stamps_the_base_url_too():
    old = {"measuredAt": "2026-11-15", "environment": "Darwin", "base": "https://old", "samples": {"redline": {"folio": {"loadMs": 1}}}}
    out = lib.merge_latest(old, {"redline": {"plate": {"loadMs": 3}}}, {"measuredAt": "2026-11-20", "environment": "Linux", "base": "https://new"})
    assert out["samples"]["redline"]["folio"]["base"] == "https://old"
    assert out["samples"]["redline"]["plate"]["base"] == "https://new"


def test_a_partial_pagespeed_rerun_does_not_redate_the_pages_it_did_not_measure():
    old = {"measuredAt": "2026-11-10", "environment": "Lighthouse 13.5", "base": "https://x",
           "pages": {"e/folio": {"desktop": {}}, "e/plate": {"desktop": {}}},
           "docs": {"lorem-500": {"e/folio": {"desktop": {}}, "e/plate": {"desktop": {}}}},
           "docsMeta": {"lorem-500": {"measuredAt": "2026-11-12", "environment": "Lighthouse 13.5b", "base": "https://x"}}}
    meta = {"measuredAt": "2026-11-16", "environment": "Lighthouse 13.6", "base": "https://x"}
    out = lib.merge_pagespeed(old, {"e/plate": {"mobile": {}}}, None, meta)
    assert out["pages"]["e/plate"]["measuredAt"] == "2026-11-16" and out["pages"]["e/plate"]["environment"] == "Lighthouse 13.6"
    assert out["pages"]["e/folio"]["measuredAt"] == "2026-11-10" and out["pages"]["e/folio"]["environment"] == "Lighthouse 13.5"
    out = lib.merge_pagespeed(out, {"e/plate": {"mobile": {}}}, "lorem-500", meta)
    rows = out["docs"]["lorem-500"]
    assert rows["e/plate"]["measuredAt"] == "2026-11-16"
    assert rows["e/folio"]["measuredAt"] == "2026-11-12" and rows["e/folio"]["environment"] == "Lighthouse 13.5b"


def test_end_chrome_reports_a_chrome_that_survives_the_signal(monkeypatch):
    calls = []

    def run(args, **k):
        calls.append(args[0])
        return subprocess.CompletedProcess(args, 0, b"123\n", b"")  # pkill: signalled; pgrep: still there

    monkeypatch.setattr(lib.subprocess, "run", run)
    monkeypatch.setattr(lib.time, "sleep", lambda s: None)
    left = lib.end_chrome("/tmp/p", wait_s=0.3)
    assert "still running" in left and "pgrep" in calls


def test_end_chrome_is_quiet_once_the_process_is_gone(monkeypatch):
    seen = {"n": 0}

    def run(args, **k):
        if args[0] == "pkill":
            return subprocess.CompletedProcess(args, 0, b"", b"")
        seen["n"] += 1
        return subprocess.CompletedProcess(args, 0 if seen["n"] < 2 else 1, b"", b"")  # gone on the second look

    monkeypatch.setattr(lib.subprocess, "run", run)
    monkeypatch.setattr(lib.time, "sleep", lambda s: None)
    assert lib.end_chrome("/tmp/p", wait_s=5) is None


def test_every_run_can_say_how_busy_the_machine_was():
    m = lib.machine_load()
    assert m["cores"] >= 1 and m["load1"] >= 0
    assert lib.load_note([{"load1": 2.0, "cores": 12}, {"load1": 9.5, "cores": 12}, {"load1": 3.0, "cores": 12}]) == "machine load (1-minute average) median 3.0, highest 9.5, on 12 cores"
    assert lib.load_note([{"engine": "folio"}]) == ""


def test_the_heading_says_how_many_runs_were_really_made():
    full = [{"engine": e, "sample": "redline"} for e in ("a", "b") for _ in range(3)]
    assert lib.runs_note(3, full) == "3 runs"
    assert lib.runs_note(3, full[:4]) == "1 to 3 runs (3 asked; the measuring stopped early)"
    assert lib.runs_note(3, full[:3]) == "3 runs"
    assert lib.runs_note(3, [full[0], full[3]]) == "1 runs (3 asked; the measuring stopped early)"


def test_pagespeed_options_are_parsed_before_anything_runs():
    a = lib.pagespeed_args(["https://x.example", "e/folio,e/plate", "3", "--query", "open=a.docx", "--label", "lorem-500", "--out", "o.json"])
    assert (a.base, a.pages, a.runs, a.query, a.label, a.out) == ("https://x.example", "e/folio,e/plate", 3, "open=a.docx", "lorem-500", "o.json")
    for bad in ([], ["https://x.example"], ["https://x.example", "e/folio", "0"], ["https://x.example", "e/folio", "3", "--out"]):
        with pytest.raises(SystemExit):
            lib.pagespeed_args(bad)


def test_the_heading_names_the_chrome_version_the_runs_recorded():
    assert lib.chrome_note([{"chrome": "Chrome/157.0.8103.79"}, {"chrome": "Chrome/157.0.8103.79"}, {"engine": "x"}]) == "Google Chrome 157.0.8103.79"
    assert lib.chrome_note([{"chrome": "Chrome/157.0.1.2"}, {"chrome": "Chrome/158.0.0.1"}]) == "Google Chrome 157.0.1.2 and 158.0.0.1"
    assert lib.chrome_note([{"engine": "x"}]) == "Google Chrome"
    assert lib.chrome_note([{"chrome": "HeadlessChrome/141.0.7390.66"}]) == "Google Chrome headless 141.0.7390.66"


def test_pagespeed_refusing_an_address_is_told_apart_from_a_page_that_never_loaded():
    said = "PageSpeed Insights\nUnable to resolve https://x.example/r/a?src=https://h/f.docx. Try checking the URL for validity.\nAnalyze"
    assert lib.psi_refusal(said).startswith("PageSpeed refused the address: Unable to resolve https://x.example")
    assert lib.psi_refusal("Performance\n77\nFirst Contentful Paint") is None


def test_a_report_of_a_page_whose_engine_failed_has_no_score():
    report = {"lighthouseVersion": "13", "categories": {"performance": {"score": 1}},
              "audits": {"errors-in-console": {"details": {"items": [
                  {"description": "Failed to load resource: 404"},
                  {"description": "[open-docs] WordCraft failed to start TypeError: Failed to fetch"}]}}}}
    got = lib.summarize(report)
    assert "performance" not in got and "WordCraft failed to start" in got["error"]
    report["audits"]["errors-in-console"]["details"]["items"].pop()
    assert lib.summarize(report)["performance"] == 100  # another site's 404 is not the engine failing


def test_a_page_whose_engine_failed_in_most_analyses_publishes_no_score():
    failed = {"error": lib.ENGINE_FAILED + ": [open-docs] X failed to start"}
    ok = {"performance": 86, "lcpMs": 200}
    xs = [{"desktop": failed, "mobile": failed}, {"desktop": ok, "mobile": failed}, {"desktop": failed, "mobile": failed}]
    e = lib.page_entry(xs, 240)
    assert e["desktop"]["performance"] is None and e["desktop"]["performanceRuns"] == [None, None, None]
    assert e["desktop"]["error"].startswith(lib.ENGINE_FAILED)
    mostly_fine = lib.page_entry([{"desktop": ok}, {"desktop": ok}, {"desktop": failed}], 240)
    assert mostly_fine["desktop"]["performance"] == 86


def test_a_default_table_rerun_does_not_redate_a_legacy_labelled_population():
    """A file from before docsMeta: its 500-page rows were published under the root heading of that day."""
    result = {"measuredAt": "2026-11-10", "environment": "old", "base": "b",
              "pages": {"e/a": {"desktop": {}}}, "docs": {"lorem-500": {"e/a": {"desktop": {}}, "e/b": {"desktop": {}}}}}
    lib.merge_pagespeed(result, {"e/a": {"desktop": {}}}, None, {"measuredAt": "2026-11-16", "environment": "new", "base": "b"})
    assert result["measuredAt"] == "2026-11-16"
    assert result["docsMeta"]["lorem-500"]["measuredAt"] == "2026-11-10"
    lib.merge_pagespeed(result, {"e/a": {"desktop": {}}}, "lorem-500", {"measuredAt": "2026-11-17", "environment": "newer", "base": "b"})
    assert result["docs"]["lorem-500"]["e/b"]["measuredAt"] == "2026-11-10"  # untouched: still the day it was measured
    assert result["docs"]["lorem-500"]["e/a"]["measuredAt"] == "2026-11-17"


def test_end_chrome_reports_a_pgrep_that_could_not_run(monkeypatch):
    """pgrep exits 1 for no match and 2 or 3 for an error: an error is not proof that Chrome went."""

    def run(args, **k):
        if args[0] == "pkill":
            return subprocess.CompletedProcess(args, 0, b"", b"")
        return subprocess.CompletedProcess(args, 3, b"", b"cannot read the process table")

    monkeypatch.setattr(lib.subprocess, "run", run)
    monkeypatch.setattr(lib.time, "sleep", lambda s: None)
    left = lib.end_chrome("/tmp/p", wait_s=5)
    assert "pgrep exited 3" in left and "cannot read the process table" in left
