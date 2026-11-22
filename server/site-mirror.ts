// A dated snapshot of an engine's own published site, served from this origin.
//
// For an engine whose browser application is published only as a website (not on npm, not as a
// release archive). Each file is fetched from that site the first time it is asked for and kept
// in blob storage under the snapshot's name, so later visits, and every measurement, get the
// same bytes even after the site changes. A new snapshot is a new name here.
import { blob } from "https://esm.town/v/std/blob/main.ts";

/** site → its address and the snapshot this site serves. */
export const MIRRORS: Record<string, { origin: string; snapshot: string; page?: (file: string, html: string, here: string) => string; script?: (file: string, js: string) => string }> = {
  // OpenDoc's editor application (Apache-2.0): https://github.com/CasualOffice/opendoc
  // Its page loads about 350 separate modules, more requests than this host allows one visitor
  // at once. So only the page itself and the built engine (pkg/, which is not in the repository)
  // come from here; the page's other files come from jsDelivr's copy of the repository at the
  // commit the page was built from, and an import map sends pkg/ back to this origin.
  opendoc: {
    origin: "https://opendoc.casualoffice.org",
    snapshot: "2026-11-05",
    page: (file, html, here) =>
      file !== "editor.html" ? html : html
        // First in <head>: the page's own import map and links resolve against it.
        .replace(/<head[^>]*>/i, (head) => `${head}<base href="${OPENDOC_SOURCE}">`)
        // The page has one import map; the engine's address is added to it, absolute, since a
        // relative one would resolve against the base above.
        // Every address of the built engine (import-map values, preload links, data attributes)
        // points at this origin; import-map keys stay, they name what the modules ask for.
        .replace(/"\.\/pkg\/([^"]*)"(?!\s*:)/g, (_m, rest) => JSON.stringify(`${here}/vendor/opendoc/2026-11-05/pkg/${rest}`)),
  },
};

/**
 * The editors trial's own demo builds (arthrod/editors_trial, demos/<name>), as published with
 * its bundle at benchmarks.law/demo-apps/<name>/. Each is the project's own code built from the
 * commit the trial measured, with a small host page that opens ./document.docx and offers a
 * Download button. Here the host page is told to ask the page framing it for the document:
 * a line added to its <head> answers its request for document.docx from `parent.__odDemoDoc`.
 */
export const TRIAL_DEMOS = ["genoffice", "office-open", "fidus-writer", "docs-plus"] as const;
const DEMO_SNAPSHOT = "et-v0.11.1";
const DEMO_HOOK = `<script>(()=>{const real=window.fetch;const mine=(u)=>{try{return String(u&&u.url||u).split(/[?#]/)[0].endsWith("document.docx")&&parent!==window&&typeof parent.__odDemoDoc==="function"}catch{return false}};window.fetch=function(u,o){return mine(u)?Promise.resolve(parent.__odDemoDoc()).then((b)=>new Response(b,{headers:{"content-type":"application/vnd.openxmlformats-officedocument.wordprocessingml.document"}})):real.call(this,u,o)}})()</script>`;
/**
 * docs.plus hands each imported picture to an uploader and puts the address it gets back in the
 * document. The demo build's stand-in knows only the pictures of the trial's own test file and
 * throws for any other, which loses the picture. Here that one statement is replaced: a picture
 * it does not know is handed back as an address of its own bytes, held by the page.
 */
const DOCS_PLUS_UPLOAD = /let (\w+)=(\w+\[\w+\((\w+)\((\w+)\)\)\]);if\(!\1\)throw Error\(`Image \(\$\{(\w+)\}\) is not part of the bundled media set`\);/;
export const docsPlusKeepPictures = (js: string): string =>
  js.replace(DOCS_PLUS_UPLOAD, (_m, n, lookup, bytes, data, type) =>
    `let ${n}=${lookup};if(!${n})return URL.createObjectURL(new Blob([${bytes}(${data})],{type:${type}||"image/png"}));`);
for (const name of TRIAL_DEMOS) {
  MIRRORS[name] = {
    origin: `https://benchmarks.law/demo-apps/${name}`,
    snapshot: DEMO_SNAPSHOT,
    page: (file, html) =>
      file !== "index.html" ? html : html.replace(/<head[^>]*>/i, (head) => `${head}${DEMO_HOOK}`)
        // The rewritten script gets an address of its own: the first one is kept by browsers and
        // by this platform's edge for a year.
        .replace(/(src="\.\/assets\/[^"?]+\.js)"/, (m, src) => name === "docs-plus" ? `${src}?pictures=1"` : m),
    ...(name === "docs-plus" ? { script: (_file: string, js: string) => docsPlusKeepPictures(js) } : {}),
  };
}
const OPENDOC_SOURCE = "https://cdn.jsdelivr.net/gh/CasualOffice/opendoc@5ac261ceadbb0fa0bcbe729ce3c2e20721756949/webapp/";

export const mirrorBase = (site: string) => `/vendor/${site}/${MIRRORS[site].snapshot}/`;

export function mirrorTarget(path: string): { site: string; file: string; upstream: string } | null {
  for (const [site, m] of Object.entries(MIRRORS)) {
    const base = mirrorBase(site);
    if (!path.startsWith(base)) continue;
    const file = path.slice(base.length);
    if (!/^[A-Za-z0-9_][A-Za-z0-9._-]*(\/[A-Za-z0-9_][A-Za-z0-9._-]*)*$/.test(file)) return null;
    // The storage key writes "/" as "__", so a name with "__" could be handed another file's bytes.
    if (file.includes("__")) return null;
    return { site, file, upstream: `${m.origin}/${file}` };
  }
  return null;
}

const TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8", js: "text/javascript; charset=utf-8", mjs: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8", json: "application/json; charset=utf-8", wasm: "application/wasm",
  svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", webp: "image/webp", ico: "image/x-icon",
  gz: "application/gzip", map: "application/json; charset=utf-8",
  woff2: "font/woff2", woff: "font/woff", ttf: "font/ttf", otf: "font/otf", txt: "text/plain; charset=utf-8",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/** The sites allowed to show a mirrored page under their own origin (they pass engine files through). */
const SISTER = /^https:\/\/viewers\.benchmarks\.law(\/[a-z0-9]{1,16})?$/;

/**
 * The address a mirrored page is shown under: this origin, or the sister site (with the one
 * path segment it passes these files under) that says it is passing the page through. Any other claimed origin is ignored, so a request cannot make the
 * page load its engine from an address of the requester's choosing.
 */
// The claim travels in the query (`od-at`), not a header: the edge keys its cache on the URL and
// ignores Vary, so a header would let one site be handed the other's page.
export const pageOrigin = (own: string, claimed: string | undefined) =>
  claimed && SISTER.test(claimed) ? claimed : own;

export async function serveMirror(path: string, here: string): Promise<Response> {
  const t = mirrorTarget(path);
  if (!t) return new Response("not a mirrored file", { status: 404 });
  const key = `od_mirror_${t.site}_${MIRRORS[t.site].snapshot}_${t.file.replaceAll("/", "__")}`;
  const type = TYPES[t.file.split(".").pop()!.toLowerCase()] ?? "application/octet-stream";
  // A page is rewritten here, so it is kept only briefly: this platform's edge kept an early,
  // unrewritten copy for a year under "immutable" (2026-11-18). Other files never change.
  const headers = {
    "content-type": type,
    "cache-control": type.startsWith("text/html") ? "public, max-age=300" : "public, max-age=31536000, immutable",
  };
  const stored = await blob.get(key).catch(() => undefined);
  const page = MIRRORS[t.site].page;
  const script = MIRRORS[t.site].script;
  const shaped = (bytes: Uint8Array): Uint8Array<ArrayBuffer> =>
    page && type.startsWith("text/html")
      ? new TextEncoder().encode(page(t.file, new TextDecoder().decode(bytes), here))
      : script && type.startsWith("text/javascript")
      ? new TextEncoder().encode(script(t.file, new TextDecoder().decode(bytes)))
      : new Uint8Array(bytes);
  if (stored?.ok) {
    return new Response(page ? shaped(new Uint8Array(await stored.arrayBuffer())) : stored.body, { headers });
  }
  const res = await fetch(t.upstream);
  if (!res.ok) return new Response(`upstream ${res.status}`, { status: res.status === 404 ? 404 : 502 });
  const bytes = new Uint8Array(await res.arrayBuffer());
  await blob.set(key, bytes).catch((err) => console.warn("[open-docs] mirror store", t.file, err));
  return new Response(shaped(bytes), { headers });
}
