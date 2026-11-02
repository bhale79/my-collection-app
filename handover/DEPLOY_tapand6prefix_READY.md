# DEPLOY — Android taps in the Add screen land; a Modern Lionel number typed with its "6-" is found — READY for the shipping chat

Branch: `build/tap-and-6-prefix`, made from main `2c8d7f9b` (v0.9.2092 + the Privacy page). `git fetch` after the final gate: **main had not moved**, so no rebase was needed. **No version numbers were changed** (APP_VERSION, CACHE_NAME and the `?v=` stamps are untouched — the shipping chat bumps them).
Patch: `git diff origin/main...origin/build/tap-and-6-prefix`
Both problems were found while building Lars's set line (`build/set-in-item-box`, 2026-11-01). Brad, 2026-11-02: "yes" to planning a fix for both, then "yes" to building them on their own branch made from main.
Adds NO sheet columns and writes nothing new to any sheet.

## What it does (plain words)
1. **Taps on Android phones land.** On a phone, when something in the Add screen gets focus, the app slides it to the top so the keyboard can't cover it. Android Chrome also gives a *button* focus when you tap it, so the button slid away from under the finger and the tap was lost. That hit "Clear filters", "Add manually" and the set build's "Add as a set". Now only boxes you type into slide up; buttons, check boxes, sliders and drop-downs stay put. Typing boxes slide up exactly as before. (iPhone Safari never focuses a tapped button, so iPhones were never affected.)
2. **Modern Lionel numbers typed with "6-" in front are found.** The catalog writes some Modern Lionel numbers with the one-digit product-line prefix ("6-31705") and some without ("8359"). Typing "6-31705" used to find nothing, because the search took 31705 as the number but then also required the words "6-31705" in the description. Now:
   - the list finds the row whichever way it is typed or written ("6-31705" / "31705" / "6-8359" → 8359), highlights it as the number, and adds no "contains" label or "Use … as typed" row for it;
   - the "Found" line, Next and the "under other makers or eras" note use the same "same number?" check, so the add holds that row and takes the catalog's form of the number (as Next already did for 1076L / 1076-L);
   - unchanged: MTH numbers like 20-66238 (two digits in front: still a *different* number from 66238) and Postwar numbers like 6464-1 (a dash later on). The rule only applies to ONE digit and a dash at the very front, followed by at least two digits.
   - Side effect worth knowing: the "Found" line now also matches 2343P to a catalog 2343-P (and the other way round). That is the same rule the list and Next already used since v0.9.2031; the "Found" line was the only place still comparing letter for letter.

## Files changed
App:
- `app/wizard.js` — `_wizIsTypingField` (what counts as a box you type into); the phone `focusin` keyboard helper asks it first; `_wizSameNum` (the scorer `_wizPickMasterRow` asks the one check through it); Next takes the catalog's form of the number when the held row writes it differently.
- `app/wizard-suggestions.js` — `rrNumLinePrefixOff` (the ONE rule for the one-digit line prefix); `rrNumSameAsTyped` uses it; the list stops asking the description for the number token, accepts a row whose number is the same number, and highlights by the one check; the one row picker `_wizResolveAddRow` and `_wizNumberInCatalog` ask the one check instead of a letter-for-letter compare.
- `.github/site-files.txt` — `handover/` listed private (the same two lines as on the other build branches, so they merge cleanly). Branch-only.

Tests (new):
- `tests/line_prefix_number_tests.js` — Node + jsdom, the REAL code: the same-number rule (6-31705 = 31705, 7-11193 = 11193, 2343-P = 2343P; NOT 20-66238 / 66238, NOT 6464-1 / 6464, no wheel arrangements); the list both ways round, description words still narrowing, MTH and Postwar unchanged; the picker, the scorer and the "elsewhere" note; still nothing outside the filters; scans with planted offenders, two of them RUN to show the old code fails the checks. **28/28.**
- `tests/tap_and_prefix_road_tests.js` — real Chromium as a small Android phone (360×640, Android Chrome): finger-taps on "Add manually" (opens Manual with 1511) and "Clear filters" (clears, keeps 1511); a typing box still slides up and a button doesn't; "6-31705" found and held when tapped; "6-8359" → Next holds the 8359 row in the catalog's form; no page errors; planted: the old focus rule makes the "Add manually" tap miss, and the old list finds nothing for "6-31705". **11/11, 15 s.**
Tests (updated harness pins, because the picker and scorer now ask the shared check): `tests/lookup_canary.js` and `tests/add_filters_strict_tests.js` load `rrNumLinePrefixOff` / `rrNumSameAsTyped` / `_wizSameNum` beside the pieces they already load. No expected answer changed.

## Test results
ONE full run of the final app/ and tests/ files: `node tests/run-all.js --all --receipt receipt.json` (receipt moved to `handover/receipt_tapand6prefix.json`: tier **full+browser**, 376 suites, 572 files fingerprinted, nothing changed during the run).

- **372 green, 4 red**, so the receipt says **NOT passed**. None of the four comes from this change. They are the same four that failed on the set build's gate, and each fails **the same way on a clean copy of main `2c8d7f9b`** (checked in this session, 2026-11-01/02):
  - `photo_closer_1950_tests.js`, `photo_choices_1951_tests.js`, `picture_box_1955_tests.js`: the photo number reader needs an online text-reading engine that this cloud machine's network blocks.
  - `safari-walk.js`: Safari's engine (WebKit) could not be downloaded here.
- `import_core_tests.js`: its 18 fixture pins were skipped because Scott's workbook is not on this machine. That is normal.
- The new suites: `line_prefix_number_tests` **28/28**; `tap_and_prefix_road_tests` **11/11** (15 s).
- The neighbours are all green: `add_filters_strict_tests` 54/54, `add_filters_road_tests` 36/36, `lookup_canary` (all canaries green), `typed_number_2031_tests` 31/31, `short_number_search_tests` 21/21, `parts_typed_number_tests` 29/29, `photo-inbox-tests` 4025/4025, `site_files_tests` 18/18.

**For the shipping chat:** wizard.js and wizard-suggestions.js are core files. Run the full gate once on Brad's PC, where the photo reader and WebKit work, to get a PASSED receipt before shipping.

## With the set build (`build/set-in-item-box`)
Both branches change `app/wizard.js` and `app/wizard-suggestions.js`. A trial merge of the two **auto-merges with no conflicts**, and in the merged copy `set_number_item_box_tests` (50/50), `set_number_item_box_road_tests` (10/10), `tap_and_prefix_road_tests` (11/11), `add_filters_strict_tests` (54/54) and `lookup_canary` are all green. Either order works; whichever ships second should rebase on main and re-run its gate. Once both are in, the set build's road test can tap "Add as a set" with a real finger instead of a script click (a small follow-up, not needed to ship).

## Brad to try by hand (after it ships)
1. On an **Android** phone if anyone has one (an iPhone shows no change): Add → Lionel / Postwar, type **1511** → tap **Add manually** → Manual opens with 1511. Again → tap **Clear filters** → the list shows, 1511 still in the box.
2. Any phone or computer: type **6-** followed by a Modern Lionel number you know is in the catalog → it shows in the list, green-edged; tap it → the next screen is that item.
3. Type an MTH number's tail (e.g. **66238**) → unchanged: the MTH row says "contains 66238", and "Use 66238 as typed" is offered.

## Suggested SHIP_QUEUE line
`Android taps + "6-" numbers (build/tap-and-6-prefix) — Add-screen buttons take Android taps; Modern Lionel numbers typed with "6-" are found — core: wizard.js, wizard-suggestions.js → full+browser receipt`
