# DEPLOY — Command IDs (TMCC / Legacy, DCS, DCC) — READY for the shipping chat

Branch: `build/command-ids` (made from main `57a00ff`, v0.9.2088). **No version numbers were changed** (APP_VERSION, CACHE_NAME and the `?v=` stamps are untouched — the shipping chat bumps them; the one new script line in index.html carries today's `?v=2088` like its neighbours, so the trio bump catches it).
Patch: `git diff origin/main...origin/build/command-ids`
Plan: PLAN 2026-10-31 "Command IDs", approved by Brad, all decisions made.

## What it does (plain words)
- **Three new columns at the very end of every collection sheet:** DCS ID, TMCC / Legacy ID, DCC Address. Old sheets just grow — the app's header check adds the three headings the first time a sheet opens; no cell moves.
- **Item page:** every Modern item (any scale, any type — engines, cars, cabooses, accessories…) shows ONE small "＋ Add command ID" button under the Description card (under Maintenance on a computer). Tap it → three boxes (TMCC / Legacy, DCS, DCC) with Save / Cancel. When the catalog says what's inside, the boxes say so ("Catalog: Proto-Sound — DCS", "Catalog: Legacy") and put that box first. Saved → the numbers show LARGE ("LEGACY / TMCC 12", "DCS 7"). Tap them to change or clear; clearing all brings the small button back.
- **Pre-war / Postwar items never get the button.** A copy that already holds an ID always shows its card.
- **Add screen:** the same button on the Purchase & Value step (on its own row under Notes), every Modern item. Ignored → nothing changes. The IDs go on the item's own row only — never its box, tender or set mates.
- **Duplicate warning:** saving a number another item you own already has on the same system says "Your 2343 Santa Fe Diesel is also set to TMCC / Legacy 12. Both will answer the remote." — Keep both / Change this one. Never blocks. Different systems never warn. Engines/cars only compare with engines/cars; accessories/controllers only with each other. The card shows a small note while the clash exists.
- **My Collection columns:** none shown by default; "+ Add a column" offers all three with a one-line explanation.
- **Search:** "ID 12", "DCS 12", "TMCC 12", "Legacy 12", "DCC 12" find the copies set to 12. A bare "12" does not.
- **Command ID Report:** a new ready-made report on the Reports page listing ONLY items with a Command ID (item #, type, road name, description, the three IDs, location), sorted by system then number. Its Edit opens the report builder; "Has a Command ID" is now a real filter usable on any report.
- **Import a Spreadsheet:** "TMCC", "TMCC ID", "Legacy ID", "DCS", "DCC Address"… headings map to the new columns ("07" saved as 7).
- **TRR Pro move:** a moved item keeps its IDs.

## Files changed
App:
- `app/command-ids.js` (NEW) — the card, the Add button, the hint, the duplicate check, search and report helpers
- `app/config.js` — the three fields in RR_USER_FIELDS (the one definition), RR_CMDID (every word + the hint rules), column help lines; fields shown by their own card are left out of the plain-box lists
- `app/app.js` — three columns appended at the END of PERSONAL_SCHEMA
- `app/app-collection.js` — the card's slot on the item page (both layouts)
- `app/wizard.js` — the Add button on Purchase & Value; names on the review screen
- `app/wizard-save.js` — the IDs written on the item's own row
- `app/browse.js` — the ID search (a per-copy filter); no Preferences switch for the ID columns
- `app/table-columns.js` — the three columns offered by "+ Add a column" (built from the one field list)
- `app/reports.js`, `app/report-library.js` — "Has a Command ID" filter, number sort, the Command ID Report
- `app/import-core.js`, `app/import-ui.js` — import headings, labels, number cleaning
- `app/prefs.js` — the IDs are not listed as Extra Columns switches
- `app/type-groups.js` — `onTrack` on the rolling-stock type buckets (the duplicate warning's two groups)
- `app/tutorial.js` — the phone tour: a tab in the bottom bar keeps its ring when the page behind runs under the bar (the Reports list grew one row)
- `app/index.html` (one new script line), `app/sw.js` (one offline-cache line) — no version numbers touched

Tests (new): `tests/command_ids_tests.js` (Node, 45 checks incl. 9 planted offenders), `tests/command_ids_page_tests.js` (real Chromium, computer + iPhone, 43 checks), `tests/command_ids_add_report_tests.js` (real Chromium, 22 checks).
Tests (pins updated for the three new end columns / one more script / the import loop's new shape / the vat-car line): `photo-inbox-tests.js`, `row_id_collection_tests.js`, `scan_shelve_2020_tests.js`, `subtype_tracking_tests.js`, `vat_car_tests.js`.

## Test results
GATE_RESULTS_PLACEHOLDER

## Brad to try by hand (after it ships — one TEST_QUEUE line)
1. Open a real Modern engine → tap "＋ Add command ID" → type your TMCC number → Save. The number shows big.
2. In My Collection search type "ID <that number>" → the engine is found.
3. Reports → Command ID Report → Preview: the engine is listed.
(Optional: set the same number on a second engine → you get the "Both will answer the remote" warning.)
