# OnlyOffice (CryptPad build)

OnlyOffice's document editor running entirely in the browser, the way
[CryptPad](https://github.com/cryptpad/cryptpad) runs it: no document server.

| Part | Source | Tag |
| --- | --- | --- |
| Editor (web-apps + sdkjs, co-editing socket replaced by page messages) | https://github.com/cryptpad/onlyoffice-editor | `v9.3.2+3` |
| Converter (OnlyOffice's x2t, compiled to WebAssembly) | https://github.com/cryptpad/onlyoffice-x2t-wasm | `v9.3.2+3` |

This stands in the catalogue for three things that were asked for together:
`cryptpad/onlyoffice-x2t-wasm` is a converter with no editor of its own, and
ONLYOFFICE's `DocSpace-client` is the front end of a document-management
platform that embeds the editor from a document server, so neither is an
engine by itself. The pair above is the one way to open, edit and save a
.docx with OnlyOffice's code and no server.

## Licence and source (AGPL-3.0)

Both parts are AGPL-3.0. They are served **unmodified**, file by file, out of
the two release archives named above. The complete corresponding source is
those two repositories at tag `v9.3.2+3`, and the wrapper that drives them
is the three files in this folder plus `server/onlyoffice.ts` and
`server/zip-mirror.ts`, all in this repository.

## How the files are served

The editor archive is 608 MB (four editors, dictionaries, help). Nothing is
unpacked ahead of time. `editor-zip-index.json` and `x2t-zip-index.json` map
each file this site uses to `[offset, compressed size, method]` inside its
archive; `server/zip-mirror.ts` reads one file with one HTTP range request
the first time it is asked for and keeps it in blob storage.

To rebuild an index for another tag (reads only the archive's central
directory):

```sh
python3 -I scripts/zip_index.py "<release .zip URL>" full-index.json
```

then keep the word editor's subset (drop the spreadsheet, presentation, PDF
and Visio editors, `dictionaries/`, `web-apps/vendor/monaco/`, help, mobile,
embed, forms and `*.map`) as `{path: [offset, csize, method]}`.

## Known gaps

- One header icon (`icon-document-white.svg`) is not in the archive and answers 404.
- An assistant edit opens a newly built .docx in a new editor, so it is not a step of the editor's history.
