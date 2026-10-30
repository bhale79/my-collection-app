// ═══════════════════════════════════════════════════════════════════════════
// SCAN TO SHELVE — v0.9.2020 (owners only until Brad opens it); printed labels v0.9.2023
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
// ── v0.9.2023: the app's own printed codes ─────────────────────────────────
// A short tag of THIS collection's sheet, so a label printed for one collection
// never names an item in another (inventory numbers repeat across sheets).
function _shSheetTag() {
  var id = String((state && state.personalSheetId) || ''), h = 2166136261;
  for (var i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return ('000000' + h.toString(36)).slice(-6);
}
function rrStickerAppCodeItem(pd) {
  return pd && pd.inventoryId ? RR_SHELVE.codePrefix + ':I:' + _shSheetTag() + ':' + encodeURIComponent(String(pd.inventoryId)) : '';
}
function rrStickerAppCodePlace(p) {
  return p && p.loc ? RR_SHELVE.codePrefix + ':P:' + encodeURIComponent(String(p.loc).trim()) + ':' + encodeURIComponent(String(p.spot || '').trim()) : '';
}
function rrStickerParseApp(code) {
  var c = rrStickerNorm(code), pre = RR_SHELVE.codePrefix + ':';
  if (c.indexOf(pre) !== 0) return null;
  var parts = c.slice(pre.length).split(':');
  try {
    if (parts[0] === 'I' && parts.length === 3) return { kind: 'item', tag: parts[1], inv: decodeURIComponent(parts[2]) };
    if (parts[0] === 'P' && parts.length === 3) return { kind: 'place', loc: decodeURIComponent(parts[1]), spot: decodeURIComponent(parts[2]) };
  } catch (e) {}
  return null;
}
function rrStickerFind(code) {
  var c = rrStickerNorm(code);
  if (!c) return null;
  var app = rrStickerParseApp(c);
  if (app && app.kind === 'place' && app.loc) return { kind: 'place', place: { loc: app.loc, spot: app.spot || '' }, printed: true };
  if (app && app.kind === 'item') {
    if (app.tag !== _shSheetTag()) return { kind: 'foreign', printed: true };
    var pdAll = state.personalData || {};
    for (var ik in pdAll) { var ip = pdAll[ik]; if (ip && ip.owned && String(ip.inventoryId) === String(app.inv)) return { kind: 'item', key: ik, pd: ip, printed: true }; }
    return { kind: 'missing', inv: app.inv, printed: true };
  }
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
  if (rrStickerParseApp(c)) { if (typeof showToast === 'function') showToast(_shW('printedLabel'), 4000, true); return false; }
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
  if (rrStickerParseApp(c)) { if (typeof showToast === 'function') showToast(_shW('printedLabel'), 4000, true); return false; }
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
// how = 'scan' | 'undo' | 'check' — the Movement Log's How column (RR_MOVE_LOG.how).
async function rrShelveSaveLocation(key, place, how) {
  var pd = state.personalData[key];
  if (!pd || !pd.row || !place) return false;
  var loc = String(place.loc || '').trim(), spot = String(place.spot || '').trim();
  var from = { loc: String(pd.location || '').trim(), spot: String(pd.locationDetail || '').trim() };
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
  // v0.9.2041: one line in the Movement Log for a real move. The move is
  // already saved; a log that cannot be written never undoes or blocks it.
  if (!_shSamePlace(from, { loc: loc, spot: spot })) {
    try { await rrMoveLogAdd(pd, from, { loc: loc, spot: spot }, how || 'scan'); } catch (e) { console.warn('[movement log]', e && e.message); }
  }
  return true;
}

// ═══ v0.9.2041 — THE MOVEMENT LOG ═════════════════════════════════════════
// Lines are only ADDED (sheetsAppend). Nothing in the app edits, clears or
// deletes them — tests/scan_shelve_pro_2041_tests.js scans for it.
var _SH_MOVE_TAB = (typeof rrFeatureTab === 'function' ? rrFeatureTab : String)('Movement Log');
var _shMoveOk = {};                                   // which spreadsheets have the tab (this session)
function _shMoveKnown(sid) {
  if (_shMoveOk[sid]) return true;
  try { return (JSON.parse(localStorage.getItem(RR_MOVE_LOG.okKey) || '[]') || []).indexOf(sid) >= 0; } catch (e) { return false; }
}
function _shMoveRemember(sid) {
  _shMoveOk[sid] = true;
  try {
    var l = JSON.parse(localStorage.getItem(RR_MOVE_LOG.okKey) || '[]') || [];
    if (l.indexOf(sid) < 0) { l.push(sid); localStorage.setItem(RR_MOVE_LOG.okKey, JSON.stringify(l.slice(-50))); }
  } catch (e) {}
}
var _shMoveMaking = null;                             // one "make the tab" at a time
async function _shMoveEnsure(sid) {
  if (_shMoveOk[sid]) return true;
  if (_shMoveMaking && _shMoveMaking.sid === sid) return _shMoveMaking.p;
  var p = (async function () {
    try {
      var meta = await (await _withTokenRetry(function () { return fetch('https://sheets.googleapis.com/v4/spreadsheets/' + sid + '?fields=sheets.properties',
        { headers: { Authorization: 'Bearer ' + accessToken } }); })).json();
      if (!meta || !Array.isArray(meta.sheets)) return false;           // a failed read is not "missing" — never create on a guess
      if (meta.sheets.some(function (sh) { return sh.properties && sh.properties.title === _SH_MOVE_TAB; })) { _shMoveRemember(sid); return true; }
      // the sheet is backed up BEFORE it gains a tab — no backup, no new tab
      await backupCreateAuto(RR_MOVE_LOG.backupReason);
      await _withTokenRetry(function () { return fetch('https://sheets.googleapis.com/v4/spreadsheets/' + sid + ':batchUpdate', {
        method: 'POST', headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: [{ addSheet: { properties: { title: _SH_MOVE_TAB, tabColor: { red: 0.36, green: 0.42, blue: 0.75 } } } }] })
      }); });
      await sheetsUpdate(sid, _SH_MOVE_TAB + '!A1:H2', [RR_MOVE_LOG.headers, [RR_MOVE_LOG.note, '', '', '', '', '', '', '']]);
      _shMoveRemember(sid);
      return true;
    } catch (e) { console.warn('[movement log] could not make the tab', e && e.message); return false; }
  })();
  _shMoveMaking = { sid: sid, p: p };
  try { return await p; } finally { if (_shMoveMaking && _shMoveMaking.p === p) _shMoveMaking = null; }
}
function _shWhen(d) {
  var p2 = function (n) { return (n < 10 ? '0' : '') + n; };
  return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
}
function rrMoveLogRow(pd, from, to, how, when, who) {
  var name = function (p) { return p && p.loc ? rrShelvePlaceName(p) : RR_MOVE_LOG.words.nowhere; };
  // a leading ' keeps Sheets from turning "2026-10-29 01:14", 000123 or 1317-2 into a date or a number
  return ["'" + _shWhen(when || new Date()), "'" + String(pd.inventoryId || ''), "'" + String(pd.itemNum || ''), rrShelveItemName(pd),
          name(from), name(to), String(who || ''), (RR_MOVE_LOG.how[how] || RR_MOVE_LOG.how.scan)];
}
async function rrMoveLogAdd(pd, from, to, how) {
  var sid = state.personalSheetId;
  if (!sid || !pd) return false;
  var ok = _shMoveKnown(sid) || ((typeof _rrOfflineNow !== 'function' || !_rrOfflineNow()) && await _shMoveEnsure(sid));
  if (!ok) return false;
  var who = (state.user && (state.user.email || state.user.name)) || '';
  await sheetsAppend(sid, _SH_MOVE_TAB + '!A:H', [rrMoveLogRow(pd, from, to, how, new Date(), who)]);
  return true;
}
// The item page's history: this copy's lines, newest first.
async function rrMoveLogFor(pd) {
  var res = await sheetsGet(state.personalSheetId, _SH_MOVE_TAB + '!A3:H');
  var inv = String(pd.inventoryId || '');
  var bare = function (v) { return String(v == null ? '' : v).replace(/^'/, '').trim(); };
  return ((res && res.values) || []).filter(function (r) { return inv && bare(r[1]) === inv; })
    .map(function (r) { return { when: bare(r[0]), from: bare(r[4]), to: bare(r[5]), who: bare(r[6]), how: bare(r[7]) }; }).reverse();
}
async function rrShelveHistory(key) {
  var pd = state.personalData[key]; if (!pd) return null;
  var W = RR_MOVE_LOG.words, lines;
  try { lines = await rrMoveLogFor(pd); }
  catch (e) { if (typeof showToast === 'function') showToast(W.historyFailed, 4500, true); return null; }
  var box = 'padding:0.45rem 0.55rem;border:1px solid var(--border);border-radius:8px;margin-top:0.35rem;background:var(--surface2);font-size:0.86rem;line-height:1.4';
  return _shDialog('<div id="rr-move-history" style="font-weight:700;font-size:1.02rem;margin-bottom:0.3rem">' + _shEsc(W.historyTitle.replace('{item}', rrShelveItemName(pd))) + '</div>' +
    (lines.length ? lines.map(function (l) {
      return '<div data-move-line style="' + box + '"><div style="color:var(--text-dim);font-size:0.76rem">' + _shEsc(l.when) + (l.how ? ' \u00b7 ' + _shEsc(l.how) : '') + (l.who ? ' \u00b7 ' + _shEsc(l.who) : '') + '</div>' +
        _shEsc(l.from) + ' \u2192 <strong>' + _shEsc(l.to) + '</strong></div>';
    }).join('') : '<div style="font-size:0.88rem;color:var(--text-mid)">' + _shEsc(W.historyNone) + '</div>'));
}

// ── the screen ─────────────────────────────────────────────────────────────
var _sh = null;   // { mode, item, place, last, stream, stop, busy, seen }

function rrShelveOpen(mode) {
  if (!rrShelveOn()) return;
  mode = mode || { kind: 'shelve' };
  // v0.9.2041 (TRR Pro release 3): Scan to Shelve fills in Location, so it
  // switches Track Storage Location on through that switch's own door (the
  // same one Preferences uses) instead of sending the person to find it.
  if ((mode.kind === 'shelve' || mode.kind === 'check') && !rrShelveLocationOn()) {
    if (!_shLocationTurnOn()) { if (typeof showToast === 'function') showToast(_shW('needLocation'), 5000, true); return; }
    if (typeof showToast === 'function') showToast(_shW('locationTurnedOn'), 4500);
  }
  rrShelveClose();
  _sh = { mode: mode, item: '', place: null, last: null, stream: null, stop: false, busy: false, seen: {}, scanned: {}, checkPlace: null };
  var ov = document.createElement('div');
  ov.id = 'rr-shelve';
  ov.style.cssText = 'position:fixed;inset:0;z-index:9700;background:var(--bg);display:flex;flex-direction:column;font-family:var(--font-body);color:var(--text)';
  var title = mode.kind === 'shelve' ? _shW('title') : mode.kind === 'check' ? _shW('check') : _shW('pair');
  var firstLine = mode.kind === 'shelve' ? _shW('aim') : mode.kind === 'check' ? _shW('checkScanShelf') : _shW('pairScan', { what: mode.label || '' });
  ov.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:0.75rem 1rem;border-bottom:1px solid var(--border);background:var(--surface)">' +
      '<strong style="font-size:1.05rem">' + _shEsc(title) + '</strong>' +
      '<button id="rr-shelve-x" aria-label="Close" style="background:none;border:none;color:var(--text);font-size:1.6rem;line-height:1;cursor:pointer">&times;</button>' +
    '</div>' +
    '<div id="rr-shelve-cam" style="position:relative;background:var(--ink-dark);flex:0 0 auto;aspect-ratio:4/3;max-height:52vh;max-height:52dvh;overflow:hidden">' +
      '<video id="rr-shelve-video" playsinline muted autoplay style="width:100%;height:100%;object-fit:cover"></video>' +
      '<div id="rr-shelve-nocam" style="display:none;position:absolute;inset:0;align-items:center;justify-content:center;text-align:center;padding:1rem;color:var(--ink-light);font-size:0.95rem;line-height:1.5"></div>' +
    '</div>' +
    '<div style="padding:0.8rem 1rem;overflow:auto;flex:1">' +
      '<div id="rr-shelve-status" style="font-size:0.95rem;font-weight:600;margin-bottom:0.6rem">' + _shEsc(firstLine) + '</div>' +
      '<div id="rr-shelve-here" style="font-size:0.88rem;margin-bottom:0.5rem"></div>' +
      (mode.kind === 'check'
        ? '<div id="rr-shelve-checklog" style="font-size:0.86rem;margin-bottom:0.6rem;color:var(--text-mid)"></div>' +
          '<button id="rr-shelve-checkdone" class="pref-btn" style="font-weight:700;margin-bottom:0.6rem;display:none">' + _shEsc(_shW('checkDone')) + '</button>'
        : '') +
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
  var done = ov.querySelector('#rr-shelve-checkdone');
  if (done) done.addEventListener('click', rrShelveCheckResult);
  _shCameraStart();
}
// Track Storage Location on, through ITS door: the account setting (_prefSet)
// and the live switch (_onPrefChange), exactly as Preferences turns it on.
function _shLocationTurnOn() {
  try {
    if (typeof _prefSet !== 'function') return false;
    _prefSet('lv_location_enabled', 'true');
    if (typeof _onPrefChange === 'function') _onPrefChange('location', true);
    var cb = document.getElementById('ptog-location'); if (cb) cb.checked = true;
    return rrShelveLocationOn();
  } catch (e) { return false; }
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
    // a printed label already says what it is — it is never paired to anything
    if ((mode.kind === 'pairItem' || mode.kind === 'pairPlace') && rrStickerParseApp(c)) { _shStatus(_shW('printedLabel')); return false; }
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
    if (f && f.kind === 'foreign') { _shStatus(_shW('foreign')); return false; }
    if (f && f.kind === 'missing') { _shStatus(_shW('missing', { inv: f.inv })); return false; }
    if (mode.kind === 'check') return _shCheckCode(f);      // v0.9.2041: never asks, never writes
    if (!f) {
      f = await _shAskNew(c);
      if (!f || !_sh) return false;
    }
    if (f.kind === 'item') _sh.item = f.key;
    else _sh.place = f.place;
    if (_sh.item && _sh.place) return await _shSavePair();
    _shPaint();
    _shStatus(_sh.item ? _shW('needPlace') : _shW('needItem'));
    if (!_sh.item && _sh.place) _shHereLink(_sh.place);
    return true;
  } finally {
    if (_sh) _sh.busy = false;
  }
}
async function _shSavePair() {
  var key = _sh.item, place = _sh.place, pd = state.personalData[key];
  var prev = { loc: pd ? (pd.location || '') : '', spot: pd ? (pd.locationDetail || '') : '' };
  var ok = await rrShelveSaveLocation(key, place, 'scan');
  if (!_sh) return ok;
  if (!ok) { _shPaint(); return false; }
  var msg = _shW('saved', { item: rrShelveItemName(pd), place: rrShelvePlaceName(place) });
  _sh.last = { key: key, prev: prev, msg: msg };
  _sh.item = '';
  _shHereLink(null);
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
  var ok = await rrShelveSaveLocation(l.key, l.prev, 'undo');
  if (ok && _sh) { _sh.last = null; _shStatus(_shW('undone'), true); _shPaint(); }
  return ok;
}

// ═══ v0.9.2041 — WHAT'S ON THIS SHELF + SHELF CHECK (TRR Pro release 3) ═══
// Both only READ. The one write on these screens is "Move here", and it goes
// through the one location writer, rrShelveSaveLocation.
function _shNorm(v) { return String(v == null ? '' : v).trim().toLowerCase(); }
// The owned copies recorded at a place. A place with a spot = that spot only;
// a place without one = everything in that location, whatever spot. Pure.
function rrShelveItemsAt(place) {
  if (!place || !_shNorm(place.loc)) return [];
  var loc = _shNorm(place.loc), spot = _shNorm(place.spot);
  return _shOwnedKeys().filter(function (k) {
    var p = state.personalData[k];
    if (_shNorm(p.location) !== loc) return false;
    return !spot || _shNorm(p.locationDetail) === spot;
  });
}
function _shHereLink(place) {
  var el = document.getElementById('rr-shelve-here');
  if (!el) return;
  if (!place) { el.innerHTML = ''; return; }
  var n = rrShelveItemsAt(place).length;
  el.innerHTML = '<button id="rr-shelve-herebtn" class="pref-btn" style="font-size:0.8rem">' + _shEsc(_shW('whatsHere', { n: n })) + '</button>';
  el.querySelector('#rr-shelve-herebtn').addEventListener('click', function () { rrShelveWhatsHere(place); });
}
function rrShelveWhatsHere(place) {
  var keys = rrShelveItemsAt(place);
  var line = function (k) {
    var p = state.personalData[k];
    return '<div style="padding:0.45rem 0.55rem;border:1px solid var(--border);border-radius:8px;margin-top:0.35rem;background:var(--surface2);font-size:0.88rem">' +
      _shEsc(rrShelveItemName(p)) + (p.inventoryId ? ' <span style="color:var(--text-dim);font-size:0.78rem">#' + _shEsc(p.inventoryId) + '</span>' : '') +
      (!_shNorm(place.spot) && p.locationDetail ? ' <span style="color:var(--text-dim);font-size:0.78rem">› ' + _shEsc(p.locationDetail) + '</span>' : '') + '</div>';
  };
  return _shDialog('<div id="rr-shelve-herelist" style="font-weight:700;font-size:1.02rem;margin-bottom:0.3rem">' + _shEsc(_shW('whatsHereTitle', { place: rrShelvePlaceName(place) })) + '</div>' +
    (keys.length ? keys.map(line).join('') : '<div style="font-size:0.88rem;color:var(--text-mid)">' + _shEsc(_shW('whatsHereNone')) + '</div>'));
}
// One scan during a shelf check: the first must be a shelf; then items are
// ticked off. Nothing is written and no "new sticker" question is asked.
function _shCheckCode(f) {
  if (!_sh.checkPlace) {
    if (!f || f.kind !== 'place') { _shStatus(_shW('checkPlaceFirst')); return false; }
    _sh.checkPlace = f.place; _sh.scanned = {};
    _shStatus(_shW('checkScanItems', { place: rrShelvePlaceName(f.place) }));
    var d = document.getElementById('rr-shelve-checkdone'); if (d) d.style.display = '';
    _shHereLink(f.place);
    return true;
  }
  if (!f) { _shStatus(_shW('checkPlaceFirst')); return false; }
  if (f.kind === 'place') {
    if (_shSamePlace(f.place, _sh.checkPlace)) return true;
    _shStatus(_shW('checkAnotherShelf')); return false;
  }
  if (f.kind !== 'item') return false;
  if (!_sh.scanned[f.key]) {
    _sh.scanned[f.key] = true;
    var log = document.getElementById('rr-shelve-checklog');
    if (log) log.insertAdjacentHTML('afterbegin', '<div>' + _shEsc(_shW('checkScanned', { item: rrShelveItemName(f.pd) })) + '</div>');
  }
  _shStatus(_shW('checkScanned', { item: rrShelveItemName(f.pd) }), true);
  return true;
}
// The result, pure: { found, missing, elsewhere } as lists of keys.
function rrShelveCheckSort(place, scannedKeys) {
  var here = rrShelveItemsAt(place), seen = {}, inHere = {};
  (scannedKeys || []).forEach(function (k) { seen[k] = true; });
  here.forEach(function (k) { inHere[k] = true; });
  return {
    found: here.filter(function (k) { return seen[k]; }),
    missing: here.filter(function (k) { return !seen[k]; }),
    elsewhere: Object.keys(seen).filter(function (k) { return !inHere[k] && state.personalData[k]; }),
  };
}
function rrShelveCheckResult() {
  if (!_sh || !_sh.checkPlace) return null;
  var place = _sh.checkPlace;
  var r = rrShelveCheckSort(place, Object.keys(_sh.scanned));
  var name = function (k) { var p = state.personalData[k]; return _shEsc(rrShelveItemName(p)) + (p.inventoryId ? ' <span style="color:var(--text-dim);font-size:0.78rem">#' + _shEsc(p.inventoryId) + '</span>' : ''); };
  var box = 'padding:0.45rem 0.55rem;border:1px solid var(--border);border-radius:8px;margin-top:0.35rem;background:var(--surface2);font-size:0.86rem';
  var head = function (w, n) { return '<div style="font-weight:700;margin-top:0.85rem">' + _shEsc(_shW(w, { n: n })) + '</div>'; };
  var html = '<div style="font-weight:700;font-size:1.02rem">' + _shEsc(_shW('check')) + ' — ' + _shEsc(rrShelvePlaceName(place)) + '</div>';
  if (!r.missing.length && !r.elsewhere.length) html += '<div data-sh-allgood style="margin-top:0.5rem;color:var(--t-green);font-weight:600">' + _shEsc(_shW('checkAllGood')) + '</div>';
  if (r.missing.length) html += head('checkMissing', r.missing.length) + r.missing.map(function (k) {
    return '<div data-sh-missing="' + _shEsc(k) + '" style="' + box + '">' + name(k) + (rrStickerNorm(state.personalData[k].stickerCode) ? '' : ' <span style="color:var(--text-dim);font-size:0.76rem">(' + _shEsc(_shW('checkNoSticker')) + ')</span>') + '</div>';
  }).join('');
  if (r.elsewhere.length) html += head('checkElsewhere', r.elsewhere.length) + r.elsewhere.map(function (k) {
    var p = state.personalData[k];
    var was = p.location ? _shW('checkWas', { place: rrShelvePlaceName({ loc: p.location, spot: p.locationDetail || '' }) }) : _shW('checkNowhere');
    return '<div data-sh-else="' + _shEsc(k) + '" style="' + box + ';display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap"><span style="flex:1;min-width:10rem">' + name(k) +
      ' <span style="color:var(--text-dim);font-size:0.76rem">(' + _shEsc(was) + ')</span></span>' +
      '<button data-sh-movehere="' + _shEsc(k) + '" class="pref-btn" style="font-size:0.78rem">' + _shEsc(_shW('checkMoveHere')) + '</button></div>';
  }).join('');
  if (r.found.length) html += head('checkFound', r.found.length) + r.found.map(function (k) { return '<div data-sh-found="' + _shEsc(k) + '" style="' + box + '">' + name(k) + '</div>'; }).join('');
  var d = _shDialog('<div id="rr-shelve-checkresult">' + html + '</div>');
  d.querySelectorAll('[data-sh-movehere]').forEach(function (b) {
    b.addEventListener('click', async function () {
      if (b.disabled) return;
      b.disabled = true;                                  // one press = one write
      var k = b.getAttribute('data-sh-movehere');
      if (await rrShelveSaveLocation(k, place, 'check')) b.outerHTML = '<span style="color:var(--t-green);font-weight:600;font-size:0.8rem">' + _shEsc(_shW('checkMoved')) + '</span>';
      else b.disabled = false;
    });
  });
  return r;
}

// ── a sticker the app has not seen ─────────────────────────────────────────
function _shDialog(html, onClose) {
  var old = document.getElementById('rr-shelve-ask'); if (old) old.remove();
  var d = document.createElement('div');
  d.id = 'rr-shelve-ask';
  d.style.cssText = 'position:fixed;inset:0;z-index:9750;background:var(--scrim);display:flex;align-items:center;justify-content:center;padding:1rem';
  d.innerHTML = '<div style="position:relative;background:var(--surface);border:1px solid var(--border);border-radius:14px;max-width:440px;width:100%;max-height:86vh;max-height:86dvh;overflow:auto;padding:1.1rem;color:var(--text);font-family:var(--font-body)">' +
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
    '<button onclick="rrShelvePrintOpen(\'items\',[\'' + k + '\'])" style="' + btn + '">' + _shEsc(_shW('printLabel')) + '</button>' +
    '<button onclick="rrShelveHistory(\'' + k + '\')" style="' + btn + '">' + _shEsc(RR_MOVE_LOG.words.history) + '</button>' +   // v0.9.2041
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
    '<button onclick="rrShelveOpen({kind:\'check\'})" class="pref-btn" style="margin-left:0.35rem">' + _shEsc(_shW('check')) + '</button>' +
    '<span style="display:inline-flex;gap:0.35rem;flex-wrap:wrap;margin-left:0.35rem">' +
      '<button onclick="rrShelvePrintOpen(\'places\')" class="pref-btn" style="font-size:0.8rem">' + _shEsc(_shW('printShelves')) + '</button>' +
      '<button onclick="rrShelvePrintOpen(\'items\')" class="pref-btn" style="font-size:0.8rem">' + _shEsc(_shW('printItems')) + '</button>' +
    '</span>' +
    '<div style="font-size:0.78rem;color:var(--text-dim);line-height:1.45;margin-top:0.4rem">' + _shEsc(_shW('buttonHelp')) + '</div>' +
    '</div>';
}


// ═══ v0.9.2023 — PRINTED LABELS (Release 2) ═══════════════════════════════
// [stated] Brad: "we can have the ability to generate and print qr codes for
// locations and item inventory ids or be able to use premade qr stickers
// correct?" → "do release 2". The label sheet is a PDF (jsPDF, already on the
// page) on Avery 5160 labels (config.js RR_SHELVE.label); the QR maker is
// self-hosted (RR_SHELVE.qrLib). Each code says what it is — no pairing step.
var _shQrLoading = null;
function _shLoadQr() {
  if (typeof window.qrcode === 'function') return Promise.resolve(window.qrcode);
  if (_shQrLoading) return _shQrLoading;
  _shQrLoading = new Promise(function (resolve, reject) {
    var sc = document.createElement('script');
    sc.src = RR_SHELVE.qrLib;
    sc.onload = function () { typeof window.qrcode === 'function' ? resolve(window.qrcode) : reject(new Error('qr')); };
    sc.onerror = function () { _shQrLoading = null; reject(new Error('qr')); };
    document.head.appendChild(sc);
  });
  return _shQrLoading;
}
// v0.9.2041: THE label size — ONE account setting (RR_SHELVE.sizeKey), read
// ONLY here. Returns a template in inches. A single-label size is a page the
// label's own size, one label on it.
function _shSizeRaw() {
  try {
    var raw = (typeof rrPrefRead === 'function') ? rrPrefRead(RR_SHELVE.sizeKey) : localStorage.getItem(RR_SHELVE.sizeKey);
    var o = JSON.parse(raw || 'null');
    return (o && typeof o === 'object') ? o : null;
  } catch (e) { return null; }
}
function _shCustomOk(w, h) {
  var L = RR_SHELVE.customLimits;
  return isFinite(w) && isFinite(h) && w >= L.minW && w <= L.maxW && h >= L.minH && h <= L.maxH;
}
function _shOneLabelTpl(w, h) {
  var pad = Math.max(0.06, Math.min(0.15, Math.min(w, h) * 0.08));
  var side = w >= h * 1.6;                                   // wide: QR left, words right; else QR on top
  var qr = side ? Math.min(h - 2 * pad, w * 0.42) : Math.min(w - 2 * pad, h * 0.55);
  return { pageW: w, pageH: h, cols: 1, rows: 1, w: w, h: h, left: 0, top: 0, gapX: 0, gapY: 0, qr: Math.round(qr * 1000) / 1000, pad: pad, one: true, stack: !side };
}
function rrShelveLabelTpl() {
  var o = _shSizeRaw() || {};
  var def = (RR_SHELVE.sizes || []).filter(function (z) { return z.id === o.id; })[0];
  if (o.id === 'custom') {
    var w = parseFloat(o.w), h = parseFloat(o.h);
    if (_shCustomOk(w, h)) return Object.assign(_shOneLabelTpl(w, h), { id: 'custom' });
  } else if (def && def.w && def.h) {
    return Object.assign(_shOneLabelTpl(def.w, def.h), { id: def.id });
  }
  return Object.assign({}, RR_SHELVE.label, { id: 'avery5160' });
}
// The ONE writer. false (nothing saved) for an unknown size or a custom size outside the limits.
function rrShelveSetLabelSize(id, w, h) {
  var def = (RR_SHELVE.sizes || []).filter(function (z) { return z.id === id; })[0];
  if (!def) return false;
  var v = { id: id };
  if (id === 'custom') {
    w = parseFloat(w); h = parseFloat(h);
    if (!_shCustomOk(w, h)) return false;
    v.w = w; v.h = h;
  }
  var txt = JSON.stringify(v);
  if (typeof rrPrefWrite === 'function') rrPrefWrite(RR_SHELVE.sizeKey, txt); else localStorage.setItem(RR_SHELVE.sizeKey, txt);
  return true;
}
// Where label i lands on the sheets, in inches: skip = labels already used on
// the first sheet. Pure — the tests read it.
function rrShelveLabelSlots(count, skip, tpl) {
  tpl = tpl || RR_SHELVE.label;
  var per = tpl.cols * tpl.rows, out = [];
  skip = Math.max(0, Math.min(per - 1, parseInt(skip, 10) || 0));
  for (var i = 0; i < count; i++) {
    var n = i + skip, page = Math.floor(n / per), at = n % per;
    var row = Math.floor(at / tpl.cols), col = at % tpl.cols;
    out.push({ page: page, x: tpl.left + col * (tpl.w + tpl.gapX), y: tpl.top + row * (tpl.h + tpl.gapY) });
  }
  return out;
}
// The labels for what was ticked: { code, title, lines[] }.
function rrShelveLabelEntries(kind, list) {
  if (kind === 'places') {
    return (list || []).map(function (p) {
      return { code: rrStickerAppCodePlace(p), title: p.loc, lines: p.spot ? [p.spot] : [] };
    }).filter(function (e) { return e.code; });
  }
  return (list || []).map(function (k) {
    var pd = state.personalData[k]; if (!pd) return null;
    var num = String(pd.itemNum || '');
    var name = rrShelveItemName(pd);
    if (num && name.indexOf(num) === 0) name = name.slice(num.length).replace(/^[\s—–-]+/, '');
    return { code: rrStickerAppCodeItem(pd), title: num, lines: [name, '#' + pd.inventoryId].filter(Boolean) };
  }).filter(function (e) { return e && e.code; });
}
// One QR drawn as filled squares (runs of dark modules merged per row), with
// a 2-module quiet zone, inside a size x size box at (x, y).
function _shDrawQr(doc, qrLib, text, x, y, size) {
  var qr = qrLib(0, RR_SHELVE.qrLevel); qr.addData(text); qr.make();
  var n = qr.getModuleCount(), cell = size / (n + 4);
  for (var r = 0; r < n; r++) {
    var c = 0;
    while (c < n) {
      if (!qr.isDark(r, c)) { c++; continue; }
      var c0 = c; while (c < n && qr.isDark(r, c)) c++;
      doc.rect(x + (c0 + 2) * cell, y + (r + 2) * cell, (c - c0) * cell, cell, 'F');
    }
  }
  return n;
}
async function rrShelveLabelsPdf(entries, skip, tplIn) {
  var J = window.jspdf && window.jspdf.jsPDF;
  if (!J) throw new Error('jsPDF missing');
  var qrLib = await _shLoadQr();
  var tpl = tplIn || rrShelveLabelTpl();                   // v0.9.2041: the chosen size
  var doc = new J({ unit: 'in', format: [tpl.pageW, tpl.pageH], orientation: tpl.pageW > tpl.pageH ? 'landscape' : 'portrait' });
  var slots = rrShelveLabelSlots(entries.length, tpl.one ? 0 : skip, tpl), page = 0;
  doc.setTextColor(0); doc.setFillColor(0);
  entries.forEach(function (e, i) {
    var s = slots[i];
    while (s.page > page) { doc.addPage([tpl.pageW, tpl.pageH], tpl.pageW > tpl.pageH ? 'landscape' : 'portrait'); page++; }
    if (tpl.stack) { _shStackLabel(doc, qrLib, e, s, tpl); return; }
    var qx = s.x + tpl.pad, qy = s.y + (tpl.h - tpl.qr) / 2;
    _shDrawQr(doc, qrLib, e.code, qx, qy, tpl.qr);
    var tx = qx + tpl.qr + 0.06, tw = s.x + tpl.w - tpl.pad - tx, ty = s.y + 0.27;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.splitTextToSize(String(e.title || ''), tw).slice(0, 2).forEach(function (ln) { doc.text(ln, tx, ty); ty += 0.16; });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    e.lines.forEach(function (l) {
      doc.splitTextToSize(String(l), tw).slice(0, 2).forEach(function (ln) { if (ty < s.y + tpl.h - 0.06) { doc.text(ln, tx, ty); ty += 0.13; } });
    });
  });
  return { doc: doc, slots: slots, pages: page + 1, tpl: tpl };
}
// A tall label: the QR centred at the top, the words under it.
function _shStackLabel(doc, qrLib, e, s, tpl) {
  var qx = s.x + (tpl.w - tpl.qr) / 2, qy = s.y + tpl.pad;
  _shDrawQr(doc, qrLib, e.code, qx, qy, tpl.qr);
  var tw = tpl.w - 2 * tpl.pad, tx = s.x + tpl.pad;
  var big = Math.max(10, Math.min(28, tpl.w * 6)), small = Math.round(big * 0.75);
  var ty = qy + tpl.qr + big / 72 + 0.04;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(big);
  doc.splitTextToSize(String(e.title || ''), tw).slice(0, 2).forEach(function (ln) { doc.text(ln, tx, ty); ty += big / 72 * 1.15; });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(small);
  e.lines.forEach(function (l) {
    doc.splitTextToSize(String(l), tw).slice(0, 3).forEach(function (ln) { if (ty < s.y + tpl.h - tpl.pad) { doc.text(ln, tx, ty); ty += small / 72 * 1.2; } });
  });
}
function rrShelvePrintOpen(kind, preKeys) {
  if (!rrShelveOn()) return;
  var old = document.getElementById('rr-shelve-print'); if (old) old.remove();
  var isPlaces = kind === 'places';
  var rows = [];
  if (isPlaces) {
    ((typeof rrSavedLocations === 'function') ? rrSavedLocations() : []).forEach(function (l) {
      rows.push({ id: 'p' + rows.length, place: { loc: l.name, spot: '' }, text: l.name });
      (l.details || []).forEach(function (sp) { rows.push({ id: 'p' + rows.length, place: { loc: l.name, spot: sp }, text: rrShelvePlaceName({ loc: l.name, spot: sp }) }); });
    });
  } else {
    _shOwnedKeys().forEach(function (k) {
      var p = state.personalData[k];
      if (!p || !p.inventoryId) return;
      rows.push({ id: k, key: k, text: rrShelveItemName(p) + ' #' + p.inventoryId });
    });
  }
  var ticked = {};
  if (isPlaces) rows.forEach(function (r) { ticked[r.id] = true; });
  (preKeys || []).forEach(function (k) { ticked[k] = true; });
  var ov = document.createElement('div');
  ov.id = 'rr-shelve-print';
  ov.style.cssText = 'position:fixed;inset:0;z-index:9760;background:var(--scrim);display:flex;align-items:center;justify-content:center;padding:1rem';
  var inp = 'background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:0.45rem 0.6rem;color:var(--text);font-family:var(--font-body);font-size:0.88rem';
  ov.innerHTML = '<div style="position:relative;background:var(--surface);border:1px solid var(--border);border-radius:14px;max-width:480px;width:100%;max-height:88vh;max-height:88dvh;display:flex;flex-direction:column;color:var(--text);font-family:var(--font-body)">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:0.85rem 1rem;border-bottom:1px solid var(--border)">' +
      '<strong style="font-size:1.02rem">' + _shEsc(_shW(isPlaces ? 'printTitleShelves' : 'printTitleItems')) + '</strong>' +
      '<button id="rr-print-x" aria-label="Close" style="background:none;border:none;color:var(--text);font-size:1.5rem;line-height:1;cursor:pointer">&times;</button>' +
    '</div>' +
    '<div style="padding:0.8rem 1rem;overflow:auto;flex:1">' +
      '<div style="display:flex;gap:0.4rem;align-items:center;flex-wrap:wrap;margin-bottom:0.45rem">' +
        '<label for="rr-print-size" style="font-size:0.82rem;color:var(--text-mid)">' + _shEsc(_shW('labelSize')) + '</label>' +
        '<select id="rr-print-size" style="' + inp + ';flex:1;min-width:12rem">' + (RR_SHELVE.sizes || []).map(function (z) { return '<option value="' + _shEsc(z.id) + '">' + _shEsc(z.name) + '</option>'; }).join('') + '</select>' +
      '</div>' +
      '<div id="rr-print-custom" style="display:none;gap:0.4rem;align-items:center;flex-wrap:wrap;margin-bottom:0.45rem">' +
        '<label style="font-size:0.8rem;color:var(--text-mid)">' + _shEsc(_shW('labelCustomW')) + ' <input id="rr-print-cw" type="number" step="0.125" style="width:5rem;' + inp + '"></label>' +
        '<label style="font-size:0.8rem;color:var(--text-mid)">' + _shEsc(_shW('labelCustomH')) + ' <input id="rr-print-ch" type="number" step="0.125" style="width:5rem;' + inp + '"></label>' +
      '</div>' +
      '<div id="rr-print-help" style="font-size:0.78rem;color:var(--text-dim);line-height:1.45;margin-bottom:0.6rem"></div>' +
      (isPlaces ? '' : '<input id="rr-print-q" type="text" placeholder="' + _shEsc(_shW('printSearch')) + '" style="width:100%;box-sizing:border-box;' + inp + '">') +
      '<div style="display:flex;gap:0.4rem;align-items:center;margin:0.5rem 0">' +
        '<button id="rr-print-all" class="pref-btn" style="font-size:0.78rem">' + _shEsc(_shW('printTickAll')) + '</button>' +
        '<button id="rr-print-none" class="pref-btn" style="font-size:0.78rem">' + _shEsc(_shW('printClear')) + '</button>' +
        '<span id="rr-print-count" style="font-size:0.82rem;color:var(--text-dim);margin-left:auto"></span>' +
      '</div>' +
      '<div id="rr-print-list"></div>' +
    '</div>' +
    '<div style="padding:0.75rem 1rem;border-top:1px solid var(--border);display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">' +
      '<label id="rr-print-skipwrap" style="font-size:0.8rem;color:var(--text-mid);display:flex;align-items:center;gap:0.35rem">' + _shEsc(_shW('printSkip')) +
        ' <input id="rr-print-skip" type="number" min="0" max="' + (RR_SHELVE.label.cols * RR_SHELVE.label.rows - 1) + '" value="0" style="width:4rem;' + inp + '"></label>' +
      '<button id="rr-print-go" class="pref-btn" style="margin-left:auto;font-weight:700">' + _shEsc(_shW('printGo')) + '</button>' +
    '</div></div>';
  document.body.appendChild(ov);
  if (typeof rrDismissGuard === 'function') { try { rrDismissGuard(ov); } catch (e) {} }
  var list = ov.querySelector('#rr-print-list'), q = ov.querySelector('#rr-print-q'), shown = [];
  var count = function () { ov.querySelector('#rr-print-count').textContent = _shW('printCount', { n: Object.keys(ticked).filter(function (k) { return ticked[k]; }).length }); };
  var draw = function () {
    var qq = q ? String(q.value || '').trim().toLowerCase() : '';
    shown = rows.filter(function (r) { return !qq || r.text.toLowerCase().indexOf(qq) >= 0; }).slice(0, 200);
    list.innerHTML = shown.map(function (r) {
      return '<label style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0.5rem;border:1px solid var(--border);border-radius:8px;margin-bottom:0.3rem;background:var(--surface2);cursor:pointer;font-size:0.86rem">' +
        '<input type="checkbox" data-pr="' + _shEsc(r.id) + '"' + (ticked[r.id] ? ' checked' : '') + ' style="width:1.05rem;height:1.05rem;accent-color:var(--accent)">' + _shEsc(r.text) + '</label>';
    }).join('');
    list.querySelectorAll('[data-pr]').forEach(function (cb) {
      cb.addEventListener('change', function () { ticked[cb.getAttribute('data-pr')] = cb.checked; count(); });
    });
    count();
  };
  if (q) q.addEventListener('input', draw);
  // v0.9.2041: the label size — shows the saved one; a change is saved at once
  var sizeSel = ov.querySelector('#rr-print-size'), cw = ov.querySelector('#rr-print-cw'), ch = ov.querySelector('#rr-print-ch');
  var paintSize = function () {
    var t = rrShelveLabelTpl(), raw = _shSizeRaw() || {};
    if (sizeSel.value !== 'custom') sizeSel.value = t.id;
    ov.querySelector('#rr-print-custom').style.display = sizeSel.value === 'custom' ? 'flex' : 'none';
    if (sizeSel.value === 'custom' && raw.id === 'custom') { cw.value = raw.w; ch.value = raw.h; }
    ov.querySelector('#rr-print-skipwrap').style.display = t.one ? 'none' : 'flex';
    if (!t.one) ov.querySelector('#rr-print-skip').max = String(t.cols * t.rows - 1);
    ov.querySelector('#rr-print-help').textContent = t.one ? _shW('printHelpOne', { w: t.w, h: t.h }) : _shW('printHelp');
  };
  var saveCustom = function () {
    if (rrShelveSetLabelSize('custom', cw.value, ch.value)) { paintSize(); return true; }
    var L = RR_SHELVE.customLimits;
    ov.querySelector('#rr-print-help').textContent = _shW('labelCustomBad', { minW: L.minW, maxW: L.maxW, minH: L.minH, maxH: L.maxH });
    return false;
  };
  sizeSel.addEventListener('change', function () {
    if (sizeSel.value === 'custom') { ov.querySelector('#rr-print-custom').style.display = 'flex'; if (cw.value && ch.value) saveCustom(); return; }
    rrShelveSetLabelSize(sizeSel.value); paintSize();
  });
  cw.addEventListener('change', saveCustom); ch.addEventListener('change', saveCustom);
  paintSize();
  ov.querySelector('#rr-print-all').addEventListener('click', function () { shown.forEach(function (r) { ticked[r.id] = true; }); draw(); });
  ov.querySelector('#rr-print-none').addEventListener('click', function () { ticked = {}; draw(); });
  ov.querySelector('#rr-print-x').addEventListener('click', function () { ov.remove(); });
  var busy = false;
  ov.querySelector('#rr-print-go').addEventListener('click', async function () {
    if (busy) return;
    var pick = rows.filter(function (r) { return ticked[r.id]; });
    if (!pick.length) { if (typeof showToast === 'function') showToast(_shW('printNone'), 3000, true); return; }
    if (sizeSel.value === 'custom' && !saveCustom()) return;   // a custom size outside the limits makes no file
    var entries = isPlaces ? rrShelveLabelEntries('places', pick.map(function (r) { return r.place; }))
                           : rrShelveLabelEntries('items', pick.map(function (r) { return r.key; }));
    busy = true;
    try {
      var made = await rrShelveLabelsPdf(entries, ov.querySelector('#rr-print-skip').value);
      made.doc.save(RR_SHELVE.pdfName);
      if (typeof showToast === 'function') showToast(_shW('printMade', { n: entries.length }), 4000);
    } catch (e) {
      console.warn('[labels]', e);
      if (typeof showToast === 'function') showToast(_shW('printFailed'), 5000, true);
    }
    busy = false;
  });
  draw();
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
    rrStickerAppCodeItem: rrStickerAppCodeItem, rrStickerAppCodePlace: rrStickerAppCodePlace, rrStickerParseApp: rrStickerParseApp,
    rrShelveLabelSlots: rrShelveLabelSlots, rrShelveLabelEntries: rrShelveLabelEntries, rrShelveLabelsPdf: rrShelveLabelsPdf,
    rrShelvePrintOpen: rrShelvePrintOpen,
    rrShelveLabelTpl: rrShelveLabelTpl, rrShelveSetLabelSize: rrShelveSetLabelSize,                 // v0.9.2041
    rrShelveItemsAt: rrShelveItemsAt, rrShelveWhatsHere: rrShelveWhatsHere,
    rrShelveCheckSort: rrShelveCheckSort, rrShelveCheckResult: rrShelveCheckResult,
    rrMoveLogRow: rrMoveLogRow, rrMoveLogAdd: rrMoveLogAdd, rrMoveLogFor: rrMoveLogFor, rrShelveHistory: rrShelveHistory,
  });
}
