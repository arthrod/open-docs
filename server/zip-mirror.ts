// Single files out of a published release archive, served from this origin.
//
// For an engine distributed as one large zip (CryptPad's OnlyOffice build is 608 MB, most of it
// other editors and dictionaries). Nothing is unpacked ahead of time: an index of the entries
// this site uses (path → [offset of the local header, compressed size, method]) is kept beside
// the engine, and a file is read from the archive with one HTTP range request the first time it
// is asked for, inflated, and kept in blob storage. The index is made with a range read of the
// archive's central directory (see editors/onlyoffice/README.md).
import { blob } from "https://esm.town/v/std/blob/main.ts";

export type ZipIndex = Record<string, [offset: number, compressed: number, method: number]>;
export type RangeReader = (from: number, to: number) => Promise<Uint8Array>;

const u16 = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);

/** The bytes of one archive entry. `offset`, `compressed` and `method` come from the index. */
export async function entryBytes(
  range: RangeReader,
  name: string,
  offset: number,
  compressed: number,
  method: number,
): Promise<Uint8Array<ArrayBuffer>> {
  // Local header: 30 bytes, then the name and an "extra" field whose length only the header knows.
  const guess = 30 + new TextEncoder().encode(name).length + 512;
  let buf = await range(offset, offset + guess + compressed - 1);
  if (buf.length < 30 || buf[0] !== 0x50 || buf[1] !== 0x4b || buf[2] !== 3 || buf[3] !== 4) {
    throw new Error(`archive has no entry header for ${name} at ${offset}`);
  }
  const nameLen = u16(buf, 26), extraLen = u16(buf, 28);
  if (new TextDecoder().decode(buf.subarray(30, 30 + nameLen)) !== name) {
    throw new Error(`archive entry at ${offset} is not ${name}`);
  }
  const start = 30 + nameLen + extraLen;
  if (buf.length < start + compressed) buf = await range(offset, offset + start + compressed - 1);
  const data = buf.slice(start, start + compressed);
  if (data.length !== compressed) throw new Error(`archive ended inside ${name}`);
  if (method === 0) return data;
  if (method !== 8) throw new Error(`${name}: compression method ${method} is not supported`);
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export const remoteRange = (url: string): RangeReader => async (from, to) => {
  const res = await fetch(url, { headers: { range: `bytes=${from}-${to}` } });
  if (res.status !== 206) {
    await res.body?.cancel();
    throw new Error(`archive range request answered ${res.status}`);
  }
  return new Uint8Array(await res.arrayBuffer());
};

const TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8", js: "text/javascript; charset=utf-8", css: "text/css; charset=utf-8",
  json: "application/json; charset=utf-8", wasm: "application/wasm", svg: "image/svg+xml", png: "image/png",
  jpg: "image/jpeg", gif: "image/gif", ico: "image/x-icon", ttf: "font/ttf", woff: "font/woff", woff2: "font/woff2",
  xml: "application/xml", txt: "text/plain; charset=utf-8", bin: "application/octet-stream",
};

export type Archive = { key: string; url: string; index: ZipIndex };

/**
 * `file` from `archive`. When the archive carries a Brotli copy of the file (`<file>.br`, as
 * CryptPad's build does) and the browser accepts Brotli, that copy is sent as it is.
 */
export async function serveZipEntry(archive: Archive, file: string, acceptEncoding: string): Promise<Response> {
  const br = /\bbr\b/.test(acceptEncoding) && archive.index[`${file}.br`] ? `${file}.br` : undefined;
  const name = br ?? file;
  const entry = archive.index[name];
  if (!entry || file.endsWith(".br")) return new Response("not in the archive index", { status: 404 });
  const headers: Record<string, string> = {
    "content-type": TYPES[file.split(".").pop()!.toLowerCase()] ?? "application/octet-stream",
    "cache-control": "public, max-age=31536000, immutable",
    "vary": "accept-encoding",
    ...(br ? { "content-encoding": "br" } : {}),
  };
  const key = `od_zip_${archive.key}_${name.replaceAll("/", "__")}`;
  const stored = await blob.get(key).catch(() => undefined);
  if (stored?.ok) return new Response(stored.body, { headers });
  const bytes = await entryBytes(remoteRange(archive.url), name, entry[0], entry[1], entry[2]);
  await blob.set(key, bytes).catch((err) => console.warn("[open-docs] zip mirror store", name, err));
  return new Response(bytes, { headers });
}
