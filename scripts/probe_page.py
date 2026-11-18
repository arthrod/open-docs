"""Open one page in the installed Chrome and print why it did or did not get ready.

    uv run --with playwright python -I scripts/probe_page.py https://editors.benchmarks.law/e/opendoc 90

For an engine that fails on a measuring machine and works elsewhere: every console error, every
failed or refused request (all frames), and the page's own status after the wait.
"""
import asyncio, json, sys, tempfile

from playwright.async_api import async_playwright

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from measure_lib import chrome_args


async def main() -> None:
    url, wait_s = sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 90
    async with async_playwright() as pw:
        with tempfile.TemporaryDirectory() as profile:
            ctx = await pw.chromium.launch_persistent_context(profile, channel="chrome", headless=False, args=chrome_args(), viewport={"width": 1280, "height": 900})
            page = ctx.pages[0] if ctx.pages else await ctx.new_page()
            statuses: dict[int, int] = {}
            page.on("console", lambda m: print("console", m.type, m.text[:400], flush=True) if m.type in ("error", "warning") else None)
            page.on("pageerror", lambda e: print("pageerror", str(e)[:400], flush=True))
            page.on("requestfailed", lambda r: print("failed", r.failure, r.url[:160], flush=True))

            def response(r) -> None:
                statuses[r.status] = statuses.get(r.status, 0) + 1
                if r.status >= 400:
                    print("status", r.status, r.url[:160], flush=True)

            ctx.on("response", response)
            await page.goto(url, wait_until="commit")
            for _ in range(wait_s):
                await asyncio.sleep(1)
                if await page.evaluate("() => !!document.documentElement.dataset.odReady || !!document.querySelector('.od-error')"):
                    break
            state = await page.evaluate(
                """() => ({ ready: document.documentElement.dataset.odReady || null,
                           error: document.querySelector('.od-error')?.innerText?.slice(0, 300) || null,
                           frames: [...document.querySelectorAll('iframe')].map((f) => { try { const d = f.contentDocument; return { src: f.src.slice(0, 120), body: d?.body?.className, text: d?.body?.innerText?.slice(0, 200), webgl: !!d?.createElement('canvas').getContext('webgl2') }; } catch (e) { return { src: f.src.slice(0, 120), blocked: String(e).slice(0, 80) }; } }) })"""
            )
            print("state", json.dumps(state), flush=True)
            print("responses by status", json.dumps(statuses), flush=True)
            await ctx.close()


asyncio.run(main())
