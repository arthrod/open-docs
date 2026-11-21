/**
 * An engine shown through the editors trial's own demo build of it (server/site-mirror.ts,
 * TRIAL_DEMOS): the project's code, built from the commit the trial measured, in a same-origin
 * frame. The demo's host page opens one document when it loads and offers a Download button,
 * so this adapter
 *   - opens bytes by loading the frame again, which asks this page for the document, and
 *   - reads the .docx by pressing Download and catching the Blob, without downloading.
 * An assistant edit opens a newly built .docx (not a step of the engine's history).
 */
import { type EditorAdapter, waitFor } from "/lib/kit.ts";
import { markdownToDocx } from "/lib/plate-docx.ts";
import { docxToMarkdown } from "/lib/docx-markdown.ts";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export interface DemoFrame {
  /** The mirror's folder name (server/site-mirror.ts) and the id of the root element in the shell. */
  site: string;
  root: string;
  name: string;
  revisions?: string;
  /** True once the demo shows the document it was given. Throws to report the demo's own failure. */
  ready(doc: Document): boolean;
  /** The demo's Download control. */
  download: string;
  /** How long the demo may take to show a document. */
  openMs?: number;
}

type FrameWindow = Window & typeof globalThis;

export function demoFrame(o: DemoFrame): EditorAdapter {
  let frame: HTMLIFrameElement | undefined;
  let current: Uint8Array = new Uint8Array();
  let shown = 0;
  const win = () => frame!.contentWindow as FrameWindow;
  const base = `${window.od.vendorRoot ?? ""}/vendor/${o.site}/et-v0.11.1/index.html`;

  async function until(test: () => boolean, what: string, ms: number) {
    const t0 = performance.now();
    while (!test()) {
      if (performance.now() - t0 > ms) throw new Error(`${o.name} did not ${what} within ${ms / 1000} s`);
      await new Promise((r) => setTimeout(r, 30));
    }
  }

  async function open(bytes: Uint8Array) {
    current = bytes;
    // The demo's page asks its parent for the document (the line the mirror adds to its <head>).
    (window as unknown as { __odDemoDoc: () => Uint8Array }).__odDemoDoc = () => current.slice();
    const mine = ++shown;
    // The navigation itself has a deadline too: a page that never fires `load` would hold every later open.
    const target = frame!;
    await new Promise<void>((resolve, reject) => {
      const onLoad = () => {
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(() => {
        target.removeEventListener("load", onLoad);
        reject(new Error(`${o.name} did not load its demo page within ${(o.openMs ?? 120_000) / 1000} s`));
      }, o.openMs ?? 120_000);
      target.addEventListener("load", onLoad, { once: true });
      target.src = `${base}?n=${mine}`;
    });
    await until(() => {
      if (mine !== shown) return true; // a newer document replaced this one
      const doc = frame!.contentDocument;
      return !!doc && doc.readyState !== "loading" && o.ready(doc);
    }, "show the document", o.openMs ?? 120_000);
  }

  // One at a time, opens and exports alike: an open replaces the frame an export is reading, and an
  // export pressed while a document is still opening presses a control that is not ready.
  let exporting: Promise<unknown> = Promise.resolve();
  function openInTurn(bytes: Uint8Array): Promise<void> {
    const next = exporting.then(() => open(bytes), () => open(bytes));
    exporting = next.catch(() => undefined);
    return next;
  }
  function exported(): Promise<Uint8Array> {
    const next = exporting.then(exportOnce, exportOnce);
    exporting = next.catch(() => undefined);
    return next;
  }
  /** The .docx the demo's own Download writes, caught on the way to the download. */
  async function exportOnce(): Promise<Uint8Array> {
    const w = win(), d = frame!.contentDocument!;
    const button = d.querySelector<HTMLElement>(o.download);
    if (!button) throw new Error(`${o.name}'s Download control is gone (its demo page changed)`);
    const make = w.URL.createObjectURL, click = w.HTMLAnchorElement.prototype.click;
    let blob: Blob | undefined;
    w.URL.createObjectURL = (b: Blob | MediaSource) => {
      if (b instanceof w.Blob) blob = b;
      return make.call(w.URL, b);
    };
    // No file lands in the visitor's downloads; the control itself is still pressed.
    w.HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      if (this === button) click.call(this);
    };
    try {
      // The demo says on its page when its own export failed; the words before the press are not that.
      // A failure with the same words as the last one still rewrites the line, so the rewrite is the signal.
      const status = d.querySelector<HTMLElement>("#status");
      let rewritten = false;
      const watch = new w.MutationObserver(() => rewritten = true);
      if (status) watch.observe(status, { attributes: true, childList: true, characterData: true, subtree: true });
      try {
        button.click();
        await until(() => {
          if (!blob && rewritten && status?.dataset.state === "error") throw new Error(`${o.name}: ${status.textContent}`);
          return !!blob;
        }, "hand over the exported file", 60_000);
        // A demo may press its link a task after it made the address: that press is still swallowed.
        await new Promise((r) => setTimeout(r, 250));
      } finally {
        watch.disconnect();
      }
    } finally {
      w.URL.createObjectURL = make;
      w.HTMLAnchorElement.prototype.click = click;
    }
    return new Uint8Array(await new Blob([blob!], { type: DOCX }).arrayBuffer());
  }

  return {
    name: o.name,
    revisions: o.revisions,
    applyInHistory: false,
    mergeQuality: "rebuild",
    // The demo's files load inside the frame, where this page's Resource Timing cannot see them.
    get extraResources() {
      try {
        return (win().performance.getEntriesByType("resource") as PerformanceResourceTiming[]).map((e) => e.name);
      } catch {
        return [];
      }
    },
    async mount() {
      const root = await waitFor<HTMLDivElement>(`#${o.root}`);
      frame = document.createElement("iframe");
      frame.title = o.name;
      frame.style.cssText = "flex:1;min-width:0;border:0;background:#fff";
      root.append(frame);
      const v = window.od.viewer;
      await open(v ? await v.initialDocx() : await window.od.blankDocx());
    },
    load: (bytes: Uint8Array) => openInTurn(bytes),
    getMarkdown: async () => docxToMarkdown(await exported()),
    applyMarkdown: async (markdown: string) => openInTurn(await markdownToDocx(markdown)),
    exportDocx: () => exported(),
  };
}
