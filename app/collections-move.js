// ═══════════════════════════════════════════════════════════════════════════
// collections-move.js — v0.9.2077, TRR Pro release 6: MOVING ITEMS BETWEEN
// COLLECTIONS
// ═══════════════════════════════════════════════════════════════════════════
// Design agreed with Brad 2026-10-28 (PLAN_2026-10-28_TRR_PRO.md, Section 1:
// "Move items between collections"); the build plan PLAN_2026-10-30_TRR_PRO_R6.md
// ([stated] Brad 2026-10-30 22:05 CT "yes").
//
// ONE engine, rrMoveRun(move), and the agreed SAFE ORDER. The move remembers,
// in the collections list file, the step it does NEXT — written down before
// that step starts — so a move that stops part way (a dropped connection, a
// closed app) waits under "Unfinished moves" and Finish carries on from there.
// Every step looks first and never does its work twice:
//   start    back up the old collection's sheet; hand out the new numbers
//            (written down first); add the rows to the new sheet, each with
//            the move's tag in "Transferred From" so a retry finds it
//   added    read back — every row is there, with its final number
//   checked  each copy's photo folder MOVED (same Drive ID, every link works)
//            into the new collection's Photos, renamed to the new number
//   photos   the old rows say "Transferred To" — hidden everywhere, never
//            deleted; a For Sale listing comes off the old list
//   marked   one Movement Log line on each side
// then the record is cleared. A switch of collection waits for a move
// (rrHoldSwitch, collections.js).
//
// ON only through RR_COLL_UI.feature (the owners first). Every word:
// RR_COLL_MOVE (config.js).
// ═══════════════════════════════════════════════════════════════════════════
/* eslint-disable no-var */
(function (root) {
  'use strict';

  function M() { return (typeof RR_COLL_MOVE !== 'undefined' && RR_COLL_MOVE) || root.RR_COLL_MOVE || { steps: [], words: {}, inbox: {} }; }
  function W(k, vars) {
    var w = M().words || {};
    var t = k.indexOf('.') > 0 ? (w[k.split('.')[0]] || {})[k.split('.')[1]] : w[k];
    t = String(t || '');
    Object.keys(vars || {}).forEach(function (v) { t = t.split('{' + v + '}').join(String(vars[v])); });
    return t;
  }
  function esc(s) {
    if (typeof rrEsc === 'function') return rrEsc(s);
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function jsArg(s) { return (typeof rrJsArg === 'function') ? rrJsArg(s) : JSON.stringify(String(s)); }
  function toast(m, ms, bad) { try { if (typeof showToast === 'function') showToast(m, ms || 3500, !!bad); } catch (e) {} }
  function st() { try { return (typeof state !== 'undefined' && state) || root.state || {}; } catch (e) { return root.state || {}; } }
  function _clone(o) { return JSON.parse(JSON.stringify(o)); }
  function _offline() {
    try { if (root._offlineMode) return true; } catch (e) {}
    try { if (typeof navigator !== 'undefined' && navigator.onLine === false) return true; } catch (e) {}
    return false;
  }
  function _label(c) {
    if (!c) return '';
    if (c.home) return (M().inbox && M().inbox.home) || 'My Collection';
    return (typeof rrCollectionLabel === 'function') ? rrCollectionLabel(c) : (c.number + ' – ' + c.name);
  }
  function _today() { return rrToday(); }   // THE one local today (config.js)
  function _col(field) { return PERSONAL_FIELD_INDEX[field]; }
  function _L(field) { return personalColLetter(field); }
  function _lastL() { return personalColLetter(PERSONAL_SCHEMA[PERSONAL_SCHEMA.length - 1].field); }
  function _bare(v) { return String(v == null ? '' : v).replace(/^'/, '').trim(); }
  function _tagOf(text) {
    var m = String(text || '').match(M().markRe || /\[m:([A-Za-z0-9_-]+):([^\]]*)\]/);
    return m ? { move: m[1], inv: m[2] } : null;
  }

  // ── who may move, and where to ─────────────────────────────────────────
  function rrMoveOn() {
    try { return typeof rrCollUiOn === 'function' && rrCollUiOn() && rrMoveTargets().length > 0; } catch (e) { return false; }
  }
  // Every active collection except the open one (home included when another is open).
  function rrMoveTargets() {
    var cur = (typeof rrCurrentCollection === 'function') ? rrCurrentCollection() : null;
    var all = (typeof rrCollections === 'function') ? rrCollections() : [];
    return all.filter(function (c) {
      if (!c || !c.sheetId) return false;
      if (cur && c.key === cur.key) return false;
      return c.home || (c.status || 'active') === 'active';
    });
  }

  // ── what goes: the copies asked for, and every piece of their groups ────
  function rrMoveGather(keys) {
    var pd = st().personalData || {}, out = [], seen = {};
    var add = function (k) {
      var p = pd[k];
      if (!p || !p.owned || seen[k]) return;
      seen[k] = true; out.push(k);
    };
    (keys || []).forEach(function (k) {
      add(k);
      var g = pd[k] && String(pd[k].groupId || '').trim();
      if (!g) return;
      Object.keys(pd).forEach(function (k2) { if (pd[k2] && String(pd[k2].groupId || '').trim() === g) add(k2); });
    });
    return out;
  }
  // The listing on the For Sale list for a copy (by its inventory number).
  function _saleEntryOf(p) {
    var fs = st().forSaleData || {}, inv = String((p && p.inventoryId) || '');
    if (!inv) return null;
    for (var k in fs) if (fs[k] && String(fs[k].inventoryId || '') === inv) return fs[k];
    return null;
  }

  // ── the record, kept in the collections list file ───────────────────────
  function _newId() { return 'mv' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  async function _save(m) {
    await rrCollectionsFileUpdate(function (d) { d.moves = d.moves || {}; d.moves[m.id] = _clone(m); });
  }
  async function _drop(id) {
    await rrCollectionsFileUpdate(function (d) { if (d.moves) delete d.moves[id]; });
  }
  function rrUnfinishedMoves() {
    var d = (typeof rrCollectionsData === 'function') ? rrCollectionsData() : null;
    var mv = (d && d.moves) || {};
    return Object.keys(mv).map(function (k) { return mv[k]; }).sort(function (a, b) { return (a.at || 0) - (b.at || 0); });
  }

  // Build the move from the open collection's copies. Pure apart from reading state.
  function rrMovePlan(keys, toKey, opts) {
    opts = opts || {};
    var from = rrCurrentCollection(), to = rrCollectionByKey(toKey);
    var pd = st().personalData || {};
    var items = rrMoveGather(keys).map(function (k) {
      var p = pd[k];
      var row = new Array(PERSONAL_SCHEMA.length).fill('');
      PERSONAL_SCHEMA.forEach(function (s, i) {
        var v = p[s.field];
        if (s.field === 'quickEntry') v = p.quickEntry ? 'Yes' : 'No';
        row[i] = (v === null || v === undefined) ? '' : String(v);
      });
      var sale = _saleEntryOf(p);
      return {
        key: k, srcInv: String(p.inventoryId || ''), itemNum: String(p.itemNum || ''),
        row: row, newInv: '',
        folders: [p.photoItem, p.photoBox].map(_folderIdOf).filter(function (x, i, a) { return x && a.indexOf(x) === i; }),
        sale: sale ? [sale.itemNum, sale.variation, sale.condition, sale.askingPrice, sale.dateListed, sale.notes, sale.originalPrice, sale.estWorth, sale.inventoryId, sale.manufacturer] : null,
      };
    });
    var saleOn = (typeof rrListOn === 'function') ? rrListOn('forSale', to) : true;
    return {
      id: _newId(), at: Date.now(), who: (st().user && (st().user.email || st().user.name)) || '',
      from: from.key, fromSheet: from.sheetId, fromLabel: _label(from), fromNumber: from.number || null,
      to: to.key, toSheet: to.sheetId, toLabel: _label(to), toNumber: to.number || null,
      toPhotoRoot: to.photoRootId || null,
      items: items,
      sale: items.some(function (it) { return it.sale; }) ? (saleOn ? 'move' : (opts.takeOffSale ? 'remove' : 'ask')) : 'none',
      step: 'start', photosLeft: [],
    };
  }
  function _folderIdOf(link) {
    var m = String(link || '').match(/\/folders\/([A-Za-z0-9_-]+)/);
    return m ? m[1] : '';
  }
  function _fullId(inv, coll) { return (typeof rrFullId === 'function') ? rrFullId(inv, coll) : String(inv); }

  // ── the engine ─────────────────────────────────────────────────────────
  var _running = false;
  async function rrMoveRun(m) {
    if (_running) { toast(W('busy'), 4000, true); return { ok: false, why: 'busy' }; }
    if (_offline()) { toast(W('offline'), 4500, true); return { ok: false, why: 'offline' }; }
    _running = true;
    try { if (typeof rrHoldSwitch === 'function') rrHoldSwitch(true); } catch (e) {}
    try {
      var order = M().steps || [];
      var at = order.indexOf(m.step || 'start'); if (at < 0) at = 0;
      for (var i = at; i < order.length; i++) {
        var step = order[i];
        var next = order[i + 1] || 'done';
        await _STEP[step](m);
        m.step = next;
        if (next !== 'done') await _save(m);
      }
      await _drop(m.id);
      await _afterMove(m);
      return { ok: true, move: m };
    } catch (e) {
      console.warn('[Collections] move stopped at', m.step, e && e.message);
      try { await _save(m); } catch (e2) {}
      return { ok: false, why: 'stopped', step: m.step, error: (e && e.message) || String(e) };
    } finally {
      try { if (typeof rrHoldSwitch === 'function') rrHoldSwitch(false); } catch (e) {}
      _running = false;
    }
  }

  var _backedUp = {};   // sheets backed up this session before a move changed them
  // The new collection's rows that carry THIS move's tag: srcInv → { inv, row }
  async function _landed(m) {
    var a = _L('inventoryId'), b = _L('transferredFrom');
    var res = await sheetsBatchGet(m.toSheet, [PERSONAL_TAB + '!' + a + '3:' + a, PERSONAL_TAB + '!' + b + '3:' + b]);
    var vr = (res && res.valueRanges) || [];
    if (vr.length < 2) throw new Error('could not read the new collection');
    var invs = vr[0].values || [], tags = vr[1].values || [], out = {};
    var n = Math.max(invs.length, tags.length);
    for (var r = 0; r < n; r++) {
      var t = _tagOf(tags[r] && tags[r][0]);
      if (t && t.move === m.id) out[t.inv] = { inv: _bare(invs[r] && invs[r][0]), row: r + 3 };
    }
    return out;
  }
  var _STEP = {
    start: async function (m) {
      if (!_backedUp[m.fromSheet]) { await backupCreateAuto(M().backupReason || 'before-move', m.fromSheet); _backedUp[m.fromSheet] = true; }
      // the new sheet is as wide as the schema and carries every list tab
      if (typeof ensurePersonalHeaders === 'function') await ensurePersonalHeaders(m.toSheet);
      if (typeof rrEnsurePersonalGrid === 'function') { await rrEnsurePersonalGrid(m.toSheet, true); await rrEnsurePersonalGrid(m.fromSheet, true); }
      if (m.items.some(function (it) { return !it.newInv; })) {
        var read = await rrSheetNumbers(m.toSheet);
        if (!read) throw new Error('could not read the new collection\'s numbers');
        var next = Math.max(read.max || 0, rrLocalHwmFor(m.toSheet) || 0);
        m.items.forEach(function (it) { if (!it.newInv) it.newInv = String(++next); });
        rrBumpHwmFor(m.toSheet, next);
        await _save(m);   // the numbers are written down before any row is added
      }
      var have = await _landed(m);
      var when = _today();
      var rows = [], mine = [];
      m.items.forEach(function (it) {
        if (have[it.srcInv]) { it.newInv = have[it.srcInv].inv || it.newInv; return; }
        var r = it.row.slice();
        r[_col('inventoryId')] = it.newInv;
        r[_col('transferredTo')] = '';
        r[_col('transferredFrom')] = W('fromMark', { label: m.fromLabel, id: _fullId(it.srcInv, rrCollectionByKey(m.from)), date: when, move: m.id, inv: it.srcInv });
        // an app-printed label names the OLD collection — it forwards (scan-shelve.js); a pack sticker stays with the item
        if ((M().appCodeRe || /^RR1:I:/).test(String(r[_col('stickerCode')] || ''))) r[_col('stickerCode')] = '';
        // the record's own "Owned" words are not columns
        rows.push(r); mine.push(it);
        rrNoteMintedFor(m.toSheet, it.newInv);
      });
      if (rows.length) {
        await sheetsAppend(m.toSheet, PERSONAL_TAB + '!A3:' + _lastL(), rows);
        mine.forEach(function (it) { it.newInv = rrInvIdNow(it.newInv, m.toSheet); });
      }
      // a For Sale listing goes along when the new collection keeps a For Sale list
      if (m.sale === 'move') {
        var fsRes = await sheetsGet(m.toSheet, 'For Sale!I3:I');
        var listed = {}; ((fsRes && fsRes.values) || []).forEach(function (r) { listed[_bare(r && r[0])] = true; });
        var sales = m.items.filter(function (it) { return it.sale && !listed[it.newInv]; }).map(function (it) {
          var s = it.sale.slice(); s[8] = it.newInv; return s;
        });
        if (sales.length) await sheetsAppend(m.toSheet, 'For Sale!A3:J', sales);
      }
    },
    added: async function (m) {
      var have = await _landed(m);
      var missing = m.items.filter(function (it) { return !have[it.srcInv]; });
      if (missing.length) { m.step = 'start'; throw new Error(missing.length + ' row(s) did not land'); }
      m.items.forEach(function (it) { it.newInv = have[it.srcInv].inv; it.newRow = have[it.srcInv].row; });
    },
    checked: async function (m) {
      if (!m.toPhotoRoot) { var t = rrCollectionByKey(m.to); m.toPhotoRoot = t && t.photoRootId; }
      if (!m.toPhotoRoot) throw new Error('the new collection has no photo folder');
      var staying = {};
      try {
        var pd = st().personalData || {}, moving = {};
        m.items.forEach(function (it) { moving[it.key] = true; });
        if (st().personalSheetId === m.fromSheet) {
          Object.keys(pd).forEach(function (k) {
            if (moving[k] || !pd[k]) return;
            [pd[k].photoItem, pd[k].photoBox].map(_folderIdOf).forEach(function (f) { if (f) staying[f] = true; });
          });
        }
      } catch (e) {}
      m.photosLeft = m.photosLeft || [];
      for (var i = 0; i < m.items.length; i++) {
        var it = m.items[i];
        for (var j = 0; j < (it.folders || []).length; j++) {
          var fid = it.folders[j];
          if (staying[fid]) { if (m.photosLeft.indexOf(fid) < 0) m.photosLeft.push(fid); continue; }
          await _moveFolder(m, it, fid);
        }
      }
    },
    photos: async function (m) {
      // the old rows: read fresh, find each by its number AND item number, mark it
      var a = _L('inventoryId'), n = _L('itemNum'), t = _L('transferredTo');
      var res = await sheetsBatchGet(m.fromSheet, [PERSONAL_TAB + '!' + a + '3:' + a, PERSONAL_TAB + '!' + n + '3:' + n, PERSONAL_TAB + '!' + t + '3:' + t]);
      var vr = (res && res.valueRanges) || [];
      if (vr.length < 3) throw new Error('could not read the old collection');
      var invs = vr[0].values || [], nums = vr[1].values || [], tos = vr[2].values || [];
      var len = Math.max(invs.length, nums.length);
      var toColl = rrCollectionByKey(m.to), when = _today();
      for (var i = 0; i < m.items.length; i++) {
        var it = m.items[i], row = 0, done = false;
        for (var r = 0; r < len; r++) {
          if (_bare(invs[r] && invs[r][0]) !== it.srcInv || _bare(nums[r] && nums[r][0]) !== it.itemNum) continue;
          var tg = _tagOf(tos[r] && tos[r][0]);
          if (tg && tg.move === m.id) { done = true; break; }
          if (String((tos[r] && tos[r][0]) || '').trim()) continue;   // another move's row — never this one
          row = r + 3; break;
        }
        if (done) continue;
        if (!row) throw new Error('the old row of ' + it.itemNum + ' was not found');
        var mark = W('toMark', { label: m.toLabel, id: _fullId(it.newInv, toColl), date: when, move: m.id, inv: it.srcInv });
        var ok = await rrVerifiedRowUpdate(m.fromSheet, PERSONAL_TAB, row, PERSONAL_TAB + '!' + t + row, [[mark]], { num: it.itemNum, invId: it.srcInv }, 'collection');
        if (!ok) throw new Error('the old row of ' + it.itemNum + ' changed');
      }
      // the For Sale listing comes off the OLD list (moved along, or taken off on request)
      if (m.sale === 'move' || m.sale === 'remove') {
        var fs = await sheetsGet(m.fromSheet, 'For Sale!A3:J');
        var rows = (fs && fs.values) || [];
        for (var k = 0; k < m.items.length; k++) {
          var it2 = m.items[k]; if (!it2.sale) continue;
          for (var q = 0; q < rows.length; q++) {
            if (_bare(rows[q] && rows[q][8]) !== it2.srcInv || !_bare(rows[q] && rows[q][0])) continue;
            var fr = q + 3;
            var off = await rrRemoveRowConfirmed(m.fromSheet, 'For Sale', fr, 'For Sale!A' + fr + ':J' + fr, [['', '', '', '', '', '', '', '', '', '']], { num: _bare(rows[q][0]), invId: it2.srcInv }, 'For Sale list');
            if (!off) throw new Error('the For Sale listing of ' + it2.itemNum + ' did not come off');
          }
        }
      }
      _forgetLocally(m);
    },
    marked: async function (m) {
      var toColl = rrCollectionByKey(m.to), fromColl = rrCollectionByKey(m.from);
      var how = (typeof RR_MOVE_LOG !== 'undefined' && RR_MOVE_LOG.how && RR_MOVE_LOG.how.transfer) || W('logHow');
      var who = m.who || '';
      var name = function (it) {
        var p = {}; PERSONAL_SCHEMA.forEach(function (s, i) { p[s.field] = it.row[i]; });
        return (typeof rrShelveItemName === 'function') ? rrShelveItemName(p) : it.itemNum;
      };
      var stamp = function (it) { return '[m:' + m.id + ':' + it.srcInv + ']'; };
      var sides = [
        { sid: m.fromSheet, inv: function (it) { return it.srcInv; } },
        { sid: m.toSheet, inv: function (it) { return it.newInv; } },
      ];
      for (var s = 0; s < sides.length; s++) {
        var side = sides[s], lines = [];
        try { lines = await rrMoveLogLines(side.sid); } catch (e) { lines = []; }
        var seen = {};
        lines.forEach(function (l) { var tg = _tagOf(l && l[7]); if (tg && tg.move === m.id) seen[tg.inv] = true; });
        for (var i = 0; i < m.items.length; i++) {
          var it = m.items[i]; if (seen[it.srcInv]) continue;
          var when = _shWhen(new Date());   // the Movement Log's own clock words (scan-shelve.js)
          var line = ["'" + when, "'" + side.inv(it), "'" + it.itemNum, name(it),
            _label(fromColl) + ' (' + _fullId(it.srcInv, fromColl) + ')', _label(toColl) + ' (' + _fullId(it.newInv, toColl) + ')',
            who, how + ' ' + stamp(it)];
          await rrMoveLogAddTo(side.sid, line);
        }
      }
    },
    logged: async function () {},
  };

  // A copy's photo folder → the new collection's Photos › <its main folder> ›
  // <item number> › renamed to the new number. MOVED, never copied: same ID.
  async function _moveFolder(m, it, fid) {
    var f = await driveRequest('GET', '/files/' + fid + '?fields=id,name,parents,mimeType,trashed');
    if (!f || !f.id || f.trashed) return;
    var path = (typeof rrPhotoHomeFor === 'function') ? rrPhotoHomeFor(it.itemNum) : [];
    if (!path || !path.length) path = [(typeof RR_PHOTO_HOME !== 'undefined' && RR_PHOTO_HOME.OTHER) || 'Other'];
    var parent = m.toPhotoRoot;
    for (var i = 0; i < path.length; i++) parent = await driveFindOrCreateFolder(path[i], parent);
    var itemFolder = await driveFindOrCreateFolder(String(it.itemNum || it.newInv), parent);
    var inPlace = (f.parents || []).indexOf(itemFolder) >= 0 && f.name === String(it.newInv);
    if (!inPlace) {
      var rm = (f.parents || []).filter(function (p) { return p !== itemFolder; }).join(',');
      await driveRequest('PATCH', '/files/' + fid + '?addParents=' + itemFolder + (rm ? '&removeParents=' + rm : '') + '&fields=id,parents',
        { name: String(it.newInv) });
    }
    // photo names carry the number ("Lionel 2343 ID45 RSV.jpg") — they follow it
    try {
      var q = encodeURIComponent("'" + fid + "' in parents and trashed=false");
      var kids = await driveRequest('GET', '/files?q=' + q + '&fields=files(id,name)&pageSize=200');
      var re = new RegExp('(^|\\s)ID' + String(it.srcInv).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\s|\\.|$)');
      var list = (kids && kids.files) || [];
      for (var k = 0; k < list.length; k++) {
        if (!re.test(list[k].name)) continue;
        await driveRequest('PATCH', '/files/' + list[k].id + '?fields=id', { name: list[k].name.replace(re, '$1ID' + it.newInv + '$2') });
      }
    } catch (e) { console.warn('[Collections] photo names kept:', e && e.message); }
  }

  // The open collection was the OLD one: its copies leave every list now.
  function _forgetLocally(m) {
    var s = st();
    if (s.personalSheetId !== m.fromSheet) return;
    s.transferredData = s.transferredData || {};
    m.items.forEach(function (it) {
      var p = s.personalData && s.personalData[it.key];
      if (p) { p.owned = false; p.status = 'Transferred'; s.transferredData[it.key] = p; delete s.personalData[it.key]; }
      var fs = s.forSaleData || {};
      Object.keys(fs).forEach(function (k) { if (fs[k] && String(fs[k].inventoryId || '') === it.srcInv && m.sale !== 'none' && m.sale !== 'ask') delete fs[k]; });
    });
    try { if (typeof _cachePersonalData === 'function') _cachePersonalData(); } catch (e) {}
    try { root._rrBrowseSig = null; root._rrCollPageSig = null; } catch (e) {}
  }
  async function _afterMove(m) {
    var s = st();
    if (s.personalSheetId === m.toSheet && typeof loadPersonalData === 'function') {
      try { await loadPersonalData(); } catch (e) {}
    }
    try { if (typeof buildApp === 'function') buildApp(); } catch (e) {}
  }

  // ── the screens ────────────────────────────────────────────────────────
  var _INP = 'width:100%;box-sizing:border-box;min-height:40px;padding:0.5rem 0.6rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:1rem';
  var _BTN = 'min-height:42px;padding:0.5rem 1rem;border-radius:9px;border:none;background:var(--accent);color:var(--on-accent);font-family:var(--font-body);font-size:0.95rem;font-weight:700;cursor:pointer';
  var _ROW = 'display:flex;align-items:center;gap:0.6rem;width:100%;box-sizing:border-box;text-align:left;min-height:44px;padding:0.5rem 0.7rem;margin-top:0.35rem;border-radius:9px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.95rem;cursor:pointer';
  function _dialog(id, html) {
    var full = false; try { full = typeof rrIsPhone === 'function' && rrIsPhone(); } catch (e) {}
    if (typeof rrCollDialog === 'function') return rrCollDialog(id, html, full);
    var d = document.createElement('div'); d.id = id; d.innerHTML = html; document.body.appendChild(d); return d;
  }
  function _title(t) { return '<div style="font-family:var(--font-head);font-size:1.2rem;font-weight:700;margin:0.2rem 2.2rem 0.7rem 0">' + esc(t) + '</div>'; }
  function _itemName(p) { return (typeof rrShelveItemName === 'function') ? rrShelveItemName(p) : String(p.itemNum || ''); }

  // The item page's button (beside Remove). '' when moving is not on here.
  function rrMoveBtnHtml(pd) {
    if (!pd || !rrMoveOn()) return '';
    var map = st().personalData || {}, key = '';
    for (var k in map) if (map[k] === pd) { key = k; break; }
    if (!key) return '';
    return '<button id="detail-move-item" type="button" onclick="rrMoveOpen([' + esc(jsArg(key)) + '])" style="padding:0.5rem 0.9rem;border-radius:8px;border:1.5px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.82rem;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:0.4rem">' + esc(W('moveBtn')) + '</button>';
  }

  var _pending = null;   // { keys }
  function rrMoveOpen(keys) {
    if (!rrMoveOn()) { toast(W('none'), 4000, true); return; }
    var all = rrMoveGather(keys);
    if (!all.length) { toast(W('nothing'), 3000, true); return; }
    _pending = { keys: all };
    var pd = st().personalData || {};
    var list = all.map(function (k) { var p = pd[k]; return '<div style="font-size:0.88rem;padding:0.15rem 0">' + esc(_itemName(p)) + (p.inventoryId ? ' <span style="color:var(--text-dim);font-size:0.78rem">' + esc(_fullId(p.inventoryId)) + '</span>' : '') + '</div>'; }).join('');
    var targets = rrMoveTargets().sort(function (a, b) { return (Number(b.lastOpenedAt) || 0) - (Number(a.lastOpenedAt) || 0); });
    var html = _title(W('title')) +
      '<div style="font-size:0.85rem;color:var(--text-dim);margin-bottom:0.3rem">' + esc(all.length === 1 ? W('one') : W('pieces', { n: all.length })) + '</div>' +
      '<div style="max-height:9rem;overflow:auto;margin-bottom:0.7rem">' + list + '</div>' +
      '<div style="font-weight:700;margin-bottom:0.2rem">' + esc(W('pick')) + '</div>' +
      '<div id="rr-move-targets">' + targets.map(function (c, i) {
        return '<label style="' + _ROW + '"><input type="radio" name="rr-move-to" value="' + esc(c.key) + '"' + (i === 0 ? ' checked' : '') + ' style="width:1.15rem;height:1.15rem;accent-color:var(--accent)"><span>' + esc(_label(c)) + '</span></label>';
      }).join('') + '</div>' +
      '<div style="display:flex;justify-content:flex-end;gap:0.5rem;margin-top:0.9rem">' +
        '<button type="button" id="rr-move-go" onclick="rrMoveGo(this)" style="' + _BTN + '">' + esc(W('go')) + '</button>' +
      '</div>';
    _dialog('rr-move-box', html);
  }
  function rrMoveGo(btn) {
    var run = async function () {
      var pick = document.querySelector('input[name="rr-move-to"]:checked');
      if (!pick || !_pending) return { ok: false };
      if (_offline()) { toast(W('offline'), 4500, true); return { ok: false }; }
      var m = rrMovePlan(_pending.keys, pick.value);
      if (m.sale === 'ask') {
        var yes = await appConfirm(W('saleOff', { label: m.toLabel }), { ok: W('saleOffOk'), cancel: W('cancel') });
        if (!yes) return { ok: false };
        m.sale = 'remove';
      }
      var box = document.getElementById('rr-move-box'); if (box) box.remove();
      toast(W('moving', { n: m.items.length, label: m.toLabel }), 4000);
      var r = await rrMoveRun(m);
      if (r.ok) {
        var ids = m.items.map(function (it) { return _fullId(it.newInv, rrCollectionByKey(m.to)); }).join(', ');
        toast(m.items.length === 1 ? W('doneOne', { label: m.toLabel, ids: ids }) : W('done', { n: m.items.length, label: m.toLabel, ids: ids }), 6000);
        try { if (typeof showPage === 'function' && root._rrLastPage === 'itemdetail') showPage('browse', null); } catch (e) {}
      } else if (r.why === 'stopped') {
        toast(W('failed'), 8000, true);
      }
      return r;
    };
    if (typeof rrOnce === 'function') return rrOnce('rr-coll-move', run, btn);
    return run();
  }

  // Many at once: tick the open collection's items, then pick where.
  var _manySel = {};
  function rrMoveManyOpen() {
    if (!rrMoveOn()) { toast(W('none'), 4000, true); return; }
    var m = document.getElementById('rr-coll-menu'); if (m) m.remove();
    _manySel = {};
    var cur = rrCurrentCollection();
    var html = _title(W('manyTitle', { label: _label(cur) })) +
      '<input id="rr-move-q" type="search" placeholder="' + esc(W('manySearch')) + '" oninput="rrMoveManyFilter(this.value)" style="' + _INP + '">' +
      '<div id="rr-move-list" style="margin-top:0.4rem"></div>' +
      '<div style="display:flex;justify-content:flex-end;gap:0.5rem;margin-top:0.8rem;position:sticky;bottom:0;background:var(--surface);padding-top:0.4rem">' +
        '<button type="button" onclick="rrMoveManyNext()" style="' + _BTN + '">' + esc(W('next')) + '</button>' +
      '</div>';
    _dialog('rr-move-many', html);
    rrMoveManyFilter('');
  }
  function rrMoveManyFilter(q) {
    var box = document.getElementById('rr-move-list'); if (!box) return;
    var pd = st().personalData || {}, n = String(q || '').trim().toLowerCase();
    var keys = Object.keys(pd).filter(function (k) {
      var p = pd[k]; if (!p || !p.owned) return false;
      if (!n) return true;
      return (_itemName(p) + ' ' + (p.inventoryId || '') + ' ' + (p.itemNum || '')).toLowerCase().indexOf(n) >= 0;
    }).slice(0, 300);
    box.innerHTML = keys.map(function (k) {
      var p = pd[k];
      return '<label style="' + _ROW + '"><input type="checkbox" data-move-key="' + esc(k) + '"' + (_manySel[k] ? ' checked' : '') + ' onchange="rrMoveManyTick(this)" style="width:1.15rem;height:1.15rem;accent-color:var(--accent)">' +
        '<span style="flex:1;min-width:0">' + esc(_itemName(p)) + (p.inventoryId ? ' <span style="color:var(--text-dim);font-size:0.78rem">' + esc(_fullId(p.inventoryId)) + '</span>' : '') + '</span></label>';
    }).join('');
  }
  function rrMoveManyTick(cb) { var k = cb.getAttribute('data-move-key'); if (cb.checked) _manySel[k] = true; else delete _manySel[k]; }
  function rrMoveManyNext() {
    var keys = Object.keys(_manySel);
    if (!keys.length) { toast(W('nothing'), 3000, true); return; }
    var b = document.getElementById('rr-move-many'); if (b) b.remove();
    rrMoveOpen(keys);
  }

  // Unfinished moves (the Collections menu draws them; Finish carries on).
  function rrMoveUnfinishedHtml() {
    var list = rrUnfinishedMoves();
    if (!list.length) return '';
    return '<div style="margin-top:0.7rem;font-weight:700">' + esc(W('unfinished', { n: list.length })) + '</div>' + list.map(function (mv) {
      return '<div style="' + _ROW + ';cursor:default"><span style="flex:1;font-size:0.86rem">' +
        esc(W('unfinishedLine', { n: ((mv.items || []).length === 1 ? W('one') : W('itemsN', { n: (mv.items || []).length })), from: mv.fromLabel, to: mv.toLabel, step: W('step.' + (mv.step || 'start')) })) + '</span>' +
        '<button type="button" onclick="rrMoveFinish(' + esc(jsArg(mv.id)) + ', this)" style="' + _BTN + ';min-height:36px;padding:0.3rem 0.7rem;font-size:0.85rem">' + esc(W('finish')) + '</button></div>';
    }).join('');
  }
  function rrMoveFinish(id, btn) {
    var run = async function () {
      var mv = rrUnfinishedMoves().filter(function (x) { return x.id === id; })[0];
      if (!mv) return { ok: false };
      var menu = document.getElementById('rr-coll-menu'); if (menu) menu.remove();
      var r = await rrMoveRun(mv);
      toast(r.ok ? W('finished') : W('failed'), r.ok ? 4000 : 8000, !r.ok);
      return r;
    };
    if (typeof rrOnce === 'function') return rrOnce('rr-coll-move', run, btn);
    return run();
  }

  var api = {
    rrMoveOn: rrMoveOn, rrMoveTargets: rrMoveTargets, rrMoveGather: rrMoveGather, rrMovePlan: rrMovePlan, rrMoveRun: rrMoveRun,
    rrUnfinishedMoves: rrUnfinishedMoves, rrMoveBtnHtml: rrMoveBtnHtml, rrMoveOpen: rrMoveOpen, rrMoveGo: rrMoveGo,
    rrMoveManyOpen: rrMoveManyOpen, rrMoveManyFilter: rrMoveManyFilter, rrMoveManyTick: rrMoveManyTick, rrMoveManyNext: rrMoveManyNext,
    rrMoveUnfinishedHtml: rrMoveUnfinishedHtml, rrMoveFinish: rrMoveFinish,
  };
  Object.keys(api).forEach(function (k) { root[k] = api[k]; });
  root._rrMoveReset = function () { _running = false; _backedUp = {}; _pending = null; _manySel = {}; };   // test hook
})(typeof window !== 'undefined' ? window : globalThis);
