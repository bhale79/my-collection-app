# The Rail Roster — Project Instructions for Claude

## STABILITY PRINCIPLES

1. **Explain before executing.** On any significant change, describe the plan and get Brad's approval before writing code. If an interpretation differs from existing UI patterns, explain and ask first.

2. **No manual steps for Brad.** Claude handles all implementation, verification, file delivery, and GitHub pushes. Brad reviews and approves direction, not code.

3. **Single source of truth.** Configuration values (tab names, column indices, API keys) should live in ONE place — a constant or config object. Never hardcode the same value in multiple files. Example: `SHEET_TABS` config for master tab names.

4. **Prefer stable identifiers over positional ones.** Use inventoryId (or similar persistent IDs) as state keys — never row numbers, array indices, or anything that shifts when data changes. Row numbers are only for Sheets API range references.

5. **Guard against double-execution.** Any save/write operation should have a flag guard (like `_saveComplete`) that prevents it from firing twice, regardless of how it's triggered.

6. **Fix the root cause, not the symptom.** If a bug appears (like duplicate rows on screen), trace it to the actual source before patching. The display might be wrong while the data is fine, or vice versa.

7. **Test rendering separately from saving.** When debugging, check the Google Sheet first — if the data is correct there, the bug is in display code, not save code.

8. **Cache versions must always bump together.** Both `_CACHE_VER` in app.js, `CACHE_NAME` in sw.js, AND `?v=` in index.html script tags must be incremented on every deploy. Missing one means users get stale code.

## CODE PATTERNS

- **Shared constants live in `config.js`** — loaded first by index.html. If more than one file needs a variable, it goes here. Never declare the same `const` in two files.
- **Always fetch files fresh from GitHub** before editing (`curl -s "https://raw.githubusercontent.com/bhale79/my-collection-app/main/{file}"`). Never edit from memory or stale local copies.
- **Validate syntax** with `node --check` before every push.
- **Pre-push checklist:** (1) `node --check` on ALL `.js` files, not just edited ones. (2) `grep` ALL `.js` files for any variable being added, removed, or renamed — catch cross-file conflicts. (3) Bump `?v=` number in `index.html` script tags alongside `_CACHE_VER` and `CACHE_NAME`.
- **Use Python push script** for large files (wizard.js, app.js) since bash/curl hits "filename too long" errors with base64.
- **Column indices are fragile.** When adding columns to sheets, add at the END to avoid breaking hundreds of existing index references.
- **Lionel catalog conventions matter:** P = powered, T = trailer/dummy, C = B-unit; no dashes in catalog numbers (2343P not 2343-P); app uses dashes (2343-P). The `baseItemNum()` helper bridges both conventions.
- **Copyright:** Paraphrase reference book descriptions rather than copying verbatim.

## ARCHITECTURE QUICK REFERENCE

- **`config.js`** — shared constants loaded first: APP_VERSION, APP_DATE, _RSV_PLACEHOLDER_PNG. If multiple files need a value, it goes here.
- **SHEET_TABS** (app.js) — single source of truth for master sheet tab names ("Lionel PW - Items", etc.)
- **State keys** — inventoryId-based for personalData, mySetsData, isData, scienceData, constructionData. Row numbers on records for Sheets API only. (See ARCHITECTURE_14.md)
- **findPD / findPDKey / findPDKeyByRow** (wizard.js) — lookup functions scan by `.itemNum`/`.variation` values, key-format-agnostic
- **baseItemNum()** (app.js) — strips P/D/T/C/-P/-D suffixes for cross-convention matching
- **buildPartnerMap()** — must run AFTER all data loads, BEFORE buildApp()
- **_doCloseWizard()** — use after successful saves (bypasses cancel-guard). `closeWizard()` has a guard that shows cancel dialog if set items exist.
- **_patchMasterData()** (app.js) — post-load fixes for known data errors (6017 type, 2046W, 12 set component corrections)
- **_adjustRowsAfterDelete()** (app.js) — instant in-memory row adjustment after sheetsDeleteRow; no background reload needed

## WHAT TO DO FIRST EVERY SESSION

1. Read SESSION_78_SUMMARY.md (or latest) and ARCHITECTURE_14.md for current state
2. Fetch fresh copies of files before editing
3. Ask Brad what we're working on — don't assume from memory alone
4. For any change, explain the plan before executing

## COMMUNICATION STYLE

- Brad is not a coder — explain what you're doing in plain English
- Suggest more stable approaches when you see fragile patterns
- Don't make changes without asking first
- When something breaks, show Brad what you found before proposing fixes
