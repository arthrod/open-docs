/**
 * docen — `<docen-document>`, a Fluent-UI web component that speaks DOCX and
 * Markdown natively (`openDOCX` / `saveDOCX` / `openMarkdown` / `saveMarkdown`).
 *
 * Two fixes over the first version:
 *  - Importing `docen/editor` does NOT define the element. Per the README you
 *    must call `registerComponents()` and `applyTheme("light")`. Without that
 *    the tag never upgrades and nothing renders.
 *  - Use the UNBUNDLED esm.sh build. `?bundle` returns a shim without
 *    `registerComponents`, and bundling would duplicate FAST element.
 */
import { waitFor } from "/lib/kit.ts";

const CDN = "https://esm.sh/docen@0.7.0/editor?target=es2022";

type DocenEl = HTMLElement & {
  openDOCX(bytes: Uint8Array | ArrayBuffer): Promise<void>;
  saveDOCX(): Promise<Uint8Array | ArrayBuffer | Blob>;
  openMarkdown(md: string): Promise<void>;
  saveMarkdown(): Promise<string> | string;
};

let el: DocenEl | undefined;

async function upgraded(node: HTMLElement): Promise<DocenEl> {
  await customElements.whenDefined("docen-document");
  for (let i = 0; i < 200 && typeof (node as DocenEl).openDOCX !== "function"; i++) {
    await new Promise((r) => setTimeout(r, 25));
  }
  if (typeof (node as DocenEl).openDOCX !== "function") {
    throw new Error("<docen-document> upgraded but has no openDOCX()");
  }
  return node as DocenEl;
}

async function toBytes(out: Uint8Array | ArrayBuffer | Blob): Promise<Uint8Array> {
  if (out instanceof Uint8Array) return out;
  if (out instanceof Blob) return new Uint8Array(await out.arrayBuffer());
  return new Uint8Array(out);
}

window.od.register({
  name: "docen",
  mergeQuality: "native",

  async mount() {
    const node = await waitFor<HTMLElement>("#docen");
    window.od.status("Loading docen…");
    const mod = await import(CDN);
    if (typeof mod.registerComponents !== "function") {
      throw new Error("docen/editor has no registerComponents()");
    }
    mod.registerComponents();
    mod.applyTheme?.("light");
    el = await upgraded(node);
    // The element starts on an empty document; open our blank to normalise
    // page setup, but don't fail the mount if it refuses.
    try {
      await el.openDOCX(await window.od.blankDocx());
    } catch (err) {
      console.warn("[docen] blank open failed, keeping default", err);
    }
  },

  async load(bytes: Uint8Array) {
    if (!el) throw new Error("docen not mounted");
    await el.openDOCX(bytes);
  },

  async getMarkdown() {
    return el ? await el.saveMarkdown() : "";
  },

  async applyMarkdown(markdown) {
    if (!el) throw new Error("docen not mounted");
    await el.openMarkdown(markdown);
  },

  async exportDocx() {
    if (!el) throw new Error("docen not mounted");
    return await toBytes(await el.saveDOCX());
  },
});
