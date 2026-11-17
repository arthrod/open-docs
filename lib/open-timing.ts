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
 * How long the main thread must go without a long task before the page counts
 * as settled. Two seconds, not one: docen reports loaded, waits a second, then
 * paginates in one task of minutes, and a one-second window sometimes closed
 * in that pause and reported the page settled before its heaviest work began.
 * Work an engine starts later than this after its last long task is not seen.
 */
export const QUIET_MS = 2000;

/**
 * True when QUIET_MS have passed since the last long task ended AND since the
 * load completed. Without the second, a load longer than the window with no
 * long task in it (a network or worker-bound load) counted as quiet the moment
 * it returned, and work started after `load()` resolved was never waited for.
 */
export function quietSince(x: { now: number; lastBusy: number; loadDone?: number }): boolean {
  return x.now - Math.max(x.lastBusy, x.loadDone ?? x.lastBusy) >= QUIET_MS;
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

/**
 * Loads into the editor, one at a time and in the order asked. Two loads
 * running into the same editor finish in either order, so the slower document
 * would win whichever was asked for last. A load that fails does not hold up
 * the one after it.
 */
export class LoadQueue {
  #tail: Promise<unknown> = Promise.resolve();
  run<T>(fn: () => Promise<T>): Promise<T> {
    const mine = this.#tail.then(fn);
    this.#tail = mine.catch(() => {});
    return mine;
  }
}

/**
 * Prepare a document (read a file, build a blank one), then load it in turn,
 * unless a newer open took the page while it was being prepared or waiting:
 * that one's document must stay. True when this open loaded and still owns
 * the page. An overtaken open that fails says nothing; the current one throws.
 */
export async function ownedLoad<T>(
  owner: OpenOwner,
  queue: LoadQueue,
  prepare: () => Promise<T>,
  load: (doc: T) => Promise<void>,
): Promise<boolean> {
  const mine = owner.start();
  try {
    const doc = await prepare();
    await queue.run(() => (owner.owns(mine) ? load(doc) : Promise.resolve()));
  } catch (err) {
    if (!owner.owns(mine)) return false;
    throw err;
  }
  return owner.owns(mine);
}
