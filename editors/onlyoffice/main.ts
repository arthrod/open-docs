/**
 * OnlyOffice's document editor with no document server, as CryptPad runs it:
 *   - cryptpad/onlyoffice-x2t-wasm: OnlyOffice's converter (x2t) in WebAssembly turns a .docx into
 *     the editor's own binary format and back, in this page;
 *   - cryptpad/onlyoffice-editor: the editor (web-apps + sdkjs), built so that the co-editing
 *     socket is replaced by messages to the embedding page (`connectMockServer`).
 * Both are read out of CryptPad's release archives at tag v9.3.2+3 (server/onlyoffice.ts).
 * AGPL-3.0: the sources are the two repositories at that tag, and this file is the whole wrapper.
 *
 * An assistant edit opens a newly built .docx in a new editor (no Undo is offered for it).
 */
import { waitFor } from "/lib/kit.ts";
import { REVISION_NOTES } from "/lib/revision-notes.ts";
import { markdownToDocx } from "/lib/plate-docx.ts";
import { docxToMarkdown } from "/lib/docx-markdown.ts";

const BASE = `${location.origin}${window.od.vendorRoot ?? ""}/vendor/onlyoffice/9.3.2-3/`;
const W = "/working/";

type FS = {
  mkdir(p: string): void;
  writeFile(p: string, d: Uint8Array | string): void;
  readFile(p: string): Uint8Array;
  readdir(p: string): string[];
  unlink(p: string): void;
};
type X2T = { FS: FS; ccall(name: string, ret: string, types: string[], args: unknown[]): number; onRuntimeInitialized?: () => void };
type OOMessage = { type: string };
type DocEditor = {
  connectMockServer(server: Record<string, unknown>): void;
  sendMessageToOO(message: unknown): void;
  destroyEditor(): void;
};
type Api = { asc_nativeGetFile(): string | Uint8Array; Undo?(): void; Redo?(): void };
type Host = Window & typeof globalThis & {
  Module?: X2T;
  APP?: Record<string, unknown>;
  DocsAPI?: { DocEditor: new (id: string, config: unknown) => DocEditor };
};
const host = window as Host;

const script = (src: string) =>
  new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src; // absolute: x2t.js reads its own address from document.currentScript
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`could not load ${src}`));
    document.head.append(s);
  });

let starting: Promise<X2T> | undefined;
// A failed start is not kept: the next call tries again.
const converter = () => (starting ??= startConverter().catch((err) => {
  starting = undefined;
  throw err;
}));
async function startConverter(): Promise<X2T> {
  await script(`${BASE}x2t/x2t.js`);
  const m = host.Module;
  if (!m) throw new Error("the x2t converter did not start");
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("the x2t converter did not initialise within 90 s")), 90_000);
    const ready = () => {
      clearTimeout(timer);
      resolve();
    };
    // Set in the same task the script ran in, as CryptPad does: the wasm cannot have started yet.
    m.onRuntimeInitialized = ready;
  });
  for (const dir of ["/working", "/working/media", "/working/fonts", "/working/themes"]) {
    try {
      m.FS.mkdir(dir);
    } catch { /* exists */ }
  }
  return m;
}

/** x2t infers both formats from the file extensions, as CryptPad calls it. */
function convert(m: X2T, name: string, data: Uint8Array | string, to: string): Uint8Array {
  const out = `${W}${name}.${to}`;
  try {
    m.FS.unlink(out);
  } catch { /* first conversion */ }
  m.FS.writeFile(W + name, data);
  m.FS.writeFile(
    `${W}params.xml`,
    `<?xml version="1.0" encoding="utf-8"?><TaskQueueDataConvert xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">` +
      `<m_sFileFrom>${W}${name}</m_sFileFrom><m_sThemeDir>${W}themes</m_sThemeDir><m_sFileTo>${out}</m_sFileTo>` +
      `<m_bIsNoBase64>false</m_bIsNoBase64></TaskQueueDataConvert>`,
  );
  m.ccall("main1", "number", ["string"], [`${W}params.xml`]);
  try {
    return m.FS.readFile(out);
  } catch {
    throw new Error(`x2t could not convert ${name} to ${to}`);
  }
}

let root: HTMLDivElement | undefined;
let editor: DocEditor | undefined;
let media: Record<string, string> = {};
let opened = 0;
/** Settles the open() still waiting when a newer one replaces its editor. */
let superseded: (() => void) | undefined;

const api = (): Api => {
  const frame = root?.querySelector("iframe") as HTMLIFrameElement | null;
  const a = (frame?.contentWindow as (Window & { editor?: Api }) | null)?.editor;
  if (!a) throw new Error("OnlyOffice not mounted");
  return a;
};

async function open(bytes: Uint8Array) {
  const m = await converter();
  const turn = ++opened;
  for (const f of m.FS.readdir(`${W}media`)) if (!f.startsWith(".")) m.FS.unlink(`${W}media/${f}`);
  const bin = convert(m, "doc.docx", bytes, "bin");
  for (const url of Object.values(media)) URL.revokeObjectURL(url);
  media = {};
  for (const f of m.FS.readdir(`${W}media`)) {
    if (!f.startsWith(".")) media[f] = URL.createObjectURL(new Blob([m.FS.readFile(`${W}media/${f}`).slice()]));
  }
  superseded?.(); // the document it was waiting for will never be shown
  editor?.destroyEditor();
  root!.innerHTML = `<div id="oo-holder"></div>`;
  host.APP ??= {}; // sdkjs reads parent.APP
  const readOnly = !!window.od.viewer;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("OnlyOffice did not show the document within 120 s")), 120_000);
    const done = (err?: Error) => {
      clearTimeout(timer);
      if (superseded === finish) superseded = undefined;
      err ? reject(err) : resolve();
    };
    const finish = () => done();
    superseded = finish;
    const ed = new host.DocsAPI!.DocEditor("oo-holder", {
      document: {
        fileType: "docx",
        key: "fresh",
        title: "document.docx",
        url: URL.createObjectURL(new Blob([bin.slice()])),
        permissions: { download: false, print: true, edit: !readOnly, review: !readOnly, comment: !readOnly },
      },
      documentType: "word",
      width: "100%",
      height: "100%",
      editorConfig: {
        mode: readOnly ? "view" : "edit",
        lang: "en",
        user: { id: "1", firstname: "You", name: "You" },
        customization: { compactHeader: true, chat: false, hideRightMenu: true, uiTheme: "theme-classic-light" },
      },
      events: {
        onDocumentReady: () => turn === opened && done(),
        onError: (e: { data?: { errorDescription?: string } }) => turn === opened && done(new Error(`OnlyOffice: ${e?.data?.errorDescription ?? "error"}`)),
      },
    });
    editor = ed;
    let saves = 0;
    const send = (message: unknown) => ed.sendMessageToOO(message);
    ed.connectMockServer({
      getParticipants: () => ({
        index: 1,
        list: [{ id: "11", idOriginal: "1", username: "You", indexUser: 1, connectionId: "c", isCloseCoAuthoring: false, view: readOnly }],
      }),
      getInitialChanges: () => [],
      getImageURL: (name: string) => Promise.resolve(media[name] ?? media[name.replace(/^media\//, "")] ?? ""),
      // The replies CryptPad's own page gives, with nobody else in the document.
      onMessage(m: OOMessage) {
        if (m.type === "isSaveLock") send({ type: "saveLock", saveLock: false });
        else if (m.type === "saveChanges") send({ type: "unSaveLock", index: saves++, time: Date.now() });
        else if (m.type === "getLock") send({ type: "getLock", locks: {} });
        else if (m.type === "getMessages") send({ type: "message" });
      },
    });
  });
}

async function saved(): Promise<Uint8Array> {
  const bin = api().asc_nativeGetFile();
  return convert(await converter(), "out.bin", bin, "docx").slice();
}

window.od.register({
  name: "OnlyOffice (CryptPad build)",
  revisions: REVISION_NOTES["onlyoffice"],
  applyInHistory: false,
  mergeQuality: "rebuild",
  // The editor's files load inside its frame, where this page's Resource Timing cannot see them.
  get extraResources() {
    try {
      const frame = root?.querySelector("iframe") as HTMLIFrameElement | null;
      return (frame!.contentWindow!.performance.getEntriesByType("resource") as PerformanceResourceTiming[]).map((e) => e.name);
    } catch {
      return [];
    }
  },

  async mount() {
    root = await waitFor<HTMLDivElement>("#oo-root");
    await Promise.all([converter(), script(`${BASE}web-apps/apps/api/documents/api.js`)]);
    if (!host.DocsAPI) throw new Error("OnlyOffice's API script did not load");
    const v = window.od.viewer;
    await open(v ? await v.initialDocx() : await window.od.blankDocx());
  },

  load: (bytes: Uint8Array) => open(bytes),
  getMarkdown: async () => docxToMarkdown(await saved()),
  applyMarkdown: async (markdown: string) => open(await markdownToDocx(markdown)),
  exportDocx: () => saved(),
  undo: () => Promise.resolve(api().Undo?.()),
  redo: () => Promise.resolve(api().Redo?.()),
});
