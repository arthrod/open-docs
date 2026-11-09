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

/** Word's own styles for what SuperDoc's markdown importer leaves unstyled. */
const STYLES = {
  quote: {
    type: "paragraph", id: "Quote", name: "Quote", basedOn: "Normal", next: "Normal", qFormat: true, priority: 29,
    paragraph: { indent: { left: 864, right: 864 }, justification: "center" },
    run: { italic: true, color: { val: "404040" } },
  },
  code: {
    type: "paragraph", id: "Code", name: "Code", basedOn: "Normal", next: "Normal", qFormat: true, priority: 39,
    paragraph: { spacing: { before: 0, after: 0 } },
    run: { fontFamily: { ascii: "Courier New", hAnsi: "Courier New", cs: "Courier New" }, fontSize: 20 },
  },
} as const;

/**
 * What SuperDoc 2.29's markdown importer leaves undone, finished with its own
 * document API (so it stays in the same undo history):
 *  - block quotes arrive as plain paragraphs (the HTML importer does the same),
 *    and fenced code as a plain paragraph of monospace runs: give them Word's
 *    Quote / Code style, creating it if the document lacks one;
 *  - the insert lands after the cleared document's empty paragraph: drop it.
 */
async function finishImport(ed: any, markdown: string) {
  let { blocks } = await ed.doc.blocks.list({});
  const first = blocks[0];
  if (first?.isEmpty && blocks.length > 1 && first.nodeType === "paragraph") {
    await ed.doc.blocks.delete({ target: { kind: "block", nodeType: first.nodeType, nodeId: first.nodeId } });
    blocks = blocks.slice(1);
  }
  const norm = (s: string) => s.replace(/\s+/g, " ").trim();
  const source = markdownToBlocks(markdown).map((b) => ({ kind: b.kind, text: norm(b.runs.map((r) => r.text).join("")) }));
  const kinds = new Set(source.filter((b) => (b.kind === "quote" || b.kind === "code") && b.text).map((b) => b.kind));
  if (!kinds.size) return;
  // conflictPolicy "fail" leaves a style the document already has alone.
  for (const kind of kinds as Set<keyof typeof STYLES>) {
    await ed.doc.styles.create({ ...STYLES[kind], conflictPolicy: "fail" }).catch(() => undefined);
  }
  // textPreview is cut at about 80 characters (ending "…"): a cut preview
  // matches by prefix, a whole one only exactly.
  const matches = (b: any, text: string) => {
    if (b.nodeType !== "paragraph" || !b.textPreview) return false;
    const p = norm(b.textPreview);
    return p.endsWith("…") ? text.startsWith(p.slice(0, -1).trimEnd()) : p === text;
  };
  // Walk source blocks and document paragraphs together, in order: each
  // source block takes the next paragraph that matches it, so an ordinary
  // paragraph with the same (or same-prefix) text keeps its own and the quote
  // gets the one after it. Blocks with no paragraph of their own (tables,
  // list items SuperDoc lists under another node type) match nothing and
  // leave the position where it was.
  let at = 0;
  for (const src of source) {
    if (!src.text) continue;
    const i = blocks.findIndex((b: any, k: number) => k >= at && matches(b, src.text));
    if (i < 0) continue;
    at = i + 1;
    if (src.kind !== "quote" && src.kind !== "code") continue;
    await ed.doc.styles.paragraph.setStyle({
      target: { kind: "block", nodeType: blocks[i].nodeType, nodeId: blocks[i].nodeId },
      styleId: STYLES[src.kind].id,
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
      // View-only page: SuperDoc's own "viewing" mode and no toolbar.
      ...(window.od.viewer ? {} : { toolbar: "#sd-toolbar" }),
      document: toFile(bytes, "Untitled.docx"),
      documentMode: window.od.viewer ? "viewing" : "editing",
      rulers: true,
      // SuperDoc's own fit-width zoom: the page shrinks with the window (never
      // past 100%), so a phone shows the whole page width.
      zoom: { mode: "fit-width", fitWidth: { min: 25, max: 100, padding: 16 } },
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
    const v = window.od.viewer;
    if (v) document.getElementById("sd-toolbar")?.style.setProperty("display", "none");
    await create(SuperDoc, v ? await v.initialDocx() : await window.od.blankDocx());
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
