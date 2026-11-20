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


def test_a_malformed_report_is_summarised_not_thrown():
    """A thrown summary was swallowed by the caller, and the analysis then read as 'no result within 240 s'."""
    for audits in (None, [], {"errors-in-console": None}, {"errors-in-console": {"details": {"items": None}}},
                   {"errors-in-console": {"details": {"items": {"a": 1}}}}, {"errors-in-console": {"details": {"items": ["text", 3, None]}}}):
        out = lib.summarize({"lighthouseVersion": "13", "audits": audits, "categories": {"performance": {"score": 0.5}}})
        assert out.get("performance") == 50 and "error" not in out, audits


def test_only_this_sites_own_console_line_marks_an_engine_failure():
    report = lambda text: {"audits": {"errors-in-console": {"details": {"items": [{"description": text}]}}}, "categories": {"performance": {"score": 1}}}  # noqa: E731 - a one-line fixture
    assert lib.summarize(report("[open-docs] WordCraft failed to start"))["error"].startswith(lib.ENGINE_FAILED)
    assert lib.summarize(report("  [open-docs-viewer] TypeError: Failed to fetch"))["error"].startswith(lib.ENGINE_FAILED)
    for other in ("[open-docs-evil] something", "[open-docsx] y", "a library said [open-docs] in passing"):
        assert lib.summarize(report(other)).get("performance") == 100, other


def test_a_partial_rerun_keeps_the_heading_of_the_run_that_measured_the_table():
    five = {"measuredAt": "2026-11-16", "environment": "5 analyses", "base": "b"}
    two = {"measuredAt": "2026-11-16", "environment": "2 analyses", "base": "b"}
    out = lib.merge_pagespeed({"pages": {}}, {"e/folio": {}, "e/plate": {}}, "lorem-500", five)
    out = lib.merge_pagespeed(out, {"e/plate": {}}, "lorem-500", two)
    assert out["docsMeta"]["lorem-500"]["environment"] == "5 analyses"
    assert out["docs"]["lorem-500"]["e/plate"]["environment"] == "2 analyses"
    root = lib.merge_pagespeed({"pages": {}}, {"e/a": {}, "e/b": {}}, None, five)
    root = lib.merge_pagespeed(root, {"e/a": {}}, None, two)
    assert root["environment"] == "5 analyses" and root["pages"]["e/a"]["environment"] == "2 analyses"
    assert lib.merge_pagespeed(root, {"e/a": {}, "e/b": {}}, None, two)["environment"] == "2 analyses"


def test_end_chrome_looks_for_the_process_even_when_pkill_says_it_matched_nothing(monkeypatch):
    """On procps, pkill exits 1 both for "no match" and for "matched, could not signal": pgrep tells them apart."""

    def run(args, **k):
        if args[0] == "pkill":
            return subprocess.CompletedProcess(args, 1, b"", b"")
        return subprocess.CompletedProcess(args, 0, b"123\n", b"")  # still there

    monkeypatch.setattr(lib.subprocess, "run", run)
    monkeypatch.setattr(lib.time, "sleep", lambda s: None)
    assert "still running" in lib.end_chrome("/tmp/p", wait_s=0.2)


def test_the_readme_generator_runs_isolated():
    """The scripts are run with `python -I`, which leaves their folder off the import path: each must add it itself."""
    root = Path(__file__).resolve().parents[2]
    done = subprocess.run([sys.executable, "-I", str(root / "scripts" / "readme_tables.py"), "--check"], capture_output=True, text=True, cwd=root)
    assert "ModuleNotFoundError" not in done.stderr and done.returncode in (0, 1), done.stderr[-300:]


def test_end_chrome_reports_a_tool_that_cannot_be_started(monkeypatch):
    def run(args, **k):
        raise FileNotFoundError(2, "No such file or directory", args[0])

    monkeypatch.setattr(lib.subprocess, "run", run)
    assert "may still be running" in lib.end_chrome("/tmp/p", wait_s=0.1)


def test_a_context_that_will_not_close_has_its_chrome_ended(monkeypatch):
    import asyncio

    class Ctx:
        def __init__(self, ok):
            self.ok = ok

        async def close(self):
            if not self.ok:
                raise RuntimeError("target closed")

    ended = []
    monkeypatch.setattr(lib, "end_chrome", lambda profile: ended.append(profile) or "that Chrome is still running")
    assert asyncio.run(lib.close_context(Ctx(True), "/tmp/p")) is None and ended == []
    assert asyncio.run(lib.close_context(Ctx(False), "/tmp/p")) == "that Chrome is still running" and ended == ["/tmp/p"]


def test_a_stopped_run_writes_beside_the_days_file_not_over_it():
    import datetime

    now = datetime.datetime(2026, 11, 17, 5, 6, 7, tzinfo=datetime.timezone.utc)
    assert lib.stopped_path("results/raw/2026-11-17-browser-showcase.json", now) == "results/raw/2026-11-17-browser-showcase-stopped-050607Z.json"
    assert lib.stopped_path(None) is None


def test_chrome_memory_counts_renderers_below_the_zygote_on_linux_and_direct_children_on_macos():
    """The same process tree is read on both systems: renderers below the zygote (Linux) or the browser (macOS)."""
    linux = [
        (10, 1, 500, "/opt/google/chrome/chrome --user-data-dir=/tmp/p --no-sandbox"),
        (11, 10, 50, "/opt/google/chrome/chrome --type=zygote --user-data-dir=/tmp/p"),
        (12, 11, 70, "/opt/google/chrome/chrome --type=renderer --user-data-dir=/tmp/p"),
        (13, 11, 30, "/opt/google/chrome/chrome --type=renderer --user-data-dir=/tmp/p"),
        (14, 10, 20, "/opt/google/chrome/chrome --type=gpu-process --user-data-dir=/tmp/p"),
        (20, 1, 500, "/opt/google/chrome/chrome --user-data-dir=/tmp/other"),
        (21, 20, 999, "/opt/google/chrome/chrome --type=renderer --user-data-dir=/tmp/other"),
    ]
    assert lib.chrome_memory_of(linux, "/tmp/p") == {"rendererRss": 100, "renderers": 2, "gpuRss": 20}
    mac = [
        (10, 1, 500, "Google Chrome --user-data-dir=/tmp/p"),
        (12, 10, 70, "Google Chrome Helper (Renderer) --type=renderer --user-data-dir=/tmp/p"),
        (14, 10, 20, "Google Chrome Helper (GPU) --type=gpu-process --user-data-dir=/tmp/p"),
    ]
    assert lib.chrome_memory_of(mac, "/tmp/p") == {"rendererRss": 70, "renderers": 1, "gpuRss": 20}
    assert lib.chrome_memory_of(linux, "/tmp/none") == {"rendererRss": 0, "renderers": 0, "gpuRss": 0}


def test_chrome_args_come_from_the_environment_and_default_to_none():
    """An explicit mapping makes the result independent of the process environment."""
    assert lib.chrome_args({}) == []
    assert lib.chrome_args({"OD_CHROME_ARGS": "--no-sandbox  --disable-dev-shm-usage"}) == ["--no-sandbox", "--disable-dev-shm-usage"]


def test_chrome_args_keep_a_quoted_value_whole_and_read_the_process_environment(monkeypatch):
    """Shell quoting applies, and a call without a mapping reads os.environ (what the launchers do)."""
    assert lib.chrome_args({"OD_CHROME_ARGS": '--user-agent="Benchmark Browser" --no-sandbox'}) == ["--user-agent=Benchmark Browser", "--no-sandbox"]
    monkeypatch.setenv("OD_CHROME_ARGS", "--no-sandbox")
    assert lib.chrome_args() == ["--no-sandbox"]
    monkeypatch.delenv("OD_CHROME_ARGS")
    assert lib.chrome_args() == []


def test_where_note_names_the_chrome_flags_the_description_left_out():
    """A published environment line always shows the start-up flags, said by the operator or not."""
    assert lib.where_note("Linux x86_64", {}) == "Linux x86_64"
    assert lib.where_note("Linux x86_64", {"MEASURE_WHERE": "a laptop"}) == "a laptop"
    assert lib.where_note("Linux x86_64", {"OD_CHROME_ARGS": "--no-sandbox"}) == "Linux x86_64; Chrome started with --no-sandbox"
    both = {"MEASURE_WHERE": "a job, Chrome with --no-sandbox", "OD_CHROME_ARGS": "--no-sandbox --disable-gpu"}
    assert lib.where_note("x", both) == "a job, Chrome with --no-sandbox; Chrome started with --disable-gpu"


def test_chrome_memory_does_not_take_a_chrome_whose_profile_path_only_starts_the_same():
    """/tmp/p and /tmp/pq are two browsers: each one's renderers count for itself only."""
    rows = [
        (10, 1, 500, "chrome --user-data-dir=/tmp/p --no-first-run"),
        (11, 10, 40, "chrome --type=renderer --user-data-dir=/tmp/p"),
        (20, 1, 500, "chrome --user-data-dir=/tmp/pq --no-first-run"),
        (21, 20, 900, "chrome --type=renderer --user-data-dir=/tmp/pq"),
    ]
    assert lib.chrome_memory_of(rows, "/tmp/p") == {"rendererRss": 40, "renderers": 1, "gpuRss": 0}
    assert lib.chrome_memory_of(rows, "/tmp/pq") == {"rendererRss": 900, "renderers": 1, "gpuRss": 0}


def test_an_analysis_pagespeed_served_from_its_cache_is_not_counted_twice():
    """Five requests in three minutes came back as three analyses (2026-11-20): a copy has the first one's time."""
    seen: dict = {}
    first = {"page": "e/univer", "desktop": {"performance": 93, "fetchTime": "2026-11-20T05:53:01Z"}, "mobile": {"performance": 91, "fetchTime": "2026-11-20T05:53:02Z"}}
    assert lib.repeated_analysis(first, seen) == []
    copy = {"page": "e/univer", "desktop": {"performance": 93, "fetchTime": "2026-11-20T05:53:01Z"}, "mobile": {"performance": 88, "fetchTime": "2026-11-20T05:54:40Z"}}
    again = lib.repeated_analysis(copy, seen)
    assert again == ["desktop"]
    kept = lib.without_repeats(copy, again)
    assert "desktop" not in kept and kept["mobile"]["performance"] == 88 and kept["error"] == lib.PSI_REPEAT and kept["repeated"] == ["desktop"]
    # The same time on another page is another analysis, and a report without a time is never called a copy.
    assert lib.repeated_analysis({"page": "e/plate", "desktop": {"performance": 93, "fetchTime": "2026-11-20T05:53:01Z"}}, seen) == []
    assert lib.repeated_analysis({"page": "e/univer", "desktop": {"performance": 93}}, seen) == []
    assert lib.summarize({"lighthouseVersion": "13", "fetchTime": "2026-11-20T05:53:01Z", "categories": {}, "audits": {}})["fetchTime"] == "2026-11-20T05:53:01Z"
    e = lib.page_entry([first, kept], limit_s=240)
    assert e["desktop"]["performanceRuns"] == [93, None] and e["mobile"]["performanceRuns"] == [91, 88]


# --- review of pull requests 71 and 72 (2026-11-20) ---


def _psi(page, d=None, m=None):
    x = {"page": page}
    if d:
        x["desktop"] = {"performance": 90, "fetchTime": d}
    if m:
        x["mobile"] = {"performance": 80, "fetchTime": m}
    return x


def test_a_fresh_form_factor_is_kept_while_the_other_is_asked_again():
    """D0 and M0 are counted. An attempt returns D0 (a copy) with a fresh M1; the next returns a
    fresh D1 with M1, which is now a copy of the attempt before. Both fresh analyses are published."""
    seen: dict = {}
    assert lib.repeated_analysis(_psi("e/plate", "D0", "M0"), seen) == []
    kept: dict = {}
    first = _psi("e/plate", "D0", "M1")
    assert lib.still_repeated(kept, first, lib.repeated_analysis(first, seen)) == ["desktop"]
    second = _psi("e/plate", "D1", "M1")
    missing = lib.still_repeated(kept, second, lib.repeated_analysis(second, seen))
    assert missing == []
    out = lib.with_kept(second, kept, missing)
    assert out["desktop"]["fetchTime"] == "D1" and out["mobile"]["fetchTime"] == "M1" and "error" not in out


def test_a_fresh_form_factor_survives_a_retry_that_fails():
    seen: dict = {}
    lib.repeated_analysis(_psi("e/plate", "D0", "M0"), seen)
    kept: dict = {}
    first = _psi("e/plate", "D0", "M1")
    lib.still_repeated(kept, first, lib.repeated_analysis(first, seen))
    failed = {"page": "e/plate", "error": "PageSpeed gave no result within 240 s"}
    missing = lib.still_repeated(kept, failed, lib.repeated_analysis(failed, seen))
    out = lib.with_kept(failed, kept, missing)
    assert out["mobile"]["fetchTime"] == "M1" and "desktop" not in out and out["error"].startswith("PageSpeed gave no result")


def test_a_form_factor_that_stays_a_copy_is_left_out_and_said_so():
    seen: dict = {}
    lib.repeated_analysis(_psi("e/plate", "D0", "M0"), seen)
    kept: dict = {}
    x = _psi("e/plate", "D0", "M1")
    missing = lib.still_repeated(kept, x, lib.repeated_analysis(x, seen))
    out = lib.with_kept(x, kept, missing)
    assert "desktop" not in out and out["repeated"] == ["desktop"] and out["mobile"]["fetchTime"] == "M1"


def _count(readings, quiet_s=1.0, wait_s=3.0):
    """stable_count over a scripted list of readings (an Exception is a read that failed), on a fake clock."""
    t = [0.0]
    it = iter(readings)

    async def read():
        v = next(it, readings[-1])
        if isinstance(v, Exception):
            raise v
        return v

    async def sleep(s):
        t[0] += s

    return lib.asyncio.run(lib.stable_count(read, quiet_s, wait_s, now=lambda: t[0], sleep=sleep))


def test_a_page_count_kept_when_the_reads_then_fail_is_flagged():
    pages, _, _, still = _count([100, TimeoutError()])
    assert pages == 100 and still is True


def test_a_page_count_of_zero_is_waited_on_and_no_counter_is_not():
    pages, changes, _, still = _count([0, 0, 12, 12, 12, 12])
    assert pages == 12 and changes == 1 and still is False
    assert _count([None])[0] is None


def test_a_page_count_that_went_quiet_is_not_flagged_and_one_that_never_did_is():
    assert _count([52, 103, 500])[::3] == (500, False)
    assert _count(list(range(1, 40)))[3] is True


def test_settled_takes_the_page_count_only_when_the_count_stopped():
    out = {"settledMs": 1700}
    lib.settle_by_pages(out, 4300, still_changing=False)
    assert out == {"settledMs": 4300, "settledMsLongTasks": 1700, "settledBy": "pages", "pagesSettledMs": 4300}
    out = {"settledMs": 5000}
    lib.settle_by_pages(out, 4300, still_changing=False)
    assert out == {"settledMs": 5000, "pagesSettledMs": 4300}
    # Still paginating when the wait gave up: there is no settled time, and no page-count time.
    out = {"settledMs": 1700}
    lib.settle_by_pages(out, 4300, still_changing=True)
    assert out == {"settledMsLongTasks": 1700, "settleTimedOut": True, "pagesStillChanging": True}


def test_sample_row_says_how_settled_was_reached_and_leaves_an_uncollected_heap_out():
    row = lib.sample_row([
        {"loadMs": 1, "settledMs": 10, "settledBy": "pages", "heapBytes": 100},
        {"loadMs": 1, "settledMs": 12, "heapBytes": 900, "heapNotCollected": "TimeoutError"},
        {"loadMs": 1, "settledMs": 14, "heapBytes": 300},
    ])
    assert row["settledByPages"] == 1 and row["heapNotCollected"] == 1 and row["heapBytes"] == 200
    # Every run uncollected: the figure is shown, with its flag, not withheld.
    assert lib.sample_row([{"loadMs": 1, "heapBytes": 900, "heapNotCollected": "x"}])["heapBytes"] == 900


def _quiet(loads, env):
    """quiet_host over a scripted list of load readings (the last one repeats), on a fake clock."""
    t, it = [0.0], iter(loads)
    last = [loads[-1]]

    def load():
        last[0] = next(it, last[0])
        return last[0]

    async def sleep(s):
        t[0] += s

    return lib.asyncio.run(lib.quiet_host(env, load=load, sleep=sleep, now=lambda: t[0])), t[0]


def test_a_run_waits_for_a_quiet_host_and_gives_up_with_the_reason():
    assert _quiet([200], {}) == (None, 0.0)  # no limit given: one's own machine, no wait
    assert _quiet([30], {"OD_MAX_LOAD": "48"}) == (None, 0.0)
    why, waited = _quiet([90, 90, 70, 40], {"OD_MAX_LOAD": "48"})
    assert why is None and waited == 30.0
    why, waited = _quiet([90], {"OD_MAX_LOAD": "48", "OD_LOAD_WAIT_S": "60"})
    assert "busy" in why and "48" in why and waited == 60.0


# --- second review round (CodeRabbit, CodeAnt, Gitar; 2026-11-20) ---


def test_a_retry_that_fails_keeps_the_form_factor_owed_and_says_it_was_a_copy():
    seen: dict = {}
    lib.remember_analyses(_psi("e/plate", "D0", "M0"), seen)
    kept: dict = {}
    first = _psi("e/plate", "D0", "M1")
    missing = lib.still_repeated(kept, first, lib.repeated_analysis(first, seen, remember=False))
    failed = {"page": "e/plate", "error": "PageSpeed gave no result within 240 s"}
    missing = lib.still_repeated(kept, failed, lib.repeated_analysis(failed, seen, remember=False), missing)
    assert missing == ["desktop"]  # still owed: the loop asks again
    out = lib.with_kept(failed, kept, missing)
    assert out["repeated"] == ["desktop"] and out["mobile"]["fetchTime"] == "M1"


def test_only_published_analyses_are_remembered():
    """D0/M0 are counted. A job gets D1 with M0 (a copy), then D2 with M1: D1 and M1 are published.
    D2 was never published, so the next job may count it; D1 may not be counted twice."""
    seen: dict = {}
    lib.remember_analyses(_psi("e/plate", "D0", "M0"), seen)
    kept: dict = {}
    a = _psi("e/plate", "D1", "M0")
    missing = lib.still_repeated(kept, a, lib.repeated_analysis(a, seen, remember=False))
    b = _psi("e/plate", "D2", "M1")
    missing = lib.still_repeated(kept, b, lib.repeated_analysis(b, seen, remember=False), missing)
    out = lib.with_kept(b, kept, missing)
    lib.remember_analyses(out, seen)
    assert (out["desktop"]["fetchTime"], out["mobile"]["fetchTime"]) == ("D1", "M1")
    assert lib.repeated_analysis(_psi("e/plate", "D2"), seen, remember=False) == []
    assert lib.repeated_analysis(_psi("e/plate", "D1", "M1"), seen, remember=False) == ["desktop", "mobile"]


def test_a_retry_that_succeeds_replaces_a_kept_error_and_a_report_without_a_time_is_kept():
    kept: dict = {}
    bad = {"page": "e/plate", "desktop": {"fetchTime": "D1", "error": "the engine failed to start"}}
    assert lib.still_repeated(kept, bad, ["mobile"]) == ["mobile"]
    good = _psi("e/plate", "D2", "M1")
    assert lib.still_repeated(kept, good, [], ["mobile"]) == []
    assert kept["desktop"]["fetchTime"] == "D2" and "error" not in kept["desktop"]
    # A report that carries no time cannot be a copy: it is kept like any fresh one.
    kept = {}
    lib.still_repeated(kept, {"page": "e/plate", "desktop": {"performance": 90}}, ["mobile"])
    assert kept == {"desktop": {"performance": 90}}


def test_a_run_without_a_heap_reading_does_not_hide_the_uncollected_one():
    row = lib.sample_row([{"loadMs": 1}, {"loadMs": 1, "heapBytes": 900, "heapNotCollected": "x"}])
    assert row["heapBytes"] == 900 and row["heapNotCollected"] == 1
    row = lib.sample_row([{"loadMs": 1}, {"loadMs": 1, "heapBytes": 900, "heapNotCollected": "x"}, {"loadMs": 1, "heapBytes": 100}])
    assert row["heapBytes"] == 100


def test_a_count_of_zero_followed_by_failed_reads_is_flagged_too():
    pages, _, _, still = _count([0, TimeoutError()])
    assert pages == 0 and still is True
    assert _count([TimeoutError()])[3] is False  # nothing was ever read: no counter to doubt
