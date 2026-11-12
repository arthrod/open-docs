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
// The vendor's open-licensed substitutes for Word's fonts (Carlito for Calibri,
// Liberation for Arial/Times/Courier…). Loaded from jsDelivr, not esm.sh: the
// package finds its .ttf files relative to import.meta.url.
import { packagedFonts } from "https://cdn.jsdelivr.net/npm/@docx-editor.dev/fonts@2.35.0/dist/index.js";
import { markdownToDocx } from "/lib/plate-docx.ts";
import { docxToMarkdown } from "/lib/docx-markdown.ts";

type EditorRef = DocxEditorRef;

let ref: EditorRef | null = null;
// Exposed for the probes in /lib/probes (read-only use).
(window as any).__eigenpal = () => ref;
const FONTS = packagedFonts();

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
  },

  async load(bytes: Uint8Array) {
    if (!ref) throw new Error("docx-editor.dev not mounted");
    ref.load(bytes.slice(0));
  },

  async getMarkdown() {
    // No markdown export on the ref: read the bytes it saves.
    const buffer = await ref?.save();
    return buffer ? docxToMarkdown(new Uint8Array(buffer)) : "";
  },

  async applyMarkdown(markdown: string) {
    if (!ref) throw new Error("docx-editor.dev not mounted");
    const handleBefore = ref.getDocumentHandle();
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
      html = `<div data-docx-fragment="${btoa(binary)}" data-docx-fragment-end="covered"></div>`;
    }
    if (ref.getDocumentHandle() !== handleBefore) {
      throw new Error("docx-editor.dev document changed while the apply was being prepared");
    }
    ref.focus();
    const selected = ref.exec({ type: "selectAll" });
    if (!selected.ok) throw new Error(`Select all failed: ${JSON.stringify(selected)}`);
    // No plain-text fallback: a refused fragment must not silently lose fidelity.
    const pasted = ref.exec(html
      ? { type: "paste", text: "", html }
      : { type: "deleteText" });
    if (!pasted.ok) throw new Error(`Paste failed: ${JSON.stringify(pasted)}`);
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
