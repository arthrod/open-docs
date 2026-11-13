import init, { render_docx } from "../../tools/wordcraft-render/dist/wc_render.js";

const WASM_GZ_URL = new URL("../../tools/wordcraft-render/dist/wc_render_bg.wasm.gz", import.meta.url);
let ready: Promise<void> | undefined;

/** Largest .docx the preview endpoints will render at all. */
export const DOCX_PREVIEW_MAX_BYTES = 25 * 1024 * 1024;
/** Wall-clock budget for one preview render; past it the render worker is killed. */
export const DOCX_PREVIEW_TIMEOUT_MS = 30_000;

async function readWasmGz(): Promise<Uint8Array> {
  if (WASM_GZ_URL.protocol === "file:") {
    return await Deno.readFile(WASM_GZ_URL);
  }
  const res = await fetch(WASM_GZ_URL);
  if (!res.ok) throw new Error(`Failed to fetch wc_render_bg.wasm.gz: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function gunzip(gz: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([gz.slice()]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function ensureInit(): Promise<void> {
  ready ??= (async () => {
    const gz = await readWasmGz();
    const wasmBytes = await gunzip(gz);
    await init({ module_or_path: wasmBytes });
  })().catch((err) => {
    ready = undefined;
    throw err;
  });
  return ready;
}

/**
 * Render in this isolate. Runs inside the render worker, where termination
 * bounds it; it is never called on the request-serving thread, where nothing
 * could stop the synchronous wasm render.
 */
export async function renderDocxPagesInline(docx: Uint8Array, scale = 1.0): Promise<Uint8Array[]> {
  await ensureInit();
  const pages = render_docx(docx, scale);
  return Array.from(pages, (p) => (p instanceof Uint8Array ? p : new Uint8Array(p)));
}

/** Set false when the runtime can't spawn workers, so later calls skip trying. */
let workerUsable = true;

function renderInWorker(docx: Uint8Array, scale: number, timeoutMs: number): Promise<Uint8Array[]> {
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL("./render.worker.ts", import.meta.url), { type: "module" });
    } catch (err) {
      workerUsable = false;
      reject(err instanceof Error ? err : new Error(String(err)));
      return;
    }
    const done = (fn: () => void) => {
      clearTimeout(timer);
      worker.terminate();
      fn();
    };
    const timer = setTimeout(() => {
      done(() => reject(new Error(`docx render timed out after ${timeoutMs}ms`)));
    }, timeoutMs);
    worker.onerror = (e) => {
      // Module/startup failure means workers don't run here; render errors
      // arrive as { ok: false } messages instead.
      workerUsable = false;
      e.preventDefault();
      done(() => reject(new Error(`render worker failed: ${e.message || "error"}`)));
    };
    worker.onmessage = (e) => {
      const data = e.data as { ok?: boolean; pages?: Uint8Array[]; error?: string };
      if (data.ok && data.pages) done(() => resolve(data.pages!));
      else done(() => reject(new Error(data.error ?? "render worker failed")));
    };
    worker.postMessage({ docx, scale });
  });
}

/**
 * Render every page of a `.docx` package as PNG byte arrays using headless
 * WordCraft. Bounded: input size is capped, and the synchronous wasm render
 * runs in a worker that is terminated after `timeoutMs`.
 */
export async function renderDocxPages(
  docx: Uint8Array,
  scale = 1.0,
  opts: { maxBytes?: number; timeoutMs?: number } = {},
): Promise<Uint8Array[]> {
  const maxBytes = opts.maxBytes ?? DOCX_PREVIEW_MAX_BYTES;
  if (docx.byteLength > maxBytes) {
    throw new Error(`document too large to render (${docx.byteLength} bytes > ${maxBytes})`);
  }
  let workerErr: unknown;
  if (workerUsable && typeof Worker === "function") {
    try {
      return await renderInWorker(docx, scale, opts.timeoutMs ?? DOCX_PREVIEW_TIMEOUT_MS);
    } catch (err) {
      // A worker that never ran leaves workerUsable=false; a real render
      // error or timeout (workerUsable still true) propagates.
      if (workerUsable) throw err;
      workerErr = err;
    }
  }
  // Only a worker can bound the synchronous wasm render to timeoutMs, so with
  // no worker boundary the preview is rejected rather than run unbounded on
  // the request-serving thread.
  throw new Error(
    "docx preview unavailable: this runtime cannot run render workers" +
      (workerErr instanceof Error ? ` (${workerErr.message})` : ""),
  );
}
