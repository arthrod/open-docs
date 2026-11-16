//! WordCraft, server-side: .docx bytes in, printed pages out as PNGs.
//!
//! Two ways in: `render_docx` rasterises every page in one call; `Doc` reads and lays out
//! once, reports the page sizes, and rasterises one page at a time, so a server can send
//! a page of 500 pages without rasterising 500 pages first.
//!
//! The same pipeline `wordcraft-cli convert x.docx x.png` runs (file.exportPng):
//! wordcraft-docx reads the package, wordcraft-layout lays it out in Print view, and
//! wordcraft-render rasterises each page with vello_cpu, headers and footers at full strength.
//! No DOM, no GPU, no filesystem: it runs in Deno (Val Town) as plain wasm.
use wasm_bindgen::prelude::*;

/// Every page of `docx` as PNG bytes, rendered at `scale` pixels per point.
#[wasm_bindgen]
pub fn render_docx(docx: &[u8], scale: f32) -> Result<js_sys::Array, JsError> {
    let doc = wordcraft_docx::read_with_password(docx, None).map_err(|e| JsError::new(&format!("{e}")))?;
    let opts = wordcraft_layout::LayoutOptions { view: wordcraft_layout::ViewMode::Print, ..Default::default() };
    let laid = wordcraft_layout::layout(&doc, &mut wordcraft_layout::LayoutCache::new(), &opts);
    let mut render = wordcraft_render::RenderOptions::default();
    render.display.dim_header = false;
    let out = js_sys::Array::new();
    for page in &laid.pages {
        let img = wordcraft_render::render_page(&doc, page, scale.clamp(0.1, 8.0), &render);
        out.push(&js_sys::Uint8Array::from(img.to_png().as_slice()));
    }
    Ok(out)
}

/// A document read and laid out once; its pages are rasterised one at a time.
#[wasm_bindgen]
pub struct Doc {
    doc: wordcraft_doc::Document,
    laid: wordcraft_layout::DocLayout,
}

#[wasm_bindgen]
impl Doc {
    /// Read `docx` and lay it out in Print view. Nothing is rasterised yet.
    #[wasm_bindgen(constructor)]
    pub fn new(docx: &[u8]) -> Result<Doc, JsError> {
        let doc = wordcraft_docx::read_with_password(docx, None).map_err(|e| JsError::new(&format!("{e}")))?;
        let opts = wordcraft_layout::LayoutOptions { view: wordcraft_layout::ViewMode::Print, ..Default::default() };
        let laid = wordcraft_layout::layout(&doc, &mut wordcraft_layout::LayoutCache::new(), &opts);
        Ok(Doc { doc, laid })
    }

    /// Every page's size in points: width, height, width, height, …
    pub fn page_sizes(&self) -> Vec<f32> {
        self.laid.pages.iter().flat_map(|p| [p.w, p.h]).collect()
    }

    /// Page `index` (from 0) as PNG bytes at `scale` pixels per point.
    pub fn render_page(&self, index: u32, scale: f32) -> Result<Vec<u8>, JsError> {
        let page = self.laid.pages.get(index as usize).ok_or_else(|| JsError::new("no such page"))?;
        let mut render = wordcraft_render::RenderOptions::default();
        render.display.dim_header = false;
        Ok(small_png(&wordcraft_render::render_page(&self.doc, page, scale.clamp(0.1, 8.0), &render)))
    }
}

/// PNG bytes, compressed harder than `Rendered::to_png` (which favours speed): a page is
/// sent over the network once and rasterised once, so the bytes matter more than the time.
/// A fully opaque page (the usual case) drops its alpha channel.
fn small_png(img: &wordcraft_render::Rendered) -> Vec<u8> {
    use image::codecs::png::{CompressionType, FilterType, PngEncoder};
    use image::{ExtendedColorType, ImageEncoder};
    let rgba = img.to_straight();
    let opaque = rgba.chunks_exact(4).all(|p| p[3] == 255);
    let (pixels, color) = if opaque {
        (rgba.chunks_exact(4).flat_map(|p| [p[0], p[1], p[2]]).collect(), ExtendedColorType::Rgb8)
    } else {
        (rgba, ExtendedColorType::Rgba8)
    };
    let mut buf = Vec::new();
    let enc = PngEncoder::new_with_quality(&mut buf, CompressionType::Best, FilterType::Adaptive);
    match enc.write_image(&pixels, img.width, img.height, color) {
        Ok(()) => buf,
        Err(_) => img.to_png(),
    }
}
