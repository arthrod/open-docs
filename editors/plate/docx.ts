/**
 * Plate's DOCX bridge.
 *
 * Plate has no DOCX engine. It has `@platejs/docx-io`, which is a *conversion*
 * layer: mammoth in (DOCX → HTML → editor nodes) and html-to-docx out
 * (editor nodes → HTML → DOCX). That difference is the point of this bench
 * entry: edits round-trip through HTML, so Word-specific constructs (fields,
 * content controls, footnotes, comments) are not preserved the way Docxodus or
 * SuperDoc preserve them.
 */
import type { Descendant } from "https://esm.sh/platejs@53.5.2?bundle-deps&external=react,react-dom";

const IO = "https://esm.sh/@platejs/docx-io@53.5.5?bundle-deps";

let io: any;

async function docxIo() {
  if (!io) io = await import(IO);
  return io;
}

/** Real DOCX bytes in → Plate nodes. Uses mammoth under the hood. */
export async function importDocxToNodes(
  editor: any,
  bytes: Uint8Array,
): Promise<Descendant[]> {
  const { importDocx } = await docxIo();
  // Copy into a fresh ArrayBuffer: mammoth chokes on SharedArrayBuffer views.
  const buf = new Uint8Array(bytes).buffer;
  const result = await importDocx(editor, buf);
  return result.nodes as Descendant[];
}

/** Plate nodes → real DOCX bytes. Serializes to HTML then packages with docx. */
export async function nodesToDocx(
  value: Descendant[],
  title: string,
): Promise<Uint8Array> {
  const { exportToDocx } = await docxIo();
  const blob: Blob = await exportToDocx(value as any, {
    title,
    fontFamily: "Calibri",
    paragraphSpacing: { after: 120 },
  } as any);
  return new Uint8Array(await blob.arrayBuffer());
}

/* --------------------- markdown ⇄ Plate nodes --------------------------- */

export function markdownToNodes(markdown: string): Descendant[] {
  const nodes: any[] = [];
  for (const block of window.od.md.mdToBlocks(markdown)) {
    const text = { text: block.text };
    switch (block.type) {
      case "title":
        nodes.push({ type: "h1", children: [text] });
        break;
      case "h1":
        nodes.push({ type: "h2", children: [text] });
        break;
      case "h2":
      case "h3":
        nodes.push({ type: "h3", children: [text] });
        break;
      case "li":
        nodes.push({
          type: "p",
          indent: Math.max((block.level ?? 1) - 1, 0),
          listStyleType: "disc",
          children: [text],
        });
        break;
      default:
        nodes.push({ type: "p", children: [text] });
    }
  }
  return nodes.length ? nodes : [{ type: "p", children: [{ text: "" }] }];
}

export function nodesToMarkdown(value: Descendant[]): string {
  const lines: string[] = [];
  for (const node of value as any[]) {
    const text = (node.children ?? [])
      .map((c: any) => c.text ?? "")
      .join("")
      .trim();
    if (!text) continue;
    switch (node.type) {
      case "h1":
        lines.push(`# ${text}`);
        break;
      case "h2":
        lines.push(`## ${text}`);
        break;
      case "h3":
      case "h4":
        lines.push(`### ${text}`);
        break;
      default:
        lines.push(node.listStyleType ? `${"  ".repeat(node.indent ?? 0)}- ${text}` : text);
    }
  }
  return lines.join("\n\n");
}

/** Default value when the sample DOCX can't be converted. */
export function emptyValue(): Descendant[] {
  return markdownToNodes("# Document\n\nStart writing…");
}
