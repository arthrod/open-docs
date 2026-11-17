import { assertEquals } from "jsr:@std/assert@1.0.13";
import { hasReviewContent } from "./review-panel.ts";

/** A root that answers querySelector for the selectors present in it. */
const root = (...present: string[]) => ({
  querySelector: (sel: string) => sel.split(",").map((s) => s.trim()).some((s) => present.includes(s)) ? {} : null,
});

Deno.test("comments (folio's count badge) call for the review panel", () => {
  assertEquals(hasReviewContent(root(".basic-toolbar__comment-count")), true);
});

Deno.test("tracked changes without a single comment call for it too: folio shows no badge for them", () => {
  // Seen on redline.docx with its comments removed: no badge, 7 change cards in the panel.
  assertEquals(hasReviewContent(root(".docx-insertion")), true);
  assertEquals(hasReviewContent(root(".docx-deletion")), true);
});

Deno.test("a document with neither leaves the panel shut", () => {
  assertEquals(hasReviewContent(root()), false);
});
