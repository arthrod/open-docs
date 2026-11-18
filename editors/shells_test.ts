import { assertEquals } from "jsr:@std/assert@1.0.13";
import { editorMounts } from "./index.ts";

// Shells are plain objects (a second site imports them too), so their shape is checked here
// instead of by a type at each declaration.
Deno.test("every wired editor's shell has the fields the routes and the viewer site read", async () => {
  for (const slug of editorMounts) {
    const shell = (await import(`./${slug}/shell.ts`)).default as Record<string, unknown>;
    const bad: string[] = [];
    if (shell.slug !== slug) bad.push("slug");
    for (const field of ["entry", "body", "title"]) if (typeof shell[field] !== "string" || !shell[field]) bad.push(field);
    if (shell.head !== undefined && typeof shell.head !== "string") bad.push("head");
    if (typeof shell.entry === "string" && !shell.entry.startsWith(`/editors/${slug}/`)) bad.push("entry path");
    for (const [k, v] of Object.entries((shell.importMap ?? {}) as Record<string, unknown>)) if (typeof v !== "string" || !v) bad.push(`importMap[${k}]`);
    if (shell.sameOrigin !== undefined && typeof shell.sameOrigin !== "boolean") bad.push("sameOrigin");
    assertEquals(bad, [], `editors/${slug}/shell.ts`);
  }
});
