/**
 * Fidus Writer, through the editors trial's demo build of it (lib/demo-frame.ts): the document library of Fidus Writer (its DOCX importer, its schema in a ProseMirror view, its DOCX exporter), without the Django application around it.
 */
import { demoFrame } from "/lib/demo-frame.ts";
import { REVISION_NOTES } from "/lib/revision-notes.ts";

window.od.register(demoFrame({
  site: "fidus-writer",
  root: "fidus-writer-root",
  name: "Fidus Writer",
  revisions: REVISION_NOTES["fidus-writer"],
  download: "#download",
  ready: (doc) => {
    const status = doc.getElementById("status");
    if (status?.dataset.state === "error") throw new Error(`Fidus Writer: ${status.textContent}`);
    return (doc.getElementById("download") as HTMLButtonElement | null)?.disabled === false;
  },
}));
