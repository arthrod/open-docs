/**
 * Tracked changes for engines that have no revision model.
 *
 * canvas-editor's plugin-docx and mammoth (Plate's importer) do not know
 * `w:ins` / `w:del`. plugin-docx skips both, so the inserted AND the deleted
 * words vanish ("rose 14.2 %" → "rose . %"); mammoth keeps insertions and
 * drops deletions, so a redline reads as if every change had been accepted.
 * Neither is what a reviewer was sent.
 *
 * `revisionsAsFormatting` rewrites the package before the vendor's importer
 * sees it, into the nearest thing those engines CAN draw: inserted runs
 * underlined, deleted runs struck through, both in Word's revision red. The
 * words are all there and it is visible which ones changed. What is lost, and
 * is the engine's limit rather than a choice here: who changed what and when,
 * accept/reject, and comments. Engines that draw revisions themselves
 * (SuperDoc, folio, docen, WordCraft, Docxodus, docx-editor.dev) are handed
 * the original bytes and never go through this file.
 *
 * It works on the XML text with a tag scanner rather than a DOM, so it runs
 * the same in the browser and in `deno test`.
 */
import { strFromU8, strToU8, unzipSync, zipSync } from "https://esm.sh/fflate@0.8.2?target=es2022";

/** Word's default colour for a first reviewer's changes. */
const RED = "C00000";
const INSERTED = `<w:u w:val="single"/><w:color w:val="${RED}"/>`;
const DELETED = `<w:strike/><w:color w:val="${RED}"/>`;

/** True when the WordprocessingML part has insertions, deletions or moves. */
export const hasRevisions = (xml: string): boolean => /<w:(ins|del|moveFrom|moveTo)(?=[\s>\/])/.test(xml);

/**
 * The inside of a tag after its name, as a pattern source: quoted attribute values are taken whole,
 * so a `>` inside one (an author named "A>B") does not end the tag.
 */
const ATTRS = String.raw`(?:"[^"]*"|'[^']*'|[^>"'])`;
const TAG = new RegExp(String.raw`<(\/?)w:(ins|del|moveFrom|moveTo|r|delText|delInstrText)(?=[\s>\/])(${ATTRS}*?)(\/?)>`, "g");
const RPR_CHANGE = new RegExp(String.raw`<w:rPrChange\b${ATTRS}*>[\s\S]*?<\/w:rPrChange>`, "g");
const PPR_CHANGE = new RegExp(String.raw`<w:pPrChange\b${ATTRS}*>[\s\S]*?<\/w:pPrChange>`, "g");
const MOVE_RANGE = new RegExp(String.raw`<w:move(From|To)Range(Start|End)\b${ATTRS}*?\/>`, "g");
const RPR_OPEN = new RegExp(String.raw`^\s*(<w:rPr(?:\s${ATTRS}*?)?)>`);
const RPR_EMPTY = new RegExp(String.raw`^\s*<w:rPr(?:\s${ATTRS}*?)?\/>`);
const OWN_MARKS = new RegExp(String.raw`<w:(u|strike|dstrike|color)\b${ATTRS}*?(\/>|>\s*<\/w:\1>)`, "g");

/** One WordprocessingML part: revisions unwrapped, their runs marked. */
export function flattenRevisions(xml: string): string {
  if (!hasRevisions(xml)) return xml;
  // Formatting-change records carry the OLD properties; the current ones stay.
  xml = xml
    .replace(RPR_CHANGE, "")
    .replace(PPR_CHANGE, "")
    // Move bookmarks only pair a moveFrom with its moveTo.
    .replace(MOVE_RANGE, "");

  let out = "";
  let at = 0;
  let ins = 0;
  let del = 0;
  TAG.lastIndex = 0;
  for (let m = TAG.exec(xml); m; m = TAG.exec(xml)) {
    const [tag, close, name, , selfClose] = m;
    out += xml.slice(at, m.index);
    at = m.index + tag.length;
    const added = name === "ins" || name === "moveTo";
    const removed = name === "del" || name === "moveFrom";
    if (added || removed) {
      // A self-closing one marks a paragraph mark or a table row: nothing to draw.
      if (!selfClose) {
        if (added) ins += close ? -1 : 1;
        else del += close ? -1 : 1;
      }
      continue; // the wrapper itself is dropped
    }
    if (name === "delText") {
      out += close ? "</w:t>" : `<w:t${m[3]}${selfClose}>`; // <w:delText/> stays one empty element
      continue;
    }
    if (name === "delInstrText") {
      // A deleted field code: keep it a field code so it is not printed as text.
      out += close ? "</w:instrText>" : `<w:instrText${m[3]}${selfClose}>`;
      continue;
    }
    // w:r
    out += tag;
    if (close || selfClose || (!ins && !del)) continue;
    // Deleted wins: text inserted by one reviewer and deleted by another is gone.
    const marks = del ? DELETED : INSERTED;
    const rest = xml.slice(at);
    // The tag may carry whitespace or attributes (`<w:rPr >`, a namespace declaration): XML allows
    // both, and a second container would be ignored by mammoth, which reads the first one only.
    const open = RPR_OPEN.exec(rest);
    const empty = RPR_EMPTY.exec(rest);
    const end = open && !empty ? /<\/w:rPr\s*>/.exec(rest) : null;
    if (open && end && !empty) {
      // The run's own underline / strike / colour would win or duplicate: replace them.
      const kept = rest.slice(open[0].length, end.index).replace(OWN_MARKS, "");
      out += `${open[1]}>${kept}${marks}</w:rPr>`;
      at += end.index + end[0].length;
    } else if (empty) {
      out += `<w:rPr>${marks}</w:rPr>`;
      at += empty[0].length;
    } else {
      out += `<w:rPr>${marks}</w:rPr>`;
    }
  }
  return out + xml.slice(at);
}

/** The parts that can carry body revisions. */
const PART = /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/;

/**
 * A .docx whose tracked changes are plain formatting. Returns the SAME bytes
 * (and `changed: false`) when the document has none, so ordinary documents
 * are untouched.
 */
export function revisionsAsFormatting(bytes: Uint8Array): { bytes: Uint8Array; changed: boolean } {
  const files = unzipSync(bytes);
  let changed = false;
  for (const name of Object.keys(files)) {
    if (!PART.test(name)) continue;
    const xml = strFromU8(files[name]);
    if (!hasRevisions(xml)) continue;
    files[name] = strToU8(flattenRevisions(xml));
    changed = true;
  }
  return changed ? { bytes: zipSync(files), changed } : { bytes, changed };
}
