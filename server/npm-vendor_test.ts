import { assertEquals } from "jsr:@std/assert@1.0.13";
import { vendorUpstream } from "./npm-vendor.ts";

Deno.test("vendor: a pinned package's file maps to that exact version on jsDelivr", () => {
  assertEquals(
    vendorUpstream("/vendor/npm/@extend-ai/react-docx@0.15.0/dist/vanilla.js"),
    "https://cdn.jsdelivr.net/npm/@extend-ai/react-docx@0.15.0/dist/vanilla.js",
  );
});

Deno.test("vendor: another version, another package, or a path that climbs out is refused", () => {
  assertEquals(vendorUpstream("/vendor/npm/@extend-ai/react-docx@0.14.0/dist/vanilla.js"), null);
  assertEquals(vendorUpstream("/vendor/npm/left-pad@1.0.0/index.js"), null);
  assertEquals(vendorUpstream("/vendor/npm/@extend-ai/react-docx@0.15.0/../../evil/x.js"), null);
  assertEquals(vendorUpstream("/vendor/npm/@extend-ai/react-docx@0.15.0/dist/a%2f..%2fb.js"), null);
  assertEquals(vendorUpstream("/vendor/npm/@extend-ai/react-docx@0.15.0/"), null);
});
