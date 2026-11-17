/**
 * Server-side shell for the cite-check page: canvas-editor mounted from esm.sh
 * (same pinned build as editors/canvas-editor) plus the deterministic cite-check
 * core vendored at editors/cite-check/core/core.js and served by this route.
 *
 * The layout is deliberately two-column: the document on the left, the
 * check panel (sources, quote verdicts, manual check) on the right.
 */
const CE = "https://esm.sh/@hufe921/canvas-editor@1.1.0?bundle&target=es2022";
const MARKED = "https://esm.sh/marked@18.1.3?target=es2022";
const plugin = (name: string, v: string) =>
  `https://esm.sh/@hufe921/canvas-editor-plugin-${name}@${v}?bundle&external=@hufe921/canvas-editor&target=es2022`;

export default {
  slug: "cite-check",
  title: "cite-check",
  entry: "/editors/cite-check/main.ts",
  // The owner does not want the AI assistant on this page: no aside, no toggle.
  noAgent: true,
  importMap: {
    "@hufe921/canvas-editor": CE,
    "@hufe921/canvas-editor-plugin-docx": plugin("docx", "1.0.0"),
    "@hufe921/canvas-editor-plugin-markdown": plugin("markdown", "0.0.1"),
    "@hufe921/canvas-editor-plugin-floating-toolbar": plugin("floating-toolbar", "0.0.4"),
    "marked": MARKED,
  },
  head: `<style>
  /* cite-check page - open-legal-artifacts token family (bg #fafaf8, ink #0a0a0a,
     secondary #6b6b6b, accent structural only, hairlines #e8e8e5, radius 0) */
  #cc-host { display: flex; flex-direction: column; height: 100%; min-height: 0; background: #f0f0ee; }
  #cc-toolbar { flex: none; display: flex; align-items: center; gap: 2px; flex-wrap: wrap; padding: 0 16px 0 8px;
    background: #fafaf8; border-bottom: 1px solid #e8e8e5; min-height: 40px; }
  #cc-toolbar button { appearance: none; background: none; border: none; border-radius: 0; cursor: pointer;
    padding: 6px 10px; font: 500 11px/1 ui-monospace, "JetBrains Mono", monospace; letter-spacing: .08em;
    text-transform: uppercase; color: #6b6b6b; }
  #cc-toolbar button:hover { color: #0a0a0a; }
  #cc-toolbar button#cc-fixture { background: #0a0a0a; color: #fafaf8; }
  #cc-toolbar button#cc-fixture:hover { background: #000; }
  #cc-toolbar .sep { width: 1px; height: 16px; background: #e8e8e5; margin: 0 8px; }
  #cc-note { margin-left: auto; font: 400 11px/1.4 ui-monospace, monospace; color: #6b6b6b; letter-spacing: .02em; }
  #cc-main { flex: 1; min-height: 0; display: flex; }
  #cc-scroll { flex: 1; min-width: 0; overflow: auto; padding: 28px 0 56px; }
  #cc-page { width: fit-content; margin: 0 auto; }
  #cc-page canvas { box-shadow: 0 1px 2px rgba(16,24,40,.10), 0 10px 32px rgba(16,24,40,.07); background: #fff; }
  #cc-panel { flex: none; width: 400px; max-width: 46vw; overflow-y: auto; padding: 0 0 40px;
    background: #fafaf8; border-left: 1px solid #e8e8e5; font: 13px/1.55 system-ui, sans-serif; color: #0a0a0a; }
  #cc-panel section { padding: 14px 18px 4px; border-top: 1px solid #e8e8e5; }
  #cc-panel section:first-child { border-top: none; }
  #cc-panel h3 { margin: 0 0 8px; font: 500 11px/1 ui-monospace, "JetBrains Mono", monospace;
    text-transform: uppercase; letter-spacing: .12em; color: #6b6b6b; }
  #cc-panel h3 span { color: #0a0a0a; }
  #cc-panel .hint { font: 400 12px/1.5 system-ui, sans-serif; color: #6b6b6b; margin: 6px 0 2px; }
  #cc-panel textarea, #cc-panel select, #cc-panel input[type=text] { width: 100%; box-sizing: border-box;
    border: 1px solid #0a0a0a; border-radius: 0; padding: 7px 9px; font: 12px/1.5 ui-monospace, monospace;
    background: #fff; color: #0a0a0a; }
  #cc-panel textarea:focus, #cc-panel select:focus, #cc-panel input:focus { outline: 2px solid #0a0a0a; outline-offset: -1px; }
  #cc-panel .row { display: flex; gap: 8px; margin-top: 8px; align-items: center; }
  #cc-panel .row > * { flex: 1; min-width: 0; }
  #cc-panel button { appearance: none; border-radius: 0; cursor: pointer; height: 28px; padding: 0 10px;
    border: 1px solid #0a0a0a; background: #fff; color: #0a0a0a;
    font: 500 11px/1 ui-monospace, "JetBrains Mono", monospace; letter-spacing: .08em; text-transform: uppercase; }
  #cc-panel button:hover { background: #f0f0ee; }
  #cc-panel button.primary { background: #0a0a0a; color: #fafaf8; border-color: #0a0a0a; }
  #cc-panel button.primary:hover { background: #000; }
  #cc-panel button.quiet { border: none; background: none; color: #6b6b6b; padding: 0 2px; height: auto; }
  #cc-panel button.quiet:hover { color: #0a0a0a; text-decoration: underline; text-underline-offset: 3px; }
  #cc-add-source { width: 100%; border: 1px dashed #0a0a0a; background: none; height: 40px; margin: 2px 0 4px; }
  #cc-add-source:hover { background: #fff; }
  #cc-source-list { margin: 4px 0 2px; }
  #cc-source-list .cc-src { display: flex; align-items: baseline; gap: 10px; padding: 7px 0;
    border-bottom: 1px solid #e8e8e5; }
  #cc-source-list .cc-src:last-child { border-bottom: none; }
  #cc-source-list .cc-src .nm { font: 500 13px/1.3 system-ui, sans-serif; color: #0a0a0a; }
  #cc-source-list .cc-src .meta { font: 400 11px/1.3 ui-monospace, monospace; color: #6b6b6b; margin-left: auto; white-space: nowrap; }
  #cc-source-list .cc-src button.quiet { flex: none; }
  .cc-chip { font: 500 11px/1 ui-monospace, monospace; text-transform: uppercase; letter-spacing: .06em;
    padding: 2px 7px; border: 1px solid #0a0a0a; white-space: nowrap; border-radius: 0; }
  .cc-chip.exact { background: #0a0a0a; color: #fafaf8; }
  .cc-chip.normalized { color: #0a0a0a; border-color: #0a0a0a; }
  .cc-chip.fuzzy { color: #8a6d00; border-color: #8a6d00; }
  .cc-chip.not_found { color: #b3261e; border-color: #b3261e; border-style: dashed; font-weight: 700; }
  .cc-quote { padding: 10px 0; border-bottom: 1px solid #e8e8e5; }
  .cc-quote:last-child { border-bottom: none; }
  .cc-quote .head { display: flex; align-items: center; gap: 8px; }
  .cc-quote .id { font: 500 11px/1 ui-monospace, monospace; color: #6b6b6b; }
  .cc-quote .sim { font: 400 11px/1 ui-monospace, monospace; color: #6b6b6b; margin-left: auto; }
  .cc-quote .text { font: 12px/1.55 ui-monospace, monospace; color: #0a0a0a; margin: 6px 0 2px; }
  .cc-quote .meta { font: 400 11px/1.5 system-ui, sans-serif; color: #6b6b6b; }
  .cc-quote .meta .warn { color: #8a6d00; }
  .cc-quote .meta .pin-ok { color: #1b6b2f; }
  .cc-quote .meta .pin-bad { color: #b3261e; }
  .cc-quote .acts { display: flex; gap: 6px; margin-top: 6px; }
  .cc-quote .acts button { height: 24px; padding: 0 8px; }
  .cc-warn { font: 400 12px/1.5 system-ui, sans-serif; color: #8a6d00; margin: 4px 0; }
  #cc-panel details summary { cursor: pointer; list-style: none; }
  #cc-panel details summary::-webkit-details-marker { display: none; }
  #cc-panel details summary h3 { display: inline; }
  #cc-panel details[open] summary { margin-bottom: 8px; }
  #cc-manual-out { font: 12px/1.55 ui-monospace, monospace; color: #0a0a0a; margin-top: 8px; }
  @media (max-width: 900px) {
    #cc-main { flex-direction: column; }
    /* Bounded heights with independent scrolling: the panel must not be able
       to consume the whole column and shrink the document area to zero. */
    #cc-scroll { flex: 1 1 55%; min-height: 0; }
    #cc-panel { flex: 0 0 auto; width: auto; max-width: none; max-height: 45%; border-left: 0; border-top: 1px solid #e8e8e5; }
  }
</style>`,

  body: `<div id="cc-host">
    <div id="cc-toolbar" role="toolbar" aria-label="Document">
      <input type="file" id="cc-file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden>
      <button type="button" id="cc-fixture" title="Inject the demo document (formatted appellate brief)">Load the demo brief</button>
      <button type="button" id="cc-import" title="Import a .docx to check">Import .docx…</button>
      <span class="sep"></span>
      <button type="button" id="cc-undo" title="Undo one annotation (native history)">↶ Undo</button>
      <button type="button" id="cc-redo" title="Redo (native history)">↷ Redo</button>
      <span class="sep"></span>
      <button type="button" id="cc-export" title="Export the annotated document as .docx">Export .docx</button>
      <span id="cc-note">Import is not undoable (vendor); annotations, paste and inserts are.</span>
    </div>
    <div id="cc-main">
      <div id="cc-scroll"><div id="cc-page"></div></div>
      <aside id="cc-panel" aria-label="Cite check">
        <section>
          <h3>Sources</h3>
          <input type="file" id="cc-source-file" accept=".docx,.txt,.md" multiple hidden aria-label="Source files">
          <button type="button" id="cc-add-source" title="Import source files (.docx via the editor engine; .txt/.md as text)">+ Import source files — .docx · .txt · .md</button>
          <div id="cc-source-list"></div>
          <div class="row">
            <button type="button" id="cc-demo-sources" class="quiet" title="Add or remove the complete demo source set">Add full demo sources</button>
          </div>
          <div id="cc-src-info" class="hint">Sources are matched to the brief's footnotes by name.</div>
        </section>
        <section>
          <h3>Quotes <span id="cc-summary" style="text-transform:none; letter-spacing:.02em"></span></h3>
          <div id="cc-quotes"><div class="hint">Load the brief and its sources, then run the check.</div></div>
          <div id="cc-warnings"></div>
          <div class="row">
            <button type="button" id="cc-run" class="primary" title="Run the deterministic cite check on the imported document">Run cite check</button>
          </div>
        </section>
        <section>
          <details>
            <summary><h3>Manual check</h3></summary>
            <button type="button" id="cc-capture" title="Reads the editor's native range over your selection">Capture selection</button>
            <textarea id="cc-manual" rows="3" spellcheck="false" aria-label="Manual check quote" placeholder="Select a passage in the brief and click Capture (or type/paste a quote)…" style="margin-top:8px"></textarea>
            <div class="row">
              <select id="cc-manual-source" aria-label="Source"><option value="">Source…</option></select>
              <input id="cc-manual-pin" type="text" placeholder="p. 12" aria-label="Pinpoint">
              <button type="button" id="cc-verify" style="flex:0 0 auto">Verify</button>
            </div>
            <div id="cc-manual-out"></div>
          </details>
        </section>
      </aside>
    </div>
  </div>`,

};
