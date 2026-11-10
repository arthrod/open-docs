/**
 * cite-check verification probe (plan §7, T1–T7 + T8 no-regression).
 *
 * Every check is an independent measurer: it reads routes, editor state and
 * exported bytes — never the diff. It prints PASS/FAIL per check with evidence
 * and exits non-zero if anything failed.
 *
 * Run (from the repo root, with playwright-core available):
 *   node editors/cite-check/probe.js http://127.0.0.1:8788
 * (works unchanged against the live https://editors.benchmarks.law)
 */
import { chromium } from "playwright-core";

const BASE = (process.argv[2] ?? "http://127.0.0.1:8788").replace(/\/$/, "");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const Q1 = "The district court retains wide latitude to admit or exclude summary judgment evidence under Rule 56(c).";
const T5_SPAN = "The delivery contract at issue was executed in March 2024";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const results = [];
const check = (id, name, ok, evidence = "") => {
  results.push({ id, name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${id} ${name}${evidence ? "  — " + evidence : ""}`);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------ page helpers ------------------------------ */
// Reads one zip entry (no deps): EOCD → central dir → local header →
// inflate-raw via the browser's own DecompressionStream.
async function readZipEntryInPage(bytes, name) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("EOCD not found");
  const count = dv.getUint16(eocd + 10, true);
  let off = dv.getUint32(eocd + 16, true);
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(off, true) !== 0x02014b50) throw new Error("bad central directory");
    const method = dv.getUint16(off + 10, true);
    const compSize = dv.getUint32(off + 20, true);
    const nameLen = dv.getUint16(off + 28, true);
    const extraLen = dv.getUint16(off + 30, true);
    const commentLen = dv.getUint16(off + 32, true);
    const localOff = dv.getUint32(off + 42, true);
    const entryName = new TextDecoder().decode(bytes.subarray(off + 46, off + 46 + nameLen));
    if (entryName === name) {
      const lnLen = dv.getUint16(localOff + 26, true);
      const leLen = dv.getUint16(localOff + 28, true);
      const start = localOff + 30 + lnLen + leLen;
      const comp = bytes.subarray(start, start + compSize);
      if (method === 0) return new TextDecoder().decode(comp);
      const stream = new Blob([comp]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      return await new Response(stream).text();
    }
    off += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`${name} not in zip`);
}

/* ---------------------------------- T1 ----------------------------------- */
{
  const res = await fetch(`${BASE}/e/cite-check`);
  const html = await res.text();
  check("T1", "route 200 + shell", res.status === 200,
    `status ${res.status}, importmap:${html.includes("esm.sh/@hufe921/canvas-editor@1.1.0")}, panel:${html.includes("cc-panel")}`);
  check("T1", "pinned esm.sh import map", html.includes("esm.sh/@hufe921/canvas-editor@1.1.0") && html.includes("cc-panel"));
  // No-agent page (owner mandate): the served shell must not even contain the
  // assistant aside, its toggle, or the prompt-chip containers.
  check("T1", "no assistant panel in the served page",
    !html.includes('id="od-aside"') && !html.includes('id="od-toggle-agent"') && !html.includes('id="od-suggestions"') && !html.includes('id="od-prompt"'),
    `od-aside:${html.includes('id="od-aside"')}, toggle:${html.includes('id="od-toggle-agent"')}, chips:${html.includes('id="od-suggestions"')}`);
  check("T1", "sources are file-import (no textarea)", html.includes('id="cc-source-file"') && !html.includes('id="cc-sources"'),
    `file input:${html.includes('id="cc-source-file"')}, textarea:${html.includes('id="cc-sources"')}`);
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--headless=new"] });
const ctx = await browser.newContext({
  permissions: ["clipboard-read", "clipboard-write"],
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
});
const page = await ctx.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e.message)));

try {
  await page.goto(`${BASE}/e/cite-check`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForFunction("!!window.__citeCheck?.editor()", null, { timeout: 90_000 });

  /* -------------------------------- T2 ---------------------------------- */
  {
    const mounted = await page.evaluate(() => {
      const host = document.querySelector("#cc-page");
      return { editor: !!window.__citeCheck.editor(), canvas: !!host?.querySelector("canvas") };
    });
    check("T2", "editor mounted + canvas", mounted.editor && mounted.canvas, JSON.stringify(mounted));
    // No-agent, live DOM: nothing may render late either (ui.ts chips).
    const agentDom = await page.evaluate(() => ({
      aside: !!document.querySelector("#od-aside"),
      toggle: !!document.querySelector("#od-toggle-agent"),
      chips: !!document.querySelector("#od-suggestions"),
      prompt: !!document.querySelector("#od-prompt"),
      noAgentClass: document.querySelector("#od-layout")?.classList.contains("no-agent") ?? false,
      sourcesTextarea: !!document.querySelector("#cc-sources"),
      sourceFile: !!document.querySelector("#cc-source-file"),
    }));
    check("T2", "no assistant panel / toggle / chips rendered", !agentDom.aside && !agentDom.toggle && !agentDom.chips && !agentDom.prompt,
      JSON.stringify(agentDom));
    check("T2", "layout is agentless", agentDom.noAgentClass);
    check("T2", "sources UI is file-import", agentDom.sourceFile && !agentDom.sourcesTextarea);
  }

  /* -------------------------------- T3 ---------------------------------- */
  const fixtureBytes = new Uint8Array(await (await fetch(`${BASE}/api/cite-check/appellate-brief.docx`)).arrayBuffer());
  const sourcesText = await (await fetch(`${BASE}/api/cite-check/sources.txt`)).text();
  {
    // Sources load via the real file path: DataTransfer + change event on
    // #cc-source-file, the fixture source set as a .txt File.
    const imported = await page.evaluate(async ([srcText]) => {
      const dt = new DataTransfer();
      dt.items.add(new File([srcText], "demo-sources.txt", { type: "text/plain" }));
      const input = document.getElementById("cc-source-file");
      input.files = dt.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      for (let i = 0; i < 200; i++) {
        await new Promise((r) => setTimeout(r, 50));
        if (document.querySelectorAll("#cc-source-list .cc-src").length >= 4) break;
      }
      return {
        rows: [...document.querySelectorAll("#cc-source-list .cc-src .nm")].map((n) => n.textContent),
      };
    }, [sourcesText]);
    check("T3", "sources imported via the file input path", imported.rows.length === 4,
      JSON.stringify(imported.rows));
    const md = await page.evaluate(async ([arr]) => {
      await window.__citeCheck.loadFixture();
      return window.__citeCheck.editor().command.executeExportMarkdown();
    }, [Array.from(fixtureBytes)]);
    const ok = md.includes("APPELLANT'S OPENING BRIEF") && md.includes(Q1) && md.includes("PRELIMINARY STATEMENT");
    check("T3", "appellate brief imports natively + exports markdown", ok,
      `len ${md.length}, caption:${md.includes("APPELLANT'S OPENING BRIEF")}, sections:${md.includes("PRELIMINARY STATEMENT")}, Q1:${md.includes(Q1)}`);
  }

  /* ------------------------- T4 (amendments A3) --------------------------- */
  {
    const t4 = await page.evaluate(async () => {
      const cc = window.__citeCheck;
      const fresh = await cc.editor().command.executeExportMarkdown();
      const last = cc.lastInput();
      const enc = new TextEncoder();
      const h = async (s) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)))].map((b) => b.toString(16).padStart(2, "0")).join("");
      const [hFresh, hPassed] = await Promise.all([h(fresh), h(last.document.text)]);
      const core = await import("/editors/cite-check/core/core.js");
      const recomputed = core.runCiteCheck({ document: { name: last.document.name, text: fresh }, sources: last.sources });
      const panel = cc.report();
      const rows = document.querySelectorAll("#cc-quotes .cc-quote").length;
      return {
        byteIdentical: fresh === last.document.text,
        hFresh, hPassed,
        deepEqual: JSON.stringify(recomputed) === JSON.stringify(panel),
        summary: panel.summary,
        warnings: panel.extractionWarnings ?? [],
        fuzzyNotes: panel.results.filter((r) => r.classification === "fuzzy").map((r) => r.notes.join(" | ")),
        rows,
      };
    });
    check("T4", "core-input identity (A3a): passed string === fresh export", t4.byteIdentical,
      `sha256 ${t4.hFresh.slice(0, 16)}… ${t4.byteIdentical ? "=" : "≠"} ${t4.hPassed.slice(0, 16)}…`);
    check("T4", "probe recompute deep-equals panel report (A3b)", t4.deepEqual);
    const s = t4.summary;
    check("T4", "engineered counts on the real brief", s.total === 4 && s.exact === 2 && s.normalized === 1 && s.fuzzy === 1,
      JSON.stringify(s));
    check("T4", "number guard flagged on the fuzzy quote", t4.fuzzyNotes.some((n) => n.includes("number alteration")),
      t4.fuzzyNotes[0]?.slice(0, 120) ?? "none");
    check("T4", "extraction warnings present", t4.warnings.length >= 1, t4.warnings[0] ?? "none");
    check("T4", "panel rendered 4 rows from the core", t4.rows === 4, `rows ${t4.rows}`);
  }

  /* ------------- T9 sources panel: toggle, remove, .docx source ------------ */
  {
    const t9 = await page.evaluate(async ([arr, srcText, docxMime]) => {
      const out = {};
      const rows = () => [...document.querySelectorAll("#cc-source-list .cc-src .nm")].map((n) => n.textContent);
      const waitRows = async (n) => {
        for (let i = 0; i < 200; i++) {
          await new Promise((r) => setTimeout(r, 50));
          if (document.querySelectorAll("#cc-source-list .cc-src").length === n) return true;
        }
        return false;
      };
      const importFile = async (file) => {
        const dt = new DataTransfer();
        dt.items.add(file);
        const input = document.getElementById("cc-source-file");
        input.files = dt.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      };
      out.before = rows().length; // 4 file-imported sources
      // 1. toggle the bundled full demo set IN (same 4 sources, demo-flagged)
      document.getElementById("cc-demo-sources").click();
      out.afterAdd = await waitRows(out.before + 4);
      out.labelOn = document.getElementById("cc-demo-sources").textContent.trim();
      // 2. toggle it back OUT — the file-imported ones must survive
      document.getElementById("cc-demo-sources").click();
      out.afterRemove = await waitRows(out.before);
      out.labelOff = document.getElementById("cc-demo-sources").textContent.trim();
      // 3. per-source remove: drop the first (Smith v. United Services)
      out.removedName = rows()[0];
      document.querySelector("#cc-source-list .cc-src button[data-rm]").click();
      out.afterOneRemoved = await waitRows(out.before - 1);
      // 4. .docx source via the hidden second editor (importDocx+exportMarkdown)
      await importFile(new File([new Uint8Array(arr)], "appellate-brief.docx", { type: docxMime }));
      out.docxSourceAdded = await waitRows(out.before);
      out.docxRow = rows().find((n) => n.includes("appellate-brief"));
      const docxRowBtn = [...document.querySelectorAll("#cc-source-list .cc-src")]
        .find((r) => r.querySelector(".nm")?.textContent.includes("appellate-brief"))
        ?.querySelector("button[data-rm]");
      docxRowBtn?.click();
      out.docxSourceRemoved = await waitRows(out.before - 1);
      // 5. restore the full source set for the annotation checks below
      await importFile(new File([srcText], "demo-sources.txt", { type: "text/plain" }));
      out.restored = await waitRows(out.before * 2 - 1);
      out.reportAfter = window.__citeCheck.report()?.summary;
      return out;
    }, [Array.from(fixtureBytes), sourcesText, DOCX_MIME]).catch((e) => ({ error: String(e) }));
    if (t9.error) {
      check("T9", "sources panel (toggle/remove/docx)", false, t9.error);
    } else {
      check("T9", "'Add full demo sources' toggles the bundled set in", t9.afterAdd && t9.labelOn === "Remove", `label "${t9.labelOn}", rows ${t9.before}→${t9.before + 4}`);
      check("T9", "toggle 'Remove' drops only the demo set", t9.afterRemove && t9.labelOff === "Add full demo sources", `label "${t9.labelOff}", rows back to ${t9.before}`);
      check("T9", "per-source remove drops one source", t9.afterOneRemoved, `removed "${t9.removedName}"`);
      check("T9", ".docx source read via hidden editor (native)", !!t9.docxRow, `row "${t9.docxRow}"`);
      check("T9", ".docx source removable", t9.docxSourceRemoved);
      check("T9", "restored set re-checks the brief", t9.reportAfter?.total === 4 && t9.reportAfter?.exact === 2, JSON.stringify(t9.reportAfter));
    }
  }

  /* --------------------- T5 (amendment A1: mandatory) --------------------- */
  {
    const t5 = await page.evaluate(async (span) => {
      const c = window.__citeCheck.editor().command;
      // native span: engine keyword locator → setRange → assert text (A4 style)
      const kw = c.getKeywordRangeList(span)?.[0];
      if (!kw) return { error: "keyword span not found" };
      c.executeSetRange(kw.startIndex - 1, kw.endIndex);
      const rangeText = String(c.getRangeText());
      if (rangeText !== span) return { error: `range text mismatch: ${rangeText.slice(0, 40)}` };
      const md0 = await c.executeExportMarkdown();
      await c.executeCopy();
      const clipboardText = await navigator.clipboard.readText();
      // set a range at the native end and paste (A1)
      c.executeSelectAll();
      const end = c.getRange().endIndex;
      c.executeSetRange(end, end);
      await c.executePaste();
      let md1 = md0, pasted = false;
      for (let i = 0; i < 200 && !pasted; i++) {
        await new Promise((r) => setTimeout(r, 50));
        md1 = await c.executeExportMarkdown();
        pasted = md1 !== md0;
      }
      const pasteAppeared = pasted && md1.trimEnd().endsWith(rangeText.trim());
      c.executeUndo();
      let md2 = md1, undone = false;
      for (let i = 0; i < 200 && !undone; i++) {
        await new Promise((r) => setTimeout(r, 50));
        md2 = await c.executeExportMarkdown();
        undone = md2 === md0;
      }
      return {
        rangeText, clipboardText, pasteAppeared, undone,
        nativeRangeAfterSet: c.getRange(),
        tail: md1.slice(-90),
      };
    }, T5_SPAN).catch((e) => ({ error: String(e) }));
    if (t5.error) {
      check("T5", "copy → paste → export/undo (A1)", false, t5.error);
    } else {
      check("T5", "native range over known span (A4)", t5.rangeText === T5_SPAN, `text ${t5.rangeText.length} chars`);
      check("T5", "executeCopy put the range text on the clipboard", t5.clipboardText?.trim() === t5.rangeText.trim(),
        `"${t5.clipboardText?.slice(0, 40)}…"`);
      check("T5", "executePaste appended it to the document (A1)", t5.pasteAppeared, JSON.stringify(t5.tail?.slice(-60)));
      check("T5", "one executeUndo removed the paste (A1)", t5.undone);
    }
  }

  /* --------------------------- T6 (annotate+undo) -------------------------- */
  {
    const t6 = await page.evaluate(async (q1) => {
      const cc = window.__citeCheck;
      const c = cc.editor().command;
      const md0 = await c.executeExportMarkdown();
      // highlight via the engine locator, asserted natively inside highlightQuote
      const range = cc.highlightQuote(q1, "exact");
      const highlighted = (c.getValue().data.main ?? []).some((el) => el.highlight === "#b6f09c");
      const r1 = cc.report().results.find((r) => r.id === "Q1");
      const info = cc.insertNote(r1);
      let md1 = md0, noted = false;
      for (let i = 0; i < 200 && !noted; i++) {
        await new Promise((r) => setTimeout(r, 50));
        md1 = await c.executeExportMarkdown();
        noted = md1.includes("cite-check ✓");
      }
      // two records (highlight, note insert) → two undos
      c.executeUndo(); // undo note insert
      c.executeUndo(); // undo highlight
      let md2 = md1, restored = false;
      for (let i = 0; i < 200 && !restored; i++) {
        await new Promise((r) => setTimeout(r, 50));
        md2 = await c.executeExportMarkdown();
        restored = md2 === md0 && !(c.getValue().data.main ?? []).some((el) => el.highlight);
      }
      c.executeRedo();
      c.executeRedo();
      let md3 = md2, redone = false;
      for (let i = 0; i < 200 && !redone; i++) {
        await new Promise((r) => setTimeout(r, 50));
        md3 = await c.executeExportMarkdown();
        redone = md3.includes("cite-check ✓") && (c.getValue().data.main ?? []).some((el) => el.highlight === "#b6f09c");
      }
      return { range, highlighted, noted, restored, redone, note: info.note, md0len: md0.length, md1len: md1.length };
    }, Q1).catch((e) => ({ error: String(e) }));
    if (t6.error) {
      check("T6", "annotate + undo + redo", false, t6.error);
    } else {
      check("T6", "highlight applied over asserted native range", t6.highlighted,
        `range ${t6.range?.startIndex}–${t6.range?.endIndex}`);
      check("T6", "verification note inserted (cite-check ✓)", t6.noted, t6.note);
      check("T6", "undo ×2 restored the pre-annotation document", t6.restored, `md ${t6.md1len} → ${t6.md0len}`);
      check("T6", "redo ×2 restored both annotations", t6.redone);
    }
  }

  /* ------------------ T7 (amendment A6: strengthened export) --------------- */
  {
    const t7 = await page.evaluate(async (readZipSrc) => {
      const bytes = await window.od.adapter.exportDocx();
      const readZipEntry = eval("(" + readZipSrc + ")");
      const xml = await readZipEntry(bytes, "word/document.xml");
      return {
        size: bytes.length,
        pk: bytes[0] === 0x50 && bytes[1] === 0x4b,
        hasDocumentXml: xml.length > 0,
        xmlLen: xml.length,
        noteMarker: xml.includes("cite-check ✓"),
        highlightRun: /w:shd w:val="clear"[^/]*w:fill="B6F09C"|w:fill="B6F09C"/.test(xml),
      };
    }, readZipEntryInPage.toString()).catch((e) => ({ error: String(e) }));
    if (t7.error) {
      check("T7", "native export (A6)", false, t7.error);
    } else {
      check("T7", "PK magic + >10KB", t7.pk && t7.size > 10_000, `${t7.size} bytes`);
      check("T7", "zip contains word/document.xml", t7.hasDocumentXml, `${t7.xmlLen} chars`);
      check("T7", "document.xml contains the note marker", t7.noteMarker, "cite-check ✓");
      check("T7", "document.xml contains a highlight run", t7.highlightRun, 'w:fill="B6F09C"');
    }
  }

  /* ------------------- A3 marker-free document: 0 rows --------------------- */
  {
    const mf = new Uint8Array(await (await fetch(`${BASE}/api/cite-check/marker-free.docx`)).arrayBuffer());
    const out = await page.evaluate(async (arr) => {
      const rep = await window.__citeCheck.importDocx(new Uint8Array(arr), "marker-free.docx");
      const rows = document.querySelectorAll("#cc-quotes .cc-quote").length;
      return { total: rep.summary.total, rows, realText: window.__citeCheck.lastInput().document.text.includes("Meridian Logistics") };
    }, Array.from(mf));
    check("T4", "marker-free docx yields 0 rows (A3)", out.total === 0 && out.rows === 0 && out.realText,
      `total ${out.total}, rows ${out.rows}, from real text: ${out.realText}`);
  }
} finally {
  /* --------------------------------- T8 ----------------------------------- */
  const ce = await fetch(`${BASE}/e/canvas-editor`);
  const landing = await (await fetch(`${BASE}/`)).text();
  check("T8", "/e/canvas-editor still 200", ce.status === 200, `status ${ce.status}`);
  check("T8", "landing lists cite-check", landing.includes("cite-check"));
  check("T8", "no page errors during the run", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | ") || "clean");
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed${failed.length ? " — FAILED: " + failed.map((f) => f.id + " " + f.name).join("; ") : ""}`);
process.exit(failed.length ? 1 : 0);
