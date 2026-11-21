/**
 * docs.plus, through the editors trial's demo build of it (lib/demo-frame.ts): its own DOCX import and export modules around its Tiptap editor, without the collaboration server.
 */
import { demoFrame } from "/lib/demo-frame.ts";
import { REVISION_NOTES } from "/lib/revision-notes.ts";

window.od.register(demoFrame({
  site: "docs-plus",
  root: "docs-plus-root",
  name: "docs.plus",
  revisions: REVISION_NOTES["docs-plus"],
  download: "#download-docx",
  ready: (doc) => {
    const status = doc.getElementById("status");
    if (status?.dataset.state === "error") throw new Error(`docs.plus: ${status.textContent}`);
    return doc.getElementById("download-docx")?.getAttribute("aria-disabled") !== "true" && !!doc.querySelector("#editor .ProseMirror");
  },
}));
