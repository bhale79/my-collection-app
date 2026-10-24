// ═══════════════════════════════════════════════════════════════════════════
// SCAN TO SHELVE — v0.9.2020 (owners only until Brad opens it)
//
// [stated] Brad, 2026-10-23, for a customer who "has qr codes that he has on
// his shelves" and wants to "scan the item and then scan the shelve and it
// updates its location"; then "what if the user has a bunch of random qr codes
// like this stickers … can you scan this on the item, scan another on the
// shelf, enter the item info and it all be updated?"; "lets just use the phone
// camera"; "have this feature listed in preferences under the location
// manager"; "lets set this up for support@ and also my account bhale@" → "yes".
//
// THE PIECES (one owner each):
//   rrShelveOn()               is the feature on for this account (config.js RR_SHELVE.feature)
//   rrStickerFind(code)        what a sticker is on — an item (its Sticker Code column) or a place
//   rrStickerSetItem / rrStickerClearItem    the ONLY writers of the Sticker Code column
//   rrStickerPlaces / rrStickerSetPlace / rrStickerClearPlace / rrStickerForgetPlace
//                              the ONLY readers/writers of the shelf stickers (an ACCOUNT setting)
//   rrShelveSaveLocation(key, place)         the ONLY place a scan writes Location / Location Detail
//   rrShelveCode(code)         THE door every scan goes through — camera or the typed box
//   rrShelveOpen(mode)         the camera screen ('shelve', or pairing one item / one place)
// Every word is in config.js RR_SHELVE.words. A sticker means ONE thing: one
// item or one place; moving it always asks first.
// ═══════════════════════════════════════════════════════════════════════════
/* eslint-disable no-var */

function _shW(k, vars) {
  var w = (typeof RR_SHELVE !== 'undefined' && RR_SHELVE.words && RR_SHELVE.words[k]) || k;
  Object.keys(vars || {}).forEach(function (v) { w = w.split('{' + v + '}').join(vars[v]); });
  return w;
}
function _shEsc(s) { return (typeof rrEsc === 'function') ? rrEsc(s) : String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

// ── is it on? ──────────────────────────────────────────────────────────────
function rrShelveOn() {
  try { return typeof rrFeatureOn === 'function' && rrFeatureOn(RR_SHELVE.feature); } catch (e) { return false; }
}
function rrShelveLocationOn() {
  try { return (typeof _prefGet === 'function' ? _prefGet('lv_location_enabled', 'false') : localStorage.getItem('lv_location_enabled')) === 'true'; } catch (e) { return false; }
}

// ── stickers ───────────────────────────────────────────────────────────────
function rrStickerNorm(code) { return String(code == null ? '' : code).replace(/^\s+|\s+$/g, ''); }
function rrStickerPlaces() {
  try {
    var raw = (typeof rrPrefRead === 'function') ? rrPrefRead(RR_SHELVE.placesKey) : localStorage.getItem(RR_SHELVE.placesKey);
    var o = JSON.parse(raw || '{}');
    return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {};
  } catch (e) { return {}; }
}
function _shPlacesSave(o) {
  var v = JSON.stringify(o || {});
  if (typeof rrPrefWrite === 'function') rrPrefWrite(RR_SHELVE.placesKey, v); else localStorage.setItem(RR_SHELVE.placesKey, v);
}
function rrShelvePlaceName(p) { return p ? (p.loc + (p.spot ? ' › ' + p.spot : '')) : ''; }
function _shSamePlace(a, b) {
  var n = function (s) { return String(s || '').trim().toLowerCase(); };
  return !!a && !!b && n(a.loc) === n(b.loc) && n(a.spot) === n(b.spot);
}
function _shItemKeyByCode(code) {
  var c = rrStickerNorm(code);
  if (!c) return '';
  var pd = state.personalData || {};
  for (var k in pd) {
    var p = pd[k];
    if (p && p.owned && rrStickerNorm(p.stickerCode) === c) return k;
  }
  return '';
}
function rrStickerFind(code) {
  var c = rrStickerNorm(code);
  if (!c) return null;
  var key = _shItemKeyByCode(c);
  if (key) return { kind: 'item', key: key, pd: state.personalData[key] };
  var pl = rrStickerPlaces()[c];
  if (pl && pl.loc) return { kind: 'place', place: { loc: pl.loc, spot: pl.spot || '' } };
  return null;
}
function rrStickerCodeForPlace(place) {
  var all = rrStickerPlaces();
  for (var c in all) if (_shSamePlace(all[c], place)) return c;
  return '';
}
function rrShelveItemName(pd) {
  if (!pd) return '';
  var m = null;
  try { m = (typeof findMaster === 'function') ? findMaster(pd.itemNum, pd.variation, pd) : null; } catch (e) {}
  var words = (pd.roadName || (m && m.roadName) || '') + ' ' + (pd.itemType || (m && m.itemType) || '');
  if (!words.trim()) words = pd.description || (m && m.description) || '';
  var s = (String(pd.itemNum || '') + ' ' + words.replace(/\s+/g, ' ').trim()).trim();
  return s.length > 48 ? s.slice(0, 47) + '…' : s;
}
async function _shWriteSticker(pd, value) {
  if (!pd || !pd.row || !state.personalSheetId) return false;
  var col = personalColLetter('stickerCode');
  // a leading ' keeps Sheets from turning a numeric sticker (000123) into a number
  var cell = value ? "'" + value : '';
  return await rrVerifiedRowUpdate(state.personalSheetId, PERSONAL_TAB, pd.row, PERSONAL_TAB + '!' + col + pd.row, [[cell]],
    { num: pd.itemNum || '', invId: pd.inventoryId || '' }, 'collection');
}
// Pair a sticker with an owned copy. One sticker = one thing: already on
// another item or on a place → asks first. Returns true when it is paired.
async function rrStickerSetItem(key, code) {
  var c = rrStickerNorm(code);
  var pd = state.personalData[key];
  if (!c || !pd) return false;
  var f = rrStickerFind(c);
  if (f && f.kind === 'item' && f.key === key) return true;
  if (f && f.kind === 'item') {
    if (!(await appConfirm(_shW('usedOnItem', { item: rrShelveItemName(f.pd) }), { title: _shW('newTitle'), ok: _shW('moveOk') }))) return false;
    if (!(await _shWriteSticker(f.pd, ''))) return false;
    f.pd.stickerCode = '';
  } else if (f && f.kind === 'place') {
    if (!(await appConfirm(_shW('usedOnPlace', { place: rrShelvePlaceName(f.place) }), { title: _shW('newTitle'), ok: _shW('moveOk') }))) return false;
    var all = rrStickerPlaces(); delete all[c]; _shPlacesSave(all);
  }
  if (!(await _shWriteSticker(pd, c))) return false;
  pd.stickerCode = c;
  try { if (typeof _cachePersonalData === 'function') _cachePersonalData(); } catch (e) {}
  return true;
}
async function rrStickerClearItem(key) {
  var pd = state.personalData[key];
  if (!pd || !pd.stickerCode) return true;
  if (!(await _shWriteSticker(pd, ''))) return false;
  pd.stickerCode = '';
  try { if (typeof _cachePersonalData === 'function') _cachePersonalData(); } catch (e) {}
  return true;
}
// Pair a sticker with a place ({loc, spot}). A place keeps ONE sticker: a new
// one replaces its old one.
async function rrStickerSetPlace(code, place) {
  var c = rrStickerNorm(code);
  if (!c || !place || !String(place.loc || '').trim()) return false;
  var p = { loc: String(place.loc).trim(), spot: String(place.spot || '').trim() };
  var f = rrStickerFind(c);
  if (f && f.kind === 'place' && _shSamePlace(f.place, p)) return true;
  if (f && f.kind === 'item') {
    if (!(await appConfirm(_shW('usedOnItemToPlace', { item: rrShelveItemName(f.pd) }), { title: _shW('newTitle'), ok: _shW('moveOk') }))) return false;
    if (!(await rrStickerClearItem(f.key))) return false;
  } else if (f && f.kind === 'place') {
    if (!(await appConfirm(_shW('usedOnPlace', { place: rrShelvePlaceName(f.place) }), { title: _shW('newTitle'), ok: _shW('moveOk') }))) return false;
  }
  var all = rrStickerPlaces();
  Object.keys(all).forEach(function (k) { if (_shSamePlace(all[k], p)) delete all[k]; });
  all[c] = p;
  _shPlacesSave(all);
  return true;
}
function rrStickerClearPlace(place) {
  var all = rrStickerPlaces(), hit = false;
  Object.keys(all).forEach(function (k) { if (_shSamePlace(all[k], place)) { delete all[k]; hit = true; } });
  if (hit) _shPlacesSave(all);
  return hit;
}
// A place removed in Storage Locations takes its stickers with it (and a
// location, the stickers of every spot inside it).
function rrStickerForgetPlace(loc, spot) {
  var all = rrStickerPlaces(), hit = false;
  var n = function (s) { return String(s || '').trim().toLowerCase(); };
  Object.keys(all).forEach(function (k) {
    if (n(all[k].loc) !== n(loc)) return;
    if (spot != null && spot !== '' && n(all[k].spot) !== n(spot)) return;
    delete all[k]; hit = true;
  });
  if (hit) _shPlacesSave(all);
  return hit;
}

// ── the location write ─────────────────────────────────────────────────────
async function rrShelveSaveLocation(key, place) {
  var pd = state.personalData[key];
  if (!pd || !pd.row || !place) return false;
  var loc = String(place.loc || '').trim(), spot = String(place.spot || '').trim();
  var expect = { num: pd.itemNum || '', invId: pd.inventoryId || '' };
  var ok = await rrVerifiedRowUpdate(state.personalSheetId, PERSONAL_TAB, pd.row,
    PERSONAL_TAB + '!' + personalColLetter('location') + pd.row, [[loc]], expect, 'collection');
  if (!ok) return false;
  pd.location = loc;
  if (spot !== String(pd.locationDetail || '').trim()) {
    var ok2 = await rrVerifiedRowUpdate(state.personalSheetId, PERSONAL_TAB, pd.row,
      PERSONAL_TAB + '!' + personalColLetter('locationDetail') + pd.row, [[spot]], expect, 'collection');
    if (ok2) pd.locationDetail = spot;
  }
  try { if (typeof _cachePersonalData === 'function') _cachePersonalData(); } catch (e) {}
  try { window._rrBrowseSig = null; window._rrCollPageSig = null; } catch (e) {}
  return true;
}

// ── the screen ─────────────────────────────────────────────────────────────
var _sh = null;   // { mode, item, place, last, stream, stop, busy, seen }

function rrShelveOpen(mode) {
  if (!rrShelveOn()) return;
  mode = mode || { kind: 'shelve' };
  if (mode.kind === 'shelve' && !rrShelveLocationOn()) { if (typeof showToast === 'function') showToast(_shW('needLocation'), 5000, true); return; }
  rrShelveClose();
  _sh = { mode: mode, item: '', place: null, last: null, stream: null, stop: false, busy: false, seen: {} };
  var ov = document.createElement('div');
  ov.id = 'rr-shelve';
  ov.style.cssText = 'position:fixed;inset:0;z-index:9700;background:var(--bg);display:flex;flex-direction:column;font-family:var(--font-body);color:var(--text)';
  var title = mode.kind === 'shelve' ? _shW('title') : _shW('pair');
  ov.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:0.75rem 1rem;border-bottom:1px solid var(--border);background:var(--surface)">' +
      '<strong style="font-size:1.05rem">' + _shEsc(title) + '</strong>' +
      '<button id="rr-shelve-x" aria-label="Close" style="background:none;border:none;color:var(--text);font-size:1.6rem;line-height:1;cursor:pointer">&times;</button>' +
    '</div>' +
    '<div id="rr-shelve-cam" style="position:relative;background:var(--ink-dark);flex:0 0 auto;aspect-ratio:4/3;max-height:52vh;overflow:hidden">' +
      '<video id="rr-shelve-video" playsinline muted autoplay style="width:100%;height:100%;object-fit:cover"></video>' +
      '<div id="rr-shelve-nocam" style="display:none;position:absolute;inset:0;align-items:center;justify-content:center;text-align:center;padding:1rem;color:var(--ink-light);font-size:0.95rem;line-height:1.5"></div>' +
    '</div>' +
    '<div style="padding:0.8rem 1rem;overflow:auto;flex:1">' +
      '<div id="rr-shelve-status" style="font-size:0.95rem;font-weight:600;margin-bottom:0.6rem">' + _shEsc(mode.kind === 'shelve' ? _shW('aim') : _shW('pairScan', { what: mode.label || '' })) + '</div>' +
      (mode.kind === 'shelve'
        ? '<div id="rr-shelve-pair" style="display:grid;grid-template-columns:auto 1fr;gap:0.35rem 0.6rem;font-size:0.9rem;margin-bottom:0.6rem">' +
            '<span style="color:var(--text-dim)">' + _shEsc(_shW('itemSlot')) + '</span><span id="rr-shelve-item">—</span>' +
            '<span style="color:var(--text-dim)">' + _shEsc(_shW('placeSlot')) + '</span><span id="rr-shelve-place">—</span>' +
          '</div>' +
          '<label style="display:flex;align-items:center;gap:0.5rem;font-size:0.85rem;margin-bottom:0.6rem;cursor:pointer"><input type="checkbox" id="rr-shelve-keep" style="width:1.1rem;height:1.1rem;accent-color:var(--accent)">' + _shEsc(_shW('keepShelf')) + '</label>' +
          '<div id="rr-shelve-last" style="font-size:0.88rem;margin-bottom:0.6rem"></div>'
        : '') +
      '<div style="display:flex;gap:0.4rem;align-items:center;margin-top:0.4rem">' +
        '<input id="rr-shelve-type" type="text" aria-label="' + _shEsc(_shW('typeLabel')) + '" placeholder="' + _shEsc(_shW('typeLabel')) + '" style="flex:1;min-width:0;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.5rem 0.65rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem">' +
        '<button id="rr-shelve-go" class="pref-btn">' + _shEsc(_shW('typeGo')) + '</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(ov);
  if (typeof rrDismissGuard === 'function') { try { rrDismissGuard(ov); } catch (e) {} }
  ov.querySelector('#rr-shelve-x').addEventListener('click', rrShelveClose);
  var typed = ov.querySelector('#rr-shelve-type');
  var go = function () { var v = typed.value; typed.value = ''; if (rrStickerNorm(v)) rrShelveCode(v); };
  ov.querySelector('#rr-shelve-go').addEventListener('click', go);
  typed.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
  _shCameraStart();
}
function rrShelveClose() {
  if (_sh) { _sh.stop = true; _shCameraStop(); }
  var ov = document.getElementById('rr-shelve'); if (ov) ov.remove();
  _sh = null;
}
function _shCameraStart() {
  var nocam = document.getElementById('rr-shelve-nocam');
  var video = document.getElementById('rr-shelve-video');
  var noCam = function () { if (nocam) { nocam.textContent = _shW('noCamera'); nocam.style.display = 'flex'; } };
  if (!window.IS_MOBILE_UA || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { noCam(); return; }
  var me = _sh;
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false }).then(function (s) {
    if (!_sh || _sh !== me || me.stop) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
    me.stream = s; video.srcObject = s;
    var canvas = document.createElement('canvas');
    (async function loop() {
      while (_sh === me && !me.stop) {
        await new Promise(function (z) { setTimeout(z, RR_SHELVE.scanEveryMs); });
        if (_sh !== me || me.stop || me.busy || !video.videoWidth) continue;
        try {
          canvas.width = video.videoWidth; canvas.height = video.videoHeight;
          canvas.getContext('2d').drawImage(video, 0, 0);
          var txt = (typeof window._decodeQrText === 'function') ? await window._decodeQrText(canvas) : null;
          if (txt && _sh === me) rrShelveCode(txt, { fromCamera: true });
        } catch (e) {}
      }
    })();
  }).catch(noCam);
}
function _shCameraStop() {
  try { if (_sh && _sh.stream) _sh.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
}
function _shStatus(msg, good) {
  var el = document.getElementById('rr-shelve-status');
  if (el) { el.textContent = msg; el.style.color = good ? 'var(--t-green)' : 'var(--text)'; }
}
function _shPaint() {
  if (!_sh) return;
  var i = document.getElementById('rr-shelve-item'), p = document.getElementById('rr-shelve-place');
  if (i) i.textContent = _sh.item ? rrShelveItemName(state.personalData[_sh.item]) : '—';
  if (p) p.textContent = _sh.place ? rrShelvePlaceName(_sh.place) : '—';
  var l = document.getElementById('rr-shelve-last');
  if (l) {
    l.innerHTML = _sh.last ? '<span style="color:var(--t-green);font-weight:700">' + _shEsc(_sh.last.msg) + '</span> ' +
      '<button id="rr-shelve-undo" class="pref-btn" style="font-size:0.78rem;margin-left:0.4rem">' + _shEsc(_shW('undo')) + '</button>' : '';
    var u = document.getElementById('rr-shelve-undo');
    if (u) u.addEventListener('click', rrShelveUndo);
  }
}
function _shBuzz() { try { if (navigator.vibrate) navigator.vibrate(60); } catch (e) {} }

// THE door: a sticker was read (camera) or typed.
async function rrShelveCode(code, opts) {
  if (!_sh) return false;
  var c = rrStickerNorm(code);
  if (!c || _sh.busy) return false;
  var now = Date.now();
  if (opts && opts.fromCamera && _sh.seen[c] && now - _sh.seen[c] < RR_SHELVE.sameCodeQuietMs) return false;
  _sh.seen[c] = now;
  _sh.busy = true;
  try {
    _shBuzz();
    var mode = _sh.mode;
    if (mode.kind === 'pairItem') {
      if (await rrStickerSetItem(mode.key, c)) {
        if (typeof showToast === 'function') showToast(_shW('pairedItem', { item: rrShelveItemName(state.personalData[mode.key]) }), 3000);
        var after = mode.after; rrShelveClose(); if (typeof after === 'function') after();
        return true;
      }
      return false;
    }
    if (mode.kind === 'pairPlace') {
      if (await rrStickerSetPlace(c, mode.place)) {
        if (typeof showToast === 'function') showToast(_shW('pairedPlace', { place: rrShelvePlaceName(mode.place) }), 3000);
        var after2 = mode.after; rrShelveClose(); if (typeof after2 === 'function') after2();
        return true;
      }
      return false;
    }
    var f = rrStickerFind(c);
    if (!f) {
      f = await _shAskNew(c);
      if (!f || !_sh) return false;
    }
    if (f.kind === 'item') _sh.item = f.key;
    else _sh.place = f.place;
    if (_sh.item && _sh.place) return await _shSavePair();
    _shPaint();
    _shStatus(_sh.item ? _shW('needPlace') : _shW('needItem'));
    return true;
  } finally {
    if (_sh) _sh.busy = false;
  }
}
async function _shSavePair() {
  var key = _sh.item, place = _sh.place, pd = state.personalData[key];
  var prev = { loc: pd ? (pd.location || '') : '', spot: pd ? (pd.locationDetail || '') : '' };
  var ok = await rrShelveSaveLocation(key, place);
  if (!_sh) return ok;
  if (!ok) { _shPaint(); return false; }
  var msg = _shW('saved', { item: rrShelveItemName(pd), place: rrShelvePlaceName(place) });
  _sh.last = { key: key, prev: prev, msg: msg };
  _sh.item = '';
  var keep = document.getElementById('rr-shelve-keep');
  if (!(keep && keep.checked)) _sh.place = null;
  _shStatus(msg, true);
  _shPaint();
  try { if (typeof renderBrowse === 'function' && document.querySelector('#page-browse.active')) renderBrowse(); } catch (e) {}
  return true;
}
async function rrShelveUndo() {
  if (!_sh || !_sh.last) return false;
  var l = _sh.last;
  var ok = await rrShelveSaveLocation(l.key, l.prev);
  if (ok && _sh) { _sh.last = null; _shStatus(_shW('undone'), true); _shPaint(); }
  return ok;
}

// ── a sticker the app has not seen ─────────────────────────────────────────
function _shDialog(html, onClose) {
  var old = document.getElementById('rr-shelve-ask'); if (old) old.remove();
  var d = document.createElement('div');
  d.id = 'rr-shelve-ask';
  d.style.cssText = 'position:fixed;inset:0;z-index:9750;background:var(--scrim);display:flex;align-items:center;justify-content:center;padding:1rem';
  d.innerHTML = '<div style="position:relative;background:var(--surface);border:1px solid var(--border);border-radius:14px;max-width:440px;width:100%;max-height:86vh;overflow:auto;padding:1.1rem;color:var(--text);font-family:var(--font-body)">' +
    '<button data-sh-x aria-label="Close" style="position:absolute;top:0.4rem;right:0.6rem;background:none;border:none;color:var(--text-dim);font-size:1.4rem;line-height:1;cursor:pointer">&times;</button>' + html + '</div>';
  document.body.appendChild(d);
  d.querySelector('[data-sh-x]').addEventListener('click', function () { d.remove(); if (typeof onClose === 'function') onClose(); });
  if (typeof rrDismissGuard === 'function') { try { rrDismissGuard(d); } catch (e) {} }
  return d;
}
var _SH_BTN = 'display:block;width:100%;text-align:left;padding:0.65rem 0.8rem;margin-top:0.45rem;border-radius:9px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.92rem;cursor:pointer';
function _shAskNew(code) {
  return new Promise(function (resolve) {
    var d = _shDialog('<div style="font-weight:700;font-size:1.02rem;margin-bottom:0.3rem">' + _shEsc(_shW('newTitle')) + '</div>' +
      '<div style="font-size:0.88rem;color:var(--text-mid)">' + _shEsc(_shW('newAsk')) + '</div>' +
      '<button data-sh="item" style="' + _SH_BTN + '">' + _shEsc(_shW('newItem')) + '</button>' +
      '<button data-sh="place" style="' + _SH_BTN + '">' + _shEsc(_shW('newPlace')) + '</button>' +
      '<button data-sh="add" style="' + _SH_BTN + '">' + _shEsc(_shW('newAdd')) + '</button>' +
      '<button data-sh="cancel" style="' + _SH_BTN + ';text-align:center;color:var(--text-dim)">' + _shEsc(_shW('cancel')) + '</button>', function () { resolve(null); });
    d.querySelectorAll('[data-sh]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var what = b.getAttribute('data-sh');
        d.remove();
        if (what === 'item') resolve(await _shPickItem(code));
        else if (what === 'place') resolve(await _shPickPlace(code));
        else if (what === 'add') resolve(await _shAddNew(code));
        else resolve(null);
      });
    });
  });
}
function _shOwnedKeys() {
  return Object.keys(state.personalData || {}).filter(function (k) { var p = state.personalData[k]; return p && p.owned && p.row; });
}
function _shPickItem(code, keys, ask) {
  return new Promise(function (resolve) {
    var pool = keys || _shOwnedKeys();
    var d = _shDialog('<div style="font-weight:700;margin-bottom:0.45rem">' + _shEsc(ask || _shW('pickItem')) + '</div>' +
      (keys ? '' : '<input id="rr-shelve-q" type="text" placeholder="' + _shEsc(_shW('pickItemSearch')) + '" style="width:100%;box-sizing:border-box;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.5rem 0.65rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem">') +
      '<div id="rr-shelve-hits" style="margin-top:0.4rem"></div>' +
      '<button data-sh-cancel style="' + _SH_BTN + ';text-align:center;color:var(--text-dim)">' + _shEsc(_shW('cancel')) + '</button>', function () { resolve(null); });
    var hits = d.querySelector('#rr-shelve-hits');
    var draw = function (q) {
      q = String(q || '').trim().toLowerCase();
      var list = pool.filter(function (k) {
        if (!q) return true;
        var p = state.personalData[k];
        return (String(p.itemNum || '') + ' ' + rrShelveItemName(p) + ' ' + (p.inventoryId || '')).toLowerCase().indexOf(q) >= 0;
      }).slice(0, 30);
      hits.innerHTML = list.map(function (k) {
        var p = state.personalData[k];
        return '<button data-sh-key="' + _shEsc(k) + '" style="' + _SH_BTN + '">' + _shEsc(rrShelveItemName(p)) +
          (p.inventoryId ? ' <span style="color:var(--text-dim);font-size:0.78rem">#' + _shEsc(p.inventoryId) + '</span>' : '') + '</button>';
      }).join('');
      hits.querySelectorAll('[data-sh-key]').forEach(function (b) {
        b.addEventListener('click', async function () {
          var k = b.getAttribute('data-sh-key');
          d.remove();
          if (await rrStickerSetItem(k, code)) resolve({ kind: 'item', key: k, pd: state.personalData[k] });
          else resolve(null);
        });
      });
    };
    var q = d.querySelector('#rr-shelve-q');
    if (q) { q.addEventListener('input', function () { draw(q.value); }); setTimeout(function () { try { q.focus(); } catch (e) {} }, 50); }
    draw('');
    d.querySelector('[data-sh-cancel]').addEventListener('click', function () { d.remove(); resolve(null); });
  });
}
function _shPickPlace(code) {
  return new Promise(function (resolve) {
    var locs = (typeof rrSavedLocations === 'function') ? rrSavedLocations() : [];
    var rows = [];
    locs.forEach(function (l) {
      rows.push({ loc: l.name, spot: '' });
      (l.details || []).forEach(function (s) { rows.push({ loc: l.name, spot: s }); });
    });
    var inp = 'width:100%;box-sizing:border-box;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.5rem 0.65rem;color:var(--text);font-family:var(--font-body);font-size:0.9rem;margin-top:0.35rem';
    var d = _shDialog('<div style="font-weight:700;margin-bottom:0.3rem">' + _shEsc(_shW('pickPlace')) + '</div>' +
      rows.map(function (r, i) { return '<button data-sh-pl="' + i + '" style="' + _SH_BTN + '">' + _shEsc(rrShelvePlaceName(r)) + '</button>'; }).join('') +
      '<div style="font-size:0.8rem;color:var(--text-dim);margin-top:0.8rem">' + _shEsc(_shW('newPlaceLabel')) + '</div>' +
      '<input id="rr-shelve-nl" type="text" placeholder="' + _shEsc(_shW('newPlaceName')) + '" style="' + inp + '">' +
      '<input id="rr-shelve-ns" type="text" placeholder="' + _shEsc(_shW('newPlaceSpot')) + '" style="' + inp + '">' +
      '<button data-sh-new style="' + _SH_BTN + ';text-align:center;font-weight:700">' + _shEsc(_shW('usePlace')) + '</button>' +
      '<button data-sh-cancel style="' + _SH_BTN + ';text-align:center;color:var(--text-dim)">' + _shEsc(_shW('cancel')) + '</button>', function () { resolve(null); });
    var take = async function (p) {
      d.remove();
      if (await rrStickerSetPlace(code, p)) resolve({ kind: 'place', place: { loc: p.loc, spot: p.spot || '' } });
      else resolve(null);
    };
    d.querySelectorAll('[data-sh-pl]').forEach(function (b) {
      b.addEventListener('click', function () { take(rows[parseInt(b.getAttribute('data-sh-pl'), 10)]); });
    });
    d.querySelector('[data-sh-new]').addEventListener('click', function () {
      var loc = String(d.querySelector('#rr-shelve-nl').value || '').trim();
      var spot = String(d.querySelector('#rr-shelve-ns').value || '').trim();
      if (!loc) { d.querySelector('#rr-shelve-nl').focus(); return; }
      // a new place joins the saved list, so it is offered everywhere else too
      try {
        var all = rrSavedLocations();
        var hit = all.filter(function (l) { return l.name.toLowerCase() === loc.toLowerCase(); })[0];
        if (!hit) { hit = { name: loc, type: 'Other', details: [] }; all.push(hit); }
        else loc = hit.name;
        if (spot && !hit.details.some(function (s) { return String(s).toLowerCase() === spot.toLowerCase(); })) hit.details.push(spot);
        rrSaveLocations(all);
      } catch (e) {}
      take({ loc: loc, spot: spot });
    });
    d.querySelector('[data-sh-cancel]').addEventListener('click', function () { d.remove(); resolve(null); });
  });
}
// "Add a new item": the normal Add steps, then the sticker goes on what was
// just saved. The camera screen steps aside and comes back.
function _shAddNew(code) {
  return new Promise(function (resolve) {
    var before = {};
    _shOwnedKeys().forEach(function (k) { before[k] = true; });
    var ov = document.getElementById('rr-shelve');
    if (ov) ov.style.display = 'none';
    var me = _sh;
    if (me) me.busy = true;
    if (typeof startWizardFor === 'function') startWizardFor('collection');
    var t = setInterval(async function () {
      var m = document.getElementById('wizard-modal');
      if (m && m.classList.contains('open')) return;
      clearInterval(t);
      if (ov) ov.style.display = 'flex';
      var fresh = _shOwnedKeys().filter(function (k) { return !before[k]; });
      var nonBox = fresh.filter(function (k) { return !/-(M)?BOX$/i.test(String(state.personalData[k].itemNum || '')); });
      var pick = nonBox.length ? nonBox : fresh;
      if (!pick.length) { resolve(null); return; }
      if (pick.length === 1) {
        resolve((await rrStickerSetItem(pick[0], code)) ? { kind: 'item', key: pick[0], pd: state.personalData[pick[0]] } : null);
        return;
      }
      resolve(await _shPickItem(code, pick, _shW('afterAdd')));
    }, 400);
  });
}

// ── for the item page and Storage Locations ────────────────────────────────
function rrShelveItemLineHtml(pd, key) {
  if (!rrShelveOn() || !pd || !key) return '';
  var k = String(key).replace(/'/g, '');
  var has = !!rrStickerNorm(pd.stickerCode);
  var btn = 'padding:0.2rem 0.55rem;border-radius:7px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-family:var(--font-body);font-size:0.75rem;cursor:pointer;margin-left:0.35rem';
  return '<div id="rr-shelve-itemline" style="margin-top:0.7rem;padding-top:0.6rem;border-top:1px solid var(--border);display:flex;align-items:center;flex-wrap:wrap;gap:0.3rem;font-size:0.85rem">' +
    '<span style="color:var(--text-dim);font-weight:600">' + _shEsc(_shW('itemLine')) + ':</span> ' +
    '<span>' + _shEsc(has ? _shW('itemPaired') : _shW('itemNone')) + '</span>' +
    (has
      ? '<button onclick="rrShelvePairItem(\'' + k + '\')" style="' + btn + '">' + _shEsc(_shW('replace')) + '</button>' +
        '<button onclick="rrShelveRemoveItemSticker(\'' + k + '\')" style="' + btn + '">' + _shEsc(_shW('remove')) + '</button>'
      : '<button onclick="rrShelvePairItem(\'' + k + '\')" style="' + btn + '">' + _shEsc(_shW('pair')) + '</button>') +
    '</div>';
}
function _shRedrawDetail() {
  try { if (typeof rrDetailRepaint === 'function') rrDetailRepaint(0); } catch (e) {}   // by identity (app-collection.js)
}
function rrShelvePairItem(key) {
  var pd = state.personalData[key]; if (!pd) return;
  rrShelveOpen({ kind: 'pairItem', key: key, label: rrShelveItemName(pd), after: _shRedrawDetail });
}
async function rrShelveRemoveItemSticker(key) {
  if (await rrStickerClearItem(key)) _shRedrawDetail();
}
function rrShelvePlaceBtnHtml(loc, spot) {
  if (!rrShelveOn()) return '';
  var p = { loc: loc, spot: spot || '' };
  var has = !!rrStickerCodeForPlace(p);
  var data = ' data-sh-loc="' + _shEsc(loc) + '" data-sh-spot="' + _shEsc(spot || '') + '"';
  var st = 'background:none;border:1px solid var(--border);color:var(--text-mid);border-radius:7px;font-size:0.68rem;cursor:pointer;padding:0.12rem 0.45rem;margin-right:0.3rem;white-space:nowrap';
  return has
    ? '<button data-sh-unpair' + data + ' title="' + _shEsc(_shW('remove')) + '" style="' + st + '">▣ ' + _shEsc(_shW('placePaired')) + ' ×</button>'
    : '<button data-sh-pairplace' + data + ' style="' + st + '">' + _shEsc(_shW('pair')) + '</button>';
}
// Storage Locations calls this after drawing its list.
function rrShelveWirePlaceBtns(root, redraw) {
  if (!root) return;
  root.querySelectorAll('[data-sh-pairplace]').forEach(function (b) {
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      var p = { loc: b.getAttribute('data-sh-loc'), spot: b.getAttribute('data-sh-spot') || '' };
      rrShelveOpen({ kind: 'pairPlace', place: p, label: rrShelvePlaceName(p), after: redraw });
    });
  });
  root.querySelectorAll('[data-sh-unpair]').forEach(function (b) {
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      rrStickerClearPlace({ loc: b.getAttribute('data-sh-loc'), spot: b.getAttribute('data-sh-spot') || '' });
      if (typeof redraw === 'function') redraw();
    });
  });
}
function rrShelveTopHtml() {
  if (!rrShelveOn()) return '';
  return '<div id="rr-shelve-top" style="margin-bottom:0.85rem;padding:0.7rem;border:1px solid var(--border);border-radius:10px;background:var(--surface2)">' +
    '<button onclick="rrShelveOpen()" class="pref-btn" style="font-weight:700">▣ ' + _shEsc(_shW('button')) + '</button>' +
    '<div style="font-size:0.78rem;color:var(--text-dim);line-height:1.45;margin-top:0.4rem">' + _shEsc(_shW('buttonHelp')) + '</div>' +
    '</div>';
}

if (typeof window !== 'undefined') {
  Object.assign(window, {
    rrShelveOn: rrShelveOn, rrStickerNorm: rrStickerNorm, rrStickerPlaces: rrStickerPlaces, rrStickerFind: rrStickerFind,
    rrStickerSetItem: rrStickerSetItem, rrStickerClearItem: rrStickerClearItem, rrStickerSetPlace: rrStickerSetPlace,
    rrStickerClearPlace: rrStickerClearPlace, rrStickerForgetPlace: rrStickerForgetPlace, rrStickerCodeForPlace: rrStickerCodeForPlace,
    rrShelveSaveLocation: rrShelveSaveLocation, rrShelveOpen: rrShelveOpen, rrShelveClose: rrShelveClose, rrShelveCode: rrShelveCode,
    rrShelveUndo: rrShelveUndo, rrShelveItemName: rrShelveItemName, rrShelvePlaceName: rrShelvePlaceName,
    rrShelveItemLineHtml: rrShelveItemLineHtml, rrShelvePairItem: rrShelvePairItem, rrShelveRemoveItemSticker: rrShelveRemoveItemSticker,
    rrShelvePlaceBtnHtml: rrShelvePlaceBtnHtml, rrShelveWirePlaceBtns: rrShelveWirePlaceBtns, rrShelveTopHtml: rrShelveTopHtml,
  });
}
