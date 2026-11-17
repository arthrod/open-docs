"""The parts of the measurement scripts that are plain logic: no browser, no network.

Kept apart so they can be tested (`uv run --with pytest pytest scripts/tests`):
how runs become a published row, how a partial re-run is merged into what is
already published, and how a Chrome that will not close is ended.
"""
import argparse
import asyncio
import datetime
import json
import os
import re
import statistics
import subprocess
import time

SAMPLE_KEYS = ("startupMs", "loadMs", "settledMs", "heapBytes", "rendererRssReady", "rendererRss", "gpuRss", "domNodes", "pages", "bytes", "requests")
LH_CATS = {"performance": "performance", "accessibility": "accessibility", "best-practices": "bestPractices", "seo": "seo"}
LH_AUDITS = {"first-contentful-paint": "fcpMs", "largest-contentful-paint": "lcpMs", "total-blocking-time": "tbtMs", "cumulative-layout-shift": "cls", "speed-index": "speedIndexMs"}
LH_KEYS = [*LH_CATS.values(), *LH_AUDITS.values()]
PROVENANCE = ("measuredAt", "environment", "base")


def pkill_args(profile: str) -> list[str]:
    """`--` first: the pattern starts with `--user-data-dir=`, which pkill otherwise reads as an option and exits 2."""
    return ["pkill", "-f", "--", f"--user-data-dir={profile}"]


async def close_context(ctx, profile: str, wait_s: float = 20) -> str | None:
    """Close a Playwright context, and end its Chrome if it will not close. Returns what went wrong, or None.

    Used on every way out of a run, the setup failures included: a context
    whose page could not be opened still has a Chrome behind it.
    """
    try:
        await asyncio.wait_for(ctx.close(), wait_s)
        return None
    except Exception:
        return end_chrome(profile)  # a renderer that never yields does not close either


def stopped_path(path: str | None, now: datetime.datetime | None = None) -> str | None:
    """Where a run that was stopped early writes its runs: beside `path`, never over it.

    The medians file keeps the earlier entries of the engines such a run never
    reached; were the day's raw file overwritten, those entries would have no
    runs behind them.
    """
    if not path:
        return path
    stamp = (now or datetime.datetime.now(datetime.timezone.utc)).strftime("%H%M%SZ")
    root, ext = os.path.splitext(path)
    return f"{root}-stopped-{stamp}{ext}"


def end_chrome(profile: str, wait_s: float = 5.0) -> str | None:
    """End the Chrome started on `profile` and see that it went. Returns what went wrong, or None.

    After pkill the process is looked for with pgrep until it is gone (pgrep
    exits 1) or `wait_s` has passed; one that is still there is reported, so
    the caller can stop instead of measuring the next page beside a leftover
    browser. pkill's own exit 1 proves nothing (on procps it is also "matched,
    none could be signalled"), a tool that fails (exit 2 or 3) or cannot be
    started at all is reported the same way: none of them shows that Chrome went.
    """
    try:
        return _end_chrome(profile, wait_s)
    except OSError as e:  # pkill or pgrep could not be started
        return f"{type(e).__name__}: {e}"[:160] + "; that Chrome may still be running"


def _end_chrome(profile: str, wait_s: float) -> str | None:
    p = subprocess.run(pkill_args(profile), capture_output=True)
    # 1 is "nothing matched" on macOS; on procps it can also be "matched, none could be signalled".
    # Either way the process is looked for below, so a Chrome that was not signalled is reported.
    if p.returncode not in (0, 1):
        return f"pkill exited {p.returncode}: {(p.stderr or b'').decode(errors='replace').strip()[:120]}; that Chrome may still be running"
    deadline = time.monotonic() + wait_s
    while True:
        g = subprocess.run(["pgrep", "-f", "--", f"--user-data-dir={profile}"], capture_output=True)
        if g.returncode == 1:
            return None  # nothing matched: it is gone
        if g.returncode != 0:  # 2 or 3: pgrep itself failed, which is not proof that Chrome went
            return f"pgrep exited {g.returncode}: {(g.stderr or b'').decode(errors='replace').strip()[:120]}; that Chrome may still be running"
        if time.monotonic() >= deadline:
            return f"that Chrome is still running {wait_s:g} s after pkill"
        time.sleep(0.2)


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
    old = {k: latest[k] for k in PROVENANCE if k in latest}
    for rows in merged.values():
        for row in rows.values():
            for k, v in old.items():
                row.setdefault(k, v)
    for s, rows in summary.items():
        for e, row in rows.items():
            merged.setdefault(s, {})[e] = {**row, **{k: meta[k] for k in PROVENANCE}}
    return {**{k: meta[k] for k in PROVENANCE}, "samples": merged}


PSI_REFUSALS = ("Unable to resolve", "Lighthouse returned error", "Oops! Something went wrong", "Unable to process request")


def psi_refusal(text: str) -> str | None:
    """PageSpeed's own words when it would not analyse the address at all, or None.

    Such an answer carries no report, so waiting for one ends at the time limit; recorded as
    "never finished loading", it blamed the page for what PageSpeed's first fetch decided
    (it gives a slow first byte, such as a 6 s server render, very little time).
    """
    for line in text.splitlines():
        line = " ".join(line.split())
        if any(k in line for k in PSI_REFUSALS):
            return "PageSpeed refused the address: " + line[:160]
    return None


ENGINE_FAILED = "the engine failed on Google's machine, so there is no score"


def summarize(l: dict) -> dict:
    """One Lighthouse report. A report Lighthouse or we rejected keeps its reason and none of its numbers."""
    out: dict = {"version": l.get("lighthouseVersion")}
    # A report of an unexpected shape is read as far as it goes: thrown, it was swallowed by the
    # caller and the analysis then counted as "no result within 240 s".
    audits = l.get("audits") if isinstance(l.get("audits"), dict) else {}
    cats = l.get("categories") if isinstance(l.get("categories"), dict) else {}
    part = lambda d, k: d.get(k) if isinstance(d.get(k), dict) else {}  # noqa: E731 - a one-line reader of nested dicts
    if isinstance(l.get("runtimeError"), dict):
        out["error"] = f"{l['runtimeError'].get('code')}: {l['runtimeError'].get('message', '')}"[:200]
    final = l.get("finalDisplayedUrl") or l.get("finalUrl") or ""
    if "challenge" in str(final) or "Just a moment" in json.dumps(audits.get("document-title", {})):
        out["error"] = "the page Google got was a Cloudflare challenge"
    # The page's own console.error when its engine or its document failed ("[open-docs] WordCraft
    # failed to start"): Lighthouse then scores the error box, and scores it well, because an error
    # box paints fast. PageSpeed gave WordCraft 100 for a page showing "failed to start" (2026-11-16).
    items = part(part(audits, "errors-in-console"), "details").get("items")
    logged = [str(i.get("description", "")) for i in (items if isinstance(items, list) else []) if isinstance(i, dict)]
    # Exactly this site's two tags, at the start of the line: not another script's "[open-docs-…]".
    own = [d for d in logged if re.match(r"\s*\[open-docs(-viewer)?\]", d)]
    if own and "error" not in out:  # a rejected report keeps the first reason it was rejected for
        out["error"] = ENGINE_FAILED + ": " + " ".join(own[0].split())[:160]
    if "error" in out:
        return out
    for k, name in LH_CATS.items():
        s = part(cats, k).get("score")
        if isinstance(s, (int, float)):
            out[name] = round(s * 100)
    for k, name in LH_AUDITS.items():
        v = part(audits, k).get("numericValue")
        if isinstance(v, (int, float)):
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
        # The engine failed in most analyses: the few that "passed" most likely scored the same
        # failing page before it logged its error, so they are not published as the engine's score.
        broke = [y["error"] for y in fs if str(y.get("error", "")).startswith(ENGINE_FAILED)]
        scored = [y for y in fs if y.get("performance") is not None]
        if broke and len(broke) >= len(scored):
            entry[f] = {**{k: None for k in LH_KEYS}, "performanceRuns": [None for _ in xs], "error": broke[0]}
            continue
        entry[f] = {
            **{k: med(k) for k in LH_KEYS},
            "performanceRuns": [x.get(f, {}).get("performance") for x in xs],
            "error": next((y["error"] for y in fs if "error" in y), None) or missing,
        }
    return entry


def merge_pagespeed(result: dict, entries: dict, label: str | None, meta: dict) -> dict:
    """Put a run's entries into the results file, each with the provenance of the run that measured it.

    The default table (`pages`) is headed by the file's own date and
    environment; a labelled population (`docs.<label>`, the same pages on
    another document) by `docsMeta.<label>`. A run of some pages only must not
    redate the others: every entry carries its own `measuredAt`, `environment`
    and `base`, and entries kept from before get the heading they were
    published under.
    """
    root = {k: result[k] for k in PROVENANCE if k in result}
    if label:
        rows = result.setdefault("docs", {}).setdefault(label, {})
        old = result.get("docsMeta", {}).get(label) or root
    else:
        rows = result.setdefault("pages", {})
        old = root
        # A labelled population from before docsMeta was published under this heading: it keeps it,
        # or a later run of the default table would redate it.
        for doc in result.get("docs", {}):
            result.setdefault("docsMeta", {}).setdefault(doc, dict(root))
    # The table's heading is the run that measured the whole table. A run of some of its pages
    # must not head rows measured otherwise (two analyses heading rows that had five): its own
    # rows say theirs.
    whole = set(rows) <= set(entries)
    if label:
        heads = result.setdefault("docsMeta", {})
        heads[label] = dict(meta) if whole else heads.get(label) or dict(old or meta)
        for k, v in meta.items():
            result.setdefault(k, v)
    elif whole:
        result.update(meta)
    else:
        for k, v in meta.items():
            result.setdefault(k, v)
    for row in rows.values():
        for k, v in old.items():
            row.setdefault(k, v)
    for p, entry in entries.items():
        rows[p] = {**entry, **{k: meta[k] for k in PROVENANCE}}
    return result


def lorem_args(argv: list[str]) -> argparse.Namespace:
    """scripts/make_lorem.py's command line: an optional output path, --chapters N, --words N."""
    p = argparse.ArgumentParser(description="Generate the 500-page lorem ipsum sample.")
    p.add_argument("out", nargs="?", default=None, help="output .docx (default: .scratch/fixtures/lorem-500.docx)")
    p.add_argument("--chapters", type=int, default=50)
    p.add_argument("--words", type=int, default=4450, help="words of body text per chapter")
    return p.parse_args(argv)


def machine_load() -> dict:
    """How busy the machine is right now: the 1-minute load average and the core count.

    A timing taken while other work holds the processors is slower than the
    engine is; every run records this so a reader can tell.
    """
    return {"load1": round(os.getloadavg()[0], 2), "cores": os.cpu_count() or 1}


def load_note(runs: list[dict]) -> str:
    """One phrase for the environment line: the load the runs were taken under."""
    loads = sorted(r["load1"] for r in runs if isinstance(r.get("load1"), (int, float)))
    if not loads:
        return ""
    cores = next((r["cores"] for r in runs if r.get("cores")), None)
    return f"machine load (1-minute average) median {statistics.median(loads):.1f}, highest {loads[-1]:.1f}" + (f", on {cores} cores" if cores else "")


def runs_note(asked: int, raw: list[dict], key: str = "engine") -> str:
    """"3 runs" when every engine got the runs asked for; otherwise what was actually made."""
    per: dict = {}
    for r in raw:
        k = (r.get(key), r.get("sample") or r.get("doc"))
        per[k] = per.get(k, 0) + 1
    counts = sorted(set(per.values()))
    if not counts or counts == [asked]:
        return f"{asked} runs"
    return f"{counts[0]} to {counts[-1]} runs ({asked} asked; the measuring stopped early)" if len(counts) > 1 else f"{counts[0]} runs ({asked} asked; the measuring stopped early)"


def pagespeed_args(argv: list[str]) -> argparse.Namespace:
    """scripts/measure_pagespeed.py's command line."""
    p = argparse.ArgumentParser(description="PageSpeed Insights on pages of one site, several analyses each.")
    p.add_argument("base", help="the site, e.g. https://viewers.benchmarks.law")
    p.add_argument("pages", help="comma-separated paths under it, e.g. v/docxodus,r/docxodus")
    p.add_argument("runs", type=_positive, help="analyses per page and form factor")
    p.add_argument("--out", metavar="PATH", help="merge the medians into this results file")
    p.add_argument("--query", default="", help='appended to every page, e.g. "src=<docx url>"')
    p.add_argument("--label", help="with --query: file the medians under docs.<label>, leaving the default table alone")
    p.add_argument("--raw", metavar="PATH", help="write every analysis to this file")
    return p.parse_args(argv)


def _positive(v: str) -> int:
    """A count of at least one."""
    n = int(v)
    if n < 1:
        raise argparse.ArgumentTypeError("must be at least 1")
    return n


def chrome_note(raw: list[dict]) -> str:
    """The browser the runs were made in, with its version when the runs recorded it."""
    versions = sorted({str(r["chrome"]).replace("HeadlessChrome/", "headless ").replace("Chrome/", "") for r in raw if r.get("chrome")})
    return "Google Chrome " + " and ".join(versions) if versions else "Google Chrome"
