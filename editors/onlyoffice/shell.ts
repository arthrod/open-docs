/** Server-side shell for OnlyOffice as CryptPad builds it for the browser. */
export default {
  slug: "onlyoffice",
  // Its files must come from the origin of the page showing it (a Worker or a frame it reaches into).
  sameOrigin: true,
  title: "OnlyOffice (CryptPad build)",
  entry: "/editors/onlyoffice/main.ts",
  body: `<div id="oo-root" style="height:100%;min-height:0;display:flex;flex-direction:column"></div>`,
};
