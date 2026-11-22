import { assert, assertEquals } from "jsr:@std/assert@1";
// server/blog.ts imports esm.town's serveFile, whose module needs a non-empty key to load.
Deno.env.set("VAL_TOWN_API_KEY", Deno.env.get("VAL_TOWN_API_KEY") ?? "test-only");
const { blogIndex, postFooter, POSTS } = await import("./blog.ts");

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

const ORDER = ["why-we-test", "what-the-numbers-mean", "test-an-editor-yourself", "what-went-wrong", "what-we-found"];

Deno.test("posts are in reading order, and the index numbers them in that order", () => {
  assertEquals(POSTS.map((p) => p.slug), ORDER);
  const index = blogIndex();
  const at = ORDER.map((s) => index.indexOf(`href="/blog/${s}"`));
  assertEquals(at, [...at].sort((a, b) => a - b));
  ORDER.forEach((_, i) => assert(index.includes(`Part ${i + 1} of 5`), `part ${i + 1}`));
});

Deno.test("a post's footer leads to the post before it and the post after it", () => {
  ORDER.forEach((_, i) => {
    const foot = postFooter(i);
    const prev = foot.match(/href="\/blog\/([a-z-]+)"><span>Previous/)?.[1];
    const next = foot.match(/href="\/blog\/([a-z-]+)"><span>Next/)?.[1];
    assertEquals(prev, ORDER[i - 1], `previous of ${ORDER[i]}`);
    assertEquals(next, ORDER[i + 1], `next of ${ORDER[i]}`);
    if (prev && next) assert(foot.indexOf("Previous") < foot.indexOf("Next"));
  });
});

Deno.test("no post repeats the footer with a Next line of its own", async () => {
  for (const p of POSTS) {
    const md = await Deno.readTextFile(new URL(`../blog/${p.slug}.md`, import.meta.url));
    assert(!/^Next: /m.test(md), p.slug);
  }
});

Deno.test("the blog carries the site's burger menu and footer", () => {
  const index = blogIndex();
  assert(index.includes('id="od-land-menu"'), "burger button");
  assert(index.includes('class="nav-burger"'), "burger icon");
  assert(index.includes('getElementById("od-land-menu")'), "menu script");
  assert(index.includes('href="/#editors"'), "links go to the landing page's sections");
  assert(index.includes('aria-current="page">Blog'), "Blog is marked current");
  assert(index.includes('class="disclaimer"'), "the site's footer");
});
