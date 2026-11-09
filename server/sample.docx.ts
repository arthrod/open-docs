/**
 * The fixture every editor opens: a small but real .docx with a title, two
 * heading levels, a bulleted list, bold/italic runs, and a paragraph the agent
 * can be asked to rewrite.
 */
import { type DocxParagraph, paragraphsToText, textToParagraphs, buildDocx } from "./docx.ts";

export const sampleTitle = "Quarterly Report — Acme Robotics";

export const sampleParagraphs: DocxParagraph[] = [
  { text: sampleTitle, style: "Title" },
  {
    text:
      "This document is a shared fixture for the open-docs bench. Every editor below loads these exact bytes so that DOCX import and export can be compared apples to apples.",
  },
  { text: "Highlights", style: "Heading1" },
  { text: "Shipped the Q3 field-service pilot with six depots.", bullet: 1 },
  { text: "Cut average repair time by 18% against the Q2 baseline.", bullet: 1 },
  { text: "Two depots exceeded the SLA target for the first time.", bullet: 2 },
  { text: "Open incident count fell from 41 to 12.", bullet: 1 },
  { text: "Risks", style: "Heading1" },
  { text: "Battery suppliers are quoting longer lead times for Q4.", bold: true },
  {
    text:
      "Hiring a second controls engineer is blocked on budget approval until November.",
  },
  { text: "Next quarter", style: "Heading2" },
  {
    text:
      "Roll the pilot to the remaining four depots, and publish the dispatch heuristic as open source.",
  },
];

/** Canonical sample bytes, built once per isolate. */
export function sampleDocx(): Uint8Array {
  return buildDocx(sampleParagraphs, sampleTitle);
}

/** Plain-text view of the sample, for editors that read text instead of bytes. */
export const sampleText = paragraphsToText(sampleParagraphs);

export { paragraphsToText, textToParagraphs };
