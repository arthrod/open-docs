# wordcraft-render (wasm)

WordCraft's own `.docx` reader, page layout and rasteriser as one WebAssembly
module, so a Deno server (the [open-docs viewer](https://viewers.benchmarks.law)
on Val Town) renders `.docx` pages the way `wordcraft-cli convert x.docx x.png`
does: no browser, no GPU, no filesystem, no subprocess.

```ts
import init, { Doc, render_docx } from "./dist/wc_render.js";
await init({ module_or_path: wasmBytes });          // dist/wc_render_bg.wasm.gz, gunzipped

// One page at a time: read and lay out once, rasterise only the pages asked for.
const doc = new Doc(docxBytes);
const sizes = doc.page_sizes();                      // points: width, height, width, height, …
const png: Uint8Array = doc.render_page(0, 2);       // page 1 at 2 pixels per point

// Or every page in one call.
const pngs: Uint8Array[] = render_docx(docxBytes, 2);
```

Both run `wordcraft_docx::read_with_password` → `wordcraft_layout::layout`
(Print view) → `wordcraft_render::render_page` (vello_cpu), with headers and
footers at full strength, as WordCraft's `file.exportPng` does.

`Doc` exists because a long document cannot be sent as one response: 550 pages
at 2 pixels per point are 520 MB of base64 PNG. On a 550-page document, laying
out takes about 0.7 s and one page about 0.1 to 0.2 s (Apple M-series, Deno),
so a server can answer with the page sizes at once and rasterise each page
when the browser asks for it. `Doc.render_page` also compresses its PNG harder
than `render_docx` does (about half the bytes, about 0.1 s more per page) and
drops the alpha channel of a fully opaque page.

Text uses the fonts WordCraft bundles (Source Sans 3 / Source Serif 4 and its
other embedded faces), not Microsoft's.

## Files

| Path | What |
| --- | --- |
| `src/lib.rs` | the wrapper (`Doc` and `render_docx`) |
| `Cargo.toml` | the crate, built as a member of the WordCraft workspace |
| `dist/wc_render.js` | wasm-bindgen glue (`--target web`) |
| `dist/wc_render_bg.wasm.gz` | the module, `wasm-opt -Oz`, gzipped |

`dist/wc_render_bg.wasm.gz` SHA-256:
`60869b8554e3656bfe13f517d1cece3d99b05d017e261d65ce597e614a6cc85f`
(gunzipped: `ad132aa50b51eb0f2d0079b626ac29fb45c12c1f0ab7dab8da29b9a3f1b8782b`).
The viewer checks the first before it instantiates anything.

## Build

Built from [storytold/wordcraft](https://github.com/storytold/wordcraft) at
`d40d1b27181b61990c84c75f77d5fd23ef81d452`, Rust 1.99, wasm-bindgen 0.2.129
(the version WordCraft's lockfile pins).

```sh
git clone https://github.com/storytold/wordcraft && cd wordcraft
git checkout d40d1b27181b61990c84c75f77d5fd23ef81d452
mkdir -p apps/wc-render && cp -r <this folder>/{Cargo.toml,src} apps/wc-render/
cargo build -p wc-render --release --target wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.129 --locked --root /tmp/wb
/tmp/wb/bin/wasm-bindgen --target web --out-dir out target/wasm32-unknown-unknown/release/wc_render.wasm
wasm-opt -Oz --enable-bulk-memory --enable-nontrapping-float-to-int --enable-sign-ext \
  --enable-mutable-globals -o out/wc_render_bg.wasm out/wc_render_bg.wasm
gzip -9 out/wc_render_bg.wasm
```

## License

WordCraft is MIT OR Apache-2.0; this wrapper is under the same terms.
