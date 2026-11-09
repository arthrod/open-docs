/**
 * Plate's DOCX bridge.
 *
 * Plate has no DOCX engine; edits round-trip through a conversion:
 *   in:  mammoth (.docx → HTML) → our walker → Plate nodes
 *   out: Plate nodes → paragraph blocks → lib/ooxml.ts (.docx)
 * Markdown (the assistant's path) is NOT here: it goes through Plate's own
 * @platejs/markdown (see editor.tsx). Word-specific constructs (fields,
 * content controls, footnotes, comments) are not preserved the way Docxodus
 * or SuperDoc preserve them.
 */
import { MAMMOTH } from "./deps.ts";
import { type Block, blocksToDocx, type Run } from "/lib/ooxml.ts";

type Descendant = any;

/**
 * Real DOCX bytes in → Plate nodes, via mammoth's HTML.
 *
 * docx-io's own `importDocx` runs that HTML through Plate's deserializer, which
 * (without the full list UI kit) drops list markers and nests list items as
 * paragraphs-in-paragraphs. Walking mammoth's HTML ourselves is short and keeps
 * headings, lists (with nesting) and bold/italic/underline intact.
 */
export async function importDocxToNodes(_editor: any, bytes: Uint8Array): Promise<Descendant[]> {
  const mammoth: any = await import(MAMMOTH);
  const { value: html } = await (mammoth.convertToHtml ?? mammoth.default.convertToHtml)(
    { arrayBuffer: new Uint8Array(bytes).buffer },
    // Heading n → hn (the standard markdown/Word mapping); Title → h1.
    {
      styleMap: [
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Subtitle'] => h2:fresh",
        ...[1, 2, 3, 4, 5, 6].map((n) => `p[style-name='heading ${n}'] => h${n}:fresh`),
        "p[style-name='Quote'] => blockquote > p:fresh",
        "p[style-name='Intense Quote'] => blockquote > p:fresh",
        "p[style-name='Code'] => pre:separator('\\n')",
        "r[style-name='Code Char'] => code",
      ],
    },
  );
  const root = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html").body;
  const nodes: any[] = [];

  const leaves = (el: Node, marks: Record<string, unknown> = {}): any[] => {
    const out: any[] = [];
    el.childNodes.forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) {
        if (n.textContent) out.push({ text: n.textContent, ...marks });
        return;
      }
      if (!(n instanceof HTMLElement) || /^(UL|OL)$/.test(n.tagName)) return;
      const t = n.tagName;
      const next = { ...marks };
      if (t === "STRONG" || t === "B") next.bold = true;
      if (t === "EM" || t === "I") next.italic = true;
      if (t === "U") next.underline = true;
      if (t === "S" || t === "DEL") next.strikethrough = true;
      if (t === "CODE") next.code = true;
      if (t === "SUP") next.superscript = true;
      if (t === "SUB") next.subscript = true;
      if (t === "BR") out.push({ text: "\n", ...marks });
      else if (t === "A" && n.getAttribute("href")) {
        const inner = leaves(n, next);
        out.push({ type: "a", url: n.getAttribute("href"), children: inner.length ? inner : [{ text: "" }] });
      } else out.push(...leaves(n, next));
    });
    return out;
  };
  const kids = (el: Node) => {
    const l = leaves(el);
    return l.length ? l : [{ text: "" }];
  };

  const walkList = (list: HTMLElement, depth: number) => {
    const style = list.tagName === "OL" ? "decimal" : "disc";
    for (const li of Array.from(list.children)) {
      nodes.push({ type: "p", listStyleType: style, indent: depth, children: kids(li) });
      li.querySelectorAll(":scope > ul, :scope > ol").forEach((sub) => walkList(sub as HTMLElement, depth + 1));
    }
  };

  for (const el of Array.from(root.children) as HTMLElement[]) {
    const t = el.tagName;
    if (/^H[1-6]$/.test(t)) nodes.push({ type: `h${t[1]}`, children: kids(el) });
    else if (t === "UL" || t === "OL") walkList(el, 1);
    else if (t === "BLOCKQUOTE") nodes.push({ type: "blockquote", children: kids(el) });
    else if (t === "PRE") {
      nodes.push({
        type: "code_block",
        children: (el.textContent ?? "").split("\n").map((line) => ({ type: "code_line", children: [{ text: line }] })),
      });
    }
    else if (t === "TABLE") {
      // Plate's table model: table → tr → td/th → paragraphs.
      const cell = (c: Element) => {
        // Every block in the cell, in order: paragraphs and headings as
        // paragraphs, list items as Plate list paragraphs, loose text as one.
        const children: any[] = [];
        const listItems = (list: Element, depth: number) => {
          for (const li of Array.from(list.children)) {
            children.push({ type: "p", listStyleType: list.tagName === "OL" ? "decimal" : "disc", indent: depth, children: kids(li) });
            li.querySelectorAll(":scope > ul, :scope > ol").forEach((sub) => listItems(sub, depth + 1));
          }
        };
        for (const k of Array.from(c.children)) {
          if (k.tagName === "UL" || k.tagName === "OL") listItems(k, 1);
          else children.push({ type: "p", children: kids(k) });
        }
        if (!children.length) children.push({ type: "p", children: kids(c) });
        const span = Number(c.getAttribute("colspan")) || 1;
        return { type: c.tagName === "TH" ? "th" : "td", ...(span > 1 ? { colSpan: span } : {}), children };
      };
      nodes.push({
        type: "table",
        children: Array.from(el.querySelectorAll("tr")).map((tr) => ({ type: "tr", children: Array.from(tr.children).map(cell) })),
      });
    } else nodes.push({ type: "p", children: kids(el) });
  }
  return nodes.length ? nodes : emptyValue();
}

/**
 * Plate nodes → real DOCX bytes.
 *
 * Not docx-io's exporter: its static HTML render drops heading styles (no
 * element components registered) and it writes <w:sectPr> as the FIRST body
 * child, which Word treats as a damaged file. lib/ooxml.ts writes a clean one.
 */
export function nodesToDocx(value: Descendant[]): Uint8Array {
  const blocks: Block[] = [];
  const pt = (v: unknown) => {
    const m = /^([\d.]+)\s*(pt|px)?$/.exec(String(v ?? ""));
    return m ? (m[2] === "px" ? +m[1] * 0.75 : +m[1]) : undefined;
  };
  const runs = (n: any, href?: string): Run[] =>
    (n.children ?? []).flatMap((c: any): Run[] => {
      if (c.type === "a") return runs(c, c.url);
      if (c.text === undefined) return runs(c, href);
      return [{
        text: c.text,
        bold: !!c.bold,
        italic: !!c.italic,
        underline: !!c.underline,
        strike: !!c.strikethrough,
        code: !!c.code,
        ...(href ? { href } : {}),
        ...(c.fontFamily ? { font: String(c.fontFamily) } : {}),
        ...(pt(c.fontSize) ? { sizePt: pt(c.fontSize) } : {}),
        ...(c.color ? { color: String(c.color) } : {}),
        ...(c.backgroundColor ? { background: String(c.backgroundColor) } : c.highlight ? { background: "#ffff00" } : {}),
        ...(c.superscript ? { vertAlign: "superscript" as const } : c.subscript ? { vertAlign: "subscript" as const } : {}),
      }];
    });
  for (const n of value as any[]) {
    const align = ["center", "right", "justify"].includes(n.align) ? n.align : undefined;
    const h = /^h([1-6])$/.exec(n.type ?? "");
    if (h) blocks.push({ kind: "heading", level: +h[1], align, runs: runs(n) });
    else if (n.listStyleType) {
      blocks.push({ kind: "li", level: Math.max((n.indent ?? 1) - 1, 0), ordered: n.listStyleType === "decimal", align, runs: runs(n) });
    } else if (n.type === "blockquote") blocks.push({ kind: "quote", align, runs: runs(n) });
    else if (n.type === "code_block") {
      const text = (n.children ?? []).map((l: any) => runs(l).map((r) => r.text).join("")).join("\n");
      blocks.push({ kind: "code", runs: [{ text }] });
    } else if (n.type === "hr") blocks.push({ kind: "hr", runs: [] });
    else if (n.type === "table") {
      // table → tr → td/th → paragraphs; paragraphs in a cell become line breaks.
      const rows = (n.children ?? []).map((tr: any) =>
        (tr.children ?? []).map((td: any) =>
          (td.children ?? []).flatMap((p: any, i: number): Run[] => [...(i ? [{ text: "\n" }] : []), ...runs(p)])
        )
      );
      blocks.push({ kind: "table", runs: [], rows });
    } else blocks.push({ kind: "p", align, runs: runs(n) });
  }
  return blocksToDocx(blocks);
}

/** A blank document: one empty paragraph. */
export function emptyValue(): Descendant[] {
  return [{ type: "p", children: [{ text: "" }] }];
}
