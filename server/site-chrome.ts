/**
 * The header, its burger menu and the footer that every page of this site shares: the landing
 * page and the blog. One copy, so a page cannot drift from the others.
 */

/** Styles of the header and its menu. Needs DS_ROOT and WORDMARK_CSS before it. */
export const SITE_NAV_CSS = `.site-nav {
  position: sticky; top: 0; z-index: 60;
  display: flex; align-items: center; gap: 18px; flex-wrap: wrap;
  min-height: 52px; box-sizing: border-box; padding: 0 clamp(20px, 5vw, 56px);
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  -webkit-backdrop-filter: saturate(140%) blur(10px); backdrop-filter: saturate(140%) blur(10px);
  border-bottom: 1px solid var(--ink);
}
.site-nav nav { margin-left: auto; display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
.site-nav nav > a {
  font-family: var(--font-mono); font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--muted); text-decoration: none; border-bottom: 2px solid transparent; padding-bottom: 2px;
}
.site-nav nav > a:hover { color: var(--ink); }
.site-nav .nav-menu {
  display: none; margin-left: auto; align-items: center; justify-content: center; gap: 8px;
  height: 32px; padding: 0 10px; border: 1px solid var(--ink); border-radius: 0;
  background: var(--surface); color: var(--ink); cursor: pointer;
  font-family: var(--font-mono); font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;
}
.site-nav .nav-menu[aria-expanded="true"] { background: var(--mark); color: var(--ink); }
.nav-label { display: none; }
.nav-burger {
  display: inline-flex; flex-direction: column; justify-content: space-between;
  width: 14px; height: 11px; flex: none;
}
.nav-burger i { display: block; height: 1px; background: currentColor; width: 100%; }
/* One row on phones: the crumb drops and MENU is the boxed burger alone, like the editor bar. */
@media (max-width: 1180px) { .site-nav .crumb { display: none; } }
@media (max-width: 760px) { .site-nav .nav-menu { width: 32px; padding: 0; } .site-nav .nav-menu-lbl { display: none; } }
@media (max-width: 820px) {
  .site-nav { flex-wrap: nowrap; }
  .site-nav .nav-menu { display: inline-flex; flex: none; }
  .site-nav nav {
    display: none; position: absolute; top: 100%; right: 0; margin: 0;
    flex-direction: column; align-items: stretch; gap: 0; min-width: 220px;
    padding: 6px 0; background: var(--surface); z-index: 70;
    border-right: 1px solid var(--ink); border-bottom: 1px solid var(--ink); border-left: 1px solid var(--ink);
  }
  .site-nav nav.is-open { display: flex; }
  /* Same look as every other menu: / Site label, sentence-case items, 8px inset, offset shadow. */
  .site-nav nav { left: 8px; right: 8px; min-width: 0; padding: 6px; border: 1px solid var(--ink); box-shadow: var(--shadow-offset, 7px 7px 0 var(--mark)); }
  .site-nav nav > a {
    padding: 8px 10px; border-bottom: 0; font-family: var(--font-sans); font-size: 14px; font-weight: 400;
    letter-spacing: -0.01em; text-transform: none; color: var(--ink);
  }
  .site-nav nav > a:hover { background: var(--mark); }
  .nav-label {
    display: flex; align-items: center; gap: 8px; padding: 8px 10px 2px;
    font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted);
  }
  .nav-label .sq { width: 8px; height: 8px; background: var(--mark); display: inline-block; }
}
.site-nav nav > a[aria-current] { color: var(--ink); }`;

/**
 * The header. `crumb` is the word after the wordmark and marks the Blog link as current when
 * it is "blog"; `home` is "" on the landing page (its links are anchors) and "/" elsewhere.
 */
export function siteNav(crumb: string, home: "" | "/"): string {
  return `<header class="site-nav">
  <a class="wm" href="/">
    <span class="logo"><span class="del">CHILL</span><span class="ins">NEUROTIC</span></span><span class="dot">.</span>DOCX<span class="dot">.</span>BENCH
  </a>
  <span class="crumb">/ ${crumb}</span>
  <button class="nav-menu" id="od-land-menu" type="button" aria-label="Menu" aria-expanded="false" aria-controls="od-land-nav">
    <span class="nav-burger" aria-hidden="true"><i></i><i></i><i></i></span><span class="nav-menu-lbl">MENU</span>
  </button>
  <nav id="od-land-nav" aria-label="Site">
    <div class="nav-label" aria-hidden="true"><span class="sq"></span> / Site</div>
    <a href="${home}#editors">Editors</a>
    <a href="https://viewers.benchmarks.law" target="_blank" rel="noopener">Viewers →</a>
    <a href="${home}#metrics">Measurements</a>
    <a href="${home}#samples">Samples</a>
    <a href="https://arena.benchmarks.law" target="_blank" rel="noopener">Arena →</a>
    <a href="/blog"${crumb === "blog" ? ' aria-current="page"' : ""}>Blog</a>
    <a href="/source" target="_blank" rel="noopener">Source →</a>
    <a href="https://arthur.law/contact" target="_blank" rel="noopener">Contact →</a>
  </nav>
</header>`;
}

/** Opens and closes the burger menu. Goes inside a module script. */
export const SITE_NAV_JS = `const navBtn = document.getElementById("od-land-menu");
const nav = document.getElementById("od-land-nav");
const setNav = (open) => {
  navBtn?.setAttribute("aria-expanded", String(open));
  nav?.classList.toggle("is-open", open);
};
navBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  setNav(navBtn.getAttribute("aria-expanded") !== "true");
});
nav?.addEventListener("click", (e) => {
  const t = e.target;
  if (t instanceof Element && t.closest("a")) setNav(false);
});
document.addEventListener("click", (e) => {
  if (!navBtn || navBtn.getAttribute("aria-expanded") !== "true") return;
  const t = e.target;
  if (t instanceof Node && (navBtn.contains(t) || nav?.contains(t))) return;
  setNav(false);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && navBtn?.getAttribute("aria-expanded") === "true") {
    setNav(false);
    navBtn.focus();
  }
});`;

/** Styles of the footer. `.wrap` is the page's own. */
export const SITE_FOOT_CSS = `.site-foot { background: var(--ink); color: var(--footer-text); border-top: 1px solid var(--dark-rule); padding: 32px 0 40px; }
.foot-top { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 16px; align-items: center; margin-bottom: 18px; }
.foot-top .c { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; }
.foot-social { display: flex; gap: 10px; }
.foot-social a {
  font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase;
  text-decoration: none; color: var(--on-dark); border: 1px solid var(--dark-border); padding: 6px 10px;
}
.foot-social a:hover { border-color: var(--mark); color: var(--mark); }
.site-foot a:focus-visible { outline-color: var(--mark); }
.disclaimer { font-size: 13px; line-height: 1.6; color: var(--disclaimer); max-width: 78ch; border-top: 1px solid var(--dark-rule); padding-top: 16px; margin: 0; }
.disclaimer strong { color: var(--disclaimer-strong); font-weight: 600; }`;

export function siteFoot(): string {
  return `<footer class="site-foot"><div class="wrap">
  <div class="foot-top">
    <span class="c">© MMXXVI open-docs · Built on Val Town</span>
    <div class="foot-social">
      <a href="/source" target="_blank" rel="noopener">Source</a>
      <a href="https://val.town">Val Town</a>
    </div>
  </div>
  <p class="disclaimer"><strong>Method.</strong> Each editor keeps its own license. SuperDoc is AGPL-3.0: check that license before you ship it in a closed product. Figures are medians of recent visits in visitors' browsers. A missing cell means that reading was not taken, not that the cost was zero. <strong>Independent.</strong> open-docs is not affiliated with the editors or viewers it runs.</p>
</div></footer>`;
}
