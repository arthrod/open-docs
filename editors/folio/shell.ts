/** Server-side shell for the folio demo. */

/**
 * folio-vue.css paints every surface from `--doc-*` custom properties but ships
 * no values for them — the host app is expected to provide a theme. Without
 * these, menus and popovers render with a transparent background over the
 * page (the "menu z-index" bug: the menu was on top, it was just invisible).
 */
const THEME = `
#folio-root {
  --doc-bg: #ffffff; --doc-bg-subtle: #f7f8fa; --doc-bg-hover: #eef1f6;
  --doc-surface: #ffffff; --doc-card: #ffffff; --doc-page: #ffffff;
  /* In folio, "canvas" is the PAGE (paper) colour, not the backdrop. */
  --doc-canvas: #ffffff; --doc-canvas-surface: #ffffff; --doc-canvas-text: #111111;
  --doc-text: #161b26; --doc-text-muted: #5d6676; --doc-text-subtle: #8b93a3;
  --doc-border: #e3e6ec; --doc-border-light: #eef0f4; --doc-border-dark: #c9ced8; --doc-border-input: #d4d8e0;
  --doc-primary: #2557d6; --doc-primary-hover: #1d47b5; --doc-primary-light: #e8eefc; --doc-on-primary: #ffffff;
  --doc-accent: #2557d6; --doc-accent-bg: #e8eefc; --doc-link: #2557d6; --doc-focus-ring: rgba(37, 87, 214, .35);
  --doc-error: #b42318; --doc-error-bg: #fef3f2; --doc-success: #0f7a4f; --doc-success-bg: #ecfdf3;
  --doc-overlay: rgba(15, 23, 42, .35);
  --doc-shadow: rgba(16, 24, 40, .14); --doc-shadow-subtle: rgba(16, 24, 40, .06);
  --doc-shadow-sm: 0 1px 2px rgba(16,24,40,.06); --doc-shadow-md: 0 4px 12px rgba(16,24,40,.10);
  --doc-shadow-lg: 0 12px 32px rgba(16,24,40,.16); --doc-shadow-strong: rgba(16, 24, 40, .24);
  --doc-card-shadow: 0 1px 3px rgba(16,24,40,.10); --doc-card-shadow-strong: 0 8px 24px rgba(16,24,40,.16);
  --doc-tmpl-loop: #7c3aed; --doc-tmpl-cond: #0e7490;
  --background: #ffffff; --foreground: #161b26; --muted: #f3f5f8; --muted-foreground: #5d6676;
  --border: #e3e6ec; --popover: #ffffff; --popover-foreground: #161b26;
  --primary: #2557d6; --primary-foreground: #ffffff; --destructive: #b42318; --ring: rgba(37, 87, 214, .35);
}
#folio-root .docx-editor-vue__pages-viewport, #folio-root .paged-editor { background: #eef1f5; }
#folio-root .layout-page { box-shadow: 0 1px 3px rgba(16,24,40,.12), 0 8px 24px rgba(16,24,40,.06) !important; }
/* Popovers are teleported to <body>; give them the same theme there. */
body > .docx-popover__panel, body > [class*="docx-"] { color: #161b26; }
:root {
  --doc-surface: #ffffff; --doc-border: #e3e6ec; --doc-shadow: rgba(16, 24, 40, .14); --doc-text: #161b26;
  --doc-text-muted: #5d6676; --doc-bg-hover: #eef1f6; --doc-primary: #2557d6; --doc-primary-light: #e8eefc;
  --doc-on-primary: #ffffff; --doc-border-dark: #c9ced8; --doc-border-light: #eef0f4; --doc-text-subtle: #8b93a3;
  --doc-bg: #ffffff; --doc-bg-subtle: #f7f8fa; --doc-shadow-subtle: rgba(16, 24, 40, .06); --doc-overlay: rgba(15, 23, 42, .35);
}`;

export default {
  slug: "folio",
  title: "folio",
  entry: "/editors/folio/main.ts",
  head:
    `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@stll/folio-vue@0.28.0/dist/folio-vue.css" />
    <!-- folio-vue.css does @import "@stll/folio-fonts/fonts.css" — a bare
         specifier the browser resolves to a 404. Load the real file directly. -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@stll/folio-fonts@0.1.0/fonts.css" />
    <style>${THEME}</style>`,
  body: `<div id="folio-root" style="height:100%;min-height:0;overflow:hidden;display:flex;flex-direction:column;background:#eef1f5"></div>`,
};
