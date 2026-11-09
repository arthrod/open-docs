/** @jsxImportSource https://esm.sh/react@18.2.0 */
/**
 * docx-editor.dev (eigenpal).
 *
 * TWO VERIFIED FIXES over the first attempt:
 *  - `?bundle-deps&external=…` returns 404. `?external=react,react-dom` works.
 *  - The stylesheet is exported by the React package (`./styles.css` →
 *    `src/styles/editor.css`), NOT `@docx-editor.dev/core/styles/editor.css`.
 *
 * The packaged `<DocxEditor>` takes `document={Uint8Array}` and exposes
 * `save()` on its ref. `document` is a controlled prop, so a "new document"
 * is just new bytes — no remount needed.
 */
import React, { useRef, useState } from "https://esm.sh/react@18.2.0";
import { createRoot } from "https://esm.sh/react-dom@18.2.0/client";
import {
  DocxEditor,
} from "https://esm.sh/@docx-editor.dev/react@2.35.0?external=react,react-dom";
import { waitFor } from "/lib/kit.ts";

type EditorRef = { save(): Promise<ArrayBuffer | null> };

let editorRef: EditorRef | null = null;
let setBytes: ((b: Uint8Array) => void) | null = null;

function App({ initial }: { initial: Uint8Array }) {
  const [bytes, setBytesState] = useState<Uint8Array>(initial);
  const ref = useRef<EditorRef>(null);
  setBytes = setBytesState;

  return (
    <div style={{ height: "100%", minHeight: 0 }}>
      <DocxEditor
        ref={(instance: EditorRef | null) => {
          ref.current = instance;
          editorRef = instance;
        }}
        document={bytes}
        mode="edit"
      />
    </div>
  );
}

window.od.register({
  name: "docx-editor.dev",
  mergeQuality: "native",

  async mount() {
    const root = await waitFor<HTMLDivElement>("#ep-root");
    // Start blank.
    const blank = await window.od.blankDocx();
    createRoot(root).render(<App initial={blank} />);
  },

  async load(bytes: Uint8Array) {
    if (!setBytes) throw new Error("docx-editor.dev not mounted");
    // The prop is controlled: new bytes = new document.
    setBytes(bytes.slice(0) as Uint8Array);
  },

  async getMarkdown() {
    // No text API on the open ref. Round-trip through the server extractor so
    // the agent sees the real document, including anything you typed.
    const buffer = await editorRef?.save?.();
    if (!buffer) return "";
    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body: buffer,
    });
    if (!res.ok) return "";
    const json = await res.json();
    return (json.markdown as string) ?? "";
  },

  async applyMarkdown(markdown) {
    if (!setBytes) throw new Error("docx-editor.dev not mounted");
    // No mutation API here, so build a real .docx from the markdown and reload.
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ markdown, title: "eigenpal" }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "export failed");
    setBytes(window.od.base64ToBytes(json.base64));
  },

  async exportDocx() {
    const buffer = await editorRef?.save?.();
    if (!buffer) throw new Error("editor has no document loaded");
    return new Uint8Array(buffer);
  },
});
