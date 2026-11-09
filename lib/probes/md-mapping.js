(async () => {
const MD = `# Alpha Heading

## Beta Sub

Plain with **boldword** and *italword* and \`codeword\` and [linktext](https://example.com/x).

- bullet one
- bullet two

1. num one
2. num two

> quoted text`;
const A = window.od.adapter;
await A.applyMarkdown(MD);
await new Promise(r => setTimeout(r, 2500));
const bytes = await A.exportDocx();
const { unzipSync, strFromU8 } = await import("https://esm.sh/fflate@0.8.2");
const z = unzipSync(bytes);
const P = new DOMParser();
const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const doc = P.parseFromString(strFromU8(z["word/document.xml"]), "application/xml");
const styles = z["word/styles.xml"] ? P.parseFromString(strFromU8(z["word/styles.xml"]), "application/xml") : null;
const sty = {};
if (styles) for (const s of styles.getElementsByTagNameNS(W, "style")) {
  const id = s.getAttributeNS(W, "styleId") || s.getAttribute("w:styleId");
  const nm = s.getElementsByTagNameNS(W, "name")[0];
  sty[id] = { name: nm ? (nm.getAttributeNS(W, "val") || nm.getAttribute("w:val")) : id,
    outline: s.getElementsByTagNameNS(W, "outlineLvl").length > 0,
    bold: s.getElementsByTagNameNS(W, "b").length > 0, ital: s.getElementsByTagNameNS(W, "i").length > 0,
    font: [...s.getElementsByTagNameNS(W, "rFonts")].map(f => f.getAttribute("w:ascii")).join(",") };
}
const val = (el, tag) => { const e = el?.getElementsByTagNameNS(W, tag)[0]; return e ? (e.getAttribute("w:val") ?? "") : null; };
const paras = [...doc.getElementsByTagNameNS(W, "p")].map(p => {
  const ppr = p.getElementsByTagNameNS(W, "pPr")[0];
  const ps = ppr ? val(ppr, "pStyle") : null;
  const runs = [...p.getElementsByTagNameNS(W, "r")].map(r => {
    const rpr = r.getElementsByTagNameNS(W, "rPr")[0];
    const rs = rpr ? val(rpr, "rStyle") : null;
    const on = (t) => { if (!rpr) return false; const e = rpr.getElementsByTagNameNS(W, t)[0]; if (!e) return false; const v = e.getAttribute("w:val"); return v !== "0" && v !== "false"; };
    const font = rpr ? [...rpr.getElementsByTagNameNS(W, "rFonts")].map(f => f.getAttribute("w:ascii")).join(",") : "";
    let a = r.parentNode, link = false; while (a && a !== p) { if (a.localName === "hyperlink") link = true; a = a.parentNode; }
    if (!link) { const ins = r.getElementsByTagNameNS(W, "instrText")[0]; if (ins && /HYPERLINK/.test(ins.textContent)) link = true; }
    return { t: [...r.getElementsByTagNameNS(W, "t")].map(t => t.textContent).join(""), b: on("b") || !!sty[rs]?.bold, i: on("i") || !!sty[rs]?.ital,
      mono: /mono|courier|consol|menlo/i.test(font + (sty[rs]?.font || "")) || /code/i.test(rs || ""), link: link || /hyperlink/i.test(rs || "") };
  });
  return { text: runs.map(r => r.t).join(""), style: ps ? (sty[ps]?.name || ps) : "", outline: (ps && sty[ps]?.outline) || (ppr && ppr.getElementsByTagNameNS(W, "outlineLvl").length > 0),
    num: !!(ppr && ppr.getElementsByTagNameNS(W, "numPr").length) || /list/i.test(ps || ""), ind: !!(ppr && ppr.getElementsByTagNameNS(W, "ind").length), runs };
});
const find = (s) => paras.find(p => p.text.includes(s));
const run = (s) => paras.flatMap(p => p.runs).find(r => r.t.includes(s));
const hd = (p) => !!p && (p.outline || /heading|title/i.test(p.style));
const R = {
  h1: hd(find("Alpha Heading")) ? "✓ " + find("Alpha Heading").style : "✗ " + (find("Alpha Heading")?.style ?? "missing"),
  h2: hd(find("Beta Sub")) ? "✓ " + find("Beta Sub").style : "✗ " + (find("Beta Sub")?.style ?? "missing"),
  bold: run("boldword")?.b ? "✓" : "✗", italic: run("italword")?.i ? "✓" : "✗",
  code: run("codeword")?.mono ? "✓" : "✗", link: run("linktext")?.link ? "✓" : "✗",
  bullet: find("bullet one")?.num ? "✓" : "✗", numbered: find("num one")?.num ? "✓" : "✗",
  quote: (() => { const q = find("quoted text"); return q && (/quote/i.test(q.style) || q.ind) ? "✓ " + q.style : "✗ " + (q?.style ?? "missing"); })(),
  leftoverMarkdown: paras.filter(p => /\*\*|^#|^> |^- |\[linktext\]|`/.test(p.text)).map(p => p.text.slice(0, 40)),
};
// What the assistant reads back: heading levels and marks must survive, or
// every assistant turn would drift the document (e.g. Heading 1 → "##").
const back = await A.getMarkdown();
const expect = { h1: /^# Alpha Heading/m, h2: /^## Beta Sub/m, bold: /\*\*boldword\*\*/, italic: /(^|[^*])[*_]italword[*_]/,
  code: /`codeword`/, link: /\[linktext\]\(https:\/\/example\.com\/x\)/, bullet: /^\s*[-*+] bullet one/m, numbered: /^\s*1[.)] num one/m, quote: /^> quoted text/m };
R.readBack = Object.entries(expect).filter(([, re]) => !re.test(back)).map(([k]) => "✗ " + k).join(" ") || "✓ all";
if (R.readBack !== "✓ all") R.readBackText = back.slice(0, 400);
return R;
})()
