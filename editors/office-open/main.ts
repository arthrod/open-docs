/**
 * office-open demo — the model-first entry.
 *
 * Unlike every other editor here, office-open has **no editing surface**. Its
 * unit of work is `DocumentOptions`, a canonical JSON model that parses from
 * and generates to DOCX/ODT/RTF. So the demo is:
 *
 *     .docx bytes ──parseDocument──▶ DocumentOptions ──generateDocument──▶ .docx
 *                                        ▲    │
 *                                  agent│    │you (JSON textarea)
 *
 * That makes it the only entry where the LLM produces the document model
 * directly instead of editing text in a DOM. Its `office-open/schemas` and
 * `office-open/ai` subpaths exist precisely for tool-calling.
 */
import { waitFor } from "/lib/kit.ts";

const CDN = "https://esm.sh/office-open@0.15.1/document?bundle";

type DocumentOptions = {
  sections?: Array<{
    children?: Array<Record<string, unknown>>;
  }>;
  [key: string]: unknown;
};

let parseDocument: (input: Uint8Array) => Promise<DocumentOptions>;
let generateDocument: (
  format: string,
  options: DocumentOptions,
  output?: string,
) => Promise<Uint8Array>;

let model: DocumentOptions = {};
let textarea: HTMLTextAreaElement;

/* --------------------------- model ⇄ markdown ---------------------------- */

/**
 * office-open paragraphs are `{ paragraph: "text" }` (or `{ paragraph:
 * ParagraphOptions }`). Headings are a `heading` on the same object. Flattening
 * that to markdown is enough for the agent to reason about the document.
 */
function modelToMarkdown(options: DocumentOptions): string {
  const lines: string[] = [];
  for (const section of options.sections ?? []) {
    for (const child of section.children ?? []) {
      const para = (child as any).paragraph;
      if (para === undefined) {
        if ((child as any).table) lines.push("_[table]_");
        continue;
      }
      const text = typeof para === "string"
        ? para
        : Array.isArray(para?.children)
        ? para.children
          .map((run: any) => typeof run === "string" ? run : run?.text ?? "")
          .join("")
        : para?.text ?? "";
      const heading = typeof para === "object" ? para?.heading : undefined;
      const level = typeof heading === "string"
        ? Number(heading.replace(/\D/g, "")) || undefined
        : undefined;
      if (!String(text).trim()) continue;
      lines.push(level ? `${"#".repeat(Math.min(level, 4))} ${text}` : String(text));
    }
  }
  return lines.join("\n\n");
}

/** markdown → DocumentOptions children. */
function markdownToModel(markdown: string, base: DocumentOptions): DocumentOptions {
  const children: Array<Record<string, unknown>> = [];
  for (const block of window.od.md.mdToBlocks(markdown)) {
    const heading = block.type === "title"
      ? "HeadingLevel.HEADING_1"
      : block.type === "h1"
      ? "HeadingLevel.HEADING_2"
      : block.type === "h2" || block.type === "h3"
      ? "HeadingLevel.HEADING_3"
      : undefined;
    children.push(
      heading
        ? { paragraph: { text: block.text, heading: heading as any } }
        : { paragraph: block.text },
    );
  }
  // Keep the document's own section properties; replace only the body content.
  const sections = base.sections?.length
    ? [{ ...base.sections[0], children }, ...base.sections.slice(1)]
    : [{ children }];
  return { ...base, sections };
}

/* -------------------------------- preview -------------------------------- */

/** Render the model as plain HTML so you can see what you're generating. */
function renderPreview(markdown: string) {
  const host = document.getElementById("oo-preview");
  if (!host) return;
  host.innerHTML = window.od.md.mdToHtml(markdown) ||
    `<p style="color:#9ca3af">(empty document)</p>`;
  host.style.background = "#fff";
  host.style.borderRadius = "8px";
  host.style.maxWidth = "760px";
  host.style.margin = "0 auto";
  host.style.padding = "32px 40px";
  host.style.boxShadow = "0 1px 3px rgba(0,0,0,.08)";
  host.querySelectorAll("h1,h2,h3,h4").forEach((h) => {
    (h as HTMLElement).style.margin = "1.1em 0 .4em";
    (h as HTMLElement).style.lineHeight = "1.3";
  });
  host.querySelectorAll("p,li").forEach((p) => {
    (p as HTMLElement).style.margin = "0 0 .7em";
    (p as HTMLElement).style.fontSize = "14.5px";
    (p as HTMLElement).style.lineHeight = "1.65";
  });
}

function syncTextarea() {
  textarea.value = JSON.stringify(model, null, 2);
  renderPreview(modelToMarkdown(model));
  const dirty = document.getElementById("oo-dirty");
  if (dirty) dirty.style.display = "none";
}

/* -------------------------------- adapter -------------------------------- */

window.od.register({
  name: "office-open",
  mergeQuality: "rebuild",

  async mount() {
    textarea = await waitFor<HTMLTextAreaElement>("#oo-json");
    window.od.status("Loading office-open…");
    const mod: any = await import(CDN);
    parseDocument = mod.parseDocument;
    generateDocument = mod.generateDocument;

    const bytes = await window.od.sampleDocx();
    model = await parseDocument(bytes);
    syncTextarea();

    // Manual JSON editing: re-render the preview on every valid parse.
    textarea.addEventListener("input", () => {
      try {
        const next = JSON.parse(textarea.value);
        model = next;
        renderPreview(modelToMarkdown(model));
        const dirty = document.getElementById("oo-dirty");
        if (dirty) dirty.style.display = "inline";
        window.od.status("Model updated", "ok");
      } catch {
        window.od.status("JSON is not valid yet…", "err");
      }
    });

    window.od.status(
      `Parsed ${model.sections?.length ?? 0} section(s) from the sample .docx`,
      "ok",
    );
  },

  async applyMarkdown(markdown) {
    model = markdownToModel(markdown, model);
    syncTextarea();
  },

  async getMarkdown() {
    const md = modelToMarkdown(model);
    return md || await window.od.sampleMarkdown();
  },

  async exportDocx() {
    if (!generateDocument) throw new Error("office-open not loaded");
    // The model is the document, so this is a regenerate rather than a save.
    return await generateDocument("docx", model, "uint8array");
  },

  async importDocx(bytes) {
    if (!parseDocument) throw new Error("office-open not loaded");
    model = await parseDocument(bytes);
    syncTextarea();
  },
});
