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
    const val = item.estValue ? '$' + parseFloat(item.estValue).toLocaleString() : '';
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

function openEphemeraDetail(tabId, rowKey) {
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
    ['Est. Value',        item.estValue ? '$' + parseFloat(item.estValue).toLocaleString() : '—'],
    ['Date Acquired',     item.dateAcquired || '—'],
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
    ['Est. Value', item.estValue ? '$' + parseFloat(item.estValue).toLocaleString() : '—'],
    ['Date Acquired', item.dateAcquired || '—'],
    ['Notes', item.notes || '—'],
  ] : [
    ['Title', item.title],
    ['Description', item.description || '—'],
    ['Year', item.year || '—'],
    ['Manufacturer', item.manufacturer || 'Lionel'],
    ['Condition', item.condition ? item.condition + '/10' : '—'],
    ['Quantity', item.quantity || '1'],
    ['Est. Value', item.estValue ? '$' + parseFloat(item.estValue).toLocaleString() : '—'],
    ['Date Acquired', item.dateAcquired || '—'],
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
        <button onclick="ephemeraForSale('${tabId}',${rowKey});this.closest('.modal-overlay').remove()" style="flex:1;padding:0.6rem;border-radius:8px;border:1.5px solid #f39c12;color:#f39c12;background:rgba(243,156,18,0.1);cursor:pointer;font-family:var(--font-body);font-weight:600">🏷️ For Sale</button>
        <button onclick="ephemeraSold('${tabId}',${rowKey});this.closest('.modal-overlay').remove()" style="flex:1;padding:0.6rem;border-radius:8px;border:1.5px solid #2ecc71;color:#2ecc71;background:rgba(46,204,113,0.1);cursor:pointer;font-family:var(--font-body);font-weight:600">💰 Sold</button>
        <button onclick="ephemeraDelete('${tabId}',${rowKey});this.closest('.modal-overlay').remove()" style="padding:0.6rem 0.8rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);cursor:pointer;font-family:var(--font-body)" title="Delete">🗑</button>
        <button onclick="this.closest('.modal-overlay').remove()" style="padding:0.6rem 0.8rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);cursor:pointer;font-family:var(--font-body)">Close</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

// ── Ephemera Actions ─────────────────────────────────────────────

const _ephTabNames  = { catalogs:'Catalogs', paper:'Paper Items', mockups:'Mock-Ups', other:'Other Lionel' };
const _ephTabCols   = { catalogs:'I', paper:'J', mockups:'O', other:'J' };

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
          style="flex:2;padding:0.65rem;border-radius:8px;border:none;background:#f39c12;color:white;font-family:var(--font-body);font-weight:600;cursor:pointer">🏷️ List For Sale</button>
      </div>
    </div>`;
  document.body.appendChild(ov);

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
      _getEraManufacturer(),       // manufacturer
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

  document.getElementById('eph-sold-save').onclick = async () => {
    const salePrice = document.getElementById('eph-sold-price').value;
    const dateSold  = document.getElementById('eph-sold-date').value;
    const removeIt  = document.getElementById('eph-rm-yes').checked;
    ov.remove();
    // Write to Sold sheet: Item#, Variation, Copy#, Condition, PricePaid, SalePrice, DateSold, Notes
    const row = [
      item.itemNum || label,
      '',          // variation
      '1',         // copy
      item.condition || '',
      item.estValue || '',
      salePrice,
      dateSold,
      title,       // notes = title as description
      '',          // inventory ID (not applicable for ephemera)
      _getEraManufacturer(),  // manufacturer
    ];
    try {
      await sheetsAppend(state.personalSheetId, 'Sold!A:J', [row]);
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
  const _ws = state._wantSort || 'priority';
  // Sync dropdowns with state
  const _wpEl = document.getElementById('want-priority-filter');
  if (_wpEl && _wpEl.value !== _wp) _wpEl.value = _wp;
  const _wtEl = document.getElementById('want-type-filter');
  if (_wtEl && _wtEl.value !== _wt) _wtEl.value = _wt;
  const _wsEl = document.getElementById('want-sort');
  if (_wsEl && _wsEl.value !== _ws) _wsEl.value = _ws;
  const totalCount = Object.keys(state.wantData).length;
  const entries = Object.values(state.wantData).filter(w => {
    // Priority filter
    if (_wp && (w.priority || 'Medium') !== _wp) return false;
    // Type filter — lookup master to get item type
    if (_wt) {
      const _setMatch = _wt === 'Set' && state.setData && state.setData.find(s => s.setNum === w.itemNum);
      if (_wt === 'Set' && !_setMatch) return false;
      if (_wt !== 'Set') {
        const _master = findMaster(w.itemNum);
        if (!_master || (_master.itemType || '') !== _wt) return false;
      }
    }
    // Text search
    if (_wq) {
      const master = state.masterData.find(m => m.itemNum === w.itemNum && (!w.variation || m.variation === w.variation)) || {};
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
  // Count display
  const countEl = document.getElementById('want-count');
  if (countEl) {
    countEl.textContent = entries.length === totalCount
      ? totalCount + ' item' + (totalCount !== 1 ? 's' : '')
      : 'Showing ' + entries.length + ' of ' + totalCount;
  }
  // Keep nav count badge in sync
  const countBadge = document.getElementById('nav-wanted2');
  if (countBadge) countBadge.textContent = totalCount.toLocaleString();
  const cardsEl = document.getElementById('want-cards');
  const tableEl = document.getElementById('want-table');
  const tbody   = document.getElementById('want-tbody');
  const priorityColor = { High: 'var(--accent)', Medium: 'var(--accent2)', Low: 'var(--text-dim)' };

  if (entries.length === 0) {
    const hasFilters = _wq || _wp || _wt;
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
    cardsEl.innerHTML = entries.map(w => {
      const master = state.masterData.find(m => m.itemNum === w.itemNum && (!w.variation || m.variation === w.variation));
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
      return `<div id="share-card-${_wShareKey}" style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:0.85rem 1rem${_wSelected ? ';outline:2px solid #3a9e68' : ''}">
        <div style="display:flex;align-items:center;gap:0.75rem;cursor:pointer" onclick="${_wInShare ? 'toggleShareItem(\'' + _wShareKey + '\')' : (masterIdx2>=0?'openItem('+masterIdx2+')':'')}">
          ${_wInShare ? '<input type="checkbox" id="share-cb-' + _wShareKey + '" ' + (_wSelected ? 'checked' : '') + ' onclick="event.stopPropagation();toggleShareItem(\'' + _wShareKey + '\')" style="width:1.1rem;height:1.1rem;accent-color:#3a9e68;flex-shrink:0">' : ''}
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:0.5rem">
              <span style="font-family:var(--font-head);font-size:1.1rem;color:var(--accent)">${w.itemNum}</span>
              ${_mIsSet ? '<span style="font-size:0.62rem;color:#e67e22;font-weight:600">SET</span>' : (w.variation ? `<span style="font-size:0.72rem;color:var(--text-dim)">${w.variation}</span>` : '')}
              <span style="font-size:0.65rem;font-weight:600;color:${pColor};border:1px solid ${pColor};border-radius:4px;padding:0.1rem 0.4rem">${w.priority || 'Medium'}</span>
            </div>
            ${_mIsSet ? (_mSetLabel ? `<div style="font-size:0.82rem;color:var(--text);margin-top:0.15rem">${_mSetLabel}</div>` : '') + _mChipsHtml : (name ? `<div style="font-size:0.82rem;color:var(--text);margin-top:0.15rem">${name}</div>` : '')}
            ${w.notes ? `<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.15rem">${w.notes}</div>` : ''}
          </div>
          <div style="text-align:right;flex-shrink:0">
            ${w.expectedPrice ? `<div style="font-family:var(--font-mono);color:var(--accent2);font-size:0.9rem">$${parseFloat(w.expectedPrice).toLocaleString()}</div>` : ''}
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
    tbody.innerHTML = entries.map((w, idx) => {
      const master = state.masterData.find(m => m.itemNum === w.itemNum && (!w.variation || m.variation === w.variation));
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

      const refLink = master ? (master.refLink || '') : '';
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
      return `<tr id="share-card-${_wDShareKey}" ${_wDInShare ? 'onclick="toggleShareItem(\'' + _wDShareKey + '\')"' : ''} style="cursor:${_wDInShare ? 'pointer' : 'default'}${_wDSelected ? ';outline:2px solid #3a9e68;background:rgba(58,158,104,0.06)' : ''}">
        <td><span class="item-num">${_wDInShare ? '<input type="checkbox" id="share-cb-' + _wDShareKey + '" ' + (_wDSelected ? 'checked' : '') + ' onclick="event.stopPropagation();toggleShareItem(\'' + _wDShareKey + '\')" style="width:1rem;height:1rem;accent-color:#3a9e68;margin-right:5px;vertical-align:middle">' : ''}${w.itemNum}</span>${_isSet ? ' <span style="font-size:0.62rem;color:#e67e22;font-weight:600;vertical-align:middle">SET</span>' : ''}</td>
        <td>${_displayRoad || '<span class="text-dim">—</span>'}</td>
        <td>${_isSet ? '<span class="text-dim">—</span>' : (w.variation || '<span class="text-dim">—</span>')}</td>
        <td>${varCell}</td>
        <td><span style="color:${pColor};font-weight:500">${w.priority || 'Medium'}</span></td>
        <td class="market-val">${w.expectedPrice ? '$' + parseFloat(w.expectedPrice).toLocaleString() : '<span class="text-dim">—</span>'}</td>
        <td style="white-space:nowrap">
          ${!_wDInShare ? `<button onclick="moveWantToCollection('${w.itemNum}','${(w.variation||'').replace(/'/g,"\\'")}')" style="padding:0.3rem 0.5rem;border-radius:5px;font-size:0.72rem;cursor:pointer;border:1px solid #2ecc71;background:rgba(46,204,113,0.12);color:#2ecc71;font-family:var(--font-body);margin-right:0.25rem" title="Add to My Collection">+ Collection</button>
          <button onclick="wantFindOnEbay('${w.itemNum}','${(roadName||'').replace(/'/g,"\\'")}')" style="padding:0.3rem 0.5rem;border-radius:5px;font-size:0.72rem;cursor:pointer;border:1px solid #e67e22;background:rgba(230,126,34,0.12);color:#e67e22;font-family:var(--font-body);margin-right:0.25rem" title="Search eBay">eBay</button>
          <button onclick="wantSearchOtherSites('${w.itemNum}','${(roadName||'').replace(/'/g,"\\'")}')" style="padding:0.3rem 0.5rem;border-radius:5px;font-size:0.72rem;cursor:pointer;border:1px solid #2980b9;background:rgba(41,128,185,0.12);color:#2980b9;font-family:var(--font-body);margin-right:0.25rem" title="Search other auction sites">Search</button>
          <button onclick="removeWantItem('${w.itemNum}','${(w.variation||'').replace(/'/g,"\\'")}',${w.row})" style="padding:0.3rem 0.5rem;border-radius:5px;font-size:0.72rem;cursor:pointer;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body)" title="Remove from Want List">Remove</button>` : ''}
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
}

// ── Want List Actions ──────────────────────────────────────────
async function removeWantItem(itemNum, variation, row) {
  if (!(await appConfirm('Remove this item from your Want List?', { danger: true, ok: 'Remove' }))) return;
  const key = `${itemNum}|${variation}`;
  if (row) {
    await sheetsUpdate(state.personalSheetId, `Want List!A${row}:F${row}`, [['','','','','','']]);
  }
  delete state.wantData[key];
  _cachePersonalData();
  buildWantPage();
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
    const master = state.masterData.find(m =>
      m.itemNum === itemNum && (!variation || String(m.variation||'') === String(variation))
    ) || findMaster(itemNum);

    // Seed everything we know
    wizard.data._fromWantList = true;
    wizard.data._fromWantKey = `${itemNum}|${variation}`;
    wizard.data._rawItemNum = itemNum;
    wizard.data.itemNum = itemNum;
    if (variation) wizard.data.variation = variation;
    wizard.data.itemCategory = 'lionel';      // skips era picker
    wizard.data._itemGrouping = wizard.data._itemGrouping || 'single'; // default; user can change later via Edit Group
    wizard.data.entryMode = wizard.data.entryMode || 'full'; // skips entryMode picker

    if (master) {
      wizard.matchedItem = master;
      // Infer era so the later save writes to the right era sheet
      if (!wizard.data._era) {
        var _tab = String(master._tab || '').toLowerCase();
        if (_tab.includes('mpc') || _tab.includes('modern')) wizard.data._era = 'mod';
        else if (_tab.includes('pre-war') || _tab.includes('prewar')) wizard.data._era = 'prewar';
        else wizard.data._era = 'pw';
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

  // Enrich with master data
  let soldEntries = Object.values(state.soldData).map(sd => {
    const master = state.masterData.find(i => i.itemNum === sd.itemNum && i.variation === sd.variation) || {};
    return { ...sd, _type: master.itemType || '', _roadName: master.roadName || '', _master: master };
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
      va = a.dateSold || ''; vb = b.dateSold || '';
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
  ['itemNum','type','roadName','condition','salePrice','dateSold'].forEach(function(col) {
    var el = document.getElementById('sold-sort-i-' + col);
    if (el) el.textContent = sf === col ? (state._soldSortDir === 'asc' ? '▲' : '▼') : '';
  });

  // Sync dropdown
  var sortSel = document.getElementById('sold-sort-field');
  if (sortSel) sortSel.value = sf;

  // Summary stats
  const totalRevenue = soldEntries.reduce((sum, sd) => sum + (parseFloat(sd.salePrice) || 0), 0);
  const countEl = document.getElementById('sold-stat-count');
  const totalEl = document.getElementById('sold-stat-total');
  if (countEl) countEl.textContent = soldEntries.length.toLocaleString();
  if (totalEl) totalEl.textContent = totalRevenue > 0 ? '$' + Math.round(totalRevenue).toLocaleString() : '$0';

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
      return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:0.85rem 1rem">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <span style="font-family:var(--font-head);font-size:1.1rem;color:var(--accent)">${sd.itemNum}</span>
            ${sd.variation ? `<span style="font-size:0.72rem;color:var(--text-dim);margin-left:0.4rem">${sd.variation}</span>` : ''}
            ${sd._roadName ? `<div style="font-size:0.82rem;color:var(--text);margin-top:0.1rem">${sd._roadName}</div>` : ''}
            <div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.15rem">${[sd._type, sd.condition ? 'Cond: '+sd.condition : '', sd.dateSold].filter(Boolean).join(' · ')}</div>
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
      return `<tr>
        <td><span class="item-num">${sd.itemNum}</span></td>
        <td><span class="tag">${sd._type || '—'}</span></td>
        <td>${sd._roadName || '—'}</td>
        <td>${sd.variation || '—'}</td>
        <td>${sd.condition || '—'}</td>
        <td class="market-val">${sd.salePrice ? '$' + parseFloat(sd.salePrice).toLocaleString() : '—'}</td>
        <td class="text-dim">${sd.dateSold || '—'}</td>
      </tr>`;
    }).join('') : '<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">💰</div><p>No sold items yet</p></div></td></tr>';
  }

  var _ns = document.getElementById('nav-sold'); if (_ns) _ns.textContent = Object.keys(state.soldData).length;
}

function clearPageSearch(name) {
  const map = { browse: 'browse-search', sold: 'sold-search', want: 'want-search' };
  const el = document.getElementById(map[name]);
  // Don't clear — keep search term when returning to same page
}

function buildForSalePage() {
  // Contextual hint for empty For Sale List
  if (typeof maybeShowContextualHint === 'function' && Object.keys(state.forSaleData || {}).length === 0) {
    var _fpcAnchor = document.getElementById('forsale-page') || document.querySelector('.page-forsale');
    if (_fpcAnchor) maybeShowContextualHint('forsale_empty', '<strong>For Sale List</strong> tracks items you\'re selling. From My Collection, click <em>Add to For Sale</em> on any item to list it.', _fpcAnchor);
  }
  const _fq = (state._forsaleSearch || '').toLowerCase();
  const fsEntries = Object.values(state.forSaleData).filter(fs => {
    if (!_fq) return true;
    const master = state.masterData.find(i => i.itemNum === fs.itemNum && i.variation === fs.variation) || {};
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
  if (totalEl) totalEl.textContent = totalAsking > 0 ? '$' + Math.round(totalAsking).toLocaleString() : '$0';

  const isMobileFs = window.innerWidth <= 640;
  const fsCardsEl = document.getElementById('forsale-cards');
  const fsTableWrap = document.getElementById('forsale-table-wrap');
  const tbody = document.getElementById('forsale-tbody');

  if (isMobileFs) {
    if (fsCardsEl) fsCardsEl.style.display = 'flex';
    if (fsTableWrap) fsTableWrap.style.display = 'none';
    if (fsCardsEl) fsCardsEl.innerHTML = fsEntries.length ? fsEntries.map(fs => {
      const master = state.masterData.find(i => i.itemNum === fs.itemNum && i.variation === fs.variation) || {};
      const collPd = state.personalData[fs.itemNum + '|' + (fs.variation||'')] || {};
      const estWorth = fs.estWorth || collPd.userEstWorth || '';
      const _fsShareKey = fs.itemNum + '|' + (fs.variation||'') + '|' + (fs.row||0);
      const _fsInShare = typeof isShareMode === 'function' && isShareMode('forsale');
      const _fsSelected = _fsInShare && window._shareItems && window._shareItems[_fsShareKey];
      if (_fsInShare) { if (!window._shareDataMap) window._shareDataMap = {}; window._shareDataMap[_fsShareKey] = { itemNum: fs.itemNum, variation: fs.variation||'', fs: fs, master: master }; }
      return `<div id="share-card-${_fsShareKey}" style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:0.85rem 1rem${_fsSelected ? ';outline:2px solid #3a9e68' : ''}" ${_fsInShare ? 'onclick="toggleShareItem(\'' + _fsShareKey + '\')"' : ''}>
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div style="display:flex;align-items:flex-start;gap:0.5rem">
            ${_fsInShare ? '<input type="checkbox" id="share-cb-' + _fsShareKey + '" ' + (_fsSelected ? 'checked' : '') + ' onclick="event.stopPropagation();toggleShareItem(\'' + _fsShareKey + '\')" style="width:1.1rem;height:1.1rem;accent-color:#3a9e68;flex-shrink:0;margin-top:0.2rem">' : ''}
            <div>
              <span style="font-family:var(--font-head);font-size:1.1rem;color:var(--accent)">${fs.itemNum}</span>
              ${fs.variation ? `<span style="font-size:0.72rem;color:var(--text-dim);margin-left:0.4rem">${fs.variation}</span>` : ''}
              ${master.roadName ? `<div style="font-size:0.82rem;color:var(--text);margin-top:0.1rem">${master.roadName}</div>` : ''}
              <div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.15rem">${[master.itemType, fs.condition ? 'Cond: '+fs.condition : '', fs.dateListed ? 'Listed: '+fs.dateListed : ''].filter(Boolean).join(' · ')}</div>
              ${estWorth ? `<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.1rem">Est. Worth: $${parseFloat(estWorth).toLocaleString()}</div>` : ''}
              ${fs.notes ? `<div style="font-size:0.72rem;color:var(--text-mid);margin-top:0.15rem;font-style:italic">${fs.notes.length > 60 ? fs.notes.substring(0,57)+'…' : fs.notes}</div>` : ''}
            </div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            ${fs.askingPrice ? `<div style="font-family:var(--font-mono);color:#e67e22;font-size:1.1rem;font-weight:600">$${parseFloat(fs.askingPrice).toLocaleString()}</div>` : '<div style="color:var(--text-dim);font-size:0.8rem">No price</div>'}
          </div>
        </div>
        ${!_fsInShare ? `<div style="display:flex;gap:0.4rem;margin-top:0.6rem;flex-wrap:wrap">
          <button onclick="markForSaleAsSold('${fs.itemNum}','${(fs.variation||'').replace(/'/g,"\\'")}','${fs.askingPrice||''}')" style="flex:1;padding:0.4rem;border-radius:7px;font-size:0.78rem;cursor:pointer;border:1.5px solid #2ecc71;background:rgba(46,204,113,0.12);color:#2ecc71;font-family:var(--font-body);font-weight:600">Mark as Sold</button>
          <button onclick="removeForSaleItem('${fs.itemNum}','${(fs.variation||'').replace(/'/g,"\\'")}',${fs.row})" style="flex:1;padding:0.4rem;border-radius:7px;font-size:0.78rem;cursor:pointer;border:1.5px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body)">Back to Collection</button>
          <button onclick="removeForSaleAndCollection('${fs.itemNum}','${(fs.variation||'').replace(/'/g,"\\'")}',${fs.row})" style="flex:0 0 auto;padding:0.4rem 0.6rem;border-radius:7px;font-size:0.78rem;cursor:pointer;border:1.5px solid #e74c3c;background:rgba(231,76,60,0.10);color:#e74c3c;font-family:var(--font-body)">Remove</button>
        </div>` : ''}
      </div>`;
    }).join('') : '<div style="text-align:center;padding:3rem 1rem;color:var(--text-dim)"><div style="font-size:2.5rem;margin-bottom:0.5rem">🏷️</div><p>No items listed for sale</p></div>';
  } else {
    if (fsCardsEl) fsCardsEl.style.display = 'none';
    if (fsTableWrap) fsTableWrap.style.display = '';
    if (tbody) tbody.innerHTML = fsEntries.length ? fsEntries.map(fs => {
      const master = state.masterData.find(i => i.itemNum === fs.itemNum && i.variation === fs.variation) || {};
      const collPd = state.personalData[fs.itemNum + '|' + (fs.variation||'')] || {};
      const estWorth = fs.estWorth || collPd.userEstWorth || '';
      const _fsDShareKey = fs.itemNum + '|' + (fs.variation||'') + '|' + (fs.row||0);
      const _fsDInShare = typeof isShareMode === 'function' && isShareMode('forsale');
      const _fsDSelected = _fsDInShare && window._shareItems && window._shareItems[_fsDShareKey];
      if (_fsDInShare) { if (!window._shareDataMap) window._shareDataMap = {}; window._shareDataMap[_fsDShareKey] = { itemNum: fs.itemNum, variation: fs.variation||'', fs: fs, master: master }; }
      return `<tr id="share-card-${_fsDShareKey}" ${_fsDInShare ? 'onclick="toggleShareItem(\'' + _fsDShareKey + '\')"' : ''} style="cursor:${_fsDInShare ? 'pointer' : 'default'}${_fsDSelected ? ';outline:2px solid #3a9e68;background:rgba(58,158,104,0.06)' : ''}">
        <td><span class="item-num">${_fsDInShare ? '<input type="checkbox" id="share-cb-' + _fsDShareKey + '" ' + (_fsDSelected ? 'checked' : '') + ' onclick="event.stopPropagation();toggleShareItem(\'' + _fsDShareKey + '\')" style="width:1rem;height:1rem;accent-color:#3a9e68;margin-right:5px;vertical-align:middle">' : ''}${fs.itemNum}</span>${fs.variation ? ' <span style="font-size:0.72rem;color:var(--text-dim)">' + fs.variation + '</span>' : ''}</td>
        <td><span class="tag">${master.itemType || '—'}</span></td>
        <td>${master.roadName || '—'}</td>
        <td>${fs.condition || '—'}</td>
        <td class="market-val" style="color:#e67e22">${fs.askingPrice ? '$' + parseFloat(fs.askingPrice).toLocaleString() : '—'}</td>
        <td class="text-dim">${estWorth ? '$' + parseFloat(estWorth).toLocaleString() : '—'}</td>
        <td class="text-dim">${fs.dateListed || '—'}</td>
        <td style="white-space:nowrap">
          ${!_fsDInShare ? `<button onclick="markForSaleAsSold('${fs.itemNum}','${(fs.variation||'').replace(/'/g,"\\'")}','${fs.askingPrice||''}')" style="padding:0.3rem 0.5rem;border-radius:5px;font-size:0.72rem;cursor:pointer;border:1px solid #2ecc71;background:rgba(46,204,113,0.12);color:#2ecc71;font-family:var(--font-body);margin-right:0.3rem">Mark as Sold</button>
          <button onclick="removeForSaleItem('${fs.itemNum}','${(fs.variation||'').replace(/'/g,"\\'")}',${fs.row})" style="padding:0.3rem 0.5rem;border-radius:5px;font-size:0.72rem;cursor:pointer;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body);margin-right:0.3rem">Back to Collection</button>
          <button onclick="removeForSaleAndCollection('${fs.itemNum}','${(fs.variation||'').replace(/'/g,"\\'")}',${fs.row})" style="padding:0.3rem 0.5rem;border-radius:5px;font-size:0.72rem;cursor:pointer;border:1px solid #e74c3c;background:rgba(231,76,60,0.10);color:#e74c3c;font-family:var(--font-body)">Remove</button>` : ''}
        </td>
      </tr>`;
    }).join('') : '<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">🏷️</div><p>No items listed for sale</p></div></td></tr>';
  }

  const navBadge = document.getElementById('nav-forsale');
  if (navBadge) navBadge.textContent = fsEntries.length;
}

async function markForSaleAsSold(itemNum, variation, askingPrice) {
  const salePrice = prompt('Sale price? (leave blank for asking price)', askingPrice || '');
  if (salePrice === null) return; // cancelled
  const dateSold = new Date().toISOString().split('T')[0];
  const fsKey = `${itemNum}|${variation}`;
  const fs = state.forSaleData[fsKey] || {};

  // Write to Sold tab
  const soldRow = [
    itemNum, variation, '1',
    fs.condition || '',
    fs.originalPrice || '',
    salePrice || askingPrice || '',
    dateSold,
    fs.notes || '',
    fs.inventoryId || '',
    fs.manufacturer || _getEraManufacturer(),
  ];
  const existingSold = state.soldData[fsKey];
  if (existingSold?.row) {
    await sheetsUpdate(state.personalSheetId, `Sold!A${existingSold.row}:J${existingSold.row}`, [soldRow]);
  } else {
    await sheetsAppend(state.personalSheetId, 'Sold!A:J', [soldRow]);
  }

  // Remove from For Sale tab
  if (fs.row) {
    await sheetsUpdate(state.personalSheetId, `For Sale!A${fs.row}:J${fs.row}`, [['','','','','','','','','','']]);
  }

  // Remove from My Collection — match by inventoryId (which is now the state key)
  let collKey = null;
  if (fs.inventoryId && state.personalData[fs.inventoryId]) {
    collKey = fs.inventoryId;
  }
  if (!collKey) {
    collKey = findPDKey(itemNum, variation);
  }
  const collEntry = collKey ? state.personalData[collKey] : null;
  if (collEntry?.row) {
    await sheetsUpdate(state.personalSheetId, `My Collection!A${collEntry.row}:Y${collEntry.row}`, [['','','','','','','','','','','','','','','','','','','','','','','','','']]);
    delete state.personalData[collKey];
  }

  // Optimistic state update
  state.soldData[fsKey] = { row: existingSold?.row || 99999, itemNum, variation, condition: fs.condition, salePrice: salePrice || askingPrice, dateSold, notes: fs.notes };
  delete state.forSaleData[fsKey];

  _cachePersonalData();

  buildForSalePage();
  buildSoldPage();
  buildDashboard();
  showToast('✓ Marked as sold!');
}

// Remove from For Sale list (called from My Collection row button)
async function _removeForSaleFromCollection(itemNum, variation) {
  const fsKey = `${itemNum}|${variation||''}`;
  const fs = state.forSaleData[fsKey];
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

// Remove from Upgrade list (called from My Collection row button)
async function _removeUpgradeFromCollection(itemNum, variation) {
  const key = `${itemNum}|${variation||''}`;
  const ug = state.upgradeData[key];
  if (!ug) { showToast('Item not found on Upgrade list'); return; }
  if (ug.row) {
    await sheetsUpdate(state.personalSheetId, `Upgrade List!A${ug.row}:H${ug.row}`, [['','','','','','','','']]);
  }
  delete state.upgradeData[key];
  _cachePersonalData();
  showToast('✓ Removed from Upgrade List');
  renderBrowse();
  buildDashboard();
  const badge = document.getElementById('nav-upgrade-count');
  if (badge) { const c = Object.values(state.upgradeData).length; badge.textContent = c > 0 ? c : '—'; }
}

async function removeForSaleItem(itemNum, variation, row) {
  if (!(await appConfirm('Remove this item from your For Sale list?', { danger: true, ok: 'Remove' }))) return;
  const fsKey = `${itemNum}|${variation}`;
  if (row) {
    await sheetsUpdate(state.personalSheetId, `For Sale!A${row}:J${row}`, [['','','','','','','','','','']]);
  }
  delete state.forSaleData[fsKey];
  _cachePersonalData();
  buildForSalePage();
  showToast('✓ Removed from For Sale');
}

async function _removeForSaleFromDetail(idx, itemNum, variation) {
  const fsKey = `${itemNum}|${variation}`;
  const fsEntry = state.forSaleData[fsKey];
  if (!fsEntry) { showToast('Item is not on For Sale list'); return; }
  if (!(await appConfirm('Remove No. ' + itemNum + ' from your For Sale list?', { danger: true, ok: 'Remove' }))) return;
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

async function removeForSaleAndCollection(itemNum, variation, fsRow) {
  if (!(await appConfirm('Remove this item from For Sale AND your collection? This cannot be undone.', { danger: true, ok: 'Remove Both' }))) return;
  const key = `${itemNum}|${variation}`;
  // Remove from For Sale tab
  if (fsRow) {
    await sheetsUpdate(state.personalSheetId, `For Sale!A${fsRow}:J${fsRow}`, [['','','','','','','','','','']]);
  }
  delete state.forSaleData[key];
  // Remove from My Collection tab — use findPDKey for correct 3-part key
  const collKey = findPDKey(itemNum, variation);
  const collEntry = collKey ? state.personalData[collKey] : null;
  if (collEntry && collEntry.row) {
    await sheetsUpdate(state.personalSheetId, `My Collection!A${collEntry.row}:Y${collEntry.row}`, [['','','','','','','','','','','','','','','','','','','','','','','','','']]);  // 25 cols A-Y
  }
  if (collKey) delete state.personalData[collKey];
  _cachePersonalData();
  buildForSalePage();
  buildDashboard();
  renderBrowse();
  showToast('✓ Item removed');
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
      return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:0.85rem 1rem">'
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
      '<button onclick="document.getElementById(\'contact-modal\').style.display=\'none\'" style="position:absolute;top:0.75rem;right:0.75rem;background:none;border:none;color:var(--text-dim);font-size:1.1rem;cursor:pointer">&#x2715;</button>' +
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
  d.addEventListener('click', function(e) { if (e.target === d) d.style.display = 'none'; });
  document.body.appendChild(d);
}

function showContactModal() {
  _buildContactModal();
  const m = document.getElementById('contact-modal');
  if (m) { m.style.display = 'flex'; }
}


// ══════════════════════════════════════════════════════════════════
// UPGRADE LIST
// ══════════════════════════════════════════════════════════════════

function buildUpgradePage() {
  const isMobile = window.innerWidth <= 640;
  const _uq = (state._upgradeSearch || '').toLowerCase();
  const _sort = state._upgradeSort || 'priority';
  const _up = state._upgradePriority || '';
  const thresh = parseInt(_prefGet('lv_upgrade_thresh', '7'));
  const _threshFilter = state._upgradeThreshFilter !== false; // default on
  // Sync dropdowns with state
  const _upEl = document.getElementById('upgrade-priority-filter');
  if (_upEl && _upEl.value !== _up) _upEl.value = _up;
  const totalCount = Object.keys(state.upgradeData).length;

  let entries = Object.values(state.upgradeData).filter(u => {
    // Priority filter
    if (_up && (u.priority || 'Medium') !== _up) return false;
    if (_uq) {
      const master = findMaster(u.itemNum) || {};
      if (!(u.itemNum||'').toLowerCase().includes(_uq)
        && !(master.roadName||'').toLowerCase().includes(_uq)
        && !(u.notes||'').toLowerCase().includes(_uq)) return false;
    }
    if (_threshFilter) {
      const pd = Object.values(state.personalData).find(p => p.owned && p.itemNum === u.itemNum && (p.variation||'') === (u.variation||''));
      const cond = pd && pd.condition ? parseInt(pd.condition) : null;
      if (cond !== null && cond > thresh) return false;
    }
    return true;
  });

  const priorityOrder = { High: 0, Medium: 1, Low: 2 };
  if (_sort === 'priority') {
    entries.sort((a, b) => (priorityOrder[a.priority]??1) - (priorityOrder[b.priority]??1));
  } else if (_sort === 'condition') {
    entries.sort((a, b) => {
      const getC = u => { const pd = Object.values(state.personalData).find(p => p.owned && p.itemNum === u.itemNum && (p.variation||'') === (u.variation||'')); return pd && pd.condition ? parseInt(pd.condition) : 99; };
      return getC(a) - getC(b);
    });
  } else {
    entries.sort((a, b) => (a.itemNum||'').localeCompare(b.itemNum||'', undefined, {numeric:true}));
  }

  // Update badge
  const badge = document.getElementById('nav-upgrade-count');
  if (badge) badge.textContent = totalCount > 0 ? totalCount : '—';
  // Count display
  const upgradeCountEl = document.getElementById('upgrade-count');
  if (upgradeCountEl) {
    upgradeCountEl.textContent = entries.length === totalCount
      ? totalCount + ' item' + (totalCount !== 1 ? 's' : '')
      : 'Showing ' + entries.length + ' of ' + totalCount;
  }

  const cardsEl = document.getElementById('upgrade-cards');
  const tableEl = document.getElementById('upgrade-table');
  const tbody   = document.getElementById('upgrade-tbody');

  const priorityColor = { High: 'var(--accent)', Medium: 'var(--accent2)', Low: 'var(--text-dim)' };

  if (entries.length === 0) {
    const hasFilters = _uq || _up || (_threshFilter && totalCount > 0);
    const emptyIcon = hasFilters ? '🔍' : '↑';
    const emptyMsg = hasFilters ? 'No items match your filters' : 'Your upgrade list is empty';
    const emptyTip = hasFilters ? 'Try adjusting your search or filters' : 'Add items from My Collection that you\'d like in better condition';
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
      const master = findMaster(u.itemNum);
      const name = master ? (master.roadName || master.itemType || '') : '';
      const cond = pd && pd.condition ? parseInt(pd.condition) : null;
      const condClass = cond >= 9 ? 'cond-9' : cond >= 7 ? 'cond-7' : cond >= 5 ? 'cond-5' : cond ? 'cond-low' : '';
      const pColor = priorityColor[u.priority] || 'var(--text-dim)';
      const escVar = (u.variation||'').replace(/'/g,"\\'");
      const photoId = `upgphoto-m-${u.itemNum}-${u.variation||''}`.replace(/[^a-zA-Z0-9-]/g,'_');
      const hasPhoto = pd && !!pd.photoItem;
      return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:0.85rem 1rem">
        <div style="display:flex;align-items:flex-start;gap:0.5rem">
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap">
              <span style="font-family:var(--font-head);font-size:1.1rem;color:var(--accent)">${u.itemNum}</span>
              ${u.variation ? `<span style="font-size:0.72rem;color:var(--text-dim)">${u.variation}</span>` : ''}
              <span style="font-size:0.65rem;font-weight:600;color:${pColor};border:1px solid ${pColor};border-radius:4px;padding:0.1rem 0.4rem">${u.priority||'Medium'}</span>
            </div>
            ${name ? `<div style="font-size:0.82rem;color:var(--text);margin-top:0.1rem">${name}</div>` : ''}
            <div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.25rem;flex-wrap:wrap">
              ${cond !== null ? `<span style="font-size:0.75rem"><span class="condition-pip ${condClass}"></span>Mine: ${cond}</span>` : ''}
              ${u.targetCondition ? `<span style="font-size:0.75rem;color:#8b5cf6">→ Target: ${u.targetCondition}</span>` : ''}
              ${u.maxPrice ? `<span style="font-size:0.75rem;color:var(--accent2);font-family:var(--font-mono)">Max: $${parseFloat(u.maxPrice).toLocaleString()}</span>` : ''}
            </div>
            ${u.notes ? `<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.15rem">${u.notes}</div>` : ''}
          </div>
          ${hasPhoto ? `<button onclick="event.stopPropagation();_toggleUpgradePhoto('${photoId}','${pd.photoItem.replace(/'/g,"\\'")}')" style="background:none;border:none;font-size:1.1rem;cursor:pointer;flex-shrink:0" title="View my photo">📷</button>` : ''}
        </div>
        <div id="${photoId}" style="display:none;margin-top:0.5rem"><img src="${pd && pd.photoItem ? pd.photoItem : ''}" style="max-width:100%;max-height:180px;border-radius:8px;object-fit:contain" onerror="this.parentElement.style.display='none'"></div>
        <div style="display:flex;gap:0.35rem;margin-top:0.6rem;flex-wrap:wrap">
          <button onclick="event.stopPropagation();_upgradeViewMine('${u.itemNum}','${escVar}')" style="flex:1;min-width:0;padding:0.4rem 0.3rem;border-radius:7px;font-size:0.72rem;cursor:pointer;border:1.5px solid #8b5cf6;background:rgba(139,92,246,0.1);color:#8b5cf6;font-family:var(--font-body);font-weight:600">View Mine</button>
          <button onclick="event.stopPropagation();wantFindOnEbay('${u.itemNum}','${(name||'').replace(/'/g,"\\'")}')" style="flex:1;min-width:0;padding:0.4rem 0.3rem;border-radius:7px;font-size:0.72rem;cursor:pointer;border:1.5px solid #e67e22;background:rgba(230,126,34,0.12);color:#e67e22;font-family:var(--font-body);font-weight:600">eBay</button>
          <button onclick="event.stopPropagation();wantSearchOtherSites('${u.itemNum}','${(name||'').replace(/'/g,"\\'")}')" style="flex:1;min-width:0;padding:0.4rem 0.3rem;border-radius:7px;font-size:0.72rem;cursor:pointer;border:1.5px solid #2980b9;background:rgba(41,128,185,0.12);color:#2980b9;font-family:var(--font-body);font-weight:600">Search</button>
          <button onclick="event.stopPropagation();upgradeGotIt('${u.itemNum}','${escVar}')" style="flex:1;min-width:0;padding:0.4rem 0.3rem;border-radius:7px;font-size:0.72rem;cursor:pointer;border:1.5px solid #2ecc71;background:rgba(46,204,113,0.12);color:#2ecc71;font-family:var(--font-body);font-weight:600">✓ Got It</button>
          <button onclick="event.stopPropagation();removeUpgradeItem('${u.itemNum}','${escVar}',${u.row})" style="flex:0 0 auto;padding:0.4rem 0.6rem;border-radius:7px;font-size:0.72rem;cursor:pointer;border:1.5px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body)">Remove</button>
        </div>
      </div>`;
    }).join('');
  } else {
    if (tableEl) tableEl.style.display = '';
    if (cardsEl) cardsEl.style.display = 'none';
    tbody.innerHTML = entries.map((u, idx) => {
      const pd = Object.values(state.personalData).find(p => p.owned && p.itemNum === u.itemNum && (p.variation||'') === (u.variation||''));
      const master = findMaster(u.itemNum);
      const name = master ? (master.roadName || master.itemType || '') : '';
      const cond = pd && pd.condition ? parseInt(pd.condition) : null;
      const condClass = cond >= 9 ? 'cond-9' : cond >= 7 ? 'cond-7' : cond >= 5 ? 'cond-5' : cond ? 'cond-low' : '';
      const pColor = priorityColor[u.priority] || 'var(--text-dim)';
      const escVar = (u.variation||'').replace(/'/g,"\\'");
      const hasPhoto = pd && !!pd.photoItem;
      const photoId = `upgphoto-d-${idx}`;
      return `<tr>
        <td><span class="item-num">${u.itemNum}</span>${u.variation ? ' <span style="font-size:0.72rem;color:var(--text-dim)">' + u.variation + '</span>' : ''}</td>
        <td style="color:var(--text-mid)">${name || '<span class="text-dim">—</span>'}</td>
        <td>${cond !== null ? `<span class="condition-pip ${condClass}" style="margin-right:3px"></span>${cond}` : '<span class="text-dim">—</span>'}</td>
        <td style="color:#8b5cf6;font-weight:600">${u.targetCondition || '<span class="text-dim">—</span>'}</td>
        <td><span style="color:${pColor};font-weight:500">${u.priority||'Medium'}</span></td>
        <td class="market-val">${u.maxPrice ? '$' + parseFloat(u.maxPrice).toLocaleString() : '<span class="text-dim">—</span>'}</td>
        <td style="font-size:0.8rem;color:var(--text-dim);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(u.notes||'').replace(/"/g,'&quot;')}">${u.notes || '<span class="text-dim">—</span>'}</td>
        <td style="white-space:nowrap">
          ${hasPhoto ? `<button onclick="event.stopPropagation();_toggleUpgradePhoto('${photoId}','${(pd.photoItem||'').replace(/'/g,"\\'")}')" style="padding:0.25rem 0.4rem;border-radius:5px;font-size:0.72rem;cursor:pointer;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);margin-right:0.2rem" title="Toggle photo">📷</button>` : ''}
          <button onclick="_upgradeViewMine('${u.itemNum}','${escVar}')" style="padding:0.25rem 0.45rem;border-radius:5px;font-size:0.72rem;cursor:pointer;border:1px solid #8b5cf6;background:rgba(139,92,246,0.1);color:#8b5cf6;font-family:var(--font-body);font-weight:600;margin-right:0.2rem">View Mine</button>
          <button onclick="wantFindOnEbay('${u.itemNum}','${(name||'').replace(/'/g,"\\'")}')" style="padding:0.25rem 0.45rem;border-radius:5px;font-size:0.72rem;cursor:pointer;border:1px solid #e67e22;background:rgba(230,126,34,0.12);color:#e67e22;font-family:var(--font-body);margin-right:0.2rem">eBay</button>
          <button onclick="wantSearchOtherSites('${u.itemNum}','${(name||'').replace(/'/g,"\\'")}')" style="padding:0.25rem 0.45rem;border-radius:5px;font-size:0.72rem;cursor:pointer;border:1px solid #2980b9;background:rgba(41,128,185,0.12);color:#2980b9;font-family:var(--font-body);margin-right:0.2rem">Search</button>
          <button onclick="upgradeGotIt('${u.itemNum}','${escVar}')" style="padding:0.25rem 0.45rem;border-radius:5px;font-size:0.72rem;cursor:pointer;border:1px solid #2ecc71;background:rgba(46,204,113,0.12);color:#2ecc71;font-family:var(--font-body);font-weight:600;margin-right:0.2rem">✓ Got It</button>
          <button onclick="removeUpgradeItem('${u.itemNum}','${escVar}',${u.row})" style="padding:0.25rem 0.45rem;border-radius:5px;font-size:0.72rem;cursor:pointer;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body)">Remove</button>
        </td>
      </tr>
      <tr id="${photoId}-row" style="display:none"><td colspan="8" style="padding:0.5rem 1rem;background:var(--surface2)"><img src="${pd && pd.photoItem ? pd.photoItem : ''}" style="max-height:160px;border-radius:6px;object-fit:contain" onerror="this.parentElement.parentElement.style.display='none'"></td></tr>`;
    }).join('') || '<tr><td colspan="8" class="ui-empty">No items on upgrade list</td></tr>';
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

function _upgradeViewMine(itemNum, variation) {
  const master = findMaster(itemNum);
  if (master) {
    showItemDetailPage(state.masterData.indexOf(master));
  } else {
    showToast('Item not found in master catalog');
  }
}

function showAddToUpgradeModal(itemNum, variation, pdRow) {
  const existing = state.upgradeData[`${itemNum}|${variation||''}`] || {};
  let pd;
  if (pdRow) {
    pd = state.personalData[`${itemNum}|${variation||''}|${pdRow}`];
  }
  if (!pd) pd = Object.values(state.personalData).find(p => p.owned && p.itemNum === itemNum && (p.variation||'') === (variation||''));
  const master = findMaster(itemNum);
  const name = master ? (master.roadName || master.itemType || itemNum) : itemNum;
  const myCond = pd && pd.condition ? pd.condition : '';

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
      <div style="font-family:var(--font-mono);font-size:0.9rem;color:var(--accent);margin-bottom:0.1rem">${itemNum}${variation ? ' <span style="color:var(--text-dim);font-size:0.8rem">' + variation + '</span>' : ''}</div>
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
        <button onclick="saveUpgradeItem('${itemNum}','${(variation||'').replace(/'/g,"\\'")}',${existing.row||0},'${pd && pd.inventoryId ? pd.inventoryId : ''}')" style="padding:0.6rem;border-radius:8px;background:#8b5cf6;color:#fff;border:none;font-family:var(--font-body);font-size:0.9rem;font-weight:600;cursor:pointer;margin-top:0.25rem">
          ${existing.row ? 'Update Upgrade Entry' : '+ Add to Upgrade List'}
        </button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

async function saveUpgradeItem(itemNum, variation, existingRow, invId) {
  const priority = document.getElementById('upg-priority')?.value || 'Medium';
  const targetCond = document.getElementById('upg-target-cond')?.value || '';
  const maxPrice = document.getElementById('upg-max-price')?.value || '';
  const notes = document.getElementById('upg-notes')?.value || '';
  const row = [itemNum, variation||'', priority, targetCond, maxPrice, notes, invId || '', _getEraManufacturer()];
  const key = `${itemNum}|${variation||''}`;
  const sheetId = state.personalSheetId;
  if (!sheetId) { showToast('Not connected to a sheet'); return; }
  try {
    if (existingRow > 0) {
      await sheetsUpdate(sheetId, `Upgrade List!A${existingRow}:H${existingRow}`, [row]);
    } else {
      await sheetsAppend(sheetId, 'Upgrade List!A:H', [row]);
    }
    // Reload data
    const res = await sheetsGet(sheetId, 'Upgrade List!A3:H');
    state.upgradeData = {};
    (res.values || []).forEach((r, idx) => {
      if (!r[0] || r[0] === 'Item Number') return;
      state.upgradeData[`${r[0]}|${r[1]||''}`] = {
        row: idx+3, itemNum: r[0]||'', variation: r[1]||'',
        priority: r[2]||'Medium', targetCondition: r[3]||'', maxPrice: r[4]||'', notes: r[5]||'',
        inventoryId: r[6]||'',
        manufacturer: r[7] || 'Lionel',
      };
    });
    const modal = document.getElementById('upgrade-add-modal');
    if (modal) modal.remove();
    showToast('✓ Added to Upgrade List');
    buildDashboard();
    const badge = document.getElementById('nav-upgrade-count');
    if (badge) badge.textContent = Object.values(state.upgradeData).length.toLocaleString();
  } catch(e) {
    showToast('Error saving — check connection');
    console.error(e);
  }
}

async function removeUpgradeItem(itemNum, variation, row) {
  const key = `${itemNum}|${variation||''}`;
  if (!state.personalSheetId) return;
  try {
    await sheetsUpdate(state.personalSheetId, `Upgrade List!A${row}:H${row}`, [['','','','','','','','']]);
    delete state.upgradeData[key];
    showToast('Removed from Upgrade List');
    buildUpgradePage();
    buildDashboard();
    const badge = document.getElementById('nav-upgrade-count');
    if (badge) { const c = Object.values(state.upgradeData).length; badge.textContent = c > 0 ? c : '—'; }
  } catch(e) {
    showToast('Error removing item');
  }
}

function upgradeGotIt(itemNum, variation) {
  const old = document.getElementById('upgrade-gotit-modal');
  if (old) old.remove();
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
          <button onclick="_upgradeGotItFinish('${itemNum}','${(variation||'').replace(/'/g,"\\'")}','keep')" style="padding:0.5rem;border-radius:8px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.85rem;cursor:pointer;text-align:left">Keep both copies</button>
          <button onclick="_upgradeGotItFinish('${itemNum}','${(variation||'').replace(/'/g,"\\'")}','forsale')" style="padding:0.5rem;border-radius:8px;border:1.5px solid #e67e22;background:rgba(230,126,34,0.08);color:#e67e22;font-family:var(--font-body);font-size:0.85rem;cursor:pointer;text-align:left">🏷️ List old one for sale</button>
          <button onclick="_upgradeGotItFinish('${itemNum}','${(variation||'').replace(/'/g,"\\'")}','remove')" style="padding:0.5rem;border-radius:8px;border:1.5px solid var(--accent);background:rgba(240,80,8,0.08);color:var(--accent);font-family:var(--font-body);font-size:0.85rem;cursor:pointer;text-align:left">Remove old entry from collection</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

async function _upgradeGotItFinish(itemNum, variation, action) {
  const modal = document.getElementById('upgrade-gotit-modal');
  if (modal) modal.remove();
  const key = `${itemNum}|${variation||''}`;
  const upgradeEntry = state.upgradeData[key];
  // Remove from upgrade list
  if (upgradeEntry) await removeUpgradeItem(itemNum, variation, upgradeEntry.row);
  if (action === 'forsale') {
    // Navigate to for sale flow for this item
    const master = findMaster(itemNum);
    const idx = master ? state.masterData.indexOf(master) : -1;
    if (idx >= 0) collectionActionForSale(idx, itemNum, variation);
    else showToast('Navigate to My Collection to list for sale');
  } else if (action === 'remove') {
    const pd = Object.values(state.personalData).find(p => p.owned && p.itemNum === itemNum && (p.variation||'') === (variation||''));
    if (pd) await removeCollectionItem(itemNum, variation, pd.row);
    else showToast('Item not found in collection');
  } else {
    showToast('✓ Upgrade complete — entry removed from list');
  }
}

