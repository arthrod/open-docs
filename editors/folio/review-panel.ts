/**
 * Whether folio's "Comments & Changes" panel has anything to show for the
 * document it just rendered. folio puts a count badge on its toolbar toggle
 * for comment threads only; a document with tracked changes and no comments
 * has no badge, yet the panel lists a card per change. Those are found by the
 * marks folio draws them with.
 */
export const hasReviewContent = (root: { querySelector(selectors: string): unknown }): boolean =>
  !!root.querySelector(".basic-toolbar__comment-count") || !!root.querySelector(".docx-insertion, .docx-deletion");
