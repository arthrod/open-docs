/** Server-side shell for the docx-editor.dev (eigenpal) demo. */
export default {
  slug: "eigenpal",
  title: "docx-editor.dev",
  entry: "/editors/eigenpal/main.tsx",
  head:
    // VERIFIED: the stylesheet is exported by the React package as "./styles.css"
    // (→ src/styles/editor.css). `@docx-editor.dev/core/styles/editor.css` 404s.
    `<link rel="stylesheet" href="https://esm.sh/@docx-editor.dev/react@2.35.0/styles.css" />`,
  body: `
    <div style="display:flex;flex-direction:column;height:100%;min-height:0;background:#fff">
      <div id="ep-root" style="flex:1;min-height:0;overflow:hidden"></div>
    </div>`,
};
