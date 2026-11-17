/**
 * The document a view-only engine opens when its page starts.
 *
 * A viewer shows nothing on a blank page, so it starts on the rich sample.
 * With `?open=<file>` in the address it starts on that Menu sample instead:
 * before, the page opened the rich sample and THEN the one asked for, so a
 * page-load audit of `/e/nutrient?open=lorem-500.docx` timed two documents.
 */
const RICH = "showcase.docx";

/** The file to start on: the `open` parameter when the Menu offers that file, the rich sample otherwise. */
export function startFile(search: string, offered: string[]): string {
  const want = new URLSearchParams(search).get("open");
  return want && (want === RICH || offered.includes(want)) ? want : RICH;
}

/** The same, for the page it runs in: a path under /api/, read from the address and the Menu's buttons. */
export function startPath(): string {
  const offered = [...document.querySelectorAll<HTMLButtonElement>(".od-fixture")].map((b) => b.dataset.file ?? "");
  return `/api/${startFile(location.search, offered)}`;
}
