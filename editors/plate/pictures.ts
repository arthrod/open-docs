/**
 * Pictures for Plate's .docx import. DOM-free: used by the browser adapter
 * (docx.ts) and by the open-docs viewer's server renderer.
 *
 * mammoth turns each picture into <img src="data:…"> but drops the size Word
 * shows it at and its paragraph's alignment. Both are in word/document.xml:
 * one wp:extent per DrawingML picture, in document order (the order mammoth
 * emits its <img>s), and the w:jc of the paragraph that holds it.
 */
export type Picture = { width: number; align?: "center" | "right" };

const EMU_PER_PX = 9525;

/** Every DrawingML picture in document.xml, in order: CSS width and alignment. */
export function pictureLayout(documentXml: string): Picture[] {
  return [...documentXml.matchAll(/<w:drawing>[\s\S]*?<\/w:drawing>/g)]
    .filter((d) => d[0].includes("<pic:pic"))
    .map((d) => {
      const cx = Number(/<wp:extent cx="(\d+)"/.exec(d[0])?.[1] ?? 0);
      // The enclosing paragraph's properties: from its <w:p> to </w:pPr>, if before the picture.
      const pStart = Math.max(documentXml.lastIndexOf("<w:p>", d.index), documentXml.lastIndexOf("<w:p ", d.index));
      const head = documentXml.slice(pStart, d.index);
      const pPr = head.includes("</w:pPr>") ? head.slice(0, head.indexOf("</w:pPr>")) : /<w:pPr\/>/.test(head) ? "" : head.split("<w:r")[0];
      const jc = /<w:jc w:val="(\w+)"/.exec(pPr)?.[1];
      const align = jc === "center" ? "center" : jc === "right" || jc === "end" ? "right" : undefined;
      return { width: Math.round(cx / EMU_PER_PX), ...(align ? { align } : {}) } as Picture;
    });
}

const PICTURE_URL = /^data:image\/(png|jpe?g|gif|webp|bmp|svg\+xml);base64,/;

/** A Plate image node (block void) for one of mammoth's <img>s; null if its URL is not an inline picture. */
export function imageNode(src: string, alt: string, pic?: Picture) {
  if (!PICTURE_URL.test(src)) return null;
  return {
    type: "img",
    url: src,
    ...(pic?.width ? { width: pic.width } : {}),
    ...(pic?.align ? { align: pic.align } : {}),
    ...(alt ? { alt } : {}),
    children: [{ text: "" }],
  };
}
