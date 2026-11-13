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
 * The released build (v0.16.0) has no scripting API (`window.wordcraft` lands
 * after it), so saving is driven the way a user does it, with WordCraft's own
 * shortcuts on its canvas: F12 is Save As, which in host mode hands back the
 * document as .docx (the format that keeps everything) and makes it the
 * document's file from then on.
 *
 *   applyMarkdown  WordCraft's own markdown reader (`<title>.md`), then F12 so
 *                  the document is a .docx again
 *   exportDocx     F12 → the .docx WordCraft writes
 *   getMarkdown    that .docx read by lib/docx-markdown.ts (the release can't
 *                  save markdown without its Save As dialog)
 */
import { waitFor } from "/lib/kit.ts";
import { docxToMarkdown } from "/lib/docx-markdown.ts";
import { cachedFetch, WORDCRAFT_BASE, WORDCRAFT_GLUE, WORDCRAFT_WASM } from "./prefetch.ts";

const BASE = WORDCRAFT_BASE;
const GLUE = BASE + WORDCRAFT_GLUE;
const WASM = BASE + WORDCRAFT_WASM;

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
  mergeQuality: "native",

  async mount() {
    canvas = await waitFor<HTMLCanvasElement>("#wordcraft_canvas");
    window.od.progress("Loading WordCraft (Rust → WebAssembly, ~7 MB compressed)…");
    // Listeners first: WordCraft announces itself while init() is still running.
    const ready = new Promise<void>((resolve, reject) => {
      canvas.addEventListener("wordcraft:ready", () => resolve(), { once: true });
      canvas.addEventListener(
        "wordcraft:failed",
        (e) => reject(new Error((e as CustomEvent).detail?.error ?? "WordCraft couldn't start")),
        { once: true },
      );
    });
    try {
      const glue = await import(GLUE);
      const wasmRes = await cachedFetch(new URL(WASM, import.meta.url).href);
      await glue.default({ module_or_path: wasmRes });
      await ready;
    } finally {
      document.getElementById("wc-skeleton")?.classList.add("wc-done");
    }
    // In host mode WordCraft waits for the page's document: hand it a blank one.
    // View-only pages hand the real document straight in.
    const v = window.od.viewer;
    open(`${docName}.docx`, v ? await v.initialDocx() : await window.od.blankDocx());
    await settle();
  },

  load: (bytes) =>
    driving(async () => {
      const api = (window as unknown as { wordcraft?: { loadDocx?: (b: Uint8Array) => Promise<unknown> } }).wordcraft;
      if (api?.loadDocx) {
        await api.loadDocx(bytes);
        return;
      }
      open(`${docName}.docx`, bytes);
      await settle();
    }),

  applyMarkdown: (markdown) =>
    driving(async () => {
      const api = (window as unknown as { wordcraft?: { applyMarkdown?: (m: string) => Promise<unknown> } }).wordcraft;
      if (api?.applyMarkdown) {
        await api.applyMarkdown(markdown);
        return;
      }
      open(`${docName}.md`, new TextEncoder().encode(markdown));
      await settle();
      // Back to a .docx-backed document, so Save keeps writing Word files.
      await saveAsDocx();
    }),

  getMarkdown: () =>
    driving(async () => {
      const api = (window as unknown as { wordcraft?: { getMarkdown?: () => Promise<string> } }).wordcraft;
      if (api?.getMarkdown) {
        return await api.getMarkdown();
      }
      return docxToMarkdown(await saveAsDocx());
    }),

  exportDocx: () =>
    driving(async () => {
      const api = (window as unknown as { wordcraft?: { exportDocx?: () => Promise<Uint8Array> } }).wordcraft;
      if (api?.exportDocx) {
        return await api.exportDocx();
      }
      return saveAsDocx();
    }),
});
