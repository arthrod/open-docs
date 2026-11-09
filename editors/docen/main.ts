/**
 * docen — `<docen-document>`, a Fluent-UI web component (title bar, ribbon,
 * canvas pages) that speaks DOCX and Markdown natively
 * (`openDOCX` / `saveDOCX` / `openMarkdown` / `saveMarkdown`).
 *
 *  - Importing the module does NOT define the element: call
 *    `registerComponents()` and `applyTheme("light")` (per its README).
 *  - CDN wiring (icons, zlib, fast-element pin) lives in assets.ts.
 */
import { waitFor } from "/lib/kit.ts";
import { DOCEN } from "./assets.ts";
import { markdownToDocx } from "/lib/markdown.ts";
import { docxToMarkdown } from "/lib/docx-markdown.ts";

type DocenEl = HTMLElement & {
  openDOCX(bytes: Uint8Array | ArrayBuffer): Promise<void>;
  saveDOCX(): Promise<Uint8Array | ArrayBuffer | Blob>;
  openMarkdown(md: string): Promise<void>;
  saveMarkdown(): Promise<string> | string;
  setZoom?(pct: number): void;
  getZoom?(): number;
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

  // A Letter page is 816 px; on a narrower stage docen's own zoom (the one its
  // status bar drives) shrinks the page to fit, never above 100%.
  fit(width: number) {
    const pct = Math.max(25, Math.min(100, Math.floor(((width - 56) / 816) * 100)));
    if (el?.setZoom && el.getZoom?.() !== pct) el.setZoom(pct);
  },

  async mount() {
    const node = await waitFor<HTMLElement>("#docen");
    window.od.progress("Loading docen (Fluent UI + canvas layout)…");
    const mod = await import(DOCEN);
    if (typeof mod.registerComponents !== "function") {
      throw new Error("docen/editor has no registerComponents()");
    }
    mod.registerComponents();
    mod.applyTheme?.("light");
    el = await upgraded(node);
    // The element boots on its own empty document — that is our blank page.
  },

  async load(bytes: Uint8Array) {
    if (!el) throw new Error("docen not mounted");
    await el.openDOCX(bytes);
  },

  async getMarkdown() {
    // docen's saveMarkdown (@docen/docx@0.7.0) drops bold/italic/code, writes
    // bullets as numbers and loses quotes; read its .docx export instead.
    return el ? docxToMarkdown(await toBytes(await el.saveDOCX())) : "";
  },

  async applyMarkdown(markdown) {
    if (!el) throw new Error("docen not mounted");
    // NOT el.openMarkdown(): in @docen/docx@0.7.0 the Bold/Italic/Code marks
    // have no markdown token handlers, so @tiptap/markdown drops bold, italic
    // and the TEXT of inline code. docen's .docx reader is complete, so the
    // markdown goes in as a Word document instead.
    await el.openDOCX(markdownToDocx(markdown));
  },

  async exportDocx() {
    if (!el) throw new Error("docen not mounted");
    return await toBytes(await el.saveDOCX());
  },
});
