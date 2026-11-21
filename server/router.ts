/**
 * Shared routes every editor demo gets, so each `editors/<slug>/` folder only
 * has to supply its own shell + mount code.
 *
 *   GET  /e/<slug>             the editor page (shared chrome + editor body)
 *   GET  /api/sample.docx      the shared fixture, byte-for-byte
 *   GET  /api/showcase.docx    the rich sample (scripts/make_showcase.py)
 *   GET  /api/redline.docx     the rich sample with tracked changes and comments
 *   GET  /api/lorem-500.docx   500 pages of lorem ipsum (scripts/make_lorem.py)
 *   GET  /api/blank.docx       a valid empty .docx
 *   POST /api/import           .docx → { title, markdown }
 *   POST /api/agent            { document, prompt, history } → { reply, edit? }
 *   POST /api/metrics          one page-load measurement (startup/memory/bytes)
 *   GET  /api/metrics          per-editor medians, for the landing page
 */
import type { Hono } from "npm:hono@4";
import { bodyLimit } from "npm:hono@4/body-limit";
import { serveFile } from "https://esm.town/v/std/utils/serve-file.ts";
import { editors, type Maker } from "./registry.ts";
import { sampleDocx, sampleText, paragraphsToText } from "./sample.docx.ts";
import { showcaseDocx } from "./showcase.docx.ts";
import { fixtureBytes, FIXTURES } from "./fixtures.ts";
import { buildDocx, looksLikeZip, textFromDocx, textToParagraphs } from "./docx.ts";
import { DOCX_PREVIEW_MAX_BYTES, renderDocxPages } from "../editors/wordcraft/render.ts";
import { DOCX_IO_SRI, DOCX_IO_URL } from "../lib/plate-docx-pin.ts";
import { AGENT_MODEL, runAgent } from "./agent.ts";
import { recordMetric, summarizeMetrics } from "./metrics.ts";
import { FONT_MONO_URL, FONT_SANS_URL, SHELL_CSS } from "./styles.ts";

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
  /**
   * The engine's files must come from the origin of the page showing it (it starts a Worker from
   * them, or reaches into a frame of them). A site that embeds this shell elsewhere (the viewer
   * site) then passes those files through its own origin instead of linking to this one.
   */
  sameOrigin?: boolean;
  /**
   * Render NO assistant panel and NO toggle button (page works standalone —
   * e.g. cite-check, whose owner explicitly does not want the agent there).
   */
  noAgent?: boolean;
}

export { REACT_IMPORTS } from "./react-imports.ts";
import { REACT_IMPORTS } from "./react-imports.ts";

export function registerEditor(app: Hono, opts: EditorShell) {
  app.get(`/e/${opts.slug}`, (c) => c.html(shell(opts, c.req.query("embed") === "1")));
  // The editor folder's own client modules + assets.
  app.get(`/e/${opts.slug}/*`, (c) => serveFile(c.req.path));
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The #od-menu panel. Shared by the bar (non-embed) and the floating embed
 * panel. `embed` drops "Editors arena →" (we are already inside it) and opens
 * "All editors & measurements" in a new tab so the iframe does not navigate.
 * The non-embed string is the historical markup, whitespace included.
 */
/** A maker's link: LinkedIn when verified, GitHub otherwise. */
const makerHref = (m: Maker) => m.linkedin ?? m.github ?? "#";
const makerVia = (m: Maker) => (m.linkedin ? "LinkedIn" : "GitHub");

/** "/ Made by" menu section; empty when the registry credits nobody. */
function madeBySection(makers: Maker[]): string {
  if (!makers.length) return "";
  const items = makers.map((m) =>
    `<a role="menuitem" href="${esc(makerHref(m))}" target="_blank" rel="noopener">${esc(m.name)} →<small>${m.kind === "company" ? "Company" : "Developer"} · ${makerVia(m)}</small></a>`
  ).join("\n        ");
  return `
        <hr />
        <div class="od-menu-label"><span class="sq" aria-hidden="true"></span> / Made by</div>
        ${items}`;
}

function menuPanel(embed: boolean, viewer: boolean, opensFiles: boolean, repo: string, makers: Maker[] = []): string {
  const allEditors = embed
    ? `<a role="menuitem" href="/" target="_blank" rel="noopener">All editors &amp; measurements</a>`
    : `<a role="menuitem" href="/">All editors &amp; measurements</a>`;
  const arena = embed
    ? ""
    : `\n        <a role="menuitem" href="https://arena.benchmarks.law" target="_blank" rel="noopener">Editors arena →</a>`;
  return `      <div class="od-menu" id="od-menu" role="menu" hidden>
        <div class="od-menu-label"><span class="sq" aria-hidden="true"></span> / Document</div>
        ${viewer ? "" : `<button role="menuitem" id="od-rename">Rename document…</button>`}
        ${viewer ? "" : `<button role="menuitem" id="od-new">New blank document<kbd>⌥N</kbd></button>`}
        ${!opensFiles ? `<div class="od-menu-note">This viewer fetches documents from a public link, so it can't open your own file without publishing it. It shows this site's samples.</div>` : `<button role="menuitem" id="od-import">Open .docx from your computer…<kbd>⌘O</kbd></button>`}
        ${viewer ? "" : `<button role="menuitem" id="od-export">Export this document as .docx<kbd>⌘S</kbd></button>`}
        <hr />
        <div class="od-menu-label"><span class="sq" aria-hidden="true"></span> / Samples</div>
        <button role="menuitem" id="od-showcase">Load the rich sample<small>tables, lists, image, styles</small></button>
${FIXTURES.map((f) => `        <button role="menuitem" class="od-fixture" data-file="${f.file}" data-title="${esc(f.title)}" data-label="${esc(f.label)}">Load the ${esc(f.label)} sample<small>${esc(f.note)}</small></button>\n`).join("")}        <button role="menuitem" id="od-sample">Load the short sample</button>
        <a role="menuitem" href="/api/showcase.docx" download="open-docs-showcase.docx">Download the rich sample ↓</a>
        <hr />
        <div class="od-menu-label"><span class="sq" aria-hidden="true"></span> / View</div>
        <button role="menuitem" id="od-metrics-item">Performance of this load</button>
        <button role="menuitem" id="od-reload">Reload editor</button>${madeBySection(makers)}
        <hr />
        ${allEditors}${arena}
        <a role="menuitem" href="${esc(repo)}" target="_blank" rel="noopener">Library on GitHub →</a>
        <a role="menuitem" href="/source" target="_blank" rel="noopener">Source of this demo →</a>
        <a role="menuitem" class="od-contact" href="https://arthur.law/contact" target="_blank" rel="noopener">Contact →</a>
      </div>`;
}

/**
 * The editor page. `embed` (from ?embed=1): editors-arena loads the page in an
 * iframe with no bar at all (the arena's slot header is the only one). The
 * menu panel still renders, without the #od-more button, so the arena can
 * open it. The stage, the file input, and the metrics dialog stay, because
 * lib/ui.ts looks them up. The postMessage channel lives in lib/ui.ts;
 * lib/embed.ts holds the message shapes.
 */
function shell(o: EditorShell, embed = false): string {
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
  const noAgent = !!o.noAgent; // viewer pages never get the agent either
  const agentless = viewer || noAgent;
  const opensFiles = meta?.opensFiles !== false;
  const option = (e: typeof editors[number]) =>
    `<option value="${e.slug}"${e.slug === o.slug ? " selected" : ""}>${esc(e.name)}</option>`;
  const switcher = `<optgroup label="Open-source editors">${editors.filter((e) => e.kind !== "viewer").map(option).join("")}</optgroup>` +
    `<optgroup label="Proprietary viewers (view-only)">${editors.filter((e) => e.kind === "viewer").map(option).join("")}</optgroup>`;
  const panel = menuPanel(embed, viewer, opensFiles, meta?.repo ?? "#", meta?.makers ?? []);
  // Leading spaces live on the template line, so a non-embed page stays byte-identical.
  const embedMenu = embed
    ? `<div class="od-menu-wrap od-embed-menu">\n${panel}\n    </div>\n`
    : "";
  const renameDialog = viewer
    ? ""
    : `<dialog class="od-dialog od-name-dialog" id="od-rename-dialog" aria-labelledby="od-rename-title">
    <form id="od-rename-form">
      <header><h3 id="od-rename-title">Rename document</h3><button class="od-btn icon" type="button" data-od-rename-cancel aria-label="Cancel">×</button></header>
      <div class="od-name-body">
        <label for="od-rename-input">Document name</label>
        <input id="od-rename-input" type="text" spellcheck="false" autocomplete="off" />
      </div>
      <footer>
        <button class="od-btn" type="button" data-od-rename-cancel>Cancel</button>
        <button class="od-btn primary" type="submit">Save</button>
      </footer>
    </form>
  </dialog>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(o.title)} · open-docs</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' fill='%230A0A0A'/><rect x='4' y='20' width='24' height='7' fill='%23FFD400'/></svg>" />
${importMap}
<script>window.__OD_T0 = performance.now();</script>
<!-- First thing on the page: reports browser errors to /api/log. -->
<script src="/lib/report.ts"></script>
<link rel="preconnect" href="https://esm.sh" crossorigin />
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin />
<link rel="preload" href="${FONT_SANS_URL}" as="font" type="font/woff2" crossorigin />
<link rel="preload" href="${FONT_MONO_URL}" as="font" type="font/woff2" crossorigin />
${o.head ?? ""}
<style>${SHELL_CSS}</style>
<!-- The kit must exist before any adapter module runs. -->
<script type="module" src="/lib/boot.ts"></script>
</head>
<body data-slug="${o.slug}" data-name="${esc(meta?.name ?? o.title)}" data-kind="${viewer ? "viewer" : "editor"}"${embed ? ' class="od-embed"' : ""}>
  ${embedMenu}${embed ? "" : `<header class="site-nav od-bar">
    <a class="wm" href="/" title="All editors">
      <span class="logo"><span class="del">CHILL</span><span class="ins">NEUROTIC</span></span><span class="dot">.</span>DOCX<span class="dot">.</span>BENCH
    </a>
    <span class="crumb">/ editors</span>
    <span class="od-spacer"></span>
    <label class="od-switch" title="Switch editor">
      <img class="od-switch-ico" src="/lib/icons/numpad.svg" alt="" width="16" height="16" />
      <select id="od-switch" aria-label="Editor">${switcher}</select>
    </label>
    <button class="od-metrics" id="od-metrics" title="Measured on this page load. Click for details." aria-haspopup="dialog">
      <span class="m"><i class="dot"></i><b id="od-m-time">—</b><small>startup</small></span>
      <span class="m"><b id="od-m-mem">—</b><small>JS heap</small></span>
      <span class="m"><b id="od-m-size">—</b><small>loaded</small></span>
    </button>
    ${agentless ? "" : `<button class="od-btn" id="od-toggle-agent" title="Toggle assistant" aria-pressed="true" aria-controls="od-aside">AI</button>`}
    <div class="od-menu-wrap">
      <button class="od-btn od-menu-btn" id="od-more" type="button" title="Menu" aria-label="Menu" aria-haspopup="menu" aria-expanded="false" aria-controls="od-menu">
        <span class="od-burger" aria-hidden="true"><i></i><i></i><i></i></span><span class="od-menu-lbl">MENU</span>
      </button>
${panel}
    </div>
  </header>`}
  ${embed ? "" : `<div class="od-sub">
    <span class="od-pkg">${packages.map((p) => `<code>${esc(p)}</code>`).join(" + ")}</span>
    ${meta?.license ? `<span class="od-lic">${esc(meta.license)}</span>` : ""}
    ${meta?.makers?.length ? `<span class="od-makers">by ${meta.makers.map((m) => `<a href="${esc(makerHref(m))}" target="_blank" rel="noopener" title="${esc(m.name)} on ${makerVia(m)}">${esc(m.name)}</a>`).join(", ")}</span>` : ""}
    ${viewer ? `<span class="od-viewonly" title="${esc(meta?.metricsNote ?? "")}">View-only · proprietary viewer, not an editor</span>` : ""}
    <span class="od-blurb">${esc(meta?.blurb ?? "")}</span>
    <span class="od-spacer"></span>
    <span class="od-status" id="od-status" role="status" aria-live="polite"></span>
  </div>`}
  <div class="od-layout${agentless || embed ? " no-agent" : ""}" id="od-layout">
    <main class="od-stage" id="od-stage">
      ${o.body}
      <div class="od-loading" id="od-loading">
        <div class="spinner"></div>
        <div><strong>Loading ${esc(meta?.name ?? o.title)}…</strong><span id="od-loading-detail">Fetching the editor from the CDN</span></div>
      </div>
    </main>
    ${agentless || embed ? "" : `<aside class="od-aside" id="od-aside" aria-label="Assistant">
      <div class="od-aside-head">
        <div>
          <h2><span class="sq" aria-hidden="true"></span> / Assistant</h2>
          <span class="od-model">${esc(AGENT_MODEL)} · via Val Town</span>
        </div>
        <label class="od-auto" title="Apply edits as soon as the assistant proposes them (you can still undo)">
          <input type="checkbox" id="od-autoapply" checked /> Auto-apply
        </label>
        <button class="od-btn icon od-aside-close" id="od-aside-close" type="button" aria-label="Close the assistant">×</button>
      </div>
      <div class="od-log" id="od-log">
        <div class="od-msg bot"><span class="who">Assistant</span>I can read and edit the document open in <b>${esc(meta?.name ?? o.title)}</b>. Ask me to draft, rewrite, restructure or summarise. Every change can be undone.</div>
      </div>
      <div class="od-suggestions" id="od-suggestions"></div>
      <form class="od-input" id="od-form">
        <textarea id="od-prompt" rows="2" placeholder="Ask the assistant to write or edit (⌘↵ to send)"></textarea>
        <button class="od-btn primary" id="od-send" type="submit" title="Send (⌘↵)" aria-label="Send"><span class="arr" aria-hidden="true">→</span></button>
      </form>
    </aside>`}
  </div>
  <dialog class="od-dialog" id="od-metrics-dialog">
    <form method="dialog">
      <header><h3>Performance of ${esc(meta?.name ?? o.title)}</h3><button class="od-btn icon" value="close" aria-label="Close">×</button></header>
      <div id="od-metrics-body"></div>
      ${meta?.metricsNote ? `<p class="od-note" style="padding:0 18px 12px">${esc(meta.metricsNote)}</p>` : ""}
      <footer><a href="/#metrics">Compare all editors →</a></footer>
    </form>
  </dialog>
  ${renameDialog}
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
    new Response(new Uint8Array(sampleDocx()), {
      headers: {
        "content-type": DOCX_MIME,
        "content-disposition": 'attachment; filename="open-docs-sample.docx"',
        "cache-control": "no-cache",
      },
    }));

  app.get("/api/showcase.docx", () =>
    new Response(new Uint8Array(showcaseDocx()), {
      headers: {
        "content-type": DOCX_MIME,
        "content-disposition": 'attachment; filename="open-docs-showcase.docx"',
        "cache-control": "public, max-age=300",
      },
    }));

  // The large samples: fetched from Hugging Face at a pinned commit (server/fixtures.ts).
  for (const f of FIXTURES) {
    app.get(`/api/${f.file}`, async (c) => {
      let bytes: Uint8Array;
      try {
        bytes = await fixtureBytes(f);
      } catch (err) {
        // 4xx on purpose: Val Town's edge replaces 5xx bodies, which would hide why.
        return c.text(`could not load ${f.file}: ${(err as Error).message}`, 424);
      }
      return new Response(bytes as Uint8Array<ArrayBuffer>, {
        headers: {
          "content-type": DOCX_MIME,
          "content-disposition": `attachment; filename="open-docs-${f.file}"`,
          "cache-control": "public, max-age=86400, immutable",
          "access-control-allow-origin": "*",
        },
      });
    });
  }

  app.get("/api/sample.txt", (c) =>
    c.json({ title: "Quarterly Report — Acme Robotics", markdown: sampleText }));

  /** A valid, empty .docx (one empty paragraph), built by the same writer as the sample. */
  app.get("/api/blank.docx", () =>
    new Response(new Uint8Array(buildDocx([{ text: "" }], "Untitled document")), {
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

  const previewCache = new Map<string, { png: Uint8Array; count: number }>();

  app.get("/api/wordcraft/preview", async (c) => {
    const key = c.req.query("doc") === "showcase" ? "showcase" : "sample";
    let hit = previewCache.get(key);
    if (!hit) {
      const docx = key === "showcase" ? showcaseDocx() : sampleDocx();
      const pages = await renderDocxPages(docx, 1.0);
      if (!pages.length) return c.json({ error: "rendered 0 pages" }, 500);
      hit = { png: pages[0], count: pages.length };
      previewCache.set(key, hit);
    }
    return new Response(hit.png.slice(), {
      headers: {
        "content-type": "image/png",
        "x-wordcraft-page-count": String(hit.count),
        "cache-control": "public, max-age=300",
      },
    });
  });

  // Base64 inside JSON inflates ~4/3 plus the object wrapper; the decoded-size
  // check below still caps real .docx bytes at DOCX_PREVIEW_MAX_BYTES.
  const previewBodyLimit = Math.ceil(DOCX_PREVIEW_MAX_BYTES * 4 / 3) + 1024;

  app.post("/api/wordcraft/preview", bodyLimit({
    maxSize: previewBodyLimit,
    onError: (c) => c.json({ error: "Request body too large." }, 413),
  }), async (c) => {
    const type = c.req.header("content-type") ?? "";
    const bytes = type.includes("application/json")
      ? base64ToBytes(String((await c.req.json()).docxBase64 ?? ""))
      : new Uint8Array(await c.req.arrayBuffer());
    if (!looksLikeZip(bytes)) {
      return c.json({ error: "That doesn't look like a .docx (zip) file." }, 400);
    }
    if (bytes.byteLength > DOCX_PREVIEW_MAX_BYTES) {
      return c.json({ error: "Document too large to preview." }, 413);
    }
    let pages: Uint8Array[];
    try {
      pages = await renderDocxPages(bytes, 1.0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.json({ error: msg }, msg.includes("timed out") ? 504 : 500);
    }
    if (!pages.length) return c.json({ error: "rendered 0 pages" }, 500);
    return new Response(pages[0].slice(), {
      headers: {
        "content-type": "image/png",
        "x-wordcraft-page-count": String(pages.length),
        "cache-control": "no-store",
      },
    });
  });

  app.post("/api/wordcraft/convert", async (c) => {
    const type = c.req.header("content-type") ?? "";
    if (type.includes("application/json")) {
      const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
      if (!body) return c.json({ error: "invalid JSON body" }, 400);
      if (typeof body.markdown === "string") {
        const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "Document";
        const docx = buildDocx(textToParagraphs(body.markdown), title);
        // RFC 6266: sanitized-ASCII filename fallback plus filename* for the real title.
        const asciiName = title.replace(/[^\x20-\x7e]/g, "").replace(/[\\/:*?"<>|]+/g, "-").trim() ||
          "document";
        const utf8Name = encodeURIComponent(`${title}.docx`).replace(
          /['()*]/g,
          (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`,
        );
        return new Response(docx.slice(), {
          headers: {
            "content-type": DOCX_MIME,
            "content-disposition": `attachment; filename="${asciiName}.docx"; filename*=UTF-8''${utf8Name}`,
            "cache-control": "no-store",
          },
        });
      }
      const b64 = typeof body.docxBase64 === "string" ? body.docxBase64 : typeof body.base64 === "string" ? body.base64 : "";
      const bytes = base64ToBytes(b64);
      if (!looksLikeZip(bytes)) {
        return c.json({ error: "That doesn't look like a .docx (zip) file." }, 400);
      }
      const { title, paragraphs } = textFromDocx(bytes);
      return c.json({
        title: title || "Imported document",
        markdown: paragraphsToText(paragraphs),
        paragraphs,
        bytes: bytes.length,
      });
    }
    const bytes = new Uint8Array(await c.req.arrayBuffer());
    if (!looksLikeZip(bytes)) {
      return c.json({ error: "That doesn't look like a .docx (zip) file." }, 400);
    }
    const { title, paragraphs } = textFromDocx(bytes);
    return c.json({
      title: title || "Imported document",
      markdown: paragraphsToText(paragraphs),
      paragraphs,
      bytes: bytes.length,
    });
  });
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
