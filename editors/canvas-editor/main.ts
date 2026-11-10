/**
 * canvas-editor demo.
 *
 * @hufe921/canvas-editor draws the page on <canvas>; "the document" is an
 * `IElement[]`. Every conversion goes through the vendor's own plugins, used as
 * their READMEs show; nothing here translates the element model by hand:
 *
 *   @hufe921/canvas-editor-plugin-docx      .docx import (executeImportDocx)
 *                                           and export (executeExportDocx)
 *   @hufe921/canvas-editor-plugin-markdown  markdown out
 *                                           (executeExportMarkdown); markdown in
 *                                           is no longer its executeImportMarkdown,
 *                                           which routes through executeSetValue →
 *                                           draw.setValue → historyManager.recovery()
 *                                           and wipes the undo stack (issue #3)
 *   @hufe921/canvas-editor-plugin-floating-toolbar  the selection bubble
 *
 * Known vendor losses, measured with lib/probes/md-mapping.js (2026-11-09) and
 * on the live page (2026-11-10), accepted rather than patched over:
 *   - getElementListByHTML import (applyMarkdown): inline code loses its
 *     formatting, blockquote text is kept but plain (the token-based plugin
 *     import used to italicise it), and images without width/height attributes
 *     in the HTML are dropped. Consecutive headings, which plugin-markdown's
 *     import merged into one line, stay separate now.
 *   - plugin-markdown@0.0.1 export: hyperlink text is dropped on the way out
 *     (the link element itself is kept in the document).
 *   - plugin-docx@1.0.0 export: lists come out as literal "• "/"1. " text, not
 *     Word lists, and hyperlinks are dropped with their text.
 *
 * The plugins import "@hufe921/canvas-editor"; the page import map (shell.ts)
 * points that at the same build, so editor and plugins share one copy.
 *
 * canvas-editor ships no toolbar UI (its demo builds one in the repo, not the
 * package), so shell.ts provides one wired to the editor's command API below.
 */
import Editor, { ElementType, getElementListByHTML, ListStyle, ListType, RowFlex, TitleLevel } from "@hufe921/canvas-editor";
import docxPlugin from "@hufe921/canvas-editor-plugin-docx";
import floatingToolbarPlugin from "@hufe921/canvas-editor-plugin-floating-toolbar";
import markdownPlugin from "@hufe921/canvas-editor-plugin-markdown";
import { marked } from "marked";
import { waitFor } from "/lib/kit.ts";

// deno-lint-ignore no-explicit-any
let editor: any;
// Exposed for the test probes in /lib/probes (read-only use).
(window as any).__canvasEditor = () => editor;

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
  // select all + executeInsertElementList: one record in its history.
  applyInHistory: true,
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
    editor.use(markdownPlugin);
    editor.use(floatingToolbarPlugin);
    // canvas-editor focuses its hidden <textarea> inside its mousedown
    // handler; the browser's default action for that same mousedown then moves
    // focus to <body> (a canvas isn't focusable), so typing went nowhere.
    host.addEventListener("mousedown", (e) => e.preventDefault());
    // View-only page: no toolbar (it's ours, built on the command API).
    if (window.od.viewer) document.getElementById("ce-toolbar")?.style.setProperty("display", "none");
    else wireToolbar();
  },

  // canvas-editor's own read-only mode (EditorMode.READONLY).
  setReadOnly() {
    editor?.command.executeMode("readonly" as never);
  },

  async load(bytes) {
    if (!editor) throw new Error("editor not ready");
    await editor.command.executeImportDocx({ arrayBuffer: bytes.slice().buffer });
  },

  async applyMarkdown(markdown) {
    if (!editor) throw new Error("editor not ready");
    // In-history apply (issue #3). executeImportMarkdown runs through
    // executeSetValue → historyManager.recovery(), erasing undo; instead use
    // the engine's own HTML pipeline — the same one its paste handler uses
    // (draw.paste → getElementListByHTML → insertElementList):
    //   marked.parse (md → HTML) → getElementListByHTML (HTML → IElement[],
    //   exported by @hufe921/canvas-editor) → executeSelectAll() +
    //   executeInsertElementList(), which replaces the selection and submits
    //   to the history manager (Draw.insertElementList renders with
    //   isSubmitHistory, unlike setValue which recovers/clears it).
    // executeSetRange first places the cursor the way a click does: after an
    // import the undo stack is empty, and this render is what makes the engine
    // snapshot the pre-edit document as the undo base record — without it the
    // lone insert would be the only record and undo() would be a no-op.
    const options = editor.command.getOptions();
    const elementList = getElementListByHTML(await marked.parse(markdown), {
      // Same width the paste path passes (draw.getOriginalInnerWidth()) so
      // imported tables get sensible column widths.
      innerWidth: options.width - options.margins[1] - options.margins[3],
    });
    editor.command.executeSetRange(0, 0);
    editor.command.executeSelectAll();
    editor.command.executeInsertElementList(elementList);
  },

  undo() {
    editor?.command.executeUndo();
  },
  redo() {
    editor?.command.executeRedo();
  },

  async getMarkdown() {
    return editor ? editor.command.executeExportMarkdown() : "";
  },

  // The page is 794 px wide; on a narrower stage, canvas-editor's own page
  // scale shrinks it to fit (never above 100%).
  fit(width: number) {
    const scale = Math.max(0.3, Math.min(1, (width - 24) / 794));
    if (editor && Math.abs(editor.command.getOptions().scale - scale) > 0.01) editor.command.executePageScale(scale);
  },

  async exportDocx() {
    if (!editor) throw new Error("editor not ready");
    // plugin-docx builds the file and then always clicks a hidden
    // <a download> to save it. We only want the bytes, so that one click is
    // cancelled (capture phase, blob: link) while the export runs.
    const noDownload = (e: MouseEvent) => {
      const a = e.target as HTMLAnchorElement | null;
      if (a?.tagName === "A" && a.hasAttribute("download") && a.href.startsWith("blob:")) e.preventDefault();
    };
    document.addEventListener("click", noDownload, true);
    try {
      const blob: Blob = await editor.command.executeExportDocx({ fileName: "document.docx" });
      return new Uint8Array(await blob.arrayBuffer());
    } finally {
      document.removeEventListener("click", noDownload, true);
    }
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
