"""Build the rich showcase .docx every editor can load (Menu → Load rich sample).

Run:  uv run --with python-docx --with matplotlib scripts/make_showcase.py
Writes server/showcase.docx.ts (base64) and /tmp/open-docs-showcase.docx.

The document exercises what a reader should see an editor render: title and
heading styles, every common run format, nested bullets and numbers, a table
with a shaded header and a merged cell, a quote, a code block, a hyperlink, an
embedded chart, alignments, a page break, and a header/footer with page numbers.
"""
import base64, io, pathlib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from docx import Document
from docx.enum.section import WD_ORIENT  # noqa: F401
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_COLOR_INDEX
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor, Inches, Cm

ROOT = pathlib.Path(__file__).resolve().parent.parent
doc = Document()

styles = doc.styles
styles["Normal"].font.name = "Calibri"
styles["Normal"].font.size = Pt(11)

def shade(cell_or_par_pr, fill):
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear"); shd.set(qn("w:color"), "auto"); shd.set(qn("w:fill"), fill)
    cell_or_par_pr.append(shd)

def hyperlink(par, url, text):
    rid = par.part.relate_to(url, "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink", is_external=True)
    h = OxmlElement("w:hyperlink"); h.set(qn("r:id"), rid)
    r = OxmlElement("w:r"); rpr = OxmlElement("w:rPr")
    st = OxmlElement("w:rStyle"); st.set(qn("w:val"), "Hyperlink"); rpr.append(st)
    c = OxmlElement("w:color"); c.set(qn("w:val"), "0563C1"); rpr.append(c)
    u = OxmlElement("w:u"); u.set(qn("w:val"), "single"); rpr.append(u)
    r.append(rpr); t = OxmlElement("w:t"); t.text = text; r.append(t); h.append(r)
    par._p.append(h)

def field(run, instr):
    for kind, text in (("begin", None), (None, instr), ("separate", None), (None, "1"), ("end", None)):
        if kind:
            f = OxmlElement("w:fldChar"); f.set(qn("w:fldCharType"), kind); run._r.append(f)
        elif text == instr:
            it = OxmlElement("w:instrText"); it.set(qn("xml:space"), "preserve"); it.text = f" {instr} "; run._r.append(it)
        else:
            t = OxmlElement("w:t"); t.text = text; run._r.append(t)

# Header / footer
sec = doc.sections[0]
sec.page_width, sec.page_height = Inches(8.5), Inches(11)
for side in ("left_margin", "right_margin"): setattr(sec, side, Inches(1))
hp = sec.header.paragraphs[0]; hp.text = "Northwind Energy · Field report"; hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
hp.runs[0].font.size = Pt(9); hp.runs[0].font.color.rgb = RGBColor(0x5D, 0x66, 0x76)
fp = sec.footer.paragraphs[0]; fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = fp.add_run("Page "); r.font.size = Pt(9)
r = fp.add_run(); r.font.size = Pt(9); field(r, "PAGE")
r = fp.add_run(" of "); r.font.size = Pt(9)
r = fp.add_run(); r.font.size = Pt(9); field(r, "NUMPAGES")

doc.add_paragraph("Coastal Wind Farm — Spring Field Report", style="Title")
doc.add_paragraph("A showcase document for the open-docs bench · Prepared by the Operations team", style="Subtitle")

p = doc.add_paragraph()
p.add_run("This report exercises what a word processor has to get right: ")
p.add_run("bold").bold = True; p.add_run(", ")
p.add_run("italic").italic = True; p.add_run(", ")
p.add_run("underline").underline = True; p.add_run(", ")
p.add_run("strikethrough").font.strike = True; p.add_run(", ")
r = p.add_run("coloured text"); r.font.color.rgb = RGBColor(0xC0, 0x00, 0x00); p.add_run(", ")
r = p.add_run("highlighting"); r.font.highlight_color = WD_COLOR_INDEX.YELLOW; p.add_run(", ")
p.add_run("H"); r = p.add_run("2"); r.font.subscript = True; p.add_run("O and E = mc"); r = p.add_run("2"); r.font.superscript = True; p.add_run(", ")
r = p.add_run("small caps"); r.font.small_caps = True; p.add_run(", ")
r = p.add_run("Georgia serif"); r.font.name = "Georgia"; p.add_run(", ")
r = p.add_run("inline code"); r.font.name = "Courier New"; p.add_run(", and ")
r = p.add_run("a larger size"); r.font.size = Pt(15); p.add_run(". The full data set lives at ")
hyperlink(p, "https://open-docs.val.run/", "open-docs.val.run"); p.add_run(".")

doc.add_heading("1. Summary", level=1)
p = doc.add_paragraph("Output across the twelve turbines rose ", style="Normal")
p.add_run("14.2 %").bold = True
p.add_run(" against the same period last year, driven by the blade retrofit on the northern string and fewer unplanned stops. "
          "This paragraph is justified, with a first-line indent, so long lines show how an editor spreads text across the measure.")
p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY; p.paragraph_format.first_line_indent = Cm(1)

def multilevel(kind):
    """A real Word multilevel list: one abstractNum with three levels, one num.
    Nested items share the numId and differ by ilvl, as Word writes them."""
    numbering = doc.part.numbering_part.element
    ids = [int(x.get(qn("w:abstractNumId"))) for x in numbering.findall(qn("w:abstractNum"))]
    aid = max(ids + [0]) + 1
    an = OxmlElement("w:abstractNum"); an.set(qn("w:abstractNumId"), str(aid))
    mlt = OxmlElement("w:multiLevelType"); mlt.set(qn("w:val"), "hybridMultilevel"); an.append(mlt)
    fmts = [("bullet", "\u2022", "Symbol"), ("bullet", "o", "Courier New"), ("bullet", "\u25aa", "Wingdings")] if kind == "bullet" \
        else [("decimal", "%1.", None), ("lowerLetter", "%2.", None), ("lowerRoman", "%3.", None)]
    for i, (fmt, text, font) in enumerate(fmts):
        lvl = OxmlElement("w:lvl"); lvl.set(qn("w:ilvl"), str(i))
        for tag, val in (("w:start", "1"), ("w:numFmt", fmt), ("w:lvlText", text), ("w:lvlJc", "left")):
            e = OxmlElement(tag); e.set(qn("w:val"), val); lvl.append(e)
        ppr = OxmlElement("w:pPr"); ind = OxmlElement("w:ind")
        ind.set(qn("w:left"), str(720 * (i + 1))); ind.set(qn("w:hanging"), "360"); ppr.append(ind); lvl.append(ppr)
        if font:
            rpr = OxmlElement("w:rPr"); rf = OxmlElement("w:rFonts")
            for k in ("ascii", "hAnsi", "hint"): rf.set(qn(f"w:{k}"), font if k != "hint" else "default")
            rpr.append(rf); lvl.append(rpr)
        an.append(lvl)
    first_num = numbering.find(qn("w:num"))
    if first_num is not None: first_num.addprevious(an)
    else: numbering.append(an)
    nid = max([int(x.get(qn("w:numId"))) for x in numbering.findall(qn("w:num"))] + [0]) + 1
    num = OxmlElement("w:num"); num.set(qn("w:numId"), str(nid))
    ref = OxmlElement("w:abstractNumId"); ref.set(qn("w:val"), str(aid)); num.append(ref); numbering.append(num)
    return nid

def list_item(text, num_id, level):
    par = doc.add_paragraph(text, style="List Paragraph")
    ppr = par._p.get_or_add_pPr(); numpr = OxmlElement("w:numPr")
    il = OxmlElement("w:ilvl"); il.set(qn("w:val"), str(level)); numpr.append(il)
    ni = OxmlElement("w:numId"); ni.set(qn("w:val"), str(num_id)); numpr.append(ni)
    ppr.append(numpr)
    par.paragraph_format.space_after = Pt(2)

doc.add_heading("1.1 Highlights", level=2)
BULLETS, NUMBERS = multilevel("bullet"), multilevel("number")
for text, lvl in [("Blade retrofit finished on turbines T1–T6", 0), ("Leading-edge erosion repaired on all six", 1),
                  ("Vortex generators fitted to T3 and T4", 1), ("T4 gained the most: +19 %", 2),
                  ("Unplanned downtime fell from 61 to 22 hours", 0), ("Two new technicians certified for tower climbs", 0)]:
    list_item(text, BULLETS, lvl)

doc.add_heading("1.2 Next steps", level=2)
for text, lvl in [("Order replacement bearings for T9", 0), ("Get two quotes", 1), ("Approve before 30 June", 1),
                  ("Schedule the autumn inspection", 0), ("Publish this report to the community board", 0)]:
    list_item(text, NUMBERS, lvl)

doc.add_heading("2. Output by turbine string", level=1)
rows = [("String", "Turbines", "Output (MWh)", "Change"), ("North", "T1–T6", "4,812", "+18.9 %"),
        ("South", "T7–T12", "3,977", "+8.6 %"), ("Total", "", "8,789", "+14.2 %")]
t = doc.add_table(rows=len(rows), cols=4); t.style = "Table Grid"; t.alignment = WD_TABLE_ALIGNMENT.CENTER
for i, row in enumerate(rows):
    for j, val in enumerate(row):
        cell = t.cell(i, j); cell.text = val
        par = cell.paragraphs[0]
        if j >= 2: par.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        if i == 0:
            par.runs[0].bold = True; par.runs[0].font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
            shade(cell._tc.get_or_add_tcPr(), "1F3A8A")
        elif i == len(rows) - 1:
            par.runs and setattr(par.runs[0], "bold", True); shade(cell._tc.get_or_add_tcPr(), "E8EEFC")
merged = t.cell(3, 0).merge(t.cell(3, 1)); merged.paragraphs[0].runs[0].bold = True
for extra in merged.paragraphs[1:]: extra._p.getparent().remove(extra._p)
doc.add_paragraph("Table 1 — Output by string, March to May.", style="Caption")

# Chart image
fig, ax = plt.subplots(figsize=(6, 2.6), dpi=110)
months = ["Mar", "Apr", "May"]; north = [1490, 1602, 1720]; south = [1260, 1318, 1399]
x = range(len(months))
ax.bar([i - 0.2 for i in x], north, width=0.4, color="#2557d6", label="North")
ax.bar([i + 0.2 for i in x], south, width=0.4, color="#93c5fd", label="South")
ax.set_xticks(list(x)); ax.set_xticklabels(months); ax.set_ylabel("MWh"); ax.legend(frameon=False)
for s in ("top", "right"): ax.spines[s].set_visible(False)
fig.tight_layout(); buf = io.BytesIO(); fig.savefig(buf, format="png"); buf.seek(0)
doc.add_picture(buf, width=Inches(5.5)); doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
doc.add_paragraph("Figure 1 — Monthly output per string.", style="Caption").alignment = WD_ALIGN_PARAGRAPH.CENTER

doc.add_heading("3. What the crew said", level=1)
doc.add_paragraph("“The retrofit paid for itself before the first service interval. We should have done the south string at the same time.”",
                  style="Intense Quote")
p = doc.add_paragraph("— Site lead, after the May inspection"); p.alignment = WD_ALIGN_PARAGRAPH.RIGHT; p.runs[0].italic = True

doc.add_heading("3.1 Alarm rule used for the trial", level=3)
for line in ["if wind_speed > 25 and pitch_angle < 80:", "    raise_alarm(\"overspeed\", turbine)", "else:", "    log(\"ok\", turbine)"]:
    p = doc.add_paragraph(); r = p.add_run(line); r.font.name = "Courier New"; r.font.size = Pt(10)
    p.paragraph_format.space_after = Pt(0); shade(p._p.get_or_add_pPr(), "F2F3F5")

p = doc.add_paragraph("This line is centred."); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p = doc.add_paragraph("This line is right-aligned."); p.alignment = WD_ALIGN_PARAGRAPH.RIGHT

doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)
doc.add_heading("Appendix A — Glossary", level=1)
for term, defn in [("Capacity factor", "actual output divided by the output at full rated power over the same time."),
                   ("Pitch angle", "the angle of a blade relative to the plane of rotation."),
                   ("SCADA", "the supervisory control and data acquisition system that logs every turbine.")]:
    p = doc.add_paragraph(); p.add_run(term + ": ").bold = True; p.add_run(defn)

# Word 2013+ layout rules, so Word doesn't open it in Compatibility Mode.
compat = doc.settings.element.find(qn("w:compat"))
if compat is None:
    compat = OxmlElement("w:compat"); doc.settings.element.append(compat)
for old in compat.findall(qn("w:compatSetting")): compat.remove(old)
cs = OxmlElement("w:compatSetting")
for k, v in (("name", "compatibilityMode"), ("uri", "http://schemas.microsoft.com/office/word"), ("val", "15")): cs.set(qn(f"w:{k}"), v)
compat.append(cs)

doc.core_properties.title = "Coastal Wind Farm — Spring Field Report"
doc.core_properties.author = "open-docs"
out = io.BytesIO(); doc.save(out); data = out.getvalue()
pathlib.Path("/tmp/open-docs-showcase.docx").write_bytes(data)
b64 = base64.b64encode(data).decode()
lines = "\n".join(f'  "{b64[i:i+100]}",' for i in range(0, len(b64), 100))
(ROOT / "server" / "showcase.docx.ts").write_text(
    "/**\n * The rich showcase document (Menu → Load rich sample). Generated by\n"
    " * scripts/make_showcase.py — edit the script, not this file.\n */\n"
    "export const showcaseTitle = \"Coastal Wind Farm — Spring Field Report\";\n\n"
    f"const B64 = [\n{lines}\n].join(\"\");\n\n"
    "/** The showcase .docx bytes. */\n"
    "export function showcaseDocx(): Uint8Array {\n"
    "  return Uint8Array.from(atob(B64), (c) => c.charCodeAt(0));\n}\n")
print(len(data), "bytes")
