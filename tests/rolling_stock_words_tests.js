#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════
// rolling_stock_words_tests.js — v0.9.1874: how a row typed "Rolling Stock" /
// "Freight Car" is read
//
// [stated] Brad: "yes" to plan → ROLLING_STOCK_WORDS_PLAN_2026-10-04.xlsx →
// "yes" to build. Measured on all 164,836 master rows with the app's own
// getTypeBucket: 465 rows read wrong and nothing else moves. "oil car" was
// matched INSIDE "Coil Car" (87 coil cars showed as Tank Cars); crane / boom
// tenders, snowplows, Jordan spreaders, engineering cars, stake / logging cars,
// low side cars, RoadRailers, auto transport cars and rapid discharge cars all
// fell to the Boxcar default.
//
// A · REAL master rows (copied from the sheet, every field the bucketer reads)
//     through the REAL type-groups.js — each shows its true type.
// B · rows that must NOT move: a real "Oil Car" stays a Tank Car, a "Freight
//     Car Set" stays as it is today, a "Beer Car" stays a Boxcar, "Snow Plow"
//     stays Operating, a Power Meter Car stays a Boxcar.
// C · PLANTED: the shipped-before file (each fix undone in turn) must fail A.
// ════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'app', 'type-groups.js'), 'utf8');

let pass = 0, fail = 0;
function T(n, cond, detail) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (detail === undefined ? '' : JSON.stringify(detail))));
  cond ? pass++ : fail++;
}
function section(t) { console.log('\n== ' + t + ' =='); }
function bucketer(src) { const w = {}; new Function('window', src)(w); return w.getTypeBucket; }

// Real rows from the master sheet (Master Version 1.99), as parseMasterRow gives them.
const MOVES = [
  { tab: "Atlas N", item: "50 004 636", itemType: "Rolling Stock", subType: "Cushion Coil Car", description: "UNDECORATED", originalDesc: "", varDesc: "", was: "Tank Car", now: "Flatcar" },
  { tab: "MTH O", item: "20-90019c", itemType: "Rolling Stock", subType: "", description: "Coil Car", originalDesc: "CSX O Scale Premier Coil Car", varDesc: "", was: "Tank Car", now: "Flatcar" },
  { tab: "MTH O", item: "30-7217", itemType: "Rolling Stock", subType: "", description: "Heavy Duty Snowplow", originalDesc: "New York Central O Gauge RailKing Heavy Duty Snowplow", varDesc: "", was: "Boxcar", now: "Operating Freight" },
  { tab: "MTH O", item: "20-98206", itemType: "Rolling Stock", subType: "", description: "Jordan Spreader", originalDesc: "Pennsylvania O Scale Premier Jordan Spreader", varDesc: "", was: "Boxcar", now: "Operating Freight" },
  { tab: "MTH O", item: "30-7976", itemType: "Rolling Stock", subType: "", description: "Engineering Car", originalDesc: "Lehigh Valley O Gauge RailKing Engineering Car", varDesc: "", was: "Boxcar", now: "Operating Freight" },
  { tab: "MTH O", item: "20-98223", itemType: "Rolling Stock", subType: "", description: "O Scale Crane Tender", originalDesc: "Lehigh Valley O Scale Premier O Scale Crane Tender", varDesc: "", was: "Boxcar", now: "Operating Freight" },
  { tab: "MTH O", item: "20-97192", itemType: "Rolling Stock", subType: "", description: "Rapid Discharge Car", originalDesc: "Conrail O Scale Premier Rapid Discharge Car", varDesc: "", was: "Boxcar", now: "Hopper" },
  { tab: "Marklin H0", item: "44104", itemType: "Freight Car", subType: "", description: "Märklin my world - Stake Car", originalDesc: "", varDesc: "", was: "Boxcar", now: "Flatcar" },
  { tab: "Marklin Gauge 1", item: "54805", itemType: "Freight Car", subType: "", description: "Prussian Low Side Car.", originalDesc: "", varDesc: "", was: "Boxcar", now: "Gondola" },
  { tab: "Marklin H0", item: "44110", itemType: "Freight Car", subType: "", description: "Märklin my world - Auto Transport Car", originalDesc: "", varDesc: "", was: "Boxcar", now: "Intermodal" },
  { tab: "Accucraft G", item: "AM32-150", itemType: "Rolling stock", subType: "LONG LOGGING CAR - AMS", description: "Long Logging Car - Unlettered", originalDesc: "", varDesc: "", was: "Boxcar", now: "Flatcar" },
  { tab: "K-Line O", item: "K676-1091", itemType: "Rolling Stock", subType: "", description: "K676-1091 O Baltimore & Ohio Coil Car #8375 with Load LN/Box", originalDesc: "", varDesc: "no variation", was: "Tank Car", now: "Flatcar" },
  { tab: "LGB G", item: "40551", itemType: "Freight Car", subType: "Freight Car Sets", description: "DR Low Side Car", originalDesc: "LGB 40551 G DR Low Side Car Era III", varDesc: "Era III", was: "Boxcar", now: "Gondola" },
  { tab: "Aristo-Craft G", item: "46801", itemType: "Freight Car", subType: "RoadRailer", description: "RoadRailer", originalDesc: "", varDesc: "", was: "Boxcar", now: "Intermodal" }
];
const STAYS = [
  { item: '10-8084',  itemType: 'Rolling Stock', description: 'No. 2815 O Gauge Oil Car', want: 'Tank Car' },
  { item: '10-2243',  itemType: 'Rolling Stock', description: 'No. 215 Std. Gauge Oil Car', want: 'Tank Car' },
  { item: '20-90007', itemType: 'Rolling Stock', description: 'Merger Series Freight Car Set', want: 'Boxcar' },
  { item: '4417',     itemType: 'Freight Car',   description: 'Beer Car.', want: 'Boxcar' },
  { item: '719',      itemType: 'Freight Car',   description: 'Two-Axle Tank Car Display with Two Wheelsets', want: 'Tank Car' },
  { item: '20-98208', itemType: 'Rolling Stock', description: 'Snow Plow', want: 'Operating Freight' },
  { item: '20-94744', itemType: 'Rolling Stock', description: '40’ Steel Sided Power Meter Car', want: 'Boxcar' },
];

function checkMoves(get) { return MOVES.filter(r => get(r) !== r.now).map(r => r.item + ' ' + get(r)); }

const G = bucketer(SRC);
section('A · real rows that read wrong before v1874 now show their true type');
for (const r of MOVES) T('A  ' + r.tab + ' ' + r.item + ' "' + (r.subType || r.description).slice(0, 40) + '" → ' + r.now + ' (was ' + r.was + ')', G(r) === r.now, G(r));

section('B · rows that must not move');
for (const r of STAYS) T('B  ' + r.item + ' "' + r.description.slice(0, 40) + '" stays ' + r.want, G(r) === r.want, G(r));

section('C · planted: each fix undone in turn must fail section A');
const UNDO = [
  ['"oil car" matched inside "Coil Car"', '|\\boil car|', '|oil car|'],
  ['the work-car words removed', '|snowplow|snow-plow|jordan spreader|engineering car|crane tender|boom tender', ''],
  ['the intermodal words removed', '|roadrailer|auto transport', ''],
  ['rapid discharge removed', '|rapid discharge', ''],
  ['low side car removed', '|low side car', ''],
  ['coil / stake / logging car removed', '|coil car|stake car|logging car', ''],
];
for (const [name, from, to] of UNDO) {
  T('C0 the fix "' + name + '" is in the file exactly once', SRC.split(from).length === 2);
  const planted = SRC.split(from).join(to);
  T('C  planted: ' + name + ' → section A goes red', checkMoves(bucketer(planted)).length > 0);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
