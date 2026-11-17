import * as path from "jsr:@std/path@1";
import appFetch from "../index.ts";

const PORT = Number(Deno.env.get("PORT") ?? "8090");
const LOCAL_DIST = Deno.env.get("WORDCRAFT_LOCAL_DIST") ?? "";
const BASELINE_MODE = Deno.env.get("WORDCRAFT_BASELINE_REMAP") === "1";

const MIME: Record<string, string> = {
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".wasm": "application/wasm",
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
  ".tsv": "text/tab-separated-values; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

async function findDistFile(rel: string): Promise<string | null> {
  if (!LOCAL_DIST) return null;
  const direct = path.resolve(LOCAL_DIST, rel);
  if (direct.startsWith(path.resolve(LOCAL_DIST))) {
    try {
      const s = await Deno.stat(direct);
      if (s.isFile) return direct;
    } catch { /* fall through */ }
  }
  // Baseline remap: map 0.16.0 hashed filenames from open-docs/editors/wordcraft/main.ts
  // onto whatever hashed filenames Trunk produced in LOCAL_DIST.
  if (BASELINE_MODE) {
    if (rel === "wordcraft-web-9242e10ddc86b8c1.js") {
      for await (const e of Deno.readDir(LOCAL_DIST)) {
        if (e.isFile && /^wordcraft-web-.*\.js$/.test(e.name)) {
          return path.join(LOCAL_DIST, e.name);
        }
      }
    }
    if (rel === "wordcraft-web-9242e10ddc86b8c1_bg.wasm") {
      for await (const e of Deno.readDir(LOCAL_DIST)) {
        if (e.isFile && /^wordcraft-web-.*_bg\.wasm$/.test(e.name)) {
          return path.join(LOCAL_DIST, e.name);
        }
      }
    }
    if (rel.startsWith("snippets/")) {
      const snippetsDir = path.join(LOCAL_DIST, "snippets");
      try {
        for await (const sub of Deno.readDir(snippetsDir)) {
          if (sub.isDirectory && sub.name.startsWith("eframe-")) {
            const candidate = path.join(snippetsDir, sub.name, "inline0.js");
            const s = await Deno.stat(candidate).catch(() => null);
            if (s?.isFile) return candidate;
          }
        }
      } catch { /* ignore */ }
    }
  }
  return null;
}

console.log(`[open-docs/local] serving on http://127.0.0.1:${PORT} (LOCAL_DIST=${LOCAL_DIST || "none"})`);

Deno.serve({ hostname: "127.0.0.1", port: PORT }, async (req) => {
  const url = new URL(req.url);
  if (LOCAL_DIST && url.pathname.startsWith("/vendor/wordcraft/")) {
    // Strip `/vendor/wordcraft/<version>/`
    const rest = url.pathname.replace(/^\/vendor\/wordcraft\/[^/]+\//, "");
    const file = await findDistFile(rest);
    if (file) {
      const ext = path.extname(file).toLowerCase();
      const ct = MIME[ext] ?? "application/octet-stream";
      const acceptEnc = req.headers.get("accept-encoding") ?? "";
      // Serve pre-compressed .gz if present and client accepts gzip
      if (acceptEnc.includes("gzip")) {
        const gz = file + ".gz";
        const s = await Deno.stat(gz).catch(() => null);
        if (s?.isFile) {
          const bytes = await Deno.readFile(gz);
          return new Response(bytes, {
            headers: {
              "content-type": ct,
              "content-encoding": "gzip",
              "cache-control": "public, max-age=31536000, immutable",
              "access-control-allow-origin": "*",
              "timing-allow-origin": "*",
            },
          });
        }
      }
      const bytes = await Deno.readFile(file);
      return new Response(bytes, {
        headers: {
          "content-type": ct,
          "cache-control": ext === ".wasm" || ext === ".js" ? "public, max-age=31536000, immutable" : "no-cache",
          "access-control-allow-origin": "*",
          "timing-allow-origin": "*",
        },
      });
    }
  }
  return await appFetch(req);
});

