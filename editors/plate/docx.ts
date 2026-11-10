/**
 * Plate's DOCX bridge.
 *
 * Plate has no DOCX engine; edits round-trip through a conversion:
 *   in:  mammoth (.docx → HTML) → our walker → Plate nodes
 *   out: Plate's own exporter (@platejs/docx-io exportToDocx, lib/plate-docx.ts)
 * Markdown (the assistant's path) is NOT here: it goes through Plate's own
 * @platejs/markdown (see editor.tsx). Word-specific constructs (fields,
 * content controls, footnotes, comments) are not preserved the way Docxodus
 * or SuperDoc preserve them.
 */
import { FFLATE, MAMMOTH } from "./deps.ts";
import { imageNode, type Picture, pictureLayout } from "./pictures.ts";
import { safeUrl } from "./safe-url.ts";

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

  // Pictures: Plate image nodes (block voids) at Word's width and alignment.
  // One inside a list item cannot be a block there without breaking the list.
  const imgs = Array.from(root.querySelectorAll("img"));
  let layout: Picture[] | null = null;
  if (imgs.length) {
    const { unzipSync, strFromU8 } = await import(FFLATE);
    const file = unzipSync(bytes, { filter: (f: { name: string }) => f.name === "word/document.xml" })["word/document.xml"];
    const pics = file ? pictureLayout(strFromU8(file)) : [];
    layout = pics.length === imgs.length ? pics : null; // counts disagree: fit-width, left
  }
  /** A paragraph-like element: its text as `type`, then its pictures as image blocks. */
  const blocks = (el: Element, type: string): any[] => {
    const pics = Array.from(el.querySelectorAll("img"))
      .map((img) => imageNode(img.getAttribute("src") ?? "", img.getAttribute("alt") ?? "", layout?.[imgs.indexOf(img)]))
      .filter(Boolean);
    const text = leaves(el);
    const hasText = text.some((l: any) => l.type || (l.text ?? "").trim());
    return hasText || !pics.length ? [{ type, children: text.length ? text : [{ text: "" }] }, ...pics] : pics;
  };

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
      else if (t === "A" && safeUrl(n.getAttribute("href"))) {
        const inner = leaves(n, next);
        out.push({ type: "a", url: safeUrl(n.getAttribute("href")), children: inner.length ? inner : [{ text: "" }] });
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
    if (/^H[1-6]$/.test(t)) nodes.push(...blocks(el, `h${t[1]}`));
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
          else children.push(...blocks(k, "p"));
        }
        if (!children.length) children.push(...blocks(c, "p"));
        const span = Number(c.getAttribute("colspan")) || 1;
        return { type: c.tagName === "TH" ? "th" : "td", ...(span > 1 ? { colSpan: span } : {}), children };
      };
      nodes.push({
        type: "table",
        // This table's rows only: a nested table's rows belong to its cell.
        children: Array.from(el.querySelectorAll("tr")).filter((tr) => tr.closest("table") === el).map((tr) => ({ type: "tr", children: Array.from(tr.children).map(cell) })),
      });
    } else nodes.push(...blocks(el, "p"));
  }
  return nodes.length ? nodes : emptyValue();
}

/** A blank document: one empty paragraph. */
export function emptyValue(): Descendant[] {
  return [{ type: "p", children: [{ text: "" }] }];
}
