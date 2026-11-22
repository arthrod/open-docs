import { assertEquals } from "jsr:@std/assert@1.0.13";
import { blocksToUniverBody, univerBodyToMarkdown } from "./univer-doc.ts";
import { markdownToBlocks } from "./markdown.ts";

const H = { 1: 11, 2: 12, 3: 13, 4: 14, 5: 15, 6: 16 };

Deno.test("univer: paragraphs end with a carriage return, the body with a section break", () => {
  const b = blocksToUniverBody(markdownToBlocks("# Title\n\nFirst.\n\nSecond."), H);
  assertEquals(b.dataStream, "Title\rFirst.\rSecond.\r\n");
  assertEquals(b.paragraphs.map((p) => p.startIndex), [5, 12, 20]);
  assertEquals(b.paragraphs[0].paragraphStyle?.namedStyleType, 11);
  assertEquals(b.sectionBreaks, [{ startIndex: 21 }]);
});

Deno.test("univer: bold and italic become text runs; list items keep a visible marker", () => {
  const b = blocksToUniverBody(markdownToBlocks("A **bold** word.\n\n1. one\n2. two\n\n- dot"), H);
  assertEquals(b.dataStream, "A bold word.\r1. one\r2. two\r• dot\r\n");
  assertEquals(b.textRuns, [{ st: 2, ed: 6, ts: { bl: 1 } }]);
});

Deno.test("univer: an empty document is one empty paragraph", () => {
  assertEquals(blocksToUniverBody([], H).dataStream, "\r\n");
});

Deno.test("univer: the body reads back as Markdown with its headings", () => {
  const md = "# Title\n\nFirst.\n\n## Part\n\nSecond.";
  assertEquals(univerBodyToMarkdown(blocksToUniverBody(markdownToBlocks(md), H), H).trim(), md);
});

Deno.test("univer: a level-5 heading reads back as level 5 when level 6 shares its style", () => {
  const shared = { 1: 11, 2: 12, 3: 13, 4: 14, 5: 15, 6: 15 }; // Univer has five heading styles
  const body = blocksToUniverBody(markdownToBlocks("##### Five"), shared);
  assertEquals(univerBodyToMarkdown(body, shared).trim(), "##### Five");
});

const back = (md: string) => univerBodyToMarkdown(blocksToUniverBody(markdownToBlocks(md), H), H).trim();

Deno.test("univer: a new numbered list after a bullet list starts at 1", () => {
  const b = blocksToUniverBody(markdownToBlocks("1. A\n2. B\n\n- C\n\n1. D"), H);
  assertEquals(b.dataStream, "1. A\r2. B\r• C\r1. D\r\n");
});

Deno.test("univer: bold, italic and strike are read back, so an edit elsewhere keeps them", () => {
  assertEquals(back("Pay **today** or *never*, ~~maybe~~."), "Pay **today** or *never*, ~~maybe~~.");
});

Deno.test("univer: lists read back as Markdown lists, nested items included", () => {
  // The writer's own indentation may differ; what matters is that it parses back to the same list.
  const again = markdownToBlocks(back("- Parent\n  - Child\n- Next"));
  assertEquals(again.map((b) => [b.kind, b.level ?? 0, b.runs.map((r) => r.text).join("")]), [["li", 0, "Parent"], ["li", 1, "Child"], ["li", 0, "Next"]]);
  assertEquals(back("1. One\n2. Two"), "1. One\n2. Two");
});

Deno.test("univer: text that looks like Markdown stays text", () => {
  const md = "\\# Appendix";
  assertEquals(back(md), md);
  assertEquals(markdownToBlocks(back(md))[0].kind, "p");
});
