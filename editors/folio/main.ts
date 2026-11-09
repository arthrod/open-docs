/**
 * folio — ProseMirror + paginated layout, Vue-packaged imperative mount.
 *
 * Verified against @stll/folio-vue@0.28.0's typings:
 *   renderAsync(DocxInput, container, options) → { save(), getDocument(), focus(), destroy() }
 *   createEmptyDocument(), fromMarkdown(md) → Document, toMarkdown(Document)
 *   createDocx(Document) → ArrayBuffer
 *
 * So everything — the blank start, the assistant's markdown, and reading the
 * document back — goes through folio's own model and serializer.
 */
import { waitFor } from "/lib/kit.ts";

// DO NOT pass ?external=: esm.sh leaves every external as a bare import the
// browser can't resolve. `?bundle&target=es2022` inlines Vue + ProseMirror and
// has zero bare specifiers.
const CDN = "https://esm.sh/@stll/folio-vue@0.28.0?bundle&target=es2022";

type Handle = {
  save(): Promise<Blob | null>;
  getDocument(): unknown;
  destroy?(): void;
  focus?(): void;
};

let api: any;
let handle: Handle | undefined;
let host: HTMLElement | undefined;

async function folio() {
  api ??= await import(CDN);
  return api;
}

async function open(input: Uint8Array | ArrayBuffer): Promise<void> {
  if (!host) throw new Error("folio host missing");
  const f = await folio();
  try {
    handle?.destroy?.();
  } catch { /* already gone */ }
  handle = undefined;
  host.innerHTML = "";
  handle = await f.renderAsync(input, host, {
    showToolbar: true,
    showZoomControl: true,
    showRuler: true,
    author: "open-docs",
    colorMode: "light",
  }) as Handle;
}

async function blank(): Promise<ArrayBuffer> {
  const f = await folio();
  if (typeof f.createEmptyDocument === "function" && typeof f.createDocx === "function") {
    return await f.createDocx(f.createEmptyDocument());
  }
  return (await window.od.blankDocx()).slice().buffer;
}

window.od.register({
  name: "folio",
  mergeQuality: "native",

  async mount() {
    host = await waitFor<HTMLDivElement>("#folio-root");
    window.od.progress("Loading folio (Vue + ProseMirror, ~4 MB)…");
    await open(await blank());
  },

  async load(bytes: Uint8Array) {
    await open(bytes.slice());
  },

  async getMarkdown() {
    const f = await folio();
    const doc = handle?.getDocument?.();
    return doc ? String(f.toMarkdown(doc) ?? "") : "";
  },

  async applyMarkdown(markdown: string) {
    const f = await folio();
    // folio's own markdown → model → .docx, so headings, lists and inline
    // bold/italic come through its serializer, not ours.
    await open(await f.createDocx(f.fromMarkdown(markdown)));
  },

  async exportDocx() {
    if (!handle) throw new Error("folio not mounted");
    const blob = await handle.save();
    if (!blob) throw new Error("folio returned no document");
    return new Uint8Array(await blob.arrayBuffer());
  },
});
