// ═══════════════════════════════════════════════════════════════
// scale_of_item_tests.js — v0.9.1804, v0.9.1805.
//
// app.js owns ONE gauge reader: _scalesOfGauge(text) -> list of scale ids,
// _scalesOfItem(item) (era first, else the Gauge cell), and _scaleOfItem(item)
// (one id or null). Measured live 2026-09-26: the Lionel Pre-War tab writes
// Gauge as "O" (1,783), "Standard" (557), "OO" (69) or blank (428).
//   v1804: "Standard" was not recognised (only "Standard Gauge") — 451 loaded
//          rows came back null and were hidden from a Standard browse.
//   v1805: Brad — items sold for any Lionel train (lamps, transformers, paper)
//          get "Standard & O" and must show under BOTH chips. browse.js's own
//          spelling table (which turned 'Standard' into 'std', a word no chip
//          uses) is gone; both browse checks read through the shared reader.
//
// This suite runs the REAL functions lifted out of app.js on the exact words
// the sheet uses, and runs the REAL browse checks' logic. Section D breaks
// each fix on purpose and the matching checks must go red.
// Run:  node tests/scale_of_item_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const APP = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
const SRC = APP('app.js');
const BROWSE = APP('browse.js');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

function lift(src) {
  const a = src.indexOf('function _scalesOfGauge(');
  const z = src.indexOf('function _scaleOfItem(');
  if (a < 0 || z < 0) return null;
  const b = src.indexOf('\n}\n', z);
  const body = src.slice(a, b + 2);
  // Pre-War is a mixed era: no era scale, so the Gauge cell decides.
  return new Function('_itemEraKey', '_scaleOfEra',
    body + '\nreturn { one: _scaleOfItem, all: _scalesOfItem, gauge: _scalesOfGauge };')(
    it => it._era, era => (era === 'atlas_n' ? 'n' : null));
}
const F = lift(SRC);
const one = g => F.one({ _era: 'prewar', gauge: g });
const all = g => F.all({ _era: 'prewar', gauge: g }).join(',');

section('A · the Gauge words the Lionel Pre-War tab actually uses');
ok('functions found in app.js', !!F && typeof F.one === 'function');
ok('"Standard" (557 rows) -> standard', one('Standard') === 'standard', String(one('Standard')));
ok('"standard" in any case -> standard', one('STANDARD') === 'standard' && one(' standard ') === 'standard');
ok('"O" (1,783 rows) -> o', one('O') === 'o');
ok('"OO" (69 rows) -> standard, as before', one('OO') === 'standard');
ok('blank stays unknown (null / empty list)', one('') === null && all('') === '');
ok('"2-7/8" (the 1901-05 trains) -> standard', one('2-7/8') === 'standard');

section('B · "Standard & O" — both chips (v1805)');
ok('"Standard & O" -> standard AND o', all('Standard & O') === 'standard,o', all('Standard & O'));
ok('spellings: "Standard and O", "O & Standard", "Std & O Gauge"',
  all('Standard and O') === 'standard,o' && all('O & Standard') === 'standard,o' && all('Std & O Gauge') === 'standard,o');
ok('a two-gauge item has no ONE scale (null), as a blank had', one('Standard & O') === null);
ok('"Standard/O Gauge" (existing wording) still means Standard only', all('Standard/O Gauge') === 'standard');
ok('the era still wins over the cell (Atlas N row)', F.all({ _era: 'atlas_n', gauge: 'Standard & O' }).join(',') === 'n');

section('C · the wordings that already worked still work');
ok('"Standard Gauge" -> standard', one('Standard Gauge') === 'standard');
ok('"S Gauge" / "S" -> s (a bare S is not Standard)', one('S Gauge') === 's' && one('S') === 's');
ok('"HO" -> ho, "N" -> n, "G Scale" -> g', one('HO') === 'ho' && one('N') === 'n' && one('G Scale') === 'g');
ok('"O27" / "O-27" / "027" -> o', one('O27') === 'o' && one('O-27') === 'o' && one('027') === 'o');

section('D · browse.js reads through the ONE reader');
ok('the personal-row check calls _scalesOfGauge', /_scalesOfGauge\(pd\.gauge\)/.test(BROWSE));
ok('the old spelling table (\'standard\': \'std\') is gone', BROWSE.indexOf("'standard': 'std'") < 0);
ok('the catalog check calls _scalesOfItem and tests membership',
  /_scalesOfItem\(item\)/.test(BROWSE) && /_itmScales\.indexOf\(_stp3b\.scale\) < 0/.test(BROWSE));
// run the catalog check's rule the way browse.js now does
const shows = (gauge, chip) => F.all({ _era: 'prewar', gauge }).indexOf(chip) >= 0;
ok('a "Standard & O" lamp shows under O AND under Standard, not under HO',
  shows('Standard & O', 'o') && shows('Standard & O', 'standard') && !shows('Standard & O', 'ho'));
ok('a "Standard" car shows under Standard, not under O', shows('Standard', 'standard') && !shows('Standard', 'o'));

section('E · planted offenders — each must turn a check red');
const off1 = SRC.replace("g === 'standard' || g === 'std' || ", '');
ok('offender 1 changed the source', off1 !== SRC);
ok('OFFENDER 1: drop the v1804 words -> "Standard" unknown again', lift(off1).one({ _era: 'prewar', gauge: 'Standard' }) === null);
const off2 = SRC.replace("return ['standard', 'o'];", "return ['standard'];");
ok('offender 2 changed the source', off2 !== SRC);
ok('OFFENDER 2: make "Standard & O" one gauge -> it no longer shows under O',
  lift(off2).all({ _era: 'prewar', gauge: 'Standard & O' }).indexOf('o') < 0);

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
