// ═══════════════════════════════════════════════════════════════
// photo-inbox.js — Photo Inbox ("Lazy Mode" Phase 1) — v0.9.879
//
// SELF-CONTAINED & REMOVABLE (same rule as show-mode.js):
//   • This file is the ENTIRE feature. To remove it, delete the
//     <script src="photo-inbox.js"> tag from index.html, remove the
//     sw.js precache line, and bump versions.
//   • Storage: one Drive folder "Photo Inbox" inside the app's vault
//     folder (existing Drive scope — no new Google permissions).
//   • Touches other modules only by CALLING public entry points
//     (driveEnsureSetup, driveFindOrCreateFolder, driveUploadFile,
//      driveMoveFileToFolder, driveEnsureItemFolder, driveRequest,
//      loadDriveThumb, showPage, showToast, openWizard, sheetsUpdate,
//      personalColLetter, baseItemNum) and by injecting its sidebar
//     button after buildDashboard (show-mode's pattern).
//
// Phase 1 (this file): desktop inbox page — drag-drop / browse import,
//   grouped tiles (group tag in filename, ready for phone Quick
//   Capture's "multiple per item + Next Item" mode), multi-select,
//   triage: Assign to item number… (moves photos into the item's
//   Drive folder, repairs/sets the sheet's photo link, offers the Add
//   wizard for numbers not in the collection yet) and Discard (Drive
//   trash — recoverable for 30 days).
// Phase 2 (later): phone Quick Capture. Phase 3: batch AI identify.
//
// FILENAME CONVENTION (the grouping contract with Phase 2):
//   "INBOX <uploadTs> g<groupId> <original name>"
//   Tiles with the same g<groupId> render as ONE stack and triage
//   as one item. Desktop drops get one group per file.
// ═══════════════════════════════════════════════════════════════

(function () {
  'use strict';

  var FID_KEY = 'rr_inbox_fid';
  var PENDING_KEY = 'rr_inbox_pending';   // { itemNum: folderLink } waiting for wizard save
  var _fid = null, _fidChecked = false;
  var _groups = [];          // [{ key, files:[{id,name,createdTime}] }]
  var _sel = {};             // groupKey -> true
  var _busy = false;

  // ── Drive folder ─────────────────────────────────────────────
  async function _folder() {
    if (_fid && _fidChecked) return _fid;
    var cached = localStorage.getItem(FID_KEY);
    if (cached) {
      try {
        var chk = await driveRequest('GET', '/files/' + cached + '?fields=id,trashed');
        if (chk && chk.id && !chk.trashed) { _fid = cached; _fidChecked = true; return _fid; }
      } catch (e) {}
      localStorage.removeItem(FID_KEY);
    }
    await driveEnsureSetup();
    _fid = await driveFindOrCreateFolder('Photo Inbox', driveCache.vaultId);
    localStorage.setItem(FID_KEY, _fid);
    _fidChecked = true;
    return _fid;
  }

  // ── Page skeleton ────────────────────────────────────────────
  function _ensurePage() {
    if (document.getElementById('page-photo-inbox')) return true;
    var anyPage = document.getElementById('page-dashboard');
    if (!anyPage || !anyPage.parentNode) return false;
    var pg = document.createElement('div');
    pg.className = 'page';
    pg.id = 'page-photo-inbox';
    pg.innerHTML =
      '<div class="page-title" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.35rem">' +
        '<span>Photo Inbox</span>' +
        '<span id="pin-count" style="font-size:0.8rem;color:var(--text-dim);font-family:var(--font-body);font-weight:400"></span>' +
      '</div>' +
      '<div style="font-size:0.8rem;color:var(--text-dim);line-height:1.5;margin-bottom:0.7rem">Drop photos anywhere below, or use Add photos. Click a photo to select it, then file the selection to an item number — or discard it. Photos snapped with Quick Capture on your phone land here too.</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin-bottom:0.8rem">' +
        '<button onclick="_pinPickFiles()" class="btn-primary" style="padding:0.5rem 0.9rem;border-radius:8px;border:none;font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">Add photos…</button>' +
        '<button onclick="_pinRefresh()" style="padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #8b8e94;background:rgba(139,142,148,0.12);color:#2980b9;font-family:var(--font-body);font-weight:600;font-size:0.82rem;cursor:pointer">Refresh</button>' +
        '<span style="flex:1"></span>' +
        '<span id="pin-selinfo" style="font-size:0.78rem;color:var(--text-dim)"></span>' +
        '<button id="pin-assign-btn" onclick="_pinAssign()" style="display:none;padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #8b8e94;background:rgba(139,142,148,0.12);color:#2980b9;font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">File to item…</button>' +
        '<button id="pin-discard-btn" onclick="_pinDiscard()" style="display:none;padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #8b8e94;background:rgba(139,142,148,0.12);color:#f05008;font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">Discard</button>' +
      '</div>' +
      '<div id="pin-status" style="display:none;font-size:0.8rem;color:var(--text-dim);margin-bottom:0.6rem"></div>' +
      '<div id="pin-drop" style="min-height:50vh;border:2px dashed var(--border);border-radius:12px;padding:0.8rem">' +
        '<div id="pin-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:0.6rem"></div>' +
        '<div id="pin-empty" style="display:none;text-align:center;padding:3rem 1rem;color:var(--text-dim)"><div style="font-size:0.95rem;margin-bottom:0.3rem;font-weight:600">Inbox is empty</div><div style="font-size:0.8rem">Drag photos here from any folder, or click Add photos.</div></div>' +
      '</div>' +
      '<input type="file" id="pin-file-input" accept="image/*" multiple style="display:none">';
    anyPage.parentNode.appendChild(pg);
    var drop = pg.querySelector('#pin-drop');
    ['dragenter', 'dragover'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); e.stopPropagation(); drop.style.borderColor = '#2980b9'; drop.style.background = 'rgba(41,128,185,0.06)'; });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); e.stopPropagation(); drop.style.borderColor = 'var(--border)'; drop.style.background = 'none'; });
    });
    drop.addEventListener('drop', function (e) {
      var files = Array.prototype.filter.call((e.dataTransfer || {}).files || [], function (f) { return /^image\//.test(f.type); });
      if (files.length) _upload(files);
      else showToast('No image files in that drop', 2500, true);
    });
    pg.querySelector('#pin-file-input').addEventListener('change', function () {
      var files = Array.prototype.slice.call(this.files || []);
      this.value = '';
      if (files.length) _upload(files);
    });
    return true;
  }

  function _status(msg) {
    var el = document.getElementById('pin-status');
    if (!el) return;
    if (msg) { el.style.display = 'block'; el.textContent = msg; }
    else el.style.display = 'none';
  }

  // ── Open the page ────────────────────────────────────────────
  window._pinGo = function (clickedEl) {
    if (!_ensurePage()) { showToast('App is still loading — try again in a moment', 2500, true); return; }
    showPage('photo-inbox', clickedEl || document.getElementById('nav-photo-inbox'));
    _pinRefresh();
  };

  // ── List + render ────────────────────────────────────────────
  window._pinRefresh = async function () {
    if (!_ensurePage()) return;
    _status('Loading inbox…');
    try {
      var fid = await _folder();
      var q = encodeURIComponent("'" + fid + "' in parents and mimeType contains 'image/' and trashed=false");
      var res = await driveRequest('GET', '/files?q=' + q + '&fields=files(id,name,createdTime)&orderBy=createdTime desc&pageSize=200');
      var files = (res && res.files) || [];
      // Group by the g<id> tag; untagged files are their own group.
      var map = {}, order = [];
      files.forEach(function (f) {
        var m = f.name.match(/^INBOX \d+ g(\S+)/);
        var key = m ? 'g' + m[1] : 'f' + f.id;
        if (!map[key]) { map[key] = { key: key, files: [] }; order.push(key); }
        map[key].files.push(f);
      });
      _groups = order.map(function (k) { return map[k]; });
      // Drop selections that no longer exist
      Object.keys(_sel).forEach(function (k) { if (!map[k]) delete _sel[k]; });
      _render();
      _status('');
    } catch (e) {
      console.error('[Inbox] refresh:', e);
      _status('Could not load the inbox — check your connection and try Refresh.');
    }
  };

  function _render() {
    var grid = document.getElementById('pin-grid'), empty = document.getElementById('pin-empty');
    if (!grid) return;
    var total = 0;
    grid.innerHTML = _groups.map(function (g) {
      total += g.files.length;
      var isSel = !!_sel[g.key];
      var chip = g.files.length > 1 ? '<div style="position:absolute;top:6px;right:6px;background:rgba(0,0,0,0.6);color:#fff;font-size:0.62rem;font-weight:700;padding:1px 7px;border-radius:9px">' + g.files.length + ' photos · 1 item</div>' : '';
      var when = '';
      try { when = new Date(g.files[0].createdTime).toLocaleDateString(); } catch (e) {}
      return '<div class="pin-tile" data-key="' + g.key + '" onclick="_pinToggle(\'' + g.key + '\')" style="position:relative;border-radius:10px;overflow:hidden;cursor:pointer;background:var(--surface2,#26262e);aspect-ratio:1;border:3px solid ' + (isSel ? '#2980b9' : 'transparent') + '">' +
        '<img loading="lazy" data-fid="' + g.files[0].id + '" style="width:100%;height:100%;object-fit:cover;object-position:center;display:block" alt="">' +
        chip +
        (isSel ? '<div style="position:absolute;top:6px;left:6px;width:20px;height:20px;border-radius:50%;background:#2980b9;color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700">✓</div>' : '') +
        '<div style="position:absolute;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);color:#ddd;font-size:0.6rem;padding:0.1rem 0.35rem">' + when + '</div>' +
        '</div>';
    }).join('');
    empty.style.display = _groups.length ? 'none' : 'block';
    var cnt = document.getElementById('pin-count');
    if (cnt) cnt.textContent = total ? (total + ' photo' + (total > 1 ? 's' : '') + ' waiting') : '';
    grid.querySelectorAll('img[data-fid]').forEach(function (img) {
      loadDriveThumb(img.getAttribute('data-fid'), img, img.parentElement);
    });
    _selInfo();
    _navBadge(total);
  }

  window._pinToggle = function (key) {
    if (_sel[key]) delete _sel[key]; else _sel[key] = true;
    _render();
  };

  function _selGroups() { return _groups.filter(function (g) { return _sel[g.key]; }); }

  function _selInfo() {
    var gs = _selGroups(), n = 0;
    gs.forEach(function (g) { n += g.files.length; });
    var info = document.getElementById('pin-selinfo');
    var ab = document.getElementById('pin-assign-btn'), db = document.getElementById('pin-discard-btn');
    if (info) info.textContent = n ? (n + ' photo' + (n > 1 ? 's' : '') + ' selected') : '';
    if (ab) ab.style.display = n ? '' : 'none';
    if (db) db.style.display = n ? '' : 'none';
  }

  // ── Import ───────────────────────────────────────────────────
  window._pinPickFiles = function () {
    var inp = document.getElementById('pin-file-input');
    if (inp) inp.click();
  };

  async function _upload(files) {
    if (_busy) { showToast('Still working on the last batch…', 2500, true); return; }
    _busy = true;
    try {
      var fid = await _folder();
      var ts = new Date().getTime();
      for (var i = 0; i < files.length; i++) {
        _status('Uploading ' + (i + 1) + ' of ' + files.length + '…');
        var f = files[i];
        var safe = (f.name || 'photo.jpg').replace(/[^\w.\- ]+/g, '').slice(-60);
        // Desktop drops: one group per file (phone capture will reuse the
        // same tag to group several shots of one item).
        var name = 'INBOX ' + ts + ' g' + (ts + i) + ' ' + safe;
        await driveUploadFile(f, name, fid);
      }
      _status('');
      showToast('Added ' + files.length + ' photo' + (files.length > 1 ? 's' : '') + ' to the inbox', 2500);
      _pinRefresh();
    } catch (e) {
      console.error('[Inbox] upload:', e);
      _status('Upload failed — check your connection and try again.');
    } finally { _busy = false; }
  }

  // ── Assign to an item ────────────────────────────────────────
  window._pinAssign = function () {
    var gs = _selGroups();
    if (!gs.length) { showToast('Select photos first', 2500, true); return; }
    var existing = document.getElementById('pin-assign-ov');
    if (existing) existing.remove();
    var nums = {};
    Object.values((window.state || {}).personalData || {}).forEach(function (pd) {
      if (pd && pd.owned && pd.itemNum) nums[pd.itemNum] = true;
    });
    var opts = Object.keys(nums).sort().slice(0, 900).map(function (n) { return '<option value="' + String(n).replace(/"/g, '&quot;') + '">'; }).join('');
    var n = 0; gs.forEach(function (g) { n += g.files.length; });
    var ov = document.createElement('div');
    ov.id = 'pin-assign-ov';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1.5rem';
    ov.innerHTML =
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:1.2rem;max-width:380px;width:100%">' +
        '<div style="font-family:var(--font-head);font-weight:700;font-size:1rem;color:var(--text);margin-bottom:0.5rem">File ' + n + ' photo' + (n > 1 ? 's' : '') + ' to an item</div>' +
        '<div style="font-size:0.78rem;color:var(--text-dim);line-height:1.5;margin-bottom:0.7rem">Type the item number. If it’s already in your collection the photos attach to it; if not, they’re filed under that number and you can add the item right after.</div>' +
        '<input id="pin-assign-num" list="pin-assign-list" type="text" placeholder="e.g. 2343 or 6464-1" autocomplete="off" spellcheck="false" style="width:100%;padding:0.6rem 0.8rem;border:1px solid var(--border);border-radius:8px;background:var(--surface2);color:var(--text);font-family:var(--font-mono);font-size:0.95rem;margin-bottom:0.8rem" onkeydown="if(event.key===\'Enter\')_pinDoAssign()">' +
        '<datalist id="pin-assign-list">' + opts + '</datalist>' +
        '<div style="display:flex;gap:0.5rem">' +
          '<button onclick="_pinDoAssign()" class="btn-primary" style="flex:1;padding:0.6rem;border-radius:8px;border:none;font-family:var(--font-body);font-weight:700;font-size:0.88rem;cursor:pointer">File photos</button>' +
          '<button onclick="document.getElementById(\'pin-assign-ov\').remove()" style="padding:0.6rem 1rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body);font-weight:600;font-size:0.85rem;cursor:pointer">Cancel</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    setTimeout(function () { var i = document.getElementById('pin-assign-num'); if (i) i.focus(); }, 60);
  };

  window._pinDoAssign = async function () {
    var inp = document.getElementById('pin-assign-num');
    var num = (inp && inp.value || '').trim();
    if (!num) { showToast('Type an item number first', 2500, true); return; }
    var ov = document.getElementById('pin-assign-ov'); if (ov) ov.remove();
    var gs = _selGroups();
    if (!gs.length || _busy) return;
    _busy = true;
    try {
      var fromFid = await _folder();
      var toFid = await driveEnsureItemFolder(num);
      var link = driveFolderLink(toFid);
      var moved = 0, ts = new Date().getTime();
      for (var g = 0; g < gs.length; g++) {
        for (var f = 0; f < gs[g].files.length; f++) {
          moved++;
          _status('Filing photo ' + moved + '…');
          var file = gs[g].files[f];
          var ext = (file.name.split('.').pop() || 'jpg').toLowerCase().slice(0, 5);
          await driveMoveFileToFolder(file.id, fromFid, toFid);
          try { await driveRequest('PATCH', '/files/' + file.id, { name: num + ' ADD ' + (ts + moved) + '.' + ext }); } catch (eRn) {}
        }
      }
      _sel = {};
      _status('');
      // Attach to the owned item's sheet row (exact number first, then base-number match)
      var pds = Object.values((window.state || {}).personalData || {});
      var pd = pds.find(function (p) { return p && p.owned && String(p.itemNum) === num; });
      if (!pd && typeof baseItemNum === 'function') {
        pd = pds.find(function (p) { return p && p.owned && p.itemNum && baseItemNum(String(p.itemNum)) === baseItemNum(num); });
      }
      if (pd) {
        if (!pd.photoItem && pd.row && typeof sheetsUpdate === 'function' && typeof personalColLetter === 'function' && window.state.personalSheetId) {
          pd.photoItem = link;
          try { await sheetsUpdate(state.personalSheetId, 'My Collection!' + personalColLetter('photoItem') + pd.row, [[link]]); } catch (eUp) { console.warn('[Inbox] photo link write:', eUp); }
        }
        showToast('Filed ' + moved + ' photo' + (moved > 1 ? 's' : '') + ' to ' + num, 3000);
        _pinRefresh();
      } else {
        // Not in the collection yet — remember the folder link so the photo
        // link can be written the moment the item is saved (see the
        // buildDashboard hook below), and offer the wizard now.
        try {
          var pend = JSON.parse(localStorage.getItem(PENDING_KEY) || '{}');
          pend[num] = link;
          localStorage.setItem(PENDING_KEY, JSON.stringify(pend));
        } catch (eP) {}
        _pinRefresh();
        _offerAdd(num, moved);
      }
    } catch (e) {
      console.error('[Inbox] assign:', e);
      _status('Filing failed partway — hit Refresh to see what’s left, then try again.');
    } finally { _busy = false; }
  };

  function _offerAdd(num, count) {
    var ov = document.createElement('div');
    ov.id = 'pin-offer-ov';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1.5rem';
    ov.innerHTML =
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:1.2rem;max-width:380px;width:100%">' +
        '<div style="font-family:var(--font-head);font-weight:700;font-size:1rem;color:var(--text);margin-bottom:0.5rem">' + count + ' photo' + (count > 1 ? 's' : '') + ' filed under ' + num + '</div>' +
        '<div style="font-size:0.8rem;color:var(--text-dim);line-height:1.5;margin-bottom:0.8rem">That number isn’t in your collection yet. Add it now and the photos connect to it automatically when you save.</div>' +
        '<div style="display:flex;gap:0.5rem">' +
          '<button onclick="document.getElementById(\'pin-offer-ov\').remove();_pinAddNow(\'' + String(num).replace(/'/g, '') + '\')" class="btn-primary" style="flex:1;padding:0.6rem;border-radius:8px;border:none;font-family:var(--font-body);font-weight:700;font-size:0.88rem;cursor:pointer">Add it now</button>' +
          '<button onclick="document.getElementById(\'pin-offer-ov\').remove()" style="padding:0.6rem 1rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body);font-weight:600;font-size:0.85rem;cursor:pointer">Later</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
  }

  window._pinAddNow = function (num) {
    if (typeof openWizard !== 'function') { showToast('Add wizard not available', 2500, true); return; }
    openWizard('collection');
    // Pre-fill the item number once the first step renders.
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      var inp = document.getElementById('wiz-input');
      if (inp && window.wizard && wizard.steps && wizard.steps[wizard.step] && wizard.steps[wizard.step].id === 'itemNum') {
        inp.value = num;
        wizard.data.itemNum = num;
        try { if (typeof debouncedItemSuggestions === 'function') debouncedItemSuggestions(num); } catch (e) {}
        clearInterval(t);
      }
      if (tries > 20) clearInterval(t);
    }, 250);
  };

  // When an item gets saved, connect any pending photo-folder links.
  function _flushPending() {
    var pend;
    try { pend = JSON.parse(localStorage.getItem(PENDING_KEY) || '{}'); } catch (e) { pend = {}; }
    var nums = Object.keys(pend);
    if (!nums.length || !window.state || !state.personalData) return;
    var changed = false;
    nums.forEach(function (num) {
      var pd = Object.values(state.personalData).find(function (p) { return p && p.owned && String(p.itemNum) === num; });
      if (pd && pd.row && !pd.photoItem && typeof sheetsUpdate === 'function' && state.personalSheetId) {
        pd.photoItem = pend[num];
        sheetsUpdate(state.personalSheetId, 'My Collection!' + personalColLetter('photoItem') + pd.row, [[pend[num]]]).catch(function (e) { console.warn('[Inbox] pending link write:', e); });
        delete pend[num]; changed = true;
      } else if (pd && pd.photoItem) { delete pend[num]; changed = true; }
    });
    if (changed) { try { localStorage.setItem(PENDING_KEY, JSON.stringify(pend)); } catch (e) {} }
  }

  // ── Discard (Drive trash — recoverable ~30 days) ─────────────
  window._pinDiscard = async function () {
    var gs = _selGroups();
    if (!gs.length || _busy) { if (!gs.length) showToast('Select photos first', 2500, true); return; }
    var n = 0; gs.forEach(function (g) { n += g.files.length; });
    if (!window.confirm('Discard ' + n + ' photo' + (n > 1 ? 's' : '') + '? They go to your Google Drive trash (recoverable for ~30 days).')) return;
    _busy = true;
    try {
      var done = 0;
      for (var g = 0; g < gs.length; g++) {
        for (var f = 0; f < gs[g].files.length; f++) {
          done++;
          _status('Discarding ' + done + ' of ' + n + '…');
          await driveRequest('PATCH', '/files/' + gs[g].files[f].id, { trashed: true });
        }
      }
      _sel = {};
      _status('');
      showToast('Discarded ' + n + ' photo' + (n > 1 ? 's' : ''), 2500);
      _pinRefresh();
    } catch (e) {
      console.error('[Inbox] discard:', e);
      _status('Discard failed partway — hit Refresh and try again.');
    } finally { _busy = false; }
  };

  // ── Sidebar entry (desktop) + badge ──────────────────────────
  function _navBadge(count) {
    var b = document.getElementById('nav-inbox-count');
    if (b) { b.textContent = count > 0 ? count : ''; b.style.display = count > 0 ? '' : 'none'; }
  }

  function _injectNav() {
    if (document.getElementById('nav-photo-inbox')) return;
    if (window.IS_MOBILE_UA) return;   // Phase 2 brings the phone side
    var prefsBtn = document.querySelector('.sidebar .nav-item[onclick*="prefs"]');
    if (!prefsBtn || !prefsBtn.parentNode) return;
    var b = document.createElement('button');
    b.className = 'nav-item';
    b.id = 'nav-photo-inbox';
    b.setAttribute('data-ctip', 'Photos waiting to be filed to items.');
    b.setAttribute('onclick', '_pinGo(this)');
    b.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>' +
      'Photo Inbox<span class="nav-badge" id="nav-inbox-count" style="display:none;background:#f8e8c0;color:#1a1a1a"></span>';
    prefsBtn.parentNode.insertBefore(b, prefsBtn);
  }

  // ═════════════════════════════════════════════════════════════
  // PHASE 2 — QUICK CAPTURE (phone) — v0.9.880
  // Big camera button; every shot uploads to the inbox in the
  // background. Two modes (Brad's design):
  //   single — one photo per item; every shot is its own group.
  //   multi  — several photos of the same item; "Next Item" starts
  //            the next group. Groups share the g-tag so the desktop
  //            inbox shows them as one stack and files them together.
  // ═════════════════════════════════════════════════════════════
  var QC_MODE_KEY = 'rr_qc_mode';
  var _qc = null;   // { base, group, shots, total, pending, failed:[{file,name}] }

  function _qcToken() {
    if (!window.accessToken) {
      var s = localStorage.getItem('lv_token'), ex = parseInt(localStorage.getItem('lv_token_expiry') || '0', 10);
      if (s && ex > new Date().getTime()) window.accessToken = s;
    }
    return window.accessToken;
  }

  window._qcOpen = function () {
    if (!_qc) _qc = { base: new Date().getTime(), group: 1, shots: 0, total: 0, pending: 0, failed: [] };
    var ov = document.getElementById('qc-ov');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'qc-ov';
      ov.style.cssText = 'position:fixed;inset:0;background:var(--bg,#10132a);z-index:10000;display:flex;flex-direction:column;padding:max(0.8rem,env(safe-area-inset-top)) 0.9rem max(0.8rem,env(safe-area-inset-bottom))';
      document.body.appendChild(ov);
      var inp = document.createElement('input');
      inp.type = 'file'; inp.id = 'qc-file'; inp.accept = 'image/*';
      inp.setAttribute('capture', 'environment');
      inp.style.display = 'none';
      inp.addEventListener('change', function () {
        var f = this.files && this.files[0];
        this.value = '';
        if (f) _qcShot(f);
      });
      ov.appendChild(inp);
      var body = document.createElement('div');
      body.id = 'qc-body';
      body.style.cssText = 'flex:1;display:flex;flex-direction:column;min-height:0';
      ov.appendChild(body);
      if (window.BackStack && BackStack.push) BackStack.push('qc-ov', window._qcDone);
    }
    _qcRender();
  };

  function _qcMode() { return localStorage.getItem(QC_MODE_KEY) || ''; }

  window._qcSetMode = function (m) {
    localStorage.setItem(QC_MODE_KEY, m);
    // Mode switch mid-session: start a fresh item group either way.
    if (_qc && _qc.shots > 0) { _qc.group++; _qc.shots = 0; }
    _qcRender();
  };

  window._qcPickMode = function () { _qcRender(true); };

  function _qcRender(forceModeScreen) {
    var body = document.getElementById('qc-body');
    if (!body) return;
    var mode = _qcMode();
    if (!mode || forceModeScreen) {
      body.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">' +
          '<span style="font-family:var(--font-head);font-weight:700;font-size:1.05rem;color:var(--text)">Quick Capture</span>' +
          '<button onclick="_qcDone()" style="background:none;border:none;color:var(--text-dim);font-size:1.4rem;line-height:1;cursor:pointer;padding:0.2rem 0.4rem">✕</button>' +
        '</div>' +
        '<div style="font-size:0.85rem;color:var(--text-dim);line-height:1.55;margin-bottom:1.2rem">How are you shooting today? Photos go straight to your Photo Inbox — you file them to items later at the desk.</div>' +
        '<button onclick="_qcSetMode(\'single\')" style="width:100%;padding:1.1rem;border-radius:12px;border:1.5px solid #8b8e94;background:rgba(139,142,148,0.12);color:var(--text);font-family:var(--font-body);cursor:pointer;text-align:left;margin-bottom:0.7rem">' +
          '<div style="font-weight:700;font-size:0.95rem;color:#2980b9;margin-bottom:0.2rem">One photo per item</div>' +
          '<div style="font-size:0.78rem;color:var(--text-dim)">Every shot is its own item. Fastest.</div>' +
        '</button>' +
        '<button onclick="_qcSetMode(\'multi\')" style="width:100%;padding:1.1rem;border-radius:12px;border:1.5px solid #8b8e94;background:rgba(139,142,148,0.12);color:var(--text);font-family:var(--font-body);cursor:pointer;text-align:left">' +
          '<div style="font-weight:700;font-size:0.95rem;color:#2980b9;margin-bottom:0.2rem">Several photos per item</div>' +
          '<div style="font-size:0.78rem;color:var(--text-dim)">Snap all sides of an item, then tap Next Item. The photos stay together as one item in your inbox.</div>' +
        '</button>';
      return;
    }
    var multi = mode === 'multi';
    var counter = multi
      ? 'Item ' + _qc.group + (_qc.shots ? ' · ' + _qc.shots + ' photo' + (_qc.shots > 1 ? 's' : '') : '')
      : _qc.total + ' photo' + (_qc.total === 1 ? '' : 's') + ' taken';
    var pend = '';
    if (_qc.pending > 0) pend += 'Uploading ' + _qc.pending + '… ';
    if (_qc.failed.length) pend += '<span style="color:#f05008;font-weight:700">' + _qc.failed.length + ' failed</span> <button onclick="_qcRetry()" style="border:1px solid var(--border);background:var(--surface2);color:var(--text-mid);border-radius:6px;font-size:0.72rem;padding:0.15rem 0.5rem;cursor:pointer;font-family:var(--font-body)">Retry</button>';
    body.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.6rem">' +
        '<span style="font-family:var(--font-head);font-weight:700;font-size:1.05rem;color:var(--text)">Quick Capture</span>' +
        '<button onclick="_qcPickMode()" style="border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);border-radius:7px;font-size:0.7rem;padding:0.25rem 0.6rem;cursor:pointer;font-family:var(--font-body)">' + (multi ? 'Several per item' : 'One per item') + ' ▾</button>' +
      '</div>' +
      '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.4rem">' +
        '<div style="font-family:var(--font-head);font-weight:700;font-size:1.5rem;color:var(--text);text-align:center">' + counter + '</div>' +
        '<div style="font-size:0.78rem;color:var(--text-dim);min-height:1.2em;text-align:center">' + (pend || (_qc.total ? _qc.total + ' in your inbox' : 'Photos upload as you go')) + '</div>' +
      '</div>' +
      '<button onclick="document.getElementById(\'qc-file\').click()" style="width:100%;min-height:34vh;border-radius:16px;border:none;background:#2980b9;color:#fff;font-family:var(--font-body);font-weight:700;font-size:1.15rem;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.6rem;margin-bottom:0.7rem">' +
        '<svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>' +
        (multi && _qc.shots ? 'Take another of this item' : 'Take Photo') +
      '</button>' +
      (multi ? '<button onclick="_qcNextItem()" ' + (_qc.shots ? '' : 'disabled ') + 'style="width:100%;padding:0.95rem;border-radius:12px;border:1.5px solid #8b8e94;background:rgba(139,142,148,0.12);color:' + (_qc.shots ? '#2980b9' : 'var(--text-dim)') + ';font-family:var(--font-body);font-weight:700;font-size:1rem;cursor:pointer;margin-bottom:0.7rem;opacity:' + (_qc.shots ? '1' : '0.5') + '">Next Item →</button>' : '') +
      '<button onclick="_qcDone()" style="width:100%;padding:0.8rem;border-radius:12px;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body);font-weight:600;font-size:0.9rem;cursor:pointer">Done</button>';
  }

  function _qcShot(file) {
    var mode = _qcMode();
    if (mode === 'single' && _qc.shots > 0) { _qc.group++; _qc.shots = 0; }
    _qc.shots++;
    _qc.total++;
    var ext = ((file.name || '').split('.').pop() || 'jpg').toLowerCase().slice(0, 5) || 'jpg';
    var name = 'INBOX ' + _qc.base + ' g' + _qc.base + '-' + _qc.group + ' p' + _qc.shots + '.' + ext;
    if (mode === 'single') { _qc.group++; _qc.shots = 0; }
    _qcUpload(file, name);
    _qcRender();
  }

  window._qcNextItem = function () {
    if (!_qc || !_qc.shots) return;
    _qc.group++;
    _qc.shots = 0;
    _qcRender();
  };

  async function _qcUpload(file, name) {
    _qc.pending++;
    _qcRender();
    try {
      if (!_qcToken()) throw new Error('signed out');
      var fid = await _folder();
      await driveUploadFile(file, name, fid);
    } catch (e) {
      console.warn('[QuickCapture] upload failed:', e);
      _qc.failed.push({ file: file, name: name });
    } finally {
      _qc.pending--;
      _qcRender();
    }
  }

  window._qcRetry = function () {
    if (!_qc || !_qc.failed.length) return;
    var again = _qc.failed.splice(0);
    again.forEach(function (it) { _qcUpload(it.file, it.name); });
  };

  window._qcDone = function () {
    if (_qc && _qc.pending > 0) {
      if (!window.confirm(_qc.pending + ' photo(s) still uploading — leave anyway? They may not reach the inbox.')) return;
    }
    if (_qc && _qc.failed.length) {
      if (!window.confirm(_qc.failed.length + ' photo(s) failed to upload and will be lost. Close anyway?')) return;
    }
    var total = _qc ? (_qc.total - _qc.failed.length) : 0;
    var ov = document.getElementById('qc-ov');
    if (ov) ov.remove();
    if (window.BackStack && BackStack.pop) BackStack.pop('qc-ov');
    _qc = null;
    if (total > 0) showToast(total + ' photo' + (total > 1 ? 's' : '') + ' in your inbox — file them at the desk', 3500);
  };

  // Phone dashboard entry — full-width button under the greeting.
  function _injectCapture() {
    if (!window.IS_MOBILE_UA) return;
    if (document.getElementById('qc-entry')) return;
    var g = document.getElementById('dash-greeting');
    if (!g || !g.parentNode) return;
    var b = document.createElement('button');
    b.id = 'qc-entry';
    b.setAttribute('onclick', '_qcOpen()');
    b.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:0.5rem;width:100%;margin:0.6rem 0 0;padding:0.7rem;border-radius:10px;border:1.5px solid #8b8e94;background:rgba(139,142,148,0.12);color:#2980b9;font-family:var(--font-body);font-size:0.85rem;font-weight:700;cursor:pointer';
    b.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>Quick Capture — photos to your inbox';
    g.parentNode.appendChild(b);
  }

  // Piggyback on dashboard rebuilds (fires after login and after every
  // wizard save) — inject the entries once and flush pending links.
  function _hook() {
    if (typeof window.buildDashboard === 'function' && !window.buildDashboard._pinWrapped) {
      var orig = window.buildDashboard;
      window.buildDashboard = function () {
        var r = orig.apply(this, arguments);
        try { _injectNav(); _injectCapture(); _flushPending(); } catch (e) {}
        return r;
      };
      window.buildDashboard._pinWrapped = true;
    } else if (typeof window.buildDashboard !== 'function') {
      setTimeout(_hook, 800);
    }
  }
  _hook();
})();
