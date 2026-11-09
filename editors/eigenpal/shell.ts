/** Server-side shell for the docx-editor.dev (eigenpal) demo. */
import { REACT_IMPORTS } from "../../server/router.ts";

export default {
  slug: "eigenpal",
  title: "docx-editor.dev",
  entry: "/editors/eigenpal/main.tsx",
  // `?external=react,react-dom` leaves bare "react" imports in every module of
  // the graph; this import map resolves them all to ONE React instance.
  importMap: REACT_IMPORTS,
  // The React package's styles.css is a one-line `@import "@docx-editor.dev/core/…"`
  // — a bare specifier the browser can't resolve. Load the core sheet directly.
  head: `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@docx-editor.dev/core@2.35.0/dist/editor.css" />`,
  body: `<div id="ep-root" style="height:100%;min-height:0;display:flex;flex-direction:column"></div>`,
};
