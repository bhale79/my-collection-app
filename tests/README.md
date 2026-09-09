# The test battery

## Run everything (Session 94)

    npm test                          every quick suite — about a minute, 4 abreast
    node tests/run-all.js --browser   the slow real-Chromium gates (guides, photo viewer, sw) —
                                      one at a time, minutes to an hour; run when guides,
                                      the wizard's photo viewer or app/sw.js change
    node tests/run-all.js --all       both
    node tests/run-all.js --only inbox   just the suites whose file name contains "inbox"
    node tests/run-all.js --list      show which tier every file is in

`tests/run-all.js` FINDS the suites by file name — `*_tests.js` and
`*-tests.js` are the quick tier, `guide-*.js` / `photo-viewer.js` /
`sw-nav-cache.js` the browser tier, and the audits (below) are never run by
it. A new test file joins the battery the moment it is saved. A `.js` file in
`tests/` that fits no tier turns the run red until it is given one — a test
that runs nowhere is exactly how `filter_bar_tests.js` sat red for five days
(v0.9.1660 changed the search box on purpose; the old `npm test` chain ran
15 suites of 57 and that was not one of them).

A suite is green when it exits 0; its last line of output is its verdict on
the scoreboard. A verdict that says `N SKIPPED` is shown, not hidden:
`import_core_tests.js` skips its 18 fixture pins when Scott's workbook is
not on the machine. That workbook is Scott's real inventory and is
deliberately NOT in the repo; it lives at
`C:\Users\Brad\Documents\TheRailRoster\TheRailRoster\Scott_Inventory_TEST_FIXTURE.xlsx`.
Run the fixture pins with `node tests/import_core_tests.js <path>` or
`RR_IMPORT_FIXTURE=<path> npm test` (they need `exceljs` — `npm install`).

## Headless tests for the Photo Inbox

371 checks covering the free reader, the paid-read reconciliation, grouping,
tagging, the era filter, the "tag settles it" bridge, and the review card's
read targets. Built across Sessions 180–181 — nearly every check encodes a
real failure Brad photographed, verbatim.

Run with:

    node tests/photo-inbox-tests.js

The harness stubs the browser (DOM, localStorage, Tesseract) and loads
app/photo-inbox.js inside the stub, so it drives the REAL functions.
It reads the app source from /root/repo/app/photo-inbox.js — adjust the
SRC constant at the top if the repo lives elsewhere.

These are not served by the app (nothing references this folder from
index.html or sw.js) — they exist so the next session, or the next person,
does not have to rediscover the failure modes one wall photo at a time.

## The audits (Session 94)

Audits write a report and exit 0. They become red pins only as findings are
fixed — a gate born red is a gate everyone learns to ignore.

    node tests/button-audit.js     every inline handler names a real function
    node tests/phone-audit.js      every page at phone widths (needs playwright)
    node tests/silent-audit.js     no control may do nothing without saying so
                                   (needs acorn — `npm install`)

`silent-audit` hunts the class the review card's › arrow belonged to
(v0.9.1705): a handler that fetches an element, finds nothing because that
element only exists in one layout, and returns without a word. Its first run
is written up in `SILENT_CONTROL_AUDIT_2026-09-09.md` (Brad's folder and the
project). `tests/silent_fixes_tests.js` pins what that run fixed.
