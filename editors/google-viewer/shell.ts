/** Server-side shell for Google's document viewer (view-only, proprietary). */
const FRAME_BODY = `<div style="position:relative;height:100%;min-height:0;background:#eef1f5">
  <iframe id="vw-frame" title="Google Docs viewer" referrerpolicy="no-referrer"
    style="position:absolute;inset:0;width:100%;height:100%;border:0;background:#fff"></iframe></div>`;

export default {
  slug: "google-viewer",
  title: "Google Docs viewer",
  entry: "/editors/google-viewer/main.ts",
  body: FRAME_BODY,
};
