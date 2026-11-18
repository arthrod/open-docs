// Files of a pinned npm package, served from this site's own origin.
//
// Some engines start a Web Worker with `new Worker(new URL("./x.js", import.meta.url))`.
// A browser refuses a worker script from another origin, so such a package cannot be loaded
// from a CDN directly. This route passes jsDelivr's copy of exactly the versions listed here.

/** package → the one version this site serves. */
export const VENDORED: Record<string, string> = {
  "@extend-ai/react-docx": "0.15.0",
  "@betteroffice/docx": "0.5.1",
  "@betteroffice/docx-react": "0.5.1",
  "@betteroffice/docx-i18n": "0.5.1",
  "@betteroffice/fonts": "0.4.2",
};

const PREFIX = "/vendor/npm/";

/** The jsDelivr address behind a /vendor/npm/ path, or null when the path is not one we serve. */
export function vendorUpstream(path: string): string | null {
  if (!path.startsWith(PREFIX)) return null;
  const rest = path.slice(PREFIX.length);
  for (const [name, version] of Object.entries(VENDORED)) {
    const head = `${name}@${version}/`;
    if (!rest.startsWith(head)) continue;
    const file = rest.slice(head.length);
    // Plain file paths only: no empty path, no dot segments, no encoded characters.
    if (!/^[A-Za-z0-9_][A-Za-z0-9._-]*(\/[A-Za-z0-9_][A-Za-z0-9._-]*)*$/.test(file)) return null;
    return `https://cdn.jsdelivr.net/npm/${head}${file}`;
  }
  return null;
}

export const vendorBase = (name: string) => `${PREFIX}${name}@${VENDORED[name]}/`;

export async function serveVendored(path: string): Promise<Response> {
  const upstream = vendorUpstream(path);
  if (!upstream) return new Response("not a vendored file", { status: 404 });
  const res = await fetch(upstream);
  if (!res.ok) return new Response(`upstream ${res.status}`, { status: res.status === 404 ? 404 : 502 });
  return new Response(res.body, {
    headers: {
      "content-type": res.headers.get("content-type") ?? "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
