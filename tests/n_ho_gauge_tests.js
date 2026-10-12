#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// KATO'S "N/HO" PIECES SHOW UNDER N AND HO — v0.9.1933
//
// The 2026-10-11a master audit flagged 24 Kato N rows with Gauge "N/HO" —
// power packs, turnout switches, cords, UniJoiners Kato sells for both N and
// HO track. The app could not read "N/HO", and because the rows sit on the
// Kato N tab they browsed as N only. Brad: "yes" — teach the app N/HO is BOTH,
// like "Standard & O".
// The REAL functions from app/app.js (_scalesOfGauge, _scaleOfEra,
// _scalesOfItem, _scaleOfItem) run here against the real era→scale table:
//   H1  "N/HO" reads as N and HO
//   H2  a Kato N row marked "N/HO" browses under N AND HO
//   H3  a plain Kato N row still browses under N only
//   H4  its ONE answer (brand naming, dashboard buckets) is still N
//   H5  a row can never be widened to a scale its tab does not hold
//       (an Atlas O row marked "N/HO" stays O)
//   H6  a mixed-scale era (no tab scale) takes the gauge's two scales
//   H7  PLANTED: without the widening, H2 fails
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const APP = path.join(__dirname, '..', 'app');
const SRC = fs.readFileSync(path.join(APP, 'app.js'), 'utf8');
const OB = fs.readFileSync(path.join(APP, 'onboarding-config.js'), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail))); cond ? pass++ : fail++; }
function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('could not find ' + name);
  let d = 0; const s0 = src.indexOf('{', i);
  for (let k = s0; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced ' + name);
}
// the real ERA_TO_SCALE table from onboarding-config.js
const e0 = OB.indexOf('ERA_TO_SCALE'); const b0 = OB.indexOf('{', e0);
let dd = 0, b1 = b0; for (let k = b0; k < OB.length; k++) { if (OB[k] === '{') dd++; else if (OB[k] === '}') { dd--; if (!dd) { b1 = k; break; } } }
const ERA_TO_SCALE = new Function('return ' + OB.slice(b0, b1 + 1))();
function load(src) {
  return new Function('WHAT_I_COLLECT', '_itemEraKey',
    grab(src, '_scaleOfEra') + grab(src, '_scalesOfGauge') + grab(src, '_scalesOfItem') + grab(src, '_scaleOfItem') +
    '; return { _scalesOfGauge, _scalesOfItem, _scaleOfItem };')({ ERA_TO_SCALE }, it => it._era);
}
const A = load(SRC);
const kato = (g) => ({ _era: 'kato_n', itemNum: '22-018BK-1', gauge: g });

T('H0 the real table says Kato N is N', ERA_TO_SCALE.kato_n === 'n', { kato_n: ERA_TO_SCALE.kato_n });
T('H1 "N/HO" reads as N and HO', JSON.stringify(A._scalesOfGauge('N/HO')) === '["n","ho"]', A._scalesOfGauge('N/HO'));
T('H2 a Kato N row marked "N/HO" browses under N AND HO', JSON.stringify(A._scalesOfItem(kato('N/HO'))) === '["n","ho"]', A._scalesOfItem(kato('N/HO')));
T('H3 a plain Kato N row browses under N only', JSON.stringify(A._scalesOfItem(kato(''))) === '["n"]' && JSON.stringify(A._scalesOfItem(kato('N'))) === '["n"]', [A._scalesOfItem(kato('')), A._scalesOfItem(kato('N'))]);
T('H4 its ONE answer is still N (brand naming, dashboard buckets unchanged)', A._scaleOfItem(kato('N/HO')) === 'n' && A._scaleOfItem(kato('')) === 'n', [A._scaleOfItem(kato('N/HO')), A._scaleOfItem(kato(''))]);
const oEra = Object.keys(ERA_TO_SCALE).find(k => ERA_TO_SCALE[k] === 'o');
T('H5 a row is never widened to a scale its tab does not hold (an O-tab row marked "N/HO" stays O)', oEra && JSON.stringify(A._scalesOfItem({ _era: oEra, gauge: 'N/HO' })) === '["o"]', { oEra, got: oEra && A._scalesOfItem({ _era: oEra, gauge: 'N/HO' }) });
T('H6 a mixed-scale era (no tab scale) takes the gauge\'s two scales', JSON.stringify(A._scalesOfItem({ _era: 'prewar', gauge: 'Standard & O' })) === '["standard","o"]' && A._scaleOfItem({ _era: 'prewar', gauge: 'Standard & O' }) === null, A._scalesOfItem({ _era: 'prewar', gauge: 'Standard & O' }));
const planted = SRC.replace('if (eraScale) return (gs.length > 1 && gs.indexOf(eraScale) >= 0) ? gs : [eraScale];', 'if (eraScale) return [eraScale];');
if (planted === SRC) throw new Error('could not plant');
T('H7 PLANTED: without the widening a Kato "N/HO" row is N only', JSON.stringify(load(planted)._scalesOfItem(kato('N/HO'))) === '["n"]');
console.log('\nn_ho_gauge_tests: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
