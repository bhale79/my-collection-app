#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// ANSWER-MOLD TESTS — v0.9.1912 (Brad's "issue 4", 2026-10-10)
// Google Lens answered "The item in the image is a Lionel 6343 Barrel Ramp
// Flat Car …" and later "The red flatcar body uses mold #6424-11 … the same
// ramp piece used for the Lionel 342 Culvert Loader." The app took 6424-11
// (a MOLD number — no catalog row) because the number picker ranks a dashed
// number above a plain one, and the v0.9.1502 lead rule only ran when the
// picker found NOTHING. Research said "Not in our catalog yet"; 6343 is in it.
//
// The rule now lives in ONE place: extractIdentifyMetadata asks
// rrAnswerLeadNumber BEFORE the whole-text picker. Every reader of a Google
// or photo-reader answer (Research, Add, Photo Inbox) goes through it.
// Also: the lead keeps the WHOLE number (6464-325, 20-3132-1, 2431470), and a
// number right after "mold" is a side mention, never the item.
//
// The real functions are lifted from app/wizard-photos.js and run here.
// Run from repo root:  node tests/answer_mold_tests.js   (exit 1 = regression)
// ═══════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const WP = fs.readFileSync(path.join(__dirname, '..', 'app', 'wizard-photos.js'), 'utf8');

function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('missing function ' + name);
  let d = 0;
  const j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); }
  }
  throw new Error('unbalanced ' + name);
}

// Build the real reader from a given copy of the source (so a planted copy
// can be built the same way and must FAIL).
function build(src) {
  const a = src.indexOf('const _IDENTIFY_ROAD_NAMES');
  const b = src.indexOf('function extractIdentifyMetadata(');
  if (a < 0 || b < 0 || b < a) throw new Error('reader layout changed — update the harness');
  const prelude = src.slice(a, b).replace(/^const /gm, 'var ');
  const names = ['_identifySanitize', 'rrSliceAiOverview', 'rrAnswerLeadNumber', 'extractLionelNumber',
                 '_extractLabeledFields', '_hasHedge', 'extractIdentifyMetadata'];
  const body = prelude + '\n' + names.map(n => grab(src, n)).join('\n')
    + '\nreturn { extractIdentifyMetadata, rrAnswerLeadNumber, extractLionelNumber, rrSliceAiOverview };';
  // eslint-disable-next-line no-new-func
  return (new Function('window', body))({});
}

let pass = 0, fail = 0;
function T(name, got, want) {
  const ok = got === want;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + '  -> ' + JSON.stringify(got) + (ok ? '' : '  (wanted ' + JSON.stringify(want) + ')'));
  ok ? pass++ : fail++;
}

// Brad's real answer (Google Lens, 2026-10-10), as the copy button gives it.
const LENS_6343 = String.raw`AI Overview
The item in the image is a Lionel 6343 Barrel Ramp Flat Car, an O gauge model train car produced during Lionel's classic postwar era. [1, 2]
History and Features

* Production Years: It was manufactured briefly from 1961 to 1962. [1, 2]
* Design Background: This was a whimsical, non-prototype freight car created by Lionel designers to minimize research and development costs by reusing existing inventory. The red flatcar body uses mold #6424-11, while the gray superstructure is actually the exact same ramp piece used for the Lionel 342 Culvert Loader. [1, 2]
`;

function itemOf(R, txt) { return (R.extractIdentifyMetadata(R.rrSliceAiOverview(txt)) || {}).itemNum; }

const R = build(WP);

console.log('\n── A. Brad\'s answer: the car, not the mold ──');
T('A1 Lens 6343 answer -> 6343', itemOf(R, LENS_6343), '6343');
T('A2 the lead itself names 6343', R.rrAnswerLeadNumber(R.rrSliceAiOverview(LENS_6343)), '6343');
const meta = R.extractIdentifyMetadata(R.rrSliceAiOverview(LENS_6343));
T('A3 year still read (1961)', meta.year, '1961');
T('A4 maker still Lionel', meta.manufacturer, 'Lionel');

console.log('\n── B. the lead keeps the WHOLE number ──');
T('B1 postwar variation 6464-325', R.rrAnswerLeadNumber('This is a Lionel 6464-325 Sentinel boxcar from 1956. It was made one year.'), '6464-325');
T('B2 MTH three-part 20-3132-1', R.rrAnswerLeadNumber('This is an MTH 20-3132-1 Premier SD70 diesel. It runs on O gauge track.'), '20-3132-1');
T('B3 MTH five-digit 30-11012', R.rrAnswerLeadNumber('This is an MTH 30-11012 RailKing tank car. It is O gauge.'), '30-11012');
T('B4 Lionel modern 6-30135', R.rrAnswerLeadNumber('The item is Lionel No. 6-30135 starter set. It was sold in 2004.'), '6-30135');
T('B5 Lionel 7-digit 2431470', R.rrAnswerLeadNumber('This is a Lionel 2431470 Polar Express set. It is O gauge.'), '2431470');
T('B6 plain postwar 2343 still', R.rrAnswerLeadNumber('This is a Lionel No. 2343 Santa Fe F3. It was made 1950-52.'), '2343');
T('B7 letter suffix 2046W still', R.rrAnswerLeadNumber('This is a Lionel 2046W whistle tender. It came with the 2046.'), '2046W');
T('B8 full answer 6464-325 -> 6464-325', itemOf(R, 'AI Overview\nThis is a Lionel 6464-325 Sentinel boxcar from 1956. Only one year. The B&O 6464-275 is a different car.'), '6464-325');

console.log('\n── C. hedges and years still refuse ──');
T('C1 hedged lead -> no lead number', R.rrAnswerLeadNumber('This could be a Lionel 2333 or 2344 F3. Both look alike.'), '');
T('C2 enumerated lead -> no lead number', R.rrAnswerLeadNumber('This is a Lionel 2333, 2344, or 2354 series F3. They share a body.'), '');
T('C3 a bare year is not an answer', R.rrAnswerLeadNumber('This is a Lionel No. 1955 catalog. It is paper.'), '');

console.log('\n── D. a labelled number still beats the lead ──');
T('D1 "Item Number:" label wins', itemOf(R, 'Lionel 6343 Barrel Ramp Car is pictured.\nItem Number: 6343\nNotes: body mold 6424-11'), '6343');
T('D2 label naming a different number wins over the lead', itemOf(R, 'This looks like a Lionel 2343 F3 diesel.\nCatalog Number: 2353'), '2353');

console.log('\n── E. no number in the lead: a MOLD number is a side mention ──');
const NO_LEAD = 'History: the body came from mold #6424-11 and the ramp is shared. Collectors list it as catalog No. 6343, made 1961-62.';
T('E1 picker skips "mold #6424-11" -> 6343', R.extractLionelNumber(NO_LEAD), '6343');
T('E2 "mold number" spelling too', R.extractLionelNumber('Made from mold number 6511-2 for the body. Sold as No. 6409.'), '6409');
T('E3 a dashed number NOT after "mold" still wins on format', R.extractLionelNumber('The boxcar is 6464-325, a 1956 car in the 6464 series.'), '6464-325');

console.log('\n── F. one place: the lead rule lives inside extractIdentifyMetadata ──');
const fnSrc = grab(WP, 'extractIdentifyMetadata');
const leadAt = fnSrc.indexOf('rrAnswerLeadNumber(');
const pickAt = fnSrc.indexOf('extractLionelNumber(raw)');
T('F1 extractIdentifyMetadata asks the lead', leadAt > 0, true);
T('F2 …before the whole-text picker', leadAt > 0 && pickAt > 0 && leadAt < pickAt, true);

console.log('\n── P. planted offenders: each old behaviour must turn this suite red ──');
// P1: the lead call removed from extractIdentifyMetadata (= v0.9.1911) -> 6424-11
const p1Src = WP.replace(/\n  if \(!out\.itemNum && !_hasHedge\(raw\) && typeof rrAnswerLeadNumber === 'function'\) \{\n    const leadNum = rrAnswerLeadNumber\(raw\);\n    if \(leadNum\) out\.itemNum = leadNum;\n  \}/, '');
T('P1 planted: lead call removed -> source changed', p1Src !== WP, true);
// (with the mold rule still in, the picker alone lands on 342 — the Culvert
// Loader the ramp was borrowed from; on v0.9.1911 it was 6424-11. Either way
// not the car: only the lead names the car.)
const p1Got = itemOf(build(p1Src), LENS_6343);
console.log('      planted copy answered ' + JSON.stringify(p1Got));
T('P1 planted: lead call removed -> NOT 6343', p1Got !== '6343', true);
// P2: the mold demotion removed -> the mold number wins again
const p2Src = WP.replace(/\n      if \(\/\\bmold[^\n]*sc -= 25;/, '');
T('P2 planted: mold rule removed -> source changed', p2Src !== WP, true);
T('P2 planted: mold rule removed -> 6424-11 wins', build(p2Src).extractLionelNumber(NO_LEAD), '6424-11');
// P3: the lead's old number pattern (no dashed variation) -> 6464 cut short
const p3Src = WP.replace(/var _NUM = '[^\n]*';/, "var _NUM = '(\\\\d{1,2}-\\\\d{3,5}[A-Z]{0,2}|\\\\d{3,5}[A-Z]{0,2})\\\\b';");
T('P3 planted: old lead pattern -> source changed', p3Src !== WP, true);
T('P3 planted: old lead pattern -> 6464 (variation lost)', build(p3Src).rrAnswerLeadNumber('This is a Lionel 6464-325 Sentinel boxcar from 1956. It was made one year.'), '6464');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
