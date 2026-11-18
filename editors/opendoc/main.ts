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
  await until(() => pages().some((c) => !c.hasAttribute("data-od-old")) && d.body.classList.contains("doc-loaded"), "show the document");
}

/** The .docx its own exporter writes, caught on the way to the download. */
async function exported(): Promise<Uint8Array> {
  const w = win();
  const make = w.URL.createObjectURL, click = w.HTMLAnchorElement.prototype.click;
  let blob: Blob | undefined;
  w.URL.createObjectURL = (b: Blob | MediaSource) => {
    if (b instanceof w.Blob) blob = b;
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
    frame.src = `${APP}?blank=1`;
    root.append(frame);
    await until(() => {
      try {
        return !!win().opendoc && !!frame!.contentDocument!.getElementById("file");
      } catch {
        return false;
      }
    }, "start");
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
