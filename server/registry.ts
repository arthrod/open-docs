/**
 * The single source of truth for which editors ship in this bench.
 *
 * Adding an editor = adding a folder under `editors/<slug>/` + one entry here.
 * `server/router.ts` uses `slug` for the route prefix, and the landing page
 * (the last thing we build) reads this list directly.
 */
export interface EditorMeta {
  /** URL segment: /e/<slug> */
  slug: string;
  name: string;
  /** npm package(s) this demo actually loads in the browser. */
  packages: string[];
  /** How the package reaches the browser. */
  delivery: "cdn-script" | "esm-sh" | "jsdelivr" | "wasm";
  license: string;
  repo: string;
  /** One line on what makes this editor different. */
  blurb: string;
  /** Does it edit existing .docx bytes and save real .docx back? */
  docxRoundTrip: boolean;
  /** Does this demo wire an LLM agent to the document? */
  agent: boolean;
  /**
   * "viewer": a proprietary, view-only renderer shown for comparison. It is
   * not an editor: no typing, no assistant, no export.
   */
  kind?: "editor" | "viewer";
  /** What the measurements can and can't see for this entry (viewers). */
  metricsNote?: string;
  /** false: the viewer fetches documents by public URL, so it can't open the user's own file. */
  opensFiles?: boolean;
}

export const editors: EditorMeta[] = [
  {
    slug: "canvas-editor",
    name: "canvas-editor",
    packages: ["@hufe921/canvas-editor"],
    delivery: "esm-sh",
    license: "MIT",
    repo: "https://github.com/Hufe921/canvas-editor",
    blurb:
      "Canvas/SVG-rendered paginated editor — the document is drawn, not DOM. Form/EMR oriented.",
    docxRoundTrip: true,
    agent: true,
  },
  {
    slug: "docxodus",
    name: "Docxodus",
    packages: ["docxodus"],
    delivery: "esm-sh",
    license: "MIT",
    repo: "https://github.com/JSv4/Docxodus",
    blurb:
      ".NET compiled to WebAssembly: Word-grade rendering, real tracked changes and redlines, all client-side.",
    docxRoundTrip: true,
    agent: true,
  },
  {
    slug: "superdoc",
    name: "SuperDoc",
    packages: ["superdoc"],
    delivery: "esm-sh",
    license: "AGPL-3.0",
    repo: "https://github.com/superdoc/docx-editor",
    blurb:
      "Full DOCX editor with comments, track changes and a Vue/React surface. Heaviest of the set.",
    docxRoundTrip: true,
    agent: true,
  },
  {
    slug: "plate",
    name: "Plate",
    packages: ["platejs", "@platejs/basic-nodes", "@platejs/list", "mammoth"],
    delivery: "esm-sh",
    license: "MIT",
    repo: "https://github.com/udecode/plate",
    blurb:
      "Slate-based plugin framework. DOCX comes in through mammoth and goes out through a small OOXML writer, not a native engine.",
    docxRoundTrip: true,
    agent: true,
  },
  {
    slug: "docen",
    name: "docen",
    packages: ["docen"],
    delivery: "esm-sh",
    license: "MIT",
    repo: "https://github.com/DemoMacro/docen",
    blurb:
      "Canvas web-component editor with a headless Markdown/DOCX conversion API in the same package.",
    docxRoundTrip: true,
    agent: true,
  },
  {
    slug: "eigenpal",
    name: "docx-editor.dev",
    packages: ["@docx-editor.dev/react", "@docx-editor.dev/core"],
    delivery: "esm-sh",
    license: "Apache-2.0",
    repo: "https://github.com/eigenpal/docx-editor",
    blurb: "React DOCX editor adapter with a headless core you can drive yourself.",
    docxRoundTrip: true,
    agent: true,
  },
  {
    slug: "folio",
    name: "folio",
    packages: ["@stll/folio-vue"],
    delivery: "esm-sh",
    license: "Apache-2.0",
    repo: "https://github.com/stella/folio",
    blurb:
      "ProseMirror + paginated layout DOCX editor with first-class AI edit/suggestion primitives.",
    docxRoundTrip: true,
    agent: true,
  },
  {
    slug: "wordcraft",
    name: "WordCraft",
    packages: ["wordcraft-web (GitHub release)"],
    delivery: "wasm",
    license: "Apache-2.0 / MIT",
    repo: "https://github.com/storytold/wordcraft",
    blurb:
      "A clean-room Word in pure Rust: its own layout engine and egui UI drawn into one canvas via WebGPU/WebGL2.",
    docxRoundTrip: true,
    agent: true,
  },
  // ---- Proprietary, view-only viewers (kind: "viewer") ----
  {
    slug: "word-online",
    name: "Microsoft Word viewer",
    packages: ["view.officeapps.live.com (Office Online)"],
    delivery: "cdn-script",
    license: "Proprietary · free, no key",
    repo: "https://learn.microsoft.com/en-us/office/client-developer/online/office-online-viewer",
    blurb:
      "Word's own renderer, served by Microsoft. It fetches the .docx from a public link, so it only shows this site's samples.",
    docxRoundTrip: false,
    agent: false,
    kind: "viewer",
    opensFiles: false,
    metricsNote:
      "Rendered on Microsoft's servers inside a cross-origin frame: startup is the frame's load event, and the frame's bytes and memory are invisible to this page.",
  },
  {
    slug: "google-viewer",
    name: "Google Docs viewer",
    packages: ["docs.google.com/gview"],
    delivery: "cdn-script",
    license: "Proprietary · free, no key",
    repo: "https://docs.google.com/viewer",
    blurb:
      "Google's embeddable document viewer. It fetches the .docx from a public link, so it only shows this site's samples.",
    docxRoundTrip: false,
    agent: false,
    kind: "viewer",
    opensFiles: false,
    metricsNote:
      "Rendered on Google's servers inside a cross-origin frame: startup is the frame's load event, and the frame's bytes and memory are invisible to this page.",
  },
  {
    slug: "apryse",
    name: "Apryse WebViewer",
    packages: ["@pdftron/webviewer@12.2.1"],
    delivery: "jsdelivr",
    license: "Proprietary · demo mode (watermark)",
    repo: "https://apryse.com/products/webviewer",
    blurb:
      "Commercial SDK that renders DOCX natively in the browser (WebAssembly). Runs here without a key, in demo mode with a watermark.",
    docxRoundTrip: false,
    agent: false,
    kind: "viewer",
    metricsNote: "Runs in this page; its office worker's files are counted from a list (workers are invisible to Resource Timing).",
  },
  {
    slug: "nutrient",
    name: "Nutrient Web SDK",
    packages: ["@nutrient-sdk/viewer@1.25.0"],
    delivery: "cdn-script",
    license: "Proprietary · trial mode (watermark)",
    repo: "https://www.nutrient.io/sdk/web/",
    blurb:
      "Formerly PSPDFKit. Converts DOCX to PDF in the browser with a .NET (GdPicture) WebAssembly engine, then renders it. Trial mode, no key.",
    docxRoundTrip: false,
    agent: false,
    kind: "viewer",
    metricsNote: "Runs in this page; its workers' files are counted from a list (workers are invisible to Resource Timing).",
  },
];

export function getEditor(slug: string): EditorMeta | undefined {
  return editors.find((e) => e.slug === slug);
}

export const isViewer = (e?: EditorMeta) => e?.kind === "viewer";
