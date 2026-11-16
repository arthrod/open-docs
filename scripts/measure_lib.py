"""The parts of the measurement scripts that are plain logic: no browser, no network.

Kept apart so they can be tested (`uv run --with pytest pytest scripts/tests`):
how runs become a published row, how a partial re-run is merged into what is
already published, and how a Chrome that will not close is ended.
"""
import argparse
import json
import statistics
import subprocess

SAMPLE_KEYS = ("startupMs", "loadMs", "settledMs", "heapBytes", "rendererRssReady", "rendererRss", "gpuRss", "domNodes", "pages", "bytes", "requests")
LH_CATS = {"performance": "performance", "accessibility": "accessibility", "best-practices": "bestPractices", "seo": "seo"}
LH_AUDITS = {"first-contentful-paint": "fcpMs", "largest-contentful-paint": "lcpMs", "total-blocking-time": "tbtMs", "cumulative-layout-shift": "cls", "speed-index": "speedIndexMs"}
LH_KEYS = [*LH_CATS.values(), *LH_AUDITS.values()]
PROVENANCE = ("measuredAt", "environment", "base")


def pkill_args(profile: str) -> list[str]:
    """`--` first: the pattern starts with `--user-data-dir=`, which pkill otherwise reads as an option and exits 2."""
    return ["pkill", "-f", "--", f"--user-data-dir={profile}"]


def end_chrome(profile: str) -> str | None:
    """End the Chrome started on `profile`. Returns what went wrong, or None (1 = nothing matched: already gone)."""
    p = subprocess.run(pkill_args(profile), capture_output=True)
    if p.returncode in (0, 1):
        return None
    return f"pkill exited {p.returncode}: {(p.stderr or b'').decode(errors='replace').strip()[:120]}; that Chrome may still be running"


def median(xs: list[dict], key: str) -> int | None:
    """Median of `key` over the runs that have it; None when none does."""
    vs = [x[key] for x in xs if x.get(key) is not None]
    return int(statistics.median(vs)) if vs else None


def sample_row(xs: list[dict]) -> dict:
    """One engine on one sample, from its runs (scripts/measure_samples.py).

    `failed` is why a run did not load. `incomplete` is an error from a run
    that DID load (its timing stands) but whose later readings did not arrive.
    `rendererGrowth` is the median of each run's own after − before.
    """
    ok = [x for x in xs if "loadMs" in x]
    growth = [x["rendererRss"] - x["rendererRssReady"] for x in ok if x.get("rendererRss") is not None and x.get("rendererRssReady") is not None]
    return {
        **{k: median(ok, k) for k in SAMPLE_KEYS},
        "rendererGrowth": int(statistics.median(growth)) if growth else None,
        "settleTimedOut": sum(1 for x in ok if x.get("settleTimedOut")),
        "runs": [x.get("loadMs") for x in xs],
        "failed": next((x.get("error") or x.get("blocked") for x in xs if "loadMs" not in x), None),
        "incomplete": next((x["error"] for x in ok if x.get("error")), None),
    }


def merge_latest(latest: dict, summary: dict, meta: dict) -> dict:
    """Merge the rows just measured over the published ones.

    Every row carries the date and environment it was measured under. Rows
    that are kept and have none yet get the file's previous ones, so a partial
    re-run on another day or machine does not relabel them.
    """
    merged = latest.get("samples", {})
    old = {k: latest[k] for k in ("measuredAt", "environment") if k in latest}
    for rows in merged.values():
        for row in rows.values():
            for k, v in old.items():
                row.setdefault(k, v)
    for s, rows in summary.items():
        for e, row in rows.items():
            merged.setdefault(s, {})[e] = {**row, "measuredAt": meta["measuredAt"], "environment": meta["environment"]}
    return {**{k: meta[k] for k in PROVENANCE}, "samples": merged}


def summarize(l: dict) -> dict:
    """One Lighthouse report. A report Lighthouse or we rejected keeps its reason and none of its numbers."""
    out: dict = {"version": l.get("lighthouseVersion")}
    if l.get("runtimeError"):
        out["error"] = f"{l['runtimeError'].get('code')}: {l['runtimeError'].get('message', '')}"[:200]
    final = l.get("finalDisplayedUrl") or l.get("finalUrl") or ""
    if "challenge" in final or "Just a moment" in json.dumps(l.get("audits", {}).get("document-title", {})):
        out["error"] = "the page Google got was a Cloudflare challenge"
    if "error" in out:
        return out
    for k, name in LH_CATS.items():
        s = l.get("categories", {}).get(k, {}).get("score")
        if s is not None:
            out[name] = round(s * 100)
    for k, name in LH_AUDITS.items():
        v = l.get("audits", {}).get(k, {}).get("numericValue")
        if v is not None:
            out[name] = round(v, 3) if name == "cls" else round(v)
    return out


def page_entry(xs: list[dict], limit_s: int) -> dict:
    """One page's published entry from its analyses: medians per form factor, each with its own error."""
    entry: dict = {}
    for f in ("desktop", "mobile"):
        fs = [x[f] for x in xs if f in x]

        def med(k):
            v = [y[k] for y in fs if y.get(k) is not None]
            return None if not v else (round(statistics.median(v), 3) if k == "cls" else int(statistics.median(v)))

        missing = next((x.get("error") or f"PageSpeed gave no {f} result within {limit_s} s" for x in xs if f not in x), None)
        entry[f] = {
            **{k: med(k) for k in LH_KEYS},
            "performanceRuns": [x.get(f, {}).get("performance") for x in xs],
            "error": next((y["error"] for y in fs if "error" in y), None) or missing,
        }
    return entry


def merge_pagespeed(result: dict, entries: dict, label: str | None, meta: dict) -> dict:
    """Put a run's entries into the results file, with the provenance of the population they belong to.

    The default table (`pages`) is described by the file's own date and
    environment; a labelled population (`docs.<label>`, the same pages on
    another document) by `docsMeta.<label>`. Neither relabels the other.
    """
    if label:
        result.setdefault("docsMeta", {})[label] = dict(meta)
        result.setdefault("docs", {}).setdefault(label, {}).update(entries)
        for k, v in meta.items():
            result.setdefault(k, v)
    else:
        result.update(meta)
        result.setdefault("pages", {}).update(entries)
    return result


def lorem_args(argv: list[str]) -> argparse.Namespace:
    """scripts/make_lorem.py's command line: an optional output path, --chapters N, --words N."""
    p = argparse.ArgumentParser(description="Generate the 500-page lorem ipsum sample.")
    p.add_argument("out", nargs="?", default=None, help="output .docx (default: .scratch/fixtures/lorem-500.docx)")
    p.add_argument("--chapters", type=int, default=50)
    p.add_argument("--words", type=int, default=4450, help="words of body text per chapter")
    return p.parse_args(argv)
