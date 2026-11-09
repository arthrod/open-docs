/**
 * Shared chrome: the top bar, metrics, the assistant panel, and the handshake
 * with `lib/boot.ts`.
 *
 * It SUBSCRIBES to `window.od.onAdapter` rather than replacing `register` —
 * the shell loads the adapter before this file, so replacing it would miss the
 * adapter entirely (the original "nothing mounts" bug).
 */
import { mdToBlocks } from "./md.ts";
import { b64decode, type EditorAdapter } from "./kit.ts";
import { fmtBytes, fmtMs, type Measurement, measure } from "./metrics.ts";

const slug = document.body.dataset.slug ?? "";
const editorName = document.body.dataset.name ?? slug;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T | null;

let current: EditorAdapter | undefined;
let mounted = false;
let busy = false;
let lastMeasurement: Measurement | undefined;
const history: Array<{ role: "user" | "assistant"; content: string }> = [];
/**
 * Bumped whenever a different document is opened (New / Sample / Import). An
 * assistant edit computed for generation N must never land on generation N+1.
 */
let docGen = 0;
/**
 * Applied assistant edits, oldest first. Undo restores a snapshot taken before
 * the edit, so only the TOP of the stack can be undone without silently
 * discarding the edits applied after it.
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
  body.innerHTML = `
    <div class="od-kpis">
      <div class="od-kpi"><b>${fmtMs(m.startupMs)}</b><small>startup (page → editor ready)</small></div>
      <div class="od-kpi"><b>${fmtBytes(m.heapBytes)}</b><small>JS heap in use${m.heapTotalBytes ? ` of ${fmtBytes(m.heapTotalBytes)}` : ""}</small></div>
      <div class="od-kpi"><b>${fmtBytes(m.loadedBytes)}</b><small>${m.resources} files loaded${m.transferBytes ? ` · ${fmtBytes(m.transferBytes)} over network` : ""}</small></div>
    </div>
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
    Each load is saved anonymously so the landing page can compare editors by median.</p>`;
}

async function recordMetrics(adapter: EditorAdapter, mountStart: number, mountEnd: number) {
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
    // Viewers open on the rich sample (a blank page shows nothing about them).
    if (adapter.viewOnly) setDocName("Coastal Wind Farm — Spring Field Report");
    setStatus(`${adapter.name} ready`, "ok");
    (window as unknown as { __odlog?: (k: string, m: string) => void }).__odlog?.(
      "ready",
      `${adapter.name} mounted in ${Math.round(mountEnd - mountStart)}ms (startup ${Math.round(mountEnd)}ms)`,
    );
    void recordMetrics(adapter, mountStart, mountEnd);
    watchFit(adapter);
  } catch (err) {
    paintChip(undefined, "err");
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
  let timer = 0;
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

function docName(): string {
  const raw = ($("od-docname") as HTMLInputElement | null)?.value.trim() || "Untitled document";
  return raw.replace(/\.docx$/i, "").replace(/[\\/:*?"<>|]+/g, "-");
}

function setDocName(name: string) {
  const el = $("od-docname") as HTMLInputElement | null;
  if (el) el.value = name.replace(/\.docx$/i, "");
}

async function withAdapter(label: string, fn: (a: EditorAdapter) => Promise<void>) {
  if (!current || !mounted) {
    setStatus("The editor is still loading…", "err");
    return;
  }
  setStatus(`${label}…`);
  try {
    await fn(current);
  } catch (err) {
    fail(label, err);
  }
}

const newDoc = () =>
  withAdapter("New document", async (a) => {
    if (a.viewOnly) return setStatus(`${a.name} is a view-only viewer`, "err");
    await a.load(await window.od.blankDocx());
    newDocument();
    setDocName("Untitled document");
    setStatus("New blank document", "ok");
  });

const openShowcase = () =>
  withAdapter("Load the rich sample", async (a) => {
    if (a.loadUrl) await a.loadUrl("/api/showcase.docx");
    else {
      const res = await fetch("/api/showcase.docx");
      if (!res.ok) throw new Error(`showcase.docx → HTTP ${res.status}`);
      await a.load(new Uint8Array(await res.arrayBuffer()));
    }
    newDocument();
    setDocName("Coastal Wind Farm — Spring Field Report");
    fitNow();
    setStatus("Loaded the rich sample .docx", "ok");
  });

const openSample = () =>
  withAdapter("Load sample", async (a) => {
    if (a.loadUrl) await a.loadUrl("/api/sample.docx");
    else await a.load(await window.od.sampleDocx());
    newDocument();
    setDocName("Quarterly Report — Acme Robotics");
    fitNow();
    setStatus("Loaded the sample .docx", "ok");
  });

async function importFile(file: File) {
  if (!/\.docx$/i.test(file.name)) {
    setStatus(`${file.name} is not a .docx file`, "err");
    return;
  }
  if (current?.acceptsFiles === false) {
    setStatus(`${editorName} only opens documents from a public link — it shows this site's samples`, "err");
    return;
  }
  await withAdapter(`Import ${file.name}`, async (a) => {
    await a.load(new Uint8Array(await file.arrayBuffer()));
    newDocument();
    setDocName(file.name);
    fitNow();
    setStatus(`Imported ${file.name}`, "ok");
  });
}

async function currentDocx(a: EditorAdapter): Promise<Uint8Array> {
  if (a.exportDocx) {
    const bytes = await a.exportDocx();
    if (!(bytes instanceof Uint8Array) || bytes.length < 4) throw new Error("the editor returned no bytes");
    return bytes;
  }
  const res = await fetch("/api/export", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ markdown: await a.getMarkdown(), title: docName() }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "export failed");
  return b64decode(json.base64);
}

const exportDocx = () =>
  withAdapter("Export .docx", async (a) => {
    if (a.viewOnly) return setStatus(`${a.name} is a view-only viewer: nothing to export`, "err");
    const bytes = await currentDocx(a);
    window.od.download(bytes, `${docName()}.docx`);
    setStatus(`Exported ${docName()}.docx (${fmtBytes(bytes.length)})`, "ok");
  });

/* ------------------------------- assistant ------------------------------- */

const SUGGESTIONS = [
  "Draft a one-page project update",
  "Make this more concise",
  "Add a summary at the top",
  "Turn the key points into bullets",
  "Fix grammar and tone",
];

function log(role: "user" | "bot", text: string, extra = ""): HTMLDivElement {
  const el = $("od-log")!;
  const div = document.createElement("div");
  div.className = `od-msg ${role} ${extra}`.trim();
  const who = document.createElement("span");
  who.className = "who";
  who.textContent = role === "user" ? "You" : "Assistant";
  div.append(who, document.createTextNode(text));
  el.append(div);
  el.scrollTop = el.scrollHeight;
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

/** Before an agent write: something we can restore exactly. */
async function snapshot(a: EditorAdapter): Promise<{ bytes?: Uint8Array; markdown?: string }> {
  try {
    if (a.exportDocx) return { bytes: await a.exportDocx() };
  } catch { /* fall back to markdown */ }
  return { markdown: await a.getMarkdown() };
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
  const state = Object.assign(document.createElement("span"), { className: "state" });
  undo.hidden = true;
  row.append(apply, undo, state);
  $("od-log")!.append(card);
  $("od-log")!.scrollTop = $("od-log")!.scrollHeight;

  let snap: { bytes?: Uint8Array; markdown?: string } | undefined;
  const gen = docGen; // the document this edit was computed for
  const token = Symbol("edit");
  const isTop = () => appliedStack[appliedStack.length - 1] === token;
  let afterApply = ""; // document text right after our apply
  let confirmDiscard = false;

  // Keep the buttons honest as the document moves on.
  const refresh = () => {
    if (gen !== docGen) {
      apply.disabled = true;
      undo.disabled = true;
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

  const doApply = async () => {
    if (!current || gen !== docGen) return refresh();
    apply.disabled = true;
    setStatus("Applying the assistant's edit…");
    try {
      snap = await snapshot(current);
      await current.applyMarkdown(markdown);
      afterApply = await current.getMarkdown().catch(() => "");
      appliedStack.push(token);
      confirmDiscard = false;
      card.className = "od-edit applied";
      apply.hidden = true;
      undo.hidden = false;
      undo.disabled = false;
      undo.textContent = "Undo";
      state.textContent = "Applied ✓";
      setStatus("Edit applied", "ok");
      stackChanged();
    } catch (err) {
      apply.disabled = false;
      fail("Applying the edit failed", err);
    }
  };
  apply.addEventListener("click", () => void doApply());
  undo.addEventListener("click", async () => {
    if (!current || !snap || gen !== docGen || !isTop()) return refresh();
    // Restoring the snapshot also drops anything typed since; say so first.
    const now = await current.getMarkdown().catch(() => afterApply);
    if (now !== afterApply && !confirmDiscard) {
      confirmDiscard = true;
      undo.textContent = "Undo anyway";
      state.textContent = "You edited since — undo discards that too";
      return;
    }
    undo.disabled = true;
    try {
      if (snap.bytes) await current.load(snap.bytes);
      else await current.applyMarkdown(snap.markdown ?? "");
      appliedStack.pop();
      stackChanged();
      card.className = "od-edit undone";
      state.textContent = "Undone";
      undo.hidden = true;
      undo.textContent = "Undo";
      apply.hidden = false;
      apply.disabled = false;
      apply.textContent = "Re-apply";
      setStatus("Edit undone", "ok");
    } catch (err) {
      undo.disabled = false;
      fail("Undo failed", err);
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
  $("od-reload")?.addEventListener("click", () => location.reload());
  $("od-import")?.addEventListener("click", () => $("od-file")?.click());
  $("od-file")?.addEventListener("change", (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) void importFile(file);
    input.value = "";
  });
  $("od-export")?.addEventListener("click", () => void exportDocx());
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
  if (!menu) return;
  menu.hidden = false;
  $("od-more")?.setAttribute("aria-expanded", "true");
  (menu.querySelector("button, a") as HTMLElement | null)?.focus({ preventScroll: true });
}

function closeMenu() {
  const menu = $("od-menu");
  if (menu) menu.hidden = true;
  $("od-more")?.setAttribute("aria-expanded", "false");
}

wire();
paintChip(undefined, "loading");

// A module that fails to link (bad specifier, 404 chunk) never registers. Surface
// the browser's own message right away instead of waiting for the timeout.
addEventListener("error", (e) => {
  if (current || !(e as ErrorEvent).message) return;
  const msg = (e as ErrorEvent).message;
  if (/module|specifier|import|fetch/i.test(msg)) {
    fail(`${editorName} could not load`, (e as ErrorEvent).error ?? new Error(msg));
    paintChip(undefined, "err");
  }
});

// If nothing registered after a generous wait, say so loudly.
setTimeout(() => {
  if (!current) {
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
