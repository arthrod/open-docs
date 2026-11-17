/** Drop image syntax (`![alt](src)`) but never inside code: fenced blocks and
 * inline code spans are masked out first, so image-shaped text in code survives. An escaped
 * backtick is text, not a delimiter; a code span may run over a line break, not over a blank line. */
export function stripImagesOutsideCode(markdown: string): string {
  const code: string[] = [];
  const masked = markdown.replace(/```[\s\S]*?(?:```|$)|(?<!\\)`(?:[^`\n]|\n(?!\s*\n))*(?<!\\)`/g, (m) => {
    code.push(m);
    return `\u0000${code.length - 1}\u0000`;
  });
  return masked
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\u0000(\d+)\u0000/g, (_, i) => code[Number(i)]);
}
