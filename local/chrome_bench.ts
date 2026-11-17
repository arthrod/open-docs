/**
 * Headless Chrome CDP benchmark & functional verification for standalone `wordcraft-web`
 * and hosted `open-docs/e/wordcraft`.
 *
 * Usage:
 *   deno run -A local/chrome_bench.ts --tag baseline
 *   deno run -A local/chrome_bench.ts --tag final
 */

const args = new Map<string, string>();
for (let i = 0; i < Deno.args.length; i++) {
  const k = Deno.args[i];
  if (k.startsWith("--") && i + 1 < Deno.args.length) {
    args.set(k.slice(2), Deno.args[i + 1]);
    i++;
  }
}

const TAG = args.get("tag") ?? "run";
const STANDALONE_URL = args.get("standalone") ?? "http://127.0.0.1:8081/?sample";
const OPENDOCS_URL = args.get("opendocs") ?? "http://127.0.0.1:8090/e/wordcraft";
const CDP_PORT = Number(args.get("port") ?? "9233");
const CHROME_BIN = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

interface CdpMessage {
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { code: number; message: string; data?: string };
}

/** Longer than any expected CDP call (navigate, big Runtime.evaluate, screenshot). */
const REQUEST_TIMEOUT_MS = 120_000;

class CdpClient {
  private ws: WebSocket;
  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }
  >();
  public consoleErrors: string[] = [];
  public pageErrors: string[] = [];
  public failedRequests: string[] = [];

  private constructor(ws: WebSocket) {
    this.ws = ws;
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(String(ev.data)) as CdpMessage;
      if (msg.id !== undefined) {
        const entry = this.pending.get(msg.id);
        if (entry) {
          this.pending.delete(msg.id);
          clearTimeout(entry.timer);
          if (msg.error) {
            entry.reject(new Error(`CDP ${msg.error.code}: ${msg.error.message}`));
          } else {
            entry.resolve(msg.result);
          }
        }
        return;
      }
      if (msg.method === "Runtime.exceptionThrown") {
        const details = (msg.params?.exceptionDetails ?? {}) as Record<string, unknown>;
        const text = String(details.text ?? "Runtime exception");
        const ex = (details.exception ?? {}) as Record<string, unknown>;
        this.pageErrors.push(`${text}: ${ex.description ?? ex.value ?? ""}`);
      } else if (msg.method === "Runtime.consoleAPICalled") {
        const type = String(msg.params?.type ?? "");
        if (type === "error") {
          const items = (msg.params?.args ?? []) as Array<Record<string, unknown>>;
          this.consoleErrors.push(items.map((a) => String(a.value ?? a.description ?? "")).join(" "));
        }
      } else if (msg.method === "Network.loadingFailed") {
        const errText = String(msg.params?.errorText ?? "failed");
        const reqId = String(msg.params?.requestId ?? "");
        if (errText !== "net::ERR_ABORTED") {
          this.failedRequests.push(`${reqId}: ${errText}`);
        }
      }
    };
    this.ws.onclose = () => this.failPending(new Error("CDP WebSocket closed"));
    this.ws.onerror = () => this.failPending(new Error("CDP WebSocket error"));
  }

  /** Reject and drop every outstanding request (socket closed, client closed). */
  private failPending(err: Error) {
    const entries = [...this.pending.values()];
    this.pending.clear();
    for (const entry of entries) {
      clearTimeout(entry.timer);
      entry.reject(err);
    }
  }

  static async connect(wsUrl: string): Promise<CdpClient> {
    const ws = new WebSocket(wsUrl);
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = (e) => reject(new Error(`WebSocket error: ${e}`));
    });
    return new CdpClient(ws);
  }

  send<T = Record<string, unknown>>(
    method: string,
    params: Record<string, unknown> = {},
    timeoutMs = REQUEST_TIMEOUT_MS,
  ): Promise<T> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.delete(id)) {
          reject(new Error(`CDP request ${method} timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (v) => resolve(v as T),
        reject,
        timer,
      });
      try {
        this.ws.send(JSON.stringify({ id, method, params }));
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  async eval<T = unknown>(expression: string): Promise<T> {
    const res = await this.send<{
      result: { type: string; value?: T; description?: string };
      exceptionDetails?: { text?: string; exception?: { description?: string } };
    }>("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (res.exceptionDetails) {
      throw new Error(
        res.exceptionDetails.exception?.description ?? res.exceptionDetails.text ?? "Eval error",
      );
    }
    return res.result.value as T;
  }

  close() {
    this.failPending(new Error("CDP client closed"));
    try {
      this.ws.close();
    } catch {
      // ignore
    }
  }
}

async function waitForPort(port: number, timeoutMs = 15_000) {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    try {
      const resp = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (resp.ok) {
        await resp.body?.cancel();
        return;
      }
    } catch {
      // keep polling
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Chrome CDP port ${port} did not open within ${timeoutMs}ms`);
}

async function waitUntil<T>(
  label: string,
  fn: () => Promise<T | null | false | undefined>,
  timeoutMs = 90_000,
): Promise<T> {
  const start = performance.now();
  let lastErr = "";
  while (performance.now() - start < timeoutMs) {
    try {
      const res = await fn();
      if (res) return res;
    } catch (e) {
      lastErr = String(e);
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Timeout waiting for ${label} (${timeoutMs}ms)${lastErr ? `: ${lastErr}` : ""}`);
}

async function measureStandalone(client: CdpClient) {
  client.consoleErrors.length = 0;
  client.pageErrors.length = 0;
  client.failedRequests.length = 0;

  await client.send("Network.clearBrowserCache");
  const navStart = performance.now();
  await client.send("Page.navigate", { url: STANDALONE_URL });

  const readyInfo = await waitUntil("standalone wordcraft ready", () =>
    client.eval<{
      ready: boolean;
      hasWordcraft: boolean;
      hasGetMarkdown: boolean;
      hasExportDocx: boolean;
      loadingHidden: boolean;
      heapBytes: number;
    } | null>(`(() => {
      const loading = document.getElementById('wordcraft_loading');
      const loadingHidden = !loading || getComputedStyle(loading).display === 'none' || loading.hidden;
      const wc = window.wordcraft;
      if (!wc || !loadingHidden) return null;
      return {
        ready: true,
        hasWordcraft: Boolean(wc),
        hasGetMarkdown: typeof wc.getMarkdown === 'function',
        hasExportDocx: typeof wc.exportDocx === 'function',
        loadingHidden,
        heapBytes: (performance.memory && performance.memory.usedJSHeapSize) || 0,
      };
    })()`),
  );
  const readyMs = Math.round(performance.now() - navStart);

  // Measure round-trip bridge latencies and resource transfer stats.
  const bench = await client.eval<Record<string, unknown>>(`(async () => {
    const wc = window.wordcraft;
    const t0 = performance.now();
    const cmds = await wc.commands();
    const commandsMs = +(performance.now() - t0).toFixed(2);

    const t1 = performance.now();
    const inspect0 = await wc.docInspect();
    const docInspectMs = +(performance.now() - t1).toFixed(2);

    const t2 = performance.now();
    const ins = await wc.execute('text.insert', { text: ' Hello Chrome' });
    const textInsertMs = +(performance.now() - t2).toFixed(2);

    let getMarkdownMs = null;
    let mdLen = null;
    if (typeof wc.getMarkdown === 'function') {
      const t3 = performance.now();
      const md = await wc.getMarkdown();
      getMarkdownMs = +(performance.now() - t3).toFixed(2);
      mdLen = md.length;
    }

    let exportDocxMs = null;
    let docxLen = null;
    if (typeof wc.exportDocx === 'function') {
      const t4 = performance.now();
      const bytes = await wc.exportDocx();
      exportDocxMs = +(performance.now() - t4).toFixed(2);
      docxLen = bytes.length;
    }

    const resources = performance.getEntriesByType('resource').map((r) => ({
      name: r.name.replace(/^https?:\\/\\/[^/]+/, ''),
      transferSize: r.transferSize,
      encodedBodySize: r.encodedBodySize,
      decodedBodySize: r.decodedBodySize,
      duration: +r.duration.toFixed(1),
    }));

    return {
      commandCount: Array.isArray(cmds) ? cmds.length : -1,
      commandsMs,
      docInspectMs,
      textInsertMs,
      insertOk: ins && ins.ok !== false,
      getMarkdownMs,
      mdLen,
      exportDocxMs,
      docxLen,
      inspectParagraphs: inspect0 && inspect0.paragraphs ? inspect0.paragraphs.length : null,
      resources,
    };
  })()`);

  const shot = await client.send<{ data: string }>("Page.captureScreenshot", { format: "png" });
  const shotPath = `/tmp/wc-${TAG}-standalone.png`;
  const bin = Uint8Array.from(atob(shot.data), (c) => c.charCodeAt(0));
  await Deno.writeFile(shotPath, bin);

  return {
    url: STANDALONE_URL,
    readyMs,
    ...readyInfo,
    ...bench,
    screenshot: shotPath,
    consoleErrors: [...client.consoleErrors],
    pageErrors: [...client.pageErrors],
    failedRequests: [...client.failedRequests],
  };
}

async function measureOpenDocs(client: CdpClient) {
  client.consoleErrors.length = 0;
  client.pageErrors.length = 0;
  client.failedRequests.length = 0;

  await client.send("Network.clearBrowserCache");
  await client.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      window.__odCls = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) window.__odCls += entry.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    `,
  });

  const navStart = performance.now();
  await client.send("Page.navigate", { url: OPENDOCS_URL });

  const domInfo = await waitUntil("open-docs wordcraft mounted", () =>
    client.eval<{
      startupText: string;
      memText: string;
      sizeText: string;
      cls: number;
      heapBytes: number;
      hasWordcraft: boolean;
      previewImgPresent: boolean;
    } | null>(`(() => {
      const loading = document.getElementById('od-loading');
      const time = document.getElementById('od-m-time')?.textContent?.trim() ?? '';
      if (!loading || !loading.hidden || !time || time === '—' || time === '…') return null;
      return {
        startupText: time,
        memText: document.getElementById('od-m-mem')?.textContent?.trim() ?? '',
        sizeText: document.getElementById('od-m-size')?.textContent?.trim() ?? '',
        cls: +(window.__odCls || 0).toFixed(4),
        heapBytes: (performance.memory && performance.memory.usedJSHeapSize) || 0,
        hasWordcraft: Boolean(window.wordcraft),
        previewImgPresent: Boolean(document.querySelector('.od-preview, img[data-od-preview]')),
      };
    })()`),
  );
  const navToReadyMs = Math.round(performance.now() - navStart);

  // Measure WordCraft interaction inside open-docs + sample/assistant actions if present.
  const bridgeBench = await client.eval<Record<string, unknown>>(`(async () => {
    const wc = window.wordcraft;
    let commandsMs = null;
    let docInspectMs = null;
    let textInsertMs = null;
    let getMarkdownMs = null;
    let exportDocxMs = null;
    if (wc) {
      const t0 = performance.now();
      await wc.commands();
      commandsMs = +(performance.now() - t0).toFixed(2);

      const t1 = performance.now();
      await wc.docInspect();
      docInspectMs = +(performance.now() - t1).toFixed(2);

      const t2 = performance.now();
      await wc.execute('text.insert', { text: ' OpenDocs test' });
      textInsertMs = +(performance.now() - t2).toFixed(2);

      if (typeof wc.getMarkdown === 'function') {
        const t3 = performance.now();
        await wc.getMarkdown();
        getMarkdownMs = +(performance.now() - t3).toFixed(2);
      }
      if (typeof wc.exportDocx === 'function') {
        const t4 = performance.now();
        await wc.exportDocx();
        exportDocxMs = +(performance.now() - t4).toFixed(2);
      }
    }
    const resources = performance.getEntriesByType('resource').map((r) => ({
      name: r.name.replace(/^https?:\\/\\/[^/]+/, ''),
      transferSize: r.transferSize,
      encodedBodySize: r.encodedBodySize,
      decodedBodySize: r.decodedBodySize,
      duration: +r.duration.toFixed(1),
    }));
    const clsAfter = +(window.__odCls || 0).toFixed(4);
    return {
      commandsMs,
      docInspectMs,
      textInsertMs,
      getMarkdownMs,
      exportDocxMs,
      clsAfter,
      resources,
    };
  })()`);

  const shot = await client.send<{ data: string }>("Page.captureScreenshot", { format: "png" });
  const shotPath = `/tmp/wc-${TAG}-opendocs.png`;
  const bin = Uint8Array.from(atob(shot.data), (c) => c.charCodeAt(0));
  await Deno.writeFile(shotPath, bin);

  return {
    url: OPENDOCS_URL,
    navToReadyMs,
    ...domInfo,
    ...bridgeBench,
    screenshot: shotPath,
    consoleErrors: [...client.consoleErrors],
    pageErrors: [...client.pageErrors],
    failedRequests: [...client.failedRequests],
  };
}

async function main() {
  const userDataDir = `/tmp/wc-chrome-${TAG}-${Date.now()}`;
  const proc = new Deno.Command(CHROME_BIN, {
    args: [
      "--headless=new",
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${userDataDir}`,
      "--enable-webgl",
      "--use-angle=metal",
      "--ignore-gpu-blocklist",
      "--window-size=1280,900",
      "--no-first-run",
      "--no-default-browser-check",
      "about:blank",
    ],
    stdout: "null",
    stderr: "null",
  }).spawn();

  try {
    await waitForPort(CDP_PORT);
    const listResp = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
    const targets = (await listResp.json()) as Array<{ type: string; webSocketDebuggerUrl: string }>;
    const page = targets.find((t) => t.type === "page");
    if (!page) throw new Error("No page target found in Chrome CDP");

    const client = await CdpClient.connect(page.webSocketDebuggerUrl);
    try {
      await client.send("Page.enable");
      await client.send("Runtime.enable");
      await client.send("Network.enable");

      const standalone = await measureStandalone(client);
      const opendocs = await measureOpenDocs(client);
      const report = {
        tag: TAG,
        timestamp: new Date().toISOString(),
        standalone,
        opendocs,
      };
      console.log(JSON.stringify(report, null, 2));
    } finally {
      client.close();
    }
  } finally {
    try {
      proc.kill("SIGKILL");
      await proc.status;
    } catch {
      // ignore
    }
    try {
      await Deno.remove(userDataDir, { recursive: true });
    } catch {
      // ignore
    }
  }
}

await main();

