import * as path from "jsr:@std/path@1";

const ROOT = path.resolve(path.dirname(path.fromFileUrl(import.meta.url)), "..");
const BLOB_DIR = path.join(ROOT, ".local-state", "blobs");
const METRICS_FILE = path.join(ROOT, ".local-state", "metrics.json");

const MIME: Record<string, string> = {
  ".ts": "text/javascript; charset=utf-8",
  ".tsx": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".wasm": "application/wasm",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".tsv": "text/tab-separated-values; charset=utf-8",
};

const tsCache = new Map<string, { mtimeMs: number; code: string }>();
const BUN_BIN = Deno.env.get("BUN_BIN") ?? "bun";

async function transpileTs(filePath: string, source: string, mtimeMs: number): Promise<string> {
  const hit = tsCache.get(filePath);
  if (hit && hit.mtimeMs === mtimeMs) return hit.code;
  const cmd = new Deno.Command(BUN_BIN, {
    args: [
      "-e",
      "const fs=require('fs');const src=fs.readFileSync(0,'utf8');const t=new Bun.Transpiler({loader:'ts'});process.stdout.write(t.transformSync(src));",
    ],
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
  });
  const child = cmd.spawn();
  const writer = child.stdin.getWriter();
  await writer.write(new TextEncoder().encode(source));
  await writer.close();
  const out = await child.output();
  if (!out.success) {
    throw new Error(`TS transpile failed for ${filePath}: ${new TextDecoder().decode(out.stderr)}`);
  }
  const code = new TextDecoder().decode(out.stdout);
  tsCache.set(filePath, { mtimeMs, code });
  return code;
}

export async function serveFile(reqPath: string, _baseUrl?: string): Promise<Response> {
  const clean = decodeURIComponent(reqPath.split("?")[0]).replace(/^\/+/, "");
  const full = path.resolve(ROOT, clean);
  const rel = path.relative(ROOT, full);
  if (rel === ".." || rel.startsWith(`..${path.SEPARATOR}`) || path.isAbsolute(rel)) {
    return new Response("forbidden", { status: 403 });
  }
  try {
    const stat = await Deno.stat(full);
    if (!stat.isFile) return new Response("not found", { status: 404 });
    const ext = path.extname(full).toLowerCase();
    const contentType = MIME[ext] ?? "application/octet-stream";
    if (ext === ".ts" || ext === ".tsx") {
      const src = await Deno.readTextFile(full);
      const js = await transpileTs(full, src, stat.mtime?.getTime() ?? Date.now());
      return new Response(js, {
        headers: { "content-type": contentType, "cache-control": "no-cache" },
      });
    }
    const bytes = await Deno.readFile(full);
    return new Response(bytes, {
      headers: { "content-type": contentType, "cache-control": "no-cache" },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}

export function parseVal() {
  return {
    links: {
      self: { val: "http://127.0.0.1:8090" },
    },
  };
}

export const blob = {
  async get(key: string): Promise<Response> {
    try {
      const data = await Deno.readFile(path.join(BLOB_DIR, encodeURIComponent(key)));
      return new Response(data, { status: 200 });
    } catch {
      return new Response("not found", { status: 404 });
    }
  },
  async set(key: string, value: Uint8Array | ArrayBuffer | string): Promise<void> {
    await Deno.mkdir(BLOB_DIR, { recursive: true });
    const bytes =
      typeof value === "string"
        ? new TextEncoder().encode(value)
        : value instanceof Uint8Array
          ? value
          : new Uint8Array(value);
    await Deno.writeFile(path.join(BLOB_DIR, encodeURIComponent(key)), bytes);
  },
};

type MetricRow = Record<string, unknown>;
let metricRows: MetricRow[] = [];
try {
  metricRows = JSON.parse(await Deno.readTextFile(METRICS_FILE));
} catch {
  metricRows = [];
}

// Writes chain on this promise so overlapping inserts can't complete out of
// order; each op writes a temp file and renames it over METRICS_FILE so the
// file is never left partially written.
let metricsWrite: Promise<unknown> = Promise.resolve();

function persistMetrics(): Promise<void> {
  const snapshot = JSON.stringify(metricRows);
  const op = metricsWrite.then(async () => {
    const tmp = `${METRICS_FILE}.tmp`;
    await Deno.writeTextFile(tmp, snapshot);
    await Deno.rename(tmp, METRICS_FILE);
  });
  metricsWrite = op.catch(() => undefined);
  return op;
}

export const sqlite = {
  async execute(input: string | { sql: string; args?: unknown[] }): Promise<{ rows: MetricRow[] }> {
    const sql = typeof input === "string" ? input : input.sql;
    const args = typeof input === "string" ? [] : (input.args ?? []);
    if (/CREATE TABLE/i.test(sql)) {
      return { rows: [] };
    }
    if (/INSERT INTO/i.test(sql)) {
      metricRows.push({
        id: metricRows.length + 1,
        slug: args[0],
        startup_ms: args[1],
        mount_ms: args[2],
        heap_bytes: args[3],
        loaded_bytes: args[4],
        transfer_bytes: args[5],
        resources: args[6],
        warm: args[7],
        ua: args[8],
      });
      await Deno.mkdir(path.dirname(METRICS_FILE), { recursive: true });
      await persistMetrics();
      return { rows: [] };
    }
    if (/SELECT .* FROM/i.test(sql)) {
      return { rows: metricRows.slice(-200) };
    }
    return { rows: [] };
  },
};

export class OpenAI {
  chat = {
    completions: {
      async create() {
        return {
          model: "local-stub",
          choices: [{ message: { content: "Local assistant offline in local bench." } }],
        };
      },
    },
  };
}

