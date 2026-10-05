#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ROW ID TESTS — v0.9.1880  (CATALOG_ROW_ID_PLAN_2026-10-04, Step 2)
//
// [stated] Brad: "yes" — the app learns a permanent ID for every catalog row.
//
// The old link (Master Key = era|number|variation) is shared by different
// products on 655 links: Lionel Pre-War No. 800 with no variation is BOTH the
// 1904 2-7/8" motor car and the 1915 O-gauge boxcar, and the app always opened
// the first. A Row ID names ONE row. Everything here runs the REAL functions,
// lifted from app/ (never re-typed):
//   A  the one definition (config.js): format, minting, a clash draws again
//   B  the column is read BY NAME wherever it sits ("Row ID" → rowId)
//   C  a duplicate the app folds away keeps answering to its own ID
//   D  findMaster: the ID answers first and exactly — and only when it fits
//      the copy (its number, and its variation when the copy names one);
//      PLANTED: findMaster without the ID branch opens the wrong product
//   E  the Office mints an ID for every row it files, never a taken one;
//      PLANTED: the old row builder leaves the column blank
//   F  the master-list check: one ID, one row, across tabs; PLANTED: a
//      within-tab-only check misses a cross-tab duplicate
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const APP = path.join(__dirname, '..', 'app');
const src = f => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (detail === undefined ? '' : JSON.stringify(detail)))); cond ? pass++ : fail++; }
function section(t) { console.log('\n== ' + t + ' =='); }
function grab(text, head) {
  const i = text.indexOf(head);
  if (i < 0) throw new Error('missing ' + head);
  let d = 0, j = text.indexOf('{', i);
  for (let k = j; k < text.length; k++) {
    if (text[k] === '{') d++;
    else if (text[k] === '}') { d--; if (d === 0) return text.slice(i, k + 1); }
  }
  throw new Error('unbalanced ' + head);
}
function constLine(text, name) {
  const m = text.match(new RegExp('^const ' + name + '\\s*=.*;\\s*$', 'm'));
  if (!m) throw new Error('missing const ' + name);
  return m[0].replace(/^const /, 'var ');
}
const cfg = src('config.js'), dat = src('app-data.js'), pdl = src('wizard-pdlookup.js'), ym = src('yardmaster.js');

// ── A · the one definition ──────────────────────────────────────────────────
section('A · the Row ID — one definition (config.js)');
function liftDef(cryptoObj) {
  return new Function('crypto',
    constLine(cfg, 'RR_ROW_ID_ALPHABET') + '\n' + constLine(cfg, 'RR_ROW_ID_LENGTH') + '\n'
    + grab(cfg, 'function rrIsRowId(') + '\n' + grab(cfg, 'function rrNewRowId(')
    + '\nreturn { isId: rrIsRowId, mint: rrNewRowId, ALPHA: RR_ROW_ID_ALPHABET, LEN: RR_ROW_ID_LENGTH };')(cryptoObj);
}
const D = liftDef(require('crypto').webcrypto);
T('A1 ten characters, no look-alikes (no 0 O 1 I L)', D.LEN === 10 && !/[0O1IL]/.test(D.ALPHA) && D.ALPHA.length === 31, D.ALPHA);
const many = new Set(); let allOk = true;
for (let i = 0; i < 5000; i++) { const id = D.mint(); if (!D.isId(id)) allOk = false; many.add(id); }
T('A2 5,000 minted: every one is a Row ID, no two alike', allOk && many.size === 5000, many.size);
T('A3 rrIsRowId refuses the wrong length, a look-alike letter, a blank', !D.isId('ABCDEFGH2') && !D.isId('ABCDEFGH20') && !D.isId('ABCDEFGHI2') && !D.isId('') && D.isId('ABCDEFGH23'));
// a clash draws again: a crypto that hands out the SAME bytes twice, then new ones
let calls = 0;
const fixed = { getRandomValues(a) { calls++; for (let i = 0; i < a.length; i++) a[i] = calls <= 2 ? 7 : (i * 37 + calls) & 255; return a; } };
const Dx = liftDef(fixed);
const first = Dx.mint(); const again = Dx.mint(new Set([first]));
T('A4 a clash with an ID already taken draws again', D.isId(first) && D.isId(again) && again !== first && calls >= 3, [first, again, calls]);

// ── B · the column, by name ────────────────────────────────────────────────
section('B · "Row ID" is read by its header name');
const audit = require('../tools/master-audit/audit.js');
const A = audit.loadApp();
const H1 = ['Item Number', 'Item Type', 'Description', 'Variation #', 'Gauge', 'Row ID'];
const H2 = ['Row ID', 'Item Number', 'Item Type', 'Description', 'Variation #', 'Gauge'];
const cm1 = A.buildMasterColMap(H1), cm2 = A.buildMasterColMap(H2), cm0 = A.buildMasterColMap(H1.slice(0, 5));
T('B1 the last column', A.parseMasterRow(['800', 'Boxcar', 'Boxcar (O)', '', 'O', 'ABCDEFGH23'], 'Lionel Pre-War', cm1).rowId === 'ABCDEFGH23');
T('B2 …or the first — position never matters', A.parseMasterRow(['ABCDEFGH23', '800', 'Boxcar', 'Boxcar (O)', '', 'O'], 'Lionel Pre-War', cm2).rowId === 'ABCDEFGH23');
T('B3 a tab without the column reads blank (the app before Master Version 2.20)', A.parseMasterRow(['800', 'Boxcar', 'Boxcar (O)', '', 'O'], 'Lionel Pre-War', cm0).rowId === '');

// ── the lifted resolver world ──────────────────────────────────────────────
const W = { state: { masterByItem: new Map(), masterByItemAll: null, masterByRowId: null, masterByRowIdAll: null } };
function liftResolver(datText) {
  const names = ['function _deduplicateMaster(', 'function _rrIndexByRowId(', 'function rrMasterKeyOf(', 'function rrMasterByKey(',
    'function rrMasterRowIdOf(', 'function rrMasterByRowId(', 'function _rrRowIdFits(', 'function findMaster(', 'function _preferEraOf(',
    'function _mIsMotive(', 'function _mSuffix(', 'function _letterKinRows(', 'function _findMasterCore('];
  const body = names.map(n => grab(datText, n)).join('\n')
    + '\nvar _lkCache = new WeakMap();'
    + '\nreturn { dedupe: _deduplicateMaster, index: _rrIndexByRowId, keyOf: rrMasterKeyOf, byKey: rrMasterByKey, idOf: rrMasterRowIdOf, byId: rrMasterByRowId, fits: _rrRowIdFits, fm: findMaster, eraOf: _preferEraOf };';
  const rrSameVar = new Function(pdl.slice(pdl.indexOf('function _pdLookupKey'), pdl.indexOf("if (typeof window !== 'undefined') { window.rrSameVar")) + '; return rrSameVar;')();
  const ERA_TABS = { prewar: { items: 'Lionel Pre-War' }, pw: { items: 'Lionel PW - Items' } };
  const baseItemNum = n => String(n || '').replace(/-?[PDTC]$/i, '');
  return new Function('state', 'ERA_TABS', 'baseItemNum', 'rrSameVar', 'window', body)(W.state, ERA_TABS, baseItemNum, rrSameVar, {});
}
const R = liftResolver(dat);
const PRE = 'Lionel Pre-War', PW = 'Lionel PW - Items';
const motor800 = { itemNum: '800', variation: '', itemType: 'Motorized Unit', description: 'Boxcar (2 7/8"), 04-05*', _era: 'prewar', _tab: PRE, rowId: 'MMMMMMMMMM' };
const box800 = { itemNum: '800', variation: '', itemType: 'Boxcar', description: 'Boxcar (O)', _era: 'prewar', _tab: PRE, rowId: 'BBBBBBBBBB' };
const box800C = { itemNum: '800', variation: 'C', itemType: 'Boxcar', description: 'Box Car', _era: 'prewar', _tab: PRE, rowId: 'CCCCCCCCCC' };
const alco = { itemNum: '2343', variation: '1', itemType: 'Diesel Locomotive', description: 'F3 A unit', _era: 'pw', _tab: PW, rowId: 'DDDDDDDDDD' };
const twinA = { itemNum: '5', variation: '', roadName: '', poweredDummy: '', description: 'Locomotive', trackPower: '', subType: '', _yearRaw: '1906', itemType: 'Electric Locomotive', _era: 'prewar', _tab: PRE, rowId: 'EEEEEEEEEE' };
const twinB = Object.assign({}, twinA, { rowId: 'FFFFFFFFFF' });

// ── C · folded duplicates ──────────────────────────────────────────────────
section('C · a twin the app folds away keeps answering to its own ID');
const kept = R.dedupe([twinA, twinB]);
T('C1 the app keeps one of two identical rows (its own dedupe, unchanged)', kept.length === 1 && kept[0] === twinA);
T('C2 …and the folded twin\'s ID rides on the kept row', JSON.stringify(twinA._altRowIds) === '["FFFFFFFFFF"]', twinA._altRowIds);
const rows = [motor800, box800, box800C, alco, twinA];
W.state.masterByItem = new Map(); rows.forEach(r => { const k = r.itemNum; if (!W.state.masterByItem.has(k)) W.state.masterByItem.set(k, []); W.state.masterByItem.get(k).push(r); });
W.state.masterByRowId = R.index(rows);
T('C3 the index answers both IDs with the kept row', R.byId('EEEEEEEEEE') === twinA && R.byId('FFFFFFFFFF') === twinA);

// ── D · findMaster ─────────────────────────────────────────────────────────
section('D · findMaster: the Row ID answers first, exactly, and only when it fits');
const KEY = 'prewar|800|';
T('D0 the old link really is shared (both 800 rows give the same key)', R.keyOf(motor800) === KEY && R.keyOf(box800) === KEY);
T('D1 the key alone opens the FIRST row — the 1904 motor car (unchanged)', R.fm('800', '', { masterKey: KEY, era: 'prewar' }) === motor800);
T('D2 the Row ID opens the boxcar the collector actually has', R.fm('800', '', { masterKey: KEY, masterRowId: 'BBBBBBBBBB', era: 'prewar' }) === box800);
T('D3 …and the motor car by its own ID', R.fm('800', '', { masterKey: KEY, masterRowId: 'MMMMMMMMMM', era: 'prewar' }) === motor800);
T('D4 an ID whose row has ANOTHER number is refused (falls back to the key)', R.fm('800', '', { masterKey: KEY, masterRowId: 'DDDDDDDDDD', era: 'prewar' }) === motor800);
T('D5 a STALE ID — the copy now names variation C, the ID a blank-variation row — is refused', R.fm('800', 'C', { masterKey: 'prewar|800|C', masterRowId: 'BBBBBBBBBB', era: 'prewar' }) === box800C);
T('D6 an ID that resolves to nothing falls back to the key', R.fm('800', '', { masterKey: KEY, masterRowId: 'ZZZZZZZZZZ', era: 'prewar' }) === motor800);
T('D7 a folded twin\'s ID opens the kept row', R.fm('5', '', { masterRowId: 'FFFFFFFFFF', era: 'prewar' }) === twinA);
T('D8 the powered unit 2343-P finds its base row by ID', R.fm('2343-P', '1', { masterRowId: 'DDDDDDDDDD', era: 'pw' }) === alco);
T('D9 a MANUAL entry never takes a catalog identity — ID or not', R.fm('800', '', { era: 'Manual', masterRowId: 'BBBBBBBBBB' }) === null);
T('D10 the era a copy names comes from its row (by ID) first', R.eraOf({ masterRowId: 'DDDDDDDDDD', era: 'prewar' }) === 'pw');
T('D11 without a Row ID nothing changes: number + variation still finds variation C', R.fm('800', 'C', { era: 'prewar' }) === box800C);
// PLANTED: findMaster with the Row ID branch cut out
const fmSrc = grab(dat, 'function findMaster(');
const cut = fmSrc.replace(/\n  \/\/ v0\.9\.1880: a saved ROW ID answers first[\s\S]*?\n  \}\n/, '\n');
T('D12 PLANTED: the branch was found and cut', cut !== fmSrc && cut.indexOf('prefer.masterRowId') < 0);
const Rold = liftResolver(dat.replace(fmSrc, cut));
T('D13 PLANTED: without it the boxcar collector is handed the motor car — D2 catches it', Rold.fm('800', '', { masterKey: KEY, masterRowId: 'BBBBBBBBBB', era: 'prewar' }) === motor800);

// ── E · the Office ─────────────────────────────────────────────────────────
section('E · the Office mints a Row ID for every row it files');
function liftOffice(ymText, mintFn) {
  return new Function('rrNewRowId', grab(ymText, 'function _ymMasterCell(') + '\n' + grab(ymText, 'function _ymRowsFor(') + '\nreturn _ymRowsFor;')(mintFn);
}
const rowsFor = liftOffice(ym, D.mint);
const heads = ['Item Number', 'Item Type', 'Description', 'Source', 'Row ID'];
const plan = { heads, shape: null, allVals: [heads, ['111', 'Boxcar', 'old', 'x', 'ABCDEFGH23']], fresh: [{ num: '900', type: 'Boxcar', desc: 'a' }, { num: '901', type: 'Boxcar', desc: 'b' }] };
const out = rowsFor(plan, '2026-10-05');
const ids = out.map(r => r[4]);
T('E1 every row filed gets a Row ID, in the Row ID column, by header name', out.length === 2 && ids.every(D.isId) && out[0][0] === '900' && out[1][0] === '901', out);
T('E2 …never one already on the tab, never two alike in one batch', ids.indexOf('ABCDEFGH23') < 0 && ids[0] !== ids[1], ids);
// the taken set reaches the minting: a mint that offers the taken ID first must be refused
const offered = ['ABCDEFGH23', 'ABCDEFGH23', 'KKKKKKKKKK', 'KKKKKKKKKK', 'MMMMMMMMMM'];
const scripted = taken => { for (const c of offered) if (!taken || !taken.has(c)) return c; throw new Error('none'); };
const out2 = liftOffice(ym, scripted)(plan, '2026-10-05');
T('E3 the IDs already on the tab and in the batch are handed to the minting', out2[0][4] === 'KKKKKKKKKK' && out2[1][4] === 'MMMMMMMMMM', out2.map(r => r[4]));
const shapePlan = { heads: ['Set Number', 'Set Name', 'Row ID'], shape: { map: { 'Set Number': 'num', 'Set Name': 'desc' } }, allVals: [], fresh: [{ num: '1464W', desc: 'set' }] };
T('E4 a Sets / Catalogs tab (a shape) gets no Row ID', liftOffice(ym, D.mint)(shapePlan, '2026-10-05')[0][2] === '');
// PLANTED: the row builder as it stood before (no Row ID)
const oldRowsFor = ym.indexOf('function _ymRowsFor(') > 0
  ? grab(ym, 'function _ymRowsFor(').replace(/if \(rid && String\(h\) === 'Row ID'\) return rid;/, '')
  : '';
const outOld = new Function('rrNewRowId', grab(ym, 'function _ymMasterCell(') + '\n' + oldRowsFor + '\nreturn _ymRowsFor;')(D.mint)(plan, '2026-10-05');
T('E5 PLANTED: a builder that skips the Row ID leaves the column blank — E1 catches it', oldRowsFor && outOld.every(r => r[4] === ''));

// ── F · the master-list check ──────────────────────────────────────────────
section('F · the master-list check: one ID, one row — across every tab');
const HH = ['Item Number', 'Item Type', 'Description', 'Gauge', 'Year Produced', 'Variation #', 'Road Name', 'Row ID'];
const tabA = [HH, ['800', 'Boxcar', 'Boxcar (O)', 'O', '1915', '', 'Lionel Lines', 'QQQQQQQQQQ'], ['801', 'Boxcar', 'Boxcar', 'O', '1915', '', 'Lionel Lines', 'RRRRRRRRRR']];
const tabB = [HH, ['2343', 'Diesel Locomotive', 'F3 A unit', 'O', '1950', '1', 'Santa Fe', 'QQQQQQQQQQ']];
const resA = audit.checkTab(A, { tab: 'Lionel Pre-War', era: 'prewar' }, tabA);
const resB = audit.checkTab(A, { tab: 'Lionel PW - Items', era: 'pw' }, tabB);
T('F1 each tab alone is clean — the clash is between tabs', !resA.flags.concat(resB.flags).some(f => /^row-id/.test(f.rule)));
const dups = audit.rowIdDuplicates([resA, resB]);
T('F2 the cross-tab check flags BOTH rows, each naming where else the ID sits',
  dups.length === 2 && dups.every(f => f.rule === 'row-id-dup') && /Lionel PW - Items row 2/.test(dups.find(f => f.tab === 'Lionel Pre-War').note), dups);
const withinOnly = results => results.flatMap(r => { const seen = {}; const o = []; (r.rowIds || []).forEach(x => { if (seen[x.id]) o.push(x); seen[x.id] = 1; }); return o; });
T('F3 PLANTED: a within-tab-only check finds nothing here — F2 is what catches it', withinOnly([resA, resB]).length === 0);

console.log('\n' + (fail ? 'RED' : 'GREEN') + ' — ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
