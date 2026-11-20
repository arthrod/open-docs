# open-docs

[![Live on Val Town](https://img.shields.io/badge/live-editors.benchmarks.law-2557d6)](https://editors.benchmarks.law)
[![Val Town](https://img.shields.io/badge/runs%20on-Val%20Town-111)](https://www.val.town/x/arthrod/open-docs)
[![Release](https://img.shields.io/github/v/tag/arthrod/open-docs?label=release)](https://github.com/arthrod/open-docs/tags)
[![Editors](https://img.shields.io/badge/editors-13-informational)](#the-editors)

Thirteen open-source Word editors, running entirely in the browser with no build
step. Each one opens on a **blank document**, has an **AI assistant** that edits
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
Measured 2026-11-18: Google Chrome 158.0.8127.36 (installed, headed) via Playwright, fresh profile per run (cold cache), 3 runs (6 for Univer, measured in both passes of the day; OpenDoc in the second only), median; a Hugging Face Jobs cpu-upgrade machine (8 vCPU, 32 GB, Linux x86-64, no GPU: Chrome draws in software; the load average and core count recorded with each run are the shared host's), Chrome under Xvfb with --no-sandbox --disable-dev-shm-usage; machine load (1-minute average) median 10.5, highest 65.4, on 64 cores.

**Rich sample (`showcase.docx`, 3 pages)**

| Engine | Loaded | Settled | JS heap | Renderer memory (growth) | Pages shown | Runs that loaded |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| canvas-editor | 397 ms | 397 ms | 9 MB | 468 MB (+48 MB) | 3 | 2 of 3 |
| Docxodus | 824 ms | 824 ms | 9 MB | 564 MB (+14 MB) | n/a | 2 of 3 |
| SuperDoc | 1.08 s | 1.08 s | 17 MB | 623 MB (+67 MB) | 3 | 2 of 3 |
| Plate | 430 ms | 430 ms | 12 MB | 454 MB (+56 MB) | n/a | 2 of 3 |
| docen | 218 ms | 218 ms | 25 MB | 563 MB (+76 MB) | n/a | 2 of 3 |
| docx-editor.dev | 190 ms | 781 ms | 25 MB | 552 MB (+95 MB) | n/a | 3 of 3 |
| folio | 322 ms | 438 ms | 22 MB | 480 MB (+61 MB) | 3 | 3 of 3 |
| WordCraft | 508 ms | 18.3 s | 5 MB | 542 MB (−189 MB) | n/a | 3 of 3 |
| Word Online viewer | 207 ms | n/a | n/a | 786 MB (−133 MB) | n/a | 3 of 3 |
| Google viewer | 462 ms | n/a | n/a | 627 MB (+25 MB) | n/a | 3 of 3 |
| Apryse WebViewer | 220 ms | 220 ms | 19 MB | 705 MB (+41 MB) | n/a | 2 of 3 |
| Nutrient | 3.71 s | 3.71 s | 27 MB | 776 MB (+171 MB) | n/a | 3 of 3 |
| react-docx | 655 ms | 655 ms | 15 MB | 527 MB (+39 MB) | 3 | 2 of 3 |
| Univer | 249 ms | 249 ms | 29 MB | 514 MB (+41 MB) | n/a | 5 of 6 |
| BetterOffice | 887 ms | 887 ms | 16 MB | 654 MB (+69 MB) | 3 | 3 of 3 |
| OnlyOffice (CryptPad build) | 2.04 s | 2.04 s | 104 MB | 901 MB (+234 MB) | 3 | 3 of 3 |
| OpenDoc | 578 ms | 702 ms | 15 MB | 710 MB (+96 MB) | 3 | 2 of 3 |

**Redline (`redline.docx`, 3 pages)**

| Engine | Loaded | Settled | JS heap | Renderer memory (growth) | Pages shown | Runs that loaded |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| canvas-editor | 449 ms | 449 ms | 10 MB | 476 MB (+58 MB) | 3 | 2 of 3 |
| Docxodus | 1.18 s | 1.18 s | 9 MB | 579 MB (+42 MB) | n/a | 2 of 3 |
| SuperDoc | 1.52 s | 1.52 s | 22 MB | 661 MB (+106 MB) | 3 | 3 of 3 |
| Plate | 486 ms | 486 ms | 12 MB | 456 MB (+59 MB) | n/a | 3 of 3 |
| docen | 273 ms | 273 ms | 29 MB | 560 MB (+71 MB) | n/a | 3 of 3 |
| docx-editor.dev | 160 ms | 696 ms | 25 MB | 547 MB (+90 MB) | n/a | 3 of 3 |
| folio | 423 ms | 539 ms | 18 MB | 480 MB (+62 MB) | 3 | 2 of 3 |
| WordCraft | 535 ms | 32.9 s | 4 MB | 542 MB (−117 MB) | n/a | 2 of 3 |
| Word Online viewer | 334 ms | n/a | n/a | 873 MB (+185 MB) | n/a | 3 of 3 |
| Google viewer | 622 ms | n/a | n/a | 627 MB (+20 MB) | n/a | 3 of 3 |
| Apryse WebViewer | 298 ms | 298 ms | 18 MB | 714 MB (+56 MB) | n/a | 2 of 3 |
| Nutrient | 3.72 s | 3.72 s | 27 MB | 784 MB (+176 MB) | n/a | 3 of 3 |
| react-docx | 798 ms | 861 ms | 17 MB | 514 MB (+27 MB) | 3 | 2 of 3 |
| Univer | 263 ms | 263 ms | 32 MB | 516 MB (+41 MB) | n/a | 4 of 6 |
| BetterOffice | 1.03 s | 1.16 s | 17 MB | 697 MB (+116 MB) | 3 | 3 of 3 |
| OnlyOffice (CryptPad build) | 2.09 s | 2.09 s | 104 MB | 889 MB (+221 MB) | 3 | 3 of 3 |
| OpenDoc | 652 ms | 850 ms | 14 MB | 694 MB (+86 MB) | 3 | 3 of 3 |

**500 pages (`lorem-500.docx`)**

| Engine | Loaded | Settled | JS heap | Renderer memory (growth) | Pages shown | Runs that loaded |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| canvas-editor | 16.6 s | 16.6 s | 680 MB | 4134 MB (+3717 MB) | 661 | 3 of 3 |
| Docxodus | 4.60 s | 4.60 s | 10 MB | 753 MB (+202 MB) | n/a | 3 of 3 |
| SuperDoc | 12.8 s | 12.8 s | 35 MB | 1076 MB (+520 MB) | 25 | 3 of 3 |
| Plate | 58.0 s | 58.0 s | 69 MB | 623 MB (+226 MB) | n/a | 3 of 3 |
| docen | 4.07 s | still busy after 180 s | 127 MB | 3528 MB (+3042 MB) | n/a | 3 of 3 |
| docx-editor.dev | 284 ms | 1.19 s | 149 MB | 707 MB (+250 MB) | n/a | 3 of 3 |
| folio | 9.76 s | 9.76 s | 45 MB | 2402 MB (+1983 MB) | 500 | 3 of 3 |
| WordCraft | 2.52 s | 20.6 s | 4 MB | 708 MB (+9 MB) | n/a | 3 of 3 |
| Word Online viewer | 580 ms | n/a | n/a | 905 MB (−68 MB) | n/a | 3 of 3 |
| Google viewer | 14.2 s | n/a | n/a | 641 MB (+39 MB) | n/a | 2 of 3 |
| Apryse WebViewer | 650 ms | 984 ms | 48 MB | 1980 MB (+1315 MB) | n/a | 3 of 3 |
| Nutrient | 13.0 s | 13.0 s | 29 MB | 736 MB (+132 MB) | n/a | 3 of 3 |
| react-docx | 5.38 s | 5.38 s | 98 MB | 915 MB (+430 MB) | 500 | 3 of 3 |
| Univer | 14.3 s | 14.3 s | 1772 MB | 2395 MB (+1920 MB) | n/a | 6 of 6 |
| BetterOffice | 5.03 s | 5.47 s | 31 MB | 1300 MB (+716 MB) | 500 | 3 of 3 |
| OnlyOffice (CryptPad build) | 3.40 s | 3.56 s | 161 MB | 948 MB (+265 MB) | 409 | 3 of 3 |
| OpenDoc | 2.33 s | 4.53 s | 17 MB | 916 MB (+307 MB) | 500 | 3 of 3 |
<!-- samples:end -->

Read these with care:

- **These figures are from another machine than the ones before 2026-11-18**, so they do not
  continue the earlier series: a Linux machine with 8 vCPU and no GPU (Chrome draws in software),
  3 runs per engine and sample where the earlier files have 5. The earlier files stay in
  `docs/samples/`.
- **WordCraft is now measured on release 0.18.1** in these tables. The Lighthouse tables were
  not taken again and still describe 0.17.0.
- **OpenDoc's rows come from a second pass the same day.** In the first pass all 9 of its starts
  failed: the adapter handed it a document before its engine was ready, which a slower machine
  shows every time. The adapter was fixed and OpenDoc measured again; the 9 failed runs are in
  the dated file under `discarded`. **Univer** was measured in both passes (6 runs).
  The second pass was a separate job on the same machine type, and its load-average readings
  do not continue the first job's, so it ran on another host of that type (64 cores, 493 GB).
  A third job that evening, meant to take every row on one host, was not used: its host ran at
  a load of 77 to 148, and its upload token expired before two of the three sample files were
  saved.
- **docen on 500 pages** answers "loaded" after about 4 s and shows page 1, but in all three
  runs its main thread was still busy when the wait gave up at 180 s, so it has no Settled
  figure. The tab is not usable during that time.
- **Page counts differ by engine** on the 500-page file. canvas-editor's 661 is its own layout:
  it gave 637 on a Mac with Times as the fallback and 650 with a Calibri-metric font loaded
  (2026-11-20), so the count is not a font accident. **OnlyOffice's 409 is wrong**: it is a count
  read while OnlyOffice was still paginating (see "Figures to distrust" below). It reaches 500.
- **canvas-editor's memory on the 500 pages** is about 680 MB of JavaScript heap (it keeps one
  object per character: 1.6 million of them) and 4 GB of renderer memory. The 4 GB is this
  machine's: with no GPU, Chrome keeps each of the 661 page canvases in the renderer's own
  memory. On a Mac with a GPU the same page read 0.5 to 1.8 GB (the files of 2026-11-15 and
  2026-11-17).
- **Pages shown** counts what is in the DOM: SuperDoc keeps only the pages near
  the viewport (25), so its number is not a page count of the document.
- **Renderer memory growth** can be negative: the "before" reading is taken one
  second after startup, when the engine's start-up garbage is still resident.
- 18 of the 162 runs did not load, 17 of them on the two short samples. Eleven times the page
  itself answered an error status and once a sample download answered HTTP 429 (the site's
  rate limit on one machine loading engine after engine); three runs were not ready within
  600 s (Apryse twice, Univer once); OpenDoc once did not start within 120 s; react-docx once
  missed one of its modules; the Google viewer once did not load. Each reason is in the dated
  file, and the last column of the tables says how many runs each median stands on.
- **Settled cannot see everything**: see the definition below. An engine that
  starts work more than two seconds after it last kept the thread busy would
  read as settled before that work.

#### Figures to distrust

Every figure that stood far from its neighbours, or that the method cannot really measure, was
looked at again on 2026-11-20: by hand, in Chrome on a Mac, on the live site. What was found is
below. None of the published figures was changed by it: they are that machine's runs, and a
corrected figure needs a new pass on it.

| Figure in the tables | Verdict | What was seen |
| --- | --- | --- |
| **OnlyOffice, 500 pages: 409 pages, Settled 3.56 s** | **Wrong** | OnlyOffice reports the document ready and goes on paginating in slices too short to count as long tasks, so Settled does not see them. Watched by hand: 52, 103, 154 … 409, 460 and **500 pages**. The three published runs read 409, 358 and 409: the same file, three counts. With the changed script on a Mac: Loaded 1.73 s, Settled 1.73 s, and the page count still moving until 4.32 s, where it stopped at 500. Its true figures on the 500 pages are 500 pages and a layout that ends well after its Settled. |
| **docx-editor.dev, Loaded: 190 ms, 160 ms, 284 ms** | **Not a measurement** | Its adapter's `load()` hands the bytes to the engine and returns at once (`ref.load(bytes)`, nothing awaited): 58 ms on the 500 pages here. The column times the call, not the document. |
| **docx-editor.dev, 500 pages: Settled 1.19 s** | **Not reliable** | Here its main thread was busy for 11.1 s after the click. The 11 runs on file range from 610 ms to 5.45 s. Its work comes in bursts with pauses, and Settled stops at the first pause of two seconds. |
| **Settled, for every engine** | **Blind to sliced work** | It counts tasks of 50 ms or more (the Long Tasks API). An engine that works in shorter slices, in a Worker or on the GPU reads as settled while it is still working. Seen for OnlyOffice; possible for any engine whose Settled equals its Loaded on the 500 pages (Docxodus, SuperDoc, Plate, folio, Nutrient, react-docx, Univer; canvas-editor's also equals it, and its loader was seen to wait for its layout). |
| **WordCraft, Settled: 18.3 s, 32.9 s, 20.6 s** | **This machine, not the engine** | Its Loaded is about 0.5 s. With no GPU its canvas is drawn in software on the main thread, and those repaints are the long tasks: one run of the 500 pages read 147 s, another 7.3 s. On the Mac runner of 2026-11-17 it settled on the 500 pages in 2.8 to 4.0 s. |
| **Renderer memory, canvas engines** (canvas-editor 4,134 MB, docen 3,528 MB, Univer 2,395 MB) | **This machine, not the engine** | With no GPU every canvas is kept in the renderer's memory; with one, most of it is in the GPU process, which the tables do not show (`gpuRss` is in the dated file). Compare these only with each other. |
| **Renderer memory, small documents** (454 to 901 MB; growth of −189 MB, −133 MB) | **Mostly Chrome** | Three or more renderer processes are resident before any document opens (about 400 to 1,000 MB over the runs). The growth is the engine's part, and for a small document it is smaller than the noise: it comes out negative for four rows, three of them on the two short samples. |
| **Univer, 500 pages: 1,772 MB of heap** | **Real, and not a .docx figure** | Still 1,888 MiB a minute after loading here, so it is held, not garbage. But Univer never reads the file: it holds the text this site's reader gave it (`lib/univer-doc.ts`). The same goes for its Loaded (249 ms on the rich sample): text only, no tables, pictures or page set-up. |
| **canvas-editor, every figure on the editors site** | **Confirmed** | 500 pages here: 17.7 s and 21.9 s to load, 637 and 650 pages, heap 700 to 730 MiB and steady for 20 s. The published 16.6 s, 661 pages and 680 MB are of the same order. What is misleading is its renderer memory (above) and, on the viewers site, its heap, read before garbage was collected: 1,256 there, about 700 after collection. |
| **Apryse, Loaded 220 ms to 650 ms** | **Partly blind** | Its adapter waits for the SDK's `documentLoaded`, and the office engine runs in a Worker: neither Loaded nor Settled sees the pages being drawn. |
| **Medians of two runs** (the rows that say "2 of 3") | **Weak** | A median of two is their mean. Fourteen rows of the two short samples stand on two runs. |
| **Sizes** | **Mislabelled** | Every "MB" in these tables is a mebibyte (1,048,576 bytes): the 680 MB of canvas-editor's heap is 713 million bytes. |

Two of these are faults of the measuring, and are fixed in
[`scripts/measure_samples.py`](scripts/measure_samples.py) for the next pass: the page count is
now read until it has not changed for five seconds (`pagesSettledMs` is when it last changed, for
an engine whose count moved after "loaded"), and the heap is read after a forced garbage
collection (`heapBytes`; the reading before it is kept as `heapBytesBeforeGc`, which is what the
files up to 2026-11-18 call `heapBytes`). Tried on a Mac on 2026-11-20, one run each on the 500
pages: OnlyOffice 500 pages, heap 185 MiB before the collection and 134 MiB after; docx-editor.dev
148 MiB and 121 MiB; canvas-editor 699 MiB and 697 MiB (and on the viewers site, where the heap is
read sooner, 1,273 MiB and 697 MiB). The others are limits of the method, said here. **The tables
above still hold the readings of 2026-11-18**: correcting them takes a new pass on the Hugging
Face machine.

The published figures were made by this job (two passes on 2026-11-18; the dated file lists
each pass's job, command and commits under `passes`):

```sh
hf jobs run --flavor cpu-upgrade --timeout 4h --secrets HF_TOKEN -e SITE=editors -e RUNS=3 python:3.12 \
  bash -c 'curl -fsSL https://raw.githubusercontent.com/arthrod/open-docs/main/scripts/hf_job.sh -o /tmp/job.sh && bash /tmp/job.sh'
```

The same measuring on your own machine, which gives that machine's figures and must not be
written over the published `latest.json`:

```sh
uv run --with playwright python -I scripts/measure_samples.py all showcase,redline,lorem-500 3 \
  --out .scratch/samples/$(date +%F).json --latest .scratch/samples/latest.json --shots .scratch/shots
```

The published sample figures are taken on a Hugging Face Jobs machine (`cpu-upgrade`: 8 vCPU,
32 GB, Linux, no GPU) by [`scripts/hf_job.sh`](scripts/hf_job.sh), because a timing taken on a
laptop that is doing other work is slower than the engine, and anyone can rent the same machine.
Every run records the load average and the Chrome version, so the dated file shows both. That
load average and core count are the shared host's (64 cores), not our 8 vCPU: it reached 65
during these runs, and how much of that slowed our Chrome cannot be told from inside the job.
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
return), taken from the Long Tasks API. Work an engine starts more than two
seconds after it last kept the thread busy is not seen, and the wait gives up
after 180 s ("still busy"). docx-editor.dev's loader
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
| Word Online viewer | 96 · 97 | 212 ms · 1.60 s | 0 ms · 0 ms | 0.074 · 0 | 212 ms · 1.42 s | 1.80 s · 4.30 s | 100 | 73 | 90 | 96/96/95/97/96 · 92/100/97/90/99 |
| Google viewer | 98 · 96 | 212 ms · 1.22 s | 100 ms · 56 ms | 0.001 · 0 | 212 ms · 1.22 s | 1.37 s · 3.90 s | 100 | 54 | 90 | 99/100/88/98/89 · 99/100/61/89/96 |
| Apryse WebViewer | 68 · 73 | 224 ms · 769 ms | 858 ms · 848 ms | 0 · 0.003 | 224 ms · 769 ms | 2.08 s · 6.50 s | 100 | 96 | 90 | 70/68/68/72/66 · 77/74/69/72/73 |
| Nutrient | **no result**: the engine failed on Google's machine, so there is no score: [open-docs] Nutrient Web SDK failed to start PSPDFKitError: download 'https://cdn.cloud.pspdfkit.co | | | | | | | | | |
| react-docx (measured 2026-11-20) | 99 · 96 | 212 ms · 769 ms | 32 ms · 52 ms | 0 · 0.018 | 212 ms · 764 ms | 1.35 s · 4.25 s | 100 | 100 | 90 | 99/95/98/99/99 · 81/75/96/100/99 |
| Univer (measured 2026-11-20) | 93 · 85 | 445 ms · 1.66 s | 168 ms · 290 ms | 0.005 · 0.02 | 445 ms · 1.66 s | 1.59 s · 7.74 s | 83 | 100 | 90 | 93/91/98/93/94 · 88/85/35/83/88 |
| OpenDoc (measured 2026-11-20) | 85 · 76 | 214 ms · 763 ms | 226 ms · 374 ms | 0.064 · 0.032 | 214 ms · 763 ms | 2.83 s · 11.6 s | 100 | 100 | 90 | 85/86/75/79/86 · 61/70/86/76/86 |
| BetterOffice (measured 2026-11-20) | 98 · 94 | 245 ms · 905 ms | 59 ms · 77 ms | 0 · 0.018 | 245 ms · 905 ms | 1.59 s · 6.24 s | 96 | 88 | 90 | 98/98/99/96/98 · 91/89/94/96/95 |
| OnlyOffice (CryptPad build) (measured 2026-11-20) | 100 · 100 | 217 ms · 772 ms | 0 ms · 0 ms | 0 · 0 | 217 ms · 772 ms | 429 ms · 2.30 s | 100 | 96 | 90 | 100/100/100/100/100 · 100/100/100/100/100 |

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
| Word Online viewer | 96 · 97 | 222 ms · 762 ms | 0 ms · 0 ms | 0.075 · 0.006 | 222 ms · 762 ms | 1.84 s · 4.44 s | 100 | 73 | 90 | 97/95/95/96/97 · 97/96/98/100/97 |
| Google viewer | 97 · 94 | 231 ms · 774 ms | 125 ms · 222 ms | 0.001 · 0.004 | 231 ms · 774 ms | 1.51 s · 4.05 s | 100 | 54 | 90 | 83/97/97/97/89 · 94/84/94/100/56 |
| Apryse WebViewer | 68 · 67 | 222 ms · 790 ms | 848 ms · 1.41 s | 0 · 0 | 222 ms · 790 ms | 2.00 s · 7.16 s | 100 | 96 | 90 | 68/68/77/68/77 · 67/70/77/64/63 |
| Nutrient | **no result**: the engine failed on Google's machine, so there is no score: [open-docs] Nutrient Web SDK failed to start PSPDFKitError: download 'https://cdn.cloud.pspdfkit.co | | | | | | | | | |
| react-docx (measured 2026-11-20) | 37 · 34 | 6.89 s · 42.0 s | 1.36 s · 1.89 s | 0.011 · 0.018 | 214 ms · 2.20 s | 3.93 s · 14.6 s | 96 | 100 | 90 | 85/37/37/36/fail · 30/39/36/32/fail |
| Univer (measured 2026-11-20) | 61 · 60 | 448 ms · 1.66 s | 10.2 s · 10.4 s | 0.005 · 0.02 | 448 ms · 1.66 s | 3.77 s · 11.6 s | 83 | 100 | 90 | fail/62/fail/fail/61 · fail/60/fail/fail/fail |
| OpenDoc (measured 2026-11-20) | 59 · 59 | 212 ms · 1.51 s | 8.46 s · 12.3 s | 0.076 · 0.044 | 212 ms · 1.51 s | 5.43 s · 28.7 s | 100 | 100 | 90 | 59/59/58/58/60 · 59/56/fail/60/60 |
| BetterOffice (measured 2026-11-20) | n/a · 92 | n/a · 905 ms | n/a · 92 ms | n/a · 0.026 | n/a · 905 ms | n/a · 7.22 s | n/a | n/a | n/a | fail/fail/fail/fail/fail · 94/68/92/92/86 |
| OnlyOffice (CryptPad build) (measured 2026-11-20) | 100 · 100 | 214 ms · 773 ms | 0 ms · 0 ms | 0 · 0 | 214 ms · 773 ms | 436 ms · 2.38 s | 100 | 96 | 90 | 100/100/100/100/100 · 100/100/100/100/100 |
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
- **BetterOffice has no desktop score on the 500 pages**: in all five desktop analyses the sample failed to open
  on Google's machine (the page's own error is in the row), while the five mobile analyses scored 68 to 94.
  Not looked into.

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
| Univer | it has no .docx reader or writer (those are in its Server SDK) | its body, through `lib/univer-doc.ts` |

All thirteen were run through the probes below on 2026-11-20 (the table under
"Measured with").

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
| Plate | 9 of 10: its own Export writes inline code as a grey highlight in the body face, not a monospace one | all | all |
| WordCraft | 10 of 10 | all but the quote: its paste makes a quote an indented Normal paragraph, which nothing tells from an indented paragraph | all but the quote; and the first paragraph kept the Heading 1 of the document it replaced (the mapping probe ran before it on the same page): **not looked into** |
| canvas-editor | 2 of 10 (the two headings): its `plugin-docx` writes no bold, italic, code, link, list or quote this probe recognises | headings and lists only | table only |
| Univer | not applicable: no .docx export | not applicable | fails seven of eight: it is handed text, so code, quotes, tables and links do not exist in it |

**The run of 2026-11-09 said all eight editors passed everything, and on
2026-11-20 that was no longer true of any engine that takes the assistant's
Markdown as a .docx.** The same day the probes were last run, the hand-written
.docx writer was replaced by Plate's exporter (`9f3a4bb`), and nobody ran them
again. Plate's exporter writes inline code as a grey highlight with no monospace
face, a quote as a bordered indent with no style, a code block as one paragraph
with its lines run together, and a line break in a table cell as three
paragraphs. The reader knew none of that, so **every assistant turn stripped
code and quotes from the document** on docx-editor.dev, Docxodus and the five
engines added on 2026-11-18. Found by running the probes on the new five. Fixed
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
