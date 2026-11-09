/** Server-side shell for the SuperDoc demo. */
export default {
  slug: "superdoc",
  title: "SuperDoc",
  entry: "/editors/superdoc/main.ts",
  head: "",
  body:
    `<div id="sd-host" style="height:100%;min-height:0;overflow:auto;background:#f3f4f6">
      <div style="padding:24px;color:#6b7280;font:13px ui-sans-serif">
        Loading superdoc (this one is big — a few MB of editor + layout engine).
      </div>
    </div>`,
};
