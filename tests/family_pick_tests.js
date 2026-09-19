// ════════════════════════════════════════════════════════════════════════
// family_pick_tests.js — v0.9.1772
//
// "A tie is not no-idea."
//
// Brad's Great Northern boxcar, 2026-09-19. The car is stamped G.N. 6464. His
// catalog has ZERO bare 6464 rows (0 of 164,820 — measured against the live
// catalog, not assumed) and 196 dashed variations, so the number printed on the
// model resolves to nothing. Of those 196, exactly two are Great Northern:
// 6464-25 and 6464-450 — and both are catalogued with the identical road name
// and description, so the word-picker ties and refuses to choose. Refusing is
// right. Throwing away the fact that it had narrowed 35 relatives to 2 was not.
//
// These tests run the REAL _pinFamilyPick, brace-matched out of photo-inbox.js,
// against the REAL identities from Brad's catalog. Section E plants the old
// return and requires the suite to go red.
// ════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'app', 'photo-inbox.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}

function grab(name) {
  const i = SRC.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('could not find ' + name);
  let d = 0; const start = SRC.indexOf('{', i);
  for (let k = start; k < SRC.length; k++) {
    if (SRC[k] === '{') d++;
    else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); }
  }
  throw new Error('unbalanced braces in ' + name);
}
function grabVar(name) {
  const i = SRC.indexOf('var ' + name + ' = {');
  if (i < 0) throw new Error('could not find var ' + name);
  const end = SRC.indexOf('};', i);
  return SRC.slice(i, end + 2);
}

// The real rows out of Brad's catalog, as measured in the live app.
const CATALOG = {
  '6464-25':  [{ roadName: 'Great Northern', description: 'Great Northern Boxcar', _era: 'pw' }],
  '6464-450': [{ roadName: 'Great Northern', description: 'Great Northern Boxcar', _era: 'pw' }],
  '6464-525': [{ roadName: 'Minneapolis & St. Louis', description: 'Minneapolis & St. Louis Boxcar', _era: 'pw' }],
  '6464-1':   [{ roadName: 'Western Pacific', description: 'Western Pacific Boxcar', _era: 'pw' }],
  '6464-100': [{ roadName: 'Western Pacific', description: 'Western Pacific Boxcar (feather)', _era: 'pw' }],
  // the BOX row — demoted, must never be a candidate identity
  '6464-900': [{ roadName: '', description: 'Great Northern Boxcar, 14', _era: 'pw', _box: true }]
};

function build(opts) {
  opts = opts || {};
  const env = { catalog: opts.catalog || CATALOG };
  const pre = `
    var __env = __ENV__;
    var window = { rrDemotedRow: function (r) { return !!(r && r._box); } };
    function rrDashedKin(c) { return Object.keys(__env.catalog).filter(function (k) { return k.indexOf(c + '-') === 0; }); }
    function _pinKinRowsFor(k) { return __env.catalog[k] || []; }
    function _prefEras() { return ['pw']; }
  `;
  let src = opts.pickSource || grab('_pinFamilyPick');
  const body = pre + grabVar('_FAM_STOPWORDS') + '\n' + src + '\n return _pinFamilyPick;';
  return new Function('__ENV__', body)(env);
}

const pick = build();
// What the reader actually has: the text lifted off Brad's car.
const CAR = 'GREAT NORTHERN G.N. 6464 CAPY 100000 LD LMT 125400 LT WT 45600 NEW 5-53 BLT BY LIONEL CU FT 3727';

console.log('\n== A. Brad\'s Great Northern: narrowed to two, not thirty-five ==');
{
  const r = pick('6464', null, CAR);
  ok('it refuses to pick one of two identical identities',
     r && String(r.num) === '6464', r && r.num);
  ok('…but hands back the two that tied',
     r && Array.isArray(r.tied) && r.tied.length === 2
       && r.tied.indexOf('6464-25') >= 0 && r.tied.indexOf('6464-450') >= 0,
     r && JSON.stringify(r.tied));
  ok('…and says which words did the narrowing',
     r && /GREAT|NORTHERN/.test(String(r.tiedWhy || '')), r && r.tiedWhy);
  ok('…and the Minneapolis & St. Louis car is NOT among them',
     r && r.tied.indexOf('6464-525') < 0, r && JSON.stringify(r.tied));
  ok('…and neither is the BOX row', r && r.tied.indexOf('6464-900') < 0);
}

console.log('\n== B. A clear winner is still picked outright ==');
{
  const r = pick('6464', null, 'WESTERN PACIFIC W.P. 6464 RIDES LIKE A FEATHER');
  ok('one identity beating the rest still wins',
     r && (String(r.num) === '6464-1' || String(r.num) === '6464-100'), r && r.num);
  ok('…and names its evidence', r && /WESTERN|PACIFIC|FEATHER/.test(String(r.why || '')), r && r.why);
  ok('…and does not report a tie', r && !r.tied);
}

console.log('\n== C. Nothing learned stays nothing learned ==');
{
  const r = pick('6464', null, 'SOME COMPLETELY UNRELATED WORDS ABOUT NOTHING');
  ok('no word evidence gives the bare head, exactly as before',
     r && String(r.num) === '6464' && !r.tied, r && JSON.stringify(r));

  // Every member scoring the same is not a narrowing — it is the whole family.
  // (a four-digit base: _pinFamilyPick refuses anything shorter as
  // coincidence bait, which section D covers separately)
  const allSame = {
    '7000-1': [{ roadName: 'Same Road', description: 'Same Boxcar', _era: 'pw' }],
    '7000-2': [{ roadName: 'Same Road', description: 'Same Boxcar', _era: 'pw' }]
  };
  const r2 = build({ catalog: allSame })('7000', null, 'SAME ROAD SAME BOXCAR');
  ok('a tie across the WHOLE family is not offered as a narrowing',
     r2 && !r2.tied, r2 && JSON.stringify(r2.tied));
}

console.log('\n== D. The guards that keep it narrow ==');
{
  ok('a number that is already specific is left alone', pick('6464-25', null, CAR) === null);
  ok('a three-digit base is refused as coincidence bait', pick('646', null, CAR) === null);
  ok('a number with no family at all returns nothing', pick('9999', null, CAR) === null);
}

console.log('\n== E. THE OFFENDER: restore the old return, require red ==');
{
  // Before v0.9.1772 the tie fell straight through to the bare head with no
  // `tied`. Put that back and section A's narrowing MUST fail.
  const oldSrc = grab('_pinFamilyPick').replace(/if \(bestN >= 1\) \{/, 'if (false) {');
  const r = build({ pickSource: oldSrc })('6464', null, CAR);
  ok('with the old rule restored the two Great Northerns are lost (so this suite can fail)',
     r && String(r.num) === '6464' && !r.tied,
     r ? JSON.stringify(r) : 'null');
}

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
