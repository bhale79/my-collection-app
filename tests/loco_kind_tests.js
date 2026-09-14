// ═══════════════════════════════════════════════════════════════
// loco_kind_tests.js — v0.9.1742.
//
// Brad, 2026-09-14, on Atlas 30138671 (an ET44 diesel wearing a STEAM chip):
// "we have a type issue, please review the atlas tab, find out why this
// happened and then see what other issues might be similar and fix it."
//
// WHY: the steam-class word list (Pacific, Northern, Atlantic, Texas,
// Allegheny, Hudson, Switcher) was tested before any diesel model name, and
// every one of those words is also a railroad. "Union Pacific ET44" read as
// a 4-6-2 Pacific. The same list, used at import time, left 518 rows in the
// live master carrying the opposite kind from their own description (317
// diesels typed Steam, 201 steam engines typed Diesel — measured over all
// 163,824 rows of the 44 items tabs).
//
// THE RULE: plain word → hard steam evidence (wheel arrangement, a class that
// is not a railroad) → hard diesel evidence (a builder's model) → only then
// the words that double as railroad names. And a CATALOG row whose stored
// kind contradicts its own name shows as what it is; the user's own rows and
// set rows are never touched.
//
// Sweep of the real master, old getTypeBucket vs new: 535 rows move — the
// 518 above plus 17 generic "Locomotive" rows the old order got wrong (Shays
// and Heislers → Steam, a D&H U36B → Diesel, a GN boxcab → Electric).
// Nothing stored as anything but a locomotive moves.
//
// v0.9.1743: set rows are no longer skipped wholesale — the plain word
// "Steam"/"Diesel" in a set's own name decides (model names do not). Sweep
// v1742 → v1743: 426 more rows, 91 Steam→Diesel ("Alco PA AA Diesel Set"
// with a Pacific road) and 335 Diesel→Steam (Lionel "Steam Freight Set").
//
// Run:  node tests/loco_kind_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
const W = {};
(new Function('window', fs.readFileSync(path.join(__dirname, '..', 'app', 'type-groups.js'), 'utf8')))(W);
const bucket = W.getTypeBucket, kind = W.locoKindFromWords;
ok('locoKindFromWords is exported', typeof kind === 'function');

section("Brad's row, and its neighbours on the Atlas tab");
const et44 = { itemNum: '30138671', itemType: 'Steam Locomotive', subType: 'ET44 Locomotive', roadName: 'Union Pacific', description: 'Union Pacific (Yellow/Red/Gray)' };
ok('30138671 — stored Steam, is an ET44 — shows as Diesel', bucket(et44) === 'Diesel Locomotive', bucket(et44));
ok('30138665 — Canadian Pacific Kansas City ET44 — Diesel', bucket({ itemType: 'Steam Locomotive', subType: 'ET44 Locomotive', description: 'Canadian Pacific Kansas City (Red/White/Black/Gold)' }) === 'Diesel Locomotive');
ok('an ES44AC, a C44-9W, a VO-1000, an SDP-35, an E6, an S2 — all Diesel', ['ES44AC Locomotive', 'C44-9W Locomotive', 'VO-1000 Locomotive', 'SDP-35 Locomotive', 'E6 Locomotive', 'S2 Locomotive']
   .every(s => bucket({ itemType: 'Steam Locomotive', subType: s, description: 'Union Pacific (Yellow/Red/Gray)' }) === 'Diesel Locomotive'));
ok('30138661 — BNSF ET44 stored Diesel — untouched', bucket({ itemType: 'Diesel Locomotive', subType: 'ET44 Locomotive', description: 'BNSF (Orange/Yellow/Black/Silver)' }) === 'Diesel Locomotive');
ok('an Atlas 2-8-0 stored Steam — untouched', bucket({ itemType: 'Steam Locomotive', subType: '2-8-0 Steam Locomotive', description: 'Union Pacific' }) === 'Steam Locomotive');

section('The railroad-name words, in every family');
ok('Union Pacific LEGACY GP9 Diesel (stored Steam) → Diesel', bucket({ itemType: 'Steam Locomotive', description: 'Southern Pacific LEGACY GP9 Diesel #446 (Black Widow)' }) === 'Diesel Locomotive');
ok('Burlington Northern LEGACY SD60 Diesel (stored Steam) → Diesel', bucket({ itemType: 'Steam Locomotive', description: 'Burlington Northern LEGACY SD60 Diesel #8301' }) === 'Diesel Locomotive');
ok('Missouri Pacific FB-2 (stored Steam) → Diesel', bucket({ itemType: 'Steam Locomotive', description: 'Missouri Pacific FB-2 Diesel (Non-Powered)' }) === 'Diesel Locomotive');
ok('Atlantic Coast Line E6 A Unit (stored Steam) → Diesel', bucket({ itemType: 'Steam Locomotive', subType: 'E6 Locomotive', description: 'Atlantic Coast Line* A Unit' }) === 'Diesel Locomotive');
ok('Union Pacific Genset Switcher (stored Steam) → Diesel', bucket({ itemType: 'Steam Locomotive', description: 'Union Pacific VisionLine 3GS21B Genset Switcher #2701' }) === 'Diesel Locomotive');
ok('Delaware & Hudson U36B (generic Locomotive) → Diesel, not a Hudson', bucket({ itemType: 'Locomotive', description: 'Delaware & Hudson U36B LionChief Locomotive #1776' }) === 'Diesel Locomotive');
ok('Great Northern Boxcab Electric (generic) → Electric, not a Northern', bucket({ itemType: 'Locomotive', description: 'Great Northern Boxcab Electric Locomotive w/ Horn #5008-A' }) === 'Electric Locomotive');
ok('Allegheny RR EMD GP35 Diesel (stored Steam) → Diesel', bucket({ itemType: 'Steam Locomotive', description: 'Allegheny RR EMD GP35 Diesel "305," CC' }) === 'Diesel Locomotive');

section('The other direction — steam engines the default called Diesel');
ok('Cass Scenic Shay (stored Diesel) → Steam', bucket({ itemType: 'Diesel Locomotive', description: 'Cass Scenic Shay Locomotive "7," CC' }) === 'Steam Locomotive');
ok('Middle Fork Heisler (stored Diesel) → Steam', bucket({ itemType: 'Diesel Locomotive', description: 'Middle Fork RR Legacy Heisler Locomotive "7" CC' }) === 'Steam Locomotive');
ok('PRR I1 2-10-0 Decapod (stored Diesel) → Steam', bucket({ itemType: 'Diesel Locomotive', description: 'PRR I1 2-10-0 Decapod Locomotive "4241," CC' }) === 'Steam Locomotive');
ok('SP 4-8-4 GS-4 Steam Engine (stored Diesel) → Steam', bucket({ itemType: 'Diesel Locomotive', roadName: 'Southern Pacific', description: '4-8-4 GS-4 Steam Engine' }) === 'Steam Locomotive');
ok('NKP 0-8-0 Switcher (stored Diesel) → Steam by its wheels, not its "switcher"', bucket({ itemType: 'Diesel Locomotive', description: 'NKP 0-8-0 Switcher' }) === 'Steam Locomotive');
ok('Stourbridge Lion Steam Locomotive (stored Diesel) → Steam', bucket({ itemType: 'Diesel Locomotive', description: 'Stourbridge Lion Steam Locomotive' }) === 'Steam Locomotive');
ok('a generic "Locomotive" 2-Truck Shay → Steam', bucket({ itemType: 'Locomotive', description: 'West Side Lumber LEGACY 2-Truck Shay Locomotive #5' }) === 'Steam Locomotive');

section('Sets — v0.9.1743: the plain word alone decides');
ok('"Union Pacific Alco PA AA Diesel Set" typed Steam → Diesel (the v1742 gap)', bucket({ itemType: 'Steam Locomotive', description: 'Union Pacific O Scale Premier Alco PA AA Diesel Set - 3 Rail Horn' }) === 'Diesel Locomotive');
ok('"Southern Pacific E9 AA Diesel Locomotive Set" typed Steam → Diesel', bucket({ itemType: 'Steam Locomotive', description: 'K28882 O Southern Pacific E9 AA Diesel Locomotive Set w/TMCC' }) === 'Diesel Locomotive');
ok('"Scout Steam Freight Set" typed Diesel → Steam', bucket({ itemType: 'Diesel Locomotive', description: 'Scout Steam Freight Set' }) === 'Steam Locomotive');
ok('"Hogwarts Express Steam Passenger Set" typed Diesel → Steam', bucket({ itemType: 'Diesel Locomotive', description: 'Harry Potter Hogwarts Express Steam Passenger Set' }) === 'Steam Locomotive');
ok('a set with NO plain word stays as stored: "Great Northern ... Freight Train Set" (Northern is not evidence)', bucket({ itemType: 'Steam Locomotive', subType: 'Train Sets', description: 'Great Northern Rocky Mountain Freight Train Set' }) === 'Steam Locomotive');
ok('a set with only MODEL names stays as stored: "SD70ACe Heritage Set" typed Steam is not flipped by the model', bucket({ itemType: 'Steam Locomotive', description: 'SD70ACe Heritage Set' }) === 'Steam Locomotive');
ok('a freight-car set typed Steam stays (no plain word — a different question)', bucket({ itemType: 'Steam Locomotive', description: 'Union Pacific O Scale Premier 6-Car Box Car Set' }) === 'Steam Locomotive');
ok('a set saying BOTH words stays as stored', bucket({ itemType: 'Diesel Locomotive', description: 'Steam and Diesel Starter Set' }) === 'Diesel Locomotive');
ok('an RDC Budd Car Set typed Diesel stays', bucket({ itemType: 'Diesel Locomotive', description: 'RDC Budd Car Set' }) === 'Diesel Locomotive');
ok('locoKindFromPlainWord is exported and reads only the two words', typeof W.locoKindFromPlainWord === 'function' && W.locoKindFromPlainWord('gp9 4-8-4') === '' && W.locoKindFromPlainWord('Diesel Set') === 'Diesel' && W.locoKindFromPlainWord('Steam Set') === 'Steam');

section('What must NOT move');
ok('the user\'s OWN row is never overridden (_personalOnly)', bucket({ _personalOnly: true, itemType: 'Steam Locomotive', description: 'Union Pacific GP9 Diesel' }) === 'Steam Locomotive');
ok('the user\'s OWN row is never overridden (_manualRow)', bucket({ _manualRow: true, itemType: 'Diesel Locomotive', description: 'Cass Scenic Shay' }) === 'Diesel Locomotive');
ok('both hard signals ("Alco 2-8-2") decide nothing — stored kind stands', bucket({ itemType: 'Diesel Locomotive', description: 'Alco 2-8-2 with GP9 trucks' }) === 'Diesel Locomotive' && kind('alco 2-8-2 with gp9 trucks') === '');
ok('the variation prose is not read: AF 561 Billboard Horn stays as stored', bucket({ itemType: 'Diesel Locomotive', description: 'Billboard Horn', varDesc: '(B) Santa Fe Alco with Steam Engine on Bridge' }) === 'Diesel Locomotive');
ok('a soft word alone never flips a stored kind: "Union Pacific" + nothing else', bucket({ itemType: 'Steam Locomotive', description: 'Union Pacific #844' }) === 'Steam Locomotive'
   && bucket({ itemType: 'Diesel Locomotive', description: 'Union Pacific #4014' }) === 'Diesel Locomotive');
ok('a UP Big Boy escort SD70MAC (stored Diesel) stays Diesel — both signals', bucket({ itemType: 'Diesel Locomotive', subType: 'SD70MAC Locomotive', description: 'Union Pacific (Big Boy Escort) 4015' }) === 'Diesel Locomotive');
ok('a non-locomotive stored type is untouched even with loco words', bucket({ itemType: 'Boxcar', description: 'Union Pacific GP9 Diesel Boxcar' }) === 'Boxcar');
ok('Tender stays Tender', bucket({ itemType: 'Tender', description: 'Union Pacific GP9 tender' }) === 'Tender');

section('locoKindFromWords — the one reader');
ok('a wheel arrangement is steam', kind('2-8-4 berkshire') === 'Steam' && kind('4-6-2') === 'Steam' && kind('2-6-6-6') === 'Steam');
ok('a class that is also a railroad is NOT hard evidence', kind('pacific') === '' && kind('northern') === '' && kind('hudson') === '' && kind('texas') === '' && kind('atlantic') === '');
ok('"royal hudson" IS (no railroad is called that)', kind('royal hudson') === 'Steam');
ok('a builder\'s model is diesel', ['gp9', 'sd70mac', 'et44', 'es44ac', 'c44-9w', 'f3', 'f-7', 'e6 locomotive', 's2 locomotive', 'vo-1000', 'rs-11', 'genset', 'train master', 'dash 8-40c', 'u36b'].every(s => kind(s) === 'Diesel'), '');
ok('"e6" / "s2" alone are not (a road number could be either)', kind('e6') === '' && kind('s2') === '');
ok('the plain words win', kind('steam') === 'Steam' && kind('diesel') === 'Diesel');
ok('empty is empty', kind('') === '' && kind(null) === '');

section('classifyLocoByName order (generic "Locomotive" rows)');
ok('"Union Pacific GP9" → Diesel', bucket({ itemType: 'Locomotive', description: 'Union Pacific GP9' }) === 'Diesel Locomotive');
ok('"Union Pacific 4-8-4" → Steam', bucket({ itemType: 'Locomotive', description: 'Union Pacific 4-8-4' }) === 'Steam Locomotive');
ok('"Pacific" alone still reads as the steam class (the soft list still exists, last)', bucket({ itemType: 'Locomotive', description: 'Pacific #1225' }) === 'Steam Locomotive');
ok('"GP-9 diesel switcher" is still Diesel (v1528 pin)', bucket({ itemType: 'Locomotive', description: 'GP-9 diesel switcher' }) === 'Diesel Locomotive');
ok('nothing known still defaults to Diesel', bucket({ itemType: 'Locomotive', description: 'Mystery engine' }) === 'Diesel Locomotive');

section('The Lens sub-type mapper reads the same evidence');
const WP = fs.readFileSync(path.join(__dirname, '..', 'app', 'wizard-photos.js'), 'utf8');
const i = WP.indexOf('function _mapSubTypeToManualType(subType)');
let d = 0, j = WP.indexOf('{', i), fnSrc = '';
for (let k = j; k < WP.length; k++) { if (WP[k] === '{') d++; else if (WP[k] === '}') { d--; if (!d) { fnSrc = WP.slice(i, k + 1); break; } } }
const map = (new Function('window', fnSrc + '\nreturn _mapSubTypeToManualType;'))(W);
ok('"Union Pacific GP9" → Diesel Engine', map('Union Pacific GP9') === 'Diesel Engine', map('Union Pacific GP9'));
ok('"Burlington Northern SD70MAC" → Diesel Engine', map('Burlington Northern SD70MAC') === 'Diesel Engine');
ok('"4-6-2 Pacific" → Steam Engine', map('4-6-2 Pacific') === 'Steam Engine');
ok('"Hudson" alone → Steam Engine (unchanged)', map('Hudson') === 'Steam Engine');
ok('"Boxcar" → Freight Car (unchanged)', map('Boxcar') === 'Freight Car');
ok('the mapper calls the shared reader, not a private copy', /window\.locoKindFromWords\(s\)/.test(fnSrc));

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
