#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// LETTER READ — v0.9.1886 / v0.9.1887
//
// [stated] Brad: "yes" — the reader read "6014" off a car lettered X6014 (his
// Baby Ruth boxcar; the token scan starts every token at a digit) and v1885
// only carried the X in the pick list. Now the READ keeps the letter: a single
// letter glued to the digits, when the catalogue spells the number that way,
// in the stamped catalogue, where that same catalogue also holds the plain
// number (the v1885 rule — Weaver's U1001 is never a Lionel 1001).
//
// These tests run the REAL _numberFromText (with the real _pinReadFamily and
// rrDashedKin) over a catalog shaped like Brad's. Section E plants the old
// reader and requires red.
// Run:  node tests/letter_read_tests.js
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
const PWT = 'Lionel PW - Items';
const CATALOG = {
  '6014':   row('6014', 'pw', 'Chun King', 'Chun King Boxcar', PWT),
  'X6014':  row('X6014', 'pw', 'Baby Ruth', 'Baby Ruth Boxcar', PWT),
  '6014-1': row('6014-1', 'pw', 'Bosco', 'Bosco Boxcar', PWT),
  '1001':   row('1001', 'pw', '', 'Scout Locomotive', PWT),
  '153':    row('153', 'pw', '', 'Block Signal', PWT),     // what Brad's re-scan answered with
  'U1001':  row('U1001', 'weaver', 'Weaver', 'Weaver U-series car', 'Weaver O'),
  '6454':   row('6454', 'atlas', 'Atlas', 'Atlas 6454', 'Atlas O'),
  'X6454':  row('X6454', 'pw', 'Erie', 'Erie Boxcar', PWT),
  '2454':   row('2454', 'prewar', '', 'A pre-war 2454', 'Lionel Pre-War'),
  'X2454':  row('X2454', 'pw', 'Baby Ruth', 'Baby Ruth Boxcar', PWT),
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
const PW = { era: 'pw', manufacturer: 'lionel', scale: 'o' };
const NONE = {};
// Brad's car, as the lettering reads: the keystone, the dimensions, the stamp.
const BABY = 'PRR EW 9-11 EH 13-0 IL 40-6 IH 10-4 CUFT 3836 X6014 BUILT BY LIONEL ENJOY CURTISS BABY RUTH CANDY';

section('A. Brad\'s Baby Ruth: X6014 read as stamped');
{
  const r = build()(BABY, PW);
  ok('A1  the answer is X6014 — the Baby Ruth, not the Chun King 6014', r && String(r.num) === 'X6014' && r.matched === true, r && JSON.stringify({ num: r.num, matched: r.matched }));
  ok('A2  the card says the letter was kept', r && r.dbg && Array.isArray(r.dbg.lettered) && r.dbg.lettered.join(',') === 'X6014', r && r.dbg && r.dbg.lettered);
  ok('A3  the letter spelling leads its digits among the numbers seen', r && r.dbg && r.dbg.cand.indexOf('X6014') >= 0 && r.dbg.cand.indexOf('X6014') < r.dbg.cand.indexOf('6014'), r && r.dbg && r.dbg.cand);
  ok('A4  "X6014 BUILT BY LIONEL" names the maker beside the lettered number too (the maker rule still ranks it first)', r && r.dbg && r.dbg.viaMaker === 'X6014', r && r.dbg && r.dbg.viaMaker);
  ok('A5  the plain 6014 is still a candidate behind it (nothing hidden)', r && r.dbg && r.dbg.cand.indexOf('6014') >= 0, r && r.dbg && r.dbg.cand);
}

section('A2. Brad\'s EXACT re-scan (2026-10-05): the X came back as a digit, and 6014 was marked wrong');
{
  // The disclosure on his card, word for word: the full-alphabet passes and the digits-only pass.
  const FULL = 'I - S 1 1 A NE HT 5 Y TE 4 CURTISS 1 53 E 51 1 1 3 EH 13-0 - RE 1 X SIL 40-6 EE - - B R CL EE 0 C EL TT H 3 MEE TT 1 I CANDY J - 1 X EE 1 FT 4 - BUILT BY - LV 1 1 1 CL RD S NR A S';
  const DIG = '9-1 40-6 9-2 383 16014 78 9-11 13-0 40-6- - 9-2- - 10-8- - -13088 - 1 10-8 - 3838 10 8- - 5 - 2 1 - - 3 2 - 3 1-0 3 2 3 - - - 4 - - - 9-1 13';
  const REJ = { era: 'pw', manufacturer: 'lionel', scale: 'o', reject: ['6014'] };
  const r = build()(FULL + '\n' + DIG, REJ);
  ok('A2a the answer is X6014 — read as "16014" by the digits-only pass (a letter cannot come out of that pass), not the block signal 153', r && String(r.num) === 'X6014' && r.matched === true, r && JSON.stringify({ num: r.num, matched: r.matched, cand: r.dbg && r.dbg.cand }));
  ok('A2b the lettered spelling outranks the plain 153 read once elsewhere (dbg.viaLetter)', r && r.dbg && r.dbg.viaLetter === 'X6014', r && r.dbg && r.dbg.viaLetter);
  ok('A2c marking the plain 6014 wrong did not hide its lettered twin', r && r.dbg && r.dbg.lettered.join(',') === 'X6014' && (r.dbg.rejectedList || []).indexOf('6014') >= 0, r && r.dbg && JSON.stringify({ lettered: r.dbg.lettered, rej: r.dbg.rejectedList }));
  const r2 = build()(FULL + '\n' + DIG, PW);
  ok('A2d …and without the mark, the same answer', r2 && String(r2.num) === 'X6014', r2 && JSON.stringify({ num: r2.num }));
  const r3 = build()('LIONEL 16014 CANDY', PW);
  ok('A2e "16014" alone on a Postwar-stamped photo → X6014 (one digit longer than the era allows; the catalogue has exactly one letter spelling of 6014)', r3 && String(r3.num) === 'X6014' && r3.dbg.lettered.join(',') === 'X6014', r3 && JSON.stringify({ num: r3.num, lettered: r3.dbg.lettered }));
  const r4 = build()('LIONEL 16014 CANDY', NONE);
  ok('A2f with NO era filter there is no digit cap, so "16014" is not reshaped into a letter (nothing invented)', r4 && r4.dbg.lettered.length === 0, r4 && JSON.stringify({ num: r4.num, lettered: r4.dbg.lettered }));
  const r5 = build()('LIONEL 11001 CANDY', PW);
  ok('A2g "11001" → nothing: the catalogue spells 1001 with no letter in Postwar (Weaver\'s U1001 is another catalogue)', r5 && r5.dbg.lettered.length === 0, r5 && JSON.stringify({ num: r5.num, lettered: r5.dbg.lettered }));
}

section('B. No letter invented, no letter from a word');
{
  const r1 = build()('6014 BUILT BY LIONEL CHUN KING', PW);
  ok('B1  a plain 6014 stays 6014', r1 && String(r1.num) === '6014' && r1.dbg.lettered.length === 0, r1 && JSON.stringify({ num: r1.num, lettered: r1.dbg.lettered }));
  const r2 = build()('NO6014 BUILT BY LIONEL', PW);
  ok('B2  "NO6014" — the O is the end of a word, not a letter standing before the digits', r2 && String(r2.num) === '6014' && r2.dbg.lettered.length === 0, r2 && JSON.stringify({ num: r2.num, lettered: r2.dbg.lettered }));
  const r3 = build()('BOX6014 LIONEL', PW);
  ok('B3  "BOX6014" likewise', r3 && String(r3.num) === '6014' && r3.dbg.lettered.length === 0, r3 && JSON.stringify({ num: r3.num, lettered: r3.dbg.lettered }));
  const r4 = build()('Z6014 BUILT BY LIONEL', PW);
  ok('B4  a letter the catalogue does not spell (Z6014) is dropped as before', r4 && String(r4.num) === '6014' && r4.dbg.lettered.length === 0, r4 && JSON.stringify({ num: r4.num, lettered: r4.dbg.lettered }));
}

section('C. Never across makers, never into another catalogue');
{
  const r1 = build()('LIONEL U1001 SCOUT', PW);
  ok('C1  U1001 on a Lionel-stamped photo is Lionel\'s 1001, not Weaver\'s U1001', r1 && String(r1.num) === '1001' && r1.dbg.lettered.length === 0, r1 && JSON.stringify({ num: r1.num, lettered: r1.dbg.lettered }));
  const r2 = build()('LIONEL U1001 SCOUT', NONE);
  ok('C2  …and with NO filter at all: Weaver\'s catalogue has no plain 1001, so the letter still does not count', r2 && String(r2.num) === '1001' && r2.dbg.lettered.length === 0, r2 && JSON.stringify({ num: r2.num, lettered: r2.dbg.lettered }));
  const r3 = build()('X6454 BUILT BY LIONEL ERIE', PW);
  ok('C3  X6454 (no plain 6454 in Lionel — Atlas has it) is not this rule\'s to settle: findMaster\'s v1730 bridge owns it', r3 && r3.dbg.lettered.length === 0, r3 && JSON.stringify({ num: r3.num, lettered: r3.dbg.lettered }));
  const r4 = build()('X2454 BUILT BY LIONEL BABY RUTH', PW);
  ok('C4  X2454: the plain 2454 lives in PRE-WAR, not Postwar — a different catalogue, so the letter does not count here', r4 && r4.dbg.lettered.length === 0, r4 && JSON.stringify({ num: r4.num, lettered: r4.dbg.lettered }));
}

section('D. The card\'s plain-English line');
{
  const why = grab(SRC, 'function _pinPlainWhy(dbg, raw)');
  ok('D1  the trace says "Kept the letter stamped before the number: X6014"', /Kept the letter stamped before the number: ' \+ dbg\.lettered\.join\(', '\)/.test(why));
  ok('D2  no "AI" in the wording', !/\bAI\b/.test(why.slice(why.indexOf('Kept the letter'), why.indexOf('Kept the letter') + 120)));
}

section('E. THE OFFENDER: the old reader, require red');
{
  const src = grab(SRC, 'function _numberFromText(text, prefer)');
  const i = src.indexOf('    var _lettered = [];'), j = src.indexOf('    })();', i);
  if (i < 0 || j < 0) throw new Error('planted reader: the block moved; update this test');
  const old = src.slice(0, i) + '    var _lettered = [];\n' + src.slice(j + '    })();'.length);
  const r = build({ readerSource: old })(BABY, PW);
  ok('E1  PLANTED: without the step, Brad\'s car comes back as the Chun King 6014 — A1 would go red', r && String(r.num) === '6014', r && JSON.stringify({ num: r.num }));
  const noRank = src.replace("else if (letteredHit.length) { letteredHit.sort(dashRank); direct = letteredHit[0]; dbg.viaLetter = direct; }", '');
  if (noRank === src) throw new Error('planted ranking: the line moved; update this test');
  const FULL = 'I - S 1 1 A NE HT 5 Y TE 4 CURTISS 1 53 E 51 1 1 3 EH 13-0 - RE 1 X SIL 40-6 EE - - B R CL EE 0 C EL TT H 3 MEE TT 1 I CANDY J - 1 X EE 1 FT 4 - BUILT BY - LV 1 1 1 CL RD S NR A S';
  const DIG = '9-1 40-6 9-2 383 16014 78 9-11 13-0 40-6- - 9-2- - 10-8- - -13088 - 1 10-8 - 3838 10 8- - 5 - 2 1 - - 3 2 - 3 1-0 3 2 3 - - - 4 - - - 9-1 13';
  const TWICE = 'CURTISS 153 CANDY 153 X SIL 40-6 16014 BUILT BY';   // a stray 153 read twice, the stamp once
  const rOK = build()(TWICE, PW);
  ok('E2a the real code: a stray number read twice does not outrank the catalogue\'s spelling of the stamp', rOK && String(rOK.num) === 'X6014' && rOK.dbg.viaLetter === 'X6014', rOK && JSON.stringify({ num: rOK.num }));
  const r2 = build({ readerSource: noRank })(TWICE, PW);
  ok('E2  PLANTED: without the ranking, the count picks 153 (read twice) over X6014 — E2a would go red', r2 && String(r2.num) === '153', r2 && JSON.stringify({ num: r2.num }));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
