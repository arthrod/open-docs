import { assertEquals } from "jsr:@std/assert@1.0.13";
import { entryBytes } from "./zip-mirror.ts";
import { strToU8, zipSync } from "https://esm.sh/fflate@0.8.2?target=es2022";

/** A zip in memory, read through the same range interface a remote one is read through. */
function archive(files: Record<string, Uint8Array>, level: 0 | 6) {
  const zip = zipSync(files, { level });
  const offsets: Record<string, number> = {};
  // Local headers: "PK\x03\x04", name length at +26.
  for (let i = 0; i + 30 < zip.length; i++) {
    if (zip[i] === 0x50 && zip[i + 1] === 0x4b && zip[i + 2] === 3 && zip[i + 3] === 4) {
      const n = zip[i + 26] | (zip[i + 27] << 8);
      offsets[new TextDecoder().decode(zip.subarray(i + 30, i + 30 + n))] = i;
    }
  }
  const range = (from: number, to: number) => Promise.resolve(zip.slice(from, Math.min(to + 1, zip.length)));
  return { offsets, range, zip };
}

Deno.test("zip mirror: one entry of an archive is read from its byte range, deflated or stored", async () => {
  const text = "hello ".repeat(500);
  const stored = archive({ "a/first.txt": strToU8("first"), "b/second.txt": strToU8(text) }, 0);
  assertEquals(new TextDecoder().decode(await entryBytes(stored.range, "b/second.txt", stored.offsets["b/second.txt"], text.length, 0)), text);
  const a = archive({ "a/first.txt": strToU8("first"), "b/second.txt": strToU8(text) }, 6);
  // The compressed size comes from the index; here it is read from the local header to build one.
  const o = a.offsets["b/second.txt"];
  const csize = a.zip[o + 18] | (a.zip[o + 19] << 8) | (a.zip[o + 20] << 16) | (a.zip[o + 21] << 24);
  assertEquals(new TextDecoder().decode(await entryBytes(a.range, "b/second.txt", o, csize, 8)), text);
});

Deno.test("zip mirror: an offset that is not that entry's header is refused", async () => {
  const a = archive({ "a/first.txt": strToU8("first"), "b/second.txt": strToU8("second") }, 0);
  let message = "";
  try {
    await entryBytes(a.range, "b/second.txt", a.offsets["a/first.txt"], 6, 0);
  } catch (err) {
    message = (err as Error).message;
  }
  assertEquals(message.includes("b/second.txt"), true);
});

Deno.test("zip mirror: Brotli is sent only to a browser that takes it", async () => {
  const { acceptsBrotli } = await import("./zip-mirror.ts");
  assertEquals(["gzip, deflate, br, zstd", "br", "br;q=0.5", "gzip, br;q=0", "br; q=0.0", "gzip", "", "brotli"].map(acceptsBrotli), [true, true, true, false, false, false, false, false]);
});
