import { assertEquals } from "jsr:@std/assert@1.0.13";
import { strFromU8, strToU8, unzipSync, zipSync } from "https://esm.sh/fflate@0.8.2?target=es2022";
import { flattenRevisions, hasRevisions, revisionsAsFormatting } from "./revisions.ts";

const text = (xml: string) => [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join("");

Deno.test("a replacement keeps both halves: the old word struck, the new one underlined", () => {
  const xml = `<w:p><w:r><w:t xml:space="preserve">rose </w:t></w:r>` +
    `<w:del w:id="1" w:author="Ana Lee" w:date="2026-11-15T00:00:00Z"><w:r><w:rPr><w:b/></w:rPr><w:delText>14</w:delText></w:r></w:del>` +
    `<w:ins w:id="2" w:author="Ana Lee" w:date="2026-11-15T00:00:00Z"><w:r><w:rPr><w:b/></w:rPr><w:t>15</w:t></w:r></w:ins>` +
    `<w:r><w:t> %</w:t></w:r></w:p>`;
  const out = flattenRevisions(xml);
  assertEquals(text(out), "rose 1415 %"); // nothing vanished
  assertEquals(hasRevisions(out), false);
  assertEquals(out.includes(`<w:rPr><w:b/><w:strike/><w:color w:val="C00000"/></w:rPr><w:t>14</w:t>`), true);
  assertEquals(out.includes(`<w:rPr><w:b/><w:u w:val="single"/><w:color w:val="C00000"/></w:rPr><w:t>15</w:t>`), true);
  // Untouched runs keep their properties exactly.
  assertEquals(out.includes(`<w:r><w:t xml:space="preserve">rose </w:t></w:r>`), true);
});

Deno.test("runs without properties, with empty properties, and with their own colour are all marked once", () => {
  const out = flattenRevisions(
    `<w:ins w:id="1" w:author="A"><w:r><w:t>a</w:t></w:r><w:r><w:rPr/><w:t>b</w:t></w:r>` +
      `<w:r><w:rPr><w:color w:val="00FF00"/><w:u w:val="double"/><w:i/></w:rPr><w:t>c</w:t></w:r></w:ins>`,
  );
  const marks = `<w:u w:val="single"/><w:color w:val="C00000"/>`;
  assertEquals(
    out,
    `<w:r><w:rPr>${marks}</w:rPr><w:t>a</w:t></w:r><w:r><w:rPr>${marks}</w:rPr><w:t>b</w:t></w:r>` +
      `<w:r><w:rPr><w:i/>${marks}</w:rPr><w:t>c</w:t></w:r>`,
  );
});

Deno.test("paragraph-mark revisions and formatting-change records are dropped, the paragraph stays", () => {
  const xml = `<w:p><w:pPr><w:pPrChange w:id="9" w:author="A"><w:pPr><w:jc w:val="left"/></w:pPr></w:pPrChange>` +
    `<w:rPr><w:del w:id="3" w:author="A" w:date="2026-11-15T00:00:00Z"/></w:rPr></w:pPr>` +
    `<w:del w:id="4" w:author="A"><w:r><w:delText>gone</w:delText></w:r></w:del></w:p>` +
    `<w:p><w:r><w:rPr><w:b/><w:rPrChange w:id="5" w:author="B"><w:rPr/></w:rPrChange></w:rPr><w:t>bold now</w:t></w:r></w:p>`;
  const out = flattenRevisions(xml);
  assertEquals(text(out), "gonebold now");
  assertEquals(/Change|w:del[ >\/]/.test(out), false);
  assertEquals(out.includes(`<w:r><w:rPr><w:b/></w:rPr><w:t>bold now</w:t></w:r>`), true);
});

Deno.test("text one reviewer inserted and another deleted is drawn as deleted", () => {
  const out = flattenRevisions(
    `<w:ins w:id="1" w:author="A"><w:del w:id="2" w:author="B"><w:r><w:delText>x</w:delText></w:r></w:del></w:ins>`,
  );
  assertEquals(out, `<w:r><w:rPr><w:strike/><w:color w:val="C00000"/></w:rPr><w:t>x</w:t></w:r>`);
});

Deno.test("a package without revisions comes back as the same bytes", () => {
  const plain = zipSync({ "word/document.xml": strToU8(`<w:document><w:body><w:p><w:r><w:t>hi</w:t></w:r></w:p></w:body></w:document>`) });
  const r = revisionsAsFormatting(plain);
  assertEquals(r.changed, false);
  assertEquals(r.bytes, plain);
});

Deno.test("a package with revisions is rewritten in document.xml only; other parts keep their bytes", () => {
  const comments = strToU8(`<w:comments><w:comment w:id="0"/></w:comments>`);
  const pkg = zipSync({
    "word/document.xml": strToU8(`<w:document><w:body><w:p><w:ins w:id="1" w:author="A"><w:r><w:t>new</w:t></w:r></w:ins></w:p></w:body></w:document>`),
    "word/comments.xml": comments,
  });
  const r = revisionsAsFormatting(pkg);
  assertEquals(r.changed, true);
  const files = unzipSync(r.bytes);
  assertEquals(hasRevisions(strFromU8(files["word/document.xml"])), false);
  assertEquals(text(strFromU8(files["word/document.xml"])), "new");
  assertEquals(files["word/comments.xml"], comments);
});

Deno.test("a run's own underline or colour written as an open/close pair is replaced too", () => {
  const xml = `<w:p><w:ins w:id="1" w:author="A"><w:r><w:rPr><w:u w:val="double"></w:u><w:color w:val="00FF00"></w:color><w:b/></w:rPr><w:t>new</w:t></w:r></w:ins></w:p>`;
  const out = flattenRevisions(xml);
  if (out.includes("double") || out.includes("00FF00")) throw new Error(out);
  if ((out.match(/<w:u /g) ?? []).length !== 1 || !out.includes("<w:b/>")) throw new Error(out);
});

Deno.test("a revision tag written with a newline or tab after its name is still a revision", () => {
  const xml = `<w:p><w:del\nw:id="1" w:author="A"><w:r><w:delText>old</w:delText></w:r></w:del><w:ins\tw:id="2" w:author="A"><w:r><w:t>new</w:t></w:r></w:ins></w:p>`;
  assertEquals(hasRevisions(xml), true);
  const out = flattenRevisions(xml);
  assertEquals(text(out), "oldnew");
  assertEquals(out.includes("<w:strike/>"), true);
  // A package holding only such tags is converted, not handed over untouched.
  const pkg = zipSync({ "word/document.xml": strToU8(xml) });
  assertEquals(revisionsAsFormatting(pkg).changed, true);
});

Deno.test("run properties written with whitespace or attributes in the tag are merged into, not doubled", () => {
  const marks = `<w:u w:val="single"/><w:color w:val="C00000"/>`;
  const out = flattenRevisions(
    `<w:ins w:id="1" w:author="A"><w:r><w:rPr ><w:b/></w:rPr ><w:t>a</w:t></w:r>` +
      `<w:r><w:rPr xmlns:x="urn:x"><w:i/></w:rPr><w:t>b</w:t></w:r><w:r><w:rPr /><w:t>c</w:t></w:r></w:ins>`,
  );
  assertEquals((out.match(/<w:rPr[\s>\/]/g) ?? []).length, 3); // one container per run
  assertEquals(
    out,
    `<w:r><w:rPr ><w:b/>${marks}</w:rPr><w:t>a</w:t></w:r><w:r><w:rPr xmlns:x="urn:x"><w:i/>${marks}</w:rPr><w:t>b</w:t></w:r>` +
      `<w:r><w:rPr>${marks}</w:rPr><w:t>c</w:t></w:r>`,
  );
});

Deno.test("a deleted run whose own strike is explicitly off, written as a pair, is still struck", () => {
  const out = flattenRevisions(
    `<w:del w:id="1" w:author="A"><w:r><w:rPr><w:strike w:val="false"></w:strike><w:b/></w:rPr><w:delText>x</w:delText></w:r></w:del>`,
  );
  assertEquals(out, `<w:r><w:rPr><w:b/><w:strike/><w:color w:val="C00000"/></w:rPr><w:t>x</w:t></w:r>`);
});

Deno.test("a '>' inside an attribute value does not end the tag (an author named A>B)", () => {
  const out = flattenRevisions(
    `<w:ins w:id="1" w:author="A>B"><w:r><w:t>x</w:t></w:r></w:ins><w:del w:id="2" w:author='C>D'><w:r w:rsidR="a>b"><w:delText>y</w:delText></w:r></w:del>` +
      `<w:r><w:rPr><w:b/><w:rPrChange w:id="3" w:author="E>F"><w:rPr><w:i/></w:rPr></w:rPrChange></w:rPr><w:t>z</w:t></w:r>`,
  );
  assertEquals(out.includes(`B"`), false);
  assertEquals(out.includes(`D'`), false);
  assertEquals(out.includes(`F"`), false);
  // The only text left between tags is the document's.
  assertEquals(out.replace(/<(?:"[^"]*"|'[^']*'|[^>"'])*>/g, ""), "xyz");
  assertEquals(out.includes("rPrChange"), false);
});
