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
