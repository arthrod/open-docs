import { assertEquals } from "jsr:@std/assert@1.0.13";
import { editors } from "./registry.ts";
import { lighthouseBand, type LighthousePage, type LighthouseResults } from "./lighthouse-band.ts";

const page = (over: Partial<LighthousePage> = {}): LighthousePage => ({
  performance: 90, accessibility: 100, bestPractices: 100, seo: 90, fcpMs: 300, lcpMs: 500, tbtMs: 0, cls: 0, speedIndexMs: 600,
  performanceRuns: [90, 90, 90], error: null, ...over,
});
const data = (docs: LighthouseResults["docs"], docsMeta?: LighthouseResults["docsMeta"]): LighthouseResults => ({
  measuredAt: "2026-11-10", environment: "Lighthouse 13.5", pages: { "e/folio": { desktop: page(), mobile: page() } }, docs, docsMeta,
});

Deno.test("a median from fewer analyses than were run says how many returned, and why the others did not", () => {
  const html = lighthouseBand(editors, data({
    "lorem-500": { "e/folio": { desktop: page({ performance: 70, performanceRuns: [null, 70, null], error: "PAGE_HUNG: the page stopped responding" }), mobile: page() } },
  }));
  assertEquals(html.includes("desktop 1/3 analyses"), true);
  assertEquals(html.includes("PAGE_HUNG: the page stopped responding"), true);
  // A full set says nothing extra.
  assertEquals(html.includes("mobile 3/3"), false);
  assertEquals((html.match(/class="lh-part"/g) ?? []).length, 1);
});

Deno.test("the 500-page table is dated by its own run when the file records one", () => {
  const docs = { "lorem-500": { "e/folio": { desktop: page(), mobile: page() } } };
  const own = lighthouseBand(editors, data(docs, { "lorem-500": { measuredAt: "2026-11-16", environment: "Lighthouse 13.6, 1 analyses" } }));
  assertEquals(own.includes("Measured 2026-11-16: Lighthouse 13.6, 1 analyses"), true);
  assertEquals(own.includes("Measured 2026-11-10: Lighthouse 13.5"), true); // the blank-page table keeps its own
  const legacy = lighthouseBand(editors, data(docs));
  assertEquals(legacy.includes("Measured 2026-11-16"), false);
});
