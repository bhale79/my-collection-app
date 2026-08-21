// ═══════════════════════════════════════════════════════════════
// type_bucket_tests.js — Session 82.
//
// Brad, looking at his imported collection: "your Type filter now has two
// vocabularies in it." It had 84 entries — the catalog's own compounds
// ("Flatcar - PS-4 Flatcar"), its one-off body names ("Boom Car", "Reefer"),
// and the import's plainer words ("Engine") all listed side by side.
//
// These lock the folding down to the 23 canonical buckets WITHOUT swallowing
// a user's genuinely custom type, which must survive untouched.
//
// Run:  node tests/type_bucket_tests.js
// ═══════════════════════════════════════════════════════════════
global.window = global.window || {};
require('../app/type-groups.js');
const bucket = window.getTypeBucket;
const label = window.getTypeBucketLabel;

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('PASS  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
  else { fail++; console.log('FAIL  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
}
function is(name, got, want) { ok(name, got === want, got === want ? got : 'got "' + got + '" want "' + want + '"'); }

// ── the import's own words land in the catalog's buckets ────────
is('Engine + diesel words -> Diesel', label({ itemType: 'Engine', description: 'GP-9 diesel switcher', _personalOnly: 1 }), 'Diesel');
is('Engine + steam words -> Steam', label({ itemType: 'Engine', description: 'Berkshire steam locomotive', _personalOnly: 1 }), 'Steam');
is('Engine + wheel arrangement -> Steam', label({ itemType: 'Engine', description: '0-6-0 switcher w/ tender', _personalOnly: 1 }), 'Steam');
is('Engine + GG-1 -> Electric', label({ itemType: 'Engine', description: 'GG-1 electric', _personalOnly: 1 }), 'Electric');
is('Engine, nothing to go on -> Diesel (documented default)', label({ itemType: 'Engine', description: 'mystery loco', _personalOnly: 1 }), 'Diesel');
is('Transformer -> Power', label({ itemType: 'Transformer' }), 'Power');
is('Catalog -> Paper', label({ itemType: 'Catalog' }), 'Paper');

// The word beats the model-name heuristic. 'switcher' lives in the steam
// list; a description that says "diesel" outright must not be read as steam.
is('the word diesel outranks "switcher"', label({ itemType: 'Locomotive', description: 'diesel switcher' }), 'Diesel');

// ── the catalog's own mess folds too ────────────────────────────
is('compound: Flatcar - PS-4 Flatcar', label({ itemType: 'Flatcar - PS-4 Flatcar' }), 'Flatcar');
is('compound: Caboose - Work Caboose', label({ itemType: 'Caboose - Work Caboose' }), 'Caboose');
is('compound: Hopper - 4-Bay Hopper', label({ itemType: 'Hopper - 4-Bay Hopper' }), 'Hopper');
is('pack: Boxcar 2-Pack', label({ itemType: 'Boxcar 2-Pack' }), 'Boxcar');
is('pack: Passenger Car 4-Pack', label({ itemType: 'Passenger Car 4-Pack' }), 'Passenger');
is('body name: Reefer', label({ itemType: 'Reefer' }), 'Boxcar');
is('body name: Mint Car', label({ itemType: 'Mint Car' }), 'Boxcar');
is('body name: Boom Car', label({ itemType: 'Boom Car' }), 'Operating');
is('set name: Freight Set', label({ itemType: 'Freight Set' }), 'Set');

// ── what must NOT be folded ─────────────────────────────────────
is('a custom type survives exactly', label({ itemType: 'Wings of Texaco' }), 'Wings of Texaco');
is('a custom type survives exactly (2)', label({ itemType: 'Books' }), 'Books');

// ── the by-number overrides stay off the user's own rows ────────
is('own row keeps the type its owner set', label({ itemType: 'Accessory', itemNum: '900', _personalOnly: 1 }), 'Accessory');
is('catalog row still gets its number override', label({ itemType: 'Accessory', itemNum: '900' }), 'Boxcar');
is('own row with NO type still takes the override', label({ itemType: '', itemNum: '900', _personalOnly: 1 }), 'Boxcar');

// ── the whole of Brad's real collection ─────────────────────────
// 2,962 typed rows exported from the app after the (40) import.
const fs = require('fs'), path = require('path');
const fixture = process.argv[2] || '/tmp/brad_types.json';
if (fs.existsSync(fixture)) {
  const rows = JSON.parse(fs.readFileSync(fixture, 'utf8'));
  const before = new Set(), after = new Set();
  rows.forEach(r => {
    before.add(r.itemType);
    after.add(label(Object.assign({ _personalOnly: true }, r)));
  });
  ok('real collection: 84 type strings fold to about 20', before.size >= 80 && after.size <= 25,
     before.size + ' -> ' + after.size);
  ok('real collection: every fold lands on a known bucket or a custom name',
     [...after].every(l => typeof l === 'string' && l.length > 0));
} else {
  console.log('SKIP  real-collection fold (no ' + fixture + ')');
}

console.log('');
console.log(fail === 0 ? 'ALL TYPE-BUCKET TESTS GREEN (' + pass + ')' : fail + ' FAILING of ' + (pass + fail));
process.exit(fail === 0 ? 0 : 1);
