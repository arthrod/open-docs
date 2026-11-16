"""Build the 500-page lorem ipsum .docx (Menu → Load the 500-page sample).

Run:  uv run --with python-docx scripts/make_lorem.py [out.docx] [--chapters N] [--words N]
Writes .scratch/fixtures/lorem-500.docx by default.

50 chapters of 10 pages. Every chapter starts on a new page (Heading 1 with
"page break before") and carries enough text to end about half-way down its
tenth page, so an engine whose fonts run a little wider or narrower than
Word's still lands on 500 pages. Text is seeded pseudo-random lorem ipsum:
the same bytes on every run, and not one paragraph repeated 5,000 times
(which would compress to nothing and flatter every parser).

Calibrated in Microsoft Word for Mac (scripts/word_pages.sh): 500 pages.
"""
import pathlib, random, sys
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt, Inches, RGBColor

# These scripts are run with `python -I`, which leaves the script's folder off the import path.
sys.path.insert(0, __file__.rsplit("/", 1)[0])
from measure_lib import lorem_args

ROOT = pathlib.Path(__file__).resolve().parent.parent
ARGS = lorem_args(sys.argv[1:])
OUT = pathlib.Path(ARGS.out) if ARGS.out else ROOT / ".scratch/fixtures/lorem-500.docx"
CHAPTERS = ARGS.chapters
# Words of body text per chapter: tuned so a chapter ends mid-way down its 10th page in Word.
CHAPTER_WORDS = ARGS.words

WORDS = (
    "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore "
    "magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat "
    "duis aute irure in reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat "
    "cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum pellentesque habitant morbi "
    "tristique senectus netus malesuada fames ac turpis egestas vestibulum tortor quam feugiat vitae ultricies eget "
    "ante donec eu libero quam semper aenean mauris placerat eleifend leo quisque erat wisi condimentum ornare sapien "
    "ullamcorper pharetra augue accumsan porttitor facilisis luctus metus cursus faucibus tincidunt praesent dapibus "
    "neque nibh nunc iaculis rutrum pulvinar hendrerit purus lacus viverra sagittis blandit venenatis vulputate"
).split()

rnd = random.Random(500)

def sentence() -> str:
    n = rnd.randint(8, 22)
    ws = [rnd.choice(WORDS) for _ in range(n)]
    if n > 12:
        ws[rnd.randint(4, n - 4)] += ","
    return " ".join(ws).capitalize() + "."

def paragraph() -> str:
    return " ".join(sentence() for _ in range(rnd.randint(4, 7)))

def field(run, instr):
    for kind in ("begin", "instr", "separate", "text", "end"):
        if kind == "instr":
            it = OxmlElement("w:instrText"); it.set(qn("xml:space"), "preserve"); it.text = f" {instr} "; run._r.append(it)
        elif kind == "text":
            t = OxmlElement("w:t"); t.text = "1"; run._r.append(t)
        else:
            f = OxmlElement("w:fldChar"); f.set(qn("w:fldCharType"), kind); run._r.append(f)

doc = Document()
doc.core_properties.title = "Lorem Ipsum — 500 pages"
doc.core_properties.author = "open-docs"
doc.styles["Normal"].font.name = "Calibri"
doc.styles["Normal"].font.size = Pt(11)

sec = doc.sections[0]
sec.page_width, sec.page_height = Inches(8.5), Inches(11)
for side in ("left_margin", "right_margin", "top_margin", "bottom_margin"):
    setattr(sec, side, Inches(1))
hp = sec.header.paragraphs[0]; hp.text = "Lorem Ipsum · 500-page stress sample"; hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
hp.runs[0].font.size = Pt(9); hp.runs[0].font.color.rgb = RGBColor(0x5D, 0x66, 0x76)
fp = sec.footer.paragraphs[0]; fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = fp.add_run("Page "); r.font.size = Pt(9)
r = fp.add_run(); r.font.size = Pt(9); field(r, "PAGE")
r = fp.add_run(" of "); r.font.size = Pt(9)
r = fp.add_run(); r.font.size = Pt(9); field(r, "NUMPAGES")

total = 0
for c in range(1, CHAPTERS + 1):
    h = doc.add_heading(f"Chapter {c}", level=1)
    if c > 1:
        h.paragraph_format.page_break_before = True
    if c == 1:
        p = doc.add_paragraph()
        p.add_run("Lorem ipsum, 500 pages. ").bold = True
        p.add_run(f"{CHAPTERS} chapters of ten pages each, plain paragraphs with a section heading every few "
                  "paragraphs. It is here to show how an engine holds up on a long document: time to open, memory, and scrolling.")
    words, i = 0, 0
    while words < CHAPTER_WORDS:
        if i % 9 == 4:
            doc.add_heading(f"{c}.{i // 9 + 1} " + " ".join(rnd.choice(WORDS) for _ in range(3)).capitalize(), level=2)
        text = paragraph()
        # The last paragraph is cut to the chapter's word budget, so every chapter is the same length.
        room = CHAPTER_WORDS - words
        ws = text.split()
        if len(ws) > room:
            text = " ".join(ws[:room]).rstrip(",.") + "."
        words += min(len(ws), room)
        p = doc.add_paragraph(text)
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        total += 1
        i += 1

OUT.parent.mkdir(parents=True, exist_ok=True)
doc.save(OUT)
print(f"{OUT} · {OUT.stat().st_size:,} B · {CHAPTERS} chapters · {total} paragraphs")
