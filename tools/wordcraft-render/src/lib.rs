//! WordCraft, server-side: .docx bytes in, one PNG per printed page out.
//!
//! The same pipeline `wordcraft-cli convert x.docx x.png` runs (file.exportPng):
//! wordcraft-docx reads the package, wordcraft-layout lays it out in Print view, and
//! wordcraft-render rasterises each page with vello_cpu, headers and footers at full strength.
//! No DOM, no GPU, no filesystem: it runs in Deno (Val Town) as plain wasm.
use wasm_bindgen::prelude::*;

/// Every page of `docx` as PNG bytes, rendered at `scale` (1.0 = 96 dpi CSS pixels).
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
