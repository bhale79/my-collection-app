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
  (state.masterData || []).forEach(m => {
    const num = normalizeItemNum(m.itemNum);
    if ((m.poweredDummy || '').match(/^(P|D)$/i)) {
      ensure(num).isDiesel = true;
    }
    // Check for B-unit existence (itemNum + 'C')
    if (!num.endsWith('C')) {
      const bNum = num + 'C';
      if (state.masterData.some(mm => normalizeItemNum(mm.itemNum) === bNum)) {
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

// ── GOOGLE IDENTITY / AUTH ──────────────────────────────────────
var tokenClient;

// ── BETA GATE ──────────────────────────────────────────────────
const _BETA_CODE = 'BETA2026';

function _buildBetaGate() {
  var d = document.getElementById('beta-gate');
  if (!d || d.dataset.built) return;
  d.dataset.built = '1';
  d.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:2rem;background:var(--bg);text-align:center';
  d.innerHTML =
    '<div style="max-width:420px;width:100%">' +
      '<div style="font-family:var(--font-head);font-size:2.4rem;font-weight:700;color:var(--cream);letter-spacing:0.07em;text-transform:uppercase;margin-bottom:0.5rem">The <span style="color:var(--accent)">Rail</span> Roster</div>' +
      '<div style="font-size:0.75rem;letter-spacing:0.22em;color:var(--text-dim);text-transform:uppercase;font-family:var(--font-head);font-weight:400;margin-bottom:1.5rem">Postwar Collector\'s Inventory</div>' +
      '<div style="background:var(--accent);color:#fff;font-family:var(--font-head);font-size:0.85rem;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;padding:0.5rem 1.25rem;border-radius:6px;display:inline-block;margin-bottom:1.5rem">Beta Testing In Progress</div>' +
      '<p style="font-size:0.9rem;color:var(--text-mid);line-height:1.6;margin-bottom:1.5rem">A web-based inventory tool built for serious Lionel train collectors. Track every item, variation, and box in your collection — from postwar classics to modern production.</p>' +
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1.5rem;text-align:left">' +
        '<label style="font-size:0.8rem;color:var(--text-mid);display:block;margin-bottom:0.5rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Enter Invite Code</label>' +
        '<input type="text" id="beta-code-input" placeholder="Enter your beta access code" autocomplete="off" spellcheck="false" style="width:100%;padding:0.75rem 1rem;border:1px solid var(--border);border-radius:8px;background:var(--surface2);color:var(--text);font-family:var(--font-mono);font-size:1rem;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:0.75rem" onkeydown="if(event.key===\'Enter\')_checkBetaCode()">' +
        '<div id="beta-error" style="display:none;font-size:0.8rem;color:var(--accent);margin-bottom:0.75rem">Invalid code. Please check with your invite contact.</div>' +
        '<button onclick="_checkBetaCode()" style="width:100%;padding:0.75rem;border:none;border-radius:8px;background:var(--accent);color:#fff;font-family:var(--font-body);font-size:0.95rem;font-weight:600;cursor:pointer;transition:background 0.15s" onmouseenter="this.style.background=\'#d84800\'" onmouseleave="this.style.background=\'var(--accent)\'">Enter Beta</button>' +
      '</div>' +
      '<p style="font-size:0.75rem;color:var(--text-dim);margin-top:1.25rem">Don\'t have a code? Contact <a href="mailto:' + ADMIN_EMAIL + '" style="color:var(--accent2);text-decoration:none">' + ADMIN_EMAIL + '</a> to request access.</p>' +
    '</div>';
}

function _checkBetaCode() {
  var input = document.getElementById('beta-code-input');
  var code = (input.value || '').trim().toUpperCase();
  if (code === _BETA_CODE) {
    localStorage.setItem('lv_beta_verified', '1');
    _showAppAfterBeta();
  } else {
    document.getElementById('beta-error').style.display = 'block';
    input.style.borderColor = 'var(--accent)';
    input.focus();
  }
}

function _showAppAfterBeta() {
  document.getElementById('beta-gate').style.display = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
}

function _isBetaVerified() {
  return localStorage.getItem('lv_beta_verified') === '1';
}

// ══════════════════════════════════════════════════════════════════
// DYNAMIC UI BUILDERS — replaces static HTML in index.html
// ══════════════════════════════════════════════════════════════════

function _buildAuthScreen() {
  var d = document.getElementById('auth-screen');
  if (!d || d.dataset.built) return;
  d.dataset.built = '1';
  d.innerHTML =
    '<div class="auth-logo" style="line-height:1.1">' +
      '<div style="font-family:var(--font-head);font-size:2.4rem;font-weight:700;color:var(--cream);letter-spacing:0.07em;text-transform:uppercase">The <span style="color:var(--accent)">Rail</span> Roster</div>' +
      '<div style="font-size:0.75rem;letter-spacing:0.22em;color:var(--text-dim);margin-top:7px;text-transform:uppercase;font-family:var(--font-head);font-weight:400">Postwar Collector\'s Inventory</div>' +
    '</div>' +
    '<div class="auth-sub">Postwar Collector\'s Inventory</div>' +
    '<div style="display:flex;flex-direction:column;gap:0.6rem;margin:1.25rem 0;max-width:340px;text-align:left">' +
      '<div style="display:flex;align-items:flex-start;gap:0.75rem;background:rgba(200,16,46,0.06);border-radius:10px;padding:0.75rem 1rem">' +
        '<span style="font-size:1.3rem;flex-shrink:0">&#x1F4CB;</span>' +
        '<div style="font-size:0.88rem;color:var(--text-mid);line-height:1.5"><strong style="color:#fff">Catalog every item you own</strong><br>Condition, price paid, box, photos \u2014 all in one place.</div>' +
      '</div>' +
      '<div style="display:flex;align-items:flex-start;gap:0.75rem;background:rgba(200,16,46,0.06);border-radius:10px;padding:0.75rem 1rem">' +
        '<span style="font-size:1.3rem;flex-shrink:0">&#x1F4F8;</span>' +
        '<div style="font-size:0.88rem;color:var(--text-mid);line-height:1.5"><strong style="color:#fff">Store photos to Google Drive</strong><br>Every view, every box \u2014 organized automatically.</div>' +
      '</div>' +
      '<div style="display:flex;align-items:flex-start;gap:0.75rem;background:rgba(200,16,46,0.06);border-radius:10px;padding:0.75rem 1rem">' +
        '<span style="font-size:1.3rem;flex-shrink:0">&#x1F682;</span>' +
        '<div style="font-size:0.88rem;color:var(--text-mid);line-height:1.5"><strong style="color:#fff">Built for postwar collectors</strong><br>Pre-loaded master catalog of every item 1945\u20131969.</div>' +
      '</div>' +
    '</div>' +
    '<div class="auth-card">' +
      '<h2>Sign in to get started</h2>' +
      '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:1rem;margin-bottom:1rem;text-align:left">' +
        '<div style="font-size:0.85rem;font-weight:600;color:var(--cream);margin-bottom:0.4rem">Why Google sign-in?</div>' +
        '<p style="font-size:0.8rem;color:var(--text-mid);line-height:1.6;margin:0">This app stores your collection data in <strong style="color:var(--text)">your own Google Sheet</strong> and photos in <strong style="color:var(--text)">your own Google Drive</strong>. Nothing is stored on our servers \u2014 you own all your data and can access it anytime, even outside the app.</p>' +
      '</div>' +
      '<button class="btn-google" onclick="handleSignIn()">' +
        '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
          '<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>' +
          '<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>' +
          '<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>' +
          '<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>' +
        '</svg>' +
        'Continue with Google' +
      '</button>' +
      '<p class="auth-note">You\'ll be asked to allow access to Google Sheets and Google Drive. This is how the app reads and saves your collection data. We never see your password.</p>' +
      // Bugfix 2026-04-14: help for users without a Google account.
      '<div style="margin-top:1.25rem;padding:0.9rem 1rem;background:var(--surface2);border:1px solid var(--border);border-radius:10px;text-align:left">' +
        '<div style="font-size:0.82rem;font-weight:600;color:var(--cream);margin-bottom:0.35rem">Don\'t have a Google account?</div>' +
        '<p style="font-size:0.78rem;color:var(--text-mid);line-height:1.55;margin:0 0 0.5rem">A Google account is required so your collection and photos stay in <strong style="color:var(--text)">your own</strong> Google Sheet &amp; Drive. It\'s free and takes ~2 minutes to create.</p>' +
        '<ol style="font-size:0.78rem;color:var(--text-mid);line-height:1.7;margin:0 0 0.6rem 1rem;padding:0">' +
          '<li>Go to <a href="https://accounts.google.com/signup" target="_blank" rel="noopener" style="color:var(--accent2)">accounts.google.com/signup</a></li>' +
          '<li>Follow the prompts to create your free account</li>' +
          '<li>Come back here and tap <em>Continue with Google</em></li>' +
        '</ol>' +
        '<a href="https://accounts.google.com/signup" target="_blank" rel="noopener" style="display:inline-block;font-size:0.78rem;color:var(--accent);font-weight:600;text-decoration:none">Create Google account \u2197</a>' +
      '</div>' +
    '</div>';
}

function _buildSetupScreen() {
  var d = document.getElementById('setup-screen');
  if (!d || d.dataset.built) return;
  d.dataset.built = '1';
  d.innerHTML =
    '<div class="setup-card">' +
      '<h2>Welcome!</h2>' +
      '<p>One-time setup \u2014 just two steps to connect your inventory.</p>' +
      '<div class="setup-step"><div class="setup-num">1</div>' +
        '<p>Enter the Master Inventory Sheet ID (get this from whoever shared the app with you).</p>' +
      '</div>' +
      '<div class="setup-step"><div class="setup-num">2</div>' +
        '<p>Create a blank Google Sheet for your personal collection, then paste its ID below. Go to <a href="https://sheets.google.com" target="_blank" style="color:var(--accent2)">sheets.google.com</a>, create a blank sheet, name it "The Rail Roster", and copy the ID from the URL.</p>' +
      '</div>' +
      '<div class="input-group"><label>Master Sheet ID</label>' +
        '<input id="master-sheet-input" type="text" placeholder="1Y9-cg8C1CkIqy0RQ66DfP7fmGrE3IGBpyJbtdfYx8q0">' +
      '</div>' +
      '<div class="input-group" style="margin-top:0.75rem"><label>Your Personal Collection Sheet ID</label>' +
        '<input id="personal-sheet-input" type="text" placeholder="Paste your blank sheet ID here">' +
      '</div>' +
      '<div style="margin-top:1.25rem">' +
        '<button class="btn btn-primary" style="width:100%" onclick="completeSetup()">Set Up My Collection</button>' +
      '</div>' +
    '</div>';
}

function _buildAppShell() {
  var app = document.getElementById('app');
  if (!app || document.querySelector('.header')) return;
  // Build header
  var header = document.createElement('header');
  header.className = 'header';
  header.innerHTML =
    '<div class="header-logo">' +
      '<div style="font-family:var(--font-head);font-size:1.4rem;font-weight:700;color:var(--cream);letter-spacing:0.06em;text-transform:uppercase;line-height:1">The <span style="color:var(--accent)">Rail</span> Roster</div>' +
    '</div>' +
    '<div class="header-right" style="position:relative">' +
      '<div class="user-chip" id="user-chip" onclick="toggleAccountMenu()" role="button" aria-haspopup="true">' +
        '<div class="user-avatar" id="user-avatar">?</div>' +
        '<span id="user-name">Loading\u2026</span>' +
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-left:2px;opacity:0.6"><polyline points="6 9 12 15 18 9"/></svg>' +
      '</div>' +
      '<div class="account-menu" id="account-menu" style="display:none">' +
        '<div class="account-menu-header">' +
          '<div class="account-menu-avatar" id="account-menu-avatar"></div>' +
          '<div>' +
            '<div class="account-menu-name" id="account-menu-name"></div>' +
            '<div class="account-menu-email" id="account-menu-email"></div>' +
          '</div>' +
        '</div>' +
        '<div class="account-menu-divider"></div>' +
        '<button class="account-menu-item" onclick="toggleAccountMenu(); showPage(\'prefs\', null); buildPrefsPage()">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>' +
          'Preferences' +
        '</button>' +
        '<button class="account-menu-item account-menu-signout" onclick="handleSignOut()">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>' +
          'Sign Out' +
        '</button>' +
      '</div>' +
    '</div>';
  app.insertBefore(header, app.firstChild);
  // Build app-body wrapper with sidebar + main placeholder
  var appBody = document.createElement('div');
  appBody.className = 'app-body';
  var nav = document.createElement('nav');
  nav.className = 'sidebar';
  nav.innerHTML =
    '<div class="nav-section">' +
      '<button class="nav-item active" onclick="showPage(\'dashboard\', this)" data-ctip="This will take you to the main page so you can navigate to where you want to go!">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>' +
        'Dashboard' +
      '</button>' +
    '</div>' +
    '<div class="nav-section">' +
      '<button class="nav-item" onclick="showPage(\'browse\', this); resetFilters(); renderBrowse();" data-ctip="Opens the cataloged item master list.">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>' +
        'Cataloged Item Master List' +
      '</button>' +
      '<button class="nav-item" onclick="showPage(\'browse\', this); filterOwned()" data-ctip="This is your inventory list.">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>' +
        'My Collection List<span class="nav-badge" id="nav-owned" style="background:#f8e8c0;color:#1a1a1a">\u2014</span>' +
      '</button>' +
      '<button class="nav-item" onclick="showPage(\'want\', this); buildWantPage();" data-ctip="Your want list \u2014 great to take to a train show.">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
        'Want List<span class="nav-badge" id="nav-wanted2" style="background:#f8e8c0;color:#1a1a1a">\u2014</span>' +
      '</button>' +
      '<button class="nav-item" onclick="showPage(\'upgrade\', this); buildUpgradePage();" data-ctip="Track items you own but want to upgrade.">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>' +
        'Upgrade List<span class="nav-badge" id="nav-upgrade-count" style="background:#f8e8c0;color:#1a1a1a">\u2014</span>' +
      '</button>' +
      '<button class="nav-item" onclick="showPage(\'forsale\', this); buildForSalePage();" data-ctip="Items you have listed for sale.">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>' +
        'For Sale List<span class="nav-badge" id="nav-forsale" style="background:#f8e8c0;color:#1a1a1a">\u2014</span>' +
      '</button>' +
      '<button class="nav-item" onclick="showPage(\'sold\', this)" data-ctip="Items you have sold.">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>' +
        'Sold Items<span class="nav-badge" id="nav-sold" style="background:#f8e8c0;color:#1a1a1a">\u2014</span>' +
      '</button>' +
      '<button class="nav-item" id="nav-quickentry-btn" onclick="showPage(\'quickentry\', this); buildQuickEntryList();" data-ctip="Items quickly uploaded to fill in details later.">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
        'Quick Entry List<span class="nav-badge" id="nav-qe-count" style="background:#f8e8c0;color:#1a1a1a">\u2014</span>' +
      '</button>' +
    '</div>' +
    '<div class="nav-section">' +
      '<button class="nav-item" onclick="showPage(\'vault\', this); vaultRenderPage()" data-page="vault" data-ctip="Community market values, buy/sale trends, and rarity scores.">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>' +
        'Collector\'s Market' +
      '</button>' +
      '<button class="nav-item" onclick="showPage(\'tools\', this)" data-ctip="Smart tools to group items and build sets from your collection.">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>' +
        'Collection Tools' +
      '</button>' +
      '<button class="nav-item" onclick="showPage(\'reports\', this)" data-ctip="Generate reports for insurance, want lists, and more.">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>' +
        'Reports' +
      '</button>' +
      '<button class="nav-item" onclick="showPage(\'prefs\', this); buildPrefsPage()" data-ctip="Customize the app to your liking.">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>' +
        'Preferences' +
      '</button>' +
    '</div>' +
    '<div class="nav-section" style="padding-top:0.75rem;border-top:1px solid var(--border)">' +
      '<button id="refresh-btn" onclick="forceRefreshData()" data-ctip="Reload your data straight from your sheet."' +
        ' style="display:flex;align-items:center;gap:0.6rem;padding:0.55rem 0.75rem;border-radius:7px;color:var(--text-dim);font-size:0.82rem;background:none;border:none;width:100%;cursor:pointer;text-align:left;font-family:var(--font-body)"' +
        ' onmouseover="this.style.background=\'rgba(255,255,255,0.06)\';this.style.color=\'var(--text)\'"' +
        ' onmouseout="this.style.background=\'none\';this.style.color=\'var(--text-dim)\'">' +
        '<svg id="refresh-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>' +
        'Sync from Sheet' +
      '</button>' +
      '<button onclick="showContactModal()"' +
        ' style="display:flex;align-items:center;gap:0.6rem;padding:0.55rem 0.75rem;border-radius:7px;color:var(--text-dim);font-size:0.82rem;background:none;border:none;width:100%;cursor:pointer;text-align:left;font-family:var(--font-body)"' +
        ' onmouseover="this.style.background=\'rgba(255,255,255,0.06)\';this.style.color=\'var(--text)\'"' +
        ' onmouseout="this.style.background=\'none\';this.style.color=\'var(--text-dim)\'">' +
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>' +
        'Contact' +
      '</button>' +
    '</div>';
  // Move existing main content into app-body
  var existingMain = app.querySelector('main, .main, #main-content');
  appBody.appendChild(nav);
  if (existingMain) {
    app.removeChild(existingMain);
    appBody.appendChild(existingMain);
  }
  app.appendChild(appBody);
}


// ── OAuth Redirect Flow (no popups) ────────────────────────────
function _oauthRedirectUrl(prompt) {
  var redir = window.location.origin + window.location.pathname;
  // Strip trailing slash to match Google OAuth config exactly
  redir = redir.replace(/\/+$/, '');
  return 'https://accounts.google.com/o/oauth2/v2/auth' +
    '?client_id=' + encodeURIComponent(CLIENT_ID) +
    '&redirect_uri=' + encodeURIComponent(redir) +
    '&response_type=token' +
    '&scope=' + encodeURIComponent(SCOPES) +
    '&prompt=' + (prompt || 'select_account') +
    '&include_granted_scopes=true';
}

function _checkOAuthRedirect() {
  // Check if we're returning from a Google OAuth redirect
  var hash = window.location.hash;
  if (!hash || !hash.includes('access_token')) return false;

  // Parse the token from the URL hash
  var params = {};
  hash.substring(1).split('&').forEach(function(pair) {
    var kv = pair.split('=');
    params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
  });

  if (params.access_token) {
    // Clean the hash from the URL so it doesn't linger
    history.replaceState(null, '', window.location.pathname + window.location.search);

    // Store the token
    accessToken = params.access_token;
    var expiresIn = parseInt(params.expires_in || '3600');
    localStorage.setItem('lv_token', accessToken);
    localStorage.setItem('lv_token_expiry', String(Date.now() + (expiresIn - 300) * 1000));
    return true;
  }
  return false;
}

function _finishRedirectSignIn() {
  // Fetch user info since we don't have it from a popup callback
  fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: 'Bearer ' + accessToken }
  })
  .then(function(r) { return r.json(); })
  .then(function(info) {
    state.user = { name: info.given_name || info.name || 'User', email: info.email };
    localStorage.setItem('lv_user', JSON.stringify(state.user));
    // Now run the normal post-token flow
    _tokenIsInitial = true;
    onTokenReceived({ access_token: accessToken });
  })
  .catch(function(e) {
    console.error('[Auth] Failed to fetch user info after redirect:', e);
    showToast('Sign-in failed. Please try again.', 3000, true);
  });
}


function initGoogle() {
  _buildBetaGate();
  _buildAuthScreen();
  _buildSetupScreen();
  _buildAppShell();

  // Check if returning from OAuth redirect (GIS redirect mode)
  if (_checkOAuthRedirect()) {
    document.getElementById('beta-gate').style.display = 'none';
    document.getElementById('auth-screen').style.display = 'none';
    showApp();
    showLoading();
    _finishRedirectSignIn();
    return;
  }

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: onTokenReceived,
  });

  // Check for existing session — master ID is hardcoded, just need saved user
  const savedUser = localStorage.getItem('lv_user');
  const savedPersonalId = localStorage.getItem('lv_personal_id');
  state.masterSheetId = MASTER_SHEET_ID;
  localStorage.setItem('lv_master_id', state.masterSheetId);

  if (savedUser) {
    // Returning user — skip beta gate, they already have access
    document.getElementById('beta-gate').style.display = 'none';
    state.user = JSON.parse(savedUser);
    state.personalSheetId = savedPersonalId;
    showApp();
    showLoading();
    // If we already have a valid token (restored from localStorage), use it directly
    var _restoredExpiry = parseInt(localStorage.getItem('lv_token_expiry') || '0');
    if (accessToken && _restoredExpiry > Date.now() + 60 * 1000) {
      // Token is good for at least 1 more minute — load data now
      console.log('[Auth] Using restored token, skipping GIS popup');
      _tokenIsInitial = true;
      onTokenReceived({ access_token: accessToken });
      // Schedule a silent refresh for later
      if (window._tokenRefreshTimer) clearTimeout(window._tokenRefreshTimer);
      var _msLeft = _restoredExpiry - Date.now() - 5 * 60 * 1000;
      if (_msLeft < 60000) _msLeft = 60000;
      window._tokenRefreshTimer = setTimeout(function() {
        if (accessToken) {
          var hint = state.user?.email || '';
          tokenClient.requestAccessToken({ prompt: '', login_hint: hint });
        }
      }, _msLeft);
    } else {
      // Token expired or missing — must request a new one via GIS
      const savedEmail = state.user?.email || '';
      tokenClient.requestAccessToken({ prompt: '', login_hint: savedEmail });
    }
  } else if (_isBetaVerified()) {
    // Beta code already entered — show auth screen
    document.getElementById('beta-gate').style.display = 'none';
    // Bugfix 2026-04-14: if we're in the middle of an OAuth sign-in flow,
    // don't flash the auth screen behind the overlay. The overlay is already
    // shown by the window.onload handler that checks sessionStorage.
    var _midSignIn = false;
    try { _midSignIn = sessionStorage.getItem('lv_signing_in') === '1'; } catch(e) {}
    document.getElementById('auth-screen').style.display = _midSignIn ? 'none' : 'flex';
  } else {
    // New user, no beta code — show the gate, hide auth
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('beta-gate').style.display = 'flex';
  }
}

function handleSignIn() {
  // Use GIS popup flow — it caches consent so users only approve once
  // Popups work after user click (not blocked when triggered by button)
  // Bugfix 2026-04-14: cover the sign-in screen with a full overlay during
  // the OAuth round-trip so users don't see "Sign in to get started" again
  // after they pick their account. Persist the flag in sessionStorage too
  // so that if mobile Chrome reloads the page on OAuth return, we still
  // show the overlay during boot.
  if (window._signInInFlight) return; // ignore re-taps
  window._signInInFlight = true;
  try { sessionStorage.setItem('lv_signing_in', '1'); } catch(e) {}
  _showSignInLoadingOverlay();
  // Safety: if Google popup is cancelled/closed silently, restore screen after 45s
  if (window._signInSafetyTimer) clearTimeout(window._signInSafetyTimer);
  window._signInSafetyTimer = setTimeout(function() { _resetSignInButton(); }, 45000);
  try {
    tokenClient.requestAccessToken({ prompt: '' });
  } catch (e) {
    _resetSignInButton();
    if (typeof showToast === 'function') showToast('Sign-in failed: ' + e.message, 4000, true);
  }
}

function _showSignInLoadingOverlay() {
  var existing = document.getElementById('signin-loading-overlay');
  if (existing) return;
  var ov = document.createElement('div');
  ov.id = 'signin-loading-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:var(--bg,#0d0d1a);z-index:99997;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--text,#eee);font-family:var(--font-body,sans-serif);padding:1rem';
  ov.innerHTML =
    '<div style="text-align:center;max-width:340px">'
    +   '<div style="font-family:var(--font-head,sans-serif);font-size:1.6rem;font-weight:700;margin-bottom:1.5rem">'
    +     'THE <span style="color:var(--accent,#e04028)">RAIL</span> ROSTER'
    +   '</div>'
    +   '<div style="display:inline-block;width:44px;height:44px;border:3px solid rgba(255,255,255,0.15);border-top-color:var(--accent,#e04028);border-radius:50%;animation:spin 0.8s linear infinite;margin-bottom:1.2rem"></div>'
    +   '<div style="font-size:1rem;color:var(--text,#eee);margin-bottom:0.4rem">Signing you in…</div>'
    +   '<div style="font-size:0.8rem;color:var(--text-dim,#888);line-height:1.5">If a Google popup appeared, finish picking your account.<br>This usually takes a few seconds.</div>'
    + '</div>';
  document.body.appendChild(ov);
}

function _resetSignInButton() {
  // Hide the loading overlay (sign-in failed or was cancelled)
  var ov = document.getElementById('signin-loading-overlay');
  if (ov) ov.remove();
  window._signInInFlight = false;
  try { sessionStorage.removeItem('lv_signing_in'); } catch(e) {}
  if (window._signInSafetyTimer) { clearTimeout(window._signInSafetyTimer); window._signInSafetyTimer = null; }
  // Re-enable the .btn-google button (legacy state from earlier inline-spinner version)
  var _btn = document.querySelector('.btn-google');
  if (_btn && _btn.dataset.signing === '1') {
    _btn.dataset.signing = '';
    _btn.disabled = false;
    _btn.style.opacity = '';
    _btn.style.cursor = '';
    if (_btn.dataset.origHtml) _btn.innerHTML = _btn.dataset.origHtml;
  }
}

// Hide the loading overlay once the app actually shows (token success path).
// Hooked separately because onTokenReceived already calls _resetSignInButton
// on the error branch; on success we want the overlay to persist visually
// through showApp() until the dashboard renders, then disappear.
function _hideSignInOverlayWhenAppReady() {
  var ov = document.getElementById('signin-loading-overlay');
  if (!ov) return;
  // Fade out so the transition feels smoother than a hard cut
  ov.style.transition = 'opacity 0.25s';
  ov.style.opacity = '0';
  setTimeout(function() { if (ov && ov.parentNode) ov.remove(); }, 280);
  window._signInInFlight = false;
  try { sessionStorage.removeItem('lv_signing_in'); } catch(e) {}
  if (window._signInSafetyTimer) { clearTimeout(window._signInSafetyTimer); window._signInSafetyTimer = null; }
}
window._hideSignInOverlayWhenAppReady = _hideSignInOverlayWhenAppReady;

// ══════════════════════════════════════════════════════════════
// Welcome card (Option C) + contextual hints (Option D)
// Built 2026-04-14. Replaces the auto-launching tutorial tour.
//
// showWelcomeCard(force) — single-page intro modal. Auto-shows once for
//   brand-new users, replayable from Preferences → Help & Tips → Show.
//
// maybeShowContextualHint(spotId, message, anchorEl) — shows a small
//   dismissable hint banner once per spotId. Persists dismissal in
//   localStorage. Used by empty-state list pages.
//
// resetContextualHints() — un-dismisses all hints (Preferences action).
// ══════════════════════════════════════════════════════════════
const WELCOME_SEEN_KEY = 'lv_welcome_seen';
const HINT_PREFIX = 'lv_hint_';

function showWelcomeCard(force) {
  if (!force && localStorage.getItem(WELCOME_SEEN_KEY) === '1') return;
  const existing = document.getElementById('rr-welcome-card');
  if (existing) existing.remove();
  const ov = document.createElement('div');
  ov.id = 'rr-welcome-card';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.78);z-index:99998;display:flex;align-items:flex-start;justify-content:center;padding:18px;overflow-y:auto';
  ov.innerHTML =
    '<div style="background:var(--surface,#1a1a2e);border:1px solid var(--border,#333);border-radius:16px;max-width:480px;width:100%;padding:20px 22px 18px;color:var(--text,#eee);font-family:var(--font-body,sans-serif);max-height:calc(100vh - 36px);overflow-y:auto;-webkit-overflow-scrolling:touch;margin:auto 0;box-shadow:0 12px 40px rgba(0,0,0,0.5)">'
    + '<div style="text-align:center;margin-bottom:8px;font-size:1.4rem">🚂</div>'
    + '<div style="font-family:var(--font-head,sans-serif);font-size:1.35rem;text-align:center;font-weight:700;margin-bottom:4px">Welcome to <span style="color:var(--accent,#e04028)">The Rail Roster</span></div>'
    + '<div style="text-align:center;font-size:0.8rem;color:var(--text-dim,#888);margin-bottom:14px;letter-spacing:0.04em">Your Lionel collection, organized.</div>'
    + '<div style="font-size:0.88rem;color:var(--text-mid,#bbb);line-height:1.55;margin-bottom:14px">Three things to know:</div>'

    + '<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:12px;padding:10px 12px;background:var(--surface2,#222);border-radius:9px;border:1px solid var(--border,#333)">'
    +   '<div style="font-size:1.5rem;flex-shrink:0">📷</div>'
    +   '<div style="font-size:0.86rem;line-height:1.5"><strong style="color:var(--text,#eee)">Add fast.</strong> Tap <em>Add to Collection</em>, then either type the item number or scan the box barcode (modern items only). The catalog fills in everything we know.</div>'
    + '</div>'

    + '<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:12px;padding:10px 12px;background:var(--surface2,#222);border-radius:9px;border:1px solid var(--border,#333)">'
    +   '<div style="font-size:1.5rem;flex-shrink:0">📋</div>'
    +   '<div style="font-size:0.86rem;line-height:1.5"><strong style="color:var(--text,#eee)">Organize.</strong> Use the lists in the side menu — Collection, Want List, For Sale, Sold, Upgrade — to track every item through its lifecycle.</div>'
    + '</div>'

    + '<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:18px;padding:10px 12px;background:var(--surface2,#222);border-radius:9px;border:1px solid var(--border,#333)">'
    +   '<div style="font-size:1.5rem;flex-shrink:0">💾</div>'
    +   '<div style="font-size:0.86rem;line-height:1.5"><strong style="color:var(--text,#eee)">Your data, your control.</strong> Everything saves to your own Google Sheet &amp; Drive. Open them anytime from Preferences → Account.</div>'
    + '</div>'

    + '<div style="font-size:0.78rem;color:var(--text-dim,#888);line-height:1.5;margin-bottom:14px;text-align:center">Need this again? Preferences → Help &amp; Tips → Show Welcome Tour.</div>'

    + '<div style="display:flex;justify-content:center">'
    +   '<button id="rr-welcome-go" style="padding:0.7rem 1.6rem;border-radius:9px;border:none;background:var(--accent,#e04028);color:#fff;font-weight:600;font-family:inherit;font-size:0.95rem;cursor:pointer">Got it — let\'s go</button>'
    + '</div>'
    + '</div>';
  document.body.appendChild(ov);
  ov.querySelector('#rr-welcome-go').onclick = function() {
    localStorage.setItem(WELCOME_SEEN_KEY, '1');
    ov.remove();
  };
}
window.showWelcomeCard = showWelcomeCard;

function maybeShowContextualHint(spotId, message, anchorEl) {
  if (!spotId || !message) return;
  if (localStorage.getItem(HINT_PREFIX + spotId) === '1') return;
  if (!anchorEl) return;
  // Avoid duplicates if the page re-renders
  const existingHint = anchorEl.querySelector(':scope > .rr-ctx-hint[data-hint-id="' + spotId + '"]');
  if (existingHint) return;
  const hint = document.createElement('div');
  hint.className = 'rr-ctx-hint';
  hint.dataset.hintId = spotId;
  hint.style.cssText = 'background:rgba(232,64,28,0.1);border:1px solid var(--accent,#e04028);border-radius:10px;padding:10px 12px;margin:0 0 12px;display:flex;align-items:flex-start;gap:10px;font-size:0.85rem;color:var(--text-mid,#bbb);line-height:1.5';
  hint.innerHTML =
    '<div style="font-size:1.1rem;flex-shrink:0;color:var(--accent,#e04028)">💡</div>'
    + '<div style="flex:1">' + message + '</div>'
    + '<button onclick="(function(b){localStorage.setItem(\'' + HINT_PREFIX + spotId + '\',\'1\');b.closest(\'.rr-ctx-hint\').remove();})(this)" style="background:none;border:none;color:var(--text-dim,#888);font-size:1.1rem;cursor:pointer;padding:0 0.2rem;line-height:1;flex-shrink:0" title="Got it, hide this">×</button>';
  anchorEl.insertBefore(hint, anchorEl.firstChild);
}
window.maybeShowContextualHint = maybeShowContextualHint;

function resetContextualHints() {
  // Clear every hint dismissal flag
  Object.keys(localStorage).forEach(function(k) {
    if (k.startsWith(HINT_PREFIX)) localStorage.removeItem(k);
  });
}
window.resetContextualHints = resetContextualHints;

function onGoogleSignIn(response) {
  const payload = parseJwt(response.credential);
  state.user = { name: payload.given_name, email: payload.email, picture: payload.picture };
  localStorage.setItem('lv_user', JSON.stringify(state.user));
}

var accessToken = null;

// Restore token from localStorage (survives mobile page suspension)
(function _restoreToken() {
  var saved = localStorage.getItem('lv_token');
  var expiry = parseInt(localStorage.getItem('lv_token_expiry') || '0');
  if (saved && expiry > Date.now()) {
    accessToken = saved;
    console.log('[Auth] Restored token from localStorage, expires in', Math.round((expiry - Date.now())/60000), 'min');
  }
})();

// Track whether this is the first token receipt (triggers full load) or a background refresh (just updates token)
let _tokenIsInitial = true;

function onTokenReceived(resp) {
  // Bugfix 2026-04-14: only clear the sign-in overlay on ERROR path.
  // On SUCCESS path, leave the overlay up until showApp() runs — otherwise
  // the auth screen flashes for 2-3 seconds between token arrival and
  // dashboard render. showApp() calls _hideSignInOverlayWhenAppReady().
  if (resp.error) {
    try { _resetSignInButton(); } catch(e) {}
    console.error('Token error:', resp);
    // If silent token refresh failed, prompt user to sign in again
    if (resp.error === 'interaction_required' || resp.error === 'login_required') {
      _tokenIsInitial = true;
      // Show the sign-in screen so user can click the button (avoids popup blocker)
      document.getElementById('auth-screen').style.display = 'flex';
      document.getElementById('app').classList.remove('active');
    }
    return;
  }

  const isInitial = _tokenIsInitial;
  _tokenIsInitial = false; // all subsequent tokens are background refreshes

  accessToken = resp.access_token;
  // Persist token + expiry so it survives mobile page suspension
  localStorage.setItem('lv_token', accessToken);
  localStorage.setItem('lv_token_expiry', String(Date.now() + 55 * 60 * 1000));

  // Schedule next silent refresh 55 min from now (tokens last 1 hour)
  if (window._tokenRefreshTimer) clearTimeout(window._tokenRefreshTimer);
  window._tokenRefreshTimer = setTimeout(() => {
    if (accessToken) {
      const hint = state.user?.email || '';
      tokenClient.requestAccessToken({ prompt: '', login_hint: hint });
    }
  }, 55 * 60 * 1000);

  // Background refresh — just update the token, don't reload data
  if (!isInitial) {
    return;
  }

  // ── Initial sign-in / app startup path ──

  // Fetch user info from Google if we don't have it yet
  if (!state.user) {
    fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: 'Bearer ' + accessToken }
    })
    .then(r => r.json())
    .then(info => {
      state.user = { name: info.given_name || info.name || 'User', email: info.email };
      localStorage.setItem('lv_user', JSON.stringify(state.user));
      updateUserUI();
    }).catch(e => { console.warn('[Auth] User info fetch failed (non-fatal):', e); });
  } else {
    updateUserUI();
  }

  // Master sheet is hardcoded
  state.masterSheetId = MASTER_SHEET_ID;
  localStorage.setItem('lv_master_id', state.masterSheetId);

  // Always sync from Drive config to ensure correct sheet ID across devices
  driveReadConfig().then(async config => {
    if (config && config.personalSheetId) {
      // Always use Drive config as source of truth
      state.personalSheetId = config.personalSheetId;
      localStorage.setItem('lv_personal_id', config.personalSheetId);
      if (config.vaultId)      { driveCache.vaultId = config.vaultId;           localStorage.setItem('lv_vault_id', config.vaultId); }
      if (config.photosId)     { driveCache.photosId = config.photosId;         localStorage.setItem('lv_photos_id', config.photosId); }
      if (config.soldPhotosId) { driveCache.soldPhotosId = config.soldPhotosId; localStorage.setItem('lv_sold_photos_id', config.soldPhotosId); }
      loadAllData();
    } else {
      // Config file not found — try searching Drive by sheet name
      const foundId = await driveFindPersonalSheet();
      if (foundId) {
        state.personalSheetId = foundId;
        localStorage.setItem('lv_personal_id', foundId);
        // Write config so future loads are faster
        driveWriteConfig({ personalSheetId: foundId }).catch(() => {});
        loadAllData();
        return;
      }
      // No config and no sheet found — check localStorage before creating anything new
      state.personalSheetId = localStorage.getItem('lv_personal_id');
      if (!state.personalSheetId) {
        // No sheet found anywhere — create one for this new user
        createPersonalSheet().then(loadAllData).catch(e => {
          console.error('[Setup] createPersonalSheet failed:', e);
          showToast('Could not create your collection sheet. Please sign out and try again.', 4000, true);
          hideLoading();
        });
      } else {
        driveEnsureSetup().catch(e => console.warn('Drive setup:', e));
        loadAllData();
      }
    }
  }).catch(async () => {
    // Drive read failed — try searching by sheet name
    const foundId = await driveFindPersonalSheet();
    if (foundId) {
      state.personalSheetId = foundId;
      localStorage.setItem('lv_personal_id', foundId);
      driveWriteConfig({ personalSheetId: foundId }).catch(() => {});
      loadAllData();
      return;
    }
    // Fall back to localStorage
    state.personalSheetId = localStorage.getItem('lv_personal_id');
    if (!state.personalSheetId) {
      // No sheet found anywhere — create one for this new user
      createPersonalSheet().then(loadAllData).catch(e => {
        console.error('[Setup] createPersonalSheet failed:', e);
        showToast('Could not create your collection sheet. Please sign out and try again.', 4000, true);
        hideLoading();
      });
    } else {
      loadAllData();
    }
  });
}

// Refresh token when page resumes from background (e.g. returning from camera on mobile)
// ── Auto-lock sheet when app is closed ────────────────────────
function _autoLockOnClose() {
  if (!state.personalSheetId || typeof lockSheetTabs !== 'function') return;
  // Use sendBeacon-style fire-and-forget — best effort on close
  lockSheetTabs(state.personalSheetId).catch(() => {});
}
window.addEventListener('beforeunload', _autoLockOnClose);
document.addEventListener('pagehide', _autoLockOnClose);

document.addEventListener('visibilitychange', function() {
  // Auto-lock sheet when app is hidden/closed
  if (document.visibilityState === 'hidden' && state.personalSheetId) {
    if (typeof lockSheetTabs === 'function') {
      lockSheetTabs(state.personalSheetId).catch(() => {});
    }
  }
  if (document.visibilityState === 'visible' && state.user) {
    var expiry = parseInt(localStorage.getItem('lv_token_expiry') || '0');
    var savedToken = localStorage.getItem('lv_token');
    // Restore from localStorage if JS variable was lost (page suspension)
    if (!accessToken && savedToken && expiry > Date.now()) {
      accessToken = savedToken;
      console.log('[Auth] Restored token on resume');
    }
    // If token is expired or about to expire (< 5 min), request fresh one
    if (!accessToken || expiry < Date.now() + 5 * 60 * 1000) {
      console.log('[Auth] Token expired or expiring, requesting refresh');
      try {
        var hint = state.user?.email || '';
        tokenClient.requestAccessToken({ prompt: '', login_hint: hint });
      } catch(e) { console.warn('[Auth] Silent refresh failed:', e); }
    }
  }
});

function handleSignOut() {
  // Clear local state only — do NOT revoke the Google grant
  // (revoking forces full consent screens on every sign-in)
  localStorage.removeItem('lv_user');
  localStorage.removeItem('lv_token');
  localStorage.removeItem('lv_token_expiry');
  state.user = null;
  _tokenIsInitial = true; // ensure next sign-in triggers full data load
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app').classList.remove('active');
}

function toggleAccountMenu() {
  var menu = document.getElementById('account-menu');
  if (!menu) return;
  var isOpen = menu.style.display !== 'none';
  if (isOpen) {
    menu.style.display = 'none';
    document.removeEventListener('click', _accountMenuOutsideClick);
    return;
  }
  // Populate name/email/avatar each time it opens so it's always fresh
  var u = state.user || {};
  var nameEl = document.getElementById('account-menu-name');
  var emailEl = document.getElementById('account-menu-email');
  var avatarEl = document.getElementById('account-menu-avatar');
  if (nameEl) nameEl.textContent = u.name || '';
  if (emailEl) emailEl.textContent = u.email || '';
  if (avatarEl) {
    if (u.picture) {
      avatarEl.innerHTML = '<img src="' + u.picture + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover" alt="">';
    } else {
      avatarEl.textContent = (u.name || '?')[0].toUpperCase();
    }
  }
  menu.style.display = 'block';
  // Close when clicking outside — defer so this click doesn't immediately close it
  setTimeout(function() {
    document.addEventListener('click', _accountMenuOutsideClick);
  }, 0);
}

function _accountMenuOutsideClick(e) {
  var chip = document.getElementById('user-chip');
  var menu = document.getElementById('account-menu');
  if (menu && chip && !chip.contains(e.target)) {
    menu.style.display = 'none';
    document.removeEventListener('click', _accountMenuOutsideClick);
  }
}

function closeOnboarding() { var o = document.getElementById("onboarding-overlay"); if (o) o.remove(); setTimeout(function() { if (typeof vaultShowOptInModal === "function" && !localStorage.getItem("lv_vault_optin")) vaultShowOptInModal(false); }, 600); }

function showOnboarding() {
  if (localStorage.getItem('lv_onboarded')) return;
  localStorage.setItem('lv_onboarded', '1');
  const ov = document.createElement('div');
  ov.id = 'onboarding-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,14,20,0.92);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1.5rem';
  ov.innerHTML = '<div style="background:var(--surface);border-radius:18px;max-width:380px;width:100%;padding:2rem;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.5)">'
    + '<div style="margin-bottom:0.75rem;display:flex;justify-content:center"><img src="' + _RSV_PLACEHOLDER_PNG + '" style="width:90px;height:auto;opacity:0.9;border-radius:6px"></div>'
    + '<div style="font-family:var(--font-head);font-size:1.5rem;font-weight:700;margin-bottom:0.5rem;color:var(--text)">Welcome to <span style=\"color:var(--accent)\">The Rail Roster</span></div>'
    + '<div style="font-size:0.88rem;color:var(--text-mid);line-height:1.7;margin-bottom:1.5rem">Your personal postwar train collection manager. Here\'s how it works:</div>'
    + '<div style="display:flex;flex-direction:column;gap:0.75rem;text-align:left;margin-bottom:1.5rem">'
    + '<div style="display:flex;gap:0.75rem;align-items:flex-start"><div style="background:var(--accent);color:white;border-radius:50%;width:26px;height:26px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.85rem">1</div><div style="font-size:0.88rem;color:var(--text-mid);line-height:1.5"><strong style="color:var(--text)">Browse the Master Catalog</strong><br>Over 2,000 postwar items pre-loaded — engines, cars, accessories and more.</div></div>'
    + '<div style="display:flex;gap:0.75rem;align-items:flex-start"><div style="background:var(--accent);color:white;border-radius:50%;width:26px;height:26px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.85rem">2</div><div style="font-size:0.88rem;color:var(--text-mid);line-height:1.5"><strong style="color:var(--text)">Add items you own</strong><br>Tap Add Item, enter the number, and answer a few simple questions.</div></div>'
    + '<div style="display:flex;gap:0.75rem;align-items:flex-start"><div style="background:var(--accent);color:white;border-radius:50%;width:26px;height:26px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.85rem">3</div><div style="font-size:0.88rem;color:var(--text-mid);line-height:1.5"><strong style="color:var(--text)">Track your collection</strong><br>Photos, condition, value, want list — all saved to your Google account.</div></div>'
    + '</div>'
    + '<button onclick="closeOnboarding()" style="width:100%;padding:0.9rem;border-radius:12px;border:none;background:var(--accent);color:white;font-family:var(--font-body);font-size:1rem;font-weight:700;cursor:pointer">Get Started →</button>'
    + '<div style="font-size:0.75rem;color:var(--text-dim);margin-top:0.75rem">Tip: Use Quick Entry to log items fast, then fill in details later.</div>'
    + '</div>';
  document.body.appendChild(ov);
}

function showApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('setup-screen').classList.remove('active');
  const _appEl = document.getElementById('app');
  _appEl.style.opacity = '0';
  _appEl.classList.add('active');
  requestAnimationFrame(() => { _appEl.style.transition = 'opacity 0.3s ease'; _appEl.style.opacity = '1'; });
  updateUserUI();
  // Bugfix 2026-04-14: dismiss the sign-in loading overlay once the app
  // is rendered so the user doesn't see the auth screen flash back.
  if (typeof _hideSignInOverlayWhenAppReady === 'function') _hideSignInOverlayWhenAppReady();
  if (typeof tutShowHelpBtn === 'function') tutShowHelpBtn();
  const hr = new Date().getHours();
  const _greet = hr < 12 ? 'Good Morning' : hr < 17 ? 'Good Afternoon' : 'Good Evening';
  const _name = (state.user?.name || '').split(' ')[0] || 'Collector';
  document.getElementById('dash-greeting').innerHTML = _greet + ', <span style="color:var(--accent)">' + _name + '</span>';
}

function showSetup() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').classList.remove('active');
  document.getElementById('setup-screen').classList.add('active');
}

function updateUserUI() {
  if (!state.user) return;
  var nameEl = document.getElementById('user-name');
  var avatarEl = document.getElementById('user-avatar');
  if (nameEl) nameEl.textContent = state.user.name;
  if (avatarEl) {
    if (state.user.picture) {
      avatarEl.innerHTML = '<img src="' + state.user.picture + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover" alt="">';
    } else {
      avatarEl.textContent = state.user.name[0].toUpperCase();
    }
  }
}

async function completeSetup() {
  let rawMaster = document.getElementById('master-sheet-input').value.trim();
  let rawPersonal = document.getElementById('personal-sheet-input').value.trim();
  if (!rawMaster) { showToast('Please enter the Master Sheet ID.', 3000, true); return; }
  if (!rawPersonal) { showToast('Please enter your Personal Collection Sheet ID.', 3000, true); return; }

  // Extract IDs if full URLs were pasted
  const masterMatch = rawMaster.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  const personalMatch = rawPersonal.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  const masterId = masterMatch ? masterMatch[1] : rawMaster;
  const personalId = personalMatch ? personalMatch[1] : rawPersonal;

  state.masterSheetId = masterId;
  state.personalSheetId = personalId;
  localStorage.setItem('lv_master_id', masterId);
  localStorage.setItem('lv_personal_id', personalId);

  // Initialize personal sheet headers
  try {
    await initPersonalSheet(personalId);
    applySheetFormatting(personalId).catch(() => {});
    showApp();
    loadAllData();
  } catch(e) {
    console.error('Setup error:', e);
    showToast('Could not connect to sheet. Make sure you\'re signed in and the sheet exists.', 4000, true);
  }
}

async function initPersonalSheet(sheetId) {
  // Write My Collection title + headers if empty
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/My%20Collection!A1:M2`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  const rows = data.values || [];
  if (rows.length === 0 || !rows[0] || rows[0].length === 0) {
    // Brand new sheet — write title row 1 and headers row 2
    await sheetsUpdate(sheetId, 'My Collection!A1:A1', [['My Collection']]);
    await sheetsUpdate(sheetId, 'My Collection!A2:Y2', [PERSONAL_HEADERS]);
  } else if (rows.length === 1 || !rows[1] || rows[1].length < 13) {
    // Has title but missing/old headers — rewrite row 2
    await sheetsUpdate(sheetId, 'My Collection!A2:Y2', [PERSONAL_HEADERS]);
  }
  // Get existing sheet tab names
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const meta = await metaRes.json();
  const existingTabs = (meta.sheets || []).map(s => s.properties.title);

  // Build list of tabs to create
  const toCreate = [];
  if (!existingTabs.includes('Sold'))      toCreate.push({ addSheet: { properties: { title: 'Sold' } } });
  if (!existingTabs.includes('For Sale'))  toCreate.push({ addSheet: { properties: { title: 'For Sale' } } });
  if (!existingTabs.includes('Want List'))    toCreate.push({ addSheet: { properties: { title: 'Want List' } } });
  if (!existingTabs.includes('Upgrade List')) toCreate.push({ addSheet: { properties: { title: 'Upgrade List' } } });

  if (toCreate.length > 0) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: toCreate }),
    });
  }

  // Write headers to all tabs
  await sheetsUpdate(sheetId, 'Sold!A1:A1',      [['Sold']]);
  await sheetsUpdate(sheetId, 'Sold!A2:J2',      [SOLD_HEADERS]);
  await sheetsUpdate(sheetId, 'For Sale!A1:A1',   [['For Sale']]);
  await sheetsUpdate(sheetId, 'For Sale!A2:J2',   [FOR_SALE_HEADERS]);
  await sheetsUpdate(sheetId, 'Want List!A1:A1',    [['Want List']]);
  await sheetsUpdate(sheetId, 'Want List!A2:F2',    [WANT_HEADERS]);
  await sheetsUpdate(sheetId, 'Upgrade List!A1:A1', [['Upgrade List']]);
  await sheetsUpdate(sheetId, 'Upgrade List!A2:H2', [UPGRADE_HEADERS]);

  // Ephemera tabs
  await ensureEphemeraSheets(sheetId);
}

let _ensureEphemDone = false;
async function ensurePersonalHeaders(sheetId) {
  if (!sheetId) return;
  try {
    // Ensure all tabs exist (For Sale, Sold, Want List may not exist for older sheets)
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const meta = await metaRes.json();
    const existingTabs = (meta.sheets || []).map(s => s.properties.title);
    const toCreate = [];
    if (!existingTabs.includes('Sold'))      toCreate.push({ addSheet: { properties: { title: 'Sold' } } });
    if (!existingTabs.includes('For Sale'))  toCreate.push({ addSheet: { properties: { title: 'For Sale' } } });
    if (!existingTabs.includes('Want List'))    toCreate.push({ addSheet: { properties: { title: 'Want List' } } });
    if (!existingTabs.includes('Upgrade List')) toCreate.push({ addSheet: { properties: { title: 'Upgrade List' } } });
    if (toCreate.length > 0) {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: toCreate }),
      });
      // Write headers for newly created tabs
      if (!existingTabs.includes('Sold')) {
        await sheetsUpdate(sheetId, 'Sold!A1:A1', [['Sold']]);
        await sheetsUpdate(sheetId, 'Sold!A2:J2', [SOLD_HEADERS]);
      }
      if (!existingTabs.includes('For Sale')) {
        await sheetsUpdate(sheetId, 'For Sale!A1:A1', [['For Sale']]);
        await sheetsUpdate(sheetId, 'For Sale!A2:J2', [FOR_SALE_HEADERS]);
      }
      if (!existingTabs.includes('Want List')) {
        await sheetsUpdate(sheetId, 'Want List!A1:A1', [['Want List']]);
        await sheetsUpdate(sheetId, 'Want List!A2:F2', [WANT_HEADERS]);
      }
      if (!existingTabs.includes('Upgrade List')) {
        await sheetsUpdate(sheetId, 'Upgrade List!A1:A1', [['Upgrade List']]);
        await sheetsUpdate(sheetId, 'Upgrade List!A2:H2', [UPGRADE_HEADERS]);
      }
      console.log('[Setup] Created missing tabs:', toCreate.map(t => t.addSheet.properties.title).join(', '));
    }

    // Fetch current row 2 headers (A2:Y2 — 25 cols)
    const res = await sheetsGet(sheetId, 'My Collection!A2:Y2');
    const current = (res.values && res.values[0]) || [];

    // Check each expected header — write the full row if anything is missing or wrong
    const needsUpdate = PERSONAL_HEADERS.some((h, i) => current[i] !== h);
    if (needsUpdate) {
      await sheetsUpdate(sheetId, 'My Collection!A2:Y2', [PERSONAL_HEADERS]);
      console.log('[Headers] My Collection headers repaired');
    }

    // Also ensure row 1 title
    const titleRes = await sheetsGet(sheetId, 'My Collection!A1');
    const title = (titleRes.values && titleRes.values[0] && titleRes.values[0][0]) || '';
    if (title !== 'My Collection') {
      await sheetsUpdate(sheetId, 'My Collection!A1', [['My Collection']]);
    }

    // Repair Upgrade List headers if missing or wrong
    try {
      const upgRes = await sheetsGet(sheetId, 'Upgrade List!A2:H2');
      const upgCurrent = (upgRes.values && upgRes.values[0]) || [];
      const upgNeedsUpdate = UPGRADE_HEADERS.some((h, i) => upgCurrent[i] !== h);
      if (upgNeedsUpdate) {
        await sheetsUpdate(sheetId, 'Upgrade List!A1:A1', [['Upgrade List']]);
        await sheetsUpdate(sheetId, 'Upgrade List!A2:H2', [UPGRADE_HEADERS]);
        console.log('[Headers] Upgrade List headers repaired');
      }
    } catch(e) {
      console.warn('[Headers] Upgrade List header check failed:', e.message);
    }

    // Repair Sold / For Sale / Want List headers (Manufacturer column added — new users ok,
    // older users need this to pick up the schema change without data loss).
    var _tabsToCheck = [
      { name: 'Sold',      range: 'Sold!A2:J2',      headers: SOLD_HEADERS     },
      { name: 'For Sale',  range: 'For Sale!A2:J2',  headers: FOR_SALE_HEADERS },
      { name: 'Want List', range: 'Want List!A2:F2', headers: WANT_HEADERS     },
    ];
    for (var _i = 0; _i < _tabsToCheck.length; _i++) {
      var _t = _tabsToCheck[_i];
      try {
        var _hr = await sheetsGet(sheetId, _t.range);
        var _cur = (_hr.values && _hr.values[0]) || [];
        var _need = _t.headers.some(function(h, i) { return _cur[i] !== h; });
        if (_need) {
          await sheetsUpdate(sheetId, _t.range, [_t.headers]);
          console.log('[Headers] ' + _t.name + ' headers repaired');
        }
      } catch(e) {
        console.warn('[Headers] ' + _t.name + ' header check failed:', e.message);
      }
    }
  } catch(e) {
    console.warn('[Headers] ensurePersonalHeaders failed:', e.message);
  }
}

async function ensureEphemeraSheets(sheetId) {
  if (_ensureEphemDone) return;  // Only run once per session — tabs and headers don't change
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const meta = await metaRes.json();
  const existingTabs = (meta.sheets || []).map(s => s.properties.title);
  const tabNames = { catalogs:'Catalogs', paper:'Paper Items', mockups:'Mock-Ups', other:'Other Lionel' };
  const toCreate = [];
  Object.values(tabNames).forEach(t => {
    if (!existingTabs.includes(t)) toCreate.push({ addSheet: { properties: { title: t } } });
  });
  if (toCreate.length > 0) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: toCreate }),
    });
  }
  // Write headers — clear extra columns first to fix any stale headers
  // Clear row 1 and row 2 across all ephemera tabs (A1:Q covers any previous wide headers)
  const _clearReqs = ['Catalogs','Paper Items','Mock-Ups','Other Lionel'].map(t => ({
    updateCells: {
      range: { sheetId: 0, startRowIndex: 0, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 17 },
      fields: 'userEnteredValue',
    }
  }));
  // Use values API to clear then rewrite cleanly
  await sheetsUpdate(sheetId, 'Catalogs!A1:Q1',    [['Catalogs','','','','','','','','','','','','','','','','']]);
  await sheetsUpdate(sheetId, 'Catalogs!A2:J2',    [CATALOG_HEADERS]);
  await sheetsUpdate(sheetId, 'Paper Items!A1:Q1', [['Paper Items','','','','','','','','','','','','','','','','']]);
  await sheetsUpdate(sheetId, 'Paper Items!A2:N2', [EPHEMERA_HEADERS]);
  await sheetsUpdate(sheetId, 'Mock-Ups!A1:Q1',    [['Mock-Ups','','','','','','','','','','','','','','','','']]);
  await sheetsUpdate(sheetId, 'Mock-Ups!A2:Q2',    [MOCKUP_HEADERS]);
  await sheetsUpdate(sheetId, 'Other Lionel!A1:Q1',[['Other Lionel','','','','','','','','','','','','','','','','']]);
  await sheetsUpdate(sheetId, 'Other Lionel!A2:N2',[EPHEMERA_HEADERS]);
  _ensureEphemDone = true;  // Don't run again this session
  // Instruction Sheets tab
  if (!existingTabs.includes('Instruction Sheets')) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
      method:'POST', headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},
      body: JSON.stringify({ requests:[{ addSheet:{ properties:{ title:'Instruction Sheets' } } }] }),
    });
  }
  await sheetsUpdate(sheetId, 'Instruction Sheets!A1:A1', [['Instruction Sheets']]);
  await sheetsUpdate(sheetId, 'Instruction Sheets!A2:K2', [IS_HEADERS]);
  // Science Sets tab
  if (!existingTabs.includes('Science Sets')) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
      method:'POST', headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},
      body: JSON.stringify({ requests:[{ addSheet:{ properties:{ title:'Science Sets' } } }] }),
    });
  }
  await sheetsUpdate(sheetId, 'Science Sets!A1:A1', [['Science Sets']]);
  await sheetsUpdate(sheetId, 'Science Sets!A2:O2', [SCIENCE_HEADERS]);
  // Construction Sets tab
  if (!existingTabs.includes('Construction Sets')) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
      method:'POST', headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},
      body: JSON.stringify({ requests:[{ addSheet:{ properties:{ title:'Construction Sets' } } }] }),
    });
  }
  await sheetsUpdate(sheetId, 'Construction Sets!A1:A1', [['Construction Sets']]);
  await sheetsUpdate(sheetId, 'Construction Sets!A2:O2', [CONSTRUCTION_HEADERS]);
  // My Sets tab
  if (!existingTabs.includes('My Sets')) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
      method:'POST', headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},
      body: JSON.stringify({ requests:[{ addSheet:{ properties:{ title:'My Sets' } } }] }),
    });
  }
  await sheetsUpdate(sheetId, 'My Sets!A1:A1', [['My Sets']]);
  await sheetsUpdate(sheetId, 'My Sets!A2:N2', [MY_SETS_HEADERS]);
}


// ── Drive helpers — moved to drive.js (Session 63) ──────────

// ── SHEETS API — moved to sheets.js (Session 63) ───────────────

async function createPersonalSheet() {
  // 0. Wait for user info if not yet loaded (async race on first sign-in)
  if (!state.user || !state.user.name) {
    try {
      const info = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: 'Bearer ' + accessToken }
      }).then(r => r.json());
      state.user = { name: info.given_name || info.name || 'My', email: info.email, picture: info.picture };
      localStorage.setItem('lv_user', JSON.stringify(state.user));
      updateUserUI();
    } catch(e) { console.warn('[Setup] Could not fetch user info:', e); }
  }

  // 1. Set up Drive vault folders first
  await driveSetupVault();

  // 2. Create new spreadsheet
  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      properties: { title: _getPersonalSheetName() },
      sheets: [{ properties: { title: 'My Collection' } }]
    })
  });
  const data = await res.json();
  state.personalSheetId = data.spreadsheetId;
  localStorage.setItem('lv_personal_id', state.personalSheetId);

  // 3. Write headers and create all tabs
  await sheetsUpdate(state.personalSheetId, 'My Collection!A1:A1', [['My Collection']]);
  await sheetsUpdate(state.personalSheetId, 'My Collection!A2:Y2', [PERSONAL_HEADERS]);
  await initPersonalSheet(state.personalSheetId);

  // 4. Move the sheet file into the vault folder
  try { await driveMoveSheetToVault(state.personalSheetId); } catch(e) { console.warn('Could not move sheet to vault:', e); }

  // 5. Write config to Drive so other devices can find this sheet
  await driveWriteConfig({
    personalSheetId: state.personalSheetId,
    vaultId: driveCache.vaultId,
    photosId: driveCache.photosId,
    soldPhotosId: driveCache.soldPhotosId,
  });

  return state.personalSheetId;
}

// ── LOAD DATA ───────────────────────────────────────────────────
// Load/save user-defined tab names
function loadUserDefinedTabs() {
  try {
    state.userDefinedTabs = JSON.parse(localStorage.getItem('lv_user_tabs') || '[]');
  } catch(e) { state.userDefinedTabs = []; }
}
function saveUserDefinedTabs() {
  localStorage.setItem('lv_user_tabs', JSON.stringify(state.userDefinedTabs));
}

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
    // Load master data (uses cache if fresh) and personal data in parallel
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

async function loadMasterData() {
  // Use cached master data for instant load, refresh in background
  // Master data stored in IndexedDB (too large for localStorage)
  const _CACHE_VER = '112';
  if (localStorage.getItem('lv_cache_ver') !== _CACHE_VER) {
    idbRemove('lv_master_cache');
    localStorage.removeItem('lv_master_cache');  // clean up old localStorage entry
    localStorage.removeItem('lv_personal_cache');
    localStorage.removeItem('lv_catalog_ref_cache');
    localStorage.removeItem('lv_catalog_ref_ts');
    localStorage.removeItem('lv_is_ref_cache');
    localStorage.removeItem('lv_is_ref_ts');
    localStorage.setItem('lv_cache_ver', _CACHE_VER);
  }
  var cached = await idbGet('lv_master_cache');
  const cachedAt = parseInt(localStorage.getItem('lv_master_cache_ts') || '0');
  const cacheAge = Date.now() - cachedAt;
  const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  if (cached && cacheAge < CACHE_TTL) {
    try {
      state.masterData = cached;
      _rebuildMasterIndex();
      if (typeof ERAS !== 'undefined' && _currentEra) { ERAS[_currentEra]._total = state.masterData.length; try { localStorage.setItem('lv_era_total_' + _currentEra, state.masterData.length); } catch(e) {} }
      // Background refresh from multi-tab
      _fetchMasterTabs().then(allRows => {
        if (allRows.length) {
          state.masterData = _deduplicateMaster(allRows);
          _rebuildMasterIndex();
          if (typeof ERAS !== 'undefined' && _currentEra) { ERAS[_currentEra]._total = state.masterData.length; try { localStorage.setItem('lv_era_total_' + _currentEra, state.masterData.length); } catch(e) {} }
          idbSet('lv_master_cache', state.masterData);
          localStorage.setItem('lv_master_cache_ts', Date.now().toString());
          if (typeof renderBrowse === 'function') renderBrowse();
        }
      }).catch(() => {});
      return;
    } catch(e) {}
  }

  const allRows = await _fetchMasterTabs();
  state.masterData = _deduplicateMaster(allRows);
  _rebuildMasterIndex();
  if (typeof ERAS !== 'undefined' && _currentEra) { ERAS[_currentEra]._total = state.masterData.length; try { localStorage.setItem('lv_era_total_' + _currentEra, state.masterData.length); } catch(e) {} }
  idbSet('lv_master_cache', state.masterData);
  localStorage.setItem('lv_master_cache_ts', Date.now().toString());
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
  const CACHE_KEY = 'lv_catalog_ref_cache';
  const CACHE_TS  = 'lv_catalog_ref_ts';
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
  if (!SHEET_TABS.instrSheets) { state.isRefData = []; return; }
  // Fetch Instruction Sheets tab from master sheet
  // Columns: A=IS ID, B=Item Number, C=Description, D=Category, E=Variations, F=Notes
  const CACHE_KEY = 'lv_is_ref_cache';
  const CACHE_TS  = 'lv_is_ref_ts';
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
  try {
    const cached = localStorage.getItem('lv_set_cache');
    const cachedAt = parseInt(localStorage.getItem('lv_set_cache_ts') || '0');
    if (cached && (Date.now() - cachedAt) < 24*60*60*1000) {
      state.setData = JSON.parse(cached);
      // Background refresh
      (SHEET_TABS.sets ? sheetsGet(state.masterSheetId, SHEET_TABS.sets + '!A2:U').catch(() => sheetsGet(state.masterSheetId, 'Master Set list!A2:U')) : Promise.resolve({values:[]})).then(res => {
        if (res && res.values) {
          parseSetRows(res.values);
          localStorage.setItem('lv_set_cache', JSON.stringify(state.setData));
          localStorage.setItem('lv_set_cache_ts', Date.now().toString());
        }
      }).catch(() => {});
      return;
    }
    let res;
    if (!SHEET_TABS.sets) { state.setData = []; return; }
    try { res = await sheetsGet(state.masterSheetId, SHEET_TABS.sets + '!A2:U'); }
    catch(_) { res = await sheetsGet(state.masterSheetId, 'Master Set list!A2:U'); }
    parseSetRows((res && res.values) || []);
    localStorage.setItem('lv_set_cache', JSON.stringify(state.setData));
    localStorage.setItem('lv_set_cache_ts', Date.now().toString());
  } catch(e) { console.warn('loadSetData:', e); state.setData = []; }
}

async function loadCompanionData() {
  try {
    const cached = localStorage.getItem('lv_companion_cache');
    const cachedAt = parseInt(localStorage.getItem('lv_companion_cache_ts') || '0');
    if (cached && (Date.now() - cachedAt) < 24*60*60*1000) {
      state.companionData = JSON.parse(cached);
      (SHEET_TABS.companions ? sheetsGet(state.masterSheetId, SHEET_TABS.companions + '!A2:E').catch(() => sheetsGet(state.masterSheetId, 'Companions!A2:E')) : Promise.resolve({values:[]})).then(res => {
        if (res && res.values) {
          parseCompanionRows(res.values);
          localStorage.setItem('lv_companion_cache', JSON.stringify(state.companionData));
          localStorage.setItem('lv_companion_cache_ts', Date.now().toString());
        }
      }).catch(() => {});
      return;
    }
    let res;
    if (!SHEET_TABS.companions) { state.companionData = []; return; }
    try { res = await sheetsGet(state.masterSheetId, SHEET_TABS.companions + '!A2:E'); }
    catch(_) { res = await sheetsGet(state.masterSheetId, 'Companions!A2:E'); }
    parseCompanionRows((res && res.values) || []);
    localStorage.setItem('lv_companion_cache', JSON.stringify(state.companionData));
    localStorage.setItem('lv_companion_cache_ts', Date.now().toString());
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
  if (typeof populateFilters === 'function' && document.getElementById('filter-type') &&
      document.getElementById('filter-type').options.length > 1) {
    document.getElementById('filter-type').innerHTML = '<option value="">All Types</option>';
    document.getElementById('filter-road').innerHTML = '<option value="">All Roads</option>';
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

// ── My Collection Detail Popup ──
function showItemDetailPage(idx) {
  const item = idx >= 0 ? state.masterData[idx] : null;
  let pd = null, pdKey = null;
  if (item) {
    pdKey = findPDKey(item.itemNum, item.variation);
    pd = pdKey ? state.personalData[pdKey] : null;
  } else {
    const poKey = window._poKeys ? window._poKeys[-(idx+1000)] : null;
    pd = poKey ? state.personalData[poKey] : null;
    pdKey = poKey;
  }
  if (!pd && !item) return;
  // Infer type from suffix for personal-only items
  let _detailType = pd && pd.itemType ? pd.itemType : '';
  let _baseItem = null; // master data for the base item (e.g. 2032 for 2032-P)
  if (!item && pd) {
    const _dn = (pd.itemNum || '').toUpperCase();
    if (_dn.endsWith('-MBOX'))      _detailType = _detailType || 'Master Carton';
    else if (_dn.endsWith('-BOX'))  _detailType = _detailType || 'Box';
    else if (_dn.endsWith('-P'))    _detailType = _detailType || 'Powered Unit';
    else if (_dn.endsWith('-T'))    _detailType = _detailType || 'Dummy Unit';
    // Strip suffix to find the base item in master data for description/roadName/varDesc
    const _baseNum = pd.itemNum.replace(/-(P|T|BOX|MBOX)$/i, '');
    if (_baseNum !== pd.itemNum) {
      _baseItem = state.masterData.find(m => m.itemNum === _baseNum && (!pd.variation || m.variation === pd.variation))
               || findMaster(_baseNum);
    }
  }
  const it = item || {
    itemNum: pd.itemNum, variation: pd.variation || '',
    itemType: _detailType || (_baseItem ? _baseItem.itemType : ''),
    roadName: pd.roadName || (_baseItem ? _baseItem.roadName : ''),
    description: _baseItem ? _baseItem.description : '',
    yearProd: pd.yearMade || (_baseItem ? _baseItem.yearProd : ''),
    marketVal: _baseItem ? _baseItem.marketVal : '',
    varDesc: _baseItem ? _baseItem.varDesc : '',
    refLink: _baseItem ? _baseItem.refLink : '',
  };

  // Show page
  showPage('itemdetail');
  const container = document.getElementById('item-detail-content');
  if (!container) return;

  const cond = pd && pd.condition ? parseInt(pd.condition) : null;
  const condClass = cond >= 9 ? 'cond-9' : cond >= 7 ? 'cond-7' : cond >= 5 ? 'cond-5' : cond ? 'cond-low' : '';
  const isForSale = !!state.forSaleData[`${it.itemNum}|${it.variation||''}`];
  const _fsEntry = state.forSaleData[`${it.itemNum}|${it.variation||''}`];
  const _fsPrice = _fsEntry ? '$' + parseFloat(_fsEntry.askingPrice || 0).toLocaleString() : '';
  const groupMembers = pd && pd.groupId ? Object.values(state.personalData).filter(p => p.groupId === pd.groupId && p.itemNum !== it.itemNum) : [];

  // ── HEADER ──
  const _fromTools = window._detailReturn === 'tools';
  const _backLabel = _fromTools ? 'Back to Collection Tools' : 'Back to Collection';
  const _backFn    = _fromTools ? 'delete window._detailReturn;showPage(&apos;tools&apos;);buildToolsPage()' : 'showPage(&apos;browse&apos;);filterOwned()';
  let html = `
  <div style="margin-bottom:1.5rem">
    <button onclick="${_backFn}" style="background:none;border:none;color:#2980b9;font-family:var(--font-body);font-size:1.1rem;font-weight:700;cursor:pointer;padding:0;margin-bottom:0.75rem;display:flex;align-items:center;gap:0.4rem">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
      ${_backLabel}
    </button>
    <div style="display:flex;align-items:flex-start;gap:1rem;flex-wrap:wrap">
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;margin-bottom:0.25rem">
          <span style="font-family:var(--font-head);font-size:1.6rem;color:var(--accent);letter-spacing:0.03em">No. ${it.itemNum}${it.poweredDummy === 'P' ? '-P' : it.poweredDummy === 'D' ? '-D' : ''}</span>
          ${isForSale ? `<span style="font-size:1rem;color:var(--gold);font-family:var(--font-head);letter-spacing:0.02em">— on the sale list for ${_fsPrice}</span>` : ''}
          ${it.variation ? `<span style="font-size:0.9rem;color:var(--text-dim);background:var(--surface2);border-radius:6px;padding:0.15rem 0.6rem">Var. ${it.variation}</span>` : ''}
          ${it.itemType ? `<span class="tag">${it.itemType}</span>` : ''}
          ${it.yearProd ? `<span style="font-size:0.82rem;color:var(--text-dim)">${it.yearProd}</span>` : ''}
        </div>
        <div style="font-size:1.05rem;color:var(--text);margin-bottom:0.2rem">${it.roadName || ''}</div>
        ${it.description ? `<div style="font-size:0.85rem;color:var(--text-mid);line-height:1.5;margin-top:0.3rem"><strong style="color:var(--text)">Description:</strong> ${it.description}</div>` : ''}
        ${it.varDesc ? `<div style="font-size:0.85rem;color:var(--text-mid);line-height:1.5;margin-top:0.3rem"><strong style="color:var(--text)">Variation Description:</strong> ${it.varDesc}</div>` : ''}
        ${it.refLink ? `<a href="${it.refLink}" target="_blank" rel="noopener" style="font-size:0.78rem;color:var(--accent2);text-decoration:none;display:inline-flex;align-items:center;gap:0.3rem;margin-top:0.4rem">View on COTT <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.4rem;flex-shrink:0">
        <span class="owned-badge ${isForSale ? 'forsale' : 'yes'}" style="font-size:0.85rem">${isForSale ? '\ud83c\udff7\ufe0f For Sale' : '\u2713 In Collection'}</span>
        ${cond ? `<span style="font-size:0.85rem"><span class="condition-pip ${condClass}"></span> ${cond}/10</span>` : ''}
      </div>
    </div>
  </div>`;

  // ── ACTION TOOLBAR ──
  html += `
  <div style="display:flex;gap:0.5rem;margin-bottom:1.5rem;flex-wrap:wrap">
    <button onclick="showItemDetailPage_edit(${idx})" data-ctip="Edit this item's details and add photos all in one place." style="padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #2980b9;background:rgba(41,128,185,0.1);color:#2980b9;font-family:var(--font-body);font-size:0.82rem;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:0.4rem">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      Update Info &amp; Add Pictures
    </button>
    <button onclick="collectionActionSold(${idx},'${it.itemNum}','${(it.variation||'').replace(/'/g,"&apos;")}')" data-ctip="Did you sell something? Record that here." style="padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #2ecc71;background:rgba(46,204,113,0.1);color:#2ecc71;font-family:var(--font-body);font-size:0.82rem;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:0.4rem">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
      Record Sale
    </button>
    ${isForSale
      ? `<button onclick="_removeForSaleFromDetail(${idx},'${it.itemNum}','${(it.variation||'').replace(/'/g,"&apos;")}')" data-ctip="Remove this item from your For Sale list and keep it in your collection." style="padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #e67e22;background:rgba(230,126,34,0.25);color:#e67e22;font-family:var(--font-body);font-size:0.82rem;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:0.4rem">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
      Remove from For Sale
    </button>`
      : `<button onclick="collectionActionForSale(${idx},'${it.itemNum}','${(it.variation||'').replace(/'/g,"&apos;")}')" data-ctip="If you want to sell an item from your collection, you can list it for sale here." style="padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #e67e22;background:rgba(230,126,34,0.1);color:#e67e22;font-family:var(--font-body);font-size:0.82rem;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:0.4rem">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
      List for Sale
    </button>`}
    <button onclick="showAddToUpgradeModal('${it.itemNum}','${(it.variation||'').replace(/'/g,"&apos;")}')" style="padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #8b5cf6;background:rgba(139,92,246,0.1);color:#8b5cf6;font-family:var(--font-body);font-size:0.82rem;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:0.4rem">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
      Add to Upgrade List
    </button>
  </div>`;

  // ── DETAILS GRID ──
  const details = [
    { label: 'Condition', val: cond ? `<span class="condition-pip ${condClass}"></span> ${cond}/10` : null },
    { label: 'All Original', val: pd && pd.allOriginal && pd.allOriginal !== 'Unknown' ? pd.allOriginal : null },
    { label: 'Not Original', val: pd && pd.notOriginalDesc ? pd.notOriginalDesc : null },
    { label: 'Has Box', val: pd ? (pd.hasBox === 'Yes' ? '\u2705 Yes' + (pd.boxCond ? ` (${pd.boxCond}/10)` : '') : pd.hasBox === 'No' ? 'No' : null) : null },
    { label: 'Price Paid (Item)', val: pd && pd.priceItem ? '$' + parseFloat(pd.priceItem).toLocaleString() : null },
    { label: 'Price Paid (Box)', val: pd && pd.priceBox ? '$' + parseFloat(pd.priceBox).toLocaleString() : null },
    { label: 'Price Paid (Complete)', val: pd && pd.priceComplete ? '$' + parseFloat(pd.priceComplete).toLocaleString() : null },
    { label: 'Est. Worth', val: pd && pd.userEstWorth ? '$' + parseFloat(pd.userEstWorth).toLocaleString() : null },
    { label: 'Market Value', val: it.marketVal && !isNaN(parseFloat(it.marketVal)) ? '$' + parseFloat(it.marketVal).toLocaleString() : null },
    { label: 'Date Purchased', val: pd && pd.datePurchased ? pd.datePurchased : null },
    { label: 'Year Made', val: pd && pd.yearMade ? pd.yearMade : null },
    { label: 'Location', val: pd && pd.location ? pd.location : null },
    { label: 'Inventory ID', val: pd && pd.inventoryId ? pd.inventoryId : null },
  ].filter(d => d.val);

  const matchedTo = pd && pd.matchedTo ? pd.matchedTo : '';
  const setId = pd && pd.setId ? pd.setId : '';

  html += `<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:1.25rem;margin-bottom:1.5rem">
    <div style="font-family:var(--font-head);font-size:0.72rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--accent2);margin-bottom:0.75rem">Details</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:0.6rem 1.5rem">
      ${details.map(d => `<div style="display:flex;justify-content:space-between;padding:0.35rem 0;border-bottom:1px solid var(--border)">
        <span style="font-size:0.78rem;color:var(--text-dim);font-weight:600">${d.label}</span>
        <span style="font-size:0.85rem;color:var(--text);text-align:right">${d.val}</span>
      </div>`).join('')}
    </div>`;

  // Matched / Set info
  if (matchedTo || setId || groupMembers.length) {
    html += `<div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border)">`;
    if (matchedTo) {
      const _mIcon = isTender(it.itemNum) ? '\ud83d\ude82' : '\ud83d\ude83';
      // Matched items are always in the collection
      const _mtPdKey = findPDKey(matchedTo, '');
      let _mtIdx = state.masterData.findIndex(md => md.itemNum === matchedTo);
      if (_mtIdx < 0 && _mtPdKey) {
        if (!window._poKeys) window._poKeys = [];
        let _mtPoIdx = window._poKeys.indexOf(_mtPdKey);
        if (_mtPoIdx < 0) _mtPoIdx = window._poKeys.push(_mtPdKey) - 1;
        _mtIdx = -(_mtPoIdx + 1000);
      }
      const _mtClickable = _mtPdKey && _mtIdx !== -1;
      html += `<div style="font-size:0.85rem;color:var(--text-mid);margin-bottom:0.3rem">${_mIcon} Matched to: ${_mtClickable
        ? '<a href="javascript:void(0)" onclick="showItemDetailPage(' + _mtIdx + ')" style="color:var(--accent);font-weight:700;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px;cursor:pointer">' + matchedTo + '</a>'
        : '<strong style="color:var(--accent)">' + matchedTo + '</strong>'}</div>`;
    }
    if (setId) {
      html += `<div style="font-size:0.85rem;color:var(--text-mid);margin-bottom:0.3rem">\ud83d\udd17 Set: <strong style="color:#a855f7">${setId}</strong></div>`;
    }
    if (groupMembers.length) {
      html += `<div style="font-size:0.78rem;color:var(--text-dim);margin-top:0.3rem">Grouped with: ${groupMembers.map(m => {
        // Grouped items are always in the collection — look up via personalData
        const _gPdKey = findPDKey(m.itemNum, m.variation);
        if (_gPdKey) {
          // Check if also in masterData (positive index), otherwise use personal-only negative index
          let _gIdx = state.masterData.findIndex(md => md.itemNum === m.itemNum && (!m.variation || md.variation === m.variation));
          if (_gIdx < 0) {
            if (!window._poKeys) window._poKeys = [];
            let _poIdx = window._poKeys.indexOf(_gPdKey);
            if (_poIdx < 0) _poIdx = window._poKeys.push(_gPdKey) - 1;
            _gIdx = -(_poIdx + 1000);
          }
          return '<a href="javascript:void(0)" onclick="showItemDetailPage(' + _gIdx + ')" style="color:var(--accent);font-family:var(--font-mono);text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px;cursor:pointer">' + m.itemNum + '</a>';
        }
        return '<span style="color:var(--accent);font-family:var(--font-mono)">' + m.itemNum + '</span>';
      }).join(', ')}</div>`;
    }
    html += `</div>`;
  }

  // Notes
  if (pd && pd.notes) {
    html += `<div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border)">
      <div style="font-size:0.78rem;color:var(--text-dim);font-weight:600;margin-bottom:0.3rem">Notes</div>
      <div style="font-size:0.85rem;color:var(--text);line-height:1.6">${pd.notes}</div>
    </div>`;
  }

  html += `</div>`;

  // ── PHOTO GALLERY ──
  const _photoLink = pd && pd.photoItem ? pd.photoItem : '';
  html += `<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:1.25rem">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem">
      <div style="font-family:var(--font-head);font-size:0.72rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--accent2)">Photos</div>
      ${_photoLink ? `<a href="${_photoLink}" target="_blank" rel="noopener" style="font-size:0.75rem;color:var(--accent2);text-decoration:none">Open Drive Folder \u2197</a>` : ''}
    </div>
    <div id="item-detail-photos" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:0.75rem;min-height:80px">
      ${_photoLink ? '<div style="grid-column:1/-1;text-align:center;padding:1rem;color:var(--text-dim);font-size:0.82rem"><div class="spinner" style="margin:0 auto 0.5rem;width:20px;height:20px;border-width:2px"></div>Loading photos...</div>' : '<div style="grid-column:1/-1;text-align:center;padding:2rem 1rem;color:var(--text-dim)"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3" style="margin:0 auto 0.5rem;display:block"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg><div style="font-size:0.85rem;margin-bottom:0.5rem">No photos uploaded yet</div><button onclick="showItemDetailPage_photos(${idx})" style="padding:0.4rem 0.8rem;border-radius:7px;border:1.5px solid var(--gold);background:rgba(212,168,67,0.08);color:var(--gold);font-family:var(--font-body);font-size:0.78rem;cursor:pointer;font-weight:600">Add Photos</button></div>'}
    </div>
  </div>`;

  container.innerHTML = html;

  // Async: load photos
  if (_photoLink) {
    driveGetFolderPhotos(_photoLink).then(function(photos) {
      const el = document.getElementById('item-detail-photos');
      if (!el) return;
      if (!photos || photos.length === 0) {
        el.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem 1rem;color:var(--text-dim)"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3" style="margin:0 auto 0.5rem;display:block"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg><div style="font-size:0.85rem;margin-bottom:0.5rem">No photos in folder</div><button onclick="showItemDetailPage_photos(' + idx + ')" style="padding:0.4rem 0.8rem;border-radius:7px;border:1.5px solid var(--gold);background:rgba(212,168,67,0.08);color:var(--gold);font-family:var(--font-body);font-size:0.78rem;cursor:pointer;font-weight:600">Add Photos</button></div>';
        return;
      }
      el.innerHTML = photos.map(function(p) {
        return '<a href="' + p.view + '" target="_blank" rel="noopener" style="display:block;border-radius:8px;overflow:hidden;background:var(--surface2);aspect-ratio:1;position:relative">'
          + '<img id="idp-' + p.id + '" style="width:100%;height:100%;object-fit:cover;border-radius:8px;transition:opacity 0.3s" alt="' + (p.name||'Photo') + '">'
          + '<div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.6));padding:0.3rem 0.5rem">'
          + '<div style="font-size:0.65rem;color:#fff;font-family:var(--font-head);letter-spacing:0.05em;text-transform:uppercase">' + (p.name||'').replace(/\.[^.]+$/,'') + '</div>'
          + '</div></a>';
      }).join('');
      // Load each photo thumbnail
      photos.forEach(function(p) {
        const imgEl = document.getElementById('idp-' + p.id);
        if (imgEl) {
          loadDriveThumb(p.id, imgEl, imgEl.parentElement);
        }
      });
    }).catch(function(e) {
      console.warn('Photo gallery load:', e);
      const el = document.getElementById('item-detail-photos');
      if (el) el.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:1rem;color:var(--text-dim);font-size:0.82rem">Could not load photos</div>';
    });
  }
}

// Helper functions for item detail page action buttons
function showItemDetailPage_edit(idx) {
  const item = idx >= 0 ? state.masterData[idx] : null;
  if (!item) return;
  const pdKey = findPDKey(item.itemNum, item.variation);
  if (pdKey) updateCollectionItem(idx, pdKey);
  else showToast('Item not found in your collection', 3000, true);
}
function showItemDetailPage_photos(idx) {
  const item = idx >= 0 ? state.masterData[idx] : null;
  if (!item) return;
  const pdKey = findPDKey(item.itemNum, item.variation);
  if (pdKey) showItemPanel(idx, pdKey, 'edit');
  else showToast('Item not found in your collection', 3000, true);
}
function showItemDetailPage_sell(idx) {
  const item = idx >= 0 ? state.masterData[idx] : null;
  if (!item) return;
  const pdKey = findPDKey(item.itemNum, item.variation);
  if (pdKey) sellFromCollection(idx, pdKey);
}
function showItemDetailPage_forsale(idx) {
  const item = idx >= 0 ? state.masterData[idx] : null;
  if (!item) return;
  const pdKey = findPDKey(item.itemNum, item.variation);
  if (pdKey) listForSaleFromCollection(idx, pdKey);
}




// ── BROWSE ROW CLICK — offer to add or view ─────────────────────
function openPhotoWizard(itemNum, variation, pdKey) {
  // Open wizard on the photo step for an existing item
  const pd = state.personalData[pdKey] || {};
  wizard = {
    step: 0, tab: 'collection',
    data: { tab: 'collection', itemNum: itemNum, variation: variation,
            condition: pd.condition || '', allOriginal: pd.allOriginal || '',
            hasBox: pd.hasBox || '', _updatePdKey: pdKey, _photoOnly: true },
    steps: getSteps('collection'), matchedItem: null
  };
  // Bugfix 2026-04-14: wizard modal may not be built yet (only built by openWizard).
  // Without this call, getElementById('wizard-modal') returns null and throws.
  if (typeof _buildWizardModal === 'function') _buildWizardModal();
  document.getElementById('wizard-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
  // Skip to the photosItem step
  // NOTE: step IDs must match the current collection-tab step list in wizard.js.
  // Added 2026-04-14: itemCategory, itemNumGrouping, conditionDetails, purchaseValue, boxVariation
  // (these are the current step IDs that used to be 'tab'/'itemNum'/'condition'/etc.)
  const autoSkip = new Set(['tab','itemCategory','itemNum','itemNumGrouping','variation','itemPicker','entryMode',
    'conditionDetails','condition','allOriginal','notOriginalDesc',
    'hasBox','boxCond','hasIS','is_sheetNum','is_condition',
    'purchaseValue','pricePaid','datePurchased','userEstWorth','yearMade',
    'tenderAllOriginal','tenderNotOriginalDesc','unit2AllOriginal','unit2NotOriginalDesc',
    'unit3AllOriginal','unit3NotOriginalDesc','wantTenderPhotos','tenderMatch','dieselSetQ','setMatch','setType',
    'unit2ItemNum','unit3ItemNum','setUnit2Num','setUnit3Num',
    'wantTogetherPhotos','photosTogether','boxOnly','wantBoxPhotos','boxVariation',
    'hasMasterBox','masterBoxCond','masterBoxNotes','photosMasterBox',
    'purchaseDate','photosBox']);
  while (wizard.step < wizard.steps.length - 1) {
    const s = wizard.steps[wizard.step];
    if (autoSkip.has(s.id) || (s.skipIf && s.skipIf(wizard.data))) wizard.step++;
    else break;
  }
  renderWizardStep();
}

function addPhotosFromCollection(globalIdx) {
  var item = state.masterData[globalIdx] || {};
  var itemNum = item.itemNum || '';
  var variation = item.variation || '';
  var pdKey = Object.keys(state.personalData).find(function(k) {
    var pd = state.personalData[k];
    return pd && pd.itemNum === itemNum && (!variation || pd.variation === variation) && pd.owned;
  });
  if (pdKey) openPhotoWizard(itemNum, variation, pdKey);
  else showToast('Item not found in collection');
}

async function openPhotoFolder(itemNum, storedLink) {
  if (storedLink) {
    var _pfMatch = (storedLink || '').match(/folders\/([a-zA-Z0-9_-]+)/);
    if (_pfMatch && _pfMatch[1] && _pfMatch[1] !== 'undefined') {
      try {
        var _pfCheck = await driveRequest('GET', '/files/' + _pfMatch[1] + '?fields=id,trashed');
        if (_pfCheck && _pfCheck.id && !_pfCheck.trashed) {
          window.open(storedLink, '_blank');
          return;
        }
      } catch(e) { /* stale link, fall through */ }
    }
    console.warn('[Photos] Stored link invalid for', itemNum);
  }
  try {
    var folderId = await driveEnsureItemFolder(itemNum);
    var freshLink = driveFolderLink(folderId);
    window.open(freshLink, '_blank');
    // Auto-repair the broken link in the sheet
    var _pfKey = Object.keys(state.personalData).find(function(k) {
      var pd = state.personalData[k];
      return pd && pd.itemNum === itemNum && pd.owned;
    });
    if (_pfKey && state.personalData[_pfKey].row) {
      state.personalData[_pfKey].photoItem = freshLink;
      sheetsUpdate(state.personalSheetId, 'My Collection!J' + state.personalData[_pfKey].row, [[freshLink]]).catch(function(e) { console.warn('Photo link update:', e); });
    }
  } catch(e) { showToast('Could not open Drive folder: ' + e.message); }
}

function showOwnedItemMenu(idx, pdKey) {
  const pd = state.personalData[pdKey] || {};
  // For personalOnly items, build a minimal item object from pd
  const item = state.masterData[idx] || {
    itemNum: pd.itemNum, variation: pd.variation || '',
    roadName: pd.roadName || '', itemType: pd.itemType || '',
    yearProd: pd.yearMade || '', marketVal: '', // market value comes from master sheet only
  };
  const existing = document.getElementById('owned-action-menu');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'owned-action-menu';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1.5rem';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
  const box = document.createElement('div');
  box.style.cssText = 'background:var(--surface);border:1px solid rgba(46,204,113,0.35);border-radius:16px;max-width:420px;width:100%;padding:1.75rem;position:relative';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = 'position:absolute;top:0.75rem;right:0.75rem;background:none;border:none;color:var(--text-dim);font-size:1.1rem;cursor:pointer';
  closeBtn.onclick = function() { overlay.remove(); };
  box.appendChild(closeBtn);

  const hdr = document.createElement('div');
  hdr.style.cssText = 'font-family:var(--font-head);font-size:1rem;color:var(--green);margin-bottom:0.15rem';
  hdr.textContent = '✓ In Your Collection';
  box.appendChild(hdr);
  const itemLbl = document.createElement('div');
  itemLbl.style.cssText = 'font-size:0.85rem;color:var(--text-mid);margin-bottom:0.1rem';
  itemLbl.textContent = 'No. ' + item.itemNum + (item.variation ? ' — Var. ' + item.variation : '') + (item.roadName ? ' · ' + item.roadName : '');
  box.appendChild(itemLbl);
  const condLbl = document.createElement('div');
  condLbl.style.cssText = 'font-size:0.75rem;color:var(--text-dim);margin-bottom:1.25rem';
  const parts = [];
  if (pd.condition) parts.push('Condition: ' + pd.condition + '/10');
  if (pd.priceItem || pd.priceComplete) parts.push('Paid: $' + (pd.priceComplete || pd.priceItem));
  if (pd.yearMade) parts.push('Year: ' + pd.yearMade);
  condLbl.textContent = parts.join(' · ') || item.yearProd || '';
  box.appendChild(condLbl);

  // Action buttons stacked
  const mkBtn = function(label, color, bg, handler) {
    const b = document.createElement('button');
    b.style.cssText = 'width:100%;padding:0.7rem 1rem;border-radius:9px;border:1.5px solid ' + color + ';color:' + color + ';background:' + bg + ';font-family:var(--font-body);font-size:0.9rem;font-weight:600;cursor:pointer;margin-bottom:0.5rem;text-align:left;display:flex;align-items:center;gap:0.5rem';
    b.innerHTML = label;
    b.onclick = handler;
    return b;
  };

  box.appendChild(mkBtn(
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> Record a Sale',
    '#2ecc71', 'rgba(46,204,113,0.1)',
    function() { overlay.remove(); sellFromCollection(idx, pdKey); }
  ));
  // Check if already listed for sale
  const _fsKey = pd.itemNum + '|' + (pd.variation || '');
  const _alreadyForSale = !!state.forSaleData[_fsKey];
  box.appendChild(mkBtn(
    _alreadyForSale
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> Update For Sale Listing'
      : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> List for Sale',
    '#e67e22', 'rgba(230,126,34,0.1)',
    function() { overlay.remove(); listForSaleFromCollection(idx, pdKey); }
  ));
  box.appendChild(mkBtn(
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Update Info',
    '#2980b9', 'rgba(224,64,40,0.08)',
    function() { overlay.remove(); updateCollectionItem(idx, pdKey); }
  ));
  box.appendChild(mkBtn(
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> View Item Details',
    'var(--text-dim)', 'var(--surface2)',
    function() { overlay.remove(); showItemPanel(idx, pdKey, 'view'); }
  ));
  // Add Another Copy — re-opens the wizard for the same item
  if (idx >= 0) {
    box.appendChild(mkBtn(
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> Add Another Copy',
      'var(--text-mid)', 'transparent',
      function() { overlay.remove(); addFromBrowse(idx); }
    ));
  }

  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

// ── Collection list action helpers (resolve pdKey from itemNum/variation, then delegate) ──
// Owned menu for Science/Construction items (stored in dedicated tabs, not personalData)
function _showSpecialOwnedMenu(idx, item, ownedItems) {
  const existing = document.getElementById('owned-action-menu');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'owned-action-menu';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1.5rem';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
  const box = document.createElement('div');
  box.style.cssText = 'background:var(--surface);border:1px solid rgba(46,204,113,0.35);border-radius:16px;max-width:420px;width:100%;padding:1.75rem;position:relative';
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = 'position:absolute;top:0.75rem;right:0.75rem;background:none;border:none;color:var(--text-dim);font-size:1.1rem;cursor:pointer';
  closeBtn.onclick = function() { overlay.remove(); };
  box.appendChild(closeBtn);
  const hdr = document.createElement('div');
  hdr.style.cssText = 'font-family:var(--font-head);font-size:1rem;color:var(--green);margin-bottom:0.15rem';
  hdr.textContent = '✓ In Your Collection' + (ownedItems.length > 1 ? ' (' + ownedItems.length + ' copies)' : '');
  box.appendChild(hdr);
  const itemLbl = document.createElement('div');
  itemLbl.style.cssText = 'font-size:0.85rem;color:var(--text-mid);margin-bottom:0.15rem';
  itemLbl.textContent = 'No. ' + item.itemNum + (item.variation ? ' — Var. ' + item.variation : '');
  box.appendChild(itemLbl);
  const descLbl = document.createElement('div');
  descLbl.style.cssText = 'font-size:0.78rem;color:var(--text-dim);margin-bottom:1rem';
  const parts = [];
  if (ownedItems[0] && ownedItems[0].condition) parts.push('Condition: ' + ownedItems[0].condition + '/10');
  if (ownedItems[0] && ownedItems[0].estValue) parts.push('Worth: $' + parseFloat(ownedItems[0].estValue).toLocaleString());
  descLbl.textContent = parts.join(' · ') || item.description || '';
  box.appendChild(descLbl);
  // Action buttons
  const mkBtn = function(label, color, bg, handler) {
    const b = document.createElement('button');
    b.style.cssText = 'width:100%;padding:0.7rem 1rem;border-radius:9px;border:1.5px solid ' + color + ';color:' + color + ';background:' + bg + ';font-family:var(--font-body);font-size:0.9rem;font-weight:600;cursor:pointer;margin-bottom:0.5rem;text-align:left;display:flex;align-items:center;gap:0.5rem';
    b.innerHTML = label;
    b.onclick = handler;
    return b;
  };
  // Record a Sale
  box.appendChild(mkBtn(
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> Record a Sale',
    '#2ecc71', 'rgba(46,204,113,0.1)',
    function() { overlay.remove(); openWizard('sold'); }
  ));
  // List for Sale
  box.appendChild(mkBtn(
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> List for Sale',
    '#e67e22', 'rgba(230,126,34,0.1)',
    function() { overlay.remove(); openWizard('forsale'); }
  ));
  // View Details
  box.appendChild(mkBtn(
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> View Item Details',
    'var(--text-dim)', 'var(--surface2)',
    function() { overlay.remove(); showItemDetailPage(idx); }
  ));
  // Add Another Copy
  box.appendChild(mkBtn(
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> Add Another Copy',
    'var(--text-mid)', 'transparent',
    function() { overlay.remove(); addFromBrowse(idx); }
  ));
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function collectionActionForSale(globalIdx, itemNum, variation, pdRow) {
  var pdKey = pdRow ? findPDKeyByRow(itemNum, variation, pdRow) : findPDKey(itemNum, variation);
  if (!pdKey) { showToast('Item not found in collection', 3000, true); return; }
  _checkGroupBeforeForSale(globalIdx, pdKey);
}

function _checkGroupBeforeForSale(globalIdx, pdKey) {
  const pd = state.personalData[pdKey] || {};
  // No group? Proceed normally
  if (!pd.groupId) { listForSaleFromCollection(globalIdx, pdKey); return; }
  // Find siblings in same group
  const siblings = Object.entries(state.personalData)
    .filter(([k, p]) => k !== pdKey && p.groupId === pd.groupId && p.owned);
  // No siblings? Proceed normally
  if (!siblings.length) { listForSaleFromCollection(globalIdx, pdKey); return; }

  // Build item list for display
  const allItems = [[pdKey, pd], ...siblings];
  const itemList = allItems.map(([, p]) => p.itemNum).join(', ');

  // Build item list with pricing details
  let _totalPaid = 0, _totalWorth = 0, _hasPaid = false, _hasWorth = false;
  const _itemRows = allItems.map(([, p]) => {
    const paid = parseFloat(p.itemBoxPrice) || parseFloat(p.itemOnlyPrice) || 0;
    const worth = parseFloat(p.userEstWorth) || 0;
    if (paid > 0) _hasPaid = true;
    if (worth > 0) _hasWorth = true;
    _totalPaid += paid;
    _totalWorth += worth;
    return { num: p.itemNum, paid, worth };
  });
  const _itemTableHtml = '<div style="margin:0.6rem 0 0.75rem;border:1px solid var(--border);border-radius:10px;overflow:hidden">'
    + '<table style="width:100%;border-collapse:collapse;font-size:0.8rem">'
    + '<tr style="background:var(--surface2)">'
    + '<th style="text-align:left;padding:0.4rem 0.6rem;font-family:var(--font-head);font-size:0.62rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-dim)">Item</th>'
    + (_hasPaid ? '<th style="text-align:right;padding:0.4rem 0.6rem;font-family:var(--font-head);font-size:0.62rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-dim)">Paid</th>' : '')
    + (_hasWorth ? '<th style="text-align:right;padding:0.4rem 0.6rem;font-family:var(--font-head);font-size:0.62rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-dim)">Est. Worth</th>' : '')
    + '</tr>'
    + _itemRows.map(r => '<tr style="border-top:1px solid var(--border)">'
      + '<td style="padding:0.4rem 0.6rem;font-family:var(--font-mono);font-weight:600;color:var(--accent)">' + r.num + '</td>'
      + (_hasPaid ? '<td style="text-align:right;padding:0.4rem 0.6rem;color:var(--text-mid)">' + (r.paid > 0 ? '$' + r.paid.toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:2}) : '—') + '</td>' : '')
      + (_hasWorth ? '<td style="text-align:right;padding:0.4rem 0.6rem;color:var(--gold)">' + (r.worth > 0 ? '$' + r.worth.toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:2}) : '—') + '</td>' : '')
      + '</tr>').join('')
    + ((_hasPaid || _hasWorth) ? '<tr style="border-top:2px solid var(--border);background:var(--surface2)">'
      + '<td style="padding:0.4rem 0.6rem;font-weight:700;font-size:0.75rem;color:var(--text)">Total</td>'
      + (_hasPaid ? '<td style="text-align:right;padding:0.4rem 0.6rem;font-weight:700;color:var(--text-mid)">$' + _totalPaid.toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:2}) + '</td>' : '')
      + (_hasWorth ? '<td style="text-align:right;padding:0.4rem 0.6rem;font-weight:700;color:var(--gold)">$' + _totalWorth.toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:2}) + '</td>' : '')
      + '</tr>' : '')
    + '</table></div>';

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1.5rem';
  overlay.innerHTML = `
    <div style="background:var(--surface);border-radius:16px;padding:1.5rem;max-width:420px;width:100%;border:1px solid var(--border)">
      <div style="font-family:var(--font-head);font-size:1rem;font-weight:700;margin-bottom:0.4rem">This is a grouped item</div>
      <div style="font-size:0.84rem;color:var(--text-mid);margin-bottom:0.15rem">
        <strong style="color:var(--text)">${allItems.length} items</strong> in this group:
      </div>
      ${_itemTableHtml}
      <div style="font-size:0.84rem;color:var(--text-mid);margin-bottom:1rem">
        Are you selling this as a set or individually?
      </div>
      <div id="_grpfs-set-section" style="display:flex;flex-direction:column;gap:0.5rem">
        <button id="_grpfs-set" style="padding:0.8rem 1rem;border-radius:10px;border:2px solid #e67e22;background:rgba(230,126,34,0.1);color:#e67e22;font-family:var(--font-body);font-size:0.88rem;font-weight:600;cursor:pointer;text-align:left">
          Sell as a set<br>
          <span style="font-weight:400;font-size:0.78rem;color:var(--text-dim)">List all ${allItems.length} items together for one price</span>
        </button>
        <button id="_grpfs-indiv" style="padding:0.8rem 1rem;border-radius:10px;border:2px solid var(--accent);background:rgba(232,64,28,0.08);color:var(--accent);font-family:var(--font-body);font-size:0.88rem;font-weight:600;cursor:pointer;text-align:left">
          Sell individually<br>
          <span style="font-weight:400;font-size:0.78rem;color:var(--text-dim)">List only No. ${pd.itemNum} and break up the group</span>
        </button>
        <button id="_grpfs-cancel" style="padding:0.75rem;border-radius:10px;border:1px solid var(--border);background:none;color:var(--text-dim);font-family:var(--font-body);font-size:0.85rem;cursor:pointer">Cancel</button>
      </div>
      <div id="_grpfs-price-section" style="display:none;flex-direction:column;gap:0.6rem">
        <div style="font-size:0.84rem;color:var(--text-mid)">Enter the asking price for the entire set:</div>
        ${(_hasPaid || _hasWorth) ? '<div style="display:flex;gap:1rem;font-size:0.78rem;color:var(--text-dim);margin-bottom:0.15rem">' + (_hasPaid ? '<span>Total Paid: <strong style="color:var(--text-mid)">$' + _totalPaid.toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:2}) + '</strong></span>' : '') + (_hasWorth ? '<span>Est. Worth: <strong style="color:var(--gold)">$' + _totalWorth.toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:2}) + '</strong></span>' : '') + '</div>' : ''}
        <div style="display:flex;align-items:center;gap:0.5rem">
          <span style="font-size:1.1rem;color:var(--text-dim)">$</span>
          <input id="_grpfs-price-input" type="number" min="0" step="0.01" placeholder="0.00" style="flex:1;padding:0.6rem 0.8rem;border-radius:8px;border:1.5px solid var(--accent2);background:var(--surface2);color:var(--text);font-family:var(--font-mono);font-size:1rem;outline:none">
        </div>
        <button id="_grpfs-price-save" style="padding:0.75rem 1rem;border-radius:10px;border:none;background:var(--accent);color:white;font-family:var(--font-body);font-size:0.88rem;font-weight:700;cursor:pointer">List all ${allItems.length} items for sale</button>
        <button id="_grpfs-price-back" style="padding:0.65rem;border-radius:10px;border:1px solid var(--border);background:none;color:var(--text-dim);font-family:var(--font-body);font-size:0.85rem;cursor:pointer">Back</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  // Cancel
  document.getElementById('_grpfs-cancel').onclick = () => overlay.remove();

  // ── SELL AS A SET ──
  document.getElementById('_grpfs-set').onclick = () => {
    document.getElementById('_grpfs-set-section').style.display = 'none';
    const priceSection = document.getElementById('_grpfs-price-section');
    priceSection.style.display = 'flex';
    setTimeout(() => document.getElementById('_grpfs-price-input').focus(), 100);
  };

  // Back from price input
  document.getElementById('_grpfs-price-back').onclick = () => {
    document.getElementById('_grpfs-price-section').style.display = 'none';
    document.getElementById('_grpfs-set-section').style.display = 'flex';
  };

  // Save set listing
  document.getElementById('_grpfs-price-save').onclick = async () => {
    const priceInput = document.getElementById('_grpfs-price-input');
    const askingPrice = priceInput ? priceInput.value : '';
    if (!askingPrice || parseFloat(askingPrice) <= 0) {
      if (priceInput) { priceInput.style.borderColor = 'var(--accent)'; priceInput.focus(); }
      showToast('Please enter an asking price', 3000);
      return;
    }
    const saveBtn = document.getElementById('_grpfs-price-save');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }
    try {
      const today = new Date().toISOString().split('T')[0];
      const sheetId = state.personalSheetId;
      // Lead item gets full price
      for (let i = 0; i < allItems.length; i++) {
        const [aKey, aPd] = allItems[i];
        const isLead = i === 0;
        const fsKey = aPd.itemNum + '|' + (aPd.variation || '');
        const fsRow = [
          aPd.itemNum, aPd.variation || '',
          aPd.condition || '',
          isLead ? askingPrice : '',
          today,
          isLead ? 'Set sale: ' + itemList : 'Set price on ' + pd.itemNum + ' — set sale: ' + itemList,
          aPd.priceItem || '',
          aPd.userEstWorth || '',
          aPd.inventoryId || '',
          aPd.manufacturer || _getEraManufacturer(),
        ];
        const existingFs = state.forSaleData[fsKey];
        if (existingFs && existingFs.row) {
          await sheetsUpdate(sheetId, 'For Sale!A' + existingFs.row + ':J' + existingFs.row, [fsRow]);
        } else {
          await sheetsAppend(sheetId, 'For Sale!A:J', [fsRow]);
        }
        state.forSaleData[fsKey] = {
          row: existingFs ? existingFs.row : 99999,
          itemNum: aPd.itemNum, variation: aPd.variation || '',
          condition: aPd.condition || '', askingPrice: isLead ? askingPrice : '',
          dateListed: today,
          notes: fsRow[5], originalPrice: aPd.priceItem || '',
          estWorth: aPd.userEstWorth || '',
          inventoryId: aPd.inventoryId || '',
        };
      }
      overlay.remove();
      _cachePersonalData();
      buildForSalePage();
      renderBrowse();
      showToast('✓ ' + allItems.length + ' items listed for sale as a set!');
    } catch(e) {
      console.error('Group for sale error:', e);
      showToast('❌ Error: ' + e.message, 5000, true);
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'List all ' + allItems.length + ' items for sale'; }
    }
  };

  // ── SELL INDIVIDUALLY ──
  document.getElementById('_grpfs-indiv').onclick = async () => {
    const indivBtn = document.getElementById('_grpfs-indiv');
    if (indivBtn) { indivBtn.disabled = true; indivBtn.textContent = 'Breaking group…'; }
    try {
      const sheetId = state.personalSheetId;
      // Remove groupId from ALL items in this group
      for (const [aKey, aPd] of allItems) {
        if (aPd.row && aPd.row !== 99999) {
          await sheetsUpdate(sheetId, 'My Collection!V' + aPd.row, [['']]);
        }
        aPd.groupId = '';
      }
      overlay.remove();
      showToast('Group broken up — now list your item');
      renderBrowse();
      // Proceed to normal For Sale wizard for just this item
      listForSaleFromCollection(globalIdx, pdKey);
    } catch(e) {
      console.error('Group break error:', e);
      showToast('❌ Error: ' + e.message, 5000, true);
      if (indivBtn) { indivBtn.disabled = false; indivBtn.textContent = 'Sell individually'; }
    }
  };
}

function collectionActionSold(globalIdx, itemNum, variation, pdRow) {
  var pdKey = pdRow ? findPDKeyByRow(itemNum, variation, pdRow) : findPDKey(itemNum, variation);
  if (!pdKey) { showToast('Item not found in collection', 3000, true); return; }
  _checkSetBeforeAction(pdKey, () => sellFromCollection(globalIdx, pdKey));
}

function _checkSetBeforeAction(pdKey, proceed) {
  const pd = state.personalData[pdKey] || {};
  if (!pd.groupId) { proceed(); return; }
  // Check if this groupId has other members
  const siblings = Object.entries(state.personalData)
    .filter(([k, p]) => k !== pdKey && p.groupId === pd.groupId);
  if (!siblings.length) { proceed(); return; }
  // Show set breakup modal
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1.5rem';
  overlay.innerHTML = `
    <div style="background:var(--surface);border-radius:16px;padding:1.5rem;max-width:380px;width:100%;border:1px solid var(--border)">
      <div style="font-family:var(--font-head);font-size:1rem;font-weight:700;margin-bottom:0.4rem">This item is part of a set</div>
      <div style="font-size:0.84rem;color:var(--text-mid);margin-bottom:1.25rem">
        ${pd.setNum ? 'Set ' + pd.setNum + ' · ' : ''}${siblings.length + 1} items share this group.
        What would you like to do?
      </div>
      <div style="display:flex;flex-direction:column;gap:0.5rem">
        <button id="_setaction-proceed" style="padding:0.8rem 1rem;border-radius:10px;border:2px solid #27ae60;background:rgba(39,174,96,0.1);color:#27ae60;font-family:var(--font-body);font-size:0.88rem;font-weight:600;cursor:pointer;text-align:left">
          Continue — list as incomplete set<br>
          <span style="font-weight:400;font-size:0.78rem;color:var(--text-dim)">Other set items keep their group ID</span>
        </button>
        <button id="_setaction-break" style="padding:0.8rem 1rem;border-radius:10px;border:2px solid var(--accent);background:rgba(232,64,28,0.08);color:var(--accent);font-family:var(--font-body);font-size:0.88rem;font-weight:600;cursor:pointer;text-align:left">
          Break up the set<br>
          <span style="font-weight:400;font-size:0.78rem;color:var(--text-dim)">Removes group from all ${siblings.length + 1} items</span>
        </button>
        <button id="_setaction-cancel" style="padding:0.75rem;border-radius:10px;border:1px solid var(--border);background:none;color:var(--text-dim);font-family:var(--font-body);font-size:0.85rem;cursor:pointer">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('_setaction-proceed').onclick = () => { overlay.remove(); proceed(); };
  document.getElementById('_setaction-cancel').onclick  = () => overlay.remove();
  document.getElementById('_setaction-break').onclick   = async () => {
    overlay.remove();
    const allGroup = [[pdKey, pd], ...siblings];

    // Check if any item has a purchase price (stored on loco)
    const _priceItem = allGroup.find(([,p]) => p.priceItem && parseFloat(p.priceItem) > 0);
    const _worthItem = allGroup.find(([,p]) => p.userEstWorth && parseFloat(p.userEstWorth) > 0);
    const _hasMoney  = _priceItem || _worthItem;

    if (_hasMoney) {
      const _locoNum   = (_priceItem || _worthItem)[1].itemNum;
      const _price     = _priceItem ? parseFloat(_priceItem[1].priceItem) : 0;
      const _worth     = _worthItem ? parseFloat(_worthItem[1].userEstWorth) : 0;
      const _count     = allGroup.length;
      const _perPrice  = _price  ? '$' + (_price  / _count).toFixed(2) : null;
      const _perWorth  = _worth  ? '$' + (_worth  / _count).toFixed(2) : null;

      // Show price-split modal
      const o2 = document.createElement('div');
      o2.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1.5rem';
      o2.innerHTML = `
        <div style="background:var(--surface);border-radius:16px;padding:1.5rem;max-width:380px;width:100%;border:1px solid var(--border)">
          <div style="font-family:var(--font-head);font-size:1rem;font-weight:700;margin-bottom:0.4rem">What about the price?</div>
          <div style="font-size:0.84rem;color:var(--text-mid);margin-bottom:1.1rem">
            ${_price ? 'Purchase price of <strong style="color:var(--text)">$' + _price.toFixed(2) + '</strong>' : ''}
            ${_price && _worth ? ' and ' : ''}
            ${_worth ? 'estimated value of <strong style="color:var(--text)">$' + _worth.toFixed(2) + '</strong>' : ''}
            ${_price || _worth ? ' is stored on the locomotive <span style="font-family:var(--font-mono);color:var(--accent);font-weight:600">' + _locoNum + '</span>.' : ''}
          </div>
          <div style="display:flex;flex-direction:column;gap:0.5rem">
            <button id="_split-even" style="padding:0.8rem 1rem;border-radius:10px;border:2px solid #27ae60;background:rgba(39,174,96,0.1);color:#27ae60;font-family:var(--font-body);font-size:0.88rem;font-weight:600;cursor:pointer;text-align:left">
              Split evenly across all ${_count} items<br>
              <span style="font-weight:400;font-size:0.78rem;color:var(--text-dim)">${[_perPrice ? _perPrice + ' per item (price)' : '', _perWorth ? _perWorth + ' per item (value)' : ''].filter(Boolean).join(' · ')}</span>
            </button>
            <button id="_split-assign" style="padding:0.8rem 1rem;border-radius:10px;border:1px solid var(--border);background:var(--surface2);color:var(--text-mid);font-family:var(--font-body);font-size:0.88rem;font-weight:600;cursor:pointer;text-align:left">
              Assign value to each item<br>
              <span style="font-weight:400;font-size:0.78rem;color:var(--text-dim)">Enter price &amp; value individually for each piece</span>
            </button>
            <button id="_split-clear" style="padding:0.8rem 1rem;border-radius:10px;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body);font-size:0.85rem;font-weight:600;cursor:pointer;text-align:left">
              Clear it<br>
              <span style="font-weight:400;font-size:0.78rem">Remove price &amp; value from all items</span>
            </button>
          </div>
        </div>`;
      document.body.appendChild(o2);

      const _doBreak = async (splitMode, customValues) => {
        o2.remove();
        for (const [k, p] of allGroup) {
          let newPrice, newWorth;
          if (splitMode === 'even') {
            newPrice = _price ? (_price / _count).toFixed(2) : '';
            newWorth = _worth ? (_worth / _count).toFixed(2) : '';
          } else if (splitMode === 'clear') {
            newPrice = '';
            newWorth = '';
          } else if (splitMode === 'assign' && customValues) {
            newPrice = customValues[k]?.price ?? '';
            newWorth = customValues[k]?.worth ?? '';
          } else {
            newPrice = p.priceItem || '';
            newWorth = p.userEstWorth || '';
          }
          state.personalData[k] = { ...p, groupId: '', priceItem: newPrice, userEstWorth: newWorth };
          if (p.row) {
            sheetsUpdate(state.personalSheetId, 'My Collection!E' + p.row, [[newPrice]])
              .catch(e => console.warn('price split row', p.row, e));
            sheetsUpdate(state.personalSheetId, 'My Collection!N' + p.row, [[newWorth]])
              .catch(e => console.warn('worth split row', p.row, e));
            sheetsUpdate(state.personalSheetId, 'My Collection!V' + p.row, [['']])
              .catch(e => console.warn('clear groupId row', p.row, e));
          }
        }
        _cachePersonalData();
        const _msg = splitMode === 'even'
          ? 'Set broken up — price split evenly across ' + _count + ' items'
          : splitMode === 'clear'
          ? 'Set broken up — price & value cleared'
          : splitMode === 'assign'
          ? 'Set broken up — values assigned per item'
          : 'Set broken up';
        showToast(_msg);
        proceed();
      };

      // Assign individually — show per-item input screen
      document.getElementById('_split-assign').onclick = () => {
        o2.remove();
        const perEven = { price: _price ? (_price/_count).toFixed(2) : '', worth: _worth ? (_worth/_count).toFixed(2) : '' };

        const o3 = document.createElement('div');
        o3.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
        const sheet = document.createElement('div');
        sheet.style.cssText = 'background:var(--surface);border-radius:16px 16px 0 0;padding:1.25rem;width:100%;max-width:520px;max-height:85vh;overflow-y:auto;-webkit-overflow-scrolling:touch';

        let html = `<div style="font-family:var(--font-head);font-size:0.65rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-dim);text-align:center;margin-bottom:0.85rem">Assign Price &amp; Value per Item</div>`;
        html += `<div style="display:grid;grid-template-columns:1fr 90px 90px;gap:0.3rem;margin-bottom:0.4rem;padding:0 0.1rem">
          <div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim)">Item</div>
          <div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);text-align:center">Paid ($)</div>
          <div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);text-align:center">Worth ($)</div>
        </div>`;

        allGroup.forEach(([k, p], i) => {
          const master = state.masterData.find(m => normalizeItemNum(m.itemNum) === normalizeItemNum(p.itemNum));
          const desc = master ? (master.roadName || master.description || '') : '';
          const safeKey = 'assign_' + i;
          html += `<div style="display:grid;grid-template-columns:1fr 90px 90px;gap:0.3rem;align-items:center;margin-bottom:0.45rem;padding:0.4rem 0.5rem;background:var(--surface2);border-radius:8px">
            <div>
              <div style="font-family:var(--font-mono);font-size:0.85rem;font-weight:700;color:var(--accent)">${p.itemNum}</div>
              ${desc ? `<div style="font-size:0.7rem;color:var(--text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${desc}</div>` : ''}
            </div>
            <input type="number" id="${safeKey}_price" value="${perEven.price}" min="0" step="0.01" placeholder="0.00"
              style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:0.4rem 0.5rem;color:var(--text);font-family:var(--font-mono);font-size:0.85rem;text-align:right;outline:none;box-sizing:border-box">
            <input type="number" id="${safeKey}_worth" value="${perEven.worth}" min="0" step="0.01" placeholder="0.00"
              style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:0.4rem 0.5rem;color:var(--text);font-family:var(--font-mono);font-size:0.85rem;text-align:right;outline:none;box-sizing:border-box">
          </div>`;
        });

        html += `<div style="display:flex;gap:0.6rem;margin-top:0.75rem;padding-bottom:0.25rem">
          <button id="_assign-cancel" style="flex:1;padding:0.7rem;border-radius:9px;border:1px solid var(--border);background:none;color:var(--text-dim);font-family:var(--font-body);font-size:0.88rem;cursor:pointer">Cancel</button>
          <button id="_assign-save" style="flex:2;padding:0.7rem;border-radius:9px;border:none;background:var(--accent);color:white;font-family:var(--font-body);font-size:0.88rem;font-weight:600;cursor:pointer">Save &amp; Break Up</button>
        </div>`;

        sheet.innerHTML = html;
        o3.appendChild(sheet);
        document.body.appendChild(o3);

        document.getElementById('_assign-cancel').onclick = () => o3.remove();
        document.getElementById('_assign-save').onclick = () => {
          const customValues = {};
          allGroup.forEach(([k], i) => {
            const safeKey = 'assign_' + i;
            customValues[k] = {
              price: document.getElementById(safeKey + '_price')?.value || '',
              worth: document.getElementById(safeKey + '_worth')?.value || '',
            };
          });
          o3.remove();
          _doBreak('assign', customValues);
        };
      };

      document.getElementById('_split-even').onclick  = () => _doBreak('even');
      document.getElementById('_split-clear').onclick = () => _doBreak('clear');

    } else {
      // No price data — just clear group IDs
      for (const [k, p] of allGroup) {
        state.personalData[k] = { ...p, groupId: '' };
        if (p.row) {
          sheetsUpdate(state.personalSheetId, 'My Collection!V' + p.row, [['']])
            .catch(e => console.warn('Clear groupId row', p.row, e));
        }
      }
      _cachePersonalData();
      showToast('Set broken up — items are now individual');
      proceed();
    }
  };
}

async function removeCollectionItem(itemNum, variation, row) {
  // Check if this item is part of a group with other members
  // Use row to disambiguate if multiple copies exist
  var pdKey = findPDKeyByRow(itemNum, variation, row);
  var thisPd = pdKey ? state.personalData[pdKey] : null;
  var groupId = thisPd && thisPd.groupId;
  var groupSiblings = groupId
    ? Object.values(state.personalData).filter(p => p.groupId === groupId && p.owned)
    : [];
  var isGrouped = groupSiblings.length > 1;

  if (isGrouped) {
    // Show choice modal — remove just this item or the whole group
    var groupLabels = groupSiblings.map(p => p.itemNum).join(' + ');
    var choice = await new Promise(function(resolve) {
      var siblings = groupSiblings.filter(p => p.itemNum !== itemNum).map(p => p.itemNum).join(', ');
      var overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9500;display:flex;align-items:center;justify-content:center;padding:1rem';
      overlay.innerHTML = `
        <div style="background:var(--surface);border:1.5px solid var(--border);border-radius:14px;padding:1.5rem;max-width:360px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,0.5)">
          <div style="font-size:0.72rem;font-weight:700;letter-spacing:0.1em;color:var(--accent);text-transform:uppercase;margin-bottom:0.5rem">Remove Item</div>
          <div style="font-size:0.9rem;color:var(--text);margin-bottom:0.2rem;line-height:1.5">
            Item <strong>${itemNum}</strong> is grouped with <strong>${siblings}</strong>.
          </div>
          <div style="font-size:0.85rem;color:var(--text-mid);margin-bottom:1.25rem;line-height:1.5">Do you want to remove just this item, or all items in the group?</div>
          <div style="display:flex;flex-direction:column;gap:0.5rem">
            <button id="rm-just-one" style="padding:0.55rem 1rem;border-radius:8px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.85rem;cursor:pointer;text-align:left;line-height:1.4">
              Remove <strong>${itemNum}</strong> only
            </button>
            <button id="rm-all-group" style="padding:0.55rem 1rem;border-radius:8px;border:1.5px solid var(--accent);background:rgba(240,80,8,0.08);color:var(--accent);font-family:var(--font-body);font-size:0.85rem;cursor:pointer;text-align:left;font-weight:600;line-height:1.4">
              Remove all grouped items (${groupLabels})
            </button>
            <button id="rm-cancel" style="padding:0.45rem 1rem;border-radius:8px;border:1px solid var(--border);background:none;color:var(--text-dim);font-family:var(--font-body);font-size:0.82rem;cursor:pointer;margin-top:0.25rem">Cancel</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      overlay.querySelector('#rm-just-one').onclick  = function() { document.body.removeChild(overlay); resolve('one'); };
      overlay.querySelector('#rm-all-group').onclick = function() { document.body.removeChild(overlay); resolve('all'); };
      overlay.querySelector('#rm-cancel').onclick    = function() { document.body.removeChild(overlay); resolve('cancel'); };
    });
    if (choice === 'cancel') return;

    if (choice === 'all') {
      // Remove every item in the group — delete from bottom to top to avoid row shift issues
      var sortedSibs = groupSiblings.slice().sort(function(a, b) { return (b.row || 0) - (a.row || 0); });
      var fsRowsToDelete = [];
      for (var sib of sortedSibs) {
        var sibKey = sib.inventoryId || findPDKeyByRow(sib.itemNum, sib.variation, sib.row);
        if (sib.row && sib.row !== 99999) {
          try {
            await sheetsDeleteRow(state.personalSheetId, 'My Collection', sib.row);
            _adjustRowsAfterDelete(state.personalData, sib.row);
          } catch(e) { console.warn('Remove group row error:', sib.itemNum, e); }
        }
        var sibFsKey = sib.itemNum + '|' + (sib.variation || '');
        var sibFs = state.forSaleData[sibFsKey];
        if (sibFs && sibFs.row) {
          fsRowsToDelete.push(sibFs.row);
          delete state.forSaleData[sibFsKey];
        }
        if (sibKey) delete state.personalData[sibKey];
      }
      // Delete For Sale rows bottom-to-top
      fsRowsToDelete.sort(function(a, b) { return b - a; });
      for (var fsRow of fsRowsToDelete) {
        try {
          await sheetsDeleteRow(state.personalSheetId, 'For Sale', fsRow);
          _adjustRowsAfterDelete(state.forSaleData, fsRow);
        } catch(e) { console.warn('FS cleanup:', e); }
      }
      _cachePersonalData();
      renderBrowse();
      buildDashboard();
      showToast('✓ Removed ' + groupSiblings.length + ' grouped items');
      return;
    }
    // else fall through to remove just this one item
  } else {
    // Standalone item — simple confirm
    if (!(await appConfirm('Remove No. ' + itemNum + (variation ? ' (Var. ' + variation + ')' : '') + ' from your collection?', { danger: true, ok: 'Remove' }))) return;
  }

  // ── Remove single item ──
  var _delRow = thisPd ? thisPd.row : row;
  if (_delRow && _delRow !== 99999) {
    try {
      await sheetsDeleteRow(state.personalSheetId, 'My Collection', _delRow);
    } catch(e) { console.error('Remove row error:', e); showToast('Error removing item — please try again', 3000, true); return; }
  }
  // Also remove from For Sale if listed
  var fsKey = itemNum + '|' + (variation || '');
  var fsEntry = state.forSaleData[fsKey];
  if (fsEntry && fsEntry.row) {
    try {
      await sheetsDeleteRow(state.personalSheetId, 'For Sale', fsEntry.row);
      _adjustRowsAfterDelete(state.forSaleData, fsEntry.row);
    } catch(e) { console.warn('For Sale cleanup:', e); }
    delete state.forSaleData[fsKey];
  }
  if (pdKey) delete state.personalData[pdKey];
  if (_delRow && _delRow !== 99999) _adjustRowsAfterDelete(state.personalData, _delRow);
  _cachePersonalData();
  renderBrowse();
  buildDashboard();
  showToast('✓ Removed from collection');
}

// After deleting a sheet row, decrement .row on all in-memory records above that row.
// This keeps row numbers accurate without a full background reload.
function _adjustRowsAfterDelete(dataObj, deletedRow) {
  if (!deletedRow || deletedRow === 99999) return;
  Object.values(dataObj).forEach(rec => {
    if (rec.row && rec.row > deletedRow && rec.row !== 99999) rec.row--;
  });
}

function sellFromCollection(idx, pdKey) {
  const pd = state.personalData[pdKey] || {};
  const item = state.masterData[idx] || {
    itemNum: pd.itemNum, variation: pd.variation || '',
    roadName: pd.roadName || '', itemType: pd.itemType || '',
    yearProd: pd.yearMade || '', marketVal: '',
  };
  if (!item.itemNum) return;
  // Open sell wizard pre-filled with item info
  wizard = { step: 0, tab: 'sold', data: {
    tab: 'sold',
    itemNum: item.itemNum,
    variation: item.variation || '',
    condition: pd.condition || '',
    priceItem: pd.priceItem || '',
    estWorth: pd.userEstWorth || '',
    _collectionPdKey: pdKey,
    _collectionRow: pd.row
  }, steps: getSteps('sold'), matchedItem: item };
  document.getElementById('wizard-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
  // Skip tab, itemNum, variation steps
  const autoSkip = new Set(['tab', 'itemNum', 'variation', 'itemPicker', 'itemCategory']);
  while (wizard.step < wizard.steps.length - 1) {
    const s = wizard.steps[wizard.step];
    if (autoSkip.has(s.id) || (s.skipIf && s.skipIf(wizard.data))) wizard.step++;
    else break;
  }
  renderWizardStep();
}

function listForSaleFromCollection(idx, pdKey) {
  const pd = state.personalData[pdKey] || {};
  const item = state.masterData[idx] || {
    itemNum: pd.itemNum, variation: pd.variation || '',
    roadName: pd.roadName || '', itemType: pd.itemType || '',
    yearProd: pd.yearMade || '', marketVal: '',
  };
  // Pre-fill from collection data and existing for-sale listing
  const fsKey = pd.itemNum + '|' + (pd.variation || '');
  const existingFs = state.forSaleData[fsKey] || {};
  wizard = { step: 0, tab: 'forsale', data: {
    tab: 'forsale',
    itemNum: item.itemNum,
    variation: item.variation || '',
    condition: existingFs.condition || pd.condition || '',
    selectedForSaleKey: pdKey,
    askingPrice: existingFs.askingPrice || '',
    dateListed: existingFs.dateListed || '',
    notes: existingFs.notes || '',
    originalPrice: pd.priceItem || '',
    estWorth: pd.userEstWorth || '',
    _collectionPdKey: pdKey,
  }, steps: getSteps('forsale'), matchedItem: item };
  _buildWizardModal();
  document.getElementById('wizard-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
  // Skip tab, itemNum, pickForSaleItem, condition steps (all pre-filled from collection)
  const autoSkip = new Set(['tab', 'itemNum', 'variation', 'itemPicker', 'itemCategory', 'pickForSaleItem', 'condition']);
  while (wizard.step < wizard.steps.length - 1) {
    const s = wizard.steps[wizard.step];
    if (autoSkip.has(s.id) || (s.skipIf && s.skipIf(wizard.data))) wizard.step++;
    else break;
  }
  renderWizardStep();
}

function showPickFromCollectionForSale() {
  const owned = Object.entries(state.personalData).filter(function(e) { return e[1].owned; });
  if (owned.length === 0) {
    showToast('No items in your collection yet');
    return;
  }
  const existing = document.getElementById('pick-fs-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'pick-fs-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

  const box = document.createElement('div');
  box.style.cssText = 'background:var(--surface);border:1px solid rgba(230,126,34,0.4);border-radius:16px;max-width:480px;width:100%;position:relative;max-height:85vh;display:flex;flex-direction:column;overflow:hidden';

  // Header
  const hdr = document.createElement('div');
  hdr.style.cssText = 'padding:1rem 1.25rem;border-bottom:1px solid var(--border);flex-shrink:0;display:flex;align-items:center;justify-content:space-between';
  hdr.innerHTML = '<div style="font-family:var(--font-head);font-size:1rem;color:#e67e22">List from Collection</div>'
    + '<button onclick="document.getElementById(\'pick-fs-overlay\').remove()" style="background:none;border:none;color:var(--text-dim);font-size:1.1rem;cursor:pointer">✕</button>';
  box.appendChild(hdr);

  // Search
  const searchWrap = document.createElement('div');
  searchWrap.style.cssText = 'padding:0.6rem 1.25rem;border-bottom:1px solid var(--border);flex-shrink:0';
  searchWrap.innerHTML = '<input id="pick-fs-search" type="text" placeholder="Search item #, road name…" style="width:100%;border:1px solid var(--border);border-radius:7px;padding:0.45rem 0.7rem;background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.85rem;outline:none;box-sizing:border-box" oninput="_filterPickFs(this.value)">';
  box.appendChild(searchWrap);

  // Scrollable item list
  const listWrap = document.createElement('div');
  listWrap.id = 'pick-fs-list';
  listWrap.style.cssText = 'flex:1;overflow-y:auto;padding:0.5rem 1rem';
  box.appendChild(listWrap);

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  // Render the list
  _renderPickFsList('');
}

function _renderPickFsList(q) {
  const listEl = document.getElementById('pick-fs-list');
  if (!listEl) return;
  q = (q || '').toLowerCase();

  const owned = Object.entries(state.personalData).filter(function(e) {
    if (!e[1].owned) return false;
    if (!q) return true;
    var pd = e[1];
    var master = findMaster(pd.itemNum, (pd.variation||'')) || {};
    return (pd.itemNum||'').toLowerCase().includes(q)
      || (master.roadName||'').toLowerCase().includes(q)
      || (master.itemType||'').toLowerCase().includes(q)
      || (pd.variation||'').toLowerCase().includes(q);
  });

  // Sort by item number
  owned.sort(function(a,b) { return (a[1].itemNum||'').localeCompare(b[1].itemNum||'', undefined, {numeric:true}); });

  if (owned.length === 0) {
    listEl.innerHTML = '<div class="ui-empty">No matching items</div>';
    return;
  }

  var html = '';
  owned.forEach(function(entry) {
    var pdKey = entry[0], pd = entry[1];
    var master = findMaster(pd.itemNum, (pd.variation||'')) || {};
    var fsKey = pd.itemNum + '|' + (pd.variation||'');
    var alreadyListed = !!state.forSaleData[fsKey];
    var idx = state.masterData.indexOf(master);
    if (idx < 0) idx = -1;

    html += '<button onclick="_pickFsSelect(' + idx + ',\'' + pdKey.replace(/'/g,"\\'") + '\')" style="'
      + 'display:flex;align-items:center;gap:0.7rem;padding:0.7rem 0.85rem;'
      + 'border-radius:9px;text-align:left;width:100%;cursor:pointer;'
      + 'font-family:var(--font-body);margin-bottom:0.35rem;transition:all 0.15s;'
      + 'border:1.5px solid ' + (alreadyListed ? 'rgba(230,126,34,0.4)' : 'var(--border)') + ';'
      + 'background:' + (alreadyListed ? 'rgba(230,126,34,0.06)' : 'var(--surface2)') + '">'
      + '<div style="flex:1">'
      + '<div style="font-family:var(--font-mono);font-size:0.88rem;color:var(--accent2);font-weight:600">'
      + pd.itemNum + (pd.variation ? ' <span style="color:var(--text-dim);font-size:0.72rem">Var ' + pd.variation + '</span>' : '')
      + '</div>'
      + '<div style="font-size:0.78rem;color:var(--text-mid);margin-top:0.15rem">'
      + (master.roadName || master.itemType || '')
      + (pd.condition ? ' · Cond: ' + pd.condition + '/10' : '')
      + (pd.priceItem ? ' · Paid: $' + parseFloat(pd.priceItem).toLocaleString() : '')
      + '</div>'
      + '</div>'
      + (alreadyListed ? '<span style="font-size:0.68rem;color:#e67e22;font-weight:600;white-space:nowrap">LISTED</span>' : '')
      + '</button>';
  });
  listEl.innerHTML = html;
}

function _filterPickFs(q) { _renderPickFsList(q); }

function _pickFsSelect(idx, pdKey) {
  document.getElementById('pick-fs-overlay').remove();
  listForSaleFromCollection(idx, pdKey);
}

function updateCollectionItem(idx, pdKey) {
  showItemPanel(idx, pdKey, 'edit');
}

function showItemPanel(idx, pdKey, mode) {
  const pd = state.personalData[pdKey] || {};
  const item = state.masterData[idx] || {
    itemNum: pd.itemNum, variation: pd.variation || '',
    roadName: pd.roadName || '', itemType: pd.itemType || '',
    yearProd: pd.yearMade || '', marketVal: '', // market value comes from master sheet only
    varDesc: '', description: '',
  };

  const existing = document.getElementById('item-panel-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'item-panel-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

  const box = document.createElement('div');
  box.style.cssText = 'background:var(--surface);border:1px solid rgba(41,128,185,0.35);border-radius:16px;max-width:500px;width:100%;position:relative;max-height:92vh;display:flex;flex-direction:column;overflow:hidden';

  // Header
  const header = document.createElement('div');
  header.style.cssText = 'padding:1.25rem 1.5rem;border-bottom:1px solid var(--border);flex-shrink:0';
  header.innerHTML = '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:0.5rem">'
    + '<div>'
    + '<div style="font-family:var(--font-head);font-size:1rem;color:#2980b9">No. ' + item.itemNum + (item.variation ? ' <span style="color:var(--text-dim);font-size:0.75rem">Var. ' + item.variation + '</span>' : '') + '</div>'
    + '<div style="font-size:0.82rem;color:var(--text-mid);margin-top:2px">' + (item.roadName || item.itemType || '') + (item.yearProd ? ' · ' + item.yearProd : '') + '</div>'
    + '</div>'
    + '<button id="item-panel-close-btn" style="background:none;border:none;color:var(--text-dim);font-size:1.1rem;cursor:pointer;flex-shrink:0">✕</button>'
    + '</div>';
  box.appendChild(header);
  // Wire close btn now that header is in memory
  const _hdrClose = header.querySelector('#item-panel-close-btn');
  if (_hdrClose) _hdrClose.onclick = function() { overlay.remove(); };

  // Scrollable content — split into photos (permanent) + fields (re-rendered)
  const body = document.createElement('div');
  body.style.cssText = 'flex:1;overflow-y:auto;padding:0.75rem 1.5rem';
  const photoContainer = document.createElement('div');
  photoContainer.id = 'item-panel-photo-container';
  body.appendChild(photoContainer);
  const fieldsContainer = document.createElement('div');
  fieldsContainer.id = 'item-panel-fields-container';
  body.appendChild(fieldsContainer);

  const fields = [
    { label: 'Condition',     key: 'condition',     val: pd.condition || '—',     type: 'number', min:1, max:10 },
    { label: 'All Original',  key: 'allOriginal',   val: pd.allOriginal || '—',   type: 'select', options: ['Yes','No','Unknown'] },
    { label: 'Has Box',       key: 'hasBox',        val: pd.hasBox || '—',        type: 'select', options: ['Yes','No'] },
    { label: 'Box Condition', key: 'boxCond',       val: pd.boxCond || '—',       type: 'number', min:1, max:10 },
    { label: 'Price Paid ($)',key: 'priceItem',     val: pd.priceItem || '—',     type: 'number' },
    { label: 'Est. Worth (insurance)',key: 'userEstWorth',  val: pd.userEstWorth || '—',  type: 'number' },
    { label: 'Year Made',     key: 'yearMade',      val: pd.yearMade || '—',      type: 'number', min:1945, max:1969 },
    { label: 'Date Purchased',key: 'datePurchased', val: pd.datePurchased || '—', type: 'date' },
    { label: 'Notes',         key: 'notes',         val: pd.notes || '—',         type: 'text' },
    { label: 'Location',      key: 'location',      val: pd.location || '—',      type: 'text' },
    ...(item.refLink ? [{ label: 'COTT Reference', key: null, val: item.refLink, type: 'readonly' }] : []),
    ...(pd.isError === 'Yes' || item.errorDesc ? [{ label: 'Error', key: null, val: pd.errorDesc || '—', type: 'readonly' }] : []),
  ];

  // ── Photos section ──
  const photoSection = document.createElement('div');
  photoSection.id = 'item-panel-photos';
  photoSection.style.cssText = 'padding:0.75rem 0;border-bottom:1px solid var(--border);margin-bottom:0.25rem';

  // Header row with label + "Add Photos" button
  const photoHdr = document.createElement('div');
  photoHdr.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem';
  photoHdr.innerHTML = '<span style="font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.08em">Photos</span>';
  const addPhotoBtn = document.createElement('button');
  addPhotoBtn.style.cssText = 'font-size:0.72rem;padding:0.2rem 0.55rem;border-radius:5px;border:1px solid #2980b9;color:#2980b9;background:rgba(224,64,40,0.08);cursor:pointer;display:flex;align-items:center;gap:0.25rem';
  addPhotoBtn.innerHTML = '📷 Add Photos';
  addPhotoBtn.onclick = function() {
    // Close this panel and open photo wizard for this item
    document.getElementById('item-panel-overlay').remove();
    openPhotoWizard(item.itemNum, pd.variation || item.variation || '', pdKey);
  };
  photoHdr.appendChild(addPhotoBtn);
  photoSection.appendChild(photoHdr);

  // Thumbnail row
  const thumbRow = document.createElement('div');
  thumbRow.id = 'item-panel-thumb-row';
  thumbRow.style.cssText = 'display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center';
  thumbRow.innerHTML = '<span style="font-size:0.75rem;color:var(--text-dim)">Loading…</span>';
  photoSection.appendChild(thumbRow);

  // Folder link
  const folderLinkEl = document.createElement('div');
  folderLinkEl.id = 'item-panel-folder-link';
  folderLinkEl.style.cssText = 'margin-top:0.4rem;min-height:1.2rem';
  photoSection.appendChild(folderLinkEl);

  photoContainer.appendChild(photoSection);

  // Async load photos — use direct references (element not in DOM yet when IIFE fires)
  const _thumbRowRef = thumbRow;
  const _folderLinkRef = folderLinkEl;
  (async function() {
    const tr2 = _thumbRowRef;
    const fl2 = _folderLinkRef;
    try {
      // Wait for accessToken to be available (max 5s)
      let waited = 0;
      while (!accessToken && waited < 5000) {
        await new Promise(r => setTimeout(r, 200));
        waited += 200;
      }
      if (!accessToken) {
        if (tr2) tr2.innerHTML = '<span style="font-size:0.75rem;color:var(--text-dim)">Not signed in to Drive</span>';
        return;
      }

      let folderLink = pd.photoItem || '';
      if (!folderLink) {
        try { await driveEnsureSetup(); } catch(e) {}
        try {
          const folderId = await driveEnsureItemFolder(item.itemNum);
          folderLink = driveFolderLink(folderId);
        } catch(e) {}
      }

      // Show folder link
      if (fl2 && folderLink) {
        const a = document.createElement('a');
        a.href = folderLink; a.target = '_blank';
        a.style.cssText = 'font-size:0.72rem;color:#2980b9';
        a.textContent = '📁 Open Drive Folder ↗';
        fl2.innerHTML = '';
        fl2.appendChild(a);
      }

      if (!tr2) return;

      const photos = await driveGetFolderPhotos(folderLink);

      if (photos === null) {
        tr2.innerHTML = '<span style="font-size:0.75rem;color:var(--text-dim)">Could not load photos — check Drive access</span>';
        return;
      }
      if (photos.length === 0) {
        tr2.innerHTML = '<span style="font-size:0.75rem;color:var(--text-dim);font-style:italic">No photos yet — tap Add Photos</span>';
        return;
      }

      // Sort: RSV first, then FV, then others
      const priority = function(name) {
        const n = (name || '').toUpperCase();
        if (n.includes('RSV')) return 0;
        if (n.includes('FV'))  return 1;
        if (n.includes('TV'))  return 2;
        if (n.includes('BV'))  return 3;
        return 9;
      };
      photos.sort(function(a,b) { return priority(a.name) - priority(b.name); });

      tr2.innerHTML = '';
      photos.forEach(function(p) {
        const isRSV = p.name.toUpperCase().includes('RSV');
        const a = document.createElement('a');
        a.href = p.view; a.target = '_blank';
        a.title = p.name.replace(/\.[^.]+$/, '');
        a.style.cssText = 'display:inline-block;border-radius:8px;overflow:hidden;border:2px solid '
          + (isRSV ? '#2980b9' : 'var(--border)') + ';flex-shrink:0';
        const img = document.createElement('img');
        img.style.cssText = 'width:80px;height:80px;object-fit:cover;display:block;background:var(--surface2)';
        img.alt = p.name.replace(/\.[^.]+$/, '').split(' ').pop();
        // Authenticated load using file ID
        loadDriveThumb(p.id, img, a);
        const lbl = document.createElement('div');
        lbl.style.cssText = 'font-size:0.68rem;text-align:center;padding:2px 0;background:var(--surface2);color:var(--text-dim);letter-spacing:0.03em';
        lbl.textContent = p.name.replace(/\.[^.]+$/, '').split(' ').pop();
        a.appendChild(img);
        a.appendChild(lbl);
        tr2.appendChild(a);
      });

    } catch(e) {
      console.error('Photo load error:', e);
      if (tr2) tr2.innerHTML = '<span style="font-size:0.75rem;color:var(--text-dim)">Could not load photos</span>';
    }
  })();

  // Track which field is being edited
  let editingKey = null;

  function renderFields(activeKey) {
    fieldsContainer.innerHTML = '';
    fields.forEach(function(f) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:0.75rem;padding:0.65rem 0;border-bottom:1px solid var(--border);min-height:44px';

      const lbl = document.createElement('div');
      lbl.style.cssText = 'font-size:0.75rem;color:var(--text-dim);width:120px;flex-shrink:0';
      lbl.textContent = f.label;

      const valWrap = document.createElement('div');
      valWrap.style.cssText = 'flex:1';

      // Bugfix 2026-04-14: skip edit branch for null-keyed fields (COTT Reference, Error)
      // and for readonly/link types — otherwise activeKey===null matches f.key===null on
      // initial render and renders an editable input for read-only fields.
      if (mode === 'edit' && f.key != null && f.type !== 'readonly' && f.type !== 'link' && activeKey === f.key) {
        // Show input
        let inp;
        if (f.type === 'select') {
          inp = document.createElement('select');
          inp.style.cssText = 'width:100%;background:var(--bg);border:1px solid #2980b9;border-radius:6px;padding:0.4rem 0.6rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem';
          f.options.forEach(function(o) {
            const opt = document.createElement('option');
            opt.value = o; opt.textContent = o;
            if (o === (pd[f.key] || '')) opt.selected = true;
            inp.appendChild(opt);
          });
        } else {
          inp = document.createElement('input');
          inp.type = f.type === 'text' ? 'text' : f.type;
          inp.value = pd[f.key] || '';
          if (f.min !== undefined) inp.min = f.min;
          if (f.max !== undefined) inp.max = f.max;
          inp.style.cssText = 'width:100%;background:var(--bg);border:1px solid #2980b9;border-radius:6px;padding:0.4rem 0.6rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem;box-sizing:border-box';
        }
        inp.id = 'panel-inp-' + f.key;
        setTimeout(function() { if (inp) inp.focus(); }, 30);

        const doneBtn = document.createElement('button');
        doneBtn.textContent = '✓';
        doneBtn.style.cssText = 'margin-left:0.4rem;padding:0.3rem 0.6rem;border-radius:6px;border:1px solid #2980b9;background:#2980b9;color:#fff;cursor:pointer;font-size:0.85rem;flex-shrink:0';
        doneBtn.onclick = function() {
          pd[f.key] = inp.value;
          f.val = inp.value || '—';
          editingKey = null;
          renderFields(null);
        };

        const cancelInp = document.createElement('button');
        cancelInp.textContent = '✕';
        cancelInp.style.cssText = 'margin-left:0.25rem;padding:0.3rem 0.5rem;border-radius:6px;border:1px solid var(--border);background:none;color:var(--text-dim);cursor:pointer;font-size:0.85rem;flex-shrink:0';
        cancelInp.onclick = function() { editingKey = null; renderFields(null); };

        const inpRow = document.createElement('div');
        inpRow.style.cssText = 'display:flex;align-items:center;gap:0;width:100%';
        inpRow.appendChild(inp);
        inpRow.appendChild(doneBtn);
        inpRow.appendChild(cancelInp);
        valWrap.appendChild(inpRow);

      } else if (f.type === 'link') {
        // External link — render as clickable anchor, no edit
        const a = document.createElement('a');
        a.href = f.val;
        a.target = '_blank';
        a.rel = 'noopener';
        a.style.cssText = 'font-size:0.85rem;color:#2980b9;text-decoration:none;display:inline-flex;align-items:center;gap:0.3rem';
        a.innerHTML = 'View on COTT <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
        valWrap.appendChild(a);
        row.appendChild(lbl);
        row.appendChild(valWrap);
        fieldsContainer.appendChild(row);
        return;
      } else if (f.type === 'readonly') {
        // Read-only value with accent color, no edit
        const valEl = document.createElement('span');
        valEl.style.cssText = 'font-size:0.85rem;color:var(--accent);font-style:italic';
        valEl.textContent = f.val && f.val !== '—' ? f.val : '—';
        valWrap.appendChild(valEl);
        row.appendChild(lbl);
        row.appendChild(valWrap);
        fieldsContainer.appendChild(row);
        return;
      } else {
        // Show value
        const valEl = document.createElement('span');
        valEl.style.cssText = 'font-size:0.88rem;color:' + (f.val && f.val !== '—' ? 'var(--text)' : 'var(--text-dim)');
        valEl.textContent = f.val && f.val !== '—' ? f.val : '—';
        valWrap.appendChild(valEl);

        if (mode === 'edit') {
          const editBtn = document.createElement('button');
          editBtn.textContent = '✏️';
          editBtn.title = 'Edit';
          editBtn.style.cssText = 'margin-left:0.5rem;padding:0.15rem 0.4rem;border-radius:5px;border:1px solid var(--border);background:none;cursor:pointer;font-size:0.75rem;color:var(--text-dim)';
          editBtn.onclick = function() { editingKey = f.key; renderFields(f.key); };
          valWrap.appendChild(editBtn);
        }
      }

      row.appendChild(lbl);
      row.appendChild(valWrap);
      fieldsContainer.appendChild(row);
    });
  }

  renderFields(null);

  // Instruction Sheets linked to this item
  const _liNum = (item.itemNum || '').replace(/-[PD]$/,'').trim();
  const _linkedIS = Object.values(state.isData || {}).filter(s => {
    const li = (s.linkedItem || '').trim();
    return li === _liNum || li === item.itemNum;
  });
  if (_linkedIS.length) {
    const isSection = document.createElement('div');
    isSection.style.cssText = 'margin-top:0.75rem;padding-top:0.75rem;border-top:2px solid rgba(22,160,133,0.3)';
    isSection.innerHTML = '<div style="font-size:0.72rem;font-weight:600;letter-spacing:0.1em;color:#16a085;text-transform:uppercase;margin-bottom:0.5rem">📋 Instruction Sheets</div>'
      + _linkedIS.map(s => `<div onclick="openISDetail(${s.row})" style="display:flex;align-items:center;gap:0.6rem;padding:0.45rem 0.5rem;border-radius:8px;cursor:pointer;transition:background 0.1s" class="dash-row-hover">
        <span style="font-family:var(--font-mono);font-size:0.85rem;color:#16a085;font-weight:600;min-width:80px">${s.sheetNum}</span>
        <span style="font-size:0.8rem;color:var(--text-mid)">${s.year||''}</span>
        ${s.condition?`<span style="font-size:0.78rem;color:var(--text-dim);margin-left:auto">Cond: ${s.condition}/10</span>`:''}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
      </div>`).join('');
    body.appendChild(isSection);
  }

  box.appendChild(body);

  // Footer buttons
  const footer = document.createElement('div');
  footer.style.cssText = 'padding:1rem 1.5rem;border-top:1px solid var(--border);display:flex;gap:0.6rem;flex-shrink:0';

  if (mode === 'view') {
    const editModeBtn = document.createElement('button');
    editModeBtn.className = 'btn';
    editModeBtn.style.cssText = 'flex:1;border:1.5px solid #2980b9;color:#2980b9;background:rgba(224,64,40,0.08);font-weight:600';
    editModeBtn.innerHTML = '✏️ Edit This Item';
    editModeBtn.onclick = function() { mode = 'edit'; renderFields(null); footer.innerHTML = ''; buildFooter(); };
    footer.appendChild(editModeBtn);
  } else {
    buildFooter();
  }

  function buildFooter() {
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-primary';
    saveBtn.style.cssText = 'flex:1;background:#2980b9;border-color:#2980b9;font-weight:600';
    saveBtn.textContent = '💾 Save All Changes';
    saveBtn.onclick = async function() {
      saveBtn.textContent = 'Saving…'; saveBtn.disabled = true;
      // Collect all current pd values (updated in-place during edits)
      const priceItem = pd.priceItem || '';
      const priceBox = pd.priceBox || '';
      const calc = (parseFloat(priceItem)||0) + (parseFloat(priceBox)||0);
      const newRow = [
        item.itemNum, item.variation || '',
        pd.condition || '', pd.allOriginal || '',
        priceItem, priceBox, calc > 0 ? calc.toFixed(2) : '',
        pd.hasBox || '', pd.boxCond || '',
        pd.photoItem || '', pd.photoBox || '',
        pd.notes || '', pd.datePurchased || '',
        pd.userEstWorth || '', pd.matchedTo || '',
        pd.setId || '', pd.yearMade || '',
        pd.isError || '', pd.errorDesc || '',
        pd.quickEntry ? 'Yes' : '',
        pd.inventoryId || '', pd.groupId || '',
        pd.location || '',  // Location (col W)
        pd.era || '',        // Era (col X)
        pd.manufacturer || '', // Manufacturer (col Y)
      ];
      try {
        await sheetsUpdate(state.personalSheetId, 'My Collection!A' + pd.row + ':Y' + pd.row, [newRow]);
        state.personalData[pdKey] = Object.assign({}, pd, { priceComplete: calc > 0 ? calc.toFixed(2) : '' });
        overlay.remove();
        showToast('✓ Item updated!');
        buildDashboard();
      } catch(e) {
        saveBtn.textContent = '💾 Save All Changes'; saveBtn.disabled = false;
        showToast('Error: ' + e.message);
      }
    };

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = function() { overlay.remove(); };

    footer.innerHTML = '';
    footer.appendChild(saveBtn);
    footer.appendChild(cancelBtn);
  }

  box.appendChild(footer);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}


function openISDetail(rowKey) {
  const it = state.isData[rowKey];
  if (!it) return;
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem';
  overlay.onclick = e => { if(e.target===overlay) overlay.remove(); };
  const box = document.createElement('div');
  box.style.cssText = 'background:var(--surface);border:1px solid rgba(22,160,133,0.4);border-radius:16px;max-width:460px;width:100%;padding:1.75rem;position:relative;max-height:88vh;overflow-y:auto';
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML='✕'; closeBtn.style.cssText='position:absolute;top:0.75rem;right:0.75rem;background:none;border:none;color:var(--text-dim);font-size:1.1rem;cursor:pointer';
  closeBtn.onclick=()=>overlay.remove();
  box.appendChild(closeBtn);
  box.innerHTML += `
    <div style="font-family:var(--font-head);font-size:1rem;color:#16a085;margin-bottom:0.15rem">📋 Sheet # ${it.sheetNum}</div>
    <div style="font-size:0.82rem;color:var(--text-mid);margin-bottom:1.25rem">Instruction Sheet${it.linkedItem?' for Item No. '+it.linkedItem:''}</div>
    <div style="display:flex;flex-direction:column;gap:0.5rem;font-size:0.85rem">
      ${[
        ['Sheet #',       it.sheetNum||'—'],
        ['Linked Item #', it.linkedItem||'—'],
        ['Year / Date',   it.year||'—'],
        ['Condition',     it.condition ? it.condition+'/10' : '—'],
        ['Notes',         it.notes||'—'],
      ].map(([l,v])=>`<div style="display:flex;gap:0.75rem;padding:0.45rem 0;border-bottom:1px solid var(--border)">
        <span style="color:var(--text-dim);min-width:110px;flex-shrink:0">${l}</span>
        <span>${v}</span>
      </div>`).join('')}
      ${it.photoLink?`<div style="margin-top:0.75rem"><a href="${it.photoLink}" target="_blank" rel="noopener" style="font-size:0.82rem;color:#16a085;text-decoration:none">📷 View Photos ↗</a></div>`:''}
    </div>`;
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function browseRowClick(event, idx) {
  // If click was on the varDesc popup span, don't intercept
  if (event.target.closest && event.target.closest('[onclick*="showVarDescPopup"]')) return;
  // Handle _personalOnly items encoded as negative sentinel
  if (idx <= -1000) {
    const poIdx = Math.abs(idx) - 1000;
    const pdKey = (window._poKeys || [])[poIdx];
    if (pdKey) { showOwnedItemMenu(-1, pdKey); }
    return;
  }
  const item = state.masterData[idx];
  if (!item) return;
  // Use findPDKey which handles P/D suffix fallback for AA/AB units
  const pdKey = findPDKey(item.itemNum, item.variation);
  const alreadyOwned = !!pdKey;
  // Also check Science/Construction dedicated tabs
  const _sciOwned = (item._tab === SHEET_TABS.science || item.itemType === 'Science Set')
    ? Object.values(state.scienceData || {}).filter(s => String(s.itemNum) === String(item.itemNum) && String(s.variation || '') === String(item.variation || ''))
    : [];
  const _conOwned = (item._tab === SHEET_TABS.construction || item.itemType === 'Construction Set')
    ? Object.values(state.constructionData || {}).filter(s => String(s.itemNum) === String(item.itemNum) && String(s.variation || '') === String(item.variation || ''))
    : [];
  const _specialOwned = _sciOwned.length + _conOwned.length;
  if (alreadyOwned) {
    showOwnedItemMenu(idx, pdKey);
    return;
  }
  if (_specialOwned > 0) {
    // Show a simple owned menu for Science/Construction items
    _showSpecialOwnedMenu(idx, item, _sciOwned.length > 0 ? _sciOwned : _conOwned);
    return;
  }
  // Not owned — show quick prompt
  const existing = document.getElementById('browse-add-prompt');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'browse-add-prompt';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1.5rem';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
  const box = document.createElement('div');
  box.style.cssText = 'background:var(--surface);border:1px solid rgba(232,64,28,0.4);border-radius:16px;max-width:440px;width:100%;padding:1.75rem;position:relative';
  // Header
  const hdr = document.createElement('div');
  hdr.style.cssText = 'font-family:var(--font-head);font-size:1.05rem;color:var(--accent);margin-bottom:0.25rem';
  hdr.textContent = 'No. ' + item.itemNum + (item.variation ? ' — Var. ' + item.variation : '');
  box.appendChild(hdr);
  const sub = document.createElement('div');
  sub.style.cssText = 'font-size:0.85rem;color:var(--text-mid);margin-bottom:0.25rem';
  sub.textContent = item.roadName || item.itemType || '';
  box.appendChild(sub);
  if (item.yearProd) {
    const yr = document.createElement('div');
    yr.style.cssText = 'font-size:0.75rem;color:var(--text-dim);margin-bottom:1.25rem';
    yr.textContent = item.yearProd + (item.itemType ? ' · ' + item.itemType : '');
    box.appendChild(yr);
  } else {
    sub.style.marginBottom = '1.25rem';
  }
  // Question
  const q = document.createElement('div');
  q.style.cssText = 'font-size:0.9rem;color:var(--text);margin-bottom:1.25rem;font-weight:500';
  q.textContent = 'Do you own this item?';
  box.appendChild(q);
  // Buttons
  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:0.75rem';
  const yesBtn = document.createElement('button');
  yesBtn.className = 'btn btn-primary';
  yesBtn.style.cssText = 'flex:1;background:var(--accent);border-color:var(--accent);font-weight:600';
  yesBtn.textContent = '✓ Yes — Add to Collection';
  yesBtn.onclick = function() { overlay.remove(); addFromBrowse(idx); };
  const viewBtn = document.createElement('button');
  viewBtn.className = 'btn btn-secondary';
  viewBtn.style.cssText = 'flex:1';
  viewBtn.textContent = 'View Details';
  viewBtn.onclick = function() {
    overlay.remove();
    // Show description popup
    const vdOverlay = document.createElement('div');
    vdOverlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1.5rem';
    vdOverlay.onclick = function(e) { if (e.target === vdOverlay) vdOverlay.remove(); };
    const vdBox = document.createElement('div');
    vdBox.style.cssText = 'background:var(--surface);border:1px solid var(--border);border-radius:14px;max-width:520px;width:100%;padding:1.75rem;position:relative;max-height:80vh;overflow-y:auto';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'position:absolute;top:0.75rem;right:0.75rem;background:none;border:none;color:var(--text-dim);font-size:1.1rem;cursor:pointer';
    closeBtn.onclick = function() { vdOverlay.remove(); };
    vdBox.appendChild(closeBtn);
    const rows = [
      ['Item #', item.itemNum + (item.variation ? ' — Var. ' + item.variation : '')],
      ['Type', item.itemType || '—'],
      ['Road / Name', item.roadName || '—'],
      ['Year', item.yearProd || '—'],
    ];
    if (item.control) rows.push(['Control', item.control]);
    if (item.gauge) rows.push(['Gauge', item.gauge]);
    rows.push(['Market Value', item.marketVal ? '$' + parseFloat(item.marketVal).toLocaleString() : '—']);
    rows.forEach(function(r) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:0.75rem;margin-bottom:0.4rem;font-size:0.85rem';
      const lbl = document.createElement('span');
      lbl.style.cssText = 'color:var(--text-dim);min-width:90px;flex-shrink:0';
      lbl.textContent = r[0];
      const val = document.createElement('span');
      val.style.cssText = 'color:var(--text)';
      val.textContent = r[1];
      row.appendChild(lbl);
      row.appendChild(val);
      vdBox.appendChild(row);
    });
    if (item.varDesc) {
      const vdSec = document.createElement('div');
      vdSec.style.cssText = 'margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border);font-size:0.82rem;color:var(--text-mid);line-height:1.6';
      vdSec.innerHTML = '<span style="color:var(--accent2);font-weight:600">Variation: </span>' + item.varDesc;
      vdBox.appendChild(vdSec);
    }
    if (item.description) {
      const descSec = document.createElement('div');
      descSec.style.cssText = 'margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border);font-size:0.82rem;color:var(--text-mid);line-height:1.6';
      descSec.textContent = item.description;
      vdBox.appendChild(descSec);
    }
    if (item.refLink) {
      const cottRow = document.createElement('div');
      cottRow.style.cssText = 'margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border)';
      const cottA = document.createElement('a');
      cottA.href = item.refLink;
      cottA.target = '_blank';
      cottA.rel = 'noopener';
      cottA.style.cssText = 'font-size:0.82rem;color:#2980b9;text-decoration:none;display:inline-flex;align-items:center;gap:0.35rem';
      cottA.innerHTML = 'View on COTT <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
      cottRow.appendChild(cottA);
      vdBox.appendChild(cottRow);
    }
    // Add to collection button at bottom
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary';
    addBtn.style.cssText = 'margin-top:1.25rem;width:100%;background:var(--accent);border-color:var(--accent);line-height:1.25';
    addBtn.innerHTML = '<span style="display:block;font-size:0.75em;opacity:0.85;font-weight:400;letter-spacing:0.03em">Add to</span><span style="display:block">Collection</span>';
    addBtn.onclick = function() { vdOverlay.remove(); addFromBrowse(idx); };
    vdBox.appendChild(addBtn);
    vdOverlay.appendChild(vdBox);
    document.body.appendChild(vdOverlay);
  };
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-secondary';
  cancelBtn.style.cssText = 'padding:0.6rem 0.9rem';
  cancelBtn.textContent = '✕';
  cancelBtn.onclick = function() { overlay.remove(); };
  btnRow.appendChild(yesBtn);
  btnRow.appendChild(viewBtn);
  btnRow.appendChild(cancelBtn);
  box.appendChild(btnRow);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

// ── Detail popup for Sets, Catalogs, and Instruction Sheets ──
function showRefItemPopup(type, idx) {
  var title = '', subtitle = '', details = [];
  if (type === 'set') {
    var s = (window._browseFilteredSets || [])[idx];
    if (!s) return;
    title = 'Set ' + s.setNum;
    subtitle = s.setName || '';
    // Check ownership from My Sets data
    var _mySet = Object.values(state.mySetsData || {}).find(ms => ms.setNum === s.setNum && (!ms.year || ms.year === s.year));
    details = [
      ['Year', s.year || '—'],
      ['Gauge', s.gauge || '—'],
      ['Price', s.price || '—'],
      ['Items', s.items.join(', ') || '—'],
    ];
    if (_mySet) {
      if (_mySet.condition) details.push(['Condition', _mySet.condition + '/10']);
      if (_mySet.estWorth) details.push(['Est. Worth', '$' + parseFloat(_mySet.estWorth).toLocaleString()]);
      if (_mySet.hasSetBox === 'Yes') details.push(['Set Box', '✓ Yes' + (_mySet.boxCondition ? ' (' + _mySet.boxCondition + '/10)' : '')]);
      if (_mySet.notes) details.push(['Notes', _mySet.notes]);
    }
  } else if (type === 'catalog') {
    var c = (window._browseFilteredCats || [])[idx];
    if (!c) return;
    title = c.id;
    subtitle = c.title || '';
    details = [
      ['Year', c.year || '—'],
      ['Type', c.type || '—'],
      ['Has Mailer', c.hasMailer || '—'],
    ];
  } else if (type === 'is') {
    var s2 = (window._browseFilteredIS || [])[idx];
    if (!s2) return;
    title = s2.id;
    subtitle = s2.description || '';
    details = [
      ['Item #', s2.itemNumber || '—'],
      ['Category', s2.category || '—'],
      ['Variations', s2.variations || '—'],
    ];
  } else return;

  var existing = document.getElementById('browse-add-prompt');
  if (existing) existing.remove();
  var overlay = document.createElement('div');
  overlay.id = 'browse-add-prompt';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1.5rem';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
  var box = document.createElement('div');
  box.style.cssText = 'background:var(--surface);border:1px solid rgba(232,64,28,0.4);border-radius:16px;max-width:480px;width:100%;padding:1.75rem;position:relative;max-height:80vh;overflow-y:auto';
  // Header
  var hdr = document.createElement('div');
  hdr.style.cssText = 'font-family:var(--font-head);font-size:1.05rem;color:var(--accent);margin-bottom:0.25rem';
  hdr.textContent = title;
  box.appendChild(hdr);
  if (subtitle) {
    var sub = document.createElement('div');
    sub.style.cssText = 'font-size:0.88rem;color:var(--text-mid);margin-bottom:1rem';
    sub.textContent = subtitle;
    box.appendChild(sub);
  }
  // Detail rows
  details.forEach(function(r) {
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;padding:0.35rem 0;border-bottom:1px solid var(--border)';
    var lbl = document.createElement('div');
    lbl.style.cssText = 'width:100px;font-size:0.78rem;color:var(--text-dim);font-weight:600;flex-shrink:0';
    lbl.textContent = r[0];
    var val = document.createElement('div');
    val.style.cssText = 'font-size:0.82rem;color:var(--text);word-break:break-word';
    val.textContent = r[1];
    row.appendChild(lbl);
    row.appendChild(val);
    box.appendChild(row);
  });
  // Close button
  var closeBtn = document.createElement('button');
  closeBtn.style.cssText = 'position:absolute;top:0.75rem;right:0.75rem;background:none;border:none;color:var(--text-dim);font-size:1.1rem;cursor:pointer';
  closeBtn.textContent = '✕';
  closeBtn.onclick = function() { overlay.remove(); };
  box.appendChild(closeBtn);
  // Add to Collection button
  var addBtn = document.createElement('button');
  addBtn.className = 'btn btn-primary';
  addBtn.style.cssText = 'margin-top:1.25rem;width:100%;background:var(--accent);border-color:var(--accent);line-height:1.25';
  addBtn.innerHTML = '<span style="display:block;font-size:0.75em;opacity:0.85;font-weight:400;letter-spacing:0.03em">Add to</span><span style="display:block">Collection</span>';
  var _itemNum = '', _itemType = '', _description = '', _year = '', _setOwned = false;
  if (type === 'set') {
    var _s = (window._browseFilteredSets || [])[idx];
    if (_s) { _itemNum = _s.setNum; _itemType = 'Set'; _description = _s.setName || ''; _year = _s.year || ''; }
    _setOwned = !!Object.values(state.mySetsData || {}).find(ms => ms.setNum === _itemNum && (!ms.year || ms.year === _year));
    if (_setOwned) {
      addBtn.style.cssText = 'margin-top:1.25rem;width:100%;background:#27ae6022;border:1.5px solid #27ae60;border-radius:10px;padding:0.75rem;line-height:1.25;color:#27ae60;font-family:var(--font-body);font-size:0.92rem;font-weight:700;cursor:default';
      addBtn.innerHTML = '✓ In Your Collection';
    }
  } else if (type === 'catalog') {
    var _c = (window._browseFilteredCats || [])[idx];
    if (_c) { _itemNum = _c.id; _itemType = 'Catalog'; _description = _c.title || ''; _year = _c.year || ''; }
  } else if (type === 'is') {
    var _is = (window._browseFilteredIS || [])[idx];
    if (_is) { _itemNum = _is.itemNumber || _is.id; _itemType = 'Instruction Sheet'; _description = _is.description || ''; }
  }
  addBtn.onclick = function() {
    overlay.remove();
    // Sets get their own wizard flow
    if (type === 'set') {
      if (_setOwned) return;  // Already owned — button is just a badge
      addSetToCollection(_itemNum, _description);
      return;
    }
    // Catalogs → catalog wizard flow
    if (type === 'catalog') {
      _buildWizardModal();
      var _c2 = (window._browseFilteredCats || [])[idx];
      wizard = {
        step: 0, tab: 'catalogs',
        data: { tab: 'catalogs', itemCategory: 'catalogs',
          cat_type: _c2 ? (_c2.type || '') : '',
          cat_year: _c2 ? (_c2.year || '') : '',
          cat_hasMailer: _c2 ? (_c2.hasMailer || 'No') : 'No',
        },
        steps: getSteps('catalogs'),
        matchedItem: null
      };
      document.getElementById('wizard-modal').classList.add('open');
      document.body.style.overflow = 'hidden';
      // Skip past already-filled steps (type, year, hasMailer)
      var _catAutoSkip = new Set(['cat_type','cat_year','cat_hasMailer']);
      while (wizard.step < wizard.steps.length - 1) {
        var _cs = wizard.steps[wizard.step];
        if (_catAutoSkip.has(_cs.id) && wizard.data[_cs.id]) {
          wizard.step++;
        } else break;
      }
      renderWizardStep();
      return;
    }
    // Instruction Sheets → IS wizard flow
    if (type === 'is') {
      _buildWizardModal();
      var _is2 = (window._browseFilteredIS || [])[idx];
      wizard = {
        step: 0, tab: 'instrsheet',
        data: { tab: 'instrsheet',
          is_sheetNum: _is2 ? (_is2.id || '') : '',
          is_linkedItem: _is2 ? (_is2.itemNumber || '') : '',
        },
        steps: getSteps('instrsheet'),
        matchedItem: null
      };
      document.getElementById('wizard-modal').classList.add('open');
      document.body.style.overflow = 'hidden';
      // Skip past already-filled steps
      var _isAutoSkip = new Set(['is_sheetNum','is_linkedItem']);
      while (wizard.step < wizard.steps.length - 1) {
        var _iss = wizard.steps[wizard.step];
        if (_isAutoSkip.has(_iss.id) && wizard.data[_iss.id]) {
          wizard.step++;
        } else break;
      }
      renderWizardStep();
      return;
    }
    // Try to find in masterData first (regular items)
    var masterIdx = state.masterData.findIndex(function(m) { return m.itemNum === _itemNum; });
    if (masterIdx >= 0) {
      addFromBrowse(masterIdx);
    } else {
      // Pre-fill the wizard with what we know
      _buildWizardModal();
      wizard = {
        step: 0, tab: 'collection',
        data: { tab: 'collection', itemNum: _itemNum, variation: '', itemCategory: 'lionel' },
        steps: getSteps('collection'),
        matchedItem: { itemNum: _itemNum, itemType: _itemType, description: _description, yearProd: _year, roadName: '', variation: '' }
      };
      document.getElementById('wizard-modal').classList.add('open');
      document.body.style.overflow = 'hidden';
      var _baseNum2 = (_itemNum || '').replace(/-(P|D)$/i, '');
      var _hasGrouping2 = getMatchingTenders(_baseNum2).length > 0 || isF3AlcoUnit(_baseNum2);
      var autoSkip = new Set(['tab', 'itemNum', 'variation', 'itemPicker', 'itemCategory', 'entryMode']);
      if (!_hasGrouping2) autoSkip.add('itemNumGrouping');
      while (wizard.step < wizard.steps.length - 1) {
        var ws = wizard.steps[wizard.step];
        if (autoSkip.has(ws.id) || (ws.skipIf && ws.skipIf(wizard.data))) {
          wizard.step++;
        } else break;
      }
      renderWizardStep();
    }
  };
  box.appendChild(addBtn);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function addFromBrowse(idx) {
  const item = state.masterData[idx];
  if (!item) return;
  _buildWizardModal();
  // Open the collection wizard with itemNum + variation pre-filled
  wizard = { step: 0, tab: 'collection', data: { tab: 'collection', itemNum: item.itemNum, variation: item.variation || '', itemCategory: 'lionel' }, steps: getSteps('collection'), matchedItem: item };
  document.getElementById('wizard-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
  // Skip all steps before condition — item number, variation, and entry mode are already known
  // But DON'T skip itemNumGrouping if item has grouping options (engine+tender, diesel AA/AB)
  const _baseNum = (item.itemNum || '').replace(/-(P|D)$/i, '');
  const _hasGrouping = getMatchingTenders(_baseNum).length > 0 || isF3AlcoUnit(_baseNum);
  const autoSkip = new Set(['tab', 'itemNum', 'variation', 'itemPicker', 'itemCategory', 'entryMode']);
  if (!_hasGrouping) autoSkip.add('itemNumGrouping');
  while (wizard.step < wizard.steps.length - 1) {
    const s = wizard.steps[wizard.step];
    if (autoSkip.has(s.id) || (s.skipIf && s.skipIf(wizard.data))) {
      wizard.step++;
    } else {
      break;
    }
  }
  renderWizardStep();
}

// ── ITEM MODAL ──────────────────────────────────────────────────
function _buildItemModal() {
  if (document.getElementById('item-modal')) return;
  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'item-modal';
  overlay.onclick = function(e) { if (e.target === overlay) closeModal(); };
  overlay.innerHTML =
    '<div class="modal">' +
      '<div class="modal-header">' +
        '<div>' +
          '<div class="modal-item-num" id="modal-item-num"></div>' +
          '<div class="modal-title" id="modal-title"></div>' +
          '<div class="modal-subtitle" id="modal-subtitle"></div>' +
        '</div>' +
        '<button class="btn-close" onclick="closeModal()">&#x2715;</button>' +
      '</div>' +
      '<div class="modal-body">' +
        '<div id="box-only-prompt" style="display:none;background:rgba(201,146,42,0.1);border:1px solid var(--accent2);border-radius:10px;padding:0.85rem 1rem;align-items:center;justify-content:space-between;gap:1rem">' +
          '<div>' +
            '<div style="font-weight:600;font-size:0.875rem;color:var(--accent2)">&#x1F4E6; Box without item info</div>' +
            '<div style="font-size:0.8rem;color:var(--text-mid);margin-top:0.2rem">This entry has a box but no item details. Want to add the item info?</div>' +
          '</div>' +
          '<button onclick="fillItemFromBoxRow()" class="btn btn-primary" style="font-size:0.88rem;padding:0.6rem 1rem;white-space:nowrap">Add Item Info</button>' +
        '</div>' +
        '<div>' +
          '<div class="section-title" style="margin-bottom:0.75rem">Reference Information</div>' +
          '<div class="info-grid">' +
            '<div class="info-field"><label>Item Type</label><div class="info-val" id="mi-type"></div></div>' +
            '<div class="info-field"><label>Year Produced</label><div class="info-val" id="mi-year"></div></div>' +
            '<div class="info-field"><label>Road Name</label><div class="info-val" id="mi-road"></div></div>' +
            '<div class="info-field" id="mi-control-wrap"><label>Control</label><div class="info-val" id="mi-control"></div></div>' +
            '<div class="info-field" id="mi-gauge-wrap"><label>Gauge</label><div class="info-val" id="mi-gauge"></div></div>' +
            '<div class="info-field"><label>Variation</label><div class="info-val" id="mi-var"></div></div>' +
            '<div class="info-field"><label>Est. Market Value</label><div class="info-val market-val" id="mi-market"></div></div>' +
            '<div class="info-field"><label>COTT Reference</label><div class="info-val" id="mi-ref"></div></div>' +
          '</div>' +
          '<div id="mi-desc-wrap" style="margin-top:0.75rem"><div class="desc-block" id="mi-desc"></div></div>' +
          '<div id="mi-varDesc-wrap" style="margin-top:0.5rem;display:none">' +
            '<div style="font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-dim);margin-bottom:0.3rem">Variation Notes</div>' +
            '<div class="desc-block" id="mi-varDesc"></div>' +
          '</div>' +
        '</div>' +
        '<div>' +
          '<div class="form-section-title" style="margin-bottom:0.75rem">Your Collection Data</div>' +
          '<div style="margin-bottom:0.85rem">' +
            '<label style="font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-dim);display:block;margin-bottom:0.4rem">Status</label>' +
            '<div style="display:flex;gap:0.5rem">' +
              '<button class="status-btn" id="status-want" onclick="setStatus(\'Want\')" style="flex:1;padding:0.5rem;border-radius:7px;border:1px solid var(--border);background:var(--surface2);color:var(--text-mid);cursor:pointer;font-family:var(--font-body);font-size:0.85rem;transition:all 0.15s">Want</button>' +
              '<button class="status-btn" id="status-owned" onclick="setStatus(\'Owned\')" style="flex:1;padding:0.5rem;border-radius:7px;border:1px solid var(--border);background:var(--surface2);color:var(--text-mid);cursor:pointer;font-family:var(--font-body);font-size:0.85rem;transition:all 0.15s">Owned</button>' +
              '<button class="status-btn" id="status-forsale" onclick="setStatus(\'ForSale\')" style="flex:1;padding:0.5rem;border-radius:7px;border:1px solid var(--border);background:var(--surface2);color:var(--text-mid);cursor:pointer;font-family:var(--font-body);font-size:0.85rem;transition:all 0.15s">For Sale</button>' +
              '<button class="status-btn" id="status-sold" onclick="setStatus(\'Sold\')" style="flex:1;padding:0.5rem;border-radius:7px;border:1px solid var(--border);background:var(--surface2);color:var(--text-mid);cursor:pointer;font-family:var(--font-body);font-size:0.85rem;transition:all 0.15s">Sold</button>' +
            '</div>' +
          '</div>' +
          '<div id="sold-fields" style="display:none;margin-bottom:0.75rem">' +
            '<div class="price-row">' +
              '<div class="form-field"><label>Sale Price ($)</label><input type="number" id="fc-sale-price" placeholder="0.00" min="0" step="0.01"></div>' +
              '<div class="form-field"><label>Date Sold</label><input type="date" id="fc-date-sold"></div>' +
            '</div>' +
          '</div>' +
          '<div id="forsale-fields" style="display:none;margin-bottom:0.75rem">' +
            '<div class="price-row">' +
              '<div class="form-field"><label>Asking Price ($)</label><input type="number" id="fc-asking-price" placeholder="0.00" min="0" step="0.01"></div>' +
              '<div class="form-field"><label>Date Listed</label><input type="date" id="fc-date-listed"></div>' +
            '</div>' +
          '</div>' +
          '<div id="want-fields" style="display:none;margin-bottom:0.75rem">' +
            '<div class="form-grid">' +
              '<div class="form-field"><label>Priority</label><select id="fc-want-priority"><option value="High">High</option><option value="Medium" selected>Medium</option><option value="Low">Low</option></select></div>' +
              '<div class="form-field"><label>Expected Price ($)</label><input type="number" id="fc-want-price" placeholder="0.00" min="0" step="0.01"></div>' +
            '</div>' +
            '<div class="form-field full" style="margin-top:0.5rem"><label>Notes</label><input type="text" id="fc-want-notes" placeholder="Why you want it, where to find it\u2026"></div>' +
          '</div>' +
          '<div id="collection-form" style="display:none">' +
            '<div class="form-grid">' +
              '<div class="form-field"><label>Copy #</label><select id="fc-copy"><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option></select></div>' +
              '<div class="form-field"><label>All Original?</label><select id="fc-original"><option value="Yes">Yes</option><option value="No">No</option><option value="Unknown">Unknown</option></select></div>' +
            '</div>' +
            '<div class="form-field" style="margin-top:0.75rem">' +
              '<label>Condition (1\u201310)</label>' +
              '<div class="condition-display">' +
                '<div class="condition-num" id="cond-display">7</div>' +
                '<input type="range" min="1" max="10" value="7" id="fc-condition" oninput="document.getElementById(\'cond-display\').textContent=this.value">' +
              '</div>' +
            '</div>' +
            '<div class="price-row" style="margin-top:0.75rem">' +
              '<div class="form-field"><label>Item Only Price ($)</label><input type="number" id="fc-price-item" placeholder="0.00" min="0" step="0.01"></div>' +
              '<div class="form-field"><label>Box Only Price ($)</label><input type="number" id="fc-price-box" placeholder="0.00" min="0" step="0.01"></div>' +
              '<div class="form-field"><label>Item+Box Complete ($)</label><input type="number" id="fc-price-complete" placeholder="0.00" min="0" step="0.01"></div>' +
            '</div>' +
            '<div class="form-grid" style="margin-top:0.75rem">' +
              '<div class="form-field"><label>Has Box?</label><select id="fc-has-box"><option value="Yes">Yes</option><option value="No">No</option></select></div>' +
              '<div class="form-field"><label>Box Condition (1\u201310)</label><input type="number" id="fc-box-cond" min="1" max="10" placeholder="\u2014"></div>' +
            '</div>' +
            '<div class="form-field full" style="margin-top:0.75rem"><label>Item Photo Link (Google Photos)</label><input type="url" id="fc-photo-item" placeholder="https://photos.google.com/\u2026"></div>' +
            '<div class="form-field full" style="margin-top:0.5rem"><label>Box Photo Link (Google Photos)</label><input type="url" id="fc-photo-box" placeholder="https://photos.google.com/\u2026"></div>' +
            '<div class="form-field full" style="margin-top:0.5rem"><label>Notes</label><textarea id="fc-notes" placeholder="Any personal notes about this item\u2026"></textarea></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
        '<button class="btn btn-primary" onclick="saveItem()">Save to Collection</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);
}

function openItem(idx) {
  _buildItemModal();
  const item = state.masterData[idx];
  state.currentItem = { item, idx };
  // Find personal data by value scan (key-format-agnostic)
  const pdKey = findPDKey(item.itemNum, item.variation);
  const pd = pdKey ? state.personalData[pdKey] : {};

  const _errPd = findPD(item.itemNum, item.variation);
  const _errSuffix = _errPd && _errPd.isError === 'Yes' ? ' ⚠ Error' : '';
  document.getElementById('modal-item-num').textContent = `No. ${item.itemNum}${item.variation ? ' — Variation ' + item.variation : ''}${_errSuffix}`;
  document.getElementById('modal-title').textContent = item.roadName || item.itemType || item.description.substring(0, 60);
  const modalMatchedTo = pd?.matchedTo || '';
  const modalIsTender = isTender(item.itemNum);
  document.getElementById('modal-subtitle').textContent = `${item.itemType}${item.subType ? ' — ' + item.subType : ''}${item.yearProd ? ' · ' + item.yearProd : ''}`;
  // Set ID badge
  const setIdBadgeEl = document.getElementById('modal-set-badge');
  if (setIdBadgeEl) {
    if (pd?.setId) {
      setIdBadgeEl.style.display = 'inline-flex';
      // Find all other items in this set
      const setMates = Object.values(state.personalData)
        .filter(p => p.setId === pd.setId && p.itemNum !== item.itemNum)
        .map(p => p.itemNum);
      setIdBadgeEl.textContent = '🔗 Set: ' + pd.setId + (setMates.length ? ' (with ' + setMates.join(', ') + ')' : '');
    } else {
      setIdBadgeEl.style.display = 'none';
    }
  }

  const matchedBadgeEl = document.getElementById('modal-matched-badge');
  if (matchedBadgeEl) {
    if (modalMatchedTo) {
      matchedBadgeEl.style.display = 'inline-flex';
      matchedBadgeEl.innerHTML = `${modalIsTender ? '🚂' : '🚃'} Matched ${modalIsTender ? 'Engine' : 'Tender'}: <strong style="margin-left:0.3rem">${modalMatchedTo}</strong>`;
    } else {
      matchedBadgeEl.style.display = 'none';
    }
  }
  document.getElementById('mi-type').textContent = item.itemType || '—';
  document.getElementById('mi-year').textContent = item.yearProd || '—';
  document.getElementById('mi-road').textContent = item.roadName || '—';
  if (item.control) { document.getElementById('mi-control').textContent = item.control; document.getElementById('mi-control-wrap').style.display = ''; }
  else { document.getElementById('mi-control-wrap').style.display = 'none'; }
  if (item.gauge) { document.getElementById('mi-gauge').textContent = item.gauge; document.getElementById('mi-gauge-wrap').style.display = ''; }
  else { document.getElementById('mi-gauge-wrap').style.display = 'none'; }
  document.getElementById('mi-var').textContent = item.variation || '(no variation)';
  document.getElementById('mi-market').textContent = item.marketVal ? '$' + parseFloat(item.marketVal).toLocaleString() : '—';
  document.getElementById('mi-ref').innerHTML = item.refLink ? `<a href="${item.refLink}" target="_blank">View on COTT ↗</a>` : '—';
  document.getElementById('mi-desc').textContent = item.description || 'No description available.';
  const vd = document.getElementById('mi-varDesc-wrap');
  if (item.varDesc) { document.getElementById('mi-varDesc').textContent = item.varDesc; vd.style.display = 'block'; }
  else { vd.style.display = 'none'; }

  // Personal data - check owned, for sale, sold, and want
  const sd = state.soldData[key] || {};
  const fs = state.forSaleData[key] || {};
  const wd = state.wantData[key] || {};
  const itemStatus = pd.owned ? 'Owned' : fs.itemNum ? 'ForSale' : sd.itemNum ? 'Sold' : wd.itemNum ? 'Want' : '';
  currentStatus = itemStatus || '';
  setStatus(itemStatus || 'Want');
  document.getElementById('fc-sale-price').value = sd.salePrice || '';
  document.getElementById('fc-date-sold').value = sd.dateSold || '';
  document.getElementById('fc-asking-price').value = fs.askingPrice || '';
  document.getElementById('fc-date-listed').value = fs.dateListed || '';
  document.getElementById('fc-want-priority').value = wd.priority || 'Medium';
  document.getElementById('fc-want-price').value = wd.expectedPrice || '';
  document.getElementById('fc-want-notes').value = wd.notes || '';

  // copy field removed
  document.getElementById('fc-original').value = pd.allOriginal || 'Unknown';
  const cond = pd.condition || 7;
  document.getElementById('fc-condition').value = cond;
  document.getElementById('cond-display').textContent = cond;
  const toNum = v => (v && !isNaN(parseFloat(v))) ? v : '';
  document.getElementById('fc-price-item').value = toNum(pd.priceItem);
  document.getElementById('fc-price-box').value = toNum(pd.priceBox);
  document.getElementById('fc-price-complete').value = toNum(pd.priceComplete);
  document.getElementById('fc-has-box').value = ['Yes','No'].includes(pd.hasBox) ? pd.hasBox : 'No';
  document.getElementById('fc-box-cond').value = toNum(pd.boxCond);
  document.getElementById('fc-photo-item').value = pd.photoItem || '';
  document.getElementById('fc-photo-box').value = pd.photoBox || '';
  document.getElementById('fc-notes').value = pd.notes || '';

  // Show box-only prompt if row has box but no item info
  const isBoxOnly = pd.owned && pd.hasBox === 'Yes' && 
    (!pd.condition || pd.condition === 'N/A') && 
    (!pd.priceItem || pd.priceItem === 'N/A');
  const prompt = document.getElementById('box-only-prompt');
  if (prompt) prompt.style.display = isBoxOnly ? 'flex' : 'none';

  document.getElementById('item-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function fillItemFromBoxRow() {
  if (!state.currentItem) return;
  const { item } = state.currentItem;
  closeModal();
  // Start wizard in collection mode, pre-filled with item number, skip to item-info steps
  wizard = {
    step: 0,
    tab: 'collection',
    data: {
      tab: 'collection',
      itemNum: item.itemNum,
      variation: item.variation || '',
      boxOnly: false,
      _fillItemMode: true, // flag so we can pre-set item number
    },
    steps: getSteps('collection'),
    matchedItem: findMaster(item.itemNum) || null,
  };
  // Advance past tab and itemNum steps since we already know them
  wizard.step = 2; // start at condition step
  document.getElementById('wizard-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
  renderWizardStep();
}

function closeModal() {
  document.getElementById('item-modal').classList.remove('open');
  document.body.style.overflow = '';
  state.currentItem = null;
}

function closeModalOnOverlay(e) { if (e.target === document.getElementById('item-modal')) closeModal(); }

let currentStatus = 'Want';

function setStatus(status) {
  currentStatus = status;
  // Update button styles
  ['Want','Owned','ForSale','Sold'].forEach(s => {
    const btn = document.getElementById('status-' + s.toLowerCase());
    if (!btn) return;
    if (s === status) {
      const colors = { Want: 'var(--accent2)', Owned: 'var(--green)', ForSale: '#e67e22', Sold: '#9b59b6' };
      btn.style.background = colors[s] + '22';
      btn.style.borderColor = colors[s];
      btn.style.color = colors[s];
    } else {
      btn.style.background = 'var(--surface2)';
      btn.style.borderColor = 'var(--border)';
      btn.style.color = 'var(--text-mid)';
    }
  });
  document.getElementById('collection-form').style.display = (status === 'Owned' || status === 'Sold' || status === 'ForSale') ? 'block' : 'none';
  const soldFields = document.getElementById('sold-fields');
  if (soldFields) soldFields.style.display = status === 'Sold' ? 'block' : 'none';
  const forsaleFields = document.getElementById('forsale-fields');
  if (forsaleFields) forsaleFields.style.display = status === 'ForSale' ? 'block' : 'none';
  const wantFields = document.getElementById('want-fields');
  if (wantFields) wantFields.style.display = status === 'Want' ? 'block' : 'none';
}

async function saveItem() {
  if (!state.currentItem) return;
  const { item } = state.currentItem;
  const key = `${item.itemNum}|${item.variation}`;

  const copy = document.getElementById('fc-copy').value;
  const condition = document.getElementById('fc-condition').value;

  if (currentStatus === 'Owned') {
    // Write/update in My Collection tab
    const _ex = state.personalData[key] || {};
    const ownedRow = [
      item.itemNum, item.variation || '', copy, condition,
      document.getElementById('fc-original').value,
      document.getElementById('fc-price-item').value,
      document.getElementById('fc-price-box').value,
      document.getElementById('fc-price-complete').value,
      document.getElementById('fc-has-box').value,
      document.getElementById('fc-box-cond').value,
      document.getElementById('fc-photo-item').value,
      document.getElementById('fc-photo-box').value,
      document.getElementById('fc-notes').value,
      _ex.datePurchased || '', _ex.userEstWorth || '',
      _ex.matchedTo || '', _ex.setId || '', _ex.yearMade || '',
      _ex.isError || '', _ex.errorDesc || '',
      _ex.quickEntry ? 'Yes' : '',  // preserve Quick Entry flag
      _ex.inventoryId || nextInventoryId(),  // auto-assign if new
      _ex.groupId || '',
      _ex.location || '',  // Location (col W)
      _ex.era || '',        // Era (col X)
      _ex.manufacturer || '', // Manufacturer (col Y)
    ];
    const existing = state.personalData[key];
    if (existing && existing.row) {
      await sheetsUpdate(state.personalSheetId, `My Collection!A${existing.row}:Y${existing.row}`, [ownedRow]);
    } else {
      await sheetsAppend(state.personalSheetId, 'My Collection!A:A', [ownedRow]);
    }
    // Remove from Sold tab if it was there
    const soldEntry = state.soldData[key];
    if (soldEntry && soldEntry.row) {
      await sheetsUpdate(state.personalSheetId, `Sold!A${soldEntry.row}:J${soldEntry.row}`, [['','','','','','','','','','']]);
    }
    // Remove from Want List if it was there
    const wantEntry = state.wantData[key];
    if (wantEntry && wantEntry.row) {
      await sheetsUpdate(state.personalSheetId, `Want List!A${wantEntry.row}:F${wantEntry.row}`, [['','','','','','']]);
    }
    // Remove from For Sale if it was there
    const fsEntry = state.forSaleData[key];
    if (fsEntry && fsEntry.row) {
      await sheetsUpdate(state.personalSheetId, `For Sale!A${fsEntry.row}:J${fsEntry.row}`, [['','','','','','','','','','']]);
    }

  } else if (currentStatus === 'ForSale') {
    // Write to For Sale tab (keep in collection too — it's still yours)
    const existing = state.personalData[key];
    const forSaleRow = [
      item.itemNum, item.variation || '',
      condition,
      document.getElementById('fc-asking-price').value,
      document.getElementById('fc-date-listed').value || new Date().toISOString().split('T')[0],
      document.getElementById('fc-notes').value,
      existing?.priceItem || '',
      existing?.userEstWorth || '',
      existing?.inventoryId || '',
      existing?.manufacturer || _getEraManufacturer(),
    ];
    const fsEntry2 = state.forSaleData[key];
    if (fsEntry2 && fsEntry2.row) {
      await sheetsUpdate(state.personalSheetId, `For Sale!A${fsEntry2.row}:J${fsEntry2.row}`, [forSaleRow]);
    } else {
      await sheetsAppend(state.personalSheetId, 'For Sale!A:A', [forSaleRow]);
    }
    // Remove from Sold if it was there
    const soldEntry2 = state.soldData[key];
    if (soldEntry2 && soldEntry2.row) {
      await sheetsUpdate(state.personalSheetId, `Sold!A${soldEntry2.row}:J${soldEntry2.row}`, [['','','','','','','','','','']]);
    }
    // Remove from Want if it was there
    const wantEntry2 = state.wantData[key];
    if (wantEntry2 && wantEntry2.row) {
      await sheetsUpdate(state.personalSheetId, `Want List!A${wantEntry2.row}:F${wantEntry2.row}`, [['','','','','','']]);
    }

  } else if (currentStatus === 'Sold') {
    // Remove from My Collection
    const existing = state.personalData[key];
    if (existing && existing.row) {
      await sheetsUpdate(state.personalSheetId, `My Collection!A${existing.row}:Y${existing.row}`, [['','','','','','','','','','','','','','','','','','','','','','','','','']]);  // 25 cols A-Y
    }
    // Remove from For Sale if it was there
    const fsEntry3 = state.forSaleData[key];
    if (fsEntry3 && fsEntry3.row) {
      await sheetsUpdate(state.personalSheetId, `For Sale!A${fsEntry3.row}:J${fsEntry3.row}`, [['','','','','','','','','','']]);
    }
    // Write to Sold tab
    const soldRow = [
      item.itemNum, item.variation || '', copy, condition,
      existing?.priceItem || document.getElementById('fc-price-item').value,
      document.getElementById('fc-sale-price').value,
      document.getElementById('fc-date-sold').value,
      document.getElementById('fc-notes').value,
      existing?.inventoryId || '',
      existing?.manufacturer || _getEraManufacturer(),
    ];
    const soldEntry = state.soldData[key];
    if (soldEntry && soldEntry.row) {
      await sheetsUpdate(state.personalSheetId, `Sold!A${soldEntry.row}:J${soldEntry.row}`, [soldRow]);
    } else {
      await sheetsAppend(state.personalSheetId, 'Sold!A:J', [soldRow]);
    }

  } else if (currentStatus === 'Want') {
    // Remove from My Collection if present
    const existing = state.personalData[key];
    if (existing && existing.row) {
      await sheetsUpdate(state.personalSheetId, `My Collection!A${existing.row}:Y${existing.row}`, [['','','','','','','','','','','','','','','','','','','','','','','','','']]);  // 25 cols A-Y
    }
    // Write/update Want List tab
    const wantRow = [
      item.itemNum,
      item.variation || '',
      document.getElementById('fc-want-priority').value,
      document.getElementById('fc-want-price').value,
      document.getElementById('fc-want-notes').value,
      _getEraManufacturer(),
    ];
    const wantEntry = state.wantData[key];
    if (wantEntry && wantEntry.row) {
      await sheetsUpdate(state.personalSheetId, `Want List!A${wantEntry.row}:F${wantEntry.row}`, [wantRow]);
    } else {
      await sheetsAppend(state.personalSheetId, 'Want List!A:A', [wantRow]);
    }
    // Store info for partner prompt — shown after modal closes
    window._pendingWantPartner = {
      itemNum: item.itemNum,
      variation: item.variation || '',
      priority: wantRow[2],
      maxPrice: wantRow[3],
      notes: wantRow[4],
    };
  } else {
    window._pendingWantPartner = null;
  }

  // Bust cache then background sync — don't block the UI
  localStorage.removeItem('lv_personal_cache');
  localStorage.removeItem('lv_personal_cache_ts');

  closeModal();
  buildDashboard();
  buildSoldPage();
  buildForSalePage();
  renderBrowse();
  showToast('✓ Item updated!');

  // Show groupable partner prompt if applicable
  if (window._pendingWantPartner) {
    const _pwp = window._pendingWantPartner;
    window._pendingWantPartner = null;
    setTimeout(() => _checkWantPartners(_pwp.itemNum, _pwp.variation, _pwp.priority, _pwp.maxPrice, _pwp.notes), 400);
  }

  // Background sync after a delay to give Sheets time to propagate
  const _syncDelay = typeof _isTouchDevice !== 'undefined' && _isTouchDevice ? 3000 : 1500;
  setTimeout(async function() {
    try {
      await loadPersonalData();
      buildDashboard();
      renderBrowse();
    } catch(e) { console.warn('Background sync after saveItem:', e); }
  }, _syncDelay);
}

// ── WANT LIST PARTNER PROMPT ─────────────────────────────────────
// Shown after saving a groupable item to Want List
function _checkWantPartners(itemNum, variation, priority, maxPrice, notes) {
  const num = normalizeItemNum(itemNum);
  const isLoco   = isLocomotive(num);
  const isTnd    = isTender(num);
  const bUnit    = getBUnit(num);          // diesel A-unit: returns "XXXC" or null
  const aUnit    = getAUnit(num);          // diesel B-unit: returns "XXX" or null

  // Build list of candidates (skip any already on Want List)
  let candidates = []; // [{ itemNum, label }]

  if (isLoco) {
    const tenders = getMatchingTenders(num);
    tenders.forEach(t => {
      if (!state.wantData[t + '|']) candidates.push({ itemNum: t, label: t + ' (tender)' });
    });
  } else if (isTnd) {
    const locos = getMatchingLocos(num);
    locos.forEach(l => {
      if (!state.wantData[l + '|']) candidates.push({ itemNum: l, label: l + ' (locomotive)' });
    });
  } else if (bUnit) {
    if (!state.wantData[bUnit + '|']) candidates.push({ itemNum: bUnit, label: bUnit + ' (B unit)' });
  } else if (aUnit) {
    if (!state.wantData[aUnit + '|']) candidates.push({ itemNum: aUnit, label: aUnit + ' (A unit)' });
  }

  if (!candidates.length) return; // Nothing to offer

  // Build modal
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9200;display:flex;align-items:center;justify-content:center;padding:1rem';

  const isLocoOrTender = isLoco || isTnd;
  const promptText = isLoco
    ? 'This locomotive has matching tenders. Add any to your Want List?'
    : isTnd
      ? 'This tender fits these locomotives. Add any to your Want List?'
      : bUnit
        ? 'This is an A unit — do you also want the B unit?'
        : 'This is a B unit — do you also want the A unit?';

  const checkboxRows = candidates.map((c, i) => `
    <label style="display:flex;align-items:center;gap:0.6rem;padding:0.5rem 0.6rem;border-radius:7px;background:var(--surface2);cursor:pointer;margin-bottom:0.4rem">
      <input type="checkbox" id="wpc-${i}" checked style="width:16px;height:16px;accent-color:var(--accent);cursor:pointer">
      <span style="font-family:var(--font-mono);font-weight:600;color:var(--accent)">${c.itemNum}</span>
      <span style="font-size:0.78rem;color:var(--text-dim)">${c.label.replace(c.itemNum + ' ', '')}</span>
    </label>`).join('');

  overlay.innerHTML = `
    <div style="background:var(--surface);border:1.5px solid var(--accent3);border-radius:14px;padding:1.5rem;max-width:380px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,0.5)">
      <div style="font-size:0.72rem;font-weight:700;letter-spacing:0.1em;color:var(--accent3);text-transform:uppercase;margin-bottom:0.5rem">Add Partner(s) to Want List?</div>
      <div style="font-size:0.9rem;color:var(--text-mid);margin-bottom:1rem;line-height:1.4">${promptText}</div>
      <div style="margin-bottom:1rem">${checkboxRows}</div>
      <div style="display:flex;gap:0.5rem;justify-content:flex-end">
        <button id="wpc-skip" style="padding:0.45rem 1rem;border-radius:7px;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body);font-size:0.82rem;cursor:pointer">Skip</button>
        <button id="wpc-add" style="padding:0.45rem 1.1rem;border-radius:7px;border:none;background:var(--accent3);color:#fff;font-family:var(--font-body);font-size:0.82rem;font-weight:600;cursor:pointer">Add Selected</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  overlay.querySelector('#wpc-skip').onclick = () => overlay.remove();
  overlay.querySelector('#wpc-add').onclick = async () => {
    const selected = candidates.filter((c, i) => {
      const cb = overlay.querySelector('#wpc-' + i);
      return cb && cb.checked;
    });
    overlay.remove();
    if (!selected.length) return;
    let added = 0;
    for (const c of selected) {
      try {
        const row = [c.itemNum, '', priority || 'Medium', maxPrice || '', notes || '', _getEraManufacturer()];
        await sheetsAppend(state.personalSheetId, 'Want List!A:A', [row]);
        // Bugfix 2026-04-14: optimistically add partner to state.wantData so the
        // Want List table shows the new partners immediately instead of waiting
        // for the 1.2s refresh. Session 102 observed partners not appearing.
        const pKey = `${c.itemNum}|`;
        if (!state.wantData[pKey]) {
          state.wantData[pKey] = {
            row: 99999, // placeholder; overwritten on next sheet sync
            itemNum: c.itemNum,
            variation: '',
            priority: priority || 'Medium',
            expectedPrice: maxPrice || '',
            notes: notes || '',
          };
        }
        added++;
      } catch(e) { console.warn('[WantPartner] Failed to add', c.itemNum, e); }
    }
    if (added) {
      _cachePersonalData();
      showToast('✓ Added ' + added + ' partner' + (added > 1 ? 's' : '') + ' to Want List');
      // Render immediately with the optimistic state, then refresh from server
      try { buildWantPage(); } catch(e) {}
      try { buildDashboard(); } catch(e) {}
      setTimeout(async () => {
        await loadPersonalData();
        buildWantPage();
        buildDashboard();
      }, 1200);
    }
  };
}

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
  } else {
    if (sidebar) sidebar.classList.remove('sidebar-light');
    document.documentElement.dataset.theme = 'dark';
  }
}


function buildEphemeraPage() {
  // Rebuild tab buttons to include user-defined tabs
  const tabBar = document.getElementById('ephemera-tabs');
  if (tabBar) {
    const stdTabs = [
      { id:'catalogs', emoji:'📒', label:'Catalogs' },
      { id:'paper',    emoji:'📄', label:'Paper Items' },
      { id:'mockups',  emoji:'🔩', label:'Mock-Ups' },
      { id:'other',    emoji:'📦', label:'Other Lionel' },
    ];
    const allTabs = [...stdTabs, ...(state.userDefinedTabs||[]).map(t => ({ id:t.id, emoji:'⭐', label:t.label }))];
    tabBar.innerHTML = allTabs.map(t =>
      `<button class="eph-tab${_ephCurrentTab===t.id?' active':''}" data-eph="${t.id}" onclick="switchEphTab('${t.id}',this)">${t.emoji} ${t.label}</button>`
    ).join('');
  }
  switchEphTab(_ephCurrentTab, document.querySelector('.eph-tab.active'));
}

function switchEphTab(tabId, btn) {
  _ephCurrentTab = tabId;
  document.querySelectorAll('.eph-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  if (!state.ephemeraData[tabId]) state.ephemeraData[tabId] = {};
  const bucket = state.ephemeraData[tabId];
  const items = Object.values(bucket);
  const container = document.getElementById('ephemera-content');
  if (!container) return;
  const isMockup = tabId === 'mockups';

  if (items.length === 0) {
    const labels = { catalogs:'Catalogs', paper:'Paper Items', mockups:'Mock-Ups', other:'Other Lionel Items' };
    const emojis = { catalogs:'📒', paper:'📄', mockups:'🔩', other:'📦' };
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">${emojis[tabId]}</div><p>No ${labels[tabId]} yet — tap Add Item to get started</p></div>`;
    return;
  }

  container.innerHTML = items.sort((a,b) => (b.row||0)-(a.row||0)).map(item => {
    const val = item.estValue ? '$' + parseFloat(item.estValue).toLocaleString() : '';
    const cond = item.condition ? item.condition + '/10' : '';
    const isCatalog2 = tabId === 'catalogs';
    const subtitle = [
      isCatalog2 && item.catType ? item.catType : '',
      isCatalog2 && item.hasMailer === 'Yes' ? '✉ Has mailer' : '',
      isMockup && item.itemNumRef ? 'Ref: ' + item.itemNumRef : '',
      item.manufacturer && item.manufacturer !== 'Lionel' ? item.manufacturer : '',
      isMockup && item.productionStatus ? item.productionStatus : '',
      !isCatalog2 && item.quantity > 1 ? 'Qty: ' + item.quantity : '',
      cond,
    ].filter(Boolean).join(' · ');
    return `<div class="eph-row" onclick="openEphemeraDetail('${tabId}',${item.row})">
      <div style="font-size:1.4rem;width:28px;text-align:center;flex-shrink:0">${{catalogs:'📒',paper:'📄',mockups:'🔩',other:'📦'}[tabId]}</div>
      <div style="flex:1;min-width:0">
        <div class="eph-title">${item.title}</div>
        ${subtitle ? `<div style="font-size:0.72rem;color:var(--text-dim);margin-top:1px">${subtitle}</div>` : ''}
      </div>
      ${item.year ? `<span class="eph-year">${item.year}</span>` : ''}
      ${val ? `<span class="eph-val">${val}</span>` : ''}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
    </div>`;
  }).join('');
}

function openEphemeraDetail(tabId, rowKey) {
  const item = (state.ephemeraData[tabId] || {})[rowKey];
  if (!item) return;
  const isMockup = tabId === 'mockups';
  const labels = { catalogs:'Catalog', paper:'Paper Item', mockups:'Mock-Up', other:'Other Item' };

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };

  const isCatalog3 = tabId === 'catalogs';
  const fields = isCatalog3 ? [
    ['Item ID',           item.itemNum || '—'],
    ['Type',              item.catType || '—'],
    ['Year',              item.year || '—'],
    ['Has Envelope/Mailer', item.hasMailer || 'No'],
    ['Condition',         item.condition ? item.condition + '/10' : '—'],
    ['Est. Value',        item.estValue ? '$' + parseFloat(item.estValue).toLocaleString() : '—'],
    ['Date Acquired',     item.dateAcquired || '—'],
    ['Notes',             item.notes || '—'],
  ] : isMockup ? [
    ['Title', item.title],
    ['Item # Reference', item.itemNumRef],
    ['Description', item.description],
    ['Year', item.year],
    ['Manufacturer', item.manufacturer || 'Lionel'],
    ['Condition', item.condition ? item.condition + '/10' : '—'],
    ['Production Status', item.productionStatus || '—'],
    ['Material', item.material || '—'],
    ['Dimensions', item.dimensions || '—'],
    ['Provenance', item.provenance || '—'],
    ['Lionel Verified', item.lionelVerified || '—'],
    ['Est. Value', item.estValue ? '$' + parseFloat(item.estValue).toLocaleString() : '—'],
    ['Date Acquired', item.dateAcquired || '—'],
    ['Notes', item.notes || '—'],
  ] : [
    ['Title', item.title],
    ['Description', item.description || '—'],
    ['Year', item.year || '—'],
    ['Manufacturer', item.manufacturer || 'Lionel'],
    ['Condition', item.condition ? item.condition + '/10' : '—'],
    ['Quantity', item.quantity || '1'],
    ['Est. Value', item.estValue ? '$' + parseFloat(item.estValue).toLocaleString() : '—'],
    ['Date Acquired', item.dateAcquired || '—'],
    ['Notes', item.notes || '—'],
  ];

  overlay.innerHTML = `
    <div class="modal" style="max-width:480px;max-height:85vh;overflow-y:auto">
      <div class="modal-header" style="background:var(--surface2);border-bottom:1px solid var(--border);padding:1rem 1.25rem;display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:0.65rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-dim);margin-bottom:0.2rem">${labels[tabId]}</div>
          <div style="font-weight:600;font-size:1rem">${item.title}</div>
        </div>
        <button onclick="this.closest('.modal-overlay').remove()" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:1.4rem;line-height:1">✕</button>
      </div>
      <div style="padding:1rem 1.25rem">
        ${fields.map(([label, val]) => val && val !== '—' ? `
          <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:0.45rem 0;border-bottom:1px solid var(--border)">
            <span style="font-size:0.78rem;color:var(--text-dim);flex-shrink:0;padding-right:1rem">${label}</span>
            <span style="font-size:0.85rem;color:var(--text);text-align:right">${val}</span>
          </div>` : '').join('')}
        ${item.photoLink ? `<div style="margin-top:1rem"><a href="${item.photoLink}" target="_blank" style="color:#2980b9;font-size:0.82rem">📁 View Photos ↗</a></div>` : ''}
      </div>
      <div style="padding:0.75rem 1.25rem;border-top:1px solid var(--border);display:flex;gap:0.5rem">
        <button onclick="openEphemeraEdit('${tabId}',${rowKey})" style="flex:1;padding:0.6rem;border-radius:8px;border:1.5px solid #e67e22;color:#e67e22;background:rgba(230,126,34,0.1);cursor:pointer;font-family:var(--font-body);font-weight:600">Edit</button>
        <button onclick="ephemeraForSale('${tabId}',${rowKey});this.closest('.modal-overlay').remove()" style="flex:1;padding:0.6rem;border-radius:8px;border:1.5px solid #f39c12;color:#f39c12;background:rgba(243,156,18,0.1);cursor:pointer;font-family:var(--font-body);font-weight:600">🏷️ For Sale</button>
        <button onclick="ephemeraSold('${tabId}',${rowKey});this.closest('.modal-overlay').remove()" style="flex:1;padding:0.6rem;border-radius:8px;border:1.5px solid #2ecc71;color:#2ecc71;background:rgba(46,204,113,0.1);cursor:pointer;font-family:var(--font-body);font-weight:600">💰 Sold</button>
        <button onclick="ephemeraDelete('${tabId}',${rowKey});this.closest('.modal-overlay').remove()" style="padding:0.6rem 0.8rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);cursor:pointer;font-family:var(--font-body)" title="Delete">🗑</button>
        <button onclick="this.closest('.modal-overlay').remove()" style="padding:0.6rem 0.8rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);cursor:pointer;font-family:var(--font-body)">Close</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

// ── Ephemera Actions ─────────────────────────────────────────────

const _ephTabNames  = { catalogs:'Catalogs', paper:'Paper Items', mockups:'Mock-Ups', other:'Other Lionel' };
const _ephTabCols   = { catalogs:'I', paper:'J', mockups:'O', other:'J' };

async function ephemeraDelete(tabId, rowKey) {
  const item = (state.ephemeraData[tabId] || {})[rowKey];
  if (!item) return;
  const label = (_ephTabNames[tabId] || tabId);
  if (!(await appConfirm('Remove "' + (item.title || item.itemNum || label) + '" from your collection?', { danger: true, ok: 'Remove' }))) return;
  // Blank sheet row if we have an actual row number
  if (item.row && typeof item.row === 'number' && item.row >= 3 && item.row < 1000000) {
    const lastCol = _ephTabCols[tabId] || 'J';
    const sheetName = (_ephTabNames[tabId] || tabId) + '!A' + item.row + ':' + lastCol + item.row;
    const blanks = [Array(lastCol.charCodeAt(0) - 64).fill('')];
    sheetsUpdate(state.personalSheetId, sheetName, blanks).catch(e => console.warn('ephemera delete row', e));
  }
  delete state.ephemeraData[tabId][rowKey];
  _cachePersonalData();
  showToast('✓ Removed from collection');
  renderBrowse();
  buildDashboard();
}

function ephemeraForSale(tabId, rowKey) {
  const item = (state.ephemeraData[tabId] || {})[rowKey];
  if (!item) return;
  const label = _ephTabNames[tabId] || tabId;
  const title = item.title || item.itemNum || label;

  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1.5rem';
  ov.innerHTML = `
    <div style="background:var(--surface);border-radius:14px;padding:1.5rem;max-width:360px;width:100%;border:1px solid var(--border)">
      <div style="font-family:var(--font-head);font-size:1rem;font-weight:700;margin-bottom:0.2rem">List For Sale</div>
      <div style="font-size:0.82rem;color:var(--text-dim);margin-bottom:1.1rem">${title}</div>
      <div style="margin-bottom:0.75rem">
        <div class="field-label">Asking Price ($)</div>
        <input type="number" id="eph-fs-price" min="0" step="0.01" placeholder="0.00"
          value="${item.estValue||''}"
          style="width:100%;padding:0.5rem 0.7rem;border-radius:7px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:var(--font-mono);font-size:0.95rem;outline:none;box-sizing:border-box">
      </div>
      <div style="margin-bottom:1.1rem">
        <div class="field-label">Date Listed</div>
        <input type="date" id="eph-fs-date" value="${new Date().toISOString().slice(0,10)}"
          style="width:100%;padding:0.5rem 0.7rem;border-radius:7px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none;box-sizing:border-box">
      </div>
      <div style="display:flex;gap:0.6rem">
        <button onclick="this.closest('div[style*=fixed]').remove()"
          style="flex:1;padding:0.65rem;border-radius:8px;border:1px solid var(--border);background:none;color:var(--text-dim);font-family:var(--font-body);cursor:pointer">Cancel</button>
        <button id="eph-fs-save"
          style="flex:2;padding:0.65rem;border-radius:8px;border:none;background:#f39c12;color:white;font-family:var(--font-body);font-weight:600;cursor:pointer">🏷️ List For Sale</button>
      </div>
    </div>`;
  document.body.appendChild(ov);

  document.getElementById('eph-fs-save').onclick = async () => {
    const price    = document.getElementById('eph-fs-price').value;
    const dateListed = document.getElementById('eph-fs-date').value;
    ov.remove();
    // Write to For Sale sheet: Item#, Variation, Condition, AskingPrice, DateListed, Notes, OrigPrice, EstWorth
    const row = [
      item.itemNum || label,
      '',                          // variation
      item.condition || '',
      price,
      dateListed,
      title,                       // notes = title as description
      '',                          // original price paid
      item.estValue || '',
      '',                          // inventory ID (not applicable for ephemera)
      _getEraManufacturer(),       // manufacturer
    ];
    try {
      await sheetsAppend(state.personalSheetId, 'For Sale!A:J', [row]);
      showToast('✓ Listed for sale');
    } catch(e) { showToast('Error listing: ' + e.message, 3000, true); }
  };
}

function ephemeraSold(tabId, rowKey) {
  const item = (state.ephemeraData[tabId] || {})[rowKey];
  if (!item) return;
  const label = _ephTabNames[tabId] || tabId;
  const title = item.title || item.itemNum || label;

  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1.5rem';
  ov.innerHTML = `
    <div style="background:var(--surface);border-radius:14px;padding:1.5rem;max-width:360px;width:100%;border:1px solid var(--border)">
      <div style="font-family:var(--font-head);font-size:1rem;font-weight:700;margin-bottom:0.2rem">Mark as Sold</div>
      <div style="font-size:0.82rem;color:var(--text-dim);margin-bottom:1.1rem">${title}</div>
      <div style="margin-bottom:0.75rem">
        <div class="field-label">Sale Price ($)</div>
        <input type="number" id="eph-sold-price" min="0" step="0.01" placeholder="0.00"
          value="${item.estValue||''}"
          style="width:100%;padding:0.5rem 0.7rem;border-radius:7px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:var(--font-mono);font-size:0.95rem;outline:none;box-sizing:border-box">
      </div>
      <div style="margin-bottom:1.1rem">
        <div class="field-label">Date Sold</div>
        <input type="date" id="eph-sold-date" value="${new Date().toISOString().slice(0,10)}"
          style="width:100%;padding:0.5rem 0.7rem;border-radius:7px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none;box-sizing:border-box">
      </div>
      <div style="margin-bottom:1.1rem">
        <div class="field-label">Also remove from collection?</div>
        <div style="display:flex;gap:0.5rem">
          <label style="display:flex;align-items:center;gap:0.4rem;font-size:0.85rem;cursor:pointer"><input type="radio" name="eph-rm" id="eph-rm-yes" checked> Yes, remove it</label>
          <label style="display:flex;align-items:center;gap:0.4rem;font-size:0.85rem;cursor:pointer"><input type="radio" name="eph-rm" id="eph-rm-no"> Keep in collection</label>
        </div>
      </div>
      <div style="display:flex;gap:0.6rem">
        <button onclick="this.closest('div[style*=fixed]').remove()"
          style="flex:1;padding:0.65rem;border-radius:8px;border:1px solid var(--border);background:none;color:var(--text-dim);font-family:var(--font-body);cursor:pointer">Cancel</button>
        <button id="eph-sold-save"
          style="flex:2;padding:0.65rem;border-radius:8px;border:none;background:#2ecc71;color:white;font-family:var(--font-body);font-weight:600;cursor:pointer">💰 Mark as Sold</button>
      </div>
    </div>`;
  document.body.appendChild(ov);

  document.getElementById('eph-sold-save').onclick = async () => {
    const salePrice = document.getElementById('eph-sold-price').value;
    const dateSold  = document.getElementById('eph-sold-date').value;
    const removeIt  = document.getElementById('eph-rm-yes').checked;
    ov.remove();
    // Write to Sold sheet: Item#, Variation, Copy#, Condition, PricePaid, SalePrice, DateSold, Notes
    const row = [
      item.itemNum || label,
      '',          // variation
      '1',         // copy
      item.condition || '',
      item.estValue || '',
      salePrice,
      dateSold,
      title,       // notes = title as description
      '',          // inventory ID (not applicable for ephemera)
      _getEraManufacturer(),  // manufacturer
    ];
    try {
      await sheetsAppend(state.personalSheetId, 'Sold!A:J', [row]);
      if (removeIt) {
        // Remove from ephemera sheet and state
        if (item.row && typeof item.row === 'number' && item.row >= 3 && item.row < 1000000) {
          const lastCol = _ephTabCols[tabId] || 'J';
          const sheetName = (_ephTabNames[tabId] || tabId) + '!A' + item.row + ':' + lastCol + item.row;
          const blanks = [Array(lastCol.charCodeAt(0) - 64).fill('')];
          sheetsUpdate(state.personalSheetId, sheetName, blanks).catch(e => console.warn('ephemera sold clear', e));
        }
        delete state.ephemeraData[tabId][rowKey];
        _cachePersonalData();
        renderBrowse();
        buildDashboard();
      }
      showToast('✓ Marked as sold');
    } catch(e) { showToast('Error saving: ' + e.message, 3000, true); }
  };
}

function buildWantPage() {
  // Contextual hint for empty Want List (Option D, 2026-04-14)
  if (typeof maybeShowContextualHint === 'function' && Object.keys(state.wantData || {}).length === 0) {
    var _wpcAnchor = document.getElementById('want-page') || document.getElementById('want-list-container') || document.querySelector('.page-want');
    if (_wpcAnchor) maybeShowContextualHint('want_empty', '<strong>Want List</strong> tracks items you\'re still looking for. Tap <em>Add to Want List</em> to add your first.', _wpcAnchor);
  }
  const isMobile = window.innerWidth <= 640;
  const _wq = (state._wantSearch || '').toLowerCase();
  const _wp = state._wantPriority || '';
  const _wt = state._wantType || '';
  const _ws = state._wantSort || 'priority';
  // Sync dropdowns with state
  const _wpEl = document.getElementById('want-priority-filter');
  if (_wpEl && _wpEl.value !== _wp) _wpEl.value = _wp;
  const _wtEl = document.getElementById('want-type-filter');
  if (_wtEl && _wtEl.value !== _wt) _wtEl.value = _wt;
  const _wsEl = document.getElementById('want-sort');
  if (_wsEl && _wsEl.value !== _ws) _wsEl.value = _ws;
  const totalCount = Object.keys(state.wantData).length;
  const entries = Object.values(state.wantData).filter(w => {
    // Priority filter
    if (_wp && (w.priority || 'Medium') !== _wp) return false;
    // Type filter — lookup master to get item type
    if (_wt) {
      const _setMatch = _wt === 'Set' && state.setData && state.setData.find(s => s.setNum === w.itemNum);
      if (_wt === 'Set' && !_setMatch) return false;
      if (_wt !== 'Set') {
        const _master = findMaster(w.itemNum);
        if (!_master || (_master.itemType || '') !== _wt) return false;
      }
    }
    // Text search
    if (_wq) {
      const master = state.masterData.find(m => m.itemNum === w.itemNum && (!w.variation || m.variation === w.variation)) || {};
      return (w.itemNum||'').toLowerCase().includes(_wq)
        || (master.roadName||'').toLowerCase().includes(_wq)
        || (master.itemType||'').toLowerCase().includes(_wq)
        || (w.variation||'').toLowerCase().includes(_wq)
        || (w.notes||'').toLowerCase().includes(_wq);
    }
    return true;
  });
  // Sort
  const priorityOrder = { 'High': 0, 'Medium': 1, 'Low': 2 };
  if (_ws === 'priority') {
    entries.sort((a, b) => (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1));
  } else if (_ws === 'itemnum') {
    entries.sort((a, b) => (a.itemNum||'').localeCompare(b.itemNum||'', undefined, {numeric:true}));
  } else if (_ws === 'price') {
    entries.sort((a, b) => (parseFloat(b.expectedPrice)||0) - (parseFloat(a.expectedPrice)||0));
  }
  // Count display
  const countEl = document.getElementById('want-count');
  if (countEl) {
    countEl.textContent = entries.length === totalCount
      ? totalCount + ' item' + (totalCount !== 1 ? 's' : '')
      : 'Showing ' + entries.length + ' of ' + totalCount;
  }
  // Keep nav count badge in sync
  const countBadge = document.getElementById('nav-wanted2');
  if (countBadge) countBadge.textContent = totalCount.toLocaleString();
  const cardsEl = document.getElementById('want-cards');
  const tableEl = document.getElementById('want-table');
  const tbody   = document.getElementById('want-tbody');
  const priorityColor = { High: 'var(--accent)', Medium: 'var(--accent2)', Low: 'var(--text-dim)' };

  if (entries.length === 0) {
    const hasFilters = _wq || _wp || _wt;
    const emptyIcon = hasFilters ? '🔍' : '❤️';
    const emptyMsg = hasFilters ? 'No items match your filters' : 'Your want list is empty';
    const emptyTip = hasFilters ? 'Try adjusting your search or filters' : 'Add items you\'re looking for';
    const empty = `<div style="text-align:center;padding:3rem 1rem;color:var(--text-dim)"><div style="font-size:2.5rem;margin-bottom:0.5rem">${emptyIcon}</div><p>${emptyMsg}</p><p style="font-size:0.8rem;margin-top:0.5rem">${emptyTip}</p></div>`;
    if (cardsEl) cardsEl.innerHTML = empty;
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="ui-empty">' + emptyMsg + '</td></tr>';
    return;
  }

  if (isMobile) {
    if (tableEl) tableEl.style.display = 'none';
    if (cardsEl) cardsEl.style.display = 'flex';
    cardsEl.innerHTML = entries.map(w => {
      const master = state.masterData.find(m => m.itemNum === w.itemNum && (!w.variation || m.variation === w.variation));
      const name = master ? (master.roadName || master.description || master.itemType || '') : '';
      const pColor = priorityColor[w.priority] || 'var(--text-dim)';
      const masterIdx2 = master ? state.masterData.indexOf(master) : -1;
      const escVar = (w.variation||'').replace(/'/g,"\\'");
      const escName = (name||'').replace(/'/g,"\\'");
      // Set detection for mobile cards
      const _mSetMatch = state.setData ? state.setData.find(s => s.setNum === w.itemNum) : null;
      const _mIsSet = !!_mSetMatch;
      const _mSetLabel = _mIsSet ? [_mSetMatch.setName, _mSetMatch.year].filter(Boolean).join(' · ') : '';
      const _mChipsHtml = _mIsSet ? '<div style="display:flex;flex-wrap:wrap;gap:0.2rem;margin-top:0.35rem">' + _mSetMatch.items.slice(0,6).map(n => '<span style="font-family:var(--font-mono);font-size:0.65rem;padding:1px 5px;border-radius:3px;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim)">' + n + '</span>').join('') + (_mSetMatch.items.length > 6 ? '<span style="font-size:0.65rem;color:var(--text-dim)">+' + (_mSetMatch.items.length-6) + ' more</span>' : '') + '</div>' : '';
      const _wShareKey = w.itemNum + '|' + (w.variation||'') + '|' + (w.row||0);
      const _wInShare = typeof isShareMode === 'function' && isShareMode('want');
      const _wSelected = _wInShare && window._shareItems && window._shareItems[_wShareKey];
      if (_wInShare) { if (!window._shareDataMap) window._shareDataMap = {}; window._shareDataMap[_wShareKey] = { itemNum: w.itemNum, variation: w.variation||'', want: w, master: master }; }
      return `<div id="share-card-${_wShareKey}" style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:0.85rem 1rem${_wSelected ? ';outline:2px solid #3a9e68' : ''}">
        <div style="display:flex;align-items:center;gap:0.75rem;cursor:pointer" onclick="${_wInShare ? 'toggleShareItem(\'' + _wShareKey + '\')' : (masterIdx2>=0?'openItem('+masterIdx2+')':'')}">
          ${_wInShare ? '<input type="checkbox" id="share-cb-' + _wShareKey + '" ' + (_wSelected ? 'checked' : '') + ' onclick="event.stopPropagation();toggleShareItem(\'' + _wShareKey + '\')" style="width:1.1rem;height:1.1rem;accent-color:#3a9e68;flex-shrink:0">' : ''}
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:0.5rem">
              <span style="font-family:var(--font-head);font-size:1.1rem;color:var(--accent)">${w.itemNum}</span>
              ${_mIsSet ? '<span style="font-size:0.62rem;color:#e67e22;font-weight:600">SET</span>' : (w.variation ? `<span style="font-size:0.72rem;color:var(--text-dim)">${w.variation}</span>` : '')}
              <span style="font-size:0.65rem;font-weight:600;color:${pColor};border:1px solid ${pColor};border-radius:4px;padding:0.1rem 0.4rem">${w.priority || 'Medium'}</span>
            </div>
            ${_mIsSet ? (_mSetLabel ? `<div style="font-size:0.82rem;color:var(--text);margin-top:0.15rem">${_mSetLabel}</div>` : '') + _mChipsHtml : (name ? `<div style="font-size:0.82rem;color:var(--text);margin-top:0.15rem">${name}</div>` : '')}
            ${w.notes ? `<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.15rem">${w.notes}</div>` : ''}
          </div>
          <div style="text-align:right;flex-shrink:0">
            ${w.expectedPrice ? `<div style="font-family:var(--font-mono);color:var(--accent2);font-size:0.9rem">$${parseFloat(w.expectedPrice).toLocaleString()}</div>` : ''}
          </div>
        </div>
        ${!_wInShare ? `<div style="display:flex;gap:0.35rem;margin-top:0.6rem;flex-wrap:wrap">
          <button onclick="event.stopPropagation();moveWantToCollection('${w.itemNum}','${escVar}')" style="flex:1;min-width:0;padding:0.4rem 0.3rem;border-radius:7px;font-size:0.75rem;cursor:pointer;border:1.5px solid #2ecc71;background:rgba(46,204,113,0.12);color:#2ecc71;font-family:var(--font-body);font-weight:600">+ Collection</button>
          <button onclick="event.stopPropagation();wantFindOnEbay('${w.itemNum}','${escName}')" style="flex:1;min-width:0;padding:0.4rem 0.3rem;border-radius:7px;font-size:0.75rem;cursor:pointer;border:1.5px solid #e67e22;background:rgba(230,126,34,0.12);color:#e67e22;font-family:var(--font-body);font-weight:600">eBay</button>
          <button onclick="event.stopPropagation();wantSearchOtherSites('${w.itemNum}','${escName}')" style="flex:1;min-width:0;padding:0.4rem 0.3rem;border-radius:7px;font-size:0.75rem;cursor:pointer;border:1.5px solid #2980b9;background:rgba(41,128,185,0.12);color:#2980b9;font-family:var(--font-body);font-weight:600">Search</button>
          <button onclick="event.stopPropagation();removeWantItem('${w.itemNum}','${escVar}',${w.row})" style="flex:0 0 auto;padding:0.4rem 0.6rem;border-radius:7px;font-size:0.75rem;cursor:pointer;border:1.5px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body)">Remove</button>
        </div>` : ''}
      </div>`;
    }).join('');
  } else {
    if (tableEl) tableEl.style.display = '';
    if (cardsEl) cardsEl.style.display = 'none';
    // Store descriptions in a map to avoid quoting issues in onclick
    window._wantDescs = {};
    tbody.innerHTML = entries.map((w, idx) => {
      const master = state.masterData.find(m => m.itemNum === w.itemNum && (!w.variation || m.variation === w.variation));
      const roadName = master ? (master.roadName || '') : '';
      const varDesc  = master ? (master.varDesc || master.variationDesc || '') : '';
      const fullDesc = master ? (master.description || '') : '';

      // Check if this is a set want entry
      const _setMatch = state.setData ? state.setData.find(s => s.setNum === w.itemNum) : null;
      const _isSet = !!_setMatch;
      const _setLabel = _isSet
        ? [_setMatch.setName, _setMatch.year, _setMatch.gauge].filter(Boolean).join(' · ')
        : '';
      const _setChipsHtml = _isSet
        ? _setMatch.items.slice(0, 6).map(n =>
            `<span style="font-family:var(--font-mono);font-size:0.67rem;padding:1px 5px;border-radius:3px;border:1px solid var(--border);background:var(--surface);color:var(--text-dim)">${n}</span>`
          ).join('') + (_setMatch.items.length > 6
            ? `<span style="font-size:0.67rem;color:var(--text-dim)">+${_setMatch.items.length - 6} more</span>`
            : '')
        : '';

      const refLink = master ? (master.refLink || '') : '';
      window._wantDescs[idx] = { title: (_isSet ? _setLabel : roadName) || w.itemNum, varDesc, fullDesc, refLink };
      const pColor = priorityColor[w.priority] || 'var(--text-dim)';
      const shortVar = varDesc.length > 30 ? varDesc.substring(0, 30) + '…' : varDesc;
      const varCell = _isSet
        ? `<div style="display:flex;flex-wrap:wrap;gap:0.2rem;align-items:center">${_setChipsHtml}</div>`
        : varDesc
          ? `<span style="cursor:pointer;border-bottom:1px dashed var(--border);color:var(--text-mid)" onclick="showWantDesc(${idx})">${shortVar}</span>`
          : (w.variation ? `<span class="text-dim">${w.variation}</span>` : '<span class="text-dim">—</span>');
      const _displayRoad = _isSet ? _setLabel : roadName;
      const _wDShareKey = w.itemNum + '|' + (w.variation||'') + '|' + (w.row||0);
      const _wDInShare = typeof isShareMode === 'function' && isShareMode('want');
      const _wDSelected = _wDInShare && window._shareItems && window._shareItems[_wDShareKey];
      if (_wDInShare) { if (!window._shareDataMap) window._shareDataMap = {}; window._shareDataMap[_wDShareKey] = { itemNum: w.itemNum, variation: w.variation||'', want: w, master: master }; }
      return `<tr id="share-card-${_wDShareKey}" ${_wDInShare ? 'onclick="toggleShareItem(\'' + _wDShareKey + '\')"' : ''} style="cursor:${_wDInShare ? 'pointer' : 'default'}${_wDSelected ? ';outline:2px solid #3a9e68;background:rgba(58,158,104,0.06)' : ''}">
        <td><span class="item-num">${_wDInShare ? '<input type="checkbox" id="share-cb-' + _wDShareKey + '" ' + (_wDSelected ? 'checked' : '') + ' onclick="event.stopPropagation();toggleShareItem(\'' + _wDShareKey + '\')" style="width:1rem;height:1rem;accent-color:#3a9e68;margin-right:5px;vertical-align:middle">' : ''}${w.itemNum}</span>${_isSet ? ' <span style="font-size:0.62rem;color:#e67e22;font-weight:600;vertical-align:middle">SET</span>' : ''}</td>
        <td>${_displayRoad || '<span class="text-dim">—</span>'}</td>
        <td>${_isSet ? '<span class="text-dim">—</span>' : (w.variation || '<span class="text-dim">—</span>')}</td>
        <td>${varCell}</td>
        <td><span style="color:${pColor};font-weight:500">${w.priority || 'Medium'}</span></td>
        <td class="market-val">${w.expectedPrice ? '$' + parseFloat(w.expectedPrice).toLocaleString() : '<span class="text-dim">—</span>'}</td>
        <td style="white-space:nowrap">
          ${!_wDInShare ? `<button onclick="moveWantToCollection('${w.itemNum}','${(w.variation||'').replace(/'/g,"\\'")}')" style="padding:0.3rem 0.5rem;border-radius:5px;font-size:0.72rem;cursor:pointer;border:1px solid #2ecc71;background:rgba(46,204,113,0.12);color:#2ecc71;font-family:var(--font-body);margin-right:0.25rem" title="Add to My Collection">+ Collection</button>
          <button onclick="wantFindOnEbay('${w.itemNum}','${(roadName||'').replace(/'/g,"\\'")}')" style="padding:0.3rem 0.5rem;border-radius:5px;font-size:0.72rem;cursor:pointer;border:1px solid #e67e22;background:rgba(230,126,34,0.12);color:#e67e22;font-family:var(--font-body);margin-right:0.25rem" title="Search eBay">eBay</button>
          <button onclick="wantSearchOtherSites('${w.itemNum}','${(roadName||'').replace(/'/g,"\\'")}')" style="padding:0.3rem 0.5rem;border-radius:5px;font-size:0.72rem;cursor:pointer;border:1px solid #2980b9;background:rgba(41,128,185,0.12);color:#2980b9;font-family:var(--font-body);margin-right:0.25rem" title="Search other auction sites">Search</button>
          <button onclick="removeWantItem('${w.itemNum}','${(w.variation||'').replace(/'/g,"\\'")}',${w.row})" style="padding:0.3rem 0.5rem;border-radius:5px;font-size:0.72rem;cursor:pointer;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body)" title="Remove from Want List">Remove</button>` : ''}
        </td>
      </tr>`;
    }).join('') || '<tr><td colspan="7" class="ui-empty">No items on want list</td></tr>';
  }
}

function showVarDescPopup(idx) {
  const item = state.masterData[idx];
  if (!item || !item.varDesc) return;
  const existing = document.getElementById('vardesc-popup');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'vardesc-popup';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1.5rem';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
  const box = document.createElement('div');
  box.style.cssText = 'background:var(--surface);border:1px solid var(--border);border-radius:14px;max-width:520px;width:100%;padding:1.5rem;position:relative';
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = 'position:absolute;top:0.75rem;right:0.75rem;background:none;border:none;color:var(--text-dim);font-size:1.1rem;cursor:pointer';
  closeBtn.onclick = function() { overlay.remove(); };
  box.appendChild(closeBtn);
  const hdr = document.createElement('div');
  hdr.style.cssText = 'font-family:var(--font-head);color:var(--accent2);margin-bottom:0.5rem;margin-right:2rem';
  hdr.textContent = item.itemNum + (item.variation ? ' — Variation ' + item.variation : '') + (item.roadName ? ' · ' + item.roadName : '');
  box.appendChild(hdr);
  const varEl = document.createElement('div');
  varEl.style.cssText = 'font-size:0.9rem;color:var(--text);line-height:1.7';
  varEl.textContent = item.varDesc;
  box.appendChild(varEl);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function showWantDesc(idx) {
  const d = (window._wantDescs || {})[idx];
  if (!d) return;
  const existing = document.getElementById('want-desc-modal');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'want-desc-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1.5rem';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
  const box = document.createElement('div');
  box.style.cssText = 'background:var(--surface);border:1px solid var(--border);border-radius:14px;max-width:520px;width:100%;padding:1.5rem;position:relative';
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = 'position:absolute;top:0.75rem;right:0.75rem;background:none;border:none;color:var(--text-dim);font-size:1.1rem;cursor:pointer';
  closeBtn.onclick = function() { overlay.remove(); };
  box.appendChild(closeBtn);
  const titleEl = document.createElement('div');
  titleEl.style.cssText = 'font-family:var(--font-head);font-size:1rem;color:var(--accent2);margin-bottom:0.75rem;margin-right:2rem';
  titleEl.textContent = d.title;
  box.appendChild(titleEl);
  if (d.varDesc) {
    const varEl = document.createElement('div');
    varEl.style.cssText = 'font-size:0.85rem;color:var(--accent);font-weight:600;margin-bottom:0.5rem';
    varEl.textContent = 'Variation: ' + d.varDesc;
    box.appendChild(varEl);
  }
  const descEl = document.createElement('div');
  descEl.style.cssText = 'font-size:0.85rem;color:var(--text-mid);line-height:1.7';
  descEl.textContent = d.fullDesc || d.title;
  box.appendChild(descEl);
  if (d.refLink) {
    const cottRow = document.createElement('div');
    cottRow.style.cssText = 'margin-top:1rem;padding-top:0.75rem;border-top:1px solid var(--border);display:flex;justify-content:flex-end';
    const cottA = document.createElement('a');
    cottA.href = d.refLink;
    cottA.target = '_blank';
    cottA.rel = 'noopener';
    cottA.style.cssText = 'font-size:0.78rem;color:var(--accent2);text-decoration:none;display:inline-flex;align-items:center;gap:0.3rem;padding:0.25rem 0.55rem;border:1px solid rgba(201,146,42,0.3);border-radius:6px;background:rgba(201,146,42,0.08)';
    cottA.innerHTML = 'COTT &#8599;';
    cottRow.appendChild(cottA);
    box.appendChild(cottRow);
  }
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

// ── Want List Actions ──────────────────────────────────────────
async function removeWantItem(itemNum, variation, row) {
  if (!(await appConfirm('Remove this item from your Want List?', { danger: true, ok: 'Remove' }))) return;
  const key = `${itemNum}|${variation}`;
  if (row) {
    await sheetsUpdate(state.personalSheetId, `Want List!A${row}:F${row}`, [['','','','','','']]);
  }
  delete state.wantData[key];
  _cachePersonalData();
  buildWantPage();
  buildDashboard();
  showToast('✓ Removed from Want List');
}

function moveWantToCollection(itemNum, variation) {
  // Bugfix 2026-04-14: was opening the full wizard at the era/category picker.
  // The want-list entry already tells us everything the lookup steps would ask, so
  // pre-fill all of that (era, item#, variation, grouping, entry mode, category)
  // and land on Condition & Details — the user only needs to fill what's new:
  // condition, price paid, est worth, optional photos.
  openWizard('collection');
  setTimeout(function() {
    if (!window.wizard) return;

    // Look up master row (prefer variation match; fall back to any variation)
    const master = state.masterData.find(m =>
      m.itemNum === itemNum && (!variation || String(m.variation||'') === String(variation))
    ) || findMaster(itemNum);

    // Seed everything we know
    wizard.data._fromWantList = true;
    wizard.data._fromWantKey = `${itemNum}|${variation}`;
    wizard.data._rawItemNum = itemNum;
    wizard.data.itemNum = itemNum;
    if (variation) wizard.data.variation = variation;
    wizard.data.itemCategory = 'lionel';      // skips era picker
    wizard.data._itemGrouping = wizard.data._itemGrouping || 'single'; // default; user can change later via Edit Group
    wizard.data.entryMode = wizard.data.entryMode || 'full'; // skips entryMode picker

    if (master) {
      wizard.matchedItem = master;
      // Infer era so the later save writes to the right era sheet
      if (!wizard.data._era) {
        var _tab = String(master._tab || '').toLowerCase();
        if (_tab.includes('mpc') || _tab.includes('modern')) wizard.data._era = 'mod';
        else if (_tab.includes('pre-war') || _tab.includes('prewar')) wizard.data._era = 'prewar';
        else wizard.data._era = 'pw';
      }
    }

    // Rebuild step list and advance to Condition & Details
    wizard.steps = getSteps('collection');
    var targetIdx = wizard.steps.findIndex(function(s) { return s.id === 'conditionDetails'; });
    // Fallback if the step id changes in a future refactor
    if (targetIdx < 0) targetIdx = wizard.steps.findIndex(function(s) { return s.id === 'itemNumGrouping'; });
    wizard.step = targetIdx >= 0 ? targetIdx : 0;
    renderWizardStep();

    if (typeof showToast === 'function') {
      showToast('Moving ' + itemNum + ' to Collection — just fill in Condition + Price', 3000);
    }
  }, 150);
}

// ── EBAY SEARCH MODAL ────────────────────────────────────────────
// Affiliate Campaign ID — replace CAMPAIGN_ID with real ID from eBay Partner Network
const _EPN_CAMPAIGN_ID = '5339145351';
const _EPN_PARAMS = _EPN_CAMPAIGN_ID !== 'CAMPAIGN_ID'
  ? `&mkcid=1&mkrid=711-53200-19255-0&siteid=0&campid=${_EPN_CAMPAIGN_ID}&toolid=10001&mkevt=1`
  : '';

function wantFindOnEbay(itemNum, roadName) {
  // Remove any existing eBay modal
  const _old = document.getElementById('ebay-search-modal');
  if (_old) _old.remove();

  const _overlay = document.createElement('div');
  _overlay.id = 'ebay-search-modal';
  _overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem';
  _overlay.onclick = function(e) { if (e.target === _overlay) _overlay.remove(); };

  _overlay.innerHTML = `
    <div style="background:var(--surface);border:1.5px solid var(--border);border-radius:14px;width:100%;max-width:420px;padding:1.25rem;box-shadow:0 8px 32px rgba(0,0,0,0.5)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
        <div style="display:flex;align-items:center;gap:0.5rem">
          <span style="font-size:1.3rem">🛒</span>
          <span style="font-family:var(--font-head);font-size:1.1rem;color:var(--text);letter-spacing:0.03em">Search eBay</span>
        </div>
        <button onclick="document.getElementById('ebay-search-modal').remove()" style="background:none;border:none;color:var(--text-dim);font-size:1.3rem;cursor:pointer;line-height:1">✕</button>
      </div>

      <div style="background:var(--surface2);border-radius:8px;padding:0.6rem 0.8rem;margin-bottom:1rem;font-family:var(--font-mono);font-size:0.85rem;color:var(--gold)">
        No. ${itemNum}${roadName ? ' · ' + roadName : ''}
      </div>

      <div style="margin-bottom:0.85rem">
        <label style="font-size:0.75rem;color:var(--text-mid);display:block;margin-bottom:0.3rem">LISTING TYPE</label>
        <div style="display:flex;gap:0.5rem">
          <button id="ebay-type-active" onclick="_ebaySetType('active')" style="flex:1;padding:0.45rem;border-radius:7px;font-size:0.8rem;cursor:pointer;border:1.5px solid var(--accent);background:var(--accent);color:#fff;font-family:var(--font-body);font-weight:600">Active Listings</button>
          <button id="ebay-type-sold" onclick="_ebaySetType('sold')" style="flex:1;padding:0.45rem;border-radius:7px;font-size:0.8rem;cursor:pointer;border:1.5px solid var(--border);background:transparent;color:var(--text-mid);font-family:var(--font-body);font-weight:600">Sold Listings</button>
        </div>
        <div style="font-size:0.7rem;color:var(--text-dim);margin-top:0.3rem" id="ebay-type-hint">See what&apos;s available to buy right now</div>
      </div>

      <div style="margin-bottom:0.85rem">
        <label style="font-size:0.75rem;color:var(--text-mid);display:block;margin-bottom:0.3rem">CONDITION</label>
        <select id="ebay-condition" style="width:100%;padding:0.4rem 0.5rem;border-radius:7px;background:var(--surface2);border:1.5px solid var(--border);color:var(--text);font-family:var(--font-body);font-size:0.82rem">
          <option value="">Any Condition</option>
          <option value="3000">Used</option>
          <option value="1000">New</option>
          <option value="2500">For parts / not working</option>
        </select>
      </div>

      <div style="margin-bottom:1.1rem">
        <label style="font-size:0.75rem;color:var(--text-mid);display:block;margin-bottom:0.3rem">PRICE RANGE (optional)</label>
        <div style="display:flex;align-items:center;gap:0.5rem">
          <input id="ebay-price-min" type="number" placeholder="Min $" min="0" style="flex:1;padding:0.4rem 0.5rem;border-radius:7px;background:var(--surface2);border:1.5px solid var(--border);color:var(--text);font-family:var(--font-body);font-size:0.82rem">
          <span style="color:var(--text-dim);font-size:0.8rem">to</span>
          <input id="ebay-price-max" type="number" placeholder="Max $" min="0" style="flex:1;padding:0.4rem 0.5rem;border-radius:7px;background:var(--surface2);border:1.5px solid var(--border);color:var(--text);font-family:var(--font-body);font-size:0.82rem">
        </div>
      </div>

      <button onclick="_ebayDoSearch('${itemNum}','${(roadName||'').replace(/'/g,"\\'")}',false)" style="width:100%;padding:0.65rem;border-radius:9px;background:#e67e22;border:none;color:#fff;font-family:var(--font-head);font-size:1rem;letter-spacing:0.05em;cursor:pointer;font-weight:600">
        SEARCH EBAY ↗
      </button>
      <div style="text-align:center;margin-top:0.5rem;font-size:0.68rem;color:var(--text-dim)">Opens in a new tab</div>
    </div>
  `;

  document.body.appendChild(_overlay);
  window._ebayListingType = 'active';
}

function _ebaySetType(type) {
  window._ebayListingType = type;
  const btnActive = document.getElementById('ebay-type-active');
  const btnSold   = document.getElementById('ebay-type-sold');
  const hint      = document.getElementById('ebay-type-hint');
  if (type === 'active') {
    btnActive.style.cssText += ';border-color:var(--accent);background:var(--accent);color:#fff';
    btnSold.style.cssText   += ';border-color:var(--border);background:transparent;color:var(--text-mid)';
    hint.textContent = 'See what\'s available to buy right now';
  } else {
    btnSold.style.cssText   += ';border-color:#e67e22;background:#e67e22;color:#fff';
    btnActive.style.cssText += ';border-color:var(--border);background:transparent;color:var(--text-mid)';
    hint.textContent = 'See what items have actually sold for — great for pricing';
  }
}

function _ebayDoSearch(itemNum, roadName, _unused) {
  const query     = ['lionel', itemNum, roadName || ''].filter(Boolean).join(' ').trim();
  const type      = window._ebayListingType || 'active';
  const condition = document.getElementById('ebay-condition')?.value || '';
  const priceMin  = document.getElementById('ebay-price-min')?.value || '';
  const priceMax  = document.getElementById('ebay-price-max')?.value || '';

  let url;
  if (type === 'sold') {
    // Sold listings search
    url = 'https://www.ebay.com/sch/i.html?_nkw=' + encodeURIComponent(query)
      + '&_sacat=180250&LH_Sold=1&LH_Complete=1';
  } else {
    url = 'https://www.ebay.com/sch/i.html?_nkw=' + encodeURIComponent(query)
      + '&_sacat=180250&LH_ItemCondition=' + condition;
  }
  if (priceMin) url += '&_udlo=' + encodeURIComponent(priceMin);
  if (priceMax) url += '&_udhi=' + encodeURIComponent(priceMax);
  url += _EPN_PARAMS;

  window.open(url, '_blank');
  const modal = document.getElementById('ebay-search-modal');
  if (modal) modal.remove();
}

function wantSearchOtherSites(itemNum, roadName) {
  const query = ['lionel', itemNum, roadName || '', 'for sale'].filter(Boolean).join(' ').trim();
  const url = 'https://www.google.com/search?q=' + encodeURIComponent(query);
  window.open(url, '_blank');
}

function toggleSoldSummary() {
  const box = document.getElementById('sold-summary-box');
  const btn = document.getElementById('sold-summary-toggle');
  if (!box || !btn) return;
  const hidden = box.style.display === 'none';
  box.style.display = hidden ? 'flex' : 'none';
  btn.textContent = hidden ? 'Hide Summary' : 'Show Summary';
  try { localStorage.setItem('soldSummaryHidden', hidden ? '0' : '1'); } catch(e) {}
}

function soldSortBy(field) {
  if (state._soldSortField === field) {
    state._soldSortDir = state._soldSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    state._soldSortField = field;
    state._soldSortDir = field === 'salePrice' || field === 'dateSold' || field === 'condition' ? 'desc' : 'asc';
  }
  // Sync the dropdown
  var sel = document.getElementById('sold-sort-field');
  if (sel) sel.value = field;
  buildSoldPage();
}

function buildSoldPage() {
  // Contextual hint for empty Sold List
  if (typeof maybeShowContextualHint === 'function' && Object.keys(state.soldData || {}).length === 0) {
    var _spcAnchor = document.getElementById('sold-page') || document.querySelector('.page-sold');
    if (_spcAnchor) maybeShowContextualHint('sold_empty', '<strong>Sold List</strong> records items you\'ve sold. From My Collection, click <em>Add to Sold</em> on any item to log a sale.', _spcAnchor);
  }
  // Initialize sort/filter state if needed
  if (!state._soldSortField) state._soldSortField = 'dateSold';
  if (!state._soldSortDir) state._soldSortDir = 'desc';
  if (!state._soldFilterType) state._soldFilterType = '';

  const _sq = (state._soldSearch || '').toLowerCase();
  const _typeFilter = (state._soldFilterType || '').toLowerCase();

  // Enrich with master data
  let soldEntries = Object.values(state.soldData).map(sd => {
    const master = state.masterData.find(i => i.itemNum === sd.itemNum && i.variation === sd.variation) || {};
    return { ...sd, _type: master.itemType || '', _roadName: master.roadName || '', _master: master };
  });

  // Populate type filter dropdown (before filtering)
  const allTypes = [...new Set(soldEntries.map(e => e._type).filter(Boolean))].sort();
  const typeSel = document.getElementById('sold-filter-type');
  if (typeSel) {
    const curVal = state._soldFilterType || '';
    typeSel.innerHTML = '<option value="">All Types</option>' + allTypes.map(t =>
      '<option value="' + t + '"' + (t === curVal ? ' selected' : '') + '>' + t + '</option>'
    ).join('');
  }

  // Apply type filter
  if (_typeFilter) {
    soldEntries = soldEntries.filter(e => (e._type || '').toLowerCase() === _typeFilter);
  }

  // Apply search filter
  if (_sq) {
    soldEntries = soldEntries.filter(e =>
      (e.itemNum||'').toLowerCase().includes(_sq)
      || (e._roadName||'').toLowerCase().includes(_sq)
      || (e._type||'').toLowerCase().includes(_sq)
      || (e.variation||'').toLowerCase().includes(_sq)
      || (e.notes||'').toLowerCase().includes(_sq)
    );
  }

  // Sort
  const sf = state._soldSortField;
  const dir = state._soldSortDir === 'asc' ? 1 : -1;
  soldEntries.sort(function(a, b) {
    let va, vb;
    if (sf === 'salePrice') {
      va = parseFloat(a.salePrice) || 0; vb = parseFloat(b.salePrice) || 0;
    } else if (sf === 'condition') {
      va = parseFloat(a.condition) || 0; vb = parseFloat(b.condition) || 0;
    } else if (sf === 'dateSold') {
      va = a.dateSold || ''; vb = b.dateSold || '';
    } else if (sf === 'type') {
      va = (a._type || '').toLowerCase(); vb = (b._type || '').toLowerCase();
    } else if (sf === 'roadName') {
      va = (a._roadName || '').toLowerCase(); vb = (b._roadName || '').toLowerCase();
    } else {
      va = (a.itemNum || '').toLowerCase(); vb = (b.itemNum || '').toLowerCase();
    }
    return va < vb ? -dir : va > vb ? dir : 0;
  });

  // Update sort direction button label
  const dirBtn = document.getElementById('sold-sort-dir-btn');
  if (dirBtn) {
    const labels = { dateSold:'Date', itemNum:'Item #', salePrice:'Price', condition:'Cond', type:'Type', roadName:'Name' };
    dirBtn.textContent = (state._soldSortDir === 'asc' ? '↑ ' : '↓ ') + (labels[sf] || sf);
  }

  // Update column header sort indicators
  ['itemNum','type','roadName','condition','salePrice','dateSold'].forEach(function(col) {
    var el = document.getElementById('sold-sort-i-' + col);
    if (el) el.textContent = sf === col ? (state._soldSortDir === 'asc' ? '▲' : '▼') : '';
  });

  // Sync dropdown
  var sortSel = document.getElementById('sold-sort-field');
  if (sortSel) sortSel.value = sf;

  // Summary stats
  const totalRevenue = soldEntries.reduce((sum, sd) => sum + (parseFloat(sd.salePrice) || 0), 0);
  const countEl = document.getElementById('sold-stat-count');
  const totalEl = document.getElementById('sold-stat-total');
  if (countEl) countEl.textContent = soldEntries.length.toLocaleString();
  if (totalEl) totalEl.textContent = totalRevenue > 0 ? '$' + Math.round(totalRevenue).toLocaleString() : '$0';

  // Result count
  const rcEl = document.getElementById('sold-result-count');
  if (rcEl) rcEl.textContent = soldEntries.length + ' item' + (soldEntries.length !== 1 ? 's' : '');

  // Restore hidden state from localStorage
  try {
    const box = document.getElementById('sold-summary-box');
    const btn = document.getElementById('sold-summary-toggle');
    if (box && btn && localStorage.getItem('soldSummaryHidden') === '1') {
      box.style.display = 'none';
      btn.textContent = 'Show Summary';
    }
  } catch(e) {}

  const isMobileSold = window.innerWidth <= 640;
  const soldCardsEl = document.getElementById('sold-cards');
  const soldTableWrap = document.getElementById('sold-table-wrap');
  const tbody = document.getElementById('sold-tbody');

  if (isMobileSold) {
    if (soldCardsEl) soldCardsEl.style.display = 'flex';
    if (soldTableWrap) soldTableWrap.style.display = 'none';
    if (soldCardsEl) soldCardsEl.innerHTML = soldEntries.length ? soldEntries.map(sd => {
      return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:0.85rem 1rem">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <span style="font-family:var(--font-head);font-size:1.1rem;color:var(--accent)">${sd.itemNum}</span>
            ${sd.variation ? `<span style="font-size:0.72rem;color:var(--text-dim);margin-left:0.4rem">${sd.variation}</span>` : ''}
            ${sd._roadName ? `<div style="font-size:0.82rem;color:var(--text);margin-top:0.1rem">${sd._roadName}</div>` : ''}
            <div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.15rem">${[sd._type, sd.condition ? 'Cond: '+sd.condition : '', sd.dateSold].filter(Boolean).join(' · ')}</div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            ${sd.salePrice ? `<div style="font-family:var(--font-mono);color:#2ecc71;font-size:1.1rem;font-weight:600">$${parseFloat(sd.salePrice).toLocaleString()}</div>` : '<div style="color:var(--text-dim);font-size:0.8rem">No price</div>'}
          </div>
        </div>
      </div>`;
    }).join('') : '<div style="text-align:center;padding:3rem 1rem;color:var(--text-dim)"><div style="font-size:2.5rem;margin-bottom:0.5rem">💰</div><p>No sold items yet</p></div>';
  } else {
    if (soldCardsEl) soldCardsEl.style.display = 'none';
    if (soldTableWrap) soldTableWrap.style.display = '';
    tbody.innerHTML = soldEntries.length ? soldEntries.map(sd => {
      return `<tr>
        <td><span class="item-num">${sd.itemNum}</span></td>
        <td><span class="tag">${sd._type || '—'}</span></td>
        <td>${sd._roadName || '—'}</td>
        <td>${sd.variation || '—'}</td>
        <td>${sd.condition || '—'}</td>
        <td class="market-val">${sd.salePrice ? '$' + parseFloat(sd.salePrice).toLocaleString() : '—'}</td>
        <td class="text-dim">${sd.dateSold || '—'}</td>
      </tr>`;
    }).join('') : '<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">💰</div><p>No sold items yet</p></div></td></tr>';
  }

  var _ns = document.getElementById('nav-sold'); if (_ns) _ns.textContent = Object.keys(state.soldData).length;
}

function clearPageSearch(name) {
  const map = { browse: 'browse-search', sold: 'sold-search', want: 'want-search' };
  const el = document.getElementById(map[name]);
  // Don't clear — keep search term when returning to same page
}

function buildForSalePage() {
  // Contextual hint for empty For Sale List
  if (typeof maybeShowContextualHint === 'function' && Object.keys(state.forSaleData || {}).length === 0) {
    var _fpcAnchor = document.getElementById('forsale-page') || document.querySelector('.page-forsale');
    if (_fpcAnchor) maybeShowContextualHint('forsale_empty', '<strong>For Sale List</strong> tracks items you\'re selling. From My Collection, click <em>Add to For Sale</em> on any item to list it.', _fpcAnchor);
  }
  const _fq = (state._forsaleSearch || '').toLowerCase();
  const fsEntries = Object.values(state.forSaleData).filter(fs => {
    if (!_fq) return true;
    const master = state.masterData.find(i => i.itemNum === fs.itemNum && i.variation === fs.variation) || {};
    return (fs.itemNum||'').toLowerCase().includes(_fq)
      || (master.roadName||'').toLowerCase().includes(_fq)
      || (master.itemType||'').toLowerCase().includes(_fq)
      || (fs.variation||'').toLowerCase().includes(_fq);
  });

  // Summary stats
  const totalAsking = fsEntries.reduce((sum, fs) => sum + (parseFloat(fs.askingPrice) || 0), 0);
  const countEl = document.getElementById('forsale-stat-count');
  const totalEl = document.getElementById('forsale-stat-total');
  if (countEl) countEl.textContent = fsEntries.length.toLocaleString();
  if (totalEl) totalEl.textContent = totalAsking > 0 ? '$' + Math.round(totalAsking).toLocaleString() : '$0';

  const isMobileFs = window.innerWidth <= 640;
  const fsCardsEl = document.getElementById('forsale-cards');
  const fsTableWrap = document.getElementById('forsale-table-wrap');
  const tbody = document.getElementById('forsale-tbody');

  if (isMobileFs) {
    if (fsCardsEl) fsCardsEl.style.display = 'flex';
    if (fsTableWrap) fsTableWrap.style.display = 'none';
    if (fsCardsEl) fsCardsEl.innerHTML = fsEntries.length ? fsEntries.map(fs => {
      const master = state.masterData.find(i => i.itemNum === fs.itemNum && i.variation === fs.variation) || {};
      const collPd = state.personalData[fs.itemNum + '|' + (fs.variation||'')] || {};
      const estWorth = fs.estWorth || collPd.userEstWorth || '';
      const _fsShareKey = fs.itemNum + '|' + (fs.variation||'') + '|' + (fs.row||0);
      const _fsInShare = typeof isShareMode === 'function' && isShareMode('forsale');
      const _fsSelected = _fsInShare && window._shareItems && window._shareItems[_fsShareKey];
      if (_fsInShare) { if (!window._shareDataMap) window._shareDataMap = {}; window._shareDataMap[_fsShareKey] = { itemNum: fs.itemNum, variation: fs.variation||'', fs: fs, master: master }; }
      return `<div id="share-card-${_fsShareKey}" style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:0.85rem 1rem${_fsSelected ? ';outline:2px solid #3a9e68' : ''}" ${_fsInShare ? 'onclick="toggleShareItem(\'' + _fsShareKey + '\')"' : ''}>
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div style="display:flex;align-items:flex-start;gap:0.5rem">
            ${_fsInShare ? '<input type="checkbox" id="share-cb-' + _fsShareKey + '" ' + (_fsSelected ? 'checked' : '') + ' onclick="event.stopPropagation();toggleShareItem(\'' + _fsShareKey + '\')" style="width:1.1rem;height:1.1rem;accent-color:#3a9e68;flex-shrink:0;margin-top:0.2rem">' : ''}
            <div>
              <span style="font-family:var(--font-head);font-size:1.1rem;color:var(--accent)">${fs.itemNum}</span>
              ${fs.variation ? `<span style="font-size:0.72rem;color:var(--text-dim);margin-left:0.4rem">${fs.variation}</span>` : ''}
              ${master.roadName ? `<div style="font-size:0.82rem;color:var(--text);margin-top:0.1rem">${master.roadName}</div>` : ''}
              <div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.15rem">${[master.itemType, fs.condition ? 'Cond: '+fs.condition : '', fs.dateListed ? 'Listed: '+fs.dateListed : ''].filter(Boolean).join(' · ')}</div>
              ${estWorth ? `<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.1rem">Est. Worth: $${parseFloat(estWorth).toLocaleString()}</div>` : ''}
              ${fs.notes ? `<div style="font-size:0.72rem;color:var(--text-mid);margin-top:0.15rem;font-style:italic">${fs.notes.length > 60 ? fs.notes.substring(0,57)+'…' : fs.notes}</div>` : ''}
            </div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            ${fs.askingPrice ? `<div style="font-family:var(--font-mono);color:#e67e22;font-size:1.1rem;font-weight:600">$${parseFloat(fs.askingPrice).toLocaleString()}</div>` : '<div style="color:var(--text-dim);font-size:0.8rem">No price</div>'}
          </div>
        </div>
        ${!_fsInShare ? `<div style="display:flex;gap:0.4rem;margin-top:0.6rem;flex-wrap:wrap">
          <button onclick="markForSaleAsSold('${fs.itemNum}','${(fs.variation||'').replace(/'/g,"\\'")}','${fs.askingPrice||''}')" style="flex:1;padding:0.4rem;border-radius:7px;font-size:0.78rem;cursor:pointer;border:1.5px solid #2ecc71;background:rgba(46,204,113,0.12);color:#2ecc71;font-family:var(--font-body);font-weight:600">Mark as Sold</button>
          <button onclick="removeForSaleItem('${fs.itemNum}','${(fs.variation||'').replace(/'/g,"\\'")}',${fs.row})" style="flex:1;padding:0.4rem;border-radius:7px;font-size:0.78rem;cursor:pointer;border:1.5px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body)">Back to Collection</button>
          <button onclick="removeForSaleAndCollection('${fs.itemNum}','${(fs.variation||'').replace(/'/g,"\\'")}',${fs.row})" style="flex:0 0 auto;padding:0.4rem 0.6rem;border-radius:7px;font-size:0.78rem;cursor:pointer;border:1.5px solid #e74c3c;background:rgba(231,76,60,0.10);color:#e74c3c;font-family:var(--font-body)">Remove</button>
        </div>` : ''}
      </div>`;
    }).join('') : '<div style="text-align:center;padding:3rem 1rem;color:var(--text-dim)"><div style="font-size:2.5rem;margin-bottom:0.5rem">🏷️</div><p>No items listed for sale</p></div>';
  } else {
    if (fsCardsEl) fsCardsEl.style.display = 'none';
    if (fsTableWrap) fsTableWrap.style.display = '';
    if (tbody) tbody.innerHTML = fsEntries.length ? fsEntries.map(fs => {
      const master = state.masterData.find(i => i.itemNum === fs.itemNum && i.variation === fs.variation) || {};
      const collPd = state.personalData[fs.itemNum + '|' + (fs.variation||'')] || {};
      const estWorth = fs.estWorth || collPd.userEstWorth || '';
      const _fsDShareKey = fs.itemNum + '|' + (fs.variation||'') + '|' + (fs.row||0);
      const _fsDInShare = typeof isShareMode === 'function' && isShareMode('forsale');
      const _fsDSelected = _fsDInShare && window._shareItems && window._shareItems[_fsDShareKey];
      if (_fsDInShare) { if (!window._shareDataMap) window._shareDataMap = {}; window._shareDataMap[_fsDShareKey] = { itemNum: fs.itemNum, variation: fs.variation||'', fs: fs, master: master }; }
      return `<tr id="share-card-${_fsDShareKey}" ${_fsDInShare ? 'onclick="toggleShareItem(\'' + _fsDShareKey + '\')"' : ''} style="cursor:${_fsDInShare ? 'pointer' : 'default'}${_fsDSelected ? ';outline:2px solid #3a9e68;background:rgba(58,158,104,0.06)' : ''}">
        <td><span class="item-num">${_fsDInShare ? '<input type="checkbox" id="share-cb-' + _fsDShareKey + '" ' + (_fsDSelected ? 'checked' : '') + ' onclick="event.stopPropagation();toggleShareItem(\'' + _fsDShareKey + '\')" style="width:1rem;height:1rem;accent-color:#3a9e68;margin-right:5px;vertical-align:middle">' : ''}${fs.itemNum}</span>${fs.variation ? ' <span style="font-size:0.72rem;color:var(--text-dim)">' + fs.variation + '</span>' : ''}</td>
        <td><span class="tag">${master.itemType || '—'}</span></td>
        <td>${master.roadName || '—'}</td>
        <td>${fs.condition || '—'}</td>
        <td class="market-val" style="color:#e67e22">${fs.askingPrice ? '$' + parseFloat(fs.askingPrice).toLocaleString() : '—'}</td>
        <td class="text-dim">${estWorth ? '$' + parseFloat(estWorth).toLocaleString() : '—'}</td>
        <td class="text-dim">${fs.dateListed || '—'}</td>
        <td style="white-space:nowrap">
          ${!_fsDInShare ? `<button onclick="markForSaleAsSold('${fs.itemNum}','${(fs.variation||'').replace(/'/g,"\\'")}','${fs.askingPrice||''}')" style="padding:0.3rem 0.5rem;border-radius:5px;font-size:0.72rem;cursor:pointer;border:1px solid #2ecc71;background:rgba(46,204,113,0.12);color:#2ecc71;font-family:var(--font-body);margin-right:0.3rem">Mark as Sold</button>
          <button onclick="removeForSaleItem('${fs.itemNum}','${(fs.variation||'').replace(/'/g,"\\'")}',${fs.row})" style="padding:0.3rem 0.5rem;border-radius:5px;font-size:0.72rem;cursor:pointer;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body);margin-right:0.3rem">Back to Collection</button>
          <button onclick="removeForSaleAndCollection('${fs.itemNum}','${(fs.variation||'').replace(/'/g,"\\'")}',${fs.row})" style="padding:0.3rem 0.5rem;border-radius:5px;font-size:0.72rem;cursor:pointer;border:1px solid #e74c3c;background:rgba(231,76,60,0.10);color:#e74c3c;font-family:var(--font-body)">Remove</button>` : ''}
        </td>
      </tr>`;
    }).join('') : '<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">🏷️</div><p>No items listed for sale</p></div></td></tr>';
  }

  const navBadge = document.getElementById('nav-forsale');
  if (navBadge) navBadge.textContent = fsEntries.length;
}

async function markForSaleAsSold(itemNum, variation, askingPrice) {
  const salePrice = prompt('Sale price? (leave blank for asking price)', askingPrice || '');
  if (salePrice === null) return; // cancelled
  const dateSold = new Date().toISOString().split('T')[0];
  const fsKey = `${itemNum}|${variation}`;
  const fs = state.forSaleData[fsKey] || {};

  // Write to Sold tab
  const soldRow = [
    itemNum, variation, '1',
    fs.condition || '',
    fs.originalPrice || '',
    salePrice || askingPrice || '',
    dateSold,
    fs.notes || '',
    fs.inventoryId || '',
    fs.manufacturer || _getEraManufacturer(),
  ];
  const existingSold = state.soldData[fsKey];
  if (existingSold?.row) {
    await sheetsUpdate(state.personalSheetId, `Sold!A${existingSold.row}:J${existingSold.row}`, [soldRow]);
  } else {
    await sheetsAppend(state.personalSheetId, 'Sold!A:J', [soldRow]);
  }

  // Remove from For Sale tab
  if (fs.row) {
    await sheetsUpdate(state.personalSheetId, `For Sale!A${fs.row}:J${fs.row}`, [['','','','','','','','','','']]);
  }

  // Remove from My Collection — match by inventoryId (which is now the state key)
  let collKey = null;
  if (fs.inventoryId && state.personalData[fs.inventoryId]) {
    collKey = fs.inventoryId;
  }
  if (!collKey) {
    collKey = findPDKey(itemNum, variation);
  }
  const collEntry = collKey ? state.personalData[collKey] : null;
  if (collEntry?.row) {
    await sheetsUpdate(state.personalSheetId, `My Collection!A${collEntry.row}:Y${collEntry.row}`, [['','','','','','','','','','','','','','','','','','','','','','','','','']]);
    delete state.personalData[collKey];
  }

  // Optimistic state update
  state.soldData[fsKey] = { row: existingSold?.row || 99999, itemNum, variation, condition: fs.condition, salePrice: salePrice || askingPrice, dateSold, notes: fs.notes };
  delete state.forSaleData[fsKey];

  _cachePersonalData();

  buildForSalePage();
  buildSoldPage();
  buildDashboard();
  showToast('✓ Marked as sold!');
}

// Remove from For Sale list (called from My Collection row button)
async function _removeForSaleFromCollection(itemNum, variation) {
  const fsKey = `${itemNum}|${variation||''}`;
  const fs = state.forSaleData[fsKey];
  if (!fs) { showToast('Item not found on For Sale list'); return; }
  if (fs.row) {
    await sheetsUpdate(state.personalSheetId, `For Sale!A${fs.row}:J${fs.row}`, [['','','','','','','','','','']]);
  }
  delete state.forSaleData[fsKey];
  _cachePersonalData();
  showToast('✓ Removed from For Sale');
  renderBrowse();
  buildDashboard();
}

// Remove from Upgrade list (called from My Collection row button)
async function _removeUpgradeFromCollection(itemNum, variation) {
  const key = `${itemNum}|${variation||''}`;
  const ug = state.upgradeData[key];
  if (!ug) { showToast('Item not found on Upgrade list'); return; }
  if (ug.row) {
    await sheetsUpdate(state.personalSheetId, `Upgrade List!A${ug.row}:H${ug.row}`, [['','','','','','','','']]);
  }
  delete state.upgradeData[key];
  _cachePersonalData();
  showToast('✓ Removed from Upgrade List');
  renderBrowse();
  buildDashboard();
  const badge = document.getElementById('nav-upgrade-count');
  if (badge) { const c = Object.values(state.upgradeData).length; badge.textContent = c > 0 ? c : '—'; }
}

async function removeForSaleItem(itemNum, variation, row) {
  if (!(await appConfirm('Remove this item from your For Sale list?', { danger: true, ok: 'Remove' }))) return;
  const fsKey = `${itemNum}|${variation}`;
  if (row) {
    await sheetsUpdate(state.personalSheetId, `For Sale!A${row}:J${row}`, [['','','','','','','','','','']]);
  }
  delete state.forSaleData[fsKey];
  _cachePersonalData();
  buildForSalePage();
  showToast('✓ Removed from For Sale');
}

async function _removeForSaleFromDetail(idx, itemNum, variation) {
  const fsKey = `${itemNum}|${variation}`;
  const fsEntry = state.forSaleData[fsKey];
  if (!fsEntry) { showToast('Item is not on For Sale list'); return; }
  if (!(await appConfirm('Remove No. ' + itemNum + ' from your For Sale list?', { danger: true, ok: 'Remove' }))) return;
  if (fsEntry.row) {
    await sheetsUpdate(state.personalSheetId, `For Sale!A${fsEntry.row}:J${fsEntry.row}`, [['','','','','','','','','','']]);
  }
  delete state.forSaleData[fsKey];
  _cachePersonalData();
  buildForSalePage();
  renderBrowse();
  showToast('✓ Removed from For Sale');
  showItemDetailPage(idx);
}

async function removeForSaleAndCollection(itemNum, variation, fsRow) {
  if (!(await appConfirm('Remove this item from For Sale AND your collection? This cannot be undone.', { danger: true, ok: 'Remove Both' }))) return;
  const key = `${itemNum}|${variation}`;
  // Remove from For Sale tab
  if (fsRow) {
    await sheetsUpdate(state.personalSheetId, `For Sale!A${fsRow}:J${fsRow}`, [['','','','','','','','','','']]);
  }
  delete state.forSaleData[key];
  // Remove from My Collection tab — use findPDKey for correct 3-part key
  const collKey = findPDKey(itemNum, variation);
  const collEntry = collKey ? state.personalData[collKey] : null;
  if (collEntry && collEntry.row) {
    await sheetsUpdate(state.personalSheetId, `My Collection!A${collEntry.row}:Y${collEntry.row}`, [['','','','','','','','','','','','','','','','','','','','','','','','','']]);  // 25 cols A-Y
  }
  if (collKey) delete state.personalData[collKey];
  _cachePersonalData();
  buildForSalePage();
  buildDashboard();
  renderBrowse();
  showToast('✓ Item removed');
}

function showPage(name, clickedEl) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.mobile-nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  if (clickedEl) clickedEl.classList.add('active');
  if (name === 'browse') renderBrowse();
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

// ── SETS PAGE ────────────────────────────────────────────────────────────────
function buildSetsPage() {
  const isMobile = window.innerWidth <= 640;
  const sq = (state._setsSearch || '').toLowerCase();
  const yearFilter  = (document.getElementById('sets-filter-year')?.value  || '').trim();
  const gaugeFilter = (document.getElementById('sets-filter-gauge')?.value || '').trim();

  // Populate year + gauge dropdowns on first call
  const yearEl  = document.getElementById('sets-filter-year');
  const gaugeEl = document.getElementById('sets-filter-gauge');
  if (yearEl && yearEl.options.length <= 1) {
    const years = [...new Set(state.setData.map(s => s.year).filter(Boolean))].sort();
    years.forEach(y => {
      const o = document.createElement('option'); o.value = y; o.textContent = y; yearEl.appendChild(o);
    });
  }
  if (gaugeEl && gaugeEl.options.length <= 1) {
    const gauges = [...new Set(state.setData.map(s => s.gauge).filter(Boolean))].sort();
    gauges.forEach(g => {
      const o = document.createElement('option'); o.value = g; o.textContent = g; gaugeEl.appendChild(o);
    });
  }

  // Restore saved filter values
  if (yearEl  && yearFilter)  yearEl.value  = yearFilter;
  if (gaugeEl && gaugeFilter) gaugeEl.value = gaugeFilter;

  // Filter
  const entries = state.setData.filter(s => {
    if (yearFilter  && s.year  !== yearFilter)  return false;
    if (gaugeFilter && s.gauge !== gaugeFilter) return false;
    if (sq) {
      const hay = (s.setNum + ' ' + s.setName + ' ' + s.year + ' ' + s.items.join(' ') + ' ' + s.alts.join(' ') + ' ' + s.notes).toLowerCase();
      if (!hay.includes(sq)) return false;
    }
    return true;
  });

  // Update count badge + label
  const badge = document.getElementById('nav-sets-count');
  if (badge) badge.textContent = state.setData.length.toLocaleString();
  const countLbl = document.getElementById('sets-count-label');
  if (countLbl) countLbl.textContent = entries.length + ' of ' + state.setData.length + ' sets';

  const cardsEl    = document.getElementById('sets-cards');
  const tableWrap  = document.getElementById('sets-table-wrap');
  const tbody      = document.getElementById('sets-tbody');

  // ── Helper: build component chips HTML ──────────────────────────
  function _chips(items, alts, sq) {
    const allItems = items.slice(0, 8);
    const more = items.length > 8 ? items.length - 8 : 0;
    return allItems.map(n => {
      const isMatch = sq && n.toLowerCase().includes(sq);
      return '<span style="font-family:var(--font-mono);font-size:0.68rem;padding:1px 5px;border-radius:3px;border:1px solid '
        + (isMatch ? '#2980b9' : 'var(--border)')
        + ';background:' + (isMatch ? 'rgba(41,128,185,0.12)' : 'var(--surface)')
        + ';color:' + (isMatch ? '#2980b9' : 'var(--text-dim)') + ';font-weight:' + (isMatch ? '700' : '400') + '">' + n + '</span>';
    }).join('') + (more ? '<span style="font-size:0.68rem;color:var(--text-dim)">+' + more + ' more</span>' : '');
  }

  // ── Helper: action buttons ───────────────────────────────────────
  function _actions(s, small) {
    const esc = s.setNum.replace(/'/g,"\'");
    const escName = (s.setName||'').replace(/'/g,"\'");
    const p = small ? '0.28rem 0.45rem' : '0.3rem 0.55rem';
    const fs = small ? '0.7rem' : '0.72rem';
    const alreadyWanted = !!state.wantData[s.setNum + '|'];
    const wantBtn = alreadyWanted
      ? '<span style="font-size:' + fs + ';color:var(--text-dim);padding:' + p + '">✓ On Want List</span>'
      : '<button onclick="addSetToWantList(\'' + esc + '\',\'' + escName + '\')" style="padding:' + p + ';border-radius:5px;font-size:' + fs + ';cursor:pointer;border:1px solid #2ecc71;background:rgba(46,204,113,0.12);color:#2ecc71;font-family:var(--font-body);font-weight:600;margin-right:0.25rem">+ Want List</button>';
    const browseBtn = '<button onclick="showSetDetail(\'' + esc + '\')" style="padding:' + p + ';border-radius:5px;font-size:' + fs + ';cursor:pointer;border:1px solid #2980b9;background:rgba(41,128,185,0.12);color:#2980b9;font-family:var(--font-body);margin-right:0.25rem">View Full Set</button>';
    return wantBtn + browseBtn;
  }

  if (entries.length === 0) {
    const empty = '<div style="text-align:center;padding:3rem 1rem;color:var(--text-dim)"><div style="font-size:2.5rem;margin-bottom:0.5rem">🎁</div><p>No sets found</p></div>';
    if (cardsEl) cardsEl.innerHTML = empty;
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="ui-empty">No sets found</td></tr>';
    return;
  }

  if (isMobile) {
    if (tableWrap) tableWrap.style.display = 'none';
    if (cardsEl)   { cardsEl.style.display = 'flex'; }
    cardsEl.innerHTML = entries.map(s => {
      const label = [s.setName, s.gauge].filter(Boolean).join(' · ');
      return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:0.85rem 1rem">'
        + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:0.5rem;margin-bottom:0.4rem">'
        + '<div>'
        + '<span style="font-family:var(--font-head);font-size:1.1rem;color:#d35400">' + s.setNum + '</span>'
        + (s.year ? ' <span style="font-size:0.72rem;color:var(--text-dim)">' + s.year + '</span>' : '')
        + (label ? '<div style="font-size:0.82rem;color:var(--text);margin-top:0.1rem">' + label + '</div>' : '')
        + '</div></div>'
        + '<div style="display:flex;flex-wrap:wrap;gap:0.2rem;margin-bottom:0.55rem">' + _chips(s.items, s.alts, sq) + '</div>'
        + (s.notes ? '<div style="font-size:0.72rem;color:var(--text-dim);margin-bottom:0.45rem;font-style:italic">' + s.notes + '</div>' : '')
        + '<div style="display:flex;gap:0.35rem;flex-wrap:wrap">' + _actions(s, true) + '</div>'
        + '</div>';
    }).join('');
  } else {
    if (tableWrap) tableWrap.style.display = '';
    if (cardsEl)   cardsEl.style.display = 'none';
    tbody.innerHTML = entries.map(s => {
      return '<tr>'
        + '<td><span style="font-family:var(--font-mono);font-weight:700;color:#d35400;font-size:0.92rem">' + s.setNum + '</span></td>'
        + '<td>' + (s.setName || '<span class="text-dim">—</span>') + '</td>'
        + '<td>' + (s.year    || '<span class="text-dim">—</span>') + '</td>'
        + '<td>' + (s.gauge   || '<span class="text-dim">—</span>') + '</td>'
        + '<td><div style="display:flex;flex-wrap:wrap;gap:0.2rem;align-items:center">' + _chips(s.items, s.alts, sq) + '</div></td>'
        + '<td style="white-space:nowrap">' + _actions(s, false) + '</td>'
        + '</tr>';
    }).join('') || '<tr><td colspan="6" class="ui-empty">No sets found</td></tr>';
  }
}

function addSetToCollection(setNum, setName) {
  _buildWizardModal();
  const _activePg = document.querySelector('.page.active');
  const _returnPage = _activePg ? _activePg.id.replace('page-', '') : 'sets';
  // Set wizard.data FIRST so getSteps('set') can branch correctly
  wizard = {
    step: 0, tab: 'set',
    data: {
      tab: 'set',
      set_knowsNum: 'Yes',
      set_num: setNum,
      _resolvedSet: state.setData.find(s => s.setNum === setNum) || null,
      _returnPage: _returnPage
    },
    steps: [],
    matchedItem: null
  };
  // Pre-populate set item list and group ID (normally done in set_components step)
  const _resolvedSet = wizard.data._resolvedSet;
  if (_resolvedSet && _resolvedSet.items) {
    wizard.data._setFinalItems = [..._resolvedSet.items];
    wizard.data._setItemIndex = 0;
    wizard.data._setGroupId = 'SET-' + setNum + '-' + Date.now();
    wizard.data._setItemsSaved = [];
  }
  wizard.steps = getSteps('set'); // called after data is set
  // Skip set_knowsNum, set_num, set_loco, and set_components — already resolved
  const autoSkip = new Set(['set_knowsNum', 'set_num', 'set_loco', 'set_components']);
  while (wizard.step < wizard.steps.length) {
    const cur = wizard.steps[wizard.step];
    if (!autoSkip.has(cur.id)) break;
    wizard.step++;
  }
  document.getElementById('wizard-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
  renderWizardStep();
}


function addSetToWantList(setNum, setName) {
  // Open the want wizard pre-filled as a set
  const _activePg = document.querySelector('.page.active');
  const _returnPage = _activePg ? _activePg.id.replace('page-', '') : 'sets';
  // Set data FIRST so getSteps('want') sees itemCategory:'set' when it branches
  wizard = {
    step: 0, tab: 'want',
    data: {
      tab: 'want',
      itemCategory: 'set',
      want_set_num: setNum,
      itemNum: setNum,
      _resolvedSet: state.setData.find(s => s.setNum === setNum) || null,
      _returnPage: _returnPage
    },
    steps: [],
    matchedItem: null
  };
  wizard.steps = getSteps('want'); // called AFTER wizard.data is set so branching works
  // Skip past itemCategory + want_set_knowsNum + want_set_num steps (already filled)
  const autoSkip = new Set(['itemCategory','want_set_knowsNum','want_set_num','want_set_identify']);
  while (wizard.step < wizard.steps.length) {
    const curStep = wizard.steps[wizard.step];
    if (!autoSkip.has(curStep.id)) break;
    wizard.step++;
  }
  document.getElementById('wizard-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
  renderWizardStep();
}

function showSetDetail(setNum) {
  const s = state.setData.find(x => x.setNum === setNum);
  if (!s) return;

  const existing = document.getElementById('set-detail-popup');
  if (existing) existing.remove();

  // ── Overlay ──
  const overlay = document.createElement('div');
  overlay.id = 'set-detail-popup';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1.25rem';
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };

  // ── Box ──
  const box = document.createElement('div');
  box.style.cssText = 'background:var(--surface);border:1px solid var(--border);border-radius:14px;max-width:560px;width:100%;padding:1.5rem;position:relative;max-height:85vh;overflow-y:auto';

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = 'position:absolute;top:0.75rem;right:0.75rem;background:none;border:none;color:var(--text-dim);font-size:1.1rem;cursor:pointer;z-index:1';
  closeBtn.onclick = () => overlay.remove();
  box.appendChild(closeBtn);

  // ── Header ──
  const hdr = document.createElement('div');
  hdr.style.cssText = 'margin-bottom:1rem;padding-right:2rem';
  hdr.innerHTML =
    '<div style="display:flex;align-items:baseline;gap:0.6rem;flex-wrap:wrap;margin-bottom:0.25rem">'
    + '<span style="font-family:var(--font-head);font-size:1.4rem;color:#d35400">' + s.setNum + '</span>'
    + (s.setName ? '<span style="font-size:1rem;color:var(--text);font-weight:600">' + s.setName + '</span>' : '')
    + '</div>'
    + '<div style="display:flex;gap:0.75rem;flex-wrap:wrap;font-size:0.78rem;color:var(--text-dim)">'
    + (s.year  ? '<span>📅 ' + s.year  + '</span>' : '')
    + (s.gauge ? '<span>🔧 ' + s.gauge + '</span>' : '')
    + (s.price ? '<span>💰 Original price: ' + s.price + '</span>' : '')
    + '</div>';
  box.appendChild(hdr);

  // ── Divider ──
  const div1 = document.createElement('hr');
  div1.style.cssText = 'border:none;border-top:1px solid var(--border);margin:0 0 1rem 0';
  box.appendChild(div1);

  // ── Components ──
  const compHdr = document.createElement('div');
  compHdr.style.cssText = 'font-size:0.68rem;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;color:var(--text-dim);margin-bottom:0.5rem';
  compHdr.textContent = 'Components (' + s.items.length + ' items)';
  box.appendChild(compHdr);

  const chipsWrap = document.createElement('div');
  chipsWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.3rem;margin-bottom:' + (s.alts.length ? '0.9rem' : (s.notes ? '0.9rem' : '0')) + ';';
  s.items.forEach(n => {
    // Look up the item name from master data for a richer chip
    const master = findMaster(n);
    const label = master ? (master.roadName || master.description || master.itemType || '') : '';
    const chip = document.createElement('div');
    chip.style.cssText = 'display:flex;flex-direction:column;background:var(--surface2);border:1px solid var(--border);border-radius:7px;padding:0.3rem 0.55rem;cursor:default';
    chip.innerHTML =
      '<span style="font-family:var(--font-mono);font-size:0.78rem;font-weight:700;color:#d35400">' + n + '</span>'
      + (label ? '<span style="font-size:0.65rem;color:var(--text-dim);margin-top:1px">' + label + '</span>' : '');
    chipsWrap.appendChild(chip);
  });
  box.appendChild(chipsWrap);

  // ── Alternate items (if any) ──
  if (s.alts && s.alts.length) {
    const altHdr = document.createElement('div');
    altHdr.style.cssText = 'font-size:0.68rem;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;color:var(--text-dim);margin:0.9rem 0 0.4rem';
    altHdr.textContent = 'Alternate / Optional Items';
    box.appendChild(altHdr);
    const altWrap = document.createElement('div');
    altWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.3rem;margin-bottom:' + (s.notes ? '0.9rem' : '0') + ';';
    s.alts.forEach(n => {
      const chip = document.createElement('span');
      chip.style.cssText = 'font-family:var(--font-mono);font-size:0.75rem;padding:2px 7px;border-radius:5px;border:1px dashed var(--border);color:var(--text-dim)';
      chip.textContent = n;
      altWrap.appendChild(chip);
    });
    box.appendChild(altWrap);
  }

  // ── Notes ──
  if (s.notes) {
    const notesHdr = document.createElement('div');
    notesHdr.style.cssText = 'font-size:0.68rem;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;color:var(--text-dim);margin:0.9rem 0 0.35rem';
    notesHdr.textContent = 'Notes';
    box.appendChild(notesHdr);
    const notesEl = document.createElement('div');
    notesEl.style.cssText = 'font-size:0.85rem;color:var(--text);line-height:1.6;font-style:italic';
    notesEl.textContent = s.notes;
    box.appendChild(notesEl);
  }

  // ── Footer action ──
  const footer = document.createElement('div');
  footer.style.cssText = 'margin-top:1.25rem;padding-top:0.9rem;border-top:1px solid var(--border);display:flex;gap:0.5rem;justify-content:flex-end';

  // Add to Collection button (always shown)
  const collBtn = document.createElement('button');
  collBtn.textContent = '+ Add to Collection';
  collBtn.style.cssText = 'padding:0.45rem 0.9rem;border-radius:7px;border:1.5px solid var(--accent);background:rgba(240,80,8,0.1);color:var(--accent);font-family:var(--font-body);font-size:0.82rem;font-weight:600;cursor:pointer';
  collBtn.onclick = () => { overlay.remove(); addSetToCollection(s.setNum, s.setName || ''); };
  footer.appendChild(collBtn);

  // Add to Want List button
  const alreadyWanted = !!state.wantData[s.setNum + '|'];
  if (!alreadyWanted) {
    const wantBtn = document.createElement('button');
    wantBtn.textContent = '+ Want List';
    wantBtn.style.cssText = 'padding:0.45rem 0.9rem;border-radius:7px;border:1.5px solid #2ecc71;background:rgba(46,204,113,0.12);color:#2ecc71;font-family:var(--font-body);font-size:0.82rem;font-weight:600;cursor:pointer';
    wantBtn.onclick = () => { overlay.remove(); addSetToWantList(s.setNum, s.setName || ''); };
    footer.appendChild(wantBtn);
  } else {
    const wantedLbl = document.createElement('span');
    wantedLbl.style.cssText = 'font-size:0.8rem;color:var(--text-dim);align-self:center';
    wantedLbl.textContent = '✓ On Want List';
    footer.appendChild(wantedLbl);
  }
  const doneBtn = document.createElement('button');
  doneBtn.textContent = 'Close';
  doneBtn.style.cssText = 'padding:0.45rem 0.9rem;border-radius:7px;border:1px solid var(--border);background:var(--surface2);color:var(--text-mid);font-family:var(--font-body);font-size:0.82rem;cursor:pointer';
  doneBtn.onclick = () => overlay.remove();
  footer.appendChild(doneBtn);
  box.appendChild(footer);

  overlay.appendChild(box);
  document.body.appendChild(overlay);
}


function _dismissDisclaimer() {
  _prefSet('lv_show_disclaimer', 'false');
  _applyDisclaimerPref();
  // Keep prefs toggle in sync if prefs page is open
  const tog = document.getElementById('ptog-disclaimer');
  if (tog) tog.checked = false;
}

function _applyDisclaimerPref() {
  const show = _prefGet('lv_show_disclaimer', 'true') === 'true';
  const d1 = document.getElementById('disclaimer-browse');
  const d2 = document.getElementById('disclaimer-sets');
  if (d1) d1.style.display = show ? 'flex' : 'none';
  if (d2) d2.style.display = show ? 'flex' : 'none';
}

function _buildContactModal() {
  if (document.getElementById('contact-modal')) return;
  var d = document.createElement('div');
  d.id = 'contact-modal';
  d.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:10000;align-items:center;justify-content:center;padding:1.25rem';
  d.innerHTML =
    '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;max-width:420px;width:100%;padding:1.75rem;position:relative">' +
      '<button onclick="document.getElementById(\'contact-modal\').style.display=\'none\'" style="position:absolute;top:0.75rem;right:0.75rem;background:none;border:none;color:var(--text-dim);font-size:1.1rem;cursor:pointer">&#x2715;</button>' +
      '<div style="font-family:var(--font-head);font-size:1.2rem;color:var(--accent);margin-bottom:0.4rem">&#x1F4EC; Contact Us</div>' +
      '<p style="font-size:0.88rem;color:var(--text);line-height:1.65;margin-bottom:1rem">' +
        'Found an error in the catalog or set list? Have a suggestion? We\'d love to hear from you.' +
      '</p>' +
      '<a href="mailto:' + ADMIN_EMAIL + '" style="display:inline-flex;align-items:center;gap:0.5rem;padding:0.6rem 1.1rem;border-radius:8px;background:var(--accent);color:white;font-family:var(--font-body);font-size:0.88rem;font-weight:600;text-decoration:none">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>' +
        'Send an Email' +
      '</a>' +
      '<p style="font-size:0.75rem;color:var(--text-dim);margin-top:1rem;line-height:1.5">' +
        'This is a community resource for postwar collectors. We appreciate every correction and suggestion.' +
      '</p>' +
    '</div>';
  d.addEventListener('click', function(e) { if (e.target === d) d.style.display = 'none'; });
  document.body.appendChild(d);
}

function showContactModal() {
  _buildContactModal();
  const m = document.getElementById('contact-modal');
  if (m) { m.style.display = 'flex'; }
}


// ══════════════════════════════════════════════════════════════════
// UPGRADE LIST
// ══════════════════════════════════════════════════════════════════

function buildUpgradePage() {
  const isMobile = window.innerWidth <= 640;
  const _uq = (state._upgradeSearch || '').toLowerCase();
  const _sort = state._upgradeSort || 'priority';
  const _up = state._upgradePriority || '';
  const thresh = parseInt(_prefGet('lv_upgrade_thresh', '7'));
  const _threshFilter = state._upgradeThreshFilter !== false; // default on
  // Sync dropdowns with state
  const _upEl = document.getElementById('upgrade-priority-filter');
  if (_upEl && _upEl.value !== _up) _upEl.value = _up;
  const totalCount = Object.keys(state.upgradeData).length;

  let entries = Object.values(state.upgradeData).filter(u => {
    // Priority filter
    if (_up && (u.priority || 'Medium') !== _up) return false;
    if (_uq) {
      const master = findMaster(u.itemNum) || {};
      if (!(u.itemNum||'').toLowerCase().includes(_uq)
        && !(master.roadName||'').toLowerCase().includes(_uq)
        && !(u.notes||'').toLowerCase().includes(_uq)) return false;
    }
    if (_threshFilter) {
      const pd = Object.values(state.personalData).find(p => p.owned && p.itemNum === u.itemNum && (p.variation||'') === (u.variation||''));
      const cond = pd && pd.condition ? parseInt(pd.condition) : null;
      if (cond !== null && cond > thresh) return false;
    }
    return true;
  });

  const priorityOrder = { High: 0, Medium: 1, Low: 2 };
  if (_sort === 'priority') {
    entries.sort((a, b) => (priorityOrder[a.priority]??1) - (priorityOrder[b.priority]??1));
  } else if (_sort === 'condition') {
    entries.sort((a, b) => {
      const getC = u => { const pd = Object.values(state.personalData).find(p => p.owned && p.itemNum === u.itemNum && (p.variation||'') === (u.variation||'')); return pd && pd.condition ? parseInt(pd.condition) : 99; };
      return getC(a) - getC(b);
    });
  } else {
    entries.sort((a, b) => (a.itemNum||'').localeCompare(b.itemNum||'', undefined, {numeric:true}));
  }

  // Update badge
  const badge = document.getElementById('nav-upgrade-count');
  if (badge) badge.textContent = totalCount > 0 ? totalCount : '—';
  // Count display
  const upgradeCountEl = document.getElementById('upgrade-count');
  if (upgradeCountEl) {
    upgradeCountEl.textContent = entries.length === totalCount
      ? totalCount + ' item' + (totalCount !== 1 ? 's' : '')
      : 'Showing ' + entries.length + ' of ' + totalCount;
  }

  const cardsEl = document.getElementById('upgrade-cards');
  const tableEl = document.getElementById('upgrade-table');
  const tbody   = document.getElementById('upgrade-tbody');

  const priorityColor = { High: 'var(--accent)', Medium: 'var(--accent2)', Low: 'var(--text-dim)' };

  if (entries.length === 0) {
    const hasFilters = _uq || _up || (_threshFilter && totalCount > 0);
    const emptyIcon = hasFilters ? '🔍' : '↑';
    const emptyMsg = hasFilters ? 'No items match your filters' : 'Your upgrade list is empty';
    const emptyTip = hasFilters ? 'Try adjusting your search or filters' : 'Add items from My Collection that you\'d like in better condition';
    const empty = `<div style="text-align:center;padding:3rem 1rem;color:var(--text-dim)"><div style="font-size:2.5rem;margin-bottom:0.5rem">${emptyIcon}</div><p>${emptyMsg}</p><p style="font-size:0.8rem;margin-top:0.5rem">${emptyTip}</p></div>`;
    if (cardsEl) cardsEl.innerHTML = empty;
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="ui-empty">' + emptyMsg + '</td></tr>';
    return;
  }

  if (isMobile) {
    if (tableEl) tableEl.style.display = 'none';
    if (cardsEl) cardsEl.style.display = 'flex';
    cardsEl.innerHTML = entries.map(u => {
      const pd = Object.values(state.personalData).find(p => p.owned && p.itemNum === u.itemNum && (p.variation||'') === (u.variation||''));
      const master = findMaster(u.itemNum);
      const name = master ? (master.roadName || master.itemType || '') : '';
      const cond = pd && pd.condition ? parseInt(pd.condition) : null;
      const condClass = cond >= 9 ? 'cond-9' : cond >= 7 ? 'cond-7' : cond >= 5 ? 'cond-5' : cond ? 'cond-low' : '';
      const pColor = priorityColor[u.priority] || 'var(--text-dim)';
      const escVar = (u.variation||'').replace(/'/g,"\\'");
      const photoId = `upgphoto-m-${u.itemNum}-${u.variation||''}`.replace(/[^a-zA-Z0-9-]/g,'_');
      const hasPhoto = pd && !!pd.photoItem;
      return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:0.85rem 1rem">
        <div style="display:flex;align-items:flex-start;gap:0.5rem">
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap">
              <span style="font-family:var(--font-head);font-size:1.1rem;color:var(--accent)">${u.itemNum}</span>
              ${u.variation ? `<span style="font-size:0.72rem;color:var(--text-dim)">${u.variation}</span>` : ''}
              <span style="font-size:0.65rem;font-weight:600;color:${pColor};border:1px solid ${pColor};border-radius:4px;padding:0.1rem 0.4rem">${u.priority||'Medium'}</span>
            </div>
            ${name ? `<div style="font-size:0.82rem;color:var(--text);margin-top:0.1rem">${name}</div>` : ''}
            <div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.25rem;flex-wrap:wrap">
              ${cond !== null ? `<span style="font-size:0.75rem"><span class="condition-pip ${condClass}"></span>Mine: ${cond}</span>` : ''}
              ${u.targetCondition ? `<span style="font-size:0.75rem;color:#8b5cf6">→ Target: ${u.targetCondition}</span>` : ''}
              ${u.maxPrice ? `<span style="font-size:0.75rem;color:var(--accent2);font-family:var(--font-mono)">Max: $${parseFloat(u.maxPrice).toLocaleString()}</span>` : ''}
            </div>
            ${u.notes ? `<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.15rem">${u.notes}</div>` : ''}
          </div>
          ${hasPhoto ? `<button onclick="event.stopPropagation();_toggleUpgradePhoto('${photoId}','${pd.photoItem.replace(/'/g,"\\'")}')" style="background:none;border:none;font-size:1.1rem;cursor:pointer;flex-shrink:0" title="View my photo">📷</button>` : ''}
        </div>
        <div id="${photoId}" style="display:none;margin-top:0.5rem"><img src="${pd && pd.photoItem ? pd.photoItem : ''}" style="max-width:100%;max-height:180px;border-radius:8px;object-fit:contain" onerror="this.parentElement.style.display='none'"></div>
        <div style="display:flex;gap:0.35rem;margin-top:0.6rem;flex-wrap:wrap">
          <button onclick="event.stopPropagation();_upgradeViewMine('${u.itemNum}','${escVar}')" style="flex:1;min-width:0;padding:0.4rem 0.3rem;border-radius:7px;font-size:0.72rem;cursor:pointer;border:1.5px solid #8b5cf6;background:rgba(139,92,246,0.1);color:#8b5cf6;font-family:var(--font-body);font-weight:600">View Mine</button>
          <button onclick="event.stopPropagation();wantFindOnEbay('${u.itemNum}','${(name||'').replace(/'/g,"\\'")}')" style="flex:1;min-width:0;padding:0.4rem 0.3rem;border-radius:7px;font-size:0.72rem;cursor:pointer;border:1.5px solid #e67e22;background:rgba(230,126,34,0.12);color:#e67e22;font-family:var(--font-body);font-weight:600">eBay</button>
          <button onclick="event.stopPropagation();wantSearchOtherSites('${u.itemNum}','${(name||'').replace(/'/g,"\\'")}')" style="flex:1;min-width:0;padding:0.4rem 0.3rem;border-radius:7px;font-size:0.72rem;cursor:pointer;border:1.5px solid #2980b9;background:rgba(41,128,185,0.12);color:#2980b9;font-family:var(--font-body);font-weight:600">Search</button>
          <button onclick="event.stopPropagation();upgradeGotIt('${u.itemNum}','${escVar}')" style="flex:1;min-width:0;padding:0.4rem 0.3rem;border-radius:7px;font-size:0.72rem;cursor:pointer;border:1.5px solid #2ecc71;background:rgba(46,204,113,0.12);color:#2ecc71;font-family:var(--font-body);font-weight:600">✓ Got It</button>
          <button onclick="event.stopPropagation();removeUpgradeItem('${u.itemNum}','${escVar}',${u.row})" style="flex:0 0 auto;padding:0.4rem 0.6rem;border-radius:7px;font-size:0.72rem;cursor:pointer;border:1.5px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body)">Remove</button>
        </div>
      </div>`;
    }).join('');
  } else {
    if (tableEl) tableEl.style.display = '';
    if (cardsEl) cardsEl.style.display = 'none';
    tbody.innerHTML = entries.map((u, idx) => {
      const pd = Object.values(state.personalData).find(p => p.owned && p.itemNum === u.itemNum && (p.variation||'') === (u.variation||''));
      const master = findMaster(u.itemNum);
      const name = master ? (master.roadName || master.itemType || '') : '';
      const cond = pd && pd.condition ? parseInt(pd.condition) : null;
      const condClass = cond >= 9 ? 'cond-9' : cond >= 7 ? 'cond-7' : cond >= 5 ? 'cond-5' : cond ? 'cond-low' : '';
      const pColor = priorityColor[u.priority] || 'var(--text-dim)';
      const escVar = (u.variation||'').replace(/'/g,"\\'");
      const hasPhoto = pd && !!pd.photoItem;
      const photoId = `upgphoto-d-${idx}`;
      return `<tr>
        <td><span class="item-num">${u.itemNum}</span>${u.variation ? ' <span style="font-size:0.72rem;color:var(--text-dim)">' + u.variation + '</span>' : ''}</td>
        <td style="color:var(--text-mid)">${name || '<span class="text-dim">—</span>'}</td>
        <td>${cond !== null ? `<span class="condition-pip ${condClass}" style="margin-right:3px"></span>${cond}` : '<span class="text-dim">—</span>'}</td>
        <td style="color:#8b5cf6;font-weight:600">${u.targetCondition || '<span class="text-dim">—</span>'}</td>
        <td><span style="color:${pColor};font-weight:500">${u.priority||'Medium'}</span></td>
        <td class="market-val">${u.maxPrice ? '$' + parseFloat(u.maxPrice).toLocaleString() : '<span class="text-dim">—</span>'}</td>
        <td style="font-size:0.8rem;color:var(--text-dim);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(u.notes||'').replace(/"/g,'&quot;')}">${u.notes || '<span class="text-dim">—</span>'}</td>
        <td style="white-space:nowrap">
          ${hasPhoto ? `<button onclick="event.stopPropagation();_toggleUpgradePhoto('${photoId}','${(pd.photoItem||'').replace(/'/g,"\\'")}')" style="padding:0.25rem 0.4rem;border-radius:5px;font-size:0.72rem;cursor:pointer;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);margin-right:0.2rem" title="Toggle photo">📷</button>` : ''}
          <button onclick="_upgradeViewMine('${u.itemNum}','${escVar}')" style="padding:0.25rem 0.45rem;border-radius:5px;font-size:0.72rem;cursor:pointer;border:1px solid #8b5cf6;background:rgba(139,92,246,0.1);color:#8b5cf6;font-family:var(--font-body);font-weight:600;margin-right:0.2rem">View Mine</button>
          <button onclick="wantFindOnEbay('${u.itemNum}','${(name||'').replace(/'/g,"\\'")}')" style="padding:0.25rem 0.45rem;border-radius:5px;font-size:0.72rem;cursor:pointer;border:1px solid #e67e22;background:rgba(230,126,34,0.12);color:#e67e22;font-family:var(--font-body);margin-right:0.2rem">eBay</button>
          <button onclick="wantSearchOtherSites('${u.itemNum}','${(name||'').replace(/'/g,"\\'")}')" style="padding:0.25rem 0.45rem;border-radius:5px;font-size:0.72rem;cursor:pointer;border:1px solid #2980b9;background:rgba(41,128,185,0.12);color:#2980b9;font-family:var(--font-body);margin-right:0.2rem">Search</button>
          <button onclick="upgradeGotIt('${u.itemNum}','${escVar}')" style="padding:0.25rem 0.45rem;border-radius:5px;font-size:0.72rem;cursor:pointer;border:1px solid #2ecc71;background:rgba(46,204,113,0.12);color:#2ecc71;font-family:var(--font-body);font-weight:600;margin-right:0.2rem">✓ Got It</button>
          <button onclick="removeUpgradeItem('${u.itemNum}','${escVar}',${u.row})" style="padding:0.25rem 0.45rem;border-radius:5px;font-size:0.72rem;cursor:pointer;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body)">Remove</button>
        </td>
      </tr>
      <tr id="${photoId}-row" style="display:none"><td colspan="8" style="padding:0.5rem 1rem;background:var(--surface2)"><img src="${pd && pd.photoItem ? pd.photoItem : ''}" style="max-height:160px;border-radius:6px;object-fit:contain" onerror="this.parentElement.parentElement.style.display='none'"></td></tr>`;
    }).join('') || '<tr><td colspan="8" class="ui-empty">No items on upgrade list</td></tr>';
  }
}

function _toggleUpgradePhoto(id, photoUrl) {
  // Mobile: toggle inline div; desktop: toggle row
  const el = document.getElementById(id);
  const rowEl = document.getElementById(id + '-row');
  const target = el || rowEl;
  if (!target) return;
  const showing = target.style.display !== 'none';
  target.style.display = showing ? 'none' : '';
}

function _upgradeViewMine(itemNum, variation) {
  const master = findMaster(itemNum);
  if (master) {
    showItemDetailPage(state.masterData.indexOf(master));
  } else {
    showToast('Item not found in master catalog');
  }
}

function showAddToUpgradeModal(itemNum, variation, pdRow) {
  const existing = state.upgradeData[`${itemNum}|${variation||''}`] || {};
  let pd;
  if (pdRow) {
    pd = state.personalData[`${itemNum}|${variation||''}|${pdRow}`];
  }
  if (!pd) pd = Object.values(state.personalData).find(p => p.owned && p.itemNum === itemNum && (p.variation||'') === (variation||''));
  const master = findMaster(itemNum);
  const name = master ? (master.roadName || master.itemType || itemNum) : itemNum;
  const myCond = pd && pd.condition ? pd.condition : '';

  const old = document.getElementById('upgrade-add-modal');
  if (old) old.remove();
  const overlay = document.createElement('div');
  overlay.id = 'upgrade-add-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:10001;display:flex;align-items:center;justify-content:center;padding:1.25rem';
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };

  overlay.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;max-width:400px;width:100%;padding:1.5rem;position:relative">
      <button onclick="document.getElementById('upgrade-add-modal').remove()" style="position:absolute;top:0.75rem;right:0.75rem;background:none;border:none;color:var(--text-dim);font-size:1.1rem;cursor:pointer">✕</button>
      <div style="font-family:var(--font-head);font-size:1.15rem;color:#8b5cf6;margin-bottom:0.25rem">↑ Add to Upgrade List</div>
      <div style="font-family:var(--font-mono);font-size:0.9rem;color:var(--accent);margin-bottom:0.1rem">${itemNum}${variation ? ' <span style="color:var(--text-dim);font-size:0.8rem">' + variation + '</span>' : ''}</div>
      <div style="font-size:0.82rem;color:var(--text-mid);margin-bottom:1rem">${name}${myCond ? ' · Current condition: ' + myCond : ''}</div>
      <div style="display:flex;flex-direction:column;gap:0.75rem">
        <div>
          <label style="font-size:0.78rem;color:var(--text-dim);display:block;margin-bottom:0.25rem">Priority</label>
          <select id="upg-priority" style="width:100%;padding:0.4rem 0.5rem;border-radius:7px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.85rem">
            <option value="High" ${(existing.priority||'Medium')==='High'?'selected':''}>High</option>
            <option value="Medium" ${(existing.priority||'Medium')==='Medium'?'selected':''}>Medium</option>
            <option value="Low" ${(existing.priority||'Medium')==='Low'?'selected':''}>Low</option>
          </select>
        </div>
        <div>
          <label style="font-size:0.78rem;color:var(--text-dim);display:block;margin-bottom:0.25rem">Target Condition (1–10)</label>
          <select id="upg-target-cond" style="width:100%;padding:0.4rem 0.5rem;border-radius:7px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.85rem">
            <option value="">Not specified</option>
            ${[...Array(10)].map((_,i)=>{const v=10-i; return `<option value="${v}" ${(existing.targetCondition||'')==String(v)?'selected':''}>${v}</option>`;}).join('')}
          </select>
        </div>
        <div>
          <label style="font-size:0.78rem;color:var(--text-dim);display:block;margin-bottom:0.25rem">Max Price I'd Pay</label>
          <input id="upg-max-price" type="number" min="0" placeholder="e.g. 150" value="${existing.maxPrice||''}" style="width:100%;box-sizing:border-box;padding:0.4rem 0.5rem;border-radius:7px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-mono);font-size:0.85rem">
        </div>
        <div>
          <label style="font-size:0.78rem;color:var(--text-dim);display:block;margin-bottom:0.25rem">Notes</label>
          <textarea id="upg-notes" rows="2" placeholder="e.g. needs to have original box" style="width:100%;box-sizing:border-box;padding:0.4rem 0.5rem;border-radius:7px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.85rem;resize:vertical">${existing.notes||''}</textarea>
        </div>
        <button onclick="saveUpgradeItem('${itemNum}','${(variation||'').replace(/'/g,"\\'")}',${existing.row||0},'${pd && pd.inventoryId ? pd.inventoryId : ''}')" style="padding:0.6rem;border-radius:8px;background:#8b5cf6;color:#fff;border:none;font-family:var(--font-body);font-size:0.9rem;font-weight:600;cursor:pointer;margin-top:0.25rem">
          ${existing.row ? 'Update Upgrade Entry' : '+ Add to Upgrade List'}
        </button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

async function saveUpgradeItem(itemNum, variation, existingRow, invId) {
  const priority = document.getElementById('upg-priority')?.value || 'Medium';
  const targetCond = document.getElementById('upg-target-cond')?.value || '';
  const maxPrice = document.getElementById('upg-max-price')?.value || '';
  const notes = document.getElementById('upg-notes')?.value || '';
  const row = [itemNum, variation||'', priority, targetCond, maxPrice, notes, invId || '', _getEraManufacturer()];
  const key = `${itemNum}|${variation||''}`;
  const sheetId = state.personalSheetId;
  if (!sheetId) { showToast('Not connected to a sheet'); return; }
  try {
    if (existingRow > 0) {
      await sheetsUpdate(sheetId, `Upgrade List!A${existingRow}:H${existingRow}`, [row]);
    } else {
      await sheetsAppend(sheetId, 'Upgrade List!A:H', [row]);
    }
    // Reload data
    const res = await sheetsGet(sheetId, 'Upgrade List!A3:H');
    state.upgradeData = {};
    (res.values || []).forEach((r, idx) => {
      if (!r[0] || r[0] === 'Item Number') return;
      state.upgradeData[`${r[0]}|${r[1]||''}`] = {
        row: idx+3, itemNum: r[0]||'', variation: r[1]||'',
        priority: r[2]||'Medium', targetCondition: r[3]||'', maxPrice: r[4]||'', notes: r[5]||'',
        inventoryId: r[6]||'',
        manufacturer: r[7] || 'Lionel',
      };
    });
    const modal = document.getElementById('upgrade-add-modal');
    if (modal) modal.remove();
    showToast('✓ Added to Upgrade List');
    buildDashboard();
    const badge = document.getElementById('nav-upgrade-count');
    if (badge) badge.textContent = Object.values(state.upgradeData).length.toLocaleString();
  } catch(e) {
    showToast('Error saving — check connection');
    console.error(e);
  }
}

async function removeUpgradeItem(itemNum, variation, row) {
  const key = `${itemNum}|${variation||''}`;
  if (!state.personalSheetId) return;
  try {
    await sheetsUpdate(state.personalSheetId, `Upgrade List!A${row}:H${row}`, [['','','','','','','','']]);
    delete state.upgradeData[key];
    showToast('Removed from Upgrade List');
    buildUpgradePage();
    buildDashboard();
    const badge = document.getElementById('nav-upgrade-count');
    if (badge) { const c = Object.values(state.upgradeData).length; badge.textContent = c > 0 ? c : '—'; }
  } catch(e) {
    showToast('Error removing item');
  }
}

function upgradeGotIt(itemNum, variation) {
  const old = document.getElementById('upgrade-gotit-modal');
  if (old) old.remove();
  const master = findMaster(itemNum);
  const name = master ? (master.roadName || master.itemType || itemNum) : itemNum;
  const overlay = document.createElement('div');
  overlay.id = 'upgrade-gotit-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:10002;display:flex;align-items:center;justify-content:center;padding:1.25rem';
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  overlay.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;max-width:380px;width:100%;padding:1.5rem;position:relative">
      <button onclick="document.getElementById('upgrade-gotit-modal').remove()" style="position:absolute;top:0.75rem;right:0.75rem;background:none;border:none;color:var(--text-dim);font-size:1.1rem;cursor:pointer">✕</button>
      <div style="font-family:var(--font-head);font-size:1.15rem;color:#2ecc71;margin-bottom:0.25rem">✓ Got It!</div>
      <div style="font-family:var(--font-mono);font-size:0.88rem;color:var(--accent);margin-bottom:0.75rem">${itemNum} — ${name}</div>
      <p style="font-size:0.85rem;color:var(--text);margin-bottom:1rem;line-height:1.5">Did you already add the new one to your collection?</p>
      <div style="display:flex;gap:0.5rem;margin-bottom:1.25rem">
        <button onclick="document.getElementById('upg-gotit-added').style.display=''" style="flex:1;padding:0.5rem;border-radius:8px;border:1.5px solid #2ecc71;background:rgba(46,204,113,0.1);color:#2ecc71;font-family:var(--font-body);font-size:0.85rem;font-weight:600;cursor:pointer">Yes, it's added</button>
        <button onclick="document.getElementById('upg-gotit-added').style.display=''" style="flex:1;padding:0.5rem;border-radius:8px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body);font-size:0.85rem;cursor:pointer">Not yet</button>
      </div>
      <div id="upg-gotit-added" style="display:none">
        <p style="font-size:0.85rem;color:var(--text);margin-bottom:0.75rem;line-height:1.5">What would you like to do with your old one?</p>
        <div style="display:flex;flex-direction:column;gap:0.4rem">
          <button onclick="_upgradeGotItFinish('${itemNum}','${(variation||'').replace(/'/g,"\\'")}','keep')" style="padding:0.5rem;border-radius:8px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.85rem;cursor:pointer;text-align:left">Keep both copies</button>
          <button onclick="_upgradeGotItFinish('${itemNum}','${(variation||'').replace(/'/g,"\\'")}','forsale')" style="padding:0.5rem;border-radius:8px;border:1.5px solid #e67e22;background:rgba(230,126,34,0.08);color:#e67e22;font-family:var(--font-body);font-size:0.85rem;cursor:pointer;text-align:left">🏷️ List old one for sale</button>
          <button onclick="_upgradeGotItFinish('${itemNum}','${(variation||'').replace(/'/g,"\\'")}','remove')" style="padding:0.5rem;border-radius:8px;border:1.5px solid var(--accent);background:rgba(240,80,8,0.08);color:var(--accent);font-family:var(--font-body);font-size:0.85rem;cursor:pointer;text-align:left">Remove old entry from collection</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

async function _upgradeGotItFinish(itemNum, variation, action) {
  const modal = document.getElementById('upgrade-gotit-modal');
  if (modal) modal.remove();
  const key = `${itemNum}|${variation||''}`;
  const upgradeEntry = state.upgradeData[key];
  // Remove from upgrade list
  if (upgradeEntry) await removeUpgradeItem(itemNum, variation, upgradeEntry.row);
  if (action === 'forsale') {
    // Navigate to for sale flow for this item
    const master = findMaster(itemNum);
    const idx = master ? state.masterData.indexOf(master) : -1;
    if (idx >= 0) collectionActionForSale(idx, itemNum, variation);
    else showToast('Navigate to My Collection to list for sale');
  } else if (action === 'remove') {
    const pd = Object.values(state.personalData).find(p => p.owned && p.itemNum === itemNum && (p.variation||'') === (variation||''));
    if (pd) await removeCollectionItem(itemNum, variation, pd.row);
    else showToast('Item not found in collection');
  } else {
    showToast('✓ Upgrade complete — entry removed from list');
  }
}


// ── UTILITIES ───────────────────────────────────────────────────
function parseJwt(token) {
  const base64 = token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
  return JSON.parse(atob(base64));
}

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
function _showIOSInstallHint() {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.navigator.standalone === true;
  const dismissed = localStorage.getItem('lv_ios_hint_dismissed');
  if (!isIOS || isStandalone || dismissed) return;

  const banner = document.createElement('div');
  banner.id = 'ios-install-hint';
  banner.style.cssText = [
    'position:fixed',
    'bottom:80px',
    'left:50%',
    'transform:translateX(-50%)',
    'width:calc(100% - 2rem)',
    'max-width:380px',
    'background:#1c2544',
    'border:1.5px solid var(--border)',
    'border-radius:12px',
    'padding:0.8rem 1rem',
    'z-index:8000',
    'box-shadow:0 4px 24px rgba(0,0,0,0.5)',
    'display:flex',
    'align-items:center',
    'gap:0.75rem',
    'animation:fadeIn 0.3s ease'
  ].join(';');

  banner.innerHTML = `
    <div style="font-size:1.4rem;flex-shrink:0">📲</div>
    <div style="flex:1;font-family:var(--font-body);font-size:0.8rem;color:var(--text);line-height:1.4">
      <strong style="color:var(--gold)">Install The Rail Roster</strong><br>
      Tap <strong>Share</strong> <span style="font-size:1rem">⎙</span> then <strong>Add to Home Screen</strong> for the best experience.
    </div>
    <button onclick="localStorage.setItem('lv_ios_hint_dismissed','1');document.getElementById('ios-install-hint').remove()" style="background:none;border:none;color:var(--text-dim);font-size:1.2rem;cursor:pointer;flex-shrink:0;padding:0;line-height:1">✕</button>
  `;

  document.body.appendChild(banner);

  // Auto-dismiss after 12 seconds
  setTimeout(() => {
    const el = document.getElementById('ios-install-hint');
    if (el) {
      el.style.transition = 'opacity 0.5s ease';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 500);
    }
  }, 12000);
}

// ── OFFLINE / ONLINE BANNER ─────────────────────────────────────
function _showOfflineBanner() {
  if (document.getElementById('offline-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'offline-banner';
  banner.style.cssText = [
    'position:fixed',
    'top:0',
    'left:0',
    'right:0',
    'z-index:9998',
    'background:#7f1d1d',
    'color:#fecaca',
    'text-align:center',
    'padding:0.5rem 1rem',
    'font-family:var(--font-body)',
    'font-size:0.82rem',
    'font-weight:600',
    'letter-spacing:0.02em',
    'box-shadow:0 2px 8px rgba(0,0,0,0.4)'
  ].join(';');
  banner.textContent = '⚠ No internet connection — changes may not save until you reconnect';
  document.body.appendChild(banner);
}

function _hideOfflineBanner() {
  const banner = document.getElementById('offline-banner');
  if (banner) {
    banner.style.transition = 'opacity 0.4s ease';
    banner.style.opacity = '0';
    setTimeout(() => banner.remove(), 400);
    showToast('✓ Back online', 2500);
  }
}

window.addEventListener('offline', _showOfflineBanner);
window.addEventListener('online', _hideOfflineBanner);

// Check on load in case they open the app already offline
if (!navigator.onLine) _showOfflineBanner();

// Trigger iOS install hint after a short delay (so app has rendered)
setTimeout(_showIOSInstallHint, 2500);
