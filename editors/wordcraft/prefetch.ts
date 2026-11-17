export const WORDCRAFT_VERSION = "0.18.1";
export const WORDCRAFT_BASE = `/vendor/wordcraft/${WORDCRAFT_VERSION}/`;
export const WORDCRAFT_GLUE = "wordcraft-web-bc9cdbc0b42827ee.js";
export const WORDCRAFT_WASM = "wordcraft-web-bc9cdbc0b42827ee_bg.wasm";
export const WORDCRAFT_SNIPPET = "snippets/eframe-d31a8450ea12dfc1/inline0.js";

const RETRY_DELAYS_MS = [200, 600];

/** Fetch with 3-attempt exponential backoff (200ms, 600ms) for CDN/origin resilience. */
export async function cachedFetch(url: string, init?: RequestInit): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429)) {
        return res;
      }
      lastErr = new Error(`HTTP ${res.status} fetching ${url}`);
    } catch (err) {
      lastErr = err;
    }
    const delay = RETRY_DELAYS_MS[attempt];
    if (delay !== undefined) {
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

let prefetched = false;

/** Warm the browser cache with WordCraft's runtime assets before navigation. */
export function prefetchWordcraft(): void {
  if (prefetched || typeof window === "undefined") return;
  prefetched = true;
  for (const rel of [WORDCRAFT_GLUE, WORDCRAFT_SNIPPET, WORDCRAFT_WASM]) {
    const url = new URL(WORDCRAFT_BASE + rel, window.location.origin).href;
    void cachedFetch(url, { credentials: "same-origin" }).then((r) => r.arrayBuffer()).catch(() => {});
  }
}

