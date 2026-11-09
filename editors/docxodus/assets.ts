/**
 * Where Docxodus actually has to be loaded from — verified, not assumed.
 *
 * Three constraints pin this down:
 *
 *  1. The .NET runtime lives in `dist/wasm/_framework/*` and the bundle finds it
 *     through `import.meta.url`, so the JS must be served from the same tree as
 *     the WASM. **esm.sh repackages the JS but not the payload** —
 *     `…/es2022/wasm/_framework/dotnet.js` is a 404 — so esm.sh is unusable.
 *  2. The unbundled `dist/embed.js` and `dist/core.js` are *not* browser-ready:
 *     `embed.js` re-exports from the bare specifier `docxodus/embed`, which only
 *     a bundler can resolve.
 *  3. `dist/embed.bundle.js` is self-contained (559 KB, no bare specifiers) and
 *     already includes the engine API — `initialize`, `openDocxSession` and
 *     `DocxEditor` all come from that one module.
 *
 * So: one import, from jsDelivr's npm tree.
 */
export const DOCXODUS_VERSION = "15.1.0";

export const DOCXODUS_BASE =
  `https://cdn.jsdelivr.net/npm/docxodus@${DOCXODUS_VERSION}/dist`;

/** Self-contained ESM bundle: engine API + editor + wasm base resolution. */
export const BUNDLE_URL = `${DOCXODUS_BASE}/embed.bundle.js`;

/** The .NET runtime directory, next to the bundle. MUST end in "/": the loader
 *  concatenates `${base}_framework/dotnet.js`. */
export const WASM_BASE = `${DOCXODUS_BASE}/wasm/`;
