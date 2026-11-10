/**
 * Link targets from an imported .docx are untrusted: keep only schemes a
 * reader should follow (http, https, mailto) and in-document anchors; drop
 * javascript:, data:, vbscript: and anything relative or malformed.
 */
export function safeUrl(u: unknown): string | undefined {
  if (typeof u !== "string") return undefined;
  const t = u.trim();
  if (t.startsWith("#")) return t;
  try {
    return ["http:", "https:", "mailto:"].includes(new URL(t).protocol) ? t : undefined;
  } catch {
    return undefined; // relative or malformed: nothing to resolve it against
  }
}
