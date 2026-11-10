// ═══════════════════════════════════════════════════════════════════════════
// capture.js — TRR Pro: CAPTURE (sticker → photos → shelf), and the item
// that is NOT IDENTIFIED YET.
// ═══════════════════════════════════════════════════════════════════════════
// Plan PLAN_2026-11-09_PRO_CAPTURE.md. [stated] Brad 2026-11-09:
//   12:41 CT  the worker sticks a random QR code on every item; the operator
//             scans it, takes the photos, Next, shelves it and scans the shelf,
//             Finished, next item.
//   12:46 CT  "Show up in the collection" — the item is a row of the open
//             collection at once (number, sticker, shelf), identified later.
//   12:49 CT  "Yes" — build it.
//
// THE rule for "not identified yet" is rrToIdentify (app-data.js). This file
// owns how such an item LOOKS and what tapping it does:
//   rrCaptureName(rec)        its name everywhere a name is shown
//   rrCaptureRowHtml(rec, m)  its row in My Collection (m = phone card)
//   rrCaptureCardOpen(inv)    its own card (sticker, shelf, Identify, Remove)
// Every word: RR_CAPTURE (config.js).
// ═══════════════════════════════════════════════════════════════════════════
/* eslint-disable no-var */
(function (root) {
  'use strict';

  function W(k, vars) {
    var w = (typeof RR_CAPTURE !== 'undefined' && RR_CAPTURE.words) || (root.RR_CAPTURE && root.RR_CAPTURE.words) || {};
    var t = String(w[k] == null ? k : w[k]);
    Object.keys(vars || {}).forEach(function (v) { t = t.split('{' + v + '}').join(String(vars[v])); });
    return t;
  }
  function esc(s) {
    if (typeof rrEsc === 'function') return rrEsc(s);
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  // a value inside an on-click is QUOTED (guard G9 in the 7A suite: rrJsArg makes it safe, not quoted)
  function arg(s) { return "'" + ((typeof rrJsArg === 'function') ? rrJsArg(String(s)) : String(s).replace(/[\\'"<>&]/g, '')) + "'"; }
  function fullId(inv) {
    try { if (typeof rrFullId === 'function' && typeof rrCurrentCollection === 'function') return rrFullId(inv, rrCurrentCollection()); } catch (e) {}
    return String(inv);
  }
  function place(rec) {
    var l = String((rec && rec.location) || '').trim(), d = String((rec && rec.locationDetail) || '').trim();
    return l ? (l + (d ? ' › ' + d : '')) : '';
  }
  function recOf(inv) {
    var pd = (typeof state !== 'undefined' && state && state.personalData) || {};
    if (pd[inv] && String(pd[inv].inventoryId) === String(inv)) return pd[inv];
    for (var k in pd) if (pd[k] && String(pd[k].inventoryId) === String(inv)) return pd[k];
    return null;
  }

  // ── the name ───────────────────────────────────────────────────────────
  function rrCaptureName(rec) {
    var inv = rec && rec.inventoryId;
    return inv ? W('notIdentifiedId', { id: fullId(inv) }) : W('notIdentified');
  }

  // ── its row in My Collection ───────────────────────────────────────────
  // One cell across the whole row (the table's columns are the person's own
  // choice — the column editor — so a hand-built set of cells would drift).
  function rrCaptureRowHtml(rec, mobile) {
    var inv = String(rec.inventoryId);
    var tap = 'rrCaptureCardOpen(' + arg(inv) + ')';
    var where = place(rec);
    var line = '<span style="font-weight:700;color:var(--t-orange)">' + esc(W('notIdentified')) + '</span>' +
      ' <span style="font-family:var(--font-mono);color:var(--text-mid)">#' + esc(fullId(inv)) + '</span>' +
      (where ? ' <span style="color:var(--text-mid);font-size:0.85rem">· ' + esc(where) + '</span>' : '');
    var btn = '<button type="button" onclick="event.stopPropagation();' + tap + '" class="pref-btn" style="font-size:0.75rem;padding:0.2rem 0.6rem;margin-left:0.6rem">' + esc(W('identifyBtn')) + '</button>';
    if (mobile) {
      return '<div class="browse-card" data-capture-inv="' + esc(inv) + '" onclick="' + tap + '" style="cursor:pointer;border-left:3px solid var(--t-orange)">' +
        '<div style="display:flex;align-items:center;gap:0.5rem;width:100%;min-width:0"><div style="flex:1;min-width:0">' + line + '</div>' + btn + '</div></div>';
    }
    return '<tr data-capture-inv="' + esc(inv) + '" onclick="' + tap + '" style="cursor:pointer">' +
      '<td colspan="40" style="padding:0.6rem 0.9rem;border-left:3px solid var(--t-orange)">' + line + btn + '</td></tr>';
  }

  // ── its own card ───────────────────────────────────────────────────────
  function _close() { var d = document.getElementById('rr-capture-card'); if (d) d.remove(); }
  function rrCaptureCardOpen(inv) {
    var rec = recOf(inv);
    if (!rec || !(typeof rrToIdentify === 'function' && rrToIdentify(rec))) return false;
    _close();
    var row = function (k, v) { return '<div style="color:var(--text-dim)">' + esc(W(k)) + '</div><div>' + esc(v || W('cardNone')) + '</div>'; };
    var d = document.createElement('div');
    d.id = 'rr-capture-card';
    d.style.cssText = 'position:fixed;inset:0;z-index:9600;background:var(--scrim);display:flex;align-items:center;justify-content:center;padding:1rem';
    d.innerHTML = '<div style="background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:12px;max-width:440px;width:100%;padding:1rem 1.1rem;font-family:var(--font-body);position:relative">' +
      '<button type="button" aria-label="' + esc(W('cardClose')) + '" data-capture-x style="position:absolute;top:0.4rem;right:0.6rem;background:none;border:none;color:var(--text);font-size:1.5rem;cursor:pointer">&times;</button>' +
      '<div style="font-family:var(--font-head);font-weight:700;font-size:1.15rem;margin:0.1rem 2rem 0.5rem 0">' + esc(W('cardTitle', { id: fullId(rec.inventoryId) })) + '</div>' +
      '<div style="font-size:0.88rem;color:var(--text-mid);line-height:1.45;margin-bottom:0.7rem">' + esc(W('cardIntro')) + '</div>' +
      '<div style="display:grid;grid-template-columns:auto 1fr;gap:0.3rem 0.8rem;font-size:0.9rem;margin-bottom:0.9rem">' +
        row('cardSticker', rec.stickerCode) + row('cardShelf', place(rec)) + row('cardAdded', rec.dateAdded) +
      '</div>' +
      '<div style="display:flex;gap:0.5rem;justify-content:flex-end">' +
        '<button type="button" data-capture-remove class="pref-btn">' + esc(W('removeBtn')) + '</button>' +
        '<button type="button" data-capture-identify class="pref-btn" style="font-weight:700;background:var(--accent);color:var(--on-accent)">' + esc(W('identifyBtn')) + '</button>' +
      '</div></div>';
    document.body.appendChild(d);
    if (typeof rrDismissGuard === 'function') { try { rrDismissGuard(d, _close); } catch (e) {} }
    d.querySelector('[data-capture-x]').addEventListener('click', _close);
    d.querySelector('[data-capture-remove]').addEventListener('click', function () {
      _close();
      if (typeof removeCollectionItem === 'function') removeCollectionItem('', '', rec.row || 0, String(rec.inventoryId));
    });
    d.querySelector('[data-capture-identify]').addEventListener('click', function () {
      _close();
      if (typeof rrCaptureIdentify === 'function') rrCaptureIdentify(String(rec.inventoryId));
    });
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // THE CAPTURE SCREEN — sticker → photos → Next → shelf → Finished → next item
  // ═══════════════════════════════════════════════════════════════════════
  // Stickers and shelves are read LIVE (the same camera door and QR reader as
  // Scan to Shelve: rrStartCamera + window._decodeQrText); the photos are the
  // phone's own camera (as Quick Capture), uploaded to the Photo Inbox with
  // the item's STICKER CODE stamped on each one (RR_CAPTURE.photoProp) — the
  // sticker is unique and known from the first scan, so the photos find their
  // item later with nothing else to remember. Offline, a photo is staged on
  // the phone (the Inbox's own _stageOne) with the same stamp, and a Finished
  // item waits in RR_CAPTURE.queueKey until the connection is back; its row
  // and inventory number are made then, in the order captured.
  var _cap = null;   // { coll, step, sticker, shots, pending, place, last, busy, seen, stream, stop, base, group }

  function C() { return (typeof RR_CAPTURE !== 'undefined' && RR_CAPTURE) || root.RR_CAPTURE || {}; }
  function PF() { return root._pinFns || {}; }
  function offline() {
    try { if (typeof _rrOfflineNow === 'function') return !!_rrOfflineNow(); } catch (e) {}
    return (typeof navigator !== 'undefined' && navigator.onLine === false) || !!root._offlineMode;
  }
  function toast(m, ms, bad) { try { if (typeof showToast === 'function') showToast(m, ms || 3500, !!bad); } catch (e) {} }
  function collLabel() {
    try { var c = rrCurrentCollection(); if (c && typeof rrCollectionLabel === 'function') return rrCollectionLabel(c); return c ? (c.home ? (c.name || 'My Collection') : (c.number + ' – ' + c.name)) : ''; } catch (e) { return ''; }
  }
  function collKey() { try { var c = rrCurrentCollection(); return (c && c.key) || 'home'; } catch (e) { return 'home'; } }
  function norm(c) { return (typeof rrStickerNorm === 'function') ? rrStickerNorm(c) : String(c == null ? '' : c).trim(); }

  // ── the queue of items finished offline (THIS phone only — their photos are staged here) ──
  function qRead() { try { var a = JSON.parse(localStorage.getItem(C().queueKey) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function qWrite(a) { try { localStorage.setItem(C().queueKey, JSON.stringify(a || [])); } catch (e) {} }
  function qMine() { var k = collKey(); return qRead().filter(function (x) { return x && (x.coll || 'home') === k; }); }
  function qHasSticker(code) { return qRead().some(function (x) { return x && x.sticker === code; }); }

  // ── is this sticker free for a NEW item? ───────────────────────────────
  // Returns '' when it is, or the words that say why not.
  function stickerProblem(code) {
    var app = (typeof rrStickerParseApp === 'function') ? rrStickerParseApp(code) : null;
    if (app && app.kind === 'place') return W('stickerIsShelf');
    if (app && app.kind === 'item') return W('stickerPrinted');
    var f = (typeof rrStickerFind === 'function') ? rrStickerFind(code) : null;
    if (f && f.kind === 'place') return W('stickerIsShelf');
    if (f && f.kind === 'item') return W('stickerUsed', { item: (typeof rrShelveItemName === 'function') ? rrShelveItemName(f.pd) : '' });
    if (f && (f.kind === 'otherColl' || f.kind === 'foreign' || f.kind === 'deletedColl' || f.kind === 'moved' || f.kind === 'missing')) return W('stickerOther');
    if (qHasSticker(code)) return W('stickerWaiting');
    return '';
  }

  // ── make the row: THE one writer for a captured item ───────────────────
  // A row with an inventory number, the sticker, the shelf, the date — and no
  // item number (rrToIdentify). nextInventoryId + sheetsAppend carry the sheet
  // numbering guard (collections.js) like every other add. One Movement Log line.
  var _writing = false;
  async function rrCaptureWrite(item) {
    if (!item || !item.sticker) return { ok: false, why: 'empty' };
    if (offline()) return { ok: false, why: 'offline' };
    if (typeof rrCollectionIsArchived === 'function' && rrCollectionIsArchived()) return { ok: false, why: 'archived' };
    var inv = nextInventoryId();
    var place = item.place || null;
    var fields = { inventoryId: inv, stickerCode: item.sticker, dateAdded: rrToday() };   // THE local today (rr-today) — never a UTC/London day
    if (place && place.loc) { fields.location = place.loc; fields.locationDetail = place.spot || ''; }
    var row = buildPersonalRow(fields);
    var at = (await sheetsAppend(state.personalSheetId, PERSONAL_TAB + '!A:A', [row])) || 0;
    var rec = (typeof rrSavedRecord === 'function') ? rrSavedRecord(row, at, { row: at, status: 'Owned', owned: true, inventoryId: inv, stickerCode: item.sticker })
      : { row: at, status: 'Owned', owned: true, itemNum: '', inventoryId: inv, stickerCode: item.sticker, location: fields.location || '', locationDetail: fields.locationDetail || '' };
    rec.owned = true; rec.status = rec.status || 'Owned';
    state.personalData[inv] = rec;
    try { if (typeof _cachePersonalData === 'function') _cachePersonalData(); } catch (e) {}
    try { root._rrBrowseSig = null; root._rrCollPageSig = null; } catch (e) {}
    if (place && place.loc && typeof rrMoveLogAdd === 'function') {
      try { await rrMoveLogAdd(rec, { loc: '', spot: '' }, { loc: place.loc, spot: place.spot || '' }, 'capture'); } catch (e) { console.warn('[capture] movement log', e && e.message); }
    }
    return { ok: true, inv: inv, rec: rec };
  }
  // The queue goes in, oldest first; stops at the first that cannot.
  async function rrCaptureDrain() {
    if (_writing || offline()) return 0;
    _writing = true;
    var n = 0;
    try {
      // only THIS collection's items, oldest first; another collection's wait until it is open
      var here = collKey();
      for (;;) {
        var q = qRead();
        var i = q.findIndex(function (x) { return x && (x.coll || 'home') === here; });
        if (i < 0) break;
        var r = await rrCaptureWrite(q[i]);
        if (!r.ok) break;
        q = qRead(); q.splice(q.findIndex(function (x) { return x && x.sticker === r.rec.stickerCode; }), 1); qWrite(q); n++;
      }
    } catch (e) { console.warn('[capture] drain', e && e.message); }
    finally { _writing = false; }
    if (n) { try { if (typeof renderBrowse === 'function') renderBrowse(); } catch (e) {} paint(); }
    return n;
  }

  // ── the screen ─────────────────────────────────────────────────────────
  function rrCaptureOpen() {
    if (typeof rrCollectionIsArchived === 'function' && rrCollectionIsArchived()) { toast(W('archived'), 5000, true); return false; }
    rrCaptureClose();
    _cap = { coll: collKey(), step: 'sticker', sticker: '', shots: 0, pending: 0, place: null, last: null, lastPlace: null, keep: false,
             busy: false, seen: {}, stream: null, stop: false, base: Date.now(), group: 0, msg: '' };
    var ov = document.createElement('div');
    ov.id = 'rr-capture';
    ov.style.cssText = 'position:fixed;inset:0;z-index:9700;background:var(--bg);display:flex;flex-direction:column;font-family:var(--font-body);color:var(--text)';
    ov.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:0.75rem 1rem;border-bottom:1px solid var(--border);background:var(--surface)">' +
        '<div><strong style="font-size:1.05rem">' + esc(W('title')) + '</strong><div style="font-size:0.78rem;color:var(--text-dim)">' + esc(W('into', { label: collLabel() })) + '</div></div>' +
        '<button type="button" data-cap-x aria-label="' + esc(W('cardClose')) + '" style="background:none;border:none;color:var(--text);font-size:1.6rem;line-height:1;cursor:pointer">&times;</button>' +
      '</div>' +
      '<div id="rr-cap-cam" style="position:relative;background:var(--ink-dark);flex:0 0 auto;aspect-ratio:4/3;max-height:42vh;max-height:42dvh;overflow:hidden">' +
        '<video id="rr-cap-video" playsinline muted autoplay style="width:100%;height:100%;object-fit:cover"></video>' +
        '<div id="rr-cap-nocam" style="display:none;position:absolute;inset:0;align-items:center;justify-content:center;text-align:center;padding:1rem;color:var(--ink-light);font-size:0.95rem;line-height:1.4"></div>' +
      '</div>' +
      '<div id="rr-cap-body" style="padding:0.8rem 1rem;overflow:auto;flex:1"></div>' +
      '<input type="file" id="rr-cap-file" accept="image/*" capture="environment" style="display:none">';
    document.body.appendChild(ov);
    if (typeof rrDismissGuard === 'function') { try { rrDismissGuard(ov, rrCaptureClose); } catch (e) {} }
    ov.querySelector('[data-cap-x]').addEventListener('click', rrCaptureClose);
    ov.querySelector('#rr-cap-file').addEventListener('change', function () {
      var f = this.files && this.files[0]; this.value = '';
      if (f) shot(f);
    });
    paint();
    camStart();
    rrCaptureDrain();
    return true;
  }
  function rrCaptureClose() {
    if (_cap) { _cap.stop = true; camStop(); }
    var ov = document.getElementById('rr-capture'); if (ov) ov.remove();
    _cap = null;
  }

  function paint() {
    if (!_cap) return;
    var b = document.getElementById('rr-cap-body'); if (!b) return;
    var step = _cap.step;
    var cam = document.getElementById('rr-cap-cam'); if (cam) cam.style.display = (step === 'photos') ? 'none' : '';   // photos use the phone's own camera
    var line = step === 'sticker' ? W('stepSticker') : step === 'photos' ? W('stepPhotos') : W('stepShelf');
    var slot = function (k, v, on) { return '<span style="color:var(--text-dim)">' + esc(W(k)) + '</span><span style="' + (on ? 'font-weight:700' : '') + '">' + esc(v || '—') + '</span>'; };
    var placeTxt = _cap.place ? place({ location: _cap.place.loc, locationDetail: _cap.place.spot }) : '';
    var q = qMine().length;
    var html =
      '<div data-cap-step="' + step + '" style="font-size:1rem;font-weight:700;margin-bottom:0.5rem">' + esc(line) + '</div>' +
      (_cap.msg ? '<div data-cap-msg style="font-size:0.9rem;margin-bottom:0.5rem;color:' + (_cap.msgGood ? 'var(--t-green)' : 'var(--t-orange)') + ';font-weight:600">' + esc(_cap.msg) + '</div>' : '') +
      '<div style="display:grid;grid-template-columns:auto 1fr;gap:0.3rem 0.7rem;font-size:0.9rem;margin-bottom:0.7rem">' +
        slot('slotSticker', _cap.sticker, step === 'sticker') +
        slot('slotPhotos', _cap.shots ? String(_cap.shots) : '', step === 'photos') +
        slot('slotShelf', placeTxt, step === 'shelf') +
      '</div>';
    if (step === 'photos') {
      html += '<button type="button" data-cap-take class="pref-btn" style="width:100%;min-height:3.2rem;font-weight:700;font-size:1.05rem;margin-bottom:0.5rem">' + esc(W('takePhoto')) + '</button>' +
        (_cap.pending ? '<div style="font-size:0.8rem;color:var(--text-dim);margin-bottom:0.4rem">' + esc(W('uploading', { n: _cap.pending })) + '</div>' : '');
    }
    if (step === 'shelf' && _cap.lastPlace) {
      html += '<button type="button" data-cap-same class="pref-btn" style="width:100%;margin-bottom:0.5rem">' + esc(W('sameShelf', { place: place({ location: _cap.lastPlace.loc, locationDetail: _cap.lastPlace.spot }) })) + '</button>';
    }
    if (step === 'shelf' && _cap.askPlace) {
      var locs = (typeof root.rrSavedLocations === 'function') ? root.rrSavedLocations() : [];
      var opts = [];
      locs.forEach(function (l) { opts.push({ loc: l.name, spot: '' }); (l.details || []).forEach(function (d) { opts.push({ loc: l.name, spot: d }); }); });
      html += '<div style="font-size:0.9rem;margin:0.3rem 0">' + esc(W('newShelfAsk')) + '</div>' +
        '<select data-cap-placepick style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:7px;padding:0.5rem;margin-bottom:0.4rem">' +
        opts.map(function (o, i) { return '<option value="' + i + '">' + esc(place({ location: o.loc, locationDetail: o.spot })) + '</option>'; }).join('') + '</select>' +
        '<button type="button" data-cap-placeuse class="pref-btn" style="margin-bottom:0.5rem">' + esc(W('newShelfUse')) + '</button>';
      _cap._placeOpts = opts;
    }
    html += '<div style="display:flex;gap:0.5rem;margin:0.3rem 0 0.6rem">' +
      (step !== 'sticker' ? '<button type="button" data-cap-back class="pref-btn" style="flex:1">' + esc(W('back')) + '</button>' : '') +
      (step === 'photos' ? '<button type="button" data-cap-next class="pref-btn" style="flex:2;font-weight:700;background:var(--accent);color:var(--on-accent)">' + esc(W('next')) + '</button>' : '') +
      (step === 'shelf' ? '<button type="button" data-cap-finish class="pref-btn" style="flex:2;font-weight:700;background:var(--accent);color:var(--on-accent)"' + (_cap.place ? '' : ' disabled') + '>' + esc(W('finished')) + '</button>' : '') +
      '</div>';
    if (step === 'sticker') html += '<button type="button" data-cap-blank class="pref-btn" style="font-size:0.78rem;margin-bottom:0.5rem">' + esc(W('blankBtn')) + '</button>';
    if (_cap.last) html += '<div data-cap-last style="font-size:0.88rem;color:var(--t-green);font-weight:700;margin-bottom:0.4rem">' + esc(_cap.last) + '</div>';
    if (q) html += '<div data-cap-queue style="font-size:0.82rem;color:var(--t-orange);margin-bottom:0.4rem">' + esc(W('waiting', { n: q })) + '</div>';
    if (step !== 'photos') {
      html += '<div style="display:flex;gap:0.4rem;align-items:center;margin-top:0.3rem">' +
        '<input data-cap-type type="text" aria-label="' + esc(W('typeLabel')) + '" placeholder="' + esc(W('typeLabel')) + '" style="flex:1;min-width:0;background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:7px;padding:0.45rem 0.6rem">' +
        '<button type="button" data-cap-go class="pref-btn">' + esc(W('typeGo')) + '</button></div>';
    }
    b.innerHTML = html;
    var on = function (sel, fn) { var el = b.querySelector(sel); if (el) el.addEventListener('click', fn); };
    on('[data-cap-take]', function () { var f = document.getElementById('rr-cap-file'); if (f) f.click(); });
    on('[data-cap-back]', back);
    on('[data-cap-blank]', rrCaptureBlankOpen);
    on('[data-cap-next]', next);
    on('[data-cap-finish]', finish);
    on('[data-cap-same]', function () { if (_cap && _cap.lastPlace) { _cap.place = { loc: _cap.lastPlace.loc, spot: _cap.lastPlace.spot }; _cap.askPlace = null; _cap.msg = ''; paint(); } });
    on('[data-cap-placeuse]', async function () {
      var sel = b.querySelector('[data-cap-placepick]'); var o = _cap && _cap._placeOpts && _cap._placeOpts[Number(sel && sel.value)];
      if (!o || !_cap) return;
      if (typeof rrStickerSetPlace === 'function' && _cap.askPlace && !(await rrStickerSetPlace(_cap.askPlace, o))) return;
      if (!_cap) return;
      _cap.place = { loc: o.loc, spot: o.spot || '' }; _cap.askPlace = null; _cap.msg = ''; paint();
    });
    var typed = b.querySelector('[data-cap-type]');
    var go = function () { var v = typed.value; typed.value = ''; if (norm(v)) rrCaptureCode(v); };
    on('[data-cap-go]', go);
    if (typed) typed.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
  }
  function say(msg, good) { if (!_cap) return; _cap.msg = msg || ''; _cap.msgGood = !!good; paint(); }

  // THE door: a code was read (camera) or typed.
  async function rrCaptureCode(code, opts) {
    if (!_cap || _cap.busy) return false;
    var c = norm(code); if (!c) return false;
    var now = Date.now();
    if (opts && opts.fromCamera && _cap.seen[c] && now - _cap.seen[c] < ((typeof RR_SHELVE !== 'undefined' && RR_SHELVE.sameCodeQuietMs) || 2500)) return false;
    _cap.seen[c] = now;
    try { if (navigator.vibrate) navigator.vibrate(60); } catch (e) {}
    if (_cap.step === 'sticker') {
      var why = stickerProblem(c);
      if (why) { say(why); return false; }
      _cap.sticker = c; _cap.step = 'photos'; _cap.group++; _cap.shots = 0; _cap.msg = ''; _cap.last = null;
      camStop(); paint();
      return true;
    }
    if (_cap.step === 'shelf') {
      var f = (typeof rrStickerFind === 'function') ? rrStickerFind(c) : null;
      // Brad's flow: the scan fills in the shelf; Finished saves (a wrong scan can be scanned again first)
      if (f && f.kind === 'place') { _cap.place = { loc: f.place.loc, spot: f.place.spot || '' }; _cap.askPlace = null; _cap.msg = ''; paint(); return true; }
      if (f || ((typeof rrStickerParseApp === 'function') && rrStickerParseApp(c))) { say(W('notShelf')); return false; }
      _cap.askPlace = c; say(W('newShelfAsk'));
      return false;
    }
    return false;
  }

  // ── the photos ─────────────────────────────────────────────────────────
  async function shot(file) {
    if (!_cap || _cap.step !== 'photos' || !_cap.sticker) return;
    var me = _cap, sticker = _cap.sticker;
    me.shots++; me.msg = '';
    var ext = ((file.name || '').split('.').pop() || 'jpg').toLowerCase().slice(0, 5) || 'jpg';
    // the same name shape as Quick Capture, so the Inbox stacks one item's shots together
    var name = 'INBOX ' + me.base + ' g' + me.base + '-' + me.group + ' p' + me.shots + '.' + ext;
    var prop = C().photoProp || 'rrCap';
    paint();
    if (offline()) {
      try { await PF()._stageOne(file, name, '', '', { cap: sticker }); } catch (e) { console.warn('[capture] could not stage', e); toast(W('failed'), 5000, true); }
      return;
    }
    me.pending++; paint();
    try {
      var fid = await PF()._folder();
      var ap = {}; ap[prop] = sticker;
      await driveUploadFile(file, name, fid, { appProperties: ap });
    } catch (e) {
      console.warn('[capture] upload failed — saving to this phone', e);
      try { await PF()._stageOne(file, name, '', '', { cap: sticker }); } catch (e2) { toast(W('failed'), 5000, true); }
    } finally {
      me.pending--; if (_cap === me) paint();
    }
  }

  // ── the steps ──────────────────────────────────────────────────────────
  function back() {
    if (!_cap) return;
    _cap.msg = ''; _cap.askPlace = null;
    if (_cap.step === 'shelf') { _cap.step = 'photos'; _cap.place = null; camStop(); }
    else if (_cap.step === 'photos') { _cap.step = 'sticker'; _cap.sticker = ''; camStart(); }
    paint();
  }
  function next() {
    if (!_cap || _cap.step !== 'photos') return;
    if (!_cap.shots) { say(W('noPhotos')); return; }
    _cap.step = 'shelf'; _cap.msg = ''; paint(); camStart();
  }
  async function finish() {
    if (!_cap || _cap.step !== 'shelf' || !_cap.place || _cap.busy) return false;
    _cap.busy = true;   // stability rule 4: one Finished, one row
    var me = _cap;
    var item = { sticker: me.sticker, place: { loc: me.place.loc, spot: me.place.spot || '' }, coll: me.coll, at: Date.now() };
    var placeTxt = place({ location: item.place.loc, locationDetail: item.place.spot });
    try {
      // anything still waiting goes in FIRST, so numbers follow the order captured
      if (qMine().length) await rrCaptureDrain();
      var r = (!qMine().length) ? await rrCaptureWrite(item) : { ok: false, why: 'queued' };
      if (!r.ok) { var q = qRead(); q.push(item); qWrite(q); }
      if (_cap !== me) return true;
      me.last = r.ok ? W('saved', { name: rrCaptureName(r.rec), place: placeTxt }) : W('savedPlain', { name: item.sticker });
      if (!r.ok && r.why !== 'offline' && r.why !== 'queued') toast(W('failed'), 5000, true);
      me.lastPlace = item.place;
      me.sticker = ''; me.shots = 0; me.place = null; me.step = 'sticker'; me.msg = '';
      paint(); camStart();
      try { if (typeof renderBrowse === 'function') renderBrowse(); } catch (e) {}
      return true;
    } catch (e) {
      console.warn('[capture] finish', e);
      var q2 = qRead(); if (!q2.some(function (x) { return x.sticker === item.sticker; })) { q2.push(item); qWrite(q2); }
      toast(W('failed'), 5000, true);
      return false;
    } finally { me.busy = false; }
  }

  // ── the camera (the same door and reader as Scan to Shelve) ─────────────
  function camStart() {
    if (!_cap) return;
    var nocam = document.getElementById('rr-cap-nocam'), video = document.getElementById('rr-cap-video');
    var noCam = function (why) { if (nocam) { nocam.textContent = (why && why.words) || W('noCamera'); nocam.style.display = 'flex'; } };
    if (_cap.stream) return;
    if (!root.IS_MOBILE_UA || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof rrStartCamera !== 'function') { noCam(); return; }
    var me = _cap;
    rrStartCamera({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false }).then(function (s) {
      if (_cap !== me || me.stop || me.step === 'photos') { s.getTracks().forEach(function (t) { t.stop(); }); return; }
      me.stream = s; video.srcObject = s; if (nocam) nocam.style.display = 'none';
      var canvas = document.createElement('canvas');
      (async function loop() {
        while (_cap === me && !me.stop && me.stream === s) {
          await new Promise(function (z) { setTimeout(z, (typeof RR_SHELVE !== 'undefined' && RR_SHELVE.scanEveryMs) || 300); });
          if (_cap !== me || me.stop || me.busy || me.stream !== s || !video.videoWidth) continue;
          try {
            canvas.width = video.videoWidth; canvas.height = video.videoHeight;
            canvas.getContext('2d').drawImage(video, 0, 0);
            var txt = (typeof root._decodeQrText === 'function') ? await root._decodeQrText(canvas) : null;
            if (txt && _cap === me) rrCaptureCode(txt, { fromCamera: true });
          } catch (e) {}
        }
      })();
    }).catch(function (why) { if (why && why.words) noCam(why); });
  }
  function camStop() {
    try { if (_cap && _cap.stream) _cap.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
    if (_cap) _cap.stream = null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // IDENTIFY — the item's photos (found by its sticker) go through the Photo
  // Inbox's own review card and Add; the add FILLS this row instead of adding
  // a new one (the wizard's fill path — the one that finishes a Quick Entry:
  // _fillItemMode + _fillTargetKey + _existingInventoryId). The columns the
  // add does not write (sticker, shelf detail, date added) are carried by
  // that path (rrCarryPersonalRow); the shelf's place rides in as d.location.
  // ═══════════════════════════════════════════════════════════════════════
  function PIN() { return root._pinShared || {}; }
  function capOf(f) { var ap = (f && f.appProperties) || {}; return String(ap[C().photoProp || 'rrCap'] || ''); }
  function recBySticker(code) {
    var pd = (typeof state !== 'undefined' && state && state.personalData) || {};
    for (var k in pd) { var r = pd[k]; if (r && r.stickerCode === code && rrToIdentify(r)) return r; }
    return null;
  }
  // Called by the Inbox's add (photo-inbox-tools.js _pinAddNow) with the photos
  // it is handing over: when they carry a captured item's sticker, this add
  // fills THAT row. Returns the inventory number it aimed at, or ''.
  function rrCaptureFillFor(data, photoIds) {
    try {
      if (!data || !photoIds || !photoIds.length) return '';
      var ids = {}; photoIds.forEach(function (i) { if (i) ids[i] = 1; });
      var code = '';
      (PIN()._groups || []).some(function (g) { return (g.files || []).some(function (f) { if (ids[f.id] && capOf(f)) { code = capOf(f); return true; } return false; }); });
      if (!code) return '';
      var rec = recBySticker(code);
      if (!rec) return '';
      return rrCaptureAim(data, rec);
    } catch (e) { console.warn('[capture] fill', e && e.message); return ''; }
  }
  // Point an add at a captured row (one place, so the Inbox add and the no-photo add agree).
  function rrCaptureAim(data, rec) {
    var inv = String(rec.inventoryId);
    data._fillItemMode = true;
    data._fillTargetKey = inv;
    data._existingInventoryId = inv;
    data._captureInv = inv;
    if (rec.location) data.location = rec.location;
    if (rec.locationDetail) data.locationDetail = rec.locationDetail;
    toast(W('idFilling', { id: fullId(inv) }), 4000);
    return inv;
  }
  // From the item's card: Identify.
  async function rrCaptureIdentify(inv) {
    var rec = recOf(inv);
    if (!rec || !rrToIdentify(rec)) { toast(W('idGone'), 3500); return false; }
    var code = String(rec.stickerCode || '');
    if (typeof root._pinGo === 'function') {
      toast(W('idLooking'), 2500);
      root._pinGo();
      var t0 = Date.now(), grp = null;
      while (Date.now() - t0 < 12000) {
        grp = (PIN()._groups || []).filter(function (g) { return (g.files || []).some(function (f) { return code && capOf(f) === code; }); })[0] || null;
        if (grp) break;
        await new Promise(function (z) { setTimeout(z, 300); });
      }
      if (grp && typeof root._pinReview === 'function') { root._pinReview(grp.key); return true; }
    }
    // no photos (yet): the same add, aimed at the row, without them
    toast(W('idNoPhotos'), 5000);
    if (typeof openWizard !== 'function') return false;
    openWizard('collection');
    for (var i = 0; i < 100; i++) {
      if (typeof wizard !== 'undefined' && wizard && wizard.data && wizard.steps) { rrCaptureAim(wizard.data, rec); return true; }
      await new Promise(function (z) { setTimeout(z, 50); });
    }
    return false;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRINT BLANK LABELS — codes tied to no item until Capture scans them.
  // RR_CAPTURE.blankPrefix + random letters (crypto); the sheet is drawn by
  // Scan to Shelve's own label maker (rrShelveLabelsPdf) at the chosen size.
  // ═══════════════════════════════════════════════════════════════════════
  function rrCaptureBlankCode() {
    var a = C().blankAlphabet || 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', n = C().blankLen || 10, out = '';
    var buf = new Uint32Array(n);
    try { (root.crypto || root.msCrypto).getRandomValues(buf); } catch (e) { for (var j = 0; j < n; j++) buf[j] = Math.floor(Math.random() * 4294967296); }
    for (var i = 0; i < n; i++) out += a.charAt(buf[i] % a.length);
    return (C().blankPrefix || 'RRB-') + out;
  }
  function rrCaptureBlankCodes(count) {
    var seen = {}, list = [];
    while (list.length < count) {
      var c = rrCaptureBlankCode();
      if (seen[c] || stickerProblem(c)) continue;
      seen[c] = 1; list.push(c);
    }
    return list;
  }
  function rrCaptureBlankOpen() {
    var old = document.getElementById('rr-capture-blank'); if (old) old.remove();
    var tpl = (typeof rrShelveLabelTpl === 'function') ? rrShelveLabelTpl() : { cols: 3, rows: 10 };
    var perSheet = tpl.one ? 1 : ((tpl.cols || 3) * (tpl.rows || 10));
    var d = document.createElement('div');
    d.id = 'rr-capture-blank';
    d.style.cssText = 'position:fixed;inset:0;z-index:9800;background:var(--scrim);display:flex;align-items:center;justify-content:center;padding:1rem';
    d.innerHTML = '<div style="background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:12px;max-width:420px;width:100%;padding:1rem 1.1rem;font-family:var(--font-body);position:relative">' +
      '<button type="button" data-blank-x aria-label="' + esc(W('cardClose')) + '" style="position:absolute;top:0.4rem;right:0.6rem;background:none;border:none;color:var(--text);font-size:1.5rem;cursor:pointer">&times;</button>' +
      '<div style="font-family:var(--font-head);font-weight:700;font-size:1.1rem;margin:0.1rem 2rem 0.5rem 0">' + esc(W('blankTitle')) + '</div>' +
      '<div style="font-size:0.86rem;color:var(--text-mid);line-height:1.45;margin-bottom:0.7rem">' + esc(W('blankHelp')) + '</div>' +
      '<label style="display:flex;align-items:center;gap:0.5rem;font-size:0.9rem;margin-bottom:0.8rem">' + esc(W('blankHow')) +
        ' <input data-blank-n type="number" min="1" max="' + (C().blankMax || 300) + '" value="' + perSheet + '" style="width:5rem;background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:7px;padding:0.4rem"></label>' +
      '<div data-blank-msg style="font-size:0.85rem;color:var(--t-orange);min-height:1.1em;margin-bottom:0.4rem"></div>' +
      '<div style="display:flex;justify-content:flex-end"><button type="button" data-blank-go class="pref-btn" style="font-weight:700">' + esc(W('blankGo')) + '</button></div></div>';
    document.body.appendChild(d);
    if (typeof rrDismissGuard === 'function') { try { rrDismissGuard(d, function () { d.remove(); }); } catch (e) {} }
    d.querySelector('[data-blank-x]').addEventListener('click', function () { d.remove(); });
    var busy = false;
    d.querySelector('[data-blank-go]').addEventListener('click', async function () {
      if (busy) return;
      var max = C().blankMax || 300, n = Math.floor(Number(d.querySelector('[data-blank-n]').value));
      if (!(n >= 1 && n <= max)) { d.querySelector('[data-blank-msg]').textContent = W('blankBad', { max: max }); return; }
      busy = true;
      try {
        var entries = rrCaptureBlankCodes(n).map(function (c) { return { code: c, title: c.slice((C().blankPrefix || '').length), lines: [] }; });
        var made = await rrShelveLabelsPdf(entries, 0);
        made.doc.save(((typeof RR_SHELVE !== 'undefined' && RR_SHELVE.pdfName) || 'labels.pdf').replace(/\.pdf$/i, '') + ' - blank.pdf');
        toast(W('blankMade', { n: n }), 4000);
        d.remove();
      } catch (e) { console.warn('[capture] blank labels', e); toast(W('blankFailed'), 5000, true); }
      busy = false;
    });
    return true;
  }

  // ── the Photo Inbox's Capture items button: only when Pro is on ──────────
  function rrCaptureButtonSync() {
    var b = document.getElementById('pin-capture-btn'); if (!b) return false;
    var on = false;
    try { on = typeof rrCollUiOn === 'function' && rrCollUiOn() && !(typeof rrCollectionIsArchived === 'function' && rrCollectionIsArchived()); } catch (e) {}
    b.textContent = W('startBtn');
    b.title = W('startHelp', { label: collLabel() });
    b.style.display = on ? '' : 'none';
    return on;
  }

  // the queue goes in on its own when the connection comes back
  try { if (root.addEventListener) root.addEventListener('online', function () { setTimeout(rrCaptureDrain, 1500); }); } catch (e) {}

  root.rrCaptureName = rrCaptureName;
  root.rrCaptureRowHtml = rrCaptureRowHtml;
  root.rrCaptureCardOpen = rrCaptureCardOpen;
  root.rrCaptureOpen = rrCaptureOpen;
  root.rrCaptureButtonSync = rrCaptureButtonSync;
  root.rrCaptureIdentify = rrCaptureIdentify;
  root.rrCaptureBlankOpen = rrCaptureBlankOpen;
  root.rrCaptureBlankCodes = rrCaptureBlankCodes;
  root.rrCaptureFillFor = rrCaptureFillFor;
  root.rrCaptureAim = rrCaptureAim;
  root.rrCaptureClose = rrCaptureClose;
  root.rrCaptureCode = rrCaptureCode;
  root.rrCaptureWrite = rrCaptureWrite;
  root.rrCaptureDrain = rrCaptureDrain;
  root.rrCaptureStickerProblem = stickerProblem;
  root._rrCaptureState = function () { return _cap; };   // tests read the screen's state
  root._rrCaptureShot = shot;                             // tests hand it a photo (the phone's camera in real use)
  if (typeof module !== 'undefined' && module.exports) module.exports = { rrCaptureName: rrCaptureName, rrCaptureRowHtml: rrCaptureRowHtml, rrCaptureCardOpen: rrCaptureCardOpen };
})(typeof window !== 'undefined' ? window : this);
