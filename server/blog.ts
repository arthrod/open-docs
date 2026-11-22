/**
 * The blog: `/blog` lists the posts, `/blog/<slug>` shows one. A post is a Markdown file in
 * `blog/`, named by its slug; its title, date and summary are in POSTS below, in the order they are
 * meant to be read: the index lists them so, and each post's footer leads to its neighbours.
 */
import { marked } from "https://esm.sh/marked@18.1.3?target=es2022";
import { serveFile } from "https://esm.town/v/std/utils/serve-file.ts";
import { DS_ROOT, WORDMARK_CSS } from "./styles.ts";
import { SITE_FOOT_CSS, SITE_NAV_CSS, SITE_NAV_JS, siteFoot, siteNav } from "./site-chrome.ts";

export interface Post {
  slug: string;
  title: string;
  /** ISO date of publication. */
  date: string;
  summary: string;
  /** Reading time in minutes. */
  minutes: number;
}

export const POSTS: Post[] = [
  {
    slug: "why-we-test",
    title: "Why we test Word editors in the browser",
    date: "2026-11-20",
    summary: "A contract is a Word file. Before you put one in a browser, you want to know what the browser does to it.",
    minutes: 4,
  },
  {
    slug: "what-the-numbers-mean",
    title: "Loaded, Settled, heap, pages: what the numbers mean",
    date: "2026-11-20",
    summary: "Each column of the tables in plain words: what it measures, what it cannot see, and when to trust it.",
    minutes: 5,
  },
  {
    slug: "test-an-editor-yourself",
    title: "Test a Word editor yourself in fifteen minutes",
    date: "2026-11-20",
    summary: "Three files, one browser, a stopwatch you already have. A test anyone can run, and the script that runs it for you.",
    minutes: 6,
  },
  {
    slug: "what-went-wrong",
    title: "Six ways our benchmark lied to us",
    date: "2026-11-20",
    summary: "A page count read too early, a timer that timed nothing, memory that was garbage. What we caught, how, and what you should check in any benchmark.",
    minutes: 6,
  },
  {
    slug: "what-we-found",
    title: "What the new numbers say, and how to choose an editor",
    date: "2026-11-21",
    summary: "The whole test, run again with our mistakes fixed. Four questions the tables answer, what they cannot tell you, and a short way to choose.",
    minutes: 5,
  },
];

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const day = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

const FAVICON =
  "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' fill='%230A0A0A'/><rect x='4' y='20' width='24' height='7' fill='%23FFD400'/></svg>";

const CSS = DS_ROOT + WORDMARK_CSS + `
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink-prose); font-family: var(--font-sans); font-size: 17px; line-height: 1.65; }
a { color: inherit; text-decoration-color: var(--link-rule); text-underline-offset: 3px; }
a:hover { text-decoration-color: var(--ink); }
a:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }
main { max-width: 720px; margin-inline: auto; padding: 56px clamp(20px, 5vw, 40px) 88px; }
.eyebrow { font-family: var(--font-mono); font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); margin: 0 0 14px; }
h1 { font-size: clamp(32px, 5.4vw, 46px); line-height: 1.08; letter-spacing: -0.02em; color: var(--ink); margin: 0 0 18px; text-wrap: balance; }
.lede { font-size: 20px; line-height: 1.5; color: var(--ink-soft); margin: 0 0 40px; padding-bottom: 28px; border-bottom: 1px solid var(--ink); }
.post h2 { font-size: 24px; line-height: 1.2; letter-spacing: -0.01em; color: var(--ink); margin: 44px 0 12px; }
.post h3 { font-size: 18px; color: var(--ink); margin: 30px 0 8px; }
.post p, .post ul, .post ol { margin: 0 0 18px; }
.post li { margin-bottom: 6px; }
.post strong { color: var(--ink); }
.post code { font-family: var(--font-mono); font-size: 0.86em; background: var(--code-bg); padding: 1px 5px; }
.post pre { background: var(--ink); color: var(--on-dark); padding: 16px 18px; overflow-x: auto; font-size: 13.5px; line-height: 1.55; margin: 0 0 22px; }
.post pre code { background: none; padding: 0; color: inherit; font-size: inherit; }
.post blockquote { margin: 0 0 22px; padding: 4px 0 4px 18px; border-left: var(--bar-mark); color: var(--ink-soft); }
.post blockquote p:last-child { margin-bottom: 0; }
.post .tw { overflow-x: auto; margin: 0 0 22px; }
.post table { border-collapse: collapse; width: 100%; font-size: 15px; }
.post th { text-align: left; font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); border-bottom: 1px solid var(--ink); padding: 8px 12px 8px 0; }
.post td { border-bottom: var(--border-faint); padding: 9px 12px 9px 0; vertical-align: top; }
.post hr { border: 0; border-top: 1px solid var(--faint); margin: 36px 0; }
.next { margin-top: 56px; padding-top: 22px; border-top: 1px solid var(--ink); display: flex; justify-content: space-between; gap: 24px; flex-wrap: wrap; font-size: 15px; }
.next span { display: block; font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
.list { list-style: none; margin: 0; padding: 0; }
.list li { border-top: var(--border-faint); }
.list li:first-child { border-top: 0; }
.list li:first-child a { padding-top: 0; }
.list a { display: block; padding: 22px 0; text-decoration: none; }
.list h2 { font-size: 23px; line-height: 1.2; letter-spacing: -0.01em; color: var(--ink); margin: 6px 0 6px; }
.list a:hover h2 { background: linear-gradient(transparent 62%, var(--mark) 62%); display: inline; }
.list p { margin: 6px 0 0; color: var(--ink-body); font-size: 16px; }
.wrap { max-width: var(--page-max); margin-inline: auto; padding-inline: clamp(20px, 5vw, 56px); }
.list .eyebrow b { color: var(--ink); }
.next a { max-width: 46%; }
.next a:last-child { margin-left: auto; text-align: right; }
` + SITE_NAV_CSS + SITE_FOOT_CSS;

function page(title: string, description: string, path: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="${path === "/blog" ? "website" : "article"}"><link rel="canonical" href="https://editors.benchmarks.law${path}">
<link rel="icon" href="${FAVICON}">
<style>${CSS}</style></head>
<body>
${siteNav("blog", "/")}
<main>${body}</main>
${siteFoot()}
<script type="module">${SITE_NAV_JS}</script>
</body></html>`;
}

export function blogIndex(): string {
  const items = POSTS.map((p, i) => `
    <li><a href="/blog/${p.slug}">
      <p class="eyebrow"><b>Part ${i + 1} of ${POSTS.length}</b> · ${day(p.date)} · ${p.minutes} min read</p>
      <h2>${esc(p.title)}</h2>
      <p>${esc(p.summary)}</p>
    </a></li>`).join("");
  return page(
    "Blog: how and why we test Word editors · open-docs",
    "How we measure Word editors in the browser, what the numbers mean, and how to run the same tests yourself.",
    "/blog",
    `<p class="eyebrow">Blog</p>
<h1>How we test, and why</h1>
<p class="lede">Plain-language notes on measuring Word editors in the browser: what we test, what the numbers mean, what went wrong, and how to do it yourself. Five short posts, in the order to read them.</p>
<ul class="list">${items}</ul>`,
  );
}

const cache = new Map<string, string>();
async function markdownOf(slug: string): Promise<string | null> {
  const hit = cache.get(slug);
  if (hit) return hit;
  const res = await serveFile(`/blog/${slug}.md`);
  if (!res.ok) return null;
  const text = await res.text();
  cache.set(slug, text);
  return text;
}

/**
 * The foot of post number `i`: the post before it on the left, the one after it on the right.
 * The first post has no Previous and the last no Next; the empty side keeps the other in place.
 */
export function postFooter(i: number): string {
  const link = (p: Post | undefined, label: string) =>
    p ? `<a href="/blog/${p.slug}"><span>${label}</span>${esc(p.title)}</a>` : "<span></span>";
  return `<div class="next">${link(POSTS[i - 1], "Previous")}${link(POSTS[i + 1], "Next")}</div>`;
}

/** One post as a page, or null when there is no such post. */
export async function blogPost(slug: string): Promise<string | null> {
  const i = POSTS.findIndex((p) => p.slug === slug);
  if (i < 0) return null;
  const post = POSTS[i];
  const md = await markdownOf(slug);
  if (md == null) return null;
  const html = (await marked.parse(md, { gfm: true }))
    .replaceAll("<table>", '<div class="tw"><table>').replaceAll("</table>", "</table></div>");
  return page(
    `${post.title} · open-docs`,
    post.summary,
    `/blog/${slug}`,
    `<p class="eyebrow"><a href="/blog">Blog</a> · Part ${i + 1} of ${POSTS.length} · ${day(post.date)} · ${post.minutes} min read</p>
<h1>${esc(post.title)}</h1>
<p class="lede">${esc(post.summary)}</p>
<article class="post">${html}</article>
${postFooter(i)}`,
  );
}
