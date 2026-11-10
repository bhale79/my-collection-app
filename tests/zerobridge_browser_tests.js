#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// zerobridge_browser_tests.js — 2026-11-08/09 (real Chromium, the REAL app)
//
// [stated] Brad 20:17 CT "yes" (PLAN_2026-11-08_LIONEL_STANDARD_MODERN, Q7 /
// Q8): a saved copy of a reference-book row the master deletes lands on the row
// that keeps its train — MTH's -0 (else -1) — and the collector can switch with
// Change catalog entry. Each keeper is the delete record's own re-point, by Row
// ID (RR_BOOK_COPY_REDIRECT, config.js), read by findMaster through
// rrBookCopyRedirect (app-data.js); all 440 Write-2 copies are proven in
// zerobridge_tests.js. This file proves the REAL app wires it.
//
// Stand-in catalog (real rows, real Row IDs): MTH Tinplate 11-1005-0 / -1, MTH
// Tinplate 11-1038-1 (MTH has no -0), a Lionel modern row (the rest of that
// catalog), Atlas O 1304-1. Saved copies whose rows the master deletes: the
// Lionel MPC-Modern book copy 11-1005 (MRBYH6C8FF -> CU89458CGD) and the MTH
// Tinplate Greenberg copy 11-1038 (75Z5N8MR52 -> 7CR22SR954); and an Atlas copy
// 1304 whose row is gone (not in the table).
//   A  computer: each copy's catalog row (rrCopyRow -> findMaster) and My
//      Collection reads each copy with its keeper's words; the Atlas copy none
//   R  the Row ID back-fill: the keeper's Row ID written onto each copy -> the
//      same keeper, and My Collection the same
//   B  the whole catalog still loading: each copy is on its keeper already (no flicker)
//   C  phone (390x844): the same answer as the computer
//   P  PLANTED offenders — each check goes red on a copy without the rule
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  zerobridge_browser_tests needs playwright and it is not installed.'); process.exit(1); }
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

const CATALOG = [
  { itemNum: '11-1005-0', itemType: 'Steam Locomotive', _era: 'mth_tinplate', _tab: 'MTH Tinplate', description: 'No. 390E Locomotive (Traditional)', yearProd: '2004', gauge: 'Standard', alsoSoldAs: 'Lionel Corporation', rowId: 'CU89458CGD' },
  { itemNum: '11-1005-1', itemType: 'Steam Locomotive', _era: 'mth_tinplate', _tab: 'MTH Tinplate', description: 'No. 390E Locomotive with Proto-Sound', yearProd: '2007', gauge: 'Standard', alsoSoldAs: 'Lionel Corporation', rowId: 'N4KMFHZKYP' },
  { itemNum: '11-1038-1', itemType: 'Steam Locomotive', _era: 'mth_tinplate', _tab: 'MTH Tinplate', description: 'No. 400E Locomotive with Proto-Sound 3.0', yearProd: '2005', gauge: 'Standard', alsoSoldAs: 'Lionel Corporation', rowId: '7CR22SR954' },
  { itemNum: '13100', itemType: 'Steam Locomotive', _era: 'mpc', _tab: 'Lionel MPC-Modern', description: '390E 2-4-2 Locomotive', yearProd: '1988', gauge: 'Standard', rowId: 'LIONEL1310' },
  { itemNum: '1304-1', itemType: 'Boxcar', _era: 'atlas', _tab: 'Atlas O', description: 'Trainman 40ft Boxcar', yearProd: '2002', gauge: 'O', rowId: 'ATLAS13041' },
];
const COPIES = {
  '601': { itemNum: '11-1005', variation: '', owned: true, inventoryId: '601', era: 'mpc', manufacturer: 'Lionel', masterKey: 'mpc|11-1005|', masterRowId: 'MRBYH6C8FF', row: 5 },
  '602': { itemNum: '11-1038', variation: '', owned: true, inventoryId: '602', era: 'mth_tinplate', manufacturer: 'MTH', masterKey: 'mth_tinplate|11-1038|', masterRowId: '75Z5N8MR52', row: 6 },
  '603': { itemNum: '1304', variation: '', owned: true, inventoryId: '603', era: 'atlas', manufacturer: 'Atlas', masterKey: 'atlas|1304|', masterRowId: 'GONEATLAS1', row: 7 },
};

async function open(browser, viewport, planted, whole) {
  const pg = await browser.newPage({ viewport });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    const clean = u.split('?')[0];
    const name = Object.keys(planted || {}).find(k => clean.endsWith('/' + k));
    if (name) return r.fulfill({ body: planted[name], contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(800);
  await pg.evaluate(([cat, copies, whole]) => {
    localStorage.clear();
    state.masterData = cat.map(r => Object.assign({ variation: '' }, r));
    _rebuildMasterIndex();
    // the whole-catalog index (Layer 2) — here the same rows — and its "complete" signal
    state.masterByItemAll = state.masterByItem; state.masterAllRows = state.masterData;
    state.masterByRowIdAll = state.masterByRowId;
    _allIdxComplete = !!whole;
    state.personalData = JSON.parse(JSON.stringify(copies));
    state.scienceData = {}; state.constructionData = {};
    state.wantData = {}; state.upgradeData = {}; state.forSaleData = {}; state.soldData = {};
    _currentEra = 'all';
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
  }, [CATALOG, COPIES, whole]);
  return { pg, errs };
}

// My Collection under these chips: the words of every owned row / card. A copy
// whose number has no row of its own is drawn as its own entry (rrPersonalOnlyRow,
// browse.js), its description read from the row findMaster gives it.
const LIST = `((ch) => {
  localStorage.setItem('lv_browse_filter_state', JSON.stringify(ch));
  showPage('browse'); state.filters.owned = true; state.filters.search = ''; renderBrowse();
  return [...document.querySelectorAll('#browse-tbody tr, #browse-cards .browse-card')].map(el => el.textContent.replace(/\\s+/g, ' ').trim());
})`;

const ROWS_NOW = `(() => Object.keys(state.personalData).map(k => { const m = rrCopyRow(state.personalData[k]); return k + ':' + (m ? m.itemNum : '-'); }))()`;
async function scenario(browser, viewport, planted, whole) {
  const { pg, errs } = await open(browser, viewport, planted, whole === undefined ? true : whole);
  const R = {};
  const L = async ch => pg.evaluate(LIST + '(' + JSON.stringify(ch) + ')');
  const read = async () => {
    const list = [].concat(await L({ manufacturer: 'lionel', scale: 'any', era: 'any' }), await L({ manufacturer: 'mth', scale: 'any', era: 'any' }),
      await L({ manufacturer: 'atlas', scale: 'any', era: 'any' })).join(' | ');
    // the computer's list shows the row's description; the phone's card its type and year
    const has = (desc, card) => list.indexOf(desc) >= 0 || list.indexOf(card) >= 0;
    return {
      zero: has('No. 390E Locomotive (Traditional)', '11-1005 Steam · 2004'),         // 11-1005-0
      one: has('No. 390E Locomotive with Proto-Sound', '11-1005 Steam · 2007'),       // 11-1005-1 — never
      only1: has('No. 400E Locomotive with Proto-Sound 3.0', '11-1038 Steam · 2005'), // 11-1038-1
      atlas: has('Trainman 40ft Boxcar', '1304 Boxcar'),                              // Atlas 1304-1 — never
    };
  };
  R.row = await pg.evaluate(ROWS_NOW);
  R.words = await read();
  // the Row ID back-fill (_backfillMasterRowIds): the row findMaster gives, through
  // the variation link rule, written onto the copy as its Master Row ID
  R.wrote = await pg.evaluate(() => Object.keys(state.personalData).map(k => {
    const p = state.personalData[k]; let m = findMaster(p.itemNum, p.variation || '', p);
    if (m && typeof rrRowForVariation === 'function') m = rrRowForVariation(m, p.itemNum, p.variation || '');
    const id = m ? rrMasterRowIdOf(m) : '';
    if (id) p.masterRowId = id;
    return k + ':' + (id || '-');
  }));
  R.rowAfter = await pg.evaluate(ROWS_NOW);
  R.wordsAfter = await read();
  R.errs = errs;
  await pg.close();
  return R;
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  try {
    const A = await scenario(browser, DESK);
    T('A  each saved copy\'s row: Lionel 11-1005 -> 11-1005-0, MTH 11-1038 -> 11-1038-1, Atlas 1304 -> none', A.row, ['601:11-1005-0', '602:11-1038-1', '603:-']);
    T('A  My Collection: the Lionel copy reads as 11-1005-0, the MTH copy as 11-1038-1; never 11-1005-1, never the Atlas 1304-1',
      A.words, { zero: true, one: false, only1: true, atlas: false });
    T('R  the Row ID back-fill writes each keeper\'s Row ID', A.wrote, ['601:CU89458CGD', '602:7CR22SR954', '603:-']);
    T('R  …and each copy stays on its keeper afterwards', [A.rowAfter, A.wordsAfter], [A.row, A.words]);
    T('no page errors (computer)', A.errs, []);
    const B = await scenario(browser, DESK, null, false);
    T('B  the whole catalog still loading: each copy is on its keeper already', B.row, ['601:11-1005-0', '602:11-1038-1', '603:-']);
    T('B  …My Collection reads each keeper meanwhile', [B.words.zero, B.words.only1], [true, true]);
    const C = await scenario(browser, PHONE);
    T('C  phone: the same rows, words and back-fill as the computer', [C.row, C.words, C.rowAfter], [A.row, A.words, A.rowAfter]);
    T('no page errors (phone)', C.errs, []);

    const DAT = rd('app-data.js'), CFG = rd('config.js');
    // P1 — findMaster never asks the table
    const noTable = DAT.split('    if (_bcK) return _bcK;\n').join('');
    T('P1 plant applied (findMaster never asks the table)', noTable !== DAT, true);
    const P1 = await scenario(browser, DESK, { 'app-data.js': noTable });
    T('P1 caught: no copy reaches its keeper', P1.row, ['601:-', '602:-', '603:-']);
    T('P1 caught: My Collection reads neither keeper', [P1.words.zero, P1.words.only1], [false, false]);
    // P2 — the table names the -1 for 11-1005
    const swapped = CFG.split("    'MRBYH6C8FF': ['mpc', '11-1005', '', 'CU89458CGD', '11-1005-0'],").join("    'MRBYH6C8FF': ['mpc', '11-1005', '', 'N4KMFHZKYP', '11-1005-1'],");
    T('P2 plant applied (config.js names the -1 as 11-1005\'s keeper)', swapped !== CFG, true);
    const P2 = await scenario(browser, DESK, { 'config.js': swapped });
    T('P2 caught: the Lionel copy is drawn on 11-1005-1', P2.row[0], '601:11-1005-1');
    T('P2 caught: My Collection reads the Lionel copy as 11-1005-1', [P2.words.one, P2.words.zero], [true, false]);
    // P3 — the back-filled pair refused by _rrRowIdFits
    const noPair = DAT.split("    return (typeof _rrBookCopyPairFits === 'function') && _rrBookCopyPairFits(row, _in, variation);\n").join('    return false;\n');
    T('P3 plant applied (_rrRowIdFits refuses the table\'s pairs)', noPair !== DAT, true);
    const P3 = await scenario(browser, DESK, { 'app-data.js': noPair });
    T('P3 caught: after the back-fill the copies are stranded', P3.rowAfter, ['601:-', '602:-', '603:-']);
    // P4 — a redirect that waits for the whole catalog (the start-up flicker)
    const waits = DAT.split("    if (rrMasterByRowId(id)) return null;                                    // the row is still there\n").join("    if (typeof rrCatalogIndexStatus === 'function' && !rrCatalogIndexStatus().complete) return null;\n    if (rrMasterByRowId(id)) return null;                                    // the row is still there\n");
    T('P4 plant applied (the redirect waits for the whole catalog)', waits !== DAT, true);
    const P4 = await scenario(browser, DESK, { 'app-data.js': waits }, false);
    T('P4 caught: while the catalog loads the copies find nothing', P4.row, ['601:-', '602:-', '603:-']);
    // PC — phone, without the table
    const PC = await scenario(browser, PHONE, { 'app-data.js': noTable });
    T('PC caught: phone, no copy reaches its keeper without the table', PC.row, ['601:-', '602:-', '603:-']);
  } catch (e) {
    console.log('FAIL  crashed: ' + (e && e.stack || e)); fail++;
  } finally {
    await browser.close();
  }
  console.log((fail ? 'FAILED' : 'ALL PASS') + '  —  zerobridge_browser_tests: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
