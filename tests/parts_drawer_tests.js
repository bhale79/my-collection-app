// ═══════════════════════════════════════════════════════════════
// parts_drawer_tests.js — v0.9.1748.
//
// Brad, 2026-09-14, with a traction tire reading "bought — in the drawer"
// on Parts Needed while the Parts Bin said "The bin is empty":
//   "all parts are in the drawer, some are spoken for. if not spoken for,
//    it should show what they fit if possible."
//
// The bin page now shows everything in the drawer in two groups — spoken
// for (Parts Needed rows bought for a train, waiting to be installed) and
// loose spares (the bin) — and each loose part gets a "fits" line worked
// out three ways: the part number (Lionel numbers carry the item), your own
// open wants (the answer that matters), and the catalog's own parts rows.
// Nothing is guessed: when none apply the card says "not known".
//
// The real functions are lifted from maintenance.js and run against a fake
// state, so every rule below is the shipped rule.
// Run:  node tests/parts_drawer_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
const src = fs.readFileSync(path.join(__dirname, '..', 'app', 'maintenance.js'), 'utf8');
const pages = fs.readFileSync(path.join(__dirname, '..', 'app', 'app-pages.js'), 'utf8');
function grab(sig) {
  const i = src.indexOf(sig); if (i < 0) return '';
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  return '';
}
const MASTER = {
  '2343': { itemNum: '2343', roadName: 'Santa Fe', description: 'F3 A-A diesel', itemType: 'Diesel Locomotive' },
  '8632': { itemNum: '8632', roadName: 'Lionel Lines', description: '4-4-2 steam', itemType: 'Steam Locomotive' },
  '18010': { itemNum: '18010', roadName: 'Pennsylvania', description: 'S-2 Turbine', itemType: 'Steam Locomotive' },
  '923 00 010': { itemNum: '923 00 010', itemType: 'Part', description: 'Body-mount coupler for GP35', _era: 'kato_parts' },
};
function make(state) {
  return new Function('state', 'findMaster', 'baseItemNum',
    grab('function _binItemFromPartNum(partNum)') + '\n' + grab('function _binOwnedCopies(itemNum)') + '\n'
    + grab('function _binTopicWords(b)') + '\n' + grab('function _binFits(b)') + '\n' + grab('function _binSpokenFor()')
    + '\nreturn { item: _binItemFromPartNum, fits: _binFits, spoken: _binSpokenFor };')(
    state, n => MASTER[String(n)] || null, n => String(n || '').replace(/[-]?[PDTC]$/i, ''));
}
ok('the drawer functions lift out of maintenance.js', make({}).fits && make({}).item && make({}).spoken);

section('A Lionel part number names its item');
const F = make({});
[['2343-13', '2343'], ['2343-013', '2343'], ['671-104', '671'], ['8632-050', '8632'], ['18010-020', '18010'],
 ['600-8632-050', '8632'], ['6-8632-050', '8632'], [' 2343-13 ', '2343'], ['2343-13A', '2343']].forEach(([pn, want]) =>
  ok(pn.trim() + ' → ' + want, F.item(pn) === want, F.item(pn)));
[['', ''], ['2343', ''], ['E-unit', ''], ['.625 ID x .058', ''], ['84631', ''], ['K-Line 12345', ''], ['12-3456-78', '']].forEach(([pn, want]) =>
  ok((pn || '(blank)') + ' → nothing (no guess)', F.item(pn) === want, F.item(pn)));

section('What a loose part fits — from the number');
let st = { personalData: { i1: { inventoryId: 'i1', itemNum: '2343P', owned: true }, i2: { inventoryId: 'i2', itemNum: '6464', owned: true } }, partsData: {} };
let r = make(st).fits({ id: 'b1', partNum: '2343-13', desc: 'horn hood', qty: 1 });
ok('2343-13 fits 2343 — Santa Fe, and it IS in the collection (2343P matches by base number)', r.length === 1 && r[0].kind === 'number' && r[0].item === '2343' && /Santa Fe/.test(r[0].label) && r[0].owned === 1 && r[0].inv === 'i1', JSON.stringify(r));
r = make(st).fits({ id: 'b2', partNum: '8632-050', desc: 'motor brush plate', qty: 2 });
ok('8632-050 fits 8632 — not in the collection, said plainly', r.length === 1 && r[0].item === '8632' && r[0].owned === 0 && !r[0].inv, JSON.stringify(r));
r = make(st).fits({ id: 'b3', partNum: '', desc: 'assorted screws', qty: 20 });
ok('no number, no topic hit → nothing (the card says "not known")', r.length === 0);

section('What a loose part fits — from your own open wants');
st = { personalData: { i9: { inventoryId: 'i9', itemNum: '84631', owned: true } }, partsData: {
  p3: { row: 3, id: 'part-1', description: 'TRACTION TIRE / .625" ID x .058" TH x .148" WD', partNum: '', forItem: '84631', forInv: 'i9', status: 'wanted' },
  p4: { row: 4, id: 'part-2', description: 'E-unit', partNum: '2343-100', forItem: '2343', forInv: '', status: 'wanted' },
  p5: { row: 5, id: 'part-3', description: 'traction tire', partNum: '', forItem: '2026', forInv: '', status: 'installed' },
} };
r = make(st).fits({ id: 'b4', partNum: '', desc: 'Traction tires, assorted', topics: 'traction tire', qty: 6 });
ok('a bin bag tagged "traction tire" answers the 84631 want by topic — and NOT the installed one', r.length === 1 && r[0].kind === 'want' && r[0].item === '84631' && r[0].how === 'same topic' && r[0].inv === 'i9', JSON.stringify(r));
r = make(st).fits({ id: 'b5', partNum: '2343-100', desc: 'E-unit, 3 position', qty: 1 });
ok('a bin part with the wanted part NUMBER answers by number first, then also fits 2343 by the number', r.length === 2 && r[0].kind === 'want' && r[0].how === 'same part number' && r[0].item === '2343' && r[1].kind === 'number' && r[1].item === '2343', JSON.stringify(r));
r = make(st).fits({ id: 'b9', partNum: '', desc: 'Traction tires, assorted sizes', qty: 6 });
ok('a plural bin bag ("traction tires") still answers the singular want', r.length === 1 && r[0].item === '84631', JSON.stringify(r));
r = make(st).fits({ id: 'b6', partNum: '', desc: 'tire', qty: 1 });
ok('a 4-letter minimum keeps "tire" alone from matching everything (topic words are ≥ 4 chars, and "tire" is one — but the want says "traction tire", so it matches; "oil" would not)', r.length === 1);
r = make(st).fits({ id: 'b7', partNum: '', desc: 'oil', qty: 1 });
ok('…"oil" (3 letters) matches nothing', r.length === 0);

section('What a loose part fits — from the catalog\'s own parts rows');
r = make({ personalData: {}, partsData: {} }).fits({ id: 'b8', partNum: '923 00 010', desc: 'Kato coupler', qty: 4 });
ok('a Kato part number lands on the Kato Parts row and quotes its description', r.length === 1 && r[0].kind === 'catalog' && /GP35/.test(r[0].label) && r[0].era === 'kato_parts', JSON.stringify(r));

section('Spoken for = bought, waiting to be installed');
st = { personalData: {}, partsData: {
  a: { row: 3, status: 'bought', dateBought: '2026-09-05', description: 'tire' },
  b: { row: 4, status: 'wanted', description: 'e-unit' },
  c: { row: 5, status: 'installed', description: 'brushes' },
  d: { row: 6, status: 'bought', dateBought: '2026-09-10', description: 'lamp' },
} };
const sp = make(st).spoken();
ok('only the bought rows, newest first', sp.length === 2 && sp[0].description === 'lamp' && sp[1].description === 'tire', JSON.stringify(sp.map(x => x.description)));

section('The page');
const build = grab('function _binBuild()');
ok('two groups, in this order: spoken for, then loose spares', build.indexOf("H('Spoken for") > 0 && build.indexOf("H('Loose spares") > build.indexOf("H('Spoken for"));
ok('empty drawer says so (and how each group fills)', /The drawer is empty\./.test(build) && /shows here as spoken for/.test(build));
ok('an empty bin under a full spoken-for group says "Nothing loose in the bin"', /Nothing loose in the bin\./.test(build));
ok('every loose card carries its fits line', /_binFitsHtml\(b\)/.test(build));
const spokenHtml = grab('function _binSpokenHtml(p)');
ok('a spoken-for card has the Installed button (same handler as Parts Needed) when the item is in the collection', /markPartInstalled\(' \+ p\.row \+ '\)/.test(spokenHtml) && /pd \?/.test(spokenHtml));
ok('…and its For-link opens the item', /_openOwnedByInvId/.test(spokenHtml));
ok('the "not known" line never guesses', /Fits: not known/.test(grab('function _binFitsHtml(b)')));
ok('"Use it for …" pulls one from the bin AND marks the want bought (the Parts page stamp, reused)', /window\._maintBinUseFor = async function/.test(src) && /markPartBought\(partRow\)/.test(src));
ok('marking bought or installed on the Parts page re-renders the drawer if it is open', (pages.match(/document\.getElementById\('page-partsbin'\)\) _binBuild\(\)/g) || []).length === 2);
ok('the subtitle says what the page is now', /Everything in the drawer/.test(build));

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
