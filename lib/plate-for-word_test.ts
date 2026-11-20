import { assertEquals } from "jsr:@std/assert@1.0.13";
import { forWord } from "./plate-for-word.ts";

Deno.test("forWord: inline code is monospace, wherever it is nested", () => {
  assertEquals(
    forWord([{ type: "blockquote", children: [{ type: "p", children: [{ text: "a " }, { text: "x", code: true }] }] }]),
    [{ type: "blockquote", children: [{ type: "p", children: [{ text: "a " }, { text: "x", code: true, fontFamily: "Courier New" }] }] }],
  );
});

Deno.test("forWord: a code block is one block per line, and a blank line keeps a space", () => {
  const line = (text: string) => ({ type: "code_line", children: [{ text }] });
  assertEquals(
    forWord([{ type: "code_block", lang: "js", children: [line("l1"), line(""), line("l3")] }]),
    [" l1", " ", "l3"].map((t, i) => ({ type: "code_block", lang: "js", children: [line(i === 1 ? " " : t.trim())] })),
  );
  // One line is left as it is.
  assertEquals(forWord([{ type: "code_block", children: [line("only")] }]), [{ type: "code_block", children: [line("only")] }]);
});

Deno.test("forWord: a line break in a table cell is a paragraph break; outside a cell it is left alone", () => {
  const cell = (children: unknown[]) => [{ type: "table", children: [{ type: "tr", children: [{ type: "td", children }] }] }];
  assertEquals(
    forWord(cell([{ type: "p", children: [{ text: "x" }, { text: "\n" }, { text: "z", bold: true }] }])),
    cell([{ type: "p", children: [{ text: "x" }] }, { type: "p", children: [{ text: "z", bold: true }] }]),
  );
  assertEquals(
    forWord(cell([{ type: "p", children: [{ text: "a\nb\n" }] }])),
    cell([{ type: "p", children: [{ text: "a" }] }, { type: "p", children: [{ text: "b" }] }, { type: "p", children: [{ text: "" }] }]),
  );
  const body = [{ type: "p", children: [{ text: "a\nb" }] }];
  assertEquals(forWord(body), body);
});
