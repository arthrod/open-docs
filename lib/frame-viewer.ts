/**
 * Adapter for viewers that live on someone else's server and fetch the
 * document themselves (Microsoft's Office Online viewer, Google's viewer).
 *
 * They take a PUBLIC URL, never bytes: so they can show this site's samples
 * (/api/showcase.docx, /api/sample.docx) but not the user's own file — that
 * would mean publishing it. View-only: no editing, no assistant, no export.
 *
 * Measurement: the frame is cross-origin, so this page sees only the frame's
 * load event — not when the server finished rendering, nor its bytes/memory.
 */
import { waitFor, type EditorAdapter } from "/lib/kit.ts";

export function frameViewer(name: string, viewerUrl: (docUrl: string) => string): EditorAdapter {
  let frame: HTMLIFrameElement;

  const show = (path: string) =>
    new Promise<void>((resolve, reject) => {
      // Cache-bust per load so the viewer re-fetches rather than showing its copy.
      const src = () => viewerUrl(`${location.origin}${path}?v=${Date.now().toString(36)}`);
      // Google's gview now and then never answers (seen 2026-11-09: no load
      // event in 60s, fine on the next try): ask once more after 20s.
      const retry = setTimeout(() => {
        window.od.progress(`${name} is slow to answer — asking again…`);
        frame.src = src();
      }, 20_000);
      const timer = setTimeout(() => {
        clearTimeout(retry);
        reject(new Error(`${name} did not load within 60s`));
      }, 60_000);
      frame.addEventListener("load", () => {
        clearTimeout(retry);
        clearTimeout(timer);
        resolve();
      }, { once: true });
      frame.src = src();
    });

  return {
    name,
    viewOnly: true,
    acceptsFiles: false,
    async mount() {
      frame = await waitFor<HTMLIFrameElement>("#vw-frame");
      window.od.progress(`Loading ${name} (rendered on its own servers)…`);
      await show("/api/showcase.docx");
    },
    loadUrl: show,
    load() {
      return Promise.reject(new Error(`${name} only opens documents from a public link`));
    },
    getMarkdown: () => Promise.reject(new Error(`${name} is view-only`)),
    applyMarkdown: () => Promise.reject(new Error(`${name} is view-only`)),
  };
}
