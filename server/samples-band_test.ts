import { assertEquals } from "jsr:@std/assert@1.0.13";
import { editors } from "./registry.ts";
import { type SampleMeasurements, samplesBand } from "./samples-band.ts";
import { REVISION_NOTES } from "../lib/revision-notes.ts";

const row = (over: Record<string, unknown> = {}) => ({
  startupMs: 1000, loadMs: 200, settledMs: 900, heapBytes: 20 * 1048576, rendererRssReady: 300 * 1048576,
  rendererRss: 420 * 1048576, gpuRss: 0, pages: 3, runs: [200], failed: null, ...over,
});

Deno.test("no measurements: no band at all (never an empty table)", () => {
  assertEquals(samplesBand(editors, { measuredAt: null, environment: "", samples: {} }), "");
});

Deno.test("the redline table says how each engine treats tracked changes; a failure is shown, not dropped", () => {
  const data: SampleMeasurements = {
    measuredAt: "2026-11-15",
    environment: "test",
    samples: { redline: { folio: row(), plate: row({ loadMs: null, settledMs: null, failed: "Error: boom\n at x" }) } },
  };
  const html = samplesBand(editors, data);
  assertEquals(html.includes(REVISION_NOTES.folio), true);
  assertEquals(html.includes("420 MB <small>("), false); // this row has no paired growth: none is invented
  assertEquals(html.includes("<b>did not open it</b>: Error: boom"), true);
  assertEquals(html.includes(" at x"), false); // first line of the error only
  assertEquals(html.includes('id="sample-lorem-500"'), false); // not measured: not shown
});

Deno.test("every engine in the registry that can open a sample has a revisions note", () => {
  for (const e of editors) {
    if (e.slug === "cite-check") continue; // its own page: a fixed brief, no Samples menu comparison
    if (!REVISION_NOTES[e.slug]) throw new Error(`no revisions note for ${e.slug}`);
  }
});

Deno.test("memory growth shown is the median of each run's own growth, when the file has it", () => {
  const data: SampleMeasurements = {
    measuredAt: "2026-11-15", environment: "test",
    samples: { redline: { folio: row({ rendererGrowth: 16 * 1048576 }), docen: row() } },
  };
  const html = samplesBand(editors, data);
  assertEquals(html.includes("420 MB <small>(+16 MB)</small>"), true); // folio: paired
  assertEquals(html.includes("(+120 MB)"), false); // docen: a file without the field shows no growth
});

Deno.test("a row says so when it never settled, when its readings are incomplete, and when it was measured elsewhere", () => {
  const data: SampleMeasurements = {
    measuredAt: "2026-11-15", environment: "Darwin arm64",
    samples: {
      "lorem-500": {
        folio: row({ settledMs: null, settleTimedOut: 1 }),
        docen: row({ incomplete: "TimeoutError: Performance.getMetrics\n at y" }),
        plate: row({ measuredAt: "2026-11-20", environment: "Linux x86_64" }),
        superdoc: row({ measuredAt: "2026-11-15", environment: "Darwin arm64" }),
      },
    },
  };
  const html = samplesBand(editors, data);
  assertEquals(html.includes("still busy after 180 s"), true);
  assertEquals(html.includes("incomplete: TimeoutError: Performance.getMetrics"), true);
  assertEquals(html.includes(" at y"), false);
  assertEquals(html.includes("measured 2026-11-20: Linux x86_64"), true);
  assertEquals((html.match(/<small class="prov">/g) ?? []).length, 1); // only the row that differs from the heading
});

Deno.test("no paired growth: none is shown, rather than the difference of two medians", () => {
  const data: SampleMeasurements = {
    measuredAt: "2026-11-15", environment: "test",
    samples: { redline: { folio: row(), docen: row({ rendererGrowth: null }), plate: row({ rendererGrowth: -3 * 1048576 }) } },
  };
  const html = samplesBand(editors, data);
  assertEquals(html.includes("(+120 MB)"), false); // 420 − 300: medians of different runs
  assertEquals(html.includes("420 MB <small>(−3 MB)</small>"), true);
});

Deno.test("a row measured against another site address says so", () => {
  const data: SampleMeasurements = {
    measuredAt: "2026-11-15", environment: "test", base: "https://editors.benchmarks.law",
    samples: { redline: { folio: row({ measuredAt: "2026-11-15", environment: "test", base: "https://staging.example" }) } },
  };
  assertEquals(samplesBand(editors, data).includes("measured 2026-11-15: test · https://staging.example"), true);
});
