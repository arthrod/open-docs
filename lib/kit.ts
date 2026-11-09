/**
 * The contract between `lib/boot.ts` (kit), `lib/ui.ts` (chrome) and
 * `editors/<slug>/main.ts` (one adapter).
 *
 * An adapter is small on purpose: mount a document, apply an agent edit, report
 * markdown, and — when the library can — move real .docx bytes in and out.
 */

/** What an editor exposes to the shared chrome. */
export interface EditorAdapter {
  /** Human label for logs, e.g. "SuperDoc". */
  name: string;
  /**
   * Mount the editor on a NEW BLANK document (the editor's own empty document,
   * or `blankDocx()` when it has none). Import is `load()`, not mount.
   */
  mount(): Promise<void>;
  /** Load real .docx bytes. The chrome's Import button calls this. */
  load(bytes: Uint8Array): Promise<void>;
  /** Current document as markdown (agent prompt + fallback export). */
  getMarkdown(): Promise<string>;
  /**
   * Replace the document from markdown, through the editor's own model where
   * possible so the user can undo it.
   */
  applyMarkdown(markdown: string): Promise<void>;
  /** Current document as real .docx bytes. Omit to use POST /api/export. */
  exportDocx?(): Promise<Uint8Array>;
  /** Human note about how faithful `applyMarkdown` is. */
  mergeQuality?: "native" | "html-paste" | "rebuild";
  /**
   * URLs the editor loads where the page's Resource Timing can't see them
   * (e.g. inside a Web Worker), so the "loaded" metric still counts them.
   */
  extraResources?: string[];
  /**
   * The editor area changed size (window resize, phone rotation, assistant
   * opened or closed): fit the page to `width` CSS pixels with the editor's
   * own zoom. Omit when the editor already follows its container.
   */
  fit?(width: number, height: number): void;
  /**
   * A view-only, proprietary viewer (not an editor): the chrome hides the
   * assistant, New and Export. getMarkdown/applyMarkdown are never called.
   */
  viewOnly?: boolean;
  /**
   * Open a document this site serves (a path such as "/api/showcase.docx").
   * Viewers that fetch documents themselves (Office Online, Google) need a
   * URL rather than bytes.
   */
  loadUrl?(path: string): Promise<void>;
  /** false: can't open the user's own files (only public links). */
  acceptsFiles?: boolean;
}

/** Exposed globals both the chrome and the adapters read. */
export interface KitGlobal {
  adapter?: EditorAdapter;
  /** Called by an adapter at module top level. */
  register(adapter: EditorAdapter): void;
  /** performance.now() when the adapter registered (its module finished evaluating). */
  registeredAt?: number;
  /** Update the loading overlay's detail line while mount() runs. */
  progress(detail: string): void;
  /** Called by the chrome once. Replays anything already registered. */
  onAdapter(fn: (adapter: EditorAdapter) => void): void;
  md: typeof import("./md.ts");
  /** A valid, empty .docx (one empty paragraph). */
  blankDocx(): Promise<Uint8Array>;
  /** The shared fixture .docx. */
  sampleDocx(): Promise<Uint8Array>;
  /** The shared fixture, as markdown. */
  sampleMarkdown(): Promise<string>;
  download(bytes: Uint8Array, filename: string): void;
  status(msg: string, kind?: "ok" | "err" | ""): void;
  log(role: "user" | "agent", text: string): void;
  bytesToBase64(bytes: Uint8Array): string;
  base64ToBytes(b64: string): Uint8Array;
}

declare global {
  interface Window {
    od: KitGlobal;
  }
}

export function b64encode(bytes: Uint8Array): string {
  let out = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    out += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(out);
}

export function b64decode(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Wait for a DOM node the shell has already rendered. */
export function waitFor<T extends Element>(
  selector: string,
  timeoutMs = 15_000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const found = document.querySelector<T>(selector);
    if (found) return resolve(found);
    const start = Date.now();
    const iv = setInterval(() => {
      const el = document.querySelector<T>(selector);
      if (el) {
        clearInterval(iv);
        resolve(el);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(iv);
        reject(new Error(`Timed out waiting for ${selector}`));
      }
    }, 50);
  });
}

/** Human-readable failure, for the stage (not the one-line status strip). */
export function showError(el: Element, err: unknown) {
  const e = err as Error;
  el.innerHTML = "";
  const box = document.createElement("div");
  box.style.cssText =
    "padding:24px;font:13px/1.6 ui-monospace,monospace;color:#7f1d1d;background:#fef2f2;border-radius:8px;white-space:pre-wrap;word-break:break-word";
  box.textContent = `${e?.name ?? "Error"}: ${e?.message ?? String(err)}\n\n${
    e?.stack ?? ""
  }`;
  el.append(box);
  console.error("[open-docs]", err);
}
