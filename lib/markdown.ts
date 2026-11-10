/**
 * Markdown ⇄ paragraph blocks, read with `marked`'s CommonMark lexer (not
 * regexes), so nesting, escapes and inline code behave the way the assistant
 * expects.
 *
 *   markdownToBlocks  markdown → blocks (SuperDoc compares the assistant's
 *                     markdown with what it applied)
 *   blocksToMarkdown  blocks → markdown (the writing half of
 *                     lib/docx-markdown.ts)
 *
 * No .docx is written here: every engine writes Word files with its own
 * exporter (Plate's docx-io for engines with no markdown importer, see
 * lib/plate-docx.ts).
 */
import { Lexer } from "https://esm.sh/marked@18.1.3?target=es2022";

export type Run = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  /** Inline code. */
  code?: boolean;
  /** External hyperlink target. */
  href?: string;
  /** Font family name. */
  font?: string;
  /** Size in points. */
  sizePt?: number;
  /** Text colour, #rrggbb. */
  color?: string;
  /** Background (shading) colour, #rrggbb. */
  background?: string;
  vertAlign?: "superscript" | "subscript";
};

/**
 * `title`: a document title. `heading` level: 1–6.
 * `li` level: 0-based nesting depth. `code`: a code block.
 * `hr`: a thematic break.
 * `table`: `rows` of cells of runs; the first row is the header; `runs` is unused.
 */
export type Block = {
  kind: "p" | "title" | "heading" | "li" | "quote" | "code" | "hr" | "table";
  level?: number;
  ordered?: boolean;
  align?: "left" | "center" | "right" | "justify";
  runs: Run[];
  rows?: Run[][][];
};

// deno-lint-ignore no-explicit-any
type Tok = any;

type Marks = Omit<Run, "text">;

/** marked leaves HTML entities (&amp; &lt; …) encoded in some text tokens. */
function decode(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|#39|#x27|nbsp);/g, (_m, e) =>
    ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", "#x27": "'", nbsp: " " } as Record<string, string>)[e]
  );
}

function inline(tokens: Tok[] | undefined, marks: Marks = {}): Run[] {
  const out: Run[] = [];
  for (const t of tokens ?? []) {
    switch (t.type) {
      case "strong":
        out.push(...inline(t.tokens, { ...marks, bold: true }));
        break;
      case "em":
        out.push(...inline(t.tokens, { ...marks, italic: true }));
        break;
      case "del":
        out.push(...inline(t.tokens, { ...marks, strike: true }));
        break;
      case "codespan":
        out.push({ ...marks, code: true, text: decode(t.text) });
        break;
      case "link":
        out.push(...inline(t.tokens, { ...marks, href: t.href }));
        break;
      case "image":
        out.push({ ...marks, text: t.text || t.title || "" });
        break;
      case "br":
        out.push({ ...marks, text: "\n" });
        break;
      case "text":
        if (t.tokens?.length) out.push(...inline(t.tokens, marks));
        else out.push({ ...marks, text: decode(t.text) });
        break;
      case "escape":
        out.push({ ...marks, text: t.text });
        break;
      case "html":
        // <br> is how a GFM table cell holds a line break.
        if (/^<br\s*\/?>$/i.test(String(t.text).trim())) {
          out.push({ ...marks, text: "\n" });
          break;
        }
        if (t.text) out.push({ ...marks, text: decode(String(t.text).replace(/<[^>]+>/g, "")) });
        break;
      default:
        // unknown inline tokens: keep their visible text.
        if (t.text) out.push({ ...marks, text: decode(String(t.text).replace(/<[^>]+>/g, "")) });
    }
  }
  return out.filter((r) => r.text);
}

type Ctx = { level: number; quote: boolean; tables: boolean };

function blocks(tokens: Tok[], ctx: Ctx, out: Block[]) {
  for (const t of tokens) {
    switch (t.type) {
      case "heading":
        out.push({ kind: "heading", level: Math.min(Math.max(t.depth, 1), 6), runs: inline(t.tokens) });
        break;
      case "paragraph":
      case "text":
        out.push({ kind: ctx.quote ? "quote" : "p", runs: inline(t.tokens ?? [{ type: "text", text: t.text }]) });
        break;
      case "blockquote":
        blocks(t.tokens, { ...ctx, quote: true }, out);
        break;
      case "list":
        for (const item of t.items) {
          let first = true;
          for (const c of item.tokens as Tok[]) {
            if (c.type === "list") {
              blocks([c], { ...ctx, level: ctx.level + 1 }, out);
            } else if (first && (c.type === "text" || c.type === "paragraph")) {
              const runs = inline(c.tokens ?? [{ type: "text", text: c.text }]);
              if (item.task) runs.unshift({ text: item.checked ? "☒ " : "☐ " });
              out.push({ kind: "li", level: ctx.level, ordered: !!t.ordered, runs });
              first = false;
            } else {
              // A second paragraph inside an item: keep it, unnumbered.
              blocks([c], ctx, out);
            }
          }
        }
        break;
      case "code":
        out.push({ kind: "code", runs: [{ text: t.text }] });
        break;
      case "hr":
        out.push({ kind: "hr", runs: [] });
        break;
      case "table": {
        const cells = (row: Tok[]) => row.map((c) => inline(c.tokens));
        if (ctx.tables) {
          out.push({ kind: "table", runs: [], rows: [cells(t.header), ...t.rows.map(cells)] });
          break;
        }
        // Without tables (editors whose block model has none): one paragraph
        // per row, cells separated by tabs, header row bold.
        const row = (r: Tok[], bold: boolean): Run[] =>
          cells(r).flatMap((c, i) => [...(i ? [{ text: "\t" }] : []), ...c.map((x) => (bold ? { ...x, bold } : x))]);
        out.push({ kind: "p", runs: row(t.header, true) });
        for (const r of t.rows) out.push({ kind: "p", runs: row(r, false) });
        break;
      }
      case "space":
      case "def":
        break;
      default:
        if (t.text) out.push({ kind: "p", runs: [{ text: decode(String(t.text).replace(/<[^>]+>/g, "")) }] });
    }
  }
}

/**
 * `tables`: emit GFM tables as `table` blocks; otherwise, for block models
 * without tables, as tab-separated rows.
 */
export function markdownToBlocks(markdown: string, opts: { tables?: boolean } = {}): Block[] {
  const out: Block[] = [];
  blocks(new Lexer({ gfm: true }).lex(markdown ?? ""), { level: 0, quote: false, tables: !!opts.tables }, out);
  return out;
}

/* ------------------------------ blocks → md ------------------------------ */

function escapeText(s: string): string {
  return s.replace(/([\\`*_\[\]~])/g, "\\$1");
}

/** A code span whose delimiter is longer than any backtick run inside it. */
function codeSpan(text: string): string {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((m) => m.length));
  const fence = "`".repeat(longest + 1);
  // Markdown strips one space from each side when both sides have one, and
  // a backtick at either end would merge with the delimiter: pad both cases.
  const pad = /^`|`$/.test(text) || (/^ [^]* $/.test(text) && /\S/.test(text)) ? " " : "";
  return fence + pad + text + pad + fence;
}

/**
 * A fence longer than any backtick run that could close it: one at the start
 * of a line, after up to three spaces of indentation.
 */
function codeFence(code: string): string {
  const longest = Math.max(0, ...(code.match(/^ {0,3}`+/gm) ?? []).map((m) => m.trimStart().length));
  return "`".repeat(Math.max(3, longest + 1));
}

/**
 * Plain text that would read back as structure (`# x`, `1. x`, `> x`, `- x`,
 * `+ x`, a rule) gets its marker escaped — on every line, since a heading,
 * quote or list can also start after a hard line break.
 */
function escapeLineStart(text: string): string {
  return text.split("\n").map((line) => {
    const [, indent, rest] = /^( {0,3})([^]*)$/.exec(line)!;
    const ordered = /^(\d{1,9})([.)])(\s|$)/.exec(rest);
    if (ordered) return indent + ordered[1] + "\\" + rest.slice(ordered[1].length);
    if (/^(#{1,6}(\s|$)|>|[-+](\s|$)|-{3,}\s*$|={3,}\s*$)/.test(rest)) return indent + "\\" + rest;
    return line;
  }).join("\n");
}

export function runsToMarkdown(runs: Run[]): string {
  let s = "";
  for (const r of runs) {
    if (!r.text) continue;
    if (r.text === "\n") {
      s += "  \n";
      continue;
    }
    let t = r.code ? codeSpan(r.text) : escapeText(r.text);
    // Markers can't wrap leading/trailing spaces in CommonMark: move them out.
    const lead = /^\s*/.exec(t)![0], trail = /\s*$/.exec(t)![0];
    t = t.trim();
    if (!t) {
      s += r.text;
      continue;
    }
    if (r.strike) t = `~~${t}~~`;
    if (r.italic) t = `*${t}*`;
    if (r.bold) t = `**${t}**`;
    if (r.href) t = `[${t}](${r.href})`;
    s += lead + t + trail;
  }
  return s;
}

/**
 * A GFM table from rows of cells of runs. A header row that is bold
 * throughout is bold because it is the header: no `**` for that.
 */
export function tableToMarkdown(rows: Run[][][]): string {
  if (!rows.length) return "";
  const head = rows[0].flat().filter((r) => r.text.trim());
  const plainHead = head.length > 0 && head.every((r) => r.bold);
  const cell = (runs: Run[], ri: number) =>
    runsToMarkdown(ri === 0 && plainHead ? runs.map((r) => ({ ...r, bold: false })) : runs)
      // A line break inside a cell would end the table row.
      .replace(/ {2}\n/g, "<br>").replace(/\n/g, " ").replace(/\|/g, "\\|");
  const width = Math.max(...rows.map((r) => r.length));
  const line = (cells: string[]) => `| ${Array.from({ length: width }, (_, i) => cells[i] ?? "").join(" | ")} |`;
  const md = rows.map((r, ri) => r.map((c) => cell(c, ri)));
  return [line(md[0]), `|${" --- |".repeat(width)}`, ...md.slice(1).map(line)].join("\n");
}

export function blocksToMarkdown(blocks: Block[]): string {
  const out: string[] = [];
  let counters: number[] = [];
  blocks.forEach((b, i) => {
    const prev = blocks[i - 1];
    // Headings are bold by style; echoing that as **…** adds noise.
    const raw = runsToMarkdown(b.kind === "title" || b.kind === "heading" ? b.runs.map((r) => ({ ...r, bold: false })) : b.runs);
    const text = b.kind === "title" || b.kind === "heading" ? raw : escapeLineStart(raw);
    if (b.kind !== "li") counters = [];
    // A top-level switch between bullets and numbers starts a new list.
    const newList = b.kind === "li" && prev?.kind === "li" && (b.level ?? 0) === 0 &&
      (prev.level ?? 0) === 0 && !!prev.ordered !== !!b.ordered;
    // Separate blocks with a blank line, except consecutive items of one list.
    if (i > 0 && (newList || !(b.kind === "li" && prev?.kind === "li"))) out.push("");
    switch (b.kind) {
      case "title":
        out.push(`# ${text}`);
        break;
      case "heading":
        out.push(`${"#".repeat(b.level ?? 1)} ${text}`);
        break;
      case "li": {
        const lvl = b.level ?? 0;
        counters = counters.slice(0, lvl + 1);
        const sameList = prev?.kind === "li" && (prev.level ?? 0) >= lvl && !newList &&
          !(prev.level === lvl && !!prev.ordered !== !!b.ordered);
        counters[lvl] = sameList ? (counters[lvl] ?? 0) + 1 : 1;
        out.push(`${"   ".repeat(lvl)}${b.ordered ? `${counters[lvl]}.` : "-"} ${text}`);
        break;
      }
      case "quote":
        out.push(`> ${text}`);
        break;
      case "code": {
        const code = b.runs.map((r) => r.text).join("");
        const fence = codeFence(code);
        out.push(fence, code, fence);
        break;
      }
      case "hr":
        out.push("---");
        break;
      case "table":
        out.push(tableToMarkdown(b.rows ?? []));
        break;
      default:
        out.push(text);
    }
  });
  return out.join("\n");
}
