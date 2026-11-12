/** @jsxImportSource https://esm.sh/react@18.2.0 */
/**
 * Plate adapter.
 *
 * Plate is a Slate framework, so "the document" is `editor.children`.
 *   markdown ⇄ nodes: Plate's own @platejs/markdown (editor.api.markdown)
 *   .docx in: mammoth → HTML → nodes;  .docx out: Plate's own exporter (@platejs/docx-io)
 * See docx.ts for why the DOCX path is not @platejs/docx-io.
 */
import { waitFor } from "/lib/kit.ts";
import { mountPlate, type PlateHandle } from "./editor.tsx";
import { emptyValue, importDocxToNodes } from "./docx.ts";
import { plateValueToDocx } from "/lib/plate-docx.ts";

let handle: PlateHandle | undefined;

window.od.register({
  name: "Plate",
  mergeQuality: "native",

  async mount() {
    const root = await waitFor<HTMLDivElement>("#plate-root");
    window.od.progress("Loading Plate (Slate + React)…");
    await new Promise<void>((resolve) =>
      mountPlate(root, emptyValue(), (h) => {
        handle = h;
        // Exposed for debugging from the console.
        (window as any).__plate = h.editor;
        resolve();
      }, !!window.od.viewer)
    );
  },

  async load(bytes) {
    if (!handle) throw new Error("Plate not mounted");
    handle.setValue(await importDocxToNodes(handle.editor, bytes));
  },

  async applyMarkdown(markdown) {
    if (!handle) throw new Error("Plate not mounted");
    const nodes = handle.fromMarkdown(markdown);
    handle.setValue(nodes.length ? nodes : emptyValue());
  },

  async getMarkdown() {
    return handle ? handle.toMarkdown() : "";
  },

  // Slate's own history (withHistory).
  undo() {
    handle?.editor.undo();
  },
  redo() {
    handle?.editor.redo();
  },

  async exportDocx() {
    if (!handle) throw new Error("Plate not mounted");
    return plateValueToDocx(handle.getValue());
  },
});
