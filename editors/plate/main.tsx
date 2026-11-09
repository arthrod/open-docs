/** @jsxImportSource https://esm.sh/react@18.2.0 */
/**
 * Plate adapter.
 *
 * Plate is a Slate framework, so "the document" is `editor.children`. Both DOCX
 * directions go through `@platejs/docx-io` (mammoth + html-to-docx) — see
 * `docx.ts` for why that matters. The agent writes by replacing the value
 * through `editor.tf.replaceNodes`, which is one undoable step.
 */
import { waitFor } from "/lib/kit.ts";
import { mountPlate, type PlateHandle } from "./editor.tsx";
import {
  emptyValue,
  importDocxToNodes,
  markdownToNodes,
  nodesToDocx,
  nodesToMarkdown,
} from "./docx.ts";

let handle: PlateHandle | undefined;

window.od.register({
  name: "Plate",
  mergeQuality: "rebuild",

  async mount() {
    const root = await waitFor<HTMLDivElement>("#plate-root");
    let value = emptyValue();

    // Prefer a real DOCX → node import so the demo starts from the fixture
    // rather than from markdown. Falls back to markdown if mammoth chokes.
    try {
      const bytes = await window.od.sampleDocx();
      // importDocx needs an editor instance for its deserializers, so mount
      // once with the fallback value, then swap in the converted nodes.
      value = markdownToNodes(await window.od.sampleMarkdown());
      mountPlate(root, value, (h) => {
        handle = h;
        window.od.status("Plate ready", "ok");
        void (async () => {
          try {
            const nodes = await importDocxToNodes(h.editor, bytes);
            h.setValue(nodes);
            window.od.status("Imported the sample .docx via mammoth", "ok");
          } catch (err) {
            console.warn("[plate] docx import fallback:", err);
            window.od.status(
              "DOCX→nodes import unavailable; showing text conversion",
              "err",
            );
          }
        })();
      });
    } catch (err) {
      console.warn("[plate] startup:", err);
      mountPlate(root, value, (h) => {
        handle = h;
      });
    }
  },

  async applyMarkdown(markdown) {
    if (!handle) throw new Error("Plate not mounted");
    handle.setValue(markdownToNodes(markdown));
  },

  async getMarkdown() {
    if (!handle) return await window.od.sampleMarkdown();
    return nodesToMarkdown(handle.getValue());
  },

  async exportDocx() {
    if (!handle) throw new Error("Plate not mounted");
    return await nodesToDocx(handle.getValue(), "plate");
  },

  async importDocx(bytes) {
    if (!handle) throw new Error("Plate not mounted");
    const nodes = await importDocxToNodes(handle.editor, bytes);
    handle.setValue(nodes);
  },
});
