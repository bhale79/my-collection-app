// The Rail Roster — app-collection.js
// Extracted from app.js in Session 111 (Round 2 Chunk 15 — FINAL chunk).
//
// Contents:
//   • Item detail page family: showItemDetailPage, showItemDetailPage_edit,
//     _photos, _sell, _forsale
//   • Browse photo flow: openPhotoWizard, addPhotosFromCollection, openPhotoFolder
//   • Owned-item menu: showOwnedItemMenu, _showSpecialOwnedMenu
//   • Collection actions: collectionActionForSale, _checkGroupBeforeForSale,
//     collectionActionSold, _checkSetBeforeAction
//   • Removal + row adjust: removeCollectionItem, _adjustRowsAfterDelete
//   • Sell/list flows: sellFromCollection, listForSaleFromCollection,
//     showPickFromCollectionForSale, _renderPickFsList, _filterPickFs,
//     _pickFsSelect, updateCollectionItem
//   • showItemPanel (the 386-line item panel builder)
//   • Browse-row click family: openISDetail, browseRowClick, showRefItemPopup,
//     addFromBrowse
//   • Item modal: _buildItemModal, openItem, fillItemFromBoxRow, closeModal,
//     closeModalOnOverlay
//   • Module-level status state + setStatus (currentStatus = 'Want')
//   • saveItem — the central save path (Owned/Want/ForSale/Sold/Upgrade)
//   • _checkWantPartners — partner prompt after want-list save
//
// Depends on globals defined in app.js / other helper files: state,
// _cachePersonalData, buildDashboard, renderBrowse, buildWantPage,
// buildForSalePage, buildSoldPage, buildUpgradePage, sheetsGet/sheetsAppend/
// sheetsUpdate/sheetsDeleteRow, findMaster, findPDKey, vault helpers,
// partner-map helpers, photo/drive helpers, showToast, and many more.

// ── My Collection Detail Popup ──
function showItemDetailPage(idx) {
  const item = idx >= 0 ? state.masterData[idx] : null;
  let pd = null, pdKey = null;
  if (item) {
    pdKey = findPDKey(item.itemNum, item.variation);
    pd = pdKey ? state.personalData[pdKey] : null;
  } else {
    const poKey = window._poKeys ? window._poKeys[-(idx+1000)] : null;
    pd = poKey ? state.personalData[poKey] : null;
    pdKey = poKey;
  }
  if (!pd && !item) return;
  // Infer type from suffix for personal-only items
  let _detailType = pd && pd.itemType ? pd.itemType : '';
  let _baseItem = null; // master data for the base item (e.g. 2032 for 2032-P)
  if (!item && pd) {
    const _dn = (pd.itemNum || '').toUpperCase();
    if (_dn.endsWith('-MBOX'))      _detailType = _detailType || 'Master Carton';
    else if (_dn.endsWith('-BOX'))  _detailType = _detailType || 'Box';
    else if (_dn.endsWith('-P'))    _detailType = _detailType || 'Powered Unit';
    else if (_dn.endsWith('-T'))    _detailType = _detailType || 'Dummy Unit';
    // Strip suffix to find the base item in master data for description/roadName/varDesc
    const _baseNum = pd.itemNum.replace(/-(P|T|BOX|MBOX)$/i, '');
    if (_baseNum !== pd.itemNum) {
      _baseItem = state.masterData.find(m => m.itemNum === _baseNum && (!pd.variation || m.variation === pd.variation))
               || findMaster(_baseNum);
    }
  }
  const it = item || {
    itemNum: pd.itemNum, variation: pd.variation || '',
    itemType: _detailType || (_baseItem ? _baseItem.itemType : ''),
    roadName: pd.roadName || (_baseItem ? _baseItem.roadName : ''),
    description: _baseItem ? _baseItem.description : '',
    yearProd: pd.yearMade || (_baseItem ? _baseItem.yearProd : ''),
    marketVal: _baseItem ? _baseItem.marketVal : '',
    varDesc: _baseItem ? _baseItem.varDesc : '',
    refLink: _baseItem ? _baseItem.refLink : '',
  };

  // Show page
  showPage('itemdetail');
  const container = document.getElementById('item-detail-content');
  if (!container) return;

  const cond = pd && pd.condition ? parseInt(pd.condition) : null;
  const condClass = cond >= 9 ? 'cond-9' : cond >= 7 ? 'cond-7' : cond >= 5 ? 'cond-5' : cond ? 'cond-low' : '';
  const isForSale = !!state.forSaleData[`${it.itemNum}|${it.variation||''}`];
  const _fsEntry = state.forSaleData[`${it.itemNum}|${it.variation||''}`];
  const _fsPrice = _fsEntry ? '$' + parseFloat(_fsEntry.askingPrice || 0).toLocaleString() : '';
  const groupMembers = pd && pd.groupId ? Object.values(state.personalData).filter(p => p.groupId === pd.groupId && p.itemNum !== it.itemNum) : [];

  // ── HEADER ──
  const _fromTools = window._detailReturn === 'tools';
  const _backLabel = _fromTools ? 'Back to Collection Tools' : 'Back to Collection';
  const _backFn    = _fromTools ? 'delete window._detailReturn;showPage(&apos;tools&apos;);buildToolsPage()' : 'showPage(&apos;browse&apos;);filterOwned()';
  let html = `
  <div style="margin-bottom:1.5rem">
    <button onclick="${_backFn}" style="background:none;border:none;color:#2980b9;font-family:var(--font-body);font-size:1.1rem;font-weight:700;cursor:pointer;padding:0;margin-bottom:0.75rem;display:flex;align-items:center;gap:0.4rem">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
      ${_backLabel}
    </button>
    <div style="display:flex;align-items:flex-start;gap:1rem;flex-wrap:wrap">
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;margin-bottom:0.25rem">
          <span style="font-family:var(--font-head);font-size:1.6rem;color:var(--accent);letter-spacing:0.03em">No. ${it.itemNum}${it.poweredDummy === 'P' ? '-P' : it.poweredDummy === 'D' ? '-D' : ''}</span>
          ${isForSale ? `<span style="font-size:1rem;color:var(--gold);font-family:var(--font-head);letter-spacing:0.02em">— on the sale list for ${_fsPrice}</span>` : ''}
          ${it.variation ? `<span style="font-size:0.9rem;color:var(--text-dim);background:var(--surface2);border-radius:6px;padding:0.15rem 0.6rem">Var. ${it.variation}</span>` : ''}
          ${it.itemType ? `<span class="tag">${it.itemType}</span>` : ''}
          ${it.yearProd ? `<span style="font-size:0.82rem;color:var(--text-dim)">${it.yearProd}</span>` : ''}
        </div>
        <div style="font-size:1.05rem;color:var(--text);margin-bottom:0.2rem">${it.roadName || ''}</div>
        ${it.description ? `<div style="font-size:0.85rem;color:var(--text-mid);line-height:1.5;margin-top:0.3rem"><strong style="color:var(--text)">Description:</strong> ${it.description}</div>` : ''}
        ${it.varDesc ? `<div style="font-size:0.85rem;color:var(--text-mid);line-height:1.5;margin-top:0.3rem"><strong style="color:var(--text)">Variation Description:</strong> ${it.varDesc}</div>` : ''}
        ${it.refLink ? `<a href="${it.refLink}" target="_blank" rel="noopener" style="font-size:0.78rem;color:var(--accent2);text-decoration:none;display:inline-flex;align-items:center;gap:0.3rem;margin-top:0.4rem">View on COTT <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.4rem;flex-shrink:0">
        <span class="owned-badge ${isForSale ? 'forsale' : 'yes'}" style="font-size:0.85rem">${isForSale ? '\ud83c\udff7\ufe0f For Sale' : '\u2713 In Collection'}</span>
        ${cond ? `<span style="font-size:0.85rem"><span class="condition-pip ${condClass}"></span> ${cond}/10</span>` : ''}
      </div>
    </div>
  </div>`;

  // ── ACTION TOOLBAR ──
  html += `
  <div style="display:flex;gap:0.5rem;margin-bottom:1.5rem;flex-wrap:wrap">
    <button onclick="showItemDetailPage_edit(${idx})" data-ctip="Edit this item's details and add photos all in one place." style="padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #2980b9;background:rgba(41,128,185,0.1);color:#2980b9;font-family:var(--font-body);font-size:0.82rem;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:0.4rem">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      Update Info &amp; Add Pictures
    </button>
    <button onclick="collectionActionSold(${idx},'${it.itemNum}','${(it.variation||'').replace(/'/g,"&apos;")}')" data-ctip="Did you sell something? Record that here." style="padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #2ecc71;background:rgba(46,204,113,0.1);color:#2ecc71;font-family:var(--font-body);font-size:0.82rem;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:0.4rem">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
      Record Sale
    </button>
    ${isForSale
      ? `<button onclick="_removeForSaleFromDetail(${idx},'${it.itemNum}','${(it.variation||'').replace(/'/g,"&apos;")}')" data-ctip="Remove this item from your For Sale list and keep it in your collection." style="padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #e67e22;background:rgba(230,126,34,0.25);color:#e67e22;font-family:var(--font-body);font-size:0.82rem;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:0.4rem">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
      Remove from For Sale
    </button>`
      : `<button onclick="collectionActionForSale(${idx},'${it.itemNum}','${(it.variation||'').replace(/'/g,"&apos;")}')" data-ctip="If you want to sell an item from your collection, you can list it for sale here." style="padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #e67e22;background:rgba(230,126,34,0.1);color:#e67e22;font-family:var(--font-body);font-size:0.82rem;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:0.4rem">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
      List for Sale
    </button>`}
    <button onclick="showAddToUpgradeModal('${it.itemNum}','${(it.variation||'').replace(/'/g,"&apos;")}')" style="padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #8b5cf6;background:rgba(139,92,246,0.1);color:#8b5cf6;font-family:var(--font-body);font-size:0.82rem;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:0.4rem">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
      Add to Upgrade List
    </button>
  </div>`;

  // ── DETAILS GRID ──
  const details = [
    { label: 'Condition', val: cond ? `<span class="condition-pip ${condClass}"></span> ${cond}/10` : null },
    { label: 'All Original', val: pd && pd.allOriginal && pd.allOriginal !== 'Unknown' ? pd.allOriginal : null },
    { label: 'Not Original', val: pd && pd.notOriginalDesc ? pd.notOriginalDesc : null },
    { label: 'Has Box', val: pd ? (pd.hasBox === 'Yes' ? '\u2705 Yes' + (pd.boxCond ? ` (${pd.boxCond}/10)` : '') : pd.hasBox === 'No' ? 'No' : null) : null },
    { label: 'Price Paid (Item)', val: pd && pd.priceItem ? '$' + parseFloat(pd.priceItem).toLocaleString() : null },
    { label: 'Price Paid (Box)', val: pd && pd.priceBox ? '$' + parseFloat(pd.priceBox).toLocaleString() : null },
    { label: 'Price Paid (Complete)', val: pd && pd.priceComplete ? '$' + parseFloat(pd.priceComplete).toLocaleString() : null },
    { label: 'Est. Worth', val: pd && pd.userEstWorth ? '$' + parseFloat(pd.userEstWorth).toLocaleString() : null },
    { label: 'Market Value', val: it.marketVal && !isNaN(parseFloat(it.marketVal)) ? '$' + parseFloat(it.marketVal).toLocaleString() : null },
    { label: 'Date Purchased', val: pd && pd.datePurchased ? pd.datePurchased : null },
    { label: 'Year Made', val: pd && pd.yearMade ? pd.yearMade : null },
    { label: 'Location', val: pd && pd.location ? pd.location : null },
    { label: 'Inventory ID', val: pd && pd.inventoryId ? pd.inventoryId : null },
  ].filter(d => d.val);

  const matchedTo = pd && pd.matchedTo ? pd.matchedTo : '';
  const setId = pd && pd.setId ? pd.setId : '';

  html += `<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:1.25rem;margin-bottom:1.5rem">
    <div style="font-family:var(--font-head);font-size:0.72rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--accent2);margin-bottom:0.75rem">Details</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:0.6rem 1.5rem">
      ${details.map(d => `<div style="display:flex;justify-content:space-between;padding:0.35rem 0;border-bottom:1px solid var(--border)">
        <span style="font-size:0.78rem;color:var(--text-dim);font-weight:600">${d.label}</span>
        <span style="font-size:0.85rem;color:var(--text);text-align:right">${d.val}</span>
      </div>`).join('')}
    </div>`;

  // Matched / Set info
  if (matchedTo || setId || groupMembers.length) {
    html += `<div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border)">`;
    if (matchedTo) {
      const _mIcon = isTender(it.itemNum) ? '\ud83d\ude82' : '\ud83d\ude83';
      // Matched items are always in the collection
      const _mtPdKey = findPDKey(matchedTo, '');
      let _mtIdx = state.masterData.findIndex(md => md.itemNum === matchedTo);
      if (_mtIdx < 0 && _mtPdKey) {
        if (!window._poKeys) window._poKeys = [];
        let _mtPoIdx = window._poKeys.indexOf(_mtPdKey);
        if (_mtPoIdx < 0) _mtPoIdx = window._poKeys.push(_mtPdKey) - 1;
        _mtIdx = -(_mtPoIdx + 1000);
      }
      const _mtClickable = _mtPdKey && _mtIdx !== -1;
      html += `<div style="font-size:0.85rem;color:var(--text-mid);margin-bottom:0.3rem">${_mIcon} Matched to: ${_mtClickable
        ? '<a href="javascript:void(0)" onclick="showItemDetailPage(' + _mtIdx + ')" style="color:var(--accent);font-weight:700;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px;cursor:pointer">' + matchedTo + '</a>'
        : '<strong style="color:var(--accent)">' + matchedTo + '</strong>'}</div>`;
    }
    if (setId) {
      html += `<div style="font-size:0.85rem;color:var(--text-mid);margin-bottom:0.3rem">\ud83d\udd17 Set: <strong style="color:#a855f7">${setId}</strong></div>`;
    }
    if (groupMembers.length) {
      html += `<div style="font-size:0.78rem;color:var(--text-dim);margin-top:0.3rem">Grouped with: ${groupMembers.map(m => {
        // Grouped items are always in the collection — look up via personalData
        const _gPdKey = findPDKey(m.itemNum, m.variation);
        if (_gPdKey) {
          // Check if also in masterData (positive index), otherwise use personal-only negative index
          let _gIdx = state.masterData.findIndex(md => md.itemNum === m.itemNum && (!m.variation || md.variation === m.variation));
          if (_gIdx < 0) {
            if (!window._poKeys) window._poKeys = [];
            let _poIdx = window._poKeys.indexOf(_gPdKey);
            if (_poIdx < 0) _poIdx = window._poKeys.push(_gPdKey) - 1;
            _gIdx = -(_poIdx + 1000);
          }
          return '<a href="javascript:void(0)" onclick="showItemDetailPage(' + _gIdx + ')" style="color:var(--accent);font-family:var(--font-mono);text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px;cursor:pointer">' + m.itemNum + '</a>';
        }
        return '<span style="color:var(--accent);font-family:var(--font-mono)">' + m.itemNum + '</span>';
      }).join(', ')}</div>`;
    }
    html += `</div>`;
  }

  // Notes
  if (pd && pd.notes) {
    html += `<div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border)">
      <div style="font-size:0.78rem;color:var(--text-dim);font-weight:600;margin-bottom:0.3rem">Notes</div>
      <div style="font-size:0.85rem;color:var(--text);line-height:1.6">${pd.notes}</div>
    </div>`;
  }

  html += `</div>`;

  // ── PHOTO GALLERY ──
  const _photoLink = pd && pd.photoItem ? pd.photoItem : '';
  html += `<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:1.25rem">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem">
      <div style="font-family:var(--font-head);font-size:0.72rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--accent2)">Photos</div>
      ${_photoLink ? `<a href="${_photoLink}" target="_blank" rel="noopener" style="font-size:0.75rem;color:var(--accent2);text-decoration:none">Open Drive Folder \u2197</a>` : ''}
    </div>
    <div id="item-detail-photos" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:0.75rem;min-height:80px">
      ${_photoLink ? '<div style="grid-column:1/-1;text-align:center;padding:1rem;color:var(--text-dim);font-size:0.82rem"><div class="spinner" style="margin:0 auto 0.5rem;width:20px;height:20px;border-width:2px"></div>Loading photos...</div>' : '<div style="grid-column:1/-1;text-align:center;padding:2rem 1rem;color:var(--text-dim)"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3" style="margin:0 auto 0.5rem;display:block"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg><div style="font-size:0.85rem;margin-bottom:0.5rem">No photos uploaded yet</div><button onclick="showItemDetailPage_photos(${idx})" style="padding:0.4rem 0.8rem;border-radius:7px;border:1.5px solid var(--gold);background:rgba(212,168,67,0.08);color:var(--gold);font-family:var(--font-body);font-size:0.78rem;cursor:pointer;font-weight:600">Add Photos</button></div>'}
    </div>
  </div>`;

  container.innerHTML = html;

  // Async: load photos
  if (_photoLink) {
    driveGetFolderPhotos(_photoLink).then(function(photos) {
      const el = document.getElementById('item-detail-photos');
      if (!el) return;
      if (!photos || photos.length === 0) {
        el.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem 1rem;color:var(--text-dim)"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3" style="margin:0 auto 0.5rem;display:block"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg><div style="font-size:0.85rem;margin-bottom:0.5rem">No photos in folder</div><button onclick="showItemDetailPage_photos(' + idx + ')" style="padding:0.4rem 0.8rem;border-radius:7px;border:1.5px solid var(--gold);background:rgba(212,168,67,0.08);color:var(--gold);font-family:var(--font-body);font-size:0.78rem;cursor:pointer;font-weight:600">Add Photos</button></div>';
        return;
      }
      el.innerHTML = photos.map(function(p) {
        return '<a href="' + p.view + '" target="_blank" rel="noopener" style="display:block;border-radius:8px;overflow:hidden;background:var(--surface2);aspect-ratio:1;position:relative">'
          + '<img id="idp-' + p.id + '" style="width:100%;height:100%;object-fit:cover;border-radius:8px;transition:opacity 0.3s" alt="' + (p.name||'Photo') + '">'
          + '<div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.6));padding:0.3rem 0.5rem">'
          + '<div style="font-size:0.65rem;color:#fff;font-family:var(--font-head);letter-spacing:0.05em;text-transform:uppercase">' + (p.name||'').replace(/\.[^.]+$/,'') + '</div>'
          + '</div></a>';
      }).join('');
      // Load each photo thumbnail
      photos.forEach(function(p) {
        const imgEl = document.getElementById('idp-' + p.id);
        if (imgEl) {
          loadDriveThumb(p.id, imgEl, imgEl.parentElement);
        }
      });
    }).catch(function(e) {
      console.warn('Photo gallery load:', e);
      const el = document.getElementById('item-detail-photos');
      if (el) el.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:1rem;color:var(--text-dim);font-size:0.82rem">Could not load photos</div>';
    });
  }
}

// Helper functions for item detail page action buttons
function showItemDetailPage_edit(idx) {
  const item = idx >= 0 ? state.masterData[idx] : null;
  if (!item) return;
  const pdKey = findPDKey(item.itemNum, item.variation);
  if (pdKey) updateCollectionItem(idx, pdKey);
  else showToast('Item not found in your collection', 3000, true);
}
function showItemDetailPage_photos(idx) {
  const item = idx >= 0 ? state.masterData[idx] : null;
  if (!item) return;
  const pdKey = findPDKey(item.itemNum, item.variation);
  if (pdKey) showItemPanel(idx, pdKey, 'edit');
  else showToast('Item not found in your collection', 3000, true);
}
function showItemDetailPage_sell(idx) {
  const item = idx >= 0 ? state.masterData[idx] : null;
  if (!item) return;
  const pdKey = findPDKey(item.itemNum, item.variation);
  if (pdKey) sellFromCollection(idx, pdKey);
}
function showItemDetailPage_forsale(idx) {
  const item = idx >= 0 ? state.masterData[idx] : null;
  if (!item) return;
  const pdKey = findPDKey(item.itemNum, item.variation);
  if (pdKey) listForSaleFromCollection(idx, pdKey);
}




// ── BROWSE ROW CLICK — offer to add or view ─────────────────────
function openPhotoWizard(itemNum, variation, pdKey) {
  // Open wizard on the photo step for an existing item
  const pd = state.personalData[pdKey] || {};
  wizard = {
    step: 0, tab: 'collection',
    data: { tab: 'collection', itemNum: itemNum, variation: variation,
            condition: pd.condition || '', allOriginal: pd.allOriginal || '',
            hasBox: pd.hasBox || '', _updatePdKey: pdKey, _photoOnly: true },
    steps: getSteps('collection'), matchedItem: null
  };
  // Bugfix 2026-04-14: wizard modal may not be built yet (only built by openWizard).
  // Without this call, getElementById('wizard-modal') returns null and throws.
  if (typeof _buildWizardModal === 'function') _buildWizardModal();
  document.getElementById('wizard-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
  // Skip to the photosItem step
  // NOTE: step IDs must match the current collection-tab step list in wizard.js.
  // Added 2026-04-14: itemCategory, itemNumGrouping, conditionDetails, purchaseValue, boxVariation
  // (these are the current step IDs that used to be 'tab'/'itemNum'/'condition'/etc.)
  const autoSkip = new Set(['tab','itemCategory','itemNum','itemNumGrouping','variation','itemPicker','entryMode',
    'conditionDetails','condition','allOriginal','notOriginalDesc',
    'hasBox','boxCond','hasIS','is_sheetNum','is_condition',
    'purchaseValue','pricePaid','datePurchased','userEstWorth','yearMade',
    'tenderAllOriginal','tenderNotOriginalDesc','unit2AllOriginal','unit2NotOriginalDesc',
    'unit3AllOriginal','unit3NotOriginalDesc','wantTenderPhotos','tenderMatch','dieselSetQ','setMatch','setType',
    'unit2ItemNum','unit3ItemNum','setUnit2Num','setUnit3Num',
    'wantTogetherPhotos','photosTogether','boxOnly','wantBoxPhotos','boxVariation',
    'hasMasterBox','masterBoxCond','masterBoxNotes','photosMasterBox',
    'purchaseDate','photosBox']);
  while (wizard.step < wizard.steps.length - 1) {
    const s = wizard.steps[wizard.step];
    if (autoSkip.has(s.id) || (s.skipIf && s.skipIf(wizard.data))) wizard.step++;
    else break;
  }
  renderWizardStep();
}

function addPhotosFromCollection(globalIdx) {
  var item = state.masterData[globalIdx] || {};
  var itemNum = item.itemNum || '';
  var variation = item.variation || '';
  var pdKey = Object.keys(state.personalData).find(function(k) {
    var pd = state.personalData[k];
    return pd && pd.itemNum === itemNum && (!variation || pd.variation === variation) && pd.owned;
  });
  if (pdKey) openPhotoWizard(itemNum, variation, pdKey);
  else showToast('Item not found in collection');
}

async function openPhotoFolder(itemNum, storedLink) {
  if (storedLink) {
    var _pfMatch = (storedLink || '').match(/folders\/([a-zA-Z0-9_-]+)/);
    if (_pfMatch && _pfMatch[1] && _pfMatch[1] !== 'undefined') {
      try {
        var _pfCheck = await driveRequest('GET', '/files/' + _pfMatch[1] + '?fields=id,trashed');
        if (_pfCheck && _pfCheck.id && !_pfCheck.trashed) {
          window.open(storedLink, '_blank');
          return;
        }
      } catch(e) { /* stale link, fall through */ }
    }
    console.warn('[Photos] Stored link invalid for', itemNum);
  }
  try {
    var folderId = await driveEnsureItemFolder(itemNum);
    var freshLink = driveFolderLink(folderId);
    window.open(freshLink, '_blank');
    // Auto-repair the broken link in the sheet
    var _pfKey = Object.keys(state.personalData).find(function(k) {
      var pd = state.personalData[k];
      return pd && pd.itemNum === itemNum && pd.owned;
    });
    if (_pfKey && state.personalData[_pfKey].row) {
      state.personalData[_pfKey].photoItem = freshLink;
      sheetsUpdate(state.personalSheetId, 'My Collection!J' + state.personalData[_pfKey].row, [[freshLink]]).catch(function(e) { console.warn('Photo link update:', e); });
    }
  } catch(e) { showToast('Could not open Drive folder: ' + e.message); }
}

function showOwnedItemMenu(idx, pdKey) {
  const pd = state.personalData[pdKey] || {};
  // For personalOnly items, build a minimal item object from pd
  const item = state.masterData[idx] || {
    itemNum: pd.itemNum, variation: pd.variation || '',
    roadName: pd.roadName || '', itemType: pd.itemType || '',
    yearProd: pd.yearMade || '', marketVal: '', // market value comes from master sheet only
  };
  const existing = document.getElementById('owned-action-menu');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'owned-action-menu';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1.5rem';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
  const box = document.createElement('div');
  box.style.cssText = 'background:var(--surface);border:1px solid rgba(46,204,113,0.35);border-radius:16px;max-width:420px;width:100%;padding:1.75rem;position:relative';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = 'position:absolute;top:0.75rem;right:0.75rem;background:none;border:none;color:var(--text-dim);font-size:1.1rem;cursor:pointer';
  closeBtn.onclick = function() { overlay.remove(); };
  box.appendChild(closeBtn);

  const hdr = document.createElement('div');
  hdr.style.cssText = 'font-family:var(--font-head);font-size:1rem;color:var(--green);margin-bottom:0.15rem';
  hdr.textContent = '✓ In Your Collection';
  box.appendChild(hdr);
  const itemLbl = document.createElement('div');
  itemLbl.style.cssText = 'font-size:0.85rem;color:var(--text-mid);margin-bottom:0.1rem';
  itemLbl.textContent = 'No. ' + item.itemNum + (item.variation ? ' — Var. ' + item.variation : '') + (item.roadName ? ' · ' + item.roadName : '');
  box.appendChild(itemLbl);
  const condLbl = document.createElement('div');
  condLbl.style.cssText = 'font-size:0.75rem;color:var(--text-dim);margin-bottom:1.25rem';
  const parts = [];
  if (pd.condition) parts.push('Condition: ' + pd.condition + '/10');
  if (pd.priceItem || pd.priceComplete) parts.push('Paid: $' + (pd.priceComplete || pd.priceItem));
  if (pd.yearMade) parts.push('Year: ' + pd.yearMade);
  condLbl.textContent = parts.join(' · ') || item.yearProd || '';
  box.appendChild(condLbl);

  // Action buttons stacked
  const mkBtn = function(label, color, bg, handler) {
    const b = document.createElement('button');
    b.style.cssText = 'width:100%;padding:0.7rem 1rem;border-radius:9px;border:1.5px solid ' + color + ';color:' + color + ';background:' + bg + ';font-family:var(--font-body);font-size:0.9rem;font-weight:600;cursor:pointer;margin-bottom:0.5rem;text-align:left;display:flex;align-items:center;gap:0.5rem';
    b.innerHTML = label;
    b.onclick = handler;
    return b;
  };

  box.appendChild(mkBtn(
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> Record a Sale',
    '#2ecc71', 'rgba(46,204,113,0.1)',
    function() { overlay.remove(); sellFromCollection(idx, pdKey); }
  ));
  // Check if already listed for sale
  const _fsKey = pd.itemNum + '|' + (pd.variation || '');
  const _alreadyForSale = !!state.forSaleData[_fsKey];
  box.appendChild(mkBtn(
    _alreadyForSale
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> Update For Sale Listing'
      : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> List for Sale',
    '#e67e22', 'rgba(230,126,34,0.1)',
    function() { overlay.remove(); listForSaleFromCollection(idx, pdKey); }
  ));
  box.appendChild(mkBtn(
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Update Info',
    '#2980b9', 'rgba(224,64,40,0.08)',
    function() { overlay.remove(); updateCollectionItem(idx, pdKey); }
  ));
  box.appendChild(mkBtn(
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> View Item Details',
    'var(--text-dim)', 'var(--surface2)',
    function() { overlay.remove(); showItemPanel(idx, pdKey, 'view'); }
  ));
  // Add Another Copy — re-opens the wizard for the same item
  if (idx >= 0) {
    box.appendChild(mkBtn(
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> Add Another Copy',
      'var(--text-mid)', 'transparent',
      function() { overlay.remove(); addFromBrowse(idx); }
    ));
  }

  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

// ── Collection list action helpers (resolve pdKey from itemNum/variation, then delegate) ──
// Owned menu for Science/Construction items (stored in dedicated tabs, not personalData)
function _showSpecialOwnedMenu(idx, item, ownedItems) {
  const existing = document.getElementById('owned-action-menu');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'owned-action-menu';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1.5rem';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
  const box = document.createElement('div');
  box.style.cssText = 'background:var(--surface);border:1px solid rgba(46,204,113,0.35);border-radius:16px;max-width:420px;width:100%;padding:1.75rem;position:relative';
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = 'position:absolute;top:0.75rem;right:0.75rem;background:none;border:none;color:var(--text-dim);font-size:1.1rem;cursor:pointer';
  closeBtn.onclick = function() { overlay.remove(); };
  box.appendChild(closeBtn);
  const hdr = document.createElement('div');
  hdr.style.cssText = 'font-family:var(--font-head);font-size:1rem;color:var(--green);margin-bottom:0.15rem';
  hdr.textContent = '✓ In Your Collection' + (ownedItems.length > 1 ? ' (' + ownedItems.length + ' copies)' : '');
  box.appendChild(hdr);
  const itemLbl = document.createElement('div');
  itemLbl.style.cssText = 'font-size:0.85rem;color:var(--text-mid);margin-bottom:0.15rem';
  itemLbl.textContent = 'No. ' + item.itemNum + (item.variation ? ' — Var. ' + item.variation : '');
  box.appendChild(itemLbl);
  const descLbl = document.createElement('div');
  descLbl.style.cssText = 'font-size:0.78rem;color:var(--text-dim);margin-bottom:1rem';
  const parts = [];
  if (ownedItems[0] && ownedItems[0].condition) parts.push('Condition: ' + ownedItems[0].condition + '/10');
  if (ownedItems[0] && ownedItems[0].estValue) parts.push('Worth: $' + parseFloat(ownedItems[0].estValue).toLocaleString());
  descLbl.textContent = parts.join(' · ') || item.description || '';
  box.appendChild(descLbl);
  // Action buttons
  const mkBtn = function(label, color, bg, handler) {
    const b = document.createElement('button');
    b.style.cssText = 'width:100%;padding:0.7rem 1rem;border-radius:9px;border:1.5px solid ' + color + ';color:' + color + ';background:' + bg + ';font-family:var(--font-body);font-size:0.9rem;font-weight:600;cursor:pointer;margin-bottom:0.5rem;text-align:left;display:flex;align-items:center;gap:0.5rem';
    b.innerHTML = label;
    b.onclick = handler;
    return b;
  };
  // Record a Sale
  box.appendChild(mkBtn(
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> Record a Sale',
    '#2ecc71', 'rgba(46,204,113,0.1)',
    function() { overlay.remove(); openWizard('sold'); }
  ));
  // List for Sale
  box.appendChild(mkBtn(
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> List for Sale',
    '#e67e22', 'rgba(230,126,34,0.1)',
    function() { overlay.remove(); openWizard('forsale'); }
  ));
  // View Details
  box.appendChild(mkBtn(
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> View Item Details',
    'var(--text-dim)', 'var(--surface2)',
    function() { overlay.remove(); showItemDetailPage(idx); }
  ));
  // Add Another Copy
  box.appendChild(mkBtn(
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> Add Another Copy',
    'var(--text-mid)', 'transparent',
    function() { overlay.remove(); addFromBrowse(idx); }
  ));
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function collectionActionForSale(globalIdx, itemNum, variation, pdRow) {
  var pdKey = pdRow ? findPDKeyByRow(itemNum, variation, pdRow) : findPDKey(itemNum, variation);
  if (!pdKey) { showToast('Item not found in collection', 3000, true); return; }
  _checkGroupBeforeForSale(globalIdx, pdKey);
}

function _checkGroupBeforeForSale(globalIdx, pdKey) {
  const pd = state.personalData[pdKey] || {};
  // No group? Proceed normally
  if (!pd.groupId) { listForSaleFromCollection(globalIdx, pdKey); return; }
  // Find siblings in same group
  const siblings = Object.entries(state.personalData)
    .filter(([k, p]) => k !== pdKey && p.groupId === pd.groupId && p.owned);
  // No siblings? Proceed normally
  if (!siblings.length) { listForSaleFromCollection(globalIdx, pdKey); return; }

  // Build item list for display
  const allItems = [[pdKey, pd], ...siblings];
  const itemList = allItems.map(([, p]) => p.itemNum).join(', ');

  // Build item list with pricing details
  let _totalPaid = 0, _totalWorth = 0, _hasPaid = false, _hasWorth = false;
  const _itemRows = allItems.map(([, p]) => {
    const paid = parseFloat(p.itemBoxPrice) || parseFloat(p.itemOnlyPrice) || 0;
    const worth = parseFloat(p.userEstWorth) || 0;
    if (paid > 0) _hasPaid = true;
    if (worth > 0) _hasWorth = true;
    _totalPaid += paid;
    _totalWorth += worth;
    return { num: p.itemNum, paid, worth };
  });
  const _itemTableHtml = '<div style="margin:0.6rem 0 0.75rem;border:1px solid var(--border);border-radius:10px;overflow:hidden">'
    + '<table style="width:100%;border-collapse:collapse;font-size:0.8rem">'
    + '<tr style="background:var(--surface2)">'
    + '<th style="text-align:left;padding:0.4rem 0.6rem;font-family:var(--font-head);font-size:0.62rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-dim)">Item</th>'
    + (_hasPaid ? '<th style="text-align:right;padding:0.4rem 0.6rem;font-family:var(--font-head);font-size:0.62rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-dim)">Paid</th>' : '')
    + (_hasWorth ? '<th style="text-align:right;padding:0.4rem 0.6rem;font-family:var(--font-head);font-size:0.62rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-dim)">Est. Worth</th>' : '')
    + '</tr>'
    + _itemRows.map(r => '<tr style="border-top:1px solid var(--border)">'
      + '<td style="padding:0.4rem 0.6rem;font-family:var(--font-mono);font-weight:600;color:var(--accent)">' + r.num + '</td>'
      + (_hasPaid ? '<td style="text-align:right;padding:0.4rem 0.6rem;color:var(--text-mid)">' + (r.paid > 0 ? '$' + r.paid.toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:2}) : '—') + '</td>' : '')
      + (_hasWorth ? '<td style="text-align:right;padding:0.4rem 0.6rem;color:var(--gold)">' + (r.worth > 0 ? '$' + r.worth.toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:2}) : '—') + '</td>' : '')
      + '</tr>').join('')
    + ((_hasPaid || _hasWorth) ? '<tr style="border-top:2px solid var(--border);background:var(--surface2)">'
      + '<td style="padding:0.4rem 0.6rem;font-weight:700;font-size:0.75rem;color:var(--text)">Total</td>'
      + (_hasPaid ? '<td style="text-align:right;padding:0.4rem 0.6rem;font-weight:700;color:var(--text-mid)">$' + _totalPaid.toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:2}) + '</td>' : '')
      + (_hasWorth ? '<td style="text-align:right;padding:0.4rem 0.6rem;font-weight:700;color:var(--gold)">$' + _totalWorth.toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:2}) + '</td>' : '')
      + '</tr>' : '')
    + '</table></div>';

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1.5rem';
  overlay.innerHTML = `
    <div style="background:var(--surface);border-radius:16px;padding:1.5rem;max-width:420px;width:100%;border:1px solid var(--border)">
      <div style="font-family:var(--font-head);font-size:1rem;font-weight:700;margin-bottom:0.4rem">This is a grouped item</div>
      <div style="font-size:0.84rem;color:var(--text-mid);margin-bottom:0.15rem">
        <strong style="color:var(--text)">${allItems.length} items</strong> in this group:
      </div>
      ${_itemTableHtml}
      <div style="font-size:0.84rem;color:var(--text-mid);margin-bottom:1rem">
        Are you selling this as a set or individually?
      </div>
      <div id="_grpfs-set-section" style="display:flex;flex-direction:column;gap:0.5rem">
        <button id="_grpfs-set" style="padding:0.8rem 1rem;border-radius:10px;border:2px solid #e67e22;background:rgba(230,126,34,0.1);color:#e67e22;font-family:var(--font-body);font-size:0.88rem;font-weight:600;cursor:pointer;text-align:left">
          Sell as a set<br>
          <span style="font-weight:400;font-size:0.78rem;color:var(--text-dim)">List all ${allItems.length} items together for one price</span>
        </button>
        <button id="_grpfs-indiv" style="padding:0.8rem 1rem;border-radius:10px;border:2px solid var(--accent);background:rgba(232,64,28,0.08);color:var(--accent);font-family:var(--font-body);font-size:0.88rem;font-weight:600;cursor:pointer;text-align:left">
          Sell individually<br>
          <span style="font-weight:400;font-size:0.78rem;color:var(--text-dim)">List only No. ${pd.itemNum} and break up the group</span>
        </button>
        <button id="_grpfs-cancel" style="padding:0.75rem;border-radius:10px;border:1px solid var(--border);background:none;color:var(--text-dim);font-family:var(--font-body);font-size:0.85rem;cursor:pointer">Cancel</button>
      </div>
      <div id="_grpfs-price-section" style="display:none;flex-direction:column;gap:0.6rem">
        <div style="font-size:0.84rem;color:var(--text-mid)">Enter the asking price for the entire set:</div>
        ${(_hasPaid || _hasWorth) ? '<div style="display:flex;gap:1rem;font-size:0.78rem;color:var(--text-dim);margin-bottom:0.15rem">' + (_hasPaid ? '<span>Total Paid: <strong style="color:var(--text-mid)">$' + _totalPaid.toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:2}) + '</strong></span>' : '') + (_hasWorth ? '<span>Est. Worth: <strong style="color:var(--gold)">$' + _totalWorth.toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:2}) + '</strong></span>' : '') + '</div>' : ''}
        <div style="display:flex;align-items:center;gap:0.5rem">
          <span style="font-size:1.1rem;color:var(--text-dim)">$</span>
          <input id="_grpfs-price-input" type="number" min="0" step="0.01" placeholder="0.00" style="flex:1;padding:0.6rem 0.8rem;border-radius:8px;border:1.5px solid var(--accent2);background:var(--surface2);color:var(--text);font-family:var(--font-mono);font-size:1rem;outline:none">
        </div>
        <button id="_grpfs-price-save" style="padding:0.75rem 1rem;border-radius:10px;border:none;background:var(--accent);color:white;font-family:var(--font-body);font-size:0.88rem;font-weight:700;cursor:pointer">List all ${allItems.length} items for sale</button>
        <button id="_grpfs-price-back" style="padding:0.65rem;border-radius:10px;border:1px solid var(--border);background:none;color:var(--text-dim);font-family:var(--font-body);font-size:0.85rem;cursor:pointer">Back</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  // Cancel
  document.getElementById('_grpfs-cancel').onclick = () => overlay.remove();

  // ── SELL AS A SET ──
  document.getElementById('_grpfs-set').onclick = () => {
    document.getElementById('_grpfs-set-section').style.display = 'none';
    const priceSection = document.getElementById('_grpfs-price-section');
    priceSection.style.display = 'flex';
    setTimeout(() => document.getElementById('_grpfs-price-input').focus(), 100);
  };

  // Back from price input
  document.getElementById('_grpfs-price-back').onclick = () => {
    document.getElementById('_grpfs-price-section').style.display = 'none';
    document.getElementById('_grpfs-set-section').style.display = 'flex';
  };

  // Save set listing
  document.getElementById('_grpfs-price-save').onclick = async () => {
    const priceInput = document.getElementById('_grpfs-price-input');
    const askingPrice = priceInput ? priceInput.value : '';
    if (!askingPrice || parseFloat(askingPrice) <= 0) {
      if (priceInput) { priceInput.style.borderColor = 'var(--accent)'; priceInput.focus(); }
      showToast('Please enter an asking price', 3000);
      return;
    }
    const saveBtn = document.getElementById('_grpfs-price-save');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }
    try {
      const today = new Date().toISOString().split('T')[0];
      const sheetId = state.personalSheetId;
      // Lead item gets full price
      for (let i = 0; i < allItems.length; i++) {
        const [aKey, aPd] = allItems[i];
        const isLead = i === 0;
        const fsKey = aPd.itemNum + '|' + (aPd.variation || '');
        const fsRow = [
          aPd.itemNum, aPd.variation || '',
          aPd.condition || '',
          isLead ? askingPrice : '',
          today,
          isLead ? 'Set sale: ' + itemList : 'Set price on ' + pd.itemNum + ' — set sale: ' + itemList,
          aPd.priceItem || '',
          aPd.userEstWorth || '',
          aPd.inventoryId || '',
          aPd.manufacturer || _getEraManufacturer(),
        ];
        const existingFs = state.forSaleData[fsKey];
        if (existingFs && existingFs.row) {
          await sheetsUpdate(sheetId, 'For Sale!A' + existingFs.row + ':J' + existingFs.row, [fsRow]);
        } else {
          await sheetsAppend(sheetId, 'For Sale!A:J', [fsRow]);
        }
        state.forSaleData[fsKey] = {
          row: existingFs ? existingFs.row : 99999,
          itemNum: aPd.itemNum, variation: aPd.variation || '',
          condition: aPd.condition || '', askingPrice: isLead ? askingPrice : '',
          dateListed: today,
          notes: fsRow[5], originalPrice: aPd.priceItem || '',
          estWorth: aPd.userEstWorth || '',
          inventoryId: aPd.inventoryId || '',
        };
      }
      overlay.remove();
      _cachePersonalData();
      buildForSalePage();
      renderBrowse();
      showToast('✓ ' + allItems.length + ' items listed for sale as a set!');
    } catch(e) {
      console.error('Group for sale error:', e);
      showToast('❌ Error: ' + e.message, 5000, true);
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'List all ' + allItems.length + ' items for sale'; }
    }
  };

  // ── SELL INDIVIDUALLY ──
  document.getElementById('_grpfs-indiv').onclick = async () => {
    const indivBtn = document.getElementById('_grpfs-indiv');
    if (indivBtn) { indivBtn.disabled = true; indivBtn.textContent = 'Breaking group…'; }
    try {
      const sheetId = state.personalSheetId;
      // Remove groupId from ALL items in this group
      for (const [aKey, aPd] of allItems) {
        if (aPd.row && aPd.row !== 99999) {
          await sheetsUpdate(sheetId, 'My Collection!V' + aPd.row, [['']]);
        }
        aPd.groupId = '';
      }
      overlay.remove();
      showToast('Group broken up — now list your item');
      renderBrowse();
      // Proceed to normal For Sale wizard for just this item
      listForSaleFromCollection(globalIdx, pdKey);
    } catch(e) {
      console.error('Group break error:', e);
      showToast('❌ Error: ' + e.message, 5000, true);
      if (indivBtn) { indivBtn.disabled = false; indivBtn.textContent = 'Sell individually'; }
    }
  };
}

function collectionActionSold(globalIdx, itemNum, variation, pdRow) {
  var pdKey = pdRow ? findPDKeyByRow(itemNum, variation, pdRow) : findPDKey(itemNum, variation);
  if (!pdKey) { showToast('Item not found in collection', 3000, true); return; }
  _checkSetBeforeAction(pdKey, () => sellFromCollection(globalIdx, pdKey));
}

function _checkSetBeforeAction(pdKey, proceed) {
  const pd = state.personalData[pdKey] || {};
  if (!pd.groupId) { proceed(); return; }
  // Check if this groupId has other members
  const siblings = Object.entries(state.personalData)
    .filter(([k, p]) => k !== pdKey && p.groupId === pd.groupId);
  if (!siblings.length) { proceed(); return; }
  // Show set breakup modal
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1.5rem';
  overlay.innerHTML = `
    <div style="background:var(--surface);border-radius:16px;padding:1.5rem;max-width:380px;width:100%;border:1px solid var(--border)">
      <div style="font-family:var(--font-head);font-size:1rem;font-weight:700;margin-bottom:0.4rem">This item is part of a set</div>
      <div style="font-size:0.84rem;color:var(--text-mid);margin-bottom:1.25rem">
        ${pd.setNum ? 'Set ' + pd.setNum + ' · ' : ''}${siblings.length + 1} items share this group.
        What would you like to do?
      </div>
      <div style="display:flex;flex-direction:column;gap:0.5rem">
        <button id="_setaction-proceed" style="padding:0.8rem 1rem;border-radius:10px;border:2px solid #27ae60;background:rgba(39,174,96,0.1);color:#27ae60;font-family:var(--font-body);font-size:0.88rem;font-weight:600;cursor:pointer;text-align:left">
          Continue — list as incomplete set<br>
          <span style="font-weight:400;font-size:0.78rem;color:var(--text-dim)">Other set items keep their group ID</span>
        </button>
        <button id="_setaction-break" style="padding:0.8rem 1rem;border-radius:10px;border:2px solid var(--accent);background:rgba(232,64,28,0.08);color:var(--accent);font-family:var(--font-body);font-size:0.88rem;font-weight:600;cursor:pointer;text-align:left">
          Break up the set<br>
          <span style="font-weight:400;font-size:0.78rem;color:var(--text-dim)">Removes group from all ${siblings.length + 1} items</span>
        </button>
        <button id="_setaction-cancel" style="padding:0.75rem;border-radius:10px;border:1px solid var(--border);background:none;color:var(--text-dim);font-family:var(--font-body);font-size:0.85rem;cursor:pointer">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('_setaction-proceed').onclick = () => { overlay.remove(); proceed(); };
  document.getElementById('_setaction-cancel').onclick  = () => overlay.remove();
  document.getElementById('_setaction-break').onclick   = async () => {
    overlay.remove();
    const allGroup = [[pdKey, pd], ...siblings];

    // Check if any item has a purchase price (stored on loco)
    const _priceItem = allGroup.find(([,p]) => p.priceItem && parseFloat(p.priceItem) > 0);
    const _worthItem = allGroup.find(([,p]) => p.userEstWorth && parseFloat(p.userEstWorth) > 0);
    const _hasMoney  = _priceItem || _worthItem;

    if (_hasMoney) {
      const _locoNum   = (_priceItem || _worthItem)[1].itemNum;
      const _price     = _priceItem ? parseFloat(_priceItem[1].priceItem) : 0;
      const _worth     = _worthItem ? parseFloat(_worthItem[1].userEstWorth) : 0;
      const _count     = allGroup.length;
      const _perPrice  = _price  ? '$' + (_price  / _count).toFixed(2) : null;
      const _perWorth  = _worth  ? '$' + (_worth  / _count).toFixed(2) : null;

      // Show price-split modal
      const o2 = document.createElement('div');
      o2.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1.5rem';
      o2.innerHTML = `
        <div style="background:var(--surface);border-radius:16px;padding:1.5rem;max-width:380px;width:100%;border:1px solid var(--border)">
          <div style="font-family:var(--font-head);font-size:1rem;font-weight:700;margin-bottom:0.4rem">What about the price?</div>
          <div style="font-size:0.84rem;color:var(--text-mid);margin-bottom:1.1rem">
            ${_price ? 'Purchase price of <strong style="color:var(--text)">$' + _price.toFixed(2) + '</strong>' : ''}
            ${_price && _worth ? ' and ' : ''}
            ${_worth ? 'estimated value of <strong style="color:var(--text)">$' + _worth.toFixed(2) + '</strong>' : ''}
            ${_price || _worth ? ' is stored on the locomotive <span style="font-family:var(--font-mono);color:var(--accent);font-weight:600">' + _locoNum + '</span>.' : ''}
          </div>
          <div style="display:flex;flex-direction:column;gap:0.5rem">
            <button id="_split-even" style="padding:0.8rem 1rem;border-radius:10px;border:2px solid #27ae60;background:rgba(39,174,96,0.1);color:#27ae60;font-family:var(--font-body);font-size:0.88rem;font-weight:600;cursor:pointer;text-align:left">
              Split evenly across all ${_count} items<br>
              <span style="font-weight:400;font-size:0.78rem;color:var(--text-dim)">${[_perPrice ? _perPrice + ' per item (price)' : '', _perWorth ? _perWorth + ' per item (value)' : ''].filter(Boolean).join(' · ')}</span>
            </button>
            <button id="_split-assign" style="padding:0.8rem 1rem;border-radius:10px;border:1px solid var(--border);background:var(--surface2);color:var(--text-mid);font-family:var(--font-body);font-size:0.88rem;font-weight:600;cursor:pointer;text-align:left">
              Assign value to each item<br>
              <span style="font-weight:400;font-size:0.78rem;color:var(--text-dim)">Enter price &amp; value individually for each piece</span>
            </button>
            <button id="_split-clear" style="padding:0.8rem 1rem;border-radius:10px;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body);font-size:0.85rem;font-weight:600;cursor:pointer;text-align:left">
              Clear it<br>
              <span style="font-weight:400;font-size:0.78rem">Remove price &amp; value from all items</span>
            </button>
          </div>
        </div>`;
      document.body.appendChild(o2);

      const _doBreak = async (splitMode, customValues) => {
        o2.remove();
        for (const [k, p] of allGroup) {
          let newPrice, newWorth;
          if (splitMode === 'even') {
            newPrice = _price ? (_price / _count).toFixed(2) : '';
            newWorth = _worth ? (_worth / _count).toFixed(2) : '';
          } else if (splitMode === 'clear') {
            newPrice = '';
            newWorth = '';
          } else if (splitMode === 'assign' && customValues) {
            newPrice = customValues[k]?.price ?? '';
            newWorth = customValues[k]?.worth ?? '';
          } else {
            newPrice = p.priceItem || '';
            newWorth = p.userEstWorth || '';
          }
          state.personalData[k] = { ...p, groupId: '', priceItem: newPrice, userEstWorth: newWorth };
          if (p.row) {
            sheetsUpdate(state.personalSheetId, 'My Collection!E' + p.row, [[newPrice]])
              .catch(e => console.warn('price split row', p.row, e));
            sheetsUpdate(state.personalSheetId, 'My Collection!N' + p.row, [[newWorth]])
              .catch(e => console.warn('worth split row', p.row, e));
            sheetsUpdate(state.personalSheetId, 'My Collection!V' + p.row, [['']])
              .catch(e => console.warn('clear groupId row', p.row, e));
          }
        }
        _cachePersonalData();
        const _msg = splitMode === 'even'
          ? 'Set broken up — price split evenly across ' + _count + ' items'
          : splitMode === 'clear'
          ? 'Set broken up — price & value cleared'
          : splitMode === 'assign'
          ? 'Set broken up — values assigned per item'
          : 'Set broken up';
        showToast(_msg);
        proceed();
      };

      // Assign individually — show per-item input screen
      document.getElementById('_split-assign').onclick = () => {
        o2.remove();
        const perEven = { price: _price ? (_price/_count).toFixed(2) : '', worth: _worth ? (_worth/_count).toFixed(2) : '' };

        const o3 = document.createElement('div');
        o3.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
        const sheet = document.createElement('div');
        sheet.style.cssText = 'background:var(--surface);border-radius:16px 16px 0 0;padding:1.25rem;width:100%;max-width:520px;max-height:85vh;overflow-y:auto;-webkit-overflow-scrolling:touch';

        let html = `<div style="font-family:var(--font-head);font-size:0.65rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-dim);text-align:center;margin-bottom:0.85rem">Assign Price &amp; Value per Item</div>`;
        html += `<div style="display:grid;grid-template-columns:1fr 90px 90px;gap:0.3rem;margin-bottom:0.4rem;padding:0 0.1rem">
          <div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim)">Item</div>
          <div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);text-align:center">Paid ($)</div>
          <div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);text-align:center">Worth ($)</div>
        </div>`;

        allGroup.forEach(([k, p], i) => {
          const master = state.masterData.find(m => normalizeItemNum(m.itemNum) === normalizeItemNum(p.itemNum));
          const desc = master ? (master.roadName || master.description || '') : '';
          const safeKey = 'assign_' + i;
          html += `<div style="display:grid;grid-template-columns:1fr 90px 90px;gap:0.3rem;align-items:center;margin-bottom:0.45rem;padding:0.4rem 0.5rem;background:var(--surface2);border-radius:8px">
            <div>
              <div style="font-family:var(--font-mono);font-size:0.85rem;font-weight:700;color:var(--accent)">${p.itemNum}</div>
              ${desc ? `<div style="font-size:0.7rem;color:var(--text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${desc}</div>` : ''}
            </div>
            <input type="number" id="${safeKey}_price" value="${perEven.price}" min="0" step="0.01" placeholder="0.00"
              style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:0.4rem 0.5rem;color:var(--text);font-family:var(--font-mono);font-size:0.85rem;text-align:right;outline:none;box-sizing:border-box">
            <input type="number" id="${safeKey}_worth" value="${perEven.worth}" min="0" step="0.01" placeholder="0.00"
              style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:0.4rem 0.5rem;color:var(--text);font-family:var(--font-mono);font-size:0.85rem;text-align:right;outline:none;box-sizing:border-box">
          </div>`;
        });

        html += `<div style="display:flex;gap:0.6rem;margin-top:0.75rem;padding-bottom:0.25rem">
          <button id="_assign-cancel" style="flex:1;padding:0.7rem;border-radius:9px;border:1px solid var(--border);background:none;color:var(--text-dim);font-family:var(--font-body);font-size:0.88rem;cursor:pointer">Cancel</button>
          <button id="_assign-save" style="flex:2;padding:0.7rem;border-radius:9px;border:none;background:var(--accent);color:white;font-family:var(--font-body);font-size:0.88rem;font-weight:600;cursor:pointer">Save &amp; Break Up</button>
        </div>`;

        sheet.innerHTML = html;
        o3.appendChild(sheet);
        document.body.appendChild(o3);

        document.getElementById('_assign-cancel').onclick = () => o3.remove();
        document.getElementById('_assign-save').onclick = () => {
          const customValues = {};
          allGroup.forEach(([k], i) => {
            const safeKey = 'assign_' + i;
            customValues[k] = {
              price: document.getElementById(safeKey + '_price')?.value || '',
              worth: document.getElementById(safeKey + '_worth')?.value || '',
            };
          });
          o3.remove();
          _doBreak('assign', customValues);
        };
      };

      document.getElementById('_split-even').onclick  = () => _doBreak('even');
      document.getElementById('_split-clear').onclick = () => _doBreak('clear');

    } else {
      // No price data — just clear group IDs
      for (const [k, p] of allGroup) {
        state.personalData[k] = { ...p, groupId: '' };
        if (p.row) {
          sheetsUpdate(state.personalSheetId, 'My Collection!V' + p.row, [['']])
            .catch(e => console.warn('Clear groupId row', p.row, e));
        }
      }
      _cachePersonalData();
      showToast('Set broken up — items are now individual');
      proceed();
    }
  };
}

async function removeCollectionItem(itemNum, variation, row) {
  // Check if this item is part of a group with other members
  // Use row to disambiguate if multiple copies exist
  var pdKey = findPDKeyByRow(itemNum, variation, row);
  var thisPd = pdKey ? state.personalData[pdKey] : null;
  var groupId = thisPd && thisPd.groupId;
  var groupSiblings = groupId
    ? Object.values(state.personalData).filter(p => p.groupId === groupId && p.owned)
    : [];
  var isGrouped = groupSiblings.length > 1;

  if (isGrouped) {
    // Show choice modal — remove just this item or the whole group
    var groupLabels = groupSiblings.map(p => p.itemNum).join(' + ');
    var choice = await new Promise(function(resolve) {
      var siblings = groupSiblings.filter(p => p.itemNum !== itemNum).map(p => p.itemNum).join(', ');
      var overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9500;display:flex;align-items:center;justify-content:center;padding:1rem';
      overlay.innerHTML = `
        <div style="background:var(--surface);border:1.5px solid var(--border);border-radius:14px;padding:1.5rem;max-width:360px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,0.5)">
          <div style="font-size:0.72rem;font-weight:700;letter-spacing:0.1em;color:var(--accent);text-transform:uppercase;margin-bottom:0.5rem">Remove Item</div>
          <div style="font-size:0.9rem;color:var(--text);margin-bottom:0.2rem;line-height:1.5">
            Item <strong>${itemNum}</strong> is grouped with <strong>${siblings}</strong>.
          </div>
          <div style="font-size:0.85rem;color:var(--text-mid);margin-bottom:1.25rem;line-height:1.5">Do you want to remove just this item, or all items in the group?</div>
          <div style="display:flex;flex-direction:column;gap:0.5rem">
            <button id="rm-just-one" style="padding:0.55rem 1rem;border-radius:8px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.85rem;cursor:pointer;text-align:left;line-height:1.4">
              Remove <strong>${itemNum}</strong> only
            </button>
            <button id="rm-all-group" style="padding:0.55rem 1rem;border-radius:8px;border:1.5px solid var(--accent);background:rgba(240,80,8,0.08);color:var(--accent);font-family:var(--font-body);font-size:0.85rem;cursor:pointer;text-align:left;font-weight:600;line-height:1.4">
              Remove all grouped items (${groupLabels})
            </button>
            <button id="rm-cancel" style="padding:0.45rem 1rem;border-radius:8px;border:1px solid var(--border);background:none;color:var(--text-dim);font-family:var(--font-body);font-size:0.82rem;cursor:pointer;margin-top:0.25rem">Cancel</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      overlay.querySelector('#rm-just-one').onclick  = function() { document.body.removeChild(overlay); resolve('one'); };
      overlay.querySelector('#rm-all-group').onclick = function() { document.body.removeChild(overlay); resolve('all'); };
      overlay.querySelector('#rm-cancel').onclick    = function() { document.body.removeChild(overlay); resolve('cancel'); };
    });
    if (choice === 'cancel') return;

    if (choice === 'all') {
      // Remove every item in the group — delete from bottom to top to avoid row shift issues
      var sortedSibs = groupSiblings.slice().sort(function(a, b) { return (b.row || 0) - (a.row || 0); });
      var fsRowsToDelete = [];
      for (var sib of sortedSibs) {
        var sibKey = sib.inventoryId || findPDKeyByRow(sib.itemNum, sib.variation, sib.row);
        if (sib.row && sib.row !== 99999) {
          try {
            await sheetsDeleteRow(state.personalSheetId, 'My Collection', sib.row);
            _adjustRowsAfterDelete(state.personalData, sib.row);
          } catch(e) { console.warn('Remove group row error:', sib.itemNum, e); }
        }
        var sibFsKey = sib.itemNum + '|' + (sib.variation || '');
        var sibFs = state.forSaleData[sibFsKey];
        if (sibFs && sibFs.row) {
          fsRowsToDelete.push(sibFs.row);
          delete state.forSaleData[sibFsKey];
        }
        if (sibKey) delete state.personalData[sibKey];
      }
      // Delete For Sale rows bottom-to-top
      fsRowsToDelete.sort(function(a, b) { return b - a; });
      for (var fsRow of fsRowsToDelete) {
        try {
          await sheetsDeleteRow(state.personalSheetId, 'For Sale', fsRow);
          _adjustRowsAfterDelete(state.forSaleData, fsRow);
        } catch(e) { console.warn('FS cleanup:', e); }
      }
      _cachePersonalData();
      renderBrowse();
      buildDashboard();
      showToast('✓ Removed ' + groupSiblings.length + ' grouped items');
      return;
    }
    // else fall through to remove just this one item
  } else {
    // Standalone item — simple confirm
    if (!(await appConfirm('Remove No. ' + itemNum + (variation ? ' (Var. ' + variation + ')' : '') + ' from your collection?', { danger: true, ok: 'Remove' }))) return;
  }

  // ── Remove single item ──
  var _delRow = thisPd ? thisPd.row : row;
  if (_delRow && _delRow !== 99999) {
    try {
      await sheetsDeleteRow(state.personalSheetId, 'My Collection', _delRow);
    } catch(e) { console.error('Remove row error:', e); showToast('Error removing item — please try again', 3000, true); return; }
  }
  // Also remove from For Sale if listed
  var fsKey = itemNum + '|' + (variation || '');
  var fsEntry = state.forSaleData[fsKey];
  if (fsEntry && fsEntry.row) {
    try {
      await sheetsDeleteRow(state.personalSheetId, 'For Sale', fsEntry.row);
      _adjustRowsAfterDelete(state.forSaleData, fsEntry.row);
    } catch(e) { console.warn('For Sale cleanup:', e); }
    delete state.forSaleData[fsKey];
  }
  if (pdKey) delete state.personalData[pdKey];
  if (_delRow && _delRow !== 99999) _adjustRowsAfterDelete(state.personalData, _delRow);
  _cachePersonalData();
  renderBrowse();
  buildDashboard();
  showToast('✓ Removed from collection');
}

// After deleting a sheet row, decrement .row on all in-memory records above that row.
// This keeps row numbers accurate without a full background reload.
function _adjustRowsAfterDelete(dataObj, deletedRow) {
  if (!deletedRow || deletedRow === 99999) return;
  Object.values(dataObj).forEach(rec => {
    if (rec.row && rec.row > deletedRow && rec.row !== 99999) rec.row--;
  });
}

function sellFromCollection(idx, pdKey) {
  const pd = state.personalData[pdKey] || {};
  const item = state.masterData[idx] || {
    itemNum: pd.itemNum, variation: pd.variation || '',
    roadName: pd.roadName || '', itemType: pd.itemType || '',
    yearProd: pd.yearMade || '', marketVal: '',
  };
  if (!item.itemNum) return;
  // Open sell wizard pre-filled with item info
  wizard = { step: 0, tab: 'sold', data: {
    tab: 'sold',
    itemNum: item.itemNum,
    variation: item.variation || '',
    condition: pd.condition || '',
    priceItem: pd.priceItem || '',
    estWorth: pd.userEstWorth || '',
    _collectionPdKey: pdKey,
    _collectionRow: pd.row
  }, steps: getSteps('sold'), matchedItem: item };
  document.getElementById('wizard-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
  // Skip tab, itemNum, variation steps
  const autoSkip = new Set(['tab', 'itemNum', 'variation', 'itemPicker', 'itemCategory']);
  while (wizard.step < wizard.steps.length - 1) {
    const s = wizard.steps[wizard.step];
    if (autoSkip.has(s.id) || (s.skipIf && s.skipIf(wizard.data))) wizard.step++;
    else break;
  }
  renderWizardStep();
}

function listForSaleFromCollection(idx, pdKey) {
  const pd = state.personalData[pdKey] || {};
  const item = state.masterData[idx] || {
    itemNum: pd.itemNum, variation: pd.variation || '',
    roadName: pd.roadName || '', itemType: pd.itemType || '',
    yearProd: pd.yearMade || '', marketVal: '',
  };
  // Pre-fill from collection data and existing for-sale listing
  const fsKey = pd.itemNum + '|' + (pd.variation || '');
  const existingFs = state.forSaleData[fsKey] || {};
  wizard = { step: 0, tab: 'forsale', data: {
    tab: 'forsale',
    itemNum: item.itemNum,
    variation: item.variation || '',
    condition: existingFs.condition || pd.condition || '',
    selectedForSaleKey: pdKey,
    askingPrice: existingFs.askingPrice || '',
    dateListed: existingFs.dateListed || '',
    notes: existingFs.notes || '',
    originalPrice: pd.priceItem || '',
    estWorth: pd.userEstWorth || '',
    _collectionPdKey: pdKey,
  }, steps: getSteps('forsale'), matchedItem: item };
  _buildWizardModal();
  document.getElementById('wizard-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
  // Skip tab, itemNum, pickForSaleItem, condition steps (all pre-filled from collection)
  const autoSkip = new Set(['tab', 'itemNum', 'variation', 'itemPicker', 'itemCategory', 'pickForSaleItem', 'condition']);
  while (wizard.step < wizard.steps.length - 1) {
    const s = wizard.steps[wizard.step];
    if (autoSkip.has(s.id) || (s.skipIf && s.skipIf(wizard.data))) wizard.step++;
    else break;
  }
  renderWizardStep();
}

function showPickFromCollectionForSale() {
  const owned = Object.entries(state.personalData).filter(function(e) { return e[1].owned; });
  if (owned.length === 0) {
    showToast('No items in your collection yet');
    return;
  }
  const existing = document.getElementById('pick-fs-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'pick-fs-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

  const box = document.createElement('div');
  box.style.cssText = 'background:var(--surface);border:1px solid rgba(230,126,34,0.4);border-radius:16px;max-width:480px;width:100%;position:relative;max-height:85vh;display:flex;flex-direction:column;overflow:hidden';

  // Header
  const hdr = document.createElement('div');
  hdr.style.cssText = 'padding:1rem 1.25rem;border-bottom:1px solid var(--border);flex-shrink:0;display:flex;align-items:center;justify-content:space-between';
  hdr.innerHTML = '<div style="font-family:var(--font-head);font-size:1rem;color:#e67e22">List from Collection</div>'
    + '<button onclick="document.getElementById(\'pick-fs-overlay\').remove()" style="background:none;border:none;color:var(--text-dim);font-size:1.1rem;cursor:pointer">✕</button>';
  box.appendChild(hdr);

  // Search
  const searchWrap = document.createElement('div');
  searchWrap.style.cssText = 'padding:0.6rem 1.25rem;border-bottom:1px solid var(--border);flex-shrink:0';
  searchWrap.innerHTML = '<input id="pick-fs-search" type="text" placeholder="Search item #, road name…" style="width:100%;border:1px solid var(--border);border-radius:7px;padding:0.45rem 0.7rem;background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.85rem;outline:none;box-sizing:border-box" oninput="_filterPickFs(this.value)">';
  box.appendChild(searchWrap);

  // Scrollable item list
  const listWrap = document.createElement('div');
  listWrap.id = 'pick-fs-list';
  listWrap.style.cssText = 'flex:1;overflow-y:auto;padding:0.5rem 1rem';
  box.appendChild(listWrap);

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  // Render the list
  _renderPickFsList('');
}

function _renderPickFsList(q) {
  const listEl = document.getElementById('pick-fs-list');
  if (!listEl) return;
  q = (q || '').toLowerCase();

  const owned = Object.entries(state.personalData).filter(function(e) {
    if (!e[1].owned) return false;
    if (!q) return true;
    var pd = e[1];
    var master = findMaster(pd.itemNum, (pd.variation||'')) || {};
    return (pd.itemNum||'').toLowerCase().includes(q)
      || (master.roadName||'').toLowerCase().includes(q)
      || (master.itemType||'').toLowerCase().includes(q)
      || (pd.variation||'').toLowerCase().includes(q);
  });

  // Sort by item number
  owned.sort(function(a,b) { return (a[1].itemNum||'').localeCompare(b[1].itemNum||'', undefined, {numeric:true}); });

  if (owned.length === 0) {
    listEl.innerHTML = '<div class="ui-empty">No matching items</div>';
    return;
  }

  var html = '';
  owned.forEach(function(entry) {
    var pdKey = entry[0], pd = entry[1];
    var master = findMaster(pd.itemNum, (pd.variation||'')) || {};
    var fsKey = pd.itemNum + '|' + (pd.variation||'');
    var alreadyListed = !!state.forSaleData[fsKey];
    var idx = state.masterData.indexOf(master);
    if (idx < 0) idx = -1;

    html += '<button onclick="_pickFsSelect(' + idx + ',\'' + pdKey.replace(/'/g,"\\'") + '\')" style="'
      + 'display:flex;align-items:center;gap:0.7rem;padding:0.7rem 0.85rem;'
      + 'border-radius:9px;text-align:left;width:100%;cursor:pointer;'
      + 'font-family:var(--font-body);margin-bottom:0.35rem;transition:all 0.15s;'
      + 'border:1.5px solid ' + (alreadyListed ? 'rgba(230,126,34,0.4)' : 'var(--border)') + ';'
      + 'background:' + (alreadyListed ? 'rgba(230,126,34,0.06)' : 'var(--surface2)') + '">'
      + '<div style="flex:1">'
      + '<div style="font-family:var(--font-mono);font-size:0.88rem;color:var(--accent2);font-weight:600">'
      + pd.itemNum + (pd.variation ? ' <span style="color:var(--text-dim);font-size:0.72rem">Var ' + pd.variation + '</span>' : '')
      + '</div>'
      + '<div style="font-size:0.78rem;color:var(--text-mid);margin-top:0.15rem">'
      + (master.roadName || master.itemType || '')
      + (pd.condition ? ' · Cond: ' + pd.condition + '/10' : '')
      + (pd.priceItem ? ' · Paid: $' + parseFloat(pd.priceItem).toLocaleString() : '')
      + '</div>'
      + '</div>'
      + (alreadyListed ? '<span style="font-size:0.68rem;color:#e67e22;font-weight:600;white-space:nowrap">LISTED</span>' : '')
      + '</button>';
  });
  listEl.innerHTML = html;
}

function _filterPickFs(q) { _renderPickFsList(q); }

function _pickFsSelect(idx, pdKey) {
  document.getElementById('pick-fs-overlay').remove();
  listForSaleFromCollection(idx, pdKey);
}

function updateCollectionItem(idx, pdKey) {
  showItemPanel(idx, pdKey, 'edit');
}

function showItemPanel(idx, pdKey, mode) {
  const pd = state.personalData[pdKey] || {};
  const item = state.masterData[idx] || {
    itemNum: pd.itemNum, variation: pd.variation || '',
    roadName: pd.roadName || '', itemType: pd.itemType || '',
    yearProd: pd.yearMade || '', marketVal: '', // market value comes from master sheet only
    varDesc: '', description: '',
  };

  const existing = document.getElementById('item-panel-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'item-panel-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

  const box = document.createElement('div');
  box.style.cssText = 'background:var(--surface);border:1px solid rgba(41,128,185,0.35);border-radius:16px;max-width:500px;width:100%;position:relative;max-height:92vh;display:flex;flex-direction:column;overflow:hidden';

  // Header
  const header = document.createElement('div');
  header.style.cssText = 'padding:1.25rem 1.5rem;border-bottom:1px solid var(--border);flex-shrink:0';
  header.innerHTML = '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:0.5rem">'
    + '<div>'
    + '<div style="font-family:var(--font-head);font-size:1rem;color:#2980b9">No. ' + item.itemNum + (item.variation ? ' <span style="color:var(--text-dim);font-size:0.75rem">Var. ' + item.variation + '</span>' : '') + '</div>'
    + '<div style="font-size:0.82rem;color:var(--text-mid);margin-top:2px">' + (item.roadName || item.itemType || '') + (item.yearProd ? ' · ' + item.yearProd : '') + '</div>'
    + '</div>'
    + '<button id="item-panel-close-btn" style="background:none;border:none;color:var(--text-dim);font-size:1.1rem;cursor:pointer;flex-shrink:0">✕</button>'
    + '</div>';
  box.appendChild(header);
  // Wire close btn now that header is in memory
  const _hdrClose = header.querySelector('#item-panel-close-btn');
  if (_hdrClose) _hdrClose.onclick = function() { overlay.remove(); };

  // Scrollable content — split into photos (permanent) + fields (re-rendered)
  const body = document.createElement('div');
  body.style.cssText = 'flex:1;overflow-y:auto;padding:0.75rem 1.5rem';
  const photoContainer = document.createElement('div');
  photoContainer.id = 'item-panel-photo-container';
  body.appendChild(photoContainer);
  const fieldsContainer = document.createElement('div');
  fieldsContainer.id = 'item-panel-fields-container';
  body.appendChild(fieldsContainer);

  const fields = [
    { label: 'Condition',     key: 'condition',     val: pd.condition || '—',     type: 'number', min:1, max:10 },
    { label: 'All Original',  key: 'allOriginal',   val: pd.allOriginal || '—',   type: 'select', options: ['Yes','No','Unknown'] },
    { label: 'Has Box',       key: 'hasBox',        val: pd.hasBox || '—',        type: 'select', options: ['Yes','No'] },
    { label: 'Box Condition', key: 'boxCond',       val: pd.boxCond || '—',       type: 'number', min:1, max:10 },
    { label: 'Price Paid ($)',key: 'priceItem',     val: pd.priceItem || '—',     type: 'number' },
    { label: 'Est. Worth (insurance)',key: 'userEstWorth',  val: pd.userEstWorth || '—',  type: 'number' },
    { label: 'Year Made',     key: 'yearMade',      val: pd.yearMade || '—',      type: 'number', min:1945, max:1969 },
    { label: 'Date Purchased',key: 'datePurchased', val: pd.datePurchased || '—', type: 'date' },
    { label: 'Notes',         key: 'notes',         val: pd.notes || '—',         type: 'text' },
    { label: 'Location',      key: 'location',      val: pd.location || '—',      type: 'text' },
    ...(item.refLink ? [{ label: 'COTT Reference', key: null, val: item.refLink, type: 'readonly' }] : []),
    ...(pd.isError === 'Yes' || item.errorDesc ? [{ label: 'Error', key: null, val: pd.errorDesc || '—', type: 'readonly' }] : []),
  ];

  // ── Photos section ──
  const photoSection = document.createElement('div');
  photoSection.id = 'item-panel-photos';
  photoSection.style.cssText = 'padding:0.75rem 0;border-bottom:1px solid var(--border);margin-bottom:0.25rem';

  // Header row with label + "Add Photos" button
  const photoHdr = document.createElement('div');
  photoHdr.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem';
  photoHdr.innerHTML = '<span style="font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.08em">Photos</span>';
  const addPhotoBtn = document.createElement('button');
  addPhotoBtn.style.cssText = 'font-size:0.72rem;padding:0.2rem 0.55rem;border-radius:5px;border:1px solid #2980b9;color:#2980b9;background:rgba(224,64,40,0.08);cursor:pointer;display:flex;align-items:center;gap:0.25rem';
  addPhotoBtn.innerHTML = '📷 Add Photos';
  addPhotoBtn.onclick = function() {
    // Close this panel and open photo wizard for this item
    document.getElementById('item-panel-overlay').remove();
    openPhotoWizard(item.itemNum, pd.variation || item.variation || '', pdKey);
  };
  photoHdr.appendChild(addPhotoBtn);
  photoSection.appendChild(photoHdr);

  // Thumbnail row
  const thumbRow = document.createElement('div');
  thumbRow.id = 'item-panel-thumb-row';
  thumbRow.style.cssText = 'display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center';
  thumbRow.innerHTML = '<span style="font-size:0.75rem;color:var(--text-dim)">Loading…</span>';
  photoSection.appendChild(thumbRow);

  // Folder link
  const folderLinkEl = document.createElement('div');
  folderLinkEl.id = 'item-panel-folder-link';
  folderLinkEl.style.cssText = 'margin-top:0.4rem;min-height:1.2rem';
  photoSection.appendChild(folderLinkEl);

  photoContainer.appendChild(photoSection);

  // Async load photos — use direct references (element not in DOM yet when IIFE fires)
  const _thumbRowRef = thumbRow;
  const _folderLinkRef = folderLinkEl;
  (async function() {
    const tr2 = _thumbRowRef;
    const fl2 = _folderLinkRef;
    try {
      // Wait for accessToken to be available (max 5s)
      let waited = 0;
      while (!accessToken && waited < 5000) {
        await new Promise(r => setTimeout(r, 200));
        waited += 200;
      }
      if (!accessToken) {
        if (tr2) tr2.innerHTML = '<span style="font-size:0.75rem;color:var(--text-dim)">Not signed in to Drive</span>';
        return;
      }

      let folderLink = pd.photoItem || '';
      if (!folderLink) {
        try { await driveEnsureSetup(); } catch(e) {}
        try {
          const folderId = await driveEnsureItemFolder(item.itemNum);
          folderLink = driveFolderLink(folderId);
        } catch(e) {}
      }

      // Show folder link
      if (fl2 && folderLink) {
        const a = document.createElement('a');
        a.href = folderLink; a.target = '_blank';
        a.style.cssText = 'font-size:0.72rem;color:#2980b9';
        a.textContent = '📁 Open Drive Folder ↗';
        fl2.innerHTML = '';
        fl2.appendChild(a);
      }

      if (!tr2) return;

      const photos = await driveGetFolderPhotos(folderLink);

      if (photos === null) {
        tr2.innerHTML = '<span style="font-size:0.75rem;color:var(--text-dim)">Could not load photos — check Drive access</span>';
        return;
      }
      if (photos.length === 0) {
        tr2.innerHTML = '<span style="font-size:0.75rem;color:var(--text-dim);font-style:italic">No photos yet — tap Add Photos</span>';
        return;
      }

      // Sort: RSV first, then FV, then others
      const priority = function(name) {
        const n = (name || '').toUpperCase();
        if (n.includes('RSV')) return 0;
        if (n.includes('FV'))  return 1;
        if (n.includes('TV'))  return 2;
        if (n.includes('BV'))  return 3;
        return 9;
      };
      photos.sort(function(a,b) { return priority(a.name) - priority(b.name); });

      tr2.innerHTML = '';
      photos.forEach(function(p) {
        const isRSV = p.name.toUpperCase().includes('RSV');
        const a = document.createElement('a');
        a.href = p.view; a.target = '_blank';
        a.title = p.name.replace(/\.[^.]+$/, '');
        a.style.cssText = 'display:inline-block;border-radius:8px;overflow:hidden;border:2px solid '
          + (isRSV ? '#2980b9' : 'var(--border)') + ';flex-shrink:0';
        const img = document.createElement('img');
        img.style.cssText = 'width:80px;height:80px;object-fit:cover;display:block;background:var(--surface2)';
        img.alt = p.name.replace(/\.[^.]+$/, '').split(' ').pop();
        // Authenticated load using file ID
        loadDriveThumb(p.id, img, a);
        const lbl = document.createElement('div');
        lbl.style.cssText = 'font-size:0.68rem;text-align:center;padding:2px 0;background:var(--surface2);color:var(--text-dim);letter-spacing:0.03em';
        lbl.textContent = p.name.replace(/\.[^.]+$/, '').split(' ').pop();
        a.appendChild(img);
        a.appendChild(lbl);
        tr2.appendChild(a);
      });

    } catch(e) {
      console.error('Photo load error:', e);
      if (tr2) tr2.innerHTML = '<span style="font-size:0.75rem;color:var(--text-dim)">Could not load photos</span>';
    }
  })();

  // Track which field is being edited
  let editingKey = null;

  function renderFields(activeKey) {
    fieldsContainer.innerHTML = '';
    fields.forEach(function(f) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:0.75rem;padding:0.65rem 0;border-bottom:1px solid var(--border);min-height:44px';

      const lbl = document.createElement('div');
      lbl.style.cssText = 'font-size:0.75rem;color:var(--text-dim);width:120px;flex-shrink:0';
      lbl.textContent = f.label;

      const valWrap = document.createElement('div');
      valWrap.style.cssText = 'flex:1';

      // Bugfix 2026-04-14: skip edit branch for null-keyed fields (COTT Reference, Error)
      // and for readonly/link types — otherwise activeKey===null matches f.key===null on
      // initial render and renders an editable input for read-only fields.
      if (mode === 'edit' && f.key != null && f.type !== 'readonly' && f.type !== 'link' && activeKey === f.key) {
        // Show input
        let inp;
        if (f.type === 'select') {
          inp = document.createElement('select');
          inp.style.cssText = 'width:100%;background:var(--bg);border:1px solid #2980b9;border-radius:6px;padding:0.4rem 0.6rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem';
          f.options.forEach(function(o) {
            const opt = document.createElement('option');
            opt.value = o; opt.textContent = o;
            if (o === (pd[f.key] || '')) opt.selected = true;
            inp.appendChild(opt);
          });
        } else {
          inp = document.createElement('input');
          inp.type = f.type === 'text' ? 'text' : f.type;
          inp.value = pd[f.key] || '';
          if (f.min !== undefined) inp.min = f.min;
          if (f.max !== undefined) inp.max = f.max;
          inp.style.cssText = 'width:100%;background:var(--bg);border:1px solid #2980b9;border-radius:6px;padding:0.4rem 0.6rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem;box-sizing:border-box';
        }
        inp.id = 'panel-inp-' + f.key;
        setTimeout(function() { if (inp) inp.focus(); }, 30);

        const doneBtn = document.createElement('button');
        doneBtn.textContent = '✓';
        doneBtn.style.cssText = 'margin-left:0.4rem;padding:0.3rem 0.6rem;border-radius:6px;border:1px solid #2980b9;background:#2980b9;color:#fff;cursor:pointer;font-size:0.85rem;flex-shrink:0';
        doneBtn.onclick = function() {
          pd[f.key] = inp.value;
          f.val = inp.value || '—';
          editingKey = null;
          renderFields(null);
        };

        const cancelInp = document.createElement('button');
        cancelInp.textContent = '✕';
        cancelInp.style.cssText = 'margin-left:0.25rem;padding:0.3rem 0.5rem;border-radius:6px;border:1px solid var(--border);background:none;color:var(--text-dim);cursor:pointer;font-size:0.85rem;flex-shrink:0';
        cancelInp.onclick = function() { editingKey = null; renderFields(null); };

        const inpRow = document.createElement('div');
        inpRow.style.cssText = 'display:flex;align-items:center;gap:0;width:100%';
        inpRow.appendChild(inp);
        inpRow.appendChild(doneBtn);
        inpRow.appendChild(cancelInp);
        valWrap.appendChild(inpRow);

      } else if (f.type === 'link') {
        // External link — render as clickable anchor, no edit
        const a = document.createElement('a');
        a.href = f.val;
        a.target = '_blank';
        a.rel = 'noopener';
        a.style.cssText = 'font-size:0.85rem;color:#2980b9;text-decoration:none;display:inline-flex;align-items:center;gap:0.3rem';
        a.innerHTML = 'View on COTT <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
        valWrap.appendChild(a);
        row.appendChild(lbl);
        row.appendChild(valWrap);
        fieldsContainer.appendChild(row);
        return;
      } else if (f.type === 'readonly') {
        // Read-only value with accent color, no edit
        const valEl = document.createElement('span');
        valEl.style.cssText = 'font-size:0.85rem;color:var(--accent);font-style:italic';
        valEl.textContent = f.val && f.val !== '—' ? f.val : '—';
        valWrap.appendChild(valEl);
        row.appendChild(lbl);
        row.appendChild(valWrap);
        fieldsContainer.appendChild(row);
        return;
      } else {
        // Show value
        const valEl = document.createElement('span');
        valEl.style.cssText = 'font-size:0.88rem;color:' + (f.val && f.val !== '—' ? 'var(--text)' : 'var(--text-dim)');
        valEl.textContent = f.val && f.val !== '—' ? f.val : '—';
        valWrap.appendChild(valEl);

        if (mode === 'edit') {
          const editBtn = document.createElement('button');
          editBtn.textContent = '✏️';
          editBtn.title = 'Edit';
          editBtn.style.cssText = 'margin-left:0.5rem;padding:0.15rem 0.4rem;border-radius:5px;border:1px solid var(--border);background:none;cursor:pointer;font-size:0.75rem;color:var(--text-dim)';
          editBtn.onclick = function() { editingKey = f.key; renderFields(f.key); };
          valWrap.appendChild(editBtn);
        }
      }

      row.appendChild(lbl);
      row.appendChild(valWrap);
      fieldsContainer.appendChild(row);
    });
  }

  renderFields(null);

  // Instruction Sheets linked to this item
  const _liNum = (item.itemNum || '').replace(/-[PD]$/,'').trim();
  const _linkedIS = Object.values(state.isData || {}).filter(s => {
    const li = (s.linkedItem || '').trim();
    return li === _liNum || li === item.itemNum;
  });
  if (_linkedIS.length) {
    const isSection = document.createElement('div');
    isSection.style.cssText = 'margin-top:0.75rem;padding-top:0.75rem;border-top:2px solid rgba(22,160,133,0.3)';
    isSection.innerHTML = '<div style="font-size:0.72rem;font-weight:600;letter-spacing:0.1em;color:#16a085;text-transform:uppercase;margin-bottom:0.5rem">📋 Instruction Sheets</div>'
      + _linkedIS.map(s => `<div onclick="openISDetail(${s.row})" style="display:flex;align-items:center;gap:0.6rem;padding:0.45rem 0.5rem;border-radius:8px;cursor:pointer;transition:background 0.1s" class="dash-row-hover">
        <span style="font-family:var(--font-mono);font-size:0.85rem;color:#16a085;font-weight:600;min-width:80px">${s.sheetNum}</span>
        <span style="font-size:0.8rem;color:var(--text-mid)">${s.year||''}</span>
        ${s.condition?`<span style="font-size:0.78rem;color:var(--text-dim);margin-left:auto">Cond: ${s.condition}/10</span>`:''}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
      </div>`).join('');
    body.appendChild(isSection);
  }

  box.appendChild(body);

  // Footer buttons
  const footer = document.createElement('div');
  footer.style.cssText = 'padding:1rem 1.5rem;border-top:1px solid var(--border);display:flex;gap:0.6rem;flex-shrink:0';

  if (mode === 'view') {
    const editModeBtn = document.createElement('button');
    editModeBtn.className = 'btn';
    editModeBtn.style.cssText = 'flex:1;border:1.5px solid #2980b9;color:#2980b9;background:rgba(224,64,40,0.08);font-weight:600';
    editModeBtn.innerHTML = '✏️ Edit This Item';
    editModeBtn.onclick = function() { mode = 'edit'; renderFields(null); footer.innerHTML = ''; buildFooter(); };
    footer.appendChild(editModeBtn);
  } else {
    buildFooter();
  }

  function buildFooter() {
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-primary';
    saveBtn.style.cssText = 'flex:1;background:#2980b9;border-color:#2980b9;font-weight:600';
    saveBtn.textContent = '💾 Save All Changes';
    saveBtn.onclick = async function() {
      saveBtn.textContent = 'Saving…'; saveBtn.disabled = true;
      // Collect all current pd values (updated in-place during edits)
      const priceItem = pd.priceItem || '';
      const priceBox = pd.priceBox || '';
      const calc = (parseFloat(priceItem)||0) + (parseFloat(priceBox)||0);
      const newRow = [
        item.itemNum, item.variation || '',
        pd.condition || '', pd.allOriginal || '',
        priceItem, priceBox, calc > 0 ? calc.toFixed(2) : '',
        pd.hasBox || '', pd.boxCond || '',
        pd.photoItem || '', pd.photoBox || '',
        pd.notes || '', pd.datePurchased || '',
        pd.userEstWorth || '', pd.matchedTo || '',
        pd.setId || '', pd.yearMade || '',
        pd.isError || '', pd.errorDesc || '',
        pd.quickEntry ? 'Yes' : '',
        pd.inventoryId || '', pd.groupId || '',
        pd.location || '',  // Location (col W)
        pd.era || '',        // Era (col X)
        pd.manufacturer || '', // Manufacturer (col Y)
      ];
      try {
        await sheetsUpdate(state.personalSheetId, 'My Collection!A' + pd.row + ':Y' + pd.row, [newRow]);
        state.personalData[pdKey] = Object.assign({}, pd, { priceComplete: calc > 0 ? calc.toFixed(2) : '' });
        overlay.remove();
        showToast('✓ Item updated!');
        buildDashboard();
      } catch(e) {
        saveBtn.textContent = '💾 Save All Changes'; saveBtn.disabled = false;
        showToast('Error: ' + e.message);
      }
    };

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = function() { overlay.remove(); };

    footer.innerHTML = '';
    footer.appendChild(saveBtn);
    footer.appendChild(cancelBtn);
  }

  box.appendChild(footer);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}


function openISDetail(rowKey) {
  const it = state.isData[rowKey];
  if (!it) return;
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem';
  overlay.onclick = e => { if(e.target===overlay) overlay.remove(); };
  const box = document.createElement('div');
  box.style.cssText = 'background:var(--surface);border:1px solid rgba(22,160,133,0.4);border-radius:16px;max-width:460px;width:100%;padding:1.75rem;position:relative;max-height:88vh;overflow-y:auto';
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML='✕'; closeBtn.style.cssText='position:absolute;top:0.75rem;right:0.75rem;background:none;border:none;color:var(--text-dim);font-size:1.1rem;cursor:pointer';
  closeBtn.onclick=()=>overlay.remove();
  box.appendChild(closeBtn);
  box.innerHTML += `
    <div style="font-family:var(--font-head);font-size:1rem;color:#16a085;margin-bottom:0.15rem">📋 Sheet # ${it.sheetNum}</div>
    <div style="font-size:0.82rem;color:var(--text-mid);margin-bottom:1.25rem">Instruction Sheet${it.linkedItem?' for Item No. '+it.linkedItem:''}</div>
    <div style="display:flex;flex-direction:column;gap:0.5rem;font-size:0.85rem">
      ${[
        ['Sheet #',       it.sheetNum||'—'],
        ['Linked Item #', it.linkedItem||'—'],
        ['Year / Date',   it.year||'—'],
        ['Condition',     it.condition ? it.condition+'/10' : '—'],
        ['Notes',         it.notes||'—'],
      ].map(([l,v])=>`<div style="display:flex;gap:0.75rem;padding:0.45rem 0;border-bottom:1px solid var(--border)">
        <span style="color:var(--text-dim);min-width:110px;flex-shrink:0">${l}</span>
        <span>${v}</span>
      </div>`).join('')}
      ${it.photoLink?`<div style="margin-top:0.75rem"><a href="${it.photoLink}" target="_blank" rel="noopener" style="font-size:0.82rem;color:#16a085;text-decoration:none">📷 View Photos ↗</a></div>`:''}
    </div>`;
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function browseRowClick(event, idx) {
  // If click was on the varDesc popup span, don't intercept
  if (event.target.closest && event.target.closest('[onclick*="showVarDescPopup"]')) return;
  // Handle _personalOnly items encoded as negative sentinel
  if (idx <= -1000) {
    const poIdx = Math.abs(idx) - 1000;
    const pdKey = (window._poKeys || [])[poIdx];
    if (pdKey) { showOwnedItemMenu(-1, pdKey); }
    return;
  }
  const item = state.masterData[idx];
  if (!item) return;
  // Use findPDKey which handles P/D suffix fallback for AA/AB units
  const pdKey = findPDKey(item.itemNum, item.variation);
  const alreadyOwned = !!pdKey;
  // Also check Science/Construction dedicated tabs
  const _sciOwned = (item._tab === SHEET_TABS.science || item.itemType === 'Science Set')
    ? Object.values(state.scienceData || {}).filter(s => String(s.itemNum) === String(item.itemNum) && String(s.variation || '') === String(item.variation || ''))
    : [];
  const _conOwned = (item._tab === SHEET_TABS.construction || item.itemType === 'Construction Set')
    ? Object.values(state.constructionData || {}).filter(s => String(s.itemNum) === String(item.itemNum) && String(s.variation || '') === String(item.variation || ''))
    : [];
  const _specialOwned = _sciOwned.length + _conOwned.length;
  if (alreadyOwned) {
    showOwnedItemMenu(idx, pdKey);
    return;
  }
  if (_specialOwned > 0) {
    // Show a simple owned menu for Science/Construction items
    _showSpecialOwnedMenu(idx, item, _sciOwned.length > 0 ? _sciOwned : _conOwned);
    return;
  }
  // Not owned — show quick prompt
  const existing = document.getElementById('browse-add-prompt');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'browse-add-prompt';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1.5rem';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
  const box = document.createElement('div');
  box.style.cssText = 'background:var(--surface);border:1px solid rgba(232,64,28,0.4);border-radius:16px;max-width:440px;width:100%;padding:1.75rem;position:relative';
  // Header
  const hdr = document.createElement('div');
  hdr.style.cssText = 'font-family:var(--font-head);font-size:1.05rem;color:var(--accent);margin-bottom:0.25rem';
  hdr.textContent = 'No. ' + item.itemNum + (item.variation ? ' — Var. ' + item.variation : '');
  box.appendChild(hdr);
  const sub = document.createElement('div');
  sub.style.cssText = 'font-size:0.85rem;color:var(--text-mid);margin-bottom:0.25rem';
  sub.textContent = item.roadName || item.itemType || '';
  box.appendChild(sub);
  if (item.yearProd) {
    const yr = document.createElement('div');
    yr.style.cssText = 'font-size:0.75rem;color:var(--text-dim);margin-bottom:1.25rem';
    yr.textContent = item.yearProd + (item.itemType ? ' · ' + item.itemType : '');
    box.appendChild(yr);
  } else {
    sub.style.marginBottom = '1.25rem';
  }
  // Question
  const q = document.createElement('div');
  q.style.cssText = 'font-size:0.9rem;color:var(--text);margin-bottom:1.25rem;font-weight:500';
  q.textContent = 'Do you own this item?';
  box.appendChild(q);
  // Buttons
  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:0.75rem';
  const yesBtn = document.createElement('button');
  yesBtn.className = 'btn btn-primary';
  yesBtn.style.cssText = 'flex:1;background:var(--accent);border-color:var(--accent);font-weight:600';
  yesBtn.textContent = '✓ Yes — Add to Collection';
  yesBtn.onclick = function() { overlay.remove(); addFromBrowse(idx); };
  const viewBtn = document.createElement('button');
  viewBtn.className = 'btn btn-secondary';
  viewBtn.style.cssText = 'flex:1';
  viewBtn.textContent = 'View Details';
  viewBtn.onclick = function() {
    overlay.remove();
    // Show description popup
    const vdOverlay = document.createElement('div');
    vdOverlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1.5rem';
    vdOverlay.onclick = function(e) { if (e.target === vdOverlay) vdOverlay.remove(); };
    const vdBox = document.createElement('div');
    vdBox.style.cssText = 'background:var(--surface);border:1px solid var(--border);border-radius:14px;max-width:520px;width:100%;padding:1.75rem;position:relative;max-height:80vh;overflow-y:auto';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'position:absolute;top:0.75rem;right:0.75rem;background:none;border:none;color:var(--text-dim);font-size:1.1rem;cursor:pointer';
    closeBtn.onclick = function() { vdOverlay.remove(); };
    vdBox.appendChild(closeBtn);
    const rows = [
      ['Item #', item.itemNum + (item.variation ? ' — Var. ' + item.variation : '')],
      ['Type', item.itemType || '—'],
      ['Road / Name', item.roadName || '—'],
      ['Year', item.yearProd || '—'],
    ];
    if (item.control) rows.push(['Control', item.control]);
    if (item.gauge) rows.push(['Gauge', item.gauge]);
    rows.push(['Market Value', item.marketVal ? '$' + parseFloat(item.marketVal).toLocaleString() : '—']);
    rows.forEach(function(r) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:0.75rem;margin-bottom:0.4rem;font-size:0.85rem';
      const lbl = document.createElement('span');
      lbl.style.cssText = 'color:var(--text-dim);min-width:90px;flex-shrink:0';
      lbl.textContent = r[0];
      const val = document.createElement('span');
      val.style.cssText = 'color:var(--text)';
      val.textContent = r[1];
      row.appendChild(lbl);
      row.appendChild(val);
      vdBox.appendChild(row);
    });
    if (item.varDesc) {
      const vdSec = document.createElement('div');
      vdSec.style.cssText = 'margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border);font-size:0.82rem;color:var(--text-mid);line-height:1.6';
      vdSec.innerHTML = '<span style="color:var(--accent2);font-weight:600">Variation: </span>' + item.varDesc;
      vdBox.appendChild(vdSec);
    }
    if (item.description) {
      const descSec = document.createElement('div');
      descSec.style.cssText = 'margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border);font-size:0.82rem;color:var(--text-mid);line-height:1.6';
      descSec.textContent = item.description;
      vdBox.appendChild(descSec);
    }
    if (item.refLink) {
      const cottRow = document.createElement('div');
      cottRow.style.cssText = 'margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border)';
      const cottA = document.createElement('a');
      cottA.href = item.refLink;
      cottA.target = '_blank';
      cottA.rel = 'noopener';
      cottA.style.cssText = 'font-size:0.82rem;color:#2980b9;text-decoration:none;display:inline-flex;align-items:center;gap:0.35rem';
      cottA.innerHTML = 'View on COTT <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
      cottRow.appendChild(cottA);
      vdBox.appendChild(cottRow);
    }
    // Add to collection button at bottom
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary';
    addBtn.style.cssText = 'margin-top:1.25rem;width:100%;background:var(--accent);border-color:var(--accent);line-height:1.25';
    addBtn.innerHTML = '<span style="display:block;font-size:0.75em;opacity:0.85;font-weight:400;letter-spacing:0.03em">Add to</span><span style="display:block">Collection</span>';
    addBtn.onclick = function() { vdOverlay.remove(); addFromBrowse(idx); };
    vdBox.appendChild(addBtn);
    vdOverlay.appendChild(vdBox);
    document.body.appendChild(vdOverlay);
  };
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-secondary';
  cancelBtn.style.cssText = 'padding:0.6rem 0.9rem';
  cancelBtn.textContent = '✕';
  cancelBtn.onclick = function() { overlay.remove(); };
  btnRow.appendChild(yesBtn);
  btnRow.appendChild(viewBtn);
  btnRow.appendChild(cancelBtn);
  box.appendChild(btnRow);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

// ── Detail popup for Sets, Catalogs, and Instruction Sheets ──
function showRefItemPopup(type, idx) {
  var title = '', subtitle = '', details = [];
  if (type === 'set') {
    var s = (window._browseFilteredSets || [])[idx];
    if (!s) return;
    title = 'Set ' + s.setNum;
    subtitle = s.setName || '';
    // Check ownership from My Sets data
    var _mySet = Object.values(state.mySetsData || {}).find(ms => ms.setNum === s.setNum && (!ms.year || ms.year === s.year));
    details = [
      ['Year', s.year || '—'],
      ['Gauge', s.gauge || '—'],
      ['Price', s.price || '—'],
      ['Items', s.items.join(', ') || '—'],
    ];
    if (_mySet) {
      if (_mySet.condition) details.push(['Condition', _mySet.condition + '/10']);
      if (_mySet.estWorth) details.push(['Est. Worth', '$' + parseFloat(_mySet.estWorth).toLocaleString()]);
      if (_mySet.hasSetBox === 'Yes') details.push(['Set Box', '✓ Yes' + (_mySet.boxCondition ? ' (' + _mySet.boxCondition + '/10)' : '')]);
      if (_mySet.notes) details.push(['Notes', _mySet.notes]);
    }
  } else if (type === 'catalog') {
    var c = (window._browseFilteredCats || [])[idx];
    if (!c) return;
    title = c.id;
    subtitle = c.title || '';
    details = [
      ['Year', c.year || '—'],
      ['Type', c.type || '—'],
      ['Has Mailer', c.hasMailer || '—'],
    ];
  } else if (type === 'is') {
    var s2 = (window._browseFilteredIS || [])[idx];
    if (!s2) return;
    title = s2.id;
    subtitle = s2.description || '';
    details = [
      ['Item #', s2.itemNumber || '—'],
      ['Category', s2.category || '—'],
      ['Variations', s2.variations || '—'],
    ];
  } else return;

  var existing = document.getElementById('browse-add-prompt');
  if (existing) existing.remove();
  var overlay = document.createElement('div');
  overlay.id = 'browse-add-prompt';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1.5rem';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
  var box = document.createElement('div');
  box.style.cssText = 'background:var(--surface);border:1px solid rgba(232,64,28,0.4);border-radius:16px;max-width:480px;width:100%;padding:1.75rem;position:relative;max-height:80vh;overflow-y:auto';
  // Header
  var hdr = document.createElement('div');
  hdr.style.cssText = 'font-family:var(--font-head);font-size:1.05rem;color:var(--accent);margin-bottom:0.25rem';
  hdr.textContent = title;
  box.appendChild(hdr);
  if (subtitle) {
    var sub = document.createElement('div');
    sub.style.cssText = 'font-size:0.88rem;color:var(--text-mid);margin-bottom:1rem';
    sub.textContent = subtitle;
    box.appendChild(sub);
  }
  // Detail rows
  details.forEach(function(r) {
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;padding:0.35rem 0;border-bottom:1px solid var(--border)';
    var lbl = document.createElement('div');
    lbl.style.cssText = 'width:100px;font-size:0.78rem;color:var(--text-dim);font-weight:600;flex-shrink:0';
    lbl.textContent = r[0];
    var val = document.createElement('div');
    val.style.cssText = 'font-size:0.82rem;color:var(--text);word-break:break-word';
    val.textContent = r[1];
    row.appendChild(lbl);
    row.appendChild(val);
    box.appendChild(row);
  });
  // Close button
  var closeBtn = document.createElement('button');
  closeBtn.style.cssText = 'position:absolute;top:0.75rem;right:0.75rem;background:none;border:none;color:var(--text-dim);font-size:1.1rem;cursor:pointer';
  closeBtn.textContent = '✕';
  closeBtn.onclick = function() { overlay.remove(); };
  box.appendChild(closeBtn);
  // Add to Collection button
  var addBtn = document.createElement('button');
  addBtn.className = 'btn btn-primary';
  addBtn.style.cssText = 'margin-top:1.25rem;width:100%;background:var(--accent);border-color:var(--accent);line-height:1.25';
  addBtn.innerHTML = '<span style="display:block;font-size:0.75em;opacity:0.85;font-weight:400;letter-spacing:0.03em">Add to</span><span style="display:block">Collection</span>';
  var _itemNum = '', _itemType = '', _description = '', _year = '', _setOwned = false;
  if (type === 'set') {
    var _s = (window._browseFilteredSets || [])[idx];
    if (_s) { _itemNum = _s.setNum; _itemType = 'Set'; _description = _s.setName || ''; _year = _s.year || ''; }
    _setOwned = !!Object.values(state.mySetsData || {}).find(ms => ms.setNum === _itemNum && (!ms.year || ms.year === _year));
    if (_setOwned) {
      addBtn.style.cssText = 'margin-top:1.25rem;width:100%;background:#27ae6022;border:1.5px solid #27ae60;border-radius:10px;padding:0.75rem;line-height:1.25;color:#27ae60;font-family:var(--font-body);font-size:0.92rem;font-weight:700;cursor:default';
      addBtn.innerHTML = '✓ In Your Collection';
    }
  } else if (type === 'catalog') {
    var _c = (window._browseFilteredCats || [])[idx];
    if (_c) { _itemNum = _c.id; _itemType = 'Catalog'; _description = _c.title || ''; _year = _c.year || ''; }
  } else if (type === 'is') {
    var _is = (window._browseFilteredIS || [])[idx];
    if (_is) { _itemNum = _is.itemNumber || _is.id; _itemType = 'Instruction Sheet'; _description = _is.description || ''; }
  }
  addBtn.onclick = function() {
    overlay.remove();
    // Sets get their own wizard flow
    if (type === 'set') {
      if (_setOwned) return;  // Already owned — button is just a badge
      addSetToCollection(_itemNum, _description);
      return;
    }
    // Catalogs → catalog wizard flow
    if (type === 'catalog') {
      _buildWizardModal();
      var _c2 = (window._browseFilteredCats || [])[idx];
      wizard = {
        step: 0, tab: 'catalogs',
        data: { tab: 'catalogs', itemCategory: 'catalogs',
          cat_type: _c2 ? (_c2.type || '') : '',
          cat_year: _c2 ? (_c2.year || '') : '',
          cat_hasMailer: _c2 ? (_c2.hasMailer || 'No') : 'No',
        },
        steps: getSteps('catalogs'),
        matchedItem: null
      };
      document.getElementById('wizard-modal').classList.add('open');
      document.body.style.overflow = 'hidden';
      // Skip past already-filled steps (type, year, hasMailer)
      var _catAutoSkip = new Set(['cat_type','cat_year','cat_hasMailer']);
      while (wizard.step < wizard.steps.length - 1) {
        var _cs = wizard.steps[wizard.step];
        if (_catAutoSkip.has(_cs.id) && wizard.data[_cs.id]) {
          wizard.step++;
        } else break;
      }
      renderWizardStep();
      return;
    }
    // Instruction Sheets → IS wizard flow
    if (type === 'is') {
      _buildWizardModal();
      var _is2 = (window._browseFilteredIS || [])[idx];
      wizard = {
        step: 0, tab: 'instrsheet',
        data: { tab: 'instrsheet',
          is_sheetNum: _is2 ? (_is2.id || '') : '',
          is_linkedItem: _is2 ? (_is2.itemNumber || '') : '',
        },
        steps: getSteps('instrsheet'),
        matchedItem: null
      };
      document.getElementById('wizard-modal').classList.add('open');
      document.body.style.overflow = 'hidden';
      // Skip past already-filled steps
      var _isAutoSkip = new Set(['is_sheetNum','is_linkedItem']);
      while (wizard.step < wizard.steps.length - 1) {
        var _iss = wizard.steps[wizard.step];
        if (_isAutoSkip.has(_iss.id) && wizard.data[_iss.id]) {
          wizard.step++;
        } else break;
      }
      renderWizardStep();
      return;
    }
    // Try to find in masterData first (regular items)
    var masterIdx = state.masterData.findIndex(function(m) { return m.itemNum === _itemNum; });
    if (masterIdx >= 0) {
      addFromBrowse(masterIdx);
    } else {
      // Pre-fill the wizard with what we know
      _buildWizardModal();
      wizard = {
        step: 0, tab: 'collection',
        data: { tab: 'collection', itemNum: _itemNum, variation: '', itemCategory: 'lionel' },
        steps: getSteps('collection'),
        matchedItem: { itemNum: _itemNum, itemType: _itemType, description: _description, yearProd: _year, roadName: '', variation: '' }
      };
      document.getElementById('wizard-modal').classList.add('open');
      document.body.style.overflow = 'hidden';
      var _baseNum2 = (_itemNum || '').replace(/-(P|D)$/i, '');
      var _hasGrouping2 = getMatchingTenders(_baseNum2).length > 0 || isF3AlcoUnit(_baseNum2);
      var autoSkip = new Set(['tab', 'itemNum', 'variation', 'itemPicker', 'itemCategory', 'entryMode']);
      if (!_hasGrouping2) autoSkip.add('itemNumGrouping');
      while (wizard.step < wizard.steps.length - 1) {
        var ws = wizard.steps[wizard.step];
        if (autoSkip.has(ws.id) || (ws.skipIf && ws.skipIf(wizard.data))) {
          wizard.step++;
        } else break;
      }
      renderWizardStep();
    }
  };
  box.appendChild(addBtn);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function addFromBrowse(idx) {
  const item = state.masterData[idx];
  if (!item) return;
  _buildWizardModal();
  // Open the collection wizard with itemNum + variation pre-filled
  wizard = { step: 0, tab: 'collection', data: { tab: 'collection', itemNum: item.itemNum, variation: item.variation || '', itemCategory: 'lionel' }, steps: getSteps('collection'), matchedItem: item };
  document.getElementById('wizard-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
  // Skip all steps before condition — item number, variation, and entry mode are already known
  // But DON'T skip itemNumGrouping if item has grouping options (engine+tender, diesel AA/AB)
  const _baseNum = (item.itemNum || '').replace(/-(P|D)$/i, '');
  const _hasGrouping = getMatchingTenders(_baseNum).length > 0 || isF3AlcoUnit(_baseNum);
  const autoSkip = new Set(['tab', 'itemNum', 'variation', 'itemPicker', 'itemCategory', 'entryMode']);
  if (!_hasGrouping) autoSkip.add('itemNumGrouping');
  while (wizard.step < wizard.steps.length - 1) {
    const s = wizard.steps[wizard.step];
    if (autoSkip.has(s.id) || (s.skipIf && s.skipIf(wizard.data))) {
      wizard.step++;
    } else {
      break;
    }
  }
  renderWizardStep();
}

// ── ITEM MODAL ──────────────────────────────────────────────────
function _buildItemModal() {
  if (document.getElementById('item-modal')) return;
  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'item-modal';
  overlay.onclick = function(e) { if (e.target === overlay) closeModal(); };
  overlay.innerHTML =
    '<div class="modal">' +
      '<div class="modal-header">' +
        '<div>' +
          '<div class="modal-item-num" id="modal-item-num"></div>' +
          '<div class="modal-title" id="modal-title"></div>' +
          '<div class="modal-subtitle" id="modal-subtitle"></div>' +
        '</div>' +
        '<button class="btn-close" onclick="closeModal()">&#x2715;</button>' +
      '</div>' +
      '<div class="modal-body">' +
        '<div id="box-only-prompt" style="display:none;background:rgba(201,146,42,0.1);border:1px solid var(--accent2);border-radius:10px;padding:0.85rem 1rem;align-items:center;justify-content:space-between;gap:1rem">' +
          '<div>' +
            '<div style="font-weight:600;font-size:0.875rem;color:var(--accent2)">&#x1F4E6; Box without item info</div>' +
            '<div style="font-size:0.8rem;color:var(--text-mid);margin-top:0.2rem">This entry has a box but no item details. Want to add the item info?</div>' +
          '</div>' +
          '<button onclick="fillItemFromBoxRow()" class="btn btn-primary" style="font-size:0.88rem;padding:0.6rem 1rem;white-space:nowrap">Add Item Info</button>' +
        '</div>' +
        '<div>' +
          '<div class="section-title" style="margin-bottom:0.75rem">Reference Information</div>' +
          '<div class="info-grid">' +
            '<div class="info-field"><label>Item Type</label><div class="info-val" id="mi-type"></div></div>' +
            '<div class="info-field"><label>Year Produced</label><div class="info-val" id="mi-year"></div></div>' +
            '<div class="info-field"><label>Road Name</label><div class="info-val" id="mi-road"></div></div>' +
            '<div class="info-field" id="mi-control-wrap"><label>Control</label><div class="info-val" id="mi-control"></div></div>' +
            '<div class="info-field" id="mi-gauge-wrap"><label>Gauge</label><div class="info-val" id="mi-gauge"></div></div>' +
            '<div class="info-field"><label>Variation</label><div class="info-val" id="mi-var"></div></div>' +
            '<div class="info-field"><label>Est. Market Value</label><div class="info-val market-val" id="mi-market"></div></div>' +
            '<div class="info-field"><label>COTT Reference</label><div class="info-val" id="mi-ref"></div></div>' +
          '</div>' +
          '<div id="mi-desc-wrap" style="margin-top:0.75rem"><div class="desc-block" id="mi-desc"></div></div>' +
          '<div id="mi-varDesc-wrap" style="margin-top:0.5rem;display:none">' +
            '<div style="font-size:0.68rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-dim);margin-bottom:0.3rem">Variation Notes</div>' +
            '<div class="desc-block" id="mi-varDesc"></div>' +
          '</div>' +
        '</div>' +
        '<div>' +
          '<div class="form-section-title" style="margin-bottom:0.75rem">Your Collection Data</div>' +
          '<div style="margin-bottom:0.85rem">' +
            '<label style="font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-dim);display:block;margin-bottom:0.4rem">Status</label>' +
            '<div style="display:flex;gap:0.5rem">' +
              '<button class="status-btn" id="status-want" onclick="setStatus(\'Want\')" style="flex:1;padding:0.5rem;border-radius:7px;border:1px solid var(--border);background:var(--surface2);color:var(--text-mid);cursor:pointer;font-family:var(--font-body);font-size:0.85rem;transition:all 0.15s">Want</button>' +
              '<button class="status-btn" id="status-owned" onclick="setStatus(\'Owned\')" style="flex:1;padding:0.5rem;border-radius:7px;border:1px solid var(--border);background:var(--surface2);color:var(--text-mid);cursor:pointer;font-family:var(--font-body);font-size:0.85rem;transition:all 0.15s">Owned</button>' +
              '<button class="status-btn" id="status-forsale" onclick="setStatus(\'ForSale\')" style="flex:1;padding:0.5rem;border-radius:7px;border:1px solid var(--border);background:var(--surface2);color:var(--text-mid);cursor:pointer;font-family:var(--font-body);font-size:0.85rem;transition:all 0.15s">For Sale</button>' +
              '<button class="status-btn" id="status-sold" onclick="setStatus(\'Sold\')" style="flex:1;padding:0.5rem;border-radius:7px;border:1px solid var(--border);background:var(--surface2);color:var(--text-mid);cursor:pointer;font-family:var(--font-body);font-size:0.85rem;transition:all 0.15s">Sold</button>' +
            '</div>' +
          '</div>' +
          '<div id="sold-fields" style="display:none;margin-bottom:0.75rem">' +
            '<div class="price-row">' +
              '<div class="form-field"><label>Sale Price ($)</label><input type="number" id="fc-sale-price" placeholder="0.00" min="0" step="0.01"></div>' +
              '<div class="form-field"><label>Date Sold</label><input type="date" id="fc-date-sold"></div>' +
            '</div>' +
          '</div>' +
          '<div id="forsale-fields" style="display:none;margin-bottom:0.75rem">' +
            '<div class="price-row">' +
              '<div class="form-field"><label>Asking Price ($)</label><input type="number" id="fc-asking-price" placeholder="0.00" min="0" step="0.01"></div>' +
              '<div class="form-field"><label>Date Listed</label><input type="date" id="fc-date-listed"></div>' +
            '</div>' +
          '</div>' +
          '<div id="want-fields" style="display:none;margin-bottom:0.75rem">' +
            '<div class="form-grid">' +
              '<div class="form-field"><label>Priority</label><select id="fc-want-priority"><option value="High">High</option><option value="Medium" selected>Medium</option><option value="Low">Low</option></select></div>' +
              '<div class="form-field"><label>Expected Price ($)</label><input type="number" id="fc-want-price" placeholder="0.00" min="0" step="0.01"></div>' +
            '</div>' +
            '<div class="form-field full" style="margin-top:0.5rem"><label>Notes</label><input type="text" id="fc-want-notes" placeholder="Why you want it, where to find it\u2026"></div>' +
          '</div>' +
          '<div id="collection-form" style="display:none">' +
            '<div class="form-grid">' +
              '<div class="form-field"><label>Copy #</label><select id="fc-copy"><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option></select></div>' +
              '<div class="form-field"><label>All Original?</label><select id="fc-original"><option value="Yes">Yes</option><option value="No">No</option><option value="Unknown">Unknown</option></select></div>' +
            '</div>' +
            '<div class="form-field" style="margin-top:0.75rem">' +
              '<label>Condition (1\u201310)</label>' +
              '<div class="condition-display">' +
                '<div class="condition-num" id="cond-display">7</div>' +
                '<input type="range" min="1" max="10" value="7" id="fc-condition" oninput="document.getElementById(\'cond-display\').textContent=this.value">' +
              '</div>' +
            '</div>' +
            '<div class="price-row" style="margin-top:0.75rem">' +
              '<div class="form-field"><label>Item Only Price ($)</label><input type="number" id="fc-price-item" placeholder="0.00" min="0" step="0.01"></div>' +
              '<div class="form-field"><label>Box Only Price ($)</label><input type="number" id="fc-price-box" placeholder="0.00" min="0" step="0.01"></div>' +
              '<div class="form-field"><label>Item+Box Complete ($)</label><input type="number" id="fc-price-complete" placeholder="0.00" min="0" step="0.01"></div>' +
            '</div>' +
            '<div class="form-grid" style="margin-top:0.75rem">' +
              '<div class="form-field"><label>Has Box?</label><select id="fc-has-box"><option value="Yes">Yes</option><option value="No">No</option></select></div>' +
              '<div class="form-field"><label>Box Condition (1\u201310)</label><input type="number" id="fc-box-cond" min="1" max="10" placeholder="\u2014"></div>' +
            '</div>' +
            '<div class="form-field full" style="margin-top:0.75rem"><label>Item Photo Link (Google Photos)</label><input type="url" id="fc-photo-item" placeholder="https://photos.google.com/\u2026"></div>' +
            '<div class="form-field full" style="margin-top:0.5rem"><label>Box Photo Link (Google Photos)</label><input type="url" id="fc-photo-box" placeholder="https://photos.google.com/\u2026"></div>' +
            '<div class="form-field full" style="margin-top:0.5rem"><label>Notes</label><textarea id="fc-notes" placeholder="Any personal notes about this item\u2026"></textarea></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
        '<button class="btn btn-primary" onclick="saveItem()">Save to Collection</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);
}

function openItem(idx) {
  _buildItemModal();
  const item = state.masterData[idx];
  state.currentItem = { item, idx };
  // Find personal data by value scan (key-format-agnostic)
  const pdKey = findPDKey(item.itemNum, item.variation);
  const pd = pdKey ? state.personalData[pdKey] : {};

  const _errPd = findPD(item.itemNum, item.variation);
  const _errSuffix = _errPd && _errPd.isError === 'Yes' ? ' ⚠ Error' : '';
  document.getElementById('modal-item-num').textContent = `No. ${item.itemNum}${item.variation ? ' — Variation ' + item.variation : ''}${_errSuffix}`;
  document.getElementById('modal-title').textContent = item.roadName || item.itemType || item.description.substring(0, 60);
  const modalMatchedTo = pd?.matchedTo || '';
  const modalIsTender = isTender(item.itemNum);
  document.getElementById('modal-subtitle').textContent = `${item.itemType}${item.subType ? ' — ' + item.subType : ''}${item.yearProd ? ' · ' + item.yearProd : ''}`;
  // Set ID badge
  const setIdBadgeEl = document.getElementById('modal-set-badge');
  if (setIdBadgeEl) {
    if (pd?.setId) {
      setIdBadgeEl.style.display = 'inline-flex';
      // Find all other items in this set
      const setMates = Object.values(state.personalData)
        .filter(p => p.setId === pd.setId && p.itemNum !== item.itemNum)
        .map(p => p.itemNum);
      setIdBadgeEl.textContent = '🔗 Set: ' + pd.setId + (setMates.length ? ' (with ' + setMates.join(', ') + ')' : '');
    } else {
      setIdBadgeEl.style.display = 'none';
    }
  }

  const matchedBadgeEl = document.getElementById('modal-matched-badge');
  if (matchedBadgeEl) {
    if (modalMatchedTo) {
      matchedBadgeEl.style.display = 'inline-flex';
      matchedBadgeEl.innerHTML = `${modalIsTender ? '🚂' : '🚃'} Matched ${modalIsTender ? 'Engine' : 'Tender'}: <strong style="margin-left:0.3rem">${modalMatchedTo}</strong>`;
    } else {
      matchedBadgeEl.style.display = 'none';
    }
  }
  document.getElementById('mi-type').textContent = item.itemType || '—';
  document.getElementById('mi-year').textContent = item.yearProd || '—';
  document.getElementById('mi-road').textContent = item.roadName || '—';
  if (item.control) { document.getElementById('mi-control').textContent = item.control; document.getElementById('mi-control-wrap').style.display = ''; }
  else { document.getElementById('mi-control-wrap').style.display = 'none'; }
  if (item.gauge) { document.getElementById('mi-gauge').textContent = item.gauge; document.getElementById('mi-gauge-wrap').style.display = ''; }
  else { document.getElementById('mi-gauge-wrap').style.display = 'none'; }
  document.getElementById('mi-var').textContent = item.variation || '(no variation)';
  document.getElementById('mi-market').textContent = item.marketVal ? '$' + parseFloat(item.marketVal).toLocaleString() : '—';
  document.getElementById('mi-ref').innerHTML = item.refLink ? `<a href="${item.refLink}" target="_blank">View on COTT ↗</a>` : '—';
  document.getElementById('mi-desc').textContent = item.description || 'No description available.';
  const vd = document.getElementById('mi-varDesc-wrap');
  if (item.varDesc) { document.getElementById('mi-varDesc').textContent = item.varDesc; vd.style.display = 'block'; }
  else { vd.style.display = 'none'; }

  // Personal data - check owned, for sale, sold, and want
  const sd = state.soldData[key] || {};
  const fs = state.forSaleData[key] || {};
  const wd = state.wantData[key] || {};
  const itemStatus = pd.owned ? 'Owned' : fs.itemNum ? 'ForSale' : sd.itemNum ? 'Sold' : wd.itemNum ? 'Want' : '';
  currentStatus = itemStatus || '';
  setStatus(itemStatus || 'Want');
  document.getElementById('fc-sale-price').value = sd.salePrice || '';
  document.getElementById('fc-date-sold').value = sd.dateSold || '';
  document.getElementById('fc-asking-price').value = fs.askingPrice || '';
  document.getElementById('fc-date-listed').value = fs.dateListed || '';
  document.getElementById('fc-want-priority').value = wd.priority || 'Medium';
  document.getElementById('fc-want-price').value = wd.expectedPrice || '';
  document.getElementById('fc-want-notes').value = wd.notes || '';

  // copy field removed
  document.getElementById('fc-original').value = pd.allOriginal || 'Unknown';
  const cond = pd.condition || 7;
  document.getElementById('fc-condition').value = cond;
  document.getElementById('cond-display').textContent = cond;
  const toNum = v => (v && !isNaN(parseFloat(v))) ? v : '';
  document.getElementById('fc-price-item').value = toNum(pd.priceItem);
  document.getElementById('fc-price-box').value = toNum(pd.priceBox);
  document.getElementById('fc-price-complete').value = toNum(pd.priceComplete);
  document.getElementById('fc-has-box').value = ['Yes','No'].includes(pd.hasBox) ? pd.hasBox : 'No';
  document.getElementById('fc-box-cond').value = toNum(pd.boxCond);
  document.getElementById('fc-photo-item').value = pd.photoItem || '';
  document.getElementById('fc-photo-box').value = pd.photoBox || '';
  document.getElementById('fc-notes').value = pd.notes || '';

  // Show box-only prompt if row has box but no item info
  const isBoxOnly = pd.owned && pd.hasBox === 'Yes' && 
    (!pd.condition || pd.condition === 'N/A') && 
    (!pd.priceItem || pd.priceItem === 'N/A');
  const prompt = document.getElementById('box-only-prompt');
  if (prompt) prompt.style.display = isBoxOnly ? 'flex' : 'none';

  document.getElementById('item-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function fillItemFromBoxRow() {
  if (!state.currentItem) return;
  const { item } = state.currentItem;
  closeModal();
  // Start wizard in collection mode, pre-filled with item number, skip to item-info steps
  wizard = {
    step: 0,
    tab: 'collection',
    data: {
      tab: 'collection',
      itemNum: item.itemNum,
      variation: item.variation || '',
      boxOnly: false,
      _fillItemMode: true, // flag so we can pre-set item number
    },
    steps: getSteps('collection'),
    matchedItem: findMaster(item.itemNum) || null,
  };
  // Advance past tab and itemNum steps since we already know them
  wizard.step = 2; // start at condition step
  document.getElementById('wizard-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
  renderWizardStep();
}

function closeModal() {
  document.getElementById('item-modal').classList.remove('open');
  document.body.style.overflow = '';
  state.currentItem = null;
}

function closeModalOnOverlay(e) { if (e.target === document.getElementById('item-modal')) closeModal(); }

let currentStatus = 'Want';

function setStatus(status) {
  currentStatus = status;
  // Update button styles
  ['Want','Owned','ForSale','Sold'].forEach(s => {
    const btn = document.getElementById('status-' + s.toLowerCase());
    if (!btn) return;
    if (s === status) {
      const colors = { Want: 'var(--accent2)', Owned: 'var(--green)', ForSale: '#e67e22', Sold: '#9b59b6' };
      btn.style.background = colors[s] + '22';
      btn.style.borderColor = colors[s];
      btn.style.color = colors[s];
    } else {
      btn.style.background = 'var(--surface2)';
      btn.style.borderColor = 'var(--border)';
      btn.style.color = 'var(--text-mid)';
    }
  });
  document.getElementById('collection-form').style.display = (status === 'Owned' || status === 'Sold' || status === 'ForSale') ? 'block' : 'none';
  const soldFields = document.getElementById('sold-fields');
  if (soldFields) soldFields.style.display = status === 'Sold' ? 'block' : 'none';
  const forsaleFields = document.getElementById('forsale-fields');
  if (forsaleFields) forsaleFields.style.display = status === 'ForSale' ? 'block' : 'none';
  const wantFields = document.getElementById('want-fields');
  if (wantFields) wantFields.style.display = status === 'Want' ? 'block' : 'none';
}

async function saveItem() {
  if (!state.currentItem) return;
  const { item } = state.currentItem;
  const key = `${item.itemNum}|${item.variation}`;

  const copy = document.getElementById('fc-copy').value;
  const condition = document.getElementById('fc-condition').value;

  if (currentStatus === 'Owned') {
    // Write/update in My Collection tab
    const _ex = state.personalData[key] || {};
    const ownedRow = [
      item.itemNum, item.variation || '', copy, condition,
      document.getElementById('fc-original').value,
      document.getElementById('fc-price-item').value,
      document.getElementById('fc-price-box').value,
      document.getElementById('fc-price-complete').value,
      document.getElementById('fc-has-box').value,
      document.getElementById('fc-box-cond').value,
      document.getElementById('fc-photo-item').value,
      document.getElementById('fc-photo-box').value,
      document.getElementById('fc-notes').value,
      _ex.datePurchased || '', _ex.userEstWorth || '',
      _ex.matchedTo || '', _ex.setId || '', _ex.yearMade || '',
      _ex.isError || '', _ex.errorDesc || '',
      _ex.quickEntry ? 'Yes' : '',  // preserve Quick Entry flag
      _ex.inventoryId || nextInventoryId(),  // auto-assign if new
      _ex.groupId || '',
      _ex.location || '',  // Location (col W)
      _ex.era || '',        // Era (col X)
      _ex.manufacturer || '', // Manufacturer (col Y)
    ];
    const existing = state.personalData[key];
    if (existing && existing.row) {
      await sheetsUpdate(state.personalSheetId, `My Collection!A${existing.row}:Y${existing.row}`, [ownedRow]);
    } else {
      await sheetsAppend(state.personalSheetId, 'My Collection!A:A', [ownedRow]);
    }
    // Remove from Sold tab if it was there
    const soldEntry = state.soldData[key];
    if (soldEntry && soldEntry.row) {
      await sheetsUpdate(state.personalSheetId, `Sold!A${soldEntry.row}:J${soldEntry.row}`, [['','','','','','','','','','']]);
    }
    // Remove from Want List if it was there
    const wantEntry = state.wantData[key];
    if (wantEntry && wantEntry.row) {
      await sheetsUpdate(state.personalSheetId, `Want List!A${wantEntry.row}:F${wantEntry.row}`, [['','','','','','']]);
    }
    // Remove from For Sale if it was there
    const fsEntry = state.forSaleData[key];
    if (fsEntry && fsEntry.row) {
      await sheetsUpdate(state.personalSheetId, `For Sale!A${fsEntry.row}:J${fsEntry.row}`, [['','','','','','','','','','']]);
    }

  } else if (currentStatus === 'ForSale') {
    // Write to For Sale tab (keep in collection too — it's still yours)
    const existing = state.personalData[key];
    const forSaleRow = [
      item.itemNum, item.variation || '',
      condition,
      document.getElementById('fc-asking-price').value,
      document.getElementById('fc-date-listed').value || new Date().toISOString().split('T')[0],
      document.getElementById('fc-notes').value,
      existing?.priceItem || '',
      existing?.userEstWorth || '',
      existing?.inventoryId || '',
      existing?.manufacturer || _getEraManufacturer(),
    ];
    const fsEntry2 = state.forSaleData[key];
    if (fsEntry2 && fsEntry2.row) {
      await sheetsUpdate(state.personalSheetId, `For Sale!A${fsEntry2.row}:J${fsEntry2.row}`, [forSaleRow]);
    } else {
      await sheetsAppend(state.personalSheetId, 'For Sale!A:A', [forSaleRow]);
    }
    // Remove from Sold if it was there
    const soldEntry2 = state.soldData[key];
    if (soldEntry2 && soldEntry2.row) {
      await sheetsUpdate(state.personalSheetId, `Sold!A${soldEntry2.row}:J${soldEntry2.row}`, [['','','','','','','','','','']]);
    }
    // Remove from Want if it was there
    const wantEntry2 = state.wantData[key];
    if (wantEntry2 && wantEntry2.row) {
      await sheetsUpdate(state.personalSheetId, `Want List!A${wantEntry2.row}:F${wantEntry2.row}`, [['','','','','','']]);
    }

  } else if (currentStatus === 'Sold') {
    // Remove from My Collection
    const existing = state.personalData[key];
    if (existing && existing.row) {
      await sheetsUpdate(state.personalSheetId, `My Collection!A${existing.row}:Y${existing.row}`, [['','','','','','','','','','','','','','','','','','','','','','','','','']]);  // 25 cols A-Y
    }
    // Remove from For Sale if it was there
    const fsEntry3 = state.forSaleData[key];
    if (fsEntry3 && fsEntry3.row) {
      await sheetsUpdate(state.personalSheetId, `For Sale!A${fsEntry3.row}:J${fsEntry3.row}`, [['','','','','','','','','','']]);
    }
    // Write to Sold tab
    const soldRow = [
      item.itemNum, item.variation || '', copy, condition,
      existing?.priceItem || document.getElementById('fc-price-item').value,
      document.getElementById('fc-sale-price').value,
      document.getElementById('fc-date-sold').value,
      document.getElementById('fc-notes').value,
      existing?.inventoryId || '',
      existing?.manufacturer || _getEraManufacturer(),
    ];
    const soldEntry = state.soldData[key];
    if (soldEntry && soldEntry.row) {
      await sheetsUpdate(state.personalSheetId, `Sold!A${soldEntry.row}:J${soldEntry.row}`, [soldRow]);
    } else {
      await sheetsAppend(state.personalSheetId, 'Sold!A:J', [soldRow]);
    }

  } else if (currentStatus === 'Want') {
    // Remove from My Collection if present
    const existing = state.personalData[key];
    if (existing && existing.row) {
      await sheetsUpdate(state.personalSheetId, `My Collection!A${existing.row}:Y${existing.row}`, [['','','','','','','','','','','','','','','','','','','','','','','','','']]);  // 25 cols A-Y
    }
    // Write/update Want List tab
    const wantRow = [
      item.itemNum,
      item.variation || '',
      document.getElementById('fc-want-priority').value,
      document.getElementById('fc-want-price').value,
      document.getElementById('fc-want-notes').value,
      _getEraManufacturer(),
    ];
    const wantEntry = state.wantData[key];
    if (wantEntry && wantEntry.row) {
      await sheetsUpdate(state.personalSheetId, `Want List!A${wantEntry.row}:F${wantEntry.row}`, [wantRow]);
    } else {
      await sheetsAppend(state.personalSheetId, 'Want List!A:A', [wantRow]);
    }
    // Store info for partner prompt — shown after modal closes
    window._pendingWantPartner = {
      itemNum: item.itemNum,
      variation: item.variation || '',
      priority: wantRow[2],
      maxPrice: wantRow[3],
      notes: wantRow[4],
    };
  } else {
    window._pendingWantPartner = null;
  }

  // Bust cache then background sync — don't block the UI
  localStorage.removeItem('lv_personal_cache');
  localStorage.removeItem('lv_personal_cache_ts');

  closeModal();
  buildDashboard();
  buildSoldPage();
  buildForSalePage();
  renderBrowse();
  showToast('✓ Item updated!');

  // Show groupable partner prompt if applicable
  if (window._pendingWantPartner) {
    const _pwp = window._pendingWantPartner;
    window._pendingWantPartner = null;
    setTimeout(() => _checkWantPartners(_pwp.itemNum, _pwp.variation, _pwp.priority, _pwp.maxPrice, _pwp.notes), 400);
  }

  // Background sync after a delay to give Sheets time to propagate
  const _syncDelay = typeof _isTouchDevice !== 'undefined' && _isTouchDevice ? 3000 : 1500;
  setTimeout(async function() {
    try {
      await loadPersonalData();
      buildDashboard();
      renderBrowse();
    } catch(e) { console.warn('Background sync after saveItem:', e); }
  }, _syncDelay);
}

// ── WANT LIST PARTNER PROMPT ─────────────────────────────────────
// Shown after saving a groupable item to Want List
function _checkWantPartners(itemNum, variation, priority, maxPrice, notes) {
  const num = normalizeItemNum(itemNum);
  const isLoco   = isLocomotive(num);
  const isTnd    = isTender(num);
  const bUnit    = getBUnit(num);          // diesel A-unit: returns "XXXC" or null
  const aUnit    = getAUnit(num);          // diesel B-unit: returns "XXX" or null

  // Build list of candidates (skip any already on Want List)
  let candidates = []; // [{ itemNum, label }]

  if (isLoco) {
    const tenders = getMatchingTenders(num);
    tenders.forEach(t => {
      if (!state.wantData[t + '|']) candidates.push({ itemNum: t, label: t + ' (tender)' });
    });
  } else if (isTnd) {
    const locos = getMatchingLocos(num);
    locos.forEach(l => {
      if (!state.wantData[l + '|']) candidates.push({ itemNum: l, label: l + ' (locomotive)' });
    });
  } else if (bUnit) {
    if (!state.wantData[bUnit + '|']) candidates.push({ itemNum: bUnit, label: bUnit + ' (B unit)' });
  } else if (aUnit) {
    if (!state.wantData[aUnit + '|']) candidates.push({ itemNum: aUnit, label: aUnit + ' (A unit)' });
  }

  if (!candidates.length) return; // Nothing to offer

  // Build modal
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9200;display:flex;align-items:center;justify-content:center;padding:1rem';

  const isLocoOrTender = isLoco || isTnd;
  const promptText = isLoco
    ? 'This locomotive has matching tenders. Add any to your Want List?'
    : isTnd
      ? 'This tender fits these locomotives. Add any to your Want List?'
      : bUnit
        ? 'This is an A unit — do you also want the B unit?'
        : 'This is a B unit — do you also want the A unit?';

  const checkboxRows = candidates.map((c, i) => `
    <label style="display:flex;align-items:center;gap:0.6rem;padding:0.5rem 0.6rem;border-radius:7px;background:var(--surface2);cursor:pointer;margin-bottom:0.4rem">
      <input type="checkbox" id="wpc-${i}" checked style="width:16px;height:16px;accent-color:var(--accent);cursor:pointer">
      <span style="font-family:var(--font-mono);font-weight:600;color:var(--accent)">${c.itemNum}</span>
      <span style="font-size:0.78rem;color:var(--text-dim)">${c.label.replace(c.itemNum + ' ', '')}</span>
    </label>`).join('');

  overlay.innerHTML = `
    <div style="background:var(--surface);border:1.5px solid var(--accent3);border-radius:14px;padding:1.5rem;max-width:380px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,0.5)">
      <div style="font-size:0.72rem;font-weight:700;letter-spacing:0.1em;color:var(--accent3);text-transform:uppercase;margin-bottom:0.5rem">Add Partner(s) to Want List?</div>
      <div style="font-size:0.9rem;color:var(--text-mid);margin-bottom:1rem;line-height:1.4">${promptText}</div>
      <div style="margin-bottom:1rem">${checkboxRows}</div>
      <div style="display:flex;gap:0.5rem;justify-content:flex-end">
        <button id="wpc-skip" style="padding:0.45rem 1rem;border-radius:7px;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body);font-size:0.82rem;cursor:pointer">Skip</button>
        <button id="wpc-add" style="padding:0.45rem 1.1rem;border-radius:7px;border:none;background:var(--accent3);color:#fff;font-family:var(--font-body);font-size:0.82rem;font-weight:600;cursor:pointer">Add Selected</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  overlay.querySelector('#wpc-skip').onclick = () => overlay.remove();
  overlay.querySelector('#wpc-add').onclick = async () => {
    const selected = candidates.filter((c, i) => {
      const cb = overlay.querySelector('#wpc-' + i);
      return cb && cb.checked;
    });
    overlay.remove();
    if (!selected.length) return;
    let added = 0;
    for (const c of selected) {
      try {
        const row = [c.itemNum, '', priority || 'Medium', maxPrice || '', notes || '', _getEraManufacturer()];
        await sheetsAppend(state.personalSheetId, 'Want List!A:A', [row]);
        // Bugfix 2026-04-14: optimistically add partner to state.wantData so the
        // Want List table shows the new partners immediately instead of waiting
        // for the 1.2s refresh. Session 102 observed partners not appearing.
        const pKey = `${c.itemNum}|`;
        if (!state.wantData[pKey]) {
          state.wantData[pKey] = {
            row: 99999, // placeholder; overwritten on next sheet sync
            itemNum: c.itemNum,
            variation: '',
            priority: priority || 'Medium',
            expectedPrice: maxPrice || '',
            notes: notes || '',
          };
        }
        added++;
      } catch(e) { console.warn('[WantPartner] Failed to add', c.itemNum, e); }
    }
    if (added) {
      _cachePersonalData();
      showToast('✓ Added ' + added + ' partner' + (added > 1 ? 's' : '') + ' to Want List');
      // Render immediately with the optimistic state, then refresh from server
      try { buildWantPage(); } catch(e) {}
      try { buildDashboard(); } catch(e) {}
      setTimeout(async () => {
        await loadPersonalData();
        buildWantPage();
        buildDashboard();
      }, 1200);
    }
  };
}

