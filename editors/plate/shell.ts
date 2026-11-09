/** Server-side shell for the Plate demo. */
import { REACT_IMPORTS } from "../../server/router.ts";

export default {
  slug: "plate",
  title: "Plate",
  entry: "/editors/plate/main.tsx",
  importMap: REACT_IMPORTS,
  head: `<style>
  #plate-root { height: 100%; min-height: 0; }
  #plate-root { display: flex; flex-direction: column; background: #eef1f5; }
  .pl-toolbar { flex: none; display: flex; align-items: center; flex-wrap: wrap; gap: 2px; padding: 6px 10px; background: #fff; border-bottom: 1px solid #e3e6ec; }
  .pl-btn { min-width: 30px; height: 30px; padding: 0 7px; border: 0; border-radius: 6px; background: transparent;
    font: 600 13px/1 system-ui, sans-serif; color: #2b3240; cursor: pointer; }
  .pl-btn:hover { background: #eef1f6; }
  .pl-select, .pl-url { height: 30px; border: 1px solid #d4d8e0; border-radius: 6px; padding: 0 6px; font: 13px system-ui; background: #fff; color: #2b3240; }
  .pl-url { width: 150px; }
  .pl-swatch { display: inline-flex; align-items: center; gap: 3px; height: 30px; padding: 0 6px; border-radius: 6px; font: 600 13px system-ui; color: #2b3240; cursor: pointer; }
  .pl-swatch:hover { background: #eef1f6; }
  .pl-swatch input { width: 18px; height: 18px; padding: 0; border: 0; background: none; cursor: pointer; }
  .pl-B { font-weight: 800; } .pl-I { font-style: italic; } .pl-U { text-decoration: underline; } .pl-S { text-decoration: line-through; }
  .pl-sep { width: 1px; height: 20px; background: #e3e6ec; margin: 0 6px; }
  .pl-scroll { flex: 1; min-height: 0; overflow: auto; padding: 28px 24px 48px; }
  .pl-page { width: min(816px, 100%); min-height: 1056px; margin: 0 auto; background: #fff; padding: 96px;
    box-shadow: 0 1px 3px rgba(16,24,40,.12), 0 8px 24px rgba(16,24,40,.06); }
  .pl-page { cursor: text; }
  /* Plate sets an inline style on the editable; keep it page-tall. */
  .pl-content { outline: none; min-height: 800px !important; font: 11pt/1.55 Calibri, Carlito, "Segoe UI", sans-serif; color: #111; }
  .pl-content h1 { font-size: 24pt; margin: 0 0 12pt; } .pl-content h2 { font-size: 16pt; margin: 16pt 0 6pt; }
  .pl-content h3 { font-size: 13pt; margin: 12pt 0 4pt; } .pl-content p { margin: 0 0 8pt; }
  .pl-content h4 { font-size: 11pt; font-style: italic; margin: 10pt 0 4pt; } .pl-content h5, .pl-content h6 { font-size: 11pt; color: #1f3763; margin: 10pt 0 4pt; }
  .pl-content a { color: #0563c1; text-decoration: underline; cursor: text; }
  .pl-content code { font-family: "Courier New", ui-monospace, monospace; background: #f3f4f6; padding: 0 3px; border-radius: 3px; font-size: .95em; }
  .pl-content pre { font-family: "Courier New", ui-monospace, monospace; background: #f3f4f6; padding: 8pt 10pt; border-radius: 4px; margin: 6pt 0; white-space: pre-wrap; }
  .pl-content hr { border: 0; border-top: 1px solid #a0a0a0; margin: 12pt 0; }
  .pl-content mark { background: #fff59d; }
  .pl-li { margin: 0 0 4pt; } .pl-li ol, .pl-li ul { padding-left: 0 !important; }
  .pl-indent-1 { margin-left: 22pt; } .pl-indent-2 { margin-left: 44pt; } .pl-indent-3 { margin-left: 66pt; } .pl-indent-4 { margin-left: 88pt; }
  /* Phones: the page keeps Word's proportions but not its 1-inch margins, and
     the tools sit in one scrolling row. */
  @media (max-width: 700px) {
    .pl-toolbar { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: thin; } .pl-toolbar > * { flex: none; }
    .pl-scroll { padding: 10px 8px 32px; } .pl-page { padding: 28px 22px; min-height: 0; }
    .pl-content { min-height: 60dvh !important; }
  }
  .pl-content table.pl-table { border-collapse: collapse; width: 100%; margin: 6pt 0 10pt; table-layout: fixed; }
  .pl-content .pl-table td, .pl-content .pl-table th { border: 1px solid #a0a0a0; padding: 3pt 6pt; vertical-align: top; }
  .pl-content .pl-table th { background: #f3f5f8; text-align: left; }
  .pl-content .pl-table p { margin: 0; }
  .pl-content blockquote { margin: 8pt 0; padding-left: 12pt; border-left: 3px solid #c9ced8; color: #475467; }
</style>`,
  body: `<div id="plate-root"></div>`,
};
