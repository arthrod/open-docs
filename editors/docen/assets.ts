/**
 * docen's CDN wiring.
 *
 * Two esm.sh artefacts break the editor, and both are fixed in the page import
 * map rather than by forking the package:
 *
 *  1. Icons. docen imports Fluent icons as Vite raw strings
 *     (`@fluentui/svg-icons/icons/x.svg?raw`). esm.sh does not implement `?raw`;
 *     the bundled build inlines a data: URL, so every ribbon button showed the
 *     literal text "data:image/svg+xml,". The unbundled build emits one module
 *     per icon under ICONS_PREFIX; the import map sends that prefix to
 *     ICON_ROUTE, which serves `export default "<svg…>"` (see index.ts).
 *  2. zlib. @office-open/core reaches `node:zlib`, which esm.sh polyfills with
 *     unenv stubs that THROW ("zlib.crc32 is not implemented yet") on save.
 *     Mapping it to an empty module lets the library fall back to its own
 *     pure-JS zip code. Its unbundled build imports the URL ZLIB_STUB_URL, so
 *     the import map can swap that one module.
 *
 * fast-element is pinned to the version docen declares so the graph holds one
 * copy of it (two copies break custom-element registration).
 */
export const ZLIB_STUB_URL = "https://esm.sh/node/zlib.mjs";
export const EMPTY_MODULE = "data:text/javascript,export%20default%20%7B%7D%3B";

export const DOCEN = "https://esm.sh/@docen/editor@0.7.0?target=es2022&deps=@microsoft/fast-element@3.0.2";

export const ICONS_VERSION = "1.1.334";
export const ICONS_PREFIX = `https://esm.sh/@fluentui/svg-icons@${ICONS_VERSION}/es2022/icons/`;
export const ICON_ROUTE = "/api/svg-raw/";

export const DOCEN_IMPORT_MAP: Record<string, string> = {
  [ICONS_PREFIX]: ICON_ROUTE,
  [ZLIB_STUB_URL]: EMPTY_MODULE,
};
