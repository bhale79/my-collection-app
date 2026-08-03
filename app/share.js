// ═══════════════════════════════════════════════════════════════
// SHARE — Select items from Collection, Want List, or For Sale
// and generate a PDF or Drive link to share via email/text.
// Loaded after app.js. Depends on state, sheetsGet, driveRequest.
// ═══════════════════════════════════════════════════════════════

// ── Share state ──────────────────────────────────────────────────
var _shareMode   = false;
var _shareSource = ''; // 'collection' | 'want' | 'forsale'
var _shareItems  = {}; // key -> item data
var _shareDataMap = {}; // key -> item data (populated by page renderers)

// ── Enter / Exit selection mode ──────────────────────────────────
function startShareMode(source) {
  _shareMode   = true;
  _shareSource = source;
  _shareItems  = {};
  _renderShareBar();
  // v0.9.1006: drop the cached render signatures outright. The token above
  // already covers this, but selection mode is worth two lines of insurance
  // — a page with no checkboxes looks broken, not slow.
  try { window._rrBrowseSig = null; window._rrCollPageSig = null; } catch (e) {}

  // Rebuild the current page so checkboxes appear
  if (source === 'collection') { renderBrowse(); }
  else if (source === 'want')  { buildWantPage(); }
  else if (source === 'upgrade') { if (typeof buildUpgradePage === 'function') buildUpgradePage(); }
  else if (source === 'forsale') { buildForSalePage(); }
}

function cancelShareMode() {
  var prevSource = _shareSource;
  _shareMode   = false;
  _shareSource = '';
  _shareItems  = {};
  window._shareDataMap = {};
  var bar = document.getElementById('share-bottom-bar');
  if (bar) bar.remove();
  try { window._rrBrowseSig = null; window._rrCollPageSig = null; } catch (e) {}   // v0.9.1006

  // Rebuild whichever page is currently active
  var activePage = document.querySelector('.page.active');
  if (!activePage) return;
  var pid = activePage.id;
  if (pid === 'page-browse')       renderBrowse();
  else if (pid === 'page-want')    buildWantPage();
  else if (pid === 'page-upgrade') { if (typeof buildUpgradePage === 'function') buildUpgradePage(); }
  else if (pid === 'page-forsale') buildForSalePage();
}

// ── Toggle item selection ─────────────────────────────────────────
function toggleShareItem(key) {
  var itemData = window._shareDataMap && window._shareDataMap[key];
  if (!itemData) return;
  if (_shareItems[key]) {
    delete _shareItems[key];
  } else {
    if (Object.keys(_shareItems).length >= 10) {
      showToast('Maximum 10 items at a time', 2500, true);
      var cb = document.getElementById('share-cb-' + key);
      if (cb) cb.checked = false;
      return;
    }
    _shareItems[key] = itemData;
  }
  _renderShareBar();
  var card = document.getElementById('share-card-' + key);
  if (card) {
    card.style.outline = _shareItems[key] ? '2px solid #2ecc71' : 'none';
    card.style.background = _shareItems[key] ? 'rgba(46,204,113,0.08)' : '';
  }
  // Sync checkbox state
  var cb2 = document.getElementById('share-cb-' + key);
  if (cb2) cb2.checked = !!_shareItems[key];
}

// ── Floating bottom bar ───────────────────────────────────────────
function _renderShareBar() {
  var existing = document.getElementById('share-bottom-bar');
  if (existing) existing.remove();

  var count = Object.keys(_shareItems).length;
  var bar = document.createElement('div');
  bar.id = 'share-bottom-bar';
  bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:900;background:var(--surface2);border-top:1px solid var(--border);padding:0.75rem 1rem;display:flex;align-items:center;justify-content:space-between;gap:0.75rem;box-shadow:0 -4px 16px rgba(0,0,0,0.3)';

  bar.innerHTML =
    '<div style="display:flex;align-items:center;gap:0.6rem">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2ecc71" stroke-width="2"><polyline points="9,11 12,14 22,4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>' +
      '<span style="font-family:var(--font-body);font-size:0.9rem;color:var(--text)">' +
        '<strong style="color:#2ecc71">' + count + '</strong> item' + (count !== 1 ? 's' : '') + ' selected' +
        '<span style="color:var(--text-dim);font-size:0.78rem;margin-left:0.5rem">(max 10)</span>' +
      '</span>' +
    '</div>' +
    '<div style="display:flex;gap:0.5rem">' +
      // v0.9.1005 (Brad): first screen on the new .rr-btn system — one class,
      // one colour value; the outline is the text colour. Primary is filled,
      // secondary is a ghost.
      '<button onclick="cancelShareMode()" class="rr-btn rr-btn--quiet">Cancel</button>' +
      '<button onclick="openShareBuilder()" class="rr-btn fill"' + (count === 0 ? ' disabled' : '') + '>' +
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>' +
        'Share' +
      '</button>' +
    '</div>';

  document.body.appendChild(bar);
}

// ── Check if share mode is active (called by page builders) ──────
function isShareMode(source) {
  return _shareMode && _shareSource === source;
}

// v0.9.1006 (Brad's bug): the v0.9.985 render-skip guards in renderBrowse()
// and buildCollectionPage() compare a signature of everything a page is
// built from. Share mode was NOT in it — so turning selection ON changed
// nothing the signature could see, the rebuild was skipped, and no
// checkboxes appeared. Visiting a detail page and coming back invalidated
// the signature by another route, which is why they showed up then.
// One token, used by every guard, so this can't drift again.
function shareSigToken() {
  return _shareMode ? ('share:' + (_shareSource || '1')) : '';
}
if (typeof window !== 'undefined') { window.shareSigToken = shareSigToken; }

// ── Share Builder Modal ───────────────────────────────────────────
function openShareBuilder() {
  var count = Object.keys(_shareItems).length;
  if (count === 0) return;

  // Remove existing modal
  var ex = document.getElementById('share-builder-modal');
  if (ex) ex.remove();

  var modal = document.createElement('div');
  modal.id = 'share-builder-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:1100;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:1rem';

  modal.innerHTML =
    '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:1.5rem;width:100%;max-width:440px;max-height:90vh;overflow-y:auto">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem">' +
        '<div style="font-family:var(--font-head);font-size:1.2rem;color:var(--text)">Share ' + count + ' Item' + (count !== 1 ? 's' : '') + '</div>' +
        '<button onclick="document.getElementById(\'share-builder-modal\').remove()" style="background:none;border:none;color:var(--text-dim);font-size:1.4rem;cursor:pointer;line-height:1">✕</button>' +
      '</div>' +

      // Field picker
      '<div style="margin-bottom:1.25rem">' +
        '<div style="font-size:0.78rem;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-dim);margin-bottom:0.6rem">Include in share</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem">' +
          _shareFieldCheck('sf-itemnum', 'Item Number', true) +
          _shareFieldCheck('sf-vardesc', 'Variation Description', true) +
          _shareFieldCheck('sf-cond',    'Condition', true) +
          _shareFieldCheck('sf-box',     'Has Box', true) +
          _shareFieldCheck('sf-price',   'Asking / Est. Value', true) +
          _shareFieldCheck('sf-notes',   'Notes') +
        '</div>' +
        '<div style="margin-top:0.75rem">' +
          '<div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-dim);margin-bottom:0.4rem">Photos</div>' +
          '<label style="display:flex;align-items:center;gap:0.5rem;font-size:0.85rem;color:var(--text);margin-bottom:0.35rem;cursor:pointer"><input type="radio" name="rr-photomode" value="main" checked style="accent-color:var(--accent);width:1rem;height:1rem">Main photo only</label>' +
          '<label style="display:flex;align-items:center;gap:0.5rem;font-size:0.85rem;color:var(--text);cursor:pointer"><input type="radio" name="rr-photomode" value="all" style="accent-color:var(--accent);width:1rem;height:1rem">All photos of item</label>' +
          // v0.9.1303 (Brad): clickable full-size photos with an auto-expiring
          // link. The photos become viewable by anyone with the link until the
          // deadline (or until turned off in Collection Tools > Shared photos).
          '<label style="display:flex;align-items:center;gap:0.5rem;font-size:0.85rem;color:var(--text);margin-top:0.55rem;cursor:pointer"><input type="checkbox" id="sf-linkphotos" onchange="var r=document.getElementById(\'sf-linklife-row\');if(r)r.style.display=this.checked?\'\':\'none\'" style="accent-color:var(--accent);width:1rem;height:1rem">Clickable photos — tap a picture in the PDF to see it full size</label>' +
          '<div id="sf-linklife-row" style="display:none;margin:0.4rem 0 0 1.5rem">' +
            '<label style="font-size:0.8rem;color:var(--text-mid)">Links work for ' +
              '<select id="sf-linklife" style="margin-left:0.3rem;padding:0.3rem 0.5rem;border-radius:7px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.82rem">' +
                '<option value="86400000">1 day</option>' +
                '<option value="604800000" selected>1 week</option>' +
                '<option value="0">until I turn them off</option>' +
              '</select>' +
            '</label>' +
            '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.3rem">These photos become viewable by anyone with the link. End it anytime in Collection Tools &rsaquo; Shared photos.</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // Message
      '<div style="margin-bottom:1.25rem">' +
        '<div style="font-size:0.78rem;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-dim);margin-bottom:0.5rem">Add a message (optional)</div>' +
        '<textarea id="share-message" placeholder="e.g. Here are the items I mentioned…" rows="3" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.55rem 0.75rem;color:var(--text);font-family:var(--font-body);font-size:0.85rem;outline:none;resize:vertical;box-sizing:border-box"></textarea>' +
      '</div>' +

      // Action buttons
      '<div id="share-builder-actions" style="display:flex;flex-direction:column;gap:0.5rem">' +
        '<button onclick="if(typeof shareAsCards===\'function\')shareAsCards()" style="padding:0.65rem;border-radius:9px;border:none;background:#2ecc71;color:#fff;font-family:var(--font-body);font-weight:700;font-size:0.9rem;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.5rem">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>' +
          'Share as images' +
        '</button>' +
        '<button onclick="_doShare(\'pdf\')" style="padding:0.55rem;border-radius:9px;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body);font-weight:600;font-size:0.85rem;cursor:pointer">' +
          'Download as PDF instead' +
        '</button>' +
        // v0.9.1311 (Brad's email-route decision): one click builds the sheet,
        // parks it in his Drive (anyone with the link), and opens a Gmail
        // draft with the message and link pre-filled.
        '<button onclick="_doShare(\'gmail\')" style="padding:0.55rem;border-radius:9px;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body);font-weight:600;font-size:0.85rem;cursor:pointer">' +
          'Email a link to the sheet (Gmail)' +
        '</button>' +
      '</div>' +

      '<div id="share-progress" style="display:none;margin-top:1rem;text-align:center;font-size:0.85rem;color:var(--text-dim)"></div>' +
    '</div>';

  document.body.appendChild(modal);
  if (window.BackStack && BackStack.wire) BackStack.wire(modal); // v0.9.809 TODO-012: device Back closes this pop-up
}

function _shareFieldCheck(id, label, checked) {
  return '<label style="display:flex;align-items:center;gap:0.5rem;padding:0.45rem 0.6rem;background:var(--surface2);border-radius:7px;cursor:pointer;font-size:0.83rem;color:var(--text)">' +
    '<input type="checkbox" id="' + id + '" ' + (checked ? 'checked' : '') + ' style="accent-color:var(--accent);width:1rem;height:1rem">' +
    label +
    '</label>';
}

// v0.9.1150 (beta punch list 5.2): this read `#sf-photo`, a checkbox that was
// REPLACED by the `rr-photomode` radio pair and never re-wired. The element was
// gone, so `photo` was permanently false, so the photo-fetch loop never ran and
// every shared PDF came out with no pictures at all — silently, because the
// radios still sat there promising otherwise. Read the radios that actually
// exist, and honour "All photos of item" instead of quietly treating it as one.
function _getShareFields() {
  var _pm = document.querySelector('input[name="rr-photomode"]:checked');
  var _mode = _pm ? _pm.value : (document.querySelector('input[name="rr-photomode"]') ? 'main' : '');
  var _lp = document.getElementById('sf-linkphotos');
  var _ll = document.getElementById('sf-linklife');
  return {
    photo:     !!_mode,
    allPhotos: _mode === 'all',
    linkPhotos: !!(_lp && _lp.checked),
    linkLifeMs: _ll ? (parseInt(_ll.value, 10) || 0) : 0,
    itemnum: document.getElementById('sf-itemnum') ? document.getElementById('sf-itemnum').checked : true,
    vardesc: document.getElementById('sf-vardesc') ? document.getElementById('sf-vardesc').checked : true,
    cond:    document.getElementById('sf-cond')    ? document.getElementById('sf-cond').checked    : true,
    box:     document.getElementById('sf-box')     ? document.getElementById('sf-box').checked     : true,
    price:   document.getElementById('sf-price')   ? document.getElementById('sf-price').checked   : true,
    notes:   document.getElementById('sf-notes')   ? document.getElementById('sf-notes').checked   : false,
  };
}

// v0.9.1302 (Brad's empty sales sheet): a For Sale share entry carries the
// SALE record, but the photo lives on the COLLECTION record. The For Sale
// page and the PNG-card builder both bridged the two; the PDF builder never
// did — so every For Sale PDF came out with no pictures. ONE resolver now,
// used by every share flow, so this can't fork again.
function rrSharePdOf(it) {
  if (it && it.pd) return it.pd;
  var inv = it && it.fs && it.fs.inventoryId;
  if (inv && typeof state !== 'undefined' && state.personalData && state.personalData[inv]) return state.personalData[inv];
  return {};
}
if (typeof window !== 'undefined') { window.rrSharePdOf = rrSharePdOf; }

// ══ v0.9.1303 (Brad): clickable full-size photos with an auto-expiring link ══
// "lets put a autotimer on the link so that the app will at a certain time
//  unshare. Let the user set it to some presets, like 1 day, 1 week, or
//  manual with the use of the unshare button"
// The deadline lives ON the photo file in Drive (appProperties rrShared /
// rrShareExp — the same hidden-metadata trick the Photo Inbox uses), so it
// follows the photo across devices. ONE stamp; the share flow writes it, the
// sweeper and the Shared Photos page read it. Google can't expire an
// anyone-with-link permission by itself, so the app enforces the deadline:
// the sweeper runs at every app start and un-shares anything past due.

// Open one photo up: anyone with the link can view, stamped with its
// deadline (0 = until turned off). Returns true only if BOTH steps landed —
// callers only draw a link for a photo this returned true for.
async function rrShareOpenPhoto(fileId, expiresAtMs) {
  try {
    await driveRequest('POST', '/files/' + fileId + '/permissions', { role: 'reader', type: 'anyone' });
    await driveRequest('PATCH', '/files/' + fileId, { appProperties: { rrShared: '1', rrShareExp: String(expiresAtMs || 0) } });
    return true;
  } catch (e) { return false; }
}

// Every photo the app has opened up (the Shared Photos page reads this).
async function rrSharedPhotosList() {
  var q = encodeURIComponent("appProperties has { key='rrShared' and value='1' } and trashed=false");
  var r = await driveRequest('GET', '/files?q=' + q + '&fields=files(id,name,appProperties)&pageSize=1000&spaces=drive');
  return (r && r.files) || [];
}

// Put the lock back on: remove every anyone-with-link permission and clear
// the stamp. Old links die the moment this lands.
async function rrUnsharePhoto(fileId) {
  var perms = await driveRequest('GET', '/files/' + fileId + '/permissions?fields=permissions(id,type)');
  var _all = (perms && perms.permissions) || [];
  for (var i = 0; i < _all.length; i++) {
    if (_all[i].type === 'anyone') await driveRequest('DELETE', '/files/' + fileId + '/permissions/' + _all[i].id);
  }
  await driveRequest('PATCH', '/files/' + fileId, { appProperties: { rrShared: null, rrShareExp: null } });
}

// The autotimer: runs at app start (and before the Shared Photos page
// draws). Anything past its deadline gets un-shared right then.
async function rrSweepExpiredShares() {
  try {
    var files = await rrSharedPhotosList();
    var now = Date.now(), n = 0;
    for (var i = 0; i < files.length; i++) {
      var exp = parseInt((files[i].appProperties || {}).rrShareExp || '0', 10);
      if (exp > 0 && exp <= now) {
        try { await rrUnsharePhoto(files[i].id); n++; } catch (e) { /* next start retries */ }
      }
    }
    if (n) showToast('Photo links expired — ' + n + ' photo' + (n > 1 ? 's' : '') + ' un-shared', 3500);
    return n;
  } catch (e) { return 0; }
}
if (typeof window !== 'undefined') {
  window.rrShareOpenPhoto = rrShareOpenPhoto;
  window.rrSharedPhotosList = rrSharedPhotosList;
  window.rrUnsharePhoto = rrUnsharePhoto;
  window.rrSweepExpiredShares = rrSweepExpiredShares;
}

// ── Main share action ─────────────────────────────────────────────
async function _doShare(mode) {
  var fields  = _getShareFields();
  var message = (document.getElementById('share-message') || {}).value || '';
  var items   = Object.values(_shareItems);

  var prog = document.getElementById('share-progress');
  var acts = document.getElementById('share-builder-actions');
  if (prog) { prog.style.display = 'block'; prog.textContent = 'Building your share sheet…'; }
  if (acts) acts.style.display = 'none';

  try {
    // Fetch photos if needed
    if (fields.photo) {
      if (prog) prog.textContent = 'Fetching photos (this may take a moment)…';
      // v0.9.1299 (Brad: audit "the speed at which it builds them"): photos
      // used to download strictly one at a time across the whole share. They
      // now fetch four ITEMS at a time (each item still capped at 1 main + 4
      // extras), which is where the wait actually was.
      var _done = 0;
      var _fetchOne = async function (it) {
        var _pd = rrSharePdOf(it);
        if (!(_pd && _pd.photoItem)) return;
        try {
          var photos = await driveGetFolderPhotos(_pd.photoItem);
          if (photos && photos.length > 0) {
            it._photoDataUrl = await _fetchPhotoAsDataUrl(photos[0].id);
            it._photoFileId = photos[0].id;   // v0.9.1303: for clickable links
            // "All photos of item" fetches the rest too, capped at 4 extras so
            // a 30-photo item can't turn one share into a multi-minute wait.
            if (fields.allPhotos && photos.length > 1) {
              it._photoExtras = [];
              it._photoExtraIds = [];
              for (var p = 1; p < photos.length && p <= 4; p++) {
                var _ex = await _fetchPhotoAsDataUrl(photos[p].id);
                if (_ex) { it._photoExtras.push(_ex); it._photoExtraIds.push(photos[p].id); }
              }
            }
          }
        } catch(e) { /* photo failed — skip gracefully */ }
        _done++;
        if (prog) prog.textContent = 'Fetching photos… (' + _done + '/' + items.length + ')';
      };
      var _queue = items.slice();
      while (_queue.length) {
        await Promise.all(_queue.splice(0, 4).map(_fetchOne));
      }

      // v0.9.1303 (Brad): clickable full-size photos. Each photo that will be
      // linked is opened up (anyone with the link can view) and stamped with
      // its deadline; the sweeper and the Shared Photos page read the SAME
      // stamp. A photo only becomes a link in the PDF if opening it up
      // SUCCEEDED — the sheet never carries a dead link.
      if (fields.linkPhotos) {
        if (prog) prog.textContent = 'Opening photo links…';
        var _exp = fields.linkLifeMs > 0 ? Date.now() + fields.linkLifeMs : 0;
        for (var _li = 0; _li < items.length; _li++) {
          var _lit = items[_li];
          if (_lit._photoFileId) {
            _lit._photoLinked = await rrShareOpenPhoto(_lit._photoFileId, _exp);
          }
          if (_lit._photoExtraIds && _lit._photoExtraIds.length) {
            _lit._photoExtrasLinked = [];
            for (var _le = 0; _le < _lit._photoExtraIds.length; _le++) {
              _lit._photoExtrasLinked.push(await rrShareOpenPhoto(_lit._photoExtraIds[_le], _exp));
            }
          }
        }
      }
    }

    if (prog) prog.textContent = 'Generating PDF…';
    var pdfBlob = await _buildPDF(items, fields, message);

    if (mode === 'pdf') {
      // Direct download
      var url = URL.createObjectURL(pdfBlob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'collection-share-' + new Date().toISOString().slice(0,10) + '.pdf';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      showToast('PDF downloaded', 2500);
      // v0.9.1302 (Brad): "need a back button so if i change my mind, i can
      // get the pdf with out having to click everything again." The builder
      // now STAYS open with the picks intact after every outcome — only the
      // ✕ here or Cancel on the bar ends it.
      if (prog) prog.textContent = 'PDF downloaded — your picks are kept, so you can share them another way too.';
      if (acts) acts.style.display = 'flex';

    } else if (mode === 'gmail') {
      // v0.9.1311 (Brad: Gmail compose route). The sheet goes to his Drive
      // with an anyone-with-link permission (same as the old share-link
      // flow), then a Gmail draft opens with the message and link in the
      // body. The draft opens from a FRESH click — an async upload eats the
      // original click's popup allowance, so a blocked window.open here
      // would look like "nothing happened".
      if (prog) prog.textContent = 'Uploading the sheet to your Google Drive…';
      var gLink = await _uploadShareToDrive(pdfBlob);
      var gSubj = (typeof _shareSource !== 'undefined' && _shareSource === 'forsale')
        ? 'Items for sale — The Rail Roster'
        : 'From my collection — The Rail Roster';
      var gBody = (message ? message + '\n\n' : '') + 'View the sheet here: ' + gLink;
      window._rrGmailBody = gBody;   // the copy-instead button reads this
      var gUrl = 'https://mail.google.com/mail/?view=cm&fs=1&su=' + encodeURIComponent(gSubj) + '&body=' + encodeURIComponent(gBody);
      if (prog) prog.style.display = 'none';
      if (acts) {
        if (typeof window._rrActsStash === 'function') window._rrActsStash(acts);
        acts.style.display = 'flex';
        acts.innerHTML =
          '<a href="' + gUrl + '" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;gap:0.5rem;padding:0.75rem;border-radius:9px;background:#2ecc71;color:#fff;font-family:var(--font-body);font-weight:700;font-size:0.95rem;text-decoration:none">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>' +
            'Open the Gmail draft' +
          '</a>' +
          '<button onclick="navigator.clipboard.writeText(window._rrGmailBody||\'\').then(function(){showToast(\'Copied — paste it into any email\')})" style="padding:0.55rem;border-radius:9px;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body);font-weight:600;font-size:0.85rem;cursor:pointer">' +
            'Copy the message + link instead' +
          '</button>' +
          '<div style="text-align:center;font-size:0.72rem;color:var(--text-dim)">The sheet lives in your Google Drive — anyone with the link can view it.</div>' +
          (typeof window._rrBackBtnHtml === 'function' ? window._rrBackBtnHtml() : '');
      }

    } else {
      // Upload to Drive and share link
      if (prog) prog.textContent = 'Uploading to your Google Drive…';
      var link = await _uploadShareToDrive(pdfBlob);
      if (prog) prog.textContent = 'Opening share sheet…';

      var shareData = {
        title: 'Rail Roster Share',
        text: message || 'Check out these items from my collection.',
        url: link,
      };

      if (navigator.share) {
        await navigator.share(shareData);
        showToast('Shared!', 2000);
      } else {
        // Fallback: copy link to clipboard
        await navigator.clipboard.writeText((message ? message + '\n\n' : '') + link);
        showToast('Link copied to clipboard', 3000);
      }
      // v0.9.1302: stay open with the picks intact (see the pdf branch note).
      if (prog) prog.textContent = 'Shared — your picks are kept in case you want the PDF too.';
      if (acts) acts.style.display = 'flex';
    }

  } catch(err) {
    // Backing out of the system share window isn't an error — just return
    // to the builder quietly, picks intact.
    if (err && err.name === 'AbortError') {
      if (prog) prog.style.display = 'none';
      if (acts) acts.style.display = 'flex';
      return;
    }
    console.error('Share error:', err);
    if (prog) prog.textContent = 'Something went wrong — please try again.';
    if (acts) acts.style.display = 'flex';
  }
}

// ── Fetch a Drive photo as a base64 data URL ──────────────────────
async function _fetchPhotoAsDataUrl(fileId) {
  var token = (typeof accessToken !== 'undefined' && accessToken) ? accessToken : localStorage.getItem('lv_token');
  if (!token) return null;
  var res = await fetch('https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media', {
    headers: { Authorization: 'Bearer ' + token }
  });
  if (!res.ok) return null;
  var blob = await res.blob();
  return new Promise(function(resolve) {
    var reader = new FileReader();
    reader.onload = function(e) { resolve(e.target.result); };
    reader.onerror = function() { resolve(null); };
    reader.readAsDataURL(blob);
  });
}

// ══ v0.9.1299 (Brad): TWO share intents, one sheet builder. ══════════════
// "there are two different things here to share. the look at what i got,
//  and the here is somehting i have to sale."
// The For Sale share wears a clean light sales-sheet skin; every other share
// keeps the collector look. Colors are jsPDF rgb triplets (the canvas/PDF
// bridge case NO_HARDCODED_COLORS.md phase 5 describes).
var RR_SHARE_SKINS = {
  collector: { headerBg:[15,18,32], headerTitle:[240,80,8], headerSub:[200,184,138],
               cardBg:[22,28,52], cardBorder:[42,53,96], num:[240,80,8],
               road:[248,232,192], field:[200,184,138], price:[212,168,67],
               msg:[248,232,192], title:'THE RAIL ROSTER', sub:'From my collection' },
  sale:      { headerBg:[247,240,220], headerTitle:[176,58,8], headerSub:[110,100,80],
               cardBg:[255,255,255], cardBorder:[208,200,182], num:[26,26,26],
               road:[96,90,78], field:[70,66,58], price:[176,58,8],
               msg:[70,66,58], title:'ITEMS FOR SALE', sub:'The Rail Roster' },
};

// ONE plan for a card: the same line list SIZES the card and DRAWS it, so a
// multi-line variation can never overlap the fields below it again — the
// v0.9.1299 bug was the height counting one line while jsPDF drew them all.
// `split` is doc.splitTextToSize bound to the doc (injected so tests can run
// this pure).
function rrShareCardPlan(vals, fields, split, photoPlanned, contentW) {
  var textW = photoPlanned ? contentW - 80 - 28 - 24 : contentW - 24;
  var rows = [];
  if (fields.itemnum) rows.push({ kind: 'num', h: 16 });
  if (vals.roadName)  rows.push({ kind: 'road', h: 14 });
  if (fields.vardesc && vals.varDesc) {
    var vl = split('Variation: ' + vals.varDesc, textW);
    rows.push({ kind: 'vardesc', lines: vl, h: vl.length * 11 + 2 });
  }
  if (fields.cond && vals.condition) rows.push({ kind: 'cond', h: 13 });
  if (fields.box && vals.hasBox)     rows.push({ kind: 'box', h: 13 });
  if (fields.price && vals.price)    rows.push({ kind: 'price', h: 13 });
  if (fields.notes && vals.notes) {
    var nl = split('Notes: ' + vals.notes, textW);
    rows.push({ kind: 'notes', lines: nl, h: nl.length * 11 + 2 });
  }
  var cardH = 20 + 16;
  for (var r = 0; r < rows.length; r++) cardH += rows[r].h;
  if (photoPlanned) cardH = Math.max(cardH, 100);
  return { rows: rows, cardH: cardH, textW: textW };
}
if (typeof window !== 'undefined') { window.rrShareCardPlan = rrShareCardPlan; window.RR_SHARE_SKINS = RR_SHARE_SKINS; }

// v0.9.1301: contain-fit a photo inside a box WITHOUT distorting it — the 54
// Ballast Tamper looked squished because every photo was stretched into a
// fixed square. Returns the draw size and the centering offsets inside the
// box. Pure, so the suite can exercise the math directly.
function rrShareFitBox(iw, ih, boxW, boxH) {
  if (!(iw > 0) || !(ih > 0)) return { w: boxW, h: boxH, dx: 0, dy: 0 };
  var s = Math.min(boxW / iw, boxH / ih);
  var w = iw * s, h = ih * s;
  return { w: w, h: h, dx: (boxW - w) / 2, dy: (boxH - h) / 2 };
}
if (typeof window !== 'undefined') { window.rrShareFitBox = rrShareFitBox; }

// ── Build PDF using jsPDF ─────────────────────────────────────────
async function _buildPDF(items, fields, message) {
  // jsPDF is loaded from CDN in index.html
  var doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'letter' });
  var pageW = doc.internal.pageSize.getWidth();
  var margin = 36;
  var contentW = pageW - margin * 2;
  var y = margin;

  // v0.9.1299: the For Sale share is a sales sheet, everything else is the
  // collector look. One builder, two skins.
  var skin = RR_SHARE_SKINS[(typeof _shareSource !== 'undefined' && _shareSource === 'forsale') ? 'sale' : 'collector'];

  // ── Header ──
  doc.setFillColor(skin.headerBg[0], skin.headerBg[1], skin.headerBg[2]);
  doc.rect(0, 0, pageW, 56, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(skin.headerTitle[0], skin.headerTitle[1], skin.headerTitle[2]);
  doc.text(skin.title, margin, 36);
  doc.setFontSize(9);
  doc.setTextColor(skin.headerSub[0], skin.headerSub[1], skin.headerSub[2]);
  doc.text(skin.sub + '  ·  ' + new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' }), margin, 50);

  y = 72;

  // ── Message ──
  if (message && message.trim()) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(skin.msg[0], skin.msg[1], skin.msg[2]);
    var msgLines = doc.splitTextToSize(message.trim(), contentW);
    doc.text(msgLines, margin, y);
    y += msgLines.length * 14 + 12;
  }

  // ── Items ──
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var master = it.master || {};
    var pd     = it.pd     || {};
    var want   = it.want   || {};
    var fs     = it.fs     || {};

    // Gather field values
    var itemNum = it.itemNum || '';
    var varNum  = it.variation || '';
    var varDesc = master.varDesc || '';
    var roadName = master.roadName || pd.roadName || '';
    var itemType = master.itemType || pd.itemType || '';
    var condition = pd.condition || fs.condition || '';
    var hasBox  = pd.hasBox || '';
    var price   = fs.askingPrice ? (_currencySymbol() + parseFloat(fs.askingPrice).toLocaleString()) : (pd.userEstWorth ? 'Est. $' + parseFloat(pd.userEstWorth).toLocaleString() : (want.maxPrice ? 'Max $' + parseFloat(want.maxPrice).toLocaleString() : ''));
    var notes   = pd.notes || fs.notes || want.notes || '';

    // v0.9.1299: the ONE plan sizes the card AND drives the drawing below —
    // the overlap bug was this estimate counting a multi-line variation as
    // one line while jsPDF drew them all.
    var _photoPlanned = !!(fields.photo && it._photoDataUrl);
    var _plan = rrShareCardPlan(
      { roadName: roadName, varDesc: varDesc, condition: condition, hasBox: hasBox, price: price, notes: notes },
      fields, function (t, w) { return doc.splitTextToSize(t, w); }, _photoPlanned, contentW);
    var cardH = _plan.cardH;
    // Extra photos ride in a strip under the text, so the main-photo layout
    // above is untouched for the ordinary "Main photo only" share.
    var _extras = (fields.allPhotos && it._photoExtras && it._photoExtras.length) ? it._photoExtras : null;
    if (_extras) cardH += 52;

    // Page break check
    if (y + cardH > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }

    // Card background
    doc.setFillColor(skin.cardBg[0], skin.cardBg[1], skin.cardBg[2]);
    doc.roundedRect(margin, y, contentW, cardH, 6, 6, 'F');
    doc.setDrawColor(skin.cardBorder[0], skin.cardBorder[1], skin.cardBorder[2]);
    doc.roundedRect(margin, y, contentW, cardH, 6, 6, 'S');

    var textX = margin + 12;
    var textW = contentW - 24;

    // Photo — the 80×80 slot stays where it was (text layout unchanged), but
    // the photo is contain-fitted inside it so nothing gets squished.
    if (fields.photo && it._photoDataUrl) {
      try {
        var boxW = 80, boxH = 80;
        var boxX = margin + contentW - boxW - 12;
        var boxY = y + (cardH - boxH) / 2;
        var _fit = { w: boxW, h: boxH, dx: 0, dy: 0 };
        try {
          var _props = doc.getImageProperties(it._photoDataUrl);
          _fit = rrShareFitBox(_props.width, _props.height, boxW, boxH);
        } catch (eP) { /* can't measure — draw square as before */ }
        doc.addImage(it._photoDataUrl, 'JPEG', boxX + _fit.dx, boxY + _fit.dy, _fit.w, _fit.h, '', 'FAST');
        // v0.9.1303: clickable full-size photo — only when opening it up
        // succeeded, so the sheet never carries a dead link.
        if (it._photoLinked && it._photoFileId) {
          doc.link(boxX + _fit.dx, boxY + _fit.dy, _fit.w, _fit.h, { url: 'https://drive.google.com/file/d/' + it._photoFileId + '/view' });
        }
        textW = contentW - boxW - 28;
      } catch(e) { /* image failed, skip */ }
    }

    var cy = y + 14;

    // v0.9.1299: the plan's rows draw in order, each advancing by the SAME
    // height the estimate counted — overlap is impossible by construction.
    for (var _r = 0; _r < _plan.rows.length; _r++) {
      var row = _plan.rows[_r];
      if (row.kind === 'num') {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(skin.num[0], skin.num[1], skin.num[2]);
        doc.text('No. ' + itemNum + (varNum ? '  ·  Var. ' + varNum : ''), textX, cy);
      } else if (row.kind === 'road') {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(skin.road[0], skin.road[1], skin.road[2]);
        doc.text(roadName + (itemType ? '  ·  ' + itemType : ''), textX, cy);
      } else if (row.kind === 'price') {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(skin.price[0], skin.price[1], skin.price[2]);
        doc.text(price, textX, cy);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(skin.field[0], skin.field[1], skin.field[2]);
        if (row.kind === 'vardesc' || row.kind === 'notes') doc.text(row.lines, textX, cy);
        else if (row.kind === 'cond') doc.text('Condition: ' + condition + '/10', textX, cy);
        else if (row.kind === 'box') doc.text('Has Box: ' + hasBox, textX, cy);
      }
      cy += row.h;
    }

    // Extra photos ("All photos of item") — a row of thumbnails along the
    // bottom of the card. Only drawn when the user asked for all photos AND
    // the item actually has more than one, so nothing shifts otherwise.
    if (_extras) {
      var _tw = 44, _tx = textX, _ty = y + cardH - _tw - 8;
      for (var _e = 0; _e < _extras.length; _e++) {
        try {
          var _tFit = { w: _tw, h: _tw, dx: 0, dy: 0 };
          try {
            var _tProps = doc.getImageProperties(_extras[_e]);
            _tFit = rrShareFitBox(_tProps.width, _tProps.height, _tw, _tw);
          } catch (eTP) {}
          doc.addImage(_extras[_e], 'JPEG', _tx + _tFit.dx, _ty + _tFit.dy, _tFit.w, _tFit.h, '', 'FAST');
          if (it._photoExtrasLinked && it._photoExtrasLinked[_e] && it._photoExtraIds && it._photoExtraIds[_e]) {
            doc.link(_tx + _tFit.dx, _ty + _tFit.dy, _tFit.w, _tFit.h, { url: 'https://drive.google.com/file/d/' + it._photoExtraIds[_e] + '/view' });
          }
        } catch (eT) {}
        _tx += _tw + 6;
      }
    }

    y += cardH + 10;
  }

  // Footer
  var pageCount = doc.internal.getNumberOfPages();
  for (var p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(106, 94, 72);
    doc.text('Page ' + p + ' of ' + pageCount, pageW / 2, doc.internal.pageSize.getHeight() - 18, { align: 'center' });
  }

  return doc.output('blob');
}

// ── Upload PDF to Drive and return shareable link ─────────────────
async function _uploadShareToDrive(pdfBlob) {
  // Get token from localStorage — accessToken in app.js is not accessible from share.js
  var token = localStorage.getItem('lv_token');
  if (!token) throw new Error('Not signed in — please sign in and try again');

  // Ensure vault folder exists
  await driveEnsureSetup();
  var folderId = (driveCache && driveCache.vaultId) ? driveCache.vaultId : 'root';

  var fileName = 'Collection Share ' + new Date().toLocaleDateString('en-US', {year:'numeric',month:'2-digit',day:'2-digit'}).replace(/\//g,'-') + '.pdf';

  // Step 1: Create file metadata
  var metaRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: fileName, mimeType: 'application/pdf', parents: [folderId] }),
  });
  if (!metaRes.ok) throw new Error('Drive create failed: ' + metaRes.status);
  var metaData = await metaRes.json();
  var fileId = metaData.id;

  // Step 2: Upload PDF content
  var uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files/' + fileId + '?uploadType=media', {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/pdf' },
    body: pdfBlob,
  });
  if (!uploadRes.ok) throw new Error('Drive upload failed: ' + uploadRes.status);

  // Step 3: Make publicly viewable (anyone with link)
  await fetch('https://www.googleapis.com/drive/v3/files/' + fileId + '/permissions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  });

  return 'https://drive.google.com/file/d/' + fileId + '/view';
}


// ── Share ONE for-sale listing (v0.9.1022, Brad — phone card button) ────
// Enters the existing for-sale share mode with just this item selected and
// opens the share builder. Same code path as picking one item by hand.
function _fsShareOne(key) {
  try {
    if (typeof startShareMode !== 'function') return;
    startShareMode('forsale');          // rebuilds the page → fills _shareDataMap
    if (window._shareDataMap && window._shareDataMap[key]) {
      if (typeof toggleShareItem === 'function') toggleShareItem(key);
    }
    if (typeof openShareBuilder === 'function') openShareBuilder();
  } catch (e) { console.warn('[share one]', e); }
}
if (typeof window !== 'undefined') window._fsShareOne = _fsShareOne;
