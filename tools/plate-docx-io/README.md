# plate-docx-io (browser bundle)

Plate's own `.docx` export and import, `@platejs/docx-io@53.5.5`, unchanged,
as one browser module. open-docs uses it for Plate's **Export .docx** and as the
markdown → `.docx` converter for engines that cannot import markdown themselves
(Docxodus, docx-editor.dev, folio): markdown → Plate (`@platejs/markdown`) →
`.docx` (this).

Why a bundle: esm.sh cannot build `docx-io` (its `xmlbuilder2` build has no
`create` export; `?bundle-deps` misses `entities` files), and the package
imports Node built-ins (`path`, `events`, `buffer`) that a browser needs
browser packages for. esbuild resolves those; **Plate stays external**, rewritten
to the exact esm.sh URLs in `editors/plate/deps.ts`, so the page keeps one copy
of Plate (two copies → plugins register on an editor they can't see).

```sh
./build.sh   # pnpm install, esbuild, prints the sha384 SRI hash
```

The file is too large for a Val file (1.9 MB): pages load it from jsDelivr at a
pinned commit of this repo, checked against the SRI hash in the page import map
(`lib/plate-docx.ts`, `server/router.ts`).
