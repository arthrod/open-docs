/**
 * End-to-end probe for one editor page: rich sample → assistant edit through
 * the real chat box → read back → Export .docx (the user's document, not the
 * sample) → the edit is inside the exported word/document.xml.
 *
 *   window.__ai = null; eval(await (await fetch('/lib/probes/ai-export.js',{cache:'no-store'})).text());
 *   // then poll window.__ai until .done
 *
 * Runs in the background (the chrome extension's evaluate times out at 45 s;
 * a model round trip can take longer) and leaves its result in window.__ai.
 */
(() => {
  const r = (window.__ai = { done: false, steps: [] });
  const step = (s) => r.steps.push(`${Math.round(performance.now())}ms ${s}`);
  const wait = (ms) => new Promise((x) => setTimeout(x, ms));
  const until = async (fn, ms, what) => {
    const t = performance.now();
    while (performance.now() - t < ms) { const v = await fn(); if (v) return v; await wait(250); }
    throw new Error(`timed out: ${what}`);
  };
  const MARK = `Signed off by the site lead on ${new Date().toISOString().slice(0, 10)}`;
  (async () => {
    await until(() => document.querySelector("#od-metrics.ok") && window.od.adapter, 90000, "editor ready");
    const a = window.od.adapter;
    step("ready");
    document.getElementById("od-showcase").click();
    await until(() => /Loaded the rich sample/.test(document.getElementById("od-status").textContent), 30000, "showcase loaded");
    const before = await a.getMarkdown();
    r.loadedHasTable = /\|\s*(\*\*)?String(\*\*)?\s*\|/.test(before);
    r.loadedChars = before.length;
    step("showcase loaded");
    const auto = document.getElementById("od-autoapply"); if (auto && !auto.checked) auto.click();
    const input = document.getElementById("od-prompt");
    input.value = `Add a short final section with the heading "Sign-off" (heading level 1) containing exactly this sentence: "${MARK}." Keep everything else unchanged.`;
    // Only cards and errors created by THIS prompt count (earlier runs leave theirs).
    const before0 = new Set(document.querySelectorAll(".od-edit, .od-msg.err"));
    const fresh = (sel) => [...document.querySelectorAll(sel)].find((n) => !before0.has(n));
    document.getElementById("od-form").requestSubmit();
    await until(() => fresh(".od-edit.applied") || fresh(".od-msg.err"), 150000, "edit applied");
    const err = fresh(".od-msg.err");
    if (err) throw new Error(`assistant: ${err.textContent}`);
    step("edit applied");
    const after = await a.getMarkdown();
    r.readBackHasMark = after.includes(MARK);
    r.readBackHasHeading = /^#\s+Sign-off/m.test(after);
    r.readBackKeptTable = /\|\s*(\*\*)?String(\*\*)?\s*\|/.test(after);
    // Export through the chrome's own button, catching the download.
    let bytes;
    const orig = window.od.download;
    window.od.download = (b) => { bytes = b; };
    try {
      document.getElementById("od-export").click();
      await until(() => bytes, 30000, "export");
    } finally { window.od.download = orig; }
    step("exported");
    const { unzipSync, strFromU8 } = await import("https://esm.sh/fflate@0.8.2");
    const xml = strFromU8(unzipSync(bytes)["word/document.xml"]);
    const text = xml.replace(/<w:tab\/>/g, "\t").replace(/<\/w:p>/g, "\n").replace(/<[^>]+>/g, "");
    r.exportBytes = bytes.length;
    r.exportHasMark = text.includes(MARK);
    r.exportHasShowcase = text.includes("Coastal Wind Farm");
    r.exportHasTable = xml.includes("<w:tbl>") || xml.includes("<w:tbl ");
  })().catch((e) => { r.error = String(e && e.message || e); }).finally(() => { r.done = true; step("done"); });
  return "started";
})();
