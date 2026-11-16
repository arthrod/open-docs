/**
 * Samples too large to keep in a Val file (val files are text; the rich sample
 * is a 68 KB base64 module). They live in the Hugging Face dataset
 * arthrod/open-docs-fixtures and are fetched here at a pinned commit, checked
 * against their SHA-256, and kept in memory for the life of the isolate.
 *
 * The same URLs are what the viewer val (viewers.benchmarks.law) is given, so
 * the editors and the viewers open the same bytes.
 */
export const FIXTURE_REPO = "https://huggingface.co/datasets/arthrod/open-docs-fixtures";
/** Dataset commit the files are read at (bump it together with the hashes). */
export const FIXTURE_REV = "03d29e24df6af66007d400830bf4edc37fb11526";

export interface Fixture {
  /** File name in the dataset, and the route: /api/<file>. */
  file: string;
  /** Document name shown once it is open. */
  title: string;
  /** Menu label: "Load the <label> sample". */
  label: string;
  /** Menu sub-line. */
  note: string;
  bytes: number;
  sha256: string;
}

export const FIXTURES: Fixture[] = [
  {
    file: "redline.docx",
    title: "Coastal Wind Farm — Summer Field Report (redline)",
    label: "redline",
    note: "23 tracked changes, 6 comments, 2 reviewers",
    bytes: 80450,
    sha256: "4199ae14e85de26af50f1482f44d5262ebaa46ab173bae17400bcc4a8d107f33",
  },
  {
    file: "lorem-500.docx",
    title: "Lorem Ipsum — 500 pages",
    label: "500-page",
    note: "lorem ipsum, 50 chapters, 468 KB",
    bytes: 467814,
    sha256: "a99ef93cb10c1b9b6bf02fe73b8d65fa66230fa5e78947bfb3aea295b26387b3",
  },
];

export const fixtureUrl = (f: Fixture) => `${FIXTURE_REPO}/resolve/${FIXTURE_REV}/${f.file}`;

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

const cache = new Map<string, Promise<Uint8Array>>();

/** The fixture's bytes: fetched once per isolate, refused if the hash differs. */
export function fixtureBytes(f: Fixture, fetcher: typeof fetch = fetch): Promise<Uint8Array> {
  let p = cache.get(f.file);
  if (!p) {
    p = (async () => {
      const res = await fetcher(fixtureUrl(f));
      if (!res.ok) throw new Error(`${f.file}: Hugging Face answered ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      const got = hex(await crypto.subtle.digest("SHA-256", bytes));
      if (got !== f.sha256) throw new Error(`${f.file}: SHA-256 ${got} is not the pinned ${f.sha256}`);
      return bytes;
    })();
    cache.set(f.file, p);
    p.catch(() => cache.delete(f.file)); // retried on the next request
  }
  return p;
}
