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

Deno.test("docx: a full <w:lvl> override without numFmt replaces a bullet level with decimal", () => {
  // The override's <w:lvl> replaces the abstract level; numFmt defaults to decimal.
  const numbering =
    `<w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/></w:lvl></w:abstractNum>` +
    `<w:num w:numId="2"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:lvl w:ilvl="0"><w:start w:val="1"/></w:lvl></w:lvlOverride></w:num>`;
  const md = docxToMarkdown(docxWith(p("a", "2") + p("b", "2"), numbering));
  assertEquals(md.trim(), "1. a\n2. b");
});

Deno.test("docx: a level whose numFmt is none shows no marker: a plain paragraph, not item 1", () => {
  const none = `<w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="none"/></w:lvl></w:abstractNum>` +
    `<w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>`;
  assertEquals(docxToMarkdown(docxWith(p("a heading-like line", "2") + p("another", "2"), none)).trim(), "a heading-like line\n\nanother");
});

Deno.test("docx: a list item inside a table cell still counts for the items after the table", () => {
  const table = `<w:tbl><w:tr><w:tc>${p("in a cell", "2")}</w:tc></w:tr></w:tbl>`;
  const md = docxToMarkdown(docxWith(p("a", "2") + table + p("c", "2"), decimal("1", "2")));
  assertEquals(md.trim().split("\n").at(0), "1. a");
  assertEquals(md.trim().split("\n").at(-1), "3. c"); // the cell's item was 2
});

Deno.test("docx: an unmarked level still counts, so the numbered level under it starts again", () => {
  const outline = `<w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="none"/></w:lvl>` +
    `<w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="decimal"/></w:lvl></w:abstractNum><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>`;
  const md = docxToMarkdown(docxWith(p("Part A", "2") + p("a", "2", 1) + p("b", "2", 1) + p("Part B", "2") + p("c", "2", 1), outline));
  assertEquals(md.match(/\d+\. \w/g), ["1. a", "2. b", "1. c"]);
});

Deno.test("docx: a cell paragraph inside a content control is read, and its list item counts", () => {
  const table = `<w:tbl><w:tr><w:tc><w:sdt><w:sdtContent>${p("in a control", "2")}</w:sdtContent></w:sdt></w:tc></w:tr></w:tbl>`;
  const md = docxToMarkdown(docxWith(p("a", "2") + table + p("c", "2"), decimal("1", "2")));
  assertEquals(md.includes("in a control"), true);
  assertEquals(md.trim().split("\n").at(-1), "3. c");
});

Deno.test("reader: text moved by a tracked move is read at its destination, once", async () => {
  const md = await docxToMarkdown(docx(
    `<w:p><w:r><w:t>Start.</w:t></w:r><w:moveFrom w:id="1" w:author="A" w:date="2026-01-01T00:00:00Z"><w:r><w:t>Moved text.</w:t></w:r></w:moveFrom></w:p>` +
      `<w:p><w:moveTo w:id="2" w:author="A" w:date="2026-01-01T00:00:00Z"><w:r><w:t>Moved text.</w:t></w:r></w:moveTo><w:r><w:t> End.</w:t></w:r></w:p>`,
  ));
  assertEquals(md.trim(), "Start.\n\nMoved text. End.");
});

/* ------------------------------------------------------------------------ *
 * What Plate's exporter writes for the assistant's Markdown (seen 2026-11-20):
 * no Quote or Code style, only direct formatting. The reader has to know it,
 * or every assistant turn strips quotes and code from the document.
 * ------------------------------------------------------------------------ */
const run = (text: string, rPr = "") => `<w:r><w:rPr>${rPr}</w:rPr><w:t xml:space="preserve">${text}</w:t></w:r>`;
const MONO_SHADED = `<w:shd w:val="clear" w:fill="f5f5f5"/><w:rFonts w:ascii="Courier" w:hAnsi="Courier"/>`;
const INLINE_CODE = `<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/><w:highlight w:val="lightGray"/>`;
const QUOTE_PPR = `<w:pPr><w:ind w:left="284"/><w:pBdr><w:left w:val="single" w:sz="18" w:space="4" w:color="CCCCCC"/></w:pBdr></w:pPr>`;

Deno.test("docx: a paragraph with a left border and an indent is a quote; either alone is not", () => {
  const md = docxToMarkdown(docx(
    `<w:p>${run("Same words")}</w:p><w:p>${QUOTE_PPR}${run("Same words")}</w:p>` +
      `<w:p><w:pPr><w:ind w:left="284"/></w:pPr>${run("indented only")}</w:p>` +
      `<w:p><w:pPr><w:pBdr><w:left w:val="single" w:sz="18"/></w:pBdr></w:pPr>${run("bordered only")}</w:p>` +
      `<w:p><w:pPr><w:ind w:left="284"/><w:pBdr><w:left w:val="none"/></w:pBdr></w:pPr>${run("no border")}</w:p>`,
  ));
  assertEquals(md.trim(), "Same words\n\n> Same words\n\nindented only\n\nbordered only\n\nno border");
});

Deno.test("docx: shaded monospace paragraphs are one code block, a line each; inline code alone stays a paragraph", () => {
  const md = docxToMarkdown(docx(
    `<w:p>${run("before")}</w:p>` +
      `<w:p>${run("block code", MONO_SHADED)}</w:p><w:p>${run("line `two`", MONO_SHADED)}</w:p>` +
      `<w:p>${run("onlycode", INLINE_CODE)}</w:p>` +
      `<w:p>${run("use ")}${run("a`b", INLINE_CODE)}${run(" here")}</w:p>` +
      `<w:p>${run("mono", MONO_SHADED)}${run(" and plain")}</w:p>`,
  ));
  assertEquals(md.trim(), "before\n\n```\nblock code\nline `two`\n```\n\n`onlycode`\n\nuse ``a`b`` here\n\n`mono` and plain");
});

Deno.test("docx: code paragraphs by style are joined too, and a paragraph between two blocks keeps them apart", () => {
  const styles = `<w:styles ${W}><w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/></w:style></w:styles>`;
  const code = (t: string) => `<w:p><w:pPr><w:pStyle w:val="Code"/></w:pPr>${run(t)}</w:p>`;
  const bytes = zipSync({
    "word/document.xml": strToU8(`<w:document ${W}><w:body>${code("a = 1")}${code("b = 2")}<w:p>${run("then")}</w:p>${code("c = 3")}</w:body></w:document>`),
    "word/styles.xml": strToU8(styles),
  });
  assertEquals(docxToMarkdown(bytes).trim(), "```\na = 1\nb = 2\n```\n\nthen\n\n```\nc = 3\n```");
});

Deno.test("docx: a style the document names and does not define is read by its id", () => {
  const md = docxToMarkdown(docx(
    `<w:p><w:pPr><w:pStyle w:val="Quote"/></w:pPr>${run("Same words")}</w:p>` +
      `<w:p>${run("use ")}${run("a`b", `<w:rStyle w:val="Code"/>`)}</w:p>` +
      `<w:p><w:pPr><w:pStyle w:val="Code"/></w:pPr>${run("block code")}</w:p>` +
      `<w:p><w:pPr><w:pStyle w:val="Mystery"/></w:pPr>${run("plain")}</w:p>` +
      `<w:p><w:pPr><w:pStyle w:val="QuotesContinue"/></w:pPr>${run("not a quote")}</w:p>` +
      `<w:p>${run("label", `<w:rStyle w:val="Barcode"/>`)}</w:p>`,
  ));
  assertEquals(md.trim(), "> Same words\n\nuse ``a`b``\n\n```\nblock code\n```\n\nplain\n\nnot a quote\n\nlabel");
});

Deno.test("docx: blank code paragraphs at the ends of a block are padding; one inside is a line", () => {
  const styles = `<w:styles ${W}><w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/></w:style></w:styles>`;
  const code = (t: string) => `<w:p><w:pPr><w:pStyle w:val="Code"/></w:pPr>${run(t)}</w:p>`;
  const bytes = zipSync({
    "word/document.xml": strToU8(`<w:document ${W}><w:body>${code("a = 1")}${code(" ")}${code("b = 2")}${code(" ")}<w:p>${run("after")}</w:p></w:body></w:document>`),
    "word/styles.xml": strToU8(styles),
  });
  assertEquals(docxToMarkdown(bytes).trim(), "```\na = 1\n\nb = 2\n```\n\nafter");
});

Deno.test("docx: review of the quote and code rules: shading switched off, a bordered code style, a spacer between blocks", () => {
  const styles = `<w:styles ${W}><w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/></w:style></w:styles>`;
  const code = (t: string, extra = "") => `<w:p><w:pPr><w:pStyle w:val="Code"/>${extra}</w:pPr>${run(t)}</w:p>`;
  const body =
    // Shading that says "none" is not shading.
    `<w:p>${run("FILE", `<w:shd w:val="nil" w:fill="EEEEEE"/><w:rFonts w:ascii="Courier New"/>`)}</w:p>` +
    // A code style that also draws a left rule is code, not a quote.
    code("a = 1", `<w:ind w:left="284"/><w:pBdr><w:left w:val="single" w:sz="18"/></w:pBdr>`) +
    // An empty paragraph between two code blocks keeps them two.
    `<w:p/>` + code("b = 2") +
    // Numbering switched off on a bordered, indented paragraph: not a quote.
    `<w:p><w:pPr><w:numPr><w:numId w:val="0"/></w:numPr><w:ind w:left="284"/><w:pBdr><w:left w:val="single"/></w:pBdr></w:pPr>${run("list-shaped")}</w:p>`;
  const bytes = zipSync({ "word/document.xml": strToU8(`<w:document ${W}><w:body>${body}</w:body></w:document>`), "word/styles.xml": strToU8(styles) });
  assertEquals(docxToMarkdown(bytes).trim(), "`FILE`\n\n```\na = 1\n```\n\n```\nb = 2\n```\n\nlist-shaped");
});

// --- review of pull request 72 (CodeRabbit, CodeAnt, SonarCloud; 2026-11-20) ---

Deno.test("docx: an empty line inside shaded monospace code is a line of the block; alone it is nothing", () => {
  const empty = `<w:p><w:r><w:rPr>${MONO_SHADED}</w:rPr><w:t></w:t></w:r></w:p>`;
  const md = docxToMarkdown(docx(`<w:p>${run("a", MONO_SHADED)}</w:p>${empty}<w:p>${run("b", MONO_SHADED)}</w:p><w:p>${run("then")}</w:p>${empty}<w:p>${run("end")}</w:p>`));
  assertEquals(md.trim(), "```\na\n\nb\n```\n\nthen\n\nend");
});

Deno.test("docx: a code paragraph that carries a list's counter event is not merged away", () => {
  // Lists 2 and 3: level 0 shows no marker, level 1 counts. A code paragraph of list 3 at level 0
  // between two level-1 items of list 3 starts their numbering again, also right after a code
  // paragraph of list 2.
  const outline = `<w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="none"/></w:lvl>` +
    `<w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="decimal"/></w:lvl></w:abstractNum>` +
    `<w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num><w:num w:numId="3"><w:abstractNumId w:val="1"/></w:num>`;
  const code = (t: string, numId: string) => `<w:p><w:pPr><w:pStyle w:val="Code"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="${numId}"/></w:numPr></w:pPr><w:r><w:t>${t}</w:t></w:r></w:p>`;
  const md = docxToMarkdown(docxWith(p("x", "3", 1) + code("c1", "2") + code("c2", "3") + p("y", "3", 1), outline));
  assertEquals(md.match(/\d+\. \w/g), ["1. x", "1. y"]);
});

Deno.test("docx: a code block with many blank lines inside is trimmed at its ends in linear time", () => {
  const styles = `<w:styles ${W}><w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/></w:style></w:styles>`;
  const code = (t: string) => `<w:p><w:pPr><w:pStyle w:val="Code"/></w:pPr>${run(t)}</w:p>`;
  const body = code(" ") + code("  a = 1") + code(" ").repeat(40) + code("b = 2") + code(" ");
  const bytes = zipSync({ "word/document.xml": strToU8(`<w:document ${W}><w:body>${body}</w:body></w:document>`), "word/styles.xml": strToU8(styles) });
  const t0 = performance.now();
  const md = docxToMarkdown(bytes);
  assertEquals(md.trim(), "```\n  a = 1\n" + "\n".repeat(40) + "b = 2\n```");
  assertEquals(performance.now() - t0 < 2000, true);
});

Deno.test("docx: numbering that comes from the style keeps a bordered, indented paragraph from being a quote", () => {
  const styles = `<w:styles ${W}>` +
    `<w:style w:type="paragraph" w:styleId="Outline"><w:name w:val="Outline"/><w:pPr><w:numPr><w:numId w:val="2"/></w:numPr></w:pPr></w:style>` +
    `<w:style w:type="paragraph" w:styleId="Off"><w:name w:val="Off"/><w:pPr><w:numPr><w:numId w:val="0"/></w:numPr></w:pPr></w:style></w:styles>`;
  const numbering = `<w:numbering ${W}><w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="none"/></w:lvl></w:abstractNum><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num></w:numbering>`;
  const bordered = (style: string, t: string) => `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ""}<w:ind w:left="284"/><w:pBdr><w:left w:val="single" w:sz="18"/></w:pBdr></w:pPr>${run(t)}</w:p>`;
  const bytes = zipSync({
    "word/document.xml": strToU8(`<w:document ${W}><w:body>${bordered("Outline", "in a list")}${bordered("Off", "numbering off")}${bordered("", "a quote")}</w:body></w:document>`),
    "word/styles.xml": strToU8(styles),
    "word/numbering.xml": strToU8(numbering),
  });
  assertEquals(docxToMarkdown(bytes).trim(), "in a list\n\nnumbering off\n\n> a quote");
});

Deno.test("docx: a code paragraph that is only line breaks keeps them as empty lines", () => {
  const styles = `<w:styles ${W}><w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/></w:style></w:styles>`;
  const code = (inner: string) => `<w:p><w:pPr><w:pStyle w:val="Code"/></w:pPr>${inner}</w:p>`;
  const body = code(run("a")) + code(`<w:r><w:t xml:space="preserve"> </w:t><w:br/><w:br/></w:r>`) + code(run("b"));
  const bytes = zipSync({ "word/document.xml": strToU8(`<w:document ${W}><w:body>${body}</w:body></w:document>`), "word/styles.xml": strToU8(styles) });
  assertEquals(docxToMarkdown(bytes).trim(), "```\na\n\n\n\nb\n```");
});
