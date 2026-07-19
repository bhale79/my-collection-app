// ── CONFIG ─────────────────────────────────────────────────────
// APP_VERSION, APP_DATE defined in config.js
// Replace with your actual Google OAuth Client ID after setup
const CLIENT_ID = '161569968813-vrhet7p68vkthkunare60nqr34li5uuh.apps.googleusercontent.com';
// v0.9.885 (Brad): + photospicker scope — "From Google Photos…" import on the
// Photo Inbox. Read-only, picker-session only (the app can never browse the
// whole library — only what the user picks in Google's own window).
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/photospicker.mediaitems.readonly';
const API_KEY = ''; // Set your Google Cloud API key in settings if needed
// v0.9.917: dead GEMINI_KEY removed — photo ID goes through the vault relay
// (ai-id.js); the key lives server-side and never ships to the client.
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
// Session 155 v11: PERSONAL_SCHEMA is the SINGLE SOURCE OF TRUTH for
// My Collection column layout. Field names are stable; positions can change
// just by reordering this array (column reorder = 1-line edit).
// Derived: PERSONAL_HEADERS, PERSONAL_FIELD_INDEX, personalColLetter() etc.
// Session 156 (Push 2): reordered to match Brad's manual rearrangement +
// 2 new master-derived columns (D: masterDescription, H: variationDescription).
// CHANGED ORDER. Affects every positional row read/write in the app.
const PERSONAL_SCHEMA = [
  { field: 'itemNum',              header: 'Item Number' },
  { field: 'manufacturer',         header: 'Manufacturer' },
  { field: 'itemType',             header: 'Item Type' },
  { field: 'masterDescription',    header: 'Master Description' },     // NEW — auto from master
  { field: 'roadName',             header: 'Road Name' },
  { field: 'roadNumber',           header: 'Road Number' },
  { field: 'variation',            header: 'Variation' },
  { field: 'variationDescription', header: 'Variation Description' },  // NEW — auto from master
  { field: 'condition',            header: 'Condition (1-10)' },
  { field: 'userEstWorth',         header: 'User Est. Worth' },
  { field: 'notes',                header: 'Notes' },
  { field: 'allOriginal',          header: 'All Original' },
  { field: 'priceItem',            header: 'Item Only Price' },
  { field: 'priceBox',             header: 'Box Only Price' },
  { field: 'priceComplete',        header: 'Item+Box Complete' },
  { field: 'hasBox',               header: 'Has Box' },
  { field: 'boxCond',              header: 'Box Condition (1-10)' },
  { field: 'photoItem',            header: 'Item Photo Link' },
  { field: 'photoBox',             header: 'Box Photo Link' },
  { field: 'datePurchased',        header: 'Date Purchased' },
  { field: 'matchedTo',            header: 'Matched Tender/Engine' },
  { field: 'setId',                header: 'Set ID' },
  { field: 'yearMade',             header: 'Year Made' },
  { field: 'isError',              header: 'Is Error' },
  { field: 'errorDesc',            header: 'Error Description' },
  { field: 'quickEntry',           header: 'Quick Entry' },
  { field: 'inventoryId',          header: 'Inventory ID' },
  { field: 'groupId',              header: 'Group ID' },
  { field: 'location',             header: 'Location' },
  { field: 'era',                  header: 'Era' },
  { field: 'description',          header: 'Description' },
  { field: 'customName',           header: 'Custom Name' },
  { field: 'gauge',                header: 'Scale/Gauge' },              // v0.9.666 — appended at END (column rule)
  { field: 'dateAdded',            header: 'Date Added' },               // v0.9.720 — appended at END (column rule)
  { field: 'purchasedFrom',        header: 'Purchased From' },           // v0.9.782 — Contact ID of the seller (Contacts tab); appended at END (column rule)
];
const PERSONAL_HEADERS = PERSONAL_SCHEMA.map(s => s.header);
const PERSONAL_FIELD_INDEX = {};
PERSONAL_SCHEMA.forEach((s, i) => { PERSONAL_FIELD_INDEX[s.field] = i; });

// Spreadsheet column letter (A, B, ..., Z, AA, AB, AC, AD, ...) for a field
function personalColLetter(fieldName) {
  const idx = PERSONAL_FIELD_INDEX[fieldName];
  if (idx === undefined) {
    console.warn('[personalColLetter] unknown field:', fieldName);
    return 'A';
  }
  let n = idx + 1;   // 1-indexed column number
  let s = '';
  while (n > 0) {
    n--;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}

// Blank row sized to the schema — used to clear a row
function personalBlankRow() {
  return new Array(PERSONAL_HEADERS.length).fill('');
}

// Full-row range like "My Collection!A123:AD123"
function personalFullRowRange(rowNum) {
  const lastCol = personalColLetter(PERSONAL_SCHEMA[PERSONAL_SCHEMA.length - 1].field);
  return PERSONAL_TAB + '!A' + rowNum + ':' + lastCol + rowNum;
}

// Master-description helpers (Session 156). Look up description/varDesc from
// master data by itemNum (+ optional variation). Return '' for box rows
// (itemNums ending in -BOX or -MBOX) so boxes don't inherit a parent's text.
function _isBoxItemNum(itemNum) {
  if (!itemNum) return false;
  return /-(M)?BOX$/i.test(String(itemNum).trim());
}
function _lookupMasterDesc(itemNum) {
  if (!itemNum) return '';
  if (_isBoxItemNum(itemNum)) return '';
  if (typeof findMaster !== 'function') {
    // Audit L2: master data not loaded yet — auto-populated col stays blank
    // until next save. Note in console so this is debuggable if it happens.
    if (typeof console !== 'undefined') console.debug('[_lookupMasterDesc] findMaster not yet loaded for ' + itemNum);
    return '';
  }
  const m = findMaster(itemNum);
  return (m && m.description) ? String(m.description) : '';
}
function _lookupMasterVarDesc(itemNum, variation) {
  if (!itemNum) return '';
  if (_isBoxItemNum(itemNum)) return '';
  if (typeof findMaster !== 'function') return '';
  if (variation == null || variation === '') return '';
  const m = findMaster(itemNum, variation);
  return (m && m.varDesc) ? String(m.varDesc) : '';
}

// Build a row array from a field-name → value map, leaving omitted fields blank.
// Session 156: auto-populates masterDescription + variationDescription from master
// data if itemNum is provided and those fields aren't explicitly set.
function buildPersonalRow(fields) {
  const row = new Array(PERSONAL_HEADERS.length).fill('');
  if (!fields) return row;
  // v0.9.720: stamp Date Added on NEW rows. Full-row UPDATE callers pass the
  // existing value (even '') so re-saves never rewrite the original date.
  if (fields.dateAdded === undefined && fields.itemNum) fields = Object.assign({}, fields, { dateAdded: new Date().toISOString().slice(0, 10) });
  Object.keys(fields).forEach(k => {
    const i = PERSONAL_FIELD_INDEX[k];
    if (i !== undefined && fields[k] !== undefined && fields[k] !== null) {
      row[i] = fields[k];
    }
  });
  // Auto-populate the 2 master-derived columns if not explicitly provided.
  // v0.9.724 (Brad's 4C Nabisco card, leak #3): MANUAL rows NEVER inherit
  // catalog data — the old "manual items: findMaster returns null" assumption
  // breaks when a manual number COLLIDES with a real catalog number (4C).
  // This was stamping the F3's description INTO the manual row at save time.
  const _rowIsManual = String(fields.era || '') === 'Manual';
  const inum = fields.itemNum || '';
  const vari = fields.variation || '';
  const mdi = PERSONAL_FIELD_INDEX.masterDescription;
  const vdi = PERSONAL_FIELD_INDEX.variationDescription;
  if (!_rowIsManual && mdi !== undefined && (fields.masterDescription === undefined || fields.masterDescription === '')) {
    row[mdi] = _lookupMasterDesc(inum);
  }
  if (!_rowIsManual && vdi !== undefined && (fields.variationDescription === undefined || fields.variationDescription === '')) {
    row[vdi] = _lookupMasterVarDesc(inum, vari);
  }
  // Auto-populate Item Type / Road Name / Road Number from the catalog when the
  // caller didn't supply them (e.g. suffixed engines 204-P / 217C resolve via the
  // base number now that findMaster has a base fallback). Manual items: findMaster
  // returns null, so their caller-supplied values are kept.
  if (!_rowIsManual && typeof findMaster === 'function' && inum && !_isBoxItemNum(inum)) {   // v0.9.724
    const _mm = findMaster(inum, vari);
    if (_mm) {
      [['itemType','itemType'],['roadName','roadName'],['roadNumber','roadNum']].forEach(function(pair){
        const _ci = PERSONAL_FIELD_INDEX[pair[0]];
        if (_ci !== undefined && (fields[pair[0]] === undefined || fields[pair[0]] === '') && _mm[pair[1]]) {
          row[_ci] = String(_mm[pair[1]]);
        }
      });
    }
  }
  // Brand is a fact about the item: when the item is in the catalog, the
  // master decides the manufacturer (not the filter). Manual items keep theirs.
  var _mfi = PERSONAL_FIELD_INDEX.manufacturer;
  if (!_rowIsManual && _mfi !== undefined) {   // v0.9.724: manual rows keep the maker the user chose
    var _mb = (typeof _brandOfItem === 'function') ? _brandOfItem(inum, vari) : '';
    if (_mb) row[_mfi] = _mb;
  }
  // Force identifier columns to TEXT so Google's USER_ENTERED doesn't
  // date-parse item numbers like "0401-1" into a (negative) serial number.
  ['itemNum', 'matchedTo'].forEach(function (_k) {
    var _ci = PERSONAL_FIELD_INDEX[_k];
    if (_ci !== undefined && row[_ci] !== '' && row[_ci] !== null && row[_ci] !== undefined) {
      var _v = String(row[_ci]);
      if (_v.charAt(0) !== "'") row[_ci] = "'" + _v;
    }
  });
  return row;
}

if (typeof window !== 'undefined') {
  window.PERSONAL_SCHEMA = PERSONAL_SCHEMA;
  window.PERSONAL_HEADERS = PERSONAL_HEADERS;
  window.PERSONAL_FIELD_INDEX = PERSONAL_FIELD_INDEX;
  window.personalColLetter = personalColLetter;
  window.personalBlankRow = personalBlankRow;
  window.personalFullRowRange = personalFullRowRange;
  window.buildPersonalRow = buildPersonalRow;
  window._lookupMasterDesc = _lookupMasterDesc;
  window._lookupMasterVarDesc = _lookupMasterVarDesc;
}
const SOLD_HEADERS = [
  'Item Number','Variation','Copy #','Condition (1-10)','Item Only Price Paid',
  'Sale Price','Date Sold','Notes','Inventory ID','Manufacturer',
  // Session 176: snapshot columns so each sale is a self-contained record
  // (kept even after the item leaves My Collection) — its own details + photos.
  'All Original','Has Box','Box Condition (1-10)','Item Photo Link','Box Photo Link',
  'Road Name','Description','Est. Worth','Date Purchased','Year'
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
// Combined Want/Upgrade tab (Session 161+). One tab replaces 'Want List' +
// 'Upgrade List' with a List Type column (Want or Upgrade). The loader splits
// rows by List Type into state.wantData and state.upgradeData so existing
// read paths keep working with no changes.
const WISHLIST_HEADERS = [
  'Item Number','Variation','List Type','Priority','Target Price',
  'Target Condition','Upgrading Inventory ID','Notes','Manufacturer'
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

// ── Era filter helper for personal lists ──
// Returns true if the given item should be visible in the currently
// selected era. When _currentEra is 'all', everything is visible.
// For specific eras, looks up the master row and compares its _era tag.
// Items whose master row isn't in the loaded era data return false.
function _isInCurrentEra(itemNum) {
  if (typeof _currentEra === 'undefined' || _currentEra === 'all') return true;
  if (typeof findMaster !== 'function' || !state.masterData) return true;
  var m = findMaster(itemNum);
  if (!m) return false;
  return m._era === _currentEra;
}



// Ephemera tab definitions — shared structure, one tab per category
const EPHEMERA_TABS = [
  { id: 'catalogs',   label: 'Catalogs',    emoji: '📒', color: '#e67e22' },
  { id: 'paper',      label: 'Paper Items', emoji: '📄', color: '#3498db' },
  { id: 'mockups',    label: 'Mock-Ups',    emoji: '🔩', color: '#9b59b6' },
  { id: 'other',      label: 'Other Lionel',emoji: '📦', color: '#2ecc71' },
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

  // 3. Master data: poweredDummy field marks diesel A/B units.
  // Session 155: TIGHTENED — only treat as a paired A/B candidate when the
  // sub-type matches a known F-unit / Alco / E-unit body style, OR when a
  // B-unit partner (item+C) exists in master. Switchers, GP, SD etc. that
  // have poweredDummy = P/D no longer get the A/AA/AB/ABA prompts.
  function _isPairedDieselSubType(st) {
    if (!st) return false;
    var s = String(st).toUpperCase();
    // F3, F7, F9, FA, FA-1/FA-2, FB, PA, PA-1/PA-2, PB, E7, E8, E9
    return /\bF[379]\b|\bF[A|B]\b|\bF[A|B]-?\d?\b|\bP[A|B]\b|\bP[A|B]-?\d?\b|\bE[789]\b/.test(s);
  }
  // Pre-build a Set of normalized item numbers for O(1) B-unit existence checks.
  // (Was O(N) .some() inside an O(N) forEach — quadratic. Now linear.)
  const _masterNumSet = new Set();
  const _md = state.masterData || [];
  for (let i = 0; i < _md.length; i++) {
    _masterNumSet.add(normalizeItemNum(_md[i].itemNum));
  }
  _md.forEach(m => {
    const num = normalizeItemNum(m.itemNum);
    const pdMatch = (m.poweredDummy || '').match(/^(P|D)$/i);
    const isPaired = _isPairedDieselSubType(m.subType);
    // Only flag as paired-diesel candidate if poweredDummy + sub-type matches
    if (pdMatch && isPaired) {
      ensure(num).isDiesel = true;
    }
    // Check for B-unit existence (itemNum + 'C') via the prebuilt Set
    // B-unit existence is sufficient evidence on its own — sub-type check
    // not required (some PW catalog entries lack a sub-type but DO have a
    // B-unit partner, e.g. early Lionel F-units).
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
    // AA configuration: requires paired-diesel sub-type. Switchers no longer get AA.
    if (pdMatch && isPaired && !num.endsWith('C')) {
      addUnique(ensure(num).configs, 'AA');
    }
  });

  // ── Single-unit locomotives never come as A / AA / AB / ABA ──
  // Switchers, GE 44-Ton, GP-7/9, Fairbanks-Morse, EP-5 rectifiers, GG-1
  // electrics and motorized units are self-contained single pieces. Force
  // them back to 'single' no matter how they got flagged (the Companions /
  // Sets data can mislabel a partner). Cab units (EMD F-3, Alco FA, Alco
  // A-Unit, generic Diesel Locomotive) are left alone so their real AA/AB/ABA
  // grouping keeps working.
  function _isSingleUnitSubType(st) {
    if (!st) return false;
    var s = String(st).toLowerCase();
    return s.indexOf('switcher') >= 0
        || s.indexOf('gp-7') >= 0 || s.indexOf('gp-9') >= 0
        || s.indexOf('gp7')  >= 0 || s.indexOf('gp9')  >= 0
        || s.indexOf('fairbanks') >= 0
        || s.indexOf('rectifier') >= 0 || s.indexOf('ep-5') >= 0
        || s.indexOf('gg-1') >= 0 || s.indexOf('gg1') >= 0
        || s.indexOf('electric') >= 0
        || s.indexOf('motorized') >= 0;
  }
  _md.forEach(function(m) {
    if (!_isSingleUnitSubType(m.subType)) return;
    [normalizeItemNum(m.itemNum), String(m.itemNum || '').trim()].forEach(function(k) {
      if (k && map[k]) { map[k].isDiesel = false; map[k].configs = []; map[k].bUnit = ''; map[k].aUnit = ''; }
    });
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

// v0.9.714 (Brad): the want list showed engine+tender / A+B pairs as TWO
// rows. Fold companions into their lead for DISPLAY: lead keeps the row,
// gains _wantMates (numbers) + _pairPrice (summed expected price).
function foldWantEntries(rows) {
  var byNum = {}, absorbedBy = {};
  rows.forEach(function (w) { byNum[String(w.itemNum)] = w; });
  rows.forEach(function (w) {
    var n = String(w.itemNum);
    if (absorbedBy[n]) return;
    var mates = [];
    try {
      if (typeof getMatchingTenders === 'function') mates = mates.concat(getMatchingTenders(n) || []);
      if (typeof getSetPartner === 'function' && !/C$/i.test(n.replace(/-(P|D)$/i, ''))) {
        var sp = getSetPartner(n); if (sp) mates.push(sp);
      }
    } catch (e) {}
    mates.forEach(function (mn) {
      mn = String(mn);
      if (mn !== n && byNum[mn] && !absorbedBy[mn]) absorbedBy[mn] = n;
    });
  });
  return rows.filter(function (w) { return !absorbedBy[String(w.itemNum)]; }).map(function (w) {
    var n = String(w.itemNum);
    var mates = Object.keys(absorbedBy).filter(function (k) { return absorbedBy[k] === n; });
    if (!mates.length) return w;
    var out = Object.assign({}, w);
    out._wantMates = mates;
    // v0.9.717 (Brad's $700 AB set showing $1,400): the grouped want-save
    // writes the GROUP price onto EVERY row of the pair ([grp:ID] marker in
    // notes). Same group ⇒ ONE price, not a sum. Only sum truly separate
    // wants (no shared group marker).
    function _grpOf(e) {
      var m = String((e && e.notes) || '').match(/^\[grp:([^\]]+)\]/);
      return m ? m[1] : '';
    }
    var _leadGrp = _grpOf(w);
    var sum = parseFloat(w.expectedPrice) || 0;
    var _summed = false;
    mates.forEach(function (k) {
      var mate = byNum[k] || {};
      if (_leadGrp && _grpOf(mate) === _leadGrp) return;   // same group — price already covers it
      var mp = parseFloat(mate.expectedPrice) || 0;
      if (mp) { sum += mp; _summed = true; }
    });
    out._pairPrice = sum > 0 ? String(sum) : '';
    out._pairIsGroup = !_summed;   // label: group price vs summed pieces
    out._groupCfg = (typeof window.groupConfigLabel === 'function') ? window.groupConfigLabel(n, mates) : '';   // v0.9.723
    return out;
  });
}
window.foldWantEntries = foldWantEntries;
// v0.9.722: ONE badge count — folded want + folded upgrade (pairs count once),
// matching every list view. All nav-wishlist-count writers use this.
// v0.9.723 (Brad): name the pairing — "AA", "AB", "ABA", "Engine + Tender".
window.groupConfigLabel = function (leadNum, mates) {
  if (!mates || !mates.length) return '';
  try {
    if (mates.some(function (m) { return typeof isTender === 'function' && isTender(m); })) return 'Engine + Tender';
    var c = 0, d = 0;
    mates.forEach(function (m) {
      var s = String(m);
      if (/C$/i.test(s.replace(/-(P|D)$/i, ''))) c++;
      else if (/-D$/i.test(s)) d++;
    });
    if (c && d) return 'ABA';
    if (c) return 'AB';
    if (d) return 'AA';
  } catch (e) {}
  return 'Set';
};

// v0.9.723 (Brad): fold SOLD pairs too — no group marker on sold rows, so a
// mate folds when it's a catalog PARTNER sold on the SAME date. Duplicated
// sale price (group price on both rows) shows once; different prices sum.
window.foldSoldEntries = function (rows) {
  var byNum = {}, absorbedBy = {};
  rows.forEach(function (s) { if (!byNum[s.itemNum]) byNum[s.itemNum] = s; });
  rows.forEach(function (s) {
    var n = String(s.itemNum);
    if (absorbedBy[n]) return;
    var mates = [];
    try {
      if (typeof getMatchingTenders === 'function') mates = mates.concat(getMatchingTenders(n) || []);
      if (typeof getSetPartner === 'function' && !/C$/i.test(n.replace(/-(P|D)$/i, ''))) {
        var sp = getSetPartner(n); if (sp) mates.push(sp);
      }
    } catch (e) {}
    mates.forEach(function (mn) {
      mn = String(mn);
      var mate = byNum[mn];
      if (mn !== n && mate && !absorbedBy[mn] && String(mate.dateSold || '') === String(s.dateSold || '')) absorbedBy[mn] = n;
    });
  });
  return rows.filter(function (s) { return !absorbedBy[String(s.itemNum)]; }).map(function (s) {
    var n = String(s.itemNum);
    var mates = Object.keys(absorbedBy).filter(function (k) { return absorbedBy[k] === n; });
    if (!mates.length) return s;
    var out = Object.assign({}, s);
    out._wantMates = mates;
    out._groupCfg = window.groupConfigLabel(n, mates);
    var lp = parseFloat(s.salePrice) || 0, sum = lp, summed = false;
    mates.forEach(function (k) {
      var mp = parseFloat((byNum[k] || {}).salePrice) || 0;
      if (mp && mp !== lp) { sum += mp; summed = true; }   // equal price = duplicated group price
    });
    out._pairPrice = (summed ? sum : lp) > 0 ? String(summed ? sum : lp) : '';
    return out;
  });
};

window.wishlistFoldedCount = function () {
  try {
    var w = foldWantEntries(Object.values(state.wantData || {})).length;
    var u = foldWantEntries(Object.values(state.upgradeData || {})).length;
    return w + u;
  } catch (e) {
    return Object.keys(state.wantData || {}).length + Object.keys(state.upgradeData || {}).length;
  }
};

// ── Grouping options — SINGLE SOURCE OF TRUTH (Decision Map #1) ──
// Given an item number, returns the grouping buttons it can use: [{id,label}].
// Steam engines -> Engine Only / Engine + Tender. Alco/F-3 diesels -> A Powered /
// A Dummy (+ AA/AB/ABA from partnerMap configs). Steam↔diesel COLLISION numbers
// (221, 224) get BOTH sets; a Steam/Diesel Type filter disambiguates a collision.
// Callers: _updateGroupingButtons (wizard-handlers.js), _qe1RenderGrouping
// (wizard.js), _hasGrouping (app-collection.js). Update RAIL_ROSTER_DECISION_MAP.md
// if this changes.
function getGroupingOptions(itemNum, typeFilter) {
  var base = String(itemNum || '').trim().replace(/-(P|D)$/i, '');
  if (!base) return [];
  var hasTenders = (typeof getMatchingTenders === 'function') && getMatchingTenders(base).length > 0;
  var isF3Alco   = (typeof isF3AlcoUnit === 'function') && isF3AlcoUnit(base);
  var isBUnit    = /C$/i.test(base);
  var cfgs       = (typeof getDieselConfigs === 'function') ? (getDieselConfigs(base) || []) : [];
  var steam  = !!hasTenders;
  var diesel = !!isF3Alco && !isBUnit;
  var ft = String(typeFilter != null ? typeFilter
              : ((typeof state !== 'undefined' && state.filters && state.filters.type) || '')).toLowerCase();
  var filtSteam = ft.indexOf('steam') >= 0, filtDiesel = ft.indexOf('diesel') >= 0;
  if (steam && diesel) {
    if (filtSteam && !filtDiesel) diesel = false;
    else if (filtDiesel && !filtSteam) steam = false;
  }
  var btns = [];
  if (steam) btns.push({ id: 'engine', label: 'Engine Only' }, { id: 'engine_tender', label: 'Engine + Tender' });
  if (diesel) {
    btns.push({ id: 'a_powered', label: 'A Powered' }, { id: 'a_dummy', label: 'A Dummy' });
    if (cfgs.indexOf('AA')  >= 0) btns.push({ id: 'aa',  label: 'AA set'  });
    if (cfgs.indexOf('AB')  >= 0) btns.push({ id: 'ab',  label: 'AB set'  });
    if (cfgs.indexOf('ABA') >= 0) btns.push({ id: 'aba', label: 'ABA set' });
  }
  return btns;
}

// A-dummy unit lookup for an A-powered diesel (e.g. 204 -> 204T dummy A-unit).
// Scans master (unit A / poweredDummy D) then companion 'A Dummy' rows. Used by
// applyGrouping. (Was the wizard-local _qe1Partners.dummy scan — now global.)
function getADummyUnit(itemNum) {
  var n = String(itemNum || '').trim();
  var base = (typeof baseItemNum === 'function') ? baseItemNum(n) : n.replace(/-(P|D)$/i, '');
  var nn = normalizeItemNum(n), nb = normalizeItemNum(base), dummy = '';
  (state.masterData || []).forEach(function (m) {
    if (dummy || !m.itemNum) return;
    var mi = normalizeItemNum(m.itemNum);
    if (m.unit === 'A' && m.poweredDummy === 'D' && (mi === normalizeItemNum(base + 'T') || mi === nn || mi === nb)) dummy = m.itemNum;
  });
  if (!dummy) (state.companionData || []).forEach(function (c) {
    if (dummy) return; var en = normalizeItemNum(c.engineNum); if (en !== nn && en !== nb) return;
    if (/a\s*dummy/.test((c.companionType || '').toLowerCase()) && c.companionNum) dummy = String(c.companionNum);
  });
  return dummy;
}

// ── Grouping -> data fields — SINGLE SOURCE OF TRUTH (Decision Map #2) ──
// Sets the wizard.data fields a chosen grouping implies (tenderMatch/setMatch/
// unitPower/unit2ItemNum/setType/_setId/_itemGrouping...). Callers: _selectGrouping
// (wizard-handlers.js) + _selectGroupingData (wizard.js). The want-list group-add in
// app-pages.js is a DIFFERENT flow (picks partners off the want list) — not this.
// engine_tender leaves the tender blank so the user confirms it (Session 159); the
// photo steps gate on _itemGrouping, not the tender. Update RAIL_ROSTER_DECISION_MAP.md.
function applyGrouping(data, groupId, itemNum) {
  if (!data) return data;
  var n = String(itemNum || '').trim();
  var gsi = (typeof genSetId === 'function') ? function(){ return genSetId(n); } : function(){ return 'set-' + Date.now(); };
  var bUnit = function(){ return ((typeof getBUnit === 'function' && getBUnit(n)) || (typeof getSetPartner === 'function' && getSetPartner(n)) || (n + 'C')); };
  var aDummy = function(){ return ((typeof getADummyUnit === 'function' && getADummyUnit(n)) || n); };
  data._itemGrouping = groupId;
  if (groupId === 'engine') {
    data.tenderMatch = 'none'; data.setMatch = ''; data.unitPower = '';
  } else if (groupId === 'engine_tender') {
    data.tenderMatch = ''; data.tenderIsNonOriginal = false; data._tenderConfirmed = false;
    data.setMatch = ''; data.unitPower = '';
  } else if (groupId === 'a_powered') {
    data.unitPower = 'Powered'; data.setMatch = 'standalone'; data.tenderMatch = '';
  } else if (groupId === 'a_dummy') {
    data.unitPower = 'Dummy'; data.setMatch = 'standalone'; data.tenderMatch = '';
  } else if (groupId === 'aa') {
    data.unitPower = 'Powered'; data.setMatch = 'set-now'; data.setType = 'AA';
    data._setId = gsi(); data.unit2ItemNum = aDummy(); data.unit2Power = 'Dummy'; data.tenderMatch = '';
  } else if (groupId === 'ab') {
    data.unitPower = 'Powered'; data.setMatch = 'set-now'; data.setType = 'AB';
    data._setId = gsi(); data.unit2ItemNum = bUnit(); data.tenderMatch = '';
  } else if (groupId === 'aba') {
    data.unitPower = 'Powered'; data.setMatch = 'set-now'; data.setType = 'ABA';
    data._setId = gsi(); data.unit2ItemNum = bUnit();
    data.unit3ItemNum = aDummy(); data.unit3Power = 'Dummy'; data.tenderMatch = '';
  } else {
    data._itemGrouping = 'single'; data.tenderMatch = ''; data.setMatch = ''; data.unitPower = '';
  }
  return data;
}

// ── Item subjects — SINGLE SOURCE OF TRUTH (Decision Map #3) ──
// The pieces an add covers: [{prefix,kind,itemNum,power}] (prefix '' = main item).
// Derived from the grouping applyGrouping set. Consumers: _allPrefixes + the photo
// steps (condition columns + save loop still read the same fields — route later).
function getItemSubjects(data) {
  data = data || {};
  var subs = [{ prefix: '', kind: 'main', itemNum: data.itemNum || '' }];
  if (data._setMode) return subs;
  var g = data._itemGrouping || 'single';
  if (g === 'engine_tender') {
    subs.push({ prefix: 'tender', kind: 'tender', itemNum: data.tenderMatch || '' });
  } else if (g === 'aa' || g === 'ab') {
    subs.push({ prefix: 'unit2', kind: 'unit2', itemNum: data.unit2ItemNum || '', power: data.unit2Power || '' });
  } else if (g === 'aba') {
    subs.push({ prefix: 'unit2', kind: 'unit2', itemNum: data.unit2ItemNum || '', power: data.unit2Power || '' });
    subs.push({ prefix: 'unit3', kind: 'unit3', itemNum: data.unit3ItemNum || '', power: data.unit3Power || '' });
  }
  return subs;
}
function getGroupMembers(itemNum) {
  const pd = Object.values(state.personalData).find(p => p.itemNum === itemNum);
  if (!pd || !pd.groupId) return [];
  return Object.values(state.personalData).filter(p => p.groupId === pd.groupId);
}

// ── Shared, idempotent box cleanup for ALL sell paths (Session 176) ──
// A box / master-carton is an accessory of its item, never a separate listing.
// Whenever an item is sold — via the dashboard "Record a Sale" / wizard sold
// path OR the For-Sale "Mark as Sold" shortcut — its -BOX / -MBOX companions
// must come off My Collection too, or they strand as orphan rows that inflate
// the Items-I-Own count and never appear in the list. Centralised here so every
// sell path behaves the same. Matches companions by explicit name AND groupId,
// blanks the sheet row (keeps other rows' numbers valid) and drops the state
// entry. Safe to call twice — a second call simply finds nothing.
async function _cleanupSoldItemBoxes(leadItemNum, leadGroupId) {
  try {
    if (!state || !state.personalData) return 0;
    var lead = String(leadItemNum || '');
    var boxNames = [ (lead + '-BOX').toUpperCase(), (lead + '-MBOX').toUpperCase() ];
    var keys = Object.keys(state.personalData).filter(function(k) {
      var p = state.personalData[k];
      if (!p || !p.owned || !p.itemNum) return false;
      var num = String(p.itemNum).toUpperCase();
      if (!(num.endsWith('-BOX') || num.endsWith('-MBOX'))) return false;
      if (boxNames.indexOf(num) !== -1) return true;
      if (leadGroupId && p.groupId && p.groupId === leadGroupId) return true;
      return false;
    });
    for (var i = 0; i < keys.length; i++) {
      var bp = state.personalData[keys[i]];
      if (bp && bp.row && bp.row !== 99999) {
        try { await sheetsUpdate(state.personalSheetId, personalFullRowRange(bp.row), [personalBlankRow()]); } catch(e) {}
      }
      delete state.personalData[keys[i]];
    }
    return keys.length;
  } catch(e) { console.warn('[Sold] box cleanup:', e); return 0; }
}
window._cleanupSoldItemBoxes = _cleanupSoldItemBoxes;

// ── Sale-history helpers (Session 176) ──
// Sold is now a history: multiple sales can share the same item number (you may
// buy & sell the same catalog number more than once over the years). soldData is
// keyed uniquely per sale, so the old state.soldData[itemNum|variation] lookups
// no longer work — use these scans instead.
function _salesFor(itemNum, variation) {
  var v = variation || '';
  var out = [];
  var sd = state.soldData || {};
  Object.keys(sd).forEach(function(k){
    var s = sd[k];
    if (s && s.itemNum === itemNum && (s.variation || '') === v) out.push(s);
  });
  return out;
}
function _latestSale(itemNum, variation) {
  var arr = _salesFor(itemNum, variation);
  if (!arr.length) return null;
  arr.sort(function(a, b){ return String(b.dateSold || '').localeCompare(String(a.dateSold || '')); });
  return arr[0];
}
window._salesFor = _salesFor;
window._latestSale = _latestSale;

// Session 176: ONE builder for a 20-column Sold row so every sale path snapshots
// the same details + photos. `opts.src` is the owned collection entry to copy
// condition/box/photo/road/etc. from; explicit opts win over src.
function _buildSoldRow(opts) {
  opts = opts || {};
  var src = opts.src || {};
  var master = (typeof findMaster === 'function' && opts.itemNum) ? (findMaster(opts.itemNum) || {}) : {};
  var pick = function(a, b, c) {
    if (a !== undefined && a !== null && a !== '' && a !== 'N/A') return a;
    if (b !== undefined && b !== null && b !== '' && b !== 'N/A') return b;
    return (c === undefined ? '' : c);
  };
  return [
    pick(opts.itemNum, src.itemNum),
    pick(opts.variation, src.variation),
    opts.copy || '1',
    pick(opts.condition, src.condition),
    pick(opts.pricePaid, src.priceItem),
    opts.salePrice || '',
    opts.dateSold || new Date().toISOString().split('T')[0],
    opts.notes || '',
    pick(opts.inventoryId, src.inventoryId),
    pick(opts.manufacturer, src.manufacturer, ((typeof _brandOfItem === 'function' ? _brandOfItem(opts.itemNum) : '') || (typeof _getEraManufacturer === 'function' ? _getEraManufacturer() : 'Lionel'))),
    pick(src.allOriginal),
    pick(src.hasBox),
    pick(src.boxCond),
    pick(src.photoItem),
    pick(src.photoBox),
    pick(src.roadName, master.roadName),
    pick(src.description, master.description),
    pick(src.userEstWorth),
    pick(src.datePurchased),
    pick(src.yearMade, master.yearProd),
  ];
}
window._buildSoldRow = _buildSoldRow;
// Unique transient key for an optimistic Sold entry (replaced by the row-based
// key on the next data reload).
function _newSoldKey() { return 'sold-opt-' + Date.now() + '-' + Math.floor(Math.random() * 100000); }
window._newSoldKey = _newSoldKey;
function normalizeItemNum(n) {
  const s = (n || '').toString().trim();
  return s.match(/^\d+\.0$/) ? s.slice(0, -2) : s;
}
// Strip powered/dummy/trailing suffixes for base-number comparison
// Handles Lionel catalog style (2343P, 2343T, 2343C) and app style (2343-P, 2343-D)
function baseItemNum(n) {
  return normalizeItemNum(n).replace(/[-]?[PDTC]$/i, '');
}
// Bug 14 (Session 154): track IDs handed out this session but not yet
// committed to state — e.g. an item's ID assigned moments before its box's —
// so back-to-back saves don't collide on the same Inventory ID.
var _issuedInvIds = {};
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
  // Audit NEW #8 fix: also scan for-sale/upgrade/want data so we don't
  // re-issue an inventoryId that's already in use in another list.
  _scanMax(state.forSaleData);
  _scanMax(state.upgradeData);
  _scanMax(state.wantData);
  Object.keys(_issuedInvIds).forEach(function(k){ var n=parseInt(k); if(!isNaN(n)&&n>max) max=n; });
  // Persistent high-water-mark (inv-id hardening, v0.9.634): never re-issue an ID
  // at or below the highest ever handed out — protects against a stale/partial
  // in-memory snapshot that would otherwise reuse a number (caused 1931290 to
  // collide with 8359 at inventoryId 97).
  try { var _hwm = parseInt(localStorage.getItem('lv_inv_hwm')); if (!isNaN(_hwm) && _hwm > max) max = _hwm; } catch (e) {}
  var next = String(max + 1);
  _issuedInvIds[next] = true;
  try { localStorage.setItem('lv_inv_hwm', next); } catch (e) {}
  return next;
}
// Raise the persistent inventory-ID watermark from all loaded lists. Monotonic —
// only ever increases. Called after personal data loads so the watermark knows
// the true global max even when only part of the collection is in memory.
function _seedInvHwm() {
  try {
    var max = parseInt(localStorage.getItem('lv_inv_hwm')); if (isNaN(max)) max = 0;
    var scan = function (obj) { Object.values(obj || {}).forEach(function (r) { var id = parseInt(r && r.inventoryId); if (!isNaN(id) && id > max) max = id; }); };
    scan(state.personalData); scan(state.isData); scan(state.scienceData); scan(state.constructionData); scan(state.mySetsData); scan(state.forSaleData); scan(state.upgradeData); scan(state.wantData);
    localStorage.setItem('lv_inv_hwm', String(max));
  } catch (e) {}
}
if (typeof window !== 'undefined') window._seedInvHwm = _seedInvHwm;
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
    // Session 132: read tab name from config so renames don't break this check
    var _boxesTab = (typeof ERA_TABS !== 'undefined' && ERA_TABS.pw && ERA_TABS.pw.boxes) || 'Lionel PW - Boxes';
    return m._tab === _boxesTab && (m.itemNum === num || m.itemNum === itemNum || baseItemNum(m.itemNum) === baseItemNum(num));
  });
  if (state._boxVarCache) state._boxVarCache.set(cacheKey, boxes);
  return boxes;
}
function _buildGroupBoxRow(unitNum, boxCond, boxPhotoLink, groupId, datePurchased, leadItemNum, boxVariation, boxVariationDesc) {
  var noteText = 'Box for ' + unitNum;
  if (boxVariationDesc) noteText += ' — ' + boxVariationDesc;
  // Session 156: uses buildPersonalRow so the field map is schema-agnostic.
  // -BOX items skip master description auto-populate by design (Brad's call).
  return buildPersonalRow({
    itemNum:      unitNum + '-BOX',
    variation:    boxVariation || '',
    condition:    boxCond || '',
    boxCond:      boxCond || '',
    hasBox:       'Yes',
    photoBox:     boxPhotoLink || '',
    notes:        noteText,
    datePurchased: datePurchased || '',
    matchedTo:    unitNum,
    inventoryId:  nextInventoryId(),
    groupId:      groupId,
  });
}
function genSetId(baseNum) {
  return 'SET-' + baseNum + '-' + Date.now();
}

// ── STATE ───────────────────────────────────────────────────────
// ── Cached preference values (read once at startup, updated on change) ──
var _prefLocEnabled = localStorage.getItem('lv_location_enabled') === 'true';

var state = {
  user: null,
  masterSheetId: null,
  ephemeraData: {},   // keyed by tab name → { rowKey: record }
  userDefinedTabs: [], // array of { id, label } for user-created custom tabs
  isError: false,
  personalSheetId: null,
  masterData: [],      // all rows from master sheet
  personalData: {},    // Phase 3 — keyed by inventoryId -> personal row (owned items)
  soldData: {},        // keyed by "itemNum|variation" -> sold row
  forSaleData: {},     // Phase 3 — keyed by inventoryId -> for sale row
  wantData: {},
  upgradeData: {},     // Phase 3 — keyed by inventoryId -> upgrade list row
  isData: {},             // keyed by row# -> instruction sheet data
  scienceData: {},        // keyed by row# -> science set personal data
  constructionData: {},   // keyed by row# -> construction set personal data
  partnerMap: {},      // Audit L4: built by buildPartnerMap from companions + sets
  setData: [],         // all rows from Master Set list (read-only reference)
  mySetsData: {},      // Phase 3 — keyed by inventoryId -> owned set record from personal My Sets tab
  companionData: [],   // all rows from Companions tab (engine/tender/B-unit relationships)
  catalogRefData: [],  // all rows from master Catalogs tab (reference list for paper item wizard)
  isRefData: [],       // all rows from master Instruction Sheets tab (reference list for IS wizard)
  filteredData: [],
  currentPage: 1,
  pageSize: (parseInt(localStorage.getItem('lv_page_size'), 10) || 50),
  filters: { owned: false, unowned: false, boxed: false, wantList: false, type: '', road: '', search: '', quickEntry: '' },
  currentItem: null,
};

// ── Auth (beta gate, OAuth, sign-in/out, tokens) moved to app-auth.js (Session 110, Round 2 Chunk 11) ──
// ── UI builders, onboarding, sheet init + user-defined tabs moved to app-setup.js (Session 111, Round 2 Chunk 12) ──

// ── Data patches + loadAllData orchestrator moved to app-data.js (Session 111, Round 2 Chunk 13) ──

// ── Master sheet tab name config (era-aware — single source of truth) ────
// SHEET_TABS contents are swapped when the user changes era.
var SHEET_TABS = {};

// ── Session 142 (Tier 4.23) ── Smart default era for new users ──
// If the user has saved lv_era, use that (returning user). Otherwise pick
// the most-likely flagship era based on their Mfr + Scale prefs from
// Sessions 136-138. Falls back to 'all' if prefs unknown (truly brand
// new user before they've gone through onboarding).
function _smartDefaultEra() {
  // Step 3b: chip state is the source of truth for initial era. If any of
  // mfr/scale/era is 'any', we use the 'all' meta-era so the cross-era loader
  // pulls everything. Specific era chip wins otherwise.
  try {
    var rawCh = localStorage.getItem('lv_browse_filter_state');
    if (rawCh) {
      // S151: chip era is now a time period — always means cross-era load.
      // Any chip state with valid mfr/scale/era/section -> 'all' meta-era.
      return 'all';
    }
  } catch(e) {}
  try {
    var saved = localStorage.getItem('lv_era');
    // Session 154: only honor the saved era if it's still a valid ERAS key.
    if (saved && typeof ERAS !== 'undefined' && ERAS[saved]) return saved;
    var rawM = localStorage.getItem('lv_collect_mfrs');
    var rawS = localStorage.getItem('lv_collect_scales');
    var mfrs = [], scales = [];
    try { if (rawM) mfrs = JSON.parse(rawM); } catch (e) { mfrs = []; }
    try { if (rawS) scales = JSON.parse(rawS); } catch (e) { scales = []; }
    if (!Array.isArray(mfrs)   || !mfrs.length)   return 'all';  // first-time-ever default
    if (!Array.isArray(scales) || !scales.length) return 'all';
    var hasMfr   = function(m) { return mfrs.indexOf(m) >= 0; };
    var hasScale = function(s) { return scales.indexOf(s) >= 0; };
    // Priority order — Lionel collectors are most common, Postwar is flagship
    if (hasMfr('lionel') && hasScale('o'))        return 'pw';
    if (hasMfr('lionel') && hasScale('ho'))       return 'mod_ho';
    if (hasMfr('lionel') && hasScale('s'))        return 'mod_s';
    if (hasMfr('lionel') && hasScale('standard')) return 'prewar';
    if (hasMfr('atlas')  && hasScale('o'))        return 'atlas';
    if (hasMfr('mth')    && hasScale('o'))        return 'mth_o';
    if (hasMfr('mth')    && hasScale('ho'))       return 'mth_ho';
    if (hasMfr('mth')    && hasScale('s'))        return 'mth_s';
    if (hasMfr('mth')    && hasScale('g'))        return 'mth_g';
    if (hasMfr('mth')    && hasScale('standard')) return 'mth_tinplate';
  } catch(e) {}
  return 'all';
}
var _currentEra = _smartDefaultEra();
// Migration: 'mod' era was merged into 'mpc' (MPC/Modern combined)
if (_currentEra === 'mod') { _currentEra = 'mpc'; try { localStorage.setItem('lv_era', 'mpc'); } catch(e) {} }
// Session 154: self-heal orphaned era keys. If the saved era is no longer a
// valid ERAS key (e.g. a manufacturer era that was removed), fall back to the
// 'all' meta-era — otherwise the browse chip filter silently never applies.
if (typeof ERAS === 'undefined' || !ERAS[_currentEra]) {
  _currentEra = 'all'; try { localStorage.setItem('lv_era', 'all'); } catch(e) {}
}
function _applyEraTabs(era) {
  Object.keys(SHEET_TABS).forEach(function(k) { delete SHEET_TABS[k]; });
  // 'all' is a meta-era — fall back to the most data-rich real era
  // (pw) for SHEET_TABS so any code that reads SHEET_TABS during a
  // multi-era load gets sensible defaults. Real era loads still
  // re-apply per-era tabs as they iterate.
  var realEra = (era === 'all') ? 'pw' : era;
  Object.assign(SHEET_TABS, ERA_TABS[realEra] || ERA_TABS.pw);
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
// Default: all eras enabled.
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
  // 'all' meta-era is always available regardless of preferences
  if (era === 'all') return true;
  var enabled = _getEnabledEras();
  if (enabled.indexOf(era) < 0) return false;
  // Session 137: gate by manufacturer preference first.
  var mfr = (typeof _manufacturerOfEra === 'function') ? _manufacturerOfEra(era) : null;
  if (mfr && !_isManufacturerEnabled(mfr)) return false;
  // Session 136: also gate by scale preference. An era is enabled only if its
  // scale is also enabled. Mixed-scale eras (Pre-War) get null here and are
  // always considered scale-enabled at the era level; per-item gauge filtering
  // happens in _pdEraEnabled via _scaleOfItem().
  var sc = _scaleOfEra(era);
  if (sc === null) return true;
  return _isScaleEnabled(sc);
}

// ── Session 136 ─ Scale preference helpers (Tier 3.14) ────────────────────────
// Default: all scales enabled. User can disable scales they don't collect to
// hide every era of every manufacturer in that scale. Admins always see all.
function _getEnabledScales() {
  try {
    var saved = localStorage.getItem('lv_collect_scales');
    if (saved) {
      var arr = JSON.parse(saved);
      if (Array.isArray(arr) && arr.length) return arr;
    }
  } catch(e) {}
  // Default: every scale in WHAT_I_COLLECT.SCALES
  var defaults = [];
  if (typeof WHAT_I_COLLECT !== 'undefined' && WHAT_I_COLLECT.SCALES) {
    Object.keys(WHAT_I_COLLECT.SCALES).forEach(function(k) { defaults.push(k); });
  }
  return defaults;
}
function _setEnabledScales(arr) {
  try { localStorage.setItem('lv_collect_scales', JSON.stringify(arr || [])); } catch(e) {}
}
function _isScaleEnabled(scaleId) {
  if (!scaleId) return true; // unknown scale -> don't hide
  return _getEnabledScales().indexOf(scaleId) >= 0;
}
// Era -> scale id. null for mixed-scale eras (Pre-War).
function _scaleOfEra(era) {
  if (!era || era === 'all') return null;
  if (typeof WHAT_I_COLLECT !== 'undefined' && WHAT_I_COLLECT.ERA_TO_SCALE
      && Object.prototype.hasOwnProperty.call(WHAT_I_COLLECT.ERA_TO_SCALE, era)) {
    return WHAT_I_COLLECT.ERA_TO_SCALE[era];
  }
  return null;
}
// Item -> scale id. Uses _scaleOfEra first; falls back to gauge field for
// mixed-scale eras like Pre-War. Returns null if unknown (caller treats null
// as "don't hide" for safety).
function _scaleOfItem(item) {
  if (!item) return null;
  var era = _itemEraKey ? _itemEraKey(item) : ((item._era || item.era || '').toLowerCase());
  var eraScale = _scaleOfEra(era);
  if (eraScale) return eraScale;
  var g = String(item.gauge || '').toLowerCase().trim();
  if (!g) return null;
  if (g === 'standard gauge' || g === 'standard/o gauge' || g.indexOf('2-7/8') === 0) return 'standard';
  if (g === 'oo scale' || g === 'oo') return 'standard';
  if (g.indexOf('tinplate') >= 0) return 'standard';
  if (g === 'ho scale' || g === 'ho') return 'ho';
  if (g === 's gauge' || g === 's' || g === 's scale') return 's';
  if (g === 'g scale' || g === 'g' || g === 'g/one gauge' || g === 'g / one gauge') return 'g';
  // O variants: 'o gauge', 'o', 'o27', 'o72'
  if (g.charAt(0) === 'o') return 'o';
  return null;
}

// ── Session 137 ─ Manufacturer preference helpers (Tier 3.15) ─────────────────
// Parallel to the era + scale pref pattern. Default: all manufacturers in
// WHAT_I_COLLECT.MANUFACTURERS are enabled. Admins always see all.
function _getEnabledManufacturers() {
  try {
    var saved = localStorage.getItem('lv_collect_mfrs');
    if (saved) {
      var arr = JSON.parse(saved);
      if (Array.isArray(arr) && arr.length) return arr;
    }
  } catch(e) {}
  var defaults = [];
  if (typeof WHAT_I_COLLECT !== 'undefined' && WHAT_I_COLLECT.MANUFACTURERS) {
    Object.keys(WHAT_I_COLLECT.MANUFACTURERS).forEach(function(k) { defaults.push(k); });
  }
  return defaults;
}
function _setEnabledManufacturers(arr) {
  try { localStorage.setItem('lv_collect_mfrs', JSON.stringify(arr || [])); } catch(e) {}
}
function _isManufacturerEnabled(mfrId) {
  if (!mfrId) return true; // unknown manufacturer -> don't hide
  return _getEnabledManufacturers().indexOf(String(mfrId).toLowerCase()) >= 0;
}
// Era -> manufacturer id. Reads ERAS[era].manufacturer (already exists) and
// lowercases for the config-key match.
function _manufacturerOfEra(era) {
  if (!era || era === 'all') return null;
  if (typeof ERAS !== 'undefined' && ERAS[era] && ERAS[era].manufacturer) {
    return String(ERAS[era].manufacturer).toLowerCase();
  }
  return null;
}
// Item -> manufacturer id. Uses pd.manufacturer if set, else derives from era.
function _manufacturerOfItem(item) {
  if (!item) return null;
  if (item.manufacturer) return String(item.manufacturer).toLowerCase();
  var era = (typeof _itemEraKey === 'function') ? _itemEraKey(item) : ((item._era || item.era || '').toLowerCase());
  return _manufacturerOfEra(era);
}
// Brand LABEL for an item, derived from the master catalog (Lionel/MTH/Atlas/...).
// Single source of truth for 'what brand is this item' on every SAVE path.
// Returns '' when the item isn't in the catalog (manual entry) so callers fall back.
var _BRAND_LABELS = { lionel:'Lionel', mth:'MTH', atlas:'Atlas', menards:'Menards', '3rd rail':'3rd Rail', thirdrail:'3rd Rail', sunset:'3rd Rail', williams:'Williams', weaver:'Weaver', rmt:'RMT', kline:'K-Line', 'k-line':'K-Line', 'k line':'K-Line', marx:'Marx', ives:'Ives', american:'American Flyer', 'american flyer':'American Flyer' };
function _brandLabel(key) {
  if (!key) return '';
  var k = String(key).toLowerCase().trim();
  return _BRAND_LABELS[k] || (k.charAt(0).toUpperCase() + k.slice(1));
}
function _brandOfItem(itemOrNum, variation) {
  var item = (itemOrNum && typeof itemOrNum === 'object') ? itemOrNum
    : ((typeof findMaster === 'function' && itemOrNum) ? findMaster(itemOrNum, variation) : null);
  if (!item) return '';
  var key = (typeof _manufacturerOfItem === 'function') ? _manufacturerOfItem(item) : null;
  return key ? _brandLabel(key) : '';
}
if (typeof window !== 'undefined') { window._brandOfItem = _brandOfItem; window._brandLabel = _brandLabel; }

// ── Session 121 ─ Era-pref filter helpers for dashboard cards & panels ────────
// In 'all' mode the dashboard would otherwise count items from eras the user
// has disabled in Preferences > "What I Collect". These helpers are NO-OPs
// outside 'all' mode (single-era data is already filtered by data load).
// Use _filterByEraPref(arrayOrMap) at the start of any card/panel render.
function _itemEraKey(item) {
  // Returns canonical era key (pw / mpc / mod / atlas / etc.) for any item that
  // has an itemNum. Tries item.era first (personalData carries it), falls back
  // to an O(1) master-catalog lookup via findMaster().
  if (!item) return null;
  if (item.era) {
    var e = (item.era || '').toLowerCase().trim();
    if (typeof ERAS !== 'undefined' && ERAS[e]) return e;
    if (e === 'postwar' || e === 'post-war' || e === 'manual') return 'pw';
    if (e === 'modern' || e === 'mod') return 'mod';
    if (e === 'mpc') return 'mpc';
    if (typeof ERAS !== 'undefined') {
      var keys = Object.keys(ERAS);
      for (var i = 0; i < keys.length; i++) {
        if (ERAS[keys[i]].label && ERAS[keys[i]].label.toLowerCase() === e) return keys[i];
      }
    }
  }
  if (item.itemNum && typeof findMaster === 'function') {
    var m = findMaster(item.itemNum, item.variation);
    if (m && m._era) return m._era;
  }
  return null;
}
function _pdEraEnabled(item) {
  // Session 137: in single-era mode AND 'all' mode, also gate by item's
  // manufacturer + scale. Era check only applies in 'all' mode.
  if (typeof _manufacturerOfItem === 'function') {
    var m1 = _manufacturerOfItem(item);
    if (m1 && !_isManufacturerEnabled(m1)) return false;
  }
  if (typeof _scaleOfItem === 'function') {
    var s1 = _scaleOfItem(item);
    if (s1 && !_isScaleEnabled(s1)) return false;
  }
  if (typeof _currentEra === 'undefined' || _currentEra !== 'all') return true;
  // 'all' mode also applies the era pref
  var era = _itemEraKey(item);
  if (!era) return true;
  return _isEraEnabled(era);
}
function _filterByEraPref(items) {
  if (typeof _currentEra === 'undefined' || _currentEra !== 'all') return items;
  if (Array.isArray(items)) return items.filter(_pdEraEnabled);
  if (items && typeof items === 'object') {
    var out = {};
    Object.keys(items).forEach(function(k) {
      if (_pdEraEnabled(items[k])) out[k] = items[k];
    });
    return out;
  }
  return items;
}

// ── Session 125 ─ Type-filter dropdown helper ───────────────────────────────
// Returns the subset of canonical TYPE_BUCKETS that actually have at least one
// item in the current era's masterData. Replaces hardcoded lists like
//   (window.TYPE_BUCKETS || []).map(b => b.label)
// in browse.js + wizard.js so Atlas/MTH eras don't show Lionel-only types like
// Tender, Trolley, Operating Freight when those eras have none of them.
// Preserves the canonical (alphabetical-by-short-label) order from TYPE_BUCKETS.
function _bucketsInCurrentEra() {
  if (!state || !state.masterData || !state.masterData.length) {
    // Before data loads, fall back to all buckets so dropdowns aren't empty.
    return (window.TYPE_BUCKETS || []).map(function(b){ return b.label; });
  }
  if (typeof getTypeBucketLabel !== 'function') {
    return (window.TYPE_BUCKETS || []).map(function(b){ return b.label; });
  }
  var present = Object.create(null);
  for (var i = 0; i < state.masterData.length; i++) {
    var lbl = getTypeBucketLabel(state.masterData[i]);
    if (lbl) present[lbl] = true;
  }
  return (window.TYPE_BUCKETS || [])
    .filter(function(b){ return present[b.label]; })
    .map(function(b){ return b.label; });
}

// Hide era-dropdown options the user has disabled. Always keep the CURRENT era
// visible so the user can switch away even if it's disabled.
function _applyEraVisibility() {
  var sel = document.getElementById('era-select');
  if (!sel) return;
  var enabled = _getEnabledEras();
  Array.from(sel.options).forEach(function(opt) {
    var visible = enabled.indexOf(opt.value) >= 0 || opt.value === _currentEra;
    opt.style.display = visible ? '' : 'none';
    opt.disabled = !visible;
  });
}

// ── Catalog loading status (Tiers 1-3): pill, auto-recover, stall banner ──
var _catWatchTimer = null, _catWatchStart = 0, _catLastLoaded = -1, _catProgressAt = 0;
function _catalogReady() {
  return !!(typeof state !== 'undefined' && state.masterData && state.masterData.length > 0);
}
function _wizRelookupIfOpen() {
  try {
    if (typeof wizard !== 'undefined' && wizard && wizard.data && document.getElementById('wiz-match') && typeof lookupItem === 'function') {
      lookupItem(wizard.data.itemNum || '');
    }
  } catch(e) {}
}
function _catalogLoadingBegin() {
  if (_catalogReady()) return;       // already have a catalog to search
  if (_catWatchTimer) return;        // already watching
  _catWatchStart = Date.now(); _catProgressAt = Date.now(); _catLastLoaded = -1;
  _catalogPillShow();
  _catWatchTimer = setInterval(_catalogLoadingTick, 700);
}
function _catalogLoadingTick() {
  if (_catalogReady()) { _catalogLoadingEnd(true); return; }
  var le = (typeof state !== 'undefined' && state.loading) ? state.loading.allEras : null;
  var loaded = le ? le.loaded : 0;
  if (loaded !== _catLastLoaded) { _catLastLoaded = loaded; _catProgressAt = Date.now(); _catalogStallBanner(false); }
  _catalogPillShow();
  // Stalled = no era completed for 14s (and at least 10s in) -> offer refresh.
  if (Date.now() - _catProgressAt > 14000 && Date.now() - _catWatchStart > 10000) _catalogStallBanner(true);
}
function _catalogLoadingEnd(ready) {
  if (_catWatchTimer) { clearInterval(_catWatchTimer); _catWatchTimer = null; }
  _catalogPillHide();
  _catalogStallBanner(false);
  if (ready) _wizRelookupIfOpen();
}
function _catalogPillShow() {
  if (document.getElementById('cat-stall-banner')) return; // banner replaces pill
  var pill = document.getElementById('cat-loading-pill');
  if (!pill) {
    pill = document.createElement('div');
    pill.id = 'cat-loading-pill';
    pill.style.cssText = 'position:fixed;bottom:1.1rem;left:50%;transform:translateX(-50%);z-index:9998;background:var(--surface2,#222);border:1px solid var(--border,#444);border-radius:20px;padding:0.5rem 1rem;font-size:0.82rem;color:var(--text-mid,#ccc);box-shadow:0 4px 16px rgba(0,0,0,0.35);display:flex;align-items:center;gap:0.5rem;max-width:90vw';
    document.body.appendChild(pill);
  }
  var le = (typeof state !== 'undefined' && state.loading) ? state.loading.allEras : null;
  var prog = (le && le.total) ? (' ' + le.loaded + ' of ' + le.total) : '';
  // v0.9.883 (Brad): the pill used to RECREATE its spinner + text every
  // 700ms tick, forcing a repaint loop for the whole catalog load \u2014 it
  // made the (translucent) crop screen flicker on phones. Build the
  // spinner once; only touch the text node when the count changes.
  var txt = document.getElementById('cat-loading-pill-txt');
  if (!txt) {
    pill.innerHTML = '<span style="display:inline-block;width:12px;height:12px;border:2px solid var(--accent,#f05008);border-top-color:transparent;border-radius:50%;animation:spin 0.7s linear infinite"></span><span id="cat-loading-pill-txt"></span>';
    txt = document.getElementById('cat-loading-pill-txt');
  }
  var msg = 'Loading your catalog' + prog + '\u2026';
  if (txt && txt.textContent !== msg) txt.textContent = msg;
}
function _catalogPillHide() {
  var pill = document.getElementById('cat-loading-pill');
  if (pill && pill.parentNode) pill.parentNode.removeChild(pill);
}
function _catalogStallBanner(show) {
  var b = document.getElementById('cat-stall-banner');
  if (show) {
    if (b) return;
    _catalogPillHide();
    b = document.createElement('div');
    b.id = 'cat-stall-banner';
    b.onclick = function() { location.reload(); };
    b.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#7a1f1f;color:#fff;font:600 0.9rem/1.4 sans-serif;padding:0.85rem 1rem;text-align:center;cursor:pointer';
    b.textContent = '\u26A0\uFE0F Your catalog is taking a while to load \u2014 tap here to refresh.';
    document.body.appendChild(b);
  } else if (b && b.parentNode) {
    b.parentNode.removeChild(b);
  }
}

// ── Switch era: swap tabs, clear caches, reload ──
async function switchEra(era) {
  if (!ERAS[era]) return;
  if (typeof _catalogLoadingBegin === 'function') _catalogLoadingBegin();
  // Session 116: 'all' is the meta-era — orchestrate all real eras.
  if (era === 'all') return loadAllErasMode();

  _currentEra = era;
  localStorage.setItem('lv_era', era);
  _applyEraTabs(era);
  // Reset state data — per-era IDB caches stay intact so other eras
  // can still hydrate quickly when the user comes back to them.
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
      if (typeof showPage === 'function') showPage('browse');
    }
    // Session 127: cross-scope search click-through — open the requested item's
    // detail page after the new era's data finishes loading.
    if (state._pendingOpen) {
      var _po = state._pendingOpen;
      state._pendingOpen = null;
      var _idx = (state.masterData || []).findIndex(function(m) {
        if (!m) return false;
        if (typeof normalizeItemNum === 'function') {
          if (normalizeItemNum(m.itemNum) !== normalizeItemNum(_po.itemNum)) return false;
        } else if ((m.itemNum || '') !== _po.itemNum) {
          return false;
        }
        if (_po.variation === '' || _po.variation == null) return true;
        return (m.variation || '') === _po.variation;
      });
      if (_idx >= 0 && typeof showItemDetailPage === 'function') {
        if (typeof showPage === 'function') showPage('browse');
        showItemDetailPage(_idx);
      }
    }
    if (typeof renderBrowse === 'function') renderBrowse();
    if (typeof buildDashboard === 'function') buildDashboard();
    showToast(ERAS[era].label + ' era loaded — ' + (state.masterData||[]).length + ' items');
  } catch(e) { console.error('[switchEra]', e); showToast('Era switch error: ' + e.message); }
}

// ── Load 'All Collection' meta-era ────────────────────────────────
// Session 116: hydrates state.masterData (and set/catalog/IS/companion
// data) from per-era IDB caches in parallel, then sequentially refreshes
// each era from Sheets in the background. Each item is tagged with
// `_era` so renderers can show era badges or filter when desired.
//
// UX: dashboard + collection light up in ~1-2s from cache. Refresh
// happens in the background — user is already clicking around while
// each era's fresh data lands and triggers a re-render.
async function loadAllErasMode() {
  _currentEra = 'all';
  localStorage.setItem('lv_era', 'all');
  if (typeof _catalogLoadingBegin === 'function') _catalogLoadingBegin();
  _applyEraTabs('all'); // SHEET_TABS gets pw fallback for bystander code

  // Update dropdown
  var _sel = document.getElementById('era-select');
  if (_sel) _sel.value = 'all';
  if (typeof _applyEraVisibility === 'function') _applyEraVisibility();

  // Reset state — we're about to rebuild it cross-era
  state.masterData = [];
  state.setData = [];
  state.companionData = [];
  state.partnerMap = {};
  state.catalogRefData = [];
  state.isRefData = [];
  _rebuildMasterIndex();

  showLoading();
  showToast('Loading all eras…');

  // Step 1: Hydrate from per-era IDB caches in parallel for instant
  // first paint. Each cache may or may not exist depending on whether
  // the user has visited that era before.
  var realEras = (typeof REAL_ERA_IDS !== 'undefined' && Array.isArray(REAL_ERA_IDS))
    ? REAL_ERA_IDS.slice()
    : ['pw', 'mpc', 'prewar', 'atlas', 'mth_o', 'mth_ho', 'mth_s', 'mth_tinplate', 'mth_g'];
  var hydrated = 0;
  try {
    var masterCaches = await Promise.all(realEras.map(function(e) {
      return idbGet('lv_master_cache_' + e).catch(function() { return null; });
    }));
    masterCaches.forEach(function(arr, i) {
      if (Array.isArray(arr) && arr.length) {
        var era = realEras[i];
        // Tag each row with its era of origin
        arr.forEach(function(m) { if (!m._era) m._era = era; });
        state.masterData = state.masterData.concat(arr);
        hydrated++;
      }
    });
    // Hydrate set/catalog/IS/companion from localStorage caches in
    // parallel as well (they're small, fast to JSON.parse).
    realEras.forEach(function(era) {
      try {
        var s = localStorage.getItem('lv_set_cache_' + era);
        if (s) {
          var arr = JSON.parse(s);
          if (Array.isArray(arr)) { arr.forEach(function(x){ if (!x._era) x._era = era; }); state.setData = state.setData.concat(arr); }
        }
        var c = localStorage.getItem('lv_catalog_ref_cache_' + era);
        if (c) {
          var carr = JSON.parse(c);
          if (Array.isArray(carr)) { carr.forEach(function(x){ if (!x._era) x._era = era; }); state.catalogRefData = state.catalogRefData.concat(carr); }
        }
        var ix = localStorage.getItem('lv_is_ref_cache_' + era);
        if (ix) {
          var iarr = JSON.parse(ix);
          if (Array.isArray(iarr)) { iarr.forEach(function(x){ if (!x._era) x._era = era; }); state.isRefData = state.isRefData.concat(iarr); }
        }
        var co = localStorage.getItem('lv_companion_cache_' + era);
        if (co) {
          var carr2 = JSON.parse(co);
          if (Array.isArray(carr2)) { carr2.forEach(function(x){ if (!x._era) x._era = era; }); state.companionData = state.companionData.concat(carr2); }
        }
      } catch (e) { /* skip stale cache */ }
    });
    _rebuildMasterIndex();
    if (state.companionData.length || state.setData.length) buildPartnerMap();
    // Personal data is already cross-era; load it once.
    await loadPersonalData();
    populateFilters();
    // Session 117: cross-era search — if a search term was queued from
    // _searchInOtherEra('all', ...), apply it now so the user lands on
    // results across every era without typing again.
    if (state._pendingSearch) {
      var _ps = state._pendingSearch;
      state._pendingSearch = null;
      state.filters.search = _ps.toLowerCase();
      var _sInput = document.getElementById('browse-search');
      if (_sInput) _sInput.value = _ps;
      if (typeof showPage === 'function') showPage('browse');
    }
    // Session 127: cross-scope search click-through — open the requested item's
    // detail page after the new era's data finishes loading.
    if (state._pendingOpen) {
      var _po = state._pendingOpen;
      state._pendingOpen = null;
      var _idx = (state.masterData || []).findIndex(function(m) {
        if (!m) return false;
        if (typeof normalizeItemNum === 'function') {
          if (normalizeItemNum(m.itemNum) !== normalizeItemNum(_po.itemNum)) return false;
        } else if ((m.itemNum || '') !== _po.itemNum) {
          return false;
        }
        if (_po.variation === '' || _po.variation == null) return true;
        return (m.variation || '') === _po.variation;
      });
      if (_idx >= 0 && typeof showItemDetailPage === 'function') {
        if (typeof showPage === 'function') showPage('browse');
        showItemDetailPage(_idx);
      }
    }
    if (typeof renderBrowse === 'function') renderBrowse();
    if (typeof buildDashboard === 'function') buildDashboard();
  } catch (e) {
    console.warn('[loadAllErasMode] cache hydration error:', e);
  }

  if (hydrated === 0) {
    showToast('Loading every era from your sheet — first time may take ~15s…', 5000);
  } else {
    showToast(hydrated + ' era' + (hydrated === 1 ? '' : 's') + ' loaded from cache. Refreshing in background…', 3500);
  }

  // Step 2: Sequentially refresh each era from Sheets in the background
  // while the user is already interacting. Each era's fresh data
  // replaces the cached version of that era only — other eras stay
  // intact. The _skipBackgroundRefresh flag suppresses the loaders'
  // own stale-while-revalidate background refresh so a late .then()
  // can't clobber the wrong era's data.
  (async function refreshAllErasInBackground() {
    var savedEra = _currentEra;
    var savedTabs = Object.assign({}, SHEET_TABS);
    window._skipBackgroundRefresh = true;

    // Phase 2 #6 (Session 117): parallel master fetch.
    // Was sequential — each loop iteration awaited loadMasterData() which
    // internally awaited _fetchMasterTabs(). Now we Promise.all the four
    // _fetchMasterTabs(era) calls in parallel, dropping cold load from
    // ~15-20s to ~6-10s. If the parallel block fails for any reason,
    // _phase6OK stays false and the sequential loop below falls back to
    // the original behavior.
    // S151 follow-up: surface a small 'X of Y eras loaded' indicator while
    // the parallel fetch is in flight. Each per-era promise increments loaded.
    state.loading = state.loading || {};
    state.loading.allEras = { total: realEras.length, loaded: 0, refreshing: true };
    if (typeof _renderAllLoadingIndicator === 'function') _renderAllLoadingIndicator();
    var _phase6OK = false;
    try {
      var _pmRows = await Promise.all(realEras.map(function(_era) {
        return _fetchMasterTabs(_era).then(function(rows) {
          var deduped = _deduplicateMaster(rows);
          deduped.forEach(function(m) { m._era = _era; });
          idbSet('lv_master_cache_' + _era, deduped);
          try { localStorage.setItem('lv_master_cache_ts_' + _era, Date.now().toString()); } catch(e) {}
          // Step S151: tick the loading indicator.
          if (state.loading && state.loading.allEras) {
            state.loading.allEras.loaded++;
            if (typeof _renderAllLoadingIndicator === 'function') _renderAllLoadingIndicator();
          }
          return deduped;
        });
      }));
      // Replace state.masterData with the freshly-merged set across all eras.
      state.masterData = [];
      _pmRows.forEach(function(rows) { state.masterData = state.masterData.concat(rows); });
      _rebuildMasterIndex();
      _phase6OK = true;
      // S151: parallel master fetch done — clear loading indicator. Sets/
      // companions still load sequentially below but those are smaller/faster
      // and the user already has all the master items.
      if (state.loading && state.loading.allEras) {
        state.loading.allEras.refreshing = false;
        if (typeof _renderAllLoadingIndicator === 'function') _renderAllLoadingIndicator();
      }
      // Show the user fresh master data right away while sets/companions
      // continue loading sequentially below.
      if (typeof renderBrowse === 'function') renderBrowse();
    } catch (e) {
      console.warn('[loadAllErasMode] parallel master fetch failed, falling back to sequential:', e);
      // S151: still mark refresh done so the indicator clears.
      if (state.loading && state.loading.allEras) {
        state.loading.allEras.refreshing = false;
        if (typeof _renderAllLoadingIndicator === 'function') _renderAllLoadingIndicator();
      }
    }

    for (var i = 0; i < realEras.length; i++) {
      var era = realEras[i];
      try {
        // Temporarily make the regular loaders see this era so they
        // pull from the right SHEET_TABS and write to the right cache
        // keys (the loaders read _currentEra for cache keys).
        _currentEra = era;
        _applyEraTabs(era);

        // Capture current state buckets so we can replace just this
        // era's slice after the load.
        var priorMaster = state.masterData;
        var priorSets = state.setData;
        var priorCats = state.catalogRefData;
        var priorIS = state.isRefData;
        var priorComps = state.companionData;

        // Stash empty buckets for the loaders to write into.
        // Phase 2 #6: leave state.masterData alone if parallel master fetch
        // already populated it. Sequential master fallback only runs when
        // _phase6OK is false (parallel block crashed).
        if (!_phase6OK) state.masterData = [];
        state.setData = [];
        state.catalogRefData = [];
        state.isRefData = [];
        state.companionData = [];

        if (!_phase6OK) await loadMasterData();
        if (SHEET_TABS.sets) await loadSetData();
        if (SHEET_TABS.companions) await loadCompanionData();
        await loadCatalogRefData();
        if (SHEET_TABS.instrSheets) await loadISRefData();

        // Tag the fresh data with its era (master already tagged in parallel block)
        if (!_phase6OK) state.masterData.forEach(function(m){ m._era = era; });
        state.setData.forEach(function(s){ s._era = era; });
        state.catalogRefData.forEach(function(c){ c._era = era; });
        state.isRefData.forEach(function(s){ s._era = era; });
        state.companionData.forEach(function(c){ c._era = era; });

        // Merge fresh era data with the OTHER eras' data already in state.
        // Master already merged in parallel block.
        var freshSets = state.setData;
        var freshCats = state.catalogRefData;
        var freshIS = state.isRefData;
        var freshComps = state.companionData;

        if (!_phase6OK) {
          var freshMaster = state.masterData;
          state.masterData = priorMaster.filter(function(m){ return m._era !== era; }).concat(freshMaster);
        }
        state.setData = priorSets.filter(function(s){ return s._era !== era; }).concat(freshSets);
        state.catalogRefData = priorCats.filter(function(c){ return c._era !== era; }).concat(freshCats);
        state.isRefData = priorIS.filter(function(s){ return s._era !== era; }).concat(freshIS);
        state.companionData = priorComps.filter(function(c){ return c._era !== era; }).concat(freshComps);
      } catch (e) {
        console.warn('[loadAllErasMode] refresh ' + era + ' failed:', e);
      }
    }
    // Restore meta-era state
    _currentEra = savedEra;
    Object.keys(SHEET_TABS).forEach(function(k){ delete SHEET_TABS[k]; });
    Object.assign(SHEET_TABS, savedTabs);
    window._skipBackgroundRefresh = false;

    // Final rebuilds + render with full fresh data
    _rebuildMasterIndex();
    if (state.companionData.length || state.setData.length) buildPartnerMap();
    populateFilters();
    if (typeof renderBrowse === 'function') renderBrowse();
    if (typeof buildDashboard === 'function') buildDashboard();
    showToast('All eras up to date — ' + (state.masterData||[]).length + ' items', 2500);
  })().catch(function(e) {
    window._skipBackgroundRefresh = false;
    console.error('[loadAllErasMode] background refresh failed:', e);
    showToast('Some era data could not refresh — using cached version.', 4000, true);
  });
}

// ── Cross-era search: switch era and re-run the current search term ──
function _searchInOtherEra(era, searchTerm) {
  if (!ERAS[era] || era === _currentEra) return;
  state._pendingSearch = searchTerm || '';
  switchEra(era);
}

// ── Session 127 ─ Cross-scope search (across all eras' indexes) ─────────────
// Reads pre-built per-era search indexes from IDB in parallel and filters by
// query. Falls back to the era's full master cache if its index hasn't been
// built yet (first-time-in-all-mode-without-visiting-individual-eras case).
// Skips the current era — those results are already shown in the browse table.
async function _crossScopeSearch(query) {
  if (!query || !String(query).trim()) return [];
  const q = String(query).toLowerCase().trim();
  const eras = (typeof REAL_ERA_IDS !== 'undefined' && Array.isArray(REAL_ERA_IDS))
    ? REAL_ERA_IDS
    : ['pw','mpc','prewar','atlas','mth_o','mth_ho','mth_s','mth_tinplate','mth_g'];
  const curEra = (typeof _currentEra !== 'undefined') ? _currentEra : '';
  const buckets = await Promise.all(eras.map(async function(era) {
    if (era === curEra) return { era: era, rows: [] };
    let idx = await idbGet('lv_search_index_' + era);
    if (idx && Array.isArray(idx) && idx.length) return { era: era, rows: idx };
    const master = await idbGet('lv_master_cache_' + era);
    if (master && Array.isArray(master)) {
      const rows = master.map(function(r) {
        return {
          n: r.itemNum || '', r: r.roadName || '', d: r.description || '',
          t: r.itemType || '', v: r.variation || '', e: era,
        };
      });
      return { era: era, rows: rows };
    }
    return { era: era, rows: [] };
  }));
  const results = [];
  buckets.forEach(function(entry) {
    if (!entry.rows.length) return;
    entry.rows.forEach(function(row) {
      if (
        (row.n && row.n.toLowerCase().indexOf(q) >= 0) ||
        (row.r && row.r.toLowerCase().indexOf(q) >= 0) ||
        (row.d && row.d.toLowerCase().indexOf(q) >= 0) ||
        (row.t && row.t.toLowerCase().indexOf(q) >= 0) ||
        (row.v && row.v.toLowerCase().indexOf(q) >= 0)
      ) {
        results.push(row);
      }
    });
  });
  return results;
}

// Open a cross-scope search result: switch to that era, then show item detail
// once the era's data has loaded. Uses the same _pendingOpen handler that the
// switchEra + loadAllErasMode post-load blocks know to consume.
function _openInOtherEra(itemNum, era, variation) {
  if (typeof ERAS === 'undefined' || !ERAS[era] || era === _currentEra) return;
  state._pendingOpen = { itemNum: itemNum, variation: variation || '', era: era };
  switchEra(era);
}

// ── Master/Catalog/IS/Set/Companion/Personal data loaders moved to app-data.js (Session 111, Round 2 Chunk 13) ──

// ── BUILD APP ───────────────────────────────────────────────────
// ── Uniform Quick Actions in page title row (Session 161+, Brad) ──
// Each list page (Master Catalog, My Collection, Want/Upgrade, For Sale,
// Sold) gets the same 5 buttons on the RIGHT side of its title row,
// matching the dashboard's top-right layout. Existing page-specific
// right-side content (Identify on browse, Share on forsale) stays put;
// the standard buttons get appended next to them. Idempotent.
function _injectQuickActionsBar() {
  var QA_PAGES = ['page-browse', 'page-upgrade', 'page-forsale', 'page-sold'];
  // Clean up any prior bar from earlier implementations.
  document.querySelectorAll('.qa-actions-bar').forEach(function(el) { el.remove(); });
  var svgPlus     = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
  var svgHeart    = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z"/></svg>';
  var svgUpgrade  = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  var svgTag      = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>';
  var svgDollar   = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>';
  var btn = function(handler, label, color, bg, svg) {
    return '<button class="btn qa-tr-btn" onclick="' + handler + '" style="display:flex;align-items:center;gap:0.35rem;font-size:0.78rem;padding:0.45rem 0.65rem;border:1.5px solid ' + color + ';color:' + color + ';background:' + bg + ';font-weight:600">' + svg + label + '</button>';
  };
  // Compact UI: ALL actions (Add to Collection/Want/Upgrade/ForSale, Record a Sale,
  // Share) collapse into one + Add dropdown menu. Share is context-aware: it
  // routes through _qaShareCurrentPage which picks the right source by the
  // currently active page.
  var svgChevron = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>';
  var svgShare = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>';
  var actionsHtml =
    '<span class="qa-add-dropdown-wrap">'
    + '<button class="btn qa-tr-btn qa-add-btn" onclick="_qaToggleAddMenu(event)" style="display:flex;align-items:center;gap:0.35rem;font-size:0.78rem;padding:0.45rem 0.65rem;border:1.5px solid var(--accent);color:var(--accent);background:rgba(232,64,28,0.12);font-weight:600">'
    +   svgPlus + 'Add' + svgChevron
    + '</button>'
    + '<div class="qa-add-dropdown-menu" style="display:none">'
    +   '<button onclick="_qaCloseAdd();startWizardFor(\'collection\')"><span style="color:var(--accent);display:inline-flex">' + svgPlus + '</span>Add to My Collection</button>'
    +   '<button onclick="_qaCloseAdd();startWizardFor(\'want\')"><span style="color:#2980b9;display:inline-flex">' + svgHeart + '</span>Add to Want List</button>'
    +   '<button onclick="_qaCloseAdd();pickItemForUpgrade()"><span style="color:#8b5cf6;display:inline-flex">' + svgUpgrade + '</span>Add Upgrade</button>'
    +   '<button onclick="_qaCloseAdd();startWizardFor(\'forsale\')"><span style="color:#e67e22;display:inline-flex">' + svgTag + '</span>Add to For Sale List</button>'
    +   '<div style="height:1px;background:var(--border);margin:0.25rem 0.4rem"></div>'
    +   '<button onclick="_qaCloseAdd();startWizardFor(\'sold\')"><span style="color:#2ecc71;display:inline-flex">' + svgDollar + '</span>Record a Sale</button>'
    +   '<button onclick="_qaCloseAdd();_qaShareCurrentPage()"><span style="color:#2ecc71;display:inline-flex">' + svgShare + '</span>Share This Page</button>'
    +   '<button onclick="_qaCloseAdd();openResearch()"><span style="color:#16a085;display:inline-flex">\ud83d\udcf8</span>Research an Item</button>'
    + '</div>'
    + '</span>';

  QA_PAGES.forEach(function(pid) {
    var p = document.getElementById(pid);
    if (!p) return;
    var title = p.querySelector(':scope > .page-title');
    if (!title) return;
    // Drop any prior qa-tr-actions container in this title so re-runs replace.
    var prior = title.querySelector('.qa-tr-actions');
    if (prior) prior.remove();
    // Ensure title is a flex row with space-between so right-side actions sit at the right.
    if (!title.style.display)        title.style.display        = 'flex';
    if (!title.style.alignItems)     title.style.alignItems     = 'center';
    if (!title.style.justifyContent) title.style.justifyContent = 'space-between';
    if (!title.style.gap)            title.style.gap            = '0.75rem';
    if (!title.style.flexWrap)       title.style.flexWrap       = 'wrap';
    var container = document.createElement('div');
    container.className = 'qa-tr-actions';
    container.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin-left:auto';
    container.innerHTML = actionsHtml;
    title.appendChild(container);

    // Brad (Session 161+): relocate the page-specific Share button below the
    // title row so it sits under Record-A-Sale.
    // - On page-upgrade, the existing filter-chip row sits right below the
    //   title — put Share into THAT row, right-aligned, so it shares the line.
    // - On other pages, create a small strip below the title.
    var shareBtn = title.querySelector('[id^="share-btn-"]');
    if (shareBtn) {
      // Drop any prior relocation strip.
      var oldStrip = p.querySelector(':scope > .qa-share-strip');
      if (oldStrip) {
        // If the share button was placed inside this strip earlier, move it back to a fresh container below.
        oldStrip.remove();
      }
      if (pid === 'page-upgrade') {
        // Brad: dropdown replaced the chip — put Share at the right end of the row that contains the new dropdown + search + filters.
        var filterDrop = p.querySelector('#wishlist-filter-dropdown');
        var filterRow = filterDrop ? filterDrop.parentElement : null;
        if (filterRow) {
          shareBtn.style.marginLeft = 'auto';
          filterRow.appendChild(shareBtn);
        } else {
          // Fallback — strip below title.
          var s = document.createElement('div');
          s.className = 'qa-share-strip';
          s.style.cssText = 'display:flex;justify-content:flex-end;margin-bottom:0.5rem';
          s.appendChild(shareBtn);
          if (title.nextSibling) p.insertBefore(s, title.nextSibling);
          else p.appendChild(s);
        }
      } else if (pid === 'page-browse') {
        // v0.9.816 (Brad): maximize rows — on My Collection the Share button
        // sits inline next to + Add; its own strip cost a full header row.
        shareBtn.style.marginLeft = '';
        container.appendChild(shareBtn);
      } else {
        var strip = document.createElement('div');
        strip.className = 'qa-share-strip';
        strip.style.cssText = 'display:flex;justify-content:flex-end;margin-bottom:0.5rem';
        strip.appendChild(shareBtn);
        if (title.nextSibling) p.insertBefore(strip, title.nextSibling);
        else p.appendChild(strip);
      }
    }
  });
}
if (typeof window !== 'undefined') window._injectQuickActionsBar = _injectQuickActionsBar;

function _qaToggleAddMenu(e) {
  if (e && e.stopPropagation) e.stopPropagation();
  var btn = e && e.currentTarget ? e.currentTarget : null;
  var menu = btn ? btn.parentElement.querySelector('.qa-add-dropdown-menu') : null;
  if (!menu) return;
  var showing = menu.style.display !== 'none';
  document.querySelectorAll('.qa-add-dropdown-menu').forEach(function(m) { m.style.display = 'none'; });
  menu.style.display = showing ? 'none' : 'flex';
  if (!showing) setTimeout(function() { document.addEventListener('click', _qaCloseAddOnOutside); }, 0);
}
function _qaCloseAddOnOutside(e) {
  if (e.target.closest && e.target.closest('.qa-add-dropdown-wrap')) return;
  _qaCloseAdd();
}
function _qaCloseAdd() {
  document.querySelectorAll('.qa-add-dropdown-menu').forEach(function(m) { m.style.display = 'none'; });
  document.removeEventListener('click', _qaCloseAddOnOutside);
}
// Share router: pick the right source for the currently active page.
function _qaShareCurrentPage() {
  var pid = '';
  try {
    var active = document.querySelector('.page.active');
    pid = active ? active.id : '';
  } catch(e) {}
  if (typeof startShareMode !== 'function') return;
  if (pid === 'page-upgrade')      startShareMode('upgrade');
  else if (pid === 'page-forsale') startShareMode('forsale');
  else if (pid === 'page-want')    startShareMode('want');
  else if (pid === 'page-browse')  startShareMode('collection');
  else {
    if (typeof showToast === 'function') showToast('Share is available on Collection, Want/Upgrade, and For Sale pages', 3000);
  }
}
if (typeof window !== 'undefined') window._qaShareCurrentPage = _qaShareCurrentPage;

function _applyCompactMode() {
  try {
    var on = (typeof _prefGet === 'function') ? (_prefGet('lv_compact_mode', 'false') === 'true') : false;
    document.body.classList.toggle('compact-mode', on);
  } catch(e) {}
}
if (typeof window !== 'undefined') {
  window._qaToggleAddMenu = _qaToggleAddMenu;
  window._qaCloseAdd = _qaCloseAdd;
  window._applyCompactMode = _applyCompactMode;
}


function buildApp() {
  showApp();
  populateFilters();
  buildDashboard();
  _applyDisclaimerPref();
  // Apply era-dropdown visibility based on user prefs
  if (typeof _applyEraVisibility === 'function') _applyEraVisibility();
  // Wishlist badge: combined Want + Upgrade count (Session 161+).
  // Previously only counted state.upgradeData, so on hard refresh the badge
  // showed '—' for users with only Want entries until they clicked the nav.
  const _uEl = document.getElementById('nav-wishlist-count');
  if (_uEl) {
    const _total = (typeof wishlistFoldedCount === 'function') ? wishlistFoldedCount() : 0;   // v0.9.722
    _uEl.textContent = _total > 0 ? _total.toLocaleString() : '—';
  }
  // Wire up the Google Sheet link in the sidebar
  const sheetLink = document.getElementById('nav-sheet-link');
  if (sheetLink && state.personalSheetId) {
    sheetLink.href = 'https://docs.google.com/spreadsheets/d/' + state.personalSheetId;
  }
  buildQuickEntryList();
  _injectQuickActionsBar();
  _applyCompactMode();
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
  // v0.9.709 (Brad's mobile-vs-desktop mismatch): a resumed PWA never re-runs
  // boot, so a phone can show DAYS-old numbers while the sheet moved on.
  // When the app returns to the foreground with a snapshot older than 5 min,
  // re-fetch and redraw.
  if (!window._fgRefreshListener) {
    window._fgRefreshListener = true;
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') return;
      try {
        if (!state.personalSheetId || typeof _loadPersonalFromSheets !== 'function') return;
        var _ts = parseInt(localStorage.getItem('lv_personal_cache_ts') || '0');
        if (Date.now() - _ts < 5 * 60 * 1000) return;
        if (window._fgRefreshing) return;
        window._fgRefreshing = true;
        _loadPersonalFromSheets(state.personalSheetId).then(function () {
          if (typeof _cachePersonalData === 'function') _cachePersonalData();
          if (typeof buildDashboard === 'function') buildDashboard();
          if (typeof renderBrowse === 'function') renderBrowse();
        }).catch(function () {}).then(function () { window._fgRefreshing = false; });
      } catch (e) {}
    });
  }
  // Session 162: kick off background preloading of OTHER eras' master data
  // so subsequent era-switches are instant. Runs 3s after init to let the
  // user's chosen era render and breathe first.
  setTimeout(function() {
    try { _preloadOtherErasInBackground(); } catch(e) { console.warn('[preload] start failed', e); }
  }, 3000);
}

// ──────────────────────────────────────────────────────────────────────
// Session 162: Background era preloader.
// Fetches every OTHER era's master tabs in the background and writes the
// result to per-era IDB cache (lv_master_cache_<era>). Once cached, era
// switches are instant (loadMasterData checks IDB first).
//
// Runs 2 in parallel — kind to Google Sheets, finishes in ~30-60s on a
// typical connection. Stops immediately if the user switches eras (no
// point burning bandwidth on data they're now using directly).
//
// A small status pill in the bottom-right shows progress. Click ✕ to
// dismiss early.
// ──────────────────────────────────────────────────────────────────────
var _preloadActive = false;
var _preloadStartEra = null;

async function _preloadOtherErasInBackground() {
  if (_preloadActive) return;
  if (typeof _currentEra === 'undefined' || _currentEra === 'all') return;
  if (typeof REAL_ERA_IDS === 'undefined' || !Array.isArray(REAL_ERA_IDS)) return;

  _preloadActive = true;
  _preloadStartEra = _currentEra;

  // Eras eligible for preload: not current, not 'all', cache stale or missing.
  var TTL = 24 * 60 * 60 * 1000;
  var now = Date.now();
  var eligible = [];
  for (var i = 0; i < REAL_ERA_IDS.length; i++) {
    var era = REAL_ERA_IDS[i];
    if (era === _currentEra) continue;
    if (!ERAS || !ERAS[era]) continue;
    var ts = parseInt(localStorage.getItem('lv_master_cache_ts_' + era) || '0', 10);
    if (now - ts > TTL) eligible.push(era);
  }

  if (!eligible.length) { _preloadActive = false; return; }

  var pill = _showPreloadPill(eligible.length);
  var done = 0;
  var idx = 0;

  function fetchOne() {
    if (idx >= eligible.length) return Promise.resolve();
    if (_currentEra !== _preloadStartEra) return Promise.resolve(); // user switched eras
    var era = eligible[idx++];
    _updatePreloadPill(pill, done, eligible.length, era);
    return _fetchMasterTabs(era)
      .then(function(rows) {
        if (!rows || !rows.length) return;
        var deduped = (typeof _deduplicateMaster === 'function') ? _deduplicateMaster(rows) : rows;
        idbSet('lv_master_cache_' + era, deduped);
        localStorage.setItem('lv_master_cache_ts_' + era, Date.now().toString());
        if (typeof ERAS !== 'undefined' && ERAS[era]) {
          ERAS[era]._total = deduped.length;
          try { localStorage.setItem('lv_era_total_' + era, deduped.length); } catch(e) {}
        }
      })
      .catch(function(e) { console.warn('[preload] era ' + era + ' failed:', e); })
      .then(function() {
        done++;
        _updatePreloadPill(pill, done, eligible.length, '');
        return fetchOne();
      });
  }

  // Two workers running in parallel
  Promise.all([fetchOne(), fetchOne()]).then(function() {
    _hidePreloadPill(pill);
    _preloadActive = false;
  });
}

function _showPreloadPill(total) {
  var existing = document.getElementById('preload-status-pill');
  if (existing) existing.remove();
  var pill = document.createElement('div');
  pill.id = 'preload-status-pill';
  pill.style.cssText = 'position:fixed;bottom:18px;right:18px;z-index:1000;'
    + 'background:var(--surface);color:var(--text-dim);'
    + 'border:1px solid var(--border);border-radius:18px;'
    + 'padding:0.45rem 0.85rem;font-size:0.78rem;font-family:var(--font-body);'
    + 'display:flex;align-items:center;gap:0.55rem;'
    + 'box-shadow:0 4px 14px rgba(0,0,0,0.25);opacity:0.94';
  var dot = document.createElement('span');
  dot.style.cssText = 'display:inline-block;width:8px;height:8px;border-radius:50%;'
    + 'background:var(--accent2,#c9922a);animation:none';
  pill.appendChild(dot);
  var msg = document.createElement('span');
  msg.id = 'preload-status-msg';
  msg.textContent = 'Preloading 0 of ' + total + ' eras…';
  pill.appendChild(msg);
  var x = document.createElement('button');
  x.textContent = '✕';
  x.title = 'Hide this notice';
  x.style.cssText = 'background:none;border:none;color:var(--text-dim);'
    + 'cursor:pointer;font-size:0.85rem;padding:0 0 0 0.35rem;opacity:0.7';
  x.onclick = function() { pill.remove(); };
  pill.appendChild(x);
  document.body.appendChild(pill);
  return pill;
}

function _updatePreloadPill(pill, done, total, eraJustStarted) {
  if (!pill || !pill.isConnected) return;
  var msg = document.getElementById('preload-status-msg');
  if (!msg) return;
  var label = (eraJustStarted && ERAS && ERAS[eraJustStarted]) ? ERAS[eraJustStarted].label : '';
  msg.textContent = label
    ? 'Preloading ' + (done + 1) + ' of ' + total + ' — ' + label + '…'
    : 'Preloaded ' + done + ' of ' + total;
}

function _hidePreloadPill(pill) {
  if (!pill || !pill.isConnected) return;
  var msg = document.getElementById('preload-status-msg');
  if (msg) msg.textContent = 'All eras cached ✓';
  setTimeout(function() {
    if (pill && pill.isConnected) {
      pill.style.transition = 'opacity 0.6s ease-out';
      pill.style.opacity = '0';
      setTimeout(function() { if (pill && pill.isConnected) pill.remove(); }, 700);
    }
  }, 2500);
}

function showLoading() {
  const tb = document.getElementById('browse-tbody');
  if (tb) tb.innerHTML = '<tr><td colspan="9"><div class="loading" style="padding:3rem;flex-direction:column;gap:0.75rem"><div class="spinner" style="width:36px;height:36px;border-width:3px"></div><div style="font-size:0.9rem;color:var(--text-dim)">Loading The Rail Roster…</div><div style="font-size:0.75rem;color:var(--text-dim);opacity:0.7">Fetching master inventory</div></div></td></tr>';
  // Session 161 watchdog: if the splash is still visible 4s later AND master
  // data has actually loaded, force a re-render. If that throws, show a
  // recovery message with a Refresh button instead of leaving the user stuck.
  setTimeout(function() {
    var tb2 = document.getElementById('browse-tbody');
    if (!tb2) return;
    if (tb2.innerHTML.indexOf('Loading The Rail Roster') === -1) return;
    if (!state.masterData || state.masterData.length === 0) return;
    try {
      if (typeof renderBrowse === 'function') renderBrowse();
    } catch(e) {
      console.error('[watchdog] renderBrowse failed:', e);
    }
    // Re-check after the retry — if STILL stuck, replace splash with error UI.
    var tb3 = document.getElementById('browse-tbody');
    if (tb3 && tb3.innerHTML.indexOf('Loading The Rail Roster') !== -1) {
      tb3.innerHTML = '<tr><td colspan="10" style="padding:2rem;text-align:center;color:var(--text-dim);font-size:0.88rem">'
        + 'The catalog finished loading but the page didn\'t refresh. '
        + '<button onclick="location.reload()" style="margin-left:0.5rem;padding:0.35rem 0.9rem;border-radius:7px;border:1.5px solid var(--accent);background:rgba(232,64,28,0.1);color:var(--accent);cursor:pointer;font-weight:600">Reload</button>'
        + '</td></tr>';
    }
  }, 4000);
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
    state.upgradeData = {};
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
    applySheetFormatting(state.personalSheetId).catch((e) => console.warn('[applySheetFormatting failed]', e && e.message));
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
    }) || findMaster(pd.itemNum, '', pd);
    var itemName = master ? (master.roadName || master.description || master.itemType || '') : '';
    var itemType = master ? (master.itemType || '') : '';
    var itemYear = master ? (master.yearProd || '') : '';
    var variation = pd.variation || '';
    var meta = [itemType, itemYear].filter(Boolean).join(' · ');

    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:0.85rem;padding:0.9rem 1rem;background:var(--surface);border:1.5px solid rgba(46,204,113,0.3);border-radius:12px;cursor:pointer;transition:all 0.15s';
    row.onmouseenter = function() { this.style.borderColor='#2ecc71'; this.style.background='rgba(46,204,113,0.06)'; };
    row.onmouseleave = function() { this.style.borderColor='rgba(46,204,113,0.3)'; this.style.background='var(--surface)'; };
    row.onclick = (function(num, vari, pdInvId) { return function() {
      var globalIdx = state.masterData ? state.masterData.findIndex(function(m) {
        return m.itemNum === num && (!vari || m.variation === vari);
      }) : -1;
      completeQuickEntry(num, vari, globalIdx, pdInvId);
    }; })(pd.itemNum, variation, pd.inventoryId || '');

    var icon = document.createElement('div');
    icon.style.cssText = 'background:rgba(46,204,113,0.12);border-radius:8px;padding:0.5rem;flex-shrink:0';
    icon.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2ecc71" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';

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
    addInfoBtn.style.cssText = 'font-size:0.78rem;color:#fff;font-weight:600;background:#2ecc71;border:none;padding:0.3rem 0.7rem;border-radius:6px;cursor:pointer;white-space:nowrap';
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
  footer.style.cssText = 'margin-top:1rem;padding:0.75rem 1rem;background:rgba(46,204,113,0.06);border-radius:10px;border:1px solid rgba(46,204,113,0.2);font-size:0.82rem;color:var(--text-dim);text-align:center';
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

// ── Currency / Date formatting helpers (Session 120) ─────────────
// Single source of truth for how prices and dates render across the app.
// Reads lv_currency / lv_date_fmt prefs (set in Preferences). Every place
// that displays a price or a date should route through these — never
// hardcode '$' or call toLocaleDateString() directly on user-facing data.

function _currencySymbol() { return _prefGet('lv_currency', '$'); }

// Format a number as a price with the user's currency symbol. Returns
// empty string for null / undefined / '' / NaN so callers can do
// `price ? _formatPrice(price) : '—'` without extra null checks.
function _formatPrice(val) {
  if (val === null || val === undefined || val === '') return '';
  var n = parseFloat(val);
  if (isNaN(n)) return '';
  return _currencySymbol() + n.toLocaleString();
}

// Format a date string (or Date) per the user's date format pref.
// Accepts ISO strings ('2026-04-19'), Date objects, or empty.
// Returns '' for blank input; original string for unparseable.
// Audit M5: defensive currency parser. Phase 3i made API return raw numbers,
// but if a user hand-edits a sheet cell to a $-prefixed string, parseFloat()
// returns NaN. Use this anywhere money-like values are read from user input
// or untrusted sources.
function _money(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  var n = parseFloat(String(v).replace(/[$,\s]/g, ''));
  return isFinite(n) ? n : 0;
}
if (typeof window !== 'undefined') window._money = _money;

function _formatDate(input) {
  if (input === null || input === undefined || input === '') return '';
  var fmt = _prefGet('lv_date_fmt', 'YYYY-MM-DD');
  var yyyy, mm, dd;
  // Audit H8: Sheets API UNFORMATTED_VALUE returns dates as Excel serial
  // numbers (days since 1899-12-30). Detect serial-shaped values and convert
  // to a real Date. Serial 25569 = 1970-01-01; values above ~25500 and below
  // ~80000 (year ~2089) are date-shaped.
  var _serialNum = (typeof input === 'number') ? input
                  : (typeof input === 'string' && /^\d{4,5}(\.\d+)?$/.test(input) ? parseFloat(input) : NaN);
  if (isFinite(_serialNum) && _serialNum > 25000 && _serialNum < 80000) {
    var _ms = Math.round((_serialNum - 25569) * 86400000);
    var _sd = new Date(_ms);
    if (!isNaN(_sd.getTime())) {
      yyyy = _sd.getUTCFullYear();
      mm = String(_sd.getUTCMonth() + 1).padStart(2, '0');
      dd = String(_sd.getUTCDate()).padStart(2, '0');
    }
  }
  // Timezone-safe path: parse YYYY-MM-DD strings directly without Date()
  // to avoid UTC-midnight → local-day-before drift in western timezones.
  if (!yyyy && typeof input === 'string') {
    var iso = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) { yyyy = iso[1]; mm = iso[2]; dd = iso[3]; }
    else {
      var us = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (us) { yyyy = us[3]; mm = us[1].padStart(2,'0'); dd = us[2].padStart(2,'0'); }
    }
  }
  if (!yyyy) {
    var d = (input instanceof Date) ? input : new Date(input);
    if (isNaN(d.getTime())) return String(input);
    yyyy = d.getFullYear();
    mm = String(d.getMonth() + 1).padStart(2, '0');
    dd = String(d.getDate()).padStart(2, '0');
  }
  if (fmt === 'MM/DD/YYYY') return mm + '/' + dd + '/' + yyyy;
  if (fmt === 'DD/MM/YYYY') return dd + '/' + mm + '/' + yyyy;
  return yyyy + '-' + mm + '-' + dd;
}

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
  // v0.9.905 (Brad, item [7]): single source of truth for "where the user is",
  // recorded on every navigation. The Add wizard is a modal (it doesn't call
  // showPage), so this still holds the page the user was viewing when they
  // opened it — and that's where Cancel returns them, instead of a per-flow
  // guess that could stray to the Dashboard.
  try { window._rrLastPage = name; } catch (e) {}
  if (name !== 'itemdetail') { try { delete window._detailReturn; } catch (e) {} }
  if (clickedEl) clickedEl.classList.add('active');
  if (name === 'browse') renderBrowse();
  if (name === 'collection' && typeof buildCollectionPage === 'function') buildCollectionPage();
  if (name === 'reports' && typeof renderReportLibrary === 'function') renderReportLibrary();
  if (name === 'sold') buildSoldPage();
  if (name === 'forsale') buildForSalePage();
  if (name === 'parts' && typeof buildPartsPage === 'function') buildPartsPage();
  if (name === 'want') buildWantPage();
  if (name === 'sets') buildSetsPage();
  if (name === 'browse' || name === 'sets') _applyDisclaimerPref();
  if (name === 'upgrade') buildUpgradePage();
  if (name === 'prefs') buildPrefsPage();
  if (name === 'vault') vaultRenderPage();
  if (name === 'tools' && typeof buildToolsPage === 'function') buildToolsPage();
  if (name === 'contacts' && typeof buildContactsPage === 'function') buildContactsPage();   // contacts hook
  // v0.9.873 (Brad): a page opened from a dashboard card gets a Back to
  // Dashboard bar at the top. Any other navigation removes it.
  try {
    var _fd = window._fromDash === true; delete window._fromDash;
    var _oldBar = document.getElementById('page-back-dash');
    if (_oldBar) _oldBar.remove();
    if (_fd && name !== 'dashboard') {
      var _pgEl = document.getElementById('page-' + name);
      if (_pgEl) {
        var _bar = document.createElement('div');
        _bar.id = 'page-back-dash';
        _bar.innerHTML = '<button onclick="showPage(\'dashboard\');if(typeof buildDashboard===\'function\')buildDashboard()" style="background:none;border:none;color:#2980b9;font-family:var(--font-body);font-size:0.95rem;font-weight:700;cursor:pointer;padding:0;display:flex;align-items:center;gap:0.4rem;margin-bottom:0.6rem"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>Back to Dashboard</button>';
        _pgEl.insertBefore(_bar, _pgEl.firstChild);
      }
    }
  } catch(e) {}
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
  if (typeof google !== 'undefined') { initGoogle(); return; }
  // v0.9.826 (TODO-003): Google's sign-in script didn't load — slow network
  // or fully offline. Give it a moment (async script may still arrive), then
  // fall back to view-only offline mode for returning users.
  setTimeout(function () {
    if (typeof google !== 'undefined') { initGoogle(); return; }
    setTimeout(function () {
      if (typeof google !== 'undefined') { initGoogle(); return; }
      if (typeof _enterOfflineMode === 'function') _enterOfflineMode();
    }, 2500);
  }, 1500);
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
