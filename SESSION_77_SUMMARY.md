# Session 77 Summary — The Rail Roster

**Date:** March 27, 2026  
**Commits:** ~3 pushes, cache v47 → v50 (mca-v52 → mca-v55)  
**GitHub PAT:** Provided and used for direct pushes via Python API script

---

## COMPLETED THIS SESSION

### 1. InventoryId Key Migration (Major Stability Improvement)
The #1 priority from Session 76 — all state data keys migrated from row-number-based to inventoryId-based. This eliminates the class of bugs where deleting a row shifts all subsequent row numbers, causing stale state references.

**What changed:**
- **Parsers (app.js)** — personalData, mySetsData, isData, scienceData, constructionData all now key by inventoryId. Fallback to old key format for un-backfilled rows.
- **findPD / findPDKey (wizard.js)** — completely rewritten to scan by `.itemNum` and `.variation` values instead of key-prefix matching. Now key-format-agnostic.
- **New `findPDKeyByRow()` helper (wizard.js)** — for disambiguation when multiple copies share the same item number.
- **All save paths (wizard.js, ~12 places)** — optimistic state updates now use inventoryId as key instead of `itemNum|variation|temp_timestamp` patterns.
- **All delete paths (app.js)** — `removeCollectionItem`, `collectionActionForSale`, `collectionActionSold` all use value-based lookups instead of constructing keys from row numbers.
- **Browse lookups (browse.js)** — ownership counts and copy counts scan by values instead of key-prefix matching.
- **QE table (app.js) + inline buttons (browse.js)** — pass inventoryId instead of row number to `completeQuickEntry`.
- **`completeQuickEntry` (wizard.js)** — accepts inventoryId, does direct state lookup.
- **`removeForSaleAndCollection` (app.js)** — simplified to direct inventoryId key lookup.
- **`openItem` (app.js)** — uses findPDKey instead of key-prefix scan.

**Safety net:** Parsers fall back to old key format (`itemNum|variation|rowNum`) when inventoryId is empty. Old data still works until backfill runs.

### 2. Wizard Cleanup
- **Removed 4 diagnostic console.log statements** from `saveWizardItem` and `quickEntryAdd` — no longer needed with `_saveComplete` guard stable.
- **Fixed back button** — `wizardBack()` rewritten to properly skip over multiple consecutive hidden steps (old code had a `while/break` that only ran once).
- **Fixed step counter** — now excludes set-mode auto-skipped steps (`itemCategory`, `itemNumGrouping`, `itemPicker`, `entryMode`) from total count, giving accurate "Step X of Y" display.

### 3. Master Data Patches
- **6017 type fix:** Accessory → Caboose (post-load patch in `_patchMasterData()`)
- **2046W tender fix:** "2046" → "2046W" in set component lists (post-load patch)
- `_patchMasterData()` runs once before `buildPartnerMap()` on every load — patches are idempotent and become no-ops if the sheet is later corrected.

### 4. lockSheetTabs 401 — Confirmed Non-Issue
Already wrapped in `.catch(() => {})` and marked non-blocking. OAuth scope includes full `spreadsheets` access. Likely intermittent token-expiry. No code fix needed.

---

## CURRENT FILE SIZES

| File | Lines |
|------|-------|
| app.js | ~6,650 |
| wizard.js | ~8,110 |
| browse.js | ~1,036 |
| sheet-builder.js | ~442 |
| drive.js | 515 |
| prefs.js | 706 |
| app.css | 1,044 |
| sw.js | 87 |

**Cache versions:** `_CACHE_VER = '50'` (data) / `CACHE_NAME = 'mca-v55'` (service worker)

---

## DATA TYPES — KEY FORMAT AFTER MIGRATION

| Data Type | Old Key | New Key | Fallback |
|-----------|---------|---------|----------|
| personalData | `itemNum\|variation\|rowNum` | `inventoryId` | Old format if no inventoryId |
| mySetsData | `setNum\|year\|rowNum` | `inventoryId` | Old format if no inventoryId |
| isData | `rowNum` | `inventoryId` | rowNum if no inventoryId |
| scienceData | `rowNum` | `inventoryId` | rowNum if no inventoryId |
| constructionData | `rowNum` | `inventoryId` | rowNum if no inventoryId |
| soldData | `itemNum\|variation` | *unchanged* | — |
| forSaleData | `itemNum\|variation` | *unchanged* | — |
| wantData | `itemNum\|variation` | *unchanged* | — |
| upgradeData | `itemNum\|variation` | *unchanged* | — |

soldData/forSaleData/wantData/upgradeData keys don't use row numbers, so they didn't have the row-shift bug and were left unchanged.

---

## PENDING FIXES (carried forward)

- 773 V1/V2 engine+tender split (needs Companions tab data review)
- Beta tester invites
- Landing page deployment (Brad: not ready yet)
- Google Cloud app rename: "Lionel Vault" → "The Rail Roster" (manual Console step)
- Apply audit corrections to ALL_SETS_1945_1969.json
- Hunt COTT URLs for remaining 27 unmatched items
- Add missing items to master Items tab

---

## KEY PATTERNS & RULES

- **InventoryId is the state key** for personalData, mySetsData, isData, scienceData, constructionData. Row numbers stored on records for Sheets API calls only.
- **findPD / findPDKey / findPDKeyByRow** — all scan by `.itemNum` and `.variation` values, never by key format. Defined in wizard.js, callable from any file.
- **_patchMasterData()** — runs before buildPartnerMap(), fixes known data errors at load time.
- **SHEET_TABS config** — single source of truth for master tab names.
- **baseItemNum()** — strips P/D/T/C/-P/-D suffixes for cross-convention matching.
- **_saveComplete flag** — set on wizard.data after any successful save.
- **_doCloseWizard()** — use after successful saves to bypass cancel-guard.
- Cache nuke: `caches.keys().then(k => k.forEach(n => caches.delete(n))); navigator.serviceWorker.getRegistrations().then(r => r.forEach(w => w.unregister())); setTimeout(() => location.reload(), 500);`
- Must bump BOTH `_CACHE_VER` in app.js AND `CACHE_NAME` in sw.js on every deploy.

---

## ADDITIONAL CHANGES (later in session)

### 5. Eliminated Background Reload After Delete
- Replaced `_reloadAfterDelete()` (1.5s background full-data reload) with `_adjustRowsAfterDelete()` (instant in-memory row number adjustment)
- After `sheetsDeleteRow`, all records with `.row` above the deleted row get decremented by 1
- Applied to both single-item and group delete paths
- Makes deletes feel instant — no more flash of stale data

### 6. Additional Debug Log Cleanup
- Removed 2 more diagnostic console.log statements from QE1 Save and Full Entry button handlers in wizard.js

### 7. Set Component Audit Fixes (12 corrections)
All applied as post-load patches in `_patchMasterData()`:
- **Book errors:** 6414-75→6414-85, 6476-125→6476-135, 6438-500→6436-500, 6014-325→6014-335, 6119-110→6119-100
- **Bare numbers needing suffixes:** 6462→6462-1, 6476→6476-25, 6112→6112-1
- **COTT X-prefix items:** 1004→X1004, 6004→X6004, 2454→X2454

### 8. Architecture Doc Updated to v14
- Reflects inventoryId migration complete, new helpers, elimination of _reloadAfterDelete

---

## FINAL STATE

**Cache versions:** `_CACHE_VER = '52'` (data) / `CACHE_NAME = 'mca-v57'` (service worker)

| File | Lines |
|------|-------|
| app.js | ~6,664 |
| wizard.js | ~8,125 |
| browse.js | ~1,035 |
