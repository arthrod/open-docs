/**
 * Tiny markdown toolkit for the browser side of every editor demo.
 *
 * Two jobs:
 *  1. `mdToBlocks` / `blocksToMd` — the lingua franca between the agent and any
 *     editor. Each demo writes a 3-line adapter from blocks to its own model.
 *  2. `mdToHtml` — for editors whose DOCX importer can't take a .docx file, we
 *     hand them HTML via the paste path instead.
 */

export interface Block {
  type: "title" | "h1" | "h2" | "h3" | "p" | "li";
  text: string;
  /** 1-based list level for `li`. */
  level?: number;
  bold?: boolean;
  italic?: boolean;
}

const INLINE = /\*\*(.+?)\*\*|\*(.+?)\*/g;

function stripInline(s: string): string {
  return s.replace(INLINE, (_m, b, i) => b ?? i);
}

export function mdToBlocks(md: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of md.split(/\n/)) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) continue;
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      blocks.push({
        type: level === 1 ? "title" : level === 2 ? "h1" : level === 3 ? "h2" : "h3",
        text: stripInline(heading[2]),
      });
      continue;
    }
    const li = /^(\s*)[-*+]\s+(.*)$/.exec(line);
    if (li) {
      blocks.push({
        type: "li",
        text: stripInline(li[2]),
        level: Math.min(Math.floor(li[1].length / 2) + 1, 3),
      });
      continue;
    }
    blocks.push({ type: "p", text: stripInline(line.trim()) });
  }
  return blocks;
}

export function blocksToMd(blocks: Block[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case "title":
          return `# ${b.text}`;
        case "h1":
          return `## ${b.text}`;
        case "h2":
          return `### ${b.text}`;
        case "h3":
          return `#### ${b.text}`;
        case "li":
          return `${"  ".repeat((b.level ?? 1) - 1)}- ${b.text}`;
        default:
          return b.text;
      }
    })
    .join("\n\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineHtml(s: string): string {
  return escapeHtml(s).replace(
    /\*\*(.+?)\*\*|\*(.+?)\*/g,
    (_m, b, i) => b ? `<strong>${b}</strong>` : `<em>${i}</em>`,
  );
}

/** markdown → simple HTML (headings, paragraphs, nested lists). */
export function mdToHtml(md: string): string {
  const blocks = mdToBlocks(md);
  let html = "";
  let listOpen = 0;

  const closeLists = (to = 0) => {
    while (listOpen > to) {
      html += "</li></ul>";
      listOpen--;
    }
  };

  for (const b of blocks) {
    if (b.type === "li") {
      const level = b.level ?? 1;
      if (level > listOpen) {
        while (listOpen < level) {
          html += listOpen === 0 ? "<ul>" : "<ul>";
          listOpen++;
        }
      } else if (level < listOpen) {
        closeLists(level);
      } else {
        html += "</li>";
      }
      html += `<li>${inlineHtml(b.text)}`;
      continue;
    }
    closeLists();
    switch (b.type) {
      case "title":
        html += `<h1>${inlineHtml(b.text)}</h1>`;
        break;
      case "h1":
        html += `<h2>${inlineHtml(b.text)}</h2>`;
        break;
      case "h2":
        html += `<h3>${inlineHtml(b.text)}</h3>`;
        break;
      case "h3":
        html += `<h4>${inlineHtml(b.text)}</h4>`;
        break;
      default:
        html += `<p>${inlineHtml(b.text)}</p>`;
    }
  }
  closeLists();
  return html;
}

/** A one-line summary of what an agent edit changed, for the confirm card. */
export function diffSummary(before: string, after: string): string {
  const a = new Set(mdToBlocks(before).map((b) => b.text));
  const b = new Set(mdToBlocks(after).map((b) => b.text));
  const added = [...b].filter((t) => !a.has(t)).length;
  const removed = [...a].filter((t) => !b.has(t)).length;
  return `${added} line(s) added, ${removed} removed`;
}
