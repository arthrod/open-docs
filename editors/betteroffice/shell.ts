/** Server-side shell for BetterOffice's DOCX editor. */
import { vendorBase } from "../../server/npm-vendor.ts";
import { REACT_IMPORTS } from "../../server/router.ts";

export default {
  slug: "betteroffice",
  // Its files must come from the origin of the page showing it (a Worker or a frame it reaches into).
  sameOrigin: true,
  title: "BetterOffice",
  entry: "/editors/betteroffice/main.ts",
  // The packages' files come from this origin (server/npm-vendor.ts): the engine runs in a
  // module Worker started from a URL relative to its own chunk, which a browser refuses across
  // origins. The React package imports the core by 30 subpaths; each is named here, as the
  // core's package.json exports them. Three small UI dependencies come from esm.sh.
  importMap: {
    // The page's one React (18), shared with the Markdown → .docx conversion of an assistant edit.
    ...REACT_IMPORTS,
    "@betteroffice/docx": `${vendorBase("@betteroffice/docx")}dist/core.mjs`,
    "@betteroffice/docx/docx": `${vendorBase("@betteroffice/docx")}dist/docx/index.mjs`,
    "@betteroffice/docx/docx/wrapTypes": `${vendorBase("@betteroffice/docx")}dist/docx/wrapTypes.mjs`,
    "@betteroffice/docx/styles": `${vendorBase("@betteroffice/docx")}dist/styles/index.mjs`,
    "@betteroffice/docx/layout/pagination": `${vendorBase("@betteroffice/docx")}dist/layout/pagination/index.mjs`,
    "@betteroffice/docx/layout/render": `${vendorBase("@betteroffice/docx")}dist/layout/render/index.mjs`,
    "@betteroffice/docx/layout": `${vendorBase("@betteroffice/docx")}dist/layout/index.mjs`,
    "@betteroffice/docx/plugin-api": `${vendorBase("@betteroffice/docx")}dist/plugin-api/index.mjs`,
    "@betteroffice/docx/plugin-api/RenderedDomContext": `${vendorBase("@betteroffice/docx")}dist/plugin-api/RenderedDomContext.mjs`,
    "@betteroffice/docx/plugin-api/resolveItemPositions": `${vendorBase("@betteroffice/docx")}dist/plugin-api/resolveItemPositions.mjs`,
    "@betteroffice/docx/types/document": `${vendorBase("@betteroffice/docx")}dist/types/document.mjs`,
    "@betteroffice/docx/types/content": `${vendorBase("@betteroffice/docx")}dist/types/content.mjs`,
    "@betteroffice/docx/utils": `${vendorBase("@betteroffice/docx")}dist/utils/index.mjs`,
    "@betteroffice/docx/utils/cardStyles": `${vendorBase("@betteroffice/docx")}dist/utils/cardStyles.mjs`,
    "@betteroffice/docx/utils/comments": `${vendorBase("@betteroffice/docx")}dist/utils/comments.mjs`,
    "@betteroffice/docx/utils/stylePreview": `${vendorBase("@betteroffice/docx")}dist/utils/stylePreview.mjs`,
    "@betteroffice/docx/utils/findReplace": `${vendorBase("@betteroffice/docx")}dist/utils/findReplace.mjs`,
    "@betteroffice/docx/utils/findVerticalScrollParent": `${vendorBase("@betteroffice/docx")}dist/utils/findVerticalScrollParent.mjs`,
    "@betteroffice/docx/utils/fontOptions": `${vendorBase("@betteroffice/docx")}dist/utils/fontOptions.mjs`,
    "@betteroffice/docx/utils/listState": `${vendorBase("@betteroffice/docx")}dist/utils/listState.mjs`,
    "@betteroffice/docx/utils/reportIssue": `${vendorBase("@betteroffice/docx")}dist/utils/reportIssue.mjs`,
    "@betteroffice/docx/utils/sidebarConstants": `${vendorBase("@betteroffice/docx")}dist/utils/sidebarConstants.mjs`,
    "@betteroffice/docx/utils/units": `${vendorBase("@betteroffice/docx")}dist/utils/units.mjs`,
    "@betteroffice/docx/utils/autoScroll": `${vendorBase("@betteroffice/docx")}dist/utils/autoScroll.mjs`,
    "@betteroffice/docx/yrs": `${vendorBase("@betteroffice/docx")}dist/yrs/index.mjs`,
    "@betteroffice/docx/collaboration": `${vendorBase("@betteroffice/docx")}dist/collaboration/index.mjs`,
    "@betteroffice/docx/editor": `${vendorBase("@betteroffice/docx")}dist/editor/index.mjs`,
    "@betteroffice/docx/worker": `${vendorBase("@betteroffice/docx")}dist/worker.mjs`,
    "@betteroffice/docx-react": `${vendorBase("@betteroffice/docx-react")}dist/index.mjs`,
    "@betteroffice/docx-i18n": `${vendorBase("@betteroffice/docx-i18n")}dist/index.mjs`,
    "@betteroffice/fonts": `${vendorBase("@betteroffice/fonts")}dist/index.js`,
    "@radix-ui/react-select": "https://esm.sh/@radix-ui/react-select@2.2.6?external=react,react-dom",
    "clsx": "https://esm.sh/clsx@2.1.1",
    "sonner": "https://esm.sh/sonner@2.0.7?external=react,react-dom",
  },
  head: `<link rel="stylesheet" href="${vendorBase("@betteroffice/docx-react")}dist/styles.css" />`,
  body: `<div id="bo-root" style="height:100%;min-height:0;display:flex;flex-direction:column"></div>`,
};
