/**
 * Nutrient Web SDK (formerly PSPDFKit) — a commercial SDK that converts DOCX
 * to PDF in the browser (a .NET/WebAssembly office engine, GdPicture) and
 * shows the result in its PDF viewer. Loaded from Nutrient's public CDN with
 * NO license key, which Nutrient documents as trial mode: it works, pages
 * carry a watermark. Shown here view-only, for comparison with the
 * open-source editors. Note: what you see is the PDF Nutrient made from the
 * .docx, not the .docx itself.
 */
import { waitFor } from "/lib/kit.ts";

const BASE = "https://cdn.cloud.pspdfkit.com/pspdfkit-web@1.25.0/";

// Fetched by Nutrient's workers, where Resource Timing can't see them.
// Listed from a recorded load of the showcase (Playwright, 2026-11-09).
const WORKER_FILES = [
  "nutrient-viewer-lib/chunk-1067-c6f41643df684d47.js",
  "nutrient-viewer-lib/chunk-5340-e20117c0c3928c14.js",
  "nutrient-viewer-lib/chunk-core-worker-bfa03d10839d6517.js",
  "nutrient-viewer-lib/chunk-gdpicture-79f3de4d612f531f.js",
  "nutrient-viewer-lib/chunk-gdpicture-worker-6389ee389e06b392.js",
  "nutrient-viewer-lib/chunk-standalone-ce1a9aa44458d04f.js",
  "nutrient-viewer-lib/chunk-standalone-server-3c1cf9922acb3df2.js",
  "nutrient-viewer-lib/chunk-synthetic-text-selection-font-worker-986133c539eae60c.js",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/BouncyCastle.Cryptography.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/DocumentFormat.OpenXml.Framework.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/DocumentFormat.OpenXml.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/dotnet.boot.js",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/dotnet.js",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/dotnet.native.js",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/dotnet.native.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/dotnet.runtime.js",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/GdPicture.NET.14.API.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/GdPicture.NET.14.barcode.2d.writer.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/GdPicture.NET.14.CAD.DWG.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/GdPicture.NET.14.CAD.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/GdPicture.NET.14.Common.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/GdPicture.NET.14.Document.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/GdPicture.NET.14.Imaging.Formats.Conversion.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/GdPicture.NET.14.Imaging.Formats.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/GdPicture.NET.14.Imaging.Rendering.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/GdPicture.NET.14.Imaging.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/GdPicture.NET.14.MSOfficeBinary.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/GdPicture.NET.14.OpenDocument.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/GdPicture.NET.14.OpenXML.Templating.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/GdPicture.NET.14.OpenXML.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/GdPicture.NET.14.PDF.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/GdPicture.NET.14.RTF.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/GdPicture.NET.14.SVG.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/GdPicture.NET.JsonApi.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/GdPicture.NET.PSPDFKit.Wasm.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/icudt_EFIGS.dat",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/initDotnet.js",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/NativeSDK.Exceptions.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/NativeSDK.Settings.Edition.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/NativeSDK.Settings.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/resourceLoader.js",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/resources/_DroidSansFallbackFull.ttf",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/resources/_fontsubst.dat",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/resources/_Identity-H.dat",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/System.Collections.Concurrent.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/System.Collections.Immutable.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/System.Collections.NonGeneric.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/System.Collections.Specialized.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/System.Collections.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/System.ComponentModel.Primitives.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/System.ComponentModel.TypeConverter.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/System.ComponentModel.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/System.Console.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/System.Diagnostics.TraceSource.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/System.IO.Compression.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/System.IO.Packaging.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/System.IO.Pipelines.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/System.Linq.Expressions.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/System.Linq.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/System.Memory.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/System.Net.Http.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/System.Net.Primitives.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/System.Net.Requests.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/System.ObjectModel.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/System.Private.CoreLib.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/System.Private.Uri.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/System.Private.Xml.Linq.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/System.Private.Xml.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/System.Runtime.InteropServices.JavaScript.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/System.Runtime.Serialization.Primitives.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/System.Security.Cryptography.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/System.Text.Encoding.CodePages.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/System.Text.Encodings.Web.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/System.Text.Json.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/System.Text.RegularExpressions.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/System.Threading.Tasks.Parallel.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/System.wasm",
  "nutrient-viewer-lib/gdpicture-ee16ef49/aot/System.Xml.Linq.wasm",
  "nutrient-viewer-lib/npm-assets-deprecated.js",
  "nutrient-viewer-lib/nutrient-viewer-1.25.0.css",
  "nutrient-viewer-lib/nutrient-viewer-7b1521328da9bdba.wasm.js",
  "nutrient-viewer-lib/nutrient-viewer-8a8e54cb1553c542.wasm",
].map((f) => BASE + f);

// deno-lint-ignore no-explicit-any
let NV: any;
// deno-lint-ignore no-explicit-any
let instance: any;
let host: HTMLDivElement;

function script(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`could not load ${src}`));
    document.head.append(s);
  });
}

async function open(bytes: Uint8Array) {
  if (instance) NV.unload(host);
  instance = await NV.load({
    container: host,
    document: bytes.slice().buffer,
    baseUrl: BASE,
    initialViewState: new NV.ViewState({ zoom: NV.ZoomMode.FIT_TO_WIDTH }),
  });
}

async function fetchBytes(path: string): Promise<Uint8Array> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`could not fetch ${path} (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

window.od.register({
  name: "Nutrient Web SDK",
  viewOnly: true,
  extraResources: WORKER_FILES,

  async mount() {
    host = await waitFor<HTMLDivElement>("#nutrient-host");
    window.od.progress("Loading Nutrient Web SDK (trial mode, no key; ~70 MB engine on first visit)…");
    await script(`${BASE}nutrient-viewer.js`);
    // deno-lint-ignore no-explicit-any
    NV = (window as any).NutrientViewer;
    await open(await fetchBytes("/api/showcase.docx"));
  },

  load: (bytes) => open(bytes),
  loadUrl: async (path) => open(await fetchBytes(path)),

  getMarkdown: () => Promise.reject(new Error("Nutrient Web SDK is view-only here")),
  applyMarkdown: () => Promise.reject(new Error("Nutrient Web SDK is view-only here")),
});
