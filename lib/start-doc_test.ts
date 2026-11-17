import { assertEquals } from "jsr:@std/assert@1";
import { startFile } from "./start-doc.ts";

const offered = ["redline.docx", "lorem-500.docx"];

Deno.test("a view-only engine starts on the rich sample, or on the Menu sample the address asks for", () => {
  assertEquals(startFile("", offered), "showcase.docx");
  assertEquals(startFile("?open=lorem-500.docx", offered), "lorem-500.docx");
  assertEquals(startFile("?embed=1&open=redline.docx", offered), "redline.docx");
  assertEquals(startFile("?open=showcase.docx", offered), "showcase.docx");
});

Deno.test("only a file the Menu offers is taken from the address", () => {
  assertEquals(startFile("?open=../secret.docx", offered), "showcase.docx");
  assertEquals(startFile("?open=https://evil.example/x.docx", offered), "showcase.docx");
  assertEquals(startFile("?open=", offered), "showcase.docx");
  assertEquals(startFile("?open=lorem-500.docx", []), "showcase.docx");
});
