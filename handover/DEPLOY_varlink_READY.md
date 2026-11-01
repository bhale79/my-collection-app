# DEPLOY — variation link fix (job A) — READY

Branch: `build/varlink` (made from `main` at v0.9.2088, commit 57a00ff).
Patch for the shipping chat: `git diff origin/main...origin/build/varlink`.
**No version numbers were changed** (APP_VERSION, CACHE_NAME, the `?v=` stamps) — the shipping chat numbers it.

## What it does, in plain words

Lars's list said 54 items in the header but drew only 48. Six of his items (2613 B, 2614 B, 2615 B,
2955 B, 656 C, 1656 2) were saved with a variation, but linked to the catalog row of a *different*
variation (the plain row he picked on the first step). No row in the list would then draw them.

1. **Saving.** When you pick a variation on the Add screen, the item now links to *that variation's own
   catalog row*. Every save road checks again right before writing — the Add screen, a typed or
   photo-read variation, the edit panel, the import, the background fill-ins. If the variation has no
   row of its own (or two), the picked row is kept, exactly as before. It never moves an item to a
   different catalog (a Pre-War 2613 B never becomes a Postwar one) and never touches a manual item.
2. **The list never loses an owned item.** A copy whose link disagrees with its variation is now drawn
   on the row its link names. And as a safety net, any owned copy that no catalog row claims is drawn
   on its own row (the app notes it in the console) instead of vanishing. **With this live, Lars's six
   show again the moment it ships — repaired or not.**
3. **The repair (ships switched OFF).** On load, items already saved with a mismatched link would be
   re-linked to their own variation's row — Master Row ID + Master Key only, one row at a time, the row
   re-read first and skipped if it changed elsewhere, each repair a line in the sync diary. **While the
   switch is OFF it writes nothing**: it only puts a "would re-link" list into the sync diary
   (`VARLINK-DRY` line), which the Report a problem email already carries.
   The switch is `RR_VARLINK_REPAIR_ON` in `app/config.js` (one line, `false` → `true`).

## Files changed

| File | Change |
|---|---|
| `app/app-data.js` | NEW `rrRowForVariation` + `rrLinkForVariation` (the one rule, beside `_rrRowIdFits`); NEW `rrVarLinkRepairPlan` / `rrVarLinkRepair` (part 3) |
| `app/app.js` | `buildPersonalRow` and `rrCarryPersonalRow` (the row builders every save goes through) end in NEW `rrFixRowLink` |
| `app/wizard-save.js` | the Add screen's Master Key / Master Row ID lines ask `rrRowForVariation` (2 lines) |
| `app/wizard-handlers.js` | `wizardChooseVariation` re-points the picked row to the chosen variation's row |
| `app/browse.js` | seat-by-row rule + the never-lost net in the owned list; NEW count level `drawn` + `rrCollectionDrawn()` (job B builds on it) |
| `app/photo-inbox-tools.js` | the two link fill-ins (Master Key, Master Row ID) ask `rrRowForVariation` before writing |
| `app/photo-inbox-identify.js` | one line: start the repair beside the existing fill-ins on dashboard build |
| `app/config.js` | NEW switch `RR_VARLINK_REPAIR_ON = false` (not the version line) |
| `tests/variation_link_tests.js` | NEW suite (real Chromium, real app) |
| `.github/site-files.txt` | one line: `private: handover` — this hand-over folder never goes on the website (`site_files_tests` requires every top-level folder be marked; added after the gate, outside app/ and tests/, so the receipt's fingerprints are unchanged; `site_files_tests` re-run: 18/18) |
| `tests/lib/lars-world.js` | NEW shared stand-in: Lars's exact six + 48 fillers (job B reuses it) |

`app/wizard.js` did **not** need a change: its typed variation box only appears when the catalog has no
variations for the number, and the save re-checks anyway.

**Overlap with the Command IDs build (`build/command-ids`):** both touch the Add screen. Job A's edits there
are tiny: 2 lines in `wizard-save.js` (~line 1707, the `masterKey:` / `masterRowId:` lines) and 4 lines in
`wizard-handlers.js` (`wizardChooseVariation`). If the two patches meet, keep both.

## Tests

ONE run of the final files (commit `6cf99059`): `node tests/run-all.js --all --receipt handover/receipt_varlink.json`
→ tier **full+browser**, **366 suites: 361 green, 5 red**, 560 files fingerprinted, nothing changed during the run.

**The receipt says NOT passed — only because of 5 reds that are NOT from this change.** Each was run on a
clean copy of `main` (v0.9.2088) in this cloud session and fails there exactly the same way:

| Red suite | Why (same on clean main) |
|---|---|
| `photo-inbox-tests.js` (4024 pass, 1 fail) | the About-panel month check: config.js says "October 2026", today is 1 November — **the shipping chat's date line moves with the version trio** |
| `photo_closer_1950_tests.js`, `photo_choices_1951_tests.js`, `picture_box_1955_tests.js` | the REAL text reader needs its language data from the internet; this cloud machine's network blocks it ("Lettering: nothing read") |
| `safari-walk.js` | Safari's engine (WebKit) can't be downloaded here (network blocked) |

**So the shipping chat should re-run the gate on Brad's PC** (after its trio + date bump), where those
four download and the month is right — that run makes the PASSED receipt `ship.py` needs. Also: the
first gate run caught three reds that WERE this change (older tests that copy a slice of browse.js /
app.js by markers); all three were fixed before this final run.

The 18 skipped pins in `import_core_tests.js` are Scott's workbook, which is only on Brad's PC (as always).

New suite `variation_link_tests.js` — 52 checks: the helper (A1–A8), every save road (B1–B8, S1–S3), the
list (C0 planted old browse.js → 48 of 54; C1 fixed → 54 of 54, drawn = counted; C3 the net alone still
draws 54; C4 planted row-test drop → the drawn = counted check goes red), the repair (D0–D15: ships OFF;
dry run lists Lars's six and writes nothing; ON re-links 5, skips the one edited elsewhere, writes only
the two link cells, nothing else changes, a second load repairs 0; privacy: no price/note/location/photo
in the diary), the scan of every line that writes the link (E0–E5, with planted offenders), and the real
road at iPhone size (F1–F3: the list holds 54).

## For Brad to try by hand (after it ships)

1. Open the app on your phone, go to **My Collection** — nothing should look different.
2. Add any item that has variations (e.g. pick a plain number, then a lettered variation). Open it after
   saving: the description should be the variation's own.
3. **The dry run:** after the app has finished loading (wait ~30 s), press **Report a problem** and open
   "See exactly what will be sent". In the sync diary, a `VARLINK-DRY` line lists any of *your* items the
   repair would re-link (number, variation, old link → new link). If it lists nothing, there's no line.
   Check it looks right; then the switch can go on (a later one-line release).
4. Ask Lars to open the app: his header and his list should both say 54.
