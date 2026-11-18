/** Server-side shell for react-docx (Extend). */
import { vendorBase } from "../../server/npm-vendor.ts";

const BASE = vendorBase("@extend-ai/react-docx");

export default {
  slug: "react-docx",
  // Its files must come from the origin of the page showing it (a Worker or a frame it reaches into).
  sameOrigin: true,
  title: "react-docx",
  entry: "/editors/react-docx/main.ts",
  // The package's files come from this origin (server/npm-vendor.ts): its import worker is
  // started with `new Worker(new URL(…, import.meta.url))`, which a browser refuses across
  // origins. Its two bare imports are resolved here.
  importMap: {
    "@extend-ai/react-docx/vanilla": `${BASE}dist/vanilla.js`,
    "@extend-ai/react-docx/internal": `${BASE}dist/internal.js`,
    "fast-png": "https://esm.sh/fast-png@8.0.0?target=es2022",
  },
  body: `<div id="rd-root" style="height:100%;min-height:0;overflow:auto;background:#eef1f5"></div>`,
};
