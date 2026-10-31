// ═══════════════════════════════════════════════════════════════════════════
// collections.js — v0.9.2058, TRR Pro release 4: THE COLLECTIONS FOUNDATION
// ═══════════════════════════════════════════════════════════════════════════
// Design agreed with Brad 2026-10-28 (PLAN_2026-10-28_TRR_PRO.md, Step 3,
// Section 1 "what a collection is" and Section 4 "safety rules"). Settings and
// words: RR_COLLECTIONS (config.js).
//
// A collection is its own Google Sheet + its own photo folder. The HOME
// collection is the sheet every customer already has. A regular customer only
// ever has home, and for home every answer below is EXACTLY what the app did
// before this file existed — same sheet id, same stored-copy keys, same photo
// folder, the plain item number. Nothing on a device moves.
//
// THE RULES THIS FILE OWNS (each has a guard test — collections_2058_tests.js):
//   1. ONE current collection. `state.personalSheetId` (the sheet every screen
//      reads and writes) is ASSIGNED only here: rrSetHomeSheet for the home
//      sheet (sign-in, set-up, restore) and rrSwitchCollection for a switch.
//      A test fails on any other assignment anywhere in app/.
//   2. Waiting saves carry their sheet. The write-outbox always recorded the
//      sheet id; the offline photo pairing now stamps it too
//      (photo-inbox-offline.js), and the reconnect duplicate check only judges
//      rows of the collection that is open (app-data.js).
//   3. The device's stored copy is kept PER collection (rrPersonalCacheKey).
//      A late answer from a read of collection A can never land in B
//      (rrLoadIsStale) — and a copy is only saved under the collection it
//      belongs to (rrDataIsCurrent).
//   4. Switching WAITS for saves: nothing being written for quietMs and no
//      screen open over the app (rrSwitchQuiet). Every sheet write and Drive
//      change is counted (rrTrackWrites, wrapped round them in sheets.js /
//      drive.js), because a save is several writes with gaps between them.
//   5. Photos go to the collection's own photo folder (rrPhotoRootId, used by
//      drive.js; the folder caches are per folder — rrDriveUseRoot).
//   + The FULL ID (7-45; home shows the plain 45) is built by ONE function,
//     rrFullId. The sheet still stores the plain number.
//   + NUMBERING checked against the SHEET: a number this device has just
//     handed out is checked against every number on the sheet before its row
//     is written, and read back after. A clash takes the next free number;
//     after saving, the NEWER of two rows with the same number moves on (the
//     same rule on every device, so exactly one of them moves).
//
// Releases 5+ add the list of collections, the drop-down, moving items and
// archive. Until then nothing in the app calls rrRegisterCollection — the
// tests do, to prove two collections with the same item numbers never cross.
// ═══════════════════════════════════════════════════════════════════════════

(function (root) {
  'use strict';

  function _C() {
    return (typeof RR_COLLECTIONS !== 'undefined' && RR_COLLECTIONS) || root.RR_COLLECTIONS || {
      homeKey: 'home', currentKey: 'lv_current_collection', cacheKey: 'lv_personal_cache', hwmKey: 'lv_inv_hwm',
      keySep: '@', fullIdSep: '-', quietMs: 1500, switchWaitMs: 20000, birthTabs: [], echoTabs: [], maxReadBacks: 3, words: {},
    };
  }
  function _ls() { try { return root.localStorage || null; } catch (e) { return null; } }
  function _state() { try { return (typeof state !== 'undefined' && state) || root.state || null; } catch (e) { return root.state || null; } }
  function _word(k, vars) {
    var w = String((_C().words || {})[k] || '');
    Object.keys(vars || {}).forEach(function (v) { w = w.split('{' + v + '}').join(String(vars[v])); });
    return w;
  }

  var _reg = {};            // key -> collection (never home)
  var _current = null;      // null = home
  var _homeSheet = null;    // the home sheet id, as rrSetHomeSheet last heard it

  function _homeKey() { return _C().homeKey || 'home'; }
  function rrIsHome() { return !_current || _current === _homeKey(); }

  // ── 1. the one current collection ───────────────────────────────────────
  // The home sheet id. While home is open it IS the live value (so a screen
  // that read state.personalSheetId yesterday and rrHomeSheet() today gets
  // the same answer); while another collection is open, the last one set.
  function rrHomeSheet() {
    var st = _state();
    if (rrIsHome()) return (st && st.personalSheetId) || _homeSheet || null;
    return _homeSheet || null;
  }
  // THE writer of the home sheet id (sign-in, set-up, restore, a reload).
  // Changes the live sheet only while home is open; otherwise home's id is
  // remembered for when it is opened again.
  function rrSetHomeSheet(id, why) {
    var v = id ? String(id) : null;
    _homeSheet = v;
    var st = _state();
    if (st && rrIsHome()) st.personalSheetId = v;
    return v;
  }

  function _home() {
    var dc = null; try { dc = (typeof driveCache !== 'undefined') ? driveCache : root.driveCache; } catch (e) { dc = root.driveCache; }
    return {
      key: _homeKey(), home: true, number: null, name: '',
      sheetId: rrHomeSheet(),
      photoRootId: (dc && dc.photosId) || null,
      soldPhotoRootId: (dc && dc.soldPhotosId) || null,
    };
  }
  function _copy(c) { return c ? JSON.parse(JSON.stringify(c)) : null; }

  function rrCurrentCollection() { return rrIsHome() ? _home() : _copy(_reg[_current]); }
  function rrCollectionByKey(key) {
    if (!key || key === _homeKey()) return _home();
    return _copy(_reg[key]);
  }
  function rrCollectionForSheet(sheetId) {
    if (!sheetId) return null;
    var h = _home();
    if (h.sheetId && String(h.sheetId) === String(sheetId)) return h;
    for (var k in _reg) if (_reg[k].sheetId === String(sheetId)) return _copy(_reg[k]);
    return null;
  }
  function rrCollections() {
    var out = [_home()];
    Object.keys(_reg).map(function (k) { return _reg[k]; })
      .sort(function (a, b) { return a.number - b.number; })
      .forEach(function (c) { out.push(_copy(c)); });
    return out;
  }

  // A collection this device knows about. Release 5 feeds these from the
  // collections list file; until then only the tests call it.
  function rrRegisterCollection(c) {
    if (!c || typeof c !== 'object') throw new Error('collection: nothing given');
    var key = String(c.key || '');
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(key) || key === _homeKey()) throw new Error('collection: bad key ' + key);
    var num = Number(c.number);
    if (!(num > 0) || Math.floor(num) !== num) throw new Error('collection: bad number ' + c.number);
    var sid = String(c.sheetId || '');
    if (!sid) throw new Error('collection: no sheet');
    var h = _home();
    if (h.sheetId && h.sheetId === sid) throw new Error('collection: that is the home sheet');
    for (var k in _reg) {
      if (k === key) continue;
      if (_reg[k].number === num) throw new Error('collection: number ' + num + ' is taken');
      if (_reg[k].sheetId === sid) throw new Error('collection: sheet already listed');
    }
    _reg[key] = {
      key: key, home: false, number: num, name: String(c.name || ''),
      sheetId: sid,
      photoRootId: c.photoRootId ? String(c.photoRootId) : null,
      soldPhotoRootId: c.soldPhotoRootId ? String(c.soldPhotoRootId) : null,
      // v0.9.2071 (release 5): what the list file says about it
      folderId: c.folderId ? String(c.folderId) : null,
      lists: (c.lists && typeof c.lists === 'object') ? Object.assign({}, c.lists) : {},
      clientId: c.clientId ? String(c.clientId) : '',
      fields: (c.fields && typeof c.fields === 'object') ? Object.assign({}, c.fields) : {},
      notes: String(c.notes || ''),
      status: String(c.status || 'active'),
      createdAt: Number(c.createdAt) || 0,
      lastOpenedAt: Number(c.lastOpenedAt) || 0,
      itemCount: (c.itemCount == null) ? null : Number(c.itemCount),
    };
    return _copy(_reg[key]);
  }
  function rrForgetCollection(key) {
    if (!_reg[key]) return false;
    if (_current === key) return false;   // never forget the open one
    delete _reg[key];
    return true;
  }

  // ── the full ID ──────────────────────────────────────────────────────────
  // 7-45 for collection 7, item 45; the plain 45 in the home collection.
  function rrFullId(invId, coll) {
    var id = (invId == null) ? '' : String(invId).trim();
    if (!id) return '';
    var c = (coll === undefined) ? rrCurrentCollection() : coll;
    if (!c || c.home || !c.number) return id;
    return c.number + (_C().fullIdSep || '-') + id;
  }
  function rrParseFullId(text) {
    var t = String(text == null ? '' : text).trim();
    var sep = _C().fullIdSep || '-';
    var m = t.match(new RegExp('^(\\d+)' + sep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\d+)$'));
    if (m) return { number: Number(m[1]), invId: m[2] };
    return { number: null, invId: t };
  }

  // ── 3. the stored copy, per collection ──────────────────────────────────
  function _suffix(coll) {
    var c = (coll === undefined) ? rrCurrentCollection() : coll;
    return (!c || c.home) ? '' : (_C().keySep || '@') + c.key;
  }
  // part: '' (the copy) or 'ts' (when it was taken). Home: lv_personal_cache /
  // lv_personal_cache_ts, exactly as always.
  function rrPersonalCacheKey(part, coll) {
    return (_C().cacheKey || 'lv_personal_cache') + (part ? '_' + part : '') + _suffix(coll);
  }
  function rrInvHwmKey(coll) { return (_C().hwmKey || 'lv_inv_hwm') + _suffix(coll); }
  // Signing out forgets every collection's stored copy, not only home's.
  function rrForgetCollectionCaches() {
    var ls = _ls(); if (!ls) return 0;
    var C = _C(), sep = C.keySep || '@', gone = [];
    var bases = [C.cacheKey || 'lv_personal_cache', (C.cacheKey || 'lv_personal_cache') + '_ts', C.hwmKey || 'lv_inv_hwm'];
    try {
      for (var i = 0; i < ls.length; i++) {
        var k = ls.key(i);
        if (k && bases.some(function (b) { return k.indexOf(b + sep) === 0; })) gone.push(k);
      }
      gone.forEach(function (k) { ls.removeItem(k); });
    } catch (e) {}
    return gone.length;
  }
  // The data in memory belongs to the open collection (or nobody has said).
  function rrDataIsCurrent() {
    var st = _state();
    if (!st) return true;
    return !st._dataSheetId || st._dataSheetId === st.personalSheetId;
  }
  // Mark the data in memory as belonging to a sheet (a load, a restored copy).
  function rrMarkDataSheet(sheetId) {
    var st = _state();
    if (st) st._dataSheetId = sheetId ? String(sheetId) : null;
  }
  // A read of `sheetId` whose answer arrives after the collection changed.
  function rrLoadIsStale(sheetId) {
    var st = _state();
    return !!(st && sheetId && st.personalSheetId && String(sheetId) !== String(st.personalSheetId));
  }

  // ── 4. switching waits for saves ────────────────────────────────────────
  var _inFlight = 0, _lastWriteEnd = 0;
  function rrTrackWrites(fn) {
    if (typeof fn !== 'function' || fn._rrTracked) return fn;
    var w = async function () {
      _inFlight++;
      try { return await fn.apply(this, arguments); }
      finally { _inFlight = Math.max(0, _inFlight - 1); _lastWriteEnd = Date.now(); }
    };
    w._rrTracked = true;
    w._rrInner = fn;
    return w;
  }
  function rrWritesInFlight() { return _inFlight; }
  function rrSwitchQuiet(now, quietMs) {
    var t = (now == null) ? Date.now() : now;
    var q = (quietMs == null) ? (_C().quietMs || 1500) : quietMs;
    if (_inFlight > 0) return false;
    if (_lastWriteEnd && t - _lastWriteEnd < q) return false;
    try { if (typeof root._rrBusyNow === 'function' && root._rrBusyNow()) return false; } catch (e) {}
    return true;
  }

  var _switching = false;
  var _STATE_LISTS = ['personalData', 'soldData', 'forSaleData', 'wantData', 'upgradeData', 'isData',
                      'scienceData', 'constructionData', 'mySetsData', 'partsData'];
  // contactsData is NOT here: Contacts always come from the HOME collection.
  function _emptyLists(st) {
    _STATE_LISTS.forEach(function (k) { st[k] = {}; });
    st.ephemeraData = { catalogs: {}, paper: {}, mockups: {}, other: {} };
    st.userDefinedTabs = [];
  }
  function _sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // opts: { waitMs, quietMs, pollMs, load (default true), repaint (default true) }
  async function rrSwitchCollection(key, opts) {
    opts = opts || {};
    var target = rrCollectionByKey(key);
    if (!target || (!target.home && !target.sheetId)) return { ok: false, why: 'unknown', msg: _word('unknown') };
    var cur = rrCurrentCollection();
    if (cur && cur.key === target.key) return { ok: true, same: true };
    if (_switching) return { ok: false, why: 'busy', msg: _word('busy') };
    _switching = true;
    try {
      var waitMs = (opts.waitMs == null) ? (_C().switchWaitMs || 20000) : opts.waitMs;
      var pollMs = (opts.pollMs == null) ? 100 : opts.pollMs;
      var until = Date.now() + waitMs;
      while (!rrSwitchQuiet(Date.now(), opts.quietMs)) {
        if (Date.now() >= until) {
          try { if (typeof showToast === 'function') showToast(_word('busy'), 4500, true); } catch (e) {}
          return { ok: false, why: 'busy', msg: _word('busy') };
        }
        await _sleep(pollMs);
      }
      var st = _state();
      // Keep the outgoing collection's copy under ITS key before anything moves.
      try { if (rrDataIsCurrent() && typeof _cachePersonalData === 'function') _cachePersonalData(); } catch (e) {}
      try { if (target.name && typeof showToast === 'function' && opts.repaint !== false) showToast(_word('opening', { name: rrCollectionLabel(target) }), 2500); } catch (e) {}
      _current = target.home ? null : target.key;
      if (st) {
        st.personalSheetId = target.sheetId || null;
        _emptyLists(st);
        // The empty lists belong to NO collection until a load or a restored
        // copy says whose they are — so nothing can save them over the new
        // collection's stored copy in the meantime (rrDataIsCurrent → false).
        st._dataSheetId = '#switching';
      }
      try { var ls = _ls(); if (ls) ls.setItem(_C().currentKey || 'lv_current_collection', target.key); } catch (e) {}
      try { if (typeof rrResetIssuedInvIds === 'function') rrResetIssuedInvIds(); } catch (e) {}
      try { if (typeof rrDriveUseRoot === 'function') rrDriveUseRoot(target.key); } catch (e) {}   // the folder caches, per collection
      try { rrApplyListSwitches(); } catch (e) {}   // v0.9.2071: this collection's lists
      if (opts.load !== false && typeof loadPersonalData === 'function') {
        try { await loadPersonalData(); } catch (e) { console.warn('[Collections] load after switch:', e && e.message); }
      }
      if (opts.repaint !== false) {
        try { if (typeof buildApp === 'function') buildApp(); } catch (e) {}
      }
      return { ok: true };
    } finally {
      _switching = false;
    }
  }
  // "7 – Hale" (the home collection: its own name, or nothing).
  function rrCollectionLabel(c) {
    var x = (c === undefined) ? rrCurrentCollection() : c;
    if (!x) return '';
    if (x.home || !x.number) return x.name || '';
    return x.number + ' – ' + (x.name || '');
  }
  // The collection this device last had open (Release 5 opens it after the
  // list is loaded). Home when it is not known here.
  function rrRememberedCollectionKey() {
    try {
      var ls = _ls();
      var k = ls && ls.getItem(_C().currentKey || 'lv_current_collection');
      return (k && _reg[k]) ? k : _homeKey();
    } catch (e) { return _homeKey(); }
  }

  // ── 5. photos: the open collection's folder ─────────────────────────────
  function rrPhotoRootId() { var c = rrCurrentCollection(); return (c && c.photoRootId) || null; }
  function rrSoldPhotoRootId() { var c = rrCurrentCollection(); return (c && c.soldPhotoRootId) || null; }

  // ── numbering checked against the sheet ─────────────────────────────────
  // Numbers this device has handed out (per sheet) and not yet seen safely on
  // the sheet. ONLY these are checked: a row that is MOVED keeps its number on
  // purpose (a type switch, a returned sale) and must never be renumbered.
  var _minted = {};            // sheetId -> { id: true }
  var _remap = {};             // sheetId + '|' + old -> new
  var _readCache = {};         // sheetId -> { at, read }   (a burst of saves shares one read)
  var _tabsCache = {};         // sheetId -> { at, titles: {title: true} }
  var _READ_FRESH_MS = 5000, _TABS_FRESH_MS = 10 * 60 * 1000;

  function rrNoteMinted(id) {
    var st = _state();
    var sid = st && st.personalSheetId;
    var n = parseInt(id, 10);
    if (!sid || !(n > 0)) return;
    (_minted[sid] = _minted[sid] || {})[String(n)] = true;
  }
  function _isMinted(sid, id) { return !!(_minted[sid] && _minted[sid][String(id)]); }
  function _unMint(sid, id) { if (_minted[sid]) delete _minted[sid][String(id)]; }
  function rrInvIdNow(id, sheetId) {
    var st = _state();
    var sid = sheetId || (st && st.personalSheetId) || '';
    var k = sid + '|' + String(id);
    return Object.prototype.hasOwnProperty.call(_remap, k) ? _remap[k] : (id == null ? '' : String(id));
  }

  function _colLetter(i) {
    var s = '', n = i + 1;
    while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
    return s;
  }
  function _tabCol(def) {
    if (def.col != null) return def.col;
    try {
      if (def.field && typeof PERSONAL_FIELD_INDEX !== 'undefined' && PERSONAL_FIELD_INDEX[def.field] != null) return PERSONAL_FIELD_INDEX[def.field];
    } catch (e) {}
    return -1;
  }
  function _birthDef(tab) {
    var defs = _C().birthTabs || [];
    for (var i = 0; i < defs.length; i++) if (defs[i].tab === tab) return { def: defs[i], idx: i };
    return null;
  }
  function _online() {
    try { if (root._offlineMode) return false; } catch (e) {}
    try { if (typeof navigator !== 'undefined' && navigator.onLine === false) return false; } catch (e) {}
    return true;
  }
  async function _sheetTabs(sid) {
    var c = _tabsCache[sid];
    if (c && Date.now() - c.at < _TABS_FRESH_MS) return c.titles;
    var titles = null;
    try {
      var tok = (typeof accessToken !== 'undefined') ? accessToken : root.accessToken;
      var res = await fetch('https://sheets.googleapis.com/v4/spreadsheets/' + sid + '?fields=sheets.properties.title',
        { headers: { Authorization: 'Bearer ' + tok } });
      var j = await res.json();
      if (j && Array.isArray(j.sheets)) {
        titles = {};
        j.sheets.forEach(function (s) { if (s && s.properties && s.properties.title) titles[s.properties.title] = true; });
      }
    } catch (e) {}
    if (titles) _tabsCache[sid] = { at: Date.now(), titles: titles };
    return titles;
  }
  // Every number on the sheet: { max, at: { id: [{tab, idx, row}] } } — at
  // lists only the tabs where numbers are BORN. null when it could not be read.
  async function _readNumbers(sid, fresh) {
    var c = _readCache[sid];
    if (!fresh && c && Date.now() - c.at < _READ_FRESH_MS) return c.read;
    if (typeof sheetsBatchGet !== 'function') return null;
    var titles = await _sheetTabs(sid);
    if (!titles) return null;
    var C = _C(), plan = [];
    (C.birthTabs || []).forEach(function (d, i) { var col = _tabCol(d); if (col >= 0 && titles[d.tab]) plan.push({ tab: d.tab, col: col, birth: true, idx: i }); });
    (C.echoTabs || []).forEach(function (d) { var col = _tabCol(d); if (col >= 0 && titles[d.tab]) plan.push({ tab: d.tab, col: col, birth: false, idx: 99 }); });
    if (!plan.length) return null;
    var rangesOf = function (pl) { return pl.map(function (p) { var L = _colLetter(p.col); return "'" + p.tab.replace(/'/g, "''") + "'!" + L + '3:' + L; }); };
    var res, vrs;
    try { res = await sheetsBatchGet(sid, rangesOf(plan)); } catch (e) { res = null; }
    vrs = res && res.valueRanges;
    // One tab narrower than its number column (an old layout) makes Google
    // refuse the WHOLE read. Then read My Collection's numbers alone — the tab
    // nearly every new number is born on — rather than check nothing.
    if (!Array.isArray(vrs) && plan.length > 1) {
      plan = plan.filter(function (p) { return p.birth && p.idx === 0; });
      if (!plan.length) return null;
      try { res = await sheetsBatchGet(sid, rangesOf(plan)); } catch (e) { res = null; }
      vrs = res && res.valueRanges;
    }
    if (!Array.isArray(vrs)) return null;
    var out = { max: 0, at: {} };
    plan.forEach(function (p, i) {
      var vals = (vrs[i] && vrs[i].values) || [];
      vals.forEach(function (r, j) {
        var n = parseInt(r && r[0], 10);
        if (!(n > 0) || String(n) !== String(r[0]).trim()) return;
        if (n > out.max) out.max = n;
        if (p.birth) (out.at[String(n)] = out.at[String(n)] || []).push({ tab: p.tab, idx: p.idx, row: j + 3 });
      });
    });
    _readCache[sid] = { at: Date.now(), read: out };
    return out;
  }
  function _bumpHwm(n) {
    try {
      var ls = _ls(); if (!ls) return;
      var k = rrInvHwmKey();
      var h = parseInt(ls.getItem(k), 10);
      if (isNaN(h) || n > h) ls.setItem(k, String(n));
    } catch (e) {}
  }
  function _localHwm() { try { var ls = _ls(); var h = parseInt(ls && ls.getItem(rrInvHwmKey()), 10); return isNaN(h) ? 0 : h; } catch (e) { return 0; } }
  function _noteRemap(sid, oldId, newId, tellUser) {
    _remap[sid + '|' + oldId] = String(newId);
    _unMint(sid, oldId);
    try { if (tellUser && typeof showToast === 'function') showToast(_word('renumbered', { old: oldId, now: newId }), 6000); } catch (e) {}
    // The screen (and the phone's stored copy) hold the old number until the
    // sheet is read again — so read it: the full read, not the throttled
    // start-up one, and only while this sheet is still the open one.
    try {
      clearTimeout(root._rrRenumberRefresh);
      root._rrRenumberRefresh = setTimeout(function () {
        try {
          if (rrLoadIsStale(sid)) return;
          var go = (typeof _loadPersonalFromSheets === 'function') ? _loadPersonalFromSheets(sid)
                 : (typeof loadPersonalData === 'function' ? loadPersonalData() : null);
          Promise.resolve(go).then(function () {
            try { if (typeof _cachePersonalData === 'function') _cachePersonalData(); } catch (e) {}
            try { if (typeof buildApp === 'function') buildApp(); } catch (e) {}
          }).catch(function () {});
        } catch (e) {}
      }, 1200);
    } catch (e) {}
  }

  // BEFORE a row is appended (sheets.js sheetsAppend). Renumbers, in place, a
  // just-handed-out number that is already on the sheet. Returns the plan the
  // after-check needs, or null (nothing of ours to check). Never throws: a
  // check that cannot run leaves the save exactly as it was.
  async function rrInvGuardBefore(sid, range, values) {
    try {
      if (!sid || !Array.isArray(values) || !values.length || !_minted[sid]) return null;
      var tab = String(range || '').split('!')[0].replace(/^'|'$/g, '');
      var bd = _birthDef(tab); if (!bd) return null;
      var col = _tabCol(bd.def); if (col < 0) return null;
      var mine = [];
      values.forEach(function (r, i) {
        var v = r && r[col];
        if (v != null && _isMinted(sid, v)) mine.push(i);
      });
      if (!mine.length || !_online()) return null;
      var read = await _readNumbers(sid, false);
      if (!read) return { tab: tab, col: col, idx: bd.idx, rows: mine, ids: mine.map(function (i) { return String(values[i][col]); }) };
      var next = Math.max(read.max, _localHwm());
      var used = {};
      mine.forEach(function (i) {
        var id = String(values[i][col]);
        if (read.at[id] || used[id]) {
          var fresh = String(++next);
          values[i][col] = fresh;
          _noteRemap(sid, id, fresh, false);
          (_minted[sid] = _minted[sid] || {})[fresh] = true;
          _bumpHwm(next);
          id = fresh;
        }
        used[id] = true;
      });
      return { tab: tab, col: col, idx: bd.idx, rows: mine, ids: mine.map(function (i) { return String(values[i][col]); }) };
    } catch (e) { return null; }
  }

  // AFTER the append landed at firstRow. Reads the numbers back; when one of
  // ours is also on an EARLIER row (another device saved first), ours — the
  // newer — moves to the next free number. Every device judges by the same
  // order (tab, then row), so exactly one of two clashing rows moves.
  async function rrInvGuardAfter(sid, plan, firstRow) {
    if (!plan || !sid) return [];
    var changed = [];
    try {
      if (!(firstRow > 0) || !_online()) return changed;
      var tries = Math.max(1, _C().maxReadBacks || 3);
      for (var t = 0; t < tries; t++) {
        var read = await _readNumbers(sid, true);
        if (!read) return changed;
        var moved = false;
        for (var k = 0; k < plan.rows.length; k++) {
          var id = plan.ids[k];
          var myRow = firstRow + plan.rows[k];
          var hits = read.at[id] || [];
          var earlier = hits.some(function (h) {
            if (h.tab === plan.tab && h.row === myRow) return false;
            return (h.idx < plan.idx) || (h.idx === plan.idx && h.row < myRow);
          });
          if (!earlier) continue;
          var fresh = String(Math.max(read.max, _localHwm()) + 1);
          var L = _colLetter(plan.col);
          var rng = "'" + plan.tab.replace(/'/g, "''") + "'!" + L + myRow;
          if (typeof sheetsUpdate !== 'function') return changed;
          await sheetsUpdate(sid, rng, [[fresh]]);
          _bumpHwm(Number(fresh));
          _noteRemap(sid, id, fresh, true);
          changed.push({ from: id, to: fresh, row: myRow });
          plan.ids[k] = fresh;
          read.max = Number(fresh);
          moved = true;
        }
        if (!moved) break;
      }
      plan.ids.forEach(function (id) { _unMint(sid, id); });
      // the burst cache now knows our rows
      var c = _readCache[sid];
      if (c && c.read) plan.ids.forEach(function (id, k) {
        (c.read.at[id] = c.read.at[id] || []).push({ tab: plan.tab, idx: plan.idx, row: firstRow + plan.rows[k] });
        var n = Number(id); if (n > c.read.max) c.read.max = n;
      });
    } catch (e) { console.warn('[Collections] number read-back:', e && e.message); }
    return changed;
  }

  // ═════════════════════════════════════════════════════════════════════════
  // v0.9.2071 — RELEASE 5: THE LIST OF COLLECTIONS, MAKING ONE, ITS LISTS
  // Settings and words: RR_COLL_UI (config.js). Screens: collections-ui.js.
  // ═════════════════════════════════════════════════════════════════════════
  function _U() { return (typeof RR_COLL_UI !== 'undefined' && RR_COLL_UI) || root.RR_COLL_UI || { lists: [], starts: [], words: {} }; }
  function _uw(k, vars) {
    var w = String((_U().words || {})[k] || '');
    Object.keys(vars || {}).forEach(function (v) { w = w.split('{' + v + '}').join(String(vars[v])); });
    return w;
  }
  // A DEVICE setting that belongs to the open collection (the shareable For
  // Sale sheet's id, …): home keeps the plain key, another collection key@c.
  function rrCollKey(base) { return String(base) + _suffix(); }

  // ── the list switches ───────────────────────────────────────────────────
  // ONE rule: home has every list; another collection has a list unless its
  // switch says false. Off = hidden everywhere, never deleted.
  function rrListOn(listKey, coll) {
    var c = (coll === undefined) ? rrCurrentCollection() : coll;
    if (!c || c.home) return true;
    return !(c.lists && c.lists[listKey] === false);
  }
  function rrListForPage(page) {
    var L = _U().lists || [];
    for (var i = 0; i < L.length; i++) if (L[i].page === page) return L[i];
    return null;
  }
  // THE door's question (showPage, app.js): may this page open here?
  function rrPageAllowed(page) {
    var def = rrListForPage(page === 'want' ? 'upgrade' : page);
    return !def || rrListOn(def.key);
  }
  // THE door for ADDING (wizard.js renderWizardStep, wizard-save.js, the
  // upgrade picker): every add path — buttons, Research, item cards — ends in
  // the wizard, so a list that is off can never take an item, even through a
  // button the stylesheet below does not know about.
  function rrAddAllowed(tab) {
    if (rrPageAllowed(tab)) return true;
    var def = rrListForPage(tab === 'want' ? 'upgrade' : tab);
    try { if (typeof showToast === 'function') showToast(_uw('addOff', { list: def ? def.word : tab }), 3500); } catch (e) {}
    return false;
  }
  // Hide every way into a list that is off: one stylesheet built from the
  // list's selectors (RR_COLL_UI.lists[].hide), switched by a class on <body>.
  function rrApplyListSwitches() {
    try {
      if (typeof document === 'undefined' || !document.body) return;
      var L = _U().lists || [];
      if (!document.getElementById('rr-list-switch-css')) {
        var css = L.map(function (d) {
          return (d.hide || []).map(function (sel) { return 'body.rr-list-off-' + d.key + ' ' + sel; }).join(',\n') + ' { display: none !important; }';
        }).join('\n');
        var st = document.createElement('style'); st.id = 'rr-list-switch-css'; st.textContent = css;
        document.head.appendChild(st);
      }
      L.forEach(function (d) { document.body.classList.toggle('rr-list-off-' + d.key, !rrListOn(d.key)); });
    } catch (e) {}
  }

  // ── the business's own collection fields (an ACCOUNT setting) ───────────
  // ONE reader, ONE writer. [{id, name, type}] — values live on each collection.
  function rrCollFields() {
    try {
      var k = _U().fieldsKey || 'lv_coll_fields';
      var raw = (typeof rrPrefRead === 'function') ? rrPrefRead(k) : (_ls() && _ls().getItem(k));
      var a = JSON.parse(raw || '[]');
      return Array.isArray(a) ? a.filter(function (f) { return f && f.id && f.name; }) : [];
    } catch (e) { return []; }
  }
  function rrCollFieldsSave(arr) {
    var types = (_U().fieldTypes || []).map(function (t) { return t.id; });
    var out = (Array.isArray(arr) ? arr : []).map(function (f) {
      return { id: String(f.id || ('f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5))), name: String(f.name || '').trim().slice(0, 40), type: types.indexOf(f.type) >= 0 ? f.type : 'text' };
    }).filter(function (f) { return f.name; }).slice(0, _U().fieldsMax || 12);
    var k = _U().fieldsKey || 'lv_coll_fields';
    if (typeof rrPrefWrite === 'function') rrPrefWrite(k, JSON.stringify(out)); else if (_ls()) _ls().setItem(k, JSON.stringify(out));
    return out;
  }

  // ── the list file: rail-roster-collections.json beside the settings file ──
  // { v:1, next: <the next number>, items: { key: {key, number, name, status,
  //   sheetId, folderId, photoRootId, soldPhotoRootId, lists, clientId, fields,
  //   notes, createdAt, lastOpenedAt, itemCount, at} } }
  // Every change READS the file fresh, changes it and writes it back, so two
  // devices' changes to different collections never undo each other.
  var _fileId = null, _fileData = null;
  function _emptyFile() { return { v: 1, next: 1, items: {} }; }
  function _tok() { try { return (typeof accessToken !== 'undefined') ? accessToken : root.accessToken; } catch (e) { return root.accessToken; } }
  async function _tracked(fn) {
    _inFlight++;
    try { return await fn(); } finally { _inFlight = Math.max(0, _inFlight - 1); _lastWriteEnd = Date.now(); }
  }
  async function _fileFind() {
    if (_fileId) return _fileId;
    var q = encodeURIComponent("name='" + (_U().fileName || 'rail-roster-collections.json') + "' and trashed=false and 'me' in owners");
    var res = await driveRequest('GET', '/files?q=' + q + '&fields=files(id,name)&spaces=drive');
    _fileId = (res && res.files && res.files.length) ? res.files[0].id : null;
    return _fileId;
  }
  // { ok, data } — ok:false means the file is THERE and could not be read:
  // never write then, or collections we cannot see would be replaced.
  async function rrCollectionsFileRead() {
    try {
      var id = await _fileFind();
      if (!id) return { ok: true, data: _emptyFile() };
      var r = await _tracked(function () { return fetch('https://www.googleapis.com/drive/v3/files/' + id + '?alt=media', { headers: { Authorization: 'Bearer ' + _tok() } }); });
      if (!r.ok) return { ok: false, data: null };
      var j = null;
      try { j = await r.json(); } catch (e) { j = null; }
      var d = (j && typeof j === 'object' && j.items && typeof j.items === 'object') ? j : _emptyFile();
      d.next = Math.max(1, Number(d.next) || 1);
      _fileData = d;
      return { ok: true, data: d };
    } catch (e) { return { ok: false, data: null }; }
  }
  async function _fileWrite(d) {
    var body = JSON.stringify(d);
    var id = await _fileFind();
    return _tracked(async function () {
      if (id) {
        var w = await fetch('https://www.googleapis.com/upload/drive/v3/files/' + id + '?uploadType=media',
          { method: 'PATCH', headers: { Authorization: 'Bearer ' + _tok(), 'Content-Type': 'application/json' }, body: body });
        if (!w.ok) throw new Error('collections list write failed: HTTP ' + w.status);
      } else {
        if (typeof driveEnsureSetup === 'function') await driveEnsureSetup();
        var parent = (typeof driveCache !== 'undefined' && driveCache.vaultId) || null;
        var meta = { name: _U().fileName || 'rail-roster-collections.json', mimeType: 'application/json' };
        if (parent) meta.parents = [parent];
        var form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
        form.append('file', new Blob([body], { type: 'application/json' }));
        var c = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
          { method: 'POST', headers: { Authorization: 'Bearer ' + _tok() }, body: form });
        if (!c.ok) throw new Error('collections list create failed: HTTP ' + c.status);
        try { var cj = await c.json(); _fileId = cj && cj.id ? cj.id : null; } catch (e) {}
      }
      _fileData = d;
      return d;
    });
  }
  // Read fresh → change → write. The change gets the data and may return false
  // to write nothing. Throws when the file could not be read.
  async function rrCollectionsFileUpdate(change) {
    var got = await rrCollectionsFileRead();
    if (!got.ok) throw new Error('collections list could not be read');
    var d = got.data;
    if (change(d) === false) return d;
    return _fileWrite(d);
  }
  function rrCollectionsData() { return _fileData ? _copy(_fileData) : null; }
  function _nextNumber(d) {
    var n = Math.max(1, Number(d.next) || 1);
    Object.keys(d.items || {}).forEach(function (k) { var x = Number(d.items[k].number) || 0; if (x >= n) n = x + 1; });
    return n;
  }
  function _registerEntry(e) {
    if (!e || e.status !== 'active' || !e.sheetId) return false;
    try { rrRegisterCollection(e); return true; } catch (er) { console.warn('[Collections] not listed:', e.key, er && er.message); return false; }
  }
  // At start: read the list, list every active collection on this device.
  async function rrCollectionsLoad() {
    var got = await rrCollectionsFileRead();
    if (!got.ok) return null;
    Object.keys(got.data.items || {}).forEach(function (k) { _registerEntry(got.data.items[k]); });
    return _copy(got.data);
  }
  function _fill(tpl, n, name) { return String(tpl).split('{n}').join(String(n)).split('{name}').join(String(name)); }

  // ── making a collection ─────────────────────────────────────────────────
  // 1. reserve a NUMBER in the list file (read back: if another device took the
  //    same number first, ours moves on — exactly one of two moves);
  // 2. the Drive folder "7 – Hale" (with Photos + Sold Photos) under Collections;
  // 3. its own sheet with every tab, moved into that folder;
  // 4. the sheet and the folder carry the collection's key + number inside
  //    themselves (Drive appProperties); then it is listed and ready.
  // Every id is written to the list the moment it exists, so a failure part
  // way through is FINISHED later (rrFinishCollection) — never made twice.
  var _making = false;
  async function rrCreateCollection(opts) {
    opts = opts || {};
    var name = String(opts.name || '').trim().slice(0, _U().nameMax || 60);
    if (!name) return { ok: false, why: 'name', msg: _uw('nameNeeded') };
    if (_making) return { ok: false, why: 'busy', msg: _uw('busy') };
    _making = true;
    try {
      var start = (_U().starts || []).filter(function (s) { return s.id === opts.startId; })[0] || (_U().starts || [])[0] || { lists: {} };
      var key = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      var now = Date.now();
      await rrCollectionsFileUpdate(function (d) {
        var num = _nextNumber(d);
        d.items[key] = { key: key, number: num, name: name, status: 'creating', startId: start.id || '',
          lists: Object.assign({}, start.lists || {}), clientId: String(opts.clientId || ''), notes: String(opts.notes || ''),
          fields: {}, createdAt: now, lastOpenedAt: now, itemCount: 0, at: now };
        d.next = num + 1;
      });
      for (var t = 0; t < 3; t++) {
        var got = await rrCollectionsFileRead();
        if (!got.ok) break;
        var mine = got.data.items[key];
        if (!mine) throw new Error('the new collection is missing from the list');
        var clash = Object.keys(got.data.items).some(function (k) {
          var o = got.data.items[k];
          return k !== key && Number(o.number) === Number(mine.number) && ((o.createdAt || 0) < mine.createdAt || ((o.createdAt || 0) === mine.createdAt && k < key));
        });
        if (!clash) break;
        await rrCollectionsFileUpdate(function (d) { var n = _nextNumber(d); d.items[key].number = n; d.items[key].at = Date.now(); d.next = n + 1; });
      }
      return await rrFinishCollection(key);
    } catch (e) {
      console.warn('[Collections] make:', e && e.message);
      return { ok: false, why: 'failed', msg: _uw('newFailed') };
    } finally { _making = false; }
  }
  async function _setEntry(key, patch) {
    return rrCollectionsFileUpdate(function (d) {
      if (!d.items[key]) return false;
      Object.assign(d.items[key], patch, { at: Date.now() });
    });
  }
  async function rrFinishCollection(key) {
    var got = await rrCollectionsFileRead();
    if (!got.ok) return { ok: false, why: 'failed', msg: _uw('newFailed') };
    var e = got.data.items[key];
    if (!e) return { ok: false, why: 'unknown', msg: _uw('newFailed') };
    try {
      var U = _U();
      if (typeof driveEnsureSetup === 'function') await driveEnsureSetup();
      var vault = (typeof driveCache !== 'undefined' && driveCache.vaultId) || null;
      if (!vault) throw new Error('The Rail Roster folder is not ready');
      if (!e.folderId) {
        var parent = await driveFindOrCreateFolder(U.folderName || 'Collections', vault);
        var fid = await driveFindOrCreateFolder(_fill(U.folderTitle || '{n} – {name}', e.number, e.name), parent);
        await _setEntry(key, { folderId: fid }); e.folderId = fid;
      }
      if (!e.photoRootId) { var p = await driveFindOrCreateFolder(U.photosName || 'Photos', e.folderId); await _setEntry(key, { photoRootId: p }); e.photoRootId = p; }
      if (!e.soldPhotoRootId) { var sp = await driveFindOrCreateFolder(U.soldPhotosName || 'Sold Photos', e.folderId); await _setEntry(key, { soldPhotoRootId: sp }); e.soldPhotoRootId = sp; }
      if (!e.sheetId) {
        var res = await _tracked(function () {
          return fetch('https://sheets.googleapis.com/v4/spreadsheets', {
            method: 'POST', headers: { Authorization: 'Bearer ' + _tok(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ properties: { title: _fill(U.sheetTitle || 'The Rail Roster – {n} {name}', e.number, e.name) },
              sheets: [{ properties: { title: 'My Collection', gridProperties: { rowCount: 1000, columnCount: Math.max(40, (typeof PERSONAL_HEADERS !== 'undefined' ? PERSONAL_HEADERS.length : 40) + 3) } } }] }) });
        });
        var data = await res.json().catch(function () { return {}; });
        if (!res.ok || !data.spreadsheetId) throw new Error('the sheet could not be made (' + ((data.error && data.error.message) || res.status) + ')');
        await _setEntry(key, { sheetId: data.spreadsheetId }); e.sheetId = data.spreadsheetId;
        // into the collection's folder (a move — the file keeps its id)
        try {
          var cur = await driveRequest('GET', '/files/' + e.sheetId + '?fields=parents');
          var from = (cur && cur.parents || []).join(',');
          await driveRequest('PATCH', '/files/' + e.sheetId + '?addParents=' + e.folderId + (from ? '&removeParents=' + from : '') + '&fields=id', {});
        } catch (eMv) { console.warn('[Collections] sheet move:', eMv && eMv.message); }
      }
      if (!e.sheetReady) {
        if (typeof initPersonalSheet === 'function') await initPersonalSheet(e.sheetId);
        await _setEntry(key, { sheetReady: true }); e.sheetReady = true;
      }
      // the sheet and the folder say whose they are (the app finds them by id, never by name)
      var props = { appProperties: { rrCollectionKey: key, rrCollectionNumber: String(e.number) } };
      try { await driveRequest('PATCH', '/files/' + e.sheetId + '?fields=id', props); } catch (eP) {}
      try { await driveRequest('PATCH', '/files/' + e.folderId + '?fields=id', props); } catch (eP2) {}
      var fin = await rrCollectionsFileUpdate(function (d) { if (!d.items[key]) return false; d.items[key].status = 'active'; d.items[key].at = Date.now(); });
      var entry = fin.items[key];
      _registerEntry(entry);
      return { ok: true, key: key, collection: rrCollectionByKey(key) };
    } catch (er) {
      console.warn('[Collections] finish:', er && er.message);
      return { ok: false, why: 'failed', key: key, msg: _uw('newFailed') };
    }
  }

  // ── changing one ────────────────────────────────────────────────────────
  // patch: { name, lists, clientId, fields, notes }. A new name renames the
  // folder AND the sheet (found by id, never by name).
  async function rrUpdateCollection(key, patch) {
    var c = _reg[key];
    if (!c) return { ok: false, why: 'unknown' };
    patch = patch || {};
    var clean = {};
    if (patch.name != null) { var nm = String(patch.name).trim().slice(0, _U().nameMax || 60); if (!nm) return { ok: false, why: 'name', msg: _uw('nameNeeded') }; clean.name = nm; }
    if (patch.lists) { clean.lists = {}; (_U().lists || []).forEach(function (d) { if (d.key in patch.lists) clean.lists[d.key] = patch.lists[d.key] !== false; }); clean.lists = Object.assign({}, c.lists || {}, clean.lists); }
    if (patch.clientId != null) clean.clientId = String(patch.clientId);
    if (patch.fields) clean.fields = Object.assign({}, c.fields || {}, patch.fields);
    if (patch.notes != null) clean.notes = String(patch.notes);
    try {
      if (clean.name && clean.name !== c.name) {
        var U = _U();
        await driveRequest('PATCH', '/files/' + c.folderId + '?fields=id', { name: _fill(U.folderTitle || '{n} – {name}', c.number, clean.name) });
        await driveRequest('PATCH', '/files/' + c.sheetId + '?fields=id', { name: _fill(U.sheetTitle || 'The Rail Roster – {n} {name}', c.number, clean.name) });
      }
      var d = await rrCollectionsFileUpdate(function (dd) { if (!dd.items[key]) return false; Object.assign(dd.items[key], clean, { at: Date.now() }); });
      _registerEntry(d.items[key]);
      if (_current === key) rrApplyListSwitches();
      return { ok: true, collection: rrCollectionByKey(key) };
    } catch (e) {
      console.warn('[Collections] update:', e && e.message);
      return { ok: false, why: 'failed', msg: _uw('saveFailed') };
    }
  }
  // When a collection is opened: most-recent-first order + its item count.
  // Best effort — never in the way of anything.
  async function rrTouchCollection(key, itemCount) {
    if (!_reg[key]) return;
    _reg[key].lastOpenedAt = Date.now();
    if (itemCount != null) _reg[key].itemCount = itemCount;
    try {
      await rrCollectionsFileUpdate(function (d) {
        if (!d.items[key]) return false;
        d.items[key].lastOpenedAt = _reg[key].lastOpenedAt;
        if (itemCount != null) d.items[key].itemCount = itemCount;
      });
    } catch (e) {}
  }

  var api = {
    rrIsHome: rrIsHome, rrHomeSheet: rrHomeSheet, rrSetHomeSheet: rrSetHomeSheet,
    rrCurrentCollection: rrCurrentCollection, rrCollectionByKey: rrCollectionByKey,
    rrCollectionForSheet: rrCollectionForSheet, rrCollections: rrCollections,
    rrRegisterCollection: rrRegisterCollection, rrForgetCollection: rrForgetCollection,
    rrFullId: rrFullId, rrParseFullId: rrParseFullId, rrCollectionLabel: rrCollectionLabel,
    rrPersonalCacheKey: rrPersonalCacheKey, rrInvHwmKey: rrInvHwmKey, rrForgetCollectionCaches: rrForgetCollectionCaches,
    rrDataIsCurrent: rrDataIsCurrent, rrMarkDataSheet: rrMarkDataSheet, rrLoadIsStale: rrLoadIsStale,
    rrTrackWrites: rrTrackWrites, rrWritesInFlight: rrWritesInFlight, rrSwitchQuiet: rrSwitchQuiet,
    rrSwitchCollection: rrSwitchCollection, rrRememberedCollectionKey: rrRememberedCollectionKey,
    rrPhotoRootId: rrPhotoRootId, rrSoldPhotoRootId: rrSoldPhotoRootId,
    rrNoteMinted: rrNoteMinted, rrInvIdNow: rrInvIdNow,
    rrInvGuardBefore: rrInvGuardBefore, rrInvGuardAfter: rrInvGuardAfter,
    // v0.9.2071 (release 5)
    rrCollKey: rrCollKey, rrListOn: rrListOn, rrListForPage: rrListForPage, rrPageAllowed: rrPageAllowed, rrAddAllowed: rrAddAllowed,
    rrApplyListSwitches: rrApplyListSwitches, rrCollFields: rrCollFields, rrCollFieldsSave: rrCollFieldsSave,
    rrCollectionsFileRead: rrCollectionsFileRead, rrCollectionsFileUpdate: rrCollectionsFileUpdate,
    rrCollectionsData: rrCollectionsData, rrCollectionsLoad: rrCollectionsLoad,
    rrCreateCollection: rrCreateCollection, rrFinishCollection: rrFinishCollection,
    rrUpdateCollection: rrUpdateCollection, rrTouchCollection: rrTouchCollection,
  };
  Object.keys(api).forEach(function (k) { root[k] = api[k]; });
  // test hook: forget everything this file holds (never called by the app)
  root._rrCollectionsReset = function () {
    _reg = {}; _current = null; _homeSheet = null; _inFlight = 0; _lastWriteEnd = 0; _switching = false;
    _minted = {}; _remap = {}; _readCache = {}; _tabsCache = {};
    _fileId = null; _fileData = null; _making = false;
  };
})(typeof window !== 'undefined' ? window : globalThis);
