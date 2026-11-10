import { assertEquals } from "jsr:@std/assert@1.0.13";
import { editors } from "./registry.ts";

const LINKEDIN = /^https:\/\/www\.linkedin\.com\/(in|company)\/[A-Za-z0-9_-]+\/?$/;
const GITHUB = /^https:\/\/github\.com\/[A-Za-z0-9_-]+\/?$/;

Deno.test("every engine except our own cite-check credits its makers (#44)", () => {
  for (const e of editors) {
    if (e.slug === "cite-check") continue;
    assertEquals((e.makers ?? []).length > 0, true, `${e.slug} has no makers`);
  }
});

Deno.test("maker links are LinkedIn or GitHub profiles only, at least one per maker (#44)", () => {
  for (const e of editors) {
    for (const m of e.makers ?? []) {
      assertEquals(!!(m.linkedin || m.github), true, `${e.slug}: ${m.name} has no link`);
      if (m.linkedin) assertEquals(LINKEDIN.test(m.linkedin), true, `${e.slug}: ${m.linkedin}`);
      if (m.github) assertEquals(GITHUB.test(m.github), true, `${e.slug}: ${m.github}`);
    }
  }
});
