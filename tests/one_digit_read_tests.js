#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ONE-DIGIT READ — v0.9.1901
//
// Brad (2026-10-08) asked whether more places miss one-digit item numbers,
// after "want to add a 4 trolley. it doesn't show up". Two readers could
// never return one:
//   * the Photo Inbox reader (_numberFromText, photo-inbox.js) dropped every
//     one-character token before the catalogue was asked — "LIONEL 8" on a
//     No. 8 could not be read;
//   * the pasted-text picker (extractLionelNumber, wizard-photos.js) needed
//     two digits after a label — "Lionel No. 8 Standard Gauge" gave nothing.
// [stated] Brad "yes": a one-digit number counts ONLY with its label right
// before it (the maker's name, "No.", "#"), never before RAIL / GAUGE /
// WHEEL …, must exist in the stamped catalogue, and never beats a longer
// confirmed number. These run the REAL functions; section C plants the old
// code and requires red.
// Run:  node tests/one_digit_read_tests.js
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'app', 'photo-inbox.js'), 'utf8');
const APP = fs.readFileSync(path.join(__dirname, '..', 'app', 'app.js'), 'utf8');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
function grab(src, sig) {
  const i = src.indexOf(sig); if (i < 0) throw new Error('could not find ' + sig);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced ' + sig);
}
function grabVar(name) { const i = SRC.indexOf('var ' + name + ' = {'); if (i < 0) throw new Error('no var ' + name); return SRC.slice(i, SRC.indexOf('};', i) + 2); }

const row = (num, era, road, desc, tab) => ({ itemNum: num, _era: era, roadName: road, description: desc, _tab: tab });
const PRE = 'Lionel Pre-War', PWT = 'Lionel PW - Items';
const CATALOG = {
  '3':    row('3', 'prewar', '', 'Trolley (std)', PRE),
  '4':    row('4', 'prewar', '', 'Trolley (std)', PRE),
  '8':    row('8', 'prewar', '', 'Electric Locomotive 0-4-0 (std)', PRE),
  '8E':   row('8E', 'prewar', '', 'Electric Locomotive 0-4-0 (std)', PRE),
  '2343': row('2343', 'pw', 'Santa Fe', 'Santa Fe F3 A Unit', PWT),
  '50':   row('50', 'pw', '', 'Gang Car', PWT),
};
const MAKER = { pw: 'lionel', mpc: 'lionel', prewar: 'lionel', weaver: 'weaver', atlas: 'atlas' };
function build(opts) {
  opts = opts || {};
  const sb = {
    console,
    window: { rrDemotedRow: () => false },
    findMaster: (c) => CATALOG[String(c)] || null,
    _prefEras: (p) => (p && p.era) ? [p.era] : [],
    _manufacturerOfEra: (e) => MAKER[e] || '',
    _pinQuoteMatch: () => null,
    _pinIsSetRow: () => false, _pinDemotedRow: () => false, _photoIsPaper: false,
    MAX_PLAIN_DIGITS: { prewar: 4, pw: 4 },
    _pinKinRowsFor: (n) => CATALOG[n] ? [CATALOG[n]] : [],
    state: { masterData: Object.values(CATALOG), masterByItem: new Map(Object.keys(CATALOG).map(k => [k, [CATALOG[k]]])) },
    WeakMap,
  };
  sb.window.state = sb.state;
  vm.createContext(sb);
  vm.runInContext(grab(APP, 'function rrDashedKin(num)'), sb);
  const AD = fs.readFileSync(path.join(__dirname, '..', 'app', 'app-data.js'), 'utf8');
  vm.runInContext('var _lkCache = new WeakMap();\n' + grab(AD, 'function _letterKinRows(idx, bare)'), sb);
  const reader = opts.readerSource || grab(SRC, 'function _numberFromText(text, prefer)');
  vm.runInContext(grabVar('_FAM_STOPWORDS') + '\n' + grab(SRC, 'function _pinFamilyPick(c, prefer, srcText)') + '\n'
    + grab(SRC, 'function _pinReadFamily(uniq, prefer, UP, dbg)') + '\n' + reader + '\nthis.run = _numberFromText;', sb);
  return sb.run;
}
const PREW = { era: 'prewar', manufacturer: 'lionel' };
const PW = { era: 'pw', manufacturer: 'lionel' };
const NONE = {};
const num = (r) => (r && r.num) ? String(r.num) : '';

section('A. Photo Inbox reader (_numberFromText)');
{
  const run = build();
  ok('A1 "LIONEL LINES 8" on a Pre-War photo reads 8', num(run('STANDARD GAUGE LIONEL LINES 8 NEW YORK', PREW)) === '8', run('STANDARD GAUGE LIONEL LINES 8 NEW YORK', PREW));
  ok('A2 "NO. 4" reads 4', num(run('NO. 4 TROLLEY CAR', PREW)) === '4');
  ok('A3 "LIONEL 8E" reads 8E', num(run('LIONEL 8E', PREW)) === '8E');
  ok('A4 "LIONEL 3 RAIL" is NOT item 3', num(run('LIONEL 3 RAIL O GAUGE', NONE)) !== '3', run('LIONEL 3 RAIL O GAUGE', NONE));
  ok('A5 a loose digit is never read ("4 WHEEL TRUCKS")', num(run('4 WHEEL TRUCKS BLT 8', NONE)) === '');
  ok('A6 a longer confirmed number wins over a labelled one-digit, even unlabelled ("SANTA FE 2343 … NO. 4")', num(run('SANTA FE 2343 NO. 4', NONE)) === '2343', run('SANTA FE 2343 NO. 4', NONE));
  ok('A6b … and when both are labelled ("LIONEL 2343 … NO. 4")', num(run('LIONEL 2343 SANTA FE NO. 4', NONE)) === '2343');
  const pwRead = run('LIONEL 8', PW);
  ok('A7 a Postwar-stamped photo never CONFIRMS the Pre-War No. 8 (offered as another era, as any off-era read is)', !(pwRead && pwRead.matched) && (num(pwRead) !== '8' || pwRead.offEra === true), pwRead);
  ok('A8 two-digit reads unchanged ("LIONEL 50" gang car)', num(run('IONEL DE 50', PW)) === '50');
}

section('B. pasted text (extractLionelNumber)');
const WP = fs.readFileSync(path.join(__dirname, '..', 'app', 'wizard-photos.js'), 'utf8');
function eln(src) {
  const c = {}; vm.createContext(c);
  vm.runInContext(grab(src, 'function extractLionelNumber(text)') + '\nthis.f = extractLionelNumber;', c);
  return c.f;
}
{
  const f = eln(WP);
  ok('B1 "Lionel No. 8 Standard Gauge electric locomotive" -> 8', f('Lionel No. 8 Standard Gauge electric locomotive') === '8');
  ok('B2 "a Lionel #4 trolley from 1906" -> 4', f('This is a Lionel #4 trolley from 1906') === '4');
  ok('B3 "Lionel 8E Standard Gauge" -> 8E', f('Lionel 8E Standard Gauge') === '8E');
  ok('B4 "Lionel 3 rail trolley" -> nothing (3 rail is not an item)', f('Lionel 3 rail trolley') === null);
  ok('B5 "a 4 wheel trolley" -> nothing (no label)', f('a 4 wheel trolley') === null);
  ok('B6 "Lionel 3-rail O gauge 2343 Santa Fe F3" -> 2343', f('Lionel 3-rail O gauge 2343 Santa Fe F3') === '2343');
  ok('B7 "No. 8 and No. 2343" -> 2343 (longer wins)', f('No. 8 and No. 2343') === '2343');
  ok('B8 "Lionel 42 locomotive" -> 42 (unchanged)', f('Lionel 42 locomotive') === '42');
}

section('C. planted: the old code must fail');
{
  const reader = grab(SRC, 'function _numberFromText(text, prefer)');
  const i = reader.indexOf('    var _oneDigit = {};'), j = reader.indexOf('    })();\n', i);
  if (i < 0 || j < 0) throw new Error('planted offender C1 no longer matches — update the test');
  const old = reader.slice(0, i) + '    var _oneDigit = {};\n' + reader.slice(j + '    })();\n'.length);
  const run = build({ readerSource: old });
  ok('C1 PLANTED no one-digit scan: "LIONEL LINES 8" is not read (A1 can fail)', num(run('STANDARD GAUGE LIONEL LINES 8 NEW YORK', PREW)) !== '8');
  const noGate = reader.replace("if (matched.some(function (c) { return !_oneDigit[c]; })) matched", "if (false) matched");
  if (noGate === reader) throw new Error('planted offender C2 no longer matches — update the test');
  const run2 = build({ readerSource: noGate });
  ok('C2 PLANTED no "longer wins" gate: NO. 4 beats an unlabelled 2343 (A6 can fail)', num(run2('SANTA FE 2343 NO. 4', NONE)) === '4', run2('SANTA FE 2343 NO. 4', NONE));
  const wpOld = WP.replace(/\n    \/\/ v0\.9\.1901: a ONE-digit number[\s\S]*?, 20\],\n/, '\n');
  if (wpOld === WP) throw new Error('planted offender C3 no longer matches — update the test');
  ok('C3 PLANTED old picker: "Lionel No. 8" gives nothing (B1 can fail)', eln(wpOld)('Lionel No. 8 Standard Gauge electric locomotive') === null);
}

console.log('\none_digit_read_tests: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
