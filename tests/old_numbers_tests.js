#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// A MAKER'S OTHER WAY OF WRITING THE SAME NUMBER (oldnumbers, 2026-11-25)
// [stated] Brad 2026-11-25 09:32 CT "yes" — the two search fixes owed to customer Bob.
//
// Bob typed two MTH numbers the way his paperwork writes them and found nothing:
//   30-1906-01  the catalog (and MTH) write 30-1906-1 — one digit at the end
//   RK-2005LP   MTH's 1990s RailKing number of today's 30-2005-1 (LP = with
//               Proto-Sound = -1; L = horn / whistle = -0). Proven on MTH's own
//               pages for RK-2005LP (Conrail SD60) and RK-1111LP (N&W 0-8-0).
// Both are a FALLBACK like the zero and dash twins (asked only when nothing
// answers to the number as written) and ONLY for the catalogs named in
// RR_OLD_NUMBER_ERAS: on K-Line and the parts tabs an ending's zero is the whole
// difference (K2625-01 / K2625-1).
//   R  the rule (rrNumOtherSpellings / rrNumOldSpellingTwin, app.js)
//   F  findMaster, findAllMaster, rrCatalogCandidates
//   L  the Add list and the one row picker (real code, jsdom)
//   S  scans
// Every planted offender must be caught, and its check must be green on the real code.
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
const RULE = s => [grab(s, 'function rrNumDashKey('), grab(s, 'function rrNumSuffixBase('), grab(s, 'function rrNumOtherSpellings('), 'var _rrOldSpellMemo = { typed: null, out: [] };', grab(s, 'function rrNumOldSpellingTwin('), grab(s, 'function rrNumLooseTwin(')].join('\n');

// ── the lookup world: the REAL functions in a sandbox ──────────────────────
function lookupWorld(datSrc, appSrc, cfgSrc) {
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
    (cfgSrc || CFG).match(/const RR_OLD_NUMBER_ERAS = \{[^}]*\};/)[0].replace('const ', 'var '),
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
const M = (num, extra) => Object.assign({ itemNum: num, _tab: 'MTH O', _era: 'mth_o', itemType: 'Diesel Locomotive', description: 'MTH engine', roadName: '', rowId: 'M' + num.replace(/\W/g, '') }, extra || {});
const K4 = M('30-1906-1', { itemType: 'Steam Locomotive', description: '4-6-2 Imperial K-4s Pacific Steam Engine w/Proto-Sound 3.0', roadName: 'Great Northern' });
const SD1 = M('30-2005-1', { description: 'Conrail SD-60 Diesel Engine - With Proto', roadName: 'Conrail' });
const SD0 = M('30-2005-0', { description: 'SD-60 Diesel Engine - 3-Rail Horn', roadName: 'Conrail' });
const BOX = M('30-7401', { itemType: 'Boxcar', description: 'Box Car', roadName: 'New York Central' });
const KL1 = { itemNum: 'K2625-1', _tab: 'K-Line O', _era: 'kline', itemType: 'Boxcar', description: 'K-Line car one', roadName: '', rowId: 'KL26251' };
const LP55 = { itemNum: '2367-55', _tab: 'Lionel Parts', _era: 'lionel_parts', itemType: 'Part', description: 'a part', roadName: '', rowId: 'LP236755' };
const HO1 = { itemNum: '80-2005-1', _tab: 'MTH HO', _era: 'mth_ho', itemType: 'Diesel Locomotive', description: 'HO engine', roadName: '', rowId: 'HO8020051' };
// a zero in an ENDING is a different item on these catalogs (K-Line K-652-03-01, Atlas Parts 1160-13-03 are real numbers)
const KL2 = { itemNum: 'K652-13-1', _tab: 'K-Line O', _era: 'kline', itemType: 'Boxcar', description: 'K-Line car two', roadName: '', rowId: 'KL652131' };
const AP3 = { itemNum: '1160-13-3', _tab: 'Atlas Parts', _era: 'atlas_parts', itemType: 'Part', description: 'a part', roadName: '', rowId: 'AP1160133' };
const ROWS = [K4, SD1, SD0, BOX, KL1, KL2, AP3, LP55, HO1];
const planted = [];   // [label, caughtOnPlanted, greenOnReal]
function mustCatch(label, real, bad) { planted.push([label, real === true, bad === false]); }

// ── R: the rule ────────────────────────────────────────────────────────────
function ruleChecks(appSrc, cfgSrc) {
  const W = lookupWorld(DAT, appSrc, cfgSrc);
  const O = n => W.rrNumOtherSpellings(n).map(o => o.num + ':' + o.rule).join(','), T = W.rrNumOldSpellingTwin, LT = W.rrNumLooseTwin;
  return {
    R1: O('30-1906-01') === '30-1906-1:zeroEnding' && O('30-2005-00') === '30-2005-0:zeroEnding' && O('30-1906-001') === '30-1906-1:zeroEnding',
    R2: O('30-1906-1') === '' && O('30-1906-10') === '' && O('2343') === '' && O('6464-1') === '' && O('30-2005-0') === '' && O('') === '',
    R2b: O('40-0200') === '' && O('30-01') === '' && O('6-01') === '' && O('10-0200') === '' && O('30-20372-01') === '30-20372-1:zeroEnding',
    R3: O('RK-2005LP') === '30-2005-1:railKing' && O('rk2005lp') === '30-2005-1:railKing' && O('RK-2005L') === '30-2005-0:railKing' && O('RK-7401') === '30-7401:railKing',
    R4: O('RK-20051') === '' && O('RK-205LP') === '' && O('RK-2005X') === '' && O('MT-2128LP') === '' && O('K-2005') === '',
    R5: T(K4, '30-1906-01') && LT(K4, '30-1906-01') && T(SD1, 'RK-2005LP') && LT(SD1, 'rk-2005lp') && T(SD0, 'RK-2005L') && T(BOX, 'RK-7401'),
    R6: !T(SD0, 'RK-2005LP') && !T(SD1, 'RK-2005L') && !T(SD1, 'RK-2005') && !T(K4, '30-1906-1') && !T('30-1906-1', '30-1906-01'),
    R7: !T(KL1, 'K2625-01') && !LT(KL1, 'K2625-01') && !T(LP55, '2367-055') && !LT(LP55, '2367-055') && !T(KL2, 'K652-13-01') && !LT(KL2, 'K652-13-01') && !T(AP3, '1160-13-03') && !LT(AP3, '1160-13-03'),
    R8: T(HO1, '80-2005-01') && !T(HO1, 'RK-2005LP') && !T(Object.assign({}, SD1, { _era: 'mth_ho', itemNum: '30-2005-1' }), 'RK-2005LP'),
    R11: T(K4, '30-1906-01') && !T(K4, 'RK-2005LP') && T(SD1, 'RK-2005LP') && !T(SD1, '30-1906-01') && T(K4, '30-1906-01'),
    R9: W.rrNumMayHaveLooseTwin('30-1906-01') && W.rrNumMayHaveLooseTwin('RK-2005LP') && !W.rrNumMayHaveLooseTwin('2343') && !W.rrNumMayHaveLooseTwin('20-66238'),
    R10: W.rrNumSaveAs(K4, '30-1906-01') === '30-1906-1' && W.rrNumSaveAs(SD1, 'RK-2005LP') === '30-2005-1' && W.rrNumSaveAs({ itemNum: '6502', _era: 'atlas' }, '6502-2') === '6502-2',
  };
}
{
  const r = ruleChecks();
  ok('R1 the extra zero: 30-1906-01 → 30-1906-1, 30-2005-00 → 30-2005-0, 30-1906-001 → 30-1906-1', r.R1);
  ok('R2 no other spelling for 30-1906-1, 30-1906-10, 2343, 6464-1, 30-2005-0', r.R2);
  ok('R2b an ENDING only: a two-part number (MTH 40-0200, 10-0200) and a half-typed one (30-01, 6-01) have no other spelling; 30-20372-01 → 30-20372-1', r.R2b);
  ok('R3 RailKing: RK-2005LP → 30-2005-1 (any case, with or without the dash), RK-2005L → 30-2005-0, RK-7401 → 30-7401', r.R3);
  ok('R4 not RailKing numbers: RK-20051, RK-205LP, RK-2005X, MT-2128LP, K-2005', r.R4);
  ok('R5 twins: the MTH rows answer 30-1906-01, RK-2005LP, RK-2005L, RK-7401 (and rrNumLooseTwin says so too)', r.R5);
  ok('R6 not twins: the horn engine for RK-2005LP, the Proto engine for RK-2005L or a bare RK-2005, a number and itself, a bare number with no row', r.R6);
  ok('R7 ONLY the named catalogs: K-Line K652-13-1 never answers K652-13-01, Atlas Parts 1160-13-3 never 1160-13-03 (nor K2625-1 / 2367-55 their zero forms)', r.R7);
  ok('R8 the extra zero is for every MTH catalog (MTH HO 80-2005-01); the RailKing rule is MTH O only', r.R8);
  ok('R11 two typed numbers asked in turn never answer from each other (the remembered spellings follow the typed number)', r.R11);
  ok('R9 rrNumMayHaveLooseTwin: 30-1906-01 and RK-2005LP → yes; 2343, 20-66238 → no', r.R9);
  ok('R10 saved as the CATALOG writes it: 30-1906-01 → 30-1906-1, RK-2005LP → 30-2005-1 (an Atlas road-number ending is still kept)', r.R10);
  // planted: the era list dropped (every catalog takes the rule)
  const everyTab = plant(plant(APPJS, "return o.num.toLowerCase() === x && Array.isArray(E[o.rule]) && E[o.rule].indexOf(era) >= 0;", "return o.num.toLowerCase() === x;", 'every-catalog'), "  if (!listed) return false;\n", "", 'every-catalog-gate');
  mustCatch('R7 every catalog takes the rule', r.R7, ruleChecks(everyTab).R7);
  // planted: LP and L swapped
  const swapped = plant(APPJS, "(k[2].toUpperCase() === 'LP' ? '-1' : '-0')", "(k[2].toUpperCase() === 'LP' ? '-0' : '-1')", 'lp-swapped');
  mustCatch('R3 LP and L swapped', r.R3, ruleChecks(swapped).R3);
  // planted: the typed spelling kept at save
  const keepTyped = plant(APPJS, "  if (typeof rrNumOldSpellingTwin === 'function' && rrNumOldSpellingTwin(row, y)) return rn;   // oldnumbers", "  // (removed)   // oldnumbers", 'save-as');
  mustCatch('R10 the typed spelling saved', r.R10, ruleChecks(keepTyped).R10);
  // planted: the remembered spellings never refreshed
  const stale = plant(APPJS, "  if (_rrOldSpellMemo.typed !== y) { _rrOldSpellMemo.typed = y; _rrOldSpellMemo.out = rrNumOtherSpellings(y); }", "  if (_rrOldSpellMemo.typed === null) { _rrOldSpellMemo.typed = y; _rrOldSpellMemo.out = rrNumOtherSpellings(y); }", 'stale-memo');
  mustCatch('R11 the remembered spellings never refreshed', r.R11, ruleChecks(stale).R11);
  // planted: the two-part number takes the rule again
  const wide = plant(APPJS, "var z = s.match(/^(.*\\d-.*\\d)-0+(\\d+)$/);", "var z = s.match(/^(.*\\d)-0+(\\d+)$/);", 'wide-zero');
  mustCatch('R2b a two-part number takes the rule', r.R2b, ruleChecks(wide).R2b);
  // planted: K-Line added to the zero-ending list
  const kline = plant(CFG, "zeroEnding: ['mth_o', 'mth_ho', 'mth_s', 'mth_tinplate', 'mth_g'],", "zeroEnding: ['mth_o', 'mth_ho', 'mth_s', 'mth_tinplate', 'mth_g', 'kline', 'atlas_parts'],", 'kline-listed');
  mustCatch('R7 K-Line / Atlas Parts on the list', r.R7, ruleChecks(null, kline).R7);
  // planted: the RailKing rule opened to MTH HO
  const rkHo = plant(CFG, "railKing: ['mth_o'],", "railKing: ['mth_o', 'mth_ho'],", 'rk-ho');
  mustCatch('R8 RailKing on MTH HO', r.R8, ruleChecks(null, rkHo).R8);
}

// ── F: findMaster and friends ──────────────────────────────────────────────
function findChecks(datSrc) {
  const W = lookupWorld(datSrc || DAT);
  W.__index(ROWS, ROWS);
  const exactOther = { itemNum: '30-1906-01', _tab: 'Other O Brands', _era: 'other_o', itemType: 'Boxcar', description: 'another maker', rowId: 'OTH' };
  const out = {};
  let r = W.findMaster('30-1906-01', null, null); out.F1 = r === K4;
  r = W.findMaster('30-1906-01', null, { era: 'mth_o' }); out.F2 = r === K4;
  r = W.findMaster('RK-2005LP', null, null); out.F3 = r === SD1;
  r = W.findMaster('RK-2005L', null, { era: 'mth_o' }); out.F4 = r === SD0;
  out.F5 = W.findMaster('K2625-01', null, null) === null && W.findMaster('2367-055', null, { era: 'lionel_parts' }) === null && W.findMaster('K652-13-01', null, { era: 'kline' }) === null && W.findMaster('1160-13-03', null, null) === null;
  out.F6 = W.findMaster('30-1906-1', null, null) === K4 && W.findMaster('30-2005-0', null, null) === SD0;
  out.F7 = W.rrCatalogCandidates('RK-2005LP').map(x => x.itemNum).join() === '30-2005-1' && W.findAllMaster('30-1906-01').map(x => x.itemNum).join() === '30-1906-1';
  W.__index(ROWS.concat([exactOther]), ROWS.concat([exactOther]));
  r = W.findMaster('30-1906-01', null, null); out.F8 = r === exactOther;
  // the base-key trap: RK-2005LP minus its P is RK-2005L, whose twin is the HORN engine
  const hornOnly = ROWS.filter(x => x !== SD1);
  W.__index(hornOnly, hornOnly);
  out.F9 = W.findMaster('RK-2005LP', null, null) === null && W.findMaster('RK-2005LP', null, { era: 'mth_o' }) === null
    && W.findAllMaster('RK-2005LP').length === 0 && W.rrCatalogCandidates('RK-2005LP').length === 0;
  // an owned copy saved under the old spelling keeps (only) its own row
  out.F10 = W._rrRowIdFits(SD1, 'RK-2005LP', '') && !W._rrRowIdFits(SD0, 'RK-2005LP', '') && W._rrRowIdFits(K4, '30-1906-01', '') && !W._rrRowIdFits(KL2, 'K652-13-01', '');
  // two layers: MTH O only in the full-catalog index
  W.__index([KL1], ROWS);
  out.F11 = W.findMaster('RK-2005LP', null, null) === SD1 && W.findMaster('30-1906-01', null, { era: 'mth_o' }) === K4;
  return out;
}
{
  const f = findChecks();
  ok('F1 30-1906-01 (no catalog named) → MTH\'s 30-1906-1 (was: nothing)', f.F1);
  ok('F2 … and with MTH O named', f.F2);
  ok('F3 RK-2005LP → 30-2005-1, the Conrail SD-60 with Proto (was: nothing)', f.F3);
  ok('F4 RK-2005L → 30-2005-0, the horn engine', f.F4);
  ok('F5 K-Line K2625-01 and Lionel Parts 2367-055 still find nothing (their -1 / -55 are other items)', f.F5);
  ok('F6 the numbers as the catalog writes them answer as before', f.F6);
  ok('F7 rrCatalogCandidates("RK-2005LP") offers 30-2005-1 ONLY — never the horn engine 30-2005-0 (so "Now in the catalog" can link a hand entry); findAllMaster fills the blank', f.F7);
  ok('F8 exact always wins: a catalog that holds 30-1906-01 as written answers, never the twin', f.F8);
  ok('F9 with only the horn engine 30-2005-0 in the catalog, RK-2005LP finds NOTHING anywhere (its base key RK-2005L never reaches the twin lookup)', f.F9);
  ok('F10 an owned copy saved as RK-2005LP fits the 30-2005-1 row and never the 30-2005-0 row; 30-1906-01 fits 30-1906-1; K2625-01 never fits K-Line K2625-1', f.F10);
  ok('F11 MTH O held only in the full-catalog index: both numbers still find their rows', f.F11);
  const noLook = plant(DAT, "  if (typeof rrNumOtherSpellings === 'function') rrNumOtherSpellings(asked).forEach(function (o) { if (looks.indexOf(o.num) < 0) looks.push(o.num); });\n", "", 'no-lookup');
  const b = findChecks(noLook);
  mustCatch('F1 the other spelling never looked up', f.F1, b.F1);
  mustCatch('F3 the RailKing number never looked up', f.F3, b.F3);
  const baseKey = plant(DAT, "          if (k !== n && typeof rrNumOldSpellingTwin === 'function' && rrNumOldSpellingTwin(r, k) && !rrNumOldSpellingTwin(r, n)) return;\n", "", 'base-key');
  mustCatch('F7 the horn engine offered for RK-2005LP (the base key RK-2005L)', f.F7, findChecks(baseKey).F7);
  const noExact = plant(DAT, '  if (_exactSomewhere) return [];\n', '', 'exact-guard');
  const gate = plant(noExact, "  if (typeof _looseKinRows === 'function'\n      && !(_kinNamed ? pool.some(_kinSatisfied) : pool.length)) {", "  if (typeof _looseKinRows === 'function' && true) {", 'gate');
  mustCatch('F8 the twin beside an exact answer', f.F8, (function () { const W = lookupWorld(gate); const ex = { itemNum: '30-1906-01', _tab: 'Other O Brands', _era: 'other_o', itemType: 'Boxcar', description: 'x', rowId: 'OTH' }; W.__index(ROWS.concat([ex]), ROWS.concat([ex])); const got = W.findAllMaster('30-1906-01'); return got.length === 1 && got[0] === ex && W.findMaster('30-1906-01', null, null) === ex && W._looseKinRows(W.state.masterByItem, '30-1906-01', {}).length === 0; })());
}

// ── L: the Add list, real code in jsdom ────────────────────────────────────
let JSDOM = null;
try { JSDOM = require('jsdom').JSDOM; } catch (e) {}
function addWorld(sugSrc, appSrc, wizSrc, cfgSrc) {
  const A = appSrc || APPJS, WZ = wizSrc || WIZ;
  const dom = new JSDOM('<!doctype html><html><body><input id="wiz-input"><div id="wiz-match"></div><div id="wiz-suggestions"></div></body></html>', { runScripts: 'outside-only', url: 'https://therailroster.com/app/' });
  const win = dom.window;
  win.console = { log() {}, warn() {}, error() {} };
  const brandVar = A.slice(A.indexOf('var _BRAND_LABELS'), A.indexOf('\n', A.indexOf('var _BRAND_LABELS')));
  const eraMap = BROWSE.slice(BROWSE.indexOf('var _ERA_KEY_TO_PERIOD'), BROWSE.indexOf('\n};', BROWSE.indexOf('var _ERA_KEY_TO_PERIOD')) + 3);
  win.eval([
    cfgSrc || CFG, TYPES, brandVar, eraMap, require('./lib/num-rule').numRuleSource(),
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
function addList(win, q, data, rows) {
  win.__set((rows || ROWS).map(r => Object.assign({}, r)), data);
  win.updateItemSuggestions(q);
  const el = win.document.getElementById('wiz-suggestions');
  const rs = Array.from(el.querySelectorAll('[data-idx]'));
  return {
    nums: rs.map(x => (x.querySelector('span') || {}).textContent),
    twins: Array.from(el.querySelectorAll('[data-zero-twin]')).map(x => x.textContent),
    nf: !!el.querySelector('[data-nothing-found]'), typed: !!el.querySelector('[data-typed-num]'),
  };
}
function listChecks(sugSrc, appSrc) {
  const W = addWorld(sugSrc || SUG, appSrc);
  const out = {};
  let L = addList(W, '30-1906-01'); out.L1 = L.nums.join() === '30-1906-1' && !L.nf; out.L1x = JSON.stringify(L);
  out.L2 = L.twins.length === 1 && /listed as 30-1906-1/i.test(L.twins[0]);
  L = addList(W, 'RK-2005LP'); out.L3 = L.nums.join() === '30-2005-1' && !L.nf && L.twins.length === 1; out.L3x = JSON.stringify(L);
  L = addList(W, 'RK-2005LP', { _searchFilterManufacturer: 'MTH' }); out.L4 = L.nums.join() === '30-2005-1'; out.L4x = JSON.stringify(L);
  L = addList(W, 'K652-13-01'); out.L5 = L.nums.indexOf('K652-13-1') < 0; out.L5x = JSON.stringify(L);
  L = addList(W, 'K2625-01'); out.L5 = out.L5 && L.nums.indexOf('K2625-1') < 0;
  L = addList(W, '30-1906-1'); out.L6 = L.nums.join() === '30-1906-1' && !L.twins.length;
  const ex = { itemNum: '30-1906-01', itemType: 'Boxcar', description: 'another maker car', roadName: '', manufacturer: 'Other Maker', _era: 'other_o', _tab: 'Other O Brands', rowId: 'OTH' };
  L = addList(W, '30-1906-01', {}, ROWS.concat([ex])); out.L7 = L.nums.join() === '30-1906-01' && !L.twins.length; out.L7x = JSON.stringify(L);
  W.__set(ROWS.map(r => Object.assign({}, r)), {});
  const p1 = W._wizResolveAddRow('30-1906-01', { raw: true }), p2 = W._wizResolveAddRow('RK-2005LP', { raw: true }), p3 = W._wizResolveAddRow('K652-13-01', { raw: true });
  out.L8 = !!p1 && p1.rowId === K4.rowId && !!p2 && p2.rowId === SD1.rowId && p3 === null;
  out.L9 = W._wizNumberInCatalog('30-1906-01') && W._wizNumberInCatalog('RK-2005LP') && !W._wizNumberInCatalog('K652-13-01') && !W._wizNumberInCatalog('RK-9999LP');
  return out;
}
if (!JSDOM) {
  ok('L0 the Add-list checks need jsdom (npm install --no-save jsdom) — a missing jsdom is a FAIL, never a skip', false);
} else {
  const l = listChecks();
  ok('L1 30-1906-01 typed → the 30-1906-1 row (Bob\'s K-4s; was: "No item found")', l.L1, l.L1x);
  ok('L2 … labelled "listed as 30-1906-1"', l.L2, l.L1x);
  ok('L3 RK-2005LP typed → the 30-2005-1 row (Bob\'s Conrail SD60), labelled', l.L3, l.L3x);
  ok('L4 … and with MTH picked as the maker', l.L4, l.L4x);
  ok('L5 K652-13-01 typed → K-Line\'s K652-13-1 is NOT offered (nor K2625-1 for K2625-01)', l.L5, l.L5x);
  ok('L6 30-1906-1 typed → that row, no twin label', l.L6);
  ok('L7 a catalog holding 30-1906-01 as written: that row only — the twin never joins an exact answer', l.L7, l.L7x);
  ok('L8 the one row picker (Next): 30-1906-01 → the K-4s row, RK-2005LP → the SD60 row, K652-13-01 → no pick', l.L8);
  ok('L9 _wizNumberInCatalog: 30-1906-01 and RK-2005LP count as in the catalog; K2625-01 and RK-9999LP do not', l.L9);
  // planted: rrNumLooseTwin no longer asks the old-spelling rule
  const noAsk = plant(APPJS, "  if (typeof rrNumOldSpellingTwin === 'function' && rrNumOldSpellingTwin(row, typed)) return true;   // oldnumbers", "  // (removed)   // oldnumbers", 'loose-ask');
  const b = listChecks(SUG, noAsk);
  mustCatch('L1 the Add list never asks the rule', l.L1, b.L1);
  mustCatch('L3 the Add list never asks the rule (RailKing)', l.L3, b.L3);
  mustCatch('L8 the row picker never asks the rule', l.L8, b.L8);
  // planted: the era list dropped → K-Line's K2625-1 offered for K2625-01
  const everyTab = plant(plant(APPJS, "return o.num.toLowerCase() === x && Array.isArray(E[o.rule]) && E[o.rule].indexOf(era) >= 0;", "return o.num.toLowerCase() === x;", 'every-catalog'), "  if (!listed) return false;\n", "", 'every-catalog-gate');
  mustCatch('L5 K-Line offered', l.L5, listChecks(SUG, everyTab).L5);
}

// ── S: scans ───────────────────────────────────────────────────────────────
const NUMFILES = ['app-data.js', 'wizard-suggestions.js', 'browse.js', 'wizard.js', 'tools.js'];
const defs = src => (src.match(/function rrNum(OtherSpellings|OldSpellingTwin)\(/g) || []).length;
const S1 = defs(APPJS) === 2 && NUMFILES.every(f => defs(read(f)) === 0);
ok('S1 the rule lives ONCE: rrNumOtherSpellings / rrNumOldSpellingTwin are defined only in app.js', S1);
mustCatch('S1 a second copy in the Add list', S1, (defs(APPJS) === 2 && [plant(SUG, 'function rrNumPlusLetter(', 'function rrNumOtherSpellings(n) { return []; }\nfunction rrNumPlusLetter(', 'copy')].every(s => defs(s) === 0)));
const rkCopies = src => (src.match(/RK-\?\(\\d\{4\}\)/g) || []).length;
const S2 = rkCopies(APPJS) === 1 && NUMFILES.every(f => rkCopies(read(f)) === 0);
ok('S2 no second RailKing pattern in the number-search files', S2);
mustCatch('S2 a home-made RailKing pattern', S2, (rkCopies(APPJS) === 1 && rkCopies(plant(BROWSE, 'if (_dQ && rrNumLooseTwin(item, _dQ)', 'if (/^RK-?(\\d{4})/.test(_zQ)) {} if (_dQ && rrNumLooseTwin(item, _dQ)', 'rk-copy')) === 0));
const S3 = /const RR_OLD_NUMBER_ERAS = \{\s*zeroEnding: \['mth_o', 'mth_ho', 'mth_s', 'mth_tinplate', 'mth_g'\],\s*railKing: \['mth_o'\],\s*\};/.test(CFG) && (CFG.match(/RR_OLD_NUMBER_ERAS = /g) || []).length === 2;
ok('S3 ONE list of catalogs, in the config file: the extra zero for the five MTH catalogs, RailKing for MTH O', S3);
ok('S4 the browse search and the Add list still ask through rrNumLooseTwin / rrNumMayHaveLooseTwin (so they take the rule without a copy)',
  BROWSE.indexOf('rrNumLooseTwin(item, _dQ)') >= 0 && /rrNumMayHaveLooseTwin\(_zQ\)/.test(BROWSE) && SUG.indexOf('rrNumLooseTwin(m, numPart)') >= 0);

// ── P: every planted offender was caught, and its check is green on the real code ──
planted.forEach(function (p) { ok('PLANTED caught: ' + p[0], p[1] && p[2], 'green on real: ' + p[1] + ', red on planted: ' + p[2]); });
ok('P0 ' + planted.length + ' planted offenders ran', planted.length >= 17, planted.length);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
