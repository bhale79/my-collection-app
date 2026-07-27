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
