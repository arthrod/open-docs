// Markdown edge cases that must survive one assistant turn (apply → read back):
// escaped block prefixes, inline code alone in a paragraph, backticks in code,
// a quote whose text also appears as a plain paragraph, a GFM table with a cell
// line break and a link. Run in an editor page's console:
//   await eval(await (await fetch('/lib/probes/md-edge.js', { cache: 'no-store' })).text())
(async () => {
const A = window.od.adapter;
const MD = "Same words\n\n> Same words\n\n\\# not a heading\n\n1\\. not a list\n\n`onlycode`\n\n```\nblock code\n```\n\nuse ``a`b`` here\n\n| k | v |\n| --- | --- |\n| x<br>z | [y](https://e.x) |\n\nafter";
await A.applyMarkdown(MD);
await new Promise((r) => setTimeout(r, 2000));
const back = await A.getMarkdown();
const expect = {
  dupQuote: /^Same words\n\n> Same words/m,
  literalHash: /^\\# not a heading/m,
  literalNumber: /^1\\\. not a list/m,
  inlineOnly: /^`onlycode`$/m,
  codeBlock: /```\nblock code\n```/,
  backtick: /``a`b``/,
  table: /^\|\s*k\s*\|\s*v\s*\|/m,
  tableLink: /\|\s*x<br\s*\/?>z\s*\|\s*\[y\]\(https:\/\/e\.x\)\s*\|/,
};
const failed = Object.entries(expect).filter(([, re]) => !re.test(back)).map(([k]) => k);
return { result: failed.length ? "✗ " + failed.join(" ") : "✓ all", ...(failed.length ? { back } : {}) };
})()
