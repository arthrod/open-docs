/**
 * cite-check fixtures, built server-side (Val Town files are text-only, so the
 * .docx fixtures cannot ship as files — same approach as server/sample.docx.ts).
 *
 *   reviewed-memo.docx  the engineered "reviewed legal memo": 3 marked quotes
 *                       (exact / normalized / number-altered-→-fuzzy) + 1
 *                       unmarked quotation (extraction warning), padded to a
 *                       realistic length so an annotated export clears 10 KB.
 *   marker-free.docx    no quote markers at all — the core must yield 0 rows.
 *   sources.txt         the panel's source input (two page-segmented sources).
 */
import { buildDocx } from "../../server/docx.ts";

const memo = [
  { text: "MEMORANDUM OF LAW — PLAINTIFF'S MOTION FOR SUMMARY JUDGMENT", style: "Title" },
  {
    text:
      "Plaintiff Halcyon Foods, Inc. moves for summary judgment on its breach-of-warranty claim. There is no genuine dispute of material fact, and the motion should be granted.",
  },
  {
    text:
      'The standard is familiar: "The district court retains wide latitude to admit or exclude summary judgment evidence under Rule 56(c)." [1]',
  },
  {
    text:
      'The rule itself is satisfied here: "SUMMARY JUDGMENT IS PROPERLY GRANTED WHEN THE MOVANT SHOWS THAT THERE IS NO GENUINE DISPUTE AS TO ANY MATERIAL FACT AND THAT THE MOVANT IS ENTITLED TO JUDGMENT AS A MATTER OF LAW." [2]',
  },
  {
    text:
      'The opposition mischaracterizes the record when it asserts that "the engine was shut down approximately 120 seconds before the alarm sounded, and the maintenance log shows that the shutdown was initiated from the control room by the night supervisor on duty, who then waited for the ventilation cycle to complete before opening the access door." [3]',
  },
  {
    text:
      'As the court has reminded the parties, "summary judgment is not a disfavored procedural shortcut but a careful search for genuine issues of fact."',
  },
  {
    text:
      "The standard of review on a summary judgment motion is de novo. The court views the evidence in the light most favorable to the nonmoving party and draws every reasonable inference in that party's favor.",
  },
  {
    text:
      "A party seeking summary judgment bears the initial burden of informing the court of the basis for its motion and of identifying those portions of the record that demonstrate the absence of a genuine dispute of material fact.",
  },
  {
    text:
      "Once the moving party has met this burden, the nonmoving party may not rest upon mere allegations or denials. The response must set forth specific facts showing that there is a genuine issue for trial.",
  },
  {
    text:
      "In deciding the motion, the court does not weigh the evidence or determine the truth of the matter asserted. Its sole function is to determine whether a genuine issue of material fact exists for trial.",
  },
  {
    text:
      "The parties have completed discovery, including the depositions of the plant manager, the maintenance supervisor, and the regional safety coordinator. The record also contains the maintenance logs, the alarm reports, and the full incident investigation file.",
  },
  {
    text:
      "Plaintiff's warranty theory rests on the delivery contract executed in March 2024, which incorporates by reference the supplier quality specification annexed to the complaint as Exhibit A.",
  },
  {
    text:
      "The events at issue occurred at the Millbrook plant during the night shift of July 9, 2025, and the relevant sequence spans fewer than fifteen minutes from first alert to full shutdown.",
  },
  {
    text:
      "For the reasons stated above, plaintiff respectfully requests that the court grant the motion, enter judgment in its favor, and award such other and further relief as the court deems just and proper.",
  },
  { text: "Respectfully submitted," },
  { text: "Counsel for Plaintiff Halcyon Foods, Inc." },
  { text: "Dated: November 9, 2026" },
  { text: "" },
  { text: "[1] Smith v. United Services, p. 12" },
  { text: "[2] Smith v. United Services, p. 12" },
  { text: "[3] Jones Deposition, p. 3" },
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
--- Jones Deposition | Jones Deposition of R. Meridian (June 2, 2026) ---
[p. 2]
Q. Who was responsible for the engine room that night? A. I was the supervisor on duty, and I walked the floor twice each shift.
[p. 3]
Q. When was the engine shut down? A. The engine was shut down approximately 90 seconds before the alarm sounded, and the maintenance log shows that the shutdown was initiated from the control room by the night supervisor on duty, who then waited for the ventilation cycle to complete before opening the access door.
`;

export function fixtureMemoDocx(): Uint8Array {
  return buildDocx(memo, "Reviewed memo (fixture)");
}

export function fixtureMarkerFreeDocx(): Uint8Array {
  return buildDocx(markerFree, "Marker-free document");
}
