import { assertEquals } from "jsr:@std/assert@1.0.13";
import { Hono } from "npm:hono@4";
import type { EditorShell } from "./router.ts";

// server/router.ts imports esm.town's serveFile, whose module eagerly builds a
// ValTown client — it needs a non-empty key even though the tests never call it.
Deno.env.set("VAL_TOWN_API_KEY", Deno.env.get("VAL_TOWN_API_KEY") ?? "test-only");
const { registerEditor } = await import("./router.ts");

/** A minimal editor shell on a real registry slug ("plate" is an editor). */
const plate: EditorShell = {
  slug: "plate",
  entry: "/e/plate/main.tsx",
  body: "<div id=\"app\"></div>",
  title: "Plate",
};

async function get(path: string): Promise<string> {
  const app = new Hono();
  registerEditor(app, plate);
  const res = await app.request(path);
  return await res.text();
}

Deno.test("shell without ?embed=1 is the full chrome: assistant, sub-bar, switcher", async () => {
  const html = await get("/e/plate");
  assertEquals(html.includes(`id="od-aside"`), true);
  assertEquals(html.includes(`id="od-toggle-agent"`), true);
  assertEquals(html.includes(`id="od-switch"`), true);
  assertEquals(html.includes(`id="od-more"`), true);
  assertEquals(html.includes(`id="od-docname"`), false);
  assertEquals(html.includes(`id="od-rename"`), true);
  assertEquals(html.includes(`id="od-rename-dialog"`), true);
  const bar = html.slice(html.indexOf(`<header class="site-nav od-bar">`), html.indexOf(`</header>`));
  const spacerAt = bar.indexOf(`class="od-spacer"`);
  const switchAt = bar.indexOf(`class="od-switch"`);
  const metricsAt = bar.indexOf(`id="od-metrics"`);
  const agentAt = bar.indexOf(`id="od-toggle-agent"`);
  const menuAt = bar.indexOf(`id="od-more"`);
  assertEquals(spacerAt !== -1 && switchAt > spacerAt, true);
  assertEquals(switchAt < metricsAt && metricsAt < agentAt && agentAt < menuAt, true);
  const documentAt = html.indexOf("/ Document");
  const renameAt = html.indexOf(`id="od-rename"`);
  assertEquals(documentAt !== -1 && renameAt > documentAt, true);
  assertEquals(
    html.includes(`<button role="menuitem" id="od-rename">Rename document…</button>`),
    true,
  );
  assertEquals(html.includes(`id="od-metrics"`), true);
  assertEquals(html.includes(`class="od-sub"`), true);
  assertEquals(html.includes(`id="od-menu"`), true);
  assertEquals(html.includes(`class="od-embed"`), false);
  assertEquals(html.includes(`class="od-layout"`), true);
  assertEquals(html.includes(`<header class="site-nav od-bar">`), true);
  assertEquals(html.includes(">CHILL<"), true);
  assertEquals(html.includes(">NEUROTIC<"), true);
  assertEquals(html.includes(`href="https://editors-arena.val.run"`), true);
  assertEquals(html.includes("Editors arena"), true);
  assertEquals(html.includes("Editors arena →"), true);
  // The in-page link stays in this tab. Embed mode is the one that adds target=_blank.
  assertEquals(
    html.includes(`<a role="menuitem" href="/">All editors &amp; measurements</a>`),
    true,
  );
});

Deno.test("shell with ?embed=1 sends no bar and no assistant", async () => {
  const html = await get("/e/plate?embed=1");
  // No assistant panel, no bar, no toggle, no agent wiring targets at all.
  for (const absent of [
    `<header class="od-bar"`,
    `<header class="site-nav`,
    `id="od-aside"`,
    `id="od-toggle-agent"`,
    `id="od-form"`,
    `id="od-prompt"`,
    `id="od-log"`,
    `id="od-suggestions"`,
    `id="od-more"`,
    `id="od-switch"`,
    `id="od-docname"`,
    `id="od-metrics"`,
    `class="od-sub"`,
    `class="od-engine"`,
    "Assistant",
  ]) {
    assertEquals(html.includes(absent), false, `expected no ${absent} in embed mode`);
  }
  assertEquals(html.includes(`id="od-menu"`), true);
  assertEquals(html.includes(`id="od-rename"`), true);
  assertEquals(html.includes(`id="od-rename-dialog"`), true);
  assertEquals(
    html.includes(`<button role="menuitem" id="od-rename">Rename document…</button>`),
    true,
  );
  const documentAt = html.indexOf("/ Document");
  const renameAt = html.indexOf(`id="od-rename"`);
  assertEquals(documentAt !== -1 && renameAt > documentAt, true);
  assertEquals(html.includes("Editors arena"), false);
  assertEquals(html.includes(`class="site-nav"`), false);
  assertEquals(html.includes(`class="od-menu-wrap od-embed-menu"`), true);
  assertEquals(
    html.includes(
      `<a role="menuitem" href="/" target="_blank" rel="noopener">All editors &amp; measurements</a>`,
    ),
    true,
  );
  assertEquals(html.includes(`class="od-embed"`), true);
  // The editor takes the iframe: single-column layout, no chrome bar.
  assertEquals(html.includes(`class="od-layout no-agent"`), true);
  // What embed mode must keep: the stage, the loading overlay, the file input, the dialog.
  assertEquals(html.includes(`id="od-stage"`), true);
  assertEquals(html.includes(`id="od-loading"`), true);
  assertEquals(html.includes(`id="od-file"`), true);
  assertEquals(html.includes(`id="od-metrics-dialog"`), true);
});

Deno.test("shell with any other embed value is the full chrome", async () => {
  const html = await get("/e/plate?embed=0");
  assertEquals(html.includes(`id="od-aside"`), true);
  assertEquals(html.includes(`class="od-embed"`), false);
});

Deno.test("viewer page has no rename item", async () => {
  const viewer: EditorShell = {
    slug: "word-online",
    entry: "/editors/word-online/main.ts",
    body: "<div id=\"app\"></div>",
    title: "Microsoft Word viewer",
  };
  for (const path of ["/e/word-online", "/e/word-online?embed=1"]) {
    const app = new Hono();
    registerEditor(app, viewer);
    const html = await (await app.request(path)).text();
    assertEquals(html.includes("od-rename"), false, path);
    assertEquals(html.includes(`id="od-docname"`), false, path);
  }
});
