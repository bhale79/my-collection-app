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
// ── v0.9.1045 (Brad's 213) ─────────────────────────────────────────────────
// "You already own one" used to be decided on the item number alone. Lionel
// used 213 twice — a prewar cattle car and a postwar item — so photographing
// the postwar one was met with "you already have a Lionel prewar 213 cattle
// car". Same family as the Lionel/Atlas 8359 collision: a number is not an
// identity. Every owned row already stores its own era and manufacturer; this
// is the one place that compares them.
//
// Returns { pd, agrees, label } or null.
//   agrees === false means: you own something with this number, but it is a
//   DIFFERENT item — which is worth telling the user, not hiding.
function _rrEraKeyOf(v) {
  var s = String(v == null ? '' : v).trim();
  if (!s) return '';
  var low = s.toLowerCase();
  try {
    if (typeof ERAS === 'undefined') return low;
    if (ERAS[low]) return low;                       // already an era key
    for (var k in ERAS) {                            // or a label: "Lionel Postwar" / "Postwar"
      var lab = String((ERAS[k] && ERAS[k].label) || '').toLowerCase();
      if (!lab) continue;
      if (lab === low || lab.replace(/^lionel\s+/, '') === low) return k;
    }
  } catch (e) {}
  return low;                                        // 'manual' or something we don't know
}

function rrFindOwnedCopy(num, master) {
  try {
    var n = String(num == null ? '' : num).trim();
    if (!n) return null;
    var pds = Object.values((window.state || {}).personalData || {});
    var base = (typeof baseItemNum === 'function') ? baseItemNum(n) : n;
    var cands = pds.filter(function (p) {
      if (!p || !p.owned || !p.itemNum) return false;
      if (String(p.itemNum) === n) return true;
      return (typeof baseItemNum === 'function') && baseItemNum(String(p.itemNum)) === base;
    });
    if (!cands.length) return null;

    var mEra = '', mMfr = '';
    if (master) {
      mEra = _rrEraKeyOf(master._era || master.era || '');
      mMfr = String(master.manufacturer || '').toLowerCase();
      if (!mMfr && master._era && typeof _manufacturerOfEra === 'function') {
        try { mMfr = String(_manufacturerOfEra(master._era) || '').toLowerCase(); } catch (e) {}
      }
    }

    function judge(p) {
      var pEra = _rrEraKeyOf(p.era);
      var pMfr = String(p.manufacturer || '').toLowerCase();
      // Only a KNOWN difference counts against it. A blank field means we
      // cannot tell, and we do not accuse on a guess.
      var eraClash = !!(mEra && pEra && pEra !== 'manual' && pEra !== mEra);
      var mfrClash = !!(mMfr && pMfr && pMfr !== mMfr);
      var score = 0;
      if (mEra && pEra === mEra) score += 4;
      if (mMfr && pMfr === mMfr) score += 2;
      return { clash: eraClash || mfrClash, score: score };
    }

    var best = null, bestJ = null;
    cands.forEach(function (p) {
      var j = judge(p);
      if (!best) { best = p; bestJ = j; return; }
      // a copy that does not clash always beats one that does
      if (bestJ.clash && !j.clash) { best = p; bestJ = j; return; }
      if (bestJ.clash === j.clash && j.score > bestJ.score) { best = p; bestJ = j; }
    });
    if (!best) return null;

    var eraLabel = '';
    try {
      var k = _rrEraKeyOf(best.era);
      eraLabel = (typeof ERAS !== 'undefined' && ERAS[k] && ERAS[k].label) ? ERAS[k].label : String(best.era || '');
    } catch (e) { eraLabel = String(best.era || ''); }
    var label = [eraLabel, best.itemNum, best.itemType].filter(Boolean).join(' ');

    return { pd: best, agrees: !bestJ.clash, label: label };
  } catch (e) {
    console.warn('[rrFindOwnedCopy]', e);
    return null;
  }
}
if (typeof window !== 'undefined') { window.rrFindOwnedCopy = rrFindOwnedCopy; window._rrEraKeyOf = _rrEraKeyOf; }

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
