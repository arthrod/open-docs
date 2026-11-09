# open-docs

[![Live on Val Town](https://img.shields.io/badge/live-open--docs.val.run-2557d6)](https://open-docs.val.run)
[![Val Town](https://img.shields.io/badge/runs%20on-Val%20Town-111)](https://www.val.town/x/arthrod/open-docs)
[![Release](https://img.shields.io/github/v/tag/arthrod/open-docs?label=release)](https://github.com/arthrod/open-docs/tags)
[![Editors](https://img.shields.io/badge/editors-8-informational)](#the-editors)

Eight open-source Word editors, running entirely in the browser with no build
step. Each one opens on a **blank document**, imports and exports real
**.docx** files, has an **AI assistant** that edits the open document, and is
**measured on every visit**: startup time, JS memory and download size.

**Live:** <https://open-docs.val.run> · **Source:** <https://open-docs.val.run/source>

## The editors

| Editor | Package | Renders | .docx in / out | Assistant writes through | Assistant reads |
| --- | --- | --- | --- | --- | --- |
| [canvas-editor](https://open-docs.val.run/e/canvas-editor) | `@hufe921/canvas-editor@1.1.0` + `plugin-docx` | Canvas | vendor `plugin-docx` in, `lib/ooxml.ts` out | `executeSetValue` (element model) | element model → markdown |
| [Docxodus](https://open-docs.val.run/e/docxodus) | `docxodus@15.1.0` | .NET/WASM → HTML | native, lossless | markdown → .docx → `ribbon.open` | its .docx → `lib/docx-markdown.ts` |
| [SuperDoc](https://open-docs.val.run/e/superdoc) | `superdoc@2.29.0` | Vue + own layout engine | native | `doc.insert({type:"markdown"})` + Quote/Code styles via its document API (undoable) | its .docx → `lib/docx-markdown.ts` |
| [Plate](https://open-docs.val.run/e/plate) | `platejs@53.5.2` + plugins | Slate / DOM | mammoth in, `lib/ooxml.ts` out | `@platejs/markdown` deserialize (undoable) | `@platejs/markdown` serialize |
| [docen](https://open-docs.val.run/e/docen) | `@docen/editor@0.7.0` | Canvas (Leafer) | native | markdown → .docx → `openDOCX` | its .docx → `lib/docx-markdown.ts` |
| [docx-editor.dev](https://open-docs.val.run/e/eigenpal) | `@docx-editor.dev/react@2.35.0` | React + layout | native | markdown → .docx → `ref.load` | its .docx → `lib/docx-markdown.ts` |
| [folio](https://open-docs.val.run/e/folio) | `@stll/folio-vue@0.28.0` | ProseMirror + pagination | native | markdown → .docx → `renderAsync` | its .docx (`save()`) → `lib/docx-markdown.ts` |
| [WordCraft](https://open-docs.val.run/e/wordcraft) | `wordcraft-web` 0.16.0 (GitHub release) | Rust → WASM, egui on WebGPU/WebGL2 | native | its own `.md` reader, then Save As .docx | its .docx → `lib/docx-markdown.ts` |

Every editor shows its **own** toolbar: the vendor's ribbon where the library
ships one (Docxodus, SuperDoc, docen, docx-editor.dev, folio, WordCraft), and a
full toolbar over the library's command API where it ships none
(canvas-editor: styles, fonts, sizes, marks, colours, lists, alignment,
spacing, tables, images, links, rules, page breaks, find, zoom, print; Plate:
styles H1–H6, fonts, sizes, colours, line height, marks, sub/superscript,
highlight, lists with indent, quote, code block, rule, alignment, links).

## Using it

Open <https://open-docs.val.run>, pick an editor. Every editor page has the same top bar:

- **New** (⌥N): a fresh blank document. Pages also *open* blank.
- **Import .docx** (⌘O) or drag a .docx onto the page.
- **Export .docx** (⌘S): the editor's own bytes, named after the document title.
- **⋯**: open the sample document, download the sample, reload, source links.
- **Metrics chip**: startup / JS heap / loaded bytes for *this* page load. Click it
  for the breakdown by file type and origin.
- **Assistant** panel (toggle on the right): ask it to draft, rewrite, restructure
  or summarise. With *Auto-apply* on, edits land immediately and each one has an
  **Undo**; with it off, you review and click **Apply**.

## The assistant

[`server/agent.ts`](server/agent.ts) uses Val Town's OpenAI integration
(`std/openai`, no key to configure) with **`gpt-5.6-luna`**. The model sees the
open document as markdown plus the last 8 chat turns, and has one tool,
`edit_document({markdown, summary})`, which returns the complete new document.
It is a reasoning model and the proxy rejects function tools unless
`reasoning_effort` is `"none"`, so `complete()` always sends that.

The browser hands the markdown to the editor's `applyMarkdown`, and reads the
document back with `getMarkdown` for the next turn. Both directions use one
mapping, everywhere:

| Markdown | Word |
| --- | --- |
| `#` … `######` | Heading 1 … Heading 6 (a .docx *Title* reads back as `#`) |
| `**b**` `*i*` `~~s~~` | bold, italic, strikethrough |
| `` `code` `` / fenced block | monospace run (Code Char) / Code paragraph |
| `[text](url)` | `w:hyperlink` with an external relationship |
| `-` / `1.` (nested) | bullet / decimal numbering, with levels |
| `> quote` | Quote style |
| `---` | bottom-bordered empty paragraph |
| GFM table (`<br>` in a cell) | `w:tbl` with a repeating bold header row (`w:br` in the cell) |

### How fairness to each vendor is decided

1. If the vendor has a markdown **importer** that maps every element, the
   assistant writes through it (Plate, WordCraft; SuperDoc after its quote and
   code-block gaps are filled with its own API).
2. Otherwise the markdown becomes a complete Word document
   ([`lib/markdown.ts`](lib/markdown.ts) → [`lib/ooxml.ts`](lib/ooxml.ts)) and
   goes through the vendor's own **.docx importer**, its strongest path
   (Docxodus, docen, docx-editor.dev, folio).
3. Reading back uses the vendor's markdown **exporter** when it is faithful
   (Plate); otherwise the vendor's own .docx export is read by
   [`lib/docx-markdown.ts`](lib/docx-markdown.ts), the inverse of the writer.

### Assessment (2026-11-09): harness or editor?

The finding "only folio maps every markdown element to Word" was **mostly the
harness**, and not quite true of folio either: measured with code blocks and
tables, folio's own markdown pair loses code blocks too (see below). What was
ours, now fixed:

- Most adapters sent markdown through a lossy path (a line-based converter that
  knew headings and bullets only), so bold, italic, code, links, numbered lists
  and quotes were dropped or left as literal `**`/`#` text.
- `/api/import` mapped Heading 1 to `##` and Title to `#`. docx-editor.dev and
  Docxodus read the document back through it, so **every assistant turn pushed
  each heading one level down** and stripped all marks.
- Headings used Title for `#`, which no other editor or Word itself does.
- Plate rendered list numbers from CSS sibling counters (bullets made the next
  numbered list start at 3); canvas-editor and Plate had partial toolbars.
- SuperDoc's insert left an empty first paragraph.
- WordCraft lost keyboard input when the assistant box had focus (egui only
  reads keys while its canvas is focused); the adapter now focuses the canvas
  while it drives it, and runs one operation at a time (its save events carry
  no request id).
- The shared markdown → .docx writer flattened GFM tables into tab-separated
  paragraphs, so Docxodus, docen and docx-editor.dev never received a table;
  canvas-editor and Plate's .docx export did the same. All of them now get real
  tables (canvas-editor its native TABLE element).
- Review fixes (codex): literal `# x` / `1. x` / `> x` paragraph text is
  escaped; a paragraph of inline code alone no longer reads back as a code
  block; backticks inside code use longer delimiters/fences; SuperDoc's Quote
  style is matched to the right paragraph when the same text appears twice;
  explicit emphasis inside a quote survives; numbering overrides are read.

What is the vendors' (written down, worked around fairly, reportable upstream):

| Vendor | Limitation (version tested) | What the bench does |
| --- | --- | --- |
| docen | `@docen/docx@0.7.0` markdown import drops bold / italic / inline-code text; `saveMarkdown` drops marks, writes bullets as numbers, loses quotes; blank documents ignore `docDefaults` fonts (Calibri renders as a serif fallback) | .docx in, .docx read back |
| SuperDoc | markdown and HTML importers map `>` quotes to plain paragraphs and fenced code to an unstyled monospace paragraph, and drop `<br>` inside table cells; `getMarkdown`/`projectMarkdown` write lists as raw HTML (`<ul data-superdoc-list-labels><li>•&#9;…`) and bold headings | Quote / Code styles applied with `styles.create` + `styles.paragraph.setStyle`; .docx read back; a line break inside a table cell is lost (vendor) |
| canvas-editor | `plugin-markdown@0.0.1` merges consecutive headings and loses code; `plugin-docx@1.0.0` export writes lists as literal text and drops hyperlinks | element model both ways; `lib/ooxml.ts` export |
| Docxodus | no markdown importer; `convertWmlToMarkdown` is an anchor-annotated projection for patching | .docx in, .docx read back |
| docx-editor.dev | no markdown importer or exporter on the ref | .docx in, .docx read back |
| folio | `@stll/folio-vue@0.28.0` `fromMarkdown` turns a fenced code block into unstyled Courier paragraphs (one per line); `toMarkdown` drops backticks from code in an opened .docx and escapes `<br>` in table cells | .docx in, .docx read back (every element survives) |
| WordCraft | the released web build (v0.16.0) has no scripting API (`window.wordcraft` is on `main`, unreleased); its markdown importer keeps links but doesn't style them; Save writes the opened file's format | Save As (F12) → .docx in host mode |

Measured with [`lib/probes/md-mapping.js`](lib/probes/md-mapping.js): it applies
a fixed markdown sample, exports the .docx, checks styles/marks/numbering/links
in `document.xml`, and checks that the markdown read back keeps heading levels
and marks. All eight editors pass all ten checks and the read-back check.
[`lib/probes/md-edge.js`](lib/probes/md-edge.js) round-trips the hard cases
(escaped `#`/`1.` text, inline code alone in a paragraph, a code block, backticks
in code, a quote whose text also appears as a plain paragraph, a table with a
cell line break and a link): all eight pass, except SuperDoc's cell line break.
Run either in any editor page's console:

```js
await eval(await (await fetch('/lib/probes/md-mapping.js', { cache: 'no-store' })).text())
await eval(await (await fetch('/lib/probes/md-edge.js', { cache: 'no-store' })).text())
```

## Measurements

[`lib/metrics.ts`](lib/metrics.ts) runs in the visitor's browser once the editor
is ready and posts to `/api/metrics` (sqlite table `od_metrics_1`):

| Metric | Source |
| --- | --- |
| Startup | navigation start → adapter `mount()` resolved |
| Mount | importing the library + first render |
| JS heap | `performance.memory.usedJSHeapSize` (Chromium only), **only for the first editor opened in a tab**: later pages reuse the tab's renderer process and would inherit its heap |
| Loaded | decoded bytes of every script, stylesheet, font and WASM file. Cross-origin files without `Timing-Allow-Origin` report 0 in Resource Timing, so those are re-measured with a `force-cache` fetch. |
| Cold / warm | warm when the visible bytes mostly came from the HTTP cache (transfer < 20 % of decoded) |

The landing page shows per-editor medians (`GET /api/metrics`). Set
`localStorage["od:no-metrics"] = "1"` in a browser to keep its page loads out of
the table (used for test runs). Development-run rows were archived in
[`docs/metrics-archive/`](docs/metrics-archive/) and the table was cleared.

## How it fits together

```
index.ts                  Hono app: editor routes, /editors/* /lib/* (served + transpiled),
                          /api/svg-raw/*, /vendor/wordcraft/<v>/*
server/router.ts          shared shell (top bar, stage, assistant) + /api/{sample,blank}.docx,
                          import, export, agent, metrics, log
server/agent.ts           the assistant (std/openai, gpt-5.6-luna)
server/metrics.ts         sqlite storage + medians
server/landing.ts         the comparison page
lib/boot.ts, lib/ui.ts    window.od kit + all shell behaviour
lib/metrics.ts            in-browser measurement
lib/markdown.ts           markdown ⇄ blocks (marked), markdownToDocx
lib/ooxml.ts              small Word-valid .docx writer (Heading 1–6, Quote, Code, lists, links)
lib/docx-markdown.ts      .docx → markdown reader (inverse of the writer)
lib/probes/md-mapping.js  the markdown → Word probe
editors/<slug>/           shell.ts (server: markup, import map) + main.ts (browser: adapter)
```

Each adapter implements [`EditorAdapter`](lib/kit.ts): `mount()` (blank document),
`load(bytes)`, `getMarkdown()`, `applyMarkdown(md)`, optional `exportDocx()`.

## What it took to make each editor run from a CDN

Most of these packages publish to npm but do not run from a CDN as-is. The fixes
are in each editor's `assets.ts` / `shell.ts`, with the reasoning in comments:

- **SuperDoc**: `superdoc.min.js` loads its engine with a *bare*
  `import("@superdoc/docx-engine")`; an import map entry resolves it. Do **not**
  set `workerUrls.document`: the engine reuses it for its DOM-edit worker,
  which then runs the wrong entry and hangs at "Preparing first pages… 14%".
- **docen**: esm.sh doesn't implement Vite's `?raw`, so its Fluent icons rendered
  as the text `data:image/svg+xml,`. The import map sends the icon modules to
  `/api/svg-raw/*`, which serves each SVG as a string module. esm.sh's
  `node:zlib` polyfill throws (`zlib.crc32 is not implemented yet`); the import
  map swaps in an empty module so its zip code takes the pure-JS path.
- **docx-editor.dev, Plate**: `?external=react,react-dom` + an import map pinning
  React 18.2.0, so there is one React. Plate pins `platejs` in every plugin URL
  (`deps=platejs@53.5.2`) so all plugins share one core.
- **docx-editor.dev**: its font package resolves `.ttf` files relative to
  `import.meta.url`, so it is loaded from jsDelivr (real files), which removes
  the "fonts substituted" banner.
- **folio**: `folio-vue.css` reads `--doc-*` theme variables it never defines, so
  menus were transparent. The shell defines the theme. `--doc-canvas` is the
  *paper* colour.
- **canvas-editor**: the browser's default mousedown focus stole focus from the
  hidden input, so typing went nowhere; the adapter cancels it. Its docx and
  floating-toolbar plugins load with `external=@hufe921/canvas-editor`.
- **Plate**: `@platejs/docx-io`'s exporter wrote `<w:sectPr>` first and dropped
  heading styles (Word treats that as damaged), and its importer lost list
  markers. Import walks mammoth's HTML; export uses `lib/ooxml.ts`.
- **WordCraft**: val files are text-only and nothing mirrors release assets with
  CORS, so `/vendor/wordcraft/0.16.0/*` installs itself on first request:
  it downloads the pinned release zip from GitHub, checks its SHA-256, stores
  the three runtime files gzipped in the val's blob storage, and from then on
  streams them with `content-encoding: gzip` (22 MB on the wire for a 60 MB
  wasm) and immutable caching. See [`editors/wordcraft/assets.ts`](editors/wordcraft/assets.ts).

## Not in the bench, and why

- **office-open** (`office-open@0.15.1`): a document model and generator with no
  editing surface. Removed.
- **docs.plus**: not Rust and not a library. It is a full collaborative app
  (Next.js + Tiptap/Yjs, Supabase/Postgres, a Hocuspocus server, MIT) with no
  .docx engine; it would need its own backend, which Val Town can't host.
- **GenOffice** (genspark-ai/genoffice, Apache-2.0): mostly TypeScript with some
  Rust, shipped as an Electron desktop app. Every package is `private: true`
  (nothing on npm), and the Docs editor (`apps/docs`) is an Electron renderer
  wired to its preload/IPC. Running it here would mean forking and rebuilding
  its renderer without Electron; not deployable as published.
- **WordCraft** *is* in the bench (above): its release ships a static web build.

## Known limitations

- **Fidelity varies by design.** Docxodus, SuperDoc, docx-editor.dev, folio,
  docen and WordCraft keep the .docx model. canvas-editor and Plate round-trip
  through their own models: headings, lists, marks, links, quotes, code and
  simple tables survive; merged cells, fields, footnotes and comments do not.
- **List numbering restarts and start numbers** (`3.` as the first item) are
  not carried through markdown: every numbered list starts at 1.
- **Assistant writes replace the whole document.** Undo works through the
  assistant card. SuperDoc and Plate also put the change in the editor's own
  undo stack.
- **JS heap** is Chromium-only; other browsers show "n/a".
- **WordCraft** needs WebGPU or WebGL2 and is a 22 MB (compressed) download;
  its UI follows the browser's language.
- **Docxodus** edits one block at a time; typed text commits when the block
  loses focus or on Enter.

## Development

There's no build. Edit a file, `vt push`, refresh. The git repository is
<https://github.com/arthrod/open-docs>; the val is the deployment.

```bash
vt push                                         # deploy
curl -s https://open-docs.val.run/api/metrics | jq                     # current medians
curl -s -X POST https://open-docs.val.run/api/agent -H 'content-type: application/json' \
  -d '{"slug":"folio","document":"","prompt":"Write a two-line memo","history":[]}'
```

Append `?debug` to the SuperDoc page to log every worker message.

## Licenses

Each editor keeps its own license: MIT for canvas-editor, Docxodus, Plate and
docen; Apache-2.0 for folio and docx-editor.dev; Apache-2.0 / MIT for WordCraft;
**AGPL-3.0 for SuperDoc**. AGPL is fine for this public val but is a real
constraint for a closed product.
