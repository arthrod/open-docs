/**
 * Docxodus — .NET compiled to WebAssembly, with its own Word-style ribbon.
 *
 * Verified against dist/embed.bundle.js (v15.1.0):
 *
 *   createRibbonEditor(target, bytes | null, { wasmBasePath, documentName })
 *     → ribbon { open(bytes, name), openBlank(name), save(): Uint8Array|null,
 *                editor, destroy() }
 *
 * `bytes = null` opens the engine's own blank document. `open()` swaps the
 * document inside the SAME ribbon, so import/new/sample never remount.
 *
 * `wasmBasePath` must be a string ending in "/" (the loader calls
 * `s.endsWith("/")` — passing anything else was the original crash).
 */
import { waitFor } from "/lib/kit.ts";
import { markdownToDocx } from "/lib/plate-docx.ts";
import { docxToMarkdown } from "/lib/docx-markdown.ts";
import { BUNDLE_URL, WASM_BASE } from "./assets.ts";

type Ribbon = {
  open(bytes: Uint8Array, name?: string): unknown;
  openBlank(name?: string): unknown;
  save(): Uint8Array | null;
  destroy(): void;
  editor: unknown;
};

let ribbon: Ribbon | undefined;
/** On view-only pages: Docxodus's paginated read-only view (convertDocxToHtml + paginateHtml), not the ribbon. */
let viewer: { reload(bytes: Uint8Array): Promise<void> } | undefined;

function saveBytes(): Uint8Array | undefined {
  const out = ribbon?.save();
  if (!out) return undefined;
  return out instanceof Uint8Array ? out : new Uint8Array(out as ArrayBuffer);
}

window.od.register({
  name: "Docxodus",
  mergeQuality: "rebuild",

  async mount() {
    const host = await waitFor<HTMLDivElement>("#dx-host");
    host.innerHTML = "";
    const target = document.createElement("div");
    // Absolute fill: the ribbon root is height:100% and needs a definite box.
    target.style.cssText = "position:absolute;inset:0";
    host.append(target);

    const mod = await import(BUNDLE_URL);
    const v = window.od.viewer;
    if (v) {
      // Read-only and paginated, the way Docxodus documents its page view:
      // convertDocxToHtml in Paginated mode (headers, footers, notes), then its
      // own paginateHtml flows the result into page boxes. (createViewer only
      // injects the HTML; it never paginates.)
      for (const f of ["initialize", "convertDocxToHtml", "paginateHtml"]) {
        if (typeof mod[f] !== "function") throw new Error(`docxodus bundle has no ${f}()`);
      }
      target.style.overflow = "auto";
      target.style.background = "#eef1f5";
      target.style.padding = "24px 0";
      await mod.initialize(WASM_BASE);
      const render = async (bytes: Uint8Array) => {
        const html: string = await mod.convertDocxToHtml(bytes, {
          paginationMode: mod.PaginationMode.Paginated,
          renderHeadersAndFooters: true,
          renderFootnotesAndEndnotes: true,
        });
        target.innerHTML = "";
        await document.fonts.ready;
        mod.paginateHtml(html, target, { scale: 1 });
      };
      viewer = { reload: render };
      await render(await v.initialDocx());
      return;
    }
    if (typeof mod.createRibbonEditor !== "function") {
      throw new Error("docxodus bundle has no createRibbonEditor()");
    }
    // null → native blank document. The ribbon shows its own staged loader.
    ribbon = await mod.createRibbonEditor(target, null, {
      wasmBasePath: WASM_BASE,
      documentName: "Untitled.docx",
      // "card" (the default) adds a border, radius and shadow meant for a
      // floating widget; "flush" fills our stage edge-to-edge.
      frame: "flush",
    }) as Ribbon;
  },

  async load(bytes: Uint8Array) {
    if (viewer) return viewer.reload(bytes);
    if (!ribbon) throw new Error("Docxodus not mounted");
    ribbon.open(bytes, "document.docx");
  },

  async getMarkdown() {
    // Docxodus's own markdown (convertWmlToMarkdown) is an anchor-annotated
    // projection for patching; the assistant gets plain markdown read from the
    // bytes Docxodus saves.
    const bytes = saveBytes();
    return bytes?.length ? docxToMarkdown(bytes) : "";
  },

  async applyMarkdown(markdown) {
    if (!ribbon) throw new Error("Docxodus not mounted");
    // Docxodus has no markdown importer (only WmlToMarkdown export): the
    // markdown becomes a Word document through Plate's own markdown reader and
    // .docx exporter (lib/plate-docx.ts), which Docxodus opens with its reader.
    ribbon.open(await markdownToDocx(markdown), "document.docx");
  },

  async exportDocx() {
    const bytes = saveBytes();
    if (!bytes) throw new Error("Docxodus returned no document");
    return bytes;
  },
});
