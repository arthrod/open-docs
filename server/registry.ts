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
  /**
   * Who builds it, credited in the menu, the sub-bar and the landing card.
   * LinkedIn only where verified (the GitHub profile/org links it, or the
   * LinkedIn page names the project or company); otherwise GitHub.
   */
  makers?: Maker[];
}

export interface Maker {
  name: string;
  kind: "company" | "person";
  linkedin?: string;
  github?: string;
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
    makers: [
      { name: "Hufe", kind: "person", github: "https://github.com/Hufe921" },
    ],
  },
  {
    slug: "cite-check",
    name: "cite-check",
    packages: ["@hufe921/canvas-editor", "cite-check core (open-legal-artifacts)"],
    delivery: "esm-sh",
    license: "MIT",
    repo: "https://github.com/arthrod/open-legal-artifacts",
    blurb:
      "canvas-editor with the deterministic cite-check core: import a reviewed memo, verify every quote against pasted sources (exact / normalized / fuzzy / not found, with anchors, diffs and pinpoints), annotate it through native undoable commands and export the annotated .docx.",
    docxRoundTrip: true,
    agent: false,
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
    makers: [
      { name: "John Scrudato", kind: "person", linkedin: "https://www.linkedin.com/in/john-scrudato/", github: "https://github.com/JSv4" },
      { name: "Eric White", kind: "person", linkedin: "https://www.linkedin.com/in/ericwhitedev/", github: "https://github.com/EricWhiteDev" },
    ],
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
    makers: [
      { name: "SuperDoc", kind: "company", linkedin: "https://www.linkedin.com/company/superdoc-dev/", github: "https://github.com/superdoc" },
      { name: "Nick Bernal", kind: "person", linkedin: "https://www.linkedin.com/in/nickjbernal/", github: "https://github.com/harbournick" },
      { name: "Caio Pizzol", kind: "person", linkedin: "https://www.linkedin.com/in/caiopizzol/", github: "https://github.com/caio-pizzol" },
    ],
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
    makers: [
      { name: "Udecode", kind: "company", linkedin: "https://www.linkedin.com/company/udecode/", github: "https://github.com/udecode" },
      { name: "Ziad Beyens", kind: "person", linkedin: "https://www.linkedin.com/in/zbeyens/", github: "https://github.com/zbeyens" },
    ],
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
    makers: [
      { name: "Demo Macro", kind: "person", github: "https://github.com/DemoMacro" },
    ],
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
    makers: [
      { name: "EigenPal", kind: "company", linkedin: "https://www.linkedin.com/company/eigenpal/", github: "https://github.com/eigenpal" },
      { name: "Jedrzej Blaszyk", kind: "person", linkedin: "https://www.linkedin.com/in/jedrzej-blaszyk/", github: "https://github.com/jedrazb" },
    ],
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
    makers: [
      { name: "stella", kind: "company", linkedin: "https://www.linkedin.com/company/stella-app/", github: "https://github.com/stella" },
      { name: "Jan Kubica", kind: "person", linkedin: "https://www.linkedin.com/in/kubicajan/", github: "https://github.com/jan-kubica" },
    ],
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
    makers: [
      { name: "ArtCraft", kind: "company", linkedin: "https://www.linkedin.com/company/artcraft-ai/", github: "https://github.com/storytold" },
    ],
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
    makers: [
      { name: "Microsoft", kind: "company", linkedin: "https://www.linkedin.com/company/microsoft/" },
    ],
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
    makers: [
      { name: "Google", kind: "company", linkedin: "https://www.linkedin.com/company/google/" },
    ],
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
    makers: [
      { name: "Apryse", kind: "company", linkedin: "https://www.linkedin.com/company/aprysesolutions/" },
    ],
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
    makers: [
      { name: "Nutrient", kind: "company", linkedin: "https://www.linkedin.com/company/nutrient-sdk/" },
    ],
  },
];

export function getEditor(slug: string): EditorMeta | undefined {
  return editors.find((e) => e.slug === slug);
}

export const isViewer = (e?: EditorMeta) => e?.kind === "viewer";
