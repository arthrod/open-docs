/**
 * folio — ProseMirror + paginated layout, Vue-packaged imperative mount.
 *
 * Verified against @stll/folio-vue@0.28.0's typings:
 *   renderAsync(DocxInput, container, options) → { save(), getDocument(), focus(), destroy() }
 *   createEmptyDocument(), fromMarkdown(md) → Document, toMarkdown(Document)
 *   createDocx(Document) → ArrayBuffer
 *
 * Its markdown pair is not complete (measured 2026-11-09 with
 * lib/probes/md-edge.js): `fromMarkdown` turns a fenced code block into
 * unstyled Courier paragraphs, one per line, and `toMarkdown` writes those —
 * and inline code in an opened .docx — without backticks, and escapes `<br>`
 * in table cells. So, like the other .docx-native editors, the assistant's
 * markdown becomes a Word document (lib/markdown.ts) opened by folio's own
 * .docx importer, and is read back from folio's own .docx export
 * (lib/docx-markdown.ts). Both keep every element.
 */
import { waitFor } from "/lib/kit.ts";
import { markdownToDocx } from "/lib/plate-docx.ts";
import { docxToMarkdown } from "/lib/docx-markdown.ts";

// DO NOT pass ?external=: esm.sh leaves every external as a bare import the
// browser can't resolve. `?bundle&target=es2022` inlines Vue + ProseMirror and
// has zero bare specifiers.
const CDN = "https://esm.sh/@stll/folio-vue@0.28.0?bundle&target=es2022";

type Handle = {
  save(): Promise<Blob | null>;
  getDocument(): unknown;
  destroy?(): void;
  setZoom?(zoom: number): void;
  focus?(): void;
};

let api: any;
let handle: Handle | undefined;
/** The zoom that fits the page to the stage (folio's own zoom; 1 = 100%). */
let fitZoom = 1;
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
  const view = !!window.od.viewer;
  handle = await f.renderAsync(input, host, {
    // View-only page: folio's own read-only mode (it also hides the toolbar
    // and rulers).
    readOnly: view,
    showToolbar: !view,
    showZoomControl: true,
    showRuler: !view,
    initialZoom: fitZoom,
    author: "open-docs",
    colorMode: "light",
    onEditorViewReady: (v: { dom: HTMLElement } | null) => {
      pmView = v ?? undefined;
    },
  }) as Handle;
}

/** folio's ProseMirror view: its own keymap binds Mod-Z / Mod-Shift-Z to its history. */
let pmView: { dom: HTMLElement } | undefined;
// Exposed for the probes in /lib/probes (read-only use).
(window as any).__folio = () => ({ api, handle, view: pmView });
const MOD: KeyboardEventInit = /Mac/.test(navigator.platform) ? { metaKey: true } : { ctrlKey: true };
function historyKey(shiftKey: boolean) {
  // Lowercase key: prosemirror-keymap binds "Mod-Shift-z" and synthetic events carry keyCode 0,
  // so its keyCode fallback can't map an uppercase "Z" back to "z".
  pmView?.dom.dispatchEvent(new KeyboardEvent("keydown", { key: "z", code: "KeyZ", shiftKey, bubbles: true, cancelable: true, ...MOD }));
}

async function blank(): Promise<ArrayBuffer> {
  const f = await folio();
  if (typeof f.createEmptyDocument === "function" && typeof f.createDocx === "function") {
    return await f.createDocx(f.createEmptyDocument());
  }
  return (await window.od.blankDocx()).slice().buffer;
}

async function exportBytes(): Promise<Uint8Array> {
  if (!handle) throw new Error("folio not mounted");
  const blob = await handle.save();
  if (!blob) throw new Error("folio returned no document");
  return new Uint8Array(await blob.arrayBuffer());
}

window.od.register({
  name: "folio",
  mergeQuality: "native",

  async mount() {
    host = await waitFor<HTMLDivElement>("#folio-root");
    window.od.progress("Loading folio (Vue + ProseMirror, ~4 MB)…");
    const v = window.od.viewer;
    await open(v ? (await v.initialDocx()).slice() : await blank());
  },

  // A Letter page is 816 px plus folio's vertical ruler and margins: on a
  // narrower stage, folio's own zoom shrinks the page to fit (never above 100%).
  fit(width: number) {
    const z = Math.max(0.3, Math.min(1, Math.floor(((width - 72) / 816) * 100) / 100));
    if (Math.abs(z - fitZoom) < 0.01) return;
    fitZoom = z;
    handle?.setZoom?.(z);
  },

  async load(bytes: Uint8Array) {
    await open(bytes.slice());
  },

  async getMarkdown() {
    return handle ? docxToMarkdown(await exportBytes()) : "";
  },

  async applyMarkdown(markdown: string) {
    await open(await markdownToDocx(markdown));
  },

  exportDocx: () => exportBytes(),

  undo: () => historyKey(false),
  redo: () => historyKey(true),
});
