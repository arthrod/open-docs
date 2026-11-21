/**
 * The landing page's "/ Samples" band: every engine opening the redline and
 * the 500-page sample, measured by scripts/measure_samples.py and published
 * as docs/samples/latest.json (the medians; the dated file beside it keeps
 * every run).
 */
import LATEST from "../docs/samples/latest.json" with { type: "json" };
import CAVEATS from "../docs/samples/caveats.json" with { type: "json" };
import type { EditorMeta } from "./registry.ts";
import { FIXTURES } from "./fixtures.ts";
import { REVISION_NOTES } from "../lib/revision-notes.ts";

export interface SampleRow {
  startupMs: number | null;
  /** Menu click → the adapter's load() resolved (+2 frames). */
  loadMs: number | null;
  /** Menu click → end of the last long main-thread task before two quiet seconds. */
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
  /** How many runs still had a moving page count when the wait gave up: `pages` is then not the document's. */
  pagesStillChanging?: number;
  /** How many runs' heap could not be collected before it was read: `heapBytes` then holds garbage. */
  heapNotCollected?: number;
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
/** A number from a results file, or null: anything else (a string in a hand-edited file) is not written into the page. */
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const ms = (v: number | null | undefined) => {
  const n = num(v);
  return n == null ? "n/a" : n < 1000 ? `${Math.round(n)} ms` : `${(n / 1000).toFixed(n < 10_000 ? 2 : 1)} s`;
};
const mb = (v: number | null | undefined) => {
  const n = num(v);
  return n == null ? "n/a" : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${Math.round(n / 1048576)} MB`;
};

const INTRO: Record<string, string> = {
  "redline.docx":
    "The rich sample after two reviewers. What matters here is the last column: whether the reader can see what changed.",
  "lorem-500.docx":
    "500 pages in Microsoft Word. <b>Settled</b> is the number to compare: some engines report “loaded” before they draw, and some keep paginating after.",
};

/**
 * Published figures that were looked at again and found wrong, unreliable or about the machine
 * (docs/samples/caveats.json; the README's "Figures to distrust" has the evidence). Said under
 * the engine's name, because a wrong figure with no warning beside it is read as right.
 */
export type Caveats = Record<string, Record<string, string> | string>;

const LOAD = "; machine load (1-minute average) ";

/** The environment without the host load of the step that wrote it: steps of one pass differ in nothing else. */
const machine = (env?: string | null) => (env ?? "").split(LOAD)[0];

/**
 * What to say of a row measured elsewhere than its table: an environment reads "<browser and
 * method>; <the machine>; <its load>", and when only the machine differs, the machine is the news.
 */
function placeOf(mine?: string | null, table?: string | null): string {
  const a = machine(mine).split("; "), b = machine(table).split("; ");
  return a.length > 1 && a[0] === b[0] ? a.slice(1).join("; ") : mine ?? "";
}

/** One sentence with the host load of a table's runs, from its rows' environments. */
function hostLoad(envs: (string | null | undefined)[], table?: string | null): string {
  // Only the table's own machine: a row measured elsewhere says where beside its name.
  const here = machine(table);
  const said = [...new Set(envs.filter((e): e is string => !!e && e.includes(LOAD) && machine(e) === here).map((e) => e.split(LOAD)[1]))];
  return said.length ? ` Host load during these runs (1-minute average): ${esc(said.join("; "))}.` : "";
}

export function samplesBand(
  all: EditorMeta[],
  data: SampleMeasurements = LATEST as SampleMeasurements,
  // The caveats are about the published file: another data set (a test's) has none unless it brings its own.
  caveats: Caveats = data === (LATEST as unknown) ? (CAVEATS as Caveats) : {},
): string {
  const tables = FIXTURES.map((f) => {
    const id = f.file.replace(/\.docx$/, "");
    const rows = data.samples?.[id];
    if (!rows || !Object.keys(rows).length) return "";
    const redline = id === "redline";
    const row = (e: EditorMeta) => {
      const r = rows[e.slug];
      if (!r) return "";
      const frame = e.opensFiles === false;
      // Said only where it differs from the heading: a row re-measured on another day or machine.
      const otherBase = !!r.base && !!data.base && r.base !== data.base;
      const elsewhere = (r.measuredAt && r.measuredAt !== data.measuredAt) || (r.environment && machine(r.environment) !== machine(data.environment)) || otherBase
        ? ` <small class="prov">measured ${esc(r.measuredAt ?? "")}: ${esc(placeOf(r.environment, data.environment))}${otherBase ? ` · ${esc(r.base!)}` : ""}</small>`
        : "";
      const incomplete = r.incomplete ? ` <small class="prov-warn">incomplete: ${esc(String(r.incomplete).split("\n")[0].slice(0, 120))}</small>` : "";
      // A median over fewer runs than were made says how many loaded, and why the others did not.
      const runs = r.runs ?? [];
      const got = runs.filter((x) => x != null).length;
      const partial = num(r.loadMs) != null && got < runs.length
        ? ` <small class="prov-warn">${got} of ${runs.length} runs loaded${r.failed ? `: ${esc(String(r.failed).split("\n")[0].slice(0, 120))}` : ""}</small>`
        : "";
      const told = caveats[id];
      const caveat = told && typeof told === "object" && told[e.slug] ? ` <small class="prov-warn">read with care: ${esc(told[e.slug])}</small>` : "";
      const name = `<a href="/e/${e.slug}">${esc(e.name)}</a>${e.kind === "viewer" ? ` <span class="vo">view-only</span>` : ""}${elsewhere}${incomplete}${partial}${caveat}`;
      if (num(r.loadMs) == null) {
        return `<tr><td>${name}</td><td colspan="${redline ? 4 : 5}"><b>did not open it</b>: ${esc(String(r.failed ?? "no answer").split("\n")[0].slice(0, 160))}</td>${
          redline ? `<td class="hide-sm">${esc(REVISION_NOTES[e.slug] ?? "")}</td>` : ""
        }</tr>`;
      }
      // Each run's own growth, median. Without it nothing is shown: the two medians beside it can
      // come from different runs, and their difference was once −29 MB where the runs said +25 MB.
      const grew = num(r.rendererGrowth);
      const settled = frame ? "n/a" : num(r.settledMs) == null && r.settleTimedOut ? "still busy after 180 s" : ms(r.settledMs);
      return `<tr><td>${name}</td>
      <td class="n">${ms(r.loadMs)}</td>
      <td class="n"><b>${settled}</b>${
        // Some runs settled and some never did: the median stands on the ones that did, and says so.
        !frame && num(r.settledMs) != null && num(r.settleTimedOut) ? ` <small class="prov-warn">${num(r.settleTimedOut)} of ${(r.runs ?? []).filter((x) => x != null).length} runs still busy after 180 s</small>` : ""
      }</td>
      <td class="n">${frame ? "n/a" : mb(r.heapBytes)}${!frame && num(r.heapNotCollected) ? ` <small class="prov-warn">not collected first in ${num(r.heapNotCollected)} run(s)</small>` : ""}</td>
      <td class="n" title="before ${mb(r.rendererRssReady)}, after ${mb(r.rendererRss)}">${mb(r.rendererRss)}${grew != null ? ` <small>(${grew >= 0 ? "+" : "−"}${mb(Math.abs(grew))})</small>` : ""}</td>
      ${redline ? `<td class="hide-sm">${esc(REVISION_NOTES[e.slug] ?? "")}</td>` : `<td class="n hide-sm">${num(r.pages) ?? "n/a"}${num(r.pagesStillChanging) ? ` <small class="prov-warn">still changing in ${num(r.pagesStillChanging)} run(s)</small>` : ""}</td>`}
    </tr>`;
    };
    return `<h3 class="smp-h" id="sample-${id}">The ${esc(f.label)} sample <small>${esc(f.file)} · ${esc(f.note)} · <a href="/api/${f.file}">download ↓</a></small></h3>
  <p class="sec-copy">${INTRO[f.file] ?? ""}${hostLoad(Object.values(rows).map((r) => r.environment ?? data.environment), data.environment)}</p>
  <div class="table-wrap"><table class="tbl"><thead><tr>
    <th>Engine</th><th class="n">Loaded</th><th class="n">Settled</th><th class="n">JS heap</th><th class="n">Renderer memory</th>
    ${redline ? `<th class="hide-sm">Tracked changes</th>` : `<th class="n hide-sm">Pages shown</th>`}
  </tr></thead><tbody>${all.map(row).join("")}</tbody></table></div>`;
  }).join("\n");
  if (!tables.trim()) return "";
  return `<section class="band" id="samples"><div class="wrap">
  <h2 class="sec-label"><span class="sq" aria-hidden="true"></span> / Samples</h2>
  <p class="sec-copy">Every engine opening the two harder samples from its own Menu, measured ${esc(data.measuredAt ?? "")}: ${esc(machine(data.environment))}.
  <b>Loaded</b>: Menu click until the engine's own loader returns. <b>Settled</b>: Menu click until the page's main thread has been quiet for two seconds and the page count has stopped changing (work in a worker or on the GPU is not seen).
  <b>JS heap</b>: JavaScript objects only, read after a forced garbage collection. <b>Renderer memory</b>: resident memory of Chrome's renderer processes, which also counts WebAssembly memory, canvases and the DOM; in brackets, how much it grew when the sample was opened, run by run (a view-only engine already shows the rich sample, so its bracket is what replacing that one cost).
  Microsoft's and Google's viewers render on their own servers, so only their frame's load is timed.
  A row marked <b>read with care</b> has a figure that was checked again${typeof caveats.checked === "string" ? ` on ${esc(caveats.checked)}` : ""} and found to be about this machine, or about something the method cannot see, rather than the engine: the <a href="https://github.com/arthrod/open-docs#figures-to-distrust">README</a> says what was seen.</p>
  ${tables}
</div></section>`;
}
