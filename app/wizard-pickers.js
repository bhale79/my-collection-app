// ═══════════════════════════════════════════════════════════════
// wizard-pickers.js — Wizard picker UIs (catalog, IS, collection,
// sold, for-sale)
//
// Extracted from wizard.js in Session 110 (App Split Round 1, Chunk 5).
// Loaded after wizard.js in index.html. All functions are called
// only via inline HTML onclick/oninput handlers and other wizard
// functions, so load order is not strict.
//
// Includes:
//   - wizardFilterChoices, wizardFilterCatalog, wizardPickCatalog
//   - wizardFilterIS, wizardPickIS
//   - wizardPickSoldItem, _filterCollPicker, _selectCollItem
//   - _openFullCollPicker, _renderFullPickList
//   - wizardPickForSaleItem, wizardPickRow
//
// Globals used (defined elsewhere):
//   - wizard.data, wizard.tab (wizard.js)
//   - state.personalData, state.forSaleData, state.soldData (app.js)
//   - findMaster, listForSaleFromCollection, sellFromCollection (app.js)
//   - wizardNext (wizard.js)
//   - showToast (wizard-utils.js)
//   - window._cpAllItems, window._ipAllItems (set by render code in wizard.js)
// ═══════════════════════════════════════════════════════════════

// v0.9.919: soldData is a per-sale history (Session 176) keyed uniquely per
// sale, so "was this copy sold?" must scan for a sale carrying this copy's
// inventoryId. Legacy copies without an inventoryId return false (same as the
// old broken lookup — no regression).
function _wpCopyHasSale(pd) {
  if (!pd || !pd.inventoryId) return false;
  var sd = state.soldData || {};
  var keys = Object.keys(sd);
  for (var i = 0; i < keys.length; i++) {
    var s = sd[keys[i]];
    if (s && s.inventoryId === pd.inventoryId) return true;
  }
  return false;
}

function wizardFilterChoices(fieldId, inputId) {
  const input = document.getElementById(inputId);
  const list  = document.getElementById('cs-list-' + fieldId);
  if (!input || !list) return;
  const q = input.value.toLowerCase().trim();
  // Store typed value in wizard data only if it matches a choice exactly
  const btns = list.querySelectorAll('button[data-choice]');
  let visibleCount = 0;
  btns.forEach(btn => {
    const choiceText = btn.getAttribute('data-choice') || '';
    const matches = !q || choiceText.includes(q);
    btn.style.display = matches ? '' : 'none';
    if (matches) visibleCount++;
  });
  // If exactly one result visible and user hits Enter, auto-select it
  input.onkeydown = (e) => {
    if (e.key === 'Enter') {
      const visible = [...btns].filter(b => b.style.display !== 'none');
      if (visible.length === 1) visible[0].click();
    }
  };
}

function wizardFilterCatalog() {
  const input = document.getElementById('cp-input');
  const list  = document.getElementById('cp-list');
  if (!input || !list) return;
  const q = input.value.toLowerCase().trim();
  const btns = list.querySelectorAll('button[data-search]');
  if (!q) { btns.forEach(b => b.style.display = ''); return; }
  const tokens = q.split(/\s+/).filter(Boolean);
  btns.forEach(function(btn) {
    const hay = btn.getAttribute('data-search') || '';
    btn.style.display = tokens.every(function(t) { return hay.includes(t); }) ? '' : 'none';
  });
}

function wizardPickCatalog(idx) {
  try {
    const item = (window._cpAllItems || [])[idx];
    if (!item) return;
    wizard.data.eph_catalogPick = item;
    wizard.data.eph_year  = item.year  || wizard.data.eph_year  || '';
    wizard.data.eph_title = item.title || wizard.data.eph_title || '';
    setTimeout(function() { wizardNext(); }, 200);
  } catch(e) { console.warn('wizardPickCatalog:', e); }
}

function wizardFilterIS() {
  const input = document.getElementById('ip-input');
  const list  = document.getElementById('ip-list');
  if (!input || !list) return;
  const q = input.value.toLowerCase().trim();
  const btns = list.querySelectorAll('button[data-search]');
  if (!q) { btns.forEach(function(b) { b.style.display = ''; }); return; }
  const tokens = q.split(/\s+/).filter(Boolean);
  btns.forEach(function(btn) {
    const hay = btn.getAttribute('data-search') || '';
    btn.style.display = tokens.every(function(t) { return hay.includes(t); }) ? '' : 'none';
  });
}

function wizardPickIS(idx) {
  try {
    const item = (window._ipAllItems || [])[idx];
    if (!item) return;
    wizard.data.is_pick      = item;
    // Auto-fill sheet number and year if known from master data
    wizard.data.is_sheetNum  = wizard.data.is_sheetNum  || '';
    wizard.data.is_year      = item.year || wizard.data.is_year || '';
    setTimeout(function() { wizardNext(); }, 200);
  } catch(e) { console.warn('wizardPickIS:', e); }
}
function wizardPickSoldItem(key) {
  wizard.data.selectedSoldKey = key;
  if (key !== '__new__') {
    const pd = state.personalData[key];
    if (pd) {
      // Pre-fill condition and original price from collection data
      if (pd.condition && pd.condition !== 'N/A') wizard.data.condition = parseInt(pd.condition);
      if (pd.priceItem && pd.priceItem !== 'N/A') wizard.data.priceItem = pd.priceItem;
    }
  }
  setTimeout(() => wizardNext(), 150);
}

// ── Collection picker in forsale/sold itemNum step ──
// v0.9.745 (Brad): "need to fold group items here in the add to sale list
// steps" — grouped rows (AA/AB/ABA, engine+tender, item+box) collapse to ONE
// row led by the powered unit, with a config chip. Same fold rules as the
// collection table / group detail sheet.
function _wpFoldGroups(entries) {
  var byGid = {}, out = [];
  entries.forEach(function (e) {
    var gid = e[1] && e[1].groupId;
    if (!gid) { e._mates = []; out.push(e); return; }
    (byGid[gid] = byGid[gid] || []).push(e);
  });
  function rank(pd) {
    var n = String(pd.itemNum || ''), t = String(pd.itemType || '');
    if (/-MBOX$/i.test(n)) return 9;
    if (/-BOX$/i.test(n)) return 8;
    if (/-P$/i.test(n) || /steam/i.test(t)) return 0;
    if (/tender/i.test(t)) return 2;
    if (/-D$/i.test(n) || /C$/i.test(n)) return 1;
    return 0;
  }
  Object.keys(byGid).forEach(function (gid) {
    var mem = byGid[gid].slice().sort(function (a, b) { return rank(a[1]) - rank(b[1]); });
    var lead = mem[0];
    lead._mates = mem.slice(1).map(function (x) { return x[1]; });
    out.push(lead);
  });
  return out;
}
function _wpGroupChip(pd, mates) {
  if (!mates || !mates.length) return '';
  var lbl = 'Set';
  try {
    if (typeof window.groupConfigLabel === 'function') {
      lbl = window.groupConfigLabel(pd.itemNum, mates.map(function (m) { return m.itemNum; })) || 'Set';
    }
  } catch (e) {}
  return '<span style="font-size:0.6rem;border:1px solid #7c8db5;color:#7c8db5;border-radius:4px;padding:0 0.3rem;white-space:nowrap">\uD83D\uDD17 ' + lbl + '</span>';
}
function _wpMatchesQ(e, q) {
  if (!q) return true;
  var pd = e[1];
  var hay = [(pd.itemNum || ''), (pd.variation || '')]
    .concat((e._mates || []).map(function (m) { return m.itemNum || ''; }))
    .join(' ').toLowerCase();
  return hay.includes(q);
}

// v0.9.746 (Brad): sell-step picker IS the browser — Maker/Era/Type/Scale
// filters over the OWNED list ("its in a tote somewhere and they don't want
// to go get it"). Options derive from what the user actually owns.
// v0.9.747: personal rows mostly carry an EMPTY Item Type (the catalog knows,
// the row doesn't) — resolve the MASTER first, bucket that. Manual rows and
// unresolvable cross-era rows fall back to the pd itself.
function _wpBucketOf(pd) {
  try {
    var src = pd;
    if (String(pd.era || '') !== 'Manual' && typeof findMaster === 'function') {
      var m = findMaster(pd.itemNum, pd.variation || '', pd);
      if (m) src = m;
    }
    if (src === pd && !pd.itemType && pd.masterDescription) src = { itemNum: pd.itemNum, itemType: '', description: pd.masterDescription };
    return (typeof getTypeBucket === 'function') ? getTypeBucket(src) : (src.itemType || '');
  } catch (e) { return ''; }
}
function _wpSellFilterRow(onchangeJs) {   // v0.9.750: reused by the upgrade picker with its own callback
  try {
    var _oc = onchangeJs || "_filterCollPicker((document.getElementById('wiz-input')||{}).value||'')";
    var makers = {}, types = {}, scales = {};
    Object.values(state.personalData || {}).forEach(function (pd) {
      if (!pd || !pd.owned) return;
      var mf = pd.manufacturer || ((typeof ERAS !== 'undefined' && ERAS[pd.era]) ? ERAS[pd.era].manufacturer : '');
      if (mf) makers[mf] = 1;
      try { var b = _wpBucketOf(pd); if (b) types[b] = 1; } catch (e) {}
      var sc = pd.gauge || ((typeof ERA_SCALE !== 'undefined') ? ERA_SCALE[String(pd.era || '').toLowerCase()] : '');
      if (sc) scales[String(sc).toUpperCase() === 'O27' ? 'O' : sc] = 1;
    });
    var lbl = function (id) {
      if (typeof TYPE_BUCKETS !== 'undefined') for (var i = 0; i < TYPE_BUCKETS.length; i++) if (TYPE_BUCKETS[i].id === id) return TYPE_BUCKETS[i].label;
      return id;
    };
    var ss = 'flex:1;padding:0.4rem 0.45rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-size:0.78rem;min-width:0;font-family:var(--font-body)';
    var sel = function (id, ph, opts) {
      return '<select id="' + id + '" onchange="' + _oc.replace(/"/g, '&quot;') + '" style="' + ss + '"><option value="">' + ph + '</option>'
        + opts.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('') + '</select>';
    };
    return '<div style="display:flex;gap:0.35rem;margin-bottom:0.45rem;flex-wrap:wrap">'
      + sel('wp-f-mfr', 'Maker', Object.keys(makers).sort().map(function (m) { return [m, m]; }))
      + sel('wp-f-era', 'Era', [['prewar', 'Prewar'], ['pw', 'Postwar'], ['modern', 'Modern']])
      + sel('wp-f-type', 'Type', Object.keys(types).sort().map(function (t) { return [t, lbl(t)]; }))
      + sel('wp-f-scale', 'Scale', Object.keys(scales).sort().map(function (s) { return [s, s]; }))
      + '</div>';
  } catch (e) { return ''; }
}
function _wpSellFilterPass(e) {
  var pd = e[1];
  var v = function (id) { var el = document.getElementById(id); return el ? el.value : ''; };
  var mfr = v('wp-f-mfr'), era = v('wp-f-era'), typ = v('wp-f-type'), sc = v('wp-f-scale');
  if (mfr) {
    var pm = pd.manufacturer || ((typeof ERAS !== 'undefined' && ERAS[pd.era]) ? ERAS[pd.era].manufacturer : '');
    if (String(pm || '') !== mfr) return false;
  }
  if (era) {
    var pe = String(pd.era || '');
    if (!pe || pe === 'Manual') return false;
    var g = pe === 'prewar' ? 'prewar' : (pe === 'pw' ? 'pw' : 'modern');
    if (g !== era) return false;
  }
  if (typ) { try { if (_wpBucketOf(pd) !== typ) return false; } catch (err) {} }
  if (sc) {
    var s2 = String(pd.gauge || ((typeof ERA_SCALE !== 'undefined') ? ERA_SCALE[String(pd.era || '').toLowerCase()] : '') || '').toUpperCase();
    if (s2 === 'O27') s2 = 'O';
    if (s2 !== String(sc).toUpperCase()) return false;
  }
  return true;
}

function _filterCollPicker(q) {
  var el = document.getElementById('wiz-coll-picker');
  if (!el) return;
  q = (q || '').toLowerCase();
  // v0.9.751 (Brad): sold flow — "need a selector for either from the sales
  // list or my collection". FS source lists active listings (folded), shows
  // the asking price, and clicking one routes to the quick record-sale prompt.
  if (typeof wizard !== 'undefined' && wizard.tab === 'sold') {
    var _src = wizard.data._soldPickSrc || (Object.keys(state.forSaleData || {}).length ? 'fs' : 'coll');
    if (_src === 'fs') {
      var fsEntries = Object.keys(state.forSaleData || {}).map(function (k) {
        return state.personalData[k] ? [k, state.personalData[k]] : null;
      }).filter(Boolean);
      var fsFolded = _wpFoldGroups(fsEntries).filter(function (e) { return _wpMatchesQ(e, q) && _wpSellFilterPass(e); });
      fsFolded.sort(function (a, b) { return String(a[1].itemNum || '').localeCompare(String(b[1].itemNum || ''), undefined, { numeric: true }); });
      if (!fsFolded.length) {
        el.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-dim);font-size:0.82rem">' + (q ? 'No matches on your For Sale list' : 'Nothing on your For Sale list \u2014 switch to My Collection above') + '</div>';
        return;
      }
      el.innerHTML = fsFolded.map(function (entry) {
        var pdKey = entry[0], pd = entry[1];
        var fs = state.forSaleData[pdKey] || {};
        var master = (String(pd.era || '') === 'Manual') ? {} : (findMaster(pd.itemNum, (pd.variation || ''), pd) || {});
        return '<div onclick="_selectCollItem(\'' + pdKey.replace(/'/g, "\\'") + '\')" style="display:flex;align-items:center;gap:0.6rem;padding:0.55rem 0.75rem;cursor:pointer;border-bottom:1px solid var(--border)">'
          + '<div style="flex:1;min-width:0">'
          + '<div style="display:flex;align-items:center;gap:0.4rem">'
          + '<span style="font-family:var(--font-mono);font-size:0.88rem;color:var(--accent2);font-weight:600">' + pd.itemNum + '</span>'
          + (pd.variation ? '<span style="font-size:0.68rem;color:var(--text-dim)">V' + pd.variation + '</span>' : '')
          + _wpGroupChip(pd, entry._mates)
          + (fs.askingPrice ? '<span style="font-size:0.68rem;color:#e67e22;font-weight:700;margin-left:auto">ASKING $' + parseFloat(fs.askingPrice).toLocaleString() + '</span>' : '')
          + '</div>'
          + '<div style="font-size:0.72rem;color:var(--text-mid);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'
          + (pd.roadName || master.roadName || master.itemType || pd.description || pd.itemType || '')
          + (fs.dateListed ? ' \u00b7 listed ' + fs.dateListed : '')
          + '</div></div></div>';
      }).join('');
      return;
    }
  }
  var owned = _wpFoldGroups(Object.entries(state.personalData).filter(function(e) { return e[1].owned; }))
    .filter(function (e) { return _wpMatchesQ(e, q) && _wpSellFilterPass(e); });   // v0.9.745 fold + v0.9.746 filters
  // Sort by item number
  owned.sort(function(a,b) { return (a[1].itemNum||'').localeCompare(b[1].itemNum||'', undefined, {numeric:true}); });

  if (owned.length === 0) {
    el.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--text-dim);font-size:0.82rem">' + (q ? 'No matches' : 'No items in collection') + '</div>';
    return;
  }
  var accentColor = wizard.tab === 'forsale' ? '#e67e22' : '#2ecc71';
  var html = '';
  owned.forEach(function(entry) {
    var pdKey = entry[0], pd = entry[1];
    var master = (String(pd.era || '') === 'Manual') ? {} : (findMaster(pd.itemNum, (pd.variation||'')) || {});   // v0.9.731: manual rule
    // v0.9.919: forSaleData is keyed by inventoryId (Phase 3) — the old
    // itemNum|variation lookup always missed, so LISTED never showed.
    var alreadyListed = wizard.tab === 'forsale' ? !!(pd.inventoryId && state.forSaleData[pd.inventoryId]) : false;
    html += '<div onclick="_selectCollItem(\'' + pdKey.replace(/'/g,"\\'") + '\')" style="'
      + 'display:flex;align-items:center;gap:0.6rem;padding:0.55rem 0.75rem;cursor:pointer;'
      + 'border-bottom:1px solid var(--border);transition:background 0.1s;'
      + (alreadyListed ? 'background:rgba(230,126,34,0.05);' : '')
      + '" onmouseenter="this.style.background=\'rgba(232,64,28,0.06)\'" onmouseleave="this.style.background=\'' + (alreadyListed ? 'rgba(230,126,34,0.05)' : '') + '\'">'
      + '<div style="flex:1;min-width:0">'
      + '<div style="display:flex;align-items:center;gap:0.4rem">'
      + '<span style="font-family:var(--font-mono);font-size:0.88rem;color:var(--accent2);font-weight:600">' + pd.itemNum + '</span>'
      + (pd.variation ? '<span style="font-size:0.68rem;color:var(--text-dim)">V' + pd.variation + '</span>' : '')
      + _wpGroupChip(pd, entry._mates)
      + (alreadyListed ? '<span style="font-size:0.6rem;color:#e67e22;font-weight:600;margin-left:auto">LISTED</span>' : '')
      + '</div>'
      + '<div style="font-size:0.72rem;color:var(--text-mid);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'
      + (master.roadName || master.itemType || pd.description || pd.itemType || '')
      + (pd.condition ? ' · C:' + pd.condition : '')
      + (pd.priceItem ? ' · $' + parseFloat(pd.priceItem).toLocaleString() : '')
      + '</div>'
      + '</div>'
      + '</div>';
  });
  el.innerHTML = html;
}

function _selectCollItem(pdKey) {
  var pd = state.personalData[pdKey];
  if (!pd) return;
  var master = (String(pd.era || '') === 'Manual') ? null : findMaster(pd.itemNum, (pd.variation||''), pd);   // v0.9.731: manual rule
  var idx = master ? _masterIdxOf(master) : -1;
  var ov = document.getElementById('pick-fs-overlay');
  if (ov) ov.remove();

  // v0.9.746 (Brad, group Phase 2): route through the SAME group-aware
  // entrypoints the detail page uses — grouped picks get the "as a set or
  // individually?" modal, whole-group sales write every member.
  if (wizard.tab === 'forsale') {
    if (pd.groupId && typeof _checkGroupBeforeForSale === 'function') { _checkGroupBeforeForSale(idx, pdKey); return; }
    listForSaleFromCollection(idx, pdKey);
  } else if (wizard.tab === 'sold') {
    var fsEntry = pd.inventoryId ? state.forSaleData[pd.inventoryId] : null;
    if (fsEntry && typeof markForSaleAsSold === 'function') { markForSaleAsSold(pd.inventoryId, fsEntry.askingPrice || ''); return; }
    if (pd.groupId && typeof _checkSetBeforeAction === 'function') {
      _checkSetBeforeAction(pdKey, idx, function (saleIdx, saleKey) { sellFromCollection(saleIdx, saleKey); });
      return;
    }
    sellFromCollection(idx, pdKey);
  }
}

function _openFullCollPicker() {
  // Reuse showPickFromCollectionForSale but make it work for sold too
  var owned = Object.entries(state.personalData).filter(function(e) { return e[1].owned; });
  if (owned.length === 0) { showToast('No items in your collection yet'); return; }

  var existing = document.getElementById('pick-fs-overlay');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'pick-fs-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;padding:1rem';
  bindOverlayClose(overlay, function() { overlay.remove(); });

  var accentColor = wizard.tab === 'forsale' ? '#e67e22' : '#2ecc71';
  var titleText = wizard.tab === 'forsale' ? 'Pick Item to List' : 'Pick Item to Sell';

  var box = document.createElement('div');
  box.style.cssText = 'background:var(--surface);border:1px solid ' + accentColor + '66;border-radius:16px;max-width:480px;width:100%;position:relative;max-height:85vh;display:flex;flex-direction:column;overflow:hidden';

  var hdr = document.createElement('div');
  hdr.style.cssText = 'padding:1rem 1.25rem;border-bottom:1px solid var(--border);flex-shrink:0;display:flex;align-items:center;justify-content:space-between';
  hdr.innerHTML = '<div style="font-family:var(--font-head);font-size:1rem;color:' + accentColor + '">' + titleText + '</div>'
    + '<button onclick="document.getElementById(\'pick-fs-overlay\').remove()" style="background:none;border:none;color:var(--text-dim);font-size:1.1rem;cursor:pointer">✕</button>';
  box.appendChild(hdr);

  var searchWrap = document.createElement('div');
  searchWrap.style.cssText = 'padding:0.6rem 1.25rem;border-bottom:1px solid var(--border);flex-shrink:0';
  searchWrap.innerHTML = '<input id="pick-full-search" type="text" placeholder="Search item #, road name…" style="width:100%;border:1px solid var(--border);border-radius:7px;padding:0.45rem 0.7rem;background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.85rem;outline:none;box-sizing:border-box" oninput="_renderFullPickList(this.value)">';
  box.appendChild(searchWrap);

  var listWrap = document.createElement('div');
  listWrap.id = 'pick-full-list';
  listWrap.style.cssText = 'flex:1;overflow-y:auto;padding:0.25rem 0;-webkit-overflow-scrolling:touch';
  box.appendChild(listWrap);

  overlay.appendChild(box);
  document.body.appendChild(overlay);
  _renderFullPickList('');
  setTimeout(function() { var s = document.getElementById('pick-full-search'); if(s) s.focus(); }, 100);
}

function _renderFullPickList(q) {
  var listEl = document.getElementById('pick-full-list');
  if (!listEl) return;
  q = (q || '').toLowerCase();
  var owned = _wpFoldGroups(Object.entries(state.personalData).filter(function(e) { return e[1].owned; }))
    .filter(function (e) {   // v0.9.745: fold groups; match lead, mates, or master road/type
      if (_wpMatchesQ(e, q)) return true;
      if (!q) return true;
      var pd = e[1];
      var master = (String(pd.era || '') === 'Manual') ? {} : (findMaster(pd.itemNum, (pd.variation||''), pd) || {});
      return (master.roadName||'').toLowerCase().includes(q)
        || (master.itemType||'').toLowerCase().includes(q);
    });
  owned.sort(function(a,b) { return (a[1].itemNum||'').localeCompare(b[1].itemNum||'', undefined, {numeric:true}); });

  if (owned.length === 0) {
    listEl.innerHTML = '<div class="ui-empty">No matching items</div>';
    return;
  }
  var accentColor = wizard.tab === 'forsale' ? '#e67e22' : '#2ecc71';
  var html = '';
  owned.forEach(function(entry) {
    var pdKey = entry[0], pd = entry[1];
    var master = (String(pd.era || '') === 'Manual') ? {} : (findMaster(pd.itemNum, (pd.variation||'')) || {});   // v0.9.731: manual rule
    // v0.9.919: forSaleData is keyed by inventoryId (Phase 3) and soldData is a
    // per-sale history (Session 176) — the old itemNum|variation lookups always
    // missed, so LISTED/SOLD tags never showed. Check this specific copy by
    // inventoryId instead (per-copy accurate: a re-bought copy isn't "sold").
    var alreadyListed = wizard.tab === 'forsale'
      ? !!(pd.inventoryId && state.forSaleData[pd.inventoryId])
      : _wpCopyHasSale(pd);

    html += '<div onclick="_selectCollItem(\'' + pdKey.replace(/'/g,"\\'") + '\')" style="'
      + 'display:flex;align-items:center;gap:0.7rem;padding:0.7rem 1.25rem;cursor:pointer;'
      + 'border-bottom:1px solid var(--border);transition:background 0.1s;'
      + '" onmouseenter="this.style.background=\'var(--surface2)\'" onmouseleave="this.style.background=\'\'">'
      + '<div style="flex:1;min-width:0">'
      + '<div style="display:flex;align-items:center;gap:0.4rem">'
      + '<span style="font-family:var(--font-mono);font-size:0.92rem;color:var(--accent2);font-weight:600">' + pd.itemNum + '</span>'
      + (pd.variation ? '<span style="font-size:0.7rem;color:var(--text-dim)">Var ' + pd.variation + '</span>' : '')
      + _wpGroupChip(pd, entry._mates)
      + '</div>'
      + '<div style="font-size:0.78rem;color:var(--text-mid);margin-top:0.1rem">'
      + (master.roadName || master.itemType || pd.description || pd.itemType || '')
      + '</div>'
      + '<div style="font-size:0.7rem;color:var(--text-dim);margin-top:0.1rem">'
      + [pd.condition ? 'Cond: ' + pd.condition + '/10' : '', pd.priceItem ? 'Paid: $' + parseFloat(pd.priceItem).toLocaleString() : '', pd.userEstWorth ? 'Worth: $' + parseFloat(pd.userEstWorth).toLocaleString() : ''].filter(Boolean).join(' · ')
      + '</div>'
      + '</div>'
      + (alreadyListed ? '<span style="font-size:0.65rem;color:' + accentColor + ';font-weight:600;flex-shrink:0">' + (wizard.tab === 'forsale' ? 'LISTED' : 'SOLD') + '</span>' : '')
      + '</div>';
  });
  listEl.innerHTML = html;
}

function wizardPickForSaleItem(key) {
  wizard.data.selectedForSaleKey = key;
  if (key === '__new__') {
    // Brad's preference (Session 161+): an item being listed for sale that
    // isn't in the collection should go through the full Add-to-Collection
    // wizard plus a tacked-on Sale Price + Date Listed at the end. On save,
    // the item lands in My Collection AND For Sale.
    var _seedItemNum = (wizard.data.itemNum || '').trim();
    wizard.data._alsoListForSale = true;
    wizard.data._returnPage = wizard.data._returnPage || 'forsale';
    wizard.data.itemCategory = 'lionel';
    wizard.data._itemGrouping = wizard.data._itemGrouping || 'single';
    wizard.data.entryMode = wizard.data.entryMode || 'full';
    // Swap to collection flow
    wizard.tab = 'collection';
    wizard.steps = getSteps('collection');
    wizard.step = 0;
    // Use the seed item# to infer era so the wizard skips the era picker.
    // DON'T pre-pin wizard.matchedItem — that would constrain the variation
    // step's lookup to one specific itemType+roadName combo and skip variation
    // selection. Let the user pick the variation organically.
    if (_seedItemNum) {
      wizard.data._rawItemNum = _seedItemNum;
      var _m = (typeof findMaster === 'function') ? findMaster(_seedItemNum) : null;
      if (_m) {
        var _inferredEra = (typeof eraForTab === 'function') ? eraForTab(_m._tab) : null;
        if (_inferredEra) wizard.data._era = _inferredEra;
      }
    }
    if (typeof renderWizardStep === 'function') renderWizardStep();
    return;
  }
  const pd = state.personalData[key];
  if (pd) {
    if (pd.condition && pd.condition !== 'N/A') wizard.data.condition = parseInt(pd.condition);
    if (pd.priceItem && pd.priceItem !== 'N/A') wizard.data.originalPrice = pd.priceItem;
    if (pd.userEstWorth) wizard.data.estWorth = pd.userEstWorth;
  }
  setTimeout(() => wizardNext(), 150);
}

function wizardPickRow(key) {
  wizard.data.selectedRowKey = key;
  setTimeout(() => wizardNext(), 150);
}
