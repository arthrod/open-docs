import init, { render_docx } from "../../tools/wordcraft-render/dist/wc_render.js";

const WASM_GZ_URL = new URL("../../tools/wordcraft-render/dist/wc_render_bg.wasm.gz", import.meta.url);
let ready: Promise<void> | undefined;

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

/** Render every page of a `.docx` package as PNG byte arrays using headless WordCraft. */
export async function renderDocxPages(docx: Uint8Array, scale = 1.0): Promise<Uint8Array[]> {
  await ensureInit();
  const pages = render_docx(docx, scale);
  return Array.from(pages, (p) => (p instanceof Uint8Array ? p : new Uint8Array(p)));
}
