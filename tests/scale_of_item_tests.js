// ═══════════════════════════════════════════════════════════════
// scale_of_item_tests.js — v0.9.1804.
//
// _scaleOfItem (app.js) is the one place that turns an item's Gauge cell into
// a scale id for a MIXED-scale era (Lionel Pre-War). Measured live 2026-09-26:
// the Pre-War tab writes Gauge as "O" (1,783), "Standard" (557), "OO" (69) or
// blank (428). "Standard" was not recognised — only "Standard Gauge" was — so
// all 451 loaded Standard rows came back null and were hidden from a catalog
// browse filtered to Standard gauge.
//
// This suite reads the REAL function out of app.js and runs it on the exact
// Gauge words the sheet uses. Section C breaks the fix on purpose and the
// Standard checks must go red.
// Run:  node tests/scale_of_item_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'app', 'app.js'), 'utf8');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

function lift(src) {
  const a = src.indexOf('function _scaleOfItem(');
  if (a < 0) return null;
  const b = src.indexOf('\n}\n', a);
  const body = src.slice(a, b + 2);
  // Pre-War is a mixed era: no era scale, so the Gauge cell decides.
  return new Function('_itemEraKey', '_scaleOfEra', body + '\nreturn _scaleOfItem;')(
    it => it._era, () => null);
}
const scale = lift(SRC);
const pw = g => scale({ _era: 'prewar', gauge: g });

section('A · the Gauge words the Lionel Pre-War tab actually uses');
ok('function found in app.js', typeof scale === 'function');
ok('"Standard" (557 rows) -> standard', pw('Standard') === 'standard', String(pw('Standard')));
ok('"standard" in any case -> standard', pw('STANDARD') === 'standard' && pw(' standard ') === 'standard');
ok('"O" (1,783 rows) -> o', pw('O') === 'o');
ok('"OO" (69 rows) -> standard, as before', pw('OO') === 'standard');
ok('blank (428 rows) stays unknown (null), as before', pw('') === null);

section('B · the wordings that already worked still work');
ok('"Standard Gauge" -> standard', pw('Standard Gauge') === 'standard');
ok('"Standard/O Gauge" -> standard', pw('Standard/O Gauge') === 'standard');
ok('"2-7/8" -> standard', pw('2-7/8 in') === 'standard');
ok('"S Gauge" -> s (a bare S still is not Standard)', pw('S Gauge') === 's' && pw('S') === 's');
ok('"HO" -> ho', pw('HO') === 'ho');
ok('"O27" -> o', pw('O27') === 'o');

section('C · planted offender — undo the fix and the Standard check must go red');
const off = SRC.replace("g === 'standard' || g === 'std' || ", '');
ok('offender actually changed the source', off !== SRC);
const broken = lift(off);
ok('OFFENDER: without the fix, "Standard" is unknown again', broken({ _era: 'prewar', gauge: 'Standard' }) === null);

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
