#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// MY SETS IN THE TYPE LIST — 2026-11-22 mysetsfilter (real Chromium, the REAL app)
//
// [stated] Brad 2026-11-22: "why is sets separated like that, that should just
// be a filter not its own thing" → "it should be under types" → "what about
// under collections" → "yes" (PLAN_2026-11-22_MY_SETS_IN_TYPE_LIST.md).
// The title-row "🎁 My Sets (n)" button is gone; the Type list's "My
// Collection" section (beside Catalogs (all) / Paper Items) has a "Sets (n)"
// line that opens the SAME My Sets list (rrOpenMySets); the bucket "Set" line
// leaves My Collection's Type list (the Master Catalog's keeps it).
//
//   A  phone, real taps: My Collection → Filters → Filters → Type → under the
//      "My Collection" heading "Sets (5)" → the list (5 cards); the sheet
//      closes; the pill says "Sets"; device Back → My Collection in ONE step,
//      Back again → the Dashboard; no "Set (1)" line; no title-row button
//   B  computer: Type ▾ → Sets (5) → 5 rows; the pill "Sets ×"; × → the items;
//      Sets again, then Boxcar → the items, Boxcar pill; Sets again, Clear →
//      the items; a Show chip picked on the list → the items
//   C  one number: the Type line = the list's rows = the Total Sets card
//      (CARD_CATALOG 'sets'); the card still opens the list
//   D  with paper in the collection the Sets line sits INSIDE the existing
//      "My Collection" section (after Paper Items), one heading, not two
//   E  no sets: no Sets line and no heading added
//   G  picking rows to share: no Sets line
//   H  a set saved: the next Type list says one more
//   M  the Master Catalog's Type list: no Sets line, its Set bucket kept
//   S  source: words in config (typeLine / typeHead / typeId), the old door gone
//   P  PLANTED offenders — each must turn its check red
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  mysetsfilter_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const rd = f => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0, fail = 0;
function T(n, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + n + (ok ? '' : '  -> got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want)));
  ok ? pass++ : fail++;
}

const PHONE = { width: 390, height: 844 };
const DESK = { width: 1400, height: 900 };
const TYPES = { js: 'application/javascript', css: 'text/css', html: 'text/html' };
const QKEY = "q'7";                       // a key with a quote in it (the escaping, in the running app)
const QNAME = 'Club\'s "Big" Train';

async function open(browser, viewport, planted, opts) {
  opts = opts || {};
  const pg = await browser.newPage({ viewport });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    const clean = u.split('?')[0];
    const name = Object.keys(planted || {}).find(k => clean.endsWith('/' + k));
    if (name) return r.fulfill({ body: planted[name], contentType: TYPES[name.split('.').pop()] || 'text/plain' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(800);
  await pg.evaluate(([QKEY, QNAME, noSets, opts]) => {
    try { localStorage.clear(); } catch (e) {}
    state.masterData = [
      { itemNum: '2343', variation: '', itemType: 'Diesel Locomotive', _era: 'pw', _tab: 'Lionel PW - Items', description: 'F3 Diesel AA', roadName: 'Santa Fe' },
      { itemNum: '6464-1', variation: '', itemType: 'Boxcar', _era: 'pw', _tab: 'Lionel PW - Items', description: 'Boxcar', roadName: 'Western Pacific' },
    ];
    _rebuildMasterIndex();
    state.setData = [
      // the same number in another era's set list, FIRST — a number-only pick takes it
      { setNum: '1467W', setName: 'Wrong Era Set', year: '1955', gauge: 'HO', items: ['X1'], alts: [], notes: '', _era: 'mpc' },
      { setNum: '1467W', setName: 'Erie Alco Freight', year: '1955', gauge: 'O27', items: ['2343', '6464-1'], alts: [], notes: '', _era: 'pw' },
      { setNum: '2124W', setName: 'Passenger Set', year: '1950', gauge: 'O', items: ['2332'], alts: [], notes: '', _era: 'pw' },
      { setNum: '2503WS', setName: 'Five-Car Hudson Steam Freight', year: '1954', gauge: 'O', items: ['2055'], alts: [], notes: '', _era: 'pw' },
    ];
    state.personalData = {
      '101': { itemNum: '6464-1', variation: '', owned: true, inventoryId: '101', row: 5, era: 'pw', groupId: 'OWN-A', manufacturer: 'MTH' },
      '121': { itemNum: '2343', variation: '', owned: true, inventoryId: '121', row: 6, era: 'pw', groupId: 'SET-1467W-1' },
    };
    if (opts.setItem) {   // a set entered as ONE item (onesets): its catalog type is Set
      state.masterData.push({ itemNum: '1000W', variation: '', itemType: 'Set', _era: 'pw', _tab: 'Lionel PW - Items', description: 'Outfit Set', roadName: '' });
      _rebuildMasterIndex();
      state.personalData['131'] = { itemNum: '1000W', variation: '', owned: true, inventoryId: '131', row: 7, era: 'pw', itemType: 'Set', groupId: '' };
    }
    if (opts.paper) state.personalData['141'] = { itemNum: 'TO2338', variation: '', owned: true, inventoryId: '141', row: 8, era: 'pw', itemType: 'Paper Item', groupId: '' };
    state.mySetsData = noSets ? {} : {
      // the collector's own set (Brad's test: 30-4621 "TES DELEEME", Made by MTH)
      '201': { row: 40, setNum: '30-4621', setName: 'TES DELEEME', year: '', groupId: 'OWN-A', setId: 'OWN-SET', inventoryId: '201', manufacturer: 'MTH', condition: '7', estWorth: '1' },
      // a catalog set he owns (its piece is a Postwar 2343)
      '203': { row: 42, setNum: '1467W', setName: 'Erie Alco Freight', year: '1955', groupId: 'SET-1467W-1', setId: 'SET-1467W', inventoryId: '203' },
      // a second copy of it, saved with a year the catalog doesn't print
      '204': { row: 43, setNum: '1467W', setName: 'Erie Alco Freight', year: '1956', groupId: 'SET-1467W-2', setId: 'SET-1467W', inventoryId: '204' },
      // a key and a name with quotes in them
      [QKEY]: { row: 44, setNum: '', setName: QNAME, year: '1999', groupId: '', setId: 'OWN-SET', inventoryId: '205', manufacturer: 'Atlas' },
    };
    state.wantData = {}; state.upgradeData = {}; state.forSaleData = {}; state.soldData = {};
    state.personalSheetId = 'SHEET';
    _currentEra = 'all';
    window.showRefItemPopup = function (t, i) { window._popups = (window._popups || []).concat([[t, i]]); };
    window.appConfirm = async () => true;
    window.rrRemoveRowConfirmed = async () => true;
    window.buildDashboard = () => {};
    if (typeof populateFilters === 'function') { try { populateFilters(); } catch (e) {} }
    window.showToast = () => {};
    if (typeof _initBackButton === 'function') _initBackButton();   // the app's own Back handling, as at start-up
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
  }, [QKEY, QNAME, !!opts.noSets, opts]);
  return { pg, errs };
}


const sleep = (pg, ms) => pg.waitForTimeout(ms);
// What is on screen (visible = has a box).
const LOOK = `(() => {
  const vis = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const t = el => (el.textContent || '').replace(/\\s+/g, ' ').trim();
  const chips = document.getElementById('hierarchy-chips');
  return {
    active: (document.querySelector('.page.active') || {}).id || '',
    tab: state._browseTab,
    type: state.filters.type || '',
    panel: vis(document.getElementById('browse-sets-panel')),
    cards: [...document.querySelectorAll('#browse-sets-cards [data-my-set-card]')].filter(vis).length,
    rows: [...document.querySelectorAll('#browse-sets-tbody tr')].filter(vis).length,
    chips: chips ? t(chips) : '',
    door: !!document.getElementById('rr-mysets-door'),
    sheet: !!document.getElementById('rr-filter-sheet'),
    picker: !!document.getElementById('ph-picker-overlay'),
    titleText: t(document.querySelector('#page-browse > .page-title') || document.body),
    step: (history.state || {})._back || '',
  };
})()`;
const H = require('./lib/open-my-sets');   // the ONE way a test opens the Type list / My Sets
const clickTxt = H.tapText;
const lineN = list => { const l = (list || []).find(x => x.b && /^Sets \(\d+\)/.test(x.b)); return l ? +l.b.match(/\((\d+)\)/)[1] : -1; };
const headBefore = list => { const i = (list || []).findIndex(x => x.b && /^Sets \(\d+\)/.test(x.b)); if (i < 0) return ''; for (let j = i - 1; j >= 0; j--) if (list[j].h) return list[j].h; return ''; };
const heads = (list, h) => (list || []).filter(x => x.h === h).length;
const hasSetBucket = list => (list || []).some(x => x.b && /^Set( \(|$)/.test(x.b));
// Open the Type list the way the screen does (phone: Filters → Filters → Type).
async function openType(pg) { if (!(await H.openTypeList(pg))) return []; return H.readTypeList(pg); }
const pick = async (pg, re) => { const ok = await clickTxt(pg, '#ph-picker-overlay button', re); await sleep(pg, 450); return ok; };
const closePicker = H.closeLists;
const back = async pg => { await pg.evaluate(() => { if ((history.state || {}).appPage !== 'base') history.back(); }); await sleep(pg, 450); return pg.evaluate(LOOK); };

async function phoneWalk(browser, planted, part) {
  const { pg, errs } = await open(browser, PHONE, planted, { setItem: true });
  const R = { isPhone: await pg.evaluate(() => rrIsPhone()) };
  await pg.click('#mnav-dashboard'); await sleep(pg, 150);
  await pg.click('#mnav-collection'); await sleep(pg, 300);
  R.coll = await pg.evaluate(LOOK);
  R.list = await openType(pg);
  R.picked = await pick(pg, '^Sets \\(');
  R.open = await pg.evaluate(LOOK);
  if (part !== 'nolist') {
    R.back1 = await back(pg);
    R.back2 = await back(pg);
  }
  R.errs = errs; await pg.close(); return R;
}

async function deskWalk(browser, planted, opts) {
  const { pg, errs } = await open(browser, DESK, planted, Object.assign({ setItem: true }, opts || {}));
  const R = { isPhone: await pg.evaluate(() => rrIsPhone()) };
  await pg.click('.nav-item[onclick*="filterOwned"]'); await sleep(pg, 300);
  R.coll = await pg.evaluate(LOOK);
  R.list = await openType(pg);
  R.picked = await pick(pg, '^Sets \\(');
  R.open = await pg.evaluate(LOOK);
  R.card = await pg.evaluate(() => { const c = (typeof CARD_CATALOG !== 'undefined' ? CARD_CATALOG : []).find(x => x.id === 'sets'); return c ? { value: c.compute(state).value, onclick: c.onclick } : null; });
  R.listOpen = await openType(pg);           // the list again, from the "Sets" pill
  await closePicker(pg);
  // × on the pill → the items
  await clickTxt(pg, '#hierarchy-chips button[title="Clear this filter"]', '×'); await sleep(pg, 350);
  R.afterX = await pg.evaluate(LOOK);
  // Sets, then another Type → the items with that Type
  await openType(pg); await pick(pg, '^Sets \\(');
  await openType(pg); await pick(pg, '^Boxcar');
  R.afterBoxcar = await pg.evaluate(LOOK);
  await clickTxt(pg, '#hierarchy-chips button[title="Clear this filter"]', '×'); await sleep(pg, 300);
  // Sets, then Clear → the items
  await openType(pg); await pick(pg, '^Sets \\(');
  await clickTxt(pg, '#hierarchy-chips button.ph-clear', 'Clear'); await sleep(pg, 450);
  R.afterClear = await pg.evaluate(LOOK);
  // Sets, then a Show chip (as the computer's Show row would) → the items
  await openType(pg); await pick(pg, '^Sets \\(');
  await pg.evaluate(() => _collSectionSet('trains')); await sleep(pg, 300);
  R.afterChip = await pg.evaluate(LOOK);
  // the Total Sets card's door, from the Dashboard
  await pg.evaluate(() => showPage('dashboard')); await sleep(pg, 200);
  await pg.evaluate(() => rrOpenMySets()); await sleep(pg, 350);
  R.fromCard = await pg.evaluate(LOOK);
  // H — a set saved: the next Type list says one more
  await pg.evaluate(() => { renderBrowseTab('items'); state.mySetsData['301'] = { row: 50, setNum: '', setName: 'Saved Now', year: '', groupId: '', setId: 'OWN-SET', inventoryId: '301' }; renderBrowse(); }); await sleep(pg, 250);
  R.listSaved = await openType(pg); await closePicker(pg);
  // G — picking rows to share: no Sets line
  await pg.evaluate(() => startShareMode('collection')); await sleep(pg, 250);
  R.listShare = await openType(pg); await closePicker(pg);
  await pg.evaluate(() => cancelShareMode()); await sleep(pg, 200);
  // M — the Master Catalog's Type list
  await pg.click('.nav-item[onclick*="resetFilters"]'); await sleep(pg, 300);
  R.master = await pg.evaluate(LOOK);
  R.masterList = await pg.evaluate(() => { _openLevelPicker('type'); return null; }).then(() => H.readTypeList(pg));
  await closePicker(pg);
  R.errs = errs; await pg.close(); return R;
}

async function quickList(browser, planted, opts) {
  const { pg, errs } = await open(browser, DESK, planted, opts);
  await pg.click('.nav-item[onclick*="filterOwned"]'); await sleep(pg, 300);
  const R = { list: await openType(pg) };
  R.errs = errs; await pg.close(); return R;
}

function pool(n) {
  let live = 0; const q = [];
  const next = () => { if (live >= n || !q.length) return; live++; const [fn, ok, bad] = q.shift(); fn().then(ok, bad).finally(() => { live--; next(); }); };
  return fn => new Promise((ok, bad) => { q.push([fn, ok, bad]); next(); });
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const B = rd('browse.js'), CFG = rd('config.js'), DASH = rd('dashboard.js');
  const run = pool(5);
  try {
    const pA = run(() => phoneWalk(browser)), pB = run(() => deskWalk(browser)),
      pD = run(() => quickList(browser, null, { setItem: true, paper: true })), pE = run(() => quickList(browser, null, { noSets: true }));
    // ── A — the phone ─────────────────────────────────────────────────
    const A = await pA;
    T('setup: the page is a phone', A.isPhone, true);
    T('A1 phone: no "My Sets" button on the title row', [A.coll.door, /My Sets/.test(A.coll.titleText)], [false, false]);
    T('A2 phone: Filters → Type lists "Sets (5)" under the "My Collection" heading', [lineN(A.list), headBefore(A.list)], [5, 'My Collection']);
    T('A3 phone: no "Set (1)" bucket line in My Collection\'s Type list', hasSetBucket(A.list), false);
    T('A4 phone: picking it opens the My Sets list — 5 cards', [A.picked, A.open.tab, A.open.panel, A.open.cards], [true, 'sets', true, 5]);
    T('A5 phone: the Filters sheet and the Type list close', [A.open.sheet, A.open.picker], [false, false]);
    T('A6 the pill says "Sets" while the list is on screen', /Sets×/.test(A.open.chips), true);
    T('A6b the top Back step is My Sets\' own (not the closed Filters sheet\'s or Type list\'s)', A.open.step, 'my-sets-list');
    T('A7 phone: device Back → My Collection in one step', [A.back1.active, A.back1.tab, A.back1.panel], ['page-browse', 'items', false]);
    T('A8 phone: Back again → the Dashboard', A.back2.active, 'page-dashboard');
    T('no page errors (phone)', A.errs, []);

    // ── B / C / G / H / M — the computer ─────────────────────────────
    const R = await pB;
    T('setup: the page is a computer', R.isPhone, false);
    T('B1 computer: no "My Sets" button on the title row', [R.coll.door, /My Sets/.test(R.coll.titleText)], [false, false]);
    T('B2 computer: Type ▾ lists "Sets (5)" under "My Collection", no "Set" bucket line', [lineN(R.list), headBefore(R.list), hasSetBucket(R.list)], [5, 'My Collection', false]);
    T('B3 computer: picking it opens the list — 5 rows, pill "Sets"', [R.picked, R.open.tab, R.open.panel, R.open.rows, /Sets×/.test(R.open.chips)], [true, 'sets', true, 5, true]);
    T('B3b computer: the top Back step is My Sets\' own (not the closed Type list\'s)', R.open.step, 'my-sets-list');
    T('B4 the Type list opened from the "Sets" pill marks Sets as the pick', R.listOpen.some(x => x.b && /^Sets \(5\)\s+✓$/.test(x.b)), true);
    T('B5 the pill\'s × → the item list, no Type', [R.afterX.tab, R.afterX.panel, R.afterX.type, /Sets×/.test(R.afterX.chips)], ['items', false, '', false]);
    T('B6 another Type picked on the list → the items, filtered by it', [R.afterBoxcar.tab, R.afterBoxcar.panel, R.afterBoxcar.type, /Boxcar/.test(R.afterBoxcar.chips)], ['items', false, 'Boxcar', true]);
    T('B7 Clear on the list → the items, pill gone', [R.afterClear.tab, R.afterClear.panel, /Sets×/.test(R.afterClear.chips)], ['items', false, false]);
    T('B8 a Show chip picked on the list → the items', [R.afterChip.tab, R.afterChip.panel], ['items', false]);
    T('C1 one number: the Type line = the list\'s rows = the Total Sets card', [lineN(R.list), R.open.rows, R.card && R.card.value], [5, 5, '5']);
    T('C2 the Total Sets card still opens the list', [R.card && R.card.onclick, R.fromCard.active, R.fromCard.tab, R.fromCard.panel, /Sets×/.test(R.fromCard.chips)], ['rrOpenMySets()', 'page-browse', 'sets', true, true]);
    T('H1 a set saved: the next Type list says "Sets (6)"', lineN(R.listSaved), 6);
    T('G1 picking rows to share: no Sets line', lineN(R.listShare), -1);
    T('M1 Master Catalog: no Sets line in its Type list', lineN(R.masterList), -1);
    T('M2 Master Catalog: its Set bucket is still offered', hasSetBucket(R.masterList), true);
    T('no page errors (computer)', R.errs, []);

    // ── D / E ─────────────────────────────────────────────────────────
    const D = await pD;
    T('D1 with paper: ONE "My Collection" heading, Paper Items then Sets (5) inside it', [heads(D.list, 'My Collection'), headBefore(D.list), lineN(D.list),
      D.list.findIndex(x => x.b && /Paper Items/.test(x.b)) >= 0 && D.list.findIndex(x => x.b && /Paper Items/.test(x.b)) < D.list.findIndex(x => x.b && /^Sets \(/.test(x.b))], [1, 'My Collection', 5, true]);
    T('no page errors (paper)', D.errs, []);
    const E = await pE;
    T('E1 no sets: no Sets line and no "My Collection" heading added', [lineN(E.list), heads(E.list, 'My Collection')], [-1, 0]);

    // ── S — source ────────────────────────────────────────────────────
    const words = CFG.slice(CFG.indexOf('const RR_OWN_SETS = {'), CFG.indexOf('window.RR_OWN_SETS = RR_OWN_SETS'));
    T('S1 the words live in config.js RR_OWN_SETS (typeLine "Sets", typeHead, typeId) and none says "AI"',
      [/typeLine:\s+'Sets'/.test(words), /typeHead:\s+'My Collection'/.test(words), /typeId:\s+'__rr_my_sets__'/.test(words), /\bAI\b/.test(words)], [true, true, true, false]);
    T('S2 the old door is gone (no door words, no _rrMySetsDoorSync, no #rr-mysets-door)', [/\bdoor:\s/.test(words), /_rrMySetsDoorSync/.test(B), /rr-mysets-door/.test(B)], [false, false, false]);
    T('S3 the line\'s number is rrMySetsCount() and the card\'s too', [/const n = rrMySetsCount\(\);/.test(B), /rrMySetsCount\(\)/.test(DASH)], [true, true]);

    // ── P — planted offenders ─────────────────────────────────────────
    const plant = (src, from, to, label) => { const out = src.replace(from, to); T('P  plant applied (' + label + ')', out !== src, true); return out; };
    const noLine = plant(B, "  if (level === 'type') options = _rrMySetsTypeOptions(options);", '', 'no Sets line');
    const P1p = run(() => phoneWalk(browser, { 'browse.js': noLine }, 'nolist'));
    const keepSet = plant(B, "if (state.filters.owned && o.value === _RR_SET_BUCKET && (state.filters.type || '') !== _RR_SET_BUCKET) continue;", '', 'Set bucket kept');
    const P2p = run(() => quickList(browser, { 'browse.js': keepSet }, { setItem: true }));
    const syncOpen = plant(B, "      setTimeout(function () {\n        rrOpenMySets();\n        if (typeof _renderHierarchyChips === 'function') _renderHierarchyChips();\n      }, 0);", "      rrOpenMySets();", 'opened before the pop-ups close');
    const P3p = run(() => phoneWalk(browser, { 'browse.js': syncOpen }));
    const P3dp = run(() => deskWalk(browser, { 'browse.js': syncOpen }));
    const noPill = plant(B, "if (_phOwned && state._browseTab === 'sets') { onCount++;", "if (false) { onCount++;", 'no Sets pill');
    const P4p = run(() => phoneWalk(browser, { 'browse.js': noPill }, 'nolist'));
    const stay = plant(B, "if (_leaveSets && typeof renderBrowseTab === 'function') renderBrowseTab('items');   // mysetsfilter: off the My Sets list, onto the items\n        else if", "if", 'a pick stays on the list');
    const P5p = run(() => deskWalk(browser, { 'browse.js': stay }));
    const noHead = plant(B, "options.splice(at, 0, { id: '__divider', label: RR_OWN_SETS.typeHead, divider: true }, line);", 'options.splice(at, 0, line);', 'no heading added');
    const P6p = run(() => quickList(browser, { 'browse.js': noHead }, { setItem: true }));
    const shareLine = plant(B, "    if (picking) return options;\n    const n = rrMySetsCount();", "    const n = rrMySetsCount();", 'line while sharing');
    const P7p = run(() => deskWalk(browser, { 'browse.js': shareLine }));
    const rowsOnly = plant(B, "    const n = rrMySetsCount();\n    if (!(n > 0)) return options;", "    const n = Object.keys(state.mySetsData || {}).length;\n    if (!(n > 0)) return options;", 'a second count');
    const P8p = run(() => deskWalk(browser, { 'browse.js': rowsOnly }));
    const clearStays = plant(B, "  if (state.filters && state.filters.owned && state._browseTab === 'sets' && typeof renderBrowseTab === 'function') renderBrowseTab('items');\n  var st = _phState();", "  var st = _phState();", 'Clear stays on the list');
    const P9p = run(() => deskWalk(browser, { 'browse.js': clearStays }));
    const P1 = await P1p;
    T('P1 no Sets line is caught (A2 red)', lineN(P1.list) === 5, false);
    T('P1 …and the list is never reached (A4 red)', P1.open.tab === 'sets', false);
    const P2 = await P2p;
    T('P2 the Set bucket left in My Collection\'s list is caught (A3/B2 red)', hasSetBucket(P2.list), true);
    const P3 = await P3p;
    T('P3 the list opened under the closing pop-ups is caught (A6b red: the step wears the sheet\'s name)', P3.open.step === 'my-sets-list', false);
    const P3d = await P3dp;
    T('P3 …and on the computer (B3b red: the step wears the Type list\'s name)', P3d.open.step === 'my-sets-list', false);
    const P4 = await P4p;
    T('P4 no "Sets" pill on the list is caught (A6 red)', /Sets×/.test(P4.open.chips), false);
    const P5 = await P5p;
    T('P5 a Type pick that stays on the list is caught (B5/B6 red)', P5.afterX.tab === 'items' && P5.afterBoxcar.tab === 'items', false);
    const P6 = await P6p;
    T('P6 a Sets line with no heading is caught (B2/A2 red)', headBefore(P6.list) === 'My Collection', false);
    const P7 = await P7p;
    T('P7 a Sets line while sharing is caught (G1 red)', lineN(P7.listShare) === -1, false);
    const P8 = await P8p;
    T('P8 a second count (rows alone) is caught (C1 red)', lineN(P8.list) === P8.open.rows, false);
    const P9 = await P9p;
    T('P9 Clear that stays on the list is caught (B7 red)', P9.afterClear.tab === 'items', false);
  } catch (e) {
    console.log('FAIL  the run threw: ' + (e && e.stack || e)); fail++;
  } finally { await browser.close(); }
  console.log((fail ? 'FAILED' : 'ALL PASS') + '  —  mysetsfilter_tests: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
