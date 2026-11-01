#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THE ADD LIST NEVER SHOWS A BARE "3-Rail" — v0.9.2028, re-pinned 2026-11-01
//
// Brad, 2026-10-25, on an Atlas 726 caboose row: "why is a 3rd rail item have
// a atlas link?" The chip said a bare "3-Rail", which reads like the 3rd Rail
// brand (Sunset Models). → "change it to atlas 3-rail" → "every brand".
// 2026-11-01 (the Add screen's filters really filter): the chip is REPLACED by
// the maker · era tag ("ATLAS · O 3-RAIL"), which names the maker first — so a
// rail word can still never stand alone. The rail word itself now comes from
// ONE helper, rrRowRailWord; the tag is pinned in add_filters_strict_tests.
//
//   A  rrRowRailWord reads the rail number from Track/Power ("3-Rail TMCC" → 3-Rail)
//   B  no rail number in Track/Power, or a blank one → ''
//   D  the Add list draws no rail chip of its own — a planted copy of the old
//      bare-chip code turns this red
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), vm = require('vm');
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function ok(n, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (extra || ''))); cond ? pass++ : fail++; }

const WS = fs.readFileSync(path.join(APP, 'wizard-suggestions.js'), 'utf8');
const helperMatch = WS.match(/function rrRowRailWord\(c\) \{[\s\S]*?\n\}\n/);
ok('helper rrRowRailWord exists in wizard-suggestions.js', !!helperMatch);
const ctx = {};
vm.createContext(ctx);
try { vm.runInContext((helperMatch ? helperMatch[0] : '') + '\nthis.__rail = rrRowRailWord;', ctx); }
catch (e) { ok('helper loads', false, e.message); }
const rail = ctx.__rail;
if (typeof rail !== 'function') { console.log('\n' + pass + ' passed, ' + (fail + 1) + ' failed'); process.exit(1); }

// A
ok('A1 "3-Rail" → "3-Rail"', rail({ trackPower: '3-Rail', _era: 'atlas' }) === '3-Rail');
ok('A2 "2 Rail DC" → "2-Rail"', rail({ trackPower: '2 Rail DC' }) === '2-Rail', rail({ trackPower: '2 Rail DC' }));
ok('A3 "3-Rail TMCC" still reads the rail number', rail({ trackPower: '3-Rail TMCC' }) === '3-Rail');
// B
ok('B1 blank Track/Power → ""', rail({ trackPower: '', _era: 'atlas' }) === '');
ok('B2 no rail number (e.g. "DC") → ""', rail({ trackPower: 'DC' }) === '');
ok('B3 nothing at all → ""', rail(null) === '');

// D — the list draws no rail chip of its own; the rail only rides in the tag
function noBareChip(text) {
  const body = text.replace(/function rrRowRailWord\(c\) \{[\s\S]*?\n\}\n/, '');
  return !/railSpan/.test(body) && !/\+\s*'-Rail'/.test(body) && /rrRowRailWord\(m\)/.test(body);
}
ok('D1 the real file draws no bare rail chip (the rail rides in the maker · era tag)', noBareChip(WS));
const anchor = "    var _tagHtml = rrRowTagHtml(";
const planted = WS.replace(anchor,
  "    var _railLabel = ''; var _rm = String(c.trackPower).match(/(\\d)\\s*-?\\s*rail/i); if (_rm) _railLabel = _rm[1] + '-Rail';\n"
  + "    if (_railLabel) { const railSpan = document.createElement('span'); railSpan.textContent = _railLabel; line1.appendChild(railSpan); }\n" + anchor);
ok('D2 planted offender (old bare chip put back) is caught', planted !== WS && !noBareChip(planted));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
