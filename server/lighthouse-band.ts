/**
 * The landing page's "/ Lighthouse" band: Google's PageSpeed Insights
 * (Lighthouse on Google's machines, desktop and mobile) on every engine's
 * page, collected by scripts/measure_pagespeed.py and published as
 * docs/lighthouse/latest.json (medians).
 */
import LATEST from "../docs/lighthouse/latest.json" with { type: "json" };
import type { EditorMeta } from "./registry.ts";

export interface LighthousePage {
  performance: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  seo: number | null;
  fcpMs: number | null;
  lcpMs: number | null;
  tbtMs: number | null;
  cls: number | null;
  speedIndexMs: number | null;
  performanceRuns: (number | null)[];
  error: string | null;
}
export interface LighthouseResults {
  measuredAt: string | null;
  environment: string;
  /** "e/<slug>" → medians, per form factor */
  pages: Record<string, { desktop: LighthousePage; mobile: LighthousePage }>;
  /** The same pages opening a Menu sample (`?open=<file>`): sample id → page → medians. */
  docs?: Record<string, Record<string, { desktop: LighthousePage; mobile: LighthousePage }>>;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ms = (n: number | null | undefined) =>
  n == null ? "n/a" : n < 1000 ? `${Math.round(n)} ms` : `${(n / 1000).toFixed(n < 10_000 ? 2 : 1)} s`;
const score = (n: number | null | undefined) =>
  n == null ? "n/a" : `<b class="lh ${n >= 90 ? "lh-good" : n >= 50 ? "lh-mid" : "lh-bad"}">${n}</b>`;

export function lighthouseBand(all: EditorMeta[], data: LighthouseResults = LATEST as LighthouseResults): string {
  const table = (pages: LighthouseResults["pages"], q: string) => {
    const psi = (slug: string) => `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(`https://editors.benchmarks.law/e/${slug}${q}`)}`;
    const row = (e: EditorMeta) => {
      const r = pages?.[`e/${e.slug}`];
      if (!r) return "";
      const name = `<a href="/e/${e.slug}${q}">${esc(e.name)}</a>${e.kind === "viewer" ? ` <span class="vo">view-only</span>` : ""}`;
      const d = r.desktop, m = r.mobile;
      if (d.performance == null && m.performance == null) return `<tr><td>${name}</td><td colspan="8"><b>no result</b>: ${esc((d.error ?? m.error ?? "PageSpeed gave no score").slice(0, 160))}</td></tr>`;
      return `<tr><td>${name}</td><td class="n">${score(d.performance)} · ${score(m.performance)}</td><td class="n">${ms(d.lcpMs)} · ${ms(m.lcpMs)}</td><td class="n">${ms(d.tbtMs)} · ${ms(m.tbtMs)}</td>
      <td class="n hide-sm">${d.cls ?? "n/a"} · ${m.cls ?? "n/a"}</td><td class="n hide-sm">${score(d.accessibility)}</td><td class="n hide-sm">${score(d.bestPractices)}</td><td class="n hide-sm">${score(d.seo)}</td>
      <td class="hide-sm"><a href="${psi(e.slug)}" target="_blank" rel="noopener">run it →</a></td></tr>`;
    };
    const rows = all.map(row).join("");
    return rows && `<div class="table-wrap"><table class="tbl lh-tbl"><thead><tr>
    <th>Engine</th><th class="n">Performance</th><th class="n">LCP</th><th class="n">TBT</th><th class="n hide-sm">CLS</th>
    <th class="n hide-sm">Accessibility</th><th class="n hide-sm">Best practices</th><th class="n hide-sm">SEO</th><th class="hide-sm">PageSpeed</th>
  </tr></thead><tbody>${rows}</tbody></table></div>`;
  };
  const blank = table(data.pages ?? {}, "");
  if (!blank) return "";
  const long = table(data.docs?.["lorem-500"] ?? {}, "?open=lorem-500.docx");
  const longBlock = long
    ? `<h3 class="smp-h" id="lighthouse-lorem-500">Opening the 500 pages sample <small>each page with <code>?open=lorem-500.docx</code>, which presses the Menu's own button once the editor is ready</small></h3>
  <p class="sec-copy">PageSpeed gives a page a fixed time to load; an engine still working when it ends is scored on what it had drawn.</p>
  ${long}`
    : "";
  return `<section class="band" id="lighthouse"><div class="wrap">
  <h2 class="sec-label"><span class="sq" aria-hidden="true"></span> / Lighthouse</h2>
  <p class="sec-copy">Google's <a href="https://pagespeed.web.dev">PageSpeed Insights</a> on every engine's page: Lighthouse run on Google's machines, so the figures do not depend on anyone's computer.
  Measured ${esc(data.measuredAt ?? "")}: ${esc(data.environment)}. Every cell reads <b>desktop · mobile</b>; mobile emulates a mid-range phone on slow 4G. Scores are 0 to 100.
  <b>LCP</b>: largest contentful paint. <b>TBT</b>: total blocking time, how long the main thread was too busy to answer input. <b>CLS</b>: layout shift. Accessibility, best practices and SEO are the desktop scores.
  It scores the page loading with its blank document, not editing and not how faithfully a file is drawn.
  For Microsoft's and Google's viewers it sees this site's frame page, not their servers' work.</p>
  ${blank}
  ${longBlock}
</div></section>`;
}
