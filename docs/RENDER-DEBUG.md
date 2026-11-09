# Why nothing renders — audit and fix plan

Status: **diagnosed, not yet fixed.** Every finding below was reproduced against
the live deployment, not inferred.

---

## Layer 1 — the fatal, all-eight bug (proven)

`lib/ui.ts` owns the chrome: it installs the real `window.od.status` / `log` and
**replaces** `window.od.register` with a version that sets its private `current`.

The shell loads the adapter **before** `lib/ui.ts`:

```
1. /lib/boot.ts                 (head — installs window.od, register → kit.adapter)
2. https://esm.town/v/std/catch
3. /editors/<slug>/main.ts(x)   ← adapter runs HERE
4. /lib/ui.ts                   ← chrome installs its own register HERE
```

So every adapter registers into `boot.ts`'s implementation. `ui.ts`'s `current`
is still `undefined` when `boot()` runs, it polls for 15 s, then reports
*"No editor registered"*. **All eight editors mount zero pixels.**

### Fix

Make registration not depend on script order:

1. `lib/boot.ts` becomes the single owner of a small event/queue:
   `od.register(adapter)` records the adapter **and** notifies any listener.
2. `lib/ui.ts` does **not** reassign `register`. It attaches a listener via
   `od.onAdapter(cb)` and immediately drains an already-registered adapter.
3. Shell order stays as-is (adapter first) — it becomes correct either way.

Guard for the second-order version of the same bug: `ui.ts` must render the
chrome's DOM wiring only after `DOMContentLoaded` (it currently runs as a
module from `<body>`, which is fine, but the `getElementById(...)!` calls have
no guards).

---

## Layer 2 — per-editor failures that will surface next

Once Layer 1 is fixed each editor loads its CDN module. These are the ones that
still break, in order of severity.

| Editor | Problem | Evidence | Fix |
| --- | --- | --- | --- |
| **eigenpal** | Stylesheet 404s | `@docx-editor.dev/core/styles/editor.css` → 404. The sheet is exported by the **react** package: `exports` has `"./styles.css": "./src/styles/editor.css"` | `<link href="https://esm.sh/@docx-editor.dev/react@2.35.0/styles.css">` (200, text/css) |
| **eigenpal** | Import specifier is fragile | `?bundle-deps&external=…` → 504-ish/empty; `?external=react,react-dom` → 200 | use `?external=react,react-dom` (drop `bundle-deps`) |
| **plate** | `main.tsx` imports `editor.tsx` which pins `?bundle-deps&external=…react-dom/client` | plate resolves 200 but `react-dom/client` in the external list makes esm.sh emit a second React → *"Cannot read properties of null (reading 'useState')"* | externalise only `react,react-dom,react/jsx-runtime` and keep one React version across adapter + editor |
| **docen** | True ESM failures possible | bundle references `@microsoft/fast-element/hydration.js` | verify at runtime; if it breaks, fall back to the UMD build |
| **folio** | Peer-heavy bundle | 4.2 MB, references `node:process/buffer/stream/util` | confirm `?bundle&external=…` stripped them; else switch to `?bundle&target=es2022` |
| **superdoc** | 12 MB bundle | single module, resolves fine | expect a long first paint; keep the loading message |
| **canvas-editor** | No library DOCX | by design | none — adapter already implements OOXML |

### Structural bug that hides all of the above

Every adapter calls `window.od.status(...)` inside `mount()`. That is fine — but
when `mount()` throws, `ui.ts` writes the message into `#od-status`, which is a
`text-overflow: ellipsis` one-liner inside a flex bar. **A long error message is
invisible in practice.** Fix: render mount failures into the stage itself, not
the status strip.

---

## Layer 3 — verification gaps

The checks I ran (and their limits):

| Check | Covers | Blind spot |
| --- | --- | --- |
| `audit-modules` | every served module resolves, right content-type | does not execute the module |
| `audit-cdn` | every CDN bundle resolves + exports the symbol | does not execute it |
| `audit-adapters` | shell entry path exists, `waitFor` selector present in body | static only |

None of these boots the editor. **We need one runtime probe** — a page that
imports an adapter, mounts it against the sample docx, and reports
`{ok, ms, error}` back to the log so `get_logs` is the evidence channel.

---

## Recommended order of work

1. **Layer 1** — `boot.ts` + `ui.ts` registration. One change, unblocks all 8.
2. **Runtime probe** — `/#selftest` page that mounts a chosen editor headlessly
   and reports pass/fail to the log. This is what turns the next rounds from
   guesswork into a checklist.
3. **eigenpal** — both known 404s.
4. **plate** — single-React guarantee.
5. **The rest** — one at a time, driven by the probe.
6. **Error surfacing** — mount failures render into the stage.
7. Landing page last, as agreed.
