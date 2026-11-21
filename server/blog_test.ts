import { assert, assertEquals } from "jsr:@std/assert@1";
// server/blog.ts imports esm.town's serveFile, whose module needs a non-empty key to load.
Deno.env.set("VAL_TOWN_API_KEY", Deno.env.get("VAL_TOWN_API_KEY") ?? "test-only");
const { blogIndex, POSTS } = await import("./blog.ts");

Deno.test("every post has a Markdown file, and the index links each one", async () => {
  const index = blogIndex();
  for (const p of POSTS) {
    const md = await Deno.readTextFile(new URL(`../blog/${p.slug}.md`, import.meta.url));
    assert(md.length > 1500, p.slug);
    assert(index.includes(`href="/blog/${p.slug}"`), p.slug);
  }
});

Deno.test("links between posts point at posts that exist", async () => {
  const slugs = new Set(POSTS.map((p) => p.slug));
  for (const p of POSTS) {
    const md = await Deno.readTextFile(new URL(`../blog/${p.slug}.md`, import.meta.url));
    for (const m of md.matchAll(/\]\(\/blog\/([a-z0-9-]+)\)/g)) assert(slugs.has(m[1]), `${p.slug} links to ${m[1]}`);
  }
});

Deno.test("posts are listed newest first", () => {
  const dates = POSTS.map((p) => p.date);
  assertEquals(dates, [...dates].sort((a, b) => b.localeCompare(a)));
});
