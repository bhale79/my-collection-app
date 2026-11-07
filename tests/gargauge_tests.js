#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════
// GARGRAVES GAUGES — the app reads two-gauge spellings and "All Gauges"
// (gargauge, 2026-11-06). [stated] Brad 13:19 CT: "The GarGraves catalog has
// two data gaps … 132 rows have no Gauge, so they only show under 'Any Scale'.
// 3 rows use two-gauge spellings the app doesn't read. fix this" → 13:22 CT
// "yes" to the plan (gauges written to the master + this reader change).
//
//   R  the ONE gauge reader (_scalesOfGauge, app.js), run for real:
//      "O & S" / "G & S" / "G & O" carry BOTH gauges, as "Standard & O" does;
//      "All Gauges" on GarGraves = the six scales it sells (ERA_SCALES_MULTI);
//      "All Gauges" with no era or on a one-scale tab stays unknown;
//      every OTHER spelling on the live master answers exactly as before
//      (fixture: 55 spellings read from every tab, 2026-11-06)
//   I  a GarGraves row through _scalesOfItem / _scaleOfItem (the Master
//      Catalog's scale chip and the one-answer helper)
//   W  the Add screen's Scale filter (_wizRowFitsFilters, wizard.js)
//   A  the master audit (tools/master-audit/audit.js) no longer calls these
//      spellings unknown on GarGraves, and still does where they mean nothing
//   P  each check FAILS on a planted copy with its piece of the change removed
// Run:  node tests/gargauge_tests.js
// ═════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const APP = path.join(__dirname, '..', 'app');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0, fail = 0;
function ok(n, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(extra === undefined ? '' : extra).slice(0, 400))); cond ? pass++ : fail++; }
function grab(src, head) {
  const i = src.indexOf('function ' + head + '(');
  if (i < 0) throw new Error('missing function ' + head);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); }
  }
  throw new Error('unbalanced ' + head);
}
function plant(src, from, to, label) {
  if (src.indexOf(from) < 0) throw new Error('planted offender "' + label + '" no longer matches the source — update the test');
  return src.replace(from, to);
}
const CFG = read('config.js'), AJ = read('app.js'), WZ = read('wizard.js');
const AUDIT_PATH = path.join(__dirname, '..', 'tools', 'master-audit', 'audit.js');
const MULTI = (() => { const i = CFG.indexOf('const ERA_SCALES_MULTI = '); return CFG.slice(i, CFG.indexOf('};', i) + 2); })();
const ERA_SCALE_SRC = (() => { const i = CFG.indexOf('const ERA_SCALE = {'); return CFG.slice(i, CFG.indexOf('\n};', i) + 3); })();
const FX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'gargauge_live_gauges_2026-11-06.json'), 'utf8'));
const SIX = ['o', 's', 'g', 'ho', 'n', 'standard'];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sameSet = (a, b) => a.length === b.length && a.every(x => b.indexOf(x) >= 0);

// The reader + the item helpers, built from a given app.js source
function helpers(ajSrc) {
  return new Function(MULTI + '\n' + ERA_SCALE_SRC + '\n' +
    // ERA_TO_SCALE as onboarding-config.js has it for these two tabs (checked in I5)
    'var WHAT_I_COLLECT = { ERA_TO_SCALE: { atlas: "o", gargraves: null } };\n' +
    'function _itemEraKey(item) { return item && item._era ? String(item._era).toLowerCase() : null; }\n' +
    grab(ajSrc, '_scaleOfEra') + '\n' + grab(ajSrc, '_scalesOfGauge') + '\n' + grab(ajSrc, '_scalesOfItem') + '\n' + grab(ajSrc, '_scaleOfItem') + '\n' +
    'return { _scalesOfGauge: _scalesOfGauge, _scalesOfItem: _scalesOfItem, _scaleOfItem: _scaleOfItem };')();
}
const H = helpers(AJ);

// ── R: the reader ────────────────────────────────────────────────────────
function rChecks(h) {
  const g = h._scalesOfGauge;
  return {
    R1: sameSet(g('O & S'), ['o', 's']) && sameSet(g('G & S'), ['g', 's']) && sameSet(g('G & O'), ['g', 'o']),
    R2: sameSet(g('o and s'), ['o', 's']) && sameSet(g('G + O'), ['g', 'o']) && sameSet(g('O Gauge & S Gauge'), ['o', 's']),
    R3: same(g('Standard & O'), ['standard', 'o']) && same(g('N/HO'), ['n', 'ho']) && same(g('Standard/O Gauge'), ['standard']) && same(g('G/One Gauge'), ['g']),
    R4: sameSet(g('All Gauges', 'gargraves'), SIX) && sameSet(g('all', 'GarGraves'), SIX) && sameSet(g('All Gauges', 'prewar'), ['o', 'standard']),
    R5: same(g('All Gauges'), []) && same(g('All Gauges', 'atlas'), []) && same(g('Suitable For Any Scale', 'gargraves'), []),
    R7: same(g('HO & Other Scales'), []) && same(g('S & other'), []) && sameSet(g('O Scale & S'), ['o', 's']) && sameSet(g('O-27 & Standard'), ['o', 'standard']),
    R6: Object.keys(FX.values).filter(v => !same(g(v), FX.values[v].expect)),
  };
}
{
  const r = rChecks(H);
  ok('R1  "O & S", "G & S" and "G & O" carry BOTH gauges (they read as O only / nothing before)', r.R1, JSON.stringify([H._scalesOfGauge('O & S'), H._scalesOfGauge('G & S'), H._scalesOfGauge('G & O')]));
  ok('R2  the same with "and" / "+" and with each gauge spelled out', r.R2);
  ok('R3  the spellings that already had a rule answer as before ("Standard & O", "N/HO", "Standard/O Gauge", "G/One Gauge")', r.R3);
  ok('R4  "All Gauges" on GarGraves = the six scales it sells; on Pre-War = O and Standard (the tab\'s own list)', r.R4, JSON.stringify(H._scalesOfGauge('All Gauges', 'gargraves')));
  ok('R5  "All Gauges" with no tab, or on a one-scale tab, stays unknown; Bachmann\'s "Suitable For Any Scale" is untouched', r.R5);
  ok('R7  a joined part is read only when it IS a gauge — "HO & Other Scales" is NOT read as HO + O (the starts-with-O rule stays out of joins)', r.R7, JSON.stringify(H._scalesOfGauge('HO & Other Scales')));
  ok('R6  all ' + Object.keys(FX.values).length + ' gauge spellings on the live master answer exactly as frozen (no other maker\'s rows move)', r.R6.length === 0, r.R6.join(' | '));
}

// ── I: a GarGraves row through the item helpers ──────────────────────────
function iChecks(h) {
  const row = (gauge) => ({ _era: 'gargraves', gauge: gauge, itemNum: 'x' });
  return {
    I1: sameSet(h._scalesOfItem(row('All Gauges')), SIX),
    I2: sameSet(h._scalesOfItem(row('O & S')), ['o', 's']) && same(h._scalesOfItem(row('O Gauge')), ['o']),
    I3: h._scaleOfItem(row('All Gauges')) === null && h._scaleOfItem(row('S Gauge')) === 's',
    I4: same(h._scalesOfItem({ _era: 'atlas', gauge: 'All Gauges' }), ['o']),
  };
}
{
  const r = iChecks(H);
  ok('I1  a GarGraves row with "All Gauges" shows under every one of the six scale chips (_scalesOfItem)', r.I1, JSON.stringify(H._scalesOfItem({ _era: 'gargraves', gauge: 'All Gauges' })));
  ok('I2  a GarGraves "O & S" row shows under O and S; an "O Gauge" row under O only', r.I2);
  ok('I3  _scaleOfItem (ONE answer) stays null for "All Gauges", as for any several-scale row; "S Gauge" is s', r.I3);
  ok('I4  a one-scale tab keeps its own scale whatever its Gauge cell says (Atlas O stays O)', r.I4);
  const OBC = read('onboarding-config.js');
  ok('I5  onboarding-config.js still gives GarGraves NO single scale (the row\'s gauge decides) and Atlas O its "o" — what I1–I4 assume',
     /\n\s*gargraves:\s*null,/.test(OBC) && /\n\s*atlas:\s*'o',/.test(OBC));
}

// ── W: the Add screen's Scale filter ─────────────────────────────────────
function wFits(wzSrc, h, row, scale) {
  const fn = new Function('_scalesOfGauge', ERA_SCALE_SRC + '\n' +
    'function _wizAddFilters() { return {}; }\nfunction _wizPeriodOfRow() { return ""; }\nfunction _wizScaleOfRow() { return ""; }\n' +
    grab(wzSrc, '_wizRowFitsFilters') + '\nreturn _wizRowFitsFilters;')(h._scalesOfGauge);
  return fn(row, { scale: scale });
}
function wChecks(wzSrc, h) {
  const r = (g) => ({ _era: 'gargraves', gauge: g, itemNum: '803' });
  return {
    W1: wFits(wzSrc, h, r('All Gauges'), 'S') && wFits(wzSrc, h, r('All Gauges'), 'HO') && wFits(wzSrc, h, r('All Gauges'), 'O'),
    W2: wFits(wzSrc, h, r('O & S'), 'S') && wFits(wzSrc, h, r('G & O'), 'G') && !wFits(wzSrc, h, r('G & O'), 'S'),
    W3: !wFits(wzSrc, h, r(''), 'O'),
  };
}
{
  const r = wChecks(WZ, H);
  ok('W1  Add → Scale S / HO / O all find a GarGraves "All Gauges" row (track pins, screws…)', r.W1);
  ok('W2  Add → Scale finds "O & S" under S and "G & O" under G, never "G & O" under S', r.W2);
  ok('W3  a GarGraves row with NO gauge still fails a Scale pick (blank means unknown, not all)', r.W3);
}

// ── A: the master audit ──────────────────────────────────────────────────
function aChecks(auditMod) {
  const A = auditMod.loadApp();
  const rule = auditMod.RULES.find(x => x.id === 'gauge-unknown');
  const t = (g, era) => rule.test({ gauge: g }, { A: A, era: era });
  return {
    A1: t('All Gauges', 'gargraves') === '' && t('G & S', 'gargraves') === '' && t('G & O', 'gargraves') === '' && t('O & S', 'gargraves') === '',
    A2: t('All Gauges', 'atlas') !== '' && t('Toy', 'marx') !== '',
  };
}
{
  delete require.cache[require.resolve(AUDIT_PATH)];
  const r = aChecks(require(AUDIT_PATH));
  ok('A1  the master audit reads "All Gauges", "G & S", "G & O" and "O & S" on GarGraves (no gauge-unknown flag)', r.A1);
  ok('A2  …and still flags "All Gauges" where it means nothing (a one-scale tab), and its old unknowns ("Toy")', r.A2);
}

// ── P: planted offenders — each piece removed must turn its checks red ──
{
  const noJoin = helpers(plant(AJ, "  if (_joined && _joined.length > 1) {", "  if (false) {", 'the joiner block'));
  const rj = rChecks(noJoin);
  ok('P1  PLANTED: without the "&"-joiner block, R1 and R2 fail', !rj.R1 && !rj.R2);
  const noAll = helpers(plant(AJ, "  if (g === 'all' || g === 'all gauges' || g === 'all scales' || g === 'any gauge') {", "  if (false) {", 'the All Gauges block'));
  const looseJoin = helpers(plant(AJ, "(_pw.charAt(0) !== 'o' || /^(o|o\\s*gauge|o\\s*scale|o-?27(\\s*gauge)?|o-?72|super o(\\s*gauge)?)$/.test(_pw))", "true", 'the O-word guard'));
  ok('P1b PLANTED: without the O-word guard in joins, R7 fails ("HO & Other Scales" turns into HO + O)', !rChecks(looseJoin).R7);
  ok('P2  PLANTED: without the "All Gauges" block, R4 and I1 fail', !rChecks(noAll).R4 && !iChecks(noAll).I1);
  const noEraItem = helpers(plant(AJ, "  var gs = _scalesOfGauge(item.gauge, era);", "  var gs = _scalesOfGauge(item.gauge);", '_scalesOfItem era'));
  ok('P3  PLANTED: _scalesOfItem not passing the tab → I1 fails (the Master Catalog chip would miss them)', !iChecks(noEraItem).I1);
  const noEraWz = plant(WZ, "_scalesOfGauge(m.gauge, m._era)", "_scalesOfGauge(m.gauge)", 'wizard era');
  ok('P4  PLANTED: the Add filter not passing the tab → W1 fails', !wChecks(noEraWz, H).W1);
  const moved = helpers(plant(AJ, "  if (g === 'oo scale' || g === 'oo') return ['standard'];", "  if (g === 'oo scale' || g === 'oo') return ['o'];", 'OO moved'));
  ok('P5  PLANTED: moving ONE other spelling (OO) is caught by the frozen live list (R6)', rChecks(moved).R6.indexOf('OO') >= 0);
  // the audit without the tab passed in
  const AUD = fs.readFileSync(AUDIT_PATH, 'utf8');
  const tmp = path.join(path.dirname(AUDIT_PATH), '_gargauge_planted_tmp_' + process.pid + '.js');   // removed in finally; pid so two runs never share it
  try {
    fs.writeFileSync(tmp, plant(AUD, "ctx.A._scalesOfGauge(m.gauge, ctx.era)", "ctx.A._scalesOfGauge(m.gauge)", 'audit era'));
    delete require.cache[require.resolve(tmp)];
    ok('P6  PLANTED: the audit not passing the tab → A1 fails', !aChecks(require(tmp)).A1);
  } finally { try { fs.unlinkSync(tmp); } catch (e) {} }
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
