/** Server-side shell for office-open, shown through the editors trial's demo build of it. */
export default {
  slug: "office-open",
  // Its files come from the origin of the page showing it (a frame this page reaches into).
  sameOrigin: true,
  title: "office-open",
  entry: "/editors/office-open/main.ts",
  body: `<div id="office-open-root" style="height:100%;min-height:0;display:flex"></div>`,
};
