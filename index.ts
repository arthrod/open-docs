/**
 * open-docs — a bench of open-source document editors you can run on Val Town.
 *
 * Each editor lives in its own folder under `editors/<slug>/` and gets a route
 * from `server/router.ts`. `/` is the comparison page: every editor with its
 * measured startup time, memory and download size.
 */
import { Hono } from "npm:hono@4";
import { parseVal, serveFile } from "https://esm.town/v/std/utils/index.ts";
import { editors } from "./server/registry.ts";
import { mountShared, registerEditor } from "./server/router.ts";
import { landingPage } from "./server/landing.ts";
import { editorMounts } from "./editors/index.ts";
import { fixtureMarkerFreeDocx, fixtureBriefDocx, fixtureSourcesText } from "./editors/cite-check/fixture.ts";
import { ICONS_VERSION } from "./editors/docen/assets.ts";
import { serveWordcraft, WORDCRAFT_BASE } from "./editors/wordcraft/assets.ts";

const app = new Hono();

// Shared API: sample docx, import, export, agent, metrics.
mountShared(app);

// cite-check fixtures: Val Town files are text-only, so the .docx bytes are
// built server-side (same writer as /api/sample.docx).
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
app.get("/api/cite-check/appellate-brief.docx", (c) =>
  new Response(fixtureBriefDocx(), {
    headers: { "content-type": DOCX_MIME, "cache-control": "public, max-age=300" },
  }));
app.get("/api/cite-check/marker-free.docx", (c) =>
  new Response(fixtureMarkerFreeDocx(), {
    headers: { "content-type": DOCX_MIME, "cache-control": "public, max-age=300" },
  }));
app.get("/api/cite-check/sources.txt", (c) =>
  c.text(fixtureSourcesText));

// Each editor folder registers its own shell + asset route. A folder that
// isn't written yet must not take the whole app down.
for (const slug of editorMounts) {
  try {
    const mod = await import(`./editors/${slug}/shell.ts`);
    registerEditor(app, mod.default);
  } catch (err) {
    console.warn(`[open-docs] editor "${slug}" not mounted:`, (err as Error).message);
  }
}

/**
 * Fluent SVG icons as JS string modules — what Vite's `?raw` would produce.
 * docen's import map points esm.sh's icon modules here (editors/docen/assets.ts).
 */
app.get("/api/svg-raw/:file", async (c) => {
  const file = c.req.param("file");
  if (!/^[a-z0-9_]+\.svg$/.test(file)) return c.text("bad icon name", 400);
  const res = await fetch(`https://cdn.jsdelivr.net/npm/@fluentui/svg-icons@${ICONS_VERSION}/icons/${file}`);
  if (!res.ok) return c.text(`icon ${file}: upstream ${res.status}`, 502);
  return new Response(`export default ${JSON.stringify(await res.text())};\n`, {
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "public, max-age=31536000, immutable",
      "access-control-allow-origin": "*",
    },
  });
});

// WordCraft's wasm build, cached in blob storage (editors/wordcraft/assets.ts).
app.get(`${WORDCRAFT_BASE}*`, (c) => serveWordcraft(c.req.path.slice(WORDCRAFT_BASE.length)));

// Editor client modules and shared lib modules are served straight from the val.
app.get("/editors/*", (c) => serveFile(c.req.path));
app.get("/lib/*", (c) => serveFile(c.req.path));

app.get("/", (c) => c.html(landingPage(editors)));

app.get("/source", () =>
  new Response(null, { status: 302, headers: { Location: parseVal().links.self.val } }));

// Unwrap Hono errors to see original error details.
app.onError((err) => Promise.reject(err));

export default app.fetch;
