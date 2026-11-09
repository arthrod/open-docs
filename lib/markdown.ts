/**
 * Markdown ⇄ paragraph blocks, the lingua franca between the assistant and the
 * editors that have no markdown importer of their own.
 *
 * Parsing goes through `marked`'s CommonMark lexer (not regexes), so nesting,
 * escapes and inline code behave the way the assistant expects. Every markdown
 * element maps to a Word equivalent in lib/ooxml.ts:
 *
 *   # … ######   → Heading 1 … Heading 6      **x** → bold       *x* → italic
 *   - / 1.       → bullet / decimal numbering ~~x~~ → strike     `x` → code (Courier New)
 *   > quote      → Quote style                [x](u) → hyperlink
 *   ``` block    → Code style                 ---   → bottom-border paragraph
 *
 * Runs in the browser and on the server (no Deno APIs), so `/api/export` and the
 * editor adapters produce the same document from the same markdown.
 */
import { Lexer } from "https://esm.sh/marked@18.1.3?target=es2022";
import { type Block, blocksToDocx, type Run } from "./ooxml.ts";

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
      default:
        // html, unknown inline tokens: keep their visible text.
        if (t.text) out.push({ ...marks, text: decode(String(t.text).replace(/<[^>]+>/g, "")) });
    }
  }
  return out.filter((r) => r.text);
}

function blocks(tokens: Tok[], ctx: { level: number; quote: boolean }, out: Block[]) {
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
        // No table model in the shared blocks: one paragraph per row, cells
        // separated by tabs, header row bold.
        const row = (cells: Tok[], bold: boolean): Run[] =>
          cells.flatMap((c, i) => [...(i ? [{ text: "\t" }] : []), ...inline(c.tokens, bold ? { bold } : {})]);
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

export function markdownToBlocks(markdown: string): Block[] {
  const out: Block[] = [];
  blocks(new Lexer({ gfm: true }).lex(markdown ?? ""), { level: 0, quote: false }, out);
  return out;
}

/** Markdown straight to a Word-valid .docx (lib/ooxml.ts). */
export function markdownToDocx(markdown: string): Uint8Array {
  return blocksToDocx(markdownToBlocks(markdown));
}

/* ------------------------------ blocks → md ------------------------------ */

function escapeText(s: string): string {
  return s.replace(/([\\`*_\[\]])/g, "\\$1");
}

export function runsToMarkdown(runs: Run[]): string {
  let s = "";
  for (const r of runs) {
    if (!r.text) continue;
    if (r.text === "\n") {
      s += "  \n";
      continue;
    }
    let t = r.code ? "`" + r.text.replace(/`/g, "ˋ") + "`" : escapeText(r.text);
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

export function blocksToMarkdown(blocks: Block[]): string {
  const out: string[] = [];
  let counters: number[] = [];
  blocks.forEach((b, i) => {
    const prev = blocks[i - 1];
    // Headings are bold by style; echoing that as **…** adds noise.
    const text = runsToMarkdown(b.kind === "title" || b.kind === "heading" ? b.runs.map((r) => ({ ...r, bold: false })) : b.runs);
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
      case "code":
        out.push("```", b.runs.map((r) => r.text).join(""), "```");
        break;
      case "hr":
        out.push("---");
        break;
      default:
        out.push(text);
    }
  });
  return out.join("\n");
}
