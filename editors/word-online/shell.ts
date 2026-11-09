/** Server-side shell for Microsoft's Office Online viewer (view-only, proprietary). */
const FRAME_BODY = `<div style="position:relative;height:100%;min-height:0;background:#eef1f5">
  <iframe id="vw-frame" title="Microsoft Word viewer" referrerpolicy="no-referrer"
    style="position:absolute;inset:0;width:100%;height:100%;border:0;background:#fff"></iframe></div>`;

export default {
  slug: "word-online",
  title: "Microsoft Word viewer",
  entry: "/editors/word-online/main.ts",
  body: FRAME_BODY,
};
