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

Deno.test("a page analysed in a different run from its table says when", () => {
  const stamped = { ...{ desktop: page(), mobile: page() }, measuredAt: "2026-11-16", environment: "Lighthouse 13.6, 1 analyses" };
  const html = lighthouseBand(editors, { measuredAt: "2026-11-10", environment: "Lighthouse 13.5", pages: { "e/folio": stamped, "e/docen": { desktop: page(), mobile: page(), measuredAt: "2026-11-10", environment: "Lighthouse 13.5" } } });
  assertEquals(html.includes("measured 2026-11-16: Lighthouse 13.6, 1 analyses"), true);
  assertEquals((html.match(/class="lh-part prov"/g) ?? []).length, 1);
});

Deno.test("a value that should be a number is not written into the page as markup", () => {
  const evil = "<img src=x onerror=alert(1)>" as unknown as number;
  const p = { ...page(), performance: evil, cls: evil, accessibility: evil, lcpMs: evil, performanceRuns: [evil, 1, 2] };
  const html = lighthouseBand(editors, { measuredAt: "2026-11-10", environment: "x", pages: { "e/folio": { desktop: p, mobile: p } } });
  assertEquals(html.includes("<img"), false);
});

Deno.test("a results file with parts missing draws what it has instead of throwing", () => {
  assertEquals(lighthouseBand(editors, {} as never), "");
  const bare = { performance: 90 } as never;
  const html = lighthouseBand(editors, { measuredAt: "2026-11-10", environment: "x", pages: { "e/folio": { desktop: bare } as never, "e/docen": { desktop: page(), mobile: page() } } });
  assertEquals(html.includes("docen"), true);
});

Deno.test("a page whose analyses disagree shows their range beside the median", () => {
  const wide = { ...page(), performance: 71, performanceRuns: [79, 44, 71] };
  const tight = { ...page(), performance: 98, performanceRuns: [97, 98, 98] };
  const html = lighthouseBand(editors, { measuredAt: "2026-11-16", environment: "x", pages: { "e/folio": { desktop: tight, mobile: wide }, "e/docen": { desktop: tight, mobile: tight } } });
  assertEquals(html.includes("mobile analyses ranged 44 to 79"), true);
  assertEquals((html.match(/analyses ranged/g) ?? []).length, 1);
});

Deno.test("a page with no result still says when and where it was analysed, if not with the table", () => {
  const none = page({ performance: null, performanceRuns: [null], error: "the engine failed" } as unknown as Partial<LighthousePage>);
  const html = lighthouseBand(editors, {
    measuredAt: "2026-11-10", environment: "Lighthouse 13.5",
    pages: { "e/folio": { desktop: none, mobile: none, measuredAt: "2026-11-16", environment: "Lighthouse 13.6" } as LighthouseResults["pages"][string] },
  });
  assertEquals(html.includes("<b>no result</b>: the engine failed"), true);
  assertEquals(html.includes("measured 2026-11-16: Lighthouse 13.6"), true);
});

Deno.test("a page analysed on another address says so, and its link analyses that address", () => {
  const html = lighthouseBand(editors, {
    measuredAt: "2026-11-10", environment: "Lighthouse 13.5", base: "https://editors.benchmarks.law",
    pages: { "e/folio": { desktop: page(), mobile: page(), measuredAt: "2026-11-10", environment: "Lighthouse 13.5", base: "https://open-docs.val.run" } as LighthouseResults["pages"][string] },
  } as LighthouseResults);
  assertEquals(html.includes("https://open-docs.val.run</small>"), true);
  assertEquals(html.includes(encodeURIComponent("https://open-docs.val.run/e/folio")), true);
});
