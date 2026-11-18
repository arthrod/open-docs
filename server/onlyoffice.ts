// OnlyOffice as CryptPad builds it for the browser: the editor (cryptpad/onlyoffice-editor) and
// the converter (cryptpad/onlyoffice-x2t-wasm), both read file by file out of their release
// archives (server/zip-mirror.ts). The two are pinned to the same tag, as CryptPad pins them.
import editorIndex from "../editors/onlyoffice/editor-zip-index.json" with { type: "json" };
import x2tIndex from "../editors/onlyoffice/x2t-zip-index.json" with { type: "json" };
import { type Archive, serveZipEntry, type ZipIndex } from "./zip-mirror.ts";

export const ONLYOFFICE_TAG = "v9.3.2+3";
export const ONLYOFFICE_BASE = "/vendor/onlyoffice/9.3.2-3/";

const release = (repo: string, file: string) =>
  `https://github.com/cryptpad/${repo}/releases/download/${encodeURIComponent(ONLYOFFICE_TAG)}/${file}`;

const EDITOR: Archive = {
  key: "oo_editor_9.3.2-3",
  url: release("onlyoffice-editor", "onlyoffice-editor.zip"),
  index: editorIndex as unknown as ZipIndex,
};
const X2T: Archive = {
  key: "oo_x2t_9.3.2-3",
  url: release("onlyoffice-x2t-wasm", "x2t.zip"),
  index: x2tIndex as unknown as ZipIndex,
};

/** `/vendor/onlyoffice/9.3.2-3/x2t/<file>` is the converter; anything else is the editor's tree. */
export function onlyofficeTarget(path: string): { archive: Archive; file: string } | undefined {
  if (!path.startsWith(ONLYOFFICE_BASE)) return undefined;
  // sdkjs asks for its fonts at "fonts//fonts/<name>": doubled slashes are one.
  let file: string;
  try {
    file = decodeURIComponent(path.slice(ONLYOFFICE_BASE.length)).replace(/\/{2,}/g, "/");
  } catch {
    return undefined; // a malformed escape
  }
  if (!file || file.includes("..")) return undefined;
  return file.startsWith("x2t/") ? { archive: X2T, file: file.slice(4) } : { archive: EDITOR, file };
}

export function serveOnlyoffice(path: string, acceptEncoding: string): Promise<Response> {
  const t = onlyofficeTarget(path);
  if (!t) return Promise.resolve(new Response("not found", { status: 404 }));
  return serveZipEntry(t.archive, t.file, acceptEncoding);
}
