/**
 * Shared chrome: the top bar, metrics, the assistant panel, and the handshake
 * with `lib/boot.ts`.
 *
 * It SUBSCRIBES to `window.od.onAdapter` rather than replacing `register` —
 * the shell loads the adapter before this file, so replacing it would miss the
 * adapter entirely (the original "nothing mounts" bug).
 */
import { mdToBlocks } from "./md.ts";
import type { EditorAdapter } from "./kit.ts";
import {
  childError,
  childExported,
  childMenu,
  childOpened,
  childReady,
  type ChildMessage,
  embedFileName,
  isEmbedUrl,
  parseArenaMessage,
} from "./embed.ts";
import { fmtBytes, fmtMs, type Measurement, measure } from "./metrics.ts";
import { LoadQueue, longTasksSupported, OpenOwner, settledMs as settledAfter } from "./open-timing.ts";

const slug = document.body.dataset.slug ?? "";
const editorName = document.body.dataset.name ?? slug;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T | null;

/** Embed mode (?embed=1): editors-arena drives this page from an iframe. */
const embed = isEmbedUrl(location.href);
if (embed) document.body.classList.add("od-embed");
/** Only embed mode ever posts, and only to the embedding parent. */
const postChild = (msg: ChildMessage, transfer?: Transferable[]) => {
  if (!embed) return;
  if (transfer && transfer.length) window.parent.postMessage(msg, "*", transfer);
  else window.parent.postMessage(msg, "*");
};
/** A parent message that arrived before the adapter mounted; run after. */
let pendingEmbedAction: (() => void) | undefined;

let current: EditorAdapter | undefined;
let mounted = false;
let busy = false;
let lastMeasurement: Measurement | undefined;
/** "Re-measure now": the same reading taken again later, with when it was taken. */
let nowMeasurement: { m: Measurement; at: Date } | undefined;
let measureArgs: { adapter: EditorAdapter; mountStart: number; mountEnd: number } | undefined;
const history: Array<{ role: "user" | "assistant"; content: string }> = [];
/**
 * Bumped whenever a different document is opened (New / Sample / Import). An
 * assistant edit computed for generation N must never land on generation N+1.
 */
let docGen = 0;
/**
 * Applied assistant edits, oldest first. Undo steps the engine's own history,
 * which unwinds newest first, so only the TOP of the stack can be undone.
 */
const appliedStack: symbol[] = [];
const EDIT_EVENT = "od-edit-stack";
const stackChanged = () => document.dispatchEvent(new CustomEvent(EDIT_EVENT));
function newDocument() {
  docGen++;
  appliedStack.length = 0;
  history.length = 0; // the conversation was about the previous document
  stackChanged();
}

/* ------------------------------ status ------------------------------ */

function setStatus(msg: string, kind: "" | "ok" | "err" = "") {
  const el = $("od-status");
  if (!el) return;
  el.textContent = msg;
  el.className = `od-status ${kind}`;
  if (msg && kind !== "err") {
    setTimeout(() => {
      if (el.textContent === msg) el.textContent = "";
    }, 5000);
  }
}

function setLoading(on: boolean, detail?: string) {
  const el = $("od-loading");
  if (!el) return;
  el.hidden = !on;
  if (detail) window.od.progress(detail);
}

/** A failure big enough to read, over the stage — with a retry. */
function fail(where: string, err: unknown) {
  const e = err as Error;
  console.error(`[open-docs] ${where}`, err);
  setStatus(`${where}: ${e?.message ?? err}`, "err");
  setLoading(false);
  const stage = $("od-stage");
  if (!stage) return;
  stage.querySelector(".od-error")?.remove();
  const box = document.createElement("div");
  box.className = "od-error";
  box.innerHTML = `<h3></h3><p>The editor reported an error. The details below are also sent to the val's logs.</p><pre></pre>
    <div style="display:flex;gap:8px"><button class="od-btn primary" data-act="reload">Reload editor</button><button class="od-btn" data-act="dismiss">Dismiss</button></div>`;
  box.querySelector("h3")!.textContent = where;
  box.querySelector("pre")!.textContent = `${e?.name ?? "Error"}: ${e?.message ?? String(err)}\n\n${
    (e?.stack ?? "").split("\n").slice(0, 10).join("\n")
  }`;
  box.addEventListener("click", (ev) => {
    const act = (ev.target as HTMLElement).dataset.act;
    if (act === "reload") location.reload();
    if (act === "dismiss") box.remove();
  });
  stage.append(box);
}

/* ------------------------------ metrics ------------------------------ */

function paintChip(m?: Measurement, state: "loading" | "ok" | "err" = "ok") {
  const chip = $("od-metrics");
  if (!chip) return;
  chip.className = `od-metrics ${state}`;
  $("od-m-time")!.textContent = m ? fmtMs(m.startupMs) : state === "loading" ? "…" : "—";
  $("od-m-mem")!.textContent = m ? fmtBytes(m.heapBytes) : "…";
  $("od-m-size")!.textContent = m ? fmtBytes(m.loadedBytes) : "…";
}

function renderMetricsDialog() {
  const body = $("od-metrics-body");
  const m = lastMeasurement;
  if (!body) return;
  if (!m) {
    body.innerHTML = `<p>Still measuring — the editor hasn't finished loading.</p>`;
    return;
  }
  const byOrigin = new Map<string, { files: number; bytes: number }>();
  const byKind = new Map<string, { files: number; bytes: number }>();
  for (const r of m.rows) {
    const o = byOrigin.get(r.origin) ?? { files: 0, bytes: 0 };
    o.files++; o.bytes += r.bytes; byOrigin.set(r.origin, o);
    const k = byKind.get(r.kind) ?? { files: 0, bytes: 0 };
    k.files++; k.bytes += r.bytes; byKind.set(r.kind, k);
  }
  const rows = (map: Map<string, { files: number; bytes: number }>) =>
    [...map].sort((a, b) => b[1].bytes - a[1].bytes)
      .map(([k, v]) => `<tr><td>${k}</td><td class="n">${v.files}</td><td class="n">${fmtBytes(v.bytes)}</td></tr>`).join("");
  const biggest = [...m.rows].sort((a, b) => b.bytes - a.bytes).slice(0, 6)
    .map((r) => `<tr><td title="${r.url}">${r.url.replace(/^https?:\/\//, "").split("?")[0].slice(-58)}</td><td>${r.kind}</td><td class="n">${fmtBytes(r.bytes)}</td></tr>`).join("");
  const n = nowMeasurement;
  const now = n
    ? `<table class="od-table" id="od-remeasured"><thead><tr><th>Current state</th><th style="text-align:right">This load</th><th style="text-align:right">Now (${n.at.toLocaleTimeString()})</th></tr></thead><tbody>
      <tr><td>JS heap in use</td><td class="n">${fmtBytes(m.heapBytes)}</td><td class="n">${fmtBytes(n.m.heapBytes)}</td></tr>
      <tr><td>Bytes loaded so far</td><td class="n">${fmtBytes(m.loadedBytes)}</td><td class="n">${fmtBytes(n.m.loadedBytes)}</td></tr>
      <tr><td>Files loaded so far</td><td class="n">${m.resources}</td><td class="n">${n.m.resources}</td></tr>
    </tbody></table>`
    : "";
  body.innerHTML = `
    <div class="od-kpis">
      <div class="od-kpi"><b>${fmtMs(m.startupMs)}</b><small>startup (page → editor ready)</small></div>
      <div class="od-kpi"><b>${fmtBytes(m.heapBytes)}</b><small>JS heap in use${m.heapTotalBytes ? ` of ${fmtBytes(m.heapTotalBytes)}` : ""}</small></div>
      <div class="od-kpi"><b>${fmtBytes(m.loadedBytes)}</b><small>${m.resources} files loaded${m.transferBytes ? ` · ${fmtBytes(m.transferBytes)} over network` : ""}</small></div>
    </div>
    <p style="margin:10px 0"><button type="button" class="od-btn" id="od-remeasure">Re-measure now</button>
      <span class="od-note">reads heap and loaded bytes again, as the page is now (after editing, loading a document, assistant edits)</span></p>
    ${now}
    <table class="od-table"><tbody>
      <tr><td>Page HTML → adapter module ready</td><td class="n">${fmtMs(m.moduleMs)}</td></tr>
      <tr><td>Editor mount (import library + first render)</td><td class="n">${fmtMs(m.mountMs)}</td></tr>
      <tr><td>Cache state</td><td class="n">${m.warm ? "warm (files from HTTP cache)" : "cold (files from network)"}</td></tr>
    </tbody></table>
    <h4 style="margin:16px 0 6px;font-size:12.5px">By file type</h4>
    <table class="od-table"><thead><tr><th>Type</th><th style="text-align:right">Files</th><th style="text-align:right">Size</th></tr></thead><tbody>${rows(byKind)}</tbody></table>
    <h4 style="margin:16px 0 6px;font-size:12.5px">By origin</h4>
    <table class="od-table"><thead><tr><th>Origin</th><th style="text-align:right">Files</th><th style="text-align:right">Size</th></tr></thead><tbody>${rows(byOrigin)}</tbody></table>
    <h4 style="margin:16px 0 6px;font-size:12.5px">Largest files</h4>
    <table class="od-table"><thead><tr><th>File</th><th>Type</th><th style="text-align:right">Size</th></tr></thead><tbody>${biggest}</tbody></table>
    <p class="od-note">Sizes are decoded bytes (what the browser parses), including the shared page chrome (~60 KB).
    JS heap comes from <code>performance.memory</code> and is only available in Chromium browsers.
    Each load is saved anonymously so the landing page can compare editors by median; re-measuring is not saved.</p>`;
  $("od-remeasure")?.addEventListener("click", () => void remeasure());
}

/** Take the reading again, now; shown next to the load's numbers, never posted. */
async function remeasure() {
  if (!measureArgs) return;
  const btn = $("od-remeasure") as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Measuring…";
  }
  const { adapter, mountStart, mountEnd } = measureArgs;
  const m = await measure({ slug, mountStart, mountEnd, registeredAt: window.od.registeredAt, extraUrls: adapter.extraResources });
  nowMeasurement = { m, at: new Date() };
  renderMetricsDialog();
}

/** Set when ?open= made this page load a sample on arrival. */
let autoOpened = false;

async function recordMetrics(adapter: EditorAdapter, mountStart: number, mountEnd: number) {
  measureArgs = { adapter, mountStart, mountEnd };
  // Let late chunks, fonts and workers arrive before we count bytes / heap.
  await new Promise((r) => setTimeout(r, 1500));
  try {
    const m = await measure({
      slug,
      mountStart,
      mountEnd,
      registeredAt: window.od.registeredAt,
      extraUrls: adapter.extraResources,
    });
    lastMeasurement = m;
    paintChip(m, "ok");
    // Fairness: Chrome keeps one renderer process per tab across same-site
    // navigations, and performance.memory reports that process's heap. So the
    // second editor opened in a tab inherits the first one's garbage. Only the
    // first editor page in a tab (sessionStorage is per-tab) reports heap.
    const freshTab = !sessionStorage.getItem("od:editor-seen");
    sessionStorage.setItem("od:editor-seen", "1");
    // Test sessions set localStorage["od:no-metrics"] so they don't skew medians.
    if (localStorage.getItem("od:no-metrics")) return;
    // A visit that opened a sample by itself (?open=) has that document's heap and downloads in
    // this reading: it is not a startup, so it stays out of the startup figures.
    if (autoOpened) return;
    void fetch("/api/metrics", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...m, rows: undefined, heapBytes: freshTab ? m.heapBytes : null }),
      keepalive: true,
    });
  } catch (err) {
    console.warn("[open-docs] metrics", err);
  }
}

/* --------------------------- chrome on the kit --------------------------- */

window.od.status = setStatus;
window.od.log = (role, text) => log(role === "user" ? "user" : "bot", text);

window.od.onAdapter((adapter) => {
  current = adapter;
  void start(adapter);
});

async function start(adapter: EditorAdapter) {
  paintChip(undefined, "loading");
  setLoading(true);
  const mountStart = performance.now();
  try {
    await adapter.mount();
    const mountEnd = performance.now();
    mounted = true;
    setLoading(false);
    // The moment the editor became ready, for anything timing the page from outside (scripts/measure_samples.py):
    // read here, it is the exact time; polled from outside, it is late by up to the polling interval.
    document.documentElement.dataset.odReady = String(Math.round(mountEnd));
    // Viewers open on the rich sample (a blank page shows nothing about them).
    if (adapter.viewOnly) setDocName("Coastal Wind Farm — Spring Field Report");
    setStatus(`${adapter.name} ready`, "ok");
    postChild(childReady(slug, adapter.name, mountEnd));
    // The parent may have asked for a document while mount() was still running.
    const pending = pendingEmbedAction;
    pendingEmbedAction = undefined;
    pending?.();
    // ?open=<file> opens one of the Menu's samples as soon as the editor is ready, by pressing
    // its Menu button (so a page-load audit such as PageSpeed can see an engine open a file).
    // Only a file the Menu already offers matches; anything else is ignored.
    const want = new URLSearchParams(location.search).get("open");
    if (want) {
      const btn = want === "showcase.docx"
        ? $("od-showcase")
        : [...document.querySelectorAll<HTMLButtonElement>(".od-fixture")].find((b) => b.dataset.file === want);
      if (btn) {
        autoOpened = true;
        btn.click();
      }
    }
    (window as unknown as { __odlog?: (k: string, m: string) => void }).__odlog?.(
      "ready",
      `${adapter.name} mounted in ${Math.round(mountEnd - mountStart)}ms (startup ${Math.round(mountEnd)}ms)`,
    );
    void recordMetrics(adapter, mountStart, mountEnd);
    watchFit(adapter);
  } catch (err) {
    paintChip(undefined, "err");
    const e = err as Error;
    postChild(childError(slug, `${adapter.name} failed to start: ${e?.message ?? String(err)}`, "mount"));
    fail(`${adapter.name} failed to start`, err);
  }
}

/**
 * Keep the page fitted to the editor area: the editor's own zoom, told the
 * width every time the stage changes size (window, rotation, assistant panel).
 */
let fitNow = () => {};
function watchFit(adapter: EditorAdapter) {
  const stage = $("od-stage");
  if (!stage || !adapter.fit) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  fitNow = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const { width, height } = stage.getBoundingClientRect();
      try {
        adapter.fit?.(width, height);
      } catch (err) {
        console.warn("[open-docs] fit", err);
      }
    }, 80);
  };
  new ResizeObserver(fitNow).observe(stage);
  fitNow();
}

/* ------------------------------- documents ------------------------------- */

/** Document name. There is no name field; export and rename both read this. */
let docTitle = "Untitled document";

function docName(): string {
  const raw = docTitle.trim() || "Untitled document";
  return raw.replace(/\.docx$/i, "").replace(/[\\/:*?"<>|]+/g, "-");
}

function setDocName(name: string) {
  const previous = docTitle;
  docTitle = name.replace(/\.docx$/i, "");
  // The shell title is the editor name. Touch document.title only when the
  // page built it from the document name ("Brief" or "Brief · …").
  const title = document.title;
  if (
    previous &&
    previous !== docTitle &&
    (title === previous || title.startsWith(`${previous} `) || title.startsWith(`${previous}·`))
  ) {
    document.title = docTitle + title.slice(previous.length);
  }
}

async function withAdapter(label: string, fn: (a: EditorAdapter) => Promise<void>): Promise<boolean> {
  if (!current || !mounted) {
    setStatus("The editor is still loading…", "err");
    return false;
  }
  setStatus(`${label}…`);
  try {
    await fn(current);
    return true;
  } catch (err) {
    fail(label, err);
    return false;
  }
}

const newDoc = () =>
  withAdapter("New document", async (a) => {
    if (a.viewOnly) return setStatus(`${a.name} is a view-only viewer`, "err");
    openOwner.start(); // a sample still being measured no longer owns the page
    // The document is being replaced from this moment, as in openSiteSample: an assistant answer
    // computed for the one on screen must not land on its successor while that one loads, and the
    // sample timing left on <html> describes a document that is going away.
    docGen++;
    delete document.documentElement.dataset.odLoaded;
    const blank = await window.od.blankDocx();
    await loads.run(() => a.load(blank));
    newDocument();
    setDocName("Untitled document");
    postChild(childOpened(slug, docName()));
    setStatus("New blank document", "ok");
  });

/**
 * How long opening a document took and what the JS heap is afterwards.
 *
 *   ms         from the click to two frames after the adapter's `load()`
 *              resolved: the engine SAYS it is done.
 *   settledMs  from the click to the end of the last long task (> 50 ms on
 *              the main thread) before a full quiet second: the page HAS
 *              stopped working. Some loaders return before they draw
 *              (docx-editor.dev's `ref.load` is fire-and-forget), and some
 *              keep paginating after they return, so this is the number to
 *              compare on a long document. Work in a worker or on the GPU is
 *              not seen by it. Null where the browser has no Long Tasks API,
 *              and null (with `settleTimedOut`) when the page was still busy
 *              after 180 s: it never settled, so no time is claimed for it.
 *
 * `loaded` runs as soon as the adapter's `load()` resolved, before the wait
 * for quiet: the document on screen is the new one from that moment.
 *
 * Left on <html data-od-loaded> for scripts/measure_samples.py. An open that
 * was overtaken by a newer one (`owner`) writes nothing and returns null.
 * Loads are run one after another, so the document on screen is the one
 * asked for last; the time counted is still from the click.
 */
const openOwner = new OpenOwner();
/** Every load into the editor (sample, New, Import), one at a time in the order asked. */
const loads = new LoadQueue();
async function timedOpen(doc: string, owner: number, open: () => Promise<void>, loaded: () => void): Promise<string | null> {
  const t0 = performance.now();
  let lastBusy = t0;
  let observer: PerformanceObserver | undefined;
  // observe() does not throw for an entry type the browser lacks (Firefox, Safari): ask first.
  if (longTasksSupported()) {
    try {
      observer = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) lastBusy = Math.max(lastBusy, e.startTime + e.duration);
      });
      observer.observe({ type: "longtask" });
    } catch {
      observer = undefined;
    }
  }
  try {
    // One load at a time: two loads running into the same editor finish in either order, and the
    // slower document would win whichever was asked for last. An open that was overtaken while
    // it waited its turn does not load at all.
    await loads.run(() => (openOwner.owns(owner) ? open() : Promise.resolve()));
    if (!openOwner.owns(owner)) return null;
    loaded();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const ms = Math.round(performance.now() - t0);
    let settledMs: number | null = null;
    let settleTimedOut = false;
    if (observer) {
      const QUIET = 1000, GIVE_UP = 180_000;
      while (performance.now() - lastBusy < QUIET && performance.now() - t0 < GIVE_UP) {
        await new Promise((r) => setTimeout(r, 100));
        for (const e of observer.takeRecords()) lastBusy = Math.max(lastBusy, e.startTime + e.duration);
        if (!openOwner.owns(owner)) return null;
      }
      const quiet = performance.now() - lastBusy >= QUIET;
      settleTimedOut = !quiet;
      settledMs = settledAfter({ t0, ms, lastBusy, quiet });
    }
    if (!openOwner.owns(owner)) return null;
    const heapBytes =
      (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null;
    document.documentElement.dataset.odLoaded = JSON.stringify({ doc, ms, settledMs, settleTimedOut, heapBytes });
    const settled = settleTimedOut
      ? " (still busy after 180 s)"
      : settledMs != null && settledMs > ms + 250
      ? ` (settled after ${fmtMs(settledMs)})`
      : "";
    return `in ${fmtMs(ms)}${settled}${heapBytes ? ` · JS heap ${fmtBytes(heapBytes)}` : ""}`;
  } catch (err) {
    // An open that was overtaken and then failed has nothing to say: its error must not be
    // drawn over the newer document.
    if (!openOwner.owns(owner)) return null;
    throw err;
  } finally {
    // Also when the fetch or the adapter rejected: a failed open must not leave its observer registered.
    observer?.disconnect();
  }
}

/** Open one of this site's samples (a path under /api/). */
const openSiteSample = (path: string, title: string, label: string) =>
  withAdapter(`Load the ${label} sample`, async (a) => {
    delete document.documentElement.dataset.odLoaded;
    // This open owns the page from now on; one started earlier and still running is stale.
    const mine = openOwner.start();
    // The document is being replaced: an assistant answer computed for the one on screen must not
    // land on its successor, however long the new one takes to load and settle.
    docGen++;
    const took = await timedOpen(path, mine, async () => {
      if (a.loadUrl) return a.loadUrl(path);
      const res = await fetch(path);
      if (!res.ok) throw new Error(`${path} → HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      await a.load(new Uint8Array(await res.arrayBuffer()));
    }, () => {
      // Loaded: the new document's identity is set now, not after the settle measurement.
      newDocument();
      setDocName(title);
      postChild(childOpened(slug, docName()));
      fitNow();
    });
    if (took === null) return; // a newer open took over: its timing, title and status stand
    const note = label === "redline" && a.revisions ? ` · tracked changes: ${a.revisions}` : "";
    setStatus(`Loaded the ${label} sample ${took}${note}`, "ok");
  });

const openShowcase = () =>
  openSiteSample("/api/showcase.docx", "Coastal Wind Farm — Spring Field Report", "rich");

const openSample = () => openSiteSample("/api/sample.docx", "Quarterly Report — Acme Robotics", "short");

async function importFile(file: File) {
  if (!/\.docx$/i.test(file.name)) {
    const message = `${file.name} is not a .docx file`;
    setStatus(message, "err");
    postChild(childError(slug, message, "open"));
    return;
  }
  if (current?.acceptsFiles === false) {
    const message = `${editorName} only opens documents from a public link — it shows this site's samples`;
    setStatus(message, "err");
    postChild(childError(slug, message, "open"));
    return;
  }
  let openError: string | undefined;
  const ok = await withAdapter(`Import ${file.name}`, async (a) => {
    try {
      openOwner.start(); // a sample still being measured no longer owns the page
      docGen++; // as in newDoc: the document on screen is being replaced from now on
      delete document.documentElement.dataset.odLoaded;
      const bytes = new Uint8Array(await file.arrayBuffer());
      await loads.run(() => a.load(bytes));
    } catch (err) {
      openError = (err as Error)?.message ?? String(err);
      throw err;
    }
    newDocument();
    setDocName(file.name);
    postChild(childOpened(slug, docName()));
    fitNow();
    setStatus(`Imported ${file.name}`, "ok");
  });
  if (!ok) postChild(childError(slug, openError ?? "The editor is still loading", "open"));
}

/* ---------------------------- embed channel ---------------------------- */

/**
 * Parent (editors-arena) → child. Only messages from window.parent, only in
 * embed mode, only through the same paths the buttons use. Anything the page
 * itself might post is filtered out by parseArenaMessage.
 */
function onParentMessage(e: MessageEvent) {
  if (e.source !== window.parent) return;
  const msg = parseArenaMessage(e.data);
  if (!msg) return;
  // The menu is chrome. It works before the engine mounts, so it is not queued.
  if (msg.type === "menu") {
    const menu = $("od-menu");
    if (!menu) return;
    if (menu.hidden) openMenu();
    else closeMenu();
    return;
  }
  const act = msg.type === "sample"
    ? () => void openShowcase()
    : msg.type === "export"
    ? () => void exportForParent()
    : () => void importFile(new File([msg.bytes], embedFileName(msg.name)));
  if (!current || !mounted) pendingEmbedAction = act;
  else act();
}

if (embed) window.addEventListener("message", onParentMessage);

/** The document as .docx, written by the engine's own exporter (never by us). */
async function currentDocx(a: EditorAdapter): Promise<Uint8Array> {
  if (!a.exportDocx) throw new Error(`${a.name} has no .docx exporter of its own`);
  const bytes = await a.exportDocx();
  if (!(bytes instanceof Uint8Array) || bytes.length < 4) throw new Error("the editor returned no bytes");
  return bytes;
}

const exportDocx = () =>
  withAdapter("Export .docx", async (a) => {
    if (a.viewOnly) return setStatus(`${a.name} is a view-only viewer: nothing to export`, "err");
    const bytes = await currentDocx(a);
    window.od.download(bytes, `${docName()}.docx`);
    setStatus(`Exported ${docName()}.docx (${fmtBytes(bytes.length)})`, "ok");
  });

/**
 * Parent "export": the same bytes the Export button writes, posted back
 * instead of downloaded. The copy is transferred so a view into the editor's
 * own buffer (WASM memory) is never detached.
 */
async function exportForParent() {
  try {
    if (!current || !mounted) throw new Error("The editor is still loading");
    if (current.viewOnly) throw new Error(`${current.name} is a view-only viewer: nothing to export`);
    const bytes = await currentDocx(current);
    const ab = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(ab).set(bytes);
    const name = docName();
    postChild(childExported(slug, name, ab), [ab]);
    setStatus(`Exported ${name}.docx (${fmtBytes(bytes.length)})`, "ok");
  } catch (err) {
    const message = (err as Error)?.message ?? String(err);
    setStatus(`Export .docx: ${message}`, "err");
    postChild(childError(slug, message, "export"));
  }
}

/* ------------------------------- assistant ------------------------------- */

const SUGGESTIONS = [
  "Draft a one-page project update",
  "Make this more concise",
  "Add a summary at the top",
  "Turn the key points into bullets",
  "Fix grammar and tone",
];

function log(role: "user" | "bot", text: string, extra = ""): HTMLDivElement {
  const el = $("od-log");
  const div = document.createElement("div");
  div.className = `od-msg ${role} ${extra}`.trim();
  const who = document.createElement("span");
  who.className = "who";
  who.textContent = role === "user" ? "You" : "Assistant";
  div.append(who, document.createTextNode(text));
  // Embed mode renders no assistant panel; od.log() must not throw there.
  if (el) {
    el.append(div);
    el.scrollTop = el.scrollHeight;
  }
  return div;
}

function diffCounts(before: string, after: string) {
  const a = mdToBlocks(before).map((b) => b.text);
  const b = mdToBlocks(after).map((b) => b.text);
  const sa = new Set(a), sb = new Set(b);
  return {
    added: b.filter((t) => !sa.has(t)).length,
    removed: a.filter((t) => !sb.has(t)).length,
    blocks: b.length,
  };
}

/** Whitespace-insensitive document text, to tell when native undo is back. */
const sameText = (x: string, y: string) => x.replace(/\s+/g, " ").trim() === y.replace(/\s+/g, " ").trim();
/** Native history steps an apply may take (SuperDoc's importer is several). */
const MAX_STEPS = 12;

/**
 * Step the engine's OWN history (undo or redo) until the document reads
 * `target` again. Returns the steps taken, or null if it never got there.
 */
async function stepHistory(a: EditorAdapter, dir: "undo" | "redo", target: string): Promise<number | null> {
  const step = dir === "undo" ? a.undo : a.redo;
  if (!step) return null;
  for (let i = 1; i <= MAX_STEPS; i++) {
    await step.call(a);
    if (sameText(await a.getMarkdown(), target)) return i;
  }
  return null;
}

function editCard(markdown: string, summary: string, before: string) {
  const d = diffCounts(before, markdown);
  const card = document.createElement("div");
  card.className = "od-edit";
  card.innerHTML = `<strong></strong>
    <div class="diff"><b>+${d.added}</b> / <i>−${d.removed}</i> paragraphs · ${d.blocks} in the new version</div>
    <details><summary>Preview the new text</summary><pre></pre></details>
    <div class="row"></div>`;
  card.querySelector("strong")!.textContent = summary;
  card.querySelector("pre")!.textContent = markdown.slice(0, 4000);
  const row = card.querySelector(".row")!;
  const apply = Object.assign(document.createElement("button"), { className: "od-btn primary", textContent: "Apply" });
  const undo = Object.assign(document.createElement("button"), { className: "od-btn", textContent: "Undo" });
  const redo = Object.assign(document.createElement("button"), { className: "od-btn", textContent: "Redo" });
  const state = Object.assign(document.createElement("span"), { className: "state" });
  undo.hidden = true;
  redo.hidden = true;
  row.append(apply, undo, redo, state);
  $("od-log")!.append(card);
  $("od-log")!.scrollTop = $("od-log")!.scrollHeight;

  const gen = docGen; // the document this edit was computed for
  const token = Symbol("edit");
  const isTop = () => appliedStack[appliedStack.length - 1] === token;
  let beforeApply = ""; // document text right before our apply
  let afterApply = ""; // document text right after it
  let confirmDiscard = false;
  /** Undo / Redo are the engine's own history, offered only when the apply is in it. */
  const native = () => !!(current?.applyInHistory && current.undo && current.redo);

  // Keep the buttons honest as the document moves on.
  const refresh = () => {
    if (gen !== docGen) {
      apply.disabled = undo.disabled = redo.disabled = true;
      card.className = "od-edit undone";
      state.textContent = "Different document";
      return;
    }
    if (appliedStack.includes(token) && !undo.hidden) {
      const top = isTop();
      undo.disabled = !top;
      undo.title = top ? "" : "Undo the later assistant edit first";
      state.textContent = top ? "Applied ✓" : "Applied ✓ (later edit on top)";
    }
  };
  document.addEventListener(EDIT_EVENT, refresh);

  const applied = () => {
    appliedStack.push(token);
    confirmDiscard = false;
    card.className = "od-edit applied";
    apply.hidden = true;
    redo.hidden = true;
    undo.hidden = !native();
    undo.disabled = false;
    undo.textContent = "Undo";
    state.textContent = native() ? "Applied ✓" : `Applied ✓ (${current?.name ?? "this editor"} can't undo this edit)`;
    stackChanged();
  };

  const doApply = async () => {
    if (!current || gen !== docGen) return refresh();
    apply.disabled = true;
    setStatus("Applying the assistant's edit…");
    try {
      beforeApply = await current.getMarkdown().catch(() => "");
      await current.applyMarkdown(markdown);
      afterApply = await current.getMarkdown().catch(() => "");
      applied();
      setStatus("Edit applied", "ok");
    } catch (err) {
      apply.disabled = false;
      fail("Applying the edit failed", err);
    }
  };
  apply.addEventListener("click", () => void doApply());

  undo.addEventListener("click", async () => {
    if (!current || !native() || gen !== docGen || !isTop()) return refresh();
    // Native undo walks back through anything typed since, too; say so first.
    const now = await current.getMarkdown().catch(() => afterApply);
    if (!sameText(now, afterApply) && !confirmDiscard) {
      confirmDiscard = true;
      undo.textContent = "Undo anyway";
      state.textContent = "You edited since — undo also undoes that";
      return;
    }
    undo.disabled = true;
    try {
      const steps = await stepHistory(current, "undo", beforeApply);
      appliedStack.pop();
      stackChanged();
      card.className = "od-edit undone";
      undo.hidden = true;
      undo.textContent = "Undo";
      redo.hidden = false;
      redo.disabled = false;
      state.textContent = steps == null
        ? `Undid ${MAX_STEPS} steps of ${current.name}'s history; the text still differs from before the edit`
        : "Undone";
      setStatus(steps == null ? "Undo stopped before the original text" : "Edit undone", steps == null ? "err" : "ok");
    } catch (err) {
      undo.disabled = false;
      fail("Undo failed", err);
    }
  });

  redo.addEventListener("click", async () => {
    if (!current || !native() || gen !== docGen || appliedStack.includes(token)) return refresh();
    redo.disabled = true;
    try {
      const steps = await stepHistory(current, "redo", afterApply);
      if (steps == null) {
        // History moved on (e.g. the user typed after undoing): redo has nothing to replay.
        redo.hidden = true;
        apply.hidden = false;
        apply.disabled = false;
        apply.textContent = "Re-apply";
        state.textContent = `${current.name} has nothing to redo; re-apply instead`;
        return;
      }
      applied();
      setStatus("Edit redone", "ok");
    } catch (err) {
      redo.disabled = false;
      fail("Redo failed", err);
    }
  });
  return doApply;
}

async function send(promptText?: string) {
  const input = $("od-prompt") as HTMLTextAreaElement;
  const prompt = (promptText ?? input.value).trim();
  if (!prompt || busy) return;
  if (!current || !mounted) {
    setStatus("Wait for the editor to finish loading", "err");
    return;
  }
  busy = true;
  input.value = "";
  log("user", prompt);
  const thinking = log("bot", "", "thinking");
  thinking.append(Object.assign(document.createElement("span"), { className: "dots" }));
  const sendBtn = $("od-send") as HTMLButtonElement;
  sendBtn.disabled = true;

  try {
    const genAtSend = docGen;
    const documentMd = await current.getMarkdown();
    const res = await fetch("/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, document: documentMd, prompt, history }),
    });
    const json = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
    thinking.remove();
    if (genAtSend !== docGen) {
      // The user opened another document while the model was thinking.
      log("bot", "That answer was about the previous document, so I didn't apply it. Ask again to work on this one.");
      return;
    }
    history.push({ role: "user", content: prompt });
    if (json.model) {
      const m = document.querySelector(".od-model");
      if (m) m.textContent = `${json.model} · via Val Town`;
    }
    if (json.edit?.markdown) {
      history.push({ role: "assistant", content: `(edited the document) ${json.edit.summary}` });
      const apply = editCard(json.edit.markdown, json.edit.summary, documentMd);
      if (($("od-autoapply") as HTMLInputElement)?.checked) await apply();
    } else {
      history.push({ role: "assistant", content: json.reply ?? "" });
      log("bot", json.reply ?? "(no reply)");
    }
  } catch (err) {
    thinking.remove();
    log("bot", `Sorry — ${(err as Error).message}`, "err");
    setStatus(`Assistant error: ${(err as Error).message}`, "err");
  } finally {
    busy = false;
    sendBtn.disabled = false;
  }
}

/* ------------------------------ DOM wiring ------------------------------ */

function wire() {
  for (const s of SUGGESTIONS) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = s;
    b.addEventListener("click", () => void send(s));
    $("od-suggestions")?.append(b);
  }

  $("od-new")?.addEventListener("click", () => void newDoc());
  $("od-showcase")?.addEventListener("click", () => void openShowcase());
  $("od-sample")?.addEventListener("click", () => void openSample());
  for (const b of document.querySelectorAll<HTMLButtonElement>(".od-fixture")) {
    b.addEventListener("click", () =>
      void openSiteSample(`/api/${b.dataset.file}`, b.dataset.title ?? "", b.dataset.label ?? ""));
  }
  $("od-reload")?.addEventListener("click", () => location.reload());
  $("od-import")?.addEventListener("click", () => $("od-file")?.click());
  $("od-file")?.addEventListener("change", (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) void importFile(file);
    input.value = "";
  });
  $("od-export")?.addEventListener("click", () => void exportDocx());

  const renameDialog = $("od-rename-dialog") as HTMLDialogElement | null;
  const renameInput = $("od-rename-input") as HTMLInputElement | null;
  $("od-rename")?.addEventListener("click", () => {
    if (!renameDialog || !renameInput) return;
    renameInput.value = docTitle;
    renameDialog.showModal();
    renameInput.focus();
    renameInput.select();
  });
  $("od-rename-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!renameDialog || !renameInput) return;
    const next = renameInput.value.trim().replace(/\.docx$/i, "").trim();
    // Empty and whitespace-only names are rejected; the previous name stays.
    if (!next) return;
    setDocName(next);
    renameDialog.close();
  });
  renameDialog?.querySelectorAll<HTMLButtonElement>("[data-od-rename-cancel]").forEach((btn) => {
    btn.addEventListener("click", () => renameDialog.close());
  });
  $("od-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    void send();
  });
  $("od-prompt")?.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void send();
    }
  });

  // Editor switcher.
  $("od-switch")?.addEventListener("change", (e) => {
    location.href = `/e/${(e.target as HTMLSelectElement).value}`;
  });

  // The Menu (right of the bar): every document action lives here.
  const menu = $("od-menu");
  $("od-more")?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (menu?.hidden) openMenu();
    else closeMenu();
  });
  document.addEventListener("click", (e) => {
    if (menu && !menu.hidden && !menu.contains(e.target as Node)) closeMenu();
  });
  // Picking an item closes the menu (the item's own handler still runs).
  menu?.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("button, a")) closeMenu();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menu && !menu.hidden) {
      closeMenu();
      $("od-more")?.focus();
    }
  });
  // A click in the arena blurs this iframe. Close so the panel does not stay up.
  if (embed) {
    window.addEventListener("blur", () => {
      if (menu && !menu.hidden) closeMenu();
    });
  }

  // Metrics dialog (the chip, or the menu item on phones where the chip is hidden).
  const showMetrics = () => {
    renderMetricsDialog();
    ($("od-metrics-dialog") as HTMLDialogElement)?.showModal();
  };
  $("od-metrics")?.addEventListener("click", showMetrics);
  $("od-metrics-item")?.addEventListener("click", showMetrics);

  // Assistant panel toggle (remembered).
  const layout = $("od-layout");
  const toggle = $("od-toggle-agent");
  // Viewers have no assistant (the server renders no aside): keep it closed.
  const hasAgent = !!$("od-aside");
  const applyAgentPref = (open: boolean) => {
    layout?.classList.toggle("no-agent", !open || !hasAgent);
    toggle?.setAttribute("aria-pressed", String(open));
    window.dispatchEvent(new Event("resize"));
  };
  // On a phone the assistant is a sheet over the editor: start it closed there.
  const narrow = matchMedia("(max-width: 900px)");
  applyAgentPref(!narrow.matches && localStorage.getItem("od-agent") !== "closed");
  toggle?.addEventListener("click", () => {
    const open = layout?.classList.contains("no-agent") ?? false;
    if (!narrow.matches) localStorage.setItem("od-agent", open ? "open" : "closed");
    applyAgentPref(open);
    if (open && narrow.matches) $("od-prompt")?.focus();
  });
  $("od-aside-close")?.addEventListener("click", () => applyAgentPref(false));
  narrow.addEventListener("change", () =>
    applyAgentPref(!narrow.matches && localStorage.getItem("od-agent") !== "closed"));

  // Keyboard shortcuts that don't fight the editors: ⌘O import, ⌘⇧S / ⌘S export.
  document.addEventListener("keydown", (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "o") {
      e.preventDefault();
      $("od-file")?.click();
    } else if (mod && e.key.toLowerCase() === "s") {
      e.preventDefault();
      void exportDocx();
    } else if (e.altKey && e.code === "KeyN") {
      e.preventDefault();
      void newDoc();
    }
  }, true);

  // Drag a .docx anywhere onto the page to open it.
  document.addEventListener("dragover", (e) => {
    if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
  });
  document.addEventListener("drop", (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file && /\.docx$/i.test(file.name)) {
      e.preventDefault();
      void importFile(file);
    }
  });
}

function openMenu() {
  const menu = $("od-menu");
  if (!menu || !menu.hidden) return;
  menu.hidden = false;
  $("od-more")?.setAttribute("aria-expanded", "true");
  (menu.querySelector("button, a") as HTMLElement | null)?.focus({ preventScroll: true });
  postChild(childMenu(slug, true));
}

function closeMenu() {
  const menu = $("od-menu");
  const wasOpen = !!menu && !menu.hidden;
  if (menu) menu.hidden = true;
  $("od-more")?.setAttribute("aria-expanded", "false");
  if (wasOpen) postChild(childMenu(slug, false));
}

wire();
paintChip(undefined, "loading");

// A module that fails to link (bad specifier, 404 chunk) never registers. Surface
// the browser's own message right away instead of waiting for the timeout.
addEventListener("error", (e) => {
  if (current || !(e as ErrorEvent).message) return;
  const msg = (e as ErrorEvent).message;
  if (/module|specifier|import|fetch/i.test(msg)) {
    postChild(childError(slug, `${editorName} could not load: ${msg}`, "mount"));
    fail(`${editorName} could not load`, (e as ErrorEvent).error ?? new Error(msg));
    paintChip(undefined, "err");
  }
});

// If nothing registered after a generous wait, say so loudly.
setTimeout(() => {
  if (!current) {
    postChild(childError(slug, `${editorName} never loaded: the adapter module never called window.od.register()`, "mount"));
    fail(
      `${editorName} never loaded`,
      new Error(
        "The adapter module never called window.od.register(). One of its imports most likely failed — the browser console has the URL.",
      ),
    );
    paintChip(undefined, "err");
  }
}, 45_000);

export {};
