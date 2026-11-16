"""Measure every editor opening this site's samples, in real Google Chrome.

    uv run --with playwright python -I scripts/measure_samples.py all showcase,redline,lorem-500 3 \
        --out docs/samples/2026-11-15.json --latest docs/samples/latest.json --shots .scratch/shots

One (engine, sample) per browser launch: the installed Chrome, headed, with a
fresh temporary profile (cold cache, no service workers). The page opens the
way a visitor's does, on a blank document, and the sample is loaded with the
Menu's own button (`.od-fixture`, `#od-showcase`), so the measured path is the
shipped one.

Per run:
  startupMs      navigation start → the editor is ready (loading overlay gone)
  loadMs         Menu click → two frames after the adapter's load() resolved
                 (lib/ui.ts `timedOpen`, read from <html data-od-loaded>)
  settledMs      Menu click → end of the last long main-thread task before a
                 quiet second: some loaders return before they draw, some keep
                 paginating after they return, so compare THIS on a long file
  heapBytes      JSHeapUsedSize of the top page (Chrome DevTools Protocol), 3 s
                 after the load: JavaScript objects only, no WebAssembly memory
  rendererRss    resident memory of every renderer process of this Chrome
                 (`ps`), same moment: this one does include WebAssembly memory,
                 canvases and the DOM, and cross-origin frames.
                 rendererRssReady is the same reading before the sample was
                 opened (the editor on its blank document), so the difference
                 is what the document cost
  gpuRss         resident memory of Chrome's GPU process (WordCraft draws there)
  bytes/requests response bytes and finished requests, all frames, whole run
  pages          how many pages the engine shows, where the DOM says (see PAGES)

Frame viewers (Microsoft, Google) render on their own servers: loadMs is the
frame's load event and the heap is this page's, not theirs.
"""
import asyncio, datetime, json, os, platform, statistics, subprocess, sys, tempfile, time

from playwright.async_api import async_playwright

BASE = os.environ.get("OD_BASE", "https://editors.benchmarks.law")
TIMEOUT_S = int(os.environ.get("OD_TIMEOUT_S", "240"))
EDITORS = ["canvas-editor", "docxodus", "superdoc", "plate", "docen", "eigenpal", "folio", "wordcraft"]
VIEWERS = ["word-online", "google-viewer", "apryse", "nutrient"]
ALL = EDITORS + VIEWERS
# sample name → the Menu button that loads it
SAMPLES = {
    "showcase": "#od-showcase",
    "redline": '.od-fixture[data-file="redline.docx"]',
    "lorem-500": '.od-fixture[data-file="lorem-500.docx"]',
}
# What each engine's DOM offers as a page count (None: it draws to one canvas, or in a frame).
PAGES = """() => {
  const n = (s) => document.querySelectorAll(s).length;
  return {
    'canvas-editor': n('.ce-page-container canvas'),
    'superdoc': n('.superdoc-page'),
    'eigenpal': n('.layout-page'),
    'folio': n('.folio-page, .folio-page-shell, [data-page-number]'),
    'docxodus': n('.page-box'),
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
    roots = {pid for pid, _, _, cmd in rows if f"--user-data-dir={profile}" in cmd and "--type=" not in cmd}
    kids = [(rss, cmd) for _, ppid, rss, cmd in rows if ppid in roots]
    return {
        "rendererRss": sum(rss for rss, cmd in kids if "--type=renderer" in cmd),
        "renderers": sum(1 for _, cmd in kids if "--type=renderer" in cmd),
        "gpuRss": sum(rss for rss, cmd in kids if "--type=gpu-process" in cmd),
    }


async def one(pw, slug: str, sample: str, shots: str | None) -> dict:
    out: dict = {"engine": slug, "sample": sample}
    with tempfile.TemporaryDirectory() as profile:
        ctx = await pw.chromium.launch_persistent_context(
            profile, channel="chrome", headless=False, viewport={"width": 1280, "height": 900}
        )
        # Keep these page loads out of the site's own metrics table.
        await ctx.add_init_script("try { localStorage.setItem('od:no-metrics', '1') } catch {}")
        page = ctx.pages[0] if ctx.pages else await ctx.new_page()
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
                  const l = document.getElementById('od-loading');
                  return l && l.hidden ? {ms: Math.round(performance.now())} : null;
                }"""
            )
            if not ready or "ms" not in ready:
                out.update(ready or {"error": f"not ready within {TIMEOUT_S}s"})
                raise StopIteration
            out["startupMs"] = ready["ms"]
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
            await asyncio.sleep(2.0)  # trailing requests (the page already waited for a quiet second)
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
        try:
            await asyncio.wait_for(ctx.close(), 20)
        except Exception:
            # A renderer that never yields does not close either: end that Chrome.
            subprocess.run(["pkill", "-f", f"--user-data-dir={profile}"])
    return out


async def main():
    engines = {"all": ALL, "editors": EDITORS, "viewers": VIEWERS}.get(sys.argv[1]) or sys.argv[1].split(",")
    samples = sys.argv[2].split(",")
    runs = int(sys.argv[3])
    opt = lambda k: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else None
    raw = []
    async with async_playwright() as pw:
        for r in range(runs):
            for s in samples:
                for e in engines:
                    x = await one(pw, e, s, opt("--shots") if r == 0 else None)
                    raw.append(x)
                    print(json.dumps(x), file=sys.stderr, flush=True)
    summary: dict = {}
    for s in samples:
        for e in engines:
            xs = [x for x in raw if x["engine"] == e and x["sample"] == s]
            ok = [x for x in xs if "loadMs" in x]
            med = lambda k: int(statistics.median(x[k] for x in ok if k in x)) if any(k in x for x in ok) else None
            summary.setdefault(s, {})[e] = {
                **{k: med(k) for k in ("startupMs", "loadMs", "settledMs", "heapBytes", "rendererRssReady", "rendererRss", "gpuRss", "domNodes", "pages", "bytes", "requests")},
                "runs": [x.get("loadMs") for x in xs],
                "failed": next((x.get("error") or x.get("blocked") for x in xs if "loadMs" not in x), None),
            }
    where = os.environ.get("MEASURE_WHERE") or f"{platform.system()} {platform.machine()}"
    result = {
        "measuredAt": datetime.date.today().isoformat(),
        "environment": f"Google Chrome (installed, headed) via Playwright, fresh profile per run (cold cache), {runs} runs, median; {where}",
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
        merged = latest.get("samples", {})
        for s, rows in summary.items():
            merged.setdefault(s, {}).update(rows)
        with open(opt("--latest"), "w") as f:
            f.write(json.dumps({**{k: result[k] for k in ("measuredAt", "environment", "base")}, "samples": merged}, indent=1) + "\n")
    text = json.dumps(result, indent=1) + "\n"
    if opt("--out"):
        os.makedirs(os.path.dirname(opt("--out")) or ".", exist_ok=True)
        open(opt("--out"), "w").write(text)
    else:
        print(text)


asyncio.run(main())
