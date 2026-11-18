// Univer's document body from this site's blocks, and back to Markdown.
//
// Univer's open-source packages have no .docx reader (Office import and export are in its
// separately distributed Server SDK), so a document reaches it as text: paragraphs, heading
// styles, bold / italic / underline / strike, and list items with a typed marker. Tables,
// pictures, fonts and page set-up do not carry over.
import { type Block, type Run } from "./markdown.ts";

/** Heading level (1 to 6) → Univer's NamedStyleType value, passed in by the page. */
export type HeadingStyles = Record<number, number>;

export type UniverBody = {
  dataStream: string;
  textRuns: { st: number; ed: number; ts: Record<string, unknown> }[];
  paragraphs: { startIndex: number; paragraphStyle?: { namedStyleType?: number } }[];
  sectionBreaks: { startIndex: number }[];
};

const style = (r: Run): Record<string, unknown> | undefined => {
  const ts: Record<string, unknown> = {};
  if (r.bold) ts.bl = 1;
  if (r.italic) ts.it = 1;
  if (r.underline) ts.ul = { s: 1 };
  if (r.strike) ts.st = { s: 1 };
  return Object.keys(ts).length ? ts : undefined;
};

export function blocksToUniverBody(blocks: Block[], headings: HeadingStyles): UniverBody {
  const body: UniverBody = { dataStream: "", textRuns: [], paragraphs: [], sectionBreaks: [] };
  const counters = new Map<number, number>();
  const paragraph = (runs: Run[], prefix = "", namedStyleType?: number) => {
    body.dataStream += prefix;
    for (const r of runs) {
      // A carriage return ends a paragraph in Univer's stream: none may come from the text.
      const text = r.text.replace(/[\r\n]+/g, " ");
      const ts = style(r);
      if (ts && text) body.textRuns.push({ st: body.dataStream.length, ed: body.dataStream.length + text.length, ts });
      body.dataStream += text;
    }
    body.paragraphs.push({
      startIndex: body.dataStream.length,
      ...(namedStyleType !== undefined ? { paragraphStyle: { namedStyleType } } : {}),
    });
    body.dataStream += "\r";
  };
  for (const b of blocks) {
    if (b.kind !== "li") counters.clear();
    if (b.kind === "title") paragraph(b.runs, "", headings[1]);
    else if (b.kind === "heading") paragraph(b.runs, "", headings[Math.min(6, Math.max(1, b.level ?? 1))]);
    else if (b.kind === "li") {
      const level = b.level ?? 0;
      for (const k of [...counters.keys()]) if (k > level) counters.delete(k);
      const n = (counters.get(level) ?? (b.start ?? 1) - 1) + 1;
      counters.set(level, n);
      paragraph(b.runs, "\t".repeat(level) + (b.ordered ? `${n}. ` : "• "));
    } else if (b.kind === "table") {
      for (const row of b.rows ?? []) paragraph(row.flatMap((cell, i) => [...(i ? [{ text: "\t" }] : []), ...cell]));
    } else if (b.kind === "hr") paragraph([{ text: "———" }]);
    else paragraph(b.runs);
  }
  if (!body.paragraphs.length) paragraph([]);
  body.sectionBreaks.push({ startIndex: body.dataStream.length });
  body.dataStream += "\n";
  return body;
}

/** The text of a Univer body as Markdown: one paragraph per block, headings by their style. */
export function univerBodyToMarkdown(
  body: Pick<UniverBody, "dataStream"> & { paragraphs?: UniverBody["paragraphs"] },
  headings: HeadingStyles,
): string {
  const level = new Map(Object.entries(headings).map(([l, v]) => [v, Number(l)]));
  const out: string[] = [];
  let from = 0;
  for (const p of body.paragraphs ?? []) {
    const text = body.dataStream.slice(from, p.startIndex).replace(/[\r\n]/g, "");
    from = p.startIndex + 1;
    const h = level.get(p.paragraphStyle?.namedStyleType ?? -1);
    if (text.trim()) out.push(h ? `${"#".repeat(h)} ${text}` : text);
  }
  return out.join("\n\n") + "\n";
}
