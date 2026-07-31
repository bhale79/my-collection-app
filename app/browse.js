// ── Era-aware browse tab visibility ──
// Session 159 Phase 2d: when the cache has no inventoryId to disambiguate
// duplicates, badge only the FIRST owned copy (lowest sheet row). Matches the
// historical "first match wins" behavior so only one copy lights up.
function _isFirstOwnedCopyByRow(itemNum, variation, pdRow) {
  if (!state.personalData) return false;
  var lowest = null;
  var v = variation || '';
  Object.values(state.personalData).forEach(function(p) {
    if (!p || !p.owned) return;
    if (p.itemNum !== itemNum) return;
    if ((p.variation || '') !== v) return;
    if (lowest === null || (p.row && p.row < lowest)) lowest = p.row;
  });
  return lowest !== null && pdRow === lowest;
}

function _updateBrowseTabsForEra() {
  // Sync era dropdown on browse page
  var _esel = document.getElementById('era-select');
  if (_esel && _esel.value !== _currentEra) _esel.value = _currentEra;
  // Tabs only shown for eras that have them
  var _pwOnly = ['sets','science','construction','paper','other','service','is'];
  _pwOnly.forEach(function(t) {
    var btn = document.getElementById('btab-' + t);
    if (btn) btn.style.display = SHEET_TABS[t === 'service' ? 'serviceTools' : t === 'is' ? 'instrSheets' : t] ? '' : 'none';
  });
  // Catalogs: always show if era has catalogs tab
  var catBtn = document.getElementById('btab-catalogs');
  if (catBtn) catBtn.style.display = SHEET_TABS.catalogs ? '' : 'none';
  // Always show items
  var itemsBtn = document.getElementById('btab-items');
  if (itemsBtn) itemsBtn.style.display = '';
  // If current visible tab is hidden, switch to items
  var activeTab = document.querySelector('[id^="btab-"][style*="border-bottom: 2px solid var(--accent)"], [id^="btab-"][style*="border-bottom:2px solid var(--accent)"]');
  if (activeTab && activeTab.style.display === 'none') {
    renderBrowseTab('items');
  }
  // Refresh table headers for the current era (Atlas vs Lionel layouts differ)
  if (typeof _refreshBrowseHeaders === 'function' && !state.filters.owned) {
    _refreshBrowseHeaders();
  }
}


// Phase 5 Step 3a follow-up: manufacturer badge for the first column of each
// master-browse row. Uses _manufacturerOfItem (from app.js, Session 137) +
// WHAT_I_COLLECT.MANUFACTURERS color/label. Returns a full <td>...</td>.
// v0.9.815: scroll helpers for the My Collection section jump bar. The table
// scrolls inside .browse-table-wrap and the thead is sticky, so offset past it.
window._collJumpTo = function(id) {
  var el = document.getElementById(id);
  var wrap = document.querySelector('.browse-table-wrap');
  if (!el || !wrap) return;
  var top = el.offsetTop - 44;
  wrap.scrollTo({ top: top < 0 ? 0 : top, behavior: 'smooth' });
};
window._collJumpTop = function() {
  var wrap = document.querySelector('.browse-table-wrap');
  if (wrap) wrap.scrollTo({ top: 0, behavior: 'smooth' });
};
// v0.9.985 (Brad): the Jump To bar is now a section FILTER — "Trains" shows
// only train rows, "Catalogs" only catalogs, and so on ('all' = combined view).
window._collSectionSet = function(key) {
  state._collSection = key;
  state.currentPage = 1;
  var wrap = document.querySelector('.browse-table-wrap');
  if (wrap) wrap.scrollTo({ top: 0 });
  if (typeof renderBrowse === 'function') renderBrowse();
};

function _mfrBadge(item) {
  try {
    var mfr = '';
    if (typeof _manufacturerOfItem === 'function') {
      mfr = _manufacturerOfItem(item) || '';
    }
    // Fallback: master-catalog items carry _tab (e.g. 'Lionel PW - Items',
    // 'Atlas O', 'MTH O') but not always a usable era field. Parse _tab.
    if (!mfr && item && item._tab) {
      var t = String(item._tab).toLowerCase();
      if (t.indexOf('lionel') === 0)      mfr = 'lionel';
      else if (t.indexOf('atlas') === 0)  mfr = 'atlas';
      else if (t.indexOf('mth') === 0)    mfr = 'mth';
    }
    if (!mfr) return '<td><span style="color:var(--text-dim);font-size:0.7rem">—</span></td>';
    var WIC = (typeof window !== 'undefined' && window.WHAT_I_COLLECT) || {};
    var mc = (WIC.MANUFACTURERS && WIC.MANUFACTURERS[mfr.toLowerCase()]) || null;
    var lbl = (mc && mc.label) || mfr;
    var col = (mc && mc.color) || 'var(--text-dim)';
    return '<td><span style="display:inline-block;padding:0.13rem 0.5rem;'
         + 'border-radius:10px;background:' + col + ';color:#fff;'
         + 'font-size:0.62rem;font-weight:700;letter-spacing:0.06em;'
         + 'text-transform:uppercase;white-space:nowrap;line-height:1.2">'
         + lbl + '</span></td>';
  } catch(e) { return '<td><span style="color:var(--text-dim);font-size:0.7rem">—</span></td>'; }
}

// ── My Collection: sortable table header (Session 162+) ──
// Columns: Mfr | Item # | Var. | Type | Description | Est. Worth | Actions.
// Clicking a header sorts by it; clicking again flips direction.
var _COLL_COLS = [
  { col: 'mfr',   label: 'Mfr.' },
  { col: 'num',   label: 'Item #' },
  { col: 'var',   label: 'Var.', noSort: true },
  { col: 'type',  label: 'Type' },
  { col: 'photo', label: 'Photo', noSort: true },   // v0.9.909 (Brad, item [4]): desktop thumbnail column
  { col: 'desc',  label: 'Description' },
  { col: 'worth', label: 'Est. Worth' },
  { col: 'added', label: 'Date Added' },   // v0.9.719/726 (Brad): sortable, AFTER Est. Worth
];
// ── Selection gutter (v0.9.1007, Brad) ──────────────────────────────────
// In share mode the checkbox used to live inside the ITEM # cell, sharing it
// with the number, the era badge, the group link and the status icons — the
// one control you actually need was the least visible thing in the row.
// It now gets its own column at the far left, so the eye runs straight down
// a single gutter. Shown ONLY in share mode; the normal view keeps no empty
// column.
//
// EVERY span below is computed from _COLL_COLS, never typed. A hardcoded
// column count is what left the ephemera rows one cell short of the header
// from v0.9.909 until v0.9.985 — same table, same mistake, don't repeat it.
function _collGutterOn() {
  // Owned view only. The catalog (non-owned) list renders through some of the
  // same row templates but has its OWN header with no gutter — without this
  // clause a spacer could land there and shift every column one to the right.
  var _owned = !!(typeof state !== 'undefined' && state.filters && state.filters.owned);
  return _owned && typeof isShareMode === 'function' && isShareMode('collection');
}
function _collColSpan() {
  return _COLL_COLS.length + 1 /* Actions */ + (_collGutterOn() ? 1 : 0);
}
function _collGutterTh() {
  return _collGutterOn()
    ? '<th style="width:40px;text-align:center;padding-left:0.5rem" aria-label="Select"></th>' : '';
}
function _collGutterTd(key, checked) {
  if (!_collGutterOn()) return '';
  return '<td style="width:40px;text-align:center;vertical-align:middle;padding-left:0.5rem">'
    + '<input type="checkbox" id="share-cb-' + key + '"' + (checked ? ' checked' : '')
    + ' onclick="event.stopPropagation();toggleShareItem(\'' + key + '\')"'
    + ' style="width:1.15rem;height:1.15rem;accent-color:#2ecc71;cursor:pointer">'
    + '</td>';
}
// A row that spans the whole table (dividers, empty states) but carries no
// checkbox still needs the gutter to exist, or every cell shifts left.
function _collGutterSpacerTd() {
  return _collGutterOn() ? '<td style="width:40px"></td>' : '';
}

function _renderCollectionHeader() {
  var thead = document.querySelector('#page-browse .item-table thead tr');
  if (!thead) return;
  var cs = state._collSort || {};
  var html = _COLL_COLS.map(function(c) {
    var align = (c.col === 'worth' || c.col === 'var' || c.col === 'added' || c.col === 'photo') ? 'text-align:center;' : '';   // v0.9.727 (Brad): centered
    if (c.col === 'photo') { return '<th style="white-space:nowrap;' + align + 'width:52px">' + c.label + '</th>'; }   // v0.9.909 (Brad, item [4])
    if (c.noSort) { return '<th style="white-space:nowrap;' + align + '">' + c.label + '</th>'; }
    var arrow = (cs.col === c.col) ? (cs.dir === 'desc' ? ' \u25BC' : ' \u25B2') : '';
    var _wsp = (c.col === 'worth') ? 'white-space:normal;' : 'white-space:nowrap;';
    if (c.col === 'added') _wsp += 'width:80px;';   // v0.9.725/726: fitted column
    // v0.9.938 (Brad): Description soaks up all spare width; Item # is locked
    // at a fixed width so it never shifts; every other column fits its value.
    if (c.col === 'desc') _wsp = 'white-space:normal;width:99%;';
    if (c.col === 'num')  _wsp += 'width:110px;min-width:110px;';
    return '<th onclick="_collSortBy(\'' + c.col + '\')" style="cursor:pointer;' + _wsp + align + '" title="Sort by ' + c.label + '">' + c.label + arrow + '</th>';
  }).join('');
  html += '<th style="text-align:right;white-space:nowrap">Actions</th>';
  thead.innerHTML = _collGutterTh() + html;   // v0.9.1007: selection gutter
}
function _collSortBy(col) {
  var cs = state._collSort;
  if (cs && cs.col === col) { cs.dir = (cs.dir === 'asc') ? 'desc' : 'asc'; }
  else { state._collSort = { col: col, dir: 'asc' }; }
  _renderCollectionHeader();
  if (typeof renderBrowse === 'function') renderBrowse();
}
if (typeof window !== 'undefined') { window._renderCollectionHeader = _renderCollectionHeader; window._collSortBy = _collSortBy; }

// ── Era-aware master catalog table headers ──
// Lionel eras use Road/Variation columns; Atlas uses Sub Type/Track-Power/MSRP;
// MTH (Session 129) uses Road/Description/Category/Track-Power to surface the
// Premier vs RailKing product-line distinction and rail configuration.
function _atlasBrowseHeaders() {
  return '<th>Mfr.</th><th style="width:110px;min-width:110px">Item #</th><th>Type</th><th>Sub Type</th><th style="width:99%">Description</th><th>Track/Power</th><th>MSRP</th><th>Year</th><th>Owned</th>';
}
function _lionelBrowseHeaders() {
  // v0.9.985 (Brad): Descr. no longer hogs ALL spare width (was 99%) — Var.
  // Descr. now gets a real share, so it widens with the window instead of
  // wrapping into a skinny 3-line column on big screens.
  return '<th>Mfr.</th><th style="width:110px;min-width:110px">Item #</th><th>Type</th><th>Road / Name</th><th style="width:60%">Descr.</th><th>Var.</th><th style="width:39%;min-width:140px">Var. Descr.</th><th>Year</th><th>Owned</th>';
}
function _mthBrowseHeaders() {
  return '<th>Mfr.</th><th style="width:110px;min-width:110px">Item #</th><th>Type</th><th>Road / Name</th><th style="width:99%">Descr.</th><th>Category</th><th>Track/Power</th><th>Year</th><th>Owned</th>';
}
function _refreshBrowseHeaders() {
  var thead = document.querySelector('#page-browse .item-table thead tr');
  if (!thead) return;
  var era = (typeof _currentEra !== 'undefined') ? _currentEra : '';
  if (era === 'atlas') {
    thead.innerHTML = _atlasBrowseHeaders();
  } else if (era.indexOf('mth_') === 0) {
    thead.innerHTML = _mthBrowseHeaders();
  } else {
    thead.innerHTML = _lionelBrowseHeaders();
  }
}

// ── Phase 5 Step 1: hierarchy chip row (visual preview) ──
// Renders a chip row above the era-bar showing the new filter hierarchy:
// Manufacturer > Scale > Era > Section. Clicking a chip opens a picker that
// updates state and re-renders the chips — but no filtering is wired up yet.
// State lives in localStorage so it survives reloads. Step 2 will wire this
// up to actually filter the master list and remove the old era-select + tab
// strip. For Step 1 this exists only to let Brad eyeball the hierarchy shape.

// S151: time-period era model. Each item maps to one of three periods
// based on its production year. Falls back to internal era key for items
// missing yearProd (catalog refs, sets, etc.).
var _ERA_PERIODS = ['prewar', 'postwar', 'modern'];
var _ERA_PERIOD_LABELS = {
  any:     'Any Era',
  prewar:  'Pre-war (before 1944)',
  postwar: 'Postwar (1945–1969)',
  modern:  'Modern (1970–today)',
};
// Internal era key -> time period (used as fallback when item has no yearProd).
//
// v0.9.1158 — EVERY era whose production window sits inside ONE period must
// appear here. An era that is missing gets period `null`, and a null period is
// excluded from every period chip — so those rows were reachable only under
// "Any Era", in no other filter combination. Measured against Brad's live
// catalog before this fix: 4,709 rows unclassifiable, of which
//   USA Trains 2,198 · LGB 1,608 · Menards 316 · RMT 298 · Atlas HO/N 131
// were makers that only ever produced in one period. All now mapped (4,551 rows
// recovered). The remaining 158 are Other O Brands — see below.
//
// DELIBERATELY ABSENT, do not "complete" these:
//   marx     — Marx O ran 1930-1975, which spans all three periods.
//   other_o  — the long tail (AMT 1950s, KMT, Industrial Rail 1990s, Bowser)
//              is several makers from several periods under one tab.
//   all      — the meta-era, not a real one.
// Those fall through to the yearProd / yearMade parse above, which is the only
// honest answer for a row whose era genuinely spans periods.
var _ERA_KEY_TO_PERIOD = {
  prewar:       'prewar',
  pw:           'postwar',
  pw_ho:        'postwar',
  mpc:          'modern',
  mpc_ho:       'modern',
  mod_ho:       'modern',
  mod_s:        'modern',
  atlas:        'modern',
  // Atlas HO / N / Z — same maker, same catalog, same crawl as Atlas O above.
  atlas_ho:     'modern',
  atlas_n:      'modern',
  atlas_z:      'modern',
  mth_o:        'modern',
  mth_ho:       'modern',
  mth_s:        'modern',
  mth_tinplate: 'modern',
  mth_g:        'modern',
  weaver:       'modern',
  rmt:          'modern',   // RMT (Ready Made Trains), late 1990s onward
  menards:      'modern',   // Menards store brand, 2014 onward
  kline:        'modern',   // K-Line 1975-2006 (see ERAS)
  williams:     'modern',   // Williams Reproductions, 1971 onward
  thirdrail:    'modern',   // 3rd Rail / Sunset Models brass, 1990s onward
  usatrains:    'modern',   // USA Trains, 1988 onward
  lgb:          'modern',   // LGB, 1968 onward — effectively all post-1970
};
function _itemEraPeriod(item) {
  if (!item) return null;
  // Step 1a: parse first 4-digit year from yearProd. Handles '1955',
  // '1957-1966', 'October 2005', etc.
  var y = item.yearProd;
  if (y) {
    var m = String(y).match(/(\d{4})/);
    if (m) {
      var yr = parseInt(m[1], 10);
      if (yr && yr < 1944)               return 'prewar';
      if (yr && yr >= 1945 && yr <= 1969) return 'postwar';
      if (yr && yr >= 1970)               return 'modern';
    }
  }
  // Step 1b (S153): yearMade (user-entered on personal row, or matched
  // master row that includes it). Same regex parse.
  var ym = item.yearMade;
  if (ym) {
    var m2 = String(ym).match(/(\d{4})/);
    if (m2) {
      var yr2 = parseInt(m2[1], 10);
      if (yr2 && yr2 < 1944)               return 'prewar';
      if (yr2 && yr2 >= 1945 && yr2 <= 1969) return 'postwar';
      if (yr2 && yr2 >= 1970)               return 'modern';
    }
  }
  // Step 2: fall back to internal era key.
  var eraKey = item._era || item.era;
  if (eraKey && _ERA_KEY_TO_PERIOD[eraKey]) return _ERA_KEY_TO_PERIOD[eraKey];
  // Step 3: try _tab → era via reverse ERA_TABS lookup.
  if (item._tab && typeof ERA_TABS !== 'undefined') {
    for (var ek in ERA_TABS) {
      var tabs = ERA_TABS[ek] || {};
      for (var sk in tabs) {
        if (tabs[sk] === item._tab) return _ERA_KEY_TO_PERIOD[ek] || null;
      }
    }
  }
  return null;
}
if (typeof window !== 'undefined') window._itemEraPeriod = _itemEraPeriod;

function _phState() {
  try {
    var raw = localStorage.getItem('lv_browse_filter_state');
    if (raw) {
      var st = JSON.parse(raw);
      // S151: migrate legacy era keys to time periods.
      // 'pw'/'pw_ho' → 'postwar'; everything else internal → 'modern'.
      // 'prewar' stays as-is (also the period name). 'all' → 'any'.
      if (st && st.era && st.era !== 'any' && st.era !== 'prewar'
          && st.era !== 'postwar' && st.era !== 'modern') {
        if (st.era === 'all') st.era = 'any';
        else if (st.era === 'pw' || st.era === 'pw_ho') st.era = 'postwar';
        else st.era = 'modern';
      }
      return st;
    }
  } catch(e) {}
  // Step 3b default: Any/Any/Any/Items.
  return { manufacturer: 'any', scale: 'any', era: 'any', section: 'items' };
}
function _phSave(st) {
  try { localStorage.setItem('lv_browse_filter_state', JSON.stringify(st)); } catch(e) {}
}

// Manufacturer + scale -> list of era keys. Pre-War (null scale = mixed) is
// shown under O and Standard for now — Phase 3 will split it into per-scale
// tabs, at which point this fallback can go away.
function _phErasFor(mfr, scale) {
  // S151: era is now a time period independent of mfr/scale. Always three.
  // Items with no matching mfr+scale in a given period just show empty results.
  return _ERA_PERIODS.slice();
}

// Manufacturer -> list of scale ids that have at least one era available.
function _phScalesFor(mfr) {
  // Step 3b: mfr='any' -> all scales across all manufacturers.
  var WIC = (typeof window !== 'undefined' && window.WHAT_I_COLLECT) || {};
  var SCs = WIC.SCALES || {};
  if (mfr === 'any') return Object.keys(SCs);
  var out = [];
  Object.keys(SCs).forEach(function(sid) {
    if (_phErasFor(mfr, sid).length > 0) out.push(sid);
  });
  return out;
}

// Section keys that exist as browseable tabs (boxes / companions are sheets but not tabs).
var _PH_NON_TAB_SECTIONS = { boxes: 1, companions: 1 };

// S151: era can be a time period (prewar/postwar/modern) or 'any'. Return
// the union of sections across internal eras that fall in that period.
//
// v0.9.1158 — DERIVED, no longer hand-written. This was a second copy of
// _ERA_KEY_TO_PERIOD, inverted, and the two had already drifted apart: the map
// above knew about Atlas O and Weaver while this one had never heard of Menards,
// RMT, 3rd Rail, K-Line, Williams, USA Trains, LGB or Atlas HO/N/Z. Two tables
// that must agree, maintained by hand, will always drift — so this one is now
// computed from the other (project rule 3: one source of truth). Adding an era
// above is now the whole job.
var _PERIOD_TO_INTERNAL_ERAS = (function () {
  var inv = { prewar: [], postwar: [], modern: [] };
  Object.keys(_ERA_KEY_TO_PERIOD).forEach(function (k) {
    var p = _ERA_KEY_TO_PERIOD[k];
    if (inv[p]) inv[p].push(k);
  });
  return inv;
})();
function _phSectionsFor(era) {
  if (typeof ERA_TABS !== 'object' || !ERA_TABS) return ['items'];
  // Period value: union across all internal eras in that period.
  if (_PERIOD_TO_INTERNAL_ERAS[era]) {
    var seen = {};
    _PERIOD_TO_INTERNAL_ERAS[era].forEach(function(k) {
      if (ERA_TABS[k]) Object.keys(ERA_TABS[k]).forEach(function(s) {
        if (!_PH_NON_TAB_SECTIONS[s]) seen[s] = 1;
      });
    });
    return Object.keys(seen);
  }
  // 'any' or fallback: union across ALL real eras.
  var seen2 = {};
  Object.keys(ERA_TABS).forEach(function(k) {
    if (k === 'all') return;
    Object.keys(ERA_TABS[k] || {}).forEach(function(s) {
      if (!_PH_NON_TAB_SECTIONS[s]) seen2[s] = 1;
    });
  });
  return Object.keys(seen2).length ? Object.keys(seen2) : ['items'];
}

// ERA_TABS section key <-> browse-tab DOM id key.
var _PH_SECTION_TO_TAB = {
  items: 'items', sets: 'sets', catalogs: 'catalogs',
  science: 'science', construction: 'construction', paper: 'paper',
  other: 'other', serviceTools: 'service', instrSheets: 'is',
};
var _PH_TAB_TO_SECTION = {
  items: 'items', sets: 'sets', catalogs: 'catalogs',
  science: 'science', construction: 'construction', paper: 'paper',
  other: 'other', service: 'serviceTools', is: 'instrSheets',
};

function _phLabelFor(level, id) {
  var WIC = (typeof window !== 'undefined' && window.WHAT_I_COLLECT) || {};
  // Step 3b: 'any' is the explicit wildcard. Each level has its own label.
  if (id === 'any') {
    if (level === 'manufacturer') return 'Any Manufacturer';
    if (level === 'scale')        return 'Any Scale';
    if (level === 'era')          return 'Any Era';
  }
  if (level === 'manufacturer') return (WIC.MANUFACTURERS && WIC.MANUFACTURERS[id] && WIC.MANUFACTURERS[id].label) || id;
  if (level === 'scale')        return (WIC.SCALES && WIC.SCALES[id] && WIC.SCALES[id].label) || id;
  if (level === 'era')          return _ERA_PERIOD_LABELS[id] || id;
  if (level === 'section')      return id ? (id.charAt(0).toUpperCase() + id.slice(1)) : 'Items';
  return id;
}

function _renderHierarchyChips() {
  var host = document.getElementById('hierarchy-chips');
  if (!host) return;
  var st = _phState();
  // Step 2: sync chip state to live _currentEra + active browse tab so the
  // chip row reflects whatever the old dropdown / tab strip is showing.
  // 'all' meta-era stays as-is (no single mfr/scale/era maps to it).
  try {
    if (typeof _currentEra !== 'undefined' && _currentEra && _currentEra !== 'all'
        && typeof ERAS !== 'undefined' && ERAS[_currentEra]) {
      var WIC = (typeof window !== 'undefined' && window.WHAT_I_COLLECT) || {};
      var ETS = WIC.ERA_TO_SCALE || {};
      var liveMfr = (ERAS[_currentEra].manufacturer || '').toLowerCase();
      var liveScale = ETS[_currentEra];
      if (liveMfr) st.manufacturer = liveMfr;
      if (liveScale) st.scale = liveScale;
      // mixed-scale (null) keeps prior scale chip value
      st.era = _currentEra;
    }
    if (typeof state !== 'undefined' && state && state._browseTab) {
      var tabSec = _PH_TAB_TO_SECTION[state._browseTab] || state._browseTab;
      st.section = tabSec;
    }
    _phSave(st);
  } catch(e) {}
  var chipStyle = 'padding:0.22rem 0.55rem;border-radius:14px;border:1.5px solid var(--border);'
                + 'background:var(--bg-card);color:var(--text);font-family:var(--font-body);'
                + 'font-size:0.78rem;font-weight:600;cursor:pointer;display:inline-flex;'
                + 'align-items:center;gap:0.25rem;line-height:1';
  var chipStyleActive = 'padding:0.22rem 0.55rem;border-radius:14px;border:1.5px solid var(--accent);'
                + 'background:var(--accent);color:var(--on-accent);font-family:var(--font-body);'
                + 'font-size:0.78rem;font-weight:600;cursor:pointer;display:inline-flex;'
                + 'align-items:center;gap:0.25rem;line-height:1';
  var _chipIsActive = function(label){ return !(label === 'Items' || label === 'All Types' || String(label).indexOf('Any ') === 0); };
  var sepStyle  = 'color:var(--text-dim);font-weight:700;opacity:0.45;font-size:0.95rem';
  var labelStyle = 'font-size:0.62rem;font-weight:700;letter-spacing:0.09em;'
                 + 'text-transform:uppercase;color:var(--text-dim);margin-right:0.15rem';
  var noteStyle = 'margin-left:auto;font-size:0.68rem;color:var(--text-dim);font-style:italic';
  var levels = ['manufacturer','scale','era','section'];
  var html = '<span class="ph-label" style="' + labelStyle + '">Filters</span>';
  // v0.9.649 (Brad): small clear-all box at the left of the chips.
  html += '<button type="button" class="ph-clear" title="Clear all filters" '
       +  'style="padding:0.28rem 0.5rem;border-radius:8px;border:1.5px solid var(--border);'
       +  'background:var(--bg-card);color:var(--text-dim);font-size:0.72rem;font-weight:700;'
       +  'cursor:pointer;line-height:1" onclick="_clearHierarchyFilters()">\u2715</button>';
  levels.forEach(function(level, i) {
    var lbl = _phLabelFor(level, st[level]);
    if (i > 0) html += '<span class="ph-sep" style="' + sepStyle + '">›</span>';
    html += '<button type="button" style="' + (_chipIsActive(lbl) ? chipStyleActive : chipStyle) + '" '
         +  'onclick="_openLevelPicker(\'' + level + '\')">'
         +  lbl + ' ▾</button>';
  });
  // S149 follow-up: Type filter rendered as a 5th chip when Section = Items.
  // Source of truth stays the hidden #filter-type <select>; the chip reads
  // and writes that element so populateFilters/applyFilters keep working.
  if (st.section === 'items') {
    var _ftSel = document.getElementById('filter-type');
    var _tVal  = _ftSel ? _ftSel.value : '';
    var _tLbl  = _tVal || 'All Types';
    html += '<span class="ph-sep" style="' + sepStyle + '">›</span>';
    html += '<button type="button" style="' + (_chipIsActive(_tLbl) ? chipStyleActive : chipStyle) + '" '
         +  'onclick="_openLevelPicker(\'type\')">'
         +  _tLbl + ' ▾</button>';
  }
  host.innerHTML = html;
}

// v0.9.649 (Brad): one-tap reset of the whole filter hierarchy.
function _clearHierarchyFilters() {
  var st = _phState();
  st.manufacturer = 'any'; st.scale = 'any'; st.era = 'any'; st.section = 'items';
  _phSave(st);
  var _ftSel = document.getElementById('filter-type');
  if (_ftSel) _ftSel.value = '';
  // Reuse the normal choice flow for its era-switch + re-render side effects.
  _setHierarchyChoice('manufacturer', 'any');
}
if (typeof window !== 'undefined') window._clearHierarchyFilters = _clearHierarchyFilters;

function _openLevelPicker(level) {
  var st = _phState();
  var options = [];
  var WIC = (typeof window !== 'undefined' && window.WHAT_I_COLLECT) || {};
  if (level === 'manufacturer') {
    // Step 3b: 'Any Manufacturer' first.
    options.push({ id: 'any', label: 'Any Manufacturer' });
    var MFs = WIC.MANUFACTURERS || {};
    Object.keys(MFs).forEach(function(k) { options.push({ id: k, label: MFs[k].label }); });
  } else if (level === 'scale') {
    options.push({ id: 'any', label: 'Any Scale' });
    _phScalesFor(st.manufacturer).forEach(function(sid) {
      options.push({ id: sid, label: _phLabelFor('scale', sid) });
    });
  } else if (level === 'era') {
    options.push({ id: 'any', label: 'Any Era' });
    _phErasFor(st.manufacturer, st.scale).forEach(function(eid) {
      options.push({ id: eid, label: _phLabelFor('era', eid) });
    });
  } else if (level === 'section') {
    _phSectionsFor(st.era).forEach(function(s) {
      options.push({ id: s, label: _phLabelFor('section', s) });
    });
  } else if (level === 'type') {
    // Pull options from the live #filter-type <select>. populateFilters()
    // refreshes that select per-era, so we always get the current bucket set.
    var _ftSel = document.getElementById('filter-type');
    if (_ftSel) {
      for (var oi = 0; oi < _ftSel.options.length; oi++) {
        var o = _ftSel.options[oi];
        var lblText = o.textContent || o.value || '';
        options.push({ id: o.value, label: lblText });
      }
    }
  }
  if (!options.length) options.push({ id: '', label: '(none available)' });

  var overlayId = 'ph-picker-overlay';
  var existing = document.getElementById(overlayId);
  if (existing) existing.remove();
  var overlay = document.createElement('div');
  overlay.id = overlayId;
  // Session 160: bumped overlay opacity from 0.7 to 0.92 so underlying
  // page text doesn't bleed through and make the modal hard to read.
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9999;'
                       + 'display:flex;align-items:center;justify-content:center;padding:1rem';
  bindOverlayClose(overlay, function() { overlay.remove(); });
  var modal = document.createElement('div');
  modal.style.cssText = 'background:var(--bg-card);border-radius:12px;padding:1.1rem;'
                     + 'max-width:340px;width:100%;max-height:80vh;overflow:auto;'
                     + 'border:1px solid var(--border);box-shadow:0 12px 36px rgba(0,0,0,0.5)';
  var head = level.charAt(0).toUpperCase() + level.slice(1);
  var heading = document.createElement('div');
  heading.style.cssText = 'font-weight:700;font-size:0.95rem;margin-bottom:0.55rem';
  heading.textContent = 'Pick ' + head;
  modal.appendChild(heading);
  options.forEach(function(opt) {
    var isCur = (st[level] === opt.id);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.style.cssText = 'display:block;width:100%;text-align:left;'
                     + 'padding:0.55rem 0.7rem;margin-bottom:0.28rem;border-radius:6px;'
                     + 'border:1.5px solid ' + (isCur ? 'var(--accent)' : 'var(--border)') + ';'
                     + 'background:' + (isCur ? 'rgba(232,64,28,0.08)' : 'var(--bg-card)') + ';'
                     + 'color:var(--text);cursor:pointer;font-family:var(--font-body);'
                     + 'font-size:0.85rem;font-weight:' + (isCur ? '700' : '500');
    btn.textContent = opt.label + (isCur ? '   ✓' : '');
    btn.onclick = function() { _setHierarchyChoice(level, opt.id); overlay.remove(); };
    modal.appendChild(btn);
  });
  var close = document.createElement('button');
  close.type = 'button';
  close.style.cssText = 'margin-top:0.55rem;width:100%;padding:0.45rem;border-radius:6px;'
                     + 'border:1.5px solid var(--border);background:none;color:var(--text-dim);'
                     + 'cursor:pointer;font-family:var(--font-body);font-size:0.8rem';
  close.textContent = 'Cancel';
  close.onclick = function() { overlay.remove(); };
  modal.appendChild(close);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  if (window.BackStack && BackStack.wire) BackStack.wire(overlay); // v0.9.807 TODO-012: device Back closes this pop-up
}

function _setHierarchyChoice(level, value) {
  // S149 follow-up: type chip writes to the hidden #filter-type select
  // and reuses the existing applyFilters() flow. Doesn't persist to chip state.
  if (level === 'type') {
    var _ftSel = document.getElementById('filter-type');
    if (_ftSel) {
      _ftSel.value = value || '';
      if (typeof applyFilters === 'function') applyFilters();
    }
    if (typeof _renderHierarchyChips === 'function') _renderHierarchyChips();
    return;
  }
  var st = _phState();
  st[level] = value;
  // Step 3b: cascade behavior
  //   * Picking 'any' at any level: no cascade reset. Keep other levels.
  //   * Picking specific value: only reset descendants if they're now invalid.
  if (level === 'manufacturer' && value !== 'any') {
    if (st.scale !== 'any' && _phScalesFor(value).indexOf(st.scale) < 0) st.scale = 'any';
    if (st.era !== 'any' && _phErasFor(value, st.scale).indexOf(st.era) < 0) st.era = 'any';
  } else if (level === 'scale' && value !== 'any') {
    if (st.era !== 'any' && _phErasFor(st.manufacturer, value).indexOf(st.era) < 0) st.era = 'any';
  } else if (level === 'era' && value !== 'any') {
    var se3 = _phSectionsFor(value);
    if (se3.indexOf(st.section) < 0) st.section = se3[0] || 'items';
  }
  _phSave(st);

  // S151: era is always a period (prewar/postwar/modern) or 'any' — both
  // span multiple internal eras, so targetEra is always 'all' meta-era.
  var targetEra = 'all';
  var needEra = (typeof _currentEra === 'undefined' || _currentEra !== targetEra);
  var doSection = function() {
    if (!st.section) return;
    var tab = _PH_SECTION_TO_TAB[st.section] || st.section;
    if (typeof renderBrowseTab === 'function'
        && typeof state !== 'undefined' && state._browseTab !== tab) {
      try { renderBrowseTab(tab); } catch(e) {}
    } else if (typeof renderBrowse === 'function') {
      // Same tab but chip state changed (e.g. mfr filter) — re-render.
      renderBrowse();
    }
  };
  if (needEra && targetEra && typeof switchEra === 'function') {
    var p = switchEra(targetEra);
    if (p && typeof p.then === 'function') {
      p.then(doSection, doSection);
    } else {
      doSection();
    }
  } else {
    doSection();
    _renderHierarchyChips();
  }
}

// Expose for inline onclick handlers
if (typeof window !== 'undefined' && !document.getElementById('_spin-kf-style')) {
  var _spinSty = document.createElement('style');
  _spinSty.id = '_spin-kf-style';
  _spinSty.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(_spinSty);
}
if (typeof window !== 'undefined') {
  window._openLevelPicker      = _openLevelPicker;
  window._renderHierarchyChips = _renderHierarchyChips;
  window._setHierarchyChoice   = _setHierarchyChoice;
}

// S151: small 'X of Y eras loaded' indicator next to result-count, shown
// while loadAllErasMode background refresh is in flight. Updated by app.js
// after each era's master fetch completes.
function _renderAllLoadingIndicator() {
  var le = state.loading && state.loading.allEras;
  var ind = document.getElementById('all-loading-indicator');
  if (!le || !le.refreshing) {
    if (ind && ind.parentNode) ind.parentNode.removeChild(ind);
    return;
  }
  if (!ind) {
    var rc = document.getElementById('result-count');
    if (!rc) return;
    ind = document.createElement('span');
    ind.id = 'all-loading-indicator';
    ind.style.cssText = 'margin-left:0.4rem;color:var(--accent);font-style:italic;'
                     + 'font-size:0.78rem;display:inline-flex;align-items:center;gap:0.3rem';
    rc.appendChild(ind);
  }
  ind.innerHTML = '<span style="display:inline-block;width:10px;height:10px;border:2px solid var(--accent);border-top-color:transparent;border-radius:50%;animation:spin 0.7s linear infinite"></span>'
               + ' loading more eras (' + le.loaded + '/' + le.total + ')…';
}
if (typeof window !== 'undefined') window._renderAllLoadingIndicator = _renderAllLoadingIndicator;

// S151 follow-up: per-item external reference link. Returns inline HTML for
// a small external-link icon. Atlas items use item.refLink (set from the
// sheet) and label 'View on Atlas'. MTH items derive a URL from the item
// number using the mthtrains.com /products/{itemNum} pattern. Lionel items
// have no external catalog wired up yet.
// S152 fix: label the external-link button by destination, not by manufacturer.
// Detection is hostname-based: mthtrains.com -> 'MTH'; atlas.com/atlasrr.com
// -> 'Atlas'; centerlineoftrains.com or anything with 'cott' -> 'COTT'.
// Falls back to 'External' for unknown hosts.
// Bug 13 (Session 154): true when this -BOX row is grouped with an owned
// NON-box item (by groupId or by parent item number). Such boxes are shown
// as "Has Box" + the grouped icon on the parent, so they should not appear
// as their own line / be counted. Standalone box-only rows (no owned parent)
// return false here and still show.
function _isGroupedBoxRow(pd) {
  if (!pd) return false;
  var num = String(pd.itemNum || '').toUpperCase();
  if (!num.endsWith('-BOX')) return false;
  var parent = pd.itemNum.replace(/-BOX$/i, '');
  var pdata = (typeof state !== 'undefined' && state.personalData) ? state.personalData : {};
  return Object.values(pdata).some(function(p) {
    if (!p || !p.owned) return false;
    if (String(p.itemNum || '').toUpperCase().endsWith('-BOX')) return false;
    if (pd.groupId && p.groupId && p.groupId === pd.groupId) return true;
    return p.itemNum === parent;
  });
}
if (typeof window !== 'undefined' && !window._isGroupedBoxRow) window._isGroupedBoxRow = _isGroupedBoxRow;

// Push 2 (Session 154): true when this owned row is a "companion" that should
// fold into its group's lead item — i.e. a grouped box, OR a non-lead member
// of a group (tender, extra set car, etc.) whose lead item is also owned.
// Used to count + display each group as a single item. Lead number is the
// segment embedded in the groupId: GRP-{leadNum}-{timestamp}.
// A group member is a COMPANION (folds into the lead) when it's a non-lead
// piece: a tender, a dummy/trailer (-D/-T), a B-unit (-C), or a box (-BOX/-MBOX/-IS).
// The lead is the engine / powered A-unit. Detected by suffix/type so it works
// for engine+tender AND diesel AA/AB/ABA, regardless of the groupId's lead number.
function _isGroupCompanionSfx(n) {
  var sfx = String(n || '');
  if (/-(D|T|C|BOX|MBOX|IS)$/i.test(sfx)) return true;
  if (typeof isTender === 'function' && isTender(sfx)) return true;
  return false;
}
function _isCollectionCompanion(pd) {
  if (!pd || !pd.owned) return false;
  if (typeof _isGroupedBoxRow === 'function' && _isGroupedBoxRow(pd)) return true;
  if (!pd.groupId) return false;
  if (!_isGroupCompanionSfx(pd.itemNum)) return false; // this row is a lead-type piece
  // Fold only when the group's lead (a non-companion member) is actually owned,
  // so an orphaned group (lead removed) still shows its remaining members.
  var pdata = (typeof state !== 'undefined' && state.personalData) ? state.personalData : {};
  var leadOwned = Object.values(pdata).some(function(p) {
    return p && p.owned && p.groupId === pd.groupId && p.itemNum !== pd.itemNum
      && !_isGroupCompanionSfx(p.itemNum);
  });
  return leadOwned;
}
if (typeof window !== 'undefined' && !window._isCollectionCompanion) window._isCollectionCompanion = _isCollectionCompanion;
// Owned companion item numbers (tender, dummy, B-unit) sharing this item's
// group — for the merged display 'engine \ud83d\udd17 tender'. Boxes/IS excluded.
function _ownedCompanions(pd) {
  if (!pd || !pd.groupId) return [];
  var out = [];
  Object.values(state.personalData || {}).forEach(function(p) {
    if (p && p.owned && p.groupId === pd.groupId && p.itemNum !== pd.itemNum
        && !/-(BOX|MBOX|IS)$/i.test(String(p.itemNum || ''))) {
      var n = (typeof _displayItemNum === 'function') ? _displayItemNum(p) : p.itemNum;
      if (n && out.indexOf(n) === -1) out.push(n);
    }
  });
  return out;
}
if (typeof window !== 'undefined') window._ownedCompanions = _ownedCompanions;

// ── v0.9.1122: abandoned set entries ───────────────────────────────────────
// Leaving a set walkthrough partway keeps whatever already saved — by design,
// so a crash or a phone call doesn't lose the cars you'd entered. But if you
// never come back, those rows sit in the collection under a set ID with no set
// record behind it, looking like duplicates of a set you already own. This
// finds them (SET-… group, no matching My Sets row) so the collection can
// offer to finish the job.
function _rrAbandonedSetGroups() {
  var out = [];
  try {
    var known = {};
    Object.values(state.mySetsData || {}).forEach(function (s) { if (s && s.groupId) known[s.groupId] = 1; });
    var byGid = {};
    Object.values(state.personalData || {}).forEach(function (p) {
      if (!p || !p.owned || !p.groupId) return;
      if (!/^SET-/i.test(String(p.groupId)) || known[p.groupId]) return;
      (byGid[p.groupId] = byGid[p.groupId] || []).push(p);
    });
    Object.keys(byGid).forEach(function (gid) {
      out.push({ groupId: gid, items: byGid[gid],
                 setNum: (String(gid).split('-')[1] || '') });
    });
  } catch (e) { console.warn('[abandonedSets]', e); }
  return out;
}
if (typeof window !== 'undefined') window._rrAbandonedSetGroups = _rrAbandonedSetGroups;

window._rrDropAbandonedSet = async function (gid) {
  var g = _rrAbandonedSetGroups().find(function (x) { return x.groupId === gid; });
  if (!g) return;
  var msg = 'Remove the ' + g.items.length + ' item' + (g.items.length !== 1 ? 's' : '')
    + ' left over from that unfinished ' + (g.setNum || 'set') + ' entry?\n\n'
    + g.items.map(function (p) { return '  · ' + p.itemNum; }).join('\n')
    + '\n\nPhotos already filed to these items stay in Drive.';
  var ok = (typeof appConfirm === 'function')
    ? await appConfirm(msg, { danger: true, ok: 'Remove them', cancel: 'Keep them', title: 'Unfinished set entry' })
    : window.confirm(msg);
  if (!ok) return;
  try {
    var n = (typeof rrRemoveSetGroup === 'function') ? await rrRemoveSetGroup(gid) : 0;
    showToast('Removed ' + n + ' leftover item' + (n !== 1 ? 's' : ''), 3000);
    if (typeof buildDashboard === 'function') buildDashboard();
    renderBrowse();
  } catch (e) {
    console.error('[abandonedSets] remove:', e);
    showToast('Could not remove them — try again', 3000, true);
  }
};

// v0.9.1121: expand/collapse a folded SET row in My Collection.
window._rrToggleSetFold = function (gid) {
  window._rrOpenSetFolds = window._rrOpenSetFolds || {};
  window._rrOpenSetFolds[gid] = !window._rrOpenSetFolds[gid];
  try { renderBrowse(); } catch (e) { console.warn('[setFold]', e); }
};

// ── For Sale grouped-item helpers (Session 154) ─────────────────────────────
// The For Sale tab has no Group ID column, so resolve a row's group through its
// Inventory ID against the collection / instruction-sheet records (which DO
// carry groupId). Lets the For Sale list collapse a group to ONE row + count,
// and lets list actions cascade across every piece.
function _fsGroupId(fs) {
  if (!fs) return '';
  var itemNum   = (typeof fs === 'string') ? fs : (fs.itemNum || '');
  var variation = (typeof fs === 'object' && fs) ? (fs.variation || '') : '';
  var invId     = (typeof fs === 'object' && fs) ? (fs.inventoryId || '') : '';
  var pdata = (typeof state !== 'undefined' && state.personalData) ? state.personalData : {};
  var pd = (invId && pdata[invId]) || pdata[itemNum + '|' + variation] || null;
  if (!pd && invId) pd = Object.values(pdata).find(function(p){ return p && p.inventoryId === invId; }) || null;
  if (pd && pd.groupId) return pd.groupId;
  var idata = (typeof state !== 'undefined' && state.isData) ? state.isData : {};
  var isRec = Object.values(idata).find(function(r){
    return r && ((invId && r.inventoryId === invId) || r.sheetNum === itemNum || ((r.linkedItem || '') + '-IS') === itemNum);
  });
  if (isRec && isRec.groupId) return isRec.groupId;
  return '';
}

function _fsGroupLeadNum(gid) {
  var parts = String(gid || '').split('-');
  if (parts.length < 3) return '';
  return parts.slice(1, -1).join('-'); // GRP-{leadNum}-{ts} -> leadNum (keeps hyphens)
}

function _fsIsGroupedCompanion(fs) {
  var gid = _fsGroupId(fs);
  if (!gid) return false;
  var leadNum = _fsGroupLeadNum(gid);
  if (!leadNum) return false;
  var itemNum = (typeof fs === 'string') ? fs : (fs.itemNum || '');
  var base = String(itemNum).replace(/-(BOX|MBOX|IS)$/i, '');
  return !(base === leadNum && !/-(BOX|MBOX|IS)$/i.test(String(itemNum))); // companion = any group member that isn't the lead
}

// Every member of a For Sale row's group: its sibling For Sale rows, plus the
// collection + instruction-sheet records sharing the groupId.
function _fsGroupMembers(fs) {
  var out = { fs: [fs], pd: [], is: [] };
  var gid = _fsGroupId(fs);
  if (!gid) return out;
  var fdata = (typeof state !== 'undefined' && state.forSaleData) ? state.forSaleData : {};
  Object.values(fdata).forEach(function(f){ if (f !== fs && _fsGroupId(f) === gid) out.fs.push(f); });
  var pdata = (typeof state !== 'undefined' && state.personalData) ? state.personalData : {};
  Object.keys(pdata).forEach(function(k){ if (pdata[k] && pdata[k].groupId === gid) out.pd.push({ key: k, rec: pdata[k] }); });
  var idata = (typeof state !== 'undefined' && state.isData) ? state.isData : {};
  Object.keys(idata).forEach(function(k){ if (idata[k] && idata[k].groupId === gid) out.is.push({ key: k, rec: idata[k] }); });
  return out;
}

if (typeof window !== 'undefined') {
  if (!window._fsGroupId) window._fsGroupId = _fsGroupId;
  if (!window._fsIsGroupedCompanion) window._fsIsGroupedCompanion = _fsIsGroupedCompanion;
  if (!window._fsGroupMembers) window._fsGroupMembers = _fsGroupMembers;
}

// v0.9.1162 (Brad: "why doesn't the prewar items not reference the cott
// website"). They DO — 2,088 of his 2,837 Pre-War rows carry a COTT link, and
// 5,811 rows do catalog-wide. This function simply never called them COTT: it
// tested for 'centerlineoftrains' and 'cott', and COTT is Cornucopia Of Toy
// Trains — cornucopiaoftoytrains.com, which contains NEITHER string. So every
// COTT link read "View on External", and exactly 2 rows out of 132,791 were ever
// labelled correctly, by accident. Three other reference sites were unnamed too.
//
// Matched on the HOSTNAME, not the whole URL. Testing the whole URL let a path or
// query decide the label: the app's own Google fallback for a Lionel row is
// google.com/search?q=Lionel..., and any host containing the letters c-o-t-t
// (scottsdale-trains, say) was labelled COTT.
//
// Row counts measured live 2026-07-30 — kept here so the next person can see at a
// glance which references actually carry the catalog.
var _SITE_LABELS = [
  ['cornucopiaoftoytrains', 'COTT'],               // 5,811 — Cornucopia Of Toy Trains
  ['atlasrr',               'Atlas'],              // 46,527 (archive.atlasrr.com)
  ['atlasmodel',            'Atlas'],
  ['atlas.com',             'Atlas'],
  ['mthtrains',             'MTH'],                // 37,318
  ['lionel.com',            'Lionel'],             // 14,531
  ['trainz.com',            'Trainz'],             // 3,768 — LGB + USA Trains
  ['readymadetoys',         'RMT'],                // 416 — RMT's own site
  ['tandem-associates',     'Tandem Associates'],  // 154 — Lionel postwar accessories
  ['web.archive.org',       'Web Archive'],        // 180 — the 3rd Rail reconstruction
  ['centerlineoftrains',    'COTT'],               // kept: harmless legacy alias
  ['google.com',            'Google'],
];
function _externalSiteLabel(url) {
  if (!url) return 'External';
  var host;
  try {
    host = new URL(String(url)).hostname.toLowerCase();
  } catch (e) {
    host = String(url).toLowerCase();   // relative or malformed: previous behaviour
  }
  for (var i = 0; i < _SITE_LABELS.length; i++) {
    if (host.indexOf(_SITE_LABELS[i][0]) >= 0) return _SITE_LABELS[i][1];
  }
  return 'External';
}
if (typeof window !== 'undefined') window._externalSiteLabel = _externalSiteLabel;

// S152 follow-up: pure-URL version used by both row icon and item detail page.
// Returns the external destination URL for an item, or '' if none. Centralises
// the Atlas/MTH/Lionel/Google branching so app-collection.js can reuse it.
function _itemExternalLinkURL(item) {
  if (!item) return '';
  // ── v0.9.1186 — the oddballs, by name ─────────────────────────────────────
  // Brad: "https://cornucopiaoftoytrains.com/club-cars/#CCTCA should be the
  // link for the x6464-1970 its an odd ball." Club and convention cars don't
  // follow any numbering rule the branches below can reason about, so they get
  // a named map instead of a cleverer pattern.
  //
  // v0.9.1187: the map moved ABOVE the refLink check. The workbook audit showed
  // WHY it has to be: X6464-1970's master row carries a refLink — pointing at
  // the /transformers/ page, which is wrong. These entries are Brad's explicit
  // per-item corrections, and a correction that loses to the data it corrects
  // is dead code. Delete an entry once the master row's link is actually fixed.
  //
  // v0.9.1188: X6464-1970's entry deleted — master 1.59 carries the club-cars
  // link in the row itself now, so the refLink branch serves it. The map stays
  // (empty) for the next oddball Brad names.
  var _ODDBALL_REFS = {};
  var _odd = _ODDBALL_REFS[String(item.itemNum || '').trim().toUpperCase()];
  if (_odd) return _odd;
  // Deep-link COTT references straight to the item anchor (cott-anchors.js).
  if (item.refLink) return (typeof window!=='undefined' && window.cottAnchorUrl)
      ? window.cottAnchorUrl(item.refLink, item.itemNum) : item.refLink;
  // v0.9.1175 (Brad: "6464-100 is on the cott site. why does this link to a google
  // search for a lionel 6464-100"). Because THIS row has no reference of its own —
  // and his want had matched the BOX row (the card even badged it PAPER / BOX /
  // MISC), which carries the number but not the reference. The master indexes an
  // item, its box and its paperwork under one number; the COTT page describes the
  // item, and it is the same page whichever of those rows the app happened to land
  // on. So: borrow a sibling's reference before falling back to a search.
  //
  // Same era first — a postwar row must not borrow a modern reissue's page.
  try {
    var _sib = null;
    var _bucket = (typeof window !== 'undefined' && window._mbAllGet)
      ? window._mbAllGet(String(item.itemNum || '').trim())
      : ((typeof state !== 'undefined' && state.masterByItem && state.masterByItem.get)
          ? state.masterByItem.get(String(item.itemNum || '').trim()) : null);
    if (_bucket && _bucket.length) {
      for (var _b = 0; _b < _bucket.length; _b++) {
        var _r = _bucket[_b];
        if (!_r || !_r.refLink || _r === item) continue;
        if (item._era && _r._era && _r._era !== item._era) continue;   // same era only
        _sib = _r; break;
      }
    }
    if (_sib) {
      return (typeof window !== 'undefined' && window.cottAnchorUrl)
        ? window.cottAnchorUrl(_sib.refLink, item.itemNum) : _sib.refLink;
    }
  } catch (eSib) {}
  // ── v0.9.1188 — direct link or Google, nothing in between ─────────────────
  // Brad: "if we dont have the direct link for an item, i don't want lionel.com
  // search engine. that is when we google it. the prewar will have to be
  // googled until cott has all their links up."
  //
  // This retires v1187's lionel.com/search tail AND the two rungs that BUILT
  // mthtrains product URLs from the bare number (the v1183 tinplate rung and
  // the MTH-tab rung). Those guesses were checked against MTH's own site index
  // on 2026-07-30: master 1.59 now carries the real link for every MTH item
  // that has a page — including 137 the guess would have 404'd on, because the
  // live page carries a -0/-1 suffix the master number drops. After 1.59, the
  // only rows these rungs could still fire on are the ones PROVEN to have no
  // page, so a constructed URL here is a dead link and nothing else.
  //
  // The Google query restores item 8's v1175 form, which Brad specified
  // ("we need to search the era in this case postwar with it"): a bare
  // "Lionel 6464-100" search is dominated by modern reissues carrying the
  // same number, so the era word a person would type goes in. MTH rows say
  // MTH; 11-##### is MTH's numbering wearing Lionel's name (v1183), so it
  // says MTH whichever tab it sits in.
  if (item.itemNum) {
    var _tabL = String(item._tab || '').toLowerCase();
    var _numT = String(item.itemNum).trim();
    var _isMth = _tabL.indexOf('mth') === 0 || /^11-\d{3,}$/.test(_numT);
    if (_isMth) {
      var _gqM = 'MTH ' + _numT + (item.roadName ? ' ' + item.roadName : '');
      return 'https://www.google.com/search?q=' + encodeURIComponent(_gqM);
    }
    if (_tabL.indexOf('lionel') === 0) {
      var _per2 = (typeof _itemEraPeriod === 'function') ? _itemEraPeriod(item) : null;
      var _perWord2 = ({ prewar: 'prewar', postwar: 'postwar', modern: 'modern' })[_per2] || '';
      var _gq2 = 'Lionel ' + _numT + (item.roadName ? ' ' + item.roadName : '')
        + (_perWord2 ? ' ' + _perWord2 : '');
      return 'https://www.google.com/search?q=' + encodeURIComponent(_gq2);
    }
  }
  return '';
}
if (typeof window !== 'undefined') window._itemExternalLinkURL = _itemExternalLinkURL;

function _itemExternalLinkHTML(item) {
  var url = _itemExternalLinkURL(item);
  if (!url) return '';
  var title = 'View on ' + _externalSiteLabel(url);
  // v0.9.1190: the icon stays 11px, but its CLICKABLE box was 11px too — and
  // measured live in Brad's own browser, an 11x11 target is a coin toss.
  // Padding grows the hit area to ~27px; the matching negative margins mean
  // the layout does not move a pixel, so every row and banner using this
  // helper looks exactly as it did. z-index keeps the enlarged box above the
  // row behind it instead of buried under it.
  return '<a href="' + url + '" target="_blank" rel="noopener" '
       + 'onclick="event.stopPropagation()" title="' + title + '" '
       + 'style="margin-left:5px;vertical-align:middle;color:var(--text-dim);'
       + 'opacity:0.6;text-decoration:none;display:inline-flex;'
       + 'padding:8px;margin-top:-8px;margin-bottom:-8px;margin-right:-8px;'
       + 'box-sizing:content-box;position:relative;z-index:1" '
       + 'onmouseover="this.style.opacity=\'1\'" '
       + 'onmouseout="this.style.opacity=\'0.6\'">'
       + '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" '
       + 'stroke="currentColor" stroke-width="2.5">'
       + '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'
       + '<polyline points="15,3 21,3 21,9"/>'
       + '<line x1="10" y1="14" x2="21" y2="3"/></svg></a>';
}
if (typeof window !== 'undefined') window._itemExternalLinkHTML = _itemExternalLinkHTML;

// ── Cross-era search banner ──
// When a search term is active on the master catalog, show a banner offering to
// re-run the same search in other eras. Button click switches era + preserves term.
function _renderCrossEraSearchBanner(searchTerm) {
  var BANNER_ID = 'cross-era-search-banner';
  var existing = document.getElementById(BANNER_ID);
  // Remove banner if no search or on My Collection view
  if (!searchTerm || !searchTerm.trim() || state.filters.owned) {
    if (existing) existing.remove();
    return;
  }
  // S151 follow-up: in 'all' meta-era mode the search already spans every
  // era, so offering 'search in [other era]' is noise. Skip the banner.
  if (typeof _currentEra !== 'undefined' && _currentEra === 'all') {
    if (existing) existing.remove();
    return;
  }
  // Build list of OTHER eras (skip current AND the 'all' meta-era —
  // it's not a real era you can switch a search to). Honor user's
  // enabled-eras preference so disabled eras don't show in the banner.
  var otherEras = Object.keys(ERAS).filter(function(k) {
    if (k === _currentEra) return false;
    // Session 117: keep the 'all' meta-era as an option — clicking it
    // switches to All Collection mode and re-runs the same search across
    // every era at once (cross-era search without era-by-era hopping).
    if (typeof _isEraEnabled === 'function' && !_isEraEnabled(k)) return false;
    return true;
  });
  if (!otherEras.length) { if (existing) existing.remove(); return; }
  // HTML-escape the search term for safe display + safe JS string arg
  var esc = String(searchTerm).replace(/[<>"'&]/g, function(c){
    return {'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','&':'&amp;'}[c];
  });
  var jsArg = String(searchTerm).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  var btns = otherEras.map(function(k) {
    var lbl = (ERAS[k] && ERAS[k].label) || k;
    return '<button onclick="_searchInOtherEra(\'' + k + '\', \'' + jsArg + '\')" '
      + 'style="padding:0.35rem 0.75rem;border-radius:6px;border:1px solid var(--border);'
      + 'background:var(--surface2);color:var(--text);font-family:var(--font-body);'
      + 'font-size:0.78rem;font-weight:600;cursor:pointer;white-space:nowrap" '
      + 'title="Search &quot;' + esc + '&quot; in ' + lbl + '">Search ' + lbl + '</button>';
  }).join('');
  var html = '<div id="' + BANNER_ID + '" '
    + 'style="display:flex;flex-wrap:wrap;align-items:center;gap:0.5rem;'
    + 'margin:0.4rem 0 0.6rem;padding:0.55rem 0.75rem;'
    + 'background:var(--surface);border:1px solid var(--border);border-radius:14px">'
    + '<span style="font-size:0.78rem;color:var(--text-dim);font-family:var(--font-body)">'
    + 'Not finding it? Search &ldquo;<strong style="color:var(--text)">' + esc + '</strong>&rdquo; in&nbsp;</span>'
    + btns
    + '</div>';
  if (existing) {
    existing.outerHTML = html;
  } else {
    // Insert just above the items table container
    var host = document.querySelector('#page-browse .item-table');
    if (host && host.parentNode) {
      host.insertAdjacentHTML('beforebegin', html);
    }
  }
}

// ── Session 127 ─ Cross-scope search trigger + result renderer ──────────────
// Called from the banner button when an in-scope search returns 0 results and
// the user wants to broaden the search to every other era they have access to.
async function _triggerCrossScopeSearch() {
  if (typeof _crossScopeSearch !== 'function') return;
  var area = document.getElementById('cross-scope-search-area');
  if (area) {
    area.innerHTML = '<div style="padding:2rem 1rem;text-align:center;color:var(--text-dim)">'
      + '<div style="font-size:1.5rem;margin-bottom:0.5rem">🔍</div>'
      + '<p>Searching across all your eras\u2026</p></div>';
  }
  var query = state.filters.search || '';
  var results = await _crossScopeSearch(query);
  if (!area) area = document.getElementById('cross-scope-search-area');
  if (!area) return;
  if (!results || results.length === 0) {
    area.innerHTML = '<div style="padding:2rem 1rem;text-align:center;color:var(--text-dim)">'
      + '<div style="font-size:2rem;margin-bottom:0.5rem">\ud83e\udd14</div>'
      + '<p style="font-weight:600">No matches anywhere</p>'
      + '<p style="font-size:0.85rem;margin-top:0.4rem">Not in any of your other eras either.</p>'
      + '</div>';
    return;
  }
  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function _jsArg(s) {
    return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }
  var colors = (window.WHAT_I_COLLECT && window.WHAT_I_COLLECT.eraColors) || {};
  var html = '<div style="padding:0.75rem 0.5rem">'
    + '<p style="font-weight:600;margin:0 0 0.6rem;text-align:center">Found ' + results.length + ' result' + (results.length===1?'':'s') + ' in your other eras</p>'
    + '<div style="display:flex;flex-direction:column;gap:0.4rem;text-align:left;max-width:760px;margin:0 auto">';
  results.forEach(function(r) {
    var era = (typeof ERAS !== 'undefined' && ERAS[r.e]) || {};
    var eraLabel = era.label || r.e;
    var accent = colors[r.e] || 'var(--accent)';
    var nEsc = _esc(r.n);
    var rEsc = _esc(r.r);
    var dEsc = _esc(r.d);
    var vEsc = _esc(r.v);
    var dShort = dEsc.length > 100 ? (dEsc.substring(0,100) + '\u2026') : dEsc;
    html += '<div onclick="_openInOtherEra(\'' + _jsArg(r.n) + '\', \'' + r.e + '\', \'' + _jsArg(r.v) + '\')" '
      + 'style="display:flex;align-items:center;gap:0.5rem;padding:0.55rem 0.65rem;border-radius:7px;border:1px solid var(--border);background:var(--surface);cursor:pointer">'
      + '<span style="display:inline-block;padding:2px 7px;border-radius:4px;font-size:0.62rem;font-weight:700;letter-spacing:0.05em;color:#fff;background:' + accent + ';white-space:nowrap;flex-shrink:0">' + _esc(eraLabel) + '</span>'
      + '<span style="font-weight:600;font-size:0.9rem;flex-shrink:0">' + nEsc + (vEsc ? ' <span style="color:var(--text-dim);font-weight:400;font-size:0.78rem">' + vEsc + '</span>' : '') + '</span>'
      + (rEsc ? '<span style="color:var(--text-mid);font-size:0.82rem;white-space:nowrap">' + rEsc + '</span>' : '')
      + (dShort ? '<span style="color:var(--text-dim);font-size:0.78rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0">' + dShort + '</span>' : '')
      + '</div>';
  });
  html += '</div></div>';
  area.innerHTML = html;
}
window._triggerCrossScopeSearch = _triggerCrossScopeSearch;

// ══════════════════════════════════════════════════════════════
//  browse.js — Browse Page, Filters, Tab Renderers
//  Extracted from app.js (Session 63)
//
//  Dependencies (globals from app.js, loaded before this file):
//    state, showPage, showToast, normalizeItemNum, showItemDetailPage,
//    buildWantPage, buildSetsPage, buildSoldPage, buildForSalePage,
//    buildQuickEntryList, openItem, openWizard, _isAdmin,
//    findPD, findPDKey, isTender
//
//  Dependencies (from sheets.js):
//    sheetsGet, sheetsAppend
// ══════════════════════════════════════════════════════════════

// ── BROWSE ──────────────────────────────────────────────────────

// Helper: build display item number with P/D suffix for AA/AB units
// Session 168: small "NO #" tag for items that have no catalog number. Their
// auto-generated name lives in the number slot; real catalog numbers never
// contain a space, so a space reliably means "name, not number." Returns ''
// for real numbers, so it is safe to call at ANY number-display spot.
function _noNumTag(itemNum){
  var v = String(itemNum == null ? '' : itemNum);
  if (v.indexOf(' ') === -1) return '';
  return ' <span style="font-size:0.58rem;font-weight:700;letter-spacing:0.04em;color:var(--text-dim);background:var(--surface2);border:1px solid var(--border);border-radius:4px;padding:0.05rem 0.3rem;vertical-align:middle;white-space:nowrap">NO #</span>';
}
if (typeof window !== 'undefined') window._noNumTag = _noNumTag;

function _displayItemNum(item) {
  if (!item) return '';
  var num = item.itemNum || '';
  var pd = item.poweredDummy || '';
  if (pd === 'P') return num + '-P';
  if (pd === 'D') return num + '-D';
  return num;
}


// ── Road Name Searchable Combobox ──
window._roadComboValue = '';
window._allRoads = [];

function _roadComboBuild() {
  var list = document.getElementById('road-combo-list');
  if (!list) return;
  list.innerHTML = '';
  _roadComboRender(window._allRoads, list);
}

function _roadComboRender(roads, list) {
  if (!list) list = document.getElementById('road-combo-list');
  if (!list) return;
  list.innerHTML = '';
  // "All Roads" option
  var allOpt = document.createElement('div');
  allOpt.className = 'road-opt';
  allOpt.textContent = 'All Roads';
  allOpt.onclick = function() { _roadComboSelect('', 'All Roads'); };
  list.appendChild(allOpt);
  // Filtered roads
  roads.forEach(function(r) {
    var opt = document.createElement('div');
    opt.className = 'road-opt';
    opt.innerHTML = r.name + '<span class="road-count">' + r.count + '</span>';
    opt.onclick = function() { _roadComboSelect(r.name, r.name); };
    list.appendChild(opt);
  });
}

function _roadComboOpen() {
  var list = document.getElementById('road-combo-list');
  var input = document.getElementById('filter-road-input');
  if (!list) return;
  input.select();
  _roadComboRender(window._allRoads, list);
  list.style.display = 'block';
  // Close on outside click
  setTimeout(function() {
    document.addEventListener('click', _roadComboOutside, { once: true, capture: true });
  }, 10);
}

function _roadComboOutside(e) {
  var combo = document.getElementById('road-combo');
  if (combo && !combo.contains(e.target)) {
    _roadComboClose();
  } else {
    // Re-attach listener if click was inside combo
    setTimeout(function() {
      document.addEventListener('click', _roadComboOutside, { once: true, capture: true });
    }, 10);
  }
}

function _roadComboClose() {
  var list = document.getElementById('road-combo-list');
  if (list) list.style.display = 'none';
}

function _roadComboFilter(query) {
  var list = document.getElementById('road-combo-list');
  if (!list) return;
  var q = (query || '').toLowerCase().trim();
  var filtered = q ? window._allRoads.filter(function(r) {
    return r.name.toLowerCase().indexOf(q) >= 0;
  }) : window._allRoads;
  _roadComboRender(filtered, list);
  list.style.display = 'block';
}

function _roadComboSelect(value, label) {
  var input = document.getElementById('filter-road-input');
  var clearBtn = document.getElementById('road-combo-clear');
  window._roadComboValue = value;
  if (input) input.value = value ? label : '';
  if (input) input.placeholder = value ? '' : 'All Roads';
  if (clearBtn) clearBtn.style.display = value ? 'block' : 'none';
  _roadComboClose();
  applyFilters();
}

function _roadComboClear() {
  _roadComboSelect('', '');
}


// ── Alias-aware search: expands abbreviations & nicknames ──
function _aliasSearch(haystack, query) {
  // Direct match first (fast path)
  if (haystack.includes(query)) return true;
  // Check if query matches any alias group — if so, test all terms in that group
  var aliases = SEARCH_ALIASES[query];
  if (aliases) {
    for (var i = 0; i < aliases.length; i++) {
      if (haystack.includes(aliases[i])) return true;
    }
  }
  // Also check if query is a partial match of any alias key
  // e.g. typing "fairbank" should still find the "fairbanks-morse" alias group
  var keys = Object.keys(SEARCH_ALIASES);
  for (var k = 0; k < keys.length; k++) {
    if (keys[k].includes(query) || query.includes(keys[k])) {
      var terms = SEARCH_ALIASES[keys[k]];
      for (var j = 0; j < terms.length; j++) {
        if (haystack.includes(terms[j])) return true;
      }
    }
  }
  return false;
}

function populateFilters() {
  // Session 155: deduplicate road-name dropdown via normalizer (safety net
  // against future drift after the master cleanup). Picks the most-popular
  // spelling per normalized group as the dropdown's display label.
  function _normRoadKey(s) {
    if (!s) return '';
    return String(s).toLowerCase()
      .replace(/[\u2020\u2021\u00b1\u00ae*\u2013\u2014]/g, '')   // strip footnote / symbol marks
      .replace(/ & /g, ' and ').replace(/&/g, ' and ')
      .replace(/[-/]/g, ' ')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }
  const _roadGroupsTmp = {};       // normKey -> [{raw, count}]
  const _rawRoadCounts = {};       // raw spelling -> count (for legacy callers)
  state.masterData.forEach(function(i) {
    if (!i.roadName) return;
    _rawRoadCounts[i.roadName] = (_rawRoadCounts[i.roadName] || 0) + 1;
    const k = _normRoadKey(i.roadName);
    if (!_roadGroupsTmp[k]) _roadGroupsTmp[k] = [];
    _roadGroupsTmp[k].push({ raw: i.roadName });
  });
  const _roadDeduped = Object.keys(_roadGroupsTmp).map(function(k) {
    const variants = _roadGroupsTmp[k];
    const byRaw = {};
    variants.forEach(function(v) { byRaw[v.raw] = (byRaw[v.raw] || 0) + 1; });
    const sortedRaws = Object.keys(byRaw).sort(function(a, b) { return byRaw[b] - byRaw[a]; });
    const canonical = sortedRaws[0];
    const total = variants.length;
    return { canonical: canonical, count: total };
  }).sort(function(a, b) { return a.canonical.localeCompare(b.canonical); });
  const roads = _roadDeduped.map(function(r) { return r.canonical; });

  const typeEl = document.getElementById('filter-type');
  // Session 118 Phase C: reset dropdown to fix triple-rebuild bug AND populate from TYPE_BUCKETS (clean tier-1 buckets, alphabetical by short label).
  typeEl.innerHTML = '<option value="">All Types</option>';
  // Session 125: only show buckets present in current era's masterData.
  const types = (typeof _bucketsInCurrentEra === 'function')
    ? _bucketsInCurrentEra()
    : (window.TYPE_BUCKETS || []).map(function(b){ return b.label; });
  types.forEach(t => { const o = document.createElement('option'); o.value = t; o.textContent = t; typeEl.appendChild(o); });

  // Add ephemera types as a group
  const ephemeraTypes = ['Catalog','Paper Item','Mock-Up','Other Lionel'];
  // Also add catalog sub-types actually present in data
  const catSubTypes = [...new Set(
    Object.values(state.ephemeraData.catalogs||{}).map(it=>it.catType).filter(Boolean)
  )].sort();
  const hasCatalogs = Object.keys(state.ephemeraData.catalogs||{}).length > 0;
  const hasPaper    = Object.keys(state.ephemeraData.paper||{}).length > 0;
  const hasMockups  = Object.keys(state.ephemeraData.mockups||{}).length > 0;
  const hasOther    = Object.keys(state.ephemeraData.other||{}).length > 0;
  const hasIS       = Object.keys(state.isData||{}).length > 0;
  const userEph = (state.userDefinedTabs||[]).filter(t => Object.keys(state.ephemeraData[t.id]||{}).length > 0);
  const hasAnyEph = hasCatalogs || hasPaper || hasMockups || hasOther || hasIS || userEph.length > 0;

  // Session 125: only show "My Collection" ephemera section if user actually has any.
  if (hasAnyEph) {
    const sep = document.createElement('option');
    sep.disabled = true; sep.textContent = '── My Collection ──';
    typeEl.appendChild(sep);
    if (hasCatalogs) {
      const oCat = document.createElement('option'); oCat.value = 'Catalog'; oCat.textContent = '📒 Catalogs (all)'; typeEl.appendChild(oCat);
      catSubTypes.forEach(ct => {
        const o2 = document.createElement('option'); o2.value = ct; o2.textContent = '  ' + ct + ' Catalog'; typeEl.appendChild(o2);
      });
    }
    if (hasPaper)   { const o = document.createElement('option'); o.value = 'Paper Item';   o.textContent = '📄 Paper Items';        typeEl.appendChild(o); }
    if (hasMockups) { const o = document.createElement('option'); o.value = 'Mock-Up';      o.textContent = '🔩 Mock-Ups';           typeEl.appendChild(o); }
    if (hasOther)   { const o = document.createElement('option'); o.value = 'Other Lionel'; o.textContent = '📦 Other Lionel';       typeEl.appendChild(o); }
    if (hasIS)      { const o = document.createElement('option'); o.value = 'Instruction Sheet'; o.textContent = '📋 Instruction Sheets'; typeEl.appendChild(o); }
    userEph.forEach(t => {
      const o = document.createElement('option'); o.value = t.label; o.textContent = '⭐ ' + t.label; typeEl.appendChild(o);
    });
  }

  // Store all roads for the combobox (with counts) — Session 155: counts now
  // reflect the normalized group total (sum across all variants), not raw spelling.
  window._allRoads = _roadDeduped.map(function(r) { return { name: r.canonical, count: r.count }; });
  _roadComboBuild();

  // Session 119: re-sync dropdown to whatever filter is held in state.
  // Era-switch rebuilds this dropdown which used to silently blank the
  // visual selection even though state.filters.type was still active.
  // The browser silently no-ops if the value isn't in the new options
  // (self-healing — old raw itemType values from pre-bucket era).
  if (typeEl) typeEl.value = state.filters.type || '';
  if (typeof updateFilterBadge === 'function') updateFilterBadge();
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
  const r = (window._roadComboValue || '').trim();
  const count = (t ? 1 : 0) + (r ? 1 : 0);
  badge.textContent = count;
  badge.style.display = count > 0 ? 'inline' : 'none';
  if (btn) btn.style.borderColor = count > 0 ? 'var(--accent)' : 'var(--border)';
  if (btn) btn.style.color = count > 0 ? 'var(--accent)' : 'var(--text-mid)';
}

function clearBrowseFilters() {
  const ft = document.getElementById('filter-type');
  if (ft) ft.value = '';
  _roadComboClear();
  updateFilterBadge();
  applyFilters();
}

function applyFilters() {
  state.filters.type = document.getElementById('filter-type').value;
  state.filters.quickEntry = ''; // QE filter only applies in My Collection view
  state.filters.road = window._roadComboValue || '';
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
  // Restore table headers to default (era-aware)
  const thead = document.querySelector('#page-browse .item-table thead tr');
  if (thead) {
    // Session 129: consolidated to use the same 3-way (Atlas / MTH / Lionel)
    // logic as _refreshBrowseHeaders so MTH eras get the correct headers here too.
    if (typeof _refreshBrowseHeaders === 'function') {
      _refreshBrowseHeaders();
    } else {
      var _isAtlasEra = (typeof _currentEra !== 'undefined' && _currentEra === 'atlas');
      thead.innerHTML = _isAtlasEra ? _atlasBrowseHeaders() : _lionelBrowseHeaders();
    }
  }
  var _tbl = document.querySelector('#page-browse .item-table');
  if (_tbl) _tbl.classList.remove('collection-view');
  var _fbMaster = document.querySelector('#page-browse .filter-bar');
  if (_fbMaster) _fbMaster.style.display = '';
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
  _roadComboClear();
  updateFilterBadge();
  state._browseTab = 'items';
  renderBrowseTab('items');
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
  // Show Share button for collection view — place it to the RIGHT of the + Add
  // button (inside the quick-actions container) so both sit at the top-right.
  var _qaActions = document.querySelector('#page-browse > .page-title > .qa-tr-actions');
  var _btnArea = _qaActions || document.querySelector('#page-browse > .page-title > div');
  if (_btnArea && !document.getElementById('share-btn-collection')) {
    var _shareBtn = document.createElement('button');
    _shareBtn.id = 'share-btn-collection';
    _shareBtn.className = 'btn';
    _shareBtn.onclick = function() { if (typeof startShareMode === 'function') startShareMode('collection'); };
    _shareBtn.style.cssText = 'display:flex;align-items:center;gap:0.4rem;border:1.5px solid #2ecc71;color:#2ecc71;background:rgba(46,204,113,0.1);font-weight:600;font-size:0.85rem;padding:0.5rem 0.9rem';
    _shareBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> Share';
    _btnArea.appendChild(_shareBtn);
  }
  // Update table headers for collection view
  if (typeof _renderCollectionHeader === 'function') _renderCollectionHeader();
  var _fbOwned = document.querySelector('#page-browse .filter-bar');
  if (_fbOwned) _fbOwned.style.display = 'none';
  var _tbl2 = document.querySelector('#page-browse .item-table');
  if (_tbl2) _tbl2.classList.add('collection-view');
  var _leg = document.getElementById('collection-icon-legend');
  if (_leg) _leg.style.display = 'flex';
  renderBrowse();
  // Update tab visibility for collection context
  state._browseTab = 'items';
  renderBrowseTab('items');
  // QE-only checkbox removed (Phase 3 streamline) — Quick Entry is being
  // deprecated. Block the injection and also strip any stale element.
  setTimeout(function() {
    var stale = document.getElementById('qe-only-toggle');
    if (stale) stale.remove();
    return;
    // (legacy body retained below but unreachable; will be deleted in a follow-up.)
    // eslint-disable-next-line no-unreachable
    if (document.getElementById('qe-only-toggle')) return;
    var wrap = document.getElementById('browse-search-wrap');
    if (!wrap || !wrap.parentNode) return;
    var lbl = document.createElement('label');
    lbl.id = 'qe-only-toggle';
    lbl.title = 'Show only Quick Entry items';
    lbl.style.cssText = 'display:flex;align-items:center;gap:0.35rem;flex-shrink:0;'
      + 'font-size:0.8rem;color:var(--text-dim);cursor:pointer;'
      + 'padding:0.35rem 0.7rem;background:var(--bg-card);'
      + 'border:1.5px solid var(--border);border-radius:14px;'
      + 'white-space:nowrap;user-select:none';
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = 'qe-only-cb';
    cb.checked = state.filters.quickEntry === 'quick';
    cb.style.cssText = 'margin:0;cursor:pointer;accent-color:var(--accent)';
    cb.onchange = function() {
      state.filters.quickEntry = this.checked ? 'quick' : '';
      renderBrowse();
    };
    lbl.appendChild(cb);
    var txt = document.createElement('span');
    txt.textContent = '⚡ QE only';
    lbl.appendChild(txt);
    // Insert as sibling immediately AFTER the search bar wrapper
    wrap.parentNode.insertBefore(lbl, wrap.nextSibling);
  }, 50);
}

function removeQEFilter() {
  // Session 158: clean up checkbox (newer UI) AND legacy dropdown if present.
  var el = document.getElementById('qe-only-toggle');
  if (el) el.remove();
  var legacy = document.getElementById('filter-quick-inline');
  if (legacy) legacy.remove();
  state.filters.quickEntry = '';
}

// ── filterByType (from between non-browse blocks) ───────────
function filterByType(type) { document.getElementById('filter-type').value = type; showPage('browse'); applyFilters(); }

function buildBrowse() {
  // Step 3a: restore the section the user last had open (from chip state).
  try {
    var _raw = localStorage.getItem('lv_browse_filter_state');
    if (_raw) {
      var _st = JSON.parse(_raw);
      var _savedSec = (_st && _st.section) ? _st.section : 'items';
      var _tab = (typeof _PH_SECTION_TO_TAB !== 'undefined' && _PH_SECTION_TO_TAB[_savedSec]) || _savedSec;
      if (_tab && _tab !== 'items' && typeof renderBrowseTab === 'function') {
        renderBrowseTab(_tab);
        return;
      }
    }
  } catch(e) {}
  renderBrowse();
}

var _lastBrowseHash = '';

// ── Browse Tab Controller ─────────────────────────────────────────────────────
function renderBrowseTab(tab) {
  const inCollection = !!state.filters.owned;
  // Session 115: mockups has no master equivalent; everything else is
  // navigable in both views. Collection view now filters each tab's
  // render to owned data instead of redirecting clicks back to Items.
  if (tab === 'mockups' && !inCollection) tab = 'items';
  state._browseTab = tab || 'items';

  // Tab button visibility:
  //   - Science/Construction/Paper/Other/Service/IS: hide only if the
  //     active era doesn't carry that sheet tab. Visible in both views.
  //   - Mockups: collection view only (it's user-data only).
  var _tabKeyMap = {'btab-science':'science','btab-construction':'construction','btab-paper':'paper','btab-other':'other','btab-service':'serviceTools'};
  ['btab-science','btab-construction','btab-paper','btab-other','btab-service'].forEach(function(id) {
    var b = document.getElementById(id);
    if (b) b.style.display = !SHEET_TABS[_tabKeyMap[id]] ? 'none' : '';
  });
  const isBtn = document.getElementById('btab-is');
  if (isBtn) isBtn.style.display = !SHEET_TABS.instrSheets ? 'none' : '';
  const moBtn = document.getElementById('btab-mockups');
  if (moBtn) moBtn.style.display = inCollection ? '' : 'none';
  const catBtn = document.getElementById('btab-catalogs');
  if (catBtn) catBtn.textContent = inCollection ? 'My Catalogs & Paper Items' : 'Catalogs';

  const tabs = { items:'btab-items', sets:'btab-sets', catalogs:'btab-catalogs', science:'btab-science', construction:'btab-construction', paper:'btab-paper', other:'btab-other', service:'btab-service', is:'btab-is', mockups:'btab-mockups' };
  Object.entries(tabs).forEach(([key, id]) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    const active = key === state._browseTab;
    btn.style.borderBottom = active ? '2px solid var(--accent)' : '2px solid transparent';
    btn.style.color = active ? 'var(--accent)' : 'var(--text-dim)';
  });

  const panels = { items:'browse-items-panel', sets:'browse-sets-panel', catalogs:'browse-catalogs-panel', science:'browse-science-panel', construction:'browse-construction-panel', paper:'browse-paper-panel', other:'browse-other-panel', service:'browse-service-panel', is:'browse-is-panel', mockups:'browse-mockups-panel' };
  Object.entries(panels).forEach(([key, id]) => {
    const el = document.getElementById(id);
    if (el) el.style.display = key === state._browseTab ? '' : 'none';
  });

  const filterBar = document.querySelector('#page-browse .filter-bar');
  const disclaimer = document.getElementById('disclaimer-browse');
  const identBtn = document.getElementById('identify-btn');
  const onItems = state._browseTab === 'items';
  if (filterBar) filterBar.style.display = (onItems && !state.filters.owned) ? '' : 'none';
  if (disclaimer) disclaimer.style.display = (onItems && _prefGet('lv_show_disclaimer', 'true') === 'true') ? 'flex' : 'none';
  if (identBtn) identBtn.style.display = inCollection ? 'none' : (onItems ? '' : 'none');
  // Session 157: top search bar is items-only; each sub-panel (catalogs,
  // sets, IS, science, etc.) has its own search input.
  const searchWrap = document.getElementById('browse-search-wrap');
  if (searchWrap) searchWrap.style.display = onItems ? '' : 'none';

  const titleEl = document.getElementById('browse-title-text');
  const mTitles = { items:'Master Catalog', sets:'Set Master List', catalogs:'Catalog List', science:'Science Sets', construction:'Construction Sets', paper:'Paper Items', other:'Other Items', service:'Service Tools', is:'Instruction Sheet List' };
  const cTitles = { items:'My Collection', sets:'My Sets', catalogs:'My Catalogs & Paper Items', mockups:'My Mock-ups & Other Items' };
  if (titleEl) titleEl.textContent = (inCollection ? cTitles : mTitles)[state._browseTab] || 'Master Catalog';

  if (state._browseTab === 'items') renderBrowse();
  else if (state._browseTab === 'sets') renderSetsTab();
  else if (state._browseTab === 'catalogs') renderCatalogsTab();
  else if (state._browseTab === 'is') renderISTab();
  else if (state._browseTab === 'science') renderMasterSubTab('science');
  else if (state._browseTab === 'construction') renderMasterSubTab('construction');
  else if (state._browseTab === 'paper') renderMasterSubTab('paper');
  else if (state._browseTab === 'other') renderMasterSubTab('other');
  else if (state._browseTab === 'service') renderMasterSubTab('service');
  else if (state._browseTab === 'mockups') renderMockupsOtherTab();
  // Step 2: keep hierarchy chip row in sync when the old tab strip is used.
  if (typeof _renderHierarchyChips === 'function') _renderHierarchyChips();
}

function renderSetsTab() {
  // v0.9.875: browse panel ids renamed browse-sets-* — they used to clash
  // with the Complete Sets page's sets-search/sets-tbody ids, which sent
  // that page's desktop rows into this hidden panel.
  const tbody = document.getElementById('browse-sets-tbody');
  const countEl = document.getElementById('browse-sets-count');
  if (!tbody) return;
  const inColl = !!state.filters.owned;
  const q = (document.getElementById('browse-sets-search')?.value || '').trim().toLowerCase();

  // Build owned set lookup from My Sets personal tab.
  // Session 115: also keep the My Sets KEY for each entry so action
  // buttons can dispatch to _collection* handlers correctly.
  const ownedSets = {};       // keyed by setNum lowercase -> [mySet entries]
  const mySetKeyByEntry = new Map();
  Object.entries(state.mySetsData || {}).forEach(function(entry) {
    const k = entry[0], ms = entry[1];
    const setKey = (ms.setNum || '').toLowerCase();
    if (!ownedSets[setKey]) ownedSets[setKey] = [];
    ownedSets[setKey].push(ms);
    mySetKeyByEntry.set(ms, k);
  });

  const sets = (state.setData || []).filter(s => {
    const k = s.setNum.toLowerCase();
    if (inColl) {
      // Only show the specific year variant the user owns
      if (!ownedSets[k]) return false;
      const hasExactYear = ownedSets[k].some(ms => ms.year === s.year);
      const hasAnyYear = ownedSets[k].some(ms => !ms.year);
      if (!hasExactYear && !hasAnyYear) return false;
    }
    if (!q) return true;
    return (s.setNum + ' ' + s.setName + ' ' + s.year + ' ' + s.gauge).toLowerCase().includes(q);
  });
  const emptyMsg = inColl ? 'No sets in your collection yet' : 'No sets found';
  if (countEl) countEl.textContent = sets.length.toLocaleString() + ' set' + (sets.length !== 1 ? 's' : '');
  if (!sets.length) { tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-dim)">${emptyMsg}</td></tr>`; return; }
  window._browseFilteredSets = sets;
  tbody.innerHTML = sets.map((s, si) => {
    const k = s.setNum.toLowerCase();
    const mySet = ownedSets[k] ? ownedSets[k].find(ms => ms.year === s.year) || ownedSets[k][0] : null;
    const owned = !!mySet;
    const isQE = mySet && mySet.quickEntry;
    const worthStr = mySet && mySet.estWorth ? _currencySymbol() + parseFloat(mySet.estWorth).toLocaleString() : '';
    const condStr = mySet && mySet.condition ? mySet.condition : '';
    const itemChips = s.items.slice(0, 6).map(n =>
      `<span style="font-family:var(--font-mono);font-size:0.67rem;padding:1px 5px;border-radius:3px;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim)">${n}</span>`
    ).join(' ') + (s.items.length > 6 ? `<span style="font-size:0.67rem;color:var(--text-dim)"> +${s.items.length - 6}</span>` : '');
    const ownedBadge = owned
      ? `<span style="color:var(--green);font-size:0.75rem;font-weight:700">✓ Owned</span>`
        + (isQE ? ' <span style="color:#e67e22;font-size:0.68rem;font-weight:700" title="Quick Entry">⚡</span>' : '')
        + (worthStr ? `<div style="font-size:0.72rem;color:var(--text-mid);margin-top:2px">${worthStr}</div>` : '')
      : '<span style="color:var(--text-dim);font-size:0.75rem">—</span>';
    // Session 115: action buttons on owned set rows in collection view.
    let actionsHTML = '';
    if (inColl && owned && mySet && typeof _collectionActionsHTML === 'function') {
      const setKey = mySetKeyByEntry.get(mySet);
      if (setKey) actionsHTML = _collectionActionsHTML('sets', setKey, mySet);
    }
    return `<tr onclick="showRefItemPopup(&apos;set&apos;,${si})" style="cursor:pointer${owned ? ';background:rgba(46,204,113,0.04)' : ''}">
      <td><span style="font-family:var(--font-mono);color:var(--accent2)">${s.setNum}</span></td>
      <td style="font-size:0.88rem">${s.setName || '—'}</td>
      <td style="font-size:0.85rem;color:var(--text-mid)">${s.year || '—'}</td>
      <td style="font-size:0.85rem;color:var(--text-mid)">${s.gauge || '—'}</td>
      <td style="font-size:0.82rem">${itemChips || '—'}</td>
      <td style="text-align:center">${ownedBadge}</td>
      ${inColl ? '<td onclick="event.stopPropagation()" style="text-align:right;white-space:nowrap">' + actionsHTML + '</td>' : ''}
    </tr>`;
  }).join('');
}

function renderCatalogsTab() {
  const tbody = document.getElementById('catalogs-tbody');
  const countEl = document.getElementById('catalogs-count');
  if (!tbody) return;
  const inColl = !!state.filters.owned;
  const q = (document.getElementById('catalogs-search')?.value || '').trim().toLowerCase();
  // Session 115: keep ephemera catalog keys so action buttons can
  // dispatch to ephemeraDelete / ForSale / Sold by key.
  const ephOwnedEntries = inColl ? Object.entries(state.ephemeraData?.catalogs || {}) : [];
  const ownedEphCats = ephOwnedEntries.map(function(e) { return e[1]; });
  const ephKeyByItemNum = new Map();
  ephOwnedEntries.forEach(function(e) { ephKeyByItemNum.set(String((e[1] && e[1].itemNum) || '').toLowerCase(), e[0]); });
  const ownedCatIds = new Set(ownedEphCats.map(c => (c.itemNum||'').toLowerCase()));
  const cats = (state.catalogRefData || []).filter(c => {
    if (inColl && !ownedCatIds.has(c.id.toLowerCase())) return false;
    if (!q) return true;
    return (c.id + ' ' + c.year + ' ' + c.type + ' ' + c.title).toLowerCase().includes(q);
  });
  const total = cats.length + (inColl ? ephOwnedEntries.length : 0);
  const emptyMsg = inColl ? 'No catalogs or paper items in your collection yet' : 'No catalogs found';
  if (countEl) countEl.textContent = total.toLocaleString() + ' item' + (total !== 1 ? 's' : '');
  if (!total) { tbody.innerHTML = `<tr><td colspan="${inColl ? 5 : 4}" style="text-align:center;padding:2rem;color:var(--text-dim)">${emptyMsg}</td></tr>`; return; }
  // Session 116: collection-view rows now navigate to the new
  // showNonItemDetailPage so click-into-detail-then-Back returns to
  // the same tab + filters (same UX as Items tab).
  const ephRows = ephOwnedEntries.map(function(entry) {
    const k = entry[0], c = entry[1];
    const actionsHTML = inColl && typeof _collectionActionsHTML === 'function'
      ? _collectionActionsHTML('catalogs', k, c) : '';
    const kEsc = String(k).replace(/'/g, "\\'");
    return '<tr onclick="showNonItemDetailPage(&apos;catalogs&apos;,&apos;' + kEsc + '&apos;)" style="cursor:pointer">'
      + '<td><span style="font-family:var(--font-mono);color:var(--accent2)" title="' + String(c.itemNum || '').replace(/"/g,'&quot;') + '">' + ((typeof _catalogDisplayLabel === 'function') ? _catalogDisplayLabel(c.year, c.catType, c.itemNum) : (c.itemNum || '—')) + '</span></td>'
      + '<td style="font-size:0.85rem;color:var(--text-mid)">' + (c.year || '—') + '</td>'
      + '<td style="font-size:0.85rem">' + (c.catType || '—') + '</td>'
      + '<td style="font-size:0.88rem">' + (c.title || '—') + (c.hasMailer === 'Yes' ? ' <span style="font-size:0.7rem;color:var(--accent2)">(w/ mailer)</span>' : '') + '</td>'
      + (inColl ? '<td onclick="event.stopPropagation()" style="text-align:right;white-space:nowrap">' + actionsHTML + '</td>' : '')
      + '</tr>';
  }).join('');
  window._browseFilteredCats = cats;
  tbody.innerHTML = cats.map((c, ci) => {
    const _catOwned = ownedCatIds.has(c.id.toLowerCase());
    const _catBadge = _catOwned ? '<span style="display:inline-block;font-size:0.6rem;font-weight:700;color:#2ecc71;border:1px solid #2ecc71;border-radius:3px;padding:0 3px;margin-left:4px;vertical-align:middle">✓</span>' : '';
    const _catBg = _catOwned ? 'background:rgba(46,204,113,0.04);' : '';
    let actionsHTML = '';
    let _rowClick = `showRefItemPopup(&apos;catalog&apos;,${ci})`;
    if (inColl && _catOwned && typeof _collectionActionsHTML === 'function') {
      const ephKey = ephKeyByItemNum.get(c.id.toLowerCase());
      if (ephKey) {
        const ephEntry = state.ephemeraData.catalogs[ephKey];
        actionsHTML = _collectionActionsHTML('catalogs', ephKey, ephEntry);
        // Owned in collection view → open detail page instead of master popup
        const kEsc = String(ephKey).replace(/'/g, "\\'");
        _rowClick = `showNonItemDetailPage(&apos;catalogs&apos;,&apos;${kEsc}&apos;)`;
      }
    }
    return `<tr onclick="${_rowClick}" style="cursor:pointer;${_catBg}">
    <td><span style="font-family:var(--font-mono);color:var(--accent2)" title="${c.id}">${(typeof _catalogDisplayLabel === 'function') ? _catalogDisplayLabel(c.year, c.type, c.id) : c.id}</span>${_catBadge}</td>
    <td style="font-size:0.85rem;color:var(--text-mid)">${c.year || '—'}</td>
    <td style="font-size:0.85rem">${c.type || '—'}</td>
    <td style="font-size:0.88rem">${c.title || '—'}</td>
    ${inColl ? '<td onclick="event.stopPropagation()" style="text-align:right;white-space:nowrap">' + actionsHTML + '</td>' : ''}
  </tr>`;
  }).join('') + ephRows;
}

function renderISTab() {
  const tbody = document.getElementById('is-tbody');
  const countEl = document.getElementById('is-count');
  if (!tbody) return;
  const q = (document.getElementById('is-search')?.value || '').trim().toLowerCase();
  const inColl = !!state.filters.owned;

  // Session 115: collection view shows the user's owned Instruction
  // Sheets from state.isData rather than the master IS catalog.
  if (inColl) {
    const ownedRows = Object.values(state.isData || {}).filter(function(is) {
      if (!q) return true;
      return ((is.sheetNum || '') + ' ' + (is.linkedItem || '') + ' ' + (is.notes || '')).toLowerCase().includes(q);
    });
    if (countEl) countEl.textContent = ownedRows.length.toLocaleString() + ' sheet' + (ownedRows.length !== 1 ? 's' : '');
    if (!ownedRows.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--text-dim)">No instruction sheets in your collection yet</td></tr>';
      return;
    }
    const isKeyByEntry = new Map();
    Object.keys(state.isData || {}).forEach(function(k) { isKeyByEntry.set(state.isData[k], k); });
    tbody.innerHTML = ownedRows.map(function(is) {
      const cond = is.condition ? 'Cond ' + is.condition : '—';
      const worth = is.estValue ? _currencySymbol() + parseFloat(is.estValue).toLocaleString() : '—';
      const k = isKeyByEntry.get(is) || '';
      const actionsHTML = k && typeof _collectionActionsHTML === 'function'
        ? _collectionActionsHTML('is', k, is)
        : '';
      // Session 116: row navigates to the generic detail page.
      const kEsc = String(k).replace(/'/g, "\\'");
      return '<tr onclick="showNonItemDetailPage(&apos;is&apos;,&apos;' + kEsc + '&apos;)" style="cursor:pointer">'
        + '<td><span style="font-family:var(--font-mono);color:var(--accent2)">' + (is.sheetNum || '—') + '</span></td>'
        + '<td style="font-family:var(--font-mono);font-size:0.85rem">' + (is.linkedItem || '—') + '</td>'
        + '<td style="font-size:0.85rem">' + (is.notes || '—') + '</td>'
        + '<td style="font-size:0.82rem;color:var(--text-mid)">' + cond + '</td>'
        + '<td style="font-size:0.82rem;color:var(--text-mid)">' + worth + '</td>'
        + (actionsHTML ? '<td onclick="event.stopPropagation()" style="text-align:right;white-space:nowrap">' + actionsHTML + '</td>' : '')
        + '</tr>';
    }).join('');
    return;
  }

  // Master catalog view (existing behavior)
  const sheets = (state.isRefData || []).filter(s => {
    if (!q) return true;
    return (s.id + ' ' + s.itemNumber + ' ' + s.description + ' ' + s.category).toLowerCase().includes(q);
  });
  if (countEl) countEl.textContent = sheets.length.toLocaleString() + ' sheets';
  if (!sheets.length) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--text-dim)">No instruction sheets found</td></tr>'; return; }
  window._browseFilteredIS = sheets;
  const _ownedISNums = new Set(Object.values(state.isData || {}).map(is => (is.sheetNum||'').toLowerCase()));
  tbody.innerHTML = sheets.map((s, si) => {
    const _isOwned = _ownedISNums.has(s.id.toLowerCase());
    const _isBadge = _isOwned ? '<span style="display:inline-block;font-size:0.6rem;font-weight:700;color:#2ecc71;border:1px solid #2ecc71;border-radius:3px;padding:0 3px;margin-left:4px;vertical-align:middle">✓</span>' : '';
    const _isBg = _isOwned ? 'background:rgba(46,204,113,0.04);' : '';
    return `<tr onclick="showRefItemPopup(&apos;is&apos;,${si})" style="cursor:pointer;${_isBg}">
    <td><span style="font-family:var(--font-mono);color:var(--accent2)">${s.id}</span>${_isBadge}</td>
    <td style="font-family:var(--font-mono);font-size:0.85rem">${s.itemNumber || '—'}</td>
    <td style="font-size:0.85rem">${s.description || '—'}</td>
    <td style="font-size:0.82rem;color:var(--text-mid)">${s.category || '—'}</td>
    <td style="font-size:0.82rem;color:var(--text-mid)">${s.variations || '—'}</td>
  </tr>`;
  }).join('');
}

function renderMockupsOtherTab() {
  const tbody = document.getElementById('mockups-tbody');
  const countEl = document.getElementById('mockups-count');
  if (!tbody) return;
  const inColl = !!state.filters.owned;
  const q = (document.getElementById('mockups-search')?.value || '').trim().toLowerCase();
  // Session 115: keep srcType + key on each row so action buttons can
  // dispatch to ephemeraDelete / ForSale / Sold per bucket.
  const rows = [];
  Object.entries(state.ephemeraData?.mockups || {}).forEach(function(entry) {
    const k = entry[0], it = entry[1];
    rows.push({
      srcType: 'mockups', key: k, _raw: it,
      type:'Mock-Up', tc:'#9b59b6',
      id: it.title || it.itemNumRef || '—',
      desc: it.description || '—',
      year: it.year || '—',
      cond: it.condition || '—',
      val:  it.estValue ? _currencySymbol() + parseFloat(it.estValue).toLocaleString() : '—',
    });
  });
  Object.entries(state.ephemeraData?.other || {}).forEach(function(entry) {
    const k = entry[0], it = entry[1];
    rows.push({
      srcType: 'other', key: k, _raw: it,
      type:'Other', tc:'#2ecc71',
      id: it.title || it.itemNum || '—',
      desc: it.description || '—',
      year: it.year || '—',
      cond: it.condition || '—',
      val:  it.estValue ? _currencySymbol() + parseFloat(it.estValue).toLocaleString() : '—',
    });
  });
  const filtered = rows.filter(r => !q || (r.type+' '+r.id+' '+r.desc).toLowerCase().includes(q));
  if (countEl) countEl.textContent = filtered.length.toLocaleString() + ' item' + (filtered.length!==1?'s':'');
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="' + (inColl ? 7 : 6) + '" style="text-align:center;padding:2rem;color:var(--text-dim)">' + (rows.length ? 'No items match' : 'No mock-ups or other items in your collection yet') + '</td></tr>';
    return;
  }
  tbody.innerHTML = filtered.map(function(r) {
    const actionsHTML = inColl && typeof _collectionActionsHTML === 'function'
      ? _collectionActionsHTML(r.srcType, r.key, r._raw) : '';
    // Session 116: row navigates to the generic detail page. srcType
    // is already 'mockups' or 'other' so it routes to the right
    // bucket via NON_ITEM_DETAIL_CONFIG.
    const kEsc = String(r.key).replace(/'/g, "\\'");
    const trOpen = '<tr onclick="showNonItemDetailPage(&apos;' + r.srcType + '&apos;,&apos;' + kEsc + '&apos;)" style="cursor:pointer">';
    return trOpen
      + '<td><span style="font-size:0.72rem;font-weight:700;padding:2px 7px;border-radius:4px;background:' + r.tc + '22;color:' + r.tc + '">' + r.type + '</span></td>'
      + '<td style="font-size:0.88rem;color:var(--accent2)">' + r.id + '</td>'
      + '<td style="font-size:0.85rem;color:var(--text-mid)">' + r.desc + '</td>'
      + '<td style="font-size:0.85rem;color:var(--text-dim)">' + r.year + '</td>'
      + '<td style="font-size:0.85rem">' + r.cond + '</td>'
      + '<td style="font-size:0.85rem;color:var(--accent2)">' + r.val + '</td>'
      + (inColl ? '<td onclick="event.stopPropagation()" style="text-align:right;white-space:nowrap">' + actionsHTML + '</td>' : '')
      + '</tr>';
  }).join('');
}


// ── Collection-view renderer for Science / Construction / Paper / Other / Service sub-tabs ──
// Session 115: replaces the "redirect all these tabs to Items" behavior
// that existed before. Each tab now shows the user's owned entries from
// its appropriate personal-data bucket. Service tools have no dedicated
// bucket (items would go to personalData), so filter state.personalData
// by master-sheet _tab for that one.
function _renderOwnedSubTab(tabKey) {
  const tbody = document.getElementById(tabKey + '-tbody');
  const countEl = document.getElementById(tabKey + '-count');
  if (!tbody) return;
  const q = (document.getElementById(tabKey + '-search')?.value || '').trim().toLowerCase();

  let rows = [];
  if (tabKey === 'science') {
    Object.entries(state.scienceData || {}).forEach(function(entry) {
      const k = entry[0], s = entry[1];
      rows.push({
        _type: 'science', _key: k,
        itemNum: s.itemNum || '—',
        itemType: 'Science Set',
        description: s.description || s.varDetail || '—',
        variation: s.variation || '—',
        varDetail: s.varDetail || '',
        year: s.year || '—',
        _actionsHTML: _collectionActionsHTML('science', k, s),
      });
    });
  } else if (tabKey === 'construction') {
    Object.entries(state.constructionData || {}).forEach(function(entry) {
      const k = entry[0], s = entry[1];
      rows.push({
        _type: 'construction', _key: k,
        itemNum: s.itemNum || '—',
        itemType: 'Construction Set',
        description: s.description || s.varDetail || '—',
        variation: s.variation || '—',
        varDetail: s.varDetail || '',
        year: s.year || '—',
        _actionsHTML: _collectionActionsHTML('construction', k, s),
      });
    });
  } else if (tabKey === 'paper') {
    Object.entries((state.ephemeraData && state.ephemeraData.paper) || {}).forEach(function(entry) {
      const k = entry[0], p = entry[1];
      rows.push({
        _type: 'paper', _key: k,
        itemNum: p.itemNum || '—',
        itemType: p.paperType || 'Paper',
        description: p.title || p.description || '—',
        variation: '—',
        varDetail: '',
        year: p.year || '—',
        _actionsHTML: _collectionActionsHTML('paper', k, p),
      });
    });
  } else if (tabKey === 'other') {
    Object.entries((state.ephemeraData && state.ephemeraData.other) || {}).forEach(function(entry) {
      const k = entry[0], o = entry[1];
      rows.push({
        _type: 'other', _key: k,
        itemNum: o.itemNum || '—',
        itemType: 'Other',
        description: o.title || o.description || '—',
        variation: '—',
        varDetail: '',
        year: o.year || '—',
        _actionsHTML: _collectionActionsHTML('other', k, o),
      });
    });
  } else if (tabKey === 'service') {
    // No dedicated bucket — look at personalData items whose master
    // row lives on the Service Tools sheet.
    const svcTab = (SHEET_TABS && SHEET_TABS.serviceTools) || '';
    Object.entries(state.personalData || {}).forEach(function(entry) {
      const k = entry[0], pd = entry[1];
      if (!pd || !pd.owned) return;
      const master = typeof findMaster === 'function' ? findMaster(pd.itemNum, '', pd) : null;
      if (!master || master._tab !== svcTab) return;
      rows.push({
        _type: 'service', _key: k,
        itemNum: pd.itemNum || '—',
        itemType: (master && master.itemType) || 'Service Tool',
        description: (master && master.description) || '—',
        variation: pd.variation || (master && master.variation) || '—',
        varDetail: (master && master.varDetail) || '',
        year: (master && master.yearProd) || '—',
        _actionsHTML: _collectionActionsHTML('service', k, pd),
      });
    });
  }

  const filtered = rows.filter(function(r) {
    if (!q) return true;
    var h = (r.itemNum + ' ' + r.itemType + ' ' + r.description + ' ' + r.variation + ' ' + r.varDetail).toLowerCase();
    return h.includes(q);
  });

  if (countEl) countEl.textContent = filtered.length.toLocaleString() + ' item' + (filtered.length !== 1 ? 's' : '');

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-dim)">'
      + (rows.length === 0 ? 'Nothing here in your collection yet' : 'No matches')
      + '</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(function(r) {
    var vd = r.varDetail || '';
    if (vd.length > 80) vd = vd.substring(0, 77) + '…';
    // Session 116: row navigates to generic detail page. Action-cell
    // clicks already stop propagation so the buttons still work.
    var _kEsc = String(r._key).replace(/'/g, "\\'");
    var _trOpen = '<tr onclick="showNonItemDetailPage(&apos;' + r._type + '&apos;,&apos;' + _kEsc + '&apos;)" style="cursor:pointer">';
    return _trOpen
      + '<td><span class="item-num">' + r.itemNum + '</span>' + ((typeof eraBadgeHTML === 'function' && window.ERA_BADGES && window.ERA_BADGES.showInBrowse) ? eraBadgeHTML(r._tab || 'Lionel PW - Items') : '') + '</td>'
      + '<td><span class="tag">' + (typeof getTypeBucketLabel === 'function' ? getTypeBucketLabel(r) : r.itemType) + '</span></td>'
      + '<td>' + r.description + '</td>'
      + '<td>' + r.variation + '</td>'
      + '<td>' + (vd || '<span class="text-dim">—</span>') + '</td>'
      + '<td class="text-dim">' + r.year + '</td>'
      + (r._actionsHTML ? '<td onclick="event.stopPropagation()" style="text-align:right;white-space:nowrap">' + r._actionsHTML + '</td>' : '')
      + '</tr>';
  }).join('');
}

// Session 115: row-level action buttons for non-Items collection tabs.
// All four actions (Add to For Sale, Add to Sold, Add to Upgrade, Remove)
// are now wired across every non-Items type. Each type dispatches to
// the right backend:
//   paper / other          -> existing ephemera helpers
//   science / construction -> new _ncShow* modals + Science/Construction sheet
//   is                     -> new _ncShow* modals + Instruction Sheets sheet
//   service                -> existing Lionel collection-action funcs
function _collectionActionsHTML(type, key, entry) {
  const esc = function(s) { return String(s == null ? '' : s).replace(/'/g, "\\'"); };
  const btnStyle = 'padding:0.25rem 0.5rem;border-radius:5px;font-size:0.7rem;cursor:pointer;font-family:var(--font-body);border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);margin-left:0.25rem';
  const keyArg = "'" + esc(key) + "'";
  const typeArg = "'" + esc(type) + "'";
  const fsBtn = '<button onclick="event.stopPropagation();_collectionForSale(' + typeArg + ',' + keyArg + ')" style="' + btnStyle + ';border-color:#e67e22;color:#e67e22">Add to For Sale</button>';
  const sdBtn = '<button onclick="event.stopPropagation();_collectionSold(' + typeArg + ',' + keyArg + ')" style="' + btnStyle + ';border-color:#2ecc71;color:#2ecc71">Add to Sold</button>';
  const upBtn = '<button onclick="event.stopPropagation();_collectionUpgrade(' + typeArg + ',' + keyArg + ')" style="' + btnStyle + ';border-color:#8b5cf6;color:#8b5cf6">Add to Upgrade</button>';
  const rmBtn = '<button onclick="event.stopPropagation();_collectionRemove(' + typeArg + ',' + keyArg + ')" style="' + btnStyle + ';color:#f05008">Remove</button>';
  return fsBtn + sdBtn + upBtn + rmBtn;
}

// ── Dispatchers ─────────────────────────────────────────────────────
async function _collectionRemove(type, key) {
  if (type === 'paper' || type === 'other' || type === 'catalogs' || type === 'mockups') {
    if (typeof ephemeraDelete === 'function') ephemeraDelete(type, key);
    return;
  }
  if (type === 'science' || type === 'construction') return _removeScienceOrConstruction(type, key);
  if (type === 'is')                                  return _removeInstructionSheet(key);
  if (type === 'sets')                                return _removeOwnedSet(key);
  if (type === 'service') {
    const pd = state.personalData[key];
    if (!pd) return;
    if (typeof removeCollectionItem === 'function') {
      removeCollectionItem(pd.itemNum, pd.variation || '', pd.row, pd.inventoryId);
    }
    return;
  }
}

function _collectionForSale(type, key) {
  // Paper / Other / Catalogs / Mockups all live in state.ephemeraData
  // and have an existing ephemeraForSale flow that handles their row
  // shape correctly. Use it directly.
  if (type === 'paper' || type === 'other' || type === 'catalogs' || type === 'mockups') {
    return ephemeraForSale(type, key);
  }
  if (type === 'service') return _serviceCollectionAction('forsale', key);
  // Science / Construction / IS / Sets — generic modal
  return _ncShowFsSoldModal(type, key, 'forsale');
}

function _collectionSold(type, key) {
  if (type === 'paper' || type === 'other' || type === 'catalogs' || type === 'mockups') {
    return ephemeraSold(type, key);
  }
  if (type === 'service') return _serviceCollectionAction('sold', key);
  return _ncShowFsSoldModal(type, key, 'sold');
}

function _collectionUpgrade(type, key) {
  if (type === 'service') return _serviceCollectionAction('upgrade', key);
  // Paper / other / catalogs / mockups / science / construction / is /
  // sets — single upgrade modal. _getNonLionelEntry handles the lookup
  // for each type.
  return _ncShowUpgradeModal(type, key);
}

// ── Service tools dispatch (uses existing Lionel flows) ─────────────
function _serviceCollectionAction(action, pdKey) {
  const pd = state.personalData[pdKey];
  if (!pd) return;
  const master = typeof findMaster === 'function' ? findMaster(pd.itemNum, '', pd) : null;
  const globalIdx = master && state.masterData ? _masterIdxOf(master) : -1;
  const itemNum = pd.itemNum;
  const variation = pd.variation || '';
  if (action === 'forsale' && typeof collectionActionForSale === 'function') {
    collectionActionForSale(globalIdx, itemNum, variation, pd.row, pd.inventoryId);
  } else if (action === 'sold' && typeof collectionActionSold === 'function') {
    collectionActionSold(globalIdx, itemNum, variation, pd.row, pd.inventoryId);
  } else if (action === 'upgrade' && typeof showAddToUpgradeModal === 'function') {
    showAddToUpgradeModal(itemNum, variation, pd.row, pd.inventoryId);
  }
}

// ── Generic "non-Lionel" entry lookup ───────────────────────────────
function _getNonLionelEntry(type, key) {
  if (type === 'science')      return state.scienceData ? state.scienceData[key] : null;
  if (type === 'construction') return state.constructionData ? state.constructionData[key] : null;
  if (type === 'is')           return state.isData ? state.isData[key] : null;
  if (type === 'paper')        return (state.ephemeraData && state.ephemeraData.paper)    ? state.ephemeraData.paper[key]    : null;
  if (type === 'other')        return (state.ephemeraData && state.ephemeraData.other)    ? state.ephemeraData.other[key]    : null;
  if (type === 'catalogs')     return (state.ephemeraData && state.ephemeraData.catalogs) ? state.ephemeraData.catalogs[key] : null;
  if (type === 'mockups')      return (state.ephemeraData && state.ephemeraData.mockups)  ? state.ephemeraData.mockups[key]  : null;
  if (type === 'sets')         return state.mySetsData ? state.mySetsData[key] : null;
  return null;
}

// Resolve an itemNum + display title for a non-Lionel entry.
// IS uses sheetNum as the saleable identifier; sets use setNum;
// everything else uses the entry's itemNum.
function _ncIdentifiers(type, entry) {
  if (!entry) return { itemNum: '', variation: '', title: '' };
  if (type === 'is') {
    return {
      itemNum: entry.sheetNum || ('IS-' + (entry.row || '')),
      variation: '',
      title: 'IS ' + (entry.sheetNum || '') + (entry.linkedItem ? ' (for ' + entry.linkedItem + ')' : ''),
    };
  }
  if (type === 'sets') {
    return {
      itemNum: entry.setNum || entry.itemNum || '',
      variation: '',
      title: entry.setName || entry.description || entry.setNum || '',
    };
  }
  return {
    itemNum: entry.itemNum || '',
    variation: entry.variation || '',
    title: entry.description || entry.title || entry.itemNum || '',
  };
}

// Remove an owned set from the My Sets tab.
async function _removeOwnedSet(key) {
  const entry = state.mySetsData && state.mySetsData[key];
  if (!entry) return;
  const label = entry.setName || entry.setNum || 'this set';
  var ok = (typeof appConfirm === 'function')
    ? await appConfirm('Remove "' + label + '" from your collection?', { danger: true, ok: 'Remove' })
    : confirm('Remove "' + label + '" from your collection?');
  if (!ok) return;
  if (entry.row && typeof entry.row === 'number' && entry.row >= 3 && entry.row < 1000000) {
    const blanks = [Array(14).fill('')];
    sheetsUpdate(state.personalSheetId, 'My Sets!A' + entry.row + ':N' + entry.row, blanks)
      .catch(function(e) { console.warn('remove set row', e); });
  }
  delete state.mySetsData[key];
  if (typeof _cachePersonalData === 'function') _cachePersonalData();
  showToast('✓ Removed from collection');
  if (typeof renderBrowse === 'function') renderBrowse();
  if (typeof buildDashboard === 'function') buildDashboard();
}

// ── Generic For Sale / Sold modal for science / construction / is ──
function _ncShowFsSoldModal(type, key, action) {
  const entry = _getNonLionelEntry(type, key);
  if (!entry) return;
  const ids = _ncIdentifiers(type, entry);
  const isSold = action === 'sold';
  const title = ids.title || ids.itemNum;
  const today = new Date().toISOString().slice(0, 10);
  const condition = entry.condition || '';
  const estValue  = entry.estValue || '';
  const accent = isSold ? '#2ecc71' : '#e67e22';
  const heading = isSold ? 'Mark as Sold' : 'List For Sale';
  const cta     = isSold ? '💰 Mark as Sold' : '🏷️ List For Sale';

  const ov = document.createElement('div');
  ov.id = '_nc-action-modal';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10010;display:flex;align-items:center;justify-content:center;padding:1.5rem';
  ov.innerHTML =
      '<div style="background:var(--surface);border-radius:14px;padding:1.5rem;max-width:380px;width:100%;border:1px solid var(--border)">'
    +   '<div style="font-family:var(--font-head);font-size:1rem;font-weight:700;margin-bottom:0.2rem">' + heading + '</div>'
    +   '<div style="font-family:var(--font-mono);color:var(--accent);font-size:0.88rem;margin-bottom:0.15rem">' + (ids.itemNum || '—') + '</div>'
    +   '<div style="font-size:0.8rem;color:var(--text-dim);margin-bottom:1rem">' + title + '</div>'
    +   '<div style="margin-bottom:0.7rem">'
    +     '<div style="font-size:0.72rem;color:var(--text-dim);margin-bottom:0.2rem;text-transform:uppercase;letter-spacing:0.06em">' + (isSold ? 'Sale Price ($)' : 'Asking Price ($)') + '</div>'
    +     '<input type="number" id="_nc-price" min="0" step="0.01" placeholder="0.00" value="' + (estValue || '') + '" '
    +       'style="width:100%;padding:0.5rem 0.7rem;border-radius:7px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:var(--font-mono);font-size:0.95rem;outline:none;box-sizing:border-box">'
    +   '</div>'
    +   '<div style="margin-bottom:1.1rem">'
    +     '<div style="font-size:0.72rem;color:var(--text-dim);margin-bottom:0.2rem;text-transform:uppercase;letter-spacing:0.06em">' + (isSold ? 'Date Sold' : 'Date Listed') + '</div>'
    +     '<input type="date" id="_nc-date" value="' + today + '" '
    +       'style="width:100%;padding:0.5rem 0.7rem;border-radius:7px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none;box-sizing:border-box">'
    +   '</div>'
    +   (isSold
        ? '<div style="margin-bottom:1.1rem">'
        +   '<div style="font-size:0.72rem;color:var(--text-dim);margin-bottom:0.2rem;text-transform:uppercase;letter-spacing:0.06em">Also remove from collection?</div>'
        +   '<div style="display:flex;gap:0.5rem">'
        +     '<label style="display:flex;align-items:center;gap:0.4rem;font-size:0.85rem;cursor:pointer"><input type="radio" name="_nc-rm" id="_nc-rm-yes" checked> Yes, remove it</label>'
        +     '<label style="display:flex;align-items:center;gap:0.4rem;font-size:0.85rem;cursor:pointer"><input type="radio" name="_nc-rm" id="_nc-rm-no"> Keep in collection</label>'
        +   '</div>'
        + '</div>'
        : '')
    +   '<div style="display:flex;gap:0.6rem">'
    +     '<button onclick="document.getElementById(\'_nc-action-modal\').remove()" '
    +       'style="flex:1;padding:0.65rem;border-radius:8px;border:1px solid var(--border);background:none;color:var(--text-dim);font-family:var(--font-body);cursor:pointer">Cancel</button>'
    +     '<button id="_nc-save" '
    +       'style="flex:2;padding:0.65rem;border-radius:8px;border:none;background:' + accent + ';color:white;font-family:var(--font-body);font-weight:600;cursor:pointer">' + cta + '</button>'
    +   '</div>'
    + '</div>';
  document.body.appendChild(ov);
  if (window.BackStack && BackStack.wire) BackStack.wire(ov); // v0.9.807 TODO-012: device Back closes this pop-up

  document.getElementById('_nc-save').onclick = async function() {
    const price = document.getElementById('_nc-price').value;
    const date  = document.getElementById('_nc-date').value;
    const removeIt = isSold ? document.getElementById('_nc-rm-yes').checked : false;
    ov.remove();
    try {
      if (isSold) {
        // Audit H4 fix: use _buildSoldRow helper for full 20-col schema.
        const row = (typeof _buildSoldRow === 'function')
          ? _buildSoldRow({
              itemNum: ids.itemNum,
              variation: ids.variation,
              copy: '1',
              condition: condition,
              pricePaid: '',
              salePrice: price,
              dateSold: date,
              notes: title,
              inventoryId: '',
              manufacturer: ((typeof _brandOfItem === 'function' && _brandOfItem(ids.itemNum)) || (typeof _getEraManufacturer === 'function' ? _getEraManufacturer() : '')),
            })
          : [ ids.itemNum, ids.variation, '1', condition, '', price, date, title, '',
              ((typeof _brandOfItem === 'function' && _brandOfItem(ids.itemNum)) || (typeof _getEraManufacturer === 'function' ? _getEraManufacturer() : '')),
              '','','','','','','','','','' ];
        await sheetsAppend(state.personalSheetId, 'Sold!A:T', [row]);
        if (removeIt) await _ncRemoveSourceRow(type, key);
        showToast('✓ Marked as sold');
      } else {
        // For Sale columns: Item#, Variation, Condition, AskingPrice, DateListed, Notes, OrigPrice, EstWorth, InventoryID, Manufacturer
        const row = [
          ids.itemNum, ids.variation,
          condition, price, date, title,
          '', estValue || '',
          '',
          ((typeof _brandOfItem === 'function' && _brandOfItem(ids.itemNum)) || (typeof _getEraManufacturer === 'function' ? _getEraManufacturer() : '')),
        ];
        await sheetsAppend(state.personalSheetId, 'For Sale!A:J', [row]);
        showToast('✓ Listed for sale');
      }
      if (typeof _cachePersonalData === 'function') _cachePersonalData();   // v0.9.697
      if (typeof renderBrowse === 'function') renderBrowse();
      if (typeof buildDashboard === 'function') buildDashboard();
    } catch(e) {
      showToast('Error: ' + e.message, 4000, true);
    }
  };
}

// Remove the source row across all non-Lionel buckets.
async function _ncRemoveSourceRow(type, key) {
  const entry = _getNonLionelEntry(type, key);
  if (!entry) return;
  const sheetMap = {
    science: { name: 'Science Sets', cols: 15 },
    construction: { name: 'Construction Sets', cols: 15 },
    is: { name: 'Instruction Sheets', cols: 11 },
    paper: { name: 'Paper Items', cols: 14 },
    other: { name: 'Other Lionel', cols: 14 },
  };
  const cfg = sheetMap[type];
  if (!cfg) return;
  if (entry.row && typeof entry.row === 'number' && entry.row >= 3 && entry.row < 1000000) {
    const lastCol = String.fromCharCode(64 + cfg.cols);
    const blanks = [Array(cfg.cols).fill('')];
    sheetsUpdate(state.personalSheetId, cfg.name + '!A' + entry.row + ':' + lastCol + entry.row, blanks)
      .catch(function(e) { console.warn('remove source row ' + type, e); });
  }
  // Remove from local state
  if (type === 'science')      delete state.scienceData[key];
  else if (type === 'construction') delete state.constructionData[key];
  else if (type === 'is')      delete state.isData[key];
  else if (type === 'paper' || type === 'other') {
    if (state.ephemeraData && state.ephemeraData[type]) delete state.ephemeraData[type][key];
  }
  if (typeof _cachePersonalData === 'function') _cachePersonalData();
}

// ── Generic Upgrade modal for paper / other / science / construction / is ──
function _ncShowUpgradeModal(type, key) {
  const entry = _getNonLionelEntry(type, key);
  if (!entry) return;
  const ids = _ncIdentifiers(type, entry);
  const title = ids.title || ids.itemNum;

  const ov = document.createElement('div');
  ov.id = '_nc-upgrade-modal';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10010;display:flex;align-items:center;justify-content:center;padding:1.5rem';
  ov.innerHTML =
      '<div class="rr-card">'
    +   '<div style="font-family:var(--font-head);font-size:1rem;font-weight:700;color:#8b5cf6;margin-bottom:0.2rem">↑ Add to Upgrade List</div>'
    +   '<div style="font-family:var(--font-mono);color:var(--accent);font-size:0.88rem;margin-bottom:0.15rem">' + (ids.itemNum || '—') + '</div>'
    +   '<div style="font-size:0.8rem;color:var(--text-dim);margin-bottom:1rem">' + title + '</div>'
    +   '<div style="margin-bottom:0.75rem">'
    +     '<div style="font-size:0.72rem;color:var(--text-dim);margin-bottom:0.2rem;text-transform:uppercase;letter-spacing:0.06em">Priority</div>'
    +     '<select id="_nc-up-pri" style="width:100%;padding:0.5rem 0.7rem;border-radius:7px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none">'
    +       '<option value="High">High</option><option value="Medium" selected>Medium</option><option value="Low">Low</option>'
    +     '</select>'
    +   '</div>'
    +   '<div style="margin-bottom:1.1rem">'
    +     '<div style="font-size:0.72rem;color:var(--text-dim);margin-bottom:0.2rem;text-transform:uppercase;letter-spacing:0.06em">Max price (optional)</div>'
    +     '<input type="number" id="_nc-up-price" min="0" step="0.01" placeholder="0.00" '
    +       'style="width:100%;padding:0.5rem 0.7rem;border-radius:7px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:var(--font-mono);font-size:0.95rem;outline:none;box-sizing:border-box">'
    +   '</div>'
    +   '<div style="display:flex;gap:0.6rem">'
    +     '<button onclick="document.getElementById(\'_nc-upgrade-modal\').remove()" '
    +       'style="flex:1;padding:0.65rem;border-radius:8px;border:1px solid var(--border);background:none;color:var(--text-dim);font-family:var(--font-body);cursor:pointer">Cancel</button>'
    +     '<button id="_nc-up-save" '
    +       'style="flex:2;padding:0.65rem;border-radius:8px;border:none;background:#8b5cf6;color:white;font-family:var(--font-body);font-weight:600;cursor:pointer">↑ Add</button>'
    +   '</div>'
    + '</div>';
  document.body.appendChild(ov);
  if (window.BackStack && BackStack.wire) BackStack.wire(ov); // v0.9.807 TODO-012: device Back closes this pop-up

  document.getElementById('_nc-up-save').onclick = async function() {
    const priority = document.getElementById('_nc-up-pri').value || 'Medium';
    const price    = document.getElementById('_nc-up-price').value || '';
    ov.remove();
    try {
      // Audit H5 fix: tab name was 'Upgrade' (wrong) + 6-col range. Real schema
      // is 'Upgrade List' with 8 cols matching UPGRADE_HEADERS: itemNum,
      // variation, priority, targetCondition, maxPrice, notes, inventoryId,
      // manufacturer. saveUpgradeItem already uses this layout — match it.
      const _brOwnedPd = Object.values(state.personalData||{}).find(function(p){
        return p && p.owned && p.itemNum === ids.itemNum && (p.variation||'') === (ids.variation||'');
      });
      const row = [
        ids.itemNum, ids.variation,
        priority,
        '',    // targetCondition (not collected on this quick path)
        price, // maxPrice
        title, // notes
        (_brOwnedPd && _brOwnedPd.inventoryId) || '',
        ((typeof _brandOfItem === 'function' && _brandOfItem(ids.itemNum)) || (typeof _getEraManufacturer === 'function' ? _getEraManufacturer() : 'Lionel')),
      ];
      // Want-Upgrade combined: append 9-col row with List Type='Upgrade'.
      const _wuRow = [row[0], row[1], 'Upgrade', row[2], row[4], row[3], row[6], row[5], row[7]];
      await sheetsAppend(state.personalSheetId, 'Want-Upgrade List!A:I', [_wuRow]);
      // Local state mirror — Phase 3: state.upgradeData is inventoryId-keyed.
      if (!state.upgradeData) state.upgradeData = {};
      const _brPd = Object.values(state.personalData||{}).find(function(p){ return p.itemNum===ids.itemNum && (p.variation||'')===(ids.variation||'') && p.owned; });
      const _brUgEntry = {
        itemNum: ids.itemNum, variation: ids.variation,
        priority, expectedPrice: price,
        notes: title, dateAdded: new Date().toISOString().slice(0, 10),
        inventoryId: (_brPd && _brPd.inventoryId) || '',
      };
      const _brUgKey = _brUgEntry.inventoryId || ('legacy-row-' + Date.now());
      state.upgradeData[_brUgKey] = _brUgEntry;
      if (typeof _cachePersonalData === 'function') _cachePersonalData();   // v0.9.697 — after the state mirror
      showToast('✓ Added to Upgrade list');
      if (typeof buildDashboard === 'function') buildDashboard();
    } catch(e) {
      showToast('Error: ' + e.message, 4000, true);
    }
  };
}

window._collectionForSale = _collectionForSale;
window._collectionSold    = _collectionSold;
window._collectionUpgrade = _collectionUpgrade;

async function _removeScienceOrConstruction(type, key) {
  const bucket = (type === 'science') ? state.scienceData : state.constructionData;
  const entry = bucket && bucket[key];
  if (!entry) return;
  const label = entry.description || entry.itemNum || (type === 'science' ? 'science set' : 'construction set');
  var ok = (typeof appConfirm === 'function')
    ? await appConfirm('Remove "' + label + '" from your collection?', { danger: true, ok: 'Remove' })
    : confirm('Remove "' + label + '" from your collection?');
  if (!ok) return;
  const sheetName = (type === 'science') ? 'Science Sets' : 'Construction Sets';
  if (entry.row && typeof entry.row === 'number' && entry.row >= 3 && entry.row < 1000000) {
    // Sheet has 15 columns (A–O) — blank them all
    const blanks = [Array(15).fill('')];
    sheetsUpdate(state.personalSheetId, sheetName + '!A' + entry.row + ':O' + entry.row, blanks)
      .catch(function(e) { console.warn('remove ' + type + ' row', e); });
  }
  delete bucket[key];
  if (typeof _cachePersonalData === 'function') _cachePersonalData();
  showToast('✓ Removed from collection');
  renderBrowse();
  buildDashboard();
}

async function _removeInstructionSheet(key) {
  const entry = state.isData && state.isData[key];
  if (!entry) return;
  const label = entry.sheetNum || 'this instruction sheet';
  var ok = (typeof appConfirm === 'function')
    ? await appConfirm('Remove "' + label + '" from your collection?', { danger: true, ok: 'Remove' })
    : confirm('Remove "' + label + '" from your collection?');
  if (!ok) return;
  if (entry.row && typeof entry.row === 'number' && entry.row >= 3 && entry.row < 1000000) {
    // IS sheet has 11 columns (A–K)
    const blanks = [Array(11).fill('')];
    sheetsUpdate(state.personalSheetId, 'Instruction Sheets!A' + entry.row + ':K' + entry.row, blanks)
      .catch(function(e) { console.warn('remove IS row', e); });
  }
  delete state.isData[key];
  if (typeof _cachePersonalData === 'function') _cachePersonalData();
  showToast('✓ Removed from collection');
  renderBrowse();
  buildDashboard();
}

window._collectionRemove = _collectionRemove;
window._removeScienceOrConstruction = _removeScienceOrConstruction;
window._removeInstructionSheet = _removeInstructionSheet;

// ── Generic renderer for master data sub-tabs (Science, Construction, Paper, Other, Service Tools) ──
function _getMasterTabMap() {
  return {
    science: SHEET_TABS.science,
    construction: SHEET_TABS.construction,
    paper: SHEET_TABS.paper,
    other: SHEET_TABS.other,
    service: SHEET_TABS.serviceTools,
  };
}

function renderMasterSubTab(tabKey) {
  // Session 115: in My Collection view, show only items the user owns
  // from the appropriate personal-data bucket instead of the master
  // catalog. Action buttons per row come in a follow-up commit.
  if (state.filters && state.filters.owned) {
    _renderOwnedSubTab(tabKey);
    return;
  }
  const masterTab = _getMasterTabMap()[tabKey];
  if (!masterTab) return;
  const tbody = document.getElementById(tabKey + '-tbody');
  const countEl = document.getElementById(tabKey + '-count');
  if (!tbody) return;
  const q = (document.getElementById(tabKey + '-search')?.value || '').trim().toLowerCase();

  const items = (state.masterData || []).map(function(item, idx) {
    return { item: item, globalIdx: idx };
  }).filter(function(r) {
    if (r.item._tab !== masterTab) return false;
    if (!q) return true;
    var _h = (r.item.itemNum + ' ' + (r.item.roadName||'') + ' ' + (r.item.itemType||'') + ' ' + (r.item.description||'') + ' ' + (r.item.varDetail||'')).toLowerCase();
    return _aliasSearch(_h, q);
  });

  if (countEl) countEl.textContent = items.length.toLocaleString() + ' item' + (items.length !== 1 ? 's' : '');

  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-dim)">No items found</td></tr>';
    return;
  }

  tbody.innerHTML = items.map(function(r) {
    var item = r.item;
    var vd = item.varDetail || '';
    if (vd.length > 80) vd = vd.substring(0, 77) + '…';
    var _dispNum = _displayItemNum(item);
    // Check ownership — count how many copies of this item the user owns
    // For P/D items, match the suffixed key (e.g. "210-P|...")
    var _ownedCopies = Object.values(state.personalData).filter(function(p) {
      return p.itemNum === _dispNum && (p.variation || '') === (item.variation || '') && p.owned;
    }).length;
    // Also check Science/Construction dedicated tabs
    if (tabKey === 'science') {
      var _itemStr = String(item.itemNum);
      var _varStr = String(item.variation || '');
      _ownedCopies += Object.values(state.scienceData || {}).filter(function(s) {
        return String(s.itemNum) === _itemStr && String(s.variation || '') === _varStr;
      }).length;
    } else if (tabKey === 'construction') {
      var _itemStr2 = String(item.itemNum);
      var _varStr2 = String(item.variation || '');
      _ownedCopies += Object.values(state.constructionData || {}).filter(function(s) {
        return String(s.itemNum) === _itemStr2 && String(s.variation || '') === _varStr2;
      }).length;
    }
    var _ownBadge = _ownedCopies > 0
      ? '<span style="display:inline-block;font-size:0.6rem;font-weight:700;color:#2ecc71;border:1px solid #2ecc71;border-radius:3px;padding:0 3px;margin-left:4px;vertical-align:middle">' + (_ownedCopies > 1 ? '✓' + _ownedCopies : '✓') + '</span>'
      : '';
    var _rowBg = _ownedCopies > 0 ? 'background:rgba(46,204,113,0.04);' : '';
    return '<tr onclick="browseRowClick(event, ' + r.globalIdx + ')" style="cursor:pointer;' + _rowBg + '">' +
      '<td><span class="item-num">' + _dispNum + '</span>' + _noNumTag(item.itemNum) + _ownBadge + '</td>' +
      '<td><span class="tag">' + ((typeof getTypeBucketLabel === 'function' ? getTypeBucketLabel(item) : item.itemType) || '—') + '</span></td>' +
      '<td>' + (item.description || '<span class="text-dim">—</span>') + '</td>' +
      '<td>' + (item.variation || '<span class="text-dim">—</span>') + '</td>' +
      '<td>' + (vd || '<span class="text-dim">—</span>') + '</td>' +
      '<td class="text-dim">' + (item.yearProd || '—') + '</td>' +
    '</tr>';
  }).join('');
}

function renderBrowse() {
  // v0.9.985 (perf): if NOTHING this page is built from changed since the last
  // successful render (same filters, page, sort, section, era, chips — and no
  // data write since, tracked by _rrDataRev + a cheap collection fingerprint),
  // keep the DOM we already built. Switching back to this page becomes instant
  // instead of re-filtering the whole 60K-row catalog every time.
  try {
    var _rrSig = [
      JSON.stringify(state.filters),
      (typeof _currentEra !== 'undefined' ? _currentEra : ''),
      (typeof _phState === 'function' ? JSON.stringify(_phState() || null) : ''),
      state.currentPage, state.pageSize,
      JSON.stringify(state._collSort || null),
      state._collSection || '',
      (window._rrDataRev || 0),
      (typeof _rrDataFingerprint === 'function' ? _rrDataFingerprint() : ''),
      (typeof shareSigToken === 'function' ? shareSigToken() : ''),   // v0.9.1006
      Math.floor(window.innerWidth / 320)
    ].join('~');
    var _rrTb = document.getElementById('browse-tbody');
    if (_rrSig === window._rrBrowseSig && _rrTb && _rrTb.children.length > 0) return;
    window._rrBrowseSig = null;               // mark stale until this render finishes
    window._rrBrowseSigPending = _rrSig;
  } catch (eSig) { window._rrBrowseSigPending = null; }
  _updateBrowseTabsForEra();
  if (typeof _renderHierarchyChips === 'function') _renderHierarchyChips();
  const { type, road, owned, unowned, boxed, search } = state.filters;
  // v0.9.1007b (Brad): rebuild the collection header in the SAME pass as the
  // rows. It used to be rendered only when you switched INTO My Collection,
  // so turning selection mode on added the gutter cell to every row and left
  // the header one column short — headers sat over the wrong data. Header and
  // body now always agree because nothing can rebuild one without the other.
  if (owned && typeof _renderCollectionHeader === 'function') _renderCollectionHeader();
  // v0.9.986 (Brad): the Show chips route items by WHAT THEY ARE, not where
  // they're stored — an item typed "Paper" (like the Pittman Erect-A-Wire)
  // belongs under Paper Items even though it lives in the items list, and it
  // leaves the Trains view. Computed up here so the main filter below can
  // route train-store rows; 'all' (and mobile, which has no chip bar) keeps
  // the combined view. Falls back to Trains if the chosen section is empty.
  let _collSec = (owned && window.innerWidth > 640) ? (state._collSection || 'trains') : 'all';
  // v0.9.990: typed-row section keys and their itemType matches (one source
  // of truth for the availability guard, the filter, and the chips below).
  const _SEC_TYPES = { paper: ['paper', 'paper item'], catalogs: ['catalog'], mockups: ['mock-up', 'mockup'], other: ['other lionel'] };
  if (_collSec !== 'trains' && _collSec !== 'all') {
    let _secAvail = true;
    try {
      if (_collSec === 'is') _secAvail = Object.keys(state.isData || {}).length > 0;
      else _secAvail = Object.keys((state.ephemeraData || {})[_collSec] || {}).length > 0;
      if (!_secAvail && _SEC_TYPES[_collSec]) {
        const _wantT = _SEC_TYPES[_collSec];
        _secAvail = Object.values(state.personalData || {}).some(function(p) {
          return p && p.owned && _wantT.indexOf(String(p.itemType || '').toLowerCase()) >= 0;
        });
      }
    } catch (eAv) { _secAvail = true; }
    if (!_secAvail) { _collSec = 'trains'; state._collSection = 'trains'; }
  }
  const _collSecFiltered = (_collSec !== 'all' && _collSec !== 'trains');
  // Which section does a train-store row belong to by TYPE? '' = a train.
  // v0.9.990 (Phase 3): Mock-Up and 'Other Lionel' route to their sections
  // too. Plain 'Other' stays a TRAIN type (manual-add off-catalog oddballs).
  const _typeSection = function(it) {
    const t = String(it.itemType || '').toLowerCase();
    if (t === 'paper' || t === 'paper item') return 'paper';
    if (t === 'catalog') return 'catalogs';
    if (t === 'mock-up' || t === 'mockup') return 'mockups';
    if (t === 'other lionel') return 'other';
    return '';
  };
  if (typeof _renderCrossEraSearchBanner === 'function') _renderCrossEraSearchBanner(search);

  // Session 117: master-browse view in All mode + no search = 30K+ rows. Show
  // a friendly prompt instead and bail before any heavy filtering/rendering.
  // (Doesn't fire on My Collection — that view is bounded by what the user owns.)
  // Session 119: bypass gate when a Type or Road filter is set — those narrow
  // results enough that rendering is bounded and the user clearly wants to
  // see results without typing a search.
  // Step 3b: chip state tightens the gate — if user picked any specific
  // mfr/scale/era, we have a manageable subset and should render rather
  // than show the 'type to search' empty state.
  var _stp3b = (typeof _phState === 'function') ? _phState() : null;
  var _chipNarrow = !!(_stp3b && ((_stp3b.manufacturer && _stp3b.manufacturer !== 'any')
                                 || (_stp3b.scale && _stp3b.scale !== 'any')
                                 || (_stp3b.era && _stp3b.era !== 'any')));
  const _hasFilter = !!(type || road) || _chipNarrow;
  if (!owned && typeof _currentEra !== 'undefined' && _currentEra === 'all'
      && (!search || !search.trim()) && !_hasFilter) {
    const _gtbody = document.getElementById('browse-tbody');
    // v0.9.906 (Brad, item [10]): light-blue "pick a filter" prompt instead of
    // loading all 60,000+ items at once. The last-used era/manufacturer/scale
    // filter is remembered across visits (lv_era + lv_browse_filter_state).
    if (_gtbody) _gtbody.innerHTML = '<tr><td colspan="10"><div style="padding:2.5rem 1rem;text-align:center">'
      + '<div style="max-width:520px;margin:0 auto;background:rgba(41,128,185,0.10);border:1px solid #2980b9;border-radius:12px;padding:1.5rem 1.2rem">'
      + '<div style="font-size:2rem;margin-bottom:0.5rem">🔍</div>'
      + '<p style="font-weight:700;font-size:1rem;margin-bottom:0.45rem;color:#2980b9">Please select a filter to start viewing the catalog.</p>'
      + '<p style="font-size:0.85rem;color:var(--text-mid);line-height:1.5">Pick an era, manufacturer, or scale above — or type an item number, road name, or description to search all 60,000+ items across every era.</p>'
      + '</div>'
      + '</div></td></tr>';
    const _gcards = document.getElementById('browse-cards');
    if (_gcards) _gcards.innerHTML = '';
    const _gpag = document.getElementById('browse-pagination');
    if (_gpag) _gpag.style.display = 'none';
    // Session 119: clear ALL three count/info elements so leftover stale text
    // (e.g. "0 items" from a previous zero-result render) doesn't linger.
    const _gcount = document.getElementById('browse-count');
    if (_gcount) _gcount.textContent = '';
    const _grc = document.getElementById('result-count');
    if (_grc) _grc.textContent = '';
    const _gpi = document.getElementById('page-info');
    if (_gpi) _gpi.textContent = '';
    return;
  }

  // Base list: masterData + any personal-only items (e.g. 2343-P not in master)
  // Era filter: when in My Collection mode with a specific era, exclude
  // personal-only items whose master row isn't loaded for this era. They
  // belong to a different era (or to 'all' mode which loads everything).
  // v0.9.985 (perf): this Set only changes when the catalog itself changes —
  // cache it instead of rebuilding 60K strings on every page switch.
  let masterNums = window.__rrMasterNums;
  if (!masterNums || window.__rrMasterNumsSrc !== state.masterData
      || window.__rrMasterNumsLen !== state.masterData.length) {
    masterNums = new Set(state.masterData.map(m => _displayItemNum(m) + '|' + (m.variation||'')));
    window.__rrMasterNums = masterNums;
    window.__rrMasterNumsSrc = state.masterData;
    window.__rrMasterNumsLen = state.masterData.length;
  }
  // v0.9.985 (perf): indexed replacement for the linear masterData.find(...)
  // scans below — same answer (variation match within the same item number,
  // else the first row with that number), but O(1) via the masterByItem index
  // instead of a full-catalog walk per personal-only item.
  const _mbiFind = function(num, variation, needType) {
    const bucket = (state.masterByItem && state.masterByItem.get(String(num == null ? '' : num).trim())) || [];
    if (!bucket.length) return undefined;
    if (needType) { for (let i = 0; i < bucket.length; i++) { if (bucket[i].itemType) return bucket[i]; } return undefined; }
    if (variation) { for (let j = 0; j < bucket.length; j++) { if (String(bucket[j].variation || '') === String(variation)) return bucket[j]; } return undefined; }
    return bucket[0];
  };
  // v0.9.1120 (Brad's 1562W): an owned item saved WITHOUT a variation must
  // light up exactly ONE catalog row — its best identity match — instead of
  // whichever blank-variation lookalikes happen to share the number (2444's
  // BOX row instead of the Newark Pullman; the two MPC-era 1053 SETS instead
  // of his postwar 1053 transformer). Scoring: the saved era first, then the
  // v0.9.1119 promo/paper demotion rule (aligned with the item's own type,
  // so a deliberately-saved paper item still lands on a paper row).
  var _bvAdopt = null;
  if (state.filters.owned) {
    _bvAdopt = new Map();
    var _bvByNum = new Map();
    state.masterData.forEach(function (m) {
      var _bn = _displayItemNum(m);
      if (!_bvByNum.has(_bn)) _bvByNum.set(_bn, []);
      _bvByNum.get(_bn).push(m);
    });
    Object.values(state.personalData).forEach(function (p) {
      if (!p || !p.owned || !p.itemNum) return;
      // v0.9.1193 (Brad's phantom Williams 2321 and "53" 1953-catalog rows):
      // items WITH a variation used to bail out here — "strict match handles
      // it". Strict matching answers whether A catalog row matches, never
      // WHICH one, and number+variation is NOT unique: Williams reissued the
      // 2321 Trainmaster and a 1953 paper catalog shares "53" with the snow
      // plow, all as variation 1. Every lookalike called findPD, every one got
      // Brad's single entry, and one owned item rendered as two or three rows
      // wearing contradictory badges (maker LIONEL from his row, era WILLIAMS
      // from the row that claimed it). So: arbitrate variation items too —
      // same era + paper/kind scoring — keyed by number+variation so multiple
      // owned copies (his 2321 var 1 AND var 2) keep separate seats. Only
      // ambiguous cases (2+ same-number-same-variation rows) get an entry;
      // a unique strict match stays on today's path untouched.
      var _pv = String(p.variation || '').trim().toUpperCase();  // same normalization as _pdLookupKey
      if (String(p.era || '') === 'Manual') return;             // a manual entry's identity is its own
      var _rows = _bvByNum.get(p.itemNum) || [];
      if (_pv) {
        _rows = _rows.filter(function (r) { return String(r.variation == null ? '' : r.variation).trim().toUpperCase() === _pv; });
        if (_rows.length < 2) return;                            // 0 → other lanes; 1 → already unambiguous
      }
      if (!_rows.length) return;                                 // truly off-catalog — personal-only lane
      var _pEra = (typeof _rrEraKeyOf === 'function') ? _rrEraKeyOf(p.era) : String(p.era || '').toLowerCase();
      var _pPaper = /\b(paper|promo|promotional|box|boxes|catalog|display|instruction)\b/i.test(String(p.itemType || ''));
      var _best = null, _bestS = -1;
      _rows.forEach(function (r) {
        var s = 0;
        if (_pEra && r._era === _pEra) s += 4;
        var _dem = (typeof window.rrDemotedRow === 'function') ? window.rrDemotedRow(r) : false;
        if (_dem === _pPaper) s += 2;                            // row kind agrees with the item's own kind
        if (s > _bestS) { _bestS = s; _best = r; }
      });
      if (_best) _bvAdopt.set(_pv ? (p.itemNum + '|v|' + _pv) : p.itemNum, { pd: p, row: _best });
    });
  }
  // ONE resolver for "which owned item does this catalog row represent" —
  // the filter, the sorter and the row renderer all use it, so a row can
  // never pass the filter as owned and then render unowned (or vice versa).
  function _rrPdForRow(item) {
    if (item._copyPd) return item._copyPd;
    if (item._personalOnly) return item;
    var _dn = _displayItemNum(item);
    var _p = findPD(_dn, item.variation);
    if (_p && _p.itemNum !== _dn) _p = null;                     // no -P/-D bleed
    if (_p && String(_p.era || '') === 'Manual') _p = null;      // v0.9.718
    if (_bvAdopt) {
      // v0.9.1193: blank-variation entries key by number (unchanged); the new
      // variation entries key by number+variation. Check both.
      var _ad = _bvAdopt.get(_dn)
             || _bvAdopt.get(_dn + '|v|' + String(item.variation == null ? '' : item.variation).trim().toUpperCase());
      if (_ad) {
        if (!_p && _ad.row === item) _p = _ad.pd;                // the adopted row lights up
        else if (_p === _ad.pd && _ad.row !== item) _p = null;   // lookalikes let go of it
      }
    }
    return _p;
  }
  const _eraFilterPersonalOnly = state.filters.owned && typeof _currentEra !== 'undefined' && _currentEra !== 'all';
  const personalOnlyItems = Object.values(state.personalData)
    .filter(pd => pd.owned && (String(pd.era || '') === 'Manual' || !masterNums.has(pd.itemNum + '|' + (pd.variation||''))))   // v0.9.718: manual rows never merge into catalog rows
    .filter(pd => {   // v0.9.1120: adopted items display on their catalog row instead (v0.9.1193: variation-keyed entries too)
      if (!_bvAdopt) return true;
      var _adN = _bvAdopt.get(pd.itemNum);
      if (_adN && _adN.pd === pd) return false;
      var _adV = _bvAdopt.get(pd.itemNum + '|v|' + String(pd.variation == null ? '' : pd.variation).trim().toUpperCase());
      return !(_adV && _adV.pd === pd);
    })
    .filter(pd => !_eraFilterPersonalOnly)
    .filter(pd => !(typeof _isCollectionCompanion === 'function' ? _isCollectionCompanion(pd) : _isGroupedBoxRow(pd)))
    .map(pd => {
      // Infer type from item number suffix for personal-only items
      let _poType = pd.itemType || '';
      const _num = (pd.itemNum || '').toUpperCase();
      if (!_poType) {
        if (_num.endsWith('-MBOX'))      _poType = 'Master Carton';
        else if (_num.endsWith('-BOX'))  _poType = 'Box';
        else if (_num.endsWith('-IS'))   _poType = 'Instruction Sheet';
        else if (_num.endsWith('-P'))    _poType = 'Powered Unit';
        else if (_num.endsWith('-T'))    _poType = 'Dummy Unit';
      }
      // Strip suffix to find the base item for description/roadName
      // v0.9.718: manual entries get NO catalog enrichment (identity is theirs).
      const _pdIsManual = String(pd.era || '') === 'Manual';
      const _baseNum = pd.itemNum.replace(/-(P|T|BOX|MBOX)$/i, '');
      const _baseItem = (!_pdIsManual && _baseNum !== pd.itemNum)
        ? (_mbiFind(_baseNum, pd.variation)
           || findMaster(_baseNum))
        : null;
      // Fallback: if no suffix match, still try to find master entry by item number alone
      // (handles cases like 2426W saved with no variation but master has variations)
      const _masterFallback = (_baseItem || _pdIsManual) ? null
        : (_mbiFind(pd.itemNum, pd.variation)
           || findMaster(pd.itemNum, '', pd));
      const _refItem = _baseItem || _masterFallback;
      return {
        itemNum: pd.itemNum, variation: pd.variation || '',
        manufacturer: pd.manufacturer || '',
        itemType: (function () {
          if (!pd.itemType && _poType) return _poType;   // suffix-derived (-BOX/-IS/-P/-T) synthetic types
          // v0.9.798 (Brad): the CATALOG decides Item Type whenever this number
          // exists in the master — a stored personal type (like a stuck "Paper"
          // on 217C / 6464-425) only applies to true off-catalog items. TYPE
          // ONLY: identity fields keep v0.9.718's no-enrichment rule.
          var _tm = null;
          // v0.9.987 (Brad): MANUAL entries keep THEIR OWN type — the catalog
          // override below (v0.9.798) was for catalog-matched rows with a
          // stuck personal type, but a manual item that happens to share a
          // number with a catalog item (e.g. "4C") must not lose its edited
          // type. v0.9.718 rule: a manual entry's identity is its own.
          if (!_pdIsManual) {
            try { _tm = (typeof findMaster === 'function') ? (findMaster(pd.itemNum, pd.variation || '') || (_baseNum !== pd.itemNum ? findMaster(_baseNum) : null)) : null; } catch (eT) {}
            // v0.9.801: variation-blind fallback — the type is the same across
            // every variation, so ANY master row with this number settles it
            // (findMaster can return null when the variation column is blank).
            if (!_tm) { try { _tm = _mbiFind(pd.itemNum, '', true) || null; } catch (eT2) {} }
          }
          if (_tm && _tm.itemType) return _tm.itemType;
          return _poType || (_refItem ? _refItem.itemType : '');
        })(),
        roadName: pd.roadName || (_refItem ? _refItem.roadName : ''),
        description: _refItem ? _refItem.description : (pd.description || pd.notes || ''),   // v0.9.718: manual rows carry their own description
        yearProd: pd.datePurchased || (_refItem ? _refItem.yearProd : ''),
        marketVal: _refItem ? _refItem.marketVal : '',
        varDesc: _refItem ? _refItem.varDesc : '',
        refLink: _refItem ? _refItem.refLink : '',
        // Carry through collection-status fields so icons/actions work for personal-only items
        owned: pd.owned, row: pd.row,
        quickEntry: pd.quickEntry, groupId: pd.groupId || '',
        matchedTo: pd.matchedTo || '', setId: pd.setId || '',
        photoItem: pd.photoItem || '', userEstWorth: pd.userEstWorth || '',
        condition: pd.condition || '', inventoryId: pd.inventoryId || '',
        _personalOnly: true
      };
    });
  // Session 117: master browse in All Collection mode pulls items from EVERY
  // era's items tab — not just the SHEET_TABS.items fallback (which would be PW only).
  // Empty-state gate above prevents rendering all 30K+ rows when no search is active.
  const _allItemTabs = (typeof REAL_ERA_IDS !== 'undefined')
    ? REAL_ERA_IDS.map(function(e){ return (typeof ERA_TABS !== 'undefined' && ERA_TABS[e]) ? ERA_TABS[e].items : null; }).filter(Boolean)
    : [];
  const baseList = owned ? [...state.masterData, ...personalOnlyItems]
    : (_currentEra === 'all'
        ? state.masterData.filter(function(m) { return (m._tab && _allItemTabs.indexOf(m._tab) >= 0) || !m._tab; })
        : state.masterData.filter(function(m) { return m._tab === SHEET_TABS.items || !m._tab; }));

  // v0.9.985 (perf): ONE pass over the Sold list up front, instead of re-
  // scanning it per catalog row inside the filter below (_latestSale scans
  // every sale on every call — across 60K rows that was millions of wasted
  // lookups per page switch). Membership in this Set = "has ever been sold",
  // which is exactly what the old !!_latestSale(...) truthiness tested.
  const _soldKeys = new Set();
  (function() {
    const sd = state.soldData || {};
    for (const k in sd) {
      const s = sd[k];
      if (s && s.itemNum) _soldKeys.add(s.itemNum + '|' + (s.variation || ''));
    }
  })();
  state.filteredData = baseList.filter(item => {
    const _dispNum = _displayItemNum(item);
    // v0.9.1120: shared resolver — strict item+variation match plus the
    // blank-variation adoption above (authoritative: an item without a
    // variation lights its ONE adopted row and nothing else).
    let pd = item._personalOnly ? null : _rrPdForRow(item);
    pd = pd || (item._personalOnly ? item : null);
    const isOwned = item._personalOnly ? true : (pd?.owned || false);
    const hasBox = pd?.hasBox === 'Yes';
    // Session 176: Sold is now a history. Only hide an item as "sold" if it isn't
    // currently owned again — re-owned items must still appear in browse.
    const isSold = !isOwned
      && (_soldKeys.has(_dispNum + '|' + (item.variation || '')) || _soldKeys.has(item.itemNum + '|' + (item.variation || '')));
    if (isSold) return false;
    const isWanted = !!state.wantData[`${item.itemNum}|${item.variation}`];
    if (state.filters.wantList && !isWanted) return false;
    if (owned && !isOwned) return false;
    // Push 2 (Session 154): hide companion rows (grouped box, tender, extra set
    // car) so each group shows as one item via its lead.
    if (owned && pd && typeof _isCollectionCompanion === 'function' && _isCollectionCompanion(pd)) return false;
    // v0.9.986 (Brad): Show-chip routing by type. Trains hides paper/catalog-
    // typed rows; Paper/Catalogs show ONLY their typed rows; other sections
    // (Instruction Sheets, Other…) have no train-store rows at all.
    if (owned && _collSec !== 'all') {
      const _sr = _typeSection(item);
      if (_collSec === 'trains') { if (_sr) return false; }
      else if (_sr !== _collSec) return false;   // v0.9.990: any section key — 'is' etc. simply have no typed train-store rows
    }
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
      // Session 118 Phase C: compare against bucket label (Steam, Diesel, Boxcar...) instead of raw itemType.
      var _bucketLabel = (typeof getTypeBucketLabel === 'function') ? getTypeBucketLabel(item) : item.itemType;
      if (_bucketLabel !== type) return false;
    }
    // Step 3b: chip-state-aware filter (only relevant in 'all' meta-era mode).
    if (_currentEra === 'all' && _stp3b) {
      if (_stp3b.manufacturer && _stp3b.manufacturer !== 'any') {
        var _itmMfr = '';
        if (typeof _manufacturerOfItem === 'function') _itmMfr = (_manufacturerOfItem(item) || '').toLowerCase();
        if (!_itmMfr && item._tab) {
          var _tlc = String(item._tab).toLowerCase();
          if (_tlc.indexOf('lionel') === 0)     _itmMfr = 'lionel';
          else if (_tlc.indexOf('atlas') === 0) _itmMfr = 'atlas';
          else if (_tlc.indexOf('mth') === 0)   _itmMfr = 'mth';
        }
        if (_itmMfr !== _stp3b.manufacturer) return false;
      }
      if (_stp3b.scale && _stp3b.scale !== 'any') {
        var _itmScale = '';
        if (typeof _scaleOfItem === 'function') _itmScale = (_scaleOfItem(item) || '').toLowerCase();
        // Session 154: exclude items that don't DEFINITIVELY match the chosen
        // scale — including items of unknown scale (e.g. pre-war rows with a
        // blank gauge field). Previously `_itmScale && ...` let those leak into
        // every scale filter (pre-war items appearing under "HO Scale").
        // My Collection: never hide an owned item just because its scale is
        // unknown (its catalog may not be loaded). Catalog browse stays strict.
        if (_itmScale !== _stp3b.scale && !(state.filters.owned && !_itmScale)) return false;
      }
      if (_stp3b.era && _stp3b.era !== 'any') {
        // S151: chip era is a time period (prewar/postwar/modern).
        var _itmPeriod = (typeof _itemEraPeriod === 'function') ? _itemEraPeriod(item) : null;
        // v0.9.1161 (Brad chose "show under every period"): hide only on a KNOWN
        // mismatch. A maker whose era genuinely spans periods — Marx 1930-1975,
        // Other O Brands — has no period at all when the row carries no printed
        // production year, and `null !== 'modern'` was excluding those rows from
        // ALL THREE period chips. An item Brad owns could be absent from a list
        // with nothing to explain why. Unknown now shows everywhere instead of
        // nowhere; a real year still wins, so filling years narrows it properly.
        if (_itmPeriod && _itmPeriod !== _stp3b.era) return false;
      }
    }
    if (road && item.roadName !== road) return false;
    if (search) {
      const haystack = `${item.itemNum} ${item.roadName||''} ${item.description||''} ${item.itemType||''}`.toLowerCase();
      if (!_aliasSearch(haystack, search)) return false;
    }
    return true;
  });

  // Sort My Collection: by item number, with grouped items together
  // (default). Skipped when the user has clicked a column header to sort.
  if (state.filters.owned && !(state._collSort && state._collSort.col)) {
    state.filteredData.sort((a, b) => {
      const pdA = _rrPdForRow(a) || {};   // v0.9.1120: adoption-aware, so set members still cluster
      const pdB = _rrPdForRow(b) || {};
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
  // My Collection: user-selected column sort (header click).
  if (state.filters.owned && state._collSort && state._collSort.col) {
    var _cs = state._collSort;
    var _dir = (_cs.dir === 'desc') ? -1 : 1;
    var _col = _cs.col;
    var _numeric = (_col === 'num' || _col === 'worth' || _col === 'added');   // v0.9.719
    var _keyed = state.filteredData.map(function(it) {
      var pd = findPD(_displayItemNum(it), it.variation) || {};
      var _rt = [it.roadName, it.itemType].filter(Boolean).join(' \u00b7 ') || it.description || '';
      var _w = parseFloat(pd.userEstWorth);
      // v0.9.719: date-added key — save timestamp beats purchase date beats
      // sheet row order (older rows without either cluster together).
      var _addTs = Date.parse(pd.dateAdded || '') || pd._savedAt || Date.parse(pd.datePurchased || '') || (pd.row || 0);   // v0.9.720: sheet column first
      return {
        it: it,
        mfr: (typeof _manufacturerOfItem === 'function' ? (_manufacturerOfItem(it) || '') : ''),
        num: parseInt(String(_displayItemNum(it)).replace(/[^0-9]/g, '')) || 0,
        var: (it.variation || ''),
        type: (typeof getTypeBucketLabel === 'function' ? (getTypeBucketLabel(it) || '') : (it.itemType || '')),
        desc: _rt,
        added: isFinite(_addTs) ? _addTs : 0,
        worth: isFinite(_w) ? _w : -1
      };
    });
    _keyed.sort(function(a, b) {
      var r;
      if (_numeric) { r = a[_col] - b[_col]; }
      else { r = String(a[_col]).localeCompare(String(b[_col]), undefined, { numeric: true, sensitivity: 'base' }); }
      if (r === 0) r = (a.it.itemNum || '').localeCompare(b.it.itemNum || '', undefined, { numeric: true });
      return r * _dir;
    });
    state.filteredData = _keyed.map(function(x) { return x.it; });
  }
  // Step 3b: when mfr=any in 'all' meta-era mode, group by Lionel -> MTH -> Atlas,
  // then by item number within each manufacturer. Applies to non-owned views only;
  // My Collection has its own group-aware sort above.
  if (!state.filters.owned && _currentEra === 'all' && _stp3b && _stp3b.manufacturer === 'any') {
    var _MFR_ORDER = { lionel: 1, mth: 2, atlas: 3 };
    var _mfrOf = function(it) {
      var m = (typeof _manufacturerOfItem === 'function') ? _manufacturerOfItem(it) : '';
      if (!m && it && it._tab) {
        var t = String(it._tab).toLowerCase();
        if (t.indexOf('lionel') === 0) m = 'lionel';
        else if (t.indexOf('atlas') === 0) m = 'atlas';
        else if (t.indexOf('mth') === 0) m = 'mth';
      }
      return (m || '').toLowerCase();
    };
    state.filteredData.sort(function(a, b) {
      var aOrd = _MFR_ORDER[_mfrOf(a)] || 99;
      var bOrd = _MFR_ORDER[_mfrOf(b)] || 99;
      if (aOrd !== bOrd) return aOrd - bOrd;
      var aNum = parseInt((a.itemNum||'').replace(/[^0-9]/g,'')) || 0;
      var bNum = parseInt((b.itemNum||'').replace(/[^0-9]/g,'')) || 0;
      if (aNum !== bNum) return aNum - bNum;
      return (a.itemNum||'').localeCompare(b.itemNum||'');
    });
  }
  // Option A (Session 154): in My Collection, show one row per owned COPY.
  // A master item owned multiple times collapses to one row because
  // renderBrowse iterates masterData once. Expand each such item so every
  // copy (each inventory ID) gets its own row, carrying its specific pd so
  // condition / photos / For-Sale status / row actions are per-copy.
  if (state.filters.owned) {
    var _expandedFD = [];
    state.filteredData.forEach(function(it) {
      if (it._personalOnly) { _expandedFD.push(it); return; }
      var _dnp = _displayItemNum(it);
      var _copiesFD = Object.values(state.personalData).filter(function(p) {
        return p && p.owned
          && p.itemNum === _dnp && (p.variation || '') === (it.variation || '')
          && !String(p.itemNum || '').toUpperCase().endsWith('-BOX');
      });
      if (_copiesFD.length <= 1) { _expandedFD.push(it); return; }
      _copiesFD.sort(function(a, b) { return (parseInt(a.inventoryId) || 0) - (parseInt(b.inventoryId) || 0); });
      _copiesFD.forEach(function(cp) {
        var _clone = Object.assign({}, it);
        _clone._copyPd = cp;
        _clone._origItem = it;
        _expandedFD.push(_clone);
      });
    });
    state.filteredData = _expandedFD;
  }
  // v0.9.1121 (Brad: "I thought we kept grouped items on 1 row") — whole
  // SETS fold into one expandable row in My Collection. Only SET-… groups
  // fold: engine+tender pairs are already one sheet row, and GRP-… groups
  // keep their existing companion handling. Display-only — the sheet keeps
  // one row per piece. Folding skips search and column-sort views so
  // members stay findable and sortable.
  if (state.filters.owned && !(state.filters.search || '').trim() && !(state._collSort && state._collSort.col)) {
    var _openFolds = window._rrOpenSetFolds = window._rrOpenSetFolds || {};
    var _foldedFD = [], _foldByGid = {};
    state.filteredData.forEach(function (it) {
      var _fp = it._setFold ? null : _rrPdForRow(it);
      var _gid = (_fp && _fp.groupId && /^SET-/i.test(String(_fp.groupId))) ? String(_fp.groupId) : '';
      if (!_gid) { _foldedFD.push(it); return; }
      var _f = _foldByGid[_gid];
      if (!_f) {
        var _ms = null;
        try { _ms = Object.values(state.mySetsData || {}).find(function (s) { return s && s.groupId === _gid; }) || null; } catch (eMs) {}
        _f = { _setFold: true, groupId: _gid, set: _ms, members: [],
               itemNum: (_ms && _ms.setNum) || (_gid.split('-')[1] || ''), variation: '' };
        _foldByGid[_gid] = _f;
        _foldedFD.push(_f);
      }
      _f.members.push(it);
      if (_openFolds[_gid]) _foldedFD.push(it);   // expanded: members render beneath the set row
    });
    state.filteredData = _foldedFD;
  }
  const total = state.filteredData.length;
  const pages = Math.ceil(total / state.pageSize);
  const start = (state.currentPage - 1) * state.pageSize;
  const pageData = state.filteredData.slice(start, start + state.pageSize);

  // Ephemera items — shown when owned filter is on OR search has text OR type filter matches an ephemera category
  const _ephemeraRows = [];
  const _ephLabels = { catalogs:'Catalog', paper:'Paper Item', mockups:'Mock-Up', other:'Other Lionel' };
  const _ephEmojis = { catalogs:'📒', paper:'📄', mockups:'🔩', other:'📦' };
  const _ephColors = { catalogs:'#e67e22', paper:'#3498db', mockups:'#9b59b6', other:'#2ecc71' };
  const _ephTypeMap = { 'Catalog':'catalogs', 'Paper Item':'paper', 'Mock-Up':'mockups', 'Other Lionel':'other' };
  const sq = (state.filters.search||'').toLowerCase();
  const tf = (state.filters.type||'').toLowerCase();
  // Show ephemera if: owned view, searching, or type filter is an ephemera category
  const _showEph = state.filters.owned || sq || Object.keys(_ephTypeMap).some(k => k.toLowerCase() === tf);
  // Instruction Sheets in browse
  // Map IS entries to their state.isData keys so we can attach action
  // buttons (For Sale / Sold / Upgrade / Remove) via _collectionActionsHTML.
  const _isKeyByEntry = new Map();
  Object.keys(state.isData || {}).forEach(function(k) { _isKeyByEntry.set(state.isData[k], k); });
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
      _ephemeraRows.push({ _divider: true, secKey: 'is', label: '📋 Instruction Sheets', color: '#16a085' });
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
      _ephemeraRows.push({ _divider: true, secKey: tabId, label: emoji + ' ' + label + 's', color });
      filtered.sort((a,b)=>(b.row||0)-(a.row||0)).forEach(it => {
        _ephemeraRows.push({ _eph: true, tabId, item: it, label, emoji, color });
      });
    });
  }
  // v0.9.985/986 (Brad): the Show chips filter the list to one section.
  // _collSec was computed up top (before the main filter) so train-store rows
  // could be routed by type; here the ephemera rows get the same treatment.
  // Chip list is captured BEFORE filtering so every section stays clickable —
  // plus synthetic Paper/Catalogs chips when only TYPED train-store rows exist
  // (e.g. the Pittman "Paper" item with no ephemera paper bucket).
  const _collAllSections = _ephemeraRows
    .filter(function(r) { return r._divider; })
    .map(function(r) { return { key: r.secKey, label: r.label, color: r.color }; });
  if (state.filters.owned) {
    // v0.9.990 (Phase 3): with the old buckets retired, TYPED rows in the one
    // inventory are what create the section chips. One pass over the owned
    // collection finds which sections exist.
    try {
      const _chipMeta = {
        catalogs: { label: '📒 Catalogs', color: '#e67e22' },
        paper:    { label: '📄 Paper Items', color: '#3498db' },
        mockups:  { label: '🔩 Mock-Ups', color: '#9b59b6' },
        other:    { label: '📦 Other Lionel', color: '#2ecc71' }
      };
      const _typedSecs = {};
      Object.values(state.personalData || {}).forEach(function(p) {
        if (!p || !p.owned) return;
        const t = String(p.itemType || '').toLowerCase();
        Object.keys(_SEC_TYPES).forEach(function(k) { if (_SEC_TYPES[k].indexOf(t) >= 0) _typedSecs[k] = true; });
      });
      Object.keys(_chipMeta).forEach(function(k) {
        if (_typedSecs[k] && !_collAllSections.some(function(s) { return s.key === k; })) {
          _collAllSections.push({ key: k, label: _chipMeta[k].label, color: _chipMeta[k].color });
        }
      });
    } catch (eChip) {}
  }
  if (_collSec === 'trains') {
    _ephemeraRows.length = 0;
  } else if (_collSecFiltered) {
    const _secKeep = _ephemeraRows.filter(function(r) {
      if (r._divider) return r.secKey === _collSec;
      if (r._is) return _collSec === 'is';
      if (r._eph) return r.tabId === _collSec;
      return false;
    });
    _ephemeraRows.length = 0;
    Array.prototype.push.apply(_ephemeraRows, _secKeep);
  }
  const ephTotal = _ephemeraRows.filter(r=>r._eph).length;
  const _secRowCount = _ephemeraRows.filter(r=>r._eph || r._is).length;   // v0.9.985: incl. instruction sheets
  const displayTotal = _collSecFiltered ? total + _secRowCount : total + ephTotal;
  document.getElementById('result-count').textContent = `${displayTotal.toLocaleString()} items`;
  // S151: append all-mode loading indicator if background refresh is running.
  if (typeof _renderAllLoadingIndicator === 'function') _renderAllLoadingIndicator();
  // Page-info text — handle the zero-main-items case so we don't say
  // "Showing 1-0 of 0 trains" when only ephemera/IS rows exist.
  let _pageInfo;
  if (_collSecFiltered) {
    // v0.9.986: single-section view — typed train-store rows + section rows.
    _pageInfo = total > 0
      ? `Showing ${start+1}–${Math.min(start+state.pageSize, total)} of ${total.toLocaleString()} item${total !== 1 ? 's' : ''}${_secRowCount ? ' + ' + _secRowCount + ' more' : ''}`
      : `Showing ${_secRowCount} item${_secRowCount !== 1 ? 's' : ''}`;
  } else if (total === 0 && ephTotal > 0) {
    _pageInfo = `Showing ${ephTotal} other item${ephTotal !== 1 ? 's' : ''}`;
  } else if (total === 0) {
    _pageInfo = 'No items';
  } else {
    _pageInfo = `Showing ${start+1}–${Math.min(start+state.pageSize, total)} of ${total.toLocaleString()} train${total !== 1 ? 's' : ''}${ephTotal ? ' + ' + ephTotal + ' other' : ''}`;
  }
  document.getElementById('page-info').textContent = _pageInfo;

  // Rows
  const tbody = document.getElementById('browse-tbody');
  const isMobile = window.innerWidth <= 640;
  const cardsEl = document.getElementById('browse-cards');
  const tableEl = document.querySelector('.item-table');
  let _ephRowsHtml = '';
  if (_ephemeraRows.length) {
    _ephRowsHtml = _ephemeraRows.map((r, _ri) => {
      if (r._divider) return `<tr id="ephsec-${_ri}"><td colspan="${_collColSpan()}" style="padding:0.5rem 0.75rem;background:var(--surface2);font-size:0.72rem;font-weight:600;letter-spacing:0.1em;color:${r.color};text-transform:uppercase;border-top:2px solid ${r.color}33">${r.label}</td></tr>`;
      const it = r.item;
      const cond = it.condition ? parseInt(it.condition) : null;
      const condClass = cond >= 9 ? 'cond-9' : cond >= 7 ? 'cond-7' : cond >= 5 ? 'cond-5' : cond ? 'cond-low' : '';
      if (r._is) {
        if (state.filters.owned) {
          // Use the real state.isData key (inventoryId when present, else row #)
          // — passing it.row directly silently failed when key was an inventoryId.
          const _isKey = _isKeyByEntry.get(it) || it.row;
          const _isKeyArg = "'" + String(_isKey).replace(/'/g, "\\'") + "'";
          const _isActions = (typeof _collectionActionsHTML === 'function' && _isKey)
            ? _collectionActionsHTML('is', _isKey, it) : '';
          // v0.9.985 (Brad): 9 columns to match the My Collection header —
          // (MFR | ITEM# | VAR | TYPE | PHOTO | DESCRIPTION | EST.WORTH | DATE | ACTIONS).
          // The PHOTO column was added to the header in v0.9.909 but these rows
          // were never updated, so everything from PHOTO on sat one column left.
          const _cSymIS = (typeof _currencySymbol === 'function') ? _currencySymbol() : '$';
          const _isWorthN = it.estValue ? parseFloat(it.estValue) : NaN;
          return `<tr onclick="openISDetail(${_isKeyArg})" style="cursor:pointer">
            ${_collGutterSpacerTd()}
            <td style="text-align:center;font-size:1.05rem" title="Instruction Sheet">📋</td>
            <td><span style="font-family:var(--font-mono);font-size:0.85rem;color:#16a085;font-weight:600">${it.sheetNum}</span></td>
            <td style="text-align:center"><span class="text-dim">—</span></td>
            <td><span class="tag" style="border-color:#16a085;color:#16a085;background:#16a08518">Instr. Sheet</span></td>
            <td style="width:52px"></td>
            <td><span style="color:var(--text-mid);font-size:0.85rem">For #${it.linkedItem || '—'}</span></td>
            <td style="font-size:0.82rem;color:var(--gold);white-space:nowrap;text-align:center">${isFinite(_isWorthN) ? _cSymIS + _isWorthN.toLocaleString() : '<span style="color:var(--text-dim)">—</span>'}</td>
            <td style="font-size:0.76rem;color:var(--text-dim);white-space:nowrap;text-align:center">${it.dateAcquired ? ((typeof _formatDate === 'function') ? _formatDate(it.dateAcquired) : it.dateAcquired) : '—'}</td>
            <td class="coll-actions-cell" onclick="event.stopPropagation()" style="text-align:right;white-space:nowrap">${_isActions}</td>
          </tr>`;
        }
        return `<tr onclick="openISDetail(${it.row})" style="cursor:pointer">
            ${_collGutterSpacerTd()}
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
      const val = it.estValue ? _currencySymbol() + parseFloat(it.estValue).toLocaleString() : '—';
      const _itmId = it.itemNum ? `<span style="font-family:var(--font-mono);font-size:0.78rem;color:${r.color};opacity:0.75;font-style:italic">${it.itemNum}</span>` : r.emoji;
      const _ephActions = state.filters.owned ? `
        <div style="display:flex;gap:0.35rem;margin-top:0.5rem;flex-wrap:wrap">
          <button onclick="event.stopPropagation();ephemeraForSale('${r.tabId}',${it.row})" style="flex:1;min-width:0;padding:0.35rem 0.3rem;border-radius:7px;font-size:0.72rem;cursor:pointer;border:1.5px solid #e67e22;background:rgba(230,126,34,0.12);color:#e67e22;font-family:var(--font-body);font-weight:600">🏷️ For Sale</button>
          <button onclick="event.stopPropagation();ephemeraSold('${r.tabId}',${it.row})" style="flex:1;min-width:0;padding:0.35rem 0.3rem;border-radius:7px;font-size:0.72rem;cursor:pointer;border:1.5px solid #2ecc71;background:rgba(46,204,113,0.12);color:#2ecc71;font-family:var(--font-body);font-weight:600">💰 Sold</button>
          <button onclick="event.stopPropagation();ephemeraDelete('${r.tabId}',${it.row})" style="flex:0 0 auto;padding:0.35rem 0.5rem;border-radius:7px;font-size:0.72rem;cursor:pointer;border:1.5px solid var(--border);background:var(--surface2);color:var(--accent);font-family:var(--font-body)">Remove</button>
        </div>` : '';

      // ── My Collection view: 9 columns to match the header (v0.9.985:
      //    thumbnail moved to its own PHOTO column, same as train rows) ──
      // v0.9.813 (Brad): real maker badge (these buckets are Lionel paper),
      // item # stays in the ITEM # column, TITLE moves to the wide
      // DESCRIPTION column (was cramped), actions trimmed to the same three
      // buttons as train rows so nothing scrolls off screen. Tap the 📷 by
      // the item # to open the photo folder (same as train rows).
      if (state.filters.owned) {
        const _photoLink = it.photoLink || '';
        const _thumbId = 'eph-thumb-' + r.tabId + '-' + it.row;
        const _ephTypeLabel = it.paperType || r.label;
        const _ephSub = [it.year, it.notes || it.description].filter(Boolean).join(' — ');
        const _cSymE = (typeof _currencySymbol === 'function') ? _currencySymbol() : '$';
        const _ephWorthN = it.estValue ? parseFloat(it.estValue) : NaN;
        const _ephWorth = isFinite(_ephWorthN) ? _cSymE + _ephWorthN.toLocaleString() : '<span style="color:var(--text-dim)">—</span>';
        const _ephDate = it.dateAcquired ? ((typeof _formatDate === 'function') ? _formatDate(it.dateAcquired) : it.dateAcquired) : '—';
        const _ephBtn = 'padding:0.2rem 0.45rem;border-radius:5px;font-size:0.7rem;cursor:pointer;font-family:var(--font-body);font-weight:600;margin-right:0.2rem';
        // v0.9.814 (Brad): only show a maker badge when the user actually
        // entered one — no Lionel default, blank otherwise.
        const _ephMfrCell = (it.manufacturer && typeof _mfrBadge === 'function')
          ? _mfrBadge({ manufacturer: it.manufacturer })
          : '<td></td>';
        return `<tr onclick="openEphemeraDetail('${r.tabId}',${it.row})" style="cursor:pointer">
            ${_collGutterSpacerTd()}
          ${_ephMfrCell}
          <td style="max-width:170px">
            <span style="min-width:0">
              <span class="item-num" style="display:inline-block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:bottom" title="${String(it.itemNum || '').replace(/"/g,'&quot;')}">${(r.tabId === 'catalogs' && typeof _catalogDisplayLabel === 'function') ? _catalogDisplayLabel(it.year, it.catType, it.itemNum) : (it.itemNum || '—')}</span>
              ${_photoLink ? `<span onclick="event.stopPropagation();openPhotoFolder('${it.itemNum||''}','${_photoLink}')" style="font-size:0.85rem;cursor:pointer" title="Open photo folder">📷</span>` : ''}
            </span>
          </td>
          <td style="text-align:center"><span class="text-dim">—</span></td>
          <td><span class="tag" style="border-color:${r.color};color:${r.color};background:${r.color}18">${_ephTypeLabel}</span></td>
          <td style="width:52px;text-align:center;padding:2px 4px">${_photoLink ? `<span id="${_thumbId}" style="display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:5px;background:var(--surface2);overflow:hidden;color:var(--text-dim);vertical-align:middle"></span>` : ''}</td>
          <td style="font-size:0.85rem">
            <div style="color:var(--text);font-weight:600;line-height:1.3">${it.title || '—'}</div>
            ${_ephSub ? `<div style="color:var(--text-dim);font-size:0.78rem;margin-top:1px">${_ephSub}</div>` : ''}
          </td>
          <td style="font-size:0.82rem;color:var(--gold);white-space:nowrap;text-align:center">${_ephWorth}</td>
          <td style="font-size:0.76rem;color:var(--text-dim);white-space:nowrap;width:80px;text-align:center">${_ephDate}</td>
          <td class="coll-actions-cell" onclick="event.stopPropagation()" style="text-align:right;white-space:nowrap">
            <button onclick="ephemeraForSale('${r.tabId}',${it.row})" style="${_ephBtn};border:1px solid #e67e22;background:rgba(230,126,34,0.1);color:#e67e22">For Sale</button>
            <button onclick="ephemeraSold('${r.tabId}',${it.row})" style="${_ephBtn};border:1px solid #2ecc71;background:rgba(46,204,113,0.1);color:#2ecc71">Sold</button>
            <button onclick="ephemeraDelete('${r.tabId}',${it.row})" style="${_ephBtn};margin-right:0;border:1px solid var(--border);background:var(--surface2);color:#f05008">Remove</button>
          </td>
        </tr>`;
      }

      // ── Master browse view: 9-column layout ───────────────────
      const _ephTypeBadge = it.paperType || r.label;
      return `<tr onclick="openEphemeraDetail('${r.tabId}',${it.row})" style="cursor:pointer">
            ${_collGutterSpacerTd()}
        <td>
          <div style="font-size:0.88rem;color:var(--text);font-weight:600">${it.title || it.itemNum || '—'}</div>
          <div style="font-family:var(--font-mono);font-size:0.7rem;color:${r.color};opacity:0.8;margin-top:1px">${it.itemNum || ''}</div>
        </td>
        <td><span class="tag" style="border-color:${r.color};color:${r.color};background:${r.color}18">${_ephTypeBadge}</span></td>
        <td>${it.description || '—'}</td>
        <td>${it.year || '—'}</td>
        <td style="color:var(--text-dim);font-size:0.8rem">${it.itemNumRef || '—'}</td>
        <td>${it.year || '—'}</td>
        <td><span class="owned-badge badge-owned">✓ Owned</span></td>
        <td class="market-val">${val}${_ephActions}</td>
      </tr>`;
    }).join('');
  }

  if (isMobile) {
    if (tableEl) tableEl.style.display = 'none';
    if (cardsEl) cardsEl.style.display = 'flex';
    try { if (typeof _rrFilterBtnSync === 'function') _rrFilterBtnSync(); } catch (e) {}   // v0.9.1025
  } else {
    if (tableEl) tableEl.style.display = '';
    if (cardsEl) cardsEl.style.display = 'none';
  }

  // ── My Collection: show piece-count in the title, hide the old legend line ──
  if (state.filters.owned) {
    var _le = document.getElementById('coll-icon-legend');
    // v0.9.1122: surface set entries that were left partway, whichever way the
    // user exited — the mid-entry cancel dialog only catches the Cancel button.
    var _aband = (typeof _rrAbandonedSetGroups === 'function') ? _rrAbandonedSetGroups() : [];
    if (_le && _aband.length) {
      _le.style.display = '';
      _le.innerHTML = _aband.map(function (g) {
        var _gidSafe = String(g.groupId).replace(/[^A-Za-z0-9_-]/g, '');
        return '<div style="margin:0 0 0.6rem;padding:0.7rem 0.9rem;border-radius:10px;border:1.5px solid #e67e22;background:rgba(230,126,34,0.1);display:flex;flex-wrap:wrap;gap:0.6rem;align-items:center;justify-content:space-between">'
          + '<div style="font-size:0.86rem;color:var(--text-mid);line-height:1.45">'
          + '⚠️ <strong style="color:#e67e22">Unfinished set entry</strong> — '
          + g.items.length + ' item' + (g.items.length !== 1 ? 's' : '')
          + ' from a ' + (g.setNum || 'set') + ' walkthrough that never finished '
          + '(' + g.items.map(function (p) { return p.itemNum; }).join(', ') + '). '
          + 'They are counted in your collection but have no set behind them.'
          + '</div>'
          + '<button onclick="_rrDropAbandonedSet(\'' + _gidSafe + '\')" style="padding:0.45rem 0.9rem;border-radius:8px;border:1.5px solid #8b8e94;background:rgba(139,142,148,0.12);color:#f05008;font-family:var(--font-body);font-weight:700;font-size:0.8rem;cursor:pointer;white-space:nowrap">Remove them</button>'
          + '</div>';
      }).join('');
    } else if (_le) { _le.style.display = 'none'; _le.innerHTML = ''; }
    // Count = owned pieces that have an item number, excluding boxes/master cartons.
    var _tSpan = document.querySelector('#page-browse > .page-title > span');
    if (_tSpan) {
      var _pieceCount = Object.values(state.personalData || {}).filter(function(p){
        if (!p || !p.owned) return false;
        return !/-(BOX|MBOX|IS)$/i.test(String(p.itemNum || '').toUpperCase());
      }).length;
      // v0.9.703 (Brad: "why does my collection number not add up"): the header
      // counted powered+dummy PAIR members separately (99) while the nav badge
      // and the list itself fold companions into their lead (90). Use the SAME
      // counter as the badge (_ownedNonBox), and show the piece total when the
      // two differ so no info is lost.
      var _itemCount = (typeof _ownedNonBox === 'function') ? _ownedNonBox(state).length : _pieceCount;
      _tSpan.innerHTML = 'My Collection List '
        + '<span style="font-family:var(--font-body);font-size:0.8rem;color:var(--text-dim);font-weight:400;letter-spacing:0;text-transform:none">'
        + _itemCount.toLocaleString() + ' item' + (_itemCount !== 1 ? 's' : '')
        + (_pieceCount > _itemCount ? ' · ' + _pieceCount.toLocaleString() + ' pieces (powered/dummy pairs count once)' : '')
        + '</span>';
    }
  } else {
    var _le2 = document.getElementById('coll-icon-legend');
    if (_le2) _le2.style.display = 'none';
  }

  var _collThumbJobs = [];   // v0.9.1025: phone row thumbnails
  const rowsHtml = pageData.map((item, i) => {
    // v0.9.1121: a folded SET renders as one row — set number, name, piece
    // count, worth — and clicking it expands/collapses the members beneath.
    if (item._setFold) {
      const _fs = item.set || {};
      const _fOpen = !!(window._rrOpenSetFolds && window._rrOpenSetFolds[item.groupId]);
      const _fW = parseFloat(_fs.estWorth);
      const _fWTxt = (_fs.estWorth && !isNaN(_fW)) ? _currencySymbol() + _fW.toLocaleString() : '';
      const _fName = [_fs.setName, _fs.year].filter(Boolean).join(' · ');
      return `<tr onclick="_rrToggleSetFold('${String(item.groupId).replace(/[^A-Za-z0-9_-]/g, '')}')" style="cursor:pointer;background:rgba(168,85,247,0.07)">`
        + `<td colspan="12" style="padding:0.65rem 0.9rem;border-left:3px solid #a855f7">`
        + `<span style="font-size:0.95rem">${_fOpen ? '▾' : '▸'}</span> \u{1F682} `
        + `<strong style="color:#a855f7">${item.itemNum || 'Set'}</strong>`
        + (_fName ? ` <span style="color:var(--text-mid)">— ${_fName}</span>` : '')
        + ` <span style="color:var(--text-dim);font-size:0.82rem">· ${item.members.length} piece${item.members.length !== 1 ? 's' : ''}${_fWTxt ? ' · ' + _fWTxt : ''} · ${_fOpen ? 'tap to fold' : 'tap to see the pieces'}</span>`
        + `</td></tr>`;
    }
    const _pd0 = _rrPdForRow(item);   // v0.9.1120: same resolver as the filter — adoption-aware
    const pd = (_pd0 && !item._personalOnly && String(_pd0.era || '') === 'Manual') ? null : _pd0;   // v0.9.718
    const isOwned = item._personalOnly ? true : (pd?.owned || false);
    const isWanted = !!state.wantData[`${item.itemNum}|${item.variation}`];
    const cond = pd?.condition ? parseInt(pd.condition) : null;
    const condClass = cond >= 9 ? 'cond-9' : cond >= 7 ? 'cond-7' : cond >= 5 ? 'cond-5' : cond ? 'cond-low' : '';
    let globalIdx = _masterIdxOf(item._origItem || item);
    // For _personalOnly items not in masterData, use negative index via global array
    if (globalIdx < 0 && item._personalOnly) {
      const poKey = findPDKey(_displayItemNum(item), item.variation);
      if (poKey) {
        if (!window._poKeys) window._poKeys = [];
        let poIdx = window._poKeys.indexOf(poKey);
        if (poIdx < 0) poIdx = window._poKeys.push(poKey) - 1;
        globalIdx = -(poIdx + 1000);
      }
    }
    // Bug 15 (Session 154): inventory ID of the specific copy this row
    // represents, so clicking it opens THAT copy's detail (not the first).
    var _copyInv = (item._copyPd && item._copyPd.inventoryId) || (pd && pd.inventoryId) || '';
    // Phase 3: per-copy badges — check by THIS copy's inventoryId only.
    const _outerInvId = pd && pd.inventoryId ? pd.inventoryId : '';
    const isForSale = !!(_outerInvId && state.forSaleData[_outerInvId]);
    const _isUpgradeM = !!(_outerInvId && state.upgradeData[_outerInvId]);
    const badgeClass = isOwned ? (isForSale ? 'forsale' : 'yes') : isWanted ? 'want' : 'no';
    const badgeText  = isOwned ? (isForSale ? '🏷️ For Sale' : (_isUpgradeM ? '↑ Upgrade' : '✓ Owned')) : isWanted ? '★ Want' : '—';
    const _mv = parseFloat(item.marketVal);
    const marketVal  = item.marketVal && !isNaN(_mv) ? _currencySymbol() + _mv.toLocaleString() : '';

    if (isMobile) {
      const _escVar = (item.variation||'').replace(/'/g,"\\'");
      const _pdKey = findPDKey(_displayItemNum(item), item.variation);
      const _pdRow = pd && pd.row ? pd.row : 0;
      const _isQE = pd && pd.quickEntry;
      const _isGrouped = pd && pd.groupId;
      const _hasPhoto = pd && pd.photoItem;
      // Phase 3: per-copy detection — direct inventoryId lookup, no legacy
      // fallback (data is migrated; rows without inventoryId are stored under
      // synthetic legacy-row-N keys and won't collide with other copies).
      const _myInvIdM = pd && pd.inventoryId ? pd.inventoryId : '';
      const _fsEntryM = _myInvIdM ? state.forSaleData[_myInvIdM] : null;
      const _ugEntryM = _myInvIdM ? state.upgradeData[_myInvIdM] : null;
      const _isThisCopyFS = !!_fsEntryM;
      const _isThisCopyUG = !!_ugEntryM;
      const _statusIcons = (_isThisCopyFS ? '<span title="This copy is For Sale" style="font-size:0.8rem">🏷️</span>' : '')
                         + (_isThisCopyUG ? '<span title="This copy on Upgrade list" style="font-size:0.8rem;color:#8b5cf6">↑</span>' : '')
                         + (_isGrouped ? '<span title="Grouped item" style="font-size:0.8rem">🔗</span>' : '')
                         + (_isQE ? '<span title="Quick Entry — details incomplete" style="font-size:0.8rem">⚡</span>' : '')
                         + (_hasPhoto ? '<span title="Has photo" style="font-size:0.8rem" onclick="event.stopPropagation();openPhotoFolder(\''+item.itemNum+'\',\''+(_hasPhoto||'')+'\')">📷</span>' : '');
      // v0.9.921 (chunk 2): share keys are per-copy identity — use inventoryId
      // (stable) instead of row number (shifts when sheet rows change). Items
      // without an owned copy / legacy rows keep the composite fallback.
      const _shareKey = _myInvIdM || (item.itemNum + '|' + (item.variation||'') + '|' + _pdRow);
      const _inShareMode = typeof isShareMode === 'function' && isShareMode('collection');
      const _isShareSelected = _inShareMode && window._shareItems && window._shareItems[_shareKey];
      if (_inShareMode) { if (!window._shareDataMap) window._shareDataMap = {}; window._shareDataMap[_shareKey] = { itemNum: item.itemNum, variation: item.variation||'', pd: pd, master: item }; }
      return `<div class="browse-card" id="share-card-${_shareKey}" onclick="${_inShareMode ? 'toggleShareItem(\'' + _shareKey + '\')' : 'showItemDetailPage(' + globalIdx + ", '" + _copyInv + "')"}" style="cursor:pointer${_isShareSelected ? ';outline:2px solid #2ecc71;background:rgba(46,204,113,0.08)' : ''}">
        <div style="display:flex;align-items:center;gap:0.5rem;width:100%;min-width:0">
          ${_inShareMode ? '<input type="checkbox" id="share-cb-' + _shareKey + '" ' + (_isShareSelected ? 'checked' : '') + ' onclick="event.stopPropagation();toggleShareItem(\'' + _shareKey + '\')" style="width:1.1rem;height:1.1rem;accent-color:#2ecc71;flex-shrink:0">' : ''}
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:nowrap">
              <span class="browse-card-num" style="white-space:nowrap">${_displayItemNum(item)}${item.variation ? ' <span style="font-size:0.72rem;color:var(--text-dim)">' + item.variation + '</span>' : ''}</span>${_noNumTag(item.itemNum)}${(typeof eraBadgeHTML === 'function' && window.ERA_BADGES && window.ERA_BADGES.showInBrowse) ? eraBadgeHTML(item._tab) : ''}
              <span style="display:flex;gap:0.2rem;align-items:center">${_statusIcons}</span>
            </div>
            ${item.roadName ? `<div class="browse-card-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${item.roadName}</div>` : ''}
            <div class="browse-card-sub" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${[(typeof getTypeBucketLabel === 'function' ? getTypeBucketLabel(item) : item.itemType), item.yearProd].filter(Boolean).join(' · ')}</div>
          </div>
          ${marketVal ? `<div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.25rem;flex-shrink:0">
            <span class="market-val" style="font-size:0.72rem">${marketVal}</span>
          </div>` : ''}
          ${(function(){
            // v0.9.1025 (Brad): thumbnail on the right of every row. The ✕
            // remove button is GONE from phone rows — too easy to hit by
            // accident; removing lives on the item's own page. The condition
            // PIP (the little coloured dot) is gone too: it encoded the same
            // grade the number already states.
            if (!_hasPhoto || !pd) return '';
            var _tid = 'coll-thumb-' + String(_myInvIdM || (item.itemNum + '-' + (item.variation||''))).replace(/[^A-Za-z0-9_-]/g, '');
            _collThumbJobs.push({ id: _tid, pd: pd });
            return '<div id="' + _tid + '" style="width:56px;height:44px;border-radius:7px;overflow:hidden;background:var(--surface2);flex-shrink:0"></div>';
          })()}
        </div>
      </div>`;
    } else if (state.filters.owned) {
      // ── My Collection view: Item # | Description | Actions (3 clean columns) ──
      const _isQuick = pd && pd.quickEntry;
      const _groupId = pd && pd.groupId ? pd.groupId : '';
      const _escVar = (item.variation||'').replace(/'/g,"\'");
      const _dispNum = _displayItemNum(item);
      const _descParts = [item.roadName, item.itemType].filter(Boolean);
      // v0.9.720/721 (Brad): show the real DESCRIPTION — road·type was echoing
      // the Type column whenever a catalog row had no road name.
      const _descFull  = (item._personalOnly && item.description) ? item.description
        : ([item.roadName, item.description].filter(Boolean).join(' — ') || _descParts.join(' · ') || '—');
      const _descShort = _descFull.length > 110 ? _descFull.substring(0, 108) + '…' : _descFull;   // v0.9.938: column is wide now
      const _varText   = item.variation ? ` <span style="font-size:0.72rem;color:var(--text-dim);background:var(--surface2);padding:1px 5px;border-radius:4px;margin-left:3px">${item.variation}</span>` : '';
      const _typeText = (typeof getTypeBucketLabel === 'function' ? getTypeBucketLabel(item) : item.itemType) || '<span style="color:var(--text-dim)">—</span>';
      const _ewNum = pd && pd.userEstWorth ? parseFloat(pd.userEstWorth) : NaN;
      const _estWorth = isFinite(_ewNum) ? _currencySymbol() + _ewNum.toLocaleString() : '<span style="color:var(--text-dim)">—</span>';
      // Phase 3: per-copy detection — direct inventoryId lookup only.
      const _myInvId = pd && pd.inventoryId ? pd.inventoryId : '';
      const _fsEntry = _myInvId ? state.forSaleData[_myInvId] : null;
      const _ugEntry = _myInvId ? state.upgradeData[_myInvId] : null;
      const _isThisCopyFS = !!_fsEntry;
      const _isThisCopyUG = !!_ugEntry;
      const _isAnyFS = !!_fsEntry;
      const _isAnyUG = !!_ugEntry;
      // Count how many copies of this item exist in collection
      const _copyCount = Object.values(state.personalData).filter(p => p.itemNum === item.itemNum && (p.variation||'') === (item.variation||'') && p.owned).length;
      // Status badges — render on a line UNDER the item number (Brad's
      // request) so they read clearly and don't drift under the Var column.
      const _statusBadges = (_isThisCopyFS ? '<span title="On the For Sale list" style="font-size:0.82rem;margin-left:3px;vertical-align:middle">🏷️</span>' : '')
        + (_isThisCopyUG ? '<span title="On the Upgrade list" style="font-size:0.74rem;margin-left:3px;color:#8b5cf6;font-weight:700;vertical-align:middle">↑</span>' : '');
      // v0.9.921 (chunk 2): per-copy share key by inventoryId, composite fallback.
      const _shareKeyD = _myInvId || (item.itemNum + '|' + (item.variation||'') + '|' + (pd && pd.row ? pd.row : 0));
      const _inShareModeD = typeof isShareMode === 'function' && isShareMode('collection');
      const _isShareSelectedD = _inShareModeD && window._shareItems && window._shareItems[_shareKeyD];
      if (_inShareModeD) { if (!window._shareDataMap) window._shareDataMap = {}; window._shareDataMap[_shareKeyD] = { itemNum: item.itemNum, variation: item.variation||'', pd: pd, master: item }; }
      // Smart buttons based on per-copy list status
      const _fsBtn = _isThisCopyFS
        ? `<button onclick="event.stopPropagation();_removeForSaleFromCollection('${_myInvId}')" style="padding:0.2rem 0.45rem;border-radius:5px;font-size:0.7rem;cursor:pointer;border:1px solid #e67e22;background:#e67e22;color:#fff;font-family:var(--font-body);font-weight:600;margin-right:0.2rem" title="Remove from For Sale list">Unlist</button>`
        : `<button onclick="event.stopPropagation();collectionActionForSale(${globalIdx},'${_dispNum}','${_escVar}',${pd && pd.row ? pd.row : 0},'${_myInvId}')" style="padding:0.2rem 0.45rem;border-radius:5px;font-size:0.7rem;cursor:pointer;border:1px solid #e67e22;background:rgba(230,126,34,0.1);color:#e67e22;font-family:var(--font-body);font-weight:600;margin-right:0.2rem" title="Add to For Sale list">For Sale</button>`;
      const _upgBtn = _isThisCopyUG
        ? `<button onclick="event.stopPropagation();_removeUpgradeFromCollection('${_myInvId}')" style="padding:0.2rem 0.45rem;border-radius:5px;font-size:0.7rem;cursor:pointer;border:1px solid #8b5cf6;background:#8b5cf6;color:#fff;font-family:var(--font-body);font-weight:600;margin-right:0.2rem" title="Remove from Upgrade list">Un-Upg.</button>`
        : `<button onclick="event.stopPropagation();showAddToUpgradeModal('${_dispNum}','${_escVar}',${pd && pd.row ? pd.row : 0},'${_myInvId}')" style="padding:0.2rem 0.45rem;border-radius:5px;font-size:0.7rem;cursor:pointer;border:1px solid #8b5cf6;background:rgba(139,92,246,0.1);color:#8b5cf6;font-family:var(--font-body);font-weight:600;margin-right:0.2rem" title="Add to Upgrade list">Upgrade</button>`;
      return `<tr id="share-card-${_shareKeyD}" onclick="${_inShareModeD ? 'toggleShareItem(\'' + _shareKeyD + '\')' : 'showItemDetailPage(' + globalIdx + ", '" + _copyInv + "')"}" style="cursor:pointer${_isQuick ? ';opacity:0.82' : ''}${_isShareSelectedD ? ';outline:2px solid #2ecc71;background:rgba(46,204,113,0.06)' : ''}" data-group="${_groupId}" data-item="${item.itemNum}">
        ${_collGutterTd(_shareKeyD, _isShareSelectedD)}
        ${(function(){
          var _b = (typeof _mfrBadge === 'function') ? _mfrBadge({ manufacturer: (pd && pd.manufacturer) || '' }) : '<td>\u2014</td>';
          // v0.9.726 (Brad): stack SCALE under the maker badge.
          var _sc = (pd && pd.gauge) || (item && item.gauge) || '';
          if (!_sc && item && item._era && typeof ERA_SCALE !== 'undefined') _sc = ERA_SCALE[item._era] || '';
          if (!_sc && pd && pd.era && typeof ERA_SCALE !== 'undefined') _sc = ERA_SCALE[String(pd.era).toLowerCase()] || '';
          return _sc ? _b.replace('</td>', '<div style="font-size:0.66rem;color:var(--text-dim);margin-top:2px;letter-spacing:0.04em">' + _sc + '</div></td>') : _b;
        })()}
        <td style="max-width:170px;overflow:hidden">
          <span class="item-num" style="display:inline-block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:bottom" title="${String(_displayItemNum(item)).replace(/"/g,'&quot;')}">${_displayItemNum(item)}</span>${_noNumTag(item.itemNum)}
          <div style="margin-top:1px;line-height:1.1;white-space:nowrap">
            ${(typeof eraBadgeHTML === 'function' && window.ERA_BADGES && window.ERA_BADGES.showInBrowse) ? eraBadgeHTML(item._tab) : ''}
            ${(function(){ var _co = (typeof _ownedCompanions === 'function') ? _ownedCompanions(pd) : []; if (_co.length) {
              var _gcfg = (typeof groupConfigLabel === 'function') ? groupConfigLabel(_dispNum, _co) : '';
              var _lbl = _gcfg === 'Engine + Tender' ? 'Engine + Tender' : (_gcfg && _gcfg !== 'Set' ? _gcfg + ' Set' : '🔗 ' + _co.join(' '));
              return '<span style="font-size:0.7rem;color:var(--accent3);font-weight:600" title="Grouped: ' + _dispNum + ' + ' + _co.join(', ') + '">🔗 ' + _lbl + '</span>';
            } return _groupId ? '<span style="font-size:0.6rem;color:var(--accent3)" title="Grouped">🔗</span>' : ''; })()}
            ${_isQuick ? '<span onclick="event.stopPropagation();completeQuickEntry(\''+item.itemNum+'\',\''+_escVar+'\','+globalIdx+',\''+(pd.inventoryId||'')+'\')" style="font-size:0.72rem;background:#2ecc71;color:#fff;border-radius:4px;padding:1px 5px;cursor:pointer;font-weight:700" title="Complete this Quick Entry">⚡</span>' : ''}
            ${pd && pd.photoItem ? '<span style="font-size:0.78rem;opacity:0.75" title="Has photo">📷</span>' : ''}
            ${_statusBadges}
          </div>
        </td>
        <td style="white-space:nowrap;text-align:center">${item.variation ? '<span style="font-size:0.78rem;color:var(--text-mid)">' + item.variation + '</span>' : '<span style="color:var(--text-dim)">—</span>'}</td>
        <td style="font-size:0.78rem;color:var(--text-dim)">${_typeText}${(pd && pd.subType) ? '<div style="font-size:0.66rem;opacity:0.8;margin-top:1px">' + pd.subType + '</div>' : ''}</td>
        <td style="width:52px;text-align:center;padding:2px 4px"><div id="thumb-${item.itemNum}-${item.variation||''}" style="width:44px;height:44px;border-radius:5px;background:var(--surface2);display:inline-flex;align-items:center;justify-content:center;overflow:hidden;vertical-align:middle"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></div></td>
        <td style="color:var(--text-mid);font-size:0.85rem" title="${(_descFull||'').replace(/"/g,'&quot;')}">${_descFull}</td>
        <td style="font-size:0.82rem;color:var(--gold);white-space:nowrap;text-align:center">${_estWorth}</td>
        <td style="font-size:0.76rem;color:var(--text-dim);white-space:nowrap;width:80px;text-align:center">${(function(){ var d = (pd && (pd.dateAdded || pd.datePurchased)) || ''; if (d) return (typeof _formatDate === 'function') ? _formatDate(d) : d; if (pd && pd._savedAt) { try { return new Date(pd._savedAt).toLocaleDateString(); } catch(e){} } return '—'; })()}</td>
        <td class="coll-actions-cell" style="text-align:right">
          ${!_inShareModeD ? `${_fsBtn}
          <button onclick="event.stopPropagation();collectionActionSold(${globalIdx},'${_dispNum}','${_escVar}',${pd && pd.row ? pd.row : 0},'${_myInvId}')" style="padding:0.2rem 0.45rem;border-radius:5px;font-size:0.7rem;cursor:pointer;border:1px solid #2ecc71;background:rgba(46,204,113,0.1);color:#2ecc71;font-family:var(--font-body);font-weight:600;margin-right:0.2rem" title="Mark as sold / add to Sold list">Sold</button>
          ${_upgBtn}
          <button onclick="event.stopPropagation();removeCollectionItem('${_dispNum}','${_escVar}',${pd && pd.row ? pd.row : 0},'${_myInvId}')" style="padding:0.2rem 0.45rem;border-radius:5px;font-size:0.7rem;cursor:pointer;border:1px solid var(--border);background:var(--surface2);color:#f05008;font-family:var(--font-body)">Remove</button>` : ''}
        </td>
      </tr>`;
    } else {
      // v0.9.985 (Brad): truncation now scales with the window — wide screens
      // show far more of the variation text (was a hard 28-char chop).
      const _vdMax = window.innerWidth > 1500 ? 90 : window.innerWidth > 1200 ? 64 : window.innerWidth > 900 ? 44 : 28;
      const vdShort = item.varDesc ? (typeof varShortLabel === 'function' ? varShortLabel(item.varDesc, _vdMax) : (item.varDesc.length > _vdMax ? item.varDesc.substring(0,_vdMax)+'…' : item.varDesc)) : '';
      const vdCell = vdShort
        ? `<span style="cursor:pointer;border-bottom:1px dashed var(--border);color:var(--text-mid)" onclick="event.stopPropagation();showVarDescPopup(${globalIdx})">${vdShort}</span>`
        : '<span class="text-dim">—</span>';
      const _isErrCar = pd && pd.isError === 'Yes';
      const _isQuick = pd && pd.quickEntry;
      const _eraBadgeHtml = (typeof eraBadgeHTML === 'function' && window.ERA_BADGES && window.ERA_BADGES.showInBrowse) ? eraBadgeHTML(item._tab) : '';
      return `<tr onclick="browseRowClick(event, ${globalIdx})" style="cursor:pointer${_isQuick ? ';opacity:0.78' : ''}" title="${_isErrCar ? '⚠ Error car: ' + (pd.errorDesc||'see notes') : _isQuick ? '⚡ Quick Entry — details not yet filled in' : ''}">
        ${_mfrBadge(item)}
        <td>
          <span class="item-num">${_displayItemNum(item)}${_isErrCar ? '<sup style="color:var(--accent);font-size:0.65rem">*</sup>' : ''}${_isQuick ? '<span onclick="event.stopPropagation();completeQuickEntry(\''+item.itemNum+'\',\''+((item.variation||'').replace(/\'/g,"\\\\'"))+'\','+globalIdx+',\''+(pd.inventoryId||'')+'\')" style="font-size:0.6rem;background:#2ecc71;color:#fff;border-radius:3px;padding:1px 4px;vertical-align:middle;font-weight:600;cursor:pointer" title="Complete this Quick Entry">⚡</span>' : ''}</span>${_noNumTag(item.itemNum)}${_eraBadgeHtml}
          ${_itemExternalLinkHTML(item)}
          <span id="cam-${item.itemNum}-${item.variation||''}" style="margin-left:5px;font-size:0.85rem;cursor:pointer;display:none" onclick="event.stopPropagation();openPhotoFolder('${item.itemNum}','${pd&&pd.photoItem?pd.photoItem:''}')" title="Open photo folder">📷</span>
        </td>
        <td><span class="tag">${(typeof getTypeBucketLabel === 'function' ? getTypeBucketLabel(item) : item.itemType) || '—'}</span></td>
        ${((_currentEra === 'atlas') || (item && item._tab === 'Atlas O')) ? (
        _currentEra === 'all' ? `
        <td>${item.description || '<span class="text-dim">—</span>'}</td>
        <td>${item.subType || '<span class="text-dim">—</span>'}</td>
        <td>${item.trackPower || '<span class="text-dim">—</span>'}</td>
        <td class="text-dim">${item.msrp ? _currencySymbol() + parseFloat(String(item.msrp).replace(/[^0-9.]/g,'')).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}) : '—'}</td>
        ` : `
        <td>${item.subType || '<span class="text-dim">—</span>'}</td>
        <td>${item.description || '<span class="text-dim">—</span>'}</td>
        <td>${item.trackPower || '<span class="text-dim">—</span>'}</td>
        <td class="text-dim">${item.msrp ? _currencySymbol() + parseFloat(String(item.msrp).replace(/[^0-9.]/g,'')).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}) : '—'}</td>
        `) : (((_currentEra && _currentEra.indexOf('mth_') === 0) || (item && item._tab && item._tab.indexOf('MTH ') === 0)) ? `
        <td>${item.roadName || '<span class="text-dim">—</span>'}</td>
        <td>${item.description || '<span class="text-dim">—</span>'}</td>
        <td>${item.category || '<span class="text-dim">—</span>'}</td>
        <td>${item.trackPower || '<span class="text-dim">—</span>'}</td>
        ` : `
        <td>${item.roadName || '<span class="text-dim">—</span>'}</td>
        <td>${item.description || '<span class="text-dim">—</span>'}</td>
        <td>${item.variation || '<span class="text-dim">—</span>'}</td>
        <td>${vdCell}</td>
        `)}
        <td class="text-dim">${item.yearProd || '—'}</td>
        <td><span class="owned-badge ${badgeClass}">${badgeText}</span></td>
      </tr>`;
    }
  });

  // Session 127: cross-scope search banner. When search has content and the
  // current era has no in-scope matches, offer to search across all the user's
  // other eras (powered by the pre-built per-era search indexes in IDB).
  const _ssTerm = (state.filters.search || '').trim();
  const _showCrossScope = _ssTerm && rowsHtml.length === 0 && !state.filters.owned;
  const _ssEsc = _showCrossScope
    ? _ssTerm.replace(/[<>"'&]/g, function(c){ return {'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','&':'&amp;'}[c]; })
    : '';
  const _ssEraLabel = (typeof _currentEra !== 'undefined' && ERAS[_currentEra] && ERAS[_currentEra].label)
    ? ERAS[_currentEra].label : 'this era';
  const _crossScopeBanner = _showCrossScope
    ? ('<div id="cross-scope-search-area" style="padding:2rem 1rem;text-align:center">'
      + '<div style="font-size:2rem;margin-bottom:0.5rem">🔍</div>'
      + '<p style="font-weight:600;margin-bottom:0.4rem">No matches in ' + _ssEraLabel + ' for &ldquo;<span style="color:var(--accent)">' + _ssEsc + '</span>&rdquo;</p>'
      + '<p style="font-size:0.85rem;color:var(--text-dim);margin-bottom:0.9rem">Want to look across your other manufacturers and eras?</p>'
      + '<button onclick="_triggerCrossScopeSearch()" style="padding:0.55rem 1rem;border-radius:7px;border:1px solid var(--border);background:var(--accent);color:var(--on-accent);font-family:var(--font-body);font-size:0.9rem;font-weight:600;cursor:pointer">Search across all your eras</button>'
      + '</div>')
    : '';

  const emptyHtml = isMobile
    ? (_crossScopeBanner || '<div style="text-align:center;padding:3rem 1rem;color:var(--text-dim)"><div style="font-size:2.5rem;margin-bottom:0.5rem">🔍</div><p>No items match your filters</p></div>')
    : '<tr><td colspan="' + (state.filters.owned ? _collColSpan() : 9) + '">' + (_crossScopeBanner || '<div class="empty-state"><div class="empty-icon">🔍</div><p>No items match your filters</p><p style="font-size:0.8rem;color:var(--text-dim);margin-top:0.25rem">Try clearing some filters</p></div>') + '</td></tr>';

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
    // v0.9.1025: fill the row thumbnails (cached file-id per item, so Drive
    // is asked once per item ever — same helper the dashboard uses).
    if (_collThumbJobs.length && typeof _thumbFor === 'function') {
      _collThumbJobs.slice(0, 60).forEach(function (job) {
        Promise.resolve(_thumbFor(job.pd)).then(function (fid) {
          var host = document.getElementById(job.id);
          if (!host || !fid) return;
          var img = document.createElement('img');
          img.style.cssText = 'width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity 0.3s';
          img.onload = function () { img.style.opacity = 1; };
          host.innerHTML = '';
          host.appendChild(img);
          if (typeof loadDriveThumb === 'function') loadDriveThumb(fid, img, host, null, 'lo');
        }).catch(function () {});
      });
    }
  } else {
    // v0.9.986: single-section view shows its typed train-store rows + the
    // section's own rows; the "no items" banner only when BOTH are empty.
    tbody.innerHTML = _collSecFiltered
      ? ((rowsHtml.join('') + _ephRowsHtml) || emptyHtml)
      : (rowsHtml.join('') || emptyHtml) + _ephRowsHtml;
  }
  // Async: load thumbnails for My Collection view
  if (state.filters.owned) {
    pageData.forEach(function(item) {
      if (item._setFold) return;                       // folded set header has no thumbnail
      // v0.9.1123 (Brad's missing thumbnails), cause 1: this pass still used a
      // strict findPD against the CATALOG row's variation, while the item is
      // saved with a blank one — so every adopted row (v0.9.1120) resolved to
      // nothing and silently skipped its picture. Same resolver as the filter,
      // the sorter and the renderer now.
      const pd2 = _rrPdForRow(item);
      if (!pd2 || !pd2.owned) return;
      const thumbEl = document.getElementById('thumb-' + item.itemNum + '-' + (item.variation || ''));
      if (!thumbEl) return;
      // cause 2: photos can be filed in the item's Drive folder while the
      // sheet's photo-link cell is still blank. The detail page already falls
      // back to the folder; the list now does too (find-only — never creates).
      const _linkP = pd2.photoItem
        ? Promise.resolve(pd2.photoItem)
        : (typeof driveFindItemFolder === 'function'
            ? driveFindItemFolder(_displayItemNum(item)).catch(function () { return ''; })
            : Promise.resolve(''));
      _linkP.then(function (_link) {
      if (!_link) return;
      driveGetFolderPhotos(_link).then(function(photos) {
        if (photos && photos.length > 0) {
          const fileId = photos[0].id;
          const el = document.getElementById('thumb-' + item.itemNum + '-' + (item.variation || ''));
          if (el) {
            const img = document.createElement('img');
            img.style.cssText = 'width:40px;height:40px;object-fit:cover;border-radius:4px';
            el.innerHTML = '';
            el.appendChild(img);
            loadDriveThumb(fileId, img, el, (photos[0] && photos[0].thumbnailLink) || null, 'lo');
          }
        } else {
          const el = document.getElementById('thumb-' + item.itemNum + '-' + (item.variation || ''));
          if (el) el.innerHTML = '<span style="display:flex;align-items:center;justify-content:center;height:100%"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.35"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></span>';
        }
      });
      });
    });
  }
  // v0.9.985 (Brad): the bar is now a section FILTER, not a scroll shortcut —
  // each chip shows ONLY that part of the collection (Trains / Catalogs /
  // Paper Items / …), with "All" bringing back the old combined list. The
  // chip list comes from _collAllSections (captured before filtering), so
  // every section stays clickable no matter which one is active.
  (function() {
    var wrapEl = document.querySelector('.browse-table-wrap');
    var bar = document.getElementById('coll-jump-bar');
    var sections = _collAllSections || [];
    if (!state.filters.owned || isMobile || !sections.length) { if (bar) bar.style.display = 'none'; return; }
    if (!bar && wrapEl && wrapEl.parentNode) {
      bar = document.createElement('div');
      bar.id = 'coll-jump-bar';
      wrapEl.parentNode.insertBefore(bar, wrapEl);
    }
    if (!bar) return;
    bar.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.4rem;align-items:center;margin:0 0 0.5rem';
    var _active = state._collSection || 'trains';
    function _chip(key, label, color) {
      var on = (_active === key);
      return '<button onclick="_collSectionSet(\'' + key + '\')" style="'
        + 'padding:0.25rem 0.7rem;border-radius:999px;font-size:0.72rem;font-weight:600;cursor:pointer;font-family:var(--font-body);'
        + 'border:1.5px solid ' + color + ';'
        + 'color:' + (on ? '#fff' : color) + ';'
        + 'background:' + (on ? color : 'var(--surface2)') + '">'
        + label + '</button>';
    }
    bar.innerHTML = '<span style="font-size:0.68rem;letter-spacing:0.08em;color:var(--text-dim);text-transform:uppercase;margin-right:0.2rem">Show:</span>'
      + _chip('trains', 'Trains', '#2980b9')
      + sections.map(function(sec) {
          return _chip(sec.key, sec.label.replace(/^[^A-Za-z0-9]+\s*/, ''), sec.color);
        }).join('')
      + _chip('all', 'All', '#7f8c8d');
  })();

  // v0.9.812: load ephemera thumbnails — the eph-thumb span was rendered but
  // never populated (always an empty gray box). Same folder-photo approach as
  // the item thumbs above; hides itself if the folder is empty/unreadable.
  if (state.filters.owned && _ephemeraRows.length) {
    _ephemeraRows.forEach(function(r) {
      if (!r._eph || !r.item || !r.item.photoLink) return;
      var _tid = 'eph-thumb-' + r.tabId + '-' + r.item.row;
      if (!document.getElementById(_tid)) return;
      driveGetFolderPhotos(r.item.photoLink).then(function(photos) {
        var el = document.getElementById(_tid);
        if (!el) return;
        if (photos && photos.length > 0) {
          var img = document.createElement('img');
          img.style.cssText = 'width:34px;height:34px;object-fit:cover;border-radius:4px';
          el.innerHTML = '';
          el.appendChild(img);
          loadDriveThumb(photos[0].id, img, el);
        } else {
          el.style.display = 'none';
        }
      }).catch(function() {
        var el = document.getElementById(_tid);
        if (el) el.style.display = 'none';
      });
    });
  }

  // Async: check which owned items have photos and reveal their camera icons
  if (state.filters.owned) {
    pageData.forEach(function(item) {
      if (item._setFold) return;
      // v0.9.1123: the camera-icon pass had BOTH of the thumbnail bugs — a
      // strict findPD against the catalog row's variation, and a hard bail on
      // a blank photo-link cell. Same resolver, same find-only fallback (the
      // folder id is cached by the thumbnail pass, so this costs nothing new).
      const pd2 = _rrPdForRow(item);
      if (!pd2 || !pd2.owned) return;
      const camEl = document.getElementById('cam-' + item.itemNum + '-' + (item.variation || ''));
      if (!camEl) return;
      const _camLinkP = pd2.photoItem
        ? Promise.resolve(pd2.photoItem)
        : (typeof driveFindItemFolder === 'function'
            ? driveFindItemFolder(_displayItemNum(item)).catch(function () { return ''; })
            : Promise.resolve(''));
      _camLinkP.then(function (_camLink) {
        if (!_camLink) return;
        driveGetFolderPhotos(_camLink).then(function(photos) {
          if (photos && photos.length > 0) {
            const c1 = document.getElementById('cam-' + item.itemNum + '-' + (item.variation || ''));
            const c2 = document.getElementById('cam-' + item.itemNum + '-' + (item.variation || '') + '-m');
            if (c1) c1.style.display = 'inline';
            if (c2) c2.style.display = 'inline';
          }
        });
      });
    });
  }

  // Pagination — only render when there are multiple pages of main items.
  // Filters out the previously-shown page "0" when total === 0, and hides
  // the pager entirely on a single-page result.
  const paginEl = document.getElementById('pagination-btns');
  // v0.9.986: sections paginate their own train-store rows normally.
  if (pages <= 1) {
    paginEl.innerHTML = '';
  } else {
    let btns = '';
    if (state.currentPage > 1) btns += `<button class="page-btn" onclick="goPage(${state.currentPage-1})">‹</button>`;
    const range = [1, ...Array.from({length: pages}, (_,i)=>i+1).filter(p => Math.abs(p - state.currentPage) <= 2), pages];
    [...new Set(range)].filter(p => p >= 1).sort((a,b)=>a-b).forEach((p, i, arr) => {
      if (i > 0 && arr[i-1] < p - 1) btns += `<span style="padding:0 4px;color:var(--text-dim)">…</span>`;
      btns += `<button class="page-btn ${p === state.currentPage ? 'active' : ''}" onclick="goPage(${p})">${p}</button>`;
    });
    if (state.currentPage < pages) btns += `<button class="page-btn" onclick="goPage(${state.currentPage+1})">›</button>`;
    paginEl.innerHTML = btns;
  }
  // v0.9.985 (perf): render finished — remember what it was built from, so an
  // unchanged revisit can skip all of the above (see the check at the top).
  try { window._rrBrowseSig = window._rrBrowseSigPending || null; } catch (eSig2) {}
}

function goPage(p) { state.currentPage = p; renderBrowse(); document.getElementById('main-content').scrollTop = 0; }

// ── Phone filter sheet (v0.9.1025, Brad) ────────────────────────────────
// On phones the filter block (maker/scale/era/type chips + search) ate a
// third of the screen. It now lives behind a "Filters" button next to Add
// and Share: the sheet MOVES the real filter DOM in and puts it back on
// close, so every existing control keeps working exactly as it did — no
// duplicate markup, no re-wiring.
function _rrFilterSheetOpen() {
  var row = document.getElementById('hierarchy-chip-row');
  if (!row || document.getElementById('rr-filter-sheet')) return;
  var home = document.createElement('div');
  home.id = 'rr-filter-home';
  home.style.display = 'none';
  row.parentNode.insertBefore(home, row);          // bookmark the spot

  var ov = document.createElement('div');
  ov.id = 'rr-filter-sheet';
  ov.style.cssText = 'position:fixed;inset:0;z-index:99940;background:rgba(0,0,0,0.55);display:flex;align-items:flex-end;justify-content:center';
  ov.innerHTML = '<div id="rr-filter-panel" style="background:var(--surface);border-radius:16px 16px 0 0;width:100%;max-height:85dvh;overflow-y:auto;padding:0.9rem 0.9rem 1.1rem">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.7rem">'
    +   '<strong style="font-family:var(--font-head);font-size:0.95rem;letter-spacing:0.06em;text-transform:uppercase;color:var(--text)">Filters</strong>'
    +   '<button onclick="_rrFilterSheetClose()" style="background:none;border:none;color:var(--text-dim);font-size:1.5rem;line-height:1;cursor:pointer;padding:0 0.3rem">\u00d7</button>'
    + '</div>'
    + '<div id="rr-filter-slot"></div>'
    + '<button onclick="_rrFilterSheetClose()" style="width:100%;margin-top:0.9rem;padding:0.75rem;border-radius:10px;border:none;background:var(--accent);color:var(--on-accent);font-family:var(--font-body);font-weight:700;font-size:0.95rem;cursor:pointer">Show results</button>'
    + '</div>';
  ov.addEventListener('click', function (e) { if (e.target === ov) _rrFilterSheetClose(); });
  // v0.9.1028 (Brad): mount inside .main — the LIGHT theme palette is scoped
  // to .main, so a sheet parked on <body> rendered in the dark palette.
  (document.querySelector('.main') || document.body).appendChild(ov);
  var slot = document.getElementById('rr-filter-slot');
  row.style.display = '';                          // it is hidden on phones by CSS
  row.classList.add('rr-in-sheet');
  slot.appendChild(row);
  if (window.BackStack && BackStack.wire) BackStack.wire(ov);
}
function _rrFilterSheetClose() {
  var ov = document.getElementById('rr-filter-sheet');
  var row = document.getElementById('hierarchy-chip-row');
  var home = document.getElementById('rr-filter-home');
  if (row && home && home.parentNode) {
    row.classList.remove('rr-in-sheet');
    row.style.display = '';
    home.parentNode.insertBefore(row, home);
    home.remove();
  }
  if (ov) ov.remove();
}
// Put a "Filters" button in the page title, left of Add / Share (phones only).
function _rrFilterBtnSync() {
  var title = document.querySelector('#page-browse > .page-title');
  if (!title) return;
  var phone = (window.innerWidth || 0) <= 640;
  var btn = document.getElementById('rr-filter-btn');
  if (!phone) { if (btn) btn.remove(); return; }
  if (btn) return;
  var host = title.querySelector('.qa-tr-actions') || title.lastElementChild || title;
  btn = document.createElement('button');
  btn.id = 'rr-filter-btn';
  btn.className = 'btn';
  btn.setAttribute('onclick', '_rrFilterSheetOpen()');
  btn.style.cssText = 'display:flex;align-items:center;gap:0.3rem;font-size:0.76rem;padding:0.35rem 0.6rem;min-height:38px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text-mid);font-family:var(--font-body);font-weight:600;border-radius:7px;white-space:nowrap';
  btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>Filters';
  host.parentNode.insertBefore(btn, host);         // sits LEFT of Add / Share
}
if (typeof window !== 'undefined') {
  window._rrFilterSheetOpen = _rrFilterSheetOpen;
  window._rrFilterSheetClose = _rrFilterSheetClose;
  window._rrFilterBtnSync = _rrFilterBtnSync;
  window.addEventListener('resize', function () { try { _rrFilterBtnSync(); } catch (e) {} });
}
