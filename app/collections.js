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
  function _copy(c) { return c ? Object.assign({}, c) : null; }

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
  };
  Object.keys(api).forEach(function (k) { root[k] = api[k]; });
  // test hook: forget everything this file holds (never called by the app)
  root._rrCollectionsReset = function () {
    _reg = {}; _current = null; _homeSheet = null; _inFlight = 0; _lastWriteEnd = 0; _switching = false;
    _minted = {}; _remap = {}; _readCache = {}; _tabsCache = {};
  };
})(typeof window !== 'undefined' ? window : globalThis);
