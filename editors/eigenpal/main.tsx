/** @jsxImportSource https://esm.sh/react@18.2.0 */
/**
 * docx-editor.dev (eigenpal) — a paginated React .docx editor with its own
 * title bar, menus and toolbar.
 *
 * Verified against @docx-editor.dev/react@2.35.0's typings:
 *   <DocxEditor document={"blank" | Uint8Array} mode="edit" ref={…} />
 *   ref.load(bytes | "blank"), ref.save(): Promise<ArrayBuffer | null>
 *
 * React is resolved through the page's import map (server/router.ts →
 * REACT_IMPORTS), so this module, the library and its Radix dependencies all
 * share one React.
 */
import React, { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { DocxEditor, type DocxEditorRef } from "https://esm.sh/@docx-editor.dev/react@2.35.0?external=react,react-dom";
import { waitFor } from "/lib/kit.ts";
import { REVISION_NOTES } from "/lib/revision-notes.ts";
// The vendor's open-licensed substitutes for Word's fonts (Carlito for Calibri,
// Liberation for Arial/Times/Courier…). Loaded from jsDelivr, not esm.sh: the
// package finds its .ttf files relative to import.meta.url.
import { packagedFonts } from "https://cdn.jsdelivr.net/npm/@docx-editor.dev/fonts@2.35.0/dist/index.js";
import { marked } from "https://esm.sh/marked@18.1.3?target=es2022";
import { markdownToDocx } from "/lib/plate-docx.ts";
import { docxToMarkdown } from "/lib/docx-markdown.ts";

type EditorRef = DocxEditorRef;

let ref: EditorRef | null = null;
// Exposed for the probes in /lib/probes (read-only use).
(window as any).__eigenpal = () => ref;
const FONTS = packagedFonts();

/**
 * Resolves when the document handed over is laid out to its last page.
 *
 * `ref.load()` returns at once and the editor reports nothing when it is done: it paints the
 * first pages (`snapshot().isOpening` turns false), then lays out the rest in the background
 * under its own spinner (`.docx-editor__loading-spinner`). Seen 2026-11-20 on the 500 pages:
 * load() returned in 6 ms, first pages at 2.1 s, spinner gone and 500 pages at 6.5 s. So "done"
 * is read from what it shows a person: not opening, pages present, no spinner, for QUIET_MS
 * (the spinner mounts a commit after the first pages, so one clear reading is not enough).
 * A time measured through this includes those QUIET_MS.
 */
const QUIET_MS = 300;
async function laidOut(replaced?: string, timeoutMs = 180_000): Promise<void> {
  const start = performance.now();
  // After a load(), the snapshot is the OLD document's until the editor takes the new one up:
  // nothing counts as done before the document handle has changed (or a second has passed, for
  // a build whose handle does not).
  const isNew = () => replaced === undefined || handleKey() !== replaced || performance.now() - start > 1000;
  let clearSince: number | null = null;
  for (;;) {
    const snap = ref?.snapshot?.() as { isLoading?: boolean; isOpening?: boolean; parseError?: string | null; page?: { total?: number } } | undefined;
    if (snap?.parseError) throw new Error(`docx-editor.dev could not open the document: ${snap.parseError}`);
    const clear = isNew() && !!snap && !snap.isLoading && !snap.isOpening && (snap.page?.total ?? 0) > 0 &&
      !document.querySelector(".docx-editor__loading-spinner");
    const now = performance.now();
    if (!clear) clearSince = null;
    else if (clearSince == null) clearSince = now;
    else if (now - clearSince >= QUIET_MS) return;
    if (now - start > timeoutMs) throw new Error(`docx-editor.dev was still laying out after ${Math.round(timeoutMs / 1000)} s`);
    await new Promise((res) => setTimeout(res, 50));
  }
}

const handleKey = (): string => {
  try {
    return JSON.stringify(ref?.getDocumentHandle?.() ?? null);
  } catch {
    return "";
  }
};

function App({ onReady, doc, view }: { onReady: () => void; doc: Uint8Array | "blank"; view: boolean }) {
  const r = useRef<EditorRef | null>(null);
  useEffect(() => {
    // The ref is attached on commit; poll until the editor reports a document.
    let alive = true;
    const tick = async () => {
      while (alive) {
        if (r.current?.getEditor?.()) {
          ref = r.current;
          onReady();
          return;
        }
        await new Promise((res) => setTimeout(res, 50));
      }
    };
    void tick();
    return () => {
      alive = false;
    };
  }, []);
  return (
    <div style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}>
      {/* The library's default fit stops at 50%, which still overflows a phone;
          same fit, lower floor. */}
      <DocxEditor ref={r as any} document={doc} mode={view ? "view" : "edit"} fonts={FONTS}
        zoomMode={{ type: "fit", fit: "pageWidth", minZoom: 0.25, maxZoom: 1 }} />
    </div>
  );
}

window.od.register({
  name: "docx-editor.dev",
  // Its layout takes `proposed` when no review module is registered, and the
  // review module is in the paid @docx-editor.dev/pro. Forcing
  // reviewDisplayMode="all-markup" without it stops the editor from starting
  // (tried 2026-11-15). So the free tier is shown as the vendor ships it.
  revisions: REVISION_NOTES["eigenpal"],
  // selectAll + its own paste of its own DOCX clipboard fragment: one entry
  // in its history, with the styles/numbering of the .docx it was given.
  applyInHistory: true,
  mergeQuality: "rebuild",

  async mount() {
    const root = await waitFor<HTMLDivElement>("#ep-root");
    // View-only page: its own "view" mode, opened on the real document.
    const v = window.od.viewer;
    const doc = v ? (await v.initialDocx()).slice(0) : "blank" as const;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("docx-editor.dev did not start within 45s")), 45_000);
      createRoot(root).render(<App doc={doc} view={!!v} onReady={() => { clearTimeout(timer); resolve(); }} />);
    });
    // A view-only page is "ready" when its document is on the page, not when the editor exists.
    if (v) await laidOut();
  },

  async load(bytes: Uint8Array) {
    if (!ref) throw new Error("docx-editor.dev not mounted");
    const before = handleKey();
    ref.load(bytes.slice(0));
    await laidOut(before);
  },

  async getMarkdown() {
    // No markdown export on the ref: read the bytes it saves.
    const buffer = await ref?.save();
    return buffer ? docxToMarkdown(new Uint8Array(buffer)) : "";
  },

  async applyMarkdown(markdown: string) {
    if (!ref) throw new Error("docx-editor.dev not mounted");
    let html = "";
    if (markdown.trim()) {
      const bytes = await markdownToDocx(markdown);
      // 2.35.0's native clipboard codec accepts a base64 DOCX package. Its paste
      // transaction imports styles/numbering and replaces the selection atomically.
      // Keep the old DOCX conversion, but never load it over the live document.
      if (bytes.byteLength > 16 * 1024 * 1024) throw new Error("Edit exceeds the engine's 16 MiB clipboard limit");
      let binary = "";
      for (let i = 0; i < bytes.length; i += 32768) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
      }
      // The vendor's own copy format: the package plus its rendered HTML inside
      // the div, so a refused fragment falls back to the engine's HTML import
      // (and then to the text) instead of to nothing.
      const rendered = await marked.parse(markdown);
      html = `<div data-docx-fragment="${btoa(binary)}" data-docx-fragment-end="covered">${rendered}</div>`;
    }
    ref.focus();
    const selected = ref.exec({ type: "selectAll" });
    if (!selected.ok) throw new Error(`Select all failed: ${JSON.stringify(selected)}`);
    const pasted = ref.exec(html
      ? { type: "paste", text: markdown, html }
      : { type: "deleteText" });
    // An empty edit on a document that is already empty: select-all selects nothing and the
    // engine refuses the delete. The document is what was asked for.
    if (!html && !pasted.ok && /nothing is selected/.test(String((pasted as { reason?: unknown }).reason ?? ""))) return;
    // `ok` only means the command ran: a paste every lane declined (view mode,
    // a header story, a cell selection) answers {ok: true, changed: false}.
    // The delete branch may legitimately change nothing on an already-empty document.
    if (!pasted.ok || (html && !pasted.changed)) throw new Error(`Paste did not change the document: ${JSON.stringify(pasted)}`);
  },

  // docx-editor.dev's own history commands.
  undo() {
    ref?.exec({ type: "undo" });
  },
  redo() {
    ref?.exec({ type: "redo" });
  },

  async exportDocx() {
    const buffer = await ref?.save();
    if (!buffer) throw new Error("docx-editor.dev has no document loaded");
    return new Uint8Array(buffer);
  },
});
