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
function _filterCollPicker(q) {
  var el = document.getElementById('wiz-coll-picker');
  if (!el) return;
  q = (q || '').toLowerCase();
  var owned = Object.entries(state.personalData).filter(function(e) {
    if (!e[1].owned) return false;
    if (!q) return true;
    var pd = e[1];
    return (pd.itemNum||'').toLowerCase().includes(q)
      || (pd.variation||'').toLowerCase().includes(q);
  });
  // Sort by item number
  owned.sort(function(a,b) { return (a[1].itemNum||'').localeCompare(b[1].itemNum||'', undefined, {numeric:true}); });

  if (owned.length === 0) {
    el.innerHTML = '<div style="padding:1rem;text-align:center;color:var(--text-dim);font-size:0.82rem">' + (q ? 'No matches' : 'No items in collection') + '</div>';
    return;
  }
  var accentColor = wizard.tab === 'forsale' ? '#e67e22' : '#2ecc71';
  var html = '';
  owned.forEach(function(entry) {
    var pdKey = entry[0], pd = entry[1];
    var master = findMaster(pd.itemNum, (pd.variation||'')) || {};
    var alreadyListed = wizard.tab === 'forsale' ? !!state.forSaleData[pd.itemNum + '|' + (pd.variation||'')] : false;
    html += '<div onclick="_selectCollItem(\'' + pdKey.replace(/'/g,"\\'") + '\')" style="'
      + 'display:flex;align-items:center;gap:0.6rem;padding:0.55rem 0.75rem;cursor:pointer;'
      + 'border-bottom:1px solid var(--border);transition:background 0.1s;'
      + (alreadyListed ? 'background:rgba(230,126,34,0.05);' : '')
      + '" onmouseenter="this.style.background=\'rgba(232,64,28,0.06)\'" onmouseleave="this.style.background=\'' + (alreadyListed ? 'rgba(230,126,34,0.05)' : '') + '\'">'
      + '<div style="flex:1;min-width:0">'
      + '<div style="display:flex;align-items:center;gap:0.4rem">'
      + '<span style="font-family:var(--font-mono);font-size:0.88rem;color:var(--accent2);font-weight:600">' + pd.itemNum + '</span>'
      + (pd.variation ? '<span style="font-size:0.68rem;color:var(--text-dim)">V' + pd.variation + '</span>' : '')
      + (alreadyListed ? '<span style="font-size:0.6rem;color:#e67e22;font-weight:600;margin-left:auto">LISTED</span>' : '')
      + '</div>'
      + '<div style="font-size:0.72rem;color:var(--text-mid);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'
      + (master.roadName || master.itemType || '')
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
  var master = findMaster(pd.itemNum, (pd.variation||''));
  var idx = master ? state.masterData.indexOf(master) : -1;

  if (wizard.tab === 'forsale') {
    // Close any full picker overlay
    var ov = document.getElementById('pick-fs-overlay');
    if (ov) ov.remove();
    listForSaleFromCollection(idx, pdKey);
  } else if (wizard.tab === 'sold') {
    var ov2 = document.getElementById('pick-fs-overlay');
    if (ov2) ov2.remove();
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
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

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
  var owned = Object.entries(state.personalData).filter(function(e) {
    if (!e[1].owned) return false;
    if (!q) return true;
    var pd = e[1];
    var master = findMaster(pd.itemNum, (pd.variation||'')) || {};
    return (pd.itemNum||'').toLowerCase().includes(q)
      || (master.roadName||'').toLowerCase().includes(q)
      || (master.itemType||'').toLowerCase().includes(q)
      || (pd.variation||'').toLowerCase().includes(q);
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
    var master = findMaster(pd.itemNum, (pd.variation||'')) || {};
    var fsKey = pd.itemNum + '|' + (pd.variation||'');
    var alreadyListed = wizard.tab === 'forsale' ? !!state.forSaleData[fsKey] : !!state.soldData[fsKey];

    html += '<div onclick="_selectCollItem(\'' + pdKey.replace(/'/g,"\\'") + '\')" style="'
      + 'display:flex;align-items:center;gap:0.7rem;padding:0.7rem 1.25rem;cursor:pointer;'
      + 'border-bottom:1px solid var(--border);transition:background 0.1s;'
      + '" onmouseenter="this.style.background=\'var(--surface2)\'" onmouseleave="this.style.background=\'\'">'
      + '<div style="flex:1;min-width:0">'
      + '<div style="display:flex;align-items:center;gap:0.4rem">'
      + '<span style="font-family:var(--font-mono);font-size:0.92rem;color:var(--accent2);font-weight:600">' + pd.itemNum + '</span>'
      + (pd.variation ? '<span style="font-size:0.7rem;color:var(--text-dim)">Var ' + pd.variation + '</span>' : '')
      + '</div>'
      + '<div style="font-size:0.78rem;color:var(--text-mid);margin-top:0.1rem">'
      + (master.roadName || master.itemType || '')
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
  if (key !== '__new__') {
    const pd = state.personalData[key];
    if (pd) {
      if (pd.condition && pd.condition !== 'N/A') wizard.data.condition = parseInt(pd.condition);
      if (pd.priceItem && pd.priceItem !== 'N/A') wizard.data.originalPrice = pd.priceItem;
      if (pd.userEstWorth) wizard.data.estWorth = pd.userEstWorth;
    }
  }
  setTimeout(() => wizardNext(), 150);
}

function wizardPickRow(key) {
  wizard.data.selectedRowKey = key;
  setTimeout(() => wizardNext(), 150);
}
