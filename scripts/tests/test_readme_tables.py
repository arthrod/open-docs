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
    assert rt.render(readme, samples, lighthouse) == readme, "run scripts/readme_tables.py"


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
    assert "| Word Online viewer (measured 2026-11-10) | 600 ms | n/a | n/a | 700 MB | n/a | 1 of 1 |" in out
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
