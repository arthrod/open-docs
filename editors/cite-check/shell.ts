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
  importMap: {
    "@hufe921/canvas-editor": CE,
    "@hufe921/canvas-editor-plugin-docx": plugin("docx", "1.0.0"),
    "@hufe921/canvas-editor-plugin-markdown": plugin("markdown", "0.0.1"),
    "@hufe921/canvas-editor-plugin-floating-toolbar": plugin("floating-toolbar", "0.0.4"),
    "marked": MARKED,
  },
  head: `<style>
  #cc-host { display: flex; flex-direction: column; height: 100%; min-height: 0; background: #eef1f5; }
  #cc-toolbar { flex: none; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding: 6px 10px;
    background: #fff; border-bottom: 1px solid #e3e6ec; font: 600 13px/1 system-ui, sans-serif; color: #2b3240; }
  #cc-toolbar button { height: 30px; padding: 0 10px; border: 1px solid #d4d8e0; border-radius: 6px; background: #fff;
    font: 600 13px/1 system-ui, sans-serif; color: #2b3240; cursor: pointer; }
  #cc-toolbar button:hover { background: #f3f5f9; }
  #cc-toolbar .sep { width: 1px; height: 20px; background: #e3e6ec; margin: 0 4px; }
  #cc-note { font: 400 12px/1.4 system-ui, sans-serif; color: #6b7280; margin-left: auto; }
  #cc-main { flex: 1; min-height: 0; display: flex; }
  #cc-scroll { flex: 1; min-width: 0; overflow: auto; padding: 24px 0 48px; }
  #cc-page { width: fit-content; margin: 0 auto; }
  #cc-page canvas { box-shadow: 0 1px 3px rgba(16,24,40,.12), 0 8px 24px rgba(16,24,40,.06); }
  #cc-panel { flex: none; width: 400px; max-width: 46vw; overflow-y: auto; padding: 12px 14px 24px;
    background: #fff; border-left: 1px solid #e3e6ec; font: 13px/1.5 system-ui, sans-serif; color: #2b3240; }
  #cc-panel h3 { margin: 14px 0 6px; font: 700 12px/1 system-ui, sans-serif; text-transform: uppercase;
    letter-spacing: .04em; color: #6b7280; }
  #cc-panel textarea, #cc-panel select, #cc-panel input[type=text] { width: 100%; box-sizing: border-box;
    border: 1px solid #d4d8e0; border-radius: 6px; padding: 6px 8px; font: 12px/1.5 ui-monospace, monospace;
    background: #fff; color: #2b3240; }
  #cc-panel .row { display: flex; gap: 6px; margin-top: 6px; }
  #cc-panel .row > * { flex: 1; min-width: 0; }
  #cc-panel button { height: 28px; padding: 0 9px; border: 1px solid #d4d8e0; border-radius: 6px; background: #fff;
    font: 600 12px/1 system-ui, sans-serif; color: #2b3240; cursor: pointer; }
  #cc-panel button:hover { background: #f3f5f9; }
  #cc-panel button.primary { background: #1e3a8a; border-color: #1e3a8a; color: #fff; }
  #cc-panel .hint { font: 400 12px/1.5 system-ui, sans-serif; color: #6b7280; margin: 6px 0; }
  .cc-quote { border: 1px solid #e3e6ec; border-radius: 8px; padding: 8px 10px; margin: 8px 0; }
  .cc-quote .top { display: flex; align-items: center; gap: 8px; }
  .cc-chip { flex: none; font: 700 11px/1 system-ui, sans-serif; padding: 4px 7px; border-radius: 999px; }
  .cc-chip.exact { background: #b6f09c; color: #14532d; }
  .cc-chip.normalized { background: #bfdbfe; color: #1e3a8a; }
  .cc-chip.fuzzy { background: #ffe08a; color: #713f12; }
  .cc-chip.not_found { background: #ffb3b3; color: #7f1d1d; }
  .cc-quote .sim { font: 400 11px/1 ui-monospace, monospace; color: #6b7280; margin-left: auto; }
  .cc-quote .text { font: 12px/1.5 ui-monospace, monospace; color: #374151; margin: 6px 0 2px; }
  .cc-quote .meta { font: 400 11px/1.5 system-ui, sans-serif; color: #6b7280; }
  .cc-quote .meta .warn { color: #92400e; }
  .cc-quote .meta .pin-ok { color: #14532d; }
  .cc-quote .meta .pin-bad { color: #7f1d1d; }
  .cc-quote .acts { display: flex; gap: 6px; margin-top: 6px; }
  .cc-warn { font: 400 12px/1.5 system-ui, sans-serif; color: #92400e; margin: 4px 0; }
  @media (max-width: 900px) { #cc-main { flex-direction: column; } #cc-panel { width: auto; max-width: none; border-left: 0; border-top: 1px solid #e3e6ec; } }
</style>`,
  body: `<div id="cc-host">
    <div id="cc-toolbar" role="toolbar" aria-label="Document">
      <input type="file" id="cc-file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden>
      <button type="button" id="cc-import" title="Import a .docx to check">Import .docx…</button>
      <button type="button" id="cc-fixture" title="Import the bundled reviewed-memo fixture">Load reviewed-memo fixture</button>
      <span class="sep"></span>
      <button type="button" id="cc-undo" title="Undo one annotation (native history)">↶ Undo</button>
      <button type="button" id="cc-redo" title="Redo (native history)">↷ Redo</button>
      <span class="sep"></span>
      <button type="button" id="cc-export" title="Export the annotated document as .docx">Export .docx</button>
      <span id="cc-note">Import itself is not undoable (vendor); every annotation, paste and insert is.</span>
    </div>
    <div id="cc-main">
      <div id="cc-scroll"><div id="cc-page"></div></div>
      <aside id="cc-panel" aria-label="Cite check">
        <section>
          <h3>Sources</h3>
          <textarea id="cc-sources" rows="7" spellcheck="false"
            placeholder="--- Source name | optional alias ---&#10;[p. 12]&#10;page text…&#10;[p. 13]&#10;page text…&#10;--- Next source ---"></textarea>
          <div class="row">
            <button type="button" id="cc-load-sources" title="Load the fixture sources into the box above">Example sources</button>
            <button type="button" id="cc-run" class="primary" title="Run the deterministic cite check on the imported document">Run cite check</button>
          </div>
          <div id="cc-src-info" class="hint">Sources are matched to footnotes by name (aliases included).</div>
        </section>
        <section>
          <h3>Quotes <span id="cc-summary" style="text-transform:none"></span></h3>
          <div id="cc-quotes"><div class="hint">Import a .docx (and paste sources), then run the check.</div></div>
          <div id="cc-warnings"></div>
        </section>
        <section>
          <h3>Manual check</h3>
          <button type="button" id="cc-capture" title="Reads the editor's native range over your selection">Capture selection</button>
          <textarea id="cc-manual" rows="4" spellcheck="false" placeholder="Select a passage on the page and click Capture (or type/paste a quote)…"></textarea>
          <div class="row">
            <select id="cc-manual-source" aria-label="Source"><option value="">Source…</option></select>
            <input id="cc-manual-pin" type="text" placeholder="p. 12" aria-label="Pinpoint">
            <button type="button" id="cc-verify" style="flex:0 0 auto">Verify</button>
          </div>
          <div id="cc-manual-out"></div>
        </section>
      </aside>
    </div>
  </div>`,
};
