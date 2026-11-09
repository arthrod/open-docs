/** Server-side shell for the Docxodus demo. */
export default {
  slug: "docxodus",
  title: "Docxodus",
  entry: "/editors/docxodus/main.ts",
  // An empty document is one 21px paragraph between the header and footer
  // bands; give the body flow a Letter-page height so a blank page reads as one.
  head: `<style>.dxr-surface .docx-body-flow { min-height: 9in; cursor: text; }</style>`,
  // position:relative + the adapter's absolute inset:0 child gives the ribbon a
  // DEFINITE box. Its root uses height:100%, which collapses inside a flex item.
  body:
    `<div id="dx-host" style="position:relative;height:100%;min-height:0;overflow:hidden;background:#f3f4f6">
      <div style="padding:24px;color:#6b7280;font:13px ui-sans-serif">
        Starting the .NET WebAssembly runtime…
      </div>
    </div>`,
};
