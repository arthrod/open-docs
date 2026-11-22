# open-docs

[![Live on Val Town](https://img.shields.io/badge/live-editors.benchmarks.law-2557d6)](https://editors.benchmarks.law)
[![Val Town](https://img.shields.io/badge/runs%20on-Val%20Town-111)](https://www.val.town/x/arthrod/open-docs)
[![Release](https://img.shields.io/github/v/tag/arthrod/open-docs?label=release)](https://github.com/arthrod/open-docs/tags)
[![Editors](https://img.shields.io/badge/editors-17-informational)](#the-editors)

Thirteen open-source Word editors, running entirely in the browser with no build
step, and four more tools shown through the editors trial's demo builds of them
(GenOffice, office-open, Fidus Writer, docs.plus: [what differs](#four-more-through-the-editors-trials-demo-builds-2026-11-21)). Each of the thirteen opens on a **blank document**, has an **AI assistant** that edits
the open document, and is **measured on every visit**: startup time, JS memory
and download size. Twelve import and export real **.docx** files; Univer's
open-source packages have no .docx reader, so it is handed the text. Eight were
here from the start; five were added on 2026-11-18 (react-docx, Univer, OpenDoc,
BetterOffice, OnlyOffice).

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
| [WordCraft](https://editors.benchmarks.law/e/wordcraft) | `wordcraft-web` 0.18.1 (GitHub release) | Rust → WASM, egui on WebGPU/WebGL2 | native (export is its Save As, in host mode) | `window.wordcraft`: select.all + edit.paste (HTML), one undo step | its .docx → `lib/docx-markdown.ts` |
| [react-docx](https://editors.benchmarks.law/e/react-docx) | `@extend-ai/react-docx@0.15.0` (`/vanilla`, served from this origin) | Rust → WASM parser, DOM layout (Preact) | native | markdown → Plate → docx-io .docx → opened as a new document (not undoable) | its .docx (`getDocxBytes()`) → `lib/docx-markdown.ts` |
| [Univer](https://editors.benchmarks.law/e/univer) | `@univerjs/presets@1.5.2` + `preset-docs-core` | Canvas | none: text only, read by `lib/docx-markdown.ts` (its .docx import and export are in its Server SDK); no .docx export | markdown → `lib/univer-doc.ts` → a new document (not undoable) | its body → `lib/univer-doc.ts` |
| [OpenDoc](https://editors.benchmarks.law/e/opendoc) | its editor application, snapshot of 2026-11-05 (commit `5ac261c`), in a same-origin frame | Rust → WASM engine, canvas | native (through its own file input) | markdown → Plate → docx-io .docx → opened as a new document (not undoable) | its .docx export (caught before the download) → `lib/docx-markdown.ts` |
| [BetterOffice](https://editors.benchmarks.law/e/betteroffice) | `@betteroffice/docx-react@0.5.1` + `@betteroffice/docx@0.5.1`, `@betteroffice/fonts@0.4.2` (served from this origin) | Rust → WASM engines in a Worker, canvas pages, React UI | native | markdown → Plate → docx-io .docx → opened as a new document (not undoable) | its .docx (`save()`) → `lib/docx-markdown.ts` |
| [OnlyOffice (CryptPad build)](https://editors.benchmarks.law/e/onlyoffice) | `cryptpad/onlyoffice-editor` v9.3.2+3 + `cryptpad/onlyoffice-x2t-wasm` v9.3.2+3, read out of their release archives | sdkjs canvas; x2t converter in WASM; no document server | native (x2t: .docx → editor binary) | markdown → Plate → docx-io .docx → opened in a new editor (not undoable) | editor binary → x2t → .docx → `lib/docx-markdown.ts` |
| [GenOffice](https://editors.benchmarks.law/e/genoffice) | `genspark-ai/genoffice` at `36a509e`: its Docs application, as built for the editors trial | ProseMirror with its own page layout; a stand-in for the Electron desktop it expects | native (its own reader and writer) | markdown → Plate → docx-io .docx → the demo opened again on it (not undoable) | its Download, caught on the way out → `lib/docx-markdown.ts` |
| [office-open](https://editors.benchmarks.law/e/office-open) | `@office-open/docx` from `DemoMacro/office-open` at `567addf`, as built for the editors trial | no editor: an outline of what its parser read | native (parse, then generate) | markdown → Plate → docx-io .docx → the demo opened again on it (not undoable) | its Download, caught on the way out → `lib/docx-markdown.ts` |
| [Fidus Writer](https://editors.benchmarks.law/e/fidus-writer) | `@fiduswriter/document` from `fiduswriter/fiduswriter-document-ts` at `dc0981d`, as built for the editors trial | ProseMirror, DOM | its importer; **its exporter failed on every sample of this site** (see below) | no assistant | none |
| [docs.plus](https://editors.benchmarks.law/e/docs-plus) | `docs-plus/docs.plus` at `a9b0c69`: its editor and document conversion, as built for the editors trial | Tiptap, DOM | its own import (mammoth) and export | markdown → Plate → docx-io .docx → the demo opened again on it (not undoable) | its Download, caught on the way out → `lib/docx-markdown.ts` |

Every editor shows its **own** toolbar: the vendor's ribbon where the library
ships one (Docxodus, SuperDoc, docen, docx-editor.dev, folio, WordCraft), and a
full toolbar over the library's command API where it ships none
(canvas-editor: styles, fonts, sizes, marks, colours, lists, alignment,
spacing, tables, images, links, rules, page breaks, find, zoom, print; Plate:
styles H1–H6, fonts, sizes, colours, line height, marks, sub/superscript,
highlight, lists with indent, quote, code block, rule, alignment, links, and
tables through `@platejs/table`). The five added on 2026-11-18 (react-docx,
Univer, OpenDoc, BetterOffice, OnlyOffice) each show the vendor's own interface
and nothing of ours over it: OpenDoc and OnlyOffice are the vendor's whole
application in a same-origin frame.

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
  editor's own bytes, named after the document name. Not in Univer, which has
  no .docx export.
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
land immediately and each has an **Undo**, except in react-docx, Univer,
OpenDoc, BetterOffice and OnlyOffice: there an edit opens a new document
([why](#the-assistant)), so export first if you want the one before it.

**Phones and narrow windows.** The layout follows the window: the bar drops
labels, the Menu becomes a full-width sheet, the assistant becomes a sheet over
the editor (✕ to close), and toolbars we built become one scrolling row. The
page is fitted to the width with each editor's *own* zoom, re-fitted on every
resize: SuperDoc `zoom.mode: "fit-width"`, docx-editor.dev
`zoomMode: {type: "fit"}` (floor lowered from 50% to 25% so a phone fits),
folio `setZoom`, docen `setZoom`, canvas-editor `executePageScale`; Plate's page
is CSS. Docxodus already follows its container. WordCraft draws its own UI and
has no zoom API in the released build, so on a phone its page scrolls sideways.
react-docx, Univer, OpenDoc, BetterOffice and OnlyOffice are not fitted by this
site: their adapters make no zoom call, so on a phone each does what its own
layout does. Not checked on a phone.

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
`scripts/measure_samples.py --shots`); the five engines added on 2026-11-18 as
their adapters recorded them that day. The list the site shows is
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
| react-docx | Insertions underlined in the text; a margin card per deletion and per comment (author, date, Accept / Reject) | Turns its review marks and cards on: it ships with both hidden |
| OpenDoc | Insertions and deletions in the text; a card per change and per comment (author, date, Accept / Reject) in its review pane | Nothing |
| BetterOffice | Deletions struck and insertions underlined in the text; a card per change and per comment (author, date, accept / reject) in its review sidebar | Nothing |
| OnlyOffice (CryptPad build) | Deletions struck and insertions underlined, in the author's colour; its own review and comment panels open from its side bar | Nothing |
| GenOffice | Insertions underlined and deletions struck in the text, change bars in the margin, a balloon per comment (author, date, Resolve) | Nothing |
| office-open | **Not drawn.** An outline of what the parser read; the words inside tracked insertions and deletions are not in it | Nothing (the library has no editor) |
| Fidus Writer | **Not drawn, and words are missing.** The text inside tracked insertions and deletions is left out (the title reads "Coastal Wind Farm —  Field Report"); comments are kept as marks | Nothing |
| docs.plus | **Not drawn.** The text as if every change were accepted; no comments | Nothing (its import, mammoth, has no revision model) |
| Univer | **Not drawn.** The text, with inserted and moved-in words kept and deleted words left out | It has no .docx reader, so this site's reader hands it the text: what it shows is not its reading of the file |
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
Measured 2026-11-21: Google Chrome 158.0.8127.36 (installed, headed) via Playwright, fresh profile per run (cold cache), 3 runs, median; a Hugging Face Jobs cpu-xl machine (16 vCPU, 124 GB, Linux x86-64, no GPU: Chrome draws in software; the load average and core count recorded with each run are the shared host's), Chrome under Xvfb with --no-sandbox --disable-dev-shm-usage.

**Rich sample (`showcase.docx`, 3 pages)**

Host load during these runs (1-minute average): median 44.1, highest 49.3, on 64 cores.

| Engine | Loaded | Settled | JS heap | Renderer memory (growth) | Pages shown | Runs that loaded |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| canvas-editor | 427 ms | 427 ms | 6 MB | 463 MB (+45 MB) | 3 | 3 of 3 |
| Docxodus | 1.23 s | 1.23 s | 8 MB | 559 MB (+13 MB) | n/a | 3 of 3 |
| SuperDoc | 1.36 s | 1.36 s | 15 MB | 610 MB (+55 MB) | 3 | 3 of 3 |
| Plate | 542 ms | 542 ms | 10 MB | 455 MB (+57 MB) | n/a | 3 of 3 |
| docen | 317 ms | 317 ms | 18 MB | 560 MB (+68 MB) | n/a | 3 of 3 |
| docx-editor.dev | 1.38 s | 1.38 s | 22 MB | 538 MB (+84 MB) | n/a | 3 of 3 |
| folio | 589 ms | 751 ms | 16 MB | 476 MB (+57 MB) | 3 | 3 of 3 |
| WordCraft | 646 ms | still busy after 180 s | 4 MB | 551 MB (−190 MB) | n/a | 3 of 3 |
| Microsoft Word viewer | 599 ms | n/a | n/a | 885 MB (−86 MB) | n/a | 2 of 3 |
| Google Docs viewer | 595 ms | n/a | n/a | 623 MB (+21 MB) | n/a | 3 of 3 |
| Apryse WebViewer | 300 ms | 300 ms | 18 MB | 716 MB (+41 MB) | n/a | 3 of 3 |
| Nutrient | 4.79 s | 4.79 s | 20 MB | 787 MB (+185 MB) | n/a | 2 of 3 |
| react-docx | 1.10 s | 1.10 s | 11 MB | 523 MB (+39 MB) | 3 | 3 of 3 |
| Univer | 469 ms | 469 ms | 25 MB | 521 MB (+48 MB) | n/a | 3 of 3 |
| BetterOffice | 1.39 s | 1.58 s | 12 MB | 648 MB (+64 MB) | 3 | 3 of 3 |
| OnlyOffice (CryptPad build) | 3.06 s | 3.06 s | 50 MB | 892 MB (+225 MB) | 3 | 3 of 3 |
| OpenDoc | 720 ms | 840 ms | 12 MB | 676 MB (+63 MB) | 3 | 3 of 3 |
| GenOffice (measured 2026-11-21: a MacBook Pro (Apple M4 Pro, 12 cores, 24 GB, with its graphics card), load median 5.0, highest 5.8, on 12 cores) | 391 ms | 391 ms | 17 MB | 566 MB (+134 MB) | 3 | 3 of 3 |
| office-open (measured 2026-11-21: a MacBook Pro (Apple M4 Pro, 12 cores, 24 GB, with its graphics card), load median 5.0, highest 5.8, on 12 cores) | 297 ms | 297 ms | 7 MB | 505 MB (+179 MB) | n/a | 3 of 3 |
| Fidus Writer (measured 2026-11-21: a MacBook Pro (Apple M4 Pro, 12 cores, 24 GB, with its graphics card), load median 5.0, highest 5.8, on 12 cores) | 185 ms | 185 ms | 5 MB | 379 MB (+42 MB) | n/a | 3 of 3 |
| docs.plus (measured 2026-11-21: a MacBook Pro (Apple M4 Pro, 12 cores, 24 GB, with its graphics card), load median 5.0, highest 5.8, on 12 cores) | 190 ms | 190 ms | 10 MB | 423 MB (+58 MB) | n/a | 3 of 3 |

**Redline (`redline.docx`, 3 pages)**

Host load during these runs (1-minute average): median 25.5, highest 32.5, on 64 cores.

| Engine | Loaded | Settled | JS heap | Renderer memory (growth) | Pages shown | Runs that loaded |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| canvas-editor | 413 ms | 413 ms | 6 MB | 466 MB (+50 MB) | 3 | 3 of 3 |
| Docxodus | 1.09 s | 1.09 s | 8 MB | 573 MB (+16 MB) | n/a | 3 of 3 |
| SuperDoc | 1.83 s | 1.83 s | 16 MB | 648 MB (+91 MB) | 3 | 3 of 3 |
| Plate | 523 ms | 523 ms | 11 MB | 458 MB (+61 MB) | n/a | 3 of 3 |
| docen | 388 ms | 388 ms | 19 MB | 565 MB (+77 MB) | n/a | 2 of 3 |
| docx-editor.dev | 1.37 s | 1.37 s | 23 MB | 537 MB (+79 MB) | n/a | 3 of 3 |
| folio | 452 ms | 614 ms | 17 MB | 474 MB (+58 MB) | 3 | 3 of 3 |
| WordCraft | 519 ms | 2.93 s | 3 MB | 534 MB (−148 MB) | n/a | 3 of 3 |
| Microsoft Word viewer | 313 ms | n/a | n/a | 877 MB (−36 MB) | n/a | 3 of 3 |
| Google Docs viewer | 558 ms | n/a | n/a | 622 MB (+16 MB) | n/a | 3 of 3 |
| Apryse WebViewer | 300 ms | 300 ms | 18 MB | 715 MB (+52 MB) | n/a | 3 of 3 |
| Nutrient | 3.96 s | 3.96 s | 20 MB | 786 MB (+188 MB) | n/a | 3 of 3 |
| react-docx | 988 ms | 1.03 s | 13 MB | 513 MB (+27 MB) | 3 | 3 of 3 |
| Univer | 381 ms | 381 ms | 25 MB | 518 MB (+42 MB) | n/a | 3 of 3 |
| BetterOffice | 1.28 s | 1.28 s | 14 MB | 696 MB (+116 MB) | 3 | 2 of 3 |
| OnlyOffice (CryptPad build) | 2.55 s | 2.55 s | 50 MB | 898 MB (+230 MB) | 3 | 3 of 3 |
| OpenDoc | 813 ms | 1.04 s | 13 MB | 728 MB (+111 MB) | 3 | 3 of 3 |
| GenOffice (measured 2026-11-21: a MacBook Pro (Apple M4 Pro, 12 cores, 24 GB, with its graphics card), load median 5.1, highest 6.3, on 12 cores) | 592 ms | 592 ms | 18 MB | 590 MB (+161 MB) | 3 | 3 of 3 |
| office-open (measured 2026-11-21: a MacBook Pro (Apple M4 Pro, 12 cores, 24 GB, with its graphics card), load median 5.1, highest 6.3, on 12 cores) | 292 ms | 292 ms | 7 MB | 517 MB (+190 MB) | n/a | 3 of 3 |
| Fidus Writer (measured 2026-11-21: a MacBook Pro (Apple M4 Pro, 12 cores, 24 GB, with its graphics card), load median 5.1, highest 6.3, on 12 cores) | 183 ms | 183 ms | 5 MB | 379 MB (+45 MB) | n/a | 3 of 3 |
| docs.plus (measured 2026-11-21: a MacBook Pro (Apple M4 Pro, 12 cores, 24 GB, with its graphics card), load median 5.1, highest 6.3, on 12 cores) | 190 ms | 190 ms | 10 MB | 426 MB (+60 MB) | n/a | 3 of 3 |

**500 pages (`lorem-500.docx`)**

Host load during these runs (1-minute average): median 56.6, highest 75.7, on 64 cores.

| Engine | Loaded | Settled | JS heap | Renderer memory (growth) | Pages shown | Runs that loaded |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| canvas-editor | 18.4 s | 18.5 s | 678 MB | 4816 MB (+4396 MB) | 661 | 3 of 3 |
| Docxodus | 5.17 s | 5.17 s | 9 MB | 749 MB (+205 MB) | n/a | 3 of 3 |
| SuperDoc | 13.3 s | 13.3 s | 21 MB | 1071 MB (+515 MB) | 25 | 3 of 3 |
| Plate | 64.8 s | 64.8 s | 64 MB | 628 MB (+222 MB) | n/a | 3 of 3 |
| docen (measured 2026-11-21: a MacBook Pro (Apple M4 Pro, 12 cores, 24 GB, with its graphics card), load median 30.5, highest 40.0, on 12 cores) | 2.30 s | still busy after 180 s | 128 MB | 1781 MB (+1343 MB) | n/a | 3 of 3 |
| docx-editor.dev | 5.20 s | 5.20 s | 121 MB | 702 MB (+243 MB) | n/a | 3 of 3 |
| folio | 14.0 s | 14.0 s | 44 MB | 2389 MB (+1970 MB) | 500 | 3 of 3 |
| WordCraft | 3.81 s | still busy after 180 s | 4 MB | 710 MB (−42 MB) | n/a | 3 of 3 |
| Microsoft Word viewer | 787 ms | n/a | n/a | 874 MB (−65 MB) | n/a | 3 of 3 |
| Google Docs viewer | 703 ms | n/a | n/a | 641 MB (+36 MB) | n/a | 3 of 3 |
| Apryse WebViewer | 911 ms | 7.11 s | 39 MB | 1522 MB (+856 MB) | n/a | 2 of 3 |
| Nutrient | 20.8 s | 20.8 s | 21 MB | 778 MB (+166 MB) | n/a | 2 of 3 |
| react-docx | 8.70 s | 8.70 s | 98 MB | 920 MB (+433 MB) | 500 | 3 of 3 |
| Univer | 29.3 s | 29.3 s | 880 MB | 2394 MB (+1916 MB) | n/a | 3 of 3 |
| BetterOffice | 8.05 s | 8.90 s | 23 MB | 1296 MB (+717 MB) | 500 | 3 of 3 |
| OnlyOffice (CryptPad build) | 12.8 s | 12.8 s | 134 MB | 949 MB (+278 MB) | 500 | 2 of 3 |
| OpenDoc | 3.54 s | 7.01 s | 12 MB | 910 MB (+291 MB) | 500 | 3 of 3 |
| GenOffice (measured 2026-11-21: a MacBook Pro (Apple M4 Pro, 12 cores, 24 GB, with its graphics card), load median 4.1, highest 4.8, on 12 cores) | 531 ms | 5.50 s | 38 MB | 1072 MB (+641 MB) | 500 | 3 of 3 |
| office-open (measured 2026-11-21: a MacBook Pro (Apple M4 Pro, 12 cores, 24 GB, with its graphics card), load median 4.1, highest 4.8, on 12 cores) | 533 ms | 533 ms | 7 MB | 692 MB (+364 MB) | n/a | 3 of 3 |
| Fidus Writer (measured 2026-11-21: a MacBook Pro (Apple M4 Pro, 12 cores, 24 GB, with its graphics card), load median 4.1, highest 4.8, on 12 cores) | 292 ms | 292 ms | 7 MB | 458 MB (+122 MB) | n/a | 3 of 3 |
| docs.plus (measured 2026-11-21: a MacBook Pro (Apple M4 Pro, 12 cores, 24 GB, with its graphics card), load median 4.1, highest 4.8, on 12 cores) | 582 ms | 582 ms | 13 MB | 576 MB (+210 MB) | n/a | 3 of 3 |
<!-- samples:end -->

What to know when reading them:

- **These figures are the pass of 2026-11-20** (it ran past midnight UTC, so the heading says
  2026-11-21): one job on one host, every engine, 3 runs per engine and sample, made with the
  corrected script (see "Figures to distrust"). The machine is a Linux one with 16 vCPU and no
  GPU (Chrome draws in software). The tables of 2026-11-18 came from a machine with 8 vCPU, so
  the two do not form one series; the earlier files stay in `docs/samples/`.
- **The host was shared and busy.** A run starts only while the host's load average is under a
  limit, 100 for this pass (64 cores). It was 40 to 49 during the rich sample, 22 to 32 during
  the redline and 28 to 76 during the 500 pages; each run in the dated files carries its own.
  How much of that slowed our Chrome cannot be told from inside the job.
- **WordCraft is measured on release 0.18.1.** The Lighthouse tables were not taken again and
  still describe 0.17.0.
- **docen opens the 500 pages. The pass of 2026-11-20 did not wait long enough to see it**, and its
  row read "did not open it": nothing was reported within the 600 s that pass allowed. Opened by hand in
  Chrome on a Mac on 2026-11-21, its status bar read "Page 1 of 500" and 223,839 words, the page count
  Word gives; its own load returned after 8 s, and the page then did not answer for about seven minutes
  (the Mac was busy with other work). Measured again there with a 30-minute deadline, three runs on a
  quieter Mac: Loaded 2.30 s, and the main thread still busy at the end of the 180 s wait in all three.
  The row above is that measurement and says so: it is a Mac with a graphics card, not the rented
  machine of the other rows, so do not compare its seconds with theirs. What docen does during those
  minutes was not looked into. The deadline is now 30 minutes (`scripts/hf_job.sh`).
- **Page counts differ by engine** on the 500-page file. canvas-editor's 661 is its own layout:
  it gave 637 on a Mac with Times as the fallback and 650 with a Calibri-metric font loaded
  (2026-11-20), so the count is not a font accident. OnlyOffice shows 500.
- **canvas-editor's memory on the 500 pages** is 678 MB of JavaScript heap after a collection (it
  keeps one object per character: 1.6 million of them) and 4.8 GB of renderer memory. The
  renderer figure is this machine's: with no GPU, Chrome keeps each of the 661 page canvases in
  the renderer's own memory. On a Mac with a GPU the same page read 0.5 to 1.8 GB (the files of
  2026-11-15 and 2026-11-17).
- **Pages shown** counts what is in the DOM: SuperDoc keeps only the pages near
  the viewport (25), so its number is not a page count of the document.
- **Renderer memory growth** can be negative: the "before" reading is taken one
  second after startup, when the engine's start-up garbage is still resident.
- 7 of the 153 runs in these tables did not load. docen once on the
  redline, when a module of its package did not download; the Microsoft Word viewer and Nutrient
  were once each not ready within 600 s on the rich sample; BetterOffice's page once did not
  start; and on the 500 pages the site once closed the connection (OnlyOffice) and twice
  answered an error status (Apryse, Nutrient). The three docen runs on the 500 pages that the
  2026-11-20 pass counted as not loaded were its deadline, not docen (above), and its row is now the
  three runs measured on the Mac. Each reason is in the dated file, and the last
  column of the tables says how many runs each median stands on.
- **Settled cannot see everything**: see the definition below. An engine that
  starts work more than two seconds after it last kept the thread busy would
  read as settled before that work.

#### Figures to distrust

Every figure that stood far from its neighbours, or that the method cannot really measure, was
looked at again on 2026-11-20: by hand, in Chrome on a Mac, on the live site. Two faults of the
measuring and one of an adapter were found and corrected, and the tables above were then taken
again. Each row says what was wrong and what the new pass shows.

| Figure in the tables | Verdict | What was seen |
| --- | --- | --- |
| **OnlyOffice, 500 pages: 409 pages, Settled 3.56 s** (2026-11-18) | **Was wrong; corrected** | OnlyOffice reported the document ready and went on paginating in slices too short to count as long tasks. Watched by hand: 52, 103, 154 … 409, 460 and 500 pages; the three runs of 2026-11-18 read 409, 358 and 409. Settled now also waits until the page count has not changed for five seconds. The new pass: 500 pages in both runs that loaded, Loaded and Settled 10.4 s and 15.2 s. |
| **docx-editor.dev, Loaded: 190 ms, 160 ms, 284 ms** (2026-11-18) | **Was not a measurement; corrected** | Its adapter's `load()` handed the bytes to the engine and returned at once (`ref.load(bytes)`, nothing awaited), so the column timed the call. The adapter now waits for the engine's layout. The new pass: 1.38 s, 1.37 s and 5.20 s on the three samples. |
| **docx-editor.dev, 500 pages: Settled 1.19 s** (2026-11-18) | **Was not reliable; steadier now** | Its work comes in bursts with pauses, and Settled stopped at the first pause of two seconds: the 11 runs then on file ranged from 610 ms to 5.45 s. With the adapter waiting for the layout the three new runs read 5.06 s, 5.20 s and 5.93 s. By hand on a Mac its main thread was busy for 11.1 s after the click, so work after the layout may still go unseen. |
| **Settled, for every engine** | **Blind to sliced work** | It counts tasks of 50 ms or more (the Long Tasks API). An engine that works in shorter slices, in a Worker or on the GPU reads as settled while it is still working. The page count now catches it for the engines that show pages; for one that shows none (Docxodus, Plate, docx-editor.dev, Nutrient, Univer) nothing does. |
| **WordCraft, Settled: "still busy after 180 s"** on the rich sample and the 500 pages, 2.93 s on the redline | **This machine, not the engine** | Its Loaded is 0.5 to 3.8 s. With no GPU its canvas is drawn in software on the main thread, and those repaints are the long tasks: the three redline runs read 1.35 s, 2.93 s and 19.8 s. On the Mac runner of 2026-11-17 it settled on the 500 pages in 2.8 to 4.0 s. |
| **Renderer memory, canvas engines** (canvas-editor 4,816 MB, Univer 2,394 MB, folio 2,389 MB) | **This machine, not the engine** | With no GPU every canvas is kept in the renderer's memory; with one, most of it is in the GPU process, which the tables do not show (`gpuRss` is in the dated file). Compare these only with each other. |
| **Renderer memory, small documents** (455 to 898 MB; growth of −190 MB, −148 MB) | **Mostly Chrome** | Three or more renderer processes are resident before any document opens. The growth is the engine's part, and for a small document it is smaller than the noise: it comes out negative for WordCraft and the Microsoft Word viewer on all three samples. |
| **Univer, 500 pages: 1,772 MB of heap** (2026-11-18) | **Half of it was garbage; corrected. Not a .docx figure** | Read after a forced collection it is 880 MB in each of the three new runs (1,760 to 1,773 MB before it). It stayed at 1,888 MiB for a minute by hand, so Chrome does not collect it by itself soon. And Univer never reads the file: it holds the text this site's reader gave it (`lib/univer-doc.ts`), with no tables, pictures or page set-up. |
| **canvas-editor, every figure on the editors site** | **Confirmed** | 500 pages by hand: 17.7 s and 21.9 s to load, 637 and 650 pages, heap 700 to 730 MiB and steady for 20 s. The new pass: 18.4 s, 661 pages and 678 MB, the heap the same before and after the collection. What is misleading is its renderer memory (above). |
| **Apryse, Loaded 300 ms to 911 ms** | **Partly blind** | Its adapter waits for the SDK's `documentLoaded`, and the office engine runs in a Worker: neither Loaded nor Settled sees the pages being drawn. Its two runs on the 500 pages settled at 1.14 s and 13.1 s. |
| **docen, 500 pages: "did not open it"** (2026-11-20) | **Wrong: the test gave up too early. Corrected** | It opens the file and counts 500 pages. The page then keeps its main thread busy for minutes, longer than the 600 s that pass allowed from navigation. Seen by hand on 2026-11-21 and measured again with a 30-minute deadline on a Mac; the row is that measurement. |
| **Medians of two runs** (the rows that say "2 of 3") | **Weak** | A median of two is their mean. Seven rows stand on two runs: the Microsoft Word viewer and Nutrient on the rich sample, docen and BetterOffice on the redline, Apryse, Nutrient and OnlyOffice on the 500 pages. |
| **Sizes** | **Mislabelled** | Every "MB" in these tables is a mebibyte (1,048,576 bytes): the 680 MB of canvas-editor's heap is 713 million bytes. |

The two faults of the measuring are corrected in
[`scripts/measure_samples.py`](scripts/measure_samples.py): the page count is read until it has
not changed for five seconds (`pagesSettledMs` is when it last changed, for an engine whose count
moved after "loaded"), and the heap is read after a forced garbage collection (`heapBytes`; the
reading before it is kept as `heapBytesBeforeGc`, which is what the files up to 2026-11-18 call
`heapBytes`). In the new pass every run that loaded was collected. The others are limits of the
method, said here.

The published figures were made by this job, at commit `76ae221` (its files are in the dataset
`arthrod/open-docs-measurements` under `2026-11-20-xl1`):

```sh
hf jobs run --flavor cpu-xl --timeout 4h --secrets HF_TOKEN -e SITE=both -e RUNS=3 -e FLAVOR=cpu-xl -e MAX_LOAD=100 python:3.12 \
  bash -c 'curl -fsSL https://raw.githubusercontent.com/arthrod/open-docs/main/scripts/hf_job.sh -o /tmp/job.sh && bash /tmp/job.sh'
```

The same measuring on your own machine, which gives that machine's figures and must not be
written over the published `latest.json`:

```sh
uv run --with playwright python -I scripts/measure_samples.py all showcase,redline,lorem-500 3 \
  --out .scratch/samples/$(date +%F).json --latest .scratch/samples/latest.json --shots .scratch/shots
```

The published sample figures are taken on a Hugging Face Jobs machine (Linux, no GPU; the pass of
2026-11-20 on `cpu-xl`, 16 vCPU and 124 GB; the one of 2026-11-18 on `cpu-upgrade`, 8 vCPU and
32 GB, whose hosts were too busy all of 2026-11-20 for a run to start) by
[`scripts/hf_job.sh`](scripts/hf_job.sh), because a timing taken on a laptop that is doing other
work is slower than the engine, and anyone can rent the same machine. Every run records the load
average and the Chrome version, so the dated file shows both. That load average and core count
are the shared host's (64 cores), not ours: a run waits until the load is under a limit
(`MAX_LOAD`, 100 for this pass), it was between 22 and 76 during these runs, and how much of
that slowed our Chrome cannot be told from inside the job.
Chrome runs headed under Xvfb and draws in software. Read the figures as that machine's; what
carries to another machine is the order between engines, not the seconds. The
[Measure workflow](.github/workflows/measure.yml) (push a branch named `measure/<anything>`)
still takes the same figures on a GitHub-hosted macOS runner, where the files before 2026-11-18
come from.

One (engine, sample) per launch of the installed Google Chrome, headed, with a
fresh profile. The page opens on its blank document, then the script clicks the
Menu's own button. **Loaded** is the click until the adapter's `load()` returns
(plus two frames). **Settled** is the click until the main thread has been quiet
for two seconds (counted from the later of the last long task and the load's
return), taken from the Long Tasks API. With the script of 2026-11-20, where an
engine's page count still moved after that, Settled is when the count last
changed (the run says `settledBy: "pages"` and keeps the other reading as
`settledMsLongTasks`; the row counts such runs in `settledByPages`), and a run
whose count was still moving after 180 s has no Settled. Work an engine starts more than two
seconds after it last kept the thread busy is not seen, and the wait gives up
after 180 s ("still busy"). Several engines keep working after their loader
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

Measured 2026-11-16: PageSpeed Insights (pagespeed.web.dev), Lighthouse 13.6.0 on Google's servers, 5 analyses per page and form factor, median of those that gave a result. Cells read desktop · mobile; accessibility, best practices and SEO are the desktop scores.

| Page | Performance | LCP | TBT | CLS | FCP | Speed Index | Accessibility | Best practices | SEO | Performance, each analysis |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| canvas-editor | 100 · 95 | 231 ms · 1.84 s | 10 ms · 6 ms | 0 · 0 | 231 ms · 1.84 s | 813 ms · 4.73 s | 94 | 100 | 80 | 100/100/100/100/100 · 95/82/95/96/72 |
| cite-check | 100 · 95 | 214 ms · 1.82 s | 20 ms · 0 ms | 0 · 0 | 214 ms · 1.82 s | 656 ms · 4.69 s | 94 | 100 | 80 | 100/100/100/100/100 · 95/95/95/95/96 |
| Docxodus | 59 · 77 | 3.37 s · 783 ms | 559 ms · 837 ms | 0.006 · 0.018 | 214 ms · 778 ms | 1.77 s · 4.61 s | 96 | 100 | 90 | 72/59/50/67/45 · 78/87/70/51/77 |
| SuperDoc | 71 · 69 | 447 ms · 1.66 s | 720 ms · 547 ms | 0.001 · 0.067 | 447 ms · 1.66 s | 1.98 s · 10.6 s | 100 | 100 | 90 | 71/76/72/68/68 · 69/71/43/75/45 |
| Plate | 100 · 99 | 228 ms · 772 ms | 81 ms · 27 ms | 0 · 0.018 | 228 ms · 772 ms | 878 ms · 3.35 s | 92 | 100 | 90 | 100/97/96/100/100 · 99/99/99/98/99 |
| docen | 73 · 75 | 224 ms · 773 ms | 585 ms · 748 ms | 0 · 0.024 | 224 ms · 773 ms | 1.85 s · 6.82 s | 79 | 88 | 90 | 74/71/75/71/73 · 77/75/75/70/82 |
| docx-editor.dev | 97 · 67 | 449 ms · 19.4 s | 57 ms · 51 ms | 0 · 0.018 | 449 ms · 1.66 s | 1.69 s · 7.09 s | 97 | 100 | 90 | 96/97/98/94/100 · 92/93/59/67/66 |
| folio | 89 · 61 | 445 ms · 1.66 s | 256 ms · 379 ms | 0 · 0.037 | 445 ms · 1.66 s | 1.63 s · 5.92 s | 81 | 96 | 90 | 91/81/89/78/89 · 50/40/63/61/99 |
| WordCraft | **no result**: the engine failed on Google's machine, so there is no score: [open-docs] WordCraft failed to start TypeError: Failed to fetch at Module.__wbg_init (https://edit | | | | | | | | | |
| Microsoft Word viewer | 96 · 97 | 212 ms · 1.60 s | 0 ms · 0 ms | 0.074 · 0 | 212 ms · 1.42 s | 1.80 s · 4.30 s | 100 | 73 | 90 | 96/96/95/97/96 · 92/100/97/90/99 |
| Google Docs viewer | 98 · 96 | 212 ms · 1.22 s | 100 ms · 56 ms | 0.001 · 0 | 212 ms · 1.22 s | 1.37 s · 3.90 s | 100 | 54 | 90 | 99/100/88/98/89 · 99/100/61/89/96 |
| Apryse WebViewer | 68 · 73 | 224 ms · 769 ms | 858 ms · 848 ms | 0 · 0.003 | 224 ms · 769 ms | 2.08 s · 6.50 s | 100 | 96 | 90 | 70/68/68/72/66 · 77/74/69/72/73 |
| Nutrient | **no result**: the engine failed on Google's machine, so there is no score: [open-docs] Nutrient Web SDK failed to start PSPDFKitError: download 'https://cdn.cloud.pspdfkit.co | | | | | | | | | |
| react-docx (measured 2026-11-20) | 99 · 96 | 212 ms · 769 ms | 32 ms · 52 ms | 0 · 0.018 | 212 ms · 764 ms | 1.35 s · 4.25 s | 100 | 100 | 90 | 99/95/98/99/99 · 81/75/96/100/99 |
| Univer (measured 2026-11-20) | 93 · 85 | 445 ms · 1.66 s | 168 ms · 290 ms | 0.005 · 0.02 | 445 ms · 1.66 s | 1.59 s · 7.74 s | 83 | 100 | 90 | 93/91/98/93/94 · 88/85/35/83/88 |
| OpenDoc (measured 2026-11-20) | 85 · 76 | 214 ms · 763 ms | 226 ms · 374 ms | 0.064 · 0.032 | 214 ms · 763 ms | 2.83 s · 11.6 s | 100 | 100 | 90 | 85/86/75/79/86 · 61/70/86/76/86 |
| BetterOffice (measured 2026-11-20) | 98 · 94 | 245 ms · 905 ms | 59 ms · 77 ms | 0 · 0.018 | 245 ms · 905 ms | 1.59 s · 6.24 s | 96 | 88 | 90 | 98/98/99/96/98 · 91/89/94/96/95 |
| OnlyOffice (CryptPad build) (measured 2026-11-20) | 100 · 100 | 217 ms · 772 ms | 0 ms · 0 ms | 0 · 0 | 217 ms · 772 ms | 429 ms · 2.30 s | 100 | 96 | 90 | 100/100/100/100/100 · 100/100/100/100/100 |
| GenOffice (measured 2026-11-21) | 83 · 83 | 225 ms · 764 ms | 338 ms · 306 ms | 0.054 · 0.115 | 213 ms · 764 ms | 1.64 s · 7.10 s | 100 | 96 | 90 | 75/83/92/82/94 · 82/83/86/85/83 |
| office-open (measured 2026-11-21) | 100 · 92 | 212 ms · 778 ms | 0 ms · 0 ms | 0 · 0.17 | 212 ms · 778 ms | 879 ms · 2.48 s | 100 | 100 | 90 | 100/100/100/100/100 · 87/93/92/92/92 |
| Fidus Writer (measured 2026-11-21) | 100 · 99 | 224 ms · 775 ms | 68 ms · 59 ms | 0 · 0.027 | 224 ms · 775 ms | 1.05 s · 3.18 s | 100 | 100 | 90 | 99/100/100/100/95 · 81/100/98/99/99 |
| docs.plus (measured 2026-11-21) | 99 · 96 | 213 ms · 905 ms | 37 ms · 84 ms | 0.001 · 0.018 | 213 ms · 905 ms | 1.20 s · 4.18 s | 100 | 100 | 90 | 97/100/93/100/99 · 94/96/98/95/98 |

**Opening the 500 pages sample (`?open=lorem-500.docx`)**

| Page | Performance | LCP | TBT | CLS | FCP | Speed Index | Accessibility | Best practices | SEO | Performance, each analysis |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| canvas-editor | 70 · n/a | 217 ms · n/a | 9.98 s · n/a | 0.004 · n/a | 217 ms · n/a | 698 ms · n/a | 94 | 100 | 80 | fail/70/fail/fail/fail · fail/fail/fail/fail/fail |
| cite-check | **no result**: PageSpeed gave no result within 240 s: the page never finished loading for it | | | | | | | | | |
| Docxodus | 36 · 34 | 9.67 s · 43.7 s | 8.17 s · 6.86 s | 0.006 · 0.018 | 214 ms · 2.27 s | 4.13 s · 8.73 s | 96 | 100 | 90 | 36/36/35/35/36 · 34/fail/36/35/34 |
| SuperDoc | 72 · 75 | 447 ms · 1.69 s | 678 ms · 519 ms | 0.001 · 0.037 | 447 ms · 1.69 s | 1.85 s · 9.22 s | 100 | 100 | 90 | 73/69/75/fail/71 · 78/73/44/fail/77 |
| Plate | **no result**: PageSpeed gave no result within 240 s: the page never finished loading for it | | | | | | | | | |
| docen | **no result**: PAGE_HUNG: Lighthouse was unable to reliably load the URL you requested because the page stopped responding. | | | | | | | | | |
| docx-editor.dev | 60 · 35 | 452 ms · 23.0 s | 1.02 s · 2.05 s | 0.04 · 0.018 | 452 ms · 1.81 s | 4.47 s · 19.7 s | 97 | 100 | 90 | 58/59/63/60/60 · 35/34/63/35/39 |
| folio | 61 · 36 | 446 ms · 9.48 s | 15.1 s · 14.0 s | 0.001 · 0.308 | 446 ms · 1.66 s | 4.67 s · 14.8 s | 84 | 96 | 91 | 61/61/61/60/61 · fail/fail/36/37/fail |
| WordCraft | **no result**: the engine failed on Google's machine, so there is no score: [open-docs] WordCraft failed to start TypeError: Failed to fetch at Module.__wbg_init (https://edit | | | | | | | | | |
| Microsoft Word viewer | 96 · 97 | 222 ms · 762 ms | 0 ms · 0 ms | 0.075 · 0.006 | 222 ms · 762 ms | 1.84 s · 4.44 s | 100 | 73 | 90 | 97/95/95/96/97 · 97/96/98/100/97 |
| Google Docs viewer | 97 · 94 | 231 ms · 774 ms | 125 ms · 222 ms | 0.001 · 0.004 | 231 ms · 774 ms | 1.51 s · 4.05 s | 100 | 54 | 90 | 83/97/97/97/89 · 94/84/94/100/56 |
| Apryse WebViewer | 68 · 67 | 222 ms · 790 ms | 848 ms · 1.41 s | 0 · 0 | 222 ms · 790 ms | 2.00 s · 7.16 s | 100 | 96 | 90 | 68/68/77/68/77 · 67/70/77/64/63 |
| Nutrient | **no result**: the engine failed on Google's machine, so there is no score: [open-docs] Nutrient Web SDK failed to start PSPDFKitError: download 'https://cdn.cloud.pspdfkit.co | | | | | | | | | |
| react-docx (measured 2026-11-20) | 37 · 34 | 6.89 s · 42.0 s | 1.36 s · 1.89 s | 0.011 · 0.018 | 214 ms · 2.20 s | 3.93 s · 14.6 s | 96 | 100 | 90 | 85/37/37/36/fail · 30/39/36/32/fail |
| Univer (measured 2026-11-20) | 61 · 60 | 448 ms · 1.66 s | 10.2 s · 10.4 s | 0.005 · 0.02 | 448 ms · 1.66 s | 3.77 s · 11.6 s | 83 | 100 | 90 | fail/62/fail/fail/61 · fail/60/fail/fail/fail |
| OpenDoc (measured 2026-11-20) | 59 · 59 | 212 ms · 1.51 s | 8.46 s · 12.3 s | 0.076 · 0.044 | 212 ms · 1.51 s | 5.43 s · 28.7 s | 100 | 100 | 90 | 59/59/58/58/60 · 59/56/fail/60/60 |
| BetterOffice (measured 2026-11-20) | 95 · 91 | 246 ms · 906 ms | 59 ms · 138 ms | 0.001 · 0.026 | 246 ms · 906 ms | 2.41 s · 7.36 s | 96 | 100 | 90 | 95/88/97/94/97 · 92/91/88/91/93 |
| OnlyOffice (CryptPad build) (measured 2026-11-20) | 100 · 100 | 214 ms · 773 ms | 0 ms · 0 ms | 0 · 0 | 214 ms · 773 ms | 436 ms · 2.38 s | 100 | 96 | 90 | 100/100/100/100/100 · 100/100/100/100/100 |
| GenOffice (measured 2026-11-21) | **no result**: PageSpeed refused the address: Oops! Something went wrong. | | | | | | | | | |
| office-open (measured 2026-11-21) | 67 · 51 | 214 ms · 919 ms | 1.59 s · 1.47 s | 0 · 0.326 | 214 ms · 919 ms | 2.01 s · 4.95 s | 100 | 100 | 90 | 67/64/64/68/68 · 25/56/45/58/51 |
| Fidus Writer (measured 2026-11-21) | 75 · 90 | 213 ms · 905 ms | 625 ms · 382 ms | 0.008 · 0.027 | 213 ms · 905 ms | 1.22 s · 3.94 s | 100 | 100 | 90 | 72/75/73/94/93 · 51/91/72/92/90 |
| docs.plus (measured 2026-11-21) | 66 · 69 | 216 ms · 762 ms | 2.08 s · 1.49 s | 0.001 · 0.018 | 216 ms · 762 ms | 2.02 s · 6.17 s | 100 | 100 | 90 | 65/68/66/66/66 · 63/71/38/69/71 |
<!-- lighthouse:end -->

Read these with care:

- **WordCraft and Nutrient have no score.** On Google's machine their engines (about 60 and 70 MB) do not
  download, the page shows "failed to start", and an error box paints fast: the scores published here before
  2026-11-16 (WordCraft 100, Nutrient 75) were of that failure page. The measuring script now reads the page's
  own console error from the report and records such an analysis as a failure. Why the download fails there is
  not known; the same files download normally in a browser and with `curl`.
- **A score is a median of five analyses, and the analyses disagree**: the last column lists each one. Mobile
  scores of the same page in the same run differ by 30 points or more for several engines.
- **PageSpeed sometimes refuses an address** ("Unable to resolve …") that it analyses a minute later. Those are
  listed as `fail`, with PageSpeed's own words in the data file.
- **On the 500 pages, LCP is mostly this site's frame**, which paints before any document. What the document
  costs shows in TBT and in the analyses that never finished (`fail`).
- **`?open=<file>`**: an editor mounts on a blank document and then opens the file from its Menu; a view-only
  engine starts on the file. Before 2026-11-16 a view-only engine loaded the rich sample first and then the file.
- **The five engines added on 2026-11-18 were analysed on 2026-11-20**, the others on 2026-11-16: their rows
  say so. Their first attempt that day was thrown away: asked five times in three minutes, PageSpeed answered 18
  of the 50 requests with an analysis it had already made, so "five analyses" were two or three. The script now
  recognises such a copy by the time Lighthouse made it, asks again after a pause and never counts it twice.
  The rows of 2026-11-16 have no copies (checked: no two analyses of a page share their figures).
- **OnlyOffice's 100 · 100 is not the engine's score.** Its editor, and OpenDoc's application, run in a frame
  inside the page, and Lighthouse's paint and blocking-time figures are the top page's: OnlyOffice scores 100
  with a blank document and with the 500 pages alike, while it downloads 18 MB and paginates for seconds. Read
  both rows as the frame page, like Microsoft's and Google's viewers.
- **BetterOffice's row on the 500 pages was taken twice.** First, three of the five desktop analyses had no
  score (the other two scored 89 and 96, and the row showed none: a row with a failed analysis shows its error): the sample failed to open on Google's machine with "Document was replaced", which the engine raises
  when a document's identity moves under a wait, with nobody replacing anything. The adapter now takes the
  wait up again (`editors/betteroffice/main.ts`), and the row was analysed again the same day: five of five
  on desktop (88 to 97) and on mobile (88 to 93).

#### Lighthouse on our computer

On Google's machines WordCraft and Nutrient do not start (their engines do not download there, and why is not
known: see above), so they have no score above. The same Lighthouse release also runs here, on a computer that
has a graphics card, which Google's machines do not, and on every page, not only on those two (`uv run python -I scripts/measure_lighthouse_local.py`, same
arguments as the PageSpeed script). The price is that these figures depend on this computer and on what else
it was doing: the heading gives its load and Lighthouse's own reading of how fast its processor was during the
analyses. Compare rows within this table, not with PageSpeed's.

<!-- lighthouse-local:start -->
**Blank document (the page as it opens)**

Measured 2026-11-21: Lighthouse 13.6.0 run on a MacBook Pro (Apple M4 Pro, 12 cores, 24 GB, with its graphics card), Google Chrome 158.0.8127.36, headless, 3 analyses per page and form factor, median of those that gave a result; Lighthouse's CPU benchmark index median 4123, lowest 3550; machine load (1-minute average) median 5.8, highest 17.1, on 12 cores. Cells read desktop · mobile; accessibility, best practices and SEO are the desktop scores.

| Page | Performance | LCP | TBT | CLS | FCP | Speed Index | Accessibility | Best practices | SEO | Performance, each analysis |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| canvas-editor (measured 2026-11-21: Lighthouse's CPU benchmark index median 4210, lowest 4165, load median 2.4, highest 4.2, on 12 cores) | 100 · 99 | 401 ms · 899 ms | 0 ms · 52 ms | 0 · 0.018 | 401 ms · 899 ms | 773 ms · 1.87 s | 94 | 100 | 80 | 100/100/100 · 100/77/99 |
| cite-check | 100 · 99 | 349 ms · 938 ms | 0 ms · 70 ms | 0 · 0 | 349 ms · 938 ms | 629 ms · 1.93 s | 94 | 100 | 80 | 100/100/100 · 99/99/100 |
| Docxodus | 95 · 79 | 1.04 s · 1.00 s | 126 ms · 706 ms | 0.006 · 0.018 | 360 ms · 1.00 s | 1.52 s · 4.82 s | 96 | 100 | 90 | 95/95/95 · 79/78/80 |
| SuperDoc | 95 · 82 | 658 ms · 1.86 s | 53 ms · 392 ms | 0.018 · 0.067 | 658 ms · 1.86 s | 2.14 s · 6.97 s | 100 | 100 | 90 | 77/96/95 · 80/82/82 |
| Plate | 100 · 100 | 381 ms · 1.00 s | 0 ms · 29 ms | 0 · 0.018 | 381 ms · 1.00 s | 578 ms · 2.07 s | 92 | 100 | 90 | 100/100/100 · 100/100/100 |
| docen (measured 2026-11-21: Lighthouse's CPU benchmark index median 4254, lowest 4194, load median 2.7, highest 3.4, on 12 cores) | 99 · 87 | 296 ms · 903 ms | 21 ms · 410 ms | 0 · 0.024 | 296 ms · 903 ms | 1.33 s · 4.19 s | 79 | 88 | 90 | 99/100/99 · 89/87/87 |
| docx-editor.dev (measured 2026-11-21: Lighthouse's CPU benchmark index median 4287, lowest 4196, load median 2.4, highest 3.5, on 12 cores) | 97 · 94 | 645 ms · 1.82 s | 0 ms · 39 ms | 0 · 0.018 | 645 ms · 1.82 s | 1.66 s · 5.46 s | 97 | 100 | 90 | 97/97/98 · 94/94/94 |
| folio (measured 2026-11-21: Lighthouse's CPU benchmark index median 4287, lowest 4196, load median 2.4, highest 3.5, on 12 cores) | 99 · 71 | 616 ms · 1.80 s | 14 ms · 200 ms | 0 · 0.598 | 616 ms · 1.80 s | 1.25 s · 4.17 s | 81 | 100 | 90 | 99/99/99 · 71/70/99 |
| WordCraft (measured 2026-11-21: Lighthouse's CPU benchmark index median 4287, lowest 4196, load median 2.4, highest 3.5, on 12 cores) | 89 · 72 | 360 ms · 903 ms | 108 ms · 762 ms | 0.001 · 0.018 | 360 ms · 903 ms | 6.93 s · 26.2 s | 94 | 96 | 90 | 89/89/89 · 71/72/72 |
| Microsoft Word viewer | 100 · 100 | 333 ms · 907 ms | 0 ms · 6 ms | 0.001 · 0 | 333 ms · 907 ms | 977 ms · 2.72 s | 100 | 73 | 90 | 100/100/98 · 100/100/100 |
| Google Docs viewer | 83 · 81 | 338 ms · 923 ms | 0 ms · 0 ms | 0.333 · 0.396 | 338 ms · 923 ms | 756 ms · 2.37 s | 100 | 73 | 90 | 83/83/84 · 81/81/81 |
| Apryse WebViewer | 94 · 72 | 346 ms · 876 ms | 49 ms · 751 ms | 0 · 0.076 | 346 ms · 876 ms | 2.40 s · 8.74 s | 100 | 96 | 90 | 95/93/94 · 72/75/71 |
| Nutrient | 83 · 57 | 2.26 s · 12.0 s | 64 ms · 441 ms | 0.002 · 0 | 318 ms · 867 ms | 2.17 s · 7.46 s | 100 | 100 | 91 | 66/84/83 · 58/57/55 |
| react-docx | 100 · 97 | 342 ms · 925 ms | 0 ms · 203 ms | 0 · 0.018 | 342 ms · 925 ms | 1.06 s · 2.43 s | 100 | 100 | 90 | 100/99/100 · 97/97/95 |
| Univer | 98 · 95 | 594 ms · 1.69 s | 0 ms · 72 ms | 0.011 · 0.048 | 594 ms · 1.69 s | 1.35 s · 5.09 s | 83 | 100 | 90 | 98/99/98 · 95/95/95 |
| OpenDoc | 93 · 80 | 354 ms · 948 ms | 18 ms · 435 ms | 0.063 · 0.033 | 354 ms · 948 ms | 2.61 s · 10.6 s | 100 | 100 | 90 | 100/93/92 · 79/82/80 |
| BetterOffice (measured 2026-11-21: Lighthouse's CPU benchmark index median 4287, lowest 4196, load median 2.4, highest 3.5, on 12 cores) | 100 · 99 | 315 ms · 962 ms | 0 ms · 51 ms | 0 · 0.018 | 315 ms · 962 ms | 945 ms · 3.15 s | 96 | 88 | 90 | 100/100/100 · 99/98/100 |
| OnlyOffice (CryptPad build) (measured 2026-11-21: Lighthouse's CPU benchmark index median 4287, lowest 4196, load median 2.4, highest 3.5, on 12 cores) | 90 · 66 | 262 ms · 818 ms | 96 ms · 1.17 s | 0.002 · 0.044 | 262 ms · 818 ms | 4.59 s · 22.4 s | 96 | 96 | 90 | 90/90/100 · 66/66/100 |
| GenOffice (measured 2026-11-21: Lighthouse's CPU benchmark index median 4297, lowest 4240, load median 2.8, highest 3.7, on 12 cores) | 98 · 88 | 337 ms · 893 ms | 15 ms · 229 ms | 0.054 · 0.116 | 337 ms · 893 ms | 1.38 s · 5.37 s | 100 | 96 | 90 | 97/99/98 · 88/87/88 |
| office-open (measured 2026-11-21: Lighthouse's CPU benchmark index median 4297, lowest 4240, load median 2.8, highest 3.7, on 12 cores) | 100 · 93 | 363 ms · 960 ms | 0 ms · 6 ms | 0 · 0.163 | 363 ms · 960 ms | 771 ms · 1.99 s | 100 | 100 | 90 | 100/100/100 · 93/92/93 |
| Fidus Writer (measured 2026-11-21: Lighthouse's CPU benchmark index median 4297, lowest 4240, load median 2.8, highest 3.7, on 12 cores) | 100 · 100 | 342 ms · 904 ms | 0 ms · 86 ms | 0 · 0.029 | 342 ms · 904 ms | 859 ms · 2.32 s | 100 | 100 | 90 | 100/90/100 · 100/99/100 |
| docs.plus (measured 2026-11-21: Lighthouse's CPU benchmark index median 4297, lowest 4240, load median 2.8, highest 3.7, on 12 cores) | 100 · 99 | 353 ms · 951 ms | 0 ms · 119 ms | 0 · 0.018 | 353 ms · 951 ms | 988 ms · 2.44 s | 100 | 100 | 90 | 100/100/100 · 99/99/99 |

**Opening the 500 pages sample (`?open=lorem-500.docx`)**

Measured 2026-11-21: Lighthouse 13.6.0 run on a MacBook Pro (Apple M4 Pro, 12 cores, 24 GB, with its graphics card), Google Chrome 158.0.8127.36, headless, 3 analyses per page and form factor, median of those that gave a result; Lighthouse's CPU benchmark index median 4108, lowest 3621; machine load (1-minute average) median 7.0, highest 14.4, on 12 cores. Cells read desktop · mobile; accessibility, best practices and SEO are the desktop scores.

| Page | Performance | LCP | TBT | CLS | FCP | Speed Index | Accessibility | Best practices | SEO | Performance, each analysis |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| canvas-editor | 67 · 40 | 385 ms · 945 ms | 5.89 s · 10.3 s | 0.004 · 0.827 | 385 ms · 945 ms | 1.93 s · 6.35 s | 94 | 100 | 80 | 66/67/67 · 40/40/40 |
| cite-check | 70 · 41 | 357 ms · 7.26 s | 9.95 s · 10.2 s | 0.019 · 0.057 | 357 ms · 963 ms | 607 ms · 5.88 s | 94 | 100 | 80 | 70/70/100 · 41/41/40 |
| Docxodus | 37 · 36 | 6.89 s · 40.7 s | 2.11 s · 8.90 s | 0.006 · 0.018 | 350 ms · 883 ms | 3.77 s · 10.9 s | 96 | 100 | 90 | 37/37/37 · 36/36/36 |
| SuperDoc | 95 · 82 | 625 ms · 1.79 s | 55 ms · 387 ms | 0.018 · 0.029 | 625 ms · 1.79 s | 2.08 s · 7.49 s | 100 | 100 | 90 | 95/95/95 · 82/82/81 |
| Plate | 45 · 35 | 11.9 s · 20.0 s | 11.8 s · 17.4 s | 0.006 · 0.018 | 333 ms · 903 ms | 663 ms · 14.8 s | 96 | 100 | 90 | 45/45/45 · 35/35/35 |
| docen (measured 2026-11-21: load median 2.2, highest 2.5, on 12 cores) | **no result**: Lighthouse stopped while waiting for the page and wrote no report | | | | | | | | | |
| docx-editor.dev | 96 · 67 | 599 ms · 1.80 s | 64 ms · 1.26 s | 0 · 0.018 | 599 ms · 1.80 s | 1.94 s · 7.64 s | 97 | 100 | 90 | 96/93/97 · 67/66/68 |
| folio | 62 · 59 | 610 ms · 1.85 s | 2.60 s · 10.8 s | 0 · 0.054 | 610 ms · 1.85 s | 3.09 s · 10.1 s | 84 | 100 | 91 | 62/62/63 · 58/59/59 |
| WordCraft | 58 · 60 | 352 ms · 901 ms | 1.32 s · 5.80 s | 0.105 · 0.018 | 352 ms · 901 ms | 9.48 s · 37.9 s | 94 | 96 | 90 | 57/58/58 · 60/60/60 |
| Microsoft Word viewer | 98 · 100 | 368 ms · 891 ms | 0 ms · 0 ms | 0.074 · 0 | 368 ms · 891 ms | 1.08 s · 2.68 s | 100 | 73 | 90 | 98/97/100 · 98/100/100 |
| Google Docs viewer | 78 · 81 | 352 ms · 922 ms | 0 ms · 2 ms | 0.332 · 0.4 | 352 ms · 922 ms | 2.55 s · 2.16 s | 100 | 73 | 90 | 78/100/75 · 81/81/81 |
| Apryse WebViewer | 94 · 71 | 363 ms · 892 ms | 51 ms · 788 ms | 0 · 0.076 | 363 ms · 892 ms | 2.54 s · 9.40 s | 100 | 96 | 90 | 94/93/94 · 70/78/71 |
| Nutrient | 99 · 86 | 308 ms · 860 ms | 66 ms · 409 ms | 0.001 · 0.007 | 308 ms · 860 ms | 1.33 s · 4.83 s | 100 | 100 | 90 | 99/99/99 · 86/86/87 |
| react-docx | 41 · 36 | 6.92 s · 42.1 s | 873 ms · 4.20 s | 0 · 0.018 | 324 ms · 910 ms | 2.79 s · 9.53 s | 96 | 100 | 90 | 41/41/41 · 36/36/37 |
| Univer | 64 · 59 | 602 ms · 1.70 s | 4.12 s · 10.3 s | 0.013 · 0.02 | 602 ms · 1.70 s | 2.47 s · 14.5 s | 83 | 100 | 90 | 63/64/64 · 59/59/59 |
| OpenDoc | 59 · 60 | 363 ms · 905 ms | 1.84 s · 16.6 s | 0.088 · 0.04 | 363 ms · 905 ms | 3.95 s · 17.2 s | 100 | 100 | 90 | 59/60/59 · 60/60/60 |
| BetterOffice | 99 · 100 | 293 ms · 960 ms | 0 ms · 0 ms | 0.001 · 0 | 293 ms · 960 ms | 1.26 s · 1.61 s | 97 | 88 | 90 | 99/100/99 · 100/100/97 |
| OnlyOffice (CryptPad build) (measured 2026-11-21: Lighthouse's CPU benchmark index median 4206, lowest 4142, load median 2.4, highest 2.9, on 12 cores) | 61 · 60 | 252 ms · 795 ms | 1.22 s · 6.91 s | 0.01 · 0.044 | 252 ms · 795 ms | 7.55 s · 33.4 s | 96 | 96 | 90 | 61/61/61 · 60/60/60 |
| GenOffice (measured 2026-11-21: Lighthouse's CPU benchmark index median 4228, lowest 4150, load median 2.7, highest 3.4, on 12 cores) | 59 · 50 | 294 ms · 843 ms | 7.81 s · 11.7 s | 0.11 · 0.211 | 294 ms · 843 ms | 3.06 s · 11.3 s | 100 | 96 | 90 | 59/59/60 · 57/50/50 |
| office-open (measured 2026-11-21: Lighthouse's CPU benchmark index median 4228, lowest 4150, load median 2.7, highest 3.4, on 12 cores) | 94 · 57 | 342 ms · 900 ms | 186 ms · 1.01 s | 0 · 0.487 | 342 ms · 900 ms | 1.00 s · 2.38 s | 100 | 100 | 90 | 94/95/94 · 57/56/57 |
| Fidus Writer (measured 2026-11-21: Lighthouse's CPU benchmark index median 4228, lowest 4150, load median 2.7, highest 3.4, on 12 cores) | 100 · 93 | 319 ms · 902 ms | 0 ms · 277 ms | 0.009 · 0.059 | 319 ms · 902 ms | 820 ms · 2.12 s | 100 | 100 | 90 | 100/100/100 · 93/94/93 |
| docs.plus (measured 2026-11-21: Lighthouse's CPU benchmark index median 4228, lowest 4150, load median 2.7, highest 3.4, on 12 cores) | 86 · 71 | 349 ms · 912 ms | 316 ms · 2.18 s | 0.001 · 0.018 | 349 ms · 912 ms | 1.20 s · 3.47 s | 100 | 100 | 90 | 86/86/86 · 71/70/71 |
<!-- lighthouse-local:end -->

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

**The five engines added on 2026-11-18 do not meet rule 1.** None of them has a
command that replaces a whole document and lands in its own history, so an
assistant edit **opens a new document** built from the Markdown
(`@platejs/markdown` → `@platejs/docx-io`; for Univer, this site's reader), and
the assistant offers no Undo there:

| Engine | Why the edit is a new document | Reads back |
| --- | --- | --- |
| react-docx | its controller has no command that replaces the document from HTML or Markdown | its .docx (`getDocxBytes()`) |
| OpenDoc | its host contract (0.1.0-alpha) cannot be handed a document: the adapter puts a File on its own file input, as a user would | its .docx export, caught on the way to the download |
| BetterOffice | its `applyEdits` takes plain-text steps and refuses a full replacement | its .docx (`save()`) |
| OnlyOffice (CryptPad build) | the document is opened in a new editor | editor binary → x2t → .docx |
| GenOffice, office-open, docs.plus | the demo build has no call that takes a document: its page is loaded again on the new file | the .docx its own Download produces |
| Fidus Writer | none: its exporter fails, so an edit could not be read back | none |
| Univer | it has no .docx reader or writer (those are in its Server SDK) | its body, through `lib/univer-doc.ts` |

All thirteen were run through the probes below on 2026-11-20 (the table under
"Measured with").

### Four more, through the editors trial's demo builds (2026-11-21)

GenOffice, office-open, Fidus Writer and docs.plus are the four tools of the
[editors trial](https://benchmarks.law/editors-trial/) that had no page here.
None of them publishes a package a page can load, so each runs as the trial's
own demo build of it (the project's code at the commit the trial measured, in a
same-origin frame mirrored from `benchmarks.law/demo-apps/`). Opening a file
loads that frame again with the document; export presses the demo's own
Download ([`lib/demo-frame.ts`](lib/demo-frame.ts)).

- **They were measured on a Mac, not on the rented machine of the other rows**
  (2026-11-21, three runs each). Their rows say so, and their times and memory
  are not comparable with the others'. Their download sizes are.
- **office-open is a library with no editor.** Its page shows what the parser
  read. docen is the editor built on it.
- **Fidus Writer's exporter failed on every sample here**: "File not found" on
  a file without `word/fontTable.xml` (the blank document), and `Namespace
  prefix "w15" is not declared` on the rich and tracked-changes samples. It has
  no assistant for that reason.
- **docs.plus needs a title.** A document without a heading, such as the blank
  one, gets the demo's placeholder title, "Complex Fixture".
- **The docs.plus demo dropped pictures; fixed here on 2026-11-22.** docs.plus hands
  each picture to an uploader. The demo build's stand-in for it knows only the
  pictures of the trial's own test file and refuses any other, which lost the
  picture. This site now replaces that one statement as it serves the demo's
  script (`docsPlusKeepPictures` in `server/site-mirror.ts`): a picture the
  stand-in does not know is handed back as an address of its own bytes. Seen in
  Chrome: the rich sample's picture shows, and the exported file holds it.
- The probes below were run for GenOffice, office-open and docs.plus on 2026-11-22; Fidus Writer cannot
  be probed, since its export fails.

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
| WordCraft | `window.wordcraft` (since v0.17.0) drives apply/undo/redo; its HTML paste turns a quote into an indented Normal paragraph (by design, `paste.rs`); Save writes the opened file's format | Save As (F12) → .docx in host mode |
| react-docx | `@extend-ai/react-docx@0.15.0`: no whole-document replace from HTML or Markdown; ships with its review marks and cards hidden | a new .docx per assistant edit (no Undo); the page turns the review marks on |
| Univer | `@univerjs/presets@1.5.2`: no .docx import or export in the open-source packages; no read-only switch in its documents preset | text and headings in through this site's reader (tables, pictures, fonts and page set-up do not carry over); **no .docx export** |
| OpenDoc | snapshot of 2026-11-05: the application is published as a website, its npm package is only a frame mount, and it opens files only from its own file input and exports only by download | runs in a same-origin frame; the adapter drives the file input and catches the export. Both lean on the application's internals and can break with a new snapshot |
| BetterOffice | `@betteroffice/docx-react@0.5.1`: `applyEdits` refuses a full replacement | a new .docx per assistant edit, which clears its history |
| OnlyOffice (CryptPad build) | v9.3.2+3: one header icon (`icon-document-white.svg`) is not in the archive and answers 404 | a new editor per assistant edit (no Undo) |

Measured with [`lib/probes/md-mapping.js`](lib/probes/md-mapping.js): it applies
a fixed markdown sample, exports the .docx, checks styles/marks/numbering/links
in `document.xml` (ten checks), and checks that the markdown read back keeps
heading levels and marks. [`lib/probes/md-edge.js`](lib/probes/md-edge.js)
round-trips the hard cases (escaped `#`/`1.` text, inline code alone in a
paragraph, a code block, backticks in code, a quote whose text also appears as a
plain paragraph, a table with a cell line break and a link).

Run on the live site on 2026-11-20, in Chrome on a Mac, once per engine:

| Engine | Mapping: in the .docx | Mapping: read back | Edge cases |
| --- | --- | --- | --- |
| docx-editor.dev | 10 of 10 | all | all |
| react-docx | 10 of 10 | all | all |
| OpenDoc | 10 of 10 | all | all |
| BetterOffice | 10 of 10 | all | all |
| OnlyOffice (CryptPad build) | 10 of 10 | all | all |
| SuperDoc | 10 of 10 | all | all but the table cell (its importers drop a line break inside a cell) |
| docen | 10 of 10 | all | all (after the reader fix below; the run before it failed the code block) |
| Docxodus | 10 of 10 | all | all but two: its Markdown parser reads ` ``a`b`` ` wrongly, and its table builder takes plain text, so a link in a cell is lost |
| folio | 10 of 10 | all | all but two: its `fromMarkdown` writes a code block as a Courier paragraph (as it writes inline code), and it adds a `/` to a bare-host link |
| Plate | 9 of 10: its own Export button writes inline code as a grey highlight in the body face, not a monospace one (that is Plate's exporter as shipped; the preparation below is applied to the assistant's Markdown for other engines, not to Plate's Export) | all | all |
| WordCraft | 10 of 10 | all but the quote: its paste makes a quote an indented Normal paragraph, which nothing tells from an indented paragraph | all but the quote; and the first paragraph kept the Heading 1 of the document it replaced (the mapping probe ran before it on the same page): **not looked into** |
| canvas-editor | 2 of 10 (the two headings): its `plugin-docx` writes no bold, italic, code, link, list or quote this probe recognises | headings and lists only | table only |
| Univer | not applicable: no .docx export | not applicable | fails seven of eight: it is handed text, so code, quotes, tables and links do not exist in it |
| GenOffice (run 2026-11-22) | 10 of 10 | all | all |
| office-open (run 2026-11-22) | 10 of 10 | all | all |
| docs.plus (run 2026-11-22) | 8 of 10: its import drops inline code and the quote (the words stay, as plain text) | all but code and the quote | all but four: a quote, inline code alone in a paragraph, a code block and backticks in code all arrive as plain text; and a first paragraph becomes the title heading, since a docs.plus document must start with one |
| Fidus Writer | not applicable: its export fails, so there is nothing to read back | not applicable | not applicable |

**The run of 2026-11-09 said all eight editors passed everything, and on
2026-11-20 that was no longer true of any engine that takes the assistant's
Markdown as a .docx.** The same day the probes were last run, the hand-written
.docx writer was replaced by Plate's exporter (`9f3a4bb`), and nobody ran them
again. Plate's exporter writes inline code as a grey highlight with no monospace
face, a quote as a bordered indent with no style, a code block as one paragraph
with its lines run together, and a line break in a table cell as three
paragraphs. The reader knew none of that, so **every assistant turn stripped
code and quotes from the document** on docx-editor.dev, Docxodus and the five
engines added on 2026-11-18 (WordCraft's lost quote is its own paste, and stays). Found by running the probes on the new five. Fixed
on both sides, without going back to a hand-written writer:

- [`lib/plate-for-word.ts`](lib/plate-for-word.ts) prepares Plate's nodes before
  its exporter runs: inline code also carries Plate's font-family mark (Courier
  New), a code block becomes one block per line, and a line break in a table
  cell becomes a paragraph break.
- [`lib/docx-markdown.ts`](lib/docx-markdown.ts) reads a left border with an
  indent as a quote, a paragraph of shaded monospace runs as code, joins
  consecutive code paragraphs into one block, and reads a style the document
  names but does not define by its id (Docxodus writes `Quote` and `Code` into
  documents that define neither).

[`lib/probes/ai-export.js`](lib/probes/ai-export.js) is the end-to-end check:
it loads the rich sample, sends the assistant a prompt through the real chat
box, waits for the edit to apply, reads the document back, then clicks
**Export** and looks for the edit inside the exported `word/document.xml`. It
passed on the first eight on 2026-11-09 (gpt-5.6-luna) and was **not** run again
on 2026-11-20, on any engine.

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

Three things to know before comparing rows of that table (looked at 2026-11-20):

- **Mount is not comparable between engines.** It runs from the call of the adapter's `mount()`.
  Adapters that import their library at the top of the module (canvas-editor, cite-check, Plate,
  docx-editor.dev, react-docx, Univer, BetterOffice) have already downloaded and compiled it by
  then; adapters that import it inside `mount()` (Docxodus, docen, folio, WordCraft) have not.
  canvas-editor's 21 ms beside docen's 848 ms (the live medians of 2026-11-20) is that difference, not the engines'. Compare
  **Startup**, which starts at navigation for all of them.
- **OpenDoc and OnlyOffice load their files inside a frame**, where this page's Resource Timing
  does not reach. The frame is same-origin, so their adapters read its own Resource Timing
  entries and hand them over (`extraResources`): their Loaded and Files are counted that way.
- **The five new engines have almost no visitor loads yet** (two or fewer each on 2026-11-20,
  BetterOffice none), so their medians are one visit.

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
lib/univer-doc.ts         Markdown blocks ⇄ Univer's document body (Univer has no .docx reader)
server/npm-vendor.ts      pinned npm packages served from this origin (react-docx, BetterOffice: their Workers)
server/site-mirror.ts     a dated snapshot of an engine's own site, served from this origin (OpenDoc)
server/zip-mirror.ts      single files out of a release archive, by range request (OnlyOffice's 608 MB zip)
server/onlyoffice.ts      the OnlyOffice editor and x2t converter, read out of CryptPad's release archives
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
  CORS, so `/vendor/wordcraft/0.18.1/*` installs itself on first request:
  it downloads the pinned release zip from GitHub, checks its SHA-256, stores
  the three runtime files gzipped in the val's blob storage, and from then on
  streams them with `content-encoding: gzip` (22 MB on the wire for a 60 MB
  wasm) and immutable caching. See [`editors/wordcraft/assets.ts`](editors/wordcraft/assets.ts).

- **Docxodus**: its .NET runtime sits beside the bundle (`dist/wasm/_framework/`) and is found
  through `import.meta.url`. esm.sh repackages the JavaScript and not that folder, so the
  self-contained `dist/embed.bundle.js` and the runtime both load from jsDelivr's npm tree.
  See [`editors/docxodus/assets.ts`](editors/docxodus/assets.ts).
- **The four view-only renderers** took nothing of this kind. Apryse WebViewer loads from
  jsDelivr's copy of its npm package and Nutrient from its own CDN, both with no license key
  (demo and trial mode: pages carry a watermark). The Microsoft Word viewer and the Google Docs
  viewer are frames on their owners' servers, given the public address of the sample.
- **react-docx, BetterOffice**: each starts a Worker with
  `new Worker(new URL("./x.js", import.meta.url))`, which a browser refuses from another
  origin, so their files cannot come from a CDN. [`server/npm-vendor.ts`](server/npm-vendor.ts)
  passes jsDelivr's copy of the pinned versions through `/vendor/npm/…` on this origin.
  BetterOffice's React package imports its core by 30 subpaths, each named in the import map.
- **Univer**: its presets load from esm.sh and its stylesheet from jsDelivr as they are. What
  it took was a reader: [`lib/univer-doc.ts`](lib/univer-doc.ts) turns this site's Markdown
  blocks into Univer's document body and back, because it has no .docx reader.
- **OpenDoc**: the application is a website, not a package. [`server/site-mirror.ts`](server/site-mirror.ts)
  serves a dated snapshot (2026-11-05, commit `5ac261c`) from this origin: the page and the
  built engine come from here, and the page's other files (about 350 modules, more requests
  than this host allows one visitor at once) from jsDelivr's copy of the repository at that
  commit.
- **OnlyOffice (CryptPad build)**: distributed as one 608 MB archive. Nothing is unpacked:
  [`server/zip-mirror.ts`](server/zip-mirror.ts) reads each file the editor asks for with one
  HTTP range request, inflates it and keeps it in blob storage. See
  [`editors/onlyoffice/README.md`](editors/onlyoffice/README.md).

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
  docen, WordCraft, react-docx, OpenDoc, BetterOffice and OnlyOffice keep the
  .docx model. canvas-editor and Plate round-trip through their own models:
  headings, lists, marks, links, quotes, code and simple tables survive; merged
  cells, fields, footnotes and comments do not. **Univer keeps only the text**:
  paragraphs, headings, bold, italic and typed list markers, and it cannot
  export a .docx.
- **Assistant edits go through markdown**, so what markdown can't say is lost
  when the assistant rewrites a document: merged cells, colours, headers and
  footers (except in SuperDoc, which edits in place and keeps the header),
  images. Plate carries underline, sub/superscript, colours and highlight as
  inline HTML through its own `remarkMdx`, so those survive there.
- **List numbering restarts and start numbers** (`3.` as the first item) are
  not carried through markdown: every numbered list starts at 1.
- **Assistant writes replace the whole document.** Undo works through the
  assistant card. SuperDoc and Plate also put the change in the editor's own
  undo stack. In react-docx, Univer, OpenDoc, BetterOffice and OnlyOffice the
  edit opens a new document and there is no Undo for it.
- **OpenDoc is a snapshot of a pre-release application** (2026-11-05), driven
  through its own file input and its download: a newer snapshot can break both.
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

Each editor keeps its own license: MIT for canvas-editor, Docxodus, Plate,
docen and react-docx; Apache-2.0 for folio, docx-editor.dev, Univer, OpenDoc and
BetterOffice; Apache-2.0 / MIT for WordCraft; **AGPL-3.0 for SuperDoc and for
OnlyOffice (CryptPad build)**. AGPL is fine for this public val but is a real
constraint for a closed product. OnlyOffice's two parts are served unmodified
out of CryptPad's release archives, and their source is those repositories at
tag `v9.3.2+3` ([`editors/onlyoffice/README.md`](editors/onlyoffice/README.md)). The four viewers are proprietary. Microsoft's
and Google's are free hosted services. Apryse and Nutrient run unlicensed in
their evaluation modes (see above).
