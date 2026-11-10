import { assertEquals } from "jsr:@std/assert@1.0.13";
import {
  childError,
  childExported,
  childOpened,
  childReady,
  embedFileName,
  isEmbedUrl,
  parseArenaMessage,
} from "./embed.ts";

Deno.test("isEmbedUrl: only ?embed=1 (exact) is embed mode", () => {
  assertEquals(isEmbedUrl("https://open-docs.val.run/e/plate?embed=1"), true);
  assertEquals(isEmbedUrl("https://open-docs.val.run/e/plate?embed=1&x=2"), true);
  assertEquals(isEmbedUrl("https://open-docs.val.run/e/plate"), false);
  assertEquals(isEmbedUrl("https://open-docs.val.run/e/plate?embed=0"), false);
  assertEquals(isEmbedUrl("https://open-docs.val.run/e/plate?embed=true"), false);
  assertEquals(isEmbedUrl("https://open-docs.val.run/e/plate?embedded=1"), false);
  // Not a URL at all: never embed.
  assertEquals(isEmbedUrl("/e/plate?embed=1"), false);
});

Deno.test("embedFileName: importFile only takes .docx names", () => {
  assertEquals(embedFileName("showcase.docx"), "showcase.docx");
  assertEquals(embedFileName("showcase.DOCX"), "showcase.DOCX");
  assertEquals(embedFileName("report"), "report.docx");
  assertEquals(embedFileName("  spaced  "), "spaced.docx");
  assertEquals(embedFileName(""), "document.docx");
});

Deno.test("parseArenaMessage: accepts well-formed open, sample, and export payloads", () => {
  assertEquals(
    parseArenaMessage({ source: "editors-arena", type: "sample" }),
    { type: "sample" },
  );
  assertEquals(
    parseArenaMessage({ source: "editors-arena", type: "export" }),
    { type: "export" },
  );
  const bytes = new ArrayBuffer(8);
  assertEquals(
    parseArenaMessage({ source: "editors-arena", type: "open", name: "a.docx", bytes }),
    { type: "open", name: "a.docx", bytes },
  );
});

Deno.test("parseArenaMessage: rejects anything else", () => {
  assertEquals(parseArenaMessage(null), null);
  assertEquals(parseArenaMessage("editors-arena"), null);
  assertEquals(parseArenaMessage({}), null);
  // Wrong or missing source: not from editors-arena.
  assertEquals(parseArenaMessage({ source: "evil", type: "sample" }), null);
  assertEquals(parseArenaMessage({ type: "sample" }), null);
  // Right source, wrong shape.
  assertEquals(parseArenaMessage({ source: "editors-arena" }), null);
  assertEquals(parseArenaMessage({ source: "editors-arena", type: "nope" }), null);
  assertEquals(parseArenaMessage({ source: "editors-arena", type: "open", name: "a.docx" }), null);
  assertEquals(
    parseArenaMessage({ source: "editors-arena", type: "open", name: "a.docx", bytes: "not bytes" }),
    null,
  );
  assertEquals(
    parseArenaMessage({ source: "editors-arena", type: "open", name: "a.docx", bytes: new ArrayBuffer(0) }),
    null,
  );
  assertEquals(
    parseArenaMessage({ source: "editors-arena", type: "open", name: "  ", bytes: new ArrayBuffer(8) }),
    null,
  );
  // The child's own messages are never parent messages.
  assertEquals(parseArenaMessage(childOpened("plate", "a.docx")), null);
  assertEquals(parseArenaMessage(childExported("plate", "Report", new ArrayBuffer(4))), null);
});

Deno.test("child messages carry the exact protocol shape", () => {
  assertEquals(childReady("plate", "Plate"), {
    source: "open-docs",
    type: "ready",
    slug: "plate",
    name: "Plate",
  });
  assertEquals(childReady("plate", "Plate", 1234.6), {
    source: "open-docs",
    type: "ready",
    slug: "plate",
    name: "Plate",
    startupMs: 1235,
  });
  assertEquals(childReady("plate", "Plate", Number.NaN), {
    source: "open-docs",
    type: "ready",
    slug: "plate",
    name: "Plate",
  });
  assertEquals(childError("plate", "boom"), {
    source: "open-docs",
    type: "error",
    slug: "plate",
    message: "boom",
  });
  assertEquals(childError("plate", "boom", "mount"), {
    source: "open-docs",
    type: "error",
    slug: "plate",
    message: "boom",
    during: "mount",
  });
  assertEquals(childError("plate", "nope", "open"), {
    source: "open-docs",
    type: "error",
    slug: "plate",
    message: "nope",
    during: "open",
  });
  assertEquals(childError("plate", "nope", "export"), {
    source: "open-docs",
    type: "error",
    slug: "plate",
    message: "nope",
    during: "export",
  });
  assertEquals(childOpened("plate", "Report"), {
    source: "open-docs",
    type: "opened",
    slug: "plate",
    name: "Report",
  });
  const bytes = new Uint8Array([80, 75, 3, 4]).buffer;
  assertEquals(childExported("plate", "Report.docx", bytes), {
    source: "open-docs",
    type: "exported",
    slug: "plate",
    name: "Report",
    bytes,
  });
  assertEquals(childExported("plate", "   ", new ArrayBuffer(0)).name, "Untitled document");
});
