/**
 * Server-side shell registration for the canvas-editor demo.
 *
 * canvas-editor ships no toolbar UI (its demo builds one in the repo), so this
 * shell provides one covering the command API the demo exposes: styles, fonts,
 * sizes, marks, colour, lists, alignment, spacing, tables, images, links,
 * separators, page breaks, search, zoom and print.
 */
const CE = "https://esm.sh/@hufe921/canvas-editor@1.1.0?bundle&target=es2022";
const plugin = (name: string, v: string) =>
  `https://esm.sh/@hufe921/canvas-editor-plugin-${name}@${v}?bundle&external=@hufe921/canvas-editor&target=es2022`;

const B = (cmd: string, label: string, title: string) =>
  `<button type="button" data-cmd="${cmd}" title="${title}" aria-label="${title}">${label}</button>`;
const SEP = '<span class="sep"></span>';
const opts = (list: Array<[string, string]>) => list.map(([v, l]) => `<option value="${v}">${l}</option>`).join("");

export default {
  slug: "canvas-editor",
  title: "canvas-editor",
  entry: "/editors/canvas-editor/main.ts",
  importMap: {
    "@hufe921/canvas-editor": CE,
    "@hufe921/canvas-editor-plugin-docx": plugin("docx", "1.0.0"),
    "@hufe921/canvas-editor-plugin-floating-toolbar": plugin("floating-toolbar", "0.0.4"),
  },
  head: `<style>
  #ce-host { display: flex; flex-direction: column; height: 100%; min-height: 0; background: #eef1f5; }
  #ce-toolbar { flex: none; display: flex; align-items: center; gap: 2px; flex-wrap: wrap; padding: 6px 10px;
    background: #fff; border-bottom: 1px solid #e3e6ec; }
  #ce-toolbar button { min-width: 30px; height: 30px; padding: 0 7px; border: 0; border-radius: 6px; background: transparent;
    font: 600 13px/1 system-ui, sans-serif; color: #2b3240; cursor: pointer; }
  #ce-toolbar button:hover { background: #eef1f6; }
  #ce-toolbar .sep { width: 1px; height: 20px; background: #e3e6ec; margin: 0 6px; }
  #ce-toolbar select, #ce-toolbar input[type=text], #ce-toolbar input[type=search] { height: 30px; border: 1px solid #d4d8e0;
    border-radius: 6px; padding: 0 6px; font: 13px system-ui; background: #fff; color: #2b3240; }
  #ce-toolbar label.swatch { display: inline-flex; align-items: center; gap: 3px; height: 30px; padding: 0 6px; border-radius: 6px;
    font: 600 13px system-ui; color: #2b3240; cursor: pointer; }
  #ce-toolbar label.swatch:hover { background: #eef1f6; }
  #ce-toolbar input[type=color] { width: 18px; height: 18px; padding: 0; border: 0; background: none; cursor: pointer; }
  #ce-link-url { width: 150px; }
  #ce-search { width: 120px; }
  #ce-scroll { flex: 1; min-height: 0; overflow: auto; padding: 24px 0 48px; }
  #ce-page { width: 794px; margin: 0 auto; }
  #ce-page canvas { box-shadow: 0 1px 3px rgba(16,24,40,.12), 0 8px 24px rgba(16,24,40,.06); }
</style>`,
  body: `<div id="ce-host">
    <div id="ce-toolbar" role="toolbar" aria-label="Formatting">
      ${B("undo", "↶", "Undo")}${B("redo", "↷", "Redo")}${B("painter", "🖌", "Format painter")}${B("clear", "⌫", "Clear formatting")}${SEP}
      <select id="ce-style" aria-label="Paragraph style"><option value="">Style…</option>${
    opts([["p", "Normal text"], ["h1", "Heading 1"], ["h2", "Heading 2"], ["h3", "Heading 3"], ["h4", "Heading 4"], ["h5", "Heading 5"], ["h6", "Heading 6"]])
  }</select>
      <select id="ce-font" aria-label="Font"><option value="">Font…</option>${
    opts([["Calibri", "Calibri"], ["Arial", "Arial"], ["Times New Roman", "Times New Roman"], ["Georgia", "Georgia"], ["Courier New", "Courier New"], ["Microsoft YaHei", "Microsoft YaHei"]])
  }</select>
      <select id="ce-size" aria-label="Font size"><option value="">Size</option>${
    opts([10, 12, 14, 15, 16, 18, 20, 24, 28, 32, 40, 48].map((n) => [String(n), String(n)]))
  }</select>
      ${B("sizeUp", "A+", "Larger")}${B("sizeDown", "A−", "Smaller")}${SEP}
      ${B("bold", "<b>B</b>", "Bold")}${B("italic", "<i>I</i>", "Italic")}${B("underline", "<u>U</u>", "Underline")}${B("strike", "<s>S</s>", "Strikethrough")}
      ${B("sup", "x²", "Superscript")}${B("sub", "x₂", "Subscript")}
      <label class="swatch" title="Text colour">A<input id="ce-color" type="color" value="#c00000" aria-label="Text colour"></label>
      <label class="swatch" title="Highlight">▮<input id="ce-highlight" type="color" value="#ffff00" aria-label="Highlight colour"></label>${SEP}
      ${B("ul", "• List", "Bulleted list")}${B("ol", "1. List", "Numbered list")}
      ${B("left", "⇤", "Align left")}${B("center", "↔", "Center")}${B("right", "⇥", "Align right")}${B("justify", "☰", "Justify")}
      <select id="ce-spacing" aria-label="Line spacing"><option value="">Spacing</option>${
    opts([["1", "1.0"], ["1.25", "1.25"], ["1.5", "1.5"], ["1.75", "1.75"], ["2", "2.0"], ["2.5", "2.5"], ["3", "3.0"]])
  }</select>${SEP}
      ${B("table", "▦ Table", "Insert 3×3 table")}${B("image", "🖼 Image", "Insert image")}${B("hr", "―", "Horizontal line")}${B("pageBreak", "⤓ Break", "Page break")}
      <input id="ce-link-url" type="text" placeholder="https://… then 🔗" aria-label="Link URL">${B("link", "🔗", "Link the selection")}${SEP}
      <input id="ce-search" type="search" placeholder="Find…" aria-label="Find in document">
      ${B("zoomOut", "−", "Zoom out")}${B("zoomIn", "+", "Zoom in")}${B("print", "🖨", "Print")}
      <input id="ce-image-file" type="file" accept="image/*" hidden>
    </div>
    <div id="ce-scroll"><div id="ce-page"></div></div>
  </div>`,
};
