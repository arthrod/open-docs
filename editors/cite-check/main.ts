/**
 * cite-check — canvas-editor@1.1.0 wired to the deterministic cite-check core
 * (editors/cite-check/core/core.js, vendored byte-for-byte from
 * https://github.com/arthrod/open-legal-artifacts — MIT).
 *
 * The whole page is one document loop, and every step of it is a native
 * editor command:
 *   import  executeImportDocx (plugin-docx)     → the REAL document text
 *   read    executeExportMarkdown (plugin-markdown) → the core's input string
 *   locate  command.getKeywordRangeList(quote)  → native range of a quote span
 *   annotate executeHighlight / executeInsertElementList / executePaste
 *           — all submitted to the engine's own history (one undo each)
 *   export  executeExportDocx (plugin-docx)     → annotated .docx
 *
 * Step-2 API spike findings (canvas-editor@1.1.0, headless Chrome, 2026-11-10):
 *   - executeCopy ✓   writes a native ClipboardItem (text/plain + text/html)
 *                     through navigator.clipboard.write and caches the copied
 *                     elements in localStorage ("ce-clipboard").
 *   - executePaste ✓  FIRE-AND-FORGET: CommandAdapt.paste() does not await the
 *                     async clipboard work, so callers must poll for the
 *                     effect (we poll executeExportMarkdown). It reads
 *                     navigator.clipboard.readText(); when that equals the
 *                     cached copy text it inserts the cached element list
 *                     through the engine's paste pipeline, in history.
 *   - executeUndo ✓   one call reverts exactly one paste / insert / highlight.
 *   - executeHighlight ✓  element.highlight set, in history, undoable; the
 *                     plugin-docx exporter writes it as a w:shd shading run
 *                     (not w:highlight) — that IS the highlight run in OOXML.
 *   - executeImportDocx ✓  EXEMPT from undo (vendor: post-import the history is
 *                     empty) — accepted per plan amendment A7, no custom stack.
 *   - executeExportDocx ✓ zip with word/document.xml; text and highlights
 *                     survive; Word lists/hyperlinks degrade (documented
 *                     vendor losses, same as the canvas-editor demo).
 *   - executeSearch / executeSearchNavigateNext do NOT set the selection range
 *                     (they only paint matches). The native locator for a
 *                     quote span is command.getKeywordRangeList(text), whose
 *                     {startIndex,endIndex} are anchor-style: the exact text
 *                     is selected by executeSetRange(kw.startIndex - 1,
 *                     kw.endIndex) — always re-asserted via getRangeText().
 *   - After a .docx import, getValue().data.main holds PARAGRAPH-sized
 *                     elements with multi-char values, so the element count is
 *                     NOT the end-of-document range offset. The native end is
 *                     executeSelectAll() → getRange().endIndex (A4/A5 stay
 *                     native: no DOM/canvas or markdown-string arithmetic).
 *
 * Core input identity (A3): the exact string passed to runCiteCheck is kept in
 * window.__citeCheck.lastInput() so a probe can byte-compare it against a
 * fresh executeExportMarkdown and recompute the report itself. A marker-free
 * document yields 0 rows — nothing is ever fabricated.
 */
import Editor, { getElementListByHTML, TitleLevel } from "@hufe921/canvas-editor";
import docxPlugin from "@hufe921/canvas-editor-plugin-docx";
import floatingToolbarPlugin from "@hufe921/canvas-editor-plugin-floating-toolbar";
import markdownPlugin from "@hufe921/canvas-editor-plugin-markdown";
import { marked } from "marked";
import { waitFor } from "/lib/kit.ts";
import { runCiteCheck, formatDiffOps } from "./core/core.js";

// deno-lint-ignore no-explicit-any
let editor: any;
// Exposed for the verification probe (editors/cite-check/probe.js) — read-only
// plus the same action functions the panel buttons call.
// deno-lint-ignore no-explicit-any
let report: any = null;
// deno-lint-ignore no-explicit-any
let lastInput: any = null;
// Loaded sources are page state now (no textarea): each entry is one imported
// file's source(s), or the bundled demo set (demo: true, toggled in/out).
// deno-lint-ignore no-explicit-any
let loaded: Array<{ key: string; source: any; demo?: boolean }> = [];
// deno-lint-ignore no-explicit-any
let sources: any[] = [];
let docName = "Untitled document";
// Hidden second editor instance (docx + markdown plugins) used to read .docx
// source files natively: executeImportDocx → executeExportMarkdown.
// deno-lint-ignore no-explicit-any
let srcEditor: any = null;
let srcSeq = 0;
// Native range cached at capture time (A4): {startIndex, endIndex, text}.
// deno-lint-ignore no-explicit-any
let capture: any = null;

const COLORS: Record<string, string> = { exact: "#b6f09c", normalized: "#bfdbfe", fuzzy: "#ffe08a", not_found: "#ffb3b3" };
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
  name: "cite-check",
  applyInHistory: true,
  mergeQuality: "native",

  async mount() {
    const host = await waitFor<HTMLDivElement>("#cc-page");
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
    host.addEventListener("mousedown", (e) => e.preventDefault());
    if (window.od.viewer) document.getElementById("cc-toolbar")?.style.setProperty("display", "none");
    else wirePanel();
  },

  setReadOnly() {
    editor?.command.executeMode("readonly" as never);
  },

  async load(bytes) {
    await importDocx(bytes, "Imported document");
  },

  async applyMarkdown(markdown) {
    if (!editor) throw new Error("editor not ready");
    // In-history apply, copied from editors/canvas-editor/main.ts: the engine's
    // own HTML pipeline (marked → getElementListByHTML → selectAll + insert).
    const options = editor.command.getOptions();
    const elementList = getElementListByHTML(await marked.parse(markdown), {
      innerWidth: options.width - options.margins[1] - options.margins[3],
    });
    editor.command.executeSetRange(0, 0);
    editor.command.executeSelectAll();
    editor.command.executeInsertElementList(elementList);
    if (elementList[0]?.type === "title" && elementList[0].level) {
      editor.command.executeSetRange(1, 1);
      editor.command.executeTitle(elementList[0].level);
    }
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

  fit(width: number) {
    const scale = Math.max(0.3, Math.min(1, (width - 24) / 794));
    if (editor && Math.abs(editor.command.getOptions().scale - scale) > 0.01) editor.command.executePageScale(scale);
  },

  async exportDocx() {
    return exportDocxBytes();
  },
});

/* ------------------------------ probe surface ----------------------------- */

(window as any).__citeCheck = {
  editor: () => editor,
  report: () => report,
  lastInput: () => lastInput,
  parseSources,
  sourcesFromText,
  addSourceFile,
  toggleDemoSources,
  runCheck,
  importDocx,
  highlightQuote,
  insertNote,
  captureSelection,
  loadFixture,
};

/* ------------------------------ the pipeline ------------------------------ */

/**
 * Parse source text in the panel format:
 *   --- Source name | optional alias ---
 *   [p. 12]
 *   page text…
 * into core source objects ({id, name, aliases?, pages? | text?}).
 */
function parseSources(text: string) {
  const out: unknown[] = [];
  const parts = text.split(/^---\s+(.+?)\s+---\s*$/m);
  for (let i = 1; i < parts.length; i += 2) {
    const names = parts[i].split("|").map((s) => s.trim());
    const name = names[0];
    if (!name) continue;
    const body = parts[i + 1] ?? "";
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "src";
    const segs = body.split(/\[p\.\s*(\d+)\]\s*/);
    const pre = segs[0].trim();
    // deno-lint-ignore no-explicit-any
    const pages: any[] = [];
    for (let j = 1; j < segs.length; j += 2) {
      const t = (segs[j + 1] ?? "").trim();
      if (t) pages.push({ number: Number(segs[j]), text: t });
    }
    // deno-lint-ignore no-explicit-any
    const s: any = { id, name };
    if (names.length > 1) s.aliases = names.slice(1);
    if (pages.length) s.pages = pages;
    else if (pre) s.text = pre;
    else continue;
    out.push(s);
  }
  return out;
}

/**
 * Source text → core source objects. Panel format (--- name --- headers) wins;
 * otherwise the whole file is ONE source named after the file, with [p. N]
 * page markers honored when present (that is what a .docx source exports to).
 */
function sourcesFromText(text: string, fallbackName: string) {
  const parsed = parseSources(text);
  if (parsed.length) return parsed;
  const name = fallbackName || "Source";
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "src";
  const segs = text.split(/\[p\.\s*(\d+)\]\s*/);
  // deno-lint-ignore no-explicit-any
  const pages: any[] = [];
  for (let j = 1; j < segs.length; j += 2) {
    const t = (segs[j + 1] ?? "").trim();
    if (t) pages.push({ number: Number(segs[j]), text: t });
  }
  // deno-lint-ignore no-explicit-any
  const s: any = { id, name };
  if (pages.length) s.pages = pages;
  else s.text = text.trim();
  return [s];
}

/** The hidden second editor that reads .docx SOURCE files natively. */
function hiddenSourceEditor() {
  if (srcEditor) return srcEditor;
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText =
    "position:fixed;left:-99999px;top:0;width:794px;height:1123px;visibility:hidden;pointer-events:none";
  document.body.append(host);
  srcEditor = new Editor(host, { main: [{ value: "\n" }] }, {
    width: 794,
    height: 1123,
    margins: [96, 96, 96, 96],
  });
  srcEditor.use(docxPlugin);
  srcEditor.use(markdownPlugin);
  return srcEditor;
}

/** .docx source text via the native import → markdown-export pipeline. */
async function docxSourceText(bytes: Uint8Array): Promise<string> {
  const ed = hiddenSourceEditor();
  await ed.command.executeImportDocx({ arrayBuffer: bytes.slice().buffer });
  return ed.command.executeExportMarkdown();
}

/** One imported file → one or more loaded sources. Filename = source name. */
async function addSourceFile(f: File) {
  const name = f.name.replace(/\.[^.]+$/, "");
  let text: string;
  if (/\.docx$/i.test(f.name) || f.type.includes("wordprocessingml")) {
    text = await docxSourceText(new Uint8Array(await f.arrayBuffer()));
  } else {
    text = await f.text();
  }
  const added = sourcesFromText(text, name);
  loaded.push(...added.map((source) => ({ key: `s${++srcSeq}`, source })));
  renderSources();
  if (editor) await runCheck();
  return added;
}

/** Toggle the brief's bundled full source set in/out of the loaded list. */
async function toggleDemoSources() {
  const has = loaded.some((e) => e.demo);
  if (has) {
    loaded = loaded.filter((e) => !e.demo);
    renderSources();
    if (editor) await runCheck();
    return false;
  }
  const text = await (await fetch("/api/cite-check/sources.txt")).text();
  const added = sourcesFromText(text, "demo-sources.txt");
  loaded.push(...added.map((source) => ({ key: `s${++srcSeq}`, source, demo: true })));
  renderSources();
  if (editor) await runCheck();
  return true;
}

function removeSource(key: string) {
  loaded = loaded.filter((e) => e.key !== key);
  renderSources();
  if (editor) void runCheck().catch(() => {});
}

function renderSources() {
  const list = document.getElementById("cc-source-list");
  const info = document.getElementById("cc-src-info");
  const demoBtn = document.getElementById("cc-demo-sources") as HTMLButtonElement | null;
  sources = loaded.map((e) => e.source);
  if (!list) return;
  list.className = "cc-source-list";
  list.innerHTML = "";
  if (!loaded.length) {
    list.className = "hint";
    list.textContent = "No sources loaded — import .docx / .txt / .md source files, or add the demo set.";
  }
  for (const e of loaded) {
    const s = e.source;
    const segs = s.pages?.length ? `${s.pages.length} page(s)` : "full text";
    const row = document.createElement("div");
    row.className = "cc-src" + (e.demo ? " demo" : "");
    row.innerHTML =
      `<span class="nm" title="${escapeHtml(s.name)}">${escapeHtml(s.name)}${e.demo ? " · demo" : ""}</span>` +
      `<span class="meta">${segs}</span>` +
      `<button type="button" class="quiet" data-rm="${e.key}" title="Remove this source">✕</button>`;
    list.append(row);
  }
  if (demoBtn) {
    const on = loaded.some((x) => x.demo);
    demoBtn.textContent = on ? "Remove" : "Add full demo sources";
    demoBtn.title = on ? "Remove the bundled demo source set" : "Add the demo brief's bundled source set";
  }
  if (info) {
    info.textContent = sources.length
      ? `${sources.length} source(s) loaded: ${sources.map((x: { name: string }) => x.name).join("; ")}`
      : "Sources are matched to footnotes by name (aliases included).";
  }
}

/** Import real .docx bytes, then run the check over the REAL document text. */
async function importDocx(bytes: Uint8Array, name: string) {
  if (!editor) throw new Error("editor not ready");
  await editor.command.executeImportDocx({ arrayBuffer: bytes.slice().buffer });
  docName = name || docName;
  capture = null;
  return runCheck();
}

/** The core always consumes executeExportMarkdown() of the imported doc. */
async function runCheck() {
  const text = await editor.command.executeExportMarkdown();
  sources = loaded.map((e) => e.source);
  lastInput = { document: { name: docName, text }, sources };
  report = runCiteCheck(lastInput);
  renderReport();
  renderSources();
  return report;
}

async function loadFixture() {
  const brief = await fetch("/api/cite-check/appellate-brief.docx");
  if (!brief.ok) throw new Error(`fixture fetch failed: HTTP ${brief.status}`);
  return importDocx(new Uint8Array(await brief.arrayBuffer()), "appellate-brief.docx");
}

/* ------------------------------- annotations ------------------------------ */

/** Native highlight of one quote span (A4): engine locator → assert → color. */
function highlightQuote(text: string, classification: string) {
  const c = editor.command;
  let start: number | undefined, end: number | undefined;
  if (capture && capture.text === text) {
    start = capture.startIndex;
    end = capture.endIndex;
  } else {
    const kw = c.getKeywordRangeList(text)?.[0];
    if (!kw) {
      throw new Error(
        "quote span not located by the engine — select the passage on the page, click Capture, then Highlight",
      );
    }
    // anchor-style keyword indices → exact text range (spike finding, header)
    start = kw.startIndex - 1;
    end = kw.endIndex;
  }
  c.executeSetRange(start, end);
  // A4: assert the native range BEFORE highlighting, never trust the offsets.
  const got = String(c.getRangeText());
  if (got !== text) throw new Error(`native range mismatch: got "${got.slice(0, 50)}…"`);
  c.executeHighlight(COLORS[classification] ?? "#ffb3b3");
  return c.getRange();
}

/** Native end-of-document insert of a verification note (A5). */
function insertNote(r: { id: string; classification: string; anchor?: { sourceName: string | null } | null; pinpoint?: { raw: string } | null }) {
  const c = editor.command;
  const sourceName = r.anchor?.sourceName ?? "(unlocated)";
  // pinpoint.raw and sourceName come from the imported .docx / sources input:
  // escape the whole note text before it reaches getElementListByHTML.
  const html = `<p><em>${escapeHtml(`[${r.id} — ${r.classification} · ${sourceName}${r.pinpoint ? `, ${r.pinpoint.raw}` : ""} · cite-check ✓]`)}</em></p>`;
  const options = c.getOptions();
  const elementList = getElementListByHTML(html, {
    innerWidth: options.width - options.margins[1] - options.margins[3],
  });
  // Native end (see header): selectAll → native range end. Not the element
  // count from getValue(): after a docx import those are paragraph-sized.
  c.executeSelectAll();
  const end = c.getRange().endIndex;
  c.executeSetRange(end, end);
  c.executeInsertElementList(elementList);
  return { note: `[${r.id} — ${r.classification} · ${sourceName}${pin} · cite-check ✓]`, endIndex: end };
}

/** Read the engine's native range over the live selection (A4 capture). */
function captureSelection() {
  const c = editor.command;
  const range = c.getRange();
  const text = String(c.getRangeText() ?? "");
  if (!text || range.startIndex === range.endIndex) throw new Error("no selection on the page to capture");
  capture = { startIndex: range.startIndex, endIndex: range.endIndex, text };
  const box = document.getElementById("cc-manual") as HTMLTextAreaElement | null;
  if (box) box.value = text;
  return capture;
}

async function exportDocxBytes(): Promise<Uint8Array> {
  if (!editor) throw new Error("editor not ready");
  // plugin-docx always clicks a hidden download link; cancel just that click.
  const noDownload = (e: MouseEvent) => {
    const a = e.target as HTMLAnchorElement | null;
    if (a?.tagName === "A" && a.hasAttribute("download") && a.href.startsWith("blob:")) e.preventDefault();
  };
  document.addEventListener("click", noDownload, true);
  try {
    const blob: Blob = await editor.command.executeExportDocx({ fileName: "cite-checked.docx" });
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    document.removeEventListener("click", noDownload, true);
  }
}

/* --------------------------------- panel ---------------------------------- */

function renderReport() {
  const box = document.getElementById("cc-quotes");
  const warn = document.getElementById("cc-warnings");
  const summary = document.getElementById("cc-summary");
  if (!box || !warn || !summary) return;
  box.innerHTML = "";
  warn.innerHTML = "";
  if (!report) return;
  const s = report.summary;
  summary.textContent = `— ${s.total} quotes: ${s.exact} exact · ${s.normalized} normalized · ${s.fuzzy} fuzzy · ${s.not_found} not checked`;

  // deno-lint-ignore no-explicit-any
  for (const r of report.results as any[]) {
    const row = document.createElement("div");
    row.className = "cc-quote";
    const chip = `<span class="cc-chip ${r.classification}">${r.id} · ${r.classification}</span>`;
    const anchor = r.anchor
      ? `${r.anchor.sourceName}${r.anchor.segmentLabel !== null ? `, ${r.anchor.segmentKind} ${r.anchor.segmentLabel}` : ""} (chars ${r.anchor.charStart}–${r.anchor.charEnd})`
      : "not located";
    const pin = r.pinpoint
      ? `<span class="${r.pinpoint.status === "ok" ? "pin-ok" : r.pinpoint.status === "mismatch" ? "pin-bad" : ""}">pinpoint ${escapeHtml(r.pinpoint.raw)}: ${escapeHtml(r.pinpoint.status)}</span>`
      : "";
    const diff = r.diff?.length ? formatDiffOps(r.diff) : "";
    const notes = (r.notes ?? []).map((n: string) => `<div class="meta warn">${escapeHtml(n)}</div>`).join("");
    row.innerHTML = `
      <div class="top">${chip}<span class="sim">sim ${r.similarity.toFixed(2)}</span></div>
      <div class="text">“${escapeHtml(quoteTextOf(r))}”</div>
      <div class="meta">${escapeHtml(anchor)}</div>
      <div class="meta">${pin}</div>
      ${diff ? `<div class="meta">diff: <code>${escapeHtml(diff)}</code></div>` : ""}
      ${notes}
      <div class="acts">
        <button type="button" data-act="highlight" data-q="${encodeURIComponent(quoteTextOf(r))}" data-c="${r.classification}">Highlight</button>
        <button type="button" data-act="note" data-i="${r.id}">Insert note</button>
      </div>`;
    box.append(row);
  }
  for (const w of report.extractionWarnings ?? []) {
    const d = document.createElement("div");
    d.className = "cc-warn";
    d.textContent = `⚠ ${w}`;
    warn.append(d);
  }
  // manual source select
  const sel = document.getElementById("cc-manual-source") as HTMLSelectElement | null;
  if (sel) {
    sel.innerHTML = `<option value="">Source…</option>` +
      sources.map((x: { id: string; name: string }) => `<option value="${x.id}">${escapeHtml(x.name)}</option>`).join("");
  }
}

// The panel row shows the quote's own text; extraction results do not carry it
// back, so look it up from lastInput's extraction (id → text).
function quoteTextOf(r: { id: string; text?: string }): string {
  // Extraction results carry their own text now; the regex is only a fallback.
  if (typeof r.text === "string" && r.text) return r.text;
  if (!lastInput?.document?.text) return "";
  const m = new RegExp(`[“"]([^“”"\\n]+)[”"]\\s*\\[${r.id.replace(/^Q/, "").replace(/\.\d+$/, "")}\\]`).exec(lastInput.document.text);
  if (m) return m[1].trim();
  return manualQuotes.get(r.id) ?? "";
}
const manualQuotes = new Map<string, string>();

function escapeHtml(s: string) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function status(msg: string, kind: "ok" | "err" = "ok") {
  window.od.status(msg, kind);
}

function wirePanel() {
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
  const file = $<HTMLInputElement>("cc-file");

  $("cc-import")?.addEventListener("click", () => file?.click());
  file?.addEventListener("change", async () => {
    const f = file.files?.[0];
    if (!f) return;
    try {
      await importDocx(new Uint8Array(await f.arrayBuffer()), f.name);
      status(`Imported ${f.name} — ${report?.summary?.total ?? 0} quotes found`, "ok");
    } catch (err) {
      status(`Import failed: ${(err as Error).message}`, "err");
    }
    file.value = "";
  });

  $("cc-fixture")?.addEventListener("click", async () => {
    try {
      const rep = await loadFixture();
      status(`Demo brief loaded — ${rep?.summary?.total ?? 0} quotes`, "ok");
    } catch (err) {
      status(`Fixture failed: ${(err as Error).message}`, "err");
    }
  });

  // Sources: file import (hidden second editor for .docx) + demo-set toggle.
  const srcFile = $<HTMLInputElement>("cc-source-file");
  $("cc-add-source")?.addEventListener("click", () => srcFile?.click());
  srcFile?.addEventListener("change", async () => {
    const files = Array.from(srcFile.files ?? []);
    srcFile.value = "";
    if (!files.length) return;
    try {
      let n = 0;
      for (const f of files) n += (await addSourceFile(f)).length;
      status(`Loaded ${n} source(s) from ${files.length} file(s)`, "ok");
    } catch (err) {
      status(`Source import failed: ${(err as Error).message}`, "err");
    }
  });
  $("cc-demo-sources")?.addEventListener("click", () => {
    toggleDemoSources()
      .then((on) => status(on ? "Demo source set added" : "Demo source set removed", "ok"))
      .catch((err) => status(`Demo sources failed: ${(err as Error).message}`, "err"));
  });
  $("cc-source-list")?.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("button[data-rm]");
    if (btn) removeSource(btn.dataset.rm!);
  });
  $("cc-run")?.addEventListener("click", async () => {
    try {
      await runCheck();
      status("Cite check complete", "ok");
    } catch (err) {
      status(`Check failed: ${(err as Error).message}`, "err");
    }
  });

  // Undo / redo / export: native commands; import is exempt (A7, vendor).
  $("cc-undo")?.addEventListener("click", () => editor?.command.executeUndo());
  $("cc-redo")?.addEventListener("click", () => editor?.command.executeRedo());
  $("cc-export")?.addEventListener("click", async () => {
    try {
      const bytes = await exportDocxBytes();
      window.od.download(bytes, "cite-checked.docx");
      status(`Exported cite-checked.docx (${bytes.length.toLocaleString()} bytes)`, "ok");
    } catch (err) {
      status(`Export failed: ${(err as Error).message}`, "err");
    }
  });

  // Quote rows: act on mousedown (keeps the canvas selection), like the
  // canvas-editor toolbar.
  $("cc-quotes")?.addEventListener("mousedown", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("button[data-act]");
    if (!btn || !report) return;
    e.preventDefault();
    try {
      if (btn.dataset.act === "highlight") {
        const text = decodeURIComponent(btn.dataset.q ?? "");
        const range = highlightQuote(text, btn.dataset.c ?? "not_found");
        status(`Highlighted natively at ${range.startIndex}–${range.endIndex} (undoable)`, "ok");
      } else {
        const r = report.results.find((x: { id: string }) => x.id === btn.dataset.i);
        if (r) {
          const info = insertNote(r);
          status(`Note inserted at native end (${info.endIndex}) — undoable`, "ok");
        }
      }
    } catch (err) {
      status((err as Error).message, "err");
    }
  });

  // Capture keeps the engine range: mousedown + preventDefault (prior-art
  // pattern); the engine's hidden textarea still holds the selection.
  $("cc-capture")?.addEventListener("mousedown", (e) => {
    e.preventDefault();
    try {
      const cap = captureSelection();
      status(`Captured native range ${cap.startIndex}–${cap.endIndex}`, "ok");
    } catch (err) {
      status((err as Error).message, "err");
    }
  });

  $("cc-verify")?.addEventListener("click", async () => {
    const text = $<HTMLTextAreaElement>("cc-manual")?.value.trim();
    if (!text || !sources.length) {
      status("Enter a quote and at least one source", "err");
      return;
    }
    const sourceId = $<HTMLSelectElement>("cc-manual-source")?.value || sources[0].id;
    // deno-lint-ignore no-explicit-any
    const quote: any = { id: "M1", text, sourceId };
    const pin = $<HTMLInputElement>("cc-manual-pin")?.value.trim();
    if (pin) quote.pinpoint = pin;
    const md = await editor.command.executeExportMarkdown();
    const rep = runCiteCheck({ document: { name: docName, text: md }, sources, quotes: [quote] });
    manualQuotes.set("M1", text);
    const r = rep.results[0];
    const out = $("cc-manual-out");
    if (out) {
      out.innerHTML = `
        <div class="cc-quote" style="margin-top:8px">
          <div class="top"><span class="cc-chip ${r.classification}">M1 · ${r.classification}</span><span class="sim">sim ${r.similarity.toFixed(2)}</span></div>
          <div class="meta">${r.anchor ? escapeHtml(`${r.anchor.sourceName} chars ${r.anchor.charStart}–${r.anchor.charEnd}`) : "not located"}</div>
          ${r.diff?.length ? `<div class="meta">diff: <code>${escapeHtml(formatDiffOps(r.diff))}</code></div>` : ""}
          ${(r.notes ?? []).map((n: string) => `<div class="meta warn">${escapeHtml(n)}</div>`).join("")}
          <div class="acts">
            <button type="button" id="cc-manual-highlight">Highlight</button>
          </div>
        </div>`;
      out.querySelector("#cc-manual-highlight")?.addEventListener("click", () => {
        try {
          const range = highlightQuote(text, r.classification);
          status(`Highlighted natively at ${range.startIndex}–${range.endIndex}`, "ok");
        } catch (err) {
          status((err as Error).message, "err");
        }
      });
    }
  });
}
