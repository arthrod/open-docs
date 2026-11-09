# wordcraft-render (wasm)

WordCraft's own `.docx` reader, page layout and rasteriser as one WebAssembly
function, so a Deno server (the [open-docs viewer](https://open-docs-viewer.val.run)
on Val Town) renders `.docx` pages the way `wordcraft-cli convert x.docx x.png`
does: no browser, no GPU, no filesystem, no subprocess.

```ts
import init, { render_docx } from "./dist/wc_render.js";
await init({ module_or_path: wasmBytes });          // dist/wc_render_bg.wasm.gz, gunzipped
const pngs: Uint8Array[] = render_docx(docxBytes, 1.5); // one PNG per printed page
```

`render_docx` runs `wordcraft_docx::read_with_password` → `wordcraft_layout::layout`
(Print view) → `wordcraft_render::render_page` (vello_cpu) for every page, with
headers and footers at full strength, as WordCraft's `file.exportPng` does.
Text uses the fonts WordCraft bundles (Source Sans 3 / Source Serif 4 and its
other embedded faces), not Microsoft's.

## Files

| Path | What |
| --- | --- |
| `src/lib.rs` | the wrapper (one `#[wasm_bindgen]` function) |
| `Cargo.toml` | the crate, built as a member of the WordCraft workspace |
| `dist/wc_render.js` | wasm-bindgen glue (`--target web`) |
| `dist/wc_render_bg.wasm.gz` | the module, `wasm-opt -Oz`, gzipped |

`dist/wc_render_bg.wasm.gz` SHA-256:
`e42d2c262d052b33292fd9dbace987be9b457b091209d5497e987d231bf949f6`
(gunzipped: `776cdbd94f68d879d5c3e2032bbb659cea70b47fd55a7242d8bfadd51e799820`).
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
