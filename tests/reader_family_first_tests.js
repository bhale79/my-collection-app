// ════════════════════════════════════════════════════════════════════════
// reader_family_first_tests.js — v0.9.1831
//
// THE FAMILY THE CAR NAMES OUTRANKS ANOTHER CATALOG'S LEAD.
//
// Brad's Great Northern boxcar, 2026-09-28, re-scanned on his phone as the
// last S9 check. The card: "Numbers seen: 6464, 2300, 3727, 523 … In another
// maker's catalog: 2300:mpc" and the answer "2300 — Operating Oil Drum
// Loader" (Lionel MPC/Modern). His "Where did this come from?" gave the raw
// text and the path: "Could be any of: 6440, 6427, 2340" (ambiguous windows)
// then "The number read on the car (2300) belongs to another era's catalog —
// it leads the choices". 6464 was read TWICE, heads 196 dashed relatives in
// the stamped catalog, and GREAT NORTHERN sat beside it — but the ambiguous-
// windows branch conceded to another era's catalog (the v1105 off-era lead)
// before the v1448 family question, one step below, was ever asked. The same
// ordering fault v1772 fixed for glued dashes, one branch up.
//
// These tests run the REAL _numberFromText (with the real _pinReadFamily,
// _pinFamilyPick and rrDashedKin) on Brad's EXACT raw text against the real
// rows his catalog answered with. Section E plants the old ordering and
// requires red.
// ════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'app', 'photo-inbox.js'), 'utf8');
const APP = fs.readFileSync(path.join(__dirname, '..', 'app', 'app.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
function grab(src, sig) {
  const i = src.indexOf(sig); if (i < 0) throw new Error('could not find ' + sig);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced ' + sig);
}
function grabVar(name) { const i = SRC.indexOf('var ' + name + ' = {'); if (i < 0) throw new Error('no var ' + name); return SRC.slice(i, SRC.indexOf('};', i) + 2); }

// The rows Brad's live catalog answered with (measured 2026-09-28 on his desktop).
const row = (num, era, road, desc, tab) => ({ itemNum: num, _era: era, roadName: road, description: desc, _tab: tab });
const CATALOG = {
  '6464-25':  row('6464-25', 'pw', 'Great Northern', 'Great Northern Boxcar', 'Lionel PW - Items'),
  '6464-450': row('6464-450', 'pw', 'Great Northern', 'Great Northern Boxcar', 'Lionel PW - Items'),
  '6464-525': row('6464-525', 'pw', 'Minneapolis & St. Louis', 'Minneapolis & St. Louis Boxcar', 'Lionel PW - Items'),
  '6464-1':   row('6464-1', 'pw', 'Western Pacific', 'Western Pacific Boxcar', 'Lionel PW - Items'),
  '2300':     row('2300', 'mpc', '', 'Operating Oil Drum Loader', 'Lionel MPC-Modern'),
  '6817':     row('6817', 'mpc', '', 'Allis-Chalmers Motor Scraper', 'Lionel MPC-Modern'),
  '6440':     row('6440', 'pw', '', 'Flatcar with Vans', 'Lionel PW - Items'),
  '6427':     row('6427', 'pw', 'Lionel Lines', 'Lionel Lines N5c Porthole Caboose', 'Lionel PW - Items'),
  '2340':     row('2340', 'pw', 'Pennsylvania', 'GG-1 Electric', 'Lionel PW - Items'),
  '1254':     row('1254', 'pw', '', 'Merchandiser', 'Lionel PW - Items'),
  '1002':     row('1002', 'pw', '', 'Lionel Gondola', 'Lionel PW - Items'),
  '523':      row('523', 'shelper', 'GN', "GN 40' Steel Rebuilt Boxcar", 'S-Helper Service S'),
  '3253':     row('3253', 'am_s', 'GN', 'GN 2-bay Offset-sided Hopper', 'American Models S'),
  '284':      row('284', 'marx', '', 'Tender', 'Marx'),
};
const MAKER = { pw: 'lionel', mpc: 'lionel', prewar: 'lionel', shelper: 'shelper', am_s: 'american models', marx: 'marx' };

function build(opts) {
  opts = opts || {};
  const sb = {
    console,
    window: { rrDemotedRow: () => false },
    findMaster: (c) => CATALOG[String(c)] || null,
    _prefEras: (p) => (p && p.era) ? [p.era] : [],
    _manufacturerOfEra: (e) => MAKER[e] || '',
    _pinQuoteMatch: opts.quote || (() => null),
    _pinIsSetRow: () => false, _pinDemotedRow: () => false, _photoIsPaper: false,
    MAX_PLAIN_DIGITS: { prewar: 4, pw: 4 },
    _pinKinRowsFor: (n) => CATALOG[n] ? [CATALOG[n]] : [],
    state: { masterData: Object.values(CATALOG) },
  };
  vm.createContext(sb);
  vm.runInContext(grab(APP, 'function rrDashedKin(num)'), sb);
  const reader = opts.readerSource || grab(SRC, 'function _numberFromText(text, prefer)');
  vm.runInContext(grabVar('_FAM_STOPWORDS') + '\n' + grab(SRC, 'function _pinFamilyPick(c, prefer, srcText)') + '\n'
    + grab(SRC, 'function _pinReadFamily(uniq, prefer, UP, dbg)') + '\n' + reader + '\nthis.run = _numberFromText;', sb);
  return sb.run;
}
const PW = { era: 'pw', manufacturer: 'lionel', scale: 'o', reject: ['6467'] };
// Brad's EXACT raw text (the free reader + the light-numbers pass), 2026-09-28.
const RAW = 'F- - NE J A A EW WT EE EE EL - 7 5 0 5 8 - - FE - 5 5 E - BY - - GREAT NORTHERN ANY - J 3 CE ING 2 1 S 0 - 3 FE GN EE BE EL 5 6464 2 ET 7 3 40-5 CAPY 100000 FE K 2300 TENSES NE S B'
  + ' 6464 190000 5-52 12340 4560 5-52 - - -9 1 8 - 3 - - - - 4 - - - 5 - - - - 4- - - - - 0 10- 1';

section('A. Brad\'s Great Northern, his exact text: the family, not the oil-drum loader');
{
  const r = build()(RAW, PW);
  ok('the answer is the 6464 family, offered as a guess', r && String(r.num) === '6464' && r.family === true && r.matched === false, r && JSON.stringify({ num: r.num, family: r.family, offEra: r.offEra }));
  ok('…narrowed to the two Great Northern cars', r && Array.isArray(r.alts) && r.alts.length === 2 && r.alts.indexOf('6464-25') >= 0 && r.alts.indexOf('6464-450') >= 0, r && JSON.stringify(r.alts));
  ok('…and 2300 (the MPC oil-drum loader) is NOT the answer', r && String(r.num) !== '2300' && !r.offEra);
  ok('the branch under test really fired: the windows were ambiguous', r && r.dbg && !!r.dbg.windowAmbig, r && r.dbg && r.dbg.windowAmbig);
  ok('…and the card says which lead the family outranked', r && r.dbg && r.dbg.familyOverLead === '2300', r && r.dbg && r.dbg.familyOverLead);
  ok('…and names the evidence: GREAT, NORTHERN', r && r.dbg && /narrowed to 6464-25 or 6464-450 on: GREAT, NORTHERN/.test(String(r.dbg.family || '')), r && r.dbg && r.dbg.family);
  ok('the 2300 lead was a real candidate (it is in another catalog, same maker) — the fix did not hide it', r && r.dbg && (r.dbg.offEra || []).some(x => /^2300:mpc/.test(x)), r && r.dbg && JSON.stringify(r.dbg.offEra));
}

section('B. Brad\'s own v1105 rule survives: a car whose number IS the off-era lead');
{
  // "say its a modern 6817 or its a postwar 6817 and let the user pick" — 6817
  // read twice, no family in the stamped era, windows ambiguous → the lead.
  const r = build()('LIONEL 6817 6817 1 2 5 4 1 0 0 2 9', PW);
  ok('with no family to ask, the off-era lead still leads', r && String(r.num) === '6817' && r.offEra === true, r && JSON.stringify({ num: r.num, offEra: r.offEra, windowAmbig: r.dbg && r.dbg.windowAmbig }));
}

section('C. A quote-confirmed lead is a MATCH and still wins (v1089)');
{
  const quote = (lead) => (String(lead) === '2300') ? { row: { itemNum: '2300-Q' } } : null;
  const r = build({ quote })(RAW, PW);
  ok('the tag settles it before the family question is asked', r && r.matched === true && String(r.num) === '2300-Q' && r.viaQuote === '2300', r && JSON.stringify({ num: r.num, matched: r.matched, viaQuote: r.viaQuote }));
}

section('D. No word evidence — the lead stands (the v1772 guard, unchanged)');
{
  const r = build()('6464 1 2 5 4 EXW 1 0 0 2 2300', PW);
  ok('a bare family head with nothing beside it does not outrank the lead', r && String(r.num) === '2300' && r.offEra === true, r && JSON.stringify({ num: r.num, offEra: r.offEra, family: r.dbg && r.dbg.family }));
}

section('E. THE OFFENDER: the old ordering, require red');
{
  const src = grab(SRC, 'function _numberFromText(text, prefer)');
  const a = src.indexOf('      var _famAmb = _pinReadFamily(uniq, prefer, UP, dbg);');
  const b = src.indexOf('      if (_offLead) {\n        dbg.offEraLead = _offLead;');
  ok('the family-first block is where the test expects it', a > 0 && b > a, [a, b].join(','));
  const old = src.slice(0, a) + src.slice(b);
  const r = build({ readerSource: old })(RAW, PW);
  ok('OFFENDER: with the family question skipped, Brad\'s car is the oil-drum loader again -> A red', r && String(r.num) === '2300' && r.offEra === true, r && JSON.stringify({ num: r.num, offEra: r.offEra }));
}

section('F. One helper, two askers');
{
  const code = SRC.replace(/\/\/[^\n]*/g, '');
  ok('the v1448 family question lives in ONE function', (code.match(/function _pinReadFamily\(uniq, prefer, UP, dbg\)/g) || []).length === 1);
  ok('…asked from both places: the ambiguous-windows branch and the end of the direct path', (code.match(/= _pinReadFamily\(uniq, prefer, UP, dbg\)/g) || []).length === 2, String((code.match(/= _pinReadFamily\(uniq, prefer, UP, dbg\)/g) || []).length));
  ok('…and the old inline copy is gone (the candidate walk exists once, inside the helper)', (code.match(/var _famHits = \[\];/g) || []).length === 1);
  ok('the disclosure names the outranked lead', /The family is in this catalog, so it outranks /.test(SRC));
}

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
