#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// SCAN TO SHELVE — v0.9.2020                                 (real Chromium)
//
// [stated] Brad, 2026-10-23: a customer "has qr codes that he has on his
// shelves … he wants to scan the item and then scan the shelve and it updates
// its location"; pre-printed random QR stickers ("scan this on the item, scan
// another on the shelf, enter the item info and it all be updated"); phone
// camera only; listed in Preferences under the location manager; "set this up
// for support@ and also my account bhale@" → "yes".
// The camera only hands a code to rrShelveCode — the same door as the typed
// box — so the tests drive that door; the sheet is a stand-in that records
// every write (rrRowStillIs / sheetsUpdate), the real guarded writer runs.
//
//   C1  Sticker Code is a new column at the END; every older column keeps its place
//   O1  owners (bhale@, support@) get it; anyone else does not; recording mode hides it
//   O2  Location tracking off → a plain message, no camera screen
//   P1  a new sticker → "item" → search → pick → written to THAT row's Sticker Code
//   P2  a new sticker → "shelf" → pick Garage › Shelf 4 → kept with the account
//   S1  item, then shelf → Location + Location Detail written for that row; both clear
//   S2  "Keep this shelf": shelf once, then two items → both saved there
//   S3  Undo puts the last one back where it was
//   S4  a sticker already on another item → asks; Cancel changes nothing; OK moves it
//   S5  the camera holding one sticker in view is ONE scan
//   A1  "Add a new item" → the normal Add steps → the sticker goes on what was saved
//   I1  the item page says "Sticker: Paired" with Remove; Remove clears the cell
//   L1  Storage Locations: Scan to Shelve at the top, Pair per place and spot,
//       "Sticker paired ×" on a paired one; removing a place forgets its sticker
//   X*  PLANTED: no location write (S1), no owner gate (O1), no one-sticker rule (S4)
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  scan_shelve_2020_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const rd = f => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 700))); cond ? pass++ : fail++; }
function planted(src, from, to, what) {
  if (src.indexOf(from) < 0) throw new Error('planted ' + what + ': the line moved; update this test');
  return src.replace(from, to);
}

async function boot(browser, email, files, recording) {
  const pg = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.errs = errs;
  await pg.route('**', r => { const u = r.request().url(), base = u.split('?')[0];
    for (const f of Object.keys(files || {})) if (base.endsWith('/app/' + f)) return r.fulfill({ body: files[f], contentType: 'application/javascript' });
    return u.startsWith('file://') ? r.continue() : r.abort(); });
  if (recording) await pg.addInitScript(() => { try { localStorage.setItem('rr_recording_mode', '1'); } catch (e) {} });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1000);
  await pg.evaluate(email => {
    state.user = { email: email, name: 'Brad' };
    state.personalSheetId = 'sheet1';
    state.masterData = [{ itemNum: '6464-1', roadName: 'Western Pacific', itemType: 'Boxcar', variation: '' },
                        { itemNum: '2343', roadName: 'Santa Fe', itemType: 'Diesel', variation: '' }];
    try { _rebuildMasterIndex(); } catch (e) {}
    const mk = (inv, num, row, extra) => Object.assign({ inventoryId: inv, itemNum: num, variation: '', owned: true, condition: 8, row: row, location: '', locationDetail: '', stickerCode: '' }, extra || {});
    state.personalData = { '101': mk('101', '6464-1', 3), '102': mk('102', '2343', 4), '103': mk('103', '2343', 5, { location: 'Basement', locationDetail: 'Tote 2' }) };
    ['auth-screen', 'beta-gate'].forEach(id => { const e = document.getElementById(id); if (e) e.style.display = 'none'; });
    document.getElementById('app').classList.add('active');
    _prefSet('lv_location_enabled', 'true');
    rrSaveLocations([{ name: 'Garage', type: 'Room', details: ['Shelf 4', 'Shelf 5'] }, { name: 'Basement', type: 'Room', details: ['Tote 2'] }]);
    window.__w = []; window.__toasts = []; window.__confirm = true; window.__asked = [];
    window.rrRowStillIs = async function () { return true; };
    window.sheetsUpdate = async function (id, range, values) { window.__w.push({ range: range, v: values[0][0] }); return {}; };
    window._cachePersonalData = function () {};
    window.appConfirm = async function (m) { window.__asked.push(String(m)); return window.__confirm; };
    const _t = window.showToast; window.showToast = function (m) { window.__toasts.push(String(m)); try { _t.apply(this, arguments); } catch (e) {} };
    window.__col = f => personalColLetter(f);
    window.__click = async sel => { const b = document.querySelector(sel); if (!b) throw new Error('no ' + sel); b.click(); await new Promise(z => setTimeout(z, 150)); };
  }, email);
  return pg;
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});

  // ── C1 — the column ──
  {
    const APPJS = rd('app.js');
    const list = [...APPJS.matchAll(/\{ field: '(\w+)',\s+header: '([^']+)' \}/g)].map(m => m[1]);
    T('C1 Sticker Code is the LAST column; Master Row ID stays right before it', list[list.length - 1] === 'stickerCode' && list[list.length - 2] === 'masterRowId', list.slice(-3));
  }

  let pg = await boot(browser, 'bhale@ipd-llc.com');
  console.log('== O · who gets it ==');
  const o1 = await pg.evaluate(async () => {
    _openLocationsModal(); await new Promise(z => setTimeout(z, 200));
    const top = !!document.getElementById('rr-shelve-top');
    const pairs = document.querySelectorAll('#loc-list [data-sh-pairplace]').length;
    document.getElementById('loc-setup-modal').remove();
    return { on: rrShelveOn(), top, pairs };
  });
  T('O1 bhale@ (owner): on, Scan to Shelve at the top of Storage Locations', o1.on && o1.top, o1);
  T('L1 Storage Locations: a Pair button per place (no spots shown until opened)', o1.pairs === 2, o1);
  const o2 = await pg.evaluate(async () => {
    _prefSet('lv_location_enabled', 'false'); window.__toasts = [];
    rrShelveOpen(); const opened = !!document.getElementById('rr-shelve');
    _prefSet('lv_location_enabled', 'true');
    return { opened, toasts: window.__toasts };
  });
  T('O2 Location tracking off → a plain message, no camera screen', !o2.opened && o2.toasts.some(t => /Track Storage Location/.test(t)), o2);

  console.log('== P · a new sticker ==');
  const p1 = await pg.evaluate(async () => {
    rrShelveOpen(); await new Promise(z => setTimeout(z, 200));
    const screen = !!document.getElementById('rr-shelve');
    const nocam = (document.getElementById('rr-shelve-nocam') || {}).textContent || '';
    const pr = rrShelveCode('PACK-0001'); await new Promise(z => setTimeout(z, 200));
    const ask = (document.getElementById('rr-shelve-ask') || {}).textContent || '';
    await __click('#rr-shelve-ask [data-sh="item"]');
    const q = document.getElementById('rr-shelve-q'); q.value = '6464'; q.dispatchEvent(new Event('input'));
    await new Promise(z => setTimeout(z, 100));
    const hits = document.querySelectorAll('#rr-shelve-hits [data-sh-key]').length;
    await __click('#rr-shelve-hits [data-sh-key="101"]');
    await pr;
    return { screen, nocam, ask, hits, sticker: state.personalData['101'].stickerCode, writes: __w.slice(), col: __col('stickerCode'),
             itemSlot: document.getElementById('rr-shelve-item').textContent, status: document.getElementById('rr-shelve-status').textContent };
  });
  T('P1 the camera screen opens (on a computer it says to use the phone, and offers the code box)', p1.screen && /phone/.test(p1.nocam), p1.nocam);
  T('P1 a new sticker asks "What is this sticker on?" with item / shelf / add new', /What is this sticker on/.test(p1.ask) && /An item in my collection/.test(p1.ask) && /A shelf or place/.test(p1.ask) && /Add a new item/.test(p1.ask), p1.ask);
  T('P1 search "6464" finds the one item; picking it writes THAT row\'s Sticker Code', p1.hits === 1 && p1.sticker === 'PACK-0001' && p1.writes.some(w => w.range === 'My Collection!' + p1.col + '3' && w.v === "'PACK-0001"), p1);
  T('P1 …and it is now the item waiting for its shelf', /6464-1/.test(p1.itemSlot) && /shelf/i.test(p1.status), p1);

  const p2 = await pg.evaluate(async () => {
    __w.length = 0;
    const pr = rrShelveCode('PACK-0002'); await new Promise(z => setTimeout(z, 150));
    await __click('#rr-shelve-ask [data-sh="place"]');
    const opts = [...document.querySelectorAll('#rr-shelve-ask [data-sh-pl]')].map(b => b.textContent);
    const target = [...document.querySelectorAll('#rr-shelve-ask [data-sh-pl]')].find(b => /Garage › Shelf 4/.test(b.textContent));
    target.click();
    await pr; await new Promise(z => setTimeout(z, 150));
    return { opts, places: rrStickerPlaces(), writes: __w.slice(), loc: state.personalData['101'].location, det: state.personalData['101'].locationDetail,
             cols: { loc: __col('location'), det: __col('locationDetail') }, status: document.getElementById('rr-shelve-status').textContent,
             item: document.getElementById('rr-shelve-item').textContent, place: document.getElementById('rr-shelve-place').textContent };
  });
  T('P2 the place list offers every saved place and spot', p2.opts.join('|') === 'Garage|Garage › Shelf 4|Garage › Shelf 5|Basement|Basement › Tote 2', p2.opts);
  T('P2 the shelf sticker is kept with the account', p2.places['PACK-0002'] && p2.places['PACK-0002'].loc === 'Garage' && p2.places['PACK-0002'].spot === 'Shelf 4', p2.places);
  console.log('== S · scanning ==');
  T('S1 item then shelf → Location + Location Detail written on THAT row', p2.loc === 'Garage' && p2.det === 'Shelf 4'
    && p2.writes.some(w => w.range === 'My Collection!' + p2.cols.loc + '3' && w.v === 'Garage') && p2.writes.some(w => w.range === 'My Collection!' + p2.cols.det + '3' && w.v === 'Shelf 4'), p2);
  T('S1 …says so, and both slots clear (Keep this shelf is off)', /6464-1.*→ Garage › Shelf 4/.test(p2.status) && p2.item === '—' && p2.place === '—', p2);

  const s2 = await pg.evaluate(async () => {
    await rrStickerSetItem('102', 'PACK-0003'); await rrStickerSetItem('103', 'PACK-0004');
    __w.length = 0;
    document.getElementById('rr-shelve-keep').checked = true;
    await rrShelveCode('PACK-0002'); await rrShelveCode('PACK-0003'); await rrShelveCode('PACK-0004');
    return { a: state.personalData['102'].location + '/' + state.personalData['102'].locationDetail, b: state.personalData['103'].location + '/' + state.personalData['103'].locationDetail,
             place: document.getElementById('rr-shelve-place').textContent };
  });
  T('S2 Keep this shelf: shelf once, then two items → both on Garage › Shelf 4; the shelf stays', s2.a === 'Garage/Shelf 4' && s2.b === 'Garage/Shelf 4' && /Shelf 4/.test(s2.place), s2);
  const s3 = await pg.evaluate(async () => {
    await __click('#rr-shelve-undo');
    await new Promise(z => setTimeout(z, 200));
    return state.personalData['103'].location + '/' + state.personalData['103'].locationDetail;
  });
  T('S3 Undo puts the last one back where it was (Basement / Tote 2)', s3 === 'Basement/Tote 2', s3);
  const s4 = await pg.evaluate(async () => {
    __asked.length = 0; window.__confirm = false;
    const no = await rrStickerSetItem('102', 'PACK-0001');
    const afterNo = { a: state.personalData['101'].stickerCode, b: state.personalData['102'].stickerCode, asked: __asked.slice() };
    window.__confirm = true;
    const yes = await rrStickerSetItem('102', 'PACK-0001');
    return { no, afterNo, yes, a: state.personalData['101'].stickerCode, b: state.personalData['102'].stickerCode };
  });
  T('S4 a sticker already on another item → asks first; Cancel changes nothing', s4.no === false && s4.afterNo.a === 'PACK-0001' && s4.afterNo.b === 'PACK-0003' && /already on 6464-1/.test(s4.afterNo.asked[0] || ''), s4.afterNo);
  T('S4 …OK moves it (off 6464-1, onto 2343)', s4.yes === true && s4.a === '' && s4.b === 'PACK-0001', s4);
  const s5 = await pg.evaluate(async () => {
    document.getElementById('rr-shelve-keep').checked = false;
    await rrStickerSetItem('101', 'PACK-0077');
    const r1 = await rrShelveCode('PACK-0077', { fromCamera: true });
    const r2 = await rrShelveCode('PACK-0077', { fromCamera: true });
    return { r1, r2, item: document.getElementById('rr-shelve-item').textContent };
  });
  T('S5 the same sticker held in view: one scan, the repeat is ignored', s5.r1 === true && s5.r2 === false, s5);

  console.log('== A · add a new item ==');
  const a1 = await pg.evaluate(async () => {
    rrShelveClose(); rrShelveOpen(); await new Promise(z => setTimeout(z, 150));
    // the Add steps, standing in: the wizard opens, saves a new copy, closes
    window.startWizardFor = function () {
      const m = document.getElementById('wizard-modal') || (function () { const d = document.createElement('div'); d.id = 'wizard-modal'; document.body.appendChild(d); return d; })();
      m.classList.add('open');
      setTimeout(function () { state.personalData['104'] = { inventoryId: '104', itemNum: '6464-1', variation: '', owned: true, row: 6, location: '', locationDetail: '', stickerCode: '' }; m.classList.remove('open'); }, 300);
    };
    const pr = rrShelveCode('PACK-0009'); await new Promise(z => setTimeout(z, 150));
    const hidden = document.getElementById('rr-shelve').style.display === 'none';
    await __click('#rr-shelve-ask [data-sh="add"]');
    const hiddenDuring = document.getElementById('rr-shelve').style.display === 'none';
    await pr;
    return { hiddenDuring, back: document.getElementById('rr-shelve').style.display !== 'none', sticker: state.personalData['104'].stickerCode,
             item: document.getElementById('rr-shelve-item').textContent };
  });
  T('A1 the camera screen steps aside for the Add steps and comes back', a1.hiddenDuring && a1.back, a1);
  T('A1 the sticker goes on the item just saved, which is now waiting for its shelf', a1.sticker === 'PACK-0009' && /6464-1/.test(a1.item), a1);

  console.log('== I · the item page ==');
  const i1 = await pg.evaluate(async () => {
    rrShelveClose();
    showItemDetailPage(0, '104'); await new Promise(z => setTimeout(z, 500));
    const line = (document.getElementById('rr-shelve-itemline') || {}).textContent || '';
    __w.length = 0;
    const rm = [...document.querySelectorAll('#rr-shelve-itemline button')].find(b => /Remove sticker/.test(b.textContent));
    if (rm) rm.click();
    await new Promise(z => setTimeout(z, 600));
    const line2 = (document.getElementById('rr-shelve-itemline') || {}).textContent || '';
    return { line, line2, sticker: state.personalData['104'].stickerCode, writes: __w.slice(), col: __col('stickerCode') };
  });
  T('I1 the item page says "Sticker: Paired" with Replace and Remove', /Sticker:\s*Paired/.test(i1.line) && /Replace/.test(i1.line) && /Remove sticker/.test(i1.line), i1.line);
  T('I1 Remove clears that row\'s Sticker Code; the line then offers Pair a sticker', i1.sticker === '' && i1.writes.some(w => w.range === 'My Collection!' + i1.col + '6' && w.v === '') && /No sticker/.test(i1.line2) && /Pair a sticker/.test(i1.line2), i1);

  const l1 = await pg.evaluate(async () => {
    _openLocationsModal({ spots: true }); await new Promise(z => setTimeout(z, 200));
    const paired = [...document.querySelectorAll('#loc-list [data-sh-unpair]')].map(b => b.getAttribute('data-sh-loc') + '|' + b.getAttribute('data-sh-spot'));
    const pairBtns = document.querySelectorAll('#loc-list [data-sh-pairplace]').length;
    // remove the Garage place → its sticker is forgotten
    const del = document.querySelector('#loc-list [data-loc-del="0"]'); del.click(); await new Promise(z => setTimeout(z, 150));
    const after = rrStickerPlaces();
    document.getElementById('loc-setup-modal').remove();
    return { paired, pairBtns, after };
  });
  T('L1 a paired spot shows "Sticker paired ×"; the others offer Pair', l1.paired.join(',') === 'Garage|Shelf 4' && l1.pairBtns === 4, l1);
  T('L1 removing a place forgets its sticker', !l1.after['PACK-0002'], l1.after);
  T('page errors', pg.errs.length === 0, pg.errs);
  await pg.close();

  // ── O1 — the others ──
  pg = await boot(browser, 'support@therailroster.com');
  T('O1 support@ (owner): on', await pg.evaluate(() => rrShelveOn()));
  await pg.close();
  pg = await boot(browser, 'friend.collector@gmail.com');
  const fr = await pg.evaluate(async () => { _openLocationsModal(); await new Promise(z => setTimeout(z, 200)); return { on: rrShelveOn(), top: !!document.getElementById('rr-shelve-top'), pairs: document.querySelectorAll('[data-sh-pairplace]').length }; });
  T('O1 anyone else: off — no button, no Pair buttons', !fr.on && !fr.top && fr.pairs === 0, fr);
  await pg.close();
  pg = await boot(browser, 'bhale@ipd-llc.com', null, true);
  T('O1 recording mode hides it, like the other owner tools', !(await pg.evaluate(() => rrShelveOn())));
  await pg.close();

  console.log('== X · planted ==');
  const SH = rd('scan-shelve.js');
  pg = await boot(browser, 'bhale@ipd-llc.com', { 'scan-shelve.js': planted(SH, '  var ok = await rrShelveSaveLocation(key, place);', '  var ok = true;', 'save') });
  const x1 = await pg.evaluate(async () => { rrShelveOpen(); await rrStickerSetItem('101', 'A'); await rrStickerSetPlace('B', { loc: 'Garage', spot: 'Shelf 4' }); await rrShelveCode('A'); await rrShelveCode('B'); return state.personalData['101'].location; });
  T('X-S1 PLANTED: the location write skipped → the item has no location (caught)', x1 !== 'Garage', x1);
  await pg.close();
  pg = await boot(browser, 'friend.collector@gmail.com', { 'scan-shelve.js': planted(SH, "  try { return typeof rrFeatureOn === 'function' && rrFeatureOn(RR_SHELVE.feature); } catch (e) { return false; }", '  return true;', 'gate') });
  T('X-O1 PLANTED: no owner gate → a stranger gets it (caught)', await pg.evaluate(() => rrShelveOn()));
  await pg.close();
  pg = await boot(browser, 'bhale@ipd-llc.com', { 'scan-shelve.js': planted(SH, "  if (f && f.kind === 'item') {\n    if (!(await appConfirm(_shW('usedOnItem'", "  if (false) {\n    if (!(await appConfirm(_shW('usedOnItem'", 'one sticker') });
  const x4 = await pg.evaluate(async () => { await rrStickerSetItem('101', 'A'); window.__confirm = false; __asked.length = 0; await rrStickerSetItem('102', 'A'); return { asked: __asked.length, a: state.personalData['101'].stickerCode, b: state.personalData['102'].stickerCode }; });
  T('X-S4 PLANTED: no one-sticker rule → two items share a sticker, nobody asked (caught)', x4.asked === 0 && x4.a === 'A' && x4.b === 'A', x4);
  await pg.close();

  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
