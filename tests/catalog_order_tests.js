// ══ tests/catalog_order_tests.js — the Master Catalog is in NUMBER order ══
//
// v0.9.1901. Brad (screenshot, Master Catalog, Lionel): page 1 opened on
// 1002 / 1005 / 1007 / 1008 — "i should be seeing 004 first, then 4, before
// i see 1008". The Master Catalog sorted by number ONLY in Era All + Maker
// Any; every narrower view showed rows in the order the tabs loaded (all of
// Postwar, then Pre-War). And the one sort it had stripped dashes, so
// "6-8359" sorted as 68359.
// [stated] Brad 2026-10-08: Pre-War and Postwar MIX by number — "a user can
// use era if they want to get rid of one or the other".
//
// A runs the ONE order (rrCatalogNumberKey / rrCompareCatalogKeys, app.js)
// on REAL item numbers from the Lionel Pre-War and Lionel PW - Items tabs
// (2026-10-08), loaded in the bad order (Postwar first). B lifts the Master
// Catalog's own sort block out of browse.js and runs it; C/D put the old
// line back and prove B fails.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(name, ok, info) { console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (ok ? '' : '  -> ' + (info || ''))); ok ? pass++ : fail++; }
function read(f) { return fs.readFileSync(path.join(APP, f), 'utf8'); }
function lift(src, start, end) {
  const i = src.indexOf(start), j = src.indexOf(end, i);
  if (i < 0 || j < 0) throw new Error('could not lift: ' + start);
  return src.slice(i, j);
}

const APPJS = read('app.js');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(lift(APPJS, 'function rrCatalogNumberKey(', 'function rrCompareCatalogNumbers(')
  + lift(APPJS, 'function rrCompareCatalogNumbers(', '\n}\n') + '\n}\n'
  + ';this.K = rrCatalogNumberKey; this.CK = rrCompareCatalogKeys; this.C = rrCompareCatalogNumbers;', ctx);

// Real numbers, as the tabs hold them. Loaded Postwar first — the bad order.
const LOADED = [
  ['1002', 'PW', '1'], ['1005', 'PW', '1'], ['1007', 'PW', '1'], ['1007', 'PW', '2'], ['1008', 'PW', '1'], ['1008-50', 'PW', '1'],
  ['50', 'PW', '1'], ['6454', 'PW', '1'], ['X6454', 'PW', '1'], ['OC1/2', 'PW', '1'], ['ZW', 'PW', '1'], ['011-11', 'PW', '1'],
  ['6-8359', 'MPC', '1'], ['8359', 'MPC', '1'],
  ['001', 'PRE', '1'], ['001T', 'PRE', '1'], ['1', 'PRE', 'A'], ['1', 'PRE', 'B'], ['1/111', 'PRE', '1'],
  ['4', 'PRE', 'A'], ['4', 'PRE', 'B'], ['004', 'PRE', '1'], ['004T', 'PRE', '1'], ['4U', 'PRE', '1'],
  ['8E', 'PRE', '1'], ['8', 'PRE', '1'], ['50', 'PRE', '1'], ['011', 'PRE', '1'], ['10', 'PRE', '1'],
].map(([n, t, v]) => ({ itemNum: n, _t: t, variation: v }));
const WANT = ['001', '001T', '1', '1', '1/111', '004', '004T', '4', '4', '4U', '8', '8E', '10', '011', '011-11',
  '50', '50', '1002', '1005', '1007', '1007', '1008', '1008-50', '6454', 'X6454', '8359', '6-8359', 'OC1/2', 'ZW'];

{
  const rows = LOADED.map((r, i) => ({ r, i, k: ctx.K(r.itemNum) }));
  rows.sort((a, b) => ctx.CK(a.k, b.k) || a.i - b.i);
  const got = rows.map(x => x.r.itemNum);
  T('A1 real numbers in catalog order: 004 then 4, both long before 1008', JSON.stringify(got) === JSON.stringify(WANT), got.join(' '));
  T('A2 004 comes before 4 (more leading zeros first)', ctx.C('004', '4') < 0 && ctx.C('04', '4') < 0 && ctx.C('004', '04') < 0);
  T('A3 8 before 8E; 1008 before 1008-50', ctx.C('8', '8E') < 0 && ctx.C('1008', '1008-50') < 0);
  T('A4 6-8359 sits beside 8359, not at 68359', ctx.C('6-8359', '8360') < 0 && ctx.C('6-8359', '8358') > 0);
  T('A5 a word-led code (OC1/2, BB-billboards-001, ZW) comes after every number', ctx.C('99999', 'OC1/2') < 0 && ctx.C('9', 'BB-billboards-001') < 0);
  const fifty = rows.filter(x => x.r.itemNum === '50').map(x => x.r._t).join(',');
  T('A6 Pre-War and Postwar MIX by number; equal numbers keep their loaded order', fifty === 'PW,PRE', fifty);
  const four = rows.filter(x => x.r.itemNum === '4').map(x => x.r.variation).join(',');
  T('A7 a tab\'s variations stay together and in sheet order (4 A, 4 B)', four === 'A,B', four);
  T('A8 blank / missing numbers do not throw and sort last', ctx.C('', '4') > 0 && ctx.C(null, '4') > 0);
}

// ── B. the Master Catalog's own sort block (browse.js) ───────────────────
const BROWSE = read('browse.js');
const START = '  // v0.9.1901: the Master Catalog is ALWAYS in catalog-number order';
const END = '  // v0.9.1668 (Brad: "9723 gave me 19723 first")';
function runBlock(src, opts) {
  const block = lift(src, START, END);
  const c = {
    state: { filters: { owned: !!opts.owned }, filteredData: LOADED.map(r => Object.assign({}, r)) },
    _currentEra: opts.era, _stp3b: { manufacturer: opts.mfr },
    _manufacturerOfItem: it => (it._t === 'MTH' ? 'mth' : 'lionel'),
    rrCatalogNumberKey: ctx.K, rrCompareCatalogKeys: ctx.CK,
  };
  vm.createContext(c);
  vm.runInContext(block, c);
  return c.state.filteredData.map(r => r.itemNum);
}
{
  const lionel = runBlock(BROWSE, { era: 'all', mfr: 'lionel' });
  T('B1 Master Catalog, Maker = Lionel (Brad\'s view): number order', JSON.stringify(lionel) === JSON.stringify(WANT), lionel.slice(0, 8).join(' '));
  const pre = runBlock(BROWSE, { era: 'prewar', mfr: 'any' });
  T('B2 Master Catalog, one era picked: number order', JSON.stringify(pre) === JSON.stringify(WANT));
  const any = runBlock(BROWSE, { era: 'all', mfr: 'any' });
  T('B3 Master Catalog, All + Any: still number order (one maker in the set)', JSON.stringify(any) === JSON.stringify(WANT));
  const owned = runBlock(BROWSE, { era: 'all', mfr: 'lionel', owned: true });
  T('B4 My Collection is NOT re-sorted here (it has its own order)', JSON.stringify(owned) === JSON.stringify(LOADED.map(r => r.itemNum)));
}
// ── C/D. planted: the old guard (only All + Any sorted) and the old key ──
{
  const old = BROWSE.replace("  if (!state.filters.owned) {\n    var _byMaker",
    "  if (!state.filters.owned && _currentEra === 'all' && _stp3b && _stp3b.manufacturer === 'any') {\n    var _byMaker");
  if (old === BROWSE) throw new Error('planted offender C no longer matches browse.js — update the test');
  const lionel = runBlock(old, { era: 'all', mfr: 'lionel' });
  T('C1 PLANTED old guard: Maker = Lionel opens on 1002 again (B1 can fail)', lionel[0] === '1002' && JSON.stringify(lionel) !== JSON.stringify(WANT), lionel[0]);
  const oldKey = Object.assign({}, ctx, {
    K: n => ({ v: parseInt(String(n || '').replace(/[^0-9]/g, '')) || 0, n: String(n || '') }),
    CK: (a, b) => (a.v - b.v) || a.n.localeCompare(b.n),
  });
  const rows = LOADED.map((r, i) => ({ r, i, k: oldKey.K(r.itemNum) }));
  rows.sort((a, b) => oldKey.CK(a.k, b.k) || a.i - b.i);
  const got = rows.map(x => x.r.itemNum);
  T('D1 PLANTED old digits-only key: 6-8359 lands at 68359 (A1 can fail)', JSON.stringify(got) !== JSON.stringify(WANT) && got.indexOf('6-8359') > got.indexOf('X6454') + 1, got.join(' '));
}
// ── E. speed: the whole catalog (165,000 numbers) sorts well inside a second.
// The first draft compared with Intl's numeric collation and took 4 s;
// the padded natural key takes ~0.4 s (the old digits-only sort: ~0.7 s).
{
  const a = [];
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let n = 0; n < 165000; n++) {
    const r = rnd();
    a.push(r < .3 ? String(Math.floor(rnd() * 9999)) : r < .6 ? '20-' + Math.floor(rnd() * 99999) + '-1'
      : r < .9 ? String(1000000 + Math.floor(rnd() * 9000000)) : 'X' + Math.floor(rnd() * 999));
  }
  const t = Date.now();
  const k = a.map((n, i) => ({ i, k: ctx.K(n) }));
  k.sort((x, y) => ctx.CK(x.k, y.k) || x.i - y.i);
  const ms = Date.now() - t;
  T('E1 165,000 numbers sort in under 2.5 s (measured ' + ms + ' ms)', ms < 2500, ms + ' ms');
}
// ── F. My Collection uses the same order (v0.9.1902, [stated] Brad "yes") ──
// The default sort (sets kept together under their lead number) and the
// Item # column header both used a digits-only key. F lifts both blocks out
// of browse.js and runs them; G puts the old default sort back.
const OWNED = [
  { itemNum: '1008', g: '' }, { itemNum: '6-8359', g: '' }, { itemNum: '4', g: '' },
  { itemNum: '2343T', g: 'GRP-2343-111' }, { itemNum: '8359', g: '' }, { itemNum: '2343', g: 'GRP-2343-111' },
  { itemNum: '2343', g: 'GRP-2343-222' }, { itemNum: '004', g: '' }, { itemNum: '2343C', g: 'GRP-2343-111' },
  { itemNum: '2343C', g: 'GRP-2343-222' }, { itemNum: '50', g: '' },
];
const OWNED_WANT = ['004', '4', '50', '1008', '2343', '2343C', '2343T', '2343', '2343C', '8359', '6-8359'];
const OWNED_GROUPS = ['', '', '', '', 'GRP-2343-111', 'GRP-2343-111', 'GRP-2343-111', 'GRP-2343-222', 'GRP-2343-222', '', ''];
const DEF_START = '  // Sort My Collection: by item number, with grouped items together';
const DEF_END = '  // My Collection: user-selected column sort (header click).';
function runCollDefault(src) {
  const c = {
    state: { filters: { owned: true }, _collSort: null, filteredData: OWNED.map(r => Object.assign({}, r)) },
    _rrPdForRow: it => ({ groupId: it.g }), rrCatalogNumberKey: ctx.K, rrCompareCatalogKeys: ctx.CK,
  };
  vm.createContext(c);
  vm.runInContext(lift(src, DEF_START, DEF_END), c);
  return c.state.filteredData;
}
function runCollHeader(src, dir) {
  const start = '  // My Collection: user-selected column sort (header click).';
  const c = {
    state: { filters: { owned: true }, _collSort: { col: 'num', dir: dir }, filteredData: OWNED.map(r => Object.assign({}, r)) },
    findPD: () => ({}), _displayItemNum: it => it.itemNum, _COLL_EXTRA_COLS: [],
    rrDateTs: () => 0, rrCatalogNumberKey: ctx.K, rrCompareCatalogKeys: ctx.CK,
  };
  vm.createContext(c);
  vm.runInContext(lift(src, start, START), c);
  return c.state.filteredData.map(r => r.itemNum);
}
{
  const d = runCollDefault(BROWSE);
  T('F1 My Collection default: catalog number order, 004 then 4, 6-8359 beside 8359', JSON.stringify(d.map(r => r.itemNum)) === JSON.stringify(OWNED_WANT), d.map(r => r.itemNum).join(' '));
  T('F2 a set\'s pieces stay together, and two sets with the same lead stay apart', JSON.stringify(d.map(r => r.g)) === JSON.stringify(OWNED_GROUPS), d.map(r => r.g || '-').join(' '));
  const up = runCollHeader(BROWSE, 'asc');
  T('F3 Item # header (ascending) uses the same order', up.indexOf('004') < up.indexOf('4') && up.indexOf('8359') + 1 === up.indexOf('6-8359') && up.indexOf('4') < up.indexOf('1008'), up.join(' '));
  const down = runCollHeader(BROWSE, 'desc');
  T('F4 Item # header (descending) is the exact reverse order of numbers', down[0] === '6-8359' && down[down.length - 1] === '004', down.join(' '));
}
{
  const old = BROWSE.slice(0, BROWSE.indexOf(DEF_START)) + DEF_START + `
  if (state.filters.owned && !(state._collSort && state._collSort.col)) {
    state.filteredData.sort((a, b) => {
      const gA = (_rrPdForRow(a) || {}).groupId || '', gB = (_rrPdForRow(b) || {}).groupId || '';
      if (gA && gA === gB) return (parseInt((a.itemNum||'').replace(/[^0-9]/g,''))||0) - (parseInt((b.itemNum||'').replace(/[^0-9]/g,''))||0) || (a.itemNum||'').localeCompare(b.itemNum||'');
      const leadA = gA ? gA.split('-').slice(1,-1).join('-') : a.itemNum, leadB = gB ? gB.split('-').slice(1,-1).join('-') : b.itemNum;
      const numA = (leadA||'').replace(/[^0-9]/g,''), numB = (leadB||'').replace(/[^0-9]/g,'');
      if (numA !== numB) return (parseInt(numA)||0) - (parseInt(numB)||0);
      return (leadA||'').localeCompare(leadB||'') || (a.itemNum||'').localeCompare(b.itemNum||'');
    });
  }
` + BROWSE.slice(BROWSE.indexOf(DEF_END));
  const d = runCollDefault(old).map(r => r.itemNum);
  T('G1 PLANTED old default sort: 6-8359 is not beside 8359 (F1 can fail)', JSON.stringify(d) !== JSON.stringify(OWNED_WANT), d.join(' '));
  const oldHdr = BROWSE.replace("      if (_col === 'num') { r = rrCompareCatalogKeys(a.numKey, b.numKey); }   // v0.9.1902: the one number order\n      else if (_numeric)", '      if (_numeric)');
  if (oldHdr === BROWSE) throw new Error('planted offender G2 no longer matches browse.js — update the test');
  const up = runCollHeader(oldHdr, 'asc');
  T('G2 PLANTED old header key: 4 and 004 are not told apart — 4 lands first (F3 can fail)', up.indexOf('4') < up.indexOf('004'), up.join(' '));
}
console.log('\ncatalog_order_tests: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
