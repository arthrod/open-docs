/**
 * What an editor costs, measured in the user's own browser on every load.
 *
 *  - startup: navigation start → the adapter's mount() resolved (editor usable).
 *  - mount:   adapter.mount() alone (library import + first render).
 *  - JS heap: performance.memory.usedJSHeapSize after the editor settles
 *             (Chromium only — other browsers don't expose heap size).
 *  - loaded:  bytes of every script, stylesheet, font and WASM file the page
 *             pulled in (decoded size). Cross-origin CDNs that don't send
 *             Timing-Allow-Origin report 0 to the Resource Timing API, so those
 *             files are re-read from the HTTP cache to get their real size.
 */

export interface ResourceRow {
  url: string;
  origin: string;
  kind: string;
  bytes: number;
  transfer: number;
}

export interface Measurement {
  slug: string;
  startupMs: number;
  mountMs: number;
  /** HTML parsed → adapter module registered. */
  moduleMs: number | null;
  heapBytes: number | null;
  heapTotalBytes: number | null;
  loadedBytes: number;
  transferBytes: number;
  resources: number;
  warm: boolean;
  rows: ResourceRow[];
}

const SKIP = /\/api\/(log|metrics|agent|import|export)|std\/catch|chrome-extension:/;

function kindOf(e: PerformanceResourceTiming): string {
  const u = e.name.split("?")[0].toLowerCase();
  if (u.endsWith(".wasm") || u.includes("/_framework/")) return "wasm/.NET";
  if (/\.(woff2?|ttf|otf)$/.test(u)) return "font";
  if (u.endsWith(".css") || e.initiatorType === "link" || u.includes("styles.css")) return "css";
  if (/\.(png|jpe?g|svg|gif|webp)$/.test(u)) return "image";
  if (u.endsWith(".docx") || u.includes("/api/")) return "document";
  return "script";
}

/** Read a cached response's length without hitting the network twice. */
async function cachedSize(url: string): Promise<number> {
  try {
    const res = await fetch(url, { cache: "force-cache", mode: "cors", credentials: "omit" });
    if (!res.ok) return 0;
    return (await res.arrayBuffer()).byteLength;
  } catch {
    return 0;
  }
}

async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}

export async function measure(opts: {
  slug: string;
  mountStart: number;
  mountEnd: number;
  registeredAt?: number;
  extraUrls?: string[];
}): Promise<Measurement> {
  const entries = (performance.getEntriesByType("resource") as PerformanceResourceTiming[])
    .filter((e) => !SKIP.test(e.name));
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;

  const rows: ResourceRow[] = [];
  const seen = new Set<string>();
  const unknown: ResourceRow[] = [];
  // Resource Timing sizes are only visible same-origin or with Timing-Allow-Origin.
  let taoEncoded = 0, taoTransfer = 0;
  for (const e of entries) {
    if (seen.has(e.name)) continue;
    seen.add(e.name);
    const row: ResourceRow = {
      url: e.name,
      origin: new URL(e.name).host,
      kind: kindOf(e),
      bytes: e.decodedBodySize || 0,
      transfer: e.transferSize || 0,
    };
    if (e.decodedBodySize > 0) {
      taoEncoded += e.encodedBodySize || 0;
      taoTransfer += e.transferSize || 0;
    }
    rows.push(row);
    if (!row.bytes) unknown.push(row);
  }
  for (const url of opts.extraUrls ?? []) {
    if (seen.has(url)) continue;
    seen.add(url);
    const row: ResourceRow = { url, origin: new URL(url).host, kind: "worker", bytes: 0, transfer: 0 };
    rows.push(row);
    unknown.push(row);
  }
  await pool(unknown, 8, async (r) => {
    r.bytes = await cachedSize(r.url);
  });
  if (nav) {
    rows.unshift({
      url: location.href,
      origin: location.host,
      kind: "html",
      bytes: nav.decodedBodySize || 0,
      transfer: nav.transferSize || 0,
    });
  }

  const mem = (performance as unknown as {
    memory?: { usedJSHeapSize: number; totalJSHeapSize: number };
  }).memory;
  const t0 = (window as unknown as { __OD_T0?: number }).__OD_T0 ?? 0;

  return {
    slug: opts.slug,
    startupMs: Math.round(opts.mountEnd),
    mountMs: Math.round(opts.mountEnd - opts.mountStart),
    moduleMs: opts.registeredAt ? Math.round(opts.registeredAt - t0) : null,
    heapBytes: mem?.usedJSHeapSize ?? null,
    heapTotalBytes: mem?.totalJSHeapSize ?? null,
    loadedBytes: rows.reduce((s, r) => s + r.bytes, 0),
    transferBytes: rows.reduce((s, r) => s + r.transfer, 0),
    resources: rows.length,
    // Warm = the visible bodies mostly came from cache. Compare transfer with
    // the ENCODED (compressed) size — against decoded size, a gzip'd cold load
    // would look cached. A 304 revalidation transfers only ~300 B of headers.
    // No visible bytes → unknown, recorded as cold.
    warm: taoEncoded > 0 && taoTransfer / taoEncoded < 0.2,
    rows,
  };
}

export const fmtBytes = (n: number | null | undefined): string => {
  if (n == null || !Number.isFinite(n)) return "n/a";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
};

export const fmtMs = (n: number | null | undefined): string => {
  if (n == null || !Number.isFinite(n)) return "n/a";
  return n < 1000 ? `${Math.round(n)} ms` : `${(n / 1000).toFixed(n < 10_000 ? 2 : 1)} s`;
};
