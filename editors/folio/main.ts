/**
 * folio — ProseMirror + paginated layout, Vue-packaged headless mount.
 *
 * VERIFIED surface (from the published bundle): `renderAsync(input, container,
 * options)` resolves to a handle with `save()`, `getDocument()`, `destroy()`.
 * The module also exports `toMarkdown`.
 */
import { waitFor } from "/lib/kit.ts";

// DO NOT pass ?external= here.
//
// Every specifier in the external list is emitted as a *bare* import
// (`import{vue}from"vue"`), and the browser cannot resolve bare specifiers —
// that is the "bare specifier 'vue' was not remapped" error. Plain `?bundle`
// is worse: it leaks `node:buffer`, `node:stream`, … which fail outright.
//
// `?bundle&target=es2022` is the one variant measured with ZERO bare
// specifiers (4.27 MB): everything, including Vue and ProseMirror, is inlined
// and rewritten to absolute esm.sh URLs.
const CDN = "https://esm.sh/@stll/folio-vue@0.28.0?bundle&target=es2022";

type Handle = {
  save(): Promise<Blob | null>;
  getDocument(): any;
  destroy?(): void;
  focus?(): void;
};

let mod: any;
let handle: Handle | undefined;
let host: HTMLElement | undefined;

async function folio() {
  if (!mod) mod = await import(CDN);
  return mod;
}

/** Mount `bytes` into the host. Used by both mount() and load(). */
async function open(bytes: Uint8Array): Promise<void> {
  if (!host) throw new Error("folio host missing");
  const api = await folio();
  if (typeof api.renderAsync !== "function") {
    throw new Error("folio bundle has no renderAsync()");
  }
  try {
    handle?.destroy?.();
  } catch { /* ignore */ }
  handle = undefined;
  host.innerHTML = "";

  handle = await api.renderAsync(bytes, host, {
    showToolbar: true,
    showZoomControl: true,
    showReviewControls: true,
    author: "open-docs",
  }) as Handle;
}

/** Sniff the container/docx so folio never receives obvious garbage. */
function looksZipped(b: Uint8Array) {
  return b.length > 4 && b[0] === 0x50 && b[1] === 0x4b;
}

window.od.register({
  name: "folio",
  mergeQuality: "rebuild",

  async mount() {
    host = await waitFor<HTMLDivElement>("#folio-root");
    window.od.status("Loading folio (4 MB)…");
    const blank = await window.od.blankDocx();
    if (!looksZipped(blank)) {
      throw new Error("blankDocx() did not produce a zip container");
    }
    await open(blank);
    window.od.status("folio ready", "ok");
  },

  async load(bytes: Uint8Array) {
    await open(bytes);
  },

  async getMarkdown() {
    const api = await folio();
    if (!handle) return "";
    const doc = handle.getDocument?.();
    if (!doc) return "";
    if (typeof api.toMarkdown === "function") return api.toMarkdown(doc);
    return "";
  },

  async applyMarkdown(markdown) {
    // No stable markdown → document path in this build, so build real .docx and
    // reopen. `mergeQuality: "rebuild"` tells the UI this replaces the file.
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ markdown, title: "folio" }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "export failed");
    await open(window.od.base64ToBytes(json.base64));
  },

  async exportDocx() {
    if (!handle) throw new Error("folio not mounted");
    const blob = await handle.save();
    if (!blob) throw new Error("folio returned no document");
    return new Uint8Array(await blob.arrayBuffer());
  },
});
