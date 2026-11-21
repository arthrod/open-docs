We ran the whole test again on 20 November 2026, with the mistakes from [the last post](/blog/what-went-wrong) fixed. Thirteen editors and four viewers, three files, three runs each. Here is what the new tables say, and how to use them to pick an editor.

We do not name a winner. The right editor depends on what your documents look like. What we can do is show you which questions the tables answer.

## Question 1: can it open a long document at all?

Our long file is 500 pages. This is where editors differ most.

- **Ready in under ten seconds:** OpenDoc, docx-editor.dev, Docxodus, Apryse, BetterOffice, react-docx.
- **Ten to twenty seconds:** OnlyOffice, SuperDoc, folio, canvas-editor.
- **Longer:** Nutrient (21 seconds), Univer (29 seconds), Plate (65 seconds).
- **Did not open it:** docen. In all three runs the page stopped answering.

On the two short files, most editors are ready in under two seconds. So if your documents are ten pages, speed will not decide anything for you. If they are five hundred, it may decide everything.

> Test with a file the size of your largest real document. A demo file tells you nothing about a long one.

## Question 2: are the pages where Word puts them?

Word counts 500 pages in the long file. Five editors also showed exactly 500: **folio, react-docx, BetterOffice, OnlyOffice and OpenDoc**.

canvas-editor showed 661. It lays the text out its own way, so a reference to "page 212" would point somewhere else.

Several editors show no pages at all, only one long scroll. That is a design choice. It is fine for drafting and a problem if your work cites page numbers.

One note on OnlyOffice: our old table said 409 pages. That was our mistake, not the editor's. We had read the count too early. The new run reads 500.

## Question 3: how much memory does it take?

For most editors the long file costs under 140 MB of working memory. That is light.

Two stand out. canvas-editor holds about 680 MB and Univer about 880 MB on the same file. A laptop copes. A phone, or a browser with thirty tabs open, may not.

Our old figures for these two were about twice as high. Half of that was garbage the browser had not cleared yet. We now clear it before we read.

## Question 4: does it work every time?

The last column of each table says how many of the three runs loaded. Most rows say "3 of 3".

Seven rows say "2 of 3". In several of those the failure was a network one: our site refused a request, or a download did not arrive. One failure in three runs is not proof of a flaky editor. It is a reason to run your own test before you decide.

## What the tables cannot tell you

Speed and memory are the easy part to measure. They are not the whole decision.

- **Tracked changes.** If you negotiate contracts, this matters more than any timing. The redline table has a column that says what each editor does with insertions and deletions. Read it first.
- **What survives a round trip.** Open, edit, export, open again in Word. Our timing tables do not measure this. It is step six of [the fifteen-minute test](/blog/test-an-editor-yourself), and it is the step we would not skip.
- **Our machine is not your machine.** It has no graphics card and it was busy while we measured. One editor, WordCraft, draws everything on a canvas and was still drawing after three minutes here. On a Mac with a graphics card it finished in three or four seconds. The tables mark rows like that.
- **Univer is a special case.** It has no reader for Word files, so we hand it plain text. Its row is not comparable with the others.

## A short way to choose

1. Write down your hardest real document: the longest one, or the one with the most tracked changes.
2. In the tables, cross out every editor that fails on that kind of file.
3. Of the ones left, [test two or three yourself](/blog/test-an-editor-yourself) with your own file. It takes fifteen minutes.
4. Trust what you saw over what we measured.

Every run behind this post is public, with the script that made it. If a number here looks wrong to you, [you know by now](/blog/what-went-wrong) that we would rather hear it.
