/**
 * A Code-style paragraph's leaves → Plate `code_line`s, one per line, every
 * leaf keeping its marks. Reading the paragraph's `textContent` instead loses
 * them, and with them a tracked change: `<pre><s>old</s><u>new</u></pre>`
 * would read "oldnew" with nothing to show which word was deleted.
 */
// deno-lint-ignore no-explicit-any
type Leaf = any;

export function codeLines(leaves: Leaf[]): Leaf[] {
  const lines: Leaf[][] = [[]];
  const add = (leaf: Leaf) => {
    if (leaf.children) return leaf.children.forEach(add); // a link: a code line holds text only
    const { text = "", ...marks } = leaf;
    String(text).split("\n").forEach((part, i) => {
      if (i) lines.push([]);
      if (part) lines[lines.length - 1].push({ text: part, ...marks });
    });
  };
  leaves.forEach(add);
  return lines.map((children) => ({ type: "code_line", children: children.length ? children : [{ text: "" }] }));
}
