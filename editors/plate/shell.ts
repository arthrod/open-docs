/** Server-side shell for the Plate demo. */
export default {
  slug: "plate",
  title: "Plate",
  entry: "/editors/plate/main.tsx",
  head: "",
  body: `
    <div style="display:flex;flex-direction:column;height:100%;min-height:0">
      <div id="plate-toolbar" style="display:flex;gap:6px;flex-wrap:wrap;padding:8px 12px;border-bottom:1px solid #e5e7eb;background:#fafafa"></div>
      <div id="plate-root" style="flex:1;padding:0 24px 24px;background:#fff"></div>
    </div>`,
};
