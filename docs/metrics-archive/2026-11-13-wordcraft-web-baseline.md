# WordCraft Web & open-docs Unmodified Baseline (2026-11-13)

Measured locally on macOS Apple Silicon using headless Google Chrome (CDP + WebGL/Metal, 1280×900) and `cargo xtask wasm-budget --report-only` before code edits.

## Artifact Sizes

| Artifact | Uncompressed | Gzip `-9` | Brotli `-11` | Code (sec 10) | Data (sec 11) | Custom (sec 0) | Forbidden Core Symbols |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: | :--- |
| `wordcraft-web-4611742c9b56a951_bg.wasm` | 51,711,138 B (51.71 MB) | 18,534,134 B (18.53 MB) | 10,822,688 B (10.82 MB) | 40,711,904 B | 10,883,300 B | 272 B | `wordcraft_docbin::` |
| `wordcraft-web-6683fbab6b4cfb0.js` | 182,456 B | — | — | — | — | — | — |
| `wc_render_bg.wasm.gz` (`open-docs/tools/wordcraft-render/dist/`) | — | 5,331,743 B (5.33 MB) | — | — | — | — | — |

## Live Chrome CDP Measurements

- **Standalone `http://127.0.0.1:8081/?sample`**:
  - `readyMs`: `575 ms`
  - `heapBytes`: `3,077,174 B` (`3.08 MB`)
  - `commands()` (`677` commands): `124.6 ms`
  - `docInspect()`: `18.2 ms`
  - `execute('text.insert')`: `30.7 ms`
  - `getMarkdown()` / `exportDocx()`: absent (`false` on baseline)
  - Console/Page/Failed requests: `0 / 0 / 0`
  - Screenshot: `/tmp/wc-baseline-standalone.png`

- **`open-docs` `http://127.0.0.1:8090/e/wordcraft`**:
  - `navToReadyMs`: `2,768 ms`
  - UI Startup Pill (`#od-m-time`): `1.15 s`
  - UI Mem Pill (`#od-m-mem`): `5.2 MB` (`5,489,548 B` JS heap)
  - UI Loaded Pill (`#od-m-size`): `50 MB` (`wordcraft-web_bg.wasm` 18,534,134 B gzipped over wire -> 51,711,138 B decoded)
  - CLS: `0.0014` (`previewImgPresent: false`)
  - `commands()`: `17.8 ms`
  - `docInspect()`: `17.2 ms`
  - `execute('text.insert')`: `36.6 ms`
  - Console/Page/Failed requests: `0 / 0 / 0`
  - Screenshot: `/tmp/wc-baseline-opendocs.png`

