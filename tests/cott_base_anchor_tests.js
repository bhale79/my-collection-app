// ═══════════════════════════════════════════════════════════════
// cott_base_anchor_tests.js — v0.9.1938.
//
// Brad, 2026-10-13 ("issue 5"): "why does the cott take you the general page
// and not the giraffe car section". Adding a 3376, the "Also catalogued
// separately" row 3376-160 had a COTT button that opened the TOP of
// postwar-cattle-cars-small. Typing #3376 on the end took him to the car.
//
// Cause: COTT gives 3376-160 no id of its own — its write-up sits inside the
// 3376 giraffe-car section (live page ids, read 2026-10-13: 3370 3376 3386
// 3656 3656150 6473 6646 6656). The link builder looked only for "3376160",
// found nothing, and fell back to the page top. It never asked about 3376.
//
// The fix (cott-anchors.js, the deep-link layer): a dashed number with no
// section of its own asks the same questions about its MAIN number, and
// uses that answer only when it really jumps somewhere on the same page.
//
// Measured over every master row with a COTT link (6,520 rows, 2026-10-13):
// exactly 7 links move — all 7 from the page top onto a section that exists
// on the live page (checked one by one) — and no other link changes. They
// are all pinned below, so a later change that moves an eighth fails here.
//
// Run:  node tests/cott_base_anchor_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'app', 'cott-anchors.js'), 'utf8');

function load(src) { const w = {}; new Function('window', src)(w); return w; }
const W = load(SRC);

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name + (detail ? '  -> ' + detail : '')); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

// the anchor a master row gets, the way every call site asks for it
function anchor(w, row) {
  const u = w.cottAnchorUrl(row.refLink, row.itemNum, w.cottRowWords(row), row.variation || '');
  return String(u).indexOf('#') >= 0 ? String(u).split('#')[1] : 'TOP';
}

const C = 'https://cornucopiaoftoytrains.com/';
// Real master rows (Lionel PW - Items / Boxes, read 2026-10-13), trimmed to
// the fields the link builder reads.
const GIRAFFE_160 = { itemNum: '3376-160', variation: '1', roadName: 'Bronx Zoo', itemType: 'Stock Car',
  varDesc: 'unpainted green molded shell with yellow heat stamped lettering\nwith unpainted yellow giraffe with brown spots\nwith molded in brake wheel\nwith two operating early AAR trucks',
  refLink: C + 'postwar-cattle-cars-small/' };
const MOVED = [
  [GIRAFFE_160, '3376'],
  [{ itemNum: '3376-160', variation: '', roadName: '', itemType: 'Paper / Box / Misc', varDesc: '', refLink: C + 'postwar-cattle-cars-small/' }, '3376'],
  [{ itemNum: '164-79', variation: '1', itemType: 'Accessory', varDesc: 'No. 164 – 79 corugated box made by THE HANKINS CONTAINER COMPANY', refLink: C + 'postwar-accessories-no-100-thru-no-199/' }, '164'],
  [{ itemNum: '350-200', variation: '1', itemType: 'Accessory', varDesc: 'ROBERT GAIR corugated box # 350-80\ninstruction No. 350-88 dated 11-57', refLink: C + 'postwar-accessories-no-300-thru-no-399/' }, '350'],
  [{ itemNum: '362-96', variation: '1', itemType: 'Accessory', varDesc: 'No. 362-96 dated 10-52\nForm 1267 Dated 11-52 included with some loaders', refLink: C + 'postwar-accessories-no-300-thru-no-399/' }, '362'],
  [{ itemNum: '456-6', variation: '1', itemType: 'Packet', varDesc: 'no variation', refLink: C + 'packets-accessories/' }, '4565'],
  [{ itemNum: '6560-50', variation: '1', roadName: 'Lionel Lines', itemType: 'Operating Freight',
     varDesc: 'all lettering on frame, red unpainted cab\nunpainted red plastic cab shell with white heat stamped lettering\ncab mounted with 3 slots & tabs\nwith molded in stack',
     refLink: C + 'crane-cars-number-6560/' }, '6560LUP55'],
];

section('Brad\'s giraffe car, and the six others that landed on the page top');
MOVED.forEach(([row, want]) => {
  const got = anchor(W, row);
  ok(row.itemNum + ' (' + (row.itemType || '') + ') opens #' + want, got === want, got);
});

section('Links that must NOT move');
const STAY = [
  // its own section on the page — the full number still wins
  [{ itemNum: '3656-150', variation: '1', itemType: 'Separate Sale', varDesc: 'no variation', refLink: C + 'postwar-cattle-cars-small/' }, '3656150', 'a dashed number with its OWN section keeps it'],
  // a stored anchor is never second-guessed by this step
  [{ itemNum: '3376-118', variation: '1', itemType: 'Packet', varDesc: 'no variation', refLink: C + 'packets-accessories/#APAK3376118' }, 'APAK3376118', 'a stored anchor stays'],
  [{ itemNum: '3376-160', variation: '1', itemType: 'Stock Car', varDesc: '', refLink: C + 'postwar-cattle-cars-small/#HANDPICKED' }, 'HANDPICKED', 'a stored anchor the map never saw stays'],
  // the plain number is unchanged
  [{ itemNum: '3376', variation: '1', roadName: 'Bronx Zoo', itemType: 'Stock Car', varDesc: 'blue', refLink: C + 'postwar-cattle-cars-small/' }, '3376', 'the main number itself'],
  // a page that was never harvested: nothing is known, so nothing is guessed
  [{ itemNum: '6402-25', variation: '1', itemType: 'Freight Car', varDesc: 'no variation', refLink: C + 'postwar-tenders-slope-back/' }, 'TOP', 'a page with no map stays at the top'],
  // modern 6- numbers are never cut at the dash
  [{ itemNum: '6-14270', variation: '', itemType: 'Boxcar', varDesc: '', refLink: C + 'postwar-cattle-cars-small/' }, 'TOP', 'a 6-xxxxx number is not "6" plus a suffix'],
  // the main number is not on this page: stay at the top
  [{ itemNum: '3370-99', variation: '', itemType: 'Packet', varDesc: '', refLink: C + 'packets-accessories/' }, 'TOP', 'a main number that is not on this page'],
];
STAY.forEach(([row, want, why]) => {
  const got = anchor(W, row);
  ok(row.itemNum + ': ' + why + ' (#' + want + ')', got === want, got);
});
ok('a link that is not COTT is returned exactly as it came',
   W.cottAnchorUrl('https://www.lionel.com/products/x', '3376-160', '', '') === 'https://www.lionel.com/products/x');
// a page in the PREFIX map already builds an anchor for any number; this step
// only acts on links that land on the page top, so it never touches these
const FLAT = { itemNum: '6825-99', variation: '', itemType: 'Flatcar', varDesc: '', refLink: C + 'flatcars-10-inch-type-page-1-a/' };
ok('the flatcar page is in the PREFIX map (sanity)', !!(W.COTT_PAGE_PREFIX && 'flatcars-10-inch-type-page-1-a' in W.COTT_PAGE_PREFIX));
ok('a page in the PREFIX map keeps today\'s built anchor',
   anchor(W, FLAT) !== 'TOP' && anchor(W, FLAT) === anchor(load(SRC.replace(/if \(_mn && _mn\[1\] !== norm/, 'if (false && _mn && _mn[1] !== norm')), FLAT), anchor(W, FLAT));

section('PLANTED — the same checks against the code without the fix');
const OFF = 'if (_mn && _mn[1] !== norm';
ok('the fix\'s condition appears exactly once (one copy of the rule)', SRC.split(OFF).length === 2, String(SRC.split(OFF).length - 1));
const OLD = load(SRC.replace(OFF, 'if (false && _mn && _mn[1] !== norm'));
const oldGiraffe = anchor(OLD, GIRAFFE_160);
ok('without the fix, 3376-160 lands on the page top (the bug Brad saw)', oldGiraffe === 'TOP', oldGiraffe);
let oldRight = 0; MOVED.forEach(([row, want]) => { if (anchor(OLD, row) === want) oldRight++; });
ok('without the fix, none of the 7 moved links reach their section', oldRight === 0, oldRight + ' of ' + MOVED.length);
let oldStay = 0; STAY.forEach(([row, want]) => { if (anchor(OLD, row) === want) oldStay++; });
ok('without the fix, every must-not-move link reads the same (the fix touches nothing else)', oldStay === STAY.length, oldStay + ' of ' + STAY.length);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
