/**
 * Kit bootstrap — runs in <head>, before any adapter or chrome module.
 *
 * WHY THIS FILE OWNS `register`
 * -----------------------------
 * The shell loads the adapter BEFORE `lib/ui.ts`. Originally `ui.ts` replaced
 * `window.od.register` with its own, so every adapter registered into this
 * object and the chrome's `current` stayed undefined: nothing ever mounted.
 *
 * So registration lives here, once, and the chrome subscribes instead of
 * overriding. Order no longer matters in either direction.
 */
import {
  b64decode,
  b64encode,
  type EditorAdapter,
  type KitGlobal,
} from "./kit.ts";
import { blocksToMd, diffSummary, mdToBlocks, mdToHtml } from "./md.ts";
import { blankDocx, sampleDocx, sampleMarkdown } from "./samples.ts";

const noop = () => {};
// The default Resource Timing buffer (250 entries) fills on the heavier
// editors, and "Re-measure now" would then undercount what the page loaded.
performance.setResourceTimingBufferSize?.(5000);

/** Adapters that registered before the chrome subscribed. */
const queue: EditorAdapter[] = [];
const listeners = new Set<(a: EditorAdapter) => void>();

const kit: KitGlobal = {
  adapter: undefined,

  register(adapter: EditorAdapter) {
    kit.adapter = adapter;
    kit.registeredAt = performance.now();
    if (listeners.size === 0) {
      // Chrome not loaded yet — hold it.
      queue.push(adapter);
      return;
    }
    for (const fn of listeners) fn(adapter);
  },

  /** Chrome-side hook. Drains anything registered before it subscribed. */
  onAdapter(fn) {
    listeners.add(fn);
    const pending = queue.splice(0, queue.length);
    for (const a of pending) fn(a);
  },

  md: { mdToBlocks, blocksToMd, mdToHtml, diffSummary } as unknown as
    typeof import("./md.ts"),
  blankDocx,
  sampleDocx,
  sampleMarkdown,
  download(bytes: Uint8Array, filename: string) {
    const blob = new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  },
  status: noop,
  progress(detail: string) {
    const el = document.getElementById("od-loading-detail");
    if (el) el.textContent = detail;
  },
  log: noop,
  bytesToBase64: b64encode,
  base64ToBytes: b64decode,
};

(window as unknown as { od: KitGlobal }).od = kit;
