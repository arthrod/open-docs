/**
 * The parts of timing a document open (lib/ui.ts `timedOpen`) that are plain
 * logic, kept apart from the page so `deno test` can run them.
 */

/**
 * Whether this browser reports long tasks. `observe({ type: "longtask" })`
 * does not throw where the type is unknown (Safari, Firefox): it registers
 * nothing and returns, so support has to be read from `supportedEntryTypes`.
 */
export function longTasksSupported(
  po: { supportedEntryTypes?: readonly string[] } | undefined = (globalThis as { PerformanceObserver?: { supportedEntryTypes?: readonly string[] } })
    .PerformanceObserver,
): boolean {
  return !!po?.supportedEntryTypes?.includes("longtask");
}

/**
 * Click → the end of the last long task before the page went quiet, never
 * less than the loader's own time `ms`. Null when the page never went quiet
 * within the wait (`quiet: false`): the last task seen is then not when it
 * settled, and saying so would report a settlement that did not happen.
 */
export function settledMs(x: { t0: number; ms: number; lastBusy: number; quiet: boolean }): number | null {
  return x.quiet ? Math.max(x.ms, Math.round(x.lastBusy - x.t0)) : null;
}

/**
 * Which open currently owns the page. Opening B while A is still loading or
 * being measured makes A stale: A must not write its timing, title or status
 * over B's.
 */
export class OpenOwner {
  #n = 0;
  start(): number {
    return ++this.#n;
  }
  owns(token: number): boolean {
    return token === this.#n;
  }
}
