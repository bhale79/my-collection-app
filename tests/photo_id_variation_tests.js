#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// photo_id_variation_tests.js — 2026-11-11 (photoidfix, maintenance chat; real
// Chromium, the REAL app, the REAL Marx 666 catalog rows read 2026-11-11)
//
// [stated] Brad 2026-11-11 (his Marx 666): "i hit the 666 and i get a variation
// option with no way of see the differences. i click one and then i get 'found
// it' like the app did something. then i have to hit use this again. then i get
// to hit the variation." → "as soon i hit the 666 button then i should go
// straight to the which variation page is it"; "if i select marx as the filter,
// then this shouldn't be an issue … if no filter is picked then yes" (a short
// "Which item is it?" only for genuinely different things).
// Mike Moore (beta A, email 11-11): a wrong Photo ID match could not be changed
// from the card — "It might be helpful to add the capability to override the
// image identification". PLAN_2026-11-11_PHOTO_ID_FIX.md.
//
//   A  one tap on the number → the Add screen's variation step (no list, no
//      "Found it"); no filter + different things → "Which item is it?" first
//      (maker / catalog only, no variations); a single sure read still asks.
//   B  "Wrong item?" on the card: another number + maker → that item's
//      variation step; not in the catalog → the hand-made add; "add it as my own
//      item" → the hand-made add; the photo rides every route.
//   C  the variation picker shows each variation's own words ((A) Smoke …).
//   S  ONE rule (_biChooseThing) for every list in the reader; words in config.
//   X  PLANTED: each check can fail.
//
// The reader's slow parts are stood in for, and ONLY them: the picture read
// (_biReadPicture → the numbers it "read") and the crop screen (→ "Photo ID").
// Every choice after that — the chips, the lists, the card, the Add screen —
// is the real code.
//
// Run:  node tests/photo_id_variation_tests.js
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  photo_id_variation_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 700))); cond ? pass++ : fail++; }
function plant(src, a, b) { if (src.indexOf(a) < 0) throw new Error('plant target not found: ' + a.slice(0, 90)); return src.replace(a, b); }

// the real Marx O rows for 666 (public master, read 2026-11-11), a Lionel 666, its box, and one Lionel 2026
const MX = (v, type, road, vd, desc, sub) => ({ itemNum: '666', itemType: type, subType: sub || 'Electric', roadName: road || '', description: desc || 'Die-cast 2-4-2 Locomotive, dull black',
  gauge: 'O Gauge', yearProd: v === '4' ? '' : '1955', variation: v, varDesc: vd, manufacturer: 'Marx', _tab: 'Marx O', _era: 'marx' });
const ROWS = [
  MX('1', 'Steam Locomotive', '', 'Die-cast 2-4-2 Locomotive, dull black — (A) Smoke exhausts at cylinders, white stripe'),
  MX('2', 'Steam Locomotive', '', 'Die-cast 2-4-2 Locomotive, dull black — (B) Other variations'),
  MX('3', 'Set', 'Sears', 'Die-cast 2-4-2 Locomotive, dull black — (C) Olive drab, for Sears Army Set'),
  MX('4', 'Steam Locomotive', '', 'Die-cast 0-4-0 Locomotive, dull black', 'Die-cast 0-4-0 Locomotive, dull black', 'Windup'),
  { itemNum: '666', itemType: 'Steam Locomotive', roadName: '', description: '2-6-2 Steam Locomotive', yearProd: '1954', variation: '', manufacturer: 'Lionel', _tab: 'Lionel PW - Items', _era: 'pw' },
  { itemNum: '666', itemType: 'Box', roadName: '', description: 'Box for 666 locomotive', yearProd: '1954', variation: '', manufacturer: 'Lionel', _tab: 'Lionel PW - Boxes', _era: 'pw' },
  // Pre-War No. 8 (live master, read by the review 2026-11-11): an Electric Locomotive A–D AND a Trolley A, B on one tab
  ...['A', 'B', 'C', 'D'].map(v => ({ itemNum: '8', itemType: 'Electric Locomotive', roadName: '', description: 'Electric locomotive', yearProd: '1925', variation: v, varDesc: 'Electric locomotive — loco ' + v, manufacturer: 'Lionel', _tab: 'Lionel Pre-War', _era: 'prewar' })),
  ...['A', 'B'].map(v => ({ itemNum: '8', itemType: 'Trolley', roadName: '', description: 'Trolley', yearProd: '1909', variation: v, varDesc: 'Trolley — trolley ' + v, manufacturer: 'Lionel', _tab: 'Lionel Pre-War', _era: 'prewar' })),
  { itemNum: '2026', itemType: 'Steam Locomotive', roadName: '', description: '2-6-2 Steam Locomotive', yearProd: '1948', variation: '', manufacturer: 'Lionel', _tab: 'Lionel PW - Items', _era: 'pw' },
];

// the three stand-ins (the camera's picture, the read, the crop), put in the SERVED barcode.js (the file on disk is untouched)
const BC = read('barcode.js');
const SEAM = s => plant(plant(plant(s,
  "if (!cap) cap = await _rtWait('camera screen', _biCapture());",
  "if (!cap) cap = window.__fakeCap ? { raw: window.__fakeCap, view: window.__fakeCap, lockedBc: null, src: 'camera' } : await _rtWait('camera screen', _biCapture());"),
  "var _rp = await _biReadPicture(fullCanvas, workCanvas, lockedBc, eraHint, _rpOpts, st, function () { return _biStop; });",
  "var _rp = window.__fakeRead ? await window.__fakeRead() : await _biReadPicture(fullCanvas, workCanvas, lockedBc, eraHint, _rpOpts, st, function () { return _biStop; });"),
  "var cr = await _rtWait('crop screen', _biCrop(cap.view, cap.lockedBc));",
  "var cr = window.__fakeCrop ? { action: 'photo', work: cap.view || cap.raw } : await _rtWait('crop screen', _biCrop(cap.view, cap.lockedBc));");

async function boot(browser, bcSrc, other) {
  const ctx = await browser.newContext({ viewport: { width: 1536, height: 900 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await ctx.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://') && !u.startsWith('about:') && !u.startsWith('data:') && !u.startsWith('blob:')) return r.abort();
    if (u.split('?')[0].endsWith('/app/barcode.js')) return r.fulfill({ body: SEAM(bcSrc || BC), contentType: 'application/javascript' });
    for (const f of Object.keys(other || {})) if (u.split('?')[0].endsWith('/app/' + f)) return r.fulfill({ body: other[f], contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(800);
  await pg.evaluate(rows => {
    state.masterData = rows.map(r => Object.assign({}, r)); try { _rebuildMasterIndex(); } catch (e) {}
    state.masterAllRows = state.masterData.slice(); state.masterByItemAll = state.masterByItem; window._allIdxComplete = true;
    state.personalData = {}; state.personalSheetId = 'SID'; _currentEra = 'all';
    state.user = { name: 'Brad', email: 'brad@example.com' };
    window.showToast = (m) => { (window.__toasts = window.__toasts || []).push(String(m)); };
    window.rrMaybeShowAddHelp = () => {};
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
  }, ROWS);
  return { ctx, pg, errs };
}
// open Add, set the Manufacturer filter, start Photo ID on a picture, the read "seeing" nums
const start = (pg, o) => pg.evaluate(async (o) => {
  await openWizard('collection'); await new Promise(r => setTimeout(r, 200));
  if (o.mfr) wizard.data._searchFilterManufacturer = o.mfr;
  window.__fakeCrop = true;
  window.__fakeRead = async () => ({ out: { ocrNums: o.nums.slice(), why: {}, ocrDesc: '', bcMaker: '' }, bc: null, bcResult: null,
    ocrText: o.nums.join(' '), rawCands: [], numsFromFullFrame: false, closerUnsure: !!o.unsure });
  const c = document.createElement('canvas'); c.width = 320; c.height = 160; const x = c.getContext('2d'); x.fillStyle = '#333'; x.fillRect(0, 0, 320, 160); x.fillStyle = '#fff'; x.font = '40px sans-serif'; x.fillText('666', 110, 95);
  window.__fakeCap = c;   // the picture he took (camera / file) — the route Mike and Brad use
  window.__done = null;
  window.openBoxIdentify(function (res) { window.__done = 'scanned'; window.__res = res; _wizApplyIdResult(res); },
    function () { window.__done = 'cancelled'; }, '', { addFilters: true });
  await new Promise(r => setTimeout(r, 700));
  return true;
}, o);
const screen = pg => pg.evaluate(() => {
  const vis = el => !!el && el.offsetParent !== null;
  const chips = Array.from(document.querySelectorAll('#bi-actions [data-bi^="num:"]')).map(b => b.getAttribute('data-bi').slice(4));
  const cand = document.getElementById('barcode-candidate-overlay');
  const found = Array.from(document.querySelectorAll('div')).find(d => /^Found it/.test((d.firstElementChild && d.firstElementChild.textContent) || '') && d.querySelector('[data-a="use"]'));
  const card = document.querySelector('[data-a="use"]') ? document.querySelector('[data-a="use"]').closest('.rr-card') : null;
  const st = wizard && wizard.steps && wizard.steps[wizard.step];
  return { chips, cand: cand ? cand.innerText.replace(/\s+/g, ' ') : null, candRows: cand ? cand.querySelectorAll('.bc-cand').length : 0,
    card: card ? card.innerText.replace(/\s+/g, ' ') : null, found: !!found, step: st && st.id, done: window.__done,
    num: wizard && wizard.data && wizard.data.itemNum, variation: wizard && wizard.data && wizard.data.variation,
    tab: wizard && wizard.matchedItem && wizard.matchedItem._tab, photo: !!(wizard && wizard.data && (wizard.data._idItemPhotoFile || wizard.data._biBoxPhotoFile)),   // a picture with a printed number rides as the box photo (v0.9.665), else the item photo
    manual: !!(wizard && wizard.data && wizard.data._manualEntry), manualMfr: wizard && wizard.data && wizard.data.manualManufacturer, manualNum: wizard && wizard.data && wizard.data.manualItemNum,
    body: (document.getElementById('wizard-body') || {}).innerText ? document.getElementById('wizard-body').innerText.replace(/\s+/g, ' ') : '',
    wrongOpen: vis(document.getElementById('bc-wrong')), msg: (document.getElementById('bc-wrong-msg') || {}).textContent || '', toasts: window.__toasts || [] };
});
const wait = ms => new Promise(r => setTimeout(r, ms));
const click = (pg, sel) => pg.evaluate(sel => { const e = document.querySelector(sel); if (!e) return false; e.click(); return true; }, sel);

// A1/A2/A3 + B, on a given barcode.js (planted copies reuse them)
async function scenA1(browser, bc, other) {
  const w = await boot(browser, bc, other);
  await start(w.pg, { mfr: 'Marx', nums: ['666', '2026'], unsure: true });
  const s0 = await screen(w.pg);
  await click(w.pg, '#bi-actions [data-bi="num:666"]'); await wait(900);
  const s1 = await screen(w.pg);
  await w.ctx.close(); return { s0, s1, errs: w.errs };
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  try {
    console.log('\n== A · one tap on the number → the variation step ==');
    const a1 = await scenA1(browser);
    T('A0 the closer look offers its numbers as chips (666 among them)', a1.s0.chips.indexOf('666') >= 0, a1.s0);
    T('A1 Marx filter on, tap 666 → straight to "Which variation is it?" — no "Which one is yours?" list, no "Found it" card', a1.s1.step === 'variation' && !a1.s1.cand && !a1.s1.card && a1.s1.done === 'scanned', a1.s1);
    T('A2 …the Marx 666 is held, no variation pre-chosen, and the photo came along as the item photo', a1.s1.num === '666' && a1.s1.tab === 'Marx O' && !a1.s1.variation && a1.s1.photo, a1.s1);
    T('A3 …the variation page shows ALL FOUR Marx 666 variations with their own words — incl. Var 3 (filed as a Set) and Var 4 (the 0-4-0, no year)', /Smoke exhausts at cylinders/.test(a1.s1.body) && /Other variations/.test(a1.s1.body) && /Olive drab, for Sears Army Set/.test(a1.s1.body) && /0-4-0/.test(a1.s1.body), a1.s1.body.slice(0, 500));
    T('A4 no page errors', a1.errs.length === 0, a1.errs);

    { // no filter: Marx 666, Lionel 666 and its box are three different things
      const w = await boot(browser);
      await start(w.pg, { mfr: '', nums: ['666', '2026'], unsure: true });
      await click(w.pg, '#bi-actions [data-bi="num:666"]'); await wait(700);
      const s = await screen(w.pg);
      T('A5 no filter → "Which item is it?" — one row per different thing (Marx O · Lionel PW items · its box), no "Var." lines', /Which item is it\?/.test(s.cand || '') && s.candRows === 3 && !/Var\. /.test(s.cand || ''), s);
      await w.pg.evaluate(() => { const r = Array.from(document.querySelectorAll('#barcode-candidate-overlay .bc-cand')).find(e => /Marx/.test(e.innerText)); r && r.click(); });
      await wait(900);
      const s2 = await screen(w.pg);
      T('A6 …choosing the Marx row → its variation step, no "Found it", Lionel\'s 666 never among its variations', s2.step === 'variation' && !s2.card && s2.tab === 'Marx O' && !/2-6-2/.test(s2.body) && /Smoke exhausts/.test(s2.body), s2);
      const vr = await w.pg.evaluate(() => _wizVariationRows('666').map(m => m._tab + ':' + m.variation));
      T('A7 …the variation rows are the Marx O rows only', vr.length >= 2 && vr.every(v => /^Marx O:/.test(v)), vr);
      await w.ctx.close();
    }
    { // a single sure read (nothing chosen yet) still asks once
      const w = await boot(browser);
      await start(w.pg, { mfr: 'Marx', nums: ['666'], unsure: false });
      await wait(400);
      const s = await screen(w.pg);
      T('A8 a single sure read with nothing chosen yet still shows "Found it — use this?" once (with "Wrong item?")', s.found && /Wrong item\?/.test(s.card || '') && !/Type it instead/.test(s.card || ''), s);
      await click(w.pg, '[data-a="use"]'); await wait(900);
      const s2 = await screen(w.pg);
      T('A9 …"Use this" → the variation step (asked there, once)', s2.step === 'variation' && !s2.variation, s2);
      await w.ctx.close();
    }

    { // the maker's catalog is not loaded on this device (he doesn't collect Marx): the variations still come from the full catalog
      const w = await boot(browser);
      await w.pg.evaluate(() => { state.masterData = state.masterData.filter(m => m._tab !== 'Marx O'); _rebuildMasterIndex(); });
      await start(w.pg, { mfr: 'Marx', nums: ['666', '2026'], unsure: true });
      await click(w.pg, '#bi-actions [data-bi="num:666"]'); await wait(900);
      const s = await screen(w.pg);
      T('A10 Marx not in this device\'s own catalog → still the variation page with its variations (never skipped with none chosen)', s.step === 'variation' && /Smoke exhausts/.test(s.body) && /Olive drab/.test(s.body), s);
      await w.ctx.close();
    }
    { // one tab + number, two types sharing letters → two things
      const w = await boot(browser);
      await start(w.pg, { mfr: '', nums: ['8', '2026'], unsure: true });
      await click(w.pg, '#bi-actions [data-bi="num:8"]'); await wait(700);
      const s = await screen(w.pg);
      T('A13 Pre-War No. 8 (a locomotive A–D AND a trolley A, B) → "Which item is it?" with the two', /Which item is it\?/.test(s.cand || '') && s.candRows === 2, s);
      await w.pg.evaluate(() => { const r = Array.from(document.querySelectorAll('#barcode-candidate-overlay .bc-cand')).find(e => /Trolley/.test(e.innerText)); r && r.click(); });
      await wait(900);
      const vr = await w.pg.evaluate(() => _wizVariationRows('8').map(m => m.itemType + ' ' + m.variation));
      T('A14 …choosing the trolley → its variation step lists the trolley\'s A and B only', JSON.stringify(vr) === JSON.stringify(['Trolley A', 'Trolley B']), vr);
      await w.ctx.close();
    }
    { // Research has no variation step: it keeps the list of every row
      const w = await boot(browser);
      const t = await w.pg.evaluate(async () => {
        const p = _biChooseThing(state.masterData.filter(m => m._tab === 'Marx O'), { itemNum: '666' }, false);
        await new Promise(r => setTimeout(r, 150));
        const o = document.getElementById('barcode-candidate-overlay'); const tx = o ? o.innerText : '';
        if (o) document.getElementById('bc-cand-cancel').click(); await p; return tx;
      });
      T('A11 Research keeps its old "Which one is yours?" list with the variations (it has no variation step)', /Which one is yours\?/.test(t) && /Var\. 3/.test(t), t.slice(0, 200));
      await w.ctx.close();
    }
    { // a typed add is untouched: no Photo ID key → the variation step's usual rows (type + period)
      const w = await boot(browser);
      const vr = await w.pg.evaluate(async () => { await openWizard('collection'); wizard.data.itemNum = '666'; wizard.matchedItem = state.masterData.find(m => m._tab === 'Marx O' && m.variation === '1'); return _wizVariationRows('666').map(m => m.variation); });
      T('A12 a TYPED 666 (no Photo ID) lists what it always did — the Steam Locomotive rows of its period, not the Set', vr.indexOf('1') >= 0 && vr.indexOf('2') >= 0 && vr.indexOf('3') < 0, vr);
      await w.ctx.close();
    }

    console.log('\n== B · "Wrong item?" on the card (Mike Moore) ==');
    const toCard = async () => { const w = await boot(browser); await start(w.pg, { mfr: '', nums: ['2026'], unsure: false }); await wait(400); return w; };
    {
      const w = await toCard();
      const s0 = await screen(w.pg);
      T('B0 the card reads 2026 (Lionel) and offers "Wrong item?" — the panel starts closed', /2026/.test(s0.card || '') && /Wrong item\?/.test(s0.card || '') && !s0.wrongOpen, s0);
      await click(w.pg, '[data-a="manual"]'); await wait(150);
      const s1 = await screen(w.pg);
      T('B1 "Wrong item?" opens the panel ON the card (number, maker, look it up, my own item) — nothing closes', s1.wrongOpen && !!s1.card && s1.done === null, s1);
      await w.pg.evaluate(() => { document.getElementById('bc-wrong-num').value = ''; });
      await click(w.pg, '[data-a="wrongfind"]'); await wait(150);
      const s2 = await screen(w.pg);
      T('B2 "Look it up" with no number says so and stays', /Type the item number first/.test(s2.msg) && !!s2.card, s2);
      await w.pg.evaluate(() => { document.getElementById('bc-wrong-num').value = '666'; document.getElementById('bc-wrong-maker').value = 'Marx'; });
      await click(w.pg, '[data-a="wrongfind"]'); await wait(900);
      const s3 = await screen(w.pg);
      T('B3 666 + Marx → the Marx 666 variation step (no list, no second card), photo kept', s3.step === 'variation' && s3.tab === 'Marx O' && !s3.card && !s3.cand && s3.photo && /Smoke exhausts/.test(s3.body), s3);
      await w.ctx.close();
    }
    {
      const w = await toCard();
      await click(w.pg, '[data-a="manual"]');
      await w.pg.evaluate(() => { document.getElementById('bc-wrong-num').value = '9999'; document.getElementById('bc-wrong-maker').value = 'Marx'; });
      await click(w.pg, '[data-a="wrongfind"]'); await wait(900);
      const s = await screen(w.pg);
      T('B4 a number the catalog lacks → the hand-made add with that number and maker, photo kept, and it says so', s.manual && s.manualNum === '9999' && s.manualMfr === 'Marx' && s.photo && s.toasts.some(t => /No Marx 9999 in the catalog/.test(t)), s);
      await w.ctx.close();
    }
    {
      const w = await toCard();
      await click(w.pg, '[data-a="manual"]');
      await w.pg.evaluate(() => { document.getElementById('bc-wrong-num').value = ''; document.getElementById('bc-wrong-maker').value = 'Marx'; });
      await click(w.pg, '[data-a="wrongown"]'); await wait(900);
      const s = await screen(w.pg);
      T('B5 "add it as my own item" with no number → the hand-made add, maker Marx, photo kept', s.manual && s.manualMfr === 'Marx' && !s.manualNum && s.photo, s);
      await w.ctx.close();
    }
    {
      const w = await toCard();
      await click(w.pg, '[data-a="manual"]'); await click(w.pg, '[data-a="wrongback"]'); await wait(100);
      const s = await screen(w.pg);
      T('B6 "Back" closes the panel and keeps the card', !s.wrongOpen && !!s.card, s);
      await w.ctx.close();
    }
    { // the Item Type switch to Manual keeps Photo ID's picture
      const w = await boot(browser);
      const kept = await w.pg.evaluate(async () => {
        await openWizard('collection'); wizard.data._idItemPhotoFile = new File(['x'], 'p.jpg'); wizard.data._picFirst = true;
        _wizSetKind('manual'); return !!wizard.data._idItemPhotoFile && !!wizard.data._picFirst;
      });
      T('B7 switching Item Type to Manual keeps the Photo ID / "Add a picture first" photo (the ONE carry list)', kept, kept);
      await w.ctx.close();
    }

    console.log('\n== C · the variation picker shows the differences ==');
    let cText = '';
    {
      const w = await boot(browser);
      cText = await w.pg.evaluate(async () => {
        const rows = state.masterData.filter(m => m._tab === 'Marx O');
        setTimeout(() => {}, 0);
        const p = showCandidatePicker(rows, { itemNum: '666' });
        await new Promise(r => setTimeout(r, 150));
        const t = document.getElementById('barcode-candidate-overlay').innerText.replace(/\s+/g, ' ');
        document.getElementById('bc-cand-cancel').click(); await p; return t;
      });
      T('C1 Var. 1 / 2 / 3 each show their own words — (A) Smoke exhausts…, (B) Other variations, (C) Olive drab, for Sears Army Set', /Var\. 1 — \(A\) Smoke exhausts at cylinders, white stripe/.test(cText) && /Var\. 2 — \(B\) Other variations/.test(cText) && /\(C\) Olive drab, for Sears Army Set/.test(cText), cText);
      T('C2 …without repeating the description inside each variation line', !/Var\. 1 — Die-cast/.test(cText), cText);
      await w.ctx.close();
    }

    console.log('\n== S · one rule, words in one place ==');
    const core = BC.slice(BC.indexOf('async function _biPipelineCore('), BC.indexOf('function _biFilterAsk('));
    const pickerCalls = (core.match(/showCandidatePicker\(/g) || []).length;
    T('S1 inside the reader every same-number list goes through _biChooseThing (only the "outside your filter" list calls the picker itself)', pickerCalls === 1 && (core.match(/_biChooseThing\(/g) || []).length === 2, { pickerCalls });
    T('S2 a choice he made is never confirmed a second time — the card is skipped on _chosen', /\(res && res\._chosen\) \? 'use' : await _rtWait\('confirm card'/.test(BC));
    const CFG = read('config.js');
    T('S3 the words live once, in config.js (RR_PHOTO_ID_CHOICE); the old "try Google Lens, Rescan, or Type it instead" line is gone', /const RR_PHOTO_ID_CHOICE = \{/.test(CFG) && !/try 🔍 Google Lens, Rescan, or Type it instead/.test(BC) && !/'Which item is it\?'/.test(BC));
    T('S4 the picker reads the catalog\'s real field (varDesc)', /m\.varDesc \|\| m\.varDetail/.test(BC));
    T('S5 review fixes in the source: a thing = tab + exact number; "None of these" is not a pick; "chosen" only for the number he picked; no pairing learned from a hand correction; "Wrong item?" handled after the re-read too',
      /function _biThingKey\(m\) \{ return String\(\(m && \(m\._tab \|\| m\._era\)\) \|\| ''\) \+ '\|' \+ String\(\(m && m\.itemNum\) \|\| ''\); \}/.test(BC)
      && /if \(_sel && _sel !== 'none'\) _chose = true;/.test(BC) && /var _choseIt = _chose && \(!_choseNum \|\|/.test(BC)
      && /!res\.learnedMap && !res\._wrongFixed\)/.test(BC)
      && BC.indexOf("if (cc === 'aionly')") < BC.indexOf("while (cc && typeof cc === 'object')") && BC.indexOf("while (cc && typeof cc === 'object')") < BC.indexOf("        if (cc === 'use') {"));

    console.log('\n== X · planted: each check can fail ==');
    { const r = await scenA1(browser, plant(BC, "var cc = (res && res._chosen) ? 'use' : await _rtWait('confirm card', _bcConfirmCard(_biInfoFor(res, _aiOffer)));", "var cc = await _rtWait('confirm card', _bcConfirmCard(_biInfoFor(res, _aiOffer)));"));
      T('X1 the "Found it" card put back after a tap → A1 red', !(r.s1.step === 'variation' && !r.s1.card), r.s1); }
    { const old = plant(BC, "        var th = await _biChooseThing(hits, { itemNum: n }, _addFlow);\n        if (th.pick) { pick = th.pick; verified = 'label'; _varLater = th.varLater; _oneType = th.oneType || ''; if (th.chosen) { _chose = true; _choseNum = th.pick.itemNum; } }",
        "        var th = { pick: await showCandidatePicker(hits, { itemNum: n }) };\n        if (th.pick) { pick = th.pick; verified = 'label'; }");
      const r = await scenA1(browser, old);
      T('X2 the old "Which one is yours?" of variations put back → A1 red', !(r.s1.step === 'variation' && !r.s1.cand), r.s1); }
    { const w = await boot(browser, plant(BC, '        var _vd = String(m.varDesc || m.varDetail || \'\');', '        var _vd = String(m.varDetail || \'\');'));
      const t = await w.pg.evaluate(async () => { const p = showCandidatePicker(state.masterData.filter(m => m._tab === 'Marx O'), { itemNum: '666' }); await new Promise(r => setTimeout(r, 150)); const t = document.getElementById('barcode-candidate-overlay').innerText; document.getElementById('bc-cand-cancel').click(); await p; return t; });
      T('X3 the picker back on varDetail → C1 red (no differences shown)', !/Smoke exhausts/.test(t), t.slice(0, 200)); await w.ctx.close(); }
    { const w = await boot(browser, plant(BC, '          res = Object.assign(_wRes, _carry);', '          res = _wRes;'));
      await start(w.pg, { mfr: '', nums: ['2026'], unsure: false }); await wait(400);
      await click(w.pg, '[data-a="manual"]');
      await w.pg.evaluate(() => { document.getElementById('bc-wrong-num').value = '9999'; document.getElementById('bc-wrong-maker').value = 'Marx'; });
      await click(w.pg, '[data-a="wrongfind"]'); await wait(900);
      const s = await screen(w.pg);
      T('X4 the photo dropped on "Wrong item?" → B4 red', !(s.manual && s.photo), s); await w.ctx.close(); }
    { const old = plant(BC, "        var th = await _biChooseThing(hits, { itemNum: n }, _addFlow);", "        var th = await _biChooseThing(hits, { itemNum: n }, _addFlow); void showCandidatePicker;\n        if (false) showCandidatePicker(hits, { itemNum: n });");
      const c2 = old.slice(old.indexOf('async function _biPipelineCore('), old.indexOf('function _biFilterAsk('));
      T('X5 a second picker call slipped into the reader → S1 red', (c2.match(/showCandidatePicker\(/g) || []).length !== 1); }
    { const w = await boot(browser, plant(BC, "      if (byVar[v] !== undefined && byVar[v] !== t) split = true;", "      if (false) split = true;"));
      await start(w.pg, { mfr: '', nums: ['8', '2026'], unsure: true });
      await click(w.pg, '#bi-actions [data-bi="num:8"]'); await wait(700);
      const s = await screen(w.pg);
      T('X7 types sharing letters NOT split → A13 red (the trolley could not be picked)', !(/Which item is it\?/.test(s.cand || '') && s.candRows === 2), s.cand); await w.ctx.close(); }
    { const WZ = read('wizard.js');
      const r = await scenA1(browser, null, { 'wizard.js': plant(WZ, "  if (mi && d._idOneThing && d._idOneThing === String(mi._tab || '') + '|' + String(mi.itemNum || '')) {", "  if (false) {") });
      T('X6 the variation step back on type + period only → A3 red (Var 3 / Var 4 hidden again)', !(/Olive drab, for Sears Army Set/.test(r.s1.body) && /0-4-0/.test(r.s1.body)), r.s1.body.slice(0, 300)); }
  } finally { await browser.close(); }
  console.log('\n' + (fail ? 'FAILED' : 'PASSED') + '  —  photo_id_variation_tests: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  photo_id_variation_tests crashed: ' + (e && e.stack || e)); process.exit(1); });
