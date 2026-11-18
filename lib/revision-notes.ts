/**
 * How each engine treats a document's tracked changes, in a few words. Seen,
 * not assumed: every line is what the engine drew for redline.docx on
 * 2026-11-15 (scripts/measure_samples.py --shots). One list, read by the
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
  "univer": "not drawn: it has no .docx reader, so it is given the text as this site reads it, every change accepted",
  "react-docx": "native: insertions underlined in the text, and a margin card per deletion and per comment (author, date, Accept / Reject); it ships with both hidden, and this page turns them on",
  "word-online": "not drawn: Microsoft's embed viewer shows the text as if every change were accepted",
  "google-viewer": "native: insertions and deletions in the text",
  "apryse": "native: insertions and deletions in the text",
  "nutrient": "not drawn: the page shows the text as if every change were accepted",
};
