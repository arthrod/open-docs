/** Server-side shell for docs.plus, shown through the editors trial's demo build of it. */
export default {
  slug: "docs-plus",
  // Its files come from the origin of the page showing it (a frame this page reaches into).
  sameOrigin: true,
  title: "docs.plus",
  entry: "/editors/docs-plus/main.ts",
  body: `<div id="docs-plus-root" style="height:100%;min-height:0;display:flex"></div>`,
};
