/**
 * open-docs — a bench of open-source document editors you can run on Val Town.
 *
 * Each editor lives in its own folder under `editors/<slug>/` and gets a route
 * from `server/router.ts`. The landing page is intentionally the last thing we
 * build; for now `/` lists whatever is registered.
 */
import { Hono } from "npm:hono";
import { parseVal, serveFile } from "https://esm.town/v/std/utils/index.ts";
import { editors } from "./server/registry.ts";
import { mountShared, registerEditor } from "./server/router.ts";
import { editorMounts } from "./editors/index.ts";

const app = new Hono();

// Shared API: sample docx, import, export, agent.
mountShared(app);

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

// Editor client modules and shared lib modules are served straight from the val.
app.get("/editors/*", (c) => serveFile(c.req.path));
app.get("/lib/*", (c) => serveFile(c.req.path));

// TODO(landing): replace with the real comparison page once every editor works.
app.get("/", (c) =>
  c.html(`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>open-docs</title>
<style>body{font:14px/1.6 ui-sans-serif,system-ui;margin:40px auto;max-width:640px;color:#1f2430}
a{color:#1f2937}li{margin:6px 0}code{font-size:12px;color:#6b7280}</style></head>
<body>
<h1>open-docs</h1>
<p>Open-source document editors, each running entirely in the browser on Val Town, each with .docx import/export and an editing agent.</p>
<ul>
${editors.map((e) =>
  `<li><a href="/e/${e.slug}">${e.name}</a> <code>${e.packages.join(", ")}</code></li>`
).join("\n")}
</ul>
</body></html>`));

app.get("/source", (c) => c.redirect(parseVal().links.self.val));

app.onError((err) => Promise.reject(err));

export default app.fetch;
