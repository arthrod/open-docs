/** Server-side shell for the SuperDoc demo. */
import { SUPERDOC_CSS, SUPERDOC_ENGINE, SUPERDOC_JS } from "./assets.ts";

export default {
  slug: "superdoc",
  title: "SuperDoc",
  entry: "/editors/superdoc/main.ts",
  importMap: { "@superdoc/docx-engine": SUPERDOC_ENGINE },
  head: `<link rel="stylesheet" href="${SUPERDOC_CSS}" />
<script src="${SUPERDOC_JS}" defer></script>
<style>
  #sd-toolbar { flex: none !important; border-bottom: 1px solid #e3e6ec; background: #fff; min-height: 44px; }
  #sd-scroll { overflow: auto; background: #eef1f5; }
  #sd-editor { min-height: 100%; display: flex; justify-content: center; padding: 18px 0 40px; }
</style>`,
  body: `
    <div id="sd-host" style="display:flex;flex-direction:column;height:100%;min-height:0">
      <div id="sd-toolbar"></div>
      <div id="sd-scroll" style="flex:1;min-height:0"><div id="sd-editor"></div></div>
    </div>`,
};
