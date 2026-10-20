# The test battery

## Run everything (Session 94)

    npm test                          every quick suite — about a minute, 4 abreast
    node tests/run-all.js --browser   the slow real-Chromium gates (guides, photo viewer, sw) —
                                      one at a time, minutes to an hour; run when guides,
                                      the wizard's photo viewer or app/sw.js change
    node tests/run-all.js --all       both
    node tests/run-all.js --only inbox   just the suites whose file name contains "inbox"
    node tests/run-all.js --list      show which tier every file is in

## Before a release: the fast gate (2026-10-19)

    node tests/run-all.js --fast --with report_builder,custom_columns

Brad: "its still too slow, its really holding me up". Before shipping, run the
quick tier WITHOUT the suites that open a real browser (about a minute), plus
`--with` the browser suites for the screen the release touched and its own new
test. Everything else — the full run and the `--browser` tier — runs EVERY
NIGHT as a scheduled task that alerts Brad on red. A suite counts as "browser"
when its own source loads a whole page (playwright or jsdom); nothing to keep in step.

`tests/run-all.js` FINDS the suites by file name — `*_tests.js` and
`*-tests.js` are the quick tier, `guide-*.js` / `photo-viewer.js` /
`sw-nav-cache.js` the browser tier, and the audits (below) are never run by
it. A new test file joins the battery the moment it is saved. A `.js` file in
`tests/` that fits no tier turns the run red until it is given one — a test
that runs nowhere is exactly how `filter_bar_tests.js` sat red for five days
(v0.9.1660 changed the search box on purpose; the old `npm test` chain ran
15 suites of 57 and that was not one of them).

A suite is green when it exits 0; its last line of output is its verdict on
the scoreboard. A red suite shows its `FAIL` lines beneath its row; a red
suite with no `FAIL` line (an uncaught throw, a timeout kill) shows the five
lines before its verdict instead, stack frames dropped — a crash's verdict
is just `Node.js v22…`, which says nothing on its own (`run_all_tests.js`
proves this against planted suites). A verdict that says `N SKIPPED` is
shown, not hidden:
`import_core_tests.js` skips its 18 fixture pins when Scott's workbook is
not on the machine. That workbook is Scott's real inventory and is
deliberately NOT in the repo; it lives at
`C:\Users\Brad\Documents\TheRailRoster\TheRailRoster\Scott_Inventory_TEST_FIXTURE.xlsx`.
Run the fixture pins with `node tests/import_core_tests.js <path>` or
`RR_IMPORT_FIXTURE=<path> npm test` (they need `exceljs` — `npm install`).

## Headless tests for the Photo Inbox

`node tests/photo-inbox-tests.js` — about 4,000 checks covering the reader,
the paid-read reconciliation, grouping, tagging, the era filter, the "tag
settles it" bridge and the review card. Nearly every check encodes a real
failure Brad photographed. The harness stubs the browser (DOM, localStorage,
Tesseract) and runs the REAL Photo Inbox code inside the stub.

### The Photo Inbox is several files — read it ONLY through tests/lib/pin-source.js (2026-10-20)

Since the split (PLAN_2026-10-20_PHOTO_INBOX_SPLIT.md) the Photo Inbox is
`app/photo-inbox.js` plus its pieces `app/photo-inbox-*.js` (first:
`photo-inbox-reader.js`, the on-device number reader). A test that opened
`app/photo-inbox.js` by name would quietly stop seeing code that moved, so:

- `pinSource()` — the whole Photo Inbox, every piece joined in load order
  (the pieces are read from index.html, never typed into a test)
- `pinRead(name, readFn)` — for a list of app files; `'photo-inbox.js'`
  means the whole Photo Inbox
- `pinMerge(files)` — a file map with the pieces folded into one entry
- `pinHook(src, code, piece)` — a test-only door, put inside the piece that
  defines what it opens
- `pinFulfill(route, url, text)` — a browser test serving its own planted
  copy: the whole text on the first piece, an empty script on the rest

The rules that hold it together, each with planted offenders:
`pin_source_tests.js` (no test opens a Photo Inbox file itself; the pieces
load together; sw.js keeps every piece), `pin_state_tests.js` (the shared
values live on ONE object, PIN), `pin_handover_tests.js` (a function one
piece calls in another is handed over on PINF, and nothing else crosses).

These tests are not served by the app — the site publishes only what
`.github/site-files.txt` marks `publish:`.

## The audits (Session 94)

Audits write a report and exit 0. They become red pins only as findings are
fixed — a gate born red is a gate everyone learns to ignore.

    node tests/button-audit.js     every inline handler names a real function
    node tests/phone-audit.js      every page at phone widths (needs playwright)
    node tests/silent-audit.js     no control may do nothing without saying so
                                   (needs acorn — `npm install`)
    node tests/press-audit.js      Sweep 2: PRESS every control on every page at
                                   four widths and record what happened — about
                                   40 minutes; `--pages x,y --widths 360` for a
                                   subset, `--count` to enumerate only

`silent-audit` hunts the class the review card's › arrow belonged to
(v0.9.1705): a handler that fetches an element, finds nothing because that
element only exists in one layout, and returns without a word. Its first run
is written up in `SILENT_CONTROL_AUDIT_2026-09-09.md` (Brad's folder and the
project). `tests/silent_fixes_tests.js` pins what that run fixed.

`press-audit` is the second half (v0.9.1710): the real app booted headless
with the synthetic collection, every visible control pressed from a fresh
boot of its page, the outcome sorted (NAVIGATED / OPENED / SPOKE / CHANGED /
… / NOTHING); destructive controls are on a deny-list printed at the top of
every run; the page under an open overlay is not pressed. Its first run is
written up in `PRESS_AUDIT_SWEEP2_2026-09-10.md`; `tests/press_fixes_tests.js`
pins what it fixed (the want/upgrade report's retry loop, Sync from Sheet
wiping the collection on a failed read, three sign-in messages) by running
the app headless with Google unreachable. Run it again after any release
that touches navigation, modals or the reports.
