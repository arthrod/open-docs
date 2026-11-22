We publish numbers about other people's software. In November 2026 we went back over our own tables and looked hard at every figure that stood far from its neighbours. Several of them were wrong. This is the list, with how we found each one and what we changed.

We are writing it down for two reasons. You should know how much to trust us. And these are mistakes any benchmark can make, so they are worth checking in every one you read.

## 1. We counted the pages before the editor had finished

Our table said OnlyOffice showed **409 pages** for a 500-page file. That looked like a layout bug in the editor.

It was not. OnlyOffice says "ready" early and keeps laying out pages in the background. We read the count once, right after "ready", and caught it halfway. Watching by hand, the counter went 52, 103, 154, and on up to 500. Our three runs had read 409, 358 and 409: the same file, three different answers.

**The fix:** the script now reads the page count again and again until it has not changed for five seconds.

**The lesson:** if the same test gives three different answers, you are measuring the timing of your own reading.

## 2. We timed a function call, not a document

One editor "loaded" every file in about **190 milliseconds**, even 500 pages. Nothing else was close.

Our code asked the editor to open the file and stopped the clock when that request returned. This editor's request returns at once and does the work afterwards. We had been timing how long it takes to say "yes, I will".

**The fix:** the clock now stops when the editor reports that it has finished and pages are on screen.

**The lesson:** a number that is ten times better than everyone else's is usually a bug in the test.

## 3. We counted garbage as memory

On our viewers site, one editor held **1,256 MB** of memory on the long file. On the editors site, the same editor on the same file held about 700 MB.

A browser does not free memory the moment it is no longer needed. It collects garbage when it has time. One site read the memory a little sooner than the other, and so counted several hundred megabytes that were about to be thrown away.

**The fix:** both sites now ask the browser to collect its garbage first, then read.

**The lesson:** when two tests of the same thing disagree, one of them is wrong. Find out which before you publish either.

## 4. Our "five runs" were sometimes one run, five times

For page-load scores we use Google's public PageSpeed test, and we ask it five times per page. It turned out that when you ask again within about a minute, it can hand back the previous answer instead of testing again. Of 50 results in one batch, **18 were copies**.

Five identical results look like a very stable page. They were one measurement.

**The fix:** every result carries the time it was taken. The script now compares those times and throws away any repeat.

**The lesson:** check that your repeats are really repeats.

## 5. The machine was busy with other people's work

We test on a rented cloud machine, so that anyone can rent the same one and check us. It is a slice of a bigger computer that other people use too.

One day that computer was overloaded: twenty times busier than on our earlier runs. Pages took two to five times as long, and one test ran out of time after 9 of its 51 runs. Nothing in the editors had changed.

**The fix:** the editor sample script now checks how busy the host is before every run. It waits if the host is busy and gives up if it stays busy. Every run also records the load it was taken under, so a slow day is visible in the data.

**The lesson:** a benchmark measures the editor plus the machine plus everything else on the machine. Write down the conditions, or you cannot tell them apart later.

## 6. No graphics card changes the picture

Our test machine has no graphics card, so the browser draws everything with the processor. For most editors that makes little difference. For editors that paint the page onto a canvas, it makes a lot.

One such editor loaded in half a second, and then kept the page busy for **18 seconds or more** while the processor painted. On a laptop with a graphics card, the same editor settled in three or four seconds. The memory figures move the same way: without a graphics card, every canvas sits in ordinary memory and is counted.

We have not changed machines, because a machine anyone can rent matters more to us than flattering numbers. But the seconds in our tables are that machine's seconds.

**The lesson:** read a benchmark for the order between products, and treat the absolute numbers as belonging to the test machine.

## What to ask of any benchmark

- **Can I run it myself?** If the files and scripts are not public, it is an advertisement.
- **Were the outliers checked by a person?** The best and the worst figure in a table are the two most likely to be wrong.
- **How many runs, and were they independent?**
- **On what machine, and how busy was it?**
- **What can the test not see?** Every method has a blind spot. A benchmark that lists none has not looked.

Ours has blind spots too, and [the post on what the numbers mean](/blog/what-the-numbers-mean) says where they are. If you find a figure on this site that looks wrong, tell us. Being checked is the point.
