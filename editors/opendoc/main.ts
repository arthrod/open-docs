/**
 * OpenDoc (CasualOffice): a Rust engine in WebAssembly that lays out and paints the document
 * itself, with its own editor application around it.
 *
 * The application is published as a website, not on npm (the npm package is only a frame
 * mount). It runs here in a same-origin frame from a dated snapshot (server/site-mirror.ts),
 * and is driven through the session it puts on its window:
 *   frame.contentWindow.opendoc.execute("edit.undo" | "edit.redo" | "file.export.docx" | …)
 *
 * Its host contract (0.1.0-alpha) has no way to hand it a document or to get one back: it
 * opens files from its own file input and exports by download. So this adapter
 *   - opens bytes by putting a File on that input, as a user would, and
 *   - reads the .docx by catching the Blob its export hands to the download, without downloading.
 * Both lean on the application's internals and can break with a new snapshot.
 *
 * An assistant edit opens a newly built .docx (not a step of its history, so no Undo is offered).
 */
import { waitFor } from "/lib/kit.ts";
import { REVISION_NOTES } from "/lib/revision-notes.ts";
import { markdownToDocx } from "/lib/plate-docx.ts";
import { docxToMarkdown } from "/lib/docx-markdown.ts";

const APP = `${window.od.vendorRoot ?? ""}/vendor/opendoc/2026-11-05/editor.html`;

type Result = { ok: boolean; refusal?: { code: string; message?: string } };
type Session = { execute(command: string, args?: unknown[]): Promise<Result> };
type FrameWindow = Window & typeof globalThis & { opendoc?: Session };

let frame: HTMLIFrameElement | undefined;
const win = () => frame!.contentWindow as FrameWindow;
const session = () => {
  const s = frame && win().opendoc;
  if (!s) throw new Error("OpenDoc not mounted");
  return s;
};

async function until(test: () => boolean, what: string, ms = 60_000) {
  const t0 = performance.now();
  while (!test()) {
    if (performance.now() - t0 > ms) throw new Error(`OpenDoc did not ${what} within ${ms / 1000} s`);
    await new Promise((r) => setTimeout(r, 30));
  }
}

const pages = () => [...frame!.contentDocument!.querySelectorAll("#pages .page-wrap canvas")];

async function open(bytes: Uint8Array) {
  const w = win(), d = frame!.contentDocument!;
  const input = d.getElementById("file") as HTMLInputElement | null;
  if (!input) throw new Error("OpenDoc's file input is gone (its application changed)");
  // The pages of the document being replaced are marked, to see the new ones arrive.
  for (const c of pages()) c.setAttribute("data-od-old", "");
  const transfer = new w.DataTransfer();
  transfer.items.add(new w.File([bytes.slice()], "document.docx"));
  input.files = transfer.files;
  input.dispatchEvent(new w.Event("change", { bubbles: true }));
  await until(() => {
    // After an edit it asks "Discard unsaved changes?" before replacing the document. The
    // replacement was asked for here, so its own "Discard and open" button is pressed.
    const dialog = d.getElementById("confirmDialog");
    if (dialog && !dialog.hidden) d.getElementById("confirmAccept")?.click();
    return pages().some((c) => !c.hasAttribute("data-od-old")) && d.body.classList.contains("doc-loaded");
  }, "show the document");
}

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
let exporting: Promise<unknown> = Promise.resolve();
/** One export at a time: the catch below is on the frame's globals, and two would undo each other. */
function exported(): Promise<Uint8Array> {
  const next = exporting.then(exportOnce, exportOnce);
  exporting = next.catch(() => undefined);
  return next;
}

/** The .docx its own exporter writes, caught on the way to the download. */
async function exportOnce(): Promise<Uint8Array> {
  const w = win();
  const make = w.URL.createObjectURL, click = w.HTMLAnchorElement.prototype.click;
  let blob: Blob | undefined;
  w.URL.createObjectURL = (b: Blob | MediaSource) => {
    if (b instanceof w.Blob && b.type === DOCX) blob = b;
    return make.call(w.URL, b);
  };
  w.HTMLAnchorElement.prototype.click = function () {}; // no file lands in the visitor's downloads
  try {
    const result = await session().execute("file.export.docx");
    if (!result.ok) throw new Error(`OpenDoc refused to export: ${result.refusal?.message ?? result.refusal?.code}`);
    await until(() => !!blob, "hand over the exported file", 20_000);
  } finally {
    w.URL.createObjectURL = make;
    w.HTMLAnchorElement.prototype.click = click;
  }
  return new Uint8Array(await blob!.arrayBuffer());
}

const run = async (command: string) => {
  const r = await session().execute(command);
  // "unavailable" is an empty history, not a failure.
  if (!r.ok && r.refusal?.code !== "unavailable") throw new Error(`OpenDoc refused ${command}: ${r.refusal?.message ?? r.refusal?.code}`);
};

window.od.register({
  name: "OpenDoc",
  revisions: REVISION_NOTES["opendoc"],
  applyInHistory: false,
  mergeQuality: "rebuild",
  // The application's files load inside the frame, where this page's Resource Timing cannot see them.
  get extraResources() {
    try {
      return (win().performance.getEntriesByType("resource") as PerformanceResourceTiming[]).map((e) => e.name);
    } catch {
      return [];
    }
  },

  async mount() {
    const root = await waitFor<HTMLDivElement>("#opendoc-root");
    frame = document.createElement("iframe");
    frame.title = "OpenDoc";
    frame.style.cssText = "flex:1;min-width:0;border:0";
    // `od-at` tells the mirror which site shows the page (it builds the engine's address with it).
    frame.src = `${APP}?blank=1&od-at=${encodeURIComponent(location.origin + (window.od.vendorRoot ?? ""))}`;
    root.append(frame);
    // Its file input is there before its engine is: the engine (28 MB of WebAssembly) marks the
    // page "engine-ready" when it can take a document, and "engine-failed" when it cannot start.
    // A file handed over earlier is lost in an error of its own (seen on a slower machine,
    // 2026-11-18: nine starts out of nine).
    await until(() => {
      try {
        const html = frame!.contentDocument!.documentElement;
        if (html.classList.contains("engine-failed")) throw new Error("OpenDoc's engine failed to start");
        return !!win().opendoc && !!frame!.contentDocument!.getElementById("file") && html.classList.contains("engine-ready");
      } catch (err) {
        if (err instanceof Error && err.message.startsWith("OpenDoc's engine")) throw err;
        return false;
      }
    }, "start", 120_000);
    // Its own blank start is an empty "drop a file" screen, so it is given a blank document.
    const v = window.od.viewer;
    await open(v ? await v.initialDocx() : await window.od.blankDocx());
    if (v) await run("review.mode.viewing");
  },

  load: (bytes: Uint8Array) => open(bytes),
  getMarkdown: async () => docxToMarkdown(await exported()),
  applyMarkdown: async (markdown: string) => open(await markdownToDocx(markdown)),
  exportDocx: () => exported(),
  undo: () => run("edit.undo"),
  redo: () => run("edit.redo"),
});
