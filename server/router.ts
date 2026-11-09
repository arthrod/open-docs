/**
 * Shared routes every editor demo gets, so each `editors/<slug>/` folder only
 * has to supply its own shell + mount code and say how it imports/exports.
 *
 *   GET  /api/sample.docx      the shared fixture, byte-for-byte
 *   GET  /api/sample.txt       the same fixture as markdown
 *   POST /api/import           upload .docx → { title, markdown, base64 }
 *   POST /api/agent            { document, prompt } → { reply, edit? }
 *   GET  /api/agent/pending    reconnect path for a staged edit
 */
import type { Hono } from "npm:hono";
import { serveFile } from "https://esm.town/v/std/utils/index.ts";
import { editors } from "./registry.ts";
import { sampleDocx, sampleText, paragraphsToText, textToParagraphs } from "./sample.docx.ts";
import { buildDocx, looksLikeZip, textFromDocx } from "./docx.ts";
import { runAgent } from "./agent.ts";

const STYLES = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #1f2430; background: #f4f5f7; }
.od-bar { display: flex; align-items: center; gap: 10px; padding: 8px 14px; background: #fff; border-bottom: 1px solid #dfe2e8; flex-wrap: wrap; }
.od-bar h1 { font-size: 14px; margin: 0; font-weight: 650; letter-spacing: -0.01em; }
.od-bar .ver { font-size: 11px; color: #6b7280; font-family: ui-monospace, monospace; }
.od-bar a { color: #4b5563; }
.od-btn { font: inherit; font-size: 12.5px; padding: 5px 10px; border-radius: 7px; border: 1px solid #d3d7de; background: #fff; cursor: pointer; white-space: nowrap; }
.od-btn:hover { background: #f3f4f6; border-color: #c3c8d1; }
.od-btn[disabled] { opacity: .55; cursor: progress; }
.od-btn.primary { background: #1f2937; border-color: #1f2937; color: #fff; }
.od-btn.primary:hover { background: #111827; }
.od-spacer { flex: 1; }
.od-status { font-size: 12px; color: #6b7280; max-width: 46ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.od-status.err { color: #b91c1c; }
.od-status.ok { color: #047857; }
html, body { height: 100%; }
body { display: flex; flex-direction: column; overflow: hidden; }
.od-layout { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 10px; padding: 10px; }
@media (max-width: 1000px) { .od-layout { grid-template-columns: minmax(0, 1fr); } .od-aside { display: none !important; } }
/* Paged editors virtualise against their scroll container, so the stage needs a
   DEFINITE height — min-height alone lets it grow forever and nothing scrolls. */
.od-stage { height: 100%; min-height: 0; background: #fff; border: 1px solid #dfe2e8; border-radius: 10px; overflow: hidden; display: flex; flex-direction: column; position: relative; }
.od-stage > * { flex: 1 1 auto; min-height: 0; }
.od-aside { min-height: 0; background: #fff; border: 1px solid #dfe2e8; border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.od-aside h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: #6b7280; margin: 0; }
.od-aside .od-log { flex: 1; overflow: auto; display: flex; flex-direction: column; gap: 8px; font-size: 13px; min-height: 80px; }
.od-msg { border-radius: 8px; padding: 7px 9px; line-height: 1.45; white-space: pre-wrap; word-break: break-word; }
.od-msg.user { background: #eef2ff; }
.od-msg.bot { background: #f3f4f6; }
.od-msg .who { display: block; font-size: 10.5px; text-transform: uppercase; letter-spacing: .05em; color: #9ca3af; margin-bottom: 2px; }
.od-pending { border: 1px solid #fcd34d; background: #fffbeb; border-radius: 8px; padding: 9px; font-size: 12.5px; display: flex; flex-direction: column; gap: 7px; }
.od-pending .row { display: flex; gap: 6px; }
.od-input { display: flex; gap: 6px; }
.od-input textarea { flex: 1; resize: vertical; min-height: 40px; max-height: 120px; font: inherit; font-size: 13px; padding: 7px 9px; border: 1px solid #d3d7de; border-radius: 8px; }
.od-suggestions { display: flex; flex-wrap: wrap; gap: 5px; }
.od-suggestions button { font-size: 11.5px; padding: 3px 8px; border-radius: 999px; border: 1px solid #d3d7de; background: #fff; cursor: pointer; color: #4b5563; }
.od-suggestions button:hover { background: #f3f4f6; }
`;

/**
 * Registers the shared API + a per-editor shell.
 *
 * @param app the val's Hono app
 * @param route the mount function for one editor folder
 */
export function registerEditor(
  app: Hono,
  opts: {
    slug: string;
    /** Path (relative to val root) of the editor's folder entry, e.g. /editors/folio/boot.ts */
    entry: string;
    /** Extra <head> html for the editor (their stylesheet, cdn script, …) */
    head?: string;
    /** Extra body markup (containers the editor mounts into) */
    body: string;
    /** Title shown in the shared top bar */
    title: string;
  },
) {
  const meta = editors.find((e) => e.slug === opts.slug);

  app.get(`/e/${opts.slug}`, (c) =>
    c.html(shell({
      slug: opts.slug,
      title: opts.title,
      entry: opts.entry,
      head: opts.head ?? "",
      body: opts.body,
      source: meta?.repo ?? "",
      packages: meta?.packages ?? [],
      license: meta?.license ?? "",
    })));

  // The editor folder's own client modules + assets.
  app.get(`/e/${opts.slug}/*`, (c) => serveFile(c.req.path));
}

function shell(o: {
  slug: string;
  title: string;
  entry: string;
  head: string;
  body: string;
  source: string;
  packages: string[];
  license: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${o.title} · open-docs</title>
<!-- First thing on the page: reports browser errors to /api/log. -->
<script src="/lib/report.ts"></script>
${o.head}
<style>${STYLES}</style>
<!-- The kit must exist before any adapter module runs. -->
<script type="module" src="/lib/boot.ts"></script>
</head>
<body data-slug="${o.slug}">
  <div class="od-bar">
    <h1>${o.title}</h1>
    <span class="ver">${o.packages.join(" + ")}${o.license ? ` · ${o.license}` : ""}</span>
    <span class="od-spacer"></span>
    <button class="od-btn" id="od-new" title="Start an empty document">New</button>
    <button class="od-btn" id="od-import">Import .docx</button>
    <button class="od-btn" id="od-sample">Open sample</button>
    <a class="od-btn" id="od-sample-dl" href="/api/sample.docx" download="open-docs-sample.docx" title="Download the sample .docx">Sample .docx ↓</a>
    <button class="od-btn" id="od-reload">Reset</button>
    <button class="od-btn primary" id="od-export">Export .docx</button>
    <span class="od-status" id="od-status"></span>
    <a class="od-btn" href="/">all editors</a>
    <a class="od-btn" href="/source">source</a>
  </div>
  <div class="od-layout">
    <div class="od-stage" id="od-stage">${o.body}</div>
    <aside class="od-aside">
      <h2>Agent</h2>
      <div class="od-log" id="od-log">
        <div class="od-msg bot"><span class="who">agent</span>Ask me to rewrite a section, tighten the summary, or add a call to action. I'll propose the edit before touching the document.</div>
      </div>
      <div class="od-suggestions" id="od-suggestions"></div>
      <div class="od-input">
        <textarea id="od-prompt" rows="2" placeholder="e.g. Turn the risks into a short bulleted list"></textarea>
        <button class="od-btn primary" id="od-send">Send</button>
      </div>
    </aside>
  </div>
  <input type="file" id="od-file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden />
  <script src="https://esm.town/v/std/catch"></script>
  <!-- Adapter first (it registers synchronously), chrome second. -->
  <script type="module" src="${o.entry}"></script>
  <script type="module" src="/lib/ui.ts"></script>
</body>
</html>`;
}

/** Mount every shared API route onto the app. */
export function mountShared(app: Hono) {
  app.get("/api/sample.docx", () =>
    new Response(sampleDocx(), {
      headers: {
        "content-type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "content-disposition": 'attachment; filename="open-docs-sample.docx"',
        "cache-control": "no-cache",
      },
    }));

  app.get("/api/sample.txt", (c) =>
    c.json({ title: "Quarterly Report — Acme Robotics", markdown: sampleText }));

  /**
   * A valid, empty .docx (one empty paragraph).
   *
   * Built with the same `buildDocx` that produces the sample fixture, so it has
   * the part ordering every consumer here already accepts —
   * `word/_rels/document.xml.rels` before `word/document.xml`. Hand-zipping it
   * in the browser tripped office-open with "invalid ZIP entry: _rels/.rels".
   */
  app.get("/api/blank.docx", () => {
    const bytes = buildDocx([{ text: "" }], "Untitled document");
    return new Response(bytes, {
      headers: {
        "content-type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "cache-control": "no-cache",
      },
    });
  });

  app.post("/api/import", async (c) => {
    const type = c.req.header("content-type") ?? "";
    let bytes: Uint8Array;
    if (type.includes("application/json")) {
      const body = await c.req.json();
      bytes = base64ToBytes(String(body.base64 ?? ""));
    } else {
      bytes = new Uint8Array(await c.req.arrayBuffer());
    }
    if (!looksLikeZip(bytes)) {
      return c.json({ error: "That doesn't look like a .docx (zip) file." }, 400);
    }
    try {
      const { title, paragraphs } = textFromDocx(bytes);
      return c.json({
        title: title || "Imported document",
        markdown: paragraphsToText(paragraphs),
        paragraphs,
        base64: bytesToBase64(bytes),
        bytes: bytes.length,
      });
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  app.post("/api/export", async (c) => {
    const { markdown, title } = await c.req.json();
    if (typeof markdown !== "string") return c.json({ error: "markdown required" }, 400);
    const bytes = buildDocx(textToParagraphs(markdown), title || "Document");
    return c.json({ base64: bytesToBase64(bytes) });
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
      console.error("agent error", err);
      return c.json({ error: (err as Error).message || "agent failed" }, 500);
    }
  });

  app.get("/api/agent/pending", async (c) => {
    const { takePending } = await import("./agent.ts");
    return c.json({ edits: takePending(c.req.query("slug") ?? "") });
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
