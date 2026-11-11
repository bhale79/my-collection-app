#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// A MODERN LIONEL NUMBER TYPED WITH ITS "6-" — 2026-11-02   (Node + jsdom, the REAL code)
//
// Found while building Lars's set line (2026-11-01); Brad 2026-11-02 "yes" to
// the plan. The search pulled 31705 out of "6-31705" but then ALSO asked the
// description for the words "6-31705" — and found nothing; the "Found" line and
// Next compared numbers letter for letter, so 6-8359 and 8359 were strangers
// though the catalog writes both forms.
//   N  rrNumSameAsTyped (the ONE "same number" check): one digit + dash in front
//      is the same number (6-31705 = 31705, 7-11193 = 11193); MTH 20-66238 is
//      NOT 66238, Postwar 6464-1 is NOT 6464, 2343-P = 2343P still
//   L  the list: "6-31705" and "31705" find the row whichever form the catalog
//      writes; no "contains" label and no "Use … as typed" row for it; MTH
//      20-66238 typed as 66238 is unchanged (contains, plus the typed row)
//   R  the one row picker (_wizResolveAddRow) and the scorer (_wizPickMasterRow)
//      hold that row; still nothing outside the filters
//   S  scans, each with a planted offender: the picker, the scorer and the list
//      ask the one check (a letter-for-letter compare put back → red)
// The tap fix and the browser road are tap_and_prefix_road_tests.js.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let JSDOM;
try { JSDOM = require('jsdom').JSDOM; }
catch (e) { console.log('FAILED  —  line_prefix_number_tests needs jsdom (npm install --no-save jsdom).'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function ok(n, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (extra || ''))); cond ? pass++ : fail++; }
function read(f) { return fs.readFileSync(path.join(APP, f), 'utf8'); }
function grab(src, head) {
  const i = src.indexOf(head);
  if (i < 0) throw new Error('missing ' + head);
  let d = 0;
  const j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); }
  }
  throw new Error('unbalanced ' + head);
}
function plant(src, from, to, label) {
  if (src.indexOf(from) < 0) throw new Error('planted offender "' + label + '" no longer matches the source — update the test');
  return src.replace(from, to);
}
const WIZ = read('wizard.js'), SUG = read('wizard-suggestions.js'), CFG = read('config.js');
const APPJS = read('app.js'), BROWSE = read('browse.js'), TYPES = read('type-groups.js');

function buildWorld(sugSrc, wizSrc) {
  const dom = new JSDOM('<!doctype html><html><body><input id="wiz-input"><div id="wiz-match"></div><div id="wiz-suggestions"></div></body></html>', { runScripts: 'outside-only', url: 'https://therailroster.com/app/' });
  const win = dom.window;
  win.console = { log() {}, warn() {}, error() {} };
  const brandVar = APPJS.slice(APPJS.indexOf('var _BRAND_LABELS'), APPJS.indexOf('\n', APPJS.indexOf('var _BRAND_LABELS')));
  const eraMap = BROWSE.slice(BROWSE.indexOf('var _ERA_KEY_TO_PERIOD'), BROWSE.indexOf('\n};', BROWSE.indexOf('var _ERA_KEY_TO_PERIOD')) + 3);
  win.eval([
    CFG, TYPES, brandVar, eraMap, require('./lib/num-rule').numRuleSource(),
    grab(APPJS, 'function _manufacturerOfEra('), grab(APPJS, 'function _manufacturerOfItem('), grab(APPJS, 'function _itemEraKey('),
    grab(APPJS, 'function _brandLabel('), grab(APPJS, 'function rrAlsoSoldAsNames('), grab(APPJS, 'function _rrMakerWord('), grab(APPJS, 'function rrRowAlsoSoldBy('),
    grab(BROWSE, 'function _itemEraPeriod('),
    grab(wizSrc, 'function _wizPeriodOfYear('), grab(wizSrc, 'function _wizPeriodOfRow('), grab(wizSrc, 'function _wizScaleOfRow('),
    grab(wizSrc, 'function _wizMasterPrefer('), grab(wizSrc, 'function _wizAddFilters('), grab(wizSrc, 'function _wizAnyAddFilter('),
    grab(wizSrc, 'function _wizRowFitsFilters('), grab(wizSrc, 'function _wizSameNum('), grab(wizSrc, 'function _wizPickMasterRow('),
    'var state = { masterData: [], setData: [], personalData: {} }; var wizard = { data: {}, matchedItem: null, tab: "collection", steps: [{ type: "itemNumGrouping" }], step: 0 }; var _currentEra = "all";',
    'function wizardNext() {} function _updateGroupingButtons() {} function _wizOwnedRefresh() {} function _catalogReady() { return true; } function _wizSetKind() {}',
    sugSrc,
    'this.__set = function (rows, data) { state.masterData = rows; wizard = { data: data || {}, matchedItem: null, tab: "collection", steps: [{ type: "itemNumGrouping" }], step: 0 }; };',
  ].join('\n;\n'));
  return win;
}
const ROWS_DASH = [   // the catalog writes the line prefix
  { itemNum: '6-31705', itemType: 'Set', description: 'Hudson Freight Set', roadName: 'New York Central', yearProd: '1999', _era: 'mpc', _tab: 'Lionel MPC-Modern', rowId: 'MPCD31705' },
  { itemNum: '20-66238', itemType: 'Passenger Set', description: 'Northern Pacific 2-Car Set', roadName: 'Northern Pacific', yearProd: '2010', _era: 'mth_o', _tab: 'MTH O', rowId: 'MTH66238' },
  { itemNum: '6464-1', itemType: 'Boxcar', description: 'Western Pacific Boxcar', roadName: 'Western Pacific', yearProd: '1953', _era: 'pw', _tab: 'Lionel PW - Items', rowId: 'PW64641' },
];
const ROWS_BARE = [   // the catalog writes the bare number
  { itemNum: '8359', itemType: 'Diesel Locomotive', description: 'Chessie GP7', roadName: 'Chessie', yearProd: '1976', _era: 'mpc', _tab: 'Lionel MPC-Modern', rowId: 'MPC8359' },
];
let W;
try { W = buildWorld(SUG, WIZ); }
catch (e) { ok('the harness loads the real code', false, e.stack); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(1); }

function list(win, rows, q, data) {
  win.__set(rows.map(r => Object.assign({}, r)), data);
  win.updateItemSuggestions(q);
  const el = win.document.getElementById('wiz-suggestions');
  const r = Array.from(el.querySelectorAll('[data-idx]'));
  return { nums: r.map(x => (x.querySelector('span') || {}).textContent), contains: !!el.querySelector('[data-contains-num]'),
    typed: !!el.querySelector('[data-typed-num]'), nf: !!el.querySelector('[data-nothing-found]'),
    green: r.filter(x => /2ecc71|46, ?204, ?113/.test(x.getAttribute('style') || '')).map(x => (x.querySelector('span') || {}).textContent) };
}

// ── N ──
const same = (a, b) => W.rrNumSameAsTyped(a, b);
ok('N1 6-31705 = 31705, both ways', same('6-31705', '31705') && same('31705', '6-31705'));
ok('N2 7-11193 = 11193; 6-8359 = 8359', same('7-11193', '11193') && same('6-8359', '8359'));
ok('N3 MTH 20-66238 is NOT 66238 (two digits in front)', !same('20-66238', '66238'));
ok('N4 Postwar 6464-1 is NOT 6464, nor 64641', !same('6464-1', '6464') && !same('6464-1', '64641'));
ok('N5 2343-P = 2343P still (the v0.9.2031 rule)', same('2343-P', '2343P'));
ok('N6 a wheel arrangement is no number pair (0-4-0 vs 4-0)', !same('0-4-0', '4-0'));
ok('N7 a short tail is not a prefix (6-8 ≠ 8)', !same('6-8', '8'));

// ── L ──
let L = list(W, ROWS_DASH, '6-31705');
ok('L1 catalog "6-31705", typed "6-31705" → found (was: nothing found)', L.nums.join() === '6-31705' && !L.nf, JSON.stringify(L));
ok('L2 … highlighted as the number, no "contains" label, no "Use as typed" row', L.green.join() === '6-31705' && !L.contains && !L.typed, JSON.stringify(L));
L = list(W, ROWS_DASH, '31705');
ok('L3 catalog "6-31705", typed "31705" → found, no "contains" label', L.nums.join() === '6-31705' && !L.contains && !L.typed, JSON.stringify(L));
L = list(W, ROWS_BARE, '6-8359');
ok('L4 catalog "8359", typed "6-8359" → found', L.nums.join() === '8359' && !L.typed, JSON.stringify(L));
L = list(W, ROWS_DASH, '6-31705 hudson');
ok('L5 a real description word after the number still narrows ("6-31705 hudson")', L.nums.join() === '6-31705');
L = list(W, ROWS_DASH, '6-31705 erie');
ok('L6 … and a word the row lacks still empties the list', L.nums.length === 0);
L = list(W, ROWS_DASH, '66238');
ok('L7 MTH 20-66238 typed as 66238: unchanged — a "contains" row plus "Use 66238 as typed"', L.nums.join() === '20-66238' && L.contains && L.typed, JSON.stringify(L));
L = list(W, ROWS_DASH, '6464');
ok('L8 Postwar 6464-1 typed as 6464: unchanged (starts-with, no prefix rule)', L.nums.join() === '6464-1' && L.typed && !L.contains, JSON.stringify(L));

// ── R ──
W.__set(ROWS_DASH.concat(ROWS_BARE), {});
ok('R1 the one picker: "6-31705" (raw, as Next asks) → the 6-31705 row', (W._wizResolveAddRow('6-31705', { raw: true }) || {}).rowId === 'MPCD31705');
ok('R2 the one picker: "31705" → the 6-31705 row', (W._wizResolveAddRow('31705') || {}).rowId === 'MPCD31705');
ok('R3 the one picker: "6-8359" → the 8359 row', (W._wizResolveAddRow('6-8359', { raw: true }) || {}).rowId === 'MPC8359');
ok('R4 the scorer: "31705" → the 6-31705 row', (W._wizPickMasterRow('31705') || {}).rowId === 'MPCD31705');
ok('R5 the one picker never matches MTH 20-66238 for 66238', W._wizResolveAddRow('66238') === null);
W.__set(ROWS_DASH.concat(ROWS_BARE), { _searchFilterManufacturer: 'Atlas' });
ok('R6 still nothing outside the filters (Atlas + 6-31705 → nothing)', W._wizResolveAddRow('6-31705', { raw: true }) === null);
W.__set(ROWS_DASH, {});
ok('R7 the "under other makers or eras" note sees any form of the number', W._wizNumberInCatalog('31705') === true);

// ── S ──
function s1(sug, wiz) {
  const res = grab(sug, 'function _wizResolveAddRow(');
  const pick = grab(wiz, 'function _wizPickMasterRow(');
  const lst = grab(sug, 'function updateItemSuggestions(');
  const letter = /toLowerCase\(\)\s*===\s*numLC/;
  return !letter.test(res) && /rrNumSameAsTyped\(i\.itemNum, numLC\)/.test(res) && /rrNumSameAsTyped\(cur\.itemNum, numLC\)/.test(res)
    && !letter.test(pick) && /_wizSameNum\(i\.itemNum, numLC\)/.test(pick)
    && /rrNumLinePrefixOff\(p\) !== _searchNum/.test(lst);
}
ok('S1 the picker, the scorer and the list ask the one "same number" check', s1(SUG, WIZ));
ok('S1 PLANTED: the picker\'s letter-for-letter compare put back → caught',
  !s1(plant(SUG, 'return rrNumSameAsTyped(i.itemNum, numLC) && fits(i);', "return String(i.itemNum || '').toLowerCase() === numLC && fits(i);", 'picker'), WIZ));
ok('S1 PLANTED: the list asks the description for the typed number again → caught',
  !s1(plant(SUG, ' && rrNumLinePrefixOff(p) !== _searchNum', '', 'list'), WIZ));
// the plant, RUN: the old list finds nothing for "6-31705"
const Wp = buildWorld(plant(SUG, ' && rrNumLinePrefixOff(p) !== _searchNum', '', 'list'), WIZ);
const Lp = list(Wp, ROWS_DASH, '6-31705');
ok('S1 PLANTED (run): without it, "6-31705" finds nothing — L1 would go red', Lp.nums.length === 0);
const Wq = buildWorld(plant(SUG, 'return rrNumSameAsTyped(i.itemNum, numLC) && fits(i);', "return String(i.itemNum || '').toLowerCase() === numLC && fits(i);", 'picker'), WIZ);
Wq.__set(ROWS_DASH, {});
ok('S1 PLANTED (run): the old picker holds nothing for "31705" — R2 would go red', Wq._wizResolveAddRow('31705') === null);
ok('S2 the line-prefix rule lives once (rrNumLinePrefixOff) — no copy of its pattern in the picker or scorer',
  !/\\d-\(\?=/.test(grab(SUG, 'function _wizResolveAddRow(') + grab(WIZ, 'function _wizPickMasterRow(')));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
