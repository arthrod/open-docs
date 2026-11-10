/**
 * .docx → markdown, in the browser: the reading half of lib/markdown.ts.
 *
 * Editors with no markdown export of their own (docx-editor.dev, Docxodus,
 * WordCraft's release build) hand the assistant their document through this, so
 * it must keep what Word documents commonly carry: Title / Heading 1–6 (style name,
 * style id or outline level, through `basedOn`), bold / italic / strike,
 * inline code (a code character style or a monospace font), hyperlinks
 * (relationships and HYPERLINK fields), bullet vs numbered lists from
 * numbering.xml with their nesting, quotes, code blocks, horizontal rules and
 * tables (as GFM tables). Deleted tracked text is skipped, inserted text kept.
 *
 * Heading depth is read from the document's styles (`Heading 3` is `###`),
 * never inferred from numbering text.
 */
import { strFromU8, unzipSync } from "https://esm.sh/fflate@0.8.2?target=es2022";
import { type Block, blocksToMarkdown, type ListState, type Run, tableToMarkdown } from "./markdown.ts";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const MONO = /courier|consolas|mono|menlo|monaco|source code|fira code|jetbrains/i;

type StyleInfo = {
  name: string;
  basedOn?: string;
  outline?: number;
  mono?: boolean;
  bold?: boolean;
  italic?: boolean;
  numId?: string;
  ilvl?: number;
};

const kids = (el: Element | null | undefined, local: string) =>
  el ? [...el.children].filter((c) => c.namespaceURI === W && c.localName === local) : [];
const kid = (el: Element | null | undefined, local: string) => kids(el, local)[0];
const wAttr = (el: Element | null | undefined, name: string) => el?.getAttributeNS(W, name) ?? el?.getAttribute(`w:${name}`) ?? null;
/** `<w:b/>` is on; `<w:b w:val="0|false|none"/>` is off. */
const flag = (el: Element | undefined) => !!el && !/^(0|false|off|none)$/i.test(wAttr(el, "val") ?? "");

function parse(xml: string | undefined): Document | undefined {
  return xml ? new DOMParser().parseFromString(xml, "application/xml") : undefined;
}

function readStyles(doc: Document | undefined): Map<string, StyleInfo> {
  const out = new Map<string, StyleInfo>();
  if (!doc) return out;
  for (const s of kids(doc.documentElement, "style")) {
    const id = wAttr(s, "styleId");
    if (!id) continue;
    const pPr = kid(s, "pPr"), rPr = kid(s, "rPr");
    const fonts = kid(rPr, "rFonts");
    const numPr = kid(pPr, "numPr");
    const outline = wAttr(kid(pPr, "outlineLvl"), "val");
    out.set(id, {
      name: wAttr(kid(s, "name"), "val") ?? id,
      basedOn: wAttr(kid(s, "basedOn"), "val") ?? undefined,
      outline: outline == null ? undefined : Number(outline),
      mono: MONO.test(wAttr(fonts, "ascii") ?? wAttr(fonts, "hAnsi") ?? ""),
      bold: kid(rPr, "b") ? flag(kid(rPr, "b")) : undefined,
      italic: kid(rPr, "i") ? flag(kid(rPr, "i")) : undefined,
      numId: wAttr(kid(numPr, "numId"), "val") ?? undefined,
      ilvl: numPr ? Number(wAttr(kid(numPr, "ilvl"), "val") ?? 0) : undefined,
    });
  }
  return out;
}

/** The style and its `basedOn` ancestors, nearest first. */
function chain(styles: Map<string, StyleInfo>, id: string | null | undefined): StyleInfo[] {
  const out: StyleInfo[] = [];
  for (let cur = id ?? undefined, n = 0; cur && n < 20; n++) {
    const s = styles.get(cur);
    if (!s) break;
    out.push(s);
    cur = s.basedOn;
  }
  return out;
}

type Level = { bullet: boolean; start?: number; restart?: number };

/** numId → per level: is it a bullet, and the number it starts at. */
function readNumbering(doc: Document | undefined): Map<string, Map<number, Level>> {
  const out = new Map<string, Map<number, Level>>();
  if (!doc) return out;
  const start = (el: Element | undefined) => {
    const v = wAttr(el, "val");
    return v == null || v === "" ? undefined : Number(v);
  };
  const level = (l: Element): Level => ({
    bullet: (wAttr(kid(l, "numFmt"), "val") ?? "bullet") === "bullet",
    start: start(kid(l, "start")),
    restart: start(kid(l, "lvlRestart")),
  });
  const abstract = new Map<string, Map<number, Level>>();
  for (const a of kids(doc.documentElement, "abstractNum")) {
    const lvls = new Map<number, Level>();
    for (const l of kids(a, "lvl")) lvls.set(Number(wAttr(l, "ilvl") ?? 0), level(l));
    abstract.set(wAttr(a, "abstractNumId") ?? "", lvls);
  }
  for (const n of kids(doc.documentElement, "num")) {
    const lvls = new Map(abstract.get(wAttr(kid(n, "abstractNumId"), "val") ?? "") ?? []);
    // <w:lvlOverride> changes a level for this list only: a whole <w:lvl>
    // and/or a <w:startOverride>.
    for (const o of kids(n, "lvlOverride")) {
      const ilvl = Number(wAttr(o, "ilvl") ?? 0);
      const base = lvls.get(ilvl) ?? { bullet: true };
      const own = kid(o, "lvl");
      const fmt = wAttr(kid(own, "numFmt"), "val");
      // A whole <w:lvl> replaces the level (start defaults to 1, numFmt to decimal).
      const lv = own ? { ...level(own), bullet: fmt === "bullet" } : base;
      lvls.set(ilvl, { ...lv, start: start(kid(o, "startOverride")) ?? lv.start });
    }
    out.set(wAttr(n, "numId") ?? "", lvls);
  }
  return out;
}

function readRels(xml: string | undefined): Map<string, string> {
  const out = new Map<string, string>();
  const doc = parse(xml);
  for (const r of doc ? [...doc.documentElement.children] : []) {
    const id = r.getAttribute("Id"), target = r.getAttribute("Target");
    if (id && target && /hyperlink$/.test(r.getAttribute("Type") ?? "")) out.set(id, target);
  }
  return out;
}

type Ctx = {
  styles: Map<string, StyleInfo>;
  numbering: Map<string, Map<number, Level>>;
  rels: Map<string, string>;
};

/** Runs of one paragraph (or table cell paragraph), in document order. */
function paragraphRuns(p: Element, ctx: Ctx): Run[] {
  const runs: Run[] = [];
  // Complex HYPERLINK fields: begin … instrText … separate … result … end.
  let fieldHref: string | undefined, inFieldResult = false, fieldInstr = "";
  const walk = (node: Element, href: string | undefined) => {
    for (const el of [...node.children]) {
      if (el.namespaceURI !== W) continue;
      switch (el.localName) {
        case "hyperlink": {
          const id = el.getAttributeNS(R, "id") ?? el.getAttribute("r:id");
          const anchor = wAttr(el, "anchor");
          walk(el, (id && ctx.rels.get(id)) || (anchor ? `#${anchor}` : href));
          break;
        }
        case "fldSimple": {
          const m = /HYPERLINK\s+"([^"]+)"/.exec(wAttr(el, "instr") ?? "");
          walk(el, m?.[1] ?? href);
          break;
        }
        case "ins":
        case "smartTag":
        case "sdt":
        case "sdtContent":
        case "customXml":
          walk(el, href);
          break;
        case "r": {
          const fc = wAttr(kid(el, "fldChar"), "fldCharType");
          if (fc === "begin") {
            fieldInstr = "";
            fieldHref = undefined;
            inFieldResult = false;
            break;
          }
          if (fc === "separate") {
            fieldHref = /HYPERLINK\s+"([^"]+)"/.exec(fieldInstr)?.[1];
            inFieldResult = true;
            break;
          }
          if (fc === "end") {
            fieldHref = undefined;
            inFieldResult = false;
            break;
          }
          const instr = kid(el, "instrText");
          if (instr) {
            fieldInstr += instr.textContent ?? "";
            break;
          }
          const rPr = kid(el, "rPr");
          const rStyle = chain(ctx.styles, wAttr(kid(rPr, "rStyle"), "val"));
          const fonts = kid(rPr, "rFonts");
          const font = wAttr(fonts, "ascii") ?? wAttr(fonts, "hAnsi") ?? "";
          const pick = (local: "b" | "i") => {
            const own = kid(rPr, local);
            if (own) return flag(own);
            const key = local === "b" ? "bold" : "italic";
            return rStyle.find((s) => s[key] !== undefined)?.[key] ?? false;
          };
          const isCodeStyle = rStyle.some((s) => s.mono || /code|verbatim/i.test(s.name));
          const base: Run = {
            text: "",
            bold: pick("b"),
            italic: pick("i"),
            strike: flag(kid(rPr, "strike")) || flag(kid(rPr, "dstrike")),
            code: isCodeStyle || MONO.test(font),
            href: href ?? (inFieldResult ? fieldHref : undefined),
          };
          for (const c of [...el.children]) {
            if (c.namespaceURI !== W) continue;
            if (c.localName === "t") runs.push({ ...base, text: c.textContent ?? "" });
            else if (c.localName === "tab") runs.push({ ...base, text: "\t" });
            else if (c.localName === "br" || c.localName === "cr") runs.push({ ...base, text: "\n" });
            else if (c.localName === "noBreakHyphen") runs.push({ ...base, text: "-" });
          }
          break;
        }
        // "del", "moveFrom", "pPr", bookmarks, comments: nothing to read.
      }
    }
  };
  walk(p, undefined);
  // Merge neighbours with identical formatting so markers don't stutter.
  const merged: Run[] = [];
  for (const r of runs) {
    const last = merged[merged.length - 1];
    if (
      last && r.text !== "\n" && last.text !== "\n" && last.bold === r.bold && last.italic === r.italic &&
      last.strike === r.strike && last.code === r.code && last.href === r.href
    ) last.text += r.text;
    else merged.push({ ...r });
  }
  return merged;
}

function paragraphBlock(p: Element, ctx: Ctx): Block {
  const pPr = kid(p, "pPr");
  const styleId = wAttr(kid(pPr, "pStyle"), "val");
  const styleChain = chain(ctx.styles, styleId ?? "Normal");
  const names = styleChain.map((s) => s.name.toLowerCase());
  const runs = paragraphRuns(p, ctx);
  const align = wAttr(kid(pPr, "jc"), "val") ?? undefined;
  const text = runs.map((r) => r.text).join("");

  // Horizontal rule: an empty paragraph with only a bottom border.
  if (!text.trim() && kid(kid(pPr, "pBdr"), "bottom")) return { kind: "hr", runs: [] };

  if (names[0] === "title" || styleId === "Title") return { kind: "title", runs };
  const named = names.map((n) => /^heading\s*(\d)$/.exec(n)?.[1]).find(Boolean) ??
    /^Heading(\d)$/.exec(styleId ?? "")?.[1];
  const outline = wAttr(kid(pPr, "outlineLvl"), "val") ?? styleChain.find((s) => s.outline !== undefined)?.outline;
  const level = named ? Number(named) : outline != null && Number(outline) < 9 ? Number(outline) + 1 : undefined;
  if (level) return { kind: "heading", level: Math.min(level, 6), runs };

  const numPr = kid(pPr, "numPr");
  const numId = wAttr(kid(numPr, "numId"), "val") ?? styleChain.find((s) => s.numId)?.numId;
  if (numId && numId !== "0") {
    const ilvl = Number(wAttr(kid(numPr, "ilvl"), "val") ?? styleChain.find((s) => s.ilvl !== undefined)?.ilvl ?? 0);
    const lv = ctx.numbering.get(numId)?.get(ilvl);
    return { kind: "li", level: ilvl, ordered: !(lv?.bullet ?? true), list: numId, start: lv?.start, restart: lv?.restart, runs };
  }
  if (names.some((n) => /quote/.test(n))) {
    // Quote styles are italic; a quote whose every run is italic is that
    // style echoed as direct formatting (docen does this), not emphasis.
    const allItalic = runs.every((r) => !r.text.trim() || r.italic);
    return { kind: "quote", runs: allItalic ? runs.map((r) => ({ ...r, italic: false })) : runs };
  }
  // Code blocks come from a paragraph style only: a paragraph that is one
  // inline code span (monospace runs) stays a paragraph.
  if (names.some((n) => /^(code|html preformatted|source code|verbatim)/.test(n))) {
    return { kind: "code", runs: runs.map((r) => ({ ...r, code: false })) };
  }
  return { kind: "p", align: align as Block["align"], runs };
}

function tableMarkdown(tbl: Element, ctx: Ctx): string {
  // Paragraphs within a cell are joined by a line break.
  const rows = kids(tbl, "tr").map((tr) =>
    kids(tr, "tc").map((tc) =>
      kids(tc, "p").map((p) => paragraphRuns(p, ctx)).filter((r) => r.length)
        .flatMap((runs, i) => (i ? [{ text: "\n" } as Run, ...runs] : runs))
    )
  );
  return tableToMarkdown(rows);
}

/** Read a .docx and return its body as markdown. */
export function docxToMarkdown(bytes: Uint8Array): string {
  const files = unzipSync(bytes);
  const text = (path: string) => (files[path] ? strFromU8(files[path]) : undefined);
  const doc = parse(text("word/document.xml"));
  if (!doc) throw new Error("Not a Word document: missing word/document.xml");
  const ctx: Ctx = {
    styles: readStyles(parse(text("word/styles.xml"))),
    numbering: readNumbering(parse(text("word/numbering.xml"))),
    rels: readRels(text("word/_rels/document.xml.rels")),
  };
  const body = kid(doc.documentElement, "body");
  const parts: string[] = [];
  let pending: Block[] = [];
  // One set of list counters for the whole body: a list continues past a table.
  const lists: ListState = new Map();
  const flush = () => {
    // Empty paragraphs are spacing, not content; an empty numbered item still
    // takes its number.
    const blocks = pending.filter((b) => b.kind === "hr" || b.kind === "li" || b.runs.some((r) => r.text.trim()));
    const md = blocks.length ? blocksToMarkdown(blocks, lists) : "";
    if (md) parts.push(md);
    pending = [];
  };
  const visit = (el: Element) => {
    for (const c of [...el.children]) {
      if (c.namespaceURI !== W) continue;
      if (c.localName === "p") pending.push(paragraphBlock(c, ctx));
      else if (c.localName === "tbl") {
        flush();
        const t = tableMarkdown(c, ctx);
        if (t) parts.push(t);
      } else if (c.localName === "sdt" || c.localName === "sdtContent" || c.localName === "customXml") visit(c);
    }
  };
  if (body) visit(body);
  flush();
  return parts.join("\n\n").trim() + "\n";
}
