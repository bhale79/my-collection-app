// ── Era-aware browse tab visibility ──
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

// ── Era-aware master catalog table headers ──
// Lionel eras use Road/Variation columns; Atlas uses Sub Type/Track-Power/MSRP.
function _atlasBrowseHeaders() {
  return '<th>Item #</th><th>Type</th><th>Sub Type</th><th>Description</th><th>Track/Power</th><th>MSRP</th><th>Year</th><th>Owned</th>';
}
function _lionelBrowseHeaders() {
  return '<th>Item #</th><th>Type</th><th>Road / Name</th><th>Descr.</th><th>Var.</th><th>Var. Descr.</th><th>Year</th><th>Owned</th>';
}
function _refreshBrowseHeaders() {
  var thead = document.querySelector('#page-browse .item-table thead tr');
  if (!thead) return;
  var isAtlas = (typeof _currentEra !== 'undefined' && _currentEra === 'atlas');
  thead.innerHTML = isAtlas ? _atlasBrowseHeaders() : _lionelBrowseHeaders();
}

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
  // Build list of OTHER eras (skip current). Honor user's enabled-eras pref
  // so disabled eras don't show in the search-banner.
  var otherEras = Object.keys(ERAS).filter(function(k) {
    if (k === _currentEra) return false;
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
    + 'background:var(--surface);border:1px solid var(--border);border-radius:8px">'
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

  // Store all roads for the combobox (with counts)
  var _roadCounts = {};
  state.masterData.forEach(function(i) { if (i.roadName) _roadCounts[i.roadName] = (_roadCounts[i.roadName]||0) + 1; });
  window._allRoads = roads.map(function(r) { return { name: r, count: _roadCounts[r] || 0 }; });
  _roadComboBuild();
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
    var _isAtlasEra = (typeof _currentEra !== 'undefined' && _currentEra === 'atlas');
    thead.innerHTML = _isAtlasEra ? _atlasBrowseHeaders() : _lionelBrowseHeaders();
  }
  var _tbl = document.querySelector('#page-browse .item-table');
  if (_tbl) _tbl.classList.remove('collection-view');
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
  // Show Share button for collection view
  var _btnArea = document.querySelector('#page-browse > .page-title > div');
  if (_btnArea && !document.getElementById('share-btn-collection')) {
    var _shareBtn = document.createElement('button');
    _shareBtn.id = 'share-btn-collection';
    _shareBtn.className = 'btn';
    _shareBtn.onclick = function() { if (typeof startShareMode === 'function') startShareMode('collection'); };
    _shareBtn.style.cssText = 'display:flex;align-items:center;gap:0.4rem;border:1.5px solid #3a9e68;color:#3a9e68;background:rgba(58,158,104,0.1);font-weight:600;font-size:0.85rem;padding:0.5rem 0.9rem';
    _shareBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> Share';
    _btnArea.insertBefore(_shareBtn, _btnArea.firstChild);
  }
  // Update table headers for collection view
  const thead = document.querySelector('#page-browse .item-table thead tr');
  if (thead) thead.innerHTML = '<th style="width:110px">Item #</th><th style="width:60px">Var.</th><th style="width:90px">Type</th><th>Description</th><th style="width:90px">Est. Worth</th><th style="width:260px;text-align:right">Actions</th>';
  var _tbl2 = document.querySelector('#page-browse .item-table');
  if (_tbl2) _tbl2.classList.add('collection-view');
  var _leg = document.getElementById('collection-icon-legend');
  if (_leg) _leg.style.display = 'flex';
  renderBrowse();
  // Update tab visibility for collection context
  state._browseTab = 'items';
  renderBrowseTab('items');
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

// ── filterByType (from between non-browse blocks) ───────────
function filterByType(type) { document.getElementById('filter-type').value = type; showPage('browse'); applyFilters(); }

function buildBrowse() { renderBrowse(); }

let _lastBrowseHash = '';

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
  if (filterBar) filterBar.style.display = onItems ? '' : 'none';
  if (disclaimer) disclaimer.style.display = (onItems && _prefGet('lv_show_disclaimer', 'true') === 'true') ? 'flex' : 'none';
  if (identBtn) identBtn.style.display = inCollection ? 'none' : (onItems ? '' : 'none');

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
}

function renderSetsTab() {
  const tbody = document.getElementById('sets-tbody');
  const countEl = document.getElementById('sets-count');
  if (!tbody) return;
  const inColl = !!state.filters.owned;
  const q = (document.getElementById('sets-search')?.value || '').trim().toLowerCase();

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
    const worthStr = mySet && mySet.estWorth ? '$' + parseFloat(mySet.estWorth).toLocaleString() : '';
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
  const ephRows = ephOwnedEntries.map(function(entry) {
    const k = entry[0], c = entry[1];
    const actionsHTML = inColl && typeof _collectionActionsHTML === 'function'
      ? _collectionActionsHTML('catalogs', k, c) : '';
    return '<tr>'
      + '<td><span style="font-family:var(--font-mono);color:var(--accent2)">' + (c.itemNum || '—') + '</span></td>'
      + '<td style="font-size:0.85rem;color:var(--text-mid)">' + (c.year || '—') + '</td>'
      + '<td style="font-size:0.85rem">' + (c.catType || '—') + '</td>'
      + '<td style="font-size:0.88rem">' + (c.title || '—') + (c.hasMailer === 'Yes' ? ' <span style="font-size:0.7rem;color:var(--accent2)">(w/ mailer)</span>' : '') + '</td>'
      + (inColl ? '<td style="text-align:right;white-space:nowrap">' + actionsHTML + '</td>' : '')
      + '</tr>';
  }).join('');
  window._browseFilteredCats = cats;
  tbody.innerHTML = cats.map((c, ci) => {
    const _catOwned = ownedCatIds.has(c.id.toLowerCase());
    const _catBadge = _catOwned ? '<span style="display:inline-block;font-size:0.6rem;font-weight:700;color:#2ecc71;border:1px solid #2ecc71;border-radius:3px;padding:0 3px;margin-left:4px;vertical-align:middle">✓</span>' : '';
    const _catBg = _catOwned ? 'background:rgba(46,204,113,0.04);' : '';
    let actionsHTML = '';
    if (inColl && _catOwned && typeof _collectionActionsHTML === 'function') {
      const ephKey = ephKeyByItemNum.get(c.id.toLowerCase());
      if (ephKey) {
        const ephEntry = state.ephemeraData.catalogs[ephKey];
        actionsHTML = _collectionActionsHTML('catalogs', ephKey, ephEntry);
      }
    }
    return `<tr onclick="showRefItemPopup(&apos;catalog&apos;,${ci})" style="cursor:pointer;${_catBg}">
    <td><span style="font-family:var(--font-mono);color:var(--accent2)">${c.id}</span>${_catBadge}</td>
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
      const worth = is.estValue ? '$' + parseFloat(is.estValue).toLocaleString() : '—';
      const k = isKeyByEntry.get(is) || '';
      const actionsHTML = k && typeof _collectionActionsHTML === 'function'
        ? _collectionActionsHTML('is', k, is)
        : '';
      return '<tr>'
        + '<td><span style="font-family:var(--font-mono);color:var(--accent2)">' + (is.sheetNum || '—') + '</span></td>'
        + '<td style="font-family:var(--font-mono);font-size:0.85rem">' + (is.linkedItem || '—') + '</td>'
        + '<td style="font-size:0.85rem">' + (is.notes || '—') + '</td>'
        + '<td style="font-size:0.82rem;color:var(--text-mid)">' + cond + '</td>'
        + '<td style="font-size:0.82rem;color:var(--text-mid)">' + worth + '</td>'
        + (actionsHTML ? '<td style="text-align:right;white-space:nowrap">' + actionsHTML + '</td>' : '')
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
      val:  it.estValue ? '$' + parseFloat(it.estValue).toLocaleString() : '—',
    });
  });
  Object.entries(state.ephemeraData?.other || {}).forEach(function(entry) {
    const k = entry[0], it = entry[1];
    rows.push({
      srcType: 'other', key: k, _raw: it,
      type:'Other', tc:'#27ae60',
      id: it.title || it.itemNum || '—',
      desc: it.description || '—',
      year: it.year || '—',
      cond: it.condition || '—',
      val:  it.estValue ? '$' + parseFloat(it.estValue).toLocaleString() : '—',
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
    return '<tr>'
      + '<td><span style="font-size:0.72rem;font-weight:700;padding:2px 7px;border-radius:4px;background:' + r.tc + '22;color:' + r.tc + '">' + r.type + '</span></td>'
      + '<td style="font-size:0.88rem;color:var(--accent2)">' + r.id + '</td>'
      + '<td style="font-size:0.85rem;color:var(--text-mid)">' + r.desc + '</td>'
      + '<td style="font-size:0.85rem;color:var(--text-dim)">' + r.year + '</td>'
      + '<td style="font-size:0.85rem">' + r.cond + '</td>'
      + '<td style="font-size:0.85rem;color:var(--accent2)">' + r.val + '</td>'
      + (inColl ? '<td style="text-align:right;white-space:nowrap">' + actionsHTML + '</td>' : '')
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
      const master = typeof findMaster === 'function' ? findMaster(pd.itemNum) : null;
      if (!master || master._tab !== svcTab) return;
      rows.push({
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
    return '<tr>'
      + '<td><span class="item-num">' + r.itemNum + '</span></td>'
      + '<td><span class="tag">' + r.itemType + '</span></td>'
      + '<td>' + r.description + '</td>'
      + '<td>' + r.variation + '</td>'
      + '<td>' + (vd || '<span class="text-dim">—</span>') + '</td>'
      + '<td class="text-dim">' + r.year + '</td>'
      + (r._actionsHTML ? '<td style="text-align:right;white-space:nowrap">' + r._actionsHTML + '</td>' : '')
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
  const fsBtn = '<button onclick="event.stopPropagation();_collectionForSale(' + typeArg + ',' + keyArg + ')" style="' + btnStyle + ';border-color:#f39c12;color:#f39c12">Add to For Sale</button>';
  const sdBtn = '<button onclick="event.stopPropagation();_collectionSold(' + typeArg + ',' + keyArg + ')" style="' + btnStyle + ';border-color:#2ecc71;color:#2ecc71">Add to Sold</button>';
  const upBtn = '<button onclick="event.stopPropagation();_collectionUpgrade(' + typeArg + ',' + keyArg + ')" style="' + btnStyle + ';border-color:#8b5cf6;color:#8b5cf6">Add to Upgrade</button>';
  const rmBtn = '<button onclick="event.stopPropagation();_collectionRemove(' + typeArg + ',' + keyArg + ')" style="' + btnStyle + '">Remove</button>';
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
      removeCollectionItem(pd.itemNum, pd.variation || '', pd.row);
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
  const master = typeof findMaster === 'function' ? findMaster(pd.itemNum) : null;
  const globalIdx = master && state.masterData ? state.masterData.indexOf(master) : -1;
  const itemNum = pd.itemNum;
  const variation = pd.variation || '';
  if (action === 'forsale' && typeof collectionActionForSale === 'function') {
    collectionActionForSale(globalIdx, itemNum, variation, pd.row);
  } else if (action === 'sold' && typeof collectionActionSold === 'function') {
    collectionActionSold(globalIdx, itemNum, variation, pd.row);
  } else if (action === 'upgrade' && typeof showAddToUpgradeModal === 'function') {
    showAddToUpgradeModal(itemNum, variation, pd.row);
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
  const accent = isSold ? '#2ecc71' : '#f39c12';
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

  document.getElementById('_nc-save').onclick = async function() {
    const price = document.getElementById('_nc-price').value;
    const date  = document.getElementById('_nc-date').value;
    const removeIt = isSold ? document.getElementById('_nc-rm-yes').checked : false;
    ov.remove();
    try {
      if (isSold) {
        // Sold sheet columns: Item#, Variation, Copy#, Condition, PricePaid, SalePrice, DateSold, Notes, InventoryID, Manufacturer
        const row = [
          ids.itemNum, ids.variation, '1',
          condition, '', // priceItem unknown for non-Lionel
          price, date, title,
          '',
          (typeof _getEraManufacturer === 'function' ? _getEraManufacturer() : ''),
        ];
        await sheetsAppend(state.personalSheetId, 'Sold!A:J', [row]);
        if (removeIt) await _ncRemoveSourceRow(type, key);
        showToast('✓ Marked as sold');
      } else {
        // For Sale columns: Item#, Variation, Condition, AskingPrice, DateListed, Notes, OrigPrice, EstWorth, InventoryID, Manufacturer
        const row = [
          ids.itemNum, ids.variation,
          condition, price, date, title,
          '', estValue || '',
          '',
          (typeof _getEraManufacturer === 'function' ? _getEraManufacturer() : ''),
        ];
        await sheetsAppend(state.personalSheetId, 'For Sale!A:J', [row]);
        showToast('✓ Listed for sale');
      }
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
      '<div style="background:var(--surface);border-radius:14px;padding:1.5rem;max-width:380px;width:100%;border:1px solid var(--border)">'
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

  document.getElementById('_nc-up-save').onclick = async function() {
    const priority = document.getElementById('_nc-up-pri').value || 'Medium';
    const price    = document.getElementById('_nc-up-price').value || '';
    ov.remove();
    try {
      // Upgrade tab columns assumed: Item#, Variation, Priority, MaxPrice,
      // Notes, DateAdded. Match the schema saveUpgradeItem writes.
      const row = [
        ids.itemNum, ids.variation,
        priority, price,
        title, // notes
        new Date().toISOString().slice(0, 10),
      ];
      await sheetsAppend(state.personalSheetId, 'Upgrade!A:F', [row]);
      // Local state mirror
      if (!state.upgradeData) state.upgradeData = {};
      state.upgradeData[ids.itemNum + '|' + ids.variation] = {
        itemNum: ids.itemNum, variation: ids.variation,
        priority, expectedPrice: price,
        notes: title, dateAdded: new Date().toISOString().slice(0, 10),
      };
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
      '<td><span class="item-num">' + _dispNum + '</span>' + _ownBadge + '</td>' +
      '<td><span class="tag">' + (item.itemType || '—') + '</span></td>' +
      '<td>' + (item.description || '<span class="text-dim">—</span>') + '</td>' +
      '<td>' + (item.variation || '<span class="text-dim">—</span>') + '</td>' +
      '<td>' + (vd || '<span class="text-dim">—</span>') + '</td>' +
      '<td class="text-dim">' + (item.yearProd || '—') + '</td>' +
    '</tr>';
  }).join('');
}

function renderBrowse() {
  _updateBrowseTabsForEra();
  const { type, road, owned, unowned, boxed, search } = state.filters;
  if (typeof _renderCrossEraSearchBanner === 'function') _renderCrossEraSearchBanner(search);
  // Base list: masterData + any personal-only items (e.g. 2343-P not in master)
  const masterNums = new Set(state.masterData.map(m => _displayItemNum(m) + '|' + (m.variation||'')));
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
           || findMaster(_baseNum))
        : null;
      // Fallback: if no suffix match, still try to find master entry by item number alone
      // (handles cases like 2426W saved with no variation but master has variations)
      const _masterFallback = _baseItem ? null
        : (state.masterData.find(m => m.itemNum === pd.itemNum && (!pd.variation || m.variation === pd.variation))
           || findMaster(pd.itemNum));
      const _refItem = _baseItem || _masterFallback;
      return {
        itemNum: pd.itemNum, variation: pd.variation || '',
        itemType: _poType || (_refItem ? _refItem.itemType : ''),
        roadName: pd.roadName || (_refItem ? _refItem.roadName : ''),
        description: _refItem ? _refItem.description : (pd.notes || ''),
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
  const baseList = owned ? [...state.masterData, ...personalOnlyItems]
    : state.masterData.filter(function(m) { return m._tab === SHEET_TABS.items || !m._tab; });

  state.filteredData = baseList.filter(item => {
    const _dispNum = _displayItemNum(item);
    let pd = findPD(_dispNum, item.variation);
    // Verify exact match — don't let findPD's -P/-D fallback match unrelated items
    // (e.g. master "205" Science Set should not match personal "205-P" diesel)
    if (pd && pd.itemNum !== _dispNum) pd = null;
    pd = pd || (item._personalOnly ? item : null);
    const isOwned = item._personalOnly ? true : (pd?.owned || false);
    const hasBox = pd?.hasBox === 'Yes';
    const isSold = !!state.soldData[`${_displayItemNum(item)}|${item.variation}`] || !!state.soldData[`${item.itemNum}|${item.variation}`];
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
      if (!_aliasSearch(haystack, search)) return false;
    }
    return true;
  });

  // Sort My Collection: by item number, with grouped items together
  if (state.filters.owned) {
    state.filteredData.sort((a, b) => {
      const pdA = findPD(_displayItemNum(a), a.variation) || {};
      const pdB = findPD(_displayItemNum(b), b.variation) || {};
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
      if (r._divider) return `<tr><td colspan="${state.filters.owned ? '7' : '8'}" style="padding:0.5rem 0.75rem;background:var(--surface2);font-size:0.72rem;font-weight:600;letter-spacing:0.1em;color:${r.color};text-transform:uppercase;border-top:2px solid ${r.color}33">${r.label}</td></tr>`;
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
        const _ephTypeLabel = it.paperType || r.label;
        return `<tr onclick="openEphemeraDetail('${r.tabId}',${it.row})" style="cursor:pointer">
          <td>
            <div style="font-size:0.88rem;color:var(--text);font-weight:600;line-height:1.3">${it.title || it.itemNum || '—'}</div>
            <div style="font-family:var(--font-mono);font-size:0.7rem;color:${r.color};opacity:0.8;margin-top:1px">${it.itemNum || ''}</div>
          </td>
          <td><span class="text-dim">—</span></td>
          <td style="text-align:center">
            <button onclick="event.stopPropagation();openEphemeraDetail('${r.tabId}',${it.row})" style="padding:0.25rem 0.6rem;border-radius:6px;border:1px solid ${r.color};background:${r.color}18;color:${r.color};font-family:var(--font-body);font-size:0.75rem;cursor:pointer;font-weight:600">Details</button>
          </td>
          <td><span class="tag" style="border-color:${r.color};color:${r.color};background:${r.color}18">${_ephTypeLabel}</span></td>
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
      const _ephTypeBadge = it.paperType || r.label;
      return `<tr onclick="openEphemeraDetail('${r.tabId}',${it.row})" style="cursor:pointer">
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
        ? `<div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:nowrap;font-size:0.68rem;color:var(--text-dim);padding:0.3rem 0.5rem;background:var(--surface2);border:1px solid var(--border);border-radius:7px;margin-bottom:0.5rem;overflow:hidden">
            <span style="font-weight:600;color:var(--text-mid);flex-shrink:0">Key:</span>
            <span style="flex-shrink:0">🔗 Grouped</span>
            <span style="flex-shrink:0">⚡ QE</span>
            <span style="flex-shrink:0">📷 Photo</span>
            <button onclick="event.stopPropagation();_prefSet('lv_show_coll_legend','false');renderBrowse()" style="margin-left:auto;flex-shrink:0;background:none;border:none;color:var(--text-dim);font-size:0.68rem;cursor:pointer;padding:0 0.2rem;text-decoration:underline">Hide</button>
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
    const pd = item._personalOnly ? item : findPD(_displayItemNum(item), item.variation);
    const isOwned = item._personalOnly ? true : (pd?.owned || false);
    const isWanted = !!state.wantData[`${item.itemNum}|${item.variation}`];
    const cond = pd?.condition ? parseInt(pd.condition) : null;
    const condClass = cond >= 9 ? 'cond-9' : cond >= 7 ? 'cond-7' : cond >= 5 ? 'cond-5' : cond ? 'cond-low' : '';
    let globalIdx = state.masterData.indexOf(item);
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
    const isForSale = !!state.forSaleData[`${_displayItemNum(item)}|${item.variation||''}`] || !!state.forSaleData[`${item.itemNum}|${item.variation||''}`];
    const _isUpgradeM = !!state.upgradeData[`${_displayItemNum(item)}|${item.variation||''}`] || !!state.upgradeData[`${item.itemNum}|${item.variation||''}`];
    const badgeClass = isOwned ? (isForSale ? 'forsale' : 'yes') : isWanted ? 'want' : 'no';
    const badgeText  = isOwned ? (isForSale ? '🏷️ For Sale' : (_isUpgradeM ? '↑ Upgrade' : '✓ Owned')) : isWanted ? '★ Want' : '—';
    const _mv = parseFloat(item.marketVal);
    const marketVal  = item.marketVal && !isNaN(_mv) ? '$' + _mv.toLocaleString() : '';

    if (isMobile) {
      const _escVar = (item.variation||'').replace(/'/g,"\\'");
      const _pdKey = findPDKey(_displayItemNum(item), item.variation);
      const _pdRow = pd && pd.row ? pd.row : 0;
      const _isQE = pd && pd.quickEntry;
      const _isGrouped = pd && pd.groupId;
      const _hasPhoto = pd && pd.photoItem;
      // Per-copy For Sale / Upgrade detection
      const _mDispNum = _displayItemNum(item);
      const _fsEntryM = state.forSaleData[`${_mDispNum}|${item.variation||''}`] || state.forSaleData[`${item.itemNum}|${item.variation||''}`];
      const _ugEntryM = state.upgradeData[`${_mDispNum}|${item.variation||''}`] || state.upgradeData[`${item.itemNum}|${item.variation||''}`];
      const _myInvIdM = pd && pd.inventoryId ? pd.inventoryId : '';
      const _isThisCopyFS = _fsEntryM && (_myInvIdM && _fsEntryM.inventoryId ? _fsEntryM.inventoryId === _myInvIdM : !_fsEntryM.inventoryId);
      const _isThisCopyUG = _ugEntryM && (_myInvIdM && _ugEntryM.inventoryId ? _ugEntryM.inventoryId === _myInvIdM : !_ugEntryM.inventoryId);
      const _statusIcons = (_isThisCopyFS ? '<span title="This copy is For Sale" style="font-size:0.8rem">🏷️</span>' : '')
                         + (_isThisCopyUG ? '<span title="This copy on Upgrade list" style="font-size:0.8rem;color:#8b5cf6">↑</span>' : '')
                         + (_isGrouped ? '<span title="Grouped item" style="font-size:0.8rem">🔗</span>' : '')
                         + (_isQE ? '<span title="Quick Entry — details incomplete" style="font-size:0.8rem">⚡</span>' : '')
                         + (_hasPhoto ? '<span title="Has photo" style="font-size:0.8rem" onclick="event.stopPropagation();openPhotoFolder(\''+item.itemNum+'\',\''+(_hasPhoto||'')+'\')">📷</span>' : '');
      const _shareKey = item.itemNum + '|' + (item.variation||'') + '|' + _pdRow;
      const _inShareMode = typeof isShareMode === 'function' && isShareMode('collection');
      const _isShareSelected = _inShareMode && window._shareItems && window._shareItems[_shareKey];
      if (_inShareMode) { if (!window._shareDataMap) window._shareDataMap = {}; window._shareDataMap[_shareKey] = { itemNum: item.itemNum, variation: item.variation||'', pd: pd, master: item }; }
      return `<div class="browse-card" id="share-card-${_shareKey}" onclick="${_inShareMode ? 'toggleShareItem(\'' + _shareKey + '\')' : 'showItemDetailPage(' + globalIdx + ')'}" style="cursor:pointer${_isShareSelected ? ';outline:2px solid #3a9e68;background:rgba(58,158,104,0.08)' : ''}">
        <div style="display:flex;align-items:center;gap:0.5rem;width:100%;min-width:0">
          ${_inShareMode ? '<input type="checkbox" id="share-cb-' + _shareKey + '" ' + (_isShareSelected ? 'checked' : '') + ' onclick="event.stopPropagation();toggleShareItem(\'' + _shareKey + '\')" style="width:1.1rem;height:1.1rem;accent-color:#3a9e68;flex-shrink:0">' : ''}
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:nowrap">
              <span class="browse-card-num" style="white-space:nowrap">${_displayItemNum(item)}${item.variation ? ' <span style="font-size:0.72rem;color:var(--text-dim)">' + item.variation + '</span>' : ''}</span>
              <span style="display:flex;gap:0.2rem;align-items:center">${_statusIcons}</span>
            </div>
            <div class="browse-card-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${item.roadName || item.itemType || '—'}</div>
            <div class="browse-card-sub" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${[item.itemType, item.yearProd].filter(Boolean).join(' · ')}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.25rem;flex-shrink:0">
            ${cond ? `<span style="font-size:0.72rem"><span class="condition-pip ${condClass}"></span>${cond}</span>` : ''}
            ${marketVal ? `<span class="market-val" style="font-size:0.72rem">${marketVal}</span>` : ''}
            ${!_inShareMode ? `<button onclick="event.stopPropagation();removeCollectionItem('${item.itemNum}','${_escVar}',${_pdRow})" style="padding:0.25rem 0.5rem;border-radius:6px;font-size:0.75rem;cursor:pointer;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body);line-height:1" title="Remove from collection">✕</button>` : ''}
          </div>
        </div>
      </div>`;
    } else if (state.filters.owned) {
      // ── My Collection view: Item # | Description | Actions (3 clean columns) ──
      const _isQuick = pd && pd.quickEntry;
      const _groupId = pd && pd.groupId ? pd.groupId : '';
      const _escVar = (item.variation||'').replace(/'/g,"\'");
      const _dispNum = _displayItemNum(item);
      const _descParts = [item.roadName, item.itemType].filter(Boolean);
      const _descFull  = _descParts.join(' · ') || item.description || '—';
      const _descShort = _descFull.length > 42 ? _descFull.substring(0, 40) + '…' : _descFull;
      const _varText   = item.variation ? ` <span style="font-size:0.72rem;color:var(--text-dim);background:var(--surface2);padding:1px 5px;border-radius:4px;margin-left:3px">${item.variation}</span>` : '';
      const _typeText = item.itemType || '<span style="color:var(--text-dim)">—</span>';
      const _estWorth = pd && pd.userEstWorth ? '$' + parseFloat(pd.userEstWorth).toLocaleString() : '<span style="color:var(--text-dim)">—</span>';
      // Per-copy For Sale / Upgrade detection using inventoryId
      const _fsEntry = state.forSaleData[`${_dispNum}|${item.variation||''}`] || state.forSaleData[`${item.itemNum}|${item.variation||''}`];
      const _ugEntry = state.upgradeData[`${_dispNum}|${item.variation||''}`] || state.upgradeData[`${item.itemNum}|${item.variation||''}`];
      const _myInvId = pd && pd.inventoryId ? pd.inventoryId : '';
      // This specific copy is for sale if: (a) inventoryId matches, or (b) legacy entry without inventoryId
      const _isThisCopyFS = _fsEntry && (_myInvId && _fsEntry.inventoryId ? _fsEntry.inventoryId === _myInvId : !_fsEntry.inventoryId);
      const _isThisCopyUG = _ugEntry && (_myInvId && _ugEntry.inventoryId ? _ugEntry.inventoryId === _myInvId : !_ugEntry.inventoryId);
      const _isAnyFS = !!_fsEntry;
      const _isAnyUG = !!_ugEntry;
      // Count how many copies of this item exist in collection
      const _copyCount = Object.values(state.personalData).filter(p => p.itemNum === item.itemNum && (p.variation||'') === (item.variation||'') && p.owned).length;
      // Status icons — only show on the specific copy that's listed
      const _listIcons = (_isThisCopyFS ? '<span title="This copy is For Sale" style="font-size:0.7rem;color:#e67e22;margin-left:4px;vertical-align:middle">🏷️</span>' : '')
        + (_isThisCopyUG ? '<span title="This copy is on Upgrade list" style="font-size:0.7rem;color:#8b5cf6;margin-left:4px;vertical-align:middle">↑</span>' : '');
      const _shareKeyD = item.itemNum + '|' + (item.variation||'') + '|' + (pd && pd.row ? pd.row : 0);
      const _inShareModeD = typeof isShareMode === 'function' && isShareMode('collection');
      const _isShareSelectedD = _inShareModeD && window._shareItems && window._shareItems[_shareKeyD];
      if (_inShareModeD) { if (!window._shareDataMap) window._shareDataMap = {}; window._shareDataMap[_shareKeyD] = { itemNum: item.itemNum, variation: item.variation||'', pd: pd, master: item }; }
      // Smart buttons based on per-copy list status
      const _fsBtn = _isThisCopyFS
        ? `<button onclick="event.stopPropagation();_removeForSaleFromCollection('${_dispNum}','${_escVar}')" style="padding:0.2rem 0.45rem;border-radius:5px;font-size:0.7rem;cursor:pointer;border:1px solid #e67e22;background:#e67e22;color:#fff;font-family:var(--font-body);font-weight:600;margin-right:0.2rem">Remove from For Sale</button>`
        : `<button onclick="event.stopPropagation();collectionActionForSale(${globalIdx},'${_dispNum}','${_escVar}',${pd && pd.row ? pd.row : 0})" style="padding:0.2rem 0.45rem;border-radius:5px;font-size:0.7rem;cursor:pointer;border:1px solid #e67e22;background:rgba(230,126,34,0.1);color:#e67e22;font-family:var(--font-body);font-weight:600;margin-right:0.2rem">Add to For Sale</button>`;
      const _upgBtn = _isThisCopyUG
        ? `<button onclick="event.stopPropagation();_removeUpgradeFromCollection('${_dispNum}','${_escVar}')" style="padding:0.2rem 0.45rem;border-radius:5px;font-size:0.7rem;cursor:pointer;border:1px solid #8b5cf6;background:#8b5cf6;color:#fff;font-family:var(--font-body);font-weight:600;margin-right:0.2rem">Remove from Upgrade</button>`
        : `<button onclick="event.stopPropagation();showAddToUpgradeModal('${_dispNum}','${_escVar}',${pd && pd.row ? pd.row : 0})" style="padding:0.2rem 0.45rem;border-radius:5px;font-size:0.7rem;cursor:pointer;border:1px solid #8b5cf6;background:rgba(139,92,246,0.1);color:#8b5cf6;font-family:var(--font-body);font-weight:600;margin-right:0.2rem">Add to Upgrade</button>`;
      return `<tr id="share-card-${_shareKeyD}" onclick="${_inShareModeD ? 'toggleShareItem(\'' + _shareKeyD + '\')' : 'showItemDetailPage(' + globalIdx + ')'}" style="cursor:pointer${_isQuick ? ';opacity:0.82' : ''}${_isShareSelectedD ? ';outline:2px solid #3a9e68;background:rgba(58,158,104,0.06)' : ''}" data-group="${_groupId}" data-item="${item.itemNum}">
        <td style="white-space:nowrap">
          ${_inShareModeD ? '<input type="checkbox" id="share-cb-' + _shareKeyD + '" ' + (_isShareSelectedD ? 'checked' : '') + ' onclick="event.stopPropagation();toggleShareItem(\'' + _shareKeyD + '\')" style="width:1rem;height:1rem;accent-color:#3a9e68;margin-right:5px;vertical-align:middle">' : ''}
          <span class="item-num">${_displayItemNum(item)}</span>
          ${_groupId ? '<span style="font-size:0.55rem;color:var(--accent3);margin-left:4px;vertical-align:super" title="Grouped">🔗</span>' : ''}
          ${_isQuick ? '<span onclick="event.stopPropagation();completeQuickEntry(\''+item.itemNum+'\',\''+_escVar+'\','+globalIdx+',\''+(pd.inventoryId||'')+'\')" style="margin-left:5px;font-size:0.72rem;background:#27ae60;color:#fff;border-radius:4px;padding:1px 5px;cursor:pointer;font-weight:700;vertical-align:middle" title="Complete this Quick Entry">⚡</span>' : ''}
          ${pd && pd.photoItem ? '<span style="margin-left:4px;font-size:0.78rem;vertical-align:middle;opacity:0.75" title="Has photo">📷</span>' : ''}
          ${_listIcons}
        </td>
        <td style="white-space:nowrap">${item.variation ? '<span style="font-size:0.78rem;color:var(--text-mid)">' + item.variation + '</span>' : '<span style="color:var(--text-dim)">—</span>'}</td>
        <td style="font-size:0.78rem;color:var(--text-dim)">${_typeText}</td>
        <td style="color:var(--text-mid);font-size:0.85rem">${_descShort}</td>
        <td style="font-size:0.82rem;color:var(--gold);white-space:nowrap">${_estWorth}</td>
        <td style="text-align:right;white-space:nowrap">
          ${!_inShareModeD ? `${_fsBtn}
          <button onclick="event.stopPropagation();collectionActionSold(${globalIdx},'${_dispNum}','${_escVar}',${pd && pd.row ? pd.row : 0})" style="padding:0.2rem 0.45rem;border-radius:5px;font-size:0.7rem;cursor:pointer;border:1px solid #2ecc71;background:rgba(46,204,113,0.1);color:#2ecc71;font-family:var(--font-body);font-weight:600;margin-right:0.2rem">Add to Sold</button>
          ${_upgBtn}
          <button onclick="event.stopPropagation();removeCollectionItem('${_dispNum}','${_escVar}',${pd && pd.row ? pd.row : 0})" style="padding:0.2rem 0.45rem;border-radius:5px;font-size:0.7rem;cursor:pointer;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body)">Remove</button>` : ''}
        </td>
      </tr>`;
    } else {
      const vdShort = item.varDesc ? (item.varDesc.length > 28 ? item.varDesc.substring(0,28)+'…' : item.varDesc) : '';
      const vdCell = vdShort
        ? `<span style="cursor:pointer;border-bottom:1px dashed var(--border);color:var(--text-mid)" onclick="event.stopPropagation();showVarDescPopup(${globalIdx})">${vdShort}</span>`
        : '<span class="text-dim">—</span>';
      const _isErrCar = pd && pd.isError === 'Yes';
      const _isQuick = pd && pd.quickEntry;
      const _eraBadgeHtml = (typeof eraBadgeHTML === 'function' && window.ERA_BADGES && window.ERA_BADGES.showInBrowse) ? eraBadgeHTML(item._tab) : '';
      return `<tr onclick="browseRowClick(event, ${globalIdx})" style="cursor:pointer${_isQuick ? ';opacity:0.78' : ''}" title="${_isErrCar ? '⚠ Error car: ' + (pd.errorDesc||'see notes') : _isQuick ? '⚡ Quick Entry — details not yet filled in' : ''}">
        <td>
          <span class="item-num">${_displayItemNum(item)}${_isErrCar ? '<sup style="color:var(--accent);font-size:0.65rem">*</sup>' : ''}${_isQuick ? '<span onclick="event.stopPropagation();completeQuickEntry(\''+item.itemNum+'\',\''+((item.variation||'').replace(/\'/g,"\\\\'"))+'\','+globalIdx+',\''+(pd.inventoryId||'')+'\')" style="font-size:0.6rem;background:#27ae60;color:#fff;border-radius:3px;padding:1px 4px;vertical-align:middle;font-weight:600;cursor:pointer" title="Complete this Quick Entry">⚡</span>' : ''}</span>${_eraBadgeHtml}
          ${item.refLink ? `<a href="${item.refLink}" target="_blank" rel="noopener" onclick="event.stopPropagation()" title="View on COTT" style="margin-left:5px;vertical-align:middle;color:var(--text-dim);opacity:0.6;text-decoration:none;display:inline-flex" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>` : ''}
          <span id="cam-${item.itemNum}-${item.variation||''}" style="margin-left:5px;font-size:0.85rem;cursor:pointer;display:none" onclick="event.stopPropagation();openPhotoFolder('${item.itemNum}','${pd&&pd.photoItem?pd.photoItem:''}')" title="Open photo folder">📷</span>
        </td>
        <td><span class="tag">${item.itemType || '—'}</span></td>
        ${(_currentEra === 'atlas') ? `
        <td>${item.subType || '<span class="text-dim">—</span>'}</td>
        <td>${item.description || '<span class="text-dim">—</span>'}</td>
        <td>${item.trackPower || '<span class="text-dim">—</span>'}</td>
        <td class="text-dim">${item.msrp ? '$' + parseFloat(String(item.msrp).replace(/[^0-9.]/g,'')).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}) : '—'}</td>
        ` : `
        <td>${item.roadName || '<span class="text-dim">—</span>'}</td>
        <td>${item.description || '<span class="text-dim">—</span>'}</td>
        <td>${item.variation || '<span class="text-dim">—</span>'}</td>
        <td>${vdCell}</td>
        `}
        <td class="text-dim">${item.yearProd || '—'}</td>
        <td><span class="owned-badge ${badgeClass}">${badgeText}</span></td>
      </tr>`;
    }
  });

  const emptyHtml = isMobile
    ? '<div style="text-align:center;padding:3rem 1rem;color:var(--text-dim)"><div style="font-size:2.5rem;margin-bottom:0.5rem">🔍</div><p>No items match your filters</p></div>'
    : '<tr><td colspan="' + (state.filters.owned ? '7' : '8') + '"><div class="empty-state"><div class="empty-icon">🔍</div><p>No items match your filters</p><p style="font-size:0.8rem;color:var(--text-dim);margin-top:0.25rem">Try clearing some filters</p></div></td></tr>';

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
      const pd2 = item._personalOnly ? item : findPD(_displayItemNum(item), item.variation);
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
      const pd2 = item._personalOnly ? item : findPD(_displayItemNum(item), item.variation);
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
