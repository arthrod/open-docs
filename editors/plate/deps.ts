/**
 * One place for Plate's CDN URLs.
 *
 * Every URL marks React external (resolved by the page import map to 18.2.0)
 * and pins `platejs` so the editor and every plugin share ONE copy of Plate's
 * core (two copies → plugins register on an editor they can't see).
 */
const Q = "?external=react,react-dom&target=es2022&deps=platejs@53.5.2";
export const PLATE_REACT = `https://esm.sh/platejs@53.5.2/react${Q}`;
export const BASIC_NODES = `https://esm.sh/@platejs/basic-nodes@53.0.0/react${Q}`;
export const BASIC_STYLES = `https://esm.sh/@platejs/basic-styles@53.0.0/react${Q}`;
export const BASIC_STYLES_CORE = `https://esm.sh/@platejs/basic-styles@53.0.0${Q}`;
export const LINK = `https://esm.sh/@platejs/link@53.3.5/react${Q}`;
export const LINK_CORE = `https://esm.sh/@platejs/link@53.3.5${Q}`;
export const CODE_BLOCK = `https://esm.sh/@platejs/code-block@53.0.0/react${Q}`;
export const CODE_BLOCK_CORE = `https://esm.sh/@platejs/code-block@53.0.0${Q}`;
export const TABLE = `https://esm.sh/@platejs/table@53.0.9/react${Q}`;
export const LIST = `https://esm.sh/@platejs/list@53.3.13/react${Q}`;
/** Plate core and its static renderer (no React DOM): .docx export renders through these. */
export const PLATE_CORE = `https://esm.sh/platejs@53.5.2${Q}`;
export const PLATE_STATIC = `https://esm.sh/platejs@53.5.2/static${Q}`;
export const BASIC_NODES_CORE = `https://esm.sh/@platejs/basic-nodes@53.0.0${Q}`;
export const LIST_CORE = `https://esm.sh/@platejs/list@53.3.13${Q}`;
export const TABLE_CORE = `https://esm.sh/@platejs/table@53.0.9${Q}`;
export const MEDIA_CORE = `https://esm.sh/@platejs/media@53.1.4${Q}`;
/** Pictures (ImagePlugin). */
export const MEDIA = `https://esm.sh/@platejs/media@53.1.4/react${Q}`;
/** Reads word/document.xml for picture sizes (mammoth drops them). */
export const FFLATE = "https://esm.sh/fflate@0.8.2?target=es2022";
/** Plate's own markdown ⇄ nodes (remark under the hood). */
export const MARKDOWN = `https://esm.sh/@platejs/markdown@53.5.3${Q}`;
export const REMARK_GFM = "https://esm.sh/remark-gfm@4.0.1?target=es2022";
export const MAMMOTH = "https://esm.sh/mammoth@1.13.0?target=es2022";
