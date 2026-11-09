/**
 * Google's embeddable document viewer. No key.
 * https://docs.google.com/gview?embedded=true&url=<public .docx URL>
 */
import { frameViewer } from "/lib/frame-viewer.ts";

window.od.register(frameViewer(
  "Google Docs viewer",
  (doc) => `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(doc)}`,
));
