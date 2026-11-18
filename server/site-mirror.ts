// A dated snapshot of an engine's own published site, served from this origin.
//
// For an engine whose browser application is published only as a website (not on npm, not as a
// release archive). Each file is fetched from that site the first time it is asked for and kept
// in blob storage under the snapshot's name, so later visits, and every measurement, get the
// same bytes even after the site changes. A new snapshot is a new name here.
import { blob } from "https://esm.town/v/std/blob/main.ts";

/** site → its address and the snapshot this site serves. */
export const MIRRORS: Record<string, { origin: string; snapshot: string; page?: (file: string, html: string, here: string) => string }> = {
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
const OPENDOC_SOURCE = "https://cdn.jsdelivr.net/gh/CasualOffice/opendoc@5ac261ceadbb0fa0bcbe729ce3c2e20721756949/webapp/";

export const mirrorBase = (site: string) => `/vendor/${site}/${MIRRORS[site].snapshot}/`;

export function mirrorTarget(path: string): { site: string; file: string; upstream: string } | null {
  for (const [site, m] of Object.entries(MIRRORS)) {
    const base = mirrorBase(site);
    if (!path.startsWith(base)) continue;
    const file = path.slice(base.length);
    if (!/^[A-Za-z0-9_][A-Za-z0-9._-]*(\/[A-Za-z0-9_][A-Za-z0-9._-]*)*$/.test(file)) return null;
    return { site, file, upstream: `${m.origin}/${file}` };
  }
  return null;
}

const TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8", js: "text/javascript; charset=utf-8", mjs: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8", json: "application/json; charset=utf-8", wasm: "application/wasm",
  svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", webp: "image/webp", ico: "image/x-icon",
  woff2: "font/woff2", woff: "font/woff", ttf: "font/ttf", otf: "font/otf", txt: "text/plain; charset=utf-8",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export async function serveMirror(path: string, here: string): Promise<Response> {
  const t = mirrorTarget(path);
  if (!t) return new Response("not a mirrored file", { status: 404 });
  const key = `od_mirror_${t.site}_${MIRRORS[t.site].snapshot}_${t.file.replaceAll("/", "__")}`;
  const type = TYPES[t.file.split(".").pop()!.toLowerCase()] ?? "application/octet-stream";
  const headers = { "content-type": type, "cache-control": "public, max-age=31536000, immutable" };
  const stored = await blob.get(key).catch(() => undefined);
  const page = MIRRORS[t.site].page;
  const shaped = (bytes: Uint8Array): Uint8Array<ArrayBuffer> =>
    page && type.startsWith("text/html")
      ? new TextEncoder().encode(page(t.file, new TextDecoder().decode(bytes), here))
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
