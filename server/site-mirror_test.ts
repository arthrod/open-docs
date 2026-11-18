import { assertEquals } from "jsr:@std/assert@1.0.13";
import { mirrorTarget } from "./site-mirror.ts";

Deno.test("mirror: a snapshot path maps to the same path on the mirrored site", () => {
  assertEquals(mirrorTarget("/vendor/opendoc/2026-11-05/editor.html"), { site: "opendoc", file: "editor.html", upstream: "https://opendoc.casualoffice.org/editor.html" });
  assertEquals(mirrorTarget("/vendor/opendoc/2026-11-05/src/app/main.mjs")?.upstream, "https://opendoc.casualoffice.org/src/app/main.mjs");
});

Deno.test("mirror: another snapshot, another site, or a climbing or encoded path is refused", () => {
  assertEquals(mirrorTarget("/vendor/opendoc/2026-11-06/editor.html"), null);
  assertEquals(mirrorTarget("/vendor/other/2026-11-05/editor.html"), null);
  assertEquals(mirrorTarget("/vendor/opendoc/2026-11-05/../x.js"), null);
  assertEquals(mirrorTarget("/vendor/opendoc/2026-11-05/a%2fb.js"), null);
  assertEquals(mirrorTarget("/vendor/opendoc/2026-11-05/"), null);
});

Deno.test("site mirror: only the sister site may say the page is shown under its origin", async () => {
  const { pageOrigin } = await import("./site-mirror.ts");
  const own = "https://editors.benchmarks.law";
  if (pageOrigin(own, undefined) !== own) throw new Error("no claim: own origin");
  if (pageOrigin(own, "https://viewers.benchmarks.law") !== "https://viewers.benchmarks.law") throw new Error("sister site refused");
  if (pageOrigin(own, "https://evil.example") !== own) throw new Error("a stranger's origin was accepted");
});
