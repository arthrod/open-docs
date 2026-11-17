import { assertEquals } from "jsr:@std/assert@1.0.13";
import { longTasksSupported, OpenOwner, QUIET_MS, quietSince, settledMs } from "./open-timing.ts";

Deno.test("long tasks are observable only where the browser lists the entry type", () => {
  assertEquals(longTasksSupported({ supportedEntryTypes: ["longtask", "paint"] }), true);
  // Safari and Firefox: observe({type: "longtask"}) does not throw, it just never reports.
  assertEquals(longTasksSupported({ supportedEntryTypes: ["paint", "resource"] }), false);
  assertEquals(longTasksSupported({}), false);
  assertEquals(longTasksSupported(undefined), false);
});

Deno.test("settled is the end of the last long task, never earlier than the loader's own time", () => {
  assertEquals(settledMs({ t0: 100, ms: 400, lastBusy: 2100, quiet: true }), 2000);
  assertEquals(settledMs({ t0: 100, ms: 400, lastBusy: 100, quiet: true }), 400);
});

Deno.test("a page still busy when the wait gave up has no settled time", () => {
  assertEquals(settledMs({ t0: 0, ms: 400, lastBusy: 179_950, quiet: false }), null);
});

Deno.test("a pause shorter than the quiet window is not quiet: docen waits a second before it paginates", () => {
  // Measured 2026-11-17 on the 500 pages: a long task ended at 4636 ms and the next (162 s long) began at 5701 ms.
  assertEquals(quietSince({ now: 5700, lastBusy: 4636 }), false);
  assertEquals(quietSince({ now: 4636 + QUIET_MS - 1, lastBusy: 4636 }), false);
  assertEquals(quietSince({ now: 4636 + QUIET_MS, lastBusy: 4636 }), true);
});

Deno.test("only the newest open owns the page: an older one that finishes later does not", () => {
  const owner = new OpenOwner();
  const a = owner.start();
  assertEquals(owner.owns(a), true);
  const b = owner.start();
  assertEquals(owner.owns(a), false);
  assertEquals(owner.owns(b), true);
});

Deno.test("queued loads run one at a time, in the order asked, and a failed one does not block the next", async () => {
  const { LoadQueue } = await import("./open-timing.ts");
  const q = new LoadQueue();
  const log: string[] = [];
  const slow = q.run(async () => {
    log.push("a start");
    await new Promise((r) => setTimeout(r, 30));
    log.push("a end");
    throw new Error("a failed");
  });
  const fast = q.run(() => {
    log.push("b start");
    return Promise.resolve("b");
  });
  assertEquals(await slow.catch((e) => e.message), "a failed");
  assertEquals(await fast, "b");
  assertEquals(log, ["a start", "a end", "b start"]);
});
