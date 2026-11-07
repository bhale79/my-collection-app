#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// set_maker_tests.js — 2026-11-07 (maintenance chat; real Chromium, the REAL
// app, stand-in Google writes)
//
// A set you build yourself said "Made by" whatever its FIRST piece's maker was:
// an MTH set with a Lionel car in front read "Made by Lionel" (found while
// shooting the Sets & Grouping Guide, 2026-11-04). [stated] Brad 2026-11-07
// "Yes" to PLAN_2026-11-07_SET_MAKER.md → "Yes" to building it.
//
//   M  THE rule (rrMySetMaker): the maker saved on the set (My Sets column O)
//      first; a set saved before (O blank) and a catalog set still answer with
//      their pieces' maker — exactly as before.
//   W  the save: "My set isn't listed" writes 15 cells, O = the maker chosen
//      (the full walk's writer is checked in own_sets_finish_road_tests A8/C2);
//      a catalog set leaves O blank.
//   D  every place that shows it: the set's page ("Made by MTH"), the Sets
//      list's line, its search ("mth" finds it).
//   E  Edit: a set you built gets a "Made by" box (the Add form's maker list);
//      picking Atlas O writes A:O on THAT set's row — O = Atlas O; a catalog set
//      gets no box.
//   R  Remove blanks A:O — nothing left behind.
//   H  the start-up header repair stamps A2:O2 with "Manufacturer" last; the
//      reader takes A3:O and keeps O as the set's maker.
//   P  PLANTED: the rule back on "first piece" → M/D red; the save back to 14
//      cells → W red; Edit back on A:N → E red; the reader back on A3:N → H red.
//
// Run:  node tests/set_maker_tests.js
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  set_maker_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 900))); cond ? pass++ : fail++; }
function plant(src, a, b) { if (src.indexOf(a) < 0) throw new Error('plant target not found: ' + a.slice(0, 90)); return src.replace(a, b); }

const ROWS = [
  { itemNum: '30-4000-1', variation: '', itemType: 'Boxcar', description: 'MTH boxcar', _era: 'mth_o', _tab: 'MTH O', gauge: 'O', rowId: 'MTH4000', manufacturer: 'MTH' },
  { itemNum: '6464-1', variation: '', itemType: 'Boxcar', description: 'Western Pacific Boxcar', roadName: 'Western Pacific', _era: 'pw', _tab: 'Lionel PW - Items', gauge: 'O', rowId: 'PW64641' },
  { itemNum: '2343', variation: '', itemType: 'Diesel Locomotive', description: 'Santa Fe F3', roadName: 'Santa Fe', _era: 'pw', _tab: 'Lionel PW - Items', gauge: 'O', rowId: 'PW2343' },
];
const SETS = [ { setNum: '1467W', setName: 'Freight Set', year: '1955', gauge: 'O27', items: ['2343'], alts: [], _era: 'pw' } ];

async function open(browser, swap) {
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 900 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await ctx.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://') && !u.startsWith('about:')) return r.abort();
    const name = u.split('?')[0].split('/').pop();
    if (swap && swap[name] != null) return r.fulfill({ body: swap[name], contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(700);
  return { ctx, pg, errs };
}

const walk = (pg) => pg.evaluate(async ([ROWS, SETS]) => {
  const R = {};
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  state.masterData = ROWS.map(r => Object.assign({}, r)); state.setData = SETS.map(s => Object.assign({}, s));
  _rebuildMasterIndex();
  state.personalSheetId = 'SHEET'; _currentEra = 'all';
  state.user = { name: 'Brad', email: 'brad@example.com' };
  try { localStorage.clear(); } catch (e) {}
  const appended = [], updates = [];
  window.sheetsAppend = async (id, range, rows) => { appended.push([range, rows[0]]); return 300 + appended.length; };
  window.sheetsUpdate = async (id, range, rows) => { updates.push([range, rows[0]]); return {}; };
  window.rrVerifiedRowUpdate = async (id, tab, row, range, values) => { updates.push([range, values[0]]); return true; };
  window.rrArchiveRowBeforeRemoval = async () => true; window.rrRowStillIs = async () => true;
  window.rrWhereIsRow = async (sid, tab, row) => ({ ok: true, row: row });
  window.driveEnsureSetup = async () => {}; window.buildDashboard = () => {}; window.loadPersonalData = async () => {};
  window.appConfirm = async () => true;
  const toasts = []; window.showToast = (m) => { toasts.push(String(m)); };
  var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
  document.getElementById('app').classList.add('active');

  // ── M · the rule, on Brad's shape: an MTH set whose FIRST piece is a Lionel car ──
  const copy = (inv, num, maker, gid, row) => ({ itemNum: num, variation: '', owned: true, inventoryId: String(inv), row: row || inv, manufacturer: maker, groupId: gid, era: maker === 'Lionel' ? 'pw' : 'mth_o' });
  state.personalData = {
    '101': copy(101, '6464-1', 'Lionel', 'OWN-A'), '102': copy(102, '30-4000-1', 'MTH', 'OWN-A'),
    '111': copy(111, '6464-1', 'Lionel', 'OWN-OLD'), '112': copy(112, '30-4000-1', 'MTH', 'OWN-OLD'),
    '121': copy(121, '2343', 'Lionel', 'SET-1467W-1'),
  };
  state.mySetsData = {
    '201': { row: 40, setNum: '', setName: 'My MTH Freight', year: '2004', groupId: 'OWN-A', setId: 'OWN-SET', inventoryId: '201', manufacturer: 'MTH' },
    '202': { row: 41, setNum: '', setName: 'Grandpa’s set', year: '', groupId: 'OWN-OLD', setId: 'OWN-SET', inventoryId: '202', manufacturer: '' },   // saved before column O
    '203': { row: 42, setNum: '1467W', setName: 'Freight Set', year: '1955', groupId: 'SET-1467W-1', setId: 'SET-1467W', inventoryId: '203', manufacturer: '' },
  };
  R.firstPiece = rrMySetItems(state.mySetsData['201'])[0].manufacturer;
  R.mine = rrMySetMaker(state.mySetsData['201']);
  R.older = rrMySetMaker(state.mySetsData['202']);
  R.catalog = rrMySetMaker(state.mySetsData['203']);

  // ── D · the set's page, the Sets list and its search ──
  state.filters.owned = true; state._browseTab = 'sets';
  try { renderSetsTab(); } catch (e) { R.lErr = e.message; }
  const tb = document.getElementById('browse-sets-tbody');
  const mineTr = tb ? Array.from(tb.querySelectorAll('tr[data-own-set-key]')).find(t => /My MTH Freight/.test(t.textContent)) : null;
  R.listLine = mineTr ? mineTr.textContent.replace(/\s+/g, ' ') : '';
  try { showNonItemDetailPage('sets', '201'); await sleep(300); } catch (e) { R.pErr = e.message; }
  R.page = (document.querySelector('.page.active') || document.body).textContent.replace(/\s+/g, ' ');
  R.madeBy = /Made by\s*MTH(?![a-z])/.test(R.page) ? 'MTH' : (/Made by\s*Lionel/.test(R.page) ? 'Lionel' : '?');
  // the search the Sets list runs (browse.js): the same words it matches on
  R.searchHit = [state.mySetsData['201'].setNum, state.mySetsData['201'].setName, state.mySetsData['201'].year, rrMySetMaker(state.mySetsData['201'])].join(' ').toLowerCase().includes('mth');

  // ── W · "My set isn't listed" quick save: 15 cells, O = the maker chosen ──
  appended.length = 0;
  wizard.data = { _ownSet: true, _ownSetName: 'Club Train', _ownSetNum: '', _ownSetYear: '2010', _ownSetMaker: 'MTH', _setFinalItems: ['30-4000-1'], set_hasBox: 'No', tab: 'collection' };
  try { await _quickEntrySaveSet(7, '150', {}); } catch (e) { R.wErr = e.message; }
  await sleep(100);
  const wms = appended.find(a => /My Sets/.test(a[0]));
  R.wRow = wms ? wms[1] : null;
  const wRec = Object.values(state.mySetsData).find(m => m.setName === 'Club Train');
  R.wRec = wRec ? rrMySetMaker(wRec) + '|' + (wRec.manufacturer || '') : '';
  // a catalog set: O blank
  appended.length = 0;
  wizard.data = { _resolvedSet: SETS[0], _setFinalItems: ['2343'], set_hasBox: 'No', tab: 'collection' };
  try { await _quickEntrySaveSet(7, '100', {}); } catch (e) { R.cErr = e.message; }
  await sleep(100);
  const cms = appended.find(a => /My Sets/.test(a[0]));
  R.cRow = cms ? cms[1] : null;
  try { if (typeof _doCloseWizard === 'function') _doCloseWizard(); } catch (e) {}

  // ── E · Edit: a "Made by" box on an own set; picking Atlas writes A:O on its row ──
  const findMadeBy = () => {
    const lbl = Array.from(document.querySelectorAll('label')).filter(l => /^Made by/.test(l.textContent.trim())).pop();
    return lbl ? lbl.parentElement.querySelector('select') : null;
  };
  const cancel = () => document.querySelectorAll('button').forEach(b => { if (b.textContent === 'Cancel') b.click(); });
  _nonItemDetailEdit('sets', '202'); await sleep(200);
  const sel = findMadeBy();
  R.eOptions = sel ? Array.from(sel.options).map(o => o.value).filter(Boolean) : [];
  if (sel) { sel.value = 'Atlas O'; sel.dispatchEvent(new Event('change', { bubbles: true })); }
  updates.length = 0;
  const save = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Save Changes');
  if (save) save.click(); await sleep(400);
  R.eWrite = updates[0] || null;
  R.eAfter = rrMySetMaker(state.mySetsData['202']);
  cancel();
  _nonItemDetailEdit('sets', '203'); await sleep(200);
  R.eCatalogBox = !!findMadeBy();
  cancel();

  // ── R · Remove blanks A:O ──
  updates.length = 0;
  try { await _removeOwnedSet('201'); } catch (e) { R.rErr = e.message; }
  await sleep(200);
  R.rWrite = updates.find(u => /My Sets/.test(u[0])) || null;

  // ── H · the start-up header repair ──
  const stamps = [];
  window.sheetsSetupUpdate = async (id, range, values) => { stamps.push([range, values[0]]); return {}; };
  const realFetch = window.fetch;
  window.fetch = async () => ({ ok: true, json: async () => ({ sheets: ['Instruction Sheets', 'Science Sets', 'Construction Sets', 'My Sets'].map(t => ({ properties: { title: t } })) }) });
  try { _ensureEphemDone = false; await ensureEphemeraSheets('SHEET'); } catch (e) { R.hErr = e.message; }
  window.fetch = realFetch;
  R.hStamp = stamps.find(s => /^My Sets!A2/.test(s[0])) || null;
  return R;
}, [ROWS, SETS]);

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  try {
    const w = await open(browser);
    const r = await walk(w.pg);

    console.log('\n== M · the rule ==');
    T('M0 Brad\'s shape: the MTH set\'s first piece is the Lionel 6464-1', r.firstPiece === 'Lionel', r.firstPiece);
    T('M1 the set says "MTH" — the maker saved on it, not its first piece', r.mine === 'MTH', r.mine);
    T('M2 a set saved before (no maker on it) still answers with its first piece, exactly as before', r.older === 'Lionel', r.older);
    T('M3 a catalog set (Lionel 1467W) answers with its pieces, as before', r.catalog === 'Lionel', r.catalog);

    console.log('\n== D · every place that shows it ==');
    T('D1 the set\'s page reads "Made by MTH"', r.madeBy === 'MTH', { madeBy: r.madeBy, page: (r.page || '').slice(0, 300), err: r.pErr });
    T('D2 the Sets list\'s line names MTH', /MTH/.test(r.listLine) && !/Lionel/.test(r.listLine), r.listLine);
    T('D3 a search for "mth" finds it', r.searchHit);

    console.log('\n== W · the save ==');
    T('W1 "My set isn\'t listed" writes 15 cells — A–N as before, O = MTH', Array.isArray(r.wRow) && r.wRow.length === 15 && r.wRow[14] === 'MTH' && r.wRow[1] === 'Club Train' && r.wRow[7] === 'OWN-SET', { row: r.wRow, err: r.wErr });
    T('W2 …and the set in hand knows it (no reload needed)', r.wRec === 'MTH|MTH', r.wRec);
    T('W3 a catalog set leaves O blank (its maker is its pieces\')', Array.isArray(r.cRow) && r.cRow.length === 15 && r.cRow[14] === '' && r.cRow[7] === 'SET-1467W', { row: r.cRow, err: r.cErr });

    console.log('\n== E · Edit ==');
    T('E1 a set you built gets a "Made by" box with the Add form\'s makers', r.eOptions.includes('Atlas O') && r.eOptions.includes('MTH') && r.eOptions.includes('Lionel'), r.eOptions.slice(0, 12));
    T('E2 picking Atlas O writes A:O on THAT set\'s row (41), O = Atlas O, its name kept', !!r.eWrite && /^My Sets!A41:O41$/.test(r.eWrite[0]) && r.eWrite[1][14] === 'Atlas O' && r.eWrite[1][1] === 'Grandpa’s set', r.eWrite);
    T('E3 …and it now says "Atlas O" everywhere', r.eAfter === 'Atlas O', r.eAfter);
    T('E4 a catalog set gets no "Made by" box', r.eCatalogBox === false);

    console.log('\n== R · Remove ==');
    T('R1 Remove blanks the whole row A:O — no maker left behind', !!r.rWrite && /^My Sets!A40:O40$/.test(r.rWrite[0]) && r.rWrite[1].length === 15 && r.rWrite[1].every(c => c === ''), { w: r.rWrite, err: r.rErr });

    console.log('\n== H · the header repair and the reader ==');
    T('H1 the start-up repair stamps A2:O2, "Manufacturer" last', !!r.hStamp && r.hStamp[0] === 'My Sets!A2:O2' && r.hStamp[1].length === 15 && r.hStamp[1][14] === 'Manufacturer', { stamp: r.hStamp, err: r.hErr });
    const AD = read('app-data.js');
    const readerOK = (src) => /'My Sets!A3:O'\]/.test(src) && /manufacturer: String\(r\[14\]\|\|''\)/.test(src);
    T('H2 the reader takes A3:O and keeps O as the set\'s maker', readerOK(AD));
    T('H3 no page errors', w.errs.length === 0, w.errs);
    await w.ctx.close();

    console.log('\n== P · planted: each check can fail ==');
    const APPJS = read('app.js');
    const oldRule = plant(APPJS, "  var saved = String((ms && ms.manufacturer) || '').trim();\n  if (saved) return saved;\n", '');
    { const p = await open(browser, { 'app.js': oldRule }); const pr = await walk(p.pg);
      T('P1 the rule back on "first piece" → M1 / D1 red ("Lionel")', pr.mine === 'Lionel' && pr.madeBy !== 'MTH', { mine: pr.mine, madeBy: pr.madeBy }); await p.ctx.close(); }
    const WS = read('wizard-save.js');
    const short = plant(WS, "      nextInventoryId(),                   // N: Inventory ID\n      isOwnSet ? (d._ownSetMaker || '') : '',   // O: Manufacturer — 2026-11-07 (setmaker): the maker you chose; a catalog set's comes from its pieces\n", "      nextInventoryId(),                   // N: Inventory ID\n");
    { const p = await open(browser, { 'wizard-save.js': short }); const pr = await walk(p.pg);
      T('P2 the save back to 14 cells → W1 red', !(Array.isArray(pr.wRow) && pr.wRow.length === 15 && pr.wRow[14] === 'MTH'), pr.wRow); await p.ctx.close(); }
    const NID = read('non-item-detail-config.js');
    const oldEdit = plant(NID, "        { col: 'O', key: 'manufacturer' },   // 2026-11-07 (setmaker): who made a set you built yourself\n", '');
    { const p = await open(browser, { 'non-item-detail-config.js': oldEdit }); const pr = await walk(p.pg);
      T('P3 Edit back on A:N → E2 red (the choice is never written)', !(pr.eWrite && /:O41$/.test(pr.eWrite[0]) && pr.eWrite[1][14] === 'Atlas O'), pr.eWrite); await p.ctx.close(); }
    T('P4 the reader back on A3:N → caught by H2', !readerOK(AD.replace("'My Sets!A3:O']", "'My Sets!A3:N']")));
  } finally { await browser.close(); }
  console.log('\n' + (fail ? 'FAILED' : 'PASSED') + '  —  set_maker_tests: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  set_maker_tests crashed: ' + (e && e.stack || e)); process.exit(1); });
