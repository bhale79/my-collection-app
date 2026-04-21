// ── CONFIG ─────────────────────────────────────────────────────
// APP_VERSION, APP_DATE defined in config.js
// Replace with your actual Google OAuth Client ID after setup
const CLIENT_ID = '161569968813-vrhet7p68vkthkunare60nqr34li5uuh.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';
const API_KEY = ''; // Set your Google Cloud API key in settings if needed
// Gemini Vision API key — get a free key at https://aistudio.google.com/app/apikey
// Paste your key here to enable photo-based item identification
let GEMINI_KEY = localStorage.getItem('lv_gemini_key') || '';
// Sheet name is dynamic — built from user's first name at sign-in
function _getPersonalSheetName() {
  const firstName = (state.user?.name || '').split(' ')[0] || 'My';
  return `The Rail Roster - ${firstName}'s Collection`;
}

async function _maybeRenamePersonalSheet() {
  if (!state.personalSheetId || !accessToken) return;
  try {
    // Get current sheet title via Drive API
    const meta = await fetch('https://www.googleapis.com/drive/v3/files/' + state.personalSheetId + '?fields=name', {
      headers: { Authorization: 'Bearer ' + accessToken }
    }).then(r => r.json());
    if (!meta || !meta.name) return;
    if (!meta.name.includes('Boxcar')) return; // already renamed or never had old name
    const newName = _getPersonalSheetName();
    console.log('[Rename] Sheet:', meta.name, '→', newName);
    await fetch('https://www.googleapis.com/drive/v3/files/' + state.personalSheetId + '?fields=id', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    });
  } catch(e) { console.warn('Sheet rename error (non-fatal):', e); }
}
const PERSONAL_HEADERS = [
  'Item Number','Variation','Condition (1-10)','All Original',
  'Item Only Price','Box Only Price','Item+Box Complete','Has Box',
  'Box Condition (1-10)','Item Photo Link','Box Photo Link','Notes',
  'Date Purchased','User Est. Worth','Matched Tender/Engine','Set ID','Year Made',
  'Is Error','Error Description','Quick Entry','Inventory ID','Group ID','Location',
  'Era','Manufacturer'
];
const SOLD_HEADERS = [
  'Item Number','Variation','Copy #','Condition (1-10)','Item Only Price Paid',
  'Sale Price','Date Sold','Notes','Inventory ID','Manufacturer'
];
const FOR_SALE_HEADERS = [
  'Item Number','Variation','Condition (1-10)','Asking Price',
  'Date Listed','Notes','Original Price Paid','Est. Worth','Inventory ID','Manufacturer'
];
const WANT_HEADERS = [
  'Item Number','Variation','Priority','Expected Price','Notes','Manufacturer'
];
const UPGRADE_HEADERS = [
  'Item Number','Variation','Priority','Target Condition','Max Price','Notes','Inventory ID','Manufacturer'
];

// ── Manufacturer helper ──
// Returns the manufacturer name for the current era (e.g. "Lionel", "Atlas").
// Reads from ERAS[_currentEra].manufacturer. Defaults to "Lionel" (backward compat).
function _getEraManufacturer() {
  try {
    if (typeof ERAS !== 'undefined' && typeof _currentEra !== 'undefined'
        && ERAS[_currentEra] && ERAS[_currentEra].manufacturer) {
      return ERAS[_currentEra].manufacturer;
    }
  } catch(e) {}
  return 'Lionel';
}

// Ephemera tab definitions — shared structure, one tab per category
const EPHEMERA_TABS = [
  { id: 'catalogs',   label: 'Catalogs',    emoji: '📒', color: '#e67e22' },
  { id: 'paper',      label: 'Paper Items', emoji: '📄', color: '#3498db' },
  { id: 'mockups',    label: 'Mock-Ups',    emoji: '🔩', color: '#9b59b6' },
  { id: 'other',      label: 'Other Lionel',emoji: '📦', color: '#27ae60' },
];
const EPHEMERA_HEADERS = [
  'Item ID','Title','Description','Year','Manufacturer','Condition (1-10)',
  'Quantity','Price Paid','Est. Value','Photo Link','Notes','Date Acquired',
  'Type','Item # Ref'
];
const CATALOG_HEADERS = [
  'Item ID','Type','Year','Has Envelope/Mailer','Condition (1-10)',
  'Price Paid','Est. Value','Date Acquired','Notes','Photo Link'
];
// Mock-ups get extra columns
const IS_HEADERS = [
  'Sheet #','Linked Item #','Year/Date Printed','Condition (1-10)','Notes','Photo Link','Inventory ID','Group ID','Form Code','Price Paid','Est. Value'
];
const MOCKUP_HEADERS = [
  'Item ID','Title','Item Number Ref','Description','Year','Manufacturer',
  'Condition (1-10)','Production Status','Material','Dimensions',
  'Provenance','Lionel Verified','Price Paid','Est. Value','Photo Link','Notes','Date Acquired'
];
const SCIENCE_HEADERS = [
  'Item Number','Variation','Description','Year','Condition (1-10)','All Original',
  'Has Case/Box','Case/Box Condition','Price Paid','Est. Worth',
  'Photo Link','Notes','Date Acquired','Inventory ID','Group ID'
];
const CONSTRUCTION_HEADERS = [
  'Item Number','Variation','Description','Year','Condition (1-10)','All Original',
  'Has Case/Box','Case/Box Condition','Price Paid','Est. Worth',
  'Photo Link','Notes','Date Acquired','Inventory ID','Group ID'
];
const MY_SETS_HEADERS = [
  'Set Number','Set Name','Year','Condition (1-10)','Est. Worth',
  'Date Purchased','Group ID','Set ID','Has Set Box','Box Condition',
  'Photo Link','Notes','Quick Entry','Inventory ID'
];

// ── Partner Map — built at startup from Companions + Sets + Master data ──
// state.partnerMap[itemNum] = { tenders:[], locos:[], bUnit:'', aUnit:'', isDiesel:false, configs:['AA','AB'] }
function buildPartnerMap() {
  const map = {};
  const ensure = (num) => { if (!map[num]) map[num] = { tenders:[], locos:[], bUnit:'', aUnit:'', isDiesel:false, configs:[] }; return map[num]; };
  const addUnique = (arr, val) => { if (val && !arr.includes(val)) arr.push(val); };

  // 1. Companions tab: engine <-> tender, engine <-> B-unit, AA pairs
  (state.companionData || []).forEach(c => {
    const eng = c.engineNum;
    const comp = c.companionNum;
    const cType = (c.companionType || '').toLowerCase();
    if (!eng || !comp) return;
    if (cType.includes('tender') || cType === 't') {
      addUnique(ensure(eng).tenders, comp);
      addUnique(ensure(comp).locos, eng);
    } else if (cType.includes('b-unit') || cType.includes('b unit') || cType === 'b') {
      ensure(eng).bUnit = comp;
      ensure(eng).isDiesel = true;
      ensure(comp).aUnit = eng;
      ensure(comp).isDiesel = true;
    } else if (cType.includes('dummy') || cType.includes('aa') || cType === 'd') {
      ensure(eng).isDiesel = true;
      ensure(comp).isDiesel = true;
      ensure(comp).aUnit = eng;
    } else {
      // Generic companion — treat as tender if comp looks like a tender (ends in W/T/B)
      if (comp.match(/[WTB]$/i)) {
        addUnique(ensure(eng).tenders, comp);
        addUnique(ensure(comp).locos, eng);
      }
    }
  });

  // 2. Sets tab: steam+tender pairs, diesel configs
  (state.setData || []).forEach(s => {
    if (s.steam && s.tender) {
      addUnique(ensure(s.steam).tenders, s.tender);
      addUnique(ensure(s.tender).locos, s.steam);
    }
    if (s.dieselPow) {
      const e = ensure(s.dieselPow);
      e.isDiesel = true;
      if (s.dieselDummy) {
        addUnique(e.configs, 'AA');
        ensure(s.dieselDummy).isDiesel = true;
        ensure(s.dieselDummy).aUnit = s.dieselPow;
      }
      if (s.dieselB) {
        e.bUnit = e.bUnit || s.dieselB;
        addUnique(e.configs, 'AB');
        ensure(s.dieselB).isDiesel = true;
        ensure(s.dieselB).aUnit = s.dieselPow;
        if (s.dieselDummy) addUnique(e.configs, 'ABA');
      }
    }
  });

  // 3. Master data: poweredDummy field marks diesel A/B units
  // Pre-build a Set of normalized item numbers for O(1) B-unit existence checks.
  // (Was O(N) .some() inside an O(N) forEach — quadratic. Now linear.)
  const _masterNumSet = new Set();
  const _md = state.masterData || [];
  for (let i = 0; i < _md.length; i++) {
    _masterNumSet.add(normalizeItemNum(_md[i].itemNum));
  }
  _md.forEach(m => {
    const num = normalizeItemNum(m.itemNum);
    if ((m.poweredDummy || '').match(/^(P|D)$/i)) {
      ensure(num).isDiesel = true;
    }
    // Check for B-unit existence (itemNum + 'C') via the prebuilt Set
    if (!num.endsWith('C')) {
      const bNum = num + 'C';
      if (_masterNumSet.has(bNum)) {
        const e = ensure(num);
        e.isDiesel = true;
        e.bUnit = e.bUnit || bNum;
        addUnique(e.configs, 'AB');
        addUnique(e.configs, 'ABA');
        ensure(bNum).isDiesel = true;
        ensure(bNum).aUnit = ensure(bNum).aUnit || num;
      }
    }
    // Any diesel with poweredDummy always supports AA
    if ((m.poweredDummy || '').match(/^(P|D)$/i) && !num.endsWith('C')) {
      addUnique(ensure(num).configs, 'AA');
    }
  });

  state.partnerMap = map;
  console.log('[PartnerMap] Built:', Object.keys(map).length, 'items mapped');
}

// ── Lookup helpers — all query state.partnerMap ──
function _stripSuffix(itemNum) {
  return (itemNum || '').toString().trim().replace(/-(P|D)$/i, '');
}
function _getPartner(itemNum) {
  const num = _stripSuffix(itemNum);
  return state.partnerMap ? (state.partnerMap[num] || null) : null;
}
function isTender(itemNum) { const p = _getPartner(itemNum); return p ? p.locos.length > 0 : false; }
function isLocomotive(itemNum) { const p = _getPartner(itemNum); return p ? p.tenders.length > 0 : false; }
function getMatchingTenders(itemNum) { const p = _getPartner(itemNum); return p ? p.tenders : []; }
function getMatchingLocos(tenderNum) { const p = _getPartner(tenderNum); return p ? p.locos : []; }
function isSetUnit(itemNum) {
  const num = _stripSuffix(itemNum);
  if (num.endsWith('C')) return true;
  const p = _getPartner(num);
  return p ? p.isDiesel : false;
}
function getBUnit(itemNum) { const p = _getPartner(itemNum); return (p && p.bUnit) ? p.bUnit : null; }
function getAUnit(itemNum) { const p = _getPartner(itemNum); return (p && p.aUnit) ? p.aUnit : null; }
function getSetPartner(itemNum) {
  const num = _stripSuffix(itemNum);
  if (num.endsWith('C')) return getAUnit(num);
  return getBUnit(num);
}
function isF3AlcoUnit(itemNum) {
  const p = _getPartner(itemNum);
  return p ? p.isDiesel : false;
}
function getDieselConfigs(itemNum) {
  const p = _getPartner(itemNum);
  return p ? p.configs : [];
}
function getGroupMembers(itemNum) {
  const pd = Object.values(state.personalData).find(p => p.itemNum === itemNum);
  if (!pd || !pd.groupId) return [];
  return Object.values(state.personalData).filter(p => p.groupId === pd.groupId);
}
function normalizeItemNum(n) {
  const s = (n || '').toString().trim();
  return s.match(/^\d+\.0$/) ? s.slice(0, -2) : s;
}
// Strip powered/dummy/trailing suffixes for base-number comparison
// Handles Lionel catalog style (2343P, 2343T, 2343C) and app style (2343-P, 2343-D)
function baseItemNum(n) {
  return normalizeItemNum(n).replace(/[-]?[PDTC]$/i, '');
}
function nextInventoryId() {
  let max = 0;
  const _scanMax = (obj) => {
    Object.values(obj || {}).forEach(rec => {
      const id = parseInt(rec.inventoryId);
      if (!isNaN(id) && id > max) max = id;
    });
  };
  _scanMax(state.personalData);
  _scanMax(state.isData);
  _scanMax(state.scienceData);
  _scanMax(state.constructionData);
  _scanMax(state.mySetsData);
  return String(max + 1);
}
// Look up known box variations from master data for a given item number
function getBoxVariations(itemNum) {
  if (!itemNum || !state.masterData) return [];
  var num = (itemNum || '').replace(/-(P|T|BOX|MBOX)$/i, '');
  // Perf 2026-04-14: memoize by itemNum — called repeatedly during wizard
  // renders and used to re-scan 18K master rows each time.
  var cacheKey = num + '|' + itemNum;
  if (state._boxVarCache && state._boxVarCache.has(cacheKey)) {
    return state._boxVarCache.get(cacheKey);
  }
  var boxes = state.masterData.filter(function(m) {
    return m._tab === 'Lionel PW - Boxes' && (m.itemNum === num || m.itemNum === itemNum || baseItemNum(m.itemNum) === baseItemNum(num));
  });
  if (state._boxVarCache) state._boxVarCache.set(cacheKey, boxes);
  return boxes;
}
function _buildGroupBoxRow(unitNum, boxCond, boxPhotoLink, groupId, datePurchased, leadItemNum, boxVariation, boxVariationDesc) {
  var noteText = 'Box for ' + unitNum;
  if (boxVariationDesc) noteText += ' — ' + boxVariationDesc;
  return [
    unitNum + '-BOX', boxVariation || '',
    boxCond || '', '',
    '', '', '',
    'Yes',
    boxCond || '',
    '', boxPhotoLink || '',
    noteText,
    datePurchased || '',
    '',
    unitNum,
    '', '', '', '', '',
    nextInventoryId(),
    groupId,
    '', '', '',
  ];
}
function genSetId(baseNum) {
  return 'SET-' + baseNum + '-' + Date.now();
}

// ── STATE ───────────────────────────────────────────────────────
// ── Cached preference values (read once at startup, updated on change) ──
let _prefLocEnabled = localStorage.getItem('lv_location_enabled') === 'true';

var state = {
  user: null,
  masterSheetId: null,
  ephemeraData: {},   // keyed by tab name → { rowKey: record }
  userDefinedTabs: [], // array of { id, label } for user-created custom tabs
  isError: false,
  personalSheetId: null,
  masterData: [],      // all rows from master sheet
  personalData: {},    // keyed by "itemNum|variation" -> personal row (owned items)
  soldData: {},        // keyed by "itemNum|variation" -> sold row
  forSaleData: {},     // keyed by "itemNum|variation" -> for sale row
  wantData: {},
  upgradeData: {},        // keyed by "itemNum|variation" -> want list row
  isData: {},             // keyed by row# -> instruction sheet data
  scienceData: {},        // keyed by row# -> science set personal data
  constructionData: {},   // keyed by row# -> construction set personal data
  setData: [],         // all rows from Master Set list (read-only reference)
  mySetsData: {},      // keyed by "setNum|year" -> owned set record from personal My Sets tab
  companionData: [],   // all rows from Companions tab (engine/tender/B-unit relationships)
  catalogRefData: [],  // all rows from master Catalogs tab (reference list for paper item wizard)
  isRefData: [],       // all rows from master Instruction Sheets tab (reference list for IS wizard)
  filteredData: [],
  currentPage: 1,
  pageSize: 50,
  filters: { owned: false, unowned: false, boxed: false, wantList: false, type: '', road: '', search: '', quickEntry: '' },
  currentItem: null,
};

// ── Auth (beta gate, OAuth, sign-in/out, tokens) moved to app-auth.js (Session 110, Round 2 Chunk 11) ──
// ── UI builders, onboarding, sheet init + user-defined tabs moved to app-setup.js (Session 111, Round 2 Chunk 12) ──

// ── Data patches + loadAllData orchestrator moved to app-data.js (Session 111, Round 2 Chunk 13) ──

// ── Master sheet tab name config (era-aware — single source of truth) ────
// SHEET_TABS contents are swapped when the user changes era.
var SHEET_TABS = {};
var _currentEra = localStorage.getItem('lv_era') || 'pw';
// Migration: 'mod' era was merged into 'mpc' (MPC/Modern combined)
if (_currentEra === 'mod') { _currentEra = 'mpc'; try { localStorage.setItem('lv_era', 'mpc'); } catch(e) {} }
function _applyEraTabs(era) {
  Object.keys(SHEET_TABS).forEach(function(k) { delete SHEET_TABS[k]; });
  Object.assign(SHEET_TABS, ERA_TABS[era] || ERA_TABS.pw);
}
_applyEraTabs(_currentEra);
// Dynamic: returns only master-inventory tabs that exist for the current era
function _getMasterTabs() {
  return MASTER_TAB_KEYS.filter(function(k) { return !!SHEET_TABS[k]; })
    .map(function(k) { return SHEET_TABS[k]; });
}

// ── IndexedDB cache helper (for large data that exceeds localStorage quota) ──
var _idbReady = null;
function _openIDB() {
  if (_idbReady) return _idbReady;
  _idbReady = new Promise(function(resolve, reject) {
    var req = indexedDB.open('RailRosterCache', 1);
    req.onupgradeneeded = function() { req.result.createObjectStore('cache'); };
    req.onsuccess = function() { resolve(req.result); };
    req.onerror = function() { reject(req.error); };
  });
  return _idbReady;
}
function idbGet(key) {
  return _openIDB().then(function(db) {
    return new Promise(function(resolve) {
      var tx = db.transaction('cache', 'readonly');
      var req = tx.objectStore('cache').get(key);
      req.onsuccess = function() { resolve(req.result); };
      req.onerror = function() { resolve(null); };
    });
  }).catch(function() { return null; });
}
function idbSet(key, value) {
  return _openIDB().then(function(db) {
    return new Promise(function(resolve) {
      var tx = db.transaction('cache', 'readwrite');
      tx.objectStore('cache').put(value, key);
      tx.oncomplete = function() { resolve(); };
      tx.onerror = function() { resolve(); };
    });
  }).catch(function() {});
}
function idbRemove(key) {
  return _openIDB().then(function(db) {
    return new Promise(function(resolve) {
      var tx = db.transaction('cache', 'readwrite');
      tx.objectStore('cache').delete(key);
      tx.oncomplete = function() { resolve(); };
      tx.onerror = function() { resolve(); };
    });
  }).catch(function() {});
}

// ── Era preferences: which eras the user collects (admin override) ──
// Default: all eras enabled. Admin (per ADMIN_EMAILS in config.js) always sees all.
function _getEnabledEras() {
  try {
    var saved = localStorage.getItem('lv_collect_eras');
    if (saved) {
      var arr = JSON.parse(saved);
      if (Array.isArray(arr) && arr.length) return arr;
    }
  } catch(e) {}
  return Object.keys(ERAS); // default: all
}
function _setEnabledEras(arr) {
  try { localStorage.setItem('lv_collect_eras', JSON.stringify(arr || [])); } catch(e) {}
}
function _isEraEnabled(era) {
  // Admins always see every era regardless of preferences
  if (typeof _isAdmin === 'function' && _isAdmin()) return true;
  var enabled = _getEnabledEras();
  return enabled.indexOf(era) >= 0;
}
// Hide era-dropdown options the user has disabled. Always keep the CURRENT era
// visible so the user can switch away even if it's disabled.
function _applyEraVisibility() {
  var sel = document.getElementById('era-select');
  if (!sel) return;
  var isAdmin = (typeof _isAdmin === 'function' && _isAdmin());
  var enabled = _getEnabledEras();
  Array.from(sel.options).forEach(function(opt) {
    var visible = isAdmin || enabled.indexOf(opt.value) >= 0 || opt.value === _currentEra;
    opt.style.display = visible ? '' : 'none';
    opt.disabled = !visible;
  });
}

// ── Switch era: swap tabs, clear caches, reload ──
async function switchEra(era) {
  if (!ERAS[era]) return;
  _currentEra = era;
  localStorage.setItem('lv_era', era);
  _applyEraTabs(era);
  // Clear master caches so fresh load happens
  idbRemove('lv_master_cache');
  localStorage.removeItem('lv_master_cache_ts');
  localStorage.removeItem('lv_catalog_ref_cache');
  localStorage.removeItem('lv_catalog_ref_ts');
  localStorage.removeItem('lv_is_ref_cache');
  localStorage.removeItem('lv_is_ref_ts');
  // Reset state data
  state.masterData = [];
  _rebuildMasterIndex();
  state.setData = [];
  state.companionData = [];
  state.partnerMap = {};
  state.catalogRefData = [];
  state.isRefData = [];
  // Update browse page era dropdown
  var _sel = document.getElementById('era-select');
  if (_sel) _sel.value = era;
  // Re-apply visibility (hides eras the user opted out of)
  if (typeof _applyEraVisibility === 'function') _applyEraVisibility();
  // Reload data
  showLoading();
  showToast('Switching to ' + ERAS[era].label + ' era…');
  try {
    await loadMasterData();
    if (SHEET_TABS.sets) await loadSetData();
    if (SHEET_TABS.companions) await loadCompanionData();
    if (SHEET_TABS.companions || SHEET_TABS.sets) buildPartnerMap();
    await loadCatalogRefData();
    if (SHEET_TABS.instrSheets) await loadISRefData();
    await loadPersonalData();
    populateFilters();
    // If a cross-era search was in flight, re-apply the search term now that data is loaded
    if (state._pendingSearch) {
      var _ps = state._pendingSearch;
      state._pendingSearch = null;
      state.filters.search = _ps.toLowerCase();
      var _sInput = document.getElementById('browse-search');
      if (_sInput) _sInput.value = _ps;
      // Make sure we're on the browse page so the user sees the results
      if (typeof showPage === 'function') showPage('browse');
    }
    if (typeof renderBrowse === 'function') renderBrowse();
    if (typeof buildDashboard === 'function') buildDashboard();
    showToast(ERAS[era].label + ' era loaded — ' + (state.masterData||[]).length + ' items');
  } catch(e) { console.error('[switchEra]', e); showToast('Era switch error: ' + e.message); }
}

// ── Cross-era search: switch era and re-run the current search term ──
function _searchInOtherEra(era, searchTerm) {
  if (!ERAS[era] || era === _currentEra) return;
  state._pendingSearch = searchTerm || '';
  switchEra(era);
}

// ── Master/Catalog/IS/Set/Companion/Personal data loaders moved to app-data.js (Session 111, Round 2 Chunk 13) ──

// ── BUILD APP ───────────────────────────────────────────────────
function buildApp() {
  showApp();
  populateFilters();
  buildDashboard();
  _maybeShowAdminPrefs();
  _applyDisclaimerPref();
  // Apply era-dropdown visibility based on user prefs (admin sees all)
  if (typeof _applyEraVisibility === 'function') _applyEraVisibility();
  // Upgrade count badge
  const _uEl = document.getElementById('nav-upgrade-count');
  if (_uEl) { const _uc = Object.values(state.upgradeData||{}).length; _uEl.textContent = _uc > 0 ? _uc.toLocaleString() : '—'; }
  // Wire up the Google Sheet link in the sidebar
  const sheetLink = document.getElementById('nav-sheet-link');
  if (sheetLink && state.personalSheetId) {
    sheetLink.href = 'https://docs.google.com/spreadsheets/d/' + state.personalSheetId;
  }
  buildQuickEntryList();
  // Initialize location preference toggle
  const _locToggle = document.getElementById('pref-location-toggle');
  if (_locToggle) _locToggle.checked = _prefLocEnabled;
  // Browse, Sold, For Sale, Want, Reports built lazily on first nav via showPage()
  // Tutorial is NOT auto-launched. Replaced 2026-04-14 with showWelcomeCard
  // (Option C: single-page welcome) + maybeShowContextualHint (Option D:
  // dismissable hints on empty pages). Welcome card shows once for brand-new
  // users. Replayable from Preferences → Help & Tips.
  if (typeof showWelcomeCard === 'function') showWelcomeCard(false);
  // Initialize back-button interception after app is ready
  _initBackButton();
}

function showLoading() {
  const tb = document.getElementById('browse-tbody');
  if (tb) tb.innerHTML = '<tr><td colspan="9"><div class="loading" style="padding:3rem;flex-direction:column;gap:0.75rem"><div class="spinner" style="width:36px;height:36px;border-width:3px"></div><div style="font-size:0.9rem;color:var(--text-dim)">Loading The Rail Roster…</div><div style="font-size:0.75rem;color:var(--text-dim);opacity:0.7">Fetching master inventory</div></div></td></tr>';
}

// ── DASHBOARD ───────────────────────────────────────────────────


async function forceRefreshData() {
  const btn  = document.getElementById('refresh-btn');
  const icon = document.getElementById('refresh-icon');
  if (btn) btn.disabled = true;
  if (icon) icon.style.animation = 'spin 0.8s linear infinite';
  try {
    localStorage.removeItem('lv_personal_cache');
    localStorage.removeItem('lv_personal_cache_ts');
    // Wipe state completely so merge logic can't keep stale optimistic items
    state.personalData = {};
    state.soldData = {};
    state.forSaleData = {};
    state.wantData = {};
    await _loadPersonalFromSheets(state.personalSheetId, true);
    _cachePersonalData();
    resetFilters();
    buildDashboard();
    buildSoldPage();
    buildForSalePage();
    buildWantPage();
    renderBrowse();
    buildQuickEntryList && buildQuickEntryList();
    showToast('✓ Synced from Google Sheet');
    // Update sheet dashboard in background — non-blocking
    applySheetFormatting(state.personalSheetId).catch(() => {});
  } catch(e) {
    console.error('Sync error:', e);
    showToast('Sync failed: ' + e.message, 5000, true);
  } finally {
    if (btn)  btn.disabled = false;
    if (icon) icon.style.animation = '';
  }
}



// ── Dashboard — moved to dashboard.js (Session 63) ───────────

// ── Browse filters — moved to browse.js (Session 63) ────────


function buildQuickEntryList() {
  const container = document.getElementById('qe-list-container');
  if (!container) return;

  const qeItems = Object.values(state.personalData)
    .filter(pd => pd.owned && pd.quickEntry)
    .sort((a, b) => (b.row || 0) - (a.row || 0));

  if (qeItems.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:3rem 1rem">'
      + '<div style="font-size:3rem;margin-bottom:0.75rem">&#9889;</div>'
      + '<div style="font-weight:600;font-size:1rem;margin-bottom:0.4rem">No quick entries yet</div>'
      + '<div style="font-size:0.85rem;color:var(--text-dim);line-height:1.6">When you add an item using Quick Entry, it will appear here so you can come back and fill in the details.</div>'
      + '</div>';
    return;
  }

  // Update badge
  const badge = document.getElementById('nav-qe-count');
  if (badge) badge.textContent = qeItems.length;

  var gridEl = document.createElement('div');
  gridEl.style.cssText = 'display:flex;flex-direction:column;gap:0.5rem';
    qeItems.forEach(function(pd) {
    var master = state.masterData.find(function(m) {
      return m.itemNum === pd.itemNum && (!pd.variation || m.variation === pd.variation);
    }) || findMaster(pd.itemNum);
    var itemName = master ? (master.roadName || master.description || master.itemType || '') : '';
    var itemType = master ? (master.itemType || '') : '';
    var itemYear = master ? (master.yearProd || '') : '';
    var variation = pd.variation || '';
    var meta = [itemType, itemYear].filter(Boolean).join(' · ');

    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:0.85rem;padding:0.9rem 1rem;background:var(--surface);border:1.5px solid rgba(39,174,96,0.3);border-radius:12px;cursor:pointer;transition:all 0.15s';
    row.onmouseenter = function() { this.style.borderColor='#27ae60'; this.style.background='rgba(39,174,96,0.06)'; };
    row.onmouseleave = function() { this.style.borderColor='rgba(39,174,96,0.3)'; this.style.background='var(--surface)'; };
    row.onclick = (function(num, vari, pdInvId) { return function() {
      var globalIdx = state.masterData ? state.masterData.findIndex(function(m) {
        return m.itemNum === num && (!vari || m.variation === vari);
      }) : -1;
      completeQuickEntry(num, vari, globalIdx, pdInvId);
    }; })(pd.itemNum, variation, pd.inventoryId || '');

    var icon = document.createElement('div');
    icon.style.cssText = 'background:rgba(39,174,96,0.12);border-radius:8px;padding:0.5rem;flex-shrink:0';
    icon.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#27ae60" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';

    var info = document.createElement('div');
    info.style.cssText = 'flex:1;min-width:0';

    var topRow = document.createElement('div');
    topRow.style.cssText = 'display:flex;align-items:baseline;gap:0.5rem;flex-wrap:wrap';
    var numSpan = document.createElement('span');
    numSpan.style.cssText = 'font-family:var(--font-mono);font-weight:700;color:var(--accent2);font-size:1rem';
    numSpan.textContent = pd.itemNum;
    topRow.appendChild(numSpan);
    if (variation) {
      var varSpan = document.createElement('span');
      varSpan.style.cssText = 'font-size:0.75rem;color:var(--text-dim);background:var(--surface2);padding:0.1rem 0.4rem;border-radius:4px';
      varSpan.textContent = variation;
      topRow.appendChild(varSpan);
    }
    info.appendChild(topRow);

    if (itemName) {
      var nameEl = document.createElement('div');
      nameEl.style.cssText = 'font-size:0.85rem;color:var(--text-mid);margin-top:0.15rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
      nameEl.textContent = itemName;
      info.appendChild(nameEl);
    }
    if (meta) {
      var metaEl = document.createElement('div');
      metaEl.style.cssText = 'font-size:0.75rem;color:var(--text-dim);margin-top:0.1rem';
      metaEl.textContent = meta;
      info.appendChild(metaEl);
    }

    var right = document.createElement('div');
    right.style.cssText = 'flex-shrink:0;text-align:right';
    var addInfoBtn = document.createElement('button');
    addInfoBtn.textContent = 'Add Info';
    addInfoBtn.style.cssText = 'font-size:0.78rem;color:#fff;font-weight:600;background:#27ae60;border:none;padding:0.3rem 0.7rem;border-radius:6px;cursor:pointer;white-space:nowrap';
    addInfoBtn.onclick = (function(num, vari, pdInvId) { return function(e) {
      e.stopPropagation();
      var globalIdx = state.masterData ? state.masterData.findIndex(function(m) {
        return m.itemNum === num && (!vari || m.variation === vari);
      }) : -1;
      completeQuickEntry(num, vari, globalIdx, pdInvId);
    }; })(pd.itemNum, variation, pd.inventoryId || '');
    right.appendChild(addInfoBtn);

    row.appendChild(icon);
    row.appendChild(info);
    row.appendChild(right);
    gridEl.appendChild(row);
  });
  var footer = document.createElement('div');
  footer.style.cssText = 'margin-top:1rem;padding:0.75rem 1rem;background:rgba(39,174,96,0.06);border-radius:10px;border:1px solid rgba(39,174,96,0.2);font-size:0.82rem;color:var(--text-dim);text-align:center';
  footer.textContent = qeItems.length + ' item' + (qeItems.length !== 1 ? 's' : '') + ' waiting for details — tap any item to open and complete it.';

  container.innerHTML = '';
  container.appendChild(gridEl);
  container.appendChild(footer);
}

function goToMyCollection() {
  const navBtn = document.querySelector('.nav-item[onclick*="filterOwned"]');
  showPage('browse', navBtn);
  filterOwned();
  // mobile
  const mNav = document.getElementById('mnav-browse');
  if (mNav && window.innerWidth <= 640) { showPage('browse', mNav); filterOwned(); }
}
function goToWantList() {
  const navBtn = document.querySelector('.nav-item[onclick*="buildWantPage"]');
  showPage('want', navBtn);
  buildWantPage();
  const mNav = document.getElementById('mnav-want');
  if (mNav && window.innerWidth <= 640) { showPage('want', mNav); buildWantPage(); }
}


function onPageSearch(val, page) {
  const q = val.toLowerCase();
  if (page === 'browse') {
    state.filters.search = q;
    state.currentPage = 1;
    renderBrowse();
  } else if (page === 'sold') {
    state._soldSearch = q;
    buildSoldPage();
  } else if (page === 'sets') {
    state._setsSearch = q;
    buildSetsPage();
  } else if (page === 'forsale') {
    state._forsaleSearch = q;
    buildForSalePage();
  } else if (page === 'want') {
    state._wantSearch = q;
    buildWantPage();
  }
}

// ── Browse rendering — moved to browse.js (Session 63) ──────

// ── Item detail, owned-item menu, item modal, collection actions, saveItem, and want-partner prompt moved to app-collection.js (Session 111, Round 2 Chunk 15) ──
// ── REPORTS ─────────────────────────────────────────────────────

function _prefGet(key, def) { const v = localStorage.getItem(key); return v === null ? def : v; }
function _prefSet(key, val) { localStorage.setItem(key, val); }

// ── Theme ────────────────────────────────────────────────────────
function applyTheme() {
  const theme = _prefGet('lv_theme', 'dark');
  const main  = document.getElementById('main-content');
  const sidebar = document.querySelector('.sidebar');
  if (!main) return;
  if (theme === 'light') {
    // Force light mode everywhere — add light class to sidebar too
    if (sidebar) sidebar.classList.add('sidebar-light');
    document.documentElement.dataset.theme = 'light';
  } else if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (sidebar) sidebar.classList.toggle('sidebar-light', !prefersDark);
    document.documentElement.dataset.theme = prefersDark ? 'dark' : 'light';
  } else if (theme === 'high-contrast') {
    // Session 112 accessibility theme. CSS lives under
    // html[data-theme="high-contrast"] in app.css.
    if (sidebar) sidebar.classList.remove('sidebar-light');
    document.documentElement.dataset.theme = 'high-contrast';
  } else {
    if (sidebar) sidebar.classList.remove('sidebar-light');
    document.documentElement.dataset.theme = 'dark';
  }
}


// ── Ephemera/Want/eBay/Sold/ForSale page builders moved to app-pages.js (Session 111, Round 2 Chunk 14) ──

function showPage(name, clickedEl) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.mobile-nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  if (clickedEl) clickedEl.classList.add('active');
  if (name === 'browse') renderBrowse();
  if (name === 'collection' && typeof buildCollectionPage === 'function') buildCollectionPage();
  if (name === 'reports') buildReport();
  if (name === 'sold') buildSoldPage();
  if (name === 'forsale') buildForSalePage();
  if (name === 'want') buildWantPage();
  if (name === 'sets') buildSetsPage();
  if (name === 'browse' || name === 'sets') _applyDisclaimerPref();
  if (name === 'upgrade') buildUpgradePage();
  if (name === 'prefs') buildPrefsPage();
  if (name === 'vault') vaultRenderPage();
  if (name === 'tools' && typeof buildToolsPage === 'function') buildToolsPage();
  document.getElementById('main-content').scrollTop = 0;
  // Push history entry so back button returns here instead of closing the app
  if (!_navSuppressHistory) {
    history.pushState({ appPage: name }, '', '');
  }
}

// ── Sets/Disclaimer/Contact modal/Upgrade page builders moved to app-pages.js (Session 111, Round 2 Chunk 14) ──
// ── parseJwt moved to app-auth.js (Session 110, Round 2 Chunk 11) ──

// ── INIT ────────────────────────────────────────────────────────
window.onload = () => {
  // If a sign-in was in progress when the page reloaded (mobile Chrome
  // sometimes reloads on OAuth return), show the overlay immediately so
  // users don't see the auth screen flash before the token callback fires.
  try {
    if (sessionStorage.getItem('lv_signing_in') === '1' && typeof _showSignInLoadingOverlay === 'function') {
      _showSignInLoadingOverlay();
      window._signInInFlight = true;
    }
  } catch(e) {}
  if (typeof google !== 'undefined') initGoogle();
};

// ── Back-button handler — initialized inside buildApp() ─────────────────────
var _navSuppressHistory = false;
var _backPressTime = 0;
var _backButtonInited = false;

function _initBackButton() {
  if (_backButtonInited) return;
  _backButtonInited = true;

  // Seed TWO history entries:
  // Entry 0 (base): replaceState — this is the "exit" floor
  // Entry 1 (current): pushState — back button pops to entry 0, firing popstate
  history.replaceState({ appPage: 'base' }, '', '');
  history.pushState({ appPage: 'dashboard' }, '', '');

  window.addEventListener('popstate', function(e) {
    var state = e.state || {};

    // ── Case 1: Wizard is open ──
    var wizModal = document.getElementById('wizard-modal');
    if (wizModal && wizModal.classList.contains('open')) {
      if (typeof wizard !== 'undefined' && wizard.step > 0) {
        wizard.step--;
        // Step back over any skipIf steps
        while (wizard.step > 0 && wizard.steps[wizard.step] && wizard.steps[wizard.step].skipIf && wizard.steps[wizard.step].skipIf(wizard.data)) {
          wizard.step--;
        }
        if (typeof renderWizardStep === 'function') renderWizardStep();
      } else {
        if (typeof closeWizard === 'function') closeWizard();
      }
      history.pushState({ appPage: 'wizard' }, '', '');
      return;
    }

    // ── Case 2: Any overlay modal is open — close it ──
    var openOverlay = document.querySelector('.rb-overlay.open');
    if (!openOverlay) openOverlay = document.querySelector('#wizard-modal.open');
    if (openOverlay && openOverlay.id !== 'wizard-modal') {
      openOverlay.classList.remove('open');
      document.body.style.overflow = '';
      history.pushState({ appPage: 'modal-closed' }, '', '');
      return;
    }

    // ── Case 3: On a page other than dashboard — go to dashboard ──
    var activePage = document.querySelector('.page.active');
    var activePageId = activePage ? activePage.id.replace('page-', '') : 'dashboard';
    if (activePageId !== 'dashboard') {
      _navSuppressHistory = true;
      showPage('dashboard');
      _navSuppressHistory = false;
      history.pushState({ appPage: 'dashboard' }, '', '');
      return;
    }

    // ── Case 4: On dashboard — double-tap to exit ──
    var now = Date.now();
    if (now - _backPressTime < 2200) {
      // Second press — allow natural exit (don't re-push)
      return;
    }
    _backPressTime = now;
    if (typeof showToast === 'function') showToast('Press back again to exit', 2000);
    history.pushState({ appPage: 'dashboard' }, '', '');
  });
}


// ── iOS INSTALL HINT ────────────────────────────────────────────
// Shows a one-time banner on iOS Safari when app is not installed as PWA
// ── iOS install hint + offline banner + listeners (moved to app-misc.js — Session 110, Round 2 Chunk 10) ──
