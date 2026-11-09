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
import { DocxEditor } from "https://esm.sh/@docx-editor.dev/react@2.35.0?external=react,react-dom";
import { waitFor } from "/lib/kit.ts";
// The vendor's open-licensed substitutes for Word's fonts (Carlito for Calibri,
// Liberation for Arial/Times/Courier…). Loaded from jsDelivr, not esm.sh: the
// package finds its .ttf files relative to import.meta.url.
import { packagedFonts } from "https://cdn.jsdelivr.net/npm/@docx-editor.dev/fonts@2.35.0/dist/index.js";
import { markdownToDocx } from "/lib/markdown.ts";
import { docxToMarkdown } from "/lib/docx-markdown.ts";

type EditorRef = {
  load(doc: Uint8Array | "blank"): void;
  save(): Promise<ArrayBuffer | null>;
  getEditor(): unknown;
};

let ref: EditorRef | null = null;
const FONTS = packagedFonts();

function App({ onReady }: { onReady: () => void }) {
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
      <DocxEditor ref={r as any} document="blank" mode="edit" fonts={FONTS} />
    </div>
  );
}

window.od.register({
  name: "docx-editor.dev",
  mergeQuality: "rebuild",

  async mount() {
    const root = await waitFor<HTMLDivElement>("#ep-root");
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("docx-editor.dev did not start within 45s")), 45_000);
      createRoot(root).render(<App onReady={() => { clearTimeout(timer); resolve(); }} />);
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
    // docx-editor.dev imports only .docx (markdown is export-only), so the
    // markdown becomes a complete Word document it opens with its own parser.
    ref.load(markdownToDocx(markdown));
  },

  async exportDocx() {
    const buffer = await ref?.save();
    if (!buffer) throw new Error("docx-editor.dev has no document loaded");
    return new Uint8Array(buffer);
  },
});
