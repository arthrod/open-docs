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
// deno-lint-ignore no-explicit-any
export function forWord(nodes: any[], inCell = false): any[] {
  // deno-lint-ignore no-explicit-any
  return nodes.flatMap((n: any): any[] => {
    if (typeof n?.text === "string") return [n.code ? { ...n, fontFamily: "Courier New" } : n];
    if (inCell && n?.type === "p" && Array.isArray(n.children) && n.children.some((c: { text?: string }) => c.text?.includes("\n"))) {
      // deno-lint-ignore no-explicit-any
      const lines: any[][] = [[]];
      for (const c of forWord(n.children)) {
        if (typeof c?.text !== "string" || !c.text.includes("\n")) lines[lines.length - 1].push(c);
        else {
          c.text.split("\n").forEach((part: string, i: number) => {
            if (i) lines.push([]);
            if (part) lines[lines.length - 1].push({ ...c, text: part });
          });
        }
      }
      return lines.map((children) => ({ ...n, children: children.length ? children : [{ text: "" }] }));
    }
    if (n?.type === "code_block" && Array.isArray(n.children) && n.children.length > 1) {
      // deno-lint-ignore no-explicit-any
      return n.children.map((line: any) => ({
        ...n,
        children: [{ ...line, children: (line.children ?? []).some((c: { text?: string }) => c.text) ? line.children : [{ text: " " }] }],
      }));
    }
    return [Array.isArray(n?.children) ? { ...n, children: forWord(n.children, inCell || n.type === "td" || n.type === "th") } : n];
  });
}
