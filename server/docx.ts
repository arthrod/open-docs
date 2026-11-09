/**
 * Zero-dependency DOCX plumbing shared by every editor demo.
 *
 * `sample.docx.ts` is a tiny hand-written OOXML package used as the "open me"
 * fixture; `textFromDocx` is the server-side fallback importer used by editors
 * that have no native DOCX reader (so the agent and the client both still get
 * the document text); `textToDocx` is the shared writer used when an editor
 * can't export DOCX itself.
 */
import { zipSync, unzipSync, strToU8, strFromU8 } from "npm:fflate@0.8.2";

export { zipSync, unzipSync, strToU8, strFromU8 };

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface DocxParagraph {
  text: string;
  /** "Heading1".."Heading6" | "Title" | undefined */
  style?: string;
  /** 1-based list level, rendered as a bulleted list item. */
  bullet?: number;
  bold?: boolean;
  italic?: boolean;
}

function paragraphXml(p: DocxParagraph): string {
  const rPr = [
    p.bold ? "<w:b/>" : "",
    p.italic ? "<w:i/>" : "",
  ].join("");
  const pPr = [
    p.style ? `<w:pStyle w:val="${escapeXml(p.style)}"/>` : "",
    p.bullet
      ? `<w:numPr><w:ilvl w:val="${p.bullet - 1}"/><w:numId w:val="1"/></w:numPr>`
      : "",
  ].join("");
  const pPrXml = pPr ? `<w:pPr>${pPr}</w:pPr>` : "";
  // An empty paragraph has NO run: `<w:r><w:t></w:t></w:r>` is legal OOXML but
  // ProseMirror-based editors (docen) reject the empty text node it maps to.
  const runs = !p.text ? "" : p.text.split("\n").map((line, i, arr) =>
    `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ""}<w:t xml:space="preserve">${
      escapeXml(line)
    }</w:t></w:r>${i < arr.length - 1 ? "<w:r><w:br/></w:r>" : ""}`
  ).join("");
  return `<w:p>${pPrXml}${runs}</w:p>`;
}

/** Build a minimal but valid .docx from plain paragraphs. */
export function buildDocx(
  paragraphs: Array<DocxParagraph | string>,
  title = "Document",
): Uint8Array {
  const paras = paragraphs.map((p) => typeof p === "string" ? { text: p } : p);
  if (!paras.length) paras.push({ text: "" });

  const documentXml = `${XML_DECL}
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${paras.map(paragraphXml).join("\n    ")}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const stylesXml = `${XML_DECL}
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/>
      <w:sz w:val="22"/><w:szCs w:val="22"/>
      <w:lang w:val="en-US" w:eastAsia="en-US" w:bidi="ar-SA"/>
    </w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:before="0" w:after="240"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="56"/><w:szCs w:val="56"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/>
    <w:pPr><w:keepNext/><w:spacing w:before="360" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/>
    <w:pPr><w:keepNext/><w:spacing w:before="280" w:after="100"/><w:outlineLvl w:val="1"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/>
    <w:pPr><w:keepNext/><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="2"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>
</w:styles>`;

  const numberingXml = `${XML_DECL}
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/>
      <w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl>
    <w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="o"/>
      <w:pPr><w:ind w:left="1440" w:hanging="360"/></w:pPr></w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>`;

  const contentTypesXml = `${XML_DECL}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;

  const rootRelsXml = `${XML_DECL}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

  const docRelsXml = `${XML_DECL}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>`;

  const coreXml = `${XML_DECL}
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
  xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(title)}</dc:title>
  <dc:creator>open-docs bench</dc:creator>
  <cp:lastModifiedBy>open-docs bench</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">2026-01-01T00:00:00Z</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">2026-01-01T00:00:00Z</dcterms:modified>
</cp:coreProperties>`;

  const appXml = `${XML_DECL}
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
  xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>open-docs</Application>
</Properties>`;

  return zipSync({
    "[Content_Types].xml": strToU8(contentTypesXml),
    "_rels/.rels": strToU8(rootRelsXml),
    "docProps/core.xml": strToU8(coreXml),
    "docProps/app.xml": strToU8(appXml),
    "word/_rels/document.xml.rels": strToU8(docRelsXml),
    "word/document.xml": strToU8(documentXml),
    "word/styles.xml": strToU8(stylesXml),
    "word/numbering.xml": strToU8(numberingXml),
  });
}

/**
 * Server-side fallback DOCX importer: pulls paragraph text out of
 * `word/document.xml`. Deliberately simple (no tables, fields or runs merging)
 * — it exists so every editor can at least start from a real .docx and so the
 * agent has document text when the browser engine can't hand us any.
 */
export function textFromDocx(bytes: Uint8Array): {
  title: string;
  paragraphs: DocxParagraph[];
} {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error("Not a readable .docx (zip) file");
  }
  const doc = files["word/document.xml"];
  if (!doc) throw new Error("Not a Word document: missing word/document.xml");
  const xml = strFromU8(doc);

  let title = "";
  const core = files["docProps/core.xml"];
  if (core) {
    title = /<dc:title>([\s\S]*?)<\/dc:title>/.exec(strFromU8(core))?.[1] ?? "";
  }

  const paragraphs: DocxParagraph[] = [];
  const body = /<w:body>([\s\S]*)<\/w:body>/.exec(xml)?.[1] ?? xml;
  const pRe = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>|<w:p\/>/g;
  let m: RegExpExecArray | null;
  while ((m = pRe.exec(body))) {
    const inner = m[1] ?? "";
    const style = /<w:pStyle w:val="([^"]+)"/.exec(inner)?.[1];
    const bulletLevel = /<w:numPr>[\s\S]*?<w:ilvl w:val="(\d+)"/.exec(inner);
    const hasNum = /<w:numPr>/.test(inner);
    let text = "";
    const tRe = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:br\s*\/>|<w:tab\s*\/>/g;
    let t: RegExpExecArray | null;
    while ((t = tRe.exec(inner))) {
      if (t[1] !== undefined) text += unescapeXml(t[1]);
      else if (t[0].startsWith("<w:br")) text += "\n";
      else text += "\t";
    }
    paragraphs.push({
      text,
      style: style && /^Heading\d$|^Title$/.test(style) ? style : undefined,
      bullet: hasNum ? Number(bulletLevel?.[1] ?? 0) + 1 : undefined,
    });
  }
  return { title, paragraphs };
}

function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Flatten paragraphs to readable plain text (what the agent gets). */
export function paragraphsToText(paragraphs: DocxParagraph[]): string {
  return paragraphs
    .filter((p) => p.text.trim() || p.style)
    .map((p) => {
      // Title and Heading 1 → "# ", Heading N → N × "#": the same mapping as
      // lib/markdown.ts, so text read here round-trips to the same styles.
      const prefix = p.style === "Title" ? "# " : p.style?.startsWith("Heading")
        ? "#".repeat(Number(p.style.slice(-1)) || 1) + " "
        : p.bullet
        ? "  ".repeat(p.bullet - 1) + "- "
        : "";
      return prefix + p.text;
    })
    .join("\n");
}

/**
 * Minimal markdown → paragraphs. Line-based (not block-based) so it agrees with
 * `mdToBlocks` in lib/md.ts — otherwise one blank-line style round-trips into a
 * different document than the other.
 */
export function textToParagraphs(markdown: string): DocxParagraph[] {
  const out: DocxParagraph[] = [];
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) continue;
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      out.push({
        text: heading[2],
        style: level === 1 ? "Title" : `Heading${Math.min(level - 1, 3)}`,
      });
      continue;
    }
    const bullet = /^(\s*)[-*+]\s+(.*)$/.exec(line);
    if (bullet) {
      out.push({
        text: bullet[2],
        bullet: Math.min(Math.floor(bullet[1].length / 2) + 1, 2),
      });
      continue;
    }
    const bold = /^\*\*(.+)\*\*$/.exec(line.trim());
    if (bold) {
      out.push({ text: bold[1], bold: true });
      continue;
    }
    out.push({ text: line.trim() });
  }
  return out.length ? out : [{ text: "" }];
}

/** Does this look like a zip / DOCX? Cheap sniff for uploads. */
export function looksLikeZip(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}
