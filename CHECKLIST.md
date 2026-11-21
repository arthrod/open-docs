# Reports checklist: editors.benchmarks.law (open-docs)

Every report this repository publishes, with its parts. Tick a part only when
it has been updated **and** seen on the live site. The same file exists in the
other three repositories:

- `open-docs-viewer/CHECKLIST.md` (viewers.benchmarks.law, the readers)
- `editors-arena/CHECKLIST.md` (arena.benchmarks.law, the writers side by side)
- `editors_trial/CHECKLIST.md` (benchmarks.law/editors-trial, the dense reports)

Legend: `[x]` done and checked live · `[~]` in progress · `[ ]` not done ·
`[!]` blocked, with the reason beside it.

## The engines this site covers

Thirteen editors: canvas-editor, Docxodus, SuperDoc, Plate, docen,
docx-editor.dev (eigenpal), folio, WordCraft, react-docx, Univer, OpenDoc,
BetterOffice, OnlyOffice (CryptPad build). Four view-only commercial
renderers: Microsoft Word viewer, Google Docs viewer, Apryse WebViewer, Nutrient.

A part that lists engines is complete only when all seventeen are in it, or
the part says why one is missing.

cite-check has a page (`/e/cite-check`) and a Lighthouse row, which makes
eighteen rows there: it is our application on canvas-editor, not an engine of
its own, and the other tables leave it out for that reason.

## 1. Home page and README

- [x] 1.1 The editors table (13 rows: package, renderer, .docx in and out, assistant write path, assistant read path). Audited 2026-11-21: 13 rows in the README, 13 editor cards and cite-check on the home page
- [x] 1.2 Proprietary viewers table (4 rows). Audited 2026-11-21: 4 rows, 4 cards
- [x] 1.3 Using it (routes, query parameters, zoom) Audited 2026-11-21: every menu item the section names is on a live engine page. Univer's page shows the export item too; choosing it reports that Univer has no exporter
- [x] 1.4 Samples: the three files and where they live Audited 2026-11-21: four files, sizes and page counts as built; the measuring pass loaded the three samples in every engine
- [x] 1.5 Tracked changes: what each engine draws (17 rows). Audited 2026-11-21: 17 rows; the two embed viewers are named as on the site
- [x] 1.6 The samples, measured: showcase table (17 rows, host-load line). The home page had no rich-sample table while the README had one; added 2026-11-21
- [x] 1.7 The samples, measured: redline table (17 rows, host-load line). Audited 2026-11-21: README and home page
- [x] 1.8 The samples, measured: 500 pages table (17 rows, host-load line). Audited 2026-11-21: README and home page
  - [x] docen row: it opens the file (500 pages, Word's count); the pass gave up too early. Row re-measured on a Mac with a 30-minute deadline, notes, distrust table and blog corrected, live 2026-11-21
  - [ ] docen at phone size: one emulated run showed an empty document after a 3.5-minute freeze; repeat before saying anything about it
  - [x] OnlyOffice (CryptPad build): the dash was in the live Measurements table, which had two visits and neither a fresh Chromium tab. The page now says what a dash means; a Chrome visit recorded 129 MB
- [x] 1.9 What to know when reading them (notes under the tables) Audited 2026-11-21: the notes name every engine with an unusual row (docen, WordCraft, Univer, the viewers); corrected this week for docen and OnlyOffice
- [x] 1.10 Figures to distrust (table) Audited 2026-11-21: each row read against the tables it cites
- [x] 1.11 Lighthouse, PageSpeed table (17 engines and cite-check; blank document and 500 pages). Audited 2026-11-21: 18 rows in each table, README and home page
- [x] 1.12 Lighthouse on our computer: all 18 pages, blank and 500 pages, live 2026-11-21 (seen in Chrome). An analysis whose page could not be reached (Chrome could not resolve the name, on this computer) is made again after a wait
  - [x] WordCraft: Lighthouse measures it directly on a machine with a graphics card (checked by hand, the page draws)
  - [x] docen on the 500 pages: no score on this computer either (Lighthouse stopped while waiting for the page, 3 of 3, both form factors); the table says so
  - [!] README.md is over Val Town's file size limit (81 KB): the copy inside the val is stale; GitHub's is current. The site does not read it
- [x] 1.13 The assistant: what it does, per engine Audited 2026-11-21: all thirteen editors; the four renderers are view-only and have no assistant
- [x] 1.14 How fairness to each vendor is decided (table) Audited 2026-11-21: thirteen rows
- [x] 1.15 Assessment: harness or editor? (per-engine table, 10-of-10 table) Audited 2026-11-21: thirteen rows; dated 2026-11-09 and says so
- [x] 1.16 Measurements (live medians) Audited 2026-11-21: the live table explains a dash; notes name the engines that load in a frame
- [x] 1.17 How it fits together Audited 2026-11-21: unchanged by the new engines except the mirrors it names (npm, site, zip)
- [x] 1.18 What it took to make each editor run from a CDN (one entry per engine) Docxodus and the four view-only renderers had no entry; added 2026-11-21
- [x] 1.19 Not in the bench, and why Audited 2026-11-21: office-open, docs.plus, GenOffice: still not on the site
- [x] 1.20 Known limitations Audited 2026-11-21: names what each of the thirteen keeps and where assistant edits have no Undo
- [x] 1.21 Tests, Development, Licenses Audited 2026-11-21: licenses name all seventeen

## 2. Per-engine pages (`/e/<id>`)

One box per engine: its page answers on the three samples (HTTP 200 with the
site's menu, checked 2026-11-21), the measuring pass of 2026-11-21 loaded all
three in it (`docs/samples/latest.json`), and its load times in the README are
the pass's. The figures are on the home page and in the README; an engine page
has no figures of its own.

- [x] canvas-editor · [x] Docxodus · [x] SuperDoc · [x] Plate · [x] docen
- [x] docx-editor.dev · [x] folio · [x] WordCraft · [x] react-docx · [x] Univer
- [x] OpenDoc · [x] BetterOffice · [x] OnlyOffice
- [x] Microsoft Word viewer · [x] Google Docs viewer · [x] Apryse WebViewer · [x] Nutrient
- [x] cite-check (our application on canvas-editor): its page answers; it is not in the measuring pass Its page answers with the site's menu (checked 2026-11-21); it has a Lighthouse row and no row in the samples tables, by design

## 3. Blog (`/blog`)

- [x] 3.1 Index lists the five posts in reading order, numbered
- [x] 3.2 Why we test Audited 2026-11-21: figures (661 pages, 2 MB and 20 MB, 23 changes, 6 comments, 224,000 words) match the tables
- [x] 3.3 What the numbers mean Audited 2026-11-21: its figures are illustrations and are worded as such; 661 and 500 match
- [x] 3.4 Test an editor yourself Audited 2026-11-21: the one figure is an example ("something like")
- [x] 3.5 What went wrong Audited 2026-11-21: 1,256 MB is the viewers table of 2026-11-18 as corrected there; about 700 MB matches 678 MB; "9 of its 51 runs" and "twenty times busier" are the stopped pass of 2026-11-20 recorded in the job script
- [x] 3.6 What the new numbers say, and how to choose an editor Audited 2026-11-21: every time, page count, memory figure and the seven "2 of 3" rows match the 500-page table
- [x] 3.7 Navigation: the same burger menu as the other pages of the site (checked live at phone width)
- [x] 3.8 Footers: Previous and Next follow the reading order on every post; the two stray "Next:" lines are gone
- [x] 3.9 Every figure a post quotes matches the current tables Audited 2026-11-21, post by post (3.2 to 3.6)

## 4. Cross-site consistency

- [x] 4.1 Same engine names on the three sites and in the trial The README tables said "Word Online viewer" and "Google viewer" where the sites say "Microsoft Word viewer" and "Google Docs viewer"; the tables and their scripts now use the sites' names (2026-11-21)
- [x] 4.2 Same menu on every page of the three sites Audited 2026-11-21: the header of the three sites carries Editors, Viewers, Arena, Blog, Source and Contact, with the burger menu at phone width; an engine page has its own compact bar
- [x] 4.3 Each engine links to its vendor note at `benchmarks.law/editors-trial/vendor-notes`, the six new tools included since benchmarks.law published their sections (et-v0.10.6, 2026-11-21)
- [ ] 4.4 The checklist files in the four repositories agree with each other

## Log

| Date | Part | What changed |
| --- | --- | --- |
| 2026-11-21 | all | Checklist created |
| 2026-11-21 | 3.1, 3.7, 3.8 | Blog uses the site's header, menu and footer; posts in reading order |
| 2026-11-21 | 1.8, 1.10 | docen opens the 500 pages: row, notes and blog corrected |
| 2026-11-21 | 1.16 | What a dash in JS heap means |
| 2026-11-21 | 4.3 | Each engine links to its vendor note |
| 2026-11-21 | 1.12 | Lighthouse on our computer published for every page |
| 2026-11-21 | 1.1, 1.2, 1.5 to 1.8, 1.11, 2 | Audited against the live site and the measuring pass; rich-sample table added to the home page |
| 2026-11-21 | vendor notes | benchmarks.law has the six new sections; their links are on |
| 2026-11-21 | 1.3, 1.4, 1.9, 1.10, 1.13 to 1.21, 3.2 to 3.6, 3.9, 4.1, 4.2 | Audited; CDN entries added for Docxodus and the renderers; one name for each embed viewer |
