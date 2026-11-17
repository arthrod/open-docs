import { assertEquals } from "jsr:@std/assert@1.0.13";
import { codeLines } from "./code-lines.ts";

Deno.test("a replacement inside a Code paragraph keeps which text was deleted and which inserted", () => {
  // mammoth: <pre><s>old</s><u>new</u></pre>, after the revisions were turned into formatting
  assertEquals(codeLines([{ text: "old", strikethrough: true }, { text: "new", underline: true }]), [
    { type: "code_line", children: [{ text: "old", strikethrough: true }, { text: "new", underline: true }] },
  ]);
});

Deno.test("a leaf that spans lines is split, and every piece keeps its marks", () => {
  assertEquals(codeLines([{ text: "a\nb", strikethrough: true }, { text: "c\n" }, { text: "\n", bold: true }]), [
    { type: "code_line", children: [{ text: "a", strikethrough: true }] },
    { type: "code_line", children: [{ text: "b", strikethrough: true }, { text: "c" }] },
    { type: "code_line", children: [{ text: "" }] },
    { type: "code_line", children: [{ text: "" }] },
  ]);
});

Deno.test("plain code is one unmarked leaf per line, as before; a link inside it gives its text", () => {
  assertEquals(codeLines([{ text: "x = 1\ny = 2" }]), [
    { type: "code_line", children: [{ text: "x = 1" }] },
    { type: "code_line", children: [{ text: "y = 2" }] },
  ]);
  assertEquals(codeLines([]), [{ type: "code_line", children: [{ text: "" }] }]);
  assertEquals(codeLines([{ type: "a", url: "https://x", children: [{ text: "see", underline: true }] }]), [
    { type: "code_line", children: [{ text: "see", underline: true }] },
  ]);
});
