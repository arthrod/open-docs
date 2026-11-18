"""Measure every editor opening this site's samples, in real Google Chrome.

    uv run --with playwright python -I scripts/measure_samples.py all showcase,redline,lorem-500 3 \
        --out docs/samples/2026-11-15.json --latest docs/samples/latest.json --shots .scratch/shots

One (engine, sample) per browser launch: the installed Chrome, headed, with a
fresh temporary profile (cold cache, no service workers). The page opens the
way a visitor's does, on a blank document, and the sample is loaded with the
Menu's own button (`.od-fixture`, `#od-showcase`), so the measured path is the
shipped one.

Per run:
  startupMs      navigation start → the editor is ready: the page's own reading, taken
                 when its mount() resolved (<html data-od-ready>, the figure its chip shows)
  loadMs         Menu click → two frames after the adapter's load() resolved
                 (lib/ui.ts `timedOpen`, read from <html data-od-loaded>)
  settledMs      Menu click → end of the last long main-thread task before two
                 quiet seconds: some loaders return before they draw, some keep
                 paginating after they return, so compare THIS on a long file
  heapBytes      JSHeapUsedSize of the top page (Chrome DevTools Protocol), 2 s
                 after the page reported the load (which it does after two quiet
                 seconds, or after 180 s of a main thread that never went quiet):
                 JavaScript objects only, no WebAssembly memory
  rendererRss    resident memory of every renderer process of this Chrome
                 (`ps`), same moment: this one does include WebAssembly memory,
                 canvases and the DOM, and cross-origin frames.
                 rendererRssReady is the same reading before the sample was
                 opened, one second after the editor was ready: an editor is
                 then on its blank document, so the difference is what the
                 document cost; a view-only engine already shows the rich
                 sample, so for it the difference is what REPLACING that cost
  gpuRss         resident memory of Chrome's GPU process (WordCraft draws there)
  bytes/requests response bytes and finished requests, all frames, whole run
  pages          how many pages the engine shows, where the DOM says (see PAGES)
  load1, cores   the machine's 1-minute load average when the run started, and its
                 core count: a timing taken on a busy machine is slower than the engine

Frame viewers (Microsoft, Google) render on their own servers: loadMs is the
frame's load event and the heap is this page's, not theirs.
"""
import asyncio, datetime, json, os, platform, subprocess, sys, tempfile, time

from playwright.async_api import async_playwright

# These scripts are run with `python -I`, which leaves the script's folder off the import path.
sys.path.insert(0, __file__.rsplit("/", 1)[0])
from measure_lib import chrome_args, chrome_memory_of, chrome_note, close_context, load_note, machine_load, merge_latest, runs_note, sample_row, stopped_path, where_note

BASE = os.environ.get("OD_BASE", "https://editors.benchmarks.law")
TIMEOUT_S = int(os.environ.get("OD_TIMEOUT_S", "240"))
EDITORS = ["canvas-editor", "docxodus", "superdoc", "plate", "docen", "eigenpal", "folio", "wordcraft", "react-docx", "univer", "opendoc", "betteroffice", "onlyoffice"]
VIEWERS = ["word-online", "google-viewer", "apryse", "nutrient"]
ALL = EDITORS + VIEWERS
# sample name → the Menu button that loads it
SAMPLES = {
    "showcase": "#od-showcase",
    "redline": '.od-fixture[data-file="redline.docx"]',
    "lorem-500": '.od-fixture[data-file="lorem-500.docx"]',
}
# What each engine offers as a page count: its DOM, or its own figure (None: it has no pages to count).
PAGES = """() => {
  const n = (s) => document.querySelectorAll(s).length;
  // "Page 1 of 3", in whatever language the browser asks for: the last number.
  const last = (t) => { const m = (t || '').match(/\\d+/g); return m ? Number(m[m.length - 1]) : null; };
  return {
    'canvas-editor': n('.ce-page-container canvas'),
    'superdoc': n('.superdoc-page'),
    'eigenpal': n('.layout-page'),
    'folio': n('.folio-page, .folio-page-shell, [data-page-number]'),
    'docxodus': n('.page-box'),
    // These keep only a window of pages in the DOM (react-docx: 3 of 500, seen 2026-11-18), so the
    // count is the engine's own.
    'react-docx': window.__reactDocx?.()?.getController?.()?.totalPages ?? null,
    'betteroffice': window.__betteroffice?.()?.getTotalPages?.() ?? null,
    'opendoc': last(document.querySelector('#opendoc-root iframe')?.contentDocument?.getElementById('statPages')?.textContent),
    'onlyoffice': document.querySelector('#oo-root iframe')?.contentWindow?.editor?.getCountPages?.() ?? null,
  };
}"""


def chrome_memory(profile: str) -> dict:
    """RSS (bytes) of the renderer and GPU processes of the Chrome using `profile`."""
    out = subprocess.run(["ps", "-axo", "pid=,ppid=,rss=,command="], capture_output=True, text=True).stdout
    rows = []
    for line in out.splitlines():
        parts = line.split(None, 3)
        if len(parts) == 4:
            rows.append((int(parts[0]), int(parts[1]), int(parts[2]) * 1024, parts[3]))
    return chrome_memory_of(rows, profile)


async def one(pw, slug: str, sample: str, shots: str | None) -> dict:
    out: dict = {"engine": slug, "sample": sample, **machine_load()}
    with tempfile.TemporaryDirectory() as profile:
        ctx = await pw.chromium.launch_persistent_context(
            profile, channel="chrome", headless=False, args=chrome_args(), viewport={"width": 1280, "height": 900}
        )
        try:
            # Keep these page loads out of the site's own metrics table.
            await ctx.add_init_script("try { localStorage.setItem('od:no-metrics', '1') } catch {}")
            page = ctx.pages[0] if ctx.pages else await ctx.new_page()
        except Exception as e:
            # Chrome started and gave no page: it is still there, and is closed like any other run's.
            left = await close_context(ctx, profile)
            return {**out, "error": f"{type(e).__name__}: {e}"[:300], **({"cleanup": left} if left else {})}
        sizes: list[int] = []

        async def finished(req):
            try:
                s = await req.sizes()
                sizes.append(s["responseHeadersSize"] + s["responseBodySize"])
            except Exception:
                sizes.append(0)

        ctx.on("requestfinished", lambda r: asyncio.ensure_future(finished(r)))
        try:
            await page.goto(f"{BASE}/e/{slug}", wait_until="commit", timeout=TIMEOUT_S * 1000)
            deadline = time.monotonic() + TIMEOUT_S

            async def until(js: str):
                while time.monotonic() < deadline:
                    try:
                        # An engine laying out 500 pages can hold the main thread for a long
                        # time; a call that gets no answer is asked again until the deadline.
                        v = await asyncio.wait_for(page.evaluate(js), 5)
                    except Exception:
                        v = None  # busy, or a frame navigated under the call (Google's viewer does)
                    if v:
                        return v
                    await asyncio.sleep(0.1)
                return None

            ready = await until(
                """() => {
                  if (/Just a moment|Attention Required/.test(document.title)) return {blocked: document.title};
                  const err = document.querySelector('.od-error pre');
                  if (err) return {error: err.textContent.slice(0, 300)};
                  // The page's own reading of when it became ready; this poll only notices it later.
                  const at = Number(document.documentElement.dataset.odReady);
                  if (at > 0) return {ms: at};
                  const l = document.getElementById('od-loading');
                  return l && l.hidden ? {ms: Math.round(performance.now()), polled: true} : null;
                }"""
            )
            if not ready or "ms" not in ready:
                out.update(ready or {"error": f"not ready within {TIMEOUT_S}s"})
                raise StopIteration
            out["startupMs"] = ready["ms"]
            out["chrome"] = (await asyncio.wait_for((await ctx.new_cdp_session(page)).send("Browser.getVersion"), 30)).get("product")
            if ready.get("polled"):
                out["startupPolled"] = True  # a page without data-od-ready: late by up to one polling interval
            await asyncio.sleep(1.0)
            out["rendererRssReady"] = chrome_memory(profile)["rendererRss"]
            # Viewers open the rich sample themselves; clicking loads it again, measured the same way.
            await page.evaluate("(s) => document.querySelector(s).click()", SAMPLES[sample])
            loaded = await until(
                """() => {
                  const d = document.documentElement.dataset.odLoaded;
                  if (d) return JSON.parse(d);
                  const err = document.querySelector('.od-error pre');
                  if (err) return {error: err.textContent.slice(0, 300)};
                  const s = document.getElementById('od-status');
                  return s && s.classList.contains('err') ? {error: s.textContent.slice(0, 300)} : null;
                }"""
            )
            if not loaded or "ms" not in loaded:
                out.update(loaded or {"error": f"not loaded within {TIMEOUT_S}s of navigation (the page stopped answering)"})
                raise StopIteration
            out["loadMs"] = loaded["ms"]
            if loaded.get("settledMs") is not None:
                out["settledMs"] = loaded["settledMs"]
            if loaded.get("settleTimedOut"):
                out["settleTimedOut"] = True  # still busy when the page stopped waiting: no settled time
            await asyncio.sleep(2.0)  # trailing requests (the page already waited for two quiet seconds)
            out.update(chrome_memory(profile))
            cdp = await ctx.new_cdp_session(page)
            await cdp.send("Performance.enable")
            m = {x["name"]: x["value"] for x in (await asyncio.wait_for(cdp.send("Performance.getMetrics"), 60))["metrics"]}
            out["heapBytes"] = int(m.get("JSHeapUsedSize", 0))
            out["domNodes"] = int(m.get("Nodes", 0))
            pages = (await asyncio.wait_for(page.evaluate(PAGES), 60)).get(slug)
            if pages:
                out["pages"] = pages
        except StopIteration:
            pass
        except Exception as e:
            out["error"] = f"{type(e).__name__}: {e}"[:300]
        if "rendererRss" not in out:
            out.update(chrome_memory(profile))  # a failed run still says what it had used
        if shots:
            os.makedirs(shots, exist_ok=True)
            try:
                await page.screenshot(path=f"{shots}/{slug}-{sample}.png", timeout=15000)
            except Exception:
                pass
        out["bytes"] = sum(sizes)
        out["requests"] = len(sizes)
        left = await close_context(ctx, profile)
        if left:
            out["cleanup"] = left
            print(f"{slug}/{sample}: {left}", file=sys.stderr, flush=True)
    return out


async def main():
    engines = {"all": ALL, "editors": EDITORS, "viewers": VIEWERS}.get(sys.argv[1]) or sys.argv[1].split(",")
    samples = sys.argv[2].split(",")
    runs = int(sys.argv[3])
    opt = lambda k: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else None
    raw = []
    stopped = None
    async with async_playwright() as pw:
        for r in range(runs):
            for s in samples:
                for e in engines:
                    try:
                        x = await one(pw, e, s, opt("--shots") if r == 0 else None)
                    except Exception as ex:
                        # A Chrome that would not start, or gave no page: this run failed, and the runs
                        # already made are still written (one() only catches what happens after setup).
                        x = {"engine": e, "sample": s, **machine_load(), "error": f"{type(ex).__name__}: {ex}"[:300]}
                    raw.append(x)
                    print(json.dumps(x), file=sys.stderr, flush=True)
                    if x.get("cleanup"):
                        stopped = x["cleanup"]
                        break
                if stopped:
                    break
            if stopped:
                # A Chrome that would not end is still using the machine: what was measured so far is
                # written, and nothing more is measured beside it.
                print(f"stopping: {stopped}", file=sys.stderr, flush=True)
                break
    summary: dict = {}
    for s in samples:
        for e in engines:
            xs = [x for x in raw if x["engine"] == e and x["sample"] == s]
            if xs:  # a run that was stopped early leaves the engines it never reached as they were
                summary.setdefault(s, {})[e] = sample_row(xs)
    where = where_note(f"{platform.system()} {platform.machine()}")
    result = {
        "measuredAt": datetime.date.today().isoformat(),
        "environment": f"{chrome_note(raw)} (installed, headed) via Playwright, fresh profile per run (cold cache), {runs_note(runs, raw)}, median; {where}; {load_note(raw)}",
        "base": BASE,
        "samples": summary,
        "raw": raw,
    }
    if opt("--latest"):
        # The medians only, merged over what is there: this is what the landing page renders.
        try:
            latest = json.load(open(opt("--latest")))
        except (OSError, ValueError):
            latest = {}
        # Each row keeps the date and environment it was measured under (measure_lib.merge_latest).
        with open(opt("--latest"), "w") as f:
            f.write(json.dumps(merge_latest(latest, summary, result), indent=1) + "\n")
    text = json.dumps(result, indent=1) + "\n"
    if opt("--out"):
        # A stopped run's runs go beside the day's file: the rows it did not reach keep theirs.
        dest = stopped_path(opt("--out")) if stopped else opt("--out")
        os.makedirs(os.path.dirname(dest) or ".", exist_ok=True)
        open(dest, "w").write(text)
    else:
        print(text)


asyncio.run(main())
