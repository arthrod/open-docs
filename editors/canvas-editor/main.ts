/**
 * canvas-editor demo.
 *
 * @hufe921/canvas-editor draws the page on <canvas>; "the document" is an
 * `IElement[]`. The vendor publishes plugins, used here as its README shows:
 *
 *   @hufe921/canvas-editor-plugin-docx      .docx import (executeImportDocx)
 *   @hufe921/canvas-editor-plugin-floating-toolbar  the selection bubble
 *
 * Measured against lib/probes/md-mapping.js (2026-11-09), two vendor plugins
 * lose content, so they are NOT used for those directions:
 *   - plugin-markdown@0.0.1 import: consecutive headings merge into one line
 *     (no "\n" between TITLE elements) and inline code loses its formatting.
 *     Markdown goes through lib/markdown.ts → canvas-editor's own elements
 *     instead (TITLE 1–6, LIST, HYPERLINK, SEPARATOR, monospace code).
 *   - plugin-docx@1.0.0 export: lists come out as literal "• "/"1. " text, not
 *     Word lists, and HYPERLINK elements are dropped with their text. Export
 *     reads the element model into lib/ooxml.ts instead.
 *
 * The plugins import "@hufe921/canvas-editor"; the page import map (shell.ts)
 * points that at the same build, so editor and plugins share one copy.
 *
 * canvas-editor ships no toolbar UI (its demo builds one in the repo, not the
 * package), so shell.ts provides one wired to the editor's command API below.
 */
import Editor, { ElementType, ListStyle, ListType, RowFlex, TitleLevel } from "@hufe921/canvas-editor";
import docxPlugin from "@hufe921/canvas-editor-plugin-docx";
import floatingToolbarPlugin from "@hufe921/canvas-editor-plugin-floating-toolbar";
import { waitFor } from "/lib/kit.ts";
import { blocksToMarkdown, markdownToBlocks } from "/lib/markdown.ts";
import { type Block, blocksToDocx, type Run } from "/lib/ooxml.ts";

// deno-lint-ignore no-explicit-any
let editor: any;
// Exposed for the test probes in /lib/probes (read-only use).
(window as any).__canvasEditor = () => editor;

const LEVELS = [TitleLevel.FIRST, TitleLevel.SECOND, TitleLevel.THIRD, TitleLevel.FOURTH, TitleLevel.FIFTH, TitleLevel.SIXTH];
const MONO = "Courier New";
/** Inline code and code blocks are both monospace; their shading tells them apart. */
const CODE_BG = "#eef0f3";
const CODE_BLOCK_BG = "#f2f3f5";
/** Text width of the page set up in mount(): 794 − 2 × 96 px. */
const TEXT_WIDTH = 602;
const QUOTE_COLOR = "#404040";
const ZWSP = /\u200B/g;

/* --------------------------- Block[] ⇄ IElement[] --------------------------- */

// deno-lint-ignore no-explicit-any
type El = any;

const runEl = (r: Run, extra: Record<string, unknown> = {}): El => ({
  value: r.text,
  ...(r.bold ? { bold: true } : {}),
  ...(r.italic ? { italic: true } : {}),
  ...(r.underline ? { underline: true } : {}),
  ...(r.strike ? { strikeout: true } : {}),
  ...(r.code ? { font: MONO, highlight: CODE_BG } : {}),
  ...extra,
});

/** Runs → elements; consecutive runs sharing an href become one HYPERLINK. */
function runsToEls(runs: Run[], extra: Record<string, unknown> = {}): El[] {
  const out: El[] = [];
  for (let i = 0; i < runs.length;) {
    const href = runs[i].href;
    if (!href) {
      out.push(runEl(runs[i++], extra));
      continue;
    }
    const valueList: El[] = [];
    while (i < runs.length && runs[i].href === href) valueList.push(runEl(runs[i++], extra));
    out.push({ type: ElementType.HYPERLINK, value: "", url: href, valueList });
  }
  return out;
}

function blocksToElements(blocks: Block[]): El[] {
  const out: El[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (i > 0) out.push({ value: "\n" });
    if (b.kind === "title" || b.kind === "heading") {
      const level = LEVELS[Math.min(Math.max((b.kind === "title" ? 1 : b.level ?? 1) - 1, 0), 5)];
      out.push({ type: ElementType.TITLE, value: "", level, valueList: runsToEls(b.runs) });
    } else if (b.kind === "li") {
      // Consecutive items of the same kind become one list; "\n" splits items.
      const ordered = !!b.ordered;
      const items: Block[] = [b];
      while (blocks[i + 1]?.kind === "li" && !!blocks[i + 1].ordered === ordered) items.push(blocks[++i]);
      const valueList: El[] = [];
      items.forEach((it, k) => {
        if (k > 0) valueList.push({ value: "\n" });
        valueList.push(...runsToEls(it.runs));
      });
      out.push({
        type: ElementType.LIST,
        value: "",
        listType: ordered ? ListType.OL : ListType.UL,
        ...(ordered ? {} : { listStyle: ListStyle.DISC }),
        valueList,
      });
    } else if (b.kind === "hr") {
      out.push({ type: ElementType.SEPARATOR, value: "\n", dashArray: [] });
    } else if (b.kind === "code") {
      out.push(...runsToEls(b.runs.map((r) => ({ ...r, code: true })), { highlight: CODE_BLOCK_BG }));
    } else if (b.kind === "table") {
      // canvas-editor's own table: header row bold, columns share the width.
      const rows = (b.rows ?? []).filter((r) => r.length);
      const cols = Math.max(1, ...rows.map((r) => r.length));
      const width = Math.floor(TEXT_WIDTH / cols);
      out.push({
        type: ElementType.TABLE,
        value: "",
        colgroup: Array.from({ length: cols }, () => ({ width })),
        trList: rows.map((cells, ri) => ({
          height: 42,
          tdList: Array.from({ length: cols }, (_, ci) => {
            const runs = (cells[ci] ?? []).map((r) => (ri === 0 ? { ...r, bold: true } : r));
            return { colspan: 1, rowspan: 1, value: runs.length ? runsToEls(runs) : [{ value: "" }] };
          }),
        })),
      });
    } else if (b.kind === "quote") {
      // No quote element in canvas-editor: an italic, grey paragraph.
      out.push(...runsToEls(b.runs.map((r) => ({ ...r, italic: true })), { color: QUOTE_COLOR }));
    } else {
      out.push(...runsToEls(b.runs));
    }
  }
  return out.length ? out : [{ value: "\n" }];
}

type QRun = Run & { quote?: boolean; block?: boolean };

function elToRun(el: El, text: string, href?: string): QRun {
  return {
    ...(el.italic && String(el.color ?? "").toLowerCase() === QUOTE_COLOR ? { quote: true } : {}),
    text,
    bold: !!el.bold,
    italic: !!el.italic,
    underline: !!el.underline,
    strike: !!el.strikeout,
    ...(el.font && /courier|mono|consol/i.test(el.font) ? { code: true } : {}),
    ...(String(el.highlight ?? "").toLowerCase() === CODE_BLOCK_BG ? { block: true } : {}),
    ...(href ? { href } : {}),
  };
}

const stripFlags = ({ quote: _q, block: _b, ...r }: QRun): Run => r;

function elementsToBlocks(list: El[]): Block[] {
  const blocks: Block[] = [];
  let cur: Block = { kind: "p", runs: [] };
  const flush = () => {
    blocks.push(cur);
    cur = { kind: "p", runs: [] };
  };
  const push = (el: El, b: Partial<Block>, href?: string) => {
    const parts = String(el.value ?? "").replace(ZWSP, "").split("\n");
    parts.forEach((part, k) => {
      if (k > 0) flush();
      Object.assign(cur, b);
      if (part) cur.runs.push(elToRun(el, part, href));
    });
  };
  const pushInline = (el: El, b: Partial<Block>) => {
    if (el.type === ElementType.HYPERLINK) for (const c of el.valueList ?? []) push(c, b, el.url);
    else push(el, b);
  };
  for (const el of list) {
    if (el.type === ElementType.TITLE) {
      if (cur.runs.length) flush();
      const level = Math.max(0, LEVELS.indexOf(el.level)) + 1;
      for (const c of el.valueList ?? []) pushInline(c, { kind: "heading", level });
      flush();
    } else if (el.type === ElementType.LIST) {
      if (cur.runs.length) flush();
      const ordered = el.listType === ListType.OL;
      for (const c of el.valueList ?? []) pushInline(c, { kind: "li", ordered });
      flush();
    } else if (el.type === ElementType.SEPARATOR) {
      if (cur.runs.length) flush();
      blocks.push({ kind: "hr", runs: [] });
    } else if (el.type === ElementType.TABLE) {
      if (cur.runs.length) flush();
      const rows = (el.trList ?? []).map((tr: El) =>
        (tr.tdList ?? []).map((td: El) => {
          const runs: Run[] = [];
          const add = (v: El, href?: string) => {
            const text = String(v.value ?? "").replace(ZWSP, "");
            // A "\n" inside a cell is a line break within it.
            text.split(/(\n)/).forEach((t) => t && runs.push(stripFlags(elToRun(v, t, href))));
          };
          for (const v of td.value ?? []) {
            if (v.type === ElementType.HYPERLINK) for (const c of v.valueList ?? []) add(c, v.url);
            else add(v);
          }
          // Cells start on a line of their own: drop leading/trailing breaks.
          while (runs[0]?.text === "\n") runs.shift();
          while (runs.at(-1)?.text === "\n") runs.pop();
          return runs;
        })
      );
      blocks.push({ kind: "table", runs: [], rows });
    } else if (!el.type || el.type === ElementType.TEXT || el.type === ElementType.HYPERLINK) {
      pushInline(el, {});
    }
  }
  if (cur.runs.length) flush();
  // Title/list flushes leave empty paragraphs behind the "\n" separators.
  return blocks
    .filter((b) => b.kind === "hr" || b.kind === "table" || b.runs.some((r) => r.text.trim()))
    .map((b) => {
      // A paragraph in code-block shading is a code block (inline code alone
      // in a paragraph stays inline code).
      if (b.kind === "p" && b.runs.every((r: QRun) => r.block)) return { kind: "code", runs: b.runs.map((r) => ({ text: r.text })) };
      // …and one that is entirely our italic grey is a quote.
      if (b.kind === "p" && b.runs.every((r: QRun) => r.quote)) {
        return { kind: "quote", runs: b.runs.map(({ quote: _q, italic: _i, ...r }: QRun) => r) };
      }
      return { ...b, runs: b.runs.map(stripFlags) };
    });
}

function currentBlocks(): Block[] {
  const { data } = editor.command.getValue();
  return elementsToBlocks(Array.isArray(data) ? data : data.main);
}

const TITLES: Record<string, TitleLevel | null> = {
  p: null,
  h1: TitleLevel.FIRST,
  h2: TitleLevel.SECOND,
  h3: TitleLevel.THIRD,
  h4: TitleLevel.FOURTH,
  h5: TitleLevel.FIFTH,
  h6: TitleLevel.SIXTH,
};

window.od.register({
  name: "canvas-editor",
  mergeQuality: "native",

  async mount() {
    const host = await waitFor<HTMLDivElement>("#ce-page");
    window.od.progress("Loading canvas-editor…");
    host.innerHTML = "";
    editor = new Editor(host, { main: [{ value: "\n" }] }, {
      width: 794,
      height: 1123,
      margins: [96, 96, 96, 96],
      defaultFont: "Calibri",
      defaultSize: 15,
      pageGap: 24,
    });
    editor.use(docxPlugin);
    editor.use(floatingToolbarPlugin);
    // canvas-editor focuses its hidden <textarea> inside its mousedown
    // handler; the browser's default action for that same mousedown then moves
    // focus to <body> (a canvas isn't focusable), so typing went nowhere.
    host.addEventListener("mousedown", (e) => e.preventDefault());
    wireToolbar();
  },

  async load(bytes) {
    if (!editor) throw new Error("editor not ready");
    await editor.command.executeImportDocx({ arrayBuffer: bytes.slice().buffer });
  },

  async applyMarkdown(markdown) {
    if (!editor) throw new Error("editor not ready");
    editor.command.executeSetValue({ main: blocksToElements(markdownToBlocks(markdown, { tables: true })) });
  },

  async getMarkdown() {
    return editor ? blocksToMarkdown(currentBlocks()) : "";
  },

  // The page is 794 px wide; on a narrower stage, canvas-editor's own page
  // scale shrinks it to fit (never above 100%).
  fit(width: number) {
    const scale = Math.max(0.3, Math.min(1, (width - 24) / 794));
    if (editor && Math.abs(editor.command.getOptions().scale - scale) > 0.01) editor.command.executePageScale(scale);
  },

  async exportDocx() {
    if (!editor) throw new Error("editor not ready");
    return blocksToDocx(currentBlocks());
  },
});

/* -------------------------------- toolbar -------------------------------- */

/** Every control maps to one canvas-editor command; `data-cmd` names it. */
function wireToolbar() {
  const bar = document.getElementById("ce-toolbar");
  if (!bar || !editor) return;
  const c = editor.command;
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;

  const actions: Record<string, () => void> = {
    undo: () => c.executeUndo(),
    redo: () => c.executeRedo(),
    painter: () => c.executePainter({ isDblclick: false }),
    clear: () => c.executeFormat(),
    bold: () => c.executeBold(),
    italic: () => c.executeItalic(),
    underline: () => c.executeUnderline(),
    strike: () => c.executeStrikeout(),
    sup: () => c.executeSuperscript(),
    sub: () => c.executeSubscript(),
    sizeUp: () => c.executeSizeAdd(),
    sizeDown: () => c.executeSizeMinus(),
    ul: () => c.executeList(ListType.UL, ListStyle.DISC),
    ol: () => c.executeList(ListType.OL),
    left: () => c.executeRowFlex(RowFlex.LEFT),
    center: () => c.executeRowFlex(RowFlex.CENTER),
    right: () => c.executeRowFlex(RowFlex.RIGHT),
    justify: () => c.executeRowFlex(RowFlex.ALIGNMENT),
    table: () => c.executeInsertTable(3, 3),
    image: () => $<HTMLInputElement>("ce-image-file")?.click(),
    hr: () => c.executeSeparator([0, 0]),
    pageBreak: () => c.executePageBreak(),
    link: () => {
      const input = $<HTMLInputElement>("ce-link-url");
      const url = input?.value.trim();
      if (!url) {
        input?.focus();
        return;
      }
      const text = String(c.getRangeText?.() ?? "") || url;
      c.executeHyperlink({
        type: ElementType.HYPERLINK,
        url,
        valueList: [...text].map((ch) => ({ value: ch })),
      });
      input!.value = "";
    },
    zoomIn: () => c.executePageScaleAdd(),
    zoomOut: () => c.executePageScaleMinus(),
    print: () => void c.executePrint(),
  };

  bar.addEventListener("mousedown", (e) => {
    // Keep the canvas selection: act on mousedown and cancel the focus change.
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-cmd]");
    if (!btn) return;
    e.preventDefault();
    actions[btn.dataset.cmd!]?.();
  });

  const onChange = (id: string, fn: (v: string) => void, reset = false) => {
    const el = $<HTMLInputElement | HTMLSelectElement>(id);
    el?.addEventListener("change", () => {
      if (el.value) fn(el.value);
      if (reset) el.value = "";
    });
  };
  onChange("ce-style", (v) => c.executeTitle(TITLES[v] ?? null), true);
  onChange("ce-font", (v) => c.executeFont(v), true);
  onChange("ce-size", (v) => c.executeSize(Number(v)), true);
  onChange("ce-spacing", (v) => c.executeRowMargin(Number(v)), true);
  onChange("ce-color", (v) => c.executeColor(v));
  onChange("ce-highlight", (v) => c.executeHighlight(v));
  $<HTMLInputElement>("ce-link-url")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      actions.link();
    }
  });

  const search = $<HTMLInputElement>("ce-search");
  search?.addEventListener("input", () => c.executeSearch(search.value || null));
  search?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      c.executeSearchNavigateNext();
    }
  });

  // Images: read the file, measure it, insert scaled to the text width.
  const file = $<HTMLInputElement>("ce-image-file");
  file?.addEventListener("change", () => {
    const f = file.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 794 - 192;
        const scale = Math.min(1, max / img.naturalWidth);
        c.executeImage({ value: String(reader.result), width: img.naturalWidth * scale, height: img.naturalHeight * scale });
        file.value = "";
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(f);
  });
}
