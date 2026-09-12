// ═══════════════════════════════════════════════════════════════
// microtrains_barcode_tests.js — v0.9.1719.
//
// Two things shipped together on 2026-09-12.
//
// 1. Micro-Trains N, built from the maker's OWN published databases rather
//    than a crawl — 7,277 rows, 1,194 of them carrying a real UPC.
//
// 2. The scanner may now consult the UPC column those barcodes landed in.
//    That is a careful step, because the app has been here before: v1112 let
//    remembered pairings outrank real decoding, one bad save (the 30-7099
//    poisoning) made every later scan of that barcode wrong, and v1465
//    answered by never consulting the learned map during a scan —
//    "recording, not recalling".
//
//    Brad chose the careful version on 2026-09-12: a fresh decode still wins,
//    and the catalog column only answers where the decode found nothing. The
//    pins below exist so nobody later "simplifies" that ordering away and
//    walks back into the trap.
//
// Run:  node tests/microtrains_barcode_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const rd = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
const cfg = rd('config.js');
const bc = rd('barcode.js');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name + (detail ? '  -> ' + detail : '')); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

// ── 1. the era is wired in all four places ──────────────────────
// A maker era that is missing any one of these loads as a broken tab: the
// dropdown offers it, the sheet read asks for it, or the scale filter drops it.
section('Micro-Trains N is a complete era');
const eraLine = /microtrains_n:\s*\{\s*id:\s*'microtrains_n',\s*label:\s*'Micro-Trains N'[^}]*manufacturer:\s*'Micro-Trains'\s*\}/.test(cfg);
ok('ERAS carries it, labelled and attributed', eraLine);
ok("REAL_ERA_IDS lists it", /REAL_ERA_IDS\s*=\s*\[[^\]]*'microtrains_n'/.test(cfg));
ok("ERA_SCALE says N", /microtrains_n:\s*'N'/.test(cfg));
ok("ERA_TABS points at the master tab", /microtrains_n:\s*\{\s*items:\s*'Micro-Trains N'\s*\}/.test(cfg));
ok('the tab name matches the maker-tab convention (Atlas N, Bachmann N, Kato N)',
   /items:\s*'Micro-Trains N'/.test(cfg) && !/items:\s*'Micro-Trains'\s*\}/.test(cfg));

// ── 2. the scan button appears for it ───────────────────────────
section('The scanner offers itself for the new era');
ok('eraSupportsBarcode lists microtrains_n', /'microtrains_n',/.test(bc.slice(0, bc.indexOf('window.eraSupportsBarcode'))));
ok('…and the pre-UPC Lionel eras are still excluded',
   !/SHOW = \[[^\]]*'pw'/.test(bc) && !/SHOW = \[[^\]]*'prewar'/.test(bc));

// ── 3. the ORDER — this is the one that matters ─────────────────
// The catalog lookup must sit BELOW the decode at every point it is reached.
section('A fresh decode always wins (the v1465 rule)');
const decode = bc.slice(bc.indexOf('async function decodeBarcode'));
const firstHit = decode.indexOf('_catalogUpcHit()');
const lionelFind = decode.indexOf('findMasterItems(parsed.itemNumCandidates');
ok('the Lionel decode is attempted before any catalog-UPC lookup',
   lionelFind > -1 && firstHit > -1 && lionelFind < firstHit);
ok('the Lionel fall-through consults the catalog before offering manual entry',
   /_lionelByUpc = await _catalogUpcHit\(\);\s*\n\s*if \(_lionelByUpc\) return _lionelByUpc;[\s\S]{0,400}?notInMaster: true/.test(decode));
ok('the non-Lionel prefixes consult it before the Phase 2 answer',
   /_otherByUpc = await _catalogUpcHit\(\);\s*\n\s*if \(_otherByUpc\) return _otherByUpc;\s*\n\s*if \(info\)/.test(decode));
ok('a hit is marked, so the picker can say where it came from',
   /byCatalogUpc: true/.test(decode) && /_byCatalogUpc = true/.test(bc));
ok('the learned map is STILL not consulted during a scan (v1465 intact)',
   /Recording, not recalling/.test(bc));

// ── 4. RUN the matcher — pure functions, lifted out and exercised ──
section('The matcher itself');
const from = bc.indexOf('function _upcCandidates');
const to = bc.indexOf('async function findMasterByUpc');
const src = bc.slice(from, to);
// lifted verbatim out of barcode.js so the real code is what runs here
const lifted = new Function(src + '\nreturn { _upcCandidates: _upcCandidates, _matchUpcInArray: _matchUpcInArray };')();
const _upcCandidates = lifted._upcCandidates, _matchUpcInArray = lifted._matchUpcInArray;

const rows = [
  { itemNum: '020 00 000', upc: '695140004928', _tab: 'Micro-Trains N' },
  { itemNum: '33256',      upc: '022899332567', _tab: 'Bachmann N' },
  { itemNum: '6464-1',     upc: '',             _tab: 'Lionel PW - Items' },
  { itemNum: '020 00 010', _tab: 'Micro-Trains N' },                      // no upc key at all
];
const hit = u => _matchUpcInArray(rows, _upcCandidates(u, u)).map(r => r.itemNum);

ok('an exact 12-digit UPC finds its row', JSON.stringify(hit('695140004928')) === '["020 00 000"]');
ok('an EAN-13 with the leading zero finds the same row', JSON.stringify(hit('0695140004928')) === '["020 00 000"]');
ok('punctuation in the stored cell is ignored',
   JSON.stringify(_matchUpcInArray([{ itemNum: 'X', upc: '695140-004928' }], _upcCandidates('695140004928', '695140004928')).map(r => r.itemNum)) === '["X"]');
ok('a barcode nobody carries finds nothing', hit('999999999999').length === 0);
ok('a row with an EMPTY upc is never matched by an empty scan', hit('').length === 0);
ok('a row with NO upc field is never matched', hit(undefined).length === 0);
ok('it reaches across tabs, not just the era in front of you', JSON.stringify(hit('022899332567')) === '["33256"]');
ok('the same row twice collapses to one hit',
   _matchUpcInArray(rows.concat(rows), _upcCandidates('695140004928', '695140004928')).length === 1);
ok('a hit is stamped _byCatalogUpc', (function () {
  const r = [{ itemNum: 'Y', upc: '111111111111' }];
  _matchUpcInArray(r, _upcCandidates('111111111111', '111111111111'));
  return r[0]._byCatalogUpc === true;
})());

console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
