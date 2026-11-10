import { assertEquals } from "jsr:@std/assert@1.0.13";
import { safeUrl } from "./safe-url.ts";

Deno.test("links keep http(s), mailto and in-document anchors only", () => {
  const cases: [unknown, string | undefined][] = [
    ["https://a.b/c", "https://a.b/c"], ["http://a.b", "http://a.b"], ["mailto:x@y.z", "mailto:x@y.z"], ["#_Toc1", "#_Toc1"],
    ["javascript:alert(1)", undefined], [" JavaScript:alert(1)", undefined], ["data:text/html,x", undefined],
    ["vbscript:x", undefined], ["rel/path", undefined], [undefined, undefined], [42, undefined],
  ];
  for (const [input, want] of cases) assertEquals(safeUrl(input), want, String(input));
});
