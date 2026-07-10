// The Rail Roster — app-pages.js
// Extracted from app.js in Session 111 (Round 2 Chunk 14).
//
// Contents:
//   • Ephemera page: buildEphemeraPage, switchEphTab, openEphemeraDetail,
//     ephemeraDelete, ephemeraForSale, ephemeraSold (+ _ephTabNames/_ephTabCols)
//   • Want page: buildWantPage, showVarDescPopup, showWantDesc, removeWantItem,
//     moveWantToCollection
//   • eBay search modal: wantFindOnEbay, _ebaySetType, _ebayDoSearch,
//     wantSearchOtherSites (+ _EPN_CAMPAIGN_ID/_EPN_PARAMS)
//   • Sold page: toggleSoldSummary, soldSortBy, buildSoldPage, clearPageSearch
//   • For Sale page: buildForSalePage, markForSaleAsSold,
//     _removeForSaleFromCollection, _removeUpgradeFromCollection,
//     removeForSaleItem, _removeForSaleFromDetail, removeForSaleAndCollection
//   • Sets page: buildSetsPage, addSetToCollection, addSetToWantList, showSetDetail
//   • Disclaimer banner: _dismissDisclaimer, _applyDisclaimerPref
//   • Contact modal: _buildContactModal, showContactModal
//   • Upgrade page: buildUpgradePage, _toggleUpgradePhoto, _upgradeViewMine,
//     showAddToUpgradeModal, saveUpgradeItem, removeUpgradeItem, upgradeGotIt,
//     _upgradeGotItFinish
//
// Page router (showPage) stays in app.js — core navigation infrastructure.
//
// Depends on globals defined in app.js / other helper files: state, SHEET_TABS,
// _prefGet/_prefSet, ADMIN_EMAIL, _cachePersonalData, buildDashboard,
// renderBrowse, sheetsGet/sheetsAppend/sheetsUpdate/sheetsDeleteRow,
// findMaster, partner-map helpers, and many more.

// ═══════════════════════════════════════════════════════════════════
// Session 115: Unified My Collection page
//
// Replaces the old "Browse page with owned=true filter" hack. Single
// page, single sidebar entry, one tabbed view that covers every kind
// of thing you own: Lionel items, outfit sets, catalogs, paper items,
// instruction sheets, science sets, construction sets, plus anything
// user-added via custom ephemera tabs or mock-ups.
//
// Default tab: "All" (everything, sorted by most-recent add).
// Per-type tabs render only that slice; counts on tab labels.
// Actions per row are intentionally scoped down for this pass — click
// a Lionel item opens its detail page (existing UX), other types show
// a compact summary only. List-for-sale / record-sale / upgrade flows
// remain exactly as they are; only the view is unified here.
//
// Page: index.html <div id="page-collection">
// Entry: showPage('collection') — wired in app.js
// ═══════════════════════════════════════════════════════════════════

// Tab registry — id must match the normalized `type` set by
// _collectAllOwnedItems() so per-tab filtering is a one-liner.
const _COLLECTION_TABS = [
  { id: 'all',          label: 'All',           emoji: '📋' },
  { id: 'items',        label: 'Items',         emoji: '🚂' },
  { id: 'sets',         label: 'Sets',          emoji: '🎁' },
  { id: 'catalogs',     label: 'Catalogs',      emoji: '📒' },
  { id: 'paper',        label: 'Paper',         emoji: '📄' },
  { id: 'is',           label: 'IS',            emoji: '📘' },
  { id: 'science',      label: 'Science',       emoji: '🔬' },
  { id: 'construction', label: 'Construction',  emoji: '🔧' },
  { id: 'other',        label: 'Other',         emoji: '📦' },
];

// Walk every data bucket and produce a flat, normalized list of owned
// items. Each record: { type, key, title, subtitle, extras, date,
// _savedAt, source, openFn }. The Collection page renders these
// directly; the tab filter + search operate on them.

// Phase 3: forSale + upgrade caches are keyed by inventoryId only.
// These helpers stay so any straggling callers compile, but they're just
// a direct delete now.
// Audit NEW #6: convert any date-shaped value to a sortable numeric. Handles
// Excel serial numbers (returned raw by Phase 3i UNFORMATTED_VALUE), ISO date
// strings, and US date strings.
function _dateForSort(v) {
  if (v === null || v === undefined || v === '') return 0;
  var s = String(v).trim();
  if (/^\d{4,5}(\.\d+)?$/.test(s)) {
    var n = parseFloat(s);
    if (n > 25000 && n < 80000) return n;
  }
  var d = new Date(s);
  return isNaN(d.getTime()) ? 0 : d.getTime() / 86400000;
}

function _fsCacheRemove(fsKey) { delete state.forSaleData[fsKey]; }
function _ugCacheRemove(ugKey) { delete state.upgradeData[ugKey]; }
// Phase 3: helper for the For Sale list — derive a stable storage key from
// the entry itself, NOT the (itemNum|variation) composite that collides on
// duplicate-owned items. Used inside list renderers + delete handlers.
function _fsEntryKey(fs) {
  return (fs && fs.inventoryId) ? fs.inventoryId : ('legacy-row-' + (fs && fs.row ? fs.row : 0));
}
function _ugEntryKey(ug) {
  return (ug && ug.inventoryId) ? ug.inventoryId : ('legacy-row-' + (ug && ug.row ? ug.row : 0));
}

function _collectAllOwnedItems() {
  const out = [];

  // ── Items (Lionel trains) ────────────────────────────────────────
  Object.entries(state.personalData || {}).forEach(function(entry) {
    const key = entry[0], pd = entry[1];
    if (!pd || !pd.owned) return;
    // Era filter: skip items not in the currently selected era
    if (typeof _isInCurrentEra === 'function' && !_isInCurrentEra(pd.itemNum)) return;
    // Skip -BOX standalone rows — they show under "Items" already
    // as part of their parent row via group ID; duplicating them in
    // the list would just clutter it.
    if (String(pd.itemNum || '').toUpperCase().endsWith('-BOX')) return;
    const master = typeof findMaster === 'function' ? findMaster(pd.itemNum, '', pd) : null;
    const road = pd.roadName || (master && master.roadName) || '';
    const desc = (master && (master.description || master.itemType)) || '';
    const extras = [];
    if (pd.condition) extras.push('Condition ' + pd.condition);
    if (pd.hasBox === 'Yes') extras.push('✓ Has box');
    if (pd.userEstWorth) extras.push(_currencySymbol() + parseFloat(pd.userEstWorth).toLocaleString());
    const idx = master && state.masterData ? state.masterData.indexOf(master) : -1;
    out.push({
      type:    'items',
      key:     'pd|' + key,
      title:   _composeItemNumHTML(pd.itemNum, pd.variation),
      subtitle: road || desc,
      extras:  extras.join(' · '),
      date:    pd.datePurchased || '',
      _savedAt: pd._savedAt || 0,
      openFn:  idx >= 0 ? "showItemDetailPage(" + idx + ")" : "goToMyCollection()",
    });
  });

  // ── Owned sets (My Sets tab) ─────────────────────────────────────
  Object.entries(state.mySetsData || {}).forEach(function(entry) {
    const key = entry[0], s = entry[1];
    if (!s) return;
    const extras = [];
    if (s.condition) extras.push('Condition ' + s.condition);
    if (s.hasSetBox === 'Yes') extras.push('✓ Has set box');
    if (s.estValue) extras.push(_currencySymbol() + parseFloat(s.estValue).toLocaleString());
    out.push({
      type:    'sets',
      key:     'set|' + key,
      title:   String(s.setNum || s.itemNum || ''),
      subtitle: s.setName || s.description || '',
      extras:  extras.join(' · '),
      date:    s.dateAcquired || s.datePurchased || '',
      _savedAt: s._savedAt || 0,
      openFn:  '',
    });
  });

  // ── Catalogs / Paper / Mockups / Other / user-defined ────────────
  // 'catalogs' and 'paper' map 1:1 to their own tabs.
  // 'mockups' + 'other' + any user-defined buckets fold into "Other".
  Object.entries(state.ephemeraData || {}).forEach(function(entry) {
    const tabId = entry[0], bucket = entry[1];
    Object.entries(bucket || {}).forEach(function(bEntry) {
      const key = bEntry[0], it = bEntry[1];
      if (!it) return;
      let type;
      if (tabId === 'catalogs') type = 'catalogs';
      else if (tabId === 'paper') type = 'paper';
      else type = 'other';  // mockups / other / user-defined
      const extras = [];
      if (it.year) extras.push(it.year);
      if (it.condition) extras.push('Cond ' + it.condition);
      if (it.estValue) extras.push(_currencySymbol() + parseFloat(it.estValue).toLocaleString());
      const subtitleParts = [];
      if (it.catType) subtitleParts.push(it.catType);
      else if (it.paperType) subtitleParts.push(it.paperType);
      if (it.description) subtitleParts.push(it.description);
      out.push({
        type:    type,
        key:     'eph|' + tabId + '|' + key,
        title:   it.title || it.itemNum || '(untitled)',
        subtitle: subtitleParts.join(' · '),
        extras:  extras.join(' · '),
        date:    it.dateAcquired || '',
        _savedAt: it._savedAt || 0,
        openFn:  '',
      });
    });
  });

  // ── Instruction Sheets ──────────────────────────────────────────
  Object.entries(state.isData || {}).forEach(function(entry) {
    const key = entry[0], is = entry[1];
    if (!is) return;
    const extras = [];
    if (is.year) extras.push(is.year);
    if (is.condition) extras.push('Cond ' + is.condition);
    if (is.estValue) extras.push(_currencySymbol() + parseFloat(is.estValue).toLocaleString());
    out.push({
      type:    'is',
      key:     'is|' + key,
      title:   'IS ' + (is.sheetNum || key),
      subtitle: is.linkedItem ? 'For item ' + is.linkedItem : '',
      extras:  extras.join(' · '),
      date:    is.dateAcquired || '',
      _savedAt: is._savedAt || 0,
      openFn:  '',
    });
  });

  // ── Science Sets ─────────────────────────────────────────────────
  Object.entries(state.scienceData || {}).forEach(function(entry) {
    const key = entry[0], s = entry[1];
    if (!s) return;
    const extras = [];
    if (s.condition) extras.push('Cond ' + s.condition);
    if (s.estValue) extras.push(_currencySymbol() + parseFloat(s.estValue).toLocaleString());
    out.push({
      type:    'science',
      key:     'sci|' + key,
      title:   String(s.itemNum || ''),
      subtitle: s.description || '',
      extras:  extras.join(' · '),
      date:    s.dateAcquired || '',
      _savedAt: s._savedAt || 0,
      openFn:  '',
    });
  });

  // ── Construction Sets ────────────────────────────────────────────
  Object.entries(state.constructionData || {}).forEach(function(entry) {
    const key = entry[0], s = entry[1];
    if (!s) return;
    const extras = [];
    if (s.condition) extras.push('Cond ' + s.condition);
    if (s.estValue) extras.push(_currencySymbol() + parseFloat(s.estValue).toLocaleString());
    out.push({
      type:    'construction',
      key:     'con|' + key,
      title:   String(s.itemNum || ''),
      subtitle: s.description || '',
      extras:  extras.join(' · '),
      date:    s.dateAcquired || '',
      _savedAt: s._savedAt || 0,
      openFn:  '',
    });
  });

  return out;
}

// Session 159: composite item-number display for the 5 list views.
// Renders "773 🔗 2426W" for engine+tender pairs (or any matched partner);
// just "773" for solo items. The variation number is dropped from list
// views — it lives in the detail page where there's room to show it
// labeled properly ("Variation 1 of 12").
function _composeItemNumHTML(itemNum, variation) {
  var num = String(itemNum || '');
  if (!num) return '';
  // Session 159 fix: use findPD (indexed lookup) not direct state.personalData[key].
  // Real storage keys differ from "itemNum|variation" — findPD maps via _pdIndex.
  var pd = (typeof findPD === 'function') ? findPD(num, variation) : null;
  var partner = pd && pd.matchedTo ? String(pd.matchedTo).trim() : '';
  // Fallback: if no explicit matchedTo but row has a groupId, find other group members
  if ((!partner || partner.toLowerCase() === 'none') && pd && pd.groupId) {
    var gid = pd.groupId;
    var partners = [];
    Object.values(state.personalData || {}).forEach(function(p) {
      if (p && p.groupId === gid && p.itemNum !== num) {
        partners.push(p.itemNum);
      }
    });
    if (partners.length > 0) partner = partners.join(' / ');
  }
  if (partner && partner.toLowerCase() !== 'none') {
    return num
      + ' <span style="opacity:0.55;font-size:0.82em;vertical-align:1px" title="Linked with ' + partner + '">🔗</span> '
      + partner;
  }
  return num;
}

// Partner item for a Want/Upgrade entry, for the want detail heading
// ("Wanted: 726 with a 2426W"). Checks the entry's [grp:] note marker
// first, then falls back to the owned copy's matchedTo / groupId.
function _wantPartner(itemNum, variation, entry) {
  // 1) Group marker: [grp:ID] is an internal group ID, NOT an item number.
  //    Resolve it to the OTHER want/upgrade entries sharing the same ID.
  if (entry && entry.notes) {
    var m = String(entry.notes).match(/^\[grp:([^\]]+)\]/);
    if (m && m[1]) {
      var gid = '[grp:' + m[1] + ']';
      var partners = [];
      [state.wantData, state.upgradeData].forEach(function(pool){
        Object.values(pool || {}).forEach(function(e){
          if (e && e.itemNum !== itemNum && e.notes && String(e.notes).indexOf(gid) === 0) {
            if (partners.indexOf(e.itemNum) === -1) partners.push(e.itemNum);
          }
        });
      });
      if (partners.length) return partners.join(' / ');
    }
  }
  // 2) Fall back to the owned copy's matchedTo / groupId (same as the list link).
  if (typeof findPD === 'function') {
    var pd = findPD(itemNum, variation);
    if (pd && pd.matchedTo && String(pd.matchedTo).toLowerCase() !== 'none') return String(pd.matchedTo).trim();
    if (pd && pd.groupId) {
      var ps = [];
      Object.values(state.personalData || {}).forEach(function(p){
        if (p && p.groupId === pd.groupId && p.itemNum !== itemNum) ps.push(p.itemNum);
      });
      if (ps.length) return ps.join(' / ');
    }
  }
  return '';
}

// Find the master row index for showItemDetailPage. Tolerant of trailing
// -P/-C/-T suffixes (set members) that don't have their own master row.
function _itemMasterIdx(itemNum, variation) {
  if (!state.masterData) return -1;
  var num = String(itemNum || '');
  var v = variation === undefined ? '' : String(variation || '');
  var idx = state.masterData.findIndex(function(m) {
    return m.itemNum === num && (m.variation === v || (!v && !m.variation));
  });
  if (idx >= 0) return idx;
  idx = state.masterData.findIndex(function(m) { return m.itemNum === num; });
  if (idx >= 0) return idx;
  var stripped = num.replace(/-[PCT]$/, '');
  if (stripped !== num) {
    idx = state.masterData.findIndex(function(m) { return m.itemNum === stripped; });
  }
  return idx;
}

// Open the catalog item-detail page for a Want/Upgrade row (Session 162+).
// Reuses showItemDetailPage; _itemMasterIdx tolerates -P/-C/-T set suffixes.
function _wantViewDetail(itemNum, variation) {
  var idx = _itemMasterIdx(itemNum, variation);
  if (idx >= 0 && typeof showItemDetailPage === 'function') {
    var _v = variation || '';
    var entry = null;
    var pools = [state.wantData, state.upgradeData];
    for (var pi = 0; pi < pools.length && !entry; pi++) {
      var pool = pools[pi] || {};
      var keys = Object.keys(pool);
      for (var ki = 0; ki < keys.length; ki++) {
        var e = pool[keys[ki]];
        if (e && e.itemNum === itemNum && (e.variation || '') === _v) { entry = e; break; }
      }
    }
    var partner = (typeof _wantPartner === 'function') ? _wantPartner(itemNum, variation, entry) : '';
    // Order engine-first: if the clicked item is a tender and the single
    // partner is not, lead with the partner (e.g. '726 with a 2426W').
    var _lead = itemNum, _second = partner;
    if (partner && partner.indexOf(' / ') === -1 && typeof isTender === 'function' && isTender(itemNum) && !isTender(partner)) {
      _lead = partner; _second = itemNum;
    }
    var heading = _lead + (_second ? ' with a ' + _second : '');
    window._detailReturn = 'want';
    showItemDetailPage(idx, null, { wantMode: true, wantEntry: entry, wantPartner: partner, wantHeading: heading });
  } else if (typeof showToast === 'function') {
    showToast('Item details not found in catalog');
  }
}

function _collectionRowHTML(it, emoji) {
  const extras = it.extras || '';
  const date = it.date ? '<span style="color:var(--text-dim);font-size:0.72rem;white-space:nowrap">' + _formatDate(it.date) + '</span>' : '';
  const onclick = it.openFn ? ('onclick="' + it.openFn.replace(/"/g, '&quot;') + '" style="cursor:pointer"') : '';
  return '<div ' + onclick + ' style="display:flex;align-items:center;gap:0.75rem;padding:0.7rem 0.9rem;border-bottom:1px solid var(--border);transition:background 0.12s" onmouseover="this.style.background=\'var(--surface2)\'" onmouseout="this.style.background=\'\'">'
    + '<span style="font-size:1.1rem;flex-shrink:0">' + emoji + '</span>'
    + '<div style="flex:1;min-width:0">'
    +   '<div style="display:flex;align-items:baseline;gap:0.6rem;min-width:0">'
    +     '<span style="font-family:var(--font-mono);font-weight:600;color:var(--accent);font-size:0.95rem">' + (it.title || '—') + '</span>'
    +     (it.subtitle ? '<span style="color:var(--text);font-size:0.82rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0">' + it.subtitle + '</span>' : '')
    +   '</div>'
    +   (extras ? '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.15rem">' + extras + '</div>' : '')
    + '</div>'
    + date
    + '</div>';
}

function buildCollectionPage() {
  const container = document.getElementById('page-collection');
  if (!container) return;

  const activeTab = state._collectionTab || 'all';
  const search = (state._collectionSearch || '').trim().toLowerCase();

  // Gather + filter + sort
  const all = _collectAllOwnedItems();
  const counts = { all: all.length };
  _COLLECTION_TABS.forEach(function(t) { if (t.id !== 'all') counts[t.id] = 0; });
  all.forEach(function(it) { counts[it.type] = (counts[it.type] || 0) + 1; });

  let filtered = all.filter(function(it) {
    if (activeTab !== 'all' && it.type !== activeTab) return false;
    if (search) {
      const hay = ((it.title || '') + ' ' + (it.subtitle || '') + ' ' + (it.extras || '')).toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  filtered.sort(function(a, b) {
    const sA = a._savedAt || 0, sB = b._savedAt || 0;
    if (sA !== sB) return sB - sA;
    if (a.date && b.date && a.date !== b.date) return b.date.localeCompare(a.date);
    return (a.title || '').localeCompare(b.title || '');
  });

  // Render
  const emojiByType = {};
  _COLLECTION_TABS.forEach(function(t) { emojiByType[t.id] = t.emoji; });

  const tabBarHTML = '<div style="display:flex;flex-wrap:wrap;gap:0.35rem;margin-bottom:1rem">'
    + _COLLECTION_TABS.map(function(t) {
        const isActive = t.id === activeTab;
        const n = counts[t.id] || 0;
        return '<button onclick="_collectionSetTab(\'' + t.id + '\')" style="'
          + 'padding:0.4rem 0.85rem;border-radius:7px;cursor:pointer;'
          + 'font-family:var(--font-body);font-size:0.82rem;font-weight:600;'
          + 'display:inline-flex;align-items:center;gap:0.4rem;'
          + 'border:1.5px solid ' + (isActive ? 'var(--accent)' : 'var(--border)') + ';'
          + 'background:' + (isActive ? 'rgba(232,64,28,0.15)' : 'var(--surface2)') + ';'
          + 'color:' + (isActive ? 'var(--accent)' : 'var(--text-mid)') + '">'
          + '<span>' + t.emoji + '</span>'
          + '<span>' + t.label + '</span>'
          + '<span style="font-size:0.72rem;color:var(--text-dim);font-weight:500">' + n + '</span>'
          + '</button>';
      }).join('')
    + '</div>';

  // Session 115 fix: the original list wrapper had `overflow:hidden`
  // (for rounded corners) which, combined with .page.active's
  // display:contents, swallowed mousewheel scroll events before they
  // could bubble to the scrollable .main container. Dropped the
  // hidden overflow; the rounded-corner artifact (the first row's
  // top border joining the wrapper's rounded corner) is cosmetic and
  // fine vs. a broken scroll.
  const listHTML = filtered.length > 0
    ? '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px">'
      + filtered.map(function(it) { return _collectionRowHTML(it, emojiByType[it.type] || '•'); }).join('')
      + '</div>'
    : '<div style="padding:2rem;text-align:center;color:var(--text-dim);font-size:0.9rem">'
      + (search ? 'No matches for "' + search.replace(/</g,'&lt;') + '"' : 'Nothing here yet. Add items from the Dashboard.')
      + '</div>';

  container.innerHTML =
      '<div class="page-title" style="display:flex;align-items:baseline;gap:0.75rem;flex-wrap:wrap;margin-bottom:0.5rem">'
    +   '<span>My Collection</span>'
    +   '<span style="font-family:var(--font-body);font-size:0.82rem;color:var(--text-dim);font-weight:400;text-transform:none;letter-spacing:0">'
    +     filtered.length.toLocaleString() + ' of ' + all.length.toLocaleString() + ' ' + (activeTab === 'all' ? 'items' : _COLLECTION_TABS.find(function(t){return t.id===activeTab;}).label.toLowerCase())
    +   '</span>'
    + '</div>'
    + '<div style="margin-bottom:0.75rem">'
    +   '<input type="search" placeholder="Search by title, item #, road name…" value="' + (state._collectionSearch || '').replace(/"/g,'&quot;') + '" '
    +     'oninput="_collectionSetSearch(this.value)" '
    +     'style="width:100%;box-sizing:border-box;background:var(--surface2);border:1px solid var(--border);border-radius:8px;'
    +     'padding:0.55rem 0.85rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none">'
    + '</div>'
    + tabBarHTML
    + listHTML;
}

function _collectionSetTab(tabId) {
  state._collectionTab = tabId;
  buildCollectionPage();
}

function _collectionSetSearch(val) {
  state._collectionSearch = val;
  // Debounce the rebuild a touch so typing doesn't restart the render on every keystroke
  clearTimeout(state._collectionSearchTimer);
  state._collectionSearchTimer = setTimeout(buildCollectionPage, 120);
}

window.buildCollectionPage  = buildCollectionPage;
window._collectionSetTab    = _collectionSetTab;
window._collectionSetSearch = _collectionSetSearch;

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
    const val = item.estValue ? _currencySymbol() + parseFloat(item.estValue).toLocaleString() : '';
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

// v0.9.796 (Brad's GM50 dwg): the detail modal's Edit button called
// openEphemeraEdit — which NEVER EXISTED (ReferenceError → crash banner).
// This is that missing editor: field list per tab layout, full-row rewrite
// that preserves untouched columns (photo link included).
function openEphemeraEdit(tabId, rowKey) {
  const entry = (state.ephemeraData[tabId] || {})[rowKey];
  if (!entry) return;
  const rowNum = parseInt(entry.row || rowKey, 10);
  if (!rowNum || rowNum > 100000) { showToast('Just-added item — reload the app once, then Edit works.', 4000, true); return; }
  const tabNames = { catalogs: 'Catalogs', paper: 'Paper Items', mockups: 'Mock-Ups', other: 'Other Lionel' };
  const _ut = (state.userDefinedTabs || []).find(t => t.id === tabId);
  const sheetName = tabNames[tabId] || (_ut && _ut.label) || null;
  if (!sheetName) return;
  const isCat = tabId === 'catalogs', isMock = tabId === 'mockups';
  if (!isCat && !entry.itemNum) { showToast('This is an older-format row — edit it in the Google Sheet for now.', 4500, true); return; }

  // [label, entryKey, type]
  const fields = isCat ? [
    ['Type', 'catType', 'text'], ['Year', 'year', 'text'], ['Has Envelope/Mailer', 'hasMailer', 'yesno'],
    ['Condition (1-10)', 'condition', 'number'], ['Price Paid ($)', 'pricePaid', 'number'],
    ['Est. Value ($)', 'estValue', 'number'], ['Date Acquired', 'dateAcquired', 'date'], ['Notes', 'notes', 'textarea'],
  ] : isMock ? [
    ['Title', 'title', 'text'], ['For Item #', 'itemNumRef', 'text'], ['Description', 'description', 'textarea'],
    ['Year', 'year', 'text'], ['Manufacturer', 'manufacturer', 'text'], ['Condition (1-10)', 'condition', 'number'],
    ['Production Status', 'productionStatus', 'text'], ['Material', 'material', 'text'], ['Dimensions', 'dimensions', 'text'],
    ['Provenance', 'provenance', 'textarea'], ['Price Paid ($)', 'pricePaid', 'number'], ['Est. Value ($)', 'estValue', 'number'],
    ['Notes', 'notes', 'textarea'], ['Date Acquired', 'dateAcquired', 'date'],
  ] : [
    ['Title', 'title', 'text'], ['Description', 'description', 'textarea'], ['Year', 'year', 'text'],
    ['Manufacturer', 'manufacturer', 'text'], ['Condition (1-10)', 'condition', 'number'], ['Quantity', 'quantity', 'number'],
    ['Price Paid ($)', 'pricePaid', 'number'], ['Est. Value ($)', 'estValue', 'number'], ['Type', 'paperType', 'text'],
    ['For Item #', 'itemNumRef', 'text'], ['Notes', 'notes', 'textarea'], ['Date Acquired', 'dateAcquired', 'date'],
  ];

  const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const inp = 'width:100%;box-sizing:border-box;padding:0.45rem 0.6rem;border-radius:7px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.85rem';
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.id = 'eph-edit-modal';
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  overlay.innerHTML = '<div class="modal" style="max-width:480px;max-height:90vh;overflow-y:auto;padding:1rem">'
    + '<div style="font-family:var(--font-head);font-size:1.05rem;color:var(--text);margin-bottom:0.6rem">Edit — ' + esc(entry.title || entry.itemNum || '') + '</div>'
    + fields.map(function (f, i) {
        const v = entry[f[1]] == null ? '' : String(entry[f[1]]);
        const lbl = '<div style="font-size:0.66rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-dim);margin:0.4rem 0 0.1rem">' + f[0] + '</div>';
        if (f[2] === 'textarea') return lbl + '<textarea id="ephe-f' + i + '" rows="2" style="' + inp + ';resize:vertical">' + esc(v) + '</textarea>';
        if (f[2] === 'yesno') return lbl + '<select id="ephe-f' + i + '" style="' + inp + '"><option' + (v !== 'Yes' ? ' selected' : '') + '>No</option><option' + (v === 'Yes' ? ' selected' : '') + '>Yes</option></select>';
        return lbl + '<input id="ephe-f' + i + '" type="' + (f[2] === 'number' ? 'number' : f[2] === 'date' ? 'date' : 'text') + '" value="' + esc(v) + '" style="' + inp + '">';
      }).join('')
    + '<div style="display:flex;gap:0.5rem;margin-top:0.8rem">'
    + '<button id="ephe-save" style="flex:2;padding:0.7rem;border-radius:9px;border:none;background:var(--accent);color:#fff;font-weight:800;cursor:pointer;font-family:var(--font-body)">✓ Save</button>'
    + '<button onclick="document.getElementById(\'eph-edit-modal\').remove()" style="flex:1;padding:0.7rem;border-radius:9px;border:1px solid var(--border);background:var(--surface2);color:var(--text-mid);cursor:pointer;font-family:var(--font-body)">Cancel</button>'
    + '</div></div>';
  document.body.appendChild(overlay);
  if (window.BackStack && BackStack.wire) BackStack.wire(overlay); // v0.9.805 TODO-012: device Back closes this pop-up

  overlay.querySelector('#ephe-save').onclick = async function () {
    this.textContent = 'Saving…'; this.disabled = true;
    fields.forEach(function (f, i) {
      const el = overlay.querySelector('#ephe-f' + i);
      if (el) entry[f[1]] = el.value.trim();
    });
    // Rebuild the FULL row in this tab's layout — untouched columns (photo
    // link, item id) come straight from the entry, so nothing is lost.
    const _s2 = v => (v == null ? '' : String(v));
    let row, endCol;
    if (isCat) {
      row = [_s2(entry.itemNum), _s2(entry.catType), _s2(entry.year), _s2(entry.hasMailer), _s2(entry.condition), _s2(entry.pricePaid), _s2(entry.estValue), _s2(entry.dateAcquired), _s2(entry.notes), _s2(entry.photoLink)];
      endCol = 'J';
    } else if (isMock) {
      row = [_s2(entry.itemNum), _s2(entry.title), _s2(entry.itemNumRef), _s2(entry.description), _s2(entry.year), _s2(entry.manufacturer), _s2(entry.condition), _s2(entry.productionStatus), _s2(entry.material), _s2(entry.dimensions), _s2(entry.provenance), _s2(entry.lionelVerified), _s2(entry.pricePaid), _s2(entry.estValue), _s2(entry.photoLink), _s2(entry.notes), _s2(entry.dateAcquired)];
      endCol = 'Q';
    } else {
      row = [_s2(entry.itemNum), _s2(entry.title), _s2(entry.description), _s2(entry.year), _s2(entry.manufacturer), _s2(entry.condition), _s2(entry.quantity || '1'), _s2(entry.pricePaid), _s2(entry.estValue), _s2(entry.photoLink), _s2(entry.notes), _s2(entry.dateAcquired), _s2(entry.paperType), _s2(entry.itemNumRef)];
      endCol = 'N';
    }
    try {
      await sheetsUpdate(state.personalSheetId, sheetName + '!A' + rowNum + ':' + endCol + rowNum, [row]);
      overlay.remove();
      // Refresh the reopened detail + list
      document.querySelectorAll('.modal-overlay').forEach(function (m) { if (m.id !== 'eph-edit-modal') m.remove(); });
      showToast('✓ Saved');
      if (typeof renderBrowse === 'function') renderBrowse();
    } catch (e) {
      console.warn('[ephemera edit]', e);
      showToast('Could not save — ' + (e && e.message ? e.message : 'try again'), 4500, true);
      this.textContent = '✓ Save'; this.disabled = false;
    }
  };
}
if (typeof window !== 'undefined') window.openEphemeraEdit = openEphemeraEdit;

// v0.9.797 (Brad): "no place to add a picture to this existing item" —
// paper/catalog/mock-up rows never had a photo button. Uploads to the same
// 'Ephemera Photos/<title>' folder the wizard uses, then writes the folder
// link into the row's photo column.
window.ephemeraAddPhotos = function (tabId, rowKey) {
  const entry = (state.ephemeraData[tabId] || {})[rowKey];
  if (!entry) return;
  const rowNum = parseInt(entry.row || rowKey, 10);
  if (!rowNum || rowNum > 100000) { showToast('Just-added item — reload the app once, then add photos.', 4000, true); return; }
  const tabNames = { catalogs: 'Catalogs', paper: 'Paper Items', mockups: 'Mock-Ups', other: 'Other Lionel' };
  const _ut = (state.userDefinedTabs || []).find(t => t.id === tabId);
  const sheetName = tabNames[tabId] || (_ut && _ut.label) || null;
  if (!sheetName) return;
  const photoCol = tabId === 'mockups' ? 'O' : 'J';
  let inp = document.getElementById('eph-photo-inp');
  if (inp) inp.remove();
  inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
  inp.id = 'eph-photo-inp'; inp.style.display = 'none';
  document.body.appendChild(inp);
  inp.onchange = async function () {
    const files = [].slice.call(inp.files || []);
    if (!files.length) return;
    showToast('Uploading ' + files.length + ' photo' + (files.length > 1 ? 's' : '') + '…', 3000);
    try {
      await driveEnsureSetup();
      if (!driveCache.ephPhotosId) driveCache.ephPhotosId = await driveFindOrCreateFolder('Ephemera Photos', driveCache.vaultId);
      const folderTitle = String(entry.title || entry.itemNum || 'untitled').substring(0, 60);
      const folderId = await driveFindOrCreateFolder(folderTitle, driveCache.ephPhotosId);
      for (let i = 0; i < files.length; i++) {
        const ext = (files[i].name.split('.').pop() || 'jpg');
        await driveUploadPhoto(files[i], folderTitle + ' photo-' + Date.now() + '-' + (i + 1) + '.' + ext, folderId);
      }
      const link = 'https://drive.google.com/drive/folders/' + folderId;
      await sheetsUpdate(state.personalSheetId, sheetName + '!' + photoCol + rowNum, [[link]]);
      entry.photoLink = link;
      showToast('✓ Photo' + (files.length > 1 ? 's' : '') + ' added');
      document.querySelectorAll('.modal-overlay').forEach(function (m) { m.remove(); });
      if (typeof renderBrowse === 'function') renderBrowse();
    } catch (e) {
      console.warn('[ephemera photos]', e);
      showToast('Photo upload failed — ' + (e && e.message ? e.message : 'try again'), 4500, true);
    }
  };
  inp.click();
};

function openEphemeraDetail(tabId, rowKey) {
  // v0.9.802 (Brad): paper/catalog/mock-up/other details open the SAME
  // full-page detail as train items (showNonItemDetailPage — header, action
  // toolbar, details card, photo grid). The quick modal below survives only
  // for custom user tabs that have no page config.
  if (typeof showNonItemDetailPage === 'function' && (window.NON_ITEM_DETAIL_CONFIG || {})[tabId]) {
    return showNonItemDetailPage(tabId, rowKey);
  }
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
    ['Est. Value',        item.estValue ? _currencySymbol() + parseFloat(item.estValue).toLocaleString() : '—'],
    ['Date Acquired',     _formatDate(item.dateAcquired) || '—'],
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
    ['Est. Value', item.estValue ? _currencySymbol() + parseFloat(item.estValue).toLocaleString() : '—'],
    ['Date Acquired', _formatDate(item.dateAcquired) || '—'],
    ['Notes', item.notes || '—'],
  ] : [
    ['Title', item.title],
    ['Description', item.description || '—'],
    ['Year', item.year || '—'],
    ['Manufacturer', item.manufacturer || 'Lionel'],
    ['Condition', item.condition ? item.condition + '/10' : '—'],
    ['Quantity', item.quantity || '1'],
    ['Est. Value', item.estValue ? _currencySymbol() + parseFloat(item.estValue).toLocaleString() : '—'],
    ['Date Acquired', _formatDate(item.dateAcquired) || '—'],
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
        <button onclick="ephemeraAddPhotos('${tabId}',${rowKey})" style="flex:1;padding:0.6rem;border-radius:8px;border:1.5px solid #3498db;color:#3498db;background:rgba(52,152,219,0.08);cursor:pointer;font-family:var(--font-body);font-weight:600">📷 Add Photos</button>
        <button onclick="ephemeraForSale('${tabId}',${rowKey});this.closest('.modal-overlay').remove()" style="flex:1;padding:0.6rem;border-radius:8px;border:1.5px solid #e67e22;color:#e67e22;background:rgba(230,126,34,0.1);cursor:pointer;font-family:var(--font-body);font-weight:600">🏷️ For Sale</button>
        <button onclick="ephemeraSold('${tabId}',${rowKey});this.closest('.modal-overlay').remove()" style="flex:1;padding:0.6rem;border-radius:8px;border:1.5px solid #2ecc71;color:#2ecc71;background:rgba(46,204,113,0.1);cursor:pointer;font-family:var(--font-body);font-weight:600">💰 Sold</button>
        <button onclick="ephemeraDelete('${tabId}',${rowKey});this.closest('.modal-overlay').remove()" style="padding:0.6rem 0.8rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);cursor:pointer;font-family:var(--font-body)" title="Delete">🗑</button>
        <button onclick="this.closest('.modal-overlay').remove()" style="padding:0.6rem 0.8rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);cursor:pointer;font-family:var(--font-body)">Close</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  if (window.BackStack && BackStack.wire) BackStack.wire(overlay); // v0.9.805 TODO-012: device Back closes this pop-up
}

// ── Ephemera Actions ─────────────────────────────────────────────

const _ephTabNames  = { catalogs:'Catalogs', paper:'Paper Items', mockups:'Mock-Ups', other:'Other Lionel' };
const _ephTabCols   = { catalogs:'J', paper:'N', mockups:'Q', other:'N' }; // Audit M3: previous widths left trailing cols alive on delete

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
          style="flex:2;padding:0.65rem;border-radius:8px;border:none;background:#e67e22;color:white;font-family:var(--font-body);font-weight:600;cursor:pointer">🏷️ List For Sale</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  if (window.BackStack && BackStack.wire) BackStack.wire(ov); // v0.9.805 TODO-012: device Back closes this pop-up

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
      ((typeof _brandOfItem === 'function' && _brandOfItem(item.itemNum)) || _getEraManufacturer()),       // manufacturer
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
  if (window.BackStack && BackStack.wire) BackStack.wire(ov); // v0.9.805 TODO-012: device Back closes this pop-up

  document.getElementById('eph-sold-save').onclick = async () => {
    const salePrice = document.getElementById('eph-sold-price').value;
    const dateSold  = document.getElementById('eph-sold-date').value;
    const removeIt  = document.getElementById('eph-rm-yes').checked;
    ov.remove();
    // Audit H4 fix: use _buildSoldRow helper for full 20-col schema.
    // The old 10-col write left cols K-T (allOriginal, hasBox, boxCond,
    // photoItem, photoBox, roadName, description, userEstWorth,
    // datePurchased, year) blank or zombie-filled from prior rows.
    const row = _buildSoldRow({
      itemNum: item.itemNum || label,
      variation: '',
      copy: '1',
      condition: item.condition || '',
      pricePaid: item.estValue || '',
      salePrice: salePrice,
      dateSold: dateSold,
      notes: title,
      inventoryId: '',
      manufacturer: ((typeof _brandOfItem === 'function' && _brandOfItem(item.itemNum)) || _getEraManufacturer()),
    });
    try {
      await sheetsAppend(state.personalSheetId, 'Sold!A:T', [row]);
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
  const _we = state._wantEra || '';          // Session 155: era filter
  const _ws = state._wantSort || 'priority';
  // Sync dropdowns with state
  const _wpEl = document.getElementById('want-priority-filter');
  if (_wpEl && _wpEl.value !== _wp) _wpEl.value = _wp;
  const _weEl = document.getElementById('want-era-filter');  // Session 155
  if (_weEl && _weEl.value !== _we) _weEl.value = _we;
  const _wtEl = document.getElementById('want-type-filter');
  if (_wtEl && _wtEl.value !== _wt) _wtEl.value = _wt;
  const _wsEl = document.getElementById('want-sort');
  if (_wsEl && _wsEl.value !== _ws) _wsEl.value = _ws;
  const totalCount = Object.keys(state.wantData).length;
  const entries = Object.values(state.wantData).filter(w => {
    // Era filter: skip if item not in current era
    if (typeof _isInCurrentEra === 'function' && !_isInCurrentEra(w.itemNum)) return false;
    // Session 155: user-selected era period filter (prewar / postwar / modern)
    if (_we && typeof _itemEraPeriod === 'function') {
      var _wMaster = (typeof findMaster === 'function') ? findMaster(w.itemNum, '', w) : null;
      if (!_wMaster) return false;
      if (_itemEraPeriod(_wMaster) !== _we) return false;
    }
    // Priority filter
    if (_wp && (w.priority || 'Medium') !== _wp) return false;
    // Type filter — lookup master to get item type
    if (_wt) {
      const _setMatch = _wt === 'Set' && state.setData && state.setData.find(s => s.setNum === w.itemNum);
      if (_wt === 'Set' && !_setMatch) return false;
      if (_wt !== 'Set') {
        const _master = findMaster(w.itemNum, '', w);
        if (!_master || (_master.itemType || '') !== _wt) return false;
      }
    }
    // Text search
    if (_wq) {
      const master = findMaster(w.itemNum, w.variation, w) || {};
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
  // v0.9.714 (Brad): grouped pairs (engine+tender, A+B units) fold to ONE row.
  const shownEntries = (typeof foldWantEntries === 'function') ? foldWantEntries(entries) : entries;
  // Count display
  const countEl = document.getElementById('want-count');
  if (countEl) {
    countEl.textContent = entries.length === totalCount
      ? (shownEntries.length + ' item' + (shownEntries.length !== 1 ? 's' : '') + (shownEntries.length !== entries.length ? ' · ' + entries.length + ' pieces (pairs grouped)' : ''))
      : 'Showing ' + shownEntries.length + ' of ' + totalCount;
  }
  // Keep nav count badge in sync
  // Updated for combined Wishlist nav badge.
  const countBadge = document.getElementById('nav-wishlist-count');
  if (countBadge) countBadge.textContent = ((typeof wishlistFoldedCount === 'function') ? wishlistFoldedCount() : (totalCount + Object.keys(state.upgradeData||{}).length)).toLocaleString();   // v0.9.722
  const cardsEl = document.getElementById('want-cards');
  const tableEl = document.getElementById('want-table');
  const tbody   = document.getElementById('want-tbody');
  const priorityColor = { High: 'var(--accent)', Medium: 'var(--accent2)', Low: 'var(--text-dim)' };

  if (shownEntries.length === 0) {
    const hasFilters = _wq || _wp || _wt || _we;
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
    cardsEl.innerHTML = shownEntries.map(w => {
      const master = findMaster(w.itemNum, w.variation, w);
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
      return `<div id="share-card-${_wShareKey}" style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:0.85rem 1rem${_wSelected ? ';outline:2px solid #2ecc71' : ''}">
        <div style="display:flex;align-items:center;gap:0.75rem;cursor:pointer" onclick="${_wInShare ? 'toggleShareItem(\'' + _wShareKey + '\')' : `_wantViewDetail('${w.itemNum}','${escVar}')`}">
          ${_wInShare ? '<input type="checkbox" id="share-cb-' + _wShareKey + '" ' + (_wSelected ? 'checked' : '') + ' onclick="event.stopPropagation();toggleShareItem(\'' + _wShareKey + '\')" style="width:1.1rem;height:1.1rem;accent-color:#2ecc71;flex-shrink:0">' : ''}
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:0.5rem">
              <span style="font-family:var(--font-head);font-size:1.1rem;color:var(--accent)">${w.itemNum}</span>
              ${w._wantMates ? `<span style="font-size:0.72rem;color:#9ecbff">🔗 ${w._wantMates.join(' + ')}</span> <span style="font-size:0.6rem;font-weight:700;color:var(--accent3,#2ecc71);border:1px solid var(--accent3,#2ecc71);border-radius:4px;padding:0.05rem 0.3rem;vertical-align:middle">${w._groupCfg || 'Set'}</span>` : ''}
              ${_mIsSet ? '<span style="font-size:0.62rem;color:#e67e22;font-weight:600">SET</span>' : (w.variation ? `<span style="font-size:0.72rem;color:var(--text-dim)">${w.variation}</span>` : '')}
              <span style="font-size:0.65rem;font-weight:600;color:${pColor};border:1px solid ${pColor};border-radius:4px;padding:0.1rem 0.4rem">${w.priority || 'Medium'}</span>
            </div>
            ${_mIsSet ? (_mSetLabel ? `<div style="font-size:0.82rem;color:var(--text);margin-top:0.15rem">${_mSetLabel}</div>` : '') + _mChipsHtml : (name ? `<div style="font-size:0.82rem;color:var(--text);margin-top:0.15rem">${name}</div>` : '')}
            ${w.notes ? `<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.15rem">${w.notes}</div>` : ''}
          </div>
          <div style="text-align:right;flex-shrink:0">
            ${(w._pairPrice || w.expectedPrice) ? `<div style="font-family:var(--font-mono);color:var(--accent2);font-size:0.9rem">$${parseFloat(w._pairPrice || w.expectedPrice).toLocaleString()}${w._pairPrice ? '<span style="font-size:0.62rem;color:var(--text-dim)"> pair</span>' : ''}</div>` : ''}
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
    tbody.innerHTML = shownEntries.map((w, idx) => {
      const master = findMaster(w.itemNum, w.variation, w);
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

      const refLink = master ? ((typeof window.cottAnchorUrl==='function') ? window.cottAnchorUrl(master.refLink || '', w.itemNum) : (master.refLink || '')) : '';
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
      return `<tr id="share-card-${_wDShareKey}" ${_wDInShare ? 'onclick="toggleShareItem(\'' + _wDShareKey + '\')"' : ''} style="cursor:${_wDInShare ? 'pointer' : 'default'}${_wDSelected ? ';outline:2px solid #2ecc71;background:rgba(46,204,113,0.06)' : ''}">
        <td ${!_wDInShare ? `onclick="_wantViewDetail('${w.itemNum}','${(w.variation||'').replace(/'/g,"\\'")}')" style="cursor:pointer"` : ''}><span class="item-num">${_wDInShare ? '<input type="checkbox" id="share-cb-' + _wDShareKey + '" ' + (_wDSelected ? 'checked' : '') + ' onclick="event.stopPropagation();toggleShareItem(\'' + _wDShareKey + '\')" style="width:1rem;height:1rem;accent-color:#2ecc71;margin-right:5px;vertical-align:middle">' : ''}${_composeItemNumHTML(w.itemNum, w.variation)}</span>${w._wantMates ? ' <span style="font-size:0.7rem;color:#9ecbff;vertical-align:middle">🔗 ' + w._wantMates.join(' + ') + '</span> <span style="font-size:0.6rem;font-weight:700;color:var(--accent3,#2ecc71);border:1px solid var(--accent3,#2ecc71);border-radius:4px;padding:0.05rem 0.3rem;vertical-align:middle">' + (w._groupCfg || 'Set') + '</span>' : ''}${_isSet ? ' <span style="font-size:0.62rem;color:#e67e22;font-weight:600;vertical-align:middle">SET</span>' : ''}</td>
        <td>${_displayRoad || '<span class="text-dim">—</span>'}</td>
        <td>${_isSet ? '<span class="text-dim">—</span>' : (w.variation || '<span class="text-dim">—</span>')}</td>
        <td>${varCell}</td>
        <td><span style="color:${pColor};font-weight:500">${w.priority || 'Medium'}</span></td>
        <td class="market-val">${(w._pairPrice || w.expectedPrice) ? _currencySymbol() + parseFloat(w._pairPrice || w.expectedPrice).toLocaleString() + (w._pairPrice ? ' <span style="font-size:0.65rem;color:var(--text-dim)">pair</span>' : '') : '<span class="text-dim">—</span>'}</td>
        <td style="white-space:nowrap">
          ${!_wDInShare ? `<button onclick="moveWantToCollection('${w.itemNum}','${(w.variation||'').replace(/'/g,"\\'")}')" style="padding:0.2rem 0.45rem;border-radius:5px;font-size:0.7rem;cursor:pointer;border:1px solid #2ecc71;background:rgba(46,204,113,0.12);color:#2ecc71;font-family:var(--font-body);margin-right:0.25rem" title="Add to My Collection">+ Collection</button>
          <button onclick="wantFindOnEbay('${w.itemNum}','${(roadName||'').replace(/'/g,"\\'")}')" style="padding:0.2rem 0.45rem;border-radius:5px;font-size:0.7rem;cursor:pointer;border:1px solid #e67e22;background:rgba(230,126,34,0.12);color:#e67e22;font-family:var(--font-body);margin-right:0.25rem" title="Search eBay">eBay</button>
          <button onclick="wantSearchOtherSites('${w.itemNum}','${(roadName||'').replace(/'/g,"\\'")}')" style="padding:0.2rem 0.45rem;border-radius:5px;font-size:0.7rem;cursor:pointer;border:1px solid #2980b9;background:rgba(41,128,185,0.12);color:#2980b9;font-family:var(--font-body);margin-right:0.25rem" title="Search other auction sites">Search</button>
          <button onclick="removeWantItem('${w.itemNum}','${(w.variation||'').replace(/'/g,"\\'")}',${w.row})" style="padding:0.2rem 0.45rem;border-radius:5px;font-size:0.7rem;cursor:pointer;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body)" title="Remove from Want List">Remove</button>` : ''}
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
  if (window.BackStack && BackStack.wire) BackStack.wire(overlay); // v0.9.805 TODO-012: device Back closes this pop-up
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
  if (window.BackStack && BackStack.wire) BackStack.wire(overlay); // v0.9.805 TODO-012: device Back closes this pop-up
}

// ── Want List Actions ──────────────────────────────────────────
async function removeWantItem(itemNum, variation, row) {
  if (!(await appConfirm('Remove this item from your Want List?', { danger: true, ok: 'Remove' }))) return;
  const key = `${itemNum}|${variation}`;
  if (row) {
    await sheetsUpdate(state.personalSheetId, `Want-Upgrade List!A${row}:I${row}`, [['','','','','','','','','']]);
  }
  delete state.wantData[key];
  _cachePersonalData();
  buildWantPage();
  if (typeof buildUpgradePage === 'function') buildUpgradePage();
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
    // Session 115 fix: `wizard` is declared `let` at the top of
    // wizard.js — a lexical global, NOT a property of window. The
    // previous `!window.wizard` guard always returned truthy, so this
    // callback exited early and the pre-fill / step-skip never ran,
    // leaving the user stuck on the itemCategory picker.
    if (typeof wizard === 'undefined' || !wizard) return;

    // Look up master row (prefer variation match; fall back to any variation)
    const master = findMaster(itemNum, variation);

    // Seed everything we know
    wizard.data._fromWantList = true;
    wizard.data._fromWantKey = `${itemNum}|${variation}`;
    wizard.data._rawItemNum = itemNum;
    wizard.data.itemNum = itemNum;
    if (variation) wizard.data.variation = variation;
    wizard.data.itemCategory = 'lionel';      // skips era picker
    // If this want item's companions are ALSO on the want list, set up the matching
    // grouping so the wizard adds the WHOLE group (its proven paired/set save).
    // Covers engine+tender, A+B-unit (AB), A+dummy (AA) and A+B+dummy (ABA).
    // Partners must be DISTINCT numbers also on the want list (so a single same-number
    // AA want entry isn't silently expanded — user can still pick AA in the wizard).
    var _wcN = function(x){ return (typeof normalizeItemNum === 'function') ? normalizeItemNum(x) : (x||'').toString().trim().toUpperCase(); };
    var _wcWantSet = {};
    Object.keys(state.wantData || {}).forEach(function(k){ _wcWantSet[_wcN(k.split('|')[0])] = true; });
    var _wcBase = (typeof baseItemNum === 'function') ? baseItemNum(itemNum) : itemNum;
    var _wcNN = _wcN(itemNum), _wcNB = _wcN(_wcBase);
    // Candidate partners derived the SAME way the wizard does: role tags (+T dummy,
    // +C B-unit) plus the companion table (Tender / B Unit / A Dummy).
    var _pTender = '', _pBunit = '', _pDummy = '';
    (state.masterData || []).forEach(function(m){
      if (!m.itemNum) return; var mi = _wcN(m.itemNum);
      if (m.unit === 'A' && m.poweredDummy === 'D' && !_pDummy && mi === _wcN(_wcBase + 'T')) _pDummy = m.itemNum;
      if (m.unit === 'B' && m.poweredDummy === 'C' && !_pBunit && mi === _wcN(_wcBase + 'C')) _pBunit = m.itemNum;
    });
    (state.companionData || []).forEach(function(c){
      var _en = _wcN(c.engineNum); if (_en !== _wcNN && _en !== _wcNB) return;
      var _cn = String(c.companionNum || ''); if (_wcN(_cn) === _wcNN) return;   // skip same-number self-pairs
      var _t = (c.companionType || '').toLowerCase();
      if (/tender/.test(_t)) { if (!_pTender) _pTender = _cn; }
      else if (/b\s*-?\s*unit/.test(_t)) { if (!_pBunit) _pBunit = _cn; }
      else if (/a\s*dummy/.test(_t)) { if (!_pDummy) _pDummy = _cn; }
    });
    // Only pair partners that are ALSO on the want list, so we add the whole wanted group.
    var _wcTender = _wcWantSet[_wcN(_pTender)] ? _pTender : '';
    var _wcBunit  = _wcWantSet[_wcN(_pBunit)]  ? _pBunit  : '';
    var _wcDummy  = _wcWantSet[_wcN(_pDummy)]  ? _pDummy  : '';
    var _wcNewSetId = function(){ return (typeof genSetId === 'function') ? genSetId(itemNum) : ('set-' + Date.now()); };
    if (_wcTender) {
      // Engine + Tender pair
      wizard.data._itemGrouping = 'engine_tender';
      wizard.data.tenderMatch   = _wcTender;
    } else if (_wcBunit && _wcDummy) {
      // A powered + B unit + A dummy (ABA set)
      wizard.data._itemGrouping = 'aba';
      wizard.data.unitPower     = 'Powered';
      wizard.data.setMatch      = 'set-now';
      wizard.data.setType       = 'ABA';
      wizard.data._setId        = _wcNewSetId();
      wizard.data.unit2ItemNum  = _wcBunit;
      wizard.data.unit3ItemNum  = _wcDummy;
      wizard.data.unit3Power    = 'Dummy';
      wizard.data.tenderMatch   = '';
    } else if (_wcBunit) {
      // A powered + B unit (AB set)
      wizard.data._itemGrouping = 'ab';
      wizard.data.unitPower     = 'Powered';
      wizard.data.setMatch      = 'set-now';
      wizard.data.setType       = 'AB';
      wizard.data._setId        = _wcNewSetId();
      wizard.data.unit2ItemNum  = _wcBunit;
      wizard.data.tenderMatch   = '';
    } else if (_wcDummy) {
      // A powered + A dummy (AA set)
      wizard.data._itemGrouping = 'aa';
      wizard.data.unitPower     = 'Powered';
      wizard.data.setMatch      = 'set-now';
      wizard.data.setType       = 'AA';
      wizard.data._setId        = _wcNewSetId();
      wizard.data.unit2ItemNum  = _wcDummy;
      wizard.data.unit2Power    = 'Dummy';
      wizard.data.tenderMatch   = '';
    } else {
      wizard.data._itemGrouping = wizard.data._itemGrouping || 'single'; // default; user can change later via Edit Group
    }
    wizard.data.entryMode = wizard.data.entryMode || 'full'; // skips entryMode picker
    // Pre-fill suggested condition + price from want entry's target hints
    const _w = (state.wantData || {})[`${itemNum}|${variation}`] || {};
    if (_w.targetCondition) wizard.data._prefilledCondition = _w.targetCondition;
    if (_w.expectedPrice) wizard.data._suggestedPricePaid = _w.expectedPrice;

    if (master) {
      wizard.matchedItem = master;
      // Session 132: era inference now uses eraForTab() (era-badges.js), which
      // auto-resolves via ERA_TABS — handles Atlas + all 5 MTH eras correctly.
      // Old code only matched 'mpc'/'modern'/'pre-war'/'prewar' substrings and
      // defaulted everything else to 'pw' (wrong for Atlas/MTH items).
      if (!wizard.data._era) {
        var _inferredEra = (typeof eraForTab === 'function') ? eraForTab(master._tab) : null;
        if (_inferredEra) {
          wizard.data._era = _inferredEra;
        } else {
          // Fallback to old substring matching if eraForTab unavailable
          var _tab = String(master._tab || '').toLowerCase();
          if (_tab.includes('mpc') || _tab.includes('modern')) wizard.data._era = 'mpc';
          else if (_tab.includes('pre-war') || _tab.includes('prewar')) wizard.data._era = 'prewar';
          else wizard.data._era = 'pw';
        }
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
  if (window.BackStack && BackStack.wire) BackStack.wire(_overlay); // v0.9.805 TODO-012: device Back closes this pop-up
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

  // Enrich with master data (with era filter)
  let soldEntries = Object.values(state.soldData)
    .filter(sd => typeof _isInCurrentEra !== 'function' || _isInCurrentEra(sd.itemNum))
    .map(sd => {
      const master = findMaster(sd.itemNum, sd.variation, sd) || {};
      return { ...sd, _type: master.itemType || '', _roadName: sd.roadName || master.roadName || '', _master: master, _mfr: (typeof _manufacturerOfItem==='function' ? (_manufacturerOfItem(master.itemNum?master:sd)||'') : '') };
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
      // Audit NEW #6 fix: after Phase 3i, dates may be Excel serial numbers
      // coerced to strings like "45123". Lexicographic compare ("45123" < "2025")
      // sorts wrong. Coerce to numeric serial via _parseDateValue helper.
      va = _dateForSort(a.dateSold); vb = _dateForSort(b.dateSold);
    } else if (sf === 'mfr') {
      va = (a._mfr || '').toLowerCase(); vb = (b._mfr || '').toLowerCase();
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
  ['mfr','itemNum','type','roadName','condition','salePrice','dateSold'].forEach(function(col) {
    var el = document.getElementById('sold-sort-i-' + col);
    if (el) el.textContent = sf === col ? (state._soldSortDir === 'asc' ? '▲' : '▼') : '';
  });

  // Sync dropdown
  var sortSel = document.getElementById('sold-sort-field');
  if (sortSel) sortSel.value = sf;

  // v0.9.723 (Brad): grouped pairs sold together = ONE row, ONE price.
  if (typeof foldSoldEntries === 'function') soldEntries = foldSoldEntries(soldEntries);
  // Summary stats
  const totalRevenue = soldEntries.reduce((sum, sd) => sum + (parseFloat(sd._pairPrice || sd.salePrice) || 0), 0);
  const countEl = document.getElementById('sold-stat-count');
  const totalEl = document.getElementById('sold-stat-total');
  if (countEl) countEl.textContent = soldEntries.length.toLocaleString();
  if (totalEl) totalEl.textContent = totalRevenue > 0 ? _currencySymbol() + Math.round(totalRevenue).toLocaleString() : '$0';
  // Brad (Session 161+): write the inline title-row stats too.
  var _stEl = document.getElementById('sold-title-stats');
  if (_stEl) {
    var _stRev = totalRevenue > 0 ? _currencySymbol() + Math.round(totalRevenue).toLocaleString() : (_currencySymbol() + '0');
    _stEl.textContent = '· ' + soldEntries.length.toLocaleString() + ' sold · ' + _stRev + ' revenue';
  }

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
      return `<div onclick="showSoldDetailPage('${sd.key}')" style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:0.85rem 1rem;cursor:pointer">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <span style="font-family:var(--font-head);font-size:1.1rem;color:var(--accent)">${sd.itemNum || '—'}</span>
            ${sd._wantMates ? `<span style="font-size:0.72rem;color:#9ecbff">🔗 ${sd._wantMates.join(' + ')}</span> <span style="font-size:0.6rem;font-weight:700;color:var(--accent3,#2ecc71);border:1px solid var(--accent3,#2ecc71);border-radius:4px;padding:0.05rem 0.3rem;vertical-align:middle">${sd._groupCfg || 'Set'}</span>` : ''}
            ${sd.variation ? `<span style="font-size:0.72rem;color:var(--text-dim);margin-left:0.4rem">${sd.variation}</span>` : ''}
            ${sd._roadName ? `<div style="font-size:0.82rem;color:var(--text);margin-top:0.1rem">${sd._roadName}</div>` : ''}
            <div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.15rem">${[sd._type, sd.condition ? 'Cond: '+sd.condition : '', _formatDate(sd.dateSold)].filter(Boolean).join(' · ')}</div>
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
      return `<tr onclick="showSoldDetailPage('${sd.key}')" style="cursor:pointer">
        ${typeof _mfrBadge==='function' ? _mfrBadge({ manufacturer: sd.manufacturer || '' }) : '<td>—</td>'}
        <td><span class="item-num">${sd.itemNum || '—'}</span>${sd._wantMates ? ' <span style="font-size:0.7rem;color:#9ecbff">🔗 ' + sd._wantMates.join(' + ') + '</span> <span style="font-size:0.6rem;font-weight:700;color:var(--accent3,#2ecc71);border:1px solid var(--accent3,#2ecc71);border-radius:4px;padding:0.05rem 0.3rem">' + (sd._groupCfg || 'Set') + '</span>' : ''}</td>
        <td><span class="tag">${sd._type || '—'}</span></td>
        <td>${sd._roadName || '—'}</td>
        <td>${sd.variation || '—'}</td>
        <td>${sd.condition || '—'}</td>
        <td class="market-val">${(sd._pairPrice || sd.salePrice) ? _currencySymbol() + parseFloat(sd._pairPrice || sd.salePrice).toLocaleString() : '—'}</td>
        <td class="text-dim">${_formatDate(sd.dateSold) || '—'}</td>
      </tr>`;
    }).join('') : '<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">💰</div><p>No sold items yet</p></div></td></tr>';
  }

  var _ns = document.getElementById('nav-sold'); if (_ns) _ns.textContent = Object.keys(state.soldData).length;
}

// ── Sold-record detail view (Session 176) ──────────────────────────
// Each sale is its own self-contained record. Tap a row on the Sold list to
// see its snapshot details + photos here. Reuses the Drive photo loader.
function showSoldDetailPage(key) {
  var sd = (state.soldData || {})[key];
  if (!sd) { if (typeof showToast === 'function') showToast('Sale record not found', 3000, true); return; }
  var master = (state.masterData || []).find(function(i){ return i.itemNum === sd.itemNum && i.variation === (sd.variation || ''); }) || {};
  var roadName = sd.roadName || master.roadName || '';
  var desc = sd.description || master.description || '';
  var photoLink = sd.photoItem || sd.photoBox || '';
  var cur = (typeof _currencySymbol === 'function') ? _currencySymbol() : '$';
  var money = function(v){ if (v === '' || v == null) return null; var n = parseFloat(v); return isNaN(n) ? null : (cur + n.toLocaleString()); };
  var fmtDate = (typeof _formatDate === 'function') ? _formatDate : function(x){ return x; };
  if (typeof showPage === 'function') showPage('itemdetail');
  var container = document.getElementById('item-detail-content');
  if (!container) return;
  var titleNum = sd.itemNum ? ('No. ' + sd.itemNum) : (desc || 'Sold item');
  var keyArg = "'" + String(key).replace(/'/g, "\\'") + "'";

  var fields = [
    { label: 'Sale Price',     val: money(sd.salePrice) },
    { label: 'Date Sold',      val: sd.dateSold ? fmtDate(sd.dateSold) : null },
    { label: 'Price Paid',     val: money(sd.priceItem) },
    { label: 'Condition',      val: sd.condition ? (sd.condition + '/10') : null },
    { label: 'All Original',   val: (sd.allOriginal && sd.allOriginal !== 'Unknown') ? sd.allOriginal : null },
    { label: 'Had Box',        val: sd.hasBox === 'Yes' ? 'Yes' : (sd.hasBox === 'No' ? 'No' : null) },
    { label: 'Box Condition',  val: sd.boxCond ? (sd.boxCond + '/10') : null },
    { label: 'Road Name',      val: roadName || null },
    { label: 'Est. Worth',     val: money(sd.userEstWorth) },
    { label: 'Date Purchased', val: sd.datePurchased ? fmtDate(sd.datePurchased) : null },
    { label: 'Manufacturer',   val: sd.manufacturer || null },
    { label: 'Variation',      val: sd.variation || null },
  ].filter(function(f){ return f.val != null && f.val !== ''; });

  var html = ''
    + '<div style="margin-bottom:1.5rem">'
    +   '<button onclick="showPage(\'sold\');buildSoldPage()" style="background:none;border:none;color:#2980b9;font-family:var(--font-body);font-size:1.1rem;font-weight:700;cursor:pointer;padding:0;margin-bottom:0.75rem;display:flex;align-items:center;gap:0.4rem">'
    +     '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg> Back to Sold'
    +   '</button>'
    +   '<div style="display:flex;align-items:flex-start;gap:1rem;flex-wrap:wrap">'
    +     '<div style="flex:1;min-width:0">'
    +       '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;margin-bottom:0.25rem">'
    +         '<span style="font-family:var(--font-head);font-size:1.6rem;color:var(--accent);letter-spacing:0.03em">' + titleNum + '</span>'
    +         '<span class="tag">Sold</span>'
    +         (sd.dateSold ? '<span style="font-size:0.82rem;color:var(--text-dim)">' + fmtDate(sd.dateSold) + '</span>' : '')
    +       '</div>'
    +       ((roadName || desc) ? '<div style="font-size:1.05rem;color:var(--text);margin-bottom:0.2rem">' + (roadName || desc) + '</div>' : '')
    +     '</div>'
    +     '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.2rem;flex-shrink:0">'
    +       (sd.salePrice ? '<span style="font-family:var(--font-mono);color:#2ecc71;font-size:1.3rem;font-weight:700">' + cur + parseFloat(sd.salePrice).toLocaleString() + '</span>' : '')
    +       '<span style="font-size:0.72rem;color:var(--text-dim)">sold for</span>'
    +     '</div>'
    +   '</div>'
    + '</div>';

  html += '<div style="display:flex;gap:0.5rem;margin-bottom:1.5rem;flex-wrap:wrap">'
    +   '<button onclick="_removeSoldRecord(' + keyArg + ')" style="padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body);font-size:0.82rem;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:0.4rem">'
    +     '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg> Remove this sale record'
    +   '</button>'
    + '</div>';

  html += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:1.25rem;margin-bottom:1.5rem">'
    +   '<div style="font-family:var(--font-head);font-size:0.72rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--accent2);margin-bottom:0.75rem">Sale Details</div>';
  if (fields.length) {
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:0.6rem 1.5rem">'
      + fields.map(function(d){
          return '<div style="display:flex;justify-content:space-between;padding:0.35rem 0;border-bottom:1px solid var(--border)">'
            + '<span style="font-size:0.78rem;color:var(--text-dim);font-weight:600">' + d.label + '</span>'
            + '<span style="font-size:0.85rem;color:var(--text);text-align:right">' + d.val + '</span></div>';
        }).join('')
      + '</div>';
  } else {
    html += '<div style="color:var(--text-dim);font-size:0.85rem">No details recorded.</div>';
  }
  if (sd.notes) {
    html += '<div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border)">'
      + '<div style="font-size:0.78rem;color:var(--text-dim);font-weight:600;margin-bottom:0.3rem">Notes</div>'
      + '<div style="font-size:0.85rem;color:var(--text);line-height:1.6">' + sd.notes + '</div></div>';
  }
  html += '</div>';

  html += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:1.25rem">'
    +   '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem">'
    +     '<div style="font-family:var(--font-head);font-size:0.72rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--accent2)">Photos</div>'
    +     (photoLink ? '<a href="' + photoLink + '" target="_blank" rel="noopener" style="font-size:0.75rem;color:var(--accent2);text-decoration:none">Open Drive Folder &#8599;</a>' : '')
    +   '</div>'
    +   '<div id="sold-detail-photos" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:0.75rem;min-height:80px">'
    +     (photoLink
            ? '<div style="grid-column:1/-1;text-align:center;padding:1rem;color:var(--text-dim);font-size:0.82rem"><div class="spinner" style="margin:0 auto 0.5rem;width:20px;height:20px;border-width:2px"></div>Loading photos...</div>'
            : '<div style="grid-column:1/-1;text-align:center;padding:2rem 1rem;color:var(--text-dim)"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3" style="margin:0 auto 0.5rem;display:block"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg><div style="font-size:0.85rem">No photos saved with this sale</div></div>')
    +   '</div>'
    + '</div>';

  container.innerHTML = html;

  if (photoLink && typeof driveGetFolderPhotos === 'function') {
    driveGetFolderPhotos(photoLink).then(function(photos){
      var el = document.getElementById('sold-detail-photos');
      if (!el) return;
      if (!photos || !photos.length) { el.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:1.5rem;color:var(--text-dim);font-size:0.82rem">No photos in folder</div>'; return; }
      el.innerHTML = photos.map(function(p){
        return '<a href="' + p.view + '" target="_blank" rel="noopener" style="display:block;border-radius:8px;overflow:hidden;background:var(--surface2);aspect-ratio:1;position:relative">'
          + '<img id="sdp-' + p.id + '" style="width:100%;height:100%;object-fit:cover;border-radius:8px" alt="' + (p.name || 'Photo') + '"></a>';
      }).join('');
      photos.forEach(function(p){ var img = document.getElementById('sdp-' + p.id); if (img && typeof loadDriveThumb === 'function') loadDriveThumb(p.id, img, img.parentElement); });
    }).catch(function(e){ console.warn('Sold photo load:', e); var el = document.getElementById('sold-detail-photos'); if (el) el.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:1rem;color:var(--text-dim);font-size:0.82rem">Could not load photos</div>'; });
  }
}
window.showSoldDetailPage = showSoldDetailPage;

async function _removeSoldRecord(key) {
  var sd = (state.soldData || {})[key];
  if (!sd) { if (typeof showToast === 'function') showToast('Sale record not found', 3000, true); return; }
  var ok = (typeof appConfirm === 'function')
    ? await appConfirm('Remove this sale record? This deletes the saved sale (price, date, and photo snapshot) from your Sold history. It cannot be undone.', { danger: true, ok: 'Remove', title: 'Remove sale record' })
    : confirm('Remove this sale record?');
  if (!ok) return;
  try {
    if (sd.row && sd.row !== 99999) {
      await sheetsUpdate(state.personalSheetId, 'Sold!A' + sd.row + ':T' + sd.row, [Array(20).fill('')]);
    }
  } catch(e) { console.warn('[Sold] remove record:', e); }
  delete state.soldData[key];
  if (typeof _cachePersonalData === 'function') _cachePersonalData();
  if (typeof showToast === 'function') showToast('✓ Sale record removed');
  if (typeof showPage === 'function') showPage('sold');
  buildSoldPage();
  if (typeof buildDashboard === 'function') buildDashboard();
}
window._removeSoldRecord = _removeSoldRecord;

function clearPageSearch(name) {
  const map = { browse: 'browse-search', sold: 'sold-search', want: 'want-search' };
  const el = document.getElementById(map[name]);
  // Don't clear — keep search term when returning to same page
}

// ── For Sale list: sortable headers + catalog pairing (Session 162+) ──
var _FS_COLS = [
  { col: 'mfr', label: 'Mfr.' }, { col: 'num', label: 'Item #' },
  { col: 'type', label: 'Type' }, { col: 'road', label: 'Road Name' },
  { col: 'cond', label: 'Cond' }, { col: 'price', label: 'Asking Price' },
  { col: 'worth', label: 'Est. Worth' }, { col: 'listed', label: 'Listed' }
];
function _fsMaster(fs) { return findMaster(fs.itemNum, fs.variation, fs) || {}; }
function _fsSortVal(fs, col) {
  var m = _fsMaster(fs);
  if (col==='mfr') return (typeof _manufacturerOfItem==='function' ? (_manufacturerOfItem(m.itemNum?m:fs)||'') : '');
  if (col==='num') return parseInt(String(fs.itemNum||'').replace(/[^0-9]/g,''))||0;
  if (col==='type') return (m.itemType||'').toLowerCase();
  if (col==='road') return (m.roadName||'').toLowerCase();
  if (col==='cond') return parseFloat(fs.condition)||0;
  if (col==='price') return parseFloat(fs.askingPrice)||0;
  if (col==='worth') { var c=(fs.inventoryId && state.personalData[fs.inventoryId])||{}; return parseFloat(fs.estWorth||c.userEstWorth)||0; }
  if (col==='listed') return fs.dateListed||'';
  return '';
}
function _renderFsHeader() {
  var thead = document.querySelector('#page-forsale .item-table thead tr');
  if (!thead) return;
  var cs = state._fsSort || {};
  var html = _FS_COLS.map(function(c){
    var arrow = (cs.col===c.col)?(cs.dir==='desc'?' \u25BC':' \u25B2'):'';
    return '<th onclick="_fsSortBy(\''+c.col+'\')" style="cursor:pointer;white-space:nowrap" title="Sort by '+c.label+'">'+c.label+arrow+'</th>';
  }).join('');
  html += '<th style="white-space:nowrap">Actions</th>';
  thead.innerHTML = html;
}
function _fsSortBy(col) {
  var cs = state._fsSort;
  if (cs && cs.col===col) { cs.dir = (cs.dir==='asc')?'desc':'asc'; }
  else { state._fsSort = { col: col, dir: 'asc' }; }
  buildForSalePage();
}
function _fsEff(fs) {
  var pd = (fs && fs.inventoryId && typeof state!=='undefined' && state.personalData) ? state.personalData[fs.inventoryId] : null;
  if (pd && pd.itemNum) return { itemNum: pd.itemNum, variation: pd.variation || '' };
  return { itemNum: (fs ? fs.itemNum : '') || '', variation: (fs ? fs.variation : '') || '' };
}
function _fsItemNumHTML(fs) {
  var num = String(_fsEff(fs).itemNum||'');
  if (fs._mergedTender) return num + ' <span style="opacity:0.6;font-size:0.8em" title="Engine + tender (paired)">\uD83D\uDD17</span> <span style="font-size:0.85em;color:var(--text-mid)">' + fs._mergedTender + '</span>';
  return num;
}
if (typeof window!=='undefined'){ window._fsSortBy=_fsSortBy; window._renderFsHeader=_renderFsHeader; }

function buildForSalePage() {
  // Contextual hint for empty For Sale List
  if (typeof maybeShowContextualHint === 'function' && Object.keys(state.forSaleData || {}).length === 0) {
    var _fpcAnchor = document.getElementById('forsale-page') || document.querySelector('.page-forsale');
    if (_fpcAnchor) maybeShowContextualHint('forsale_empty', '<strong>For Sale List</strong> tracks items you\'re selling. From My Collection, click <em>Add to For Sale</em> on any item to list it.', _fpcAnchor);
  }
  const _fq = (state._forsaleSearch || '').toLowerCase();
  let fsEntries = Object.values(state.forSaleData).filter(fs => {
    // Grouped companions (box / instruction sheet) fold into their lead —
    // show and count the group as ONE item, like the collection list.
    if (typeof window !== 'undefined' && typeof window._fsIsGroupedCompanion === 'function' && window._fsIsGroupedCompanion(fs)) return false;
    // Era filter
    if (typeof _isInCurrentEra === 'function' && !_isInCurrentEra(fs.itemNum)) return false;
    if (!_fq) return true;
    const _fsx = _fsEff(fs); const master = findMaster(_fsx.itemNum, _fsx.variation) || {};
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
  if (totalEl) totalEl.textContent = totalAsking > 0 ? _currencySymbol() + Math.round(totalAsking).toLocaleString() : '$0';
  // Brad (Session 161+): write the inline title-row stats too.
  var _fsStEl = document.getElementById('forsale-title-stats');
  if (_fsStEl) {
    var _fsAsk = totalAsking > 0 ? _currencySymbol() + Math.round(totalAsking).toLocaleString() : (_currencySymbol() + '0');
    _fsStEl.textContent = '· ' + fsEntries.length.toLocaleString() + ' listed · ' + _fsAsk + ' asking';
  }

  // Sort by header selection
  if (state._fsSort && state._fsSort.col) {
    var _fc = state._fsSort.col, _fd = (state._fsSort.dir==='desc')?-1:1;
    var _fnum = (_fc==='num'||_fc==='cond'||_fc==='price'||_fc==='worth');
    fsEntries.sort(function(a,b){
      var va=_fsSortVal(a,_fc), vb=_fsSortVal(b,_fc), r;
      if (_fnum) r=va-vb; else r=String(va).localeCompare(String(vb),undefined,{numeric:true});
      if (r===0) r=(a.itemNum||'').localeCompare(b.itemNum||'',undefined,{numeric:true});
      return r*_fd;
    });
  }
  // Group engine + tender into one row (catalog pairing); stats above stay pre-merge.
  (function _fsGroupPairs(){
    var byNum={}; fsEntries.forEach(function(e){ if(!byNum[e.itemNum]) byNum[e.itemNum]=e; });
    var absorbed={};
    fsEntries.forEach(function(e){
      if (absorbed[e.itemNum]) return;
      if (typeof isLocomotive==='function' && isLocomotive(e.itemNum)) {
        var t=(typeof getMatchingTenders==='function')?(getMatchingTenders(e.itemNum)||[]):[];
        for (var i=0;i<t.length;i++){ var tn=t[i];
          if (tn&&tn!==e.itemNum&&byNum[tn]&&!absorbed[tn]){ e._mergedTender=tn; absorbed[tn]=true; break; } }
      }
    });
    if (Object.keys(absorbed).length) fsEntries=fsEntries.filter(function(e){ return !absorbed[e.itemNum]; });
  })();
  if (typeof _renderFsHeader==='function') _renderFsHeader();
  const isMobileFs = window.innerWidth <= 640;
  const fsCardsEl = document.getElementById('forsale-cards');
  const fsTableWrap = document.getElementById('forsale-table-wrap');
  const tbody = document.getElementById('forsale-tbody');

  if (isMobileFs) {
    if (fsCardsEl) fsCardsEl.style.display = 'flex';
    if (fsTableWrap) fsTableWrap.style.display = 'none';
    if (fsCardsEl) fsCardsEl.innerHTML = fsEntries.length ? fsEntries.map(fs => {
      const _fsx = _fsEff(fs); const master = findMaster(_fsx.itemNum, _fsx.variation) || {};
      const collPd = (fs.inventoryId && state.personalData[fs.inventoryId]) || {};
      const estWorth = fs.estWorth || collPd.userEstWorth || '';
      const _fsShareKey = fs.itemNum + '|' + (fs.variation||'') + '|' + (fs.row||0);
      const _fsInShare = typeof isShareMode === 'function' && isShareMode('forsale');
      const _fsSelected = _fsInShare && window._shareItems && window._shareItems[_fsShareKey];
      const _fsMasterIdx = (typeof _itemMasterIdx === 'function') ? _itemMasterIdx(fs.itemNum, fs.variation) : -1;
      if (_fsInShare) { if (!window._shareDataMap) window._shareDataMap = {}; window._shareDataMap[_fsShareKey] = { itemNum: fs.itemNum, variation: fs.variation||'', fs: fs, master: master }; }
      const _fsOpen = fs.inventoryId
        ? ('window._detailReturn=\'forsale\';_openOwnedByInvId(\'' + fs.inventoryId + '\')')
        : (_fsMasterIdx >= 0 ? ('window._detailReturn=\'forsale\';showItemDetailPage(' + _fsMasterIdx + ', \'\')') : '');
      const _fsCardClick = _fsInShare ? ('onclick="toggleShareItem(\'' + _fsShareKey + '\')"') : (_fsOpen ? ('onclick="' + _fsOpen + '"') : '');
      const _fsCardCursor = (_fsInShare || _fsOpen) ? 'pointer' : 'default';
      return `<div id="share-card-${_fsShareKey}" style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:0.85rem 1rem;cursor:${_fsCardCursor}${_fsSelected ? ';outline:2px solid #2ecc71' : ''}" ${_fsCardClick}>
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div style="display:flex;align-items:flex-start;gap:0.5rem">
            ${_fsInShare ? '<input type="checkbox" id="share-cb-' + _fsShareKey + '" ' + (_fsSelected ? 'checked' : '') + ' onclick="event.stopPropagation();toggleShareItem(\'' + _fsShareKey + '\')" style="width:1.1rem;height:1.1rem;accent-color:#2ecc71;flex-shrink:0;margin-top:0.2rem">' : ''}
            <div>
              <span style="font-family:var(--font-head);font-size:1.1rem;color:var(--accent)">${_fsItemNumHTML(fs)}</span>
              ${master.roadName ? `<div style="font-size:0.82rem;color:var(--text);margin-top:0.1rem">${master.roadName}</div>` : ''}
              <div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.15rem">${[master.itemType, fs.condition ? 'Cond: '+fs.condition : '', fs.dateListed ? 'Listed: '+_formatDate(fs.dateListed) : ''].filter(Boolean).join(' · ')}</div>
              ${estWorth ? `<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.1rem">Est. Worth: $${parseFloat(estWorth).toLocaleString()}</div>` : ''}
              ${fs.notes ? `<div style="font-size:0.72rem;color:var(--text-mid);margin-top:0.15rem;font-style:italic">${fs.notes.length > 60 ? fs.notes.substring(0,57)+'…' : fs.notes}</div>` : ''}
            </div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            ${fs.askingPrice ? `<div style="font-family:var(--font-mono);color:#e67e22;font-size:1.1rem;font-weight:600">$${parseFloat(fs.askingPrice).toLocaleString()}</div>` : '<div style="color:var(--text-dim);font-size:0.8rem">No price</div>'}
          </div>
        </div>
        ${!_fsInShare ? `<div style="display:flex;gap:0.4rem;margin-top:0.6rem;flex-wrap:wrap">
          <button onclick="event.stopPropagation();markForSaleAsSold('${_fsEntryKey(fs)}','${fs.askingPrice||''}')" style="flex:1;padding:0.4rem;border-radius:7px;font-size:0.78rem;cursor:pointer;border:1.5px solid #2ecc71;background:rgba(46,204,113,0.12);color:#2ecc71;font-family:var(--font-body);font-weight:600">Mark as Sold</button>
          <button onclick="event.stopPropagation();removeForSaleItem('${_fsEntryKey(fs)}')" style="flex:1;padding:0.4rem;border-radius:7px;font-size:0.78rem;cursor:pointer;border:1.5px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body)">Back to Collection</button>
          <button onclick="event.stopPropagation();removeForSaleAndCollection('${_fsEntryKey(fs)}')" style="flex:0 0 auto;padding:0.4rem 0.6rem;border-radius:7px;font-size:0.78rem;cursor:pointer;border:1.5px solid #e74c3c;background:rgba(231,76,60,0.10);color:#e74c3c;font-family:var(--font-body)">Remove</button>
        </div>` : ''}
      </div>`;
    }).join('') : '<div style="text-align:center;padding:3rem 1rem;color:var(--text-dim)"><div style="font-size:2.5rem;margin-bottom:0.5rem">🏷️</div><p>No items listed for sale</p></div>';
  } else {
    if (fsCardsEl) fsCardsEl.style.display = 'none';
    if (fsTableWrap) fsTableWrap.style.display = '';
    if (tbody) tbody.innerHTML = fsEntries.length ? fsEntries.map(fs => {
      const _fsx = _fsEff(fs); const master = findMaster(_fsx.itemNum, _fsx.variation) || {};
      const collPd = (fs.inventoryId && state.personalData[fs.inventoryId]) || {};
      const estWorth = fs.estWorth || collPd.userEstWorth || '';
      const _fsDShareKey = fs.itemNum + '|' + (fs.variation||'') + '|' + (fs.row||0);
      const _fsDInShare = typeof isShareMode === 'function' && isShareMode('forsale');
      const _fsDSelected = _fsDInShare && window._shareItems && window._shareItems[_fsDShareKey];
      if (_fsDInShare) { if (!window._shareDataMap) window._shareDataMap = {}; window._shareDataMap[_fsDShareKey] = { itemNum: fs.itemNum, variation: fs.variation||'', fs: fs, master: master }; }
      const _fsDMasterIdx = _itemMasterIdx(fs.itemNum, fs.variation);
      const _fsDOpen = fs.inventoryId
        ? `window._detailReturn='forsale';_openOwnedByInvId('${fs.inventoryId}')`
        : (_fsDMasterIdx >= 0 ? `window._detailReturn='forsale';showItemDetailPage(${_fsDMasterIdx}, '')` : '');
      const _fsDClickAttr = _fsDInShare
        ? `onclick="toggleShareItem('${_fsDShareKey}')"`
        : (_fsDOpen ? `onclick="${_fsDOpen}"` : '');
      return `<tr id="share-card-${_fsDShareKey}" ${_fsDClickAttr} style="cursor:${_fsDInShare || _fsDOpen ? 'pointer' : 'default'}${_fsDSelected ? ';outline:2px solid #2ecc71;background:rgba(46,204,113,0.06)' : ''}">
        ${typeof _mfrBadge==='function' ? _mfrBadge({ manufacturer: fs.manufacturer || '' }) : '<td>—</td>'}
        <td><span class="item-num">${_fsDInShare ? '<input type="checkbox" id="share-cb-' + _fsDShareKey + '" ' + (_fsDSelected ? 'checked' : '') + ' onclick="event.stopPropagation();toggleShareItem(\'' + _fsDShareKey + '\')" style="width:1rem;height:1rem;accent-color:#2ecc71;margin-right:5px;vertical-align:middle">' : ''}${_fsItemNumHTML(fs)}</span></td>
        <td><span class="tag">${master.itemType || '—'}</span></td>
        <td>${master.roadName || '—'}</td>
        <td>${fs.condition || '—'}</td>
        <td class="market-val" style="color:#e67e22">${fs.askingPrice ? _currencySymbol() + parseFloat(fs.askingPrice).toLocaleString() : '—'}</td>
        <td class="text-dim">${estWorth ? _currencySymbol() + parseFloat(estWorth).toLocaleString() : '—'}</td>
        <td class="text-dim">${_formatDate(fs.dateListed) || '—'}</td>
        <td style="white-space:normal">
          ${!_fsDInShare ? `<button onclick="event.stopPropagation();markForSaleAsSold('${_fsEntryKey(fs)}','${fs.askingPrice||''}')" style="padding:0.2rem 0.45rem;border-radius:5px;font-size:0.7rem;cursor:pointer;border:1px solid #2ecc71;background:rgba(46,204,113,0.12);color:#2ecc71;font-family:var(--font-body);margin-right:0.3rem" title="Mark as sold">Sold</button>
          <button onclick="event.stopPropagation();removeForSaleItem('${_fsEntryKey(fs)}')" style="padding:0.2rem 0.45rem;border-radius:5px;font-size:0.7rem;cursor:pointer;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body);margin-right:0.3rem" title="Take off sale, keep in collection">Unlist</button>
          <button onclick="event.stopPropagation();removeForSaleAndCollection('${_fsEntryKey(fs)}')" style="padding:0.2rem 0.45rem;border-radius:5px;font-size:0.7rem;cursor:pointer;border:1px solid #e74c3c;background:rgba(231,76,60,0.10);color:#e74c3c;font-family:var(--font-body)">Remove</button>` : ''}
        </td>
      </tr>`;
    }).join('') : '<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">🏷️</div><p>No items listed for sale</p></div></td></tr>';
  }

  const navBadge = document.getElementById('nav-forsale');
  if (navBadge) navBadge.textContent = fsEntries.length;
}

// Phase 3: signature is now (fsKey, askingPrice). fsKey is the entry's
// inventoryId (or 'legacy-row-N' fallback) — the same key used to store the
// entry in state.forSaleData. itemNum / variation are derived from the entry.

// ── Convert linked Upgrade entry to Want when its owned copy is sold ──
// When a user sells the copy that an Upgrade entry is targeting (linked by
// inventoryId), the upgrade should become a Want — user no longer owns it
// but still wants one in the desired condition. Updates the sheet row in
// place (changes List Type, clears Target Condition + Upgrading Inventory ID)
// and shuffles state.upgradeData -> state.wantData.
async function _convertUpgradeToWantOnSell(soldInventoryId) {
  if (!soldInventoryId) return;
  // Find any upgrade entry that pointed at this inventoryId
  var ugEntry = null;
  var ugKey = null;
  Object.keys(state.upgradeData || {}).forEach(function(k) {
    var e = state.upgradeData[k];
    if (e && String(e.inventoryId) === String(soldInventoryId)) {
      ugEntry = e; ugKey = k;
    }
  });
  if (!ugEntry || !ugEntry.row) return;
  // Build a Want-flavored 9-col row at the same row. List Type='Want', clear
  // Target Condition + Upgrading Inventory ID. Keep priority, target price
  // (becomes the want's expected price), notes, manufacturer.
  // Cols: A=Item, B=Var, C=List Type, D=Priority, E=Target Price,
  //       F=Target Condition, G=Upgrading Inventory ID, H=Notes, I=Manufacturer
  // Brad's preference: keep Target Condition when an Upgrade becomes a Want.
  // Only clear the Upgrading Inventory ID (since the user no longer owns the copy).
  var wuRow = [
    ugEntry.itemNum || '',
    ugEntry.variation || '',
    'Want',
    ugEntry.priority || 'Medium',
    ugEntry.maxPrice || '',  // expected price for Want
    ugEntry.targetCondition || '',  // PRESERVED — target condition stays
    '',                       // upgrading inventory id cleared
    ugEntry.notes || '',
    ugEntry.manufacturer || 'Lionel',
  ];
  try {
    await sheetsUpdate(state.personalSheetId,
      'Want-Upgrade List!A' + ugEntry.row + ':I' + ugEntry.row, [wuRow]);
    // Update state: remove from upgradeData, add to wantData
    delete state.upgradeData[ugKey];
    if (!state.wantData) state.wantData = {};
    var wantKey = (ugEntry.itemNum || '') + '|' + (ugEntry.variation || '');
    state.wantData[wantKey] = {
      row: ugEntry.row,
      itemNum: ugEntry.itemNum || '',
      variation: ugEntry.variation || '',
      priority: ugEntry.priority || 'Medium',
      expectedPrice: ugEntry.maxPrice || '',
      targetCondition: ugEntry.targetCondition || '',  // PRESERVED
      notes: ugEntry.notes || '',
      manufacturer: ugEntry.manufacturer || 'Lionel',
      listType: 'Want',
    };
    if (typeof showToast === 'function') {
      showToast('Upgrade entry moved to Want list', 2500);
    }
    if (typeof _cachePersonalData === 'function') _cachePersonalData();
  } catch (e) {
    console.warn('[Upgrade->Want convert] failed:', e && e.message);
  }
}
if (typeof window !== 'undefined') window._convertUpgradeToWantOnSell = _convertUpgradeToWantOnSell;

async function markForSaleAsSold(fsKey, askingPrice) {
  const fs = state.forSaleData[fsKey] || {};
  const itemNum = fs.itemNum || '';
  const variation = fs.variation || '';
  const salePrice = (typeof appPrompt === 'function')
    ? await appPrompt('Enter the price it sold for. Leave blank to use the asking price.', askingPrice || '',
        { title: 'Record sale', type: 'number', prefix: (typeof _currencySymbol === 'function' ? _currencySymbol() : '$'), ok: 'Mark sold' })
    : prompt('Sale price? (leave blank for asking price)', askingPrice || '');
  if (salePrice === null) return; // cancelled
  const dateSold = new Date().toISOString().split('T')[0];
  // Capture group members BEFORE the lead is deleted (we need its groupId link).
  const _grpMembers = (typeof window !== 'undefined' && typeof window._fsGroupMembers === 'function') ? window._fsGroupMembers(fs) : null;

  // Session 176: resolve the owned collection entry FIRST so the sale can
  // snapshot its details + photos; then each sale appends its own 20-col Sold row.
  let collKey = null;
  if (fs.inventoryId && state.personalData[fs.inventoryId]) {
    collKey = fs.inventoryId;
  }
  if (!collKey && typeof findPDKey === 'function') {
    collKey = findPDKey(itemNum, variation);
  }
  const collEntry = collKey ? state.personalData[collKey] : null;

  // Write to Sold tab — ALWAYS append (each sale its own row), full snapshot.
  const soldRow = _buildSoldRow({
    itemNum: itemNum, variation: variation, copy: '1',
    condition: fs.condition || (collEntry && collEntry.condition) || '',
    pricePaid: fs.originalPrice || (collEntry && collEntry.priceItem) || '',
    salePrice: salePrice || askingPrice || '',
    dateSold: dateSold,
    notes: fs.notes || '',
    inventoryId: fs.inventoryId || (collEntry && collEntry.inventoryId) || '',
    manufacturer: fs.manufacturer || (collEntry && collEntry.manufacturer) || '',
    src: collEntry || {},
  });
  await sheetsAppend(state.personalSheetId, 'Sold!A:T', [soldRow]);

  // If this sold copy had an Upgrade entry linked to it, convert to Want.
  await _convertUpgradeToWantOnSell(fs.inventoryId || (collEntry && collEntry.inventoryId));

  // Remove from For Sale tab — Phase 3e: guard against synthetic row=99999
  // from optimistic local writes that never got the real sheet row written back.
  if (fs.row && fs.row > 0 && fs.row < 1000) {
    try {
      await sheetsUpdate(state.personalSheetId, `For Sale!A${fs.row}:J${fs.row}`, [['','','','','','','','','','']]);
    } catch (e) {
      console.warn('[Phase 3e] For Sale row clear failed at row ' + fs.row + ':', e && e.message);
    }
  } else if (fs.inventoryId) {
    // Synthetic / unknown row — fetch the For Sale tab and find the real row by inventoryId
    try {
      const fsAll = await sheetsGet(state.personalSheetId, 'For Sale!A3:J');
      const targetInv = String(fs.inventoryId);
      let realRow = -1;
      (fsAll.values || []).forEach((r, idx) => {
        if (String(r[8] || '') === targetInv) realRow = idx + 3;
      });
      if (realRow > 0 && realRow < 1000) {
        await sheetsUpdate(state.personalSheetId, `For Sale!A${realRow}:J${realRow}`, [['','','','','','','','','','']]);
      } else {
        console.warn('[Phase 3e] For Sale row for inventoryId ' + targetInv + ' not found on sheet');
      }
    } catch (e) {
      console.warn('[Phase 3e] For Sale row lookup/clear failed:', e && e.message);
    }
  }

  // Remove from My Collection
  if (collEntry?.row) {
    await sheetsUpdate(state.personalSheetId, personalFullRowRange(collEntry.row), [personalBlankRow()]);
    delete state.personalData[collKey];
  }

  // ── Cascade: this Sold row covers the WHOLE group (one price). Remove
  // every other grouped piece from My Collection, Instruction Sheets, For Sale.
  if (_grpMembers) {
    for (const _m of _grpMembers.pd) {
      if (_m.key === collKey) continue;
      if (_m.rec && _m.rec.row) { try { await sheetsUpdate(state.personalSheetId, personalFullRowRange(_m.rec.row), [personalBlankRow()]); } catch(e){} }
      delete state.personalData[_m.key];
    }
    for (const _m of _grpMembers.is) {
      if (_m.rec && _m.rec.row) { try { await sheetsUpdate(state.personalSheetId, `Instruction Sheets!A${_m.rec.row}:K${_m.rec.row}`, [['','','','','','','','','','','']]); } catch(e){} }
      if (state.isData) delete state.isData[_m.key];
    }
    for (const _f of _grpMembers.fs) {
      const _mk = _fsEntryKey(_f);
      if (_mk === fsKey) continue;
      if (_f.row) { try { await sheetsUpdate(state.personalSheetId, `For Sale!A${_f.row}:J${_f.row}`, [['','','','','','','','','','']]); } catch(e){} }
      delete state.forSaleData[_mk];
    }
  }

  // Session 176: belt-and-suspenders — make sure any -BOX / -MBOX companion is
  // gone too (shared with the wizard sold path), so no orphan box is left behind.
  if (typeof _cleanupSoldItemBoxes === 'function') {
    try { await _cleanupSoldItemBoxes(itemNum, (collEntry && collEntry.groupId) || fs.groupId); } catch(e) {}
  }
  // Optimistic state update — unique key so each sale is its own row.
  var _osk = (typeof _newSoldKey === 'function') ? _newSoldKey() : ('sold-opt-' + Date.now());
  state.soldData[_osk] = {
    row: 99999, key: _osk, itemNum, variation,
    condition: fs.condition || (collEntry && collEntry.condition) || '',
    priceItem: fs.originalPrice || (collEntry && collEntry.priceItem) || '',
    salePrice: salePrice || askingPrice, dateSold, notes: fs.notes || '',
    photoItem: (collEntry && collEntry.photoItem) || '', photoBox: (collEntry && collEntry.photoBox) || '',
    roadName: (collEntry && collEntry.roadName) || '', description: (collEntry && collEntry.description) || '',
    userEstWorth: (collEntry && collEntry.userEstWorth) || '', hasBox: (collEntry && collEntry.hasBox) || '',
    boxCond: (collEntry && collEntry.boxCond) || '', allOriginal: (collEntry && collEntry.allOriginal) || '',
    datePurchased: (collEntry && collEntry.datePurchased) || '',
    inventoryId: fs.inventoryId || (collEntry && collEntry.inventoryId) || '',
    manufacturer: fs.manufacturer || (collEntry && collEntry.manufacturer) || '',
  };
  delete state.forSaleData[fsKey];

  _cachePersonalData();

  buildForSalePage();
  buildSoldPage();
  buildDashboard();
  showToast('✓ Marked as sold!');
}

// Phase 3: signature is now (inventoryId). Called from My Collection row button.
async function _removeForSaleFromCollection(inventoryId) {
  let fs = inventoryId ? state.forSaleData[inventoryId] : null;
  let fsKey = inventoryId;
  if (!fs && inventoryId) {
    // legacy fallback — scan entries for one whose inventoryId matches
    const _ent = Object.entries(state.forSaleData || {}).find(function(e) {
      return e[1] && e[1].inventoryId === inventoryId;
    });
    if (_ent) { fsKey = _ent[0]; fs = _ent[1]; }
  }
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

// Phase 3: signature is now (inventoryId). Called from My Collection row button.
async function _removeUpgradeFromCollection(inventoryId) {
  let ug = inventoryId ? state.upgradeData[inventoryId] : null;
  let key = inventoryId;
  if (!ug && inventoryId) {
    const _ent = Object.entries(state.upgradeData || {}).find(function(e) {
      return e[1] && e[1].inventoryId === inventoryId;
    });
    if (_ent) { key = _ent[0]; ug = _ent[1]; }
  }
  if (!ug) { showToast('Item not found on Upgrade list'); return; }
  if (ug.row) {
    await sheetsUpdate(state.personalSheetId, `Want-Upgrade List!A${ug.row}:I${ug.row}`, [['','','','','','','','','']]);
  }
  delete state.upgradeData[key];
  _cachePersonalData();
  showToast('✓ Removed from Upgrade List');
  renderBrowse();
  buildDashboard();
  const badge = document.getElementById('nav-wishlist-count');
  if (badge) { const c = (typeof wishlistFoldedCount === 'function') ? wishlistFoldedCount() : Object.values(state.upgradeData).length; badge.textContent = c > 0 ? c : '—'; }   // v0.9.722
}

// Phase 3: signature is now (fsKey). fsKey is the inventoryId (or
// 'legacy-row-N' fallback) of the For Sale entry to remove.
async function removeForSaleItem(fsKey) {
  const _lead = state.forSaleData[fsKey] || {};
  if (!_lead.itemNum) { showToast('Item not found on For Sale list'); return; }
  const _grp = (typeof window !== 'undefined' && typeof window._fsGroupMembers === 'function') ? window._fsGroupMembers(_lead) : null;
  const _isGroup = !!(_grp && _grp.fs.length > 1);
  if (!(await appConfirm(_isGroup
        ? 'Take this whole group off your For Sale list? All ' + _grp.fs.length + ' pieces stay in your collection.'
        : 'Remove this item from your For Sale list?', { danger: true, ok: 'Remove' }))) return;
  const _members = _isGroup ? _grp.fs : [_lead];
  for (const _f of _members) {
    const _mk = _fsEntryKey(_f);
    if (_f.row) { try { await sheetsUpdate(state.personalSheetId, `For Sale!A${_f.row}:J${_f.row}`, [['','','','','','','','','','']]); } catch(e){} }
    delete state.forSaleData[_mk];
  }
  _cachePersonalData();
  buildForSalePage();
  buildDashboard();
  showToast(_isGroup ? '✓ Group removed from For Sale' : '✓ Removed from For Sale');
}

// Phase 3: signature is now (idx, inventoryId). Look up the For Sale entry
// by inventoryId; fall back to a scan for legacy rows without an inventoryId.
async function _removeForSaleFromDetail(idx, inventoryId) {
  let fsEntry = inventoryId ? state.forSaleData[inventoryId] : null;
  let fsKey = inventoryId;
  if (!fsEntry && inventoryId) {
    const _ent = Object.entries(state.forSaleData || {}).find(function(e) {
      return e[1] && e[1].inventoryId === inventoryId;
    });
    if (_ent) { fsKey = _ent[0]; fsEntry = _ent[1]; }
  }
  if (!fsEntry) { showToast('Item is not on For Sale list'); return; }
  if (!(await appConfirm('Remove No. ' + fsEntry.itemNum + ' from your For Sale list?', { danger: true, ok: 'Remove' }))) return;
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

// Phase 3: signature is now (fsKey). fsKey is the inventoryId (or
// 'legacy-row-N' fallback) of the For Sale entry to remove.
async function removeForSaleAndCollection(fsKey) {
  const _lead = state.forSaleData[fsKey] || {};
  if (!_lead.itemNum) { showToast('Item not found on For Sale list'); return; }
  const itemNum = _lead.itemNum;
  const variation = _lead.variation || '';
  const _grp = (typeof window !== 'undefined' && typeof window._fsGroupMembers === 'function') ? window._fsGroupMembers(_lead) : null;
  const _isGroup = !!(_grp && (_grp.fs.length > 1 || _grp.pd.length > 1 || _grp.is.length > 0));
  if (!(await appConfirm(_isGroup
        ? 'Remove this whole group from For Sale AND your collection? This cannot be undone.'
        : 'Remove this item from For Sale AND your collection? This cannot be undone.', { danger: true, ok: 'Remove Both' }))) return;
  // For Sale rows (all members)
  const _fsMembers = (_grp && _grp.fs.length) ? _grp.fs : [_lead];
  for (const _f of _fsMembers) {
    const _mk = _fsEntryKey(_f);
    if (_f.row) { try { await sheetsUpdate(state.personalSheetId, `For Sale!A${_f.row}:J${_f.row}`, [['','','','','','','','','','']]); } catch(e){} }
    delete state.forSaleData[_mk];
  }
  // My Collection rows (all members) — prefer the lead's inventoryId for single-item case
  if (_grp && _grp.pd.length) {
    for (const _m of _grp.pd) {
      if (_m.rec && _m.rec.row) { try { await sheetsUpdate(state.personalSheetId, personalFullRowRange(_m.rec.row), [personalBlankRow()]); } catch(e){} }
      delete state.personalData[_m.key];
    }
  } else {
    // Phase 3: prefer the lead's inventoryId for the collection lookup so duplicate copies don't collide.
    let collKey = _lead.inventoryId && state.personalData[_lead.inventoryId] ? _lead.inventoryId : null;
    if (!collKey && typeof findPDKey === 'function') collKey = findPDKey(itemNum, variation);
    const collEntry = collKey ? state.personalData[collKey] : null;
    if (collEntry && collEntry.row) {
      await sheetsUpdate(state.personalSheetId, personalFullRowRange(collEntry.row), [personalBlankRow()]);
    }
    if (collKey) delete state.personalData[collKey];
  }
  // Instruction sheets (all members)
  if (_grp && _grp.is.length) {
    for (const _m of _grp.is) {
      if (_m.rec && _m.rec.row) { try { await sheetsUpdate(state.personalSheetId, `Instruction Sheets!A${_m.rec.row}:K${_m.rec.row}`, [['','','','','','','','','','','']]); } catch(e){} }
      if (state.isData) delete state.isData[_m.key];
    }
  }
  _cachePersonalData();
  buildForSalePage();
  buildDashboard();
  renderBrowse();
  showToast(_isGroup ? '✓ Group removed' : '✓ Item removed');
}


// ══════════════════════════════════════════════════════════════════════
// SETS PAGE  /  DISCLAIMER  /  CONTACT MODAL  /  UPGRADE PAGE
// (showPage router stays in app.js — page navigation infra)
// ══════════════════════════════════════════════════════════════════════

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
      return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:0.85rem 1rem">'
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
  if (window.BackStack && BackStack.wire) BackStack.wire(overlay); // v0.9.805 TODO-012: device Back closes this pop-up
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
      '<button onclick="document.getElementById(\'contact-modal\').style.display=\'none\';if(window.BackStack)BackStack.pop(\'contact-modal\')" style="position:absolute;top:0.75rem;right:0.75rem;background:none;border:none;color:var(--text-dim);font-size:1.1rem;cursor:pointer">&#x2715;</button>' +
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
  d.addEventListener('click', function(e) { if (e.target === d) { d.style.display = 'none'; if (window.BackStack) BackStack.pop('contact-modal'); } });
  document.body.appendChild(d);
}

function showContactModal() {
  _buildContactModal();
  const m = document.getElementById('contact-modal');
  if (m) {
    m.style.display = 'flex';
    // v0.9.805 TODO-012: device Back hides this pop-up (it toggles display
    // instead of removing itself, so it can't use BackStack.wire()).
    if (window.BackStack) BackStack.push('contact-modal', function () { m.style.display = 'none'; });
  }
}


// ══════════════════════════════════════════════════════════════════
// UPGRADE LIST
// ══════════════════════════════════════════════════════════════════

// Strip the internal [grp:xxx] marker from a notes string before display.
// Loader normally parses it out and stores it as entry.groupId, but cached
// state from before that fix can still carry the marker. Defensive cleanup.
function _wlStripGrp(notes) {
  if (!notes) return '';
  return String(notes).replace(/^\[grp:[^\]]+\]\s*/, '');
}
if (typeof window !== 'undefined') window._wlStripGrp = _wlStripGrp;

// ── Want/Upgrade list: sortable headers (Session 162+) ──
var _WU_COLS = [
  { col: 'num',      label: 'Item #' },
  { col: 'road',     label: 'Road Name' },
  { col: 'mfr',      label: 'Manufacturer' },
  { col: 'cond',     label: 'Condition Target' },
  { col: 'priority', label: 'Priority' },
  { col: 'price',    label: 'Max Price' },
  { col: 'notes',    label: 'Notes', noSort: true }
];
function _wuSortVal(u, col) {
  if (col === 'num') return parseInt(String(u.itemNum || '').replace(/[^0-9]/g, '')) || 0;
  if (col === 'road') { var m = (typeof findMaster === 'function' ? findMaster(u.itemNum, '', u) : null) || {}; return (m.roadName || '').toLowerCase(); }
  if (col === 'mfr') return (u.manufacturer || '').toLowerCase();
  if (col === 'cond') return parseFloat(u.targetCondition) || 0;
  if (col === 'priority') { var o = { High: 0, Medium: 1, Low: 2 }; return (o[u.priority] != null ? o[u.priority] : 1); }
  if (col === 'price') return parseFloat(u.expectedPrice || u.maxPrice) || 0;
  return '';
}
function _wuItemNumHTML(u) {
  var num = String(u.itemNum || '');
  if (u._mergedTender) {
    var _cfg = (typeof groupConfigLabel === 'function') ? groupConfigLabel(num, [u._mergedTender]) : '';
    return num + ' <span style="opacity:0.6;font-size:0.8em" title="Paired set — priced together">\uD83D\uDD17</span> <span style="font-size:0.85em;color:var(--text-mid)">' + u._mergedTender + '</span>' + (_cfg ? ' <span style="font-size:0.6rem;font-weight:700;color:var(--accent3,#2ecc71);border:1px solid var(--accent3,#2ecc71);border-radius:4px;padding:0.05rem 0.3rem;vertical-align:middle">' + _cfg + '</span>' : '');
  }
  return num;
}
function _renderWuHeader() {
  var thead = document.querySelector('#upgrade-table thead tr');
  if (!thead) return;
  var cs = state._wuSort || {};
  var html = _WU_COLS.map(function(c) {
    if (c.noSort) return '<th style="white-space:nowrap">' + c.label + '</th>';
    var arrow = (cs.col === c.col) ? (cs.dir === 'desc' ? ' \u25BC' : ' \u25B2') : '';
    return '<th onclick="_wuSortBy(\'' + c.col + '\')" style="cursor:pointer;white-space:nowrap" title="Sort by ' + c.label + '">' + c.label + arrow + '</th>';
  }).join('');
  html += '<th style="white-space:nowrap">Actions</th>';
  thead.innerHTML = html;
}
function _wuSortBy(col) {
  var cs = state._wuSort;
  if (cs && cs.col === col) { cs.dir = (cs.dir === 'asc') ? 'desc' : 'asc'; }
  else { state._wuSort = { col: col, dir: 'asc' }; }
  buildUpgradePage();
}
if (typeof window !== 'undefined') { window._wuSortBy = _wuSortBy; window._renderWuHeader = _renderWuHeader; }

function buildUpgradePage() {
  // Combined Want/Upgrade page (Session 161+). state._wishlistFilter controls
  // which slice is shown: 'all' (default) | 'want' | 'upgrade'. Pull entries
  // from BOTH state.wantData and state.upgradeData, tag with listType.
  const isMobile = window.innerWidth <= 640;
  const _uq = (state._upgradeSearch || '').toLowerCase();
  const _sort = state._upgradeSort || 'priority';
  const _up = state._upgradePriority || '';
  const _wf = state._wishlistFilter || 'all';
  // Sync dropdowns with state
  const _upEl = document.getElementById('upgrade-priority-filter');
  if (_upEl && _upEl.value !== _up) _upEl.value = _up;
  // Sync filter dropdown with state
  var _wfDrop = document.getElementById('wishlist-filter-dropdown');
  if (_wfDrop && _wfDrop.value !== _wf) _wfDrop.value = _wf;

  const wantTotal = Object.keys(state.wantData || {}).length;
  const upgradeTotal = Object.keys(state.upgradeData || {}).length;
  const totalCount = wantTotal + upgradeTotal;

  // Share-mode setup (Session 161+): use window._shareMode/_shareSource
  // explicitly so the closure can't shadow either reference.
  const _wuInShare = !!(window._shareMode && window._shareSource === 'upgrade');
  if (typeof console !== 'undefined' && console.log) {
    console.log('[buildUpgradePage] _wuInShare =', _wuInShare,
      'window._shareMode =', window._shareMode,
      'window._shareSource =', window._shareSource);
  }
  if (_wuInShare) {
    window._shareDataMap = window._shareDataMap || {};
  }

  // Build merged entries list. Each entry carries listType for downstream rendering.
  const _collect = [];
  if (_wf === 'all' || _wf === 'upgrade') {
    Object.values(state.upgradeData || {}).forEach(u => _collect.push(Object.assign({}, u, { listType: 'Upgrade' })));
  }
  if (_wf === 'all' || _wf === 'want') {
    Object.values(state.wantData || {}).forEach(w => _collect.push(Object.assign({}, w, { listType: 'Want' })));
  }

  let entries = _collect.filter(u => {
    // Era filter
    if (typeof _isInCurrentEra === 'function' && !_isInCurrentEra(u.itemNum)) return false;
    // Priority filter
    if (_up && (u.priority || 'Medium') !== _up) return false;
    if (_uq) {
      const master = findMaster(u.itemNum, '', u) || {};
      if (!(u.itemNum||'').toLowerCase().includes(_uq)
        && !(master.roadName||'').toLowerCase().includes(_uq)
        && !_wlStripGrp(u.notes||'').toLowerCase().includes(_uq)) return false;
    }
    return true;
  });

  const priorityOrder = { High: 0, Medium: 1, Low: 2 };
  if (state._wuSort && state._wuSort.col) {
    var _wc = state._wuSort.col, _wd = (state._wuSort.dir === 'desc') ? -1 : 1;
    var _wnum = (_wc === 'num' || _wc === 'cond' || _wc === 'priority' || _wc === 'price');
    entries.sort(function(a, b) {
      var va = _wuSortVal(a, _wc), vb = _wuSortVal(b, _wc), r;
      if (_wnum) r = va - vb; else r = String(va).localeCompare(String(vb), undefined, { numeric: true });
      if (r === 0) r = (a.itemNum || '').localeCompare(b.itemNum || '', undefined, { numeric: true });
      return r * _wd;
    });
  } else if (_sort === 'priority') {
    entries.sort((a, b) => (priorityOrder[a.priority]??1) - (priorityOrder[b.priority]??1));
  } else if (_sort === 'condition') {
    entries.sort((a, b) => {
      const getC = u => { const pd = Object.values(state.personalData).find(p => p.owned && p.itemNum === u.itemNum && (p.variation||'') === (u.variation||'')); return pd && pd.condition ? parseInt(pd.condition) : 99; };
      return getC(a) - getC(b);
    });
  } else {
    entries.sort((a, b) => (a.itemNum||'').localeCompare(b.itemNum||'', undefined, {numeric:true}));
  }

  // Group engine + its tender into ONE row using the catalog partner map.
  // The tender entry is absorbed into the locomotive entry (same list type).
  (function _wuGroupPairs() {
    var byNum = {};
    entries.forEach(function(e) { if (!byNum[e.itemNum]) byNum[e.itemNum] = e; });
    var absorbed = {};
    entries.forEach(function(e) {
      if (absorbed[e.itemNum]) return;
      if (typeof isLocomotive === 'function' && isLocomotive(e.itemNum)) {
        var tenders = (typeof getMatchingTenders === 'function') ? (getMatchingTenders(e.itemNum) || []) : [];
        for (var i = 0; i < tenders.length; i++) {
          var t = tenders[i];
          if (t && t !== e.itemNum && byNum[t] && !absorbed[t] && byNum[t].listType === e.listType) {
            e._mergedTender = t; absorbed[t] = true; break;
          }
        }
      }
      // v0.9.721 (Brad's 2245-P + 2245C at $700 EACH): diesel A units absorb
      // their wanted B/C partner the same way — one row, one group price.
      if (!e._mergedTender && typeof getSetPartner === 'function') {
        var _b = String(e.itemNum).replace(/-(P|D)$/i, '');
        if (!/C$/i.test(_b)) {
          var _sp = getSetPartner(e.itemNum);
          if (_sp && String(_sp) !== String(e.itemNum) && byNum[_sp] && !absorbed[_sp] && byNum[_sp].listType === e.listType) {
            e._mergedTender = String(_sp); absorbed[_sp] = true;
          }
        }
      }
    });
    if (Object.keys(absorbed).length) entries = entries.filter(function(e) { return !absorbed[e.itemNum]; });
  })();

  // Update combined wishlist badge (Want + Upgrade total).
  const badge = document.getElementById('nav-wishlist-count');
  if (badge) { const _fc = (typeof wishlistFoldedCount === 'function') ? wishlistFoldedCount() : totalCount; badge.textContent = _fc > 0 ? _fc : '\u2014'; }   // v0.9.722
  // Count display
  const upgradeCountEl = document.getElementById('upgrade-count');
  if (upgradeCountEl) {
    const labelTotal = (_wf === 'want') ? wantTotal : (_wf === 'upgrade') ? upgradeTotal : totalCount;
    upgradeCountEl.textContent = entries.length === labelTotal
      ? labelTotal + ' item' + (labelTotal !== 1 ? 's' : '')
      : 'Showing ' + entries.length + ' of ' + labelTotal;
  }

  const cardsEl = document.getElementById('upgrade-cards');
  const tableEl = document.getElementById('upgrade-table');
  if (typeof _renderWuHeader === 'function') _renderWuHeader();
  const tbody   = document.getElementById('upgrade-tbody');

  const priorityColor = { High: 'var(--accent)', Medium: 'var(--accent2)', Low: 'var(--text-dim)' };

  if (entries.length === 0) {
    const hasFilters = _uq || _up || _wf !== 'all';
    const emptyIcon = hasFilters ? '🔍' : '★';
    const emptyMsg = hasFilters
      ? 'No items match your filters'
      : 'Your want/upgrade list is empty';
    const emptyTip = hasFilters
      ? 'Try adjusting your search or filters'
      : 'Add items you\'re hunting for from My Collection or the catalog';
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
      const master = findMaster(u.itemNum, '', u);
      const name = master ? (master.roadName || '') : '';  // Road Name column shows ONLY roadName — itemType fallback removed (was lying about road name)
      const cond = pd && pd.condition ? parseInt(pd.condition) : null;
      const condClass = cond >= 9 ? 'cond-9' : cond >= 7 ? 'cond-7' : cond >= 5 ? 'cond-5' : cond ? 'cond-low' : '';
      const pColor = priorityColor[u.priority] || 'var(--text-dim)';
      const escVar = (u.variation||'').replace(/'/g,"\\'");
      const photoId = `upgphoto-m-${u.itemNum}-${u.variation||''}`.replace(/[^a-zA-Z0-9-]/g,'_');
      const hasPhoto = pd && !!pd.photoItem;
      // List Type chip — Want gets sky-blue, Upgrade gets purple.
      const _isWant = u.listType === 'Want';
      const _ltColor = _isWant ? '#3b82f6' : '#8b5cf6';
      const _ltBg    = _isWant ? 'rgba(59,130,246,0.12)' : 'rgba(139,92,246,0.12)';
      const _escName = (name||'').replace(/'/g,"\\'");
      const _priceLabel = _isWant ? 'Want: ' : 'Max: ';
      const _priceVal = _isWant ? u.expectedPrice : u.maxPrice;
      return `<div onclick="_wantViewDetail('${u.itemNum}','${escVar}')" style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:0.85rem 1rem;cursor:pointer">
        <div style="display:flex;align-items:flex-start;gap:0.5rem">
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap">
              <span style="font-family:var(--font-head);font-size:1.1rem;color:var(--accent)">${_wuItemNumHTML(u)}</span>
              ${u.variation ? `<span style="font-size:0.72rem;color:var(--text-dim)">${u.variation}</span>` : ''}
              ${!_isWant ? `<span style="font-size:0.6rem;font-weight:700;color:${_ltColor};background:${_ltBg};border-radius:4px;padding:0.1rem 0.4rem;text-transform:uppercase;letter-spacing:0.05em">${u.listType||'Want'}</span>` : ''}
              <span style="font-size:0.65rem;font-weight:600;color:${pColor};border:1px solid ${pColor};border-radius:4px;padding:0.1rem 0.4rem">${u.priority||'Medium'}</span>
            </div>
            ${name ? `<div style="font-size:0.82rem;color:var(--text);margin-top:0.1rem">${name}</div>` : ''}
            <div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.25rem;flex-wrap:wrap">
              ${!_isWant && cond !== null ? `<span style="font-size:0.75rem"><span class="condition-pip ${condClass}"></span>Mine: ${cond}</span>` : ''}
              ${u.targetCondition ? `<span style="font-size:0.75rem;color:#8b5cf6">→ Target: ${u.targetCondition}</span>` : ''}
              ${_priceVal ? `<span style="font-size:0.75rem;color:var(--accent2);font-family:var(--font-mono)">${_priceLabel}$${parseFloat(_priceVal).toLocaleString()}</span>` : ''}
            </div>
            ${_wlStripGrp(u.notes) ? `<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.15rem">${_wlStripGrp(u.notes)}</div>` : ''}
          </div>
          ${!_isWant && hasPhoto ? `<button onclick="event.stopPropagation();_toggleUpgradePhoto('${photoId}','${pd.photoItem.replace(/'/g,"\\'")}')" style="background:none;border:none;font-size:1.1rem;cursor:pointer;flex-shrink:0" title="View my photo">📷</button>` : ''}
        </div>
        ${!_isWant ? `<div id="${photoId}" style="display:none;margin-top:0.5rem"><img src="${pd && pd.photoItem ? pd.photoItem : ''}" style="max-width:100%;max-height:180px;border-radius:8px;object-fit:contain" onerror="this.parentElement.style.display='none'"></div>` : ''}
        <div style="display:flex;gap:0.35rem;margin-top:0.6rem;flex-wrap:wrap">
          ${!_isWant ? `<button onclick="event.stopPropagation();_upgradeViewMine('${_ugEntryKey(u)}')" style="flex:1;min-width:0;padding:0.4rem 0.3rem;border-radius:7px;font-size:0.72rem;cursor:pointer;border:1.5px solid #8b5cf6;background:rgba(139,92,246,0.1);color:#8b5cf6;font-family:var(--font-body);font-weight:600">View Mine</button>` : ''}
          <button onclick="event.stopPropagation();wantFindOnEbay('${u.itemNum}','${_escName}')" style="flex:1;min-width:0;padding:0.4rem 0.3rem;border-radius:7px;font-size:0.72rem;cursor:pointer;border:1.5px solid #e67e22;background:rgba(230,126,34,0.12);color:#e67e22;font-family:var(--font-body);font-weight:600">eBay</button>
          <button onclick="event.stopPropagation();wantSearchOtherSites('${u.itemNum}','${_escName}')" style="flex:1;min-width:0;padding:0.4rem 0.3rem;border-radius:7px;font-size:0.72rem;cursor:pointer;border:1.5px solid #2980b9;background:rgba(41,128,185,0.12);color:#2980b9;font-family:var(--font-body);font-weight:600">Search</button>
          ${_isWant
            ? `<button onclick="event.stopPropagation();moveWantToCollection('${u.itemNum}','${escVar}')" style="flex:1;min-width:0;padding:0.4rem 0.3rem;border-radius:7px;font-size:0.72rem;cursor:pointer;border:1.5px solid #2ecc71;background:rgba(46,204,113,0.12);color:#2ecc71;font-family:var(--font-body);font-weight:600">+ Collection</button>`
            : `<button onclick="event.stopPropagation();upgradeGotIt('${_ugEntryKey(u)}')" style="flex:1;min-width:0;padding:0.4rem 0.3rem;border-radius:7px;font-size:0.72rem;cursor:pointer;border:1.5px solid #2ecc71;background:rgba(46,204,113,0.12);color:#2ecc71;font-family:var(--font-body);font-weight:600">✓ Got It</button>`}
          ${_isWant
            ? `<button onclick="event.stopPropagation();removeWantItem('${u.itemNum}','${escVar}',${u.row})" style="flex:0 0 auto;padding:0.4rem 0.6rem;border-radius:7px;font-size:0.72rem;cursor:pointer;border:1.5px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body)">Remove</button>`
            : `<button onclick="event.stopPropagation();removeUpgradeItem('${_ugEntryKey(u)}')" style="flex:0 0 auto;padding:0.4rem 0.6rem;border-radius:7px;font-size:0.72rem;cursor:pointer;border:1.5px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body)">Remove</button>`}
        </div>
      </div>`;
    }).join('');
  } else {
    if (tableEl) tableEl.style.display = '';
    if (cardsEl) cardsEl.style.display = 'none';
    tbody.innerHTML = entries.map((u, idx) => {
      const _isWant = u.listType === 'Want';
      const pd = _isWant ? null : Object.values(state.personalData).find(p => p.owned && p.itemNum === u.itemNum && (p.variation||'') === (u.variation||''));
      const master = findMaster(u.itemNum, '', u);
      const name = master ? (master.roadName || '') : '';  // Road Name column shows ONLY roadName — itemType fallback removed (was lying about road name)
      const cond = pd && pd.condition ? parseInt(pd.condition) : null;
      const condClass = cond >= 9 ? 'cond-9' : cond >= 7 ? 'cond-7' : cond >= 5 ? 'cond-5' : cond ? 'cond-low' : '';
      const pColor = priorityColor[u.priority] || 'var(--text-dim)';
      const escVar = (u.variation||'').replace(/'/g,"\\'");
      const escName = (name||'').replace(/'/g,"\\'");
      const hasPhoto = pd && !!pd.photoItem;
      const photoId = `upgphoto-d-${idx}`;
      const _ltColor = _isWant ? '#3b82f6' : '#8b5cf6';
      const _ltBg    = _isWant ? 'rgba(59,130,246,0.12)' : 'rgba(139,92,246,0.12)';
      const _priceVal = _isWant ? u.expectedPrice : u.maxPrice;
      // Share-mode: unique key + register in _shareDataMap.
      const _wuShareKey = _wuInShare ? ('wu-' + (u.itemNum||'') + '-' + (u.variation||'') + '-' + (u.listType||'')) : '';
      const _wuSelected = _wuInShare && typeof _shareItems !== 'undefined' && _shareItems[_wuShareKey];
      if (_wuInShare) {
        window._shareDataMap[_wuShareKey] = {
          itemNum: u.itemNum, variation: u.variation || '',
          listType: u.listType || 'Want', priority: u.priority || 'Medium',
          notes: _wlStripGrp(u.notes || ''),
          price: _priceVal || '',
          targetCondition: u.targetCondition || '',
          manufacturer: u.manufacturer || '',
          roadName: name || '',
        };
      }
      var _wuTrAttrs = '';
      var _wuCheckbox = '';
      if (_wuInShare) {
        _wuTrAttrs = ' id="share-card-' + _wuShareKey + '" onclick="toggleShareItem(\'' + _wuShareKey + '\')" style="cursor:pointer;' + (_wuSelected ? 'outline:2px solid #2ecc71;background:rgba(46,204,113,0.06);' : '') + '"';
        _wuCheckbox = '<input type="checkbox" id="share-cb-' + _wuShareKey + '" ' + (_wuSelected ? 'checked' : '') + ' onclick="event.stopPropagation();toggleShareItem(\'' + _wuShareKey + '\')" style="width:1rem;height:1rem;accent-color:#2ecc71;margin-right:5px;vertical-align:middle">';
      } else {
        // Non-share mode: clicking the row opens the catalog item detail page.
        var _escVarAttr = (u.variation||'').replace(/'/g,"\\'");
        _wuTrAttrs = ' onclick="_wantViewDetail(\'' + u.itemNum + '\',\'' + _escVarAttr + '\')" style="cursor:pointer" onmouseover="this.style.background=\'var(--surface2)\'" onmouseout="this.style.background=\'\'"';
      }
      return `<tr${_wuTrAttrs}>
        <td>
          ${_wuCheckbox}<span class="item-num">${_wuItemNumHTML(u)}</span>
          ${!_isWant ? `<span style="display:inline-block;margin-left:0.4rem;font-size:0.6rem;font-weight:700;color:${_ltColor};background:${_ltBg};border-radius:4px;padding:0.1rem 0.4rem;text-transform:uppercase;letter-spacing:0.05em;vertical-align:middle">${u.listType||'Want'}</span>` : ''}
        </td>
        <td style="color:var(--text-mid)">${name || '<span class="text-dim">—</span>'}</td>
        <td style="font-size:0.82rem;color:var(--text-mid)">${u.manufacturer || '<span class="text-dim">—</span>'}</td>
        <td style="color:#8b5cf6;font-weight:600">${u.targetCondition || '<span class="text-dim">—</span>'}</td>
        <td><span style="color:${pColor};font-weight:500">${u.priority||'Medium'}</span></td>
        <td class="market-val">${_priceVal ? _currencySymbol() + parseFloat(_priceVal).toLocaleString() : '<span class="text-dim">—</span>'}</td>
        <td style="font-size:0.8rem;color:var(--text-dim);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${_wlStripGrp(u.notes||'').replace(/"/g,'&quot;')}">${_wlStripGrp(u.notes) || '<span class="text-dim">—</span>'}</td>
        <td style="white-space:normal">
          ${!_isWant && hasPhoto ? `<button onclick="event.stopPropagation();_toggleUpgradePhoto('${photoId}','${(pd.photoItem||'').replace(/'/g,"\\'")}')" style="padding:0.25rem 0.4rem;border-radius:5px;font-size:0.72rem;cursor:pointer;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);margin-right:0.2rem" title="Toggle photo">📷</button>` : ''}
          ${!_isWant ? `<button onclick="event.stopPropagation();_upgradeViewMine('${_ugEntryKey(u)}')" style="padding:0.2rem 0.45rem;border-radius:5px;font-size:0.7rem;cursor:pointer;border:1px solid #8b5cf6;background:rgba(139,92,246,0.1);color:#8b5cf6;font-family:var(--font-body);font-weight:600;margin-right:0.2rem">View Mine</button>` : ''}
          <button onclick="event.stopPropagation();wantFindOnEbay('${u.itemNum}','${escName}')" style="padding:0.2rem 0.45rem;border-radius:5px;font-size:0.7rem;cursor:pointer;border:1px solid #e67e22;background:rgba(230,126,34,0.12);color:#e67e22;font-family:var(--font-body);margin-right:0.2rem">eBay</button>
          <button onclick="event.stopPropagation();wantSearchOtherSites('${u.itemNum}','${escName}')" style="padding:0.2rem 0.45rem;border-radius:5px;font-size:0.7rem;cursor:pointer;border:1px solid #2980b9;background:rgba(41,128,185,0.12);color:#2980b9;font-family:var(--font-body);margin-right:0.2rem">Search</button>
          ${_isWant
            ? `<button onclick="event.stopPropagation();moveWantToCollection('${u.itemNum}','${escVar}')" style="padding:0.2rem 0.45rem;border-radius:5px;font-size:0.7rem;cursor:pointer;border:1px solid #2ecc71;background:rgba(46,204,113,0.12);color:#2ecc71;font-family:var(--font-body);font-weight:600;margin-right:0.2rem">+ Collection</button>`
            : `<button onclick="event.stopPropagation();upgradeGotIt('${_ugEntryKey(u)}')" style="padding:0.2rem 0.45rem;border-radius:5px;font-size:0.7rem;cursor:pointer;border:1px solid #2ecc71;background:rgba(46,204,113,0.12);color:#2ecc71;font-family:var(--font-body);font-weight:600;margin-right:0.2rem">✓ Got It</button>`}
          ${_isWant
            ? `<button onclick="event.stopPropagation();removeWantItem('${u.itemNum}','${escVar}',${u.row})" style="padding:0.2rem 0.45rem;border-radius:5px;font-size:0.7rem;cursor:pointer;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body)">Remove</button>`
            : `<button onclick="event.stopPropagation();removeUpgradeItem('${_ugEntryKey(u)}')" style="padding:0.2rem 0.45rem;border-radius:5px;font-size:0.7rem;cursor:pointer;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body)">Remove</button>`}
        </td>
      </tr>
      ${!_isWant ? `<tr id="${photoId}-row" style="display:none"><td colspan="8" style="padding:0.5rem 1rem;background:var(--surface2)"><img src="${pd && pd.photoItem ? pd.photoItem : ''}" style="max-height:160px;border-radius:6px;object-fit:contain" onerror="this.parentElement.parentElement.style.display='none'"></td></tr>` : ''}`;
    }).join('') || '<tr><td colspan="8" class="ui-empty">No items on want/upgrade list</td></tr>';
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

// Phase 3: signature is now (ugKey). The entry has the itemNum + inventoryId
// pointing at the user's actual owned copy.
function _upgradeViewMine(ugKey) {
  const ug = state.upgradeData[ugKey];
  if (!ug) { showToast('Upgrade entry not found'); return; }
  const master = findMaster(ug.itemNum);
  if (master) {
    showItemDetailPage(state.masterData.indexOf(master));
  } else {
    showToast('Item not found in master catalog');
  }
}

// ── Pick item for Upgrade entry (Session 161+) ──
// Opens a picker modal listing the user's owned items so they can choose
// which one to target with a new Upgrade entry. After selecting, opens the
// existing showAddToUpgradeModal flow with the picked item's details.
// v0.9.750 (Brad): "item picker should match the add to sales list picker" —
// same shared components as the sell flow: _wpFoldGroups (groups collapse to
// the powered lead + 🔗 chip), _wpSellFilterRow (Maker / Prewar-Postwar-Modern
// / Type / Scale, options from OWNED rows), _wpSellFilterPass, _wpMatchesQ
// (search matches folded mates too).
window._upgPickApply = function () {
  var el = document.getElementById('upg-pick-list');
  if (!el) return;
  var q = ((document.getElementById('upg-pick-q') || {}).value || '').toLowerCase();
  var entries = Object.entries(state.personalData || {}).filter(function (e) {
    var p = e[1];
    return p && p.owned && p.itemNum && !/-(BOX|MBOX)$/i.test(String(p.itemNum || ''));
  });
  var folded = (typeof _wpFoldGroups === 'function') ? _wpFoldGroups(entries) : entries;
  folded = folded.filter(function (e) {
    var okQ = (typeof _wpMatchesQ === 'function') ? _wpMatchesQ(e, q) : true;
    var okF = (typeof _wpSellFilterPass === 'function') ? _wpSellFilterPass(e) : true;
    return okQ && okF;
  });
  folded.sort(function (a, b) { return String(a[1].itemNum || '').localeCompare(String(b[1].itemNum || ''), undefined, { numeric: true }); });
  if (!folded.length) {
    el.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-dim);font-size:0.82rem">No matches</div>';
    return;
  }
  el.innerHTML = folded.map(function (entry) {
    var p = entry[1];
    var master = (String(p.era || '') === 'Manual') ? {} : (findMaster(p.itemNum, p.variation || '', p) || {});
    var name = p.roadName || master.roadName || p.description || master.itemType || p.itemType || '';
    var chip = (typeof _wpGroupChip === 'function') ? _wpGroupChip(p, entry._mates) : '';
    var cond = p.condition ? parseInt(p.condition) : null;
    var condClass = cond >= 9 ? 'cond-9' : cond >= 7 ? 'cond-7' : cond >= 5 ? 'cond-5' : cond ? 'cond-low' : '';
    var escVar = (p.variation || '').replace(/'/g, "\\'");
    return '<button onclick="document.getElementById(\'upgrade-pick-modal\').remove();'
      + 'showAddToUpgradeModal(\'' + p.itemNum + '\',\'' + escVar + '\',' + (p.row || 0) + ',\'' + (p.inventoryId || '') + '\')" '
      + 'style="display:flex;align-items:center;gap:0.6rem;padding:0.65rem 0.85rem;border-radius:8px;'
      + 'background:var(--surface2);border:1px solid var(--border);width:100%;cursor:pointer;'
      + 'font-family:var(--font-body);text-align:left;margin-bottom:0.35rem">'
      + '<div style="flex:1;min-width:0">'
      +   '<div style="font-family:var(--font-mono);color:var(--accent);font-size:0.92rem;font-weight:600;display:flex;align-items:center;gap:0.4rem">'
      +     p.itemNum + (p.variation ? ' <span style="color:var(--text-dim);font-size:0.78rem">var ' + p.variation + '</span>' : '') + chip
      +   '</div>'
      +   (name ? '<div style="font-size:0.78rem;color:var(--text-mid);margin-top:0.15rem">' + name + '</div>' : '')
      + '</div>'
      + (cond !== null ? '<span style="font-size:0.78rem;display:flex;align-items:center;gap:0.3rem"><span class="condition-pip ' + condClass + '"></span>' + cond + '</span>' : '')
      + '</button>';
  }).join('');
};
window._upgPickFilter = window._upgPickApply;   // legacy alias

function pickItemForUpgrade() {
  var owned = Object.values(state.personalData || {}).filter(function (p) { return p && p.owned && p.itemNum; });
  if (owned.length === 0) {
    showToast('Your collection is empty — add items first', 3000, true);
    return;
  }
  var _old = document.getElementById('upgrade-pick-modal');
  if (_old) _old.remove();
  var overlay = document.createElement('div');
  overlay.id = 'upgrade-pick-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:10001;display:flex;align-items:center;justify-content:center;padding:1.25rem';
  overlay.onclick = function (e) { if (e.target === overlay) overlay.remove(); };
  overlay.innerHTML =
    '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;max-width:480px;width:100%;padding:1.4rem;position:relative;max-height:80vh;display:flex;flex-direction:column">'
    + '<button onclick="document.getElementById(\'upgrade-pick-modal\').remove()" style="position:absolute;top:0.75rem;right:0.75rem;background:none;border:none;color:var(--text-dim);font-size:1.1rem;cursor:pointer">\u2715</button>'
    + '<div style="font-family:var(--font-head);font-size:1.15rem;color:#8b5cf6;margin-bottom:0.25rem">\u2191 Add to Upgrade List</div>'
    + '<div style="font-size:0.82rem;color:var(--text-mid);margin-bottom:0.6rem">Pick the item you\'d like to upgrade.</div>'
    + '<div style="display:flex;gap:0.4rem;margin-bottom:0.45rem">'
    +   '<input id="upg-pick-q" type="text" placeholder="Search # or name\u2026" oninput="_upgPickApply()" style="flex:1;min-width:0;padding:0.5rem 0.65rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.85rem">'
    + '</div>'
    + ((typeof _wpSellFilterRow === 'function') ? _wpSellFilterRow('_upgPickApply()') : '')
    + '<div id="upg-pick-list" style="overflow-y:auto;flex:1"></div>'
    + '</div>';
  document.body.appendChild(overlay);
  if (window.BackStack && BackStack.wire) BackStack.wire(overlay); // v0.9.805 TODO-012: device Back closes this pop-up
  _upgPickApply();
}
if (typeof window !== 'undefined') window.pickItemForUpgrade = pickItemForUpgrade;

function showAddToUpgradeModal(itemNum, variation, pdRow, invId, groupMode) {
  // Session 159 Phase 2: look up the EXACT copy the user clicked on,
  // not just any matching itemNum/variation. The previous lookup
  // (state.personalData[`${itemNum}|${variation}|${pdRow}`]) was wrong
  // — state.personalData is keyed by inventoryId, not by that composite.
  // So the lookup always returned undefined, fell through to first-match,
  // and grabbed copy #1 even when the user clicked copy #2.
  let pd;
  if (invId && state.personalData[invId]) pd = state.personalData[invId];
  if (!pd && pdRow && typeof findPDKeyByRow === 'function') {
    const _pdKey = findPDKeyByRow(itemNum, variation, pdRow);
    if (_pdKey) pd = state.personalData[_pdKey];
  }
  if (!pd) pd = Object.values(state.personalData).find(p => p.owned && p.itemNum === itemNum && (p.variation||'') === (variation||''));

  // Session 162: grouped-row Upgrade chooser. If this copy is part of a group
  // with more than one real piece (engine + tender, AA/AB/ABA — boxes and
  // instruction sheets excluded), ask whole-set vs just-this (default: set).
  // groupMode 'all'/'one' means the user already chose, so don't re-ask.
  var _grpReal = (pd && pd.groupId)
    ? Object.values(state.personalData).filter(function(p){
        return p && p.groupId === pd.groupId && p.owned
          && (typeof _grpKind !== 'function' || _grpKind(p.itemNum) === 'item');
      })
    : [];
  if (!groupMode && _grpReal.length > 1) { _chooseUpgradeScope(itemNum, variation, pdRow, invId, pd); return; }
  var _isAllUpg = (groupMode === 'all') && _grpReal.length > 1;
  window._upgGroupPieces = _isAllUpg
    ? _grpReal.map(function(p){ return { itemNum: p.itemNum, variation: p.variation || '', invId: p.inventoryId || '' }; })
    : null;
  // Phase 3: state.upgradeData is keyed by inventoryId. Look up by THIS copy's
  // inventoryId; fall back to a one-time scan for legacy rows whose entry has
  // a blank Inventory ID column (they'd be stored under legacy-row-N keys).
  const _invId = pd && pd.inventoryId ? pd.inventoryId : '';
  let existing = (_invId && state.upgradeData[_invId]) || null;
  if (!existing && _invId) {
    existing = Object.values(state.upgradeData || {}).find(function(e) {
      return e && e.inventoryId === _invId;
    }) || null;
  }
  existing = existing || {};
  const master = findMaster(itemNum);
  const name = master ? (master.roadName || master.itemType || itemNum) : itemNum;
  const myCond = pd && pd.condition ? pd.condition : '';

  var _escVarU = (variation||'').replace(/'/g, "\\'");
  var _invU = pd && pd.inventoryId ? pd.inventoryId : '';
  var _hdrNumHtml = _isAllUpg
    ? '<div style="font-family:var(--font-mono);font-size:0.9rem;color:var(--accent);margin-bottom:0.1rem">Set: ' + _grpReal.map(function(p){ return p.itemNum; }).join(' + ') + '</div>'
    : '<div style="font-family:var(--font-mono);font-size:0.9rem;color:var(--accent);margin-bottom:0.1rem">' + itemNum + (variation ? ' <span style="color:var(--text-dim);font-size:0.8rem">' + variation + '</span>' : '') + '</div>';
  var _saveBtnHtml = _isAllUpg
    ? '<button onclick="saveUpgradeGroup()" style="padding:0.6rem;border-radius:8px;background:#8b5cf6;color:#fff;border:none;font-family:var(--font-body);font-size:0.9rem;font-weight:600;cursor:pointer;margin-top:0.25rem">+ Add set (' + _grpReal.length + ' items) to Upgrade List</button>'
    : '<button onclick="saveUpgradeItem(\'' + itemNum + '\',\'' + _escVarU + '\',' + (existing.row||0) + ',\'' + _invU + '\')" style="padding:0.6rem;border-radius:8px;background:#8b5cf6;color:#fff;border:none;font-family:var(--font-body);font-size:0.9rem;font-weight:600;cursor:pointer;margin-top:0.25rem">' + (existing.row ? 'Update Upgrade Entry' : '+ Add to Upgrade List') + '</button>';
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
      ${_hdrNumHtml}
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
        ${_saveBtnHtml}
      </div>
    </div>`;
  document.body.appendChild(overlay);
  if (window.BackStack && BackStack.wire) BackStack.wire(overlay); // v0.9.805 TODO-012: device Back closes this pop-up
}

// Phase 3: signature unchanged (modal already passes invId). Reload after
// save keys by inventoryId directly.
// Session 162: chooser shown when Upgrade is tapped on a grouped row.
// Whole-set is the emphasized default; "just this piece" is the secondary.
function _chooseUpgradeScope(itemNum, variation, pdRow, invId, pd) {
  var pieces = Object.values(state.personalData).filter(function(p){
    return p && p.groupId === pd.groupId && p.owned
      && (typeof _grpKind !== 'function' || _grpKind(p.itemNum) === 'item');
  });
  var listTxt = pieces.map(function(p){ return p.itemNum; }).join(' + ');
  var _old = document.getElementById('upgrade-scope-modal');
  if (_old) _old.remove();
  var overlay = document.createElement('div');
  overlay.id = 'upgrade-scope-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10002;display:flex;align-items:center;justify-content:center;padding:1.25rem';
  overlay.onclick = function(e){ if (e.target === overlay) overlay.remove(); };
  overlay.innerHTML =
    '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;max-width:380px;width:100%;padding:1.5rem">'
    + '<div style="font-family:var(--font-head);font-size:1.05rem;color:#8b5cf6;margin-bottom:0.3rem">↑ Add to Upgrade List</div>'
    + '<div style="font-size:0.84rem;color:var(--text-mid);margin-bottom:1rem">This is a grouped item (<strong style="color:var(--text)">' + listTxt + '</strong>). Add the whole set, or just this piece?</div>'
    + '<div style="display:flex;flex-direction:column;gap:0.5rem">'
    + '<button id="_ugs-all" style="padding:0.8rem 1rem;border-radius:10px;border:2px solid #8b5cf6;background:#8b5cf6;color:#fff;font-family:var(--font-body);font-size:0.9rem;font-weight:700;cursor:pointer;text-align:left">Upgrade the whole set<br><span style="font-weight:400;font-size:0.78rem;opacity:0.85">Add all ' + pieces.length + ' pieces to your Upgrade list</span></button>'
    + '<button id="_ugs-one" style="padding:0.8rem 1rem;border-radius:10px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.9rem;font-weight:600;cursor:pointer;text-align:left">Just ' + itemNum + '<br><span style="font-weight:400;font-size:0.78rem;color:var(--text-dim)">Add only this piece</span></button>'
    + '<button id="_ugs-cancel" style="padding:0.6rem;border-radius:10px;border:1px solid var(--border);background:none;color:var(--text-dim);font-family:var(--font-body);font-size:0.85rem;cursor:pointer">Cancel</button>'
    + '</div></div>';
  document.body.appendChild(overlay);
  if (window.BackStack && BackStack.wire) BackStack.wire(overlay); // v0.9.805 TODO-012: device Back closes this pop-up
  document.getElementById('_ugs-all').onclick = function(){ overlay.remove(); showAddToUpgradeModal(itemNum, variation, pdRow, invId, 'all'); };
  document.getElementById('_ugs-one').onclick = function(){ overlay.remove(); showAddToUpgradeModal(itemNum, variation, pdRow, invId, 'one'); };
  document.getElementById('_ugs-cancel').onclick = function(){ overlay.remove(); };
}

// Session 162: save one Upgrade entry per piece of a grouped set, using the
// single set of details entered once. Mirrors saveUpgradeItem's reload.
async function saveUpgradeGroup() {
  const priority = document.getElementById('upg-priority')?.value || 'Medium';
  const targetCond = document.getElementById('upg-target-cond')?.value || '';
  const maxPrice = document.getElementById('upg-max-price')?.value || '';
  const notes = document.getElementById('upg-notes')?.value || '';
  const pieces = window._upgGroupPieces || [];
  const sheetId = state.personalSheetId;
  if (!sheetId) { showToast('Not connected to a sheet'); return; }
  if (!pieces.length) { showToast('No items to add'); return; }
  try {
    for (const pc of pieces) {
      const mfr = (typeof _brandOfItem === 'function' && _brandOfItem(pc.itemNum)) || _getEraManufacturer();
      const _wuRow = [pc.itemNum, pc.variation || '', 'Upgrade', priority, maxPrice, targetCond, pc.invId || '', notes, mfr];
      const existing = pc.invId ? state.upgradeData[pc.invId] : null;
      if (existing && existing.row > 0) {
        await sheetsUpdate(sheetId, `Want-Upgrade List!A${existing.row}:I${existing.row}`, [_wuRow]);
      } else {
        await sheetsAppend(sheetId, 'Want-Upgrade List!A:I', [_wuRow]);
      }
    }
    const res = await sheetsGet(sheetId, 'Want-Upgrade List!A3:I');
    state.upgradeData = {};
    (res.values || []).forEach((r, idx) => {
      if (!r[0] || r[0] === 'Item Number') return;
      const _row = idx + 3;
      const _s = (v) => (v !== null && v !== undefined && v !== '') ? String(v) : '';
      if (_s(r[2]).toLowerCase() !== 'upgrade') return;
      const _ugEntry = { row: _row, itemNum: _s(r[0]), variation: _s(r[1]), priority: _s(r[3]) || 'Medium', targetCondition: _s(r[5]), maxPrice: _s(r[4]), notes: _s(r[7]), inventoryId: _s(r[6]), manufacturer: _s(r[8]) || 'Lionel', listType: 'Upgrade' };
      const _k = _ugEntry.inventoryId || ('legacy-row-' + _row);
      state.upgradeData[_k] = _ugEntry;
    });
    window._upgGroupPieces = null;
    const modal = document.getElementById('upgrade-add-modal');
    if (modal) modal.remove();
    showToast('✓ Added ' + pieces.length + ' items to Upgrade List');
    buildDashboard();
    if (typeof renderBrowse === 'function') renderBrowse();
    if (typeof _cachePersonalData === 'function') _cachePersonalData();
    const badge = document.getElementById('nav-wishlist-count');
    if (badge) badge.textContent = ((typeof wishlistFoldedCount === 'function') ? wishlistFoldedCount() : Object.values(state.upgradeData).length).toLocaleString();   // v0.9.722
  } catch(e) {
    showToast('Error saving — check connection');
    console.error(e);
  }
}

async function saveUpgradeItem(itemNum, variation, existingRow, invId) {
  const priority = document.getElementById('upg-priority')?.value || 'Medium';
  const targetCond = document.getElementById('upg-target-cond')?.value || '';
  const maxPrice = document.getElementById('upg-max-price')?.value || '';
  const notes = document.getElementById('upg-notes')?.value || '';
  const row = [itemNum, variation||'', priority, targetCond, maxPrice, notes, invId || '', ((typeof _brandOfItem === 'function' && _brandOfItem(itemNum)) || _getEraManufacturer())];
  const sheetId = state.personalSheetId;
  if (!sheetId) { showToast('Not connected to a sheet'); return; }
  try {
    if (existingRow > 0) {
      // Want-Upgrade combined: write 9-col row with List Type='Upgrade'.
      // Old 8-col [itemNum,var,priority,targetCond,maxPrice,notes,invId,mfr]
      // -> 9-col [itemNum,var,'Upgrade',priority,targetPrice,targetCond,invId,notes,mfr]
      const _wuRow = [row[0], row[1], 'Upgrade', row[2], row[4], row[3], row[6], row[5], row[7]];
      await sheetsUpdate(sheetId, `Want-Upgrade List!A${existingRow}:I${existingRow}`, [_wuRow]);
    } else {
      // Want-Upgrade combined: append 9-col row with List Type='Upgrade'.
      const _wuAppendRow = [row[0], row[1], 'Upgrade', row[2], row[4], row[3], row[6], row[5], row[7]];
      await sheetsAppend(sheetId, 'Want-Upgrade List!A:I', [_wuAppendRow]);
    }
    // Reload data — key by inventoryId
    const res = await sheetsGet(sheetId, 'Want-Upgrade List!A3:I');
    state.upgradeData = {};
    (res.values || []).forEach((r, idx) => {
      if (!r[0] || r[0] === 'Item Number') return;
      const _row = idx + 3;
      // Row-builder String coercion (memory rule): UNFORMATTED_VALUE returns numbers.
      const _s = (v) => (v !== null && v !== undefined && v !== '') ? String(v) : '';
      // Want-Upgrade 9-col schema (Session 161+):
      // A=Item#, B=Var, C=ListType, D=Priority, E=Target Price,
      // F=Target Condition, G=Upgrading Inventory ID, H=Notes, I=Manufacturer.
      // Skip Want rows in this post-save Upgrade refresh.
      if (_s(r[2]).toLowerCase() !== 'upgrade') return;
      const _ugEntry = {
        row: _row, itemNum: _s(r[0]), variation: _s(r[1]),
        priority: _s(r[3]) || 'Medium',
        targetCondition: _s(r[5]),
        maxPrice: _s(r[4]),  // Target Price column
        notes: _s(r[7]),
        inventoryId: _s(r[6]),  // Upgrading Inventory ID column
        manufacturer: _s(r[8]) || 'Lionel',
        listType: 'Upgrade',
      };
      const _k = _ugEntry.inventoryId || ('legacy-row-' + _row);
      state.upgradeData[_k] = _ugEntry;
    });
    const modal = document.getElementById('upgrade-add-modal');
    if (modal) modal.remove();
    showToast('✓ Added to Upgrade List');
    buildDashboard();
    if (typeof renderBrowse === 'function') renderBrowse();  // Phase 3c: refresh badges
    if (typeof _cachePersonalData === 'function') _cachePersonalData();
    const badge = document.getElementById('nav-wishlist-count');
    if (badge) badge.textContent = ((typeof wishlistFoldedCount === 'function') ? wishlistFoldedCount() : Object.values(state.upgradeData).length).toLocaleString();   // v0.9.722
  } catch(e) {
    showToast('Error saving — check connection');
    console.error(e);
  }
}

// Phase 3: signature is now (ugKey). ugKey is the inventoryId (or
// 'legacy-row-N' fallback) of the Upgrade entry to remove.
async function removeUpgradeItem(ugKey) {
  if (!state.personalSheetId) return;
  const ug = state.upgradeData[ugKey];
  if (!ug || !ug.row) { showToast('Upgrade entry not found'); return; }
  try {
    await sheetsUpdate(state.personalSheetId, `Want-Upgrade List!A${ug.row}:I${ug.row}`, [['','','','','','','','','']]);
    delete state.upgradeData[ugKey];
    showToast('Removed from Upgrade List');
    buildUpgradePage();
    buildDashboard();
    const badge = document.getElementById('nav-wishlist-count');
    if (badge) { const c = (typeof wishlistFoldedCount === 'function') ? wishlistFoldedCount() : Object.values(state.upgradeData).length; badge.textContent = c > 0 ? c : '—'; }   // v0.9.722
  } catch(e) {
    showToast('Error removing item');
  }
}

// Phase 3: signature is now (ugKey). Look up the entry to render its display name.
function upgradeGotIt(ugKey) {
  // Brad's preference (Session 161+): "Got It" should open the Add wizard
  // pre-filled with the item info + target condition/price as suggestions so
  // the user can capture condition / price-paid / photos in one flow.
  // Wishlist cleanup is handled via the wizard's banner + save hook.
  const _old = document.getElementById('upgrade-gotit-modal');
  if (_old) _old.remove();
  const ug = state.upgradeData[ugKey];
  if (!ug) { showToast('Upgrade entry not found'); return; }
  const itemNum = ug.itemNum;
  const variation = ug.variation || '';
  openWizard('collection');
  setTimeout(function() {
    if (typeof wizard === 'undefined' || !wizard) return;
    // Look up master row (prefer variation match; fall back to any)
    const master = findMaster(itemNum, variation);
    // Seed
    wizard.data._fromUpgradeList = true;
    wizard.data._fromUpgradeKey = ugKey;
    wizard.data._rawItemNum = itemNum;
    wizard.data.itemNum = itemNum;
    if (variation) wizard.data.variation = variation;
    wizard.data.itemCategory = 'lionel';
    wizard.data._itemGrouping = wizard.data._itemGrouping || 'single';
    wizard.data.entryMode = wizard.data.entryMode || 'full';
    // Pre-fill suggested condition + price from upgrade target / max price
    if (ug.targetCondition) wizard.data._prefilledCondition = ug.targetCondition;
    if (ug.maxPrice) wizard.data._suggestedPricePaid = ug.maxPrice;
    if (master) {
      wizard.matchedItem = master;
      if (!wizard.data._era) {
        var _inferredEra = (typeof eraForTab === 'function') ? eraForTab(master._tab) : null;
        if (_inferredEra) {
          wizard.data._era = _inferredEra;
        } else {
          var _tab = String(master._tab || '').toLowerCase();
          if (_tab.includes('mpc') || _tab.includes('modern')) wizard.data._era = 'mpc';
          else if (_tab.includes('pre-war') || _tab.includes('prewar')) wizard.data._era = 'prewar';
          else wizard.data._era = 'pw';
        }
      }
    }
    // Advance through the lookup steps to land on Condition & Details
    var skipIds = new Set(['itemNumGrouping','itemPicker','variation','entryMode','itemCategory']);
    while (wizard.step < wizard.steps.length - 1) {
      var s = wizard.steps[wizard.step];
      if (skipIds.has(s.id) || (s.skipIf && s.skipIf(wizard.data))) wizard.step++;
      else break;
    }
    if (typeof renderWizardStep === 'function') renderWizardStep();
  }, 0);
}

// Legacy stub kept so old onclick handlers from any cached HTML don't 500.
function _upgradeGotItModalLegacy(ugKey) { upgradeGotIt(ugKey); }
function _upgradeGotItOldStart(ugKey) {
  const ug = state.upgradeData[ugKey];
  if (!ug) { showToast('Upgrade entry not found'); return; }
  const itemNum = ug.itemNum;
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
          <button onclick="_upgradeGotItFinish('${ugKey}','keep')" style="padding:0.5rem;border-radius:8px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.85rem;cursor:pointer;text-align:left">Keep both copies</button>
          <button onclick="_upgradeGotItFinish('${ugKey}','forsale')" style="padding:0.5rem;border-radius:8px;border:1.5px solid #e67e22;background:rgba(230,126,34,0.08);color:#e67e22;font-family:var(--font-body);font-size:0.85rem;cursor:pointer;text-align:left">🏷️ List old one for sale</button>
          <button onclick="_upgradeGotItFinish('${ugKey}','remove')" style="padding:0.5rem;border-radius:8px;border:1.5px solid var(--accent);background:rgba(240,80,8,0.08);color:var(--accent);font-family:var(--font-body);font-size:0.85rem;cursor:pointer;text-align:left">Remove old entry from collection</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  if (window.BackStack && BackStack.wire) BackStack.wire(overlay); // v0.9.805 TODO-012: device Back closes this pop-up
}

// Phase 3: signature is now (ugKey, action).
async function _upgradeGotItFinish(ugKey, action) {
  const modal = document.getElementById('upgrade-gotit-modal');
  if (modal) modal.remove();
  const upgradeEntry = state.upgradeData[ugKey];
  const itemNum = upgradeEntry ? upgradeEntry.itemNum : '';
  const variation = upgradeEntry ? (upgradeEntry.variation || '') : '';
  // Remove from upgrade list
  if (upgradeEntry) await removeUpgradeItem(ugKey);
  if (action === 'forsale') {
    // Navigate to for sale flow for this item
    const master = findMaster(itemNum);
    const idx = master ? state.masterData.indexOf(master) : -1;
    if (idx >= 0) collectionActionForSale(idx, itemNum, variation, null, upgradeEntry ? upgradeEntry.inventoryId : '');
    else showToast('Navigate to My Collection to list for sale');
  } else if (action === 'remove') {
    // Phase 3: prefer the upgrade entry's inventoryId so we remove the exact copy.
    let pd = null;
    if (upgradeEntry && upgradeEntry.inventoryId && state.personalData[upgradeEntry.inventoryId]) {
      pd = state.personalData[upgradeEntry.inventoryId];
    } else {
      pd = Object.values(state.personalData).find(p => p.owned && p.itemNum === itemNum && (p.variation||'') === (variation||''));
    }
    if (pd) await removeCollectionItem(itemNum, variation, pd.row, pd.inventoryId);
    else showToast('Item not found in collection');
  } else {
    showToast('✓ Upgrade complete — entry removed from list');
  }
}



// ════════════════════════════════════════════════════════════════════
// PARTS NEEDED LIST (Session 162+) — standalone list of parts you're
// hunting for. Free-form (description + optional part#), can link to an
// owned item, has a Google search. Loaded on-demand (own sheet tab).
// Columns A-H: Part ID, Description, Part Number, For Item, For Inventory ID,
// Photo Link, Notes, Date Added.
// ════════════════════════════════════════════════════════════════════
async function _ensurePartsTab() {
  if (!state.personalSheetId || typeof accessToken === 'undefined' || !accessToken) return false;
  try {
    var meta = await (await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + state.personalSheetId + '?fields=sheets.properties',
      { headers: { Authorization: 'Bearer ' + accessToken } })).json();
    var exists = (meta.sheets || []).some(function (s) { return s.properties && s.properties.title === 'Parts Needed'; });
    if (exists) return true;
    await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + state.personalSheetId + ':batchUpdate', {
      method: 'POST', headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'Parts Needed', tabColor: { red: 0.62, green: 0.42, blue: 0.20 } } } }] })
    });
    await sheetsUpdate(state.personalSheetId, 'Parts Needed!A1', [['🔧 Parts Needed']]);
    await sheetsUpdate(state.personalSheetId, 'Parts Needed!A2:H2',
      [['Part ID', 'Description', 'Part Number', 'For Item', 'For Inventory ID', 'Photo Link', 'Notes', 'Date Added']]);
    return true;
  } catch (e) { console.warn('[Parts] ensure tab failed', e && e.message); return false; }
}

async function buildPartsPage() {
  var listEl = document.getElementById('parts-list');
  if (!listEl) return;
  listEl.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-dim)">Loading parts…</div>';
  try {
    await _ensurePartsTab();
    var res = await sheetsGet(state.personalSheetId, 'Parts Needed!A3:H').catch(function () { return { values: [] }; });
    var parts = {};
    (res.values || []).forEach(function (r, idx) {
      if (!r[0] || r[0] === 'Part ID') return;
      var _s = function (v) { return (v !== null && v !== undefined && v !== '') ? String(v) : ''; };
      parts['p' + (idx + 3)] = {
        row: idx + 3, id: _s(r[0]), description: _s(r[1]), partNum: _s(r[2]),
        forItem: _s(r[3]), forInv: _s(r[4]), photo: _s(r[5]), notes: _s(r[6]), dateAdded: _s(r[7])
      };
    });
    state.partsData = parts;
  } catch (e) { state.partsData = state.partsData || {}; }
  _renderPartsList();
}
if (typeof window !== 'undefined') window.buildPartsPage = buildPartsPage;

function _renderPartsList() {
  var listEl = document.getElementById('parts-list');
  if (!listEl) return;
  var parts = Object.values(state.partsData || {});
  var badge = document.getElementById('nav-parts');
  if (badge) badge.textContent = parts.length || '—';
  var cnt = document.getElementById('parts-count');
  if (cnt) cnt.textContent = parts.length ? (' ' + parts.length + ' part' + (parts.length !== 1 ? 's' : '')) : '';
  if (!parts.length) {
    listEl.innerHTML = '<div style="text-align:center;padding:3rem 1rem;color:var(--text-dim)">'
      + '<div style="font-size:2.5rem;margin-bottom:0.5rem">🔧</div>'
      + '<p>No parts on your list yet</p>'
      + '<p style="font-size:0.8rem;margin-top:0.4rem">Add a part you need to track down at a show — a description, a part number, and which item it\'s for.</p>'
      + '</div>';
    return;
  }
  parts.sort(function (a, b) { return (b.dateAdded || '').localeCompare(a.dateAdded || ''); });
  var _thumbs = [];
  listEl.innerHTML = parts.map(function (p) {
    var forLabel = '';
    if (p.forItem) {
      var m = (typeof findMaster === 'function') ? findMaster(p.forItem) : null;
      forLabel = 'For ' + p.forItem + (m && m.roadName ? ' (' + m.roadName + ')' : '');
    }
    var esc = function (s) { return String(s || '').replace(/'/g, "\\'").replace(/"/g, '&quot;'); };
    var thumb = '';
    if (p.photo) {
      var _fid = (p.photo.match(/\/d\/([a-zA-Z0-9_-]+)/) || [])[1];
      if (_fid) { var _imgId = 'partthumb-' + p.row; _thumbs.push({ fid: _fid, id: _imgId });
        thumb = '<a href="' + p.photo + '" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="flex-shrink:0"><div style="width:48px;height:48px;border-radius:8px;overflow:hidden;background:var(--surface2)"><img id="' + _imgId + '" style="width:100%;height:100%;object-fit:cover"></div></a>'; }
    }
    return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:0.85rem 1rem;margin-bottom:0.6rem">'
      + '<div style="display:flex;align-items:flex-start;gap:0.6rem;flex-wrap:wrap">'
      + thumb
      + '<div style="flex:1;min-width:0">'
      + '<div style="font-weight:600;font-size:0.95rem;color:var(--text)">' + (p.description || '—') + '</div>'
      + '<div style="font-size:0.8rem;color:var(--text-dim);margin-top:0.2rem">'
      + (p.partNum ? '<span style="font-family:var(--font-mono);color:var(--accent2)">Part #' + p.partNum + '</span>' : '')
      + (p.partNum && forLabel ? ' · ' : '')
      + (forLabel ? '<span style="color:#8b5cf6">🔗 ' + forLabel + '</span>' : '')
      + '</div>'
      + (p.notes ? '<div style="font-size:0.78rem;color:var(--text-dim);margin-top:0.2rem">' + p.notes + '</div>' : '')
      + '</div>'
      + '<div style="display:flex;gap:0.35rem;flex-wrap:wrap">'
      + ((p.forInv && state.personalData && state.personalData[p.forInv]) ? '<button onclick="markPartInstalled(' + p.row + ')" style="padding:0.35rem 0.6rem;border-radius:7px;border:1.5px solid #2ecc71;background:rgba(46,204,113,0.12);color:#2ecc71;font-family:var(--font-body);font-size:0.75rem;cursor:pointer;font-weight:600">\u2713 Installed</button>' : '')
      + '<button onclick="googlePart(\'' + esc(p.partNum) + '\',\'' + esc(p.forItem) + '\',\'' + esc(p.description) + '\')" style="padding:0.35rem 0.6rem;border-radius:7px;border:1.5px solid #2980b9;background:rgba(41,128,185,0.1);color:#2980b9;font-family:var(--font-body);font-size:0.75rem;cursor:pointer;font-weight:600">Google</button>'
      + '<button onclick="showAddPartModal(\'' + p.id + '\')" style="padding:0.35rem 0.6rem;border-radius:7px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.75rem;cursor:pointer">Edit</button>'
      + '<button onclick="removePart(' + p.row + ')" style="padding:0.35rem 0.6rem;border-radius:7px;border:1.5px solid #e74c3c;background:rgba(231,76,60,0.1);color:#e74c3c;font-family:var(--font-body);font-size:0.75rem;cursor:pointer">Remove</button>'
      + '</div></div></div>';
  }).join('');
  _thumbs.forEach(function (t) { var el = document.getElementById(t.id); if (el && typeof loadDriveThumb === 'function') loadDriveThumb(t.fid, el, el.parentElement); });
}

function googlePart(partNum, forItem, desc) {
  var mfr = (forItem && typeof _brandOfItem === 'function') ? (_brandOfItem(forItem) || '') : '';
  var idPart = partNum || forItem || '';
  var q = ['part for', mfr, idPart, desc].filter(Boolean).join(' ').trim();
  if (q) window.open('https://www.google.com/search?tbm=shop&q=' + encodeURIComponent(q), '_blank', 'noopener');
}
if (typeof window !== 'undefined') window.googlePart = googlePart;

function showAddPartModal(existingId) {
  var existing = null;
  if (existingId) existing = Object.values(state.partsData || {}).find(function (p) { return p.id === existingId; });
  existing = existing || {};
  // Owned items for the "for item" link
  var ownedOpts = '<option value="">— none —</option>';
  var seen = {};
  Object.values(state.personalData || {}).forEach(function (pd) {
    if (!pd || !pd.owned) return;
    var n = String(pd.itemNum || '');
    if (!n || /-(BOX|MBOX|IS)$/i.test(n) || seen[pd.inventoryId || n]) return;
    seen[pd.inventoryId || n] = true;
    var m = (typeof findMaster === 'function') ? (findMaster(n, pd.variation) || findMaster(n)) : null;
    var _bits = m ? [m.roadName, m.description].filter(Boolean).join(' · ') : '';
    var label = n + (_bits ? ' — ' + _bits : '');
    var val = (pd.inventoryId || n);
    var sel = (existing.forInv && existing.forInv === pd.inventoryId) || (!existing.forInv && existing.forItem === n) ? ' selected' : '';
    ownedOpts += '<option value="' + val + '" data-item="' + n + '"' + sel + '>' + label + '</option>';
  });
  var ov = document.createElement('div');
  ov.id = '_part-modal';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10050;display:flex;align-items:center;justify-content:center;padding:1.25rem';
  ov.innerHTML = '<div style="background:var(--surface);border-radius:14px;padding:1.4rem;max-width:420px;width:100%;border:1px solid var(--border);max-height:90vh;overflow-y:auto">'
    + '<div style="font-family:var(--font-head);font-size:1.05rem;font-weight:700;color:var(--accent);margin-bottom:0.9rem">🔧 ' + (existingId ? 'Edit Part' : 'Add a Part') + '</div>'
    + '<label style="font-size:0.74rem;color:var(--text-dim);display:block;margin-bottom:0.2rem;text-transform:uppercase;letter-spacing:0.05em">Description *</label>'
    + '<input id="_part-desc" type="text" value="' + String(existing.description || '').replace(/"/g, '&quot;') + '" placeholder="e.g. pickup roller assembly" style="width:100%;box-sizing:border-box;padding:0.5rem 0.65rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.9rem;margin-bottom:0.7rem">'
    + '<label style="font-size:0.74rem;color:var(--text-dim);display:block;margin-bottom:0.2rem;text-transform:uppercase;letter-spacing:0.05em">Part Number (optional)</label>'
    + '<input id="_part-num" type="text" value="' + String(existing.partNum || '').replace(/"/g, '&quot;') + '" placeholder="if you know it" style="width:100%;box-sizing:border-box;padding:0.5rem 0.65rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-mono);font-size:0.9rem;margin-bottom:0.7rem">'
    + '<label style="font-size:0.74rem;color:var(--text-dim);display:block;margin-bottom:0.2rem;text-transform:uppercase;letter-spacing:0.05em">For which item? (optional)</label>'
    + '<select id="_part-for" style="width:100%;box-sizing:border-box;padding:0.5rem 0.65rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.9rem;margin-bottom:0.7rem">' + ownedOpts + '</select>'
    + '<label style="font-size:0.74rem;color:var(--text-dim);display:block;margin-bottom:0.2rem;text-transform:uppercase;letter-spacing:0.05em">Reference Photo (optional)</label>'
    + '<div style="margin-bottom:0.7rem">'
    +   '<img id="_part-photo-preview" style="display:none;max-width:100%;max-height:170px;border-radius:8px;object-fit:contain;margin-bottom:0.4rem">'
    +   '<input id="_part-photo-input" type="file" accept="image/*" capture="environment" onchange="_partPhotoPicked(event)" style="width:100%;font-size:0.82rem;color:var(--text)">'
    +   '<div style="font-size:0.68rem;color:var(--text-dim);margin-top:0.2rem">Snap a picture of the part to show a vendor at a show.</div>'
    + '</div>'
    + '<label style="font-size:0.74rem;color:var(--text-dim);display:block;margin-bottom:0.2rem;text-transform:uppercase;letter-spacing:0.05em">Notes (optional)</label>'
    + '<textarea id="_part-notes" rows="2" placeholder="anything else to remember" style="width:100%;box-sizing:border-box;padding:0.5rem 0.65rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.9rem;resize:vertical;margin-bottom:1rem">' + String(existing.notes || '') + '</textarea>'
    + '<div style="display:flex;gap:0.6rem">'
    + '<button onclick="document.getElementById(\'_part-modal\').remove()" style="flex:1;padding:0.6rem;border-radius:8px;border:1px solid var(--border);background:none;color:var(--text-dim);font-family:var(--font-body);cursor:pointer">Cancel</button>'
    + '<button onclick="savePart(' + (existing.row || 0) + ')" style="flex:2;padding:0.6rem;border-radius:8px;border:none;background:var(--accent);color:#fff;font-family:var(--font-body);font-weight:600;cursor:pointer">' + (existingId ? 'Save' : '+ Add Part') + '</button>'
    + '</div></div>';
  ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
  window._partPhotoFile = null;
  document.body.appendChild(ov);
  if (window.BackStack && BackStack.wire) BackStack.wire(ov); // v0.9.805 TODO-012: device Back closes this pop-up
  // Make the "For which item?" dropdown searchable (type an item # or road name).
  if (window.RoadTypeahead && typeof RoadTypeahead.attach === 'function') {
    var _pfSel = document.getElementById('_part-for');
    if (_pfSel) {
      RoadTypeahead.attach(_pfSel);
      var _pfInp = _pfSel.parentNode && _pfSel.parentNode.querySelector('.road-ty-input');
      if (_pfInp) _pfInp.placeholder = 'Type an item # or road name\u2026';
    }
  }
  var di = document.getElementById('_part-desc'); if (di) di.focus();
  if (existing.photo) {
    var _fid = (existing.photo.match(/\/d\/([a-zA-Z0-9_-]+)/) || [])[1];
    var _pp = document.getElementById('_part-photo-preview');
    if (_fid && _pp && typeof loadDriveThumb === 'function') { _pp.style.display = 'block'; loadDriveThumb(_fid, _pp, _pp.parentElement); }
  }
}
if (typeof window !== 'undefined') window.showAddPartModal = showAddPartModal;

function _partPhotoPicked(ev) {
  var file = ev && ev.target && ev.target.files && ev.target.files[0];
  if (!file) return;
  window._partPhotoFile = file;
  var pp = document.getElementById('_part-photo-preview');
  if (pp) { pp.src = URL.createObjectURL(file); pp.style.display = 'block'; }
}
if (typeof window !== 'undefined') window._partPhotoPicked = _partPhotoPicked;

async function savePart(existingRow) {
  var desc = (document.getElementById('_part-desc') || {}).value || '';
  if (!desc.trim()) { if (typeof showToast === 'function') showToast('Please enter a description'); return; }
  var partNum = (document.getElementById('_part-num') || {}).value || '';
  var notes = (document.getElementById('_part-notes') || {}).value || '';
  var sel = document.getElementById('_part-for');
  var forInv = sel ? sel.value : '';
  var forItem = '';
  if (sel && sel.selectedIndex >= 0 && sel.options[sel.selectedIndex]) forItem = sel.options[sel.selectedIndex].getAttribute('data-item') || '';
  // Force identifier columns to text (avoid USER_ENTERED date-parsing part numbers)
  var _t = function (v) { v = String(v || ''); return v && v.charAt(0) !== "'" ? "'" + v : v; };
  var modal = document.getElementById('_part-modal'); if (modal) modal.remove();
  if (typeof showToast === 'function') showToast('Saving…', 1500);
  try {
    await _ensurePartsTab();
    var id = '';
    if (existingRow > 0) {
      var ex = Object.values(state.partsData || {}).find(function (p) { return p.row === existingRow; });
      id = ex ? ex.id : ('part-' + Date.now());
    } else { id = 'part-' + Date.now(); }
    var photoLink = '';
    if (existingRow > 0) { var _exp = Object.values(state.partsData || {}).find(function(p){ return p.row === existingRow; }); photoLink = (_exp && _exp.photo) || ''; }
    if (window._partPhotoFile) {
      try {
        await driveEnsureSetup();
        var _pf = await driveFindOrCreateFolder('Parts', driveCache.photosId);
        var _up = await driveUploadPhoto(window._partPhotoFile, 'part-' + Date.now() + '.jpg', _pf);
        if (_up && _up.id) photoLink = 'https://drive.google.com/file/d/' + _up.id + '/view';
      } catch (pe) { console.warn('[Parts] photo upload failed', pe && pe.message); }
      window._partPhotoFile = null;
    }
    var row = [_t(id), desc, _t(partNum), _t(forItem), _t(forInv), photoLink, notes, new Date().toISOString().split('T')[0]];
    if (existingRow > 0) {
      await sheetsUpdate(state.personalSheetId, 'Parts Needed!A' + existingRow + ':H' + existingRow, [row]);
    } else {
      await sheetsAppend(state.personalSheetId, 'Parts Needed!A:H', [row]);
    }
    if (typeof showToast === 'function') showToast('✓ Part saved');
    buildPartsPage();
  } catch (e) { if (typeof showToast === 'function') showToast('Save failed: ' + (e && e.message || ''), 4000, true); }
}
if (typeof window !== 'undefined') window.savePart = savePart;

async function removePart(rowNum) {
  if (!rowNum) return;
  try {
    await sheetsUpdate(state.personalSheetId, 'Parts Needed!A' + rowNum + ':H' + rowNum, [['', '', '', '', '', '', '', '']]);
    if (typeof showToast === 'function') showToast('Part removed');
    buildPartsPage();
  } catch (e) { if (typeof showToast === 'function') showToast('Remove failed', 3000, true); }
}
if (typeof window !== 'undefined') window.removePart = removePart;

// ════════════════════════════════════════════════════════════════════
// Session 162: "Mark as installed" — push a found part onto its linked
// collection item. Appends a timestamped line to the item's Notes, lets
// the user flip All Original, then removes the part from the list.
// ════════════════════════════════════════════════════════════════════
function markPartInstalled(rowNum) {
  var p = Object.values(state.partsData || {}).find(function (x) { return x.row === rowNum; });
  if (!p) return;
  var pd = p.forInv ? (state.personalData || {})[p.forInv] : null;
  if (!pd) { if (typeof showToast === 'function') showToast('Linked item is not in your collection', 3500, true); return; }
  var m = (typeof findMaster === 'function') ? findMaster(pd.itemNum, '', pd) : null;
  var itemLabel = pd.itemNum + (m && m.roadName ? ' \u2014 ' + m.roadName : '');
  var today = new Date().toISOString().split('T')[0];
  var _esc = function (str) { return String(str || '').replace(/"/g, '&quot;'); };
  var IN = "width:100%;box-sizing:border-box;padding:0.5rem 0.65rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.9rem;margin-bottom:0.7rem";
  var LB = "font-size:0.74rem;color:var(--text-dim);display:block;margin-bottom:0.2rem;text-transform:uppercase;letter-spacing:0.05em";
  var ov = document.createElement('div');
  ov.id = '_part-install-modal';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10060;display:flex;align-items:center;justify-content:center;padding:1.25rem';
  ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
  ov.innerHTML = '<div style="background:var(--surface);border-radius:14px;padding:1.4rem;max-width:420px;width:100%;border:1px solid var(--border);max-height:90vh;overflow-y:auto">'
    + '<div style="font-family:var(--font-head);font-size:1.05rem;font-weight:700;color:#2ecc71;margin-bottom:0.3rem">\u2713 Mark Part Installed</div>'
    + '<div style="font-size:0.82rem;color:var(--text-mid);margin-bottom:0.9rem">Recording this on <strong style="color:var(--text)">' + itemLabel + '</strong>. The details below get added to that item\'s notes.</div>'
    + '<label style="' + LB + '">Part installed *</label>'
    + '<input id="_inst-desc" type="text" value="' + _esc(p.description) + '" style="' + IN + '">'
    + '<label style="' + LB + '">Part Number</label>'
    + '<input id="_inst-part" type="text" value="' + _esc(p.partNum) + '" placeholder="if you know it" style="' + IN + 'font-family:var(--font-mono)">'
    + '<label style="' + LB + '">Price Paid</label>'
    + '<input id="_inst-price" type="number" min="0" step="0.01" placeholder="e.g. 12.50" style="' + IN + 'font-family:var(--font-mono)">'
    + '<label style="' + LB + '">Vendor</label>'
    + '<input id="_inst-vendor" type="text" placeholder="e.g. eBay seller, train show" style="' + IN + '">'
    + '<label style="' + LB + '">Date Installed</label>'
    + '<input id="_inst-date" type="date" value="' + today + '" style="' + IN + '">'
    + '<label style="' + LB + '">Still all original?</label>'
    + '<select id="_inst-orig" style="' + IN + '">'
    +   '<option value="No" selected>No \u2014 a part was replaced</option>'
    +   '<option value="Yes">Yes \u2014 this is a correct original part</option>'
    +   '<option value="Unknown">Unknown</option>'
    + '</select>'
    + '<div style="font-size:0.68rem;color:var(--text-dim);margin:-0.3rem 0 0.9rem">Adding a replacement part usually means it is no longer all original \u2014 change to Yes if this was a correct original part.</div>'
    + '<div style="display:flex;gap:0.6rem">'
    + '<button onclick="document.getElementById(\'_part-install-modal\').remove()" style="flex:1;padding:0.6rem;border-radius:8px;border:1px solid var(--border);background:none;color:var(--text-dim);font-family:var(--font-body);cursor:pointer">Cancel</button>'
    + '<button onclick="_savePartInstalled(' + rowNum + ')" style="flex:2;padding:0.6rem;border-radius:8px;border:none;background:#2ecc71;color:#fff;font-family:var(--font-body);font-weight:600;cursor:pointer">\u2713 Save to item</button>'
    + '</div></div>';
  document.body.appendChild(ov);
  if (window.BackStack && BackStack.wire) BackStack.wire(ov); // v0.9.805 TODO-012: device Back closes this pop-up
  var di = document.getElementById('_inst-desc'); if (di) di.focus();
}
if (typeof window !== 'undefined') window.markPartInstalled = markPartInstalled;

async function _savePartInstalled(rowNum) {
  var p = Object.values(state.partsData || {}).find(function (x) { return x.row === rowNum; });
  if (!p) return;
  var pd = p.forInv ? (state.personalData || {})[p.forInv] : null;
  if (!pd) { if (typeof showToast === 'function') showToast('Linked item not found', 3500, true); return; }
  var g = function (id) { var el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; };
  var desc = g('_inst-desc') || p.description || 'part';
  var partNum = g('_inst-part');
  var price = g('_inst-price');
  var vendor = g('_inst-vendor');
  var date = g('_inst-date') || new Date().toISOString().split('T')[0];
  var orig = g('_inst-orig') || pd.allOriginal || '';
  var line = date + ' \u2014 Installed ' + desc
    + (partNum ? ' (part# ' + partNum + ')' : '')
    + (price ? ', ' + (typeof _currencySymbol === 'function' ? _currencySymbol() : '$') + price : '')
    + (vendor ? ' from ' + vendor : '');
  var newNotes = pd.notes ? (pd.notes + '\n' + line) : line;
  var modal = document.getElementById('_part-install-modal'); if (modal) modal.remove();
  if (typeof showToast === 'function') showToast('Saving\u2026', 1500);
  try {
    var sheetId = state.personalSheetId;
    if (pd.row && pd.row !== 99999 && typeof personalColLetter === 'function') {
      await sheetsUpdate(sheetId, 'My Collection!' + personalColLetter('notes') + pd.row, [[newNotes]]);
      if (orig && orig !== pd.allOriginal) {
        await sheetsUpdate(sheetId, 'My Collection!' + personalColLetter('allOriginal') + pd.row, [[orig]]);
      }
    }
    pd.notes = newNotes;
    if (orig) pd.allOriginal = orig;
    await removePart(rowNum);
    if (typeof renderBrowse === 'function') renderBrowse();
    if (typeof buildDashboard === 'function') buildDashboard();
    if (typeof _cachePersonalData === 'function') _cachePersonalData();
    if (typeof showToast === 'function') showToast('\u2713 Installed on ' + pd.itemNum + ' \u2014 added to its notes');
  } catch (e) {
    if (typeof showToast === 'function') showToast('Save failed: ' + (e && e.message || ''), 4000, true);
  }
}
if (typeof window !== 'undefined') window._savePartInstalled = _savePartInstalled;

