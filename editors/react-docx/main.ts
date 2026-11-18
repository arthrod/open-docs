/**
 * react-docx (Extend): a paginated .docx viewer and editor on a Rust/WASM parser.
 *
 * Its framework-free entry (`/vanilla`, Preact inside) is used:
 *   createDocxViewer(element, { file, mode })      mount
 *   viewer.setOptions({ file })                    open other bytes
 *   viewer.getController()                         state and commands:
 *     hasDocument, isLoading, error, getDocxBytes(), undo(), redo()
 *
 * The controller has no command that replaces the whole document from HTML or Markdown, so
 * an assistant edit opens a new .docx built from the Markdown. That is not a step of its
 * history, and the assistant offers no Undo here.
 */
import { createDocxViewer } from "@extend-ai/react-docx/vanilla";
import { waitFor } from "/lib/kit.ts";
import { REVISION_NOTES } from "/lib/revision-notes.ts";
import { markdownToDocx } from "/lib/plate-docx.ts";
import { docxToMarkdown } from "/lib/docx-markdown.ts";

type Controller = {
  hasDocument: boolean;
  isLoading: boolean;
  error: unknown;
  getDocxBytes(): Promise<ArrayBuffer>;
  trackedChanges?: unknown[];
  comments?: unknown[];
  setShowTrackedChanges(on: boolean): void;
  setShowComments(on: boolean): void;
  undo(): void;
  redo(): void;
};
type Viewer = { getController(): Controller | null; setOptions(o: Record<string, unknown>): void };

let viewer: Viewer | undefined;
// Exposed for the probes in /lib/probes (read-only use).
(window as unknown as { __reactDocx?: () => Viewer | undefined }).__reactDocx = () => viewer;

/** Wait until the viewer shows a document. `reopened`: wait for a load that starts now
 * (the controller goes through "loading" again; its load counter restarts on every load,
 * so it cannot tell two loads apart). */
async function shown(reopened: boolean, what: string): Promise<Controller> {
  const t0 = performance.now();
  let sawLoading = !reopened;
  while (performance.now() - t0 < 60_000) {
    const c = viewer?.getController();
    if (c?.error) throw new Error(`react-docx could not ${what}: ${(c.error as Error)?.message ?? c.error}`);
    if (c && (c.isLoading || !c.hasDocument)) sawLoading = true;
    if (c?.hasDocument && !c.isLoading && sawLoading) {
      // Its review marks and margin cards are off by default. A document that has tracked
      // changes or comments is shown with them, as the other engines show theirs.
      if (c.trackedChanges?.length) c.setShowTrackedChanges(true);
      if (c.comments?.length) c.setShowComments(true);
      return c;
    }
    await new Promise((r) => setTimeout(r, 10));
  }
  // The document may have arrived during the last wait.
  const last = viewer?.getController();
  if (last?.hasDocument && !last.isLoading && sawLoading) return last;
  throw new Error(`react-docx did not ${what} within 60 s`);
}

async function open(bytes: Uint8Array, what: string) {
  if (!viewer) throw new Error("react-docx not mounted");
  viewer.setOptions({ file: bytes.slice().buffer, fileName: "document.docx" });
  await shown(true, what);
}

const controller = () => {
  const c = viewer?.getController();
  if (!c?.hasDocument) throw new Error("react-docx has no document");
  return c;
};

window.od.register({
  name: "react-docx",
  revisions: REVISION_NOTES["react-docx"],
  applyInHistory: false,
  mergeQuality: "rebuild",
  // Its reader runs in a Worker, whose downloads this page's Resource Timing does not list.
  extraResources: ["docx-import-worker.js", "docx_wasm_bg.wasm"].map((f) => new URL(f, import.meta.resolve("@extend-ai/react-docx/vanilla")).href),

  async mount() {
    const root = await waitFor<HTMLDivElement>("#rd-root");
    const v = window.od.viewer;
    const bytes = v ? await v.initialDocx() : await window.od.blankDocx();
    viewer = createDocxViewer(root, {
      file: bytes.slice().buffer,
      fileName: "document.docx",
      mode: v ? "read-only" : "edit",
    }) as Viewer;
    await shown(false, "open the first document");
  },

  load: (bytes: Uint8Array) => open(bytes, "open the document"),

  // No Markdown export on the controller: read the .docx it writes.
  getMarkdown: async () => docxToMarkdown(new Uint8Array(await controller().getDocxBytes())),

  async applyMarkdown(markdown: string) {
    await open(await markdownToDocx(markdown), "open the edited document");
  },

  exportDocx: async () => new Uint8Array(await controller().getDocxBytes()),

  undo: () => controller().undo(),
  redo: () => controller().redo(),
});
