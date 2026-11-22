/**
 * office-open, through the editors trial's demo build of it (lib/demo-frame.ts): the library's own parseDocument and generateDocument. It has no editor: the page shows what the parser produced, and Download writes it back.
 */
import { demoFrame } from "/lib/demo-frame.ts";
import { REVISION_NOTES } from "/lib/revision-notes.ts";

window.od.register(demoFrame({
  site: "office-open",
  root: "office-open-root",
  name: "office-open",
  revisions: REVISION_NOTES["office-open"],
  download: "#download",
  ready: (doc) => {
    const status = doc.getElementById("status");
    if (status?.dataset.state === "error") throw new Error(`office-open: ${status.textContent}`);
    return (doc.getElementById("download") as HTMLButtonElement | null)?.disabled === false;
  },
}));
