import { assertEquals } from "jsr:@std/assert@1.0.13";
import { onlyofficeTarget } from "./onlyoffice.ts";

Deno.test("onlyoffice: converter and editor paths go to their own archives", () => {
  const x = onlyofficeTarget("/vendor/onlyoffice/9.3.2-3/x2t/x2t.wasm")!;
  assertEquals([x.archive.url.includes("onlyoffice-x2t-wasm"), x.file], [true, "x2t.wasm"]);
  const e = onlyofficeTarget("/vendor/onlyoffice/9.3.2-3/web-apps/apps/api/documents/api.js")!;
  assertEquals([e.archive.url.includes("onlyoffice-editor"), e.file], [true, "web-apps/apps/api/documents/api.js"]);
  assertEquals(e.archive.url.includes("v9.3.2%2B3"), true);
  assertEquals(!!e.archive.index[e.file], true);
  // The address sdkjs builds for a font has a doubled slash.
  const f = onlyofficeTarget("/vendor/onlyoffice/9.3.2-3/fonts//fonts/calibri.ttf")!;
  assertEquals([f.file, !!f.archive.index[f.file]], ["fonts/fonts/calibri.ttf", true]);
});

Deno.test("onlyoffice: paths outside the snapshot or climbing out of it are refused", () => {
  assertEquals(onlyofficeTarget("/vendor/onlyoffice/9.9.9/x2t/x2t.js"), undefined);
  assertEquals(onlyofficeTarget("/vendor/onlyoffice/9.3.2-3/../secret"), undefined);
  assertEquals(onlyofficeTarget("/vendor/onlyoffice/9.3.2-3/"), undefined);
});
