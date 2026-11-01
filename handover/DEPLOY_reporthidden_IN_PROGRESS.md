# DEPLOY — Report a problem: the My Collection count check (job B) — IN PROGRESS, NOT READY (full test gate still running; do not ship)

Branch: `build/report-hidden`, built ON TOP of `build/varlink` (job A) — both change `browse.js`, so B
starts where A ends and the two never collide.
Patch for the shipping chat: `git diff origin/build/varlink...origin/build/report-hidden`
(or `git diff origin/main...origin/build/report-hidden` once job A is live).
**No version numbers were changed** — the shipping chat numbers it.

## What it does, in plain words

When a collector presses **Report a problem**, the report now carries a new section,
**MY COLLECTION COUNT CHECK**, that says which owned items the list *counts* (the header number) but
does *not draw*, and why:

```
MY COLLECTION COUNT CHECK
  Counted: 54   Drawn now: 48   (filters on: Era pick (Postwar))
  Not drawn (6):
    2613    var B   saved as Lionel Pre-War · Lionel   catalog row: 6QEMFSBQZM   → hidden by: the Era pick (Postwar)
    2343C   var 1   saved as Postwar · Lionel   catalog row: …   in a group   → shown inside 2343-P's group row
    …                                                                         → UNEXPLAINED ← a real bug
```

- The answer comes from the list itself (the same count request the filter-picker numbers use) — there
  is no second copy of the list rules. For each item not drawn it clears **one filter at a time** and
  asks again; the first one that brings the item back is the reason. Nothing is changed: every filter
  is put back.
- An item shown inside a set row or a group's lead row is listed as "shown inside …" (counted by design).
- Anything still missing with every filter cleared is named by a known rule, or **UNEXPLAINED** — that
  is the line that means a real bug (it is what Lars's six would have said).
- **Nothing new on the screen.** In the report's "See exactly what will be sent", the lines appear under
  the last steps with the same tick boxes — untick a line and it is left out of what is sent.
- **Privacy:** per item only the number, variation, saved era + maker, catalog Row ID, whether it is
  grouped, and the reason. Never a price, value, note, location, photo/Drive link or email. A typed
  search is described only by its length ("4 characters typed"). Nothing is written to any sheet.
- If the catalog isn't loaded yet, the section says so in one line — the report is never held up.

## Files changed (on top of job A)

| File | Change |
|---|---|
| `app/browse.js` | the `drawn` count level now tells "has its own row" from "shown inside a set / group row"; NEW `rrCollectionCountCheck()` + `_rrCcClears()` (the filters it can clear); `rrCollectionDrawn(opts)` takes a chips override; one line restored word-for-word to keep `filter_bar_tests` pin (the seat lookup moved just inside it) |
| `app/error-report.js` | takes the check once when the form opens; prints the section; tick boxes in the preview |
| `tests/report_hidden_items_tests.js` | NEW suite (real Chromium, real app) |

## Tests

GATE_RESULTS_PLACEHOLDER

New suite `report_hidden_items_tests.js` — 29 checks: one copy of every kind (drawn, inside a group,
inside a set, hidden by Type / Era pick / My maker / search / the catalog in view, a box piece never
listed), Counted − Drawn = the number listed in every scenario, nothing UNEXPLAINED; PLANTED a new
`return false` in the row test → that copy comes out UNEXPLAINED; a scan proves every `return false` in
the owned row test is a filter the check clears or a named rule (planted offenders turn it red);
privacy (planted notes, prices, Drive links, emails and search words never appear); the check puts
every filter back; the real road at iPhone size — Lars's shape on the browse.js he had: "Counted: 54
Drawn now: 48", 6 tick boxes, unticking one leaves it out; on today's browse.js "Every counted item is
drawn."

## For Brad to try by hand (after it ships)

1. On your phone, open **My Collection**, pick an Era chip (e.g. Postwar).
2. Press **Report a problem** → open **See exactly what will be sent**. Under your last steps there is
   **My Collection count check** with one line per item the list is hiding, each with a tick box.
3. Untick one line, send the report to yourself: that line should be missing from the email, and the
   section should say "1 left out by the sender".
4. Clear the Era chip and open the report again: it should say "Every counted item is drawn."
