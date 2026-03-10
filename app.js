// ── CONFIG ─────────────────────────────────────────────────────
// Replace with your actual Google OAuth Client ID after setup
const CLIENT_ID = '161569968813-vrhet7p68vkthkunare60nqr34li5uuh.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';
const API_KEY = ''; // Set your Google Cloud API key in settings if needed
// Gemini Vision API key — get a free key at https://aistudio.google.com/app/apikey
// Paste your key here to enable photo-based item identification
let GEMINI_KEY = localStorage.getItem('lv_gemini_key') || '';
const PERSONAL_SHEET_NAME = 'Lionel Vault — My Collection'; // Sheet tab name — kept stable for existing users
const PERSONAL_HEADERS = [
  'Item Number','Variation','Condition (1-10)','All Original',
  'Item Only Price','Box Only Price','Item+Box Complete','Has Box',
  'Box Condition (1-10)','Item Photo Link','Box Photo Link','Notes',
  'Date Purchased','User Est. Worth','Matched Tender/Engine','Set ID','Year Made',
  'Is Error','Error Description','Quick Entry','Inventory ID','Group ID','Location'
];
const SOLD_HEADERS = [
  'Item Number','Variation','Copy #','Condition (1-10)','Item Only Price Paid',
  'Sale Price','Date Sold','Notes'
];
const FOR_SALE_HEADERS = [
  'Item Number','Variation','Condition (1-10)','Asking Price',
  'Date Listed','Notes','Original Price Paid','Est. Worth'
];
const WANT_HEADERS = [
  'Item Number','Variation','Priority','Expected Price','Notes'
];
const UPGRADE_HEADERS = [
  'Item Number','Variation','Priority','Target Condition','Max Price','Notes'
];

// Ephemera tab definitions — shared structure, one tab per category
const EPHEMERA_TABS = [
  { id: 'catalogs',   label: 'Catalogs',    emoji: '📒', color: '#e67e22' },
  { id: 'paper',      label: 'Paper Items', emoji: '📄', color: '#3498db' },
  { id: 'mockups',    label: 'Mock-Ups',    emoji: '🔩', color: '#9b59b6' },
  { id: 'other',      label: 'Other Lionel',emoji: '📦', color: '#27ae60' },
];
const EPHEMERA_HEADERS = [
  'Item ID','Title','Description','Year','Manufacturer','Condition (1-10)',
  'Quantity','Est. Value','Photo Link','Notes','Date Acquired'
];
const CATALOG_HEADERS = [
  'Item ID','Type','Year','Has Envelope/Mailer','Condition (1-10)',
  'Est. Value','Date Acquired','Notes','Photo Link'
];
// Mock-ups get extra columns
const IS_HEADERS = [
  'Sheet #','Linked Item #','Year/Date Printed','Condition (1-10)','Notes','Photo Link','Inventory ID','Group ID'
];
const MOCKUP_HEADERS = [
  'Title','Item Number Ref','Description','Year','Manufacturer',
  'Condition (1-10)','Production Status','Material','Dimensions',
  'Provenance','Lionel Verified','Est. Value','Photo Link','Notes','Date Acquired'
];

// ── TENDER / LOCOMOTIVE RELATIONSHIPS ──────────────────────────
const TENDER_TO_LOCOS = {"1872T":["1872"],"1882T":["1882"],"2020W":["2020"],"2046W":["726RR","637","646","2056","675","736","2055","2046","2065","665"],"2046WX":["671RR","682","681"],"2426W":["773","726"],"2466T":["224","1666"],"2466W":["224","1666"],"2466WX":["675","224","1666"],"2671W":["681","671"],"4424W":["671R"],"4671W":["671R"],"6001T":["6110"],"6020W":["2020"],"6026T":["2018","2037"],"6026W":["2037","685","2055","2018","2065","665","2016"],"6066T":["2026","1130","2034","2037"],"6403B":["1656"],"6466W":["2026","2036","2025","2035"],"6466WX":["2026","2025","675"],"6654T":["1655"],"250T":["250","249"],"671W":["671"],"736W":["637","665","773","736"],"746W":["746"],"773W":["773"],"1001T":["1101","1120","1001","1110"],"1050T":["235","1060","1050","236"],"1060T":["237","242","1060","2029","1062","1061"],"1130T":["244","248","236","245","2037","2018","1130","235","246"],"1130T-500":["2037-500"],"1625T":["1625"],"1654T":["1654"],"1654W":["1654"],"1862T":["1862"]};
const LOCO_TO_TENDERS = {"1872":["1872T"],"1882":["1882T"],"2020":["2020W","6020W"],"726RR":["2046W"],"637":["2046W","736W"],"646":["2046W"],"2056":["2046W"],"675":["2046W","2466WX","6466WX"],"736":["2046W","736W"],"2055":["2046W","6026W"],"2046":["2046W"],"2065":["2046W","6026W"],"665":["2046W","6026W","736W"],"671RR":["2046WX"],"682":["2046WX"],"681":["2046WX","2671W"],"773":["2426W","736W","773W"],"726":["2426W"],"224":["2466T","2466W","2466WX"],"1666":["2466T","2466W","2466WX"],"671":["2671W","671W"],"671R":["4424W","4671W"],"6110":["6001T"],"2018":["6026T","6026W","1130T"],"2037":["6026T","6026W","6066T","1130T"],"685":["6026W"],"2016":["6026W"],"2026":["6066T","6466W","6466WX"],"1130":["6066T","1130T"],"2034":["6066T"],"1656":["6403B"],"2036":["6466W"],"2025":["6466W","6466WX"],"2035":["6466W"],"1655":["6654T"],"250":["250T"],"249":["250T"],"746":["746W"],"1101":["1001T"],"1120":["1001T"],"1001":["1001T"],"1110":["1001T"],"235":["1050T","1130T"],"1060":["1050T","1060T"],"1050":["1050T"],"236":["1050T","1130T"],"237":["1060T"],"242":["1060T"],"2029":["1060T"],"1062":["1060T"],"1061":["1060T"],"244":["1130T"],"248":["1130T"],"245":["1130T"],"246":["1130T"],"2037-500":["1130T-500"],"1625":["1625T"],"1654":["1654T","1654W"],"1862":["1862T"]};

// ── DIESEL SET HELPERS ──────────────────────────────────────────
function isSetUnit(itemNum) {
  const num = normalizeItemNum(itemNum);
  if (num.endsWith('C')) return true;
  return state.masterData.some(m => normalizeItemNum(m.itemNum) === num + 'C');
}
function getBUnit(itemNum) {
  const num = normalizeItemNum(itemNum);
  const bNum = num + 'C';
  return state.masterData.some(m => normalizeItemNum(m.itemNum) === bNum) ? bNum : null;
}
function getAUnit(itemNum) {
  const num = normalizeItemNum(itemNum);
  if (!num.endsWith('C')) return null;
  const aNum = num.slice(0, -1);
  return state.masterData.some(m => normalizeItemNum(m.itemNum) === aNum) ? aNum : null;
}
function getSetPartner(itemNum) {
  const num = normalizeItemNum(itemNum);
  if (num.endsWith('C')) return getAUnit(num);
  return getBUnit(num);
}
function getGroupMembers(itemNum) {
  // Find all personal collection items sharing the same Group ID
  const pd = Object.values(state.personalData).find(p => p.itemNum === itemNum);
  if (!pd || !pd.groupId) return [];
  return Object.values(state.personalData).filter(p => p.groupId === pd.groupId);
}
function normalizeItemNum(n) {
  // Strip trailing .0 from numbers stored as floats e.g. "2343.0" -> "2343"
  const s = (n || '').toString().trim();
  return s.match(/^\d+\.0$/) ? s.slice(0, -2) : s;
}
function isF3AlcoUnit(itemNum) {
  const num = normalizeItemNum(itemNum).replace(/C$/i, '');
  return state.masterData.some(m =>
    normalizeItemNum(m.itemNum) === num &&
    (m.subType || '').match(/F3|Alco/i)
  );
}
function nextInventoryId() {
  let max = 0;
  Object.values(state.personalData).forEach(pd => {
    const id = parseInt(pd.inventoryId);
    if (!isNaN(id) && id > max) max = id;
  });
  // Also check IS data
  Object.values(state.isData || {}).forEach(is => {
    const id = parseInt(is.inventoryId);
    if (!isNaN(id) && id > max) max = id;
  });
  return String(max + 1);
}
function _buildGroupBoxRow(unitNum, boxCond, boxPhotoLink, groupId, datePurchased, leadItemNum) {
  return [
    unitNum + '-BOX', '',  // itemNum, variation
    boxCond || '', '',     // condition = box condition, allOriginal
    '', '', '',            // prices — $0, value tracked on lead unit
    'Yes',                 // hasBox — this IS a box
    boxCond || '',         // boxCond
    '', boxPhotoLink || '', // no item photo; box photo
    'Box for ' + unitNum,  // notes
    datePurchased || '',
    '',                    // $0 worth
    unitNum,               // matchedTo = the unit this box belongs to
    '', '', '', '', '',    // setId, yearMade, isError, errorDesc, quickEntry
    nextInventoryId(),     // Inventory ID — unique
    groupId,               // Group ID — shared with group
    '',                    // Location (col W) — blank for box rows
  ];
}
function genSetId(baseNum) {
  return 'SET-' + baseNum + '-' + Date.now();
}

function isTender(itemNum) { return !!TENDER_TO_LOCOS[itemNum?.toString().trim().toUpperCase()] || !!TENDER_TO_LOCOS[itemNum?.toString().trim()]; }
function isLocomotive(itemNum) { return !!LOCO_TO_TENDERS[itemNum?.toString().trim()]; }
function getMatchingTenders(itemNum) { return LOCO_TO_TENDERS[itemNum?.toString().trim()] || []; }
function getMatchingLocos(tenderNum) { return TENDER_TO_LOCOS[tenderNum?.toString().trim()] || []; }


// ── STATE ───────────────────────────────────────────────────────
// ── Cached preference values (read once at startup, updated on change) ──
let _prefLocEnabled = localStorage.getItem('lv_location_enabled') === 'true';

let state = {
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
  setData: [],         // all rows from Master Set list (read-only reference)
  filteredData: [],
  currentPage: 1,
  pageSize: 50,
  filters: { owned: false, unowned: false, boxed: false, wantList: false, type: '', road: '', search: '', quickEntry: '' },
  currentItem: null,
};

// ── GOOGLE IDENTITY / AUTH ──────────────────────────────────────
let tokenClient;

function initGoogle() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: onTokenReceived,
  });

  // Check for existing session — master ID is hardcoded, just need saved user
  const savedUser = localStorage.getItem('lv_user');
  const savedPersonalId = localStorage.getItem('lv_personal_id');
  state.masterSheetId = '1Y9-cg8C1CkIqy0RQ66DfP7fmGrE3IGBpyJbtdfYx8q0';
  localStorage.setItem('lv_master_id', state.masterSheetId);

  if (savedUser) {
    state.user = JSON.parse(savedUser);
    state.personalSheetId = savedPersonalId;
    showApp();
    showLoading(); // show spinner — onTokenReceived will call loadAllData once token is ready
    const savedEmail = state.user?.email || '';
    tokenClient.requestAccessToken({ prompt: '', login_hint: savedEmail });
  }
}

function handleSignIn() {
  tokenClient.requestAccessToken({ prompt: 'consent' });
}

function onGoogleSignIn(response) {
  const payload = parseJwt(response.credential);
  state.user = { name: payload.given_name, email: payload.email, picture: payload.picture };
  localStorage.setItem('lv_user', JSON.stringify(state.user));
}

let accessToken = null;

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
  if (resp.error) {
    console.error('Token error:', resp);
    // If silent token refresh failed, prompt user to sign in again
    if (resp.error === 'interaction_required' || resp.error === 'login_required') {
      const hint = state.user?.email || '';
      _tokenIsInitial = true; // next token will be a fresh sign-in
      tokenClient.requestAccessToken({ prompt: 'consent', login_hint: hint });
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
    });
  } else {
    updateUserUI();
  }

  // Master sheet is hardcoded
  state.masterSheetId = '1Y9-cg8C1CkIqy0RQ66DfP7fmGrE3IGBpyJbtdfYx8q0';
  localStorage.setItem('lv_master_id', state.masterSheetId);

  // Always sync from Drive config to ensure correct sheet ID across devices
  driveReadConfig().then(config => {
    if (config && config.personalSheetId) {
      // Always use Drive config as source of truth
      state.personalSheetId = config.personalSheetId;
      localStorage.setItem('lv_personal_id', config.personalSheetId);
      if (config.vaultId)      { driveCache.vaultId = config.vaultId;           localStorage.setItem('lv_vault_id', config.vaultId); }
      if (config.photosId)     { driveCache.photosId = config.photosId;         localStorage.setItem('lv_photos_id', config.photosId); }
      if (config.soldPhotosId) { driveCache.soldPhotosId = config.soldPhotosId; localStorage.setItem('lv_sold_photos_id', config.soldPhotosId); }
      loadAllData();
    } else {
      // No config yet — check localStorage then create if needed
      state.personalSheetId = localStorage.getItem('lv_personal_id');
      if (!state.personalSheetId) {
        createPersonalSheet().then(loadAllData);
      } else {
        driveEnsureSetup().catch(e => console.warn('Drive setup:', e));
        loadAllData();
      }
    }
  }).catch(() => {
    // Drive read failed — fall back to localStorage
    state.personalSheetId = localStorage.getItem('lv_personal_id');
    if (!state.personalSheetId) {
      createPersonalSheet().then(loadAllData);
    } else {
      loadAllData();
    }
  });
}

// Refresh token when page resumes from background (e.g. returning from camera on mobile)
document.addEventListener('visibilitychange', function() {
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
  google.accounts.oauth2.revoke(localStorage.getItem('lv_token'), () => {});
  localStorage.removeItem('lv_user');
  localStorage.removeItem('lv_token');
  localStorage.removeItem('lv_token_expiry');
  state.user = null;
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app').classList.remove('active');
}

function closeOnboarding() { var o = document.getElementById("onboarding-overlay"); if (o) o.remove(); }

function showOnboarding() {
  if (localStorage.getItem('lv_onboarded')) return;
  localStorage.setItem('lv_onboarded', '1');
  const ov = document.createElement('div');
  ov.id = 'onboarding-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,14,20,0.92);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1.5rem';
  ov.innerHTML = '<div style="background:var(--surface);border-radius:18px;max-width:380px;width:100%;padding:2rem;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.5)">'
    + '<div style="font-size:3rem;margin-bottom:0.75rem">🚂</div>'
    + '<div style="font-family:var(--font-head);font-size:1.5rem;font-weight:700;margin-bottom:0.5rem;color:var(--text)">Welcome to <span style=\"color:var(--accent)\">My Collection App</span></div>'
    + '<div style="font-size:0.88rem;color:var(--text-mid);line-height:1.7;margin-bottom:1.5rem">Your personal postwar Lionel collection manager. Here\'s how it works:</div>'
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
  document.getElementById('user-name').textContent = state.user.name;
  document.getElementById('user-avatar').textContent = state.user.name[0].toUpperCase();
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
    await sheetsUpdate(sheetId, 'My Collection!A2:W2', [PERSONAL_HEADERS]);
  } else if (rows.length === 1 || !rows[1] || rows[1].length < 13) {
    // Has title but missing/old headers — rewrite row 2
    await sheetsUpdate(sheetId, 'My Collection!A2:W2', [PERSONAL_HEADERS]);
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
  await sheetsUpdate(sheetId, 'Sold!A2:H2',      [SOLD_HEADERS]);
  await sheetsUpdate(sheetId, 'For Sale!A1:A1',   [['For Sale']]);
  await sheetsUpdate(sheetId, 'For Sale!A2:H2',   [FOR_SALE_HEADERS]);
  await sheetsUpdate(sheetId, 'Want List!A1:A1',    [['Want List']]);
  await sheetsUpdate(sheetId, 'Want List!A2:E2',    [WANT_HEADERS]);
  await sheetsUpdate(sheetId, 'Upgrade List!A1:A1', [['Upgrade List']]);
  await sheetsUpdate(sheetId, 'Upgrade List!A2:F2', [UPGRADE_HEADERS]);

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
        await sheetsUpdate(sheetId, 'Sold!A2:H2', [SOLD_HEADERS]);
      }
      if (!existingTabs.includes('For Sale')) {
        await sheetsUpdate(sheetId, 'For Sale!A1:A1', [['For Sale']]);
        await sheetsUpdate(sheetId, 'For Sale!A2:H2', [FOR_SALE_HEADERS]);
      }
      if (!existingTabs.includes('Want List')) {
        await sheetsUpdate(sheetId, 'Want List!A1:A1', [['Want List']]);
        await sheetsUpdate(sheetId, 'Want List!A2:E2', [WANT_HEADERS]);
      }
      if (!existingTabs.includes('Upgrade List')) {
        await sheetsUpdate(sheetId, 'Upgrade List!A1:A1', [['Upgrade List']]);
        await sheetsUpdate(sheetId, 'Upgrade List!A2:F2', [UPGRADE_HEADERS]);
      }
      console.log('[Setup] Created missing tabs:', toCreate.map(t => t.addSheet.properties.title).join(', '));
    }

    // Fetch current row 2 headers (A2:W2 — 23 cols)
    const res = await sheetsGet(sheetId, 'My Collection!A2:W2');
    const current = (res.values && res.values[0]) || [];

    // Check each expected header — write the full row if anything is missing or wrong
    const needsUpdate = PERSONAL_HEADERS.some((h, i) => current[i] !== h);
    if (needsUpdate) {
      await sheetsUpdate(sheetId, 'My Collection!A2:W2', [PERSONAL_HEADERS]);
      console.log('[Headers] My Collection headers repaired');
    }

    // Also ensure row 1 title
    const titleRes = await sheetsGet(sheetId, 'My Collection!A1');
    const title = (titleRes.values && titleRes.values[0] && titleRes.values[0][0]) || '';
    if (title !== 'My Collection') {
      await sheetsUpdate(sheetId, 'My Collection!A1', [['My Collection']]);
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
  // Clear row 1 and row 2 across all ephemera tabs (A1:P covers any previous wide headers)
  const _clearReqs = ['Catalogs','Paper Items','Mock-Ups','Other Lionel'].map(t => ({
    updateCells: {
      range: { sheetId: 0, startRowIndex: 0, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 16 },
      fields: 'userEnteredValue',
    }
  }));
  // Use values API to clear then rewrite cleanly
  await sheetsUpdate(sheetId, 'Catalogs!A1:P1',    [['Catalogs','','','','','','','','','','','','','','','']]);
  await sheetsUpdate(sheetId, 'Catalogs!A2:P2',    [CATALOG_HEADERS.concat(['','','','','','',''])]);
  await sheetsUpdate(sheetId, 'Paper Items!A1:P1', [['Paper Items','','','','','','','','','','','','','','','']]);
  await sheetsUpdate(sheetId, 'Paper Items!A2:P2', [EPHEMERA_HEADERS.concat(['','','','',''])]);
  await sheetsUpdate(sheetId, 'Mock-Ups!A1:P1',    [['Mock-Ups','','','','','','','','','','','','','','','']]);
  await sheetsUpdate(sheetId, 'Mock-Ups!A2:P2',    [MOCKUP_HEADERS.concat([''])]);
  await sheetsUpdate(sheetId, 'Other Lionel!A1:P1',[['Other Lionel','','','','','','','','','','','','','','','']]);
  await sheetsUpdate(sheetId, 'Other Lionel!A2:P2',[EPHEMERA_HEADERS.concat(['','','','',''])]);
  _ensureEphemDone = true;  // Don't run again this session
  // Instruction Sheets tab
  if (!existingTabs.includes('Instruction Sheets')) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
      method:'POST', headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},
      body: JSON.stringify({ requests:[{ addSheet:{ properties:{ title:'Instruction Sheets' } } }] }),
    });
  }
  await sheetsUpdate(sheetId, 'Instruction Sheets!A1:A1', [['Instruction Sheets']]);
  await sheetsUpdate(sheetId, 'Instruction Sheets!A2:H2', [IS_HEADERS]);
}


// ── GOOGLE DRIVE HELPERS ────────────────────────────────────────

// Orthographic projection order: TOP, LEFT, FRONT, RIGHT, BACK, BOTTOM
// Grid positions: [TOP=col2], [LEFT=col1, FRONT=col2, RIGHT=col3, BACK=col4], [BOTTOM=col2]
const ITEM_VIEWS = [
  { key: 'TV',  label: 'Top View',        abbr: 'Top',        ortho: 'top'   },
  { key: 'LSV', label: 'Left Side View',  abbr: 'Left Side',  ortho: 'left'  },
  { key: 'FV',  label: 'Front View',      abbr: 'Front',      ortho: 'front' },
  { key: 'RSV', label: 'Right Side View', abbr: 'Right Side', ortho: 'right' },
  { key: 'BKV', label: 'Back View',       abbr: 'Back',       ortho: 'back'  },
  { key: 'BV',  label: 'Bottom View',     abbr: 'Bottom',     ortho: 'bottom'},
];
// Error car close-up photo views
const ERROR_VIEWS = [
  { key: 'ERR-1', label: 'Error Close-up 1', abbr: 'ERR-1' },
  { key: 'ERR-2', label: 'Error Close-up 2', abbr: 'ERR-2' },
  { key: 'ERR-3', label: 'Error Close-up 3', abbr: 'ERR-3' },
  { key: 'ERR-4', label: 'Error Close-up 4', abbr: 'ERR-4' },
];

// Returns a human-friendly label for the item type (for wizard questions)
function getItemLabel(d) {
  // Try master data lookup first
  const itemNum = (d.itemNum || '').trim().replace(/-[PD]$/, '');
  const master = state.masterData.find(m => m.itemNum === itemNum || m.itemNum === d.itemNum);
  const t = (master && master.itemType) ? master.itemType.toLowerCase() : '';
  if (t.includes('steam') || t.includes('diesel') || t.includes('electric')) return 'locomotive';
  if (t.includes('freight') || t.includes('car')) return 'car';
  if (t.includes('passenger')) return 'car';
  if (t.includes('accessory') || t.includes('accessories')) return 'accessory';
  if (t.includes('track')) return 'track section';
  if (t.includes('set')) return 'set';
  return 'item';
}

const BOX_VIEWS = [
  { key: 'BOX-TV',  label: 'Box Top',        abbr: 'Top',        ortho: 'top'   },
  { key: 'BOX-LSV', label: 'Box Left Side',  abbr: 'Left Side',  ortho: 'left'  },
  { key: 'BOX-FV',  label: 'Box Front',      abbr: 'Front',      ortho: 'front' },
  { key: 'BOX-RSV', label: 'Box Right Side', abbr: 'Right Side', ortho: 'right' },
  { key: 'BOX-BKV', label: 'Box Back',       abbr: 'Back',       ortho: 'back'  },
  { key: 'BOX-BV',  label: 'Box Bottom',     abbr: 'Bottom',     ortho: 'bottom'},
];

// Folder structure:
//  My Collection App - Drive Folder/         (vault root — stores sheet + photo subfolders)
//    My Collection Photos/               (item photo folders)
//      726/
//        726 FV.jpg, 726 RSV.jpg ...
//    My Sold Collection Photos/          (sold item photo folders — moved here on sale)

const driveCache = {
  vaultId: null,       // "My Collection App - Drive Folder" root
  photosId: null,      // "My Collection Photos"
  catalogsId: localStorage.getItem('lv_catalogs_id') || null,
  isPhotosId: localStorage.getItem('lv_is_id') || null,
  soldPhotosId: null,  // "My Sold Collection Photos"
  itemFolders: {},     // itemNum -> folderId
};

async function driveRequest(method, endpoint, body) {
  if (!accessToken) {
    // Try restore from localStorage
    var saved = localStorage.getItem('lv_token');
    var expiry = parseInt(localStorage.getItem('lv_token_expiry') || '0');
    if (saved && expiry > Date.now()) accessToken = saved;
    else throw new Error('Not signed in');
  }
  var res = await fetch('https://www.googleapis.com/drive/v3' + endpoint, {
    method: method,
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  // If 401 (expired token), try one silent refresh and retry
  if (res.status === 401 && state.user) {
    console.warn('[Drive] 401 — attempting token refresh');
    try {
      await new Promise(function(resolve, reject) {
        var _origCb = tokenClient.callback;
        var _done = false;
        tokenClient.callback = function(resp) {
          if (_done) return;
          _done = true;
          tokenClient.callback = _origCb;
          if (resp.error) { reject(new Error(resp.error)); return; }
          onTokenReceived(resp);
          resolve();
        };
        tokenClient.requestAccessToken({ prompt: '', login_hint: state.user.email || '' });
        setTimeout(function() { if (!_done) { _done = true; tokenClient.callback = _origCb; reject(new Error('Token refresh timeout')); } }, 10000);
      });
    } catch(e) {
      console.error('[Drive] Token refresh failed:', e);
      throw new Error('Session expired — please sign in again');
    }
    // Retry with fresh token
    res = await fetch('https://www.googleapis.com/drive/v3' + endpoint, {
      method: method,
      headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }
  // For 4xx errors (except 401 handled above), return JSON so callers can inspect .error
  // For 5xx server errors, throw
  if (res.status >= 500) {
    var errBody = await res.text().catch(function() { return 'unknown'; });
    console.error('[Drive] Server error:', res.status, endpoint, errBody);
    throw new Error('Drive server error (' + res.status + ')');
  }
  if (!res.ok) {
    console.warn('[Drive] API', res.status, method, endpoint);
  }
  return res.json();
}

async function driveUploadFile(file, name, folderId) {
  if (!folderId) throw new Error('Missing folderId for upload: ' + name);
  if (!accessToken) {
    var _s = localStorage.getItem('lv_token');
    var _e = parseInt(localStorage.getItem('lv_token_expiry') || '0');
    if (_s && _e > Date.now()) { accessToken = _s; }
    else throw new Error('Not signed in — please sign in and try again');
  }
  const metadata = { name, parents: [folderId], mimeType: file.type };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + accessToken },
    body: form,
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => 'unknown');
    console.error('[Drive] Upload failed:', res.status, errText);
    throw new Error('Photo upload failed (HTTP ' + res.status + ')');
  }
  return res.json();
}

async function driveFindOrCreateFolder(name, parentId) {
  if (!parentId) throw new Error('Missing parentId for folder: ' + name);
  const q = encodeURIComponent(`name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`);
  const res = await driveRequest('GET', `/files?q=${q}&fields=files(id,name)&spaces=drive`);
  if (res.error) { console.error('[Drive] Folder search error:', name, res.error); throw new Error('Drive folder search failed: ' + (res.error.message || res.error)); }
  if (res.files && res.files.length > 0) return res.files[0].id;
  const created = await driveRequest('POST', '/files?fields=id', {
    name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId],
  });
  if (!created || !created.id) {
    console.error('[Drive] Folder create failed:', name, created);
    throw new Error('Could not create Drive folder: ' + name);
  }
  return created.id;
}

async function driveUploadPhoto(file, fileName, folderId) {
  const meta = JSON.stringify({ name: fileName, parents: [folderId] });
  const form = new FormData();
  form.append('metadata', new Blob([meta], { type: 'application/json' }));
  form.append('file', file);
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  return res.json();
}

async function driveMoveFileToFolder(fileId, fromFolderId, toFolderId) {
  await driveRequest('PATCH', `/files/${fileId}?addParents=${toFolderId}&removeParents=${fromFolderId}&fields=id`, {});
}

// Called once on first run — creates the full vault folder structure
async function driveSetupVault() {
  // Use 'root' directly as parent ID — Drive API accepts it without needing to look up the ID
  driveCache.vaultId = await driveFindOrCreateFolder('Lionel Vault - My Collection', 'root');
  localStorage.setItem('lv_vault_id', driveCache.vaultId);

  // Find or create both photo subfolders (always, so nothing is missing)
  driveCache.photosId     = await driveFindOrCreateFolder('My Collection Photos',      driveCache.vaultId);
  driveCache.soldPhotosId = await driveFindOrCreateFolder('My Sold Collection Photos', driveCache.vaultId);
  localStorage.setItem('lv_photos_id',      driveCache.photosId);
  localStorage.setItem('lv_sold_photos_id', driveCache.soldPhotosId);

  // Move the personal sheet into the vault folder if we have its ID
  const sheetId = localStorage.getItem('lv_personal_id');
  if (sheetId) {
    try { await driveMoveSheetToVault(sheetId); } catch(e) { console.warn('Sheet move:', e); }
  }

  // Save config so other devices can discover these IDs
  if (state.personalSheetId) {
    driveWriteConfig({
      personalSheetId: state.personalSheetId,
      vaultId: driveCache.vaultId,
      photosId: driveCache.photosId,
      soldPhotosId: driveCache.soldPhotosId,
    }).catch(e => console.warn('Config write:', e));
  }
  return driveCache.vaultId;
}

async function driveEnsureSetup() {
  // If cache is populated AND already validated this session, trust it
  if (driveCache.vaultId && driveCache.photosId && driveCache.soldPhotosId && driveCache._validated) return;
  // If cache is populated but not yet validated, check the folder exists
  if (driveCache.vaultId && driveCache.photosId && driveCache.soldPhotosId) {
    try {
      var _vc = await driveRequest('GET', '/files/' + driveCache.photosId + '?fields=id,trashed');
      if (_vc && _vc.id && !_vc.trashed) { driveCache._validated = true; return; }
    } catch(e) { /* validation failed, fall through */ }
    // Cache is stale — clear everything
    console.warn('[Drive] Cached photosId stale/invalid, re-running setup');
    driveCache.vaultId = null;
    driveCache.photosId = null;
    driveCache.soldPhotosId = null;
    driveCache.itemFolders = {};
    localStorage.removeItem('lv_vault_id');
    localStorage.removeItem('lv_photos_id');
    localStorage.removeItem('lv_sold_photos_id');
    await driveSetupVault();
    driveCache._validated = true;
    return;
  }
  // Try from localStorage (fast path)
  const vId = localStorage.getItem('lv_vault_id');
  const pId = localStorage.getItem('lv_photos_id');
  const sId = localStorage.getItem('lv_sold_photos_id');
  if (vId && pId && sId) {
    // Quick-validate that the photos folder still exists
    try {
      const check = await driveRequest('GET', '/files/' + pId + '?fields=id,trashed');
      if (check && check.id && !check.trashed) {
        driveCache.vaultId      = vId;
        driveCache.photosId     = pId;
        driveCache.soldPhotosId = sId;
        driveCache._validated   = true;
        return;
      }
    } catch(e) { /* fall through to full setup */ }
    // Cached IDs are stale — clear and re-create
    console.warn('[Drive] localStorage folder IDs stale, re-running setup');
    localStorage.removeItem('lv_vault_id');
    localStorage.removeItem('lv_photos_id');
    localStorage.removeItem('lv_sold_photos_id');
  }
  // Always run full setup so any missing folders get created
  await driveSetupVault();
  driveCache._validated = true;
}

async function driveEnsureItemFolder(itemNum) {
  await driveEnsureSetup();
  const key = String(itemNum);
  if (driveCache.itemFolders[key]) return driveCache.itemFolders[key];
  const folderId = await driveFindOrCreateFolder(key, driveCache.photosId);
  driveCache.itemFolders[key] = folderId;
  return folderId;
}

async function driveGetFolderPhotos(folderLink) {
  const match = (folderLink || '').match(/folders\/([a-zA-Z0-9_-]+)/);
  if (!match) return null;
  const folderId = match[1];
  if (!accessToken) return null;
  try {
    const q = encodeURIComponent(`'${folderId}' in parents and mimeType contains 'image/' and trashed=false`);
    const res = await driveRequest('GET', `/files?q=${q}&fields=files(id,name)&orderBy=name`);
    if (res.error) { console.warn('Drive photo fetch error:', res.error); return null; }
    return (res.files || []).map(function(f) {
      return {
        id: f.id,
        name: f.name,
        // Use authenticated media download URL — fetch as blob in loadThumb()
        mediaUrl: 'https://www.googleapis.com/drive/v3/files/' + f.id + '?alt=media',
        view: 'https://drive.google.com/file/d/' + f.id + '/view',
      };
    });
  } catch(e) { console.error('driveGetFolderPhotos:', e); return null; }
}

// Fetch a Drive file as an authenticated blob URL for use in <img loading="lazy" src>
const _blobCache = {};
async function loadDriveThumb(fileId, imgEl, containerEl) {
  const cacheKey = fileId;
  if (_blobCache[cacheKey]) { imgEl.src = _blobCache[cacheKey]; return; }
  try {
    // Use thumbnail endpoint with size parameter (requires auth)
    const thumbUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&acknowledgeAbuse=true`;
    const res = await fetch(thumbUrl, {
      headers: { Authorization: 'Bearer ' + accessToken }
    });
    if (!res.ok) {
      containerEl.innerHTML = '<span style="font-size:0.65rem;color:var(--text-dim)">⚠ ' + res.status + '</span>';
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    _blobCache[cacheKey] = url;
    imgEl.src = url;
  } catch(e) {
    containerEl.innerHTML = '<span style="font-size:0.65rem;color:var(--text-dim)">⚠ err</span>';
  }
}

function driveFolderLink(folderId) {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

async function driveUploadItemPhoto(file, itemNum, viewAbbr) {
  console.log('[Drive] Uploading photo:', itemNum, viewAbbr, 'file:', file.name, 'size:', file.size);
  await driveEnsureSetup();
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const fileName = `${itemNum} ${viewAbbr}.${ext}`;
  const folderId = await driveEnsureItemFolder(itemNum);
  console.log('[Drive] Folder ready:', folderId, 'Uploading...');
  const result = await driveUploadFile(file, fileName, folderId);
  console.log('[Drive] Upload result:', result && result.id ? 'OK id=' + result.id : 'FAILED', result);
  if (!result || !result.id) {
    throw new Error('Upload returned no file ID');
  }
  // Return folder link (not individual photo link)
  return driveFolderLink(folderId);
}

async function driveMoveToSold(itemNum) {
  await driveEnsureSetup();
  const key = String(itemNum);
  // Find item folder in My Collection Photos
  const q = encodeURIComponent(`name='${key}' and mimeType='application/vnd.google-apps.folder' and '${driveCache.photosId}' in parents and trashed=false`);
  const res = await driveRequest('GET', `/files?q=${q}&fields=files(id)`);
  if (res.files && res.files.length > 0) {
    const fId = res.files[0].id;
    await driveMoveFileToFolder(fId, driveCache.photosId, driveCache.soldPhotosId);
    delete driveCache.itemFolders[key];
  }
}

// ── DRIVE CONFIG FILE ───────────────────────────────────────────
// Stores personalSheetId in a small JSON file in Drive root
// so any device can find the right sheet after signing in

const CONFIG_FILENAME = 'my-collection-app-config.json';

async function driveReadConfig() {
  try {
    // Search for config file in Drive root
    const q = encodeURIComponent(`name='${CONFIG_FILENAME}' and trashed=false`);
    const res = await driveRequest('GET', `/files?q=${q}&fields=files(id,name)&spaces=drive`);
    if (!res.files || res.files.length === 0) return null;
    // Read file contents
    const fileId = res.files[0].id;
    const r = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: 'Bearer ' + accessToken }
    });
    return await r.json();
  } catch(e) { console.warn('driveReadConfig error:', e); return null; }
}

async function driveWriteConfig(data) {
  try {
    const json = JSON.stringify(data);
    const blob = new Blob([json], { type: 'application/json' });
    // Check if file already exists
    const q = encodeURIComponent(`name='${CONFIG_FILENAME}' and trashed=false`);
    const res = await driveRequest('GET', `/files?q=${q}&fields=files(id)&spaces=drive`);
    if (res.files && res.files.length > 0) {
      // Update existing file
      const fileId = res.files[0].id;
      await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
        body: blob,
      });
    } else {
      // Create new file
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify({ name: CONFIG_FILENAME, mimeType: 'application/json' })], { type: 'application/json' }));
      form.append('file', blob);
      await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + accessToken },
        body: form,
      });
    }
  } catch(e) { console.warn('driveWriteConfig error:', e); }
}

// Move sheet into vault folder after creation
async function driveMoveSheetToVault(sheetId) {
  await driveEnsureSetup();
  // Get current parents of the sheet file
  const meta = await driveRequest('GET', `/files/${sheetId}?fields=parents`);
  const currentParents = (meta.parents || []).join(',');
  await fetch(`https://www.googleapis.com/drive/v3/files/${sheetId}?addParents=${driveCache.vaultId}&removeParents=${currentParents}&fields=id`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
}

// ── SHEETS API ──────────────────────────────────────────────────
// Encode range for URL path — just encode spaces
function _encodeRange(range) {
  return range.replace(/ /g, '%20');
}

async function sheetsGet(spreadsheetId, range) {
  const isMaster = spreadsheetId === state.masterSheetId;
  const useApiKey = isMaster && API_KEY && API_KEY !== 'YOUR_API_KEY';
  const urlRange = _encodeRange(range);
  const url = useApiKey
    ? `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${urlRange}?key=${API_KEY}`
    : `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${urlRange}`;
  const headers = useApiKey
    ? {}
    : { Authorization: `Bearer ${accessToken}` };
  const res = await fetch(url, { headers });
  return res.json();
}

// ── Token refresh helper — silently refreshes expired token then retries ──
// On mobile, tokens expire and the silent refresh sometimes doesn't fire in time.
// This wraps any fetch so a 401 triggers a fresh token request before retrying once.
async function _withTokenRetry(fetchFn) {
  // If no token at all, try to get one silently first
  if (!accessToken && tokenClient) {
    await new Promise((resolve, reject) => {
      const hint = state.user?.email || '';
      const prev = tokenClient.callback;
      tokenClient.callback = (resp) => {
        tokenClient.callback = prev;
        if (resp.error) { reject(new Error('Token required: ' + resp.error)); return; }
        accessToken = resp.access_token;
        resolve();
      };
      tokenClient.requestAccessToken({ prompt: '', login_hint: hint });
      setTimeout(() => reject(new Error('Sign-in timed out')), 10000);
    });
  }
  if (!accessToken) throw new Error('Not signed in — please reload and sign in again');

  const res = await fetchFn();
  if (res.status === 401 || res.status === 403) {
    if (!tokenClient) throw new Error('Cannot refresh token — please reload');
    await new Promise((resolve, reject) => {
      const hint = state.user?.email || '';
      const prevCallback = tokenClient.callback;
      tokenClient.callback = (resp) => {
        tokenClient.callback = prevCallback;
        if (resp.error) { reject(new Error('Token refresh failed: ' + resp.error)); return; }
        accessToken = resp.access_token;
        resolve();
      };
      tokenClient.requestAccessToken({ prompt: '', login_hint: hint });
      setTimeout(() => reject(new Error('Token refresh timed out')), 8000);
    });
    const retryRes = await fetchFn();
    if (!retryRes.ok) {
      const errBody = await retryRes.json().catch(() => ({}));
      throw new Error(`Sheets API error ${retryRes.status}: ${errBody?.error?.message || retryRes.statusText}`);
    }
    return retryRes;
  }
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(`Sheets API error ${res.status}: ${errBody?.error?.message || res.statusText}`);
  }
  return res;
}

async function sheetsUpdate(spreadsheetId, range, values) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${_encodeRange(range)}?valueInputOption=USER_ENTERED`;
  const body = JSON.stringify({ range, majorDimension: 'ROWS', values });
  const res = await _withTokenRetry(() => fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body,
  }));
  const json = await res.json();
  if (json.error) {
    console.error('sheetsUpdate error:', JSON.stringify(json.error));
    throw new Error('Sheets update failed: ' + (json.error.message || JSON.stringify(json.error)));
  }
  return json;
}

async function sheetsAppend(spreadsheetId, range, values) {
  // Extract raw tab name from range (e.g. "For Sale!A:A" -> "For Sale")
  const tabName = range.includes('!') ? range.split('!')[0] : range;

  // Helper: convert column number (1-based) to letter(s): 1=A, 26=Z, 27=AA
  function colLetter(n) {
    let s = '';
    while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); }
    return s;
  }

  // Find the last used row in column A (data starts at row 3)
  const colARes = await sheetsGet(spreadsheetId, `${tabName}!A3:A`);
  const nextRow = 3 + ((colARes.values || []).length);

  // Write each row with PUT to an exact range
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const endCol = colLetter(Math.max(row.length, 1));
    const writeRange = `${tabName}!A${nextRow + i}:${endCol}${nextRow + i}`;
    const body = JSON.stringify({ range: writeRange, majorDimension: 'ROWS', values: [row] });
    const res = await _withTokenRetry(() => fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${_encodeRange(writeRange)}?valueInputOption=USER_ENTERED`,
      { method: 'PUT', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body }
    ));
    const json = await res.json();
    if (json.error) {
      console.error('sheetsAppend (PUT) error:', JSON.stringify(json.error));
      throw new Error('Sheets write failed: ' + (json.error.message || JSON.stringify(json.error)));
    }
    console.log('[Sheets] Wrote row to', writeRange);
  }
}

async function sheetsDeleteRow(spreadsheetId, sheetName, rowNumber) {
  // First get the sheetId (numeric) for the named tab
  const metaRes = await _withTokenRetry(() => fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  ));
  const meta = await metaRes.json();
  const sheet = meta.sheets.find(s => s.properties.title === sheetName);
  if (!sheet) return;
  const sheetId = sheet.properties.sheetId;

  // Delete the row (0-indexed, startIndex = rowNumber-1)
  await _withTokenRetry(() => fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: rowNumber - 1,
            endIndex: rowNumber
          }
        }
      }]
    })
  }));
}

async function createPersonalSheet() {
  // 1. Set up Drive vault folders first
  await driveSetupVault();

  // 2. Create new spreadsheet
  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      properties: { title: PERSONAL_SHEET_NAME },
      sheets: [{ properties: { title: 'My Collection' } }]
    })
  });
  const data = await res.json();
  state.personalSheetId = data.spreadsheetId;
  localStorage.setItem('lv_personal_id', state.personalSheetId);

  // 3. Write headers and create all tabs
  await sheetsUpdate(state.personalSheetId, 'My Collection!A1:A1', [['My Collection']]);
  await sheetsUpdate(state.personalSheetId, 'My Collection!A2:W2', [PERSONAL_HEADERS]);
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

async function loadAllData() {
  showLoading();
  try {
    loadUserDefinedTabs();
    // Load master data (uses cache if fresh) and personal data in parallel
    await Promise.all([loadMasterData(), loadPersonalData(), loadSetData()]);
    buildApp();
    showOnboarding();
    if (typeof vaultInit === 'function') vaultInit();
  } catch(e) {
    showToast('Load error: ' + e.message);
    const tb = document.getElementById('browse-tbody');
    if (tb) tb.innerHTML = '<tr><td colspan="9" style="padding:2rem;color:var(--red);text-align:center">Error loading data. Please refresh.<br><small>' + e.message + '</small></td></tr>';
  }
}

async function loadMasterData() {
  // Use cached master data for instant load, refresh in background
  const _CACHE_VER = '10';
  if (localStorage.getItem('lv_cache_ver') !== _CACHE_VER) {
    localStorage.removeItem('lv_master_cache');
    localStorage.removeItem('lv_personal_cache');
    localStorage.setItem('lv_cache_ver', _CACHE_VER);
  }
  const cached = localStorage.getItem('lv_master_cache');
  const cachedAt = parseInt(localStorage.getItem('lv_master_cache_ts') || '0');
  const cacheAge = Date.now() - cachedAt;
  const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  if (cached && cacheAge < CACHE_TTL) {
    try {
      state.masterData = JSON.parse(cached);
      // Refresh in background without blocking
      sheetsGet(state.masterSheetId, 'Master Inventory!A2:K').then(res => {
        if (!res.values) return sheetsGet(state.masterSheetId, 'Sheet1!A2:K');
        return res;
      }).then(res => {
        if (res && res.values) {
          parseMasterRows(res.values);
          localStorage.setItem('lv_master_cache', JSON.stringify(state.masterData));
          localStorage.setItem('lv_master_cache_ts', Date.now().toString());
          if (typeof renderBrowse === 'function') renderBrowse();
        }
      }).catch(() => {});
      return;
    } catch(e) {}
  }

  let res = await sheetsGet(state.masterSheetId, 'Master Inventory!A2:K');
  if (!res.values) {
    res = await sheetsGet(state.masterSheetId, 'Sheet1!A2:K');
  }
  const rows = res.values || [];
  parseMasterRows(rows);
  localStorage.setItem('lv_master_cache', JSON.stringify(state.masterData));
  localStorage.setItem('lv_master_cache_ts', Date.now().toString());
}

function parseMasterRows(rows) {
  const mapped = rows.map(r => ({
    itemNum:     r[0]  || '',
    itemType:    r[1]  || '',
    subType:     r[2]  || '',
    roadName:    r[3]  || '',
    description: r[4]  || '',
    yearProd:    r[5]  || '',
    variation:   r[6]  || '',
    varDesc:     r[7]  || '',
    refLink:     r[8]  || '',
    notes:       r[9]  || '',
    marketVal:   r[10] || '',
  }));
  // Deduplicate by itemNum+variation (keep first occurrence)
  const seen = new Set();
  state.masterData = mapped.filter(m => {
    const key = m.itemNum + '|' + m.variation;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function loadSetData() {
  try {
    const cached = localStorage.getItem('lv_set_cache');
    const cachedAt = parseInt(localStorage.getItem('lv_set_cache_ts') || '0');
    if (cached && (Date.now() - cachedAt) < 24*60*60*1000) {
      state.setData = JSON.parse(cached);
      // Background refresh
      sheetsGet(state.masterSheetId, 'Master Set list!A2:U').then(res => {
        if (res && res.values) {
          parseSetRows(res.values);
          localStorage.setItem('lv_set_cache', JSON.stringify(state.setData));
          localStorage.setItem('lv_set_cache_ts', Date.now().toString());
        }
      }).catch(() => {});
      return;
    }
    const res = await sheetsGet(state.masterSheetId, 'Master Set list!A2:U');
    parseSetRows((res && res.values) || []);
    localStorage.setItem('lv_set_cache', JSON.stringify(state.setData));
    localStorage.setItem('lv_set_cache_ts', Date.now().toString());
  } catch(e) { console.warn('loadSetData:', e); state.setData = []; }
}

function parseSetRows(rows) {
  state.setData = rows
    .filter(r => r[0])
    .map(r => ({
      setNum:   (r[0]  || '').trim(),
      setName:  (r[1]  || '').trim(),
      year:     (r[2]  || '').trim(),
      gauge:    (r[3]  || '').trim(),
      price:    (r[4]  || '').trim(),
      items:    [r[5],r[6],r[7],r[8],r[9],r[10],r[11],r[12],r[13],r[14],r[15]]
                  .map(v => (v||'').trim()).filter(Boolean),
      alts:     [r[16],r[17],r[18],r[19]]
                  .map(v => (v||'').trim()).filter(Boolean),
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
        if (allItems.some(si => norm(si) === en)) {
          primaryMatches++;
        } else if (allAlts.some(ai => norm(ai) === en)) {
          altMatches++;
          matchedAlts.push(ei);
        }
      });
      const total = primaryMatches + altMatches;
      return { ...s, primaryMatches, altMatches, matchedAlts, total };
    })
    .filter(s => s.total >= 2)
    .sort((a, b) => b.total - a.total || b.primaryMatches - a.primaryMatches)
    .slice(0, 5);
}

async function loadPersonalData() {
  if (!state.personalSheetId) {
    state.personalSheetId = localStorage.getItem('lv_personal_id');
  }
  if (!state.personalSheetId) return;

  // Use cached personal data for instant load (15 min TTL)
  const _pcache = localStorage.getItem('lv_personal_cache');
  const _ptime  = parseInt(localStorage.getItem('lv_personal_cache_ts') || '0');
  const _PAGE_TTL = 15 * 60 * 1000;
  if (_pcache && (Date.now() - _ptime) < _PAGE_TTL) {
    try {
      const _pd = JSON.parse(_pcache);
      state.personalData  = _pd.personalData  || {};
      state.soldData      = _pd.soldData      || {};
      state.forSaleData   = _pd.forSaleData   || {};
      state.wantData      = _pd.wantData      || {};
      state.isData        = _pd.isData        || {};
      state.ephemeraData  = _pd.ephemeraData  || { catalogs:{}, paper:{}, mockups:{}, other:{} };
      // Refresh in background
      _loadPersonalFromSheets(state.personalSheetId).then(() => {
        _cachePersonalData();
        buildDashboard();
        renderBrowse();
      }).catch(() => {});
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
      ephemeraData: state.ephemeraData,
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
  const newEphemera = { catalogs:{}, paper:{}, mockups:{}, other:{} };
  const newForSale = {};

  // Fetch all tabs in parallel
  const [collRes, soldRes, forSaleRes, wantRes, upgradeRes,
         catRes, paperRes, mockRes, otherRes, isRes] = await Promise.all([
    sheetsGet(sheetId, 'My Collection!A3:W').catch(() => ({values:[]})),
    sheetsGet(sheetId, 'Sold!A3:H').catch(() => ({values:[]})),
    sheetsGet(sheetId, 'For Sale!A3:H').catch(() => ({values:[]})),
    sheetsGet(sheetId, 'Want List!A3:E').catch(() => ({values:[]})),
    sheetsGet(sheetId, 'Upgrade List!A3:F').catch(() => ({values:[]})),
    sheetsGet(sheetId, 'Catalogs!A3:I').catch(() => ({values:[]})),
    sheetsGet(sheetId, 'Paper Items!A3:J').catch(() => ({values:[]})),
    sheetsGet(sheetId, 'Mock-Ups!A3:O').catch(() => ({values:[]})),
    sheetsGet(sheetId, 'Other Lionel!A3:J').catch(() => ({values:[]})),
    sheetsGet(sheetId, 'Instruction Sheets!A3:H').catch(() => ({values:[]})),
  ]);

  // My Collection
  (collRes.values || []).forEach((r, idx) => {
    if (!r[0] || r[0] === 'Item Number') return;
    const rowNum = idx + 3;
    const key = `${r[0]}|${r[1] || ''}|${rowNum}`;
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
    };
  });

  // Want List
  (wantRes.values || []).forEach((r, idx) => {
    if (!r[0] || r[0] === 'Item Number') return;
    const key = `${r[0]}|${r[1]||''}`;
    newWant[key] = {
      row: idx+3, itemNum: r[0]||'', variation: r[1]||'',
      priority: r[2]||'Medium', expectedPrice: r[3]||'', notes: r[4]||'',
    };
  });

  // Upgrade List
  (upgradeRes.values || []).forEach((r, idx) => {
    if (!r[0] || r[0] === 'Item Number') return;
    const key = `${r[0]}|${r[1]||''}`;
    state.upgradeData[key] = {
      row: idx+3, itemNum: r[0]||'', variation: r[1]||'',
      priority: r[2]||'Medium', targetCondition: r[3]||'', maxPrice: r[4]||'', notes: r[5]||'',
    };
  });

  // Instruction Sheets
  const _isRows = (isRes && isRes.values) || [];
  _isRows.forEach((r, idx) => {
    if (!r[0] || r[0] === 'Sheet #' || r[0] === 'Instruction Sheets') return;
    const key = idx + 3;
    newIsData[key] = {
      row: key, sheetNum: r[0]||'', linkedItem: r[1]||'', year: r[2]||'',
      condition: r[3]||'', notes: r[4]||'', photoLink: r[5]||'',
      inventoryId: r[6]||'', groupId: r[7]||'',
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
      const hasItemId = /^\d{4}-[A-Z]+/.test(r[0]);
      if (hasItemId) {
        bucket[key] = {
          row: key, itemNum: r[0]||'', title: r[1]||'', description: r[2]||'', year: r[3]||'',
          manufacturer: r[4]||'Lionel', condition: r[5]||'', quantity: r[6]||'1',
          estValue: r[7]||'', photoLink: r[8]||'', notes: r[9]||'', dateAcquired: r[10]||'',
        };
      } else {
        // Legacy row without Item ID
        bucket[key] = {
          row: key, itemNum: '', title: r[0]||'', description: r[1]||'', year: r[2]||'',
          manufacturer: r[3]||'Lionel', condition: r[4]||'', quantity: r[5]||'1',
          estValue: r[6]||'', photoLink: r[7]||'', notes: r[8]||'', dateAcquired: r[9]||'',
        };
      }
    });
  }
  // Catalogs have their own column layout
  (catRes.values || []).forEach((r, idx) => {
    // Skip header rows: first cell is 'Item ID', 'Type', or 'Catalogs'
    if (!r[0] || r[0] === 'Item ID' || r[0] === 'Type' || r[0] === 'Catalogs') return;
    const key = idx + 3;
    // Columns: ItemID(0) Type(1) Year(2) HasMailer(3) Condition(4) EstValue(5) DateAcq(6) Notes(7) PhotoLink(8)
    const catType = r[1]||'';
    const year = r[2]||'';
    const title = [year, catType, 'Catalog'].filter(Boolean).join(' ');
    newEphemera.catalogs[key] = {
      row: key, itemNum: r[0]||'', title,
      catType, year, hasMailer: r[3]||'No',
      condition: r[4]||'', estValue: r[5]||'', dateAcquired: r[6]||'',
      notes: r[7]||'', photoLink: r[8]||'',
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
    if (!r[0] || r[0] === 'Title') return;
    const key = idx + 3;
    newEphemera.mockups[key] = {
      row: key, title: r[0]||'', itemNumRef: r[1]||'', description: r[2]||'',
      year: r[3]||'', manufacturer: r[4]||'Lionel', condition: r[5]||'',
      productionStatus: r[6]||'', material: r[7]||'', dimensions: r[8]||'',
      provenance: r[9]||'', lionelVerified: r[10]||'', estValue: r[11]||'',
      photoLink: r[12]||'', notes: r[13]||'', dateAcquired: r[14]||'',
    };
  });

  // ── Commit to state ──
  // forceOverwrite: always replace (used by Sync button)
  // Normal load: only replace if sheet returned data (protects optimistic items)
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
  state.isData = newIsData;
  state.ephemeraData = newEphemera;
}

// ── BUILD APP ───────────────────────────────────────────────────
function buildApp() {
  showApp();
  populateFilters();
  buildDashboard();
  _applyDisclaimerPref();
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
  // Auto-launch tutorial for first-time users
  if (typeof tutCheckAutoLaunch === 'function') tutCheckAutoLaunch();
}

function showLoading() {
  const tb = document.getElementById('browse-tbody');
  if (tb) tb.innerHTML = '<tr><td colspan="9"><div class="loading" style="padding:3rem;flex-direction:column;gap:0.75rem"><div class="spinner" style="width:36px;height:36px;border-width:3px"></div><div style="font-size:0.9rem;color:var(--text-dim)">Loading My Collection App…</div><div style="font-size:0.75rem;color:var(--text-dim);opacity:0.7">Fetching master inventory</div></div></td></tr>';
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
  } catch(e) {
    console.error('Sync error:', e);
    showToast('Sync failed: ' + e.message, 5000, true);
  } finally {
    if (btn)  btn.disabled = false;
    if (icon) icon.style.animation = '';
  }
}



// ══════════════════════════════════════════════════════════════════
// DASHBOARD CARD CATALOG — 5 independent slots
// Each slot: {id:'engines'} or null for empty
// ══════════════════════════════════════════════════════════════════
const CARD_CATALOG = [
  {
    id: 'owned', label: 'Items I Own', color: '#3aad70',
    compute: function(state) {
      const allOwned = Object.values(state.personalData).filter(pd => {
        if (!pd.owned) return false;
        const condVal = (pd.condition||'').toString().trim();
        const priceVal = (pd.priceItem||'').toString().trim();
        const noCondition = !condVal || condVal === 'N/A';
        const noItemPrice = !priceVal || priceVal === 'N/A';
        return !(pd.hasBox === 'Yes' && noCondition && noItemPrice);
      }).length;
      let ephCount = 0;
      Object.values(state.ephemeraData||{}).forEach(b => { ephCount += Object.keys(b).length; });
      const total = allOwned + ephCount;
      return { value: total.toLocaleString(), sub: ephCount > 0 ? 'incl. ' + ephCount + ' other items' : 'including variations' };
    }
  },
  {
    id: 'value', label: 'Collection Value', color: '#c9922a',
    compute: function(state) {
      let total = 0;
      Object.values(state.personalData).filter(pd=>pd.owned).forEach(pd => {
        if (pd.priceComplete) total += parseFloat(pd.priceComplete)||0;
        else if (pd.priceItem && pd.priceItem!=='N/A') total += parseFloat(pd.priceItem)||0;
        else if (pd.priceBox) total += parseFloat(pd.priceBox)||0;
      });
      Object.values(state.ephemeraData||{}).forEach(b => { Object.values(b).forEach(it => { if (it.estValue) total += parseFloat(it.estValue)||0; }); });
      return { value: total > 0 ? '$' + Math.round(total).toLocaleString() : '—', sub: 'estimated worth' };
    }
  },
  {
    id: 'catalog', label: 'Catalog Items I Own', color: '#3498db',
    compute: function(state) {
      const catNums = new Set(state.masterData.map(m => normalizeItemNum(m.itemNum)));
      const ownedNums = new Set(Object.values(state.personalData).filter(pd=>pd.owned).map(pd=>normalizeItemNum(pd.itemNum)));
      const unique = [...ownedNums].filter(n=>catNums.has(n)).length;
      const pct = catNums.size > 0 ? (unique/catNums.size*100).toFixed(1) : 0;
      return { value: unique.toLocaleString(), sub: pct + '% of all Lionel items cataloged' };
    }
  },
  {
    id: 'engines', label: 'Total Engines', color: '#e74c3c',
    compute: function(state) {
      const owned = new Set(Object.values(state.personalData).filter(pd=>pd.owned).map(pd=>normalizeItemNum(pd.itemNum)));
      const count = state.masterData.filter(m => {
        const t = (m.itemType||'').toLowerCase();
        return (t.includes('steam')||t.includes('diesel')||t.includes('electric')||t.includes('locomotive')) && owned.has(normalizeItemNum(m.itemNum));
      }).length;
      return { value: count.toLocaleString(), sub: 'locomotives in collection' };
    }
  },
  {
    id: 'cabooses', label: 'Total Cabooses', color: '#c0392b',
    compute: function(state) {
      const owned = new Set(Object.values(state.personalData).filter(pd=>pd.owned).map(pd=>normalizeItemNum(pd.itemNum)));
      const count = state.masterData.filter(m => (m.itemType||'').toLowerCase().includes('caboose') && owned.has(normalizeItemNum(m.itemNum))).length;
      return { value: count.toLocaleString(), sub: 'cabooses in collection' };
    }
  },
  {
    id: 'freight', label: 'Total Freight Cars', color: '#8e44ad',
    compute: function(state) {
      const owned = new Set(Object.values(state.personalData).filter(pd=>pd.owned).map(pd=>normalizeItemNum(pd.itemNum)));
      const count = state.masterData.filter(m => {
        const t = (m.itemType||'').toLowerCase();
        return (t.includes('freight')||t.includes('box car')||t.includes('boxcar')||t.includes('gondola')||t.includes('hopper')||t.includes('tank')||t.includes('flat')) && owned.has(normalizeItemNum(m.itemNum));
      }).length;
      return { value: count.toLocaleString(), sub: 'freight cars in collection' };
    }
  },
  {
    id: 'passenger', label: 'Total Passenger Cars', color: '#2980b9',
    compute: function(state) {
      const owned = new Set(Object.values(state.personalData).filter(pd=>pd.owned).map(pd=>normalizeItemNum(pd.itemNum)));
      const count = state.masterData.filter(m => (m.itemType||'').toLowerCase().includes('passenger') && owned.has(normalizeItemNum(m.itemNum))).length;
      return { value: count.toLocaleString(), sub: 'passenger cars in collection' };
    }
  },
  {
    id: 'accessories', label: 'Total Accessories', color: '#16a085',
    compute: function(state) {
      const owned = new Set(Object.values(state.personalData).filter(pd=>pd.owned).map(pd=>normalizeItemNum(pd.itemNum)));
      const count = state.masterData.filter(m => (m.itemType||'').toLowerCase().includes('accessor') && owned.has(normalizeItemNum(m.itemNum))).length;
      return { value: count.toLocaleString(), sub: 'accessories in collection' };
    }
  },
  {
    id: 'sets', label: 'Total Sets', color: '#d35400',
    compute: function(state) {
      const owned = new Set(Object.values(state.personalData).filter(pd=>pd.owned).map(pd=>normalizeItemNum(pd.itemNum)));
      const count = state.masterData.filter(m => (m.itemType||'').toLowerCase().includes('set') && owned.has(normalizeItemNum(m.itemNum))).length;
      return { value: count.toLocaleString(), sub: 'sets in collection' };
    }
  },
  {
    id: 'photos', label: 'Items with Photos', color: '#f39c12',
    compute: function(state) {
      const count = Object.values(state.personalData).filter(pd => pd.owned && pd.photoItem).length;
      const total = Object.values(state.personalData).filter(pd => pd.owned).length;
      return { value: count.toLocaleString(), sub: count === 0 ? 'add photos in item detail' : 'of ' + total + ' items have photos' };
    }
  },
  {
    id: 'forsale', label: 'For Sale', color: '#e67e22',
    compute: function(state) {
      const items = Object.values(state.forSaleData||{});
      const count = items.length;
      const total = items.reduce((s,i) => s + (parseFloat(i.askingPrice)||0), 0);
      return { value: count.toLocaleString() + (count===1?' item':' items'), sub: total > 0 ? '$' + Math.round(total).toLocaleString() + ' total asking' : 'no asking prices set' };
    }
  }
];;

const MAX_CARDS = 5;
const _DEFAULT_SLOTS = [{id:'owned'},{id:'value'},{id:'catalog'},null,null];

function _getSlots() {
  try {
    const saved = _prefGet('lv_dash_slots','');
    if (saved) return JSON.parse(saved);
  } catch(e) {}
  // Migrate from old flat array format if present
  try {
    const oldSaved = _prefGet('lv_dash_cards','');
    if (oldSaved) {
      const oldArr = JSON.parse(oldSaved);
      if (Array.isArray(oldArr)) {
        const migrated = [null,null,null,null,null];
        oldArr.slice(0,5).forEach(function(id,i) { migrated[i] = {id:id}; });
        return migrated;
      }
    }
  } catch(e) {}
  return _DEFAULT_SLOTS.map(s => s ? Object.assign({},s) : null);
}

function _saveSlots(slots) {
  _prefSet('lv_dash_slots', JSON.stringify(slots));
}

// ── Card edit popup ───────────────────────────────────────────────
function _openCardPopup(slotIdx) {
  _closeCardPopup();
  const slots = _getSlots();
  const slot   = slots[slotIdx] || null;
  const currentId = slot ? slot.id : '';

  const popup = document.createElement('div');
  popup.id = 'card-popup';
  popup.style.cssText = 'position:fixed;z-index:99990;background:var(--surface,#161c34);border:1px solid var(--border,#2a3a5c);border-radius:12px;padding:1rem;box-shadow:0 8px 32px rgba(0,0,0,0.5);min-width:240px;max-width:280px';

  const opts = CARD_CATALOG.map(function(c) {
    const lbl = c.label;
    return '<option value="' + c.id + '"' + (c.id === currentId ? ' selected' : '') + '>' + lbl + '</option>';
  }).join('');
  popup.innerHTML =
    '<div style="font-size:0.7rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-dim);margin-bottom:0.65rem">Card Slot ' + (slotIdx+1) + '</div>' +
    '<select id="card-popup-select" onchange="_onCardPopupChange(' + slotIdx + ',this.value)" style="width:100%;padding:0.4rem 0.5rem;border-radius:7px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.85rem;margin-bottom:0.65rem">' +
      '<option value="">— None (remove this card) —</option>' + opts +
    '</select>'
    +
    '<div style="display:flex;justify-content:flex-end">' +
      '<button onclick="_closeCardPopup()" style="padding:0.3rem 0.9rem;border-radius:6px;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body);font-size:0.8rem;cursor:pointer">Done</button>' +
    '</div>';

  document.body.appendChild(popup);

  // Position anchored below the card, clamped to viewport
  var cardEl = document.getElementById('dash-card-' + slotIdx);
  if (!cardEl) cardEl = document.getElementById('dash-card-add');
  if (cardEl) {
    var rect = cardEl.getBoundingClientRect();
    var top  = rect.bottom + 8;
    var left = rect.left;
    if (top + 220 > window.innerHeight - 16) top = rect.top - 220 - 8;
    if (left + 280 > window.innerWidth  -  8) left = window.innerWidth - 288;
    if (left < 8) left = 8;
    popup.style.top  = Math.max(8, top)  + 'px';
    popup.style.left = left + 'px';
  } else {
    popup.style.top  = '50%';
    popup.style.left = '50%';
    popup.style.transform = 'translate(-50%,-50%)';
  }

  // Dismiss on outside click
  setTimeout(function() {
    document.addEventListener('mousedown', _popupOutsideClick);
  }, 60);
}

function _popupOutsideClick(e) {
  var p = document.getElementById('card-popup');
  if (p && !p.contains(e.target)) _closeCardPopup();
}

function _closeCardPopup() {
  var p = document.getElementById('card-popup');
  if (p) p.remove();
  document.removeEventListener('mousedown', _popupOutsideClick);
}

function _onCardPopupChange(slotIdx, newId) {
  var slots = _getSlots();
  slots[slotIdx] = newId ? {id: newId} : null;
  _saveSlots(slots);
  buildDashboard();
  // Re-anchor popup to new card position after rebuild
  setTimeout(function() {
    var p = document.getElementById('card-popup');
    var cardEl = document.getElementById('dash-card-' + slotIdx) || document.getElementById('dash-card-add');
    if (p && cardEl) {
      var rect = cardEl.getBoundingClientRect();
      var top  = rect.bottom + 8;
      var left = rect.left;
      if (top + 220 > window.innerHeight - 16) top = rect.top - 220 - 8;
      if (left + 280 > window.innerWidth  -  8) left = window.innerWidth - 288;
      p.style.top  = Math.max(8, top) + 'px';
      p.style.left = Math.max(8, left) + 'px';
    }
  }, 50);
}

function buildDashboard() {
  const total = state.masterData.length;

  // Count ALL owned entries including box-only rows
  const allOwned = Object.values(state.personalData).filter(pd => {
    if (!pd.owned) return false;
    // Exclude pure box-only rows (has box but NO item condition AND NO item price)
    const condVal = pd.condition?.toString().trim();
    const priceVal = pd.priceItem?.toString().trim();
    const noCondition = !condVal || condVal === '' || condVal === 'N/A';
    const noItemPrice = !priceVal || priceVal === '' || priceVal === 'N/A';
    const isBoxOnly = pd.hasBox === 'Yes' && noCondition && noItemPrice;
    return !isBoxOnly; // count everything except pure box-only rows
  });
  const owned = allOwned.length;
  const pct = total > 0 ? Math.round((owned / total) * 100) : 0;

  let totalValue = 0, condSum = 0, condCount = 0, boxedCount = 0, origCount = 0;
  // Count value across ALL owned rows (items + boxes)
  const allOwnedEntries = Object.values(state.personalData).filter(pd => pd.owned);
  allOwnedEntries.forEach(pd => {
    if (pd.priceComplete) totalValue += parseFloat(pd.priceComplete) || 0;
    else if (pd.priceItem && pd.priceItem !== 'N/A') totalValue += parseFloat(pd.priceItem) || 0;
    else if (pd.priceBox) totalValue += parseFloat(pd.priceBox) || 0;
  });
  // Add ephemera values
  let ephemeraCount = 0;
  Object.values(state.ephemeraData || {}).forEach(bucket => {
    Object.values(bucket).forEach(item => {
      ephemeraCount++;
      if (item.estValue) totalValue += parseFloat(item.estValue) || 0;
    });
  });

  allOwned.forEach(pd => {
    if (pd.condition && pd.condition !== 'N/A') { const c = parseInt(pd.condition); if (!isNaN(c)) { condSum += c; condCount++; } }
    if (pd.hasBox === 'Yes') boxedCount++;
    if (pd.allOriginal === 'Yes') origCount++;
  });

  const totalOwned = owned + ephemeraCount;
  // ── Render dashboard stat cards (slot-based) ─────────────────
  const _statsGrid = document.getElementById('stats-grid');
  if (_statsGrid) {
    const slots = _getSlots();
    const activeSlots = slots.map(function(slot,i){return{slot,i};}).filter(function(s){return s.slot!==null;});
    if (activeSlots.length === 0) {
      _statsGrid.innerHTML =
        '<button onclick="_openCardPopup(0)" style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem 1rem;border-radius:8px;border:1.5px dashed var(--border,#2a3a5c);background:transparent;color:var(--text-dim);font-family:var(--font-body);font-size:0.82rem;cursor:pointer" ' +
        'onmouseover="this.style.borderColor=\'var(--accent)\';this.style.color=\'var(--accent)\'" ' +
        'onmouseout="this.style.borderColor=\'var(--border,#2a3a5c)\';this.style.color=\'var(--text-dim)\'">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
        'Add a stat card</button>';
      _statsGrid.style.cssText = 'display:flex;padding:0.25rem 0;margin-bottom:0.5rem';
    } else {
      _statsGrid.style.cssText = '';
      let html = activeSlots.map(function(s) {
        const slot = s.slot, i = s.i;
        const card = CARD_CATALOG.find(function(c){return c.id===slot.id;});
        if (!card) return '';
        const result = card.compute(state, i);
        const cardLabel = card.label;
        return '<div class="stat-card" id="dash-card-' + i + '" style="--card-accent:' + card.color + ';cursor:pointer;position:relative" onclick="_openCardPopup(' + i + ')" title="Click to customize">'
          + '<div style="position:absolute;top:6px;right:8px;font-size:0.65rem;color:var(--text-dim);opacity:0.45">✎</div>'
          + '<div class="stat-label">' + cardLabel + '</div>'
          + '<div class="stat-value">' + result.value + '</div>'
          + '<div class="stat-sub">' + result.sub + '</div>'
          + '</div>';
      }).join('');
      if (activeSlots.length < MAX_CARDS) {
        var nextNull = slots.indexOf(null);
        html += '<div class="stat-card" id="dash-card-add" style="--card-accent:var(--border,#2a3a5c);cursor:pointer;border-style:dashed;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.3rem;opacity:0.55" onclick="_openCardPopup(' + nextNull + ')" onmouseover="this.style.opacity=\'0.9\'" onmouseout="this.style.opacity=\'0.55\'">'
          + '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'
          + '<div style="font-size:0.72rem;color:var(--text-dim);font-family:var(--font-body)">Add card</div>'
          + '</div>';
      }
      _statsGrid.innerHTML = html;
    }
  }

  const soldCount = Object.keys(state.soldData).length;
  const wantCount = total - owned - soldCount;
  document.getElementById('nav-total').textContent = total.toLocaleString();
  document.getElementById('nav-owned').textContent = owned.toLocaleString();
  const wantListCount = Object.keys(state.wantData).length;
  document.getElementById('nav-wanted2').textContent = wantListCount.toLocaleString();
  const _upgradeCount = Object.values(state.upgradeData).length;
  const _upgradeEl = document.getElementById('nav-upgrade-count');
  if (_upgradeEl) _upgradeEl.textContent = _upgradeCount > 0 ? _upgradeCount.toLocaleString() : '—';
  // Quick Entry badge count
  const _qeCount = Object.values(state.personalData).filter(pd => pd.owned && pd.quickEntry).length;
  const _qeBadge = document.getElementById('nav-qe-count');
  if (_qeBadge) _qeBadge.textContent = _qeCount > 0 ? _qeCount : '0';
  const _mnavQeBadge = document.getElementById('mnav-qe-badge');
  if (_mnavQeBadge) { if (_qeCount > 0) { _mnavQeBadge.style.display='flex'; _mnavQeBadge.textContent=_qeCount; } else { _mnavQeBadge.style.display='none'; } }
  if (document.getElementById('nav-sold')) document.getElementById('nav-sold').textContent = soldCount;
  const fsCount = Object.keys(state.forSaleData).length;
  if (document.getElementById('nav-forsale')) document.getElementById('nav-forsale').textContent = fsCount;



  // ── Dynamic large panels ──────────────────────────────────
  (function() {
    var panels = _getPanels();
    [0, 1].forEach(function(i) {
      var panelDef = PANEL_CATALOG.find(function(p) { return p.id === (panels[i] ? panels[i].id : (i === 0 ? 'recent' : 'wants')); })
                  || PANEL_CATALOG[i] || PANEL_CATALOG[0];

      // Update header: title (clickable if panel has navFn) + pencil icon
      var headerEl = document.getElementById('dash-panel-header-' + i);
      if (headerEl) {
        var titleHtml = panelDef.navFn
          ? '<span style="cursor:pointer;text-decoration:none" onclick="' + panelDef.navFn + '" title="Go to ' + panelDef.label + '">' + panelDef.icon + ' ' + panelDef.label + ' <span style="font-size:0.65rem;opacity:0.5">›</span></span>'
          : '<span>' + panelDef.icon + ' ' + panelDef.label + '</span>';
        headerEl.innerHTML = titleHtml
          + '<button onclick="_openPanelPopup(' + i + ')" title="Change panel" '
          + 'style="background:none;border:none;cursor:pointer;color:var(--text-dim);font-size:0.75rem;padding:0.1rem 0.3rem;border-radius:4px;opacity:0.55;line-height:1" '
          + 'onmouseover="this.style.opacity=\'1\'" onmouseout="this.style.opacity=\'0.55\'">✎</button>';
      }

      // Render panel body
      var bodyEl = document.getElementById('dash-panel-body-' + i);
      if (bodyEl) {
        try {
          bodyEl.innerHTML = panelDef.render(state);
        } catch(e) {
          bodyEl.innerHTML = '<div class="empty-state"><p>Could not load panel</p></div>';
        }
      }
    });
  })();
}


// ── Dashboard Panel System ─────────────────────────────────────────────────
const PANEL_CATALOG = [
  {
    id: 'recent',
    label: 'Recent Additions',
    icon: '🕐',
    navFn: "showPage('browse', document.querySelector('.nav-item[onclick*=\'renderBrowse\']')); resetFilters(); renderBrowse();",
    render: function(state) {
      const trains = Object.values(state.personalData).filter(pd => pd.owned)
        .map(pd => ({ ...pd, _src: 'train' }));
      const ephMap = { catalogs:'📒', paper:'📄', mockups:'🔩', other:'📦' };
      const ephs = [];
      Object.entries(state.ephemeraData || {}).forEach(([tabId, bucket]) => {
        Object.values(bucket).forEach(it => {
          ephs.push({ ...it, _src:'eph', tabId, _ephEmoji: ephMap[tabId]||'⭐' });
        });
      });
      return [...trains, ...ephs]
        .sort((a, b) => (b.row || 0) - (a.row || 0))
        .slice(0, 8)
        .map(function(pd) {
          if (pd._src === 'eph') {
            const val = pd.estValue ? '$' + parseFloat(pd.estValue).toLocaleString() : '';
            return _panelRow(
              pd._ephEmoji, pd.title || '—', '', val,
              'goToMyCollection()', null
            );
          }
          const master = state.masterData.find(m => normalizeItemNum(m.itemNum) === normalizeItemNum(pd.itemNum));
          const name = master ? (master.roadName || master.itemType || pd.itemNum) : pd.itemNum;
          const price = pd.priceItem ? '$' + parseFloat(pd.priceItem).toLocaleString() : '';
          const date = pd.datePurchased || '';
          const meta = [date, price].filter(Boolean).join(' · ');
          const idx = master ? state.masterData.indexOf(master) : -1;
          const hasPhoto = !!pd.photoItem;
          return _panelRow('🚂', pd.itemNum + (pd.variation ? ' <span style="font-size:0.7rem;color:var(--text-dim)">' + pd.variation + '</span>' : ''), name, meta,
            idx >= 0 ? 'showItemDetailPage(' + idx + ')' : 'goToMyCollection()', hasPhoto ? pd.photoItem : null
          );
        }).join('') || '<div class="empty-state"><p>No items yet</p></div>';
    }
  },
  {
    id: 'wants',
    label: 'Top Want List Items',
    icon: '⭐',
    navFn: "goToWantList();",
    render: function(state) {
      const priOrder = { High: 0, Medium: 1, Low: 2 };
      const priColor = { High: 'var(--accent)', Medium: 'var(--accent2,#8b5cf6)', Low: 'var(--text-dim)' };
      return Object.values(state.wantData)
        .sort((a, b) => ((priOrder[a.priority] ?? 1) - (priOrder[b.priority] ?? 1)))
        .slice(0, 8)
        .map(function(w) {
          const master = state.masterData.find(m => m.itemNum === w.itemNum);
          const name = master ? (master.roadName || master.itemType || w.itemNum) : w.itemNum;
          const price = w.expectedPrice ? '$' + parseFloat(w.expectedPrice).toLocaleString() : '';
          const pc = priColor[w.priority] || 'var(--text-dim)';
          const badge = '<span style="font-size:0.72rem;font-weight:600;color:' + pc + ';border:1px solid ' + pc + ';border-radius:3px;padding:0.1rem 0.3rem;flex-shrink:0">' + (w.priority || 'Med') + '</span>';
          const idx = master ? state.masterData.indexOf(master) : -1;
          return _panelRow('⭐', w.itemNum + (w.variation ? ' <span style="font-size:0.7rem;color:var(--text-dim)">' + w.variation + '</span>' : ''), name, price,
            idx >= 0 ? 'showItemDetailPage(' + idx + ')' : 'goToWantList()', null, badge
          );
        }).join('') || '<div class="empty-state"><p>Want list is empty</p></div>';
    }
  },
  {
    id: 'forsale',
    label: 'For Sale',
    icon: '🏷️',
    navFn: "showPage('forsale', document.querySelector('.nav-item[onclick*=\'buildForSalePage\']')); buildForSalePage();",
    render: function(state) {
      return Object.values(state.forSaleData)
        .sort((a, b) => (parseFloat(b.askingPrice) || 0) - (parseFloat(a.askingPrice) || 0))
        .slice(0, 8)
        .map(function(fs) {
          const master = state.masterData.find(m => m.itemNum === fs.itemNum) || {};
          const name = master.roadName || master.itemType || '';
          const price = fs.askingPrice ? '$' + parseFloat(fs.askingPrice).toLocaleString() : 'No price';
          const idx = master ? state.masterData.indexOf(master) : -1;
          const pd = state.personalData[fs.itemNum + '|' + (fs.variation||'')] || {};
          const hasPhoto = !!pd.photoItem;
          return _panelRow('🏷️', fs.itemNum + (fs.variation ? ' <span style="font-size:0.7rem;color:var(--text-dim)">' + fs.variation + '</span>' : ''), name, price,
            idx >= 0 ? 'showItemDetailPage(' + idx + ')' : 'showPage(\'forsale\', document.querySelector(\'.nav-item[onclick*=buildForSalePage]\'));buildForSalePage();',
            hasPhoto ? pd.photoItem : null
          );
        }).join('') || '<div class="empty-state" style="padding:1.5rem 0"><p>No items listed for sale</p></div>';
    }
  },
  {
    id: 'value',
    label: 'Highest Value Items',
    icon: '💰',
    navFn: "showPage('browse', document.querySelector('.nav-item[onclick*=\'filterOwned\']')); filterOwned();",
    render: function(state) {
      return Object.values(state.personalData)
        .filter(pd => pd.owned && (pd.priceComplete || pd.priceItem))
        .map(pd => ({
          ...pd,
          _val: parseFloat(pd.priceComplete || pd.priceItem || 0)
        }))
        .sort((a, b) => b._val - a._val)
        .slice(0, 8)
        .map(function(pd) {
          const master = state.masterData.find(m => normalizeItemNum(m.itemNum) === normalizeItemNum(pd.itemNum));
          const name = master ? (master.roadName || master.itemType || pd.itemNum) : pd.itemNum;
          const price = '$' + pd._val.toLocaleString();
          const idx = master ? state.masterData.indexOf(master) : -1;
          const hasPhoto = !!pd.photoItem;
          return _panelRow('💰', pd.itemNum + (pd.variation ? ' <span style="font-size:0.7rem;color:var(--text-dim)">' + pd.variation + '</span>' : ''), name, price,
            idx >= 0 ? 'showItemDetailPage(' + idx + ')' : 'goToMyCollection()', hasPhoto ? pd.photoItem : null
          );
        }).join('') || '<div class="empty-state"><p>No valued items yet</p></div>';
    }
  },
  {
    id: 'upgrades',
    label: 'Upgrade Targets',
    icon: '↑',
    navFn: "showPage('upgrade', document.querySelector('.nav-item[onclick*=\'buildUpgradePage\']')); buildUpgradePage();",
    render: function(state) {
      const thresh = parseInt(_prefGet('lv_upgrade_thresh', '7'));
      const entries = Object.values(state.upgradeData || {});
      const priorityOrder = { High: 0, Medium: 1, Low: 2 };
      return entries
        .sort((a, b) => {
          const pA = priorityOrder[a.priority] ?? 1;
          const pB = priorityOrder[b.priority] ?? 1;
          if (pA !== pB) return pA - pB;
          const pdA = Object.values(state.personalData).find(p => p.owned && p.itemNum === a.itemNum && (p.variation||'') === (a.variation||''));
          const pdB = Object.values(state.personalData).find(p => p.owned && p.itemNum === b.itemNum && (p.variation||'') === (b.variation||''));
          return (parseInt(pdA && pdA.condition || 99)) - (parseInt(pdB && pdB.condition || 99));
        })
        .slice(0, 8)
        .map(function(u) {
          const pd = Object.values(state.personalData).find(p => p.owned && p.itemNum === u.itemNum && (p.variation||'') === (u.variation||''));
          const master = state.masterData.find(m => m.itemNum === u.itemNum);
          const name = master ? (master.roadName || master.itemType || u.itemNum) : u.itemNum;
          const cond = pd && pd.condition ? parseInt(pd.condition) : null;
          const meta = [cond ? 'Cond: ' + cond : '', u.targetCondition ? '→ ' + u.targetCondition : ''].filter(Boolean).join(' ');
          const idx = master ? state.masterData.indexOf(master) : -1;
          const hasPhoto = pd && !!pd.photoItem;
          return _panelRow('↑', u.itemNum + (u.variation ? ' <span style="font-size:0.7rem;color:var(--text-dim);">' + u.variation + '</span>' : ''), name, meta,
            idx >= 0 ? 'showItemDetailPage(' + idx + ')' : "showPage('upgrade',null);buildUpgradePage()", hasPhoto ? pd.photoItem : null
          );
        }).join('') || '<div class="empty-state"><p>No upgrade targets yet</p></div>';
    }
  }
];

// Shared row renderer for all panels
function _panelRow(icon, itemHtml, name, meta, onclick, photoUrl, extraBadge) {
  const thumb = photoUrl
    ? '<img src="' + photoUrl + '" style="width:32px;height:32px;object-fit:cover;border-radius:5px;flex-shrink:0;border:1px solid var(--border)" onerror="this.style.display=\'none\'">'
    : '<div style="width:32px;height:32px;border-radius:5px;background:var(--surface2);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:1rem">' + icon + '</div>';
  return '<div onclick="' + onclick + '" class="dash-row-hover" style="display:flex;align-items:center;gap:0.55rem;padding:0.45rem 0;border-bottom:1px solid var(--border);cursor:pointer">'
    + thumb
    + '<div style="flex:1;min-width:0">'
    + '<div style="display:flex;align-items:center;gap:0.35rem;flex-wrap:wrap">'
    + '<span class="item-num" style="font-size:0.82rem">' + itemHtml + '</span>'
    + (name ? '<span style="font-size:0.78rem;color:var(--text-mid);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">' + name + '</span>' : '')
    + '</div>'
    + (meta ? '<div style="font-size:0.7rem;color:var(--text-dim);margin-top:1px">' + meta + '</div>' : '')
    + '</div>'
    + (extraBadge || '')
    + '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>'
    + '</div>';
}

const _DEFAULT_PANELS = [{id:'recent'}, {id:'wants'}];

function _getPanels() {
  try {
    const saved = _prefGet('lv_dash_panels', '');
    if (saved) return JSON.parse(saved);
  } catch(e) {}
  return [{ id: 'recent' }, { id: 'wants' }];
}

function _savePanels(panels) {
  _prefSet('lv_dash_panels', JSON.stringify(panels));
}

function _openPanelPopup(panelIdx) {
  var existing = document.getElementById('panel-popup');
  if (existing) { existing.remove(); return; }

  const panels = _getPanels();
  const currentId = panels[panelIdx] ? panels[panelIdx].id : 'recent';

  const popup = document.createElement('div');
  popup.id = 'panel-popup';
  popup.style.cssText = 'position:fixed;z-index:99990;background:var(--surface,#161c34);border:1px solid var(--border,#2a3a5c);border-radius:12px;padding:1rem;box-shadow:0 8px 32px rgba(0,0,0,0.5);min-width:220px;max-width:260px';

  const opts = PANEL_CATALOG.map(function(p) {
    return '<option value="' + p.id + '"' + (p.id === currentId ? ' selected' : '') + '>' + p.icon + ' ' + p.label + '</option>';
  }).join('');

  popup.innerHTML =
    '<div style="font-size:0.7rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-dim);margin-bottom:0.65rem">Panel ' + (panelIdx + 1) + '</div>' +
    '<select onchange="_onPanelPopupChange(' + panelIdx + ',this.value)" style="width:100%;padding:0.4rem 0.5rem;border-radius:7px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.85rem;margin-bottom:0.65rem">' +
      opts +
    '</select>' +
    '<div style="display:flex;justify-content:flex-end">' +
      '<button onclick="document.getElementById(\'panel-popup\').remove()" style="padding:0.3rem 0.9rem;border-radius:6px;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body);font-size:0.8rem;cursor:pointer">Done</button>' +
    '</div>';

  document.body.appendChild(popup);

  // Position anchored to the panel header
  var headerEl = document.getElementById('dash-panel-header-' + panelIdx);
  if (headerEl) {
    var rect = headerEl.getBoundingClientRect();
    var top = rect.bottom + 6;
    var left = rect.left;
    if (top + 160 > window.innerHeight - 16) top = rect.top - 160 - 6;
    if (left + 260 > window.innerWidth - 8) left = window.innerWidth - 268;
    if (left < 8) left = 8;
    popup.style.top  = Math.max(8, top) + 'px';
    popup.style.left = left + 'px';
  } else {
    popup.style.top = '50%'; popup.style.left = '50%';
    popup.style.transform = 'translate(-50%,-50%)';
  }

  setTimeout(function() {
    document.addEventListener('mousedown', _panelPopupOutsideClick);
  }, 60);
}

function _panelPopupOutsideClick(e) {
  var p = document.getElementById('panel-popup');
  if (p && !p.contains(e.target)) {
    p.remove();
    document.removeEventListener('mousedown', _panelPopupOutsideClick);
  }
}

function _onPanelPopupChange(panelIdx, newId) {
  var panels = _getPanels();
  panels[panelIdx] = { id: newId };
  _savePanels(panels);
  buildDashboard();
  // Re-open popup anchored to new header
  setTimeout(function() {
    var p = document.getElementById('panel-popup');
    if (!p) return;
    var headerEl = document.getElementById('dash-panel-header-' + panelIdx);
    if (headerEl) {
      var rect = headerEl.getBoundingClientRect();
      var top = rect.bottom + 6;
      var left = rect.left;
      if (top + 160 > window.innerHeight - 16) top = rect.top - 160 - 6;
      if (left + 260 > window.innerWidth - 8) left = window.innerWidth - 268;
      p.style.top  = Math.max(8, top) + 'px';
      p.style.left = Math.max(8, left) + 'px';
    }
  }, 60);
}

// ── BROWSE ──────────────────────────────────────────────────────
function populateFilters() {
  const types = [...new Set(state.masterData.map(i => i.itemType).filter(Boolean))].sort();
  const roads = [...new Set(state.masterData.map(i => i.roadName).filter(Boolean))].sort();

  const typeEl = document.getElementById('filter-type');
  types.forEach(t => { const o = document.createElement('option'); o.value = t; o.textContent = t; typeEl.appendChild(o); });

  // Add ephemera types as a group
  const ephemeraTypes = ['Catalog','Paper Item','Mock-Up','Other Lionel'];
  // Also add catalog sub-types actually present in data
  const catSubTypes = [...new Set(
    Object.values(state.ephemeraData.catalogs||{}).map(it=>it.catType).filter(Boolean)
  )].sort();
  const hasCatalogs = Object.keys(state.ephemeraData.catalogs||{}).length > 0;
  const hasOtherEph = ['paper','mockups','other'].some(k => Object.keys(state.ephemeraData[k]||{}).length > 0);
  const userEph = (state.userDefinedTabs||[]).filter(t => Object.keys(state.ephemeraData[t.id]||{}).length > 0);

  // Always add a separator then ephemera/collection categories
  const sep = document.createElement('option');
  sep.disabled = true; sep.textContent = '── My Collection ──';
  typeEl.appendChild(sep);
  // Catalog with subtypes
  const oCat = document.createElement('option'); oCat.value = 'Catalog'; oCat.textContent = '📒 Catalogs (all)'; typeEl.appendChild(oCat);
  catSubTypes.forEach(ct => {
    const o2 = document.createElement('option'); o2.value = ct; o2.textContent = '  ' + ct + ' Catalog'; typeEl.appendChild(o2);
  });
  const oPaper = document.createElement('option'); oPaper.value = 'Paper Item'; oPaper.textContent = '📄 Paper Items'; typeEl.appendChild(oPaper);
  const oMock = document.createElement('option'); oMock.value = 'Mock-Up'; oMock.textContent = '🔩 Mock-Ups'; typeEl.appendChild(oMock);
  const oOther = document.createElement('option'); oOther.value = 'Other Lionel'; oOther.textContent = '📦 Other Lionel'; typeEl.appendChild(oOther);
  const oIS = document.createElement('option'); oIS.value = 'Instruction Sheet'; oIS.textContent = '📋 Instruction Sheets'; typeEl.appendChild(oIS);
  userEph.forEach(t => {
    const o = document.createElement('option'); o.value = t.label; o.textContent = '⭐ ' + t.label; typeEl.appendChild(o);
  });

  const roadEl = document.getElementById('filter-road');
  roads.slice(0, 80).forEach(r => { const o = document.createElement('option'); o.value = r; o.textContent = r; roadEl.appendChild(o); });
}

// ── Browse filter popup ──────────────────────────────────────────
function toggleBrowseFilterPanel() {
  const panel = document.getElementById('browse-filter-panel');
  if (!panel) return;
  const isOpen = panel.style.display === 'block';
  panel.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    setTimeout(() => {
      document.addEventListener('click', function _closeFP(e) {
        const btn = document.getElementById('browse-filter-btn');
        if (panel && !panel.contains(e.target) && btn && !btn.contains(e.target)) {
          panel.style.display = 'none';
          document.removeEventListener('click', _closeFP);
        }
      });
    }, 0);
  }
}

function updateFilterBadge() {
  const badge = document.getElementById('browse-filter-badge');
  const btn   = document.getElementById('browse-filter-btn');
  if (!badge) return;
  const t = (document.getElementById('filter-type')?.value || '').trim();
  const r = (document.getElementById('filter-road')?.value || '').trim();
  const count = (t ? 1 : 0) + (r ? 1 : 0);
  badge.textContent = count;
  badge.style.display = count > 0 ? 'inline' : 'none';
  if (btn) btn.style.borderColor = count > 0 ? 'var(--accent)' : 'var(--border)';
  if (btn) btn.style.color = count > 0 ? 'var(--accent)' : 'var(--text-mid)';
}

function clearBrowseFilters() {
  const ft = document.getElementById('filter-type');
  const fr = document.getElementById('filter-road');
  if (ft) ft.value = '';
  if (fr) fr.value = '';
  updateFilterBadge();
  applyFilters();
}

function applyFilters() {
  state.filters.type = document.getElementById('filter-type').value;
  state.filters.quickEntry = ''; // QE filter only applies in My Collection view
  state.filters.road = document.getElementById('filter-road').value;
  state.filters.wantList = false;
  state.currentPage = 1;
  renderBrowse();
}

function toggleFilter(name) {
  state.filters[name] = !state.filters[name];
  document.getElementById('toggle-' + name).classList.toggle('on', state.filters[name]);
  state.currentPage = 1;
  renderBrowse();
}

function resetFilters() {
  // Restore Master Catalog title and Identify button
  const titleEl = document.querySelector('#page-browse > .page-title > span');
  if (titleEl) {
    titleEl.textContent = 'Master Catalog';
    titleEl.style.cssText = '';
  }
  const idBtn = document.getElementById('identify-btn');
  if (idBtn) idBtn.style.display = '';
  // Restore table headers to default
  const thead = document.querySelector('#page-browse .item-table thead tr');
  if (thead) thead.innerHTML = '<th>Item #</th><th>Type</th><th>Road / Name</th><th>Var.</th><th>Var. Descr.</th><th>Year</th><th>Owned</th>';
  var _leg = document.getElementById('collection-icon-legend');
  if (_leg) _leg.style.display = 'none';
  removeQEFilter();
  state.filters.owned = false;
  state.filters.unowned = false;
  state.filters.boxed = false;
  state.filters.wantList = false;
  state.filters.type = '';
  state.filters.road = '';
  state.filters.quickEntry = '';
  state.currentPage = 1;
  document.getElementById('filter-type').value = '';
  document.getElementById('filter-road').value = '';
  updateFilterBadge();
}

function filterOwned(qe) {
  resetFilters();
  state.filters.owned = true;
  if (qe) state.filters.quickEntry = qe;
  // Switch title to My Collection List — styled to match button size
  const titleEl = document.querySelector('#page-browse > .page-title > span');
  if (titleEl) {
    titleEl.textContent = 'My Collection List';
    titleEl.style.cssText = 'font-family:var(--font-head);font-size:0.95rem;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:var(--text)';
  }
  const idBtn = document.getElementById('identify-btn');
  if (idBtn) idBtn.style.display = 'none';
  // Update table headers for collection view
  const thead = document.querySelector('#page-browse .item-table thead tr');
  if (thead) thead.innerHTML = '<th>Item #</th><th>Variation</th><th>Description</th><th>Actions</th>';
  var _leg = document.getElementById('collection-icon-legend');
  if (_leg) _leg.style.display = 'flex';
  renderBrowse();
  // Show QE filter toggle in filter bar when in My Collection
  setTimeout(function() {
    var existing = document.getElementById('filter-quick-inline');
    if (!existing) {
      var fb = document.querySelector('.filter-bar');
      if (!fb) return;
      var sel = document.createElement('select');
      sel.id = 'filter-quick-inline';
      sel.className = 'filter-select';
      sel.title = 'Quick Entry filter';
      sel.innerHTML = '<option value="">All Items</option>'
        + '<option value="quick">&#9889; Quick Entry</option>'
        + '<option value="complete">&#10003; Complete</option>';
      sel.value = state.filters.quickEntry || '';
      sel.onchange = function() { state.filters.quickEntry = this.value; renderBrowse(); };
      // Insert after first child (type filter)
      var typeFilter = fb.querySelector('#filter-type');
      if (typeFilter && typeFilter.nextSibling) {
        fb.insertBefore(sel, typeFilter.nextSibling);
      } else {
        fb.appendChild(sel);
      }
    }
  }, 50);
}

function removeQEFilter() {
  var el = document.getElementById('filter-quick-inline');
  if (el) el.remove();
  state.filters.quickEntry = '';
}

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
    }) || state.masterData.find(function(m) { return m.itemNum === pd.itemNum; });
    var itemName = master ? (master.roadName || master.description || master.itemType || '') : '';
    var itemType = master ? (master.itemType || '') : '';
    var itemYear = master ? (master.yearProd || '') : '';
    var variation = pd.variation || '';
    var meta = [itemType, itemYear].filter(Boolean).join(' · ');

    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:0.85rem;padding:0.9rem 1rem;background:var(--surface);border:1.5px solid rgba(39,174,96,0.3);border-radius:12px;cursor:pointer;transition:all 0.15s';
    row.onmouseenter = function() { this.style.borderColor='#27ae60'; this.style.background='rgba(39,174,96,0.06)'; };
    row.onmouseleave = function() { this.style.borderColor='rgba(39,174,96,0.3)'; this.style.background='var(--surface)'; };
    row.onclick = (function(num, vari) { return function() {
      // Find the pdKey for this item and open its detail panel
      var prefix = num + '|' + vari + '|';
      var exact = Object.keys(state.personalData).find(function(k) { return k.startsWith(prefix); });
      if (!exact) { exact = Object.keys(state.personalData).find(function(k) { return k.startsWith(num + '|'); }); }
      if (exact) { showOwnedItemMenu(-1, exact); }
    }; })(pd.itemNum, variation);

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
    right.innerHTML = '<div style="font-size:0.72rem;color:#27ae60;font-weight:600;background:rgba(39,174,96,0.1);padding:0.25rem 0.5rem;border-radius:5px;margin-bottom:0.3rem;white-space:nowrap">Needs info</div>'
      + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>';

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

function filterByType(type) { document.getElementById('filter-type').value = type; showPage('browse'); applyFilters(); }

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

function buildBrowse() { renderBrowse(); }

let _lastBrowseHash = '';

function renderBrowse() {
  const { type, road, owned, unowned, boxed, search } = state.filters;
  // Base list: masterData + any personal-only items (e.g. 2343-P not in master)
  const masterNums = new Set(state.masterData.map(m => m.itemNum + '|' + (m.variation||'')));
  const personalOnlyItems = Object.values(state.personalData)
    .filter(pd => pd.owned && !masterNums.has(pd.itemNum + '|' + (pd.variation||'')))
    .map(pd => {
      // Infer type from item number suffix for personal-only items
      let _poType = pd.itemType || '';
      const _num = (pd.itemNum || '').toUpperCase();
      if (!_poType) {
        if (_num.endsWith('-MBOX'))      _poType = 'Master Carton';
        else if (_num.endsWith('-BOX'))  _poType = 'Box';
        else if (_num.endsWith('-P'))    _poType = 'Powered Unit';
        else if (_num.endsWith('-T'))    _poType = 'Dummy Unit';
      }
      // Strip suffix to find the base item for description/roadName
      const _baseNum = pd.itemNum.replace(/-(P|T|BOX|MBOX)$/i, '');
      const _baseItem = _baseNum !== pd.itemNum
        ? (state.masterData.find(m => m.itemNum === _baseNum && (!pd.variation || m.variation === pd.variation))
           || state.masterData.find(m => m.itemNum === _baseNum))
        : null;
      return {
        itemNum: pd.itemNum, variation: pd.variation || '',
        itemType: _poType || (_baseItem ? _baseItem.itemType : ''),
        roadName: pd.roadName || (_baseItem ? _baseItem.roadName : ''),
        description: _baseItem ? _baseItem.description : (pd.notes || ''),
        yearProd: pd.datePurchased || (_baseItem ? _baseItem.yearProd : ''),
        marketVal: _baseItem ? _baseItem.marketVal : '',
        varDesc: _baseItem ? _baseItem.varDesc : '',
        refLink: _baseItem ? _baseItem.refLink : '',
        _personalOnly: true
      };
    });
  const baseList = owned ? [...state.masterData, ...personalOnlyItems] : state.masterData;

  state.filteredData = baseList.filter(item => {
    const pd = findPD(item.itemNum, item.variation) || (item._personalOnly ? item : null);
    const isOwned = item._personalOnly ? true : (pd?.owned || false);
    const hasBox = pd?.hasBox === 'Yes';
    const isSold = !!state.soldData[`${item.itemNum}|${item.variation}`];
    if (isSold) return false;
    const isWanted = !!state.wantData[`${item.itemNum}|${item.variation}`];
    if (state.filters.wantList && !isWanted) return false;
    if (owned && !isOwned) return false;
    if (unowned && (isOwned || isWanted)) return false;
    if (boxed && !hasBox) return false;
    // Quick Entry filter — only applies when item is owned
    if (isOwned && pd) {
      const _qf = state.filters.quickEntry || '';
      if (_qf === 'quick' && !pd.quickEntry) return false;
      if (_qf === 'complete' && pd.quickEntry) return false;
    }
    // If type filter is an ephemera category, hide train rows
    if (type) {
      const _ephTypeKeys = ['Catalog','Paper Item','Mock-Up','Other Lionel',
        ...(state.userDefinedTabs||[]).map(t=>t.label)];
      // Check for catalog subtype match too (e.g. "Advance")
      const _isEphFilter = _ephTypeKeys.some(k=>k.toLowerCase()===type.toLowerCase())
        || type.toLowerCase() === 'instruction sheet'
        || Object.values(state.ephemeraData.catalogs||{}).some(it=>(it.catType||'').toLowerCase()===type.toLowerCase());
      if (_isEphFilter) return false; // hide all train rows when filtering to ephemera
      if (item.itemType !== type) return false;
    }
    if (road && item.roadName !== road) return false;
    if (search) {
      const haystack = `${item.itemNum} ${item.roadName||''} ${item.description||''} ${item.itemType||''}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  // Sort My Collection: by item number, with grouped items together
  if (state.filters.owned) {
    state.filteredData.sort((a, b) => {
      const pdA = findPD(a.itemNum, a.variation) || {};
      const pdB = findPD(b.itemNum, b.variation) || {};
      const gA = pdA.groupId || '';
      const gB = pdB.groupId || '';
      // If same group, sort by item number within group
      if (gA && gA === gB) {
        const numA = (a.itemNum||'').replace(/[^0-9]/g,'');
        const numB = (b.itemNum||'').replace(/[^0-9]/g,'');
        return (parseInt(numA)||0) - (parseInt(numB)||0) || (a.itemNum||'').localeCompare(b.itemNum||'');
      }
      // Otherwise sort by the group's lead item number (extract from GRP-XXXX-timestamp)
      const leadA = gA ? gA.split('-').slice(1,-1).join('-') : a.itemNum;
      const leadB = gB ? gB.split('-').slice(1,-1).join('-') : b.itemNum;
      const numA = (leadA||'').replace(/[^0-9]/g,'');
      const numB = (leadB||'').replace(/[^0-9]/g,'');
      if (numA !== numB) return (parseInt(numA)||0) - (parseInt(numB)||0);
      return (leadA||'').localeCompare(leadB||'') || (a.itemNum||'').localeCompare(b.itemNum||'');
    });
  }
  const total = state.filteredData.length;
  const pages = Math.ceil(total / state.pageSize);
  const start = (state.currentPage - 1) * state.pageSize;
  const pageData = state.filteredData.slice(start, start + state.pageSize);

  // Ephemera items — shown when owned filter is on OR search has text OR type filter matches an ephemera category
  const _ephemeraRows = [];
  const _ephLabels = { catalogs:'Catalog', paper:'Paper Item', mockups:'Mock-Up', other:'Other Lionel' };
  const _ephEmojis = { catalogs:'📒', paper:'📄', mockups:'🔩', other:'📦' };
  const _ephColors = { catalogs:'#e67e22', paper:'#3498db', mockups:'#9b59b6', other:'#27ae60' };
  const _ephTypeMap = { 'Catalog':'catalogs', 'Paper Item':'paper', 'Mock-Up':'mockups', 'Other Lionel':'other' };
  const sq = (state.filters.search||'').toLowerCase();
  const tf = (state.filters.type||'').toLowerCase();
  // Show ephemera if: owned view, searching, or type filter is an ephemera category
  const _showEph = state.filters.owned || sq || Object.keys(_ephTypeMap).some(k => k.toLowerCase() === tf);
  // Instruction Sheets in browse
  if (_showEph || tf === 'instruction sheet') {
    const isItems = Object.values(state.isData || {});
    const isFiltered = isItems.filter(it => {
      if (sq && !`${it.sheetNum||''} ${it.linkedItem||''} ${it.year||''} ${it.notes||''}`.toLowerCase().includes(sq)) return false;
      if (tf && tf !== 'instruction sheet' && tf !== 'catalog') {
        // Check linked item match
        if (!(it.linkedItem||'').toLowerCase().includes(tf) && !(it.sheetNum||'').toLowerCase().includes(tf)) return false;
      }
      return true;
    });
    if (isFiltered.length) {
      _ephemeraRows.push({ _divider: true, label: '📋 Instruction Sheets', color: '#16a085' });
      isFiltered.sort((a,b)=>(a.linkedItem||'').localeCompare(b.linkedItem||'')).forEach(it => {
        _ephemeraRows.push({ _is: true, item: it, label:'Instruction Sheet', emoji:'📋', color:'#16a085' });
      });
    }
  }
  if (_showEph) {
    Object.entries(state.ephemeraData || {}).forEach(([tabId, bucket]) => {
      const items = Object.values(bucket);
      if (!items.length) return;
      const label = _ephLabels[tabId] || ((state.userDefinedTabs||[]).find(t=>t.id===tabId)||{}).label || tabId;
      const emoji = _ephEmojis[tabId] || '⭐';
      const color = _ephColors[tabId] || '#f39c12';
      // Type filter: if a specific ephemera type is selected, only show that bucket
      if (tf && Object.keys(_ephTypeMap).some(k=>k.toLowerCase()===tf) && label.toLowerCase() !== tf) return;
      // Also filter by catType if type filter matches a subtype like "Advance", "Consumer"
      const filtered = items.filter(it => {
        // Search filter across all fields
        if (sq && !`${it.title||''} ${it.year||''} ${it.notes||''} ${it.catType||''} ${label}`.toLowerCase().includes(sq)) return false;
        // Type dropdown filter — match label (Catalog) or catType (Advance/Consumer/Dealer)
        if (tf) {
          const matchesLabel = label.toLowerCase().includes(tf);
          const matchesCatType = (it.catType||'').toLowerCase().includes(tf);
          if (!matchesLabel && !matchesCatType) return false;
        }
        return true;
      });
      if (!filtered.length) return;
      _ephemeraRows.push({ _divider: true, label: emoji + ' ' + label + 's', color });
      filtered.sort((a,b)=>(b.row||0)-(a.row||0)).forEach(it => {
        _ephemeraRows.push({ _eph: true, tabId, item: it, label, emoji, color });
      });
    });
  }
  const ephTotal = _ephemeraRows.filter(r=>r._eph).length;
  const displayTotal = total + ephTotal;
  document.getElementById('result-count').textContent = `${displayTotal.toLocaleString()} items`;
  document.getElementById('page-info').textContent = `Showing ${start+1}–${Math.min(start+state.pageSize, total)} of ${total.toLocaleString()} trains${ephTotal ? ' + ' + ephTotal + ' other' : ''}`;

  // Rows
  const tbody = document.getElementById('browse-tbody');
  const isMobile = window.innerWidth <= 640;
  const cardsEl = document.getElementById('browse-cards');
  const tableEl = document.querySelector('.item-table');
  let _ephRowsHtml = '';
  if (_ephemeraRows.length) {
    _ephRowsHtml = _ephemeraRows.map(r => {
      if (r._divider) return `<tr><td colspan="${state.filters.owned ? '4' : '7'}" style="padding:0.5rem 0.75rem;background:var(--surface2);font-size:0.72rem;font-weight:600;letter-spacing:0.1em;color:${r.color};text-transform:uppercase;border-top:2px solid ${r.color}33">${r.label}</td></tr>`;
      const it = r.item;
      const cond = it.condition ? parseInt(it.condition) : null;
      const condClass = cond >= 9 ? 'cond-9' : cond >= 7 ? 'cond-7' : cond >= 5 ? 'cond-5' : cond ? 'cond-low' : '';
      if (r._is) {
        if (state.filters.owned) {
          return `<tr onclick="openISDetail(${it.row})" style="cursor:pointer">
            <td><span style="font-family:var(--font-mono);font-size:0.85rem;color:#16a085;font-weight:600">${it.sheetNum}</span></td>
            <td><span class="text-dim">—</span></td>
            <td style="text-align:center"><button onclick="event.stopPropagation();openISDetail(${it.row})" style="padding:0.25rem 0.6rem;border-radius:6px;border:1px solid #16a085;background:#16a08518;color:#16a085;font-family:var(--font-body);font-size:0.75rem;cursor:pointer;font-weight:600">Details</button></td>
            <td><span class="tag" style="border-color:#16a085;color:#16a085;background:#16a08518">Instr. Sheet</span></td>
            <td></td><td></td>
            <td style="text-align:center;white-space:nowrap"><span style="color:var(--text-dim);font-size:0.75rem">For #${it.linkedItem || '—'}</span></td>
          </tr>`;
        }
        return `<tr onclick="openISDetail(${it.row})" style="cursor:pointer">
          <td><span style="font-family:var(--font-mono);font-size:0.85rem;color:#16a085;font-weight:600">${it.sheetNum}</span></td>
          <td><span class="tag" style="border-color:#16a085;color:#16a085;background:#16a08518">Instr. Sheet</span></td>
          <td>For item #${it.linkedItem || '—'}</td>
          <td>${it.year || '—'}</td>
          <td></td><td></td>
          <td><span class="owned-badge badge-owned">✓ Owned</span></td>
          <td>${cond ? `<span class="condition-pip ${condClass}"></span>${cond}` : '<span class="text-dim">—</span>'}</td>
          <td class="market-val">—</td>
        </tr>`;
      }
      const val = it.estValue ? '$' + parseFloat(it.estValue).toLocaleString() : '—';
      const _itmId = it.itemNum ? `<span style="font-family:var(--font-mono);font-size:0.78rem;color:${r.color};opacity:0.75;font-style:italic">${it.itemNum}</span>` : r.emoji;
      const _ephActions = state.filters.owned ? `
        <div style="display:flex;gap:0.35rem;margin-top:0.5rem;flex-wrap:wrap">
          <button onclick="event.stopPropagation();ephemeraForSale('${r.tabId}',${it.row})" style="flex:1;min-width:0;padding:0.35rem 0.3rem;border-radius:7px;font-size:0.72rem;cursor:pointer;border:1.5px solid #f39c12;background:rgba(243,156,18,0.12);color:#f39c12;font-family:var(--font-body);font-weight:600">🏷️ For Sale</button>
          <button onclick="event.stopPropagation();ephemeraSold('${r.tabId}',${it.row})" style="flex:1;min-width:0;padding:0.35rem 0.3rem;border-radius:7px;font-size:0.72rem;cursor:pointer;border:1.5px solid #2ecc71;background:rgba(46,204,113,0.12);color:#2ecc71;font-family:var(--font-body);font-weight:600">💰 Sold</button>
          <button onclick="event.stopPropagation();ephemeraDelete('${r.tabId}',${it.row})" style="flex:0 0 auto;padding:0.35rem 0.5rem;border-radius:7px;font-size:0.72rem;cursor:pointer;border:1.5px solid var(--border);background:var(--surface2);color:var(--accent);font-family:var(--font-body)">Remove</button>
        </div>` : '';

      // ── My Collection view: match the 7-column layout ──────────
      if (state.filters.owned) {
        const _photoLink = it.photoLink || '';
        const _thumbId = 'eph-thumb-' + r.tabId + '-' + it.row;
        return `<tr onclick="openEphemeraDetail('${r.tabId}',${it.row})" style="cursor:pointer">
          <td>
            <span style="font-family:var(--font-mono);font-size:0.78rem;color:${r.color}">${it.itemNum || r.emoji}</span>
          </td>
          <td><span class="text-dim">—</span></td>
          <td style="text-align:center">
            <button onclick="event.stopPropagation();openEphemeraDetail('${r.tabId}',${it.row})" style="padding:0.25rem 0.6rem;border-radius:6px;border:1px solid ${r.color};background:${r.color}18;color:${r.color};font-family:var(--font-body);font-size:0.75rem;cursor:pointer;font-weight:600">Details</button>
          </td>
          <td><span class="tag" style="border-color:${r.color};color:${r.color};background:${r.color}18">${r.label}</span></td>
          <td style="text-align:center">
            <span id="${_thumbId}" style="display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:4px;background:var(--surface2);overflow:hidden;vertical-align:middle;color:var(--text-dim)">${_photoLink ? '' : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.45"><rect x="2" y="2" width="20" height="20" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/><line x1="4" y1="4" x2="20" y2="20" stroke-width="2" opacity="0.55"/></svg>'}</span>
          </td>
          <td style="text-align:center">
            <button onclick="event.stopPropagation();${_photoLink ? `openPhotoFolder('${it.itemNum||''}','${_photoLink}')` : `openEphemeraDetail('${r.tabId}',${it.row})`}" style="padding:0.25rem 0.6rem;border-radius:6px;border:1px solid ${_photoLink ? 'var(--gold)' : 'var(--border)'};background:${_photoLink ? 'rgba(212,168,67,0.08)' : 'var(--surface2)'};color:${_photoLink ? 'var(--gold)' : 'var(--text-dim)'};font-family:var(--font-body);font-size:0.75rem;cursor:pointer;font-weight:600${_photoLink ? '' : ';opacity:0.7'}">${_photoLink ? '📷 Photos' : '📷 No Photos Uploaded'}</button>
          </td>
          <td style="text-align:center;white-space:nowrap">
            <button onclick="event.stopPropagation();ephemeraForSale('${r.tabId}',${it.row})" style="padding:0.2rem 0.45rem;border-radius:5px;font-size:0.7rem;cursor:pointer;border:1px solid #f39c12;background:rgba(243,156,18,0.1);color:#f39c12;font-family:var(--font-body);font-weight:600;margin-right:0.2rem">🏷️ For Sale</button>
            <button onclick="event.stopPropagation();ephemeraSold('${r.tabId}',${it.row})" style="padding:0.2rem 0.45rem;border-radius:5px;font-size:0.7rem;cursor:pointer;border:1px solid #2ecc71;background:rgba(46,204,113,0.1);color:#2ecc71;font-family:var(--font-body);font-weight:600;margin-right:0.2rem">💰 Sold</button>
            <button onclick="event.stopPropagation();ephemeraDelete('${r.tabId}',${it.row})" style="padding:0.2rem 0.45rem;border-radius:5px;font-size:0.7rem;cursor:pointer;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body)">Remove</button>
          </td>
        </tr>`;
      }

      // ── Master browse view: 9-column layout ───────────────────
      return `<tr onclick="openEphemeraDetail('${r.tabId}',${it.row})" style="cursor:pointer">
        <td>${_itmId}</td>
        <td><span class="tag" style="border-color:${r.color};color:${r.color};background:${r.color}18">${r.label}</span></td>
        <td>${it.title || '—'}</td>
        <td>${it.catType || it.year || '—'}</td>
        <td style="color:var(--text-dim);font-size:0.8rem">${it.year || '—'}</td>
        <td>${it.year || '—'}</td>
        <td><span class="owned-badge badge-owned">✓ Owned</span></td>
        <td class="market-val">${val}${_ephActions}</td>
      </tr>`;
    }).join('');
  }

  if (isMobile) {
    if (tableEl) tableEl.style.display = 'none';
    if (cardsEl) cardsEl.style.display = 'flex';
  } else {
    if (tableEl) tableEl.style.display = '';
    if (cardsEl) cardsEl.style.display = 'none';
  }

  // ── Icon legend bar (My Collection only) ──
  if (state.filters.owned) {
    const legendEl = document.getElementById('coll-icon-legend');
    if (legendEl) {
      const showLegend = _prefGet('lv_show_coll_legend', 'true') === 'true';
      legendEl.style.display = '';
      legendEl.innerHTML = showLegend
        ? `<div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;font-size:0.72rem;color:var(--text-dim);padding:0.4rem 0.6rem;background:var(--surface2);border:1px solid var(--border);border-radius:7px;margin-bottom:0.5rem">
            <span style="font-weight:600;color:var(--text-mid)">Icon key:</span>
            <span title="Grouped items">🔗 Grouped</span>
            <span title="Quick entry — details not yet complete">⚡ Quick Entry</span>
            <span title="Has a photo on file">📷 Has Photo</span>
            <button onclick="event.stopPropagation();_prefSet('lv_show_coll_legend','false');renderBrowse()" style="margin-left:auto;background:none;border:none;color:var(--text-dim);font-size:0.72rem;cursor:pointer;padding:0;text-decoration:underline">Hide</button>
          </div>`
        : `<div style="display:flex;justify-content:flex-end;margin-bottom:0.35rem">
            <button onclick="event.stopPropagation();_prefSet('lv_show_coll_legend','true');renderBrowse()" style="background:none;border:none;color:var(--text-dim);font-size:0.72rem;cursor:pointer;padding:0;text-decoration:underline">Show icon key</button>
          </div>`;
    }
  } else {
    const legendEl = document.getElementById('coll-icon-legend');
    if (legendEl) legendEl.style.display = 'none';
  }

  const rowsHtml = pageData.map((item, i) => {
    const pd = item._personalOnly ? item : findPD(item.itemNum, item.variation);
    const isOwned = item._personalOnly ? true : (pd?.owned || false);
    const isWanted = !!state.wantData[`${item.itemNum}|${item.variation}`];
    const cond = pd?.condition ? parseInt(pd.condition) : null;
    const condClass = cond >= 9 ? 'cond-9' : cond >= 7 ? 'cond-7' : cond >= 5 ? 'cond-5' : cond ? 'cond-low' : '';
    let globalIdx = state.masterData.indexOf(item);
    // For _personalOnly items not in masterData, use negative index via global array
    if (globalIdx < 0 && item._personalOnly) {
      const poKey = findPDKey(item.itemNum, item.variation);
      if (poKey) {
        if (!window._poKeys) window._poKeys = [];
        let poIdx = window._poKeys.indexOf(poKey);
        if (poIdx < 0) poIdx = window._poKeys.push(poKey) - 1;
        globalIdx = -(poIdx + 1000);
      }
    }
    const isForSale = !!state.forSaleData[`${item.itemNum}|${item.variation||''}`];
    const badgeClass = isOwned ? (isForSale ? 'forsale' : 'yes') : isWanted ? 'want' : 'no';
    const badgeText  = isOwned ? (isForSale ? '🏷️ For Sale' : '✓ Owned') : isWanted ? '★ Want' : '—';
    const marketVal  = item.marketVal ? '$' + parseFloat(item.marketVal).toLocaleString() : '';

    if (isMobile) {
      const _escVar = (item.variation||'').replace(/'/g,"\\'");
      const _pdKey = findPDKey(item.itemNum, item.variation);
      const _pdRow = pd && pd.row ? pd.row : 0;
      const _ownedActions = state.filters.owned && isOwned ? `
        <div style="display:flex;gap:0.35rem;margin-top:0.6rem;flex-wrap:wrap">
          <button onclick="event.stopPropagation();collectionActionForSale(${globalIdx},'${item.itemNum}','${_escVar}')" style="flex:1;min-width:0;padding:0.4rem 0.3rem;border-radius:7px;font-size:0.75rem;cursor:pointer;border:1.5px solid #e67e22;background:rgba(230,126,34,0.12);color:#e67e22;font-family:var(--font-body);font-weight:600">${isForSale ? '🏷️ Update Listing' : '🏷️ For Sale'}</button>
          <button onclick="event.stopPropagation();collectionActionSold(${globalIdx},'${item.itemNum}','${_escVar}')" style="flex:1;min-width:0;padding:0.4rem 0.3rem;border-radius:7px;font-size:0.75rem;cursor:pointer;border:1.5px solid #2ecc71;background:rgba(46,204,113,0.12);color:#2ecc71;font-family:var(--font-body);font-weight:600">💰 Sold It</button>
          <button onclick="event.stopPropagation();showAddToUpgradeModal('${item.itemNum}','${_escVar}')" style="flex:1;min-width:0;padding:0.4rem 0.3rem;border-radius:7px;font-size:0.75rem;cursor:pointer;border:1.5px solid #8b5cf6;background:rgba(139,92,246,0.1);color:#8b5cf6;font-family:var(--font-body);font-weight:600">↑ Upgrade</button>
          <button onclick="event.stopPropagation();removeCollectionItem('${item.itemNum}','${_escVar}',${_pdRow})" style="flex:0 0 auto;padding:0.4rem 0.6rem;border-radius:7px;font-size:0.75rem;cursor:pointer;border:1.5px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body)">Remove</button>
        </div>` : '';
      return `<div class="browse-card" onclick="browseRowClick(event,${globalIdx})">
        <div class="browse-card-left">
          <div class="browse-card-num">${item.itemNum}${item.variation ? ' <span style="font-size:0.75rem;color:var(--text-dim)">' + item.variation + '</span>' : ''}</div>
          <div class="browse-card-name">${item.roadName || item.itemType || '—'}</div>
          <div class="browse-card-sub">${[item.itemType, item.yearProd].filter(Boolean).join(' · ')}${pd?.matchedTo ? ' · <span style="color:var(--accent2)">' + (isTender(item.itemNum)?'🚂':'🚃') + ' ' + pd.matchedTo + '</span>' : ''}${pd?.setId ? ' · <span style="color:#a855f7;font-size:0.7rem">🔗 ' + pd.setId.split('-').slice(0,2).join('-') + '</span>' : ''}</div>
        </div>
        <div class="browse-card-right">
          <span class="owned-badge ${badgeClass}">${badgeText}</span>
          ${cond ? `<span style="font-size:0.75rem"><span class="condition-pip ${condClass}"></span>${cond}</span>` : ''}
          ${marketVal ? `<span class="market-val" style="font-size:0.78rem">${marketVal}</span>` : ''}
          <span id="cam-${item.itemNum}-${item.variation||''}-m" style="font-size:0.85rem;display:none" onclick="event.stopPropagation();openPhotoFolder('${item.itemNum}','${pd&&pd.photoItem?pd.photoItem:''}')">📷</span>
        </div>${_ownedActions}
      </div>`;
    } else if (state.filters.owned) {
      // ── My Collection view: Item # | Description | Actions (3 clean columns) ──
      const _isQuick = pd && pd.quickEntry;
      const _groupId = pd && pd.groupId ? pd.groupId : '';
      const _escVar = (item.variation||'').replace(/'/g,"\'");
      const _descParts = [item.roadName, item.itemType].filter(Boolean);
      const _descFull  = _descParts.join(' · ') || item.description || '—';
      const _descShort = _descFull.length > 42 ? _descFull.substring(0, 40) + '…' : _descFull;
      const _varText   = item.variation ? ` <span style="font-size:0.72rem;color:var(--text-dim);background:var(--surface2);padding:1px 5px;border-radius:4px;margin-left:3px">${item.variation}</span>` : '';
      return `<tr onclick="showItemDetailPage(${globalIdx})" style="cursor:pointer${_isQuick ? ';opacity:0.82' : ''}" data-group="${_groupId}" data-item="${item.itemNum}">
        <td style="white-space:nowrap">
          <span class="item-num">${item.itemNum}</span>
          ${_groupId ? '<span style="font-size:0.55rem;color:var(--accent3);margin-left:4px;vertical-align:super" title="Grouped">🔗</span>' : ''}
          ${_isQuick ? '<span onclick="event.stopPropagation();completeQuickEntry(\''+item.itemNum+'\',\''+_escVar+'\','+globalIdx+')" style="margin-left:5px;font-size:0.72rem;background:#27ae60;color:#fff;border-radius:4px;padding:1px 5px;cursor:pointer;font-weight:700;vertical-align:middle" title="Complete this Quick Entry">⚡</span>' : ''}
          ${pd && pd.photoItem ? '<span style="margin-left:4px;font-size:0.78rem;vertical-align:middle;opacity:0.75" title="Has photo">📷</span>' : ''}
        </td>
        <td style="white-space:nowrap">${item.variation ? '<span style="font-size:0.78rem;color:var(--text-mid)">' + item.variation + '</span>' : '<span style="color:var(--text-dim)">—</span>'}</td>
        <td style="color:var(--text-mid);font-size:0.85rem">${_descShort}</td>
        <td style="text-align:right;white-space:nowrap">
          <button onclick="event.stopPropagation();collectionActionForSale(${globalIdx},'${item.itemNum}','${_escVar}')" style="padding:0.2rem 0.45rem;border-radius:5px;font-size:0.7rem;cursor:pointer;border:1px solid #e67e22;background:rgba(230,126,34,0.1);color:#e67e22;font-family:var(--font-body);font-weight:600;margin-right:0.2rem">${isForSale ? '🏷️ Update' : '🏷️ For Sale'}</button>
          <button onclick="event.stopPropagation();collectionActionSold(${globalIdx},'${item.itemNum}','${_escVar}')" style="padding:0.2rem 0.45rem;border-radius:5px;font-size:0.7rem;cursor:pointer;border:1px solid #2ecc71;background:rgba(46,204,113,0.1);color:#2ecc71;font-family:var(--font-body);font-weight:600;margin-right:0.2rem">💰 Sold</button>
          <button onclick="event.stopPropagation();showAddToUpgradeModal('${item.itemNum}','${_escVar}')" style="padding:0.2rem 0.45rem;border-radius:5px;font-size:0.7rem;cursor:pointer;border:1px solid #8b5cf6;background:rgba(139,92,246,0.1);color:#8b5cf6;font-family:var(--font-body);font-weight:600;margin-right:0.2rem" title="Add to Upgrade List">↑ Upgrade</button>
          <button onclick="event.stopPropagation();removeCollectionItem('${item.itemNum}','${_escVar}',${pd && pd.row ? pd.row : 0})" style="padding:0.2rem 0.45rem;border-radius:5px;font-size:0.7rem;cursor:pointer;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body)">Remove</button>
        </td>
      </tr>`;
    } else {
      const vdShort = item.varDesc ? (item.varDesc.length > 28 ? item.varDesc.substring(0,28)+'…' : item.varDesc) : '';
      const vdCell = vdShort
        ? `<span style="cursor:pointer;border-bottom:1px dashed var(--border);color:var(--text-mid)" onclick="event.stopPropagation();showVarDescPopup(${globalIdx})">${vdShort}</span>`
        : '<span class="text-dim">—</span>';
      const _isErrCar = pd && pd.isError;
      const _isQuick = pd && pd.quickEntry;
      return `<tr onclick="browseRowClick(event, ${globalIdx})" style="cursor:pointer${_isQuick ? ';opacity:0.78' : ''}" title="${_isErrCar ? '⚠ Error car: ' + (pd.errorDesc||'see notes') : _isQuick ? '⚡ Quick Entry — details not yet filled in' : ''}">
        <td>
          <span class="item-num">${item.itemNum}${_isErrCar ? '<sup style="color:var(--accent);font-size:0.65rem">*</sup>' : ''}${_isQuick ? '<span onclick="event.stopPropagation();completeQuickEntry(\''+item.itemNum+'\',\''+((item.variation||'').replace(/\'/g,"\\\\'"))+'\','+globalIdx+')" style="font-size:0.6rem;background:#27ae60;color:#fff;border-radius:3px;padding:1px 4px;vertical-align:middle;font-weight:600;cursor:pointer" title="Complete this Quick Entry">⚡</span>' : ''}</span>
          <span id="cam-${item.itemNum}-${item.variation||''}" style="margin-left:5px;font-size:0.85rem;cursor:pointer;display:none" onclick="event.stopPropagation();openPhotoFolder('${item.itemNum}','${pd&&pd.photoItem?pd.photoItem:''}')" title="Open photo folder">📷</span>
        </td>
        <td><span class="tag">${item.itemType || '—'}</span></td>
        <td>${item.roadName || '<span class="text-dim">—</span>'}</td>
        <td>${item.variation || '<span class="text-dim">—</span>'}</td>
        <td>${vdCell}</td>
        <td class="text-dim">${item.yearProd || '—'}</td>
        <td><span class="owned-badge ${badgeClass}">${badgeText}</span></td>
      </tr>`;
    }
  });

  const emptyHtml = isMobile
    ? '<div style="text-align:center;padding:3rem 1rem;color:var(--text-dim)"><div style="font-size:2.5rem;margin-bottom:0.5rem">🔍</div><p>No items match your filters</p></div>'
    : '<tr><td colspan="' + (state.filters.owned ? '4' : '7') + '"><div class="empty-state"><div class="empty-icon">🔍</div><p>No items match your filters</p><p style="font-size:0.8rem;color:var(--text-dim);margin-top:0.25rem">Try clearing some filters</p></div></td></tr>';

  if (isMobile) {
    let _ephCardsHtml = '';
    if (_ephemeraRows.length) {
      _ephCardsHtml = _ephemeraRows.map(r => {
        if (r._divider) return '<div style="font-size:0.72rem;font-weight:600;letter-spacing:0.1em;color:'+r.color+';text-transform:uppercase;padding:0.6rem 0 0.2rem;border-top:2px solid '+r.color+'33;margin-top:0.5rem">'+r.label+'</div>';
        const it = r.item;
        const val = it.estValue ? '$'+parseFloat(it.estValue).toLocaleString() : '';
        return '<div class="browse-card" onclick="openEphemeraDetail(\"'+r.tabId+'\",'+it.row+')" style="border-left:3px solid '+r.color+';cursor:pointer">'
          +'<div class="browse-card-row"><span style="font-size:0.9rem">'+r.emoji+'</span>'
          +'<span class="browse-card-num" style="color:'+r.color+'">'+it.title+'</span>'
          +'<span class="owned-badge badge-owned" style="margin-left:auto">✓</span></div>'
          +'<div class="browse-card-sub">'+r.label+(it.year?' · '+it.year:'')+(val?' · '+val:'')+'</div>'
          +'</div>';
      }).join('');
    }
    if (cardsEl) cardsEl.innerHTML = (rowsHtml.join('') || emptyHtml) + _ephCardsHtml;
  } else {
    tbody.innerHTML = (rowsHtml.join('') || emptyHtml) + _ephRowsHtml;
  }
  // Async: load thumbnails for My Collection view
  if (state.filters.owned) {
    pageData.forEach(function(item) {
      const pd2 = item._personalOnly ? item : findPD(item.itemNum, item.variation);
      if (!pd2 || !pd2.owned || !pd2.photoItem) return;
      const thumbEl = document.getElementById('thumb-' + item.itemNum + '-' + (item.variation || ''));
      if (!thumbEl) return;
      driveGetFolderPhotos(pd2.photoItem).then(function(photos) {
        if (photos && photos.length > 0) {
          const fileId = photos[0].id;
          const el = document.getElementById('thumb-' + item.itemNum + '-' + (item.variation || ''));
          if (el) {
            const img = document.createElement('img');
            img.style.cssText = 'width:40px;height:40px;object-fit:cover;border-radius:4px';
            el.innerHTML = '';
            el.appendChild(img);
            loadDriveThumb(fileId, img, el);
          }
        } else {
          const el = document.getElementById('thumb-' + item.itemNum + '-' + (item.variation || ''));
          if (el) el.innerHTML = '<span style="display:flex;align-items:center;justify-content:center;height:100%"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.35"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></span>';
        }
      });
    });
  }
  // Async: check which owned items have photos and reveal their camera icons
  if (state.filters.owned) {
    pageData.forEach(function(item) {
      const pd2 = item._personalOnly ? item : findPD(item.itemNum, item.variation);
      if (!pd2 || !pd2.owned) return;
      const camEl = document.getElementById('cam-' + item.itemNum + '-' + (item.variation || ''));
      if (!camEl) return;
      if (pd2.photoItem) {
        driveGetFolderPhotos(pd2.photoItem).then(function(photos) {
          if (photos && photos.length > 0) {
            const c1 = document.getElementById('cam-' + item.itemNum + '-' + (item.variation || ''));
            const c2 = document.getElementById('cam-' + item.itemNum + '-' + (item.variation || '') + '-m');
            if (c1) c1.style.display = 'inline';
            if (c2) c2.style.display = 'inline';
          }
        });
      }
    });
  }

  // Pagination
  const paginEl = document.getElementById('pagination-btns');
  let btns = '';
  if (state.currentPage > 1) btns += `<button class="page-btn" onclick="goPage(${state.currentPage-1})">‹</button>`;
  const range = [1, ...Array.from({length: pages}, (_,i)=>i+1).filter(p => Math.abs(p - state.currentPage) <= 2), pages];
  [...new Set(range)].sort((a,b)=>a-b).forEach((p, i, arr) => {
    if (i > 0 && arr[i-1] < p - 1) btns += `<span style="padding:0 4px;color:var(--text-dim)">…</span>`;
    btns += `<button class="page-btn ${p === state.currentPage ? 'active' : ''}" onclick="goPage(${p})">${p}</button>`;
  });
  if (state.currentPage < pages) btns += `<button class="page-btn" onclick="goPage(${state.currentPage+1})">›</button>`;
  paginEl.innerHTML = btns;
}

function goPage(p) { state.currentPage = p; renderBrowse(); document.getElementById('main-content').scrollTop = 0; }
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
               || state.masterData.find(m => m.itemNum === _baseNum);
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
  const groupMembers = pd && pd.groupId ? Object.values(state.personalData).filter(p => p.groupId === pd.groupId && p.itemNum !== it.itemNum) : [];

  // ── HEADER ──
  let html = `
  <div style="margin-bottom:1.5rem">
    <button onclick="showPage('browse');filterOwned()" style="background:none;border:none;color:var(--accent2);font-family:var(--font-body);font-size:0.82rem;cursor:pointer;padding:0;margin-bottom:0.75rem;display:flex;align-items:center;gap:0.3rem">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
      Back to Collection
    </button>
    <div style="display:flex;align-items:flex-start;gap:1rem;flex-wrap:wrap">
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;margin-bottom:0.25rem">
          <span style="font-family:var(--font-head);font-size:1.6rem;color:var(--accent);letter-spacing:0.03em">No. ${it.itemNum}</span>
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
    
    <button onclick="showItemDetailPage_sell(${idx})" data-ctip="Did you sell something? Record that here." style="padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #2ecc71;background:rgba(46,204,113,0.1);color:#2ecc71;font-family:var(--font-body);font-size:0.82rem;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:0.4rem">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
      Record Sale
    </button>
    <button onclick="showItemDetailPage_forsale(${idx})" data-ctip="If you want to sell an item from your collection, you can list it for sale here." style="padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #e67e22;background:rgba(230,126,34,0.1);color:#e67e22;font-family:var(--font-body);font-size:0.82rem;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:0.4rem">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
      List for Sale
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
    { label: 'Market Value', val: it.marketVal ? '$' + parseFloat(it.marketVal).toLocaleString() : null },
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

  // Collector's Market Est. card — loads async after page renders
  const _vaultEl = document.createElement('div');
  _vaultEl.id = 'vault-market-wrap';
  _vaultEl.style.marginTop = '18px';
  container.appendChild(_vaultEl);
  if (typeof vaultRenderMarketCard === 'function') {
    vaultRenderMarketCard(it.itemNum, it.variation || '', _vaultEl);
  }

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
  document.getElementById('wizard-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
  // Skip to the photosItem step
  const autoSkip = new Set(['tab','itemNum','variation','itemPicker','entryMode','condition','allOriginal','notOriginalDesc',
    'hasBox','boxCond','hasIS','is_sheetNum','is_condition','pricePaid','datePurchased','userEstWorth','yearMade',
    'tenderAllOriginal','tenderNotOriginalDesc','unit2AllOriginal','unit2NotOriginalDesc',
    'unit3AllOriginal','unit3NotOriginalDesc','wantTenderPhotos','tenderMatch','dieselSetQ','setMatch','setType',
    'unit2ItemNum','unit3ItemNum','setUnit2Num','setUnit3Num',
    'wantTogetherPhotos','photosTogether','boxOnly','wantBoxPhotos',
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

  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

// ── Collection list action helpers (resolve pdKey from itemNum/variation, then delegate) ──
function collectionActionForSale(globalIdx, itemNum, variation) {
  var pdKey = findPDKey(itemNum, variation);
  if (!pdKey) { showToast('Item not found in collection', 3000, true); return; }
  _checkSetBeforeAction(pdKey, () => listForSaleFromCollection(globalIdx, pdKey));
}

function collectionActionSold(globalIdx, itemNum, variation) {
  var pdKey = findPDKey(itemNum, variation);
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
        localStorage.removeItem('lv_personal_cache');
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
      localStorage.removeItem('lv_personal_cache');
      showToast('Set broken up — items are now individual');
      proceed();
    }
  };
}

async function removeCollectionItem(itemNum, variation, row) {
  if (!confirm('Remove No. ' + itemNum + (variation ? ' (Var. ' + variation + ')' : '') + ' from your collection?')) return;
  var pdKey = findPDKey(itemNum, variation);
  // Clear the row in the sheet (columns A through W)
  if (row) {
    try {
      await sheetsUpdate(state.personalSheetId, 'My Collection!A' + row + ':W' + row,
        [['','','','','','','','','','','','','','','','','','','','','','','']]);
    } catch(e) { console.error('Remove row error:', e); showToast('Error removing item — please try again', 3000, true); return; }
  }
  // Also remove from For Sale if listed
  var fsKey = itemNum + '|' + (variation || '');
  var fsEntry = state.forSaleData[fsKey];
  if (fsEntry && fsEntry.row) {
    try {
      await sheetsUpdate(state.personalSheetId, 'For Sale!A' + fsEntry.row + ':H' + fsEntry.row,
        [['','','','','','','','']]);
    } catch(e) { console.warn('For Sale cleanup:', e); }
    delete state.forSaleData[fsKey];
  }
  // Remove from local state
  if (pdKey) delete state.personalData[pdKey];
  localStorage.removeItem('lv_personal_cache');
  localStorage.removeItem('lv_personal_cache_ts');
  renderBrowse();
  buildDashboard();
  showToast('✓ Removed from collection');
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
    var master = state.masterData.find(function(m) { return m.itemNum === pd.itemNum && m.variation === (pd.variation||''); }) || {};
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
    var master = state.masterData.find(function(m) { return m.itemNum === pd.itemNum && m.variation === (pd.variation||''); }) || {};
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
    ...(item.errorDesc || pd.isError ? [{ label: 'Error', key: null, val: pd.errorDesc || '—', type: 'readonly' }] : []),
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

      if (mode === 'edit' && activeKey === f.key) {
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
      ];
      try {
        await sheetsUpdate(state.personalSheetId, 'My Collection!A' + pd.row + ':W' + pd.row, [newRow]);
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
    <div style="font-size:0.82rem;color:var(--text-mid);margin-bottom:1.25rem">Instruction Sheet${it.linkedItem?' for Lionel No. '+it.linkedItem:''}</div>
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
  const keyPrefix = item.itemNum + '|' + item.variation + '|';
  const pdKey = Object.keys(state.personalData).find(k => k.startsWith(keyPrefix));
  const alreadyOwned = !!pdKey;
  if (alreadyOwned) {
    showOwnedItemMenu(idx, pdKey);
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
      ['Market Value', item.marketVal ? '$' + parseFloat(item.marketVal).toLocaleString() : '—'],
    ];
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

function addFromBrowse(idx) {
  const item = state.masterData[idx];
  if (!item) return;
  // Open the collection wizard with itemNum + variation pre-filled
  wizard = { step: 0, tab: 'collection', data: { tab: 'collection', itemNum: item.itemNum, variation: item.variation || '' }, steps: getSteps('collection'), matchedItem: item };
  document.getElementById('wizard-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
  // Skip the tab picker (step 0) and itemNum step — advance past any steps
  // whose id is 'itemNum' or 'variation' (already known)
  const autoSkip = new Set(['tab', 'itemNum', 'variation', 'itemPicker', 'itemCategory']);
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
function openItem(idx) {
  const item = state.masterData[idx];
  state.currentItem = { item, idx };
  // Find by prefix since key now includes row number
  const keyPrefix = `${item.itemNum}|${item.variation}|`;
  const pdKey = Object.keys(state.personalData).find(k => k.startsWith(keyPrefix));
  const pd = pdKey ? state.personalData[pdKey] : {};

  const _errPd = findPD(item.itemNum, item.variation);
  const _errSuffix = _errPd && _errPd.isError ? ' ⚠ Error' : '';
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
    matchedItem: state.masterData.find(i => i.itemNum === item.itemNum) || null,
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
    ];
    const existing = state.personalData[key];
    if (existing && existing.row) {
      await sheetsUpdate(state.personalSheetId, `My Collection!A${existing.row}:W${existing.row}`, [ownedRow]);
    } else {
      await sheetsAppend(state.personalSheetId, 'My Collection!A:A', [ownedRow]);
    }
    // Remove from Sold tab if it was there
    const soldEntry = state.soldData[key];
    if (soldEntry && soldEntry.row) {
      await sheetsUpdate(state.personalSheetId, `Sold!A${soldEntry.row}:H${soldEntry.row}`, [['','','','','','','','']]);
    }
    // Remove from Want List if it was there
    const wantEntry = state.wantData[key];
    if (wantEntry && wantEntry.row) {
      await sheetsUpdate(state.personalSheetId, `Want List!A${wantEntry.row}:E${wantEntry.row}`, [['','','','','']]);
    }
    // Remove from For Sale if it was there
    const fsEntry = state.forSaleData[key];
    if (fsEntry && fsEntry.row) {
      await sheetsUpdate(state.personalSheetId, `For Sale!A${fsEntry.row}:H${fsEntry.row}`, [['','','','','','','','']]);
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
    ];
    const fsEntry2 = state.forSaleData[key];
    if (fsEntry2 && fsEntry2.row) {
      await sheetsUpdate(state.personalSheetId, `For Sale!A${fsEntry2.row}:H${fsEntry2.row}`, [forSaleRow]);
    } else {
      await sheetsAppend(state.personalSheetId, 'For Sale!A:A', [forSaleRow]);
    }
    // Remove from Sold if it was there
    const soldEntry2 = state.soldData[key];
    if (soldEntry2 && soldEntry2.row) {
      await sheetsUpdate(state.personalSheetId, `Sold!A${soldEntry2.row}:H${soldEntry2.row}`, [['','','','','','','','']]);
    }
    // Remove from Want if it was there
    const wantEntry2 = state.wantData[key];
    if (wantEntry2 && wantEntry2.row) {
      await sheetsUpdate(state.personalSheetId, `Want List!A${wantEntry2.row}:E${wantEntry2.row}`, [['','','','','']]);
    }

  } else if (currentStatus === 'Sold') {
    // Remove from My Collection
    const existing = state.personalData[key];
    if (existing && existing.row) {
      await sheetsUpdate(state.personalSheetId, `My Collection!A${existing.row}:W${existing.row}`, [['','','','','','','','','','','','','','','','','','','','','','','']]);  // 23 cols A-W
    }
    // Remove from For Sale if it was there
    const fsEntry3 = state.forSaleData[key];
    if (fsEntry3 && fsEntry3.row) {
      await sheetsUpdate(state.personalSheetId, `For Sale!A${fsEntry3.row}:H${fsEntry3.row}`, [['','','','','','','','']]);
    }
    // Write to Sold tab
    const soldRow = [
      item.itemNum, item.variation || '', copy, condition,
      existing?.priceItem || document.getElementById('fc-price-item').value,
      document.getElementById('fc-sale-price').value,
      document.getElementById('fc-date-sold').value,
      document.getElementById('fc-notes').value,
    ];
    const soldEntry = state.soldData[key];
    if (soldEntry && soldEntry.row) {
      await sheetsUpdate(state.personalSheetId, `Sold!A${soldEntry.row}:H${soldEntry.row}`, [soldRow]);
    } else {
      await sheetsAppend(state.personalSheetId, 'Sold!A:A', [soldRow]);
    }

  } else if (currentStatus === 'Want') {
    // Remove from My Collection if present
    const existing = state.personalData[key];
    if (existing && existing.row) {
      await sheetsUpdate(state.personalSheetId, `My Collection!A${existing.row}:W${existing.row}`, [['','','','','','','','','','','','','','','','','','','','','','','']]);  // 23 cols A-W
    }
    // Write/update Want List tab
    const wantRow = [
      item.itemNum,
      item.variation || '',
      document.getElementById('fc-want-priority').value,
      document.getElementById('fc-want-price').value,
      document.getElementById('fc-want-notes').value,
    ];
    const wantEntry = state.wantData[key];
    if (wantEntry && wantEntry.row) {
      await sheetsUpdate(state.personalSheetId, `Want List!A${wantEntry.row}:E${wantEntry.row}`, [wantRow]);
    } else {
      await sheetsAppend(state.personalSheetId, 'Want List!A:A', [wantRow]);
    }
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

// ── REPORTS ─────────────────────────────────────────────────────
function buildReport() {
  const type = document.getElementById('report-type')?.value || 'insurance';

  // Custom saved report
  if (type.startsWith('custom:')) {
    const id = type.replace('custom:','');
    const def = (state.savedReports||[]).find(r=>r.id===id);
    if (def) buildCustomReport(def);
    else { document.getElementById('report-tbody').innerHTML='<tr><td class="ui-empty">Report not found</td></tr>'; }
    return;
  }
  const thead = document.getElementById('report-thead');
  const tbody = document.getElementById('report-tbody');
  if (!thead || !tbody) return;

  if (type === 'insurance') {
    // ── Insurance Report ─────────────────────────────────────
    const ownerName = state.user?.name || '';
    const dateStr   = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });

    const ownedItems = Object.values(state.personalData).filter(pd => {
      if (!pd.owned) return false;
      const condVal  = pd.condition?.toString().trim();
      const priceVal = pd.priceItem?.toString().trim();
      const noCondition  = !condVal  || condVal  === '' || condVal  === 'N/A';
      const noItemPrice  = !priceVal || priceVal === '' || priceVal === 'N/A';
      return !(pd.hasBox === 'Yes' && noCondition && noItemPrice); // exclude pure box-only
    });

    // Sort by itemType then itemNum
    ownedItems.sort((a, b) => {
      const master_a = state.masterData.find(m => normalizeItemNum(m.itemNum) === normalizeItemNum(a.itemNum)) || {};
      const master_b = state.masterData.find(m => normalizeItemNum(m.itemNum) === normalizeItemNum(b.itemNum)) || {};
      const typeA = master_a.itemType || 'ZZZ';
      const typeB = master_b.itemType || 'ZZZ';
      if (typeA !== typeB) return typeA.localeCompare(typeB);
      return (a.itemNum || '').localeCompare(b.itemNum || '', undefined, { numeric: true });
    });

    let totalWorth = 0;
    ownedItems.forEach(pd => {
      totalWorth += parseFloat(pd.userEstWorth || 0);
    });

    // Inject header above table
    const tableWrap = document.querySelector('#page-reports .table-wrap');
    let hdrEl = document.getElementById('ins-report-hdr');
    if (!hdrEl) {
      hdrEl = document.createElement('div');
      hdrEl.id = 'ins-report-hdr';
      tableWrap.parentNode.insertBefore(hdrEl, tableWrap);
    }
    hdrEl.style.display = '';
    hdrEl.innerHTML = `
      <div class="ins-report-header">
        <div class="ins-report-title">Lionel Postwar Collection — Insurance Documentation</div>
        <div class="ins-report-meta">
          ${ownerName ? `<span>Owner: <strong>${ownerName}</strong></span>` : ''}
          <span>Generated: <strong>${dateStr}</strong></span>
          <span>Items: <strong>${ownedItems.length.toLocaleString()}</strong></span>
        </div>
      </div>
      <div class="ins-report-totals">
        ${totalWorth > 0 ? `<span>Total Est. Worth: <strong>$${Math.round(totalWorth).toLocaleString()}</strong></span>` : ''}
        <span style="color:var(--text-dim);font-size:0.78rem">Est. Worth = user-entered value for insurance purposes</span>
      </div>`;

    thead.innerHTML = `<tr>
      <th>Photo</th>
      <th>Item #</th>
      <th>Description</th>
      <th>Variation</th>
      <th>Cond.</th>
      <th>All Orig.</th>
      <th>Box</th>
      <th>Box Cond.</th>
      <th>Est. Worth</th>
      <th>Notes</th>
    </tr>`;

    tbody.innerHTML = ownedItems.map((pd, idx) => {
      const master = state.masterData.find(m => normalizeItemNum(m.itemNum) === normalizeItemNum(pd.itemNum)) || {};
      const desc   = master.roadName || master.description || master.itemType || '—';
      const year   = pd.yearMade || master.yearProd || '—';
      const worth  = pd.userEstWorth ? '$' + parseFloat(pd.userEstWorth).toLocaleString() : '—';
      const photoId = 'ins-photo-' + idx;
      return `<tr>
        <td><div id="${photoId}" class="ins-photo-placeholder" style="font-size:0.6rem;line-height:1.3">No<br>Photo</div></td>
        <td><span class="item-num">${pd.itemNum}</span></td>
        <td>${desc}</td>
        <td style="font-size:0.78rem;color:var(--text-dim)">${pd.variation || '—'}</td>
        <td style="text-align:center">${pd.condition || '—'}</td>
        <td style="text-align:center">${pd.allOriginal || '—'}</td>
        <td style="text-align:center">${pd.hasBox || '—'}</td>
        <td style="text-align:center">${pd.boxCond || '—'}</td>
        <td style="font-family:var(--font-mono);color:var(--accent2)">${worth}</td>
        <td style="font-size:0.77rem;color:var(--text-dim);max-width:160px">${pd.notes || ''}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="10" class="ui-empty">No owned items yet</td></tr>';

    // Async: load first photo for each item
    ownedItems.forEach((pd, idx) => {
      if (!pd.photoItem) return;
      const container = document.getElementById('ins-photo-' + idx);
      if (!container) return;
      driveGetFolderPhotos(pd.photoItem).then(photos => {
        if (!photos || !photos.length) return;
        const img = document.createElement('img');
        img.className = 'ins-photo';
        img.alt = pd.itemNum;
        container.innerHTML = '';
        container.appendChild(img);
        loadDriveThumb(photos[0].id, img, container);
      });
    });

    return;
  } // end insurance

  // Hide insurance header when switching to other report types
  const _insHdr = document.getElementById('ins-report-hdr');
  if (_insHdr) _insHdr.style.display = 'none';

  if (type === 'wantlist') {
    thead.innerHTML = '<tr><th>Item #</th><th>Type</th><th>Description</th><th>Variation Description</th><th>Est. Market Value</th></tr>';
    const wants = state.masterData.filter(i => !state.personalData[`${i.itemNum}|${i.variation}`]?.owned);
    tbody.innerHTML = wants.map(i => `
      <tr>
        <td><span class="item-num">${i.itemNum}</span></td>
        <td><span class="tag">${i.itemType || '—'}</span></td>
        <td>${i.roadName || i.description || '—'}</td>
        <td>${i.varDesc || i.variation || '—'}</td>
        <td class="market-val">${i.marketVal ? '$'+parseFloat(i.marketVal).toLocaleString() : '—'}</td>
      </tr>`).join('') || '<tr><td colspan="5" class="ui-empty">All items owned! 🎉</td></tr>';

  } else if (type === 'collection') {
    thead.innerHTML = '<tr><th>Item #</th><th>Type</th><th>Road Name</th><th>Variation</th><th>Copy #</th><th>Condition</th><th>Has Box</th><th>All Original</th><th>Item Price</th><th>Item+Box</th></tr>';
    const owned = state.masterData.filter(i => state.personalData[`${i.itemNum}|${i.variation}`]?.owned);
    tbody.innerHTML = owned.map(i => {
      const pd = state.personalData[`${i.itemNum}|${i.variation}`];
      return `<tr>
        <td><span class="item-num">${i.itemNum}</span></td>
        <td><span class="tag">${i.itemType || '—'}</span></td>
        <td>${i.roadName || '—'}</td>
        <td>${i.variation || '—'}</td>
        <td>${pd.copy || '1'}</td>
        <td>${pd.condition || '—'}</td>
        <td>${pd.hasBox || '—'}</td>
        <td>${pd.allOriginal || '—'}</td>
        <td class="market-val">${pd.priceItem ? '$'+parseFloat(pd.priceItem).toLocaleString() : '—'}</td>
        <td class="market-val">${pd.priceComplete ? '$'+parseFloat(pd.priceComplete).toLocaleString() : '—'}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="10" class="ui-empty">No owned items yet</td></tr>';

  } else if (type === 'value') {
    thead.innerHTML = '<tr><th>Category</th><th>Owned</th><th>Total in Master</th><th>% Complete</th><th>Est. Collection Value</th></tr>';
    const cats = {};
    state.masterData.forEach(i => {
      const t = i.itemType || 'Other';
      if (!cats[t]) cats[t] = { total: 0, owned: 0, value: 0 };
      cats[t].total++;
      const pd = state.personalData[`${i.itemNum}|${i.variation}`];
      if (pd?.owned) {
        cats[t].owned++;
        cats[t].value += parseFloat(pd.priceComplete || pd.priceItem || 0);
      }
    });
    tbody.innerHTML = Object.entries(cats).sort((a,b)=>b[1].owned-a[1].owned).map(([name, c]) => `
      <tr>
        <td>${name}</td>
        <td>${c.owned}</td>
        <td>${c.total}</td>
        <td>${c.total > 0 ? Math.round(c.owned/c.total*100) + '%' : '—'}</td>
        <td class="market-val">${c.value > 0 ? '$'+Math.round(c.value).toLocaleString() : '—'}</td>
      </tr>`).join('');

  } else if (type === 'missing-box') {
    thead.innerHTML = '<tr><th>Item #</th><th>Type</th><th>Road Name</th><th>Condition</th><th>Amount Paid</th></tr>';
    const noBox = state.masterData.filter(i => {
      const pd = state.personalData[`${i.itemNum}|${i.variation}`];
      return pd?.owned && pd?.hasBox !== 'Yes';
    });
    tbody.innerHTML = noBox.map(i => {
      const pd = state.personalData[`${i.itemNum}|${i.variation}`];
      return `<tr>
        <td><span class="item-num">${i.itemNum}</span></td>
        <td><span class="tag">${i.itemType || '—'}</span></td>
        <td>${i.roadName || '—'}</td>
        <td>${pd.condition || '—'}</td>
        <td class="market-val">${i.marketVal ? '$'+parseFloat(i.marketVal).toLocaleString() : '—'}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="5" class="ui-empty">All owned items have boxes!</td></tr>';
  }
}

function exportReport() {
  const type = document.getElementById('report-type')?.value || '';

  if (type.startsWith('custom:')) {
    const id = type.replace('custom:','');
    const def = (state.savedReports||[]).find(r=>r.id===id);
    if (def) exportCustomReport(def);
    return;
  }

  if (type === 'insurance') {
    const headers = ['Item #','Description','Type','Year','Variation','Condition','All Original','Has Box','Box Condition','Est. Worth','Amount Paid','Notes','Photo Folder Link'];
    const ownedItems = Object.values(state.personalData).filter(pd => {
      if (!pd.owned) return false;
      const condVal  = pd.condition?.toString().trim();
      const priceVal = pd.priceItem?.toString().trim();
      const noCondition = !condVal  || condVal  === '' || condVal  === 'N/A';
      const noItemPrice = !priceVal || priceVal === '' || priceVal === 'N/A';
      return !(pd.hasBox === 'Yes' && noCondition && noItemPrice);
    });
    ownedItems.sort((a, b) => {
      const ma = state.masterData.find(m => normalizeItemNum(m.itemNum) === normalizeItemNum(a.itemNum)) || {};
      const mb = state.masterData.find(m => normalizeItemNum(m.itemNum) === normalizeItemNum(b.itemNum)) || {};
      if ((ma.itemType||'ZZZ') !== (mb.itemType||'ZZZ')) return (ma.itemType||'ZZZ').localeCompare(mb.itemType||'ZZZ');
      return (a.itemNum||'').localeCompare(b.itemNum||'', undefined, { numeric: true });
    });
    const esc = v => `"${(v||'').toString().replace(/"/g,'""')}"`;
    const rows = ownedItems.map(pd => {
      const master = state.masterData.find(m => normalizeItemNum(m.itemNum) === normalizeItemNum(pd.itemNum)) || {};
      return [
        esc(pd.itemNum), esc(master.roadName || master.description || ''),
        esc(master.itemType || ''), esc(pd.yearMade || master.yearProd || ''),
        esc(pd.variation || ''), esc(pd.condition || ''), esc(pd.allOriginal || ''),
        esc(pd.hasBox || ''), esc(pd.boxCond || ''),
        esc(pd.userEstWorth || ''), esc(pd.priceComplete || pd.priceItem || ''),
        esc(pd.notes || ''), esc(pd.photoItem || ''),
      ].join(',');
    });
    const dateTag = new Date().toISOString().slice(0,10);
    const csv = headers.map(h => `"${h}"`).join(',') + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `insurance-report-${dateTag}.csv`; a.click();
    return;
  }

  // All other reports — scrape visible table
  const thead = document.getElementById('report-thead');
  const tbody = document.getElementById('report-tbody');
  const headers = [...thead.querySelectorAll('th')].map(th => th.textContent).join(',');
  const rows = [...tbody.querySelectorAll('tr')].map(tr =>
    [...tr.querySelectorAll('td')].map(td => `"${td.textContent.replace(/"/g,'""')}"`).join(',')
  ).join('\n');
  const csv = headers + '\n' + rows;
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'my-collection-report.csv'; a.click();
}

// ── REPORT BUILDER ───────────────────────────────────────────────

const REPORT_COLS = [
  { key:'itemNum',       label:'Item #'          },
  { key:'description',   label:'Description'     },
  { key:'itemType',      label:'Type'            },
  { key:'yearMade',      label:'Year Made'       },
  { key:'variation',     label:'Variation #'     },
  { key:'varDesc',       label:'Variation Desc.' },
  { key:'condition',     label:'Condition'       },
  { key:'allOriginal',   label:'All Original'    },
  { key:'hasBox',        label:'Has Box'         },
  { key:'boxCond',       label:'Box Condition'   },
  { key:'priceItem',     label:'Amount Paid'     },
  { key:'userEstWorth',  label:'Est. Worth'      },
  { key:'datePurchased', label:'Date Acquired'   },
  { key:'location',      label:'Location'        },
  { key:'notes',         label:'Notes'           },
  { key:'hasPhoto',      label:'Has Photo'       },
  { key:'groupId',       label:'Set/Group ID'    },
  { key:'isError',       label:'Error Variation' },
];

let _rbState  = null;
let _rbActiveTab = 'columns';

function openReportBuilder(editId) {
  const existing = editId ? (state.savedReports||[]).find(r=>r.id===editId) : null;
  _rbState = existing ? JSON.parse(JSON.stringify(existing)) : {
    id: null, name: '',
    colOrder:   REPORT_COLS.map(c=>c.key),
    colEnabled: Object.fromEntries(REPORT_COLS.map(c=>[c.key,
      ['itemNum','description','itemType','yearMade','condition','hasBox','priceItem','userEstWorth'].includes(c.key)
    ])),
    filters: {},
    sort: [{ field:'itemType', dir:'asc' },{ field:'itemNum', dir:'asc' }],
  };
  _rbActiveTab = 'columns';

  const ov = document.createElement('div');
  ov.className = 'rb-overlay'; ov.id = 'rb-overlay';
  ov.innerHTML = `
    <div class="rb-sheet">
      <div style="padding:1rem 1.25rem 0;flex-shrink:0">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.65rem">
          <div style="font-family:var(--font-head);font-size:1.05rem;font-weight:700">${existing?'Edit Report':'Build a Report'}</div>
          <button onclick="document.getElementById('rb-overlay').remove()" style="background:none;border:none;color:var(--text-dim);font-size:1.1rem;cursor:pointer;padding:0.2rem 0.5rem;border-radius:6px">✕</button>
        </div>
        <input type="text" id="rb-name" value="${(_rbState.name||'').replace(/"/g,'&quot;')}"
          placeholder="Report name (e.g. Unboxed Locomotives)…"
          style="width:100%;padding:0.55rem 0.75rem;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none;box-sizing:border-box"
          oninput="_rbState.name=this.value">
        <div class="rb-tabs" style="margin-top:0.75rem">
          <button class="rb-tab" id="rbtab-columns" onclick="_rbShowTab('columns')">Columns</button>
          <button class="rb-tab" id="rbtab-filters" onclick="_rbShowTab('filters')">Filters</button>
          <button class="rb-tab" id="rbtab-sort"    onclick="_rbShowTab('sort')">Sort</button>
        </div>
      </div>
      <div class="rb-body" id="rb-body" style="flex:1;overflow-y:auto;padding:1rem 1.25rem;-webkit-overflow-scrolling:touch"></div>
      <div style="padding:0.85rem 1.25rem;border-top:1px solid var(--border);display:flex;gap:0.6rem;flex-shrink:0">
        <button onclick="document.getElementById('rb-overlay').remove()"
          style="flex:1;padding:0.7rem;border-radius:9px;border:1px solid var(--border);background:none;color:var(--text-dim);font-family:var(--font-body);font-size:0.88rem;cursor:pointer">Cancel</button>
        <button onclick="_rbSave()"
          style="flex:2;padding:0.7rem;border-radius:9px;border:none;background:var(--accent2);color:white;font-family:var(--font-body);font-size:0.88rem;font-weight:600;cursor:pointer">Save Report</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  _rbShowTab('columns');
}

function _rbShowTab(tab) {
  _rbActiveTab = tab;
  const nameEl = document.getElementById('rb-name');
  if (nameEl) _rbState.name = nameEl.value;
  ['columns','filters','sort'].forEach(t => {
    document.getElementById('rbtab-'+t)?.classList.toggle('active', t===tab);
  });
  const body = document.getElementById('rb-body');
  if (!body) return;
  if (tab==='columns') { body.innerHTML = _rbColumnsHTML(); _rbAttachDrag(); }
  else if (tab==='filters') body.innerHTML = _rbFiltersHTML();
  else if (tab==='sort')    body.innerHTML = _rbSortHTML();
}

// ── Columns tab ──────────────────────────────────────────────────
function _rbColumnsHTML() {
  return '<div style="font-size:0.74rem;color:var(--text-dim);margin-bottom:0.75rem">Check columns to include · Drag <strong>⠿</strong> to reorder</div>'
    + '<div id="rb-col-list">'
    + _rbState.colOrder.map((key,idx) => {
        const col = REPORT_COLS.find(c=>c.key===key); if (!col) return '';
        const on = !!_rbState.colEnabled[key];
        return `<div class="rb-col-item" draggable="true" data-key="${key}" data-idx="${idx}">
          <span class="rb-drag-handle" title="Drag to reorder">⠿</span>
          <input type="checkbox" id="rbcol-${key}" ${on?'checked':''} onchange="_rbToggleCol('${key}',this.checked)">
          <label for="rbcol-${key}" style="${on?'':'color:var(--text-dim)'}">${col.label}</label>
        </div>`;
      }).join('')
    + '</div>';
}

function _rbAttachDrag() {
  const list = document.getElementById('rb-col-list');
  if (!list) return;
  let src = null;
  list.addEventListener('dragstart', e => {
    const el = e.target.closest('.rb-col-item'); if (!el) return;
    src = parseInt(el.dataset.idx);
    setTimeout(()=>el.classList.add('dragging'),0);
    e.dataTransfer.effectAllowed = 'move';
  });
  list.addEventListener('dragend', e => {
    e.target.closest('.rb-col-item')?.classList.remove('dragging');
    list.querySelectorAll('.drag-over').forEach(el=>el.classList.remove('drag-over'));
  });
  list.addEventListener('dragover', e => {
    e.preventDefault();
    const el = e.target.closest('.rb-col-item'); if (!el) return;
    list.querySelectorAll('.drag-over').forEach(x=>x.classList.remove('drag-over'));
    el.classList.add('drag-over');
    e.dataTransfer.dropEffect = 'move';
  });
  list.addEventListener('drop', e => {
    e.preventDefault();
    const el = e.target.closest('.rb-col-item'); if (!el) return;
    const dest = parseInt(el.dataset.idx);
    if (src===null || src===dest) return;
    const ord = [..._rbState.colOrder];
    const [moved] = ord.splice(src,1);
    ord.splice(dest,0,moved);
    _rbState.colOrder = ord; src = null;
    document.getElementById('rb-body').innerHTML = _rbColumnsHTML();
    _rbAttachDrag();
  });
}

window._rbToggleCol = (key, checked) => { _rbState.colEnabled[key]=checked; };

// ── Filters tab ──────────────────────────────────────────────────
function _rbFiltersHTML() {
  const f = _rbState.filters || {};
  const types = [...new Set(state.masterData.map(m=>m.itemType).filter(Boolean))].sort();
  const selTypes = f.itemType || [];

  const typeChips = types.map(t=>`<span class="rb-chip${selTypes.includes(t)?' selected':''}"
    onclick="_rbToggleType('${t.replace(/'/g,"\\'")}',this)">${t}</span>`).join('');

  const yneChips = (key) => ['Either','Yes','No'].map(v=>`<span class="rb-chip${
    (!f[key]&&v==='Either')||(f[key]===v)?' selected':''}" onclick="_rbSetF('${key}','${v}',this)">${v}</span>`).join('');

  const fld = (placeholder,stateKey,extra='') =>
    `<input type="number" value="${f[stateKey]||''}" placeholder="${placeholder}" ${extra}
      style="flex:1;padding:0.38rem 0.55rem;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:var(--font-mono);font-size:0.85rem;outline:none;min-width:0"
      oninput="_rbState.filters['${stateKey}']=this.value">`;

  return `
    <div class="rb-filter-row"><div class="rb-filter-label">Item Type (select any)</div>
      <div class="rb-filter-chips">${typeChips}</div></div>
    <div class="rb-filter-row"><div class="rb-filter-label">Has Box</div>
      <div class="rb-filter-chips">${yneChips('hasBox')}</div></div>
    <div class="rb-filter-row"><div class="rb-filter-label">All Original</div>
      <div class="rb-filter-chips">${yneChips('allOriginal')}</div></div>
    <div class="rb-filter-row"><div class="rb-filter-label">Has Photo</div>
      <div class="rb-filter-chips">${yneChips('hasPhoto')}</div></div>
    <div class="rb-filter-row"><div class="rb-filter-label">Quick Entry Items</div>
      <div class="rb-filter-chips">${['Include','Exclude','Only'].map(v=>`<span class="rb-chip${
        (!f.quickEntry&&v==='Include')||(f.quickEntry===v)?' selected':''}" onclick="_rbSetF('quickEntry','${v}',this)">${v}</span>`).join('')}</div></div>
    <div class="rb-filter-row"><div class="rb-filter-label">Condition (1–10)</div>
      <div class="rb-range">${fld('Min','condMin','min="1" max="10"')} <span style="color:var(--text-dim);font-size:0.85rem">to</span> ${fld('Max','condMax','min="1" max="10"')}</div></div>
    <div class="rb-filter-row"><div class="rb-filter-label">Year Made</div>
      <div class="rb-range">${fld('1945','yearMin','min="1945" max="1969"')} <span style="color:var(--text-dim);font-size:0.85rem">to</span> ${fld('1969','yearMax','min="1945" max="1969"')}</div></div>
    <div class="rb-filter-row"><div class="rb-filter-label">Est. Worth ($)</div>
      <div class="rb-range">${fld('Min','worthMin','min="0"')} <span style="color:var(--text-dim);font-size:0.85rem">to</span> ${fld('Max','worthMax','min="0"')}</div></div>
    <div class="rb-filter-row"><div class="rb-filter-label">Amount Paid ($)</div>
      <div class="rb-range">${fld('Min','paidMin','min="0"')} <span style="color:var(--text-dim);font-size:0.85rem">to</span> ${fld('Max','paidMax','min="0"')}</div></div>
    <div class="rb-filter-row"><div class="rb-filter-label">Location (contains)</div>
      <input type="text" value="${(f.location||'').replace(/"/g,'&quot;')}" placeholder="e.g. Basement Shelf A"
        style="width:100%;padding:0.4rem 0.6rem;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:var(--font-body);font-size:0.85rem;outline:none;box-sizing:border-box"
        oninput="_rbState.filters.location=this.value"></div>`;
}

window._rbToggleType = (type, el) => {
  if (!_rbState.filters.itemType) _rbState.filters.itemType=[];
  const arr=_rbState.filters.itemType, idx=arr.indexOf(type);
  if (idx>=0){arr.splice(idx,1);el.classList.remove('selected');}
  else{arr.push(type);el.classList.add('selected');}
};
window._rbSetF = (key, val, el) => {
  _rbState.filters[key]=val;
  el.closest('.rb-filter-chips')?.querySelectorAll('.rb-chip').forEach(c=>c.classList.remove('selected'));
  el.classList.add('selected');
};

// ── Sort tab ─────────────────────────────────────────────────────
function _rbSortHTML() {
  const sort = _rbState.sort || [];
  while (sort.length<2) sort.push({field:'',dir:'asc'});
  const opts = (sel) => '<option value="">— None —</option>'
    + REPORT_COLS.map(c=>`<option value="${c.key}"${sel===c.key?' selected':''}>${c.label}</option>`).join('');
  const row = (s,i) => `
    <div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.7rem">
      <div style="font-size:0.7rem;color:var(--text-dim);width:30px;flex-shrink:0;text-align:right">${i===0?'1st':'2nd'}</div>
      <select onchange="_rbState.sort[${i}].field=this.value"
        style="flex:1;padding:0.45rem 0.5rem;border-radius:6px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.85rem;outline:none">
        ${opts(s.field)}
      </select>
      <button class="rb-sort-dir ${s.dir}" onclick="_rbFlipDir(${i},this)">
        ${s.dir==='asc'?'A → Z':'Z → A'}
      </button>
    </div>`;
  return '<div style="font-size:0.74rem;color:var(--text-dim);margin-bottom:0.85rem">First sort takes priority.</div>'
    + sort.map((s,i)=>row(s,i)).join('');
}
window._rbFlipDir = (idx, btn) => {
  const s = _rbState.sort[idx];
  s.dir = s.dir==='asc'?'desc':'asc';
  btn.textContent = s.dir==='asc'?'A → Z':'Z → A';
  btn.className = 'rb-sort-dir ' + s.dir;
};

// ── Save / Load ──────────────────────────────────────────────────
function _rbSave() {
  const nameEl = document.getElementById('rb-name');
  if (nameEl) _rbState.name = nameEl.value.trim();
  if (!_rbState.name) {
    if (nameEl) { nameEl.style.borderColor='var(--accent)'; nameEl.focus(); }
    showToast('Give your report a name first', 2500, true); return;
  }
  if (!Object.values(_rbState.colEnabled).some(Boolean)) {
    showToast('Select at least one column', 2500, true); return;
  }
  if (!_rbState.id) _rbState.id = 'rpt_' + Date.now().toString(36);
  if (!state.savedReports) state.savedReports = [];
  const idx = state.savedReports.findIndex(r=>r.id===_rbState.id);
  if (idx>=0) state.savedReports[idx] = _rbState;
  else state.savedReports.push(_rbState);
  localStorage.setItem('lv_saved_reports', JSON.stringify(state.savedReports));
  _rbRefreshDropdown();
  document.getElementById('rb-overlay')?.remove();
  const sel = document.getElementById('report-type');
  if (sel) { sel.value = 'custom:'+_rbState.id; buildReport(); _rbUpdateCustomControls(); }
  showToast('✓ Report "'+_rbState.name+'" saved');
}

function _rbRefreshDropdown() {
  const sel = document.getElementById('report-type');
  if (!sel) return;
  sel.querySelectorAll('option[data-custom],optgroup[data-custom-grp]').forEach(o=>o.remove());
  const saved = state.savedReports || [];
  if (!saved.length) return;
  const grp = document.createElement('optgroup');
  grp.label = 'My Saved Reports';
  grp.dataset.customGrp = '1';
  saved.forEach(r => {
    const opt = document.createElement('option');
    opt.value = 'custom:'+r.id; opt.dataset.custom=r.id; opt.textContent=r.name;
    grp.appendChild(opt);
  });
  sel.appendChild(grp);
}

function loadSavedReports() {
  try { state.savedReports = JSON.parse(localStorage.getItem('lv_saved_reports')||'[]'); }
  catch(e) { state.savedReports=[]; }
  _rbRefreshDropdown();
}

function _rbUpdateCustomControls() {
  const sel = document.getElementById('report-type');
  const ctrl = document.getElementById('rb-custom-controls');
  if (!ctrl) return;
  const isCustom = sel?.value?.startsWith('custom:');
  ctrl.style.display = isCustom ? 'flex' : 'none';
}

function _rbEditSelected() {
  const sel = document.getElementById('report-type');
  if (!sel?.value?.startsWith('custom:')) return;
  openReportBuilder(sel.value.replace('custom:',''));
}

function _rbDeleteSelected() {
  const sel = document.getElementById('report-type');
  if (!sel?.value?.startsWith('custom:')) return;
  const id  = sel.value.replace('custom:','');
  const rpt = (state.savedReports||[]).find(r=>r.id===id);
  if (!confirm('Delete report "' + (rpt?.name||'this report') + '"?')) return;
  state.savedReports = (state.savedReports||[]).filter(r=>r.id!==id);
  localStorage.setItem('lv_saved_reports', JSON.stringify(state.savedReports));
  _rbRefreshDropdown();
  sel.value = 'insurance';
  buildReport();
  _rbUpdateCustomControls();
  showToast('Report deleted');
}

// ── Run a custom report ──────────────────────────────────────────
function _rbCellVal(key, pd, master) {
  switch(key) {
    case 'itemNum':       return pd.itemNum || '';
    case 'description':   return master.roadName || master.description || '';
    case 'itemType':      return master.itemType || '';
    case 'yearMade':      return pd.yearMade || master.yearProd || '';
    case 'variation':     return pd.variation || '';
    case 'varDesc':       return master.varDesc || master.variationDesc || '';
    case 'condition':     return pd.condition || '';
    case 'allOriginal':   return pd.allOriginal || '';
    case 'hasBox':        return pd.hasBox || '';
    case 'boxCond':       return pd.boxCond || '';
    case 'priceItem':     return pd.priceComplete || pd.priceItem || '';
    case 'userEstWorth':  return pd.userEstWorth || '';
    case 'datePurchased': return pd.datePurchased || '';
    case 'location':      return pd.location || '';
    case 'notes':         return pd.notes || '';
    case 'hasPhoto':      return pd.photoItem ? 'Yes' : 'No';
    case 'groupId':       return pd.groupId || '';
    case 'isError':       return pd.isError || '';
    default: return '';
  }
}

function _rbCellHTML(key, val) {
  if (!val || val==='—') {
    if (['priceItem','userEstWorth'].includes(key)) return '—';
    return '<span class="text-dim">—</span>';
  }
  switch(key) {
    case 'itemNum':      return `<span class="item-num">${val}</span>`;
    case 'itemType':     return `<span class="tag">${val}</span>`;
    case 'priceItem':
    case 'userEstWorth': return `<span style="font-family:var(--font-mono);color:var(--accent2)">$${parseFloat(val).toLocaleString()}</span>`;
    case 'hasPhoto':     return val==='Yes' ? '<span style="color:#27ae60">✓</span>' : '<span class="text-dim">—</span>';
    default:             return val;
  }
}

function _rbGetItems(def) {
  const f = def.filters || {};
  let items = Object.values(state.personalData).filter(pd => {
    if (!pd.owned) return false;
    const condVal = pd.condition?.toString().trim(), priceVal = pd.priceItem?.toString().trim();
    const noC = !condVal||condVal===''||condVal==='N/A', noP = !priceVal||priceVal===''||priceVal==='N/A';
    return !(pd.hasBox==='Yes' && noC && noP);
  }).map(pd => ({
    pd,
    master: state.masterData.find(m=>normalizeItemNum(m.itemNum)===normalizeItemNum(pd.itemNum)) || {}
  }));

  // Apply filters
  items = items.filter(({pd,master}) => {
    if (f.itemType?.length && !f.itemType.includes(master.itemType||'')) return false;
    if (f.hasBox && f.hasBox!=='Either' && pd.hasBox!==f.hasBox) return false;
    if (f.allOriginal && f.allOriginal!=='Either' && pd.allOriginal!==f.allOriginal) return false;
    if (f.hasPhoto && f.hasPhoto!=='Either') { const h=!!pd.photoItem; if(f.hasPhoto==='Yes'&&!h) return false; if(f.hasPhoto==='No'&&h) return false; }
    if (f.quickEntry && f.quickEntry!=='Include') { const q=!!pd.quickEntry; if(f.quickEntry==='Exclude'&&q) return false; if(f.quickEntry==='Only'&&!q) return false; }
    const rng = (fMin,fMax,getVal,numeric=true) => {
      if (!fMin&&!fMax) return true;
      const v = numeric ? parseFloat(getVal()) : getVal();
      if (fMin!==''&&fMin!==undefined) { const mn=parseFloat(fMin); if(isNaN(v)||v<mn) return false; }
      if (fMax!==''&&fMax!==undefined) { const mx=parseFloat(fMax); if(isNaN(v)||v>mx) return false; }
      return true;
    };
    if (!rng(f.condMin,  f.condMax,  ()=>parseInt(pd.condition))) return false;
    if (!rng(f.yearMin,  f.yearMax,  ()=>parseInt(pd.yearMade||master.yearProd))) return false;
    if (!rng(f.worthMin, f.worthMax, ()=>parseFloat(pd.userEstWorth))) return false;
    if (!rng(f.paidMin,  f.paidMax,  ()=>parseFloat(pd.priceComplete||pd.priceItem))) return false;
    if (f.location?.trim() && !(pd.location||'').toLowerCase().includes(f.location.toLowerCase())) return false;
    return true;
  });

  // Apply sort
  const sorts = (def.sort||[]).filter(s=>s.field);
  const numKeys = new Set(['condition','priceItem','userEstWorth','yearMade','boxCond']);
  if (sorts.length) {
    items.sort((a,b) => {
      for (const s of sorts) {
        const va=_rbCellVal(s.field,a.pd,a.master), vb=_rbCellVal(s.field,b.pd,b.master);
        const cmp = numKeys.has(s.field) ? (parseFloat(va)||0)-(parseFloat(vb)||0) : va.localeCompare(vb,undefined,{numeric:true});
        if (cmp!==0) return s.dir==='desc'?-cmp:cmp;
      }
      return 0;
    });
  }
  return items;
}

function buildCustomReport(def) {
  const thead = document.getElementById('report-thead');
  const tbody = document.getElementById('report-tbody');
  if (!thead||!tbody) return;
  const _insHdr = document.getElementById('ins-report-hdr');
  if (_insHdr) _insHdr.style.display='none';

  const cols = (def.colOrder||REPORT_COLS.map(c=>c.key))
    .filter(k=>def.colEnabled?.[k])
    .map(k=>REPORT_COLS.find(c=>c.key===k)).filter(Boolean);

  if (!cols.length) { tbody.innerHTML=`<tr><td class="ui-empty">No columns selected — click Edit to configure</td></tr>`; return; }

  thead.innerHTML = '<tr>' + cols.map(c=>`<th>${c.label}</th>`).join('') + '</tr>';
  const items = _rbGetItems(def);
  if (!items.length) {
    tbody.innerHTML=`<tr><td colspan="${cols.length}" class="ui-empty">No items match these filters</td></tr>`; return;
  }

  tbody.innerHTML = items.map(({pd,master}) =>
    '<tr>'+cols.map(c=>`<td>${_rbCellHTML(c.key,_rbCellVal(c.key,pd,master))}</td>`).join('')+'</tr>'
  ).join('');

  // Totals row for money columns
  const moneyCols = cols.filter(c=>['priceItem','userEstWorth'].includes(c.key));
  if (moneyCols.length) {
    const totals = Object.fromEntries(moneyCols.map(c=>[c.key, items.reduce((s,{pd,master})=>s+(parseFloat(_rbCellVal(c.key,pd,master))||0),0)]));
    tbody.innerHTML += '<tr style="border-top:2px solid var(--border);font-weight:700">'
      + cols.map(c=>{
          if (c.key==='itemNum') return `<td style="color:var(--text-dim);font-size:0.78rem">${items.length.toLocaleString()} items</td>`;
          if (totals[c.key]!==undefined) return `<td style="font-family:var(--font-mono);color:var(--accent2)">$${Math.round(totals[c.key]).toLocaleString()}</td>`;
          return '<td></td>';
        }).join('') + '</tr>';
  }
}

function exportCustomReport(def) {
  const cols = (def.colOrder||REPORT_COLS.map(c=>c.key))
    .filter(k=>def.colEnabled?.[k])
    .map(k=>REPORT_COLS.find(c=>c.key===k)).filter(Boolean);
  const items = _rbGetItems(def);
  const esc = v => `"${(v||'').toString().replace(/"/g,'""')}"`;
  const header = cols.map(c=>esc(c.label)).join(',');
  const rows = items.map(({pd,master})=>cols.map(c=>esc(_rbCellVal(c.key,pd,master))).join(','));
  const csv = header + '\n' + rows.join('\n');
  const dateTag = new Date().toISOString().slice(0,10);
  const safeName = (def.name||'report').replace(/[^a-z0-9]/gi,'-').toLowerCase();
  const blob = new Blob([csv],{type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=`${safeName}-${dateTag}.csv`; a.click();
}

// ── PREFERENCES ─────────────────────────────────────────────────

const APP_VERSION = '1.0 · Build 39';
const APP_DATE    = 'March 2026';

const _RSV_PLACEHOLDER_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHgAAAApCAIAAABx1HrXAAABCGlDQ1BJQ0MgUHJvZmlsZQAAeJxjYGA8wQAELAYMDLl5JUVB7k4KEZFRCuwPGBiBEAwSk4sLGHADoKpv1yBqL+viUYcLcKakFicD6Q9ArFIEtBxopAiQLZIOYWuA2EkQtg2IXV5SUAJkB4DYRSFBzkB2CpCtkY7ETkJiJxcUgdT3ANk2uTmlyQh3M/Ck5oUGA2kOIJZhKGYIYnBncAL5H6IkfxEDg8VXBgbmCQixpJkMDNtbGRgkbiHEVBYwMPC3MDBsO48QQ4RJQWJRIliIBYiZ0tIYGD4tZ2DgjWRgEL7AwMAVDQsIHG5TALvNnSEfCNMZchhSgSKeDHkMyQx6QJYRgwGDIYMZAKbWPz9HbOBQAAAitklEQVR42u17aZBlR3Vmbne/b99q76rqRVLvi1otNd0tCUFLYBYJZIwReGzAxmZMxMxEDB7HjCewwxEYCMPY2D9mIsxmY3swm5GFhABtVm9qrS11V3VXV1XX0rW8/b737p6ZZ37cqlIL0ALDzJ+ZF/WjIupV3szvnvOdc75zEgMA+v+f//Mf8v/msQHg/7KF4dd+3mv/FWP8Szw6wgghjFDyRPzGIUu2srbINXvb2Pwb32cCP17/dwDAGP9SjvkKoAEQIHj5vG/gCWv7Quv4oHWUAF7/hK8DKbw23ADojQOYLLXxwGp1pd1qb7vu+jeGvkhc/38HcZYsJaWM41jTVLxBJhgBSM/3NlYPfE8IDghhhKUUnU5naGhYN2wAgTH9SUwwRghJKX96c68wNAAeRxgjKRGgNdvEGFNMCKWvcbDE9EDyF889tzA757qulFLTNMM0AUGn2+OCM4VmM5ldO/cNDm8CkBgTAACQlNDHH3v01KlTf/aZz6qqtmFpGONz55579szJbDZHmFqt1TzPe+e73jk2vm3job8w1kxKIARPX5p88PsPFIsFy7IS0BljQRBMTE5QQjAhPI6z2YxlW5xzjLGUMo6ibC6fy+Y554ZpXMN5GAHGGG3fvmPzthtem3BWVpa//Df/fXVlaWhkJJ1KI4SajYbjdI7f9fbb3nxcJgeDDUYBhBBGOCEZgtFTZ0//8KHvY0AUkzXwJSCMASNECCAZBP7U5KVfu++D5fIAABCMEaZR6NWr1TiOpi9P3bB9F8aAEBZCUEobq8vf/qd/3LljVypfPHHypOd5Nx08UC73Syk03VBVTUpBCP4Fwlti0chze+1GDUPcqAJCSILEmCAAQ6EYE0JwDERlRKWEIooQAooVogVud7nX9TwPACT6CaDx/NzsIcfJ5nJSCIQxTggFUBxzhLHgfPPmzTwOL09dnLtymTEClQqldHVpsVateb0OXkd0zVfwyywjhACAOA6mLl7sOM7I0Ei50sd5jBEmGEkJAgGjDCN44dzzc7Ozly5ezGaLlOJut6Nrhu92NI1lM+kg9OM4CsMAIWTbKYRQpa+vXOmr9A8YlpXLpJ1W8/SpE4/8+IcCABP6kY/8Tv/AMELyF0giWMJflGLP66bStq5piGBAEmPK45gLQbAUEmGMV1dWpHyZicMgKJXLqWyGKMyyLACM14EAjBBIz/e+f/+3Uqk0yGv4BCD0fUKo73v5QnF4dEjX1XQ2q6oqQsh1XaYolqovTE89+P1vgVhDG8PLK3CQnuvGnIs4WFleWl5eNg0zDELf9xijgIiQEmMiRGynrJWl5cAPLjz37Nz0Zd02n332ubFNm9Jpu92uEywmX3pxamKiWq05HefYsWMLCwuu0/a8oNVqeb4fRRHn/Nlnnh0fH89kM7Vq7X/+/d9u37G97XR27b7xhu3bfy4mSYBGrh9KhMMg9FwPEIrDWFEVVVU0TUMYAyBCCGFMSpnYFcFYWBZlrNPp6rpeLBQJYQl5AICUwBQyOztDGdV1DSSWUkopky+kUimEUC6XXVhcnL0yXSmXCcGNRmNlZSWKI4WwYi7f7fXOnzsnpQBABGMCCK2HPgGgKkqj2QQAVdMIQghAStlut0zTFBJRxjzPYwqzLIMxZhiG02pNX57KZDNBt+O0ml2nTQgt5Iory0uYENftdbudRx95eGVldXR4U7FYnJmZwYRomnbw4EHLsprNZqPRCMOwVqvGceB0euXy4PU33PBzAY1BCsCk2ajVq6uqqgOA4GJpcXFi8jznoaap8HKIwuu5tyQYJ3GfMGVq6nKr1bRti1IGCBmapqmqYehzc1ca7VahUGBUTaVSpmkxhQEAAUgCoqIoi4sLvu9pugoYxzG3LCuXySiUJbQsAQABIRQB4I1sBgAhDCBd142jWAL4vk8oY4x6nhsLyZjKKCWMCBFRRDRVA4BsNsOY0u06mFKMKMZECO77bq226nS6lp3evGVzrVor5PKMMtdzXd+nlGqqqmpaq9XinDuOY5v6ptHhxaurN9187EO/+Vs/J9Agf2YW5XSa//j1v0NSEoUl6QDFGAAwQhgkxhhAIIQo01566UXf8xEhnMd+4FFKhgaGVEURghuWjTGu1xue52IAyigAABBCCCAgCGsqDaM4ikIhBcZE1zWEiBACY0wwkQghAEwQSkCXa4GUUSqEUBXG4ziOYyGlBNTrdnVNLZTKSbZgmqamKwQTjJCiqRhjwTkl1PcDhLCUoKqKZVl+4FHKLDttGDpIGUVBpdLne361VttIM5KcWtd12zKFFJ1Oj3P5vg/ct2//jYSwNwj1eh4NIF9+P5BwxRc+9+mlxQXLttaIFwNBGAMSEgBjBIIQQgiLwrCvr081DErplSszURxl0rnBgQGCcULOmBCMwO063W4XY4KpkuTokscIAUYkOUvCLZhQwEQKiTECAIQRgEg2qTCVEJqcnHMOUiYZESak2WrFYWgZZrVeGxgcRAitrq729/crqgISYh4hBKqqCiEZVaSUQghVVTVNi2POVKaqarvVKhaKM7OXRzeNGoa14cQYY0JIkmu5rkspXVhYuDw9jSj77Of+vFAov0G7ZhtBhqx/OykELk5N9lyXEup2e0JKQjAgSRDGGBuGqTAmJaiqVq83AWQQhl7kK0wBwEzRuJQr1ZrvuplcVgoBAJRgRrFt2ULKdrdj2zZGmGgGAgDACBAGQQhBCElATqebyWQSO8IEe17PcZx8Pl8p93e73Zhz27IAgFKakBAhhKmKpqi+50U8rvT1UUJ0wzBNkzKGECIYSSE7nU6xUNhI7QFASik4Bylr9VrKTCX5jOf7nIMQnBBCKfV9PwiCfD6PMbZtmzGWy+UUReGAMMIAcoNa3xjQr8xzwzBsNhqGrjvt9q/++n2UMtd1BZKZVBqEePjBB3zPVRQGAEHop1NpRVGYyhRV7fU8QMQwDUZox+moisIxRggRgpEUXEgppeM4lDHTMDhfK38QIAIgQWCEhYR2u22aJiEEAGEMTFEAkON0spl8q9XyPY/29yFA+GUql5QxLkSr3Q6jqNftKopi6AYXkosIAVCCoyiuVWumYUqQBL+cxQRhqBtG4Plup5fP5zgXURQhwEnYZ4x2u51227Ft23GcZrM5PDykKMro6OjzL7703PPP3XHH8Q2EX7uQZa8mYhiqghBQivfs2adqZqNZFQiVCyXO+WOPPuq6LmFKLHixXAz88MLkZLFYFEL4no8Jxg4t5QtDQ/26blBKE+daq2gA5Uslz/c1TVuTI2CtkN/YcbFUSs4JAITSZqvZdjqZdNpxmpahmbra6ziUUpQAjXFimwSTdDqdSqWCIAjCMNErOOcAgAEwxvlc1mm38HrVKgAwxkEQ9Ho9JCEIAikBE0oIpZQmIEgQ6Uw6m81JKXVdX7y6oGoMAel0OgMD/YLH8/NzIoo0Q68MDKKfUR+/HtCJCyOEpERuz4s5eK4HGHzD5HGUWCIAxJwLwcuVciqVEYJrmub7PiBEMKo36ldmZ5mi2LatqRpeq6bWChcuhKIoCUAYYbSupSXsca38ggkJwiCKIs/zmk0MQgghGGUSJBACmOB1KY5gjNbjuhCCMeZ5Xl9fn24YSIjkNeL1eI4wFgCMMcdxoiiK4ziXy2ma7jhONpslmHDOCSEISwAEMgYAQqiqqleuXMllC6srK4PDI1cXF049eVJTlXQu+5Hf/j1V09DPa9FrrgCAsZQQC8kkxAgw5zFIwSjZ4DjGmKZqtpkCBHRdndBMvZAreK7b7Xbb7XbP7XmepygKIYQQAhgJITRNi6IIYwxCJjy7wXRrWCSxGgOhtFAoSC58zxVcIIR0XZdSCETQNRIdAsCwbq1CcM41TWOMISmvVUg2wj1ISQhxXbfb7Waz2Xa73Wq1VldXXddNWfaa4eO1DNM0TdM0GWMY49XVVdfzet3u0sLi/NyMbqhWOwMg8WuKIa9h0YAVpVav/8kf/1cuOFq3NwxYV9VUykZSggTN1BCGWIQABCEcBCEghBARFqeYFHOFcqGkqtr84vzExQmmKEk2DhK4EQshcLIqxjzkGCdA41cqgUgC9HpdBIhSoqpqFEZ+GCGMOJdrFI0ArSVNBF4WFRECtLS0nKhPG4yxIU0KkIZhTE5Orq5WLcsmGAdhwHm8a9euSxcvua5HKU20TMF5uVy+6aabTMsslSrV1aqh667rVWvVrtPFlH7gQ3dqmpboVr+ARSOMsWEaqsJUVUEIoSSIAKhMQQCIECEEUxRCSBzHTrfLFK3reRIgFEIzdCk5AgwSGGMSIQEgwohzjqQMwwgjJAAkIMIowpjHMV4Lm+Snhbp1l8eKqiR+gDE2dB1JKQXHGBijTFGFTNLQtVBGMRZCJln5hq1tWJwAmTBGNptjlCXxQFHo0aNHn3322XbbWWckQgnmnPu+n8/nVVWrVCpciG7PvfOut999z71txxkcHLxW/v65gQYAVdUs20YICS4oxoRShLEEKQEhkGEUx7Ho9jzPcx986IftTtfQVYSwABBxxHlMME0iIMZYVfTrr9927OitLzz/fKPRtG2bC5FYGmCEXqaLl1XWaz1x4xgbUfSmGw+OjAwTjFRGO057aWV1YGDwytysaZlJGtdqtbPZbDqdIpgSQhP0pZTT09PDw8O2bSOEWq0WQsgwDIyxqqrff+jBL37xi4ODgx/64Adz2Vy73V5eXs5kMolCwDlPqN/t9RqNxpGjR1PpTCqdgbVgjn9BoJNGgBQSISQ4x4TgpAbBiBASxXG73eZcUEYpIXt27eo4ncTTk9dQKZcAoNFoEELqjQYAmpy4cHVxob+v/+jRI+lMhkexqrCO2wOE0ql0wiQ/0QrAr+xOtNvtXC6DCQmCIAzDOAoQgC/4/JUrFy9NtZotz3fDKGwVi4wpC4sLCmNj4+Mdp9fr9dLpdDqdjjlvt1rpdIrzmDGl0+kSgjiPEou+evXq1q1br15dWllZJhjHcaiqrFqtSimDILh8+fKmTZuqtdr5Cxf27t1n2+mkyPppL/w5gMZAsEQYUCI8AoBACMOaIowRJgiPDA+XSqUgCJrNpsM7hFCQklEqBNcN67rrblheXswXcoEX5PJZ13Mz2ZRlmpqmKwqlBGGVUkowQRgTRhIVGQECtFEGbFAYTh4KJNE/CVGYwqOg57TCMOr1ekEYjowMr66uFgsFhdKFuXlCacij6atLL5w7Fwax7/uKomSyWU3T9+/dNTs9pWgmY6zeaCApAGQUi7bjeJ53/Pjx+++//8c/fnSgv19hhBBsGKlLU5cMw5iYmBgeHu703OWllf37buRxTAi5tgJ6jcrlZwOdMBxhBGGEMSYEM8aulZYopVevXl1aWrIsi3Ouqmq53Dc0NNjr9YSQmqYRgmu1VZ58BC+VSqZvr66+WK3WbNM0dF3Xdd/3KWOUYcFjlakYYUIIphQTSjABkGvJrJQAEiHAgMIgqFZXIGkJRZGqqpzzIAgsyzIMo16va5qWy+UajYaQslgq79934PHHH69UykePHnvm6Weq9appaoqiXV1cYKqGEGo0Gp2OE8Vxs+VcmZvbsX27YVgE09NnnqpUyulUqt1u7di+AwCSqv3EiVPlvr6Pf/zjH/jgB55/4bl8sahpOoAUQjCmJFrGekh/YwWL5/stxwnDsIvQtelXEhGTlH5oaCghzb6+Pk3TwjCcmZkWQqRSKd/3XddljEVRBACZbLbS179ly7arS0vTly5OTExs3bJFNQzd0EGEUsS6YpqmpSgMMFE1XQjuOI7vB0qSqBBkmTpFhAsReL4EKbhQdU3XdcZYkkQzxtrtdiaTKRQKQRAYphnHwjDMkZFNo6OjAHD9Ddf3d/ooI5zHqqIbpsEUBSFUq9U63V6v54aRAFgzLSFRp+fqup7NZgkhBw8eFEIMDw9runHjwYM333LLX37xrxYXF/7l/u8BENO0hOCVvr6P/e7vZbNZAIkxfUNAEwQEUKvROnPmbCabzmazcRQLCSRxEYwwJbqmJXXByMim2YW5fL4wPz/PFDY4NIAQMrk9bI1KDqqq8DhKp1KBH6lMSVl2q9FEiCqaEQRhEAYYgBISR37L6eq6XioXm60WIYwDCmOeKxQ7jhOGoZVONRrNjuMwRTE0XVUUBKheb6i6xjkHgtO5nGmnmKKEYTg2NqrpOqYKwujAjQeymWwQBKZp9vf3EUpbTWfy4mWoQTaXHRocUjRtenZmabWqKJQR2m61giBAGHq93uaxsVtvPUYxnp2drdXrfX19t952DCH0qT/+I845U1Tf9xuNZr1WMwyr57pHjh49cuSYlPKn+eNVqEPKTDqjqaqu61u3bms0GkKGKTstgEdhQCgNo8gJOhihwcHBycmJbDbLY04pwQjNzMwIIQgmmq6ZZkrXlP5KXxxHhICms0bd+fCHP3L27FlCiB94qZRFCU0inuv2GGOVSmXbdTtuf8vxbq995tSp2267jTHtzNkTZ586k8/kfM+3UjZBmFGqKIrn++VKxbCMlG2fOnV69979SIKuK9dVyoqiYkxdzyWYzMzM+L6/tLQcBIEUcnzz5re85S3vfNe7mo0GAgQEzVyZ+cFDD2ez2YxlE8Z279l97LZjHadj6HqlVPG83tjYWKVSOfPUGc3QNVWNo2jLlq0vnZ+QgEulYq1es1I2ICSvKY5eH2gAkEIoKrv11lv/9mtf0zS92WzWa/Wh4SFEYHh46Lpt2+q1OiEEYeQ4TsZO5dIZTIhtWYSQbq9HCEm0QCFxIZdN27br9rwoaLVbx9963Om41Wp1y5atmUwKkNRUlRISx1zTVJBydnaWKfp7C4V8odCoN/LFEmPa1NT09PTspuFhy7QxIbqqISm9MKSKUqs3GlPNA/sPvO/9920e37y4sLBn34FLky9+/vOfRwiHYaDrehgEuqYNDvT3XE9RtDiOLl6ctB+xHcdxez0JQBk7sH9/yrbiiNfq9f3792ez2W6n0262MIDgfHV1VVPVw4cPY0wUlUVRxGPRaDTDmJuGAVIKLoIgeI3042erd4QyKZFmWKVyBQA45wdvunHz+FjSA3Y7XUPTbNtuNBop08rn8yurq5RSr9fjMQ/DUNd1xmgiVTTrVYKxZadS6UxfZXB5pToxOblz505N1wjBqZRVr9WjmBcLBUxIt9vN5rP1Ru37938LMDl37qUdO3Y9/PD9C/MLu3bsBJCGbmCMG42GQtng0KAf+EJIy7anpqYPHz7yjW98Y9Om0etuCP/iL//6woXJfD5r26nNmwdty1peXslls6Pj2V6vxxhpNOqnTp8+euzYO951d8dxnjzx5PyVuYGBPs65aeqcx41ard5ocM63bbs+luLq8rLTbm8a3XThwoUjR464Pc/3g3w+pxkmQsi0LAAZxVEcx/LavuqrDdAklj87O5vJZJauLp479+KPf/jwxYmJHTu3S+Bur1cul23bDsOQx5wylsmkCabNRiOdyTBGFEUBQJQQQgnGEMcxSHC9UICs15v33H33jTfe+Kd/+qe5fHZlZUVRlP7+/pWVFc9zwzCyLKNSqQCC2ZkrpmmMjIw89NBDhKoDg4Pj42Mdp9Wo10ZHxyzLunp10fP8RPEol8vz8/Mry8u7du+Zmpp65JFH9u7dt2nTaCadVhQWhH6xWPR9f3l5NQwjRpVCIc8UNjV1SdfVweGR7dt3fvijv6NrRq228lf/7Qt9lZKQMUIYJNI0dW5h4Y633vnmO+6amDj3nz75yWajRinrdLq2lZqfW1AU1mq307lsKp1aWVkplYpLS8vf+fZ3b73tzRHnjCSCGP3ZFp1Y/lNPnTp/4cKf/PGf7N6zZ9vWzX/4B3+wurp619vuKlX6z184/9hjj4Vh6Lk9RVVSdipRdpO8N45ix3EwxrquG6aeyaRy+UImnQYJ+/fve9ORI//6xBOc80q5MjExMT09PTY2uri4kM1mBwcHz5w5s3Xr1kaj0W47hw7dnEpltmzZlsvl5uauVErFXqfdbjvnzp2zbfvixYv79+9vNptPP/308PDwxMREf3+f63bGxzeNj/+WrhtSQj6ff/LECd8Lpqdnu92u7/t9fX3Tl2c0TeOCr66ujo9tKpdKJ5584uabb9l/4KZOu2VbhuSRRIAQlgLFMVeYEgZBkssaprk5u9l1veHhTQDIslIp2+p5LmCs61qlXNJUrVIsnTn5pKapN99y5FUtOhGtl5aWur3OyZOPf/rTn/ntj370V3/1/V63+9WvfMVx2p/8g/9o2Zlms/ncM8/MzM7WqtVTp06dfe6F162INI0dueWWw7fcTCm7fPnytm3bXjr/YqlUKpfLL730YiaTGhsb8zyvUCiOjIz86Ec/6usbOHDgxnq9/szTT1cqpUa9vnv37lwh32q1XNd94IEHDh06BADLy8sHDx50XW9p6WqxWEyn081ms91uRxFvt9t33/3u2ZnZSqX/gQceCILgpkMHm81mNpMjBDeazVTKiuMoCLw4ltddvz2dTj/5xOP95VIxn41BIkykAEVhrbazuLT8mc9+bnZ29pvf/CdDUwmBOI5TqQzBicXiWAqKaavZmr0ym0mlBRee59/z3nvTuUwQBrceu9007VcALaUkhHz5S1/6wYP/Ypl6vdVaXVkpF4uFfDGdyRCMHKdtWZaqKqZpZfI5t+cVsrkfPPxwu9uhlAohEMaWleq5PYwIwVQ3tDgOQcB77rlnfHzsK1/+G0JIGIaHDh3653/+XqVSoZSkM+nRseGUbXHOQeJiqfTjRx87sO/A3Nx8HMfDw8NMwVKi6mq10Wj+1od/s9Vqfuc7396zZ0+tVguCYHh4JAyjarU6NDR0+fJlXTcKhbxh6FEUzs3NZ7O5f/eJ//BH//W/uG6vWM4HQVCv1wcGBvr7+x3HOX7n8cmJiYd/8LCmaoyxLVu29JXLQRBgSpL6DgAkkkEYt9ptFdO2046jSKGYYJS0ESmjSZdA1bW243iBPzQ8EnaD5559BjNqplKO0/nmt77d3z+YKDbs2jG4d7/73bfffqumKs1W62+/+pUzp8/s3bs/aepFUZTJpPP5PCFEImi3m77Xu+PNt7lul1Gm63rEORdiXYZPJrmkENzttb78pR8SQiuVSrVaNU3z6NGj9Xr9uuu2LS0vhRHPUMYQCoO413N1Td+xc+fb3v4rp0+fWpifN61Ur+fdsH37gf0HDMt84YXnEQLf94UQ+Xx+dXUFIdJut++7776dO3c++eSTnHOn3V5aurp79+5SqfLd735bUaimKXEcZTIZ27ajKKKUqqp6+tRpx3GGhodtw8IESyGkBF3X5XohjRCWUtbqrYWFxUqxNDg4tHvPHtMykum9lwMeYEpZLOTo+NjOnbu//tUvdxxHMdRYyA996Dey2eyGLnYt0ChfKOQLBYRQ/+DIJ//wP//FF77QqNXSadsyzZRth2HoOI6qKJ7nqYzNXpmdm58TYUwZJYR0u70dO3dGUSi4wATbtskUhqWMhHjTzYcnL16KoijpZZw4eXJwcDCTy4ZxlM/nlxYX/MDLpDNj4+NTl6ceffSRQ7e8qV6vhVEYhWoURa1ma3pm1jCNCxcmMpms13NByFajaaczYRg+++yzU1NTw8PD1Wo1DENT1yzTElwszM93u91iMZfNjlbrjaRGzWQznHPGFF3XV1arnU6PRzyfzzPGstmMrmtirdWDCaFBGEpM3nL8zsGBwc2bxy0787o8SZlCGAOMq7Uq59wwrGSk75VZRyLnrE2XckoVzuML51964vHHri7OY4ziKKrVqp7nDQ30I0K4lOlMVlc0gmkYRleXrpYrpW6322o1bcvq6+szTIMgQIgQzB5//Imdu3ZOT0/v379v8tJUvpB3XZdRsnl8bGZmRte0MPQPHz566vTpnuvWa7VUOpXLZSllQshet1tv1HK5XLlcHhoamp6aLhaLQRBoulapVGZmZ8IwUhQ1k0kriopBCC5b7WYQ+r4fqKo6NDQ4MTE5MrKp0+n29fd3Oo5pmnHMPc/P53K33PKmfD537twLUvAwDJOxLACEMJESDQwMvvd971sf+OPX6vovD6mhhHsFY+rffe1rP/rhDyzb6jjtVsv5s899dufOPQktv5pcLRMfIURpNKuf//PPCREHbhCGQaGYDzwv5uLEydOEUk1XKaJu143i6PidxxuN2sjwUHW1ms/n0+m06/tBGBUKhcGBwdnp6Wpt1TSNwZHRe+55z8zMzKkTTzKCV1ZWNU2llPh+bNumZVuUKUHgcR5RogjBNY0pqhZzXqs1oiDECI+MjAjBFxcXOee6aWiqgjDwWBDCVMYQJrquUoYRkDCOwyiiCPV6Lsa0UCwRij7++59YmJv767/6y4HB4Y989GN9A0MIISnimHOMN2wNY0xUTZVCAoKNGY9XbUhJTgj7h3/4+ve++918Jg0A9XpjeHTk05/5nKJoCCH6qU996tWn+YkQwrZSnEcXJycjP2CMlotFPwh03czl8zfs2NlXGRgZGRnZNFIulXRDi+O4r9IXhxEhRFGUysBApdJv2+l77733+XPPhWGYL+aXFpf6Kn1SyK1bt/T3D7x0/jzGJJcrvOWO451O27T0iYlJTdcOHbzlxXMvDQ4MRlE8PTM7PrqZEmXvvv2EoIWrC91u98YbD+7YsSOMIsPQF+bnbjx4sK/cNz0/v3377vm5eYRQsVguFAp79+y5MjtHCNV1/b777iMUe577/PPnms3W7j17r9++U1VVkEAoY0yhVGEs+WHJXFXS53zduf+kj/XiuRd+8NBDlmFQRQEEE+cvmKa5e89eAHg1oPF6ywBjjBWFPn32bMqyi4VCqVSSEqIouvX223//E//+zrve9tbjdx6/622L81fiOM5kUoNDg2i9pf3bH/vdkU2jmzaNFkuVsbHNh48cGR3b3KjVHn3kEd9173jr8VqtNr558zvf+e7aauOOt77V8zuPPf5IPl/4wH0f3Ll7/7brdxw+cmzT2PjMzOzUpUs33XTorre/Y25u/t57f21gcNg0zKO33n7+/EuXpi7vPXDTe+99/+j45n0HDtx06BZTM86/+GK327v7Pe8plsq+F33gN/6N2+sMj4ykM+m///rXl5aW9u4/cPTW29LpLGPKRuUMPwECxm/wlkcC9OTk5NLSEiHYCwMECGNcrdYOv+lNtm3j170zAwBcRF/6m/9x8ol/dV1XCsko3rx168f+7SeGR8ZAAgBQys6ePvHVr3653W7GcUwQzmaz99xzz/bde5miDgwMbQRfwfn87OWnnjrz1FNnSqUyVZQdO3aMj29+8IEHJcQLizPDQ8Pvec+vjW15xQT7wvyV73zrG9PTlwcHBzGmd73tbaurK08/dVYK3mg0Dh469I53vzcZcN74nHz8sYce/BchRaFcKBTKt9zyppMnnmy1W9VaTVOVI0eO7d67v1zu+3mvzLw2VO12KwxCIUUcxxgjShljLJPN6Zr+hoDGGHU6rW9+4x9OnDjped71113//l+/77obdm70fZM2/r8+8dj37v/nq1cXc9ncO37lV47f9TZAmDH12otQGy54/vy506dOLi0s9HpuHIdWyspkc/v27bv50BErlZFCYkLWxvwBCCGB3zt79szTT59tN5q9bg8TnE5n+gcHbz508649exGmSadjY1wIY7x0deH0yROXL13s9jq+72uankpntl5/w+HDh/v7h5I4tC7S/3KAfo118Bu7Bba2RLvdiHlcLFYwwj8xw5BM7MVR2G63LNs2TRshSG7HEMJ+8g7L+jR/q1nrdjtCSMPQi8USU3SEkBQSE7zxneQGQlKMcRE2ao0gCBBCqXQ6ny+uv0K0fuPhFb6MEPK8bqvZiKJYUVg+XzItO/lrEu82ePKXdKlOrv+2Mcq41tz6X4Ch53xZl5PGAAAAAElFTkSuQmCC';

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

function buildPrefsPage() {
  const el = document.getElementById('prefs-content');
  if (!el) return;

  const u = state.user || {};
  const sheetId = state.personalSheetId || '';
  const cacheTs = parseInt(localStorage.getItem('lv_personal_cache_ts') || '0');
  const cacheDateStr = cacheTs ? new Date(cacheTs).toLocaleString() : 'Not cached';
  const cacheSize = (() => { try { return (JSON.stringify(JSON.parse(localStorage.getItem('lv_personal_cache')||'{}')).length / 1024).toFixed(1) + ' KB'; } catch(e) { return '—'; } })();

  const toggle = (id, key, def='false') => `
    <label class="pref-toggle" title="${id}">
      <input type="checkbox" id="ptog-${id}" ${_prefGet(key, def) === 'true' ? 'checked' : ''}
        onchange="_prefSet('${key}', this.checked?'true':'false'); _onPrefChange('${id}', this.checked)">
      <div class="pref-toggle-track"></div>
    </label>`;

  const avatarHtml = u.picture
    ? `<div class="pref-avatar"><img src="${u.picture}" alt="${u.name||''}"></div>`
    : `<div class="pref-avatar">${(u.name||'?')[0].toUpperCase()}</div>`;

  el.innerHTML = `

    <!-- ── 1. Account ─────────────────────────── -->
    <div class="pref-section">
      <div class="pref-section-title">Account</div>
      <div class="pref-account-card">
        ${avatarHtml}
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:0.95rem;color:var(--text)">${u.name || 'Not signed in'}</div>
          <div style="font-size:0.8rem;color:var(--text-dim);margin-top:0.1rem">${u.email || ''}</div>
        </div>
        <button class="pref-btn danger" onclick="handleSignOut()">Sign Out</button>
      </div>
      <div class="pref-row">
        <div class="pref-row-label">
          <strong>My Collection Sheet</strong>
          <span>Open your Google Sheet — read-only recommended</span>
        </div>
        <a id="nav-sheet-link-p" href="${sheetId ? 'https://docs.google.com/spreadsheets/d/'+sheetId : '#'}" target="_blank"
          class="pref-btn" onclick="return _sheetLinkClick(event)" style="text-decoration:none">Open ↗</a>
      </div>
      <div class="pref-row">
        <div class="pref-row-label">
          <strong>Sheet ID</strong>
          <span id="pref-sheet-id" style="font-family:var(--font-mono);font-size:0.72rem;word-break:break-all">${sheetId || 'Not connected'}</span>
        </div>
        <button class="pref-btn" onclick="navigator.clipboard?.writeText('${sheetId}').then(()=>showToast('Copied'))">Copy</button>
      </div>
    </div>

    <!-- ── 2. Collection Settings ─────────────── -->
    <div class="pref-section">
      <div class="pref-section-title">Collection Settings</div>
      <div class="pref-row">
        <div class="pref-row-label">
          <strong>Track Storage Location</strong>
          <span>Adds a location step in the entry wizard</span>
        </div>
        ${toggle('location', 'lv_location_enabled', 'false')}
      </div>
      <div class="pref-row">
        <div class="pref-row-label">
          <strong>Track Year Made</strong>
          <span>Adds a "Year Made" step when adding items</span>
        </div>
        ${toggle('yearMade', 'lv_year_made_enabled', 'true')}
      </div>
      <div class="pref-row">
        <div class="pref-row-label">
          <strong>Show Quick Entry badge ⚡</strong>
          <span>Highlights items with incomplete details</span>
        </div>
        ${toggle('qeBadge', 'lv_qe_badge_enabled', 'true')}
      </div>
      <div class="pref-row">
        <div class="pref-row-label">
          <strong>Default Condition</strong>
          <span>Starting value for the condition slider in the wizard</span>
        </div>
        <select class="pref-select" id="pref-def-cond" onchange="_prefSet('lv_default_cond', this.value)">
          ${[...Array(10)].map((_,i)=>{const v=i+1; return `<option value="${v}" ${_prefGet('lv_default_cond','7')===String(v)?'selected':''}>${v} — ${['','Heavily worn','Very rough','Worn','Good','Good Plus','Very Good','VG+','Excellent','Exc+','Mint'][v]}</option>`;}).join('')}
        </select>
      </div>
      <div class="pref-row">
        <div class="pref-row-label">
          <strong>Items Per Page</strong>
          <span>How many items show in the browse list at once</span>
        </div>
        <select class="pref-select" id="pref-page-size" onchange="_prefSet('lv_page_size', this.value); state.pageSize=parseInt(this.value); state.currentPage=1; if(document.getElementById('page-browse').classList.contains('active')) renderBrowse()">
          ${[25,50,100,200].map(n=>`<option value="${n}" ${_prefGet('lv_page_size','50')===String(n)?'selected':''}>${n}</option>`).join('')}
        </select>
      </div>
    </div>

    <!-- ── 3. Display ─────────────────────────── -->
    <div class="pref-section">
      <div class="pref-section-title">Display</div>
      <div class="pref-row">
        <div class="pref-row-label">
          <strong>Theme</strong>
          <span>App color scheme</span>
        </div>
        <select class="pref-select" id="pref-theme" onchange="_prefSet('lv_theme', this.value); applyTheme(); buildPrefsPage()">
          ${['dark','light','system'].map(t=>`<option value="${t}" ${_prefGet('lv_theme','dark')===t?'selected':''}>${{dark:'🌙 Dark',light:'☀️ Light',system:'💻 System'}[t]}</option>`).join('')}
        </select>
      </div>
      <div class="pref-row">
        <div class="pref-row-label">
          <strong>Currency Symbol</strong>
          <span>Shown next to prices throughout the app</span>
        </div>
        <select class="pref-select" id="pref-currency" onchange="_prefSet('lv_currency', this.value)">
          ${['$','€','£','¥','CA$','AU$'].map(c=>`<option value="${c}" ${_prefGet('lv_currency','$')===c?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="pref-row">
        <div class="pref-row-label">
          <strong>Date Format</strong>
          <span>How dates appear in reports and detail views</span>
        </div>
        <select class="pref-select" id="pref-datefmt" onchange="_prefSet('lv_date_fmt', this.value)">
          ${[['MM/DD/YYYY','MM/DD/YYYY'],['DD/MM/YYYY','DD/MM/YYYY'],['YYYY-MM-DD','YYYY-MM-DD']].map(([v,l])=>`<option value="${v}" ${_prefGet('lv_date_fmt','MM/DD/YYYY')===v?'selected':''}>${l}</option>`).join('')}
        </select>
      </div>
      <div class="pref-row">
        <div class="pref-row-label">
          <strong>Upgrade Condition Threshold</strong>
          <span>Flag owned items below this condition as upgrade candidates</span>
        </div>
        <select class="pref-select" id="pref-upgrade-thresh" onchange="_prefSet('lv_upgrade_thresh', this.value)">
          <option value="1" id="ut-1">1 or below</option>
          <option value="2" id="ut-2">2 or below</option>
          <option value="3" id="ut-3">3 or below</option>
          <option value="4" id="ut-4">4 or below</option>
          <option value="5" id="ut-5">5 or below</option>
          <option value="6" id="ut-6">6 or below</option>
          <option value="7" id="ut-7" selected>7 or below</option>
          <option value="8" id="ut-8">8 or below</option>
          <option value="9" id="ut-9">9 or below</option>
        </select>
        <script>
          (function(){ var s=document.getElementById('pref-upgrade-thresh'); if(s){ var v=localStorage.getItem('lv_upgrade_thresh')||'7'; s.value=v; } })();
        </script>
      </div>
      <div class="pref-row">
        <div class="pref-row-label">
          <strong>Show Accuracy Disclaimer</strong>
          <span>Warning banner on Master Catalog and Complete Sets pages</span>
        </div>
        ${toggle('disclaimer', 'lv_show_disclaimer', 'true')}
      </div>
    </div>

    <!-- ── 4. Data & Backup ───────────────────── -->
    <div class="pref-section">
      <div class="pref-section-title">Data &amp; Backup</div>
      <div class="pref-row">
        <div class="pref-row-label">
          <strong>Export Full Collection</strong>
          <span>Download everything as a CSV spreadsheet</span>
        </div>
        <button class="pref-btn" onclick="exportFullCollection()">Download CSV</button>
      </div>
      <div class="pref-row">
        <div class="pref-row-label">
          <strong>Last Synced</strong>
          <span id="pref-cache-ts">${cacheDateStr} · ${cacheSize}</span>
        </div>
        <button class="pref-btn" onclick="forceRefreshData().then(()=>buildPrefsPage())">Sync Now</button>
      </div>
      <div class="pref-row">
        <div class="pref-row-label">
          <strong>Clear Local Cache</strong>
          <span>Forces a full reload from Google Sheets on next launch</span>
        </div>
        <button class="pref-btn danger" onclick="_clearCacheOnly()">Clear Cache</button>
      </div>
    </div>

    <!-- ── 5. About ───────────────────────────── -->
    <div class="pref-section">
      <div class="pref-section-title">Dashboard Cards</div>
      <div class="pref-row" style="flex-direction:column;align-items:flex-start;gap:0.4rem">
        <div style="font-size:0.82rem;color:var(--text-dim);line-height:1.6">
          You can have up to <strong style="color:var(--text)">5 stat cards</strong> on your dashboard. Click any card on the dashboard to change what it shows, or click the <strong style="color:var(--text)">+ Add card</strong> button to add a new one.
        </div>
        <button onclick="showPage('dashboard', document.querySelector('.nav-item[onclick*=dashboard]')); setTimeout(function(){ _openCardPopup(${_getSlots().indexOf(null) >= 0 ? _getSlots().indexOf(null) : 0}); }, 150);" style="padding:0.35rem 0.8rem;border-radius:7px;border:1px solid var(--border);background:var(--surface2);color:var(--text-mid);font-family:var(--font-body);font-size:0.8rem;cursor:pointer;margin-top:0.2rem">
          Go to Dashboard →
        </button>
      </div>
    </div>

    <!-- ── Collector's Market Est. ───────────── -->
    <div class="pref-section">
      <div class="pref-section-title">Collector's Market Est.</div>
      <div id="vault-prefs-row"></div>
    </div>

        <div class="pref-section">
      <div class="pref-section-title">About</div>
        <div class="pref-row">
        <div class="pref-row-label"><strong>My Collection App</strong><span>${APP_VERSION} · ${APP_DATE}</span></div>
      </div>
      <div class="pref-row">
        <div class="pref-row-label">
          <strong>Master Catalog</strong>
          <span id="pref-catalog-count">${state.masterData?.length?.toLocaleString() || '—'} items loaded</span>
        </div>
      </div>
      <div class="pref-row">
        <div class="pref-row-label">
          <strong>Send Feedback</strong>
          <span>Report a bug or suggest a feature</span>
        </div>
        <a href="mailto:bhale@ipd-llc.com?subject=My Collection App Feedback" class="pref-btn" style="text-decoration:none">Email ↗</a>
      </div>
    </div>`;

  // Keep hidden pref-location-toggle in sync (used by wizard)
  const locTog = document.getElementById('ptog-location');
  const oldTog = document.getElementById('pref-location-toggle');
  if (oldTog && locTog) oldTog.checked = locTog.checked;

  // Render Collector's Market opt-in row
  if (typeof vaultRenderPrefsRow === 'function') {
    vaultRenderPrefsRow(document.getElementById('vault-prefs-row'));
  }
}


function _onDashCardToggle(id, checked) {
  let selected = _getDashCards();
  if (checked) {
    if (selected.length >= MAX_CARDS) {
      // Revert checkbox — already at max
      const cb = document.querySelector('#pref-card-label-' + id + ' input');
      if (cb) cb.checked = false;
      return;
    }
    if (!selected.includes(id)) selected.push(id);
  } else {
    selected = selected.filter(function(s) { return s !== id; });
  }
  _setDashCards(selected);
  buildDashboard();

  // Refresh the prefs UI to update disabled states + count msg
  const countMsg = document.getElementById('pref-card-count-msg');
  if (countMsg) {
    const n = selected.filter(function(s){ return s !== 'custom'; }).length;
    countMsg.textContent = n + ' of ' + MAX_CARDS + ' standard cards selected';
  }
  // Update all checkbox disabled states
  CARD_CATALOG.forEach(function(card) {
    const lbl = document.getElementById('pref-card-label-' + card.id);
    if (!lbl) return;
    const cb = lbl.querySelector('input');
    if (!cb) return;
    const isSelected = selected.includes(card.id);
    const isDisabled = !isSelected && selected.length >= MAX_CARDS;
    cb.disabled = isDisabled;
    lbl.style.background = isSelected ? 'rgba(255,255,255,0.05)' : 'transparent';
    lbl.style.borderColor = isSelected ? 'var(--border-light,#3a4870)' : 'transparent';
  });
}

function _onPrefChange(id, val) {
  if (id === 'location') {
    // Keep hidden toggle in sync
    const old = document.getElementById('pref-location-toggle');
    if (old) old.checked = val;
  }
  if (id === 'qeBadge') {
    // Show/hide QE badge in nav
    const b1 = document.getElementById('nav-qe-count');
    const b2 = document.getElementById('mnav-qe-badge');
    const hide = !val;
    if (b1) b1.style.display = hide ? 'none' : '';
    if (b2) b2.style.display = hide ? 'none' : '';
  }
  if (id === 'yearMade') {
    // Stored — wizard reads lv_year_made_enabled at step render time (hooked below)
  }
  if (id === 'disclaimer') {
    _applyDisclaimerPref();
  }
}

function _clearCacheOnly() {
  localStorage.removeItem('lv_personal_cache');
  localStorage.removeItem('lv_personal_cache_ts');
  showToast('Cache cleared — will reload from sheet on next launch');
  buildPrefsPage();
}

function exportFullCollection() {
  const headers = ['Item #','Variation','Condition','All Original','Price Paid','Box Price','Complete Price','Has Box','Box Condition','Item Photo','Box Photo','Notes','Date Purchased','Est. Worth','Matched To','Set ID','Year Made','Is Error','Error Desc','Inventory ID','Group ID','Location'];
  const esc = v => `"${(v||'').toString().replace(/"/g,'""')}"`;
  const rows = Object.values(state.personalData)
    .filter(pd => pd.owned)
    .sort((a,b) => (a.itemNum||'').localeCompare(b.itemNum||'', undefined, {numeric:true}))
    .map(pd => [
      esc(pd.itemNum), esc(pd.variation||''), esc(pd.condition||''), esc(pd.allOriginal||''),
      esc(pd.priceItem||''), esc(pd.priceBox||''), esc(pd.priceComplete||''),
      esc(pd.hasBox||''), esc(pd.boxCond||''), esc(pd.photoItem||''), esc(pd.photoBox||''),
      esc(pd.notes||''), esc(pd.datePurchased||''), esc(pd.userEstWorth||''),
      esc(pd.matchedTo||''), esc(pd.setId||''), esc(pd.yearMade||''),
      esc(pd.isError||''), esc(pd.errorDesc||''), esc(pd.inventoryId||''),
      esc(pd.groupId||''), esc(pd.location||''),
    ].join(','));
  const dateTag = new Date().toISOString().slice(0,10);
  const csv = headers.map(h=>`"${h}"`).join(',') + '\n' + rows.join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=`my-collection-${dateTag}.csv`; a.click();
  showToast('✓ Collection exported');
}

// Apply theme on load
applyTheme();
// Watch system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (_prefGet('lv_theme','dark') === 'system') applyTheme();
});

// Apply stored page size on load
(function() {
  const stored = localStorage.getItem('lv_page_size');
  if (stored) state.pageSize = parseInt(stored);
})();

// ── NAVIGATION ─────────────────────────────────────────────────────
// ── EPHEMERA ─────────────────────────────────────────────────────
let _ephCurrentTab = 'catalogs';

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
  if (!confirm('Remove "' + (item.title || item.itemNum || label) + '" from your collection?')) return;
  // Blank sheet row if we have an actual row number
  if (item.row && typeof item.row === 'number' && item.row >= 3 && item.row < 1000000) {
    const lastCol = _ephTabCols[tabId] || 'J';
    const sheetName = (_ephTabNames[tabId] || tabId) + '!A' + item.row + ':' + lastCol + item.row;
    const blanks = [Array(lastCol.charCodeAt(0) - 64).fill('')];
    sheetsUpdate(state.personalSheetId, sheetName, blanks).catch(e => console.warn('ephemera delete row', e));
  }
  delete state.ephemeraData[tabId][rowKey];
  localStorage.removeItem('lv_personal_cache');
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
    ];
    try {
      await sheetsAppend(state.personalSheetId, 'For Sale!A:H', [row]);
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
    ];
    try {
      await sheetsAppend(state.personalSheetId, 'Sold!A:H', [row]);
      if (removeIt) {
        // Remove from ephemera sheet and state
        if (item.row && typeof item.row === 'number' && item.row >= 3 && item.row < 1000000) {
          const lastCol = _ephTabCols[tabId] || 'J';
          const sheetName = (_ephTabNames[tabId] || tabId) + '!A' + item.row + ':' + lastCol + item.row;
          const blanks = [Array(lastCol.charCodeAt(0) - 64).fill('')];
          sheetsUpdate(state.personalSheetId, sheetName, blanks).catch(e => console.warn('ephemera sold clear', e));
        }
        delete state.ephemeraData[tabId][rowKey];
        localStorage.removeItem('lv_personal_cache');
        renderBrowse();
        buildDashboard();
      }
      showToast('✓ Marked as sold');
    } catch(e) { showToast('Error saving: ' + e.message, 3000, true); }
  };
}

function buildWantPage() {
  const isMobile = window.innerWidth <= 640;
  const _wq = (state._wantSearch || '').toLowerCase();
  const entries = Object.values(state.wantData).filter(w => {
    if (!_wq) return true;
    const master = state.masterData.find(m => m.itemNum === w.itemNum && (!w.variation || m.variation === w.variation)) || {};
    return (w.itemNum||'').toLowerCase().includes(_wq)
      || (master.roadName||'').toLowerCase().includes(_wq)
      || (master.itemType||'').toLowerCase().includes(_wq)
      || (w.variation||'').toLowerCase().includes(_wq)
      || (w.notes||'').toLowerCase().includes(_wq);
  });
  // Keep count badge in sync
  const countBadge = document.getElementById('nav-wanted2');
  if (countBadge) countBadge.textContent = entries.length.toLocaleString();
  const cardsEl = document.getElementById('want-cards');
  const tableEl = document.getElementById('want-table');
  const tbody   = document.getElementById('want-tbody');

  // Priority order
  const priorityOrder = { 'High': 0, 'Medium': 1, 'Low': 2 };
  entries.sort((a, b) => (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1));

  const priorityColor = { High: 'var(--accent)', Medium: 'var(--accent2)', Low: 'var(--text-dim)' };

  if (entries.length === 0) {
    const empty = `<div style="text-align:center;padding:3rem 1rem;color:var(--text-dim)"><div style="font-size:2.5rem;margin-bottom:0.5rem">❤️</div><p>Your want list is empty</p><p style="font-size:0.8rem;margin-top:0.5rem">Add items you're looking for</p></div>`;
    if (cardsEl) cardsEl.innerHTML = empty;
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="ui-empty">No items on want list</td></tr>';
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
      return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:0.85rem 1rem">
        <div style="display:flex;align-items:center;gap:0.75rem;cursor:pointer" ${masterIdx2>=0?`onclick="openItem(${masterIdx2})"`:''}>
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
        <div style="display:flex;gap:0.35rem;margin-top:0.6rem;flex-wrap:wrap">
          <button onclick="event.stopPropagation();moveWantToCollection('${w.itemNum}','${escVar}')" style="flex:1;min-width:0;padding:0.4rem 0.3rem;border-radius:7px;font-size:0.75rem;cursor:pointer;border:1.5px solid #2ecc71;background:rgba(46,204,113,0.12);color:#2ecc71;font-family:var(--font-body);font-weight:600">+ Collection</button>
          <button onclick="event.stopPropagation();wantFindOnEbay('${w.itemNum}','${escName}')" style="flex:1;min-width:0;padding:0.4rem 0.3rem;border-radius:7px;font-size:0.75rem;cursor:pointer;border:1.5px solid #e67e22;background:rgba(230,126,34,0.12);color:#e67e22;font-family:var(--font-body);font-weight:600">eBay</button>
          <button onclick="event.stopPropagation();wantSearchOtherSites('${w.itemNum}','${escName}')" style="flex:1;min-width:0;padding:0.4rem 0.3rem;border-radius:7px;font-size:0.75rem;cursor:pointer;border:1.5px solid #2980b9;background:rgba(41,128,185,0.12);color:#2980b9;font-family:var(--font-body);font-weight:600">Search</button>
          <button onclick="event.stopPropagation();removeWantItem('${w.itemNum}','${escVar}',${w.row})" style="flex:0 0 auto;padding:0.4rem 0.6rem;border-radius:7px;font-size:0.75rem;cursor:pointer;border:1.5px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body)">Remove</button>
        </div>
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

      window._wantDescs[idx] = { title: (_isSet ? _setLabel : roadName) || w.itemNum, varDesc, fullDesc };
      const pColor = priorityColor[w.priority] || 'var(--text-dim)';
      const shortVar = varDesc.length > 30 ? varDesc.substring(0, 30) + '…' : varDesc;
      const varCell = _isSet
        ? `<div style="display:flex;flex-wrap:wrap;gap:0.2rem;align-items:center">${_setChipsHtml}</div>`
        : varDesc
          ? `<span style="cursor:pointer;border-bottom:1px dashed var(--border);color:var(--text-mid)" onclick="showWantDesc(${idx})">${shortVar}</span>`
          : (w.variation ? `<span class="text-dim">${w.variation}</span>` : '<span class="text-dim">—</span>');
      const _displayRoad = _isSet ? _setLabel : roadName;
      return `<tr>
        <td><span class="item-num">${w.itemNum}</span>${_isSet ? ' <span style="font-size:0.62rem;color:#e67e22;font-weight:600;vertical-align:middle">SET</span>' : ''}</td>
        <td>${_displayRoad || '<span class="text-dim">—</span>'}</td>
        <td>${_isSet ? '<span class="text-dim">—</span>' : (w.variation || '<span class="text-dim">—</span>')}</td>
        <td>${varCell}</td>
        <td><span style="color:${pColor};font-weight:500">${w.priority || 'Medium'}</span></td>
        <td class="market-val">${w.expectedPrice ? '$' + parseFloat(w.expectedPrice).toLocaleString() : '<span class="text-dim">—</span>'}</td>
        <td style="white-space:nowrap">
          <button onclick="moveWantToCollection('${w.itemNum}','${(w.variation||'').replace(/'/g,"\\'")}')" style="padding:0.3rem 0.5rem;border-radius:5px;font-size:0.72rem;cursor:pointer;border:1px solid #2ecc71;background:rgba(46,204,113,0.12);color:#2ecc71;font-family:var(--font-body);margin-right:0.25rem" title="Add to My Collection">+ Collection</button>
          <button onclick="wantFindOnEbay('${w.itemNum}','${(roadName||'').replace(/'/g,"\\'")}')" style="padding:0.3rem 0.5rem;border-radius:5px;font-size:0.72rem;cursor:pointer;border:1px solid #e67e22;background:rgba(230,126,34,0.12);color:#e67e22;font-family:var(--font-body);margin-right:0.25rem" title="Search eBay">eBay</button>
          <button onclick="wantSearchOtherSites('${w.itemNum}','${(roadName||'').replace(/'/g,"\\'")}')" style="padding:0.3rem 0.5rem;border-radius:5px;font-size:0.72rem;cursor:pointer;border:1px solid #2980b9;background:rgba(41,128,185,0.12);color:#2980b9;font-family:var(--font-body);margin-right:0.25rem" title="Search other auction sites">Search</button>
          <button onclick="removeWantItem('${w.itemNum}','${(w.variation||'').replace(/'/g,"\\'")}',${w.row})" style="padding:0.3rem 0.5rem;border-radius:5px;font-size:0.72rem;cursor:pointer;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body)" title="Remove from Want List">Remove</button>
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
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

// ── Want List Actions ──────────────────────────────────────────
async function removeWantItem(itemNum, variation, row) {
  if (!confirm('Remove this item from your Want List?')) return;
  const key = `${itemNum}|${variation}`;
  if (row) {
    await sheetsUpdate(state.personalSheetId, `Want List!A${row}:E${row}`, [['','','','','']]);
  }
  delete state.wantData[key];
  localStorage.removeItem('lv_personal_cache');
  localStorage.removeItem('lv_personal_cache_ts');
  buildWantPage();
  buildDashboard();
  showToast('✓ Removed from Want List');
}

function moveWantToCollection(itemNum, variation) {
  // Open collection wizard pre-filled from want list item
  openWizard('collection');
  // Short delay to let wizard initialize
  setTimeout(function() {
    if (!window.wizard) return;
    wizard.data._fromWantList = true;
    wizard.data._fromWantKey = `${itemNum}|${variation}`;
    wizard.data._rawItemNum = itemNum;
    wizard.data.itemNum = itemNum;
    if (variation) wizard.data.variation = variation;
    // Try to find master match
    const master = state.masterData.find(m => m.itemNum === itemNum && (!variation || m.variation === variation));
    if (master) {
      wizard.data.matchedItem = master;
    }
    // Land on itemNumGrouping step so the user sees grouping buttons
    // (AA/AB/ABA for F3/Alco, engine+tender for steamers, single for freight)
    const steps = getSteps('collection');
    const groupIdx = steps.findIndex(s => s.id === 'itemNumGrouping');
    if (groupIdx >= 0) {
      wizard.step = groupIdx;
      renderWizardStep();
    }
  }, 150);
}

function wantFindOnEbay(itemNum, roadName) {
  const query = ['lionel', itemNum, roadName || ''].filter(Boolean).join(' ').trim();
  const url = 'https://www.ebay.com/sch/i.html?_nkw=' + encodeURIComponent(query) + '&_sacat=180250';
  window.open(url, '_blank');
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

  document.getElementById('nav-sold').textContent = Object.keys(state.soldData).length;
}

function clearPageSearch(name) {
  const map = { browse: 'browse-search', sold: 'sold-search', want: 'want-search' };
  const el = document.getElementById(map[name]);
  // Don't clear — keep search term when returning to same page
}

function buildForSalePage() {
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
      return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:0.85rem 1rem">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <span style="font-family:var(--font-head);font-size:1.1rem;color:var(--accent)">${fs.itemNum}</span>
            ${fs.variation ? `<span style="font-size:0.72rem;color:var(--text-dim);margin-left:0.4rem">${fs.variation}</span>` : ''}
            ${master.roadName ? `<div style="font-size:0.82rem;color:var(--text);margin-top:0.1rem">${master.roadName}</div>` : ''}
            <div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.15rem">${[master.itemType, fs.condition ? 'Cond: '+fs.condition : '', fs.dateListed ? 'Listed: '+fs.dateListed : ''].filter(Boolean).join(' · ')}</div>
            ${estWorth ? `<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.1rem">Est. Worth: $${parseFloat(estWorth).toLocaleString()}</div>` : ''}
            ${fs.notes ? `<div style="font-size:0.72rem;color:var(--text-mid);margin-top:0.15rem;font-style:italic">${fs.notes.length > 60 ? fs.notes.substring(0,57)+'…' : fs.notes}</div>` : ''}
          </div>
          <div style="text-align:right;flex-shrink:0">
            ${fs.askingPrice ? `<div style="font-family:var(--font-mono);color:#e67e22;font-size:1.1rem;font-weight:600">$${parseFloat(fs.askingPrice).toLocaleString()}</div>` : '<div style="color:var(--text-dim);font-size:0.8rem">No price</div>'}
          </div>
        </div>
        <div style="display:flex;gap:0.4rem;margin-top:0.6rem;flex-wrap:wrap">
          <button onclick="markForSaleAsSold('${fs.itemNum}','${(fs.variation||'').replace(/'/g,"\\'")}','${fs.askingPrice||''}')" style="flex:1;padding:0.4rem;border-radius:7px;font-size:0.78rem;cursor:pointer;border:1.5px solid #2ecc71;background:rgba(46,204,113,0.12);color:#2ecc71;font-family:var(--font-body);font-weight:600">Mark as Sold</button>
          <button onclick="removeForSaleItem('${fs.itemNum}','${(fs.variation||'').replace(/'/g,"\\'")}',${fs.row})" style="flex:1;padding:0.4rem;border-radius:7px;font-size:0.78rem;cursor:pointer;border:1.5px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body)">Back to Collection</button>
          <button onclick="removeForSaleAndCollection('${fs.itemNum}','${(fs.variation||'').replace(/'/g,"\\'")}',${fs.row})" style="flex:0 0 auto;padding:0.4rem 0.6rem;border-radius:7px;font-size:0.78rem;cursor:pointer;border:1.5px solid #e74c3c;background:rgba(231,76,60,0.10);color:#e74c3c;font-family:var(--font-body)">Remove</button>
        </div>
      </div>`;
    }).join('') : '<div style="text-align:center;padding:3rem 1rem;color:var(--text-dim)"><div style="font-size:2.5rem;margin-bottom:0.5rem">🏷️</div><p>No items listed for sale</p></div>';
  } else {
    if (fsCardsEl) fsCardsEl.style.display = 'none';
    if (fsTableWrap) fsTableWrap.style.display = '';
    if (tbody) tbody.innerHTML = fsEntries.length ? fsEntries.map(fs => {
      const master = state.masterData.find(i => i.itemNum === fs.itemNum && i.variation === fs.variation) || {};
      const collPd = state.personalData[fs.itemNum + '|' + (fs.variation||'')] || {};
      const estWorth = fs.estWorth || collPd.userEstWorth || '';
      return `<tr>
        <td><span class="item-num">${fs.itemNum}</span>${fs.variation ? ' <span style="font-size:0.72rem;color:var(--text-dim)">' + fs.variation + '</span>' : ''}</td>
        <td><span class="tag">${master.itemType || '—'}</span></td>
        <td>${master.roadName || '—'}</td>
        <td>${fs.condition || '—'}</td>
        <td class="market-val" style="color:#e67e22">${fs.askingPrice ? '$' + parseFloat(fs.askingPrice).toLocaleString() : '—'}</td>
        <td class="text-dim">${estWorth ? '$' + parseFloat(estWorth).toLocaleString() : '—'}</td>
        <td class="text-dim">${fs.dateListed || '—'}</td>
        <td style="white-space:nowrap">
          <button onclick="markForSaleAsSold('${fs.itemNum}','${(fs.variation||'').replace(/'/g,"\\'")}','${fs.askingPrice||''}')" style="padding:0.3rem 0.5rem;border-radius:5px;font-size:0.72rem;cursor:pointer;border:1px solid #2ecc71;background:rgba(46,204,113,0.12);color:#2ecc71;font-family:var(--font-body);margin-right:0.3rem">Mark as Sold</button>
          <button onclick="removeForSaleItem('${fs.itemNum}','${(fs.variation||'').replace(/'/g,"\\'")}',${fs.row})" style="padding:0.3rem 0.5rem;border-radius:5px;font-size:0.72rem;cursor:pointer;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body);margin-right:0.3rem">Back to Collection</button>
          <button onclick="removeForSaleAndCollection('${fs.itemNum}','${(fs.variation||'').replace(/'/g,"\\'")}',${fs.row})" style="padding:0.3rem 0.5rem;border-radius:5px;font-size:0.72rem;cursor:pointer;border:1px solid #e74c3c;background:rgba(231,76,60,0.10);color:#e74c3c;font-family:var(--font-body)">Remove</button>
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
  ];
  const existingSold = state.soldData[fsKey];
  if (existingSold?.row) {
    await sheetsUpdate(state.personalSheetId, `Sold!A${existingSold.row}:H${existingSold.row}`, [soldRow]);
  } else {
    await sheetsAppend(state.personalSheetId, 'Sold!A:A', [soldRow]);
  }

  // Remove from For Sale tab
  if (fs.row) {
    await sheetsUpdate(state.personalSheetId, `For Sale!A${fs.row}:H${fs.row}`, [['','','','','','','','']]);
  }

  // Remove from My Collection
  const collKey = Object.keys(state.personalData).find(k => k.split('|')[0] === itemNum && (state.personalData[k].variation || '') === variation);
  const collEntry = collKey ? state.personalData[collKey] : null;
  if (collEntry?.row) {
    await sheetsUpdate(state.personalSheetId, `My Collection!A${collEntry.row}:W${collEntry.row}`, [['','','','','','','','','','','','','','','','','','','','','','','']]);
    delete state.personalData[collKey];
  }

  // Optimistic state update
  state.soldData[fsKey] = { row: existingSold?.row || 99999, itemNum, variation, condition: fs.condition, salePrice: salePrice || askingPrice, dateSold, notes: fs.notes };
  delete state.forSaleData[fsKey];

  localStorage.removeItem('lv_personal_cache');
  localStorage.removeItem('lv_personal_cache_ts');

  buildForSalePage();
  buildSoldPage();
  buildDashboard();
  showToast('✓ Marked as sold!');
}

async function removeForSaleItem(itemNum, variation, row) {
  if (!confirm('Remove this item from your For Sale list?')) return;
  const fsKey = `${itemNum}|${variation}`;
  if (row) {
    await sheetsUpdate(state.personalSheetId, `For Sale!A${row}:H${row}`, [['','','','','','','','']]);
  }
  delete state.forSaleData[fsKey];
  localStorage.removeItem('lv_personal_cache');
  localStorage.removeItem('lv_personal_cache_ts');
  buildForSalePage();
  showToast('✓ Removed from For Sale');
}

async function removeForSaleAndCollection(itemNum, variation, fsRow) {
  if (!confirm('Remove this item from For Sale AND your collection? This cannot be undone.')) return;
  const key = `${itemNum}|${variation}`;
  // Remove from For Sale tab
  if (fsRow) {
    await sheetsUpdate(state.personalSheetId, `For Sale!A${fsRow}:H${fsRow}`, [['','','','','','','','']]);
  }
  delete state.forSaleData[key];
  // Remove from My Collection tab
  const collEntry = state.personalData[key];
  if (collEntry && collEntry.row) {
    await sheetsUpdate(state.personalSheetId, `My Collection!A${collEntry.row}:W${collEntry.row}`, [['','','','','','','','','','','','','','','','','','','','','','','']]);  // 23 cols A-W
  }
  delete state.personalData[key];
  localStorage.removeItem('lv_personal_cache');
  localStorage.removeItem('lv_personal_cache_ts');
  buildForSalePage();
  buildDashboard();
  renderBrowse();
  showToast('✓ Item removed');
}

function showPage(name, clickedEl, _fromPopState) {
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
  document.getElementById('main-content').scrollTop = 0;
  // Push to browser history so the back button navigates within the app
  // (mobile only — skip if this call was triggered by the back button itself)
  if (!_fromPopState) {
    history.pushState({ page: name }, '', '');
  }
}

// Back button handler — intercept and navigate within the app instead of closing it
window.addEventListener('popstate', function(e) {
  if (e.state && e.state.page) {
    showPage(e.state.page, null, true);
  } else {
    // No state means we've backed past all app pages — go to dashboard
    showPage('dashboard', null, true);
    history.pushState({ page: 'dashboard' }, '', '');
  }
});

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
  wizard.steps = getSteps('set'); // called after data is set
  // Skip set_knowsNum and set_num — already filled
  const autoSkip = new Set(['set_knowsNum', 'set_num', 'set_loco']);
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
    const master = state.masterData.find(m => m.itemNum === n);
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
  // Upgrade List button (only for owned items)
  const _upgradeKey2 = `${s.itemNum}|${s.variation||''}`;
  const _alreadyUpgrade = !!state.upgradeData[_upgradeKey2];
  const upgradeBtn = document.createElement('button');
  upgradeBtn.style.cssText = 'padding:0.55rem 1rem;border-radius:8px;border:1.5px solid #8b5cf6;background:rgba(139,92,246,0.1);color:#8b5cf6;font-family:var(--font-body);font-size:0.85rem;font-weight:600;cursor:pointer';
  upgradeBtn.textContent = _alreadyUpgrade ? '↑ On Upgrade List' : '↑ Add to Upgrade List';
  if (_alreadyUpgrade) upgradeBtn.style.opacity = '0.6';
  else upgradeBtn.onclick = () => showAddToUpgradeModal(s.itemNum, s.variation||'');
  if (pd && pd.owned) btns.appendChild(upgradeBtn);

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
  if (d1) d1.style.display = show ? '' : 'none';
  if (d2) d2.style.display = show ? '' : 'none';
}

function showContactModal() {
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
  const thresh = parseInt(_prefGet('lv_upgrade_thresh', '7'));
  const _threshFilter = state._upgradeThreshFilter !== false; // default on

  let entries = Object.values(state.upgradeData).filter(u => {
    if (_uq) {
      const master = state.masterData.find(m => m.itemNum === u.itemNum) || {};
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
  if (badge) badge.textContent = Object.values(state.upgradeData).length > 0 ? Object.values(state.upgradeData).length : '—';

  const cardsEl = document.getElementById('upgrade-cards');
  const tableEl = document.getElementById('upgrade-table');
  const tbody   = document.getElementById('upgrade-tbody');

  const priorityColor = { High: 'var(--accent)', Medium: 'var(--accent2)', Low: 'var(--text-dim)' };

  if (entries.length === 0) {
    const empty = `<div style="text-align:center;padding:3rem 1rem;color:var(--text-dim)"><div style="font-size:2.5rem;margin-bottom:0.5rem">↑</div><p>Your upgrade list is empty</p><p style="font-size:0.8rem;margin-top:0.5rem">Add items from My Collection that you'd like in better condition</p></div>`;
    if (cardsEl) cardsEl.innerHTML = empty;
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="ui-empty">No items on upgrade list</td></tr>';
    return;
  }

  if (isMobile) {
    if (tableEl) tableEl.style.display = 'none';
    if (cardsEl) cardsEl.style.display = 'flex';
    cardsEl.innerHTML = entries.map(u => {
      const pd = Object.values(state.personalData).find(p => p.owned && p.itemNum === u.itemNum && (p.variation||'') === (u.variation||''));
      const master = state.masterData.find(m => m.itemNum === u.itemNum);
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
      const master = state.masterData.find(m => m.itemNum === u.itemNum);
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
  const master = state.masterData.find(m => m.itemNum === itemNum);
  if (master) {
    showItemDetailPage(state.masterData.indexOf(master));
  } else {
    showToast('Item not found in master catalog');
  }
}

function showAddToUpgradeModal(itemNum, variation) {
  const existing = state.upgradeData[`${itemNum}|${variation||''}`] || {};
  const pd = Object.values(state.personalData).find(p => p.owned && p.itemNum === itemNum && (p.variation||'') === (variation||''));
  const master = state.masterData.find(m => m.itemNum === itemNum);
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
        <button onclick="saveUpgradeItem('${itemNum}','${(variation||'').replace(/'/g,"\\'")}',${existing.row||0})" style="padding:0.6rem;border-radius:8px;background:#8b5cf6;color:#fff;border:none;font-family:var(--font-body);font-size:0.9rem;font-weight:600;cursor:pointer;margin-top:0.25rem">
          ${existing.row ? 'Update Upgrade Entry' : '+ Add to Upgrade List'}
        </button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

async function saveUpgradeItem(itemNum, variation, existingRow) {
  const priority = document.getElementById('upg-priority')?.value || 'Medium';
  const targetCond = document.getElementById('upg-target-cond')?.value || '';
  const maxPrice = document.getElementById('upg-max-price')?.value || '';
  const notes = document.getElementById('upg-notes')?.value || '';
  const row = [itemNum, variation||'', priority, targetCond, maxPrice, notes];
  const key = `${itemNum}|${variation||''}`;
  const sheetId = state.personalSheetId;
  if (!sheetId) { showToast('Not connected to a sheet'); return; }
  try {
    if (existingRow > 0) {
      await sheetsUpdate(sheetId, `Upgrade List!A${existingRow}:F${existingRow}`, [row]);
    } else {
      await sheetsAppend(sheetId, 'Upgrade List!A:A', [row]);
    }
    // Reload data
    const res = await sheetsGet(sheetId, 'Upgrade List!A3:F');
    state.upgradeData = {};
    (res.values || []).forEach((r, idx) => {
      if (!r[0] || r[0] === 'Item Number') return;
      state.upgradeData[`${r[0]}|${r[1]||''}`] = {
        row: idx+3, itemNum: r[0]||'', variation: r[1]||'',
        priority: r[2]||'Medium', targetCondition: r[3]||'', maxPrice: r[4]||'', notes: r[5]||''
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
    await sheetsUpdate(state.personalSheetId, `Upgrade List!A${row}:F${row}`, [['','','','','','']]);
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
  const master = state.masterData.find(m => m.itemNum === itemNum);
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
    const master = state.masterData.find(m => m.itemNum === itemNum);
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
  if (typeof google !== 'undefined') initGoogle();
};

