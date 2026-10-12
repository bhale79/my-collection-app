#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// DUAL-SCALE ROWS FOLLOW EITHER LINE — v0.9.1934
//
// Brad (2026-10-11): "copy these row into both tabs" → "or will that mess
// something up" → (doubles + two rows to keep in step) → "yes" to: keep ONE
// row, and when someone collects Kato HO also bring in the Kato N rows whose
// Gauge says "N/HO". The REAL functions from app/app.js run here against the
// real era→scale table and the real sibling list in config.js:
//   D1  Kato HO ticked, Kato N not → Kato N is loaded, wanted for HO only
//   D2  …and arrives trimmed to its N/HO rows; Kato HO rows untouched
//   D3  Kato N ticked too → nothing trimmed, nothing extra
//   D4  owning something in Kato N keeps every Kato N row (owned rows resolve)
//   D5  Kato N ticked, Kato HO not → the HO tab's rows are wanted for N only
//       (none today are N/HO, so it adds nothing — but the rule runs both ways)
//   D6  nothing Kato ticked → nothing loaded or kept for this rule
//   D7  the catalog shelf lets a sibling's dual-scale row through (the browse
//       line asks rrDualScaleWanted) — and the index rebuild trims (app-data.js)
//   D8  PLANTED: without the trim every Kato N row would reach an HO-only
//       collector's Add search
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const APP = path.join(__dirname, '..', 'app');
const SRC = fs.readFileSync(path.join(APP, 'app.js'), 'utf8');
const CFG = fs.readFileSync(path.join(APP, 'config.js'), 'utf8');
const OB = fs.readFileSync(path.join(APP, 'onboarding-config.js'), 'utf8');
const BR = fs.readFileSync(path.join(APP, 'browse.js'), 'utf8');
const AD = fs.readFileSync(path.join(APP, 'app-data.js'), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail))); cond ? pass++ : fail++; }
function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('could not find ' + name);
  let d = 0; const s0 = src.indexOf('{', i);
  for (let k = s0; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced ' + name);
}
function objAfter(src, key) {
  const e0 = src.indexOf(key); const b0 = src.indexOf('{', e0);
  let dd = 0; for (let k = b0; k < src.length; k++) { if (src[k] === '{') dd++; else if (src[k] === '}') { dd--; if (!dd) return new Function('return ' + src.slice(b0, k + 1))(); } }
}
const ERA_TO_SCALE = objAfter(OB, 'ERA_TO_SCALE');
const SIBS = objAfter(CFG, 'const RR_DUAL_SCALE_SIBLINGS =');
function load(src, ticked, owned) {
  return new Function('WHAT_I_COLLECT', 'RR_DUAL_SCALE_SIBLINGS', '_isEraEnabled', '_ownedEraKeys',
    grab(src, '_scaleOfEra') + grab(src, '_scalesOfGauge') + grab(src, '_dualSiblingWants') + grab(src, 'rrDualScaleWanted') +
    grab(src, 'rrDualScaleTrim') + grab(src, '_erasToLoad') + '; return { _dualSiblingWants, rrDualScaleWanted, rrDualScaleTrim, _erasToLoad };')(
    { ERA_TO_SCALE }, SIBS, e => ticked.indexOf(e) >= 0, () => owned.slice());
}
const rows = [
  { _era: 'kato_ho', itemNum: '2-150', gauge: 'HO' },
  { _era: 'kato_ho', itemNum: '3-503', gauge: '' },
  { _era: 'kato_n', itemNum: '22-018BK-1', gauge: 'N/HO' },
  { _era: 'kato_n', itemNum: '24-840BK', gauge: 'N/HO' },
  { _era: 'kato_n', itemNum: '20-000', gauge: 'N' },
  { _era: 'kato_n', itemNum: '106-100', gauge: '' },
  { _era: 'pw', itemNum: '2343', gauge: 'O' },
];
const ALL = ['pw', 'kato_n', 'kato_ho', 'kato_parts', 'atlas'];
const nums = rs => rs.map(r => r.itemNum).join(',');

T('D0 the real lists: Kato N is N, Kato HO is HO, and they are siblings', ERA_TO_SCALE.kato_n === 'n' && ERA_TO_SCALE.kato_ho === 'ho' && SIBS.kato_ho.indexOf('kato_n') >= 0, { ERA_TO_SCALE: [ERA_TO_SCALE.kato_n, ERA_TO_SCALE.kato_ho], SIBS });
{
  const A = load(SRC, ['pw', 'kato_ho'], []);
  T('D1 Kato HO ticked, Kato N not → Kato N loaded, wanted for HO only', JSON.stringify(A._dualSiblingWants()) === '{"kato_n":["ho"]}' && A._erasToLoad(ALL).indexOf('kato_n') >= 0 && A._erasToLoad(ALL).indexOf('atlas') < 0, { wants: A._dualSiblingWants(), load: A._erasToLoad(ALL) });
  T('D2 …trimmed to its N/HO rows; Kato HO and other rows untouched', nums(A.rrDualScaleTrim(rows)) === '2-150,3-503,22-018BK-1,24-840BK,2343', nums(A.rrDualScaleTrim(rows)));
}
{
  const A = load(SRC, ['kato_ho', 'kato_n'], []);
  T('D3 Kato N ticked too → nothing trimmed, nothing extra', JSON.stringify(A._dualSiblingWants()) === '{}' && A.rrDualScaleTrim(rows) === rows, A._dualSiblingWants());
}
{
  const A = load(SRC, ['kato_ho'], ['kato_n']);
  T('D4 owning something in Kato N keeps every Kato N row', A.rrDualScaleTrim(rows) === rows && A.rrDualScaleWanted(rows[2]) === true, nums(A.rrDualScaleTrim(rows)));
}
{
  const A = load(SRC, ['kato_n'], []);
  T('D5 Kato N ticked, Kato HO not → the HO tab is wanted for N only; no HO row is N/HO, so none is kept', JSON.stringify(A._dualSiblingWants()) === '{"kato_ho":["n"]}' && nums(A.rrDualScaleTrim(rows)) === '22-018BK-1,24-840BK,20-000,106-100,2343', nums(A.rrDualScaleTrim(rows)));
}
{
  const A = load(SRC, ['pw'], []);
  T('D6 nothing Kato ticked → nothing loaded or kept for this rule', JSON.stringify(A._dualSiblingWants()) === '{}' && A._erasToLoad(ALL).join(',') === 'pw' && A.rrDualScaleTrim(rows) === rows, A._erasToLoad(ALL));
}
T('D7 the catalog shelf lets a sibling\'s dual-scale row through', /_offShelf\.has\(m\._era\) && !\(typeof rrDualScaleWanted === 'function' && rrDualScaleWanted\(m, _dualWants\)\)/.test(BR));
T('D7 …and the one index rebuild trims (app-data.js _rebuildMasterIndex)', /rrDropDoubledCatalogRows\(typeof rrDualScaleTrim === 'function' \? rrDualScaleTrim\(rows0\) : rows0\)/.test(AD));
{
  const planted = SRC.replace("if (r && r._era && only.indexOf(r._era) >= 0 && !rrDualScaleWanted(r, wants)) { dropped++; continue; }", '');
  if (planted === SRC) throw new Error('could not plant');
  const A = load(planted, ['kato_ho'], []);
  T('D8 PLANTED: without the trim every Kato N row would reach an HO-only collector', nums(A.rrDualScaleTrim(rows)).indexOf('20-000') >= 0);
}
console.log('\ndual_scale_sibling_tests: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
