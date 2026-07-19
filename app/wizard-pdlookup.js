// ═══════════════════════════════════════════════════════════════
// wizard-pdlookup.js — Personal Data Lookup Index
//
// Extracted from wizard.js in Session 110 (App Split Round 1, Chunk 2).
// Loaded BEFORE wizard.js (and others) in index.html so that all
// callers across app.js, browse.js, dashboard.js, tools.js, wizard.js
// can use these helpers.
//
// Maps "itemNum|variation" → state key for O(1) personalData lookups.
// Auto-rebuilt when personalData size changes.
//
// Globals used (defined elsewhere):
//   - state.personalData (app.js)
//   - normalizeItemNum (app.js)
// ═══════════════════════════════════════════════════════════════

let _pdIndex = {};
let _pdIndexVer = 0;
let _pdIndexRef = null;

// v0.9.922 (chunk 3): normalized exact match. Trim + uppercase BOTH sides so
// formatting drift ("2343c", "2343C ") can't silently miss a real match.
// Still a strict item+variation match — never fuzzy.
function _pdLookupKey(itemNum, variation) {
  return String(itemNum == null ? '' : itemNum).trim().toUpperCase() + '|' +
         String(variation == null ? '' : variation).trim().toUpperCase();
}

function _rebuildPdIndex() {
  const idx = {};
  Object.keys(state.personalData).forEach(k => {
    const pd = state.personalData[k];
    const lookupKey = _pdLookupKey(pd.itemNum, pd.variation);
    // If multiple copies, first one wins (findPD returns first match)
    if (!idx[lookupKey]) idx[lookupKey] = k;
  });
  _pdIndex = idx;
  _pdIndexVer = Object.keys(state.personalData).length;
  _pdIndexRef = state.personalData;
}

function _getPdIndex() {
  // v0.9.922 (chunk 3): rebuild if personalData size changed (items added or
  // removed) OR the whole object was swapped by a background reload — a reload
  // with the same count previously kept serving answers from the OLD data.
  if (state.personalData !== _pdIndexRef ||
      Object.keys(state.personalData).length !== _pdIndexVer) _rebuildPdIndex();
  return _pdIndex;
}

// v0.9.923: SINGLE SOURCE OF TRUTH for "does this collection row match this
// typed/derived item number?" — used by the sold/for-sale picker steps so the
// picker appears exactly when a save-time findPD lookup would succeed.
// Mirrors findPD's matching: normalized exact, plus -P/-D catalog bridging.
function pdItemNumMatches(pd, query) {
  const q = String(query == null ? '' : query).trim().toUpperCase();
  if (!q) return false;
  const n = String((pd && pd.itemNum) || '').trim().toUpperCase();
  return n === q || n === q + '-P' || n === q + '-D';
}

function findPD(itemNum, variation) {
  const idx = _getPdIndex();
  const key = idx[_pdLookupKey(itemNum, variation)];
  if (key && state.personalData[key]) return state.personalData[key];
  // Fallback: try with -P and -D suffixes (AA/AB units stored as 210-P, 210-D)
  const keyP = idx[_pdLookupKey(String(itemNum == null ? '' : itemNum).trim() + '-P', variation)];
  if (keyP && state.personalData[keyP]) return state.personalData[keyP];
  const keyD = idx[_pdLookupKey(String(itemNum == null ? '' : itemNum).trim() + '-D', variation)];
  if (keyD && state.personalData[keyD]) return state.personalData[keyD];
  return null;
}

// Find a collection item by item number (for IS grouping logic)
function _findCollectionItemByNum(itemNum) {
  if (!itemNum) return null;
  const norm = normalizeItemNum(itemNum.trim());
  return Object.values(state.personalData).find(p =>
    normalizeItemNum(p.itemNum || '') === norm
  ) || null;
}

function findPDKey(itemNum, variation) {
  const idx = _getPdIndex();
  const key = idx[_pdLookupKey(itemNum, variation)];
  if (key && state.personalData[key]) return key;
  // Fallback: try with -P and -D suffixes
  const keyP = idx[_pdLookupKey(String(itemNum == null ? '' : itemNum).trim() + '-P', variation)];
  if (keyP && state.personalData[keyP]) return keyP;
  const keyD = idx[_pdLookupKey(String(itemNum == null ? '' : itemNum).trim() + '-D', variation)];
  if (keyD && state.personalData[keyD]) return keyD;
  return null;
}

// Find personalData key by row number — used to disambiguate multiple copies
function findPDKeyByRow(itemNum, variation, row) {
  if (!row) return findPDKey(itemNum, variation);
  // v0.9.922 (chunk 3): same normalized comparison as the index.
  const want = _pdLookupKey(itemNum, variation);
  const k = Object.keys(state.personalData).find(k => {
    const pd = state.personalData[k];
    return _pdLookupKey(pd.itemNum, pd.variation) === want && pd.row == row;
  });
  return k || findPDKey(itemNum, variation);
}
