import { assertEquals } from "jsr:@std/assert@1.0.13";
import { type Block, blocksToMarkdown } from "./markdown.ts";

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
