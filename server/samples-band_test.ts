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
  assertEquals(html.includes("420 MB <small>(+120 MB)</small>"), true);
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
