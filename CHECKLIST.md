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
renderers: Word Online viewer, Google viewer, Apryse WebViewer, Nutrient.

A part that lists engines is complete only when all seventeen are in it, or
the part says why one is missing.

## 1. Home page and README

- [ ] 1.1 The editors table (13 rows: package, renderer, .docx in and out, assistant write path, assistant read path)
- [ ] 1.2 Proprietary viewers table (4 rows)
- [ ] 1.3 Using it (routes, query parameters, zoom)
- [ ] 1.4 Samples: the three files and where they live
- [ ] 1.5 Tracked changes: what each engine draws (17 rows)
- [ ] 1.6 The samples, measured: showcase table (17 rows, host-load line)
- [ ] 1.7 The samples, measured: redline table (17 rows, host-load line)
- [ ] 1.8 The samples, measured: 500 pages table (17 rows, host-load line)
  - [x] docen row: it opens the file (500 pages, Word's count); the pass gave up too early. Row re-measured on a Mac with a 30-minute deadline, notes, distrust table and blog corrected, live 2026-11-21
  - [ ] docen at phone size: one emulated run showed an empty document after a 3.5-minute freeze; repeat before saying anything about it
  - [x] OnlyOffice (CryptPad build): the dash was in the live Measurements table, which had two visits and neither a fresh Chromium tab. The page now says what a dash means; a Chrome visit recorded 129 MB
- [ ] 1.9 What to know when reading them (notes under the tables)
- [ ] 1.10 Figures to distrust (table)
- [ ] 1.11 Lighthouse, PageSpeed table (17 rows × 3 samples)
- [~] 1.12 Lighthouse on our computer (every page, blank and 500 pages): script, page band and README block in; the pass is running
  - [x] WordCraft: Lighthouse measures it directly on a machine with a graphics card (checked by hand, the page draws)
  - [ ] docen on the 500 pages: `PAGE_HUNG`, re-check
- [ ] 1.13 The assistant: what it does, per engine
- [ ] 1.14 How fairness to each vendor is decided (table)
- [ ] 1.15 Assessment: harness or editor? (per-engine table, 10-of-10 table)
- [ ] 1.16 Measurements (live medians)
- [ ] 1.17 How it fits together
- [ ] 1.18 What it took to make each editor run from a CDN (one entry per engine)
- [ ] 1.19 Not in the bench, and why
- [ ] 1.20 Known limitations
- [ ] 1.21 Tests, Development, Licenses

## 2. Per-engine pages (`/e/<id>`)

One box per engine: the page loads the showcase, the redline and the 500
pages, and the figures band matches the README row.

- [ ] canvas-editor · [ ] Docxodus · [ ] SuperDoc · [ ] Plate · [ ] docen
- [ ] docx-editor.dev · [ ] folio · [ ] WordCraft · [ ] react-docx · [ ] Univer
- [ ] OpenDoc · [ ] BetterOffice · [ ] OnlyOffice
- [ ] Word Online viewer · [ ] Google viewer · [ ] Apryse WebViewer · [ ] Nutrient

## 3. Blog (`/blog`)

- [x] 3.1 Index lists the five posts in reading order, numbered
- [ ] 3.2 Why we test
- [ ] 3.3 What the numbers mean
- [ ] 3.4 Test an editor yourself
- [ ] 3.5 What went wrong
- [ ] 3.6 What the new numbers say, and how to choose an editor
- [x] 3.7 Navigation: the same burger menu as the other pages of the site (checked live at phone width)
- [x] 3.8 Footers: Previous and Next follow the reading order on every post; the two stray "Next:" lines are gone
- [ ] 3.9 Every figure a post quotes matches the current tables

## 4. Cross-site consistency

- [ ] 4.1 Same engine names on the three sites and in the trial
- [ ] 4.2 Same menu on every page of the three sites
- [ ] 4.3 Each engine links to its vendor note at `benchmarks.law/editors-trial/vendor-notes`
- [ ] 4.4 The checklist files in the four repositories agree with each other

## Log

| Date | Part | What changed |
| --- | --- | --- |
| 2026-11-21 | all | Checklist created |
| 2026-11-21 | 3.1, 3.7, 3.8 | Blog uses the site's header, menu and footer; posts in reading order |
| 2026-11-21 | 1.8, 1.10 | docen opens the 500 pages: row, notes and blog corrected |
| 2026-11-21 | 1.16 | What a dash in JS heap means |
