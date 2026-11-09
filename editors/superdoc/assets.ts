/**
 * SuperDoc, loaded from its own CDN build — verified against superdoc@2.29.0
 * and @superdoc/docx-engine@0.28.0 on jsDelivr.
 *
 *  - `dist-cdn/superdoc.min.js` is a classic script that defines `window.SuperDoc`
 *    and loads its engine with a bare `import("@superdoc/docx-engine")`, which
 *    the page import map resolves (SUPERDOC_ENGINE below).
 *  - The engine starts its workers from blob: bootstraps that import the
 *    jsDelivr assets, so cross-origin is fine. Do NOT set `workerUrls.document`:
 *    the engine reuses that URL for its DOM-edit worker too, which then runs the
 *    wrong entry and never answers `session-attachment` — SuperDoc sits on
 *    "Preparing first pages… 14%" forever.
 */
export const SUPERDOC_VERSION = "2.29.0";
export const ENGINE_VERSION = "0.28.0";

export const SUPERDOC_JS = `https://cdn.jsdelivr.net/npm/superdoc@${SUPERDOC_VERSION}/dist-cdn/superdoc.min.js`;
export const SUPERDOC_CSS = `https://cdn.jsdelivr.net/npm/superdoc@${SUPERDOC_VERSION}/dist-cdn/superdoc.min.css`;

/**
 * superdoc.min.js loads its engine with a BARE `import("@superdoc/docx-engine")`.
 * Without an import map that rejects and SuperDoc sits on "Loading document"
 * forever. The CDN engine build is self-contained.
 */
export const SUPERDOC_ENGINE =
  `https://cdn.jsdelivr.net/npm/@superdoc/docx-engine@${ENGINE_VERSION}/dist-cdn/docx-engine.es.js`;
