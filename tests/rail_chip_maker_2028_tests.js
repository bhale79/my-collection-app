#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THE ADD LIST'S RAIL CHIP NAMES THE MAKER — v0.9.2028
//
// Brad, 2026-10-25, on an Atlas 726 caboose row: "why is a 3rd rail item have
// a atlas link?" The chip said a bare "3-Rail", which reads like the 3rd Rail
// brand (Sunset Models). → "change it to atlas 3-rail" → "every brand".
//
//   A  the real config's ERAS name the maker: Atlas O → "Atlas 3-Rail",
//      Weaver → "Weaver 2-Rail", MTH → "MTH 3-Rail", from _era or from _tab
//   B  no rail number in Track/Power, or a blank one → no chip ('')
//   C  no maker known → the bare "3-Rail" (never "undefined 3-Rail")
//   D  the Add list draws the chip ONLY through rrRailChipLabel — a planted
//      copy of the old bare-chip code turns this red
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), vm = require('vm');
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function ok(n, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (extra || ''))); cond ? pass++ : fail++; }

const WS = fs.readFileSync(path.join(APP, 'wizard-suggestions.js'), 'utf8');
const helperMatch = WS.match(/function rrRailChipLabel\(c\) \{[\s\S]*?\n\}\n/);
ok('helper rrRailChipLabel exists in wizard-suggestions.js', !!helperMatch);

// The REAL config (ERAS) + the REAL maker helper + the REAL chip helper.
const ctx = { window: {}, navigator: { userAgent: 'node', platform: 'node', maxTouchPoints: 0 }, location: { href: 'https://therailroster.com/app/', hostname: 'therailroster.com', search: '' }, console: { log() {}, warn() {}, error() {} }, document: undefined, localStorage: undefined };
ctx.window = ctx; ctx.self = ctx;
ctx.addEventListener = ctx.removeEventListener = function () {};
ctx.setTimeout = setTimeout; ctx.clearTimeout = clearTimeout;
vm.createContext(ctx);
const src = fs.readFileSync(path.join(APP, 'config.js'), 'utf8') + '\n'
  + fs.readFileSync(path.join(APP, 'catalog-display-config.js'), 'utf8') + '\n'
  + (helperMatch ? helperMatch[0] : '') + '\n'
  + 'this.__chip = rrRailChipLabel; this.__eras = ERAS;';
try { vm.runInContext(src, ctx, { filename: 'rail-chip-harness.js' }); }
catch (e) { ok('harness loads config + helpers', false, e.message); }
const chip = ctx.__chip;
if (typeof chip !== 'function') { console.log('\n' + pass + ' passed, ' + (fail + 1) + ' failed'); process.exit(1); }

// A
ok('A1 Atlas O by era → "Atlas 3-Rail"', chip({ trackPower: '3-Rail', _era: 'atlas' }) === 'Atlas 3-Rail', chip({ trackPower: '3-Rail', _era: 'atlas' }));
ok('A2 Weaver by era → "Weaver 2-Rail"', chip({ trackPower: '2-Rail', _era: 'weaver' }) === 'Weaver 2-Rail', chip({ trackPower: '2-Rail', _era: 'weaver' }));
ok('A3 MTH O by era → "MTH 3-Rail"', chip({ trackPower: '3-Rail', _era: 'mth_o' }) === 'MTH 3-Rail', chip({ trackPower: '3-Rail', _era: 'mth_o' }));
ok('A4 maker from the tab name when no era → "Atlas 2-Rail"', chip({ trackPower: '2 Rail DC', _tab: 'Atlas O' }) === 'Atlas 2-Rail', chip({ trackPower: '2 Rail DC', _tab: 'Atlas O' }));
ok('A5 "3-Rail TMCC" still reads the rail number', chip({ trackPower: '3-Rail TMCC', _era: 'atlas' }) === 'Atlas 3-Rail');
// every era that names a maker gives "<maker> 3-Rail"
let bad = [];
Object.keys(ctx.__eras).forEach(function (k) {
  const mk = ctx.__eras[k] && ctx.__eras[k].manufacturer;
  if (!mk) return;
  const got = chip({ trackPower: '3-Rail', _era: k });
  if (got !== mk + ' 3-Rail') bad.push(k + '=' + got);
});
ok('A6 every catalog with a maker names it on the chip', bad.length === 0, bad.slice(0, 5).join(', '));

// B
ok('B1 blank Track/Power → no chip', chip({ trackPower: '', _era: 'atlas' }) === '');
ok('B2 no rail number (e.g. "DC") → no chip', chip({ trackPower: 'DC', _era: 'atlas' }) === '');
ok('B3 nothing at all → no chip', chip(null) === '');

// C
ok('C1 maker unknown → bare "3-Rail"', chip({ trackPower: '3-Rail', _era: 'no_such_era', _tab: 'Nothing Matches' }) === '3-Rail', chip({ trackPower: '3-Rail', _era: 'no_such_era', _tab: 'Nothing Matches' }));

// D — the chip's words are built only by the helper
function drawsOnlyThroughHelper(text) {
  const body = text.replace(/function rrRailChipLabel\(c\) \{[\s\S]*?\n\}\n/, '');
  return /_railLabel\s*=\s*rrRailChipLabel\(c\)/.test(body) && !/\+\s*'-Rail'/.test(body);
}
ok('D1 the real file draws the chip only through rrRailChipLabel', drawsOnlyThroughHelper(WS));
const planted = WS.replace('var _railLabel = rrRailChipLabel(c);',
  "var _railLabel = ''; var _rm = String(c.trackPower).match(/(\\d)\\s*-?\\s*rail/i); if (_rm) _railLabel = _rm[1] + '-Rail';");
ok('D2 planted offender (old bare chip put back) is caught', planted !== WS && !drawsOnlyThroughHelper(planted));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
