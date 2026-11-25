#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THE NUMBER ON A CUSTOM-RUN CAR (weavercr, PLAN_2026-11-24_WEAVER_CUSTOM_RUN_ROAD_NUMBERS)
// [stated] Brad 2026-11-24 19:07 CT "Yes".
//
// Customer Bob typed 311202 — the number on his Weaver Norfolk Southern 4-bay
// Centerflow — and got nothing. Weaver listed the car as Item Number
// "CUSTOM RUN" with 311202 in Variation (one row each for 311201 / 311202 /
// 311203; the run was made in 1997 for RGS). 932 car numbers are ALSO another
// catalog's item number and 108 are on more than one run, so:
//   R  the rule (rrCustomRunRow / rrCustomRunNumber / rrNumCarTwin / rrNumSaveAs, app.js)
//   F  findMaster and friends: a custom run answers ONLY when Weaver is named
//      and only ONE car carries the number; a saved copy keeps its Row ID /
//      Master Key link; rrCatalogCandidates offers the cars (fills a blank only)
//   L  the Add list (real code, jsdom): Weaver named → the car; no maker → the
//      car as a choice when nothing else answers; another maker → nothing; the
//      one row picker never takes a car by its number alone; a tap holds it
//   S  scans, each proven on a planted offender
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const APP = path.join(__dirname, '..', 'app');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0, fail = 0;
function ok(n, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(extra === undefined ? '' : extra).slice(0, 400))); cond ? pass++ : fail++; }
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
const APPJS = read('app.js'), DAT = read('app-data.js'), SUG = read('wizard-suggestions.js'), WIZ = read('wizard.js');
const BROWSE = read('browse.js'), CFG = read('config.js'), TYPES = read('type-groups.js'), SAVE = read('wizard-save.js'), TOOLS = read('tools.js');
const cfgConst = (name) => {
  const i = CFG.indexOf('const ' + name + ' = ');
  if (i < 0) throw new Error('config: ' + name + ' missing');
  const j = CFG.indexOf('\n};', i);
  return 'var ' + CFG.slice(i + 6, j + 3);
};
const CR_RULE = s => ['function rrCustomRunRow(', 'function _rrCarNumKey(', 'function rrCustomRunNumber(', 'function rrNumCarTwin(', 'function rrCustomRunRunKey(']
  .map(h => grab(s, h)).join('\n');
const DASH_RULE = s => [grab(s, 'function rrNumDashKey('), grab(s, 'function rrNumSuffixBase('), grab(s, 'function rrNumLooseTwin('), grab(s, 'function rrNumMayHaveLooseTwin(')].join('\n');

// ── the rows (as the live Weaver O tab holds them, 2026-11-24) ──────────────
const NS = (n, id) => ({ itemNum: 'CUSTOM RUN', itemType: 'Hopper', subType: '4 BAY CENTERFLOW', roadName: 'NORFOLK SOUTHERN',
  description: 'BLACK / WHITE PRINT HORSE LOGO 4 BAY CENTERFLOW', yearProd: '1997', variation: n, varDesc: 'BLACK / WHITE PRINT HORSE LOGO',
  originalDesc: 'NORFOLK SOUTHERN | CUSTOM RUN | BLACK / WHITE PRINT HORSE LOGO | 4 BAY CENTERFLOW | 311201, 311202, 311203 | 1997',
  runBy: 'RGS', _era: 'weaver', _tab: 'Weaver O', rowId: id });
const RUN = (n, road, who, id) => ({ itemNum: 'CUSTOM RUN', itemType: 'Boxcar', subType: "PS-1 40' BOXCAR", roadName: road, description: road + ' BOXCAR',
  yearProd: '2001', variation: n, varDesc: '', originalDesc: road + ' | CUSTOM RUN', runBy: who, _era: 'weaver', _tab: 'Weaver O', rowId: id });
const ROWS = [
  NS('311201', 'WV311201'), NS('311202', 'WV311202'), NS('311203', 'WV311203'),
  RUN('98539', 'ERIE', "JIM'S TRAIN SHOP", 'WV98539A'), RUN('98539', 'READING', 'PETERSEN SUPPLY', 'WV98539B'), RUN('98539', 'PENNSYLVANIA', 'L&J HOBBIES', 'WV98539C'),
  RUN('1914', '4-H CLUB', '', 'WV1914'),
  RUN('WILDWOOD', 'WILDWOOD', '', 'WVWORDS'),
  { itemNum: 'U1009', itemType: 'Boxcar', roadName: 'SANTA FE', description: 'BOXCAR', variation: '30012', _era: 'weaver', _tab: 'Weaver O', rowId: 'WVU1009' },
  { itemNum: '1914', itemType: 'Accessory', description: 'Lionel 1914', roadName: '', yearProd: '1920', _era: 'prewar', _tab: 'Lionel Pre-War - Items', rowId: 'PR1914' },
  { itemNum: 'CUSTOM RUN', itemType: 'Boxcar', description: 'not Weaver', roadName: '', variation: '424242', _era: 'other_o', _tab: 'Other O Brands', rowId: 'OOCR' },
];
const clone = rs => rs.map(r => Object.assign({}, r));
const by = id => ROWS.find(r => r.rowId === id);

// ── the lookup world: the REAL functions in a sandbox ──────────────────────
function lookupWorld(datSrc, appSrc) {
  const A = appSrc || APPJS, D = datSrc || DAT;
  const sb = { console: { log() {}, warn() {}, error() {} } };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext([
    require('./lib/num-rule').numRuleSource(),
    cfgConst('RR_CUSTOM_RUN'),
    grab(A, 'function rrNumZeroKey('), grab(A, 'function rrNumZeroTwin('), DASH_RULE(A), CR_RULE(A),
    'function baseItemNum(n) { return String(n || "").trim().replace(/[-]?[PDTC]$/i, ""); }',
    grab(A, 'function rrNumSaveAs('),
    'var state = { masterByItem: new Map(), masterByItemAll: null, masterByRowId: new Map(), masterByRowIdAll: null };',
    'var ERA_TABS = {}; var _lkCache = new WeakMap(); var _zkCache = new WeakMap(); var _dkCache = new WeakMap(); var _ckCache = new WeakMap();',
    (CFG.match(/const RR_ROAD_NUMBER_ENDING_ERAS = \[[^\]]*\];/) || ['var RR_ROAD_NUMBER_ENDING_ERAS = [];'])[0].replace('const ', 'var '),
    grab(D, 'function _mIsMotive('), grab(D, 'function _mSuffix('),
    grab(D, 'function _letterKinRows('), grab(D, 'function _zeroKinRows('), grab(D, 'function _looseKinRows('),
    grab(D, 'function _carKinRows('), grab(D, 'function rrCarNumberRows('),
    grab(D, 'function _findMasterCore('), grab(D, 'function _preferEraOf('),
    grab(D, 'function rrMasterKeyOf('), grab(D, 'function rrMasterByKey('), grab(D, 'function rrMasterByRowId('), grab(D, 'function _rrRowIdFits('),
    grab(D, 'function findMaster('), grab(D, 'function _mbAllGet('), grab(D, 'function findAllMaster('),
    require('./lib/row-kind').rowKindSource(undefined, D.indexOf('function rrRowKind(') >= 0 ? D : undefined),
    grab(D, 'function _rrRealRowsOf('),
    grab(D, 'function rrCatalogCandidates('),
    'this.__index = function (rows, allRows) {',
    '  var mk = function (rs) { var m = new Map(); rs.forEach(function (r) { var k = String(r.itemNum).trim(); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }); return m; };',
    '  state.masterByItem = mk(rows); state.masterByItemAll = allRows ? mk(allRows) : null;',
    '  state.masterByRowId = new Map(); rows.concat(allRows || []).forEach(function (r) { if (r.rowId) state.masterByRowId.set(r.rowId, r); });',
    '  ERA_TABS = {}; rows.concat(allRows || []).forEach(function (r) { ERA_TABS[r._era] = { items: r._tab }; });',
    '};',
  ].join('\n;\n'), sb);
  return sb;
}

// ── R: the rule ────────────────────────────────────────────────────────────
{
  const W = lookupWorld();
  const ns2 = by('WV311202');
  ok('R1 a Weaver CUSTOM RUN row is a custom run; Weaver U1009 is not; another catalog\'s "CUSTOM RUN" is not (only RR_CUSTOM_RUN.eras)',
    W.rrCustomRunRow(ns2) && !W.rrCustomRunRow(by('WVU1009')) && !W.rrCustomRunRow(by('OOCR')) && !W.rrCustomRunRow('CUSTOM RUN'));
  ok('R2 the number on the car: 311202; a car whose Variation holds only words has none', W.rrCustomRunNumber(ns2) === '311202' && W.rrCustomRunNumber(by('WVWORDS')) === '' && W.rrCustomRunNumber(by('WVU1009')) === '');
  ok('R3 rrNumCarTwin: 311202, "#311202", "No. 311202", " 311202 " → yes', ['311202', '#311202', 'No. 311202', ' 311202 ', 'no 311202'].every(t => W.rrNumCarTwin(ns2, t)));
  ok('R4 … 31120, 3112020, CUSTOM RUN, 311203 → no; a bare number (no row) → no; a row of another catalog → no',
    !['31120', '3112020', 'CUSTOM RUN', '311203', ''].some(t => W.rrNumCarTwin(ns2, t)) && !W.rrNumCarTwin('311202', '311202') && !W.rrNumCarTwin(by('OOCR'), '424242'));
  ok('R5 rrNumSaveAs: the car is saved under the number on it — 311202, never "CUSTOM RUN" ("#311202" typed → 311202)',
    W.rrNumSaveAs(ns2, '311202') === '311202' && W.rrNumSaveAs(ns2, '#311202') === '311202');
  ok('R6 … and nothing else changes: K675402 typed K-675402 → K675402; Atlas 6502 typed 6502-2 → 6502-2',
    W.rrNumSaveAs({ itemNum: 'K675402', _era: 'kline' }, 'K-675402') === 'K675402' && W.rrNumSaveAs({ itemNum: '6502', _era: 'atlas' }, '6502-2') === '6502-2');
  ok('R7 one run, one key: 311201 and 311202 share it; the ERIE 98539 run and the READING 98539 run do not',
    W.rrCustomRunRunKey(by('WV311201')) === W.rrCustomRunRunKey(ns2) && W.rrCustomRunRunKey(by('WV98539A')) !== W.rrCustomRunRunKey(by('WV98539B')) && W.rrCustomRunRunKey(by('WVU1009')) === '');
}

// ── F: findMaster and friends ──────────────────────────────────────────────
{
  const W = lookupWorld();
  W.__index(clone(ROWS));
  const fm = (n, v, p) => (W.findMaster(n, v || '', p || null) || {}).rowId || null;
  ok('F1 311202 with Weaver named (era) → Bob\'s Norfolk Southern car', fm('311202', '', { era: 'weaver' }) === 'WV311202', fm('311202', '', { era: 'weaver' }));
  ok('F2 … with the maker named (Weaver) → the car', fm('311202', '', { manufacturer: 'Weaver' }) === 'WV311202');
  ok('F3 … with Weaver named as an era LIST (the photo reader\'s shape) → the car', fm('311202', '', { eras: ['weaver'] }) === 'WV311202');
  ok('F4 311202 with NO catalog named → nothing (a number alone never picks a custom run)', fm('311202') === null, fm('311202'));
  ok('F5 311202 with Lionel Postwar named → nothing', fm('311202', '', { era: 'pw' }) === null);
  ok('F6 1914: Pre-War named → Lionel\'s 1914; Weaver named → the 4-H Club custom run; nothing named → Lionel\'s (exact always wins)',
    fm('1914', '', { era: 'prewar' }) === 'PR1914' && fm('1914', '', { era: 'weaver' }) === 'WV1914' && fm('1914') === 'PR1914');
  ok('F7 98539 is on three runs → with Weaver named, still nothing: findMaster never chooses between them', fm('98539', '', { era: 'weaver' }) === null);
  ok('F8 a car whose Variation is words (WILDWOOD) → never found by it', fm('WILDWOOD', '', { era: 'weaver' }) === null);
  ok('F9 Bob\'s saved copy (311202, var 311202, Row ID WV311202) → its car', fm('311202', '311202', { masterRowId: 'WV311202' }) === 'WV311202');
  ok('F10 … saved with only its Master Key (weaver|CUSTOM RUN|311202) → its car', fm('311202', '311202', { masterKey: 'weaver|CUSTOM RUN|311202' }) === 'WV311202');
  ok('F11 a Row ID of ANOTHER car (311203) on a copy saved as 311202 is refused (stale link)', !W._rrRowIdFits(by('WV311203'), '311202', '') && W._rrRowIdFits(by('WV311202'), '311202', '311202'));
  const W2 = lookupWorld();
  W2.__index(clone(ROWS.filter(r => r._era !== 'weaver')), clone(ROWS));
  ok('F12 Weaver not collected (only in the whole-catalog index) → 311202 with Weaver named still finds the car', (W2.findMaster('311202', '', { era: 'weaver' }) || {}).rowId === 'WV311202');
  const cc = n => (W.rrCatalogCandidates(n) || []).map(r => r.rowId).sort().join();
  ok('F13 rrCatalogCandidates 311202 → the car; 98539 → all three runs; 1914 → Lionel\'s only (fills a blank only)',
    cc('311202') === 'WV311202' && cc('98539') === 'WV98539A,WV98539B,WV98539C' && cc('1914') === 'PR1914', [cc('311202'), cc('98539'), cc('1914')].join(' / '));
  ok('F14 rrCarNumberRows lists every car carrying the number once, from both indexes', W.rrCarNumberRows('98539').length === 3 && W2.rrCarNumberRows('311202').length === 1);
  // planted offenders
  const Wp = lookupWorld(plant(plant(DAT, '  if (_kinNamed && typeof _carKinRows === \'function\' && !pool.some(_kinSatisfied)) {', '  if (typeof _carKinRows === \'function\' && !pool.some(_kinSatisfied)) {', 'named'),
    '    const _ck = _carKinRows(idx, k).filter(r => pool.indexOf(r) < 0 && _kinBelongs(r));', '    const _ck = _carKinRows(idx, k).filter(r => pool.indexOf(r) < 0);', 'belongs'));
  Wp.__index(clone(ROWS));
  ok('F15 PLANTED: the "catalog named" gate and the belongs filter taken out → 311202 alone picks the car (what F4 forbids — caught)', (Wp.findMaster('311202', '', null) || {}).rowId === 'WV311202');
  // (the "named" gate is also the cheap early exit — with nothing named the belongs filter alone refuses every car;
  //  the belongs filter is what keeps a NAMED other catalog — Pre-War — from taking a car)
  const Wb = lookupWorld(plant(DAT, '    const _ck = _carKinRows(idx, k).filter(r => pool.indexOf(r) < 0 && _kinBelongs(r));', '    const _ck = _carKinRows(idx, k).filter(r => pool.indexOf(r) < 0);', 'belongs'));
  Wb.__index(clone(ROWS));
  ok('F15b PLANTED: the belongs filter taken out → 311202 with Lionel Pre-War named picks the Weaver car (what F5 forbids — caught)', (Wb.findMaster('311202', '', { era: 'prewar' }) || {}).rowId === 'WV311202');
  // review finding 7: one Master Key for three runs (weaver|CUSTOM RUN|98539) — the Row ID decides
  ok('F18 a saved READING 98539 copy (Row ID WV98539B; its Master Key names the ERIE run first) → still the READING car',
    fm('98539', '98539', { masterRowId: 'WV98539B', masterKey: 'weaver|CUSTOM RUN|98539' }) === 'WV98539B', fm('98539', '98539', { masterRowId: 'WV98539B', masterKey: 'weaver|CUSTOM RUN|98539' }));
  // review finding 5: the cells with extra marks
  const M = lookupWorld(); const m1 = RUN('#90111', 'X', '', 'M1'), m2 = RUN('180733.', 'Y', '', 'M2'), m3 = RUN('26957(yellow', 'Z', '', 'M3'), m4 = RUN('(2ND', 'Q', '', 'M4');
  ok('F19 a cell "#90111" → the number 90111 (typed 90111 or #90111 finds it; saved as 90111); "180733." → 180733; "26957(yellow" → 26957; "(2ND" → none',
    M.rrCustomRunNumber(m1) === '90111' && M.rrNumCarTwin(m1, '90111') && M.rrNumCarTwin(m1, '#90111') && M.rrNumSaveAs(m1, '90111') === '90111'
    && M.rrNumCarTwin(m2, '180733') && M.rrCustomRunNumber(m3) === '26957' && M.rrCustomRunNumber(m4) === '',
    [M.rrCustomRunNumber(m1), M.rrCustomRunNumber(m2), M.rrCustomRunNumber(m3), M.rrCustomRunNumber(m4)].join('/'));
  // review finding 1: "Change catalog entry" with a number typed — the copy takes the number on the car
  vm.runInContext('var RR_ADD_PIECE = { pieceRe: /-(BOX|MBOX|IS)$/i };\n' + grab(DAT, 'function rrNumberMovePlan('), W);
  const st = { personalData: { a: { owned: true, itemNum: 'U1009', inventoryId: '1' } } };
  const mv = W.rrNumberMovePlan(st.personalData.a, by('WV311202'), st, '311202');
  ok('F20 a copy saved as U1009 moved to the custom run by typing 311202 → it becomes No. 311202, never "CUSTOM RUN"', mv.change === true && mv.to === '311202', JSON.stringify([mv.change, mv.to]));
  const mv2 = W.rrNumberMovePlan({ owned: true, itemNum: '1914', inventoryId: '2' }, by('WV1914'), { personalData: {} }, '');
  ok('F21 a Weaver hand entry 1914 picking the 4-H Club car (not on its own list — Lionel\'s 1914 fills it) → no number move', mv2.change === false && mv2.to === '1914', JSON.stringify([mv2.change, mv2.to]));
  const Wm = lookupWorld(plant(DAT, "  if (typeof rrCustomRunNumber === 'function' && rrCustomRunNumber(entry)) to = rrCustomRunNumber(entry);", '', 'move'));
  vm.runInContext('var RR_ADD_PIECE = { pieceRe: /-(BOX|MBOX|IS)$/i };\n' + grab(plant(DAT, "  if (typeof rrCustomRunNumber === 'function' && rrCustomRunNumber(entry)) to = rrCustomRunNumber(entry);", '', 'move'), 'function rrNumberMovePlan('), Wm);
  Wm.__index(clone(ROWS));
  ok('F22 PLANTED: the move not asking for the car\'s number → the copy becomes "CUSTOM RUN" (what F20 forbids — caught)', Wm.rrNumberMovePlan(st.personalData.a, by('WV311202'), st, '311202').to === 'CUSTOM RUN');
  const Wq = lookupWorld(plant(DAT, '    if (_ck.length === 1) pool = _ck.concat(pool);', '    if (_ck.length) pool = _ck.concat(pool);', 'one-car'));
  Wq.__index(clone(ROWS));
  ok('F16 PLANTED: the one-car rule taken out → 98539 picks one of three runs (what F7 forbids — caught)', !!Wq.findMaster('98539', '', { era: 'weaver' }));
  const Wr = lookupWorld(null, plant(APPJS, "  return !!y && /\\d/.test(y) && _rrCarNumKey(n) === y;", '  return !!y;', 'rule'));
  Wr.__index(clone(ROWS));
  ok('F17 PLANTED: the rule comparing nothing → 311203\'s Row ID fits a copy saved as 311202 (what F11 forbids — caught)', Wr._rrRowIdFits(by('WV311203'), '311202', ''));
}

// ── L: the Add list, real code in jsdom ────────────────────────────────────
let JSDOM = null;
try { JSDOM = require('jsdom').JSDOM; } catch (e) {}
function addWorld(sugSrc, appSrc) {
  const A = appSrc || APPJS;
  const dom = new JSDOM('<!doctype html><html><body><input id="wiz-input"><div id="wiz-match"></div><div id="wiz-suggestions"></div></body></html>', { runScripts: 'outside-only', url: 'https://therailroster.com/app/' });
  const win = dom.window;
  win.console = { log() {}, warn() {}, error() {} };
  const brandVar = A.slice(A.indexOf('var _BRAND_LABELS'), A.indexOf('\n', A.indexOf('var _BRAND_LABELS')));
  const eraMap = BROWSE.slice(BROWSE.indexOf('var _ERA_KEY_TO_PERIOD'), BROWSE.indexOf('\n};', BROWSE.indexOf('var _ERA_KEY_TO_PERIOD')) + 3);
  win.eval([
    CFG, TYPES, read('item-search-filters-config.js'), brandVar, eraMap, require('./lib/num-rule').numRuleSource(),
    grab(A, 'function rrNumZeroKey('), grab(A, 'function rrNumZeroTwin('), DASH_RULE(A), CR_RULE(A), grab(A, 'function rrNumSaveAs('),
    grab(A, 'function _manufacturerOfEra('), grab(A, 'function rrErasOfRowMaker('), grab(A, 'function _manufacturerOfItem('), grab(A, 'function _itemEraKey('),
    grab(A, 'function _brandLabel('), grab(A, 'function rrAlsoSoldAsNames('), grab(A, 'function _rrMakerWord('), grab(A, 'function rrRowAlsoSoldBy('),
    grab(BROWSE, 'function _itemEraPeriod('),
    grab(WIZ, 'function _wizPeriodOfYear('), grab(WIZ, 'function _wizPeriodOfRow('), grab(WIZ, 'function _wizScaleOfRow('),
    grab(WIZ, 'function _wizMasterPrefer('), grab(WIZ, 'function _wizAddFilters('), grab(WIZ, 'function _wizAnyAddFilter('),
    grab(WIZ, 'function _wizRowFitsFilters('), grab(WIZ, 'function _wizSameNum('), grab(WIZ, 'function _wizPickMasterRow('),
    'var _ckCache = new WeakMap();', grab(DAT, 'function _carKinRows('), grab(DAT, 'function rrCarNumberRows('),
    'var state = { masterData: [], setData: [], personalData: {}, masterByItem: new Map(), masterByItemAll: null }; var wizard = { data: {}, matchedItem: null, tab: "collection", steps: [{ type: "itemNumGrouping" }], step: 0 }; var _currentEra = "all";',
    'function wizardNext() {} function _updateGroupingButtons() {} function _wizOwnedRefresh() {} function _catalogReady() { return true; } function _wizSetKind() {}',
    sugSrc || SUG,
    'this.__set = function (rows, data, all) {',
    '  var mk = function (rs) { var m = new Map(); rs.forEach(function (r) { var k = String(r.itemNum).trim(); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }); return m; };',
    '  state.masterData = rows; state.masterByItem = mk(rows); state.masterByItemAll = all ? mk(all) : null; _allErasSearchCache = all || null;',
    '  wizard = { data: data || {}, matchedItem: null, tab: "collection", steps: [{ type: "itemNumGrouping" }], step: 0 };',
    '};',
  ].join('\n;\n'));
  return win;
}
function addList(win, q, data, rows, all) {
  win.__set(rows || clone(ROWS), data, all);
  win.updateItemSuggestions(q);
  const el = win.document.getElementById('wiz-suggestions');
  const rs = Array.from(el.querySelectorAll('[data-idx]'));
  return {
    nums: rs.map(x => (x.querySelector('span') || {}).textContent),
    cars: Array.from(el.querySelectorAll('[data-car-twin]')).map(x => x.textContent),
    text: rs.map(x => x.textContent).join(' | '),
    nf: !!el.querySelector('[data-nothing-found]'),
  };
}
if (!JSDOM) {
  ok('L0 the Add-list checks need jsdom (npm install --no-save jsdom) — a missing jsdom is a FAIL, never a skip', false);
} else {
  const W = addWorld();
  let L = addList(W, '311202', { _searchFilterManufacturer: 'Weaver' });
  ok('L1 Weaver picked, 311202 typed → Bob\'s car, shown under 311202 and labelled as a custom run', L.nums.join() === '311202' && L.cars.length === 1 && /Custom run/.test(L.cars[0]), JSON.stringify(L));
  ok('L2 … its details name the car and who ordered the run ("made for RGS")', /NORFOLK SOUTHERN|HORSE LOGO/.test(L.text) && /made for RGS/.test(L.text), L.text);
  L = addList(W, '311202');
  ok('L3 no maker picked, nothing else in the catalog is 311202 → the car is offered (as a choice)', L.nums.join() === '311202' && L.cars.length === 1 && !L.nf, JSON.stringify(L));
  L = addList(W, '311202', { _searchFilterManufacturer: 'Lionel' });
  ok('L4 Lionel picked → no car (the maker filter keeps another maker\'s cars out)', L.cars.length === 0, JSON.stringify(L));
  L = addList(W, '1914');
  ok('L5 1914 with no maker picked → Lionel\'s 1914 only: the custom run never joins an exact answer', L.nums.join() === '1914' && L.cars.length === 0, JSON.stringify(L));
  L = addList(W, '1914', { _searchFilterManufacturer: 'Weaver' });
  ok('L6 1914 with Weaver picked → the 4-H Club custom run', L.cars.length === 1 && L.nums.join() === '1914', JSON.stringify(L));
  L = addList(W, 'weaver 1914');
  ok('L7 "weaver 1914" typed (the maker as a word) → the custom run too', L.cars.length === 1, JSON.stringify(L));
  L = addList(W, '98539', { _searchFilterManufacturer: 'Weaver' });
  ok('L8 98539 with Weaver picked → all three runs to choose from', L.cars.length === 3 && /ERIE/.test(L.text) && /READING/.test(L.text) && /PENNSYLVANIA/.test(L.text), JSON.stringify(L));
  L = addList(W, '1914', {}, clone(ROWS.filter(r => r._era === 'weaver')), clone(ROWS));
  ok('L9 1914, no maker, Weaver loaded and Lionel\'s 1914 only in the whole catalog → still no custom run (exact anywhere wins)', L.cars.length === 0, JSON.stringify(L));
  // the one row picker
  const pick = (data, n, rows, all) => { W.__set(rows || clone(ROWS), data, all); return (W._wizResolveAddRow(n, { raw: true }) || {}).rowId || null; };
  ok('L10 the row picker: Weaver picked + 311202 → the car', pick({ _searchFilterManufacturer: 'Weaver' }, '311202') === 'WV311202');
  ok('L11 … Weaver catalog opened (era weaver) + 311202 → the car', pick({ _era: 'weaver' }, '311202') === 'WV311202');
  ok('L12 … no maker picked + 311202 → no pick (the list shows the car; the collector taps it)', pick({}, '311202') === null);
  ok('L13 … Weaver picked + 98539 → no pick (three runs)', pick({ _searchFilterManufacturer: 'Weaver' }, '98539') === null);
  ok('L14 … Weaver picked + 1914, Lionel\'s 1914 in the whole catalog only → still the custom run (a Weaver row is the only one the filters accept)',
    pick({ _searchFilterManufacturer: 'Weaver' }, '1914', clone(ROWS.filter(r => r._era === 'weaver')), clone(ROWS)) === 'WV1914');
  // a tap
  const tap = (src, data, typed, id) => {
    const Wt = addWorld(src);
    Wt.__set(clone(ROWS), data);
    Wt.document.getElementById('wiz-input').value = typed;
    const row = Wt.state.masterData.find(r => r.rowId === id);
    try { Wt.selectSuggestion(row.variation, row.roadName, row.itemType, { row: row }); } catch (e) {}
    return { num: Wt.wizard.data.itemNum, box: Wt.document.getElementById('wiz-input').value, row: Wt.wizard.matchedItem && Wt.wizard.matchedItem.rowId,
             pick: (Wt._wizResolveAddRow(Wt.wizard.data.itemNum || typed, { raw: true }) || {}).rowId || null };
  };
  let tp = tap(null, {}, '311202', 'WV311202');
  ok('L15 no maker picked, the car TAPPED → the add holds the car and saves 311202 (box, save number, picker agree)', tp.num === '311202' && tp.box === '311202' && tp.row === 'WV311202' && tp.pick === 'WV311202', JSON.stringify(tp));
  tp = tap(null, { _searchFilterManufacturer: 'Weaver' }, '98539', 'WV98539B');
  ok('L16 98539, the READING run tapped → the add keeps the READING car', tp.num === '98539' && tp.pick === 'WV98539B', JSON.stringify(tp));
  W.__set(clone(ROWS), {});
  W.wizard.matchedItem = W.state.masterData.find(r => r.rowId === 'WV311202');
  ok('L17 a car only HELD (not tapped), no maker picked → no pick by its number alone', (W._wizResolveAddRow('311202', { raw: true }) || null) === null);
  W.__set(clone(ROWS), {});
  ok('L18 _wizNumberInCatalog: 311202 counts as in the catalog; 999999 does not', W._wizNumberInCatalog('311202') && !W._wizNumberInCatalog('999999'));
  W.__set(clone(ROWS), { _searchFilterManufacturer: 'Weaver' });
  W.document.getElementById('wiz-input').value = '311202';
  W.lookupItem('311202');
  const found = W.document.getElementById('wiz-match').textContent;
  ok('L19 the Found line under the box: the car, and no "multiple variations — select on next step" promise (the number on the car IS its variation)',
    /Found/.test(found) && /NORFOLK SOUTHERN/.test(found) && !/multiple variations/.test(found), found);
  // planted offenders
  // review finding 2: a row that only CONTAINS the digits (MTH 20-98539) never hides the cars
  const MTH = { itemNum: '20-98539', itemType: 'Boxcar', description: 'MTH boxcar', roadName: '', _era: 'mth_o', _tab: 'MTH O', rowId: 'MT98539' };
  L = addList(W, '98539', {}, clone(ROWS).concat([Object.assign({}, MTH)]));
  ok('L25 98539, no maker, MTH 20-98539 only CONTAINS it → the three runs are still offered beside it', L.cars.length === 3, JSON.stringify(L));
  L = addList(addWorld(plant(SUG, "(!candidates.some(function (c) { return c && (c._zeroTwin || rrNumSameAsTyped(c.num, numPart)); }) && !(function () {", "(!candidates.length && !(function () {", 'contains')),
    '98539', {}, clone(ROWS).concat([Object.assign({}, MTH)]));
  ok('L26 PLANTED: "any row at all" instead of "a row that IS the number" → the MTH contains-row hides the cars (what L25 forbids — caught)', L.cars.length === 0, JSON.stringify(L));
  const Wj = addWorld(plant(SUG, "      var _crJoin = _crRows.length && (_wizCarNumNamed(_fset) || (!candidates.some(", "      var _crJoin = _crRows.length && (true || (!candidates.some(", 'join'));
  L = addList(Wj, '1914');
  ok('L20 PLANTED: the custom runs always joining → 1914 with no maker lists the 4-H Club car beside Lionel\'s (what L5 forbids — caught)', L.cars.length === 1, JSON.stringify(L));
  const Wn = addWorld(plant(SUG, "  if (!rows.length && typeof rrCarNumberRows === 'function' && _wizCarNumNamed(fset)) {", "  if (!rows.length && typeof rrCarNumberRows === 'function') {", 'named'));
  Wn.__set(clone(ROWS), {});
  ok('L21 PLANTED: the picker not asking "is Weaver named?" → 311202 with no maker picks the car (what L12 forbids — caught)', (Wn._wizResolveAddRow('311202', { raw: true }) || {}).rowId === 'WV311202');
  const Wo = addWorld(plant(SUG, '    if (_cr.length === 1) {', '    if (_cr.length) {', 'one-car'));
  Wo.__set(clone(ROWS), { _searchFilterManufacturer: 'Weaver' });
  ok('L22 PLANTED: the picker\'s one-car rule taken out → 98539 picks one run (what L13 forbids — caught)', !!Wo._wizResolveAddRow('98539', { raw: true }));
  tp = tap(plant(SUG, "              || _twinOk(typeof rrNumCarTwin === 'function' && rrNumCarTwin(cur, numLC))) && fits(cur)", "              ) && fits(cur)", 'tap'), {}, '311202', 'WV311202');
  ok('L23 PLANTED: the picker forgetting a tapped car → the tap is lost (what L15 forbids — caught)', tp.pick === null, JSON.stringify(tp));
  const Wv = addWorld(plant(SUG, "${(!(typeof rrNumCarTwin === 'function' && rrNumCarTwin(match, trimmed)) && ((typeof _wizAsksVariation", "${(((typeof _wizAsksVariation", 'found-note'));
  Wv.eval('function _wizAsksVariation() { return true; }');
  Wv.__set(clone(ROWS), { _searchFilterManufacturer: 'Weaver' });
  Wv.lookupItem('311202');
  ok('L24 PLANTED: the Found line asking the variation question of "CUSTOM RUN" → it promises a variation step (caught)', /multiple variations/.test(Wv.document.getElementById('wiz-match').textContent));
}

// ── W: the save writes the car's number as its variation ───────────────────
{
  const body = grab(SAVE, 'const _carRow = ');
  ok('W1 the save: a car added by the number on it takes that number as its variation (asks rrNumCarTwin, never a copy of it)',
    /rrNumCarTwin\(wizard\.matchedItem, _rawItemNum\)/.test(SAVE) && /const variation = \(d\.variation \|\| \(_carRow \? String\(_carRow\.variation\) : ''\)\)\.trim\(\);/.test(SAVE), body.slice(0, 200));
}

// ── C: "Now in the catalog" offers the car to Bob's hand entry ─────────────
{
  const W = lookupWorld();
  W.__index(clone(ROWS));
  const sb = W;
  vm.runInContext([
    'function rrIsAppMadeNumber() { return false; } var RR_ADD_PIECE = { pieceRe: /-(BOX|MBOX|IS)$/i };',
    'function rrCopyIsUnlinked(pd) { return pd.era === "Manual"; }',
    'function rrMakerOf(o) { var r = o.row || {}; return r._era === "weaver" ? "Weaver" : (r._era === "prewar" ? "Lionel" : "Other"); }',
    'function rrMakerSame(a, b) { return String(a).toLowerCase() === String(b).toLowerCase(); }',
    grab(TOOLS, 'function rrCatalogNowSkips('), grab(TOOLS, 'function rrCatalogNowFits('),
  ].join('\n;\n'), sb);
  const bob = { owned: true, itemNum: '311202', manufacturer: 'Weaver', era: 'Manual', inventoryId: '77' };
  const fits = sb.rrCatalogNowFits(bob).map(r => r.rowId).join();
  ok('C1 Bob\'s hand entry "Weaver 311202" → "Now in the catalog" offers his car', fits === 'WV311202', fits);
  const lio = Object.assign({}, bob, { manufacturer: 'Lionel' });
  ok('C2 the same number saved as Lionel → nothing offered (the maker must match)', sb.rrCatalogNowFits(lio).length === 0);
  // review finding 4: a Weaver hand entry whose number is also Lionel's (1914)
  const w1914 = Object.assign({}, bob, { itemNum: '1914' });
  ok('C3 a Weaver hand entry 1914 (Lionel Pre-War also has a 1914) → the 4-H Club custom run is offered', sb.rrCatalogNowFits(w1914).map(r => r.rowId).join() === 'WV1914', sb.rrCatalogNowFits(w1914).map(r => r.rowId).join());
  ok('C4 … and a Lionel hand entry 1914 → Lionel\'s 1914, never the Weaver car', sb.rrCatalogNowFits(Object.assign({}, w1914, { manufacturer: 'Lionel' })).map(r => r.rowId).join() === 'PR1914');
  // second review, finding 1: three runs carrying 98539 are three CARS — never "not sure of the variation"
  vm.runInContext(grab(TOOLS, 'function _cnwSameItem('), sb);
  const w98 = sb.rrCatalogNowFits(Object.assign({}, bob, { itemNum: '98539' }));
  ok('C6 a Weaver hand entry 98539 → the three runs to pick from, and NO "not sure of the variation" (it would write the first run\'s car)',
    w98.length === 3 && sb._cnwSameItem(w98) === false && sb._cnwSameItem([by('PR1914'), Object.assign({}, by('PR1914'), { variation: '2' })]) === true, w98.length);
  vm.runInContext(grab(plant(TOOLS, "  if (typeof rrCustomRunRow === 'function' && rows.some(rrCustomRunRow)) return false;\n", '', 'sameitem'), 'function _cnwSameItem('), sb);
  ok('C7 PLANTED: the custom-run check taken out of "same item" → 98539 offers "not sure" (what C6 forbids — caught)', sb._cnwSameItem(w98) === true);
  vm.runInContext(grab(plant(TOOLS, '  if (!out.length && typeof rrCarNumberRows === \'function\') {', '  if (false) {', 'cn'), 'function rrCatalogNowFits('), sb);
  ok('C5 PLANTED: "Now in the catalog" not asking for the cars → the Weaver 1914 hand entry gets nothing (what C3 forbids — caught)', sb.rrCatalogNowFits(w1914).length === 0);
}

// ── D: the other doors save and show the car by the number on it ───────────
{
  const COLL = read('app-collection.js'), READER = require('./lib/pin-source').pinSource();   // the Photo Inbox, read the ONE way (pin_source_tests R1)
  const R = lookupWorld(); const car = by('WV311202');
  // D1 — addFromBrowse run for real up to the wizard it opens (the modal and steps stubbed)
  const afbNum = (src) => {
    const s = { state: { masterData: [Object.assign({}, car)] }, document: { getElementById: () => ({ classList: { add() {} } }), body: { style: {} } },
      _buildWizardModal() {}, getSteps: () => [{ id: 'condition' }], getGroupingOptions: () => [], renderWizardStep() {}, rrCustomRunNumber: R.rrCustomRunNumber, wizard: null };
    vm.createContext(s);
    try { vm.runInContext(grab(src, 'function addFromBrowse(') + '\naddFromBrowse(0);', s); } catch (e) {}
    return s.wizard && s.wizard.data && s.wizard.data.itemNum;
  };
  ok('D1 Master Catalog\'s Add button on Bob\'s car opens the add as No. 311202 (the same number the Add list saves)', afbNum(COLL) === '311202', afbNum(COLL));
  ok('D1b PLANTED: the Add button taking the row\'s own item number → "CUSTOM RUN" (caught)',
    afbNum(plant(COLL, "const _addNum = ((typeof rrCustomRunNumber === 'function') && rrCustomRunNumber(item)) || item.itemNum;", 'const _addNum = item.itemNum;', 'afb')) === 'CUSTOM RUN');
  // D3 — the card label's number, run for real
  const entryNum = (src) => { const s = { rrCustomRunNumber: R.rrCustomRunNumber }; vm.createContext(s); vm.runInContext(grab(src, 'function _entryNum('), s); return s._entryNum(car); };
  ok('D3 "Change catalog entry" names Bob\'s car No. 311202, never "No. CUSTOM RUN" (and its label line asks _entryNum)', entryNum(COLL) === '311202' && /'No\. ' \+ rrEsc\(_entryNum\(r\)\)/.test(COLL));
  ok('D3b PLANTED: the label taking the row\'s item number → "CUSTOM RUN" (caught)',
    entryNum(plant(COLL, "function _entryNum(r) { return String((r && ((typeof rrCustomRunNumber === 'function' && rrCustomRunNumber(r)) || r.itemNum)) || '').trim(); }", "function _entryNum(r) { return String((r && r.itemNum) || '').trim(); }", 'label')) === 'CUSTOM RUN');
  // D2 / D4 — the banner and the photo reader ask the ONE rule (scanned; each scan proven on a planted copy)
  const bannerAsks = (w) => /rrNumCarTwin\(wizard\.matchedItem, num\)/.test(w);
  ok('D2 the Add screen\'s banner keeps a held car for the number on it (asks rrNumCarTwin)', bannerAsks(WIZ));
  ok('D2b PLANTED: the banner without it is caught', !bannerAsks(plant(WIZ, "        || (typeof rrNumCarTwin === 'function' && rrNumCarTwin(wizard.matchedItem, num)))) {", "        )) {", 'banner')));
  const readerAsks = (r) => (r.match(/rrCustomRunNumber\((_qm3\.row|qm\.row|_row)\)/g) || []).length;
  ok('D4 the photo reader answers a custom run with the number on its car in all three places it reads a row\'s number', readerAsks(READER) === 3);
  ok('D4b PLANTED: one of the three reverting to row.itemNum is caught',
    readerAsks(plant(READER, "String((typeof rrCustomRunNumber === 'function' && rrCustomRunNumber(_row)) || _row.itemNum || _try[lt])", 'String(_row.itemNum || _try[lt])', 'reader')) === 2);
  ok('D5 "Change catalog entry" always lists the SAVED entry (findMaster of the copy — never a pick staged in the panel)',
    /const _savedRow = \(typeof findMaster === 'function'\) \? findMaster\(pd\.itemNum \|\| item\.itemNum, pd\.variation \|\| '', pd\) : null;/.test(COLL) && /cands\.unshift\(_savedRow\)/.test(COLL) && !/cands\.unshift\(cur\)/.test(COLL));
}

// ── B: the Master Catalog search looks at the number on the car ────────────
{
  const hay = BROWSE.slice(BROWSE.indexOf('const haystack = `${item.itemNum}'), BROWSE.indexOf('\n', BROWSE.indexOf('const haystack = `${item.itemNum}')));
  ok('B1 the Master Catalog search words include the number on a custom-run car (rrCustomRunNumber)', /rrCustomRunNumber\(item\)/.test(hay), hay);
  const W = lookupWorld();
  const item = by('WV311202'), pd = null;
  const mk = new Function('item', 'pd', 'rrCustomRunNumber', 'return ' + hay.replace('const haystack = ', '').replace(/;\s*(\/\/.*)?$/, '') + ';');
  const h = mk(item, pd, W.rrCustomRunNumber);
  ok('B2 … so searching 311202 finds Bob\'s car; a regular row adds nothing', h.indexOf('311202') >= 0 && mk(by('WVU1009'), null, W.rrCustomRunNumber).indexOf('30012') < 0, h);
}

// ── S: scans, each proven on a planted offender ────────────────────────────
const appFiles = fs.readdirSync(APP).filter(f => /\.js$/.test(f));
function ruleCopies(over) {
  let n = 0;
  appFiles.forEach(f => {
    const s = (over && over[f] !== undefined) ? over[f] : read(f);
    n += (s.match(/function rrNumCarTwin\(|function rrCustomRunNumber\(|function rrCustomRunRow\(|function _rrCarNumKey\(/g) || []).length;
  });
  return n;
}
ok('S1 the rule is written once: rrCustomRunRow / rrCustomRunNumber / rrNumCarTwin / _rrCarNumKey live in app.js only', ruleCopies() === 4 && (APPJS.match(/function (rrNumCarTwin|rrCustomRunNumber|rrCustomRunRow|_rrCarNumKey)\(/g) || []).length === 4);
ok('S2 PLANTED: a second copy of the rule in the Add list is caught', ruleCopies({ 'wizard-suggestions.js': SUG + '\nfunction rrNumCarTwin(row, t) { return false; }\n' }) === 5);
function noNumberReaders(over) {
  let n = 0;
  appFiles.forEach(f => {
    if (f === 'config.js' || f === 'app.js') return;
    const s = (over && over[f] !== undefined) ? over[f] : read(f);
    n += (s.match(/\.noNumber\b/g) || []).length;
  });
  return n;
}
const _appNoNum = (APPJS.match(/\.noNumber\b/g) || []).length, _ruleNoNum = (grab(APPJS, 'function rrCustomRunRow(').match(/\.noNumber\b/g) || []).length;
ok('S3 only the rule reads RR_CUSTOM_RUN.noNumber (one place decides what "no number" means): no other file, and in app.js only inside rrCustomRunRow',
  noNumberReaders() === 0 && _appNoNum === _ruleNoNum && _ruleNoNum > 0, noNumberReaders() + ' ' + _appNoNum + ' ' + _ruleNoNum);
ok('S4 PLANTED: the Master Catalog reading noNumber itself is caught', noNumberReaders({ 'browse.js': BROWSE + '\nvar x = RR_CUSTOM_RUN.noNumber;\n' }) === 1);
ok('S5 the catalogs that file a car by its number are named once, in config.js (RR_CUSTOM_RUN.eras = weaver)', /eras:\s*\['weaver'\]/.test(cfgConst('RR_CUSTOM_RUN')));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
