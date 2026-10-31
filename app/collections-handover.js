// ═══════════════════════════════════════════════════════════════════════════
// collections-handover.js — TRR Pro release 7B (part 1): HAND OVER A
// COLLECTION TO ITS CLIENT
// ═══════════════════════════════════════════════════════════════════════════
// Design agreed with Brad 2026-10-28 (PLAN_2026-10-28_TRR_PRO.md: "Hand over
// to client — good": the finished PDF report; Google ownership of the sheet
// and photos, the client presses Accept; afterwards keep access — it becomes a
// linked collection — or remove it; a Movement Log line; nothing deleted).
// [stated] Brad 2026-10-31 08:28 CT "yes" to ONE Google ownership request per
// file. Plan PLAN_2026-10-31_TRR_PRO_R7B.md.
//
// Google moves ownership one FILE at a time — owning a folder does not make
// you owner of what is in it — so a hand-over asks for every file: the sheet,
// the collection's folders, every photo. A personal Gmail account must accept
// (Drive → Shared with me: select all, accept once). The steps, each written
// down in the collections list as it goes, so a stop part way carries on:
//   sending    one request per file (role writer + pendingOwner), Google's
//              email with the first one only; the Movement Log line at the end
//   waiting    "N of M accepted" — asked file by file on Check now
//   accepted   the business chooses: KEEP (status linked: it stays in the
//              list and works as ever; the client owns it) or REMOVE (the
//              business's own access is taken off every file; status
//              handedOver — the record stays, the number is never reused)
//   cancel     before acceptance: the requests are taken back
// Nothing here ever deletes or trashes a file.
//
// ON only through RR_COLL_UI.feature. Every word: RR_COLL_HANDOVER (config.js).
// ═══════════════════════════════════════════════════════════════════════════
/* eslint-disable no-var */
(function (root) {
  'use strict';

  function H() { return (typeof RR_COLL_HANDOVER !== 'undefined' && RR_COLL_HANDOVER) || root.RR_COLL_HANDOVER || { words: {} }; }
  function W(k, vars) {
    var t = String((H().words || {})[k] || '');
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
  function _label(c) {
    if (!c) return '';
    return (typeof rrCollectionLabel === 'function') ? rrCollectionLabel(c) : (c.number + ' – ' + c.name);
  }
  function _clone(o) { return JSON.parse(JSON.stringify(o)); }
  function _entry(key) {
    var d = (typeof rrCollectionsData === 'function') ? rrCollectionsData() : null;
    return (d && d.items && d.items[key]) || null;
  }
  function _me() { var u = st().user || {}; return String(u.email || '').toLowerCase(); }
  function _repaint() {
    try { if (typeof rrApplyListSwitches === 'function') rrApplyListSwitches(); } catch (e) {}
    try { if (typeof rrCollUiPaint === 'function') rrCollUiPaint(); } catch (e) {}
  }
  function _dialog(id, html) {
    var full = false; try { full = typeof rrIsPhone === 'function' && rrIsPhone(); } catch (e) {}
    return (typeof rrCollDialog === 'function') ? rrCollDialog(id, html, full) : null;
  }
  function _close(id) { try { var d = document.getElementById(id); if (d) d.remove(); } catch (e) {} }
  var _BTN = 'min-height:42px;padding:0.5rem 1rem;border-radius:9px;border:none;background:var(--accent);color:var(--on-accent);font-family:var(--font-body);font-size:0.95rem;font-weight:700;cursor:pointer';
  var _BTN2 = 'min-height:42px;padding:0.5rem 1rem;border-radius:9px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.95rem;font-weight:600;cursor:pointer';

  // The client (from the home Contacts — through the ONE privacy door).
  function _client(c) {
    var p = (typeof rrCollectionClient === 'function') ? rrCollectionClient(c) : null;
    if (!p) return null;
    return { name: String(p.name || p.business || ''), email: String(p.email || '').trim() };
  }

  // ── what goes: every file of the collection ───────────────────────────────
  // The sheet first (its request carries Google's one email), the collection's
  // folder, then everything inside it, folder by folder. Never a file twice.
  async function rrHandOverFiles(e) {
    var out = [], seen = {};
    var add = function (id) { if (id && !seen[id]) { seen[id] = true; out.push(String(id)); } };
    add(e.sheetId);
    if (!e.folderId) return out;
    add(e.folderId);
    var queue = [String(e.folderId)];
    while (queue.length) {
      var parent = queue.shift(), token = '';
      do {
        var q = encodeURIComponent("'" + parent + "' in parents and trashed=false");
        var res = await driveRequest('GET', '/files?q=' + q + '&fields=nextPageToken,files(id,mimeType)&pageSize=1000' + (token ? '&pageToken=' + encodeURIComponent(token) : ''));
        ((res && res.files) || []).forEach(function (f) {
          if (!f || !f.id || seen[f.id]) return;
          add(f.id);
          if (f.mimeType === 'application/vnd.google-apps.folder') queue.push(String(f.id));
        });
        token = (res && res.nextPageToken) || '';
      } while (token);
    }
    return out;
  }

  async function _save(key, h, extra) {
    return rrCollectionsFileUpdate(function (d) {
      if (!d.items[key]) return false;
      d.items[key].handover = _clone(h);
      if (extra) Object.assign(d.items[key], extra);
      d.items[key].at = Date.now();
    });
  }

  // ── 1. sending ────────────────────────────────────────────────────────────
  // opts: { keep, onProgress(n, total) }. Safe to press again: a file already
  // asked for is skipped (written down every `batch` files and at the end).
  async function rrHandOverStart(key, opts) {
    opts = opts || {};
    if (_offline()) return { ok: false, why: 'offline' };
    var c = rrCollectionByKey(key);
    if (!c || c.home) return { ok: false, why: 'home' };
    var cur = rrCurrentCollection();
    if (!cur || cur.key !== key) return { ok: false, why: 'open' };
    var got = await rrCollectionsFileRead();
    if (!got || !got.ok) return { ok: false, why: 'failed' };
    var e = got.data.items[key];
    if (!e || e.status !== 'active') return { ok: false, why: e && e.status === 'archived' ? 'archived' : 'state' };
    var mv = ((got.data && got.data.moves) ? Object.keys(got.data.moves).map(function (k) { return got.data.moves[k]; }) : [])
      .filter(function (m) { return m && (m.from === key || m.to === key); });
    if (mv.length) return { ok: false, why: 'moves' };
    var who = _client(c);
    if (!who) return { ok: false, why: 'client' };
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(who.email)) return { ok: false, why: 'email', name: who.name };
    var h = e.handover && ['sending', 'waiting'].indexOf(e.handover.state) >= 0 && e.handover.email === who.email
      ? e.handover
      : { state: 'sending', email: who.email, clientName: who.name, startedAt: Date.now(), files: [], sent: {}, failed: {}, accepted: 0 };
    if (opts.keep != null) h.keep = !!opts.keep;
    try {
      if (!h.files.length) { h.files = await rrHandOverFiles(e); await _save(key, h); }
      var batch = Math.max(1, Number(H().batch) || 20), since = 0, total = h.files.length;
      h.failed = {};
      for (var i = 0; i < total; i++) {
        var id = h.files[i];
        if (h.sent[id]) continue;
        try {
          await _ask(id, who.email, i === 0 || !H().emailFirstOnly);
          h.sent[id] = true;
        } catch (er) {
          if (i === 0) {   // the sheet itself refused: nothing is sent at all
            await _save(key, Object.assign(h, { state: 'refused' }));
            return { ok: false, why: 'refused', error: (er && er.message) || String(er) };
          }
          if (er && er.status && er.status < 500 && er.status !== 429) h.failed[id] = String(er.status);
          else throw er;
        }
        if (++since >= batch) { since = 0; await _save(key, h); }
        try { if (typeof opts.onProgress === 'function') opts.onProgress(Object.keys(h.sent).length, total); } catch (eP) {}
      }
      var sent = Object.keys(h.sent).length, bad = Object.keys(h.failed).length;
      if (!bad && h.state === 'sending') {
        h.state = 'waiting'; h.sentAt = Date.now();
        try {
          var when = (typeof _shWhen === 'function') ? _shWhen(new Date()) : rrToday();
          var me = (st().user && (st().user.email || st().user.name)) || '';
          await rrMoveLogAddTo(c.sheetId, ["'" + when, '', '', W('logItem') || _label(c), _label(c), h.clientName || '', me, H().logHow || 'Handed over']);
        } catch (eLog) { console.warn('[Collections] hand-over — Movement Log line:', eLog && eLog.message); }
      }
      await _save(key, h);
      _repaint();
      return { ok: !bad, why: bad ? 'some' : '', sent: sent, total: total, bad: bad, name: h.clientName };
    } catch (er2) {
      try { await _save(key, h); } catch (eS) {}
      console.warn('[Collections] hand-over stopped:', er2 && er2.message);
      return { ok: false, why: 'stopped', sent: Object.keys(h.sent).length, total: h.files.length };
    }
  }
  async function _ask(id, email, notify) {
    var body = { role: 'writer', type: 'user', emailAddress: email, pendingOwner: true };
    try {
      return await driveRequest('POST', '/files/' + id + '/permissions?sendNotificationEmail=' + (notify ? 'true' : 'false') + '&fields=id', body);
    } catch (e) {
      // Google may insist on its own email for an ownership request: ask once more with it
      if (!notify && e && (e.status === 400 || e.status === 403)) return driveRequest('POST', '/files/' + id + '/permissions?sendNotificationEmail=true&fields=id', body);
      throw e;
    }
  }

  // ── 2. waiting: how many are accepted ───────────────────────────────────
  async function rrHandOverCheck(key, onProgress) {
    var got = await rrCollectionsFileRead();
    var e = got && got.ok && got.data.items[key];
    var h = e && e.handover;
    if (!h || ['waiting', 'accepted'].indexOf(h.state) < 0) return { ok: false, why: 'state' };
    var n = 0, total = h.files.length;
    try {
      for (var i = 0; i < total; i++) {
        try {
          var f = await driveRequest('GET', '/files/' + h.files[i] + '?fields=id,ownedByMe');
          if (f && f.ownedByMe === false) n++;
        } catch (er) { if (er && er.status === 404) n++; else throw er; }   // gone from us = no longer ours
        try { if (typeof onProgress === 'function') onProgress(i + 1, total); } catch (eP) {}
      }
    } catch (er2) { return { ok: false, why: 'failed' }; }
    h.accepted = n; h.checkedAt = Date.now();
    if (n >= total) h.state = 'accepted';
    await _save(key, h);
    return { ok: true, accepted: n, total: total, all: n >= total, name: h.clientName };
  }

  // Every file, one permission each: find it and take it off.
  async function _dropPermission(key, h, mark, match, onProgress) {
    h[mark] = h[mark] || {};
    var batch = Math.max(1, Number(H().batch) || 20), since = 0, total = h.files.length;
    for (var i = 0; i < total; i++) {
      var id = h.files[i];
      if (h[mark][id]) continue;
      try {
        var res = await driveRequest('GET', '/files/' + id + '/permissions?fields=permissions(id,emailAddress,role,pendingOwner)');
        var ps = ((res && res.permissions) || []).filter(match);
        for (var j = 0; j < ps.length; j++) await driveRequest('DELETE', '/files/' + id + '/permissions/' + ps[j].id);
      } catch (er) { if (!(er && er.status === 404)) throw er; }
      h[mark][id] = true;
      if (++since >= batch) { since = 0; await _save(key, h); }
      try { if (typeof onProgress === 'function') onProgress(Object.keys(h[mark]).length, total); } catch (eP) {}
    }
  }

  // ── cancel (before they accept): the requests are taken back ─────────────
  async function rrHandOverCancel(key) {
    if (_offline()) return { ok: false, why: 'offline' };
    var got = await rrCollectionsFileRead();
    var e = got && got.ok && got.data.items[key];
    var h = e && e.handover;
    if (!h || ['sending', 'waiting', 'refused'].indexOf(h.state) < 0) return { ok: false, why: 'state' };
    var email = String(h.email || '').toLowerCase();
    try {
      h.state = 'cancelling';
      await _dropPermission(key, h, 'taken', function (p) { return p && p.role !== 'owner' && String(p.emailAddress || '').toLowerCase() === email; });
      h.state = 'cancelled'; h.cancelledAt = Date.now();
      await _save(key, h);
      _repaint();
      return { ok: true };
    } catch (er) {
      try { await _save(key, h); } catch (eS) {}
      return { ok: false, why: 'failed' };
    }
  }

  // ── 3. after they accepted: keep it linked, or remove it ─────────────────
  async function rrHandOverKeep(key) {
    var got = await rrCollectionsFileRead();
    var e = got && got.ok && got.data.items[key];
    if (!e || !e.handover || e.handover.state !== 'accepted') return { ok: false, why: 'state' };
    var h = e.handover; h.state = 'done'; h.doneAt = Date.now();
    var d = await _save(key, h, { status: 'linked', linked: true, linkedAt: Date.now(), owner: h.email, ownerName: h.clientName });
    if (typeof rrCollectionsSync === 'function') rrCollectionsSync(d);
    _repaint();
    return { ok: true };
  }
  // Remove (after acceptance) or Unlink (a linked one): this account's access
  // comes off every file; the record stays (status handedOver).
  async function rrHandOverRemove(key, onProgress) {
    if (_offline()) return { ok: false, why: 'offline' };
    var got = await rrCollectionsFileRead();
    var e = got && got.ok && got.data.items[key];
    var h = e && e.handover;
    var okState = h && (h.state === 'accepted' || h.state === 'removing' || (h.state === 'done' && e.status === 'linked'));
    if (!okState) return { ok: false, why: 'state' };
    var me = _me();
    if (!me) return { ok: false, why: 'failed' };
    try {
      var cur = rrCurrentCollection();
      if (cur && cur.key === key) {
        var sw = (typeof rrCollSwitchTo === 'function') ? await rrCollSwitchTo('home', { quiet: true }) : await rrSwitchCollection('home', {});
        if (!sw || !sw.ok) return { ok: false, why: 'failed' };
      }
      h.state = 'removing';
      await _save(key, h);
      await _dropPermission(key, h, 'removed', function (p) { return p && p.role !== 'owner' && String(p.emailAddress || '').toLowerCase() === me; }, onProgress);
      h.state = 'done'; h.doneAt = Date.now();
      var d = await _save(key, h, { status: 'handedOver', handedOverAt: Date.now(), linked: false });
      if (typeof rrCollectionsSync === 'function') rrCollectionsSync(d);
      try {
        var ls = _ls();
        if (ls) [rrPersonalCacheKey('', e), rrPersonalCacheKey('ts', e), rrInvHwmKey(e)].forEach(function (k) { if (k) ls.removeItem(k); });
      } catch (eL) {}
      _repaint();
      return { ok: true };
    } catch (er) {
      try { await _save(key, h); } catch (eS) {}
      console.warn('[Collections] hand-over remove:', er && er.message);
      return { ok: false, why: 'failed' };
    }
  }

  // ═══ the screens ════════════════════════════════════════════════════════
  function _why(r, c) {
    var who = c ? _client(c) : null;
    return { open: W('openFirst', { label: _label(c) }), archived: W('archivedFirst'), moves: W('movesFirst'), client: W('needClient'),
      email: W('needEmail', { name: (r && r.name) || (who && who.name) || '' }), offline: W('offline'),
      refused: W('refused', { why: (r && r.error) || '' }), stopped: W('failed') }[r && r.why] || W('failed');
  }
  function rrHandOverOpen(key) {
    var c = rrCollectionByKey(key);
    if (!c || c.home) return;
    var cur = rrCurrentCollection();
    if (!cur || cur.key !== key) { toast(W('openFirst', { label: _label(c) }), 4000, true); return; }
    if (typeof rrCollectionIsArchived === 'function' && rrCollectionIsArchived(key)) { toast(W('archivedFirst'), 4000, true); return; }
    var who = _client(c);
    if (!who) { toast(W('needClient'), 5000, true); return; }
    if (!who.email) { toast(W('needEmail', { name: who.name }), 5000, true); return; }
    _close('rr-coll-details');
    var html = '<div style="font-family:var(--font-head);font-size:1.2rem;font-weight:700;margin:0.2rem 2.2rem 0.6rem 0">' + esc(W('title', { label: _label(c) })) + '</div>' +
      '<div style="font-weight:700">' + esc(W('to', { name: who.name, email: who.email })) + '</div>' +
      '<div style="font-size:0.88rem;color:var(--text-dim);line-height:1.45;margin-top:0.4rem">' + esc(W('intro')) + '</div>' +
      '<div style="font-weight:700;margin-top:0.9rem">' + esc(W('step1')) + '</div>' +
      '<button type="button" data-ho-report onclick="rrHandOverReport()" style="' + _BTN2 + ';margin-top:0.35rem">' + esc(W('reportBtn')) + '</button>' +
      '<div style="font-weight:700;margin-top:0.9rem">' + esc(W('step2')) + '</div>' +
      '<div id="rr-ho-count" style="font-size:0.88rem;margin-top:0.25rem">' + esc(W('counting')) + '</div>' +
      '<div style="font-size:0.88rem;margin-top:0.6rem">' + esc(W('after')) + '</div>' +
      '<label style="display:flex;gap:0.5rem;align-items:center;min-height:40px;cursor:pointer"><input type="radio" name="rr-ho-after" value="keep" checked style="width:1.1rem;height:1.1rem">' + esc(W('keep')) + '</label>' +
      '<label style="display:flex;gap:0.5rem;align-items:center;min-height:40px;cursor:pointer"><input type="radio" name="rr-ho-after" value="remove" style="width:1.1rem;height:1.1rem">' + esc(W('remove')) + '</label>' +
      '<div id="rr-ho-status" style="font-size:0.88rem;margin-top:0.5rem"></div>' +
      '<div style="margin-top:0.9rem;display:flex;justify-content:flex-end"><button type="button" data-ho-send onclick="rrHandOverSend(' + jsArg(key) + ', this)" style="' + _BTN + '">' + esc(W('send')) + '</button></div>';
    _dialog('rr-coll-handover', html);
    var e = _entry(key);
    if (e) rrHandOverFiles(e).then(function (ids) {
      var el = document.getElementById('rr-ho-count'); if (el) el.textContent = W('count', { n: ids.length });
    }).catch(function () {});
  }
  function rrHandOverReport() {
    _close('rr-coll-handover');
    try { if (typeof showPage === 'function') showPage('reports', null); } catch (e) {}
  }
  function rrHandOverSend(key, btn) {
    var run = async function () {
      var pick = document.querySelector('input[name="rr-ho-after"]:checked');
      var status = document.getElementById('rr-ho-status');
      var r = await rrHandOverStart(key, { keep: !pick || pick.value !== 'remove', onProgress: function (n, t) { if (status) status.textContent = W('sending', { n: n, total: t }); } });
      if (r.ok) { _close('rr-coll-handover'); toast(W('sent', { name: r.name, n: r.sent }), 6000); return r; }
      if (r.why === 'some') { if (status) status.textContent = W('sentSome', { n: r.sent, total: r.total, bad: r.bad }); return r; }
      toast(_why(r, rrCollectionByKey(key)), 7000, true);
      return r;
    };
    if (typeof rrOnce === 'function') return rrOnce('rr-coll-handover-send', run, btn);
    return run();
  }
  function rrHandOverCheckGo(key, btn) {
    var run = async function () {
      var box = document.getElementById('rr-ho-wait');
      if (box) box.textContent = W('checking');
      var r = await rrHandOverCheck(key, function (n, t) { if (box) box.textContent = W('checking') + ' ' + n + ' / ' + t; });
      if (!r.ok) { toast(W('failed'), 5000, true); }
      else if (r.all) toast(W('accepted', { name: r.name }), 4000);
      _refreshDetails(key);
      return r;
    };
    if (typeof rrOnce === 'function') return rrOnce('rr-coll-handover-check', run, btn);
    return run();
  }
  function rrHandOverCancelGo(key, btn) {
    var run = async function () {
      var e = _entry(key);
      var yes = await appConfirm(W('cancelAsk', { name: (e && e.handover && e.handover.clientName) || '' }), { ok: W('cancelOk') });
      if (!yes) return { ok: false };
      var r = await rrHandOverCancel(key);
      toast(r.ok ? W('cancelled') : W('failed'), 5000, !r.ok);
      _refreshDetails(key);
      return r;
    };
    if (typeof rrOnce === 'function') return rrOnce('rr-coll-handover-cancel', run, btn);
    return run();
  }
  function rrHandOverKeepGo(key, btn) {
    var run = async function () {
      var r = await rrHandOverKeep(key);
      var c = rrCollectionByKey(key), e = _entry(key);
      toast(r.ok ? W('linkedDone', { label: _label(c), name: (e && e.ownerName) || '' }) : W('failed'), 5000, !r.ok);
      _refreshDetails(key);
      return r;
    };
    if (typeof rrOnce === 'function') return rrOnce('rr-coll-handover-keep', run, btn);
    return run();
  }
  function rrHandOverRemoveGo(key, btn) {
    var run = async function () {
      var c = rrCollectionByKey(key), e = _entry(key);
      var name = (e && (e.ownerName || (e.handover && e.handover.clientName))) || '';
      var yes = await appConfirm(W('removeAsk', { label: _label(c), name: name }), { ok: W('removeOk') });
      if (!yes) return { ok: false };
      _close('rr-coll-details');
      var r = await rrHandOverRemove(key, function (n, t) { toast(W('removing', { n: n, total: t }), 1500); });
      toast(r.ok ? W('removed', { label: _label(c) }) : W('failed'), 6000, !r.ok);
      try { if (typeof buildApp === 'function') buildApp(); } catch (eB) {}
      return r;
    };
    if (typeof rrOnce === 'function') return rrOnce('rr-coll-handover-remove', run, btn);
    return run();
  }
  function _refreshDetails(key) {
    if (document.getElementById('rr-coll-details') && typeof rrCollDetailsOpen === 'function') rrCollDetailsOpen(key);
    _repaint();
  }

  // The details card's hand-over part (collections-ui.js draws it).
  function rrHandOverDetailsHtml(c) {
    if (!c || c.home) return '';
    if (typeof rrCollectionIsArchived === 'function' && rrCollectionIsArchived(c.key)) return '';
    var e = _entry(c.key) || {}, h = e.handover, k = jsArg(c.key);
    var box = 'margin-top:0.9rem;padding:0.6rem 0.7rem;border-radius:9px;background:var(--surface2);font-size:0.9rem';
    var row = function (inner) { return '<div style="margin-top:0.5rem;display:flex;gap:0.5rem;flex-wrap:wrap;justify-content:flex-end">' + inner + '</div>'; };
    if (e.status === 'linked') {
      return '<div data-ho-linked style="' + box + '">' + esc(W('linked', { name: e.ownerName || e.owner || '' })) + '</div>' +
        row('<button type="button" data-ho-unlink onclick="rrHandOverRemoveGo(' + k + ', this)" style="' + _BTN2 + '">' + esc(W('unlinkBtn')) + '</button>');
    }
    if (h && (h.state === 'sending' || h.state === 'waiting')) {
      return '<div id="rr-ho-wait" data-ho-wait style="' + box + '">' + esc(W('waiting', { name: h.clientName || '', n: h.accepted || 0, total: (h.files || []).length })) + '</div>' +
        row('<button type="button" data-ho-cancel onclick="rrHandOverCancelGo(' + k + ', this)" style="' + _BTN2 + '">' + esc(W('cancelBtn')) + '</button>' +
            (h.state === 'sending' ? '<button type="button" onclick="rrHandOverOpen(' + k + ')" style="' + _BTN + '">' + esc(W('send')) + '</button>'
                                   : '<button type="button" data-ho-check onclick="rrHandOverCheckGo(' + k + ', this)" style="' + _BTN + '">' + esc(W('checkBtn')) + '</button>'));
    }
    if (h && h.state === 'accepted') {
      return '<div data-ho-accepted style="' + box + '">' + esc(W('accepted', { name: h.clientName || '' })) + '</div>' +
        row('<button type="button" data-ho-remove onclick="rrHandOverRemoveGo(' + k + ', this)" style="' + _BTN2 + '">' + esc(W('removeBtn')) + '</button>' +
            '<button type="button" data-ho-keep onclick="rrHandOverKeepGo(' + k + ', this)" style="' + _BTN + '">' + esc(W('keepBtn')) + '</button>');
    }
    return '<div style="margin-top:0.6rem"><button type="button" data-ho-open onclick="rrHandOverOpen(' + k + ')" style="' + _BTN2 + '">' + esc(W('btn')) + '</button></div>';
  }

  var api = {
    rrHandOverFiles: rrHandOverFiles, rrHandOverStart: rrHandOverStart, rrHandOverCheck: rrHandOverCheck,
    rrHandOverCancel: rrHandOverCancel, rrHandOverKeep: rrHandOverKeep, rrHandOverRemove: rrHandOverRemove,
    rrHandOverOpen: rrHandOverOpen, rrHandOverReport: rrHandOverReport, rrHandOverSend: rrHandOverSend,
    rrHandOverCheckGo: rrHandOverCheckGo, rrHandOverCancelGo: rrHandOverCancelGo, rrHandOverKeepGo: rrHandOverKeepGo,
    rrHandOverRemoveGo: rrHandOverRemoveGo, rrHandOverDetailsHtml: rrHandOverDetailsHtml,
  };
  Object.keys(api).forEach(function (k) { root[k] = api[k]; });
})(typeof window !== 'undefined' ? window : globalThis);
