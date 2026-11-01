# DEPLOY — The Add screen's filters really filter — READY for the shipping chat

Branch: `build/add-filters` (rebased onto main `67b54c5`, v0.9.2090). **No version numbers were changed** (APP_VERSION, CACHE_NAME and the `?v=` stamps are untouched — the shipping chat bumps them).
Patch: `git diff origin/main...origin/build/add-filters`
Plan: PLAN 2026-11-01 "The Add screen's filters really filter", approved by Brad 05:41 CT ("yes, and will do the build on the cloud like the other").
Adds NO sheet columns and writes nothing new to any sheet.

## What it does (plain words)
- **The filters really filter.** Manufacturer, Era, Type and Scale on the Add screen now decide everything on that add — the suggestion list, the "Found" line, the "ADDING No. …" banner, Next, step 2 (Condition & Details), the "View on …" link and the save. A number with no catalog row inside the filters matches **nothing**. Lionel · Postwar · 1511 no longer turns into the Pre-War 1511 on step 1 and American Models' 1511 on step 2.
- **One row for the whole add.** The row the list (or the banner) finds is the row step 2 shows and the row the save links (Master Row ID). Step 2 never looks the number up again. No row → step 2 shows the number alone, no catalog card, no "View on" link, and the save writes no borrowed description / key / Row ID.
- **Maker · era tag on every row.** One small tag in small capitals right after the number: `LIONEL · PREWAR`, `LIONEL · POSTWAR`, `LIONEL · MODERN`, `AMERICAN MODELS · S`, `ATLAS · O 3-RAIL`, `A.C. GILBERT · POSTWAR`. Lionel shows its era; other makers show their scale (and rail) — or their era when the row really has a Pre-War / Postwar one. It **replaces** the old "Atlas 3-Rail" chip (never a second chip). The same tag is on the "ADDING No. …" banner and the step 2 card heading. On a computer it sits on the row's one line; on a phone it drops to a small line under the number. (The Add box did not need widening — it fits at 1366 and 1920 wide; the "same box on every step" rule is unchanged.)
- **Nothing fits → three lines** (wording Brad agreed 05:41 CT, all words in config.js `RR_ADD_FILTERS`):
  1. "No 1511 found for Lionel · Postwar in our Master Catalog" (no filters on: "No item found in our Master Catalog")
  2. "Clear filters?" + button — only when a filter is on. When the number IS in the catalog under another maker / era it also says "1511 is in the Master Catalog under other makers or eras". Pressing it clears the filters and **keeps the typed number**, so the full list shows at once.
  3. "Add manually?" + button — switches to "Manual — item not in our catalogs" **carrying the number and the picked maker**.
- **Picking a maker sets its era only when all its catalogs are in one era** (Atlas / MTH / Weaver / American Models … → Modern; A.C. Gilbert → Postwar; Lionel and Marx left alone). Before, every non-Lionel maker forced Modern, which — now that filters are strict — would have hidden every A.C. Gilbert row.
- Applies on Collection and Want adds (same number step). Photo Inbox adds keep their own photo-tag rule (v0.9.1488) and ignore the Add filters; set members and edits of an owned copy also keep their own row.

## Files changed
App:
- `app/wizard.js` — `_wizRowFitsFilters` is THE one test (Manufacturer, Era, Type, Scale, Road; `_wizAddFilters` says what is on); `_wizPickMasterRow` only scores rows that fit; `_wizAddRow` (the add's one row) used by step 2, the photo step, the year/price skips, the tender link and the brand check; the banner uses the one picker and shows the tag; Next uses the one picker, its "Select an item" list is strict, and a no-match clears any stale row; filter changes re-answer the list AND the held row (`_wizFiltersChanged`); `_wizMakerOnlyPeriod`; "Add manually" carries the maker (`_wizSetKind`); Era names from the word list; step 2 card shows the tag
- `app/wizard-suggestions.js` — `_wizResolveAddRow` (THE one row picker: held row → picked type → scorer, all inside the filters, no escapes); `lookupItem` uses it; the list asks `_wizRowFitsFilters` (its own copy of the maker / era / scale / type tests removed) and carries the tapped row; `rrRowTagWords` / `rrRowTagHtml` (the tag); `rrRowRailWord` replaces `rrRailChipLabel`; the three "nothing found" lines (`_wizNothingFoundHtml`)
- `app/wizard-steps.js` — the Purchase & Value and year skips read the add's one row
- `app/wizard-handlers.js` — the engine-grouping row lock only takes an engine that fits the filters
- `app/wizard-save.js` — a no-row add saves with `_noCatalogRow` (and the picked maker)
- `app/app.js` — `buildPersonalRow`: `_noCatalogRow` is treated like a manual row for the catalog look-ups (never written as a column)
- `app/config.js` — `RR_ADD_FILTERS` (every word above, the tag separator, era words)
- `app/app.css` — the tag's phone / computer placement (two lines)
- `.github/site-files.txt` — `handover/` listed private (the same two lines as on `build/command-ids`, so the two merge cleanly)

Tests (new):
- `tests/add_filters_strict_tests.js` — Node, the REAL app code + Brad's 1511 rows: the one test, the picker, the scorer, the tag words from the real config, the maker → era rule, and 6 source scans each proven on a planted offender (no second lookup, no unfiltered catalog read, no escape, no copy of the test in the list, one tag helper / no second chip, words only in config.js / no "AI").
- `tests/add_filters_road_tests.js` — real Chromium, laptop (1366×768) AND iPhone (390×844): Lionel · Postwar · 1511 → the three lines, nothing held, step 2 without card or link, save without Row ID; Lionel · Pre-War → Pre-War rows only, tapped row = banner = step 2 = saved Row ID; American Models → the CSX boxcar on every step and saved; Era All tags; Clear filters keeps 1511; Add manually carries 1511 + Lionel; the Want list; the tag on the number's line (laptop) / under it (iPhone), nothing overlapping, no sideways scroll; 3 planted offenders (the first-row escape, step 2's second lookup, the save without its flag) each turn their check red. ~40 s.
Tests (updated pins for the deliberate change): `tests/lookup_canary.js` (+ 1511 under each maker / era pick, and the canary now loads `_wizAddFilters`), `tests/also_sold_as_tests.js` (the three Add-screen maker copies are now ONE site), `tests/rail_chip_maker_2028_tests.js` (the rail word now rides in the tag; a bare chip put back is still caught), `tests/short_number_search_tests.js` (its stand-in element learns `insertAdjacentHTML`).

## Test results
GATE_RESULTS_PLACEHOLDER

## Command IDs (`build/command-ids`) — NOT on main yet
Checked with `git fetch` before the gate: Command IDs has **not** landed on main. Files both branches change: `app/app.js`, `app/config.js`, `app/wizard-save.js`, `app/wizard.js` — a trial merge of the two branches auto-merges all four. The only conflict a trial merge shows is `app/index.html`, which **this branch does not touch** (Command IDs was cut from main 57a00ff and main has moved to v0.9.2090 since). Suggested order: ship Command IDs first (rebased on main), then rebase this branch on main and re-run its gate.

## Suggested SHIP_QUEUE line
`Add filters really filter (build/add-filters) — strict Add-screen filters, maker · era tag, three "nothing found" lines — core: wizard.js, wizard-suggestions.js, wizard-save.js, app.js → full+browser receipt`

## Brad to try by hand (after it ships)
1. Add → Collection, Manufacturer **Lionel**, Era **Postwar**, type **1511** → no rows; the three lines: "No 1511 found for Lionel · Postwar in our Master Catalog", the "under other makers or eras" note, Clear filters?, Add manually?
2. Press **Clear filters** → the 1511 list appears at once, each row tagged (LIONEL · PREWAR, AMERICAN MODELS · S, …), "1511" still in the box.
3. Set **Lionel / Pre-War**, tap the 1511 engine → the ADDING banner and step 2 both say the 0-4-0 with LIONEL · PREWAR; save → the item page shows the Pre-War 1511.
4. On the phone: the tag sits on its own small line under each number.
5. (Optional) Lionel · Postwar · 1511 → **Add manually** → Manual opens with 1511 and Lionel filled in.

Note: S-Helper rows read "S-HELPER SERVICE · S" (the plan's example said "S-HELPER · S") — the maker word comes from the one maker decider (`rrRowMakerWord`), which also names the brand the save writes, so it was not shortened just for the tag.
