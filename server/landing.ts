/** The comparison page at `/`: every editor, with what it measurably costs. */
import type { EditorMeta } from "./registry.ts";
import { DS_ROOT, FONT_MONO_URL, FONT_SANS_URL } from "./styles.ts";

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
  "word-online": "Microsoft's servers (iframe)",
  "google-viewer": "Google's servers (iframe)",
  "apryse": "WASM office engine → canvas",
  "nutrient": ".NET WASM → PDF → canvas",
};

const FAVICON =
  "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' fill='%230A0A0A'/><rect x='4' y='20' width='24' height='7' fill='%23FFD400'/></svg>";

export function landingPage(all: EditorMeta[]): string {
  const editors = all.filter((e) => e.kind !== "viewer");
  const viewers = all.filter((e) => e.kind === "viewer");
  const card = (e: EditorMeta) => `
    <a class="vendor" href="/e/${e.slug}" data-slug="${e.slug}">
      <div class="v-top">
        <h3 class="v-name">${esc(e.name)}</h3>
        <span class="v-lic">${esc(e.license)}</span>
      </div>
      <p class="v-blurb">${esc(e.blurb)}</p>
      <div class="pkgs">${e.packages.map((p) => `<code>${esc(p)}</code>`).join("")}</div>
      <div class="tags"><span>${esc(RENDER[e.slug] ?? "")}</span>${
        e.kind === "viewer"
          ? `<span class="vo">View-only</span>${e.opensFiles === false ? "<span>Site samples only</span>" : "<span>.docx in</span>"}`
          : "<span>.docx in/out</span><span>AI assistant</span>"
      }</div>
      <dl class="card-metrics">
        <div><dt>Startup</dt><dd data-k="startupMs">—</dd></div>
        <div><dt>JS heap</dt><dd data-k="heapBytes">—</dd></div>
        <div><dt>Loaded</dt><dd data-k="loadedBytes">—</dd></div>
      </dl>
      <span class="open">${e.kind === "viewer" ? "Open viewer →" : "Open editor →"}</span>
    </a>`;
  const cards = editors.map(card).join("");
  const vcards = viewers.map(card).join("");

  const row = (e: EditorMeta) => `
    <tr data-slug="${e.slug}">
      <td><a href="/e/${e.slug}">${esc(e.name)}</a></td>
      <td class="n" data-k="startupMs">—</td>
      <td class="n hide-sm" data-k="coldStartupMs">—</td>
      <td class="n hide-sm" data-k="mountMs">—</td>
      <td class="n" data-k="heapBytes">—</td>
      <td class="n" data-k="loadedBytes">—</td>
      <td class="n hide-sm" data-k="resources">—</td>
      <td class="n hide-sm" data-k="samples">0</td>
      <td class="bar"><i data-bar></i></td>
    </tr>`;
  const rows = editors.map(row).join("");
  const vrows = viewers.map(row).join("");

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>open-docs · open-source .docx editors, measured</title>
<meta name="description" content="Open-source browser document editors with .docx import and export and an AI assistant, side by side with measured startup time, memory and download size." />
<link rel="icon" href="${FAVICON}" />
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin />
<link rel="preload" href="${FONT_SANS_URL}" as="font" type="font/woff2" crossorigin />
<link rel="preload" href="${FONT_MONO_URL}" as="font" type="font/woff2" crossorigin />
<script src="https://esm.town/v/std/catch"></script>
<style>
${DS_ROOT}
html { scroll-behavior: smooth; }
.od-land, .od-land *, .od-land *::before, .od-land *::after { box-sizing: border-box; }
.od-land {
  margin: 0; background: var(--bg); color: var(--ink);
  font-family: var(--font-sans); font-size: 17px; font-weight: 400; line-height: 1.6; letter-spacing: -0.01em;
  -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
}
.od-land ::selection { background: var(--mark); color: var(--mark-text); }
.od-land a { color: inherit; }
.od-land a:focus-visible, .od-land button:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }
.wrap { max-width: var(--page-max); margin-inline: auto; padding-inline: clamp(20px, 5vw, 56px); }
.site-nav {
  position: sticky; top: 0; z-index: 60;
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  -webkit-backdrop-filter: saturate(140%) blur(10px); backdrop-filter: saturate(140%) blur(10px);
  border-bottom: 1px solid var(--ink);
}
.nav-row { display: flex; align-items: center; gap: 18px; min-height: 56px; flex-wrap: wrap; padding-block: 10px; }
.od-wm {
  display: inline-flex; align-items: baseline; font-family: var(--font-mono); font-weight: 700; font-size: 13px;
  letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink); text-decoration: none; white-space: nowrap;
}
.od-wm .del { color: var(--del); text-decoration: line-through; text-decoration-thickness: 2px; margin-right: 6px; }
.od-wm .ins { color: var(--ins); text-decoration: underline double; text-decoration-color: var(--ins); text-underline-offset: 3px; }
.od-wm:hover .ins {
  background-image: linear-gradient(var(--mark), var(--mark)); background-repeat: no-repeat;
  background-size: 100% 0.55em; background-position: 0 78%;
}
.site-nav nav { margin-left: auto; display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
.site-nav nav a {
  font-family: var(--font-mono); font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--muted); text-decoration: none; border-bottom: 2px solid transparent; padding-bottom: 2px;
}
.site-nav nav a:hover { color: var(--ink); }
.hero { padding: 44px 0 36px; }
.eyebrow {
  font-family: var(--font-mono); font-size: 12px; color: var(--muted); letter-spacing: 0.08em;
  text-transform: uppercase; margin: 0 0 22px;
}
.eyebrow .sep { opacity: .4; margin: 0 8px; }
.hero h1 {
  font-weight: 700; font-size: clamp(34px, 5.4vw, 60px); line-height: 1.05; letter-spacing: -0.025em;
  margin: 0 0 22px; max-width: 16ch;
}
.mark {
  background-image: linear-gradient(var(--mark), var(--mark)); background-repeat: no-repeat;
  background-size: 100% 0.78em; background-position: 0 62%; color: var(--mark-text);
  padding: 0 0.08em; -webkit-box-decoration-break: clone; box-decoration-break: clone;
}
.lede { font-size: clamp(17px, 1.6vw, 19px); color: var(--ink-soft); max-width: 62ch; margin: 0 0 28px; line-height: 1.62; }
.cta-row { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
.btn {
  font-family: var(--font-mono); font-size: 13px; letter-spacing: 0.04em; text-transform: uppercase;
  text-decoration: none; display: inline-flex; align-items: center; gap: 9px; padding: 14px 18px;
  border-radius: 0; cursor: pointer; border: 1px solid transparent;
}
.od-land .btn-primary { background: var(--ink); color: var(--bg); }
.od-land .btn-primary .arr { color: var(--mark); }
.od-land .btn-primary:hover { background: var(--mark); color: var(--ink); }
.od-land .btn-primary:hover .arr { color: var(--ink); }
.btn-ghost { background: transparent; color: var(--ink); border-color: var(--ink); }
.btn-ghost:hover { background: var(--mark); border-color: var(--ink); }
.stats {
  list-style: none; padding: 0; margin: 0 0 8px; display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 1px; background: var(--faint); border: 1px solid var(--ink);
}
.stat { background: var(--surface); padding: 18px 20px; display: flex; flex-direction: column; gap: 8px; }
.stat b {
  font-size: clamp(26px, 3vw, 36px); font-weight: 700; letter-spacing: -0.03em; line-height: 1;
  font-variant-numeric: tabular-nums;
}
.stat span {
  font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--muted); line-height: 1.4;
}
.band { padding: 48px 0 28px; border-top: 1px solid var(--faint); }
.sec-label {
  display: flex; align-items: center; gap: 12px; font-family: var(--font-mono); font-size: 12px;
  font-weight: 400; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); margin: 0 0 14px;
}
.sec-label .sq { width: 9px; height: 9px; background: var(--mark); display: inline-block; flex: none; }
.sec-copy { margin: 0 0 22px; max-width: 74ch; color: var(--ink-body); font-size: 16px; line-height: 1.6; }
.sec-copy code { font-family: var(--font-mono); font-size: 0.86em; background: var(--code-bg); padding: 0 0.25em; }
.vgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; padding-bottom: 28px; }
.vendor {
  display: flex; flex-direction: column; gap: 10px; background: var(--surface); color: inherit;
  border: 1px solid var(--ink); border-radius: 0; padding: 20px 20px 16px; text-decoration: none;
  transition: transform .18s ease, box-shadow .18s ease;
}
.vendor:hover { transform: translateY(-3px); box-shadow: var(--shadow-offset); }
.v-top { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 6px 10px; }
.v-name { margin: 0; font-size: 22px; font-weight: 650; letter-spacing: -0.02em; line-height: 1.15; }
.v-lic {
  font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.05em; text-transform: uppercase;
  color: var(--muted); border: 1px solid var(--ink); padding: 2px 7px; white-space: nowrap;
}
.v-blurb { margin: 0; color: var(--ink-body); font-size: 14.5px; line-height: 1.5; flex: 1; }
.pkgs { display: flex; flex-wrap: wrap; gap: 5px; }
.pkgs code {
  font-family: var(--font-mono); font-size: 11px; letter-spacing: 0; background: var(--code-bg);
  border: 1px solid var(--faint); border-radius: 0; padding: 1px 5px;
}
.tags { display: flex; flex-wrap: wrap; gap: 5px; }
.tags span {
  font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.04em; text-transform: uppercase;
  color: var(--ink); border: 1px solid var(--faint); padding: 2px 6px;
}
.tags span.vo { background: var(--mark); border-color: var(--ink); }
.card-metrics {
  display: grid; grid-template-columns: repeat(3, 1fr); margin: 4px 0 0;
  border: 1px solid var(--ink); gap: 1px; background: var(--faint);
}
.card-metrics div { padding: 8px 9px; background: var(--bg); }
.card-metrics dt {
  font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted);
}
.card-metrics dd { margin: 2px 0 0; font-weight: 700; font-variant-numeric: tabular-nums; font-size: 14px; }
.open {
  font-family: var(--font-mono); font-size: 12px; letter-spacing: 0.05em; text-transform: uppercase; color: var(--ink);
  background-image: linear-gradient(var(--mark), var(--mark)); background-repeat: no-repeat;
  background-size: 0% 42%; background-position: 0 88%; transition: background-size .25s ease; align-self: flex-start;
}
.vendor:hover .open { background-size: 100% 42%; }
.table-wrap { overflow-x: auto; border: 1px solid var(--ink); background: var(--surface); margin-bottom: 12px; }
.tbl { border-collapse: collapse; width: 100%; font-size: 14px; line-height: 1.45; font-variant-numeric: tabular-nums; }
.tbl th {
  font-family: var(--font-mono); font-weight: 600; font-size: 10.5px; letter-spacing: 0.07em; text-transform: uppercase;
  color: var(--muted); text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--ink);
  background: var(--bg); white-space: nowrap; vertical-align: bottom;
}
.tbl td { padding: 9px 12px; border-bottom: 1px solid var(--faint); vertical-align: middle; }
.tbl td.n, .tbl th.n { text-align: right; font-family: var(--font-mono); font-size: 12.5px; }
.tbl tbody tr:hover td { background: var(--row-hover); }
.tbl td a {
  color: var(--ink); font-weight: 650; text-decoration: none;
  background-image: linear-gradient(var(--mark), var(--mark)); background-repeat: no-repeat;
  background-size: 0% 42%; background-position: 0 88%; transition: background-size .25s ease;
}
.tbl td a:hover { background-size: 100% 42%; }
.tbl tr.sep th {
  text-transform: none; letter-spacing: 0; font-family: var(--font-sans); font-weight: 400; font-size: 13.5px;
  color: var(--ink-body); background: var(--bg); text-align: left; white-space: normal; line-height: 1.45;
  box-shadow: inset 3px 0 0 var(--mark);
}
.tbl td.bar { width: 16%; min-width: 72px; }
.tbl td.bar i { display: block; height: 9px; width: 0; background: var(--mark); box-shadow: inset 0 0 0 1px var(--ink); }
.note { font-size: 13px; color: var(--muted); margin: 0 0 36px; max-width: 78ch; }
.site-foot { background: var(--ink); color: var(--footer-text); border-top: 1px solid var(--dark-rule); padding: 32px 0 40px; }
.foot-top { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 16px; align-items: center; margin-bottom: 18px; }
.foot-top .c { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; }
.foot-social { display: flex; gap: 10px; }
.foot-social a {
  font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase;
  text-decoration: none; color: var(--on-dark); border: 1px solid var(--dark-border); padding: 6px 10px;
}
.foot-social a:hover { border-color: var(--mark); color: var(--mark); }
.site-foot a:focus-visible { outline-color: var(--mark); }
.disclaimer { font-size: 13px; line-height: 1.6; color: var(--disclaimer); max-width: 78ch; border-top: 1px solid var(--dark-rule); padding-top: 16px; margin: 0; }
.disclaimer strong { color: var(--disclaimer-strong); font-weight: 600; }
.reveal { opacity: 1; }
@media (prefers-reduced-motion: no-preference) {
  .reveal { animation: od-rise .7s cubic-bezier(.2,.7,.2,1); }
  @keyframes od-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
}
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  .vendor, .btn, .open, .tbl td a, .od-wm .ins { transition: none; }
  .vendor:hover { transform: none; }
}
@media (max-width: 800px) {
  .stats { grid-template-columns: 1fr 1fr; }
  .hide-sm, .tbl td.bar, .tbl th.bar { display: none; }
}
@media (max-width: 520px) { .stats { grid-template-columns: 1fr; } .hero h1 { font-size: 34px; } }
</style></head>
<body class="od-land">
<header class="site-nav"><div class="wrap nav-row">
  <a class="od-wm" href="/" aria-label="open-docs"><span class="del">DOC</span><span class="ins">OPEN</span><span class="od-wm-tail">-DOCS</span></a>
  <nav aria-label="Page">
    <a href="#editors">Editors</a>
    <a href="#viewers">Viewers</a>
    <a href="#metrics">Measurements</a>
    <a href="/source" target="_blank" rel="noopener">Source →</a>
  </nav>
</div></header>
<section class="hero reveal"><div class="wrap">
  <p class="eyebrow">Browser bench<span class="sep">·</span>.docx import and export<span class="sep">·</span>MMXXVI</p>
  <h1>Open-source Word editors, measured against <span class="mark">the bytes they load</span>.</h1>
  <p class="lede">Each editor opens on a blank page, imports and exports a real .docx, and has an assistant
  (Val Town's OpenAI integration) that edits the document you have open. Every visit records startup time,
  JS heap and download size. The comparison is that measurement, not the README.</p>
  <div class="cta-row">
    <a class="btn btn-primary" href="/e/${editors[0]?.slug ?? ""}">Open an editor <span class="arr">→</span></a>
    <a class="btn btn-ghost" href="/api/sample.docx">Download a sample .docx</a>
  </div>
</div></section>
<div class="wrap reveal">
  <ul class="stats">
    <li class="stat"><b>${editors.length}</b><span>Open-source editors on this page</span></li>
    <li class="stat"><b>${viewers.length}</b><span>Proprietary viewers, view-only</span></li>
    <li class="stat"><b>3</b><span>Readings per visit: startup, JS heap, loaded</span></li>
    <li class="stat"><b>200</b><span>Measured loads kept per editor</span></li>
  </ul>
</div>
<section class="band" id="editors"><div class="wrap">
  <h2 class="sec-label"><span class="sq" aria-hidden="true"></span> / Editors</h2>
  <p class="sec-copy">Open-source editors that load in the browser. The card shows the license, the packages this demo actually fetches, how the page is drawn, and the median of recent visits.</p>
  <div class="vgrid">${cards}</div>
</div></section>
<section class="band" id="viewers"><div class="wrap">
  <h2 class="sec-label"><span class="sq" aria-hidden="true"></span> / Proprietary viewers</h2>
  <p class="sec-copy">These are not editors. They only display a .docx, so a commercial renderer can sit next to the open-source editors on the same sample. Apryse and Nutrient run without a license key in their vendors' evaluation (demo / trial) mode and watermark the pages. Microsoft's and Google's viewers render on their own servers from a public URL, so they can only show this site's samples, never a file you open.</p>
  <div class="vgrid">${vcards}</div>
</div></section>
<section class="band" id="metrics"><div class="wrap">
  <h2 class="sec-label"><span class="sq" aria-hidden="true"></span> / Measurements</h2>
  <p class="sec-copy">Medians over the most recent visits, measured in visitors' browsers. <b>Startup</b> is navigation start → editor ready. <b>Cold</b> counts only loads where the files came from the network. <b>JS heap</b> is Chromium's <code>performance.memory</code> after the editor settles, counted only for the first editor opened in a tab (later ones share the tab's process and would inherit its heap). <b>Loaded</b> is the decoded size of every script, stylesheet, font and WASM file the page pulled in.</p>
  <div class="table-wrap"><table class="tbl"><thead><tr>
    <th>Editor</th><th class="n">Startup</th><th class="n hide-sm">Cold</th><th class="n hide-sm">Mount</th>
    <th class="n">JS heap</th><th class="n">Loaded</th><th class="n hide-sm">Files</th><th class="n hide-sm">Runs</th><th class="bar">Startup</th>
  </tr></thead>
  <tbody>${rows}</tbody>
  <tbody class="vbody"><tr class="sep"><th colspan="9">Proprietary viewers (view-only). Microsoft and Google render on their servers: only the iframe's load is timed, and their memory and downloads are invisible to this page.</th></tr>${vrows}</tbody></table></div>
  <p class="note" id="mnote">Loading measurements…</p>
</div></section>
<footer class="site-foot"><div class="wrap">
  <div class="foot-top">
    <span class="c">© MMXXVI open-docs · Built on Val Town</span>
    <div class="foot-social">
      <a href="/source" target="_blank" rel="noopener">Source</a>
      <a href="https://val.town">Val Town</a>
    </div>
  </div>
  <p class="disclaimer"><strong>Method.</strong> Each editor keeps its own license. SuperDoc is AGPL-3.0: check that license before you ship it in a closed product. Figures are medians of recent visits in visitors' browsers. A missing cell means that reading was not taken, not that the cost was zero. <strong>Independent.</strong> open-docs is not affiliated with the editors or viewers it runs.</p>
</div></footer>
<script type="module">
const fmtMs = (n) => n == null ? "—" : n < 1000 ? Math.round(n) + " ms" : (n / 1000).toFixed(2) + " s";
const fmtB = (n) => n == null ? "—" : n < 1048576 ? Math.round(n / 1024) + " KB" : (n / 1048576).toFixed(1) + " MB";
const fmt = { startupMs: fmtMs, coldStartupMs: fmtMs, mountMs: fmtMs, heapBytes: fmtB, loadedBytes: fmtB,
  resources: (n) => n == null ? "—" : Math.round(n), samples: (n) => n ?? 0 };
const data = await fetch("/api/metrics").then((r) => r.json()).catch(() => ({}));
// One scale per table body: editors against editors, viewers against viewers.
const maxOf = (body) => Math.max(1, ...[...body.querySelectorAll("tr[data-slug]")].map((r) => data[r.dataset.slug]?.startupMs ?? 0));
const maxes = new Map([...document.querySelectorAll("tbody")].map((b) => [b, maxOf(b)]));
// Each editor has a card AND a table row; count samples once, from the data.
const total = Object.values(data).reduce((n, d) => n + (d.samples ?? 0), 0);
for (const el of document.querySelectorAll("[data-slug]")) {
  const d = data[el.dataset.slug];
  if (!d) continue;
  for (const cell of el.querySelectorAll("[data-k]")) cell.textContent = fmt[cell.dataset.k](d[cell.dataset.k]);
  const bar = el.querySelector("[data-bar]");
  if (bar && d.startupMs) bar.style.width = (100 * d.startupMs / maxes.get(el.closest("tbody"))).toFixed(1) + "%";
}
document.getElementById("mnote").textContent = total
  ? total + " recent measured page loads (up to 200 per editor). Open an editor to add yours. The numbers in its top bar are your own."
  : "No measurements yet. Open an editor and its numbers appear here.";
</script>
</body></html>`;
}
