// ═══════════════════════════════════════════════════════════════
// cott_added_pages_tests.js — v0.9.1940.
//
// [stated] Brad, 2026-10-13: "yes" — add the COTT pages whose links still
// opened at the page top. After v0.9.1938, 871 of the 6,520 master rows with a
// COTT link opened at the top; 632 of them sat on 115 pages the 2026-08-03
// harvest never read. v0.9.1940 adds those pages (DEEP_ADDED in
// app/cott-anchors.js, built by tools/cott-harvest/) and three fields only
// those entries carry: m and d (stronger evidence before the row's words may
// choose a section) and h (the number's home section, used when they don't).
//
// Measured over all 6,520 rows: 405 links move, every one from the page top
// onto an id read off the live page that day; no other link changes. Checked
// against the 1,107 rows on those pages that already carry a stored anchor:
// the new entries agree or land on the same item's heading for all but 7, and
// in 4 of those 7 the stored anchor is the one that is off by a section.
//
// Run:  node tests/cott_added_pages_tests.js
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
function anchor(w, row) {
  const u = w.cottAnchorUrl(row.refLink, row.itemNum, w.cottRowWords(row), row.variation || '');
  return String(u).indexOf('#') >= 0 ? String(u).split('#')[1] : 'TOP';
}
const C = 'https://cornucopiaoftoytrains.com/';
const P600 = C + 'prewar-o-gauge-tinplate-600-2600-passenger-cars/';
// Real master rows (read 2026-10-13), trimmed to the fields the link builder reads.
const R = {
  gray601:  { itemNum: '601', variation: 'D', itemType: 'Passenger Car', varDesc: 'Passenger Cars in gray (1933-1934). The cars have a dark red roof and "fish belly", cream inserts, brass trim, copper journals, and latch couplers', refLink: P600 },
  bare601:  { itemNum: '601', variation: '', itemType: 'Passenger Car', varDesc: '', refLink: P600 },
  red612:   { itemNum: '612', variation: 'F', itemType: 'Passenger Car', varDesc: 'Light red body, aluminum-painted roof', refLink: C + 'prewar-o-gauge-tinplate-610-612-passenger-cars/' },
  bare254:  { itemNum: '254', variation: '', itemType: 'Electric Locomotive', varDesc: '', refLink: C + 'prewar-no-254-engines/' },
  bb1949:   { itemNum: 'BB-billboards-002', variation: '1', itemType: 'Billboard', varDesc: '1949 ESSANY PRINTING SET', refLink: C + 'postwar-billboards/' },
  bbVar2:   { itemNum: 'BB-billboards-024', variation: '1', itemType: 'Billboard', varDesc: '1953 ESSANY PRINTING SET VARIATION 2', refLink: C + 'postwar-billboards/' },
  b76:      { itemNum: 'EP-blister-packs-003', variation: '1', itemType: 'Ephemera', varDesc: 'No. B76 BOULEVARD STREET LAMPS', refLink: C + 'blister-packs/' },
  box9202:  { itemNum: '920-2', variation: '1', itemType: 'Accessory', varDesc: 'no variation', refLink: C + 'boxes-postwar-box-identification-a/' },
  ttos6176: { itemNum: '6176', variation: '1', roadName: 'Lehigh Valley', itemType: 'Hopper', varDesc: '1967 TTOS Convention Car (No. 6176 Lehigh Valley hopper). Postwar-era club car; see COTT club-cars page.', refLink: C + 'club-cars/' },
  stored600:{ itemNum: '600', variation: 'C', itemType: 'Passenger Car', varDesc: 'Passenger Cars in gray (1933-1934). The cars have a dark red roof', refLink: P600 + '#1' },
  slash616: { itemNum: '616E/W', variation: '', itemType: 'Diesel Locomotive', varDesc: '', refLink: C + 'prewar-o-gauge-tinplate-no-616-no-636-streamlined-locomotives/' },
  giraffe:  { itemNum: '3376-160', variation: '1', roadName: 'Bronx Zoo', itemType: 'Stock Car', varDesc: 'unpainted green molded shell with yellow heat stamped lettering', refLink: C + 'postwar-cattle-cars-small/' },
};

section('Links that used to open at the page top');
[['gray601', '1', 'the row\'s words pick the gray 1933-1934 cars (variation 1 on COTT)'],
 ['bare601', '600S', 'no words: the 600/601/602 heading, whose own title names 601'],
 ['bare254', '1', 'no words: the first 254 section (its heading names 254)'],
 ['bb1949', '49E', 'a number COTT never prints: the heading with the same words'],
 ['b76', 'BPB76', 'a blister pack by its heading'],
 ['box9202', 'BIPROJ', 'a number named in a section\'s text ("No. 920-2 TUNNEL PORTALS")'],
 ['slash616', '616', '"616E/W" finds the 616 heading by its first part'],
].forEach(([k, want, why]) => { const got = anchor(W, R[k]); ok(R[k].itemNum + ': ' + why + ' (#' + want + ')', got === want, got); });

section('Weak or missing evidence never guesses');
ok('612 F "Light red body, aluminum-painted roof": one stray word is not enough — the 610/612 heading, not the dark-green 1925 section',
   anchor(W, R.red612) === '610S', anchor(W, R.red612));
ok('BB-billboards-024 "VARIATION 2": A and B tie — stays at the page top', anchor(W, R.bbVar2) === 'TOP', anchor(W, R.bbVar2));
ok('6176 (TTOS car on club-cars): no heading names 6176 and the words decide nothing — page top, not the first convention list',
   anchor(W, R.ttos6176) === 'TOP', anchor(W, R.ttos6176));
ok('a stored anchor on a newly added page stays exactly as stored', anchor(W, R.stored600) === '1', anchor(W, R.stored600));
ok('v0.9.1938 still holds: 3376-160 opens #3376', anchor(W, R.giraffe) === '3376', anchor(W, R.giraffe));

section('The new fields live only on the new pages');
const D = W.COTT_DEEPLINK_MAP;
const added = (SRC.match(/var DEEP_ADDED = (\{.*\});\n/) || [])[1];
ok('DEEP_ADDED is present and parses', !!added && !!JSON.parse(added));
const A = added ? JSON.parse(added) : {};
let oldWithNew = 0, homeNotListed = 0, n = 0;
Object.keys(D).forEach(slug => {
  const isAdded = Object.prototype.hasOwnProperty.call(A, slug);
  Object.keys(D[slug]).forEach(num => {
    const e = D[slug][num]; n++;
    if (!isAdded && ('m' in e || 'd' in e || 'h' in e)) oldWithNew++;
    if (e.h && !e.a.some(x => x[0] === e.h)) homeNotListed++;
  });
});
ok('no 2026-08-03 entry carries m, d or h (old links resolve exactly as before)', oldWithNew === 0, oldWithNew + ' of ' + n);
ok('every home section is one of its number\'s own sections', homeNotListed === 0, String(homeNotListed));
ok('no added page overwrote a page the 2026-08-03 harvest has', Object.keys(A).every(s => JSON.stringify(D[s]) === JSON.stringify(A[s])));

section('PLANTED — the same checks against the code with each rule taken out');
const GATE = "best >= (rec.m || 1) && best - second >= (rec.d || 1)";
const HOME = "if (rec.h) return base + '/#' + rec.h;";
ok('the evidence gate is written once', SRC.split(GATE).length === 2, String(SRC.split(GATE).length - 1));
ok('the home rule is written once', SRC.split(HOME).length === 2, String(SRC.split(HOME).length - 1));
const noGate = load(SRC.replace(GATE, 'true'));
ok('without the gate, 612 F jumps to the wrong section on one stray word', anchor(noGate, R.red612) !== '610S' && anchor(noGate, R.red612) !== 'TOP', anchor(noGate, R.red612));
const noHome = load(SRC.replace(HOME, ''));
ok('without the home rule, a blank 601 opens at the page top again', anchor(noHome, R.bare601) === 'TOP', anchor(noHome, R.bare601));
const noAdded = load(SRC.replace(/for \(var _dk in DEEP_ADDED\)/, 'for (var _dk in {})'));
ok('without the added pages, the 1949 billboard opens at the page top (the bug)', anchor(noAdded, R.bb1949) === 'TOP', anchor(noAdded, R.bb1949));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
