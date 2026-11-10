/**
 * WordCraft's browser build, served from this val (server-side module).
 *
 * WordCraft (storytold/wordcraft) is a Rust word processor; its release ships
 * `wordcraft-web-<v>.zip`, a static site: wasm-bindgen glue (.js), one eframe
 * snippet and the app as a ~60 MB .wasm. Val files are text-only and nothing
 * mirrors release assets with CORS, so the first request for a missing file:
 *
 *   1. downloads the pinned release zip from GitHub,
 *   2. checks it against the SHA-256 pinned below (from the release's
 *      SHA256SUMS.txt),
 *   3. stores the three runtime files, gzipped, in this val's blob storage,
 *
 * and every request after that streams the stored file with
 * `content-encoding: gzip` (22 MB on the wire for the wasm) and an immutable
 * cache header: the names carry content hashes, as HOSTING.md recommends.
 */
import { blob } from "https://esm.town/v/std/blob/main.ts";
import { unzipSync } from "https://esm.sh/fflate@0.8.2";

export const WORDCRAFT_VERSION = "0.17.0";
const ZIP_URL =
  `https://github.com/storytold/wordcraft/releases/download/v${WORDCRAFT_VERSION}/wordcraft-web-${WORDCRAFT_VERSION}.zip`;
const ZIP_SHA256 = "713f5e4b01427eb262c70e280e55d1354fa530e5a351b9751ebbe37398ea2ed0";

/** Runtime files (paths relative to the zip's site folder). */
export const WORDCRAFT_GLUE = "wordcraft-web-d5f8e062bd3e686e.js";
export const WORDCRAFT_WASM = "wordcraft-web-d5f8e062bd3e686e_bg.wasm";
const FILES: Record<string, string> = {
  [WORDCRAFT_GLUE]: "text/javascript; charset=utf-8",
  [WORDCRAFT_WASM]: "application/wasm",
  "snippets/eframe-d31a8450ea12dfc1/inline0.js": "text/javascript; charset=utf-8",
};

/** URL prefix the browser loads the files from. */
export const WORDCRAFT_BASE = `/vendor/wordcraft/${WORDCRAFT_VERSION}/`;
const key = (path: string) => `od_wordcraft_${WORDCRAFT_VERSION}_${path.replaceAll("/", "__")}.gz`;

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

let installing: Promise<void> | undefined;

/** Download, verify and store the release's runtime files (once per isolate). */
function install(): Promise<void> {
  installing ??= (async () => {
    const res = await fetch(ZIP_URL);
    if (!res.ok) throw new Error(`wordcraft release download: ${res.status}`);
    const zip = new Uint8Array(await res.arrayBuffer());
    const digest = hex(await crypto.subtle.digest("SHA-256", zip));
    if (digest !== ZIP_SHA256) throw new Error(`wordcraft release checksum mismatch: ${digest}`);
    const root = `wordcraft-web-${WORDCRAFT_VERSION}/`;
    const wanted = new Set(Object.keys(FILES).map((p) => root + p));
    const files = unzipSync(zip, { filter: (f) => wanted.has(f.name) });
    for (const path of Object.keys(FILES)) {
      const bytes = files[root + path];
      if (!bytes) throw new Error(`wordcraft release is missing ${path}`);
      await blob.set(key(path), await gzip(bytes));
    }
  })().catch((err) => {
    installing = undefined; // let the next request retry
    throw err;
  });
  return installing;
}

/** Hono-style handler body for `GET /vendor/wordcraft/<version>/<path>`. */
export async function serveWordcraft(path: string): Promise<Response> {
  const type = FILES[path];
  if (!type) return new Response("not found", { status: 404 });
  let stored = await blob.get(key(path)).catch(() => undefined);
  if (!stored?.ok) {
    await install();
    stored = await blob.get(key(path));
  }
  return new Response(stored.body, {
    headers: {
      "content-type": type,
      "content-encoding": "gzip",
      "cache-control": "public, max-age=31536000, immutable",
      "access-control-allow-origin": "*",
      "timing-allow-origin": "*",
    },
  });
}
