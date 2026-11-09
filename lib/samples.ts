/**
 * Documents every editor can be handed.
 *
 * Three distinct things, and mixing them up is what made this bench confusing:
 *
 *   blankDocx()    — a valid, empty Word package (one empty paragraph).
 *   sampleDocx()   — the shared fixture bytes from the server.
 *   markdownOf()   — the fixture as markdown, for editors with no DOCX path.
 *
 * `blankDocx()` is generated here rather than fetched so an editor can paint
 * before any network round-trip.
 */

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

/** [Content_Types].xml for a minimal, valid document package. */
const CONTENT_TYPES = `${XML}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;

const ROOT_RELS = `${XML}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

const DOC_RELS = `${XML}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

/** One empty paragraph — what Word's "New document" is. */
const DOCUMENT = `${XML}
<w:document xmlns:w="${W_NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:body>
<w:p><w:pPr><w:pStyle w:val="Normal"/></w:pPr></w:p>
<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>
</w:body></w:document>`;

const STYLES = `${XML}
<w:styles xmlns:w="${W_NS}">
<w:docDefaults>
<w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault>
</w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
</w:styles>`;

const CORE_PROPS = `${XML}
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
  xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title></dc:title><dc:creator>open-docs</dc:creator><cp:lastModifiedBy>open-docs</cp:lastModifiedBy>
<dcterms:created xsi:type="dcterms:W3CDTF">2024-01-01T00:00:00Z</dcterms:created>
<dcterms:modified xsi:type="dcterms:W3CDTF">2024-01-01T00:00:00Z</dcterms:modified>
</cp:coreProperties>`;

const APP_PROPS = `${XML}
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
<Application>open-docs</Application>
</Properties>`;

let cached: Uint8Array | undefined;
let zipping: Promise<Uint8Array> | undefined;

/**
 * A valid, empty .docx: one empty paragraph, US Letter, Calibri 11.
 *
 * Zipped in the browser with fflate. Cached, because every "New document"
 * click would otherwise re-zip five parts.
 */
export async function blankDocx(): Promise<Uint8Array> {
  if (cached) return cached;
  if (zipping) return zipping;
  zipping = (async () => {
    // Prefer the server's builder: it is the same code path that produces the
    // known-good sample fixture, including the part ordering that strict OOXML
    // readers require. Fall back to zipping locally if offline.
    try {
      const res = await fetch("/api/blank.docx", { cache: "no-store" });
      if (res.ok) {
        const buf = new Uint8Array(await res.arrayBuffer());
        if (buf[0] === 0x50 && buf[1] === 0x4b) {
          cached = buf;
          return cached;
        }
      }
    } catch { /* fall through */ }

    const { strToU8, zipSync } = await import("https://esm.sh/fflate@0.8.2");
    cached = zipSync({
      "[Content_Types].xml": strToU8(CONTENT_TYPES),
      "_rels/.rels": strToU8(ROOT_RELS),
      "docProps/core.xml": strToU8(CORE_PROPS),
      "docProps/app.xml": strToU8(APP_PROPS),
      "word/document.xml": strToU8(DOCUMENT),
      "word/_rels/document.xml.rels": strToU8(DOC_RELS),
      "word/styles.xml": strToU8(STYLES),
    });
    return cached;
  })();
  return zipping;
}

/** The shared fixture, straight from the server. */
export async function sampleDocx(): Promise<Uint8Array> {
  const res = await fetch("/api/sample.docx", { cache: "no-store" });
  if (!res.ok) throw new Error(`sample.docx → HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

/** The fixture as markdown, for the agent prompt / non-DOCX editors. */
export async function sampleMarkdown(): Promise<string> {
  const res = await fetch("/api/sample.txt", { cache: "no-store" });
  if (!res.ok) throw new Error(`sample.txt → HTTP ${res.status}`);
  const json = await res.json();
  return json.markdown as string;
}
