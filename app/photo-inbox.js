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
      '<div style="font-size:0.8rem;color:var(--text-dim);line-height:1.5;margin-bottom:0.7rem">Drop photos anywhere below, or use Add photos. Click a photo to review it — add the item, research it more, or discard the photo. Tick the corner circle to select several at once. Photos snapped with Quick Capture on your phone land here too.</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin-bottom:0.8rem">' +
        '<button onclick="_pinPickFiles()" class="btn-primary" style="padding:0.5rem 0.9rem;border-radius:8px;border:none;font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">Add photos…</button>' +
        '<button onclick="_pinGPhotos()" style="padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #8b8e94;background:rgba(139,142,148,0.12);color:#2980b9;font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">From Google Photos…</button>' +
        '<button id="pin-idall-btn" onclick="_pinIdentifyAll()" style="padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #8b8e94;background:rgba(139,142,148,0.12);color:#2980b9;font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">Identify all</button>' +
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
      // Prune stored AI suggestions for photos that left the inbox
      (function () {
        var live = {}; files.forEach(function (f) { live[f.id] = true; });
        var ids = _ids(), changed = false;
        Object.keys(ids).forEach(function (k) { if (!live[k]) { delete ids[k]; changed = true; } });
        if (changed) _idsSave(ids);
      })();
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
      return '<div class="pin-tile" data-key="' + g.key + '" onclick="_pinReview(\'' + g.key + '\')" style="position:relative;border-radius:10px;overflow:hidden;cursor:pointer;background:var(--surface2,#26262e);aspect-ratio:1;border:3px solid ' + (isSel ? '#2980b9' : 'transparent') + '">' +
        '<img loading="lazy" data-fid="' + g.files[0].id + '" style="width:100%;height:100%;object-fit:cover;object-position:center;display:block" alt="">' +
        chip +
        '<div onclick="event.stopPropagation();_pinToggle(\'' + g.key + '\')" title="Select" style="position:absolute;top:6px;left:6px;width:22px;height:22px;border-radius:50%;border:2px solid ' + (isSel ? '#2980b9' : 'rgba(255,255,255,0.75)') + ';background:' + (isSel ? '#2980b9' : 'rgba(0,0,0,0.35)') + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:700">' + (isSel ? '✓' : '') + '</div>' +
        '<div onclick="event.stopPropagation();_pinTileCrop(\'' + g.key + '\')" title="Crop / Rotate" style="position:absolute;right:6px;bottom:26px;width:24px;height:24px;border-radius:7px;background:rgba(0,0,0,0.55);color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.8rem;cursor:pointer">✂</div>' +
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

  function _selGroups() { return _groups.filter(function (g) { return _sel[g.key]; }); }

  function _selInfo() {
    var gs = _selGroups(), n = 0;
    gs.forEach(function (g) { n += g.files.length; });
    var info = document.getElementById('pin-selinfo');
    var ab = document.getElementById('pin-assign-btn'), db = document.getElementById('pin-discard-btn');
    var ib = document.getElementById('pin-idsel-btn');   // v0.9.897 (Brad): identify just the ticked photos
    if (info) info.textContent = n ? (n + ' photo' + (n > 1 ? 's' : '') + ' selected') : '';
    if (ab) ab.style.display = gs.length > 1 ? '' : 'none';   // combine needs 2+
    if (db) db.style.display = n ? '' : 'none';
    if (ib) ib.style.display = n ? '' : 'none';
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

  // ── Review a photo group: research laid out → Add / Research /
  //    Discard (v0.9.888, Brad's flow). Also handles "Combine → one
  //    item…" for a multi-selection (all selected photos = one item).
  var _rvGroups = [];

  function _pinLookup(num) {
    num = String(num || '').trim();
    var out = { num: num, master: null, ownedPd: null, maker: '', era: '', desc: '' };
    if (!num) return out;
    try { out.master = (typeof findMaster === 'function') ? findMaster(num) : null; } catch (e) {}
    if (out.master) {
      var m = out.master;
      var eraDef = (typeof ERAS !== 'undefined' && ERAS[m._era]) ? ERAS[m._era] : null;
      out.maker = m.manufacturer || (eraDef ? eraDef.manufacturer : '') || '';
      out.era = eraDef ? eraDef.label : '';
      out.desc = m.description || [m.roadName, m.itemType].filter(Boolean).join(' ') || '';
    }
    var pds = Object.values((window.state || {}).personalData || {});
    out.ownedPd = pds.find(function (p) { return p && p.owned && String(p.itemNum) === num; }) || null;
    if (!out.ownedPd && typeof baseItemNum === 'function') {
      out.ownedPd = pds.find(function (p) { return p && p.owned && p.itemNum && baseItemNum(String(p.itemNum)) === baseItemNum(num); }) || null;
    }
    return out;
  }

  window._pinReviewLookup = function (val) {
    var box = document.getElementById('pin-rv-info');
    var addBtn = document.getElementById('pin-rv-add');
    if (!box) return;
    var lk = _pinLookup(val);
    var row = function (label, v) {
      return '<div style="display:flex;gap:0.6rem;font-size:0.85rem;line-height:1.5"><span style="width:88px;flex-shrink:0;color:var(--text-dim)">' + label + '</span><span style="color:var(--text);font-weight:600">' + (v || '—') + '</span></div>';
    };
    var html = '';
    if (!lk.num) {
      html = '<div style="font-size:0.82rem;color:var(--text-dim)">No number read from the photo — type one above, or hit Research.</div>';
    } else if (lk.master) {
      html = row('Maker', (lk.maker || '—') + (lk.era ? ' <span style="font-weight:400;color:var(--text-dim)">(' + lk.era + ')</span>' : ''))
        + row('Item #', String(lk.num).replace(/</g, '&lt;'))
        + row('Description', String(lk.desc).replace(/</g, '&lt;'));
    } else {
      html = row('Item #', String(lk.num).replace(/</g, '&lt;'))
        + '<div style="font-size:0.8rem;color:var(--text-dim);margin-top:0.2rem">Not found in the catalog — you can still add it, or Research to double-check the number.</div>';
    }
    if (lk.ownedPd) html += '<div style="margin-top:0.45rem;font-size:0.8rem;color:#2ecc71;font-weight:700">✓ Already in your collection — Add will attach these photos to it.</div>';
    box.innerHTML = html;
    if (addBtn) addBtn.textContent = lk.ownedPd ? 'Attach Photos to My Item' : 'Add to My Collection';
  };

  window._pinReview = function (key) {
    _rvGroups = key ? _groups.filter(function (g) { return g.key === key; }) : _selGroups();
    if (!_rvGroups.length) { showToast('Select photos first', 2500, true); return; }
    var n = 0; _rvGroups.forEach(function (g) { n += g.files.length; });
    var sug = '';
    try { var s0 = _ids()[_rvGroups[0].files[0].id]; if (s0 && s0.num) sug = String(s0.num); } catch (eS) {}
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

    // Shared controls (number, AI read, catalog card, action buttons).
    var _controlsHtml =
      '<input id="pin-rv-num" list="pin-rv-list" type="text" value="' + sug.replace(/"/g, '&quot;') + '" placeholder="Item number — e.g. 2343 or 6464-1" autocomplete="off" spellcheck="false" oninput="_pinReviewLookup(this.value)" style="width:100%;box-sizing:border-box;padding:0.55rem 0.75rem;border:1px solid var(--border);border-radius:8px;background:var(--surface2);color:var(--text);font-family:var(--font-mono);font-size:0.95rem;margin-bottom:0.6rem">' +
      '<datalist id="pin-rv-list">' + opts + '</datalist>' +
      _pinAiLine() +
      _pinAltChips() +
      '<div id="pin-rv-info" style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:0.7rem 0.8rem;margin-bottom:0.8rem;display:flex;flex-direction:column;gap:0.25rem"></div>' +
      '<button id="pin-rv-add" onclick="_pinReviewAdd()" class="btn-primary" style="width:100%;padding:0.75rem;border-radius:10px;border:none;font-family:var(--font-body);font-weight:700;font-size:0.95rem;cursor:pointer;margin-bottom:0.5rem">Add to My Collection</button>' +
      '<div style="display:flex;gap:0.5rem;margin-bottom:0.5rem">' +
        '<button onclick="_pinReviewResearch()" style="flex:1;padding:0.6rem;border-radius:9px;border:1.5px solid #8b8e94;background:rgba(139,142,148,0.12);color:#2980b9;font-family:var(--font-body);font-weight:700;font-size:0.85rem;cursor:pointer">Research Number</button>' +
        '<button id="pin-rv-lens" onclick="_pinReviewLens()" style="flex:1;padding:0.6rem;border-radius:9px;border:1.5px solid #8b8e94;background:rgba(139,142,148,0.12);color:#2980b9;font-family:var(--font-body);font-weight:700;font-size:0.85rem;cursor:pointer">Research by Photo</button>' +
      '</div>' +
      // v0.9.915 (Brad): after a Google/Lens search, screenshot the answer and
      // read it — the identify AI pulls the number/description off the shot.
      '<button id="pin-rv-shot" onclick="_pinReadShot()" title="Pick a screenshot of a Google/Lens answer and let the AI read it" style="width:100%;padding:0.6rem;border-radius:9px;border:1.5px solid #2ecc71;background:rgba(46,204,113,0.10);color:#2ecc71;font-family:var(--font-body);font-weight:700;font-size:0.85rem;cursor:pointer;margin-bottom:0.5rem">📸 Read a screenshot of the answer</button>' +
      '<button onclick="_pinReviewDiscard()" style="width:100%;padding:0.6rem;border-radius:9px;border:1.5px solid #8b8e94;background:rgba(139,142,148,0.12);color:#f05008;font-family:var(--font-body);font-weight:700;font-size:0.85rem;cursor:pointer">Discard Photo' + (n > 1 ? 's' : '') + '</button>';

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

    var ov = document.createElement('div');
    ov.id = 'pin-review-ov';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem';
    ov.innerHTML =
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:1.1rem;max-width:' + (_wide ? '900px' : '460px') + ';width:100%;max-height:94vh;overflow-y:auto">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.6rem">' +
          '<div style="font-family:var(--font-head);font-weight:700;font-size:1rem;color:var(--text)">' + n + ' photo' + (n > 1 ? 's' : '') + ' · one item</div>' +
          '<button onclick="document.getElementById(\'pin-review-ov\').remove()" style="background:none;border:none;color:var(--text-dim);font-size:1.35rem;line-height:1;cursor:pointer;padding:0.1rem 0.3rem">✕</button>' +
        '</div>' +
        (_wide
          ? '<div style="display:flex;gap:1.1rem;align-items:stretch">' +
              '<div style="flex:1 1 0;min-width:0;display:flex;flex-direction:column">' + _controlsHtml + '</div>' +
              _panelHtml +
            '</div>'
          : _stripHtml + _controlsHtml
        ) +
      '</div>';
    document.body.appendChild(ov);
    ov.querySelectorAll('img[data-rvfid]').forEach(function (img) {
      loadDriveThumb(img.getAttribute('data-rvfid'), img, img.parentElement);
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
    var tail = s.guess ? ' · the AI wasn’t certain — double-check against your item' : ' · double-check this against your item';
    return '<div style="font-size:0.76rem;color:var(--text-dim);line-height:1.5;margin-bottom:0.6rem;padding:0.45rem 0.6rem;border-left:3px solid ' + col + ';background:' + bg + ';border-radius:0 8px 8px 0">' +
      '<strong style="color:' + col + '">' + lbl + '</strong> ' + (bits ? esc(bits) : 'number only') + (s.num ? ' — No. ' + esc(s.num) : '') +
      '<span style="opacity:0.8">' + tail + '</span></div>';
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
      '<div style="font-size:0.72rem;color:var(--text-dim);margin-bottom:0.3rem">Could be one of these — tap each to compare (★ = the AI’s best guess):</div>' +
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
      var q = 'What model train item is this? Answer with labeled lines: Manufacturer:, Manufacturer SKU or catalog number:, Description:, Year manufactured:. Prefer the manufacturer catalog SKU, not the cab number printed on the model.';
      var url = 'https://www.google.com/searchbyimage?image_url=' + encodeURIComponent(staged.url) + '&q=' + encodeURIComponent(q);
      if (tab) { try { tab.location = url; } catch (e) { tab = null; } }
      if (!tab) window.open(url, '_blank');
      if (btn) { btn.disabled = false; btn.textContent = 'Research by Photo'; }
      // v0.9.895 (Brad: "i copied it, now what?") — same return trip as the
      // wizard's Lens flow: when he comes back with Google's answer copied,
      // parse the clipboard and reopen the review card with it applied.
      _pinLensArm(gs);
      showToast('In the Google tab: copy the answer, then come back here', 4000);
    } catch (e) {
      console.warn('[Inbox] research-by-photo:', e);
      try { if (tab) tab.close(); } catch (e2) {}
      if (btn) { btn.disabled = false; btn.textContent = 'Research by Photo'; }
      showToast('Could not stage the photo for Google — try again', 3000, true);
    }
  };

  // v0.9.915 (Brad): read a SCREENSHOT of a Google/Lens answer. Pick the
  // screenshot, run it through the same identify AI (it reads the labeled
  // Manufacturer/SKU/Description/Year text right off the image), then apply
  // the result to the group and reopen the review card — same shape as the
  // Lens clipboard return-trip, minus the fiddly text-copy step.
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
    inp.onchange = async function () {
      var f = this.files && this.files[0];
      this.value = '';
      if (!f) return;
      var btn = document.getElementById('pin-rv-shot');
      if (btn) { btn.disabled = true; btn.textContent = 'Reading screenshot…'; }
      try {
        var ai = (typeof aiIdentifyImage2 === 'function') ? await aiIdentifyImage2([f], {}) : await aiIdentifyImage(f, {});
        if (!ai || !ai.ok) {
          var why = ai && ai.reason;
          if (why === 'quota') showToast('Daily identify limit reached — type the number, or try tomorrow', 4500, true);
          else if (why === 'noconsent') { /* consent dialog already handled */ }
          else showToast('Could not read that screenshot — type the number instead', 3800, true);
          return;
        }
        var meta = (typeof extractIdentifyMetadata === 'function') ? extractIdentifyMetadata(ai.text) : {};
        var got = meta.itemNum || meta.description || meta.manufacturer || meta.roadName;
        if (!got) { showToast('No item info found in that screenshot — type the number instead', 4000, true); return; }
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
        } catch (eS) { console.warn('[Inbox] screenshot store:', eS); }
        _render();
        // Reopen the review with the read applied (mirrors the Lens return-trip).
        _sel = {};
        gs.forEach(function (g) { _sel[g.key] = true; });
        window._pinReview(gs.length === 1 ? gs[0].key : null);
        showToast(meta._hedge
          ? 'Read the screenshot — the number is a best guess, double-check it'
          : 'Read the screenshot — check it over and hit Add', 4000);
      } catch (e) {
        console.warn('[Inbox] read screenshot:', e);
        showToast('Could not read that screenshot — try again or type the number', 3800, true);
      } finally {
        var b2 = document.getElementById('pin-rv-shot');
        if (b2) { b2.disabled = false; b2.textContent = '📸 Read a screenshot of the answer'; }
      }
    };
    inp.click();
  };

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
      try {
        var ids = _ids();
        var fid0 = gs[0].files[0].id;
        var prev = ids[fid0] || {};
        var trim = function (v, old) { return String(v || old || '').slice(0, 120); };
        // v0.9.898: same best-guess rule as the batch identify — a hedged
        // number from the Lens return is kept, marked guess:1.
        ids[fid0] = {
          num: meta.itemNum ? String(meta.itemNum) : (prev.num || ''),
          guess: meta.itemNum ? (meta._hedge ? 1 : 0) : (prev.guess || 0),
          tried: 1,
          mfr: trim(meta.manufacturer, prev.mfr), desc: trim(meta.description, prev.desc),
          road: trim(meta.roadName, prev.road), year: trim(meta.year, prev.year)
        };
        _idsSave(ids);
      } catch (e) { console.warn('[Inbox] lens return:', e); }
      _render();
      // Reopen the review with the findings applied (works for combined
      // selections too — restore the selection and open from it).
      _sel = {};
      gs.forEach(function (g) { _sel[g.key] = true; });
      window._pinReview(gs.length === 1 ? gs[0].key : null);
      showToast(meta._hedge
        ? "Google's answer applied, but it hedged on the number — double-check it"
        : "Google's answer applied — check it over and hit Add", 4000);
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
  window._pinReviewAdd = async function () {
    var num = String((document.getElementById('pin-rv-num') || {}).value || '').trim();
    if (!num) { showToast('Type or confirm the item number first', 2500, true); return; }
    var gs = _rvGroups;
    if (!gs.length || _busy) return;
    var ov = document.getElementById('pin-review-ov'); if (ov) ov.remove();
    _busy = true;
    try {
      var fromFid = await _folder();
      var toFid = await driveEnsureItemFolder(num);
      var link = driveFolderLink(toFid);
      var lk = _pinLookup(num);
      // Gather every selected file once (used whether we move now or on save).
      var fileList = [];
      for (var g = 0; g < gs.length; g++) {
        for (var f = 0; f < gs[g].files.length; f++) { fileList.push(gs[g].files[f]); }
      }
      var ts = new Date().getTime();
      if (lk.ownedPd) {
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
          try { await sheetsUpdate(state.personalSheetId, 'My Collection!' + personalColLetter('photoItem') + pd.row, [[link]]); } catch (eUp) { console.warn('[Inbox] photo link write:', eUp); }
        }
        showToast('Attached ' + moved + ' photo' + (moved > 1 ? 's' : '') + ' to ' + num, 3000);
        _pinRefresh();
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
            files: fileList.map(function (fl) { return { id: fl.id, name: fl.name }; }) };
          localStorage.setItem(PENDING_KEY, JSON.stringify(pend));
        } catch (eP) {}
        _pinRefresh();
        showToast(fileList.length + ' photo' + (fileList.length > 1 ? 's' : '') + ' will attach when you save — they stay in the inbox until then', 3500);
        var _aiS = {}; try { _aiS = _ids()[gs[0].files[0].id] || {}; } catch (eAi) {}
        // v0.9.907 (Brad, item [1a]): hand the first inbox photo's Drive id to the
        // wizard so the variation step can preview the item you're adding.
        var _addPhotoId = (fileList[0] && fileList[0].id) || '';
        _pinAddNow(num, { manufacturer: _aiS.mfr || '', description: _aiS.desc || '', roadName: _aiS.road || '', year: _aiS.year || '' }, _addPhotoId);
      }
    } catch (e) {
      console.error('[Inbox] add/attach:', e);
      _status('Filing failed partway — hit Refresh to see what’s left, then try again.');
    } finally { _busy = false; }
  };

  window._pinAddNow = function (num, aiMeta, photoDriveId) {
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
          // v0.9.907 (Brad, item [1a]): stash the inbox photo's Drive id so the
          // variation step can preview it (loaded via loadDriveThumb).
          if (photoDriveId) wizard.data._addPhotoDriveId = photoDriveId;
          var m = (typeof findMaster === 'function') ? findMaster(num) : null;
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
              try { await driveRequest('PATCH', '/files/' + file.id, { name: num + ' ADD ' + ((rec.ts || new Date().getTime()) + mv) + '.' + ext }); } catch (eRn) {}
            } catch (eMv) { console.warn('[Inbox] deferred photo move skipped (removed?):', file.id, eMv); }
          }
        }
        if (pd.row && !pd.photoItem && link && typeof sheetsUpdate === 'function' && typeof personalColLetter === 'function' && state.personalSheetId) {
          pd.photoItem = link;
          try { await sheetsUpdate(state.personalSheetId, 'My Collection!' + personalColLetter('photoItem') + pd.row, [[link]]); } catch (eUp) { console.warn('[Inbox] pending link write:', eUp); }
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
  var _idAbort = false;
  window._pinIdentifyCancel = function () { _idAbort = true; };

  async function _pinBytes(fileId) {
    var r = await fetch('https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media', { headers: { Authorization: 'Bearer ' + window.accessToken } });
    if (!r.ok) throw new Error('photo download ' + r.status);
    return await r.blob();
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
    try { if (typeof loadDriveThumb === 'function') loadDriveThumb(fid, img, img.parentElement); } catch (e) {}
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
        document.querySelectorAll('img[data-rvfid="' + fid + '"], img[data-fid="' + fid + '"], img[data-ppfid="' + fid + '"]').forEach(function (im) { im.src = fresh; });
        showToast('Photo updated — tick it and hit Identify to re-read the cleaned-up shot', 3500);
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
            (remaining !== null ? ' · ' + remaining + ' read' + (remaining === 1 ? '' : 's') + ' left today' : '') +
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
          var ai = (typeof aiIdentifyImage2 === 'function')
            ? await aiIdentifyImage2(blobs, {})
            : await aiIdentifyImage(blobs[0], {});
          if (!ai.ok && ai.reason === 'quota') {
            showToast("Daily identify limit reached — the rest can run tomorrow", 4500, true);
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
      if (remaining !== null) msg += ' · ' + remaining + ' read' + (remaining === 1 ? '' : 's') + ' left today';
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
        loadDriveThumb(img.getAttribute('data-ppfid'), img, img.parentElement);
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
    var modal = document.getElementById('wizard-modal');
    if (!modal) return;
    var btn = document.getElementById('qc-batch-btn');
    // NB: `wizard` is a top-level `let` in wizard.js — it is NOT on window.
    var w = (typeof wizard !== 'undefined') ? wizard : null;
    var show = !!(w && w.tab === 'collection' && w.step === 0);
    if (!btn) {
      if (!show) return;
      var cancel = modal.querySelector('.modal-footer button[onclick="closeWizard()"]');
      if (!cancel) return;
      btn = document.createElement('button');
      btn.id = 'qc-batch-btn';
      btn.className = 'btn btn-secondary';
      btn.setAttribute('onclick', '_qcBatchAdd()');
      btn.textContent = 'Batch Add';
      btn.title = 'Snap a bunch of photos now, file them to items later';
      cancel.insertAdjacentElement('afterend', btn);
    }
    btn.style.display = show ? '' : 'none';
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
