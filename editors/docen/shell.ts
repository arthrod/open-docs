/** Server-side shell for the docen demo. */
import { DOCEN_IMPORT_MAP } from "./assets.ts";

export default {
  slug: "docen",
  title: "docen",
  entry: "/editors/docen/main.ts",
  importMap: DOCEN_IMPORT_MAP,
  head: "",
  body: `<docen-document id="docen" user="open-docs" filename="Untitled document"
      style="display:block;height:100%;min-height:0;background:#fff"></docen-document>`,
};
