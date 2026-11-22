/**
 * The assistant's Markdown as Plate nodes, with what Plate's exporter needs to say "code" in a
 * .docx. Left alone it writes inline code as a grey highlight in the body face, and a code
 * block as ONE paragraph with its lines run together (seen 2026-11-20): an engine opening that
 * shows no code, and reading it back loses it on every assistant turn. Both are put right with
 * Plate's own nodes and marks, not by touching the .docx:
 *  - inline code also carries the font-family mark (Courier New), so the run is monospace;
 *  - a code block becomes one block per line, so each line is its own paragraph, as code in
 *    Word is (a blank line keeps a space: an empty paragraph would carry no formatting).
 *  - a line break inside a table cell (`<br>`, a "\n" leaf) becomes a paragraph break: the
 *    exporter wrote the break as a paragraph of its own holding a space, three lines for two.
 *    A cell's paragraphs are its lines, in Word and in the reader.
 * lib/docx-markdown.ts reads all three back, and joins the code lines into one fence.
 */
/** A Plate text leaf: its text and its marks (`code`, `bold`, a font family …). */
export type WordLeaf = { text: string; code?: boolean; [mark: string]: unknown };
/** A Plate element: its type, its children, and whatever its plugin keeps on it. */
export type WordElement = { type?: string; children: WordNode[]; [prop: string]: unknown };
export type WordNode = WordLeaf | WordElement;

const isLeaf = (n: WordNode): n is WordLeaf => typeof (n as WordLeaf)?.text === "string";
const isElement = (n: WordNode): n is WordElement => Array.isArray((n as WordElement)?.children);

export function forWord(nodes: WordNode[], inCell = false): WordNode[] {
  return nodes.flatMap((n): WordNode[] => {
    if (isLeaf(n)) return [n.code ? { ...n, fontFamily: "Courier New" } : n];
    if (!isElement(n)) return [n];
    if (inCell && n.type === "p" && n.children.some((c) => isLeaf(c) && c.text.includes("\n"))) {
      const lines: WordNode[][] = [[]];
      for (const c of forWord(n.children)) {
        if (!isLeaf(c) || !c.text.includes("\n")) lines[lines.length - 1].push(c);
        else {
          c.text.split("\n").forEach((part, i) => {
            if (i) lines.push([]);
            if (part) lines[lines.length - 1].push({ ...c, text: part });
          });
        }
      }
      return lines.map((children) => ({ ...n, children: children.length ? children : [{ text: "" }] }));
    }
    if (n.type === "code_block" && n.children.length > 1 && n.children.every((l) => isElement(l) && l.type === "code_line")) {
      return (n.children as WordElement[]).map((line) => ({
        ...n,
        children: [{ ...line, children: line.children.some((c) => isLeaf(c) && c.text) ? line.children : [{ text: " " }] }],
      }));
    }
    return [{ ...n, children: forWord(n.children, inCell || n.type === "td" || n.type === "th") }];
  });
}
