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
  try {
    loadUserDefinedTabs();
    // Session 116: 'all' meta-era has its own orchestrator that
    // hydrates from per-era IDB caches in parallel and refreshes
    // each era from Sheets in sequence in the background.
    if (_currentEra === 'all' && typeof loadAllErasMode === 'function') {
      await loadAllErasMode();
      _patchMasterData();
      _inferMissingYears();
      buildApp();
      showOnboarding();
      if (typeof vaultInit === 'function') vaultInit();
      if (state.personalSheetId) {
        driveWriteConfig({
          personalSheetId: state.personalSheetId,
          vaultId: driveCache.vaultId || '',
          photosId: driveCache.photosId || '',
          soldPhotosId: driveCache.soldPhotosId || '',
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
    buildApp();
    showOnboarding();
    if (typeof vaultInit === 'function') vaultInit();
    // Re-write config after every successful load so all devices can always find the Sheet ID
    if (state.personalSheetId) {
      driveWriteConfig({
        personalSheetId: state.personalSheetId,
        vaultId: driveCache.vaultId || '',
        photosId: driveCache.photosId || '',
        soldPhotosId: driveCache.soldPhotosId || '',
      }).catch(e => console.warn('Config refresh:', e));
      // Auto-rename sheet if it still has the old Boxcar Files name
      _maybeRenamePersonalSheet().catch(e => console.warn('Sheet rename:', e));
    }
  } catch(e) {
    showToast('Load error: ' + e.message);
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
  const _CACHE_VER = '125';
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

  if (cached && cacheAge < CACHE_TTL) {
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
            if (typeof renderBrowse === 'function') renderBrowse();
          }
        }).catch(() => {});
      }
      return;
    } catch(e) {}
  }

  const allRows = await _fetchMasterTabs();
  state.masterData = _deduplicateMaster(allRows);
  _rebuildMasterIndex();
  if (typeof ERAS !== 'undefined' && _currentEra && ERAS[_currentEra]) { ERAS[_currentEra]._total = state.masterData.length; try { localStorage.setItem('lv_era_total_' + _currentEra, state.masterData.length); } catch(e) {} }
  idbSet(_IDB_KEY, state.masterData);
  localStorage.setItem(_TS_KEY, Date.now().toString());
}

async function _fetchMasterTabs() {
  // Try multi-tab batchGet first, fall back to old single-tab
  try {
    var _mt = _getMasterTabs();
    const ranges = _mt.map(t => `${t}!A2:U`);
    const res = await sheetsBatchGet(state.masterSheetId, ranges);
    const allRows = [];
    (res.valueRanges || []).forEach((vr, i) => {
      const tabName = _mt[i];
      (vr.values || []).forEach(r => {
        allRows.push(parseMasterRow(r, tabName));
      });
    });
    if (allRows.length > 0) return allRows;
  } catch(e) {
    console.warn('[Master] batchGet failed, trying legacy single tab:', e.message);
  }
  // Fallback: old single-tab approach
  try {
    let res = await sheetsGet(state.masterSheetId, 'Master Inventory!A2:U');
    if (!res.values) res = await sheetsGet(state.masterSheetId, 'Sheet1!A2:U');
    return (res.values || []).map(r => parseMasterRow(r, SHEET_TABS.items));
  } catch(e2) {
    console.warn('[Master] Legacy fallback also failed:', e2.message);
    return [];
  }
}

function parseMasterRow(r, tabName) {
  return {
    itemNum:      r[0]  || '',
    itemType:     r[1]  || '',
    subType:      r[2]  || '',
    unit:         r[3]  || '',
    poweredDummy: r[4]  || '',
    control:      r[5]  || '',
    roadName:     r[6]  || '',
    description:  r[7]  || '',
    gauge:        r[8]  || '',
    yearProd:     r[9]  || '',
    variation:    r[10] || '',
    varDesc:      r[11] || '',
    refLink:      r[12] || '',
    notes:        r[13] || '',
    marketVal:    r[14] || '',
    source:       r[15] || '',
    cottCode:     r[16] || '',
    originalDesc: r[17] || '',
    // Unified-schema extension columns (used by Atlas rows; blank for Lionel rows):
    category:     r[18] || '',
    trackPower:   r[19] || '',
    msrp:         r[20] || '',
    _tab:         tabName,
  };
}

function _deduplicateMaster(rows) {
  const seen = new Set();
  return rows.filter(m => {
    if (!m.itemNum) return false;
    // trackPower included so Atlas rail variants (3-Rail TMCC vs 2-Rail DC, etc.)
    // are NOT deduped into one row. Blank for Lionel rows so behavior is unchanged.
    const key = m.itemNum + '|' + (m.roadName || '') + '|' + m.variation + '|' + (m.poweredDummy || '') + '|' + (m.description || '') + '|' + (m.trackPower || '');
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
  const rows = state.masterData || [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const k = String(r.itemNum || '').trim();
    if (!k) continue;
    let bucket = m.get(k);
    if (!bucket) { bucket = []; m.set(k, bucket); }
    bucket.push(r);
  }
  state.masterByItem = m;
  state._boxVarCache = new Map();        // bust box-variation cache on reindex
}

// Find first master row matching itemNum (+ optional variation). O(1) lookup.
function findMaster(itemNum, variation) {
  if (!itemNum) return null;
  const k = String(itemNum).trim();
  const bucket = state.masterByItem && state.masterByItem.get(k);
  if (!bucket || !bucket.length) return null;
  if (variation != null && variation !== '') {
    const want = String(variation);
    const hit = bucket.find(r => String(r.variation || '') === want);
    if (hit) return hit;
  }
  return bucket[0];
}

// Return ALL master rows for a given itemNum. O(1) lookup.
function findAllMaster(itemNum) {
  if (!itemNum) return [];
  const k = String(itemNum).trim();
  return (state.masterByItem && state.masterByItem.get(k)) || [];
}
window.findMaster = findMaster;
window.findAllMaster = findAllMaster;
window._rebuildMasterIndex = _rebuildMasterIndex;

async function loadCatalogRefData() {
  // Fetch Catalogs tab from master sheet — used by paper item wizard for searchable picker
  // Columns: A=Catalog ID, B=Year, C=Type, D=Title
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
    try { res = await sheetsGet(state.masterSheetId, SHEET_TABS.catalogs + '!A2:D'); }
    catch(_) { res = await sheetsGet(state.masterSheetId, 'catalogs!A2:D'); }
    const rows = (res && res.values) || [];
    state.catalogRefData = rows
      .filter(r => r[0] && r[3] && r[0] !== 'Catalog ID') // skip header/empty
      .map(r => ({
        id:    r[0] || '',
        year:  r[1] || '',
        type:  r[2] || '',
        title: r[3] || '',
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
        id:          r[0] || '',
        itemNumber:  r[1] || '',
        description: r[2] || '',
        category:    r[3] || '',
        variations:  r[4] || '',
        notes:       r[5] || '',
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
            localStorage.setItem(SET_CACHE, JSON.stringify(state.setData));
            localStorage.setItem(SET_TS, Date.now().toString());
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
            localStorage.setItem(COMP_CACHE, JSON.stringify(state.companionData));
            localStorage.setItem(COMP_TS, Date.now().toString());
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
      engineNum:     (r[0] || '').trim(),
      engineVar:     (r[1] || '').trim(),
      companionNum:  (r[2] || '').trim(),
      companionType: (r[3] || '').trim(),
      notes:         (r[4] || '').trim(),
    }));
}

function parseSetRows(rows) {
  state.setData = rows
    .filter(r => r[0])
    .map(r => ({
      setNum:      (r[0]  || '').trim(),
      setName:     (r[1]  || '').trim(),
      year:        (r[2]  || '').trim(),
      gauge:       (r[3]  || '').trim(),
      price:       (r[4]  || '').trim(),
      steam:       (r[5]  || '').trim(),
      tender:      (r[6]  || '').trim(),
      dieselPow:   (r[7]  || '').trim(),
      dieselB:     (r[8]  || '').trim(),
      dieselDummy: (r[9]  || '').trim(),
      // All component item numbers in one flat array (cols F–T)
      items:    [r[5],r[6],r[7],r[8],r[9],r[10],r[11],r[12],r[13],r[14],r[15],r[16],r[17],r[18],r[19]]
                  .map(v => (v||'').trim()).filter(Boolean),
      alts:     [],   // no longer used — all components are in items[]
      notes:    (r[20] || '').trim(),
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

  // Use cached personal data for instant load (2 hour TTL)
  const _pcache = localStorage.getItem('lv_personal_cache');
  const _ptime  = parseInt(localStorage.getItem('lv_personal_cache_ts') || '0');
  const _PAGE_TTL    = 2 * 60 * 60 * 1000; // 2 hours
  const _BG_REFRESH  = 5 * 60 * 1000;      // background refresh throttle: 5 min
  if (_pcache && (Date.now() - _ptime) < _PAGE_TTL) {
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
      // Only background-refresh if cache is older than 5 minutes
      if ((Date.now() - _ptime) > _BG_REFRESH) {
        _loadPersonalFromSheets(state.personalSheetId).then(() => {
          _cachePersonalData();
          buildDashboard();
          renderBrowse();
        }).catch(() => {});
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
      forSaleData: state.forSaleData,
      wantData: state.wantData,
      isData: state.isData,
      scienceData: state.scienceData,
      constructionData: state.constructionData,
      ephemeraData: state.ephemeraData,
      mySetsData: state.mySetsData,
    };
    localStorage.setItem('lv_personal_cache', JSON.stringify(_snap));
    localStorage.setItem('lv_personal_cache_ts', Date.now().toString());
  } catch(e) {}
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
  const [collRes, soldRes, forSaleRes, wantRes, upgradeRes] = await Promise.all([
    sheetsGet(sheetId, 'My Collection!A3:Y').catch(() => ({values:[]})),
    sheetsGet(sheetId, 'Sold!A3:J').catch(() => ({values:[]})),
    sheetsGet(sheetId, 'For Sale!A3:J').catch(() => ({values:[]})),
    sheetsGet(sheetId, 'Want List!A3:F').catch(() => ({values:[]})),
    sheetsGet(sheetId, 'Upgrade List!A3:H').catch(() => ({values:[]})),
  ]);
  // Secondary tabs fire off in parallel, NOT awaited in the main flow
  const _secondaryFetch = Promise.all([
    sheetsGet(sheetId, 'Catalogs!A3:J').catch(() => ({values:[]})),
    sheetsGet(sheetId, 'Paper Items!A3:N').catch(() => ({values:[]})),
    sheetsGet(sheetId, 'Mock-Ups!A3:Q').catch(() => ({values:[]})),
    sheetsGet(sheetId, 'Other Lionel!A3:N').catch(() => ({values:[]})),
    sheetsGet(sheetId, 'Instruction Sheets!A3:K').catch(() => ({values:[]})),
    sheetsGet(sheetId, 'Science Sets!A3:O').catch(() => ({values:[]})),
    sheetsGet(sheetId, 'Construction Sets!A3:O').catch(() => ({values:[]})),
    sheetsGet(sheetId, 'My Sets!A3:N').catch(() => ({values:[]})),
  ]);
  // Defaults — overwritten once the secondary promise resolves below
  let catRes={values:[]}, paperRes={values:[]}, mockRes={values:[]},
      otherRes={values:[]}, isRes={values:[]}, sciRes={values:[]},
      conRes={values:[]}, mySetsRes={values:[]};

  // My Collection
  (collRes.values || []).forEach((r, idx) => {
    if (!r[0] || r[0] === 'Item Number') return;
    const rowNum = idx + 3;
    const _invId = r[20] || '';
    const key = _invId || `${r[0]}|${r[1] || ''}|${rowNum}`;
    newPersonal[key] = {
      row: rowNum, itemNum: r[0]||'', variation: r[1]||'',
      status: 'Owned', owned: true,
      condition: r[2]||'', allOriginal: r[3]||'',
      priceItem: r[4]||'', priceBox: r[5]||'', priceComplete: r[6]||'',
      hasBox: r[7]||'', boxCond: r[8]||'',
      photoItem: r[9]||'', photoBox: r[10]||'',
      notes: r[11]||'', datePurchased: r[12]||'',
      userEstWorth: r[13]||'', matchedTo: r[14]||'',
      setId: r[15]||'', yearMade: r[16]||'',
      isError: r[17]||'', errorDesc: r[18]||'',
      quickEntry: r[19] === 'Yes',
      inventoryId: r[20]||'', groupId: r[21]||'',
      location: r[22]||'',
      era: r[23]||'', manufacturer: r[24]||'',
    };
  });

  // Sold
  (soldRes.values || []).forEach((r, idx) => {
    if (!r[0] || r[0] === 'Item Number') return;
    const key = `${r[0]}|${r[1]||''}`;
    newSold[key] = {
      row: idx+3, itemNum: r[0]||'', variation: r[1]||'',
      copy: r[2]||'1', condition: r[3]||'', priceItem: r[4]||'',
      salePrice: r[5]||'', dateSold: r[6]||'', notes: r[7]||'',
      inventoryId: r[8]||'',
      manufacturer: r[9] || 'Lionel',
    };
  });

  // For Sale
  (forSaleRes.values || []).forEach((r, idx) => {
    if (!r[0] || r[0] === 'Item Number') return;
    const key = `${r[0]}|${r[1]||''}`;
    newForSale[key] = {
      row: idx+3, itemNum: r[0]||'', variation: r[1]||'',
      condition: r[2]||'', askingPrice: r[3]||'', dateListed: r[4]||'',
      notes: r[5]||'', originalPrice: r[6]||'', estWorth: r[7]||'',
      inventoryId: r[8]||'',
      manufacturer: r[9] || 'Lionel',
    };
  });

  // Want List
  (wantRes.values || []).forEach((r, idx) => {
    if (!r[0] || r[0] === 'Item Number') return;
    const key = `${r[0]}|${r[1]||''}`;
    newWant[key] = {
      row: idx+3, itemNum: r[0]||'', variation: r[1]||'',
      priority: r[2]||'Medium', expectedPrice: r[3]||'', notes: r[4]||'',
      manufacturer: r[5] || 'Lionel',
    };
  });

  // Upgrade List
  (upgradeRes.values || []).forEach((r, idx) => {
    if (!r[0] || r[0] === 'Item Number') return;
    const key = `${r[0]}|${r[1]||''}`;
    state.upgradeData[key] = {
      row: idx+3, itemNum: r[0]||'', variation: r[1]||'',
      priority: r[2]||'Medium', targetCondition: r[3]||'', maxPrice: r[4]||'', notes: r[5]||'',
      inventoryId: r[6]||'',
      manufacturer: r[7] || 'Lionel',
    };
  });

  // ── PRIMARY COMMIT — commit collection/sold/forSale/want to state first
  // so the UI can render from fresh primary data while secondary (ephemera,
  // IS, science, construction, mySets) continues loading in the background.
  if (forceOverwrite || Object.keys(newPersonal).length > 0 || Object.keys(state.personalData).length === 0) {
    state.personalData = newPersonal;
  }
  if (forceOverwrite || Object.keys(newSold).length > 0 || Object.keys(state.soldData).length === 0) {
    state.soldData = newSold;
  }
  if (forceOverwrite || Object.keys(newForSale).length > 0 || Object.keys(state.forSaleData).length === 0) {
    state.forSaleData = newForSale;
  }
  if (forceOverwrite || Object.keys(newWant).length > 0 || Object.keys(state.wantData).length === 0) {
    state.wantData = newWant;
  }

  // Kick off secondary parsing asynchronously — does not block function return.
  _secondaryFetch.then(async function(results) {
    const [catRes2, paperRes2, mockRes2, otherRes2, isRes2, sciRes2, conRes2, mySetsRes2] = results;
    isRes = isRes2; catRes = catRes2; paperRes = paperRes2; mockRes = mockRes2;
    otherRes = otherRes2; sciRes = sciRes2; conRes = conRes2; mySetsRes = mySetsRes2;

    // Instruction Sheets
    const _isRows = (isRes && isRes.values) || [];
    _isRows.forEach((r, idx) => {
    if (!r[0] || r[0] === 'Sheet #' || r[0] === 'Instruction Sheets') return;
    const _rowNum = idx + 3;
    const _isInvId = r[6] || '';
    const key = _isInvId || _rowNum;
    newIsData[key] = {
      row: _rowNum, sheetNum: r[0]||'', linkedItem: r[1]||'', year: r[2]||'',
      condition: r[3]||'', notes: r[4]||'', photoLink: r[5]||'',
      inventoryId: _isInvId, groupId: r[7]||'', formCode: r[8]||'',
      pricePaid: r[9]||'', estValue: r[10]||'',
    };
  });

  // Science Sets & Construction Sets — 15-col layout (A-O) with Variation
  function _parseSetTab(res, bucket, tabTitle) {
    (res.values || []).forEach((r, idx) => {
      if (!r[0] || r[0] === 'Item Number' || r[0] === tabTitle) return;
      const _rowNum = idx + 3;
      const _stInvId = r[13] || '';
      const key = _stInvId || _rowNum;
      bucket[key] = {
        row: _rowNum, itemNum: String(r[0]||''), variation: String(r[1]||''), description: r[2]||'', year: r[3]||'',
        condition: r[4]||'', allOriginal: r[5]||'', hasCase: r[6]||'',
        caseCond: r[7]||'', pricePaid: r[8]||'', estValue: r[9]||'',
        photoLink: r[10]||'', notes: r[11]||'', dateAcquired: r[12]||'',
        inventoryId: r[13]||'', groupId: r[14]||'',
      };
    });
  }
  _parseSetTab(sciRes, newScienceData, 'Science Sets');
  _parseSetTab(conRes, newConstructionData, 'Construction Sets');

  // My Sets
  (mySetsRes.values || []).forEach((r, idx) => {
    if (!r[0] || r[0] === 'Set Number') return;
    const rowNum = idx + 3;
    const _msInvId = r[13] || '';
    const key = _msInvId || `${r[0]}|${r[2] || ''}|${rowNum}`;
    newMySetsData[key] = {
      row: rowNum, setNum: r[0]||'', setName: r[1]||'', year: r[2]||'',
      condition: r[3]||'', estWorth: r[4]||'', datePurchased: r[5]||'',
      groupId: r[6]||'', setId: r[7]||'', hasSetBox: r[8]||'',
      boxCondition: r[9]||'', photoLink: r[10]||'', notes: r[11]||'',
      quickEntry: r[12] === 'Yes', inventoryId: r[13]||'',
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
          row: key, itemNum: r[0]||'', title: r[1]||'', description: r[2]||'', year: r[3]||'',
          manufacturer: r[4]||'Lionel', condition: r[5]||'', quantity: r[6]||'1',
          pricePaid: r[7]||'', estValue: r[8]||'', photoLink: r[9]||'', notes: r[10]||'', dateAcquired: r[11]||'',
          paperType: r[12]||'', itemNumRef: r[13]||'',
        };
      } else {
        // Legacy row without Item ID — predates Price Paid column
        bucket[key] = {
          row: key, itemNum: '', title: r[0]||'', description: r[1]||'', year: r[2]||'',
          manufacturer: r[3]||'Lionel', condition: r[4]||'', quantity: r[5]||'1',
          pricePaid: '', estValue: r[6]||'', photoLink: r[7]||'', notes: r[8]||'', dateAcquired: r[9]||'',
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
    const catType = r[1]||'';
    const year = r[2]||'';
    const title = [year, catType, 'Catalog'].filter(Boolean).join(' ');
    newEphemera.catalogs[key] = {
      row: key, itemNum: r[0]||'', title,
      catType, year, hasMailer: r[3]||'No',
      condition: r[4]||'', pricePaid: r[5]||'', estValue: r[6]||'', dateAcquired: r[7]||'',
      notes: r[8]||'', photoLink: r[9]||'',
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

  // User-defined tabs — load their sheet data
  const _utPromises = (state.userDefinedTabs||[]).map(ut =>
    sheetsGet(sheetId, ut.label + '!A3:J').catch(() => ({values:[]}))
      .then(utRes => parseEphemeraRows(utRes.values, newEphemera[ut.id]))
      .catch(() => {})
  );
  await Promise.all(_utPromises);

  // Mock-ups have extra fields
  (mockRes.values || []).forEach((r, idx) => {
    if (!r[0] || r[0] === 'Item ID' || r[0] === 'Title') return;
    const key = idx + 3;
    newEphemera.mockups[key] = {
      row: key, itemNum: r[0]||'', title: r[1]||'', itemNumRef: r[2]||'', description: r[3]||'',
      year: r[4]||'', manufacturer: r[5]||'Lionel', condition: r[6]||'',
      productionStatus: r[7]||'', material: r[8]||'', dimensions: r[9]||'',
      provenance: r[10]||'', lionelVerified: r[11]||'',
      pricePaid: r[12]||'', estValue: r[13]||'',
      photoLink: r[14]||'', notes: r[15]||'', dateAcquired: r[16]||'',
    };
  });

    // ── Commit secondary to state ──
    // (primary tabs — personalData/soldData/forSaleData/wantData — already
    // committed earlier. This block only handles secondary/ephemera tabs.)
    state.isData = newIsData;
    state.scienceData = newScienceData;
    state.constructionData = newConstructionData;
    state.ephemeraData = newEphemera;
    state.mySetsData = newMySetsData;
    _cachePersonalData();
    // Re-render dashboard now that secondary counts are in
    try { if (typeof buildDashboard === 'function') buildDashboard(); } catch(e) {}
    try { if (typeof renderBrowse === 'function') renderBrowse(); } catch(e) {}
  }).catch(function(e) { console.warn('[Secondary personal data fetch]', e); });
}
