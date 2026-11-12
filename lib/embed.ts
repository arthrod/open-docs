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
 * The origin child -> parent messages may be posted to. A `parentOrigin` query
 * parameter wins; otherwise the referrer's origin; "*" only when neither is
 * known. Inbound messages should be accepted from this same origin.
 */
export function embedTargetOrigin(href: string, referrer: string): string {
  try {
    const p = new URL(href).searchParams.get("parentOrigin");
    if (p) return new URL(p).origin;
  } catch {
    // fall through to the referrer
  }
  try {
    return referrer ? new URL(referrer).origin : "*";
  } catch {
    return "*";
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

/** child → parent messages; ui.ts posts them to window.parent with "*". */
export type ChildMessage =
  | { source: "open-docs"; type: "ready"; slug: string; name: string; startupMs?: number }
  | { source: "open-docs"; type: "error"; slug: string; message: string }
  | { source: "open-docs"; type: "opened"; slug: string; name: string };

export const childReady = (slug: string, name: string, startupMs?: number): ChildMessage =>
  typeof startupMs === "number" && Number.isFinite(startupMs)
    ? { source: "open-docs", type: "ready", slug, name, startupMs: Math.round(startupMs) }
    : { source: "open-docs", type: "ready", slug, name };

export const childError = (slug: string, message: string): ChildMessage =>
  ({ source: "open-docs", type: "error", slug, message });

export const childOpened = (slug: string, name: string): ChildMessage =>
  ({ source: "open-docs", type: "opened", slug, name });

/** parent → child messages (from editors-arena). */
export type ArenaMessage =
  | { type: "open"; name: string; bytes: ArrayBuffer }
  | { type: "sample" };

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
  if (
    d.type === "open" && typeof d.name === "string" && d.name.trim() !== "" &&
    d.bytes instanceof ArrayBuffer && d.bytes.byteLength > 0
  ) {
    return { type: "open", name: d.name, bytes: d.bytes };
  }
  return null;
}

/** Inbound check: the event must come from the embedding parent window AND,
 * when a target origin is known, from that origin. */
export function acceptsArenaEvent(
  e: { source: unknown; origin: string },
  parent: unknown,
  targetOrigin: string,
): boolean {
  if (e.source !== parent) return false;
  if (targetOrigin !== "*" && e.origin !== targetOrigin) return false;
  return true;
}
