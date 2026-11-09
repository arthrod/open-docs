/**
 * Server-side shell for the WordCraft demo.
 *
 * WordCraft draws its whole UI (ribbon, page, dialogs) into one canvas with
 * egui/wgpu. Its "same-document host mode" (`data-host="page"` on the canvas,
 * HOSTING.md) hands opened/saved files to this page through DOM events instead
 * of downloads, and `window.wordcraft` exposes its command API.
 */
export default {
  slug: "wordcraft",
  title: "WordCraft",
  entry: "/editors/wordcraft/main.ts",
  importMap: {},
  head: `<style>
  #wc-host { position: relative; height: 100%; min-height: 0; background: #e6e6e6; }
  #wordcraft_canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; outline: none; }
</style>`,
  body: `<div id="wc-host"><canvas id="wordcraft_canvas" data-host="page" tabindex="0"></canvas></div>`,
};
