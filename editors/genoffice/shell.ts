/** Server-side shell for GenOffice, shown through the editors trial's demo build of it. */
export default {
  slug: "genoffice",
  // Its files come from the origin of the page showing it (a frame this page reaches into).
  sameOrigin: true,
  title: "GenOffice",
  entry: "/editors/genoffice/main.ts",
  body: `<div id="genoffice-root" style="height:100%;min-height:0;display:flex"></div>`,
};
