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
  var CROPPED_KEY = 'rr_inbox_cropped';   // v0.9.961: { fileId: 1 } cropped -> load real bytes, not Drive's stale preview
  var _fid = null, _fidChecked = false;
  var _groups = [];          // [{ key, files:[{id,name,createdTime}] }]
  var _sel = {};             // groupKey -> true
  var _selectMode = false;   // opt-in multi-select: circles + action bar hidden until ON
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
      '<div style="font-size:0.8rem;color:var(--text-dim);line-height:1.5;margin-bottom:0.7rem">Drop photos anywhere below, or use Add photos. Click a photo to review it — add the item, research it more, or discard the photo. Use “Select multiple” to combine several shots of one item. Photos snapped with Quick Capture on your phone land here too.</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin-bottom:0.8rem">' +
        '<button onclick="_pinAddSource()" class="btn-primary" style="padding:0.5rem 0.9rem;border-radius:8px;border:none;font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">Add photos…</button>' +
        '<button id="pin-selmode-btn" onclick="_pinToggleSelectMode()" style="padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #8b8e94;background:rgba(139,142,148,0.12);color:#2980b9;font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">☑ Select multiple</button>' +
        '<button id="pin-selall-btn" onclick="_pinSelectAll()" style="display:none;padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #8b8e94;background:rgba(139,142,148,0.12);color:#2980b9;font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">Select all</button>' +
        '<button id="pin-idall-btn" onclick="_pinIdentifyAll()" style="display:none;padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid var(--accent2);background:rgba(212,168,67,0.14);color:var(--accent2);font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">🔍 Read with a token</button>' +
        '<button onclick="_pinRefresh()" style="padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #8b8e94;background:rgba(139,142,148,0.12);color:#2980b9;font-family:var(--font-body);font-weight:600;font-size:0.82rem;cursor:pointer">Refresh</button>' +
        '<span style="flex:1"></span>' +
        '<span id="pin-selinfo" style="font-size:0.78rem;color:var(--text-dim)"></span>' +
        '<button id="pin-idsel-btn" onclick="_pinIdentifySelected()" style="display:none;padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #8b8e94;background:rgba(139,142,148,0.12);color:#2980b9;font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">Identify</button>' +
        '<button id="pin-assign-btn" onclick="_pinReview(null)" style="display:none;padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #8b8e94;background:rgba(139,142,148,0.12);color:#2980b9;font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">Combine → one item…</button>' +
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
    if (msg) {
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.gap = '0.45rem';
      el.style.color = '#2980b9';        // bright blue = "working"
      el.style.fontWeight = '700';
      el.innerHTML = '<span style="display:inline-block;animation:spin 0.8s linear infinite;font-size:1rem;line-height:1">↻</span>' +
        '<span>' + String(msg).replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</span>';
    } else {
      el.style.display = 'none';
    }
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
      // Prune stored AI suggestions for photos that left the inbox
      (function () {
        var live = {}; files.forEach(function (f) { live[f.id] = true; });
        var ids = _ids(), changed = false;
        Object.keys(ids).forEach(function (k) { if (!live[k]) { delete ids[k]; changed = true; } });
        if (changed) _idsSave(ids);
      })();
      _render();
      _status('');
      setTimeout(function () { try { _pinAutoRead(); } catch (e) {} }, 400);
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
      // v0.9.886: AI suggestion (from Identify all) shows on the tile bar
      var sug = _ids()[g.files[0].id];
      var _altN = '';   // v0.9.902 (Brad): candidates but no confident number = still a lead, not "no read"
      if (sug && !sug.num && Array.isArray(sug.alts) && sug.alts.length) {
        var _a0 = String(sug.alts[0]); var _mm = _a0.match(/[0-9][0-9A-Za-z.\-\/]*/); _altN = _mm ? _mm[0] : _a0.slice(0, 12);
      }
      if (sug && sug.num && sug.guess) when = '<span style="color:#ffb454;font-weight:700">' + String(sug.num).replace(/</g, '&lt;') + ' · best guess</span> · ' + when;   // v0.9.898: hedged read, kept but marked
      else if (sug && sug.num) when = '<span style="color:#7ec3ef;font-weight:700">' + String(sug.num).replace(/</g, '&lt;') + '?</span> · ' + when;
      else if (_altN) when = '<span style="color:#ffb454;font-weight:700">' + _altN.replace(/</g, '&lt;') + ' · best guess</span> · ' + when;   // v0.9.902
      else if (sug && sug.tried) when = '<span style="color:#999">no read</span> · ' + when;
      // v0.9.888 (Brad): click the photo = open the review (add / research /
      // discard); the corner circle is the multi-select toggle.
      // Default: clicking a tile opens Review. In Select-multiple mode, the tile
      // toggles selection (circles + crop appear/hide accordingly).
      var _tileClick = _selectMode ? '_pinToggle' : '_pinReview';
      var _circle = _selectMode
        ? '<div onclick="event.stopPropagation();_pinToggle(\'' + g.key + '\')" title="Select" style="position:absolute;top:6px;left:6px;width:22px;height:22px;border-radius:50%;border:2px solid ' + (isSel ? '#2980b9' : 'rgba(255,255,255,0.75)') + ';background:' + (isSel ? '#2980b9' : 'rgba(0,0,0,0.35)') + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:700">' + (isSel ? '✓' : '') + '</div>'
        : '';
      var _crop = _selectMode ? ''
        : '<div onclick="event.stopPropagation();_pinTileCrop(\'' + g.key + '\')" title="Crop / Rotate" style="position:absolute;right:6px;bottom:26px;width:24px;height:24px;border-radius:7px;background:rgba(0,0,0,0.55);color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.8rem;cursor:pointer">✂</div>';
      return '<div class="pin-tile" data-key="' + g.key + '" onclick="' + _tileClick + '(\'' + g.key + '\')" style="position:relative;border-radius:10px;overflow:hidden;cursor:pointer;background:var(--surface2,#26262e);aspect-ratio:1;border:3px solid ' + (isSel ? '#2980b9' : 'transparent') + '">' +
        '<img loading="lazy" data-fid="' + g.files[0].id + '" style="width:100%;height:100%;object-fit:cover;object-position:center;display:block" alt="">' +
        chip +
        _circle +
        _crop +
        '<div style="position:absolute;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);color:#ddd;font-size:0.6rem;padding:0.1rem 0.35rem">' + when + '</div>' +
        '</div>';
    }).join('');
    empty.style.display = _groups.length ? 'none' : 'block';
    var cnt = document.getElementById('pin-count');
    if (cnt) cnt.textContent = total ? (total + ' photo' + (total > 1 ? 's' : '') + ' waiting') : '';
    grid.querySelectorAll('img[data-fid]').forEach(function (img) {
      loadDriveThumb(img.getAttribute('data-fid'), img, img.parentElement, null, 'hi');
    });
    _selInfo();
    _navBadge(total);
    _updateIdAllBtn();
    // v0.9.961 (Brad): keep the "cropped" marker set trimmed to files still in
    // the inbox (filed/discarded photos drop out), then republish to drive.js.
    try {
      if (_groups.length) {   // only prune once photos have actually loaded
        var live = {}; _groups.forEach(function (g) { g.files.forEach(function (f) { live[f.id] = 1; }); });
        var c = _cropped(), pruned = {}, changed = false;
        Object.keys(c).forEach(function (fid) { if (live[fid]) pruned[fid] = 1; else changed = true; });
        if (changed) _croppedSave(pruned); else window._rrForceFreshBytes = c;
      } else {
        window._rrForceFreshBytes = _cropped();
      }
    } catch (ePr) {}
  }

  // v0.9.956 (Brad): the gold "Read with a token" button only appears when there
  // are leftover photos the free reader couldn't place — and it says exactly
  // how many, so a paid batch never runs by surprise. Free auto-read handles
  // the easy ones for nothing; this button is the deliberate "spend a credit
  // on the ones that are left" step.
  function _updateIdAllBtn() {
    var b = document.getElementById('pin-idall-btn');
    if (!b) return;
    var ids = _ids();
    var n = _groups.filter(function (g) { return !ids[g.files[0].id]; }).length;
    if (n > 0 && !_selectMode) {
      b.textContent = '🔍 Read ' + n + ' (' + n + ' token' + (n === 1 ? '' : 's') + ')';
      b.style.display = '';
    } else {
      b.style.display = 'none';
    }
  }

  // v0.9.956 (Brad): a plain in-app confirm so a paid batch always asks first.
  // Returns a promise that resolves true (go) or false (cancel). No browser
  // confirm() dialog — that would freeze the extension bridge.
  function _pinConfirm(msg, okLabel) {
    return new Promise(function (resolve) {
      var ov = document.createElement('div');
      ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;padding:1.2rem';
      ov.innerHTML =
        '<div style="max-width:380px;width:100%;background:var(--surface,#1e1e26);border:1px solid var(--border);border-radius:14px;padding:1.3rem 1.3rem 1.1rem;box-shadow:0 12px 40px rgba(0,0,0,0.5)">' +
          '<div style="font-size:0.92rem;color:var(--text-mid);line-height:1.55;margin-bottom:1.1rem">' + msg + '</div>' +
          '<div style="display:flex;gap:0.6rem;justify-content:flex-end">' +
            '<button id="_pcc" style="padding:0.5rem 1rem;border-radius:8px;border:1.5px solid #8b8e94;background:rgba(139,142,148,0.12);color:var(--text-mid);font-family:var(--font-body);font-weight:600;font-size:0.85rem;cursor:pointer">Not now</button>' +
            '<button id="_pco" style="padding:0.5rem 1.1rem;border-radius:8px;border:none;background:var(--accent2);color:#1a1a1a;font-family:var(--font-body);font-weight:700;font-size:0.85rem;cursor:pointer">' + (okLabel || 'Continue') + '</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(ov);
      function done(v) { try { ov.remove(); } catch (e) {} resolve(v); }
      ov.querySelector('#_pcc').onclick = function () { done(false); };
      ov.querySelector('#_pco').onclick = function () { done(true); };
      ov.onclick = function (e) { if (e.target === ov) done(false); };
    });
  }

  // v0.9.900 (Brad): crop straight from the grid tile — one-photo items open
  // the cropper directly; multi-photo stacks open the review card, where every
  // photo has its own ✂.
  window._pinTileCrop = function (key) {
    var g = _groups.filter(function (x) { return x.key === key; })[0];
    if (!g || !g.files.length) return;
    if (g.files.length === 1) return window._pinCropPhoto(g.files[0].id);
    window._pinReview(key);
    showToast('Several photos in this item — use the ✂ on the one you want to crop', 3000);
  };

  window._pinToggle = function (key) {
    if (_sel[key]) delete _sel[key]; else _sel[key] = true;
    _render();
  };

  // Select all / Deselect all (only meaningful in select mode).
  window._pinSelectAll = function () {
    var allSel = _groups.length && _groups.every(function (g) { return _sel[g.key]; });
    _sel = {};
    if (!allSel) _groups.forEach(function (g) { _sel[g.key] = true; });
    _render();
  };

  // Opt-in multi-select: circles + the Combine/Discard action bar stay hidden
  // until the user turns this on, so the grid doesn't change shape unexpectedly.
  window._pinToggleSelectMode = function () {
    _selectMode = !_selectMode;
    if (!_selectMode) _sel = {};   // leaving select mode clears the ticks
    var b = document.getElementById('pin-selmode-btn');
    if (b) {
      b.style.background = _selectMode ? 'rgba(41,128,185,0.18)' : 'rgba(139,142,148,0.12)';
      b.style.borderColor = _selectMode ? '#2980b9' : '#8b8e94';
      b.textContent = _selectMode ? '✓ Done selecting' : '☑ Select multiple';
    }
    _render();
  };

  function _selGroups() { return _groups.filter(function (g) { return _sel[g.key]; }); }

  function _selInfo() {
    var gs = _selGroups(), n = 0;
    gs.forEach(function (g) { n += g.files.length; });
    var info = document.getElementById('pin-selinfo');
    var ab = document.getElementById('pin-assign-btn'), db = document.getElementById('pin-discard-btn');
    var ib = document.getElementById('pin-idsel-btn');   // v0.9.897 (Brad): identify just the ticked photos
    if (info) info.textContent = n ? (n + ' photo' + (n > 1 ? 's' : '') + ' selected') : (_selectMode ? 'Tap photos to select' : '');
    var sa = document.getElementById('pin-selall-btn');
    if (sa) {
      sa.style.display = _selectMode ? '' : 'none';
      var allSel = _groups.length && _groups.every(function (g) { return _sel[g.key]; });
      sa.textContent = allSel ? 'Deselect all' : 'Select all';
    }
    if (ab) ab.style.display = gs.length > 1 ? '' : 'none';   // combine needs 2+
    if (db) db.style.display = n ? '' : 'none';
    if (ib) ib.style.display = n ? '' : 'none';
  }

  // ── Import ───────────────────────────────────────────────────
  window._pinPickFiles = function () {
    var inp = document.getElementById('pin-file-input');
    if (inp) inp.click();
  };

  // ── Batch Add Photos: one door in, device-aware source picker ──
  // Desktop → From Your Drive (computer files) / From Google Photos.
  // Mobile  → Take with Phone (camera) / From Google Photos.
  window._pinAddSource = function () {
    var mobile = !!window.IS_MOBILE_UA;
    var ex = document.getElementById('pin-src-ov'); if (ex) ex.remove();
    var ov = document.createElement('div');
    ov.id = 'pin-src-ov';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;padding:1rem';
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
    var bcss = 'display:flex;align-items:center;gap:0.7rem;width:100%;padding:0.95rem 1rem;border-radius:10px;border:2px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.95rem;font-weight:600;cursor:pointer;text-align:left';
    var X = "document.getElementById('pin-src-ov').remove();";
    var sources = mobile
      ? '<button style="' + bcss + '" onclick="' + X + '_qcOpen()"><span style="font-size:1.3rem">📷</span> Take with Phone</button>'
        + '<button style="' + bcss + '" onclick="' + X + '_pinGPhotos()"><span style="font-size:1.3rem">🖼️</span> From Google Photos</button>'
      : '<button style="' + bcss + '" onclick="' + X + '_pinPickFiles()"><span style="font-size:1.3rem">💻</span> From Your Drive <span style="color:var(--text-dim);font-size:0.78rem;font-weight:400">— your computer</span></button>'
        + '<button style="' + bcss + '" onclick="' + X + '_pinGPhotos()"><span style="font-size:1.3rem">🖼️</span> From Google Photos</button>';
    ov.innerHTML = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:1.2rem;max-width:360px;width:100%">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.85rem">' +
        '<div style="font-family:var(--font-head);font-weight:700;font-size:1rem;color:var(--text)">Add photos from…</div>' +
        '<button onclick="' + X + '" style="background:none;border:none;color:var(--text-dim);font-size:1.3rem;line-height:1;cursor:pointer;padding:0.1rem 0.3rem">✕</button>' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:0.6rem">' + sources + '</div>' +
    '</div>';
    document.body.appendChild(ov);
  };

  // Entry from the +Add menu ("Batch Add Photos"): land on the inbox page so
  // the import handlers have their DOM, then offer the source picker.
  window._pinBatchStart = function () {
    window._pinGo(document.getElementById('nav-photo-inbox'));
    setTimeout(function () { window._pinAddSource(); }, 60);
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

  // ── Review a photo group: research laid out → Add / Research /
  //    Discard (v0.9.888, Brad's flow). Also handles "Combine → one
  //    item…" for a multi-selection (all selected photos = one item).
  var _rvGroups = [];

  // v0.9.941 (Brad's Marx girder bridge): the number lookup must respect the
  // manufacturer the photo-read reported. '1303' exists under Atlas O, but the
  // AI said Marx — matching by number alone showed 'Maker: Atlas'. Prefer a
  // catalog row whose brand agrees with the AI; if none agrees, keep the
  // number match but flag the conflict instead of presenting it as fact.
  function _pinMfrAgree(a, b) {
    a = String(a || '').toLowerCase().trim(); b = String(b || '').toLowerCase().trim();
    if (!a || !b) return true;   // nothing to compare -> no conflict
    var aw = a.split(/\s+/)[0], bw = b.split(/\s+/)[0];
    return a.indexOf(bw) >= 0 || b.indexOf(aw) >= 0;
  }
  function _pinBestMaster(num, aiMfr) {
    var bucket = null;
    try { bucket = (window.state && state.masterByItem && state.masterByItem.get) ? state.masterByItem.get(String(num).trim()) : null; } catch (e) {}
    if (bucket && bucket.length) {
      if (aiMfr) {
        for (var i = 0; i < bucket.length; i++) {
          var mk = bucket[i].manufacturer || ((typeof ERAS !== 'undefined' && ERAS[bucket[i]._era]) ? ERAS[bucket[i]._era].manufacturer : '');
          if (_pinMfrAgree(aiMfr, mk)) return bucket[i];
        }
      }
      return bucket[0];
    }
    try { return (typeof findMaster === 'function') ? findMaster(num) : null; } catch (e) { return null; }
  }
  function _pinLookup(num, aiMfr) {
    num = String(num || '').trim();
    var out = { num: num, master: null, ownedPd: null, maker: '', era: '', desc: '', mfrMismatch: '' };
    if (!num) return out;
    out.master = _pinBestMaster(num, aiMfr);
    if (out.master) {
      var m = out.master;
      var eraDef = (typeof ERAS !== 'undefined' && ERAS[m._era]) ? ERAS[m._era] : null;
      out.maker = m.manufacturer || (eraDef ? eraDef.manufacturer : '') || '';
      out.era = eraDef ? eraDef.label : '';
      out.desc = m.description || [m.roadName, m.itemType].filter(Boolean).join(' ') || '';
      if (aiMfr && !_pinMfrAgree(aiMfr, out.maker)) out.mfrMismatch = String(aiMfr);
    }
    var pds = Object.values((window.state || {}).personalData || {});
    out.ownedPd = pds.find(function (p) { return p && p.owned && String(p.itemNum) === num; }) || null;
    if (!out.ownedPd && typeof baseItemNum === 'function') {
      out.ownedPd = pds.find(function (p) { return p && p.owned && p.itemNum && baseItemNum(String(p.itemNum)) === baseItemNum(num); }) || null;
    }
    return out;
  }

  var _rvAiMfr = '';
  window._pinReviewLookup = function (val) {
    var box = document.getElementById('pin-rv-info');
    var addBtn = document.getElementById('pin-rv-add');
    if (!box) return;
    var lk = _pinLookup(val, _rvAiMfr);
    // v0.9.963 (Brad): bigger, readable catalog details at the top of the card.
    var row = function (label, v) {
      return '<div style="display:flex;gap:0.6rem;font-size:0.95rem;line-height:1.55"><span style="width:92px;flex-shrink:0;color:var(--text-dim)">' + label + '</span><span style="color:var(--text);font-weight:600">' + (v || '—') + '</span></div>';
    };
    var html = '';
    if (!lk.num) {
      html = '<div style="font-size:0.9rem;color:var(--text-dim)">No number read from the photo yet — type one below, or use Research.</div>';
    } else if (lk.master && lk.mfrMismatch) {
      html = '<div style="font-size:0.82rem;color:#d4a843;font-weight:700;line-height:1.5;margin-bottom:0.35rem">⚠ The photo says ' + String(lk.mfrMismatch).replace(/</g, '&lt;') + ' — but #' + String(lk.num).replace(/</g, '&lt;') + ' in the catalog is a ' + String(lk.maker || '?').replace(/</g, '&lt;') + ' item. Probably NOT the same thing.</div>'
        + row('Catalog has', (lk.maker || '—') + ': ' + String(lk.desc).replace(/</g, '&lt;'))
        + '<div style="font-size:0.78rem;color:var(--text-dim);margin-top:0.3rem">' + String(lk.mfrMismatch).replace(/</g, '&lt;') + ' isn\'t in the master catalog' + ((typeof state !== 'undefined' && state.masterData && state.masterData.some(function (it) { return _pinMfrAgree(lk.mfrMismatch, it.manufacturer || ''); })) ? ' under this number' : ' yet') + ' — Add will create a manual ' + String(lk.mfrMismatch).replace(/</g, '&lt;') + ' entry instead of the ' + String(lk.maker || '').replace(/</g, '&lt;') + ' item.</div>';
    } else if (lk.master) {
      html = row('Maker', (lk.maker || '—') + (lk.era ? ' <span style="font-weight:400;color:var(--text-dim)">(' + lk.era + ')</span>' : ''))
        + row('Item #', String(lk.num).replace(/</g, '&lt;'))
        + row('Description', String(lk.desc).replace(/</g, '&lt;'));
    } else {
      html = row('Item #', String(lk.num).replace(/</g, '&lt;'))
        + '<div style="font-size:0.8rem;color:var(--text-dim);margin-top:0.2rem">Not found in the catalog — you can still add it, or Research to double-check the number.</div>';
    }
    if (lk.ownedPd) html += '<div style="margin-top:0.45rem;font-size:0.8rem;color:#2ecc71;font-weight:700">✓ You already own one — this will be added as a separate copy.</div>';
    box.innerHTML = html;
    // v0.9.942 (Identify v3, Brad): double-check the photo against the
    // catalog listing's reference photo when the matched master row links one.
    try { _pinVerifyRender(lk); } catch (eV) {}
  };

  // ── Identify v3 (v0.9.942): photo double-check vs the catalog photo ──────
  // Auto-runs when the AI's answer was a best guess (or brand-mismatched);
  // otherwise offers a button. Verdicts cache per (photo, number) so repeat
  // opens are free; the relay also caches server-side.
  var _vfCache = {};   // fid|num -> aiVerifyPhoto result
  var _vfSeen  = {};   // fid|num -> 1 once auto-run fired (no repeat burns)
  var _vfNote  = {};   // group key -> rejection note for the re-identify run
  function _pinVerifyRender(lk) {
    var box = document.getElementById('pin-rv-info');
    if (!box || !_rvGroups || !_rvGroups.length || !lk) return;
    var link = (lk.master && (lk.master.refLink || '')) || '';
    if (!lk.num || !/^https?:\/\//i.test(link)) return;
    if (typeof aiVerifyPhoto !== 'function') return;
    var fid0 = _rvGroups[0].files[0].id;
    var key = fid0 + '|' + lk.num;
    var el = document.createElement('div');
    el.id = 'pin-rv-verify';
    el.style.cssText = 'margin-top:0.5rem;padding-top:0.45rem;border-top:1px dashed var(--border)';
    box.appendChild(el);
    if (_vfCache[key]) { _pinVerifyShow(el, _vfCache[key]); return; }
    var s0 = null; try { s0 = _ids()[fid0]; } catch (eS) {}
    var auto = !!(s0 && s0.num && String(s0.num) === String(lk.num) && (s0.guess || lk.mfrMismatch));
    if (auto && !_vfSeen[key]) {
      _vfSeen[key] = 1;
      _pinVerifyRun(lk, key, el);
    } else {
      el.innerHTML = '<button onclick="_pinVerifyClick()" style="padding:0.4rem 0.7rem;border-radius:8px;border:1.5px solid #8b8e94;background:rgba(139,142,148,0.12);color:#2980b9;font-family:var(--font-body);font-weight:700;font-size:0.78rem;cursor:pointer">📷 Double-check vs catalog photo</button>';
    }
  }
  window._pinVerifyClick = function () {
    var num = (document.getElementById('pin-rv-num') || {}).value || '';
    var lk = _pinLookup(num, _rvAiMfr);
    var el = document.getElementById('pin-rv-verify');
    if (!el || !_rvGroups || !_rvGroups.length || !lk.master) return;
    _pinVerifyRun(lk, _rvGroups[0].files[0].id + '|' + lk.num, el);
  };
  async function _pinVerifyRun(lk, key, el) {
    el.innerHTML = '<div style="font-size:0.8rem;color:var(--text-dim)">📷 Checking your photo against the catalog listing…</div>';
    var vr;
    try {
      var blob = await _pinBytes(_rvGroups[0].files[0].id);
      vr = await aiVerifyPhoto(blob, lk.master.refLink);
    } catch (e) {
      console.warn('[Inbox] verify failed:', e && e.message);
      vr = { ok: false, reason: 'error' };
    }
    if (vr && (vr.ok || vr.reason === 'noref')) _vfCache[key] = vr;   // don't cache transient errors
    // the card may have re-rendered while we were away — find the live node
    var live = document.getElementById('pin-rv-verify') || el;
    _pinVerifyShow(live, vr);
  }
  function _pinVerifyShow(el, vr) {
    var esc = function (s) { return String(s || '').replace(/</g, '&lt;'); };
    if (!vr || !vr.ok) {
      var r = vr && vr.reason;
      if (r === 'noref') el.innerHTML = '<div style="font-size:0.76rem;color:var(--text-dim)">No usable catalog photo on the reference page — can\'t double-check this one.</div>';
      else if (r === 'quota') el.innerHTML = '<div style="font-size:0.76rem;color:var(--text-dim)">No tokens left today — the catalog double-check can run tomorrow.</div>';
      else if (r === 'noconsent') el.innerHTML = '';
      else el.innerHTML = '<div style="font-size:0.76rem;color:var(--text-dim)">Couldn\'t run the catalog-photo check right now.</div>';
      return;
    }
    if (vr.match === 'yes') {
      el.innerHTML = '<div style="font-size:0.84rem;color:#2ecc71;font-weight:700">✓ Your photo matches the catalog listing' +
        (vr.refItem ? ' <span style="font-weight:400;color:var(--text-dim)">(' + esc(vr.refItem) + ')</span>' : '') + '</div>';
    } else if (vr.match === 'no') {
      el.innerHTML =
        '<div style="font-size:0.84rem;color:#f05008;font-weight:700;line-height:1.45">✗ Your photo does NOT match the catalog listing' +
        (vr.differences && vr.differences.toLowerCase() !== 'none' ? ' — ' + esc(vr.differences) : '') + '</div>' +
        (vr.refItem ? '<div style="font-size:0.76rem;color:var(--text-dim);margin-top:0.15rem">Catalog photo shows: ' + esc(vr.refItem) + '</div>' : '') +
        '<button onclick="_pinVerifyReident()" style="margin-top:0.4rem;padding:0.45rem 0.7rem;border-radius:8px;border:none;background:#f05008;color:#fff;font-family:var(--font-body);font-weight:700;font-size:0.78rem;cursor:pointer">Re-identify with this clue</button>';
    } else {
      el.innerHTML = '<div style="font-size:0.78rem;color:#d4a843">? Couldn\'t confirm against the catalog photo' +
        (vr.differences && vr.differences.toLowerCase() !== 'none' ? ' — ' + esc(vr.differences) : '') + '</div>';
    }
  }
  window._pinVerifyReident = async function () {
    if (_busy) { showToast('Identify is already running — one moment', 2500, true); return; }
    var g = _rvGroups && _rvGroups[0];
    if (!g) return;
    var num = String((document.getElementById('pin-rv-num') || {}).value || '').trim();
    var vr = _vfCache[g.files[0].id + '|' + num];
    _vfNote[g.key] = 'The number ' + num + ' was proposed, but the catalog reference photo for that number shows a DIFFERENT product' +
      (vr && vr.differences ? ' (' + vr.differences + ')' : '') + '.';
    var ids = _ids();
    delete ids[g.files[0].id];
    _idsSave(ids);
    var ov = document.getElementById('pin-review-ov'); if (ov) ov.remove();
    await _pinIdentifyRun([g], ids);
    delete _vfNote[g.key];
    window._pinReview(g.key);
  };

  window._pinReview = function (key) {
    _rvGroups = key ? _groups.filter(function (g) { return g.key === key; }) : _selGroups();
    if (!_rvGroups.length) { showToast('Select photos first', 2500, true); return; }
    var n = 0; _rvGroups.forEach(function (g) { n += g.files.length; });
    var sug = '';
    _rvAiMfr = '';
    try { var s0 = _ids()[_rvGroups[0].files[0].id]; if (s0 && s0.num) sug = String(s0.num); if (s0 && s0.mfr) _rvAiMfr = String(s0.mfr); } catch (eS) {}
    // v0.9.966 (Brad): the read found a description but no structured number
    // (e.g. "No. 260 … illuminated bumper" with an empty number field). Recover
    // the catalog number from that text — master-validated — so the box fills in.
    try {
      if (!sug && s0) {
        var _recTxt = [s0.mfr, s0.road, s0.desc].filter(Boolean).join(' ');
        var _recNum = _numberFromText(_recTxt);
        if (_recNum && _recNum.num) sug = String(_recNum.num);
      }
    } catch (eR) {}
    var nums = {};
    Object.values((window.state || {}).personalData || {}).forEach(function (pd) {
      if (pd && pd.owned && pd.itemNum) nums[pd.itemNum] = true;
    });
    var opts = Object.keys(nums).sort().slice(0, 900).map(function (o) { return '<option value="' + String(o).replace(/"/g, '&quot;') + '">'; }).join('');
    var old = document.getElementById('pin-review-ov'); if (old) old.remove();
    var thumbs = [];
    _rvGroups.forEach(function (g) { g.files.forEach(function (f) { thumbs.push(f.id); }); });
    // v0.9.913 (Brad): desktop shows a two-column split — details on the left,
    // a big full-res photo filling the right half so you can read the label
    // without a separate zoom. Phone stays stacked (small screen).
    var _wide = !window.IS_MOBILE_UA && (window.innerWidth || 0) >= 900;
    var _mainFid = thumbs[0];

    // v0.9.963 (Brad): answer-first layout. The read summary + catalog details
    // lead the card in a readable size (that's what you came to see); the number
    // box and actions follow; research helpers sit at the bottom. No emoji.
    var _controlsHtml =
      (_pinLensGroups ? _pinLensBannerHtml() : '') +   // v0.9.962: waiting-for-answer reminder after Research by Photo
      _pinAiLine() +
      '<div id="pin-rv-info" style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:0.85rem 0.95rem;margin-bottom:0.7rem;display:flex;flex-direction:column;gap:0.4rem"></div>' +
      '<input id="pin-rv-num" list="pin-rv-list" type="text" value="' + sug.replace(/"/g, '&quot;') + '" placeholder="Item number — e.g. 2343 or 6464-1" autocomplete="off" spellcheck="false" oninput="_pinReviewLookup(this.value)" style="width:100%;box-sizing:border-box;padding:0.6rem 0.75rem;border:1px solid var(--border);border-radius:8px;background:var(--surface2);color:var(--text);font-family:var(--font-mono);font-size:1rem;margin-bottom:0.55rem">' +
      '<datalist id="pin-rv-list">' + opts + '</datalist>' +
      _pinAltChips() +
      '<button id="pin-rv-rescan" onclick="_pinRescan()" title="Forget this read and scan the photo again at higher detail" style="width:100%;padding:0.55rem;border-radius:9px;border:1.5px solid #f05008;background:rgba(240,80,8,0.10);color:#f05008;font-family:var(--font-body);font-weight:700;font-size:0.85rem;cursor:pointer;margin-bottom:0.85rem">This is wrong — re-scan</button>' +
      // v0.9.958 (Brad): four clear exits — once you know what the item is,
      // pick where the photo goes. File a new item, add photos to one you
      // already own, list it for sale (which also files it), or bin it.
      '<div style="font-size:0.74rem;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.03em;margin:0.1rem 0 0.5rem">What do you want to do with it?</div>' +
      '<button id="pin-rv-add" onclick="_pinFileToCollection()" class="btn-primary" style="width:100%;padding:0.75rem;border-radius:10px;border:none;font-family:var(--font-body);font-weight:700;font-size:0.95rem;cursor:pointer;margin-bottom:0.5rem">Add to my Collection</button>' +
      '<button id="pin-rv-sell" onclick="_pinSendForSale()" style="width:100%;padding:0.7rem;border-radius:10px;border:1.5px solid #d4a843;background:rgba(212,168,67,0.12);color:#d4a843;font-family:var(--font-body);font-weight:700;font-size:0.92rem;cursor:pointer;margin-bottom:0.5rem">Add to Sales List</button>' +
      '<button onclick="_pinReviewDiscard()" style="width:100%;padding:0.7rem;border-radius:10px;border:1.5px solid #8b8e94;background:rgba(139,142,148,0.12);color:#f05008;font-family:var(--font-body);font-weight:700;font-size:0.92rem;cursor:pointer;margin-bottom:0.9rem">Discard Photo' + (n > 1 ? 's' : '') + '</button>' +
      // Identify helpers — only needed when you're not sure of the number.
      '<div style="font-size:0.74rem;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.03em;margin:0 0 0.5rem;padding-top:0.6rem;border-top:1px dashed var(--border)">Not sure what it is?</div>' +
      '<div style="display:flex;gap:0.5rem;margin-bottom:0.5rem">' +
        '<button onclick="_pinReviewResearch()" style="flex:1;padding:0.6rem;border-radius:9px;border:1.5px solid #8b8e94;background:rgba(139,142,148,0.12);color:#2980b9;font-family:var(--font-body);font-weight:700;font-size:0.86rem;cursor:pointer">Research Number</button>' +
        '<button id="pin-rv-lens" onclick="_pinReviewLens()" style="flex:1;padding:0.6rem;border-radius:9px;border:1.5px solid #8b8e94;background:rgba(139,142,148,0.12);color:#2980b9;font-family:var(--font-body);font-weight:700;font-size:0.86rem;cursor:pointer">Research by Photo</button>' +
      '</div>' +
      // v0.9.915 (Brad): after a Google/Lens search, screenshot the answer and
      // read it — the reader pulls the number/description off the shot for free.
      '<button id="pin-rv-shot" onclick="_pinReadShot()" title="Pick a screenshot of a Google/Lens answer and let it read the number for free" style="width:100%;padding:0.6rem;border-radius:9px;border:1.5px solid #2ecc71;background:rgba(46,204,113,0.10);color:#2ecc71;font-family:var(--font-body);font-weight:700;font-size:0.86rem;cursor:pointer">Read a screenshot of the answer</button>';

    // Phone: horizontal strip on top (unchanged).
    var _stripHtml =
      '<div id="pin-rv-photos" style="display:flex;gap:0.45rem;overflow-x:auto;-webkit-overflow-scrolling:touch;margin-bottom:0.7rem">' +
        thumbs.slice(0, 12).map(function (fidT, i) {
          return '<div style="position:relative;flex-shrink:0;width:' + (i === 0 ? '160px;height:160px' : '74px;height:74px;align-self:flex-end') + ';border-radius:10px;overflow:hidden;background:var(--surface2,#26262e)">' +
            '<img data-rvfid="' + fidT + '" onclick="_pinZoomPhoto(\'' + fidT + '\')" title="Tap to view full size — zoom in to read the label" style="width:100%;height:100%;object-fit:cover;display:block;cursor:zoom-in" alt="">' +
            '<button onclick="event.stopPropagation();_pinZoomPhoto(\'' + fidT + '\')" title="View full size" style="position:absolute;left:4px;bottom:4px;width:26px;height:26px;border-radius:7px;border:none;background:rgba(0,0,0,0.55);color:#fff;font-size:0.8rem;line-height:1;cursor:pointer;padding:0">🔍</button>' +
            '<button onclick="event.stopPropagation();_pinCropPhoto(\'' + fidT + '\')" title="Crop / Rotate this photo" style="position:absolute;top:4px;right:4px;width:26px;height:26px;border-radius:7px;border:none;background:rgba(0,0,0,0.55);color:#fff;font-size:0.85rem;line-height:1;cursor:pointer;padding:0">✂</button>' +
          '</div>';
        }).join('') +
      '</div>';

    // Desktop: big photo panel on the right; other photos as a strip beneath.
    var _cornBtn = 'position:absolute;width:30px;height:30px;border-radius:8px;border:none;background:rgba(0,0,0,0.6);color:#fff;font-size:0.9rem;line-height:1;cursor:pointer;padding:0;z-index:2';
    var _panelHtml =
      '<div style="flex:1 1 50%;min-width:0;display:flex;flex-direction:column;gap:0.5rem">' +
        '<div style="position:relative;flex:1;min-height:360px;border-radius:12px;overflow:hidden;background:var(--surface2,#26262e);display:flex;align-items:center;justify-content:center">' +
          '<img id="pin-rv-main" data-rvbig="' + _mainFid + '" onclick="_pinZoomPhoto(this.getAttribute(\'data-rvbig\'))" title="Tap for full-screen zoom" style="max-width:100%;max-height:74vh;object-fit:contain;display:block;cursor:zoom-in" alt="">' +
          '<button onclick="_pinZoomPhoto(document.getElementById(\'pin-rv-main\').getAttribute(\'data-rvbig\'))" title="Full-screen zoom" style="' + _cornBtn + ';left:8px;bottom:8px">🔍</button>' +
          '<button onclick="_pinCropPhoto(document.getElementById(\'pin-rv-main\').getAttribute(\'data-rvbig\'))" title="Crop / Rotate this photo" style="' + _cornBtn + ';top:8px;right:8px">✂</button>' +
        '</div>' +
        (thumbs.length > 1
          ? '<div style="display:flex;gap:0.4rem;overflow-x:auto;-webkit-overflow-scrolling:touch">' +
              thumbs.slice(0, 12).map(function (fidT) {
                return '<div onclick="_pinRvSetMain(\'' + fidT + '\')" title="Show this photo" style="position:relative;flex-shrink:0;width:64px;height:64px;border-radius:8px;overflow:hidden;background:var(--surface2,#26262e);cursor:pointer;border:1.5px solid transparent">' +
                  '<img data-rvfid="' + fidT + '" style="width:100%;height:100%;object-fit:cover;display:block" alt=""></div>';
              }).join('') +
            '</div>'
          : '') +
      '</div>';

    // v0.9.964 (Brad): DESKTOP layout — the "From the photo" read and the
    // catalog details sit as full-width boxes across the TOP, the photo fills
    // the middle full-width, and the action buttons run in a row across the
    // BOTTOM. (Phone stays stacked below.)
    var _photoWide =
      '<div style="position:relative;border-radius:12px;overflow:hidden;background:var(--surface2,#26262e);display:flex;align-items:center;justify-content:center;max-height:52vh;margin-bottom:0.5rem">' +
        '<img id="pin-rv-main" data-rvbig="' + _mainFid + '" onclick="_pinZoomPhoto(this.getAttribute(\'data-rvbig\'))" title="Tap for full-screen zoom" style="max-width:100%;max-height:52vh;object-fit:contain;display:block;cursor:zoom-in" alt="">' +
        '<button onclick="_pinZoomPhoto(document.getElementById(\'pin-rv-main\').getAttribute(\'data-rvbig\'))" title="Full-screen zoom" style="' + _cornBtn + ';left:8px;bottom:8px">🔍</button>' +
        '<button onclick="_pinCropPhoto(document.getElementById(\'pin-rv-main\').getAttribute(\'data-rvbig\'))" title="Crop / Rotate this photo" style="' + _cornBtn + ';top:8px;right:8px">✂</button>' +
      '</div>' +
      (thumbs.length > 1
        ? '<div style="display:flex;gap:0.4rem;overflow-x:auto;-webkit-overflow-scrolling:touch;margin-bottom:0.6rem">' +
            thumbs.slice(0, 12).map(function (fidT) {
              return '<div onclick="_pinRvSetMain(\'' + fidT + '\')" title="Show this photo" style="position:relative;flex-shrink:0;width:64px;height:64px;border-radius:8px;overflow:hidden;background:var(--surface2,#26262e);cursor:pointer;border:1.5px solid transparent">' +
                '<img data-rvfid="' + fidT + '" style="width:100%;height:100%;object-fit:cover;display:block" alt=""></div>';
            }).join('') +
          '</div>'
        : '');
    var _aiL = _pinAiLine(), _chips = _pinAltChips();
    var _wideBtn = 'flex:1 1 160px;padding:0.72rem 0.6rem;border-radius:10px;font-family:var(--font-body);font-weight:700;font-size:0.9rem;cursor:pointer;';
    var _wideBody =
      (_pinLensGroups ? _pinLensBannerHtml() : '') +
      // Top: two full-width info boxes above the photo (or just details if no read yet).
      (_aiL
        ? '<div style="display:flex;gap:1rem;align-items:stretch;margin-bottom:0.8rem">' +
            '<div style="flex:1.25;min-width:0">' + _aiL + '</div>' +
            '<div style="flex:1;min-width:0"><div id="pin-rv-info" style="height:100%;box-sizing:border-box;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:0.85rem 0.95rem;display:flex;flex-direction:column;gap:0.4rem"></div></div>' +
          '</div>'
        : '<div id="pin-rv-info" style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:0.85rem 0.95rem;margin-bottom:0.8rem;display:flex;flex-direction:column;gap:0.4rem"></div>') +
      _photoWide +
      // Number + re-scan on one row.
      '<div style="display:flex;gap:0.5rem;margin-bottom:0.55rem">' +
        '<input id="pin-rv-num" list="pin-rv-list" type="text" value="' + sug.replace(/"/g, '&quot;') + '" placeholder="Item number — e.g. 2343 or 6464-1" autocomplete="off" spellcheck="false" oninput="_pinReviewLookup(this.value)" style="flex:1;min-width:0;box-sizing:border-box;padding:0.6rem 0.75rem;border:1px solid var(--border);border-radius:8px;background:var(--surface2);color:var(--text);font-family:var(--font-mono);font-size:1rem">' +
        '<datalist id="pin-rv-list">' + opts + '</datalist>' +
        '<button id="pin-rv-rescan" onclick="_pinRescan()" title="Forget this read and scan the photo again at higher detail" style="padding:0.5rem 0.9rem;border-radius:9px;border:1.5px solid #f05008;background:rgba(240,80,8,0.10);color:#f05008;font-family:var(--font-body);font-weight:700;font-size:0.85rem;cursor:pointer;white-space:nowrap">This is wrong — re-scan</button>' +
      '</div>' +
      _chips +
      // Actions across the bottom.
      '<div style="font-size:0.74rem;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.03em;margin:0.35rem 0 0.5rem">What do you want to do with it?</div>' +
      '<div style="display:flex;gap:0.6rem;flex-wrap:wrap;margin-bottom:0.75rem">' +
        '<button id="pin-rv-add" onclick="_pinFileToCollection()" class="btn-primary" style="' + _wideBtn + 'border:none">Add to my Collection</button>' +
        '<button id="pin-rv-sell" onclick="_pinSendForSale()" style="' + _wideBtn + 'border:1.5px solid #d4a843;background:rgba(212,168,67,0.12);color:#d4a843">Add to Sales List</button>' +
        '<button onclick="_pinReviewDiscard()" style="' + _wideBtn + 'border:1.5px solid #8b8e94;background:rgba(139,142,148,0.12);color:#f05008">Discard Photo' + (n > 1 ? 's' : '') + '</button>' +
      '</div>' +
      '<div style="font-size:0.74rem;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.03em;margin:0 0 0.5rem;padding-top:0.6rem;border-top:1px dashed var(--border)">Not sure what it is?</div>' +
      '<div style="display:flex;gap:0.5rem;flex-wrap:wrap">' +
        '<button onclick="_pinReviewResearch()" style="flex:1 1 130px;padding:0.6rem;border-radius:9px;border:1.5px solid #8b8e94;background:rgba(139,142,148,0.12);color:#2980b9;font-family:var(--font-body);font-weight:700;font-size:0.86rem;cursor:pointer">Research Number</button>' +
        '<button id="pin-rv-lens" onclick="_pinReviewLens()" style="flex:1 1 130px;padding:0.6rem;border-radius:9px;border:1.5px solid #8b8e94;background:rgba(139,142,148,0.12);color:#2980b9;font-family:var(--font-body);font-weight:700;font-size:0.86rem;cursor:pointer">Research by Photo</button>' +
        '<button id="pin-rv-shot" onclick="_pinReadShot()" title="Pick a screenshot of a Google/Lens answer and let it read the number for free" style="flex:1 1 130px;padding:0.6rem;border-radius:9px;border:1.5px solid #2ecc71;background:rgba(46,204,113,0.10);color:#2ecc71;font-family:var(--font-body);font-weight:700;font-size:0.86rem;cursor:pointer">Read a screenshot of the answer</button>' +
      '</div>';

    var ov = document.createElement('div');
    ov.id = 'pin-review-ov';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem';
    ov.innerHTML =
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:1.1rem;max-width:' + (_wide ? '820px' : '460px') + ';width:100%;max-height:94vh;overflow-y:auto">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.6rem">' +
          '<div style="font-family:var(--font-head);font-weight:700;font-size:1rem;color:var(--text)">' + n + ' photo' + (n > 1 ? 's' : '') + ' · one item</div>' +
          '<button onclick="document.getElementById(\'pin-review-ov\').remove()" style="background:none;border:none;color:var(--text-dim);font-size:1.35rem;line-height:1;cursor:pointer;padding:0.1rem 0.3rem">✕</button>' +
        '</div>' +
        (_wide ? _wideBody : _stripHtml + _controlsHtml) +
      '</div>';
    document.body.appendChild(ov);
    ov.querySelectorAll('img[data-rvfid]').forEach(function (img) {
      loadDriveThumb(img.getAttribute('data-rvfid'), img, img.parentElement, null, 'hi');
    });
    var _rvMainImg = document.getElementById('pin-rv-main');
    if (_rvMainImg && window._pinRvLoadFull) window._pinRvLoadFull(_rvMainImg, _rvMainImg.getAttribute('data-rvbig'));
    _pinReviewLookup(sug);
  };

  // "From the photo" line — everything the AI read, so a wrong read (e.g. a
  // background box's number) is obvious at a glance. (Brad, 2026-07-16)
  function _pinAiLine() {
    var s = {};
    try { s = _ids()[_rvGroups[0].files[0].id] || {}; } catch (e) {}
    var bits = [s.mfr, s.road, s.desc, s.year ? '(' + s.year + ')' : ''].filter(Boolean).join(' ');
    if (!bits && !s.num) return '';
    var esc = function (t) { return String(t).replace(/</g, '&lt;'); };
    // v0.9.898: hedged reads show as an explicit BEST GUESS (orange), never
    // dressed up like a confident read.
    var col = s.guess ? '#ffb454' : '#7ec3ef';
    var bg  = s.guess ? 'rgba(255,180,84,0.08)' : 'rgba(41,128,185,0.06)';
    var lbl = s.guess ? 'Best guess from the photo:' : 'From the photo:';
    var tail = s.guess ? ' · not certain — double-check against your item' : ' · double-check this against your item';
    // v0.9.963 (Brad): bigger, answer-first — the description reads as the
    // headline, with a small colored label above and the caution note below.
    return '<div style="margin-bottom:0.6rem;padding:0.6rem 0.75rem;border-left:3px solid ' + col + ';background:' + bg + ';border-radius:0 8px 8px 0">' +
      '<div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.03em;color:' + col + ';margin-bottom:0.25rem">' + lbl.replace(/:$/, '') + '</div>' +
      '<div style="font-size:0.98rem;color:var(--text);line-height:1.4"><span style="font-weight:600">' + (bits ? esc(bits) : 'number only') + '</span>' + (s.num ? ' — No. ' + esc(s.num) : '') + '</div>' +
      '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.25rem">' + tail.replace(/^ · /, '') + '</div>' +
      '</div>';
  }

  // v0.9.901 (Brad): pick-one chips when the AI listed look-alike variants —
  // the ★ chip is its best guess; tapping any chip fills the number box and
  // runs the catalog lookup so the descriptions tell the twins apart.
  function _pinAltChips() {
    var s = {};
    try { s = _ids()[_rvGroups[0].files[0].id] || {}; } catch (e) {}
    var alts = Array.isArray(s.alts) ? s.alts.slice(0) : [];
    if (!alts.length) return '';
    var primary = String(s.num || '');
    var esc = function (t) { return String(t).replace(/</g, '&lt;').replace(/"/g, '&quot;'); };
    var covered = alts.some(function (a) { return primary && a.indexOf(primary) > -1; });
    if (primary && !covered) alts.unshift(primary + ' (best guess)');
    var chips = alts.map(function (a) {
      var m = String(a).match(/[0-9][0-9A-Za-z.\-\/]*/);
      var n = m ? m[0] : '';
      var hot = !!(n && primary && n === primary);
      return '<button onclick="_pinPickNum(\'' + esc(n) + '\')" style="padding:0.35rem 0.6rem;border-radius:8px;border:1.5px solid ' + (hot ? '#ffb454' : 'var(--border)') + ';background:' + (hot ? 'rgba(255,180,84,0.14)' : 'var(--surface2)') + ';color:' + (hot ? '#ffb454' : 'var(--text-mid)') + ';font-size:0.75rem;font-weight:700;cursor:pointer;font-family:var(--font-body)">' + (hot ? '★ ' : '') + esc(a) + '</button>';
    }).join('');
    return '<div style="margin-bottom:0.6rem">' +
      '<div style="font-size:0.72rem;color:var(--text-dim);margin-bottom:0.3rem">Could be one of these — tap each to compare (★ = best guess):</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:0.4rem">' + chips + '</div></div>';
  }

  window._pinPickNum = function (n) {
    var i = document.getElementById('pin-rv-num');
    if (i) i.value = n || '';
    window._pinReviewLookup(n || '');
  };

  // Research by Photo — the app's existing Lens route (stage the photo
  // publicly for 10 minutes, open Google image search with a structured
  // question). Same machinery the wizard's identify uses.
  window._pinReviewLens = async function () {
    var gs = _rvGroups;
    if (!gs.length) return;
    if (!_qcToken()) { showToast('Please sign in first', 3000, true); return; }
    var tab = null;
    try { tab = window.open('', '_blank'); } catch (e) {}
    var btn = document.getElementById('pin-rv-lens');
    if (btn) { btn.disabled = true; btn.textContent = 'Staging photo…'; }
    try {
      var blob = await _pinBytes(gs[0].files[0].id);
      var file = new File([blob], 'inbox-photo.jpg', { type: blob.type || 'image/jpeg' });
      var staged = await driveStageLensPhoto(file);
      setTimeout(function () { try { driveCleanupLensStaging(staged.id); } catch (e) {} }, 10 * 60 * 1000);
      // v0.9.917 (Brad): question text built by the ONE shared builder in
      // ai-id.js (rrIdentifyQuery) — change it there, every button updates.
      var q = (typeof window.rrIdentifyQuery === 'function')
        ? window.rrIdentifyQuery({})
        : 'Identify this model railroad item. Provide Manufacturer; Manufacturer SKU or catalog number; Year; Scale; Description on labeled lines.';
      // v0.9.959 (Brad): Google retired /searchbyimage (it 404s now) and moved
      // reverse-image search to Google Lens. uploadbyurl runs the real search on
      // the staged photo. Lens takes no text hint, so `q` is unused here.
      var url = 'https://lens.google.com/uploadbyurl?url=' + encodeURIComponent(staged.url);
      if (tab) { try { tab.location = url; } catch (e) { tab = null; } }
      if (!tab) window.open(url, '_blank');
      if (btn) { btn.disabled = false; btn.textContent = 'Research by Photo'; }
      // v0.9.895 (Brad: "i copied it, now what?") — same return trip as the
      // wizard's Lens flow: when he comes back with Google's answer copied,
      // parse the clipboard and reopen the review card with it applied.
      _pinLensArm(gs);
      // v0.9.962 (Brad): show the reminder right on the open card now, and it
      // re-renders on the return-trip too (armed state -> banner in _pinReview).
      try {
        var _numEl = document.getElementById('pin-rv-num');
        if (_numEl && !document.getElementById('pin-lens-banner')) {
          var _bWrap = document.createElement('div');
          _bWrap.innerHTML = _pinLensBannerHtml();
          if (_bWrap.firstChild) _numEl.parentNode.insertBefore(_bWrap.firstChild, _numEl);
        }
      } catch (eB) {}
      showToast('In the Google tab: Ctrl+A, Ctrl+C, then come back and press Ctrl+V', 4500);
    } catch (e) {
      console.warn('[Inbox] research-by-photo:', e);
      try { if (tab) tab.close(); } catch (e2) {}
      if (btn) { btn.disabled = false; btn.textContent = 'Research by Photo'; }
      showToast('Could not stage the photo for Google — try again', 3000, true);
    }
  };

  // v0.9.962 (Brad): the "waiting for Google's answer" reminder shown on the
  // review card after Research by Photo. Can't draw on Google's tab (cross-site
  // security), so the reminder lives here, where the answer comes back.
  function _pinLensBannerHtml() {
    return '<div id="pin-lens-banner" style="background:rgba(212,168,67,0.14);border:1.5px solid var(--accent2,#d4a843);border-radius:9px;padding:0.55rem 0.7rem;margin-bottom:0.6rem;font-size:0.8rem;color:var(--text-mid);line-height:1.45">' +
      '<b>Waiting for Google’s answer.</b> In the Google tab press <b>Ctrl+A</b> then <b>Ctrl+C</b>, come back here and press <b>Ctrl+V</b>. (Or snip it with Win+Shift+S and Ctrl+V.)' +
      '</div>';
  }

  // v0.9.915 (Brad): read a SCREENSHOT of a Google/Lens answer. Pick the
  // screenshot, run it through the same identify AI (it reads the labeled
  // Manufacturer/SKU/Description/Year text right off the image), then apply
  // the result to the group and reopen the review card — same shape as the
  // Lens clipboard return-trip, minus the fiddly text-copy step.
  // v0.9.962 (Brad): ONE place that applies a parsed reading (from a snip, a
  // copied answer, or the Lens return-trip) to the open group and reopens the
  // review card. Returns false if the metadata had nothing usable.
  function _pinApplyMeta(meta, gs) {
    var got = meta && (meta.itemNum || meta.description || meta.manufacturer || meta.roadName);
    if (!got) return false;
    try {
      var ids = _ids(); var fid0 = gs[0].files[0].id; var prev = ids[fid0] || {};
      var trim = function (v, old) { return String(v || old || '').slice(0, 120); };
      ids[fid0] = {
        num: meta.itemNum ? String(meta.itemNum) : (prev.num || ''),
        guess: meta.itemNum ? (meta._hedge ? 1 : 0) : (prev.guess || 0),
        tried: 1,
        mfr: trim(meta.manufacturer, prev.mfr), desc: trim(meta.description, prev.desc),
        road: trim(meta.roadName, prev.road), year: trim(meta.year, prev.year)
      };
      _idsSave(ids);
    } catch (eS) { console.warn('[Inbox] apply meta:', eS); }
    _render();
    _sel = {};
    gs.forEach(function (g) { _sel[g.key] = true; });
    window._pinReview(gs.length === 1 ? gs[0].key : null);
    return true;
  }

  // Read a screenshot/snip blob: free OCR first, then a token read, then apply.
  async function _pinProcessShot(f) {
    var gs = _rvGroups;
    if (!gs || !gs.length) { showToast('Open a photo first', 2500, true); return; }
    if (!_qcToken()) { showToast('Please sign in first', 3000, true); return; }
    if (typeof aiIdentifyImage2 !== 'function' && typeof aiIdentifyImage !== 'function') { showToast('Identify service not loaded — refresh and try again', 3000, true); return; }
    if (!f) return;
    var btn = document.getElementById('pin-rv-shot');
    if (btn) { btn.disabled = true; btn.textContent = 'Reading screenshot…'; }
    try {
      // v0.9.917 (Brad): CHEAP FIRST. A screenshot is crisp digital text, so
      // try free on-device OCR (Tesseract) before spending a token. Only fall
      // back to the paid read when the free read doesn't yield an item number.
      var meta = null, _freeRead = false;
      try {
        if (typeof window._ensureTesseract === 'function' && typeof extractIdentifyMetadata === 'function') {
          var T = await window._ensureTesseract();
          var ocr = await T.recognize(f, 'eng', {});
          var _otxt = (ocr && ocr.data && ocr.data.text) || '';
          if (_otxt.trim()) {
            var m0 = extractIdentifyMetadata(_otxt);
            if (m0 && m0.itemNum) { meta = m0; _freeRead = true; }   // free read good enough only with a number
          }
        }
      } catch (eOcr) { console.warn('[Inbox] screenshot OCR (free pass) failed:', eOcr && eOcr.message); }
      if (!meta) {
        if (btn) btn.textContent = 'Reading…';
        var ai = (typeof aiIdentifyImage2 === 'function') ? await aiIdentifyImage2([f], {}) : await aiIdentifyImage(f, {});
        if (!ai || !ai.ok) {
          var why = ai && ai.reason;
          if (why === 'quota') showToast('No tokens left today — type the number, or try tomorrow', 4500, true);
          else if (why === 'noconsent') { /* consent dialog already handled */ }
          else showToast('Could not read that screenshot — type the number instead', 3800, true);
          return;
        }
        meta = (typeof extractIdentifyMetadata === 'function') ? extractIdentifyMetadata(ai.text) : {};
      }
      if (!_pinApplyMeta(meta, gs)) { showToast('No item info found in that screenshot — type the number instead', 4000, true); return; }
      showToast(meta._hedge
        ? 'Read the screenshot — the number is a best guess, double-check it'
        : ('Read the screenshot' + (_freeRead ? ' (free — no token used)' : '') + ' — check it over and hit Add'), 4000);
    } catch (e) {
      console.warn('[Inbox] read screenshot:', e);
      showToast('Could not read that screenshot — try again or type the number', 3800, true);
    } finally {
      var b2 = document.getElementById('pin-rv-shot');
      if (b2) { b2.disabled = false; b2.textContent = 'Read a screenshot of the answer'; }
    }
  }

  // Read copied TEXT (e.g. Ctrl+A, Ctrl+C of the Google answer) — parse it and
  // apply. No token used; text parsing is free.
  function _pinProcessText(txt) {
    var gs = _rvGroups;
    if (!gs || !gs.length) return false;
    txt = String(txt || '').trim();
    if (!txt) return false;
    var meta = (typeof extractIdentifyMetadata === 'function') ? extractIdentifyMetadata(txt) : {};
    if (!_pinApplyMeta(meta, gs)) return false;
    showToast(meta._hedge
      ? 'Read the copied answer — the number is a best guess, double-check it'
      : 'Read the copied answer — check it over and hit Add', 4000);
    return true;
  }

  window._pinReadShot = function () {
    var gs = _rvGroups;
    if (!gs || !gs.length) { showToast('Open a photo first', 2500, true); return; }
    if (!_qcToken()) { showToast('Please sign in first', 3000, true); return; }
    if (typeof aiIdentifyImage2 !== 'function' && typeof aiIdentifyImage !== 'function') { showToast('Identify service not loaded — refresh and try again', 3000, true); return; }
    var inp = document.getElementById('pin-shot-input');
    if (!inp) {
      inp = document.createElement('input');
      inp.type = 'file'; inp.id = 'pin-shot-input'; inp.accept = 'image/*'; inp.style.display = 'none';
      document.body.appendChild(inp);
    }
    inp.value = '';
    inp.onchange = function () { var f = this.files && this.files[0]; this.value = ''; if (f) _pinProcessShot(f); };
    inp.click();
  };

  // v0.9.962 (Brad): paste-to-read. While the review card is open, press Ctrl+V
  // to read whatever you grabbed from Google — a snipped picture OR copied text
  // (highlight the answer, or just Ctrl+A the whole page). One keystroke, no
  // button, no file picker. A short manual paste into the number box is left
  // alone so typing/pasting a number still works.
  document.addEventListener('paste', function (e) {
    if (!document.getElementById('pin-review-ov')) return;      // only when the review card is open
    if (!_rvGroups || !_rvGroups.length) return;
    var cd = e.clipboardData; if (!cd) return;
    // A picture on the clipboard (a snip) — always read it.
    var items = cd.items || [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].type && items[i].type.indexOf('image') === 0) {
        var f = items[i].getAsFile();
        if (f) { e.preventDefault(); showToast('Reading your snip…', 1800); _pinProcessShot(f); return; }
      }
    }
    // Otherwise copied text (the answer). Don't hijack a short paste into a field.
    var txt = (cd.getData && cd.getData('text')) || '';
    txt = txt.trim();
    if (!txt) return;
    var t = e.target;
    var inField = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA');
    if (inField && txt.length < 25) return;   // let a short manual paste land in the box
    e.preventDefault();
    showToast('Reading the copied answer…', 1800);
    _pinProcessText(txt);
  });

  // Return-trip watcher for Research by Photo (mirrors the wizard's
  // _identifyReadClipboard flow): on tab-return, read the clipboard, parse
  // Google's copied answer, merge it into the group's stored findings, and
  // reopen the review card. Watches for 15 minutes, ignores an unchanged
  // clipboard, and gives up silently on clipboard-permission denials.
  var _pinLensGroups = null, _pinLensClip = '', _pinLensVisOn = false, _pinLensArmedAt = 0;
  function _pinLensArm(gs) {
    _pinLensGroups = gs;
    _pinLensArmedAt = new Date().getTime();
    _pinLensClip = '';
    try { navigator.clipboard.readText().then(function (t) { _pinLensClip = (t || '').trim(); }).catch(function () {}); } catch (e) {}
    if (!_pinLensVisOn) {
      _pinLensVisOn = true;
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible' && _pinLensGroups) setTimeout(_pinLensCheck, 450);
      });
    }
  }
  function _pinLensCheck() {
    if (!_pinLensGroups) return;
    if (new Date().getTime() - _pinLensArmedAt > 15 * 60 * 1000) { _pinLensGroups = null; return; }
    if (!navigator.clipboard || !navigator.clipboard.readText) return;
    navigator.clipboard.readText().then(function (txt) {
      txt = (txt || '').trim();
      if (!txt || txt === _pinLensClip) return;   // nothing new copied yet — keep watching
      _pinLensClip = txt;
      var meta = (typeof extractIdentifyMetadata === 'function') ? extractIdentifyMetadata(txt) : {};
      var got = meta.itemNum || meta.description || meta.manufacturer || meta.roadName;
      if (!got) return;                            // unrelated clipboard — keep watching
      var gs = _pinLensGroups;
      _pinLensGroups = null;
      // v0.9.962: same shared applier as the snip/paste paths.
      if (_pinApplyMeta(meta, gs)) {
        showToast(meta._hedge
          ? "Google's answer applied, but it hedged on the number — double-check it"
          : "Google's answer applied — check it over and hit Add", 4000);
      }
    }).catch(function () { /* permission denied — the number box still takes a manual paste */ });
  }

  window._pinReviewResearch = function () {
    var num = (document.getElementById('pin-rv-num') || {}).value || '';
    num = String(num).trim();
    if (!num) { showToast('Type an item number to research', 2500, true); return; }
    var ov = document.getElementById('pin-review-ov'); if (ov) ov.remove();
    if (typeof window._researchLookupTyped === 'function') window._researchLookupTyped(num);
    else showToast('Research is still loading — try again in a moment', 3000, true);
  };

  window._pinReviewDiscard = function () {
    var gs = _rvGroups;
    if (!gs.length) return;
    var ov = document.getElementById('pin-review-ov'); if (ov) ov.remove();
    _sel = {};
    gs.forEach(function (g) { _sel[g.key] = true; });
    _pinDiscard();
  };

  // Shared filing core: move every photo in `gs` into the item's Drive
  // folder, connect the sheet's photo link when the item is owned, or
  // remember the link + open the Add wizard when it isn't.
  window._pinReviewAdd = async function (mode) {
    mode = mode || 'auto';
    var num = String((document.getElementById('pin-rv-num') || {}).value || '').trim();
    if (!num) { showToast('Type or confirm the item number first', 2500, true); return; }
    var gs = _rvGroups;
    if (!gs.length || _busy) return;
    // Ownership decides File-vs-Attach, so check it before we commit anything.
    var lkPre = _pinLookup(num);
    if (mode === 'attach' && !lkPre.ownedPd) {
      showToast('You don’t own ' + num + ' yet — use “File to my Collection” to add it, or type a number you already own', 5000, true);
      return;
    }
    var ov = document.getElementById('pin-review-ov'); if (ov) ov.remove();
    _busy = true;
    try {
      var fromFid = await _folder();
      var toFid = await driveEnsureItemFolder(num);
      var link = driveFolderLink(toFid);
      var lk = lkPre;
      // Attach path when the user asked to attach, or when it's an owned item
      // being auto-filed / listed for sale. 'new' always makes a fresh item.
      // v0.9.966 (Brad): only the (now-unused) explicit 'attach' mode attaches.
      // 'new' and 'forsale' ALWAYS create a new item — multiples are allowed, so
      // we never silently fold photos into an item you already own.
      var _attach = (mode === 'attach');
      // Gather every selected file once (used whether we move now or on save).
      var fileList = [];
      for (var g = 0; g < gs.length; g++) {
        for (var f = 0; f < gs[g].files.length; f++) { fileList.push(gs[g].files[f]); }
      }
      var ts = new Date().getTime();
      if (_attach) {
        // Already in the collection: committed action, no wizard to cancel,
        // so file the photos into its folder right away.
        var moved = 0;
        for (var i2 = 0; i2 < fileList.length; i2++) {
          moved++;
          _status('Filing photo ' + moved + '…');
          var file = fileList[i2];
          var ext = (file.name.split('.').pop() || 'jpg').toLowerCase().slice(0, 5);
          await driveMoveFileToFolder(file.id, fromFid, toFid);
          try { await driveRequest('PATCH', '/files/' + file.id, { name: num + ' ADD ' + (ts + moved) + '.' + ext }); } catch (eRn) {}
        }
        _sel = {};
        _status('');
        var pd = lk.ownedPd;
        if (!pd.photoItem && pd.row && typeof sheetsUpdate === 'function' && typeof personalColLetter === 'function' && window.state.personalSheetId) {
          pd.photoItem = link;
          try { await sheetsUpdate(state.personalSheetId, PERSONAL_TAB + '!' + personalColLetter('photoItem') + pd.row, [[link]]); } catch (eUp) { console.warn('[Inbox] photo link write:', eUp); }
        }
        showToast('Attached ' + moved + ' photo' + (moved > 1 ? 's' : '') + ' to ' + num, 3000);
        _pinRefresh();
        // v0.9.958 (Brad): "Send to For Sale" on an item you already own —
        // photos are filed above, now open the sale-price step for it.
        if (mode === 'forsale') {
          var _pdKey = Object.keys(state.personalData || {}).filter(function (k) { return state.personalData[k] === lk.ownedPd; })[0];
          if (_pdKey && typeof listForSaleFromCollection === 'function') { listForSaleFromCollection(-1, _pdKey); }
          else showToast('Photos attached — open ' + num + ' from My Collection to set a sale price', 4500);
        }
      } else {
        // NOT in the collection yet: the Add wizard opens next and may be
        // cancelled. DEFER moving the photos out of the inbox until the item
        // is actually saved (see _flushPending). Cancel = nothing moved and
        // the photos stay in the inbox. (Session 168, Brad — fixes vanishing photos)
        _sel = {};
        _status('');
        try {
          var pend = JSON.parse(localStorage.getItem(PENDING_KEY) || '{}');
          pend[num] = { link: link, fromFid: fromFid, toFid: toFid, ts: ts,
            rsvFid: (fileList[0] && fileList[0].id) || '',   // v0.9.935: files as the Right Side View
            files: fileList.map(function (fl) { return { id: fl.id, name: fl.name }; }) };
          localStorage.setItem(PENDING_KEY, JSON.stringify(pend));
        } catch (eP) {}
        _pinRefresh();
        showToast(fileList.length + ' photo' + (fileList.length > 1 ? 's' : '') + ' will attach when you save — they stay in the inbox until then', 3500);
        var _aiS = {}; try { _aiS = _ids()[gs[0].files[0].id] || {}; } catch (eAi) {}
        // v0.9.907 (Brad, item [1a]): hand the first inbox photo's Drive id to the
        // wizard so the variation step can preview the item you're adding.
        var _addPhotoId = (fileList[0] && fileList[0].id) || '';
        _pinAddNow(num, { manufacturer: _aiS.mfr || '', description: _aiS.desc || '', roadName: _aiS.road || '', year: _aiS.year || '' }, _addPhotoId, { alsoListForSale: mode === 'forsale' });
        if (mode === 'forsale') showToast('Adding ' + num + ' to your collection and For Sale list — set the price on the sale step', 4500);
      }
    } catch (e) {
      console.error('[Inbox] add/attach:', e);
      _status('Filing failed partway — hit Refresh to see what’s left, then try again.');
    } finally { _busy = false; }
  };

  // v0.9.958 (Brad): the four review-card exits are thin wrappers over the one
  // shared filer, so every path uses the exact same, tested Drive/sheet code.
  // v0.9.966 (Brad): "Add to my Collection" ALWAYS adds a new item — you can
  // own multiples of the same number, so it must never fold photos into an
  // existing item. (Adding photos to an item you already own is a separate flow.)
  window._pinFileToCollection = function () { return window._pinReviewAdd('new'); };
  window._pinAttachOwned      = function () { return window._pinReviewAdd('attach'); };
  window._pinSendForSale      = function () { return window._pinReviewAdd('forsale'); };

  window._pinAddNow = function (num, aiMeta, photoDriveId, opts) {
    if (typeof openWizard !== 'function') { showToast('Add wizard not available', 2500, true); return; }
    openWizard('collection');
    // v0.9.889 (Brad): pre-fill the ENTIRE catalog side of the add, the same
    // way a successful barcode scan does — lock the matched catalog item,
    // adopt its era, and jump past the item-number step. Only the personal
    // questions (condition, price, photos) remain for the user.
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      var ready = (typeof wizard !== 'undefined') && wizard && wizard.steps && wizard.data && document.getElementById('wizard-modal');
      if (ready) {
        clearInterval(t);
        try {
          wizard.data.itemNum = num;
          // v0.9.958 (Brad): "Send to For Sale" on a not-yet-owned item — flag
          // the add so it lands in My Collection AND on the For Sale list.
          if (opts && opts.alsoListForSale) { wizard.data._alsoListForSale = true; wizard.data._returnPage = wizard.data._returnPage || 'forsale'; }
          // v0.9.907 (Brad, item [1a]): stash the inbox photo's Drive id so the
          // variation step can preview it (loaded via loadDriveThumb).
          if (photoDriveId) wizard.data._addPhotoDriveId = photoDriveId;
          var m = _pinBestMaster(num, (aiMeta && aiMeta.manufacturer) || '');
          if (m && aiMeta && aiMeta.manufacturer) {
            var _mMk = m.manufacturer || ((typeof ERAS !== 'undefined' && ERAS[m._era]) ? ERAS[m._era].manufacturer : '');
            // v0.9.941: photo says one brand, number matches another -> treat as
            // no catalog match so the wizard makes a manual entry for the REAL
            // brand instead of silently adopting the wrong item (Marx 1303 vs
            // Atlas 1303).
            if (!_pinMfrAgree(aiMeta.manufacturer, _mMk)) m = null;
          }
          if (m) {
            wizard.matchedItem = m;
            if (m._era) wizard.data._era = m._era;
            wizard.step++;              // same advance a barcode scan does
            renderWizardStep();
            showToast('✓ ' + num + ' — catalog details filled in', 2500);
          } else if (typeof _identifyRouteToManualEntry === 'function' && _identifyRouteToManualEntry(num, aiMeta || {}, [])) {
            showToast(num + " isn't in the catalog — details from the photo are filled in", 3000);
          } else {
            // Last resort: behave like typing the number by hand.
            var inp = document.getElementById('wiz-input');
            if (inp) inp.value = num;
            try { if (typeof debouncedItemSuggestions === 'function') debouncedItemSuggestions(num); } catch (e) {}
          }
        } catch (e) { console.warn('[Inbox] wizard prefill:', e); }
      }
      if (tries > 20) clearInterval(t);
    }, 250);
  };

  // When an item is actually saved, file any pending inbox photos into its
  // Drive folder and connect the photo link. Runs on every dashboard build but
  // only acts on items that now exist in the collection, so a cancelled add
  // leaves its photos untouched in the inbox. (Session 168, Brad)
  var _flushingNums = {};
  async function _flushPending() {
    var pend;
    try { pend = JSON.parse(localStorage.getItem(PENDING_KEY) || '{}'); } catch (e) { pend = {}; }
    var nums = Object.keys(pend);
    if (!nums.length || !window.state || !state.personalData) return;
    for (var ni = 0; ni < nums.length; ni++) {
      var num = nums[ni];
      if (_flushingNums[num]) continue;
      var pd = Object.values(state.personalData).find(function (p) { return p && p.owned && String(p.itemNum) === num; });
      if (!pd) continue;   // item not saved yet -> leave its photos in the inbox
      _flushingNums[num] = true;
      try {
        var rec = pend[num];
        var link = (rec && typeof rec === 'object') ? rec.link : rec;  // back-compat: old entries were a plain link string
        if (rec && typeof rec === 'object' && rec.files && rec.files.length && rec.fromFid && rec.toFid) {
          var mv = 0;
          for (var fi = 0; fi < rec.files.length; fi++) {
            var file = rec.files[fi]; mv++;
            var ext = (String(file.name || '').split('.').pop() || 'jpg').toLowerCase().slice(0, 5);
            try {
              await driveMoveFileToFolder(file.id, rec.fromFid, rec.toFid);
              // v0.9.935 (Brad): the photo shown in the wizard's RSV slot files as
              // the Right Side View, so detail pages/thumbnails treat it as primary.
              var _vTag = (rec.rsvFid && file.id === rec.rsvFid) ? ' RSV ' : ' ADD ';
              try { await driveRequest('PATCH', '/files/' + file.id, { name: num + _vTag + ((rec.ts || new Date().getTime()) + mv) + '.' + ext }); } catch (eRn) {}
            } catch (eMv) { console.warn('[Inbox] deferred photo move skipped (removed?):', file.id, eMv); }
          }
        }
        if (pd.row && !pd.photoItem && link && typeof sheetsUpdate === 'function' && typeof personalColLetter === 'function' && state.personalSheetId) {
          pd.photoItem = link;
          try { await sheetsUpdate(state.personalSheetId, PERSONAL_TAB + '!' + personalColLetter('photoItem') + pd.row, [[link]]); } catch (eUp) { console.warn('[Inbox] pending link write:', eUp); }
        }
        try { var p2 = JSON.parse(localStorage.getItem(PENDING_KEY) || '{}'); delete p2[num]; localStorage.setItem(PENDING_KEY, JSON.stringify(p2)); } catch (eD) {}
        try { _pinRefresh(); } catch (eR) {}
      } finally { delete _flushingNums[num]; }
    }
  }

  // ── Batch AI identify (Phase 3, v0.9.886) ────────────────────
  // One button: every un-identified item group gets its FIRST photo
  // run through the existing identify relay (ai-id.js → Gemini).
  // Suggestions persist in localStorage, show on the tiles, and
  // pre-fill the File-to-item dialog. Sequential + cancelable.
  var IDS_KEY = 'rr_inbox_ids';
  function _ids() { try { return JSON.parse(localStorage.getItem(IDS_KEY) || '{}'); } catch (e) { return {}; } }
  function _idsSave(m) { try { localStorage.setItem(IDS_KEY, JSON.stringify(m)); } catch (e) {} }

  // v0.9.961 (Brad): persistent set of file IDs we've cropped. drive.js reads
  // window._rrForceFreshBytes to load their real (cropped) bytes instead of
  // Drive's stale server preview. Survives reloads via localStorage.
  function _cropped() { try { return JSON.parse(localStorage.getItem(CROPPED_KEY) || '{}'); } catch (e) { return {}; } }
  function _croppedSave(m) { try { localStorage.setItem(CROPPED_KEY, JSON.stringify(m)); } catch (e) {} window._rrForceFreshBytes = m; }
  function _markCropped(fid) { if (!fid) return; var c = _cropped(); c[fid] = 1; _croppedSave(c); }
  // Publish the current markers to drive.js up front, and again after each load
  // (pruned to what's still in the inbox so the set can't grow without bound).
  window._rrForceFreshBytes = _cropped();

  var _idAbort = false;
  window._pinIdentifyCancel = function () { _idAbort = true; };

  async function _pinBytes(fileId) {
    var r = await fetch('https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media', { headers: { Authorization: 'Bearer ' + window.accessToken } });
    if (!r.ok) throw new Error('photo download ' + r.status);
    return await r.blob();
  }

  // ── FREE auto-read: read the catalog number off each photo with on-device
  //    OCR (Tesseract.js from CDN) — no AI credits, runs in the background as
  //    photos land. Reads that the master confirms show as a solid number;
  //    unconfirmed reads show as a hedge; photos it can't read stay open for
  //    the paid AI. OCR is optional: if it won't load, paid identify still works.
  var _tessWorker = null, _tessTried = false, _autoReadBusy = false, _autoReadAbort = false;
  var FREE_TRIED_KEY = 'rr_inbox_freetried';
  function _freeTried() { try { return JSON.parse(localStorage.getItem(FREE_TRIED_KEY) || '{}'); } catch (e) { return {}; } }
  function _freeTriedSave(m) { try { localStorage.setItem(FREE_TRIED_KEY, JSON.stringify(m)); } catch (e) {} }

  function _loadTesseract() {
    if (window.Tesseract) return Promise.resolve(true);
    if (_loadTesseract._p) return _loadTesseract._p;
    _loadTesseract._p = new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      s.onload = function () { resolve(!!window.Tesseract); };
      s.onerror = function () { resolve(false); };
      document.head.appendChild(s);
    });
    return _loadTesseract._p;
  }

  async function _tessGet() {
    if (_tessWorker) return _tessWorker;
    if (_tessTried && !window.Tesseract) return null;
    if (!(await _loadTesseract())) { _tessTried = true; return null; }
    try {
      _tessWorker = await Tesseract.createWorker('eng');
      await _tessWorker.setParameters({ tessedit_char_whitelist: '0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ ' });
    } catch (e) { _tessWorker = null; }
    _tessTried = true;
    return _tessWorker;
  }

  async function _scaledCanvas(blob, maxDim) {
    var bmp = await createImageBitmap(blob);
    var sc = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    var w = Math.max(1, Math.round(bmp.width * sc)), h = Math.max(1, Math.round(bmp.height * sc));
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    // Grayscale + mild contrast makes printed numbers pop for OCR.
    try { ctx.filter = 'grayscale(1) contrast(1.3)'; } catch (e) {}
    ctx.drawImage(bmp, 0, 0, w, h);
    if (bmp.close) bmp.close();
    return c;
  }

  // Pull the best catalog-number candidate out of OCR text and confirm it
  // against the master. Busy box photos are full of noise text (marketing
  // copy, UPC barcodes, prices, years), so we: drop UPC/barcode-length runs,
  // PREFER a number the master actually knows, and prefer dashed catalog-style
  // numbers (6-17259, 6464-475) over bare digit blobs.
  function _numberFromText(text) {
    if (!text) return null;
    var UP = String(text).toUpperCase();
    // v0.9.959 (Brad): a 4-digit number sitting next to a © or a copyright
    // holder is a YEAR, not the catalog number — the Thomas box's "© 2012
    // LIONEL" was being read as item #2012. Ban those exact year tokens so they
    // can never be offered. Real Lionel numbers like 2037 / 2046 are never in a
    // copyright context, so they're untouched.
    var banned = {}, m;
    var reCopy = /(?:©|\(C\)|COPYRIGHT)\s*((?:19|20)\d{2})/g;
    while ((m = reCopy.exec(UP))) { banned[m[1]] = 1; }
    // ©-dropped fallback: OCR sometimes misses the © glyph, leaving "2012
    // GULLANE (THOMAS) LIMITED". Ban a year-range number only when a legal
    // suffix (L.L.C / LIMITED / INC …) sits within ~25 chars after it — that's
    // unmistakably a copyright line, not an item marking.
    var reHolder = /\b((?:19|20)\d{2})\b(?=[^0-9]{0,25}(?:L\.?L\.?C\b|LLC\b|LIMITED\b|LTD\b|\bINC\b|CORP\b|ENTERTAINMENT\b|TRADEMARK\b|GMBH\b))/g;
    while ((m = reHolder.exec(UP))) { banned[m[1]] = 1; }
    var toks = (UP.match(/\d[\dA-Z]*(?:-[\dA-Z]+)*/g) || [])
      .map(function (c) { return c.replace(/^-+|-+$/g, ''); })
      .filter(function (c) {
        if (!/\d/.test(c) || c.length < 3 || c.length > 10) return false;
        if (banned[c]) return false;                            // copyright year, not a catalog number
        var digits = c.replace(/\D/g, '');
        var alnum = c.replace(/[^0-9A-Za-z]/g, '');
        if (digits.length < alnum.length * 0.6) return false;   // mostly letters = junk (e.g. "4LIONEL", "MADE")
        if (digits.length >= 8 && c.indexOf('-') < 0) return false;   // UPC / barcode run
        return true;
      });
    var seen = {}, uniq = [];
    toks.forEach(function (c) { if (!seen[c]) { seen[c] = 1; uniq.push(c); } });
    var fm = (typeof findMaster === 'function') ? findMaster : null;
    var dashRank = function (a, b) {
      return (b.indexOf('-') >= 0 ? 1 : 0) - (a.indexOf('-') >= 0 ? 1 : 0) || b.length - a.length;
    };
    // 1) numbers the master confirms win — prefer the most specific (dashed/longer)
    var matched = uniq.filter(function (c) { return fm && (fm(c) || fm(c.replace(/^\d-/, ''))); });
    if (matched.length) { matched.sort(dashRank); return { num: matched[0], matched: true }; }
    // 2) nothing confirmed — offer the best catalog-shaped token as a hedge
    uniq.sort(dashRank);
    return uniq.length ? { num: uniq[0], matched: false } : null;
  }

  // Read any barcode on the photo and resolve it with the SAME brain the
  // Add-wizard scanner uses (window._barcodeDebug.decodeBarcode): it decodes a
  // Lionel UPC via the maker prefix + code and looks up the real catalog item.
  // So a modern retail UPC (e.g. 0-23922-… on a Thomas set) resolves to the
  // correct item instead of a stray number the OCR might grab.
  async function _readBarcode(blob) {
    if (!('BarcodeDetector' in window)) return null;
    var decode = (window._barcodeDebug && window._barcodeDebug.decodeBarcode) || null;
    try {
      var det = new window.BarcodeDetector();
      var bmp = await createImageBitmap(blob);
      var codes = await det.detect(bmp);
      if (bmp.close) bmp.close();
      var fm = (typeof findMaster === 'function') ? findMaster : null;
      for (var i = 0; i < (codes || []).length; i++) {
        var rv = String(codes[i].rawValue || '');
        var fmt = String(codes[i].format || '');
        if (!rv) continue;
        // Primary: the app's real UPC resolver (shared with the wizard scanner).
        if (decode) {
          try {
            var r = await decode({ rawValue: rv, format: fmt }, '');
            if (r && r.itemNum && r.masterItem && !r.notInMaster) return { num: r.itemNum, matched: true };
          } catch (eD) {}
        }
        // Fallback: a barcode whose value IS a catalog number.
        var t = rv.replace(/\D/g, '');
        if (fm && fm(rv)) return { num: rv, matched: true };
        if (fm && t.length >= 3 && t.length <= 7 && fm(t)) return { num: t, matched: true };
      }
    } catch (e) {}
    return null;
  }

  async function _freeReadBlob(blob, maxDim) {
    var bc = await _readBarcode(blob);
    if (bc) return bc;
    var w = await _tessGet(); if (!w) return null;
    var canvas = await _scaledCanvas(blob, maxDim || 1600);
    var text = '';
    try { var res = await w.recognize(canvas); text = (res && res.data && res.data.text) || ''; }
    catch (e) { return null; }
    return _numberFromText(text);
  }
  async function _freeReadOne(fileId) {
    return _freeReadBlob(await _pinBytes(fileId));
  }
  // ── Shared free identify engine ──────────────────────────────────────────
  // Barcode (via the wizard's UPC resolver) + printed-number OCR, master-
  // confirmed. Exposed globally so EVERY screen (inbox, wizard Identify,
  // Research by Photo) can try the free read before spending a paid AI credit.
  // Returns { itemNum, matched:true } only on a CONFIDENT (master-backed) hit.
  window.rrIdentifyFree = async function (blob) {
    try {
      var r = await _freeReadBlob(blob);
      if (r && r.num && r.matched) return { itemNum: r.num, matched: true };
    } catch (e) {}
    return null;
  };
  // "This is wrong — re-scan": forget the read and try again at higher detail.
  window._pinRescan = async function () {
    if (!_rvGroups || !_rvGroups.length) return;
    var fid = _rvGroups[0].files[0].id, key = _rvGroups[0].key;
    var btn = document.getElementById('pin-rv-rescan');
    if (btn) { btn.disabled = true; btn.textContent = 'Re-scanning…'; }
    try {
      try { var mm = _ids(); if (mm[fid]) { delete mm[fid]; _idsSave(mm); } } catch (e1) {}
      try { var ff = _freeTried(); if (ff[fid]) { delete ff[fid]; _freeTriedSave(ff); } } catch (e2) {}
      try { var pfx = fid + '|'; Object.keys(_vfCache || {}).forEach(function (k) { if (k.indexOf(pfx) === 0) delete _vfCache[k]; }); } catch (e3) {}
      var blob = await _pinBytes(fid);
      var r = await _freeReadBlob(blob, 2400);          // higher-res second attempt
      var m = _ids();
      if (r && r.num) { m[fid] = { num: r.num, guess: r.matched ? 0 : 1, tried: 1, free: 1 }; _idsSave(m); }
      else { var f2 = _freeTried(); f2[fid] = 1; _freeTriedSave(f2); }
      try { _render(); } catch (e4) {}
      window._pinReview(key);
      if (!(r && r.num)) showToast('Still no clear number — crop tight to the label, or type it in', 3500);
    } catch (e) {
      if (btn) { btn.disabled = false; btn.textContent = 'This is wrong — re-scan'; }
      showToast('Re-scan failed — try again', 2500, true);
    }
  };

  window._pinAutoReadCancel = function () { _autoReadAbort = true; };
  async function _pinAutoRead() {
    if (_autoReadBusy || !_groups.length) return;
    var ids = _ids(), ft = _freeTried();
    var todo = _groups.filter(function (g) { var fid = g.files[0].id; return !ids[fid] && !ft[fid]; });
    if (!todo.length) return;
    _autoReadBusy = true; _autoReadAbort = false;
    if (!(await _tessGet())) { _autoReadBusy = false; return; }   // OCR unavailable → leave for paid identify
    try {
      for (var i = 0; i < todo.length && !_autoReadAbort; i++) {
        _status('Reading photos… ' + (i + 1) + ' of ' + todo.length);
        var fid = todo[i].files[0].id, r = null;
        try { r = await _freeReadOne(fid); } catch (e) {}
        if (r && r.num) {
          var m = _ids(); m[fid] = { num: r.num, guess: r.matched ? 0 : 1, tried: 1, free: 1 };
          _idsSave(m);
        } else {
          var f = _freeTried(); f[fid] = 1; _freeTriedSave(f);
        }
        _render();
      }
    } finally { _autoReadBusy = false; _status(''); }
  }

  // ── Full-size zoom (Brad): open the inbox photo at full resolution so you
  // can read the box label and ID it yourself. Tap the image to toggle
  // fit-to-screen vs. actual size (scroll/pan when zoomed); ✕ or tapping the
  // backdrop closes. Fetches the real Drive bytes (not the small thumbnail).
  window._pinZoomPhoto = async function (fileId) {
    if (!_qcToken()) { showToast('Please sign in first', 3000, true); return; }
    var old = document.getElementById('pin-zoom-ov'); if (old) old.remove();
    var ov = document.createElement('div');
    ov.id = 'pin-zoom-ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:100030;background:rgba(0,0,0,0.94);display:flex;align-items:center;justify-content:center;padding:0.5rem;-webkit-overflow-scrolling:touch';
    ov.innerHTML = '<div style="color:#bbb;font-size:0.9rem;font-family:var(--font-body)">Loading full photo…</div>';
    document.body.appendChild(ov);
    var url = '';
    var close = function () { try { if (url) URL.revokeObjectURL(url); } catch (e) {} try { ov.remove(); } catch (e2) {} if (window.BackStack) BackStack.pop('pin-zoom'); };
    if (window.BackStack) BackStack.push('pin-zoom', function () { try { ov.remove(); } catch (e) {} });
    var xBtn = document.createElement('button');
    xBtn.textContent = '✕';
    xBtn.style.cssText = 'position:fixed;top:12px;right:14px;z-index:2;background:rgba(0,0,0,0.55);border:none;color:#fff;font-size:1.6rem;line-height:1;cursor:pointer;border-radius:8px;padding:0.1rem 0.6rem';
    xBtn.onclick = function (e) { e.stopPropagation(); close(); };
    ov.appendChild(xBtn);
    ov.onclick = function (e) { if (e.target === ov) close(); };
    try {
      var blob = await _pinBytes(fileId);
      url = URL.createObjectURL(blob);
      var img = document.createElement('img');
      img.src = url;
      img.alt = '';
      img.title = 'Tap to zoom in / out';
      var zoomed = false;
      var fit = function () { ov.style.display = 'flex'; ov.style.overflow = 'hidden'; img.style.cssText = 'display:block;margin:auto;max-width:100%;max-height:100%;cursor:zoom-in'; };
      var big = function () { ov.style.display = 'block'; ov.style.overflow = 'auto'; img.style.cssText = 'display:block;margin:0 auto;max-width:none;max-height:none;cursor:zoom-out'; };
      img.onclick = function (e) { e.stopPropagation(); zoomed = !zoomed; if (zoomed) big(); else fit(); };
      ov.innerHTML = '';
      ov.appendChild(xBtn);
      ov.appendChild(img);
      fit();
    } catch (e) {
      ov.innerHTML = '';
      ov.appendChild(xBtn);
      var msg = document.createElement('div');
      msg.style.cssText = 'color:#f88;font-family:var(--font-body);text-align:center;padding:1rem';
      msg.textContent = 'Could not load the full photo — ' + ((e && e.message) || 'try again');
      ov.appendChild(msg);
    }
  };

  // v0.9.913 (Brad): desktop split-view helpers. Load the big right-hand photo
  // at full resolution (thumbnail first for an instant preview, then sharpen),
  // and switch which photo is featured when a strip thumb is clicked.
  window._pinRvLoadFull = async function (img, fid) {
    if (!img || !fid) return;
    try { if (typeof loadDriveThumb === 'function') loadDriveThumb(fid, img, img.parentElement, null, 'hi'); } catch (e) {}
    try {
      if (!_qcToken()) return;
      var blob = await _pinBytes(fid);
      var u = URL.createObjectURL(blob);
      if (img.getAttribute('data-rvbig') === fid) img.src = u;   // still the current main
    } catch (e) { /* keep the thumbnail */ }
  };
  window._pinRvSetMain = function (fid) {
    var img = document.getElementById('pin-rv-main');
    if (!img) return;
    img.setAttribute('data-rvbig', fid);
    window._pinRvLoadFull(img, fid);
  };

  // ── Crop / Rotate an inbox photo IN PLACE (v0.9.899, Brad) ───
  // Same tool + same replace-the-Drive-bytes pattern Quick Capture uses
  // (photo-crop.js _openCropper → Drive media PATCH). Every thumbnail
  // refreshes, and re-running Identify reads the cleaned-up shot —
  // cropping to the item gives the AI the same edge the wizard's crop
  // step gives it.
  window._pinCropPhoto = async function (fid) {
    if (typeof window._openCropper !== 'function' || typeof Cropper === 'undefined') { showToast('Crop tool still loading — try again in a moment', 2500, true); return; }
    if (!_qcToken()) { showToast('Please sign in first', 3000, true); return; }
    var srcUrl = null;
    try {
      var blob0 = await _pinBytes(fid);
      srcUrl = URL.createObjectURL(blob0);
    } catch (e) { showToast('Could not load the photo: ' + ((e && e.message) || 'download failed'), 3000, true); return; }
    window._openCropper(srcUrl, async function (blob) {
      try { URL.revokeObjectURL(srcUrl); } catch (e1) {}
      try {
        var resp = await fetch('https://www.googleapis.com/upload/drive/v3/files/' + fid + '?uploadType=media', {
          method: 'PATCH', headers: { Authorization: 'Bearer ' + window.accessToken, 'Content-Type': 'image/jpeg' }, body: blob
        });
        if (!resp.ok) { showToast('Could not save the crop (HTTP ' + resp.status + ') — the original is untouched', 3500, true); return; }
        // Bust the shared thumbnail cache so every view shows the new bytes.
        var fresh = URL.createObjectURL(blob);
        try {
          if (typeof _blobCache !== 'undefined') {
            if (_blobCache[fid]) { try { URL.revokeObjectURL(_blobCache[fid]); } catch (e2) {} }
            _blobCache[fid] = fresh;
          }
        } catch (e3) {}
        // v0.9.961 (Brad): remember this file is cropped so future visits load
        // its real bytes, not Drive's stale preview; drop any cached stale link.
        _markCropped(fid);
        try { if (typeof _thumbLinkCache !== 'undefined') delete _thumbLinkCache[fid]; } catch (eTL) {}
        // Update every on-screen copy incl. the review modal's main image (data-rvbig).
        document.querySelectorAll('img[data-rvfid="' + fid + '"], img[data-fid="' + fid + '"], img[data-ppfid="' + fid + '"], img[data-rvbig="' + fid + '"]').forEach(function (im) { im.src = fresh; });
        // Crop → free re-read: clear the old read and re-run OCR on the EXACT
        // cropped bytes (no Drive round-trip, no credits, no manual Identify).
        try { var mm = _ids(); if (mm[fid]) { delete mm[fid]; _idsSave(mm); } } catch (eA) {}
        try { var ff = _freeTried(); if (ff[fid]) { delete ff[fid]; _freeTriedSave(ff); } } catch (eB) {}
        showToast('Cropped — re-reading the tighter shot…', 2500);
        try { _render(); } catch (eC) {}
        _freeReadBlob(blob).then(function (r) {
          var m = _ids();
          if (r && r.num) { m[fid] = { num: r.num, guess: r.matched ? 0 : 1, tried: 1, free: 1 }; _idsSave(m); }
          else { var f2 = _freeTried(); f2[fid] = 1; _freeTriedSave(f2); }
          try { _render(); } catch (e2) {}
        }).catch(function () {});
      } catch (e4) { showToast('Could not save the crop — the original is untouched', 3000, true); }
    }, function () { try { URL.revokeObjectURL(srcUrl); } catch (e5) {} });
  };

  window._pinIdentifyAll = async function () {
    if (_busy) { showToast('Still working on the last batch…', 2500, true); return; }
    if (!_qcToken()) { showToast('Please sign in first', 3000, true); return; }
    if (typeof aiIdentifyImage !== 'function') { showToast('Identify service not loaded — refresh and try again', 3000, true); return; }
    var ids = _ids();
    var todo = _groups.filter(function (g) { return !ids[g.files[0].id]; });
    if (!todo.length) { showToast(_groups.length ? 'Every item already has a suggestion — tick photos and use Identify to re-run any of them' : 'Inbox is empty', 3500); return; }
    // v0.9.956 (Brad): free auto-read already tried these — this button only
    // targets the leftovers it couldn't place. Show the exact count and make
    // clear it uses paid reads, so a batch never spends credits by surprise.
    var n = todo.length;
    var msg = 'The free reader already tried every photo. <b>' + n + '</b> item' + (n === 1 ? '' : 's') +
      ' couldn\'t be matched for free. Read ' + (n === 1 ? 'it' : 'them') +
      ' now? This uses ' + n + ' of your token' + (n === 1 ? '' : 's') + ' (1 per item).';
    var go = await _pinConfirm(msg, '🔍 Read ' + n + ' (' + n + ' token' + (n === 1 ? '' : 's') + ')');
    if (!go) return;
    return _pinIdentifyRun(todo, ids);
  };

  // v0.9.897 (Brad): identify JUST the ticked photos — and unlike Identify
  // all, it ALWAYS re-identifies, even when a suggestion already exists.
  // That's the point: re-run a blank or wrong read with one click.
  window._pinIdentifySelected = async function () {
    if (_busy) { showToast('Still working on the last batch…', 2500, true); return; }
    if (!_qcToken()) { showToast('Please sign in first', 3000, true); return; }
    if (typeof aiIdentifyImage !== 'function') { showToast('Identify service not loaded — refresh and try again', 3000, true); return; }
    var gs = _selGroups();
    if (!gs.length) { showToast('Tick the corner circle on the photos you want identified first', 3000, true); return; }
    var ids = _ids();
    gs.forEach(function (g) { delete ids[g.files[0].id]; });   // clear old suggestions = force fresh reads
    _idsSave(ids);
    return _pinIdentifyRun(gs, ids);
  };

  async function _pinIdentifyRun(todo, ids) {
    _busy = true; _idAbort = false;
    var okN = 0, blankN = 0, failN = 0, guessN = 0;
    var remaining = null;   // v0.9.887 (Brad): reads-left-today tracker
    try {
      for (var i = 0; i < todo.length; i++) {
        if (_idAbort) break;
        var st = document.getElementById('pin-status');
        if (st) {
          st.style.display = 'block';
          st.innerHTML = 'Identifying item ' + (i + 1) + ' of ' + todo.length +
            (remaining !== null ? ' · ' + remaining + ' token' + (remaining === 1 ? '' : 's') + ' left today' : '') +
            '… keep this tab open — go get that coffee. ' +
            '<button onclick="_pinIdentifyCancel()" style="border:1px solid var(--border);background:var(--surface2);color:var(--text-mid);border-radius:6px;font-size:0.72rem;padding:0.15rem 0.5rem;cursor:pointer;font-family:var(--font-body)">Stop</button>';
        }
        var g = todo[i], fid0 = g.files[0].id;
        try {
          // v0.9.896: Identify v2 — send EVERY photo of the group (cap 4)
          // in ONE call; more angles = better reads. aiIdentifyImage2 falls
          // back to v1 by itself on any v2 hiccup, so this can never be
          // worse than the old first-photo-only identify.
          var _fl = g.files.slice(0, 4), blobs = [];
          for (var _b = 0; _b < _fl.length; _b++) {
            try { blobs.push(await _pinBytes(_fl[_b].id)); }
            catch (eB) { console.warn('[Inbox] photo download failed, skipping one:', eB && eB.message); }
          }
          if (!blobs.length) throw new Error('no photo bytes');
          // v0.9.942: a failed catalog-photo double-check leaves a note so the
          // retry knows which number was rejected and why.
          var _hints = (typeof _vfNote !== 'undefined' && _vfNote[g.key]) ? { note: _vfNote[g.key] } : {};
          var ai = (typeof aiIdentifyImage2 === 'function')
            ? await aiIdentifyImage2(blobs, _hints)
            : await aiIdentifyImage(blobs[0], _hints);
          if (!ai.ok && ai.reason === 'quota') {
            showToast("You're out of tokens for today — the rest can run tomorrow", 4500, true);
            break;
          }
          if (ai.ok && ai.text) {
            if (typeof ai.remaining === 'number') remaining = ai.remaining;
            var meta = (typeof extractIdentifyMetadata === 'function') ? extractIdentifyMetadata(ai.text) : {};
            // v0.9.898 (Brad): KEEP hedged best guesses instead of discarding
            // them (the 30-9107 platform case: the wizard showed the guess with
            // a warning while the inbox said "no read"). guess:1 marks them —
            // tiles show an orange "best guess" tag, never a confident blue.
            var num = meta.itemNum ? String(meta.itemNum) : '';
            // v0.9.901 (Brad): the relay's v2.5 prompt lists look-alike twins on
            // a "Possible variants:" line (most likely first) — keep them so the
            // review card can offer pick-one chips. A variants line also means
            // the AI could NOT prove which twin it is → always a best guess.
            var alts = [];
            var altsM = String(ai.text).match(/^Possible variants?:\s*(.+)$/mi);
            if (altsM) alts = altsM[1].split('|').map(function (s) { return s.trim().slice(0, 70); }).filter(Boolean).slice(0, 4);
            var guess = (num && (meta._hedge || alts.length)) ? 1 : 0;
            // v0.9.894 (Brad): keep EVERYTHING the AI discovered, not just the
            // number — shown on the review card and fed into manual entry.
            var trim = function (v) { return String(v || '').slice(0, 120); };
            ids[fid0] = { num: num, guess: guess, alts: alts, tried: 1,
              mfr: trim(meta.manufacturer), desc: trim(meta.description),
              road: trim(meta.roadName), year: trim(meta.year) };
            // v0.9.902 (Brad): candidates-without-a-confident-number is a lead,
            // not "unreadable" — count it as a best guess so the toast matches
            // the orange tag on the tile and the chips on the review card.
            if (num && !guess) okN++; else if (num || alts.length) guessN++; else blankN++;
          } else {
            ids[fid0] = { num: '', tried: 1 };
            blankN++;
          }
          _idsSave(ids);
          _render();
        } catch (eOne) {
          console.warn('[Inbox] identify failed for a group:', eOne);
          failN++;   // not stored — retried on the next run
        }
      }
      _status('');
      var msg = 'Identified ' + okN + ' of ' + todo.length + ' item' + (todo.length > 1 ? 's' : '');
      if (guessN) msg += ' · ' + guessN + ' best guess' + (guessN > 1 ? 'es' : '') + ' (double-check those)';
      if (blankN) msg += ' · ' + blankN + ' unreadable (no number visible?)';
      if (failN) msg += ' · ' + failN + ' errored (run again to retry)';
      if (remaining !== null) msg += ' · ' + remaining + ' token' + (remaining === 1 ? '' : 's') + ' left today';
      showToast(msg, 5000, (okN + guessN) === 0);
    } finally {
      _busy = false;
      var st2 = document.getElementById('pin-status');
      if (st2 && /Identifying/.test(st2.textContent || '')) _status('');
    }
  }

  // ── Import from Google Photos (Picker API, v0.9.885) ─────────
  // Session → Google's own picker tab → poll until the user hits
  // Done there → download each pick (auth'd baseUrl) → upload to the
  // inbox. Read-only scope; the app only ever sees what was picked.
  var _gpAbort = false;
  window._pinGPhotosCancel = function () { _gpAbort = true; _status(''); };

  function _gpHelp() {
    var ov = document.createElement('div');
    ov.id = 'pin-gp-help';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1.5rem';
    ov.innerHTML =
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:1.2rem;max-width:420px;width:100%">' +
        '<div style="font-family:var(--font-head);font-weight:700;font-size:1rem;color:var(--text);margin-bottom:0.5rem">Google Photos needs two one-time switches</div>' +
        '<div style="font-size:0.82rem;color:var(--text-dim);line-height:1.6;margin-bottom:0.8rem">' +
          '1. Turn on the <strong style="color:var(--text)">Google Photos Picker API</strong> for this app: <a href="https://console.cloud.google.com/apis/library/photospicker.googleapis.com" target="_blank" style="color:#2980b9">open the switch ↗</a> and click Enable.<br><br>' +
          '2. Give the app its new photo-picking permission: sign out (Preferences → Sign Out), sign back in, and approve when Google asks.' +
        '</div>' +
        '<button onclick="document.getElementById(\'pin-gp-help\').remove()" class="btn-primary" style="width:100%;padding:0.6rem;border-radius:8px;border:none;font-family:var(--font-body);font-weight:700;font-size:0.88rem;cursor:pointer">Got it</button>' +
      '</div>';
    document.body.appendChild(ov);
  }

  window._pinGPhotos = async function () {
    if (_busy) { showToast('Still working on the last batch…', 2500, true); return; }
    if (!_qcToken()) { showToast('Please sign in first', 3000, true); return; }
    // Open the tab NOW (inside the click) so popup blockers stay quiet;
    // it gets pointed at the picker once the session exists.
    var tab = null;
    try { tab = window.open('', '_blank'); } catch (e) {}
    _busy = true; _gpAbort = false;
    try {
      var auth = { Authorization: 'Bearer ' + window.accessToken };
      var sRes = await fetch('https://photospicker.googleapis.com/v1/sessions', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, auth), body: '{}' });
      if (!sRes.ok) {
        try { if (tab) tab.close(); } catch (e) {}
        if (sRes.status === 403 || sRes.status === 401) _gpHelp();
        else showToast('Google Photos picker error (' + sRes.status + ') — try again', 3500, true);
        return;
      }
      var s = await sRes.json();
      if (tab) { try { tab.location = s.pickerUri; } catch (e) { tab = null; } }
      if (!tab) window.open(s.pickerUri, '_blank');
      var st = document.getElementById('pin-status');
      if (st) {
        st.style.display = 'block';
        st.innerHTML = 'Pick photos in the Google Photos tab that just opened, then press <strong>Done</strong> there. Waiting… ' +
          '<button onclick="_pinGPhotosCancel()" style="border:1px solid var(--border);background:var(--surface2);color:var(--text-mid);border-radius:6px;font-size:0.72rem;padding:0.15rem 0.5rem;cursor:pointer;font-family:var(--font-body)">Cancel</button>';
      }
      var iv = 4000;
      var _ivOf = function (cfg) { try { var d = parseFloat(String((cfg || {}).pollInterval || '').replace('s', '')); return d > 0 ? Math.max(2000, d * 1000) : 0; } catch (e) { return 0; } };
      iv = _ivOf(s.pollingConfig) || iv;
      var picked = false, waited = 0;
      while (!picked && !_gpAbort && waited < 600000) {
        await new Promise(function (r) { setTimeout(r, iv); });
        waited += iv;
        var g = await fetch('https://photospicker.googleapis.com/v1/sessions/' + s.id, { headers: auth });
        if (!g.ok) throw new Error('session poll ' + g.status);
        var gs = await g.json();
        if (gs.mediaItemsSet) picked = true;
        iv = _ivOf(gs.pollingConfig) || iv;
      }
      if (!picked) { _status(''); if (!_gpAbort) showToast('Gave up waiting for the picker — try again', 3000, true); return; }
      // List everything the user picked
      var items = [], pageToken = '';
      do {
        var lRes = await fetch('https://photospicker.googleapis.com/v1/mediaItems?sessionId=' + encodeURIComponent(s.id) + '&pageSize=100' + (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''), { headers: auth });
        if (!lRes.ok) throw new Error('mediaItems list ' + lRes.status);
        var lj = await lRes.json();
        (lj.mediaItems || []).forEach(function (m) { items.push(m); });
        pageToken = lj.nextPageToken || '';
      } while (pageToken);
      var photos = items.filter(function (m) { return String(m.type || '').toUpperCase() !== 'VIDEO'; });
      var skipped = items.length - photos.length;
      var fid = await _folder();
      var ts = new Date().getTime(), ok = 0;
      for (var i = 0; i < photos.length; i++) {
        if (_gpAbort) break;
        _status('Importing ' + (i + 1) + ' of ' + photos.length + ' from Google Photos…');
        try {
          var mf = photos[i].mediaFile || {};
          var bRes = await fetch(mf.baseUrl + '=d', { headers: auth });
          if (!bRes.ok) throw new Error('download ' + bRes.status);
          var blob = await bRes.blob();
          var fname = String(mf.filename || ('photo-' + (i + 1) + '.jpg')).replace(/[^\w.\- ]+/g, '').slice(-60) || ('photo-' + (i + 1) + '.jpg');
          var f = new File([blob], fname, { type: mf.mimeType || 'image/jpeg' });
          await driveUploadFile(f, 'INBOX ' + ts + ' g' + (ts + i) + ' ' + fname, fid);
          ok++;
        } catch (eOne) { console.warn('[Inbox] Google Photos item failed:', eOne); }
      }
      try { fetch('https://photospicker.googleapis.com/v1/sessions/' + s.id, { method: 'DELETE', headers: auth }); } catch (eDel) {}
      _status('');
      var msg = 'Imported ' + ok + ' of ' + photos.length + ' photo' + (photos.length === 1 ? '' : 's') + ' from Google Photos';
      if (skipped) msg += ' (' + skipped + ' video' + (skipped > 1 ? 's' : '') + ' skipped)';
      showToast(msg, 3500, ok < photos.length);
      _pinRefresh();
    } catch (e) {
      console.error('[Inbox] Google Photos import:', e);
      _status('Google Photos import hit a snag — try again.');
    } finally { _busy = false; }
  };

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
      // v0.9.940 (Brad): discarding must land you back ON the Photo Inbox —
      // some entry paths were ending up on the Dashboard instead. Force it.
      try {
        if (!document.querySelector('#page-photo-inbox.active') && typeof showPage === 'function') {
          showPage('photo-inbox', document.getElementById('nav-photo-inbox'));
        }
      } catch (eNav) {}
    } catch (e) {
      console.error('[Inbox] discard:', e);
      _status('Discard failed partway — hit Refresh and try again.');
    } finally { _busy = false; }
  };

  // ── Badges + dashboard cards (v0.9.890) ──────────────────────
  var COUNT_KEY = 'rr_inbox_count';
  function _navBadge(count) {
    try { localStorage.setItem(COUNT_KEY, String(count)); } catch (e) {}
    var b = document.getElementById('nav-inbox-count');
    if (b) { b.textContent = count > 0 ? count : ''; b.style.display = count > 0 ? '' : 'none'; }
    var mb = document.getElementById('mnav-inbox-count');
    if (mb) { mb.textContent = count > 0 ? count : ''; mb.style.display = count > 0 ? '' : 'none'; }
    var cv = document.getElementById('pin-card-value');
    if (cv) cv.textContent = String(count);
  }

  // Lightweight count fetch — runs at startup so the badges and the
  // dashboard card are right BEFORE the inbox page is ever opened.
  var _countBusy = false;
  async function _pinCountRefresh() {
    if (_countBusy || !_qcToken()) return;
    _countBusy = true;
    try {
      var fid = await _folder();
      var q = encodeURIComponent("'" + fid + "' in parents and mimeType contains 'image/' and trashed=false");
      var res = await driveRequest('GET', '/files?q=' + q + '&fields=files(id)&pageSize=200');
      _navBadge(((res && res.files) || []).length);
    } catch (e) { /* offline / signed out — badge stays as-is */ }
    finally { _countBusy = false; }
  }
  window._pinCountRefresh = _pinCountRefresh;

  // Small stat card + large panel, registered into the dashboard's own
  // catalogs so Edit Dashboard can place/arrange them like any other.
  function _registerDashEntries() {
    try {
      if (typeof CARD_CATALOG !== 'undefined' && CARD_CATALOG.push && !CARD_CATALOG.some(function (c) { return c.id === 'photoInbox'; })) {
        CARD_CATALOG.push({
          id: 'photoInbox', label: 'Photo Inbox', color: '#2980b9',
          onclick: '_pinGo()',
          compute: function () {
            setTimeout(function () { _pinCountRefresh(); }, 0);
            var n = parseInt(localStorage.getItem(COUNT_KEY) || '0', 10) || 0;
            return { html: '<div class="stat-value" id="pin-card-value">' + n + '</div>'
              + '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:1px">photo' + (n === 1 ? '' : 's') + ' waiting — click to file</div>' };
          }
        });
      }
      if (typeof _CARD_HELP !== 'undefined') _CARD_HELP.photoInbox = 'Photos waiting in your Photo Inbox — snapped with Batch Add on your phone, dragged in on desktop, or imported from Google Photos. Click the card to review and file them.';
      if (typeof PANEL_CATALOG !== 'undefined' && PANEL_CATALOG.push && !PANEL_CATALOG.some(function (p) { return p.id === 'photoInbox'; })) {
        PANEL_CATALOG.push({
          id: 'photoInbox', label: 'Photo Inbox', icon: '📥',
          navFn: "_pinGo();",
          count: function () {
            var n = parseInt(localStorage.getItem(COUNT_KEY) || '0', 10) || 0;
            return n ? (n + ' photo' + (n === 1 ? '' : 's')) : '';
          },
          render: function () {
            if (window._offlineMode || navigator.onLine === false) {
              return '<div style="min-height:120px;display:flex;align-items:center;justify-content:center;color:var(--text-dim);font-size:0.78rem;text-align:center">Photos will show when you’re back online</div>';
            }
            setTimeout(function () { _pinPanelFill(); }, 0);
            return '<div id="pin-panel-grid" onclick="window._fromDash=true;_pinGo()" title="Open Photo Inbox" style="cursor:pointer;display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:0.5rem;min-height:120px"><div class="empty-state"><p>Loading inbox…</p></div></div>';
          }
        });
      }
    } catch (e) { console.warn('[Inbox] dash register:', e); }
  }

  async function _pinPanelFill() {
    var grid = document.getElementById('pin-panel-grid');
    if (!grid || !_qcToken()) return;
    try {
      var fid = await _folder();
      var q = encodeURIComponent("'" + fid + "' in parents and mimeType contains 'image/' and trashed=false");
      var res = await driveRequest('GET', '/files?q=' + q + '&fields=files(id)&orderBy=createdTime desc&pageSize=200');
      var files = (res && res.files) || [];
      _navBadge(files.length);
      grid = document.getElementById('pin-panel-grid');
      if (!grid) return;
      if (!files.length) {
        grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><p>Inbox is empty — snap some photos with Batch Add</p></div>';
        return;
      }
      // v0.9.893 (Brad): SAME column rule as the Showcase (shared helper) +
      // explicit column count — the old auto-fill CSS guessed differently
      // on his laptop (2 cols vs the Showcase's 3).
      var cols = (typeof window._dashPhotoCols === 'function') ? window._dashPhotoCols(grid)
        : Math.max(3, Math.floor((grid.clientWidth || 500) / 104));
      grid.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
      // v0.9.892 (Brad): show EVERYTHING up to 3 rows (matches Showcase's
      // on-screen cap) — partial last row and all. Still no "+N" tile; the
      // header total covers the overflow beyond 3 rows.
      var show = files.slice(0, cols * 3);
      grid.innerHTML = show.map(function (f) {
        return '<div style="aspect-ratio:1;border-radius:8px;overflow:hidden;background:var(--surface2,#26262e)"><img loading="lazy" data-ppfid="' + f.id + '" style="width:100%;height:100%;object-fit:cover;display:block" alt=""></div>';
      }).join('');
      grid.querySelectorAll('img[data-ppfid]').forEach(function (img) {
        loadDriveThumb(img.getAttribute('data-ppfid'), img, img.parentElement, null, 'hi');
      });
    } catch (e) {
      if (grid) grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><p>Couldn’t load the inbox — open it to retry</p></div>';
    }
  }

  // One-time: put the new card in the first empty dashboard slot and the
  // panel on the dashboard (if there's room) so Brad sees them without a
  // trip through Edit Dashboard. Rearranging/removing after that is his.
  function _autoPlaceOnce() {
    try {
      if (localStorage.getItem('rr_inbox_dash_placed')) return;
      var placed = false;
      if (typeof _getSlots === 'function' && typeof _saveSlots === 'function') {
        var slots = _getSlots();
        if (!slots.some(function (s) { return s && s.id === 'photoInbox'; })) {
          var empty = slots.indexOf(null);
          if (empty >= 0) { slots[empty] = { id: 'photoInbox' }; _saveSlots(slots); placed = true; }
        } else placed = true;
      }
      if (typeof _getPanels === 'function' && typeof _savePanels === 'function') {
        var panels = _getPanels();
        if (!panels.some(function (p) { return p && p.id === 'photoInbox'; }) && panels.length < 3) {
          panels.push({ id: 'photoInbox' }); _savePanels(panels); placed = true;
        }
      }
      localStorage.setItem('rr_inbox_dash_placed', '1');
      if (placed) console.log('[Inbox] dashboard card/panel placed (one-time)');
    } catch (e) { console.warn('[Inbox] auto-place:', e); }
  }

  function _injectNav() {
    // Desktop sidebar entry
    if (!document.getElementById('nav-photo-inbox') && !window.IS_MOBILE_UA) {
      var prefsBtn = document.querySelector('.sidebar .nav-item[onclick*="prefs"]');
      if (prefsBtn && prefsBtn.parentNode) {
        var b = document.createElement('button');
        b.className = 'nav-item';
        b.id = 'nav-photo-inbox';
        b.setAttribute('data-ctip', 'Photos waiting to be filed to items.');
        b.setAttribute('onclick', '_pinGo(this)');
        b.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>' +
          'Photo Inbox<span class="nav-badge" id="nav-inbox-count" style="display:none;background:#f8e8c0;color:#1a1a1a"></span>';
        prefsBtn.parentNode.insertBefore(b, prefsBtn);
      }
    }
    // v0.9.882 (Brad): phone bottom-nav entry too
    if (!document.getElementById('mnav-photo-inbox')) {
      var host = document.querySelector('.mobile-nav-items');
      if (host) {
        var mb = document.createElement('button');
        mb.className = 'mobile-nav-item';
        mb.id = 'mnav-photo-inbox';
        mb.style.position = 'relative';
        mb.setAttribute('onclick', '_pinGo(this)');
        mb.innerHTML = '<span id="mnav-inbox-count" style="display:none;position:absolute;top:1px;right:4px;background:#2980b9;color:#fff;border-radius:9px;font-size:0.58rem;font-weight:700;padding:1px 5px;line-height:1.3"></span>' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>Inbox';
        host.appendChild(mb);
      }
    }
  }

  // ═════════════════════════════════════════════════════════════
  // PHASE 2 — QUICK CAPTURE (phone) — v0.9.880, reworked v0.9.882
  // Two big buttons instead of an up-front mode question (Brad):
  //   "Photo of New Item"          — starts the next item (new group)
  //   "Another Photo of Same Item" — adds to the current item's group
  // Every shot uploads to the inbox in the background. Groups share
  // the g-tag so the desktop inbox shows them as one stack.
  // Extras: optional crop-each-photo toggle, and a strip of the most
  // recent shots (tap to review, re-crop, or rotate — the cropped
  // bytes replace the uploaded Drive file in place).
  // ═════════════════════════════════════════════════════════════
  var QC_CROP_KEY = 'rr_qc_crop';   // '1' = open the cropper on every shot
  var _qc = null;   // { base, group, shots, total, pending, failed:[{file,name,rec}], recent:[{url,name,driveId,group}], nextIsNew }

  function _qcToken() {
    if (!window.accessToken) {
      var s = localStorage.getItem('lv_token'), ex = parseInt(localStorage.getItem('lv_token_expiry') || '0', 10);
      if (s && ex > new Date().getTime()) window.accessToken = s;
    }
    return window.accessToken;
  }

  window._qcOpen = function () {
    if (!_qc) _qc = { base: new Date().getTime(), group: 1, shots: 0, total: 0, pending: 0, failed: [], recent: [], nextIsNew: false };
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

  function _qcCropOn() { return localStorage.getItem(QC_CROP_KEY) === '1'; }
  window._qcCropToggle = function () {
    localStorage.setItem(QC_CROP_KEY, _qcCropOn() ? '0' : '1');
    _qcRender();
  };

  function _qcRender() {
    var body = document.getElementById('qc-body');
    if (!body) return;
    var counter = 'Item ' + _qc.group + (_qc.shots ? ' · ' + _qc.shots + ' photo' + (_qc.shots > 1 ? 's' : '') : '');
    var pend = '';
    if (_qc.pending > 0) pend += 'Uploading ' + _qc.pending + '… ';
    if (_qc.failed.length) pend += '<span style="color:#f05008;font-weight:700">' + _qc.failed.length + ' failed</span> <button onclick="_qcRetry()" style="border:1px solid var(--border);background:var(--surface2);color:var(--text-mid);border-radius:6px;font-size:0.72rem;padding:0.15rem 0.5rem;cursor:pointer;font-family:var(--font-body)">Retry</button>';
    // Most-recent strip (newest first). Tap a shot to review / re-crop.
    var strip = '';
    if (_qc.recent.length) {
      strip = '<div style="display:flex;gap:0.45rem;overflow-x:auto;-webkit-overflow-scrolling:touch;padding:0.15rem 0.1rem;margin-bottom:0.6rem">' +
        _qc.recent.slice().reverse().map(function (r, i) {
          var realIdx = _qc.recent.length - 1 - i;
          return '<div onclick="_qcReview(' + realIdx + ')" style="flex-shrink:0;width:62px;height:62px;border-radius:9px;overflow:hidden;position:relative;border:2px solid ' + (r.group === _qc.group ? '#2980b9' : 'var(--border)') + ';cursor:pointer">' +
            '<img src="' + r.url + '" style="width:100%;height:100%;object-fit:cover;display:block" alt="">' +
            '<div style="position:absolute;left:0;right:0;bottom:0;background:rgba(0,0,0,0.55);color:#fff;font-size:0.55rem;text-align:center;padding:0 2px">Item ' + r.group + '</div>' +
            '</div>';
        }).join('') + '</div>';
    }
    body.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.6rem">' +
        '<span style="font-family:var(--font-head);font-weight:700;font-size:1.05rem;color:var(--text)">Quick Capture</span>' +
        '<button onclick="_qcCropToggle()" style="border:1px solid ' + (_qcCropOn() ? '#2980b9' : 'var(--border)') + ';background:' + (_qcCropOn() ? 'rgba(41,128,185,0.15)' : 'var(--surface2)') + ';color:' + (_qcCropOn() ? '#2980b9' : 'var(--text-dim)') + ';border-radius:7px;font-size:0.7rem;font-weight:700;padding:0.25rem 0.6rem;cursor:pointer;font-family:var(--font-body)">Crop each photo: ' + (_qcCropOn() ? 'ON' : 'OFF') + '</button>' +
      '</div>' +
      '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.4rem;min-height:0">' +
        '<div style="font-family:var(--font-head);font-weight:700;font-size:1.5rem;color:var(--text);text-align:center">' + counter + '</div>' +
        '<div style="font-size:0.78rem;color:var(--text-dim);min-height:1.2em;text-align:center">' + (pend || (_qc.total ? _qc.total + ' photo' + (_qc.total > 1 ? 's' : '') + ' in your inbox' : 'Photos upload as you go')) + '</div>' +
      '</div>' +
      strip +
      '<button onclick="_qcTake(true)" style="width:100%;min-height:21vh;border-radius:16px;border:none;background:#2980b9;color:#fff;font-family:var(--font-body);font-weight:700;font-size:1.1rem;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.45rem;margin-bottom:0.6rem">' +
        '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>' +
        'Photo of New Item' +
      '</button>' +
      '<button onclick="_qcTake(false)" ' + (_qc.shots ? '' : 'disabled ') + 'style="width:100%;min-height:12vh;border-radius:16px;border:1.5px solid ' + (_qc.shots ? '#2980b9' : '#8b8e94') + ';background:rgba(41,128,185,' + (_qc.shots ? '0.14' : '0.05') + ');color:' + (_qc.shots ? '#2980b9' : 'var(--text-dim)') + ';font-family:var(--font-body);font-weight:700;font-size:1rem;cursor:pointer;margin-bottom:0.6rem;opacity:' + (_qc.shots ? '1' : '0.55') + '">Another Photo of Same Item</button>' +
      '<button onclick="_qcDone()" style="width:100%;padding:0.8rem;border-radius:12px;border:1px solid var(--border);background:var(--surface2);color:var(--text-dim);font-family:var(--font-body);font-weight:600;font-size:0.9rem;cursor:pointer">Done</button>';
  }

  // Both big buttons funnel here: newItem=true starts the next group.
  window._qcTake = function (newItem) {
    if (!_qc) return;
    _qc.nextIsNew = !!newItem;
    var inp = document.getElementById('qc-file');
    if (inp) inp.click();
  };

  function _qcShot(file) {
    if (_qc.nextIsNew && _qc.shots > 0) { _qc.group++; _qc.shots = 0; }
    _qc.nextIsNew = false;
    var go = function (finalFile) {
      _qc.shots++;
      _qc.total++;
      var ext = ((finalFile.name || '').split('.').pop() || 'jpg').toLowerCase().slice(0, 5) || 'jpg';
      var name = 'INBOX ' + _qc.base + ' g' + _qc.base + '-' + _qc.group + ' p' + _qc.shots + '.' + ext;
      var rec = { url: URL.createObjectURL(finalFile), name: name, driveId: null, group: _qc.group };
      _qc.recent.push(rec);
      if (_qc.recent.length > 12) { var old = _qc.recent.shift(); try { URL.revokeObjectURL(old.url); } catch (e) {} }
      _qcUpload(finalFile, name, rec);
      _qcRender();
    };
    // Optional crop-before-upload (photo-crop.js's shared helper; falls back
    // to the original photo on Cancel or if the crop tool isn't loaded).
    if (_qcCropOn() && typeof window._cropFirst === 'function') window._cropFirst(file, go);
    else go(file);
  }

  async function _qcUpload(file, name, rec) {
    _qc.pending++;
    _qcRender();
    try {
      if (!_qcToken()) throw new Error('signed out');
      var fid = await _folder();
      var res = await driveUploadFile(file, name, fid);
      if (rec && res && res.id) rec.driveId = res.id;
    } catch (e) {
      console.warn('[QuickCapture] upload failed:', e);
      _qc.failed.push({ file: file, name: name, rec: rec });
    } finally {
      _qc.pending--;
      _qcRender();
    }
  }

  window._qcRetry = function () {
    if (!_qc || !_qc.failed.length) return;
    var again = _qc.failed.splice(0);
    again.forEach(function (it) { _qcUpload(it.file, it.name, it.rec); });
  };

  // ── Review a recent shot: big view + re-crop/rotate in place ─
  window._qcReview = function (idx) {
    var r = _qc && _qc.recent[idx];
    if (!r) return;
    var old = document.getElementById('qc-review-ov'); if (old) old.remove();
    var ov = document.createElement('div');
    ov.id = 'qc-review-ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:100005;background:rgba(0,0,0,0.92);display:flex;flex-direction:column;padding:max(0.8rem,env(safe-area-inset-top)) 0.9rem max(0.8rem,env(safe-area-inset-bottom))';
    ov.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;color:#fff;margin-bottom:0.5rem">' +
        '<strong style="font-size:0.95rem">Item ' + r.group + '</strong>' +
        '<button onclick="document.getElementById(\'qc-review-ov\').remove()" style="background:none;border:none;color:#bbb;font-size:1.5rem;line-height:1;cursor:pointer;padding:0.2rem 0.4rem">✕</button>' +
      '</div>' +
      '<div style="flex:1;min-height:0;display:flex;align-items:center;justify-content:center"><img src="' + r.url + '" style="max-width:100%;max-height:100%;border-radius:10px" alt=""></div>' +
      '<div style="display:flex;gap:0.6rem;margin-top:0.7rem">' +
        '<button onclick="_qcRecrop(' + idx + ')" style="flex:1;padding:0.85rem;border-radius:10px;border:none;background:#2980b9;color:#fff;font-family:var(--font-body);font-weight:700;font-size:0.95rem;cursor:pointer">Crop / Rotate</button>' +
        '<button onclick="document.getElementById(\'qc-review-ov\').remove()" style="flex:1;padding:0.85rem;border-radius:10px;border:1px solid #555;background:#2a2a2a;color:#eee;font-family:var(--font-body);font-weight:600;font-size:0.95rem;cursor:pointer">Looks good</button>' +
      '</div>';
    document.body.appendChild(ov);
  };

  window._qcRecrop = function (idx) {
    var r = _qc && _qc.recent[idx];
    if (!r) return;
    if (typeof window._openCropper !== 'function') { showToast('Crop tool still loading — try again in a moment', 2500, true); return; }
    var rv = document.getElementById('qc-review-ov'); if (rv) rv.remove();
    window._openCropper(r.url, async function (blob) {
      try { URL.revokeObjectURL(r.url); } catch (e) {}
      r.url = URL.createObjectURL(blob);
      _qcRender();
      // Replace the uploaded Drive file's bytes in place (photo-crop.js pattern).
      if (r.driveId && _qcToken()) {
        try {
          var resp = await fetch('https://www.googleapis.com/upload/drive/v3/files/' + r.driveId + '?uploadType=media', {
            method: 'PATCH', headers: { Authorization: 'Bearer ' + window.accessToken, 'Content-Type': 'image/jpeg' }, body: blob
          });
          showToast(resp.ok ? 'Photo updated' : 'Crop saved locally — inbox copy may be the original', 2500);
        } catch (e) { console.warn('[QuickCapture] recrop replace:', e); showToast('Could not update the uploaded copy', 2500, true); }
      } else {
        showToast('Photo is still uploading — crop it again in a few seconds if it looks wrong in the inbox', 3000);
      }
    });
  };

  window._qcDone = function () {
    if (_qc && _qc.pending > 0) {
      if (!window.confirm(_qc.pending + ' photo(s) still uploading — leave anyway? They may not reach the inbox.')) return;
    }
    if (_qc && _qc.failed.length) {
      if (!window.confirm(_qc.failed.length + ' photo(s) failed to upload and will be lost. Close anyway?')) return;
    }
    var total = _qc ? (_qc.total - _qc.failed.length) : 0;
    if (_qc) _qc.recent.forEach(function (r) { try { URL.revokeObjectURL(r.url); } catch (e) {} });
    var rv = document.getElementById('qc-review-ov'); if (rv) rv.remove();
    var ov = document.getElementById('qc-ov');
    if (ov) ov.remove();
    if (window.BackStack && BackStack.pop) BackStack.pop('qc-ov');
    _qc = null;
    if (total > 0) showToast(total + ' photo' + (total > 1 ? 's' : '') + ' in your inbox — file them at the desk', 3500);
  };

  // ── Batch Add — lives in the Add-to-My-Collection wizard footer,
  //    to the right of Cancel, first step only (Brad's placement).
  //    Phone → Quick Capture camera; desktop → Photo Inbox page.
  window._qcBatchAdd = function () {
    try { if (typeof _doCloseWizard === 'function') _doCloseWizard(); } catch (e) {}
    if (window.IS_MOBILE_UA) window._qcOpen();
    else window._pinGo(document.getElementById('nav-photo-inbox'));
  };

  function _batchBtnSync() {
    // Batch Add moved to the +Add menu ("Batch Add Photos") — it's no longer a
    // wizard-footer button. Remove any stray instance; never create one.
    var btn = document.getElementById('qc-batch-btn');
    if (btn) btn.remove();
  }

  // Piggyback on dashboard rebuilds (fires after login and after every
  // wizard save) — inject the sidebar entry and flush pending links —
  // and on wizard step renders — keep the Batch Add button in sync.
  var _startupCounted = false;
  function _hook() {
    if (typeof window.buildDashboard === 'function' && !window.buildDashboard._pinWrapped) {
      _registerDashEntries();
      var orig = window.buildDashboard;
      window.buildDashboard = function () {
        try { _autoPlaceOnce(); } catch (e) {}
        var r = orig.apply(this, arguments);
        try {
          _injectNav(); _flushPending();
          if (!_startupCounted) { _startupCounted = true; setTimeout(function () { _pinCountRefresh(); }, 1500); }
        } catch (e) {}
        return r;
      };
      window.buildDashboard._pinWrapped = true;
    } else if (typeof window.buildDashboard !== 'function') {
      setTimeout(_hook, 800);
      return;
    }
    if (typeof window.renderWizardStep === 'function' && !window.renderWizardStep._pinWrapped) {
      var origR = window.renderWizardStep;
      window.renderWizardStep = function () {
        var r = origR.apply(this, arguments);
        try { _batchBtnSync(); } catch (e) {}
        return r;
      };
      window.renderWizardStep._pinWrapped = true;
    }
  }
  _hook();
  // The phone bottom bar is static HTML — give it its Inbox button right
  // away (the sidebar half of _injectNav waits for login harmlessly).
  try { _injectNav(); } catch (e) {}
})();
