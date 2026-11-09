/**
 * canvas-editor demo.
 *
 * @hufe921/canvas-editor draws the page (canvas/SVG) instead of using DOM, so
 * "the document" is an `IElement[]` (or a tree of them, via valueList). Its npm
 * package ships no DOCX converter — the upstream repo keeps that in its demo —
 * so this adapter does the conversion itself:
 *
 *   .docx  → parsed in the browser with fflate + a tiny OOXML reader
 *          → IElement list                              (import)
 *   IElement list → OOXML tables + zip               (export, real .docx)
 *
 * That makes this the one demo where DOCX import/export is written from
 * scratch rather than delegated to the library.
 */
import Editor, {
  ElementType,
  ListType,
  RowFlex,
  TitleLevel,
} from "https://esm.sh/@hufe921/canvas-editor@1.1.0?bundle";
import { unzipSync, strFromU8, strToU8, zipSync } from "https://esm.sh/fflate@0.8.2";
import { waitFor } from "/lib/kit.ts";
import { mdToBlocks } from "/lib/md.ts";

let editor: Editor | undefined;

/* ---------------------------- blocks → elements ---------------------------- */

const TITLE_LEVELS = [TitleLevel.FIRST, TitleLevel.SECOND, TitleLevel.THIRD];
const BULLET_LIST = ListType.UL ?? ListType.OL;

/** One paragraph → one list of IElements (the last one carries `\n`). */
function paragraphElements(
  text: string,
  opts: { bold?: boolean; title?: TitleLevel; list?: boolean; listId?: string },
) {
  const shared: Record<string, unknown> = {};
  if (opts.title !== undefined) shared.level = opts.title;
  if (opts.bold) shared.bold = true;
  if (opts.list) {
    shared.listType = BULLET_LIST;
    shared.listId = opts.listId ?? crypto.randomUUID();
  }
  const chars = [...text];
  if (!chars.length) return [{ value: "\n", ...shared }];
  return chars.map((value, i) => ({
    value: i === chars.length - 1 ? `${value}\n` : value,
    ...shared,
  }));
}

/* -------------------------------- adapter -------------------------------- */

window.od.register({
  name: "canvas-editor",
  mergeQuality: "rebuild",

  async mount() {
    const host = await waitFor<HTMLDivElement>("#ce-host");
    const docx = await window.od.sampleDocx();
    const data = await docxToElements(docx);
    host.innerHTML = "";
    const inner = document.createElement("div");
    inner.style.margin = "0 auto";
    host.append(inner);
    editor = new Editor(inner, { main: data }, {
      width: 794,
      height: 1123,
      margins: [60, 60, 60, 60],
      defaultFont: "Calibri",
    });
  },

  async applyMarkdown(markdown) {
    if (!editor) return;
    editor.command.executeSetValue({ main: markdownToElements(markdown) });
  },

  async getMarkdown() {
    if (!editor) return await window.od.sampleMarkdown();
    const { data } = await editor.command.getValueAsync();
    const list = Array.isArray(data) ? data : data.main;
    return elementsToMarkdown(list);
  },

  async exportDocx() {
    if (!editor) throw new Error("editor not ready");
    const { data } = await editor.command.getValueAsync();
    const list = Array.isArray(data) ? data : data.main;
    return elementsToDocx(list);
  },

  async importDocx(bytes) {
    if (!editor) throw new Error("editor not ready");
    editor.command.executeSetValue({ main: await docxToElements(bytes) });
  },
});

/* ------------------------------ markdown I/O ------------------------------ */

function markdownToElements(md: string): any[] {
  const out: any[] = [];
  for (const b of mdToBlocks(md)) {
    if (b.type === "title") {
      out.push(...paragraphElements(b.text, { title: TITLE_LEVELS[0], bold: true }));
    } else if (b.type === "h1") {
      out.push(...paragraphElements(b.text, { title: TITLE_LEVELS[1], bold: true }));
    } else if (b.type === "h2" || b.type === "h3") {
      out.push(...paragraphElements(b.text, { title: TITLE_LEVELS[2], bold: true }));
    } else if (b.type === "li") {
      out.push(...paragraphElements(b.text, { list: true, listId: "bench-list" }));
    } else {
      out.push(...paragraphElements(b.text, {}));
    }
  }
  return out;
}

/**
 * canvas-editor flattens paragraphs into a character list; `\n` is the only
 * paragraph boundary (list items keep their `listId`/`listType` attrs). We
 * therefore rebuild paragraphs by splitting on `\n`.
 */
function elementsToMarkdown(list: any[]): string {
  const lines: string[] = [];
  let current: any[] = [];
  const flush = () => {
    if (!current.length) return;
    const text = current.map((e) => String(e.value ?? "")).join("").trim();
    if (!text) {
      current = [];
      return;
    }
    const meta = current[0];
    const isRemoved = current.some((e) => e.rowFlex === RowFlex.NONE);
    if (isRemoved) {
      // deleted text still exists in the element list
    } else if (meta.level === TitleLevel.FIRST) lines.push(`# ${text}`);
    else if (meta.level === TitleLevel.SECOND) lines.push(`## ${text}`);
    else if (meta.level === TitleLevel.THIRD) lines.push(`### ${text}`);
    else if (meta.listType) lines.push(`- ${text}`);
    else lines.push(text);
    current = [];
  };
  for (const el of list) {
    if (el.value === "\n") {
      flush();
      continue;
    }
    if (el.type && el.type !== ElementType.TEXT) {
      // Tables, separators, images… aren't representable in markdown; note them.
      if (el.type === ElementType.TABLE) lines.push("_[table]_");
      continue;
    }
    current.push(el);
  }
  flush();
  return lines.join("\n\n");
}

/* -------------------------------- DOCX in -------------------------------- */

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * A deliberately small OOXML reader: paragraphs, run text/breaks, paragraph
 * styles (Title/Heading n), numbering (as bullets), bold/italic.
 */
async function docxToElements(bytes: Uint8Array): Promise<any[]> {
  const files = unzipSync(bytes);
  const docFile = files["word/document.xml"];
  if (!docFile) throw new Error("not a .docx (no word/document.xml)");
  const xml = strFromU8(docFile);
  const body = /<w:body[^>]*>([\s\S]*)<\/w:body>/.exec(xml)?.[1] ?? xml;

  const out: any[] = [];
  const pRe = /<w:p(\s[^>]*)?>([\s\S]*?)<\/w:p>|<w:p(\s[^>]*)?\/>/g;
  let m: RegExpExecArray | null;
  let any = false;

  while ((m = pRe.exec(body))) {
    any = true;
    const inner = m[2] ?? "";

    const pStyle = /<w:pStyle\s+w:val="([^"]+)"/.exec(inner)?.[1];
    const isBullet = /<w:numPr>/.test(inner);
    const levelMatch = /<w:outlineLvl\s+w:val="(\d+)"/.exec(inner);
    const headingLevel = pStyle?.match(/^Heading(\d)$/i)?.[1] ??
      levelMatch?.[1];

    let title: TitleLevel | undefined;
    if (/^title$/i.test(pStyle ?? "")) title = TITLE_LEVELS[0];
    else if (headingLevel) {
      const n = Number(headingLevel);
      title = n <= 1 ? TITLE_LEVELS[1] : TITLE_LEVELS[2];
    }

    // Runs, preserving order of text / tab / break.
    const runs: Array<{ value: string; bold?: boolean; italic?: boolean }> = [];
    const rRe = /<w:r(\s[^>]*)?>([\s\S]*?)<\/w:r>/g;
    let r: RegExpExecArray | null;
    while ((r = rRe.exec(inner))) {
      const rXml = r[2];
      const bold = /<w:b(?:\s+w:val="(?:1|true)")?\s*\/>/.test(rXml);
      const italic = /<w:i(?:\s+w:val="(?:1|true)")?\s*\/>/.test(rXml);
      const tRe = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:br\s*\/>|<w:tab\s*\/>/g;
      let t: RegExpExecArray | null;
      while ((t = tRe.exec(rXml))) {
        if (t[1] !== undefined) {
          runs.push({ value: decodeXml(t[1]), bold, italic });
        } else if (t[0].startsWith("<w:br")) {
          runs.push({ value: "\n", bold, italic });
        } else {
          runs.push({ value: "\t", bold, italic });
        }
      }
    }

    const text = runs.map((x) => x.value).join("");
    const style = {
      ...(title !== undefined ? { level: title } : {}),
      ...(isBullet
        ? { listType: BULLET_LIST, listId: "imported-list" }
        : {}),
    };

    if (!text.replace(/\n/g, "").length && !title) {
      out.push({ value: "\n", ...style });
      continue;
    }

    // Split on explicit breaks so each visual line stays a paragraph.
    const segments = text.split("\n");
    segments.forEach((seg, idx) => {
      const chars = [...seg];
      if (!chars.length) {
        out.push({ value: "\n", ...style });
      } else {
        // canvas-editor styles per character, so the run's bold/italic is
        // carried onto every character of that run.
        const runAttrs = runs.find((x) => x.value.startsWith(chars[0])) ?? {};
        chars.forEach((value, i) => {
          out.push({
            value: idx === segments.length - 1 && i === chars.length - 1
              ? `${value}\n`
              : value,
            ...style,
            ...(runAttrs.bold ? { bold: true } : {}),
            ...(runAttrs.italic ? { italic: true } : {}),
          });
        });
      }
    });
  }

  if (!any) throw new Error("no paragraphs found in document.xml");
  return out;
}

/* ------------------------------- DOCX out ------------------------------- */

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Group the flat element list back into paragraphs, then emit OOXML. */
function elementsToDocx(list: any[]): Uint8Array {
  const paragraphs: any[][] = [];
  let current: any[] = [];
  for (const el of list) {
    current.push(el);
    if (el.value === "\n" || (el.value ?? "").endsWith("\n")) {
      paragraphs.push(current);
      current = [];
    }
  }
  if (current.length) paragraphs.push(current);

  const paraXml = paragraphs.map((para) => {
    const meta = para[0] ?? {};
    const text = para.map((e) => String(e.value ?? "")).join("").replace(/\n/g, "");
    const style =
      meta.level === TitleLevel.FIRST
        ? "Title"
        : meta.level === TitleLevel.SECOND
        ? "Heading1"
        : meta.level === TitleLevel.THIRD
        ? "Heading2"
        : undefined;
    const pPr = [
      style ? `<w:pStyle w:val="${style}"/>` : "",
      meta.listType
        ? '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>'
        : "",
    ].join("");
    const rPr = meta.bold ? "<w:rPr><w:b/></w:rPr>" : "";
    return `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ""}<w:r>${
      rPr
    }<w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;
  }).join("\n");

  const documentXml = `${XML_DECL}
<w:document xmlns:w="${W_NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:body>${paraXml}
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
</w:body></w:document>`;

  const stylesXml = `${XML_DECL}
<w:styles xmlns:w="${W_NS}">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:b/><w:sz w:val="56"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:rPr><w:b/><w:sz w:val="30"/></w:rPr></w:style>
</w:styles>`;

  const numberingXml = `${XML_DECL}
<w:numbering xmlns:w="${W_NS}">
<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;

  const contentTypes = `${XML_DECL}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>`;

  const rels = `${XML_DECL}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const docRels = `${XML_DECL}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>`;

  return zipSync({
    "[Content_Types].xml": strToU8(contentTypes),
    "_rels/.rels": strToU8(rels),
    "word/document.xml": strToU8(documentXml),
    "word/styles.xml": strToU8(stylesXml),
    "word/numbering.xml": strToU8(numberingXml),
    "word/_rels/document.xml.rels": strToU8(docRels),
  });
}
