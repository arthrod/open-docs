/** Server-side shell for the folio demo. */
export default {
  slug: "folio",
  title: "folio",
  entry: "/editors/folio/main.ts",
  head:
    `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@stll/folio-vue@0.28.0/dist/folio-vue.css" />
    <!-- folio-vue.css does @import "@stll/folio-fonts/fonts.css" — a bare
         specifier the browser resolves to a 404. Load the real file directly. -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@stll/folio-fonts@0.1.0/fonts.css" />`,
  body: `
    <div style="height:100%;display:flex;flex-direction:column;min-height:0;background:#fff">
      <div id="folio-root" style="flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column"></div>
    </div>`,
};
