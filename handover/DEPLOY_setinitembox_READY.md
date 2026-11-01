# DEPLOY — A Lionel Postwar set number typed in the item box finds the set — READY for the shipping chat

Branch: `build/set-in-item-box`, made from main `2c8d7f9b` (v0.9.2092 + the Privacy page) — `git fetch` before the final gate: **main had not moved**, so no rebase was needed. **No version numbers were changed** (APP_VERSION, CACHE_NAME and the `?v=` stamps are untouched — the shipping chat bumps them).
Patch: `git diff origin/main...origin/build/set-in-item-box`
Plan: PLAN 2026-11-01 "A Lionel Postwar set number typed in the item box finds the set" — [stated] Brad 16:11 CT "no, he tried to enter a set as an item number" (Lars), 16:12 CT "yes" to the plan, 16:25 CT "yes" to this cloud build.
Adds NO sheet columns and writes nothing new to any sheet.

## What it does (plain words)
- **The item box knows Lionel Postwar set numbers.** Add → Cataloged Item, type `1467W`: the list now shows ONE row for set 1467W (one row per set number, even when the set has several versions). It carries the usual `LIONEL · POSTWAR` tag plus a `SET` tag, and underneath: the set's name · year(s) · piece count (· "2 versions" when there are several). Typing just `1467` already shows it.
- **Tapping it opens the set flow on that set.** Nothing retyped: it switches to "Lionel Postwar Set" with 1467W filled in. A set with several versions shows its own "Set 1467W — Which version?" picker; a set with one version (2500WS) goes straight to the set's details screen with its pieces. Photos from the Photo Inbox ride along, the same as any Item Type switch.
- **The filters still decide.** A Postwar set counts as Lionel · Postwar · Set · O, and goes through the SAME one filter test as every catalog row (v0.9.2092). Lionel · Postwar keeps it; Type "Steam" hides it.
- **Hidden by a filter → one more line in the "nothing found" box.** Lionel · Pre-War + `1467W` → the three lines as today, plus "1467W is a Lionel Postwar set — add it as a set?" and an **Add as a set** button (same carry). A number that is not a Postwar set never gets that line.
- **Sets of every other era and maker are unchanged** — they are ordinary catalog rows (e.g. a Modern Lionel set) and still save as one item; no set switch.
- **Never a blank answer because of load order.** If the Postwar set list is not in memory yet (e.g. a collector whose makers leave Postwar out), the item box fetches it — saved copy first, then the master's "Lionel PW - Sets" tab — once, and redraws the list.
- Where it applies: adds to the Collection on the item box (including adds started from the Photo Inbox). Not the Sold / For Sale pickers, the Want list, box-only adds, set members, edits or "Fill in".

## Files changed
App:
- `app/wizard-suggestions.js` — the set check: `rrSetAsRow` (a set described as a catalog row: Lionel · Postwar · Set), `rrPostwarSetVariants`, `_wizSetCheckOn`, `_wizPostwarSetHits` (asks THE one filter test `_wizRowFitsFilters` — no second copy), `_wizSetRowDetails`, `_wizPickSetRow`; the item list adds the SET rows (same list, same maker · era tag helper, a SET tag); the nothing-found block's new "add it as a set?" line.
- `app/wizard.js` — `_wizSetKind` extends the SAME carry v0.9.2092 gave Manual: a carried number that IS a Postwar set opens the set flow on it (`_wizOpenSetOn` → the set flow's own `_confirmSetMatch`). A non-set number starts the set flow as before.
- `app/config.js` — the words, in `RR_ADD_FILTERS`: `SET`, "{n} pieces", "1 piece", "{n} versions", "{num} is a Lionel Postwar set — add it as a set?", "Add as a set", and the cap of 12 set rows for a short number. No word "AI".
- `app/app-data.js` — `rrEnsurePostwarSets`: THE one "fetch the Postwar set list when it is missing" (saved copy, then the Sets tab; one try per app load unless a button asks again).
- `app/tools.js` — the Set Builder's own private copy of that loader is gone; it asks `rrEnsurePostwarSets` (same steps, same messages). One definition, never two copies.
- `.github/site-files.txt` — `handover/` listed private (the same two lines as on `build/command-ids` / `build/add-filters`, so they merge cleanly). Branch-only, like the earlier hand-overs.

Tests (new):
- `tests/set_number_item_box_tests.js` — Node + jsdom, the REAL wizard code with a stand-in set list (1467W in two versions, 2500WS in one) and catalog (a Modern Lionel set 6-31705, a Postwar 2343, a Pre-War 1467): the SET row, its tags and words; 1467 while typing; the filters (Postwar keeps, Steam hides); 6-31705 stays one catalog item with no set switch; Sold picker / box-only never list sets; Photo Inbox does; nothing found + the set line, and no line for a non-set; the carry (variant picker for 1467W, one variant for 2500WS, inbox photo kept, "lionel 1467w" typed, a non-set number unchanged, Manual's carry unchanged); the set list loaded on demand and the sheet read once, not per keystroke; scans with planted offenders (the set check goes through the one filter test — a hand-written Era match turns it red, and run for real it lists the set under "Steam"; one set loader; words only in config.js / no "AI"; one carry). **50/50.**
- `tests/set_number_item_box_road_tests.js` — real Chromium at iPhone size (390×844): type 1467W → the SET row → tap → "Which version?" → tap 1953 → the set's details screen ("1467W — Erie Freight", 6 items); 2500WS → tap → straight to its details screen; Lionel · Pre-War + 1467W → nothing found + the set line → Add as a set → the set flow; the row fits the phone, nothing overlaps; no page errors; planted: the set check switched off in a served copy → the SET row is gone (caught). **10/10, 11 s.**

## Test results
ONE full run of the final app/ and tests/ files: `node tests/run-all.js --all --receipt receipt.json` (receipt moved to `handover/receipt_setinitembox.json`: tier **full+browser**, 376 suites, 572 files fingerprinted, nothing changed during the run). Main was still `2c8d7f9b` after the run (checked with `git fetch`).

- **372 green, 4 red**, so the receipt says **NOT passed**. None of the four comes from this change. Each one fails **the same way on a clean copy of main `2c8d7f9b`** (checked in this session):
  - `photo_closer_1950_tests.js`, `photo_choices_1951_tests.js`, `picture_box_1955_tests.js`: the photo number reader needs an online text-reading engine that this cloud machine's network blocks.
  - `safari-walk.js`: Safari's engine (WebKit) could not be downloaded here.
  (These are the same four reds as the Add filters and Command IDs hand-overs.)
- `import_core_tests.js`: its 18 fixture pins were skipped because Scott's workbook is not on this machine. That is normal.
- The new suites: `set_number_item_box_tests` **50/50** (including 8 planted-offender checks); `set_number_item_box_road_tests` **10/10** (iPhone size, 1 planted offender, 11 s).
- The Add-screen neighbours are all green: `add_filters_strict_tests` 54/54, `add_filters_road_tests` 36/36, `lookup_canary` (all canaries green), `photo-inbox-tests` 4025/4025, `inbox_holds_makers_2053_tests` 61/61, `site_files_tests` 18/18.

**For the shipping chat:** wizard.js and wizard-suggestions.js are core files. Run the full gate once on Brad's PC, where the photo reader and WebKit work (`node tests/run-all.js --all --receipt …`), to get a PASSED receipt before shipping.

## Two things found along the way (NOT changed — Brad's call)
1. **Tapping a button in the "nothing found" box may miss on Android phones.** In the real-browser test a finger-tap on "Add as a set" landed on the background instead — and the existing "Clear filters" and "Add manually" buttons do the same. Cause: Chrome gives a tapped button focus, and the Add screen's phone-keyboard helper (`focusin` → `_wizScrollFieldIntoView`, wizard.js) then scrolls it "into view", moving it out from under the finger. iPhone Safari does not focus tapped buttons, so Lars's iPhone should be fine. Likely fix: only scroll for typing fields (input / textarea / select). The road test presses that one button by script and says why.
2. **Typing a Modern Lionel number with its "6-" in front finds nothing when the catalog row is written the same way** (e.g. a row "6-31705", typed "6-31705"). The search strips the "6-" from the number but then still asks for "6-31705" in the description. Older than this build.

## Brad to try by hand (after it ships)
1. Add → Cataloged Item, no filters, type **1467W** → one row: `1467W  LIONEL · POSTWAR  SET`, with its name, years and piece count.
2. Tap it → "Lionel Postwar Set" opens on 1467W and asks which version → pick one → the set's details screen lists its pieces.
3. Type **2500WS** (or any one-version set) → tap → straight to that set's details.
4. Set Manufacturer **Lionel**, Era **Pre-War**, type **1467W** → the "nothing found" box now also says "1467W is a Lionel Postwar set — add it as a set?" → **Add as a set** → the set flow on 1467W.
5. Type a Modern Lionel set number → it is still found as one catalog item, no set switch.
6. (Android only, if anyone has one) the buttons in the "nothing found" box — see "found along the way" #1.

## Suggested SHIP_QUEUE line
`Set number in the item box (build/set-in-item-box) — Lionel Postwar set numbers found in Cataloged Item, open the set flow on that set, "add it as a set?" line — core: wizard.js, wizard-suggestions.js → full+browser receipt`
