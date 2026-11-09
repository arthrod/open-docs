/**
 * Shared chrome: the top bar, the agent panel, and the handshake with
 * `lib/boot.ts`.
 *
 * It SUBSCRIBES to `window.od.onAdapter` rather than replacing `register`.
 * Replacing it was the bug that stopped every editor from mounting: the shell
 * loads the adapter before this file, so the adapter registered into boot.ts's
 * implementation and this file never saw it.
 */
import { diffSummary } from "./md.ts";
import { b64decode, type EditorAdapter } from "./kit.ts";

const slug = document.body.dataset.slug ?? "";
const stage = () => document.getElementById("od-stage")!;
const statusEl = () => document.getElementById("od-status")!;
const logEl = () => document.getElementById("od-log")!;
const promptEl = () => document.getElementById("od-prompt") as HTMLTextAreaElement;

let current: EditorAdapter | undefined;
let busy = false;
let lastMarkdown = "";

function setStatus(msg: string, kind: "" | "ok" | "err" = "") {
  const el = statusEl();
  if (!el) return;
  el.textContent = msg;
  el.className = `od-status ${kind}`;
  if (msg && kind !== "err") {
    setTimeout(() => {
      if (el.textContent === msg) el.textContent = "";
    }, 6000);
  }
}

function log(role: "user" | "agent", text: string) {
  const el = logEl();
  if (!el) return;
  const div = document.createElement("div");
  div.className = `od-msg ${role === "user" ? "user" : "bot"}`;
  const who = document.createElement("span");
  who.className = "who";
  who.textContent = role;
  div.append(who, document.createTextNode(text));
  el.append(div);
  el.scrollTop = el.scrollHeight;
}

/** A failure big enough to read, in the stage rather than the status strip. */
function fail(where: string, err: unknown) {
  const e = err as Error;
  console.error(`[open-docs] ${where}`, err);
  setStatus(`${where}: ${e?.message ?? err}`, "err");
  const el = stage();
  if (!el) return;
  el.innerHTML = "";
  const box = document.createElement("div");
  box.style.cssText =
    "margin:16px;padding:16px;font:12.5px/1.6 ui-monospace,monospace;color:#7f1d1d;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;white-space:pre-wrap;word-break:break-word";
  box.textContent = `${where}\n\n${e?.name ?? "Error"}: ${e?.message ?? String(err)}\n\n${
    (e?.stack ?? "").split("\n").slice(0, 8).join("\n")
  }`;
  el.append(box);
}

/* --------------------------- chrome on the kit --------------------------- */

window.od.status = setStatus;
window.od.log = log;

// Registration already happened (or will) in boot.ts. Subscribe, and boot.ts
// replays anything it queued.
window.od.onAdapter((adapter) => {
  current = adapter;
  void start(adapter);
});

async function start(adapter: EditorAdapter) {
  setStatus(`Mounting ${adapter.name}…`);
  const t0 = performance.now();
  try {
    await adapter.mount();
    const ms = Math.round(performance.now() - t0);
    setStatus(`${adapter.name} ready in ${ms}ms`, "ok");
    (window as unknown as { __odlog?: (k: string, m: string) => void }).__odlog?.(
      "ready",
      `${adapter.name} mounted in ${ms}ms`,
    );
    try {
      lastMarkdown = await adapter.getMarkdown();
    } catch {
      /* freshly blank documents often read back empty */
    }
  } catch (err) {
    fail(`${adapter.name} failed to mount`, err);
  }
}

/* ------------------------------- actions -------------------------------- */

async function withAdapter(fn: (a: EditorAdapter) => Promise<void>, label: string) {
  if (!current) {
    fail(label, new Error("No editor registered yet"));
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
  withAdapter(async (a) => {
    await a.load(await window.od.blankDocx());
    setStatus("New document", "ok");
  }, "New document");

const openSample = () =>
  withAdapter(async (a) => {
    await a.load(await window.od.sampleDocx());
    setStatus("Opened the sample .docx", "ok");
  }, "Open sample");

const downloadSample = async () => {
  setStatus("Downloading sample…");
  try {
    window.od.download(await window.od.sampleDocx(), "open-docs-sample.docx");
    setStatus("Sample downloaded", "ok");
  } catch (err) {
    fail("Download sample", err);
  }
};

async function importFile(file: File) {
  await withAdapter(async (a) => {
    await a.load(new Uint8Array(await file.arrayBuffer()));
    setStatus(`Imported ${file.name}`, "ok");
  }, `Import ${file.name}`);
}

async function exportDocx() {
  await withAdapter(async (a) => {
    let bytes: Uint8Array;
    if (a.exportDocx) {
      bytes = await a.exportDocx();
      if (!(bytes instanceof Uint8Array) || bytes.length < 4) {
        throw new Error("editor returned no bytes");
      }
    } else {
      const markdown = await a.getMarkdown();
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ markdown, title: slug }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "export failed");
      bytes = b64decode(json.base64);
    }
    window.od.download(bytes, `${slug}.docx`);
    setStatus(`Exported ${(bytes.length / 1024).toFixed(1)} KB`, "ok");
  }, "Export .docx");
}

/* -------------------------------- agent --------------------------------- */

const SUGGESTIONS = [
  "Write a short project update",
  "Tighten this to two sentences",
  "Turn this into a bulleted list",
  "Add a call to action at the end",
];

function renderSuggestions() {
  const el = document.getElementById("od-suggestions");
  if (!el) return;
  for (const s of SUGGESTIONS) {
    const b = document.createElement("button");
    b.textContent = s;
    b.addEventListener("click", () => {
      promptEl().value = s;
      void send();
    });
    el.append(b);
  }
}

async function send() {
  if (!current || busy) return;
  const prompt = promptEl().value.trim();
  if (!prompt) return;
  busy = true;
  promptEl().value = "";
  log("user", prompt);

  const sendBtn = document.getElementById("od-send") as HTMLButtonElement;
  sendBtn.disabled = true;
  setStatus("Agent thinking…");

  try {
    const document = await current.getMarkdown();
    const res = await fetch("/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, document, prompt }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
    setStatus("");
    if (json.edit?.markdown) {
      showPending(json.edit.markdown, json.edit.summary);
    } else {
      log("agent", json.reply ?? "(no reply)");
    }
  } catch (err) {
    setStatus(`Agent error: ${(err as Error).message}`, "err");
    log("agent", `Sorry — ${(err as Error).message}`);
  } finally {
    busy = false;
    sendBtn.disabled = false;
  }
}

function showPending(markdown: string, summary: string) {
  const card = document.createElement("div");
  card.className = "od-pending";

  const title = document.createElement("strong");
  title.textContent = summary || "Proposed edit";

  const detail = document.createElement("div");
  detail.textContent = diffSummary(lastMarkdown, markdown);
  detail.style.color = "#92400e";

  const preview = document.createElement("details");
  const sum = document.createElement("summary");
  sum.textContent = "Preview";
  sum.style.cursor = "pointer";
  const pre = document.createElement("pre");
  pre.textContent = markdown.slice(0, 2000);
  pre.style.cssText =
    "white-space:pre-wrap;font-size:11.5px;max-height:180px;overflow:auto;margin:6px 0 0";
  preview.append(sum, pre);

  const row = document.createElement("div");
  row.className = "row";
  const apply = document.createElement("button");
  apply.className = "od-btn primary";
  apply.textContent = "Apply";
  const discard = document.createElement("button");
  discard.className = "od-btn";
  discard.textContent = "Discard";
  row.append(apply, discard);

  apply.addEventListener("click", async () => {
    apply.disabled = true;
    setStatus("Applying edit…");
    try {
      await current!.applyMarkdown(markdown);
      card.remove();
      log("agent", `Applied: ${summary}`);
      setStatus("Edit applied", "ok");
    } catch (err) {
      fail("Apply failed", err);
    }
  });
  discard.addEventListener("click", () => card.remove());

  card.append(title, detail, preview, row);
  logEl().append(card);
  logEl().scrollTop = logEl().scrollHeight;
}

/* ------------------------------ DOM wiring ------------------------------ */

document.getElementById("od-new")?.addEventListener("click", () => void newDoc());
document.getElementById("od-sample")?.addEventListener("click", () => void openSample());
document.getElementById("od-sample-dl")?.addEventListener("click", () => void downloadSample());
document.getElementById("od-import")?.addEventListener("click", () =>
  document.getElementById("od-file")!.click());
document.getElementById("od-file")?.addEventListener("change", (e) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) void importFile(file);
  input.value = "";
});
document.getElementById("od-export")?.addEventListener("click", () => void exportDocx());
document.getElementById("od-reload")?.addEventListener("click", () => location.reload());
document.getElementById("od-send")?.addEventListener("click", () => void send());
promptEl()?.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void send();
});

renderSuggestions();

// Keep a copy of the document text so the confirm card can describe the diff.
setInterval(async () => {
  if (!current) return;
  try {
    lastMarkdown = await current.getMarkdown();
  } catch {
    /* not ready */
  }
}, 4000);

// If nothing registered after a generous wait, say so loudly.
setTimeout(() => {
  if (!current) {
    fail(
      "No editor registered",
      new Error(
        "The adapter module never called window.od.register(). Its import probably failed — check the network tab / console.",
      ),
    );
  }
}, 20_000);

export {};
