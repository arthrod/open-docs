/** @jsxImportSource https://esm.sh/react@18.2.0 */
/**
 * The Plate editor surface, assembled from Plate's own plugin packages:
 *
 *   @platejs/basic-nodes   H1–H6, blockquote, hr, bold/italic/underline/strike,
 *                          inline code, highlight, sub/superscript
 *   @platejs/basic-styles  font family/size/colour, background colour, align,
 *                          line height
 *   @platejs/list          indent lists (bullets / numbers, nesting)
 *   @platejs/link          links
 *   @platejs/code-block    code blocks
 *   @platejs/table         tables (rows, cells, header cells)
 *   @platejs/media         pictures (imported at Word's width and alignment)
 *   @platejs/markdown      markdown ⇄ nodes (remark + GFM) — the assistant path
 *
 * Plate's polished UI kit is shadcn source copied into apps, not an npm
 * package, so the toolbar here is plain buttons over Plate's transforms.
 * React resolves through the page import map (18.2.0) — see deps.ts.
 */
import React, { useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  BASIC_NODES,
  BASIC_STYLES,
  BASIC_STYLES_CORE,
  CODE_BLOCK,
  CODE_BLOCK_CORE,
  LINK,
  LINK_CORE,
  LIST,
  MARKDOWN,
  MEDIA,
  PLATE_REACT,
  REMARK_GFM,
  TABLE,
} from "./deps.ts";

const [P, B, S, SCore, CB, CBCore, Lk, LkCore, L, Md, gfm, T, M] = await Promise.all([
  import(PLATE_REACT),
  import(BASIC_NODES),
  import(BASIC_STYLES),
  import(BASIC_STYLES_CORE),
  import(CODE_BLOCK),
  import(CODE_BLOCK_CORE),
  import(LINK),
  import(LINK_CORE),
  import(LIST),
  import(MARKDOWN),
  import(REMARK_GFM),
  import(TABLE),
  import(MEDIA),
]);
const { Plate, PlateContent, PlateElement, ParagraphPlugin, usePlateEditor } = P;

export interface PlateHandle {
  getValue(): any[];
  setValue(value: any[]): void;
  /** Plate's own markdown deserializer (@platejs/markdown). */
  fromMarkdown(md: string): any[];
  /** Plate's own markdown serializer. */
  toMarkdown(): string;
  editor: any;
}

/**
 * Paragraphs double as list items, Plate's "indent list" model:
 * `{type:"p", listStyleType:"disc"|"decimal", indent:n}`. ListPlugin itself
 * wraps them in `<ol start>/<ul><li>` (numbering from its `listStart`), so
 * this component only adds the indent.
 */
function Paragraph(props: any) {
  const t = props.element.listStyleType;
  return (
    <PlateElement
      {...props}
      as={t ? "div" : "p"}
      // PlateElement owns `style`; style list items through classes instead.
      className={t ? `pl-li pl-li-${t} pl-indent-${Math.min(props.element.indent ?? 1, 4)}` : undefined}
    >
      {props.children}
    </PlateElement>
  );
}

/** Links render as real anchors; clicking edits text, ⌘/Ctrl-click opens. */
function Link(props: any) {
  return (
    <PlateElement {...props} as="a" attributes={{ ...props.attributes, href: props.element.url, title: props.element.url }}>
      {props.children}
    </PlateElement>
  );
}

/**
 * A picture: a block void. The <img> sits in a non-editable box at the width
 * Word shows it (never wider than the page), aligned like its paragraph.
 */
function Image(props: any) {
  const { url, width, align, alt } = props.element;
  return (
    <PlateElement {...props} as="figure" className={`pl-img${align ? ` pl-img-${align}` : ""}`}>
      <div contentEditable={false}>
        <img src={url} alt={alt ?? ""} width={width} draggable={false} />
      </div>
      {props.children}
    </PlateElement>
  );
}

/** Tables render as real <table>/<tr>/<td> (Plate's default element is a div). */
function Table(props: any) {
  return (
    <PlateElement {...props} as="table" className="pl-table">
      <tbody>{props.children}</tbody>
    </PlateElement>
  );
}
const Row = (props: any) => <PlateElement {...props} as="tr">{props.children}</PlateElement>;
// A merged cell keeps Plate's own `colSpan` on the node.
const spanned = (props: any) => ({ ...props.attributes, colSpan: props.element.colSpan, rowSpan: props.element.rowSpan });
const Cell = (props: any) => <PlateElement {...props} as="td" attributes={spanned(props)}>{props.children}</PlateElement>;
const HeaderCell = (props: any) => <PlateElement {...props} as="th" attributes={spanned(props)}>{props.children}</PlateElement>;

const STYLE_TARGETS = { inject: { targetPlugins: ["p", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote"] } };

const PLUGINS = [
  ParagraphPlugin.withComponent(Paragraph),
  L.ListPlugin?.configure({ render: { belowNodes: undefined } }),
  B.H1Plugin,
  B.H2Plugin,
  B.H3Plugin,
  B.H4Plugin,
  B.H5Plugin,
  B.H6Plugin,
  B.BlockquotePlugin,
  B.HorizontalRulePlugin,
  B.BoldPlugin,
  B.ItalicPlugin,
  B.UnderlinePlugin,
  B.StrikethroughPlugin,
  B.CodePlugin,
  B.HighlightPlugin,
  B.SubscriptPlugin,
  B.SuperscriptPlugin,
  S.FontColorPlugin,
  S.FontBackgroundColorPlugin,
  S.FontSizePlugin,
  S.FontFamilyPlugin,
  S.TextAlignPlugin?.configure(STYLE_TARGETS),
  S.LineHeightPlugin?.configure(STYLE_TARGETS),
  Lk.LinkPlugin.withComponent(Link),
  CB.CodeBlockPlugin,
  CB.CodeLinePlugin,
  M.ImagePlugin?.withComponent(Image),
  T.TablePlugin.withComponent(Table),
  T.TableRowPlugin.withComponent(Row),
  T.TableCellPlugin.withComponent(Cell),
  T.TableCellHeaderPlugin.withComponent(HeaderCell),
  // Plate's documented setup: GFM plus its own remarkMdx, which is how Plate
  // writes the marks markdown has no syntax for (underline, sub/superscript,
  // colours, highlight) — as <u>, <sub>, <mark>… Without it, serializing such
  // a document throws "Cannot handle unknown node mdxJsxTextElement".
  Md.MarkdownPlugin.configure({ options: { remarkPlugins: [gfm.default ?? gfm, Md.remarkMdx] } }),
].filter(Boolean);

type Btn = { label: string; title: string; cls?: string; run: (e: any) => void };

const block = (type: string) => (e: any) => e.tf.toggleBlock(type);
const mark = (key: string) => (e: any) => e.tf.toggleMark(key);
const list = (style: string) => (e: any) => {
  const [entry] = e.api.blocks({ mode: "lowest" });
  const on = entry?.[0]?.listStyleType === style;
  if (on) e.tf.unsetNodes(["listStyleType", "indent"]);
  else e.tf.setNodes({ type: "p", listStyleType: style, indent: 1 });
};
const indent = (d: number) => (e: any) => {
  const [entry] = e.api.blocks({ mode: "lowest" });
  const n = entry?.[0];
  if (!n?.listStyleType) return;
  e.tf.setNodes({ indent: Math.min(Math.max((n.indent ?? 1) + d, 1), 4) });
};
const align = (v: string) => (e: any) => SCore.setAlign(e, v);

const BUTTONS: Array<Btn | "|"> = [
  { label: "↶", title: "Undo (⌘Z)", run: (e) => e.undo() },
  { label: "↷", title: "Redo (⇧⌘Z)", run: (e) => e.redo() },
  "|",
  { label: "B", title: "Bold (⌘B)", cls: "pl-B", run: mark("bold") },
  { label: "I", title: "Italic (⌘I)", cls: "pl-I", run: mark("italic") },
  { label: "U", title: "Underline (⌘U)", cls: "pl-U", run: mark("underline") },
  { label: "S", title: "Strikethrough", cls: "pl-S", run: mark("strikethrough") },
  { label: "</>", title: "Inline code", run: mark("code") },
  { label: "x²", title: "Superscript", run: mark("superscript") },
  { label: "x₂", title: "Subscript", run: mark("subscript") },
  { label: "▮", title: "Highlight", run: mark("highlight") },
  "|",
  { label: "• List", title: "Bulleted list", run: list("disc") },
  { label: "1. List", title: "Numbered list", run: list("decimal") },
  { label: "⇤", title: "Outdent list item", run: indent(-1) },
  { label: "⇥", title: "Indent list item", run: indent(1) },
  { label: "❝", title: "Quote", run: block("blockquote") },
  { label: "{ }", title: "Code block", run: (e) => CBCore.toggleCodeBlock(e) },
  { label: "―", title: "Horizontal line", run: (e) => e.tf.insertNodes({ type: "hr", children: [{ text: "" }] }) },
  "|",
  { label: "⯇", title: "Align left", run: align("left") },
  { label: "≡", title: "Center", run: align("center") },
  { label: "⯈", title: "Align right", run: align("right") },
  { label: "☰", title: "Justify", run: align("justify") },
];

const BLOCKS: Array<[string, string]> = [
  ["p", "Normal text"],
  ["h1", "Heading 1"],
  ["h2", "Heading 2"],
  ["h3", "Heading 3"],
  ["h4", "Heading 4"],
  ["h5", "Heading 5"],
  ["h6", "Heading 6"],
];
const FONTS = ["Calibri", "Arial", "Georgia", "Times New Roman", "Courier New"];
const SIZES = ["10pt", "11pt", "12pt", "14pt", "16pt", "18pt", "24pt", "32pt"];
const LINE_HEIGHTS = ["1", "1.15", "1.5", "2", "3"];

function Select({ label, options, onPick }: { label: string; options: Array<[string, string]>; onPick: (v: string) => void }) {
  return (
    <select
      className="pl-select"
      aria-label={label}
      value=""
      onChange={(ev) => {
        if (ev.target.value) onPick(ev.target.value);
      }}
    >
      <option value="">{label}</option>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

function Toolbar({ editor }: { editor: any }) {
  const url = useRef<HTMLInputElement>(null);
  const link = () => {
    const v = url.current?.value.trim();
    if (!v) return url.current?.focus();
    editor.tf.focus();
    LkCore.upsertLink(editor, { url: v, skipValidation: true });
    url.current!.value = "";
  };
  return (
    <div className="pl-toolbar" role="toolbar" aria-label="Formatting">
      <Select
        label="Style…"
        options={BLOCKS}
        onPick={(v) => {
          editor.tf.focus();
          v === "p" ? editor.tf.setNodes({ type: "p" }) : editor.tf.toggleBlock(v);
        }}
      />
      <Select label="Font…" options={FONTS.map((f) => [f, f])} onPick={(v) => editor.tf.addMarks({ fontFamily: v })} />
      <Select label="Size" options={SIZES.map((s) => [s, s.replace("pt", "")])} onPick={(v) => editor.tf.addMarks({ fontSize: v })} />
      <label className="pl-swatch" title="Text colour" onMouseDown={(e) => e.stopPropagation()}>
        A<input type="color" defaultValue="#c00000" aria-label="Text colour" onChange={(ev) => editor.tf.addMarks({ color: ev.target.value })} />
      </label>
      <label className="pl-swatch" title="Background colour" onMouseDown={(e) => e.stopPropagation()}>
        ▮<input
          type="color"
          defaultValue="#ffff00"
          aria-label="Background colour"
          onChange={(ev) => editor.tf.addMarks({ backgroundColor: ev.target.value })}
        />
      </label>
      <Select label="Spacing" options={LINE_HEIGHTS.map((h) => [h, h])} onPick={(v) => SCore.setLineHeight(editor, Number(v))} />
      <span className="pl-sep" />
      {BUTTONS.map((b, i) =>
        b === "|" ? <span key={i} className="pl-sep" /> : (
          <button
            key={i}
            type="button"
            title={b.title}
            aria-label={b.title}
            className={`pl-btn ${b.cls ?? ""}`}
            // mousedown + preventDefault keeps the editor selection.
            onMouseDown={(ev) => {
              ev.preventDefault();
              b.run(editor);
            }}
          >
            {b.label}
          </button>
        )
      )}
      <span className="pl-sep" />
      <input
        ref={url}
        className="pl-url"
        type="text"
        placeholder="https://… then 🔗"
        aria-label="Link URL"
        onKeyDown={(ev) => {
          if (ev.key === "Enter") {
            ev.preventDefault();
            link();
          }
        }}
      />
      <button type="button" className="pl-btn" title="Link the selection" aria-label="Link the selection" onMouseDown={(ev) => {
        ev.preventDefault();
        link();
      }}>
        🔗
      </button>
    </div>
  );
}

function Editor({ initialValue, onReady, readOnly }: { initialValue: any[]; onReady: (h: PlateHandle) => void; readOnly?: boolean }) {
  const editor = usePlateEditor({ plugins: PLUGINS, value: initialValue });
  const readyRef = useRef(false);
  if (!readyRef.current) {
    readyRef.current = true;
    queueMicrotask(() =>
      onReady({
        getValue: () => editor.children,
        // One transform → one undo step.
        setValue: (value) => editor.tf.replaceNodes(value, { at: [], children: true }),
        // MDX is strict ("{" opens an expression, a stray "<" a tag): when the
        // model's markdown isn't valid MDX, read it as plain GFM instead.
        fromMarkdown: (md) => {
          try {
            return editor.api.markdown.deserialize(md);
          } catch {
            return editor.api.markdown.deserialize(md, { withoutMdx: true });
          }
        },
        toMarkdown: () => editor.api.markdown.serialize(),
        editor,
      })
    );
  }
  return (
    <Plate editor={editor}>
      {readOnly ? null : <Toolbar editor={editor} />}
      <div className="pl-scroll">
        <div
          className="pl-page"
          // Clicks on the paper outside the text (margins, below the last
          // line) put the caret at the end, like a word processor.
          onMouseDown={(ev) => {
            if (readOnly) return;
            if ((ev.target as HTMLElement).closest(".pl-content")) return;
            ev.preventDefault();
            editor.tf.focus({ edge: "end" });
          }}
        >
          <PlateContent className="pl-content" placeholder="Start typing…" readOnly={readOnly} />
        </div>
      </div>
    </Plate>
  );
}

export function mountPlate(container: HTMLElement, initialValue: any[], onReady: (h: PlateHandle) => void, readOnly = false) {
  createRoot(container).render(<Editor initialValue={initialValue} onReady={onReady} readOnly={readOnly} />);
}
