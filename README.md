# open-docs

[![Live on Val Town](https://img.shields.io/badge/live-editors.benchmarks.law-2557d6)](https://editors.benchmarks.law)
[![Val Town](https://img.shields.io/badge/runs%20on-Val%20Town-111)](https://www.val.town/x/arthrod/open-docs)
[![Release](https://img.shields.io/github/v/tag/arthrod/open-docs?label=release)](https://github.com/arthrod/open-docs/tags)
[![Editors](https://img.shields.io/badge/editors-8-informational)](#the-editors)

Eight open-source Word editors, running entirely in the browser with no build
step. Each one opens on a **blank document**, imports and exports real
**.docx** files, has an **AI assistant** that edits the open document, and is
**measured on every visit**: startup time, JS memory and download size.

**Live:** <https://editors.benchmarks.law> · **Source:** <https://editors.benchmarks.law/source>

## The editors

| Editor | Package | Renders | .docx in / out | Assistant writes through | Assistant reads |
| --- | --- | --- | --- | --- | --- |
| [canvas-editor](https://editors.benchmarks.law/e/canvas-editor) | `@hufe921/canvas-editor@1.1.0` + `plugin-docx` | Canvas | vendor `plugin-docx` both ways | marked HTML → its `getElementListByHTML` → `executeInsertElementList` (undoable) | vendor `plugin-markdown` (`executeExportMarkdown`) |
| [Docxodus](https://editors.benchmarks.law/e/docxodus) | `docxodus@15.1.0` | .NET/WASM → HTML | native, lossless | its session `insertParagraph(markdown)` / `insertTable` in one atomic `executeBatch` (undoable) | its .docx → `lib/docx-markdown.ts` |
| [SuperDoc](https://editors.benchmarks.law/e/superdoc) | `superdoc@2.29.0` | Vue + own layout engine | native | `doc.insert({type:"markdown"})` + Quote/Code styles via its document API (undoable) | its .docx → `lib/docx-markdown.ts` |
| [Plate](https://editors.benchmarks.law/e/plate) | `platejs@53.5.2` + plugins | Slate / DOM | mammoth in, `@platejs/docx-io` out | `@platejs/markdown` deserialize (undoable) | `@platejs/markdown` serialize |
| [docen](https://editors.benchmarks.law/e/docen) | `@docen/editor@0.7.0` | Canvas (Leafer) | native | marked HTML → its paste parser (`parseHTMLBody`) → `setContent` (undoable) | its .docx → `lib/docx-markdown.ts` |
| [docx-editor.dev](https://editors.benchmarks.law/e/eigenpal) | `@docx-editor.dev/react@2.35.0` | React + layout | native | markdown → Plate → docx-io .docx → its own DOCX clipboard-fragment paste (undoable) | its .docx → `lib/docx-markdown.ts` |
| [folio](https://editors.benchmarks.law/e/folio) | `@stll/folio-vue@0.28.0` | ProseMirror + pagination | native | its `fromMarkdown` → `mergeDocumentContent` → `toProseDoc`, one transaction (undoable) | its .docx (`save()`) → `lib/docx-markdown.ts` |
| [WordCraft](https://editors.benchmarks.law/e/wordcraft) | `wordcraft-web` 0.17.0 (GitHub release) | Rust → WASM, egui on WebGPU/WebGL2 | html-paste | `window.wordcraft`: select.all + edit.paste (HTML), one undo step | its .docx → `lib/docx-markdown.ts` |

Every editor shows its **own** toolbar: the vendor's ribbon where the library
ships one (Docxodus, SuperDoc, docen, docx-editor.dev, folio, WordCraft), and a
full toolbar over the library's command API where it ships none
(canvas-editor: styles, fonts, sizes, marks, colours, lists, alignment,
spacing, tables, images, links, rules, page breaks, find, zoom, print; Plate:
styles H1–H6, fonts, sizes, colours, line height, marks, sub/superscript,
highlight, lists with indent, quote, code block, rule, alignment, links, and
tables through `@platejs/table`).

## Proprietary viewers (view-only, for comparison)

Four commercial renderers sit next to the editors so you can compare how they
draw the same rich sample. **They are viewers, not editors**: no assistant, no
New, no Export. The page says so in the top bar, and the switcher lists them
in a separate group.

| Viewer | How it runs | Key | Opens your file? | Measured (2026-11-09, desktop Chrome) |
| --- | --- | --- | --- | --- |
| [Microsoft Word viewer](https://editors.benchmarks.law/e/word-online) | `view.officeapps.live.com/op/embed.aspx`, rendered on Microsoft's servers | none | no: it fetches a public URL, so only this site's samples | ~1.2 s to the frame's load event |
| [Google Docs viewer](https://editors.benchmarks.law/e/google-viewer) | `docs.google.com/gview?embedded=true`, rendered on Google's servers | none | no: same reason | ~1.9 s; occasionally never answers, so it retries once after 20 s |
| [Apryse WebViewer](https://editors.benchmarks.law/e/apryse) | `@pdftron/webviewer@12.2.1` from jsDelivr; WASM office engine in a worker | none: **demo mode**, watermarked | yes, in the browser | 3.7–5.6 s warm, 48 MB heap, 13.6 MB loaded |
| [Nutrient Web SDK](https://editors.benchmarks.law/e/nutrient) | `nutrient-viewer` 1.25.0 from Nutrient's CDN; .NET (GdPicture) WASM turns the .docx into a PDF, then shows the PDF | none: **trial mode**, "For Evaluation Purposes Only" watermark | yes, in the browser | 15–28 s, 111 MB heap, 105 MB loaded (a 68 MB `dotnet.native.wasm`) |

What the numbers can and can't say:

- Microsoft and Google render in a cross-origin frame. The page sees only that
  frame's load event: not when their server finished drawing, nor their
  memory or downloads. Their 3 MB heap and 73 KB are **this page's** heap and
  downloads.
- Apryse and Nutrient fetch their engines from workers, which Resource Timing
  doesn't report. Their adapters list those files (`extraResources`), recorded
  from a real load, so the Loaded column includes them.
- Tabs loaded in the background are throttled by Chrome and come out slower
  (Apryse logged 24.5 s that way). The medians include every run.

Rendering differences seen on the rich sample:

- Apryse prints the footer's `NUMPAGES` field as "Page 1 of 1" on a
  three-page document.
- Nutrient substitutes fonts: inline code isn't monospace, and the title
  wraps.
- Microsoft's render is the reference: it is Word's own engine.

**Licensing, read before keeping these public.** Apryse's no-key demo mode
and Nutrient's trial are *evaluation* licenses. Nutrient's package says
`SEE LICENSE IN` its evaluation subscription agreement. Hosting them on a
public site may fall outside those terms. Check the terms, or remove
`apryse` and `nutrient` from `server/registry.ts` and `editors/index.ts`.

## Using it

Open <https://editors.benchmarks.law>, pick an editor. Every editor page has the same
compact top bar — editor dropdown, metrics chip, assistant toggle — and a
**Menu** on the right with every document action:

- **Rename document…** sets the name used when you export (default: Untitled document).
- **New blank document** (⌥N). Pages also *open* blank.
- **Open .docx from your computer…** (⌘O), or drag a .docx onto the page.
- **Export this document as .docx** (⌘S): the document you are editing, in the
  editor's own bytes, named after the document name.
- **Load the rich sample**: a Word-valid showcase (title/subtitle, three heading
  levels, every common run format, nested bullets and numbers, a table with a
  shaded header and a merged cell, a quote, a code block, a hyperlink, a chart
  image, alignments, a page break, header/footer with page numbers). Built by
  [`scripts/make_showcase.py`](scripts/make_showcase.py); also downloadable.
  **Load the short sample** is the original four-section report.
- **Load the redline sample**: the rich sample after two reviewers, with 23
  tracked changes and 6 comments. **Load the 500-page sample**: lorem ipsum, 50
  chapters of 10 pages. Both are described under [Samples](#samples). After any
  sample opens, the status line says how long it took, when the page settled,
  and the JS heap afterwards.
- **Performance of this load**, **Reload editor**, source links.

The **metrics chip** shows startup / JS heap / loaded bytes for *this* page
load; click it for the breakdown by file type and origin. The **Assistant**
panel drafts, rewrites, restructures or summarises; with *Auto-apply* on, edits
land immediately and each has an **Undo**.

**Phones and narrow windows.** The layout follows the window: the bar drops
labels, the Menu becomes a full-width sheet, the assistant becomes a sheet over
the editor (✕ to close), and toolbars we built become one scrolling row. The
page is fitted to the width with each editor's *own* zoom, re-fitted on every
resize: SuperDoc `zoom.mode: "fit-width"`, docx-editor.dev
`zoomMode: {type: "fit"}` (floor lowered from 50% to 25% so a phone fits),
folio `setZoom`, docen `setZoom`, canvas-editor `executePageScale`; Plate's page
is CSS. Docxodus already follows its container. WordCraft draws its own UI and
has no zoom API in the released build, so on a phone its page scrolls sideways.

## Samples

| Menu item | File | What it is for |
| --- | --- | --- |
| Load the rich sample | `showcase.docx`, 47,871 B, 3 pages | Rendering fidelity: styles, run formatting, lists, a table with a merged cell, a chart, header and footer. Built by [`scripts/make_showcase.py`](scripts/make_showcase.py). |
| Load the redline sample | `redline.docx`, 80,450 B, 3 pages | The rich sample after review by two people (Ana Lee, Sam Ortiz): 23 tracked changes (insertions, deletions, replacements, one inserted and one deleted paragraph, changes inside table cells, one formatting change) and 6 comments (one reply, one resolved). Word itself counts 37 revisions in it and the file holds 42 revision elements: a replacement is a deletion plus an insertion, counted here as one change. Made with `jubarte`, so the revisions are the ones Word itself writes. |
| Load the 500-page sample | `lorem-500.docx`, 467,814 B, 500 pages | A load test: 50 chapters, 2,726 justified paragraphs, about 224,000 words, header and `PAGE`/`NUMPAGES` footer. Built by [`scripts/make_lorem.py`](scripts/make_lorem.py). |
| Load the short sample | `sample.docx`, 3,778 B | The original four-section report. |

All four open in Microsoft Word with no repair prompt, and Word counts 3, 3 and
500 pages ([`scripts/word_pages.sh`](scripts/word_pages.sh) asks it). The
500-page file is built so the count survives a different font: every chapter
starts on a new page and carries text for nine and a half pages, so an engine
whose fonts run a little wide or narrow still lands on ten pages per chapter.
An engine that reports another total (see the table below) is breaking pages
differently, not reading a different file.

The redline and the 500-page file are too large for a Val file (val files are
text), so they live in the Hugging Face dataset
[`arthrod/open-docs-fixtures`](https://huggingface.co/datasets/arthrod/open-docs-fixtures).
[`server/fixtures.ts`](server/fixtures.ts) fetches them at a pinned dataset
commit, refuses bytes whose SHA-256 is not the pinned one, and serves them at
`/api/redline.docx` and `/api/lorem-500.docx`, which is also the public URL
Microsoft's and Google's viewers are given.

### Tracked changes: what each engine draws

Seen on `redline.docx` on 2026-11-15 (screenshots from
`scripts/measure_samples.py --shots`). The list the site shows is
[`lib/revision-notes.ts`](lib/revision-notes.ts).

| Engine | What you see | What the bench does |
| --- | --- | --- |
| SuperDoc | Insertions, deletions and comments, each with a card in its review rail | Nothing: the original bytes |
| folio | Insertions and deletions in the text, with change bars; comment threads and a card per change (author, date) in its Comments & Changes panel | Opens that panel when the document has comments or changes (folio opens it by itself only on a wide stage; seen 2026-11-16) |
| docen | Insertions and deletions in the text | Nothing |
| WordCraft | Insertions, deletions and comment balloons | Nothing |
| Docxodus | Insertions, deletions and comment threads | Turns on its own All Markup view (`showRevisions: true`; its default draws the document as if accepted) |
| docx-editor.dev | The accepted text with inserted words coloured; **deleted words are not shown** | Nothing. Its layout uses the `proposed` view unless a review module is registered, and that module is in the paid `@docx-editor.dev/pro`. Forcing `reviewDisplayMode="all-markup"` without it stops the editor from starting. |
| canvas-editor | Inserted words underlined, deleted words struck, both red | **Rewrites the file first** ([`lib/revisions.ts`](lib/revisions.ts)). `plugin-docx@1.0.0` skips `w:ins` and `w:del` alike, so without this the inserted *and* the deleted words vanish: "rose 14.2 %" opened as "rose . %". |
| Plate | Inserted words underlined, deleted words struck (no colour) | **Rewrites the file first**, same module. mammoth keeps inserted text and drops deleted text, so the redline read as already accepted. |
| Google Docs viewer | Insertions and deletions in the text | Nothing |
| Apryse WebViewer | Insertions and deletions in the text | Nothing |
| Microsoft Word viewer | The accepted text; no marks | Nothing (the embed viewer has no markup switch) |
| Nutrient Web SDK | The accepted text; no marks | Nothing |

`lib/revisions.ts` is the one place where the bench changes a document before an
engine reads it, and only for the two engines with no revision model. It unwraps
`w:ins` / `w:del` (and moves), marks their runs, and drops formatting-change
records; a document without tracked changes is passed through as the same bytes.
What those two engines still cannot show is theirs: who made each change and
when, accept and reject, and comments.

### The samples, measured

Every engine opening each sample from its own Menu. The table on the
[landing page](https://editors.benchmarks.law/#samples) is
[`docs/samples/latest.json`](docs/samples/latest.json); every run is in the dated
file beside it.

<!-- samples:start -->
Measured 2026-11-15: Google Chrome (installed, headed) via Playwright, fresh profile per run (cold cache), median of the runs that loaded (3 each; a combination with a failed run was run 3 more times); Darwin arm64.

**Rich sample (`showcase.docx`, 3 pages)**

| Engine | Loaded | Settled | JS heap | Renderer memory (growth) | Pages shown | Runs that loaded |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| canvas-editor | 306 ms | 306 ms | 9 MB | 313 MB (+21 MB) | 3 | 3 of 3 |
| Docxodus | 483 ms | 483 ms | 9 MB | 404 MB (+16 MB) | n/a | 3 of 3 |
| SuperDoc | 505 ms | 505 ms | 21 MB | 468 MB (+27 MB) | 3 | 3 of 3 |
| Plate | 479 ms | 479 ms | 10 MB | 308 MB (−2 MB) | n/a | 5 of 6 |
| docen | 185 ms | 185 ms | 26 MB | 360 MB (−2 MB) | n/a | 3 of 3 |
| docx-editor.dev | 112 ms | 391 ms | 31 MB | 328 MB (+16 MB) | n/a | 3 of 3 |
| folio | 244 ms | 244 ms | 21 MB | 354 MB (+41 MB) | 3 | 3 of 3 |
| WordCraft | 480 ms | 480 ms | 3 MB | 470 MB (−109 MB) | n/a | 3 of 3 |
| Word Online viewer | 222 ms | n/a | n/a | 872 MB (+149 MB) | n/a | 3 of 3 |
| Google viewer | 410 ms | n/a | n/a | 364 MB (−28 MB) | n/a | 3 of 3 |
| Apryse WebViewer | 93 ms | 93 ms | 18 MB | 450 MB (−107 MB) | n/a | 3 of 3 |
| Nutrient | 1.45 s | 1.45 s | 25 MB | 683 MB (+154 MB) | n/a | 3 of 3 |

**Redline (`redline.docx`, 3 pages)**

| Engine | Loaded | Settled | JS heap | Renderer memory (growth) | Pages shown | Runs that loaded |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| canvas-editor | 312 ms | 312 ms | 8 MB | 315 MB (+5 MB) | 3 | 3 of 3 |
| Docxodus | 475 ms | 475 ms | 9 MB | 589 MB (+47 MB) | n/a | 3 of 3 |
| SuperDoc | 556 ms | 556 ms | 23 MB | 688 MB (+123 MB) | 3 | 3 of 3 |
| Plate | 440 ms | 440 ms | 12 MB | 338 MB (+41 MB) | n/a | 3 of 3 |
| docen | 248 ms | 248 ms | 29 MB | 328 MB (−13 MB) | n/a | 4 of 6 |
| docx-editor.dev | 105 ms | 473 ms | 30 MB | 351 MB (+32 MB) | n/a | 5 of 6 |
| folio | 239 ms | 239 ms | 17 MB | 372 MB (+25 MB) | 3 | 3 of 3 |
| WordCraft | 488 ms | 488 ms | 3 MB | 477 MB (−250 MB) | n/a | 5 of 6 |
| Word Online viewer | 270 ms | n/a | n/a | 723 MB (+132 MB) | n/a | 5 of 6 |
| Google viewer | 527 ms | n/a | n/a | 397 MB (−13 MB) | n/a | 5 of 6 |
| Apryse WebViewer | 302 ms | 302 ms | 18 MB | 464 MB (−2 MB) | n/a | 3 of 3 |
| Nutrient | 1.85 s | 1.85 s | 26 MB | 524 MB (+41 MB) | n/a | 3 of 3 |

**500 pages (`lorem-500.docx`)**

| Engine | Loaded | Settled | JS heap | Renderer memory (growth) | Pages shown | Runs that loaded |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| canvas-editor | 9.28 s | 9.36 s | 699 MB | 883 MB (+594 MB) | 637 | 4 of 6 |
| Docxodus | 2.66 s | 2.66 s | 10 MB | 599 MB (+18 MB) | n/a | 3 of 3 |
| SuperDoc | 4.88 s | 4.88 s | 37 MB | 778 MB (+320 MB) | 25 | 3 of 3 |
| Plate | 22.0 s | 22.0 s | 82 MB | 469 MB (+142 MB) | n/a | 5 of 6 |
| docen | 2.23 s | 284.9 s | 128 MB | 1435 MB (+1069 MB) | n/a | 1 of 4 |
| docx-editor.dev | 292 ms | 1.03 s | 152 MB | 524 MB (+213 MB) | n/a | 3 of 3 |
| folio | 9.68 s | 9.68 s | 45 MB | 1371 MB (+1063 MB) | 500 | 3 of 3 |
| WordCraft | 2.73 s | 2.73 s | 3 MB | 361 MB (−349 MB) | n/a | 3 of 3 |
| Word Online viewer | 619 ms | n/a | n/a | 756 MB (+199 MB) | n/a | 3 of 3 |
| Google viewer | 881 ms | n/a | n/a | 412 MB (+32 MB) | n/a | 5 of 6 |
| Apryse WebViewer | 498 ms | 498 ms | 40 MB | 506 MB (+110 MB) | n/a | 3 of 3 |
| Nutrient | 7.54 s | 7.54 s | 28 MB | 397 MB (−85 MB) | n/a | 3 of 3 |
<!-- samples:end -->

Read these with care:

- **docen on 500 pages** answers "loaded" after 2.2 s and shows page 1, but its
  main thread stays busy for 4 min 45 s afterwards (one run with a 15-minute
  limit; the three runs with the usual 4-minute limit all ended with the page
  not answering). The tab is not usable during that time.
- **canvas-editor** draws 637 pages for the 500 and holds about 700 MB of
  JavaScript heap; one of its six runs stopped answering.
- **Pages shown** counts what is in the DOM: SuperDoc keeps only the pages near
  the viewport (25), so its number is not a page count of the document.
- **Renderer memory growth** can be negative: the "before" reading is taken one
  second after startup, when the engine's start-up garbage is still resident.
- Runs that did not load on the short samples were network failures (the page
  or a CDN module did not arrive), not the engine refusing the file; they are
  kept in the dated file.

Re-measure with:

```sh
uv run --with playwright python -I scripts/measure_samples.py all showcase,redline,lorem-500 3 \
  --out docs/samples/$(date +%F).json --latest docs/samples/latest.json --shots .scratch/shots
```

The published figures are taken on a GitHub-hosted macOS runner by the
[Measure workflow](.github/workflows/measure.yml) (push a branch named
`measure/<anything>`), because a timing taken on a laptop that is doing other
work is slower than the engine. Every run records the machine's load average
and the Chrome version, so the dated file shows both.

One (engine, sample) per launch of the installed Google Chrome, headed, with a
fresh profile. The page opens on its blank document, then the script clicks the
Menu's own button. **Loaded** is the click until the adapter's `load()` returns
(plus two frames). **Settled** is the click until the main thread has been quiet
for a full second, taken from the Long Tasks API: docx-editor.dev's loader
returns before it draws, and several engines keep paginating after theirs
returns, so on the 500-page file Settled is the number to compare. Work in a
worker or on the GPU is invisible to it. **JS heap** is JavaScript objects only.
**Renderer memory** is the resident memory of Chrome's renderer processes read
with `ps`, before and after the sample opens; it includes WebAssembly memory,
canvases and the DOM, and also Chrome's spare renderer, so read the growth and
compare engines with each other.

### Lighthouse

Google's [PageSpeed Insights](https://pagespeed.web.dev) on every engine's page
(`uv run --with playwright python -I scripts/measure_pagespeed.py https://editors.benchmarks.law e/superdoc,e/plate 3 --out docs/lighthouse/latest.json`):
Lighthouse run on Google's machines, as a phone on slow 4G and as a desktop, so the figures do not depend on the
computer that asks. The four category scores (0 to 100) and the lab metrics, shown on the landing page under
`/ Lighthouse`. It scores the page loading with its blank document, not editing and not how faithfully a file is drawn. For Microsoft's and Google's viewers it sees this site's frame page, not their servers' work.

<!-- lighthouse:start -->
**Blank document (the page as it opens)**

Measured 2026-11-16: PageSpeed Insights (pagespeed.web.dev), Lighthouse 13.6.0 on Google's servers, 3 analyses per page, median. Cells read desktop · mobile; accessibility, best practices and SEO are the desktop scores.

| Page | Performance | LCP | TBT | CLS | FCP | Speed Index | Accessibility | Best practices | SEO | Performance, each analysis |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| canvas-editor | 100 · 73 | 218 ms · 1.82 s | 7 ms · 50 ms | 0 · 0.594 | 218 ms · 1.69 s | 924 ms · 4.61 s | 94 | 100 | 80 | 99/100/100 · 73/73/80 |
| cite-check | 100 · 95 | 214 ms · 1.83 s | 4 ms · 0 ms | 0 · 0.006 | 214 ms · 1.83 s | 890 ms · 4.73 s | 94 | 100 | 80 | 100/100/100 · 99/95/95 |
| Docxodus | 66 · 48 | 1.07 s · 18.8 s | 828 ms · 905 ms | 0.006 · 0.018 | 230 ms · 1.72 s | 2.29 s · 6.09 s | 96 | 100 | 90 | 66/78/43 · 47/77/48 |
| SuperDoc | 73 · 76 | 450 ms · 1.66 s | 516 ms · 499 ms | 0.001 · 0 | 450 ms · 1.66 s | 2.12 s · 8.58 s | 100 | 100 | 90 | 73/68/74 · 78/72/76 |
| Plate | 99 · 98 | 213 ms · 762 ms | 58 ms · 34 ms | 0 · 0.018 | 213 ms · 762 ms | 994 ms · 3.74 s | 92 | 100 | 90 | 99/99/100 · 97/98/99 |
| docen | 72 · 72 | 225 ms · 1.67 s | 539 ms · 734 ms | 0 · 0.024 | 225 ms · 1.67 s | 2.39 s · 8.79 s | 79 | 88 | 90 | 73/69/72 · 73/60/72 |
| docx-editor.dev | 95 · 83 | 449 ms · 1.81 s | 80 ms · 123 ms | 0 · 0.018 | 449 ms · 1.66 s | 2.12 s · 8.38 s | 97 | 100 | 90 | 95/97/95 · 90/66/83 |
| folio | 72 · 50 | 445 ms · 1.66 s | 563 ms · 777 ms | 0 · 0.598 | 445 ms · 1.66 s | 2.24 s · 7.21 s | 81 | 96 | 90 | 72/72/71 · 50/49/62 |
| WordCraft | 100 · 97 | 567 ms · 2.40 s | 0 ms · 0 ms | 0.022 · 0.018 | 211 ms · 765 ms | 798 ms · 2.67 s | 100 | 96 | 90 | 100/100/100 · 97/97/97 |
| Word Online viewer | 98 · 93 | 212 ms · 2.08 s | 0 ms · 0 ms | 0.001 · 0 | 212 ms · 2.08 s | 1.38 s · 6.53 s | 100 | 73 | 90 | 100/97/98 · 93/93/84 |
| Google viewer | 93 · 87 | 224 ms · 761 ms | 186 ms · 302 ms | 0.001 · 0.004 | 224 ms · 761 ms | 1.55 s · 6.43 s | 100 | 54 | 90 | 93/91/100 · 97/57/87 |
| Apryse WebViewer | 70 · 79 | 212 ms · 777 ms | 506 ms · 644 ms | 0 · 0.003 | 212 ms · 777 ms | 4.74 s · 5.61 s | 100 | 96 | 90 | 70/60/70 · 79/98/74 |
| Nutrient | 75 · 61 | 2.19 s · 11.0 s | 279 ms · 341 ms | 0.002 · 0.007 | 211 ms · 2.10 s | 1.81 s · 6.90 s | 100 | 96 | 90 | 75/75/86 · 61/77/49 |

**Opening the 500 pages sample (`?open=lorem-500.docx`)**

| Page | Performance | LCP | TBT | CLS | FCP | Speed Index | Accessibility | Best practices | SEO | Performance, each analysis |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| canvas-editor | 70 · 12 | 216 ms · 7.01 s | 10.0 s · 10.2 s | 0.004 · 0.827 | 216 ms · 1.62 s | 739 ms · 22.8 s | 94 | 100 | 80 | fail/70/fail · fail/12/fail |
| cite-check | **no result**: PageSpeed gave no result within 240 s: the page never finished loading for it | | | | | | | | | |
| Docxodus | 36 · 35 | 10.2 s · 43.8 s | 9.74 s · 8.38 s | 0.006 · 0.018 | 224 ms · 1.53 s | 3.70 s · 8.94 s | 96 | 100 | 90 | 35/37/36 · 37/34/fail |
| SuperDoc | 71 · 70 | 450 ms · 1.66 s | 683 ms · 671 ms | 0.001 · 0.001 | 450 ms · 1.66 s | 1.83 s · 8.04 s | 100 | 100 | 90 | 77/69/71 · 70/49/78 |
| Plate | **no result**: PageSpeed gave no result within 240 s: the page never finished loading for it | | | | | | | | | |
| docen | **no result**: PageSpeed gave no result within 240 s: the page never finished loading for it | | | | | | | | | |
| docx-editor.dev | 60 · 40 | 452 ms · 18.3 s | 1.15 s · 2.06 s | 0.122 · 0.018 | 452 ms · 1.66 s | 4.68 s · 20.9 s | 97 | 100 | 90 | 57/60/60 · 59/40/36 |
| folio | 60 · 37 | 448 ms · 1.66 s | 12.9 s · 10.3 s | 0.001 · 0.598 | 448 ms · 1.66 s | 4.89 s · 16.1 s | 84 | 96 | 91 | 60/61/60 · 37/37/37 |
| WordCraft | 100 · 97 | 566 ms · 2.41 s | 0 ms · 0 ms | 0.022 · 0.018 | 225 ms · 776 ms | 755 ms · 2.85 s | 100 | 96 | 90 | 100/100/100 · 96/97/98 |
| Word Online viewer | 93 · 96 | 223 ms · 772 ms | 0 ms · 0 ms | 0.075 · 0 | 223 ms · 772 ms | 2.48 s · 5.49 s | 100 | 73 | 90 | 93/90/93 · 96/95/96 |
| Google viewer | 78 · 57 | 258 ms · 5.50 s | 438 ms · 296 ms | 0.001 · 0 | 211 ms · 5.50 s | 1.67 s · 7.15 s | 100 | 54 | 90 | 78/98/62 · 57/96/45 |
| Apryse WebViewer | 60 · 66 | 211 ms · 1.58 s | 1.57 s · 1.59 s | 0 · 0 | 211 ms · 781 ms | 6.10 s · 9.72 s | 100 | 96 | 90 | 60/60/76 · 73/35/66 |
| Nutrient | 72 · 78 | 514 ms · 776 ms | 573 ms · 383 ms | 0.002 · 0.007 | 225 ms · 776 ms | 1.64 s · 4.50 s | 100 | 96 | 90 | 72/75/71 · 89/78/49 |
<!-- lighthouse:end -->

## The assistant

[`server/agent.ts`](server/agent.ts) uses Val Town's OpenAI integration
(`std/openai`, no key to configure) with **`gpt-5.6-luna`**. The model sees the
open document as markdown plus the last 8 chat turns, and has one tool,
`edit_document({markdown, summary})`, which returns the complete new document.
It is a reasoning model and the proxy rejects function tools unless
`reasoning_effort` is `"none"`, so `complete()` always sends that.

The browser hands the markdown to the editor's `applyMarkdown`, and reads the
document back with `getMarkdown` for the next turn. The mapping the bench asks
for is below; what each engine actually produces is decided by its own
importer/exporter, and the losses are listed under the vendors:

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

1. The assistant's edit lands in the engine's **own undo history** as one
   edit, so the edit card's Undo/Redo drive the engine's native undo/redo. A
   path that rebuilds the document or resets the history (`openMarkdown`,
   `load`, `renderAsync`, `file.open`) is not used for applying.
2. Among the engine's own importers that can do that, the one that keeps the
   most is used: its markdown importer (Plate, SuperDoc, folio, Docxodus'
   session), its own HTML paste pipeline fed by `marked` (docen,
   canvas-editor, WordCraft), or its own .docx clipboard format fed by Plate's
   converters (`@platejs/markdown` → `@platejs/docx-io`,
   [`lib/plate-docx.ts`](lib/plate-docx.ts); docx-editor.dev). Nothing in the
   bench writes .docx or a document model by hand for the assistant. (Opening a
   redline in canvas-editor or Plate is the one exception, described under
   [Tracked changes](#tracked-changes-what-each-engine-draws).)
3. What that importer still loses is the engine's, and is listed below
   (docen's and WordCraft's HTML paste drop the Quote style).
4. Reading back uses the vendor's markdown **exporter** when it has one
   (Plate, canvas-editor); otherwise the vendor's own .docx export is read by
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
| docen | `@docen/docx@0.7.0` markdown import drops bold / italic / inline-code text and tables, so the assistant goes through its HTML paste parser, whose rules have no `<blockquote>` (a quote lands as a plain paragraph); `saveMarkdown` drops marks, writes bullets as numbers, loses quotes; blank documents ignore `docDefaults` fonts (Calibri renders as a serif fallback) | .docx in, .docx read back |
| SuperDoc | markdown and HTML importers map `>` quotes to plain paragraphs and fenced code to an unstyled monospace paragraph, and drop `<br>` inside table cells; `getMarkdown`/`projectMarkdown` write lists as raw HTML (`<ul data-superdoc-list-labels><li>•&#9;…`) and bold headings | Quote / Code styles applied with `styles.create` + `styles.paragraph.setStyle`; .docx read back; a line break inside a table cell is lost (vendor) |
| canvas-editor | `plugin-markdown@0.0.1` merges consecutive headings and loses code; `plugin-docx@1.0.0` export writes lists as literal text and drops hyperlinks | vendor plugins both ways, losses included |
| Docxodus | no markdown importer; `convertWmlToMarkdown` is an anchor-annotated projection for patching | .docx in, .docx read back |
| docx-editor.dev | no markdown importer or exporter on the ref | .docx in, .docx read back |
| folio | `@stll/folio-vue@0.28.0` `fromMarkdown` turns a fenced code block into unstyled Courier paragraphs (one per line); `toMarkdown` drops backticks from code in an opened .docx and escapes `<br>` in table cells | .docx in, .docx read back (every element survives) |
| WordCraft | v0.17.0's `window.wordcraft` drives apply/undo/redo; its HTML paste turns a quote into an indented Normal paragraph (by design, `paste.rs`); Save writes the opened file's format | Save As (F12) → .docx in host mode |

Measured with [`lib/probes/md-mapping.js`](lib/probes/md-mapping.js): it applies
a fixed markdown sample, exports the .docx, checks styles/marks/numbering/links
in `document.xml`, and checks that the markdown read back keeps heading levels
and marks. All eight editors pass all ten checks and the read-back check.
[`lib/probes/md-edge.js`](lib/probes/md-edge.js) round-trips the hard cases
(escaped `#`/`1.` text, inline code alone in a paragraph, a code block, backticks
in code, a quote whose text also appears as a plain paragraph, a table with a
cell line break and a link): all eight pass, except SuperDoc's cell line break.
[`lib/probes/ai-export.js`](lib/probes/ai-export.js) is the end-to-end check:
it loads the rich sample, sends the assistant a prompt through the real chat
box, waits for the edit to apply, reads the document back, then clicks
**Export** and looks for the edit inside the exported `word/document.xml`. All
eight editors pass (2026-11-09, gpt-5.6-luna): edit applied, read back, present
in the export, table kept.

Run any of them in an editor page's console (ai-export runs in the background
and leaves its result in `window.__ai`):

```js
await eval(await (await fetch('/lib/probes/md-mapping.js', { cache: 'no-store' })).text())
await eval(await (await fetch('/lib/probes/md-edge.js', { cache: 'no-store' })).text())
eval(await (await fetch('/lib/probes/ai-export.js', { cache: 'no-store' })).text()) // then read window.__ai
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
[`docs/metrics-archive/`](docs/metrics-archive/) and the table was cleared; a
fresh baseline (3 loads per editor, one per new tab, one at a time) is in
[`docs/metrics-archive/2026-11-09-baseline.md`](docs/metrics-archive/2026-11-09-baseline.md).
JS heap leaves out WebAssembly memory, so WordCraft and Docxodus read low.

## How it fits together

```
index.ts                  Hono app: editor routes, /editors/* /lib/* (served + transpiled),
                          /api/svg-raw/*, /vendor/wordcraft/<v>/*
server/router.ts          shared shell (top bar, stage, assistant) + /api/{sample,blank}.docx,
                          import, agent, metrics, log
server/agent.ts           the assistant (std/openai, gpt-5.6-luna)
server/metrics.ts         sqlite storage + medians
server/landing.ts         the comparison page
lib/boot.ts, lib/ui.ts    window.od kit + all shell behaviour
lib/metrics.ts            in-browser measurement
lib/markdown.ts           markdown ⇄ blocks (marked)
lib/plate-docx.ts         .docx out through Plate's docx-io (Plate export; markdown → .docx)
lib/plate-docx-pin.ts     pinned URL + SRI of the docx-io browser bundle (tools/plate-docx-io)
lib/docx-markdown.ts      .docx → markdown reader
lib/revisions.ts          tracked changes as formatting, for the two engines with no revision model
lib/revision-notes.ts     how each engine treats tracked changes (status line, landing table)
server/fixtures.ts        the redline and 500-page samples, fetched from Hugging Face at a pinned commit
server/samples-band.ts    the landing page's samples table (docs/samples/latest.json)
scripts/measure_samples.py   every engine opening every sample, in real Chrome
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
- **Plate**: `@platejs/docx-io@53.5.5`'s importer loses list markers and
  pictures, so import walks mammoth's HTML. Export is docx-io's own
  `exportToDocx` with Plate's static components (headings keep their styles;
  Word opens the file without a repair prompt, in Compatibility Mode). It
  ignores a picture's width and writes its natural size.
- **WordCraft**: val files are text-only and nothing mirrors release assets with
  CORS, so `/vendor/wordcraft/0.17.0/*` installs itself on first request:
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
- **Assistant edits go through markdown**, so what markdown can't say is lost
  when the assistant rewrites a document: merged cells, colours, headers and
  footers (except in SuperDoc, which edits in place and keeps the header),
  images. Plate carries underline, sub/superscript, colours and highlight as
  inline HTML through its own `remarkMdx`, so those survive there.
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

## Tests

```sh
deno check --allow-import index.ts
deno test -A lib/ server/ editors/
uv run --with pytest pytest scripts/tests              # the measurement scripts' logic (scripts/measure_lib.py)
```

`.github/workflows/ci.yml` runs the same on every pull request, with coverage, and the Rust wrapper's tests
when `tools/wordcraft-render` changes. The browser entry points (`editors/*/main.ts`) import by served path
(`/lib/kit.ts`) and are not type-checked outside the browser.

## Development

There's no build. Edit a file, `vt push`, refresh. The git repository is
<https://github.com/arthrod/open-docs>; the val is the deployment.

```bash
vt push                                         # deploy
curl -s https://editors.benchmarks.law/api/metrics | jq                     # current medians
curl -s -X POST https://editors.benchmarks.law/api/agent -H 'content-type: application/json' \
  -d '{"slug":"folio","document":"","prompt":"Write a two-line memo","history":[]}'
```

Append `?debug` to the SuperDoc page to log every worker message.

## Licenses

Each editor keeps its own license: MIT for canvas-editor, Docxodus, Plate and
docen; Apache-2.0 for folio and docx-editor.dev; Apache-2.0 / MIT for WordCraft;
**AGPL-3.0 for SuperDoc**. AGPL is fine for this public val but is a real
constraint for a closed product. The four viewers are proprietary. Microsoft's
and Google's are free hosted services. Apryse and Nutrient run unlicensed in
their evaluation modes (see above).
