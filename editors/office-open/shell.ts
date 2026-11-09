/** Server-side shell for the office-open demo. */
export default {
  slug: "office-open",
  title: "office-open",
  entry: "/editors/office-open/main.ts",
  head: "",
  body: `
    <div style="display:flex;flex-direction:column;height:100%;min-height:0">
    <div style="display:grid;grid-template-columns:1fr 1fr;flex:1;min-height:0">
      <div style="display:flex;flex-direction:column;border-right:1px solid #e5e7eb;background:#0f172a">
        <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;color:#94a3b8;font:11px ui-monospace,monospace;border-bottom:1px solid #1e293b">
          DocumentOptions (JSON) — the source of truth
          <span style="flex:1"></span>
          <span id="oo-dirty" style="color:#fbbf24;display:none">● edited</span>
        </div>
        <textarea id="oo-json" spellcheck="false" style="flex:1;border:0;outline:none;resize:none;background:#0f172a;color:#e2e8f0;font:12.5px/1.6 ui-monospace,monospace;padding:12px;tab-size:2"></textarea>
      </div>
      <div style="display:flex;flex-direction:column;background:#f3f4f6">
        <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;color:#6b7280;font:11px ui-monospace,monospace;border-bottom:1px solid #e5e7eb">
          DOCX preview (rendered from the model)
        </div>
        <div id="oo-preview" style="flex:1;overflow:auto;padding:20px"></div>
      </div>
    </div>
    <div style="flex:none;padding:10px 14px;border-top:1px solid #e5e7eb;background:#fafafa;font-size:12px;color:#6b7280">
      office-open has no editor surface. It is a model: you edit <code>DocumentOptions</code> as JSON
      (or let the agent produce it), then generate real .docx bytes. That is why its JSON-Schemas ship
      shaped for LLM tool calls.
    </div>
    </div>`,
};
