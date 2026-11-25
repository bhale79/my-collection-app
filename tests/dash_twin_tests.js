#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THE DASH TWIN + THE MAKER LIST (dashmaker, PLAN_2026-11-24_DASH_AND_INDUSTRIAL_RAIL)
// [stated] Brad 2026-11-24 11:59 / 12:04 / 12:15 CT "yes".
//
// Customer Bob typed numbers the way his boxes print them and found nothing:
// K-675402 (the catalog writes K675402), IDM-1007 (IDM1007), Atlas 6502-2
// (Atlas's archive and the catalog write 6502; the -2 is the road number) —
// and Industrial Rail was missing from the Add screen's maker list ("Not even
// the manufacturer!"). A dash is sometimes the WHOLE difference (Athearn
// RND-1166 ore car / RND1166 boxcar; Lionel 6464-1), so the dash twin is a
// FALLBACK like the leading-zero twin: asked only when nothing answers to the
// number exactly as written.
//   R  the rule (rrNumDashKey / rrNumSuffixBase / rrNumLooseTwin, app.js)
//   F  findMaster and friends: the letters dash both ways; exact wins; the
//      road-number ending only when a catalog is named; findAllMaster and
//      rrCatalogCandidates fill a blank only; a saved Row ID keeps its link
//   L  the Add list (real code, jsdom): K-675402 / IDM-1007 / 6502-2 find their
//      rows, labelled; RND-1166 / RND1166 / 6464-1 unchanged; the one row
//      picker never picks between two makers by a number alone
//   M  the maker list (rrMakerChoices): every maker the catalog holds
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
const BROWSE = read('browse.js'), CFG = read('config.js'), TYPES = read('type-groups.js');
const RULE = s => [grab(s, 'function rrNumDashKey('), grab(s, 'function rrNumSuffixBase('), grab(s, 'function rrNumLooseTwin(')].join('\n');

// ── the lookup world: the REAL functions in a sandbox ──────────────────────
function lookupWorld(datSrc, appSrc) {
  const A = appSrc || APPJS;
  const sb = { console: { log() {}, warn() {}, error() {} } };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext([
    require('./lib/num-rule').numRuleSource(),
    grab(A, 'function rrNumZeroKey('), grab(A, 'function rrNumZeroTwin('), RULE(A), grab(A, 'function rrNumMayHaveLooseTwin('),
    'function baseItemNum(n) { return String(n || "").trim().replace(/[-]?[PDTC]$/i, ""); }',
    grab(A, 'function rrNumSaveAs('),
    'var state = { masterByItem: new Map(), masterByItemAll: null, masterByRowId: new Map(), masterByRowIdAll: null };',
    'var ERA_TABS = {}; var _lkCache = new WeakMap(); var _zkCache = new WeakMap(); var _dkCache = new WeakMap();',
    (CFG.match(/const RR_ROAD_NUMBER_ENDING_ERAS = \[[^\]]*\];/) || ['var RR_ROAD_NUMBER_ENDING_ERAS = [];'])[0].replace('const ', 'var '),
    grab(datSrc, 'function _mIsMotive('), grab(datSrc, 'function _mSuffix('),
    grab(datSrc, 'function _letterKinRows('), grab(datSrc, 'function _zeroKinRows('), grab(datSrc, 'function _looseKinRows('),
    grab(datSrc, 'function _findMasterCore('), grab(datSrc, 'function _preferEraOf('),
    grab(datSrc, 'function rrMasterByKey('), grab(datSrc, 'function rrMasterByRowId('), grab(datSrc, 'function _rrRowIdFits('),
    grab(datSrc, 'function findMaster('), grab(datSrc, 'function _mbAllGet('), grab(datSrc, 'function findAllMaster('),
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
const row = (num, tab, extra) => Object.assign({ itemNum: num, _tab: tab, _era: eraOf(tab), itemType: 'Boxcar', description: tab + ' car', rowId: 'R' + tab.replace(/\W/g, '') + num.replace(/\W/g, '') }, extra || {});

// ── R: the rule ────────────────────────────────────────────────────────────
{
  const W = lookupWorld(DAT);
  const K = W.rrNumDashKey, B = W.rrNumSuffixBase, T = W.rrNumLooseTwin;
  ok('R1 dash key: K-675402 → K675402, IDM-1007 → IDM1007, RK-2005LP → RK2005LP, capitals kept',
    K('K-675402') === 'K675402' && K('IDM-1007') === 'IDM1007' && K('RK-2005LP') === 'RK2005LP' && K('k-6406') === 'k6406');
  ok('R2 dash key leaves every other dash: 6464-1, 20-66238, 2343-P, K652-1392, 6-8359, CO-1? (letters then a LETTER)',
    K('6464-1') === '6464-1' && K('20-66238') === '20-66238' && K('2343-P') === '2343-P' && K('K652-1392') === 'K652-1392' && K('6-8359') === '6-8359' && K('CO-A1') === 'CO-A1');
  ok('R3 suffix base: 6502-2 → 6502, 1304-12 → 1304, 30-1906-1 → 30-1906; none for 2343-P, 20-66238, K652-1392, 6502',
    B('6502-2') === '6502' && B('1304-12') === '1304' && B('30-1906-1') === '30-1906' && B('2343-P') === '' && B('20-66238') === '' && B('K652-1392') === '' && B('6502') === '');
  ok('R4 twins: K675402 / K-675402 both ways, IDM1007 / IDM-1007, K-6406 / K6406, any case',
    T('K675402', 'K-675402') && T('K-675402', 'K675402') && T('IDM1007', 'idm-1007') && T('K-6406', 'K6406'));
  const AT = n => ({ itemNum: n, _era: 'atlas' }), PW = n => ({ itemNum: n, _era: 'pw' });
  ok('R5 the road-number ending: an ATLAS row 6502 answers typed 6502-2 — ONE way only (row 6502-2 never answers typed 6502)',
    T(AT('6502'), '6502-2') && !T(AT('6502-2'), '6502'));
  ok('R5b … and ONLY for a catalog in RR_ROAD_NUMBER_ENDING_ERAS: Lionel 6456 never answers 6456-50, Lionel 175 never 175-50, a bare number (no row) never takes it',
    !T(PW('6456'), '6456-50') && !T(PW('175'), '175-50') && !T({ itemNum: '1001', _era: 'lionel_parts' }, '1001-12') && !T('6502', '6502-2'));
  ok('R5c a half-typed number has no ending twin: 6-14 → no base, 30-1 → no base (under 3 characters left)', B('6-14') === '' && B('30-1') === '' && B('306-1') === '306');
  ok('R5d rrNumMayHaveLooseTwin: K-675402, K6406, 6502-2 → yes; 6502, 20-66238 → no (a plain number never pays the per-row check)',
    W.rrNumMayHaveLooseTwin('K-675402') && W.rrNumMayHaveLooseTwin('K6406') && W.rrNumMayHaveLooseTwin('6502-2') && !W.rrNumMayHaveLooseTwin('6502') && !W.rrNumMayHaveLooseTwin('20-66238'));
  const AT6502 = { itemNum: '6502', _era: 'atlas' }, KL = { itemNum: 'K675402', _era: 'kline' }, PW31705 = { itemNum: '31705', _era: 'mpc' };
  ok('R7 rrNumSaveAs ([stated] Brad 13:38 "should show the -2"): Atlas 6502 found for typed 6502-2 saves 6502-2; K675402 for K-675402 saves K675402; an exact or other form saves the catalog\'s',
    W.rrNumSaveAs(AT6502, '6502-2') === '6502-2' && W.rrNumSaveAs(KL, 'K-675402') === 'K675402' && W.rrNumSaveAs(AT6502, '6502') === '6502'
    && W.rrNumSaveAs(PW31705, '6-31705') === '31705' && W.rrNumSaveAs({ itemNum: '6456', _era: 'pw' }, '6456-50') === '6456' && W.rrNumSaveAs(null, '6502-2') === '6502-2');
  ok('R6 not twins: a number and itself, RND1166 vs RND1166, 6464 vs 64641, 20-66238 vs 2066238, 2343 vs 2343-P',
    !T('RND1166', 'RND1166') && !T('64641', '6464-1') && !T('2066238', '20-66238') && !T('2343', '2343-P') && !T('', 'K-1'));
}

// ── F: findMaster and friends ──────────────────────────────────────────────
{
  const W = lookupWorld(DAT);
  const kl = row('K675402', 'K-Line O', { rowId: 'KL675402' });
  const kd = row('K-6406', 'K-Line O', { rowId: 'KL6406' });
  const ore = row('RND-1166', 'Athearn', { itemType: 'Ore Car', rowId: 'ATORE' }), box = row('RND1166', 'Athearn', { rowId: 'ATBOX' });
  const lio = row('6502', 'Lionel PW - Items', { itemType: 'Flatcar', rowId: 'PW6502' });
  const atl = row('6502', 'Atlas O', { rowId: 'AT6502', _era: 'atlas' });
  const p641 = row('6464-1', 'Lionel PW - Items', { rowId: 'PW64641' });
  const idm = row('IDM1007', 'Other O Brands', { manufacturer: 'Industrial Rail', rowId: 'IDM1007' });
  const all = [kl, kd, ore, box, lio, atl, p641, idm];
  W.__index(all, all);
  let r = W.findMaster('K-675402', null, null);
  ok('F1 K-675402 typed (no catalog named) → K-Line\'s K675402 (was: nothing)', r === kl, r && r.itemNum);
  r = W.findMaster('K-675402', null, { era: eraOf('K-Line O') });
  ok('F2 … and with K-Line named', r === kl, r && r.itemNum);
  r = W.findMaster('K6406', null, { era: eraOf('K-Line O') });
  ok('F3 the other way: K6406 typed → the catalog\'s K-6406', r === kd, r && r.itemNum);
  r = W.findMaster('IDM-1007', null, null);
  ok('F4 IDM-1007 typed → Industrial Rail IDM1007', r === idm, r && r.itemNum);
  ok('F5 exact always wins: RND-1166 → the ore car, RND1166 → the boxcar',
    W.findMaster('RND-1166', null, null) === ore && W.findMaster('RND1166', null, null) === box);
  r = W.findMaster('6464-1', null, null);
  ok('F6 6464-1 → 6464-1 (unchanged)', r === p641, r && r.itemNum);
  r = W.findMaster('6502-2', null, null);
  ok('F7 6502-2 with NO catalog named → nothing: 6502 is Lionel\'s flatcar AND Atlas\'s boxcar, a number alone never picks', r === null, r && r._tab);
  r = W.findMaster('6502-2', null, { era: 'atlas' });
  ok('F8 6502-2 with Atlas named → Atlas\'s 6502 (Bob\'s Evans boxcar)', r === atl, r && r._tab);
  r = W.findMaster('6502-2', null, { era: eraOf('K-Line O') });
  ok('F9 6502-2 with K-Line named (no 6502 there) → nothing, never another maker\'s 6502', r === null, r && r._tab);
  const fa = W.findAllMaster('6502-2').map(x => x._tab).sort();
  ok('F10 findAllMaster("6502-2") fills the blank with Atlas\'s 6502 only (Lionel\'s catalog has no road-number endings)', fa.join('|') === 'Atlas O', JSON.stringify(fa));
  ok('F11 findAllMaster("RND1166") lists only RND1166 — the twin never joins an exact answer', W.findAllMaster('RND1166').map(x => x.rowId).join() === 'ATBOX');
  const cc = W.rrCatalogCandidates('K-675402').map(x => x.itemNum);
  ok('F12 rrCatalogCandidates("K-675402") offers K675402 (a blank filled)', cc.join() === 'K675402', JSON.stringify(cc));
  ok('F13 _rrRowIdFits: the K675402 row / a copy saved as K-675402 → fits; saved K-675403 → refused',
    W._rrRowIdFits(kl, 'K-675402', '') && !W._rrRowIdFits(kl, 'K-675403', ''));
  r = W.findMaster('K-675402', null, { era: eraOf('K-Line O'), masterRowId: 'KL675402' });
  ok('F14 a copy saved as K-675402 with its Row ID keeps its link', r === kl, r && r.itemNum);
  // an exact row in the full catalog beats a twin in the loaded one
  const kExact = row('K-675402', 'Other O Brands', { rowId: 'OOK675402' });
  W.__index([kl], [kl, kExact]);
  r = W.findMaster('K-675402', null, null);
  ok('F15 K-675402 typed: the full catalog\'s exact K-675402 beats the loaded catalog\'s twin K675402', r === kExact, r && (r.itemNum + '@' + r._tab));
  // review 2026-11-24, finding 1b: an exact row in the FULL catalog beats an in-era twin, with a catalog named
  const loco = row('1001', 'Lionel PW - Items', { itemType: 'Steam Locomotive', rowId: 'PW1001', _era: 'pw' });
  const part = row('1001-12', 'Lionel Parts', { itemType: 'Part', rowId: 'LP100112', _era: 'lionel_parts' });
  W.__index([loco], [loco, part]);
  r = W.findMaster('1001-12', '', { era: 'pw' });
  ok('F16 Lionel Parts 1001-12 asked with Postwar named → the PART (full catalog), never the 1001 Scout loco', r === part, r && r.rowId);
  // finding 1c: a Lionel dash number the catalog lacks never answers as its base
  const p6456 = row('6456', 'Lionel PW - Items', { rowId: 'PW6456', _era: 'pw' });
  W.__index([p6456], [p6456]);
  r = W.findMaster('6456-50', '', { era: 'pw' });
  ok('F17 6456-50 (not in the catalog) with Postwar named → nothing, never the 6456', r === null, r && r.itemNum);
  ok('F18 _rrRowIdFits: a 6456 Row ID on a copy saved as 6456-50 is refused', !W._rrRowIdFits(p6456, '6456-50', ''));
  // finding 2: a letter-dash twin with nothing named never picks between makers
  const amRB = row('RB2024', 'American Models S', { itemType: 'Track', rowId: 'AMRB', _era: 'am_s' });
  const rsRB = row('RB2024', 'Ross Custom Switches', { itemType: 'Rolling Stock', rowId: 'RSRB', _era: 'ross' });
  W.__index([amRB, rsRB], [amRB, rsRB]);
  r = W.findMaster('RB-2024', null, null);
  ok('F19 RB-2024, nothing named, two makers hold RB2024 → nothing (the number alone never picks)', r === null, r && r.rowId);
  r = W.findMaster('RB-2024', null, { era: 'ross' });
  ok('F20 … with Ross named → Ross\'s RB2024', r === rsRB, r && r.rowId);
  // finding 3: an exact match in other capitals beats a dash twin
  const gg = row('DZ-1000', 'GarGraves', { rowId: 'GGDZ', _era: 'gargraves' }), rz = row('DZ1000', 'Ross Custom Switches', { rowId: 'RSDZ', _era: 'ross' });
  W.__index([gg, rz], [gg, rz]);
  r = W.findMaster('dz-1000', null, null);
  ok('F21 dz-1000 typed in small letters (GarGraves holds DZ-1000) → never Ross\'s DZ1000: an exact match in other capitals blocks the twin', r !== rz, r && r.rowId);
  // second review, finding 1: with a catalog named, only an exact row OF THAT CATALOG blocks its own twin
  const pw641 = row('6464-1', 'Lionel PW - Items', { rowId: 'PW64641', _era: 'pw' }), at6464 = row('6464', 'Atlas O', { rowId: 'AT6464', _era: 'atlas' });
  W.__index([at6464], [at6464, pw641]);
  r = W._findMasterCore(W.state.masterByItem, '6464-1', null, { era: 'atlas' });
  ok('F22 6464-1 asked with Atlas named (Lionel PW holds 6464-1, Atlas holds 6464) → Atlas\'s 6464, never blocked by another maker\'s exact row', r === at6464, r && r.rowId);
  r = W._findMasterCore(W.state.masterByItem, '6464-1', null, null);
  ok('F23 … with NOTHING named, Lionel\'s exact 6464-1 still blocks the twin (exact anywhere wins)', r !== at6464, r && r.rowId);
  // finding 3: one maker, two scales — never picked between by a number alone
  const ao = row('4001', 'Atlas O', { rowId: 'AO4001', _era: 'atlas', itemType: 'Assortment' }), ah = row('4001', 'Atlas HO', { rowId: 'AH4001', _era: 'atlas_ho', itemType: 'Gondola' });
  W.__index([ao, ah], [ao, ah]);
  r = W._findMasterCore(W.state.masterByItem, '4001-2', null, { eras: ['atlas', 'atlas_ho'] });
  ok('F24 4001-2 with both Atlas scales named (Atlas O 4001 carton, Atlas HO 4001 gondola) → nothing: one maker\'s two catalogs are never picked between', r === null, r && r.rowId);
  r = W._findMasterCore(W.state.masterByItem, '4001-2', null, { era: 'atlas_ho' });
  ok('F25 … with Atlas HO alone named → Atlas HO\'s 4001', r === ah, r && r.rowId);
}
{
  const W = lookupWorld(plant(DAT, "{ suffix: _kinNamed, belongs: _kinNamed ? _kinSatisfied : null }", "{ suffix: _kinNamed }", 'belongs'));
  const pw641 = row('6464-1', 'Lionel PW - Items', { rowId: 'PW64641', _era: 'pw' }), at6464 = row('6464', 'Atlas O', { rowId: 'AT6464', _era: 'atlas' });
  W.__index([at6464], [at6464, pw641]);
  const r = W._findMasterCore(W.state.masterByItem, '6464-1', null, { era: 'atlas' });
  ok('F26 PLANTED: the named-catalog test taken out of "exact wins" → Lionel\'s 6464-1 hides Atlas\'s 6464 again (what F22 forbids — caught)', r !== at6464, r && r.rowId);
}
{
  const W = lookupWorld(plant(DAT, "+ '|' + String(r._era || '')] = 1; });", "] = 1; });", 'one-catalog'));
  const ao = row('4001', 'Atlas O', { rowId: 'AO4001', _era: 'atlas', manufacturer: 'Atlas' }), ah = row('4001', 'Atlas HO', { rowId: 'AH4001', _era: 'atlas_ho', manufacturer: 'Atlas' });
  W._manufacturerOfItem = function (x) { return x && x.manufacturer ? String(x.manufacturer).toLowerCase() : null; };
  W.__index([ao, ah], [ao, ah]);
  const r = W._findMasterCore(W.state.masterByItem, '4001-2', null, { eras: ['atlas', 'atlas_ho'] });
  ok('F27 PLANTED: the one-catalog key without its era → 4001-2 picks one Atlas scale by number alone (what F24 forbids — caught)', r !== null, r && r.rowId);
}

// ── L: the Add list, real code in jsdom ────────────────────────────────────
let JSDOM = null;
try { JSDOM = require('jsdom').JSDOM; } catch (e) {}
function addWorld(sugSrc, appSrc, wizSrc) {
  const A = appSrc || APPJS, WZ = wizSrc || WIZ;
  const dom = new JSDOM('<!doctype html><html><body><input id="wiz-input"><div id="wiz-match"></div><div id="wiz-suggestions"></div></body></html>', { runScripts: 'outside-only', url: 'https://therailroster.com/app/' });
  const win = dom.window;
  win.console = { log() {}, warn() {}, error() {} };
  const brandVar = A.slice(A.indexOf('var _BRAND_LABELS'), A.indexOf('\n', A.indexOf('var _BRAND_LABELS')));
  const eraMap = BROWSE.slice(BROWSE.indexOf('var _ERA_KEY_TO_PERIOD'), BROWSE.indexOf('\n};', BROWSE.indexOf('var _ERA_KEY_TO_PERIOD')) + 3);
  win.eval([
    CFG, TYPES, brandVar, eraMap, require('./lib/num-rule').numRuleSource(),
    grab(A, 'function rrNumZeroKey('), grab(A, 'function rrNumZeroTwin('), RULE(A), grab(A, 'function rrNumMayHaveLooseTwin('), grab(A, 'function rrNumSaveAs('),
    grab(A, 'function _manufacturerOfEra('), grab(A, 'function rrErasOfRowMaker('), grab(A, 'function _manufacturerOfItem('), grab(A, 'function _itemEraKey('),
    grab(A, 'function _brandLabel('), grab(A, 'function rrAlsoSoldAsNames('), grab(A, 'function _rrMakerWord('), grab(A, 'function rrRowAlsoSoldBy('),
    grab(BROWSE, 'function _itemEraPeriod('),
    grab(WIZ, 'function _wizPeriodOfYear('), grab(WIZ, 'function _wizPeriodOfRow('), grab(WIZ, 'function _wizScaleOfRow('),
    grab(WIZ, 'function _wizMasterPrefer('), grab(WIZ, 'function _wizAddFilters('), grab(WIZ, 'function _wizAnyAddFilter('),
    grab(WIZ, 'function _wizRowFitsFilters('), grab(WIZ, 'function _wizSameNum('), grab(WIZ, 'function _wizPickMasterRow('),
    grab(WZ, 'function rrReaderPreferFrom('), grab(WZ, 'function rrRowFitsPrefer('),
    'var state = { masterData: [], setData: [], personalData: {} }; var wizard = { data: {}, matchedItem: null, tab: "collection", steps: [{ type: "itemNumGrouping" }], step: 0 }; var _currentEra = "all";',
    'function wizardNext() {} function _updateGroupingButtons() {} function _wizOwnedRefresh() {} function _catalogReady() { return true; } function _wizSetKind() {}',
    sugSrc,
    'this.__setAll = function (a) { _allErasSearchCache = a; };',
    'this.__eraTabs = function () { window.ERA_TABS = ERA_TABS; };',
    'this.__set = function (rows, data) { state.masterData = rows; wizard = { data: data || {}, matchedItem: null, tab: "collection", steps: [{ type: "itemNumGrouping" }], step: 0 }; };',
  ].join('\n;\n'));
  return win;
}
const AROWS = [
  { itemNum: 'K675402', itemType: 'Vat Car', description: 'Vlasic Open-Sided Pickle Vat Car', roadName: 'Vlasic', _era: 'kline', _tab: 'K-Line O', rowId: 'KL675402' },
  { itemNum: 'IDM1007', itemType: 'Boxcar', description: 'Burlington Northern Santa Fe Box Car', roadName: 'BNSF', manufacturer: 'Industrial Rail', _era: 'other_o', _tab: 'Other O Brands', rowId: 'IDM1007' },
  { itemNum: '6502', itemType: 'Boxcar', subType: '53ft Evans Double Plug Door Box Car', description: 'Burlington Northern', roadName: 'Burlington Northern', _era: 'atlas', _tab: 'Atlas O', rowId: 'AT6502' },
  { itemNum: 'RB2024', itemType: 'Track', description: 'Roadbed', roadName: '', _era: 'am_s', _tab: 'American Models S', rowId: 'AMRB' },
  { itemNum: 'RB2024', itemType: 'Rolling Stock', description: 'Voltmeter car', roadName: '', _era: 'ross', _tab: 'Ross Custom Switches', rowId: 'RSRB' },
  { itemNum: '6502', itemType: 'Flatcar', description: 'Girder flatcar', roadName: '', yearProd: '1955', _era: 'pw', _tab: 'Lionel PW - Items', rowId: 'PW6502' },
  { itemNum: '6464-1', itemType: 'Boxcar', description: 'Western Pacific boxcar', roadName: 'Western Pacific', yearProd: '1953', _era: 'pw', _tab: 'Lionel PW - Items', rowId: 'PW64641' },
  { itemNum: 'RND-1166', itemType: 'Ore Car', description: 'Ore car', roadName: '', manufacturer: 'Athearn', _era: 'other_o', _tab: 'Other O Brands', rowId: 'ATORE' },
  { itemNum: 'RND1166', itemType: 'Boxcar', description: 'Boxcar', roadName: '', manufacturer: 'Athearn', _era: 'other_o', _tab: 'Other O Brands', rowId: 'ATBOX' },
];
function addList(win, q, data) {
  win.__set(AROWS.map(r => Object.assign({}, r)), data);
  win.updateItemSuggestions(q);
  const el = win.document.getElementById('wiz-suggestions');
  const rs = Array.from(el.querySelectorAll('[data-idx]'));
  return {
    nums: rs.map(x => (x.querySelector('span') || {}).textContent),
    twins: Array.from(el.querySelectorAll('[data-zero-twin]')).map(x => x.textContent),
    nf: !!el.querySelector('[data-nothing-found]'), typed: !!el.querySelector('[data-typed-num]'),
  };
}
if (!JSDOM) {
  ok('L0 the Add-list checks need jsdom (npm install --no-save jsdom) — a missing jsdom is a FAIL, never a skip', false);
} else {
  const W = addWorld(SUG);
  let L = addList(W, 'K-675402');
  ok('L1 K-675402 typed → the K675402 row (was: "No item found")', L.nums.join() === 'K675402' && !L.nf, JSON.stringify(L));
  ok('L2 … labelled "… · listed as K675402", and no "Use as typed" row', L.twins.length === 1 && /listed as K675402/i.test(L.twins[0]) && !L.typed, JSON.stringify(L));
  L = addList(W, 'IDM-1007');
  ok('L3 IDM-1007 typed → the Industrial Rail IDM1007 row', L.nums.join() === 'IDM1007', JSON.stringify(L));
  L = addList(W, '6502-2', { _searchFilterManufacturer: 'Atlas' });
  ok('L4 6502-2 typed with Atlas picked → Atlas\'s 6502 only (Bob\'s exact steps)', L.nums.join() === '6502', JSON.stringify(L));
  L = addList(W, '6502-2');
  ok('L5 6502-2 typed, no maker picked → Atlas\'s 6502 only (Lionel\'s 6502 flatcar has no road-number endings)', L.nums.join() === '6502' && L.twins.length === 1, JSON.stringify(L));
  L = addList(W, 'RND1166');
  ok('L6 RND1166 typed → the boxcar only: the twin RND-1166 never joins an exact answer', L.nums.join() === 'RND1166' && !L.twins.length, JSON.stringify(L));
  L = addList(W, '6464-1');
  ok('L7 6464-1 typed → 6464-1 only, no twin', L.nums.join() === '6464-1' && !L.twins.length, JSON.stringify(L));
  L = addList(W, 'IDM1007', { _searchFilterManufacturer: 'Industrial Rail' });
  ok('L8 Industrial Rail picked as the maker + IDM1007 → found (the filter knows a row\'s own maker)', L.nums.join() === 'IDM1007', JSON.stringify(L));
  W.__set(AROWS.map(r => Object.assign({}, r)), {});
  const p1 = W._wizResolveAddRow('K-675402', { raw: true });
  ok('L9 the one row picker turns K-675402 into the K675402 row', !!p1 && p1.rowId === 'KL675402', p1 && p1.rowId);
  const p2 = W._wizResolveAddRow('RB-2024', { raw: true });
  ok('L10 … but RB-2024 with no maker picked → no pick (American Models\' and Ross\'s RB2024; the list shows both)', p2 === null, p2 && p2.rowId);
  W.__set(AROWS.map(r => Object.assign({}, r)), { _searchFilterManufacturer: 'Atlas' });
  const p3 = W._wizResolveAddRow('6502-2', { raw: true });
  ok('L11 … and with Atlas picked → Atlas\'s 6502', !!p3 && p3.rowId === 'AT6502', p3 && p3.rowId);
  W.__set(AROWS.map(r => Object.assign({}, r)), {});
  ok('L12 _wizNumberInCatalog: K-675402 and 6502-2 count as in the catalog, K-999999 does not',
    W._wizNumberInCatalog('K-675402') && W._wizNumberInCatalog('6502-2') && !W._wizNumberInCatalog('K-999999'));

  // planted: the held-aside twins joined even beside an exact row
  const joinAll = plant(SUG, 'if (startsWithDigit && !_exactNumSeen && _dashTwins.length)', 'if (startsWithDigit && _dashTwins.length)', 'join-always');
  const Lj = addList(addWorld(joinAll), 'RND1166');
  ok('L13 PLANTED: twins joined beside an exact row → RND1166 lists RND-1166 too (what L6 forbids — caught)', Lj.nums.indexOf('RND-1166') >= 0, JSON.stringify(Lj));
  // planted: the row picker's one-maker guard taken out
  const noGuard = plant(SUG, '    if (_lt.length && Object.keys(_ltMk).length === 1) {', '    if (_lt.length) {', 'one-maker');
  const Wg = addWorld(noGuard);
  Wg.__set(AROWS.map(r => Object.assign({}, r)), {});
  const pg = Wg._wizResolveAddRow('RB-2024', { raw: true });
  ok('L14 PLANTED: the one-maker guard removed → RB-2024 silently picks one maker\'s RB2024 (what L10 forbids — caught)', pg !== null, pg && pg.rowId);
  // review finding 1a: an in-era dash twin never blocks the all-eras widening where the exact number lives
  const PROWS = [{ itemNum: '1001', itemType: 'Steam Locomotive', description: 'Scout loco', roadName: '', yearProd: '1948', _era: 'pw', _tab: 'Lionel PW - Items', rowId: 'PW1001' },
                 { itemNum: 'K6406', itemType: 'Boxcar', description: 'Boxcar', roadName: '', _era: 'kline', _tab: 'K-Line O', rowId: 'KL6406' }];
  const ALLROWS = PROWS.concat([{ itemNum: '1001-12', itemType: 'Part', description: 'Scout part', roadName: '', _era: 'lionel_parts', _tab: 'Lionel Parts', rowId: 'LP100112' },
                                { itemNum: 'K-6406', itemType: 'Boxcar', description: 'Boxcar exact', roadName: '', _era: 'other_o', _tab: 'Other O Brands', rowId: 'OOK6406' }]);
  const Ww = addWorld(SUG);
  // NOTE: the live app never sets window.ERA_TABS (it is declared as a bare const), so this era-scoped
  // widening branch is not reached live today (a finding of its own); set here so the branch is proven.
  Ww.__eraTabs();
  Ww.__setAll(ALLROWS.map(r => Object.assign({}, r)));
  Ww.__set(PROWS.map(r => Object.assign({}, r)), { _era: 'kline' });
  Ww.updateItemSuggestions('K-6406');
  const wl = Array.from(Ww.document.querySelectorAll('#wiz-suggestions [data-idx]')).map(x => (x.querySelector('span') || {}).textContent);
  ok('L15 K-Line scoped, K-6406 typed: the in-era twin K6406 does NOT stop the all-eras widening — the exact K-6406 elsewhere wins', wl.indexOf('K-6406') >= 0 && wl.indexOf('K6406') < 0, JSON.stringify(wl));
  Ww.__set(PROWS.map(r => Object.assign({}, r)), {});
  const pw = Ww._wizResolveAddRow('K-6406', { raw: true });
  ok('L16 the row picker never takes the loaded twin K6406 while the full catalog holds K-6406 exactly', pw === null, pw && pw.rowId);
  const Wv = addWorld(plant(SUG, '      if (!_exactElsewhere) rows = _lt;', '      rows = _lt;', 'elsewhere'));
  Wv.__setAll(ALLROWS.map(r => Object.assign({}, r)));
  Wv.__set(PROWS.map(r => Object.assign({}, r)), {});
  const pv = Wv._wizResolveAddRow('K-6406', { raw: true });
  ok('L17 PLANTED: the full-catalog check removed → the picker takes the twin K6406 (what L16 forbids — caught)', !!pv && pv.rowId === 'KL6406', pv && pv.rowId);
  // finding 4: the chosen maker stays a choice on screen
  const sel = Ww.document.createElement('select'); sel.id = 'wiz-search-mfr';
  sel.innerHTML = '<option value="">(any)</option><option value="Atlas">Atlas</option>';
  Ww.document.body.appendChild(sel);
  Ww.eval(grab(WIZ, 'function _wizRefreshMakerList(') + '\nfunction rrMakerChoices() { return ["Atlas", "Lionel"]; }\nwizard.data._searchFilterManufacturer = "Industrial Rail";\n_wizRefreshMakerList();');
  ok('L18 the remembered maker (Industrial Rail) stays in the drop-down and stays picked while the full catalog is still loading',
    Array.from(sel.options).some(o => o.value === 'Industrial Rail') && sel.value === 'Industrial Rail', sel.innerHTML);
  const opts = Array.from(sel.options).slice(1).map(o => o.value);
  ok('L18b … in its A–Z place, not tacked on at the end', JSON.stringify(opts) === JSON.stringify(['Atlas', 'Industrial Rail', 'Lionel']), JSON.stringify(opts));
  // second review, finding 1: the picker agrees with the list — another maker's exact row never blocks the picked maker's twin
  const RROWS = [{ itemNum: '6464', itemType: 'Boxcar', description: 'Atlas boxcar', roadName: '', _era: 'atlas', _tab: 'Atlas O', rowId: 'AT6464' }];
  const RALL = RROWS.concat([{ itemNum: '6464-1', itemType: 'Boxcar', description: 'Western Pacific boxcar', roadName: 'Western Pacific', yearProd: '1953', _era: 'pw', _tab: 'Lionel PW - Items', rowId: 'PW64641' }]);
  const Wr = addWorld(SUG);
  Wr.__setAll(RALL.map(r => Object.assign({}, r)));
  Wr.__set(RROWS.map(r => Object.assign({}, r)), { _searchFilterManufacturer: 'Atlas' });
  const pr = Wr._wizResolveAddRow('6464-1', { raw: true });
  ok('L19 Atlas picked, 6464-1 typed (Lionel PW holds 6464-1 exactly) → the picker takes Atlas\'s 6464, as the list does', !!pr && pr.rowId === 'AT6464', pr && pr.rowId);
  Wr.__set(RROWS.map(r => Object.assign({}, r)), {});
  const pr2 = Wr._wizResolveAddRow('6464-1', { raw: true });
  ok('L20 … with no maker picked, Lionel\'s exact 6464-1 still blocks the twin', pr2 === null, pr2 && pr2.rowId);
  const Wf = addWorld(plant(SUG, "return i && rrNumSameAsTyped(i.itemNum, numLC) && fits(i);", "return i && rrNumSameAsTyped(i.itemNum, numLC);", 'elsewhere-fits'));
  Wf.__setAll(RALL.map(r => Object.assign({}, r)));
  Wf.__set(RROWS.map(r => Object.assign({}, r)), { _searchFilterManufacturer: 'Atlas' });
  const pf = Wf._wizResolveAddRow('6464-1', { raw: true });
  ok('L21 PLANTED: the full-catalog check ignoring the picked maker → Atlas picked, 6464-1 gives no row (what L19 forbids — caught)', pf === null, pf && pf.rowId);
  // finding 3: Atlas O and Atlas HO are two catalogs
  const SROWS = [{ itemNum: '4001', itemType: 'Assortment', description: 'Carton', roadName: '', _era: 'atlas', _tab: 'Atlas O', rowId: 'AO4001' },
                 { itemNum: '4001', itemType: 'Gondola', description: 'CP Rail gondola', roadName: 'CP Rail', _era: 'atlas_ho', _tab: 'Atlas HO', rowId: 'AH4001' }];
  const Ws = addWorld(SUG);
  Ws.__set(SROWS.map(r => Object.assign({}, r)), { _searchFilterManufacturer: 'Atlas' });
  const ps = Ws._wizResolveAddRow('4001-2', { raw: true });
  ok('L22 Atlas picked, 4001-2 typed, Atlas O 4001 and Atlas HO 4001 both there → no pick (the list shows both)', ps === null, ps && ps.rowId);
  const Wsp = addWorld(plant(SUG, "+ '|' + String(i._era || '')] = 1;", "] = 1;", 'one-catalog'));
  Wsp.__set(SROWS.map(r => Object.assign({}, r)), { _searchFilterManufacturer: 'Atlas' });
  const psp = Wsp._wizResolveAddRow('4001-2', { raw: true });
  ok('L23 PLANTED: one maker word without its era → 4001-2 picks one Atlas scale (what L22 forbids — caught)', psp !== null, psp && psp.rowId);
  // plan item 5: a two-word maker typed in the box filters like "lionel 1511"
  let Li = addList(W, 'industrial rail 1007');
  ok('L24 "industrial rail 1007" typed → IDM1007 (the two words act as the maker, not as search words)', Li.nums.join() === 'IDM1007', JSON.stringify(Li));
  const Wn = addWorld(plant(SUG, "        _typedMfr = _MFR_WORDS[k];\n        _mfrPhraseWords = _mfrPhraseWords.concat(k.split(' '));\n", "", 'phrase'));
  Li = addList(Wn, 'industrial rail 1007');
  ok('L25 PLANTED: the two-word maker check taken out → "industrial rail 1007" no longer finds IDM1007 (caught)', Li.nums.join() !== 'IDM1007', JSON.stringify(Li));
  // [stated] Brad 13:38 CT "should show the -2": the typed road-number ending is the number the add saves
  const tapWorld = (src) => {
    const Wt = addWorld(src);
    Wt.__set(SROWS.concat(AROWS).map(r => Object.assign({}, r)), { _searchFilterManufacturer: 'Atlas' });
    Wt.document.getElementById('wiz-input').value = '6502-2';
    const at = Wt.state.masterData.find(r => r.rowId === 'AT6502');
    try { Wt.selectSuggestion(at.itemNum, at.roadName, at.itemType, { row: at }); } catch (e) {}
    return { num: Wt.wizard.data.itemNum, box: Wt.document.getElementById('wiz-input').value, row: Wt.wizard.matchedItem && Wt.wizard.matchedItem.rowId,
             pick: (Wt._wizResolveAddRow('6502-2', { raw: true }) || {}).rowId };
  };
  let tp = tapWorld(SUG);
  ok('L26 Atlas 6502 tapped with 6502-2 typed → the add keeps 6502-2 (box and save) and its row stays Atlas 6502', tp.num === '6502-2' && tp.box === '6502-2' && tp.row === 'AT6502' && tp.pick === 'AT6502', JSON.stringify(tp));
  tp = tapWorld(plant(SUG, "    if (_typedT) num = rrNumSaveAs(opts.row, _typedT);\n", "", 'tap-keep'));
  ok('L27 PLANTED: the tap keeping the catalog\'s 6502 → the -2 is lost (what L26 forbids — caught)', tp.num === '6502', JSON.stringify(tp));
  // Next: the two places it sets the saved number from the picked row both ask rrNumSaveAs
  ok('L28 Next sets the saved number through rrNumSaveAs in both places (no bare "= _exactMatch.itemNum" left)',
    (WIZ.match(/rrNumSaveAs\(_exactMatch, _rawInput\)/g) || []).length === 2 && !/wizard\.data\.itemNum = _exactMatch\.itemNum;/.test(WIZ));
  // third review, finding 1: a row only HELD from an earlier pause never gets past the guards
  const heldWorld = (src, loaded, all, data, held, typed) => {
    const Wh = addWorld(src);
    Wh.__setAll(all.map(r => Object.assign({}, r)));
    Wh.__set(loaded.map(r => Object.assign({}, r)), data);
    Wh.wizard.matchedItem = Wh.state.masterData.find(r => r.rowId === held);
    return (Wh._wizResolveAddRow(typed, { raw: true }) || {}).rowId || null;
  };
  let hr = heldWorld(SUG, RROWS, RALL, {}, 'AT6464', '6464-1');
  ok('L30 "6464", pause (Atlas 6464 held), then "6464-1" with no maker picked → no pick: Lionel\'s exact 6464-1 is in the catalog', hr === null, hr);
  hr = heldWorld(SUG, SROWS, SROWS, { _searchFilterManufacturer: 'Atlas' }, 'AO4001', '4001-2');
  ok('L31 "4001", pause (Atlas O 4001 held), then "4001-2" → no pick: Atlas O and Atlas HO both answer', hr === null, hr);
  const noTap = plant(SUG, "    if (!cur || d._tappedRow !== cur) return false;", "    if (!cur) return false;", 'tapped');
  hr = heldWorld(noTap, SROWS, SROWS, { _searchFilterManufacturer: 'Atlas' }, 'AO4001', '4001-2');
  ok('L32 PLANTED: a held row treated like a tapped one → 4001-2 picks Atlas O 4001 (what L31 forbids — caught)', hr === 'AO4001', hr);
  // third review, finding 2: the barcode / photo reader preference knows a maker named only in its rows
  const Wp = addWorld(SUG);
  Wp.__setAll(AROWS.map(r => Object.assign({}, r)));
  const pf2 = Wp.rrReaderPreferFrom({ manufacturer: 'Industrial Rail', scale: 'O' });
  const idmR = AROWS.find(r => r.rowId === 'IDM1007'), oreR = AROWS.find(r => r.rowId === 'ATORE'), pwR = AROWS.find(r => r.rowId === 'PW64641');
  ok('L33 Industrial Rail + O as a reader preference → Other O Brands, and the row must name Industrial Rail: IDM1007 fits, the Athearn row on the same tab and Lionel 6464-1 do not',
    !!pf2 && pf2.eras.indexOf('other_o') >= 0 && pf2.rowMaker === 'Industrial Rail' && Wp.rrRowFitsPrefer(idmR, pf2) && !Wp.rrRowFitsPrefer(oreR, pf2) && !Wp.rrRowFitsPrefer(pwR, pf2), JSON.stringify(pf2));
  const pfL = Wp.rrReaderPreferFrom({ manufacturer: 'Lionel', scale: 'O' });
  ok('L34 … a tab maker (Lionel) is unchanged: no row-maker rule', !!pfL && !pfL.rowMaker && pfL.eras.indexOf('pw') >= 0, JSON.stringify(pfL && pfL.eras));
  const chip = Wp.rrErasMatchingChips({ manufacturer: 'industrial rail', scale: 'any', era: 'any' });
  ok('L35 the Master Catalog chip Industrial Rail → Other O Brands (was: no catalog at all)', JSON.stringify(chip) === '["other_o"]', JSON.stringify(chip));
  Wp.eval('function _phState() { return { manufacturer: "industrial rail", scale: "any", era: "any" }; } _currentEra = "all";');
  const af = Wp.rrActiveFilter();
  ok('L36 … and the active filter it gives the readers stays the maker\'s (Industrial Rail, rows must name it), never all of Other O Brands', !!af && af.rowMaker === 'Industrial Rail' && af.manufacturer === 'Industrial Rail' && af.era === '', JSON.stringify(af));
  const Wq = addWorld(SUG, null, plant(WIZ, "if (pref.rowMaker && typeof rrRowMakerWord === 'function') {", "if (false) {", 'row-maker'));
  Wq.__setAll(AROWS.map(r => Object.assign({}, r)));
  const pfq = Wq.rrReaderPreferFrom({ manufacturer: 'Industrial Rail', scale: 'O' });
  ok('L37 PLANTED: the row-maker check taken out → the Athearn row on Other O Brands fits Industrial Rail (what L33 forbids — caught)', Wq.rrRowFitsPrefer(oreR, pfq));
  // fourth review: every new guard gets a test that fails without it
  const tapW = (src, loaded, all, data, typedAtTap, rowId) => {
    const Wt = addWorld(src);
    if (all) Wt.__setAll(all.map(r => Object.assign({}, r)));
    Wt.__set(loaded.map(r => Object.assign({}, r)), data);
    Wt.document.getElementById('wiz-input').value = typedAtTap;
    const row = Wt.state.masterData.find(r => r.rowId === rowId);
    try { Wt.selectSuggestion(row.itemNum, row.roadName, row.itemType, { row: row }); } catch (e) {}
    return Wt;
  };
  let Wt = tapW(SUG, SROWS, null, {}, '4001-2', 'AH4001');
  let tpk = (Wt._wizResolveAddRow('4001-2', { raw: true }) || {}).rowId;
  ok('L38 Atlas HO 4001 TAPPED with 4001-2 typed (no maker picked; Atlas O 4001 there too) → the add keeps 4001-2 and the tapped Atlas HO row', Wt.wizard.data.itemNum === '4001-2' && tpk === 'AH4001', Wt.wizard.data.itemNum + ' ' + tpk);
  Wt = tapW(plant(SUG, "  if (opts && opts.row) wizard.data._tappedRow = opts.row; else delete wizard.data._tappedRow;", "", 'tap-flag'), SROWS, null, {}, '4001-2', 'AH4001');
  tpk = (Wt._wizResolveAddRow('4001-2', { raw: true }) || {}).rowId || null;
  ok('L39 PLANTED: the tap not remembered → the tapped row is dropped (what L38 forbids — caught)', tpk === null, tpk);
  Wt = tapW(SUG, RROWS, RALL, {}, '6464', 'AT6464');
  tpk = (Wt._wizResolveAddRow('6464-1', { raw: true }) || {}).rowId || null;
  ok('L40 Atlas 6464 tapped at "6464", then "6464-1" typed with Lionel\'s 6464-1 in the catalog → no pick (exact wins over a tap of another number)', tpk === null, tpk);
  Wt = tapW(plant(SUG, "    return !(_all && _all.some && _all.some(function (i) { return i && rrNumSameAsTyped(i.itemNum, numLC) && fits(i); }));\n  };", "    return true;\n  };", 'tap-exact'), RROWS, RALL, {}, '6464', 'AT6464');
  tpk = (Wt._wizResolveAddRow('6464-1', { raw: true }) || {}).rowId || null;
  ok('L41 PLANTED: the exact check left out of the tap rule → 6464-1 keeps Atlas 6464 (what L40 forbids — caught)', tpk === 'AT6464', tpk);
  const lst = (src) => { const Wl = addWorld(src); Wl.__setAll(RALL.map(r => Object.assign({}, r))); Wl.__set(RROWS.map(r => Object.assign({}, r)), {}); Wl.updateItemSuggestions('6464-1');
    return Array.from(Wl.document.querySelectorAll('#wiz-suggestions [data-idx]')).map(x => (x.querySelector('span') || {}).textContent); };
  let ls = lst(SUG);
  ok('L42 "6464-1" typed, Lionel\'s exact 6464-1 in the full catalog → the list does not offer Atlas 6464 (list and picker agree)', ls.indexOf('6464') < 0, JSON.stringify(ls));
  ls = lst(plant(SUG, "      if (!_exactX) candidates = candidates.concat(_dashTwins);", "      candidates = candidates.concat(_dashTwins);", 'list-exact'));
  ok('L43 PLANTED: the list\'s full-catalog check taken out → Atlas 6464 offered again (caught)', ls.indexOf('6464') >= 0, JSON.stringify(ls));
  const staleW = (src) => { const Ws2 = tapW(src, SROWS, null, { _searchFilterManufacturer: 'Atlas' }, '4001', 'AO4001');
    try { Ws2.lookupItem('4002'); Ws2.wizard.matchedItem = Ws2.state.masterData.find(r => r.rowId === 'AO4001'); Ws2.lookupItem('4001'); } catch (e) {}
    Ws2.wizard.matchedItem = Ws2.state.masterData.find(r => r.rowId === 'AO4001');
    return (Ws2._wizResolveAddRow('4001-2', { raw: true }) || {}).rowId || null; };
  let st2 = staleW(SUG);
  ok('L44 tap Atlas O 4001, type 4002, back to 4001 (picked again by number, not tapped), then 4001-2 → no pick: the tap was let go', st2 === null, st2);
  st2 = staleW(plant(SUG, "    if (!(rrNumSameAsTyped(_tr.itemNum, _tn) || (typeof rrNumLooseTwin === 'function' && rrNumLooseTwin(_tr, _tn)) || (typeof rrNumCarTwin === 'function' && rrNumCarTwin(_tr, _tn)))) delete wizard.data._tappedRow;   // weavercr: or the number on its car\n", "", 'stale-tap'));
  ok('L45 PLANTED: the tap never let go → 4001-2 picks Atlas O 4001 by the old tap (caught)', st2 === 'AO4001', st2);
  // a row-cell maker before any of its rows are loaded (eras [])
  const We = addWorld(SUG);
  const pfe = We.rrReaderPreferFrom({ manufacturer: 'Industrial Rail', scale: 'O' });
  const kmtR = { itemNum: 'K1', manufacturer: 'KMT', _era: 'other_o', _tab: 'Other O Brands' };
  ok('L46 Industrial Rail + O with no Industrial Rail rows loaded yet (eras []) → IDM1007 still fits, a KMT row does not',
    !!pfe && pfe.eras.length === 0 && We.rrRowFitsPrefer(idmR, pfe) && !We.rrRowFitsPrefer(kmtR, pfe), JSON.stringify(pfe));
  const We2 = addWorld(SUG, null, plant(WIZ, "pref.manufacturer && pref.scale && !pref.rowMaker) return false;", "pref.manufacturer && pref.scale) return false;", 'rowmaker-scale'));
  ok('L47 PLANTED: the eras-[] exception taken out → IDM1007 no longer fits (caught)', !We2.rrRowFitsPrefer(idmR, We2.rrReaderPreferFrom({ manufacturer: 'Industrial Rail', scale: 'O' })));
  ok('L29 PLANTED: one bare rewrite put back is caught', /wizard\.data\.itemNum = _exactMatch\.itemNum;/.test(plant(WIZ, "wizard.data.itemNum = (typeof rrNumSaveAs === 'function') ? rrNumSaveAs(_exactMatch, _rawInput) : _exactMatch.itemNum;   // dashmaker", "wizard.data.itemNum = _exactMatch.itemNum;   // dashmaker", 'bare')));
}

// ── M: the maker list ──────────────────────────────────────────────────────
function makerWorld(appSrc, rows) {
  const A = appSrc || APPJS;
  const sb = { console: { log() {}, warn() {}, error() {} } };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext([
    'var ERAS = { pw: { manufacturer: "Lionel" }, atlas: { manufacturer: "Atlas" }, mth_o: { manufacturer: "MTH" }, other_o: { manufacturer: "" } };',
    'var state = { masterData: [] }; var _allErasSearchCache = null;',
    grab(A, 'function rrAlsoSoldAsNames('), grab(A, 'function _rrMakerWord('),
    A.indexOf('function rrMakerChoices(') >= 0 ? 'var _rrMakerChoicesMemo = null;\n' + grab(A, 'function rrMakerChoices(') : 'function rrMakerChoices() { return []; }',
  ].join('\n;\n'), sb);
  sb.state.masterData = rows;
  return sb;
}
const MROWS = [
  { itemNum: 'IDM1007', manufacturer: 'Industrial Rail' }, { itemNum: '4003', manufacturer: 'Industrial Rail' },
  { itemNum: 'K1', manufacturer: 'KMT' }, { itemNum: '30-1', alsoSoldAs: 'Lionel Corporation' }, { itemNum: 'X', manufacturer: 'lionel' },
];
{
  const M = makerWorld(APPJS, MROWS);
  const list = M.rrMakerChoices();
  ok('M1 the maker list holds the tabs\' makers AND each row\'s own maker (Industrial Rail, KMT)',
    ['Atlas', 'Industrial Rail', 'KMT', 'Lionel', 'MTH'].every(m => list.indexOf(m) >= 0), JSON.stringify(list));
  ok('M2 … no blank, no repeat (a row\'s "lionel" is the tab\'s Lionel), and "Lionel Corporation" is not repeated under Lionel',
    list.indexOf('') < 0 && list.filter(m => m.toLowerCase() === 'lionel').length === 1 && list.indexOf('Lionel Corporation') < 0, JSON.stringify(list));
  ok('M3 sorted A–Z', JSON.stringify(list) === JSON.stringify(list.slice().sort((a, b) => a.toLowerCase() < b.toLowerCase() ? -1 : 1)), JSON.stringify(list));
  M.state.masterData = MROWS.concat([{ itemNum: 'Z', manufacturer: 'Crown Model Products' }]);
  ok('M4 a maker added to the catalog joins the list (the memo is rebuilt on a size change)', M.rrMakerChoices().indexOf('Crown Model Products') >= 0);
  ok('M5 the Add screen builds its Manufacturer list from rrMakerChoices', /var mfrs = \(typeof rrMakerChoices === 'function'\) \? rrMakerChoices\(\)/.test(WIZ));
  // planted: the old one-maker-per-tab list
  const old = plant(APPJS, "      if (r.manufacturer) put(r.manufacturer);\n", "", 'tab-only');
  const Mo = makerWorld(old, MROWS);
  ok('M6 PLANTED: rows\' own makers left out → Industrial Rail missing (what M1 forbids — caught)', Mo.rrMakerChoices().indexOf('Industrial Rail') < 0);
}

// ── C: the Master Catalog's maker picker (plan item 4) ─────────────────────
function catWorld(browseSrc) {
  const sb = { console: { log() {}, warn() {}, error() {} } };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext([
    'var WHAT_I_COLLECT = { MANUFACTURERS: { lionel: { id: "lionel", label: "Lionel" }, atlas: { id: "atlas", label: "Atlas" }, "a.c. gilbert": { id: "a.c. gilbert", label: "A.C. Gilbert (American Flyer)" } } }; window.WHAT_I_COLLECT = WHAT_I_COLLECT;',
    'var state = { filters: { owned: false }, masterData: [{ itemNum: "IDM1007", manufacturer: "Industrial Rail", _era: "other_o" }, { itemNum: "K1", manufacturer: "KMT", _era: "other_o" }, { itemNum: "C1", manufacturer: "Crown Model Products", _era: "other_o" }, { itemNum: "6464", _era: "atlas" }] };',
    'var __off = new Set(); function _offShelfEras() { return __off; } this.__setOff = function (a) { __off = new Set(a); };',
    'function rrMakerChoices() { return ["A.C. Gilbert", "Atlas", "Crown Model Products", "Industrial Rail", "KMT", "Lionel", "Petersen"]; }',
    'function _isManufacturerEnabled(id) { return ["lionel"].indexOf(String(id).toLowerCase()) >= 0; }',
    'function _manufacturerOfItem(i) { return i && i.manufacturer ? String(i.manufacturer).toLowerCase() : null; }',
    grab(APPJS, 'function rrAlsoSoldAsNames('), grab(APPJS, 'function _rrMakerWord('), grab(APPJS, 'function rrRowAlsoSoldBy('),
    'var _ERA_PERIOD_LABELS = {}; var _PH_SECTION_LABELS = {};',
    browseSrc.indexOf('var _phCatMakerLabels') >= 0 ? browseSrc.slice(browseSrc.indexOf('var _phCatMakerLabels'), browseSrc.indexOf('\n', browseSrc.indexOf('var _phCatMakerLabels'))) : '',
    browseSrc.indexOf('function _phCatalogOnlyMakers(') >= 0 ? grab(browseSrc, 'function _phCatalogOnlyMakers(') : 'function _phCatalogOnlyMakers() { return []; }',
    grab(browseSrc, 'function _phLabelFor('), grab(browseSrc, 'function _phPrefAllows('), grab(browseSrc, 'function rrChipRowPasses('),
  ].join('\n;\n'), sb);
  return sb;
}
{
  const C = catWorld(BROWSE);
  const extra = C._phCatalogOnlyMakers();
  ok('C1 the Master Catalog adds the makers only a catalog row names (Crown Model Products, Industrial Rail, KMT) — never one What I Collect already lists, never one with no row on the shelf (Petersen: only the Add screen\'s full copy names it)',
    JSON.stringify(extra) === JSON.stringify(['Crown Model Products', 'Industrial Rail', 'KMT']), JSON.stringify(extra));
  ok('C2 a pick shows its own spelling ("industrial rail" → "Industrial Rail")', C._phLabelFor('manufacturer', 'industrial rail') === 'Industrial Rail', C._phLabelFor('manufacturer', 'industrial rail'));
  ok('C3 What I Collect cannot hide it (no tick exists for it); an unticked listed maker (Atlas) is still hidden',
    C._phPrefAllows('manufacturer', 'industrial rail') === true && C._phPrefAllows('manufacturer', 'atlas') === false);
  const ir = { itemNum: 'IDM1007', manufacturer: 'Industrial Rail', _era: 'other_o', _tab: 'Other O Brands' }, kmt = { itemNum: 'K1', manufacturer: 'KMT', _era: 'other_o', _tab: 'Other O Brands' };
  const ch = { manufacturer: 'industrial rail', scale: 'any', era: 'any' };
  ok('C4 picking it keeps its rows and drops the other makers\' (Industrial Rail IDM1007 in, KMT out)',
    C.rrChipRowPasses(ir, null, ch, '', { allEra: true }) === true && C.rrChipRowPasses(kmt, null, ch, '', { allEra: true }) === false);
  ok('C5 the picker builds this list only in the Master Catalog (My Collection keeps its own "Also in your collection" list)',
    /if \(!state\.filters\.owned\) \{\s*\n\s*var _catOnly = _phCatalogOnlyMakers\(_catalogLabels\);/.test(BROWSE));
  C.__setOff(['other_o']);
  const offList = C._phCatalogOnlyMakers();
  ok('C7 (third review) Other O Brands left off in What I Collect → none of its row makers offered (picking one would show an empty list)', offList.length === 0, JSON.stringify(offList));
  ok('C8 … and a pick saved earlier still shows its own spelling', C._phLabelFor('manufacturer', 'kmt') === 'KMT', C._phLabelFor('manufacturer', 'kmt'));
  const Cs = catWorld(plant(BROWSE, "      if (k[lc] || !onShelf[word(m)]) return;", "      if (k[lc]) return;", 'shelf'));
  Cs.__setOff(['other_o']);
  ok('C9 PLANTED: the shelf check taken out → Industrial Rail offered with Other O Brands off the shelf (what C7 forbids — caught)', Cs._phCatalogOnlyMakers().indexOf('Industrial Rail') >= 0);
  const Cp = catWorld(plant(BROWSE, "      if (!_MFs[String(id).toLowerCase()]) return true;\n", "", 'pref-open'));
  ok('C6 PLANTED: the What I Collect check asked of a catalog-row maker → Industrial Rail hidden (what C3 forbids — caught)', Cp._phPrefAllows('manufacturer', 'industrial rail') === false);
}

// ── P: the photo reader keeps a row-cell maker's own rows (fourth review) ───
{
  const PIR = require('./lib/pin-source').pinSource();   // the Photo Inbox, read the ONE way (pin_source_tests R1)
  const sb = { console: { log() {}, warn() {}, error() {} } }; sb.window = sb; vm.createContext(sb);
  vm.runInContext([grab(APPJS, 'function rrAlsoSoldAsNames('), grab(APPJS, 'function _rrMakerWord('), grab(APPJS, 'function rrRowAlsoSoldBy('),
    'function rrRowMakerWord(m) { return m && m.manufacturer ? m.manufacturer : ""; }', grab(PIR, 'function _pinRowMakerOk(')].join('\n;\n'), sb);
  const pr = { rowMaker: 'Industrial Rail', eras: ['other_o'] };
  ok('P1 _pinRowMakerOk: with Industrial Rail as the row maker, IDM1007 passes and KMT\'s row on the same tab does not; with no row maker, every row passes',
    sb._pinRowMakerOk({ manufacturer: 'Industrial Rail' }, pr) && !sb._pinRowMakerOk({ manufacturer: 'KMT' }, pr) && sb._pinRowMakerOk({ manufacturer: 'KMT' }, { eras: ['other_o'] }));
  // (each call is guarded with typeof: other suites run these readers one function at a time)
  const calls = ["return !!(r && _eras.indexOf(r._era) >= 0 && (typeof _pinRowMakerOk !== 'function' || _pinRowMakerOk(r, prefer)));",
                 "return !!(row && _inEraSet.indexOf(row._era) >= 0) && (typeof _pinRowMakerOk !== 'function' || _pinRowMakerOk(row, prefer));",
                 "if (rows && prefer && prefer.rowMaker && typeof _pinRowMakerOk === 'function') rows = rows.filter(function (r) { return _pinRowMakerOk(r, prefer); });",
                 "if (typeof _pinRowMakerOk === 'function' && !_pinRowMakerOk(row, prefer)) return;   // dashmaker"];
  ok('P2 the four era-list readers (the reconcile step\'s era check, the era gate, the quote match, the word match) each ask _pinRowMakerOk', calls.every(c => PIR.indexOf(c) >= 0));
  ok('P3 PLANTED: one of them losing the question is caught', !calls.every(c => plant(PIR, calls[3], "// (removed)", 'desc').indexOf(c) >= 0)
    && !calls.every(c => plant(PIR, calls[0], "return !!(r && _eras.indexOf(r._era) >= 0);", 'reconcile').indexOf(c) >= 0));
  // the reconcile step's check, run: a KMT number read off an Industrial Rail photo is not "in the filter"
  {
    const src = grab(PIR, 'function _pinReconcileAiNum(');
    const inEraSrc = src.slice(src.indexOf('var inEra = function (c) {'), src.indexOf('};', src.indexOf('var inEra = function (c) {')) + 2);
    const sb2 = { console: { log() {}, warn() {}, error() {} } }; sb2.window = sb2; vm.createContext(sb2);
    const rowsBy = { K1: { itemNum: 'K1', manufacturer: 'KMT', _era: 'other_o' }, IDM1007: { itemNum: 'IDM1007', manufacturer: 'Industrial Rail', _era: 'other_o' } };
    sb2.__rows = rowsBy;
    vm.runInContext([grab(APPJS, 'function rrAlsoSoldAsNames('), grab(APPJS, 'function _rrMakerWord('), grab(APPJS, 'function rrRowAlsoSoldBy('),
      'function rrRowMakerWord(m) { return m && m.manufacturer ? m.manufacturer : ""; }', grab(PIR, 'function _pinRowMakerOk('),
      'function findMaster(c) { return __rows[c] || null; }',
      'var prefer = { eras: ["other_o"], rowMaker: "Industrial Rail" }; var _eras = ["other_o"];', inEraSrc, 'this.__inEra = inEra;'].join('\n;\n'), sb2);
    ok('P4 the reconcile step, run: under Industrial Rail the KMT number K1 is NOT in the filter, IDM1007 is', !sb2.__inEra('K1') && sb2.__inEra('IDM1007'));
  }
}

// ── S: scans, each proven on a planted offender ────────────────────────────
const NUMFILES = ['app-data.js', 'wizard-suggestions.js', 'browse.js', 'wizard.js'];
const dashCopies = src => (src.match(/\[A-Za-z\]\+\)-\(\?=\\d\)/g) || []).length;   // the letters-dash strip, written out
ok('S1 the rule lives ONCE: rrNumDashKey / rrNumSuffixBase / rrNumLooseTwin are defined only in app.js',
  ['rrNumDashKey', 'rrNumSuffixBase', 'rrNumLooseTwin'].every(f => (APPJS.match(new RegExp('function ' + f + '\\(', 'g')) || []).length === 1)
  && NUMFILES.every(f => !/function rrNum(DashKey|SuffixBase|LooseTwin)\(/.test(read(f))));
ok('S2 no second letters-dash strip in the number-search files', NUMFILES.every(f => dashCopies(read(f)) === 0) && dashCopies(APPJS) === 1);
ok('S3 PLANTED: a home-made strip in the Add list is caught', dashCopies(plant(SUG, 'function rrNumSameAsTyped(rowNum, typed) {', 'function rrNumSameAsTyped(rowNum, typed) { typed = String(typed).replace(/^([A-Za-z]+)-(?=\\d)/, "$1");', 'strip')) === 1);
// findMaster asks the loose kin only behind the letter bridge's gate, and the ending only when a catalog is named
const gateRe = /if \(typeof _looseKinRows === 'function'\s*\n\s*&& !\(_kinNamed \? pool\.some\(_kinSatisfied\) : pool\.length\)\) \{\s*\n\s*(\/\/[^\n]*\n\s*)*const _lk = _looseKinRows\(idx, k, \{ suffix: _kinNamed, belongs: _kinNamed \? _kinSatisfied : null \}\)/;
ok('S4 findMaster asks the dash twin only when nothing answers for the catalog named; the road-number ending only with a catalog named', gateRe.test(DAT));
{
  const W = lookupWorld(plant(DAT, '_looseKinRows(idx, k, { suffix: _kinNamed,', '_looseKinRows(idx, k, { suffix: true,', 'suffix-always'));
  const lio = row('6502', 'Lionel PW - Items', { rowId: 'PW6502', _era: 'pw' }), atl = row('6502', 'Atlas O', { rowId: 'AT6502', _era: 'atlas' });
  W.__index([lio, atl], [lio, atl]);
  const r = W.findMaster('6502-2', null, null);
  ok('S5 PLANTED: the ending asked with no catalog named → 6502-2 picks a maker\'s 6502 by number alone (what F7 forbids — caught)', r !== null, r && r._tab);
}
{
  const both = plant(plant(DAT, "  if (typeof _looseKinRows === 'function'\n      && !(_kinNamed ? pool.some(_kinSatisfied) : pool.length)) {", "  if (typeof _looseKinRows === 'function' && true) {", 'gate'), '  if (_exactSomewhere) return [];\n', '', 'exact-guard');
  const W = lookupWorld(both);
  const ore = row('RND-1166', 'Athearn', { rowId: 'ATORE' }), box = row('RND1166', 'Athearn', { rowId: 'ATBOX' });
  W.__index([ore, box], [ore, box]);
  const r = W._findMasterCore(W.state.masterByItem, 'RND1166', null, null);
  ok('S6 PLANTED: the gate AND the exact-anywhere check removed → the twin is put FIRST beside an exact row (RND1166 answers the ore car — caught)', r === ore, r && r.rowId);
}
{
  const W = lookupWorld(plant(DAT, '  if (_exactSomewhere) return [];\n', '', 'exact-guard'));
  const loco = row('1001', 'Lionel PW - Items', { rowId: 'PW1001', _era: 'pw' }), part = row('1001-12', 'Lionel Parts', { rowId: 'LP100112', _era: 'lionel_parts' });
  const kl = row('K6406', 'K-Line O', { rowId: 'KL6406', _era: 'kline' }), oo = row('K-6406', 'Other O Brands', { rowId: 'OOK6406', _era: 'other_o' });
  W.__index([kl], [kl, oo]);
  const r = W.findMaster('K-6406', '', { era: 'kline' });
  ok('S6b PLANTED: the exact-anywhere check removed → K-6406 with K-Line named answers the loaded twin K6406 although the full catalog holds K-6406 (caught)', r === kl, r && r.rowId);
}
// the Add list asks the twin only inside its "not the number as written" branch
const addBranch = SUG.slice(SUG.indexOf('if (!m.itemNum.toLowerCase().includes(numPart) && !rrNumSameAsTyped(m.itemNum, numPart)) {'), SUG.indexOf('_isZeroTwin = true;'));
ok('S7 the Add list asks rrNumLooseTwin only where the number as written did not answer (held aside, in its own list)', /rrNumLooseTwin\(m, numPart\)/.test(addBranch) && (SUG.match(/rrNumLooseTwin\(m, numPart\)/g) || []).length === 1 && /_isDashTwin = true;/.test(addBranch));
// the Master Catalog search holds a dash twin exactly as it holds a zero twin
ok('S8 the Master Catalog search admits a dash twin into the same hold (_zAdmitted → _zKeep drops it beside an exact row)',
  /if \(_dQ && rrNumLooseTwin\(item, _dQ\) && !_aliasSearch\(haystack, search\)\) \{ _zAdmitted\.add\(item\); return true; \}/.test(BROWSE)
  && /var _zLC = \(_zQ \|\| _dQ\)\.toLowerCase\(\);/.test(BROWSE)
  && BROWSE.indexOf('if (_dQ && rrNumLooseTwin(item, _dQ)') >= 0
  && BROWSE.indexOf('if (_dQ && rrNumLooseTwin(item, _dQ)') < BROWSE.indexOf('if (!_aliasSearch(haystack, search)) return false;', BROWSE.indexOf('if (_dQ && rrNumLooseTwin(item, _dQ)') - 400));
ok('S8b … and only for a search that can have a twin at all (rrNumMayHaveLooseTwin), never every plain number', /rrNumMayHaveLooseTwin\(_zQ\)\) \? _zQ : ''/.test(BROWSE));
ok('S8c the Add screen keeps the remembered maker as a choice', /if \(_mfrNow && mfrs\.indexOf\(_mfrNow\) < 0\) mfrs = mfrs\.concat\(\[_mfrNow\]\)\.sort\(/.test(WIZ));
// the WeakMap caches stay apart (two kin indexes sharing one cache name corrupt each other)
const cacheNames = (DAT.match(/^var (_\w+Cache) = \(typeof WeakMap/gm) || []).map(s => s.split(' ')[1]);
ok('S9 every kin index has its own cache name (no two "var _xCache = … WeakMap" share one)', cacheNames.length >= 3 && new Set(cacheNames).size === cacheNames.length, JSON.stringify(cacheNames));
{
  const dup = plant(DAT, 'var _dkCache = (typeof WeakMap', 'var _lkCache = (typeof WeakMap', 'cache-name');
  const names = (dup.match(/^var (_\w+Cache) = \(typeof WeakMap/gm) || []).map(s => s.split(' ')[1]);
  ok('S10 PLANTED: the dash index reusing the letter index\'s cache name is caught', new Set(names).size !== names.length);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
