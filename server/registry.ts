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
    packages: ["platejs", "@platejs/docx-io"],
    delivery: "esm-sh",
    license: "MIT",
    repo: "https://github.com/udecode/plate",
    blurb:
      "Slate-based plugin framework. DOCX round-trips through an import/export bridge, not a native engine.",
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
    slug: "office-open",
    name: "office-open",
    packages: ["office-open"],
    delivery: "esm-sh",
    license: "MIT",
    repo: "https://github.com/DemoMacro/office-open",
    blurb:
      "Model-first: generate/parse/patch DOCX from JSON with JSON-Schemas built for LLM tool calls.",
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
];

export function getEditor(slug: string): EditorMeta | undefined {
  return editors.find((e) => e.slug === slug);
}
