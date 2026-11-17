#!/bin/sh
# Open a .docx in Microsoft Word (macOS) and print the page count Word computes.
# Usage: scripts/word_pages.sh /absolute/path/file.docx
# A repair prompt or any other dialog makes this hang or fail: that is the point
# (a "Word valid" file opens with no prompt).
exec osascript - "$1" <<'OSA'
on run argv
  set f to POSIX file (item 1 of argv)
  tell application "Microsoft Word"
    open f
    delay 1
    set d to active document
    repaginate d
    set n to compute statistics d statistic statistic pages
    set nm to name of d
    close d saving no
    return (nm & tab & n)
  end tell
end run
OSA
