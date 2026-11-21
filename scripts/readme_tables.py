"""Write the measured tables of README.md from the result files, or check that they match.

    python3 scripts/readme_tables.py            # rewrite the blocks in README.md
    python3 scripts/readme_tables.py --check    # exit 1 if README.md is not what the files say

The blocks are the text between `<!-- samples:start -->` / `<!-- samples:end -->`
and `<!-- lighthouse:start -->` / `<!-- lighthouse:end -->`. They are never
edited by hand: a table typed beside its data goes stale (the samples table once
kept a memory growth of −29 MB after the data had been corrected to +25 MB).
"""
import json
import math
import re
import sys

ROOT = __file__.rsplit("/", 2)[0]
NAMES = {
    "canvas-editor": "canvas-editor", "cite-check": "cite-check", "docxodus": "Docxodus", "superdoc": "SuperDoc",
    "plate": "Plate", "docen": "docen", "eigenpal": "docx-editor.dev", "folio": "folio", "wordcraft": "WordCraft", "react-docx": "react-docx", "univer": "Univer", "opendoc": "OpenDoc", "betteroffice": "BetterOffice", "onlyoffice": "OnlyOffice (CryptPad build)",
    "word-online": "Word Online viewer", "google-viewer": "Google viewer", "apryse": "Apryse WebViewer", "nutrient": "Nutrient",
}
# Cross-origin frames: only the frame's load is timed, and the heap is not theirs.
FRAMES = {"word-online", "google-viewer"}
SAMPLE_TITLES = (
    ("showcase", "Rich sample (`showcase.docx`, 3 pages)"),
    ("redline", "Redline (`redline.docx`, 3 pages)"),
    ("lorem-500", "500 pages (`lorem-500.docx`)"),
)


def rnd(x: float) -> int:
    """Round half up, as the landing page's Math.round does: Python's round() sends 84.5 to 84."""
    return math.floor(x + 0.5)


def num(x) -> str:
    """A number as JavaScript prints it: 0.0 is "0"."""
    return str(int(x)) if isinstance(x, float) and x.is_integer() else str(x)


def ms(n) -> str:
    """A duration the way the landing page writes it."""
    if n is None:
        return "n/a"
    return f"{rnd(n)} ms" if n < 1000 else f"{n / 1000:.2f} s" if n < 10000 else f"{n / 1000:.1f} s"


def mb(n) -> str:
    """A size in bytes the way the landing page writes it."""
    if n is None:
        return "n/a"
    return f"{rnd(n / 1024)} KB" if n < 1048576 else f"{rnd(n / 1048576)} MB"


def cell(text) -> str:
    """Text safe inside a Markdown table cell: one line, no column separator."""
    return str(text).splitlines()[0].replace("|", "\\|")[:160] if str(text) else ""


LOAD = "; machine load (1-minute average) "


def machine(env: str | None) -> str:
    """The environment without the host load of the step that wrote it: steps of one pass differ in nothing else."""
    return (env or "").split(LOAD)[0]


def host_load(rows: dict, head: dict) -> str:
    """One line with the host load of a table's runs, from its rows (or the heading when they carry none)."""
    said = list(dict.fromkeys(e.split(LOAD)[1] for e in [r.get("environment") or head.get("environment") or "" for r in rows.values()] if LOAD in e))
    return f"Host load during these runs (1-minute average): {'; '.join(said)}." if said else ""


def elsewhere(row: dict, head: dict) -> str:
    """" (measured DATE)" for a row from another day than its table, with the environment when that differs."""
    when, where = row.get("measuredAt") or head.get("measuredAt"), row.get("environment") or head.get("environment")
    # Another address than its table's (the site under another name) is another measurement too.
    on = f" on {row['base']}" if row.get("base") and head.get("base") and row["base"] != head["base"] else ""
    if machine(where) != machine(head.get("environment")):
        return f" (measured {when}{on}: {cell(where)})"
    return f" (measured {when}{on})" if on or when != head.get("measuredAt") else ""


def samples_block(data: dict) -> str:
    """The samples tables: one per sample, a row per engine, from docs/samples/latest.json."""
    out = [f"Measured {data['measuredAt']}: {machine(data['environment'])}.", ""]
    for sample, title in SAMPLE_TITLES:
        rows = data["samples"].get(sample)
        if not rows:
            continue
        load = host_load(rows, data)
        out += [
            f"**{title}**", "", *([load, ""] if load else []),
            "| Engine | Loaded | Settled | JS heap | Renderer memory (growth) | Pages shown | Runs that loaded |",
            "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
        ]
        for engine, r in rows.items():
            runs = r.get("runs") or []
            loaded = f"{sum(1 for x in runs if x is not None)} of {len(runs)}"
            name = NAMES.get(engine, engine)
            name += elsewhere(r, data)
            if r.get("loadMs") is None:
                out.append(f"| {name} | **did not open it**: {cell(r.get('failed') or 'no answer')} | | | | | {loaded} |")
                continue
            frame = engine in FRAMES
            grew = r.get("rendererGrowth")
            growth = "" if grew is None else f" ({'+' if grew >= 0 else '−'}{mb(abs(grew))})"
            busy = r.get("settleTimedOut") or 0
            settled = "n/a" if frame else "still busy after 180 s" if r.get("settledMs") is None and busy else ms(r.get("settledMs"))
            if not frame and r.get("settledMs") is not None and busy:
                settled += f" ({busy} of {sum(1 for x in runs if x is not None)} runs still busy after 180 s)"
            out.append(
                f"| {name} | {ms(r['loadMs'])} | {settled} | {'n/a' if frame else mb(r.get('heapBytes'))} | "
                f"{mb(r.get('rendererRss'))}{growth} | {r.get('pages') or 'n/a'} | {loaded} |"
            )
        out.append("")
    return "\n".join(out).rstrip()


LH_HEAD = [
    "| Page | Performance | LCP | TBT | CLS | FCP | Speed Index | Accessibility | Best practices | SEO | Performance, each analysis |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
]


def lighthouse_line(label: str, r: dict, head: dict, who: str = "PageSpeed") -> str:
    """One page's row: desktop · mobile in each cell. `who` made the analyses."""
    d, m = r["desktop"], r["mobile"]
    label += elsewhere(r, head)
    if d.get("performance") is None and m.get("performance") is None:
        return f"| {label} | **no result**: {cell(d.get('error') or m.get('error') or f'{who} gave no score')} | | | | | | | | | |"
    two = lambda k, f=str: f"{'n/a' if d.get(k) is None else f(d[k])} · {'n/a' if m.get(k) is None else f(m[k])}"
    runs = lambda x: "/".join("fail" if v is None else str(v) for v in x.get("performanceRuns") or [])
    one = lambda k: d[k] if d.get(k) is not None else "n/a"
    return (
        f"| {label} | {two('performance')} | {two('lcpMs', ms)} | {two('tbtMs', ms)} | {two('cls', num)} | {two('fcpMs', ms)} | "
        f"{two('speedIndexMs', ms)} | {one('accessibility')} | {one('bestPractices')} | {one('seo')} | {runs(d)} · {runs(m)} |"
    )


def lighthouse_block(data: dict, who: str = "PageSpeed") -> str:
    """The Lighthouse tables: the blank page, then the same pages opening the 500-page sample."""
    said = lambda h: f"Measured {h['measuredAt']}: {h['environment']}. Cells read desktop · mobile; accessibility, best practices and SEO are the desktop scores."
    label = lambda k: NAMES.get(k[2:], k)
    out = ["**Blank document (the page as it opens)**", "", said(data), "", *LH_HEAD]
    out += [lighthouse_line(label(k), r, data, who) for k, r in data["pages"].items()]
    big = data.get("docs", {}).get("lorem-500")
    if big:
        head = {"base": data.get("base"), **(data.get("docsMeta", {}).get("lorem-500") or data)}
        out += ["", "**Opening the 500 pages sample (`?open=lorem-500.docx`)**", ""]
        if (head.get("measuredAt"), head.get("environment")) != (data.get("measuredAt"), data.get("environment")):
            out += [said(head), ""]
        out += [*LH_HEAD, *[lighthouse_line(label(k), r, head, who) for k, r in big.items()]]
    return "\n".join(out)


def local_block(data: dict) -> str:
    """The same tables from Lighthouse run on our computer (docs/lighthouse/local.json)."""
    return lighthouse_block(data, "Lighthouse") if data.get("pages") else "Not measured yet."


def put(text: str, name: str, body: str) -> str:
    """`text` with the named block replaced by `body`. The markers must be there."""
    start, end = f"<!-- {name}:start -->", f"<!-- {name}:end -->"
    if start not in text or end not in text:
        raise SystemExit(f"README.md has no {start} … {end} block")
    return re.sub(re.escape(start) + r".*?" + re.escape(end), lambda _: f"{start}\n{body}\n{end}", text, flags=re.S)


def render(readme: str, samples: dict, lighthouse: dict, local: dict | None = None) -> str:
    """README.md with its blocks written from the data."""
    out = put(put(readme, "samples", samples_block(samples)), "lighthouse", lighthouse_block(lighthouse))
    return out if local is None else put(out, "lighthouse-local", local_block(local))


def main(argv: list[str]) -> int:
    path = f"{ROOT}/README.md"
    before = open(path).read()
    after = render(before, json.load(open(f"{ROOT}/docs/samples/latest.json")), json.load(open(f"{ROOT}/docs/lighthouse/latest.json")), json.load(open(f"{ROOT}/docs/lighthouse/local.json")))
    if "--check" in argv:
        if after != before:
            print("README.md tables do not match docs/samples/latest.json, docs/lighthouse/latest.json and docs/lighthouse/local.json: run scripts/readme_tables.py", file=sys.stderr)
            return 1
        return 0
    if after != before:
        open(path, "w").write(after)
        print("README.md tables rewritten", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
