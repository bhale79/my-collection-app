#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// box_photo_group_tests.js — 2026-11-02 (maintenance chat; real Chromium, the
// REAL app, a stand-in Google Drive)
//
// [stated] Brad: "the box in the group set doesn't show the picture of the box,
// its under the engine item. when you click box, it says no photo for that item
// yet" → "yes". Cause: a Box piece keeps its pictures' folder in its BOX PHOTO
// cell (wizard-save.js), and the box shots taken during an Add sit in the
// ENGINE's folder, named BOX; the group page only read Item Photo.
//
//   A  THE ONE ANSWER: rrPhotoLinkOf (drive.js) — Item Photo, else a box
//      piece's Box Photo (never an engine's Box Photo); rrPhotoFolderFor asks it.
//      rrPiecePhotos (app-collection.js): a box shows its BOX shots.
//   B  the engine's page, computer: tapping the Box card puts a BOX shot on top
//      (it said "No photos for that unit yet"); the Photos card has a Box
//      section with ONLY the box shots — no dragging and no "Make this the main
//      picture" there (it would re-order the ENGINE's folder); the engine's
//      section is unchanged; the Box card wears 📷.
//   C  a phone: tapping Box jumps to the Box section (no "No photos").
//   D  the list photo of the box row is a box shot, of the engine row its own
//      picture. (A box has no page of its own — it is reached from its group.)
//   E  a box with a folder of its own works; a box with no pictures still says so.
//   P  planted: the old Item-Photo-only reader (served drive.js) → B1 red; a
//      piece filter that hands the box the whole folder → B3 red.
//
// Run:  node tests/box_photo_group_tests.js
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  box_photo_group_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 900))); cond ? pass++ : fail++; }

const L = id => 'https://drive.google.com/drive/folders/' + id;
const MASTER = [
  { itemNum: '6-18555', variation: '', itemType: 'Diesel Locomotive', description: 'SD40-2 Diesel', roadName: 'CSX', yearProd: '2018', _era: 'mpc', _tab: 'Lionel MPC-Modern' },
  { itemNum: '6-29000', variation: '', itemType: 'Boxcar', description: 'Boxcar', roadName: 'Erie', yearProd: '2001', _era: 'mpc', _tab: 'Lionel MPC-Modern' },
  { itemNum: '6-17000', variation: '', itemType: 'Caboose', description: 'Caboose', roadName: 'Erie', yearProd: '2001', _era: 'mpc', _tab: 'Lionel MPC-Modern' },
];
const P = (n, inv, row, x) => Object.assign({ itemNum: n, variation: '', owned: true, inventoryId: inv, row, manufacturer: 'Lionel', condition: '8' }, x || {});
const PD = {
  // Brad's shape: the engine and its box saved together — the box shots are in the ENGINE's folder
  '401': P('6-18555', '401', 3, { photoItem: L('F401'), photoBox: L('F401'), hasBox: 'Yes', groupId: 'G1' }),
  '402': P('6-18555-BOX', '402', 4, { photoItem: '', photoBox: L('F401'), groupId: 'G1', matchedTo: '6-18555' }),
  // a box saved on its own ("Box Only"): its own folder
  '403': P('6-29000', '403', 5, { photoItem: L('F403'), groupId: 'G2' }),
  '404': P('6-29000-BOX', '404', 6, { photoItem: '', photoBox: L('F404'), groupId: 'G2' }),
  // a box with no pictures at all
  '405': P('6-17000', '405', 7, { photoItem: L('F405'), groupId: 'G3' }),
  '406': P('6-17000-BOX', '406', 8, { photoItem: '', photoBox: '', groupId: 'G3' }),
};
const FOLDERS = {
  F401: [{ id: 'eng-rsv', name: '6-18555 RSV.jpg' }, { id: 'eng-lsv', name: '6-18555 LSV.jpg' }, { id: 'box-fv', name: '6-18555 BOX-FV.jpg' }, { id: 'box-tv', name: '6-18555 BOX-TV.jpg' }],
  F403: [{ id: 'car-rsv', name: '6-29000 RSV.jpg' }],
  F404: [{ id: 'own-box', name: '6-29000-BOX BOX-FV.jpg' }],
  F405: [{ id: 'cab-rsv', name: '6-17000 RSV.jpg' }],
};
const PIC = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function open(browser, size, swap) {
  const ctx = await browser.newContext(size === 'phone'
    ? { viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', hasTouch: true, isMobile: true, deviceScaleFactor: 2 }
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
    window.__folders = folders; window.__patches = [];
    const fid = link => (String(link || '').match(/folders\/([A-Za-z0-9_-]+)/) || [])[1] || '';
    window.driveGetFolderPhotos = async link => (window.__folders[fid(link)] || []).map(f => ({ id: f.id, name: f.name, thumbnailLink: '' }))
      .sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    window.driveRequest = async (m, u, b) => { window.__patches.push(m + ' ' + u + ' ' + JSON.stringify(b)); return {}; };
    window.driveFindItemFolder = async () => '';
    window.loadDriveThumb = function (id, img) { if (img) img.src = pic; return true; };
    document.getElementById('auth-screen').style.display = 'none'; document.getElementById('app').classList.add('active');
    window.__open = async (inv) => {
      const p = state.personalData[inv];
      const base = p.itemNum.replace(/-(M)?BOX$/i, '');
      const idx = state.masterData.findIndex(m => m.itemNum === base);
      showItemDetailPage(idx, inv);
      await new Promise(r => setTimeout(r, 700));
    };
    window.__cardIdx = role => {
      const cards = [...document.querySelectorAll('div[onclick^="if(typeof _grpHeroSwap"]')];
      return cards.findIndex(c => new RegExp('^' + role + '(?![a-z])', 'i').test(c.textContent.trim()));
    };
    window.__sections = () => [...document.querySelectorAll('[id^="grp-photos-"]')].filter(e => e.id !== 'grp-photos-set').map(e => {
      const head = e.previousElementSibling ? e.previousElementSibling.textContent.replace(/\s+/g, ' ').trim() : '';
      const tiles = [...e.querySelectorAll('div[title]')].filter(t => t.querySelector('img'));
      const hero = e.querySelector('img[data-rrfid]');
      return { head, ids: tiles.map(t => t.title.replace(/ —.*$/, '')), one: tiles.length ? null : (hero && hero.getAttribute('data-rrfid')),
        mainBtn: !!e.querySelector('.rr-main-photo-btn'), drag: tiles.some(t => t.draggable) };
    });
  }, { master: MASTER, pd: PD, folders: FOLDERS, pic: PIC });
  return { pg, ctx, errs };
}

const engineComputer = pg => pg.evaluate(async () => {
  const S = ms => new Promise(r => setTimeout(r, ms));
  await window.__open('401');
  const out = {};
  out.boxCard = (() => { const i = window.__cardIdx('Box'); const c = [...document.querySelectorAll('div[onclick^="if(typeof _grpHeroSwap"]')][i]; return c ? c.textContent.replace(/\s+/g, ' ') : null; })();
  out.sideBefore = (document.querySelector('#grp-side-photo img[data-rrfid]') || {}).getAttribute ? document.querySelector('#grp-side-photo img[data-rrfid]').getAttribute('data-rrfid') : null;
  window.__toasts.length = 0;
  await _grpHeroSwap(window.__cardIdx('Box')); await S(250);
  out.side = (document.querySelector('#grp-side-photo img[data-rrfid]') || { getAttribute: () => null }).getAttribute('data-rrfid');
  out.toasts = window.__toasts.slice();
  await _grpHeroSwap(window.__cardIdx('Engine')); await S(250);
  out.sideEngine = (document.querySelector('#grp-side-photo img[data-rrfid]') || { getAttribute: () => null }).getAttribute('data-rrfid');
  out.sections = window.__sections();
  return out;
});

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  try {
    const { pg, ctx, errs } = await open(browser, 'computer');

    console.log('\n== A · the one answer ==');
    const a = await pg.evaluate(async () => ({
      eng: rrPhotoLinkOf(state.personalData['401']), box: rrPhotoLinkOf(state.personalData['402']),
      engOnlyBoxCell: rrPhotoLinkOf({ itemNum: '6-18555', photoItem: '', photoBox: 'X' }),
      none: rrPhotoLinkOf(state.personalData['406']),
      folderFor: await rrPhotoFolderFor(state.personalData['402']),
      pieceBox: rrPiecePhotos(state.personalData['402'], await driveGetFolderPhotos(state.personalData['401'].photoItem)).map(f => f.id),
      pieceEng: rrPiecePhotos(state.personalData['401'], await driveGetFolderPhotos(state.personalData['401'].photoItem)).length,
    }));
    T('A1 a box piece\'s pictures are found through its Box Photo cell; an engine\'s Box Photo is never taken for its own pictures', /F401$/.test(a.box) && /F401$/.test(a.eng) && a.engOnlyBoxCell === '' && a.none === '' && /F401$/.test(a.folderFor), a);
    T('A2 from the engine\'s folder a box takes ONLY its BOX shots; the engine keeps every picture', JSON.stringify(a.pieceBox.sort()) === '["box-fv","box-tv"]' && a.pieceEng === 4, a);

    console.log('\n== B · the engine\'s page, computer ==');
    const b = await engineComputer(pg);
    T('B1 tapping the Box card puts a BOX shot on top — no "No photos for that unit yet"', /^box-/.test(b.side || '') && !b.toasts.some(t => /No photos/.test(t)), b);
    T('B2 tapping the Engine card puts the engine back on top (its Right Side)', b.sideEngine === 'eng-rsv', b.sideEngine);
    const boxSec = b.sections.find(s => /^Box(?![a-z])/i.test(s.head)), engSec = b.sections.find(s => /^Engine\b/i.test(s.head));
    T('B3 the Photos card has a Box section with ONLY the box shots', !!boxSec && boxSec.ids.length === 2 && boxSec.ids.every(n => /BOX/.test(n)), b.sections);
    T('B4 …with no dragging and no "Make this the main picture" there (it would re-order the engine\'s folder)', !!boxSec && !boxSec.mainBtn && !boxSec.drag, boxSec);
    T('B5 the engine\'s section is unchanged: all four pictures, the main-picture button, the Right Side first', !!engSec && engSec.ids.length === 4 && engSec.mainBtn && /RSV/.test(engSec.ids[0]), engSec);
    T('B6 the Box card shows 📷 (it has pictures)', /📷/.test(b.boxCard || ''), b.boxCard);

    console.log('\n== D · the list ==');
    const d = await pg.evaluate(async () => ({ listBox: await _thumbFor(state.personalData['402']), listEngine: await _thumbFor(state.personalData['401']) }));
    T('D1 the list photo: the box row shows a box shot, the engine row its own picture (never the box)', /^box-/.test(d.listBox || '') && d.listEngine === 'eng-rsv', d);

    console.log('\n== E · other boxes ==');
    const e = await pg.evaluate(async () => {
      const S = ms => new Promise(r => setTimeout(r, ms));
      const out = {};
      await window.__open('403'); window.__toasts.length = 0;
      await _grpHeroSwap(window.__cardIdx('Box')); await S(200);
      out.own = (document.querySelector('#grp-side-photo img[data-rrfid]') || { getAttribute: () => null }).getAttribute('data-rrfid');
      out.ownSec = window.__sections().find(s => /^Box(?![a-z])/i.test(s.head));
      await window.__open('405'); window.__toasts.length = 0;
      await _grpHeroSwap(window.__cardIdx('Box')); await S(150);
      out.noneToasts = window.__toasts.slice();
      return out;
    });
    T('E1 a box saved on its own (its own folder) shows its picture on top and in its section', e.own === 'own-box' && e.ownSec && e.ownSec.mainBtn === false && e.ownSec.one === 'own-box', e);
    T('E2 a box with no pictures still says "No photos for that unit yet"', e.noneToasts.some(t => /No photos for that unit yet/.test(t)), e.noneToasts);
    T('Z  no page errors (computer)', errs.length === 0, errs);
    await ctx.close();

    console.log('\n== C · a phone ==');
    {
      const w = await open(browser, 'phone');
      const c = await w.pg.evaluate(async () => {
        const S = ms => new Promise(r => setTimeout(r, ms));
        await window.__open('401'); window.__toasts.length = 0;
        await _grpHeroSwap(window.__cardIdx('Box')); await S(300);
        const sec = window.__sections().find(s => /^Box(?![a-z])/i.test(s.head));
        return { toasts: window.__toasts.slice(), sec, sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      });
      T('C1 phone: tapping Box goes to the Box section (only box shots) — no "No photos"', !c.toasts.some(t => /No photos/.test(t)) && c.sec && c.sec.ids.length === 2 && c.sideways <= 1, c);
      T('Z  no page errors (phone)', w.errs.length === 0, w.errs);
      await w.ctx.close();
    }

    console.log('\n== P · planted ==');
    {
      const dr = read('drive.js');
      const old = dr.replace("var link = rrPhotoLinkOf(pd);   // 2026-11-02: a box piece's Box Photo folder counts", 'var link = pd && pd.photoItem;')
        .replace(/function rrPhotoLinkOf\(pd\) \{[\s\S]*?\n\}/, 'function rrPhotoLinkOf(pd) { return pd && pd.photoItem ? String(pd.photoItem) : \'\'; }');
      const w = await open(browser, 'computer', { 'drive.js': old });
      const r = await engineComputer(w.pg);
      T('P1 the old Item-Photo-only reader → "No photos for that unit yet" again (B1 goes red)', old !== dr && r.toasts.some(t => /No photos/.test(t)), r.toasts);
      await w.ctx.close();
    }
    {
      const ac = read('app-collection.js');
      const whole = ac.replace("  var shots = files.filter(function (f) { return /BOX/i.test(String((f && f.name) || '')); });\n  if (shots.length) return shots;", '');
      const w = await open(browser, 'computer', { 'app-collection.js': whole });
      const r = await engineComputer(w.pg);
      const sec = r.sections.find(s => /^Box(?![a-z])/i.test(s.head));
      T('P2 a piece filter that hands the box the whole engine folder → the Box section shows engine pictures (B3 goes red)', whole !== ac && !(sec && sec.ids.length === 2), sec);
      await w.ctx.close();
    }
  } finally { await browser.close(); }
  console.log('\n' + (fail ? 'FAILED  —  ' : 'ALL PASS  —  ') + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  suite crashed: ' + (e && e.stack || e)); console.log('FAILED  —  ' + pass + ' passed, ' + (fail + 1) + ' failed'); process.exit(1); });
