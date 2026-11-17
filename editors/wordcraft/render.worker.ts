/**
 * Worker half of renderDocxPages: the synchronous wasm render runs here, off
 * the request-serving thread, so a heavy .docx can be bounded by terminating
 * this worker on deadline.
 */
import { renderDocxPagesInline } from "./render.ts";

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<{ docx: Uint8Array; scale: number }>) => void) | null;
  postMessage: (msg: unknown, transfer?: Transferable[]) => void;
};

scope.onmessage = async (e) => {
  try {
    const pages = await renderDocxPagesInline(e.data.docx, e.data.scale);
    scope.postMessage({ ok: true, pages }, pages.map((p) => p.buffer));
  } catch (err) {
    scope.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
