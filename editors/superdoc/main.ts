/**
 * SuperDoc — Vue + Konva + pdfjs behind one bundle (12 MB). AGPL-3.0.
 *
 * DOCUMENT SWAPPING: don't try.
 *
 * SuperDoc's `replaceFile` delegates to `adapter?.replaceFile ?? adapter?.loadDocument
 * ?? adapter?.reload`, and that adapter is absent for a plain `new SuperDoc({...})`
 * mount — hence "SuperDoc: replaceFile is unavailable for the active editor".
 * So `load()` destroys the instance and constructs a new one with the new file.
 * Slower, but it is the only path that works for every entry point.
 */
import { waitFor } from "/lib/kit.ts";

const CDN = "https://esm.sh/superdoc@2.29.0?bundle&target=es2022";
// VERIFIED 200 / text/css / 106 KB.
const CSS = "https://cdn.jsdelivr.net/npm/superdoc@2.29.0/dist/style.css";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

let mod: any;
let instance: any;
let host: HTMLElement | undefined;

function ensureCss() {
  if (document.querySelector("link[data-superdoc]")) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = CSS;
  link.dataset.superdoc = "1";
  document.head.append(link);
}

function toFile(bytes: Uint8Array): File {
  return new File([bytes.slice(0) as Uint8Array], "document.docx", {
    type: DOCX_MIME,
  });
}

async function toBytes(out: any): Promise<Uint8Array> {
  if (out instanceof Uint8Array) return out;
  if (out instanceof ArrayBuffer) return new Uint8Array(out);
  if (out?.blob instanceof Blob) return new Uint8Array(await out.blob.arrayBuffer());
  if (out instanceof Blob) return new Uint8Array(await out.arrayBuffer());
  if (out?.arrayBuffer) return new Uint8Array(await out.arrayBuffer());
  throw new Error("SuperDoc export() returned no bytes");
}

function activeEditor(): any {
  return instance?.activeEditor ?? instance?.editor ?? instance;
}

/** Tear down and mount a fresh SuperDoc around `bytes`. */
async function mountWith(bytes: Uint8Array): Promise<void> {
  if (!host) throw new Error("SuperDoc host missing");
  if (!mod) mod = await import(CDN);
  ensureCss();

  try {
    instance?.destroy?.();
  } catch { /* ignore */ }
  instance = undefined;

  const mount = document.getElementById("sd-editor");
  if (!mount) throw new Error("SuperDoc mount point missing (#sd-editor)");
  mount.innerHTML = "";

  instance = new mod.SuperDoc({
    selector: "#sd-editor",
    document: toFile(bytes),
    documentMode: "editing",
  });

  // `new SuperDoc()` is synchronous but the document loads asynchronously;
  // give it a beat so an immediate export() has something to read.
  await new Promise((r) => setTimeout(r, 0));
}

window.od.register({
  name: "SuperDoc",
  mergeQuality: "html-paste",

  async mount() {
    host = await waitFor<HTMLDivElement>("#sd-host");
    ensureCss();
    host.innerHTML =
      `<div id="sd-editor" style="height:100%;min-height:70vh"></div>` +
      `<div id="sd-status" style="padding:8px 12px;color:#6b7280;font:12px ui-sans-serif">Loading SuperDoc (12 MB)…</div>`;

    // Start blank with our own generated package — `BlankDOCX` is a re-export
    // whose runtime shape isn't a Uint8Array, so we don't rely on it.
    await mountWith(await window.od.blankDocx());
    document.getElementById("sd-status")?.remove();
    window.od.status("SuperDoc ready", "ok");
  },

  async load(bytes: Uint8Array) {
    await mountWith(bytes);
  },

  async getMarkdown() {
    const ed = activeEditor();
    const html: string = ed?.getHTML?.() ?? "";
    if (!html) return "";
    return htmlToMarkdown(html);
  },

  async applyMarkdown(markdown) {
    const ed = activeEditor();
    const html = window.od.md.mdToHtml(markdown);
    if (ed?.commands?.setContent) {
      ed.commands.setContent(html);
      return;
    }
    if (ed?.chain) {
      ed.chain().focus().selectAll().insertContent(html).run();
      return;
    }
    throw new Error("no write path on this SuperDoc build");
  },

  async exportDocx() {
    if (!instance) throw new Error("SuperDoc not mounted");
    const out = await instance.export({ exportType: "docx" });
    return await toBytes(out);
  },
});

/* --------------------------- HTML → markdown ----------------------------- */

function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const out: string[] = [];
  for (const el of Array.from(doc.body.querySelectorAll("*"))) {
    const tag = el.tagName.toLowerCase();
    if (!/^h[1-6]$|^p$|^li$/.test(tag)) continue;
    if (tag === "p" && el.closest("li")) continue;
    const text = (el.textContent ?? "").trim();
    if (!text) continue;
    if (tag === "li") out.push(`- ${text}`);
    else if (tag === "h1") out.push(`# ${text}`);
    else if (tag === "h2") out.push(`## ${text}`);
    else if (tag === "h3") out.push(`### ${text}`);
    else if (/^h[4-6]$/.test(tag)) out.push(`#### ${text}`);
    else out.push(text);
  }
  return out.join("\n\n");
}
