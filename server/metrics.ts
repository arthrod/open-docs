/**
 * Page-load measurements, one row per editor visit, in the val's SQLite.
 *
 * The browser measures (see lib/metrics.ts) and POSTs a row; the landing page
 * reads per-editor medians. Medians, not means: a single cold-cache visit
 * (Docxodus downloading its .NET runtime) shouldn't define an editor.
 */
import { sqlite } from "https://esm.town/v/std/sqlite/main.ts";

const TABLE = "od_metrics_1";

export interface MetricInput {
  slug: string;
  /** Navigation start → editor usable, ms. */
  startupMs: number;
  /** adapter.mount() alone, ms. */
  mountMs: number;
  /** usedJSHeapSize after mount, bytes (Chromium only; null elsewhere). */
  heapBytes: number | null;
  /** Bytes of JS/CSS/WASM/fonts the page loaded (decoded). */
  loadedBytes: number;
  /** Bytes that actually crossed the network (0 for cached / opaque). */
  transferBytes: number;
  resources: number;
  /** True when most bytes came from the HTTP cache. */
  warm: boolean;
}

let ready: Promise<unknown> | undefined;
function ensureTable() {
  ready ??= sqlite.execute(`CREATE TABLE IF NOT EXISTS ${TABLE} (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL,
    startup_ms REAL NOT NULL,
    mount_ms REAL NOT NULL,
    heap_bytes REAL,
    loaded_bytes REAL NOT NULL,
    transfer_bytes REAL NOT NULL,
    resources INTEGER NOT NULL,
    warm INTEGER NOT NULL,
    ua TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  return ready;
}

// Only real numbers count: Number(null) is 0, and Firefox/Safari send
// `heapBytes: null` (no performance.memory) — that must stay null, not 0.
const num = (v: unknown, max = 1e12) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v < max ? v : null;

export async function recordMetric(m: MetricInput, ua: string) {
  const startup = num(m.startupMs, 600_000);
  const mount = num(m.mountMs, 600_000);
  const loaded = num(m.loadedBytes, 1e10);
  if (startup === null || mount === null || loaded === null) return;
  await ensureTable();
  await sqlite.execute({
    sql: `INSERT INTO ${TABLE} (slug, startup_ms, mount_ms, heap_bytes, loaded_bytes, transfer_bytes, resources, warm, ua)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      m.slug,
      startup,
      mount,
      num(m.heapBytes, 1e11),
      loaded,
      num(m.transferBytes, 1e10) ?? 0,
      Math.round(num(m.resources, 1e6) ?? 0),
      m.warm ? 1 : 0,
      ua.slice(0, 200),
    ],
  });
}

export interface MetricSummary {
  slug: string;
  samples: number;
  startupMs: number | null;
  coldStartupMs: number | null;
  mountMs: number | null;
  heapBytes: number | null;
  loadedBytes: number | null;
  resources: number | null;
}

function median(xs: number[]): number | null {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = v.length >> 1;
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/** Per-editor medians over the most recent 200 rows each. */
export async function summarizeMetrics(): Promise<Record<string, MetricSummary>> {
  await ensureTable();
  const res = await sqlite.execute(
    // The 200 most recent rows PER editor, so a busy editor can't push a quiet
    // one out of the window.
    `SELECT slug, startup_ms, mount_ms, heap_bytes, loaded_bytes, resources, warm FROM (
       SELECT *, ROW_NUMBER() OVER (PARTITION BY slug ORDER BY id DESC) AS rn FROM ${TABLE}
     ) WHERE rn <= 200`,
  );
  const by = new Map<string, any[]>();
  for (const r of res.rows as any[]) {
    const row = Array.isArray(r)
      ? { slug: r[0], startup_ms: r[1], mount_ms: r[2], heap_bytes: r[3], loaded_bytes: r[4], resources: r[5], warm: r[6] }
      : r;
    const list = by.get(row.slug) ?? [];
    list.push(row);
    by.set(row.slug, list);
  }
  const out: Record<string, MetricSummary> = {};
  for (const [slug, rows] of by) {
    out[slug] = {
      slug,
      samples: rows.length,
      startupMs: median(rows.map((r) => Number(r.startup_ms))),
      coldStartupMs: median(rows.filter((r) => !Number(r.warm)).map((r) => Number(r.startup_ms))),
      mountMs: median(rows.map((r) => Number(r.mount_ms))),
      heapBytes: median(rows.filter((r) => r.heap_bytes != null).map((r) => Number(r.heap_bytes))),
      loadedBytes: median(rows.map((r) => Number(r.loaded_bytes))),
      resources: median(rows.map((r) => Number(r.resources))),
    };
  }
  return out;
}
