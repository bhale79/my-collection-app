// ═══════════════════════════════════════════════════════════════════════════
// Feature tabs are NOT collection tabs — v0.9.1426
//
// This exact bug has now shipped three times, each time in the same shape:
// a FEATURE creates a tab on the user's personal sheet, nobody adds it to the
// canonical set in syncUserDefinedTabsFromSheet, and the app files it as one
// of the user's own collection tabs.
//
//   v0.9.794  — 'Contacts'    → appeared in My Collection as "Contactss"
//   (earlier) — 'Parts Needed'
//   v0.9.1426 — 'Barcode Map' → got a Show chip beside Trains/Catalogs, and
//               was parsed by parseEphemeraRows (a paper-item parser), which
//               put the UPC in title, the item number in description, the
//               maker in year, and a date serial in manufacturer.
//
// Naming the tabs in a list is not the fix — REMEMBERING to name them is the
// part that keeps failing. So this asserts it mechanically: every tab any
// feature writes must be excluded from both guards. When the next feature adds
// a tab, add it to FEATURE_TABS below and this test tells you the two places
// it has to be registered.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const APP = path.join(__dirname, '..', 'app');
const rd = f => fs.readFileSync(path.join(APP, f), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  — ' + detail : '')); }
}

// Every tab written by a feature rather than by the user's collecting.
// Second element: the ephemeraData bucket id it would be given if it leaked
// (label lowercased, spaces → underscore) — the thing that must be deleted.
const FEATURE_TABS = [
  ['Parts Needed', 'parts_needed'],
  ['Contacts',     'contacts'],
  ['Barcode Map',  'barcode_map'],
];

console.log('\n=== Feature tabs must never load as collection tabs ===');

const setup = rd('app-setup.js');
const data  = rd('app-data.js');

// The canonical set inside syncUserDefinedTabsFromSheet.
// Comments are STRIPPED before checking: these blocks carry long explanatory
// notes that name the very tabs being asserted, so a search over the raw text
// would pass on a comment mentioning the tab while the actual entry was
// missing — the test would then be green precisely when the bug was back.
const _stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const canonicalBlock = _stripComments((setup.match(/const canonical = new Set\(\[([\s\S]*?)\]\);/) || [])[1] || '');
ok('found the canonical tab set', canonicalBlock.length > 0);

// The _RESERVED_TABS guard in the loader.
const reservedBlock = _stripComments((data.match(/const _RESERVED_TABS = \{[^}]*\}/) || [''])[0]);
ok('found the _RESERVED_TABS guard', reservedBlock.length > 0);

// The prune line that clears an already-loaded bucket.
const pruneLine = _stripComments((setup.match(/if \(state\.ephemeraData\) \{[^}]*parts_needed[^}]*\}/) || [''])[0]);
ok('found the stale-bucket prune', pruneLine.length > 0);

FEATURE_TABS.forEach(function (pair) {
  const label = pair[0], bucket = pair[1];
  ok('"' + label + '" is in the canonical set',
     canonicalBlock.indexOf("'" + label + "'") >= 0,
     'add \'' + label + '\' to canonical in syncUserDefinedTabsFromSheet');
  ok('"' + label + '" is in _RESERVED_TABS',
     reservedBlock.indexOf("'" + label + "'") >= 0,
     'add \'' + label + '\': 1 to _RESERVED_TABS in app-data.js');
  ok('"' + label + '" bucket (' + bucket + ') is pruned when found stale',
     pruneLine.indexOf(bucket) >= 0,
     'add delete state.ephemeraData.' + bucket + ' to the prune line');
});

// The Barcode Map is written with its own column shape; if it were ever parsed
// as ephemera again, these are the fields that would be wrong. Assert the
// writer still uses the header we think it does, so the audit stays true.
const bc = rd('barcode.js');
ok('Barcode Map tab still has its documented header',
   /\['UPC \/ Barcode', 'Item Number', 'Manufacturer', 'Learned On', 'How'\]/.test(bc),
   'header changed — re-check the audit doc');
ok('barcode pairings still share to the community pool',
   /_bcPairShare\(/.test(bc) && /vaultIsOptedIn/.test(bc),
   'community sharing path missing');

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
