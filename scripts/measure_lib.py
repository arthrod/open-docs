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
import shlex
import re
import statistics
import subprocess
import sys
import time

SAMPLE_KEYS = ("startupMs", "loadMs", "settledMs", "heapBytes", "heapBytesBeforeGc", "rendererRssReady", "rendererRss", "gpuRss", "domNodes", "pages", "pagesSettledMs", "bytes", "requests")
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
    # A heap that could not be collected first is the uncollected figure under the collected
    # one's name: left out of the median while any run was collected, and counted either way.
    collected = [x for x in ok if x.get("heapBytes") is not None and not x.get("heapNotCollected")]
    return {
        **{k: median(ok, k) for k in SAMPLE_KEYS},
        "heapBytes": median(collected or ok, "heapBytes"),
        "rendererGrowth": int(statistics.median(growth)) if growth else None,
        "settleTimedOut": sum(1 for x in ok if x.get("settleTimedOut")),
        # Runs whose Settled is when the page count stopped, later than the last long task.
        "settledByPages": sum(1 for x in ok if x.get("settledBy") == "pages"),
        # Runs whose page count was still moving when the wait gave up, and runs whose heap could
        # not be collected first: the row's pages and heap are then not what they are called.
        "pagesStillChanging": sum(1 for x in ok if x.get("pagesStillChanging")),
        "heapNotCollected": sum(1 for x in ok if x.get("heapNotCollected")),
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
    if l.get("fetchTime"):
        out["fetchTime"] = l["fetchTime"]  # when Google made this analysis: the same time twice is one analysis (repeated_analysis)
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


PSI_REPEAT = "PageSpeed answered with an analysis it had already made (its cache): not counted again"


def repeated_analysis(x: dict, seen: dict, remember: bool = True) -> list[str]:
    """The form factors of analysis `x` that PageSpeed served from its cache.

    PageSpeed keeps an analysis for a short while and answers a second request for the same
    address with it. Five requests in three minutes came back as two or three analyses
    (2026-11-20, five pages per round: 18 of 50 were copies), and a median of copies is not a
    median of five. Every Lighthouse report carries the time it was made: one seen before, for
    the same page and form factor, is a copy. `seen` maps (page, form factor) to those times.
    With `remember`, the fresh ones are added to it; a caller that asks again before it
    publishes (scripts/measure_pagespeed.py) passes False and calls remember_analyses on what
    it publishes, so that an analysis it then threw away is not held against a later request.
    """
    again = []
    for f in ("desktop", "mobile"):
        at = (x.get(f) or {}).get("fetchTime")
        if not at:
            continue
        times = seen.setdefault((x.get("page"), f), set())
        if at in times:
            again.append(f)
        elif remember:
            times.add(at)
    return again


def remember_analyses(x: dict, seen: dict) -> None:
    """Count the analyses in `x` as published: the same one again is a copy from now on."""
    for f in ("desktop", "mobile"):
        at = (x.get(f) or {}).get("fetchTime")
        if at:
            seen.setdefault((x.get("page"), f), set()).add(at)


def without_repeats(x: dict, again: list[str]) -> dict:
    """`x` without the form factors that were copies: each is left out, with the reason, not counted twice."""
    if not again:
        return x
    out = {k: v for k, v in x.items() if k not in again}
    out.setdefault("error", PSI_REPEAT)
    out["repeated"] = again
    return out


def still_repeated(kept: dict, x: dict, again: list[str], owed: list[str] | None = None) -> list[str]:
    """Keep the fresh form factors of attempt `x` in `kept`; the ones still without a fresh analysis.

    An attempt can bring one form factor fresh and the other as a copy: the fresh one is kept,
    and only the other is owed. `owed` is what the attempt before left owed: an attempt that
    fails brings nothing, and without it the form factor stopped being asked for and lost its
    "repeated" mark. The first fresh report of a form factor is the one counted, whatever it
    says: a report with an error (the engine failed to start) is a result, which page_entry
    counts, and one that a later attempt replaced or asked for again would be a failure hidden.
    """
    for f in ("desktop", "mobile"):
        if f in x and f not in again and f not in kept:
            kept[f] = x[f]
    return [f for f in ("desktop", "mobile") if (f in again or f in (owed or [])) and f not in kept]


def with_kept(x: dict, kept: dict, missing: list[str]) -> dict:
    """The last attempt with the fresh form factors of the earlier ones, less those that stayed copies."""
    return without_repeats({**x, **kept}, missing)


async def stable_count(read, quiet_s: float, wait_s: float, pause: float = 0.5, now=time.monotonic, sleep=asyncio.sleep):
    """Read a count until it has not changed for `quiet_s`: (count, changes after the first reading, when it last changed, still changing).

    `read` returns the count, or None where the engine has no counter (nothing to wait for).
    A reading that fails (an engine laying out holds the main thread) is asked again until
    `wait_s` is over. "Still changing" is true when the wait ended first: with the count still
    moving, or with a count in hand (0 included) and the reads failing, which is not a count seen to stop.
    A count of 0 is waited on like any other: pages that have not been drawn yet are not "no pages".
    """
    count, changes, same_since, gave_up = None, -1, now(), now() + wait_s
    while True:
        try:
            got = await read()
        except Exception:
            if now() > gave_up:
                return count, changes, same_since, count is not None
            await sleep(pause)
            continue
        if got != count:
            count, changes, same_since = got, changes + 1, now()
        if count is None or now() - same_since >= quiet_s:
            return count, changes, same_since, False
        if now() > gave_up:
            return count, changes, same_since, True
        await sleep(pause)


def settle_by_pages(out: dict, pages_settled_ms: int, still_changing: bool) -> None:
    """Put the page count's last change into a run's Settled.

    Settled is "nothing left to do": a page count that moved after the long tasks went quiet
    says there was, so the later of the two is the run's Settled and `settledBy` says which.
    A count still moving when the wait gave up has no last change: the run then has no Settled
    at all (the time in hand is a lower bound, and was published as the figure before the
    review of 2026-11-20); what the long tasks said is kept as `settledMsLongTasks`.
    """
    if still_changing:
        out["pagesStillChanging"] = True
        if out.get("settledMs") is not None:
            out["settledMsLongTasks"] = out.pop("settledMs")
        out["settleTimedOut"] = True
        return
    out["pagesSettledMs"] = pages_settled_ms
    if out.get("settledMs") is not None and pages_settled_ms > out["settledMs"]:
        out["settledMsLongTasks"], out["settledMs"], out["settledBy"] = out["settledMs"], pages_settled_ms, "pages"


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


def chrome_args(env: dict | None = None) -> list[str]:
    """Extra Chrome start-up flags from OD_CHROME_ARGS, none by default.

    Split as a shell would: flags are separated by spaces, and quotes keep a value with spaces
    whole (`--user-agent="Benchmark Browser"`). A container needs them: Chrome will not start as
    root with its sandbox, and a small /dev/shm crashes it on a large document. A flag can change
    what is measured, so where_note() puts them in the published environment line.
    """
    return shlex.split((os.environ if env is None else env).get("OD_CHROME_ARGS", ""))


def where_note(default: str, env: dict | None = None) -> str:
    """Where a pass was measured: MEASURE_WHERE or `default`, plus any Chrome flag it does not name."""
    env = os.environ if env is None else env
    where = env.get("MEASURE_WHERE") or default
    unsaid = [a for a in chrome_args(env) if a not in where]
    return f"{where}; Chrome started with {' '.join(unsaid)}" if unsaid else where


def chrome_memory_of(rows: list[tuple[int, int, int, str]], profile: str) -> dict:
    """Renderer and GPU memory of the Chrome started on `profile`, from `ps` rows (pid, ppid, rss, command).

    Every process below the browser process counts, not only its direct children: on Linux
    Chrome forks renderers from its zygote, whose parent is the browser, so a parent-only
    filter reads 0 there.
    """
    # The whole argument, not a prefix of it: /tmp/p must not also take the Chrome on /tmp/pq.
    owned = {pid for pid, _, _, cmd in rows if f"--user-data-dir={profile}" in cmd.split() and "--type=" not in cmd}
    while True:
        more = {pid for pid, ppid, _, _ in rows if ppid in owned and pid not in owned}
        if not more:
            break
        owned |= more
    mine = [(rss, cmd) for pid, _, rss, cmd in rows if pid in owned]
    return {
        "rendererRss": sum(rss for rss, cmd in mine if "--type=renderer" in cmd),
        "renderers": sum(1 for _, cmd in mine if "--type=renderer" in cmd),
        "gpuRss": sum(rss for rss, cmd in mine if "--type=gpu-process" in cmd),
    }


def machine_load() -> dict:
    """How busy the machine is right now: the 1-minute load average and the core count.

    A timing taken while other work holds the processors is slower than the
    engine is; every run records this so a reader can tell.
    """
    return {"load1": round(os.getloadavg()[0], 2), "cores": os.cpu_count() or 1}


async def quiet_host(env: dict | None = None, load=None, sleep=asyncio.sleep, now=time.monotonic) -> str | None:
    """Wait until the machine is quiet enough to time a page; the reason, when it never was.

    On a shared host the load changes within minutes (2026-11-20: 38 when a step started, 98
    when it ended), so it is looked at before every run, not once per step. OD_MAX_LOAD is the
    1-minute load average a run may start under; without it nothing waits (one's own machine).
    OD_LOAD_WAIT_S is how long one run waits (six hours unless given). A wait that runs out
    stops the script like a Chrome that will not end: what was measured is written, the rest
    is left as it was, and the script ends with a status that says it did not finish.
    """
    env = os.environ if env is None else env
    if not env.get("OD_MAX_LOAD"):
        return None
    limit, wait = float(env["OD_MAX_LOAD"]), float(env.get("OD_LOAD_WAIT_S", 21600))
    load = load or (lambda: os.getloadavg()[0])
    end, said = now() + wait, False
    while (at := load()) > limit:
        if now() >= end:
            return f"the host stayed busy for {wait:g} s (load {at:.1f}, a run starts under {limit:g})"
        if not said:
            print(f"waiting for the host: load {at:.1f}, a run starts under {limit:g}", file=sys.stderr, flush=True)
            said = True
        await sleep(10)
    return None


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


def page_list(pages: str) -> list[str]:
    """The pages to analyse, each once, in the order given.

    A page named twice ran as two jobs of one round: both could keep the same fresh analysis
    while they waited for the other form factor, and both published it.
    """
    return list(dict.fromkeys(p.strip() for p in pages.split(",") if p.strip()))


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
