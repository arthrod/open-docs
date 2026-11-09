/**
 * SuperDoc — Vue + its own DOCX engine (WASM-free, runs in a Web Worker). AGPL-3.0.
 *
 * Loaded from its CDN build (see assets.ts for why). Documents are swapped in
 * place with `replaceDocument()`; the assistant writes through the editor's
 * document API (`doc.insert({ type: "markdown" })`) so the change lands in
 * SuperDoc's own undo history. Markdown read back comes from SuperDoc's .docx
 * export (its markdown export writes lists as HTML).
 */
import { waitFor } from "/lib/kit.ts";
import { SUPERDOC_ENGINE } from "./assets.ts";
import { markdownToBlocks } from "/lib/markdown.ts";
import { docxToMarkdown } from "/lib/docx-markdown.ts";

// `?debug` logs every worker message — SuperDoc's engine fails silently.
if (location.search.includes("debug")) {
  const Native = window.Worker;
  (window as any).Worker = function (url: string | URL, opts?: WorkerOptions) {
    const w = new Native(url, opts);
    const name = opts?.name ?? String(url).slice(-48);
    const tag = (d: any) => String(d?.type ?? d?.kind ?? "") + (d?.payload?.kind ? `/${d.payload.kind}` : "") + (d?.method ? `/${d.method}` : "");
    console.debug("[sd-worker] new", name);
    w.addEventListener("message", (m) => console.debug("[sd-worker]", name, "<-", tag(m.data), JSON.stringify(m.data)?.slice(0, 300)));
    w.addEventListener("error", (e) => console.debug("[sd-worker]", name, "ERROR", e.message));
    const post = w.postMessage.bind(w);
    w.postMessage = ((d: any, t?: any) => (console.debug("[sd-worker]", name, "->", tag(d)), post(d, t))) as any;
    return w;
  };
}

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

let instance: any;

async function exportBytes(): Promise<Uint8Array> {
  if (!instance) throw new Error("SuperDoc not mounted");
  const blob: Blob = await instance.export({ exportType: ["docx"], triggerDownload: false });
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * What SuperDoc 2.29's markdown importer leaves undone, finished with its own
 * document API (so it stays in the same undo history):
 *  - block quotes arrive as plain paragraphs (the HTML importer does the same):
 *    give them Word's Quote style, creating it if the document lacks one;
 *  - the insert lands after the cleared document's empty paragraph: drop it.
 */
async function finishImport(ed: any, markdown: string) {
  const norm = (s: string) => s.replace(/\s+/g, " ").trim();
  const quotes = markdownToBlocks(markdown)
    .filter((b) => b.kind === "quote")
    .map((b) => norm(b.runs.map((r) => r.text).join("")))
    .filter(Boolean);
  let { blocks } = await ed.doc.blocks.list({});
  const first = blocks[0];
  if (first?.isEmpty && blocks.length > 1 && first.nodeType === "paragraph") {
    await ed.doc.blocks.delete({ target: { kind: "block", nodeType: first.nodeType, nodeId: first.nodeId } });
    blocks = blocks.slice(1);
  }
  if (!quotes.length) return;
  // conflictPolicy "fail" leaves an existing Quote style alone.
  await ed.doc.styles.create({
    type: "paragraph", id: "Quote", name: "Quote", basedOn: "Normal", next: "Normal", qFormat: true, priority: 29,
    conflictPolicy: "fail",
    paragraph: { indent: { left: 864, right: 864 }, justification: "center" },
    run: { italic: true, color: { val: "404040" } },
  }).catch(() => undefined);
  // Match quote paragraphs in document order (previews may be truncated).
  let from = 0;
  for (const q of quotes) {
    const i = blocks.findIndex((b: any, k: number) =>
      k >= from && b.nodeType === "paragraph" && b.textPreview && q.startsWith(norm(b.textPreview).replace(/…$/, ""))
    );
    if (i < 0) continue;
    from = i + 1;
    await ed.doc.styles.paragraph.setStyle({
      target: { kind: "block", nodeType: blocks[i].nodeType, nodeId: blocks[i].nodeId },
      styleId: "Quote",
    });
  }
}

function toFile(bytes: Uint8Array, name = "document.docx"): File {
  return new File([bytes.slice(0)], name, { type: DOCX_MIME });
}

async function superdocGlobal(): Promise<any> {
  // The classic <script defer> in <head> defines window.SuperDoc.
  for (let i = 0; i < 400; i++) {
    const g = (window as any).SuperDoc;
    if (g) return g.SuperDoc ?? g;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error("SuperDoc's CDN script did not define window.SuperDoc");
}

// Exposed for the test probes in /lib/probes (read-only use).
(window as any).__superdoc = () => instance;

function editor(): any {
  return instance?.activeEditor;
}

/** Wait until SuperDoc says the document is open (or reports why not). */
function create(SuperDoc: any, bytes: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("SuperDoc did not become ready within 60s")), 60_000);
    instance = new SuperDoc({
      selector: "#sd-editor",
      toolbar: "#sd-toolbar",
      document: toFile(bytes, "Untitled.docx"),
      documentMode: "editing",
      rulers: true,
      user: { name: "open-docs", email: "editor@open-docs.local" },
      telemetry: { enabled: false },
      onReady: () => {
        clearTimeout(timer);
        resolve();
      },
      onException: ({ error }: { error: Error }) => {
        console.error("[superdoc]", error);
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    });
  });
}

window.od.register({
  name: "SuperDoc",
  mergeQuality: "native",
  extraResources: [SUPERDOC_ENGINE],

  async mount() {
    await waitFor("#sd-editor");
    window.od.progress("Loading SuperDoc and its DOCX engine (~25 MB on first visit)…");
    const SuperDoc = await superdocGlobal();
    await create(SuperDoc, await window.od.blankDocx());
  },

  async load(bytes: Uint8Array) {
    if (!instance) throw new Error("SuperDoc not mounted");
    const res = await instance.replaceDocument(toFile(bytes));
    if (res && res.ok === false) throw new Error(`SuperDoc could not open the file (${res.reason ?? "unknown reason"})`);
  },

  async getMarkdown() {
    // SuperDoc's markdown export (doc.getMarkdown / projectMarkdown) writes
    // lists as raw HTML (<ul data-superdoc-list-labels><li>•&#9;…) and bolds
    // headings, which the assistant would echo back; read its .docx instead.
    if (!instance) return "";
    return docxToMarkdown(await exportBytes());
  },

  async applyMarkdown(markdown: string) {
    // activeEditor is briefly null right after a document (re)opens.
    let ed = editor();
    for (let i = 0; i < 200 && !ed?.doc?.insert; i++) {
      await new Promise((r) => setTimeout(r, 25));
      ed = editor();
    }
    if (!ed?.doc?.clearContent || !ed?.doc?.insert) throw new Error("SuperDoc's document API is not ready");
    // SuperDoc's own markdown importer (doc.insert type:"markdown") maps
    // headings, marks, lists, links and code to Word structures, and every
    // step lands in SuperDoc's undo history.
    await ed.doc.clearContent();
    const res = await ed.doc.insert({ value: markdown, type: "markdown" });
    if (res && res.success === false) throw new Error(`SuperDoc rejected the markdown (${res.failure?.code ?? res.status ?? "unknown"})`);
    await finishImport(ed, markdown);
  },

  exportDocx: () => exportBytes(),
});
