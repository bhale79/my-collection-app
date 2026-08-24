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
// Session 115: shared "back from item detail" handler. Restores the
// Browse page to the exact tab + ownership filter the user was on
// before they entered the detail view. Falls back to a clean
// filterOwned() if no captured state exists (first-time visit).
// v0.9.1231 (Brad): "if you are on page 3, click on a item to look at it, then
// hit the back to collection button, it takes you back to page 1."
//
// The page was never LOST — it was never written down. Every route back
// rebuilds the list (filterOwned -> resetFilters -> applyFilters), and each of
// those quite correctly starts the reader at page one. So the page number now
// travels in _lastBrowseState alongside the tab and the filters, and is put
// back LAST, after every rebuild has had its say.
//
// One refinement Brad chose: if he stepped through items with the arrows on
// the detail page, Back lands on the page holding the item he ENDED on, not the
// one he clicked from - arrowing forward into item 60 and being returned to
// page 3, where item 60 is not, would be its own small betrayal. The row
// objects in state.filteredData are the very same objects as in
// state.masterData, so finding it is an identity lookup, not a search.
function _restoreBrowsePage(ls) {
  if (!ls) return;
  var want = parseInt(ls.page, 10) || 1;
  try {
    var i = window._lastDetailIdx;
    var rec = (typeof i === 'number' && i >= 0 && state.masterData) ? state.masterData[i] : null;
    if (rec && Array.isArray(state.filteredData)) {
      var pos = state.filteredData.indexOf(rec);
      // Not found is normal and fine - a set row, a catalog, a folded member.
      // Fall back to the page he clicked from rather than guessing.
      if (pos >= 0) want = Math.floor(pos / (state.pageSize || 50)) + 1;
    }
  } catch (e) { /* the saved page is always a safe answer */ }
  if (want > 1 && state.currentPage !== want) {
    state.currentPage = want;
    // renderBrowse pulls this back into range if the list shrank while he was away.
    if (typeof renderBrowse === 'function') renderBrowse();
  }
}

function _detailBackToBrowse() {
  showPage('browse');
  var ls = window._lastBrowseState;
  if (ls) {
    delete window._lastBrowseState;
    if (ls.owned) {
      // Reapply collection view, then jump to the saved tab
      if (typeof filterOwned === 'function') filterOwned();
      // v0.9.801: the chip bar's source of truth is the hidden #filter-type /
      // #filter-road SELECTS — v0.9.798 restored state only, so the list was
      // filtered while the chips said "All Types" (ghost filter). Restore the
      // SELECTS, then let applyFilters recompute state from them.
      if (ls.filters && state.filters) {
        var _ft = document.getElementById('filter-type');
        if (_ft) _ft.value = ls.filters.type || '';
        var _fr = document.getElementById('filter-road');
        if (_fr) _fr.value = ls.filters.road || '';
        Object.assign(state.filters, ls.filters, { owned: true });
        if (typeof applyFilters === 'function') applyFilters();
        else if (typeof renderBrowse === 'function') renderBrowse();
      }
      if (ls.tab && ls.tab !== 'items' && typeof renderBrowseTab === 'function') {
        state._browseTab = ls.tab;
        renderBrowseTab(ls.tab);
      }
    } else {
      // Master browse — restore type / road / search filters too
      if (state.filters) {
        state.filters.owned = false;
        state.filters.type   = ls.filterType || '';
        state.filters.road   = ls.filterRoad || '';
        state.filters.search = ls.search     || '';
      }
      if (typeof renderBrowse === 'function') renderBrowse();
      if (ls.tab && typeof renderBrowseTab === 'function') {
        state._browseTab = ls.tab;
        renderBrowseTab(ls.tab);
      }
    }
    // LAST, on purpose: everything above rebuilds the list, and every rebuild
    // resets the reader to page one.
    _restoreBrowsePage(ls);
  } else if (typeof filterOwned === 'function') {
    filterOwned();
  }
}
window._detailBackToBrowse = _detailBackToBrowse;

// ── Generic Non-Item Detail Page (Session 116) ─────────────────────
// Renders the same layout as showItemDetailPage, but config-driven so
// every non-Items tab (Sets, Catalogs, Mockups, Paper, Other, Science,
// Construction, IS, Service Tools) gets a consistent detail view.
//
// Inputs:
//   type — one of the keys in NON_ITEM_DETAIL_CONFIG
//   key  — the bucket key for that record (e.g. mySetsData[key])
//
// What it renders:
//   • Header: Back button + title + subtitle + type badge + ✓ IN COLLECTION
//   • Action toolbar: Update Info, Record Sale, List for Sale,
//                     Add to Upgrade, Remove
//   • Details card: fields() from config + Notes block
//   • Photos card: reads photoFolder() and shows Drive thumbnails
//
// Update Info, photo upload, and edit are handled by:
//   _nonItemDetailEdit(type, key)   — opens edit modal (Phase 2)
//   _nonItemDetailPhotos(type, key) — opens photo upload (uses Drive folder)
function showNonItemDetailPage(type, key) {
  var cfg = (window.NON_ITEM_DETAIL_CONFIG || {})[type];
  if (!cfg) {
    if (typeof showToast === 'function') showToast('Detail view not configured for ' + type, 3000, true);
    return;
  }
  // Resolve entry from bucketPath like 'ephemeraData.catalogs'
  var bucket = state;
  var bucketKey = '';
  cfg.bucketPath.split('.').forEach(function(seg) {
    bucket = bucket && bucket[seg];
    bucketKey = seg;
  });
  if (!bucket || !bucket[key]) {
    if (typeof showToast === 'function') showToast('Record not found', 3000, true);
    return;
  }
  var entry = bucket[key];

  // Capture browse state so Back returns to the right tab + filters
  if (window._detailReturn !== 'tools') {
    window._lastBrowseState = {
      tab:        state._browseTab || 'items',
      owned:      !!state.filters.owned,
      filterType: state.filters.type || '',
      filterRoad: state.filters.road || '',
      search:     state.filters.search || '',
      page:       state.currentPage || 1,             // v0.9.1231 (Brad): come back to the page you left
      filters:    Object.assign({}, state.filters),   // v0.9.798: FULL snapshot (mfr/scale/era chips too)
    };
  }

  showPage('itemdetail');
  var container = document.getElementById('item-detail-content');
  if (!container) return;

  // Pull data via config
  var pageTitle = cfg.pageTitle(entry) || '—';
  var subtitle  = cfg.subtitle(entry)  || '';
  var typeBadge = cfg.typeBadge(entry) || '';
  var year      = cfg.year(entry)      || '';
  var fields    = (cfg.fields(entry) || []).filter(function(f) { return f.val != null && f.val !== ''; });
  var notes     = cfg.notes(entry) || '';
  var photoLink = cfg.photoFolder(entry) || '';

  // Phase 3: For Sale state lookup is by THIS copy's inventoryId.
  // state.forSaleData is keyed by inventoryId, so a direct lookup works.
  var _ndInvId    = entry && entry.inventoryId ? entry.inventoryId : '';
  var fsEntry     = _ndInvId ? state.forSaleData[_ndInvId] : null;
  var isForSale   = !!fsEntry;
  var fsPrice     = fsEntry ? _currencySymbol() + parseFloat(fsEntry.askingPrice || 0).toLocaleString() : '';

  // Condition pip
  var cond      = entry.condition ? parseInt(entry.condition) : null;
  var condClass = cond >= 9 ? 'cond-9' : cond >= 7 ? 'cond-7' : cond >= 5 ? 'cond-5' : cond ? 'cond-low' : '';

  var typeArg = "'" + String(type).replace(/'/g, "\\'") + "'";
  var keyArg  = "'" + String(key).replace(/'/g, "\\'") + "'";

  // Back button (mirror Items' tools-flow handling)
  var fromTools = window._detailReturn === 'tools';
  var fromDash  = window._detailReturn === 'dashboard';   // v0.9.845 (Brad)
  var backLabel = fromTools ? 'Back to Collection Tools' : fromDash ? 'Back to Dashboard' : 'Back to Collection';
  var backFn    = fromTools ? 'delete window._detailReturn;showPage(&apos;tools&apos;);buildToolsPage()'
                : fromDash  ? 'delete window._detailReturn;showPage(&apos;dashboard&apos;);if(typeof buildDashboard===&apos;function&apos;)buildDashboard()'
                : '_detailBackToBrowse()';

  // ── HEADER ──
  var html = ''
    + '<div style="margin-bottom:1.5rem">'
    // v0.9.1155: same prev/next row as the item detail page — sets, catalogs,
    // paper items and the rest step through their list too.
    +   '<div id="rr-detail-nav" style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.75rem;flex-wrap:wrap">'
    +   '<button onclick="' + backFn + '" style="background:none;border:none;color:#2980b9;font-family:var(--font-body);font-size:1.1rem;font-weight:700;cursor:pointer;padding:0;display:flex;align-items:center;gap:0.4rem">'
    +     '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>'
    +     backLabel
    +   '</button>'
    +   (typeof rrDetailNavHtml === 'function' ? rrDetailNavHtml() : '')
    +   '</div>'
    +   '<div style="display:flex;align-items:flex-start;gap:1rem;flex-wrap:wrap">'
    +     '<div style="flex:1;min-width:0">'
    +       '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;margin-bottom:0.25rem">'
    +         '<span style="font-family:var(--font-head);font-size:1.6rem;color:var(--accent);letter-spacing:0.03em">' + pageTitle + '</span>'
    +         (isForSale ? '<span style="font-size:1rem;color:var(--gold);font-family:var(--font-head);letter-spacing:0.02em">— on the sale list for ' + fsPrice + '</span>' : '')
    +         (typeBadge ? '<span class="tag">' + typeBadge + '</span>' : '')
    +         (year ? '<span style="font-size:0.82rem;color:var(--text-dim)">' + year + '</span>' : '')
    +       '</div>'
    +       (subtitle ? '<div style="font-size:1.05rem;color:var(--text);margin-bottom:0.2rem">' + subtitle + '</div>' : '')
    +     '</div>'
    +     '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.4rem;flex-shrink:0">'
    +       '<span class="owned-badge ' + (isForSale ? 'forsale' : 'yes') + '" style="font-size:0.85rem">' + (isForSale ? '🏷️ For Sale' : '✓ In Collection') + '</span>'
    +       (cond ? '<span style="font-size:0.85rem"><span class="condition-pip ' + condClass + '"></span> ' + cond + '/10</span>' : '')
    +     '</div>'
    +   '</div>'
    + '</div>';

  // ── ACTION TOOLBAR ──
  html += '<div class="rr-detail-actions" style="display:flex;gap:0.5rem;margin-bottom:1.5rem;flex-wrap:wrap">';
  html +=   '<button onclick="_nonItemDetailEdit(' + typeArg + ',' + keyArg + ')" style="padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #2980b9;background:var(--bg-card);background:color-mix(in srgb, rgb(41,128,185) 10%, var(--bg-card));color:#2980b9;font-family:var(--font-body);font-size:0.82rem;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:0.4rem">'
       +     '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'
       +     'Update Info/Pictures'
       +   '</button>';
  html +=   '<button id="detail-record-sale" onclick="_collectionSold(' + typeArg + ',' + keyArg + ')" style="padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #2ecc71;background:var(--bg-card);background:color-mix(in srgb, rgb(46,204,113) 10%, var(--bg-card));color:#2ecc71;font-family:var(--font-body);font-size:0.82rem;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:0.4rem">'
       +     '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>'
       +     'Record Sale'
       +   '</button>';
  if (!isForSale) {
    html += '<button id="detail-list-sale" onclick="_collectionForSale(' + typeArg + ',' + keyArg + ')" style="padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #e67e22;background:var(--bg-card);background:color-mix(in srgb, rgb(230,126,34) 10%, var(--bg-card));color:#e67e22;font-family:var(--font-body);font-size:0.82rem;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:0.4rem">'
         +   '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>'
         +   'List for Sale'
         + '</button>';
  }
  html +=   '<button onclick="_collectionUpgrade(' + typeArg + ',' + keyArg + ')" style="padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #8b5cf6;background:var(--bg-card);background:color-mix(in srgb, rgb(139,92,246) 10%, var(--bg-card));color:#8b5cf6;font-family:var(--font-body);font-size:0.82rem;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:0.4rem">'
       +     '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 19V5M5 12l7-7 7 7"/></svg>'
       +     'Add to Upgrade List'
       +   '</button>';
  html +=   '<button id="detail-remove-item" onclick="_collectionRemove(' + typeArg + ',' + keyArg + ')" style="padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body);font-size:0.82rem;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:0.4rem">'
       +     '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>'
       +     'Remove from Collection'
       +   '</button>';
  html += '</div>';

  // ── DETAILS CARD ──
  html += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:1.25rem;margin-bottom:1.5rem">'
       +    '<div style="font-family:var(--font-head);font-size:0.72rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--accent2);margin-bottom:0.75rem">Details</div>';
  if (fields.length) {
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:0.6rem 1.5rem">'
         + fields.map(function(d) {
             return '<div style="display:flex;justify-content:space-between;padding:0.35rem 0;border-bottom:1px solid var(--border)">'
                  +   '<span style="font-size:0.78rem;color:var(--text-dim);font-weight:600">' + d.label + '</span>'
                  +   '<span style="font-size:0.85rem;color:var(--text);text-align:right">' + d.val + '</span>'
                  + '</div>';
           }).join('')
         + '</div>';
  } else {
    html += '<div style="color:var(--text-dim);font-size:0.85rem">No details recorded yet — use Update Info to fill them in.</div>';
  }
  if (notes) {
    html += '<div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border)">'
         +   '<div style="font-size:0.78rem;color:var(--text-dim);font-weight:600;margin-bottom:0.3rem">Notes</div>'
         +   '<div style="font-size:0.85rem;color:var(--text);line-height:1.6;white-space:pre-wrap;word-break:break-word">' + notes + '</div>'
         + '</div>';
  }
  html += '</div>';

  // ── PHOTOS CARD ──
  html += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:1.25rem">'
       +    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem">'
       +      '<div style="font-family:var(--font-head);font-size:0.72rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--accent2)">Photos</div>'
       +      (photoLink ? '<a href="' + photoLink + '" target="_blank" rel="noopener" style="font-size:0.75rem;color:var(--accent2);text-decoration:none">Open Drive Folder ↗</a>' : '')
       +    '</div>'
       +    '<div id="ni-detail-photos" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:0.75rem;min-height:80px">'
       +      (photoLink
              ? '<div style="grid-column:1/-1;text-align:center;padding:1rem;color:var(--text-dim);font-size:0.82rem"><div class="spinner" style="margin:0 auto 0.5rem;width:20px;height:20px;border-width:2px"></div>Loading photos...</div>'
              : '<div style="grid-column:1/-1;text-align:center;padding:2rem 1rem;color:var(--text-dim)">'
                + '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3" style="margin:0 auto 0.5rem;display:block"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>'
                + '<div style="font-size:0.85rem;margin-bottom:0.5rem">No photos uploaded yet</div>'
                + '<button onclick="_nonItemDetailPhotos(' + typeArg + ',' + keyArg + ')" style="padding:0.4rem 0.8rem;border-radius:7px;border:1.5px solid var(--gold);background:var(--bg-card);background:color-mix(in srgb, rgb(212,168,67) 8%, var(--bg-card));color:var(--gold);font-family:var(--font-body);font-size:0.78rem;cursor:pointer;font-weight:600">Add Photos</button>'
                + '</div>')
       +    '</div>'
       + '</div>';

  container.innerHTML = html;

  // Async-load Drive thumbnails when a photo folder URL is set
  if (photoLink && typeof driveGetFolderPhotos === 'function') {
    driveGetFolderPhotos(photoLink).then(function(photos) {
      var el = document.getElementById('ni-detail-photos');
      if (!el) return;
      if (!photos || photos.length === 0) {
        el.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem 1rem;color:var(--text-dim)">'
          + '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3" style="margin:0 auto 0.5rem;display:block"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>'
          + '<div style="font-size:0.85rem;margin-bottom:0.5rem">No photos in folder</div>'
          + '<button onclick="_nonItemDetailPhotos(' + typeArg + ',' + keyArg + ')" style="padding:0.4rem 0.8rem;border-radius:7px;border:1.5px solid var(--gold);background:var(--bg-card);background:color-mix(in srgb, rgb(212,168,67) 8%, var(--bg-card));color:var(--gold);font-family:var(--font-body);font-size:0.78rem;cursor:pointer;font-weight:600">Add Photos</button>'
          + '</div>';
        return;
      }
      var _nflEsc = String(photoLink || '').replace(/'/g, "\\'");
      el.innerHTML = photos.map(function(p) {
        var _npn = (p.name||'').replace(/'/g,"\\'");
        return '<div style="position:relative">'
          + '<a href="' + p.view + '" target="_blank" rel="noopener" style="display:block;border-radius:8px;overflow:hidden;background:var(--surface2);aspect-ratio:1;position:relative">'
          + '<img id="nip-' + p.id + '" style="width:100%;height:100%;object-fit:cover;border-radius:8px;transition:opacity 0.3s" alt="' + (p.name||'Photo') + '">'
          + '<div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.6));padding:0.3rem 0.5rem">'
          + '<div style="font-size:0.65rem;color:#fff;font-family:var(--font-head);letter-spacing:0.05em;text-transform:uppercase">' + (p.name||'').replace(/\.[^.]+$/,'') + '</div>'
          + '</div></a>'
          // v0.9.838 (Brad): rotate/crop on paper/catalog photos too — same
          // shared editor as train-item photos.
          + '<button class="rr-tap" onclick="event.preventDefault();event.stopPropagation();_detailPhotoEdit(\'' + p.id + '\',\'' + _npn + '\',\'' + _nflEsc + '\')" title="Rotate / crop this photo" style="position:absolute;top:4px;right:4px;z-index:2;width:26px;height:26px;border-radius:6px;border:none;background:rgba(0,0,0,0.55);color:#fff;font-size:0.8rem;cursor:pointer;line-height:1">\u2702</button>'
          + '</div>';
      }).join('');
      photos.forEach(function(p) {
        var imgEl = document.getElementById('nip-' + p.id);
        if (imgEl && typeof loadDriveThumb === 'function') loadDriveThumb(p.id, imgEl, imgEl.parentElement);
      });
    }).catch(function(e) {
      console.warn('Non-item photo gallery load:', e);
      var el = document.getElementById('ni-detail-photos');
      if (el) el.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:1rem;color:var(--text-dim);font-size:0.82rem">Could not load photos</div>';
    });
  }
}
window.showNonItemDetailPage = showNonItemDetailPage;

// ── Generic Update Info Modal (Session 116) ────────────────────────
// Renders an edit form driven by cfg.editFields, gathers new values,
// rebuilds the full row from cfg.rowSchema (so non-editable columns
// like photoLink are preserved untouched), writes the row to the
// user's Google Sheet, updates state, and re-renders the detail page.
//
// Locked fields render as a styled-disabled input — Brad's preference
// is to lock the item number / catalog ID so changes don't orphan
// existing Sheet rows.
function _nonItemDetailEdit(type, key) {
  // Service Tools share the regular Items code path, so delegate to
  // the existing showItemPanel / updateCollectionItem flow rather
  // than the generic non-item modal. That keeps box/item photos,
  // partner item handling, and inventory ID logic working correctly.
  if (type === 'service') {
    var pd = state.personalData ? state.personalData[key] : null;
    if (!pd) { if (typeof showToast === 'function') showToast('Service tool not found', 3000, true); return; }
    var master = typeof findMaster === 'function' ? findMaster(pd.itemNum, null, pd) : null;
    var masterIdx = master && state.masterData ? _masterIdxOf(master) : -1;
    // Audit fix #1 (Session 116): if the master row isn't loaded
    // (e.g. a different era is selected), updateCollectionItem(-1, ...)
    // would silently misbehave. Toast and bail instead.
    if (!master || masterIdx < 0) {
      if (typeof showToast === 'function') showToast('Switch to the Postwar era to edit this Service Tool — its catalog row isn\'t loaded.', 4500, true);
      return;
    }
    if (typeof updateCollectionItem === 'function') {
      updateCollectionItem(masterIdx, key);
      return;
    }
  }

  var cfg = (window.NON_ITEM_DETAIL_CONFIG || {})[type];
  if (!cfg || !Array.isArray(cfg.editFields) || !cfg.editFields.length) {
    if (typeof showToast === 'function') showToast('Edit not configured for this type yet.', 3500);
    return;
  }
  // Resolve entry from bucketPath
  var bucket = state;
  cfg.bucketPath.split('.').forEach(function(seg) { bucket = bucket && bucket[seg]; });
  var entry = bucket ? bucket[key] : null;
  if (!entry) {
    if (typeof showToast === 'function') showToast('Record not found.', 3000, true);
    return;
  }

  // Build the modal
  var ov = document.createElement('div');
  ov.id = '_ni-edit-modal';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10010;display:flex;align-items:center;justify-content:center;padding:1.5rem';
  bindOverlayClose(ov, function() { ov.remove(); });

  var box = document.createElement('div');
  box.style.cssText = 'background:var(--surface);border:1px solid var(--border);border-radius:14px;max-width:520px;width:100%;max-height:85vh;overflow-y:auto;padding:1.5rem;position:relative';

  var hdr = document.createElement('div');
  hdr.style.cssText = 'font-family:var(--font-head);font-size:1.05rem;color:var(--accent);margin-bottom:0.25rem';
  hdr.textContent = 'Update ' + (cfg.label || 'Item') + ' Info';
  box.appendChild(hdr);

  var sub = document.createElement('div');
  sub.style.cssText = 'font-size:0.85rem;color:var(--text-mid);margin-bottom:1.25rem';
  sub.textContent = (cfg.itemNumDisplay(entry) || '') + (entry.title ? (' — ' + entry.title) : '');
  box.appendChild(sub);

  // Render an input for each editField
  var inputsByKey = {};
  cfg.editFields.forEach(function(f) {
    var wrap = document.createElement('div');
    wrap.style.cssText = 'margin-bottom:0.85rem';

    var lbl = document.createElement('label');
    lbl.style.cssText = 'display:block;font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.25rem;font-weight:600';
    lbl.textContent = f.label + (f.locked ? '  (locked)' : '');
    wrap.appendChild(lbl);

    var current = entry[f.key];
    if (current == null) current = '';
    var inp;

    if (f.type === 'textarea') {
      inp = document.createElement('textarea');
      inp.rows = 3;
      inp.value = String(current);
      inp.style.cssText = 'width:100%;padding:0.55rem 0.7rem;border-radius:7px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none;box-sizing:border-box;resize:vertical';
    } else if (f.type === 'select') {
      inp = document.createElement('select');
      inp.style.cssText = 'width:100%;padding:0.55rem 0.7rem;border-radius:7px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none;box-sizing:border-box';
      // Allow blank option
      var opt0 = document.createElement('option');
      opt0.value = ''; opt0.textContent = '— select —';
      inp.appendChild(opt0);
      (f.options || []).forEach(function(o) {
        var opt = document.createElement('option');
        opt.value = o; opt.textContent = o;
        if (String(current) === o) opt.selected = true;
        inp.appendChild(opt);
      });
    } else if (f.type === 'yesno') {
      inp = document.createElement('select');
      inp.style.cssText = 'width:100%;padding:0.55rem 0.7rem;border-radius:7px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none;box-sizing:border-box';
      ['','Yes','No'].forEach(function(v) {
        var opt = document.createElement('option');
        opt.value = v; opt.textContent = v || '— select —';
        if (String(current) === v) opt.selected = true;
        inp.appendChild(opt);
      });
    } else {
      inp = document.createElement('input');
      inp.value = String(current);
      if (f.type === 'number') {
        inp.type = 'number';
        if (f.min != null) inp.min = f.min;
        if (f.max != null) inp.max = f.max;
        if (f.step != null) inp.step = f.step;
      } else if (f.type === 'money') {
        inp.type = 'number'; inp.step = '0.01'; inp.min = '0';
      } else if (f.type === 'date') {
        inp.type = 'date';
      } else {
        inp.type = 'text';
      }
      inp.style.cssText = 'width:100%;padding:0.55rem 0.7rem;border-radius:7px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-family:var(--font-body);font-size:0.9rem;outline:none;box-sizing:border-box';
    }

    if (f.locked) {
      inp.disabled = true;
      inp.style.opacity = '0.55';
      inp.style.cursor = 'not-allowed';
      inp.style.background = 'var(--surface2)';
    }

    inputsByKey[f.key] = inp;
    wrap.appendChild(inp);
    box.appendChild(wrap);
  });

  // Buttons
  var btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:0.5rem;justify-content:flex-end;margin-top:1.25rem;border-top:1px solid var(--border);padding-top:1rem';

  var cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = 'padding:0.55rem 1rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text-mid);font-family:var(--font-body);font-size:0.85rem;cursor:pointer;font-weight:600';
  cancelBtn.onclick = function() { ov.remove(); };

  var saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save Changes';
  saveBtn.style.cssText = 'padding:0.55rem 1.1rem;border-radius:8px;border:1.5px solid #2980b9;background:#2980b9;color:#fff;font-family:var(--font-body);font-size:0.88rem;cursor:pointer;font-weight:700';
  saveBtn.onclick = function() {
    if (saveBtn._busy) return;
    saveBtn._busy = true;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    _saveNonItemEdit(type, key, entry, cfg, inputsByKey)
      .then(function() {
        ov.remove();
        if (typeof showToast === 'function') showToast('✓ Changes saved');
        // Re-render the detail page so the user sees their edits
        if (typeof showNonItemDetailPage === 'function') showNonItemDetailPage(type, key);
      })
      .catch(function(err) {
        console.error('non-item edit save failed:', err);
        saveBtn._busy = false;
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';
        // Session 159: friendly re-sign-in path when OAuth token expired
        if (err && err.message === 'SESSION_EXPIRED') {
          if (typeof showToast === 'function') showToast('🔐 Your sign-in expired — please sign in again to save.', 6000, true);
          try {
            var _au = document.getElementById('auth-screen');
            var _ap = document.getElementById('app');
            if (_au) _au.style.display = 'flex';
            if (_ap) _ap.classList.remove('active');
          } catch(_se) { console.warn('show auth-screen failed:', _se); }
        } else if (typeof showToast === 'function') {
          showToast(rrSaveError(err, 'your change'), 4500, true);
        }
      });
  };

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(saveBtn);
  box.appendChild(btnRow);

  ov.appendChild(box);
  document.body.appendChild(ov);
  if (window.BackStack && BackStack.wire) BackStack.wire(ov); // v0.9.806 TODO-012: device Back closes this pop-up
}
window._nonItemDetailEdit = _nonItemDetailEdit;

// Internal helper: gather form values, update entry in state, rebuild
// the full Sheet row using cfg.rowSchema, write it via sheetsUpdate.
async function _saveNonItemEdit(type, key, entry, cfg, inputsByKey) {
  if (!cfg.rowSchema || !cfg.sheetTab) {
    throw new Error('Sheet row schema missing for ' + type);
  }
  // Apply input values onto entry (skip locked fields — they retain
  // their existing value since the input is disabled).
  cfg.editFields.forEach(function(f) {
    if (f.locked) return;
    var inp = inputsByKey[f.key];
    if (!inp) return;
    var val = inp.value == null ? '' : String(inp.value).trim();
    entry[f.key] = val;
  });
  // Recompute derived fields where the renderer expects them
  if (type === 'catalogs') {
    entry.title = [entry.year, entry.catType, 'Catalog'].filter(Boolean).join(' ');
  }

  // Rebuild the full row from rowSchema (preserves non-editable cols).
  // Some keys (e.g. Sets' quickEntry) are stored as booleans in state
  // but written as Yes/No strings in the sheet — boolToYesNo flag.
  var rowVals = cfg.rowSchema.map(function(c) {
    var v = entry[c.key];
    if (c.boolToYesNo) {
      v = v ? 'Yes' : (v === false || v === '' ? 'No' : (v || ''));
    }
    return v == null ? '' : v;
  });

  // Compute range. cfg.rowSchema[0].col → first column,
  // cfg.rowSchema[last].col → last.
  var firstCol = cfg.rowSchema[0].col;
  var lastCol  = cfg.rowSchema[cfg.rowSchema.length - 1].col;
  var rowNum   = entry.row;
  if (!rowNum || typeof rowNum !== 'number') {
    throw new Error('Row number missing on entry — cannot save');
  }
  var range = cfg.sheetTab + '!' + firstCol + rowNum + ':' + lastCol + rowNum;

  if (typeof sheetsUpdate !== 'function') throw new Error('sheetsUpdate unavailable');
  await sheetsUpdate(state.personalSheetId, range, [rowVals]);

  // Refresh local cache so other views pick up the change
  if (typeof _cachePersonalData === 'function') _cachePersonalData();
}
window._saveNonItemEdit = _saveNonItemEdit;

// ── Generic Photo Upload Modal (Session 116, Commit 7) ─────────────
// Renders a slot per cfg.photoViews(entry). Each slot lets the user
// pick a single image. On Save the modal:
//   1. Ensures the type's root folder exists under the user's vault
//      (e.g. "Catalog Photos") — creates it on first use.
//   2. Ensures the per-record subfolder exists (e.g.
//      "Catalog Photos/8055-CON/") — creates on first use.
//   3. Uploads each chosen file with a deterministic name like
//      "8055-CON FRONT.jpg" so the gallery can label it later.
//   4. Saves the folder URL into entry.photoLink (and writes it to
//      the user's Sheet so it persists across reloads).
//   5. Re-renders the detail page so the new photos appear.
function _nonItemDetailPhotos(type, key) {
  // Service Tools delegate to the existing item photo flow.
  if (type === 'service') {
    var pdSvc = state.personalData ? state.personalData[key] : null;
    if (!pdSvc) { if (typeof showToast === 'function') showToast('Service tool not found', 3000, true); return; }
    var masterSvc = typeof findMaster === 'function' ? findMaster(pdSvc.itemNum, null, pdSvc) : null;
    var masterIdxSvc = masterSvc && state.masterData ? _masterIdxOf(masterSvc) : -1;
    // Audit fix #1: bail with a helpful toast if the master row isn't
    // loaded (era not selected) instead of falling through with -1.
    if (!masterSvc || masterIdxSvc < 0) {
      if (typeof showToast === 'function') showToast('Switch to the Postwar era to add photos for this Service Tool — its catalog row isn\'t loaded.', 4500, true);
      return;
    }
    if (typeof showItemPanel === 'function') {
      showItemPanel(masterIdxSvc, key, 'edit');
      return;
    }
  }

  var cfg = (window.NON_ITEM_DETAIL_CONFIG || {})[type];
  if (!cfg || typeof cfg.photoViews !== 'function') {
    if (typeof showToast === 'function') showToast('Photo upload not configured for this type yet.', 3500);
    return;
  }
  var bucket = state;
  cfg.bucketPath.split('.').forEach(function(seg) { bucket = bucket && bucket[seg]; });
  var entry = bucket ? bucket[key] : null;
  if (!entry) { if (typeof showToast === 'function') showToast('Record not found.', 3000, true); return; }

  var views = cfg.photoViews(entry) || [];
  if (!views.length) {
    if (typeof showToast === 'function') showToast('No photo slots configured for this type.', 3500);
    return;
  }

  // Build modal
  var ov = document.createElement('div');
  ov.id = '_ni-photos-modal';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10010;display:flex;align-items:center;justify-content:center;padding:1.5rem';
  bindOverlayClose(ov, function() { if (!ov._uploading) ov.remove(); });

  var box = document.createElement('div');
  box.style.cssText = 'background:var(--surface);border:1px solid var(--border);border-radius:14px;max-width:560px;width:100%;max-height:85vh;overflow-y:auto;padding:1.5rem;position:relative';

  var hdr = document.createElement('div');
  hdr.style.cssText = 'font-family:var(--font-head);font-size:1.05rem;color:var(--accent);margin-bottom:0.25rem';
  hdr.textContent = 'Add Photos — ' + (cfg.label || 'Item');
  box.appendChild(hdr);

  var sub = document.createElement('div');
  sub.style.cssText = 'font-size:0.85rem;color:var(--text-mid);margin-bottom:1rem';
  sub.textContent = (cfg.itemNumDisplay(entry) || '') + (entry.title ? (' — ' + entry.title) : '');
  box.appendChild(sub);

  var hint = document.createElement('div');
  hint.style.cssText = 'font-size:0.78rem;color:var(--text-dim);margin-bottom:1rem;line-height:1.5';
  hint.innerHTML = 'Pick a file for each slot you want to upload. You can leave slots empty and come back to add more later. Photos save to <strong>' + cfg.photoRootName + '/' + (cfg.photoFolderName(entry) || '') + '/</strong> in your Drive.';
  box.appendChild(hint);

  // Audit fix #2 (Session 116): when a user opens Add Photos on a Set
  // and the master setData hasn't been loaded for the relevant era,
  // photoViews falls back to just the Set Box slot. Without a banner,
  // the user thinks that's all they can upload. Surface a warning so
  // they can switch eras first if they want item-level slots too.
  if (type === 'sets' && window.state && Array.isArray(state.setData)) {
    var masterFound = state.setData.some(function(s) {
      return s.setNum === entry.setNum && (!entry.year || !s.year || s.year === entry.year);
    });
    if (!masterFound) {
      var warn = document.createElement('div');
      warn.style.cssText = 'font-size:0.8rem;background:rgba(230,126,34,0.1);border:1px solid #e67e22;color:#e67e22;border-radius:8px;padding:0.6rem 0.8rem;margin-bottom:1rem;line-height:1.5';
      warn.innerHTML = '⚠️ Only the Set Box slot is available. Switch to the era this set belongs to (likely Postwar) and re-open Add Photos to see item slots for each piece.';
      box.appendChild(warn);
    }
  }

  // Build a row per view slot
  var fileInputsByView = {};
  views.forEach(function(v) {
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:0.75rem;padding:0.6rem 0;border-bottom:1px solid var(--border)';

    var lblWrap = document.createElement('div');
    lblWrap.style.cssText = 'flex:0 0 140px;font-size:0.82rem;color:var(--text);font-weight:600';
    lblWrap.textContent = v.label;
    row.appendChild(lblWrap);

    var fi = document.createElement('input');
    fi.type = 'file';
    fi.accept = 'image/*';
    fi.style.cssText = 'flex:1;font-size:0.82rem;color:var(--text-mid)';
    row.appendChild(fi);

    // v0.9.808 (TODO-008/012): crop-first — picking a photo opens the cropper
    // right away; Apply swaps the cropped file into the slot, Cancel keeps the
    // full photo. Same flow as the wizard and contact cards.
    fi.addEventListener('change', function () {
      if (!fi.files || !fi.files.length) return;
      if (typeof window._openCropper !== 'function' || typeof DataTransfer === 'undefined') return;
      var orig = fi.files[0];
      var url = URL.createObjectURL(orig);
      window._openCropper(url, function (blob) {
        try { URL.revokeObjectURL(url); } catch (e) {}
        try {
          var f = new File([blob], String(orig.name || 'photo').replace(/\.[^.]+$/, '') + '_crop.jpg', { type: 'image/jpeg' });
          var dt = new DataTransfer(); dt.items.add(f);
          fi.files = dt.files;   // programmatic set — does NOT re-fire change
        } catch (e) { console.warn('[ni-photos crop]', e); }
      }, function () {
        try { URL.revokeObjectURL(url); } catch (e) {}
        // Cancel = keep the full photo as picked
      });
    });

    fileInputsByView[v.key] = fi;
    box.appendChild(row);
  });

  var status = document.createElement('div');
  status.id = '_ni-photos-status';
  status.style.cssText = 'font-size:0.82rem;color:var(--text-dim);margin-top:1rem;min-height:1.2em';
  box.appendChild(status);

  var btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:0.5rem;justify-content:flex-end;margin-top:1rem;border-top:1px solid var(--border);padding-top:1rem';

  var cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = 'padding:0.55rem 1rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text-mid);font-family:var(--font-body);font-size:0.85rem;cursor:pointer;font-weight:600';
  cancelBtn.onclick = function() { if (!ov._uploading) ov.remove(); };

  var saveBtn = document.createElement('button');
  saveBtn.textContent = 'Upload Photos';
  saveBtn.style.cssText = 'padding:0.55rem 1.1rem;border-radius:8px;border:1.5px solid var(--gold);background:var(--gold);color:#000;font-family:var(--font-body);font-size:0.88rem;cursor:pointer;font-weight:700';
  saveBtn.onclick = function() {
    // Collect chosen files
    var picks = [];
    views.forEach(function(v) {
      var inp = fileInputsByView[v.key];
      if (inp && inp.files && inp.files.length > 0) {
        picks.push({ view: v, file: inp.files[0] });
      }
    });
    if (!picks.length) {
      if (typeof showToast === 'function') showToast('Pick at least one photo first.', 3000);
      return;
    }
    if (saveBtn._busy) return;
    saveBtn._busy = true;
    ov._uploading = true;
    saveBtn.disabled = true;
    cancelBtn.disabled = true;
    saveBtn.textContent = 'Uploading…';

    _uploadNonItemPhotos(type, key, entry, cfg, picks, function(msg) {
      status.textContent = msg;
    })
      .then(function() {
        ov.remove();
        if (typeof showToast === 'function') showToast('✓ Photos uploaded');
        // Re-render the detail page so photos card shows fresh thumbs
        if (typeof showNonItemDetailPage === 'function') showNonItemDetailPage(type, key);
      })
      .catch(function(err) {
        console.error('[non-item photo upload]', err);
        ov._uploading = false;
        saveBtn._busy = false;
        saveBtn.disabled = false;
        cancelBtn.disabled = false;
        saveBtn.textContent = 'Upload Photos';
        status.style.color = 'var(--accent)';
        status.textContent = 'Upload failed: ' + (err && err.message ? err.message : 'try again');
      });
  };

  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(saveBtn);
  box.appendChild(btnRow);
  ov.appendChild(box);
  document.body.appendChild(ov);
  if (window.BackStack && BackStack.wire) BackStack.wire(ov); // v0.9.806 TODO-012: device Back closes this pop-up
}
window._nonItemDetailPhotos = _nonItemDetailPhotos;

// Internal: ensure the type's photo root folder exists under the
// user's vault, returning the folder ID. Caches via driveCache so
// we don't hit Drive on every upload.
async function _ensureNonItemPhotoRoot(rootName) {
  if (typeof driveEnsureSetup === 'function') await driveEnsureSetup();
  if (!driveCache || !driveCache.vaultId) throw new Error('Drive vault not ready — try signing in again');
  driveCache._niRoots = driveCache._niRoots || {};
  if (driveCache._niRoots[rootName]) return driveCache._niRoots[rootName];
  var id = await driveFindOrCreateFolder(rootName, driveCache.vaultId);
  driveCache._niRoots[rootName] = id;
  return id;
}

// Internal helpers for audit fix #3 — replace-on-reupload behavior.
// Drive lets a folder hold multiple files with the same name, so we
// have to look one up by name + parent and trash it before uploading
// the new version. Both helpers fail soft (return null / swallow
// errors) so the upload itself can proceed even if Drive's index is
// briefly inconsistent.
async function _findDriveFileByName(folderId, fileName) {
  if (!folderId || !fileName || typeof driveRequest !== 'function') return null;
  try {
    var safe = String(fileName).replace(/'/g, "\\'");
    var q = encodeURIComponent("name='" + safe + "' and '" + folderId + "' in parents and trashed=false");
    var res = await driveRequest('GET', '/files?q=' + q + '&fields=files(id,name)');
    if (res && res.files && res.files.length) return res.files[0].id;
  } catch (e) {
    console.warn('[non-item photo] _findDriveFileByName error:', e);
  }
  return null;
}
async function _trashDriveFile(fileId) {
  if (!fileId || typeof driveRequest !== 'function') return;
  // PATCH with trashed=true — moves to Drive trash (recoverable),
  // does NOT permanently delete. Honors the "no permanent delete"
  // safety convention.
  await driveRequest('PATCH', '/files/' + fileId, { trashed: true });
}

// Internal: do the actual uploads + persist the folder URL.
// picks = [{ view: {key, label}, file: File }, ...]
// progressCb = function(msg) — called with status updates
async function _uploadNonItemPhotos(type, key, entry, cfg, picks, progressCb) {
  if (typeof driveEnsureSetup !== 'function' || typeof driveFindOrCreateFolder !== 'function' || typeof driveUploadFile !== 'function') {
    throw new Error('Drive helpers unavailable');
  }
  progressCb && progressCb('Preparing Drive folder…');
  var rootId = await _ensureNonItemPhotoRoot(cfg.photoRootName);
  var subName = (cfg.photoFolderName(entry) || 'untitled').toString();
  var folderId = await driveFindOrCreateFolder(subName, rootId);
  var folderUrl = (typeof driveFolderLink === 'function')
    ? driveFolderLink(folderId)
    : ('https://drive.google.com/drive/folders/' + folderId);

  // Upload each file in turn (sequential keeps order + bandwidth sane).
  // Audit fix #3 (Session 116): if a file with the same name already
  // exists in the folder, move it to Drive trash so re-uploading the
  // Front Cover slot does not leave a second '8055-CON FRONT.jpg' with
  // both showing in the gallery. Trash (not permanent delete) means
  // Brad can recover from Drive's trash if he ever needs the previous
  // version back.
  //
  // v0.9.1275 (R16): UPLOAD FIRST, THEN trash. The old order was
  // trash-then-upload, which has a window where the photo exists
  // nowhere but Drive's trash — a failed or interrupted upload (bad
  // signal at a train show, a 403, a closed lid) left the slot EMPTY
  // and the only copy in the trash, silently. Drive allows two files
  // with the same name, so uploading beside the old one first is safe:
  // the worst a failure can do now is leave a brief duplicate, which
  // the next successful replace cleans up.
  var replacedCount = 0;
  for (var i = 0; i < picks.length; i++) {
    var p = picks[i];
    progressCb && progressCb('Uploading ' + (i + 1) + ' of ' + picks.length + '…');
    var ext = '.jpg';
    var origName = p.file.name || '';
    var dot = origName.lastIndexOf('.');
    if (dot > 0 && dot < origName.length - 1) ext = origName.substring(dot);
    var fileName = subName + ' ' + p.view.key + ext;
    // Capture the old file's id BEFORE uploading its replacement, so the
    // name search cannot land on the new copy.
    var existingId = await _findDriveFileByName(folderId, fileName);
    if (existingId) progressCb && progressCb('Replacing existing photo (' + (i + 1) + ' of ' + picks.length + ')…');
    await driveUploadFile(p.file, fileName, folderId);
    // Only after the new copy is safely up does the old one go to trash.
    if (existingId) {
      try {
        await _trashDriveFile(existingId);
        replacedCount++;
      } catch (e) {
        // Non-fatal — the new photo is up; worst case the gallery briefly
        // shows the old duplicate beside it.
        console.warn('[non-item photo] could not trash old version:', e);
      }
    }
  }
  if (replacedCount > 0 && typeof showToast === 'function') {
    // Quick informational toast after success — user knows the prior
    // file was moved to Drive trash, not silently overwritten.
    setTimeout(function() {
      showToast('Replaced ' + replacedCount + ' existing photo' + (replacedCount === 1 ? '' : 's') + ' (old version' + (replacedCount === 1 ? '' : 's') + ' in Drive trash).', 4000);
    }, 700);
  }

  // Save the folder URL onto the entry + write it to the sheet so
  // it persists across reloads. If the entry already had a URL we
  // still re-save (harmless) so the row stays in sync.
  var linkKey = cfg.photoLinkKey || 'photoLink';
  if (entry[linkKey] !== folderUrl) {
    entry[linkKey] = folderUrl;
    if (cfg.rowSchema && cfg.sheetTab && entry.row && typeof sheetsUpdate === 'function') {
      var rowVals = cfg.rowSchema.map(function(c) {
        var v = entry[c.key];
        if (c.boolToYesNo) v = v ? 'Yes' : (v === false || v === '' ? 'No' : (v || ''));
        return v == null ? '' : v;
      });
      var firstCol = cfg.rowSchema[0].col;
      var lastCol  = cfg.rowSchema[cfg.rowSchema.length - 1].col;
      var range = cfg.sheetTab + '!' + firstCol + entry.row + ':' + lastCol + entry.row;
      progressCb && progressCb('Saving photo link to your sheet…');
      await sheetsUpdate(state.personalSheetId, range, [rowVals]);
    }
  }
  if (typeof _cachePersonalData === 'function') _cachePersonalData();
}
window._uploadNonItemPhotos = _uploadNonItemPhotos;

function showItemDetailPage(idx, copyInvId, opts) {
  var _wantMode = !!(opts && opts.wantMode);
  var _wantEntry = opts && opts.wantEntry;
  var _wantPartner = (opts && opts.wantPartner) || '';
  var _wantHeading = (opts && opts.wantHeading) || '';
  // Bug 12 (Session 154): remember which item the detail page is showing so
  // savePhotoOnlyUpdate can re-render it after a photo is added.
  window._lastDetailIdx = idx;
  window._lastDetailCopyInv = copyInvId || null;
  // Session 115: capture which Browse tab + filter state the user
  // came from so the Back button restores the same tab on return.
  // Was: Back always called filterOwned() which forced _browseTab to
  // 'items', so clicking into a Set / Catalog / etc. and hitting back
  // dropped you onto the Items tab regardless of where you started.
  if (window._detailReturn !== 'tools') {
    window._lastBrowseState = {
      tab:        state._browseTab || 'items',
      owned:      !!state.filters.owned,
      filterType: state.filters.type || '',
      filterRoad: state.filters.road || '',
      search:     state.filters.search || '',
      page:       state.currentPage || 1,             // v0.9.1231 (Brad): come back to the page you left
      filters:    Object.assign({}, state.filters),   // v0.9.798: FULL snapshot (mfr/scale/era chips too)
    };
  }
  const item = idx >= 0 ? state.masterData[idx] : null;
  let pd = null, pdKey = null;
  if (item) {
    pdKey = findPDKey(item.itemNum, item.variation);
    pd = pdKey ? state.personalData[pdKey] : null;
    // Bug 15 (Session 154): when a specific copy was clicked (item owned in
    // multiple copies), select THAT copy by inventory ID so its box/IS/
    // condition/photos show — not just the first matching copy.
    if (copyInvId) {
      var _ckey = Object.keys(state.personalData).find(function(k){
        var p = state.personalData[k];
        return p && p.owned && String(p.inventoryId) === String(copyInvId) && p.itemNum === item.itemNum;
      });
      if (_ckey) { pdKey = _ckey; pd = state.personalData[_ckey]; }
    }
  } else {
    // v0.9.1254 (finding L): the index is cleared whenever personalData is
    // rebuilt, so a stale entry resolves to nothing rather than to somebody
    // else. Say so instead of silently showing an empty page.
    const poKey = window._poKeys ? window._poKeys[-(idx+1000)] : null;
    pd = poKey ? state.personalData[poKey] : null;
    pdKey = pd ? poKey : null;
    if (poKey && !pd) {
      console.warn('[detail] item ' + poKey + ' is no longer in the collection');
      if (typeof showToast === 'function') {
        showToast('That item is not in your collection any more — your list has been refreshed.', 4000, true);
      }
    }
  }
  if (_wantMode) { pd = null; pdKey = null; }
  // Bug 17 (Session 154): remember the exact copy the detail page is showing
  // so toolbar actions (edit/sell/forsale/remove/upgrade) target THIS copy,
  // not the first matching one.
  window._lastDetailPdKey = pdKey || null;
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
    description: _baseItem ? _baseItem.description : ((pd && pd.description) || ''),   // v0.9.694: manual items carry their own description
    yearProd: pd.yearMade || (_baseItem ? _baseItem.yearProd : ''),
    gauge: pd.gauge || (_baseItem ? _baseItem.gauge : ''),
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
  // Phase 3: detail page For Sale badge by THIS copy's inventoryId.
  const _detailInvId = pd && pd.inventoryId ? pd.inventoryId : '';
  const _fsEntry = _detailInvId ? state.forSaleData[_detailInvId] : null;
  const isForSale = !!_fsEntry;
  const _fsPrice = _fsEntry ? _currencySymbol() + parseFloat(_fsEntry.askingPrice || 0).toLocaleString() : '';
  window._fsEditCur = _fsEntry || null;   // v0.9.1492: the price-edit overlay reads this
  const groupMembers = pd && pd.groupId ? Object.values(state.personalData).filter(p => p.groupId === pd.groupId && p.itemNum !== it.itemNum) : [];
  // v0.9.728 (Brad, Phase 1 group sheet): FULL roster incl. this copy, with
  // state keys so member cards can open the edit panel / photos per piece.
  function _grpRole(p) {
    var n = String(p.itemNum || '').toUpperCase();
    if (p._isIS || /-IS$/.test(n)) return 'Instruction Sheet';
    if (/-MBOX$/.test(n)) return 'Master Carton';
    if (/-BOX$/.test(n)) return 'Box';
    if (typeof isTender === 'function' && isTender(n)) return 'Tender';
    if (/C$/.test(n.replace(/-(P|D)$/, ''))) return 'B Unit';
    if (/-D$/.test(n)) return 'Dummy A Unit';
    if (/-P$/.test(n)) return 'Powered A Unit';
    return 'Engine';
  }
  var _grpRank = { 'Engine': 0, 'Powered A Unit': 0, 'Dummy A Unit': 1, 'B Unit': 2, 'Tender': 3, 'Instruction Sheet': 4, 'Box': 5, 'Master Carton': 6 };
  var _grpFull = [], _grpKeys = [];
  if (pd && pd.groupId && !_wantMode) {
    Object.keys(state.personalData).forEach(function (k) {
      var p = state.personalData[k];
      if (p && p.owned && p.groupId === pd.groupId) { _grpFull.push(p); _grpKeys.push(k); }
    });
    var _zip = _grpFull.map(function (p, i) { return { p: p, k: _grpKeys[i] }; });
    _zip.sort(function (a, b) {
      var ra = _grpRank[_grpRole(a.p)], rb = _grpRank[_grpRole(b.p)];
      return (ra === undefined ? 9 : ra) - (rb === undefined ? 9 : rb);   // v0.9.729: 0 is a real rank (|| swallowed it → dummy sorted first, config said 'Set')
    });
    _grpFull = _zip.map(function (z) { return z.p; });
    _grpKeys = _zip.map(function (z) { return z.k; });
    window._grpMemberKeys = _grpKeys;
  }
  var _isGroupSheet = _grpFull.length > 1;
  var _grpUnits = _grpFull.filter(function (p) { return !/-(BOX|MBOX|IS)$/i.test(String(p.itemNum || '')); });
  var _grpCfg = (_isGroupSheet && typeof groupConfigLabel === 'function' && _grpUnits.length > 1)
    ? groupConfigLabel(_grpUnits[0].itemNum, _grpUnits.slice(1).map(function (p) { return p.itemNum; })) : '';
  // Bug 15 (Session 154): include grouped instruction sheets (separate isData
  // store) so the detail page lists the IS as part of this item.
  if (pd && pd.groupId && state.isData) {
    Object.values(state.isData).forEach(function(_is){
      if (_is && _is.groupId === pd.groupId) groupMembers.push({ itemNum: _is.sheetNum || ((_is.linkedItem||'') + '-IS'), variation: '', _isIS: true });
    });
  }

  // ── HEADER ──
  const _detRet = window._detailReturn;
  let _backLabel = 'Back to Collection';
  let _backFn    = '_detailBackToBrowse()';
  if (_detRet === 'dashboard') {
    // v0.9.872 (Brad): dashboard origin wins, even for want-mode details.
    _backLabel = 'Back to Dashboard';
    _backFn    = 'delete window._detailReturn;showPage(&apos;dashboard&apos;);if(typeof buildDashboard===&apos;function&apos;)buildDashboard()';
  } else if (_wantMode || _detRet === 'want') {
    _backLabel = 'Back to Want List';
    _backFn    = 'delete window._detailReturn;showPage(&apos;upgrade&apos;)';
  } else if (_detRet === 'forsale') {
    _backLabel = 'Back to Sale List';
    _backFn    = 'delete window._detailReturn;showPage(&apos;forsale&apos;)';
  } else if (_detRet === 'tools') {
    _backLabel = 'Back to Collection Tools';
    _backFn    = 'delete window._detailReturn;showPage(&apos;tools&apos;);buildToolsPage()';
  } else if (_detRet === 'dashboard') {
    // v0.9.845 (Brad): opened from a dashboard card — go back to the dashboard.
    _backLabel = 'Back to Dashboard';
    _backFn    = 'delete window._detailReturn;showPage(&apos;dashboard&apos;);if(typeof buildDashboard===&apos;function&apos;)buildDashboard()';
  }
  // v0.9.1010 (Brad): the header block (title + description) is held in its
  // own variable so the photo card can sit BESIDE it in a two-column grid on
  // desktop — the photo fills the space to the right of the text instead of
  // a fixed 340px strip. Everything after the header (toolbar, details,
  // galleries) stays full width below the pair.
  //
  // v0.9.1020 (Brad, phones): the long Description / Variation Description
  // block is split out so PHONES can show the PHOTO first and the wall of
  // variation text after it — on a phone the photo used to be dead last,
  // below every line of text plus the buttons and the details card.
  var _isPhoneDetail = (window.innerWidth || 0) < 1000;
  // v0.9.1320 (Brad: "need to put the description text in a box with a white
  // background so the logo doesn't make it hard to read"): the description
  // block sits in an OPAQUE card — var(--surface), the theme's card colour
  // (white/cream in the light theme), so the conductor watermark can't bleed
  // through the text. The box only renders when there is text to protect.
  var _descInner = `
        ${it.description ? `<div style="font-size:0.85rem;color:var(--text-mid);line-height:1.5"><strong style="color:var(--text)">Description:</strong> ${it.description}</div>` : ''}
        ${it.varDesc ? `<div style="font-size:0.85rem;color:var(--text-mid);line-height:1.5;margin-top:0.3rem;white-space:pre-line"><strong style="color:var(--text)">Variation Description:</strong> ${it.varDesc}</div>` : ''}
        ${(function(){ var _u = (typeof _itemExternalLinkURL==='function')?_itemExternalLinkURL(it):(it.refLink||''); return _u ? `<a href="${_u}" target="_blank" rel="noopener" style="font-size:0.78rem;color:var(--accent2);text-decoration:none;display:inline-flex;align-items:center;gap:0.3rem;margin-top:0.4rem">View on ${(typeof _externalSiteLabel === "function" ? _externalSiteLabel(_u) : "External")} <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>` : ''; })()}`;
  var _descBlock = _descInner.trim()
    ? `<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:0.75rem 0.9rem;margin-top:0.5rem">${_descInner}</div>`
    : '';
  let _headHtml = `
  <div style="margin-bottom:1.5rem">
    <!-- v0.9.1155 (Brad): "we need a next item, previous item with arrows on
         the detail pages to advance to the next item in the list it just came
         from". Back stays left, the arrows sit right. rrDetailNavHtml()
         returns '' when there is no list to step through (a deep link, a lone
         search hit), so the header then looks exactly as it always did. -->
    <div id="rr-detail-nav" style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.75rem;flex-wrap:wrap">
    <button onclick="${_backFn}" style="background:none;border:none;color:#2980b9;font-family:var(--font-body);font-size:1.1rem;font-weight:700;cursor:pointer;padding:0;display:flex;align-items:center;gap:0.4rem">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
      ${_backLabel}
    </button>
    ${typeof rrDetailNavHtml === 'function' ? rrDetailNavHtml() : ''}
    </div>
    <div style="display:flex;align-items:flex-start;gap:1rem;flex-wrap:wrap">
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;margin-bottom:0.25rem">
          <span style="font-family:var(--font-head);font-size:1.6rem;color:var(--accent);letter-spacing:0.03em">${_wantMode ? ('Wanted: ' + (_wantHeading || (it.itemNum + (_wantPartner ? ' with a ' + _wantPartner : '')))) : (!String(it.itemNum||'').trim() ? String((pd && (pd.yourDescription || pd.description)) || it.description || 'No item number').split(' ').slice(0, 8).join(' ') : (String(it.itemNum||'').indexOf(' ')===-1 ? 'No. ' + it.itemNum + (it.poweredDummy === 'P' ? '-P' : it.poweredDummy === 'D' ? '-D' : '') : it.itemNum))}</span>${typeof window._noNumTag==='function' ? window._noNumTag(it.itemNum) : ''}
          ${isForSale ? `<span style="font-size:1rem;color:var(--gold);font-family:var(--font-head);letter-spacing:0.02em">— on the sale list for <span id="fs-price-span">${_fsPrice}</span></span> <a href="javascript:_fsEditPrice()" style="font-size:0.78rem;color:var(--accent2);text-decoration:none;font-weight:700">edit</a>` : ''}
          ${it.variation ? `<span style="font-size:0.9rem;color:var(--text-dim);background:var(--surface2);border-radius:6px;padding:0.15rem 0.6rem">Var. ${it.variation}</span>` : ''}
          ${it.itemType ? `<span class="tag">${it.itemType}</span>` : ''}
          ${it.yearProd ? `<span style="font-size:0.82rem;color:var(--text-dim)">${it.yearProd}</span>` : ''}
        </div>
        <div style="font-size:1.05rem;color:var(--text);margin-bottom:0.2rem">${it.roadName || ''}</div>
        ${_isPhoneDetail ? '' : _descBlock}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.4rem;flex-shrink:0">
        ${_wantMode
          ? `<span class="owned-badge" style="font-size:0.85rem;background:rgba(59,130,246,0.12);color:#3b82f6;border:1px solid #3b82f6">\u2605 On Want List</span>`
          : `<span class="owned-badge ${isForSale ? 'forsale' : 'yes'}" style="font-size:0.85rem">${isForSale ? '\ud83c\udff7\ufe0f For Sale' : '\u2713 In Collection'}</span>
        ${cond ? `<span style="font-size:0.85rem"><span class="condition-pip ${condClass}"></span> ${cond}/10</span>` : ''}`}
      </div>
    </div>
  </div>`;
  let html = '';

  // ── ACTION TOOLBAR ──
  if (_wantMode) {
    html += `
  <div class="rr-detail-actions" style="display:flex;gap:0.5rem;margin-bottom:1.5rem;flex-wrap:wrap">
    <button onclick="wantFindOnEbay('${it.itemNum}','${(it.roadName||'').replace(/'/g,"&apos;")}')" style="padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #e67e22;background:var(--bg-card);background:color-mix(in srgb, rgb(230,126,34) 10%, var(--bg-card));color:#e67e22;font-family:var(--font-body);font-size:0.82rem;cursor:pointer;font-weight:600">Find on eBay</button>
    <button onclick="wantSearchOtherSites('${it.itemNum}','${(it.roadName||'').replace(/'/g,"&apos;")}')" style="padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #2980b9;background:var(--bg-card);background:color-mix(in srgb, rgb(41,128,185) 10%, var(--bg-card));color:#2980b9;font-family:var(--font-body);font-size:0.82rem;cursor:pointer;font-weight:600">Search Other Sites</button>
    <button id="detail-add-collection" onclick="moveWantToCollection('${it.itemNum}','${(it.variation||'').replace(/'/g,"&apos;")}')" style="padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #2ecc71;background:var(--bg-card);background:color-mix(in srgb, rgb(46,204,113) 10%, var(--bg-card));color:#2ecc71;font-family:var(--font-body);font-size:0.82rem;cursor:pointer;font-weight:600">+ Add to Collection</button>
  </div>`;
  } else {
  html += `
  <div class="rr-detail-actions" style="display:flex;gap:0.5rem;margin-bottom:1.5rem;flex-wrap:wrap">
    <button onclick="showItemDetailPage_edit(${idx})" data-ctip="Edit this item's details and add photos all in one place." style="padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #2980b9;background:var(--bg-card);background:color-mix(in srgb, rgb(41,128,185) 10%, var(--bg-card));color:#2980b9;font-family:var(--font-body);font-size:0.82rem;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:0.4rem">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      Update Info/Pictures
    </button>
    <button id="detail-record-sale" onclick="collectionActionSold(${idx},'${it.itemNum}','${(it.variation||'').replace(/'/g,"&apos;")}',${pd && pd.row ? pd.row : 0},'${pd && pd.inventoryId ? pd.inventoryId : ''}')" data-ctip="Did you sell something? Record that here." style="padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #2ecc71;background:var(--bg-card);background:color-mix(in srgb, rgb(46,204,113) 10%, var(--bg-card));color:#2ecc71;font-family:var(--font-body);font-size:0.82rem;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:0.4rem">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
      Record Sale
    </button>
    ${isForSale
      ? `<button id="detail-remove-forsale" onclick="_removeForSaleFromDetail(${idx},'${_detailInvId}')" data-ctip="Remove this item from your For Sale list and keep it in your collection." style="padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #e67e22;background:var(--bg-card);background:color-mix(in srgb, rgb(230,126,34) 25%, var(--bg-card));color:#e67e22;font-family:var(--font-body);font-size:0.82rem;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:0.4rem">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
      Remove from For Sale
    </button>`
      : `<button id="detail-list-sale" onclick="collectionActionForSale(${idx},'${it.itemNum}','${(it.variation||'').replace(/'/g,"&apos;")}',${pd && pd.row ? pd.row : 0},'${pd && pd.inventoryId ? pd.inventoryId : ''}')" data-ctip="If you want to sell an item from your collection, you can list it for sale here." style="padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #e67e22;background:var(--bg-card);background:color-mix(in srgb, rgb(230,126,34) 10%, var(--bg-card));color:#e67e22;font-family:var(--font-body);font-size:0.82rem;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:0.4rem">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
      List for Sale
    </button>`}
    <button onclick="showAddToUpgradeModal('${it.itemNum}','${(it.variation||'').replace(/'/g,"&apos;")}',${pd && pd.row ? pd.row : 0},'${pd && pd.inventoryId ? pd.inventoryId : ''}')" style="padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #8b5cf6;background:var(--bg-card);background:color-mix(in srgb, rgb(139,92,246) 10%, var(--bg-card));color:#8b5cf6;font-family:var(--font-body);font-size:0.82rem;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:0.4rem">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
      Add to Upgrade List
    </button>
    ${(pd && pd.groupId) ? `<button onclick="_breakUpGroupFromDetail(${idx},'${it.itemNum}','${(it.variation||'').replace(/'/g,"&apos;")}')" data-ctip="Unlink the pieces in this group — they all stay in your collection." style="padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid var(--accent2);background:var(--bg-card);background:color-mix(in srgb, rgb(201,146,42) 10%, var(--bg-card));color:var(--accent2);font-family:var(--font-body);font-size:0.82rem;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:0.4rem">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      Break Up Group
    </button>` : ''}
    <button id="detail-share-item" onclick="shareSingleItem(${idx},'${pd && pd.inventoryId ? pd.inventoryId : ''}')" data-ctip="Share this item as a PDF — photos, condition and details — by email or text." style="padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #2ecc71;background:var(--bg-card);background:color-mix(in srgb, rgb(46,204,113) 10%, var(--bg-card));color:#2ecc71;font-family:var(--font-body);font-size:0.82rem;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:0.4rem">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
      Share
    </button>
    <button id="detail-remove-item" onclick="_removeFromCollectionDetail(${idx},'${it.itemNum}','${(it.variation||'').replace(/'/g,"&apos;")}')" data-ctip="Remove this item from your collection." style="padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #e74c3c;background:var(--bg-card);background:color-mix(in srgb, rgb(231,76,60) 10%, var(--bg-card));color:#e74c3c;font-family:var(--font-body);font-size:0.82rem;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:0.4rem">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      Remove from Collection
    </button>
  </div>`;
  }

  // ── GROUP MEMBERS STRIP (v0.9.728 — Brad's one-sheet-per-group) ──
  if (_isGroupSheet) {
    html += '<div style="background:var(--surface);border:1.5px solid var(--accent3,#2ecc71);border-radius:14px;padding:1rem 1.25rem;margin-bottom:1.5rem">'
      + '<div style="font-family:var(--font-head);font-size:0.72rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--accent3,#2ecc71);margin-bottom:0.7rem">🔗 '
      + (function () {
          var _lead = _grpUnits[0] ? String(_grpUnits[0].itemNum || '') : '';
          var _base = _lead.replace(/-(P|D)$/i, '');
          if (_grpCfg === 'Engine + Tender') return _base + ' Engine + Tender';
          if (_grpCfg && _grpCfg !== 'Set') return _base + ' ' + _grpCfg + ' Set';
          return 'Grouped Set';
        })()
      + ' · ' + _grpFull.length + ' pieces</div>'
      + '<div style="display:flex;gap:0.6rem;flex-wrap:wrap">'
      + _grpFull.map(function (p, i) {
          var role = _grpRole(p);
          var me = pd && p === pd;
          var cond = p.condition ? p.condition + '/10' : '—';
          var box = /-(BOX|MBOX)$/i.test(String(p.itemNum||'')) ? '' : (p.hasBox === 'Yes' ? ('Box ✓' + (p.boxCond ? ' (' + p.boxCond + ')' : '')) : 'No box');
          var worth = p.userEstWorth ? _currencySymbol() + parseFloat(p.userEstWorth).toLocaleString() : '';
          return '<div onclick="if(typeof _grpHeroSwap===\'function\')_grpHeroSwap(' + i + ')" title="Show this unit\'s photo above" style="cursor:pointer;flex:1;min-width:150px;max-width:230px;background:var(--surface2);border:1px solid ' + (me ? 'var(--accent3,#2ecc71)' : 'var(--border)') + ';border-radius:10px;padding:0.6rem 0.75rem">'
            + '<div style="font-size:0.64rem;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:var(--accent3,#2ecc71)">' + role + (me ? ' · this page' : '') + '</div>'
            + '<div style="font-family:var(--font-mono);font-weight:700;color:var(--accent);font-size:0.95rem;margin:0.15rem 0">' + String(p.itemNum || '').replace(/</g, '&lt;') + (p.photoItem ? ' <span title="Has photos" style="font-size:0.78rem">📷</span>' : '') + '</div>'
            + '<div style="font-size:0.74rem;color:var(--text-mid);line-height:1.5">Cond ' + cond + (box ? ' · ' + box : '') + (worth ? '<br>Worth ' + worth : '') + '</div>'
            // v0.9.1569 (audit step 5): Remove sits beside Edit/Photos — the
            // ONLY place a single piece leaves the group. Confirms per piece.
            + '<div style="display:flex;gap:0.35rem;margin-top:0.45rem">'
            + '<button onclick="event.stopPropagation();_grpEditMember(' + i + ')" style="flex:1;padding:0.3rem;border-radius:7px;border:1px solid #2980b9;background:var(--bg-card);background:color-mix(in srgb, rgb(41,128,185) 8%, var(--bg-card));color:#2980b9;font-size:0.7rem;cursor:pointer;font-family:var(--font-body);font-weight:600">Edit / Photos</button>'
            + '<button onclick="event.stopPropagation();_grpRemoveMember(' + idx + ',' + i + ')" title="Remove this piece only — the rest of the group stays" style="padding:0.3rem 0.5rem;border-radius:7px;border:1px solid var(--border);background:var(--surface2);color:#f05008;font-size:0.7rem;cursor:pointer;font-family:var(--font-body)">Remove</button>'
            + '</div>'
            + '</div>';
        }).join('')
      + '</div></div>';
  }

  // ── DETAILS GRID ──
  // v0.9.1571 (Brad: "need to be able to edit the detail sheet and be able
  // to add the different columns or take them away"): every field now
  // carries a STABLE id (rule 4 \u2014 never a label, labels get reworded and
  // custom columns get renamed), so the picker's saved choice survives.
  let details = [
    { id: 'condition', label: 'Condition', val: cond ? `<span class="condition-pip ${condClass}"></span> ${cond}/10` : null },
    { id: 'allOriginal', label: 'All Original', val: pd && pd.allOriginal && pd.allOriginal !== 'Unknown' ? pd.allOriginal : null },
    { id: 'notOriginal', label: 'Not Original', val: pd && pd.notOriginalDesc ? pd.notOriginalDesc : null },
    { id: 'hasBox', label: 'Has Box', val: pd ? (pd.hasBox === 'Yes' ? '\u2705 Yes' + (pd.boxCond ? ` (${pd.boxCond}/10)` : '') : pd.hasBox === 'No' ? 'No' : null) : null },
    { id: 'pricePaidItem', label: 'Price Paid (Item)', val: pd && pd.priceItem ? _currencySymbol() + parseFloat(pd.priceItem).toLocaleString() : null },
    { id: 'pricePaidBox', label: 'Price Paid (Box)', val: pd && pd.priceBox ? _currencySymbol() + parseFloat(pd.priceBox).toLocaleString() : null },
    { id: 'pricePaidComplete', label: 'Price Paid (Complete)', val: (pd && pd.priceComplete && (parseFloat(pd.priceComplete) || 0) !== (parseFloat(pd.priceItem) || 0)) ? _currencySymbol() + parseFloat(pd.priceComplete).toLocaleString() : null },
    { id: 'estWorth', label: 'Est. Worth', val: (function(){ var _v = pd && pd.userEstWorth ? parseFloat(pd.userEstWorth) : NaN; return isFinite(_v) ? _currencySymbol() + _v.toLocaleString() : null; })() },
    { id: 'marketVal', label: 'Market Value', val: it.marketVal && !isNaN(parseFloat(it.marketVal)) ? _currencySymbol() + parseFloat(it.marketVal).toLocaleString() : null },
    { id: 'datePurchased', label: 'Date Purchased', val: pd && pd.datePurchased ? _formatDate(pd.datePurchased) : null },
    // v0.9.782: seller link — resolves the Contact ID to a name (kicks a lazy
    // contacts load the first time so the NEXT open shows the name).
    { id: 'boughtFrom', label: 'Bought From', val: (function () {
        if (!pd || !pd.purchasedFrom) return null;
        var _ct = (state.contactsData || []).find(function (x) { return x.id === pd.purchasedFrom; });
        if (!_ct && typeof window._ctLoadContacts === 'function' && !(state.contactsData || []).length) { try { window._ctLoadContacts(); } catch (e) {} }
        return _ct ? (_ct.name + (_ct.business ? ' — ' + _ct.business : '')) : 'a saved contact';
      })() },
    // v0.9.1506 (Session 81, Task #25): the import's testimony fields. Blank
    // for anything not imported, so non-importers see zero change (the
    // .filter(d => d.val) below drops empty rows).
    { id: 'yourGrade', label: 'Your Grade', val: pd && pd.yourGrade ? pd.yourGrade : null },
    { id: 'yourDescription', label: 'Your Description', val: pd && pd.yourDescription ? String(pd.yourDescription).replace(/</g,'&lt;') : null },
    { id: 'imported', label: 'Imported', val: pd && pd.importBatch ? '\u2705 Yes' : null },
    { id: 'yearMade', label: 'Year Made', val: pd && pd.yearMade ? pd.yearMade : null },
    { id: 'location', label: 'Location', val: pd && pd.location ? pd.location : null },
    // v0.9.1514 (Phase 2): every enabled user field, in one loop, from the
    // single RR_USER_FIELDS definition. Blank values are dropped by the
    // .filter(d => d.val) below, so a user who enables nothing sees nothing.
    ...((typeof rrEnabledUserFields === 'function' ? rrEnabledUserFields() : []).map(function (f) {
      return { id: 'uf_' + f.key,   // v0.9.1571: the KEY is stable; the label is Brad's to rename
               label: (typeof rrFieldLabel === 'function' ? rrFieldLabel(f) : f.label),
               val: (pd && pd[f.key]) ? String(pd[f.key]).replace(/</g, '&lt;') : null };
    })),
    { id: 'inventoryId', label: 'Inventory ID', val: pd && pd.inventoryId ? pd.inventoryId : null },
    { id: 'instructionSheet', label: 'Instruction Sheet', val: pd ? (((groupMembers && groupMembers.some(function(m){return m._isIS;})) || (state.isData && Object.values(state.isData).some(function(_is){ return _is && _is.linkedItem === it.itemNum; }))) ? '\u2705 Yes' : 'No') : null },
    { id: 'errorItem', label: 'Error Item', val: pd ? ((pd.isError === 'Yes') ? '\u26a0\ufe0f Yes' + (pd.errorDesc ? ' \u2014 ' + String(pd.errorDesc).replace(/</g,'&lt;') : '') : 'No') : null },
  ];
  // v0.9.1571: the picker reads the field list THIS page just built \u2014 one
  // source, so custom columns appear under the names Brad gave them. The
  // reopen hook lets the picker redraw this exact page after a save.
  window._rrDetailFieldDefs = details.map(function (d) { return { id: d.id, label: d.label }; });
  window._rrDetailReopen = function () { showItemDetailPage(idx, copyInvId); };
  var _dfCfg = (typeof _rrDetailFieldCfg === 'function') ? _rrDetailFieldCfg() : null;
  if (_dfCfg && !_wantMode) {
    // His saved choice wins: chosen fields, his order \u2014 and a chosen field
    // with nothing in it shows a dash (Brad's call, S84: gaps stay VISIBLE).
    var _dfById = {};
    details.forEach(function (d) { _dfById[d.id] = d; });
    details = _dfCfg.filter(function (fid) { return _dfById[fid]; }).map(function (fid) {
      var d = _dfById[fid];
      return { id: d.id, label: d.label, val: d.val || '<span style="color:var(--text-dim)">\u2014</span>' };
    });
  } else {
    // No saved choice = exactly the old card: blanks hidden.
    details = details.filter(d => d.val);
  }
  if (_wantMode) {
    var _wmPrice = _wantEntry ? (_wantEntry.expectedPrice || _wantEntry.maxPrice) : '';
    window._wantEditCur = _wantEntry || null;   // v0.9.1492: the edit overlay reads this
    details = [
      { label: 'Condition Target', val: _wantEntry && _wantEntry.targetCondition ? _wantEntry.targetCondition : null },
      { label: 'Priority', val: _wantEntry && _wantEntry.priority ? _wantEntry.priority : null },
      { label: 'Max Price', val: _wmPrice ? _currencySymbol() + parseFloat(_wmPrice).toLocaleString() : null },
    ].filter(function(d){ return d.val; });
  }

  const matchedTo = pd && pd.matchedTo ? pd.matchedTo : '';
  const setId = pd && pd.setId ? pd.setId : '';

  html += `<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:1.25rem;margin-bottom:1.5rem">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem">
      <div style="font-family:var(--font-head);font-size:0.72rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--accent2)">Details</div>
      ${_wantMode ? '' : '<a href="javascript:_rrDetailFieldsPicker()" style="font-size:0.75rem;color:var(--accent2);text-decoration:none">Edit fields</a>'}
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:0.6rem 1.5rem">
      ${details.map(d => `<div style="display:flex;justify-content:space-between;padding:0.35rem 0;border-bottom:1px solid var(--border)">
        <span style="font-size:0.78rem;color:var(--text-dim);font-weight:600">${d.label}</span>
        <span style="font-size:0.85rem;color:var(--text);text-align:right">${d.val}</span>
      </div>`).join('')}
    </div>
    ${_wantMode && _wantEntry ? `<div style="margin-top:0.6rem;text-align:right"><button onclick="_wantEditOpen()" style="padding:0.45rem 0.9rem;border-radius:8px;border:1.5px solid var(--accent2);background:none;color:var(--accent2);font-family:var(--font-body);font-size:0.8rem;font-weight:600;cursor:pointer">Edit want details</button></div>` : ''}`;

  // Matched / Set info
  if (matchedTo || setId || groupMembers.length) {
    html += `<div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border)">`;
    if (matchedTo) {
      const _mIcon = '';   // v0.9.1434 (Brad): train icons purged
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
      var _mtInv = (state.personalData[_mtPdKey] && state.personalData[_mtPdKey].inventoryId) || '';
      html += `<div style="font-size:0.85rem;color:var(--text-mid);margin-bottom:0.3rem">${_mIcon} Matched to: ${_mtClickable
        ? '<a href="javascript:void(0)" onclick="showItemDetailPage(' + _mtIdx + ", '" + _mtInv + "'" + ')" style="color:var(--accent);font-weight:700;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px;cursor:pointer">' + matchedTo + '</a>'
        : '<strong style="color:var(--accent)">' + matchedTo + '</strong>'}</div>`;
    }
    if (setId) {
      html += `<div style="font-size:0.85rem;color:var(--text-mid);margin-bottom:0.3rem">\ud83d\udd17 Set: <strong style="color:#a855f7">${setId}</strong></div>`;
    }
    if (groupMembers.length) {
      html += `<div style="font-size:0.78rem;color:var(--text-dim);margin-top:0.3rem">Grouped with: ${groupMembers.map(m => {
        // Grouped items are always in the collection — look up via personalData
        const _gPdKey = findPDKey(m.itemNum, m.variation);
        var _gInv = (state.personalData[_gPdKey] && state.personalData[_gPdKey].inventoryId) || '';
        if (_gPdKey) {
          // Check if also in masterData (positive index), otherwise use personal-only negative index
          let _gIdx = state.masterData.findIndex(md => md.itemNum === m.itemNum && (!m.variation || md.variation === m.variation));
          if (_gIdx < 0) {
            if (!window._poKeys) window._poKeys = [];
            let _poIdx = window._poKeys.indexOf(_gPdKey);
            if (_poIdx < 0) _poIdx = window._poKeys.push(_gPdKey) - 1;
            _gIdx = -(_poIdx + 1000);
          }
          return '<a href="javascript:void(0)" onclick="showItemDetailPage(' + _gIdx + ", '" + _gInv + "'" + ')" style="color:var(--accent);font-family:var(--font-mono);text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px;cursor:pointer">' + m.itemNum + '</a>';
        }
        return '<span style="color:var(--accent);font-family:var(--font-mono)">' + m.itemNum + '</span>';
      }).join(', ')}</div>`;
    }
    html += `</div>`;
  }

  // Notes
  var _wmNotes = (_wantMode && _wantEntry && _wantEntry.notes) ? (typeof _wlStripGrp === 'function' ? _wlStripGrp(_wantEntry.notes) : _wantEntry.notes) : '';
  if ((pd && pd.notes) || _wmNotes) {
    html += `<div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border)">
      <div style="font-size:0.78rem;color:var(--text-dim);font-weight:600;margin-bottom:0.3rem">Notes</div>
      <div style="font-size:0.85rem;color:var(--text);line-height:1.6;white-space:pre-wrap;word-break:break-word">${pd && pd.notes ? pd.notes : _wmNotes}</div>
    </div>`;
  }

  html += `</div>`;

  // ── PHOTO GALLERY ──
  // v0.9.728: group sheets show EVERY member's photos, labeled by piece.
  const _grpPhotoMembers = _isGroupSheet ? _grpFull.filter(function (p) { return p.photoItem; }) : [];
  const _photoLink = pd && pd.photoItem ? pd.photoItem : '';
  // v0.9.1009 (Brad): held in its own variable so it can be placed in the
  // desktop side column instead of appended to the bottom of the page.
  var _photoCard = '';
  if (!_wantMode) _photoCard = `<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:1.25rem">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem">
      <div style="font-family:var(--font-head);font-size:0.72rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--accent2)">Photos</div>
      ${_photoLink ? `<a href="${_photoLink}" target="_blank" rel="noopener" style="font-size:0.75rem;color:var(--accent2);text-decoration:none">Open Drive Folder \u2197</a>` : ''}
    </div>
    ${_grpPhotoMembers.length
      ? '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:0 1.25rem;align-items:start">'
        + _grpPhotoMembers.map(function (p, gi) {
          // v0.9.936 (Brad): each unit is its own column so paired units sit
          // BESIDE each other on wide screens instead of stacking.
          return '<div>'
            + '<div style="font-size:0.7rem;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:var(--accent3,#2ecc71);margin:0.6rem 0 0.4rem">' + _grpRole(p) + ' — ' + String(p.itemNum||'').replace(/</g,'&lt;') + ' <a href="' + p.photoItem + '" target="_blank" rel="noopener" style="font-weight:400;text-transform:none;color:var(--accent2);text-decoration:none;letter-spacing:0">folder \u2197</a></div>'
            + '<div id="grp-photos-' + gi + '" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:0.75rem;min-height:40px"><div style="grid-column:1/-1;color:var(--text-dim);font-size:0.78rem">Loading…</div></div>'
            + '</div>';
        }).join('')
        + '</div>'
      : `<div id="item-detail-photos" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:0.75rem;min-height:80px">
      ${_photoLink ? '<div style="grid-column:1/-1;text-align:center;padding:1rem;color:var(--text-dim);font-size:0.82rem"><div class="spinner" style="margin:0 auto 0.5rem;width:20px;height:20px;border-width:2px"></div>Loading photos...</div>' : '<div style="grid-column:1/-1;text-align:center;padding:2rem 1rem;color:var(--text-dim)"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3" style="margin:0 auto 0.5rem;display:block"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg><div style="font-size:0.85rem;margin-bottom:0.5rem">No photos uploaded yet</div><button onclick="showItemDetailPage_photos(' + idx + ')" style="padding:0.4rem 0.8rem;border-radius:7px;border:1.5px solid var(--gold);background:var(--bg-card);background:color-mix(in srgb, rgb(212,168,67) 8%, var(--bg-card));color:var(--gold);font-family:var(--font-body);font-size:0.78rem;cursor:pointer;font-weight:600">Add Photos</button></div>'}
    </div>`}
  </div>`;

  // ── Desktop: photos beside the DESCRIPTION only (v0.9.1010, Brad) ──
  // From 1000px up, the header/description and the photo card share a
  // two-column grid; the toolbar, details card and galleries run full width
  // BELOW the pair. The photo column takes all the space the text doesn't
  // use, so the picture finally fills the screen (Brad's red-outline ask).
  // Below 1000px nothing changes — the photo card sits at the bottom.
  //
  // Group sheets keep their per-member galleries at the bottom untouched;
  // they get a single side photo up top instead: the together/SET shot when
  // one can be found, else this unit's own RSV (loaded async below).
  var _wide = (window.innerWidth || 0) >= 1000;
  var _sideOK = !!_photoCard && !_grpPhotoMembers.length && _wide;
  var _grpSideOK = _wide && _grpPhotoMembers.length > 0 && !_wantMode;
  if (_sideOK) {
    container.innerHTML = '<div class="rr-detail-wrap"><div class="rr-detail-main">' + _headHtml + '</div>'
      + '<aside class="rr-detail-side">' + _photoCard + '</aside></div>' + html;
  } else if (_grpSideOK) {
    var _grpSideCard = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:1.25rem">'
      + '<div style="font-family:var(--font-head);font-size:0.72rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--accent2);margin-bottom:0.75rem">Photo</div>'
      + '<div id="grp-side-photo" style="min-height:60px"><div style="text-align:center;padding:1rem;color:var(--text-dim);font-size:0.82rem"><div class="spinner" style="margin:0 auto 0.5rem;width:20px;height:20px;border-width:2px"></div>Loading photo...</div></div>'
      + '</div>';
    container.innerHTML = '<div class="rr-detail-wrap"><div class="rr-detail-main">' + _headHtml + '</div>'
      + '<aside class="rr-detail-side">' + _grpSideCard + '</aside></div>' + html + _photoCard;
  } else if (_isPhoneDetail && _photoCard) {
    // v0.9.1020 (Brad): phones see the PHOTO right under the title, then the
    // description/variation text, then buttons + details. (Group sheets keep
    // their per-member galleries at the bottom — _photoCard holds them, so
    // this places the galleries up top for groups too, which is what a phone
    // user wants: pictures first.)
    container.innerHTML = _headHtml + _photoCard
      + '<div style="margin:0.9rem 0 1.25rem">' + _descBlock + '</div>' + html;
  } else {
    container.innerHTML = _headHtml + html + _photoCard;
  }

  // v0.9.1566 (Brad: "these three boxes should be clickable and just change
  // the photo at the top") — clicking a member card swaps the hero to that
  // unit's Right Side View. No navigation, no edit; the Edit/Photos button
  // stops the bubble and keeps its old job. On phones there is no side hero
  // (#grp-side-photo absent) and the click quietly does nothing.
  window._grpHeroSwap = async function (gi) {
    try {
      var p = _grpFull && _grpFull[gi];
      var target = document.getElementById('grp-side-photo');
      if (!target) return;
      if (!p || !p.photoItem) { if (typeof showToast === 'function') showToast('No photos for that unit yet'); return; }
      var photos = await driveGetFolderPhotos(p.photoItem);
      if (!photos || !photos.length) { if (typeof showToast === 'function') showToast('No photos for that unit yet'); return; }
      var isRSV = function (x) { var n = String(x.name || '').toUpperCase(); return n.indexOf('RSV') !== -1 && n.indexOf('BOX') === -1; };
      var pick = photos.find(isRSV) || photos[0];
      _buildPhotoGallery(target, [pick], { folderLink: p.photoItem, canRename: true, stack: true });
    } catch (e) { console.warn('hero swap:', e); }
  };

  // Async: group side photo — prefer the together/SET shot (filed in the
  // lead unit's folder), fall back to THIS unit's RSV, then its first photo.
  if (_grpSideOK) {
    (async function () {
      var el = function () { return document.getElementById('grp-side-photo'); };
      function isSet(p) { return /\bSET\b/i.test(String(p.name || '')); }
      function isRSV(p) { var n = String(p.name || '').toUpperCase(); return n.indexOf('RSV') !== -1 && n.indexOf('BOX') === -1; }
      var pick = null, pickFolder = '';
      try {
        var lead = _grpPhotoMembers[0];
        var leadPhotos = lead && lead.photoItem ? await driveGetFolderPhotos(lead.photoItem) : null;
        if (leadPhotos && leadPhotos.length) {
          pick = leadPhotos.find(isSet) || null;
          if (pick) pickFolder = lead.photoItem;
        }
        if (!pick && pd && pd.photoItem) {
          var ownPhotos = (lead && pd.photoItem === lead.photoItem) ? leadPhotos : await driveGetFolderPhotos(pd.photoItem);
          if (ownPhotos && ownPhotos.length) {
            pick = ownPhotos.find(isRSV) || ownPhotos[0];
            pickFolder = pd.photoItem;
          }
        }
        if (!pick && leadPhotos && leadPhotos.length) {
          pick = leadPhotos.find(isRSV) || leadPhotos[0];
          pickFolder = lead.photoItem;
        }
      } catch (e) { console.warn('Group side photo load:', e); }
      var target = el();
      if (!target) return;
      if (pick) {
        _buildPhotoGallery(target, [pick], { folderLink: pickFolder, canRename: true, stack: true });
      } else {
        target.innerHTML = '<div style="text-align:center;padding:1rem;color:var(--text-dim);font-size:0.82rem">No photos yet — see the galleries below</div>';
      }
    })();
  }

  // Async: group-sheet photos — one loader per member (v0.9.728)
  if (_grpPhotoMembers.length) {
    _grpPhotoMembers.forEach(function (p, gi) {
      driveGetFolderPhotos(p.photoItem).then(function (photos) {
        var el = document.getElementById('grp-photos-' + gi);
        if (!el) return;
        if (!photos || !photos.length) { el.innerHTML = '<div style="grid-column:1/-1;color:var(--text-dim);font-size:0.78rem">No photos in this folder</div>'; return; }
        // v0.9.937 (Brad): hero + thumbnail-rail gallery per unit (rename via
        // the hero label, ✂ crops the photo shown large).
        // v0.9.1570 (Brad, S83: the wide set shot rendered as a "weird and
        // compacted" strip): stack the rail BELOW the hero — the 74px side
        // rail was stealing a third of an already-narrow member column, and
        // the member grid now shares the row's full width (auto-fit above).
        _buildPhotoGallery(el, photos, { folderLink: p.photoItem, canRename: true, arrange: true, stack: true });
      }).catch(function () {
        var el = document.getElementById('grp-photos-' + gi);
        if (el) el.innerHTML = '<div style="grid-column:1/-1;color:var(--text-dim);font-size:0.78rem">Could not load photos</div>';
      });
    });
  }

  // Async: load photos
  // v0.9.1192 (Brad: "none of the detail pages show the pics") — a blank
  // photo-link cell does NOT mean "no photos". The Photo Inbox files pictures
  // into the item's Drive folder and writes the link afterwards; when that
  // write failed the pictures were still there, and this page was the one
  // surface that could not reach them (PHOTO_LINK_REGRESSION.md).
  // The LIST has had this fallback since v0.9.1123 — whose comments asserted,
  // in two separate files, that THIS page "already" had it. It never did.
  // Find-only: never creates a folder, so a genuinely photoless item costs one
  // lookup and its empty state stays exactly as it was.
  if (!_grpPhotoMembers.length) {
    // v0.9.1197: the ONE photo resolver (drive.js rrPhotoFolderFor).
    var _detailLinkP = (typeof rrPhotoFolderFor === 'function')
      ? rrPhotoFolderFor(pd)
      : Promise.resolve(_photoLink || '');
    _detailLinkP.then(function (_lnk) {
    if (!_lnk) return;
    return driveGetFolderPhotos(_lnk).then(function(photos) {
      const el = document.getElementById('item-detail-photos');
      if (!el) return;
      if (!photos || photos.length === 0) {
        el.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem 1rem;color:var(--text-dim)"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3" style="margin:0 auto 0.5rem;display:block"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg><div style="font-size:0.85rem;margin-bottom:0.5rem">No photos in folder</div><button onclick="showItemDetailPage_photos(' + idx + ')" style="padding:0.4rem 0.8rem;border-radius:7px;border:1.5px solid var(--gold);background:var(--bg-card);background:color-mix(in srgb, rgb(212,168,67) 8%, var(--bg-card));color:var(--gold);font-family:var(--font-body);font-size:0.78rem;cursor:pointer;font-weight:600">Add Photos</button></div>';
        return;
      }
      // v0.9.937 (Brad): hero + thumbnail-rail gallery (RSV big, other views
      // as clickable thumbnails beside it; ✂ acts on the photo shown large).
      _buildPhotoGallery(el, photos, { folderLink: _lnk, canRename: false, arrange: true,
        stack: !!document.querySelector('.rr-detail-side') });   // v0.9.1009
    });
    }).catch(function(e) {
      console.warn('Photo gallery load:', e);
      const el = document.getElementById('item-detail-photos');
      if (el) el.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:1rem;color:var(--text-dim);font-size:0.82rem">Could not load photos</div>';
    });
  }
}

// Helper functions for item detail page action buttons
// Detail-page Remove: delegate to the shared removeCollectionItem (which
// handles the confirm prompt, grouped-item modal, sheet deletion, and
// For-Sale/Upgrade cleanup), then navigate back to the list if the item is
// actually gone (i.e. the user didn't cancel the confirm).
async function _removeFromCollectionDetail(idx, itemNum, variation) {
  variation = (variation === '&apos;' || variation == null) ? '' : variation;
  var pdKey = (typeof _detailPdKey === 'function') ? _detailPdKey({itemNum: itemNum, variation: variation}) : ((typeof findPDKey === 'function') ? findPDKey(itemNum, variation) : null);
  var pd = pdKey ? state.personalData[pdKey] : null;
  var row = pd ? pd.row : null;
  if (typeof removeCollectionItem === 'function') {
    await removeCollectionItem(itemNum, variation, row, pd ? pd.inventoryId : '');
  }
  // v0.9.839 (BUG-005, Brad's silent Remove): the state cleanup can land a
  // tick AFTER the await resolves — checking once raced it and lost, so the
  // page just sat there looking broken. Poll briefly; when the item is gone,
  // toast + leave the page. (Still owned after 2s = user cancelled the
  // confirm, or a multi-copy removal kept the item — stay put, no toast.)
  var gone = false;
  for (var _i = 0; _i < 10 && !gone; _i++) {
    gone = !Object.values(state.personalData || {}).some(function(p) {
      return p && p.owned && rrSameNum(p.itemNum, itemNum) && rrSameVar(p.variation, variation);   // v0.9.1204
    });
    if (!gone) await new Promise(function(r) { setTimeout(r, 200); });
  }
  if (gone) {
    if (typeof showToast === 'function') showToast('\u2713 Removed from your collection');
    if (typeof _detailBackToBrowse === 'function') _detailBackToBrowse();
    else if (typeof showPage === 'function') showPage('browse');
    try { if (typeof buildDashboard === 'function') buildDashboard(); } catch (e) {}
  }
}

// v0.9.837 (Brad): rotate/crop a photo from the item detail page. Fetches
// the full-size image as an authorized blob (avoids canvas tainting), opens
// the shared cropper (which now has Rotate), and on Apply REPLACES the Drive
// file in place via _cropReplaceDrivePhoto — no duplicates, thumbnail updates.
// ── v0.9.937 (Brad): hero + thumbnail-rail photo gallery ─────────────────
// RSV (first photo) shows natural-size as the hero; the other views are
// clickable thumbnails in a rail beside it (below it on phones). Clicking a
// thumbnail swaps it into the hero; ✂ crop and ✎ rename always act on the
// photo currently shown large. Swipe left/right on the hero (or focus it and
// use arrow keys) to flip through views. Used by BOTH the single-item detail
// page and each unit of a grouped item.
var _galSeq = 0;
function _buildPhotoGallery(el, photos, opts) {
  opts = opts || {};
  var galId = 'gal' + (++_galSeq);
  // v0.9.1009 (Brad): opts.stack forces hero-over-rail — the arrangement the
  // phone already uses — so the same gallery works in the narrow desktop
  // side column without a second code path.
  var narrow = !!opts.stack || (window.innerWidth || 0) < 700;
  var cur = 0;

  // v0.9.1293 (Brad, request #29): the detail page is THE surface for
  // arranging photos. Same shared logic as the edit panel's strip
  // (_rrSortGalleryPhotos / _rrGalCommitOrder / _rrGalCommitView) — drag a
  // thumbnail onto another to reorder, onto a view chip to assign the view.
  // Desktop only, like v0.9.1280; phones keep the tap gallery. And every
  // gallery now actually sorts Right-Side-first (or by the "NN· " order
  // stamps), instead of trusting Drive's alphabetical order to do it.
  _rrSortGalleryPhotos(photos);
  var arrange = !!opts.arrange && !window.IS_MOBILE_UA && photos.length > 1;
  var redraw = function () {
    if (!opts.folderLink) return;
    driveGetFolderPhotos(opts.folderLink).then(function (ph) {
      if (ph && ph.length) _buildPhotoGallery(el, ph, opts);
    });
  };

  el.innerHTML = '';
  el.style.cssText = 'display:flex;flex-direction:column;gap:0.5rem;min-height:40px';
  if (arrange) {
    el.appendChild(_rrViewChipRow(function (fid, key) { _rrGalCommitView(photos, fid, key, redraw); }));
  }
  // The hero + rail live in their own row so the chip row can sit above
  // them at full width.
  var galBody = document.createElement('div');
  galBody.style.cssText = 'display:flex;gap:0.6rem;align-items:flex-start;width:100%;'
    + (narrow ? 'flex-direction:column;' : '');
  el.appendChild(galBody);

  // Hero
  var heroWrap = document.createElement('div');
  heroWrap.style.cssText = 'flex:1;min-width:0;position:relative;' + (narrow ? 'width:100%;' : '');
  var heroLink = document.createElement('a');
  heroLink.target = '_blank'; heroLink.rel = 'noopener'; heroLink.tabIndex = 0;
  heroLink.style.cssText = 'display:block;border-radius:10px;overflow:hidden;background:var(--surface2);position:relative;outline-offset:2px';
  var heroImg = document.createElement('img');
  heroImg.id = galId + '-hero';
  heroImg.alt = 'Item photo';
  // v0.9.1293: never a drag source — a dragged <img> ghosts its URL, and a
  // URL dropped on a view chip is not a photo id.
  heroImg.draggable = false;
  heroImg.style.cssText = 'width:100%;height:auto;max-height:70vh;object-fit:contain;display:block';
  var heroLbl = document.createElement('div');
  heroLbl.style.cssText = 'position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.6));padding:0.35rem 0.55rem;'
    + (opts.canRename ? 'cursor:text;' : '');
  var heroLblTxt = document.createElement('div');
  heroLblTxt.style.cssText = 'font-size:0.68rem;color:#fff;font-family:var(--font-head);letter-spacing:0.05em;text-transform:uppercase';
  heroLbl.appendChild(heroLblTxt);
  heroLink.appendChild(heroImg); heroLink.appendChild(heroLbl);
  var editBtn = document.createElement('button');
  editBtn.title = 'Rotate / crop this photo';
  editBtn.textContent = '\u2702';
  editBtn.className = 'rr-tap';   // v0.9.1021: 44px tap target on phones
  editBtn.style.cssText = 'position:absolute;top:4px;right:4px;z-index:2;width:26px;height:26px;border-radius:6px;border:none;background:rgba(0,0,0,0.55);color:#fff;font-size:0.8rem;cursor:pointer;line-height:1';
  // v0.9.1499 (Brad): Delete and Send-back-to-Inbox on the big gallery --
  // the page he actually looks at had no delete, and a misfiled photo had
  // no road back to the inbox at all. Both act on the photo shown large.
  var delBtn = document.createElement('button');
  delBtn.title = 'Delete this photo (moves to Drive trash \u2014 recoverable)';
  delBtn.textContent = '\uD83D\uDDD1';
  delBtn.className = 'rr-tap';
  delBtn.style.cssText = 'position:absolute;top:4px;right:34px;z-index:2;width:26px;height:26px;border-radius:6px;border:none;background:rgba(0,0,0,0.55);color:#fff;font-size:0.8rem;cursor:pointer;line-height:1';
  var inboxBtn = document.createElement('button');
  inboxBtn.title = 'Send this photo back to the Photo Inbox to re-file it';
  inboxBtn.textContent = '\u21A9';
  inboxBtn.className = 'rr-tap';
  inboxBtn.style.cssText = 'position:absolute;top:4px;right:64px;z-index:2;width:26px;height:26px;border-radius:6px;border:none;background:rgba(0,0,0,0.55);color:#fff;font-size:0.85rem;cursor:pointer;line-height:1';
  heroWrap.appendChild(heroLink); heroWrap.appendChild(editBtn);
  heroWrap.appendChild(delBtn); heroWrap.appendChild(inboxBtn);
  galBody.appendChild(heroWrap);

  // Rail (only when there is more than one photo)
  var rail = null, thumbs = [];
  if (photos.length > 1) {
    rail = document.createElement('div');
    rail.style.cssText = narrow
      ? 'display:flex;flex-direction:row;gap:0.5rem;width:100%;overflow-x:auto;padding-bottom:2px'
      : 'display:flex;flex-direction:column;gap:0.5rem;width:74px;flex-shrink:0;max-height:70vh;overflow-y:auto';
    photos.forEach(function (p, i) {
      var t = document.createElement('div');
      t.title = (p.name || '').replace(/\.[^.]+$/, '')
        + (arrange ? ' — drag onto another photo to reorder, or drag it up to the labels to set its view' : '');
      t.style.cssText = 'position:relative;border-radius:7px;overflow:hidden;cursor:pointer;flex-shrink:0;'
        + 'width:74px;height:56px;background:var(--surface2);border:2px solid var(--border)';
      var ti = document.createElement('img');
      ti.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block';
      var tl = document.createElement('div');
      tl.style.cssText = 'position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.6);font-size:0.55rem;color:#fff;text-align:center;padding:1px 2px;font-family:var(--font-head);letter-spacing:0.04em;text-transform:uppercase;white-space:nowrap;overflow:hidden';
      // A photo with a view token wears the view's short name; anything else
      // keeps its last word (minus any "NN· " order stamp) as before.
      var _vKey = _rrViewOfName(p.name);
      var _vDef = _vKey && (typeof ITEM_VIEWS !== 'undefined' ? ITEM_VIEWS : []).find(function (v) { return v.key === _vKey; });
      tl.textContent = (_vDef && _vDef.abbr)
        || ((p.name || '').replace(/\.[^.]+$/, '').replace(/^\d{2}· /, '').split(' ').pop())
        || ('#' + (i + 1));
      t.appendChild(ti); t.appendChild(tl);
      t.onclick = function () { select(i); };
      if (arrange) {
        t.draggable = true;
        ti.draggable = false;   // the tile drags; a dragged <img> ghosts a URL instead
        t.ondragstart = function (e) {
          e.dataTransfer.setData('text/plain', p.id);
          e.dataTransfer.effectAllowed = 'move';
          t.style.opacity = '0.45';
        };
        t.ondragend = function () { t.style.opacity = ''; };
        t.ondragover = function (e) { e.preventDefault(); t.style.borderColor = _RR_GAL_BLUE; };
        t.ondragleave = function () { t.style.borderColor = (thumbs.indexOf(t) === cur) ? 'var(--accent)' : 'var(--border)'; };
        t.ondrop = function (e) {
          e.preventDefault(); e.stopPropagation();
          var fid = e.dataTransfer.getData('text/plain');
          if (!fid || fid === p.id) { select(i); return; }
          var ids = photos.map(function (x) { return x.id; });
          var from = ids.indexOf(fid), to = ids.indexOf(p.id);
          if (from < 0 || to < 0) return;
          ids.splice(to, 0, ids.splice(from, 1)[0]);
          _rrGalCommitOrder(photos, ids, redraw);
        };
      }
      rail.appendChild(t);
      thumbs.push(t);
      try { loadDriveThumb(p.id, ti, t, p.thumbnailLink || null, 'lo'); } catch (e) {}
    });
    galBody.appendChild(rail);
  }

  function heroSrcFor(p) {
    if (p.thumbnailLink) return p.thumbnailLink.replace(/=s\d+(-c)?$/, '=s1200');
    return '';
  }
  function select(i) {
    if (i < 0) i = photos.length - 1;
    if (i >= photos.length) i = 0;
    cur = i;
    var p = photos[cur];
    heroLink.href = p.view || '#';
    heroLblTxt.innerHTML = ((p.name || '').replace(/\.[^.]+$/, '').replace(/^\d{2}· /, '').replace(/</g, '&lt;')).toUpperCase()
      + (opts.canRename ? ' <span style="opacity:0.6">\u270e</span>' : '');
    heroImg.onerror = function () {
      heroImg.onerror = null;
      try { loadDriveThumb(p.id, heroImg, heroLink, null, 'hi'); } catch (e) {}
    };
    var src = heroSrcFor(p);
    if (src) heroImg.src = src;
    else { try { loadDriveThumb(p.id, heroImg, heroLink, null, 'hi'); } catch (e) {} }
    editBtn.onclick = function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      _detailPhotoEdit(p.id, p.name || '', opts.folderLink || '', heroImg.id);
    };
    delBtn.onclick = function (ev) {   // v0.9.1499
      ev.preventDefault(); ev.stopPropagation();
      if (typeof _deleteCollectionPhoto === 'function') _deleteCollectionPhoto(p.id, p.name || '', null);
    };
    inboxBtn.onclick = function (ev) {   // v0.9.1499
      ev.preventDefault(); ev.stopPropagation();
      _rrPhotoBackToInbox(p.id, p.name || '', opts.folderLink || '');
    };
    if (opts.canRename) {
      heroLbl.onclick = function (ev) {
        ev.preventDefault(); ev.stopPropagation();
        window._grpRenamePhoto(p.id, heroLblTxt);
      };
    }
    thumbs.forEach(function (t, ti2) {
      t.style.borderColor = (ti2 === cur) ? 'var(--accent)' : 'var(--border)';
      t.style.opacity = (ti2 === cur) ? '1' : '0.85';
    });
  }

  // Swipe on the hero (phones) + arrow keys when the hero is focused
  if (photos.length > 1) {
    var _tx = null;
    heroLink.addEventListener('touchstart', function (e) { _tx = e.touches && e.touches[0] ? e.touches[0].clientX : null; }, { passive: true });
    heroLink.addEventListener('touchend', function (e) {
      if (_tx === null) return;
      var dx = (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : _tx) - _tx;
      _tx = null;
      if (Math.abs(dx) > 40) { select(cur + (dx < 0 ? 1 : -1)); e.preventDefault(); }
    });
    heroLink.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); select(cur + 1); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); select(cur - 1); }
    });
  }

  select(0);
}
if (typeof window !== 'undefined') window._buildPhotoGallery = _buildPhotoGallery;

async function _detailPhotoEdit(fileId, fileName, folderLink, imgId) {
  if (typeof _openCropper !== 'function') return;
  if (window._offlineMode) { if (typeof showToast === 'function') showToast("You're offline — editing photos needs a connection", 3500, true); return; }
  var url = null;
  try {
    var r = await fetch('https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media', { headers: { Authorization: 'Bearer ' + accessToken } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    url = URL.createObjectURL(await r.blob());
  } catch (e) {
    console.warn('[detail photo edit]', e);
    if (typeof showToast === 'function') showToast('Could not open the photo — try again', 3500, true);
    return;
  }
  _openCropper(url, async function (blob) {
    try { URL.revokeObjectURL(url); } catch (e) {}
    // v0.9.1238: this function is HANDED the file id and used to discard it,
    // passing a folder and a name to be searched instead. The id is the answer.
    var ok = false;
    try {
      ok = fileId ? await _cropReplaceDriveFile(fileId, blob)
                  : await _cropReplaceDrivePhoto(folderLink, fileName, blob);
    } catch (e) { console.warn('[detail photo replace]', e); }
    if (ok) {
      if (typeof showToast === 'function') showToast('\u2713 Photo updated');
      var img = (imgId && document.getElementById(imgId)) || document.getElementById('idp-' + fileId) || document.getElementById('nip-' + fileId);
      if (img) img.src = URL.createObjectURL(blob);
    } else if (typeof showToast === 'function') {
      showToast('Could not save the edited photo — try again', 3500, true);
    }
  }, function () { try { URL.revokeObjectURL(url); } catch (e) {} });
}
if (typeof window !== 'undefined') window._detailPhotoEdit = _detailPhotoEdit;

// v0.9.1499 (Brad): a misfiled photo goes BACK to the Photo Inbox, where the
// fixed attach flow can re-file it onto the right copy. Just a Drive move --
// nothing deleted, nothing renamed, and the inbox picks it up as a fresh
// untagged photo on its next open.
async function _rrPhotoBackToInbox(fileId, fileName, folderLink) {
  if (!fileId) return;
  var label = String(fileName || 'photo').replace(/\.[^.]+$/, '');
  var ok = (typeof appConfirm === 'function')
    ? await appConfirm('Send "' + label + '" back to the Photo Inbox?\n\nIt leaves this item and shows up in the inbox, where you can re-file it onto the right copy.', { ok: 'Send back' })
    : confirm('Send "' + label + '" back to the Photo Inbox?');
  if (!ok) return;
  try {
    if (typeof window._pinInboxFolderId !== 'function') throw new Error('Inbox folder not available');
    var inboxFid = await window._pinInboxFolderId();
    var fromFid = (String(folderLink || '').match(/folders\/([a-zA-Z0-9_-]+)/) || [])[1] || '';
    if (!inboxFid || !fromFid) throw new Error('Missing folder');
    await driveMoveFileToFolder(fileId, fromFid, inboxFid);
    if (typeof showToast === 'function') showToast('\u2713 Photo sent back to the Photo Inbox');
    if (typeof window._lastDetailIdx === 'number' && typeof showItemDetailPage === 'function')
      setTimeout(function () { showItemDetailPage(window._lastDetailIdx, window._lastDetailCopyInv); }, 200);
  } catch (e) {
    console.warn('[back-to-inbox]', e);
    if (typeof showToast === 'function') showToast('Could not send the photo back \u2014 try again', 4000, true);
  }
}
if (typeof window !== 'undefined') window._rrPhotoBackToInbox = _rrPhotoBackToInbox;

// v0.9.695: repair a personalData row number that is missing or the fake
// 99999 placeholder (older manual/IS saves stamped it) by locating the row's
// inventoryId in the sheet. Without this, EVERY update on such an item fails
// with a Sheets "exceeds grid limits" 400 (Brad's abacus).
async function _healPdRow(pd) {
  if (!pd || (pd.row && pd.row !== 99999)) return pd;
  if (!pd.inventoryId || typeof sheetsGet !== 'function') return pd;
  var col = (typeof personalColLetter === 'function') ? personalColLetter('inventoryId') : null;
  if (!col) return pd;
  var res = await sheetsGet(state.personalSheetId, PERSONAL_TAB + '!' + col + '3:' + col);
  var vals = (res && res.values) || [];
  for (var i = 0; i < vals.length; i++) {
    if (String((vals[i] || [])[0] || '').trim() === String(pd.inventoryId).trim()) {
      pd.row = i + 3;   // data starts at row 3
      return pd;
    }
  }
  throw new Error('Could not locate this item\'s row in the sheet — reload the app and try again');
}
window._healPdRow = _healPdRow;

// v0.9.730 (Brad): rename a photo right from the group gallery so shared-
// folder pair shots can be marked "205-P RSV" vs "205-D RSV".
window._grpRenamePhoto = async function (fileId, labelEl) {
  try {
    var cur = (labelEl.textContent || '').replace(/\s*✎\s*$/, '').trim();
    var next = prompt('Rename this photo (e.g. "205-P RSV" or "205-D RSV"):', cur);
    if (!next || next.trim() === '' || next.trim() === cur) return;
    if (typeof driveRequest !== 'function') { showToast('Drive not available', 3000, true); return; }
    await driveRequest('PATCH', '/files/' + fileId, { name: next.trim() + '.jpg' });
    var inner = labelEl.querySelector('div') || labelEl;
    inner.innerHTML = next.trim().replace(/</g, '&lt;').toUpperCase() + ' <span style="opacity:0.6">✎</span>';
    showToast('✓ Photo renamed');
  } catch (e) { showToast(rrSaveError(e, 'the new photo name', { kept: false }), 3500, true); }
};

// v0.9.728: open a group member's edit/photos panel from the group sheet.
window._grpEditMember = function (i) {
  var k = (window._grpMemberKeys || [])[i];
  if (!k || !state.personalData[k]) return;
  var p = state.personalData[k];
  var idx = -1;
  if (String(p.era || '') !== 'Manual' && typeof findMaster === 'function') {
    var m = findMaster(p.itemNum, p.variation, p);
    idx = m ? _masterIdxOf(m) : -1;
  }
  window._lastDetailPdKey = k;
  showItemPanel(idx, k, 'edit');
};

// v0.9.1569 (audit step 5): per-piece removal lives HERE, on the member
// cards — the list-level dialog removes or breaks up the WHOLE set. Calls
// the shared remover with scope 'piece', which confirms just that piece.
// Afterwards: if the removed piece was the page being shown, go back to the
// list; otherwise redraw this detail page without the removed card.
window._grpRemoveMember = async function (idx, i) {
  var k = (window._grpMemberKeys || [])[i];
  var p = k ? state.personalData[k] : null;
  if (!p) return;
  var wasSelf = String(p.inventoryId || '') !== '' && String(p.inventoryId) === String(window._lastDetailCopyInv || '');
  await removeCollectionItem(p.itemNum, p.variation || '', p.row || 0, p.inventoryId || '', { scope: 'piece' });
  if (state.personalData[k]) return;   // cancelled or refused — nothing changed
  if (wasSelf && typeof _detailBackToBrowse === 'function') { _detailBackToBrowse(); return; }
  if (typeof showItemDetailPage === 'function') showItemDetailPage(idx, window._lastDetailCopyInv);
};

// ══ v0.9.1571 — EDIT THE DETAILS CARD (Brad: "need to be able to edit the
// detail sheet and be able to add the different columns or take them away,
// since now we have custom columns") ════════════════════════════════════
// Same pattern as the v1517 list column picker: tick to show, drag ☰ to
// reorder, Reset brings back the old card, choice saved per user. The field
// list comes from window._rrDetailFieldDefs — the list the page itself just
// built — so custom columns appear under the names Brad gave them, from ONE
// source. His decision (S84): a ticked field with nothing in it shows a
// dash, so gaps stay visible instead of vanishing.
var _RR_DETAIL_FIELDS_PREF = 'lv_detail_fields_v1';
function _rrDetailFieldCfg() {
  try {
    var raw = localStorage.getItem(_RR_DETAIL_FIELDS_PREF);
    if (!raw) return null;
    var arr = JSON.parse(raw);
    return (Array.isArray(arr) && arr.length) ? arr : null;
  } catch (e) { return null; }
}
function _rrDetailFieldsPicker() {
  var defs = window._rrDetailFieldDefs || [];
  if (!defs.length) return;
  var existing = document.getElementById('df-overlay');
  if (existing) existing.remove();
  var cfg = _rrDetailFieldCfg();
  var chosen = cfg || defs.map(function (d) { return d.id; });
  var known = {};
  defs.forEach(function (d) { known[d.id] = d; });
  var order = chosen.filter(function (id) { return known[id]; });
  defs.forEach(function (d) { if (order.indexOf(d.id) < 0) order.push(d.id); });

  var ov = document.createElement('div');
  ov.id = 'df-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9600;display:flex;align-items:center;justify-content:center;padding:1rem';
  var box = document.createElement('div');
  box.style.cssText = 'background:var(--surface);border:1px solid var(--border);border-radius:14px;max-width:460px;width:100%;max-height:88vh;overflow:auto;padding:1.1rem';
  box.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem">' +
    '<strong style="font-size:1.05rem;color:var(--text)">Choose your detail fields</strong>' +
    '<button onclick="document.getElementById(\'df-overlay\').remove()" style="background:none;border:none;color:var(--text-dim);font-size:1.4rem;cursor:pointer;line-height:1">&times;</button></div>' +
    '<div style="font-size:0.8rem;color:var(--text-dim);line-height:1.5;margin-bottom:0.7rem">' +
    'Tick what you want on the Details card. Drag the ☰ handle to reorder. A ticked field with nothing entered shows a dash, so you can see what’s missing.</div>' +
    '<div id="df-list"></div>' +
    '<div style="display:flex;gap:0.5rem;margin-top:0.9rem">' +
    '<button onclick="_rrDetailFieldsReset()" style="flex:1;padding:0.55rem;border-radius:9px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body);font-size:0.85rem;cursor:pointer">Reset to default</button>' +
    '<button onclick="_rrDetailFieldsApply()" style="flex:2;padding:0.55rem;border-radius:9px;border:none;background:var(--accent);color:var(--on-accent);font-family:var(--font-body);font-weight:700;font-size:0.9rem;cursor:pointer">Done</button></div>';
  ov.appendChild(box);
  ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
  document.body.appendChild(ov);

  var list = box.querySelector('#df-list');
  order.forEach(function (id) {
    var row = document.createElement('div');
    row.className = 'df-row';
    row.draggable = true;
    row.dataset.field = id;
    row.style.cssText = 'display:flex;align-items:center;gap:0.55rem;padding:0.5rem 0.2rem;border-bottom:1px solid var(--border);cursor:grab;background:var(--surface)';
    row.innerHTML = '<span style="color:var(--text-dim);font-size:0.95rem;cursor:grab">☰</span>' +
      '<input type="checkbox" ' + (chosen.indexOf(id) >= 0 ? 'checked' : '') +
      ' style="width:1.05rem;height:1.05rem;accent-color:var(--accent);cursor:pointer">' +
      '<span style="flex:1;font-size:0.88rem;color:var(--text)">' + String(known[id].label).replace(/</g, '&lt;') + '</span>';
    row.addEventListener('dragstart', function (e) {
      row.style.opacity = '0.45';
      try { e.dataTransfer.setData('text/plain', id); } catch (err) {}
      window._dfDrag = row;
    });
    row.addEventListener('dragend', function () { row.style.opacity = ''; window._dfDrag = null; });
    row.addEventListener('dragover', function (e) {
      e.preventDefault();
      var src = window._dfDrag;
      if (!src || src === row) return;
      var r = row.getBoundingClientRect();
      var before = (e.clientY - r.top) < r.height / 2;
      list.insertBefore(src, before ? row : row.nextSibling);
    });
    list.appendChild(row);
  });
}
function _rrDetailFieldsApply() {
  var list = document.getElementById('df-list');
  if (!list) return;
  var out = [];
  Array.prototype.forEach.call(list.querySelectorAll('.df-row'), function (r) {
    var cb = r.querySelector('input[type=checkbox]');
    if (cb && cb.checked) out.push(r.dataset.field);
  });
  try {
    if (out.length) localStorage.setItem(_RR_DETAIL_FIELDS_PREF, JSON.stringify(out));
    else localStorage.removeItem(_RR_DETAIL_FIELDS_PREF);   // nothing ticked = back to default
  } catch (e) {}
  var ov = document.getElementById('df-overlay');
  if (ov) ov.remove();
  if (typeof window._rrDetailReopen === 'function') window._rrDetailReopen();
  if (typeof showToast === 'function') showToast('Details card updated', 2000);
}
function _rrDetailFieldsReset() {
  try { localStorage.removeItem('lv_detail_fields_v1'); } catch (e) {}
  var ov = document.getElementById('df-overlay');
  if (ov) ov.remove();
  if (typeof window._rrDetailReopen === 'function') window._rrDetailReopen();
  if (typeof showToast === 'function') showToast('Details card reset', 2000);
}
if (typeof window !== 'undefined') {
  window._rrDetailFieldCfg = _rrDetailFieldCfg;
  window._rrDetailFieldsPicker = _rrDetailFieldsPicker;
  window._rrDetailFieldsApply = _rrDetailFieldsApply;
  window._rrDetailFieldsReset = _rrDetailFieldsReset;
}

// Resolve the personalData key for the copy the detail page is currently
// showing. Falls back to first match if the remembered key is stale.
function _detailPdKey(item) {
  // v0.9.983 (Stage B — wrong-copy guard): the detail page opened ONE specific
  // copy; resolve by its stable inventoryId first so edit / add-photos / sell /
  // remove can never target a DIFFERENT owned copy (duplicates, or a colliding
  // cross-era item number). _lastDetailCopyInv is reset on every detail open
  // (showItemDetailPage), so it's either the current copy's id or null — safe
  // to trust. Falls through to the old behavior when no copy id is known.
  var _inv = window._lastDetailCopyInv;
  if (_inv) {
    for (var _ik in state.personalData) {
      var _ip = state.personalData[_ik];
      if (_ip && _ip.owned && String(_ip.inventoryId) === String(_inv)) return _ik;
    }
  }
  var k = window._lastDetailPdKey;
  if (k && state.personalData[k] && item && state.personalData[k].itemNum === item.itemNum) return k;
  return findPDKey(item.itemNum, item.variation);
}
// v0.9.694 (Brad's abacus): personal-only items (manual entries, incl.
// no-number promo pieces) have NO master row — idx is negative and the old
// `if (!item) return;` silently killed EVERY toolbar button for them. The
// remembered _lastDetailPdKey identifies the copy; downstream functions
// already build pseudo-items from personalData when masterData[idx] misses.
function _detailPdKeyAny(idx) {
  const item = idx >= 0 ? state.masterData[idx] : null;
  if (item) return _detailPdKey(item);
  const k = window._lastDetailPdKey;
  if (k && state.personalData[k]) return k;
  // v0.9.847 (Brad's "Lenny the Lion" dead Add Photos): manual items opened
  // by inventory id (dashboard cards, seller links) can miss the _poKeys
  // registry, leaving _lastDetailPdKey null and every toolbar button dead.
  // The page ALWAYS knows which copy it shows — resolve by inventoryId,
  // the canonical reference for owned items.
  const inv = window._lastDetailCopyInv;
  if (inv) {
    const hit = Object.keys(state.personalData || {}).find(function (kk) {
      const p = state.personalData[kk];
      return p && p.owned && String(p.inventoryId) === String(inv);
    });
    if (hit) return hit;
  }
  return null;
}
function showItemDetailPage_edit(idx) {
  const pdKey = _detailPdKeyAny(idx);
  if (pdKey) updateCollectionItem(idx, pdKey);
  else showToast('Item not found in your collection', 3000, true);
}
function showItemDetailPage_photos(idx) {
  // v0.9.849 (Brad): button says "Add Photos" - go STRAIGHT to the photo
  // wizard (same path as the panel's own 📷 button), not the edit panel.
  const pdKey = _detailPdKeyAny(idx);
  if (!pdKey) { showToast('Item not found in your collection', 3000, true); return; }
  const pd = state.personalData[pdKey] || {};
  const item = idx >= 0 ? state.masterData[idx] : null;
  openPhotoWizard(pd.itemNum || (item && item.itemNum) || '',
                  pd.variation || (item && item.variation) || '', pdKey);
}
function showItemDetailPage_sell(idx) {
  const pdKey = _detailPdKeyAny(idx);
  if (pdKey) sellFromCollection(idx, pdKey);
}
function showItemDetailPage_forsale(idx) {
  const pdKey = _detailPdKeyAny(idx);
  if (pdKey) listForSaleFromCollection(idx, pdKey);
}




// ── BROWSE ROW CLICK — offer to add or view ─────────────────────
function openPhotoWizard(itemNum, variation, pdKey) {
  // Open wizard on the photo step for an existing item
  const pd = state.personalData[pdKey] || {};
  // v0.9.982 (colliding item numbers): resolve the catalog row from THIS owned
  // copy. findMaster's 3rd arg (the owned row, keyed by inventoryId) carries the
  // era/manufacturer that breaks ties like No. 115 (postwar Passenger Station vs
  // standard-gauge Ballast Car). Without it the "Adding No. X" banner and any
  // downstream catalog lookup grab whichever same-numbered row loaded first.
  var _matched = (pd && String(pd.era || '') !== 'Manual' && typeof findMaster === 'function')
    ? findMaster(itemNum, variation, pd) : null;
  wizard = {
    step: 0, tab: 'collection',
    data: { tab: 'collection', itemNum: itemNum, variation: variation,
            condition: pd.condition || '', allOriginal: pd.allOriginal || '',
            hasBox: pd.hasBox || '', _updatePdKey: pdKey, _photoOnly: true,
            _existingInventoryId: pd.inventoryId || '',   // v0.9.696: photos land in THIS copy's subfolder
            _era: pd.era || '' },                          // v0.9.982: item's real era, for catalog-match disambiguation
    steps: getSteps('collection'), matchedItem: _matched
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
      try { if (typeof rrThumbBust === 'function') rrThumbBust(state.personalData[_pfKey]); } catch (eTB) {}   // v0.9.1201
      rrVerifiedRowUpdate(state.personalSheetId, PERSONAL_TAB, state.personalData[_pfKey].row, PERSONAL_TAB + '!' + personalColLetter('photoItem') + state.personalData[_pfKey].row, [[freshLink]], { num: state.personalData[_pfKey].itemNum || '', invId: state.personalData[_pfKey].inventoryId || '' }, 'collection').catch(function(e) { console.warn('Photo link update:', e); });
    }
  } catch(e) { showToast((typeof rrSaveError === 'function') ? rrSaveError(e, 'the folder') : 'Could not open Drive folder: ' + e.message, 5000, true); }
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
  bindOverlayClose(overlay, function() { overlay.remove(); });
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
  // Phase 3: check if already listed for sale by THIS copy's inventoryId.
  const _alreadyForSale = !!(pd.inventoryId && state.forSaleData[pd.inventoryId]);
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
  if (window.BackStack && BackStack.wire) BackStack.wire(overlay); // v0.9.806 TODO-012: device Back closes this pop-up
}

// ── Collection list action helpers (resolve pdKey from itemNum/variation, then delegate) ──
// Owned menu for Science/Construction items (stored in dedicated tabs, not personalData)
function _showSpecialOwnedMenu(idx, item, ownedItems) {
  const existing = document.getElementById('owned-action-menu');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'owned-action-menu';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1.5rem';
  bindOverlayClose(overlay, function() { overlay.remove(); });
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
  if (window.BackStack && BackStack.wire) BackStack.wire(overlay); // v0.9.806 TODO-012: device Back closes this pop-up
}

function collectionActionForSale(globalIdx, itemNum, variation, pdRow, invId) {
  var pdKey = (invId && state.personalData[invId]) ? invId
    : (pdRow ? findPDKeyByRow(itemNum, variation, pdRow) : findPDKey(itemNum, variation));
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
  // Bug 15 (Session 154): include grouped instruction sheets so "sell as a
  // set" lists the IS too (it lives in the separate isData store).
  Object.entries(state.isData || {}).forEach(([k, _is]) => {
    if (_is && _is.groupId === pd.groupId) {
      siblings.push([k, { itemNum: _is.sheetNum || ((_is.linkedItem||'') + '-IS'), userEstWorth: _is.estValue || '', _isIS: true }]);
    }
  });
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
    + '<th style="text-align:left;padding:0.4rem 0.6rem;font-family:var(--font-head);font-size:0.68rem;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;color:var(--text-dim)">Item</th>'
    + (_hasPaid ? '<th style="text-align:right;padding:0.4rem 0.6rem;font-family:var(--font-head);font-size:0.68rem;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;color:var(--text-dim)">Paid</th>' : '')
    + (_hasWorth ? '<th style="text-align:right;padding:0.4rem 0.6rem;font-family:var(--font-head);font-size:0.68rem;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;color:var(--text-dim)">Est. Worth</th>' : '')
    + '</tr>'
    + _itemRows.map(r => '<tr style="border-top:1px solid var(--border)">'
      + '<td style="padding:0.4rem 0.6rem;font-family:var(--font-mono);font-weight:600;color:var(--accent)">' + r.num + '</td>'
      + (_hasPaid ? '<td style="text-align:right;padding:0.4rem 0.6rem;color:var(--text-mid)">' + (r.paid > 0 ? _currencySymbol() + r.paid.toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:2}) : '—') + '</td>' : '')
      + (_hasWorth ? '<td style="text-align:right;padding:0.4rem 0.6rem;color:var(--gold)">' + (r.worth > 0 ? _currencySymbol() + r.worth.toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:2}) : '—') + '</td>' : '')
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
        <button id="_grpfs-set" style="padding:0.8rem 1rem;border-radius:10px;border:2px solid #e67e22;background:#e67e22;color:#fff;font-family:var(--font-body);font-size:0.88rem;font-weight:600;cursor:pointer;text-align:left">
          Sell as a set<br>
          <span style="font-weight:400;font-size:0.78rem;color:var(--text-dim)">List all ${allItems.length} items together for one price</span>
        </button>
        <button id="_grpfs-indiv" style="padding:0.8rem 1rem;border-radius:10px;border:2px solid var(--accent);background:var(--bg-card);background:color-mix(in srgb, rgb(232,64,28) 8%, var(--bg-card));color:var(--accent);font-family:var(--font-body);font-size:0.88rem;font-weight:600;cursor:pointer;text-align:left">
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
  if (window.BackStack && BackStack.wire) BackStack.wire(overlay); // v0.9.806 TODO-012: device Back closes this pop-up

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
      // Session 154: list ONLY the lead row for the whole set (one price). The
      // box / instruction sheet stay in the collection, grouped — they do NOT
      // get their own For Sale rows. The For Sale list resolves the group via
      // the lead's Inventory ID and its actions cascade across every piece.
      // Phase 3: key for the For Sale entry is the lead pd's inventoryId.
      const _grpFsKey = pd.inventoryId || ('legacy-row-' + (pd.row || 0));   // v0.9.1196
      const fsRow = [
        pd.itemNum, pd.variation || '',
        pd.condition || '',
        askingPrice,
        today,
        'Set sale: ' + itemList,
        pd.priceItem || '',
        pd.userEstWorth || '',
        pd.inventoryId || '',
        pd.manufacturer || (typeof _brandOfItem === 'function' && _brandOfItem(pd.itemNum)) || _getEraManufacturer(),
      ];
      const existingFs = state.forSaleData[_grpFsKey];
      let _grpFsApRow = 0;   // v0.9.1196: real row from update target or append return
      if (existingFs && existingFs.row) {
        await rrVerifiedRowUpdate(sheetId, 'For Sale', existingFs.row, 'For Sale!A' + existingFs.row + ':J' + existingFs.row, [fsRow], { num: existingFs.itemNum || '', invId: existingFs.inventoryId || '' }, 'For Sale list');
        _grpFsApRow = existingFs.row;
      } else {
        _grpFsApRow = (await sheetsAppend(sheetId, 'For Sale!A:J', [fsRow])) || 0;
      }
      const _grpFsEntry = {
        row: _grpFsApRow,
        itemNum: pd.itemNum, variation: pd.variation || '',
        condition: pd.condition || '', askingPrice: askingPrice,
        dateListed: today,
        notes: fsRow[5], originalPrice: pd.priceItem || '',
        estWorth: pd.userEstWorth || '',
        inventoryId: pd.inventoryId || '',
      };
      state.forSaleData[_grpFsKey] = _grpFsEntry;
      overlay.remove();
      _cachePersonalData();
      buildForSalePage();
      if (typeof buildDashboard === 'function') buildDashboard();
      renderBrowse();
      showToast('✓ Set listed for sale for ' + _currencySymbol() + parseFloat(askingPrice).toLocaleString());
    } catch(e) {
      console.error('Group for sale error:', e);
      showToast((typeof rrSaveError === 'function') ? rrSaveError(e, 'this item') : '❌ Error: ' + e.message, 5000, true);
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'List all ' + allItems.length + ' items for sale'; }
    }
  };

  // ── SELL INDIVIDUALLY ──
  document.getElementById('_grpfs-indiv').onclick = () => {
    // Session 154: DON'T break the group now — that left a half-dismantled
    // group if the user cancelled at the price step. List the lead and defer
    // the ungroup until the For Sale row actually saves (cancel-safe).
    overlay.remove();
    listForSaleFromCollection(globalIdx, pdKey);
    if (typeof wizard !== 'undefined' && wizard.data) wizard.data._ungroupOnForSaleSave = pd.groupId;
  };
}

function collectionActionSold(globalIdx, itemNum, variation, pdRow, invId) {
  var pdKey = (invId && state.personalData[invId]) ? invId
    : (pdRow ? findPDKeyByRow(itemNum, variation, pdRow) : findPDKey(itemNum, variation));
  if (!pdKey) { showToast('Item not found in collection', 3000, true); return; }
  // Phase 3d: if the item is already on the For Sale list, route to the
  // simple "Record sale" price prompt (markForSaleAsSold) instead of the
  // full sell-from-collection wizard. The wizard is meant for items being
  // sold OUTSIDE the For Sale flow; once the user has listed it for sale,
  // the price + condition are already set and we just need the final price.
  var pd = state.personalData[pdKey] || {};
  var fsEntry = pd.inventoryId ? state.forSaleData[pd.inventoryId] : null;
  if (fsEntry && typeof markForSaleAsSold === 'function') {
    markForSaleAsSold(pd.inventoryId, fsEntry.askingPrice || '');
    return;
  }
  _checkSetBeforeAction(pdKey, globalIdx, function(saleIdx, saleKey){ sellFromCollection(saleIdx, saleKey); });
}

// Returns a friendly label for a group member based on its item-number suffix.
function _grpKind(num) {
  var u = String(num || '').toUpperCase();
  if (u.endsWith('-MBOX')) return 'master carton';
  if (u.endsWith('-BOX'))  return 'box';
  if (u.endsWith('-IS'))   return 'instruction sheet';
  return 'item';
}

// Session 154 v2 redesign (Brad): when selling a grouped item, show EVERY piece
// as a toggleable checkbox (including the lead item itself) so the user can sell
// any subset — e.g. just the box. Unchecked pieces are unlinked from the group
// and stay in the collection. The whole sale is recorded for ONE price.
// "Break up group" without selling now lives on the item detail page instead.
//   proceed(saleIdx, saleKey) opens the sell wizard anchored on the first checked
//   piece (which may be a companion box, not the lead).
function _checkSetBeforeAction(pdKey, leadIdx, proceed) {
  const pd = state.personalData[pdKey] || {};
  // Unified piece list: lead first, then companions (pd siblings + instruction sheets).
  var pieces = [{ key: pdKey, source: 'pd', num: pd.itemNum, kind: _grpKind(pd.itemNum), idx: leadIdx }];
  if (pd.groupId) {
    Object.entries(state.personalData).forEach(function(e){
      if (e[0] !== pdKey && e[1].groupId === pd.groupId && e[1].owned) {
        pieces.push({ key: e[0], source: 'pd', num: e[1].itemNum, kind: _grpKind(e[1].itemNum), idx: -1 });
      }
    });
    Object.entries(state.isData || {}).forEach(function(e){
      if (e[1] && e[1].groupId === pd.groupId) {
        pieces.push({ key: e[0], source: 'is', num: (e[1].sheetNum || ((e[1].linkedItem||'') + '-IS')), kind: 'instruction sheet', idx: -1 });
      }
    });
  }
  // Not a group (or only the lead) — go straight to the sell wizard.
  if (pieces.length <= 1) { proceed(leadIdx, pdKey); return; }

  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1.5rem';
  var rowsHtml = pieces.map(function(c, i){
    return '<label style="display:flex;align-items:center;gap:0.6rem;padding:0.55rem 0.6rem;border-radius:8px;background:var(--surface2);margin-bottom:0.4rem;cursor:pointer">'
      + '<input type="checkbox" id="_gsel_' + i + '" checked style="width:18px;height:18px;cursor:pointer">'
      + '<span style="font-family:var(--font-mono);font-weight:700;color:var(--accent)">' + c.num + '</span>'
      + '<span style="font-size:0.78rem;color:var(--text-dim)">' + c.kind + '</span></label>';
  }).join('');

  overlay.innerHTML = '<div style="background:var(--surface);border-radius:16px;padding:1.5rem;max-width:400px;width:100%;border:1px solid var(--border)">'
    + '<div style="font-family:var(--font-head);font-size:1rem;font-weight:700;margin-bottom:0.3rem">Sell from this group</div>'
    + '<div style="font-size:0.82rem;color:var(--text-mid);margin-bottom:0.9rem">Check the pieces you’re selling. They’re sold together for one price.</div>'
    + rowsHtml
    + '<div style="font-size:0.76rem;color:var(--accent2);background:rgba(201,146,42,0.1);border-radius:6px;padding:0.5rem 0.7rem;margin-top:0.2rem">Unchecked pieces are unlinked and stay in your collection.</div>'
    + '<div style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.9rem">'
    + '<button id="_gs-sell" style="padding:0.8rem 1rem;border-radius:10px;border:2px solid #2ecc71;background:var(--bg-card);background:color-mix(in srgb, rgb(46,204,113) 10%, var(--bg-card));color:#2ecc71;font-family:var(--font-body);font-size:0.9rem;font-weight:700;cursor:pointer;text-align:left">Continue to Sale →<br><span style="font-weight:400;font-size:0.76rem;color:var(--text-dim)">Sell the checked piece(s) for one price</span></button>'
    + '<button id="_gs-cancel" style="padding:0.6rem;border-radius:10px;border:1px solid var(--border);background:none;color:var(--text-dim);font-family:var(--font-body);font-size:0.85rem;cursor:pointer">Cancel</button>'
    + '</div></div>';
  document.body.appendChild(overlay);
  if (window.BackStack && BackStack.wire) BackStack.wire(overlay); // v0.9.806 TODO-012: device Back closes this pop-up

  function _updateSellBtn(){
    var any = false;
    for (var i = 0; i < pieces.length; i++){ var cb = document.getElementById('_gsel_' + i); if (cb && cb.checked) { any = true; break; } }
    var btn = document.getElementById('_gs-sell');
    btn.disabled = !any;
    btn.style.opacity = any ? '1' : '0.45';
    btn.style.cursor = any ? 'pointer' : 'not-allowed';
  }
  for (var i = 0; i < pieces.length; i++){ var cb = document.getElementById('_gsel_' + i); if (cb) cb.onchange = _updateSellBtn; }
  _updateSellBtn();

  document.getElementById('_gs-cancel').onclick = function(){ overlay.remove(); };

  document.getElementById('_gs-sell').onclick = function(){
    var checked = [], unchecked = [];
    pieces.forEach(function(c, i){
      var cb = document.getElementById('_gsel_' + i);
      (cb && cb.checked ? checked : unchecked).push(c);
    });
    if (!checked.length) return;
    // The sale must anchor on a real My Collection row (a 'pd' piece) since that
    // row is written to Sold and then removed. Selling only an instruction sheet
    // isn't supported.
    var primary = checked.find(function(c){ return c.source === 'pd'; });
    if (!primary) { showToast('Include the item or its box in the sale.', 3500, true); return; }
    var sellPd = [], sellIs = [], ungroupPd = [], ungroupIs = [];
    checked.forEach(function(c){
      if (c.key === primary.key) return;
      if (c.source === 'pd') sellPd.push(c.key); else sellIs.push(c.key);
    });
    unchecked.forEach(function(c){
      if (c.source === 'pd') ungroupPd.push(c.key); else ungroupIs.push(c.key);
    });
    window._pendingGroupSell = { sellPd: sellPd, sellIs: sellIs, ungroupPd: ungroupPd, ungroupIs: ungroupIs };
    overlay.remove();
    proceed(primary.idx >= 0 ? primary.idx : -1, primary.key);
  };
}

// Standalone "Break Up Group" — unlink every piece sharing this group and keep
// them ALL in the collection. For cases where the user is NOT selling (e.g.
// trashing a bad box, or noting a lost piece). Lives on the item detail page.
async function _breakUpGroup(pdKey) {
  var pd = state.personalData[pdKey];
  if (!pd || !pd.groupId) return;
  var gid = pd.groupId;
  var pdKeys = [pdKey];
  Object.entries(state.personalData).forEach(function(e){
    if (e[0] !== pdKey && e[1].groupId === gid) pdKeys.push(e[0]);
  });
  for (var i = 0; i < pdKeys.length; i++){
    var p = state.personalData[pdKeys[i]];
    // Session 85 (v0.9.1577, §238): the write's answer GATES the in-memory
    // clear. A refused write (row moved elsewhere) used to leave memory
    // saying "ungrouped" while the sheet still said grouped — divergence
    // until the next full sync. Placeholder rows (99999) keep the old
    // memory-only clear; their sheet row does not exist yet.
    if (p) {
      if (p.row && p.row !== 99999) {
        var _ok85 = false;
        try { _ok85 = await rrVerifiedRowUpdate(state.personalSheetId, PERSONAL_TAB, p.row, PERSONAL_TAB + '!' + personalColLetter('groupId') + p.row, [['']], { num: p.itemNum || '', invId: p.inventoryId || '' }, 'collection'); } catch(e){}
        if (_ok85) p.groupId = '';
      } else { p.groupId = ''; }
    }
  }
  var isKeys = [];
  Object.entries(state.isData || {}).forEach(function(e){ if (e[1] && e[1].groupId === gid) isKeys.push(e[0]); });
  for (var j = 0; j < isKeys.length; j++){
    var ip = state.isData[isKeys[j]];
    if (ip) {
      if (ip.row && ip.row !== 99999) {
        var _okIs85 = false;
        try { _okIs85 = await rrVerifiedRowUpdate(state.personalSheetId, 'Instruction Sheets', ip.row, 'Instruction Sheets!H' + ip.row, [['']], { num: ip.itemNum || '' }, 'Instruction Sheets list'); } catch(e){}
        if (_okIs85) ip.groupId = '';
      } else { ip.groupId = ''; }
    }
  }
  if (typeof _cachePersonalData === 'function') _cachePersonalData();
}

async function _breakUpGroupFromDetail(idx, itemNum, variation) {
  var pdKey = (typeof _detailPdKey === 'function') ? _detailPdKey({ itemNum: itemNum, variation: variation }) : ((typeof findPDKey === 'function') ? findPDKey(itemNum, variation) : null);
  if (!pdKey) { showToast('Item not found in collection', 3000, true); return; }
  var pd = state.personalData[pdKey] || {};
  if (!pd.groupId) { showToast('This item isn’t part of a group.', 3000); return; }
  var ok = (typeof appConfirm === 'function')
    ? await appConfirm('Break up this group? All pieces stay in your collection but will no longer be linked together.', { ok: 'Break Up' })
    : confirm('Break up this group? All pieces stay in your collection but will no longer be linked together.');
  if (!ok) return;
  await _breakUpGroup(pdKey);
  if (typeof renderBrowse === 'function') renderBrowse();
  if (typeof buildDashboard === 'function') buildDashboard();
  showToast('✓ Group broken up — all pieces kept in your collection');
  if (typeof showItemDetailPage === 'function') showItemDetailPage(idx, window._lastDetailCopyInv);
}

// Restored Session 154: shared collection-item removal used by the list
// Remove buttons and the detail-page Remove.
// v0.9.1569 (SETS AUDIT step 5, Brad's spec): a grouped item gets ONE honest
// confirm naming EVERY row that will go — no more "remove only this piece"
// at list level (that choice pair is how one click took his 2356 set).
// Per-piece removal lives on the detail page's member cards, which call this
// with opts.scope === 'piece'. The secondary choice is Break Up Group
// (Brad, S84: confirmed) — every piece stays, only the link goes.
async function removeCollectionItem(itemNum, variation, row, invId, opts) {
  // Check if this item is part of a group with other members
  // Use inventory id (preferred) or row to disambiguate if multiple copies exist
  var pdKey = (invId && state.personalData[invId]) ? invId : findPDKeyByRow(itemNum, variation, row);
  var thisPd = pdKey ? state.personalData[pdKey] : null;
  var groupId = thisPd && thisPd.groupId;
  var groupSiblings = groupId
    ? Object.values(state.personalData).filter(p => p.groupId === groupId && p.owned)
    : [];
  var isGrouped = groupSiblings.length > 1;

  if (isGrouped && opts && opts.scope === 'piece') {
    // Member-card removal: exactly one piece, said plainly.
    if (!(await appConfirm('Remove No. ' + itemNum + (variation ? ' (Var. ' + variation + ')' : '')
        + ' — one piece of this group?\n\nThe other ' + (groupSiblings.length - 1) + ' piece'
        + (groupSiblings.length - 1 === 1 ? ' stays' : 's stay') + ' in your collection, still grouped.',
        { danger: true, ok: 'Remove this piece' }))) return;
    // falls through to the single-item removal below
  } else if (isGrouped) {
    var groupLabels = groupSiblings.map(p => p.itemNum).join(' + ');
    var _gi = (typeof _grpFoldInfo === 'function') ? _grpFoldInfo(thisPd) : null;
    var _setName = _gi ? _gi.label : (groupSiblings.length + ' grouped items');
    var choice = await new Promise(function(resolve) {
      var overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9500;display:flex;align-items:center;justify-content:center;padding:1rem';
      overlay.innerHTML = `
        <div style="background:var(--surface);border:1.5px solid var(--border);border-radius:14px;padding:1.5rem;max-width:380px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,0.5)">
          <div style="font-size:0.72rem;font-weight:700;letter-spacing:0.1em;color:var(--accent);text-transform:uppercase;margin-bottom:0.5rem">Remove Set</div>
          <div style="font-size:0.9rem;color:var(--text);margin-bottom:0.2rem;line-height:1.5">
            This is one set — <strong>${_setName}</strong>:
          </div>
          <div style="font-family:var(--font-mono);font-size:0.85rem;color:var(--text);background:var(--surface2);border-radius:8px;padding:0.5rem 0.7rem;margin:0.4rem 0 0.6rem;line-height:1.6">${groupSiblings.map(p => '· ' + p.itemNum).join('<br>')}</div>
          <div style="font-size:0.85rem;color:var(--text-mid);margin-bottom:1.1rem;line-height:1.5">Removing it removes <strong>all ${groupSiblings.length} rows</strong> from your sheet. To remove a single piece, open the item and use its member card.</div>
          <div style="display:flex;flex-direction:column;gap:0.5rem">
            <!-- v0.9.1564's lesson, kept: the SAFE choice leads and looks
                 primary. v0.9.1569: the list level offers the whole set or
                 nothing — one honest confirm, no per-piece trap. -->
            <button id="rm-cancel" style="padding:0.55rem 1rem;border-radius:8px;border:2px solid var(--accent);background:var(--accent);color:var(--on-accent);font-family:var(--font-body);font-size:0.85rem;cursor:pointer;text-align:left;font-weight:700;line-height:1.4">
              Cancel — keep the set
            </button>
            <button id="rm-breakup" style="padding:0.55rem 1rem;border-radius:8px;border:1.5px solid var(--accent2);background:var(--bg-card);background:color-mix(in srgb, rgb(201,146,42) 10%, var(--bg-card));color:var(--accent2);font-family:var(--font-body);font-size:0.85rem;cursor:pointer;text-align:left;font-weight:600;line-height:1.4">
              Break Up Group — keep every piece, just unlink them
            </button>
            <button id="rm-all-group" style="padding:0.55rem 1rem;border-radius:8px;border:1.5px solid #e74c3c;background:var(--bg-card);background:color-mix(in srgb, rgb(231,76,60) 10%, var(--bg-card));color:#e74c3c;font-family:var(--font-body);font-size:0.85rem;cursor:pointer;text-align:left;font-weight:600;line-height:1.4">
              ⚠ Remove ALL ${groupSiblings.length} pieces (${groupLabels})
            </button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      if (window.BackStack && BackStack.wire) BackStack.wire(overlay); // v0.9.806 TODO-012: device Back closes this pop-up
      overlay.querySelector('#rm-cancel').onclick    = function() { document.body.removeChild(overlay); resolve('cancel'); };
      overlay.querySelector('#rm-breakup').onclick   = function() { document.body.removeChild(overlay); resolve('breakup'); };
      overlay.querySelector('#rm-all-group').onclick = function() { document.body.removeChild(overlay); resolve('all'); };
    });
    if (choice === 'cancel') return;

    if (choice === 'breakup') {
      // Brad, S84: the safe alternative — the pieces all stay, the link goes.
      await _breakUpGroup(pdKey);
      if (typeof renderBrowse === 'function') renderBrowse();
      if (typeof buildDashboard === 'function') buildDashboard();
      showToast('✓ Group broken up — all ' + groupSiblings.length + ' pieces kept in your collection');
      return;
    }

    if (choice === 'all') {
      // Remove every item in the group — delete from bottom to top to avoid row shift issues
      var sortedSibs = groupSiblings.slice().sort(function(a, b) { return (b.row || 0) - (a.row || 0); });
      var fsRowsToDelete = [];
      var _sibsRemoved = 0;   // v0.9.1267 (R3): count what actually went, not what we tried
      var _ugStuck = 0;       // v0.9.1288 (R3-3): Want-Upgrade rows that refused to clear
      for (var sib of sortedSibs) {
        var sibKey = sib.inventoryId || findPDKeyByRow(sib.itemNum, sib.variation, sib.row);
        if (sib.row && sib.row !== 99999) {
          try {
            // v0.9.1267 (R3): name the record we believe is on that row before
            // deleting it. If the sheet moved underneath us the delete is
            // refused and returns false — and then the row is STILL THERE, so
            // nothing below it moved and we must not renumber remembered rows,
            // must not drop this sibling from memory, and must not strip its
            // For Sale / Upgrade listings. Skip the rest of this sibling.
            var _sibGone = await sheetsDeleteRow(state.personalSheetId, PERSONAL_TAB, sib.row,
                                                 { itemNum: sib.itemNum, inventoryId: sib.inventoryId || '' });
            if (!_sibGone) continue;
            _adjustRowsAfterDelete(state.personalData, sib.row, PERSONAL_TAB);
          } catch(e) { console.warn('Remove group row error:', sib.itemNum, e); continue; }
        }
        // Phase 3: prefer sibling's inventoryId for For Sale + Upgrade cleanup.
        var sibInv = sib.inventoryId || '';
        var sibFsKey = sibInv && state.forSaleData[sibInv] ? sibInv : null;
        if (!sibFsKey && sibInv) {
          var _sf = Object.entries(state.forSaleData || {}).find(function(e){ return e[1] && e[1].inventoryId === sibInv; });
          if (_sf) sibFsKey = _sf[0];
        }
        var sibFs = sibFsKey ? state.forSaleData[sibFsKey] : null;
        if (sibFs && sibFs.row) {
          // v0.9.1267 (R3): carry the identity along with the row number. A row
          // number on its own is a position, and by the time this list is
          // drained the earlier deletes have moved things.
          fsRowsToDelete.push({ row: sibFs.row,
                                itemNum: sibFs.itemNum || sib.itemNum,
                                inventoryId: sibFs.inventoryId || sibInv || '' });
          delete state.forSaleData[sibFsKey];
        }
        // 2026-05-18: also clear Upgrade row for each sibling when removing the group.
        var sibUgKey = sibInv && state.upgradeData && state.upgradeData[sibInv] ? sibInv : null;
        if (!sibUgKey && sibInv) {
          var _su = Object.entries(state.upgradeData || {}).find(function(e){ return e[1] && e[1].inventoryId === sibInv; });
          if (_su) sibUgKey = _su[0];
        }
        var sibUg = sibUgKey ? state.upgradeData[sibUgKey] : null;
        if (sibUg && sibUg.row) {
          // v0.9.1288 (R3-3): this used to swallow the answer AND the exception,
          // then drop the entry locally regardless — so a Want-Upgrade row that
          // refused to clear stayed in the sheet while vanishing off the screen.
          // The collection removal itself is already done and stands; only this
          // secondary cleanup can still fail, so keep the entry when it does and
          // count it for the message below.
          var _ugGoneS = await rrRemoveRowConfirmed(state.personalSheetId, 'Want-Upgrade List', sibUg.row, 'Want-Upgrade List!A' + sibUg.row + ':I' + sibUg.row, [['','','','','','','','','']], { num: sibUg.itemNum || '', invId: sibUg.inventoryId || '' }, 'Want list');
          if (_ugGoneS) delete state.upgradeData[sibUgKey];
          else _ugStuck++;
        }
        if (sibKey) delete state.personalData[sibKey];
        _sibsRemoved++;
      }
      // Delete For Sale rows bottom-to-top
      fsRowsToDelete.sort(function(a, b) { return b.row - a.row; });
      for (var fsRow of fsRowsToDelete) {
        try {
          var _fsGone = await sheetsDeleteRow(state.personalSheetId, 'For Sale', fsRow.row,
                                              { itemNum: fsRow.itemNum, inventoryId: fsRow.inventoryId });
          if (_fsGone) _adjustRowsAfterDelete(state.forSaleData, fsRow.row, 'For Sale');
        } catch(e) { console.warn('FS cleanup:', e); }
      }
      // v0.9.1569 (audit step 5): a boxed SET's remove-all used to orphan its
      // My Sets wrapper record — the set was gone but still listed under My
      // Sets. Clean it up here, SET- groups only (GRP- engine groups have no
      // wrapper), through the confirmed-write helper — same shape
      // _removeOwnedSet uses, never a blind delete.
      if (/^SET-/i.test(String(groupId))) {
        try {
          var _msEnt = Object.entries(state.mySetsData || {}).find(function (e) { return e[1] && e[1].groupId === groupId; });
          if (_msEnt) {
            var _msKey = _msEnt[0], _msRec = _msEnt[1];
            var _msOk = true;
            if (_msRec.row && typeof _msRec.row === 'number' && _msRec.row >= 3 && _msRec.row < 1000000) {
              var _msBlanks = [Array(14).fill('')];
              _msOk = await rrRemoveRowConfirmed(state.personalSheetId, 'My Sets', _msRec.row,
                'My Sets!A' + _msRec.row + ':N' + _msRec.row, _msBlanks,
                { num: _msRec.setNum || _msRec.itemNum || '' }, 'sets list');
            }
            if (_msOk) delete state.mySetsData[_msKey];
          }
        } catch (eMs) { console.warn('My Sets wrapper cleanup:', eMs); }
      }
      _cachePersonalData();
      renderBrowse();
      buildDashboard();
      // v0.9.1267 (R3): report what was actually removed. If a row had moved,
      // sheetsDeleteRow already told the user to refresh — don't follow that
      // with a checkmark claiming everything went.
      if (_sibsRemoved > 0) showToast('✓ Removed ' + _sibsRemoved + ' grouped item' + (_sibsRemoved === 1 ? '' : 's')
        + (_ugStuck > 0 ? ' — but ' + _ugStuck + ' is still on your Want-Upgrade list. Refresh and try again.' : ''));
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
      // v0.9.1267 (R3): the identity of the copy we mean. inventoryId names ONE
      // copy — item number alone does not, and you can own three 2343s.
      var _delGone = await sheetsDeleteRow(state.personalSheetId, PERSONAL_TAB, _delRow,
                                           { itemNum: (thisPd && thisPd.itemNum) || itemNum,
                                             inventoryId: (thisPd && thisPd.inventoryId) || '' });
      // Refused: the row is not the record we meant, so it is still there and
      // nothing below it moved. The user has already been told to refresh.
      // Stop here rather than stripping the listings of an item we did not remove.
      if (!_delGone) return;
    } catch(e) { console.error('Remove row error:', e); showToast('Error removing item — please try again', 3000, true); return; }
  }
  // Phase 3: also remove from For Sale + Upgrade if listed — look up by THIS
  // copy's inventoryId so we don't strip another copy's listing.
  var _thisInv = thisPd ? thisPd.inventoryId : '';
  var fsKey = _thisInv && state.forSaleData[_thisInv] ? _thisInv : null;
  if (!fsKey && _thisInv) {
    var _fsEnt = Object.entries(state.forSaleData || {}).find(function(e){ return e[1] && e[1].inventoryId === _thisInv; });
    if (_fsEnt) fsKey = _fsEnt[0];
  }
  var fsEntry = fsKey ? state.forSaleData[fsKey] : null;
  if (fsEntry && fsEntry.row) {
    try {
      var _fsEntGone = await sheetsDeleteRow(state.personalSheetId, 'For Sale', fsEntry.row,
                                             { itemNum: fsEntry.itemNum || itemNum,
                                               inventoryId: fsEntry.inventoryId || _thisInv || '' });
      if (_fsEntGone) _adjustRowsAfterDelete(state.forSaleData, fsEntry.row, 'For Sale');
    } catch(e) { console.warn('For Sale cleanup:', e); }
    delete state.forSaleData[fsKey];
  }
  // 2026-05-18: also remove from Upgrade list if listed.
  var ugKey = _thisInv && state.upgradeData && state.upgradeData[_thisInv] ? _thisInv : null;
  if (!ugKey && _thisInv) {
    var _ugEnt = Object.entries(state.upgradeData || {}).find(function(e){ return e[1] && e[1].inventoryId === _thisInv; });
    if (_ugEnt) ugKey = _ugEnt[0];
  }
  var ugEntry = ugKey ? state.upgradeData[ugKey] : null;
  var _ugStuck1 = false;
  if (ugEntry && ugEntry.row) {
    // v0.9.1288 (R3-3): same as the group path above — wait for the answer and
    // keep the entry when the write is refused, so the screen keeps matching
    // the sheet instead of quietly disagreeing with it until the next reload.
    var _ugGone = await rrRemoveRowConfirmed(state.personalSheetId, 'Want-Upgrade List', ugEntry.row, 'Want-Upgrade List!A' + ugEntry.row + ':I' + ugEntry.row, [['','','','','','','','','']], { num: ugEntry.itemNum || '', invId: ugEntry.inventoryId || '' }, 'Want list');
    if (_ugGone) delete state.upgradeData[ugKey];
    else _ugStuck1 = true;
  }
  if (pdKey) delete state.personalData[pdKey];
  if (_delRow && _delRow !== 99999) _adjustRowsAfterDelete(state.personalData, _delRow, PERSONAL_TAB);
  _cachePersonalData();
  renderBrowse();
  buildDashboard();
  showToast('✓ Removed from collection'
    + (_ugStuck1 ? ' — but it is still on your Want-Upgrade list. Refresh and try again.' : ''));
}

// v0.9.1251 (row-identity audit, finding 7): a row number is only meaningful
// against ITS OWN TAB. Deleting My Collection row 13 does not move For Sale
// row 13 — but this function used to take any table and any number, so a
// caller could hand it a My Collection row and silently renumber every For
// Sale listing below it. rrRemoveSetGroup did exactly that, and cancelling a
// four-piece set entry was enough to corrupt the whole For Sale list.
//
// ONE READER for "which tab does this table's .row refer to". The tab is now
// required, and a mismatch is refused rather than applied — a wrong call
// becomes a console warning instead of silent corruption.
function _rowTabOf(dataObj) {
  if (!dataObj || typeof state === 'undefined') return '';
  if (dataObj === state.personalData) return (typeof PERSONAL_TAB !== 'undefined') ? PERSONAL_TAB : 'My Collection';
  if (dataObj === state.forSaleData)  return 'For Sale';
  if (dataObj === state.soldData)     return 'Sold';
  if (dataObj === state.wantData || dataObj === state.upgradeData) return 'Want-Upgrade List';
  return '';
}

function _adjustRowsAfterDelete(dataObj, deletedRow, fromTab) {
  if (!deletedRow || deletedRow === 99999) return;
  if (!dataObj) return;
  const owns = _rowTabOf(dataObj);
  if (fromTab && owns && fromTab !== owns) {
    console.warn('[rows] refusing to renumber "' + owns + '" from a "' + fromTab +
      '" deletion (row ' + deletedRow + '). A row number only means something ' +
      'against its own tab.');
    return;
  }
  if (!fromTab) {
    // Not fatal — every in-tree caller passes one — but say so, because an
    // un-named call is how the cross-tab bug got in.
    console.debug('[rows] _adjustRowsAfterDelete called without a tab for "' + (owns || 'unknown') + '"');
  }
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
    selectedSoldKey: pdKey,
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
  // Pre-fill from collection data and existing for-sale listing (Phase 3: by inventoryId)
  const existingFs = (pd.inventoryId && state.forSaleData[pd.inventoryId]) || {};
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
  bindOverlayClose(overlay, function() { overlay.remove(); });

  const box = document.createElement('div');
  box.className = 'rr-card rr-card-flex'; box.style.borderColor = 'rgba(230,126,34,0.4)';

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
  if (window.BackStack && BackStack.wire) BackStack.wire(overlay); // v0.9.806 TODO-012: device Back closes this pop-up

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
    var master = findMaster(pd.itemNum, (pd.variation||''), pd) || {};
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
    var master = findMaster(pd.itemNum, (pd.variation||''), pd) || {};
    // Phase 3: check by inventoryId of the specific copy
    var alreadyListed = !!(pd.inventoryId && state.forSaleData[pd.inventoryId]);
    var idx = _masterIdxOf(master);
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

// Delete a single collection photo. Moves the Drive file to TRASH (recoverable
// from Google Drive) rather than permanently deleting it, after a confirmation.
// ══ v0.9.1280 (Brad): "we should be able to reorder the pictures left to
// right by dragging them. if its an item, need to show the picture right
// left......etc views and be able to drag them into the right spot." ══════
//
// Two facts made this cheap: galleries list Drive files orderBy=name, and
// the wizard already writes view tags (RSV/LSV/FV/BKV/TV/BV) into names.
// So both gestures persist by RENAMING — no new storage, every device sees
// the same result, and the existing RSV-leads star rule keeps working.
//
//   ORDER: a drag stamps EVERY photo with an "NN· " prefix in its new
//   position. All-or-none by design — a folder where only some names carry
//   prefixes has no defined order, so the first drag defines it for all.
//   VIEW:  dropping a photo on a view chip strips that view's token from
//   whichever photo held it (one view, one photo) and writes it onto the
//   dropped one. BOX shots are exempt in both directions.
//
// Nothing here is destructive: the only Drive call is PATCH {name}.
var _RR_GAL_BLUE = '#2980b9';   // the want-list blue every gallery accent shares
function _rrViewOfName(name) {
  var n = ' ' + String(name || '').toUpperCase().replace(/\.[^.]+$/, '') + ' ';
  if (n.indexOf('BOX') >= 0) return '';          // a box shot is never an item view
  var keys = ['RSV', 'LSV', 'FV', 'BKV', 'TV', 'BV'];
  for (var i = 0; i < keys.length; i++) {
    if (n.indexOf(' ' + keys[i] + ' ') >= 0) return keys[i];
  }
  return '';
}
function _rrOrderOfName(name) {
  var m = String(name || '').match(/^(\d{2})· /);
  return m ? parseInt(m[1], 10) : null;
}
function _rrNameWithOrder(name, nn) {
  var rest = String(name || '').replace(/^\d{2}· /, '');
  if (nn === null || nn === undefined) return rest;
  var t = String(nn);
  return (t.length < 2 ? '0' + t : t) + '· ' + rest;
}
function _rrNameWithView(name, viewKey) {
  var extM = String(name || '').match(/\.[^.]+$/);
  var ext = extM ? extM[0] : '';
  var base = String(name || '').replace(/\.[^.]+$/, '');
  base = base.replace(/(^|\s)(RSV|LSV|FV|BKV|TV|BV)(?=\s|$)/g, ' ').replace(/\s{2,}/g, ' ').trim();
  return (viewKey ? (base + ' ' + viewKey) : base) + ext;
}

// ── v0.9.1293 (Brad, request #29): the SHARED gallery arranging logic. ────
// v0.9.1280 built drag-to-order and drag-onto-a-view for the edit panel's
// photo strip; Brad chose the item DETAIL PAGE as the surface it belongs on.
// Rather than a second copy, the sort, the two commit writers and the view
// chip row now live here, used by BOTH galleries — one implementation, so
// the two screens can never drift apart on how a rename is spelled.
//
// One sort for every gallery: an explicit "NN· " stamp wins; a folder
// nobody has dragged keeps the old Right-Side-leads priority. (The detail
// page's hero gallery used to claim RSV-first in a comment while actually
// showing whatever sorted first alphabetically — often the Back view.)
function _rrSortGalleryPhotos(photos) {
  var priority = function (name) {
    var n = (name || '').toUpperCase();
    if (n.includes('RSV')) return 0;
    if (n.includes('FV'))  return 1;
    if (n.includes('TV'))  return 2;
    if (n.includes('BV'))  return 3;
    return 9;
  };
  photos.sort(function (a, b) {
    var ao = _rrOrderOfName(a.name), bo = _rrOrderOfName(b.name);
    if (ao !== null || bo !== null) {
      if (ao === null) return 1;
      if (bo === null) return -1;
      return ao - bo;
    }
    return priority(a.name) - priority(b.name);
  });
  return photos;
}

// The two writers. Nothing here is destructive: the only Drive call either
// one makes is PATCH {name}. `redraw` re-fetches from Drive afterwards so
// the screen always shows what the renames actually produced.
async function _rrGalCommitOrder(photos, orderedIds, redraw) {
  var ok = 0, fail = 0;
  for (var i = 0; i < orderedIds.length; i++) {
    var p = photos.find(function (x) { return x.id === orderedIds[i]; });
    if (!p) continue;
    var want = _rrNameWithOrder(p.name, i + 1);
    if (want === p.name) { ok++; continue; }
    try {
      await driveRequest('PATCH', '/files/' + p.id + '?fields=id', { name: want });
      ok++;
    } catch (e) { fail++; console.warn('[gallery] reorder rename failed — continuing:', p.id, e); }
  }
  if (fail) showToast('Reordered ' + ok + ' of ' + orderedIds.length + ' photos — ' + fail + ' would not rename. Try again.', 4500, true);
  else showToast('✓ Photo order saved', 2000);
  redraw();
}
async function _rrGalCommitView(photos, fileId, viewKey, redraw) {
  var p = photos.find(function (x) { return x.id === fileId; });
  if (!p) return;
  if (/BOX/i.test(p.name)) { showToast('Box photos keep their BOX tag — views are for the item itself', 3500, true); return; }
  var renames = [];
  if (viewKey) {
    photos.forEach(function (q) {
      if (q.id !== fileId && _rrViewOfName(q.name) === viewKey) {
        renames.push({ id: q.id, name: _rrNameWithView(q.name, '') });   // the view moves over
      }
    });
  }
  var mine = _rrNameWithView(p.name, viewKey);
  if (mine !== p.name) renames.push({ id: p.id, name: mine });
  var ok = 0, fail = 0;
  for (var i = 0; i < renames.length; i++) {
    try {
      await driveRequest('PATCH', '/files/' + renames[i].id + '?fields=id', { name: renames[i].name });
      ok++;
    } catch (e) { fail++; console.warn('[gallery] view rename failed — continuing:', renames[i].id, e); }
  }
  if (fail) showToast('That view change only partly saved — check the labels and try again.', 4500, true);
  else if (viewKey) {
    var vDef = (typeof ITEM_VIEWS !== 'undefined' ? ITEM_VIEWS : []).find(function (v) { return v.key === viewKey; });
    showToast('✓ ' + ((vDef && vDef.label) || viewKey) + ' → this photo', 2500);
  } else showToast('✓ View tag removed', 2000);
  redraw();
}

// The view row — six drop targets plus one for "no view". onDrop receives
// (fileId, viewKey) and is expected to call _rrGalCommitView.
function _rrViewChipRow(onDrop) {
  var chipRow = document.createElement('div');
  chipRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.35rem;width:100%;margin-bottom:0.4rem';
  // v0.9.1570 (Brad, S83, on the chips: "what is going on here"): the row
  // only appears WHILE a photo is being dragged — the one moment it can do
  // anything — and leads with plain English saying what dropping does.
  // Hidden the rest of the time, so a page of stacked galleries (a group's
  // three units) no longer opens on three rows of unexplained pills.
  chipRow.style.display = 'none';
  var _chipLbl = document.createElement('span');
  _chipLbl.textContent = 'Drop the photo on a label to set its view:';
  _chipLbl.style.cssText = 'font-size:0.68rem;color:var(--text-mid);font-weight:600;align-self:center;margin-right:0.15rem';
  chipRow.appendChild(_chipLbl);
  // Drag events BUBBLE, so listening on the gallery container catches every
  // tile's dragstart/dragend — both consumers (the detail gallery and the
  // edit panel's strip) get the show/hide for free from this one function.
  setTimeout(function () {
    var host = chipRow.parentElement;
    if (!host) return;
    host.addEventListener('dragstart', function () { chipRow.style.display = 'flex'; });
    host.addEventListener('dragend', function () { chipRow.style.display = 'none'; });
  }, 0);
  var mkChip = function (key, label) {
    var c = document.createElement('div');
    c.textContent = label;
    c.title = 'Drag a photo here to make it the ' + label;
    c.style.cssText = 'font-size:0.66rem;font-weight:700;letter-spacing:0.04em;padding:0.28rem 0.55rem;'
      + 'border:1.5px dashed var(--border);border-radius:999px;color:var(--text-dim);background:var(--surface2);user-select:none';
    c.ondragover = function (e) { e.preventDefault(); c.style.borderColor = _RR_GAL_BLUE; c.style.color = _RR_GAL_BLUE; };
    c.ondragleave = function () { c.style.borderColor = ''; c.style.color = ''; };
    c.ondrop = function (e) {
      e.preventDefault();
      var fid = e.dataTransfer.getData('text/plain');
      if (fid) onDrop(fid, key);
    };
    return c;
  };
  (typeof ITEM_VIEWS !== 'undefined' ? ITEM_VIEWS : []).forEach(function (v) {
    chipRow.appendChild(mkChip(v.key, v.label));
  });
  chipRow.appendChild(mkChip('', 'plain photo'));
  return chipRow;
}

// The gallery, reloadable — a successful drag redraws from Drive so what is
// on screen is always what the renames actually produced.
window._rrDetailGallery = async function (tr2, folderLink) {
  const photos = await driveGetFolderPhotos(folderLink);
  if (photos === null) {
    tr2.innerHTML = '<span style="font-size:0.75rem;color:var(--text-dim)">Could not load photos — check Drive access</span>';
    return;
  }
  if (photos.length === 0) {
    tr2.innerHTML = '<span style="font-size:0.75rem;color:var(--text-dim);font-style:italic">No photos yet — tap Add Photos</span>';
    return;
  }

  _rrSortGalleryPhotos(photos);

  const redraw = function () { window._rrDetailGallery(tr2, folderLink); };
  const commitOrder = function (orderedIds) { return _rrGalCommitOrder(photos, orderedIds, redraw); };

  tr2.innerHTML = '';
  if (photos.length > 0 && !window.IS_MOBILE_UA) {
    tr2.appendChild(_rrViewChipRow(function (fid, key) { _rrGalCommitView(photos, fid, key, redraw); }));
  }

  photos.forEach(function (p) {
    const vKey = _rrViewOfName(p.name);
    const isRSV = vKey === 'RSV';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;display:inline-block;flex-shrink:0';
    wrap.setAttribute('data-galfid', p.id);
    // Drag to reorder (desktop; phones keep the plain gallery).
    if (!window.IS_MOBILE_UA) {
      wrap.draggable = true;
      wrap.style.cursor = 'grab';
      wrap.ondragstart = function (e) {
        e.dataTransfer.setData('text/plain', p.id);
        e.dataTransfer.effectAllowed = 'move';
        wrap.style.opacity = '0.45';
      };
      wrap.ondragend = function () { wrap.style.opacity = ''; };
      wrap.ondragover = function (e) { e.preventDefault(); wrap.style.outline = '2px solid ' + _RR_GAL_BLUE; };
      wrap.ondragleave = function () { wrap.style.outline = ''; };
      wrap.ondrop = function (e) {
        e.preventDefault(); e.stopPropagation(); wrap.style.outline = '';
        var fid = e.dataTransfer.getData('text/plain');
        if (!fid || fid === p.id) return;
        var ids = photos.map(function (x) { return x.id; });
        var from = ids.indexOf(fid), to = ids.indexOf(p.id);
        if (from < 0 || to < 0) return;
        ids.splice(to, 0, ids.splice(from, 1)[0]);
        commitOrder(ids);
      };
    }
    const a = document.createElement('a');
    a.href = p.view; a.target = '_blank';
    a.title = p.name.replace(/\.[^.]+$/, '') + (window.IS_MOBILE_UA ? '' : ' — drag to reorder, or onto a view above');
    a.style.cssText = 'display:inline-block;border-radius:8px;overflow:hidden;border:2px solid '
      + (isRSV ? _RR_GAL_BLUE : 'var(--border)') + ';';
    const img = document.createElement('img');
    img.style.cssText = 'width:80px;height:80px;object-fit:cover;display:block;background:var(--surface2)';
    img.alt = p.name.replace(/\.[^.]+$/, '').split(' ').pop();
    img.draggable = false;   // the WRAP drags; a dragged <img> ghosts a URL instead
    loadDriveThumb(p.id, img, a);
    const lbl = document.createElement('div');
    lbl.style.cssText = 'font-size:0.68rem;text-align:center;padding:2px 0;background:var(--surface2);color:'
      + (vKey ? _RR_GAL_BLUE : 'var(--text-dim)') + ';letter-spacing:0.03em'
      + (vKey ? ';font-weight:700' : '');
    const vDef = vKey && (typeof ITEM_VIEWS !== 'undefined' ? ITEM_VIEWS : []).find(function (v) { return v.key === vKey; });
    lbl.textContent = vDef ? vDef.abbr : p.name.replace(/\.[^.]+$/, '').replace(/^\d{2}· /, '').split(' ').pop();
    a.appendChild(img);
    a.appendChild(lbl);
    wrap.appendChild(a);
    const del = document.createElement('button');
    del.title = 'Delete this photo';
    del.setAttribute('aria-label', 'Delete this photo');
    del.innerHTML = '×';
    del.style.cssText = 'position:absolute;top:3px;right:3px;width:20px;height:20px;border-radius:50%;'
      + 'border:1.5px solid #fff;background:rgba(231,76,60,0.95);color:#fff;font-size:14px;line-height:1;'
      + 'cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;z-index:2;'
      + 'box-shadow:0 1px 3px rgba(0,0,0,0.4)';
    del.onclick = function (e) {
      e.preventDefault(); e.stopPropagation();
      _deleteCollectionPhoto(p.id, p.name, wrap);
    };
    wrap.appendChild(del);
    tr2.appendChild(wrap);
  });
};

async function _deleteCollectionPhoto(fileId, fileName, wrapEl) {
  if (!fileId) return;
  var label = String(fileName || 'photo').replace(/\.[^.]+$/, '');
  var ok = (typeof appConfirm === 'function')
    ? await appConfirm('Delete photo "' + label + '"?\n\nIt will be moved to your Google Drive trash, where you can still recover it.', { danger: true, ok: 'Delete' })
    : confirm('Delete photo "' + label + '"? (Moves to Google Drive trash — recoverable)');
  if (!ok) return;
  try {
    if (typeof driveRequest !== 'function') throw new Error('Drive not available');
    await driveRequest('PATCH', '/files/' + fileId, { trashed: true });
    if (wrapEl && wrapEl.parentNode) wrapEl.parentNode.removeChild(wrapEl);
    if (typeof showToast === 'function') showToast('\u2713 Photo deleted (moved to Drive trash)');
    // Refresh the detail page PHOTOS card behind the modal so it reflects the
    // deletion without a manual refresh. Small delay lets Drive's trash settle
    // before the card re-fetches the folder listing.
    if (typeof window._lastDetailIdx === 'number'
        && typeof showItemDetailPage === 'function') {
      setTimeout(function() { showItemDetailPage(window._lastDetailIdx, window._lastDetailCopyInv); }, 200);
    }
  } catch(e) {
    console.error('Delete photo error:', e);
    if (typeof showToast === 'function') showToast('Could not delete photo \u2014 please try again', 4000, true);
  }
}

function showItemPanel(idx, pdKey, mode) {
  const pd = state.personalData[pdKey] || {};
  const item = state.masterData[idx] || {
    itemNum: pd.itemNum, variation: pd.variation || '',
    roadName: pd.roadName || '', itemType: pd.itemType || '',
    yearProd: pd.yearMade || '', gauge: pd.gauge || '', marketVal: '', // market value comes from master sheet only
    varDesc: '', description: '',
  };

  const existing = document.getElementById('item-panel-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'item-panel-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem';
  // v0.9.988 (Brad): a stray click on the dark backdrop used to close this
  // panel and silently discard unsaved edits. Backdrop clicks now do nothing;
  // closing takes a deliberate action (✕, Cancel, Save, or the Back button).
  overlay.addEventListener('click', function(e) {
    if (e.target !== overlay) return;
    if (typeof showToast === 'function') showToast('Use Save All Changes, Cancel, or ✕ to close', 2500);
  });

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

  // v0.9.1315 (Brad's mis-filed 3419: "we need to brainstorm how to change an
  // item's variation number after it has already been entered… No way to
  // change it"): the original variation, captured ONCE — Save compares
  // against this to know a change happened and re-derive the identity.
  const _origVariation = String(pd.variation || item.variation || '');

  // v0.9.1318 (Brad: "we need a way to look at the different variations on
  // cott"): the reference URL for ONE variation of this item — the selected
  // row's own refLink through the deep-link machinery (v0.9.1304), so the
  // link lands on THAT variation's spot on the page, not the page top.
  function _panelVarRefUrl(vSel) {
    var _vn = String(pd.itemNum || item.itemNum || '').trim().toUpperCase();
    var mRow = (state.masterData || []).find(function (mm) {
      return String(mm.itemNum || '').trim().toUpperCase() === _vn
        && String(mm.variation || '') === String(vSel || '')
        && (!item._era || !mm._era || mm._era === item._era);
    });
    var rl = (mRow && mRow.refLink) || '';
    if (!rl) return null;
    if (typeof window.cottAnchorUrl === 'function') {
      return window.cottAnchorUrl(rl, _vn, (typeof window.cottRowWords === 'function' && mRow) ? window.cottRowWords(mRow) : '', String(vSel == null ? '' : vSel));
    }
    return rl;
  }
  if (pd.variation === undefined || pd.variation === '') pd.variation = _origVariation;

  const fields = [
    // v0.9.701 (Brad): a no-number item's TITLE is its identity — editable.
    ...((idx < 0 || pd.era === 'Manual') ? [{ label: 'Title / Name', key: 'itemNum', val: pd.itemNum || '—', type: 'textarea' }] : []),
    // v0.9.1315: the variation is CHANGEABLE on catalog items with 2+
    // variations — picked from the catalog's own list (value + description),
    // never typed. Staged like any other edit; Save re-points the catalog
    // match, refreshes both auto-descriptions and any For Sale listing.
    ...((idx >= 0 && pd.era !== 'Manual') ? (function () {
      var _vNum = String(pd.itemNum || item.itemNum || '').trim().toUpperCase();
      var _seenV = {};
      var _vOpts = [];
      (state.masterData || []).forEach(function (m) {
        if (String(m.itemNum || '').trim().toUpperCase() !== _vNum) return;
        if (item._era && m._era && m._era !== item._era) return;   // same era only
        var v = String(m.variation || '');
        if (!v || _seenV[v]) return;
        _seenV[v] = 1;
        // v0.9.1318b (Brad: "can not see the complete description"): carry the
        // FULL text too — the picker renders wrapping cards, not a <select>,
        // because native dropdown options clip and cannot wrap.
        _vOpts.push({ v: v, t: 'Var ' + v + ' — ' + String(m.varDesc || m.description || '').slice(0, 70), full: String(m.varDesc || m.description || '') });
      });
      if (_vOpts.length < 2) return [];   // one variation = nothing to change
      return [{ label: 'Variation', key: 'variation', val: 'Var ' + (pd.variation || '—'), type: 'select', options: _vOpts }];
    })() : []),
    // v0.9.987 (Brad): TYPE is editable on manual/off-catalog items — it
    // decides which Show chip the item appears under (Trains/Catalogs/
    // Paper Items). Catalog-matched items keep the catalog's type
    // (v0.9.798 rule), so no Type field for them.
    ...((idx < 0 || pd.era === 'Manual') ? [{ label: 'Type', key: 'itemType', val: pd.itemType || '—', type: 'select',
      options: (function() {
        var o = (((window.MANUAL_ITEM_TYPES || {}).all) || []).slice();
        ['Paper', 'Catalog'].forEach(function(t) { if (o.indexOf(t) < 0) o.push(t); });
        var cur = String(pd.itemType || '');
        if (cur && o.indexOf(cur) < 0) o.unshift(cur);   // keep a custom typed-in value selectable
        return o;
      })() }] : []),
    // v0.9.989 (unified inventory Phase 1): optional detail under Type —
    // e.g. 'Drawing' under Paper, 'Advance' under Catalog.
    ...((idx < 0 || pd.era === 'Manual') ? [{ label: 'Sub Type', key: 'subType', val: pd.subType || '—', type: 'text' }] : []),
    { label: 'Condition',     key: 'condition',     val: pd.condition || '—',     type: 'number', min:1, max:10 },
    { label: 'All Original',  key: 'allOriginal',   val: pd.allOriginal || '—',   type: 'select', options: ['Yes','No','Unknown'] },
    { label: 'Has Box',       key: 'hasBox',        val: pd.hasBox || '—',        type: 'select', options: ['Yes','No'] },
    { label: 'Box Condition', key: 'boxCond',       val: pd.boxCond || '—',       type: 'number', min:1, max:10 },
    { label: 'Price Paid ($)',key: 'priceItem',     val: pd.priceItem || '—',     type: 'number' },
    { label: 'Est. Worth (insurance)',key: 'userEstWorth',  val: pd.userEstWorth || '—',  type: 'number' },
    { label: 'Year Made',     key: 'yearMade',      val: pd.yearMade || '—',      type: 'number', min:1900, max:2100 },
    // v0.9.1372 — THE TWIN of the dashboard's "46240". This field printed the
    // raw sheet value too, so opening one of those items showed the serial
    // here as well. When a fix lands on one surface, look for the twin.
    { label: 'Date Purchased',key: 'datePurchased', val: (typeof _formatDate === 'function' ? _formatDate(pd.datePurchased || '') : (pd.datePurchased || '')) || '—', type: 'date' },
    // v0.9.696 (Brad): manual entries carry their own description — editable
    // here (catalog items keep the master description, not shown as a field).
    ...((idx < 0 || pd.era === 'Manual') ? [{ label: 'Description', key: 'description', val: pd.description || '—', type: 'textarea' }] : []),
    { label: 'Notes',         key: 'notes',         val: pd.notes || '—',         type: 'textarea' },
    // v0.9.1531b: suggests the places saved in Preferences (still free text).
    { label: 'Location',      key: 'location',      val: pd.location || '—',      type: 'text', suggest: 'locations' },
    // v0.9.1514 (Phase 2, Brad's parity rule): the SAME fields the detail
    // page shows are editable here — driven by the same config, so the two
    // can never drift apart.
    ...((typeof rrEnabledUserFields === 'function' ? rrEnabledUserFields() : []).map(function (f) {
      return { label: (typeof rrFieldLabel === 'function' ? rrFieldLabel(f) : f.label),
               key: f.key, val: pd[f.key] || '—', type: 'text',
               // v0.9.1531b: Location Detail offers what is inside THIS item's
               // location — the same list the wizard shows, from one config.
               suggest: (f.scopedTo === 'location') ? 'locationDetails' : '' };
    })),
    // v0.9.1425 (Brad): "it doesn't give me a way to say what era its in".
    // Normally the year decides and this stays blank — set it only when the
    // year can't settle it (undated ephemera) or is a guess. Shown for every
    // item so the answer is always reachable, but deliberately last: filling
    // in Year Made is the better fix and this is the escape hatch.
    { label: 'Era (overrides year)', key: 'eraPeriod',
      val: ({ prewar: 'Pre-war (before 1944)', postwar: 'Postwar (1945–1969)', modern: 'Modern (1970–today)' })[String(pd.eraPeriod || '').toLowerCase()] || '—',
      type: 'select',
      // {v,t} pairs — the shape this panel's select renderer expects (v0.9.1315).
      options: [{ v: '', t: 'From year (default)' }, { v: 'prewar', t: 'Pre-war (before 1944)' },
                { v: 'postwar', t: 'Postwar (1945–1969)' }, { v: 'modern', t: 'Modern (1970–today)' }] },
    ...(((typeof _itemExternalLinkURL === 'function') ? _itemExternalLinkURL(item) : item.refLink)
      ? [{ label: 'Reference', key: null, val: ((typeof _itemExternalLinkURL === 'function') ? _itemExternalLinkURL(item) : item.refLink), type: 'readonly' }] : []),
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

      // v0.9.1280: the gallery is a shared, reloadable function now — a drag
      // (reorder or view assignment) renames in Drive and redraws from Drive,
      // so the screen always shows what the renames actually produced.
      await window._rrDetailGallery(tr2, folderLink);

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
      // v0.9.1319 (Brad: "can not see the complete description"): the
      // variation picker is CARDS, not a <select> — native dropdown options
      // clip and cannot wrap, so long variation descriptions were unreadable
      // right at the moment of choosing. Each card carries the FULL wrapped
      // text and its own see-on-COTT link (the v0.9.1318 re-aim, one per
      // card now); tapping a card stages the pick like the ✓ did.
      if (mode === 'edit' && f.key === 'variation' && activeKey === f.key) {
        row.style.flexDirection = 'column';
        row.style.alignItems = 'stretch';
        lbl.style.width = 'auto';
        const vList = document.createElement('div');
        vList.style.cssText = 'display:flex;flex-direction:column;gap:0.45rem;width:100%;max-height:45vh;overflow-y:auto;padding-right:0.2rem';
        f.options.forEach(function (o) {
          const cur = String(o.v) === String(pd.variation || '');
          const card = document.createElement('div');
          card.style.cssText = 'border:1.5px solid ' + (cur ? 'var(--accent)' : 'var(--border)') + ';border-radius:9px;padding:0.55rem 0.7rem;cursor:pointer;background:var(--surface2)';
          card.innerHTML =
            '<div style="font-size:0.8rem;font-weight:700;color:' + (cur ? 'var(--accent)' : 'var(--text)') + ';margin-bottom:0.25rem">Var ' + rrEsc(String(o.v)) + (cur ? ' — current' : '') + '</div>' +
            '<div style="font-size:0.78rem;color:var(--text-mid);line-height:1.5;white-space:normal">' + rrEsc(o.full || o.t) + '</div>';
          const u = _panelVarRefUrl(o.v);
          if (u) {
            card.innerHTML += '<a href="' + u + '" target="_blank" rel="noopener" onclick="event.stopPropagation()" onmousedown="event.preventDefault()" style="display:inline-flex;margin-top:0.35rem;font-size:0.75rem;color:var(--accent2);text-decoration:none">' +
              (/cornucopiaoftoytrains/i.test(u) ? 'See this variation on COTT ↗' : 'See this variation ↗') + '</a>';
          }
          card.onclick = function () {
            pd.variation = String(o.v);
            f.val = 'Var ' + o.v;
            editingKey = null;
            renderFields(null);
          };
          vList.appendChild(card);
        });
        const closeRow = document.createElement('button');
        closeRow.textContent = '✕ Keep current variation';
        closeRow.style.cssText = 'margin-top:0.45rem;padding:0.45rem;border-radius:8px;border:1px solid var(--border);background:none;color:var(--text-dim);cursor:pointer;font-size:0.8rem;font-family:var(--font-body)';
        closeRow.onclick = function () { editingKey = null; renderFields(null); };
        valWrap.appendChild(vList);
        valWrap.appendChild(closeRow);
        row.appendChild(lbl);
        row.appendChild(valWrap);
        fieldsContainer.appendChild(row);
        return;
      }

      if (mode === 'edit' && f.key != null && f.type !== 'readonly' && f.type !== 'link' && activeKey === f.key) {
        // Show input
        let inp;
        if (f.type === 'select') {
          inp = document.createElement('select');
          inp.style.cssText = 'width:100%;background:var(--bg);border:1px solid #2980b9;border-radius:6px;padding:0.4rem 0.6rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem';
          f.options.forEach(function(o) {
            const opt = document.createElement('option');
            // v0.9.1315: options may be {v, t} pairs — the variation picker
            // stores the bare number but shows the description beside it.
            const _ov = (o && typeof o === 'object') ? o.v : o;
            opt.value = _ov; opt.textContent = (o && typeof o === 'object') ? o.t : o;
            if (String(_ov) === String(pd[f.key] || '')) opt.selected = true;
            inp.appendChild(opt);
          });
        } else if (f.type === 'textarea') {
          // v0.9.696 (Brad): long text needs a BIG box — full width, tall,
          // grows with the phone screen (45% of viewport height).
          inp = document.createElement('textarea');
          inp.value = pd[f.key] || '';
          inp.rows = 6;
          inp.style.cssText = 'width:100%;background:var(--bg);border:1px solid #2980b9;border-radius:6px;padding:0.6rem 0.7rem;color:var(--text);font-family:var(--font-body);font-size:0.95rem;box-sizing:border-box;resize:vertical;min-height:min(45vh, 320px);line-height:1.45';
        } else {
          inp = document.createElement('input');
          inp.type = f.type === 'text' ? 'text' : f.type;
          inp.value = pd[f.key] || '';
          if (f.min !== undefined) inp.min = f.min;
          if (f.max !== undefined) inp.max = f.max;
          inp.style.cssText = 'width:100%;background:var(--bg);border:1px solid #2980b9;border-radius:6px;padding:0.4rem 0.6rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem;box-sizing:border-box';
          // v0.9.1531b (Brad): the edit panel gets the same suggestions the
          // wizard does — his rule that a field behaves the same everywhere.
          try {
            var _sVals = null;
            if (f.suggest === 'locations' && typeof rrSavedLocations === 'function') {
              _sVals = rrSavedLocations().map(function (l) { return l.name; });
            } else if (f.suggest === 'locationDetails' && typeof rrLocationDetails === 'function') {
              _sVals = rrLocationDetails(pd.location || '');
            }
            if (_sVals && _sVals.length) {
              var _dlId = 'panel-dl-' + f.key;
              var _old = document.getElementById(_dlId);
              if (_old) _old.remove();
              var _dl = document.createElement('datalist');
              _dl.id = _dlId;
              _sVals.forEach(function (v) {
                var o = document.createElement('option'); o.value = v; _dl.appendChild(o);
              });
              document.body.appendChild(_dl);
              inp.setAttribute('list', _dlId);
            }
          } catch (eDL) {}
        }
        inp.id = 'panel-inp-' + f.key;
        setTimeout(function() { if (inp) inp.focus(); }, 30);

        const doneBtn = document.createElement('button');
        doneBtn.textContent = '✓';
        doneBtn.style.cssText = 'margin-left:0.4rem;padding:0.3rem 0.6rem;border-radius:6px;border:1px solid #2980b9;background:#2980b9;color:#fff;cursor:pointer;font-size:0.85rem;flex-shrink:0';
        doneBtn.onclick = function() {
          pd[f.key] = inp.value;
          f.val = (f.key === 'variation' ? 'Var ' + inp.value : inp.value) || '—';   // v0.9.1315
          editingKey = null;
          renderFields(null);
        };

        const cancelInp = document.createElement('button');
        cancelInp.textContent = '✕';
        cancelInp.style.cssText = 'margin-left:0.25rem;padding:0.3rem 0.5rem;border-radius:6px;border:1px solid var(--border);background:none;color:var(--text-dim);cursor:pointer;font-size:0.85rem;flex-shrink:0';
        cancelInp.onclick = function() { editingKey = null; renderFields(null); };

        const inpRow = document.createElement('div');
        if (f.type === 'textarea') {
          // Stack: big box on top, buttons below (v0.9.696)
          row.style.flexDirection = 'column';
          row.style.alignItems = 'stretch';
          lbl.style.width = 'auto';
          inpRow.style.cssText = 'display:flex;flex-direction:column;gap:0.4rem;width:100%';
          var btnRow = document.createElement('div');
          btnRow.style.cssText = 'display:flex;justify-content:flex-end;gap:0.4rem';
          inpRow.appendChild(inp);
          btnRow.appendChild(doneBtn);
          btnRow.appendChild(cancelInp);
          inpRow.appendChild(btnRow);
        } else {
          inpRow.style.cssText = 'display:flex;align-items:center;gap:0;width:100%';
          inpRow.appendChild(inp);
          inpRow.appendChild(doneBtn);
          inpRow.appendChild(cancelInp);
        }
        valWrap.appendChild(inpRow);
        // (v0.9.1318's select-side COTT link moved INTO the variation cards
        // above in v0.9.1319 — one link per card, full text visible.)

      } else if (f.type === 'link') {
        // External link — render as clickable anchor, no edit
        const a = document.createElement('a');
        a.href = f.val;
        a.target = '_blank';
        a.rel = 'noopener';
        a.style.cssText = 'font-size:0.85rem;color:#2980b9;text-decoration:none;display:inline-flex;align-items:center;gap:0.3rem';
        a.innerHTML = 'View on ' + (typeof _externalSiteLabel === 'function' ? _externalSiteLabel(f.val) : 'Atlas') + ' <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
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
      + _linkedIS.map(s => `<div onclick="openISDetail('${String(s._key || s.row).replace(/'/g, "\\'")}')" style="display:flex;align-items:center;gap:0.6rem;padding:0.45rem 0.5rem;border-radius:8px;cursor:pointer;transition:background 0.1s" class="dash-row-hover">
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
      // v0.9.705 (Brad): a field still OPEN in its edit box hasn't been
      // committed to pd yet (that's what the ✓ did) — hitting Save All
      // without tapping ✓ silently discarded the typed value. Commit any
      // open editor first, so Save All means ALL, no ✓ required.
      if (editingKey) {
        var _openInp = document.getElementById('panel-inp-' + editingKey);
        if (_openInp) pd[editingKey] = _openInp.value;
        editingKey = null;
      }
      saveBtn.textContent = 'Saving…'; saveBtn.disabled = true;
      // Collect all current pd values (updated in-place during edits)
      const priceItem = pd.priceItem || '';
      const priceBox = pd.priceBox || '';
      const calc = (parseFloat(priceItem)||0) + (parseFloat(priceBox)||0);
      // H1 fix (Session 159): use schema-driven buildPersonalRow + full row range.
      // The old 25-cell array was in pre-Session-156 column order; every column
      // from B onward landed in the wrong cell on a 32-col schema sheet.
      // v0.9.1315: the variation the USER picked wins over the master row the
      // page happened to open on. When it changed, the copy's stored identity
      // re-derives — masterKey re-points and both auto-descriptions refresh
      // (buildPersonalRow does the sheet side; state is updated below).
      const _newVariation = String(pd.variation || item.variation || '');
      const _varChanged = _newVariation !== _origVariation;
      if (_varChanged) {
        const _nm = (typeof findMaster === 'function')
          ? findMaster(pd.itemNum || item.itemNum, _newVariation, { era: pd.era || '', manufacturer: pd.manufacturer || '' })
          : null;
        pd.masterKey = (_nm && typeof rrMasterKeyOf === 'function') ? rrMasterKeyOf(_nm) : '';
        pd.masterDescription = (_nm && _nm.description) ? String(_nm.description) : '';
        pd.variationDescription = (_nm && _nm.varDesc) ? String(_nm.varDesc) : '';
      }
      const newRow = buildPersonalRow({
        dateAdded: pd.dateAdded || '',   // v0.9.720: panel saves keep the original date
        itemNum: pd.itemNum || item.itemNum,   // v0.9.701: title is editable on manual items
        variation: _newVariation,
        condition: pd.condition || '',
        allOriginal: pd.allOriginal || '',
        priceItem: priceItem,
        priceBox: priceBox,
        priceComplete: calc > 0 ? calc.toFixed(2) : '',
        hasBox: pd.hasBox || '',
        boxCond: pd.boxCond || '',
        photoItem: pd.photoItem || '',
        photoBox: pd.photoBox || '',
        notes: pd.notes || '',
        datePurchased: pd.datePurchased || '',
        userEstWorth: pd.userEstWorth || '',
        matchedTo: pd.matchedTo || '',
        setId: pd.setId || '',
        yearMade: pd.yearMade || '',
        isError: pd.isError || '',
        errorDesc: pd.errorDesc || '',
        quickEntry: pd.quickEntry ? 'Yes' : '',
        inventoryId: pd.inventoryId || '',
        groupId: pd.groupId || '',
        location: pd.location || '',
        era: pd.era || '',
        manufacturer: pd.manufacturer || '',
        itemType: pd.itemType || '',
        subType: pd.subType || '',   // v0.9.989: full-row update must carry it or it's wiped
        roadName: pd.roadName || '',
        roadNumber: pd.roadNumber || '',
        description: pd.description || '',
        customName: pd.customName || '',
      });
      try {
        if (typeof _healPdRow === 'function') await _healPdRow(pd);
        // v0.9.1267 (R3): identity-checked. This is the edit-save — the values
        // being written describe THIS item, so landing a row off would stamp
        // this item's details over a different one. If the row moved, stop:
        // the user has been told to refresh, and the overlay stays open with
        // their edits intact rather than closing on a save that did not happen.
        if (!(await personalWriteRow(pd, newRow))) {
          saveBtn.textContent = '💾 Save All Changes'; saveBtn.disabled = false;
          return;
        }
        state.personalData[pdKey] = Object.assign({}, pd, { priceComplete: calc > 0 ? calc.toFixed(2) : '' });
        // v0.9.1315: a For Sale listing of THIS copy carries the variation
        // too — update it in the same save so the two can never disagree.
        if (_varChanged && pd.inventoryId && state.forSaleData && state.forSaleData[pd.inventoryId]) {
          try {
            const _fs = state.forSaleData[pd.inventoryId];
            if (_fs.row && String(_fs.variation || '') !== _newVariation) {
              const _fsRow = [_fs.itemNum, _newVariation, _fs.condition || '', _fs.askingPrice || '',
                _fs.dateListed || '', _fs.notes || '', _fs.originalPrice || '', _fs.estWorth || '',
                _fs.inventoryId || '', _fs.manufacturer || ''];
              if (await rrVerifiedRowUpdate(state.personalSheetId, 'For Sale', _fs.row,
                    `For Sale!A${_fs.row}:J${_fs.row}`, [_fsRow],
                    { num: _fs.itemNum || '', invId: _fs.inventoryId || '' }, 'For Sale list')) {
                _fs.variation = _newVariation;
              }
            }
          } catch (eFs) { console.warn('For Sale variation sync failed:', eFs); }
        }
        // v0.9.697: keep the offline snapshot in sync — edits were reverting
        // to pre-edit values on the next app load (cache had the old row).
        if (typeof _cachePersonalData === 'function') _cachePersonalData();
        overlay.remove();
        showToast(_varChanged ? ('✓ Updated — now Var ' + _newVariation) : '✓ Item updated!');
        buildDashboard();
        // Re-render the detail page so edited fields + photos show immediately.
        // v0.9.1315: after a variation change the page must re-resolve to the
        // NEW variation's catalog row — the stored index points at the old one.
        if (_varChanged && pd.inventoryId && typeof _openOwnedByInvId === 'function') {
          _openOwnedByInvId(pd.inventoryId);
        } else if (typeof window._lastDetailIdx === 'number'
            && typeof showItemDetailPage === 'function') {
          showItemDetailPage(window._lastDetailIdx, window._lastDetailCopyInv);
        }
      } catch(e) {
        saveBtn.textContent = '💾 Save All Changes'; saveBtn.disabled = false;
        showToast((typeof rrSaveError === 'function') ? rrSaveError(e, 'your change') : 'Error: ' + e.message, 5000, true);
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
  if (window.BackStack && BackStack.wire) BackStack.wire(overlay); // v0.9.806 TODO-012: device Back closes this pop-up
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
  if (window.BackStack && BackStack.wire) BackStack.wire(overlay); // v0.9.806 TODO-012: device Back closes this pop-up
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
  bindOverlayClose(overlay, function() { overlay.remove(); });
  const box = document.createElement('div');
  box.className = 'rr-card'; box.style.borderColor = 'rgba(232,64,28,0.4)';
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
    rows.push(['Market Value', item.marketVal ? _currencySymbol() + parseFloat(item.marketVal).toLocaleString() : '—']);
    // Session 112: surface manufacturer-specific extra fields (Atlas category,
    // rail power, MSRP, etc.) driven by CATALOG_DISPLAY.extraFields config.
    // Row appears only when the field is populated on the master row.
    if (typeof CATALOG_DISPLAY !== 'undefined' && Array.isArray(CATALOG_DISPLAY.extraFields)) {
      CATALOG_DISPLAY.extraFields.forEach(function(fld) {
        var v = item[fld.key];
        if (v === undefined || v === null || v === '') return;
        var display = String(v);
        if (fld.format === 'money') {
          var num = parseFloat(v);
          if (!isNaN(num)) display = _currencySymbol() + num.toLocaleString();
        }
        rows.push([fld.label, display]);
      });
    }
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
      vdSec.style.cssText = 'margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border);font-size:0.82rem;color:var(--text-mid);line-height:1.6;white-space:pre-line';
      vdSec.innerHTML = '<span style="color:var(--accent2);font-weight:600">Variation: </span>' + item.varDesc;
      vdBox.appendChild(vdSec);
    }
    if (item.description) {
      const descSec = document.createElement('div');
      descSec.style.cssText = 'margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border);font-size:0.82rem;color:var(--text-mid);line-height:1.6';
      descSec.textContent = item.description;
      vdBox.appendChild(descSec);
    }
    var _detailUrl = (typeof _itemExternalLinkURL === 'function') ? _itemExternalLinkURL(item) : (item.refLink || '');
    if (_detailUrl) {
      const cottRow = document.createElement('div');
      cottRow.style.cssText = 'margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border)';
      const cottA = document.createElement('a');
      cottA.href = _detailUrl;
      cottA.target = '_blank';
      cottA.rel = 'noopener';
      cottA.style.cssText = 'font-size:0.82rem;color:#2980b9;text-decoration:none;display:inline-flex;align-items:center;gap:0.35rem';
      cottA.innerHTML = 'View on ' + (typeof _externalSiteLabel === 'function' ? _externalSiteLabel(_detailUrl) : 'External') + ' <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
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
    if (window.BackStack && BackStack.wire) BackStack.wire(vdOverlay); // v0.9.806 TODO-012: device Back closes this pop-up
  };
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-secondary';
  cancelBtn.style.cssText = 'padding:0.6rem 0.9rem';
  cancelBtn.textContent = '✕';
  cancelBtn.onclick = function() { overlay.remove(); };
  // ── v0.9.1449 (Brad): the same green + Want List button the Sets pop-up
  // already has. Already-wanted shows a label instead, so the same item
  // can't be wished for twice by accident.
  const _wantedKey = String(item.itemNum) + '|' + String(item.variation || '');
  btnRow.appendChild(yesBtn);
  if (state.wantData && state.wantData[_wantedKey]) {
    const wantedLbl = document.createElement('span');
    wantedLbl.style.cssText = 'font-size:0.8rem;color:#2ecc71;align-self:center;white-space:nowrap;font-weight:600';
    wantedLbl.textContent = '✓ On Want List';
    btnRow.appendChild(wantedLbl);
  } else {
    const wantBtn = document.createElement('button');
    wantBtn.className = 'btn btn-secondary';
    wantBtn.style.cssText = 'flex:1;border:1.5px solid #2ecc71;background:rgba(46,204,113,0.12);color:#2ecc71;font-weight:600';
    wantBtn.textContent = '+ Want List';
    wantBtn.onclick = function() { overlay.remove(); addItemToWantList(idx); };
    btnRow.appendChild(wantBtn);
  }
  btnRow.appendChild(viewBtn);
  btnRow.appendChild(cancelBtn);
  box.appendChild(btnRow);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  if (window.BackStack && BackStack.wire) BackStack.wire(overlay); // v0.9.806 TODO-012: device Back closes this pop-up
}

// ── Detail popup for Sets, Catalogs, and Instruction Sheets ──
function showRefItemPopup(type, idx) {
  var title = '', subtitle = '', details = [];
  if (type === 'set') {
    var s = (window._browseFilteredSets || [])[idx];
    if (!s) return;
    title = 'Set ' + s.setNum;
    subtitle = s.setName || '';
    // Check ownership from My Sets data — capture the bucket key too
    // so we can deep-link "View Full Details" into showNonItemDetailPage.
    var _mySetEntry = Object.entries(state.mySetsData || {}).find(function(ent) {
      var ms = ent[1];
      return ms.setNum === s.setNum && (!ms.year || ms.year === s.year);
    });
    var _mySetKey = _mySetEntry ? _mySetEntry[0] : null;
    var _mySet    = _mySetEntry ? _mySetEntry[1] : null;
    details = [
      ['Year', s.year || '—'],
      ['Gauge', s.gauge || '—'],
      ['Price', s.price || '—'],
      ['Items', s.items.join(', ') || '—'],
    ];
    if (_mySet) {
      if (_mySet.condition) details.push(['Condition', _mySet.condition + '/10']);
      if (_mySet.estWorth) details.push(['Est. Worth', _currencySymbol() + parseFloat(_mySet.estWorth).toLocaleString()]);
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
  bindOverlayClose(overlay, function() { overlay.remove(); });
  var box = document.createElement('div');
  box.className = 'rr-card'; box.style.borderColor = 'rgba(232,64,28,0.4)';
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
    // Reuse the entry we already looked up above so we have the key.
    _setOwned = !!_mySetKey;
    if (_setOwned) {
      // Session 116: instead of a non-clickable "✓ In Your Collection"
      // badge, surface a real "View Full Details" button that opens
      // the new generic detail page for this set. Brad wanted the
      // modal preserved (quick-look) AND a path to the full page.
      addBtn.style.cssText = 'margin-top:1.25rem;width:100%;background:rgba(41,128,185,0.1);border:1.5px solid #2980b9;border-radius:10px;padding:0.75rem;line-height:1.25;color:#2980b9;font-family:var(--font-body);font-size:0.92rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.5rem';
      addBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>'
        + '<span>View Full Details</span>';
      addBtn._mySetKeyForDetail = _mySetKey;
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
      // Session 116: owned sets — open the new detail page instead
      // of being a dead-end badge.
      if (_setOwned) {
        if (addBtn._mySetKeyForDetail && typeof showNonItemDetailPage === 'function') {
          showNonItemDetailPage('sets', addBtn._mySetKeyForDetail);
        }
        return;
      }
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
      var _hasGrouping2 = (typeof getGroupingOptions === 'function') && getGroupingOptions(_itemNum).length > 0;
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
  if (window.BackStack && BackStack.wire) BackStack.wire(overlay); // v0.9.806 TODO-012: device Back closes this pop-up
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
  const _hasGrouping = (typeof getGroupingOptions === 'function') && getGroupingOptions(item.itemNum).length > 0;
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
  bindOverlayClose(overlay, function() { closeModal(); });
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
              '<div class="form-field"><label>Target Condition</label><select id="fc-want-target"><option value="">Any</option>' +
                Array.from({length:10},(_,i)=>10-i).map(v=>'<option value="'+v+'">'+v+'</option>').join('') +
              '</select></div>' +
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
        '<button class="btn btn-primary" id="fc-save-btn" onclick="saveItem()">Save to Collection</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);
  if (window.BackStack && BackStack.wire) BackStack.wire(overlay); // v0.9.806 TODO-012: device Back closes this pop-up
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
      matchedBadgeEl.innerHTML = `Matched ${modalIsTender ? 'Engine' : 'Tender'}: <strong style="margin-left:0.3rem">${modalMatchedTo}</strong>`;   // v0.9.1434: train icons purged
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
  document.getElementById('mi-market').textContent = item.marketVal ? _currencySymbol() + parseFloat(item.marketVal).toLocaleString() : '—';
  document.getElementById('mi-ref').innerHTML = (function(){ var _u3 = (typeof _itemExternalLinkURL === 'function') ? _itemExternalLinkURL(item) : (item.refLink || ''); return _u3 ? `<a href="${_u3}" target="_blank">View on ${(typeof _externalSiteLabel === "function" ? _externalSiteLabel(_u3) : "External")} ↗</a>` : '—'; })();
  document.getElementById('mi-desc').textContent = item.description || 'No description available.';
  const vd = document.getElementById('mi-varDesc-wrap');
  if (item.varDesc) { document.getElementById('mi-varDesc').textContent = item.varDesc; vd.style.display = 'block'; }
  else { vd.style.display = 'none'; }

  // Personal data - check owned, for sale, sold, and want
  // Phase 3: For Sale lookup by THIS pd's inventoryId. Want is one-per-item
  // and still keyed by composite (left untouched per Phase 3 scope).
  const sd = (typeof _latestSale === 'function' ? _latestSale(item.itemNum, item.variation) : null) || {};
  const fs = (pd && pd.inventoryId && state.forSaleData[pd.inventoryId]) || {};
  const _wantKey = item.itemNum + '|' + (item.variation || '');
  const wd = state.wantData[_wantKey] || {};
  const itemStatus = pd.owned ? 'Owned' : fs.itemNum ? 'ForSale' : sd.itemNum ? 'Sold' : wd.itemNum ? 'Want' : '';
  currentStatus = itemStatus || '';
  setStatus(itemStatus || 'Want');
  document.getElementById('fc-sale-price').value = sd.salePrice || '';
  document.getElementById('fc-date-sold').value = sd.dateSold || '';
  document.getElementById('fc-asking-price').value = fs.askingPrice || '';
  document.getElementById('fc-date-listed').value = fs.dateListed || '';
  document.getElementById('fc-want-priority').value = wd.priority || 'Medium';
  document.getElementById('fc-want-price').value = wd.expectedPrice || '';
  var _wtEl = document.getElementById('fc-want-target');
  if (_wtEl) _wtEl.value = wd.targetCondition || '';
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
    matchedItem: findMaster(item.itemNum, null, item) || null,
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

var currentStatus = 'Want';

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

// ── SAVE AN ITEM ─────────────────────────────────────────────────
// v0.9.1258 (audit 2026-08-02, finding 1). The sheet writes live here, in
// their own function, for one reason: so saveItem() below can put ONE
// try/catch around all of them. They used to sit inline in saveItem() —
// roughly fourteen awaits with no guard anywhere, followed by an
// unconditional "✓ Item updated!". The checkmark was not reporting success;
// it was simply the next line of code.
//
// Nothing in here changed except the ORDER of the Sold and Want paths.
// Both used to erase the row in My Collection BEFORE writing its
// replacement. See the notes at each one.
async function _saveItemWrites() {
  const { item } = state.currentItem;
  // Phase 3: personalData is inventoryId-keyed. Find the existing copy (if any)
  // via findPDKey (value scan). pdKey is the canonical storage key.
  const _saveItemPdKey = (typeof findPDKey === 'function') ? findPDKey(item.itemNum, item.variation) : null;
  const _saveItemPd = _saveItemPdKey ? state.personalData[_saveItemPdKey] : null;
  const key = _saveItemPdKey || `${item.itemNum}|${item.variation}`;
  // Want List is still keyed by composite (one entry per item by design).
  const _wantKeySI = `${item.itemNum}|${item.variation || ''}`;
  // Phase 3: For Sale is keyed by inventoryId. Look it up off the matched pd.
  const _fsKeySI = (_saveItemPd && _saveItemPd.inventoryId) || null;

  const copy = document.getElementById('fc-copy').value;
  const condition = document.getElementById('fc-condition').value;

  if (currentStatus === 'Owned') {
    // Write/update in My Collection tab
    const _ex = _saveItemPd || {};
    // H1 fix (Session 159): use schema-driven buildPersonalRow + full row range.
    // The old 25-cell positional array was in pre-Session-156 order; every
    // column from B onward landed in the wrong cell on a 32-col schema sheet.
    // Note: there is no 'copy' field in the current schema, so we drop it.
    const ownedRow = buildPersonalRow({
      dateAdded: _ex.dateAdded,   // v0.9.720: undefined on fresh adds → stamped; kept on updates
      itemNum: item.itemNum,
      variation: item.variation || '',
      condition: condition,
      allOriginal: document.getElementById('fc-original').value,
      priceItem: document.getElementById('fc-price-item').value,
      priceBox: document.getElementById('fc-price-box').value,
      priceComplete: document.getElementById('fc-price-complete').value,
      hasBox: document.getElementById('fc-has-box').value,
      boxCond: document.getElementById('fc-box-cond').value,
      photoItem: document.getElementById('fc-photo-item').value,
      photoBox: document.getElementById('fc-photo-box').value,
      notes: document.getElementById('fc-notes').value,
      datePurchased: _ex.datePurchased || '',
      userEstWorth: _ex.userEstWorth || '',
      matchedTo: _ex.matchedTo || '',
      setId: _ex.setId || '',
      yearMade: _ex.yearMade || '',
      isError: _ex.isError || '',
      errorDesc: _ex.errorDesc || '',
      quickEntry: _ex.quickEntry ? 'Yes' : '',
      inventoryId: _ex.inventoryId || nextInventoryId(),
      groupId: _ex.groupId || '',
      location: _ex.location || '',
      era: _ex.era || '',
      manufacturer: _ex.manufacturer || '',
      itemType: _ex.itemType || '',
      subType: _ex.subType || '',   // v0.9.989: full-row update must carry it or it's wiped
      roadName: _ex.roadName || '',
      roadNumber: _ex.roadNumber || '',
      description: _ex.description || '',
      customName: _ex.customName || '',
    });
    const existing = _saveItemPd;
    if (existing && existing.row) {
      // v0.9.1267 (R3): identity-checked. Re-owning replaces a whole row with
      // this item's details; on the wrong row that overwrites someone else's
      // item outright. A refusal stops the whole re-own rather than going on to
      // clear the Want row for a change that never landed.
      if (!(await personalWriteRow(existing, ownedRow))) return false;
    } else {
      await sheetsAppend(state.personalSheetId, PERSONAL_TAB + '!A:A', [ownedRow]);
    }
    // Session 176: do NOT clear Sold rows when re-owning — Sold is now a
    // permanent sale history (each past sale stays as its own record).
    // Remove from Want List if it was there
    const wantEntry = state.wantData[_wantKeySI];
    if (wantEntry && wantEntry.row) {
      await rrVerifiedRowUpdate(state.personalSheetId, 'Want-Upgrade List', wantEntry.row, `Want-Upgrade List!A${wantEntry.row}:I${wantEntry.row}`, [['','','','','','','','','']], { num: wantEntry.itemNum || '', invId: wantEntry.inventoryId || '' }, 'Want list');
    }
    // Remove from For Sale if it was there
    const fsEntry = _fsKeySI ? state.forSaleData[_fsKeySI] : null;
    if (fsEntry && fsEntry.row) {
      await rrVerifiedRowUpdate(state.personalSheetId, 'For Sale', fsEntry.row, `For Sale!A${fsEntry.row}:J${fsEntry.row}`, [['','','','','','','','','','']], { num: fsEntry.itemNum || '', invId: fsEntry.inventoryId || '' }, 'For Sale list');
    }

  } else if (currentStatus === 'ForSale') {
    // Write to For Sale tab (keep in collection too — it's still yours)
    const existing = _saveItemPd;
    const forSaleRow = [
      item.itemNum, item.variation || '',
      condition,
      document.getElementById('fc-asking-price').value,
      document.getElementById('fc-date-listed').value || new Date().toISOString().split('T')[0],
      document.getElementById('fc-notes').value,
      existing?.priceItem || '',
      existing?.userEstWorth || '',
      existing?.inventoryId || '',
      existing?.manufacturer || (typeof _brandOfItem === 'function' && _brandOfItem(item.itemNum)) || _getEraManufacturer(),
    ];
    const fsEntry2 = _fsKeySI ? state.forSaleData[_fsKeySI] : null;
    if (fsEntry2 && fsEntry2.row) {
      await rrVerifiedRowUpdate(state.personalSheetId, 'For Sale', fsEntry2.row, `For Sale!A${fsEntry2.row}:J${fsEntry2.row}`, [forSaleRow], { num: fsEntry2.itemNum || '', invId: fsEntry2.inventoryId || '' }, 'For Sale list');
    } else {
      await sheetsAppend(state.personalSheetId, 'For Sale!A:A', [forSaleRow]);
    }
    // Session 176: do NOT clear Sold rows when listing for sale — preserve the
    // full sale history.
    // Remove from Want if it was there
    const wantEntry2 = state.wantData[_wantKeySI];
    if (wantEntry2 && wantEntry2.row) {
      await rrVerifiedRowUpdate(state.personalSheetId, 'Want-Upgrade List', wantEntry2.row, `Want-Upgrade List!A${wantEntry2.row}:I${wantEntry2.row}`, [['','','','','','','','','']], { num: wantEntry2.itemNum || '', invId: wantEntry2.inventoryId || '' }, 'Want list');
    }

  } else if (currentStatus === 'Sold') {
    const existing = _saveItemPd;

    // Write to Sold tab FIRST — Session 176: each sale its own row (append)
    // + snapshot.
    //
    // v0.9.1258: this append used to come AFTER the two erases below. If it
    // threw — expired sign-in, dropped connection, Sold tab renamed — the
    // item was already gone from My Collection, had never arrived in Sold,
    // and the dialog closed with a checkmark. That was the one bug in the
    // 08-02 audit that could destroy a record.
    //
    // The rule: never erase the only copy of a record before its replacement
    // exists. Reordered, the worst case is the opposite failure — the Sold
    // row lands and the erase does not, so the item shows in both places at
    // once. That is visible on screen and the user can fix it. A silent
    // deletion is neither.
    const soldRow = _buildSoldRow({
      itemNum: item.itemNum, variation: item.variation || '', copy: copy,
      condition: condition,
      pricePaid: (existing && existing.priceItem) || document.getElementById('fc-price-item').value,
      salePrice: document.getElementById('fc-sale-price').value,
      dateSold: document.getElementById('fc-date-sold').value,
      notes: document.getElementById('fc-notes').value,
      inventoryId: (existing && existing.inventoryId) || '',
      manufacturer: (existing && existing.manufacturer) || '',
      src: existing || {},
    });
    await sheetsAppend(state.personalSheetId, 'Sold!A:T', [soldRow]);

    // Only now that the sale is safely recorded, remove it from My Collection.
    // v0.9.1267 (R3): identity-checked. If it is refused the Sold row already
    // exists, so the item shows in both places — visible and fixable. Blanking
    // whatever row happens to be sitting there instead is neither.
    if (existing && existing.row) {
      if (!(await personalWriteRow(existing, personalBlankRow()))) return false;
    }
    // Remove from For Sale if it was there
    const fsEntry3 = _fsKeySI ? state.forSaleData[_fsKeySI] : null;
    if (fsEntry3 && fsEntry3.row) {
      await rrVerifiedRowUpdate(state.personalSheetId, 'For Sale', fsEntry3.row, `For Sale!A${fsEntry3.row}:J${fsEntry3.row}`, [['','','','','','','','','','']], { num: fsEntry3.itemNum || '', invId: fsEntry3.inventoryId || '' }, 'For Sale list');
    }

    // If this sold copy had an Upgrade entry linked to it, convert to Want.
    if (typeof _convertUpgradeToWantOnSell === 'function') {
      await _convertUpgradeToWantOnSell((existing && existing.inventoryId) || '');
    }

  } else if (currentStatus === 'Want') {
    const existing = state.personalData[key];

    // v0.9.1258: same reorder as the Sold path above. This branch used to
    // blank the My Collection row first and write the Want row second, so a
    // failed Want write erased an owned item and put nothing in its place.
    // Write/update Want List tab FIRST.
    const wantRow = [
      item.itemNum,
      item.variation || '',
      document.getElementById('fc-want-priority').value,
      document.getElementById('fc-want-price').value,
      document.getElementById('fc-want-notes').value,
      (typeof _brandOfItem === 'function' && _brandOfItem(item.itemNum)) || _getEraManufacturer(),
      (document.getElementById('fc-want-target') && document.getElementById('fc-want-target').value) || '',
    ];
    const wantEntry = state.wantData[key];
    if (wantEntry && wantEntry.row) {
      // Want-Upgrade combined: write 9-col row with List Type='Want'.
      const _wuRow = [wantRow[0], wantRow[1], 'Want', wantRow[2], wantRow[3], wantRow[6] || '', '', wantRow[4], wantRow[5]];
      await rrVerifiedRowUpdate(state.personalSheetId, 'Want-Upgrade List', wantEntry.row, `Want-Upgrade List!A${wantEntry.row}:I${wantEntry.row}`, [_wuRow], { num: wantEntry.itemNum || '', invId: wantEntry.inventoryId || '' }, 'Want list');
    } else {
      // Want-Upgrade combined: append 9-col row with List Type='Want'.
      const _wuAppendRow = [wantRow[0], wantRow[1], 'Want', wantRow[2], wantRow[3], wantRow[6] || '', '', wantRow[4], wantRow[5]];
      await sheetsAppend(state.personalSheetId, 'Want-Upgrade List!A:I', [_wuAppendRow]);
    }
    // Only now that the Want row exists, remove it from My Collection.
    // v0.9.1267 (R3): identity-checked, same reasoning as the Sold path above.
    if (existing && existing.row) {
      if (!(await personalWriteRow(existing, personalBlankRow()))) return false;
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
  return true;   // v0.9.1267 (R3): every write landed
}

// v0.9.1258 (audit 2026-08-02, finding 1). saveItem()'s only caller is an
// inline onclick="saveItem()" with no await and no catch, so anything it
// threw became an unhandled promise rejection — which shows the user
// nothing at all. Everything below the try/catch now runs ONLY when every
// write actually succeeded.
async function saveItem() {
  if (!state.currentItem) return;

  // Project rule #5: any save gets a flag guard that stops it firing twice
  // however it is triggered. This is a data bug, not a UI nicety — on the
  // Sold path a second run appends a SECOND sale row for one sale.
  if (window._saveItemBusy) return;
  window._saveItemBusy = true;
  const _btn = document.getElementById('fc-save-btn');
  const _btnLabel = _btn ? _btn.textContent : '';
  if (_btn) { _btn.disabled = true; _btn.textContent = 'Saving…'; }

  try {
    // v0.9.1267 (R3): a false return means a whole-row write was refused
    // because that row no longer holds this item. The user has already been
    // shown "that row moved — refresh and try again", so say nothing more —
    // but do NOT fall through to the success tail below, which closes the
    // dialog and ticks. The item was not updated. Everything they typed stays
    // on screen, exactly as it does when a write throws.
    if ((await _saveItemWrites()) === false) return;
  } catch (e) {
    // Stop here: the dialog stays open with everything the user typed still
    // in it, and no checkmark appears. rrSaveError is the one reader that
    // turns a raw failure into words a collector understands — "you have
    // been signed out", "no connection" — and every other save in the app
    // already goes through it.
    console.error('saveItem:', e);
    showToast((typeof rrSaveError === 'function')
      ? rrSaveError(e, 'this item')
      : 'Could not save this item. Please try again.', 5000, true);
    return;
  } finally {
    window._saveItemBusy = false;
    if (_btn) { _btn.disabled = false; _btn.textContent = _btnLabel; }
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
  const _syncDelay = window.IS_MOBILE_UA ? 3000 : 1500;   // v0.9.699
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
// ── v0.9.1449 (Brad): "we need a button to add it to our want list." The
// catalog's Do-you-own-it prompt could file an item into the collection but
// not onto the Want List — the want wizard existed, this prompt just had no
// door into it. Opens it pre-filled with this exact row (number, variation,
// matched item) and lands straight on the priority question — the same
// shape addSetToWantList has used for sets all along.
function addItemToWantList(idx) {
  const item = state.masterData[idx];
  if (!item) return;
  // v0.9.1451 (Brad: "want list button is there, but doesn't fire"): the
  // wizard's modal is built lazily by _buildWizardModal() — openWizard always
  // calls it, this door didn't, so with no wizard opened earlier in the
  // session there was nothing to open. Same offline/read-only guards as
  // openWizard, for the same reasons.
  if (window._offlineMode) { if (typeof showToast === 'function') showToast("You're offline — adding to your Want List needs a connection", 4000, true); return; }
  if (window._readOnlyMode) { if (typeof showToast === 'function') showToast('Your trial has ended — subscribe to keep adding items', 4000, true); return; }
  if (typeof _buildWizardModal === 'function') _buildWizardModal();
  const _activePg = document.querySelector('.page.active');
  const _returnPage = window._rrLastPage || (_activePg ? _activePg.id.replace('page-', '') : 'browse');
  wizard = {
    step: 0, tab: 'want',
    data: {
      tab: 'want',
      itemNum: item.itemNum,
      variation: item.variation || '',
      _itemGrouping: 'single',
      _returnPage: _returnPage
    },
    steps: [],
    matchedItem: item
  };
  wizard.steps = getSteps('want');
  // The row IS the identification — skip the steps that would re-ask it.
  const autoSkip = new Set(['itemNumGrouping', 'itemPicker', 'variation', 'tenderMatch']);
  while (wizard.step < wizard.steps.length) {
    const curStep = wizard.steps[wizard.step];
    if (!autoSkip.has(curStep.id)) break;
    wizard.step++;
  }
  document.getElementById('wizard-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
  renderWizardStep();
}

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
    <div class="rr-card" style="border-color:var(--accent3)">
      <div style="font-size:0.72rem;font-weight:700;letter-spacing:0.1em;color:var(--accent3);text-transform:uppercase;margin-bottom:0.5rem">Add Partner(s) to Want List?</div>
      <div style="font-size:0.9rem;color:var(--text-mid);margin-bottom:1rem;line-height:1.4">${promptText}</div>
      <div style="margin-bottom:1rem">${checkboxRows}</div>
      <div style="display:flex;gap:0.5rem;justify-content:flex-end">
        <button id="wpc-skip" style="padding:0.45rem 1rem;border-radius:7px;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body);font-size:0.82rem;cursor:pointer">Skip</button>
        <button id="wpc-add" style="padding:0.45rem 1.1rem;border-radius:7px;border:none;background:var(--accent3);color:#fff;font-family:var(--font-body);font-size:0.82rem;font-weight:600;cursor:pointer">Add Selected</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  if (window.BackStack && BackStack.wire) BackStack.wire(overlay); // v0.9.806 TODO-012: device Back closes this pop-up

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
        const row = [c.itemNum, '', priority || 'Medium', maxPrice || '', notes || '', ((typeof _brandOfItem === 'function' && _brandOfItem(c.itemNum)) || _getEraManufacturer())];
        // Want-Upgrade combined: append partner 9-col row with List Type='Want'.
        const _wuPartnerRow = [row[0], row[1], 'Want', row[2], row[3], '', '', row[4], row[5]];
        const _wuPartnerApRow = (await sheetsAppend(state.personalSheetId, 'Want-Upgrade List!A:I', [_wuPartnerRow])) || 0;   // v0.9.1196
        // Bugfix 2026-04-14: optimistically add partner to state.wantData so the
        // Want List table shows the new partners immediately instead of waiting
        // for the 1.2s refresh. Session 102 observed partners not appearing.
        const pKey = `${c.itemNum}|`;
        if (!state.wantData[pKey]) {
          state.wantData[pKey] = {
            row: _wuPartnerApRow,   // v0.9.1196: the REAL row from the append
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





// ══ v0.9.1492 (Brad: "need a way to edit the want list items, and the for
// sale price") ═══════════════════════════════════════════════════════════
// One tiny overlay, two savers. Both write through rrVerifiedRowUpdate —
// the same moved-row guard every other sheet write uses (v1292 lesson:
// nine columns at a remembered row number, unguarded, is how entries get
// silently overwritten).
function _rrMiniEdit(title, fields, onSave) {
  var old = document.getElementById('rr-mini-edit'); if (old) old.remove();
  var d = document.createElement('div');
  d.id = 'rr-mini-edit';
  d.style.cssText = 'position:fixed;inset:0;z-index:100010;background:rgba(0,0,0,0.65);display:flex;align-items:center;justify-content:center;padding:1rem';
  var inner = '<div class="rr-card" style="min-width:280px;max-width:360px;color:var(--text);font-family:var(--font-body)">'
    + '<div style="font-family:var(--font-head);font-size:1rem;font-weight:700;margin-bottom:0.7rem">' + String(title).replace(/</g, '&lt;') + '</div>';
  fields.forEach(function (f) {
    inner += '<label style="display:block;font-size:0.72rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.2rem">' + f.label + '</label>';
    if (f.type === 'select') {
      inner += '<select id="rrme-' + f.key + '" style="width:100%;padding:0.55rem;border-radius:8px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);margin-bottom:0.6rem">'
        + f.options.map(function (o) { return '<option value="' + o + '"' + (String(f.value) === o ? ' selected' : '') + '>' + o + '</option>'; }).join('')
        + '</select>';
    } else {
      inner += '<input id="rrme-' + f.key + '" type="number" ' + (f.min != null ? 'min="' + f.min + '" max="' + f.max + '"' : 'min="0" step="0.01"') + ' value="' + String(f.value == null ? '' : f.value).replace(/"/g, '') + '" style="width:100%;box-sizing:border-box;padding:0.55rem;border-radius:8px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);margin-bottom:0.6rem">';
    }
  });
  inner += '<div style="display:flex;gap:0.5rem;margin-top:0.3rem">'
    + '<button id="rrme-cancel" style="flex:1;padding:0.6rem;border-radius:8px;border:1.5px solid var(--border);background:none;color:var(--text-mid);cursor:pointer;font-family:var(--font-body)">Cancel</button>'
    + '<button id="rrme-save" style="flex:2;padding:0.6rem;border-radius:8px;border:none;background:var(--accent);color:#fff;font-weight:700;cursor:pointer;font-family:var(--font-body)">Save</button>'
    + '</div></div>';
  d.innerHTML = inner;
  document.body.appendChild(d);
  d.addEventListener('click', function (e) { if (e.target === d) d.remove(); });
  document.getElementById('rrme-cancel').onclick = function () { d.remove(); };
  document.getElementById('rrme-save').onclick = function () {
    var vals = {};
    fields.forEach(function (f) { var el = document.getElementById('rrme-' + f.key); vals[f.key] = el ? el.value : ''; });
    var btn = document.getElementById('rrme-save');
    btn.disabled = true; btn.textContent = 'Saving\u2026';
    Promise.resolve(onSave(vals)).then(function (ok) {
      if (ok !== false) d.remove();
      else { btn.disabled = false; btn.textContent = 'Save'; }
    }).catch(function () { btn.disabled = false; btn.textContent = 'Save'; });
  };
}

window._wantEditOpen = function () {
  var u = window._wantEditCur;
  if (!u || !u.row) { showToast('Could not find this want entry \u2014 refresh and try again', 3000, true); return; }
  _rrMiniEdit('Edit want details \u2014 ' + (u.itemNum || ''), [
    { key: 'cond', label: 'Condition target (1-10)', value: u.targetCondition || '', min: 1, max: 10 },
    { key: 'pri', label: 'Priority', type: 'select', options: ['High', 'Medium', 'Low'], value: u.priority || 'Medium' },
    { key: 'price', label: 'Max price ($)', value: (u.expectedPrice || u.maxPrice || '') },
  ], async function (v) {
    // Cols (comment at the transfer writer): A Item, B Var, C List Type,
    // D Priority, E Target Price, F Target Condition, G Upgrading Inv ID
    // (PRESERVED), H Notes, I Manufacturer.
    var row = [u.itemNum || '', u.variation || '', u.listType || 'Want',
      v.pri || 'Medium', v.price || '', v.cond || '',
      u.inventoryId || u.upgradingInventoryId || '', u.notes || '', u.manufacturer || 'Lionel'];
    var okW = await rrVerifiedRowUpdate(state.personalSheetId, 'Want-Upgrade List', u.row,
      'Want-Upgrade List!A' + u.row + ':I' + u.row, [row],
      { num: u.itemNum || '', invId: u.inventoryId || '' }, 'Want list');
    if (!okW) return false;
    u.priority = v.pri; u.targetCondition = v.cond;
    u.expectedPrice = v.price; u.maxPrice = v.price;
    showToast('\u2713 Want details saved', 2200);
    try { if (typeof _wantViewDetail === 'function') _wantViewDetail(u.itemNum, u.variation || ''); } catch (e) {}
    return true;
  });
};

window._fsEditPrice = function () {
  var fs = window._fsEditCur;
  if (!fs || !fs.row) { showToast('Could not find this sale listing \u2014 refresh and try again', 3000, true); return; }
  _rrMiniEdit('Edit asking price \u2014 ' + (fs.itemNum || ''), [
    { key: 'price', label: 'Asking price ($)', value: fs.askingPrice || '' },
  ], async function (v) {
    var p = parseFloat(v.price);
    if (!p || p <= 0) { showToast('Enter a price above 0', 2500, true); return false; }
    // Cols A:J — same shape the variation-sync writer uses.
    var row = [fs.itemNum || '', fs.variation || '', fs.condition || '', String(p),
      fs.dateListed || '', fs.notes || '', fs.originalPrice || '', fs.estWorth || '',
      fs.inventoryId || '', fs.manufacturer || ''];
    var okF = await rrVerifiedRowUpdate(state.personalSheetId, 'For Sale', fs.row,
      'For Sale!A' + fs.row + ':J' + fs.row, [row],
      { num: fs.itemNum || '', invId: fs.inventoryId || '' }, 'For Sale list');
    if (!okF) return false;
    fs.askingPrice = String(p);
    var sp = document.getElementById('fs-price-span');
    if (sp) sp.textContent = _currencySymbol() + p.toLocaleString();
    showToast('\u2713 Asking price updated', 2200);
    return true;
  });
};
