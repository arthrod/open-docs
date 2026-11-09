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
export const LIST = `https://esm.sh/@platejs/list@53.3.13/react${Q}`;
/** Plate's own markdown ⇄ nodes (remark under the hood). */
export const MARKDOWN = `https://esm.sh/@platejs/markdown@53.5.3${Q}`;
export const REMARK_GFM = "https://esm.sh/remark-gfm@4.0.1?target=es2022";
export const MAMMOTH = "https://esm.sh/mammoth@1.13.0?target=es2022";
