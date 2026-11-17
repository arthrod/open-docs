import { assertEquals } from "jsr:@std/assert@1.0.13";
import { stepHistory } from "./edit-history.ts";

/** An engine whose history is a list of document texts. */
function engine(states: string[], at: number) {
  let i = at;
  return {
    getMarkdown: () => Promise.resolve(states[i]),
    undo: () => { if (i > 0) i--; },
    redo: () => { if (i < states.length - 1) i++; },
    at: () => i,
  };
}

Deno.test("history: an edit that changed only white space is still undone, not reported undone at zero steps", async () => {
  const e = engine(["a b", "a  b\n"], 1);
  assertEquals(await stepHistory(e, "undo", "a b"), 1);
  assertEquals(e.at(), 0);
});

Deno.test("history: nothing is stepped when the document already reads exactly the target", async () => {
  const e = engine(["x", "a b"], 1);
  assertEquals(await stepHistory(e, "undo", "a b"), 0);
  assertEquals(e.at(), 1);
});

Deno.test("history: a walk that never reaches the target is walked back", async () => {
  const e = engine(["one", "two", "three"], 2);
  assertEquals(await stepHistory(e, "undo", "zero"), null);
  assertEquals(e.at(), 2);
});
