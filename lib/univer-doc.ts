// Univer's document body from this site's blocks, and back to Markdown.
//
// Univer's open-source packages have no .docx reader (Office import and export are in its
// separately distributed Server SDK), so a document reaches it as text: paragraphs, heading
// styles, bold / italic / underline / strike, and list items with a typed marker. Tables,
// pictures, fonts and page set-up do not carry over.
import { type Block, blocksToMarkdown, type Run } from "./markdown.ts";

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
  // Per level: which list is open there (numbers or bullets, and the list's id) and its last number.
  const counters = new Map<number, { key: string; n: number }>();
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
      // A different list at this level (bullets after numbers, or another list) starts its own count.
      const key = `${!!b.ordered}|${b.list ?? ""}`;
      const open = counters.get(level);
      const n = (open?.key === key ? open.n : (b.start ?? 1) - 1) + 1;
      counters.set(level, { key, n });
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

type ReadBody = Pick<UniverBody, "dataStream"> & {
  paragraphs?: UniverBody["paragraphs"];
  textRuns?: { st: number; ed: number; ts?: Record<string, unknown> }[];
};

const on = (v: unknown) => v === 1 || (typeof v === "object" && v !== null && (v as { s?: unknown }).s === 1);

/** The runs of [from, to): the text cut at the body's style runs, each piece with its styles. */
function runsOf(body: ReadBody, from: number, to: number): Run[] {
  const runs: Run[] = [];
  const plain = (a: number, b: number) => {
    if (b > a) runs.push({ text: body.dataStream.slice(a, b) });
  };
  let at = from;
  for (const r of [...(body.textRuns ?? [])].sort((a, b) => a.st - b.st)) {
    const st = Math.max(r.st, at), ed = Math.min(r.ed, to);
    if (ed <= st) continue;
    plain(at, st);
    const ts = r.ts ?? {};
    const styled = { bold: on(ts.bl), italic: on(ts.it), underline: on(ts.ul), strike: on(ts.st) };
    runs.push({ text: body.dataStream.slice(st, ed), ...Object.fromEntries(Object.entries(styled).filter(([, v]) => v)) });
    at = ed;
  }
  plain(at, to);
  return runs;
}

/**
 * A Univer body as Markdown, written by the site's own writer (so text that looks like Markdown
 * is escaped): headings by their style, list items by their typed marker, and bold, italic and
 * strike from the style runs. Underline has no Markdown and is not written.
 */
export function univerBodyToMarkdown(body: ReadBody, headings: HeadingStyles): string {
  // Two levels may share a style (Univer has five heading styles): the lower level is the one read back.
  const level = new Map<number, number>();
  for (const [l, v] of Object.entries(headings)) if (!level.has(v)) level.set(v, Number(l));
  const blocks: Block[] = [];
  let from = 0;
  for (const p of body.paragraphs ?? []) {
    const to = p.startIndex;
    const text = body.dataStream.slice(from, to);
    const h = level.get(p.paragraphStyle?.namedStyleType ?? -1);
    const item = h ? null : /^(\t*)(• |(\d{1,9})\. )/.exec(text);
    if (h) blocks.push({ kind: "heading", level: h, runs: runsOf(body, from, to) });
    else if (item) {
      blocks.push({
        kind: "li",
        level: item[1].length,
        ordered: item[3] !== undefined,
        ...(item[3] !== undefined ? { start: Number(item[3]) } : {}),
        runs: runsOf(body, from + item[0].length, to),
      });
    } else if (text.trim()) blocks.push({ kind: "p", runs: runsOf(body, from, to) });
    from = to + 1;
  }
  return blocksToMarkdown(blocks).trimEnd() + "\n";
}
