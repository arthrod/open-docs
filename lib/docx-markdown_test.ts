import { assertEquals } from "jsr:@std/assert@1.0.13";
import { strToU8, zipSync } from "https://esm.sh/fflate@0.8.2?target=es2022";
import { JSDOM } from "npm:jsdom@26.1.0";

// The reader runs in the browser; jsdom stands in for its namespaced XML DOMParser.
(globalThis as any).DOMParser ??= new JSDOM("").window.DOMParser;
const { docxToMarkdown } = await import("./docx-markdown.ts");

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const p = (text: string, numId: string, ilvl = 0) =>
  `<w:p><w:pPr><w:numPr><w:ilvl w:val="${ilvl}"/><w:numId w:val="${numId}"/></w:numPr></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
const lvl = (ilvl: number, fmt: string) => `<w:lvl w:ilvl="${ilvl}"><w:start w:val="1"/><w:numFmt w:val="${fmt}"/></w:lvl>`;

function docx(body: string): Uint8Array {
  const numbering = `<w:numbering ${W}>
    <w:abstractNum w:abstractNumId="0">${lvl(0, "bullet")}${lvl(1, "bullet")}</w:abstractNum>
    <w:abstractNum w:abstractNumId="1">${lvl(0, "decimal")}</w:abstractNum>
    <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
    <w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
    <w:num w:numId="3"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="5"/></w:lvlOverride></w:num>
  </w:numbering>`;
  return zipSync({
    "word/document.xml": strToU8(`<w:document ${W}><w:body>${body}</w:body></w:document>`),
    "word/numbering.xml": strToU8(numbering),
  });
}

Deno.test("docx: ordered list after nested bullets restarts; separate numIds restart; startOverride honoured", () => {
  const md = docxToMarkdown(docx(
    p("item one", "1") + p("item two", "1") + p("nested", "1", 1) +
      p("first", "2") + p("second", "2") + p("fifth", "3") + p("sixth", "3"),
  ));
  assertEquals(md.trim(), "- item one\n- item two\n   - nested\n\n1. first\n2. second\n\n5. fifth\n6. sixth");
});

/* ------------------------------------------------------------------------ *
 * Adversarial cases (review of 0127eb2 "Reader: lists keep their identity
 * and start").  Each one asserts what the .docx actually says.
 * ------------------------------------------------------------------------ */

/** A .docx with a numbering part of the caller's choosing. */
function docxWith(body: string, numbering: string): Uint8Array {
  return zipSync({
    "word/document.xml": strToU8(`<w:document ${W}><w:body>${body}</w:body></w:document>`),
    "word/numbering.xml": strToU8(`<w:numbering ${W}>${numbering}</w:numbering>`),
  });
}

const decimal = (abstractId: string, numId: string, extra = "") =>
  `<w:abstractNum w:abstractNumId="${abstractId}"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/></w:lvl></w:abstractNum>` +
  `<w:num w:numId="${numId}"><w:abstractNumId w:val="${abstractId}"/>${extra}</w:num>`;

/** The same list, but the level omits the optional <w:start>. */
const decimalNoStart = (abstractId: string, numId: string) =>
  `<w:abstractNum w:abstractNumId="${abstractId}"><w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/></w:lvl></w:abstractNum>` +
  `<w:num w:numId="${numId}"><w:abstractNumId w:val="${abstractId}"/></w:num>`;

Deno.test("docx: a numbering level without w:start starts at 1, not 0", () => {
  // <w:start> is optional; its default is 1 (ECMA-376 17.9.23).
  const md = docxToMarkdown(docxWith(p("a", "2") + p("b", "2"), decimalNoStart("1", "2")));
  assertEquals(md.trim(), "1. a\n2. b");
});

Deno.test("docx: a lvlOverride's own w:start is honoured", () => {
  // A full <w:lvl> inside <w:lvlOverride> replaces the abstract level.
  const numbering =
    `<w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/></w:lvl></w:abstractNum>` +
    `<w:num w:numId="2"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:lvl w:ilvl="0"><w:start w:val="5"/><w:numFmt w:val="decimal"/></w:lvl></w:lvlOverride></w:num>`;
  const md = docxToMarkdown(docxWith(p("a", "2") + p("b", "2"), numbering));
  assertEquals(md.trim(), "5. a\n6. b");
});

Deno.test("docx: a lvlOverride without w:start starts at 1, not 0", () => {
  const numbering =
    `<w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="3"/><w:numFmt w:val="decimal"/></w:lvl></w:abstractNum>` +
    `<w:num w:numId="2"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/></w:lvl></w:lvlOverride></w:num>`;
  const md = docxToMarkdown(docxWith(p("a", "2") + p("b", "2"), numbering));
  assertEquals(md.trim(), "1. a\n2. b");
});

Deno.test("docx: an ordered list keeps counting across a table", () => {
  const table =
    `<w:tbl><w:tr><w:tc><w:p><w:r><w:t>H1</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>H2</w:t></w:r></w:p></w:tc></w:tr>` +
    `<w:tr><w:tc><w:p><w:r><w:t>x</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>y</w:t></w:r></w:p></w:tc></w:tr></w:tbl>`;
  const md = docxToMarkdown(docxWith(p("a", "2") + p("b", "2") + table + p("c", "2") + p("d", "2"), decimal("1", "2")));
  assertEquals(
    md.trim(),
    "1. a\n2. b\n\n| H1 | H2 |\n| --- | --- |\n| x | y |\n\n3. c\n4. d",
  );
});

Deno.test("docx: an empty list item still advances the counter", () => {
  const md = docxToMarkdown(docxWith(p("", "2") + p("b", "2"), decimal("1", "2")));
  assertEquals(md.trim(), "2. b");
});

Deno.test("docx: a level with lvlRestart=0 keeps counting under every parent", () => {
  const numbering =
    `<w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/></w:lvl>` +
    `<w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlRestart w:val="0"/></w:lvl></w:abstractNum>` +
    `<w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>`;
  const md = docxToMarkdown(docxWith(
    p("p1", "2") + p("x", "2", 1) + p("p2", "2") + p("y", "2", 1),
    numbering,
  ));
  assertEquals(md.trim(), "1. p1\n   1. x\n2. p2\n   2. y");
});
