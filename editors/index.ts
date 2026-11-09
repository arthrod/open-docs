/**
 * Which editor folders are wired into the server.
 *
 * Add a slug here once `editors/<slug>/shell.ts` exists. Kept separate from
 * `server/registry.ts` so an editor can be listed as "planned" in the catalogue
 * without breaking the routes.
 */
export const editorMounts: string[] = [
  "canvas-editor",
  "docxodus",
  "superdoc",
  "plate",
  "docen",
  "eigenpal",
  "folio",
  "wordcraft",
];
