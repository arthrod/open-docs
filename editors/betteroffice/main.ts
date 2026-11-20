/**
 * BetterOffice DOCX: Rust engines (parse, edit, layout) in WebAssembly inside a Worker, with a
 * React editor around them (@betteroffice/docx-react 0.5.1).
 *
 *   <DocxEditor ref documentBuffer readOnly downloadOnSave={false} />
 *   ref.loadDocumentBuffer(bytes), ref.save(): Promise<ArrayBuffer | null>
 *   ref.commands.execute("undo" | "redo", null), ref.whenLayoutComplete()
 *
 * It has no command that replaces a whole document from HTML or Markdown (its applyEdits
 * takes plain-text steps and refuses a full replacement), so an assistant edit opens a newly
 * built .docx. That clears its history, and the assistant offers no Undo here.
 */
import { createElement, createRef } from "react";
import { createRoot } from "react-dom/client";
import { configureDefaultFonts } from "@betteroffice/docx/layout";
import * as fonts from "@betteroffice/fonts";
import { DocxEditor } from "@betteroffice/docx-react";
import { waitFor } from "/lib/kit.ts";
import { REVISION_NOTES } from "/lib/revision-notes.ts";
import { markdownToDocx } from "/lib/plate-docx.ts";
import { docxToMarkdown } from "/lib/docx-markdown.ts";

type Ref = {
  loadDocumentBuffer(input: Uint8Array): Promise<void>;
  save(): Promise<ArrayBuffer | null>;
  whenLayoutComplete(o?: { timeoutMs?: number }): Promise<number>;
  commands: { execute(command: "undo" | "redo", arg: null): Promise<{ ok: boolean }> };
};

const ref = createRef<Ref>();
// Exposed for the probes in /lib/probes (read-only use).
(window as unknown as { __betteroffice?: () => Ref | null }).__betteroffice = () => ref.current;

const editor = () => {
  if (!ref.current) throw new Error("BetterOffice not mounted");
  return ref.current;
};

async function saved(): Promise<Uint8Array> {
  const buffer = await editor().save();
  if (!buffer) throw new Error("BetterOffice has no document to save");
  return new Uint8Array(buffer);
}

/**
 * Waits for the layout of the document now in the editor.
 *
 * BetterOffice rejects a wait with "Document was replaced" when the document's identity moves
 * while it waits, and that also happens with nobody replacing anything: on PageSpeed's desktop
 * machine three of five loads of the 500 pages ended that way (2026-11-20), none on its mobile
 * one. The document the page asked for is still the one loading, so the wait is taken up again
 * on the new identity; any other failure, or a fourth "replaced", is the page's error.
 */
async function layoutDone(timeoutMs = 60_000): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await editor().whenLayoutComplete({ timeoutMs });
      return;
    } catch (err) {
      if (attempt >= 4 || !/Document was replaced/.test(String((err as Error)?.message ?? err))) throw err;
      await new Promise((res) => requestAnimationFrame(() => res(null)));
    }
  }
}

async function open(bytes: Uint8Array) {
  try {
    await editor().loadDocumentBuffer(bytes.slice());
  } catch (err) {
    // The same rejection from the load's own wait: the bytes were handed over, so wait for them.
    if (!/Document was replaced/.test(String((err as Error)?.message ?? err))) throw err;
  }
  await layoutDone();
}

window.od.register({
  name: "BetterOffice",
  revisions: REVISION_NOTES["betteroffice"],
  applyInHistory: false,
  mergeQuality: "rebuild",
  // Its engines run in a Worker, whose downloads this page's Resource Timing does not list:
  // the Worker's two entry files and the four engines. (Chunks the Worker imports beyond its
  // entry are shared with the page and already listed there.)
  extraResources: [
    "docxWorker.mjs",
    "yrs/docxWorker.mjs",
    "generated/edit/docx_edit_bg.wasm",
    "generated/parse/docx_parse_bg.wasm",
    "generated/layout/docx_layout_bg.wasm",
    "generated/opc/ooxml_opc_bg.wasm",
  ].map((f) => new URL(f, import.meta.resolve("@betteroffice/docx")).href),

  async mount() {
    const root = await waitFor<HTMLDivElement>("#bo-root");
    // Its metric-compatible faces (Carlito, Liberation…), from the fonts package on this origin.
    (configureDefaultFonts as (o: { fonts: unknown }) => void)({ fonts });
    const v = window.od.viewer;
    const first = v ? await v.initialDocx() : await window.od.blankDocx();
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("BetterOffice did not start within 60 s")), 60_000);
      const fail = (err: unknown) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      };
      createRoot(root).render(createElement(DocxEditor as never, {
        ref,
        documentBuffer: first.slice(),
        readOnly: !!v,
        downloadOnSave: false,
        onError: fail,
      } as never));
      // The ref is attached when the editor chunk has loaded.
      const tick = () => {
        if (ref.current) {
          layoutDone().then(() => {
            clearTimeout(timer);
            resolve();
          }, fail);
        } else setTimeout(tick, 30);
      };
      tick();
    });
  },

  load: (bytes: Uint8Array) => open(bytes),
  getMarkdown: async () => docxToMarkdown(await saved()),
  applyMarkdown: async (markdown: string) => open(await markdownToDocx(markdown)),
  exportDocx: () => saved(),
  undo: async () => void (await editor().commands.execute("undo", null)),
  redo: async () => void (await editor().commands.execute("redo", null)),
});
