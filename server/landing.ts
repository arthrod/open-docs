/** The comparison page at `/`: every editor, with what it measurably costs. */
import type { EditorMeta } from "./registry.ts";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const RENDER: Record<string, string> = {
  "canvas-editor": "Canvas",
  "docxodus": ".NET WASM",
  "superdoc": "ProseMirror + layout",
  "plate": "Slate / DOM",
  "docen": "Canvas (Leafer)",
  "eigenpal": "React + layout",
  "folio": "ProseMirror + layout",
  "wordcraft": "Rust WASM (egui canvas)",
};

export function landingPage(editors: EditorMeta[]): string {
  const cards = editors.map((e) => `
    <a class="card" href="/e/${e.slug}" data-slug="${e.slug}">
      <div class="card-top">
        <h3>${esc(e.name)}</h3>
        <span class="lic">${esc(e.license)}</span>
      </div>
      <p>${esc(e.blurb)}</p>
      <div class="pkgs">${e.packages.map((p) => `<code>${esc(p)}</code>`).join("")}</div>
      <div class="tags"><span>${esc(RENDER[e.slug] ?? "")}</span><span>.docx in/out</span><span>AI assistant</span></div>
      <dl class="stats">
        <div><dt>Startup</dt><dd data-k="startupMs">—</dd></div>
        <div><dt>JS heap</dt><dd data-k="heapBytes">—</dd></div>
        <div><dt>Loaded</dt><dd data-k="loadedBytes">—</dd></div>
      </dl>
      <span class="open">Open editor →</span>
    </a>`).join("");

  const rows = editors.map((e) => `
    <tr data-slug="${e.slug}">
      <td><a href="/e/${e.slug}">${esc(e.name)}</a></td>
      <td class="n" data-k="startupMs">—</td>
      <td class="n" data-k="coldStartupMs">—</td>
      <td class="n" data-k="mountMs">—</td>
      <td class="n" data-k="heapBytes">—</td>
      <td class="n" data-k="loadedBytes">—</td>
      <td class="n" data-k="resources">—</td>
      <td class="n" data-k="samples">0</td>
      <td class="bar"><i data-bar></i></td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>open-docs — open-source .docx editors, measured</title>
<meta name="description" content="Eight open-source browser document editors with .docx import/export and an AI assistant, side by side with measured startup time, memory and download size." />
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='7' fill='%231e3a8a'/><path d='M10 8h9l5 5v11H10z' fill='white'/><path d='M19 8v5h5' fill='%2393c5fd'/></svg>" />
<script src="https://esm.town/v/std/catch"></script>
<style>
:root { --bg:#f6f7f9; --line:#e3e6ec; --text:#141a26; --muted:#5d6676; --accent:#2557d6; --mono: ui-monospace, "SF Mono", Menlo, monospace; }
* { box-sizing: border-box; }
body { margin:0; font:14px/1.55 "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; color:var(--text); background:var(--bg); -webkit-font-smoothing:antialiased; }
.wrap { max-width:1180px; margin:0 auto; padding:0 24px; }
nav { background:#fff; border-bottom:1px solid var(--line); }
nav .wrap { display:flex; align-items:center; gap:10px; height:56px; }
.brand { display:flex; align-items:center; gap:9px; font-weight:700; font-size:15px; letter-spacing:-.01em; }
.logo { width:24px; height:24px; border-radius:7px; background:linear-gradient(135deg,#1e3a8a,#2557d6); }
nav .sp { flex:1; } nav a { color:var(--muted); text-decoration:none; font-weight:550; margin-left:18px; } nav a:hover { color:var(--text); }
.hero { padding:56px 0 28px; }
.hero h1 { font-size:40px; line-height:1.12; letter-spacing:-.025em; margin:0 0 14px; max-width:780px; }
.hero p { font-size:17px; color:var(--muted); max-width:720px; margin:0; }
.hero .cta { margin-top:22px; display:flex; gap:10px; flex-wrap:wrap; }
.btn { display:inline-flex; align-items:center; height:40px; padding:0 16px; border-radius:9px; font-weight:600; text-decoration:none; border:1px solid var(--line); background:#fff; color:var(--text); }
.btn.primary { background:var(--accent); border-color:var(--accent); color:#fff; }
.grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(268px, 1fr)); gap:16px; padding:12px 0 40px; }
.card { display:flex; flex-direction:column; gap:10px; background:#fff; border:1px solid var(--line); border-radius:14px; padding:18px; text-decoration:none; color:inherit; transition:box-shadow .15s, border-color .15s, transform .15s; }
.card:hover { border-color:#c7d5f7; box-shadow:0 10px 30px rgba(37,87,214,.10); transform:translateY(-1px); }
.card-top { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.card h3 { margin:0; font-size:16.5px; letter-spacing:-.01em; }
.card p { margin:0; color:var(--muted); font-size:13px; flex:1; }
.lic { font-size:11px; font-weight:600; color:var(--muted); border:1px solid var(--line); border-radius:999px; padding:1px 8px; white-space:nowrap; }
.pkgs { display:flex; flex-wrap:wrap; gap:5px; } .pkgs code { font:11px var(--mono); background:#f3f5f8; border:1px solid var(--line); border-radius:5px; padding:1px 5px; }
.tags { display:flex; flex-wrap:wrap; gap:5px; } .tags span { font-size:11px; color:#334155; background:#eef2f9; border-radius:5px; padding:2px 7px; }
.stats { display:grid; grid-template-columns:repeat(3,1fr); margin:4px 0 0; border:1px solid var(--line); border-radius:10px; overflow:hidden; }
.stats div { padding:7px 9px; } .stats div + div { border-left:1px solid var(--line); }
.stats dt { font-size:10.5px; text-transform:uppercase; letter-spacing:.05em; color:#8b93a3; }
.stats dd { margin:0; font-weight:700; font-variant-numeric:tabular-nums; font-size:14px; }
.open { color:var(--accent); font-weight:600; font-size:13px; }
section h2 { font-size:22px; letter-spacing:-.015em; margin:8px 0 6px; }
section > .wrap > p { color:var(--muted); margin:0 0 16px; max-width:760px; }
table { width:100%; border-collapse:collapse; background:#fff; border:1px solid var(--line); border-radius:12px; overflow:hidden; font-size:13px; }
th, td { padding:10px 12px; border-bottom:1px solid var(--line); text-align:left; }
th { font-size:11px; text-transform:uppercase; letter-spacing:.05em; color:#8b93a3; background:#fafbfc; font-weight:600; }
td.n, th.n { text-align:right; font-variant-numeric:tabular-nums; font-family:var(--mono); font-size:12.5px; }
td a { color:var(--text); font-weight:600; text-decoration:none; } td a:hover { color:var(--accent); }
td.bar { width:18%; } td.bar i { display:block; height:8px; border-radius:4px; background:linear-gradient(90deg,#2557d6,#7aa2f7); width:0; transition:width .4s; }
.note { font-size:12.5px; color:var(--muted); margin:12px 0 48px; }
footer { border-top:1px solid var(--line); background:#fff; padding:20px 0; color:var(--muted); font-size:12.5px; }
footer a { color:var(--muted); }
@media (max-width:720px) { .hero h1 { font-size:30px; } td.bar, th.bar, .hide-sm { display:none; } }
</style></head>
<body>
<nav><div class="wrap"><span class="brand"><span class="logo"></span>open-docs</span><span class="sp"></span>
  <a href="#editors">Editors</a><a href="#metrics">Measurements</a><a href="/source" target="_blank" rel="noopener">Source ↗</a></div></nav>
<header class="hero"><div class="wrap">
  <h1>Eight open-source Word editors, running in your browser — measured.</h1>
  <p>Each editor opens on a blank page, imports and exports real <b>.docx</b> files, and has an AI assistant
  (Val Town's OpenAI integration) that edits the document you're working on. Every visit measures startup time,
  memory and download size, so you can compare them on evidence rather than README claims.</p>
  <div class="cta"><a class="btn primary" href="/e/${editors[0]?.slug ?? ""}">Open an editor</a><a class="btn" href="/api/sample.docx">Download a sample .docx</a></div>
</div></header>
<section id="editors"><div class="wrap"><div class="grid">${cards}</div></div></section>
<section id="metrics"><div class="wrap">
  <h2>Measurements</h2>
  <p>Medians over the most recent visits, measured in visitors' browsers. <b>Startup</b> is navigation start →
  editor ready; <b>cold</b> counts only loads where the files came from the network. <b>JS heap</b> is Chromium's
  <code>performance.memory</code> after the editor settles, counted only for the first editor opened in a tab
  (later ones share the tab's process and would inherit its heap). <b>Loaded</b> is the decoded size of every script,
  stylesheet, font and WASM file the page pulled in.</p>
  <table><thead><tr><th>Editor</th><th class="n">Startup</th><th class="n hide-sm">Cold</th><th class="n hide-sm">Mount</th>
  <th class="n">JS heap</th><th class="n">Loaded</th><th class="n hide-sm">Files</th><th class="n hide-sm">Runs</th><th class="bar">Startup</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <p class="note" id="mnote">Loading measurements…</p>
</div></section>
<footer><div class="wrap">Built on <a href="https://val.town">Val Town</a>. Each editor keeps its own license — SuperDoc is AGPL-3.0, so check before you ship it in a closed product.</div></footer>
<script type="module">
const fmtMs = (n) => n == null ? "—" : n < 1000 ? Math.round(n) + " ms" : (n / 1000).toFixed(2) + " s";
const fmtB = (n) => n == null ? "—" : n < 1048576 ? Math.round(n / 1024) + " KB" : (n / 1048576).toFixed(1) + " MB";
const fmt = { startupMs: fmtMs, coldStartupMs: fmtMs, mountMs: fmtMs, heapBytes: fmtB, loadedBytes: fmtB,
  resources: (n) => n == null ? "—" : Math.round(n), samples: (n) => n ?? 0 };
const data = await fetch("/api/metrics").then((r) => r.json()).catch(() => ({}));
const max = Math.max(1, ...Object.values(data).map((d) => d.startupMs ?? 0));
// Each editor has a card AND a table row; count samples once, from the data.
const total = Object.values(data).reduce((n, d) => n + (d.samples ?? 0), 0);
for (const el of document.querySelectorAll("[data-slug]")) {
  const d = data[el.dataset.slug];
  if (!d) continue;
  for (const cell of el.querySelectorAll("[data-k]")) cell.textContent = fmt[cell.dataset.k](d[cell.dataset.k]);
  const bar = el.querySelector("[data-bar]");
  if (bar && d.startupMs) bar.style.width = (100 * d.startupMs / max).toFixed(1) + "%";
}
document.getElementById("mnote").textContent = total
  ? total + " recent measured page loads (up to 200 per editor). Open an editor to add yours — the numbers in its top bar are your own."
  : "No measurements yet — open an editor and its numbers appear here.";
</script>
</body></html>`;
}
