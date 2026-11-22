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
  if (pageOrigin(own, "https://viewers.benchmarks.law/eo1") !== "https://viewers.benchmarks.law/eo1") throw new Error("sister site's pass-through path refused");
  for (const bad of ["https://evil.example", "https://viewers.benchmarks.law.evil.example", "https://viewers.benchmarks.law/a/b", "https://viewers.benchmarks.law/..", "https://viewers.benchmarks.law@evil.example"]) {
    if (pageOrigin(own, bad) !== own) throw new Error(`accepted ${bad}`);
  }
});

Deno.test("site mirror: a name that could collide with another file's storage key is refused", async () => {
  const { mirrorTarget } = await import("./site-mirror.ts");
  if (mirrorTarget("/vendor/opendoc/2026-11-05/src__app__main.mjs") !== null) throw new Error("accepted a colliding name");
  if (mirrorTarget("/vendor/opendoc/2026-11-05/src/app/main.mjs") === null) throw new Error("refused a plain name");
});

Deno.test("site mirror: the docs.plus demo's script keeps a picture it does not know", async () => {
  const { docsPlusKeepPictures, MIRRORS } = await import("./site-mirror.ts");
  const built = "wue=async(e,t)=>{let n=yue[bue(q9(e))];if(!n)throw Error(`Image (${t}) is not part of the bundled media set`);return new URL(n,Q9()).href}";
  const out = docsPlusKeepPictures(built);
  if (out.includes("throw Error")) throw new Error("still refuses");
  if (!out.includes('if(!n)return URL.createObjectURL(new Blob([q9(e)],{type:t||"image/png"}));return new URL(n,Q9()).href}')) throw new Error(out);
  if (docsPlusKeepPictures("let a=1;") !== "let a=1;") throw new Error("changed other code");
  // The rewritten script has an address of its own; the other demos' pages keep theirs.
  const page = '<head></head><script type="module" src="./assets/index-abc.js"></script>';
  if (!MIRRORS["docs-plus"].page!("index.html", page, "").includes('src="./assets/index-abc.js?pictures=1"')) throw new Error("no new address");
  if (!MIRRORS["genoffice"].page!("index.html", page, "").includes('src="./assets/index-abc.js"')) throw new Error("another demo's address changed");
  if (MIRRORS["genoffice"].script) throw new Error("another demo's script is rewritten");
});
