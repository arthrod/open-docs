// The walk through an engine's own Undo/Redo history that the assistant's edit cards use.

/** The part of an engine adapter the walk needs. */
export type HistoryAdapter = {
  getMarkdown(): Promise<string> | string;
  undo?(): unknown;
  redo?(): unknown;
};

export const sameText = (x: string, y: string) => x.replace(/\s+/g, " ").trim() === y.replace(/\s+/g, " ").trim();
/** Native history steps an apply may take (SuperDoc's importer is several). */
const MAX_STEPS = 12;

/**
 * Step the engine's OWN history (undo or redo) until the document reads
 * `target` again. Returns the steps taken, or restores the walk and returns
 * null if it never got there. Read failures also restore the walk before throwing.
 *
 * Limit: a step is counted only when the Markdown changed. An engine that keeps a history
 * entry Markdown cannot show (formatting only) makes the walk stop there as if the history
 * were empty; telling the two apart needs a history position from the engine, which the
 * adapter contract does not have.
 */
export async function stepHistory(a: HistoryAdapter, dir: "undo" | "redo", target: string): Promise<number | null> {
  const step = dir === "undo" ? a.undo : a.redo;
  if (!step) return null;
  const reverse = dir === "undo" ? a.redo : a.undo;
  if (!reverse) return null;
  let previous = await a.getMarkdown();
  // Exactly the target: nothing to step. (Not sameText: an edit that changed only white
  // space must still be stepped back.)
  if (previous === target) return 0;
  let steps = 0;
  const rollback = async () => {
    while (steps > 0) {
      await reverse.call(a);
      steps--;
    }
  };
  try {
    for (let i = 0; i < MAX_STEPS; i++) {
      await step.call(a);
      // Count before reading: a rejected read must still recover this step.
      steps++;
      const next = await a.getMarkdown();
      if (next === previous) {
        steps--; // Empty history did not change the document.
        break;
      }
      if (sameText(next, target)) return steps;
      previous = next;
    }
  } catch (err) {
    await rollback();
    throw err;
  }
  await rollback();
  return null;
}

