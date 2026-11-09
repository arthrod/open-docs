/** Server-side shell for the docen demo. */
export default {
  slug: "docen",
  title: "docen",
  entry: "/editors/docen/main.ts",
  head: "",
  body: `
    <div style="background:#f3f4f6;padding:10px;height:100%;min-height:0;display:flex">
      <docen-document
        id="docen"
        style="display:block;flex:1;min-height:0;border-radius:8px;overflow:hidden;background:#fff"
        filename="Untitled.docx"
      ></docen-document>
    </div>`,
};
