/**
 * How each engine treats a document's tracked changes, in a few words. Seen,
 * not assumed: observations of redline.docx started on 2026-11-15
 * (scripts/measure_samples.py --shots). GenOffice, office-open, Fidus Writer
 * and docs.plus were checked on 2026-11-21. One list, read by the
 * adapters (the status line after the redline sample opens) and by the
 * landing page's samples table.
 */
export const REVISION_NOTES: Record<string, string> = {
  "canvas-editor": "drawn as formatting (no revision model): inserted underlined, deleted struck; no authors or comments",
  "docxodus": "native (its All Markup view): insertions, deletions and comment threads",
  "superdoc": "native: insertions, deletions and comments, each with a card in its review rail",
  "plate": "drawn as formatting (mammoth has no revision model): inserted underlined, deleted struck; no colour, authors or comments",
  "docen": "native: insertions and deletions in the text",
  "eigenpal": "partly: the accepted text, inserted words coloured; deleted words hidden (All Markup needs the vendor's paid review module)",
  "folio": "native: insertions and deletions in the text, with change bars; comment threads and a card per change (author, date) in its review panel (Comments and Changes)",
  "wordcraft": "native: insertions, deletions and comment balloons",
  "onlyoffice": "native: deletions struck and insertions underlined in the text, in the author's colour; its own review and comment panels open from its side bar",
  "betteroffice": "native: deletions struck and insertions underlined in the text, and a card per change and per comment (author, date, accept / reject) in its review sidebar",
  "opendoc": "native: insertions and deletions in the text, and a card per change and per comment (author, date, Accept / Reject) in its review pane",
  "genoffice": "native: insertions underlined and deletions struck in the text, with change bars in the margin, and a balloon per comment (author, date, Resolve)",
  "office-open": "not drawn: the page is an outline of what the parser read (the library has no editor), and the words inside tracked insertions and deletions are not in it",
  "fidus-writer": "not drawn, and words are missing: the text inside tracked insertions and deletions is left out (the title reads \"Coastal Wind Farm —  Field Report\"); comments are kept as marks",
  "docs-plus": "not drawn: its import (mammoth) has no revision model, so the text reads as if every change were accepted; no comments",
  "univer": "not drawn: it has no .docx reader, so it is given the text as this site reads it, with insertions and moved-in text kept and deletions left out",
  "react-docx": "native: insertions underlined in the text, and a margin card per deletion and per comment (author, date, Accept / Reject); it ships with both hidden, and this page turns them on",
  "word-online": "not drawn: Microsoft's embed viewer shows the text as if every change were accepted",
  "google-viewer": "native: insertions and deletions in the text",
  "apryse": "native: insertions and deletions in the text",
  "nutrient": "not drawn: the page shows the text as if every change were accepted",
};
