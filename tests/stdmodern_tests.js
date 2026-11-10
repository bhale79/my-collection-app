#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// stdmodern_tests.js — 2026-11-08, PLAN_2026-11-08_LIONEL_STANDARD_MODERN, Part C + C2.
//
// [stated] Brad 2026-11-08 (Master Catalog, Lionel + Standard + Modern -> "No
// items"): "there are many standard guage lionel modern trains, they have mth
// badge. see whats going on" -> "yes" to the plan -> "put a, b, and c together".
//
//   A  THE scale rule (app.js rrRowOwnLineScale / _rrLineRowScale, list in
//      config.js RR_LINE_ROW_SCALES): on a one-scale line a row whose OWN Gauge
//      names a scale the line may also carry reads as that scale only; every
//      other row — blank Gauge included — keeps the line's scale. The REAL
//      functions with the REAL config tables.
//   B  every scale question agrees: _scalesOfItem, _scaleOfItem, the Add
//      screen's Scale filter (_wizScaleOfRow), the lookup split (rrSplitByFilter)
//   C  the Scale pickers do NOT change for anyone (rrLineScales,
//      _getEnabledScales never read the new list)
//   D  C2 — the REAL findMaster, both layers (tests/lib/findmaster-real.js): a
//      saved Lionel modern copy whose own row is gone lands on the row "also
//      sold as" Lionel, never on MTH O's row of the same number; nothing changes
//      while the Lionel row exists
//   P  PLANTED offenders — each check above turns red on a copy without its rule
//
// The real-Chromium half (the Master Catalog chips) is stdmodern_browser_tests.js.
// Run:  node tests/stdmodern_tests.js
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const APP = path.join(__dirname, '..', 'app');
const rd = f => fs.readFileSync(path.join(APP, f), 'utf8');
const { buildFindMaster, grab } = require('./lib/findmaster-real');
let pass = 0, fail = 0;
function T(n, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + n + (ok ? '' : '  -> got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want)));
  ok ? pass++ : fail++;
}
function section(t) { console.log('\n== ' + t + ' =='); }

const SRC = { app: rd('app.js'), cfg: rd('config.js'), wiz: rd('wizard.js'), ob: rd('onboarding-config.js'), dat: rd('app-data.js') };

// A world: config.js + onboarding-config.js run for real, then the scale
// functions lifted out of app.js / wizard.js. `p` = planted sources.
function world(p) {
  p = Object.assign({}, SRC, p || {});
  const ctx = { console };
  ctx.window = ctx; ctx.addEventListener = () => {};
  ctx.navigator = { userAgent: '', platform: '' };
  ctx.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
  ctx.document = { addEventListener() {}, getElementById() { return null; }, querySelector() { return null; },
    createElement() { return { style: {} }; }, documentElement: { style: {} } };
  vm.createContext(ctx);
  try { vm.runInContext(p.cfg, ctx, { filename: 'config.js' }); } catch (e) { /* the tail wires DOM events — the tables are in */ }
  vm.runInContext(p.ob, ctx, { filename: 'onboarding-config.js' });
  const fns = ['_scaleOfEra', '_scalesOfGauge', 'rrLineRowScales', '_rrLineRowScale', 'rrRowOwnLineScale', 'rrRowEraScale', '_scalesOfItem', '_scaleOfItem', 'rrLineScales']
    .map(n => { try { return grab(p.app, n); } catch (e) { return ''; } }).join('\n');
  vm.runInContext('function _itemEraKey(it) { return String(it._era || it.era || "").toLowerCase(); }\n' + fns + '\n'
    + ['_wizScaleOfRow', '_wizPeriodOfYear', '_wizPeriodOfRow', 'rrReaderPreferFrom', 'rrRowFitsPrefer'].map(n => grab(p.wiz, n)).join('\n'), ctx);
  return ctx;
}
const run = (w, js) => vm.runInContext(js, w);
const R = (era, gauge, extra) => Object.assign({ itemNum: 'X', _era: era, gauge: gauge || '' }, extra || {});

function scaleChecks(w) {
  const all = r => { w.__r = r; return run(w, '_scalesOfItem(__r)'); };
  const one = r => { w.__r = r; return run(w, '_scaleOfItem(__r)'); };
  const wiz = r => { w.__r = r; return run(w, '_wizScaleOfRow(__r)'); };
  return {
    std13100: all(R('mpc', 'Standard', { itemNum: '13100' })),
    std13100one: one(R('mpc', 'Standard', { itemNum: '13100' })),
    blank: all(R('mpc', '')),
    blankOne: one(R('mpc', '')),
    standardO: all(R('mpc', 'Standard O')),   // 837 rows on the tab: an O spelling
    oGauge: all(R('mpc', 'O Gauge')),
    o27: all(R('mpc', 'O27')),
    g: all(R('mpc', 'G')),                    // 2 rows: a scale the line does not carry -> the line's
    gOne: one(R('mpc', 'G')),
    ho: all(R('mpc', 'HO')),
    stdAndO: all(R('mpc', 'Standard & O')),   // v0.9.1933: two gauges, one the tab's -> both (unchanged)
    stdAndOone: one(R('mpc', 'Standard & O')),   // …and its ONE answer stays the tab's (unchanged)
    tinO: all(R('mth_tinplate', 'O')),        // MTH Tinplate: Standard + O (ERA_SCALES_MULTI)
    tinOone: one(R('mth_tinplate', 'O')),
    tinStd: all(R('mth_tinplate', 'Standard')),
    tinTp: all(R('mth_tinplate', 'Std (Tinplate)')),
    tinBlank: all(R('mth_tinplate', '')),
    mthoStd: all(R('mth_o', 'Standard')),     // Brad 17:38 CT: MTH O's Standard gauge trains read Standard
    mthoStdO: all(R('mth_o', 'Standard O')),  // an O spelling: stays O
    mthoO: all(R('mth_o', 'O')),
    mthoBlank: all(R('mth_o', '')),
    pwStd: all(R('pw', 'Standard')),
    prewarO: all(R('prewar', 'O')),           // a mixed line reads its rows as before
    prewarBlank: all(R('prewar', '')),
    wizStd: wiz(R('mpc', 'Standard')),
    wizBlank: wiz(R('mpc', '')),
    wizTinO: wiz(R('mth_tinplate', 'O')),
    wizPrewarO: wiz(R('prewar', 'O')),        // unchanged on purpose (ERA_SCALE says Standard; see DEPLOY note)
  };
}

section('A/B · the rule, and every scale question agrees');
const W = world();
const S = scaleChecks(W);
T('A1 Lionel modern 13100, own Gauge "Standard" -> Standard only', S.std13100, ['standard']);
T('A1 …its ONE scale is Standard too (dashboard, search brand)', S.std13100one, 'standard');
T('A2 a blank-Gauge Lionel modern row stays O (20,000+ rows)', [S.blank, S.blankOne], [['o'], 'o']);
T('A3 "Standard O", "O Gauge", "O27" stay O', [S.standardO, S.oGauge, S.o27], [['o'], ['o'], ['o']]);
T('A4 a scale the line does not carry (G, HO) keeps the line\'s O', [S.g, S.gOne, S.ho], [['o'], 'o', ['o']]);
T('A5 "Standard & O" still carries both (v0.9.1933 unchanged)', S.stdAndO, ['standard', 'o']);
T('A5 …its ONE answer is still the tab\'s O (unchanged)', S.stdAndOone, 'o');
T('A6 MTH Tinplate row whose own Gauge says O -> O (its line carries O)', [S.tinO, S.tinOone], [['o'], 'o']);
T('A7 MTH Tinplate Standard / "Std (Tinplate)" / blank -> Standard, as before', [S.tinStd, S.tinTp, S.tinBlank], [['standard'], ['standard'], ['standard']]);
T('A8 a line with no extra list keeps its scale (Postwar marked Standard)', S.pwStd, ['o']);
T('A10 MTH O row whose own Gauge says "Standard" -> Standard only (Brad 17:38 CT)', S.mthoStd, ['standard']);
T('A10 …MTH O "Standard O", "O" and blank stay O (32,000+ rows)', [S.mthoStdO, S.mthoO, S.mthoBlank], [['o'], ['o'], ['o']]);
T('A9 a mixed line (Pre-War) reads its own Gauge, as before', [S.prewarO, S.prewarBlank], [['o'], []]);
T('B1 Add screen Scale filter: 13100 is "Standard", a blank row "O"', [S.wizStd, S.wizBlank], ['Standard', 'O']);
T('B2 Add screen: an O-gauge MTH Tinplate row is "O"', S.wizTinO, 'O');
T('B3 Add screen: Pre-War untouched ("Standard", as ERA_SCALE says)', S.wizPrewarO, 'Standard');

// rrSplitByFilter — the photo / typed lookup's scale split (demotes, never hides)
function split(w, scale, rows) {
  w.__rows = rows; w.__scale = scale;
  run(w, 'rrActiveFilter = function () { return { era: "", eras: [], label: "", manufacturer: "Lionel", scale: __scale, period: "modern" }; };');
  const o = run(w, 'rrSplitByFilter(__rows)');
  return { inEra: o.inEra.map(r => r.itemNum), offEra: o.offEra.map(r => r.itemNum) };
}
const SPLIT_ROWS = () => [R('mpc', 'Standard', { itemNum: '13100', yearProd: '1988' }), R('mpc', '', { itemNum: '18000', yearProd: '1990' })];
const spStd = split(W, 'Standard', SPLIT_ROWS()), spO = split(W, 'O', SPLIT_ROWS());
T('B4 lookup split under Standard: 13100 in, the blank O row demoted', spStd, { inEra: ['13100'], offEra: ['18000'] });
T('B4 lookup split under O: 13100 demoted, the blank O row in', spO, { inEra: ['18000'], offEra: ['13100'] });

// the photo reader / barcode / Research with the Add screen's filters: rrReaderPreferFrom -> rrRowFitsPrefer
function reader(w, f, rows) {
  w.__f = f; w.__rows = rows;
  return run(w, '(function () { var p = rrReaderPreferFrom(__f); return { era: p.era, eras: p.eras.slice().sort(), fits: __rows.filter(function (r) { return rrRowFitsPrefer(r, p); }).map(function (r) { return r.itemNum; }) }; })()');
}
const RROWS = () => [R('mpc', 'Standard', { itemNum: '13100', yearProd: '1988' }), R('mpc', '', { itemNum: '18000', yearProd: '1989' }),
  R('prewar', 'Standard', { itemNum: '390E', yearProd: '1929' }), R('mth_tinplate', 'O', { itemNum: '11-2815', yearProd: '2004' })];
const rdStdMod = reader(W, { manufacturer: 'Lionel', scale: 'Standard', period: 'modern' }, RROWS());
const rdStd = reader(W, { manufacturer: 'Lionel', scale: 'Standard' }, RROWS());
const rdO = reader(W, { manufacturer: 'Lionel', scale: 'O' }, RROWS());
const rdMthO = reader(W, { manufacturer: 'MTH', scale: 'O' }, RROWS());
T('B5 reader, Lionel + Standard + Modern: 13100 fits, the blank O row does not', rdStdMod.fits, ['13100']);
T('B5 …Lionel modern is searched, but the ONE era stays Pre-War, as before', [rdStdMod.eras.indexOf('mpc') >= 0, rdStdMod.era], [true, 'prewar']);
T('B5 reader, Lionel + Standard (any era): 13100 and the 390E', rdStd.fits, ['13100', '390E']);
T('B5 reader, Lionel + O: the blank row, not 13100', rdO.fits, ['18000']);
T('B5 reader, MTH + O: the O-gauge MTH Tinplate row fits', rdMthO.fits, ['11-2815']);

section('C · the Scale pickers do not change for anyone');
const lineScales = e => { W.__e = e; return run(W, 'rrLineScales(__e)'); };
T('C1 What I Collect: Lionel MPC-Modern is O only', lineScales('mpc'), ['o']);
T('C1 …MTH Tinplate still O and Standard, Pre-War still O and Standard', [lineScales('mth_tinplate').sort(), lineScales('prewar').sort()], [['o', 'standard'], ['o', 'standard']]);
const readers = fs.readdirSync(APP).filter(f => /\.js$/.test(f) && f !== 'config.js' && /RR_LINE_ROW_SCALES/.test(rd(f)));
T('C2 RR_LINE_ROW_SCALES is read in ONE place (app.js rrLineRowScales)', readers, ['app.js']);
{ const body = grab(SRC.app, 'rrLineRowScales');
  const codeLines = SRC.app.split('\n').filter(l => /RR_LINE_ROW_SCALES/.test(l) && !/^\s*\/\//.test(l));
  T('C2 …and only by rrLineRowScales (every code line that names it is inside it)', codeLines.length > 0 && codeLines.every(l => body.indexOf(l) >= 0), true); }
T('C3 rrLineScales / _getEnabledScales never ask the row rule', /rrRowOwnLineScale|_rrLineRowScale|RR_LINE_ROW_SCALES/.test(grab(SRC.app, 'rrLineScales') + grab(SRC.app, '_getEnabledScales')), false);
T('C4 the config list: Lionel modern and MTH O may also carry Standard', run(W, 'JSON.stringify(RR_LINE_ROW_SCALES)'), '{"mpc":["Standard"],"mth_o":["Standard"]}');
{ W.__e = 'mth_o'; T('C1 …MTH O is still O only in the pickers', run(W, 'rrLineScales(__e)'), ['o']); }

section('D · C2 — the REAL findMaster: a saved Lionel copy whose row is gone');
const ERAS = { other_o: { manufacturer: 'Other O' }, mpc: { manufacturer: 'Lionel' }, pw: { manufacturer: 'Lionel' }, mth_o: { manufacturer: 'MTH' }, mth_tinplate: { manufacturer: 'MTH' } };
const ERA_TABS = { mpc: { items: 'Lionel MPC-Modern', catalogs: 'Lionel MPC-Modern - Catalogs' }, pw: { items: 'Lionel PW - Items' }, mth_o: { items: 'MTH O' }, mth_tinplate: { items: 'MTH Tinplate' } };
const tin = { itemNum: '11-1005', variation: '', _era: 'mth_tinplate', _tab: 'MTH Tinplate', itemType: 'Steam Locomotive', alsoSoldAs: 'Lionel Corporation', rowId: 'TTTTTTTTTT', yearProd: '2004', gauge: 'Standard' };
const tinV = Object.assign({}, tin, { variation: '1', rowId: 'TTTTTTTTT1' });
const mo = { itemNum: '11-1005', variation: '', _era: 'mth_o', _tab: 'MTH O', itemType: 'Boxcar', rowId: 'OOOOOOOOOO', yearProd: '2006', gauge: 'O' };
const lio = { itemNum: '11-1005', variation: '', _era: 'mpc', _tab: 'Lionel MPC-Modern', itemType: 'Steam Locomotive', rowId: 'LLLLLLLLLL', yearProd: '' };
const cat = { itemNum: '11-1005', variation: '', _era: 'mpc', _tab: 'Lionel MPC-Modern - Catalogs', itemType: 'Catalog', rowId: 'CCCCCCCCCC', yearProd: '' };
// one of the 58: the number exists on MTH O only, and MTH O's row carries the column (Part A covers MTH O)
const mo58 = { itemNum: '11-2001', variation: '', _era: 'mth_o', _tab: 'MTH O', itemType: 'Boxcar', alsoSoldAs: 'Lionel Corporation', rowId: 'O58O58O58O', yearProd: '2005', gauge: 'O' };
const atl58 = { itemNum: '11-2001', variation: '', _era: 'mth_tinplate', _tab: 'MTH Tinplate', itemType: 'Accessory', rowId: 'NOTSOLDAS1', yearProd: '2005' };
const oth = { itemNum: '11-3001', variation: '', _era: 'other_o', _tab: 'Other O Brands', itemType: 'Boxcar', alsoSoldAs: 'Lionel Corporation', yearProd: '' };
const othY = Object.assign({}, oth, { yearProd: '2001' });
const PD = { itemNum: '11-1005', variation: '', era: 'mpc', manufacturer: 'Lionel', masterKey: 'mpc|11-1005|', masterRowId: 'LLLLLLLLLL' };
const pdEraOnly = { itemNum: '11-1005', variation: '', era: 'mpc', manufacturer: 'Lionel' };
const pdKeyOnly = { itemNum: '11-1005', variation: '', era: '', masterKey: 'mpc|11-1005|' };
const pdVarA = { itemNum: '11-1005', variation: 'A', era: 'mpc', manufacturer: 'Lionel', masterKey: 'mpc|11-1005|A' };
function c2(dat) {
  const fm = (l1, l2) => buildFindMaster({ layer1: l1, layer2: l2 || null, eras: ERAS, eraTabs: ERA_TABS, dat });
  const e = r => (r ? r._era + (r._tab === cat._tab ? ':catalogs' : '') : null);
  const F = fm([mo, tin]);
  return {
    gone: e(F.findMaster('11-1005', '', PD)),
    goneL2: e(fm([mo], [mo, tin]).findMaster('11-1005', '', PD)),
    goneL2only: e(fm([], [mo, tin]).findMaster('11-1005', '', PD)),
    eraOnly: e(F.findMaster('11-1005', '', pdEraOnly)),
    keyOnly: e(F.findMaster('11-1005', '', pdKeyOnly)),
    varA: e(fm([mo, tinV]).findMaster('11-1005', 'A', pdVarA)),
    kept: e(fm([mo, tin, lio]).findMaster('11-1005', '', PD)),
    keptEraOnly: e(fm([mo, tin, lio]).findMaster('11-1005', '', pdEraOnly)),
    keptCatalog: e(fm([mo, tin, cat]).findMaster('11-1005', '', pdEraOnly)),
    mthO: e(F.findMaster('11-1005', '', { itemNum: '11-1005', era: 'mth_o', manufacturer: 'MTH' })),
    mthTin: e(F.findMaster('11-1005', '', { itemNum: '11-1005', era: 'mth_tinplate', manufacturer: 'MTH' })),
    bare: e(F.findMaster('11-1005', '', null)),
    the58: e(fm([atl58, mo58]).findMaster('11-2001', '', { itemNum: '11-2001', era: 'mpc', manufacturer: 'Lionel', masterKey: 'mpc|11-2001|' })),
    noColumn: e(fm([mo, Object.assign({}, tin, { alsoSoldAs: '' })]).findMaster('11-1005', '', PD)),
    soldAs: F.soldAsEra ? [F.soldAsEra(tin, 'mpc'), F.soldAsEra(tin, 'pw'), F.soldAsEra(tin, 'mth_o'), F.soldAsEra(mo, 'mpc'), F.soldAsEra(lio, 'mpc')] : null,
    // the "6-" line prefix (and suffix) path of _findMasterCore scores its own candidates
    prefixed: e(F.findMaster('6-11-1005', '', PD)),
    // an era with no period of its own (Other O Brands) and no year: never a guessed "modern"
    noPeriod: F.soldAsEra ? [F.soldAsEra(oth, 'mpc'), F.soldAsEra(othY, 'mpc')] : null,
  };
}
const D = c2(SRC.dat);
T('D1 its row gone, both loaded -> the MTH Tinplate row sold as Lionel (not MTH O, which loads first)', D.gone, 'mth_tinplate');
T('D2 …MTH Tinplate only in the whole-catalog layer -> still the row sold as Lionel', D.goneL2, 'mth_tinplate');
T('D2 …nothing loaded, whole-catalog layer only -> the row sold as Lionel', D.goneL2only, 'mth_tinplate');
T('D3 a copy that names Lionel modern by its era alone -> the row sold as Lionel', D.eraOnly, 'mth_tinplate');
T('D3 …by its Master Key alone -> the row sold as Lionel', D.keyOnly, 'mth_tinplate');
T('D3 …a copy with a variation the MTH rows do not have (A) -> the row sold as Lionel', D.varA, 'mth_tinplate');
T('D4 the saved Lionel row still exists -> that row (Row ID), unchanged', D.kept, 'mpc');
T('D4 …era-only copy, Lionel row exists -> the Lionel row, unchanged', D.keptEraOnly, 'mpc');
T('D4 …any row of the named catalog under that number still answers first', D.keptCatalog, 'mpc:catalogs');
T('D5 a copy that names MTH O / MTH Tinplate -> its own catalog, unchanged', [D.mthO, D.mthTin], ['mth_o', 'mth_tinplate']);
T('D5 a number-only lookup (no copy) -> load order, unchanged', D.bare, 'mth_o');
T('D6 one of the 58 (on MTH O only, its row sold as Lionel) -> that MTH O row, not the other maker\'s', D.the58, 'mth_o');
T('D7 before the master column exists nothing moves (load order, as today)', D.noColumn, 'mth_o');
T('D9 a "6-" prefixed lookup of the gone copy -> the row sold as Lionel (the prefix path scores too)', D.prefixed, 'mth_tinplate');
T('D10 a year-less row on an era with no period (Other O) never matches; with a year it does', D.noPeriod, [false, true]);
T('D8 the rule: Lionel modern yes; Lionel Postwar (another period), MTH, a non-sold row, the Lionel row itself no', D.soldAs, [true, false, false, false, false]);

section('E · findMaster\'s scale hint reads the same row rule');
const SCALE_TABLES = JSON.parse(run(W, 'JSON.stringify({ ERA_SCALE: ERA_SCALE, ERA_TO_SCALE: WHAT_I_COLLECT.ERA_TO_SCALE, ERA_SCALES_MULTI: ERA_SCALES_MULTI, RR_LINE_ROW_SCALES: RR_LINE_ROW_SCALES, CHIP_LABEL: _RR_CHIP_SCALE_LABEL })'));
function hint(dat, app) {
  const ETS = Object.assign({ atlas: { items: 'Atlas O' }, atlas_ho: { items: 'Atlas HO' } }, ERA_TABS);
  const fm = l1 => buildFindMaster({ layer1: l1, eras: ERAS, eraTabs: ETS, dat, app, scale: SCALE_TABLES });
  const at = { itemNum: '13100', variation: '', _era: 'atlas', _tab: 'Atlas O', itemType: 'Boxcar', yearProd: '2001' };
  const l13 = { itemNum: '13100', variation: '', _era: 'mpc', _tab: 'Lionel MPC-Modern', itemType: 'Steam Locomotive', yearProd: '1988', gauge: 'Standard' };
  const ho = { itemNum: '11-2815', variation: '', _era: 'atlas_ho', _tab: 'Atlas HO', itemType: 'Tank Car', yearProd: '2004' };
  const tO = { itemNum: '11-2815', variation: '', _era: 'mth_tinplate', _tab: 'MTH Tinplate', itemType: 'Tank Car', yearProd: '2004', gauge: 'O' };
  return {
    std: (fm([at, l13]).findMaster('13100', '', { scale: 'Standard' }) || {})._era,
    o: (fm([at, l13]).findMaster('13100', '', { scale: 'O' }) || {})._era,
    tinO: (fm([ho, tO]).findMaster('11-2815', '', { scale: 'O' }) || {})._era,
  };
}
const H = hint(SRC.dat, SRC.app);
T('E1 a Standard-scale lookup of 13100 -> Lionel\'s Standard 13100, not Atlas O\'s (loaded first)', H.std, 'mpc');
T('E1 …an O-scale lookup -> Atlas O\'s, as before', H.o, 'atlas');
T('E2 an O-scale lookup of 11-2815 -> the O-gauge MTH Tinplate row, not the HO one (loaded first)', H.tinO, 'mth_tinplate');

section('P · PLANTED offenders — each must turn its check red');
function plant(file, from, to, label) {
  const o = SRC[file], p = o.split(from).join(to);
  T('P plant applied: ' + label, p !== o, true);
  return p;
}
// scale rule
const pA1 = plant('app', '    return _own ? [_own] : [eraScale];', '    return [eraScale];', '_scalesOfItem without the row\'s own scale');
T('P-A1 caught: 13100 reads O again', scaleChecks(world({ app: pA1 })).std13100, ['o']);
const pA2 = plant('app', "  if (eraScale) return ((typeof _rrLineRowScale === 'function') ? _rrLineRowScale(era, eraScale, _scalesOfGauge(item.gauge, era)) : '') || eraScale;", '  if (eraScale) return eraScale;', '_scaleOfItem without it');
T('P-A2 caught: 13100\'s one scale is O again', scaleChecks(world({ app: pA2 })).std13100one, 'o');
const pA3 = plant('cfg', "const RR_LINE_ROW_SCALES = { mpc: ['Standard'], mth_o: ['Standard'] };", 'const RR_LINE_ROW_SCALES = {};', 'the config list emptied');
T('P-A3 caught: with no list, 13100 reads O', scaleChecks(world({ cfg: pA3 })).std13100, ['o']);
const pA12 = plant('cfg', "const RR_LINE_ROW_SCALES = { mpc: ['Standard'], mth_o: ['Standard'] };", "const RR_LINE_ROW_SCALES = { mpc: ['Standard'] };", 'MTH O left off the list');
T('P-A12 caught: MTH O\'s Standard gauge row reads O', scaleChecks(world({ cfg: pA12 })).mthoStd, ['o']);
const pA4 = plant('app', "  return rrLineRowScales(era).indexOf(gs[0]) >= 0 ? gs[0] : '';", '  return gs[0];', 'ANY own Gauge wins (no list check)');
const SA4 = scaleChecks(world({ app: pA4 }));
T('P-A4 caught: a Lionel modern row marked G / HO leaves O', [SA4.g, SA4.ho], [['g'], ['ho']]);
T('P-A4 caught: a Postwar row marked Standard leaves O', SA4.pwStd, ['standard']);
const pA5 = plant('cfg', "const ERA_SCALES_MULTI = { prewar: ['O', 'Standard'], mth_tinplate: ['O', 'Standard'],", "const ERA_SCALES_MULTI = { prewar: ['O', 'Standard'], mth_tinplate: ['O', 'Standard'], mpc: ['O', 'Standard'],", 'Lionel modern put under Standard in the pickers instead');
{ const w5 = world({ cfg: pA5 }); w5.__e = 'mpc'; T('P-A5 caught: the picker would offer Standard for Lionel modern', run(w5, 'rrLineScales(__e)').indexOf('standard') >= 0, true); }
const pA6 = plant('wiz', "    if (typeof rrRowEraScale === 'function') return rrRowEraScale(m) || '';\n", '', 'the Add screen without the rule');
T('P-A6 caught: the Add screen calls 13100 "O"', scaleChecks(world({ wiz: pA6 })).wizStd, 'O');
const pA7 = plant('cfg', "    var _own = (sc && f.scale && typeof rrRowOwnLineScale === 'function') ? rrRowOwnLineScale(r) : '';", "    var _own = '';", 'the lookup split without the rule');
T('P-A7 caught: under Standard the 13100 is demoted', split(world({ cfg: pA7 }), 'Standard', SPLIT_ROWS()).offEra.indexOf('13100') >= 0, true);
const pA8 = plant('app', "  if (!lineScale || !gs || gs.length !== 1 || gs[0] === lineScale) return '';", "  if (!lineScale || !gs || !gs.length || gs[0] === lineScale) return '';", 'a two-gauge cell let through');
T('P-A8 caught: a "Standard & O" row\'s one answer turns Standard', scaleChecks(world({ app: pA8 })).stdAndOone, 'standard');
const pA9 = plant('wiz', "          if (rs.indexOf(scale.toLowerCase()) >= 0) { eras.push(k); if (!maker) maker = e.manufacturer || ''; }\n", '', 'the reader without the row-scale lines');
T('P-A9 caught: the reader under Lionel + Standard + Modern rejects 13100', reader(world({ wiz: pA9 }), { manufacturer: 'Lionel', scale: 'Standard', period: 'modern' }, RROWS()).fits, []);
const pA10 = plant('wiz', "  return { era: lineEras.length === 1 ? lineEras[0] : '', eras: eras,", "  return { era: eras.length === 1 ? eras[0] : '', eras: eras,", 'the reader\'s ONE era counted from every catalog searched');
T('P-A10 caught: Lionel + Standard loses its ONE era (Pre-War)', reader(world({ wiz: pA10 }), { manufacturer: 'Lionel', scale: 'Standard', period: 'modern' }, RROWS()).era, '');
const pA11 = plant('dat', "(typeof rrRowEraScale === 'function') ? rrRowEraScale(m) : ", '', 'findMaster\'s scale hint reading ERA_SCALE alone');
const HP = hint(pA11, SRC.app);
T('P-A11 caught: Standard-scale 13100 lands on Atlas O, O-scale 11-2815 on the HO row', [HP.std, HP.tinO], ['atlas', 'atlas_ho']);
// C2
const pB1 = plant('dat', "    if (_soldAsLive && _rrRowSoldAsEra(m, _prefSoldEra)) b += 6;   // stdmodern C2\n", '', '_findMasterCore without the "also sold as" weight');
const DB1 = c2(pB1);
T('P-B1 caught: the copy lands on MTH O', [DB1.gone, DB1.eraOnly, DB1.keyOnly], ['mth_o', 'mth_o', 'mth_o']);
const pB2 = plant('dat', "    if (_r2 && typeof _rrRowSoldAsEra === 'function' && !_rrRowSoldAsEra(_r, _want) && _rrRowSoldAsEra(_r2, _want)) return _r2;\n", '', 'findMaster without the whole-catalog fallback');
T('P-B2 caught: MTH O (loaded) wins over the whole-catalog row sold as Lionel', c2(pB2).goneL2, 'mth_o');
const pB3 = plant('dat', "\n      && !list.some(r => r && String(r._era || '') === _prefSoldEra);", ';', 'the weight armed even while the catalog has its own row');
T('P-B3 caught: the Lionel catalog\'s own row loses to the MTH row', c2(pB3).keptCatalog, 'mth_tinplate');
const pB4 = plant('dat', "    if (!a || !b || a !== b) return false;                    // an unknown period never matches\n", '', 'no same-period check');
T('P-B4 caught: a Lionel Postwar copy would count the modern MTH row', (c2(pB4).soldAs || [])[1], true);
const pB6 = plant('dat', "    if (!a || !b || a !== b) return false;                    // an unknown period never matches", "    if (a && b && a !== b) return false;", 'an unknown period let through');
T('P-B6 caught: a year-less Other O row counts as Lionel modern', (c2(pB6).noPeriod || [])[0], true);
const pB7 = plant('dat', "  _armSoldAs(cands);   // stdmodern C2\n", '', 'the prefix / suffix path not armed');
T('P-B7 caught: the "6-" prefixed lookup lands on MTH O', c2(pB7).prefixed, 'mth_o');
const pB5 = plant('dat', "  if (!mk || typeof rrRowAlsoSoldBy !== 'function' || !rrRowAlsoSoldBy(row, mk)) return false;", '  if (!mk) return false;', 'any maker\'s row counts');
T('P-B5 caught: MTH O\'s plain row would count as Lionel', (c2(pB5).soldAs || [])[3], true);

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  stdmodern_tests: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
