/**
 * Shared routes every editor demo gets, so each `editors/<slug>/` folder only
 * has to supply its own shell + mount code.
 *
 *   GET  /e/<slug>             the editor page (shared chrome + editor body)
 *   GET  /api/sample.docx      the shared fixture, byte-for-byte
 *   GET  /api/showcase.docx    the rich sample (scripts/make_showcase.py)
 *   GET  /api/blank.docx       a valid empty .docx
 *   POST /api/import           .docx → { title, markdown }
 *   POST /api/agent            { document, prompt, history } → { reply, edit? }
 *   POST /api/metrics          one page-load measurement (startup/memory/bytes)
 *   GET  /api/metrics          per-editor medians, for the landing page
 */
import type { Hono } from "npm:hono@4";
import { serveFile } from "https://esm.town/v/std/utils/index.ts";
import { editors } from "./registry.ts";
import { sampleDocx, sampleText, paragraphsToText } from "./sample.docx.ts";
import { showcaseDocx } from "./showcase.docx.ts";
import { buildDocx, looksLikeZip, textFromDocx } from "./docx.ts";
import { DOCX_IO_SRI, DOCX_IO_URL } from "../lib/plate-docx-pin.ts";
import { AGENT_MODEL, runAgent } from "./agent.ts";
import { recordMetric, summarizeMetrics } from "./metrics.ts";
import { SHELL_CSS } from "./styles.ts";

export interface EditorShell {
  slug: string;
  /** Path (relative to val root) of the browser adapter module. */
  entry: string;
  /** Extra <head> html for the editor (stylesheets, classic CDN scripts…). */
  head?: string;
  /** Body markup the adapter mounts into. */
  body: string;
  title: string;
  /** Extra import-map entries (bare specifiers / URL remaps) for this editor. */
  importMap?: Record<string, string>;
}

/** React, resolved once, for every adapter that loads a React package with `?external=react,react-dom`. */
export const REACT_IMPORTS: Record<string, string> = {
  "react": "https://esm.sh/react@18.2.0",
  "react/": "https://esm.sh/react@18.2.0/",
  "react-dom": "https://esm.sh/react-dom@18.2.0",
  "react-dom/": "https://esm.sh/react-dom@18.2.0/",
};

export function registerEditor(app: Hono, opts: EditorShell) {
  app.get(`/e/${opts.slug}`, (c) => c.html(shell(opts)));
  // The editor folder's own client modules + assets.
  app.get(`/e/${opts.slug}/*`, (c) => serveFile(c.req.path));
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function shell(o: EditorShell): string {
  const meta = editors.find((e) => e.slug === o.slug);
  const packages = meta?.packages ?? [];
  // Every page: React (Plate's esm.sh modules leave it bare) and the SRI hash
  // of Plate's .docx exporter, which lib/plate-docx.ts loads on any page that
  // writes .docx (Plate, and the markdown path of Docxodus, docx-editor.dev, folio).
  const importMap = `<script type="importmap">${JSON.stringify({
    imports: { ...REACT_IMPORTS, ...(o.importMap ?? {}) },
    integrity: { [DOCX_IO_URL]: DOCX_IO_SRI },
  })}</script>`;
  const viewer = meta?.kind === "viewer";
  const opensFiles = meta?.opensFiles !== false;
  const option = (e: typeof editors[number]) =>
    `<option value="${e.slug}"${e.slug === o.slug ? " selected" : ""}>${esc(e.name)}</option>`;
  const switcher = `<optgroup label="Open-source editors">${editors.filter((e) => e.kind !== "viewer").map(option).join("")}</optgroup>` +
    `<optgroup label="Proprietary viewers (view-only)">${editors.filter((e) => e.kind === "viewer").map(option).join("")}</optgroup>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(o.title)} · open-docs</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='7' fill='%231e3a8a'/><path d='M10 8h9l5 5v11H10z' fill='white'/><path d='M19 8v5h5' fill='%2393c5fd'/></svg>" />
${importMap}
<script>window.__OD_T0 = performance.now();</script>
<!-- First thing on the page: reports browser errors to /api/log. -->
<script src="/lib/report.ts"></script>
<link rel="preconnect" href="https://esm.sh" crossorigin />
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin />
${o.head ?? ""}
<style>${SHELL_CSS}</style>
<!-- The kit must exist before any adapter module runs. -->
<script type="module" src="/lib/boot.ts"></script>
</head>
<body data-slug="${o.slug}" data-name="${esc(meta?.name ?? o.title)}" data-kind="${viewer ? "viewer" : "editor"}">
  <header class="od-bar">
    <a class="od-brand" href="/" title="All editors">
      <span class="od-logo" aria-hidden="true"></span><span>open-docs</span>
    </a>
    <span class="od-sep"></span>
    <label class="od-switch" title="Switch editor">
      <select id="od-switch" aria-label="Editor">${switcher}</select>
    </label>
    <input id="od-docname" class="od-docname" value="Untitled document" spellcheck="false" aria-label="Document name" />
    <span class="od-spacer"></span>
    <button class="od-metrics" id="od-metrics" title="Measured on this page load — click for details" aria-haspopup="dialog">
      <span class="m"><i class="dot"></i><b id="od-m-time">—</b><small>startup</small></span>
      <span class="m"><b id="od-m-mem">—</b><small>JS heap</small></span>
      <span class="m"><b id="od-m-size">—</b><small>loaded</small></span>
    </button>
    ${viewer ? "" : `<button class="od-btn icon" id="od-toggle-agent" title="Toggle assistant" aria-pressed="true" aria-controls="od-aside">
      <svg class="ic" viewBox="0 0 20 20"><path d="M10 2.5l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6z M15.5 13l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z"/></svg>
    </button>`}
    <div class="od-menu-wrap">
      <button class="od-btn od-menu-btn" id="od-more" title="Menu" aria-haspopup="menu" aria-expanded="false" aria-controls="od-menu">
        <svg class="ic" viewBox="0 0 20 20"><path d="M3.5 5.5h13 M3.5 10h13 M3.5 14.5h13"/></svg><span>Menu</span>
      </button>
      <div class="od-menu" id="od-menu" role="menu" hidden>
        <div class="od-menu-label">Document</div>
        ${viewer ? "" : `<button role="menuitem" id="od-new"><svg class="ic" viewBox="0 0 20 20"><path d="M5 2.5h6.5L16 7v10.5H5z M11.5 2.5V7H16" /></svg>New blank document<kbd>⌥N</kbd></button>`}
        ${!opensFiles ? `<div class="od-menu-note">This viewer fetches documents from a public link, so it can't open your own file without publishing it. It shows this site's samples.</div>` : `<button role="menuitem" id="od-import"><svg class="ic" viewBox="0 0 20 20"><path d="M10 13V3 M6 7l4-4 4 4 M3.5 12.5v4h13v-4" /></svg>Open .docx from your computer…<kbd>⌘O</kbd></button>`}
        ${viewer ? "" : `<button role="menuitem" id="od-export"><svg class="ic" viewBox="0 0 20 20"><path d="M10 3v10 M6 9l4 4 4-4 M3.5 12.5v4h13v-4" /></svg>Export this document as .docx<kbd>⌘S</kbd></button>`}
        <hr />
        <div class="od-menu-label">Samples</div>
        <button role="menuitem" id="od-showcase"><svg class="ic" viewBox="0 0 20 20"><path d="M3 4.5h14v11H3z M3 12l4-3.5 3 2.5 3-3 4 3.5"/></svg>Load the rich sample<small>tables, lists, image, styles</small></button>
        <button role="menuitem" id="od-sample"><svg class="ic" viewBox="0 0 20 20"><path d="M5 2.5h10v15H5z M8 6.5h4 M8 9.5h4 M8 12.5h2"/></svg>Load the short sample</button>
        <a role="menuitem" href="/api/showcase.docx" download="open-docs-showcase.docx"><svg class="ic" viewBox="0 0 20 20"><path d="M10 3v10 M6 9l4 4 4-4 M3.5 12.5v4h13v-4" /></svg>Download the rich sample</a>
        <hr />
        <div class="od-menu-label">View</div>
        <button role="menuitem" id="od-metrics-item"><svg class="ic" viewBox="0 0 20 20"><path d="M3.5 16.5v-5 M8 16.5v-9 M12.5 16.5v-6 M17 16.5V3.5"/></svg>Performance of this load</button>
        <button role="menuitem" id="od-reload"><svg class="ic" viewBox="0 0 20 20"><path d="M16 10a6 6 0 1 1-1.8-4.3 M16 3.5v3.5h-3.5"/></svg>Reload editor</button>
        <hr />
        <a role="menuitem" href="/">All editors &amp; measurements</a>
        <a role="menuitem" href="${esc(meta?.repo ?? "#")}" target="_blank" rel="noopener">Library on GitHub ↗</a>
        <a role="menuitem" href="/source" target="_blank" rel="noopener">Source of this demo ↗</a>
      </div>
    </div>
  </header>
  <div class="od-sub">
    <span class="od-pkg">${packages.map((p) => `<code>${esc(p)}</code>`).join(" + ")}</span>
    ${meta?.license ? `<span class="od-lic">${esc(meta.license)}</span>` : ""}
    ${viewer ? `<span class="od-viewonly" title="${esc(meta?.metricsNote ?? "")}">View-only · proprietary viewer — not an editor</span>` : ""}
    <span class="od-blurb">${esc(meta?.blurb ?? "")}</span>
    <span class="od-spacer"></span>
    <span class="od-status" id="od-status" role="status" aria-live="polite"></span>
  </div>
  <div class="od-layout${viewer ? " no-agent" : ""}" id="od-layout">
    <main class="od-stage" id="od-stage">
      ${o.body}
      <div class="od-loading" id="od-loading">
        <div class="spinner"></div>
        <div><strong>Loading ${esc(meta?.name ?? o.title)}…</strong><span id="od-loading-detail">Fetching the editor from the CDN</span></div>
      </div>
    </main>
    ${viewer ? "" : `<aside class="od-aside" id="od-aside" aria-label="Assistant">
      <div class="od-aside-head">
        <div>
          <h2>Assistant</h2>
          <span class="od-model">${esc(AGENT_MODEL)} · via Val Town</span>
        </div>
        <label class="od-auto" title="Apply edits as soon as the assistant proposes them (you can still undo)">
          <input type="checkbox" id="od-autoapply" checked /> Auto-apply
        </label>
        <button class="od-btn icon od-aside-close" id="od-aside-close" type="button" aria-label="Close the assistant">✕</button>
      </div>
      <div class="od-log" id="od-log">
        <div class="od-msg bot"><span class="who">Assistant</span>I can read and edit the document open in <b>${esc(meta?.name ?? o.title)}</b>. Ask me to draft, rewrite, restructure or summarise — every change can be undone.</div>
      </div>
      <div class="od-suggestions" id="od-suggestions"></div>
      <form class="od-input" id="od-form">
        <textarea id="od-prompt" rows="2" placeholder="Ask the assistant to write or edit… (⌘↵ to send)"></textarea>
        <button class="od-btn primary" id="od-send" type="submit" title="Send (⌘↵)">
          <svg class="ic" viewBox="0 0 20 20"><path d="M3 10l14-6-5 14-2.5-5.5z"/></svg>
        </button>
      </form>
    </aside>`}
  </div>
  <dialog class="od-dialog" id="od-metrics-dialog">
    <form method="dialog">
      <header><h3>Performance of ${esc(meta?.name ?? o.title)}</h3><button class="od-btn icon" value="close" aria-label="Close">✕</button></header>
      <div id="od-metrics-body"></div>
      ${meta?.metricsNote ? `<p class="od-note" style="padding:0 18px 12px">${esc(meta.metricsNote)}</p>` : ""}
      <footer><a href="/#metrics">Compare all editors →</a></footer>
    </form>
  </dialog>
  <input type="file" id="od-file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden />
  <script src="https://esm.town/v/std/catch"></script>
  <!-- Adapter first (it registers synchronously), chrome second. -->
  <script type="module" src="${o.entry}"></script>
  <script type="module" src="/lib/ui.ts"></script>
</body>
</html>`;
}

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Mount every shared API route onto the app. */
export function mountShared(app: Hono) {
  app.get("/api/sample.docx", () =>
    new Response(sampleDocx(), {
      headers: {
        "content-type": DOCX_MIME,
        "content-disposition": 'attachment; filename="open-docs-sample.docx"',
        "cache-control": "no-cache",
      },
    }));

  app.get("/api/showcase.docx", () =>
    new Response(showcaseDocx(), {
      headers: {
        "content-type": DOCX_MIME,
        "content-disposition": 'attachment; filename="open-docs-showcase.docx"',
        "cache-control": "public, max-age=300",
      },
    }));

  app.get("/api/sample.txt", (c) =>
    c.json({ title: "Quarterly Report — Acme Robotics", markdown: sampleText }));

  /** A valid, empty .docx (one empty paragraph), built by the same writer as the sample. */
  app.get("/api/blank.docx", () =>
    new Response(buildDocx([{ text: "" }], "Untitled document"), {
      headers: { "content-type": DOCX_MIME, "cache-control": "no-cache" },
    }));

  app.post("/api/import", async (c) => {
    const type = c.req.header("content-type") ?? "";
    const bytes = type.includes("application/json")
      ? base64ToBytes(String((await c.req.json()).base64 ?? ""))
      : new Uint8Array(await c.req.arrayBuffer());
    if (!looksLikeZip(bytes)) {
      return c.json({ error: "That doesn't look like a .docx (zip) file." }, 400);
    }
    try {
      const { title, paragraphs } = textFromDocx(bytes);
      return c.json({
        title: title || "Imported document",
        markdown: paragraphsToText(paragraphs),
        paragraphs,
        bytes: bytes.length,
      });
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  /** Browser error sink — see lib/report.ts. Shows up in the val's logs. */
  app.post("/api/log", async (c) => {
    const b = await c.req.json().catch(() => ({} as Record<string, unknown>));
    const line = `[client:${b.slug}] ${b.kind}: ${b.msg} (${b.w}x${b.h})`;
    if (b.kind === "load" || b.kind === "ready") console.log(line);
    else console.error(line + (b.extra ? `\n${b.extra}` : ""));
    return c.body(null, 204);
  });

  app.post("/api/agent", async (c) => {
    const { slug, document, prompt, history } = await c.req.json();
    if (!prompt || typeof prompt !== "string") {
      return c.json({ error: "prompt required" }, 400);
    }
    try {
      const result = await runAgent({
        slug: String(slug ?? "unknown"),
        document: String(document ?? ""),
        prompt,
        history: Array.isArray(history) ? history : undefined,
      });
      return c.json(result);
    } catch (err) {
      // The browser shows this text in the assistant panel, so return it as JSON.
      console.error("agent error", err);
      return c.json({ error: (err as Error).message || "agent failed" }, 502);
    }
  });

  app.post("/api/metrics", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || !editors.some((e) => e.slug === body.slug)) {
      return c.json({ error: "unknown editor" }, 400);
    }
    await recordMetric(body, c.req.header("user-agent") ?? "");
    return c.body(null, 204);
  });

  app.get("/api/metrics", async (c) => c.json(await summarizeMetrics()));
}

export function bytesToBase64(bytes: Uint8Array): string {
  let out = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    out += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(out);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
