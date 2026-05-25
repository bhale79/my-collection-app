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
      return `<span style="font-family:var(--font-mono);font-size:0.68rem;padding:1px 5px;border-radius:4px;border:1px solid ${isMatch ? 'var(--accent)' : 'var(--border)'};background:${isMatch ? 'rgba(240,80,8,0.15)' : 'var(--surface)'};color:${isMatch ? 'var(--accent)' : 'var(--text-dim)'};font-weight:${isMatch ? '700' : '400'}">${n}</span>`;
    }).join('');
    const altChips = s.alts.length ? s.alts.map(n =>
      `<span style="font-family:var(--font-mono);font-size:0.68rem;padding:1px 5px;border-radius:4px;border:1px solid rgba(230,126,34,0.4);background:var(--surface);color:#e67e22;font-style:italic" title="Alternate">${n}</span>`
    ).join('') : '';

    row.innerHTML = `
      <div style="display:flex;align-items:center;gap:0.5rem;width:100%">
        <span style="font-family:var(--font-mono);font-size:0.88rem;font-weight:700;color:var(--accent)">${s.setNum}</span>
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

// Bug 9 (Session 154): pull the item-number token out of a longer query
// like "MTH Premier 20-93699" or "Lionel 736 berkshire" so the lookup
// matches on the number, not the whole descriptive string. Returns the
// first token with 2+ digits or a digit-hyphen-digit shape; else the
// first token (legacy behavior for pure text searches).
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
  var _WHEEL = /^\d{1,2}(?:-\d{1,2}){2,}$/;
  for (var i = 0; i < toks.length; i++) {
    var t = toks[i];
    if (_WHEEL.test(t)) continue;
    if (/\d{2,}/.test(t) || /\d-\d/.test(t)) return t;
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
        candidates.push({ num: pd.itemNum, label: key, sub: '' });
      }
    });
  } else {
    // Collection + Want: search master list by item number OR description/road name
    // Detect search mode: if query starts with a digit, prioritize item number matching
    // Bug 9 (Session 154): extract the item-number token from anywhere in
    // the query (handles "MTH Premier 20-93699"), and treat manufacturer/
    // line words as non-filtering context.
    const _searchNum = _extractSearchItemNum(q);
    const startsWithDigit = /\d{2,}/.test(_searchNum) || /\d-\d/.test(_searchNum);
    const qParts = q.split(/\s+/);
    const numPart = _searchNum;
    const _stopWords = new Set((window.ITEM_SEARCH_FILTERS && window.ITEM_SEARCH_FILTERS.searchStopWords) || []);
    const keyParts = qParts.filter(p => p && p !== _searchNum && !_stopWords.has(p));
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
    var _MFR_WORDS = { lionel:'Lionel', atlas:'Atlas', mth:'MTH', weaver:'Weaver', rmt:'RMT', williams:'Williams', marx:'Marx', menards:'Menards', bachmann:'Bachmann', kline:'K-Line', 'k-line':'K-Line' };
    var _PERIOD_WORDS = { prewar:'prewar', 'pre-war':'prewar', postwar:'postwar', 'post-war':'postwar', modern:'modern' };
    var _typedMfr = '', _typedPeriod = '';
    qParts.forEach(function(p){ if (_MFR_WORDS[p]) _typedMfr = _MFR_WORDS[p]; if (_PERIOD_WORDS[p]) _typedPeriod = _PERIOD_WORDS[p]; });
    var _effMfr = _filterMfr || _typedMfr;   // dropdown filter wins, else typed word
    var _effPeriod = _filterPeriod || _typedPeriod;   // Session 176: Era dropdown wins, else typed period word
    var _searchParts = qParts.filter(function(p){ return p && !_stopWords.has(p) && !_MFR_WORDS[p] && !_PERIOD_WORDS[p]; });
    function _periodOfRow(m){
      var e = (m && m._era) || '';
      if (e === 'prewar') return 'prewar';
      if (e === 'pw' || e === 'pw_ho') return 'postwar';
      // Session 176: any other tagged era (mpc/modern + ALL non-Lionel makers —
      // Atlas, MTH, Weaver, RMT, etc.) counts as Modern.
      if (e) return 'modern';
      var y = parseInt(String((m && m.yearProd) || '').slice(0,4), 10);
      if (y) { if (y <= 1942) return 'prewar'; if (y <= 1969) return 'postwar'; return 'modern'; }
      return '';
    }

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
      if (_filterType) {
        var _bucketLabel = (typeof getTypeBucketLabel === 'function') ? getTypeBucketLabel(m) : String(m.itemType || '').trim();
        if (_bucketLabel !== _filterType) return;
      }
      if (_filterRoad && String(m.roadName || '').trim() !== _filterRoad) return;
      if (_effMfr) {
        // Session 171: derive manufacturer robustly (handles rows without _era).
        var _mMfr = (typeof _manufacturerOfItem === 'function') ? (_manufacturerOfItem(m) || '') : '';
        if (!_mMfr && typeof ERAS !== 'undefined' && ERAS[m._era]) _mMfr = ERAS[m._era].manufacturer || '';
        if (!_mMfr && m._tab) {
          var _tl = String(m._tab).toLowerCase();
          if (_tl.indexOf('lionel') === 0) _mMfr = 'Lionel';
          else if (_tl.indexOf('atlas') === 0) _mMfr = 'Atlas';
          else if (_tl.indexOf('mth') === 0) _mMfr = 'MTH';
          else if (_tl.indexOf('weaver') === 0) _mMfr = 'Weaver';
          else if (_tl.indexOf('rmt') === 0) _mMfr = 'RMT';
        }
        // Session 173: case-insensitive — _manufacturerOfItem returns lowercase
        // ('lionel') while typed/dropdown values are capitalized ('Lionel').
        if (String(_mMfr).toLowerCase() !== String(_effMfr).toLowerCase()) return;
      }
      if (_effPeriod && _periodOfRow(m) !== _effPeriod) return;
      if (_filterScale) {
        var _mScale = (typeof ERA_SCALE !== 'undefined' && ERA_SCALE[m._era]) || '';
        if (_mScale !== _filterScale) return;
      }

      const haystack = ((m.roadName || '') + ' ' + (m.description || '') + ' ' + (m.varDesc || '') + ' ' + (m.itemType || '')).toLowerCase();

      let matches = false;
      if (startsWithDigit) {
        // Number-led search: item number must match first token; extra words filter by description
        if (!m.itemNum.toLowerCase().includes(numPart)) return;
        if (keyParts.length > 0 && !keyParts.every(kp => haystack.includes(kp))) return;
        matches = true;
      } else {
        // Text-only search: match anywhere in road name, description, or item type
        matches = _searchParts.length > 0 ? _searchParts.every(kp => haystack.includes(kp)) : !!(_effMfr || _effPeriod || _filterType || _filterRoad || _filterScale);
      }

      if (!matches) return;

      // Dedup key fields come from config so variations with different
      // subType/varDesc/etc don't collapse into a single row (was hiding
      // real differences on rows that looked identical).
      var _dedupFields = (window.ITEM_SEARCH_FILTERS && window.ITEM_SEARCH_FILTERS.dedupKeyFields)
        || ['itemNum', 'roadName'];
      var _dedupeKey = _dedupFields.map(function(f) { return (m[f] || ''); }).join('|');
      if (!seen.has(_dedupeKey)) {
        seen.add(_dedupeKey);
        const road = m.roadName || '';
        candidates.push({
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
    if (candidates.length === 0 && (q.length >= 1 || _anyDropFilter) && _eraScoped
        && wizard.data && wizard.data._era && wizard.data._era !== 'all'
        && tab !== 'sold' && tab !== 'forsale') {
      var _allData = (typeof _allErasSearchCache !== 'undefined') ? _allErasSearchCache : null;
      if (_allData && _allData.length) {
        seen = new Set();
        candidates = [];
        _scanRows(_allData, false);
      } else if (typeof _getAllErasMasterForSearch === 'function') {
        _getAllErasMasterForSearch().then(function() {
          var _inp = document.getElementById('wiz-input');
          if (_inp && String(_inp.value || '').trim().toLowerCase() === q) updateItemSuggestions(_inp.value);
        }).catch(function() {});
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

  if (candidates.length === 0) { el.style.display = 'none'; el.innerHTML = ''; return; }

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

  candidates.forEach(function(c, i) {
    // Outer row is a column flex so we get a visual line-1 (item# + road
    // + reference link) over a line-2 (details). Role="button" lets us
    // nest a real <a> for the reference link without invalid HTML.
    const row = document.createElement('div');
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');
    row.dataset.idx = i;
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
    row.onmouseenter = function() { highlightSuggestion(i); };
    row.dataset.roadName = c.roadName || '';
    row.onclick = function() { selectSuggestion(c.num, c.roadName || '', c.itemType || ''); };
    row.onkeydown = function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectSuggestion(c.num, c.roadName || '', c.itemType || ''); }
    };

    // ── Line 1 ── item# · road name · reference link (far right)
    const line1 = document.createElement('div');
    line1.style.cssText = 'display:flex;align-items:baseline;gap:0.5rem;width:100%;min-width:0';

    const numSpan = document.createElement('span');
    numSpan.style.cssText = 'font-family:var(--font-mono);font-weight:600;color:var(--accent2);font-size:0.95rem;flex-shrink:0';
    numSpan.textContent = c.num;
    line1.appendChild(numSpan);

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

    // Session 158: compact rail-type chip (3-Rail / 2-Rail) so multi-rail
    // catalogs (Weaver/Atlas/MTH) are distinguishable at a glance — the two
    // rows for one model (e.g. Weaver 1016-L 3-rail vs 1016-S 2-rail) look
    // identical otherwise. Derived from the track/power field; absent for
    // Lionel (field blank) so those rows stay clean.
    var _railLabel = '';
    if (c.trackPower) {
      var _railMatch = String(c.trackPower).match(/(\d)\s*-?\s*rail/i);
      if (_railMatch) _railLabel = _railMatch[1] + '-Rail';
    }
    if (_railLabel) {
      const railSpan = document.createElement('span');
      railSpan.style.cssText = 'font-size:0.7rem;font-weight:700;letter-spacing:0.04em;'
        + 'color:var(--accent2);background:rgba(201,146,42,0.10);border:1px solid rgba(201,146,42,0.35);'
        + 'padding:0.1rem 0.4rem;border-radius:4px;flex-shrink:0;white-space:nowrap';
      railSpan.textContent = _railLabel;
      line1.appendChild(railSpan);
    }

    // Session 156: road name suppressed from Step 1 list — variations
    // get chosen on the next wizard step. Spacer keeps the reference
    // link pinned right.
    const spacer = document.createElement('span');
    spacer.style.cssText = 'flex:1;min-width:0';
    line1.appendChild(spacer);

    // Reference link — Atlas ↗ / COTT ↗ / View ↗ per URL.
    if (c.refLink) {
      const refA = document.createElement('a');
      refA.href = c.refLink;
      refA.target = '_blank';
      refA.rel = 'noopener';
      refA.textContent = _resolveRefLabel(c.refLink);
      refA.onclick = function(ev) { ev.stopPropagation(); };
      refA.style.cssText = 'font-size:0.72rem;color:var(--accent2);text-decoration:none;'
        + 'padding:0.2rem 0.5rem;border:1px solid rgba(201,146,42,0.35);border-radius:6px;'
        + 'background:rgba(201,146,42,0.08);flex-shrink:0;white-space:nowrap;font-weight:600';
      line1.appendChild(refA);
    }
    row.appendChild(line1);

    // ── Line 2 ── disambiguator (subType · varDesc · description, etc.)
    var _detailsParts = _rowFields
      .map(function(f) { return (c[f] || '').toString().trim(); })
      .filter(function(v) { return v.length > 0; });
    var _details = _detailsParts.join(_rowSep);
    if (_details.length > _rowMaxLen) _details = _details.substring(0, _rowMaxLen - 1) + '\u2026';
    if (_details) {
      const line2 = document.createElement('div');
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

    el.appendChild(row);
  });
  el.style.display = 'flex';
}

// Distinct non-blank values of a master-row field, for populating the
// Type / Road dropdowns on the search step.  Uses state.masterData which
// is already scoped to the currently-active era, so results are era-aware
// automatically. Caller passes 'itemType' or 'roadName'.
function getMasterDistinct(fieldName, extraPredicate) {
  var set = new Set();
  if (!window.state || !Array.isArray(state.masterData)) return [];
  // Session 115 fix: same era scope guard as updateItemSuggestions — so
  // dropdowns only surface Types / Roads that exist in the active era.
  var _eraTabSet = null;
  if (typeof wizard !== 'undefined' && wizard && wizard.data && wizard.data._era
      && window.ERA_TABS && ERA_TABS[wizard.data._era]) {
    _eraTabSet = new Set(Object.values(ERA_TABS[wizard.data._era]));
  }
  state.masterData.forEach(function(m) {
    if (_eraTabSet && m && m._tab && !_eraTabSet.has(m._tab)) return;
    var v = (m && m[fieldName]) ? String(m[fieldName]).trim() : '';
    if (!v) return;
    if (typeof extraPredicate === 'function' && !extraPredicate(m)) return;
    set.add(v);
  });
  var out = Array.from(set);
  out.sort(function(a, b) { return a.localeCompare(b); });
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

function selectSuggestion(num, roadName, itemType) {
  wizard.data.itemNum = num;
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
      // Enter without a highlighted row used to call wizardNext() — which
      // advanced the wizard with whatever raw text was typed (e.g.
      // "nashville") as the item number. Block that. To advance, the user
      // must either tap a suggestion or arrow-down then Enter.
      e.preventDefault();
    }
  } else if (e.key === 'Escape') {
    if (el) { el.style.display = 'none'; }
  }
}

function debounceItemLookup(e) {
  clearTimeout(itemLookupTimer);
  itemLookupTimer = setTimeout(() => lookupItem(e.target.value), 400);
}

function lookupItem(num) {
  // Session 115: prefer the master row matching the itemType (and
  // roadName) the user picked from the suggestion list. The bare
  // `find(...itemNum === num)` would stop at whichever row came first
  // in iteration order — e.g., for item 773 that returned the
  // Accessory row even if the user had picked the Steam Engine.
  // Bug 9 (Session 154): match on the item-number token, not the full
  // descriptive string the user may have typed.
  const _searchNum = (typeof _extractSearchItemNum === 'function') ? _extractSearchItemNum(num) : num;
  const _numLC = _searchNum.trim().toLowerCase();
  const _d = (typeof wizard !== 'undefined' && wizard && wizard.data) ? wizard.data : null;
  const _prefType = _d && _d._suggestedItemType ? String(_d._suggestedItemType).trim() : '';
  const _prefRoad = _d && _d._suggestedRoadName ? String(_d._suggestedRoadName).trim() : '';
  let match = null;
  if (_prefType) {
    match = state.masterData.find(i =>
      i.itemNum.toLowerCase() === _numLC &&
      String(i.itemType || '').trim() === _prefType &&
      (!_prefRoad || String(i.roadName || '').trim() === _prefRoad)
    );
    // Fallback: type match alone if road-filtered version doesn't hit
    if (!match) {
      match = state.masterData.find(i =>
        i.itemNum.toLowerCase() === _numLC &&
        String(i.itemType || '').trim() === _prefType
      );
    }
  }
  if (!match) match = state.masterData.find(i => i.itemNum.toLowerCase() === _numLC);
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
          <span style="color:var(--accent2)">Not in your collection</span> · ${match.roadName || (typeof getTypeBucketLabel === 'function' ? getTypeBucketLabel(match) : match.itemType) || ''} · ${match.yearProd || ''}<br>
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
        <div><span style="color:var(--green)">✓ Found in catalog:</span> ${match.roadName || (typeof getTypeBucketLabel === 'function' ? getTypeBucketLabel(match) : match.itemType) || ''} · ${match.yearProd || ''}</div>
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
    // Normal mode: show catalog match + check for existing box-only row
    const boxOnlyKeys = Object.keys(state.personalData).filter(k => {
      const pd = state.personalData[k];
      return pd.itemNum === trimmed + '-BOX' && pd.owned;
    });
    const hasBoxOnlyRow = boxOnlyKeys.length > 0;

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
        <span style="color:var(--green)">✓ Found:</span> ${_mInfo}
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
      el.innerHTML = `<div style="font-size:0.8rem;color:var(--text-dim)">Not found in master inventory — will save anyway</div>`;
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
