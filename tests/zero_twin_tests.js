#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// LEADING ZEROS — the fallback-only rule (PLAN_2026-11-05_LEADING_ZEROS, step 1)
// [stated] Brad 2026-11-05 06:16 CT "on the leading zero, does are app not
// handle that with the search rules" → 07:34 CT "yes" to the fallback-only rule.
//
// Office commits before v0.9.2044 dropped the zeros off 1,931 catalog numbers
// (S-Helper "01511" is stored as 1511) and nothing found "01511" again. But a
// zero is sometimes the WHOLE difference: the live catalog holds 257 numbers on
// the same tab both ways, and they are different items (fixture
// zero_pairs_2026-11-05.json, read from the live master). So 01511 ↔ 1511 is a
// FALLBACK — asked only when nothing answers to the number as written.
//   R  the rule (rrNumZeroKey / rrNumZeroTwin, app.js)
//   P  every one of the 257 real pairs stays apart in findMaster, both ways,
//      with and without a catalog named
//   F  findMaster: 01511 reaches S-Helper's 1511 only inside the catalog named;
//      an exact row in the full catalog beats a twin in the loaded one; a saved
//      Row ID keeps its link when the catalog row gets its zero back (step 2);
//      findAllMaster and rrCatalogCandidates fill a blank only
//   L  the Add list (real code, jsdom): 01511 shows the 1511 rows labelled
//      "… · listed as 1511", no "Use as typed" row; 022 never shows 22; 22 and
//      1511 unchanged; the one row picker (_wizResolveAddRow) agrees
//   S  scans, each with a planted offender: the rule lives once; the Add list,
//      findMaster and the Master Catalog search each ask it only as a fallback
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
const BROWSE = read('browse.js'), CFG = read('config.js'), TYPES = read('type-groups.js');
const PAIRS = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'zero_pairs_2026-11-05.json'), 'utf8')).pairs;

// ── the lookup world: the REAL functions in a sandbox ──────────────────────
function lookupWorld(datSrc, appSrc) {
  const sb = { console: { log() {}, warn() {}, error() {} } };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext([
    grab(appSrc || APPJS, 'function rrNumZeroKey('), grab(appSrc || APPJS, 'function rrNumZeroTwin('),
    'function baseItemNum(n) { return String(n || "").trim().replace(/[-]?[PDTC]$/i, ""); }',
    'var state = { masterByItem: new Map(), masterByItemAll: null, masterByRowId: new Map(), masterByRowIdAll: null };',
    'var ERA_TABS = {}; var _lkCache = new WeakMap(); var _zkCache = new WeakMap();',
    grab(datSrc, 'function _mIsMotive('), grab(datSrc, 'function _mSuffix('),
    grab(datSrc, 'function _letterKinRows('), grab(datSrc, 'function _zeroKinRows('),
    grab(datSrc, 'function _findMasterCore('), grab(datSrc, 'function _preferEraOf('),
    grab(datSrc, 'function rrMasterByKey('), grab(datSrc, 'function rrMasterByRowId('), grab(datSrc, 'function _rrRowIdFits('),
    grab(datSrc, 'function findMaster('), grab(datSrc, 'function _mbAllGet('), grab(datSrc, 'function findAllMaster('),
    // 2026-11-07 (onerow): THE row-kind rule + era cleaner findMaster asks (from this app-data.js when it has them)
    require('./lib/row-kind').rowKindSource(undefined, datSrc.indexOf('function rrRowKind(') >= 0 ? datSrc : undefined),
    grab(datSrc.indexOf('function _rrRealRowsOf(') >= 0 ? datSrc : DAT, 'function _rrRealRowsOf('),
    grab(datSrc, 'function rrCatalogCandidates('),
    'this.__index = function (rows, allRows) {',
    '  var mk = function (rs) { var m = new Map(); rs.forEach(function (r) { var k = String(r.itemNum).trim(); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }); return m; };',
    '  state.masterByItem = mk(rows); state.masterByItemAll = allRows ? mk(allRows) : null;',
    '  state.masterByRowId = new Map(); rows.concat(allRows || []).forEach(function (r) { if (r.rowId) state.masterByRowId.set(r.rowId, r); });',
    '  ERA_TABS = {}; rows.concat(allRows || []).forEach(function (r) { ERA_TABS[r._era] = { items: r._tab }; });',
    '};',
  ].join('\n;\n'), sb);
  return sb;
}
const eraOf = tab => 'e_' + tab.replace(/[^a-z0-9]/gi, '').toLowerCase();
const row = (num, tab, extra) => Object.assign({ itemNum: num, _tab: tab, _era: eraOf(tab), itemType: 'Boxcar', description: tab + ' ' + num, rowId: 'R' + tab.replace(/\W/g, '') + num }, extra || {});

// ── R: the rule ────────────────────────────────────────────────────────────
{
  const W = lookupWorld(DAT);
  const K = W.rrNumZeroKey, T = W.rrNumZeroTwin;
  ok('R1 the key: 01511 → 1511, 022 → 22, 0111-7 → 111-7, 00251 → 251', K('01511') === '1511' && K('022') === '22' && K('0111-7') === '111-7' && K('00251') === '251');
  ok('R2 the key: 0 stays 0, 00 → 0, 1511 stays, X6454 and CO-1 untouched', K('0') === '0' && K('00') === '0' && K('1511') === '1511' && K('X6454') === 'X6454' && K('CO-1') === 'CO-1');
  ok('R3 twins: 01511 / 1511 both ways, 022 / 22, 001 / 1', T('01511', '1511') && T('1511', '01511') && T('022', '22') && T('001', '1'));
  ok('R4 not twins: a number and itself, 1511 / 15110, 6-8359 / 8359, letters', !T('1511', '1511') && !T('1511', '15110') && !T('6-8359', '8359') && !T('X01511', 'X1511') && !T('', '0'));
}

// ── P: every real pair stays apart ─────────────────────────────────────────
{
  const W = lookupWorld(DAT);
  const rows = [];
  PAIRS.forEach(p => { rows.push(row(p.zero, p.tab, { itemType: p.zeroType })); rows.push(row(p.plain, p.tab, { itemType: p.plainType })); });
  W.__index(rows, rows);
  let bad = [];
  PAIRS.forEach(p => {
    [[p.zero, p.zero], [p.plain, p.plain]].forEach(([asked, want]) => {
      const a = W._findMasterCore(W.state.masterByItem, asked, null, null);
      const b = W._findMasterCore(W.state.masterByItem, asked, null, { era: eraOf(p.tab) });
      const c = W.findMaster(asked, null, { era: eraOf(p.tab) });
      if (!a || a.itemNum !== want || !b || b.itemNum !== want || !c || c.itemNum !== want) bad.push([p.tab, asked, a && a.itemNum, b && b.itemNum, c && c.itemNum]);
    });
  });
  ok('P1 all ' + PAIRS.length + ' real pairs on the live catalog (Lionel 022/22, Pre-War 001/1, Atlas O 0804/804, Williams 00251/251 …) resolve to themselves, both spellings, with and without a catalog named', PAIRS.length >= 250 && bad.length === 0, JSON.stringify(bad.slice(0, 5)));
  const fa = W.findAllMaster('022').map(r => r.itemNum);
  ok('P2 findAllMaster("022") lists only 022 rows, never 22', fa.length > 0 && fa.every(n => n === '022'), JSON.stringify(fa));
}

// ── F: findMaster and friends ──────────────────────────────────────────────
{
  const W = lookupWorld(DAT);
  const sh = row('1511', 'S-Helper Service S', { itemType: 'Reefer', rowId: 'SH1511' });
  const pre = row('1511', 'Lionel Pre-War', { itemType: 'Steam Locomotive', rowId: 'PRE1511' });
  const am = row('1511', 'American Models S', { rowId: 'AM1511' });
  const pw22 = row('22', 'Lionel PW - Items', { rowId: 'PW22' }), pw022 = row('022', 'Lionel PW - Items', { rowId: 'PW022' });
  W.__index([sh, pre, am, pw22, pw022], [sh, pre, am, pw22, pw022]);
  let r = W.findMaster('01511', null, { era: eraOf('S-Helper Service S') });
  ok('F1 01511 typed, S-Helper named → S-Helper\'s 1511 (was: nothing)', r === sh, r && r._tab);
  r = W.findMaster('01511', null, { era: eraOf('Lionel PW - Items') });
  ok('F2 01511 typed, Lionel Postwar named (no 1511 there) → nothing, never another maker\'s 1511', r === null, r && r._tab);
  r = W.findMaster('01511', null, { eras: [eraOf('S-Helper Service S')] });
  ok('F3 … the Photo Inbox\'s era LIST works the same', r === sh, r && r._tab);
  r = W.findMaster('022', null, { era: eraOf('Lionel PW - Items') });
  ok('F4 022 with 022 in the catalog → 022 (the twin never steps in)', r === pw022, r && r.itemNum);
  r = W.findMaster('22', null, { era: eraOf('Lionel PW - Items') });
  ok('F5 22 with 22 in the catalog → 22', r === pw22, r && r.itemNum);
  // step 2 — the catalog gets its zero back
  const sh0 = row('01511', 'S-Helper Service S', { itemType: 'Reefer', rowId: 'SH1511' });
  W.__index([sh0, pre], [sh0, pre]);
  r = W.findMaster('1511', null, { era: eraOf('S-Helper Service S') });
  ok('F6 after step 2: 1511 typed (or saved), S-Helper named → the catalog\'s 01511', r === sh0, r && r.itemNum);
  r = W.findMaster('1511', null, { era: eraOf('S-Helper Service S'), masterRowId: 'SH1511' });
  ok('F7 after step 2: a copy saved as 1511 keeps its Row ID link to the 01511 row', r === sh0, r && r.itemNum);
  ok('F8 _rrRowIdFits: 01511 row / saved 1511 → fits; saved 1512 → refused', W._rrRowIdFits(sh0, '1511', '') && !W._rrRowIdFits(sh0, '1512', ''));
  const cc = W.rrCatalogCandidates('1511').map(x => x.itemNum + '@' + x._tab);
  ok('F9 rrCatalogCandidates("1511") still lists the exact 1511 (Pre-War) and only fills a blank', cc.length === 1 && cc[0] === '1511@Lionel Pre-War', JSON.stringify(cc));
  W.__index([sh0], [sh0]);
  const cc2 = W.rrCatalogCandidates('1511').map(x => x.itemNum);
  ok('F10 … with no exact 1511 anywhere it offers the 01511 row', cc2.join() === '01511', JSON.stringify(cc2));
  // an exact row in the full catalog beats a twin in the loaded one
  const exact0 = row('01511', 'Somebody O', { rowId: 'SB01511' });
  W.__index([sh], [sh, exact0]);
  r = W.findMaster('01511', null, null);
  ok('F11 01511 typed: the full catalog\'s exact 01511 beats the loaded catalog\'s twin 1511', r === exact0, r && (r.itemNum + '@' + r._tab));
  W.__index([sh], [sh]);
  r = W.findMaster('01511', null, null);
  ok('F12 … and with no exact row anywhere the twin answers (no catalog named)', r === sh, r && r._tab);
  const fa = W.findAllMaster('01511').map(x => x.itemNum);
  ok('F13 findAllMaster("01511") fills the blank with the 1511 rows', fa.join() === '1511', JSON.stringify(fa));
}

// ── L: the Add list, real code in jsdom ────────────────────────────────────
let JSDOM = null;
try { JSDOM = require('jsdom').JSDOM; } catch (e) {}
function addWorld(sugSrc) {
  const dom = new JSDOM('<!doctype html><html><body><input id="wiz-input"><div id="wiz-match"></div><div id="wiz-suggestions"></div></body></html>', { runScripts: 'outside-only', url: 'https://therailroster.com/app/' });
  const win = dom.window;
  win.console = { log() {}, warn() {}, error() {} };
  const brandVar = APPJS.slice(APPJS.indexOf('var _BRAND_LABELS'), APPJS.indexOf('\n', APPJS.indexOf('var _BRAND_LABELS')));
  const eraMap = BROWSE.slice(BROWSE.indexOf('var _ERA_KEY_TO_PERIOD'), BROWSE.indexOf('\n};', BROWSE.indexOf('var _ERA_KEY_TO_PERIOD')) + 3);
  win.eval([
    CFG, TYPES, brandVar, eraMap,
    grab(APPJS, 'function rrNumZeroKey('), grab(APPJS, 'function rrNumZeroTwin('),
    grab(APPJS, 'function _manufacturerOfEra('), grab(APPJS, 'function _manufacturerOfItem('), grab(APPJS, 'function _itemEraKey('),
    grab(APPJS, 'function _brandLabel('), grab(APPJS, 'function rrAlsoSoldAsNames('), grab(APPJS, 'function _rrMakerWord('), grab(APPJS, 'function rrRowAlsoSoldBy('),
    grab(BROWSE, 'function _itemEraPeriod('),
    grab(WIZ, 'function _wizPeriodOfYear('), grab(WIZ, 'function _wizPeriodOfRow('), grab(WIZ, 'function _wizScaleOfRow('),
    grab(WIZ, 'function _wizMasterPrefer('), grab(WIZ, 'function _wizAddFilters('), grab(WIZ, 'function _wizAnyAddFilter('),
    grab(WIZ, 'function _wizRowFitsFilters('), grab(WIZ, 'function _wizSameNum('), grab(WIZ, 'function _wizPickMasterRow('),
    'var state = { masterData: [], setData: [], personalData: {} }; var wizard = { data: {}, matchedItem: null, tab: "collection", steps: [{ type: "itemNumGrouping" }], step: 0 }; var _currentEra = "all";',
    'function wizardNext() {} function _updateGroupingButtons() {} function _wizOwnedRefresh() {} function _catalogReady() { return true; } function _wizSetKind() {}',
    sugSrc,
    'this.__set = function (rows, data) { state.masterData = rows; wizard = { data: data || {}, matchedItem: null, tab: "collection", steps: [{ type: "itemNumGrouping" }], step: 0 }; };',
  ].join('\n;\n'));
  return win;
}
const AROWS = [
  { itemNum: '1511', itemType: 'Reefer', description: 'Hood Milk Wooden Billboard Reefer', roadName: 'Hood', yearProd: '2004', _era: 'shelper', _tab: 'S-Helper Service S', rowId: 'SH1511' },
  { itemNum: '1511', itemType: 'Steam Locomotive', description: '0-4-0 Locomotive', roadName: '', yearProd: '1933', _era: 'prewar', _tab: 'Lionel Pre-War', rowId: 'PRE1511' },
  { itemNum: '022', itemType: 'Track', description: 'Remote Control Switches (O)', roadName: '', yearProd: '1938', _era: 'pw', _tab: 'Lionel PW - Items', rowId: 'PW022' },
  { itemNum: '22', itemType: 'Track', description: 'Manual Switch', roadName: '', yearProd: '1906', _era: 'pw', _tab: 'Lionel PW - Items', rowId: 'PW22' },
];
function addList(win, q, data) {
  win.__set(AROWS.map(r => Object.assign({}, r)), data);
  win.updateItemSuggestions(q);
  const el = win.document.getElementById('wiz-suggestions');
  const rs = Array.from(el.querySelectorAll('[data-idx]'));
  return {
    nums: rs.map(x => (x.querySelector('span') || {}).textContent),
    twins: Array.from(el.querySelectorAll('[data-zero-twin]')).map(x => x.textContent),
    contains: !!el.querySelector('[data-contains-num]'), typed: !!el.querySelector('[data-typed-num]'),
    nf: !!el.querySelector('[data-nothing-found]'),
    green: rs.filter(x => /2ecc71|46, ?204, ?113/.test(x.getAttribute('style') || '')).length,
  };
}
if (!JSDOM) {
  ok('L0 the Add-list checks need jsdom (npm install --no-save jsdom) — a missing jsdom is a FAIL, never a skip', false);
} else {
  const W = addWorld(SUG);
  let L = addList(W, '01511');
  ok('L1 01511 typed → the 1511 rows (was: "No item found")', L.nums.length === 2 && L.nums.every(n => n === '1511') && !L.nf, JSON.stringify(L));
  ok('L2 … each says what it is ("… · listed as 1511"), no "contains" label, highlighted as the number', L.twins.length === 2 && L.twins.every(t => /listed as 1511/.test(t)) && !L.contains && L.green === 2, JSON.stringify(L));
  ok('L3 … and no "Use 01511 as typed, not in the catalog" row — it IS in the catalog', !L.typed, JSON.stringify(L));
  L = addList(W, '022');
  ok('L4 022 typed → 022 only: the twin 22 never joins an exact answer', L.nums.join() === '022' && !L.twins.length, JSON.stringify(L));
  L = addList(W, '22');
  ok('L5 22 typed → unchanged from today: 22, and 022 because it contains 22', L.nums.indexOf('22') >= 0 && L.nums.indexOf('022') >= 0 && !L.twins.length, JSON.stringify(L));
  L = addList(W, '1511');
  ok('L6 1511 typed → unchanged: both 1511 rows, no twin label', L.nums.length === 2 && !L.twins.length && !L.typed, JSON.stringify(L));
  L = addList(W, '01511', { _searchFilterPeriod: 'postwar' });
  ok('L7 01511 with a Postwar filter (no 1511 there) → nothing; the filters stay strict', L.nums.length === 0, JSON.stringify(L));
  W.__set(AROWS.map(r => Object.assign({}, r)), {});
  const p1 = W._wizResolveAddRow('01511', { raw: true });
  ok('L8 the one row picker (_wizResolveAddRow) turns 01511 into a 1511 row', !!p1 && p1.itemNum === '1511', p1 && p1.itemNum);
  const p2 = W._wizResolveAddRow('022', { raw: true });
  ok('L9 … and 022 into the 022 row, never 22', !!p2 && p2.rowId === 'PW022', p2 && p2.rowId);
  ok('L10 _wizNumberInCatalog: 01511 counts as in the catalog (fallback), 99999 does not', W._wizNumberInCatalog('01511') && !W._wizNumberInCatalog('99999'));

  // planted: the zero rule made always-on inside the one "same number" check
  const always = plant(SUG, "  if (a === b) return true;\n", "  if (a === b) return true;\n  if (typeof rrNumZeroTwin === 'function' && rrNumZeroTwin(a, b)) return true;\n", 'always-on');
  const L3 = addList(addWorld(always), '022');
  ok('L11 PLANTED: zeros made always-on in rrNumSameAsTyped → 022 lists 22 too (what L4 forbids — caught)', L3.nums.indexOf('22') >= 0, JSON.stringify(L3));
  // planted: the held-aside twins joined even beside an exact row
  const joinAll = plant(SUG, 'if (startsWithDigit && !_exactNumSeen && _zeroTwins.length)', 'if (startsWithDigit && _zeroTwins.length)', 'join-always');
  const L4b = addList(addWorld(joinAll), '022');
  ok('L12 PLANTED: twins joined beside an exact row → 022 lists 22 (what L4 forbids — caught)', L4b.nums.indexOf('22') >= 0, JSON.stringify(L4b));
}

// ── S: scans, each proven on a planted offender ────────────────────────────
function zeroCopies(src) {   // a home-made leading-zero strip, anywhere but the rule itself
  return (src.match(/replace\(\s*\/\^0\+/g) || []).length;
}
ok('S1 the rule lives ONCE: rrNumZeroKey / rrNumZeroTwin are defined only in app.js',
  (APPJS.match(/function rrNumZeroKey\(/g) || []).length === 1 && (APPJS.match(/function rrNumZeroTwin\(/g) || []).length === 1
  && ['app-data.js', 'wizard-suggestions.js', 'browse.js', 'wizard.js'].every(f => !/function rrNumZero(Key|Twin)\(/.test(read(f))));
ok('S2 no second leading-zero strip in the number-search files (app-data, wizard-suggestions, browse, wizard)',
  ['app-data.js', 'wizard-suggestions.js', 'browse.js', 'wizard.js'].every(f => zeroCopies(read(f)) === 0));
ok('S3 PLANTED: a home-made strip in the Add list is caught', zeroCopies(plant(SUG, "function rrNumSameAsTyped(rowNum, typed) {", "function rrNumSameAsTyped(rowNum, typed) { typed = String(typed).replace(/^0+/, '');", 'strip')) === 1);
// findMaster asks the twin ONLY behind the letter bridge's gate
const gateRe = /if \(\/\^\\d\/\.test\(k\) && typeof _zeroKinRows === 'function'\s*\n\s*&& !\(_kinNamed \? pool\.some\(_kinSatisfied\) : pool\.length\)\)/;
ok('S4 findMaster asks for the zero twin only when nothing answers for the catalog named', gateRe.test(DAT));
{
  const W = lookupWorld(plant(DAT, "&& !(_kinNamed ? pool.some(_kinSatisfied) : pool.length)) {\n    const _zk", "&& true) {\n    const _zk", 'gate'));
  const p = PAIRS[0];
  const rows = [row(p.zero, p.tab), row(p.plain, p.tab)];
  W.__index(rows, rows);
  const got = W._findMasterCore(W.state.masterByItem, p.zero, null, null);
  ok('S5 PLANTED: the gate removed → ' + p.zero + ' resolves to ' + (got && got.itemNum) + ' (caught by P1)', !!got && got.itemNum !== p.zero);
}
{
  const W = lookupWorld(plant(DAT, "  if (_r && _rTwin && state.masterByItemAll) {", "  if (false) {", 'layer'));
  const sh = row('1511', 'S-Helper Service S'), exact0 = row('01511', 'Somebody O');
  W.__index([sh], [sh, exact0]);
  const got = W.findMaster('01511', null, null);
  ok('S6 PLANTED: the "exact beats a twin" layer check removed → the twin wins (caught by F11)', got === sh);
}
// the Master Catalog search: twins admitted only through _zKeep, on every list _rowPasses makes
const rowPassLists = (BROWSE.match(/baseList\.filter\(_rowPasses\)|_pre\.filter\(_rowPasses\)/g) || []).length;
const keptLists = (BROWSE.match(/_zKeep\((baseList|_pre)\.filter\(_rowPasses\)\)/g) || []).length;
ok('S7 Master Catalog search: every list made by _rowPasses goes through _zKeep (' + keptLists + ' of ' + rowPassLists + ')', rowPassLists >= 4 && keptLists === rowPassLists, keptLists + '/' + rowPassLists);
{
  const planted = plant(BROWSE, 'state.filteredData = _zKeep(baseList.filter(_rowPasses));', 'state.filteredData = baseList.filter(_rowPasses);', 'zkeep');
  const a = (planted.match(/baseList\.filter\(_rowPasses\)|_pre\.filter\(_rowPasses\)/g) || []).length;
  const b = (planted.match(/_zKeep\((baseList|_pre)\.filter\(_rowPasses\)\)/g) || []).length;
  ok('S8 PLANTED: the screen\'s list without _zKeep (twins beside an exact row) is caught by S7', a !== b);
}
ok('S9 the Master Catalog search admits a twin only through rrNumZeroTwin, for a one-number search, never an ID search',
  /if \(_zQ && rrNumZeroTwin\(item\.itemNum, _zQ\) && !_aliasSearch\(haystack, search\)\) \{ _zAdmitted\.add\(item\); return true; \}/.test(BROWSE)
  && /if \(_cmdQ \|\| !\/\^\\d\\S\*\$\/\.test\(_zQ\) \|\| typeof rrNumZeroTwin !== 'function'\) _zQ = '';/.test(BROWSE));
ok('S10 the words live in config.js (RR_ADD_TYPED.zeroTwin), never typed in the list code',
  /zeroTwin:\s*'\{maker\} · listed as \{num\}'/.test(CFG) && !/['"][^'"\n]*listed as/.test(SUG));
ok('S11 the fixture is the live catalog\'s real pairs (≥ 250, Atlas O + Lionel Pre-War + Williams O + Lionel PW all present)',
  PAIRS.length >= 250 && ['Atlas O', 'Lionel Pre-War', 'Williams O', 'Lionel PW - Items'].every(t => PAIRS.some(p => p.tab === t)));

console.log('\n' + (fail ? 'FAILED' : 'PASSED') + '  zero_twin_tests: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
