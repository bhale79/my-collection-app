// ═══════════════════════════════════════════════════════════════════════════
// collections-archive.js — TRR Pro release 7A: ARCHIVE, UN-ARCHIVE, DELETE,
// RECENTLY DELETED / RESTORE
// ═══════════════════════════════════════════════════════════════════════════
// Design agreed with Brad 2026-10-28 (PLAN_2026-10-28_TRR_PRO.md, Step 3,
// "Section 3 — Archive" and "Deleting"); the build plan
// PLAN_2026-10-31_TRR_PRO_R7.md ([stated] Brad 2026-10-31 07:26 CT "yes").
//
//   archive     from the open collection's details card. First the CHECKS
//               (RR_COLL_ARCHIVE.checks — one list; Release 10 adds invoices):
//               unfinished moves must be finished; items still here can be
//               moved, marked returned to the client, or archived anyway.
//               Archived = the collections list says so (status + date).
//               Nothing moves in Drive, nothing is deleted.
//   read only   held at ONE door — collections.js rrWriteDoor (the sheet
//               writers) and rrFolderDoor (the photo writers). The screens
//               also hide the ways in (RR_COLL_ARCHIVE.readOnlyHide) and say
//               why (the banner); the door is what makes it true.
//   un-archive  one tap.
//   delete      archived only, never home, the name typed to confirm. The
//               FORWARDING list (where every item moved out of it went) is
//               saved in the list file FIRST; then the collection's folder —
//               its sheet and photos inside — goes to the Drive trash. The
//               record stays (status deleted): the number is never reused, an
//               old label still answers. Backups are not touched.
//   restore     for 30 days: out of the trash, back as archived.
//
// ON only through RR_COLL_UI.feature (the owners first). Every word and
// setting: RR_COLL_ARCHIVE (config.js).
// ═══════════════════════════════════════════════════════════════════════════
/* eslint-disable no-var */
(function (root) {
  'use strict';

  function A() { return (typeof RR_COLL_ARCHIVE !== 'undefined' && RR_COLL_ARCHIVE) || root.RR_COLL_ARCHIVE || { words: {}, checks: [], headings: ['Archived'] }; }
  function W(k, vars) {
    var t = String((A().words || {})[k] || '');
    Object.keys(vars || {}).forEach(function (v) { t = t.split('{' + v + '}').join(String(vars[v])); });
    return t;
  }
  function esc(s) {
    if (typeof rrEsc === 'function') return rrEsc(s);
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  // A value inside an on-click, QUOTED: rrJsArg makes it safe, the quotes make it a
  // string (the bare value was read as a variable and the tap did nothing).
  function jsArg(s) { return "'" + (typeof rrJsArg === 'function' ? rrJsArg(s) : String(s == null ? '' : s).replace(/[\\']/g, '\\$&').replace(/[&<>"]/g, '')) + "'"; }
  function toast(m, ms, bad) { try { if (typeof showToast === 'function') showToast(m, ms || 3500, !!bad); } catch (e) {} }
  function st() { try { return (typeof state !== 'undefined' && state) || root.state || {}; } catch (e) { return root.state || {}; } }
  function _ls() { try { return root.localStorage || null; } catch (e) { return null; } }
  function _offline() {
    try { if (root._offlineMode) return true; } catch (e) {}
    try { if (typeof navigator !== 'undefined' && navigator.onLine === false) return true; } catch (e) {}
    return false;
  }
  function _on() { try { return typeof rrCollUiOn === 'function' && rrCollUiOn(); } catch (e) { return false; } }
  function _label(c) {
    if (!c) return '';
    if (c.home) return (typeof RR_COLL_UI !== 'undefined' && RR_COLL_UI.words && RR_COLL_UI.words.home) || 'My Collection';
    return (typeof rrCollectionLabel === 'function') ? rrCollectionLabel(c) : (c.number + ' – ' + c.name);
  }
  function _day(t) {
    try { return rrToday(new Date(Number(t))); } catch (e) { return ''; }
  }
  function _items(n) { return Number(n) === 1 ? W('item1') : W('itemsN', { n: n }); }
  function _bare(v) { return String(v == null ? '' : v).replace(/^'/, '').trim(); }
  function _sameName(a, b) {
    var n = function (s) { return String(s == null ? '' : s).trim().replace(/\s+/g, ' ').toLowerCase(); };
    return !!n(a) && n(a) === n(b);
  }
  function _entry(key) {
    var d = (typeof rrCollectionsData === 'function') ? rrCollectionsData() : null;
    return (d && d.items && d.items[key]) || null;
  }
  function _repaint() {
    try { if (typeof rrApplyListSwitches === 'function') rrApplyListSwitches(); } catch (e) {}
    try { if (typeof rrCollUiPaint === 'function') rrCollUiPaint(); } catch (e) {}
  }
  function _dialog(id, html) {
    var full = false; try { full = typeof rrIsPhone === 'function' && rrIsPhone(); } catch (e) {}
    return (typeof rrCollDialog === 'function') ? rrCollDialog(id, html, full) : null;
  }
  function _close(id) { try { var d = document.getElementById(id); if (d) d.remove(); } catch (e) {} }
  var _ROW = 'display:flex;align-items:center;gap:0.6rem;width:100%;box-sizing:border-box;text-align:left;min-height:44px;padding:0.55rem 0.75rem;margin-top:0.35rem;border-radius:9px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.95rem';
  var _BTN = 'min-height:42px;padding:0.5rem 1rem;border-radius:9px;border:none;background:var(--accent);color:var(--on-accent);font-family:var(--font-body);font-size:0.95rem;font-weight:700;cursor:pointer';
  var _BTN2 = 'min-height:42px;padding:0.5rem 1rem;border-radius:9px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.95rem;font-weight:600;cursor:pointer';
  var _INP = 'width:100%;box-sizing:border-box;min-height:40px;padding:0.5rem 0.6rem;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:1rem';
  function _title(t) { return '<div style="font-family:var(--font-head);font-size:1.2rem;font-weight:700;margin:0.2rem 2.2rem 0.6rem 0">' + esc(t) + '</div>'; }

  // ── the archived heading: ONE business setting ──────────────────────────
  function rrArchiveHeading() {
    var v = '';
    try { v = (typeof rrPrefRead === 'function') ? rrPrefRead(A().headingKey) : ''; } catch (e) { v = ''; }
    v = String(v || '').trim().slice(0, A().headingMax || 30);
    return v || (A().headings || ['Archived'])[0];
  }
  function rrArchiveHeadingSet(name) {
    var v = String(name == null ? '' : name).trim().slice(0, A().headingMax || 30);
    if (typeof rrPrefWrite === 'function') rrPrefWrite(A().headingKey, v);
    return rrArchiveHeading();
  }

  // ── the checks before archiving (ONE list: RR_COLL_ARCHIVE.checks) ──────
  // Each answers null (nothing open) or { id, n, block, … }. `block` = must be
  // settled first; otherwise the person chooses.
  function _unsoldKeys() {
    var pd = st().personalData || {};
    return Object.keys(pd).filter(function (k) { return pd[k] && pd[k].owned; });
  }
  var _CHECKS = {
    moves: function (c) {
      var mv = (typeof rrUnfinishedMoves === 'function') ? rrUnfinishedMoves() : [];
      var mine = mv.filter(function (m) { return m && (m.from === c.key || m.to === c.key); });
      return mine.length ? { id: 'moves', n: mine.length, block: true, moves: mine } : null;
    },
    // release 7B: a hand-over still waiting for the client is finished or cancelled first
    handover: function (c) {
      var e = _entry(c.key), h = e && e.handover;
      if (!h || ['sending', 'waiting', 'accepted'].indexOf(h.state) < 0) return null;
      var HW = (typeof RR_COLL_HANDOVER !== 'undefined' && RR_COLL_HANDOVER.words) || {};
      return { id: 'handover', n: 1, block: true, text: HW.pendingCheck || 'handover' };
    },
    // release 10: invoices for this collection not marked paid (the person chooses — not a block)
    invoices: async function (c) {
      if (typeof rrInvUnpaidFor !== 'function') return null;
      var list = [];
      try { list = await rrInvUnpaidFor(c.key); } catch (e) { list = []; }
      var IW = (typeof RR_COLL_INVOICE !== 'undefined' && RR_COLL_INVOICE.words) || {};
      return list.length ? { id: 'invoices', n: list.length, block: false, text: String(IW.archiveCheck || '').split('{n}').join(String(list.length)) } : null;
    },
    unsold: function () {
      var keys = _unsoldKeys();
      return keys.length ? { id: 'unsold', n: keys.length, block: false, keys: keys } : null;
    },
  };
  // { ok, open: [results], why } — read fresh first (another device's move counts).
  async function rrArchiveChecks(key) {
    var c = (typeof rrCollectionByKey === 'function') ? rrCollectionByKey(key) : null;
    if (!c || c.home) return { ok: false, why: 'home' };
    var cur = rrCurrentCollection();
    if (!cur || cur.key !== key) return { ok: false, why: 'open' };
    if (typeof rrDataIsCurrent === 'function' && !rrDataIsCurrent()) return { ok: false, why: 'failed' };
    var got = await rrCollectionsFileRead();
    if (!got || !got.ok) return { ok: false, why: 'failed' };
    var open = [], ids = A().checks || [];
    for (var i = 0; i < ids.length; i++) {
      var fn = _CHECKS[ids[i]];
      if (typeof fn !== 'function') throw new Error('archive check without a checker: ' + ids[i]);
      var r = await fn(c);   // a checker may read (release 10's invoices)
      if (r) open.push(r);
    }
    return { ok: true, open: open };
  }

  // ── archive / un-archive ────────────────────────────────────────────────
  // opts.anyway: items still here are left as they are (still never deleted).
  async function rrArchiveCollection(key, opts) {
    if (typeof rrStaffGate === 'function' && !rrStaffGate('archive')) return { ok: false, why: 'role' };   // TRR Pro staff PINs: the roles door (staff.js)
    opts = opts || {};
    var chk = await rrArchiveChecks(key);
    if (!chk.ok) return { ok: false, why: chk.why };
    var blocking = chk.open.filter(function (r) { return r.block; });
    if (blocking.length) return { ok: false, why: 'open', open: chk.open };
    if (chk.open.length && !opts.anyway) return { ok: false, why: 'ask', open: chk.open };
    try {
      var now = Date.now();
      var d = await rrCollectionsFileUpdate(function (dd) {
        var e = dd.items[key];
        if (!e || e.status !== 'active') return false;
        e.status = 'archived'; e.archivedAt = now; e.at = now;
        e.itemCount = _unsoldKeys().length;
      });
      if (!d.items[key] || d.items[key].status !== 'archived') return { ok: false, why: 'failed' };
      if (typeof rrCollectionsSync === 'function') rrCollectionsSync(d);
      _repaint();
      return { ok: true };
    } catch (e) {
      console.warn('[Collections] archive:', e && e.message);
      return { ok: false, why: 'failed' };
    }
  }
  async function rrUnarchiveCollection(key) {
    if (typeof rrStaffGate === 'function' && !rrStaffGate('archive')) return { ok: false, why: 'role' };   // TRR Pro staff PINs: the roles door (staff.js)
    try {
      var d = await rrCollectionsFileUpdate(function (dd) {
        var e = dd.items[key];
        if (!e || e.status !== 'archived') return false;
        e.status = 'active'; e.unarchivedAt = Date.now(); e.at = Date.now();
      });
      if (!d.items[key] || d.items[key].status !== 'active') return { ok: false, why: 'failed' };
      if (typeof rrCollectionsSync === 'function') rrCollectionsSync(d);
      _repaint();
      return { ok: true };
    } catch (e) {
      console.warn('[Collections] un-archive:', e && e.message);
      return { ok: false, why: 'failed' };
    }
  }

  // ── Mark returned to the client ─────────────────────────────────────────
  // Each copy still here: "Returned to client on <date>" in its Transferred To
  // cell — hidden everywhere like a moved row, never deleted — and one line in
  // the Movement Log. The sheet is backed up first (no backup, no change).
  // Safe to run again: a row already marked is left alone.
  var _returnedRe = null;
  function _returnedPattern() {
    if (_returnedRe) return _returnedRe;
    var tpl = W('returnMark') || 'Returned to client on {date}';
    var parts = tpl.split('{date}').map(function (p) { return p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); });
    _returnedRe = new RegExp('^' + parts.join('(\\d{4}-\\d{2}-\\d{2})') + '$');
    return _returnedRe;
  }
  // The date a Transferred To cell says the copy was returned, or ''.
  function rrArchiveReturnedDate(text) {
    var m = String(text == null ? '' : text).trim().match(_returnedPattern());
    return m ? m[1] : '';
  }
  async function rrArchiveMarkReturned(keys) {
    if (typeof rrStaffGate === 'function' && !rrStaffGate('archive')) return { ok: false, why: 'role', n: 0 };   // TRR Pro staff PINs: the roles door (staff.js)
    var c = rrCurrentCollection();
    if (!c || c.home) return { ok: false, why: 'home', n: 0 };
    if (_offline()) return { ok: false, why: 'offline', n: 0 };
    var pd = st().personalData || {};
    var list = (keys || []).filter(function (k) { return pd[k] && pd[k].owned; });
    if (!list.length) return { ok: true, n: 0 };
    var done = 0;
    try {
      await backupCreateAuto(A().backupReason || 'before-return', c.sheetId);
      var L = function (f) { return personalColLetter(f); };
      var a = L('inventoryId'), n = L('itemNum'), t = L('transferredTo');
      var res = await sheetsBatchGet(c.sheetId, [PERSONAL_TAB + '!' + a + '3:' + a, PERSONAL_TAB + '!' + n + '3:' + n, PERSONAL_TAB + '!' + t + '3:' + t]);
      var vr = (res && res.valueRanges) || [];
      if (vr.length < 3) throw new Error('could not read the collection');
      var invs = vr[0].values || [], nums = vr[1].values || [], tos = vr[2].values || [];
      var len = Math.max(invs.length, nums.length);
      var when = rrToday(), mark = W('returnMark', { date: when });
      var who = (typeof rrWhoNow === 'function') ? rrWhoNow() : ((st().user && (st().user.email || st().user.name)) || '');   // TRR Pro staff PINs
      for (var i = 0; i < list.length; i++) {
        var k = list[i], p = pd[k];
        var inv = String(p.inventoryId || ''), num = String(p.itemNum || '');
        var row = 0, already = false;
        for (var r = 0; r < len; r++) {
          if (_bare(invs[r] && invs[r][0]) !== inv || _bare(nums[r] && nums[r][0]) !== num) continue;
          var cell = String((tos[r] && tos[r][0]) || '').trim();
          if (rrArchiveReturnedDate(cell)) { already = true; break; }
          if (cell) continue;     // a moved row with the same number — never this one
          row = r + 3; break;
        }
        if (!already) {
          if (!row) throw new Error('the row of ' + num + ' was not found');
          var ok = await rrVerifiedRowUpdate(c.sheetId, PERSONAL_TAB, row, PERSONAL_TAB + '!' + t + row, [[mark]], { num: num, invId: inv }, 'collection');
          if (!ok) throw new Error('the row of ' + num + ' changed');
          try {
            var name = (typeof rrShelveItemName === 'function') ? rrShelveItemName(p) : num;
            var whenLog = (typeof _shWhen === 'function') ? _shWhen(new Date()) : when;
            var full = (typeof rrFullId === 'function') ? rrFullId(inv, c) : inv;
            await rrMoveLogAddTo(c.sheetId, ["'" + whenLog, "'" + inv, "'" + num, name, _label(c) + ' (' + full + ')', W('returnTo'), who, W('returnHow')]);
          } catch (eLog) { console.warn('[Collections] returned — Movement Log line:', eLog && eLog.message); }
        }
        // this device: hidden like a moved row (exactly what a reload does)
        p.owned = false; p.status = 'Transferred'; p.transferredTo = already ? p.transferredTo : mark;
        var s = st(); s.transferredData = s.transferredData || {};
        s.transferredData[k] = p; delete pd[k];
        done++;
      }
      try { if (typeof _cachePersonalData === 'function') _cachePersonalData(); } catch (e) {}
      return { ok: true, n: done };
    } catch (e) {
      console.warn('[Collections] mark returned:', e && e.message);
      try { if (typeof _cachePersonalData === 'function') _cachePersonalData(); } catch (e2) {}
      return { ok: false, why: 'stopped', n: done, error: (e && e.message) || String(e) };
    }
  }

  // ── delete / restore ────────────────────────────────────────────────────
  // Where every item moved OUT of a collection went, from its Transferred To
  // column: { inv: { id:'8-46', label:'8 – Smith', date } | { returned: date } | { text } }.
  var _moveMarkRe = /^To (.*) as (\d+(?:-\d+)?) on (\d{4}-\d{2}-\d{2}) \[m:/;
  async function rrArchiveForwardList(sheetId) {
    var L = function (f) { return personalColLetter(f); };
    var a = L('inventoryId'), t = L('transferredTo');
    var res = await sheetsBatchGet(sheetId, [PERSONAL_TAB + '!' + a + '3:' + a, PERSONAL_TAB + '!' + t + '3:' + t]);
    var vr = (res && res.valueRanges) || [];
    if (vr.length < 2) throw new Error('could not read the collection');
    var invs = vr[0].values || [], tos = vr[1].values || [], out = {};
    for (var r = 0; r < Math.max(invs.length, tos.length); r++) {
      var inv = _bare(invs[r] && invs[r][0]), cell = String((tos[r] && tos[r][0]) || '').trim();
      if (!inv || !cell) continue;
      var m = cell.match(_moveMarkRe), ret = rrArchiveReturnedDate(cell);
      out[inv] = m ? { id: m[2], label: m[1], date: m[3] } : (ret ? { returned: ret } : { text: cell.replace(/\s*\[m:[^\]]*\]/, '') });
    }
    return out;
  }
  // How many items a collection's sheet holds (for the delete confirm). null = unknown.
  async function rrArchiveItemCount(sheetId) {
    try {
      var L = personalColLetter('inventoryId'), T = personalColLetter('transferredTo');
      var res = await sheetsBatchGet(sheetId, [PERSONAL_TAB + '!' + L + '3:' + L, PERSONAL_TAB + '!' + T + '3:' + T]);
      var vr = (res && res.valueRanges) || [];
      var invs = (vr[0] && vr[0].values) || [], tos = (vr[1] && vr[1].values) || [];
      var n = 0;
      for (var r = 0; r < invs.length; r++) if (_bare(invs[r] && invs[r][0]) && !String((tos[r] && tos[r][0]) || '').trim()) n++;
      return n;
    } catch (e) { return null; }
  }
  function _forgetDeviceCopies(c) {
    var ls = _ls(); if (!ls || !c) return;
    try {
      [rrPersonalCacheKey('', c), rrPersonalCacheKey('ts', c), rrInvHwmKey(c)].forEach(function (k) { if (k) ls.removeItem(k); });
    } catch (e) {}
  }
  async function rrDeleteCollection(key, typedName) {
    if (typeof rrStaffGate === 'function' && !rrStaffGate('delete')) return { ok: false, why: 'role' };   // TRR Pro staff PINs: the roles door (staff.js)
    if (!key || key === 'home') return { ok: false, why: 'home' };
    if (_offline()) return { ok: false, why: 'offline' };
    var got = await rrCollectionsFileRead();
    if (!got || !got.ok) return { ok: false, why: 'failed' };
    var e = got.data.items[key];
    if (!e) return { ok: false, why: 'unknown' };
    if (e.linked) return { ok: false, why: 'linked' };   // release 7B: the client owns it — Unlink, never trash
    if (e.status !== 'archived') return { ok: false, why: 'notArchived' };
    if (!_sameName(typedName, e.name)) return { ok: false, why: 'name' };
    try {
      // 1. off it, if it is open here
      var cur = rrCurrentCollection();
      if (cur && cur.key === key) {
        var sw = (typeof rrCollSwitchTo === 'function') ? await rrCollSwitchTo('home', { quiet: true }) : await rrSwitchCollection('home', {});
        if (!sw || !sw.ok) return { ok: false, why: 'failed' };
      }
      // 2. the forwarding list — kept BEFORE anything is trashed
      var fwd = await rrArchiveForwardList(e.sheetId);
      await rrCollectionsFileUpdate(function (d) { if (!d.items[key]) return false; d.items[key].forward = fwd; d.items[key].at = Date.now(); });
      // 3. the folder (its sheet and photos inside) into the Drive trash; the
      //    sheet too on its own if it ever ended up outside the folder
      var trashed = [];
      if (e.folderId) { await driveRequest('PATCH', '/files/' + e.folderId + '?fields=id,trashed', { trashed: true }); trashed.push(e.folderId); }
      try {
        var sh = await driveRequest('GET', '/files/' + e.sheetId + '?fields=id,trashed');
        if (sh && !sh.trashed) { await driveRequest('PATCH', '/files/' + e.sheetId + '?fields=id,trashed', { trashed: true }); trashed.push(e.sheetId); }
      } catch (eS) { if (!e.folderId) throw eS; }
      // 4. the record stays: deleted + when (the number is never reused)
      var now = Date.now();
      var d2 = await rrCollectionsFileUpdate(function (d) {
        if (!d.items[key]) return false;
        d.items[key].status = 'deleted'; d.items[key].deletedAt = now; d.items[key].trashed = trashed; d.items[key].at = now;
      });
      if (typeof rrCollectionsSync === 'function') rrCollectionsSync(d2);
      _forgetDeviceCopies(e);
      _repaint();
      return { ok: true };
    } catch (er) {
      console.warn('[Collections] delete:', er && er.message);
      return { ok: false, why: 'failed', error: (er && er.message) || String(er) };
    }
  }
  function _restoreWindowMs() { return (A().restoreDays || 30) * 24 * 60 * 60 * 1000; }
  function rrRecentlyDeleted(now) {
    var d = (typeof rrCollectionsData === 'function') ? rrCollectionsData() : null;
    var t = (now == null) ? Date.now() : now;
    return Object.keys((d && d.items) || {}).map(function (k) { return d.items[k]; })
      .filter(function (e) { return e && e.status === 'deleted' && e.deletedAt && t - e.deletedAt < _restoreWindowMs(); })
      .sort(function (a, b) { return (b.deletedAt || 0) - (a.deletedAt || 0); });
  }
  async function rrRestoreCollection(key) {
    if (typeof rrStaffGate === 'function' && !rrStaffGate('delete')) return { ok: false, why: 'role' };   // TRR Pro staff PINs: the roles door (staff.js)
    if (_offline()) return { ok: false, why: 'offline' };
    var got = await rrCollectionsFileRead();
    if (!got || !got.ok) return { ok: false, why: 'failed' };
    var e = got.data.items[key];
    if (!e || e.status !== 'deleted') return { ok: false, why: 'unknown' };
    var ids = (Array.isArray(e.trashed) && e.trashed.length) ? e.trashed : [e.folderId || e.sheetId];
    try {
      for (var i = 0; i < ids.length; i++) {
        try { await driveRequest('PATCH', '/files/' + ids[i] + '?fields=id,trashed', { trashed: false }); }
        catch (eR) { if (eR && eR.status === 404) return { ok: false, why: 'gone' }; throw eR; }
      }
      var d = await rrCollectionsFileUpdate(function (dd) {
        if (!dd.items[key]) return false;
        dd.items[key].status = 'archived'; dd.items[key].restoredAt = Date.now(); dd.items[key].at = Date.now();
        delete dd.items[key].trashed;
      });
      if (typeof rrCollectionsSync === 'function') rrCollectionsSync(d);
      _repaint();
      return { ok: true };
    } catch (er) {
      console.warn('[Collections] restore:', er && er.message);
      return { ok: false, why: 'failed' };
    }
  }

  // ── what an old label says (scan-shelve.js asks) ────────────────────────
  // A label whose sheet tag is a DELETED collection's: forwarded (moved out
  // before the delete), returned, or simply "deleted on <date>".
  function rrArchiveLabelFind(tag, inv) {
    var d = (typeof rrCollectionsData === 'function') ? rrCollectionsData() : null;
    if (!tag || !d || !d.items || typeof _shSheetTagOf !== 'function') return null;
    var keys = Object.keys(d.items);
    for (var i = 0; i < keys.length; i++) {
      var e = d.items[keys[i]];
      if (!e || (e.status !== 'deleted' && e.status !== 'handedOver') || !e.sheetId || _shSheetTagOf(e.sheetId) !== tag) continue;
      var id = e.number + '-' + inv;
      if (e.status === 'handedOver') {   // release 7B
        var HW = (typeof RR_COLL_HANDOVER !== 'undefined' && RR_COLL_HANDOVER.words) || {};
        return { kind: 'deletedColl', printed: true, entry: e, text: String(HW.labelHanded || '').split('{id}').join(id).split('{name}').join(e.name || '').split('{date}').join(_day(e.handedOverAt)) };
      }
      var f = (e.forward || {})[String(inv)];
      if (f && f.id) {
        var p = rrParseFullId(f.id);
        var dest = (rrCollections() || []).filter(function (c) { return p.number ? c.number === p.number : c.home; })[0] || null;
        return { kind: 'moved', inv: String(inv), pd: null, dest: dest, newInv: p.invId, printed: true, deletedFrom: e, oldId: id, fwd: f };
      }
      if (f && f.returned) return { kind: 'deletedColl', printed: true, entry: e, text: W('labelReturned', { id: id, date: f.returned }) };
      return { kind: 'deletedColl', printed: true, entry: e, text: W('labelDeleted', { id: id, name: e.name, date: _day(e.deletedAt) }) };
    }
    return null;
  }
  // A collection NUMBER that belongs to a deleted collection (a move's
  // destination that was deleted since).
  function rrArchiveDeletedByNumber(num) {
    var d = (typeof rrCollectionsData === 'function') ? rrCollectionsData() : null;
    var keys = Object.keys((d && d.items) || {});
    for (var i = 0; i < keys.length; i++) { var e = d.items[keys[i]]; if (e && e.status === 'deleted' && Number(e.number) === Number(num)) return e; }
    return null;
  }

  // ═══ the screens ════════════════════════════════════════════════════════
  var _archKey = null;
  function rrArchiveOpen(key) {
    if (typeof rrStaffGate === 'function' && !rrStaffGate('archive')) return;   // TRR Pro staff PINs: the roles door (staff.js)
    var c = rrCollectionByKey(key);
    if (!c || c.home) { toast(W('homeNo'), 3500, true); return; }
    var cur = rrCurrentCollection();
    if (!cur || cur.key !== key) { toast(W('openFirst', { label: _label(c) }), 4000, true); return; }
    _close('rr-coll-details');
    _archKey = key;
    var d = _dialog('rr-coll-archive', _title(W('archiveTitle', { label: _label(c) })) +
      '<div style="font-size:0.88rem;color:var(--text-dim);line-height:1.45">' + esc(W('archiveIntro')) + '</div>' +
      '<div id="rr-arch-body" style="margin-top:0.8rem;font-size:0.92rem">' + esc(W('checking')) + '</div>');
    if (!d) return;
    return _paintChecks(key);
  }
  async function _paintChecks(key) {
    var box = document.getElementById('rr-arch-body'); if (!box) return;
    var chk;
    try { chk = await rrArchiveChecks(key); } catch (e) { chk = { ok: false, why: 'failed' }; }
    box = document.getElementById('rr-arch-body'); if (!box) return;
    if (!chk.ok) { box.innerHTML = '<div style="color:var(--t-red)">' + esc(chk.why === 'open' ? W('openFirst', { label: _label(rrCollectionByKey(key)) }) : W('checkFailed')) + '</div>'; return; }
    var html = '', block = false, unsold = null;
    chk.open.forEach(function (r) {
      if (r.id === 'moves') {
        block = true;
        html += '<div data-arch-check="moves" style="font-weight:700;margin-top:0.4rem">' + esc(W('checkMoves', { n: r.n })) + '</div>' +
          r.moves.map(function (mv) {
            return '<div style="' + _ROW + '"><span style="flex:1;font-size:0.86rem">' + esc((mv.fromLabel || '') + ' \u2192 ' + (mv.toLabel || '')) + '</span>' +
              '<button type="button" onclick="rrArchiveFinishMove(' + jsArg(mv.id) + ', this)" style="' + _BTN + ';min-height:36px;padding:0.3rem 0.7rem;font-size:0.85rem">' + esc((typeof RR_COLL_MOVE !== 'undefined' && RR_COLL_MOVE.words.finish) || 'Finish') + '</button></div>';
          }).join('');
      } else if (r.id === 'unsold') {
        unsold = r;
        html += '<div data-arch-check="unsold" style="font-weight:700;margin-top:0.6rem">' + esc(W('checkUnsold', { n: _items(r.n) })) + '</div>';
      } else {
        if (r.block) block = true;
        html += '<div data-arch-check="' + esc(r.id) + '" style="font-weight:700;margin-top:0.6rem">' + esc(r.text || W('check_' + r.id, { n: r.n }) || r.id) + '</div>';
      }
    });
    var k = jsArg(key);
    if (!chk.open.length) {
      html += '<div style="margin-top:0.4rem">' + esc(W('nothingOpen')) + '</div>' +
        '<div style="margin-top:1rem;display:flex;justify-content:flex-end"><button type="button" data-arch-go onclick="rrArchiveGo(' + k + ', this, false)" style="' + _BTN + '">' + esc(W('archiveGo')) + '</button></div>';
    } else if (!block && !unsold) {   // only things the person may leave (release 10: unpaid invoices)
      html += '<div style="margin-top:0.8rem;display:flex;justify-content:flex-end"><button type="button" data-arch-anyway onclick="rrArchiveGo(' + k + ', this, true)" style="' + _BTN + '">' + esc(W('unsoldAnyway')) + '</button></div>';
    } else if (!block && unsold) {
      html += '<div style="display:grid;gap:0.45rem;margin-top:0.8rem">' +
        '<button type="button" data-arch-move onclick="rrArchiveMoveThem()" style="' + _BTN2 + '">' + esc(W('unsoldMove')) + '</button>' +
        '<button type="button" data-arch-return onclick="rrArchiveReturnGo(' + k + ', this)" style="' + _BTN2 + '">' + esc(W('unsoldReturn')) + '</button>' +
        '<button type="button" data-arch-anyway onclick="rrArchiveGo(' + k + ', this, true)" style="' + _BTN + '">' + esc(W('unsoldAnyway')) + '</button></div>';
    }
    box.innerHTML = html;
  }
  function rrArchiveFinishMove(id, btn) {
    var run = async function () {
      var r = (typeof rrMoveFinish === 'function') ? await rrMoveFinish(id) : null;
      if (_archKey && document.getElementById('rr-coll-archive')) await _paintChecks(_archKey);
      return r;
    };
    if (typeof rrOnce === 'function') return rrOnce('rr-coll-arch-finish', run, btn);
    return run();
  }
  function rrArchiveMoveThem() {
    _close('rr-coll-archive');
    if (typeof rrMoveOpen === 'function') rrMoveOpen(_unsoldKeys());
  }
  function rrArchiveGo(key, btn, anyway) {
    var run = async function () {
      var r = await rrArchiveCollection(key, { anyway: !!anyway });
      if (!r.ok) {
        if (r.why === 'open' || r.why === 'ask') { await _paintChecks(key); return r; }
        toast(W('archiveFailed'), 6000, true); return r;
      }
      _close('rr-coll-archive');
      toast(W('archiveDone', { label: _label(rrCollectionByKey(key)) }), 4500);
      try { if (typeof buildApp === 'function') buildApp(); } catch (e) {}
      return r;
    };
    if (typeof rrOnce === 'function') return rrOnce('rr-coll-archive-go', run, btn);
    return run();
  }
  function rrArchiveReturnGo(key, btn) {
    var run = async function () {
      var keys = _unsoldKeys();
      if (!keys.length) { await _paintChecks(key); return { ok: true, n: 0 }; }
      if (_offline()) { toast(W('returnOffline'), 4500, true); return { ok: false }; }
      var yes = await appConfirm(W('returnAsk', { n: _items(keys.length) }), { ok: W('returnOk') });
      if (!yes) return { ok: false };
      var r = await rrArchiveMarkReturned(keys);
      toast(r.ok ? W('returnDone', { n: _items(r.n) }) : W('returnFailed', { n: r.n }), r.ok ? 4000 : 8000, !r.ok);
      try { if (typeof buildApp === 'function') buildApp(); } catch (e) {}
      if (document.getElementById('rr-coll-archive')) await _paintChecks(key);
      return r;
    };
    if (typeof rrOnce === 'function') return rrOnce('rr-coll-arch-return', run, btn);
    return run();
  }
  function rrUnarchiveGo(key, btn) {
    var run = async function () {
      var r = await rrUnarchiveCollection(key);
      if (!r.ok) { toast(W('unarchiveFailed'), 6000, true); return r; }
      _close('rr-coll-details');
      toast(W('unarchived', { label: _label(rrCollectionByKey(key)) }), 4000);
      try { if (typeof buildApp === 'function') buildApp(); } catch (e) {}
      return r;
    };
    if (typeof rrOnce === 'function') return rrOnce('rr-coll-unarchive', run, btn);
    return run();
  }

  // Delete: the confirm with what goes and the typed name.
  function rrDeleteOpen(key) {
    if (typeof rrStaffGate === 'function' && !rrStaffGate('delete')) return;   // TRR Pro staff PINs: the roles door (staff.js)
    var c = rrCollectionByKey(key);
    if (!c || c.home) { toast(W('homeNo'), 3500, true); return; }
    if (!rrCollectionIsArchived(key)) { toast(W('deleteOnlyArchived'), 4000, true); return; }
    _close('rr-coll-details');
    var html = _title(W('deleteTitle', { label: _label(c) })) +
      '<div id="rr-del-what" style="font-size:0.9rem;line-height:1.45">' + esc(W('deleteWhat', { items: W('counting') })) + '</div>' +
      '<div style="font-size:0.85rem;color:var(--text-dim);line-height:1.45;margin-top:0.5rem">' + esc(W('deleteKeep')) + '</div>' +
      '<label for="rr-del-name" style="display:block;font-size:0.85rem;margin:0.9rem 0 0.25rem">' + esc(W('deleteType', { name: c.name })) + '</label>' +
      '<input id="rr-del-name" autocomplete="off" style="' + _INP + '">' +
      '<div style="margin-top:1rem;display:flex;justify-content:flex-end"><button type="button" data-del-go onclick="rrDeleteGo(' + jsArg(key) + ', this)" style="' + _BTN + ';background:var(--t-red)">' + esc(W('deleteGo')) + '</button></div>';
    _dialog('rr-coll-delete', html);
    rrArchiveItemCount(c.sheetId).then(function (n) {
      var el = document.getElementById('rr-del-what');
      if (el && n != null) el.textContent = W('deleteWhat', { items: _items(n) });
    });
  }
  function rrDeleteGo(key, btn) {
    var run = async function () {
      var typed = (document.getElementById('rr-del-name') || {}).value || '';
      var c = rrCollectionByKey(key);
      var r = await rrDeleteCollection(key, typed);
      if (!r.ok) {
        var w = { name: 'deleteWrong', notArchived: 'deleteOnlyArchived', home: 'homeNo', offline: 'deleteOffline' }[r.why] || 'deleteFailed';
        if (r.why === 'linked') { toast((typeof RR_COLL_HANDOVER !== 'undefined' && RR_COLL_HANDOVER.words.linkedNoDelete) || '', 6000, true); return r; }
        toast(W(w), 6000, true); return r;
      }
      _close('rr-coll-delete');
      toast(W('deleteDone', { label: _label(c) }), 6000);
      return r;
    };
    if (typeof rrOnce === 'function') return rrOnce('rr-coll-delete-go', run, btn);
    return run();
  }
  function rrRestoreGo(key, btn) {
    var run = async function () {
      var e = _entry(key);
      var lab = e ? (e.number + ' – ' + e.name) : '';
      var r = await rrRestoreCollection(key);
      if (!r.ok) { toast(r.why === 'gone' ? W('restoreGone', { label: lab }) : W('restoreFailed'), 7000, true); return r; }
      toast(W('restored', { label: lab, heading: rrArchiveHeading() }), 4500);
      try { if (typeof rrCollMenuFilter === 'function') rrCollMenuFilter(''); } catch (eM) {}
      return r;
    };
    if (typeof rrOnce === 'function') return rrOnce('rr-coll-restore-' + key, run, btn);
    return run();
  }

  // The archived heading's name — three choices or your own.
  function rrArchiveHeadingOpen() {
    var cur = rrArchiveHeading();
    var opts = (A().headings || []).slice();
    var own = opts.indexOf(cur) < 0;
    var html = _title(W('headingTitle')) + opts.map(function (h) {
      return '<label style="display:flex;align-items:center;gap:0.6rem;min-height:42px;cursor:pointer"><input type="radio" name="rr-arch-h" value="' + esc(h) + '"' + (h === cur ? ' checked' : '') + ' style="width:1.15rem;height:1.15rem">' + esc(h) + '</label>';
    }).join('') +
      '<label style="display:flex;align-items:center;gap:0.6rem;min-height:42px;cursor:pointer"><input type="radio" name="rr-arch-h" value="" data-own' + (own ? ' checked' : '') + ' style="width:1.15rem;height:1.15rem">' + esc(W('headingOwn')) + '</label>' +
      '<input id="rr-arch-h-own" maxlength="' + (A().headingMax || 30) + '" value="' + esc(own ? cur : '') + '" style="' + _INP + '" oninput="var r=document.querySelector(\'input[name=rr-arch-h][data-own]\');if(r)r.checked=true">' +
      '<div style="margin-top:1rem;display:flex;justify-content:flex-end"><button type="button" onclick="rrArchiveHeadingSave()" style="' + _BTN + '">' + esc(W('headingSave')) + '</button></div>';
    _dialog('rr-coll-arch-heading', html);
  }
  function rrArchiveHeadingSave() {
    if (typeof rrStaffGate === 'function' && !rrStaffGate('business')) return;   // TRR Pro staff PINs: the roles door (staff.js)
    var pick = document.querySelector('input[name="rr-arch-h"]:checked');
    var v = pick && !pick.hasAttribute('data-own') ? pick.value : ((document.getElementById('rr-arch-h-own') || {}).value || '');
    rrArchiveHeadingSet(v);
    _close('rr-coll-arch-heading');
    toast(W('headingSaved'), 2500);
    _repaint();
    try { if (document.getElementById('rr-coll-list') && typeof rrCollMenuFilter === 'function') rrCollMenuFilter(''); } catch (e) {}
  }

  // ── pieces the other screens draw (collections-ui.js) ───────────────────
  // The menu: the archived heading (folded) with each archived collection,
  // then Recently deleted (folded) with Restore.
  function rrArchiveMenuHtml(entries, match, curKey) {
    var arch = (entries || []).filter(function (e) { return e && e.status === 'archived' && (!match || match(e)); })
      .sort(function (a, b) { return (Number(b.archivedAt) || 0) - (Number(a.archivedAt) || 0); });
    var gone = rrRecentlyDeleted();
    var row = function (e) {
      return '<button type="button" onclick="rrCollChoose(' + jsArg(e.key) + ')" style="' + _ROW + ';cursor:pointer' + (curKey === e.key ? ';border-color:var(--accent);border-width:2px' : '') + '">' +
        '<span style="flex:1;min-width:0"><span style="display:block;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(e.number + ' – ' + e.name) + '</span>' +
        '<span style="display:block;font-size:0.8rem;color:var(--text-dim)">' + esc(W('archivedOn', { date: _day(e.archivedAt) })) + '</span></span></button>';
    };
    var words = (typeof RR_COLL_UI !== 'undefined' && RR_COLL_UI.words) || {};
    var html = '';
    html += '<details data-arch-list style="margin-top:0.5rem"' + (curKey && arch.some(function (e) { return e.key === curKey; }) ? ' open' : '') + '><summary style="cursor:pointer;min-height:40px;padding:0.4rem 0.2rem">' +
      esc(String(words.archived || '{heading} ({n})').split('{heading}').join(rrArchiveHeading()).split('{n}').join(String(arch.length))) + '</summary>' +
      arch.map(row).join('') +
      '<button type="button" onclick="rrArchiveHeadingOpen()" style="' + _ROW + ';justify-content:center;cursor:pointer;color:var(--t-link);font-size:0.85rem">' + esc(W('headingBtn')) + '</button></details>';
    if (gone.length) {
      html += '<details data-deleted-list style="margin-top:0.3rem"><summary style="cursor:pointer;min-height:40px;padding:0.4rem 0.2rem">' + esc(W('recentlyDeleted', { n: gone.length })) + '</summary>' +
        '<div style="font-size:0.8rem;color:var(--text-dim);margin:0.1rem 0.2rem">' + esc(W('restoreHelp')) + '</div>' +
        gone.map(function (e) {
          return '<div style="' + _ROW + '"><span style="flex:1;min-width:0"><span style="display:block;font-weight:700">' + esc(e.number + ' – ' + e.name) + '</span>' +
            '<span style="display:block;font-size:0.8rem;color:var(--text-dim)">' + esc(W('deletedOn', { date: _day(e.deletedAt) })) + '</span></span>' +
            '<button type="button" data-restore="' + esc(e.key) + '" onclick="rrRestoreGo(' + jsArg(e.key) + ', this)" style="' + _BTN + ';min-height:36px;padding:0.3rem 0.7rem;font-size:0.85rem">' + esc(W('restoreBtn')) + '</button></div>';
        }).join('') + '</details>';
    }
    return html;
  }
  // The details card: what it says and the buttons at its foot.
  function rrArchiveDetailsHtml(c) {
    if (!c || c.home) return '';
    var k = jsArg(c.key);
    if (rrCollectionIsArchived(c.key)) {
      return '<div style="margin-top:0.9rem;padding:0.6rem 0.7rem;border-radius:9px;background:var(--surface2);font-size:0.88rem">' + esc(W('readOnlyDetails')) + '</div>' +
        '<div style="margin-top:0.8rem;display:flex;gap:0.5rem;flex-wrap:wrap;justify-content:flex-end">' +
        '<button type="button" data-del-open onclick="rrDeleteOpen(' + k + ')" style="' + _BTN2 + ';color:var(--t-red)">' + esc(W('deleteBtn')) + '</button>' +
        '<button type="button" data-unarchive onclick="rrUnarchiveGo(' + k + ', this)" style="' + _BTN + '">' + esc(W('unarchive')) + '</button></div>';
    }
    return '<div style="margin-top:1.1rem;border-top:1px solid var(--border);padding-top:0.7rem"><button type="button" data-arch-open onclick="rrArchiveOpen(' + k + ')" style="' + _BTN2 + '">' + esc(W('archiveBtn')) + '</button></div>';
  }
  // The status words for the details card.
  function rrArchiveStatusWords(c) {
    var e = c && _entry(c.key);
    if (!c || !rrCollectionIsArchived(c.key)) return '';
    return W('statusArchived') + (e && e.archivedAt ? ' ' + _day(e.archivedAt) : '');
  }
  // The open collection's banner: "Archived – Hale is read only · Un-archive".
  function rrArchiveBannerHtml(c) {
    if (!c || c.home || !rrCollectionIsArchived(c.key)) return '';
    return '<div id="rr-coll-archived-banner" role="status" style="display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap;margin-top:0.5rem;padding:0.45rem 0.7rem;border-radius:8px;background:var(--surface);border:1px dashed var(--border);font-size:0.9rem;font-weight:700">' +
      '<span style="flex:1">' + esc(W('banner', { heading: rrArchiveHeading(), name: c.name || '' })) + '</span>' +
      '<button type="button" onclick="rrUnarchiveGo(' + jsArg(c.key) + ', this)" style="' + _BTN2 + ';min-height:36px;padding:0.3rem 0.8rem;font-size:0.85rem">' + esc(W('unarchive')) + '</button></div>';
  }

  // ── keeping up with other devices ───────────────────────────────────────
  // The list is asked again at start (rrCollectionsBoot), on coming back to
  // the app, and every few minutes. The open collection deleted elsewhere →
  // back to home; archived or un-archived elsewhere → the screens repaint.
  var _refreshing = false, _timer = null;
  async function rrArchiveRefresh() {
    if (!_on() || _refreshing || _offline()) return '';
    _refreshing = true;
    try {
      var ch = await rrCollectionsRefresh();
      if (ch === 'deleted') {
        if (typeof rrCollSwitchTo === 'function') await rrCollSwitchTo('home', { quiet: true });
        if (typeof rrCollectionsSync === 'function') rrCollectionsSync(rrCollectionsData());
      }
      if (ch) { _repaint(); try { if (typeof buildApp === 'function') buildApp(); } catch (e) {} }
      return ch;
    } catch (e) { return ''; } finally { _refreshing = false; }
  }
  function rrArchiveWatch() {
    if (_timer || typeof setInterval !== 'function') return;
    _timer = setInterval(function () { rrArchiveRefresh(); }, A().refreshMs || 300000);
    try {
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') rrArchiveRefresh(); });
    } catch (e) {}
  }

  var api = {
    rrArchiveHeading: rrArchiveHeading, rrArchiveHeadingSet: rrArchiveHeadingSet,
    rrArchiveChecks: rrArchiveChecks, rrArchiveCollection: rrArchiveCollection, rrUnarchiveCollection: rrUnarchiveCollection,
    rrArchiveMarkReturned: rrArchiveMarkReturned, rrArchiveReturnedDate: rrArchiveReturnedDate,
    rrArchiveForwardList: rrArchiveForwardList, rrArchiveItemCount: rrArchiveItemCount,
    rrDeleteCollection: rrDeleteCollection, rrRecentlyDeleted: rrRecentlyDeleted, rrRestoreCollection: rrRestoreCollection,
    rrArchiveLabelFind: rrArchiveLabelFind, rrArchiveDeletedByNumber: rrArchiveDeletedByNumber,
    rrArchiveOpen: rrArchiveOpen, rrArchiveFinishMove: rrArchiveFinishMove, rrArchiveMoveThem: rrArchiveMoveThem,
    rrArchiveGo: rrArchiveGo, rrArchiveReturnGo: rrArchiveReturnGo, rrUnarchiveGo: rrUnarchiveGo,
    rrDeleteOpen: rrDeleteOpen, rrDeleteGo: rrDeleteGo, rrRestoreGo: rrRestoreGo,
    rrArchiveHeadingOpen: rrArchiveHeadingOpen, rrArchiveHeadingSave: rrArchiveHeadingSave,
    rrArchiveMenuHtml: rrArchiveMenuHtml, rrArchiveDetailsHtml: rrArchiveDetailsHtml, rrArchiveStatusWords: rrArchiveStatusWords,
    rrArchiveBannerHtml: rrArchiveBannerHtml, rrArchiveRefresh: rrArchiveRefresh, rrArchiveWatch: rrArchiveWatch,
  };
  Object.keys(api).forEach(function (k) { root[k] = api[k]; });
  root._rrArchiveReset = function () { _archKey = null; _refreshing = false; _returnedRe = null; };   // test hook
})(typeof window !== 'undefined' ? window : globalThis);
