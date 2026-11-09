const css = await (await fetch("https://cdn.jsdelivr.net/npm/@stll/folio-vue@0.28.0/dist/folio-vue.css")).text();
const out: string[] = [];
for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
  const z = /z-index:\s*([^;]+)/.exec(m[2])?.[1];
  const pos = /position:\s*(sticky|fixed|absolute|relative)/.exec(m[2])?.[1];
  const ov = /overflow[^:]*:\s*(hidden|auto|clip)/.exec(m[2])?.[1];
  if (!z && pos !== "sticky") continue;
  out.push(`z=${(z ?? "-").padEnd(6)} ${String(pos ?? "").padEnd(8)} ${String(ov ?? "").padEnd(6)} ${m[1].trim().replace(/\s+/g, " ").slice(0, 100)}`);
}
console.log(out.join("\n"));
// root-ish layout selectors
for (const m of css.matchAll(/(\.docx-editor-vue(?:__[\w-]+)?)\s*\{([^}]*)\}/g)) {
  if (/toolbar|header|chrome|top|main|root|menubar|title/.test(m[1]) || m[1] === ".docx-editor-vue") {
    console.log("L", m[1], "{", m[2].replace(/\s+/g, " ").slice(0, 160), "}");
  }
}
