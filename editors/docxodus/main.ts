/**
 * Docxodus — .NET compiled to WebAssembly, with its own Word-style ribbon.
 *
 * Verified against dist/embed.bundle.js (v15.1.0):
 *
 *   createRibbonEditor(target, bytes | null, { wasmBasePath, documentName })
 *     → ribbon { open(bytes, name), openBlank(name), save(): Uint8Array|null,
 *                editor, destroy() }
 *   getWasmExports() → { DocxSessionBridge, … }   (the live WASM bridge)
 *   new DocxSession(handle, bridge)                the engine's session client
 *
 * `bytes = null` opens the engine's own blank document. `open()` swaps the
 * document inside the SAME ribbon, so import/new/sample never remount.
 *
 * `wasmBasePath` must be a string ending in "/" (the loader calls
 * `s.endsWith("/")` — passing anything else was the original crash).
 */
import { Lexer, type Tokens } from "https://esm.sh/marked@18.1.3?target=es2022";
import { waitFor } from "/lib/kit.ts";
import { docxToMarkdown } from "/lib/docx-markdown.ts";
import { BUNDLE_URL, WASM_BASE } from "./assets.ts";

/** One block the engine addressed (dist/session.d.ts's AnchorRef). */
interface AnchorRef {
  id: string;
  kind: string;
}

/** The result of one engine mutation (dist/session.d.ts's EditResult). */
interface EditResult {
  success: boolean;
  error?: { code?: string; message?: string };
  /** The blocks the mutation created, in document order. */
  created: AnchorRef[];
}

/** One step of a session batch: a label plus the engine call it makes. */
interface BatchStep {
  tool: string;
  action: string;
  mutation: () => EditResult;
}

/**
 * The slice of Docxodus's own DocxSession API this adapter drives.
 * Every method here is the vendor's (npm docxodus@15.1.0 dist/session.d.ts).
 */
interface DocxSession {
  /** The engine's anchor-annotated markdown projection of the live document. */
  project(): { markdown: string };
  /** Insert markdown (the engine's own markdown subset) before/after a block. */
  insertParagraph(
    anchorId: string,
    position: "before" | "after",
    markdown: string,
  ): EditResult;
  /** Insert a table (the engine's own table builder) before/after a block. */
  insertTable(
    anchorId: string,
    position: "before" | "after",
    rows: number,
    cols: number,
    options?: { cellContents?: string[] },
  ): EditResult;
  /** Delete one block. */
  deleteBlock(anchorId: string): EditResult;
  /** The block's own metadata — its style id, outline level, list membership. */
  getBlockMetadata(anchorId: string): { styleId?: string | null } | null;
  /** Apply a paragraph style; the engine writes the style definition too. */
  setParagraphStyle(anchorId: string, styleId: string): EditResult;
  /** Run steps atomically: success is ONE undo/version unit. */
  executeBatch(
    steps: BatchStep[],
    mode: "atomic",
  ): {
    success: boolean;
    failure?: { error?: { code?: string; message?: string } };
  };
}

/** The ribbon's editor: the live document, plus the repaint the host owns. */
interface Editor {
  /** The handle of the live WASM session behind this editor. */
  sessionHandle: number;
  /** Repaint from the live session after a mutation made outside the editor. */
  refresh(): void;
  undo(): void;
  redo(): void;
}

type Ribbon = {
  open(bytes: Uint8Array, name?: string): unknown;
  openBlank(name?: string): unknown;
  save(): Uint8Array | null;
  destroy(): void;
  editor: Editor | null;
};

/** The engine bundle's exports this adapter uses. */
type Bundle = {
  createRibbonEditor: (
    target: HTMLElement,
    bytes: Uint8Array | null,
    options: Record<string, unknown>,
  ) => Promise<Ribbon>;
  getWasmExports: () => { DocxSessionBridge: unknown };
  DocxSession: new (handle: number, bridge: unknown) => DocxSession;
};

let bundle: Bundle | undefined;
let ribbon: Ribbon | undefined;
// Exposed for the probes in /lib/probes (read-only use).
(window as any).__docxodus = () => ribbon;
/** On view-only pages: Docxodus's paginated read-only view (convertDocxToHtml + paginateHtml), not the ribbon. */
let viewer: { reload(bytes: Uint8Array): Promise<void> } | undefined;

function saveBytes(): Uint8Array | undefined {
  const out = ribbon?.save();
  if (!out) return undefined;
  return out instanceof Uint8Array ? out : new Uint8Array(out as ArrayBuffer);
}

/**
 * The LIVE session behind the ribbon's editor.
 *
 * The editor holds the document in WASM under `sessionHandle`; DocxSession is
 * the engine's own client for a handle, and getWasmExports() hands back the
 * very bridge the editor mutates through. Mutating THIS session is what puts
 * the edit in the engine's undo history.
 */
function liveSession(editor: Editor): DocxSession {
  if (!bundle) throw new Error("Docxodus not mounted");
  const bridge = bundle.getWasmExports().DocxSessionBridge;
  return new bundle.DocxSession(editor.sessionHandle, bridge);
}

/**
 * The document's body blocks, in document order, from the engine's own
 * projection: its markdown carries every block's stable anchor
 * (`{#kind:scope:unid}`), and the scope tells body blocks from header,
 * footer and note stories.
 */
function bodyBlocks(session: DocxSession): string[] {
  const projection = session.project();
  const anchors = [
    ...String(projection.markdown ?? "").matchAll(/\{#([^{}]+)\}/g),
  ].map((match) => match[1]);
  return anchors.filter((id) => {
    const [kind, scope] = id.split(":");
    return (
      scope === "body" &&
      (kind === "p" || kind === "h" || kind === "li" || kind === "tbl")
    );
  });
}

/** Text the engine's markdown parser takes, or a table it has to build. */
type Segment =
  | { kind: "text"; markdown: string }
  | { kind: "table"; rows: string[][] };

/**
 * The assistant's markdown, split the way the engine consumes it: text runs
 * (its own markdown parser turns those into Word blocks — headings, bold,
 * italic, code, links, lists) and GFM tables (its markdown subset has no
 * tables: the engine itself refuses them, so they go through insertTable).
 * Tables are found by marked's GFM lexer, not by scanning for pipes; every
 * other token goes to the engine as the markdown it was written as.
 */
function splitMarkdown(markdown: string): Segment[] {
  const segments: Segment[] = [];
  let text = "";
  const flush = () => {
    if (text.trim()) segments.push({ kind: "text", markdown: text });
    text = "";
  };
  for (const token of new Lexer({ gfm: true }).lex(markdown)) {
    if (token.type !== "table") {
      text += token.raw;
      continue;
    }
    flush();
    const t = token as Tokens.Table;
    segments.push({ kind: "table", rows: [t.header.map(cellText), ...t.rows.map((r) => r.map(cellText))] });
  }
  flush();
  return segments;
}

/** Plain text of a marked table cell: `c.text` is the raw inline source
 * (`**bold**`, `` `code` `` stay literal); flatten its inline tokens instead. */
function cellText(cell: Tokens.TableCell): string {
  const flatten = (tokens: readonly unknown[]): string =>
    tokens.map((t) => {
      const tok = t as { text?: string; raw?: string; tokens?: unknown[] };
      return tok.tokens ? flatten(tok.tokens) : (tok.text ?? tok.raw ?? "");
    }).join("");
  return cell.tokens?.length ? flatten(cell.tokens) : cell.text;
}

/** Drop image syntax (`![alt](src)`) but never inside code: fenced blocks and
 * inline code spans are masked out first, so image-shaped text in code survives. */
function stripImagesOutsideCode(markdown: string): string {
  const code: string[] = [];
  const masked = markdown.replace(/```[\s\S]*?(?:```|$)|`[^`\n]*`/g, (m) => {
    code.push(m);
    return `\u0000${code.length - 1}\u0000`;
  });
  return masked
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\u0000(\d+)\u0000/g, (_, i) => code[Number(i)]);
}

/**
 * Give the inserted blocks the style DEFINITIONS the document is missing.
 *
 * The engine's markdown parser sets the paragraph style (Heading1, Heading2,
 * Quote, …) but does not add the definition to a document that lacks it — and
 * the engine's own blank document carries only "Normal". A heading would then
 * reference a style nothing defines and render as body text. setParagraphStyle
 * is the engine's own call that materializes the definition (Word's own
 * heading: bold, 2E74B5, 16pt, outline level 0). Style ids the engine does
 * not know (Quote) are refused and left exactly as its markdown parser set
 * them.
 */
function materializeStyles(session: DocxSession, created: AnchorRef[]): void {
  for (const anchor of created) {
    const styleId = session.getBlockMetadata(anchor.id)?.styleId;
    if (!styleId) continue;
    session.setParagraphStyle(anchor.id, styleId);
  }
}

/**
 * The assistant's edit, applied INSIDE Docxodus's own undo history.
 *
 * Every step is the engine's own in-document mutation, addressed by the
 * anchors in its own projection:
 *
 *   insertParagraph(anchor, "before", markdown)  the engine's markdown parser
 *                                                  → Word blocks (headings,
 *                                                  bold/italic/code, links,
 *                                                  bullet + numbered lists)
 *   insertTable(anchor, "before", rows, cols, …)  the engine's table builder
 *   deleteBlock(anchor)                          the old blocks go
 *
 * They run inside ONE session.executeBatch(…, "atomic"): the batch is a
 * single undo unit in the session's history, so the engine's own
 * editor.undo() (bridge.Undo) reverts the whole assistant edit and redo()
 * re-applies it. Opening a new document instead (the old path) started a
 * fresh history, which is why the edit could not be undone.
 */
function applyToSession(
  session: DocxSession,
  editor: Editor,
  markdown: string,
): void {
  const oldBlocks = bodyBlocks(session);
  const anchor = oldBlocks[0];
  if (!anchor) {
    throw new Error("Docxodus: the document has no body block to anchor to");
  }
  const run = (text: string) => {
    const steps: BatchStep[] = [];
    // The new content goes in BEFORE the first old block; the old blocks are
    // deleted after it, in the same atomic batch.
    const segments = splitMarkdown(text);
    // Empty (or image-only, once images are stripped) input must not leave the
    // body with zero blocks — later applies anchor to the first body block.
    if (segments.length === 0) segments.push({ kind: "text", markdown: " " });
    for (const segment of segments) {
      if (segment.kind === "text") {
        steps.push({
          tool: "docx_create",
          action: "insert_markdown",
          mutation: () => {
            const inserted = session.insertParagraph(
              anchor,
              "before",
              segment.markdown,
            );
            if (inserted.success) materializeStyles(session, inserted.created);
            return inserted;
          },
        });
      } else {
        steps.push({
          tool: "docx_create",
          action: "insert_table",
          mutation: () =>
            session.insertTable(
              anchor,
              "before",
              segment.rows.length,
              segment.rows[0].length,
              { cellContents: segment.rows.flat() },
            ),
        });
      }
    }
    for (const id of oldBlocks) {
      steps.push({
        tool: "docx_edit",
        action: "delete_block",
        mutation: () => session.deleteBlock(id),
      });
    }
    return session.executeBatch(steps, "atomic");
  };

  let result = run(markdown);
  if (
    !result.success &&
    result.failure?.error?.code === "image_insert_not_supported"
  ) {
    // The engine's markdown subset has no image syntax (a picture needs
    // bytes; the engine's own refusal says so). The rebuild path this
    // replaces dropped images too, so drop them and land the rest of the edit.
    result = run(stripImagesOutsideCode(markdown));
  }
  if (!result.success) {
    throw new Error(
      `Docxodus refused the edit: ${
        result.failure?.error?.message ?? "unknown error"
      }`,
    );
  }
  // The editor cannot observe a mutation made outside its own commands: the
  // host repaints it from the live session (its own documented path).
  editor.refresh();
}

window.od.register({
  name: "Docxodus",
  // One atomic session batch (executeBatch "atomic"): one undo unit.
  applyInHistory: true,
  mergeQuality: "native",

  async mount() {
    const host = await waitFor<HTMLDivElement>("#dx-host");
    host.innerHTML = "";
    const target = document.createElement("div");
    // Absolute fill: the ribbon root is height:100% and needs a definite box.
    target.style.cssText = "position:absolute;inset:0";
    host.append(target);

    const mod = await import(BUNDLE_URL);
    bundle = mod as unknown as Bundle;
    const v = window.od.viewer;
    if (v) {
      // Read-only and paginated, the way Docxodus documents its page view:
      // convertDocxToHtml in Paginated mode (headers, footers, notes), then its
      // own paginateHtml flows the result into page boxes. (createViewer only
      // injects the HTML; it never paginates.)
      for (const f of ["initialize", "convertDocxToHtml", "paginateHtml"]) {
        if (typeof mod[f] !== "function") throw new Error(`docxodus bundle has no ${f}()`);
      }
      target.style.overflow = "auto";
      target.style.background = "#eef1f5";
      target.style.padding = "24px 0";
      await mod.initialize(WASM_BASE);
      const render = async (bytes: Uint8Array) => {
        const html: string = await mod.convertDocxToHtml(bytes, {
          paginationMode: mod.PaginationMode.Paginated,
          renderHeadersAndFooters: true,
          renderFootnotesAndEndnotes: true,
        });
        target.innerHTML = "";
        await document.fonts.ready;
        mod.paginateHtml(html, target, { scale: 1 });
      };
      viewer = { reload: render };
      await render(await v.initialDocx());
      return;
    }
    if (typeof mod.createRibbonEditor !== "function") {
      throw new Error("docxodus bundle has no createRibbonEditor()");
    }
    // null → native blank document. The ribbon shows its own staged loader.
    ribbon = await mod.createRibbonEditor(target, null, {
      wasmBasePath: WASM_BASE,
      documentName: "Untitled.docx",
      // "card" (the default) adds a border, radius and shadow meant for a
      // floating widget; "flush" fills our stage edge-to-edge.
      frame: "flush",
    }) as Ribbon;
  },

  async load(bytes: Uint8Array) {
    if (viewer) return viewer.reload(bytes);
    if (!ribbon) throw new Error("Docxodus not mounted");
    ribbon.open(bytes, "document.docx");
  },

  async getMarkdown() {
    // The bytes Docxodus saves are the live session's document; the assistant
    // gets plain markdown read from them.
    const bytes = saveBytes();
    return bytes?.length ? docxToMarkdown(bytes) : "";
  },

  async applyMarkdown(markdown) {
    if (!ribbon) throw new Error("Docxodus not mounted");
    const editor = ribbon.editor;
    if (!editor) throw new Error("Docxodus has no open document");
    // Docxodus's own in-document mutations, on the LIVE session: the edit
    // lands inside the engine's undo history, so the engine's undo()/redo()
    // (adapter.undo()/redo() below) revert and re-apply it.
    applyToSession(liveSession(editor), editor, markdown);
  },

  // Docxodus's editor history (incremental repaint).
  undo() {
    ribbon?.editor?.undo?.();
  },
  redo() {
    ribbon?.editor?.redo?.();
  },

  async exportDocx() {
    const bytes = saveBytes();
    if (!bytes) throw new Error("Docxodus returned no document");
    return bytes;
  },
});
