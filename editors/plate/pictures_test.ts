import { assertEquals } from "jsr:@std/assert@1.0.13";
import { imageNode, pictureLayout } from "./pictures.ts";

const pic = (cx: number) =>
  `<w:r><w:drawing><wp:inline><wp:extent cx="${cx}" cy="100"/><a:graphic><a:graphicData><pic:pic/></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
const chart = `<w:r><w:drawing><wp:inline><wp:extent cx="9525000" cy="100"/><a:graphic><a:graphicData><c:chart/></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
const doc = (...ps: string[]) => `<w:document><w:body>${ps.join("")}</w:body></w:document>`;

Deno.test("width from wp:extent (EMU → px), alignment from the picture's own paragraph", () => {
  const xml = doc(
    `<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${pic(5029200)}</w:p>`,
    `<w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:t>x</w:t></w:r>${pic(952500)}</w:p>`,
    `<w:p>${pic(1905000)}</w:p>`,
  );
  assertEquals(pictureLayout(xml), [{ width: 528, align: "center" }, { width: 100, align: "right" }, { width: 200 }]);
});

Deno.test("a previous paragraph's alignment does not leak; charts are not pictures", () => {
  const xml = doc(`<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>t</w:t></w:r></w:p>`, `<w:p>${chart}</w:p>`, `<w:p>${pic(952500)}</w:p>`);
  assertEquals(pictureLayout(xml), [{ width: 100 }]);
});

Deno.test("jc=end counts as right; jc inside a run's properties is ignored", () => {
  const xml = doc(`<w:p><w:pPr><w:jc w:val="end"/></w:pPr>${pic(952500)}</w:p>`, `<w:p><w:pPr/><w:r><w:rPr/></w:r>${pic(952500)}</w:p>`);
  assertEquals(pictureLayout(xml), [{ width: 100, align: "right" }, { width: 100 }]);
});

Deno.test("imageNode keeps only raster/svg data: URLs and carries the layout", () => {
  assertEquals(imageNode("data:image/png;base64,AAAA", "", { width: 528, align: "center" }), {
    type: "img",
    url: "data:image/png;base64,AAAA",
    width: 528,
    align: "center",
    children: [{ text: "" }],
  });
  assertEquals(imageNode("data:image/jpeg;base64,AA", "a chart"), { type: "img", url: "data:image/jpeg;base64,AA", alt: "a chart", children: [{ text: "" }] });
  assertEquals(imageNode("javascript:alert(1)", ""), null);
  assertEquals(imageNode("https://tracker.example/x.png", ""), null);
  assertEquals(imageNode("data:text/html;base64,AA", ""), null);
});
