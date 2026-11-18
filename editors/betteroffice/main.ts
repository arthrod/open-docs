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

async function open(bytes: Uint8Array) {
  await editor().loadDocumentBuffer(bytes.slice());
  await editor().whenLayoutComplete({ timeoutMs: 60_000 });
}

window.od.register({
  name: "BetterOffice",
  revisions: REVISION_NOTES["betteroffice"],
  applyInHistory: false,
  mergeQuality: "rebuild",

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
          ref.current.whenLayoutComplete({ timeoutMs: 60_000 }).then(() => {
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
