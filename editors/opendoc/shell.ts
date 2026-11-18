/** Server-side shell for OpenDoc (CasualOffice). */
export default {
  slug: "opendoc",
  // Its files must come from the origin of the page showing it (a Worker or a frame it reaches into).
  sameOrigin: true,
  title: "OpenDoc",
  entry: "/editors/opendoc/main.ts",
  body: `<div id="opendoc-root" style="height:100%;min-height:0;display:flex"></div>`,
};
