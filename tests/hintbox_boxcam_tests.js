#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// hintbox_boxcam_tests.js — 2026-11-08 hintbox, item 7 (real Chromium, the REAL
// app, a stand-in Google Drive)
//
// T-2026-11-02-02 (the testing chat, 2026-11-07, Brad's Work Chrome): "engine
// 84631's Box card shows a 📷 but that box folder is empty, so tapping it
// changes nothing." The 📷 on a group card followed "has a folder LINK"
// (rrPhotoLinkOf). A folder is not a picture. THE ONE owner now:
// rrPieceHasPicture (app-collection.js) —
//   · no folder link → no 📷
//   · before the page has read the folder → 📷 as before (a slow or failed
//     read, or another device, never hides real pictures — hintbox review)
//   · the group page's own read of the piece's folder (the read it already
//     makes for each piece's gallery) → 📷 only when one picture is the
//     piece's own (rrPiecePhotos; the together shots — rrIsSetShot — aside).
//   No Drive call of its own.
//
//   A  computer: the engine card (folder with pictures) wears 📷; the Box card
//      whose own folder is EMPTY does not; a box with a box shot does; a box
//      with no folder does not; a lead whose folder holds only SET shots does not
//   B  phone (390 wide): the same
//   C  before the folder read lands: a piece with a folder link shows 📷 (as
//      before), one with none shows none; when the read lands, a picture keeps
//      it, an empty folder or only together shots take it away; a failed read
//      changes nothing; rrIsSetShot is the one together-shot rule
//   D  no new Drive call: the folder reads per page open are the same as before
//   P  PLANTED: the old folder-link rule (served app-collection.js) → A2/B2 red;
//      the page read not passed to the 📷 → C4 red; a first draw that hides
//      the 📷 until the read → C1 red; a failed read taken as empty → C6 red;
//      a SET rule that misses "SET" → A5 red
//
// Run:  node tests/hintbox_boxcam_tests.js
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  hintbox_boxcam_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 900))); cond ? pass++ : fail++; }

const L = id => 'https://drive.google.com/drive/folders/' + id;
const MASTER = [
  { itemNum: '6-84631', variation: '', itemType: 'Steam Locomotive', description: 'Steam engine', roadName: 'Reading', yearProd: '2019', _era: 'mpc', _tab: 'Lionel MPC-Modern' },
  { itemNum: '6-29000', variation: '', itemType: 'Boxcar', description: 'Boxcar', roadName: 'Erie', yearProd: '2001', _era: 'mpc', _tab: 'Lionel MPC-Modern' },
  { itemNum: '6-17000', variation: '', itemType: 'Caboose', description: 'Caboose', roadName: 'Erie', yearProd: '2001', _era: 'mpc', _tab: 'Lionel MPC-Modern' },
];
const P = (n, inv, row, x) => Object.assign({ itemNum: n, variation: '', owned: true, inventoryId: inv, row, manufacturer: 'Lionel', condition: '8' }, x || {});
const PD = {
  // the 84631 shape: the engine has pictures; its box has a folder of its own, EMPTY
  '501': P('6-84631', '501', 3, { photoItem: L('F501'), hasBox: 'Yes', groupId: 'G1' }),
  '502': P('6-84631-BOX', '502', 4, { photoItem: '', photoBox: L('F502'), groupId: 'G1', matchedTo: '6-84631' }),
  // a box with a box shot in its own folder
  '503': P('6-29000', '503', 5, { photoItem: L('F503'), groupId: 'G2' }),
  '504': P('6-29000-BOX', '504', 6, { photoItem: '', photoBox: L('F504'), groupId: 'G2' }),
  // a lead whose folder holds only the together shot; a box with no folder at all
  '505': P('6-17000', '505', 7, { photoItem: L('F505'), groupId: 'G3' }),
  '506': P('6-17000-BOX', '506', 8, { photoItem: '', photoBox: '', groupId: 'G3' }),
};
const FOLDERS = {
  F501: [{ id: 'eng-rsv', name: '6-84631 RSV.jpg' }, { id: 'eng-lsv', name: '6-84631 LSV.jpg' }],
  F502: [],
  F503: [{ id: 'car-rsv', name: '6-29000 RSV.jpg' }],
  F504: [{ id: 'own-box', name: '6-29000-BOX BOX-FV.jpg' }],
  F505: [{ id: 'cab-set', name: '6-17000 SET.jpg' }],
};
const PIC = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function open(browser, size, swap) {
  const ctx = await browser.newContext(size === 'phone'
    ? { viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36', hasTouch: true, isMobile: true, deviceScaleFactor: 2 }
    : { viewport: { width: 1400, height: 900 } });
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

    window.showToast = function () {};
    window.__folders = folders; window.__reads = []; window.__hold = null; window.__fail = {};
    const fid = link => (String(link || '').match(/folders\/([A-Za-z0-9_-]+)/) || [])[1] || '';
    window.driveGetFolderPhotos = function (link) {
      const id = fid(link);
      window.__reads.push(id);
      const answer = () => window.__fail[id] ? null : (window.__folders[id] || []).map(f => ({ id: f.id, name: f.name, thumbnailLink: '' }));
      if (window.__hold) return new Promise(r => window.__hold.push(() => r(answer())));
      return Promise.resolve(answer());
    };
    window.driveRequest = async () => ({});
    window.driveFindItemFolder = async () => '';
    window.loadDriveThumb = function (id, img) { if (img) img.src = pic; return true; };
    document.getElementById('auth-screen').style.display = 'none'; document.getElementById('app').classList.add('active');
    window.__open = async (inv, wait) => {
      const p = state.personalData[inv];
      const base = p.itemNum.replace(/-(M)?BOX$/i, '');
      const idx = state.masterData.findIndex(m => m.itemNum === base);
      showItemDetailPage(idx, inv);
      await new Promise(r => setTimeout(r, wait === undefined ? 600 : wait));
    };
    // each group card: its role word and whether it wears the 📷
    window.__cards = () => [...document.querySelectorAll('div[onclick^="if(typeof _grpHeroSwap"]')].map(c => ({
      text: c.textContent.replace(/\s+/g, ' ').trim(), cam: /\u{1F4F7}/u.test(c.textContent),
    }));
    window.__cam = role => { const c = window.__cards().find(x => new RegExp('^' + role + '(?![a-z])', 'i').test(x.text)); return c ? c.cam : null; };
  }, { master: MASTER, pd: PD, folders: FOLDERS, pic: PIC });
  return { pg, ctx, errs };
}

const strips = pg => pg.evaluate(async () => {
  const out = {};
  await window.__open('501'); out.g1 = { engine: window.__cam('Engine'), box: window.__cam('Box'), cards: window.__cards() };
  await window.__open('503'); out.g2 = { lead: window.__cards()[0] && window.__cards()[0].cam, box: window.__cam('Box'), cards: window.__cards() };
  await window.__open('505'); out.g3 = { lead: window.__cards()[0] && window.__cards()[0].cam, box: window.__cam('Box'), cards: window.__cards() };
  return out;
});

// C: hold the folder reads, look at the strip, then let them land
const early = (pg, inv, failIds) => pg.evaluate(async ({ inv, failIds }) => {
  window.__fail = {}; (failIds || []).forEach(id => { window.__fail[id] = true; });
  window.__hold = [];
  await window.__open(inv, 150);
  const look = () => ({ lead: window.__cards()[0] ? window.__cards()[0].cam : null, box: window.__cam('Box') });
  const before = look();
  const held = window.__hold; window.__hold = null;
  held.forEach(f => f());
  await new Promise(r => setTimeout(r, 300));
  const after = look();
  window.__fail = {};
  return { before, after };
}, { inv, failIds });

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  try {
    console.log('\n== A · computer ==');
    const { pg, ctx, errs } = await open(browser, 'computer');
    const a = await strips(pg);
    T('A1 the engine card (its folder holds pictures) wears 📷', a.g1.engine === true, a.g1);
    T('A2 the Box card whose own folder is EMPTY wears no 📷 (84631)', a.g1.box === false, a.g1);
    T('A3 a box with a box shot in its folder wears 📷', a.g2.box === true && a.g2.lead === true, a.g2);
    T('A4 a box with no folder at all wears no 📷', a.g3.box === false, a.g3);
    T('A5 a lead whose folder holds only the together (SET) shot wears no 📷 — that shot has the Group Photos section', a.g3.lead === false, a.g3);
    const one = await pg.evaluate(() => ({
      noLink: rrPieceHasPicture(state.personalData['506'], [{ id: 'x', name: 'x.jpg' }]),
      empty: rrPieceHasPicture(state.personalData['502'], []),
      shot: rrPieceHasPicture(state.personalData['504'], [{ id: 'b', name: '6-29000-BOX BOX-FV.jpg' }]),
      engFolderNoBoxShot: rrPieceHasPicture({ itemNum: '6-84631-BOX', photoItem: '', photoBox: 'https://drive.google.com/drive/folders/F501' }, [{ id: 'e', name: '6-84631 RSV.jpg' }]),
      onlySet: rrPieceHasPicture(state.personalData['505'], [{ id: 's', name: '6-17000 SET.jpg' }]),
      noReadLink: rrPieceHasPicture(state.personalData['502']),
      noReadNoLink: rrPieceHasPicture(state.personalData['506']),
    }));
    T('A6 the rule itself: no link → no; an empty folder → no; only a together shot → no; a box shot → yes; a box borrowing the engine\'s folder with no box shot → no; no read yet → the folder link decides',
      one.noLink === false && one.empty === false && one.onlySet === false && one.shot === true && one.engFolderNoBoxShot === false && one.noReadLink === true && one.noReadNoLink === false, one);

    console.log('\n== C · before the folder read lands ==');
    const c1 = await early(pg, '501');
    T('C1 before the read, a piece with a folder link shows 📷 as before (the engine and the box)', c1.before.lead === true && c1.before.box === true, c1);
    const c2 = await early(pg, '505');
    T('C2 before the read, a piece with no folder link shows none', c2.before.box === false, c2);
    T('C3 when the read lands, a piece with its own picture keeps its 📷', c1.after.lead === true, c1);
    T('C4 …an EMPTY folder takes the 📷 away (84631\'s Box)', c1.after.box === false, c1);
    T('C5 …a folder holding only the together shot takes it away too', c2.before.lead === true && c2.after.lead === false, c2);
    const c6 = await early(pg, '501', ['F501', 'F502']);
    T('C6 a failed read changes nothing (what is shown stays — real pictures are never hidden)', c6.before.lead === true && c6.after.lead === true && c6.after.box === true, c6);
    const sets = await pg.evaluate(() => ({
      yes: [rrIsSetShot({ name: '6-17000 SET.jpg' }), rrIsSetShot({ name: '01· 2046 set 2.jpg' })],
      no: [rrIsSetShot({ name: '6-17000 RSV.jpg' }), rrIsSetShot({ name: 'SETTING.jpg' }), rrIsSetShot(null)],
    }));
    T('C7 rrIsSetShot, the one together-shot rule: "SET" as a word, any case; never inside another word', sets.yes.every(Boolean) && !sets.no.some(Boolean), sets);

    console.log('\n== D · no new Drive call ==');
    const reads = await pg.evaluate(async () => { window.__reads = []; await window.__open('501'); return window.__reads.slice(); });
    T('Z  no page errors (computer)', errs.length === 0, errs);
    await ctx.close();
    {
      const ac = read('app-collection.js');
      const before = ac.replace("        _rrGrpCamSet(p, photos);   // T-2026-11-02-02: the card's 📷 follows what this read found\n", '')
        .replace(/'<span data-rr-cam="' \+ rrEsc\(_rrGrpCamKey\(p\)\) \+ '">' \+ _rrGrpCamHtml\(rrPieceHasPicture\(p\)\) \+ '<\/span><\/div>'/, "(rrPhotoLinkOf(p) ? ' <span title=\"Has photos\" style=\"font-size:0.78rem\">\\ud83d\\udcf7</span>' : '') + '</div>'");
      const w = await open(browser, 'computer', { 'app-collection.js': before });
      const oldReads = await w.pg.evaluate(async () => { window.__reads = []; await window.__open('501'); return window.__reads.slice(); });
      T('D1 one page open reads the same folders, the same number of times, as before the change', before !== ac && JSON.stringify(reads.slice().sort()) === JSON.stringify(oldReads.slice().sort()), { now: reads, before: oldReads });
      await w.ctx.close();
    }

    console.log('\n== B · a phone ==');
    {
      const w = await open(browser, 'phone');
      const b = await strips(w.pg);
      const sideways = await w.pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      T('B1 phone: the engine card wears 📷', b.g1.engine === true, b.g1);
      T('B2 phone: the empty-folder Box card wears no 📷', b.g1.box === false, b.g1);
      T('B3 phone: a box with a box shot wears 📷; a box with no folder does not', b.g2.box === true && b.g3.box === false, { g2: b.g2, g3: b.g3 });
      T('B4 phone: nothing runs off the side', sideways <= 1, sideways);
      T('Z  no page errors (phone)', w.errs.length === 0, w.errs);
      await w.ctx.close();
    }

    console.log('\n== P · planted ==');
    {
      const ac = read('app-collection.js');
      const old = ac.replace(/'<span data-rr-cam="' \+ rrEsc\(_rrGrpCamKey\(p\)\) \+ '">' \+ _rrGrpCamHtml\(rrPieceHasPicture\(p\)\) \+ '<\/span><\/div>'/, "(rrPhotoLinkOf(p) ? ' <span title=\"Has photos\" style=\"font-size:0.78rem\">\\ud83d\\udcf7</span>' : '') + '</div>'")
        .replace("        _rrGrpCamSet(p, photos);   // T-2026-11-02-02: the card's 📷 follows what this read found\n", '');
      for (const size of ['computer', 'phone']) {
        const w = await open(browser, size, { 'app-collection.js': old });
        const r = await strips(w.pg);
        T('P1 ' + size + ': the old folder-link rule → the empty-folder Box card wears 📷 again (' + (size === 'phone' ? 'B2' : 'A2') + ' goes red)', old !== ac && r.g1.box === true, r.g1);
        await w.ctx.close();
      }
    }
    {
      const ac = read('app-collection.js');
      const noRead = ac.replace("        _rrGrpCamSet(p, photos);   // T-2026-11-02-02: the card's 📷 follows what this read found\n", '');
      const w = await open(browser, 'computer', { 'app-collection.js': noRead });
      const r = await early(w.pg, '501');
      T('P2 the page read not passed to the 📷 → the empty-folder Box keeps its 📷 (C4 goes red)', noRead !== ac && r.after.box === true, r);
      await w.ctx.close();
    }
    {
      const ac = read('app-collection.js');
      const hide = ac.replace('  if (!Array.isArray(photos)) return true;\n', '  if (!Array.isArray(photos)) return false;\n');
      const w = await open(browser, 'computer', { 'app-collection.js': hide });
      const r = await early(w.pg, '501');
      T('P3 a first draw that hides the 📷 until the read → C1 goes red', hide !== ac && r.before.lead === false, r);
      await w.ctx.close();
    }
    {
      const ac = read('app-collection.js');
      const asEmpty = ac.replace("  if (!Array.isArray(photos)) return;   // the read failed: what is shown stays\n", '  photos = Array.isArray(photos) ? photos : [];\n');
      const w = await open(browser, 'computer', { 'app-collection.js': asEmpty });
      const r = await early(w.pg, '501', ['F501', 'F502']);
      T('P4 a failed read taken as an empty folder → real pictures hidden (C6 goes red)', asEmpty !== ac && r.after.lead === false, r);
      await w.ctx.close();
    }
    {
      const ac = read('app-collection.js');
      const noSet = ac.replace('function rrIsSetShot(f) { return /\\bSET\\b/i.test(', 'function rrIsSetShot(f) { return /\\bNOTASET\\b/i.test(');
      const w = await open(browser, 'computer', { 'app-collection.js': noSet });
      const r = await strips(w.pg);
      T('P5 a together-shot rule that misses "SET" → the SET-only lead wears 📷 (A5 goes red)', noSet !== ac && r.g3.lead === true, r.g3);
      await w.ctx.close();
    }
  } finally { await browser.close(); }
  console.log('\n' + (fail ? 'FAILED  —  ' : 'ALL PASS  —  ') + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  suite crashed: ' + (e && e.stack || e)); console.log('FAILED  —  ' + pass + ' passed, ' + (fail + 1) + ' failed'); process.exit(1); });
