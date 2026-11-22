"""The README's measured tables are written from the result files (scripts/readme_tables.py)."""
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import readme_tables as rt  # noqa: E402 - sys.path is set above so the sibling module imports

ROOT = Path(__file__).resolve().parents[2]


def test_the_readme_in_the_repository_matches_its_data():
    samples = json.loads((ROOT / "docs/samples/latest.json").read_text())
    lighthouse = json.loads((ROOT / "docs/lighthouse/latest.json").read_text())
    readme = (ROOT / "README.md").read_text()
    local = json.loads((ROOT / "docs/lighthouse/local.json").read_text())
    assert rt.render(readme, samples, lighthouse, local) == readme, "run scripts/readme_tables.py"


def test_growth_is_the_paired_figure_and_never_a_difference_of_medians():
    row = {"loadMs": 239, "settledMs": 239, "heapBytes": 17 << 20, "rendererRssReady": 401 << 20, "rendererRss": 372 << 20, "runs": [1, 2, 3]}
    data = {"measuredAt": "2026-11-15", "environment": "test", "samples": {"redline": {"folio": {**row, "rendererGrowth": 25 << 20}, "plate": row}}}
    out = rt.samples_block(data)
    assert "| folio | 239 ms | 239 ms | 17 MB | 372 MB (+25 MB) | n/a | 3 of 3 |" in out
    assert "| Plate | 239 ms | 239 ms | 17 MB | 372 MB | n/a | 3 of 3 |" in out  # no paired growth: none shown
    assert "−29 MB" not in out


def test_rows_that_failed_frames_and_other_dates_are_said():
    data = {"measuredAt": "2026-11-16", "environment": "test", "samples": {"lorem-500": {
        "docen": {"loadMs": None, "runs": [None, None], "failed": "not loaded within 240s | of navigation\nsecond line"},
        "word-online": {"loadMs": 600, "settledMs": 700, "heapBytes": 5, "rendererRss": 700 << 20, "runs": [600], "measuredAt": "2026-11-10"},
        "plate": {"loadMs": 22000, "settledMs": None, "settleTimedOut": 1, "heapBytes": 82 << 20, "rendererRss": 469 << 20, "pages": 0, "runs": [22000, None]},
    }}}
    out = rt.samples_block(data)
    assert "| docen | **did not open it**: not loaded within 240s \\| of navigation | | | | | 0 of 2 |" in out
    assert "| Microsoft Word viewer (measured 2026-11-10) | 600 ms | n/a | n/a | 700 MB | n/a | 1 of 1 |" in out
    assert "| Plate | 22.0 s | still busy after 180 s | 82 MB | 469 MB | n/a | 1 of 2 |" in out


def test_lighthouse_rows():
    page = {"performance": 66, "accessibility": 96, "bestPractices": 100, "seo": 90, "fcpMs": 230, "lcpMs": 1072, "tbtMs": 828, "cls": 0.006, "speedIndexMs": 2292, "performanceRuns": [66, None, 43], "error": None}
    none = {k: None for k in page} | {"performanceRuns": [None], "error": "PAGE_HUNG: it stopped"}
    data = {"measuredAt": "2026-11-16", "environment": "PSI", "pages": {"e/docxodus": {"desktop": page, "mobile": page}, "e/plate": {"desktop": none, "mobile": none}},
            "docs": {"lorem-500": {"e/folio": {"desktop": page, "mobile": none}}}, "docsMeta": {"lorem-500": {"measuredAt": "2026-11-17", "environment": "PSI later"}}}
    out = rt.lighthouse_block(data)
    assert "| Docxodus | 66 · 66 | 1.07 s · 1.07 s | 828 ms · 828 ms | 0.006 · 0.006 | 230 ms · 230 ms | 2.29 s · 2.29 s | 96 | 100 | 90 | 66/fail/43 · 66/fail/43 |" in out
    assert "| Plate | **no result**: PAGE_HUNG: it stopped | | | | | | | | | |" in out
    assert "Measured 2026-11-17: PSI later." in out and "| folio | 66 · n/a |" in out


def test_a_readme_without_the_markers_is_refused():
    with pytest.raises(SystemExit):
        rt.put("no markers here", "samples", "x")
    assert rt.put("a <!-- samples:start -->old<!-- samples:end --> b", "samples", "new") == "a <!-- samples:start -->\nnew\n<!-- samples:end --> b"


def test_a_row_measured_on_another_machine_the_same_day_says_so():
    row = {"loadMs": 600, "settledMs": 700, "heapBytes": 5 << 20, "rendererRss": 700 << 20, "runs": [600]}
    data = {"measuredAt": "2026-11-16", "environment": "runner", "samples": {"redline": {
        "folio": {**row, "measuredAt": "2026-11-16", "environment": "a laptop"}, "plate": {**row, "measuredAt": "2026-11-16", "environment": "runner"}}}}
    out = rt.samples_block(data)
    assert "| folio (measured 2026-11-16: a laptop) |" in out and "| Plate |" in out
    page = {"performance": 66, "accessibility": 96, "bestPractices": 100, "seo": 90, "fcpMs": 230, "lcpMs": 1072, "tbtMs": 828, "cls": 0.006, "speedIndexMs": 2292, "performanceRuns": [66], "error": None}
    lh = {"measuredAt": "2026-11-16", "environment": "PSI", "pages": {"e/folio": {"desktop": page, "mobile": page, "measuredAt": "2026-11-16", "environment": "PSI, 2 analyses"}}}
    assert "| folio (measured 2026-11-16: PSI, 2 analyses) |" in rt.lighthouse_block(lh)


def test_a_lighthouse_row_analysed_on_another_address_says_so():
    page = {"performance": 66, "performanceRuns": [66], "error": None}
    lh = {"measuredAt": "2026-11-16", "environment": "PSI", "base": "https://a.example",
          "pages": {"e/folio": {"desktop": page, "mobile": page, "measuredAt": "2026-11-16", "environment": "PSI", "base": "https://b.example"},
                    "e/plate": {"desktop": page, "mobile": page, "measuredAt": "2026-11-16", "environment": "PSI", "base": "https://a.example"}}}
    out = rt.lighthouse_block(lh)
    assert "| folio (measured 2026-11-16 on https://b.example) |" in out and "| Plate |" in out


def test_rows_of_one_pass_differing_only_in_host_load_carry_no_note_and_each_table_says_its_load():
    row = {"loadMs": 600, "settledMs": 700, "heapBytes": 5 << 20, "rendererRss": 700 << 20, "runs": [600]}
    m = "Chrome, a cpu-xl machine"
    data = {"measuredAt": "2026-11-21", "environment": f"{m}; machine load (1-minute average) median 56.6, highest 75.7, on 64 cores", "samples": {
        "redline": {"folio": {**row, "measuredAt": "2026-11-21", "environment": f"{m}; machine load (1-minute average) median 25.0, highest 32.0, on 64 cores"}},
        "lorem-500": {"folio": {**row, "measuredAt": "2026-11-21", "environment": f"{m}; machine load (1-minute average) median 56.6, highest 75.7, on 64 cores"}}}}
    out = rt.samples_block(data)
    assert out.count("| folio |") == 2 and "(measured" not in out
    assert out.splitlines()[0] == f"Measured 2026-11-21: {m}."
    assert "Host load during these runs (1-minute average): median 25.0, highest 32.0, on 64 cores." in out
    assert "Host load during these runs (1-minute average): median 56.6, highest 75.7, on 64 cores." in out


def test_the_local_lighthouse_block_says_not_measured_until_a_pass_exists():
    assert rt.local_block({"measuredAt": None, "environment": "", "pages": {}}) == "Not measured yet."


def test_the_local_lighthouse_block_is_headed_by_its_own_machine_and_blames_lighthouse_for_a_missing_score():
    page = lambda **o: {"performance": 60, "accessibility": 94, "bestPractices": 96, "seo": 90, "fcpMs": 500, "lcpMs": 500, "tbtMs": 1840, "cls": 0.002, "speedIndexMs": 8500, "performanceRuns": [60, 61, 59], "error": None, **o}
    none = page(performance=None, performanceRuns=[None, None, None])
    local = {"measuredAt": "2026-11-21", "environment": "Lighthouse 13.6.0 run on a MacBook Pro", "base": "https://editors.benchmarks.law",
             "pages": {"e/wordcraft": {"desktop": page(), "mobile": page(performance=44)}, "e/docen": {"desktop": none, "mobile": none}}}
    out = rt.local_block(local)
    assert "Measured 2026-11-21: Lighthouse 13.6.0 run on a MacBook Pro." in out
    assert "| WordCraft | 60 · 44 |" in out
    assert "| docen | **no result**: Lighthouse gave no score |" in out
    assert "PageSpeed" not in out


def test_a_row_measured_on_another_machine_names_the_machine_not_the_first_160_characters():
    head = {"measuredAt": "2026-11-21", "environment": "Chrome 158 via Playwright, fresh profile per run (cold cache), 3 runs, median; a Hugging Face Jobs cpu-xl machine (16 vCPU, no GPU: Chrome draws in software; the load is the shared host's), Chrome under Xvfb; machine load (1-minute average) median 56.6"}
    row = {"measuredAt": "2026-11-21", "environment": "Chrome 158 via Playwright, fresh profile per run (cold cache), 3 runs, median; a MacBook Pro (Apple M4 Pro, 12 cores, 24 GB, with its graphics card); machine load (1-minute average) median 30.5"}
    assert rt.elsewhere(row, head) == " (measured 2026-11-21: a MacBook Pro (Apple M4 Pro, 12 cores, 24 GB, with its graphics card), load median 30.5)"
    # An environment of another shape is shown as it is.
    assert rt.elsewhere({"measuredAt": "2026-11-16", "environment": "PSI, 2 analyses"}, head) == " (measured 2026-11-16: PSI, 2 analyses)"


def test_the_local_block_shows_the_500_pages_when_only_they_were_measured():
    row = {f: {"performance": 90, "lcpMs": 1000, "tbtMs": 0, "cls": 0, "fcpMs": 500, "speedIndexMs": 900, "accessibility": 100, "bestPractices": 100, "seo": 90, "performanceRuns": [90, 90, 90]} for f in ("desktop", "mobile")}
    only_long = {"measuredAt": None, "environment": "", "docs": {"lorem-500": {"e/folio": row}}, "docsMeta": {"lorem-500": {"measuredAt": "2026-11-21", "environment": "our computer"}}}
    text = rt.local_block(only_long)
    assert "Not measured yet" not in text and "Blank document" not in text
    assert "Measured 2026-11-21: our computer" in text and "| folio |" in text
    assert rt.local_block({"measuredAt": None, "environment": "", "pages": {}, "docs": {"lorem-500": {}}}) == "Not measured yet."


def test_a_row_measured_elsewhere_keeps_the_load_it_was_measured_under():
    method = "Chrome 158 via Playwright, 3 runs, median"
    head = {"measuredAt": "2026-11-21", "environment": f"{method}; a rented machine; machine load (1-minute average) median 56.6, highest 75.7, on 64 cores"}
    row = {"measuredAt": "2026-11-21", "environment": f"{method}; a MacBook Pro; machine load (1-minute average) median 30.5, highest 40.0, on 12 cores"}
    assert rt.elsewhere(row, head) == " (measured 2026-11-21: a MacBook Pro, load median 30.5, highest 40.0, on 12 cores)"
