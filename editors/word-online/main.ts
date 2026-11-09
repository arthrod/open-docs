/**
 * Microsoft's Office Online viewer: Word's own renderer, embedded. No key.
 * https://view.officeapps.live.com/op/embed.aspx?src=<public .docx URL>
 */
import { frameViewer } from "/lib/frame-viewer.ts";

window.od.register(frameViewer(
  "Microsoft Word viewer",
  (doc) => `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(doc)}`,
));
