// ═══════════════════════════════════════════════════════════════
// wizard-suggestions.js — Wizard autocomplete suggestion engines
//
// Extracted from wizard.js in Session 110 (App Split Round 1, Chunk 1).
// Loaded BEFORE wizard.js in index.html so wizard.js can call these
// functions during step rendering and event handling.
//
// Purpose: dropdown suggestions for item #, set #, unit #, location,
// and mock-up reference fields. Also includes the lookup helper
// (lookupItem) used to render the green/yellow "match" banner.
//
// Globals used (defined elsewhere):
//   - state (app.js): masterData, setData, personalData
//   - wizard (wizard.js): data, tab, step, steps, matchedItem
//   - normalizeItemNum (app.js)
//   - wizardNext, _updateGroupingButtons (wizard.js)
//   - window._qe1OnInput (set by quick-entry rendering code)
// ═══════════════════════════════════════════════════════════════

let itemLookupTimer;
// Session 171: debounce the suggestion scan so typing stays smooth even on
// a large all-eras dataset (was running the full scan on every keystroke).
var _itemSuggestTimer;
function debouncedItemSuggestions(val){
  clearTimeout(_itemSuggestTimer);
  _itemSuggestTimer = setTimeout(function(){ updateItemSuggestions(val); }, 250);
}
if (typeof window !== 'undefined') window.debouncedItemSuggestions = debouncedItemSuggestions;
let _suggestionIndex = -1;

// ── Session 157 ── All-eras fallback dataset for wizard search ──────────
// Builds (once, then caches) a merged master array spanning every real era
// WITHOUT changing the app's current era or state.masterData. Powers the
// "current era, fall back to all" behavior so an item from another
// manufacturer/era (e.g. a Weaver loco while browsing Postwar) stays
// findable. Hydrates from each era's IDB cache first (instant); fetches any
// era not yet cached from Sheets and caches it for next time.
let _allErasSearchCache = null;
let _allErasSearchPromise = null;
function _getAllErasMasterForSearch(force) {
  if (_allErasSearchCache && !force) return Promise.resolve(_allErasSearchCache);
  if (_allErasSearchPromise && !force) return _allErasSearchPromise;
  _allErasSearchPromise = (async function() {
    var eras = (typeof REAL_ERA_IDS !== 'undefined' && Array.isArray(REAL_ERA_IDS)) ? REAL_ERA_IDS.slice() : [];
    var out = [];
    for (var i = 0; i < eras.length; i++) {
      var era = eras[i];
      var rows = null;
      try { if (typeof idbGet === 'function') rows = await idbGet('lv_master_cache_' + era); } catch (e) { rows = null; }
      if ((!Array.isArray(rows) || !rows.length) && typeof _fetchMasterTabs === 'function') {
        try {
          var fetched = await _fetchMasterTabs(era);
          rows = (typeof _deduplicateMaster === 'function') ? _deduplicateMaster(fetched) : fetched;
          if (Array.isArray(rows) && rows.length && typeof idbSet === 'function') {
            try { idbSet('lv_master_cache_' + era, rows); localStorage.setItem('lv_master_cache_ts_' + era, Date.now().toString()); } catch (e) {}
          }
        } catch (e) { /* skip this era on failure; others still load */ }
      }
      if (Array.isArray(rows) && rows.length) {
        for (var j = 0; j < rows.length; j++) { if (rows[j] && !rows[j]._era) rows[j]._era = era; }
        out = out.concat(rows);
      }
    }
    _allErasSearchCache = out;
    _allErasSearchPromise = null;
    return out;
  })();
  return _allErasSearchPromise;
}
window._getAllErasMasterForSearch = _getAllErasMasterForSearch;

function updateSetSuggestions(query) {
  const el = document.getElementById('wiz-suggestions');
  if (!el) return;
  const q = (query || '').trim().toUpperCase();
  if (q.length < 1) { el.style.display = 'none'; el.innerHTML = ''; return; }

  // Match by set number OR by item numbers within the set OR by set name
  const candidates = state.setData
    .filter(s => s.setNum.toUpperCase().includes(q)
      || (s.setName || '').toUpperCase().includes(q)
      || s.items.some(item => item.toUpperCase().startsWith(q)))
    .slice(0, 15);

  if (!candidates.length) { el.style.display = 'none'; el.innerHTML = ''; return; }

  el.innerHTML = '';
  candidates.forEach((s, i) => {
    const row = document.createElement('button');
    row.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;gap:0.25rem;padding:0.55rem 0.75rem;border-radius:8px;border:none;background:none;color:var(--text);text-align:left;cursor:pointer;width:100%;font-family:var(--font-body)';
    row.onmouseenter = () => row.style.background = 'var(--surface2)';
    row.onmouseleave = () => row.style.background = 'none';

    // Item number chips — highlight items that match the search query
    const chips = s.items.map(n => {
      const isMatch = n.toUpperCase().startsWith(q);
      return `<span style="font-family:var(--font-mono);font-size:0.68rem;padding:1px 5px;border-radius:4px;border:1px solid ${isMatch ? 'var(--accent)' : 'var(--border)'};background:${isMatch ? 'rgba(240,80,8,0.15)' : 'var(--surface)'};color:${isMatch ? 'var(--t-accent)' : 'var(--text-dim)'};font-weight:${isMatch ? '700' : '400'}">${n}</span>`;
    }).join('');
    const altChips = s.alts.length ? s.alts.map(n =>
      `<span style="font-family:var(--font-mono);font-size:0.68rem;padding:1px 5px;border-radius:4px;border:1px solid rgba(230,126,34,0.4);background:var(--surface);color:var(--t-orange);font-style:italic" title="Alternate">${n}</span>`
    ).join('') : '';

    row.innerHTML = `
      <div style="display:flex;align-items:center;gap:0.5rem;width:100%">
        <span style="font-family:var(--font-mono);font-size:0.88rem;font-weight:700;color:var(--t-accent)">${s.setNum}</span>
        ${s.setName ? `<span style="font-size:0.78rem;color:var(--text-mid);flex:1">${s.setName}</span>` : '<span style="flex:1"></span>'}
        <span style="font-size:0.7rem;color:var(--text-dim);white-space:nowrap">${s.year || ''}${s.gauge ? ' · ' + s.gauge : ''}</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:0.2rem;margin-top:0.1rem">${chips}${altChips}</div>`;

    row.onclick = () => {
      wizard.data.set_num = s.setNum;
      wizard.data._resolvedSet = s;  // store the exact variant row
      el.style.display = 'none';
      el.innerHTML = '';
      const inp = document.getElementById('wiz-input');
      if (inp) inp.value = s.setNum;
      wizardNext();
    };
    el.appendChild(row);

    // Divider between different set numbers
    if (i < candidates.length - 1 && candidates[i+1].setNum !== s.setNum) {
      const div = document.createElement('div');
      div.style.cssText = 'height:1px;background:var(--border);margin:2px 0';
      el.appendChild(div);
    }
  });
  el.style.display = 'flex';
  el.style.flexDirection = 'column';
}

function updateUnitNumSuggestions(query, field) {
  const el = document.getElementById('wiz-unit-suggestions');
  if (!el) return;
  const q = (query || '').trim().toLowerCase();
  if (q.length < 1) { el.style.display = 'none'; el.innerHTML = ''; return; }

  // Search master data for matching item numbers
  const seen = new Set();
  const candidates = [];
  state.masterData.forEach(function(m) {
    const num = normalizeItemNum(m.itemNum);
    if (!seen.has(num) && num.toLowerCase().includes(q)) {
      seen.add(num);
      candidates.push({ num: num, sub: (m.roadName || m.description || '').substring(0, 40) });
    }
  });

  candidates.sort(function(a, b) {
    const as = a.num.toLowerCase().startsWith(q);
    const bs = b.num.toLowerCase().startsWith(q);
    if (as && !bs) return -1;
    if (!as && bs) return 1;
    return a.num.localeCompare(b.num);
  });

  if (candidates.length === 0) { el.style.display = 'none'; el.innerHTML = ''; return; }
  const top = candidates;

  el.innerHTML = '';
  top.forEach(function(c) {
    const btn = document.createElement('button');
    btn.style.cssText = 'text-align:left;width:100%;padding:0.65rem 0.75rem;border:none;background:transparent;'
      + 'border-radius:6px;cursor:pointer;color:var(--text);font-family:var(--font-body);display:flex;align-items:baseline;gap:0.5rem;min-height:44px';
    btn.onmouseenter = function() { btn.style.background = 'var(--surface2)'; };
    btn.onmouseleave = function() { btn.style.background = 'transparent'; };
    btn.onclick = function() {
      wizard.data[field] = c.num;
      const inp = document.getElementById('wiz-unit-num');
      if (inp) inp.value = c.num;
      el.style.display = 'none';
    };
    const numSpan = document.createElement('span');
    numSpan.style.cssText = 'font-family:var(--font-mono);font-weight:600;color:var(--accent2);font-size:0.95rem';
    numSpan.textContent = c.num;
    btn.appendChild(numSpan);
    if (c.sub) {
      const sub = document.createElement('span');
      sub.style.cssText = 'font-size:0.75rem;color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      sub.textContent = c.sub;
      btn.appendChild(sub);
    }
    el.appendChild(btn);
  });
  el.style.display = 'flex';
}

function handleUnitNumKey(e, field) {
  if (e.key === 'Enter') { wizardNext(); }
  else if (e.key === 'Escape') {
    const el = document.getElementById('wiz-unit-suggestions');
    if (el) el.style.display = 'none';
  }
}

// A steam wheel arrangement (0-6-0, 4-6-4, 4-6-6-4): 3+ groups of 1-2
// digits. ONE definition — the number picker and the number-vs-words
// decision in updateItemSuggestions both ask it.
function _rrIsWheelArrangement(t) { return /^\d{1,2}(?:-\d{1,2}){2,}$/.test(String(t || '')); }

// Bug 9 (Session 154): pull the item-number token out of a longer query
// like "MTH Premier 20-93699" or "Lionel 736 berkshire" so the lookup
// matches on the number, not the whole descriptive string. Returns the
// first token with 2+ digits or a digit-hyphen-digit shape; else the
// first token (legacy behavior for pure text searches).
// v0.9.2028 — the rail a catalog row runs on ("3-Rail", "2-Rail"), read from
// its own Track/Power cell; '' when the cell names no rail number (Lionel rows
// leave it blank). 2026-11-01: the Add list's "Atlas 3-Rail" chip is gone —
// the maker · era tag below names the maker first and carries the rail, so the
// rail can never read like the 3rd Rail brand (Brad, 2026-10-25).
function rrRowRailWord(c) {
  if (!c || !c.trackPower) return '';
  var m = String(c.trackPower).match(/(\d)\s*-?\s*rail/i);
  return m ? m[1] + '-Rail' : '';
}
if (typeof window !== 'undefined') window.rrRowRailWord = rrRowRailWord;

function _extractSearchItemNum(query) {
  if (!query) return '';
  var toks = String(query).trim().split(/\s+/);
  // Session 157: a steam-loco wheel arrangement like "0-6-0", "4-6-4",
  // "2-8-2" or "4-6-6-4" has the digit-hyphen-digit shape and was being
  // mistaken for an item number, forcing a (failing) item-number match.
  // Skip tokens that are PURELY a wheel arrangement (3+ groups of 1-2
  // digits) so they fall through to description matching instead. Real
  // item numbers (2343, 736, MTH "20-3132-1") are unaffected — 20-3132-1
  // has a 4-digit group so it is not a wheel arrangement.
  for (var i = 0; i < toks.length; i++) {
    var t = toks[i];
    if (_rrIsWheelArrangement(t)) continue;
    // Strip a single-digit MPC/modern Lionel product-line prefix ("6-8359" ->
    // "8359", "7-11193" -> "11193") so it matches the bare master number.
    // MTH "20-3132-1" (two-digit prefix) and postwar "6464-1" are unaffected.
    if (/\d{2,}/.test(t) || /\d-\d/.test(t)) return t.replace(/^\d-/, '');
  }
  return toks[0] || '';
}

function updateItemSuggestions(query) {
  // NOTE: `wizard` in wizard.js is declared with `let` at script top-level,
  // which creates a global LEXICAL binding (visible to other scripts) but
  // does NOT create a property on `window`. So `window.wizard` is undefined
  // even when `wizard` itself is fully populated. Reference the lexical
  // binding directly. typeof guard avoids ReferenceError if a future
  // refactor changes the load order.
  var _w = (typeof wizard !== 'undefined') ? wizard : null;
  const el = document.getElementById('wiz-suggestions');
  if (!el) return;
  const q = (query || '').trim().toLowerCase();
  // Allow filter-only queries (Type or Road selected with empty text) to
  // show results without requiring the user to type anything. Only hide
  // the suggestion box when there's no query AND no active filter.
  var _hasFilter = !!(_w && _w.data &&
    (_w.data._searchFilterType || _w.data._searchFilterRoad
     || _w.data._searchFilterManufacturer || _w.data._searchFilterPeriod));
  if (q.length < 1 && !_hasFilter) { el.style.display = 'none'; el.innerHTML = ''; return; }
  // v0.9.1491: an inbox-prefilled add already carries its LOCKED match —
  // running the full-catalog suggestion scan for that same number is 132k
  // rows of pure waste on the click's critical path.
  if (_w && _w.data && _w.data._pinStagedNum && typeof wizard !== 'undefined' && wizard.matchedItem
      && q === String(_w.data._pinStagedNum).trim().toLowerCase()) {
    el.style.display = 'none'; el.innerHTML = '';
    return;
  }

  const tab = wizard.tab;
  let candidates = [];

  if (tab === 'sold' || tab === 'forsale') {
    // For sell/forsale tabs: search personal collection only
    const seen = new Set();
    Object.values(state.personalData).forEach(pd => {
      const key = pd.itemNum + (pd.variation ? ' (' + pd.variation + ')' : '');
      const haystack = (pd.itemNum + ' ' + (pd.variation || '') + ' ' + (pd.roadName || '') + ' ' + (pd.description || '')).toLowerCase();
      if (!seen.has(key) && haystack.includes(q)) {
        seen.add(key);
        candidates.push({ num: pd.itemNum, label: key, sub: '', _owned: pd });
      }
    });
  } else {
    // Collection + Want: search master list by item number OR description/road name
    // Detect search mode: if query starts with a digit, prioritize item number matching
    // Bug 9 (Session 154): extract the item-number token from anywhere in
    // the query (handles "MTH Premier 20-93699"), and treat manufacturer/
    // line words as non-filtering context.
    const _searchNum = _extractSearchItemNum(q);
    // v0.9.1895 (Brad: "want to add a 4 trolley. it doesn't show up"):
    // a ONE-digit number (4, 8, 8E) was treated as TEXT, so "4" matched any
    // description containing a 4 ("0-4-0") and the No. 4 Trolley — whose
    // words hold no 4 — never showed. A token that STARTS with a digit is a
    // number, unless it is a wheel arrangement (4-6-4), which is words.
    const startsWithDigit = !_rrIsWheelArrangement(_searchNum)
      && (/^\d/.test(_searchNum) || /\d{2,}/.test(_searchNum) || /\d-\d/.test(_searchNum));
    const qParts = q.split(/\s+/);
    const numPart = _searchNum;
    const _stopWords = new Set((window.ITEM_SEARCH_FILTERS && window.ITEM_SEARCH_FILTERS.searchStopWords) || []);
    // 2026-11-02: the number token itself is never a description word, in
    // whichever form it was typed ("6-31705" gave the search 31705, then asked
    // the description for "6-31705" too — and found nothing).
    // rosstab (2026-11-05): "ross" is also a road and a name (Betsy Ross), so it
    // names the maker Ross Custom Switches ONLY beside a number ("902 ross") or
    // in the maker's own words ("ross custom", "ross switches") — never on its
    // own in a word search, where "betsy ross" must keep finding the Betsy Ross car.
    const _rossPhrase = /(^|\s)ross\s+(custom|switch|switches)(\s|$)/.test(q);
    // Beside a number it counts only when it is the ONLY other word ("902 ross") —
    // "19999 betsy ross" is a description, and must never save as Ross.
    const _rossBesideNum = startsWithDigit && (function () { var o = qParts.filter(function (p) { return p && p !== _searchNum && !(rrNumLinePrefixOff(p) === _searchNum); }); return o.length === 1 && o[0] === 'ross'; })();   // (written apart from keyParts' test below, which line_prefix_number_tests plants by its exact text)
    const _rossAsMaker = (_rossBesideNum || _rossPhrase) && qParts.indexOf('ross') >= 0;
    const _rossWords = _rossAsMaker ? (_rossPhrase ? ['ross', 'custom', 'switch', 'switches'] : ['ross']) : [];
    const keyParts = qParts.filter(p => p && p !== _searchNum && rrNumLinePrefixOff(p) !== _searchNum && !_stopWords.has(p) && _rossWords.indexOf(p) < 0);
    // Session 157: for a pure-text search, strip ONLY stop words (maker /
    // line / filler words like "weaver", "lionel", "gauge") and keep every
    // real description word, including the first one. keyParts must NOT be
    // reused here — it also drops the first word (the item-number token),
    // which would broaden "usra switcher" to all switchers.
    const _textParts = qParts.filter(p => p && !_stopWords.has(p));

    // Active filter values from the Type / Road dropdowns (blank = any).
    // These live on wizard.data so they survive step navigation but get
    // reset when the wizard closes.
    const _filterType = (wizard.data && wizard.data._searchFilterType) || '';
    const _filterRoad = (wizard.data && wizard.data._searchFilterRoad) || '';
    const _filterMfr = (wizard.data && wizard.data._searchFilterManufacturer) || '';
    const _filterScale = (wizard.data && wizard.data._searchFilterScale) || '';
    const _filterPeriod = (wizard.data && wizard.data._searchFilterPeriod) || '';   // Session 176: Era dropdown
    // Session 172: typed maker/period words act as FILTERS (so "lionel seaboard"
    // shows only Lionel and "postwar hudson" only Postwar) instead of being
    // ignored. Recognized words are pulled out of the text match below.
    var _MFR_WORDS = { lionel:'Lionel', atlas:'Atlas', mth:'MTH', weaver:'Weaver', rmt:'RMT', williams:'Williams', marx:'Marx', menards:'Menards', '3rd rail':'3rd Rail', sunset:'3rd Rail', 'usa trains':'USA Trains', lgb:'LGB', bachmann:'Bachmann', kline:'K-Line', 'k-line':'K-Line', gargraves:'GarGraves' };   // rosstab: "101 gargraves" filters to GarGraves ("ross" is handled above — only beside a number or in its own words)
    var _PERIOD_WORDS = { prewar:'prewar', 'pre-war':'prewar', postwar:'postwar', 'post-war':'postwar', modern:'modern' };
    var _typedMfr = '', _typedPeriod = '';
    qParts.forEach(function(p){ if (_MFR_WORDS[p]) _typedMfr = _MFR_WORDS[p]; if (_PERIOD_WORDS[p]) _typedPeriod = _PERIOD_WORDS[p]; });
    if (_rossAsMaker && !_typedMfr) _typedMfr = 'Ross Custom Switches';   // rosstab: see _rossAsMaker above
    var _effMfr = _filterMfr || _typedMfr;   // dropdown filter wins, else typed word
    var _effPeriod = _filterPeriod || _typedPeriod;   // Session 176: Era dropdown wins, else typed period word
    // v0.9.1463: stash the recognized typed period word so the "✓ Found"
    // banner scorer (_wizMasterPrefer, wizard.js) sees it too — this LIST
    // honoured "postwar 238" but the banner did not. Refreshed on every
    // scan (250ms debounce, before the 400ms banner lookup), so deleting
    // the word clears it; the Era dropdown still outranks it in the scorer.
    if (_w && _w.data) _w.data._typedSearchPeriod = _typedPeriod;
    // 2026-11-01: the typed maker word too — the ONE filter test
    // (_wizRowFitsFilters, wizard.js) reads both, so the banner, Next and the
    // save honour "lionel 1511" exactly as this list does.
    if (_w && _w.data) _w.data._typedSearchMfr = _typedMfr;
    // The filters this scan answers to — read ONCE, asked of every row below.
    var _fits = (typeof _wizRowFitsFilters === 'function') ? _wizRowFitsFilters : null;
    var _fset = (typeof _wizAddFilters === 'function') ? _wizAddFilters() : null;
    var _searchParts = qParts.filter(function(p){ return p && !_stopWords.has(p) && !_MFR_WORDS[p] && !_PERIOD_WORDS[p] && _rossWords.indexOf(p) < 0; });

    // Session 115 fix: era scope guard. If the wizard has a selected era
    // (set at wizard start or via the era pill), restrict suggestions to
    // rows whose master-sheet tab belongs to that era. Prevents MPC/Modern
    // or Atlas rows from leaking into a Postwar search even when
    // state.masterData hasn't been re-scoped.
    var _eraTabSet = null;
    if (wizard.data && wizard.data._era && window.ERA_TABS && ERA_TABS[wizard.data._era]) {
      _eraTabSet = new Set(Object.values(ERA_TABS[wizard.data._era]));
    }

    var seen = new Set();
    // 2026-11-05 (PLAN_2026-11-05_LEADING_ZEROS): rows that are the typed
    // number only apart from its leading zeros (01511 typed, the catalog's
    // 1511) are held aside here, and join the list ONLY when no row IS the
    // typed number — Lionel's 022 and 22 are two real items, so with 022 in
    // the list 22 never joins it. The rule: rrNumZeroTwin (app.js).
    var _zeroTwins = [], _exactNumSeen = false;
    // Session 156: Box Only — hide Boxes-tab rows unless the user explicitly
    // asked for boxes via the Box Only checkbox. Keeps the Step 1 list clean
    // (only one row per number) for normal item searches.
    var _wantBoxes = !!(wizard.data && wizard.data.boxOnly);
    // Session 157: per-row scan factored into a helper so it can run twice —
    // once scoped to the current era (primary) and, if that finds nothing,
    // once across ALL eras (fallback). `_applyEraGuard` toggles era scope.
    function _scanRows(_dataset, _applyEraGuard) {
      (_dataset || []).forEach(m => {
      // Era scope — skip rows from other eras (see Session 115 note above).
      var _isBoxRow = !!(typeof SHEET_TABS !== 'undefined'
                      && SHEET_TABS.boxes && m._tab === SHEET_TABS.boxes);
      if (_isBoxRow !== _wantBoxes) return;
      // (Session 156 box guard above; era guard below.)
      if (_applyEraGuard && _eraTabSet && m._tab && !_eraTabSet.has(m._tab)) return;
      // Filter dropdowns: trim BOTH sides so stray whitespace in the
      // master sheet doesn't silently hide matches.
      // Session 119: Type filter compares against tier-1 bucket label
      // (matches browse Phase C). Picking "Steam" correctly includes both
      // Steam Engine and Steam Locomotive items.
      // 2026-11-01: Manufacturer, Era, Type, Scale and Road — the ONE filter
      // test (_wizRowFitsFilters, wizard.js). No copy of it lives here.
      if (_fits && !_fits(m, _fset)) return;

      const haystack = ((m.roadName || '') + ' ' + (m.description || '') + ' ' + (m.varDesc || '') + ' ' + (m.itemType || '')).toLowerCase();

      let matches = false, _isZeroTwin = false;
      if (startsWithDigit) {
        // Number-led search: item number must match first token; extra words filter by description
        if (!m.itemNum.toLowerCase().includes(numPart) && !rrNumSameAsTyped(m.itemNum, numPart)) {
          if (!(typeof rrNumZeroTwin === 'function' && rrNumZeroTwin(m.itemNum, numPart))) return;
          _isZeroTwin = true;   // held aside below — joins only if no row IS the number
        }
        if (keyParts.length > 0 && !keyParts.every(kp => haystack.includes(kp))) return;
        if (!_isZeroTwin && rrNumSameAsTyped(m.itemNum, numPart)) _exactNumSeen = true;
        matches = true;
      } else {
        // Text-only search: match anywhere in road name, description, or item type
        matches = _searchParts.length > 0 ? _searchParts.every(kp => haystack.includes(kp)) : (_fset ? _wizAnyAddFilter(_fset) : !!(_effMfr || _effPeriod || _filterType || _filterRoad || _filterScale));
      }

      if (!matches) return;

      // Dedup key fields come from config so variations with different
      // subType/varDesc/etc don't collapse into a single row (was hiding
      // real differences on rows that looked identical).
      var _dedupFields = (window.ITEM_SEARCH_FILTERS && window.ITEM_SEARCH_FILTERS.dedupKeyFields)
        || ['itemNum', 'roadName'];
      var _dedupeKey = _dedupFields.map(function(f) { return (m[f] || ''); }).join('|');
      // rosstab (2026-11-05, [stated] Brad "Yes, one row per maker"): two MAKERS'
      // rows never merge — Lionel's 902 Elevated Trestle and Ross's 902 Mating Pins
      // share number, type and a blank road, so the list showed Lionel's alone.
      // Keyed on the maker (not the catalog), so Lionel postwar and modern still
      // merge exactly as before.
      _dedupeKey += '|' + _sgMakerOfRow(m);
      if (!seen.has(_dedupeKey)) {
        seen.add(_dedupeKey);
        const road = m.roadName || '';
        (_isZeroTwin ? _zeroTwins : candidates).push({
          _zeroTwin:   _isZeroTwin,   // 2026-11-05: "listed in our catalog as …"
          num:         m.itemNum,
          roadName:    road,
          itemType:    m.itemType    || '',
          subType:     m.subType     || '',
          varDesc:     m.varDesc     || '',
          description: m.description || '',
          trackPower:  m.trackPower  || '',
          // Bug 10b (Session 154): MTH/Lionel items have no stored refLink;
          // generate one from the item number via the shared browse.js helper
          // so the suggestion row shows "MTH \u2197" / "Lionel \u2197".
          refLink:     m.refLink || ((typeof window._itemExternalLinkURL === 'function') ? window._itemExternalLinkURL(m) : ''),
          label:       m.itemNum,
          // v0.9.1873: what rrCatalogStatus reads (a cancelled MTH item says so)
          deliveryStatus: m.deliveryStatus || '',
          alsoSoldAs:  m.alsoSoldAs  || '',   // v0.9.1935: the "as Lionel" chip below
          _era:        m._era || '',
          _tab:        m._tab || '',
          // 2026-11-01: the catalog row itself — a tapped row IS the add's row
          // (selectSuggestion), and the tag reads its own cells
          _row:        m,
        });
      }
      });
    }

    // Session 157: primary pass — scoped to the current era (unchanged).
    _scanRows(state.masterData, true);

    // Session 157: "current era, fall back to all". If the era-scoped pass
    // found nothing AND we're inside a specific era (not the 'all' meta-era),
    // widen to the whole catalog via a side dataset that never touches the
    // app's current view/era. Pre-warmed on wizard open; if not ready yet,
    // kick the load and re-render when it lands.
    var _eraScoped = !!_eraTabSet;
    var _anyDropFilter = !!(_filterMfr || _filterPeriod || _filterType);  // Session 176
    if (candidates.length === 0 && _zeroTwins.length === 0 && (q.length >= 1 || _anyDropFilter) && _eraScoped   // 2026-11-05: an in-era zero twin is an answer — no widening past it
        && wizard.data && wizard.data._era && wizard.data._era !== 'all'
        && tab !== 'sold' && tab !== 'forsale') {
      var _allData = (typeof _allErasSearchCache !== 'undefined') ? _allErasSearchCache : null;
      if (_allData && _allData.length) {
        seen = new Set();
        candidates = [];
        _zeroTwins = []; _exactNumSeen = false;   // 2026-11-05: the wider pass decides afresh
        _scanRows(_allData, false);
      } else if (typeof _getAllErasMasterForSearch === 'function') {
        _getAllErasMasterForSearch().then(function() {
          var _inp = document.getElementById('wiz-input');
          if (_inp && String(_inp.value || '').trim().toLowerCase() === q) updateItemSuggestions(_inp.value);
        }).catch(function() {});
      }
    }

    // 2026-11-05 (PLAN_2026-11-05_LEADING_ZEROS): the held-aside zero twins
    // join ONLY when no row is the typed number itself — a fallback, never a
    // second match. Each says "listed in our catalog as …" when drawn below.
    if (startsWithDigit && !_exactNumSeen && _zeroTwins.length) candidates = candidates.concat(_zeroTwins);

    // 2026-11-01 (Lars typed the set 1467W here): a Lionel Postwar SET number.
    // The set list answers too, each set through THE one filter test
    // (_wizPostwarSetHits → _wizRowFitsFilters) — one row per set number,
    // drawn below with the SET tag. The set list not in yet → fetch it (the
    // one loader, rrEnsurePostwarSets) and ask again, as the all-eras pass does.
    if (startsWithDigit && _wizSetCheckOn()) {
      var _setHits = _wizPostwarSetHits(numPart, _fset);
      if (_setHits === null) {
        if (typeof rrEnsurePostwarSets === 'function') {
          rrEnsurePostwarSets().then(function (got) {
            var _inp = document.getElementById('wiz-input');
            if (got && got.length && _inp && String(_inp.value || '').trim().toLowerCase() === q) updateItemSuggestions(_inp.value);
          }).catch(function () {});
        }
      } else {
        var _setMax = ((window.RR_ADD_FILTERS || {}).setRowsMax) || 12;
        _setHits.slice(0, _setMax).forEach(function (g) {
          candidates.push({ num: g.setNum, roadName: '', itemType: '', subType: '', varDesc: '',
            description: _wizSetRowDetails(g), refLink: '', label: g.setNum, _row: g.row, _setNum: g.setNum });
        });
      }
    }

    // Post-filter: drop "bare" candidates (all disambiguator fields blank)
    // when a more-informative candidate with the same itemNum exists.
    // The master sheet has phantom/placeholder rows for some items that
    // were surfacing as duplicate bare rows after Session 113's expanded
    // dedup key. Populated variations always take priority.
    var _informative = new Set();
    candidates.forEach(function(c) {
      if (c.subType || c.varDesc || c.description) _informative.add(c.num);
    });
    candidates = candidates.filter(function(c) {
      var hasInfo = !!(c.subType || c.varDesc || c.description);
      if (hasInfo) return true;
      // Drop only if a sibling populated row exists for this itemNum.
      return !_informative.has(c.num);
    });

    // Bug 8 (Session 154): Session 156's _byNum collapse was REMOVED —
    // it was forcing one-row-per-itemNum and hiding the 773 Hudson
    // engine behind the 773 Track row. The config-level dedup at
    // line ~247 already keys on (itemNum, roadName, itemType) which
    // keeps distinct KINDS visible while still collapsing variations
    // within the same kind (5 Hudson variants → 1 Steam Loco row).
    // The sort below uses itemTypePriority to float engines to the top.
  }

  // Bug 8 (Session 154): itemType priority. When the same itemNum has
  // multiple kinds (Hudson + Track + Set + Paper for "773"), float the
  // engine/car rows to the top and sink ephemera to the bottom.
  function _itemTypePriority(it) {
    if (!it) return 99;
    var matchers = (window.ITEM_SEARCH_FILTERS && window.ITEM_SEARCH_FILTERS.itemTypePriority) || [];
    for (var i = 0; i < matchers.length; i++) {
      var m = matchers[i];
      if (m && m.match && m.match.test && m.match.test(it)) return m.priority;
    }
    return (window.ITEM_SEARCH_FILTERS && window.ITEM_SEARCH_FILTERS.itemTypePriorityDefault) || 50;
  }

  // Sort: for number searches, starts-with first; within same itemNum,
  // sort by itemType priority so engines surface above track/paper.
  const startsWithDigit = /^\d/.test(q);
  if (startsWithDigit) {
    candidates.sort((a, b) => {
      const aStarts = a.num.toLowerCase().startsWith(q.split(' ')[0]);
      const bStarts = b.num.toLowerCase().startsWith(q.split(' ')[0]);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      const numCmp = a.num.localeCompare(b.num);
      if (numCmp !== 0) return numCmp;
      // Same itemNum — use itemType priority (lower number wins).
      return _itemTypePriority(a.itemType) - _itemTypePriority(b.itemType);
    });
  } else {
    // Text searches: still group same-itemNum rows by priority.
    candidates.sort((a, b) => {
      const numCmp = a.num.localeCompare(b.num);
      if (numCmp !== 0) return numCmp;
      return _itemTypePriority(a.itemType) - _itemTypePriority(b.itemType);
    });
  }

  if (candidates.length === 0) {
    // 2026-11-01 — nothing fits the filters: say so, right where the list
    // would be (the three lines, _wizNothingFoundHtml). Only for a NUMBER on
    // the catalog tabs, once the catalog is in — a search in words, or the
    // Sold / For Sale pickers (your own copies), keep their quiet empty list.
    var _nfNum = '';
    try { _nfNum = String(_extractSearchItemNum(q) || '').trim(); } catch (eNF) {}
    if (tab !== 'sold' && tab !== 'forsale' && _wizLooksLikeNumber(_nfNum)
        && !(typeof _catalogReady === 'function' && !_catalogReady())) {
      var _nfShown = String(query || '').trim().split(/\s+/).filter(function (t) { return t.toLowerCase() === _nfNum.toLowerCase(); })[0] || _nfNum;
      _suggestionIndex = -1;
      el.innerHTML = _wizNothingFoundHtml(_nfShown);
      el.style.display = 'flex';
      el.style.flexDirection = 'column';
      return;
    }
    el.style.display = 'none'; el.innerHTML = ''; return;
  }

  _suggestionIndex = -1;
  el.innerHTML = '';

  // Session 176: cap rendered rows so a broad filter (e.g. all of one
  // manufacturer/era) can't try to draw thousands of rows and freeze the list.
  var _totalMatches = candidates.length;
  var _RENDER_CAP = 75;
  if (candidates.length > _RENDER_CAP) candidates = candidates.slice(0, _RENDER_CAP);

  // Count header
  const countBar = document.createElement('div');
  countBar.style.cssText = 'padding:0.3rem 0.75rem 0.4rem;font-size:0.72rem;color:var(--text-dim);border-bottom:1px solid var(--border);margin-bottom:2px;flex-shrink:0';
  countBar.textContent = (_totalMatches > _RENDER_CAP)
    ? (_totalMatches + ' matches — showing first ' + _RENDER_CAP + '; narrow with filters or typing')
    : (_totalMatches + ' match' + (_totalMatches !== 1 ? 'es' : '') + ' — tap to select or keep typing to filter');
  el.appendChild(countBar);

  const _cfg = (window.ITEM_SEARCH_FILTERS && window.ITEM_SEARCH_FILTERS.ui) || {};
  // Shared resolver from item-search-filters-config.js — returns short
  // label like "Atlas ↗" / "COTT ↗" / "View ↗" based on URL. Fallback to
  // legacy cottLinkLabel keeps this safe if the config is missing.
  const _resolveRefLabel = function(url) {
    if (typeof window.resolveRefLabel === 'function') return window.resolveRefLabel(url);
    return url ? (_cfg.cottLinkLabel || 'View \u2197') : '';
  };

  // Config-driven row-2 recipe: which fields to join, with what separator,
  // capped length so a verbose description doesn't blow the row height.
  var _rowFields = (window.ITEM_SEARCH_FILTERS && window.ITEM_SEARCH_FILTERS.rowDetailsFields)
    || ['subType', 'varDesc', 'description'];
  var _rowSep    = (window.ITEM_SEARCH_FILTERS && window.ITEM_SEARCH_FILTERS.rowDetailsSep) || ' \u00B7 ';
  var _rowMaxLen = (window.ITEM_SEARCH_FILTERS && window.ITEM_SEARCH_FILTERS.rowDetailsMaxLen) || 110;

  // v0.9.1481 (Brad, second ask: "if we suggest that its a 238, we should
  // highlight the 238 row"): the v1476 highlight referenced _searchNum,
  // which is a const scoped INSIDE the master-search branch — out of reach
  // here, so the try{} silently ate a ReferenceError and nothing ever
  // highlighted. Recomputed at render scope from q instead.
  var _hlNum = '';
  try { _hlNum = (typeof _extractSearchItemNum === 'function') ? String(_extractSearchItemNum(q) || '').trim().toLowerCase() : String(q || '').trim().toLowerCase(); } catch (eHN) {}
  // ── v0.9.2031 (Lars, York: "RMT 66238 … showed 20-"): a NUMBER search where
  // no listed row IS the typed number. The rows only CONTAIN it (MTH 20-66238
  // holds 66238), and until now nothing said so. Now the first row offers the
  // number as typed — the catalog simply lacks it — and every contains-row is
  // labelled with its maker and why it is here. Words: RR_ADD_TYPED (config.js).
  // The typed row carries no data-idx: the arrow keys and the in-app checks
  // count data-idx rows as CATALOG rows, and this one is not.
  // _numQ: a number search at all (then a row that neither IS nor STARTS WITH
  // the number gets the contains label — 238E is a 238, 20-66238 is not);
  // _typedNum: the number as the collector typed it, when no row IS it.
  var _numQ = '', _typedNum = '';
  try {
    if (tab !== 'sold' && tab !== 'forsale' && /^\d/.test(_hlNum) && !_rrIsWheelArrangement(_hlNum) && candidates.length) {
      _numQ = String(query || '').trim().split(/\s+/).filter(function (t) { return t.toLowerCase() === _hlNum; })[0] || _hlNum;
      if (!candidates.some(function (c) { return rrNumSameAsTyped(c.num, _hlNum) || c._zeroTwin; })) _typedNum = _numQ;   // 2026-11-05: a zero twin IS the number
    }
  } catch (eTN) {}
  if (_typedNum) {
    const tRow = document.createElement('div');
    tRow.setAttribute('role', 'button');
    tRow.setAttribute('tabindex', '0');
    tRow.dataset.typedNum = _typedNum;
    tRow.style.cssText = 'text-align:left;width:100%;padding:0.55rem 0.75rem;margin-bottom:2px;'
      + 'border:1.5px dashed var(--accent2);background:var(--surface2);'
      + 'border-radius:6px;cursor:pointer;color:var(--text);font-family:var(--font-body);'
      + 'display:flex;flex-direction:column;gap:0.18rem;min-height:44px;'
      + 'box-sizing:border-box;max-width:100%;flex-shrink:0';
    const tLine1 = document.createElement('div');
    tLine1.style.cssText = 'font-weight:600;font-size:0.92rem;color:var(--text)';
    tLine1.textContent = rrTypedWords('useTyped', _typedNum);
    tRow.appendChild(tLine1);
    const tLine2 = document.createElement('div');
    tLine2.style.cssText = 'font-size:0.8rem;color:var(--text-dim);line-height:1.35';
    tLine2.textContent = rrTypedWords('useTypedSub', _typedNum);
    tRow.appendChild(tLine2);
    tRow.onclick = function() { selectSuggestion(_typedNum, '', '', { asTyped: true }); };
    tRow.onkeydown = function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectSuggestion(_typedNum, '', '', { asTyped: true }); }
    };
    el.appendChild(tRow);
  }
  candidates.forEach(function(c, i) {
    // Outer row is a column flex so we get a visual line-1 (item# + road
    // + reference link) over a line-2 (details). Role="button" lets us
    // nest a real <a> for the reference link without invalid HTML.
    const row = document.createElement('div');
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');
    row.dataset.idx = i;
    // v0.9.2043 (Brad: "you can't see but one option at the bottom"): on a
    // computer the step-1 list (.wiz-ing-wide, app.css) draws each row as ONE
    // line — number · type · details … reference link. These classes are the
    // hooks; a phone keeps the two-line row.
    row.className = 'wiz-sug-row';
    // box-sizing + max-width keep the row bounded; horizontal scroll is
    // prevented at the roadSpan level (min-width:0 + ellipsis) so we
    // deliberately do NOT set overflow:hidden on the row.
    //
    // flex-shrink:0 is CRITICAL: the parent #wiz-suggestions is a flex
    // column with max-height:340px. Without flex-shrink:0 here, many
    // matches get VERTICALLY COMPRESSED to fit (each row squeezed below
    // its natural content height — line 2 rendered at height 0). With
    // flex-shrink:0 the rows keep their natural height and the parent's
    // overflow-y:auto handles scrolling.
    row.style.cssText = 'text-align:left;width:100%;padding:0.55rem 0.75rem;border:none;background:transparent;'
      + 'border-radius:6px;cursor:pointer;color:var(--text);font-family:var(--font-body);'
      + 'display:flex;flex-direction:column;gap:0.18rem;min-height:44px;'
      + 'box-sizing:border-box;max-width:100%;flex-shrink:0';
    // v0.9.1476 (Brad: "should we pre highlight the correct number row
    // which in this case was the 238"): when a row's number IS the typed
    // or auto-filled number, it gets the green edge + tint so the eye
    // lands on it instantly. No icons — Brad's rule.
    try {
      if (_hlNum && (rrNumSameAsTyped(c.num, _hlNum) || c._zeroTwin)) {   // 2026-11-05: so is its zero twin
        row.style.background = 'rgba(46,204,113,0.10)';
        row.style.border = '1.5px solid #2ecc71';
      }
    } catch (eHX) {}
    row.onmouseenter = function() { highlightSuggestion(i); };
    row.dataset.roadName = c.roadName || '';
    // 2026-11-01: the tapped row rides along — it IS the add's one row
    // 2026-11-01: a Postwar SET row opens the set flow on that set (Lars)
    var _pick = c._setNum ? function () { _wizPickSetRow(c._setNum); }
      : function () { selectSuggestion(c.num, c.roadName || '', c.itemType || '', c._row ? { row: c._row } : undefined); };
    row.onclick = _pick;
    row.onkeydown = function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); _pick(); }
    };

    // ── Line 1 ── item# · road name · reference link (far right)
    const line1 = document.createElement('div');
    // v0.9.2028: wraps, so on a phone a long number + type + "Atlas 2-Rail"
    // drops the reference link to its own line instead of off the edge.
    line1.className = 'wiz-sug-l1';
    line1.style.cssText = 'display:flex;flex-wrap:wrap;row-gap:0.3rem;align-items:baseline;gap:0.5rem;width:100%;min-width:0';

    const numSpan = document.createElement('span');
    numSpan.style.cssText = 'font-family:var(--font-mono);font-weight:600;color:var(--accent2);font-size:0.95rem;flex-shrink:0';
    numSpan.textContent = c.num;
    line1.appendChild(numSpan);

    // 2026-11-01 — the maker · era tag, in the SAME spot on every row: right
    // after the number. ONE helper (rrRowTagHtml) — it replaced the v0.9.2028
    // "Atlas 3-Rail" chip, never a second chip. On a computer it sits in the
    // row's one line; on a phone it drops to a small line of its own (app.css,
    // .rr-row-tag-sug).
    var _tagHtml = rrRowTagHtml(c._row || c._owned || c, 'rr-row-tag-sug');
    if (_tagHtml) line1.insertAdjacentHTML('beforeend', _tagHtml);
    // 2026-11-01: a Lionel Postwar set says SET beside its tag (Lars's 1467W)
    if (c._setNum) {
      const setSpan = document.createElement('span');
      setSpan.setAttribute('data-set-tag', c._setNum);
      setSpan.style.cssText = 'font-size:0.7rem;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;'
        + 'color:var(--accent2);background:var(--surface2);border:1px solid var(--accent2);'
        + 'padding:0.1rem 0.4rem;border-radius:4px;flex-shrink:0;white-space:nowrap';
      setSpan.textContent = (window.RR_ADD_FILTERS || {}).setTag || '';
      line1.appendChild(setSpan);
    }

    // Session 115: show itemType next to the number so users can tell
    // apart rows that share an itemNum but differ in kind — e.g. the
    // 773 Accessory vs the 773 Steam Engine at the same item number.
    if (c.itemType) {
      const typeSpan = document.createElement('span');
      typeSpan.style.cssText = 'font-size:0.7rem;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;'
        + 'color:var(--text-dim);background:var(--surface2);border:1px solid var(--border);'
        + 'padding:0.1rem 0.4rem;border-radius:4px;flex-shrink:0;white-space:nowrap';
      typeSpan.textContent = (typeof getTypeBucketLabel === 'function') ? getTypeBucketLabel(c) : c.itemType;
      line1.appendChild(typeSpan);
    }

    // v0.9.2031: a row that only CONTAINS the typed number says so, with its
    // maker — "MTH · contains 66238" — so nobody takes it for the number typed.
    // 2026-11-05: a leading-zero twin says what it is instead — "S-Helper ·
    // listed as 1511" — so nobody wonders why 1511 answered 01511.
    if (c._zeroTwin) {
      const zSpan = document.createElement('span');
      zSpan.setAttribute('data-zero-twin', String(c.num || ''));
      zSpan.style.cssText = 'font-size:0.7rem;font-weight:700;letter-spacing:0.04em;'
        + 'color:var(--text-dim);background:transparent;border:1px solid currentColor;'
        + 'padding:0.1rem 0.4rem;border-radius:4px;flex-shrink:0;white-space:nowrap';
      zSpan.textContent = rrTypedWords('zeroTwin', String(c.num || ''), rrRowMakerWord(c));
      line1.appendChild(zSpan);
    } else
    if (_numQ && !rrNumSameAsTyped(c.num, _hlNum) && String(c.num || '').toLowerCase().indexOf(_hlNum) !== 0) {
      const containsSpan = document.createElement('span');
      containsSpan.setAttribute('data-contains-num', _numQ);
      containsSpan.style.cssText = 'font-size:0.7rem;font-weight:700;letter-spacing:0.04em;'
        + 'color:var(--warn);background:transparent;border:1px solid currentColor;'
        + 'padding:0.1rem 0.4rem;border-radius:4px;flex-shrink:0;white-space:nowrap';
      containsSpan.textContent = rrTypedWords('contains', _numQ, rrRowMakerWord(c));
      line1.appendChild(containsSpan);
    }
    // v0.9.1935: "as LIONEL" on an MTH-built Lionel Corporation item, so the
    // row says why it turned up under either maker (the chip lives in era-badges.js).
    if (c.alsoSoldAs && typeof alsoSoldAsChipHTML === 'function') {
      var _asChip = alsoSoldAsChipHTML(c);
      if (_asChip) line1.insertAdjacentHTML('beforeend', _asChip);
    }

    // Session 156: road name suppressed from Step 1 list — variations
    // get chosen on the next wizard step. Spacer keeps the reference
    // link pinned right.
    const spacer = document.createElement('span');
    spacer.className = 'wiz-sug-spacer';
    spacer.style.cssText = 'flex:1;min-width:0';
    line1.appendChild(spacer);

    // Reference link — Atlas ↗ / COTT ↗ / View ↗ per URL.
    if (c.refLink) {
      const refA = document.createElement('a');
      refA.href = c.refLink;
      refA.target = '_blank';
      refA.rel = 'noopener';
      refA.textContent = _resolveRefLabel(c.refLink);
      refA.className = 'wiz-sug-ref';
      refA.onclick = function(ev) { ev.stopPropagation(); };
      refA.style.cssText = 'font-size:0.72rem;color:var(--accent2);text-decoration:none;'
        + 'padding:0.2rem 0.5rem;border:1px solid rgba(201,146,42,0.35);border-radius:6px;'
        + 'background:rgba(201,146,42,0.08);flex-shrink:0;white-space:nowrap;font-weight:600;margin-left:auto';
      line1.appendChild(refA);
    }
    row.appendChild(line1);

    // ── Line 2 ── disambiguator (subType · varDesc · description, etc.)
    // v0.9.2043: a field that says the same as one already shown is left out —
    // the 773 read "4-6-4 Steam Locomotive · 4-6-4 Steam Locomotive" because its
    // road-name cell repeats the description.
    var _detailsSeen = {};
    var _detailsParts = _rowFields
      .map(function(f) { return (c[f] || '').toString().trim(); })
      .filter(function(v) {
        var k = v.toLowerCase();
        if (!v.length || _detailsSeen[k]) return false;
        _detailsSeen[k] = 1; return true;
      });
    var _details = _detailsParts.join(_rowSep);
    if (_details.length > _rowMaxLen) _details = _details.substring(0, _rowMaxLen - 1) + '\u2026';
    if (_details) {
      const line2 = document.createElement('div');
      line2.className = 'wiz-sug-details';
      line2.title = _details;   // the whole text on hover, where one line cuts it short
      // 2-line visual cap via max-height + line-height. This is more
      // reliable than `display:-webkit-box + -webkit-line-clamp` which
      // has rendering quirks inside a flex-column parent with overflow.
      // Text wraps naturally; anything past ~2 lines is clipped.
      // word-break keeps very long tokens from blowing the width.
      line2.style.cssText = 'font-size:0.82rem;color:var(--text-mid);line-height:1.35;'
        + 'word-break:break-word;overflow-wrap:anywhere;'
        + 'max-height:calc(2 * 1.35em);overflow:hidden;'
        + 'width:100%';
      line2.textContent = _details;
      row.appendChild(line2);
    }
    // v0.9.1873: a cancelled item says so, on its own line under the details
    if (typeof rrCatalogStatusChip === 'function') {
      var _stChip = rrCatalogStatusChip(c, { block: true });
      if (_stChip) row.insertAdjacentHTML('beforeend', _stChip);
    }

    el.appendChild(row);
  });
  el.style.display = 'flex';
}

// Distinct non-blank values of a master-row field, for populating the
// Type / Road dropdowns on the search step.  Uses state.masterData which
// is already scoped to the currently-active era, so results are era-aware
// automatically. Caller passes 'itemType' or 'roadName'.
// The master sheet has tabs that aren't really item tabs (Sets has tender
// item#s in col G; Catalogs tabs have catalog descriptions; Weaver O has
// no header row so its first row leaks in; Companions / Instruction Sheets
// have no road name). When we pull distinct roadName values for the
// dropdown, skip rows from those non-item tabs entirely.
var _NON_ROAD_TABS = {
  'Lionel PW - Sets': 1,
  'Lionel PW - Companions': 1,
  'Lionel PW - Catalogs': 1,
  'Lionel PW - Instruction Sheets': 1,
  'Lionel Pre-War - Catalogs': 1,
  'Lionel MPC-Modern - Catalogs': 1,
};

// A real road name shouldn't start with a digit, must contain letters, and
// shouldn't be an outrageous-length blurb. Conservative checks only — we
// don't keyword-filter words like 'Plate' or 'Road' or 'Series' because
// those appear in real road names (Nickel Plate Road, State Series, etc.).
function _isLikelyRoadName(v) {
  if (!v) return false;
  v = String(v).trim();
  if (!v) return false;
  if (/^\d/.test(v)) return false;          // starts with a digit -> not a road
  if (!/[a-zA-Z]/.test(v)) return false;     // no letters -> not a name
  if (v.length > 60) return false;           // very long -> probably a description
  return true;
}

// Pick the better casing when two variants of the same road name exist
// across tabs (e.g. Weaver O ALL-CAPS vs MPC-Modern Title Case). Title case
// wins over all-caps; if both are title-cased or both all-caps, longer wins.
function _preferredCasing(a, b) {
  var aUpper = a === a.toUpperCase();
  var bUpper = b === b.toUpperCase();
  if (aUpper && !bUpper) return b;
  if (!aUpper && bUpper) return a;
  return a.length >= b.length ? a : b;
}

// ── v0.9.1491 (Brad: "add to my collection... takes 3-5 seconds"): these
// distinct lists (roadName is ~132k rows through regex filters) were
// rebuilt on EVERY wizard render — several times per open. Cached per
// masterData reference + wizard era; a changed reference (sync/reload)
// invalidates automatically. extraPredicate callers bypass the cache.
// In-place admin edits to masterData can serve a stale list until the
// next sync — acceptable for dropdown contents.
var _gmdCache = { ref: null, era: '', map: {} };
function getMasterDistinct(fieldName, extraPredicate) {
  try {
    if (typeof extraPredicate === 'function') return _getMasterDistinctUncached(fieldName, extraPredicate);
    var _gEra = (typeof wizard !== 'undefined' && wizard && wizard.data && wizard.data._era) || '';
    var _gRef = (window.state && state.masterData) || null;
    if (_gmdCache.ref !== _gRef || _gmdCache.era !== _gEra) { _gmdCache.ref = _gRef; _gmdCache.era = _gEra; _gmdCache.map = {}; }
    if (_gmdCache.map[fieldName]) return _gmdCache.map[fieldName];
    var _gT0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
    var _gOut = _getMasterDistinctUncached(fieldName);
    if (_gT0) { var _gMs = Math.round(performance.now() - _gT0); if (_gMs > 80) console.log('[perf] getMasterDistinct(' + fieldName + ') ' + _gMs + 'ms — now cached'); }
    _gmdCache.map[fieldName] = _gOut;
    return _gOut;
  } catch (eGmd) { return _getMasterDistinctUncached(fieldName, extraPredicate); }
}
function _getMasterDistinctUncached(fieldName, extraPredicate) {
  if (!window.state || !Array.isArray(state.masterData)) return [];
  // Session 115 fix: same era scope guard as updateItemSuggestions — so
  // dropdowns only surface Types / Roads that exist in the active era.
  var _eraTabSet = null;
  if (typeof wizard !== 'undefined' && wizard && wizard.data && wizard.data._era
      && window.ERA_TABS && ERA_TABS[wizard.data._era]) {
    _eraTabSet = new Set(Object.values(ERA_TABS[wizard.data._era]));
  }
  // For roadName we collect into a Map keyed by uppercase so case-insensitive
  // duplicates (LOUISVILLE & NASHVILLE vs Louisville & Nashville) collapse
  // to a single dropdown entry. For other fields we use a regular Set.
  var caseInsensitive = (fieldName === 'roadName');
  var bag = caseInsensitive ? new Map() : new Set();
  state.masterData.forEach(function(m) {
    if (_eraTabSet && m && m._tab && !_eraTabSet.has(m._tab)) return;
    if (fieldName === 'roadName' && m && m._tab && _NON_ROAD_TABS[m._tab]) return;
    var v = (m && m[fieldName]) ? String(m[fieldName]).trim() : '';
    if (!v) return;
    if (typeof extraPredicate === 'function' && !extraPredicate(m)) return;
    if (fieldName === 'roadName' && !_isLikelyRoadName(v)) return;
    if (caseInsensitive) {
      var key = v.toUpperCase();
      var prior = bag.get(key);
      bag.set(key, prior ? _preferredCasing(prior, v) : v);
    } else {
      bag.add(v);
    }
  });
  var out = caseInsensitive ? Array.from(bag.values()) : Array.from(bag);
  out.sort(function(a, b) { return a.localeCompare(b, undefined, { sensitivity: 'base' }); });
  var cfg = window.ITEM_SEARCH_FILTERS || {};
  if (cfg.maxOptions && out.length > cfg.maxOptions) out = out.slice(0, cfg.maxOptions);
  return out;
}
window.getMasterDistinct = getMasterDistinct;


function highlightSuggestion(idx) {
  _suggestionIndex = idx;
  const el = document.getElementById('wiz-suggestions');
  if (!el) return;
  // Selector updated: rows are now <div role="button"> so we can nest the
  // COTT ↗ anchor inside. Look up by dataset.idx to match the right rows.
  el.querySelectorAll('[data-idx]').forEach(function(btn, i) {
    btn.style.background = i === idx ? 'var(--surface2)' : 'transparent';
  });
}

// ── v0.9.2031 — the typed number against the rows it turned up ────────────
// The same number? The typed form and the catalog's may differ only by the
// dash before a letter suffix (2343-P / 2343P, 1076-L / 1076L — the forms
// wizardNext already treats as one). Anything else is a DIFFERENT number:
// 20-66238 is not 66238, however many digits they share.
// 2026-11-02: and a Modern Lionel product-line prefix — one digit and a dash
// in front ("6-31705", "7-11193") — is the same number as without it; the
// catalog writes both forms. Two or more digits in front (MTH 20-66238) or a
// dash later on (Postwar 6464-1) is a DIFFERENT number, as before.
function rrNumLinePrefixOff(t) { return String(t || '').replace(/^\d-(?=\d{2})/, ''); }
function rrNumSameAsTyped(rowNum, typed) {
  var a = String(rowNum || '').trim().toLowerCase(), b = String(typed || '').trim().toLowerCase();
  if (!a || !b) return false;
  if (a === b) return true;
  var k = function (v) { return rrNumLinePrefixOff(v).replace(/-(?=[a-z]+$)/, ''); };
  return k(a) === k(b);
}
// The maker word for a catalog row ("MTH", "RMT"), the way the badges say it.
function rrRowMakerWord(m) {
  var k = (typeof _manufacturerOfItem === 'function') ? (_manufacturerOfItem(m) || '') : '';
  if (!k && m && m._tab) {
    var _t = String(m._tab).trim();
    k = /^3rd/i.test(_t) ? '3rd rail' : _t.split(/\s+/)[0];   // "RMT O" → RMT
  }
  return (typeof _brandLabel === 'function') ? _brandLabel(k) : String(k || '');
}
// ── 2026-11-01 — THE MAKER · ERA TAG ([stated] Brad 05:35 CT: "add
// manufacturer - era to the line selection so we can see if the era or
// manufactuer matches what we think we are picking....but this needs to be
// small"). ONE helper builds the words for every place the tag is drawn — each
// suggestion row, the "ADDING No. …" banner and the step 2 card header — so the
// three can never disagree. The pieces come only from the existing deciders:
//   the maker  rrRowMakerWord (above)
//   the era    _wizPeriodOfRow (wizard.js → _itemEraPeriod, browse.js)
//   the scale  the row's own Gauge cell, else its catalog's (_wizScaleOfRow)
//   the rail   rrRowRailWord (the row's Track/Power cell)
// Lionel says its era (LIONEL · POSTWAR); another maker says its era when the
// row has a real Pre-War / Postwar one (A.C. GILBERT · POSTWAR), otherwise its
// scale and rail (ATLAS · O 3-RAIL, AMERICAN MODELS · S) — nearly all of them
// are Modern, so the era word would tell the collector nothing. Words and the
// separator: RR_ADD_FILTERS (config.js). Returned in capitals.
function rrRowTagWords(m) {
  if (!m) return '';
  var W = (typeof window !== 'undefined' && window.RR_ADD_FILTERS) || {};
  var eraW = W.eraWords || {};
  var maker = '';
  try { maker = String(rrRowMakerWord(m) || '').trim(); } catch (eM) {}
  var period = '';
  try { period = (typeof _wizPeriodOfRow === 'function') ? (_wizPeriodOfRow(m) || '') : ''; } catch (eP) {}
  var isLionel = maker.toLowerCase().replace(/[^a-z]/g, '') === 'lionel';
  var second = '';
  if (period && (isLionel || period !== 'modern')) second = eraW[period] || '';
  else {
    var sc = String(m.gauge || '').trim();
    if (!sc) { try { sc = (typeof _wizScaleOfRow === 'function') ? (_wizScaleOfRow(m) || '') : ''; } catch (eS) {} }
    second = [sc, rrRowRailWord(m)].filter(Boolean).join(' ');
    if (!second && period) second = eraW[period] || '';
  }
  return [maker, second].filter(Boolean).join(W.tagSep || ' · ').toUpperCase();
}
// The tag as a small chip — the SAME look wherever it is drawn. `cls` adds a
// placement class (the list's phone layout moves it under the number).
function rrRowTagHtml(m, cls) {
  var t = rrRowTagWords(m);
  if (!t) return '';
  var e = String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return '<span class="rr-row-tag' + (cls ? ' ' + cls : '') + '" data-row-tag="1" style="font-size:0.66rem;font-weight:700;'
    + 'letter-spacing:0.05em;color:var(--accent2);white-space:nowrap;flex-shrink:0;font-family:var(--font-body);font-style:normal">' + e + '</span>';
}
if (typeof window !== 'undefined') { window.rrRowTagWords = rrRowTagWords; window.rrRowTagHtml = rrRowTagHtml; }

// The words, from RR_ADD_TYPED (config.js) — never typed here.
function rrTypedWords(key, num, maker) {
  var w = (typeof window !== 'undefined' && window.RR_ADD_TYPED) || {};
  return String(w[key] || '').replace('{num}', num).replace('{maker}', maker || '');
}
if (typeof window !== 'undefined') { window.rrNumLinePrefixOff = rrNumLinePrefixOff; window.rrNumSameAsTyped = rrNumSameAsTyped; window.rrRowMakerWord = rrRowMakerWord; window.rrTypedWords = rrTypedWords; }

// opts.asTyped (v0.9.2031): the "Use N as typed" row — the number stands as
// typed, no catalog row behind it; wizardNext must not go hunting for one.
function selectSuggestion(num, roadName, itemType, opts) {
  wizard.data.itemNum = num;
  if (opts && opts.asTyped) {
    wizard.data._typedAsIs = String(num).trim().toLowerCase();
    wizard.matchedItem = null;
    delete wizard.data._suggestedRoadName;
    delete wizard.data._suggestedItemType;
  } else {
    delete wizard.data._typedAsIs;
    // 2026-11-01: a tapped catalog row is the add's ONE row from here on —
    // the banner, step 2, the save and the reference link all use it
    // (lookupItem keeps it while it fits the filters, which it does: the list
    // only ever offers rows that fit).
    if (opts && opts.row) wizard.matchedItem = opts.row;
  }
  if (roadName) wizard.data._suggestedRoadName = roadName;
  // Session 115: remember the itemType the user picked so downstream
  // steps (lookupItem match, variation picker) can scope their queries
  // to the right product. Without this, searching '773' and picking
  // the Steam Engine row dropped the user onto a variation list that
  // included the Accessory's fish-plate-set variations too.
  if (itemType) wizard.data._suggestedItemType = itemType;
  wizard.data._partialMatches = [];
  const inp = document.getElementById('wiz-input');
  if (inp) inp.value = num;
  const el = document.getElementById('wiz-suggestions');
  if (el) { el.style.display = 'none'; el.innerHTML = ''; }
  lookupItem(num);
  // v0.9.1431: a picked suggestion is the "as soon as we select an item #"
  // moment — refresh the You-have-this-item panel without waiting for Next.
  if (typeof _wizOwnedRefresh === 'function') _wizOwnedRefresh();

  // On itemNumGrouping screen: check if grouping buttons will appear
  const _curStep = wizard.steps[wizard.step];
  if (_curStep && _curStep.type === 'itemNumGrouping') {
    // Update grouping buttons first
    _updateGroupingButtons();
    // Session 115: the box-only checkbox now lives in the input row
    // (not in the grouping container), so only real grouping buttons
    // (engine/tender/diesel configs) should block auto-advance. Plain
    // items — freight, accessory, paper — auto-advance on suggestion tap
    // as before. If the user wanted box-only, they checked it before
    // tapping the row; that state is already persisted on wizard.data.
    const _grpEl = document.getElementById('wiz-grouping-btns');
    const _hasGroupingButtons = _grpEl && _grpEl.style.display !== 'none'
      && _grpEl.querySelector('button');
    if (_hasGroupingButtons) {
      // Stay on this screen — user needs to pick a grouping
      return;
    }
    // No grouping UI at all — set single and advance
    wizard.data._itemGrouping = 'single';
  } else if (_curStep && _curStep.type === 'entryMode') {
    // QE Step 1: update match display + sliders without advancing
    if (typeof window._qe1OnInput === 'function') window._qe1OnInput(num);
    return;
  }
  // Auto-advance to next step after a brief moment so lookupItem can render
  setTimeout(() => wizardNext(), 120);
}

// ── Mockup reference item number suggestions ──────────────────────────────
function updateMockupRefSuggestions(query) {
  const el = document.getElementById('wiz-suggestions');
  if (!el) return;
  const q = (query || '').trim().toLowerCase();
  if (q.length < 1) { el.style.display = 'none'; el.innerHTML = ''; return; }

  const seen = new Set();
  const candidates = [];
  state.masterData.forEach(m => {
    if (!m.itemNum.toLowerCase().includes(q)) return;
    if (!seen.has(m.itemNum)) {
      seen.add(m.itemNum);
      candidates.push({ num: m.itemNum, sub: (m.roadName || m.description || '').substring(0, 50) });
    }
  });

  candidates.sort((a, b) => {
    const aS = a.num.toLowerCase().startsWith(q);
    const bS = b.num.toLowerCase().startsWith(q);
    if (aS && !bS) return -1;
    if (!aS && bS) return 1;
    return a.num.localeCompare(b.num);
  });

  if (candidates.length === 0) { el.style.display = 'none'; el.innerHTML = ''; return; }

  _suggestionIndex = -1;
  el.innerHTML = '';
  const countBar = document.createElement('div');
  countBar.style.cssText = 'padding:0.3rem 0.75rem 0.4rem;font-size:0.72rem;color:var(--text-dim);border-bottom:1px solid var(--border);margin-bottom:2px';
  countBar.textContent = candidates.length + ' match' + (candidates.length !== 1 ? 'es' : '') + ' — tap to select';
  el.appendChild(countBar);

  candidates.forEach(function(c, i) {
    const btn = document.createElement('button');
    btn.dataset.idx = i;
    btn.style.cssText = 'text-align:left;width:100%;padding:0.65rem 0.75rem;border:none;background:transparent;border-radius:6px;cursor:pointer;color:var(--text);font-family:var(--font-body);display:flex;align-items:baseline;gap:0.5rem;min-height:44px';
    btn.onmouseenter = function() { highlightSuggestion(i); };
    btn.onclick = function() { selectMockupRef(c.num); };
    const numSpan = document.createElement('span');
    numSpan.style.cssText = 'font-family:var(--font-mono);font-weight:600;color:var(--accent2);font-size:0.95rem';
    numSpan.textContent = c.num;
    btn.appendChild(numSpan);
    if (c.sub) {
      const subSpan = document.createElement('span');
      subSpan.style.cssText = 'font-size:0.8rem;color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      subSpan.textContent = c.sub;
      btn.appendChild(subSpan);
    }
    el.appendChild(btn);
  });
  el.style.display = 'flex';
}

function selectMockupRef(num) {
  wizard.data.eph_itemNumRef = num;
  const inp = document.getElementById('wiz-input');
  if (inp) inp.value = num;
  const el = document.getElementById('wiz-suggestions');
  if (el) { el.style.display = 'none'; el.innerHTML = ''; }
}

function handleSuggestionKey(e) {
  const el = document.getElementById('wiz-suggestions');
  // Selector covers both legacy <button> rows (mockup ref picker) and the
  // new <div role="button"> rows in the main item suggestions list.
  const btns = el ? el.querySelectorAll('[data-idx]') : [];
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    highlightSuggestion(Math.min(_suggestionIndex + 1, btns.length - 1));
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    highlightSuggestion(Math.max(_suggestionIndex - 1, 0));
  } else if (e.key === 'Enter') {
    if (_suggestionIndex >= 0 && btns[_suggestionIndex]) {
      e.preventDefault();
      btns[_suggestionIndex].click();
    } else {
      // Brad request (Session 161+): if a master match already exists for
      // the typed value (item# was recognized in the catalog), Enter should
      // advance to the next wizard step. Still block Enter when the typed
      // value is non-numeric raw text with no master match (the original
      // guard prevented "nashville" from advancing as an itemNum).
      var _typed = (typeof wizard !== 'undefined' && wizard && wizard.data && wizard.data.itemNum) ? String(wizard.data.itemNum).trim() : '';
      var _hasMatch = typeof wizard !== 'undefined' && wizard && wizard.matchedItem;
      // Allow advance when we have a master match, OR the typed value looks
      // like an item number (alphanumeric+dash, not pure prose).
      var _looksLikeItemNum = /^[A-Za-z0-9][A-Za-z0-9\-]*$/.test(_typed) && _typed.length <= 12;
      if (_hasMatch || _looksLikeItemNum) {
        e.preventDefault();
        if (typeof wizardNext === 'function') wizardNext();
      } else {
        e.preventDefault();
      }
    }
  } else if (e.key === 'Escape') {
    if (el) { el.style.display = 'none'; }
  }
}

// ── 2026-11-01 — NOTHING FITS THE FILTERS ([stated] Brad 05:39 CT, wording
// agreed 05:41 CT). Three lines, words from RR_ADD_FILTERS (config.js):
//   1  "No 1511 found for Lionel · Postwar in our Master Catalog"
//      (no filter on: "No item found in our Master Catalog")
//   2  only with a filter on: "Clear filters?" + the button — and, when the
//      number IS in the catalog under another maker or era, a note saying so,
//      so nobody adds a catalog item by hand. The button clears the filters
//      and KEEPS the typed number (_clearAddFilters), so the list shows at once.
//   3  "Add manually?" + the button — the add switches to "Manual — item not
//      in our catalogs" carrying the number and the picked maker (_wizSetKind).
// No other maker's or era's item is shown or picked.
function _wizLooksLikeNumber(t) {
  t = String(t || '').trim();
  return !!t && /\d/.test(t) && !(typeof _rrIsWheelArrangement === 'function' && _rrIsWheelArrangement(t));
}
// The filters that are on, in the collector's own words ("Lionel · Postwar").
function _wizFiltersLabel(f) {
  var W = (typeof window !== 'undefined' && window.RR_ADD_FILTERS) || {};
  var eraW = W.eraFilterWords || {};
  f = f || ((typeof _wizAddFilters === 'function') ? _wizAddFilters() : {});
  return [f.mfr, f.period ? (eraW[f.period] || f.period) : '', f.type, f.scale, f.road]
    .filter(Boolean).join(W.filterSep || ' \u00B7 ');
}
// Is this number anywhere in the list a cleared filter would show?
function _wizNumberInCatalog(num) {
  var lc = String(num || '').trim().toLowerCase();
  if (!lc) return false;
  var hit = function (r) { return r && rrNumSameAsTyped(r.itemNum, lc); };   // 2026-11-02: any form of the number
  if ((state.masterData || []).some(hit)) return true;
  var _all = (typeof _allErasSearchCache !== 'undefined') ? _allErasSearchCache : null;
  if (_all && _all.some && _all.some(hit)) return true;
  // 2026-11-05: only then its leading-zero twin (01511 ↔ 1511)
  var twin = function (r) { return r && typeof rrNumZeroTwin === 'function' && rrNumZeroTwin(r.itemNum, lc); };
  return !!((state.masterData || []).some(twin) || (_all && _all.some && _all.some(twin)));
}
function _wizNothingFoundHtml(num) {
  var W = (typeof window !== 'undefined' && window.RR_ADD_FILTERS) || {};
  var esc = function (v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var fill = function (t) { return String(t || '').replace('{num}', num).replace('{filters}', _wizFiltersLabel()); };
  var on = (typeof _wizAnyAddFilter === 'function') && _wizAnyAddFilter();
  var btn = 'padding:0.3rem 0.7rem;font-size:0.8rem;background:var(--surface2);color:var(--text);border:1px solid var(--border);'
    + 'border-radius:7px;cursor:pointer;min-height:32px;font-family:var(--font-body);white-space:nowrap';
  var line = 'display:flex;align-items:center;flex-wrap:wrap;gap:0.4rem 0.6rem;margin-top:0.4rem';
  var h = '<div data-nothing-found="1" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.6rem 0.8rem;font-size:0.82rem;color:var(--text)">';
  h += '<div data-nf-line="none" style="font-weight:600">' + esc(fill(on ? W.noneFor : W.noneAtAll)) + '</div>';
  // 2026-11-01: the number IS a Lionel Postwar set the filters hide (Lars's
  // 1467W under Lionel · Pre-War) — say so, and offer the set (same carry)
  var setHit = (typeof _wizSetCheckOn === 'function' && _wizSetCheckOn())
    ? ((_wizPostwarSetHits(num, null, { exact: true, anyFilter: true }) || [])[0] || null) : null;
  if (setHit) {
    h += '<div data-nf-line="set" style="' + line + '"><span>' + esc(String(W.setAsk || '').replace('{num}', setHit.setNum)) + '</span>'
      + '<button type="button" data-nf-btn="set" data-set-num="' + esc(setHit.setNum) + '" onclick="_wizPickSetRow(this.getAttribute(\'data-set-num\'))" style="' + btn + '">' + esc(W.setBtn) + '</button></div>';
  }
  if (on) {
    var elsewhere = _wizNumberInCatalog(num);
    h += '<div data-nf-line="clear" style="' + line + '">'
      + (elsewhere ? '<span data-nf-elsewhere="1" style="color:var(--text-mid);flex-basis:100%">' + esc(fill(W.elsewhere)) + '</span>' : '')
      + '<span>' + esc(W.clearAsk) + '</span>'
      + '<button type="button" data-nf-btn="clear" onclick="_clearAddFilters()" style="' + btn + '">' + esc(W.clearBtn) + '</button></div>';
  }
  h += '<div data-nf-line="manual" style="' + line + '"><span>' + esc(W.manualAsk) + '</span>'
    + '<button type="button" data-nf-btn="manual" onclick="_wizSetKind(\'manual\')" style="' + btn + '">' + esc(W.manualBtn) + '</button></div>';
  return h + '</div>';
}
if (typeof window !== 'undefined') { window._wizNothingFoundHtml = _wizNothingFoundHtml; window._wizFiltersLabel = _wizFiltersLabel; window._wizNumberInCatalog = _wizNumberInCatalog; }

// ── 2026-11-01 — A LIONEL POSTWAR SET NUMBER TYPED IN THE ITEM BOX ([stated]
// Brad 16:11 CT: "no, he tried to enter a set as an item number" — Lars typed
// 1467W in Cataloged Item and got "No item found"; 16:12 / 16:25 CT "yes").
// Lionel's 472 Postwar cataloged sets live only in the set list
// (state.setData, "Lionel PW - Sets"), never in the catalog rows the item box
// searched. Now the item box asks the set list too:
//   - a set shows in the SAME list, one row per set number, with the SET tag
//     beside the maker · era tag, and its name · year · piece count
//   - choosing it switches to the set flow on that set (_wizPickSetRow →
//     _wizSetKind('set'), the same carry the number takes into Manual)
//   - nothing fits the filters but the number IS a Postwar set → the
//     nothing-found block adds "1467W is a Lionel Postwar set — add it as a set?"
// Every set answers to THE one filter test (_wizRowFitsFilters, wizard.js) as
// a catalog row would: rrSetAsRow describes it the way a row does — Lionel ·
// Postwar · Set · O — and nothing here compares a filter itself. Words:
// RR_ADD_FILTERS (config.js).
// A set from the set list, in the shape of a catalog row. ONE description of
// "a Postwar set is Lionel · Postwar" — the filter test and the tag read it.
function rrSetAsRow(s) {
  if (!s) return null;
  var tab = (typeof ERA_TABS !== 'undefined' && ERA_TABS.pw && ERA_TABS.pw.sets) || 'Lionel PW - Sets';
  return { itemNum: String(s.setNum || ''), itemType: 'Set', description: String(s.setName || ''),
           yearProd: String(s.year || ''), eraPeriod: 'postwar', _era: 'pw', _tab: tab, roadName: '', _set: s };
}
// The set's variants whose number IS this number (1467W = 1467w; a dash before
// a letter suffix is the same number, as everywhere on the Add screen).
function rrPostwarSetVariants(num) {
  var t = String(num || '').trim();
  if (!t) return [];
  return ((typeof state !== 'undefined' && state.setData) || []).filter(function (s) { return s && rrNumSameAsTyped(s.setNum, t); });
}
// Where the set check is asked: an add to the collection, on the item box —
// not a box-only add, a set member, an edit of an owned copy or "Fill in".
// Inbox adds are welcome: their photos ride along (_wizSetKind keeps them).
function _wizSetCheckOn() {
  var w = (typeof wizard !== 'undefined' && wizard) ? wizard : null;
  var d = (w && w.data) || {};
  return !!(w && w.tab === 'collection' && !d._setMode && !d._updatePdKey && !d.boxOnly && !d._fillItemMode && !d._manualEntry);
}
// The Postwar sets for a typed number token, one entry per set number, each
// answering to THE one filter test. opts.exact: the number IS the set's (the
// nothing-found line); otherwise a set number that STARTS with the token (the
// list, while typing — "1467" finds 1467W). opts.anyFilter: ask no filter
// (the nothing-found line's "is this a set at all").
// Returns null when the set list is not loaded yet — the caller fetches it
// (rrEnsurePostwarSets) and asks again; never a blank answer from load order.
function _wizPostwarSetHits(token, fset, opts) {
  opts = opts || {};
  var t = String(token || '').trim().toLowerCase();
  if (!t || !/\d/.test(t)) return [];
  var list = (typeof state !== 'undefined' && state.setData) || [];
  if (!list.length) return null;
  var groups = {}, order = [];
  list.forEach(function (s) {
    if (!s || !s.setNum) return;
    var n = String(s.setNum).trim();
    if (opts.exact ? !rrNumSameAsTyped(n, t) : n.toLowerCase().indexOf(t) !== 0) return;
    var row = rrSetAsRow(s);
    if (!opts.anyFilter && typeof _wizRowFitsFilters === 'function' && !_wizRowFitsFilters(row, fset)) return;
    if (!groups[n]) { groups[n] = { setNum: n, variants: [], row: row }; order.push(n); }
    groups[n].variants.push(s);
  });
  return order.map(function (n) { return groups[n]; });
}
// The words under a set's row: name · year(s) · piece count (· N versions).
function _wizSetRowDetails(g) {
  var W = (typeof window !== 'undefined' && window.RR_ADD_FILTERS) || {};
  var vs = (g && g.variants) || [];
  var name = '', years = [], counts = [];
  vs.forEach(function (s) {
    if (!name && s.setName) name = String(s.setName).trim();
    var y = String(s.year || '').trim(); if (y && years.indexOf(y) < 0) years.push(y);
    var c = (s.items || []).length; if (counts.indexOf(c) < 0) counts.push(c);
  });
  counts.sort(function (a, b) { return a - b; });
  var nTxt = counts.length > 1 ? (counts[0] + '–' + counts[counts.length - 1]) : String(counts[0] || 0);
  var pieces = (counts.length === 1 && counts[0] === 1) ? (W.setPieceOne || '') : String(W.setPieces || '').replace('{n}', nTxt);
  var parts = [name, years.join(', '), pieces];
  if (vs.length > 1) parts.push(String(W.setVersions || '').replace('{n}', vs.length));
  return parts.filter(Boolean).join(W.filterSep || ' · ');
}
// Chosen: the set flow, on that set. The number rides through the SAME carry
// v0.9.2092 gave Manual (_wizSetKind reads wizard.data.itemNum).
function _wizPickSetRow(setNum) {
  if (typeof wizard === 'undefined' || !wizard || !wizard.data) return;
  wizard.data.itemNum = String(setNum || '').trim();
  var el = document.getElementById('wiz-suggestions');
  if (el) { el.style.display = 'none'; el.innerHTML = ''; }
  _wizSetKind('set');
}
if (typeof window !== 'undefined') {
  window.rrSetAsRow = rrSetAsRow; window.rrPostwarSetVariants = rrPostwarSetVariants; window._wizSetCheckOn = _wizSetCheckOn;
  window._wizPostwarSetHits = _wizPostwarSetHits; window._wizSetRowDetails = _wizSetRowDetails; window._wizPickSetRow = _wizPickSetRow;
}

function debounceItemLookup(e) {
  clearTimeout(itemLookupTimer);
  itemLookupTimer = setTimeout(() => lookupItem(e.target.value), 400);
}

// ── 2026-11-01 — THE ROW FOR A TYPED NUMBER (Brad: "if there is no 1511 for
// lionel postwar, nothing shows up"). ONE picker, asked by the "Found" lookup
// (lookupItem), the "ADDING No. …" banner and Next — so the three can never
// hold different rows, and the row they hold is the row step 2, the save and
// the links use (wizard.matchedItem). The old lookups ended in escapes —
// "ignore period rather than fail", the unfiltered scorer, and finally the
// FIRST row with the number in load order — which is how Lionel · Postwar ·
// 1511 showed the Pre-War 1511 on step 1 and American Models' on step 2.
// Every candidate now passes THE one filter test (_wizRowFitsFilters,
// wizard.js); a number with no row inside the filters returns null.
// Order: the row the add already holds for this number (a tapped suggestion,
// the photo reader's answer), while it fits; the item type (and road) picked
// from the list (Session 115); the wizard's scorer (_wizPickMasterRow).
// opts.raw: the text IS the number, as typed (Next compares the whole box —
// "6-8359" stays "6-8359"); otherwise the number token is pulled out of a
// longer search ("lionel 1511" → 1511).
function _wizResolveAddRow(numText, opts) {
  var _num = (opts && opts.raw) ? String(numText || '')
    : ((typeof _extractSearchItemNum === 'function') ? _extractSearchItemNum(numText) : String(numText || ''));
  var numLC = String(_num || '').trim().toLowerCase();
  if (!numLC) return null;
  var d = (typeof wizard !== 'undefined' && wizard && wizard.data) ? wizard.data : {};
  var prefType = d._suggestedItemType ? String(d._suggestedItemType).trim() : '';
  var prefRoad = d._suggestedRoadName ? String(d._suggestedRoadName).trim() : '';
  var fset = (typeof _wizAddFilters === 'function') ? _wizAddFilters() : null;
  var fits = function (i) { return (typeof _wizRowFitsFilters === 'function') ? _wizRowFitsFilters(i, fset) : true; };
  var rows = ((typeof state !== 'undefined' && state.masterData) || []).filter(function (i) {
    return rrNumSameAsTyped(i.itemNum, numLC) && fits(i);   // 2026-11-02: 6-31705 = 31705
  });
  // 2026-11-05 (PLAN_2026-11-05_LEADING_ZEROS): no row IS the number — its
  // leading-zero twin may be (01511 typed, the catalog's 1511). Fallback only.
  if (!rows.length && typeof rrNumZeroTwin === 'function') {
    rows = ((typeof state !== 'undefined' && state.masterData) || []).filter(function (i) {
      return rrNumZeroTwin(i.itemNum, numLC) && fits(i);
    });
  }
  var cur = (typeof wizard !== 'undefined' && wizard) ? wizard.matchedItem : null;
  if (cur && rrNumSameAsTyped(cur.itemNum, numLC) && fits(cur)
      && (!prefType || String(cur.itemType || '').trim() === prefType)) return cur;
  if (!rows.length) return null;
  if (prefType) {
    var t = rows.find(function (i) { return String(i.itemType || '').trim() === prefType && (!prefRoad || String(i.roadName || '').trim() === prefRoad); })
         || rows.find(function (i) { return String(i.itemType || '').trim() === prefType; });
    if (t) return t;
  }
  return (typeof _wizPickMasterRow === 'function') ? (_wizPickMasterRow(numLC, rows) || null) : rows[0];
}
if (typeof window !== 'undefined') window._wizResolveAddRow = _wizResolveAddRow;

function lookupItem(num) {
  // Session 115: prefer the master row matching the itemType (and
  // roadName) the user picked from the suggestion list. The bare
  // `find(...itemNum === num)` would stop at whichever row came first
  // in iteration order — e.g., for item 773 that returned the
  // Accessory row even if the user had picked the Steam Engine.
  // Bug 9 (Session 154): match on the item-number token, not the full
  // descriptive string the user may have typed.
  const _searchNum = (typeof _extractSearchItemNum === 'function') ? _extractSearchItemNum(num) : num;
  // 2026-11-01: THE one row picker for this number (_wizResolveAddRow above).
  let match = _wizResolveAddRow(_searchNum);
  wizard.matchedItem = match || null;
  const el = document.getElementById('wiz-match');
  if (!el) return;
  const trimmed = _searchNum.trim();
  if (!trimmed) { el.innerHTML = ''; return; }

  if (wizard.tab === 'sold' || wizard.tab === 'forsale') {
    const _fsLabel = wizard.tab === 'forsale' ? 'For Sale' : 'Sold';
    const _fsColor = wizard.tab === 'forsale' ? '#e67e22' : 'var(--green)';
    // Sold/For Sale mode: check collection first, show what they own
    const collectionKeys = Object.keys(state.personalData).filter(k => {
      const pd = state.personalData[k];
      return pd.itemNum === trimmed && pd.owned;
    });
    const inCollection = collectionKeys.length > 0;
    if (inCollection) {
      const count = collectionKeys.length;
      el.innerHTML = `<div style="background:${_fsColor}15;border:1px solid ${_fsColor};border-radius:8px;padding:0.65rem 0.85rem;font-size:0.82rem">
        <span style="color:${_fsColor}">✓ Found in your collection</span> — ${count} item${count>1?'s':''} · select which one on the next step
      </div>`;
    } else {
      if (match) {
        el.innerHTML = `<div style="background:rgba(201,146,42,0.1);border:1px solid var(--accent2);border-radius:8px;padding:0.65rem 0.85rem;font-size:0.82rem">
          <span style="color:var(--accent2)">Not in your collection</span> · ${match.roadName || (typeof getTypeBucketLabel === 'function' ? getTypeBucketLabel(match) : match.itemType) || ''} · ${match.yearProd || ''}${((typeof rrCatalogStatusChip === 'function') && rrCatalogStatusChip(match, { block: true })) || '<br>'}
          <span style="color:var(--text-dim)">You can still enter details manually</span>
        </div>`;
      } else {
        el.innerHTML = `<div style="font-size:0.8rem;color:var(--text-dim)">Not found in collection or catalog — enter details manually</div>`;
      }
    }
  } else if (wizard.data.boxOnly) {
    // Box-only mode: show collection status
    const collectionKey = Object.keys(state.personalData).find(k => {
      const p = state.personalData[k];
      return p.itemNum === trimmed && p.owned;
    });
    const inCollection = !!collectionKey;
    const pd = inCollection ? state.personalData[collectionKey] : null;
    if (match) {
      el.innerHTML = `<div style="border-radius:8px;padding:0.65rem 0.85rem;font-size:0.82rem;
        background:rgba(46,204,113,0.1);border:1px solid var(--green)">
        <div><span style="color:var(--green)">✓ Found in catalog:</span> ${match.roadName || (typeof getTypeBucketLabel === 'function' ? getTypeBucketLabel(match) : match.itemType) || ''} · ${match.yearProd || ''}</div>${(typeof rrCatalogStatusChip === 'function') ? rrCatalogStatusChip(match, { block: true }) : ''}
        <div style="margin-top:0.4rem;padding-top:0.4rem;border-top:1px solid rgba(255,255,255,0.08)">
          ${inCollection
            ? `<span style="color:var(--green)">✓ In your collection</span> · Condition: ${pd.condition || '?'} · Has box: ${pd.hasBox || 'No'}`
            : `<span style="color:var(--accent2)">⚠ Box will be listed under Item Number ${trimmed}</span>`}
        </div>
      </div>`;
    } else {
      el.innerHTML = `<div style="background:rgba(201,146,42,0.1);border:1px solid var(--accent2);border-radius:8px;padding:0.65rem 0.85rem;font-size:0.82rem">
        <span style="color:var(--accent2)">⚠ Not found in catalog</span> — will save box info anyway
        ${inCollection ? '<br><span style="color:var(--green)">✓ Found in your collection</span>' : ''}
      </div>`;
    }
  } else {
    // Normal mode: show catalog match + check for a LOOSE box-only row.
    // v0.9.1984 (Brad's 3376: "why does it think i have a box for this
    // item?" — his 3376-BOX was already grouped with his first 3376): the
    // question is the one the save asks, findGroupingCandidates (wizard.js),
    // which skips a box already in a group. Asking it separately here (any
    // owned NNNN-BOX at all) let the screen promise a box the save would never
    // link. One rule, one place.
    const hasBoxOnlyRow = (typeof findGroupingCandidates === 'function')
      && findGroupingCandidates(Object.assign({}, wizard.data, { itemNum: trimmed, boxOnly: false }))
           .some(c => c.type === 'box');

    if (match) {
      // Session 115 fix: don't duplicate itemType when it already served as
      // the roadName fallback. Build the header parts, skip blanks, skip
      // same-string repeats.
      var _mInfoParts = [];
      if (match.roadName) _mInfoParts.push(match.roadName);
      if (match.yearProd) _mInfoParts.push(match.yearProd);
      if (match.itemType && match.itemType !== match.roadName) _mInfoParts.push((typeof getTypeBucketLabel === 'function') ? getTypeBucketLabel(match) : match.itemType);
      var _mInfo = _mInfoParts.join(' \u00B7 ') || '(no details)';
      el.innerHTML = `<div style="background:rgba(46,204,113,0.1);border:1px solid var(--green);border-radius:8px;padding:0.65rem 0.85rem;font-size:0.82rem">
        <span style="color:var(--green)">✓ Found:</span> ${_mInfo}${(typeof rrCatalogStatusChip === 'function') ? rrCatalogStatusChip(match, { block: true }) : ''}
        ${match.variation ? '<br><span style="color:var(--text-dim)">Note: multiple variations exist — select on next step</span>' : ''}
        ${hasBoxOnlyRow ? `<div style="margin-top:0.5rem;padding-top:0.5rem;border-top:1px solid rgba(255,255,255,0.08)">
          <span style="color:var(--accent2)">📦 A box for this item is already in your collection.</span>
          <label style="display:flex;align-items:center;gap:0.5rem;margin-top:0.4rem;cursor:pointer;font-size:0.82rem;color:var(--text-mid)">
            <input type="checkbox" id="wiz-group-box" checked onchange="wizard.data._groupWithExistingBox=this.checked" style="width:16px;height:16px;cursor:pointer">
            Group this item with the existing box
          </label>
        </div>` : ''}
      </div>`;
    } else {
      // 2026-11-01: when the list under the box is already saying "No 1511
      // found …" (_wizNothingFoundHtml), this line stays empty — one message.
      var _sgNF = document.getElementById('wiz-suggestions');
      _sgNF = !!(_sgNF && _sgNF.style.display !== 'none' && _sgNF.querySelector('[data-nothing-found]'));
      el.innerHTML = (typeof _catalogReady === 'function' && !_catalogReady())
        ? `<div style="font-size:0.8rem;color:#e0a800">⏳ Loading your catalog — one moment…</div>`
        : (_sgNF ? '' : `<div style="font-size:0.8rem;color:var(--text-dim)">Not found in master inventory — will save anyway</div>`);
    }
  }
}

// ── Wizard storage-location autocomplete ─────────────────────────
// (Used when the optional "Track Storage Location" preference is on)

function _filterLocSuggestions(query) {
  const sugBox = document.getElementById('wiz-loc-suggestions');
  if (!sugBox) return;
  if (!query || query.length < 1) { sugBox.style.display = 'none'; return; }
  const _allLocs = {};
  Object.values(state.personalData).forEach(pd => {
    if (pd.location && pd.location.trim()) {
      const loc = pd.location.trim();
      _allLocs[loc] = (_allLocs[loc] || 0) + 1;
    }
  });
  const q = query.toLowerCase();
  const matches = Object.entries(_allLocs)
    .filter(([loc]) => loc.toLowerCase().includes(q) && loc.toLowerCase() !== q)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  if (matches.length === 0) { sugBox.style.display = 'none'; return; }
  sugBox.style.display = 'block';
  sugBox.innerHTML = matches.map(([loc, count]) =>
    `<div onclick="_selectLocSuggestion('${loc.replace(/'/g, "\\'")}')"
      style="padding:0.55rem 0.85rem;cursor:pointer;font-size:0.88rem;color:var(--text);
      border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center"
      onmouseover="this.style.background='var(--surface3)'" onmouseout="this.style.background=''">
      <span>${loc}</span><span style="font-size:0.72rem;color:var(--text-dim)">${count} items</span>
    </div>`
  ).join('');
}
function _selectLocSuggestion(loc) {
  const inp = document.getElementById('wiz-loc-input');
  if (inp) { inp.value = loc; }
  wizard.data.location = loc;
  const sugBox = document.getElementById('wiz-loc-suggestions');
  if (sugBox) sugBox.style.display = 'none';
  _highlightLocChipByValue(loc);
}
function _highlightLocChip(el) {
  document.querySelectorAll('#wiz-loc-chips .loc-chip').forEach(c => {
    c.style.background = 'var(--surface2)'; c.style.color = 'var(--text)'; c.style.borderColor = 'var(--border)';
  });
  el.style.background = 'var(--accent)'; el.style.color = '#fff'; el.style.borderColor = 'var(--accent)';
}
function _highlightLocChipByValue(loc) {
  document.querySelectorAll('#wiz-loc-chips .loc-chip').forEach(c => {
    const chipLoc = c.textContent.replace(/\s*\(\d+\)\s*$/, '').trim();
    if (chipLoc === loc) {
      c.style.background = 'var(--accent)'; c.style.color = '#fff'; c.style.borderColor = 'var(--accent)';
    } else {
      c.style.background = 'var(--surface2)'; c.style.color = 'var(--text)'; c.style.borderColor = 'var(--border)';
    }
  });
}


// ── Wizard inline Storage Location picker: dropdown + quick-add ──
function _wizLocSavedList() {
  return (typeof _getSavedLocations === 'function') ? _getSavedLocations() : [];
}
function _wizLocEsc(v) {
  return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function _wizLocOptionsHtml(selectedVal) {
  var locs = _wizLocSavedList();
  var sel = (selectedVal == null) ? '' : String(selectedVal);
  var html = '<option value="">— Select location —</option>';
  var typeOrder = (typeof LOCATION_TYPES !== 'undefined') ? LOCATION_TYPES.slice() : ['Tote','Shelf','Room','Building','Storage Unit','Display Case','Other'];
  var groups = {}, names = [];
  locs.forEach(function(l) {
    if (!l || !l.name) return;
    names.push(l.name);
    var t = l.type || 'Other';
    (groups[t] = groups[t] || []).push(l.name);
  });
  Object.keys(groups).forEach(function(t) { if (typeOrder.indexOf(t) < 0) typeOrder.push(t); });
  typeOrder.forEach(function(t) {
    var arr = groups[t]; if (!arr || !arr.length) return;
    html += '<optgroup label="' + _wizLocEsc(t) + '">';
    arr.forEach(function(n) { html += '<option value="' + _wizLocEsc(n) + '"' + (n === sel ? ' selected' : '') + '>' + _wizLocEsc(n) + '</option>'; });
    html += '</optgroup>';
  });
  if (sel && names.indexOf(sel) < 0) {
    html += '<option value="' + _wizLocEsc(sel) + '" selected>' + _wizLocEsc(sel) + ' (current)</option>';
  }
  return html;
}
function _wizLocationFieldHtml(currentVal) {
  return '<div style="font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.3rem">📍 Storage Location</div>'
    + '<div style="display:flex;gap:0.4rem;align-items:center">'
    + '<select id="wiz-loc-select" onchange="_wizLocSelect(this)" style="flex:1;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.6rem 0.6rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none;box-sizing:border-box">'
    + _wizLocOptionsHtml(currentVal)
    + '</select>'
    + '<button type="button" id="wiz-loc-newbtn" onclick="_wizLocToggleAdd(true)" style="white-space:nowrap;padding:0.55rem 0.7rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.82rem;cursor:pointer">+ New</button>'
    + '</div>'
    + '<div id="wiz-loc-addrow" style="display:none;gap:0.4rem;margin-top:0.4rem">'
    + '<input type="text" id="wiz-loc-newinput" placeholder="New location name" autocomplete="off" onkeydown="if(event.key===\'Enter\'){event.preventDefault();_wizLocAddNew();}" style="flex:1;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:0.55rem 0.7rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none;box-sizing:border-box">'
    + '<button type="button" onclick="_wizLocAddNew()" style="white-space:nowrap;padding:0.55rem 0.8rem;border-radius:8px;border:none;background:var(--accent);color:var(--on-accent);font-family:var(--font-body);font-size:0.82rem;font-weight:700;cursor:pointer">Add</button>'
    + '</div>';
}
function _wizLocSelect(sel) {
  if (typeof wizard !== 'undefined' && wizard && wizard.data) wizard.data.location = sel.value || '';
}
function _wizLocToggleAdd(show) {
  var row = document.getElementById('wiz-loc-addrow');
  var btn = document.getElementById('wiz-loc-newbtn');
  if (row) row.style.display = show ? 'flex' : 'none';
  if (btn) btn.style.display = show ? 'none' : '';
  if (show) { var i = document.getElementById('wiz-loc-newinput'); if (i) i.focus(); }
}
function _wizLocAddNew() {
  var input = document.getElementById('wiz-loc-newinput');
  if (!input) return;
  var name = (input.value || '').trim();
  if (!name) { input.focus(); return; }
  if (typeof _getSavedLocations === 'function' && typeof _setSavedLocations === 'function') {
    var locs = _getSavedLocations();
    if (!locs.some(function(l) { return (l.name || '').toLowerCase() === name.toLowerCase(); })) {
      locs.push({ name: name, type: 'Other' });
      _setSavedLocations(locs);
    }
  }
  if (typeof wizard !== 'undefined' && wizard && wizard.data) wizard.data.location = name;
  var sel = document.getElementById('wiz-loc-select');
  if (sel) sel.innerHTML = _wizLocOptionsHtml(name);
  input.value = '';
  _wizLocToggleAdd(false);
  if (typeof showToast === 'function') showToast('Added ' + name);
}

// rosstab (2026-11-05): the maker a catalog row belongs to, for the Add list's
// one-row-per-maker rule — the SAME answer the row's maker tag and the Maker
// filter give (rrRowMakerWord: the row's own Manufacturer cell, else its
// catalog's maker), folded to letters and digits so "3rd Rail" = "3rd rail".
function _sgMakerOfRow(m) {
  try {
    var w = (typeof rrRowMakerWord === 'function') ? rrRowMakerWord(m) : ((m && m.manufacturer) || '');
    return String(w || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  } catch (x) { return ''; }
}
if (typeof window !== 'undefined') window._sgMakerOfRow = _sgMakerOfRow;
