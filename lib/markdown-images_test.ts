import { assertEquals } from "jsr:@std/assert@1.0.13";
import { stripImagesOutsideCode } from "./markdown-images.ts";

Deno.test("images: dropped in text, kept inside inline and fenced code", () => {
  assertEquals(stripImagesOutsideCode("a ![x](p.png) b `![y](q.png)`"), "a  b `![y](q.png)`");
  assertEquals(stripImagesOutsideCode("```\n![y](q.png)\n```\n![x](p.png)"), "```\n![y](q.png)\n```\n");
});

Deno.test("images: escaped backticks are text, so an image between them is dropped", () => {
  assertEquals(stripImagesOutsideCode("Escaped \\` ![photo](p.png) \\`"), "Escaped \\`  \\`");
});

Deno.test("images: a code span that runs over a line break still protects its content", () => {
  assertEquals(stripImagesOutsideCode("`a\n![y](q.png)` ![x](p.png)"), "`a\n![y](q.png)` ");
});
