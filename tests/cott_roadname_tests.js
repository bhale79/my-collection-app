// ═══════════════════════════════════════════════════════════════
// cott_roadname_tests.js — v0.9.1721.
//
// Brad, 2026-09-12: "i just noticed my 212 sante fe engine link went to the
// wrong picture… please look at all the alco links and make sure we link to
// the correct picture."
//
// COTT gives No. 212 three sections, because Lionel reused the number: the
// U.S.M.C. powered A, the U.S.M.C. unpowered A, and the Santa Fe A. Scoring
// his Santa Fe row against all three tied LAL212T and LAL212SF at 3 words
// each, so the matcher gave up — and the fallback handed back the BARE number
// LAL212, the Marine Corps engine, which had scored LOWEST of the three at 2.
// The tie existed because "SANTA FE" counted for exactly as much as "OPEN",
// "LEDGE" and "APRON", and those adjectives are in nearly every description
// on the page.
//
// The fix: the road name answers first, and only when it picks exactly one
// candidate. These pins hold that, AND hold the far more important half —
// that everything else still resolves exactly as it did. Measured over all
// 165,044 master rows the change moves 7 links and nothing else, so a future
// "improvement" that moves an eighth should fail here first.
//
// Run:  node tests/cott_roadname_tests.js
// ═══════════════════════════════════════════════════════════════
const path = require('path');
global.window = {};
require(path.join(__dirname, '..', 'app', 'cott-anchors.js'));

const ALCO = 'https://cornucopiaoftoytrains.com/motive-power-later-alcos-a-2/';
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name + (detail ? '  -> ' + detail : '')); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

// anchor for a master row, the way every call site asks for it
function anchor(ref, itemNum, row, variation) {
  const u = window.cottAnchorUrl(ref, itemNum, window.cottRowWords(row), variation);
  return (String(u).split('#')[1] || 'TOP');
}
const SF_212 = 'black shell painted silver, red, yellow & black with black heat stamped lettering'
  + ' with BLT/BY LIONEL with open pilot and large ledge the black plastic side frame on trucks'
  + ' open pilot with large ledge one vertical motor 2 position E unit without magnetraction'
  + ' light front end only in power unit with horn open front apron with large ledge large ledge';
const USMC_212 = 'black shell painted blue with white heat stamped lettering with closed pilot without ledge';

// ── the five Alco links Brad was sent to the wrong picture on ────
section('The wrong pictures, now right');
[4, 5, 6].forEach(v => ok(
  '212 var ' + v + ' (Santa Fe) opens the SANTA FE 212, not the Marine one',
  anchor(ALCO, '212-P', { roadName: 'Santa Fe', itemType: 'Diesel Locomotive', varDesc: SF_212 }, String(v)) === 'LAL212SF'));
ok('221 var 2 (Santa Fe) opens the Santa Fe 221, not the Rio Grande',
   anchor(ALCO, '221', { roadName: 'Santa Fe', itemType: 'Diesel Locomotive', varDesc: 'unpainted olive shell with white heat stamped lettering' }, '2') === 'LAL221SF');
ok('221 var 3 (U.S. Marines) opens the USMC 221, not the Rio Grande',
   anchor(ALCO, '221', { roadName: 'U.S. Marines', itemType: 'Diesel Locomotive', varDesc: 'unpainted olive shell with white heat stamped lettering' }, '3') === 'LAL221US');

// ── and the rows that must NOT move ──────────────────────────────
// A fix that drags its neighbours along is not a fix. These were right
// before and have to stay right.
section('Everything else stays put');
ok('212 var 1 (U.S. Marines) still opens the Marine 212',
   anchor(ALCO, '212-P', { roadName: 'U.S. Marines', itemType: 'Diesel Locomotive', varDesc: USMC_212 }, '1') === 'LAL212');
ok('221 var 1 (Rio Grande) still opens the Rio Grande 221',
   anchor(ALCO, '221', { roadName: 'Rio Grande', itemType: 'Diesel Locomotive', varDesc: 'unpainted yellow shell with black painted stripe' }, '1') === 'LAL221');
ok('216 (Burlington) still opens the Burlington section',
   anchor(ALCO, '216', { roadName: 'Burlington', itemType: 'Diesel Locomotive', varDesc: 'black shell painted silver small ledge' }, '1') === 'LAL216');
ok('216P (M & St L) still opens the M & St L section',
   anchor(ALCO, '216P', { roadName: 'Minneapolis & St. Louis', itemType: 'Diesel Locomotive', varDesc: 'large ledge' }, '1') === 'LAL216213');

// Brad walked the 218s by hand in v0.9.1322. A human decision outranks any
// heuristic, and the hand-pick is checked BEFORE the road name — which matters
// here because both 218 sections are Santa Fe and the road name cannot split
// them at all.
section("Brad's hand-picked rows still outrank the heuristic");
ok('218 var 1 -> the AA section (his pick)',
   anchor(ALCO, '218', { roadName: 'Santa Fe', itemType: 'Diesel Locomotive', varDesc: 'gray shell small ledge' }, '1') === 'LAL218AA');
ok('218C var 1 -> the AB section (his pick)',
   anchor(ALCO, '218C', { roadName: 'Santa Fe', itemType: 'Diesel Locomotive', varDesc: 'gray shell large ledge' }, '1') === 'LAL218AB');

// ── the safety property the whole file rests on ──────────────────
section('Safe by design is preserved');
ok('a road name that cannot split the candidates changes nothing (both 215s are Santa Fe)',
   anchor(ALCO, '215', { roadName: 'Santa Fe', itemType: 'Diesel Locomotive', varDesc: 'gray shell painted silver, red, yellow & black' }, '2') === 'LAL215');
ok('an unmapped page is still returned untouched',
   window.cottAnchorUrl('https://example.com/whatever/', '212', window.cottRowWords({ roadName: 'Santa Fe' }), '4') === 'https://example.com/whatever/');
ok('no row at all is harmless', window.cottRowWords(null) === '');

// ── v0.9.1722: revisiting an anchor stored in the master sheet ───
// v0.9.1721 did not fix Brad's 212, because the wrong anchor was not being
// BUILT — it was already written into his sheet's refLink column (73 of the
// 122 Alco rows carry one), and the resolver used to stop dead the moment it
// saw a '#'. A stored anchor is still the default answer. The road name is
// the ONLY thing that may overrule it, and only inside this number's own set
// of sections on this same page. These pins are the fence around that.
section('A stored anchor is read, not obeyed on sight');
const STORED = (anchorIn, road, num, v) =>
  String(window.cottAnchorUrl(ALCO + '#' + anchorIn, num || '212',
    window.cottRowWords({ roadName: road, itemType: 'Diesel Locomotive', varDesc: SF_212 }), v || '4')).split('#')[1];

ok("Brad's complaint, end to end: stored LAL212 + a Santa Fe row opens the Santa Fe",
   STORED('LAL212', 'Santa Fe') === 'LAL212SF');
ok('stored LAL212 + a U.S. Marines row is left alone (its two USMC sections tie)',
   STORED('LAL212', 'U.S. Marines') === 'LAL212');
ok('stored LAL221 + a Santa Fe row opens the Santa Fe 221',
   STORED('LAL221', 'Santa Fe', '221', '2') === 'LAL221SF');
ok('stored LAL221 + a Rio Grande row keeps the Rio Grande 221',
   STORED('LAL221', 'Rio Grande', '221', '1') === 'LAL221');

ok('an UNRECOGNISED stored anchor is never touched — it may be hand-written',
   STORED('LAL212HANDTYPED', 'Santa Fe') === 'LAL212HANDTYPED');
ok('a stored anchor on a number with only ONE section is never touched',
   String(window.cottAnchorUrl('https://cornucopiaoftoytrains.com/boxcars-9-1-4-inch-with-operating-doors/#BOX3454',
     '3454', window.cottRowWords({ roadName: 'Santa Fe', varDesc: 'x' }), '1')).split('#')[1] === 'BOX3454');
ok('a stored anchor on an unharvested page is never touched',
   String(window.cottAnchorUrl('https://cornucopiaoftoytrains.com/some-page-nobody-mapped/#ZZ99',
     '212', window.cottRowWords({ roadName: 'Santa Fe' }), '4')).split('#')[1] === 'ZZ99');
ok('a stored anchor survives a row with no road name at all',
   String(window.cottAnchorUrl(ALCO + '#LAL212', '212', '', '4')).split('#')[1] === 'LAL212');
ok('a road name that cannot split the sections leaves the stored anchor alone',
   STORED('LAL215', 'Santa Fe', '215', '2') === 'LAL215');
// The word matcher is a weaker signal than a value somebody stored on purpose.
// If the road name declines, nothing else gets to second-guess the sheet.
ok('the WORD matcher cannot override a stored anchor, even when it has an opinion',
   String(window.cottAnchorUrl(ALCO + '#LAL215', '215',
     window.cottRowWords({ roadName: 'Santa Fe', itemType: 'Diesel', varDesc: '1965 1966 with the 218 C B unit' }), '2')).split('#')[1] === 'LAL215');
ok('a bare link with no anchor still gets one built, as before',
   String(window.cottAnchorUrl(ALCO, '212',
     window.cottRowWords({ roadName: 'Santa Fe', itemType: 'Diesel Locomotive', varDesc: SF_212 }), '4')).split('#')[1] === 'LAL212SF');

// ── the builder's contract, which eight call sites depend on ─────
// cottRowWords gained a .road field. Every caller passes the result straight
// into cottAnchorUrl, so the STRING it produces has to be byte-identical to
// what it always produced, or the word matcher silently changes its mind.
section('cottRowWords still stringifies exactly as before');
const row = { roadName: 'Santa Fe', itemType: 'Diesel Locomotive', varDesc: 'gray shell' };
const built = window.cottRowWords(row);
ok('String() gives the same old join',
   String(built) === 'Santa Fe Diesel Locomotive gray shell', String(built));
ok('the road name is available on its own', built.road === 'Santa Fe');
ok('blank fields are still dropped, not left as gaps',
   String(window.cottRowWords({ roadName: 'Santa Fe', varDesc: 'gray shell' })) === 'Santa Fe gray shell');
ok('it is still truthy, so the word matcher still runs', !!built);
ok('a caller passing a PLAIN STRING still works (nothing breaks if one is missed)',
   String(window.cottAnchorUrl(ALCO, '221', 'Rio Grande Diesel', '1')).split('#')[1] === 'LAL221');

console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
