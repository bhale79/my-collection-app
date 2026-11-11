// ════════════════════════════════════════════════════════════════════════
// drive-picker.js — TRR Pro: GOOGLE'S FILE PICKER, and the proof that tells
// us what a folder pick opens up.
// ════════════════════════════════════════════════════════════════════════
// Plan PLAN_2026-11-10_TRR_PRO_R9_STAFF.md, Step 1. [stated] Brad 2026-11-10
// 06:09 CT "go ahead and do the google thing", 11:25 CT "yes" to Step 1.
//
// The app signs in with Google's NARROW permission (drive.file). It sees only
// the files it made itself, or the files the person PICKS in Google's own file
// picker. CHECK A (2026-11-01) proved that sharing alone shows a staff member
// nothing. So the picker is how staff (Release 9) and linked collections
// (7B part 2) will reach the business's files.
//
// ONE door: rrPickFromDrive(opts). Nothing else in the app loads or opens the
// picker (tests/drive_picker_tests.js fails if anything does, and proves it on
// a planted second door). It reuses the app's own Google sign-in — the same
// pass every Drive and Sheets request carries — and every setting (the key,
// the app ID, the loader, every word) is RR_DRIVE_PICKER in config.js.
//
// THE PROOF (Step 1): Google's documentation does not say whether picking a
// FOLDER also opens the files INSIDE it. rrPickerProofOpen picks a folder and
// reports exactly what the app can then see and open. "Look again" re-checks
// the SAME folder WITHOUT picking again — that is how we learn whether a file
// added later is covered too (a new pick would grant it afresh and hide the
// answer). Pro only (the collections switch): a regular customer sees nothing.
// ════════════════════════════════════════════════════════════════════════
/* eslint-disable no-var */
(function (root) {
  'use strict';

  function C() { return (typeof RR_DRIVE_PICKER !== 'undefined') ? RR_DRIVE_PICKER : (root.RR_DRIVE_PICKER || {}); }
  function W(k, vars) {
    var w = C().words || {};
    var t = String(w[k] == null ? k : w[k]);
    Object.keys(vars || {}).forEach(function (v) { t = t.split('{' + v + '}').join(String(vars[v])); });
    return t;
  }
  function esc(s) {
    if (typeof rrEsc === 'function') return rrEsc(s);
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function toast(m, ms, bad) { try { if (typeof showToast === 'function') showToast(m, ms || 4000, !!bad); } catch (e) {} }
  function on() { try { return typeof rrFeatureOn === 'function' && rrFeatureOn(C().feature); } catch (e) { return false; } }
  function pass() {
    try { if (typeof accessToken !== 'undefined' && accessToken) return accessToken; } catch (e) {}
    return root.accessToken || null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // THE ONE DOOR
  // ═══════════════════════════════════════════════════════════════════════
  var _loading = null;     // the picker being loaded (one load, shared)
  var _open = false;       // one picker on screen at a time

  // Google's loader, then the picker. Loaded once, on first use — a person
  // who never opens the picker never loads it. A failed load can be tried again.
  function _loadPicker() {
    if (root.google && root.google.picker && root.google.picker.PickerBuilder) return Promise.resolve(root.google.picker);
    if (_loading) return _loading;
    _loading = new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () { finish(new Error('picker load timed out')); }, C().loadWaitMs || 20000);
      function finish(err) {
        if (done) return;
        done = true; clearTimeout(timer);
        if (err || !(root.google && root.google.picker)) reject(err || new Error('picker missing'));
        else resolve(root.google.picker);
      }
      function afterLoader() {
        try {
          root.gapi.load('picker', { callback: function () { finish(null); }, onerror: function () { finish(new Error('picker load failed')); } });
        } catch (e) { finish(e); }
      }
      if (root.gapi && typeof root.gapi.load === 'function') return afterLoader();
      var s = document.createElement('script');
      s.async = true;
      s.onload = afterLoader;
      s.onerror = function () { finish(new Error('loader failed')); };
      s.src = C().loader;
      document.head.appendChild(s);
    });
    _loading.catch(function () { _loading = null; });
    return _loading;
  }

  // ── our Close button, shown above Google's picker while it is open ──────
  function _escapeOff() { var e = document.getElementById('rr-picker-escape'); if (e) e.remove(); }
  function _escapeOn(fn) {
    _escapeOff();
    var e = document.createElement('button');
    e.type = 'button';
    e.id = 'rr-picker-escape';
    e.textContent = W('closePicker');
    e.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(12px + var(--rr-safe-b, 0px));z-index:2147483000;' +
      'min-height:44px;padding:0.5rem 1.2rem;border-radius:22px;border:1px solid var(--border);background:var(--surface);color:var(--text);' +
      'font-family:var(--font-body);font-size:0.95rem;font-weight:600;box-shadow:0 2px 10px var(--scrim);cursor:pointer';
    e.addEventListener('click', fn);
    document.body.appendChild(e);
  }

  // rrPickFromDrive({ folders, title, multi }) → [{ id, name, mimeType }] or null
  //   folders: true  = pick a FOLDER (only folders are shown, and can be chosen)
  //   multi:   true  = more than one may be picked
  // Shows two tabs: My Drive, and Shared with me (where a business's shared
  // folder appears for a staff member). null = cancelled, or it could not open
  // (the person is told why).
  async function rrPickFromDrive(opts) {
    opts = opts || {};
    if (_open) { toast(W('busy')); return null; }
    _open = true;
    try {
      // the pass first: a lapsed pass is renewed through the app's one renewal door
      if (typeof rrPassLapsed === 'function' && rrPassLapsed() && typeof rrWaitForPass === 'function') {
        if (!(await rrWaitForPass('picker'))) { toast(W('signIn'), 5000, true); return null; }
      }
      if (!pass()) { toast(W('signIn'), 5000, true); return null; }
      var P;
      try { P = await _loadPicker(); } catch (eL) { toast(W('loadFailed'), 5000, true); return null; }
      return await new Promise(function (done) {
        // settle ONCE, and take our own Close button away with it
        var settled = false;
        function resolve(v) { if (settled) return; settled = true; _escapeOff(); done(v); }
        var cfg = C();
        var folderType = cfg.folderType;
        function view(sharedOnly) {
          var v = new P.DocsView(P.ViewId.DOCS);
          if (opts.folders) {
            v.setIncludeFolders(true).setSelectFolderEnabled(true).setMimeTypes(folderType);
          } else if (opts.mimeTypes) {
            v.setIncludeFolders(true).setMimeTypes(opts.mimeTypes);
          } else {
            v.setIncludeFolders(true);
          }
          if (sharedOnly) v.setOwnedByMe(false);
          else if (typeof v.setOwnedByMe === 'function') v.setOwnedByMe(true);
          if (typeof v.setLabel === 'function') v.setLabel(sharedOnly ? W('sharedWithMe') : W('myDrive'));
          return v;
        }
        var b = new P.PickerBuilder()
          .setOAuthToken(pass())
          .setDeveloperKey(cfg.apiKey)
          .setAppId(cfg.appId)
          .addView(view(false))
          .addView(view(true))
          .setCallback(function (data) {
            var act = data && data[P.Response.ACTION];
            if (act === P.Action.PICKED) {
              var docs = (data[P.Response.DOCUMENTS] || []).map(function (d) {
                return { id: d[P.Document.ID], name: d[P.Document.NAME], mimeType: d[P.Document.MIME_TYPE] };
              });
              resolve(docs.length ? docs : null);
            } else if (act === P.Action.CANCEL) {
              resolve(null);
            }
          });
        if (opts.title || opts.folders) b.setTitle(opts.title || W('pickFolderTitle'));
        if (opts.multi && P.Feature && P.Feature.MULTISELECT_ENABLED) b.enableFeature(P.Feature.MULTISELECT_ENABLED);
        var picker;
        try { picker = b.build(); }
        catch (eB) { toast(W('loadFailed'), 5000, true); resolve(null); return; }
        // Our own way out. If Google's picker shows an error page inside its
        // window (a refused pass, a site Google does not accept), it offers no
        // Cancel — and the person would be stuck behind it. This button always
        // closes it, and the door opens again.
        _escapeOn(function () {
          try { picker.setVisible(false); } catch (e1) {}
          try { if (typeof picker.dispose === 'function') picker.dispose(); } catch (e2) {}
          resolve(null);
        });
        try { picker.setVisible(true); }
        catch (eV) { toast(W('loadFailed'), 5000, true); resolve(null); }
      });
    } finally {
      _open = false;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // THE PROOF — what can the app see after a folder is picked?
  // ═══════════════════════════════════════════════════════════════════════
  function _why(e) {
    var st = e && e.status;
    var m = String((e && e.message) || e || '');
    var code = st || (m.match(/\((\d{3})\)/) || [])[1] || '';
    if (String(code) === '404') return '404, not found';
    if (String(code) === '403') return '403, not allowed';
    if (String(code) === '401') return '401, signed out';
    return code ? String(code) : (m.slice(0, 60) || 'error');
  }
  function _kind(mt) {
    mt = String(mt || '');
    if (mt === C().folderType) return 'folder';
    if (mt === 'application/vnd.google-apps.spreadsheet') return 'sheet';
    if (mt.indexOf('image/') === 0) return 'photo';
    return 'other';
  }
  function _saved() {
    try { var o = JSON.parse(localStorage.getItem(C().proofKey) || 'null'); return (o && o.id) ? { id: String(o.id), name: String(o.name || '') } : null; } catch (e) { return null; }
  }
  function _save(f) {
    try { localStorage.setItem(C().proofKey, JSON.stringify({ id: f.id, name: f.name || '' })); } catch (e) {}
  }

  // Both checks ask Google directly with the pass, on purpose: a file the
  // app may not open answers 403/404, and that answer IS the finding. Going
  // through sheetsGet would read a 403 as a dead pass and start a renewal.
  async function _sheetReadable(id) {
    try {
      var res = await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(id) + '/values/A1:B2', {
        headers: { Authorization: 'Bearer ' + pass() },
      });
      return res.ok ? { ok: true } : { ok: false, why: _why({ status: res.status }) };
    } catch (e) { return { ok: false, why: _why(e) }; }
  }
  async function _photoOpens(id) {
    try {
      var res = await fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(id) + '?alt=media&supportsAllDrives=true', {
        headers: { Authorization: 'Bearer ' + pass(), Range: 'bytes=0-31' },
      });
      return res.ok ? { ok: true } : { ok: false, why: _why({ status: res.status }) };
    } catch (e) { return { ok: false, why: _why(e) }; }
  }

  // Walk the folder (folders inside it too, a few levels down), then open a
  // few of its sheets and photos. Returns the facts; _paint shows them.
  async function rrPickerProofLook(folder) {
    var cfg = C();
    var out = { folder: folder, at: new Date(), seen: false, seenWhy: '', items: [], listWhy: '', truncated: false };
    try {
      await driveRequest('GET', '/files/' + encodeURIComponent(folder.id) + '?fields=id,name,mimeType&supportsAllDrives=true');
      out.seen = true;
    } catch (e) { out.seenWhy = _why(e); }
    var queue = [{ id: folder.id, path: '', depth: 0 }];
    var max = cfg.proofMaxItems || 200;
    while (queue.length) {
      var f = queue.shift();
      var q = "'" + String(f.id).replace(/['\\]/g, '') + "' in parents and trashed=false";
      var r;
      try {
        r = await driveRequest('GET', '/files?q=' + encodeURIComponent(q) +
          '&fields=' + encodeURIComponent('files(id,name,mimeType)') +
          '&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true');
      } catch (e) { if (f.depth === 0) out.listWhy = _why(e); continue; }
      var files = (r && r.files) || [];
      for (var i = 0; i < files.length; i++) {
        if (out.items.length >= max) { out.truncated = true; queue = []; break; }
        var x = files[i];
        var it = { id: x.id, name: x.name, kind: _kind(x.mimeType), path: f.path + x.name };
        out.items.push(it);
        if (it.kind === 'folder' && f.depth + 1 < (cfg.proofMaxDepth || 3)) queue.push({ id: x.id, path: it.path + ' \u203a ', depth: f.depth + 1 });
      }
    }
    var checks = cfg.proofMaxChecks || 8;
    var sheets = out.items.filter(function (it) { return it.kind === 'sheet'; }).slice(0, checks);
    var photos = out.items.filter(function (it) { return it.kind === 'photo'; }).slice(0, checks);
    for (var s = 0; s < sheets.length; s++) sheets[s].check = await _sheetReadable(sheets[s].id);
    for (var p = 0; p < photos.length; p++) photos[p].check = await _photoOpens(photos[p].id);
    return out;
  }

  // The verdict, from the facts only.
  function rrPickerProofAnswer(out) {
    if (!out || !out.seen) return 'answerNone';
    if (!out.items.length) return 'answerB';
    var bad = out.items.some(function (it) { return it.check && !it.check.ok; });
    return bad ? 'answerPart' : 'answerA';
  }

  // ── the report screen ──────────────────────────────────────────────────
  function _close() { var d = document.getElementById('rr-picker-proof'); if (d) d.remove(); }
  function _shell(inner) {
    _close();
    var d = document.createElement('div');
    d.id = 'rr-picker-proof';
    d.style.cssText = 'position:fixed;inset:0;z-index:9600;background:var(--scrim);display:flex;align-items:center;justify-content:center;padding:1rem';
    d.innerHTML = '<div style="background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:12px;max-width:560px;width:100%;max-height:90vh;max-height:90dvh;overflow:auto;padding:1rem 1.1rem;font-family:var(--font-body);position:relative">' +
      '<button type="button" aria-label="' + esc(W('close')) + '" data-pp-x style="position:absolute;top:0.4rem;right:0.6rem;background:none;border:none;color:var(--text);font-size:1.5rem;cursor:pointer">&times;</button>' +
      '<div style="font-family:var(--font-head);font-weight:700;font-size:1.15rem;margin:0.1rem 2rem 0.5rem 0">' + esc(W('title')) + '</div>' +
      inner + '</div>';
    document.body.appendChild(d);
    if (typeof rrDismissGuard === 'function') { try { rrDismissGuard(d, _close); } catch (e) {} }
    d.querySelector('[data-pp-x]').addEventListener('click', _close);
    return d;
  }
  function _paint(out) {
    var n = { sheet: 0, photo: 0, folder: 0, other: 0 };
    out.items.forEach(function (it) { n[it.kind]++; });
    var line = function (t, cls) { return '<div' + (cls ? ' ' + cls : '') + ' style="margin:0.25rem 0;font-size:0.92rem;line-height:1.4">' + esc(t) + '</div>'; };
    var checkLine = function (it) {
      var c = it.check;
      var res = !c ? W('notChecked') : (c.ok ? W('readOk') : W('readNo', { why: c.why || '' }));
      return '<div data-pp-check="' + esc(it.kind) + '" data-pp-ok="' + (c ? (c.ok ? '1' : '0') : '') + '" style="display:flex;gap:0.6rem;font-size:0.88rem;margin:0.15rem 0"><span style="flex:1;min-width:0;overflow-wrap:anywhere">' + esc(it.path) + '</span><span style="white-space:nowrap">' + esc(res) + '</span></div>';
    };
    var answer = rrPickerProofAnswer(out);
    var h = line(W('folder', { name: out.folder.name || out.folder.id })) +
      '<div style="font-size:0.8rem;color:var(--text-dim);margin-bottom:0.6rem">' + esc(W('lookedAt', { time: out.at.toLocaleString() })) + '</div>' +
      '<div data-pp-answer="' + esc(answer) + '" style="font-weight:700;padding:0.55rem 0.7rem;border:1px solid var(--border);border-radius:8px;margin-bottom:0.7rem">' + esc(W(answer)) + '</div>' +
      line(out.seen ? W('folderSeen') : W('folderNotSeen', { why: out.seenWhy }), 'data-pp-folder="' + (out.seen ? '1' : '0') + '"') +
      (out.listWhy ? line(W('listFailed', { why: out.listWhy })) :
        line(out.items.length ? W('inside', { n: out.items.length, sheets: n.sheet, photos: n.photo, folders: n.folder, other: n.other }) : W('insideNone'), 'data-pp-count="' + out.items.length + '"')) +
      (out.truncated ? line(W('truncated', { n: out.items.length })) : '');
    var sheets = out.items.filter(function (it) { return it.kind === 'sheet'; });
    var photos = out.items.filter(function (it) { return it.kind === 'photo'; });
    if (sheets.length) h += '<div style="font-weight:700;margin:0.8rem 0 0.2rem">' + esc(W('sheetsHead')) + '</div>' + sheets.map(checkLine).join('');
    if (photos.length) h += '<div style="font-weight:700;margin:0.8rem 0 0.2rem">' + esc(W('photosHead')) + '</div>' + photos.map(checkLine).join('');
    if (out.items.length) {
      h += '<details style="margin-top:0.8rem"><summary style="cursor:pointer;min-height:36px">' + esc(W('allHead')) + ' (' + out.items.length + ')</summary>' +
        out.items.map(function (it) { return '<div data-pp-item style="font-size:0.85rem;margin:0.1rem 0;overflow-wrap:anywhere">' + esc(it.path) + '</div>'; }).join('') + '</details>';
    }
    h += '<div style="display:flex;flex-wrap:wrap;gap:0.5rem;justify-content:flex-end;margin-top:1rem">' +
      '<button type="button" class="pref-btn" data-pp-close>' + esc(W('close')) + '</button>' +
      '<button type="button" class="pref-btn" data-pp-pick>' + esc(W('pickAgain')) + '</button>' +
      '<button type="button" class="pref-btn" data-pp-again style="font-weight:700;background:var(--accent);color:var(--on-accent)">' + esc(W('lookAgain')) + '</button></div>';
    var d = _shell(h);
    d.querySelector('[data-pp-close]').addEventListener('click', _close);
    d.querySelector('[data-pp-pick]').addEventListener('click', function () { _close(); rrPickerProofOpen(); });
    d.querySelector('[data-pp-again]').addEventListener('click', function () { rrPickerProofAgain(); });
  }

  var _running = false;   // one look at a time (a double tap never runs two)
  async function _run(folder) {
    if (_running) return;
    _running = true;
    try {
      _shell(line0(W('looking', { name: folder.name || folder.id })));
      var out = await rrPickerProofLook(folder);
      if (document.getElementById('rr-picker-proof')) _paint(out);
    } finally { _running = false; }
  }
  function line0(t) { return '<div data-pp-looking style="padding:0.6rem 0;color:var(--text-mid)">' + esc(t) + '</div>'; }

  // Pick a folder, then look.
  async function rrPickerProofOpen() {
    if (!on()) return;
    _close();
    var picked = await rrPickFromDrive({ folders: true, title: W('pickFolderTitle') });
    if (!picked || !picked[0]) return;
    var f = { id: picked[0].id, name: picked[0].name };
    _save(f);
    if (typeof rrPrefsPickerRowRefresh === 'function') { try { rrPrefsPickerRowRefresh(); } catch (e) {} }
    await _run(f);
  }
  // Look again at the SAME folder — no new pick.
  async function rrPickerProofAgain() {
    if (!on()) return;
    var f = _saved();
    if (!f) return rrPickerProofOpen();
    await _run(f);
  }

  // ── Preferences: Business tools (Pro only) ─────────────────────────────
  function _rowInner() {
    var f = _saved();
    return '<div class="pref-row-label"><strong>' + esc(W('proofRow')) + '</strong><span>' + esc(W('proofRowHelp')) + '</span></div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:0.4rem;justify-content:flex-end">' +
      (f ? '<button type="button" class="pref-btn" data-pp-prefs-again onclick="rrPickerProofAgain()">' + esc(W('proofAgain', { name: f.name || f.id })) + '</button>' : '') +
      '<button type="button" class="pref-btn" data-pp-prefs-pick onclick="rrPickerProofOpen()">' + esc(W('proofPick')) + '</button></div>';
  }
  function rrPrefsPickerHtml() {
    if (!on()) return '';
    return '<div class="pref-section" data-pp-prefs>' +
      '<div class="pref-section-title" onclick="_togglePrefSection(this)" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center">' +
        esc(W('prefsSection')) + ' <span style="font-size:0.7rem;color:var(--text-dim);transition:transform 0.2s">\u25b6</span></div>' +
      '<div class="pref-section-body" style="display:none"><div class="pref-row" id="rr-pp-prefs-row">' + _rowInner() + '</div></div></div>';
  }
  function rrPrefsPickerRowRefresh() {
    var r = document.getElementById('rr-pp-prefs-row');
    if (r) r.innerHTML = _rowInner();
  }

  root.rrPickFromDrive = rrPickFromDrive;
  root.rrPickerProofOpen = rrPickerProofOpen;
  root.rrPickerProofAgain = rrPickerProofAgain;
  root.rrPickerProofLook = rrPickerProofLook;
  root.rrPickerProofAnswer = rrPickerProofAnswer;
  root.rrPrefsPickerHtml = rrPrefsPickerHtml;
  root.rrPrefsPickerRowRefresh = rrPrefsPickerRowRefresh;
})(typeof window !== 'undefined' ? window : this);
