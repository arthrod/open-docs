/** Server-side shell for Univer's document editor. */
export default {
  slug: "univer",
  title: "Univer",
  entry: "/editors/univer/main.ts",
  head: `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@univerjs/preset-docs-core@1.5.2/lib/index.css" />`,
  body: `<div id="univer-root" style="height:100%;min-height:0"></div>`,
};
