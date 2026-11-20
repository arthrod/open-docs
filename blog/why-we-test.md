Most legal work ends up in a Word file. A contract, a brief, a set of comments from the other side: all `.docx`. More and more products now open those files in a browser tab instead of in Word, with an editor someone else wrote. Each of those editors says it is fast and faithful. None of them says how that was measured.

So we measure. This site opens the same Word files in thirteen browser editors and four proprietary viewers, on the same machine, with the same script, and publishes every run.

## What can go wrong when a browser opens a Word file

A Word file is not a picture of a page. It is a set of instructions: this style, this font, this numbering, this change made by this person on this day. Every editor has to read those instructions and decide what to draw. They do not all decide the same thing.

Here is what that looks like in practice:

- **Tracked changes disappear or get accepted.** You open a redline, and the deleted clause is simply gone, or the inserted one looks like it was always there. Nobody told you.
- **Pages move.** A file that is 500 pages in Word is 661 pages in the browser. Every "see page 212" now points at the wrong page.
- **The long file freezes the tab.** A three-page letter opens in a blink. The 500-page agreement takes twenty seconds, or the page stops answering.
- **The file comes back changed.** You edit one word and export. The file you get back has lost the names and dates on its tracked changes, or some of its formatting.
- **The page is heavy.** Some editors download 2 MB before they show anything. Some download more than 20 MB. On a phone, that is the difference between working and not.

None of these shows up in a product demo, because the demo uses a file the editor is good at.

## What we do about it

We picked three files and we use them for everyone:

| File | What it is | What it tests |
| --- | --- | --- |
| The rich sample | 3 pages with styles, lists, a table with a merged cell, a chart, a header and a footer | Does it look like Word? |
| The redline sample | The same document after two people reviewed it: 23 tracked changes, 6 comments | Does it keep the review? |
| The 500-page sample | 50 chapters, about 224,000 words | Does it survive a long file? |

All three open in Microsoft Word with no warning, and Word counts 3, 3 and 500 pages. That is our reference: when an editor shows another count, the editor is breaking pages differently. It is not reading another file.

Then a script opens each file in each editor, in a real copy of Google Chrome, three times, and writes down how long it took, how much memory it used and how many pages it showed.

## Three rules we hold ourselves to

**The same test for everyone.** Same files, same kind of machine, same browser, same script. Every run starts in a fresh browser that has never seen the page, so no editor gets a head start.

There are two exceptions, and both are marked on the site. Two editors cannot read tracked changes at all, so we rewrite the redline for them as underlined and struck-through text: otherwise the changed words would simply vanish. And one editor has no Word reader of its own, so it is given the text of each file, not the file.

**Everything is public.** The files, the scripts and every single run are published. You do not have to believe our tables: you can run the test yourself, and [this post shows how](/blog/test-an-editor-yourself).

**We say what we cannot see.** Some numbers are easy to take and hard to trust. When a figure looks too good, or stands far from the others, we look at it again by hand. We have been wrong more than once, and [we wrote that down too](/blog/what-went-wrong).

## Who this is for

If you choose software for a law firm or a legal team, the tables tell you which editors keep a redline intact and which ones struggle with a long agreement.

If you build a product on one of these editors, the tables tell you what your users will wait for, and the adapters in the repository show how each editor is wired up.

If you build one of these editors, the tests are a free regression suite. Tell us when a number is unfair. We would rather fix the test than publish a wrong figure.

We are not affiliated with any editor or viewer on this site, and nobody pays to be here.

Next: [what each number in the tables means](/blog/what-the-numbers-mean).
