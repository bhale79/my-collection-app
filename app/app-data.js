// The Rail Roster — app-data.js
// Extracted from app.js in Session 111 (Round 2 Chunk 13).
//
// Contents:
//   • Post-load data patches (_patchMasterData, _inferMissingYears)
//   • Top-level data orchestrator (loadAllData)
//   • Master data loading + parse + dedup (loadMasterData, _fetchMasterTabs,
//     parseMasterRow, _deduplicateMaster, parseMasterRows)
//   • Master index + lookup helpers (_rebuildMasterIndex, findMaster, findAllMaster)
//   • Reference data loaders (loadCatalogRefData, loadISRefData, loadSetData,
//     loadCompanionData, parseCompanionRows, parseSetRows, suggestSets)
//   • Personal data load + cache (loadPersonalData, _cachePersonalData,
//     _loadPersonalFromSheets)
//
// Depends on globals defined in app.js: state, SHEET_TABS, _currentEra,
// _getMasterTabs(), idbGet/idbSet/idbRemove, PERSONAL_HEADERS family,
// MY_SETS_HEADERS, EPHEMERA_TABS, and sheets.js/drive.js helpers.

// ── Post-load data patches (correct known errors in master sheet) ──
// Phase 3 (Session 159 follow-up): state.forSaleData and state.upgradeData
// are keyed by inventoryId directly. These thin helpers remain in place for
// any callers that still call them — they're just a direct lookup now.
window._fsByInv = function(invId) {
  return invId ? (state.forSaleData || {})[invId] : undefined;
};
window._ugByInv = function(invId) {
  return invId ? (state.upgradeData || {})[invId] : undefined;
};
function _patchMasterData() {
  // Fix 6017: itemType should be 'Caboose' not 'Accessory'
  (state.masterData || []).forEach(m => {
    if (m.itemNum === '6017' && m.itemType === 'Accessory') m.itemType = 'Caboose';
  });

  // Fix set component references — book errors, missing suffixes, COTT X-prefix
  const _setItemFixes = {
    '2046':     '2046W',     // tender, not engine
    '6414-75':  '6414-85',   // book error
    '6476-125': '6476-135',  // book error
    '6438-500': '6436-500',  // book error (wrong base number)
    '6014-325': '6014-335',  // book error
    '6119-110': '6119-100',  // book error
    '6462':     '6462-1',    // bare number needs suffix
    '6476':     '6476-25',   // bare number needs suffix
    '6112':     '6112-1',    // bare number needs suffix
    '1004':     'X1004',     // COTT X-prefix
    '6004':     'X6004',     // COTT X-prefix
    '2454':     'X2454',     // COTT X-prefix
  };
  const _fixItem = (v) => _setItemFixes[v] || v;
  (state.setData || []).forEach(s => {
    if (s.steam)       s.steam       = _fixItem(s.steam);
    if (s.tender)      s.tender      = _fixItem(s.tender);
    if (s.dieselPow)   s.dieselPow   = _fixItem(s.dieselPow);
    if (s.dieselB)     s.dieselB     = _fixItem(s.dieselB);
    if (s.dieselDummy) s.dieselDummy = _fixItem(s.dieselDummy);
    s.items = s.items.map(_fixItem);
  });

  // Fix 726 RR: remove stale V7/V8 under 726 if 726RR already has COTT entries
  var has726RR = (state.masterData || []).some(m => m.itemNum === '726RR' && m.source === 'COTT');
  if (has726RR) {
    state.masterData = (state.masterData || []).filter(m =>
      !(m.itemNum === '726' && /\bRR\b/.test(m.description))
    );
    _rebuildMasterIndex();
  }
}

function _inferMissingYears() {
  // Phase 1: Set-based — map each set component to its set year(s)
  var setYears = {};
  (state.setData || []).forEach(function(s) {
    if (!s.year) return;
    var yrs = [];
    (s.year.match(/\d{4}/g) || []).forEach(function(y) { yrs.push(parseInt(y)); });
    if (!yrs.length) return;
    s.items.forEach(function(comp) {
      if (!comp) return;
      [normalizeItemNum(comp), baseItemNum(comp)].forEach(function(k) {
        if (!k) return;
        if (!setYears[k]) setYears[k] = [];
        yrs.forEach(function(y) { if (setYears[k].indexOf(y) < 0) setYears[k].push(y); });
      });
    });
  });
  var fixed = 0;
  (state.masterData || []).forEach(function(m) {
    if (m.yearProd) return;
    var years = setYears[normalizeItemNum(m.itemNum)] || setYears[baseItemNum(m.itemNum)];
    if (years && years.length) {
      years.sort(function(a,b){return a-b;});
      m.yearProd = years[0] === years[years.length-1] ? String(years[0]) : years[0] + ' - ' + years[years.length-1];
      fixed++;
    }
  });
  if (fixed) console.log('[YearInfer] Set-based: filled ' + fixed + ' items');

  // Phase 2: Sibling — another variation of same item has a year
  var itemYears = {};
  (state.masterData || []).forEach(function(m) {
    if (m.yearProd && !itemYears[m.itemNum]) itemYears[m.itemNum] = m.yearProd;
  });
  var sib = 0;
  (state.masterData || []).forEach(function(m) {
    if (!m.yearProd && itemYears[m.itemNum]) { m.yearProd = itemYears[m.itemNum]; sib++; }
  });
  if (sib) console.log('[YearInfer] Sibling: filled ' + sib + ' items');

  // Phase 3: Companion — engine↔tender year sharing
  (state.masterData || []).forEach(function(m) {
    if (m.yearProd && !itemYears[m.itemNum]) itemYears[m.itemNum] = m.yearProd;
  });
  var comp = 0;
  (state.masterData || []).forEach(function(m) {
    if (m.yearProd) return;
    var num = normalizeItemNum(m.itemNum);
    var engine = num.replace(/[WTX]+$/, '');
    if (engine !== num && itemYears[engine]) { m.yearProd = itemYears[engine]; comp++; return; }
    ['W','T'].forEach(function(suf) {
      if (!m.yearProd && itemYears[num + suf]) { m.yearProd = itemYears[num + suf]; comp++; }
    });
  });
  if (comp) console.log('[YearInfer] Companion: filled ' + comp + ' items');
}

async function loadAllData() {
  showLoading();
  // v0.9.840 (Phase C): subscription/trial check rides behind every full
  // load — non-blocking, fail-open, dark until the backend enforce flag.
  setTimeout(function () { try { if (typeof subCheck === 'function') subCheck(); } catch (e) {} }, 2500);
  try {
    loadUserDefinedTabs();
    // Audit NEW #9: also sync from sheet metadata so custom tabs survive
    // across devices. Fires once per load — idempotent.
    if (state.personalSheetId && typeof syncUserDefinedTabsFromSheet === 'function') {
      syncUserDefinedTabsFromSheet(state.personalSheetId).catch(function(e) {
        console.warn('[UserTabs initial sync]', e && e.message);
      });
    }
    // Session 116: 'all' meta-era has its own orchestrator that
    // hydrates from per-era IDB caches in parallel and refreshes
    // each era from Sheets in sequence in the background.
    if (_currentEra === 'all' && typeof loadAllErasMode === 'function') {
      await loadAllErasMode();
      _patchMasterData();
      _inferMissingYears();
      buildApp(); if (typeof _auditCatalogResolution === 'function') setTimeout(_auditCatalogResolution, 1500);
      _scheduleLookupIndex(6000);   // v0.9.971: full-catalog lookup index (background)
      showOnboarding();
      if (typeof vaultInit === 'function') vaultInit();
      if (state.personalSheetId) {
        // v0.9.1266 (R2): the `|| ''` that used to sit on these three turned
        // "driveCache has not been populated on this device yet" into a blank
        // written over the real folder ids in the shared config file. Passing
        // the raw value lets driveWriteConfig tell "I do not know" apart from
        // "erase this" — it drops the unknown and keeps what is on record.
        driveWriteConfig({
          personalSheetId: state.personalSheetId,
          vaultId: driveCache.vaultId,
          photosId: driveCache.photosId,
          soldPhotosId: driveCache.soldPhotosId,
        }).catch(e => console.warn('Config refresh:', e));
        _maybeRenamePersonalSheet().catch(e => console.warn('Sheet rename:', e));
      }
      return;
    }
    // Single-era mode — load master data (uses cache if fresh) and personal data in parallel
    await Promise.all([loadMasterData(), loadPersonalData(), loadSetData(), loadCompanionData(), loadCatalogRefData(), loadISRefData()]);
    _patchMasterData();
    _inferMissingYears();
    buildPartnerMap();
    _loadMasterVersion();   // v0.9.1103 — which master sheet is live (fail-silent)
    buildApp(); if (typeof _auditCatalogResolution === 'function') setTimeout(_auditCatalogResolution, 1500);
    _scheduleLookupIndex(6000);   // v0.9.971: full-catalog lookup index (background)
    showOnboarding();
    if (typeof vaultInit === 'function') vaultInit();
    // Re-write config after every successful load so all devices can always find the Sheet ID
    if (state.personalSheetId) {
      // v0.9.1266 (R2) — same as the 'all'-era branch above: no `|| ''`.
      driveWriteConfig({
        personalSheetId: state.personalSheetId,
        vaultId: driveCache.vaultId,
        photosId: driveCache.photosId,
        soldPhotosId: driveCache.soldPhotosId,
      }).catch(e => console.warn('Config refresh:', e));
      // Auto-rename sheet if it still has the old Boxcar Files name
      _maybeRenamePersonalSheet().catch(e => console.warn('Sheet rename:', e));
    }
  } catch(e) {
    showToast((typeof rrSaveError === 'function') ? rrSaveError(e, 'the load') : 'Load error: ' + e.message, 5000, true);
    const tb = document.getElementById('browse-tbody');
    if (tb) tb.innerHTML = '<tr><td colspan="9" style="padding:2rem;color:var(--red);text-align:center">Error loading data. Please refresh.<br><small>' + e.message + '</small></td></tr>';
  }
}

// ══════════════════════════════════════════════════════════════════════
// DATA LOADERS
// (era config + IndexedDB helpers remain in app.js — they're core infra)
// ══════════════════════════════════════════════════════════════════════

async function loadMasterData() {
  // Use cached master data for instant load, refresh in background.
  // Master data stored in IndexedDB (too large for localStorage).
  // Session 116: cache keys are now era-suffixed so each era's
  // master data sticks around independently. This is what makes
  // 'all' mode fast on warm load — every era hydrates from its
  // own IDB cache rather than re-fetching from Sheets.
  const _CACHE_VER = (typeof CATALOG_CACHE_VER !== 'undefined' ? CATALOG_CACHE_VER : '125');
  if (localStorage.getItem('lv_cache_ver') !== _CACHE_VER) {
    // Wipe legacy single-key caches from prior versions; per-era keys
    // take their place.
    idbRemove('lv_master_cache');
    localStorage.removeItem('lv_master_cache');
    localStorage.removeItem('lv_master_cache_ts');
    localStorage.removeItem('lv_personal_cache');
    localStorage.removeItem('lv_catalog_ref_cache');
    localStorage.removeItem('lv_catalog_ref_ts');
    localStorage.removeItem('lv_is_ref_cache');
    localStorage.removeItem('lv_is_ref_ts');
    localStorage.removeItem('lv_set_cache');
    localStorage.removeItem('lv_set_cache_ts');
    localStorage.removeItem('lv_companion_cache');
    localStorage.removeItem('lv_companion_cache_ts');
    localStorage.setItem('lv_cache_ver', _CACHE_VER);
  }

  // 'all' meta-era is handled by loadAllErasMode in app.js — it
  // orchestrates per-era loads and merges results. Loaders never
  // run with _currentEra === 'all' directly.
  if (_currentEra === 'all') return;

  const _IDB_KEY = 'lv_master_cache_' + _currentEra;
  const _TS_KEY  = 'lv_master_cache_ts_' + _currentEra;
  var cached = await idbGet(_IDB_KEY);
  const cachedAt = parseInt(localStorage.getItem(_TS_KEY) || '0');
  const cacheAge = Date.now() - cachedAt;
  const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  // v0.9.826 (TODO-003): offline accepts the master cache at any age.
  if (cached && (cacheAge < CACHE_TTL || window._offlineMode || navigator.onLine === false)) {
    try {
      state.masterData = cached;
      _rebuildMasterIndex();
      if (typeof ERAS !== 'undefined' && _currentEra && ERAS[_currentEra]) { ERAS[_currentEra]._total = state.masterData.length; try { localStorage.setItem('lv_era_total_' + _currentEra, state.masterData.length); } catch(e) {} }
      // Background refresh from multi-tab — but skip when called from
      // the loadAllErasMode orchestrator. Without the guard, the
      // detached .then() would resolve after the orchestrator has
      // moved on to a different era and overwrite state.masterData
      // with stale-era data.
      if (!window._skipBackgroundRefresh) {
        _fetchMasterTabs().then(allRows => {
          if (allRows.length) {
            state.masterData = _deduplicateMaster(allRows);
            _rebuildMasterIndex();
            if (typeof ERAS !== 'undefined' && _currentEra && ERAS[_currentEra]) { ERAS[_currentEra]._total = state.masterData.length; try { localStorage.setItem('lv_era_total_' + _currentEra, state.masterData.length); } catch(e) {} }
            idbSet(_IDB_KEY, state.masterData);
            localStorage.setItem(_TS_KEY, Date.now().toString());
            // v0.9.1251 (finding 13): masterData was just replaced wholesale —
            // repaint whichever tab is on screen, not only the Items list.
            if (typeof rrRepaintBrowse === 'function') rrRepaintBrowse();
            else if (typeof renderBrowse === 'function') renderBrowse();
          }
        }).catch(() => {});
      }
      return;
    } catch(e) {}
  }

  const allRows = await _fetchMasterTabs();
  // v0.9.1264 (finding R8): the warm path seventeen lines above already guards
  // its cache write with `if (allRows.length)`. This one — the COLD path, the
  // one that runs when there is no usable cache — did not, so a single refused
  // read wrote an empty catalog into IndexedDB *and stamped it fresh for 24
  // hours*. The user's catalog went blank and stayed blank for a day, with the
  // app entirely convinced it was up to date. Reloading did not help, which is
  // the worst property a cache bug can have.
  //
  // A failed read is now allowed to raise. Every caller of loadMasterData
  // already handles that, and an error the user can retry beats a blank screen
  // that insists it is correct.
  if (allRows && allRows._failed) {
    throw new Error('Could not load the catalog' + (allRows._why ? ' (' + allRows._why + ')' : ''));
  }
  state.masterData = _deduplicateMaster(allRows);
  _rebuildMasterIndex();
  if (typeof ERAS !== 'undefined' && _currentEra && ERAS[_currentEra]) { ERAS[_currentEra]._total = state.masterData.length; try { localStorage.setItem('lv_era_total_' + _currentEra, state.masterData.length); } catch(e) {} }
  idbSet(_IDB_KEY, state.masterData);
  localStorage.setItem(_TS_KEY, Date.now().toString());
}

// Session 156: one-time skip flag for the Master Inventory legacy fallback
var _legacyFallbackBlocked = false;

// v0.9.1264 (audit 2026-08-02 round 2, finding R8): _fetchMasterTabs answers
// "the catalog is empty" and "I could not read the catalog" with the same
// value — an empty array. Callers then cache that emptiness, and stamp it fresh
// for 24 hours, over a catalog that was perfectly good.
//
// The codebase already knew the rule. app.js:1890 states it outright:
//   if (!rows || !rows.length) throw new Error('no rows returned');
//   // empty = failure: never cache a blank catalog over a good one
// and _loadPersonalFromSheets carries a `_failed` sentinel for exactly this.
// This is that sentinel, applied to the one loader that lacked it.
//
// It is a marked ARRAY rather than a wrapper object on purpose: every existing
// caller does `if (rows && rows.length)` and keeps working untouched. Only the
// callers that write to a cache have to care, and they now say so out loud.
function _masterFetchFailed(why) {
  const out = [];
  out._failed = true;
  out._why = why || '';
  return out;
}
async function _fetchMasterTabs(era) {
  // Session 117 (Phase 2 #6): added optional `era` param so loadAllErasMode
  // can fetch every era's tabs in parallel without mutating SHEET_TABS.
  // When called without `era`, behavior is unchanged (uses _getMasterTabs() / SHEET_TABS).
  var _mt;
  var _itemsTabForFallback;
  if (era && typeof ERA_TABS !== 'undefined' && ERA_TABS[era]) {
    var _eraTabs = ERA_TABS[era];
    _mt = (typeof MASTER_TAB_KEYS !== 'undefined' ? MASTER_TAB_KEYS : ['items'])
            .map(function(k) { return _eraTabs[k]; })
            .filter(Boolean);
    _itemsTabForFallback = _eraTabs.items;
  } else {
    _mt = _getMasterTabs();
    _itemsTabForFallback = SHEET_TABS.items;
  }
  // Try multi-tab batchGet first, fall back to old single-tab
  try {
    // v0.9.1133: A1 (not A2) so row 1 arrives and can be read as the header,
    // and out to AD so appended columns are actually fetched. The old A2:U cut
    // off at MSRP, which is why Body Color and UPC / Barcode never loaded.
    const ranges = _mt.map(t => `${t}!A1:AD`);
    const res = await sheetsBatchGet(state.masterSheetId, ranges);
    const allRows = [];
    (res.valueRanges || []).forEach((vr, i) => {
      const tabName = _mt[i];
      const vals = vr.values || [];
      if (!vals.length) return;
      // Row 1 is the header on every tab in the master workbook. Build the
      // column map from it, then parse the data rows beneath.
      const cm = buildMasterColMap(vals[0]);
      for (let n = 1; n < vals.length; n++) {
        allRows.push(parseMasterRow(vals[n], tabName, cm));
      }
    });
    if (allRows.length > 0) return allRows;
  } catch(e) {
    console.warn('[Master] batchGet failed' + (era ? ' for era ' + era : '') + ', trying legacy single tab:', e.message);
  }
  // Fallback: old single-tab approach
  // Session 156: skip after first failure — was spamming 400s ~5x per sign-in
  // v0.9.1264 (R8): the skip is still right, but it is a *failure* being
  // skipped, not an empty catalog — say which.
  if (_legacyFallbackBlocked) return _masterFetchFailed('legacy fallback already failed once this session');
  try {
    let res = await sheetsGet(state.masterSheetId, 'Master Inventory!A2:U');
    if (!res.values) res = await sheetsGet(state.masterSheetId, 'Sheet1!A2:U');
    return (res.values || []).map(r => parseMasterRow(r, _itemsTabForFallback));
  } catch(e2) {
    console.warn('[Master] Legacy fallback also failed (will skip on subsequent calls):', e2.message);
    _legacyFallbackBlocked = true;
    return _masterFetchFailed(e2 && e2.message);
  }
}

// v0.9.658 — Atlas (and some MPC) Year Produced cells hold real DATES
// ("2022-04-01 00:00:00" — accurate release dates, month distinguishes waves).
// Display wants just the year; the dedupe key needs the FULL date so rows that
// differ only by release month stay distinct. So: yearProd = display-formatted,
// _yearRaw = untouched original (used in _deduplicateMaster).
function _fmtYearProd(s) {
  var t = String(s).trim();
  var m = t.match(/^(\d{4})-\d{1,2}-\d{1,2}(?:[T ]\d{1,2}:\d{2}(?::\d{2})?)?$/);
  if (m) return m[1];
  m = t.match(/^\d{1,2}\/\d{1,2}\/(\d{4})$/);
  if (m) return m[1];
  return t;
}

// ══ v0.9.1103 — the master sheet says which VERSION it is ═══════════════════
// Brad: "is there a place on the master sheet we can put what version it is?"
// A tiny 'Master Version' tab (Version | Date | Notes, one data row) that every
// delivered workbook bumps. The app reads it once after the master loads and
// shows it in Preferences — so a stale upload (the _59/_60 mix-up) is visible
// at a glance instead of a mystery. Fail-silent: no tab, no error, no change.
async function _loadMasterVersion() {
  try {
    if (!state.masterSheetId || typeof sheetsGet !== 'function') return;
    var resp = await sheetsGet(state.masterSheetId, "'Master Version'!A2:C2");
    var row = resp && resp.values && resp.values[0];
    if (row && row[0]) {
      state.masterVersion = { v: String(row[0]), date: String(row[1] || ''), notes: String(row[2] || '') };
      var el = document.getElementById('pref-catalog-count');
      if (el) el.textContent = el.textContent.replace(/ · sheet v.*$/, '') + ' \u00b7 sheet v' + state.masterVersion.v;
    }
  } catch (e) { /* silent — older masters simply have no version tab */ }
}

// ══ v0.9.1133 — master columns are read BY HEADER NAME, not by position ═════
// Brad found the cause of a whole bug class here. Every master tab used to be
// fetched `A2:U` — 21 columns — and parsed by fixed index. Two consequences,
// both silent:
//
//   1. Body Color (column V, added in _60) was NEVER fetched. The colour-clash
//      check fell back to parsing prose and reported no error, because the
//      fallback is written as a normal alternative rather than a failure. The
//      curated column sat in the sheet doing nothing from the day it shipped.
//   2. Column V means Body Color on Lionel PW - Items but UPC / Barcode on the
//      MTH / K-Line / Williams / Marx / Other O tabs. Simply widening the range
//      would have started feeding barcodes into the colour check.
//
// Reading by name fixes both at once and makes every future column free: append
// it to the sheet, name it, and it arrives. No range to widen, no positions to
// keep in sync across tabs whose schemas legitimately differ.
//
// Names are normalised (lowercased, non-alphanumerics stripped) so the real
// spelling drift across tabs collapses on its own: "Track Power" / "Track/Power"
// both become `trackpower`, "Variation #" becomes `variation`.
function _normHdr(s) {
  return String(s === null || s === undefined ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');
}

// field -> accepted normalised header names, in preference order.
// `pos` is the legacy fixed index, used ONLY when a tab has no usable header
// row (the legacy 'Master Inventory' / 'Sheet1' fallback). Fields with pos
// null never had a position and are name-only.
//
// The alias lists are not hypothetical. The master workbook spells the SAME
// column four different ways across its tabs, and every one of these is real:
//   Item Number / Item #            Description / Item Description
//   Variation # / Variation         Variation Details / Variation Description
//   Est. Market Value / Market Value    Original COTT Desc / Original Description
//   Sub-Type / Sub Type             Track Power / Track/Power
// The last two collapse under normalisation; the rest need naming here. Miss
// one and that field silently goes blank on every tab that uses the other
// spelling — which is a worse failure than the positional bug this replaces.
const MASTER_COL_SPEC = [
  ['itemNum',        0,    ['itemnumber', 'item']],
  ['itemType',       1,    ['itemtype']],
  ['subType',        2,    ['subtype']],
  ['unit',           3,    ['unit']],
  ['poweredDummy',   4,    ['powereddummy']],
  ['control',        5,    ['control']],
  ['roadName',       6,    ['roadname']],
  ['description',    7,    ['description', 'itemdescription']],
  ['gauge',          8,    ['gauge']],
  ['yearProd',       9,    ['yearproduced']],
  ['variation',      10,   ['variation', 'variationnumber']],
  ['varDesc',        11,   ['variationdetails', 'variationdescription']],
  ['refLink',        12,   ['referencelink']],
  ['notes',          13,   ['notes']],
  ['marketVal',      14,   ['estmarketvalue', 'marketvalue']],
  ['source',         15,   ['source']],
  ['cottCode',       16,   ['cottcode']],
  ['originalDesc',   17,   ['originalcottdesc', 'originaldescription']],
  // Unified-schema extension columns (used by Atlas rows; blank for Lionel rows):
  ['category',       18,   ['category']],
  ['trackPower',     19,   ['trackpower']],
  ['msrp',           20,   ['msrp']],
  // Name-only columns. These are the ones position could never carry safely,
  // because the same index holds a different column on different tabs.
  ['bodyColor',      null, ['bodycolor', 'bodycolour']],
  ['upc',            null, ['upcbarcode', 'upc']],
  ['manufacturer',   null, ['manufacturer']],
  ['stampedMarkings', null, ['stampedmarkings']],
];

// Build a field -> column-index map from a sheet's header row.
// Returns null when the row isn't a recognisable header, which tells
// parseMasterRow to fall back to the legacy fixed positions.
function buildMasterColMap(headerRow) {
  if (!headerRow || !headerRow.length) return null;
  var pos = {};
  headerRow.forEach(function (h, i) {
    var k = _normHdr(h);
    if (k && !(k in pos)) pos[k] = i;   // first wins — duplicates are typos, not data
  });
  var map = {}, hits = 0;
  MASTER_COL_SPEC.forEach(function (spec) {
    for (var j = 0; j < spec[2].length; j++) {
      if (spec[2][j] in pos) { map[spec[0]] = pos[spec[2][j]]; hits++; return; }
    }
  });
  // Anchor check: without Item Number it isn't an items tab header, and a
  // couple of stray matches shouldn't be enough to trust the whole row.
  if (map.itemNum === undefined || hits < 5) return null;
  return map;
}

// Read one field. With a column map, a field the tab doesn't have reads blank —
// it must NOT fall through to the legacy position, because that is exactly the
// collision that put a barcode where a colour belonged.
function _mcell(r, cm, field, posIdx) {
  var i;
  if (cm) { i = cm[field]; if (i === undefined) return ''; }
  else { i = posIdx; if (i === null || i === undefined) return ''; }
  var v = r[i];
  // Phase 3k: coerce all fields to strings — UNFORMATTED_VALUE returns
  // numbers/dates raw, but the rest of the app expects string fields.
  return (v !== null && v !== undefined && v !== '') ? String(v) : '';
}

function parseMasterRow(r, tabName, cm) {
  var out = {};
  MASTER_COL_SPEC.forEach(function (spec) {
    out[spec[0]] = _mcell(r, cm, spec[0], spec[1]);
  });
  // Year needs both shapes: display-formatted for the UI, raw for the dedupe key.
  out._yearRaw = out.yearProd;
  out.yearProd = out.yearProd ? _fmtYearProd(out.yearProd) : '';
  out._tab = tabName;
  return out;
}

function _deduplicateMaster(rows) {
  const seen = new Set();
  return rows.filter(m => {
    if (!m.itemNum) return false;
    // trackPower included so Atlas rail variants (3-Rail TMCC vs 2-Rail DC, etc.)
    // are NOT deduped into one row. Blank for Lionel rows so behavior is unchanged.
    // v0.9.658: subType + _yearRaw added — Atlas rows that differ only by sub-type
    // (40' vs 45' container assortments) or release DATE (Jan vs Sep waves, month
    // matters) are real distinct products and must not be dropped. _yearRaw keeps
    // the full date; the display-formatted yearProd would re-collapse same-year waves.
    const key = m.itemNum + '|' + (m.roadName || '') + '|' + m.variation + '|' + (m.poweredDummy || '') + '|' + (m.description || '') + '|' + (m.trackPower || '') + '|' + (m.subType || '') + '|' + (m._yearRaw || '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Keep parseMasterRows for any external callers (backwards compat)
function parseMasterRows(rows) {
  state.masterData = _deduplicateMaster(
    rows.map(r => parseMasterRow(r, SHEET_TABS.items))
  );
  _rebuildMasterIndex();
  if (typeof ERAS !== 'undefined' && _currentEra) { ERAS[_currentEra]._total = state.masterData.length; try { localStorage.setItem('lv_era_total_' + _currentEra, state.masterData.length); } catch(e) {} }
}

// ══════════════════════════════════════════════════════════════
// Fast master-data lookups (2026-04-14 perf pass)
//
// Was doing findMaster(X) ~77 places.
// Linear scan across 18K rows per call = noticeable lag when adding
// items. Now we index once on load and look up by item# in O(1).
//
// Also memoize getBoxVariations which is called 3x per add-flow.
// ══════════════════════════════════════════════════════════════
state.masterByItem = new Map();          // itemNum -> [master rows]
state._boxVarCache = new Map();          // itemNum -> cached getBoxVariations result

function _rebuildMasterIndex() {
  const m = new Map();
  const im = new Map();                  // v0.9.985 (perf): master row -> its index
  const rows = state.masterData || [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    im.set(r, i);                        // v0.9.985: O(1) replacement for masterData.indexOf
    const k = String(r.itemNum || '').trim();
    if (!k) continue;
    let bucket = m.get(k);
    if (!bucket) { bucket = []; m.set(k, bucket); }
    bucket.push(r);
  }
  state.masterByItem = m;
  state._masterIdxMap = im;              // v0.9.985: see _masterIdxOf below
  state._boxVarCache = new Map();        // bust box-variation cache on reindex
  // v0.9.985: master data changed — invalidate cached page renders.
  try { window._rrDataRev = (window._rrDataRev || 0) + 1; } catch (e) {}
  // Session 127: also build the per-era search index used by cross-scope
  // search. Fire-and-forget IDB write — never blocks the UI.
  if (typeof _writeSearchIndex === 'function') _writeSearchIndex();
}

// v0.9.985 (perf): O(1) lookup of a master row's index. Replaces 17 call
// sites that did state.masterData.indexOf(row) — a front-to-back scan of the
// whole catalog (up to 60K rows) PER ITEM, which made My Collection and the
// dashboard noticeably slow. The map is rebuilt alongside masterByItem every
// time the catalog loads, so it can never go stale. Falls back to indexOf if
// the map somehow isn't built yet (identical behavior, just slower).
function _masterIdxOf(m) {
  if (!m) return -1;
  const map = state._masterIdxMap;
  if (map) {
    const v = map.get(m);
    return v === undefined ? -1 : v;
  }
  return (state.masterData || []).indexOf(m);
}
if (typeof window !== 'undefined') window._masterIdxOf = _masterIdxOf;

// v0.9.985 (perf): cheap fingerprint of everything the browse / My Collection
// lists are built from. Used (together with window._rrDataRev) to answer "has
// anything changed since the last render?" — if not, the page keeps its
// existing DOM instead of rebuilding from scratch on every visit. Cost is
// proportional to the OWNED collection (hundreds), never the 60K catalog.
function _rrDataFingerprint() {
  let f = 0, n = 0;
  try {
    const pd = state.personalData || {};
    for (const k in pd) {
      n++;
      const p = pd[k];
      if (p) { f += (p._savedAt || 0) % 1e7; if (p.owned) f += 13; }
    }
    f += n * 1000003;
    f += Object.keys(state.soldData || {}).length * 7919;
    f += Object.keys(state.wantData || {}).length * 104729;
    f += Object.keys(state.isData || {}).length * 1299709;
    f += Object.keys(state.mySetsData || {}).length * 15485863;
    f += Object.keys(state.forSaleData || {}).length * 512927;
    const eph = state.ephemeraData || {};
    for (const t in eph) { f += Object.keys(eph[t] || {}).length * 999331; }
    f += (state.masterData || []).length;
  } catch (e) { return 'x' + Date.now(); }   // any error = treat as changed
  return f;
}
if (typeof window !== 'undefined') window._rrDataFingerprint = _rrDataFingerprint;

// ── Session 127 ─ Per-era search index for cross-scope search ───────────────
// Compact subset of fields written to IDB at lv_search_index_<era>, used by
// _crossScopeSearch() in app.js. Skipped in 'all' meta-era mode — the per-era
// indexes are built when each individual era is loaded.
function _writeSearchIndex() {
  if (typeof _currentEra === 'undefined' || _currentEra === 'all') return;
  if (!state.masterData || !state.masterData.length) return;
  const era = _currentEra;
  const rows = state.masterData;
  const compact = new Array(rows.length);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    compact[i] = {
      n: r.itemNum     || '',
      r: r.roadName    || '',
      d: r.description || '',
      t: r.itemType    || '',
      v: r.variation   || '',
      e: era,
    };
  }
  // Fire-and-forget — IDB writes shouldn't block UI flow.
  idbSet('lv_search_index_' + era, compact);
}

// Find first master row matching itemNum (+ optional variation). O(1) lookup.
// ── Catalog resolver ────────────────────────────────────────────────
// THE single source of truth for turning a collection item number into its
// catalog row. Collection numbers carry suffixes (204-P powered, 204-D dummy,
// 217C B-unit, NNNN-T trailer) but the catalog is indexed by the BASE number
// ("204", "217"). Some base numbers ALSO collide with unrelated items (205 is
// an Alco AND an accessory AND a science set), so when a suffix is present we
// score candidates: prefer motive-power entries and match the powered/dummy/
// B-unit/trailer role + variation. Always route catalog lookups through this.
function _mIsMotive(t) { return /diesel|electric|locomotive|motoriz/i.test(String(t || '')); }
function _mSuffix(num) { const m = String(num || '').trim().match(/-?([PDTC])$/i); return m ? m[1].toUpperCase() : ''; }
// ── v0.9.1198: the stored master key — WHICH catalog row an owned item is ──
// Format: era|itemNum|variation (e.g. "pw|2321|1"). Written by
// buildPersonalRow at save time (the wizard passes the user's confirmed
// match), read back on every personal row as pd.masterKey. A stored key makes
// the personal→catalog join a LOOKUP; every re-derivation is a fresh chance
// for a lookalike (Williams 2321, the "53" catalog) to claim the item.
function rrMasterKeyOf(m) {
  if (!m || !m.itemNum) return '';
  return String(m._era || '') + '|' + String(m.itemNum) + '|' + String(m.variation == null ? '' : m.variation).trim();
}
function rrMasterByKey(key) {
  if (!key || typeof key !== 'string') return null;
  var parts = key.split('|');
  if (parts.length < 2) return null;
  var era = parts[0], num = parts[1], vari = (parts.slice(2).join('|') || '').trim();
  function _scan(idx) {
    if (!idx) return null;
    var rows = idx.get(String(num).trim()) || [];
    for (var i = 0; i < rows.length; i++) {
      var m = rows[i];
      if (String(m._era || '') === era && String(m.variation == null ? '' : m.variation).trim() === vari) return m;
    }
    return null;
  }
  return _scan(state.masterByItem) || _scan(state.masterByItemAll) || null;
}
if (typeof window !== 'undefined') { window.rrMasterKeyOf = rrMasterKeyOf; window.rrMasterByKey = rrMasterByKey; }

function findMaster(itemNum, variation, prefer) {
  if (!itemNum) return null;
  // v0.9.732 (Brad's 4C, FINAL): when the caller passes the personal row as
  // `prefer` and that row is a MANUAL entry, there is no catalog identity —
  // ever. One guard here covers every display/lookup path at once.
  if (prefer && String(prefer.era || '') === 'Manual') return null;
  // v0.9.1198: a STORED key answers outright — no scoring, no guessing. Many
  // call sites already pass the personal row as `prefer`; rows saved from
  // v0.9.1198 on carry pd.masterKey, so those joins upgrade to lookups
  // automatically. Guarded by item number so a stale/foreign key can never
  // hand back a different item's row.
  if (prefer && prefer.masterKey) {
    var _byKey = rrMasterByKey(prefer.masterKey);
    if (_byKey && String(_byKey.itemNum).trim() === String(itemNum).trim()) return _byKey;
  }
  // v0.9.971 (Brad): ONE lookup, TWO layers. Layer 1 is the loaded (enabled-
  // era) index — byte-for-byte the old behavior, so nothing regresses. Only
  // on a total miss does Layer 2 answer: the FULL-catalog index covering every
  // era (built in the background below), so an MTH/Atlas/Weaver number
  // resolves even when those catalogs aren't in the user's collecting prefs.
  var _r = _findMasterCore(state.masterByItem, itemNum, variation, prefer);
  if (_r) return _r;
  if (state.masterByItemAll) _r = _findMasterCore(state.masterByItemAll, itemNum, variation, prefer);
  return _r || null;
}
function _findMasterCore(idx, itemNum, variation, prefer) {
  const k = String(itemNum).trim();
  const exact = (idx && idx.get(k)) || [];
  const suf = _mSuffix(k);
  // v0.9.648: optional third arg = the OWNED row (or {manufacturer, era}).
  // Cross-catalog numbers collide (Lionel MPC 8359 Chessie GP-7 vs Atlas 8359
  // WM hopper) — when the caller knows whose copy this is, prefer the catalog
  // row from that manufacturer/era instead of whichever loaded first.
  let _prefTab = null, _prefMfr = '';
  if (prefer) {
    _prefMfr = String(prefer.manufacturer || '').trim().toLowerCase();
    try {
      if (prefer.era && typeof ERA_TABS !== 'undefined' && ERA_TABS[prefer.era] && ERA_TABS[prefer.era].items) _prefTab = ERA_TABS[prefer.era].items;
    } catch (e) {}
  }
  function _prefBoost(m) {
    if (!prefer) return 0;
    let b = 0;
    const t = String(m._tab || '').toLowerCase();
    if (_prefTab && m._tab === _prefTab) b += 8;
    if (_prefMfr && t.indexOf(_prefMfr) === 0) b += 4;   // tabs start with the maker name
    return b;
  }
  // Non-suffixed item whose exact key exists = the common case → keep legacy
  // behavior exactly (variation match, else first) so nothing regresses —
  // unless a prefer hint is given and there are multiple candidates.
  if (!suf && exact.length) {
    if (variation != null && variation !== '') {
      const hit = exact.find(r => String(r.variation || '') === String(variation));
      if (hit) return hit;
    }
    if (prefer && exact.length > 1) {
      let bestE = exact[0], bsE = _prefBoost(exact[0]);
      for (let i = 1; i < exact.length; i++) { const s2 = _prefBoost(exact[i]); if (s2 > bsE) { bestE = exact[i]; bsE = s2; } }
      return bestE;
    }
    return exact[0];
  }
  // Build candidate pool = exact bucket + base bucket (for suffixed/missing).
  let cands = exact.slice();
  if (typeof baseItemNum === 'function') {
    const bk = baseItemNum(k);
    if (bk && bk !== k) {
      ((idx && idx.get(bk)) || []).forEach(b => { if (cands.indexOf(b) < 0) cands.push(b); });
    }
  }
  // MPC / modern Lionel carry a single-digit product-line prefix ("6-8359",
  // "7-11193") but the master indexes the bare number ("8359"). Strip a leading
  // "N-" so Lens / typed entries resolve. Postwar "6464-1" is NOT affected (that
  // is not an "N-" prefix). Also try the suffix-base of the stripped number.
  const _mpc = k.replace(/^\d-/, '');
  if (_mpc && _mpc !== k) {
    ((idx && idx.get(_mpc)) || []).forEach(b => { if (cands.indexOf(b) < 0) cands.push(b); });
    if (typeof baseItemNum === 'function') { const _mb = baseItemNum(_mpc); if (_mb && _mb !== _mpc) ((idx && idx.get(_mb)) || []).forEach(b => { if (cands.indexOf(b) < 0) cands.push(b); }); }
  }
  if (!cands.length) return null;
  const want = (variation != null && variation !== '') ? String(variation) : null;
  function score(m) {
    let sc = 0;
    if (suf) {
      if (_mIsMotive(m.itemType)) sc += 4;
      if (suf === 'P' && (m.poweredDummy === 'P' || m.unit === 'A')) sc += 2;
      else if (suf === 'D' && m.poweredDummy === 'D') sc += 2;
      else if (suf === 'C' && m.unit === 'B') sc += 2;
      else if (suf === 'T' && (m.unit === 'T' || m.poweredDummy === 'T')) sc += 2;
    }
    if (want != null && String(m.variation || '') === want) sc += 1;
    sc += _prefBoost(m);   // v0.9.648
    return sc;
  }
  let best = cands[0], bestS = score(cands[0]);
  for (let i = 1; i < cands.length; i++) { const sc = score(cands[i]); if (sc > bestS) { best = cands[i]; bestS = sc; } }
  return best;
}

// v0.9.971 (Brad): merged bucket across the loaded index AND the full-catalog
// index, deduped by identity (itemNum|variation|tab) so an era cached in both
// doesn't list twice. Loaded rows come first (they carry any in-session edits).
function _mbAllGet(k) {
  const a = (state.masterByItem && state.masterByItem.get(k)) || [];
  const extra = (state.masterByItemAll && state.masterByItemAll.get(k)) || [];
  if (!extra.length) return a;
  const out = a.slice(), seen = {};
  out.forEach(function (r) { seen[(r.itemNum || '') + '|' + (r.variation || '') + '|' + (r._tab || '')] = 1; });
  extra.forEach(function (r) {
    const s = (r.itemNum || '') + '|' + (r.variation || '') + '|' + (r._tab || '');
    if (!seen[s]) { seen[s] = 1; out.push(r); }
  });
  return out;
}
window._mbAllGet = _mbAllGet;

// Return ALL master rows for a given itemNum. O(1) lookup.
function findAllMaster(itemNum) {
  if (!itemNum) return [];
  const k = String(itemNum).trim();
  let b = _mbAllGet(k);
  if (!b.length && typeof baseItemNum === 'function') {
    const bk = baseItemNum(k);
    if (bk && bk !== k) b = _mbAllGet(bk);
  }
  return b;
}
window.findMaster = findMaster;
window.findAllMaster = findAllMaster;

// ── v0.9.971 (Brad): the FULL-CATALOG lookup index ──────────────────────────
// Display stays filtered to the eras the user collects (fast startup, no
// clutter in browse), but LOOKUPS consult this index of EVERY era, so "what
// is this number?" always has the whole catalog to answer from — the Photo
// Inbox, wizard, barcode, and Research all read off these same instructions.
// Built in the background from the per-era IDB caches; an era with no cache
// yet (a brand the user doesn't collect) is fetched once from the sheet and
// cached like any other era, so later builds are instant.
var _allIdxBuiltAt = 0, _allIdxBuilding = false;
async function _buildAllErasLookupIndex(force) {
  if (_allIdxBuilding) return;
  if (!force && _allIdxBuiltAt && (Date.now() - _allIdxBuiltAt) < 10 * 60 * 1000) return;
  _allIdxBuilding = true;
  try {
    var eras = (typeof REAL_ERA_IDS !== 'undefined' && Array.isArray(REAL_ERA_IDS))
      ? REAL_ERA_IDS.slice()
      : ['pw', 'mpc', 'prewar', 'atlas', 'mth_o', 'mth_ho', 'mth_s', 'mth_tinplate', 'mth_g'];
    var map = new Map(), rowsAll = [], seen = {};
    function add(rows, era) {
      if (!Array.isArray(rows)) return;
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i]; if (!r) continue;
        var k = String(r.itemNum || '').trim(); if (!k) continue;
        var sig = k + '|' + String(r.variation || '') + '|' + String(r._tab || '') + '|' + String(r._era || era || '');
        if (seen[sig]) continue; seen[sig] = 1;
        if (!r._era && era) r._era = era;
        var b = map.get(k); if (!b) { b = []; map.set(k, b); } b.push(r);
        rowsAll.push(r);
      }
    }
    add(state.masterData, null);          // loaded rows first — they carry live edits
    var missing = [];
    for (var i2 = 0; i2 < eras.length; i2++) {
      var era2 = eras[i2], cached = null;
      try { cached = await idbGet('lv_master_cache_' + era2); } catch (e) {}
      if (Array.isArray(cached) && cached.length) add(cached, era2);
      else missing.push(era2);
    }
    // Publish what we have NOW — lookups start working before any fetches.
    state.masterByItemAll = map;
    state.masterAllRows = rowsAll;
    _allIdxBuiltAt = Date.now();
    // One-time fetch for eras never loaded on this device (e.g. MTH for a
    // Lionel-only collector). Cached to IDB so this doesn't repeat.
    for (var j = 0; j < missing.length; j++) {
      var e2 = missing[j];
      try {
        if (typeof _fetchMasterTabs !== 'function') break;
        var fresh = await _fetchMasterTabs(e2);
        if (fresh && fresh.length) {
          var ded = (typeof _deduplicateMaster === 'function') ? _deduplicateMaster(fresh) : fresh;
          idbSet('lv_master_cache_' + e2, ded);
          try { localStorage.setItem('lv_master_cache_ts_' + e2, Date.now().toString()); } catch (eT) {}
          add(ded, e2);
        }
      } catch (eF) { console.warn('[lookup-index] fetch ' + e2 + ' failed:', eF && eF.message); }
    }
    state.masterByItemAll = map;
    state.masterAllRows = rowsAll;
    _allIdxBuiltAt = Date.now();
    console.log('[lookup-index] full catalog ready: ' + map.size + ' numbers / ' + rowsAll.length + ' rows');
  } finally { _allIdxBuilding = false; }
}
function _scheduleLookupIndex(delayMs, force) {
  try {
    setTimeout(function () {
      _buildAllErasLookupIndex(force).catch(function (e) { console.warn('[lookup-index]', e); });
    }, delayMs || 4000);
  } catch (e) {}
}
window._buildAllErasLookupIndex = _buildAllErasLookupIndex;
window._scheduleLookupIndex = _scheduleLookupIndex;

// Tripwire: after data loads, warn (quietly, to the console) if any owned item
// fails to resolve to a catalog entry — so a future suffix/grouping gap surfaces
// instead of silently leaving blank Type/Description/Road. Runs once per session.
var _catalogAuditDone = false;
function _auditCatalogResolution() {
  if (_catalogAuditDone) return;
  try {
    if (typeof state === 'undefined' || !state.personalData || typeof findMaster !== 'function') return;
    if (!state.masterData || !state.masterData.length) return; // catalog not loaded yet — try again next build
    var owned = Object.values(state.personalData).filter(function (pd) {
      return pd && pd.owned && pd.itemNum && !(typeof _isBoxItemNum === 'function' && _isBoxItemNum(pd.itemNum));
    });
    if (!owned.length) return;
    var bad = owned.filter(function (pd) { return !findMaster(pd.itemNum, pd.variation, pd); });
    _catalogAuditDone = true;
    if (bad.length) {
      console.warn('[Catalog Audit] ' + bad.length + ' owned item(s) did NOT resolve to a catalog entry (Type/Description/Road will be blank): ' + bad.slice(0, 25).map(function (p) { return p.itemNum; }).join(', '));
    } else {
      console.log('[Catalog Audit] OK — all ' + owned.length + ' owned items resolve to the catalog.');
    }
  } catch (e) { console.warn('[Catalog Audit] check failed:', e); }
}
window._auditCatalogResolution = _auditCatalogResolution;
window._rebuildMasterIndex = _rebuildMasterIndex;

async function loadCatalogRefData() {
  // Fetch Catalogs tab from master sheet — used by paper item wizard for searchable picker
  // Columns: A=Catalog ID, B=Year, C=Type, D=Title, E=Has Envelope/Mailer, F=Notes, G=Description
  if (_currentEra === 'all') return; // 'all' is handled by app.js orchestrator
  const CACHE_KEY = 'lv_catalog_ref_cache_' + _currentEra;
  const CACHE_TS  = 'lv_catalog_ref_ts_'  + _currentEra;
  const TTL = 24 * 60 * 60 * 1000; // 24 hours
  const cached = localStorage.getItem(CACHE_KEY);
  const cachedAt = parseInt(localStorage.getItem(CACHE_TS) || '0');
  if (cached && (Date.now() - cachedAt) < TTL) {
    try { state.catalogRefData = JSON.parse(cached); return; } catch(e) {}
  }
  try {
    let res;
    if (!SHEET_TABS.catalogs) { state.catalogRefData = []; return; }
    try { res = await sheetsGet(state.masterSheetId, SHEET_TABS.catalogs + '!A2:G'); }
    catch(_) { res = await sheetsGet(state.masterSheetId, 'catalogs!A2:G'); }
    const rows = (res && res.values) || [];
    state.catalogRefData = rows
      .filter(r => r[0] && r[3] && r[0] !== 'Catalog ID') // skip header/empty
      .map(r => ({
        id:          String(r[0] || ''),
        year:        String(r[1] || ''),
        type:        String(r[2] || ''),
        title:       String(r[3] || ''),
        description: String(r[6] || ''),
      }));
    localStorage.setItem(CACHE_KEY, JSON.stringify(state.catalogRefData));
    localStorage.setItem(CACHE_TS, Date.now().toString());
  } catch(e) {
    console.warn('loadCatalogRefData:', e);
    state.catalogRefData = [];
  }
}

async function loadISRefData() {
  if (_currentEra === 'all') return; // 'all' handled by orchestrator
  if (!SHEET_TABS.instrSheets) { state.isRefData = []; return; }
  // Fetch Instruction Sheets tab from master sheet
  // Columns: A=IS ID, B=Item Number, C=Description, D=Category, E=Variations, F=Notes
  const CACHE_KEY = 'lv_is_ref_cache_' + _currentEra;
  const CACHE_TS  = 'lv_is_ref_ts_'  + _currentEra;
  const TTL = 24 * 60 * 60 * 1000;
  const cached = localStorage.getItem(CACHE_KEY);
  const cachedAt = parseInt(localStorage.getItem(CACHE_TS) || '0');
  if (cached && (Date.now() - cachedAt) < TTL) {
    try { state.isRefData = JSON.parse(cached); return; } catch(e) {}
  }
  // Try multiple possible tab names (full name, Excel-truncated 31-char, legacy short name)
  const _isTabNames = [
    SHEET_TABS.instrSheets,
    'Instruction Sheets',
  ];
  let res = null;
  for (const tabName of _isTabNames) {
    try { res = await sheetsGet(state.masterSheetId, tabName + '!A2:F'); break; }
    catch(_) { /* tab doesn't exist with this name, try next */ }
  }
  if (!res) {
    // Tab doesn't exist yet — cache empty result so we don't retry for 24h
    state.isRefData = [];
    localStorage.setItem(CACHE_KEY, JSON.stringify([]));
    localStorage.setItem(CACHE_TS, Date.now().toString());
    return;
  }
  try {
    const rows = (res && res.values) || [];
    state.isRefData = rows
      .filter(r => r[0] && r[2] && r[0] !== 'Instruction Sheet ID')
      .map(r => ({
        id:          String(r[0] || ''),
        itemNumber:  String(r[1] || ''),
        description: String(r[2] || ''),
        category:    String(r[3] || ''),
        variations:  String(r[4] || ''),
        notes:       String(r[5] || ''),
      }));
    localStorage.setItem(CACHE_KEY, JSON.stringify(state.isRefData));
    localStorage.setItem(CACHE_TS, Date.now().toString());
  } catch(e) {
    state.isRefData = [];
  }
}

async function loadSetData() {
  if (_currentEra === 'all') return; // 'all' handled by orchestrator
  const SET_CACHE = 'lv_set_cache_' + _currentEra;
  const SET_TS    = 'lv_set_cache_ts_'  + _currentEra;
  try {
    const cached = localStorage.getItem(SET_CACHE);
    const cachedAt = parseInt(localStorage.getItem(SET_TS) || '0');
    if (cached && (Date.now() - cachedAt) < 24*60*60*1000) {
      state.setData = JSON.parse(cached);
      // Background refresh — skip during all-eras orchestration to
      // avoid the late .then() clobbering another era's slice.
      if (!window._skipBackgroundRefresh) {
        (SHEET_TABS.sets ? sheetsGet(state.masterSheetId, SHEET_TABS.sets + '!A2:U').catch(() => sheetsGet(state.masterSheetId, 'Master Set list!A2:U')) : Promise.resolve({values:[]})).then(res => {
          if (res && res.values) {
            parseSetRows(res.values);
            try { localStorage.setItem(SET_CACHE, JSON.stringify(state.setData));
                  localStorage.setItem(SET_TS, Date.now().toString()); } catch (e) { /* quota — skip cache */ }
          }
        }).catch(() => {});
      }
      return;
    }
    let res;
    if (!SHEET_TABS.sets) { state.setData = []; return; }
    try { res = await sheetsGet(state.masterSheetId, SHEET_TABS.sets + '!A2:U'); }
    catch(_) { res = await sheetsGet(state.masterSheetId, 'Master Set list!A2:U'); }
    parseSetRows((res && res.values) || []);
    localStorage.setItem(SET_CACHE, JSON.stringify(state.setData));
    localStorage.setItem(SET_TS, Date.now().toString());
  } catch(e) { console.warn('loadSetData:', e); state.setData = []; }
}

async function loadCompanionData() {
  if (_currentEra === 'all') return; // 'all' handled by orchestrator
  const COMP_CACHE = 'lv_companion_cache_' + _currentEra;
  const COMP_TS    = 'lv_companion_cache_ts_'  + _currentEra;
  try {
    const cached = localStorage.getItem(COMP_CACHE);
    const cachedAt = parseInt(localStorage.getItem(COMP_TS) || '0');
    if (cached && (Date.now() - cachedAt) < 24*60*60*1000) {
      state.companionData = JSON.parse(cached);
      if (!window._skipBackgroundRefresh) {
        (SHEET_TABS.companions ? sheetsGet(state.masterSheetId, SHEET_TABS.companions + '!A2:E').catch(() => sheetsGet(state.masterSheetId, 'Companions!A2:E')) : Promise.resolve({values:[]})).then(res => {
          if (res && res.values) {
            parseCompanionRows(res.values);
            try { localStorage.setItem(COMP_CACHE, JSON.stringify(state.companionData));
                  localStorage.setItem(COMP_TS, Date.now().toString()); } catch (e) { /* quota — skip cache */ }
          }
        }).catch(() => {});
      }
      return;
    }
    let res;
    if (!SHEET_TABS.companions) { state.companionData = []; return; }
    try { res = await sheetsGet(state.masterSheetId, SHEET_TABS.companions + '!A2:E'); }
    catch(_) { res = await sheetsGet(state.masterSheetId, 'Companions!A2:E'); }
    parseCompanionRows((res && res.values) || []);
    localStorage.setItem(COMP_CACHE, JSON.stringify(state.companionData));
    localStorage.setItem(COMP_TS, Date.now().toString());
  } catch(e) { console.warn('loadCompanionData:', e); state.companionData = []; }
}

function parseCompanionRows(rows) {
  state.companionData = rows
    .filter(r => r[0] && r[2])
    .map(r => ({
      engineNum:     String(r[0] || '').trim(),
      engineVar:     String(r[1] || '').trim(),
      companionNum:  String(r[2] || '').trim(),
      companionType: String(r[3] || '').trim(),
      notes:         String(r[4] || '').trim(),
    }));
}

function parseSetRows(rows) {
  state.setData = rows
    .filter(r => r[0])
    .map(r => ({
      setNum:      String(r[0]  || '').trim(),
      setName:     String(r[1]  || '').trim(),
      year:        String(r[2]  || '').trim(),
      gauge:       String(r[3]  || '').trim(),
      price:       String(r[4]  || '').trim(),
      steam:       String(r[5]  || '').trim(),
      tender:      String(r[6]  || '').trim(),
      dieselPow:   String(r[7]  || '').trim(),
      dieselB:     String(r[8]  || '').trim(),
      dieselDummy: String(r[9]  || '').trim(),
      // All component item numbers in one flat array (cols F–T)
      items:    [r[5],r[6],r[7],r[8],r[9],r[10],r[11],r[12],r[13],r[14],r[15],r[16],r[17],r[18],r[19]]
                  .map(v => String(v == null ? '' : v).trim()).filter(Boolean),
      alts:     [],   // no longer used — all components are in items[]
      notes:    String(r[20] || '').trim(),
    }));
}

// Find sets that match a list of item numbers (for set suggestion)
function suggestSets(enteredItems) {
  if (!enteredItems.length) return [];
  const norm = n => normalizeItemNum((n||'').trim());
  return state.setData
    .map(s => {
      const allItems = s.items;
      const allAlts  = s.alts;
      let primaryMatches = 0, altMatches = 0, matchedAlts = [];
      enteredItems.forEach(ei => {
        const en = norm(ei);
        const eb = baseItemNum(ei);
        if (allItems.some(si => norm(si) === en || baseItemNum(si) === eb)) {
          primaryMatches++;
        } else if (allAlts.some(ai => norm(ai) === en || baseItemNum(ai) === eb)) {
          altMatches++;
          matchedAlts.push(ei);
        }
      });
      const total = primaryMatches + altMatches;
      return { ...s, primaryMatches, altMatches, matchedAlts, total };
    })
    .filter(s => s.total >= 1)
    .sort((a, b) => b.total - a.total || b.primaryMatches - a.primaryMatches)
    .slice(0, 5);
}

async function loadPersonalData() {
  if (!state.personalSheetId) {
    state.personalSheetId = localStorage.getItem('lv_personal_id');
  }
  if (!state.personalSheetId) return;

  // Cache schema version. Bump this whenever the on-disk shape of any field
  // in lv_personal_cache changes so old caches are skipped (Session 161+: the
  // Want-Upgrade combined tab introduced new state.wantData/upgradeData shapes
  // with a listType field).
  const _PERSONAL_CACHE_VER = (typeof PERSONAL_CACHE_VER !== 'undefined' ? PERSONAL_CACHE_VER : 'wu1');
  const _pcacheVer = localStorage.getItem('lv_personal_cache_ver') || '';
  if (_pcacheVer !== _PERSONAL_CACHE_VER) {
    // Old cache predates the current schema — drop it so we fetch fresh.
    localStorage.removeItem('lv_personal_cache');
    localStorage.removeItem('lv_personal_cache_ts');
    localStorage.setItem('lv_personal_cache_ver', _PERSONAL_CACHE_VER);
    console.log('[Cache] Personal cache version mismatch, cleared (was', JSON.stringify(_pcacheVer), 'now', _PERSONAL_CACHE_VER + ')');
  }
  // Use cached personal data for instant load (2 hour TTL)
  const _pcache = localStorage.getItem('lv_personal_cache');
  const _ptime  = parseInt(localStorage.getItem('lv_personal_cache_ts') || '0');
  const _PAGE_TTL    = 2 * 60 * 60 * 1000; // 2 hours
  const _BG_REFRESH  = 5 * 60 * 1000;      // background refresh throttle: 5 min
  // v0.9.826 (TODO-003): ALWAYS restore the last-saved snapshot first —
  // whatever its age — then refresh in the background when online. The old
  // 2-hour gate left the screen empty at a weekend train show (and made every
  // cold start wait on Google).
  if (_pcache) {
    try {
      const _pd = JSON.parse(_pcache);
      state.personalData  = _pd.personalData  || {};
      state.soldData      = _pd.soldData      || {};
      state.forSaleData   = _pd.forSaleData   || {};
      state.wantData      = _pd.wantData      || {};
      state.isData        = _pd.isData        || {};
      state.scienceData   = _pd.scienceData   || {};
      state.constructionData = _pd.constructionData || {};
      state.ephemeraData  = _pd.ephemeraData  || { catalogs:{}, paper:{}, mockups:{}, other:{} };
      state.mySetsData   = _pd.mySetsData   || {};
      // v0.9.827: Parts + Contacts restore from the phone snapshot too.
      state.partsData    = _pd.partsData    || state.partsData    || {};
      state.contactsData = _pd.contactsData || state.contactsData || [];
      setTimeout(function () { try { if (typeof _updatePartsBadge === 'function') _updatePartsBadge(); } catch (e) {} }, 500);
      // Audit M2: restore user-defined tabs (custom buckets disappeared on
      // cache-hit reload until next sheet refetch).
      if (_pd.userDefinedTabs && Array.isArray(_pd.userDefinedTabs)) {
        state.userDefinedTabs = _pd.userDefinedTabs;
      }
      // Session 159 Phase 2g: restore upgrade + byInv maps from cache too.
      // Without this, the cache-hit fast path returned early without populating
      // upgradeData, leaving badges broken until the user did something that
      // re-fetched the sheet.
      state.upgradeData  = _pd.upgradeData  || {};
      // Phase 3: forSaleData + upgradeData are now keyed by inventoryId
      // directly. If we restored an OLD cache snapshot (composite keys),
      // rebuild as inventoryId-keyed so readers don't see legacy keys.
      function _reKeyByInv(map) {
        var out = {};
        Object.values(map || {}).forEach(function(e) {
          if (!e) return;
          var k = e.inventoryId || ('legacy-row-' + (e.row || Math.random().toString(36).slice(2)));
          out[k] = e;
        });
        return out;
      }
      var _fsKeys = Object.keys(state.forSaleData || {});
      if (_fsKeys.some(function(k){ return k.indexOf('|') >= 0; })) {
        state.forSaleData = _reKeyByInv(state.forSaleData);
      }
      var _ugKeys = Object.keys(state.upgradeData || {});
      if (_ugKeys.some(function(k){ return k.indexOf('|') >= 0; })) {
        state.upgradeData = _reKeyByInv(state.upgradeData);
      }
      // v0.9.836 (BUG-006, Brad's phone-still-shows-it): a COLD page load
      // always background-refreshes, whatever the snapshot's age — reloading
      // is how users ask "check again" after changing things on another
      // device. The 5-minute throttle now only applies to repeat loads
      // within the same running session. Never refresh while offline.
      if (window._offlineMode) {
        console.log('[Cache] offline mode — snapshot only, no refresh');
      } else if (!window._pdColdRefreshed || (Date.now() - _ptime) > _BG_REFRESH) {
        window._pdColdRefreshed = true;
        _loadPersonalFromSheets(state.personalSheetId).then(() => {
          _cachePersonalData();
          buildDashboard();
          renderBrowse();
        }).catch(() => {});
      } else if (!window._offlineMode) {
        // Phase 3b: ALWAYS refresh forSale + upgrade after cache restore.
        // These are small lookup tables; if the cache has stale (or empty)
        // entries from a failed prior fetch, we need fresh data immediately
        // so badges render correctly on first paint.
        Promise.all([
          sheetsGet(state.personalSheetId, 'For Sale!A3:J').catch(() => null),
          sheetsGet(state.personalSheetId, 'Want-Upgrade List!A3:I').catch(() => null),
        ]).then(function(results) {
          var fsRes = results[0];
          var ugRes = results[1];
          var changed = false;
          if (fsRes && fsRes.values) {
            var newFs = {};
            fsRes.values.forEach(function(r, idx) {
              if (!r[0] || r[0] === 'Item Number') return;
              var row = idx + 3;
              // Phase 3j parity: coerce UNFORMATTED_VALUE numeric returns to String.
              // Without this, variation/itemNum/condition can be numbers and
              // any downstream .replace() / .toUpperCase() throws.
              var _s = function(v) { return (v !== null && v !== undefined && v !== '') ? String(v) : ''; };
              var entry = {
                row: row, itemNum: _s(r[0]), variation: _s(r[1]),
                condition: _s(r[2]), askingPrice: _s(r[3]), dateListed: _s(r[4]),
                notes: _s(r[5]), originalPrice: _s(r[6]), estWorth: _s(r[7]),
                inventoryId: _s(r[8]),
                manufacturer: _s(r[9]) || 'Lionel',
              };
              newFs[entry.inventoryId || ('legacy-row-' + row)] = entry;
            });
            // Audit NEW #5 fix: merge instead of wholesale replace. Preserve
            // any optimistic entries (row=99999) that a user-initiated save
            // added between the cache restore and this background fetch.
            Object.keys(state.forSaleData || {}).forEach(function(k) {
              var e = state.forSaleData[k];
              if (e && e.row === 99999 && !newFs[k]) newFs[k] = e;
            });
            state.forSaleData = newFs;
            changed = true;
          }
          if (ugRes && ugRes.values) {
            // Want-Upgrade combined: same fetch returns BOTH Want and Upgrade
            // rows. Split into newUg + newWant and refresh both state slices.
            var newUg = {};
            var newWant = {};
            ugRes.values.forEach(function(r, idx) {
              if (!r[0] || r[0] === 'Item Number') return;
              var row = idx + 3;
              // Phase 3j parity: coerce to String to survive UNFORMATTED_VALUE numerics.
              var _us = function(v) { return (v !== null && v !== undefined && v !== '') ? String(v) : ''; };
              var listType = _us(r[2]).toLowerCase();
              if (listType === 'upgrade') {
                var entry = {
                  row: row, itemNum: _us(r[0]), variation: _us(r[1]),
                  priority: _us(r[3]) || 'Medium', targetCondition: _us(r[5]),
                  maxPrice: _us(r[4]),  // Target Price column
                  notes: _us(r[7]),
                  inventoryId: _us(r[6]),  // Upgrading Inventory ID column
                  manufacturer: _us(r[8]) || 'Lionel',
                  listType: 'Upgrade',
                };
                newUg[entry.inventoryId || ('legacy-row-' + row)] = entry;
              } else {
                // Want (or empty/unknown defaults to Want)
                var wantKey = _us(r[0]) + '|' + _us(r[1]);
                newWant[wantKey] = {
                  row: row, itemNum: _us(r[0]), variation: _us(r[1]),
                  priority: _us(r[3]) || 'Medium',
                  expectedPrice: _us(r[4]),  // Target Price -> expectedPrice
                  targetCondition: _us(r[5]),  // Brad: keep Target on Want
                  notes: _us(r[7]),
                  manufacturer: _us(r[8]) || 'Lionel',
                  listType: 'Want',
                };
              }
            });
            // Audit NEW #5 fix: preserve optimistic 99999 entries on merge.
            Object.keys(state.upgradeData || {}).forEach(function(k) {
              var e = state.upgradeData[k];
              if (e && e.row === 99999 && !newUg[k]) newUg[k] = e;
            });
            state.upgradeData = newUg;
            // Also refresh wantData from the same fetch (combined tab).
            Object.keys(state.wantData || {}).forEach(function(k) {
              var e = state.wantData[k];
              if (e && e.row === 99999 && !newWant[k]) newWant[k] = e;
            });
            state.wantData = newWant;
            changed = true;
          }
          if (changed) {
            console.log('[Phase 3b] forSale + upgrade fresh-fetch:',
              Object.keys(state.forSaleData||{}).length, 'fs,',
              Object.keys(state.upgradeData||{}).length, 'ug');
            // v0.9.710 (Brad's stale-forever loop): this snapshot carries the
            // OLD personalData — re-stamping the freshness timestamp here reset
            // the 5-minute clock on every reload, so frequent refreshers NEVER
            // hit the full re-fetch. Snapshot the data, keep the old clock.
            var _p3bTs = localStorage.getItem('lv_personal_cache_ts');
            _cachePersonalData();
            if (_p3bTs) localStorage.setItem('lv_personal_cache_ts', _p3bTs);
            if (typeof buildDashboard === 'function') buildDashboard();
            if (typeof renderBrowse === 'function') renderBrowse();
          }
        }).catch(function(e) { console.warn('[Phase 3b] post-cache refresh failed:', e && e.message); });
      }
      return;
    } catch(e) {}
  }

  ensureEphemeraSheets(state.personalSheetId).catch(() => {});
  await ensurePersonalHeaders(state.personalSheetId).catch(() => {});
  await _loadPersonalFromSheets(state.personalSheetId);
  _cachePersonalData();
}

function _cachePersonalData() {
  try {
    const _snap = {
      personalData: state.personalData,
      soldData: state.soldData,
      forSaleData: state.forSaleData,    // Phase 3 — keyed by inventoryId
      wantData: state.wantData,
      upgradeData: state.upgradeData,    // Phase 3 — keyed by inventoryId
      isData: state.isData,
      scienceData: state.scienceData,
      constructionData: state.constructionData,
      ephemeraData: state.ephemeraData,
      mySetsData: state.mySetsData,
      partsData: state.partsData || {},        // v0.9.827: offline snapshot
      contactsData: state.contactsData || [],  // v0.9.827: offline snapshot
      userDefinedTabs: state.userDefinedTabs || [], // Audit M2: persist user-defined tabs
    };
    localStorage.setItem('lv_personal_cache', JSON.stringify(_snap));
    localStorage.setItem('lv_personal_cache_ts', Date.now().toString());
  } catch(e) {
    // Audit M8: surface localStorage quota errors. iOS Safari and quota-limited
    // browsers fail silently here — Brad has reported "the app keeps re-fetching
    // every time" symptoms that trace back to this swallow.
    console.warn('[cache write failed]', e && e.message);
  }
}

async function _loadPersonalFromSheets(sheetId, forceOverwrite) {
  // Use temporary objects — only commit to state if fetch succeeds
  // This prevents a failed/slow fetch from wiping items that were just saved
  const newPersonal = {};
  const newSold     = {};
  const newWant     = {};
  const newIsData   = {};
  const newScienceData = {};
  const newConstructionData = {};
  const newEphemera = { catalogs:{}, paper:{}, mockups:{}, other:{} };
  const newForSale = {};
  const newMySetsData = {};

  // Perf 2026-04-14 (Phase B): split into primary + secondary fetches.
  // Primary tabs (5) are needed immediately for dashboard + list pages.
  // Secondary tabs (8) are loaded after primary commits state so UI renders
  // faster. Total wait time drops from max-of-13-fetches to max-of-5.
  const [collRes, soldRes, forSaleRes, wishlistRes] = await Promise.all([
    // v0.9.989 (unified inventory Phase 1): read range is schema-driven. The old
    // hardcoded A3:AF (32 cols) silently DROPPED the last 3 schema columns —
    // gauge, dateAdded, purchasedFrom were saved but never loaded (why the
    // Date Added column always showed "—").
    sheetsGet(sheetId, PERSONAL_TAB + '!A3:' + personalColLetter(PERSONAL_SCHEMA[PERSONAL_SCHEMA.length - 1].field)).catch((e) => { console.warn('[My Collection load failed]', e && e.message); return {values:[], _failed:true}; }),
    sheetsGet(sheetId, 'Sold!A3:T').catch((e) => { console.warn('[Sold load failed]', e && e.message); return {values:[], _failed:true}; }),
    sheetsGet(sheetId, 'For Sale!A3:J').catch((e) => { console.warn('[For Sale load failed]', e && e.message); return {values:[], _failed:true}; }),
    sheetsGet(sheetId, 'Want-Upgrade List!A3:I').catch((e) => { console.warn('[Want-Upgrade load failed]', e && e.message); return {values:[], _failed:true}; }),
  ]);
  // Secondary tabs fire off in parallel, NOT awaited in the main flow
  const _secondaryFetch = Promise.all([
    // v0.9.992 (unified inventory Phase 5): the four ephemera tabs are
    // LEGACY-renamed and their items live in My Collection now — skip the
    // fetches entirely (they only produced a failed request + console noise
    // per tab per load). Positions kept so the destructure below is unchanged.
    Promise.resolve({values:[]}),   // Catalogs — retired (unified inventory)
    Promise.resolve({values:[]}),   // Paper Items — retired (unified inventory)
    Promise.resolve({values:[]}),   // Mock-Ups — retired (unified inventory)
    Promise.resolve({values:[]}),   // Other Lionel — retired (unified inventory)
    sheetsGet(sheetId, 'Instruction Sheets!A3:K').catch((e) => { console.warn('[Instruction Sheets load failed]', e && e.message); return {values:[], _failed:true}; }),
    sheetsGet(sheetId, 'Science Sets!A3:O').catch((e) => { console.warn('[Science Sets load failed]', e && e.message); return {values:[], _failed:true}; }),
    sheetsGet(sheetId, 'Construction Sets!A3:O').catch((e) => { console.warn('[Construction Sets load failed]', e && e.message); return {values:[], _failed:true}; }),
    sheetsGet(sheetId, 'My Sets!A3:N').catch((e) => { console.warn('[My Sets load failed]', e && e.message); return {values:[], _failed:true}; }),
    // v0.9.827 (Brad): Parts + Contacts join the offline snapshot — small
    // lists you want at a train show (part numbers, dealer phone numbers).
    sheetsGet(sheetId, 'Parts Needed!A3:H').catch((e) => { console.warn('[Parts Needed load failed]', e && e.message); return {values:[], _failed:true}; }),
    sheetsGet(sheetId, 'Contacts!A2:P').catch((e) => { console.warn('[Contacts load failed]', e && e.message); return {values:[], _failed:true}; }),
  ]);
  // Defaults — overwritten once the secondary promise resolves below
  let catRes={values:[]}, paperRes={values:[]}, mockRes={values:[]},
      otherRes={values:[]}, isRes={values:[]}, sciRes={values:[]},
      conRes={values:[]}, mySetsRes={values:[]};

  // My Collection (Session 155 v11: schema-driven parser)
  (collRes.values || []).forEach((r, idx) => {
    const itemNumCol = PERSONAL_FIELD_INDEX.itemNum;
    if (!r[itemNumCol] || r[itemNumCol] === 'Item Number') return;
    const rowNum = idx + 3;
    const invIdCol = PERSONAL_FIELD_INDEX.inventoryId;
    const varCol = PERSONAL_FIELD_INDEX.variation;
    const _invId = r[invIdCol] || '';
    let key = _invId || `${r[itemNumCol]}|${r[varCol] || ''}|${rowNum}`;
    // Bug 14 (Session 154): a box row can carry the SAME Inventory ID as its
    // parent item — disambiguate on collision so both survive.
    //
    // v0.9.1250: disambiguate on the ITEM NUMBER, not the row number.
    // A ROW NUMBER IS A POSITION, NOT AN IDENTITY. It changes the moment
    // anything above it is deleted, and this key is cached to localStorage —
    // so a key built from a row number silently starts naming a DIFFERENT
    // item after the next deletion. That is the same bug that blanked the
    // wrong box record (v0.9.1239) and moved the wrong copy's photos, and it
    // was still armed here: it fires whenever a -BOX row carries its parent's
    // Inventory ID, which is exactly the case this branch exists for.
    // The colliding rows are a parent and its -BOX/-MBOX companion, so the
    // item number tells them apart — and keeps telling them apart forever.
    if (newPersonal[key]) {
      const _tag = String(r[itemNumCol] || '').trim().toUpperCase();
      let _alt = _tag ? key + '|' + _tag : key;
      if (!_tag || newPersonal[_alt]) {
        // Two rows sharing an Inventory ID AND an item number are genuinely
        // ambiguous — that is a problem in the sheet, not something code can
        // resolve. Keep both rows rather than dropping one, but say so: a
        // silent collision here is how a copy goes missing from the list.
        console.warn('[personal] two rows share Inventory ID "' + key +
          '" and item number "' + (_tag || '(blank)') + '" — rows ' +
          ((newPersonal[_alt] && newPersonal[_alt].row) || '?') + ' and ' + rowNum +
          '. Give one of them its own Inventory ID.');
        _alt = key + '|' + _tag + '|' + rowNum;
      }
      key = _alt;
    }
    const obj = { row: rowNum, status: 'Owned', owned: true };
    PERSONAL_SCHEMA.forEach((s, i) => {
      // Phase 3j: coerce to string. UNFORMATTED_VALUE returns numbers/dates raw,
      // but the rest of the app assumes string fields (e.g. .replace() on variation).
      obj[s.field] = (r[i] !== null && r[i] !== undefined && r[i] !== '') ? String(r[i]) : '';
    });
    // Special: quickEntry stored as 'Yes'/'No' but consumed as boolean
    obj.quickEntry = (obj.quickEntry === 'Yes');
    newPersonal[key] = obj;
  });

  // v0.9.1198: one-time, fire-and-forget — label the new Master Key column in
  // the sheet's header row (row 2) so Brad sees what it is when he opens the
  // spreadsheet. Purely cosmetic (every read is positional); a failure just
  // retries on a later load because the flag is only set on success.
  try {
    if (!localStorage.getItem('rr_mk_header_v1') && state.personalSheetId
        && typeof personalColLetter === 'function' && typeof sheetsUpdate === 'function'
        && PERSONAL_FIELD_INDEX && PERSONAL_FIELD_INDEX.masterKey !== undefined) {
      sheetsUpdate(state.personalSheetId, PERSONAL_TAB + '!' + personalColLetter('masterKey') + '2', [['Master Key']])
        .then(function () { try { localStorage.setItem('rr_mk_header_v1', '1'); } catch (e) {} })
        .catch(function (e) { console.warn('[MasterKey] header label deferred:', e && e.message); });
    }
  } catch (eMk) {}

  // Sold — Session 176: each sale is its own row (a history). Key uniquely by
  // sheet row so two sales of the same item number don't collide/overwrite. Read
  // snapshot columns 10-19 so each record keeps its own details + photos.
  (soldRes.values || []).forEach((r, idx) => {
    if (!r[0] || r[0] === 'Item Number') return;
    const key = 'sold-' + (idx+3);
    const _ss = (v) => (v !== null && v !== undefined && v !== '') ? String(v) : '';
    newSold[key] = {
      row: idx+3, key: key, itemNum: _ss(r[0]), variation: _ss(r[1]),
      copy: _ss(r[2]) || '1', condition: _ss(r[3]), priceItem: _ss(r[4]),
      salePrice: _ss(r[5]), dateSold: _ss(r[6]), notes: _ss(r[7]),
      inventoryId: _ss(r[8]),
      manufacturer: _ss(r[9]) || 'Lionel',
      allOriginal: _ss(r[10]), hasBox: _ss(r[11]), boxCond: _ss(r[12]),
      photoItem: _ss(r[13]), photoBox: _ss(r[14]),
      roadName: _ss(r[15]), description: _ss(r[16]),
      userEstWorth: _ss(r[17]), datePurchased: _ss(r[18]), year: _ss(r[19]),
    };
  });

  // For Sale
  // Phase 3: key by inventoryId so per-copy disambiguation is automatic.
  // Rows without an inventoryId fall back to a synthetic legacy-row key.
  (forSaleRes.values || []).forEach((r, idx) => {
    if (!r[0] || r[0] === 'Item Number') return;
    const _row = idx + 3;
    // Phase 3j: coerce numeric-from-UNFORMATTED_VALUE fields to strings
    const _s = (v) => (v !== null && v !== undefined && v !== '') ? String(v) : '';
    const entry = {
      row: _row, itemNum: _s(r[0]), variation: _s(r[1]),
      condition: _s(r[2]), askingPrice: _s(r[3]), dateListed: _s(r[4]),
      notes: _s(r[5]), originalPrice: _s(r[6]), estWorth: _s(r[7]),
      inventoryId: _s(r[8]),
      manufacturer: _s(r[9]) || 'Lionel',
    };
    // v0.9.1251 (row-identity audit, finding 8): mint the storage key ONCE and
    // carry it on the entry. It used to be recomputed later by _fsEntryKey()
    // from entry.row — but _adjustRowsAfterDelete mutates entry.row in place
    // after a deletion and never rekeys the table, so the recomputed key
    // stopped naming the entry it was built from. Remove then pointed at a
    // different listing. Two names for one thing, drifting apart on the first
    // delete; now there is one name, and it never moves.
    const key = entry.inventoryId || ('legacy-row-' + _row);
    entry._key = key;
    newForSale[key] = entry;
  });

  // Want-Upgrade List (combined tab, Session 161+)
  // New schema: A=Item#, B=Variation, C=List Type, D=Priority, E=Target Price,
  // F=Target Condition, G=Upgrading Inventory ID, H=Notes, I=Manufacturer.
  // Split rows by List Type (col C) into newWant + state.upgradeData with the
  // SAME shape the rest of the app already expects (so no downstream changes).
  (wishlistRes.values || []).forEach((r, idx) => {
    if (!r[0] || r[0] === 'Item Number') return;
    const _row = idx + 3;
    const _wu = (v) => (v !== null && v !== undefined && v !== '') ? String(v) : '';
    const listType = _wu(r[2]).toLowerCase();
    if (listType === 'upgrade') {
      // Phase 3 keying: by Upgrading Inventory ID (col G = index 6)
      const entry = {
        row: _row, itemNum: _wu(r[0]), variation: _wu(r[1]),
        priority: _wu(r[3]) || 'Medium',
        targetCondition: _wu(r[5]),
        maxPrice: _wu(r[4]),  // Target Price -> maxPrice (legacy field name)
        notes: _wu(r[7]),
        inventoryId: _wu(r[6]),  // Upgrading Inventory ID -> inventoryId (legacy)
        manufacturer: _wu(r[8]) || 'Lionel',
        listType: 'Upgrade',
      };
      // v0.9.1251: same as For Sale above — the key is minted once and carried.
      const key = entry.inventoryId || ('legacy-row-' + _row);
      entry._key = key;
      state.upgradeData[key] = entry;
    } else {
      // Default to Want (covers 'Want', empty, or anything unrecognized)
      const key = `${_wu(r[0])}|${_wu(r[1])}`;
      newWant[key] = {
        row: _row, itemNum: _wu(r[0]), variation: _wu(r[1]),
        priority: _wu(r[3]) || 'Medium',
        expectedPrice: _wu(r[4]),  // Target Price -> expectedPrice (legacy)
        targetCondition: _wu(r[5]),  // Brad's preference: track Target on Want too
        notes: _wu(r[7]),
        manufacturer: _wu(r[8]) || 'Lionel',
        listType: 'Want',
      };
    }
  });

  // Session 159 Phase 2f: ALWAYS verify upgrade load completed, log + retry.
  // The Phase 2e conditional retry didn't fire — too restrictive. Now we
  // always log the initial state and retry if empty.
  console.log('[Wishlist load] initial state has', Object.keys(state.upgradeData).length, 'upgrade entries; fetch returned', (wishlistRes.values || []).length, 'rows');
  setTimeout(function() {
    if (Object.keys(state.upgradeData).length > 0) return;
    console.log('[Upgrade self-heal] state empty after load — retrying fetch...');
    sheetsGet(sheetId, 'Want-Upgrade List!A3:I').then(function(retryRes) {
      console.log('[Upgrade self-heal] retry returned', (retryRes.values || []).length, 'rows');
      var added = 0;
      (retryRes.values || []).forEach(function(r, idx) {
        if (!r[0] || r[0] === 'Item Number') return;
        // Phase 3j parity: coerce to String for UNFORMATTED_VALUE safety.
        var _hs = function(v) { return (v !== null && v !== undefined && v !== '') ? String(v) : ''; };
        // New schema: only pick up Upgrade rows here (self-heal is upgrade-only)
        if (_hs(r[2]).toLowerCase() !== 'upgrade') return;
        var entry = {
          row: idx+3, itemNum: _hs(r[0]), variation: _hs(r[1]),
          priority: _hs(r[3]) || 'Medium', targetCondition: _hs(r[5]),
          maxPrice: _hs(r[4]),  // Target Price column
          notes: _hs(r[7]),
          inventoryId: _hs(r[6]),  // Upgrading Inventory ID column
          manufacturer: _hs(r[8]) || 'Lionel',
          listType: 'Upgrade',
        };
        var _key = entry.inventoryId || ('legacy-row-' + (idx+3));
        state.upgradeData[_key] = entry;
        added++;
      });
      if (added > 0) {
        console.log('[Upgrade self-heal] picked up', added, 'rows on retry');
        if (typeof buildDashboard === 'function') buildDashboard();
        if (typeof renderBrowse === 'function') renderBrowse();
        var _badge = document.getElementById('nav-wishlist-count');
        if (_badge) _badge.textContent = (Object.keys(state.wantData||{}).length + Object.keys(state.upgradeData||{}).length).toLocaleString();
      }
    }).catch(function(e) { console.warn('[Upgrade self-heal failed]', e && e.message); });
  }, 1500);

  // ── PRIMARY COMMIT — commit collection/sold/forSale/want to state first
  // so the UI can render from fresh primary data while secondary (ephemera,
  // IS, science, construction, mySets) continues loading in the background.
  if (!collRes._failed && (forceOverwrite || Object.keys(newPersonal).length > 0 || Object.keys(state.personalData).length === 0)) {
    // v0.9.1254 (audit finding L): personalData keys are re-minted here from
    // the CURRENT rows. window._poKeys holds key strings captured earlier and
    // is append-only, so after this rebuild an old entry can name a different
    // copy — for a legacy row with no Inventory ID the key carries its row
    // number, and a copy that moved up into that row now answers to it. The
    // detail page would then open, and act on, the wrong copy.
    //
    // Brad's own sheet is fully populated with Inventory IDs, so his keys never
    // carry a row and this cannot fire for him. It can for a tester importing
    // older data — and it costs one line to close: the index is only ever a
    // within-session shorthand, so it is rebuilt whenever its subject is.
    try { window._poKeys = []; } catch (e) {}
    state.personalData = newPersonal;
  }
  // inv-id hardening (v0.9.634): re-seed the inventory-ID watermark from the
  // freshly-loaded personal data so nextInventoryId() can never reuse a number.
  if (typeof _seedInvHwm === 'function') _seedInvHwm();
  if (!soldRes._failed && (forceOverwrite || Object.keys(newSold).length > 0 || Object.keys(state.soldData).length === 0)) {
    state.soldData = newSold;
  }
  if (!forSaleRes._failed && (forceOverwrite || Object.keys(newForSale).length > 0 || Object.keys(state.forSaleData).length === 0)) {
    state.forSaleData = newForSale;
  }
  if (!wishlistRes._failed && (forceOverwrite || Object.keys(newWant).length > 0 || Object.keys(state.wantData).length === 0)) {
    state.wantData = newWant;
  }

  // v0.9.824 (BUG-003, Brad's vanished collection): a FAILED fetch is NOT an
  // empty tab. If any primary tab failed we kept the old data above — now say
  // so and retry the whole load once after 5s (mirrors the upgrade self-heal).
  var _plFailed = [collRes, soldRes, forSaleRes, wishlistRes].some(function(r) { return r && r._failed; });
  if (_plFailed && !window._plRetryPending && !window._offlineMode && navigator.onLine !== false) {
    window._plRetryPending = true;
    if (typeof showToast === 'function') showToast("Couldn't reach Google Sheets for part of your data — retrying in a few seconds…", 4500, true);
    setTimeout(function() {
      _loadPersonalFromSheets(sheetId, forceOverwrite).then(function() {
        window._plRetryPending = false;
        try { if (typeof _cachePersonalData === 'function') _cachePersonalData(); } catch (e) {}
        try { if (typeof buildDashboard === 'function') buildDashboard(); } catch (e) {}
        try { if (typeof renderBrowse === 'function') renderBrowse(); } catch (e) {}
      }).catch(function() { window._plRetryPending = false; });
    }, 5000);
  } else if (!_plFailed) {
    window._plRetryPending = false;
  }

  // Kick off secondary parsing asynchronously — does not block function return.
  _secondaryFetch.then(async function(results) {
    const [catRes2, paperRes2, mockRes2, otherRes2, isRes2, sciRes2, conRes2, mySetsRes2, partsRes2, contactsRes2] = results;
    isRes = isRes2; catRes = catRes2; paperRes = paperRes2; mockRes = mockRes2;
    otherRes = otherRes2; sciRes = sciRes2; conRes = conRes2; mySetsRes = mySetsRes2;

    // Instruction Sheets
    const _isRows = (isRes && isRes.values) || [];
    _isRows.forEach((r, idx) => {
    if (!r[0] || r[0] === 'Sheet #' || r[0] === 'Instruction Sheets') return;
    const _rowNum = idx + 3;
    const _isInvId = String(r[6] || '');
    // v0.9.1251 (finding 14): carry the storage key on the record. Three
    // render sites used to pass `it.row` into openISDetail(), which looks up
    // state.isData[key] — and the key is the inventoryId whenever the record
    // has one, so those clicks silently did nothing. One branch had already
    // been fixed with a lookup map and a comment explaining why; the other two
    // were missed. Stamping the key here means no site has to re-derive it.
    const key = _isInvId || _rowNum;
    newIsData[key] = {
      _key: key,
      row: _rowNum, sheetNum: String(r[0]||''), linkedItem: String(r[1]||''), year: String(r[2]||''),
      condition: String(r[3]||''), notes: String(r[4]||''), photoLink: String(r[5]||''),
      inventoryId: _isInvId, groupId: String(r[7]||''), formCode: String(r[8]||''),
      pricePaid: String(r[9]||''), estValue: String(r[10]||''),
    };
  });

  // Science Sets & Construction Sets — 15-col layout (A-O) with Variation
  function _parseSetTab(res, bucket, tabTitle) {
    (res.values || []).forEach((r, idx) => {
      if (!r[0] || r[0] === 'Item Number' || r[0] === tabTitle) return;
      const _rowNum = idx + 3;
      const _stInvId = String(r[13] || '');
      const key = _stInvId || _rowNum;
      bucket[key] = {
        row: _rowNum, itemNum: String(r[0]||''), variation: String(r[1]||''), description: String(r[2]||''), year: String(r[3]||''),
        condition: String(r[4]||''), allOriginal: String(r[5]||''), hasCase: String(r[6]||''),
        caseCond: String(r[7]||''), pricePaid: String(r[8]||''), estValue: String(r[9]||''),
        photoLink: String(r[10]||''), notes: String(r[11]||''), dateAcquired: String(r[12]||''),
        inventoryId: String(r[13]||''), groupId: String(r[14]||''),
      };
    });
  }
  _parseSetTab(sciRes, newScienceData, 'Science Sets');
  _parseSetTab(conRes, newConstructionData, 'Construction Sets');

  // My Sets
  (mySetsRes.values || []).forEach((r, idx) => {
    if (!r[0] || r[0] === 'Set Number') return;
    const rowNum = idx + 3;
    const _msInvId = String(r[13] || '');
    const key = _msInvId || `${r[0]}|${String(r[2] || '')}|${rowNum}`;
    newMySetsData[key] = {
      row: rowNum, setNum: String(r[0]||''), setName: String(r[1]||''), year: String(r[2]||''),
      condition: String(r[3]||''), estWorth: String(r[4]||''), datePurchased: String(r[5]||''),
      groupId: String(r[6]||''), setId: String(r[7]||''), hasSetBox: String(r[8]||''),
      boxCondition: String(r[9]||''), photoLink: String(r[10]||''), notes: String(r[11]||''),
      quickEntry: r[12] === 'Yes', inventoryId: String(r[13]||''),
    };
  });

  // Ephemera tabs
  // Initialize user-defined tab buckets
  (state.userDefinedTabs||[]).forEach(t => { newEphemera[t.id] = {}; });

  function parseEphemeraRows(rows, bucket) {
    (rows || []).forEach((r, idx) => {
      if (!r[0] || r[0] === 'Item ID' || r[0] === 'Title') return;
      const key = idx + 3;
      // Detect old format (no Item ID): if r[0] looks like a title (not a system ID like 8157-PAP)
      const hasItemId = /^(\d{4}-[A-Z]+|[A-Z]{2,4}-\d{4}|[A-Z]{2,4}-\d{3}$)/.test(r[0]);
      if (hasItemId) {
        bucket[key] = {
          row: key, itemNum: String(r[0]||''), title: String(r[1]||''), description: String(r[2]||''), year: String(r[3]||''),
          manufacturer: String(r[4]||'Lionel'), condition: String(r[5]||''), quantity: String(r[6]||'1'),
          pricePaid: String(r[7]||''), estValue: String(r[8]||''), photoLink: String(r[9]||''), notes: String(r[10]||''), dateAcquired: String(r[11]||''),
          paperType: String(r[12]||''), itemNumRef: String(r[13]||''),
        };
      } else {
        // Legacy row without Item ID — predates Price Paid column
        bucket[key] = {
          row: key, itemNum: '', title: String(r[0]||''), description: String(r[1]||''), year: String(r[2]||''),
          manufacturer: String(r[3]||'Lionel'), condition: String(r[4]||''), quantity: String(r[5]||'1'),
          pricePaid: '', estValue: String(r[6]||''), photoLink: String(r[7]||''), notes: String(r[8]||''), dateAcquired: String(r[9]||''),
          paperType: '', itemNumRef: '',
        };
      }
    });
  }
  // Catalogs have their own column layout
  (catRes.values || []).forEach((r, idx) => {
    // Skip header rows: first cell is 'Item ID', 'Type', or 'Catalogs'
    if (!r[0] || r[0] === 'Item ID' || r[0] === 'Type' || r[0] === 'Catalogs') return;
    const key = idx + 3;
    // Columns: ItemID(0) Type(1) Year(2) HasMailer(3) Condition(4) PricePaid(5) EstValue(6) DateAcq(7) Notes(8) PhotoLink(9)
    const catType = String(r[1]||'');
    const year = String(r[2]||'');
    const title = [year, catType, 'Catalog'].filter(Boolean).join(' ');
    newEphemera.catalogs[key] = {
      row: key, itemNum: String(r[0]||''), title,
      catType, year, hasMailer: String(r[3]||'No'),
      condition: String(r[4]||''), pricePaid: String(r[5]||''), estValue: String(r[6]||''), dateAcquired: String(r[7]||''),
      notes: String(r[8]||''), photoLink: String(r[9]||''),
    };
  });
  parseEphemeraRows(paperRes.values, newEphemera.paper);
  parseEphemeraRows(otherRes.values, newEphemera.other);
  // Re-populate type filter now that ephemera data is loaded (only if already populated)
  // Session 112: guard filter-road element too — it can be null if the user
  // hasn't visited the Browse page yet, which caused the TypeError warning.
  if (typeof populateFilters === 'function' && document.getElementById('filter-type') &&
      document.getElementById('filter-type').options.length > 1) {
    var _ftype = document.getElementById('filter-type');
    var _froad = document.getElementById('filter-road');
    if (_ftype) _ftype.innerHTML = '<option value="">All Types</option>';
    if (_froad) _froad.innerHTML = '<option value="">All Roads</option>';
    populateFilters();
  }

  // User-defined tabs — load their sheet data.
  // Guard: never load standalone feature tabs (e.g. 'Parts Needed') as
  // collection/ephemera tabs, even if a stale userDefinedTabs entry exists
  // in cache before syncUserDefinedTabsFromSheet prunes it.
  const _RESERVED_TABS = { 'Parts Needed': 1, 'Contacts': 1 };   // v0.9.794: never load Contacts as an ephemera tab
  const _utPromises = (state.userDefinedTabs||[]).filter(ut => ut && !_RESERVED_TABS[ut.label]).map(ut =>
    sheetsGet(sheetId, ut.label + '!A3:J').catch((e) => { console.warn('[Custom tab ' + ut.label + ' load failed]', e && e.message); return {values:[], _failed:true}; })
      .then(utRes => parseEphemeraRows(utRes.values, newEphemera[ut.id]))
      .catch(() => {})
  );
  await Promise.all(_utPromises);

  // Mock-ups have extra fields
  (mockRes.values || []).forEach((r, idx) => {
    if (!r[0] || r[0] === 'Item ID' || r[0] === 'Title') return;
    const key = idx + 3;
    newEphemera.mockups[key] = {
      row: key, itemNum: String(r[0]||''), title: String(r[1]||''), itemNumRef: String(r[2]||''), description: String(r[3]||''),
      year: String(r[4]||''), manufacturer: String(r[5]||'Lionel'), condition: String(r[6]||''),
      productionStatus: String(r[7]||''), material: String(r[8]||''), dimensions: String(r[9]||''),
      provenance: String(r[10]||''), lionelVerified: String(r[11]||''),
      pricePaid: String(r[12]||''), estValue: String(r[13]||''),
      photoLink: String(r[14]||''), notes: String(r[15]||''), dateAcquired: String(r[16]||''),
    };
  });

    // ── Commit secondary to state ──
    // (primary tabs — personalData/soldData/forSaleData/wantData — already
    // committed earlier. This block only handles secondary/ephemera tabs.)
    // v0.9.827 (Brad): Parts + Contacts — parsed by THE parsers their pages
    // own (window._parsePartsRows / window._ctParseRows), committed only on a
    // successful fetch so a hiccup keeps the previous data (BUG-003 rule).
    if (partsRes2 && !partsRes2._failed && typeof window._parsePartsRows === 'function') {
      state.partsData = window._parsePartsRows(partsRes2.values);
      try { if (typeof _updatePartsBadge === 'function') _updatePartsBadge(); } catch (e) {}
    }
    if (contactsRes2 && !contactsRes2._failed && typeof window._ctParseRows === 'function') {
      state.contactsData = window._ctParseRows(contactsRes2.values);
    }
    // v0.9.824 (BUG-003): failed fetches keep the previous data.
    if (!isRes._failed) state.isData = newIsData;
    if (!sciRes._failed) state.scienceData = newScienceData;
    if (!conRes._failed) state.constructionData = newConstructionData;
    if (!(catRes._failed || paperRes._failed || mockRes._failed || otherRes._failed)) state.ephemeraData = newEphemera;
    if (!mySetsRes._failed) state.mySetsData = newMySetsData;
    _cachePersonalData();
    // Re-render dashboard now that secondary counts are in
    try { if (typeof buildDashboard === 'function') buildDashboard(); } catch(e) {}
    try { if (typeof renderBrowse === 'function') renderBrowse(); } catch(e) {}
  }).catch(function(e) { console.warn('[Secondary personal data fetch failed]', e && e.message); });
}




