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

function _rebuildPdIndex() {
  const idx = {};
  Object.keys(state.personalData).forEach(k => {
    const pd = state.personalData[k];
    const lookupKey = pd.itemNum + '|' + (pd.variation || '');
    // If multiple copies, first one wins (findPD returns first match)
    if (!idx[lookupKey]) idx[lookupKey] = k;
  });
  _pdIndex = idx;
  _pdIndexVer = Object.keys(state.personalData).length;
}

function _getPdIndex() {
  // Auto-rebuild if personalData size changed (items added/removed)
  if (Object.keys(state.personalData).length !== _pdIndexVer) _rebuildPdIndex();
  return _pdIndex;
}

function findPD(itemNum, variation) {
  const norm = (variation || '');
  const idx = _getPdIndex();
  const key = idx[itemNum + '|' + norm];
  if (key && state.personalData[key]) return state.personalData[key];
  // Fallback: try with -P and -D suffixes (AA/AB units stored as 210-P, 210-D)
  const keyP = idx[(itemNum + '-P') + '|' + norm];
  if (keyP && state.personalData[keyP]) return state.personalData[keyP];
  const keyD = idx[(itemNum + '-D') + '|' + norm];
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
  const norm = (variation || '');
  const idx = _getPdIndex();
  const key = idx[itemNum + '|' + norm];
  if (key && state.personalData[key]) return key;
  // Fallback: try with -P and -D suffixes
  const keyP = idx[(itemNum + '-P') + '|' + norm];
  if (keyP && state.personalData[keyP]) return keyP;
  const keyD = idx[(itemNum + '-D') + '|' + norm];
  if (keyD && state.personalData[keyD]) return keyD;
  return null;
}

// Find personalData key by row number — used to disambiguate multiple copies
function findPDKeyByRow(itemNum, variation, row) {
  if (!row) return findPDKey(itemNum, variation);
  const norm = (variation || '');
  const k = Object.keys(state.personalData).find(k => {
    const pd = state.personalData[k];
    return pd.itemNum === itemNum && (pd.variation || '') === norm && pd.row == row;
  });
  return k || findPDKey(itemNum, variation);
}
