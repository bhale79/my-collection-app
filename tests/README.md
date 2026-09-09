# Headless tests for the Photo Inbox

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
