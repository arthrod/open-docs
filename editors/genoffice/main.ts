/**
 * GenOffice, through the editors trial's demo build of it (lib/demo-frame.ts): its Docs application (an Electron renderer) with a stand-in for the desktop it expects.
 */
import { demoFrame } from "/lib/demo-frame.ts";
import { REVISION_NOTES } from "/lib/revision-notes.ts";

window.od.register(demoFrame({
  site: "genoffice",
  root: "genoffice-root",
  name: "GenOffice",
  revisions: REVISION_NOTES["genoffice"],
  download: "#demo-download",
  ready: (doc) => {
    // Its status bar counts pages once a document is laid out; the editing surface alone is there earlier.
    return !!doc.querySelector("#root .ProseMirror") && /Page \d+ of \d+/.test(doc.getElementById("root")?.textContent ?? "");
  },
}));
