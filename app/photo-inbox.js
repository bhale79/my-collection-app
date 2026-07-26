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
  var _selectMode = false;   // true while EITHER selection mode is running
  // v0.9.1057 (Brad): "Select multiple" said nothing about what it was for, so
  // the two things people actually do — put photos together, and say what they
  // are — had no front door. Two named buttons now, one selection mechanic.
  var _rvKey = '';           // group key the review card is open on ('' = multi-select)
  var _selPurpose = '';      // '' | 'group' | 'tag'  — what Apply does
  var _tagEra = '';          // era picked in tag mode, written on Apply
  // A shooting session. The context bar used to sit on the page permanently;
  // Brad only wants it while he is actually shooting. It appears when a session
  // starts, and Done ends it. Deliberately NOT persisted: a stale "Lionel
  // Postwar" left armed a week later is how forty cars get mis-stamped.
  var _pinSession = false;
  var _sessionEra = '';      // the session's home era (memory only)
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
      '<div style="font-size:0.8rem;color:var(--text-dim);line-height:1.5;margin-bottom:0.7rem">Drop photos anywhere below, or use Add photos. Click a photo to review it — add the item, research it more, or discard the photo. Use “Group photos” to put several shots of one item together, and “Tag maker/era/scale” to say what photos are. Photos snapped with Quick Capture on your phone land here too.</div>' +
      '<div id="pin-context-bar" style="display:none"></div>' +   // v0.9.1048 capture context
      '<div id="pin-filter-row" style="display:none"></div>' +   // v0.9.1051 filters
      '<div id="pin-tagbar" style="display:none"></div>' +        // v0.9.1057 tag mode
      '<div style="display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;margin-bottom:0.8rem">' +
        '<button onclick="_pinAddSource()" class="btn-primary" style="padding:0.5rem 0.9rem;border-radius:8px;border:none;font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">Add photos…</button>' +
        '<button id="pin-group-btn" onclick="_pinStartMode(\'group\')" style="' + 'padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #8b8e94;background:rgba(139,142,148,0.12);color:#2980b9;font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer' + '">Group photos</button>' +
        '<button id="pin-tag-btn" onclick="_pinStartMode(\'tag\')" style="' + 'padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #8b8e94;background:rgba(139,142,148,0.12);color:#2980b9;font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer' + '">Tag maker/era/scale</button>' +
        '<button id="pin-apply-btn" onclick="_pinApplyTags()" style="display:none;padding:0.5rem 0.9rem;border-radius:8px;border:none;background:var(--accent);color:#fff;font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">Apply</button>' +
        '<button id="pin-finish-btn" onclick="_pinFinishMode()" style="display:none;padding:0.5rem 0.9rem;border-radius:8px;border:none;background:var(--accent2);color:#1a1a1a;font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">✓ Finished</button>' +
        '<button id="pin-selall-btn" onclick="_pinSelectAll()" style="display:none;padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #8b8e94;background:rgba(139,142,148,0.12);color:#2980b9;font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">Select all</button>' +
        '<button id="pin-recrop-btn" onclick="_pinReadCropped()" style="display:none;padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid var(--accent2);background:rgba(212,168,67,0.14);color:var(--accent2);font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">Re-read cropped</button>' +
        '<button id="pin-idall-btn" onclick="_pinIdentifyAll()" style="display:none;padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid var(--accent2);background:rgba(212,168,67,0.14);color:var(--accent2);font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">🔍 Read with a token</button>' +
        '<button id="pin-audit-btn" onclick="_pinReaderAudit()" style="padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #8b8e94;background:rgba(139,142,148,0.12);color:#2980b9;font-family:var(--font-body);font-weight:600;font-size:0.82rem;cursor:pointer">Reader audit (free)</button>' +
        '<button onclick="_pinRefresh()" style="padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #8b8e94;background:rgba(139,142,148,0.12);color:#2980b9;font-family:var(--font-body);font-weight:600;font-size:0.82rem;cursor:pointer">Refresh</button>' +
        '<span style="flex:1"></span>' +
        '<span id="pin-selinfo" style="font-size:0.78rem;color:var(--text-dim)"></span>' +
        '<button id="pin-idsel-btn" onclick="_pinIdentifySelected()" style="display:none;padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #8b8e94;background:rgba(139,142,148,0.12);color:#2980b9;font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">Identify</button>' +
        '<button id="pin-assign-btn" onclick="_pinReview(null)" style="display:none;padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #8b8e94;background:rgba(139,142,148,0.12);color:#2980b9;font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">Combine → one item…</button>' +
        '<button id="pin-groupas-btn" onclick="_pinGroupAs()" style="display:none;padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid #8b8e94;background:rgba(139,142,148,0.12);color:#2980b9;font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer">Group as\u2026</button>' +
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
  // ══ v0.9.1051 — filters (Brad's idea 4) ══════════════════════════════════
  // Brad asked for sub-folders: sorted, unsorted, Lionel postwar, engines,
  // identified, best guess. Most of those are PROPERTIES, not places — one
  // photo is Lionel and postwar and an engine and identified all at once, so
  // filing it into a folder means picking which fact wins and losing the rest.
  // These are filters: a view over the same photos, instant, and free. (Real
  // Drive sub-folders would also be an API call per photo and painful to undo.)
  //
  // The filter he will actually live in is STATUS, because with two hundred
  // items off a wall the fast way through is not photo by photo — it is "show
  // me the forty it was confident about" and rubber-stamp them, then "show me
  // the ones it could not read" and do those properly.
  var _pinFilter = { status: '', era: '', kind: '' };

  function _pinStatusOf(f) {
    var m = (f && f._meta) || {};
    var sug = _ids()[f.id];
    if (m.stat === 'filed') return 'filed';
    if (m.num || (sug && sug.num && !sug.guess)) return 'read';
    if (sug && (sug.num || (sug.alts && sug.alts.length))) return 'guess';
    if (sug && sug.tried) return 'noread';
    if (m.era) return 'stamped';
    return 'new';
  }
  var _PIN_STATUS_LABELS = {
    new: 'Not touched yet', stamped: 'Stamped, not read', read: 'Number found',
    guess: 'Best guess only', noread: 'Could not read', filed: 'Filed',
  };

  // ══ v0.9.1061 — never read the "everything together" shot ═══════════════
  // Brad: "on grouped items, it doesn't need to read the set picture or the
  // engine+tender picture or the aa, ab, aba picture, just the individual
  // items."
  //
  // Right, and it is worse than wasted effort. A photo of three locomotives
  // side by side has three numbers in it; the reader picks one and attaches it
  // to the group, so a shot taken to show the set as a whole actively produces
  // a wrong answer. The individual shots are the ones with exactly one number.
  //
  // 'together' is a real role in the kind table (Both together / All three
  // together / The whole set), so this is simply "skip that role".
  function _pinReadFiles(g) {
    if (!g || !g.files || !g.files.length) return [];
    var body = g.files.filter(function (f) {
      var m = (f && f._meta) || {};
      return m.role !== 'together';
    });
    // A group of nothing BUT together shots still deserves an attempt rather
    // than becoming unreadable — fall back to everything.
    return body.length ? body : g.files.slice();
  }
  // The one photo that represents this group for reading purposes.
  function _pinReadFile(g) { return _pinReadFiles(g)[0] || (g && g.files && g.files[0]) || null; }
  function _pinReadFid(g) { var f = _pinReadFile(g); return f ? f.id : ''; }

  function _pinGroupPasses(g) {
    var f = _pinReadFile(g) || g.files[0], m = (f && f._meta) || {};
    if (_pinFilter.status && _pinStatusOf(f) !== _pinFilter.status) return false;
    if (_pinFilter.era && m.era !== _pinFilter.era) return false;
    if (_pinFilter.kind && (m.kind || 'single') !== _pinFilter.kind) return false;
    return true;
  }
  function _pinVisibleGroups() {
    if (!_pinFilter.status && !_pinFilter.era && !_pinFilter.kind) return _groups;
    return _groups.filter(_pinGroupPasses);
  }
  function _pinFilterActive() { return !!(_pinFilter.status || _pinFilter.era || _pinFilter.kind); }

  // Counts so a chip can say what is behind it before you tap.
  function _pinCounts() {
    var st = {}, era = {}, kind = {};
    _groups.forEach(function (g) {
      var f = _pinReadFile(g) || g.files[0], m = (f && f._meta) || {};
      var s2 = _pinStatusOf(f); st[s2] = (st[s2] || 0) + 1;
      if (m.era) era[m.era] = (era[m.era] || 0) + 1;
      var k = m.kind || 'single'; kind[k] = (kind[k] || 0) + 1;
    });
    return { status: st, era: era, kind: kind };
  }

  window._pinSetFilter = function (which, val) {
    _pinFilter[which] = (_pinFilter[which] === val) ? '' : val;
    _render();
  };
  window._pinClearFilters = function () {
    _pinFilter = { status: '', era: '', kind: '' };
    _render();
  };
  if (typeof window !== 'undefined') {
    window._pinVisibleGroups = _pinVisibleGroups;
    window._pinStatusOf = _pinStatusOf;
    window._pinCounts = _pinCounts;
    window._pinFilterState = function () { return _pinFilter; };
  }

  function _pinRenderFilters() {
    var el = document.getElementById('pin-filter-row');
    if (!el) return;
    var c = _pinCounts();
    var chips = [];
    function chip(which, val, label, n) {
      if (!n) return;
      var on = _pinFilter[which] === val;
      chips.push('<button onclick="_pinSetFilter(\'' + which + '\',\'' + val + '\')" style="padding:0.35rem 0.7rem;border-radius:999px;'
        + 'border:1.5px solid ' + (on ? 'var(--accent)' : 'var(--border)') + ';background:' + (on ? 'rgba(232,64,28,0.14)' : 'var(--surface2)') + ';'
        + 'color:' + (on ? 'var(--accent)' : 'var(--text-mid)') + ';font-size:0.78rem;font-weight:600;cursor:pointer;min-height:36px">'
        + rrEsc(label) + ' <span style="opacity:0.7">' + n + '</span></button>');
    }
    ['new','stamped','guess','read','noread','filed'].forEach(function (k) { chip('status', k, _PIN_STATUS_LABELS[k], c.status[k]); });
    Object.keys(c.era).forEach(function (k) { chip('era', k, _pinEraLabel(k), c.era[k]); });
    Object.keys(c.kind).forEach(function (k) { if (k !== 'single') chip('kind', k, _pinKindLabel(k), c.kind[k]); });
    if (!chips.length) { el.style.display = 'none'; return; }
    el.style.display = 'flex';
    el.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.35rem;margin-bottom:0.7rem;align-items:center';
    el.innerHTML = chips.join('')
      + (_pinFilterActive()
          ? '<button onclick="_pinClearFilters()" style="padding:0.35rem 0.7rem;border-radius:999px;border:none;background:none;color:var(--text-dim);font-size:0.78rem;text-decoration:underline;cursor:pointer;min-height:36px">Show all</button>'
          : '');
  }

  // ══ v0.9.1050 — group kinds and roles ════════════════════════════════════
  // Photos already stack into groups (the g<id> tag). What a stack could not
  // say is WHAT it is — and that matters, because an ABA is not one item with
  // three photos, it is three inventory rows that share a group, and each unit
  // needs its role so it saves as -P, C or -D. Brad's flow is: shoot the
  // powered A, the B, the dummy A, then a fourth shot of the three together.
  //
  // Roles are per kind, and 'together' exists for that last shot — the one
  // that becomes the group's cover photo rather than an item of its own.
  var _PIN_KINDS = [
    { id:'single', label:'One item',            roles:[] },
    { id:'tender', label:'Engine + tender',     roles:[['engine','Engine'],['tender','Tender'],['together','Both together']] },
    { id:'aa',     label:'AA — two A units',    roles:[['p','A unit, powered'],['d','A unit, dummy'],['together','Both together']] },
    { id:'ab',     label:'AB — A and B',        roles:[['p','A unit, powered'],['b','B unit'],['together','Both together']] },
    { id:'aba',    label:'ABA — A, B, A',       roles:[['p','A unit, powered'],['b','B unit'],['d','A unit, dummy'],['together','All three together']] },
    { id:'set',    label:'Set',                 roles:[['member','A piece of the set'],['together','The whole set']] },
    { id:'box',    label:'Item + its box',      roles:[['item','The item'],['box','The box']] },
  ];
  function _pinKind(id) {
    for (var i = 0; i < _PIN_KINDS.length; i++) if (_PIN_KINDS[i].id === id) return _PIN_KINDS[i];
    return _PIN_KINDS[0];
  }
  function _pinKindLabel(id) { return _pinKind(id).label; }
  function _pinRoleLabel(kindId, roleId) {
    var rs = _pinKind(kindId).roles;
    for (var i = 0; i < rs.length; i++) if (rs[i][0] === roleId) return rs[i][1];
    return '';
  }
  // Sensible first guess: the order the photos were taken is usually the order
  // Brad shot them in — powered, B, dummy, together.
  function _pinDefaultRoles(kindId, n) {
    var rs = _pinKind(kindId).roles, out = [];
    if (!rs.length) return out;
    // 'together' is only a real possibility for kinds that HAVE one, and only
    // when there are more photos than units. A six-piece set shot one piece at
    // a time is six members and no group shot — guessing otherwise would
    // mislabel the last one every time.
    var hasTogether = rs.some(function (r) { return r[0] === 'together'; });
    var body = hasTogether ? rs.slice(0, -1) : rs;
    for (var i = 0; i < n; i++) {
      if (i < body.length) out.push(body[i][0]);
      else if (hasTogether && i === n - 1 && body.length > 1) out.push('together');
      else out.push(body[body.length - 1][0]);
    }
    return out;
  }
  if (typeof window !== 'undefined') {
    window._pinKinds = function () { return _PIN_KINDS; };
    window._pinDefaultRoles = _pinDefaultRoles;
    window._pinKindLabel = _pinKindLabel;
  }

  // "Group as…" — takes the ticked photos, gives them one group id, a kind and
  // a role each, and writes all of it to the Drive files.
  window._pinGroupAs = function () {
    var gs = _selGroups();
    var files = [];
    gs.forEach(function (g) { g.files.forEach(function (f) { files.push(f); }); });
    if (files.length < 2) { showToast('Tick two or more photos first', 2800, true); return; }

    var kindId = 'aba';
    var roles = _pinDefaultRoles(kindId, files.length);

    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,0.55);display:flex;align-items:flex-end;justify-content:center';
    var card = document.createElement('div');
    card.style.cssText = 'background:var(--surface);border:1px solid var(--border);border-top-left-radius:16px;border-top-right-radius:16px;'
      + 'width:100%;max-width:560px;padding:1rem 1rem 1.2rem;max-height:86vh;max-height:86dvh;overflow-y:auto';
    ov.appendChild(card);
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };

    function draw() {
      var k = _pinKind(kindId);
      roles = roles.slice(0, files.length);
      while (roles.length < files.length) roles.push(k.roles.length ? k.roles[k.roles.length - 1][0] : '');
      card.innerHTML =
        '<div style="font-family:var(--font-head);font-size:1.05rem;font-weight:700;margin-bottom:0.15rem">How do these ' + files.length + ' photos go together?</div>'
        + '<div style="font-size:0.8rem;color:var(--text-dim);line-height:1.5;margin-bottom:0.8rem">An AA, AB or ABA saves as separate items that stay linked. A set shot of everything together becomes the group\'s cover photo.</div>'
        + '<select id="pin-grp-kind" style="width:100%;padding:0.6rem 0.7rem;border-radius:8px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-size:0.95rem;min-height:46px;box-sizing:border-box;margin-bottom:0.8rem">'
        +   _PIN_KINDS.map(function (kk) { return '<option value="' + kk.id + '"' + (kk.id === kindId ? ' selected' : '') + '>' + rrEsc(kk.label) + '</option>'; }).join('')
        + '</select>'
        + (k.roles.length
            ? files.map(function (f, i) {
                return '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.4rem 0;border-top:1px solid var(--border)">'
                  // v0.9.1058 (Brad: "need thumbnails on this popup to help me
                  // select"). A numbered square told you there were seven photos
                  // but not WHICH was which, so assigning powered / dummy / B was
                  // guesswork against the shooting order.
                  + '<div style="position:relative;width:46px;height:46px;border-radius:6px;overflow:hidden;background:var(--surface2);flex-shrink:0">'
                  +   '<img data-grpfid="' + f.id + '" style="width:100%;height:100%;object-fit:cover;display:block" alt="">'
                  +   '<div style="position:absolute;left:0;bottom:0;background:rgba(0,0,0,0.6);color:#fff;font-size:0.55rem;padding:0 3px;border-radius:0 4px 0 0">' + (i + 1) + '</div>'
                  + '</div>'
                  + '<select data-ri="' + i + '" class="pin-grp-role" style="flex:1;min-width:0;padding:0.5rem;border-radius:8px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-size:0.88rem;min-height:44px">'
                  +   k.roles.map(function (r) { return '<option value="' + r[0] + '"' + (r[0] === roles[i] ? ' selected' : '') + '>' + rrEsc(r[1]) + '</option>'; }).join('')
                  + '</select></div>';
              }).join('')
            : '<div style="font-size:0.8rem;color:var(--text-dim);padding:0.5rem 0">All ' + files.length + ' photos will be filed as one item.</div>')
        + '<div style="display:flex;gap:0.5rem;margin-top:1rem">'
        +   '<button id="pin-grp-save" style="flex:2;padding:0.75rem;border-radius:9px;border:none;background:var(--accent);color:#fff;font-weight:700;font-size:0.95rem;min-height:50px;cursor:pointer">Group them</button>'
        +   '<button id="pin-grp-cancel" style="flex:1;padding:0.75rem;border-radius:9px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-weight:600;font-size:0.92rem;min-height:50px;cursor:pointer">Cancel</button>'
        + '</div>';
      // draw() re-renders on every kind change, so re-hydrate the thumbs each time.
      try {
        Array.prototype.forEach.call(card.querySelectorAll('img[data-grpfid]'), function (im) {
          loadDriveThumb(im.getAttribute('data-grpfid'), im, im.parentElement, null, 'hi');
        });
      } catch (eTh) {}
      card.querySelector('#pin-grp-kind').onchange = function () {
        kindId = this.value; roles = _pinDefaultRoles(kindId, files.length); draw();
      };
      Array.prototype.forEach.call(card.querySelectorAll('.pin-grp-role'), function (sel) {
        sel.onchange = function () { roles[parseInt(this.getAttribute('data-ri'), 10)] = this.value; };
      });
      card.querySelector('#pin-grp-cancel').onclick = function () { ov.remove(); };
      card.querySelector('#pin-grp-save').onclick = async function () {
        this.disabled = true; this.textContent = 'Saving…';
        var gid = 'G' + Date.now().toString(36);
        var okAll = 0;
        for (var i = 0; i < files.length; i++) {
          var ok = await _pinMetaSet(files[i].id, { grp: gid, kind: kindId, role: roles[i] || '' });
          if (ok) okAll++;
          this.textContent = 'Saving… ' + (i + 1) + '/' + files.length;
        }
        ov.remove();
        if (okAll === files.length) showToast('Grouped as ' + _pinKindLabel(kindId), 3000);
        else showToast('Grouped ' + okAll + ' of ' + files.length + ' — try the rest again', 5000, true);
        _sel = {}; _pinRefresh();
      };
    }
    draw();
    document.body.appendChild(ov);
  };

  window._pinConfirmUngroup = async function (key) {
    var g = null;
    _groups.forEach(function (x) { if (x.key === key) g = x; });
    if (!g || g.files.length < 2) return;
    var ok = await _pinConfirm('Split this back into ' + g.files.length
      + ' separate photos? Nothing is deleted \u2014 they just stop being one item.', 'Split apart');
    if (ok) window._pinUngroup(key);
  };

  // Break a group back into loose photos.
  window._pinUngroup = async function (key) {
    var g = null;
    _groups.forEach(function (x) { if (x.key === key) g = x; });
    if (!g || g.files.length < 2) return;
    var ok = await _pinMetaSetMany(g.files.map(function (f) { return f.id; }), { grp: '', kind: 'single', role: '' });
    showToast(ok === g.files.length ? 'Split back into single photos' : ('Split ' + ok + ' of ' + g.files.length), 3000, ok !== g.files.length);
    _pinRefresh();
  };

  // ══ v0.9.1048 — capture context ══════════════════════════════════════════
  // Brad shoots a wall: forty Lionel Postwar cars in a row, then one modern
  // "Celebration Series" remake that is identical to the postwar version apart
  // from a plaque underneath. The reader cannot see the difference; only he
  // knows. So the photo needs to carry what he knows, from the moment he takes
  // it.
  //
  // Two settings, deliberately different:
  //   HOME     the shelf you are working — sticky, survives restarts.
  //   ONE-SHOT armed for the NEXT photo only, then springs back to home.
  // One-shot is the default when you change the bar, because "flip it, take
  // one, flip it back" is the real pattern and forgetting the flip back is the
  // failure that quietly mis-stamps the next forty cars.
  //
  // One era key carries maker, scale and period together, so the three
  // dropdowns narrow each other and cannot produce a combination that never
  // existed (there is no Lionel prewar HO).
  var _PIN_HOME_KEY = 'rr_capture_home_era';
  var _pinOneShot = null;          // era key armed for the next photo only

  // v0.9.1057: the home era used to live in localStorage and survive restarts.
  // Brad's call: it clears when the session is done. A setting that outlives the
  // shelf you were photographing is a trap, not a convenience — you come back
  // next week, shoot MTH, and it all lands as Lionel Postwar.
  function _pinHomeEra() { return _sessionEra || ''; }
  function _pinSetHomeEra(era) { _sessionEra = era || ''; }
  // What the next photo will be stamped with.
  function _pinActiveEra() { return _pinOneShot || _pinHomeEra(); }

  function _pinEraLabel(era) {
    if (!era) return 'Not set';
    try {
      var d = (typeof ERAS !== 'undefined') ? ERAS[era] : null;
      var scale = (typeof ERA_SCALE !== 'undefined' && ERA_SCALE[era]) ? ERA_SCALE[era] : '';
      if (d) return d.label + (scale ? ' · ' + scale : '');
    } catch (e) {}
    return era;
  }

  // Every era the app knows, grouped by maker — the source for the pickers.
  function _pinEraChoices() {
    var out = [];
    try {
      if (typeof ERAS === 'undefined') return out;
      Object.keys(ERAS).forEach(function (k) {
        var d = ERAS[k];
        if (!d || k === 'all') return;
        out.push({
          key: k,
          maker: d.manufacturer || 'Other',
          scale: (typeof ERA_SCALE !== 'undefined' && ERA_SCALE[k]) ? ERA_SCALE[k] : '',
          label: d.label || k,
          years: d.years || '',
        });
      });
    } catch (e) {}
    return out;
  }

  function _pinRenderBar() {
    var el = document.getElementById('pin-context-bar');
    if (!el) return;
    // Only while a shooting session is running. Brad: "that bar should only show
    // up after you hit the add photos button."
    if (!_pinSession) { el.style.display = 'none'; return; }
    var era = _pinActiveEra();
    var armed = !!_pinOneShot;
    var known = !!era;
    el.style.cssText = 'display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.7rem;'
      + 'padding:0.55rem 0.75rem;border-radius:10px;border:2px solid '
      + (armed ? 'var(--accent)' : (known ? 'rgba(41,128,185,0.55)' : 'var(--border)')) + ';'
      + 'background:' + (armed ? 'rgba(232,64,28,0.10)' : (known ? 'rgba(41,128,185,0.08)' : 'var(--surface2)'));
    el.innerHTML =
      '<span style="font-size:0.68rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-dim);font-weight:700">'
        + (armed ? 'Next photo only' : 'Shooting') + '</span>'
      + '<button onclick="_pinPickContext()" style="flex:1;min-width:150px;text-align:left;padding:0.45rem 0.7rem;border-radius:8px;'
        + 'border:1.5px solid ' + (known ? '#2980b9' : 'var(--border)') + ';background:' + (known ? '#f7f0dc' : 'var(--bg)') + ';'
        + 'color:' + (known ? '#2980b9' : 'var(--text-dim)') + ';font-family:var(--font-head);font-weight:700;font-size:0.9rem;cursor:pointer">'
        + rrEsc(_pinEraLabel(era)) + ' \u25be</button>'
      + (armed
          ? '<button onclick="_pinClearOneShot()" style="padding:0.45rem 0.7rem;border-radius:8px;border:1px solid var(--border);'
            + 'background:var(--surface2);color:var(--text-mid);font-size:0.78rem;cursor:pointer">Back to '
            + rrEsc(_pinEraLabel(_pinHomeEra())) + '</button>'
          : '')
      + '<button onclick="_pinEndSession()" style="padding:0.45rem 0.8rem;border-radius:8px;border:none;'
        + 'background:var(--accent2);color:#1a1a1a;font-family:var(--font-body);font-weight:700;'
        + 'font-size:0.8rem;min-height:38px;cursor:pointer">Done</button>';
  }

  // Ends the shooting session: bar goes away, nothing stays armed.
  window._pinEndSession = function () {
    _pinSession = false;
    _pinOneShot = null;
    _sessionEra = '';
    var el = document.getElementById('pin-context-bar');
    if (el) el.style.display = 'none';
  };

  window._pinClearOneShot = function () { _pinOneShot = null; _pinRenderBar(); };

  // Three dropdowns that narrow each other: maker → scale → line.
  // opts (all optional) — when opts.onPick is given the sheet shows ONE confirm
  // button and hands the era back instead of arming the capture bar. That is
  // how tag mode and the start-of-session prompt reuse this same picker rather
  // than growing a second copy of the maker/scale/line logic.
  window._pinPickContext = function (opts) {
    opts = opts || {};
    var choices = _pinEraChoices();
    if (!choices.length) { showToast('No manufacturers configured yet', 2500, true); return; }
    var cur = opts.current || _pinActiveEra();
    var curDef = choices.filter(function (c) { return c.key === cur; })[0] || null;
    var pick = { maker: curDef ? curDef.maker : '', scale: curDef ? curDef.scale : '', era: cur || '' };

    var ov = document.createElement('div');
    ov.id = 'pin-ctx-sheet';
    ov.style.cssText = 'position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,0.55);display:flex;align-items:flex-end;justify-content:center';
    var card = document.createElement('div');
    card.style.cssText = 'background:var(--surface);border:1px solid var(--border);border-top-left-radius:16px;border-top-right-radius:16px;'
      + 'width:100%;max-width:520px;padding:1rem 1rem 1.2rem;max-height:82vh;max-height:82dvh;overflow-y:auto';
    ov.appendChild(card);
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };

    function uniq(a) { var s2 = {}, o = []; a.forEach(function (v) { if (v && !s2[v]) { s2[v] = 1; o.push(v); } }); return o.sort(); }

    function draw() {
      var makers = uniq(choices.map(function (c) { return c.maker; }));
      if (!pick.maker && makers.indexOf('Lionel') >= 0) pick.maker = 'Lionel';
      var scaleSet = choices.filter(function (c) { return c.maker === pick.maker; });
      var scales = uniq(scaleSet.map(function (c) { return c.scale; }));
      if (scales.indexOf(pick.scale) < 0) pick.scale = scales.length === 1 ? scales[0] : '';
      var lines = scaleSet.filter(function (c) { return !pick.scale || c.scale === pick.scale; });
      if (!lines.some(function (c) { return c.key === pick.era; })) pick.era = lines.length === 1 ? lines[0].key : '';

      function sel(id, label, opts, val, hint) {
        return '<div style="margin-bottom:0.7rem">'
          + '<div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.07em;color:var(--text-dim);font-weight:700;margin-bottom:0.25rem">' + label + '</div>'
          + '<select id="' + id + '" style="width:100%;padding:0.6rem 0.7rem;border-radius:8px;border:1.5px solid var(--border);'
            + 'background:var(--surface2);color:var(--text);font-size:0.95rem;min-height:46px;box-sizing:border-box">'
          + (val ? '' : '<option value="">Choose…</option>')
          + opts.map(function (o) {
              return '<option value="' + rrEsc(o.v) + '"' + (o.v === val ? ' selected' : '') + '>' + rrEsc(o.t) + '</option>';
            }).join('')
          + '</select>'
          + (hint ? '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.2rem">' + hint + '</div>' : '')
          + '</div>';
      }

      card.innerHTML =
        '<div style="font-family:var(--font-head);font-size:1.05rem;font-weight:700;margin-bottom:0.15rem">'
          + rrEsc(opts.title || 'What are you photographing?') + '</div>'
        + '<div style="font-size:0.8rem;color:var(--text-dim);line-height:1.5;margin-bottom:0.8rem">'
          + rrEsc(opts.blurb || 'This gets saved with each photo, so the app knows which catalog to look in.') + '</div>'
        + sel('pin-ctx-maker', 'Manufacturer', makers.map(function (m) { return { v: m, t: m }; }), pick.maker, '')
        + (scales.length > 1 ? sel('pin-ctx-scale', 'Scale', scales.map(function (m) { return { v: m, t: m }; }), pick.scale, '') : '')
        + (lines.length > 1 ? sel('pin-ctx-era', 'Line / period',
              lines.map(function (c) { return { v: c.key, t: c.label + (c.years ? '  (' + c.years + ')' : '') }; }), pick.era, '') : '')
        + '<div style="display:flex;gap:0.5rem;margin-top:0.9rem;flex-wrap:wrap">'
        + (opts.onPick
            ? '<button id="pin-ctx-ok" style="flex:1;min-width:140px;padding:0.7rem;border-radius:9px;border:none;background:var(--accent);color:#fff;font-weight:700;font-size:0.92rem;min-height:48px;cursor:pointer">'
              + rrEsc(opts.okLabel || 'Use this') + '</button>'
            : '<button id="pin-ctx-once" style="flex:1;min-width:140px;padding:0.7rem;border-radius:9px;border:none;background:var(--accent);color:#fff;font-weight:700;font-size:0.92rem;min-height:48px;cursor:pointer">Just this one</button>'
              + '<button id="pin-ctx-keep" style="flex:1;min-width:140px;padding:0.7rem;border-radius:9px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-weight:700;font-size:0.92rem;min-height:48px;cursor:pointer">Keep it here</button>')
        + '</div>'
        + '<button id="pin-ctx-cancel" style="width:100%;margin-top:0.5rem;padding:0.6rem;border-radius:9px;border:none;background:none;color:var(--text-dim);font-size:0.88rem;cursor:pointer">'
          + rrEsc(opts.cancelLabel || 'Cancel') + '</button>';

      var mk = card.querySelector('#pin-ctx-maker');
      if (mk) mk.onchange = function () { pick.maker = this.value; pick.scale = ''; pick.era = ''; draw(); };
      var sc = card.querySelector('#pin-ctx-scale');
      if (sc) sc.onchange = function () { pick.scale = this.value; pick.era = ''; draw(); };
      var er = card.querySelector('#pin-ctx-era');
      if (er) er.onchange = function () { pick.era = this.value; };

      function chosen() {
        if (pick.era) return pick.era;
        var only = lines.length === 1 ? lines[0].key : '';
        return only;
      }
      if (opts.onPick) {
        card.querySelector('#pin-ctx-ok').onclick = function () {
          var e2 = chosen();
          if (!e2) { showToast('Pick the line first', 2200, true); return; }
          ov.remove();
          try { opts.onPick(e2); } catch (eP) { console.warn('[inbox] picker callback failed', eP && eP.message); }
        };
      } else {
        card.querySelector('#pin-ctx-once').onclick = function () {
          var e2 = chosen();
          if (!e2) { showToast('Pick the line first', 2200, true); return; }
          _pinOneShot = e2; ov.remove(); _pinRenderBar();
          showToast('Next photo only: ' + _pinEraLabel(e2), 3000);
        };
        card.querySelector('#pin-ctx-keep').onclick = function () {
          var e2 = chosen();
          if (!e2) { showToast('Pick the line first', 2200, true); return; }
          _pinSetHomeEra(e2); _pinOneShot = null; ov.remove(); _pinRenderBar();
          showToast('Now shooting ' + _pinEraLabel(e2), 3000);
        };
      }
      card.querySelector('#pin-ctx-cancel').onclick = function () {
        ov.remove();
        if (opts.onCancel) { try { opts.onCancel(); } catch (eC) {} }
      };
    }
    draw();
    document.body.appendChild(ov);
  };

  // ══ v0.9.1047 — per-photo metadata ═══════════════════════════════════════
  // Until now the only thing a photo remembered was its filename:
  //   "INBOX <uploadTs> g<groupId> <original name>"
  // Enough to stack a group and nothing else — nowhere to put era, group kind,
  // unit role, what the reader made of it, or whether it has been dealt with.
  // Every planned inbox feature needs those.
  //
  // They live in the Drive file's own appProperties: private to this app, no
  // new Google permission, survives renames, and Drive can filter on them
  // server-side later. Keys are short because Drive caps key+value at 124
  // bytes per property.
  //
  //   rrV    schema version           rrNum   item number read or confirmed
  //   rrEra  era key ('pw','mth_ho')  rrStat  new|stamped|read|confirmed|filed
  //   rrGrp  group id                 rrConf  hi|lo — how sure the read was
  //   rrKind single|aa|ab|aba|tender|set|box
  //   rrRole role in the group ('p','d','b','tender','set','box')
  //
  // ONE era key carries maker, scale and period together — 'mth_ho' is MTH, HO,
  // modern — so there is no way to store a combination that never existed.
  //
  // No migration: reads fall back to the filename, so photos taken before today
  // keep working untouched and simply know less until something writes.
  var _PIN_META_V = '1';

  // v0.9.1076 (Brad: "most of these i have to rescan for them to read
  // anything"). Once the free reader failed on a photo it was marked tried and
  // never looked at again — so every improvement made today was invisible on
  // the photos that most needed it, until he re-scanned each one by hand. Reads
  // now carry the version of the reader that produced them, and the automatic
  // pass retries anything read by an older one. Bump this whenever the reading
  // logic changes; it costs nothing but time, and only on photos that failed.
  var READER_VER = '1082';

  function _pinMetaOf(file) {
    var ap = (file && file.appProperties) || {};
    var out = {
      v:    ap.rrV    || '',
      era:  ap.rrEra  || '',
      grp:  ap.rrGrp  || '',
      kind: ap.rrKind || '',
      role: ap.rrRole || '',
      num:  ap.rrNum  || '',
      stat: ap.rrStat || '',
      conf: ap.rrConf || '',
    };
    if (!out.grp && file && file.name) {
      var m = String(file.name).match(/^INBOX \d+ g(\S+)/);
      if (m) out.grp = m[1];
    }
    if (!out.stat) out.stat = out.num ? 'read' : 'new';
    if (!out.kind) out.kind = 'single';
    return out;
  }

  // Merge a patch into a file's appProperties. Drive merges the keys you send
  // and deletes any whose value is null, so only what changed goes over.
  async function _pinMetaSet(fileId, patch) {
    if (!fileId || !patch) return false;
    var map = { era:'rrEra', grp:'rrGrp', kind:'rrKind', role:'rrRole', num:'rrNum', stat:'rrStat', conf:'rrConf' };
    var props = { rrV: _PIN_META_V };
    Object.keys(patch).forEach(function (k) {
      if (!map[k]) return;
      var val = patch[k];
      props[map[k]] = (val === null || val === undefined || val === '') ? null : String(val).slice(0, 100);
    });
    try {
      await driveRequest('PATCH', '/files/' + fileId + '?fields=id', { appProperties: props });
      return true;
    } catch (e) {
      console.warn('[inbox] could not save photo details', fileId, e && e.message);
      return false;
    }
  }

  // Same patch across several photos, four at a time so a batch of a hundred
  // does not open a hundred simultaneous requests. Returns how many actually
  // succeeded, so the caller can tell the user the truth.
  async function _pinMetaSetMany(fileIds, patch, onProgress) {
    var ids = (fileIds || []).slice(), ok = 0, done = 0;
    while (ids.length) {
      var slice = ids.splice(0, 4);
      var results = await Promise.all(slice.map(function (id) { return _pinMetaSet(id, patch); }));
      results.forEach(function (r) { if (r) ok++; });
      done += slice.length;
      if (onProgress) { try { onProgress(done, ok); } catch (e) {} }
    }
    return ok;
  }

  if (typeof window !== 'undefined') {
    window._pinMetaOf = _pinMetaOf;
    window._pinMetaSet = _pinMetaSet;
    window._pinMetaSetMany = _pinMetaSetMany;
  }

  window._pinRefresh = async function () {
    if (!_ensurePage()) return;
    _status('Loading inbox…');
    try {
      var fid = await _folder();
      var q = encodeURIComponent("'" + fid + "' in parents and mimeType contains 'image/' and trashed=false");
      // v0.9.1058 — THE BUG. Drive returns only the fields you ask for, and
      // appProperties was not among them. Every era, group kind, unit role and
      // status the app has written since v0.9.1047 saved correctly to Drive and
      // was then invisible on the next load: _pinMetaOf read an empty object
      // every time. Tagging 80 photos looked like it did nothing, because as
      // far as the app could see, it had. One missing word.
      var res = await driveRequest('GET', '/files?q=' + q + '&fields=files(id,name,createdTime,appProperties)&orderBy=createdTime desc&pageSize=200');
      var files = (res && res.files) || [];
      // Group by the g<id> tag; untagged files are their own group.
      var map = {}, order = [];
      files.forEach(function (f) {
        // v0.9.1047: metadata first, filename as the fallback — so photos from
        // before today group exactly as they always did.
        f._meta = _pinMetaOf(f);
        var key = f._meta.grp ? 'g' + f._meta.grp : 'f' + f.id;
        if (!map[key]) { map[key] = { key: key, files: [], kind: f._meta.kind, era: f._meta.era }; order.push(key); }
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
    // v0.9.1051: draw what passes the filters, but keep counting the whole inbox.
    var _vis = _pinVisibleGroups();
    var total = 0;
    _groups.forEach(function (g) { total += g.files.length; });
    grid.innerHTML = _vis.map(function (g) {
      var isSel = !!_sel[g.key];
      // v0.9.1050: a stack says WHAT it is, not just how many photos.
      var _gk = (g.files[0] && g.files[0]._meta && g.files[0]._meta.kind) || 'single';
      var _gkTxt = (_gk && _gk !== 'single') ? _pinKindLabel(_gk) : (g.files.length + ' photos · 1 item');
      var chip = g.files.length > 1 ? '<div style="position:absolute;top:6px;right:6px;background:rgba(0,0,0,0.66);color:#fff;font-size:0.62rem;font-weight:700;padding:1px 7px;border-radius:9px">' + rrEsc(_gkTxt) + (_gk !== 'single' ? ' · ' + g.files.length : '') + '</div>' : '';
      var when = '';
      try { when = new Date(g.files[0].createdTime).toLocaleDateString(); } catch (e) {}
      // v0.9.886: AI suggestion (from Identify all) shows on the tile bar
      var sug = _ids()[_pinReadFid(g)];
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
      // v0.9.1058 (Brad: "somehow we need to update the picture to show what it
      // is"). A tag you cannot see is a tag you cannot trust — after tagging 80
      // photos there was no way to tell whether it had worked.
      // v0.9.1060: the era badge sat at top-right, exactly where the group chip
      // ("Set · 7") already lives — they would have stacked on top of each other
      // the moment a grouped photo was also tagged. It goes in the bottom strip
      // instead, which already carries the number and the date and has room.
      var _m0 = (g.files[0] && g.files[0]._meta) || {};
      if (_m0.era) {
        when = '<span style="color:#7ec3ef;font-weight:700">' + rrEsc(_pinEraLabel(_m0.era)) + '</span> · ' + when;
      }
      var _crop = _selectMode ? ''
        : '<div onclick="event.stopPropagation();_pinTileCrop(\'' + g.key + '\')" title="Crop / Rotate" style="position:absolute;right:6px;bottom:26px;width:24px;height:24px;border-radius:7px;background:rgba(0,0,0,0.55);color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.8rem;cursor:pointer">✂</div>';
      // v0.9.1057: grouping had no undo. Photos could be put together and never
      // taken apart, so one wrong tick was permanent. Only on stacks, only out
      // of select mode.
      var _ungroup = (_selectMode || g.files.length < 2) ? ''
        : '<div onclick="event.stopPropagation();_pinConfirmUngroup(\'' + g.key + '\')" title="Split this group apart" style="position:absolute;left:6px;bottom:26px;width:24px;height:24px;border-radius:7px;background:rgba(0,0,0,0.55);color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.9rem;cursor:pointer">⊟</div>';
      return '<div class="pin-tile" data-key="' + g.key + '" onclick="' + _tileClick + '(\'' + g.key + '\')" style="position:relative;border-radius:10px;overflow:hidden;cursor:pointer;background:var(--surface2,#26262e);aspect-ratio:1;border:3px solid ' + (isSel ? '#2980b9' : 'transparent') + '">' +
        '<img loading="lazy" data-fid="' + g.files[0].id + '" style="width:100%;height:100%;object-fit:cover;object-position:center;display:block" alt="">' +
        chip +
        _circle +
        _crop +
        _ungroup +
        '<div style="position:absolute;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);color:#ddd;font-size:0.6rem;padding:0.1rem 0.35rem">' + when + '</div>' +
        '</div>';
    }).join('');
    empty.style.display = _groups.length ? 'none' : 'block';
    if (_groups.length && !_vis.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;padding:1.5rem 0;text-align:center;color:var(--text-dim);font-size:0.88rem">'
        + 'No photos match that filter. <button onclick="_pinClearFilters()" style="background:none;border:none;color:var(--accent);text-decoration:underline;cursor:pointer;font-size:0.88rem">Show all</button></div>';
    }
    try { _pinRenderFilters(); } catch (eF) {}
    var cnt = document.getElementById('pin-count');
    // v0.9.1051 (Brad counted 93, the label said 99): the grid draws one tile per
    // GROUP and the count summed FILES. Both were true and neither matched what
    // he could count, so say both.
    if (cnt) {
      var _items = _groups.length;
      var _shown = _vis.length;
      cnt.textContent = !total ? ''
        : (_pinFilterActive()
            ? (_shown + ' of ' + _items + ' item' + (_items > 1 ? 's' : '') + ' shown')
            : (_items === total
                ? (total + ' photo' + (total > 1 ? 's' : '') + ' waiting')
                : (_items + ' item' + (_items > 1 ? 's' : '') + ' \u00b7 ' + total + ' photos waiting')));
    }
    grid.querySelectorAll('img[data-fid]').forEach(function (img) {
      loadDriveThumb(img.getAttribute('data-fid'), img, img.parentElement, null, 'hi');
    });
    _selInfo();
    try { _pinRenderBar(); } catch (eB) {}   // v0.9.1048; v0.9.1057 the bar decides its own visibility
    _navBadge(total);
    _updateIdAllBtn();
    try { _updateRecropBtn(); } catch (eRC) {}
    try { _updateAuditBtn(); } catch (eAB) {}
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
    var n = _groups.filter(function (g) { return !ids[_pinReadFid(g)]; }).length;
    if (n > 0 && !_selectMode) {
      // v0.9.1075 (Brad: "i am running the free re reader and my tokens are
      // going down every time on the other button"). They are not — nothing on
      // the free path touches a token, and there is a test that fails if that
      // ever changes. This number is how many photos are STILL UNREAD, and it
      // falls because the free reader is succeeding on them. "Read 44 (44
      // tokens)" reads like a balance, so watching it drop after a free run
      // looks exactly like being charged for it. Say which number it is.
      b.textContent = '🔍 Read the ' + n + ' still unread \u00b7 costs ' + n + ' token' + (n === 1 ? '' : 's');
      b.title = n + ' photo' + (n === 1 ? '' : 's') + ' the free reader could not place. This is what it would COST, not what you have left.';
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
  // v0.9.1057: acts on what is VISIBLE, not on everything. That is what makes
  // the filter chips do the heavy lifting — narrow to "Not touched yet", Select
  // all, Apply, and 43 photos are tagged in four taps. Selecting hidden photos
  // would have been an invisible edit, which is the worst kind.
  window._pinSelectAll = function () {
    var vis = _pinVisibleGroups();
    var allSel = vis.length && vis.every(function (g) { return _sel[g.key]; });
    _sel = {};
    if (!allSel) vis.forEach(function (g) { _sel[g.key] = true; });
    _render();
  };

  // Both named buttons run the SAME selection mechanic — circles on the tiles,
  // Select all, a running count, Finished — and differ only in what Apply does.
  // One thing to learn, two jobs.
  window._pinStartMode = function (purpose) {
    if (_selPurpose === purpose) return window._pinFinishMode();
    // switching between the two modes is not "leaving", so no warning here
    _selPurpose = purpose;
    _selectMode = true;
    _sel = {};
    if (purpose === 'tag' && !_tagEra) _tagEra = _sessionEra || '';
    _render();
  };

  function _pinCloseMode() {
    _selPurpose = '';
    _selectMode = false;
    _sel = {};
    _render();
  }

  // v0.9.1060 (Brad: "the finished button needs to throw up a warning if nothing
  // has changed as in i didn't hit apply"). Apply CLEARS the ticks, so ticks
  // still sitting there when you press Finished means exactly one thing: that
  // selection was never applied to anything. No extra state to get out of step
  // — the ticks are the evidence.
  window._pinFinishMode = async function () {
    var n = 0;
    _selGroups().forEach(function (g) { n += g.files.length; });
    if (n > 0) {
      var what = _selPurpose === 'tag'
        ? 'tagged with a manufacturer, era and scale'
        : 'put into a group';
      var ok = await _pinConfirm(
        '<b>' + n + ' photo' + (n > 1 ? 's are' : ' is') + ' still selected and '
        + (n > 1 ? 'have' : 'has') + ' not been ' + what + '.</b><br><br>'
        + 'Pressing Apply is what saves the change \u2014 Finished only closes this mode. '
        + 'Leave now and the selection is dropped.',
        'Leave without saving');
      if (!ok) return;                 // stay put, ticks intact
    }
    _pinCloseMode();
  };

  // Kept so nothing that still calls the old name breaks.
  window._pinToggleSelectMode = function () {
    if (_selectMode) return window._pinFinishMode();
    return window._pinStartMode('group');
  };
  window._pinCloseModeNow = _pinCloseMode;   // used by tests and by Apply

  // ── Tag mode: one era onto every ticked photo ───────────────────────────
  function _pinRenderTagBar() {
    var el = document.getElementById('pin-tagbar');
    if (!el) return;
    if (_selPurpose !== 'tag') {
      el.style.display = 'none';
      var ap0 = document.getElementById('pin-apply-btn');
      if (ap0) ap0.style.display = 'none';
      return;
    }
    var n = 0, changing = 0;
    _selGroups().forEach(function (g) {
      g.files.forEach(function (f) {
        n++;
        var m = _pinMetaOf(f);
        if (m && m.era && m.era !== _tagEra) changing++;
      });
    });
    el.style.cssText = 'display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.7rem;'
      + 'padding:0.55rem 0.75rem;border-radius:10px;border:2px solid rgba(41,128,185,0.55);'
      + 'background:rgba(41,128,185,0.08)';
    var ready = !!_tagEra && n > 0;
    // v0.9.1060 (Brad: "the apply button needs to be to the left of the finished
    // button. its lost where its at."). Apply lives in the toolbar beside
    // Finished now — the two decisions that end this mode sit together.
    var apb = document.getElementById('pin-apply-btn');
    if (apb) {
      apb.style.display = '';
      apb.disabled = !ready;
      apb.textContent = 'Apply' + (n ? ' to ' + n : '');
      apb.style.background = ready ? 'var(--accent)' : 'rgba(139,142,148,0.25)';
      apb.style.color = ready ? '#fff' : 'var(--text-dim)';
      apb.style.cursor = ready ? 'pointer' : 'default';
    }
    el.innerHTML =
      '<span style="font-size:0.68rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-dim);font-weight:700">Tag as</span>'
      + '<button onclick="_pinPickTagEra()" style="flex:1;min-width:150px;text-align:left;padding:0.45rem 0.7rem;border-radius:8px;'
        + 'border:1.5px solid ' + (_tagEra ? '#2980b9' : 'var(--border)') + ';background:' + (_tagEra ? '#f7f0dc' : 'var(--bg)') + ';'
        + 'color:' + (_tagEra ? '#2980b9' : 'var(--text-dim)') + ';font-family:var(--font-head);font-weight:700;font-size:0.9rem;cursor:pointer">'
        + rrEsc(_pinEraLabel(_tagEra)) + ' \u25be</button>'
      + (changing
          ? '<span style="font-size:0.74rem;color:#ffb454;font-weight:600;width:100%">'
            + changing + ' of those already ' + (changing === 1 ? 'has' : 'have') + ' a different era and will be changed</span>'
          : '');
  }

  window._pinPickTagEra = function () {
    window._pinPickContext({
      title: 'Tag these photos as\u2026',
      blurb: 'This gets saved with each ticked photo, so the app knows which catalog to look in.',
      okLabel: 'Use this',
      onPick: function (era) { _tagEra = era; _pinRenderTagBar(); },
    });
  };

  // Applies to every FILE in every ticked group — an engine and its tender are
  // one item and must not end up with different makers.
  window._pinApplyTags = async function () {
    if (_busy) return;
    if (!_tagEra) { showToast('Pick a manufacturer and line first', 2600, true); return; }
    var ids = [];
    _selGroups().forEach(function (g) { g.files.forEach(function (f) { ids.push(f.id); }); });
    if (!ids.length) { showToast('Tick some photos first', 2400, true); return; }
    _busy = true;
    var label = _pinEraLabel(_tagEra);
    _status('Tagging ' + ids.length + ' photo' + (ids.length > 1 ? 's' : '') + '\u2026');
    var ok = 0;
    try {
      ok = await _pinMetaSetMany(ids, { era: _tagEra, stat: 'stamped' }, function (done) {
        _status('Tagging ' + done + ' of ' + ids.length + '\u2026');
      });
    } catch (e) {
      console.warn('[inbox] tagging failed', e && e.message);
    }
    _busy = false;
    _status('');
    // Say what actually happened. A partial write reported as a win is the bug
    // this app has been burned by before.
    if (ok === ids.length) showToast('Tagged ' + ok + ' photo' + (ok > 1 ? 's' : '') + ' as ' + label, 3200);
    else showToast('Tagged ' + ok + ' of ' + ids.length + ' \u2014 the rest did not save, try again', 4200, true);
    _sel = {};                 // clear the ticks, STAY in tag mode for the next batch
    await window._pinRefresh();
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
      var vis = _pinVisibleGroups();
      var allSel = vis.length && vis.every(function (g) { return _sel[g.key]; });
      sa.textContent = allSel ? 'Deselect all' : 'Select all';
    }
    // v0.9.1057: which actions show depends on WHY you are selecting.
    var isGroup = _selPurpose === 'group', isTag = _selPurpose === 'tag';
    if (ab) ab.style.display = (isGroup && gs.length > 1) ? '' : 'none';   // combine needs 2+ items
    var gb = document.getElementById('pin-groupas-btn');
    if (gb) gb.style.display = (isGroup && n > 1) ? '' : 'none';           // grouping needs 2+ photos
    // Discard and Read stay available in both modes — you are already looking
    // at photos with ticks on them, and binning the junk is the same gesture.
    if (db) db.style.display = n ? '' : 'none';
    if (ib) ib.style.display = n ? '' : 'none';
    var fb = document.getElementById('pin-finish-btn');
    if (fb) fb.style.display = _selectMode ? '' : 'none';
    [['pin-group-btn', isGroup], ['pin-tag-btn', isTag]].forEach(function (p) {
      var b = document.getElementById(p[0]);
      if (!b) return;
      b.style.background = p[1] ? 'rgba(41,128,185,0.18)' : 'rgba(139,142,148,0.12)';
      b.style.borderColor = p[1] ? '#2980b9' : '#8b8e94';
      b.style.display = (_selectMode && !p[1]) ? 'none' : '';
    });
    try { _pinRenderTagBar(); } catch (eT) {}
  }

  // ── Import ───────────────────────────────────────────────────
  window._pinPickFiles = function () {
    var inp = document.getElementById('pin-file-input');
    if (inp) inp.click();
  };

  // ── Batch Add Photos: one door in, device-aware source picker ──
  // Desktop → From Your Drive (computer files) / From Google Photos.
  // Mobile  → Take with Phone (camera) / From Google Photos.
  // v0.9.1057: Add photos now STARTS a shooting session — set maker/scale/line
  // once, then every photo in the session inherits it. Skip is a first-class
  // option: an unstamped photo is exactly as useful as every photo taken before
  // today, so this must never be a wall.
  window._pinAddSource = function () {
    if (!_pinSession) {
      return window._pinPickContext({
        title: 'What are you about to photograph?',
        blurb: 'Set it once and every photo in this session is stamped with it. You can switch mid-session, and Done ends it.',
        okLabel: 'Start shooting',
        cancelLabel: 'Skip \u2014 just add photos',
        onPick: function (era) {
          _pinSession = true;
          _pinSetHomeEra(era);
          _pinOneShot = null;
          _pinRenderBar();
          showToast('Now shooting ' + _pinEraLabel(era), 2600);
          _pinAddSourceSheet();
        },
        onCancel: function () { _pinAddSourceSheet(); },
      });
    }
    return _pinAddSourceSheet();
  };

  function _pinAddSourceSheet() {
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
      // v0.9.1048: whatever the bar is showing goes onto the photo. A one-shot
      // is spent by the FIRST photo of the batch and then springs back, so a
      // single odd item in a long run cannot leak into the next forty.
      var _era = _pinActiveEra();
      var _spentOneShot = false;
      for (var i = 0; i < files.length; i++) {
        _status('Uploading ' + (i + 1) + ' of ' + files.length + '…');
        var f = files[i];
        var safe = (f.name || 'photo.jpg').replace(/[^\w.\- ]+/g, '').slice(-60);
        // Desktop drops: one group per file (phone capture will reuse the
        // same tag to group several shots of one item).
        var name = 'INBOX ' + ts + ' g' + (ts + i) + ' ' + safe;
        var up = await driveUploadFile(f, name, fid);
        var _thisEra = (_pinOneShot && !_spentOneShot) ? _pinOneShot : _pinHomeEra();
        if (i === 0 && _pinOneShot) _spentOneShot = true;
        if (_thisEra && up && up.id) {
          // A stamp that fails to save must not fail the upload — the photo is
          // safely in the inbox either way, it just knows less.
          await _pinMetaSet(up.id, { era: _thisEra, stat: 'stamped' });
        }
      }
      if (_pinOneShot) { _pinOneShot = null; _pinRenderBar(); }
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
  // v0.9.1066 (Brad: "we still are not using the manufacturer and era when
  // id'ing them ... all my pictures are lionel postwar and i got atlas and
  // prewar matches"). He was right, and the era work so far had missed the one
  // path that actually produces what he SEES. v0.9.1063 handed the era stamp to
  // the OCR-text step; this function — the one that turns a number into the
  // Maker / Item # / Description panel — never received it. When the reader
  // gives no manufacturer of its own (a free OCR read never does), the last
  // line here was `return bucket[0]`: whichever catalog happened to load first.
  // A postwar-stamped photo of a 6817 flatcar therefore resolved to Lionel
  // PRE-WAR 58, "Lamp Post, 7 3/8 high".
  function _pinBestMaster(num, aiMfr, prefer) {
    var bucket = null;
    // v0.9.971 (Brad): _mbAllGet = the ONE shared bucket lookup (loaded eras +
    // the full-catalog index), so the inbox sees MTH/Atlas/etc. like Research does.
    try {
      bucket = (typeof window._mbAllGet === 'function')
        ? window._mbAllGet(String(num).trim())
        : ((window.state && state.masterByItem && state.masterByItem.get) ? state.masterByItem.get(String(num).trim()) : null);
    } catch (e) {}
    if (bucket && bucket.length) {
      // What the reader claims to have seen still wins — it looked at the item.
      if (aiMfr) {
        for (var i = 0; i < bucket.length; i++) {
          var mk = bucket[i].manufacturer || ((typeof ERAS !== 'undefined' && ERAS[bucket[i]._era]) ? ERAS[bucket[i]._era].manufacturer : '');
          if (_pinMfrAgree(aiMfr, mk)) return bucket[i];
        }
      }
      // Then what the PHOTO says it is. An exact era beats a maker match, which
      // beats load order — and load order is what this used to be.
      if (prefer && (prefer.era || prefer.manufacturer)) {
        var exact = null, byMaker = null;
        for (var j = 0; j < bucket.length; j++) {
          var row = bucket[j];
          if (prefer.era && row._era === prefer.era) { exact = row; break; }
          if (!byMaker && prefer.manufacturer) {
            var mk2 = row.manufacturer || ((typeof ERAS !== 'undefined' && ERAS[row._era]) ? ERAS[row._era].manufacturer : '');
            if (_pinMfrAgree(prefer.manufacturer, mk2)) byMaker = row;
          }
        }
        if (exact) return exact;
        if (byMaker) return byMaker;
      }
      return bucket[0];
    }
    try { return (typeof findMaster === 'function') ? findMaster(num, null, prefer || null) : null; } catch (e) { return null; }
  }
  // The era stamped on the photo currently open in the review card.
  function _rvPrefer() {
    try { return (_rvGroups && _rvGroups.length) ? _pinPreferOf(_rvGroups[0]) : null; }
    catch (e) { return null; }
  }

  function _pinLookup(num, aiMfr, prefer) {
    num = String(num || '').trim();
    var out = { num: num, master: null, ownedPd: null, maker: '', era: '', desc: '', mfrMismatch: '' };
    if (!num) return out;
    // Default to the era stamped on the photo being reviewed, so every caller
    // gets it without having to remember to pass it.
    if (prefer === undefined) prefer = _rvPrefer();
    out.master = _pinBestMaster(num, aiMfr, prefer);
    if (out.master) {
      var m = out.master;
      var eraDef = (typeof ERAS !== 'undefined' && ERAS[m._era]) ? ERAS[m._era] : null;
      out.maker = m.manufacturer || (eraDef ? eraDef.manufacturer : '') || '';
      out.era = eraDef ? eraDef.label : '';
      out.desc = m.description || [m.roadName, m.itemType].filter(Boolean).join(' ') || '';
      if (aiMfr && !_pinMfrAgree(aiMfr, out.maker)) out.mfrMismatch = String(aiMfr);
    }
    // v0.9.1045 (Brad's 213): this used to match on the number alone, so a
    // prewar 213 in the collection was reported as "you already own" a postwar
    // 213. rrFindOwnedCopy compares era and manufacturer as well and says
    // whether the copy you own is actually the same item.
    var _own = (typeof rrFindOwnedCopy === 'function') ? rrFindOwnedCopy(num, out.master) : null;
    if (_own) {
      out.ownedPd = _own.pd;
      out.ownedAgrees = _own.agrees;      // false = same number, different item
      out.ownedLabel = _own.label;
    } else {
      var pds = Object.values((window.state || {}).personalData || {});
      out.ownedPd = pds.find(function (p) { return p && p.owned && String(p.itemNum) === num; }) || null;
      out.ownedAgrees = true;
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
      var _fi = _pinFailInfo();
      html = '<div style="font-size:0.9rem;color:var(--text-dim)">No number picked up automatically — type it below if you can see it, or use Research.</div>'
        + (_fi ? _pinWhyHtml(_fi.raw, _fi.dbg) : '');
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
    if (lk.ownedPd && lk.ownedAgrees === false) {
      // Same number, different item — say so plainly instead of claiming a duplicate.
      html += '<div style="margin-top:0.45rem;font-size:0.8rem;color:#d4a843;font-weight:700;line-height:1.5">You own a '
        + rrEsc(lk.ownedLabel) + ' \u2014 same number, different item. This one is new to your collection.</div>';
    } else if (lk.ownedPd) {
      html += '<div style="margin-top:0.45rem;font-size:0.8rem;color:#2ecc71;font-weight:700">\u2713 You already own one — this will be added as a separate copy.</div>';
    }
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
      // v0.9.1018: COTT links get the item's #anchor so the relay pulls THIS
      // item's photo off the multi-item page (was: page's first image).
      var _vrRef = lk.master.refLink;
      try { if (_vrRef && typeof window.cottAnchorUrl === 'function') _vrRef = window.cottAnchorUrl(_vrRef, lk.master.itemNum); } catch (eA) {}
      vr = await aiVerifyPhoto(blob, _vrRef);
    } catch (e) {
      console.warn('[Inbox] verify failed:', e && e.message);
      vr = { ok: false, reason: 'error' };
    }
    if (vr && (vr.ok || vr.reason === 'noref')) _vfCache[key] = vr;   // don't cache transient errors
    // the card may have re-rendered while we were away — find the live node
    var live = document.getElementById('pin-rv-verify') || el;
    _pinVerifyShow(live, vr);
  }
  // Swap which button looks like the thing to press. Nothing is disabled — Brad
  // may know perfectly well that the catalog photo is of a different variation —
  // but the default should not be the action the app has just argued against.
  function _pinDemoteAdd(demote) {
    try {
      var add = document.getElementById('pin-rv-add');
      var tok = document.getElementById('pin-rv-idtoken');
      if (add) {
        add.className = demote ? '' : 'btn-primary';
        add.style.background = demote ? 'rgba(139,142,148,0.12)' : '';
        add.style.color = demote ? 'var(--text-mid)' : '';
        add.style.border = demote ? '1.5px solid #8b8e94' : 'none';
        add.title = demote ? 'The catalog photo does not match — check the number first' : '';
      }
      if (tok) {
        tok.style.background = demote ? 'var(--accent)' : 'rgba(212,168,67,0.14)';
        tok.style.color = demote ? '#fff' : 'var(--accent2,#d4a843)';
        tok.style.borderColor = demote ? 'var(--accent)' : 'var(--accent2)';
      }
    } catch (e) {}
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
      _pinDemoteAdd(false);
      el.innerHTML = '<div style="font-size:0.84rem;color:#2ecc71;font-weight:700">✓ Your photo matches the catalog listing' +
        (vr.refItem ? ' <span style="font-weight:400;color:var(--text-dim)">(' + esc(vr.refItem) + ')</span>' : '') + '</div>';
    } else if (vr.match === 'no') {
      el.innerHTML =
        '<div style="font-size:0.84rem;color:#f05008;font-weight:700;line-height:1.45">✗ Your photo does NOT match the catalog listing' +
        (vr.differences && vr.differences.toLowerCase() !== 'none' ? ' — ' + esc(vr.differences) : '') + '</div>' +
        (vr.refItem ? '<div style="font-size:0.76rem;color:var(--text-dim);margin-top:0.15rem">Catalog photo shows: ' + esc(vr.refItem) + '</div>' : '') +
        '<button onclick="_pinVerifyReident()" style="margin-top:0.4rem;padding:0.45rem 0.7rem;border-radius:8px;border:none;background:#f05008;color:#fff;font-family:var(--font-body);font-weight:700;font-size:0.78rem;cursor:pointer">Re-identify with this clue</button>';
      // The app has just said, in red, that this is the wrong item. Leaving Add
      // as the orange default invites the tap that files it anyway.
      _pinDemoteAdd(true);
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
    delete ids[_pinReadFid(g)];
    _idsSave(ids);
    var ov = document.getElementById('pin-review-ov'); if (ov) ov.remove();
    await _pinIdentifyRun([g], ids);
    delete _vfNote[g.key];
    window._pinReview(g.key);
  };

  // v0.9.969 (Brad): show the daily token count on the review card. The relay
  // returns "remaining" after each paid read; we cache the last one (per day)
  // and display it so the count stays visible without an extra request.
  function _tokGet() {
    try { var o = JSON.parse(localStorage.getItem('rr_tokens_left') || 'null');
      return (o && o.d === new Date().toISOString().slice(0, 10) && typeof o.n === 'number') ? o.n : null; }
    catch (e) { return null; }
  }
  function _tokSave(n) {
    try { if (typeof n === 'number') localStorage.setItem('rr_tokens_left', JSON.stringify({ d: new Date().toISOString().slice(0, 10), n: n })); } catch (e) {}
  }
  function _tokLine() {
    var n = _tokGet();
    return '<div id="pin-rv-tokline" style="text-align:center;font-size:0.8rem;color:var(--text-dim);margin-top:0.6rem">' +
      (n !== null
        ? '<span style="color:var(--accent2,#d4a843);font-weight:700;font-size:0.95rem">' + n + '</span> token' + (n === 1 ? '' : 's') + ' left today'
        : 'Token count shows after your next read') +
      '</div>';
  }

  // ══ v0.9.1057 — move through the inbox without closing the card ══════════
  // Brad: "need a next item arrow to the right and a previous item arrow to the
  // left of this pop up. that way i can crop an image, hit next and move
  // through the list quickly."
  //
  // Steps through the VISIBLE groups, so it follows whatever filter is on —
  // filter to "Not touched yet" and next/prev walks only those. Stops at both
  // ends rather than wrapping: on a hundred wall photos, silently looping back
  // to the start would have you re-doing work without noticing.
  function _pinRvOrder() { return _pinVisibleGroups(); }

  function _pinRvIndex() {
    if (!_rvKey) return -1;
    var ord = _pinRvOrder();
    for (var i = 0; i < ord.length; i++) if (ord[i].key === _rvKey) return i;
    return -1;
  }

  function _pinRvNavHtml(dir) {
    var i = _pinRvIndex();
    if (i < 0) return '';                       // multi-select card: no sequence
    var ord = _pinRvOrder();
    var can = dir === 'prev' ? i > 0 : i < ord.length - 1;
    var glyph = dir === 'prev' ? '\u2039' : '\u203a';
    var title = dir === 'prev' ? 'Previous photo' : 'Next photo';
    return '<button onclick="_pinReviewStep(' + (dir === 'prev' ? -1 : 1) + ')"'
      + (can ? '' : ' disabled')
      + ' title="' + title + '" aria-label="' + title + '"'
      + ' style="width:40px;height:40px;min-width:40px;border-radius:9px;border:1.5px solid '
      + (can ? 'var(--border)' : 'transparent') + ';background:'
      + (can ? 'var(--surface2)' : 'transparent') + ';color:'
      + (can ? 'var(--text)' : 'rgba(139,142,148,0.35)')
      + ';font-size:1.5rem;line-height:1;cursor:' + (can ? 'pointer' : 'default')
      + ';padding:0;flex-shrink:0">' + glyph + '</button>';
  }

  function _pinRvPosHtml() {
    var i = _pinRvIndex();
    if (i < 0) return '';
    return '<span style="font-size:0.74rem;color:var(--text-dim);font-family:var(--font-body);white-space:nowrap">'
      + (i + 1) + ' of ' + _pinRvOrder().length + '</span>';
  }

  window._pinReviewStep = function (delta) {
    var i = _pinRvIndex();
    if (i < 0) return;
    var ord = _pinRvOrder();
    var j = i + delta;
    if (j < 0 || j >= ord.length) return;
    window._pinReview(ord[j].key);
  };

  window._pinCloseReview = function () {
    var ov = document.getElementById('pin-review-ov');
    if (ov) ov.remove();
  };

  // Left/right arrow keys do the same thing on a desktop keyboard. Ignored
  // while a text box has focus, so typing a number is never hijacked.
  document.addEventListener('keydown', function (e) {
    if (!document.getElementById('pin-review-ov')) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    var t = e.target;
    if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || '')) return;
    if (document.getElementById('pin-ctx-sheet') || window._rrCropOpen) return;
    e.preventDefault();
    window._pinReviewStep(e.key === 'ArrowLeft' ? -1 : 1);
  });

  window._pinReview = function (key) {
    _rvKey = key || '';          // v0.9.1057: which group the card is showing
    _rvGroups = key ? _groups.filter(function (g) { return g.key === key; }) : _selGroups();
    if (!_rvGroups.length) { showToast('Select photos first', 2500, true); return; }
    var n = 0; _rvGroups.forEach(function (g) { n += g.files.length; });
    // v0.9.1068 (Brad's 6817 flatcar). The free reader guessed "58", the catalog
    // double-check said in red that the photo does NOT match a rotary snow plow
    // — and the app still put 58 in the number box, resolved it into a full
    // catalog panel, and left "Add to my Collection" as the orange default. One
    // tap files an item he does not own. Three separate pieces of the screen
    // were lending confidence to a guess the app had already contradicted.
    //
    // A number in an input field does not look like a guess. So only a
    // CONFIRMED read pre-fills it now; a guess is offered as a chip to tap, and
    // nothing is entered, looked up or ready to save until the user says so.
    var sug = '', sugGuess = '';
    _rvAiMfr = '';
    try {
      var s0 = _ids()[_rvGroups[0].files[0].id];
      if (s0 && s0.num) { if (s0.guess) sugGuess = String(s0.num); else sug = String(s0.num); }
      if (s0 && s0.mfr) _rvAiMfr = String(s0.mfr);
    } catch (eS) {}
    // v0.9.966 (Brad): the read found a description but no structured number
    // (e.g. "No. 260 … illuminated bumper" with an empty number field). Recover
    // the catalog number from that text — master-validated — so the box fills in.
    try {
      if (!sug && !sugGuess && s0) {
        var _recTxt = [s0.mfr, s0.road, s0.desc].filter(Boolean).join(' ');
        var _recNum = _numberFromText(_recTxt);
        if (_recNum && _recNum.num) sugGuess = String(_recNum.num);
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
    // v0.9.969 (Brad): shared button area — number box, then two columns: LEFT
    // the 1×3 "what to do" stack (Add / Sales List / Discard), RIGHT the 2×2
    // "not sure" grid (re-scan / Research Number / Google Search / token read)
    // with the daily token count beneath it. Same block on desktop and phone;
    // the two columns sit side by side when there's room and stack when narrow.
    var _lbl = 'font-size:0.74rem;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.03em;margin:0 0 0.5rem';
    var _gBtn = 'padding:0.62rem 0.5rem;border-radius:9px;font-family:var(--font-body);font-weight:700;font-size:0.82rem;cursor:pointer;line-height:1.2;';
    // Offered, not entered. Tapping it fills the box and runs the lookup, which
    // is the same thing pre-filling did — except the user chose it.
    var _guessChip = sugGuess
      ? '<div style="margin-bottom:0.55rem;display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">'
        + '<span style="font-size:0.76rem;color:var(--text-dim)">Best guess from the photo:</span>'
        + '<button onclick="_pinPickNum(\'' + rrEsc(sugGuess).replace(/'/g, '') + '\')" '
        + 'style="padding:0.4rem 0.8rem;border-radius:999px;border:1.5px solid #ffb454;background:rgba(255,180,84,0.12);'
        + 'color:#ffb454;font-family:var(--font-mono);font-weight:700;font-size:0.86rem;min-height:38px;cursor:pointer">'
        + rrEsc(sugGuess) + ' \u2014 use this</button>'
        + '</div>'
      : '';
    var _btnArea =
      _guessChip +
      '<input id="pin-rv-num" list="pin-rv-list" type="text" value="' + sug.replace(/"/g, '&quot;') + '" placeholder="Item number — e.g. 2343 or 6464-1" autocomplete="off" spellcheck="false" oninput="_pinReviewLookup(this.value)" style="width:100%;box-sizing:border-box;padding:0.6rem 0.75rem;border:1px solid var(--border);border-radius:8px;background:var(--surface2);color:var(--text);font-family:var(--font-mono);font-size:1rem;margin-bottom:0.55rem">' +
      '<datalist id="pin-rv-list">' + opts + '</datalist>' +
      _pinAltChips() +
      '<div style="display:flex;gap:1rem;align-items:flex-start;flex-wrap:wrap;margin-top:0.35rem">' +
        '<div style="flex:1 1 240px;min-width:0">' +
          '<div style="' + _lbl + '">What do you want to do with it?</div>' +
          '<button id="pin-rv-add" onclick="_pinFileToCollection()" class="btn-primary" style="width:100%;padding:0.72rem;border-radius:10px;border:none;font-family:var(--font-body);font-weight:700;font-size:0.93rem;cursor:pointer;margin-bottom:0.5rem">Add to my Collection</button>' +
          '<button id="pin-rv-sell" onclick="_pinSendForSale()" style="width:100%;padding:0.68rem;border-radius:10px;border:1.5px solid #d4a843;background:rgba(212,168,67,0.12);color:#d4a843;font-family:var(--font-body);font-weight:700;font-size:0.9rem;cursor:pointer;margin-bottom:0.5rem">Add to Sales List</button>' +
          '<button onclick="_pinReviewDiscard()" style="width:100%;padding:0.68rem;border-radius:10px;border:1.5px solid #8b8e94;background:rgba(139,142,148,0.12);color:#f05008;font-family:var(--font-body);font-weight:700;font-size:0.9rem;cursor:pointer">Discard Photo' + (n > 1 ? 's' : '') + '</button>' +
        '</div>' +
        '<div style="flex:1 1 240px;min-width:0">' +
          '<div style="' + _lbl + '">Not sure what it is?</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem">' +
            '<button id="pin-rv-rescan" onclick="_pinRescan()" title="Forget this read and scan the photo again at higher detail" style="' + _gBtn + 'border:1.5px solid #f05008;background:rgba(240,80,8,0.10);color:#f05008">This is wrong — re-scan</button>' +
            '<button onclick="_pinReviewResearch()" style="' + _gBtn + 'border:1.5px solid #8b8e94;background:rgba(139,142,148,0.12);color:#2980b9">Research Number</button>' +
            '<button id="pin-rv-lens" onclick="_pinReviewLens()" style="' + _gBtn + 'border:1.5px solid #8b8e94;background:rgba(139,142,148,0.12);color:#2980b9">Google Search</button>' +
            '<button id="pin-rv-idtoken" onclick="_pinReviewIdentify()" title="Identify this item straight from its photo — uses one token" style="' + _gBtn + 'border:1.5px solid var(--accent2,#d4a843);background:rgba(212,168,67,0.14);color:var(--accent2,#d4a843)">Read this photo (1 token)</button>' +
          '</div>' +
          _tokLine() +
        '</div>' +
      '</div>';

    var _controlsHtml =
      (_pinLensGroups ? _pinLensBannerHtml() : '') +   // v0.9.962: waiting-for-answer reminder after Research by Photo
      _pinAiLine() +
      '<div id="pin-rv-info" style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:0.85rem 0.95rem;margin-bottom:0.7rem;display:flex;flex-direction:column;gap:0.4rem"></div>' +
      _btnArea;

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
      _btnArea;

    var ov = document.createElement('div');
    ov.id = 'pin-review-ov';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem';
    ov.innerHTML =
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:1.1rem;max-width:' + (_wide ? '820px' : '460px') + ';width:100%;max-height:94vh;overflow-y:auto">' +
        '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.6rem">' +
          _pinRvNavHtml('prev') +
          '<div style="flex:1;min-width:0;font-family:var(--font-head);font-weight:700;font-size:1rem;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + n + ' photo' + (n > 1 ? 's' : '') + ' · one item</div>' +
          _pinRvPosHtml() +
          _pinRvNavHtml('next') +
          '<button onclick="_pinCloseReview()" style="background:none;border:none;color:var(--text-dim);font-size:1.35rem;line-height:1;cursor:pointer;padding:0.1rem 0.3rem;margin-left:0.25rem">✕</button>' +
        '</div>' +
        (_wide ? _wideBody : _stripHtml + _controlsHtml) +
      '</div>';
    document.body.appendChild(ov);
    ov.querySelectorAll('img[data-rvfid]').forEach(function (img) {
      loadDriveThumb(img.getAttribute('data-rvfid'), img, img.parentElement, null, 'hi');
    });
    try { _pinDemoteAdd(false); } catch (eD) {}
    var _rvMainImg = document.getElementById('pin-rv-main');
    if (_rvMainImg && window._pinRvLoadFull) window._pinRvLoadFull(_rvMainImg, _rvMainImg.getAttribute('data-rvbig'));
    // Only look up what is actually in the box. A guess left as a chip must not
    // silently produce a Maker / Item # / Description panel — that panel is what
    // made "58" read as a finding rather than a hunch.
    _pinReviewLookup(sug);
  };

  // "From the photo" line — everything the AI read, so a wrong read (e.g. a
  // background box's number) is obvious at a glance. (Brad, 2026-07-16)
  // The stored reasoning for a photo that came back empty.
  function _pinFailInfo() {
    try {
      var fid = _rvGroups && _rvGroups.length ? _pinReadFid(_rvGroups[0]) : '';
      var f = _freeTried()[fid];
      return (f && typeof f === 'object') ? f : null;
    } catch (e) { return null; }
  }

  // Shared "why" block, used by both a read and a failed read.
  function _pinWhyHtml(raw, dbg) {
    if (!raw && !dbg) return '';
    return '<details style="margin-top:0.3rem"><summary style="font-size:0.7rem;color:var(--text-dim);cursor:pointer">Where did this come from?</summary>'
      + '<div style="font-size:0.7rem;color:var(--text-dim);font-family:var(--font-mono);margin-top:0.25rem;line-height:1.4;word-break:break-word">'
      + (raw ? 'The reader saw: \u201c' + rrEsc(raw) + '\u201d' : 'The reader returned no text at all.')
      + (dbg
          ? '<div style="margin-top:0.35rem">'
            + 'Photo is stamped: <b>' + rrEsc(dbg.era ? _pinEraLabel(dbg.era) : 'nothing \u2014 no era filter applied') + '</b><br>'
            + 'Numbers considered: ' + rrEsc((dbg.cand || []).join(', ') || 'none')
              + ((dbg.shortCand && dbg.shortCand.length)
                  ? ' (plus short: ' + rrEsc(dbg.shortCand.join(', ')) + ')' : '') + '<br>'
            + 'In that catalog: ' + rrEsc((dbg.inEra || []).join(', ') || 'none') + '<br>'
            + 'In another catalog: ' + rrEsc((dbg.offEra || []).join(', ') || 'none')
            + (dbg.joined ? '<br>Recovered by joining split digits: ' + rrEsc(dbg.joined) : '')
            + ((dbg.joinTried && dbg.joinTried.length)
                ? '<br>Reassembled and tried: ' + rrEsc(dbg.joinTried.slice(0, 10).join(', ')) : '')
            + (dbg.viaDesc ? '<br>Matched on the words: ' + rrEsc(dbg.viaDesc) : '')
            + (dbg.corroborated ? '<br>Number and lettering agree: ' + rrEsc(dbg.corroborated) : '')
            + (dbg.oneOff ? '<br>One digit corrected: ' + rrEsc(dbg.oneOff) : '')
            + ((dbg.shortDropped && dbg.shortDropped.length)
                ? '<br>Too short to trust on their own: ' + rrEsc(dbg.shortDropped.join(', ')) : '')
            + (dbg.viaMaker ? '<br>Chosen because it is stamped next to the maker\'s name: ' + rrEsc(dbg.viaMaker) : '')
            + (dbg.evidence !== undefined
                ? '<br>Readable characters recovered: ' + dbg.evidence
                  + (dbg.evidence < 18 ? ' \u2014 too few to be sure of anything' : '')
                : '')
            + '</div>'
          : '')
      + '</div></details>';
  }

  function _pinAiLine() {
    var s = {};
    try { s = _ids()[_rvGroups[0].files[0].id] || {}; } catch (e) {}
    var bits = [s.mfr, s.road, s.desc, s.year ? '(' + s.year + ')' : ''].filter(Boolean).join(' ');
    if (!bits && !s.num) return '';
    var esc = function (t) { return String(t).replace(/</g, '&lt;'); };
    // v0.9.898: hedged reads show as an explicit BEST GUESS (orange), never
    // dressed up like a confident read.
    // v0.9.1077: when the identification came from the WORDS on the car rather
    // than a number, say so plainly and name what matched — the whole value of
    // this route is that the user can confirm or kill it at a glance.
    if (s.viaDesc && s.descOf) {
      return '<div style="margin-bottom:0.6rem;padding:0.6rem 0.75rem;border-left:3px solid #b98cff;background:rgba(185,140,255,0.08);border-radius:0 8px 8px 0">'
        + '<div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.03em;color:#b98cff;margin-bottom:0.25rem">Matched by what is written on it</div>'
        + '<div style="font-size:0.98rem;color:var(--text);line-height:1.4"><span style="font-weight:600">' + rrEsc(s.descOf) + '</span>'
        + (s.num ? ' \u2014 No. ' + rrEsc(s.num) : '') + '</div>'
        + '<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.25rem">Read on the car: '
        + rrEsc((s.descWords || []).join(', ')) + ' \u00b7 no number was legible, so check this one against your item</div>'
        + _pinWhyHtml(s.raw, s.dbg)
        + '</div>';
    }
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
      (s.raw
        ? '<details style="margin-top:0.3rem"><summary style="font-size:0.7rem;color:var(--text-dim);cursor:pointer">Where did this come from?</summary>'
          + '<div style="font-size:0.7rem;color:var(--text-dim);font-family:var(--font-mono);margin-top:0.25rem;line-height:1.4;word-break:break-word">'
          + 'The reader saw: \u201c' + rrEsc(s.raw) + '\u201d'
          + (s.dbg
              ? '<div style="margin-top:0.35rem">'
                + 'Photo is stamped: <b>' + rrEsc(s.dbg.era ? _pinEraLabel(s.dbg.era) : 'nothing \u2014 no era filter applied') + '</b><br>'
                + 'Numbers considered: ' + rrEsc((s.dbg.cand || []).join(', ') || 'none') + '<br>'
                + 'In that catalog: ' + rrEsc((s.dbg.inEra || []).join(', ') || 'none') + '<br>'
                + 'In another catalog: ' + rrEsc((s.dbg.offEra || []).join(', ') || 'none')
                + '</div>'
              : '')
          + '</div></details>'
        : '') +
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
      // v0.9.1083: the same era hint goes into the shared text question, so a
      // Research or Google search is asked about the right decade too.
      var _lh = _pinAiHints(gs[0]);
      var q = (typeof window.rrIdentifyQuery === 'function')
        ? window.rrIdentifyQuery({ eraLabel: _lh.eraLabel, eraYears: _lh.eraYears })
        : 'Identify this model railroad item. Provide Manufacturer; Manufacturer SKU or catalog number; Year; Scale; Description on labeled lines.';
      // v0.9.959 (Brad): Google retired /searchbyimage (it 404s now) and moved
      // reverse-image search to Google Lens. uploadbyurl runs the real search on
      // the staged photo. Lens takes no text hint, so `q` is unused here.
      var url = 'https://lens.google.com/uploadbyurl?url=' + encodeURIComponent(staged.url);
      if (tab) { try { tab.location = url; } catch (e) { tab = null; } }
      if (!tab) window.open(url, '_blank');
      if (btn) { btn.disabled = false; btn.textContent = 'Google Search'; }
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
      if (btn) { btn.disabled = false; btn.textContent = 'Google Search'; }
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
        road: trim(meta.roadName, prev.road), year: trim(meta.year, prev.year),
        // v0.9.968 (Brad): keep scale + item-type so the Add wizard can pre-fill
        // them (e.g. "O" gauge, "Accessory" for a building). Were being dropped.
        gauge: trim(meta.gauge, prev.gauge), subType: trim(meta.subType, prev.subType)
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
        var _h0 = _pinAiHints(_rvGroups && _rvGroups[0]);
        var ai = (typeof aiIdentifyImage2 === 'function') ? await aiIdentifyImage2([f], _h0) : await aiIdentifyImage(f, _h0);
        if (!ai || !ai.ok) {
          var why = ai && ai.reason;
          if (why === 'quota') showToast('No tokens left today — type the number, or try tomorrow', 4500, true);
          else if (why === 'noconsent') { /* consent dialog already handled */ }
          else showToast('Could not read that screenshot — type the number instead', 3800, true);
          return;
        }
        if (typeof ai.remaining === 'number') _tokSave(ai.remaining);   // v0.9.969: keep the token count fresh
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

  // ══ v0.9.1052 — crop before a paid read ══════════════════════════════════
  // Brad photographs a wall, so most frames hold two items — one at the top,
  // one below. The reader answers about whatever it sees, and it took the top
  // one. Cropping does not make the read cheaper; it stops the SECOND read you
  // would otherwise need after the first answered about the wrong train. Over
  // a hundred photos that is a hundred reads instead of two hundred.
  //
  // It is not literally unskippable — a photo that is already tight should not
  // need ceremony. But the skip is a labelled, deliberate choice ("Use whole
  // photo"), not an accidental one, and the crop box opens on the rectangle you
  // used last so most photos need a nudge rather than a fresh drag.
  var _PIN_SKIP_CROP_KEY = 'rr_skip_read_crop';
  function _pinSkipReadCrop() { try { return localStorage.getItem(_PIN_SKIP_CROP_KEY) === '1'; } catch (e) { return false; } }

  function _pinCropForRead(blob, cb) {
    if (!blob || typeof window._openCropper !== 'function' || _pinSkipReadCrop()) { cb(blob); return; }
    var url;
    try { url = URL.createObjectURL(blob); } catch (e) { cb(blob); return; }
    var done = false;
    function finish(out) {
      if (done) return; done = true;
      try { URL.revokeObjectURL(url); } catch (e) {}
      cb(out || blob);
    }
    window._openCropper(url,
      function (cropped) { finish(cropped); },
      function () { finish(blob); },
      {
        title: 'Crop to one item',
        hint: 'The reader answers about whatever is in frame',
        applyLabel: 'Read this',
        cancelLabel: 'Use whole photo',
      });
  }

  // v0.9.967 (Brad): identify THIS item straight from its own photo with one
  // token — no Google/Lens round-trip. The free reader already ran on drop, so
  // this goes straight to the paid read for the leftovers it couldn't place.
  window._pinReviewIdentify = async function () {
    var gs = _rvGroups;
    if (!gs || !gs.length) { showToast('Open a photo first', 2500, true); return; }
    if (!_qcToken()) { showToast('Please sign in first', 3000, true); return; }
    if (typeof aiIdentifyImage2 !== 'function' && typeof aiIdentifyImage !== 'function') { showToast('Identify service not loaded — refresh and try again', 3000, true); return; }
    var btn = document.getElementById('pin-rv-idtoken');
    // v0.9.1052: don't say "Reading…" while the crop screen is still open —
    // nothing is being read and nothing has been spent yet.
    if (btn) { btn.disabled = true; btn.textContent = _pinSkipReadCrop() ? 'Reading…' : 'Crop first…'; }
    try {
      var g = gs[0];
      var fl = g.files.slice(0, 4), blobs = [];
      for (var i = 0; i < fl.length; i++) {
        try { blobs.push(await _pinBytes(fl[i].id)); } catch (eB) {}
      }
      if (!blobs.length) { showToast('Could not load the photo — try again', 3000, true); return; }
      // v0.9.1052: crop the PRIMARY frame before spending anything. The other
      // angles go as they are — several views genuinely help the read, and
      // cropping four photos one at a time would cost more than it saves.
      blobs[0] = await new Promise(function (res) { _pinCropForRead(blobs[0], res); });
      if (btn) { btn.disabled = true; btn.textContent = 'Reading…'; }
      var _h1 = _pinAiHints(_rvGroups && _rvGroups[0]);
      var ai = (typeof aiIdentifyImage2 === 'function') ? await aiIdentifyImage2(blobs, _h1) : await aiIdentifyImage(blobs[0], {});
      if (!ai || !ai.ok) {
        var why = ai && ai.reason;
        if (why === 'quota') showToast('No tokens left today — try tomorrow, or type the number', 4500, true);
        else if (why === 'noconsent') { /* consent dialog already handled */ }
        else showToast('Could not read that photo — try Google Search, or type the number', 4200, true);
        return;
      }
      if (typeof ai.remaining === 'number') _tokSave(ai.remaining);   // v0.9.969: keep the token count fresh
      var meta = (typeof extractIdentifyMetadata === 'function') ? extractIdentifyMetadata(ai.text) : {};
      if (!_pinApplyMeta(meta, gs)) { showToast('Could not pull an item number from the photo — try Google Search', 4200, true); return; }
      showToast(meta._hedge
        ? 'Best guess from the photo — double-check the number (1 token used)'
        : 'Read from the photo — check it over and add it (1 token used)', 4000);
    } catch (e) {
      console.warn('[Inbox] review identify:', e);
      showToast('Could not read the photo — try again', 3000, true);
    } finally {
      var b2 = document.getElementById('pin-rv-idtoken');
      if (b2) { b2.disabled = false; b2.textContent = 'Read this photo (1 token)'; }
    }
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
    // v0.9.970 (Brad): remember this item's group(s) so Close on the Research
    // Result card brings you back to THIS item's card, not the inbox grid.
    var _keys = (_rvGroups || []).map(function (g) { return g.key; });
    var ov = document.getElementById('pin-review-ov'); if (ov) ov.remove();
    if (typeof window._researchLookupTyped === 'function') {
      window._researchLookupTyped(num, { onClose: function () {
        if (!_keys.length) return;
        _sel = {}; _keys.forEach(function (k) { _sel[k] = true; });
        try { window._pinReview(_keys.length === 1 ? _keys[0] : null); } catch (e) {}
      } });
    } else showToast('Research is still loading — try again in a moment', 3000, true);
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
        _pinAddNow(num, { manufacturer: _aiS.mfr || '', description: _aiS.desc || '', roadName: _aiS.road || '', year: _aiS.year || '', gauge: _aiS.gauge || '', subType: _aiS.subType || '', _prefer: _pinPreferOf(gs[0]) }, _addPhotoId, { alsoListForSale: mode === 'forsale' });
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
          // v0.9.1062 (Brad): "when you hit add an item and then hit cancel, it
          // kicks you back to the dashboard and not back to the photo inbox."
          // openWizard infers where to return from window._rrLastPage, which is
          // whatever page was last shown — and the review card is a MODAL over
          // the inbox, so whether that inference lands on 'photo-inbox' depends
          // on how the user got here. Inference is the wrong tool when the
          // answer is known: an add started from the inbox returns to the
          // inbox, stated outright. (For Sale keeps its own destination.)
          else wizard.data._returnPage = 'photo-inbox';
          // v0.9.907 (Brad, item [1a]): stash the inbox photo's Drive id so the
          // variation step can preview it (loaded via loadDriveThumb).
          if (photoDriveId) wizard.data._addPhotoDriveId = photoDriveId;
          var m = _pinBestMaster(num, (aiMeta && aiMeta.manufacturer) || '', (aiMeta && aiMeta._prefer) || null);
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
      // v0.9.1065: page-segmentation 6 ("one uniform block") nearly tripled the
      // free reader's hits in the audit on Brad's own 73 photos — 35 confirmed
      // against 13 for the shipping default. A model train photo is scattered
      // lettering on a body, not a page of prose, and the default mode was
      // trying to read it as a document.
      await _tessWorker.setParameters({
        tessedit_char_whitelist: '0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ ',
        tessedit_pageseg_mode: '6',
      });
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
    ctx.drawImage(bmp, 0, 0, w, h);
    if (bmp.close) bmp.close();
    // v0.9.1065: a full histogram stretch, not a fixed contrast bump. A silver
    // passenger car occupies a narrow band of greys and a fixed multiplier
    // barely moves it; stretching whatever range the photo actually uses out to
    // full black-to-white is what makes those numbers legible.
    try { _stretchCanvas(c); } catch (e) {}
    return c;
  }

  // Grayscale, then map the darkest pixel to black and the lightest to white.
  function _stretchCanvas(c) {
    var ctx = c.getContext('2d');
    var img = ctx.getImageData(0, 0, c.width, c.height), d = img.data;
    var lo = 255, hi = 0, i, g;
    for (i = 0; i < d.length; i += 4) {
      g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
      d[i] = d[i + 1] = d[i + 2] = g;
      if (g < lo) lo = g;
      if (g > hi) hi = g;
    }
    var span = Math.max(1, hi - lo);
    for (i = 0; i < d.length; i += 4) {
      var v = (d[i] - lo) * 255 / span;
      d[i] = d[i + 1] = d[i + 2] = v < 0 ? 0 : (v > 255 ? 255 : v);
    }
    ctx.putImageData(img, 0, 0);
  }

  // Pull the best catalog-number candidate out of OCR text and confirm it
  // against the master. Busy box photos are full of noise text (marketing
  // copy, UPC barcodes, prices, years), so we: drop UPC/barcode-length runs,
  // PREFER a number the master actually knows, and prefer dashed catalog-style
  // numbers (6-17259, 6464-475) over bare digit blobs.
  // v0.9.1063 — two changes, both from Brad's inbox.
  //
  // (a) TWO-DIGIT NUMBERS. The token filter required 3 characters, to stop junk
  //     like a "26" wheel arrangement becoming an item number. It also threw
  //     away every genuine two-digit Lionel number: his Great Northern 58 could
  //     never be read, no matter how sharp the photo. Short tokens are now kept
  //     but must be CONFIRMED by the master list — 58 is a real catalog number
  //     and survives; a stray 26 is not and does not.
  //
  // (b) ERA. `prefer` is the photo's own era stamp, handed to findMaster, which
  //     already knows how to weight a catalog tab (+8) and a maker (+4). His
  //     2410 Santa Fe car, stamped Lionel Postwar O, was misread as "210" and
  //     then matched against a Lionel PRE-WAR standard-gauge switch pair. The
  //     app had the era written on the photo and was not using it.
  function _numberFromText(text, prefer) {
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
    // v0.9.1065 — BUILD DATES. The audit read "5-54" off five different cars
    // and the catalog confirmed every one, because numbers like that collide
    // with real entries. They are not item numbers: Lionel stamps the build
    // date on the side of postwar rolling stock ("BLT 5-54" = May 1954), and it
    // is frequently the crispest printed thing in the photo. A real catalog
    // number never looks like this — dashed Lionel numbers are 6464-475 or
    // 2333-20, three or four digits before the dash, never one or two.
    // v0.9.1069 — widened. "10-2210" slipped through a rule that only looked
    // for one or two digits AFTER the dash. Real dashed Lionel numbers are
    // 6464-475 or 2333-20: three or four digits BEFORE it, always.
    // ══ v0.9.1076 — the strongest signal on the model itself ═══════════════
    // Brad's Lehigh Valley hopper carries FOUR numbers: road number 25000 in the
    // largest lettering, CAPY 100000, LD LMT 128300, and — in the smallest print
    // on the car — "BUILT 1-48 LIONEL 6176". Only the last is the catalog
    // number, and the car tells you which by putting it directly after the
    // maker's name. That is a manufacturing convention, not a guess: Lionel
    // stamps its catalog number next to LIONEL on essentially every postwar
    // piece. It is also exactly the cue a collector's eye uses.
    var namedByMaker = {};
    (function () {
      // v0.9.1077d — Brad's Lionel 50 gang car came through as "IONEL DE 50":
      // the maker's own name is long, curved and often the first thing OCR
      // mangles. Requiring it spelled perfectly threw away the strongest signal
      // we have precisely when the reading was rough. L1ONEL, IONEL, LIONE and
      // LIONEL all count; the pattern is still specific enough that nothing
      // else on a train matches it.
      var MAKER = '(?:[LI1][I1l]?[O0]NEL|LI[O0]NE)';
      // The gap allows a little junk, not just spaces: Brad's gang car reads
      // "IONEL DE 50" — OCR invents letters between the name and the number as
      // readily as it mangles the name itself. Ten non-digit characters is wide
      // enough for that and far too narrow to reach the next real number.
      var reAfter = new RegExp(MAKER + '(?:[ ]?LINES)?[^0-9]{0,10}(\\d{2,6}(?:-\\d{1,3})?)', 'g');
      var reBefore = new RegExp('(\\d{2,6}(?:-\\d{1,3})?)[^0-9]{0,10}' + MAKER, 'g');
      var mm;
      while ((mm = reAfter.exec(UP))) { namedByMaker[mm[1]] = 1; }
      while ((mm = reBefore.exec(UP))) { namedByMaker[mm[1]] = 1; }
    })();

    // ══ ROAD NUMBERS AND WEIGHTS ARE TOO LONG TO BE CATALOG NUMBERS ════════
    // Postwar and prewar Lionel numbers top out at four digits — 6464 is about
    // as long as they get — so on a photo stamped as one of those eras, a bare
    // five- or six-digit number is never the answer. 25000 (a road number that
    // also happens to exist in the catalog as a Mathematics Set), 100000 and
    // 128300 all fail here. MPC, MTH and the rest genuinely use longer numbers
    // and are deliberately left alone.
    var MAX_PLAIN_DIGITS = { prewar: 4, pw: 4 };
    var digitCap = (prefer && prefer.era && MAX_PLAIN_DIGITS[prefer.era]) || 0;

    var isBuildDate = function (c) { return /^\d{1,2}-\d+$/.test(c); };
    // CAPACITY AND LOAD LIMIT. The audit confirmed "40200" on five different
    // cars, plus 48200 and 25000. Those are the CAPY / LD LMT stamps printed on
    // the side of every freight car — genuinely on the item, genuinely in some
    // catalog somewhere, and never what the user is looking at. Same shape as
    // the build-date problem, different costume.
    var reCap = /(?:CAPY|CAP'?Y|LD\s*LMT|LDLMT|LT\s*WT|LTWT|WT\s*LMT|CAPACITY)[^0-9]{0,10}(\d{3,7})/g;
    var capStamp = {};
    while ((m = reCap.exec(UP))) { capStamp[m[1]] = 1; }
    var toks = (UP.match(/\d[\dA-Z]*(?:-[\dA-Z]+)*/g) || [])
      .map(function (c) { return c.replace(/^-+|-+$/g, ''); })
      .filter(function (c) {
        if (!/\d/.test(c) || c.length < 2 || c.length > 10) return false;
        if (banned[c]) return false;                            // copyright year, not a catalog number
        if (isBuildDate(c)) return false;                       // "BLT 5-54" — a date, not an item
        if (capStamp[c.replace(/\D/g, '')]) return false;        // "CAPY 40200" — a weight, not an item
        // v0.9.1071: the weight block on a freight car reads CAPY 103000,
        // LD LMT 129300, LT WT 40200 — and OCR garbles those labels often
        // enough that keyword matching alone misses them. No Lionel catalog
        // number has six or more digits, so on a Lionel-stamped photo they are
        // never the answer regardless of what the label came out as.
        // The era-aware ceiling replaces the blunt six-digit rule.
        if (digitCap && c.indexOf('-') < 0 && c.replace(/\D/g, '').length > digitCap) return false;
        if (!digitCap && prefer && prefer.era && /^\d{6,}$/.test(c)) return false;
        var digits = c.replace(/\D/g, '');
        var alnum = c.replace(/[^0-9A-Za-z]/g, '');
        if (digits.length < alnum.length * 0.6) return false;   // mostly letters = junk (e.g. "4LIONEL", "MADE")
        if (digits.length >= 8 && c.indexOf('-') < 0) return false;   // UPC / barcode run
        return true;
      });
    var seen = {}, uniq = [];
    toks.forEach(function (c) { if (!seen[c]) { seen[c] = 1; uniq.push(c); } });
    // v0.9.1069 — THE ERA IS NOW A FILTER, not a tiebreak. Brad's idea, taken
    // one step on. Until now a token counted as confirmed if it existed in ANY
    // catalog, which is how a capacity stamp on a Lionel Postwar car "confirmed"
    // against something in another maker's list. If the photo says which catalog
    // it belongs to, a number that is not in THAT catalog is not a confirmation.
    //
    // The real prize is not the rejection — it is what happens next. A rejected
    // token falls through and the NEXT candidate in the same text gets its turn,
    // which is often the number actually printed on the item. It turns a wrong
    // answer into a right one rather than into a blank.
    var fmAny = (typeof findMaster === 'function')
      ? function (c) { return findMaster(c, null, prefer || null); }
      : null;
    var inEra = function (row) {
      if (!prefer || !prefer.era) return true;      // nothing stamped — old behaviour
      return !!(row && row._era === prefer.era);
    };
    var fm = fmAny ? function (c) { var r = fmAny(c); return (r && inEra(r)) ? r : null; } : null;
    // v0.9.1065 — short tokens are a LEAD, never a fact. Catalog backing is
    // too weak a filter for them on its own: the audit turned stray markings
    // into 13, 20, 25, 40, 50, 53 and 77, and Lionel has real items at every
    // one of those numbers, so each was reported as confirmed. They are kept
    // (Brad's Great Northern 58 is genuine) but only when nothing longer was
    // found, and they are always returned as a best guess for a human to
    // accept — never stated as certain.
    var shortOnes = uniq.filter(function (c) {
      return c.replace(/\D/g, '').length < 3 && fm && fm(c);
    });
    // v0.9.1078: a short number is weak because it could be anything — but not
    // when the maker stamped its own name beside it. "LIONEL 50" on Brad's gang
    // car is as strong a statement as a car can make, and it was being demoted
    // to a hedge purely for being two digits. Promote those back.
    uniq = uniq.filter(function (c) {
      if (c.replace(/\D/g, '').length >= 3) return true;
      return !!namedByMaker[c];
    });
    shortOnes = shortOnes.filter(function (c) { return !namedByMaker[c]; });
    var dashRank = function (a, b) {
      return (b.indexOf('-') >= 0 ? 1 : 0) - (a.indexOf('-') >= 0 ? 1 : 0) || b.length - a.length;
    };
    // v0.9.1070 — say WHY. Brad re-read a Santa Fe 2412 and it still came back
    // as an MPC set number, and I could not tell from the outside whether the
    // era filter had run, whether the photo was stamped at all, or whether the
    // right number had even been a candidate. Guessing at that from screenshots
    // is what this whole audit was supposed to replace. Every read now carries
    // its own reasoning.
    // ══ v0.9.1076c — HOW MUCH DID IT ACTUALLY READ? ════════════════════════
    // Brad's 2408 Santa Fe car produced the entire text "-600 2" and the app
    // reported No. 600, NW2 Switcher, as a finding. His M&StL boxcar produced
    // "- 7 - 5 - 1001- - 4 - 0" and got 1001, a steam locomotive. Both numbers
    // are real postwar items, so both confirmed. But a catalog hit inside four
    // characters of noise is a coincidence, not a reading — with a few thousand
    // numbers in the catalog, almost any stray digits land on one.
    //
    // So a match needs some corroboration around it. Below this much recovered
    // text the answer is still offered, as a guess for a human to accept, but it
    // is never stated as fact.
    var evidence = UP.replace(/[^0-9A-Z]/g, '').length;
    var THIN = 18;

    var dbg = {
      era: (prefer && prefer.era) || '',
      evidence: evidence,
      cand: uniq.slice(0, 8),
      shortCand: shortOnes.slice(0, 5),
      inEra: [],
      offEra: [],
      joined: '',
      viaMaker: '',
    };
    uniq.slice(0, 8).forEach(function (c) {
      var any = fmAny ? fmAny(c) : null;
      if (!any) return;
      (inEra(any) ? dbg.inEra : dbg.offEra).push(c + (any._era ? ':' + any._era : ''));
    });
    // v0.9.1071 — SPLIT NUMBERS. Brad: "this is a hard number to read because
    // the number is 3562-1 and its split on the car." He was describing the
    // mechanism exactly, and the raw text proved it. On that ATSF gondola the
    // reader saw:
    //
    //     ... CAPY 100000  3 3 5 6 2 1  LD LMT 128000 ...
    //
    // The number is stamped across separate raised panels, so it arrives as six
    // SINGLE DIGITS. Every one of them is discarded before any catalog lookup —
    // a lone "3" is not a token worth considering — so 3562-1 never had a
    // chance, however sharp the photo. No amount of image processing fixes this;
    // the characters were read correctly and then thrown away.
    //
    // So: take runs of digits separated only by spaces, close them up, and try
    // every contiguous window of catalog-plausible length, exact and then
    // dash-repaired. "3 3 5 6 2 1" closes to 335621, whose window 35621 repairs
    // to 3562-1, which the catalog knows. Only ever accepted on an exact hit in
    // the stamped catalog, so this recovers numbers that were already there and
    // cannot invent one.
    var joined = [];
    (function () {
      var runs = UP.match(/\d(?:[ \t]?\d){3,11}/g) || [];
      runs.forEach(function (run) {
        var d = run.replace(/\D/g, '');
        if (!d || d.length < 4) return;
        if (capStamp[d] || banned[d]) return;         // a weight or a copyright year
        for (var len = Math.min(8, d.length); len >= 4; len--) {
          for (var st = 0; st + len <= d.length; st++) {
            var w = d.substr(st, len);
            // v0.9.1076b: the join was bypassing every guard the direct path
            // has. On Brad's Lehigh Valley hopper it reassembled the ROAD
            // NUMBER 25000 out of "LEY 25000" and won on length, after the
            // ordinary filters had correctly thrown that very number away.
            // A recovery route must not be a way around the rules.
            if (capStamp[w] || banned[w]) continue;
            if (joined.indexOf(w) < 0) joined.push(w);
          }
        }
      });
    })();

    // v0.9.1072b — ORDER MATTERS, and I had it wrong. On Brad's ATSF gondola the
    // reader saw "... 35 621 ..." and the direct match ran first, so "621" — the
    // tail half of 3562-1, sitting on its own panel — was accepted as a catalog
    // number before the joining step was ever reached. A fragment that happens
    // to exist in the catalog beat the complete number it was part of.
    //
    // Both are computed now and the LONGER confirmed number wins. That is the
    // right tie-break on its own terms: 3562-1 is more specific than 621, and a
    // catalog hit on more digits is far less likely to be a coincidence.
    var direct = null;
    var matched = uniq.filter(function (c) { return fm && (fm(c) || fm(c.replace(/^\d-/, ''))); });
    if (matched.length) {
      // A number the maker put its own name beside outranks everything, before
      // any length or specificity tie-break gets a say. Length was deciding this
      // and length is meaningless between two unrelated numbers — it picked the
      // road number 25000 over the catalog number 6176 purely for being longer.
      var named = matched.filter(function (c) { return namedByMaker[c]; });
      if (named.length) { named.sort(dashRank); direct = named[0]; dbg.viaMaker = direct; }
      else { matched.sort(dashRank); direct = matched[0]; }
    }

    // ══ v0.9.1079 — one misread digit ══════════════════════════════════════
    // Brad, on his Boston & Maine boxcar: "i see where it read 5 instead of 6.
    // so it says 5464475 instead of 6464475. we may need to look at a number
    // being off like 5 and 6 or 5 and 8." Exactly right, and the fix is narrow
    // enough to be safe: try changing ONE character to something it is commonly
    // confused with, and accept only an exact catalog hit. A single substitution
    // on a seven-digit run is about fifteen candidates — cheap — while allowing
    // two would let almost anything become almost anything.
    var _OCR_CONFUSE = {
      '0': '68', '1': '7', '2': '7', '3': '8', '4': '9',
      '5': '68', '6': '58', '7': '1', '8': '360', '9': '4',
    };
    function _oneOffVariants(d) {
      var out = [];
      for (var i = 0; i < d.length; i++) {
        var alt = _OCR_CONFUSE[d[i]];
        if (!alt) continue;
        for (var j = 0; j < alt.length; j++) {
          out.push(d.slice(0, i) + alt[j] + d.slice(i + 1));
        }
      }
      return out;
    }
    // Exact, then dash-repaired, for one candidate string.
    function _tryNumber(d) {
      if (!fm) return null;
      if ((!digitCap || d.length <= digitCap) && fm(d)) return d;
      for (var cut = 3; cut <= 4; cut++) {
        if (d.length <= cut) continue;
        var cand = d.slice(0, cut) + '-' + d.slice(cut);
        if (fm(cand)) return cand;
      }
      return null;
    }

    var jHit = null;
    // Whole runs first, and a one-character repair of them, BEFORE any window.
    // Order matters: "5464475" cut into windows yields "6447", a real postwar
    // caboose, and it was winning over the boxcar the car actually is. A
    // complete number with one digit corrected beats a fragment of it.
    if (fm) {
      var wholeRuns = [];
      var _addRun = function (d) {
        if (d && d.length >= 4 && d.length <= 12 && !capStamp[d] && !banned[d]
            && wholeRuns.indexOf(d) < 0) wholeRuns.push(d);
      };
      // An UNBROKEN digit token first — that is the printed number when the
      // reader managed to keep it together, and it is what "5464475" is. Only
      // then the space-joined runs, which on this car swallow the neighbouring
      // "0 20" and produce a ten-digit string matching nothing.
      (UP.match(/\d+/g) || []).forEach(_addRun);
      (UP.match(/\d(?:[ \t]?\d){3,11}/g) || []).forEach(function (run) {
        _addRun(run.replace(/\D/g, ''));
      });
      wholeRuns.some(function (d) { jHit = _tryNumber(d); return !!jHit; });
      if (!jHit) {
        wholeRuns.some(function (d) {
          return _oneOffVariants(d).some(function (v) {
            var hit = _tryNumber(v);
            if (hit) { jHit = hit; dbg.oneOff = d + ' \u2192 ' + hit; return true; }
            return false;
          });
        });
      }
    }
    if (fm && !jHit && joined.length) {
      joined.some(function (d) {
        // A BARE reassembled number must obey the same length ceiling as any
        // other — that is what stopped "LEY 25000" becoming an item number.
        // A DASH-REPAIRED one may exceed it, because 3562-1 and 6464-475 are
        // exactly the legitimate Lionel forms that run longer.
        if ((!digitCap || d.length <= digitCap) && fm(d)) { jHit = d; return true; }
        for (var cut = 3; cut <= 4; cut++) {
          if (d.length <= cut) continue;
          var cand = d.slice(0, cut) + '-' + d.slice(cut);
          if (fm(cand)) { jHit = cand; return true; }
        }
        return false;
      });
    }
    dbg.joinTried = joined.slice(0, 10);
    if (jHit) dbg.joined = jHit;

    var digitsOf = function (x) { return String(x || '').replace(/\D/g, '').length; };
    if (direct || jHit) {
      // Order of authority: what the maker stamped next to its own name, then
      // the more specific of a joined reconstruction and a direct hit. Length
      // only ever breaks a tie between those last two — it is meaningless
      // between two unrelated numbers, which is how a road number won earlier.
      var win;
      if (dbg.viaMaker && direct) win = direct;
      else if (jHit && digitsOf(jHit) > digitsOf(direct)) win = jHit;
      else win = direct || jHit;
      // A number the maker named is trustworthy however little else was read —
      // "LIONEL 6176" is corroboration in itself.
      var solid = (evidence >= THIN) || !!dbg.viaMaker;
      return { num: win, matched: solid, thin: !solid, dbg: dbg };
    }

    // Nothing in the stamped catalog. Before giving up, look in every catalog —
    // but a hit there is a LEAD, not a confirmation, because the whole reason we
    // are here is that the photo says it belongs somewhere else. This also
    // protects against the stamped era's data simply not being loaded.
    var loose = fmAny
      ? uniq.filter(function (c) { return fmAny(c) || fmAny(c.replace(/^\d-/, '')); })
      : [];

    // 1b) v0.9.1065 — DASH REPAIR. The audit produced "6464475" twice and the
    // catalog rejected both, because the real number is 6464-475: OCR drops a
    // dash far more often than it invents a digit. Try putting one back at each
    // plausible split and see if the catalog then recognises it. Only an exact
    // catalog hit is accepted, so this can add answers but never invent them.
    if (fm) {
      var repaired = null;
      uniq.some(function (c) {
        if (c.indexOf('-') >= 0) return false;
        var d = c.replace(/\D/g, '');
        if (d.length < 5 || d.length > 8) return false;
        for (var cut = 3; cut <= 4 && !repaired; cut++) {
          if (d.length <= cut) continue;
          var cand = d.slice(0, cut) + '-' + d.slice(cut);
          if (fm(cand)) repaired = cand;
        }
        return !!repaired;
      });
      if (repaired) { dbg.repaired = repaired; return { num: repaired, matched: true, dbg: dbg }; }
    }
    // 2) nothing confirmed — offer the best catalog-shaped token as a hedge
    if (loose.length) { loose.sort(dashRank); return { num: loose[0], matched: false, offEra: true, dbg: dbg }; }
    uniq.sort(dashRank);
    if (uniq.length) return { num: uniq[0], matched: false, dbg: dbg };
    // 3) last resort: a catalog-backed short number, always as a guess
    // v0.9.1080 — a bare two-digit number is never offered on its own any more.
    //
    // Brad's Santa Fe 2414 offered "71"; his 1877 horse car offered "53". Both
    // came out of text containing no readable word, and both numbers exist in
    // the postwar catalog — which is precisely why they surfaced. I first tried
    // gating this on how much text was recovered, and it does not work: that
    // Santa Fe string has thirty characters in it, they are simply meaningless.
    // Length was measuring the wrong thing.
    //
    // The rule that does hold is about evidence, not volume: two digits alone
    // are never enough. With a few thousand numbers in the catalog, almost any
    // stray pair lands on one. A short number is only ever accepted when
    // something else vouches for it — the maker's name stamped beside it, which
    // promotes it to a full candidate above, or a description match. Otherwise
    // the honest answer is nothing, and nothing is what the user gets.
    dbg.shortDropped = shortOnes.slice(0, 3);
    // v0.9.1072 — a read that finds NOTHING is the case most worth explaining,
    // and it was the only one that explained nothing. Brad's Lionel 50 gang car
    // has the clearest lettering of any photo in his inbox and came back blank,
    // with no way to see whether "50" was read and rejected, read and discarded
    // as too short, or never read at all. Thirty-eight of his seventy-three
    // photos are in this state. Return the reasoning with an empty answer.
    return { num: '', matched: false, empty: true, dbg: dbg };
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

  // ══ v0.9.1077 — identify by what the car SAYS, not just its number ═══════
  // Brad: "can we use description to help find some of these. ballast tamper
  // would work or road name may help." He is right, and his own photos make the
  // case better than any argument: a BALLAST TAMPER whose number never read, a
  // TIE-JECTOR, a gondola lettered NYC, a GP9 where the reader recovered
  // "MINNEAPOLIS ST LOUIS" perfectly and then fumbled 2348 into 2388.
  //
  // On most Lionel rolling stock the road name and the item's own name are the
  // LARGEST text on the model, and the catalog number is the smallest. We have
  // been reading the easy part and discarding it.
  //
  // This is deliberately conservative. It only speaks when the numbers have
  // failed, it only counts DISTINCTIVE words (a word shared by four hundred
  // catalog rows tells you nothing), it requires a clear winner rather than a
  // narrow one, and it never claims to be certain — it hands back a candidate
  // with the item named, so a glance confirms or kills it.
  var _descIdx = null, _descIdxKey = '', _descIdxMap = null;

  // Words that appear on half the catalog and identify nothing.
  var _DESC_STOP = {
    LIONEL:1, LINES:1, BUILT:1, BLT:1, BY:1, THE:1, AND:1, FOR:1, WITH:1, AND1:1,
    CAR:1, CARS:1, RAILROAD:1, RAILWAY:1, RY:1, RR:1, CO:1, INC:1, NEW:1, TYPE:1,
    CAPY:1, LMT:1, WT:1, CUFT:1, CU:1, FT:1, LD:1, LT:1, NUMBER:1, NO:1, SET:1,
    GAUGE:1, SCALE:1, MODEL:1, TRAIN:1, ITEM:1, PART:1, USA:1, MADE:1, ONE:1,
  };

  function _descTokens(str) {
    return String(str || '').toUpperCase().match(/[A-Z][A-Z&.-]{1,}/g) || [];
  }

  // One inverted index per era: WORD -> [rows]. Built once, on first use.
  function _descIndexFor(era) {
    // v0.9.1077d: this was cached on the era alone, so once built it survived
    // the catalog itself changing — a stale index that answers confidently is
    // worse than no index. The size of the loaded master is a cheap proxy for
    // "the data underneath me changed"; caught by a test where two different
    // catalogs shared an era and the second silently got the first's answers.
    var srcMap = null;
    try { srcMap = (window.state && state.masterByItem) || null; } catch (e0) {}
    // Identity of the actual Map, not a count of it. A first attempt keyed on
    // era + size, and a test with two different single-row catalogs got the
    // first one's answer for the second — a stale index that answers with
    // confidence is worse than having no index at all.
    if (_descIdx && _descIdxKey === era && _descIdxMap === srcMap) return _descIdx;
    var idx = {};
    try {
      var m = srcMap;
      if (!m || !m.forEach) return null;
      m.forEach(function (rows) {
        (rows || []).forEach(function (row) {
          if (!row || (era && row._era !== era)) return;
          var words = {};
          _descTokens([row.description, row.roadName, row.itemType].filter(Boolean).join(' '))
            .forEach(function (w) {
              w = w.replace(/[.&-]+$/, '');
              if (w.length < 3 || _DESC_STOP[w]) return;
              words[w] = 1;
            });
          Object.keys(words).forEach(function (w) {
            (idx[w] || (idx[w] = [])).push(row);
          });
        });
      });
    } catch (e) { return null; }
    _descIdx = idx; _descIdxKey = era; _descIdxMap = srcMap;
    return idx;
  }

  // Returns { row, score, words } or null.
  function _pinDescMatch(text, prefer) {
    var era = (prefer && prefer.era) || '';
    if (!era) return null;                    // without a catalog to search, don't guess
    var idx = _descIndexFor(era);
    if (!idx) return null;
    var seen = {}, words = [];
    _descTokens(text).forEach(function (w) {
      w = w.replace(/[.&-]+$/, '');
      if (w.length < 3 || _DESC_STOP[w] || seen[w]) return;
      seen[w] = 1; words.push(w);
    });
    if (!words.length) return null;

    // v0.9.1077c — OCR breaks long words. Brad's Lackawanna Train Master came
    // through as "LACKAWAN NA", so an exact-word index found nothing at all. A
    // photo word of six or more characters also matches a catalog word that
    // begins with it (or that begins with the photo word) — long enough that a
    // prefix collision is not a coincidence, and it is exactly how OCR fails on
    // the longest and most identifying words on a model.
    var idxKeys = null;
    function _rowsFor(w) {
      if (idx[w]) return idx[w];
      if (w.length < 6) return null;
      if (!idxKeys) idxKeys = Object.keys(idx);
      var out = null;
      for (var i = 0; i < idxKeys.length; i++) {
        var k = idxKeys[i];
        if (k.length < 6) continue;
        if (k.indexOf(w) === 0 || w.indexOf(k) === 0) {
          out = (out || []).concat(idx[k]);
        }
      }
      return out;
    }

    var score = {}, hitWords = {}, rowOf = {};
    words.forEach(function (w) {
      var rows = _rowsFor(w);
      if (!rows || !rows.length) return;
      // A word carrying 40+ rows is a category, not an identity. Weight by how
      // rare it is — TIE-JECTOR is worth far more than GONDOLA.
      var weight = rows.length > 60 ? 0 : (rows.length > 12 ? 0.4 : (rows.length > 3 ? 1 : 2));
      if (!weight) return;
      // v0.9.1080b: dedupe rows within one word. Prefix matching can return the
      // same row from several index keys, and it was scoring each one — which is
      // how a single word "MAIL" counted three times on Brad's Western &
      // Atlantic mail car and pulled up a completely different boxcar.
      var seenRow = {};
      rows.forEach(function (row) {
        var k = String(row.itemNum || '') + '|' + String(row._tab || '');
        if (seenRow[k]) return;
        seenRow[k] = 1;
        score[k] = (score[k] || 0) + weight;
        (hitWords[k] || (hitWords[k] = [])).push(w);
        rowOf[k] = row;
      });
    });
    var keys = Object.keys(score);
    if (!keys.length) return null;
    keys.sort(function (a, b) { return score[b] - score[a]; });
    var top = score[keys[0]], second = keys.length > 1 ? score[keys[1]] : 0;
    // Needs to be worth something AND to be a clear winner. A near tie means the
    // words were generic and any of a dozen items would fit.
    // Two DISTINCT words minimum. "MAIL" on its own describes a mail car, a mail
    // boxcar and a mail crane equally well; "WESTERN" plus "ATLANTIC" describes
    // one train. A single word is a category, not an identity — and the whole
    // promise of this route is that a glance can confirm it, which only holds
    // when it had real evidence to begin with.
    // ...unless the single word is long AND essentially unique. TIE-JECTOR and
    // LACKAWANNA each name exactly one item in the catalog and are far too long
    // to collide by accident; MAIL is short and describes half a dozen cars.
    // Rarity and length are what separate a name from a category, not count.
    var w0 = (hitWords[keys[0]] || []);
    if (w0.length < 2) {
      var only = w0[0] || '';
      var rowsFor0 = only ? (_rowsFor(only) || []) : [];
      if (!(only.length >= 7 && rowsFor0.length && rowsFor0.length <= 2)) return null;
    }
    if (top < 2) return null;
    if (second >= top * 0.75) return null;
    return { row: rowOf[keys[0]], score: top, words: (hitWords[keys[0]] || []).slice(0, 6) };
  }

  // ══ v0.9.1069 — best of several passes ═══════════════════════════════════
  // The audit settled this. No single setting wins: tiling alone found Brad's
  // 6817, 6801, 2410 and 6828, and missed his Fort Knox 6445 — which INVERTED
  // caught. Counting rows where any setting confirmed a number gives 45 of 73
  // against the best single column's 40. Reading once and accepting the answer
  // was leaving a fifth of the inbox on the floor.
  //
  // So: try the strongest first and stop the moment the stamped catalog
  // confirms a number. Most photos still cost one pass; only the awkward ones
  // pay for the rest.
  //
  //   1  TILED   — the number is usually the SMALLEST text on the item, dwarfed
  //                by the road name. Reading each third blown up is what makes
  //                it legible, and it beat every other setting by a wide margin.
  //   2  INVERTED— light lettering on a dark body. Tesseract expects the
  //                opposite, and half of Lionel's rolling stock is the wrong way
  //                round for it.
  //   3  DIGITS  — no letters at all, so it cannot offer O for 0 or S for 5.
  var _FREE_PASSES = [
    { mode: 'sharp',  tiles: 3, wl: 'full'   },
    { mode: 'invert', tiles: 0, wl: 'full'   },
    { mode: 'sharp',  tiles: 0, wl: 'digits' },
    { mode: 'chan',   tiles: 3, wl: 'full'   },
  ];
  var _WL_FULL = '0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ ';
  var _WL_DIGITS = '0123456789-';

  async function _freeReadBlob(blob, maxDim, prefer) {
    var bc = await _readBarcode(blob);
    if (bc) return bc;
    var w = await _tessGet(); if (!w) return null;
    var bmp = null;
    try { bmp = await createImageBitmap(blob); }
    catch (eB) {
      // A photo the browser cannot decode is a real answer, not a crash.
      console.warn('[inbox] could not decode this photo', eB && eB.message);
      return { num: '', matched: false, empty: true,
               dbg: { era: (prefer && prefer.era) || '', cand: [], inEra: [], offEra: [],
                      note: 'the browser could not decode this photo' } };
    }
    var dim = maxDim || 2400;
    var best = null, text = '';
    for (var pi = 0; pi < _FREE_PASSES.length; pi++) {
      var p = _FREE_PASSES[pi];
      var t = '', r = null;
      try {
        await w.setParameters({ tessedit_char_whitelist: p.wl === 'digits' ? _WL_DIGITS : _WL_FULL });
        if (p.tiles) {
          // v0.9.1076 — WHERE the text was found matters. Brad photographs his
          // shelf against a wall with a printed catalog page pinned to it, and
          // the reader was lifting numbers straight off it: a 6816 flatcar came
          // back "409" and a 6817 came back "6912", neither number anywhere on
          // the model. Background print is often CRISPER than stamped lettering,
          // so it wins on merit and is wrong every time.
          //
          // The item is in the middle of the frame; the wall is above it. So the
          // middle band gets asked first and on its own — if that alone yields a
          // catalog-confirmed number, nothing from the edges can overrule it.
          var bands = [];
          for (var ti = 0; ti < p.tiles; ti++) {
            bands.push((((await w.recognize(_auditTile(bmp, dim, p.mode, ti, p.tiles))).data) || {}).text || '');
          }
          var mid = bands[Math.floor(p.tiles / 2)] || '';
          var rMid = _numberFromText(mid, prefer);
          if (rMid && rMid.matched && rMid.num) {
            if (rMid.dbg) rMid.dbg.fromMiddle = true;
            r = rMid; t = mid;
          } else {
            t = ((((await w.recognize(_auditCanvas(bmp, dim, p.mode))).data) || {}).text || '')
              + '\n' + bands.join('\n');
          }
        } else {
          t = (((await w.recognize(_auditCanvas(bmp, dim, p.mode))).data) || {}).text || '';
        }
      } catch (eP) { continue; }
      if (!r) r = _numberFromText(t, prefer);
      // An empty answer still carries its reasoning, so keep it if nothing
      // better turns up — but never let it outrank a real one.
      if (r && (!best || (r.num && !best.num) || (r.matched && !best.matched))) { best = r; text = t; }
      if (best && best.matched && best.num) break;     // the stamped catalog agrees — done
    }
    try { await w.setParameters({ tessedit_char_whitelist: _WL_FULL }); } catch (eR) {}
    try { if (bmp.close) bmp.close(); } catch (eC) {}
    // ── What does the car SAY? ────────────────────────────────────────────
    // v0.9.1077b — this used to run only when the numbers had failed outright,
    // and Brad's Lackawanna 2321 showed why that is not enough. The reader saw
    // "D321" — 2321 with the leading 2 misread — and 321 IS a real postwar item,
    // a Trestle Bridge. So a wrong answer counted as a match and the word
    // LACKAWAN, sitting in the same text and naming the locomotive outright,
    // was never consulted. It runs every time now.
    try {
      var dm = _pinDescMatch(text, prefer);
      if (dm && dm.row && dm.row.itemNum) {
        var descNum = String(dm.row.itemNum);
        var haveNum = (best && best.num) ? String(best.num) : '';
        var descOf = [dm.row.description, dm.row.roadName].filter(Boolean).join(' \u2014 ');
        var dbg2 = (best && best.dbg) || {};
        dbg2.viaDesc = dm.words.join(', ');

        // TWO WEAK SIGNALS THAT AGREE. "321" is the tail of "2321", and the
        // lettering independently says Lackawanna. A misread leading digit and a
        // road name pointing at the same item is far stronger evidence than
        // either alone — this is the case worth being confident about.
        var tailAgrees = haveNum && descNum !== haveNum &&
          (descNum.replace(/\D/g, '').slice(-haveNum.replace(/\D/g, '').length) === haveNum.replace(/\D/g, ''));

        if (tailAgrees) {
          dbg2.corroborated = descNum + ' (read ' + haveNum + ', lettering agrees)';
          best = { num: descNum, matched: true, viaDesc: true, descWords: dm.words, descOf: descOf, dbg: dbg2 };
        } else if (!best || !best.matched) {
          best = { num: descNum, matched: false, viaDesc: true, descWords: dm.words, descOf: descOf, dbg: dbg2 };
        } else if (dm.score >= 3 && haveNum.replace(/\D/g, '').length <= 3) {
          // A confident name beats a three-digit number that could be anything.
          // Offered rather than asserted, since the two genuinely disagree.
          best = { num: descNum, matched: false, viaDesc: true, descWords: dm.words, descOf: descOf,
                   disagreed: haveNum, dbg: dbg2 };
        }
      }
    } catch (eD) { console.warn('[inbox] description match failed', eD && eD.message); }
    var out = best;
    // v0.9.1068 (Brad: "where does 120 come from?"). A number appears with no
    // way to tell whether the reader saw it on the item, on the shelf behind it,
    // or invented it from a shadow. Keep the words it actually read.
    if (out) out.raw = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 180);
    return out;
  }

  // v0.9.1083 — what we know about a photo, in the shape the paid reader wants.
  // Three of the four paid call sites were passing `{}`: the reader was being
  // asked "what is this?" with no mention of the era stamped on the photo, and
  // answering from a web that is overwhelmingly modern reissues.
  function _pinAiHints(group, extra) {
    var h = {};
    try {
      var pref = _pinPreferOf(group);
      if (pref && pref.era) {
        var d = (typeof ERAS !== 'undefined') ? ERAS[pref.era] : null;
        if (d) {
          h.eraLabel = d.label || '';
          h.eraYears = d.years || '';
        }
        if (pref.manufacturer) h.mfrs = [pref.manufacturer];
        try {
          var sc = (typeof ERA_SCALE !== 'undefined') ? ERA_SCALE[pref.era] : '';
          if (sc) h.scale = sc;
        } catch (eS) {}
        // Said plainly as well as structurally — the relay weaves `note` into
        // the prompt, and a sentence survives a prompt rewrite better than a
        // field name does.
        h.note = 'This is a ' + (h.eraLabel || 'vintage') + (h.eraYears ? ' (' + h.eraYears + ')' : '')
          + ' item. Identify the ORIGINAL piece from that period, not a modern reissue,'
          + ' remake or Celebration Series version carrying the same number.';
      }
    } catch (e) {}
    if (extra && extra.note) h.note = (h.note ? h.note + ' ' : '') + extra.note;
    if (extra && extra.mfrs) h.mfrs = extra.mfrs;
    return h;
  }

  // The era stamped on a photo, in the shape findMaster's `prefer` wants.
  function _pinPreferOf(fileOrGroup) {
    try {
      var f = (fileOrGroup && fileOrGroup.files) ? _pinReadFile(fileOrGroup) : fileOrGroup;
      var m = (f && f._meta) || {};
      if (!m.era) return null;
      var mfr = '';
      try { mfr = (typeof ERAS !== 'undefined' && ERAS[m.era]) ? (ERAS[m.era].manufacturer || '') : ''; } catch (e) {}
      return { era: m.era, manufacturer: mfr };
    } catch (e) { return null; }
  }
  async function _freeReadOne(fileId) {
    return _freeReadBlob(await _pinBytes(fileId), 1600, _preferForFid(fileId));
  }
  // Find the loaded group that owns this file, so its era stamp can be used.
  function _preferForFid(fileId) {
    for (var i = 0; i < _groups.length; i++) {
      for (var j = 0; j < _groups[i].files.length; j++) {
        if (_groups[i].files[j].id === fileId) return _pinPreferOf(_groups[i]);
      }
    }
    return null;
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
    // v0.9.1074: this read files[0] directly. Since v0.9.1061 every OTHER read
    // path picks the group's readable photo instead — skipping the "everything
    // together" shot, which has several numbers in it. On a grouped item that
    // meant re-scan read a photo nothing else reads, and stored the answer under
    // a file id nothing else looks at: the button appeared to do nothing at all.
    var fid = _pinReadFid(_rvGroups[0]) || _rvGroups[0].files[0].id;
    var key = _rvGroups[0].key;
    var btn = document.getElementById('pin-rv-rescan');
    if (btn) { btn.disabled = true; btn.textContent = 'Re-scanning…'; }
    try {
      try { var mm = _ids(); if (mm[fid]) { delete mm[fid]; _idsSave(mm); } } catch (e1) {}
      try { var ff = _freeTried(); if (ff[fid]) { delete ff[fid]; _freeTriedSave(ff); } } catch (e2) {}
      try { var pfx = fid + '|'; Object.keys(_vfCache || {}).forEach(function (k) { if (k.indexOf(pfx) === 0) delete _vfCache[k]; }); } catch (e3) {}
      var blob = await _pinBytes(fid);
      // Full multi-pass reader since v0.9.1069 — tiled, then inverted, then
      // digits-only, stopping as soon as the stamped catalog confirms.
      var r = await _freeReadBlob(blob, 2400, _preferForFid(fid));
      var m = _ids();
      if (r && r.num) { m[fid] = { num: r.num, guess: r.matched ? 0 : 1, tried: 1, free: 1, raw: r.raw || '', dbg: r.dbg || null, rv: READER_VER, viaDesc: !!r.viaDesc, descOf: r.descOf || '', descWords: r.descWords || [] }; _idsSave(m); }
      else { var f2 = _freeTried(); f2[fid] = { t: 1, raw: (r && r.raw) || '', dbg: (r && r.dbg) || null, rv: READER_VER }; _freeTriedSave(f2); }
      try { _render(); } catch (e4) {}
      window._pinReview(key);
      // v0.9.1067 (Brad: "saying still no clear number will piss people off when
      // the number is obviously to a user clear"). He is right, and it is worse
      // than annoying — it is untrue. On his 2408 Santa Fe car the number is
      // perfectly legible to a person; the free reader simply cannot see it, and
      // telling the user to crop tighter implies they took a bad photo when the
      // app is the one that failed. Say what happened, own it, and offer the
      // thing that actually works next.
      if (!(r && r.num)) showToast('The free reader could not pick out a number on this one — type it in, or use “Read this photo” for a closer look', 4500);
    } catch (e) {
      if (btn) { btn.disabled = false; btn.textContent = 'This is wrong — re-scan'; }
      // v0.9.1078: "Re-scan failed — try again" told Brad nothing and told me
      // less. Every other failure in this file explains itself by now; this one
      // swallowed the reason and left him pressing a button that could not work.
      console.error('[inbox] re-scan failed', e);
      var _why = (e && e.message) ? String(e.message).slice(0, 90) : 'unknown error';
      showToast('Re-scan failed \u2014 ' + _why, 5000, true);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'This is wrong — re-scan'; }
    }
  };

  window._pinAutoReadCancel = function () { _autoReadAbort = true; };
  async function _pinAutoRead() {
    if (_autoReadBusy || !_groups.length) return;
    var ids = _ids(), ft = _freeTried();
    var _stale = function (rec) {
      // No record at all, or one made by an older reader than the current one.
      if (!rec) return true;
      if (typeof rec !== 'object') return true;         // legacy marker
      return rec.rv !== READER_VER;
    };
    var todo = _groups.filter(function (g) {
      var fid = _pinReadFid(g);
      if (!fid) return false;
      var got = ids[fid];
      // A confirmed read from the current reader is left alone. Anything else —
      // never read, failed, or produced by an older reader — is retried free.
      if (got && !got.guess && got.rv === READER_VER) return false;
      if (got && got.rv === READER_VER) return false;
      return _stale(ft[fid]) || !got;
    });
    if (!todo.length) return;
    _autoReadBusy = true; _autoReadAbort = false;
    if (!(await _tessGet())) { _autoReadBusy = false; return; }   // OCR unavailable → leave for paid identify
    try {
      for (var i = 0; i < todo.length && !_autoReadAbort; i++) {
        _status('Reading photos… ' + (i + 1) + ' of ' + todo.length);
        var fid = _pinReadFid(todo[i]), r = null;
        try { r = await _freeReadOne(fid); } catch (e) {}
        if (r && r.num) {
          var m = _ids(); m[fid] = { num: r.num, guess: r.matched ? 0 : 1, tried: 1, free: 1, raw: r.raw || '', dbg: r.dbg || null, rv: READER_VER, viaDesc: !!r.viaDesc, descOf: r.descOf || '', descWords: r.descWords || [] };
          _idsSave(m);
        } else {
          // v0.9.1072: remember WHY it failed, not just that it did. Stored on
          // the tried-map rather than as a suggestion, so a blank read still
          // counts as unread for the paid batch and the token button.
          var f = _freeTried(); f[fid] = { t: 1, raw: (r && r.raw) || '', dbg: (r && r.dbg) || null, rv: READER_VER }; _freeTriedSave(f);
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
        _freeReadBlob(blob, 1600, _preferForFid(fid)).then(function (r) {
          var m = _ids();
          if (r && r.num) { m[fid] = { num: r.num, guess: r.matched ? 0 : 1, tried: 1, free: 1, raw: r.raw || '', dbg: r.dbg || null, rv: READER_VER, viaDesc: !!r.viaDesc, descOf: r.descOf || '', descWords: r.descWords || [] }; _idsSave(m); }
          else { var f2 = _freeTried(); f2[fid] = 1; _freeTriedSave(f2); }
          try { _render(); } catch (e2) {}
        }).catch(function () {});
      } catch (e4) { showToast('Could not save the crop — the original is untouched', 3000, true); }
    }, function () { try { URL.revokeObjectURL(srcUrl); } catch (e5) {} });
  };

  // v0.9.1058 (Brad: "i don't have a rescan function where i can rescan all the
  // ones i just cropped"). Cropping already triggers a FREE re-read of the
  // tighter shot. This is the next step up: re-read the cropped photos with the
  // paid reader, including ones that already carry a read — because a number
  // lifted from the uncropped photo is exactly the read you want replaced.
  // (Brad's 6801 boat flatcar came back "2409 Santa Fe Pullman": the number was
  // read off a neighbouring item on the shelf.)
  function _pinCroppedGroups() {
    var c = _cropped();
    // Only groups whose READABLE photo was cropped — re-reading because someone
    // cropped the set shot would spend effort on the photo we skip anyway.
    return _groups.filter(function (g) {
      return _pinReadFiles(g).some(function (f) { return c[f.id]; });
    });
  }

  function _updateAuditBtn() {
    var b = document.getElementById('pin-audit-btn');
    if (!b) return;
    var a = _auditLoad();
    if (a && a.rows.length) {
      var partial = a.rows.length < (a.total || a.rows.length);
      b.textContent = partial
        ? ('Resume audit (' + a.rows.length + '/' + a.total + ')')
        : ('Audit results (' + a.rows.length + ')');
      b.style.borderColor = '#2980b9';
      b.style.background = 'rgba(41,128,185,0.18)';
      b.onclick = partial ? window._pinReaderAudit : window._pinAuditShowSaved;
    } else {
      b.textContent = 'Reader audit (free)';
      b.style.borderColor = '#8b8e94';
      b.style.background = 'rgba(139,142,148,0.12)';
      b.onclick = window._pinReaderAudit;
    }
  }

  function _updateRecropBtn() {
    var b = document.getElementById('pin-recrop-btn');
    if (!b) return;
    var n = _pinCroppedGroups().length;
    if (n > 0 && !_selectMode) {
      b.textContent = 'Re-read ' + n + ' cropped (free)';
      b.style.display = '';
    } else {
      b.style.display = 'none';
    }
  }

  // Brad: "we need the re-read button to say re-read, no tokens." Right call,
  // and there is a genuinely free thing to do here. The automatic re-read that
  // fires when you crop runs at the default resolution; the single-photo "This
  // is wrong — re-scan" runs the SAME free reader at 2400px and gets numbers the
  // first pass misses. This is that second attempt, across every cropped photo,
  // in one go. No credits, no confirm to spend anything — just time.
  window._pinReadCropped = async function () {
    if (_busy) { showToast('Still working on the last batch\u2026', 2500, true); return; }
    var gs = _pinCroppedGroups();
    if (!gs.length) { showToast('Nothing cropped since the last read', 2800); return; }
    _busy = true; _idAbort = false;
    var btn = document.getElementById('pin-recrop-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Re-reading\u2026'; }
    var found = 0, done = 0, failed = 0;
    for (var i = 0; i < gs.length; i++) {
      if (_idAbort) break;
      var fid = _pinReadFid(gs[i]);
      _status('Re-reading ' + (i + 1) + ' of ' + gs.length + '\u2026 ' + found + ' number' + (found === 1 ? '' : 's') + ' so far');
      try {
        // Forget the previous read so a number lifted from the UNCROPPED photo
        // cannot survive. That is the read this exists to replace.
        try { var mm = _ids(); if (mm[fid]) { delete mm[fid]; _idsSave(mm); } } catch (e1) {}
        try { var ff = _freeTried(); if (ff[fid]) { delete ff[fid]; _freeTriedSave(ff); } } catch (e2) {}
        try { var pfx = fid + '|'; Object.keys(_vfCache || {}).forEach(function (k) { if (k.indexOf(pfx) === 0) delete _vfCache[k]; }); } catch (e3) {}
        var blob = await _pinBytes(fid);
        var r = await _freeReadBlob(blob, 2400, _pinPreferOf(gs[i]));   // the higher-resolution attempt
        var m = _ids();
        if (r && r.num) { m[fid] = { num: r.num, guess: r.matched ? 0 : 1, tried: 1, free: 1 }; _idsSave(m); found++; }
        else { var f2 = _freeTried(); f2[fid] = 1; _freeTriedSave(f2); }
      } catch (e) {
        failed++;
        console.warn('[inbox] free re-read failed', fid, e && e.message);
      }
      done++;
    }
    _busy = false; _status('');
    if (btn) btn.disabled = false;
    // Say what actually happened, including the ones that errored.
    var msg = 'Re-read ' + done + ' photo' + (done === 1 ? '' : 's') + ' \u2014 found '
      + found + ' number' + (found === 1 ? '' : 's');
    if (failed) msg += ', ' + failed + ' could not be read';
    if (_idAbort) msg += ' (stopped early)';
    showToast(msg, 4200, !!failed);
    await window._pinRefresh();
  };

  // ══ v0.9.1063 — reader audit ═════════════════════════════════════════════
  // Brad: "audit my whole photo inbox because those are a good representation of
  // what a user will submit. we should be able to nail 90% of these."
  //
  // Guessing at OCR settings from four screenshot crops is not an audit. This
  // runs the FREE reader over every photo in the inbox, several preprocessing
  // variants each, and reports how many numbers each variant finds and how many
  // the catalog confirms. It costs no credits — it is the same browser-side OCR
  // that already runs automatically — only time.
  //
  // The score to trust is CONFIRMED (the master list recognises the number), not
  // FOUND: a variant that reads more digits but confirms fewer is reading noise.
  // Local (adaptive) threshold, shared by the 'local' and 'chan' passes.
  // Compares each pixel with the mean of its own neighbourhood via an
  // integral image, so uneven lighting and specular highlights stop deciding
  // the result for the whole photo.
  function _localThreshold(c) {
    var ctx = c.getContext('2d');
    var w = c.width, h = c.height;
    var img = ctx.getImageData(0, 0, w, h), d = img.data;
      // v0.9.1080 — a silver passenger car has a blown-out highlight along the
      // roof and deep shadow under the skirt, so the global stretch is decided
      // by those two extremes and the lettering in between barely moves. Compare
      // each pixel with the average of its own neighbourhood instead: what
      // matters is whether a pixel is darker than the metal AROUND it, not
      // darker than the brightest thing in the photo. This is the standard
      // answer for reflective surfaces and uneven lighting.
      var box = Math.max(8, Math.round(Math.min(w, h) / 40));
      var integral = new Float64Array((w + 1) * (h + 1));
      var xx, yy;
      for (yy = 0; yy < h; yy++) {
        var rowSum = 0;
        for (xx = 0; xx < w; xx++) {
          rowSum += d[((yy * w) + xx) * 4];
          integral[((yy + 1) * (w + 1)) + (xx + 1)] = integral[(yy * (w + 1)) + (xx + 1)] + rowSum;
        }
      }
      var area = function (x0, y0, x1, y1) {
        return integral[(y1 * (w + 1)) + x1] - integral[(y0 * (w + 1)) + x1]
             - integral[(y1 * (w + 1)) + x0] + integral[(y0 * (w + 1)) + x0];
      };
      var outBuf = new Uint8ClampedArray(w * h);
      for (yy = 0; yy < h; yy++) {
        var y0 = Math.max(0, yy - box), y1 = Math.min(h, yy + box + 1);
        for (xx = 0; xx < w; xx++) {
          var x0 = Math.max(0, xx - box), x1 = Math.min(w, xx + box + 1);
          var n = (x1 - x0) * (y1 - y0);
          var mean = area(x0, y0, x1, y1) / n;
          var v2 = d[((yy * w) + xx) * 4];
          // 6% below the local mean counts as ink — tolerant enough for thin
          // stamped lettering, tight enough not to turn noise black.
          outBuf[(yy * w) + xx] = (v2 < mean * 0.94) ? 0 : 255;
        }
      }
      for (yy = 0; yy < h; yy++) {
        for (xx = 0; xx < w; xx++) {
          var o2 = ((yy * w) + xx) * 4;
          d[o2] = d[o2 + 1] = d[o2 + 2] = outBuf[(yy * w) + xx];
        }
      }
      ctx.putImageData(img, 0, 0);
      return c;
  }

  // ══ v0.9.1082 — the tiles were never preprocessed ═══════════════════════
  // _auditTile took a `mode` argument and ignored it completely: every band got
  // a plain grayscale stretch, whatever the pass was supposed to be doing. So
  // the inverted pass never inverted a band, the local threshold never touched
  // one, and tonight's colour-channel work would not have reached them either —
  // on the TILED pass, which is the one that won the audit and the one Brad's
  // red flatcars depend on. It won despite this.
  //
  // Making the canvas and processing it are separate jobs now, and the whole
  // frame and each band run the identical code.
  function _applyMode(c, mode) {
    var ctx = c.getContext('2d');
    var w = c.width, h = c.height;
    var img = ctx.getImageData(0, 0, w, h), d = img.data;
    // grayscale + histogram bounds
    var lo = 255, hi = 0, i;
    for (i = 0; i < d.length; i += 4) {
      var g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
      d[i] = d[i + 1] = d[i + 2] = g;
      if (g < lo) lo = g;
      if (g > hi) hi = g;
    }
    // stretch to full range — this is what a shiny silver car needs, where the
    // whole photo lives in a narrow band of greys
    var span = Math.max(1, hi - lo);
    for (i = 0; i < d.length; i += 4) {
      var v = ((d[i] - lo) * 255 / span);
      v = v < 0 ? 0 : (v > 255 ? 255 : v);
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    if (mode === 'chan') {
      // ══ v0.9.1081 — read the colour channel that actually shows the text ═══
      // Brad: "get the photo id to read the red flatcar numbers. this should be
      // easy." He was right, and the reason it was not working has nothing to do
      // with size or focus. Converting to grayscale mixes the three channels by
      // 0.299R + 0.587G + 0.114B, and on a warm-coloured body that mix destroys
      // the very contrast we need:
      //
      //   white lettering on...   grayscale   red ch   green ch   blue ch
      //   red flatcar                   169       54        220       212
      //   orange gang car               115       18        142       228
      //   yellow barrel car              62       10         60       210
      //
      // A yellow car keeps 62 levels of separation in grayscale and 210 in blue.
      // We were discarding three and a half times the signal before the reader
      // ever saw the photo. Lionel painted an awful lot of red, orange and
      // yellow rolling stock.
      //
      // So: measure each channel's spread and keep whichever one separates best,
      // rather than blending all three into mush. On a silver or black body the
      // channels are near-identical and this behaves exactly like grayscale.
      var n2 = 0, sum = [0, 0, 0], sumSq = [0, 0, 0];
      var step = Math.max(4, Math.floor((w * h) / 40000)) * 4;   // sample, don't scan
      for (var q = 0; q < d.length; q += step) {
        for (var ch = 0; ch < 3; ch++) {
          var vq = d[q + ch];
          sum[ch] += vq; sumSq[ch] += vq * vq;
        }
        n2++;
      }
      var best = 0, bestSd = -1;
      for (var ch2 = 0; ch2 < 3; ch2++) {
        var mean2 = sum[ch2] / Math.max(1, n2);
        var sd = Math.sqrt(Math.max(0, (sumSq[ch2] / Math.max(1, n2)) - (mean2 * mean2)));
        if (sd > bestSd) { bestSd = sd; best = ch2; }
      }
      for (var p2 = 0; p2 < d.length; p2 += 4) {
        var vv = d[p2 + best];
        d[p2] = d[p2 + 1] = d[p2 + 2] = vv;
      }
      ctx.putImageData(img, 0, 0);
      // then the same local threshold, which is what copes with the highlights
      return _localThreshold(c);
    }
    if (mode === 'local') { return _localThreshold(c); }
    if (mode === 'invert') {
      for (i = 0; i < d.length; i += 4) {
        d[i] = d[i + 1] = d[i + 2] = 255 - d[i];
      }
    }
    if (mode === 'sharp' || mode === 'invert') {
      // unsharp mask: subtract a cheap 3x3 blur, add the difference back
      var src = new Uint8ClampedArray(d.length);
      src.set(d);
      var idx = function (x, y) { return ((y * w) + x) * 4; };
      for (var y = 1; y < h - 1; y++) {
        for (var x = 1; x < w - 1; x++) {
          var sum = 0;
          for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) sum += src[idx(x + dx, y + dy)];
          var blur = sum / 9;
          var o = idx(x, y);
          var sharp = src[o] + (src[o] - blur) * 1.8;
          d[o] = d[o + 1] = d[o + 2] = sharp < 0 ? 0 : (sharp > 255 ? 255 : sharp);
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function _auditCanvas(bmp, maxDim, mode) {
    var sc = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    var w = Math.max(1, Math.round(bmp.width * sc)), h = Math.max(1, Math.round(bmp.height * sc));
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    if (mode === 'current') {
      try { ctx.filter = 'grayscale(1) contrast(1.3)'; } catch (e) {}
      ctx.drawImage(bmp, 0, 0, w, h);
      return c;
    }
    ctx.drawImage(bmp, 0, 0, w, h);
    return _applyMode(c, mode);
  }

  // v0.9.1064 (Brad: "it got through the audit and then it flashed like google
  // had to reauthenticate ... and started back at the dashboard"). Twenty
  // minutes of reading held only in memory, thrown away by one reload. Results
  // are written to storage after EVERY photo now, so the worst a reload can
  // cost is the photo that was in flight — and the next run resumes from there
  // rather than starting over.
  var AUDIT_KEY = 'rr_reader_audit';
  function _auditLoad() {
    try {
      var a = JSON.parse(localStorage.getItem(AUDIT_KEY) || 'null');
      return (a && Array.isArray(a.rows)) ? a : null;
    } catch (e) { return null; }
  }
  function _auditSave(a) {
    try { localStorage.setItem(AUDIT_KEY, JSON.stringify(a)); }
    catch (e) { console.warn('[audit] could not save progress', e && e.message); }
  }
  window._pinAuditClear = function () {
    try { localStorage.removeItem(AUDIT_KEY); } catch (e) {}
    var b = document.getElementById('pin-audit-ov'); if (b) b.remove();
    showToast('Audit results cleared', 2200);
    _render();
  };
  window._pinAuditShowSaved = function () {
    var a = _auditLoad();
    if (!a || !a.rows.length) { showToast('No saved audit yet', 2400); return; }
    _pinAuditReport(a.rows, a.tally, a.secs || 0, a.total || a.rows.length);
  };

  // Round 2. sharp6 won round 1 and is now the shipping default, so it is the
  // baseline every new idea has to beat. Each of the others attacks a specific
  // failure seen in Brad's 73: light lettering on a dark body (inverted),
  // letters being confused for digits (digits-only), and a number that is a
  // tiny part of a wide shelf photo (tiled — the single most common shape in
  // his inbox, and the one a whole-image pass is worst at).
  // One horizontal band of the photo, scaled up to the same working size, so
  // the lettering inside it is physically larger for the reader.
  function _auditTile(bmp, maxDim, mode, index, count) {
    var bh = Math.floor(bmp.height / count);
    var y0 = index * bh;
    var h0 = (index === count - 1) ? (bmp.height - y0) : bh;
    var sc = Math.min(3, maxDim / Math.max(bmp.width, h0));
    var w = Math.max(1, Math.round(bmp.width * sc)), h = Math.max(1, Math.round(h0 * sc));
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    ctx.drawImage(bmp, 0, y0, bmp.width, h0, 0, 0, w, h);
    // v0.9.1082: the band gets the SAME treatment as the whole frame. It used to
    // get a plain stretch regardless of the pass, which quietly disabled every
    // preprocessing idea on the pass that works best.
    try { return _applyMode(c, mode); } catch (e) { try { _stretchCanvas(c); } catch (e2) {} }
    return c;
  }

  var _AUDIT_VARIANTS = [
    { id: 'sharp6',  label: 'Now shipping — stretch + sharpen, block mode', dim: 2400, mode: 'sharp',  psm: '6', wl: 'full' },
    { id: 'digits6', label: 'Same, but digits only (no letter confusion)',  dim: 2400, mode: 'sharp',  psm: '6', wl: 'digits' },
    { id: 'inv6',    label: 'Inverted — for light numbers on a dark body',  dim: 2400, mode: 'invert', psm: '6', wl: 'full' },
    { id: 'tile6',   label: 'Split into thirds and read each closer',       dim: 2400, mode: 'sharp',  psm: '6', wl: 'full', tiles: 3 },
    { id: 'local6',  label: 'Local threshold + thirds (reflective bodies)',  dim: 2400, mode: 'local',  psm: '6', wl: 'full', tiles: 3 },
    { id: 'chan6',   label: 'Best colour channel + thirds (red/orange cars)', dim: 2400, mode: 'chan',   psm: '6', wl: 'full', tiles: 3 },
  ];

  window._pinReaderAuditCancel = function () { _idAbort = true; };

  window._pinReaderAudit = async function () {
    if (_busy) { showToast('Still working on the last batch\u2026', 2500, true); return; }
    if (!_groups.length) { showToast('Inbox is empty', 2500); return; }
    var w = await _tessGet();
    if (!w) { showToast('The free reader is not available on this device', 3500, true); return; }
    var go = await _pinConfirm('Read all ' + _groups.length + ' items with the free reader, '
      + _AUDIT_VARIANTS.length + ' different settings each. <b>No credits are used</b> \u2014 this is the same '
      + 'browser-side reader that already runs by itself. It takes a while; keep this tab open.',
      'Run the audit');
    if (!go) return;

    _busy = true; _idAbort = false;
    window._rrLongJob = true;       // a deploy must not reload the page under this
    var prev = _auditLoad();
    var rows = (prev && prev.rows) ? prev.rows : [];
    var seen = {};
    rows.forEach(function (r) { seen[r.fid] = 1; });
    var tally = {};
    _AUDIT_VARIANTS.forEach(function (v) { tally[v.id] = { found: 0, confirmed: 0 }; });
    // Recount from the rows themselves rather than trusting a stored tally —
    // one source of truth, and a half-written tally can never drift from them.
    function _retally() {
      _AUDIT_VARIANTS.forEach(function (v) { tally[v.id] = { found: 0, confirmed: 0 }; });
      rows.forEach(function (r) {
        _AUDIT_VARIANTS.forEach(function (v) {
          var o = r.out && r.out[v.id];
          if (o && o.num) { tally[v.id].found++; if (o.matched) tally[v.id].confirmed++; }
        });
      });
    }
    var elapsed = (prev && prev.secs) || 0;
    var t0 = 0;
    try { t0 = performance.now(); } catch (eT) {}
    if (rows.length) showToast('Picking up where it stopped \u2014 ' + rows.length + ' already done', 3000);

    for (var i = 0; i < _groups.length && !_idAbort; i++) {
      var g = _groups[i];
      var fid = _pinReadFid(g);
      if (!fid || seen[fid]) continue;
      var prefer = _pinPreferOf(g);
      _status('Auditing item ' + (i + 1) + ' of ' + _groups.length + '\u2026 '
        + '<button onclick="_pinReaderAuditCancel()" style="border:1px solid var(--border);background:var(--surface2);color:var(--text-mid);border-radius:6px;font-size:0.72rem;padding:0.15rem 0.5rem;cursor:pointer;font-family:var(--font-body)">Stop</button>');
      var row = { fid: fid, era: (prefer && prefer.era) || '', out: {} };
      try {
        var blob = await _pinBytes(fid);
        var bmp = await createImageBitmap(blob);
        for (var vi = 0; vi < _AUDIT_VARIANTS.length; vi++) {
          var V = _AUDIT_VARIANTS[vi];
          var r = null;
          try {
            try { await w.setParameters({ tessedit_pageseg_mode: V.psm || '6' }); } catch (eP) {}
          try {
              await w.setParameters({ tessedit_char_whitelist: (V.wl === 'digits')
                ? '0123456789-' : '0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ ' });
            } catch (eW) {}
            var text = '';
            if (V.tiles) {
              // Read the whole frame AND each horizontal band. A number that is
              // 2% of a wide shelf photo is a handful of pixels once the image is
              // scaled to fit; a band of it is three times the size.
              var whole = _auditCanvas(bmp, V.dim, V.mode);
              text += ((await w.recognize(whole)).data || {}).text || '';
              for (var ti = 0; ti < V.tiles; ti++) {
                var band = _auditTile(bmp, V.dim, V.mode, ti, V.tiles);
                try { text += '\n' + (((await w.recognize(band)).data || {}).text || ''); } catch (eTi) {}
              }
            } else {
              var canvas = _auditCanvas(bmp, V.dim, V.mode);
              var res = await w.recognize(canvas);
              text = (res && res.data && res.data.text) || '';
            }
            r = _numberFromText(text, prefer);
          } catch (eV) {}
          row.out[V.id] = r ? { num: r.num, matched: !!r.matched, short: !!r.short } : null;
        }
        if (bmp.close) bmp.close();
      } catch (eF) {
        console.warn('[audit] photo failed', fid, eF && eF.message);
        row.error = String((eF && eF.message) || 'failed');
      }
      rows.push(row);
      seen[fid] = 1;
      // Save after EVERY photo. This is the whole point of the change.
      var _sofar = elapsed;
      try { _sofar = elapsed + Math.round((performance.now() - t0) / 1000); } catch (eE) {}
      _retally();
      _auditSave({ ts: Date.now(), rows: rows, tally: tally, secs: _sofar, total: _groups.length });
    }
    try {
      await w.setParameters({
        tessedit_pageseg_mode: '6',
        tessedit_char_whitelist: '0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ ',
      });
    } catch (eR) {}
    _busy = false; window._rrLongJob = false; _status('');

    var secs = elapsed;
    try { secs = elapsed + Math.round((performance.now() - t0) / 1000); } catch (eS) {}
    _retally();
    _auditSave({ ts: Date.now(), rows: rows, tally: tally, secs: secs, total: _groups.length });
    _pinAuditReport(rows, tally, secs, _groups.length);
  };

  function _pinAuditReport(rows, tally, secs, total) {
    var n = rows.length || 1;
    total = total || rows.length;
    var pct = function (x) { return Math.round((x / n) * 100); };
    var best = null;
    _AUDIT_VARIANTS.forEach(function (v) {
      if (!best || tally[v.id].confirmed > tally[best].confirmed) best = v.id;
    });
    var ov = document.createElement('div');
    ov.id = 'pin-audit-ov';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:10060;display:flex;align-items:center;justify-content:center;padding:1rem';
    var lines = _AUDIT_VARIANTS.map(function (v) {
      var t = tally[v.id];
      return '<tr' + (v.id === best ? ' style="background:rgba(41,128,185,0.14)"' : '') + '>'
        + '<td style="padding:0.4rem 0.5rem;border-top:1px solid var(--border)">' + rrEsc(v.label)
          + (v.id === best ? ' <b style="color:#7ec3ef">\u2190 best</b>' : '') + '</td>'
        + '<td style="padding:0.4rem 0.5rem;border-top:1px solid var(--border);text-align:right">' + t.found + ' (' + pct(t.found) + '%)</td>'
        + '<td style="padding:0.4rem 0.5rem;border-top:1px solid var(--border);text-align:right;font-weight:700">' + t.confirmed + ' (' + pct(t.confirmed) + '%)</td>'
        + '</tr>';
    }).join('');
    // A plain-text block Brad can copy out and send on.
    var txt = 'READER AUDIT \u2014 ' + n + ' items, ' + secs + 's\n';
    _AUDIT_VARIANTS.forEach(function (v) {
      txt += v.id + ': found ' + tally[v.id].found + '/' + n + ' (' + pct(tally[v.id].found) + '%), confirmed '
        + tally[v.id].confirmed + '/' + n + ' (' + pct(tally[v.id].confirmed) + '%)\n';
    });
    rows.forEach(function (r, i) {
      txt += (i + 1) + '\t' + (r.era || '-');
      _AUDIT_VARIANTS.forEach(function (v) {
        var o = r.out[v.id];
        txt += '\t' + (o ? (o.num + (o.matched ? '*' : '?')) : '-');
      });
      txt += '\n';
    });
    ov.innerHTML =
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:1.1rem;max-width:640px;width:100%;max-height:92vh;overflow-y:auto">'
      + '<div style="font-family:var(--font-head);font-weight:700;font-size:1.05rem;margin-bottom:0.2rem">Reader audit</div>'
      + '<div style="font-size:0.8rem;color:var(--text-dim);margin-bottom:0.9rem">'
        + rows.length + ' of ' + total + ' items read four ways, ' + secs + ' seconds, no credits spent.'
        + (rows.length < total ? ' <b>Partial \u2014 run it again to carry on from here.</b>' : '') + '  <b>Confirmed</b> means the catalog recognised the number \u2014 that is the column that matters; a setting that finds more digits but confirms fewer is reading noise.</div>'
      + '<table style="width:100%;border-collapse:collapse;font-size:0.82rem">'
      +   '<tr><th style="text-align:left;padding:0.3rem 0.5rem;font-size:0.72rem;text-transform:uppercase;color:var(--text-dim)">Setting</th>'
      +   '<th style="text-align:right;padding:0.3rem 0.5rem;font-size:0.72rem;text-transform:uppercase;color:var(--text-dim)">Found</th>'
      +   '<th style="text-align:right;padding:0.3rem 0.5rem;font-size:0.72rem;text-transform:uppercase;color:var(--text-dim)">Confirmed</th></tr>'
      +   lines
      + '</table>'
      + '<textarea id="pin-audit-txt" readonly style="width:100%;box-sizing:border-box;height:150px;margin-top:0.9rem;padding:0.6rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-mono);font-size:0.72rem">' + rrEsc(txt) + '</textarea>'
      + '<div style="display:flex;gap:0.5rem;margin-top:0.7rem">'
      +   '<button onclick="(function(){var t=document.getElementById(\'pin-audit-txt\');t.select();try{document.execCommand(\'copy\');showToast(\'Copied \u2014 paste it to Claude\',2500);}catch(e){}})()" style="flex:1;padding:0.7rem;border-radius:9px;border:none;background:var(--accent);color:#fff;font-weight:700;font-size:0.9rem;min-height:48px;cursor:pointer">Copy the results</button>'
      +   '<button onclick="document.getElementById(\'pin-audit-ov\').remove()" style="flex:1;padding:0.7rem;border-radius:9px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-weight:700;font-size:0.9rem;min-height:48px;cursor:pointer">Close</button>'
      + '</div>'
      + '<button onclick="_pinAuditClear()" style="width:100%;margin-top:0.5rem;padding:0.6rem;border-radius:9px;border:none;background:none;color:var(--text-dim);font-size:0.85rem;cursor:pointer">Throw these away and start fresh next time</button>'
      + '<div style="display:none">'
      + '</div></div>';
    document.body.appendChild(ov);
  }

  window._pinIdentifyAll = async function () {
    if (_busy) { showToast('Still working on the last batch…', 2500, true); return; }
    if (!_qcToken()) { showToast('Please sign in first', 3000, true); return; }
    if (typeof aiIdentifyImage !== 'function') { showToast('Identify service not loaded — refresh and try again', 3000, true); return; }
    var ids = _ids();
    var todo = _groups.filter(function (g) { return !ids[_pinReadFid(g)]; });
    if (!todo.length) { showToast(_groups.length ? 'Every item already has a suggestion — tick photos and use Identify to re-run any of them' : 'Inbox is empty', 3500); return; }
    // v0.9.956 (Brad): free auto-read already tried these — this button only
    // targets the leftovers it couldn't place. Show the exact count and make
    // clear it uses paid reads, so a batch never spends credits by surprise.
    var n = todo.length;
    var msg = 'The free reader already tried every photo. <b>' + n + '</b> item' + (n === 1 ? '' : 's') +
      ' couldn\'t be matched for free. Read ' + (n === 1 ? 'it' : 'them') +
      ' now? This uses ' + n + ' of your token' + (n === 1 ? '' : 's') + ' (1 per item).';
    // The message above already states the cost; repeating "(44 tokens)" on the
    // button is the same ambiguity as the toolbar had — it reads like a balance.
    var go = await _pinConfirm(msg, '🔍 Read ' + n + ' item' + (n === 1 ? '' : 's'));
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
    gs.forEach(function (g) { delete ids[_pinReadFid(g)]; });   // clear old suggestions = force fresh reads
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
        var g = todo[i], fid0 = _pinReadFid(g);
        try {
          // v0.9.896: Identify v2 — send EVERY photo of the group (cap 4)
          // in ONE call; more angles = better reads. aiIdentifyImage2 falls
          // back to v1 by itself on any v2 hiccup, so this can never be
          // worse than the old first-photo-only identify.
          // v0.9.1061: except the "together" shot. More angles help only while
          // every angle shows the SAME item; a set photo shows several, and
          // sending it invites the reader to answer with a neighbour's number.
          var _fl = _pinReadFiles(g).slice(0, 4), blobs = [];
          for (var _b = 0; _b < _fl.length; _b++) {
            try { blobs.push(await _pinBytes(_fl[_b].id)); }
            catch (eB) { console.warn('[Inbox] photo download failed, skipping one:', eB && eB.message); }
          }
          if (!blobs.length) throw new Error('no photo bytes');
          // v0.9.942: a failed catalog-photo double-check leaves a note so the
          // retry knows which number was rejected and why.
          var _hints = _pinAiHints(g,
            (typeof _vfNote !== 'undefined' && _vfNote[g.key]) ? { note: _vfNote[g.key] } : null);
          var ai = (typeof aiIdentifyImage2 === 'function')
            ? await aiIdentifyImage2(blobs, _hints)
            : await aiIdentifyImage(blobs[0], _hints);
          if (!ai.ok && ai.reason === 'quota') {
            showToast("You're out of tokens for today — the rest can run tomorrow", 4500, true);
            break;
          }
          if (ai.ok && ai.text) {
            if (typeof ai.remaining === 'number') { remaining = ai.remaining; _tokSave(ai.remaining); }   // v0.9.969: persist the count for the review card
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
              road: trim(meta.roadName), year: trim(meta.year),
              // v0.9.968 (Brad): carry scale + item-type through for wizard pre-fill.
              gauge: trim(meta.gauge), subType: trim(meta.subType) };
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
    _busy = true; _gpAbort = false;
    try {
      // v0.9.1014 (Brad): the whole picker dance (tab, scope, session, poll,
      // list) now lives in ONE shared helper in drive.js — the same one the
      // Identify-from-Photo screen uses — so the two can never drift apart.
      var pick = await rrGPhotosPickSession({
        shouldAbort: function () { return _gpAbort; },
        onStatus: function () {
          var st = document.getElementById('pin-status');
          if (st) {
            st.style.display = 'block';
            st.innerHTML = 'Pick photos in the Google Photos tab that just opened, then press <strong>Done</strong> there. Waiting… ' +
              '<button onclick="_pinGPhotosCancel()" style="border:1px solid var(--border);background:var(--surface2);color:var(--text-mid);border-radius:6px;font-size:0.72rem;padding:0.15rem 0.5rem;cursor:pointer;font-family:var(--font-body)">Cancel</button>';
          }
        },
      });
      if (pick.error) {
        _status('');
        if (pick.error === 'scope') showToast('Google Photos permission was not granted', 3500, true);
        else if (pick.error === 'session' && (pick.status === 403 || pick.status === 401)) _gpHelp();
        else if (pick.error === 'timeout') showToast('Gave up waiting for the picker — try again', 3000, true);
        else if (pick.error !== 'cancelled') showToast('Google Photos picker error' + (pick.status ? ' (' + pick.status + ')' : '') + ' — try again', 3500, true);
        return;
      }
      var photos = pick.items.filter(function (m) { return String(m.type || '').toUpperCase() !== 'VIDEO'; });
      var skipped = pick.items.length - photos.length;
      var fid = await _folder();
      var ts = new Date().getTime(), ok = 0;
      for (var i = 0; i < photos.length; i++) {
        if (_gpAbort) break;
        _status('Importing ' + (i + 1) + ' of ' + photos.length + ' from Google Photos…');
        try {
          var f = await rrGPhotosFile(photos[i], pick.auth, 'photo-' + (i + 1) + '.jpg');
          await driveUploadFile(f, 'INBOX ' + ts + ' g' + (ts + i) + ' ' + f.name, fid);
          ok++;
        } catch (eOne) { console.warn('[Inbox] Google Photos item failed:', eOne); }
      }
      rrGPhotosEnd(pick.sessionId, pick.auth);
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
        // v0.9.1019 (Brad): Inbox is SPOT 6 on the bar — before Sets, after
        // For Sale — not tacked on the end where nobody scrolls.
        var _mnavSets = document.getElementById('mnav-sets');
        if (_mnavSets && _mnavSets.parentNode === host) host.insertBefore(mb, _mnavSets);
        else host.appendChild(mb);
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
