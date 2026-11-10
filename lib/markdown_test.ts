import { assertEquals } from "jsr:@std/assert@1.0.13";
import { Lexer } from "https://esm.sh/marked@18.1.3?target=es2022";
import { type Block, blocksToMarkdown, markdownToBlocks } from "./markdown.ts";

const li = (text: string, level: number, ordered: boolean, extra: Partial<Block> = {}): Block => ({
  kind: "li", level, ordered, runs: [{ text }], ...extra,
});

Deno.test("an ordered list after bullets that end nested starts at 1", () => {
  const md = blocksToMarkdown([
    li("item one", 0, false), li("item two", 0, false), li("nested", 1, false),
    li("first", 0, true), li("second", 0, true),
  ]);
  assertEquals(md, "- item one\n- item two\n   - nested\n\n1. first\n2. second");
});

Deno.test("adjacent ordered lists with different list ids restart; start is honoured", () => {
  const md = blocksToMarkdown([
    li("a", 0, true, { list: "2" }), li("b", 0, true, { list: "2" }),
    li("c", 0, true, { list: "3", start: 5 }), li("d", 0, true, { list: "3", start: 5 }),
  ]);
  assertEquals(md, "1. a\n2. b\n\n5. c\n6. d");
});

Deno.test("one list id keeps counting across an interrupting paragraph", () => {
  const md = blocksToMarkdown([
    li("a", 0, true, { list: "2" }), { kind: "p", runs: [{ text: "aside" }] }, li("b", 0, true, { list: "2" }),
  ]);
  assertEquals(md, "1. a\n\naside\n\n2. b");
});

Deno.test("a nested ordered level restarts under each parent item", () => {
  const md = blocksToMarkdown([
    li("p1", 0, true, { list: "1" }), li("x", 1, true, { list: "1" }), li("y", 1, true, { list: "1" }),
    li("p2", 0, true, { list: "1" }), li("z", 1, true, { list: "1" }),
  ]);
  assertEquals(md, "1. p1\n   1. x\n   2. y\n2. p2\n   1. z");
});

Deno.test("markdown-origin lists (no ids) keep their old numbering", () => {
  const md = blocksToMarkdown([li("a", 0, true), li("b", 0, true), li("c", 0, false), li("d", 0, true)]);
  assertEquals(md, "1. a\n2. b\n\n- c\n\n1. d");
});

/* ------------------------------------------------------------------------ *
 * Adversarial cases (review of 0127eb2 "Reader: lists keep their identity
 * and start").  Each one asserts what the .docx actually says.
 * ------------------------------------------------------------------------ */

Deno.test("a level with lvlRestart=0 keeps counting under every parent", () => {
  // <w:lvl w:ilvl="1"><w:lvlRestart w:val="0"/> means the level-1 counter
  // never restarts: the second parent's child is 2, not 1.
  const md = blocksToMarkdown([
    li("p1", 0, true, { list: "1" }), li("x", 1, true, { list: "1", restart: 0 }),
    li("p2", 0, true, { list: "1" }), li("y", 1, true, { list: "1", restart: 0 }),
  ]);
  assertEquals(md, "1. p1\n   1. x\n2. p2\n   2. y");
});

Deno.test("a child of a two-digit list item stays a child", () => {
  // "10. item" has a four-character marker, so its child needs four spaces
  // of indentation; three spaces makes it a sibling of item 10.
  const blocks: Block[] = [];
  for (let i = 1; i <= 11; i++) blocks.push(li("item" + i, 0, true, { list: "1" }));
  blocks.push(li("child", 1, true, { list: "1" }));
  const md = blocksToMarkdown(blocks);
  const list = new Lexer({ gfm: true }).lex(md)[0] as any;
  assertEquals(list.items.length, 11, "the child must not become item 12:\n" + md);
  assertEquals(
    list.items[10].tokens.some((t: any) => t.type === "list"),
    true,
    "the child of item 11 must stay nested:\n" + md,
  );
});

Deno.test("a markdown-origin ordered list keeps the number it starts at", () => {
  const md = blocksToMarkdown(markdownToBlocks("5. five\n6. six"));
  assertEquals(md, "5. five\n6. six");
});
