The tables on this site have a handful of columns. Each one answers a simple question. Each one also has a blind spot, and you read the tables better when you know both.

## Loaded: "when did the editor say it was done?"

We click the button that opens the file and start a clock. **Loaded** is when the editor reports that the document is open.

The catch: that is the editor's own word. Some editors say "done" when the first page is on screen and keep working on the other 499. So Loaded is honest for a short file and optimistic for a long one.

## Settled: "when did it actually stop working?"

A browser tab does its work on one main thread. While that thread is busy, the page cannot react to your typing or scrolling.

**Settled** is the click until that thread has been quiet for two full seconds, and until the page count has stopped changing. It is the closest thing we have to "now you can use it".

> On a short file, look at Loaded. On the 500-page file, look at Settled.

Its blind spot: we only see work in chunks of 50 milliseconds or more, and only on the main thread. An editor that works in very small slices, on a second thread in the background (a "worker") or on the graphics card can look settled while it is still drawing. That is why the page count is part of the test: pages that keep arriving give it away.

## Pages shown: "does it break pages where Word does?"

Word counts 500 pages in our long file. An editor that shows 500 has Word's page count. That is a good sign and not a proof: the count does not say that every break falls where Word puts it. An editor that shows 661 is laying the text out differently, and every page reference in that document is now off.

The file is built so that small font differences do not change the count: each chapter starts on a new page and fills nine and a half pages. To land on another total, an editor has to be off by a lot.

One editor keeps only the pages near the one you are looking at, so its number is a count of what is on screen. The notes under the table say so.

Some editors do not show pages at all. They show one long scroll, like a web page. The table says "n/a" for those. That is a design choice, not a failure, but it matters if your work cites pages.

## JS heap: "how much memory does its code hold?"

The **JS heap** is the memory the editor's JavaScript is holding on to. We ask the browser to throw away its garbage first, then we read it. What is left is what the editor really keeps.

Why it matters: a tab that holds 1.5 GB for one document will be closed by a phone, and will slow a laptop that has twenty other tabs open.

Its blind spot: editors written in languages other than JavaScript (compiled to WebAssembly) keep their memory somewhere else, so they read low here.

## Renderer memory: "how much does the whole tab use?"

This is the memory of the browser processes that draw the page, read from the operating system. It catches what the JS heap misses: WebAssembly, images and canvases.

It also catches Chrome itself. A blank tab already costs several hundred megabytes. So read the **growth** (the figure in brackets), and compare editors with each other. Do not read it as "this editor needs 600 MB".

## Runs that loaded: "did it work every time?"

Every figure is the middle value (the median) of three runs. Each run starts a fresh browser with an empty cache, like a first visit.

"3 of 3" means all three runs opened the file. "2 of 3" means one failed, and the figure beside it stands on two runs. A row like that is weaker, and the column is there so you can see it.

## Download size: "how much does a visitor fetch?"

A warning about names first: in the first table on the home page, the column for this is also called "Loaded". There it is a size in megabytes. In the sample tables, Loaded is a time.

It is how many megabytes of code, fonts and data the browser downloads before the editor works. On office Wi-Fi, 20 MB is a short wait. On a phone connection it can be half a minute before anything appears.

## The PageSpeed scores: "what would Google say?"

These come from Google's public PageSpeed test, which loads the page on Google's machines and gives a score from 0 to 100. It is useful because anyone can repeat it with one click. It is limited because it tests the page loading, not a document opening, and it does not always see an editor that runs inside a frame.

## Three things to remember

1. **The seconds belong to our machine.** We test on a rented machine with no graphics card. Your laptop will be faster. What carries over is the order: an editor that is five times slower here will be slower on your machine too.
2. **A missing number is not a zero.** "n/a" means we could not take that reading. The notes with each table say why.
3. **One number never tells the story.** An editor can be the fastest to load and the worst at tracked changes. Look at the row, not the cell.
