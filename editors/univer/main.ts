/**
 * Univer's document editor (open-source Web SDK, documents preset), drawn on a canvas.
 *
 *   createUniver({ presets: [UniverDocsCorePreset({ container })] }) → univerAPI
 *   univerAPI.createDocument(data), getActiveDocument(), disposeUnit(id)
 *   document.getBody(), undo(), redo()
 *
 * It has no .docx reader or writer: Office import and export are in Univer's separately
 * distributed Server SDK. So a .docx reaches it as text read by this site
 * (lib/docx-markdown.ts → lib/univer-doc.ts): paragraphs, headings, bold / italic and typed
 * list markers. Tables, pictures, fonts and page set-up do not carry over, and there is no
 * .docx export. A replaced document is a new one, so the assistant offers no Undo.
 */
import { createUniver, LocaleType, mergeLocales, NamedStyleType } from "https://esm.sh/@univerjs/presets@1.5.2?deps=react@18.3.1,react-dom@18.3.1,rxjs@7.8.1&target=es2022";
import { UniverDocsCorePreset } from "https://esm.sh/@univerjs/preset-docs-core@1.5.2?deps=react@18.3.1,react-dom@18.3.1,rxjs@7.8.1&target=es2022";
import enUS from "https://esm.sh/@univerjs/preset-docs-core@1.5.2/locales/en-US?deps=react@18.3.1,react-dom@18.3.1,rxjs@7.8.1&target=es2022";
import { waitFor } from "/lib/kit.ts";
import { REVISION_NOTES } from "/lib/revision-notes.ts";
import { markdownToBlocks } from "/lib/markdown.ts";
import { docxToMarkdown } from "/lib/docx-markdown.ts";
import { blocksToUniverBody, type HeadingStyles, univerBodyToMarkdown } from "/lib/univer-doc.ts";

const N = NamedStyleType as unknown as Record<string, number>;
const HEADINGS: HeadingStyles = {
  1: N.HEADING_1, 2: N.HEADING_2, 3: N.HEADING_3, 4: N.HEADING_4, 5: N.HEADING_5, 6: N.HEADING_5,
};

type Doc = { getId(): string; getBody(): Parameters<typeof univerBodyToMarkdown>[0]; undo(): boolean; redo(): boolean };
type Api = { createDocument(data: unknown): unknown; getActiveDocument(): Doc | null; disposeUnit(id: string): boolean };

let api: Api | undefined;
// Exposed for the probes in /lib/probes (read-only use).
(window as unknown as { __univer?: () => Api | undefined }).__univer = () => api;

const doc = () => {
  const d = api?.getActiveDocument();
  if (!d) throw new Error("Univer has no document");
  return d;
};

/** Replace the open document with one made from Markdown. */
function show(markdown: string) {
  if (!api) throw new Error("Univer not mounted");
  const old = api.getActiveDocument();
  api.createDocument({ body: blocksToUniverBody(markdownToBlocks(markdown), HEADINGS) });
  if (old) api.disposeUnit(old.getId());
}

window.od.register({
  name: "Univer",
  revisions: REVISION_NOTES["univer"],
  applyInHistory: false,
  mergeQuality: "rebuild",

  async mount() {
    await waitFor<HTMLDivElement>("#univer-root");
    const made = createUniver({
      locale: LocaleType.EN_US,
      locales: { [LocaleType.EN_US]: mergeLocales(enUS) },
      presets: [UniverDocsCorePreset({ container: "univer-root" })],
    });
    api = made.univerAPI as unknown as Api;
    const v = window.od.viewer;
    show(v ? docxToMarkdown(await v.initialDocx()) : "");
    await waitFor("#univer-root canvas");
  },

  // Text only, through this site's reader: Univer's open-source packages have no .docx reader.
  // deno-lint-ignore require-await
  async load(bytes: Uint8Array) {
    show(docxToMarkdown(bytes));
  },

  // deno-lint-ignore require-await
  async getMarkdown() {
    return univerBodyToMarkdown(doc().getBody(), HEADINGS);
  },

  // deno-lint-ignore require-await
  async applyMarkdown(markdown: string) {
    show(markdown);
  },

  undo: () => void doc().undo(),
  redo: () => void doc().redo(),
});
