#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// list_photo_tests.js — 2026-11-02 (maintenance chat; real Chromium, the REAL
// app, a stand-in Google Drive that records every rename)
//
// [stated] Brad: "i can't do that on the ipad, i need a button on the strip at
// the bottom that says, make this the main picture" → "yes". Mike Caruso's
// CSX engine showed its BOX FLAP in the Collection list (the flap was filed
// "Right Side", the engine picture second). PLAN_2026-11-01_LIST_PHOTO.md.
//
//   A  THE ONE RULE (rrMainPhotoOf): the gallery's own order — a chosen order
//      ("NN· ") wins, else Right Side View; a BOX shot never leads while an
//      item photo exists (a box-only folder still shows one).
//   B  "Make this the main picture" under the strip — on an iPad, a phone and
//      a computer: the main photo wears ★ and the button says "Main picture";
//      tapping it on another photo renames on Drive so that photo is FIRST
//      (renames only — no delete), the list photo (_thumbFor) becomes it, a
//      double tap renames once.
//   C  The remembered list photo: forgotten at once after the button / a
//      reorder / a delete on this device; a remembered photo older than a day
//      is looked up again (the OTHER devices follow by the next day); a failed
//      look keeps the photo already shown; an emptied folder shows none.
//   P  planted: the list going back to "first file by name" (scan + run), the
//      BOX rule taken out, the forgetting taken out — each turns its check red.
//
// Run:  node tests/list_photo_tests.js
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  list_photo_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
const { fnSrc } = require('./lib/main-photo');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 900))); cond ? pass++ : fail++; }

// ── S · the source: ONE chooser ─────────────────────────────────────────────
function secondChooser(dashSrc) {
  const body = fnSrc(dashSrc, '_thumbFor');
  const out = [];
  if (!/rrMainPhotoOf\(/.test(body)) out.push('_thumbFor does not ask rrMainPhotoOf');
  if (/files\s*&&\s*files\[0\]|files\[0\]\.id|\[0\]\.id/.test(body)) out.push('_thumbFor picks a file by position');
  return out;
}
console.log('\n== S · one chooser ==');
const DASH = read('dashboard.js'), AC = read('app-collection.js');
T('S1 the list photo (dashboard.js _thumbFor) asks THE rule rrMainPhotoOf — never "the first file"', secondChooser(DASH).length === 0, secondChooser(DASH));
const OLD_PICK = 'var fid = files && files[0] && files[0].id;';
const plantedDash = DASH.replace(/  var main = \(typeof rrMainPhotoOf === 'function'\)[^\n]*\n  var fid = main && main\.id;/, '  ' + OLD_PICK);
T('S2 PLANTED: the list back on "first file by name" → caught by S1', plantedDash !== DASH && secondChooser(plantedDash).length > 0, secondChooser(plantedDash));
T('S3 the words live once, in config.js (RR_MAIN_PHOTO)', /const RR_MAIN_PHOTO = \{/.test(read('config.js')) && !/'Make this the main picture'/.test(AC) && !/'Make this the main picture'/.test(DASH));

// ── the world ───────────────────────────────────────────────────────────────
const MASTER = [
  { itemNum: '6-18555', variation: '', itemType: 'Diesel Locomotive', description: 'CSX Non-Powered SD40-2', roadName: 'CSX', yearProd: '2018', _era: 'mpc', _tab: 'Lionel MPC-Modern' },
  { itemNum: '6-29000', variation: '', itemType: 'Boxcar', description: 'Boxcar', roadName: 'Erie', yearProd: '2001', _era: 'mpc', _tab: 'Lionel MPC-Modern' },
];
const PD = {
  '301': { itemNum: '6-18555', variation: '', owned: true, inventoryId: '301', row: 3, manufacturer: 'Lionel', photoItem: 'https://drive.google.com/drive/folders/F301' },
  '302': { itemNum: '6-29000', variation: '', owned: true, inventoryId: '302', row: 4, manufacturer: 'Lionel', photoItem: 'https://drive.google.com/drive/folders/F302' },
};
// Mike's shape: the box flap was filed "Right Side" by the inbox; the engine picture he added himself second
const FOLDERS = {
  F301: [{ id: 'flap', name: '6-18555 RSV.jpg' }, { id: 'engine', name: '6-18555 engine screenshot.png' }, { id: 'boxfv', name: '6-18555 BOX-FV.jpg' }],
  F302: [{ id: 'bx', name: '6-29000 BOX-FV.jpg' }, { id: 'lsv', name: '6-29000 LSV.jpg' }],
};
const PIC = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function open(browser, size, swap) {
  const UA = {
    ipad: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    phone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  };
  const ctx = await browser.newContext(size === 'ipad' ? { viewport: { width: 820, height: 1180 }, userAgent: UA.ipad, hasTouch: true, isMobile: true }
    : size === 'phone' ? { viewport: { width: 390, height: 844 }, userAgent: UA.phone, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }
    : { viewport: { width: 1300, height: 900 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url(), base = u.split('?')[0];
    if (!/^(file|data|blob|about):/.test(u)) return r.abort();
    for (const f of Object.keys(swap || {})) if (base.endsWith('/app/' + f)) return r.fulfill({ body: swap[f], contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(700);
  await pg.evaluate(({ master, pd, folders, pic }) => {
    try { localStorage.clear(); } catch (e) {}
    state.masterData = master.slice(); try { _rebuildMasterIndex(); } catch (e) {}
    state.personalData = JSON.parse(JSON.stringify(pd));
    state.personalSheetId = 'SHEET';
    window.__toasts = []; window.showToast = function (m) { window.__toasts.push(String(m)); };
    window.appConfirm = async function () { return true; };
    // the stand-in Drive: folders of {id, name}; a rename is a PATCH {name}; a delete is PATCH {trashed}
    window.__folders = JSON.parse(JSON.stringify(folders));
    window.__patches = []; window.__lookups = 0; window.__driveDown = false;
    const fid = link => (String(link || '').match(/folders\/([A-Za-z0-9_-]+)/) || [])[1] || '';
    window.driveGetFolderPhotos = async function (link) {
      window.__lookups++;
      if (window.__driveDown) throw new Error('offline');
      return (window.__folders[fid(link)] || []).filter(f => !f.trashed).map(f => ({ id: f.id, name: f.name, thumbnailLink: '' }))
        .sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);   // Drive's orderBy=name
    };
    window.driveRequest = async function (method, url, body) {
      window.__patches.push(method + ' ' + url + ' ' + JSON.stringify(body));
      const id = (String(url).match(/\/files\/([^?/]+)/) || [])[1];
      Object.keys(window.__folders).forEach(k => window.__folders[k].forEach(f => { if (f.id === id) { if (body && body.name) f.name = body.name; if (body && body.trashed) f.trashed = true; } }));
      return {};
    };
    window.rrPhotoFolderFor = async function (p) { return p && p.photoItem; };
    window.loadDriveThumb = function (id, img) { if (img) img.src = pic; return true; };
    window.rrDetailRepaint = function () {};
    document.getElementById('auth-screen').style.display = 'none'; document.getElementById('app').classList.add('active');
    window.__openItem = async (inv) => {
      const p = state.personalData[inv];
      const idx = state.masterData.findIndex(m => m.itemNum === p.itemNum);
      showItemDetailPage(idx, inv);
      for (let i = 0; i < 40 && !document.querySelector('#item-detail-photos img'); i++) await new Promise(r => setTimeout(r, 50));
      await new Promise(r => setTimeout(r, 150));
    };
    window.__gal = () => {
      const g = document.getElementById('item-detail-photos');
      const btn = g && g.querySelector('.rr-main-photo-btn');
      const rail = g ? [...g.querySelectorAll('div[title]')].filter(t => t.querySelector('img')) : [];
      return {
        btn: btn ? { text: btn.textContent.trim(), disabled: btn.disabled, w: Math.round(btn.getBoundingClientRect().width), right: Math.round(btn.getBoundingClientRect().right),
          belowStrip: rail.length ? btn.getBoundingClientRect().top >= rail[rail.length - 1].getBoundingClientRect().bottom - 1 : false } : null,
        star: rail.map(t => !!t.querySelector('.rr-main-star')),
        names: rail.map(t => t.title.replace(/ —.*$/, '')),
        vw: document.documentElement.clientWidth, sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    };
  }, { master: MASTER, pd: PD, folders: FOLDERS, pic: PIC });
  return { pg, ctx, errs };
}

// the walk on one screen size: open Mike's engine, check the strip, choose the engine picture
const walk = (pg) => pg.evaluate(async () => {
  const S = ms => new Promise(r => setTimeout(r, ms));
  const out = {};
  out.listBefore = await _thumbFor(state.personalData['301']);
  await window.__openItem('301');
  out.before = window.__gal();
  // the strip's second picture → the big picture; the button now offers to make it the main picture
  const g = document.getElementById('item-detail-photos');
  const tiles = [...g.querySelectorAll('div[title]')].filter(t => t.querySelector('img'));
  tiles[1].click(); await S(60);
  out.onSecond = window.__gal();
  window.__patches.length = 0;
  const btn = g.querySelector('.rr-main-photo-btn');
  btn.click(); btn.click();                         // a double tap
  await S(400);
  out.patches = window.__patches.slice();
  out.trashed = window.__patches.filter(p => /trashed/.test(p)).length;
  out.toasts = window.__toasts.slice(-1);
  out.names = window.__folders.F301.map(f => f.name);
  await S(200);
  out.after = window.__gal();
  out.listAfter = await _thumbFor(state.personalData['301']);
  return out;
});

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  try {
    const { pg, ctx, errs } = await open(browser, 'ipad');

    console.log('\n== A · the one rule ==');
    const a = await pg.evaluate(() => {
      const ids = list => { const m = rrMainPhotoOf(list.map((n, i) => ({ id: 'p' + i, name: n }))); return m ? m.name : null; };
      return {
        mike: ids(['6-18555 RSV.jpg', '6-18555 engine screenshot.png']),
        noStamps: ids(['2343 BKV.jpg', '2343 LSV.jpg', '2343 RSV.jpg']),
        boxFirst: ids(['6-29000 BOX-FV.jpg', '6-29000 LSV.jpg']),
        boxOnly: ids(['6-29000 BOX-FV.jpg', '6-29000 BOX-TV.jpg']),
        stamped: ids(['01· 6-18555 engine.png', '02· 6-18555 RSV.jpg']),
        stampedBox: ids(['01· 6-29000 BOX-FV.jpg', '02· 6-29000 LSV.jpg']),
        none: rrMainPhotoOf([]),
      };
    });
    T('A1 nobody has chosen: the Right Side View leads (Mike\'s flap was FILED as Right Side — the button fixes it)', a.mike === '6-18555 RSV.jpg' && a.noStamps === '2343 RSV.jpg', a);
    T('A2 a BOX shot never leads while the item has a photo of itself; a box-only folder still shows one', a.boxFirst === '6-29000 LSV.jpg' && a.boxOnly === '6-29000 BOX-FV.jpg', a);
    T('A3 a chosen order wins — even a box the collector put first on purpose; no photos → none', a.stamped === '01· 6-18555 engine.png' && a.stampedBox === '01· 6-29000 BOX-FV.jpg' && a.none === null, a);

    console.log('\n== B · the button, on an iPad ==');
    const b = await walk(pg);
    T('B1 the strip opens on the main picture: ★ on the first photo, the button says "Main picture" and does nothing', b.before.btn && /Main picture$/.test(b.before.btn.text) && b.before.btn.disabled && b.before.star[0] === true && b.before.star.slice(1).every(x => !x), b.before);
    T('B2 the button sits UNDER the strip and fits the screen', b.before.btn && b.before.btn.belowStrip && b.before.btn.right <= b.before.vw && b.before.sideways <= 1, b.before);
    T('B3 on the engine picture it says "Make this the main picture"', b.onSecond.btn && /Make this the main picture$/.test(b.onSecond.btn.text) && !b.onSecond.btn.disabled, b.onSecond);
    T('B4 tapped (twice): renames ONLY — the engine is 01·, the rest keep their order after it; nothing deleted; one set of renames', b.trashed === 0 && b.patches.length === 3 && b.patches.every(p => /^PATCH \/files\//.test(p) && /"name"/.test(p))
      && JSON.stringify(b.names.slice().sort()) === JSON.stringify(['01· 6-18555 engine screenshot.png', '02· 6-18555 RSV.jpg', '03· 6-18555 BOX-FV.jpg'].sort()), b);
    T('B5 it says so in plain words', /Main picture saved/.test(b.toasts[0] || ''), b.toasts);
    T('B6 the Collection list photo is the engine now (it was the flap) — on this device at once', b.listBefore === 'flap' && b.listAfter === 'engine', { before: b.listBefore, after: b.listAfter });

    console.log('\n== C · the remembered list photo ==');
    const c = await pg.evaluate(async () => {
      const out = {};
      const pd = state.personalData['302'];
      out.first = await _thumbFor(pd);                       // LSV, not the box
      const n0 = window.__lookups;
      out.again = await _thumbFor(pd); out.lookupsSame = window.__lookups === n0;
      // a day later (another device chose a new main picture meanwhile)
      window.__folders.F302.find(f => f.id === 'bx').name = '01· 6-29000 BOX-FV.jpg';
      window.__folders.F302.find(f => f.id === 'lsv').name = '02· 6-29000 LSV.jpg';
      out.sameDay = await _thumbFor(pd);
      const seen = JSON.parse(localStorage.getItem('lv_thumb_fids:SHEET:seen') || '{}');
      seen['302'] = Date.now() - (RR_MAIN_PHOTO.recheckMs + 60000);
      localStorage.setItem('lv_thumb_fids:SHEET:seen', JSON.stringify(seen)); window._thumbSeenCache = null;
      out.nextDay = await _thumbFor(pd);
      // a failed look keeps the photo already shown
      seen['302'] = 1; localStorage.setItem('lv_thumb_fids:SHEET:seen', JSON.stringify(seen)); window._thumbSeenCache = null;
      window.__driveDown = true; out.offline = await _thumbFor(pd); window.__driveDown = false;
      // a photo deleted from the page is forgotten at once
      await _deleteCollectionPhoto('bx', '6-29000 BOX-FV.jpg', null);
      out.afterDelete = await _thumbFor(pd);
      // the folder emptied: no photo, nothing remembered
      window.__folders.F302.forEach(f => { f.trashed = true; });
      seen['302'] = 1; localStorage.setItem('lv_thumb_fids:SHEET:seen', JSON.stringify(seen)); window._thumbSeenCache = null;
      out.empty = await _thumbFor(pd);
      out.kept = (JSON.parse(localStorage.getItem('lv_thumb_fids:SHEET') || '{}'))['302'] || null;
      // a reorder by dragging (computer) forgets too
      return out;
    });
    T('C1 the list photo is looked up once and remembered (no second Drive look the same day)', c.first === 'lsv' && c.again === 'lsv' && c.lookupsSame, c);
    T('C2 a main picture changed on ANOTHER device shows here the next day (same day: the remembered one)', c.sameDay === 'lsv' && c.nextDay === 'bx', c);
    T('C3 offline / Drive refused: the photo already shown stays', c.offline === 'bx', c);
    T('C4 a deleted main picture is forgotten at once; an emptied folder shows none and keeps nothing', c.afterDelete === 'lsv' && c.empty === null && c.kept === null, c);
    T('Z  no page errors (iPad)', errs.length === 0, errs);
    await ctx.close();

    console.log('\n== B · a phone and a computer ==');
    for (const size of ['phone', 'computer']) {
      const w = await open(browser, size);
      const r = await walk(w.pg);
      T('B7 ' + size + ': the button under the strip, the engine chosen, the list follows, nothing sideways', r.before.btn && r.before.btn.belowStrip && r.before.sideways <= 1
        && r.trashed === 0 && r.names.includes('01· 6-18555 engine screenshot.png') && r.listAfter === 'engine', r);
      T('Z  no page errors (' + size + ')', w.errs.length === 0, w.errs);
      await w.ctx.close();
    }

    console.log('\n== P · planted ==');
    {
      const noBox = AC.replace("    if (n.includes('BOX')) return 10;\n", '');
      const w = await open(browser, 'ipad', { 'app-collection.js': noBox });
      const r = await w.pg.evaluate(() => rrMainPhotoOf([{ id: 'bx', name: '6-29000 BOX-FV.jpg' }, { id: 'lsv', name: '6-29000 LSV.jpg' }]).id);
      T('P1 the BOX rule taken out → the box flap leads again (A2 goes red)', noBox !== AC && r === 'bx', r);
      await w.ctx.close();
    }
    {
      const noForget = AC.replace("  _rrGalForget(photos);   // 2026-11-02: the list photo follows the new order on this device at once\n", '');
      const w = await open(browser, 'ipad', { 'app-collection.js': noForget });
      const r = await walk(w.pg);
      T('P2 the forgetting taken out → the list keeps showing the flap after the button (B6 goes red)', noForget !== AC && r.listAfter === 'flap', r.listAfter);
      await w.ctx.close();
    }
    {
      const w = await open(browser, 'ipad', { 'dashboard.js': plantedDash });
      const r = await w.pg.evaluate(async () => {
        // Drive answers by NAME: the box shot sorts first in this folder
        return _thumbFor(state.personalData['302']);
      });
      T('P3 the list back on "first file by name" → the box shot stands for the boxcar (S1 + A2 red)', r === 'bx', r);
      await w.ctx.close();
    }
  } finally { await browser.close(); }
  console.log('\n' + (fail ? 'FAILED  —  ' : 'ALL PASS  —  ') + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  suite crashed: ' + (e && e.stack || e)); console.log('FAILED  —  ' + pass + ' passed, ' + (fail + 1) + ' failed'); process.exit(1); });
