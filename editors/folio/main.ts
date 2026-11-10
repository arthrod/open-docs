/**
 * folio — ProseMirror + paginated layout, Vue-packaged imperative mount.
 *
 * Verified against @stll/folio-vue@0.28.0's typings:
 *   renderAsync(DocxInput, container, options) → { save(), getDocument(), focus(), destroy() }
 *   createEmptyDocument(), fromMarkdown(md) → Document, toMarkdown(Document)
 *   createDocx(Document) → ArrayBuffer
 *
 * Assistant Markdown goes through folio's own fromMarkdown + toProseDoc and
 * lands as one transaction in the mounted editor's history. Readback uses its
 * DOCX export.
 */
import { waitFor } from "/lib/kit.ts";
import { docxToMarkdown } from "/lib/docx-markdown.ts";

// DO NOT pass ?external=: esm.sh leaves every external as a bare import the
// browser can't resolve. `?bundle&target=es2022` inlines Vue + ProseMirror and
// has zero bare specifiers.
const CDN = "https://esm.sh/@stll/folio-vue@0.28.0?bundle&target=es2022";
// folio-vue 0.28.0 depends on folio-core ^0.68.0 but does not re-export
// toProseDoc; the converter subpath is loaded on the first assistant apply.
const CORE_CONVERSION =
  "https://esm.sh/@stll/folio-core@0.68.0/prosemirror/conversion?bundle&target=es2022";

type Handle = {
  save(): Promise<Blob | null>;
  getDocument(): unknown;
  destroy?(): void;
  setZoom?(zoom: number): void;
  focus?(): void;
};

type FolioView = {
  dom: HTMLElement;
  focus(): void;
  state: any;
  dispatch(tr: unknown): void;
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
    onEditorViewReady: (v: FolioView | null) => {
      pmView = v ?? undefined;
    },
  }) as Handle;
}

/** folio's ProseMirror view: its own keymap binds Mod-Z / Mod-Shift-Z to its history. */
let pmView: FolioView | undefined;
// Exposed for the probes in /lib/probes (read-only use).
(window as any).__folio = () => ({ api, handle, view: pmView });
const MOD: KeyboardEventInit = /Mac/.test(navigator.platform)
  ? { metaKey: true }
  : { ctrlKey: true };
function historyKey(shiftKey: boolean) {
  // folio's keymap expects lowercase z, including its Mod-Shift-z redo binding.
  pmView?.dom.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "z",
      code: "KeyZ",
      shiftKey,
      bubbles: true,
      cancelable: true,
      ...MOD,
    }),
  );
}

async function blank(): Promise<ArrayBuffer> {
  const f = await folio();
  if (
    typeof f.createEmptyDocument === "function" &&
    typeof f.createDocx === "function"
  ) {
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
  // fromMarkdown → toProseDoc → one replaceWith transaction: one history step.
  applyInHistory: true,
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
    const z = Math.max(
      0.3,
      Math.min(1, Math.floor(((width - 72) / 816) * 100) / 100),
    );
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
    const view = pmView;
    if (!view) throw new Error("folio pm view missing");
    const [f, { toProseDoc }] = await Promise.all([folio(), import(CORE_CONVERSION)]);
    // folio's own Markdown compiler → its own Document → ProseMirror converter
    // (styles, numbering, quote style, code font). The node comes from a
    // separately loaded folio-core, so it is re-read through the mounted
    // view's schema before the one replacing transaction.
    const content = view.state.schema.nodeFromJSON(
      toProseDoc(f.fromMarkdown(markdown)).toJSON(),
    ).content;
    view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, content));
  },

  exportDocx: () => exportBytes(),

  undo: () => historyKey(false),
  redo: () => historyKey(true),
});
