/**
 * Embed mode (`?embed=1`): the postMessage protocol editors-arena uses to
 * drive an open-docs page inside an iframe on another origin.
 *
 * Pure helpers only — no DOM touched at import time — so they unit-test in
 * Deno. The wiring lives in lib/ui.ts.
 */

/** `?embed=1` — this page is embedded in an iframe by editors-arena. */
export function isEmbedUrl(href: string): boolean {
  try {
    return new URL(href).searchParams.get("embed") === "1";
  } catch {
    return false;
  }
}

/**
 * The file name an `open` message carries, normalised for the Import path
 * (which only accepts names ending in .docx).
 */
export function embedFileName(name: string): string {
  const clean = name.trim() || "document";
  return /\.docx$/i.test(clean) ? clean : `${clean}.docx`;
}

/** Which step failed. Omitted on the wire when the caller does not know. */
export type EmbedDuring = "mount" | "open" | "export";

/** child → parent messages; ui.ts posts them to window.parent with "*". */
export type ChildMessage =
  | { source: "open-docs"; type: "ready"; slug: string; name: string; startupMs?: number }
  | { source: "open-docs"; type: "error"; slug: string; message: string; during?: EmbedDuring }
  | { source: "open-docs"; type: "opened"; slug: string; name: string }
  | { source: "open-docs"; type: "exported"; slug: string; name: string; bytes: ArrayBuffer };

export const childReady = (slug: string, name: string, startupMs?: number): ChildMessage =>
  typeof startupMs === "number" && Number.isFinite(startupMs)
    ? { source: "open-docs", type: "ready", slug, name, startupMs: Math.round(startupMs) }
    : { source: "open-docs", type: "ready", slug, name };

export const childError = (slug: string, message: string, during?: EmbedDuring): ChildMessage =>
  during
    ? { source: "open-docs", type: "error", slug, message, during }
    : { source: "open-docs", type: "error", slug, message };

export const childOpened = (slug: string, name: string): ChildMessage =>
  ({ source: "open-docs", type: "opened", slug, name });

/**
 * Reply to a parent "export". `name` has no extension (the parent appends
 * ".docx"). `bytes` is the .docx ArrayBuffer; the caller transfers it.
 */
export const childExported = (
  slug: string,
  name: string,
  bytes: ArrayBuffer,
): Extract<ChildMessage, { type: "exported" }> =>
  ({
    source: "open-docs",
    type: "exported",
    slug,
    name: name.replace(/\.docx$/i, "").trim() || "Untitled document",
    bytes,
  });

/** parent → child messages (from editors-arena). */
export type ArenaMessage =
  | { type: "open"; name: string; bytes: ArrayBuffer }
  | { type: "sample" }
  | { type: "export" };

/**
 * Validate a parent → child payload. The caller has already checked
 * `event.source === window.parent`; this checks only the payload's shape, so
 * anything else on the page (or another window) is ignored.
 */
export function parseArenaMessage(data: unknown): ArenaMessage | null {
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  if (d.source !== "editors-arena") return null;
  if (d.type === "sample") return { type: "sample" };
  if (d.type === "export") return { type: "export" };
  if (
    d.type === "open" && typeof d.name === "string" && d.name.trim() !== "" &&
    d.bytes instanceof ArrayBuffer && d.bytes.byteLength > 0
  ) {
    return { type: "open", name: d.name, bytes: d.bytes };
  }
  return null;
}
