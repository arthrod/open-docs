/**
 * Apryse WebViewer 12 — a commercial SDK that renders DOCX natively in the
 * browser (its office engine is WebAssembly in a worker). Loaded from
 * jsDelivr's copy of the npm package with NO license key, which Apryse
 * documents as demo mode: everything works, pages carry an "Apryse"
 * watermark. Shown here view-only, for comparison with the open-source
 * editors (WebViewer can also edit DOCX with a license; not exercised here).
 */
import { waitFor } from "/lib/kit.ts";

const VERSION = "12.2.1";
const BASE = `https://cdn.jsdelivr.net/npm/@pdftron/webviewer@${VERSION}`;

// Fetched by WebViewer's office worker, where Resource Timing can't see them.
// Listed from a recorded load of the showcase (Playwright, 2026-11-09).
const WORKER_FILES = [
  "public/core/CORSWorker.js",
  "public/core/external/Promise.js",
  "public/core/external/decode.min.js",
  "public/core/office/OfficeWorker.js",
  "public/core/office/WebOfficeWorkerWasm.br.js.mem",
  "public/core/office/WebOfficeWorkerWasm.br.wasm",
  "public/core/pdf/PDFNetLean.js",
].map((f) => `${BASE}/${f}`);

// deno-lint-ignore no-explicit-any
let instance: any;

function script(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`could not load ${src}`));
    document.head.append(s);
  });
}

/**
 * Fit the page to the width with WebViewer's own fit mode, but never past
 * 100% — the same rule as the editors, so a wide window doesn't blow it up.
 */
function fitWidth() {
  instance.UI.setFitMode?.(instance.UI.FitMode.FitWidth);
  if (instance.UI.getZoomLevel?.() > 1) instance.UI.setZoomLevel(1);
}

let gen = 0;
let cancelPrevious: (() => void) | undefined;

/**
 * Load a document and resolve once WebViewer says it has rendered. Every exit
 * (rendered, load error, timeout, superseded by a newer open) removes this
 * open's listeners, so a later document can't fire an old open's callbacks.
 */
function open(doc: string | Blob, filename: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const mine = ++gen;
    const dv = instance.Core.documentViewer;
    const finish = (err?: Error) => {
      clearTimeout(timer);
      dv.removeEventListener("documentLoaded", onLoaded);
      instance.UI.removeEventListener("loaderror", onError);
      if (cancelPrevious === cancel) cancelPrevious = undefined;
      err ? reject(err) : resolve();
    };
    const onLoaded = () => {
      if (mine !== gen) return;
      fitWidth();
      finish();
    };
    const onError = (e: unknown) => {
      if (mine !== gen) return;
      const detail = (e as { detail?: unknown })?.detail;
      finish(new Error(`Apryse could not open the document (${String(detail ?? e)})`));
    };
    // Superseded: the newer document is what the user asked for; end quietly.
    const cancel = () => finish();
    const timer = setTimeout(() => finish(new Error("Apryse did not render the document within 90s")), 90_000);
    cancelPrevious?.();
    cancelPrevious = cancel;
    dv.addEventListener("documentLoaded", onLoaded);
    instance.UI.addEventListener("loaderror", onError);
    instance.UI.loadDocument(doc, { extension: "docx", filename });
  });
}

/**
 * View-only for real, not just in our chrome: WebViewer's read-only mode (no
 * annotation edits) and only its View ribbon — the Annotate / Shapes / Insert
 * / Edit / Fill and Sign / Forms ribbons go.
 */
function makeReadOnly() {
  instance.Core.annotationManager.enableReadOnlyMode?.();
  const F = instance.UI.Feature ?? {};
  const features = ["Annotations", "Ribbons", "Forms", "ContentEdit", "MultiTab", "NotesPanel", "FilePicker", "Print", "Download"]
    .map((k) => F[k]).filter(Boolean);
  if (features.length) instance.UI.disableFeatures(features);
}

window.od.register({
  name: "Apryse WebViewer",
  viewOnly: true,
  extraResources: WORKER_FILES,

  async mount() {
    const host = await waitFor<HTMLDivElement>("#apryse-host");
    window.od.progress("Loading Apryse WebViewer (demo mode, no key)…");
    await script(`${BASE}/webviewer.min.js`);
    // deno-lint-ignore no-explicit-any
    instance = await (window as any).WebViewer({ path: `${BASE}/public` }, host);
    makeReadOnly();
    const v = window.od.viewer;
    if (v) await open(new Blob([(await v.initialDocx()).slice()]), "document.docx");
    else await open(`${location.origin}/api/showcase.docx`, "showcase.docx");
  },

  load: (bytes) => open(new Blob([bytes.slice()]), "document.docx"),
  loadUrl: (path) => open(`${location.origin}${path}`, path.split("/").pop() ?? "document.docx"),

  fit() {
    if (instance) fitWidth();
  },

  getMarkdown: () => Promise.reject(new Error("Apryse WebViewer is view-only here")),
  applyMarkdown: () => Promise.reject(new Error("Apryse WebViewer is view-only here")),
});
