/**
 * Where Plate's .docx exporter bundle (tools/plate-docx-io) is loaded from and
 * its SRI hash. Plain constants so the server (import map) and the browser
 * (lib/plate-docx.ts) share them.
 */
export const DOCX_IO_URL =
  "https://cdn.jsdelivr.net/gh/arthrod/open-docs@f8cfa3146015d430d45ee9d8882fc879c3a29e28/tools/plate-docx-io/dist/docx-io.js";
export const DOCX_IO_SRI = "sha384-L/ii233eUymzka2vn3p6XIwcZWOc5KeCwXAZQlxTCMYXpo5q60oBGs8MaF7xQuBi";
