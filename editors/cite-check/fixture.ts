/**
 * cite-check fixtures, built server-side (Val Town files are text-only, so the
 * .docx fixtures cannot ship as files — same approach as server/sample.docx.ts).
 *
 *   appellate-brief.docx  the demo document: a formatted appellate brief
 *                         (court caption block, party names, case number,
 *                         titled sections — Preliminary Statement, Statement
 *                         of Facts, Argument with numbered headings —
 *                         quotation sentences with [1]..[4] markers and
 *                         footnote lines "Source name, p. X"), engineered as
 *                         2 exact + 1 normalized + 1 fuzzy (number-altered)
 *                         quotes + 1 unmarked quotation (extraction warning).
 *   marker-free.docx      no quote markers at all — the core must yield 0 rows.
 *   sources.txt           the brief's FULL source set in the importable
 *                         .txt format (page-segmented sources). It covers
 *                         every cited source plus one deliberately UNCITED
 *                         source (Meridian Maintenance Manual), so
 *                         "footnote matches no source" stays demonstrable by
 *                         importing a partial source file of your own.
 */
import { buildDocx } from "../../server/docx.ts";

const S = { serif: true, size: 24, line: 360 } as const;
const H = { serif: true, size: 24, bold: true, center: true, before: 360, after: 240, line: 276 } as const;

const brief = [
  // Court header
  { text: "IN THE COURT OF APPEAL OF THE STATE OF CALIFORNIA", serif: true, size: 24, bold: true, center: true, after: 0 },
  { text: "FIRST APPELLATE DISTRICT", serif: true, size: 24, bold: true, center: true, after: 0 },
  { text: "DIVISION THREE", serif: true, size: 24, bold: true, center: true, after: 240 },
  // Caption: two-column table, parties | case number + title
  {
    table: {
      left: [
        { text: "HALCYON FOODS, INC.,", ...S, after: 240, line: 276 },
        { text: "Plaintiff and Appellant,", ...S, after: 240, line: 276 },
        { text: "v.", ...S, after: 240, line: 276 },
        { text: "MERIDIAN LOGISTICS, LTD.,", ...S, after: 240, line: 276 },
        { text: "Defendant and Respondent.", ...S, after: 0, line: 276 },
      ],
      right: [
        { text: "No. A172945", ...S, bold: true, after: 0, line: 276 },
        { text: "", after: 1800 },
        { text: "APPELLANT'S OPENING BRIEF", ...S, bold: true, after: 0, line: 276 },
      ],
    },
  },
  { text: "PRELIMINARY STATEMENT", ...H },
  {
    text:
      "This is an appeal from the denial of summary judgment on Halcyon Foods, Inc.'s breach-of-warranty claim. The record contains no genuine dispute of material fact, and this court should reverse. The governing standard is familiar: \"The district court retains wide latitude to admit or exclude summary judgment evidence under Rule 56(c).\" [1]",
    ...S, justify: true,
  },
  {
    text:
      "As the trial court itself recognized at the hearing, \"summary judgment is not a disfavored procedural shortcut but a careful search for genuine issues of fact.\"",
    ...S, justify: true,
  },
  { text: "STATEMENT OF FACTS", ...H },
  {
    text:
      "The delivery contract at issue was executed in March 2024 and incorporates the supplier quality specification annexed to the complaint as Exhibit A. The events at issue occurred at the Millbrook plant during the night shift of July 9, 2025, and span fewer than fifteen minutes from first alert to full shutdown.",
    ...S, justify: true,
  },
  {
    text:
      "The supervisor on duty confirmed the sequence at trial: \"I walked the floor twice each shift, and the alarm panel was green when I passed it at 11:40 p.m.\" [2]",
    ...S, justify: true,
  },
  {
    text:
      "Counsel for respondent paints a different picture, asserting that \"the engine was shut down approximately 120 seconds before the alarm sounded, and the maintenance log shows that the shutdown was initiated from the control room by the night supervisor on duty, who then waited for the ventilation cycle to complete before opening the access door.\" [3]",
    ...S, justify: true,
  },
  { text: "ARGUMENT", ...H },
  { text: "I. THE TRIAL COURT ERRED IN DENYING SUMMARY JUDGMENT", serif: true, size: 24, bold: true, before: 240, after: 120, line: 276 },
  {
    text:
      "Summary judgment is proper where the movant carries its burden. As this court has held, \"Summary judgment is properly granted when the movant shows that there is no genuine dispute as to any material fact and that the movant is entitled to judgment as a matter of Law.\" [4]",
    ...S, justify: true,
  },
  {
    text:
      "The standard of review on a summary judgment motion is de novo. The court views the evidence in the light most favorable to the nonmoving party and draws every reasonable inference in that party's favor. A party seeking summary judgment bears the initial burden of informing the court of the basis for its motion and of identifying those portions of the record that demonstrate the absence of a genuine dispute of material fact.",
    ...S, justify: true,
  },
  { text: "II. RESPONDENT'S TIMING EVIDENCE DOES NOT CREATE A TRIABLE ISSUE", serif: true, size: 24, bold: true, before: 240, after: 120, line: 276 },
  {
    text:
      "Once the moving party has met its burden, the nonmoving party may not rest upon mere allegations or denials. The response must set forth specific facts showing that there is a genuine issue for trial. In deciding the motion, the court does not weigh the evidence or determine the truth of the matter asserted; its sole function is to determine whether a genuine issue of material fact exists.",
    ...S, justify: true,
  },
  { text: "CONCLUSION", ...H },
  {
    text:
      "For the reasons stated above, appellant respectfully requests that this court reverse the judgment of the trial court, enter judgment in its favor, and award such other and further relief as the court deems just and proper.",
    ...S, justify: true,
  },
  // Counsel block (right-aligned, serif)
  { text: "Dated: November 9, 2026", ...S, right: true, before: 480, after: 0, line: 276 },
  { text: "Respectfully submitted,", ...S, right: true, after: 0, line: 276 },
  { text: "", after: 120 },
  { text: "JANDIRA LAW LLP", ...S, bold: true, right: true, after: 0, line: 276 },
  { text: "By: Ana R. Jandira", ...S, right: true, after: 0, line: 276 },
  { text: "Attorneys for Plaintiff and Appellant", ...S, right: true, after: 0, line: 276 },
  { text: "Halcyon Foods, Inc.", ...S, right: true, after: 240, line: 276 },
  { text: "400 Montgomery Street, Suite 700", ...S, size: 20, right: true, after: 0, line: 240 },
  { text: "San Francisco, CA 94104", ...S, size: 20, right: true, after: 0, line: 240 },
  { text: "(415) 555-0170 | counsel@jandira.law", ...S, size: 20, right: true, after: 360, line: 240 },
  // Notes (endnote-style, smaller, under a rule)
  { text: "", ruleBelow: true, after: 120 },
  { text: "[1] Smith v. United Services, 47 F.4th 312, 318 (D. Or. 2025).", serif: true, size: 20, line: 240, after: 40 },
  { text: "[2] Reporter's Transcript of Proceedings at 87 (Mar. 4, 2026).", serif: true, size: 20, line: 240, after: 40 },
  { text: "[3] Jones Deposition at 3 (June 2, 2026).", serif: true, size: 20, line: 240, after: 40 },
  { text: "[4] Smith v. United Services, 47 F.4th 312, 319 (D. Or. 2025).", serif: true, size: 20, line: 240, after: 40 },
];

const markerFree = [
  { text: "Internship Report", style: "Title" },
  {
    text:
      "This report summarizes the twelve-week internship at Meridian Logistics. Week one covered onboarding and safety training.",
  },
  {
    text:
      "During weeks two through six I worked on the dock scheduling tool, reducing average wait time by fourteen percent.",
  },
  { text: "Weeks seven through twelve were spent with the analytics team preparing the quarterly forecast." },
];

export const fixtureSourcesText = `--- Smith v. United Services | Smith v. United Services, 47 F.4th 312 (D. Or. 2025) ---
[p. 11]
On a motion for summary judgment, the court views the evidence in the light most favorable to the non-moving party and draws all reasonable inferences in that party's favor.
[p. 12]
The district court retains wide latitude to admit or exclude summary judgment evidence under Rule 56(c). Summary judgment is properly granted when the movant shows that there is no genuine dispute as to any material fact and that the movant is entitled to judgment as a matter of law.
[p. 13]
Evidence offered in opposition to a motion for summary judgment must be based on personal knowledge and must set forth facts that would be admissible in evidence.
--- Reporter's Transcript | Reporter's Transcript of Proceedings, Halcyon Foods v. Meridian Logistics (Mar. 4, 2026) ---
[p. 86]
Q. How often did you inspect the floor during your shift? A. I walked the floor twice each shift, once near the start and once around midnight.
[p. 87]
Q. What was the condition of the alarm panel that night? A. I walked the floor twice each shift, and the alarm panel was green when I passed it at 11:40 p.m.
--- Jones Deposition | Jones Deposition of R. Meridian (June 2, 2026) ---
[p. 2]
Q. Who was responsible for the engine room that night? A. I was the supervisor on duty, and I walked the floor twice each shift.
[p. 3]
Q. When was the engine shut down? A. The engine was shut down approximately 90 seconds before the alarm sounded, and the maintenance log shows that the shutdown was initiated from the control room by the night supervisor on duty, who then waited for the ventilation cycle to complete before opening the access door.
--- Meridian Maintenance Manual | Meridian Logistics Equipment Maintenance Manual (rev. 2024) ---
[p. 5]
The ventilation cycle must complete before the access door is opened. Bypassing the interlock voids the equipment warranty.
[p. 6]
Scheduled inspections of the alarm panel are to be logged at the start and midpoint of every shift by the supervisor on duty.
`;

export function fixtureBriefDocx(): Uint8Array {
  return buildDocx(brief, "Appellant's opening brief (fixture)");
}

export function fixtureMarkerFreeDocx(): Uint8Array {
  return buildDocx(markerFree, "Marker-free document");
}
