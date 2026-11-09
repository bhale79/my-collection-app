#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// PAGES FOLLOW WHAT HAPPENED — 2026-11-08 stalepage (real Chromium, the REAL app)
//
// Found by the testing chat in T-2026-11-05-01 (v0.9.2127, Brad's Android phone
// + his computer, five test cabooses "6017-200"):
//   (a) on the phone, while it was behind the computer, Record Sale saved the
//       sale correctly but the item page still said "IN COLLECTION · 3 of 4"
//       until the phone reloaded;
//   (b) on the computer, after "No. 6017-200 was removed on another device —
//       nothing was changed." the Update Info box stayed open on the removed car.
//
// The rule now, ONE helper (app-collection.js rrCopyLeftCollection), two callers:
//   • the sale's finish (wizard-save.js, sold path) — the sold copy's page is
//     left for where it was opened from, the way Remove leaves (v0.9.2016);
//   • the one place a copy is found removed elsewhere (sheets.js rrWhereIsRow →
//     _rrForgetGoneCopy) — this device forgets the copy, the box open on it
//     closes (Update Info box, Sell window) and its page is left; a Remove that
//     was refused for that reason does not put the copy back on screen.
//
//   A  phone, BEHIND (a copy above was removed on the computer): Record Sale on
//      copy 3 of 4 → the sale lands on the copy's NEW row, the page is left for
//      My Collection, the other copies stay
//   A2 computer, not behind: the same — the page never kept "In Collection"
//   A3 a sale of ANOTHER copy while a page is open → that page stays, redrawn
//      ("Copy 3 of 4" becomes "Copy 2 of 3")
//   B  computer: Update Info → Save All Changes on a copy removed on the phone →
//      the words "No. 6017-200 was removed on another device — nothing was
//      changed.", nothing written, the box closes, the page is left, the copy
//      is forgotten
//   B2 Record Sale on a copy removed elsewhere → nothing written to Sold, the
//      Sell window closes, the page is left
//   B3 Remove on a copy removed elsewhere → it does not come back on screen,
//      and no "it is still in your collection" over the true message
//   B4 (contrast) its id on TWO rows → the box stays open, nothing forgotten
//   S  source: one helper, called from those two places
//   P  PLANTED offenders — each must turn its check red
//
// SPLIT 2026-11-09 (stalesplit): this one file used to be tests/stalepage_tests.js
// and took ~155–175 s alone; run-all stops any quick suite at 180 s, so it was
// killed in the full gate. Everything — the scenarios, the checks, the planted
// offenders and the story — still lives HERE, in ONE place; four thin suite files
// each run one section so every one finishes well inside the limit:
//   tests/stalepage_tests.js           section 'main'      A–A5, B–B4
//   tests/stalepage_more_tests.js      section 'more'      B5–B8, C1–C4, S1–S8
//   tests/stalepage_plants_a_tests.js  section 'plants_a'  P1–P13
//   tests/stalepage_plants_b_tests.js  section 'plants_b'  P14–P25
// This file sits in tests/lib/, which run-all never runs as a suite.
// Run:  node tests/run-all.js --only stalepage
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  the stalepage suites need playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', '..', 'app');
const rd = f => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 700)));
  cond ? pass++ : fail++;
}
function plant(src, from, to, what) {
  if (src.indexOf(from) < 0) throw new Error('planted ' + what + ': the line moved; update this test');
  const out = src.replace(from, to);
  if (out === src) throw new Error('planted ' + what + ': nothing changed');
  return out;
}

const PHONE = { width: 390, height: 844 };
const DESK = { width: 1400, height: 900 };
const GONE_WORDS = (() => { const m = /gone: '([^']*)'/.exec(rd('config.js').slice(rd('config.js').indexOf('const RR_FIND_BY_ID'))); return m ? m[1].replace(/\\u2014/g, '—') : null; })();

// sc: { viewport, mem: [key,…] (this device, rows 3…), sheet: [key,…] (the sheet NOW),
//       open: key, act: 'sale'|'saleOther'|'edit'|'remove'|'background'|'otherSheet', other: key,
//       noIds: true (copies saved before Inventory IDs), refuse: true (the sheet refuses a delete
//       for another reason), back: true (press the device Back once afterwards),
//       then: { sheetId?, sheet, refuse, act } — a second step after a collection switch / reload }
async function run(browser, sc, planted) {
  const pg = await browser.newPage({ viewport: sc.viewport });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    const bare = u.split('?')[0];
    const name = Object.keys(planted || {}).find(k => bare.endsWith('/app/' + k));
    if (name) return r.fulfill({ body: planted[name], contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(900);
  const out = await pg.evaluate(async sc => {
    const wait = ms => new Promise(z => setTimeout(z, ms));
    localStorage.clear();
    state.user = { email: 'bhale@ipd-llc.com', name: 'Brad' };
    window.accessToken = 'tok';
    state.masterData = [{ itemNum: '6017-200', variation: '', itemType: 'Caboose', _era: 'pw', _tab: 'Lionel PW - Items', description: 'Caboose', roadName: 'U.S. Navy' }];
    try { _rebuildMasterIndex(); } catch (e) {}
    ['auth-screen', 'beta-gate'].forEach(id => { const e = document.getElementById(id); if (e) e.style.display = 'none'; });
    document.getElementById('app').classList.add('active');
    const F = PERSONAL_FIELD_INDEX, idCol = personalColLetter('inventoryId');
    const W = window.__w = { writes: [], appends: [], deletes: [], toasts: [], reads: [] };
    let cur = sc;   // the step being run: which sheet, what it holds, whether it refuses
    // a collection as THIS device loaded it (a load, a reload, a switch all look like this)
    const load = (sheetId) => {
      state.personalSheetId = sheetId;
      state.personalData = {}; state.forSaleData = {}; state.upgradeData = {}; state.soldData = {}; state.wantData = {}; state.isData = {};
      sc.mem.forEach((k, i) => { state.personalData[k] = { inventoryId: sc.noIds ? '' : k, itemNum: '6017-200', variation: '', owned: true, condition: '7', era: 'pw', manufacturer: 'Lionel', row: 3 + i, notes: 'TEST ' + k, masterKey: 'pw|6017-200|' }; });   // a key already: no background repair looks the copies up
    };
    // ── the stand-in sheet: My Collection as it is NOW (the other device acted) ──
    window.sheetsGet = async function (sid, range) {
      W.reads.push(range);
      const col = new RegExp('!' + idCol + '3:' + idCol + '$');
      if (col.test(range)) return { values: cur.sheet.map(k => [k]) };
      const m = /!A(\d+):[A-Z]+(\d+)$/.exec(range);
      if (m) {
        const k = cur.sheet[Number(m[1]) - 3];
        const cells = new Array(Math.max(F.inventoryId + 1, PERSONAL_SCHEMA.length)).fill('');
        if (k) { cells[0] = '6017-200'; cells[F.inventoryId] = sc.noIds ? '' : k; cells[F.condition] = '7'; }
        return { values: k ? [cells] : [] };
      }
      return { values: [] };
    };
    window.sheetsUpdate = async function (sid, range, values) { W.writes.push(range); return {}; };
    window.sheetsAppend = async function (sid, range, rows) { W.appends.push(range); return 99; };
    window.sheetsDeleteRow = async function (sid, tab, row, exp) {
      if (cur.refuse) { W.toasts.push('(the sheet refused)'); return false; }   // refused for another reason (busy, signed out…)
      // the real gate first asks where the copy is NOW, saying whose action waits (as sheets.js does)
      const w = await rrWhereIsRow(sid, tab, row, exp && exp.itemNum, exp && exp.inventoryId, { user: !!(exp && exp.user) });
      if (!w.ok) { rrRowRefusedToast(w, exp && exp.itemNum); return false; }
      W.deletes.push({ tab: tab, row: w.row, inv: exp && exp.inventoryId });
      return w.row;
    };
    window.rrArchiveRowBeforeRemoval = async function () { return true; };
    window._cleanupSoldItemBoxes = async function () {};
    window.driveMoveToSold = async function () { return true; };
    window.loadPersonalData = async function () {};
    window._cachePersonalData = function () {};
    window.appConfirm = async function () { return true; };
    const _t = window.showToast; window.showToast = function (m) { W.toasts.push(String(m)); try { _t.apply(this, arguments); } catch (e) {} };
    const pageOf = () => ((document.querySelector('.page.active') || {}).id || '');
    const detTxt = () => { const d = document.getElementById('item-detail-content'); return d ? d.textContent.replace(/\s+/g, ' ') : ''; };
    const visible = sel => [...document.querySelectorAll(sel)].find(b => b.offsetParent !== null) || null;
    const openBox = async () => {
      const b = [...document.querySelectorAll('#item-detail-content button')].find(x => x.offsetParent !== null && /Update Info/.test(x.textContent));
      if (!b) return null;
      b.click(); await wait(250);
      return document.getElementById('item-panel-overlay');
    };
    const R = {};
    const step = async (spec) => {
      // ── open the copy's page the way My Collection does ──
      goToMyCollection(); await wait(250);
      showItemDetailPage(0, sc.open); await wait(400);
      const S = { before: { page: pageOf(), inColl: /In Collection/.test(detTxt()), copy: (detTxt().match(/Copy \d of \d/) || [''])[0] } };
      if (spec.act === 'sale' || spec.act === 'saleOther') {
        if (spec.act === 'sale') {
          const b = visible('#detail-record-sale'); if (!b) { S.error = 'no Record Sale button'; return S; }
          b.click(); await wait(250);
        } else {
          sellFromCollection(0, sc.other); await wait(250);   // e.g. the dashboard's Record a Sale, another copy
        }
        S.wizardOpen = document.getElementById('wizard-modal').classList.contains('open');
        wizard.data.salePrice = '1'; wizard.data.dateSold = '2026-11-08';
        try { await saveWizardItem(); } catch (e) { W.toasts.push('THROWN ' + (e && e.message)); }
        await wait(400);
      } else if (spec.act === 'edit') {
        const ov = await openBox(); S.boxOpened = !!ov;
        const save = ov && [...ov.querySelectorAll('button')].find(x => /Save All Changes/.test(x.textContent));
        if (!save) { S.error = 'no Save All Changes'; return S; }
        save.click(); await wait(600);
      } else if (spec.act === 'remove') {
        const b = visible('#detail-remove-item'); if (!b) { S.error = 'no Remove button'; return S; }
        b.click(); await wait(800);
      } else if (spec.act === 'background') {
        // the box is open and the person is typing; a background job (the offline
        // queue, a repair) looks the same copy up and finds it gone
        const ov = await openBox(); S.boxOpened = !!ov;
        S.answer = (await rrWhereIsRow(state.personalSheetId, PERSONAL_TAB, 5, '6017-200', sc.open)).why;
        await wait(200);
      } else if (spec.act === 'photos') {
        // the Add Photos window on this copy, its folder link saved
        openPhotoWizard('6017-200', '', sc.open); await wait(250);
        S.wizardOpen = document.getElementById('wizard-modal').classList.contains('open');
        wizard.data.photosItem = { RSV: 'https://drive.google.com/drive/folders/TESTFOLDER' };
        try { await savePhotoOnlyUpdate(); } catch (e) { W.toasts.push('THROWN ' + (e && e.message)); }
        await wait(400);
      } else if (spec.act === 'listedSale') {
        // the copy is on the For Sale list: Record Sale is the one-box sale (markForSaleAsSold)
        window.rrSaleDetailsDialog = async function () { return { price: '1', dateSold: '2026-11-08', notes: '', soldTo: '', soldAt: '' }; };
        const b = visible('#detail-record-sale'); if (!b) { S.error = 'no Record Sale button'; return S; }
        b.click(); await wait(900);
      } else if (spec.act === 'maker') {
        // Collection Tools → Check makers → Save on this copy's row
        const inp = document.createElement('input'); inp.id = 'ckm-in-0'; inp.value = 'Lionel'; document.body.appendChild(inp);
        window._ckmList = [{ key: sc.open }];
        await rrCheckMakerSave(0, null); await wait(300);
      } else if (spec.act === 'link') {
        // "Add a Piece I Already Own" → this copy joins a group
        S.link = await rrLinkOwnedToGroup(sc.open, 'G-TEST'); await wait(300);
      } else if (spec.act === 'otherSheet') {
        // ANOTHER collection's sheet answers "gone" for an id this one also has
        S.answer = (await rrWhereIsRow('OTHER-COLLECTION', PERSONAL_TAB, 5, '6017-200', sc.open, { user: true })).why;
        await wait(200);
      }
      if (sc.back && !spec.noBack) {
        await wait(1700);   // the Sell window's own history step has settled
        S.trail = (window._rrPageTrail || []).slice();
        history.back(); await wait(700);
        S.afterBack = pageOf();
      }
      S.after = {
        page: pageOf(), owned: !!(state.filters && state.filters.owned),
        inColl: pageOf() === 'page-itemdetail' && /In Collection/.test(detTxt()),
        copy: pageOf() === 'page-itemdetail' ? (detTxt().match(/Copy \d of \d/) || [''])[0] : '',
        box: !!document.getElementById('item-panel-overlay'),
        wizard: !!(document.getElementById('wizard-modal') && document.getElementById('wizard-modal').classList.contains('open')),
        keys: Object.keys(state.personalData).sort(),
        known: typeof rrCopyKnownGone === 'function' ? sc.mem.filter(k => rrCopyKnownGone(k, 0)) : null,
      };
      S.w = { reads: W.reads.slice(), writes: W.writes.slice(), appends: W.appends.slice(), deletes: W.deletes.slice(), toasts: W.toasts.slice() };
      return S;
    };
    load('SID');
    if (sc.listed) sc.mem.forEach((k, i) => { state.forSaleData[k] = { itemNum: '6017-200', variation: '', inventoryId: k, askingPrice: '5', row: 3 + i, condition: '7' }; });
    if (sc.back) { try { _initBackButton(); } catch (e) {} window._rrPageTrail = []; showPage('dashboard'); await wait(200); }
    Object.assign(R, await step(sc));
    if (sc.then) {
      cur = sc.then; W.toasts.length = 0;
      load(sc.then.sheetId || 'SID');   // a collection switch (another sheet) or a reload (the same sheet, read again)
      R.then = await step(sc.then);
    }
    return R;
  }, sc);
  await pg.close();
  return Object.assign(out || {}, { errs });
}

const M4 = ['T1', 'T2', 'T3', 'T4'];
const NO_T3 = ['T1', 'T2', 'T4'];   // T3 removed on the other device
const BEHIND_SALE = { viewport: PHONE, mem: M4, sheet: ['T2', 'T3', 'T4'], open: 'T3', act: 'sale' };   // T1 removed on the computer
const PLAIN_SALE = { viewport: DESK, mem: M4, sheet: M4, open: 'T3', act: 'sale' };
const OTHER_SALE = { viewport: DESK, mem: M4, sheet: M4, open: 'T3', act: 'saleOther', other: 'T1' };
const NOID_SALE = { viewport: PHONE, mem: ['K1'], sheet: ['K1'], open: 'K1', act: 'sale', noIds: true };   // a copy saved before Inventory IDs
const BACK_SALE = Object.assign({}, BEHIND_SALE, { back: true });
const GONE_EDIT = { viewport: DESK, mem: M4, sheet: NO_T3, open: 'T3', act: 'edit' };
const BACK_GONE_EDIT = Object.assign({}, GONE_EDIT, { viewport: PHONE, back: true });
const GONE_SALE = { viewport: DESK, mem: M4, sheet: NO_T3, open: 'T3', act: 'sale' };
const GONE_REMOVE = { viewport: DESK, mem: M4, sheet: NO_T3, open: 'T3', act: 'remove' };
const TWICE_EDIT = { viewport: DESK, mem: M4, sheet: ['T1', 'T2', 'T4', 'T3', 'T3'], open: 'T3', act: 'edit' };
const BACKGROUND = { viewport: DESK, mem: M4, sheet: NO_T3, open: 'T3', act: 'background' };
const OTHER_SHEET = { viewport: DESK, mem: M4, sheet: NO_T3, open: 'T3', act: 'otherSheet' };
// a Remove found T3 gone; then ANOTHER collection with its own T3 / the same sheet read again with T3 back
// (Returned) — a Remove refused for another reason must put that T3 back on screen and say so
const PHOTOS = { viewport: DESK, mem: M4, sheet: NO_T3, open: 'T3', act: 'photos' };
const LISTED_SALE = { viewport: DESK, mem: M4, sheet: NO_T3, open: 'T3', act: 'listedSale', listed: true };
const MAKER = { viewport: DESK, mem: M4, sheet: NO_T3, open: 'T3', act: 'maker' };
const LINK = { viewport: DESK, mem: M4, sheet: NO_T3, open: 'T3', act: 'link' };
const SWITCH = { viewport: DESK, mem: M4, sheet: NO_T3, open: 'T3', act: 'remove', then: { sheetId: 'SID2', sheet: M4, refuse: true, act: 'remove' } };
const RELOAD = { viewport: DESK, mem: M4, sheet: NO_T3, open: 'T3', act: 'remove', then: { sheetId: 'SID', sheet: M4, refuse: true, act: 'remove' } };

const leftForCollection = r => r.after && r.after.page === 'page-browse' && r.after.owned === true;
const putBack = r => !!(r.then && r.then.after && r.then.after.keys.indexOf('T3') >= 0 && r.then.w.toasts.some(t => /still in your collection/.test(t)));

// ── the source texts and the source checks (S, and the P plants that turn them red) ──
const AC = rd('app-collection.js'), SH = rd('sheets.js'), WS = rd('wizard-save.js'), AJ = rd('app.js');
const OTHERS = ['sheets.js', 'wizard-save.js', 'app.js', 'app-pages.js', 'browse.js', 'wizard.js'];
const oneHelper = (ac, src) => (ac.match(/function rrCopyLeftCollection\(/g) || []).length === 1 && OTHERS.every(f => !/function rrCopyLeftCollection\(/.test(src[f] || rd(f)));
const s2 = sh => /if \(opts && opts\.user\) _rrForgetGoneCopy\(spreadsheetId, tab, wantId\);[^\n]*\n\s*return \{ ok: false, why: 'gone' \};/.test(sh) && /rrCopyLeftCollection\(\[invId\]\.concat\(keys\)/.test(sh);
const s3 = sh => /spreadsheetId !== state\.personalSheetId\) return;\n\s*if \(typeof PERSONAL_TAB === 'undefined' \|\| tab !== PERSONAL_TAB\) return;/.test(sh);
const s5 = ac => /overlay\.setAttribute\('data-rr-inv', String\(_live\.inventoryId \|\| ''\)\);/.test(ac);
const s6 = sh => /_rrGoneCopies\[_rrGoneKey\(state\.personalSheetId, id\)\];\n\s*return !!at && at > Number\(since \|\| 0\);/.test(sh) && /function _rrGoneKey\(sheetId, invId\) \{ return String\(sheetId \|\| ''\) \+ '\|' \+/.test(sh);
const CI = rd('command-ids.js'), TL = rd('tools.js'), PG = rd('app-pages.js');
const s8 = ci => /rrPersonalSafeWrite\(pd, values, base, \{ user: true \}\)/.test(ci);

const SECTIONS = ['main', 'more', 'plants_a', 'plants_b'];
async function runSection(section, suiteName) {
  if (SECTIONS.indexOf(section) < 0) throw new Error('stalepage_lib: no section "' + section + '"');
  const on = s => section === s;
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  try {
    T('setup: the "removed on another device" words are read from config.js', !!GONE_WORDS && /removed on another device/.test(GONE_WORDS), GONE_WORDS);
    const goneMsg = GONE_WORDS.replace('{num}', '6017-200');
    let r;
    if (on('main')) {
      console.log('== A · after Record Sale the page follows the sale ==');
      r = await run(browser, BEHIND_SALE);
      T('A  setup: phone, the item page showed "In Collection · Copy 3 of 4"', r.before && r.before.page === 'page-itemdetail' && r.before.inColl && r.before.copy === 'Copy 3 of 4', r.before || r);
      T('A  setup: the Sell window opened from Record Sale', r.wizardOpen === true, r);
      T('A  setup (unchanged, findbyid): behind, the sale took T3 off its NEW row (4), never the remembered row 5', r.w && r.w.deletes.length === 1 && r.w.deletes[0].inv === 'T3' && r.w.deletes[0].row === 4, r.w);
      T('A  setup (unchanged): …and it was recorded in Sold', r.w && r.w.appends.some(a => /^Sold!/.test(a)) && r.w.toasts.some(t => /added to Sold/.test(t)), r.w);
      T('A  THE BUG: the page no longer says "In Collection" — it went back to My Collection', leftForCollection(r) && r.after.inColl === false, r.after);
      T('A  setup (unchanged): only T3 left the collection on this phone (T1, removed on the computer, is not looked up here)', r.after && r.after.keys.join(',') === 'T1,T2,T4', { after: r.after, reads: r.w && r.w.reads });
      T('A  no page errors', r.errs.length === 0, r.errs);

      r = await run(browser, PLAIN_SALE);
      T('A2 computer, not behind: Record Sale → back to My Collection, T3 gone from the screen', leftForCollection(r) && r.after.keys.join(',') === 'T1,T2,T4' && r.w.deletes.length === 1 && r.w.deletes[0].row === 5, r.after || r);
      T('A2 no page errors', r.errs.length === 0, r.errs);

      r = await run(browser, OTHER_SALE);
      T('A3 a sale of ANOTHER copy (T1) while T3\'s page is open → T3\'s page stays', r.after && r.after.page === 'page-itemdetail' && r.after.inColl === true, r.after || r);
      T('A3 …and is redrawn: "Copy 3 of 4" became "Copy 2 of 3"', r.before && r.before.copy === 'Copy 3 of 4' && r.after.copy === 'Copy 2 of 3', { before: r.before, after: r.after });
      T('A3 no page errors', r.errs.length === 0, r.errs);

      r = await run(browser, NOID_SALE);
      T('A4 setup: a copy with NO Inventory ID — its page showed "In Collection"', r.before && r.before.page === 'page-itemdetail' && r.before.inColl, r.before || r);
      T('A4 …Record Sale → back to My Collection too (matched by the copy\'s store key)', leftForCollection(r) && r.after.keys.length === 0, r.after || r);
      T('A4 no page errors', r.errs.length === 0, r.errs);

      r = await run(browser, BACK_SALE);
      T('A5 phone: after the sale, ONE press of Back goes to the page you were on before (here the Dashboard, the page before My Collection), not onto the sold item', r.after && r.afterBack === 'page-dashboard', { afterBack: r.afterBack, trail: r.trail });
      T('A5 no page errors', r.errs.length === 0, r.errs);

      console.log('== B · a copy removed on another device: its box closes and its page is left ==');
      r = await run(browser, GONE_EDIT);
      T('B  setup: the Update Info box opened on T3', r.boxOpened === true && r.before.page === 'page-itemdetail', r);
      T('B  setup (unchanged): the words "' + goneMsg + '"', r.w && r.w.toasts.indexOf(goneMsg) >= 0, r.w && r.w.toasts);
      T('B  setup (unchanged): nothing was written', r.w && r.w.writes.length === 0 && r.w.appends.length === 0, r.w);
      T('B  THE BUG: the Update Info box closed', r.after && r.after.box === false, r.after);
      T('B  …and the removed car\'s page was left for My Collection', leftForCollection(r), r.after);
      T('B  …and this device forgot T3 (the others stay)', r.after && r.after.keys.join(',') === 'T1,T2,T4' && r.after.known.join(',') === 'T3', r.after);
      T('B  no page errors', r.errs.length === 0, r.errs);

      r = await run(browser, BACK_GONE_EDIT);
      T('B1 phone: after the box closed, ONE press of Back goes to the page you were on before (here the Dashboard), not onto the removed car', r.after && r.afterBack === 'page-dashboard', { afterBack: r.afterBack, trail: r.trail });

      r = await run(browser, GONE_SALE);
      T('B2 setup (unchanged, findbyid): Record Sale on a copy removed elsewhere writes nothing to Sold or the collection', r.w && r.w.appends.length === 0 && r.w.deletes.length === 0 && r.w.writes.length === 0, r.w);
      T('B2 …the Sell window closed and the page was left; T3 forgotten', r.after && r.after.wizard === false && leftForCollection(r) && r.after.keys.join(',') === 'T1,T2,T4', r.after);
      T('B2 setup (unchanged): …and the person is told the sale was not recorded', r.w && r.w.toasts.some(t => /sale was not recorded/.test(t)), r.w && r.w.toasts);
      T('B2 no page errors', r.errs.length === 0, r.errs);

      r = await run(browser, GONE_REMOVE);
      T('B3 setup (unchanged): Remove on a copy removed elsewhere says it was removed on another device', r.w && r.w.toasts.indexOf(goneMsg) >= 0, r.w && r.w.toasts);
      T('B3 …T3 does NOT come back on screen', r.after && r.after.keys.join(',') === 'T1,T2,T4' && leftForCollection(r), r.after);
      T('B3 …and no "it is still in your collection" over the true message', r.w && !r.w.toasts.some(t => /still in your collection/.test(t)), r.w && r.w.toasts);
      T('B3 no page errors', r.errs.length === 0, r.errs);

      r = await run(browser, TWICE_EDIT);
      T('B4 (contrast) T3 on two rows: refused, the box stays open, nothing forgotten, still on its page', r.after && r.after.box === true && r.after.page === 'page-itemdetail' && r.after.keys.length === 4 && r.w.writes.length === 0, r.after || r);
    }
    if (on('more')) {

      r = await run(browser, BACKGROUND);
      T('B5 a BACKGROUND lookup finds T3 gone while its Update Info box is open → the box stays open (never closed under the person)', r.answer === 'gone' && r.after && r.after.box === true && r.after.page === 'page-itemdetail', { answer: r.answer, after: r.after });
      T('B5 …and nothing is forgotten or marked by it', r.after && r.after.keys.length === 4 && r.after.known.length === 0, r.after);

      r = await run(browser, OTHER_SHEET);
      T('B6 ANOTHER collection\'s sheet says "gone" for an id this one also has → this collection keeps T3, its page stays', r.answer === 'gone' && r.after && r.after.keys.length === 4 && r.after.page === 'page-itemdetail' && r.after.known.length === 0, { answer: r.answer, after: r.after });

      r = await run(browser, SWITCH);
      T('B7 setup: the first Remove found T3 gone and forgot it', r.after && r.after.keys.join(',') === 'T1,T2,T4', r.after);
      T('B7 then another collection with its OWN T3: a Remove refused for another reason puts T3 back and says it is still there', putBack(r), r.then && { after: r.then.after, toasts: r.then.w.toasts });
      r = await run(browser, RELOAD);
      T('B8 then T3 comes back (a reload after Returned): a Remove refused for another reason puts T3 back and says so', putBack(r), r.then && { after: r.then.after, toasts: r.then.w.toasts });
      T('B7/B8 no page errors', r.errs.length === 0, r.errs);

      console.log('== C · the other boxes a person saves from ==');
      r = await run(browser, PHOTOS);
      T('C1 setup: the Add Photos window opened on T3', r.wizardOpen === true, r);
      T('C1 Add Photos on a copy removed elsewhere: the words, the window closed, the page left, T3 forgotten', r.w && r.w.toasts.indexOf(goneMsg) >= 0 && r.after.wizard === false && leftForCollection(r) && r.after.keys.join(',') === 'T1,T2,T4', { after: r.after, toasts: r.w && r.w.toasts });
      T('C1 …and never "✓ Photos saved!" over that message', r.w && !r.w.toasts.some(t => /Photos saved/.test(t)), r.w && r.w.toasts);
      T('C1 no page errors', r.errs.length === 0, r.errs);
      r = await run(browser, LISTED_SALE);
      T('C2 Record Sale on a LISTED copy removed elsewhere (the one-box sale): nothing written to Sold, T3 forgotten', r.w && !r.w.appends.some(a => /^Sold!/.test(a)) && r.after && r.after.keys.join(',') === 'T1,T2,T4', { after: r.after, w: r.w });
      T('C2 no page errors', r.errs.length === 0, r.errs);
      r = await run(browser, MAKER);
      T('C3 Check makers → Save on a copy removed elsewhere: the words, nothing written, T3 forgotten', r.w && r.w.toasts.indexOf(goneMsg) >= 0 && r.w.writes.length === 0 && r.after.keys.join(',') === 'T1,T2,T4', { after: r.after, w: r.w });
      r = await run(browser, LINK);
      T('C4 a group link of a copy removed elsewhere: refused, nothing written, its page left, T3 forgotten', r.link && r.link.ok === false && r.w.writes.length === 0 && leftForCollection(r) && r.after.keys.join(',') === 'T1,T2,T4', { link: r.link, after: r.after });
      T('C3/C4 no page errors', r.errs.length === 0, r.errs);

      console.log('== S · source ==');
      // S0 (2026-11-09, the split): every section runs from exactly one suite file in tests/ — a
      // section with no file would run nowhere, and run-all would never notice
      const sectionsRun = files => SECTIONS.every(s => files.filter(f => new RegExp("runSection\\('" + s + "'").test(f.src)).length === 1);
      const SUITES = fs.readdirSync(path.join(__dirname, '..')).filter(n => /^stalepage.*_tests\.js$/.test(n)).map(n => ({ n, src: fs.readFileSync(path.join(__dirname, '..', n), 'utf8') }));
      T('S0 every section (' + SECTIONS.join(', ') + ') runs from exactly one tests/stalepage*_tests.js file', SUITES.length === SECTIONS.length && sectionsRun(SUITES), SUITES.map(f => f.n));
      const s0Plant = SUITES.filter(f => !/'plants_b'/.test(f.src));
      T('S0 PLANTED: a suite file missing (plants_b runs nowhere) → the check goes red', s0Plant.length === SUITES.length - 1 && !sectionsRun(s0Plant));
      T('S1 one helper: rrCopyLeftCollection is defined once, in app-collection.js', oneHelper(AC, {}), '');
      T('S2 sheets.js: a "gone" answer a person\'s action waits on forgets the copy and calls the helper', s2(SH));
      T('S3 sheets.js: only the open collection\'s My Collection tab', s3(SH));
      T('S4 wizard-save.js: the sale\'s finish calls the helper with the copies it took', /if \(tab === 'sold' && typeof rrCopyLeftCollection === 'function'\) \{\n\s*try \{ rrCopyLeftCollection\(_rrSoldLeft, \{ repaint: true \}\);/.test(WS));
      T('S5 the Update Info box names its copy', s5(AC));
      T('S6 the "gone" mark is keyed by the collection\'s sheet AND the id, and believed only for an action that started before it', s6(SH));
      T('S7 the person\'s own saves say so (opts.user): Update Info, the edit/finish save, the sale, Remove', /rrPersonalSafeWrite\(pd, newRow, _base, \{ out: _out, user: true \}\)/.test(AC)
        && /\{ user: !!\(opts && opts\.user\) \}\);/.test(AJ) && (WS.match(/existing\.inventoryId \|\| '', \{ user: true \}\)|collectionEntry\.inventoryId \|\| '', \{ user: true \}\)/g) || []).length === 2
        && (AC.match(/inventoryId: (?:\(thisPd && thisPd\.inventoryId\)|sib\.inventoryId) \|\| '', user: true \}/g) || []).length === 2 && /\{ user: !!_exp\.user \}/.test(SH));
      T('S8 …and the other boxes: Add Photos, the one-box sale, the Command ID card, Check makers, the group link',
        /invId: pd\.inventoryId \|\| '', user: true \}, 'collection'\)/.test(WS) && /\{ user: !!\(expect && expect\.user\) \}/.test(SH)
        && /collEntry\.inventoryId \|\| '', \{ user: true \}\)/.test(PG) && s8(CI) && /\{ out: _out, user: true \}\)\)\) return false;/.test(TL)
        && /mc\.inventoryId \|\| '', \{ user: true \}\)/.test(WS));
    }
    if (on('plants_a')) {
      console.log('== P · planted offenders ==');
      // P1: the sale's finish no longer calls the helper → the page stays "In Collection"
      const p1 = plant(WS, "      try { rrCopyLeftCollection(_rrSoldLeft, { repaint: true }); } catch (eLeft) { console.warn('[Sold] page after the sale:', eLeft); }", '', 'P1');
      T('P1 plant applied', p1 !== WS);
      r = await run(browser, BEHIND_SALE, { 'wizard-save.js': p1 });
      T('P1 no call after the sale → A catches it (still on the item page saying "In Collection")', r.after && r.after.page === 'page-itemdetail' && r.after.inColl === true, r.after || r);
      T('P1 the S4 source check fails on it', !/try \{ rrCopyLeftCollection\(_rrSoldLeft/.test(p1));
      // P2: rrWhereIsRow no longer forgets a gone copy → the box stays open on it
      const p2 = plant(SH, "    if (opts && opts.user) _rrForgetGoneCopy(spreadsheetId, tab, wantId);   // STALEPAGE: a person's action waits on it — forgotten, its box and page close\n", '', 'P2');
      r = await run(browser, GONE_EDIT, { 'sheets.js': p2 });
      T('P2 the gone answer not acted on → B catches it (box open, T3 still on screen)', r.after && r.after.box === true && r.after.keys.length === 4, r.after || r);
      T('P2 …and the S2 source check fails on it', !s2(p2));
      // P3: the helper does not close the Update Info box
      const p3 = plant(AC, "    if (ov && (mine(ov.getAttribute('data-rr-inv')) || mine(ov.getAttribute('data-rr-key')))) ov.remove();", '', 'P3');
      r = await run(browser, GONE_EDIT, { 'app-collection.js': p3 });
      T('P3 the box not closed → B catches it', r.after && r.after.box === true, r.after || r);
      // P4: the helper does not leave the page
      const LEAVE = "  if (onPage && (mine(window._lastDetailCopyInv) || mine(window._lastDetailPdKey))) { rrGoToCollectionAfterRemove(); return true; }";
      const p4 = plant(AC, LEAVE, '', 'P4');
      r = await run(browser, GONE_EDIT, { 'app-collection.js': p4 });
      T('P4 the page not left → B catches it (still on the removed car\'s page)', r.after && r.after.page === 'page-itemdetail', r.after || r);
      r = await run(browser, PLAIN_SALE, { 'app-collection.js': p4 });
      T('P4 …and A2 catches it too (still on the sold car\'s page)', r.after && r.after.page === 'page-itemdetail', r.after || r);
      // P5: the helper does not close the Sell window
      const p5 = plant(AC, "        && typeof _doCloseWizard === 'function') _doCloseWizard();", "        && false) _doCloseWizard();", 'P5');
      r = await run(browser, GONE_SALE, { 'app-collection.js': p5 });
      T('P5 the Sell window not closed → B2 catches it', r.after && r.after.wizard === true, r.after || r);
      // P6: a refused Remove puts a copy removed elsewhere back on screen
      const p6 = plant(AC, "        if (typeof rrCopyKnownGone === 'function' && rrCopyKnownGone(held[k].inventoryId || k, goneSince)) return;\n", '', 'P6');
      r = await run(browser, GONE_REMOVE, { 'app-collection.js': p6 });
      T('P6 the gone copy put back → B3 catches it (T3 back on screen, "still in your collection")', r.after && r.after.keys.indexOf('T3') >= 0 && r.w.toasts.some(t => /still in your collection/.test(t)), r.after || r);
      // P7: forgetting reaches ANOTHER collection's sheet (ids repeat across collections)
      const p7 = plant(SH, "  if (typeof state === 'undefined' || !state || !invId || spreadsheetId !== state.personalSheetId) return;", "  if (typeof state === 'undefined' || !state || !invId) return;", 'P7');
      T('P7 the open-collection guard removed → S3 fails on it', !s3(p7));
      r = await run(browser, OTHER_SHEET, { 'sheets.js': p7 });
      T('P7 …and B6 catches it in the browser (this collection\'s T3 forgotten on another sheet\'s answer)', r.after && r.after.keys.indexOf('T3') < 0, r.after || r);
      // P8: the helper leaves ANY item page, not just the sold copy's → A3 catches it
      const p8 = plant(AC, LEAVE, "  if (onPage) { rrGoToCollectionAfterRemove(); return true; }", 'P8');
      r = await run(browser, OTHER_SALE, { 'app-collection.js': p8 });
      T('P8 leaving whatever page is open → A3 catches it (T3\'s page left after T1 was sold)', r.after && r.after.page !== 'page-itemdetail', r.after || r);
      // P9: no redraw of a page whose copy stayed → A3b catches it
      const p9 = plant(AC, "  if (onPage && opts.repaint && typeof rrDetailRepaint === 'function') rrDetailRepaint(0);", '', 'P9');
      r = await run(browser, OTHER_SALE, { 'app-collection.js': p9 });
      T('P9 no redraw → A3b catches it (still "Copy 3 of 4")', r.after && r.after.copy === 'Copy 3 of 4', r.after || r);
      // P10: a copy on TWO rows treated as gone → B4 catches it
      const p10 = plant(SH, "    console.warn('[rows] ' + tab + ': Inventory ID \"' + wantId + '\" is on rows ' + hits.join(', ') + ' — refusing to guess.');",
        "    console.warn('[rows] ' + tab + ': Inventory ID \"' + wantId + '\" is on rows ' + hits.join(', ') + ' — refusing to guess.'); _rrForgetGoneCopy(spreadsheetId, tab, wantId);", 'P10');
      r = await run(browser, TWICE_EDIT, { 'sheets.js': p10 });
      T('P10 "on two rows" acted on as gone → B4 catches it (box closed / T3 forgotten)', r.after && (r.after.box === false || r.after.keys.length < 4), r.after || r);
      // P11: the box does not say which copy it is open on → B catches it, and S5 fails
      const p11 = plant(AC, "  overlay.setAttribute('data-rr-inv', String(_live.inventoryId || ''));\n  overlay.setAttribute('data-rr-key', String(pdKey || ''));\n", '', 'P11');
      r = await run(browser, GONE_EDIT, { 'app-collection.js': p11 });
      T('P11 the box not naming its copy → B catches it (box stays open)', r.after && r.after.box === true, r.after || r);
      T('P11 …and the S5 source check fails on it', !s5(p11));
      // P12: a second copy of the helper → S1 fails
      T('P12 a second rrCopyLeftCollection (in wizard-save.js) → S1 fails', !oneHelper(AC, { 'wizard-save.js': WS + '\nfunction rrCopyLeftCollection(ids) {}\n' }));
      // P13: a copy with no Inventory ID not matched by its store key → A4 catches it
      const p13 = plant(AC, LEAVE, "  if (onPage && mine(window._lastDetailCopyInv)) { rrGoToCollectionAfterRemove(); return true; }", 'P13');
      r = await run(browser, NOID_SALE, { 'app-collection.js': p13 });
      T('P13 matching by Inventory ID only → A4 catches it (the no-ID copy\'s page still says "In Collection")', r.after && r.after.page === 'page-itemdetail' && r.after.inColl === true, r.after || r);
    }
    if (on('plants_b')) {
      // P14: the item page left on the visit trail → one Back lands on the sold / removed item
      const p14 = plant(AC, "  try { var _tr = window._rrPageTrail; while (_tr && _tr.length && _tr[_tr.length - 1] === 'itemdetail') _tr.pop(); } catch (eTr) {}\n", '', 'P14');
      r = await run(browser, BACK_SALE, { 'app-collection.js': p14 });
      T('P14 the trail not trimmed → A5 catches it (Back lands on the sold item\'s page)', r.after && r.afterBack === 'page-itemdetail', { afterBack: r.afterBack, trail: r.trail });
      // P15: the old unscoped mark (keyed by the id alone, believed forever) → B7 and B8 catch it, S6 fails
      let p15 = plant(SH, "function _rrGoneKey(sheetId, invId) { return String(sheetId || '') + '|' + String(invId == null ? '' : invId).trim(); }",
        "function _rrGoneKey(sheetId, invId) { return String(invId == null ? '' : invId).trim(); }", 'P15a');
      p15 = plant(p15, "  return !!at && at > Number(since || 0);", "  return !!at;", 'P15b');
      T('P15 the S6 source check fails on the unscoped mark', !s6(p15));
      r = await run(browser, SWITCH, { 'sheets.js': p15 });
      T('P15 …B7 catches it (the other collection\'s T3 is NOT put back after a refused Remove)', r.then && !putBack(r), r.then && { after: r.then.after, toasts: r.then.w.toasts });
      r = await run(browser, RELOAD, { 'sheets.js': p15 });
      T('P15 …B8 catches it (T3 back after a reload is NOT put back after a refused Remove)', r.then && !putBack(r), r.then && { after: r.then.after, toasts: r.then.w.toasts });
      // P16: the mark believed even for an action that started after it → B8 catches it
      const p16 = plant(SH, "  return !!at && at > Number(since || 0);", "  return !!at;", 'P16');
      r = await run(browser, RELOAD, { 'sheets.js': p16 });
      T('P16 the mark not scoped to the action → B8 catches it', r.then && !putBack(r), r.then && { after: r.then.after, toasts: r.then.w.toasts });
      // P17: background lookups act on the screen too → B5 catches it
      const p17 = plant(SH, "    if (opts && opts.user) _rrForgetGoneCopy(spreadsheetId, tab, wantId);", "    _rrForgetGoneCopy(spreadsheetId, tab, wantId);", 'P17');
      r = await run(browser, BACKGROUND, { 'sheets.js': p17 });
      T('P17 a background lookup closing the box → B5 catches it', r.after && r.after.box === false, r.after || r);
      // P18: the Update Info save not saying it is the person's own → B catches it (box stays open)
      const p18 = plant(AC, "{ out: _out, user: true }", "{ out: _out }", 'P18');
      r = await run(browser, GONE_EDIT, { 'app-collection.js': p18 });
      T('P18 the Update Info save without opts.user → B catches it (box stays open)', r.after && r.after.box === true, r.after || r);
      // P19: rrPersonalSafeWrite not passing opts.user on → B catches it
      const p19 = plant(AJ, "{ user: !!(opts && opts.user) });", "{});", 'P19');
      r = await run(browser, GONE_EDIT, { 'app.js': p19 });
      T('P19 rrPersonalSafeWrite dropping opts.user → B catches it (box stays open)', r.after && r.after.box === true, r.after || r);
      // P20–P24: each other box without opts.user → its check catches it (the copy stays on this device)
      const p20 = plant(WS, "invId: pd.inventoryId || '', user: true }, 'collection')", "invId: pd.inventoryId || '' }, 'collection')", 'P20');
      r = await run(browser, PHOTOS, { 'wizard-save.js': p20 });
      T('P20 Add Photos without user → C1 catches it (page stays, T3 kept)', r.after && r.after.page === 'page-itemdetail' && r.after.keys.length === 4, r.after || r);
      const p20b = plant(WS, "      if (_phOk) showToast('✓ Photos saved!');", "      showToast('✓ Photos saved!');", 'P20b');
      r = await run(browser, PHOTOS, { 'wizard-save.js': p20b });
      T('P20b "Photos saved" over the refusal → C1 catches it', r.w && r.w.toasts.some(t => /Photos saved/.test(t)), r.w && r.w.toasts);
      const p21 = plant(PG, "collEntry.inventoryId || '', { user: true });", "collEntry.inventoryId || '');", 'P21');
      r = await run(browser, LISTED_SALE, { 'app-pages.js': p21 });
      T('P21 the one-box sale without user → C2 catches it (T3 kept)', r.after && r.after.keys.indexOf('T3') >= 0, r.after || r);
      const p22 = plant(TL, "{ out: _out, user: true }))) return false;", "{ out: _out }))) return false;", 'P22');
      r = await run(browser, MAKER, { 'tools.js': p22 });
      T('P22 Check makers without user → C3 catches it (T3 kept)', r.after && r.after.keys.indexOf('T3') >= 0, r.after || r);
      const p23 = plant(WS, "mc.inventoryId || '', { user: true });", "mc.inventoryId || '');", 'P23');
      r = await run(browser, LINK, { 'wizard-save.js': p23 });
      T('P23 the group link without user → C4 catches it (T3 kept, page stays)', r.after && r.after.keys.indexOf('T3') >= 0 && r.after.page === 'page-itemdetail', r.after || r);
      const p24 = plant(CI, "rrPersonalSafeWrite(pd, values, base, { user: true })", "rrPersonalSafeWrite(pd, values, base, {})", 'P24');
      T('P24 the Command ID card without user → S8 fails (its card is not driven here; a source check)', !s8(p24));
      const p25 = plant(SH, "{ user: !!(expect && expect.user) });   // STALEPAGE: expect.user", "{});   // STALEPAGE: expect.user", 'P25');
      r = await run(browser, PHOTOS, { 'sheets.js': p25 });
      T('P25 rrVerifiedRowUpdate dropping expect.user → C1 catches it (page stays)', r.after && r.after.page === 'page-itemdetail', r.after || r);
    }
  } catch (e) {
    console.log('FAIL  crashed: ' + (e && e.stack || e)); fail++;
  } finally {
    await browser.close();
  }
  console.log((fail ? 'FAILED' : 'ALL PASS') + '  —  ' + suiteName + ': ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}
module.exports = { runSection, SECTIONS };
