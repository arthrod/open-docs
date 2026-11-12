/**
 * WordCraft adapter.
 *
 * WordCraft is a Rust word processor (storytold/wordcraft); its release ships a
 * wasm build whose whole UI — ribbon, page, dialogs — is drawn into one canvas.
 * The page talks to it through its "same-document host mode" (HOSTING.md):
 *
 *   page → app   `wordcraft:open` {name, bytes}: open like File › Open; the
 *                extension picks the reader (.docx, .md, .odt, .rtf, .html…)
 *   app → page   `wordcraft:save` {name, saveAs, bytes}: every file the app
 *                would otherwise download
 *   app → page   `wordcraft:ready` / `wordcraft:failed`
 *
 * v0.17.0 exposes window.wordcraft: assistant edits select the whole story
 * and paste HTML in one native history command. Undo/redo use that API too.
 * Export still uses host-mode F12 / Save As to obtain WordCraft's own .docx;
 * getMarkdown reads that file through lib/docx-markdown.ts. WordCraft's
 * Markdown export is lossy, so it does not replace that route.
 */
import { marked } from "https://esm.sh/marked@18.1.3?target=es2022";
import { waitFor } from "/lib/kit.ts";
import { docxToMarkdown } from "/lib/docx-markdown.ts";

const BASE = "/vendor/wordcraft/0.17.0/";
const GLUE = BASE + "wordcraft-web-d5f8e062bd3e686e.js";
const WASM = BASE + "wordcraft-web-d5f8e062bd3e686e_bg.wasm";

interface WordcraftApi {
  execute(command: string, params?: Record<string, unknown>): Promise<unknown>;
}

declare global {
  interface Window {
    wordcraft: WordcraftApi;
  }
}

let canvas: HTMLCanvasElement;
/** Name WordCraft knows the document by (without extension). */
let docName = "Untitled document";

type Saved = { name: string; saveAs: boolean; bytes: ArrayBuffer };

const frame = () => new Promise((r) => requestAnimationFrame(() => r(undefined)));

/**
 * egui only takes input while its canvas has focus, so while the adapter
 * drives WordCraft (the user may be typing in the assistant box) the canvas
 * holds focus, which goes back where it was afterwards.
 *
 * Operations also run one at a time: WordCraft's save events carry no request
 * id, so two overlapping saves could each take the other's bytes.
 */
let queue: Promise<unknown> = Promise.resolve();

function driving<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const prev = document.activeElement as HTMLElement | null;
    canvas.focus({ preventScroll: true });
    await frame();
    try {
      return await fn();
    } finally {
      if (prev && prev !== canvas && prev !== document.body) prev.focus({ preventScroll: true });
    }
  });
  queue = run.catch(() => undefined);
  return run;
}

/** Open bytes in WordCraft as if the user picked `name` in File › Open. */
function open(name: string, bytes: Uint8Array) {
  canvas.dispatchEvent(new CustomEvent("wordcraft:open", { detail: { name, bytes } }));
}

/** Press a key on WordCraft's canvas (where its own keyboard handling listens). */
function press(init: KeyboardEventInit) {
  for (const type of ["keydown", "keyup"]) {
    canvas.dispatchEvent(new KeyboardEvent(type, { bubbles: false, cancelable: true, ...init }));
  }
}

/** Save As (F12) and resolve with the .docx WordCraft hands back. */
function saveAsDocx(timeoutMs = 15_000): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      canvas.removeEventListener("wordcraft:save", onSave);
      reject(new Error("WordCraft did not save the document (F12 / Save As)"));
    }, timeoutMs);
    const onSave = (e: Event) => {
      const saved = (e as CustomEvent<Saved>).detail;
      if (!/\.docx$/i.test(saved.name)) return;
      clearTimeout(timer);
      canvas.removeEventListener("wordcraft:save", onSave);
      docName = saved.name.replace(/\.docx$/i, "");
      resolve(new Uint8Array(saved.bytes));
    };
    canvas.addEventListener("wordcraft:save", onSave);
    press({ key: "F12", code: "F12" });
  });
}

/** WordCraft reads an opened file on its next frames; give it a moment. */
const settle = () => new Promise((r) => setTimeout(r, 400));

window.od.register({
  name: "WordCraft",
  mergeQuality: "html-paste",
  applyInHistory: true,

  async mount() {
    canvas = await waitFor<HTMLCanvasElement>("#wordcraft_canvas");
    window.od.progress("Loading WordCraft (Rust → WebAssembly, 22 MB compressed)…");
    // Listeners first: WordCraft announces itself while init() is still running.
    const ready = new Promise<void>((resolve, reject) => {
      canvas.addEventListener("wordcraft:ready", () => resolve(), { once: true });
      canvas.addEventListener(
        "wordcraft:failed",
        (e) => reject(new Error((e as CustomEvent).detail?.error ?? "WordCraft couldn't start")),
        { once: true },
      );
    });
    const glue = await import(GLUE);
    // Resolved against this module, not the page: on a view-only page served
    // by another val the .wasm still comes straight from open-docs.
    await glue.default({ module_or_path: new URL(WASM, import.meta.url).href });
    await ready;
    // In host mode WordCraft waits for the page's document: hand it a blank one.
    // View-only pages hand the real document straight in. This adapter does
    // not enable a read-only mode, so there it stays editable.
    const v = window.od.viewer;
    open(`${docName}.docx`, v ? await v.initialDocx() : await window.od.blankDocx());
    await settle();
  },

  load: (bytes) =>
    driving(async () => {
      open(`${docName}.docx`, bytes);
      await settle();
    }),

  applyMarkdown: (markdown) =>
    driving(async () => {
      // Empty input clears the document: select all, paste one empty paragraph
      // (still one undo step) instead of throwing.
      if (!markdown.trim()) {
        await window.wordcraft.execute("select.all", { whole: true });
        await window.wordcraft.execute("edit.paste", { html: "<p></p>", text: "" });
        return;
      }
      // Parse before selecting: conversion failure must not disturb selection.
      const html = await marked.parse(markdown);
      if (new TextEncoder().encode(html).byteLength > 16 * 1024 * 1024) {
        throw new Error("WordCraft HTML paste exceeds its 16 MiB limit");
      }
      // `whole` avoids select-all stopping at a table cell. Explicit text avoids
      // the UI's system clipboard path. Empty text also prevents a matching
      // internal clipboard from overriding our HTML or a raw Markdown fallback.
      await window.wordcraft.execute("select.all", { whole: true });
      await window.wordcraft.execute("edit.paste", { html, text: "" });
    }),

  getMarkdown: () => driving(async () => docxToMarkdown(await saveAsDocx())),

  exportDocx: () => driving(() => saveAsDocx()),

  undo: () => driving(async () => {
    await window.wordcraft.execute("edit.undo");
  }),
  redo: () => driving(async () => {
    await window.wordcraft.execute("edit.redo");
  }),
});
