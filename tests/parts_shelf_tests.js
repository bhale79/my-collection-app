#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// parts_shelf_tests.js — a part gets its own shelf, "Parts" (2026-10-31)
//
// [stated] Brad: "yes" (2026-10-29) to teaching the app the word "Part" (30 RMT
// rows typed Part landed on no shelf), then "yes" (2026-10-31) to a shelf of
// its own instead of Accessory once it was measured: the word sits on 3,144
// master rows on 12 tabs (Kato Parts 2,134, K-Line O 794, Marx O 87, Williams
// O 52, RMT O 30, Bachmann HO 17, T-Reproductions 15, Lionel MPC-Modern 5,
// Bachmann All Scales 5, LGB G 3, Lionel Modern S 1, USA Trains G 1 — audit
// 2026-10-30b), and thousands of screws and lenses on the Accessory shelf would
// bury the water towers.
//
// A · the bucket list: 25 entries, "Parts" between Paper and Passenger
//     (alphabetical by label); the dashboard rolls it up with Accessories.
// B · REAL master rows (copied from the sheet 2026-10-30) through the REAL
//     getTypeBucket: every row typed Part → Parts, in any case; "Parts" too;
//     Accessory rows stay Accessory; "Parts/Supplies" stays Accessory (Brad's
//     supplies-stay-Accessory rule, 2.13); a word that only CONTAINS "part"
//     ("Party Car", "Apartment") is not a part.
// C · the master audit's "type-unknown" rule sees Part as a known bucket now.
// P · PLANTED: the rule removed, the list entry removed, Part sent to
//     Accessory, the roll-up dropped — each must turn its check red.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const APP = path.join(__dirname, '..', 'app');
const src = (f) => fs.readFileSync(path.join(APP, f), 'utf8');
const TG = src('type-groups.js'), CFG = src('config.js');

let pass = 0, fail = 0;
function T(n, cond, detail) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (detail === undefined ? '' : JSON.stringify(detail))));
  cond ? pass++ : fail++;
}
function section(t) { console.log('\n== ' + t + ' =='); }
function liftTG(s) { const w = {}; new Function('window', s)(w); return w; }

// Real rows: [tab, item number, Item Type, description] — as the sheet holds them.
const PART_ROWS = [
  ['RMT O', 'RMT-20249-904', 'Part', 'Woodchip Load'],
  ['RMT O', 'RMT-22-326', 'Part', 'Mini F-3 Diesel Loco Generator Intake & Exhaust Covers (Set of 2)'],
  ['RMT O', 'RMT-2301', 'Part', 'Diesel Power Chassis'],
  ['K-Line O', 'K3790-X023', 'Part', 'K3790-X023 #8-36 x 5/8" Flat Head Blackened Shoulder Screw'],
  ['K-Line O', 'K2200-27', 'Part', 'K2200-27 3-Chime Plastic Ornamental Horn'],
  ['K-Line O', 'K6300-7A', 'Part', 'K6300-7A Blank Silver Plastic Placard'],
  ['Williams O', '00258', 'Part', '00258 O GE 44-Ton True Blast Plus Sound Unit'],
  ['Marx O', '0226-1', 'Part', '0226-1 "Halo" Shampoo Billboard Insert'],
  ['Marx O', '0446-26', 'Part', '0446-26 Green Beacon Lens'],
  ['Marx O', '0605X', 'Part', '0605X Dead End Bumper w/o Lens'],
];
const ACC_ROWS = [
  ['K-Line O', '6-21355', 'Accessory', '6-21355 O Scale By Lionel Dump Bin'],
  ['Williams O', '00233', 'Accessory', '00233 O 80 Watt Transformer'],
  ['Marx O', '1239', 'Accessory', '1239 Vintage O 50 Watt Transformer'],
  ['RMT O', 'RMT-992301', 'Accessory', 'Set of Roller Bearing style freight car trucks with diecast wheels'],
];
const row = r => ({ itemNum: r[1], itemType: r[2], description: r[3] });

function story(tg, cfg) {
  const R = {};
  const w = liftTG(tg);
  const B = w.TYPE_BUCKETS || [];
  const labels = B.map(b => b.label);
  R.count25 = B.length === 25;
  R.seated = labels.indexOf('Parts') === labels.indexOf('Paper') + 1 && labels.indexOf('Passenger') === labels.indexOf('Parts') + 1
    && B[labels.indexOf('Parts')].id === 'Parts';
  R.alpha = labels.map(l => l.toLowerCase()).every((x, i, a) => i === 0 || a[i - 1] < x);
  R.rollup = /\['Accessories',\s*\[[^\]]*'Parts'[^\]]*\]\]/.test(cfg);
  R.allParts = PART_ROWS.every(r => w.getTypeBucket(row(r)) === 'Parts');
  R.anyCase = ['part', 'PART', 'Part', 'Parts', 'parts'].every(t => w.getTypeBucket({ itemNum: 'X1', itemType: t, description: 'a part' }) === 'Parts');
  R.label = w.getTypeBucketLabel({ itemType: 'Part', description: 'Green Beacon Lens' }) === 'Parts';
  R.accStays = ACC_ROWS.every(r => w.getTypeBucket(row(r)) === 'Accessory');
  R.suppliesStay = w.getTypeBucket({ itemNum: 'X2', itemType: 'Parts/Supplies', description: 'Smoke fluid' }) === 'Accessory';
  R.notInside = w.getTypeBucket({ itemNum: 'X3', itemType: 'Party Car', description: 'Party Car' }) !== 'Parts'
    && w.getTypeBucket({ itemNum: 'X4', itemType: 'Apartment', description: 'Apartment building' }) !== 'Parts';
  R.auditKnows = B.some(b => b.id === w.getTypeBucket({ itemType: 'Part', description: 'x' }));
  return R;
}

section('A · the bucket list');
const R = story(TG, CFG);
T('A1 25 buckets', R.count25);
T('A2 "Parts" sits between Paper and Passenger, id "Parts"', R.seated);
T('A3 labels still in alphabetical order', R.alpha);
T('A4 the dashboard rolls Parts up with Accessories (the ONE group list, config.js)', R.rollup);

section('B · real master rows');
T('B1 every real row typed Part files on Parts (RMT, K-Line, Williams, Marx)', R.allParts);
T('B2 any case, and "Parts", files on Parts', R.anyCase);
T('B3 the label reads "Parts"', R.label);
T('B4 real Accessory rows stay Accessory', R.accStays);
T('B5 "Parts/Supplies" stays Accessory (supplies stay Accessory, 2.13)', R.suppliesStay);
T('B6 a word that only contains "part" is not a part', R.notInside);

section('C · the master audit');
T('C1 Part is a known bucket now (the audit\'s type-unknown rule clears)', R.auditKnows);

section('P · planted offenders');
const plant = (name, file, from, to, key) => {
  const base = file === 'tg' ? TG : CFG;
  if (base.split(from).length !== 2) { T('P0 the line for "' + name + '" is in the file exactly once', false); return; }
  const out = file === 'tg' ? story(base.split(from).join(to), CFG) : story(TG, base.split(from).join(to));
  T('P  planted: ' + name + ' → caught', !out[key]);
};
plant('the Part rule removed', 'tg', "    if (it === 'Part' || it === 'Parts') return 'Parts';\n", '', 'allParts');
plant('the Parts entry removed from the list', 'tg', "    { id: 'Parts',                label: 'Parts'        },", '', 'count25');
plant('Part sent to Accessory', 'tg', "if (it === 'Part' || it === 'Parts') return 'Parts';", "if (it === 'Part' || it === 'Parts') return 'Accessory';", 'allParts');
plant('Parts/Supplies moved off Accessory onto Parts', 'tg', "it === 'Parts/Supplies' || it === 'Dealer Layout') return 'Accessory';", "it === 'Dealer Layout') return 'Accessory';\n    if (it === 'Parts/Supplies') return 'Parts';", 'suppliesStay');
plant('the dashboard roll-up dropped', 'cfg', ", 'Parts']],", "]],", 'rollup');
plant('lower-case "part" no longer canonised', 'tg', "'Parts/Supplies', 'Part', 'Parts', 'Dealer Layout'", "'Parts/Supplies', 'Dealer Layout'", 'anyCase');

console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILURES') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
