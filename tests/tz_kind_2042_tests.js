#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THE TRAINZ DIAGRAM BY KIND — v0.9.2042
//
// [stated] Brad, 2026-10-29, with a screenshot of No. 224 (a 2-6-2 steam
// engine) whose Trainz button opened "Lionel 208 209 210 211 213 222 223 224…"
// — the 200-series Alco diesels: "so we need to work on items that have the
// same item number like the 224 steam engine going to the trainz 200 series
// diagrams for deseils" → "build it".
//
// Maker + era (v0.9.2038) cannot separate two postwar trains with one number.
// 66 numbers in Trainz's list name more than one diagram. So the KIND has to
// agree too — the item's type bucket (getTypeBucket, type-groups.js) against
// the kinds its title names — and EVERY diagram of the right kind is offered.
//
// The REAL type-groups.js, trainz-diagrams-config.js and the REAL matcher
// (maintenance.js) run in a Node sandbox. Measured against the live master
// (2026-10-29): postwar + pre-war 6,411 rows and MPC-Modern 21,943 rows — the
// only first-diagram change is the 224 steam engine; 89 rows now show more
// than one diagram; the 20 that lost theirs were each a different item from
// the diagram (Nabisco promotion cards, a TCA boxcar sharing a U36C's number,
// track templates, a lamp, a "130 Watt" / "1954 Model" title number…).
//
//   A  the 224: steam → the Prairie only; the Alco → the two Alco sheets
//   B  two right answers shown both: 221 (1946 + 1947), 726, 2025, ZW, 6427
//   C  the kinds that share a sheet: tenders, 2329 Rectifier, RDC, 3927, parts
//   D  numbers a title shows as something else are not numbers
//   E  the panel draws one button per diagram
//   P  planted offenders — each check fails on the old code
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const APP = path.join(__dirname, '..', 'app');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
const MAINT = read('maintenance.js');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail !== undefined ? '  -> ' + JSON.stringify(detail).slice(0, 500) : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
function grab(src, sig) {
  const i = src.indexOf(sig); if (i < 0) throw new Error('not found: ' + sig);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1) + (sig.indexOf('var ') === 0 ? ';' : ''); } }
  throw new Error('unbalanced: ' + sig);
}
function plant(src, a, b) { if (src.indexOf(a) < 0) throw new Error('plant target not found: ' + a.slice(0, 80)); return src.replace(a, b); }
const SIGS = ['function _tzFamily(e)', 'function _tzItemFamily(eraKey)', 'var _TZ_BUCKET_KIND = {', 'function _tzItemKind(item)', 'function _tzTitleKinds(e)',
  'var _TZ_KIN = {', 'function _tzKindsAgree(a, b)', 'function _tzFits(itemKind, e)', 'function _tzJunkKey(k, title)', 'function _tzDiagrams(item, eraKey)', 'function _tzDiagram(item, eraKey)'];
function matcher(src) {
  const c = { console: { log() {}, warn() {} } };
  c.window = c;
  vm.createContext(c);
  vm.runInContext(read('type-groups.js'), c);
  vm.runInContext(read('trainz-diagrams-config.js'), c);
  vm.runInContext('var _tzLookup = null;\n' + SIGS.map(s => grab(src, s)).join('\n'), c);
  return (num, type, desc, era) => c._tzDiagrams({ itemNum: num, itemType: type || '', description: desc || '' }, era || 'pw').map(e => e.t);
}
const has = (list, re) => list.some(t => re.test(t));

section('A · No. 224 — the steam engine and the Alco share a number');
const tz = matcher(MAINT);
{
  const steam = tz('224', 'Steam Locomotive', '2-6-2 Steam Locomotive');
  ok('224 steam → the 224 2-6-2 Prairie diagram, and only that', steam.length === 1 && /224 2-6-2 Prairie/.test(steam[0]), steam);
  const alco = tz('224P', 'Diesel Locomotive', 'U.S. Navy Alco');
  ok('224 Alco (224P) → the two Alco sheets, never the Prairie', alco.length === 2 && alco.every(t => /Alco|208 209 210/.test(t)) && !has(alco, /Prairie/), alco);
  ok('a 221 Alco diesel → nothing (Trainz has no 221 Alco sheet; the two 221 sheets are steam)', tz('221', 'Diesel Locomotive', 'Alco Diesel').length === 0);
}

section('B · two right answers → both buttons');
{
  const t221 = tz('221', 'Steam Locomotive', '2-6-4 Steam Locomotive');
  ok('221 steam → the 1946 AND the 1947 version', t221.length === 2 && has(t221, /1946 Version/) && has(t221, /1947 Version/), t221);
  const t726 = tz('726', 'Steam Locomotive', '2-8-4 Berkshire');
  ok('726 → the Early and the Late Berkshire', t726.length === 2 && has(t726, /726 Early/) && has(t726, /726 Late/), t726);
  ok('2025 → Early (2-6-2) and Late (2-6-4)', tz('2025', 'Steam Locomotive').length === 2);
  ok('ZW → both transformer sheets', tz('ZW', 'Transformer/Power', 'Transformer').length === 2);
  ok('6427 caboose → the Porthole and the Transfer caboose sheets', tz('6427', 'Caboose', 'Caboose').length === 2);
}

section('C · kinds that share a sheet are not torn apart');
{
  ok('a tender with no sheet of its own → its engine\'s (1654T → the 1654 2-4-2)', has(tz('1654T', 'Tender', 'Sheet Metal Tender'), /1654/));
  ok('a tender with its own sheet → that sheet (6026W)', has(tz('6026W', 'Tender', 'Whistle Tender'), /6026W Whistle Tender/));
  ok('the 2329 Rectifier (electric) → the GP-7/GP-9/2329 sheet Trainz files it on', has(tz('2329', 'Electric Locomotive', 'EP-5 Rectifier'), /2329/));
  ok('a motorized 3927 Track Cleaning Car → its sheet', has(tz('3927', 'Motorized Unit', 'Track Cleaning Car'), /3927 Track Cleaning Car/));
  ok('a 91 Circuit Breaker filed under Power → its sheet', has(tz('91', 'Transformer/Power', 'Circuit Breaker'), /91 Circuit Breaker/));
  ok('a parts packet through its BASE number → the base item\'s sheet (3424-94 → 3424 Brakeman Car)', has(tz('3424-94', 'Accessory', 'Parts Packet for 3424 Brakeman Car'), /3424 Operating Brakeman Car/));
  ok('…but a lamp\'s OWN number is not another item (64-15 lamp ≠ the 6415 tank car)', tz('64-15', 'Accessory', '12V Opal Lamp').length === 0);
  ok('a promotional card is not the engine (2338 Nabisco Promo → nothing; the GP-7 2338 → its sheet)', tz('2338', 'Promotional', 'Milwaukee Road GP7 Diesel').length === 0 && has(tz('2338', 'Diesel Locomotive', 'GP7 Diesel'), /2338/));
  ok('the Docksider (8803 MPC steam) keeps its sheet', has(tz('8803', 'Steam Locomotive', '0-4-0 locomotive', 'mpc'), /Docksider/));
  ok('an item with no type to go on is never filtered (a bare 224 with no type → all three)', tz('224', '', '').length === 3);
}

section('D · numbers a title shows as something else');
{
  ok('"175 Watt" is not the 175 Rocket Launcher\'s number', !has(tz('175', 'Accessory', 'Rocket Launcher'), /Watt/) && has(tz('175', 'Accessory', 'Rocket Launcher'), /Rocket Launcher/));
  ok('"130 Watt" is not the 130 crossing', tz('130', 'Track', 'Super-O 60-Degree Crossing').length === 0);
  ok('"(1954 Model)", "1950 Model", "- 1946 Version", "(1947-1949)" are years, not item numbers', tz('1954', '', '').length === 0 && tz('1950', '', '').length === 0 && tz('1946', '', '').length === 0 && tz('19471949', '', '').length === 0);
  ok('"44 Ton" is a size: 44 → the Launcher', tz('44', 'Motorized Unit', 'Missile Launcher').length === 1 && has(tz('44', 'Motorized Unit', 'Missile Launcher'), /Launcher/));
}

section('E · the panel draws one button per diagram');
{
  const panel = grab(MAINT, 'function _maintDiagramLinksHtml(item, where)');
  ok('_maintDiagramLinksHtml loops _tzDiagrams — one "Trainz diagram:" button each', /_tzDiagrams\(item, eraKey\)\.forEach\(function \(tzd\)/.test(panel) && /Trainz diagram: ' \+ _esc\(tzd\.t\)/.test(panel));
}

section('P · planted offenders');
{
  const noKind = matcher(plant(MAINT, 'return (viaBase && partOf) || _tzFits(kind, e);', 'return true;'));
  ok('P1 no kind check → the 224 steam engine gets the Alco sheets again', has(noKind('224', 'Steam Locomotive', '2-6-2 Steam Locomotive'), /Alco|208 209 210/));
  const firstOnly = matcher(plant(MAINT, '      if (hits.length) return hits;', '      if (hits.length) return hits.slice(0, 1);'));
  ok('P2 first match only → 221 shows ONE of its two versions', firstOnly('221', 'Steam Locomotive').length === 1);
  const noJunk = matcher(plant(MAINT, '          if (!k || _tzJunkKey(k, e.t)) return;', '          if (!k) return;'));
  ok('P3 no junk-number filter → a "1954" gets the TW transformer\'s "(1954 Model)" sheet', noJunk('1954', '', '').length > 0);
  const noKin = matcher(plant(MAINT, "'steam|tender': 1, ", ''));
  ok('P4 tenders not kin to engines → 1654T loses its engine\'s sheet', noKin('1654T', 'Tender', 'Sheet Metal Tender').length === 0);
  const noBase = matcher(plant(MAINT, 'return (viaBase && partOf) || _tzFits(kind, e);', 'return _tzFits(kind, e);'));
  ok('P5 no parts-through-the-base rule → the 2026-58 lamp loses the 2026 engine\'s sheets', noBase('2026-58', 'Accessory', '18V Clear Lamp').length === 0 && tz('2026-58', 'Accessory', '18V Clear Lamp').length > 0);
  const merged = matcher(plant(MAINT, '      var strict = (i === 0 && dashedJoin);', '      var strict = false;'));
  ok('P6 the dash run together judged loosely → the 64-15 lamp gets the 6415 tank car', merged('64-15', 'Accessory', '12V Opal Lamp').length > 0);
  ok('…while Trainz\'s own run-together numbers still match: 6827-100, 6828-100, 1130T-500', tz('6827-100', 'Flatcar', 'Harnischfeger Power Shovel').length === 1 && tz('6828-100', 'Accessory', 'Construction Crane').length === 1 && has(tz('1130T-500', 'Tender', 'Small Streamlined Tender'), /1130T-500/));
}

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
