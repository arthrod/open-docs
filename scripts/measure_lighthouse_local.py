"""Lighthouse on pages of one of the two sites, run on this computer.

    uv run python -I scripts/measure_lighthouse_local.py https://editors.benchmarks.law e/superdoc,e/plate 3 --out docs/lighthouse/local.json
    ... e/superdoc 3 --query "open=lorem-500.docx" --label lorem-500 --out docs/lighthouse/local.json
    ... https://viewers.benchmarks.law v/docxodus,r/docxodus 3 --query "src=<docx url>" --label lorem-500 --out results/lighthouse-local.json

The same Lighthouse release PageSpeed runs (LIGHTHOUSE_VERSION), the same two form factors
(a phone on slow 4G with the CPU slowed four times, and a desktop) and the same figures as
scripts/measure_pagespeed.py, so the two tables can be read side by side. What differs is
the machine: Google's has no graphics card, and two engines that draw through one never
started there. Here they do. The price is that the figures depend on this computer and on
what else it is doing: every analysis records the machine's load and Lighthouse's own CPU
benchmark index, and the table is headed with both.

One analysis at a time, in the installed Chrome, headless. The runs of a page are spread in
time: every page once, then every page again. A cold browser profile each time (Lighthouse
starts its own Chrome).

LIGHTHOUSE_BIN  how to start Lighthouse (default: pnpm dlx lighthouse@<LIGHTHOUSE_VERSION>)
CHROME_PATH     the Chrome to drive (default: the installed Google Chrome on macOS)
MEASURE_WHERE   how to name this computer in the table's heading
OD_MAX_LOAD     a run starts only under this 1-minute load average (see measure_lib.quiet_host)
"""
import asyncio, datetime, json, os, shlex, subprocess, sys, tempfile, time

# These scripts are run with `python -I`, which leaves the script's folder off the import path.
sys.path.insert(0, __file__.rsplit("/", 1)[0])
from measure_lib import read_results, stop_lighthouse_chrome, lighthouse_local_cmd, lighthouse_local_env, machine_load, merge_pagespeed, page_entry, page_list, pagespeed_args, quiet_host, summarize

LIGHTHOUSE_VERSION = "13.6.0"
ARGS = pagespeed_args(sys.argv[1:])
BASE = ARGS.base.rstrip("/")
PAGES = page_list(ARGS.pages)
LIMIT_S = 240
BINARY = shlex.split(os.environ.get("LIGHTHOUSE_BIN", f"pnpm dlx lighthouse@{LIGHTHOUSE_VERSION}"))
CHROME = os.environ.get("CHROME_PATH") or next(
    (p for p in ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"] if os.path.exists(p)), None
)


# Chrome's own error page instead of the site: the connection failed before any page came back.
# That is this computer's network, not the page, so the analysis is made again (and says so).
NOT_LOADED = ("CHROME_INTERSTITIAL_ERROR", "ERRORED_DOCUMENT_REQUEST", "FAILED_DOCUMENT_REQUEST", "DNS_FAILURE")
LOAD_TRIES = 4
# The failures come in runs of minutes: the next try waits, longer each time.
LOAD_WAIT_S = 45


# The page came back and one of its own downloads did not (the engine's module, the document):
# also a fetch that failed from this computer. Made again like an unreached page; one that fails
# on every spaced try is recorded as the failure it is.
FETCH_FAILED = ("Failed to fetch dynamically imported module", "could not be fetched: 429", "Failed to load the editor code")


def unreached(error: str) -> bool:
    """Whether an analysis failed on a network fetch, not on what the page did with what it got."""
    return error.startswith(NOT_LOADED) or any(x in error for x in FETCH_FAILED)


def why_not_loaded(url: str, work: str) -> list[str]:
    """Chrome's own network errors for `url`, right after an analysis could not reach it: a probe, not a measurement."""
    if not CHROME:
        return []
    log = os.path.join(work, "netlog.json")
    try:
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", f"--user-data-dir={os.path.join(work, 'probe-profile')}", f"--log-net-log={log}",
                        "--dump-dom", url], capture_output=True, timeout=45)
        text = open(log, errors="replace").read()
        names = {v: k for k, v in json.loads(text[:text.index('"events"')].rstrip().rstrip(",") + "}")["constants"]["netError"].items()}
        import re
        return sorted({names.get(int(n), n) for n in re.findall(r'"net_error":(-\d+)', text)} - {"ERR_IO_PENDING", "ERR_ABORTED"})
    except (OSError, ValueError, KeyError, subprocess.TimeoutExpired) as e:
        return [f"probe failed: {type(e).__name__}"]


def analyse(page: str, form: str, work: str) -> dict:
    """One analysis, made again (up to LOAD_TRIES times) when the page could not be reached at all."""
    seen: list[str] = []
    for attempt in range(1, LOAD_TRIES + 1):
        # The load this attempt started under, read before it (an analysis can take minutes): a wait between attempts can change it.
        load = machine_load()
        got = {**analyse_once(page, form, work), **load}
        if not unreached(str(got.get("error", ""))):
            break
        url = f"{BASE}/{page}" + (f"?{ARGS.query}" if ARGS.query else "")
        seen += [e for e in why_not_loaded(url, work) if e not in seen]
        if attempt < LOAD_TRIES:
            time.sleep(LOAD_WAIT_S * attempt)
    more = {"loadTries": attempt} if attempt > 1 else {}
    return {**got, **more, **({"netErrors": seen} if seen else {})}


def no_report(said: str) -> str:
    """Why there is no report, from what Lighthouse printed, without this computer's folders in it."""
    if "execution-context" in said or "wait-for-condition" in said:
        # Its own evaluate or wait in the page never came back: the tab had stopped answering.
        return "Lighthouse stopped while waiting for the page and wrote no report"
    import re
    text = re.sub(r"(?:file://)?/(?:Users|home|private|var|tmp)/\S+", "<path>", " ".join(said.split()))
    return "Lighthouse wrote no report: " + text[-200:]


def analyse_once(page: str, form: str, work: str) -> dict:
    """One analysis: Lighthouse's report summarised, or why there is none."""
    url = f"{BASE}/{page}" + (f"?{ARGS.query}" if ARGS.query else "")
    out = os.path.join(work, "report.json")
    if os.path.exists(out):
        os.remove(out)
    try:
        # Lighthouse waits LIMIT_S for the page; its own start, trace and audits come on top.
        done = subprocess.run(lighthouse_local_cmd(BINARY, url, form, out, LIMIT_S), capture_output=True, text=True, timeout=LIMIT_S * 3,
            env={**os.environ, **({"CHROME_PATH": CHROME} if CHROME else {})},
        )
    except subprocess.TimeoutExpired:
        # The Chrome it started is detached and outlives it: the next analysis must not run beside it.
        subprocess.run(stop_lighthouse_chrome(), capture_output=True)
        return {"error": f"Lighthouse did not finish within {LIMIT_S * 3} s"}
    try:
        return summarize(json.load(open(out)), here=True)
    except (OSError, ValueError):
        return {"error": no_report((done.stderr or done.stdout or ""))}


async def main() -> int:
    # Read before measuring: a malformed --out file stops the run here, not after a long pass.
    result = read_results(ARGS.out)
    raw: list[dict] = []
    stopped = None
    with tempfile.TemporaryDirectory() as work:
        for run in range(ARGS.runs):
            for page in PAGES:
                x: dict = {"page": page, "run": run}
                for form in ("desktop", "mobile"):
                    if stopped := await quiet_host():
                        break
                    load = machine_load()
                    x.update(load)
                    # Each analysis carries the load of the attempt that produced it (analyse).
                    x[form] = await asyncio.to_thread(analyse, page, form, work)
                # A page stopped between its two analyses keeps the one it has, in the raw file only.
                if "desktop" in x or "mobile" in x:
                    raw.append(x)
                    print(json.dumps(x), file=sys.stderr, flush=True)
                if stopped:
                    break
            if stopped:
                break
    def publish() -> None:
        """Write the results: file work, kept off the event loop."""
        version = next((x[f]["version"] for x in raw for f in ("desktop", "mobile") if f in x and x[f].get("version")), LIGHTHOUSE_VERSION)
        chrome = subprocess.run([CHROME, "--version"], capture_output=True, text=True).stdout.strip() if CHROME else "Chrome"
        meta = {
            "measuredAt": datetime.date.today().isoformat(),
            "environment": lighthouse_local_env(version, ARGS.runs, raw, chrome, os.environ.get("MEASURE_WHERE", "this computer")),
            "base": BASE,
        }
        # Only the pages every run reached are published: a pass that was stopped keeps its raw file.
        whole = [p for p in PAGES if sum(1 for x in raw if x["page"] == p and "desktop" in x and "mobile" in x) == ARGS.runs]
        merge_pagespeed(result, {p: page_entry([x for x in raw if x["page"] == p], LIMIT_S, who="Lighthouse") for p in whole}, ARGS.label, meta)
        if ARGS.raw:
            os.makedirs(os.path.dirname(ARGS.raw) or ".", exist_ok=True)
            with open(ARGS.raw, "w") as f:
                f.write(json.dumps({**meta, "query": ARGS.query, "stopped": stopped, "raw": raw}, indent=1) + "\n")
        text = json.dumps(result, indent=1) + "\n"
        if ARGS.out:
            os.makedirs(os.path.dirname(ARGS.out) or ".", exist_ok=True)
            open(ARGS.out, "w").write(text)
        else:
            print(text)

    await asyncio.to_thread(publish)
    if stopped:
        print(f"stopped: {stopped}", file=sys.stderr)
        return 3
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
