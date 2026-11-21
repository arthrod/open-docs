/** Server-side shell for Fidus Writer, shown through the editors trial's demo build of it. */
export default {
  slug: "fidus-writer",
  // Its files come from the origin of the page showing it (a frame this page reaches into).
  sameOrigin: true,
  title: "Fidus Writer",
  entry: "/editors/fidus-writer/main.ts",
  body: `<div id="fidus-writer-root" style="height:100%;min-height:0;display:flex"></div>`,
};
