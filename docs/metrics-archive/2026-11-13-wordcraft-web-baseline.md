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


## Final Post-Optimization Measurements & Comparison

Updated on branch `wasmification` after completing the optimization plan and review fixes:

### WASM & Web Bundle Sizes
- **`dist/web/*_bg.wasm` (latest rebuild `wordcraft-web-5122c0d3ab47370d_bg.wasm`)**:
  - Uncompressed: `51,711,138` B → **`17,636,838` B** (`-65.9%`, budget `<= 18,500,000` B)
  - Gzip `-9`: `18,534,134` B → **`6,925,130` B** (`-62.6%`, budget `<= 7,100,000` B)
  - Code section (`sec10`): `40,711,904` B → **`14,966,777` B** (`-63.2%`)
  - Data section (`sec11`): `10,883,300` B → **`2,595,509` B** (`-76.2%`, budget `<= 2,750,000` B)
  - Custom section (`sec0`): `272` B → **`72` B**
- **`dist/web/*.js`**: `182,456` B → **`106,774` B** (`-41.5%`, measured on `wordcraft-web-488b6781cf748f53.js`)
- **`open-docs/tools/wordcraft-render/dist/wc_render_bg.wasm.gz`**: `5,331,743` B → **`2,467,371` B** (`-53.7%`, `5,660,890` B raw)

### Local Chrome CDP Benchmarks (measured prior to final test-gate commit)
- **Standalone `wordcraft-web` (`http://127.0.0.1:8081/?sample`)**:
  - `readyMs`: `575` ms → **`432` ms** (`-24.9%`)
  - JS heap used: `3,077,174` B (`3.08` MB) → **`2,496,092` B** (`2.50` MB, `-18.9%`)
  - `docInspectMs`: `18.2` ms → **`7.5` ms**
  - `getMarkdownMs`: **`5` ms**; `exportDocxMs`: **`20.2` ms**
  - Console / page / network errors: **`0`**
- **`open-docs` WordCraft editor (`http://127.0.0.1:8090/e/wordcraft`)**:
  - `navToReadyMs`: `2,768` ms → **`2,644` ms**
  - `#od-m-time`: `1.15` s → **`996` ms** (`-13.4%`)
  - `#od-m-mem`: `5.2` MB (`5,489,548` B) → **`4.6` MB** (`4,802,399` B, `-12.5%`)
  - `#od-m-size`: `50` MB → **`17` MB** (`-66.0%`)
  - `cls`: **`0.0014`** (`previewImgPresent: true`)
  - `commandsMs`: `17.8` ms → **`9` ms**; `docInspectMs`: `17.2` ms → **`14.6` ms**; `textInsertMs`: `36.6` ms → **`23.9` ms**; `getMarkdownMs`: **`8.9` ms**; `exportDocxMs`: **`17.5` ms**
  - Console / page / network errors: **`0`**
