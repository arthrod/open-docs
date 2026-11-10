/**
 * .docx out through Plate's own exporter (@platejs/docx-io's exportToDocx),
 * never a hand-written writer.
 *
 *   plateValueToDocx  Plate's Export .docx.
 *   markdownToDocx    the assistant's markdown for engines with no markdown
 *                     import of their own (Docxodus, docx-editor.dev, folio):
 *                     markdown → Plate nodes (@platejs/markdown) → .docx; the
 *                     engine then opens it with its own .docx reader.
 *
 * docx-io is loaded from tools/plate-docx-io (a browser bundle of the package,
 * see its README) at a pinned commit; the page import map carries its SRI hash
 * (server/router.ts), so a changed file is refused.
 */
import { MARKDOWN, REMARK_GFM } from "/editors/plate/deps.ts";
import { DOCX_IO_URL } from "./plate-docx-pin.ts";

/** Plate nodes → .docx with Plate's exporter, rendered through Plate's static components. */
export async function plateValueToDocx(value: any[]): Promise<Uint8Array> {
  const [{ exportToDocx }, { STATIC_PLUGINS }] = await Promise.all([import(DOCX_IO_URL), import("/editors/plate/static.ts")]);
  // Calibri: the face every editor here shows; docx-io's default is Times New Roman.
  const blob: Blob = await exportToDocx(value, { editorPlugins: STATIC_PLUGINS, fontFamily: "Calibri" });
  return new Uint8Array(await blob.arrayBuffer());
}

/** Markdown → Plate nodes (Plate's own deserializer, GFM) → .docx (Plate's own exporter). */
export async function markdownToDocx(markdown: string): Promise<Uint8Array> {
  const [{ STATIC_PLUGINS, createSlateEditor }, Md, gfm] = await Promise.all([
    import("/editors/plate/static.ts"),
    import(MARKDOWN),
    import(REMARK_GFM),
  ]);
  const editor = createSlateEditor({
    plugins: [...STATIC_PLUGINS, Md.MarkdownPlugin.configure({ options: { remarkPlugins: [gfm.default ?? gfm, Md.remarkMdx] } })],
  });
  return plateValueToDocx(editor.api.markdown.deserialize(markdown));
}
