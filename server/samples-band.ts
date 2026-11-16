/**
 * The landing page's "/ Samples" band: every engine opening the redline and
 * the 500-page sample, measured by scripts/measure_samples.py and published
 * as docs/samples/latest.json (the medians; the dated file beside it keeps
 * every run).
 */
import LATEST from "../docs/samples/latest.json" with { type: "json" };
import type { EditorMeta } from "./registry.ts";
import { FIXTURES } from "./fixtures.ts";
import { REVISION_NOTES } from "../lib/revision-notes.ts";

export interface SampleRow {
  startupMs: number | null;
  /** Menu click → the adapter's load() resolved (+2 frames). */
  loadMs: number | null;
  /** Menu click → end of the last long main-thread task before a quiet second. */
  settledMs: number | null;
  heapBytes: number | null;
  /** Renderer processes' resident memory before the sample was opened, and after. */
  rendererRssReady: number | null;
  rendererRss: number | null;
  gpuRss: number | null;
  pages: number | null;
  runs: (number | null)[];
  /** Why it did not load, when it did not. */
  failed: string | null;
  /** Median of each run's own (after − before) renderer memory. Absent in files written before it was recorded. */
  rendererGrowth?: number | null;
  /** How many runs were still busy when the page stopped waiting (180 s): those have no settled time. */
  settleTimedOut?: number;
  /** An error from a run that did load: its timing stands, some later readings are missing. */
  incomplete?: string | null;
  /** When and where this row was measured, when a partial re-run measured it apart from the others. */
  measuredAt?: string;
  environment?: string;
  base?: string;
}
export interface SampleMeasurements {
  measuredAt: string | null;
  environment: string;
  /** The site the rows were measured against. */
  base?: string;
  samples: Record<string, Record<string, SampleRow>>;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ms = (n: number | null | undefined) =>
  n == null ? "n/a" : n < 1000 ? `${Math.round(n)} ms` : `${(n / 1000).toFixed(n < 10_000 ? 2 : 1)} s`;
const mb = (n: number | null | undefined) =>
  n == null ? "n/a" : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${Math.round(n / 1048576)} MB`;

const INTRO: Record<string, string> = {
  "redline.docx":
    "The rich sample after two reviewers. What matters here is the last column: whether the reader can see what changed.",
  "lorem-500.docx":
    "500 pages in Microsoft Word. <b>Settled</b> is the number to compare: some engines report “loaded” before they draw, and some keep paginating after.",
};

export function samplesBand(all: EditorMeta[], data: SampleMeasurements = LATEST as SampleMeasurements): string {
  const tables = FIXTURES.map((f) => {
    const id = f.file.replace(/\.docx$/, "");
    const rows = data.samples[id];
    if (!rows) return "";
    const redline = id === "redline";
    const row = (e: EditorMeta) => {
      const r = rows[e.slug];
      if (!r) return "";
      const frame = e.opensFiles === false;
      // Said only where it differs from the heading: a row re-measured on another day or machine.
      const otherBase = !!r.base && !!data.base && r.base !== data.base;
      const elsewhere = (r.measuredAt && r.measuredAt !== data.measuredAt) || (r.environment && r.environment !== data.environment) || otherBase
        ? ` <small class="prov">measured ${esc(r.measuredAt ?? "")}: ${esc(r.environment ?? "")}${otherBase ? ` · ${esc(r.base!)}` : ""}</small>`
        : "";
      const incomplete = r.incomplete ? ` <small class="prov-warn">incomplete: ${esc(r.incomplete.split("\n")[0].slice(0, 120))}</small>` : "";
      const name = `<a href="/e/${e.slug}">${esc(e.name)}</a>${e.kind === "viewer" ? ` <span class="vo">view-only</span>` : ""}${elsewhere}${incomplete}`;
      if (r.loadMs == null) {
        return `<tr><td>${name}</td><td colspan="${redline ? 4 : 5}"><b>did not open it</b>: ${esc((r.failed ?? "no answer").split("\n")[0].slice(0, 160))}</td>${
          redline ? `<td class="hide-sm">${esc(REVISION_NOTES[e.slug] ?? "")}</td>` : ""
        }</tr>`;
      }
      // Each run's own growth, median. Without it nothing is shown: the two medians beside it can
      // come from different runs, and their difference was once −29 MB where the runs said +25 MB.
      const grew = r.rendererGrowth ?? null;
      const settled = frame ? "n/a" : r.settledMs == null && r.settleTimedOut ? "still busy after 180 s" : ms(r.settledMs);
      return `<tr><td>${name}</td>
      <td class="n">${ms(r.loadMs)}</td>
      <td class="n"><b>${settled}</b></td>
      <td class="n">${frame ? "n/a" : mb(r.heapBytes)}</td>
      <td class="n" title="before ${mb(r.rendererRssReady)}, after ${mb(r.rendererRss)}">${mb(r.rendererRss)}${grew != null ? ` <small>(${grew >= 0 ? "+" : "−"}${mb(Math.abs(grew))})</small>` : ""}</td>
      ${redline ? `<td class="hide-sm">${esc(REVISION_NOTES[e.slug] ?? "")}</td>` : `<td class="n hide-sm">${r.pages ?? "n/a"}</td>`}
    </tr>`;
    };
    return `<h3 class="smp-h" id="sample-${id}">The ${esc(f.label)} sample <small>${esc(f.file)} · ${esc(f.note)} · <a href="/api/${f.file}">download ↓</a></small></h3>
  <p class="sec-copy">${INTRO[f.file] ?? ""}</p>
  <div class="table-wrap"><table class="tbl"><thead><tr>
    <th>Engine</th><th class="n">Loaded</th><th class="n">Settled</th><th class="n">JS heap</th><th class="n">Renderer memory</th>
    ${redline ? `<th class="hide-sm">Tracked changes</th>` : `<th class="n hide-sm">Pages shown</th>`}
  </tr></thead><tbody>${all.map(row).join("")}</tbody></table></div>`;
  }).join("\n");
  if (!tables.trim()) return "";
  return `<section class="band" id="samples"><div class="wrap">
  <h2 class="sec-label"><span class="sq" aria-hidden="true"></span> / Samples</h2>
  <p class="sec-copy">Every engine opening the two harder samples from its own Menu, measured ${esc(data.measuredAt ?? "")}: ${esc(data.environment)}.
  <b>Loaded</b>: Menu click until the engine's own loader returns. <b>Settled</b>: Menu click until the page's main thread has been quiet for a second (work in a worker or on the GPU is not seen).
  <b>JS heap</b>: JavaScript objects only. <b>Renderer memory</b>: resident memory of Chrome's renderer processes, which also counts WebAssembly memory, canvases and the DOM; in brackets, how much it grew when the sample was opened.
  Microsoft's and Google's viewers render on their own servers, so only their frame's load is timed.</p>
  ${tables}
</div></section>`;
}
