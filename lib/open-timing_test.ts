import { assertEquals } from "jsr:@std/assert@1.0.13";
import { longTasksSupported, OpenOwner, settledMs } from "./open-timing.ts";

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

Deno.test("only the newest open owns the page: an older one that finishes later does not", () => {
  const owner = new OpenOwner();
  const a = owner.start();
  assertEquals(owner.owns(a), true);
  const b = owner.start();
  assertEquals(owner.owns(a), false);
  assertEquals(owner.owns(b), true);
});
