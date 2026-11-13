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
  #wc-host { position: relative; height: 100%; min-height: 0; background: #e6e6e6; overflow: hidden; }
  #wc-skeleton { position: absolute; inset: 0; z-index: 2; display: flex; align-items: flex-start; justify-content: center; padding: 28px 16px; pointer-events: none; transition: opacity 150ms ease-out; background: #e6e6e6; }
  #wc-skeleton.wc-done { opacity: 0; }
  .wc-page-frame { width: min(680px, 100%); aspect-ratio: 8.5 / 11; background: #fff; border-radius: 2px; box-shadow: 0 2px 10px rgba(0,0,0,0.10); overflow: hidden; }
  .wc-page-frame .od-preview { width: 100%; height: 100%; object-fit: contain; display: block; }
  #wordcraft_canvas { position: absolute; inset: 0; z-index: 1; width: 100%; height: 100%; display: block; outline: none; }
</style>`,
  body: `<div id="wc-host"><canvas id="wordcraft_canvas" data-host="page" tabindex="0"></canvas><div id="wc-skeleton" aria-hidden="true"><div class="wc-page-frame"><img class="od-preview" data-od-preview alt="" src="/api/wordcraft/preview?doc=sample" /></div></div></div>`,
};
