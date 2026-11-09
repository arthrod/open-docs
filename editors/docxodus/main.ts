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
import { BUNDLE_URL, WASM_BASE } from "./assets.ts";

type Ribbon = {
  open(bytes: Uint8Array, name?: string): unknown;
  openBlank(name?: string): unknown;
  save(): Uint8Array | null;
  destroy(): void;
  editor: unknown;
};

let ribbon: Ribbon | undefined;

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
    if (!ribbon) throw new Error("Docxodus not mounted");
    ribbon.open(bytes, "document.docx");
  },

  async getMarkdown() {
    const bytes = saveBytes();
    if (!bytes?.length) return "";
    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body: bytes,
    });
    if (!res.ok) return "";
    return ((await res.json()).markdown as string) ?? "";
  },

  async applyMarkdown(markdown) {
    if (!ribbon) throw new Error("Docxodus not mounted");
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ markdown, title: "docxodus" }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "export failed");
    ribbon.open(window.od.base64ToBytes(json.base64), "document.docx");
  },

  async exportDocx() {
    const bytes = saveBytes();
    if (!bytes) throw new Error("Docxodus returned no document");
    return bytes;
  },
});
