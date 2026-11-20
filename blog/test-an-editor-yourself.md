You do not need our scripts to find out whether a browser editor is good enough for your work. You need three files, Google Chrome and fifteen minutes. This post walks through the test by hand, and then shows the script that does the same thing for you.

## Step 1: get the three files

Download our samples. They are free to use:

- [The rich sample](https://editors.benchmarks.law/api/showcase.docx): 3 pages, with styles, lists, a table, a chart, a header and a footer.
- [The redline sample](https://editors.benchmarks.law/api/redline.docx): the same document with 23 tracked changes and 6 comments from two reviewers.
- [The 500-page sample](https://editors.benchmarks.law/api/lorem-500.docx): 50 chapters of plain text.

Better still, add one of your own: a real contract with real tracked changes. Your documents are the ones that matter.

Open each file in Microsoft Word first. Note the page count, and look at the redline. That is what "correct" looks like.

## Step 2: start clean

Open a new Incognito window in Chrome (`Ctrl+Shift+N`, or `Cmd+Shift+N` on a Mac). An Incognito window starts with an empty cache, like a first-time visitor.

Open the developer tools (`F12`, or `Cmd+Option+I`) and click the **Network** tab. Now load the editor you want to test.

When the page stops loading, read the bottom line of the Network tab. It says something like "7.1 MB transferred". **That is the download size.** Write it down.

## Step 3: open each file and look

Open the rich sample in the editor. Put it beside Word and compare:

- Are the headings, fonts and spacing the same?
- Is the table intact, with its merged cell?
- Is the chart there?
- Are the header and the footer there?
- Does it show three pages?

Now the redline sample:

- Can you see the insertions and deletions, in colour, with who made them?
- Are the six comments there, including the reply?
- Can you accept one change and reject another?

A redline that opens as clean text is the most dangerous result on this list, because nothing tells you that something is missing.

## Step 4: time the long file

Click the **Performance** tab in the developer tools. Press the record button, open the 500-page sample, wait until the editor has clearly finished, and stop the recording.

Look at the "Main" row. Blocks marked with a red corner are **long tasks**: moments where the page could not answer you. The time from your click to the last of those blocks is what we call **Settled**.

No patience for the Performance tab? Use the simple version:

1. Start a stopwatch when you open the file.
2. Scroll to the very end. Is the last page there?
3. Click into the text and type a word. Does it appear at once?
4. Stop the watch when all three are true.

Also note the page count the editor shows. Word says 500.

## Step 5: read the memory

With the 500-page file still open, click the **Memory** tab. Click the bin icon ("Collect garbage") first, so you do not count memory the browser was about to free. Then read the size shown for the page.

A few hundred megabytes is normal for a document this size. More than a gigabyte will be a problem on a phone or a busy laptop.

## Step 6: export and reopen in Word

Change one word, export the file from the editor, and open the result in Microsoft Word.

- Does Word open it without offering to repair it?
- Are the tracked changes still tracked?
- Is your edit there?

An editor that reads well and writes badly will damage your documents one save at a time.

## Step 7: do it three times

Close the Incognito window, open a new one and repeat. Do it three times and keep the middle value. One run tells you very little: the network, the machine and the browser all vary from one minute to the next.

And **close your other tabs and programs first**. A busy machine makes every editor look slow. We learned that one the hard way: [see the next post](/blog/what-went-wrong).

## Let the script do it

Everything above is what our script does, without the human. You need [Google Chrome](https://www.google.com/chrome/) and [uv](https://docs.astral.sh/uv/).

```sh
git clone https://github.com/arthrod/open-docs
cd open-docs
uv run --with playwright python -I scripts/measure_samples.py all showcase,redline,lorem-500 3 \
  --out .scratch/samples/today.json --latest .scratch/samples/latest.json --shots .scratch/shots
```

The three arguments are: which editors (`all`, or a list such as `superdoc,plate`), which samples, and how many runs. The script starts a fresh Chrome for every run, clicks the same menu button a visitor would, and writes every reading to the file you named, with a screenshot of each result.

The figures you get are your machine's. They will not match ours, and they should not: compare the editors with each other, on one machine.

## A short checklist to keep

| Question | How to check |
| --- | --- |
| Does it look like Word? | The rich sample beside Word |
| Does it keep tracked changes and comments? | The redline sample |
| Does it break pages like Word? | The page count of the 500-page sample |
| Can I work in a long document? | Time until you can scroll to the end and type |
| Is it light enough for a phone? | Megabytes transferred, memory after opening |
| Does it write files Word accepts? | Export, reopen in Word |
| Does it do this every time? | Three runs, fresh window each |
