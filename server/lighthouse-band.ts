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
/** One page's medians per form factor, and the run that measured it when that is recorded. */
export interface LighthouseEntry {
  desktop: LighthousePage;
  mobile: LighthousePage;
  measuredAt?: string;
  environment?: string;
  /** The site address that was analysed, when the run recorded it. */
  base?: string;
}
export interface LighthouseResults {
  measuredAt: string | null;
  environment: string;
  base?: string;
  /** "e/<slug>" → medians, per form factor */
  pages: Record<string, LighthouseEntry>;
  /** The same pages opening a Menu sample (`?open=<file>`): sample id → page → medians. */
  docs?: Record<string, Record<string, LighthouseEntry>>;
  /** When and how each `docs` population was measured, when it was measured apart from `pages`. */
  docsMeta?: Record<string, { measuredAt: string; environment: string }>;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** A number from a results file, or null: anything else (a string in a hand-edited file) is not written into the page. */
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const ms = (v: number | null | undefined) => {
  const n = num(v);
  return n == null ? "n/a" : n < 1000 ? `${Math.round(n)} ms` : `${(n / 1000).toFixed(n < 10_000 ? 2 : 1)} s`;
};
const score = (v: number | null | undefined) => {
  const n = num(v);
  return n == null ? "n/a" : `<b class="lh ${n >= 90 ? "lh-good" : n >= 50 ? "lh-mid" : "lh-bad"}">${n}</b>`;
};

/**
 * "mobile analyses ranged 44 to 79" when a page's analyses differ by 10 points or more: a median of
 * a few analyses of such a page moves from one day to the next, and the reader should see by how much.
 */
const spread = (f: string, p: LighthousePage): string => {
  const runs = (p.performanceRuns ?? []).map(num).filter((n): n is number => n != null);
  if (runs.length < 2) return "";
  const lo = Math.min(...runs), hi = Math.max(...runs);
  return hi - lo >= 10 ? `${f} analyses ranged ${lo} to ${hi}` : "";
};

export function lighthouseBand(all: EditorMeta[], data: LighthouseResults = LATEST as LighthouseResults): string {
  const table = (pages: LighthouseResults["pages"], q: string, head: { measuredAt?: string | null; environment?: string }) => {
    // The link analyses the address the row was measured on.
    const psi = (slug: string, base?: string) => `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(`${base ?? data.base ?? "https://editors.benchmarks.law"}/e/${slug}${q}`)}`;
    const row = (e: EditorMeta) => {
      const r = pages?.[`e/${e.slug}`];
      if (!r) return "";
      const name = `<a href="/e/${e.slug}${q}">${esc(e.name)}</a>${e.kind === "viewer" ? ` <span class="vo">view-only</span>` : ""}`;
      // A form factor missing from the file is one without a result, not a reason to drop the table.
      const none = { performanceRuns: [], error: null } as unknown as LighthousePage;
      const d = r.desktop ?? none, m = r.mobile ?? none;
      // A median over fewer analyses than were run says so, with the reason the others gave.
      const part = (f: string, p: LighthousePage) => {
        const runs = p.performanceRuns ?? [];
        const got = runs.filter((n) => num(n) != null).length;
        return got === runs.length ? "" : `${f} ${got}/${runs.length} analyses${p.error ? `: ${esc(String(p.error).slice(0, 120))}` : ""}`;
      };
      const partial = [part("desktop", d), part("mobile", m), spread("desktop", d), spread("mobile", m)].filter(Boolean).join(" · ");
      // A page analysed in another run than the table's heading (a partial re-run), or on another
      // address, says so, whether or not it got a result.
      const otherBase = !!r.base && !!data.base && r.base !== data.base;
      const elsewhere = (r.measuredAt && r.measuredAt !== head.measuredAt) || (r.environment && r.environment !== head.environment) || otherBase
        ? ` <small class="lh-part prov">measured ${esc(r.measuredAt ?? "")}: ${esc(r.environment ?? "")}${otherBase ? ` · ${esc(r.base!)}` : ""}</small>`
        : "";
      if (num(d.performance) == null && num(m.performance) == null) return `<tr><td>${name}${elsewhere}</td><td colspan="8"><b>no result</b>: ${esc(String(d.error ?? m.error ?? "PageSpeed gave no score").slice(0, 160))}</td></tr>`;
      return `<tr><td>${name}${elsewhere}${partial ? ` <small class="lh-part">${partial}</small>` : ""}</td><td class="n">${score(d.performance)} · ${score(m.performance)}</td><td class="n">${ms(d.lcpMs)} · ${ms(m.lcpMs)}</td><td class="n">${ms(d.tbtMs)} · ${ms(m.tbtMs)}</td>
      <td class="n hide-sm">${num(d.cls) ?? "n/a"} · ${num(m.cls) ?? "n/a"}</td><td class="n hide-sm">${score(d.accessibility)}</td><td class="n hide-sm">${score(d.bestPractices)}</td><td class="n hide-sm">${score(d.seo)}</td>
      <td class="hide-sm"><a href="${psi(e.slug, r.base)}" target="_blank" rel="noopener">run it →</a></td></tr>`;
    };
    const rows = all.map(row).join("");
    return rows && `<div class="table-wrap"><table class="tbl lh-tbl"><thead><tr>
    <th>Engine</th><th class="n">Performance</th><th class="n">LCP</th><th class="n">TBT</th><th class="n hide-sm">CLS</th>
    <th class="n hide-sm">Accessibility</th><th class="n hide-sm">Best practices</th><th class="n hide-sm">SEO</th><th class="hide-sm">PageSpeed</th>
  </tr></thead><tbody>${rows}</tbody></table></div>`;
  };
  const blank = table(data.pages ?? {}, "", data);
  if (!blank) return "";
  const long = table(data.docs?.["lorem-500"] ?? {}, "?open=lorem-500.docx", data.docsMeta?.["lorem-500"] ?? data);
  const longBlock = long
    ? `<h3 class="smp-h" id="lighthouse-lorem-500">Opening the 500 pages sample <small>each page with <code>?open=lorem-500.docx</code>: an editor opens it from its Menu once it is ready, a view-only engine starts on it</small></h3>
  <p class="sec-copy">PageSpeed gives a page a fixed time to load; an engine still working when it ends is scored on what it had drawn.
  LCP here is mostly this site's own frame, which paints before any document: what the 500 pages cost shows in TBT, and in the analyses that never finished.
  An engine that could not start on Google's machine has no score: a failed page paints fast, and its score would flatter it.${
      data.docsMeta?.["lorem-500"] ? ` Measured ${esc(data.docsMeta["lorem-500"].measuredAt)}: ${esc(data.docsMeta["lorem-500"].environment)}.` : ""
    }</p>
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
