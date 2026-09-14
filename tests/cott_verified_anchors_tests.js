// ═══════════════════════════════════════════════════════════════
// cott_verified_anchors_tests.js — v0.9.1741.
//
// Session 97 finding, fixed 2026-09-14: 28 of the 122 Alco rows deep-linked
// to anchors that do not exist on COTT's later-Alcos page. The base builder
// keeps a dummy 'D' / trailer 'T' in the anchor, but COTT files the dummy
// in the powered unit's section (only LAL205D, LAL212T, LAL226D are real),
// so #LAL204T dropped Brad at the top of the page.
//
// The v1741 layer carries the page's COMPLETE id list, read off the live
// page, and swaps a provably dead anchor for its sibling spelling: T<->D,
// then the shared base, then base+AA for a dummy A / base+AB for a B unit.
// These pins hold the 28 rows exactly as they sit in the master (number,
// variation, no stored anchor) — 24 move onto a real section, 4 stay put —
// AND hold that nothing else moves: every real anchor on the page, every
// v1721/v1722 outcome, and every non-verified page resolve as before.
//
// Run:  node tests/cott_verified_anchors_tests.js
// ═══════════════════════════════════════════════════════════════
const path = require('path');
global.window = {};
require(path.join(__dirname, '..', 'app', 'cott-anchors.js'));

const ALCO = 'https://cornucopiaoftoytrains.com/motive-power-later-alcos-a-2/';
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
function anchor(ref, itemNum, row, variation) {
  const u = window.cottAnchorUrl(ref, itemNum, window.cottRowWords(row || {}), variation);
  return (String(u).split('#')[1] || 'TOP');
}
const REAL = new Set(window.COTT_VERIFIED_ANCHORS['motive-power-later-alcos-a-2'].ids);

section('The verified list is the live page, not a guess');
ok('the Alco page is listed with a harvest date', /^\d{4}-\d{2}-\d{2}$/.test(window.COTT_VERIFIED_ANCHORS['motive-power-later-alcos-a-2'].on));
ok('42 ids, as read off the page on 2026-09-14', REAL.size === 42, String(REAL.size));
ok('the three real dummy sections are on it', REAL.has('LAL205D') && REAL.has('LAL212T') && REAL.has('LAL226D'));
ok('…and the dead ones are not', !REAL.has('LAL204T') && !REAL.has('LAL218T') && !REAL.has('LAL218'));

// ── the 28 rows, exactly as the master holds them (blank = no variation) ──
section("The 28 dead links — Brad's real rows");
const ROWS = [
  ['2041T', '1', 'LAL2041'], ['2041T', '2', 'LAL2041'], ['2041T', '3', 'LAL2041'],
  ['204T', '1', 'LAL204'], ['204T', '', 'LAL204'],
  ['205T', '1', 'LAL205D'], ['205T', '2', 'LAL205D'],
  ['208T', '1', 'LAL208'], ['208T', '', 'LAL208'],
  ['209T', '1', 'LAL209'], ['209T', '', 'LAL209'],
  ['210T', '1', 'LAL210'], ['210T', '', 'LAL210'],
  ['211T', '1', 'LAL211'], ['211T', '2', 'LAL211'],
  ['218T', '1', 'LAL218AA'], ['218T', '2', 'LAL218AA'], ['218T', '3', 'LAL218AA'], ['218T', '', 'LAL218AA'],
  ['219T', '1', 'LAL219'],
  ['220T', '1', 'LAL220'], ['220T', '2', 'LAL220'], ['220T', '', 'LAL220'],
  ['218C', '', 'LAL218AB'],
  // the four that no link rule can place
  ['2203B', '1', 'LAL2203B'], ['2203T', '1', 'LAL2203T'], ['2224W', '1', 'LAL2224W'], ['218', '', 'LAL218'],
];
let moved = 0;
ROWS.forEach(([num, v, want]) => {
  const got = anchor(ALCO, num, { roadName: '', itemType: 'A Unit Dummy' }, v);
  ok(num + (v ? ' var ' + v : ' (no variation)') + ' -> ' + want, got === want, 'got ' + got);
  if (REAL.has(got)) moved++;
});
ok('24 of the 28 now land on a real section', moved === 24, String(moved));
ok('the four that are not on the page keep their old anchor (no invented section)',
   anchor(ALCO, '2203B', null, '1') === 'LAL2203B' && anchor(ALCO, '2224W', null, '1') === 'LAL2224W' && anchor(ALCO, '218', null, '') === 'LAL218');

// ── the order of the sibling spellings ───────────────────────────────────
section('Sibling order: T<->D first, then the shared base, then the pair');
ok('205T prefers the REAL dummy section LAL205D over the shared LAL205', anchor(ALCO, '205T', null, '1') === 'LAL205D');
ok('205-D (app spelling) also reaches LAL205D — real already, untouched', anchor(ALCO, '205-D', null, '1') === 'LAL205D');
ok('212-T stays on LAL212T (real, untouched)', anchor(ALCO, '212-T', null, '') === 'LAL212T');
ok('226-D stays on LAL226D (real, untouched)', anchor(ALCO, '226-D', null, '') === 'LAL226D');
ok('204T has no D section, so it takes the shared base LAL204', anchor(ALCO, '204T', null, '1') === 'LAL204');
ok('218T: no D, no base — a dummy A rides in the AA pair', anchor(ALCO, '218T', null, '2') === 'LAL218AA');
ok('218C: the B unit rides in the AB pair', anchor(ALCO, '218C', null, '') === 'LAL218AB');
ok('a dummy never gets the AB pair and a B unit never gets the AA pair',
   anchor(ALCO, '218T', null, '2') !== 'LAL218AB' && anchor(ALCO, '218C', null, '') !== 'LAL218AA');
ok("Brad's hand-picked 218 var 1 / 218C var 1 still answer first (v1322)",
   anchor(ALCO, '218', null, '1') === 'LAL218AA' && anchor(ALCO, '218C', null, '1') === 'LAL218AB');

// ── narrowness ───────────────────────────────────────────────────────────
section('Nothing that worked has moved');
const POWERED = ['202','204','205','208','209','210','211','212','213','215','216','217','219','220','221','222','223','224','225','226','227','228','229','230','231','232','1055','1065','1066','2024','2041'];
let same = 0;
POWERED.forEach(n => {
  const a = anchor(ALCO, n, null, '');
  const b = anchor(ALCO, n + '-P', null, '');
  if (a === 'LAL' + n && b === 'LAL' + n) same++;
});
ok('every powered unit (bare and -P) still lands on its own section: ' + POWERED.length + ' of ' + POWERED.length, same === POWERED.length, String(same));
ok('v1721: the Santa Fe 212 still goes to LAL212SF by road name',
   anchor(ALCO, '212', { roadName: 'Santa Fe', itemType: 'A Unit Powered' }, '3') === 'LAL212SF');
ok('v1722: a stored anchor that is REAL on the page is left alone',
   anchor(ALCO + '#LAL212', '212', null, '') === 'LAL212');
ok('a stored anchor that is DEAD on the page is repaired too (dead is dead, however it got there)',
   anchor(ALCO + '#LAL204T', '204T', null, '1') === 'LAL204');
ok('a stored anchor we cannot repair is returned untouched',
   anchor(ALCO + '#LAL2203B', '2203B', null, '1') === 'LAL2203B');
// pages without a verified list are never touched, even with a T suffix
const EARLY = 'https://cornucopiaoftoytrains.com/motive-power-early-alcos/';
const before = anchor(EARLY, '2032T', null, '1');
ok('a motive-power page WITHOUT a verified list resolves exactly as before (' + before + ')', /T$|TOP/.test(before));
const BOX = 'https://cornucopiaoftoytrains.com/boxcars-small-with-non-operating-doors/';
ok('a freight page is untouched: 6050 var 7 is still the Savings Bank', anchor(BOX, '6050', { roadName: 'Lionel Savings Bank', itemType: 'Boxcar' }, '7') === 'sdbx6050lio');
ok('a non-COTT link passes straight through', window.cottAnchorUrl('https://example.com/x', '204T', '', '1') === 'https://example.com/x');
ok('no link at all is still an empty string', window.cottAnchorUrl('', '204T', '', '1') === '');

// ── the list can only shrink the blast radius ────────────────────────────
section('Guards');
const src = require('fs').readFileSync(path.join(__dirname, '..', 'app', 'cott-anchors.js'), 'utf8');
ok('only a page in VERIFIED is touched', /hasOwnProperty\.call\(VERIFIED, slug\)\) return url;/.test(src));
ok('only a motive-power page (the letter rules are locomotive rules)', /if \(slug\.indexOf\('motive-power'\) !== 0\) return url;/.test(src));
ok('a real anchor returns before any swap is tried', /if \(ids\[anchor\]\) return url;\s*\/\/ real/.test(src));
ok('a sibling is used only if it is ON the list', /ids\[prefix \+ tries\[t\]\]\) return head/.test(src));
ok('the unit letter is read from the item number, not the already-stripped anchor', /var rawNum = String\(itemNum == null \? '' : itemNum\)/.test(src));
ok('the re-harvest one-liner is in the file for next time', /querySelectorAll\('\[id\]'\)/.test(src));

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
