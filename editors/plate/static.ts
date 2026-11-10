/**
 * Plate's static rendering (platejs/static) with element components, for
 * Plate's own .docx export: @platejs/docx-io renders the value to HTML through
 * these plugins (its `editorPlugins` option) and writes that HTML as Word.
 * Without components, Base plugins render <div>s and tables, links and
 * pictures are lost — so each element renders as its HTML equivalent here.
 */
import React from "react";
import {
  BASIC_NODES_CORE,
  BASIC_STYLES_CORE,
  CODE_BLOCK_CORE,
  LINK_CORE,
  LIST_CORE,
  MEDIA_CORE,
  PLATE_CORE,
  PLATE_STATIC,
  TABLE_CORE,
} from "./deps.ts";

const [P, S, B, St, L, Lk, CB, T, M] = await Promise.all([
  import(PLATE_CORE),
  import(PLATE_STATIC),
  import(BASIC_NODES_CORE),
  import(BASIC_STYLES_CORE),
  import(LIST_CORE),
  import(LINK_CORE),
  import(CODE_BLOCK_CORE),
  import(TABLE_CORE),
  import(MEDIA_CORE),
]);
const h = React.createElement;
const El = S.SlateElement;

const as = (tag: string) => (p: any) => h(El, { ...p, as: tag }, p.children);
const Paragraph = (p: any) => h(El, { ...p, as: p.element.listStyleType ? "div" : "p" }, p.children);
const Link = (p: any) => h(El, { ...p, as: "a", attributes: { ...p.attributes, href: p.element.url } }, p.children);
const Table = (p: any) => h(El, { ...p, as: "table" }, h("tbody", null, p.children));
const spanned = (p: any) => ({ ...p.attributes, colSpan: p.element.colSpan, rowSpan: p.element.rowSpan });
const Cell = (p: any) => h(El, { ...p, as: "td", attributes: spanned(p) }, p.children);
const HeaderCell = (p: any) => h(El, { ...p, as: "th", attributes: spanned(p) }, p.children);
const Image = (p: any) =>
  h(El, { ...p, as: "figure" }, h("img", { src: p.element.url, alt: p.element.alt ?? "", width: p.element.width }), p.children);

/** Plate's static list wrapper (its BlockListStatic): an indent-list item becomes <ul>/<ol start><li>. */
const BULLETS = new Set(["disc", "circle", "square"]);
const BlockListStatic = (props: any) => {
  if (!props.element.listStyleType) return;
  return (p: any) => {
    const { listStyleType, listStart } = p.element;
    const ordered = !BULLETS.has(listStyleType);
    return h(ordered ? "ol" : "ul", { style: { listStyleType }, start: ordered ? listStart : undefined }, h("li", null, p.children));
  };
};

const STYLE_TARGETS = { inject: { targetPlugins: ["p", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote"] } };

export const STATIC_PLUGINS: any[] = [
  P.BaseParagraphPlugin.withComponent(Paragraph),
  L.BaseListPlugin.configure({ render: { belowNodes: BlockListStatic } }),
  B.BaseH1Plugin.withComponent(as("h1")),
  B.BaseH2Plugin.withComponent(as("h2")),
  B.BaseH3Plugin.withComponent(as("h3")),
  B.BaseH4Plugin.withComponent(as("h4")),
  B.BaseH5Plugin.withComponent(as("h5")),
  B.BaseH6Plugin.withComponent(as("h6")),
  B.BaseBlockquotePlugin.withComponent(as("blockquote")),
  B.BaseHorizontalRulePlugin.withComponent(as("hr")),
  B.BaseBoldPlugin,
  B.BaseItalicPlugin,
  B.BaseUnderlinePlugin,
  B.BaseStrikethroughPlugin,
  B.BaseCodePlugin,
  B.BaseHighlightPlugin,
  B.BaseSubscriptPlugin,
  B.BaseSuperscriptPlugin,
  St.BaseFontColorPlugin,
  St.BaseFontBackgroundColorPlugin,
  St.BaseFontSizePlugin,
  St.BaseFontFamilyPlugin,
  St.BaseTextAlignPlugin?.configure(STYLE_TARGETS),
  St.BaseLineHeightPlugin?.configure(STYLE_TARGETS),
  Lk.BaseLinkPlugin.withComponent(Link),
  CB.BaseCodeBlockPlugin.withComponent(as("pre")),
  CB.BaseCodeLinePlugin.withComponent(as("div")),
  T.BaseTablePlugin.withComponent(Table),
  T.BaseTableRowPlugin.withComponent(as("tr")),
  T.BaseTableCellPlugin.withComponent(Cell),
  T.BaseTableCellHeaderPlugin.withComponent(HeaderCell),
  M.BaseImagePlugin.withComponent(Image),
].filter(Boolean);

export const { createSlateEditor } = P;
