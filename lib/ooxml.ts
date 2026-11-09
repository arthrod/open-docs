/**
 * A minimal, Word-valid .docx writer for editors that have no DOCX exporter
 * of their own (canvas-editor, Plate).
 *
 * Input is a flat paragraph model — the common denominator of every editor's
 * document — and output is a complete package: styles (Title, Heading 1–6,
 * Quote, Code, Hyperlink), multi-level bullet/decimal numbering, run
 * formatting and external hyperlinks.
 */
import { strToU8, zipSync } from "https://esm.sh/fflate@0.8.2";

export type Run = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  /** Inline code: the CodeChar style (Courier New). */
  code?: boolean;
  /** External hyperlink target. */
  href?: string;
  /** Font family name. */
  font?: string;
  /** Size in points. */
  sizePt?: number;
  /** Text colour, #rrggbb. */
  color?: string;
  /** Background (shading) colour, #rrggbb. */
  background?: string;
  vertAlign?: "superscript" | "subscript";
};
/**
 * `title`: the Title style. `heading` level: 1–6 = Heading 1–6.
 * `li` level: 0-based nesting depth. `code`: a code block (Code style).
 * `hr`: a thematic break (empty paragraph with a bottom border).
 * `table`: `rows` of cells of runs; the first row is the header (bold,
 * repeated on each page); `runs` is unused.
 */
export type Block = {
  kind: "p" | "title" | "heading" | "li" | "quote" | "code" | "hr" | "table";
  level?: number;
  ordered?: boolean;
  align?: "left" | "center" | "right" | "justify";
  runs: Run[];
  rows?: Run[][][];
};

const hex = (c?: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(c ?? "") ?? /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(c ?? "");
  if (!m) return "";
  return (m.length === 2 ? m[1] : m.slice(1).map((x) => x + x).join("")).toUpperCase();
};

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

// XML 1.0 forbids most C0 controls (and lone surrogates); one of them in a run
// makes the whole document.xml malformed, which Word refuses to open.
const XML_INVALID = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
const esc = (s: string) => s.replace(XML_INVALID, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function runXml(r: Run): string {
  // rPr children have a fixed schema order:
  // rStyle, rFonts, b, i, strike, color, sz, szCs, u, shd, vertAlign.
  const rStyle = r.code ? "CodeChar" : r.href ? "Hyperlink" : "";
  const font = r.font ? esc(r.font.replace(/["']/g, "").split(",")[0].trim()) : "";
  const color = hex(r.color), bg = hex(r.background);
  const half = r.sizePt && r.sizePt > 0 ? Math.round(r.sizePt * 2) : 0;
  const rPr = (rStyle ? `<w:rStyle w:val="${rStyle}"/>` : "") +
    (font ? `<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/>` : "") +
    (r.bold ? "<w:b/>" : "") + (r.italic ? "<w:i/>" : "") + (r.strike ? "<w:strike/>" : "") +
    (color ? `<w:color w:val="${color}"/>` : "") + (half ? `<w:sz w:val="${half}"/><w:szCs w:val="${half}"/>` : "") +
    (r.underline ? '<w:u w:val="single"/>' : "") + (bg ? `<w:shd w:val="clear" w:color="auto" w:fill="${bg}"/>` : "") +
    (r.vertAlign ? `<w:vertAlign w:val="${r.vertAlign}"/>` : "");
  // Tabs and line breaks are elements in OOXML, not characters.
  const body = r.text.split(/(\t|\n)/).map((part) =>
    part === "\t" ? "<w:tab/>" : part === "\n" ? "<w:br/>" : part ? `<w:t xml:space="preserve">${esc(part)}</w:t>` : ""
  ).join("");
  return `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ""}${body}</w:r>`;
}

/** Hyperlink targets → relationship ids, collected while writing the body. */
type Links = Map<string, string>;

function linkId(links: Links, href: string): string {
  let id = links.get(href);
  if (!id) links.set(href, id = `rIdLink${links.size + 1}`);
  return id;
}

function paragraphXml(b: Block, numId: number, links: Links): string {
  let pPr = b.kind === "title"
    ? '<w:pStyle w:val="Title"/>'
    : b.kind === "heading"
    ? `<w:pStyle w:val="Heading${Math.min(Math.max(b.level ?? 1, 1), 6)}"/>`
    : b.kind === "li"
    ? `<w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="${Math.min(b.level ?? 0, 8)}"/><w:numId w:val="${numId}"/></w:numPr>`
    : b.kind === "quote"
    ? '<w:pStyle w:val="Quote"/>'
    : b.kind === "code"
    ? '<w:pStyle w:val="Code"/>'
    : b.kind === "hr"
    ? '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="A0A0A0"/></w:pBdr>'
    : "";
  // pPr order: pStyle, numPr, pBdr, … jc.
  const jc = b.align && b.align !== "left" ? `<w:jc w:val="${b.align === "justify" ? "both" : b.align}"/>` : "";
  pPr += jc;
  // Consecutive runs with the same href share one <w:hyperlink>.
  let body = "";
  const runs = b.kind === "hr" ? [] : b.runs.filter((r) => r.text);
  for (let i = 0; i < runs.length;) {
    const href = runs[i].href;
    if (!href) {
      body += runXml(runs[i++]);
      continue;
    }
    let inner = "";
    while (i < runs.length && runs[i].href === href) inner += runXml(runs[i++]);
    body += `<w:hyperlink r:id="${linkId(links, href)}" w:history="1">${inner}</w:hyperlink>`;
  }
  return `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ""}${body}</w:p>`;
}

/** Text width of the page below (12240 − 2 × 1440 twips). */
const TEXT_WIDTH = 9360;

function tableXml(b: Block, links: Links): string {
  const rows = (b.rows ?? []).filter((r) => r.length);
  const cols = Math.max(1, ...rows.map((r) => r.length));
  const w = Math.floor(TEXT_WIDTH / cols);
  const border = (side: string) => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="A0A0A0"/>`;
  const tblPr = `<w:tblPr><w:tblW w:w="${w * cols}" w:type="dxa"/><w:tblBorders>${
    ["top", "left", "bottom", "right", "insideH", "insideV"].map(border).join("")
  }</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>`;
  const grid = `<w:tblGrid>${`<w:gridCol w:w="${w}"/>`.repeat(cols)}</w:tblGrid>`;
  const trs = rows.map((cells, ri) => {
    const tcs = Array.from({ length: cols }, (_, ci) => {
      const runs = (cells[ci] ?? []).map((r) => (ri === 0 ? { ...r, bold: true } : r));
      // Every cell needs a paragraph, even an empty one.
      return `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/></w:tcPr>${paragraphXml({ kind: "p", runs }, 1, links)}</w:tc>`;
    }).join("");
    return `<w:tr>${ri === 0 ? "<w:trPr><w:tblHeader/></w:trPr>" : ""}${tcs}</w:tr>`;
  }).join("");
  return `<w:tbl>${tblPr}${grid}${trs}</w:tbl>`;
}

function levels(ordered: boolean): string {
  const bullets = ["•", "◦", "▪"];
  return Array.from({ length: 9 }, (_, i) => {
    const fmt = ordered ? ["decimal", "lowerLetter", "lowerRoman"][i % 3] : "bullet";
    const text = ordered ? `%${i + 1}.` : bullets[i % 3];
    const font = ordered ? "" : '<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr>';
    return `<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="${fmt}"/><w:lvlText w:val="${text}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${720 * (i + 1)}" w:hanging="360"/></w:pPr>${font}</w:lvl>`;
  }).join("");
}

const STYLES = `${XML_DECL}
<w:styles xmlns:w="${W_NS}">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="240"/></w:pPr><w:rPr><w:sz w:val="56"/><w:szCs w:val="56"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="360" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="60"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading4"><w:name w:val="heading 4"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="160" w:after="60"/><w:outlineLvl w:val="3"/></w:pPr><w:rPr><w:b/><w:i/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading5"><w:name w:val="heading 5"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="160" w:after="60"/><w:outlineLvl w:val="4"/></w:pPr><w:rPr><w:b/><w:i/><w:color w:val="1F3763"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading6"><w:name w:val="heading 6"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="160" w:after="60"/><w:outlineLvl w:val="5"/></w:pPr><w:rPr><w:b/><w:i/><w:color w:val="1F3763"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="60"/><w:contextualSpacing/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:ind w:left="720"/></w:pPr><w:rPr><w:i/><w:color w:val="404040"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:shd w:val="clear" w:color="auto" w:fill="F3F4F6"/><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:style>
<w:style w:type="character" w:styleId="CodeChar"><w:name w:val="Code Char"/><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/><w:shd w:val="clear" w:color="auto" w:fill="F3F4F6"/></w:rPr></w:style>
<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:uiPriority w:val="99"/><w:unhideWhenUsed/><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr></w:style>
</w:styles>`;

/**
 * numId 1 = bullets (shared). Each separate numbered list gets its own numId
 * with a start override, otherwise Word continues numbering from the previous
 * list ("1, 2" … later "3, 4" instead of "1, 2").
 */
function numberingXml(orderedLists: number): string {
  const nums = Array.from({ length: orderedLists }, (_, i) =>
    `<w:num w:numId="${i + 2}"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>`
  ).join("");
  return `${XML_DECL}
<w:numbering xmlns:w="${W_NS}">
<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>${levels(false)}</w:abstractNum>
<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>${levels(true)}</w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>${nums}
</w:numbering>`;
}

// Without compatibilityMode 15, Word opens the file in "Compatibility Mode".
const SETTINGS = `${XML_DECL}
<w:settings xmlns:w="${W_NS}"><w:defaultTabStop w:val="720"/><w:characterSpacingControl w:val="doNotCompress"/>
<w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`;

const CONTENT_TYPES = `${XML_DECL}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
</Types>`;

const RELS = `${XML_DECL}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

function docRels(links: Links): string {
  const ext = [...links].map(([href, id]) =>
    `<Relationship Id="${id}" Type="${REL}/hyperlink" Target="${esc(href)}" TargetMode="External"/>`
  ).join("\n");
  return `${XML_DECL}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="${REL}/styles" Target="styles.xml"/>
<Relationship Id="rId2" Type="${REL}/numbering" Target="numbering.xml"/>
<Relationship Id="rId3" Type="${REL}/settings" Target="settings.xml"/>
${ext}
</Relationships>`;
}

export function blocksToDocx(blocks: Block[]): Uint8Array {
  // A numbered list starts at a top-level numbered item that doesn't directly
  // follow another numbered item.
  let orderedLists = 0;
  const links: Links = new Map();
  const body = blocks.map((b, i) => {
    let numId = 1;
    if (b.kind === "li" && b.ordered) {
      const prev = blocks[i - 1];
      const continues = prev?.kind === "li" && (prev.ordered || (prev.level ?? 0) > (b.level ?? 0));
      if (!continues || orderedLists === 0) orderedLists++;
      numId = orderedLists + 1;
    }
    if (b.kind === "table") {
      // Two adjacent tables would merge into one, and Word wants a paragraph
      // after a table that ends the body.
      const next = blocks[i + 1];
      return tableXml(b, links) + (!next || next.kind === "table" ? "<w:p/>" : "");
    }
    return paragraphXml(b, numId, links);
  }).join("\n") || "<w:p/>";
  // sectPr must be the LAST child of w:body, or Word offers to repair the file.
  const documentXml = `${XML_DECL}
<w:document xmlns:w="${W_NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:body>${body}
<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>
</w:body></w:document>`;
  return zipSync({
    "[Content_Types].xml": strToU8(CONTENT_TYPES),
    "_rels/.rels": strToU8(RELS),
    "word/document.xml": strToU8(documentXml),
    "word/styles.xml": strToU8(STYLES),
    "word/numbering.xml": strToU8(numberingXml(orderedLists)),
    "word/settings.xml": strToU8(SETTINGS),
    "word/_rels/document.xml.rels": strToU8(docRels(links)),
  });
}
