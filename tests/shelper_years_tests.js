// tests/shelper_years_tests.js
// S-Helper Service's years in the app start at 1990, not 1994.
// [stated] Brad 2026-11-04 "Widen it": NASG's gallery dates S-Helper's first trucks 1990 — before its
// first cars (1994). With the old 1994-2012 span the master-list check (tools/master-audit) flags every
// one of those trucks "year outside the era this tab covers", so Master Version 2.78 can only write
// their real year once this span is live.
//
// A · the span itself (ERAS.shelper in app/config.js — the ONE place it lives)
// B · the nine real S-Helper trucks (Row IDs from the S-Helper Service S tab) with Year Produced 1990
//     pass the app's own master-list check: no year-off-era flag
// C · PLANTED — the check still bites: the old 1994-2012 span flags all nine; a 1989 row and a 2013
//     row are flagged under the new span
// D · the period tag does not move: S-Helper stays Modern (browse.js map, and the span's own start)
//
// Run:  node tests/shelper_years_tests.js
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let fails = 0, passes = 0;
function T(name, ok, got) {
  if (ok) { passes++; console.log('PASS  ' + name); }
  else { fails++; console.log('FAIL  ' + name + (got !== undefined ? '\n      got: ' + JSON.stringify(got) : '')); }
}

const audit = require('../tools/master-audit/audit.js');
const A = audit.loadApp();

// ── A ──────────────────────────────────────────────────────────────────────
T('A1 S-Helper Service S covers 1990-2012', A.ERAS.shelper && A.ERAS.shelper.years === '1990-2012', A.ERAS.shelper && A.ERAS.shelper.years);
T('A2 label, prefix and maker unchanged', A.ERAS.shelper.label === 'S-Helper Service S' && A.ERAS.shelper.prefix === 'S-Helper'
  && A.ERAS.shelper.manufacturer === 'S-Helper Service');
const cfg = fs.readFileSync(path.join(ROOT, 'app', 'config.js'), 'utf8');
T('A3 the span is written once in config.js (no second copy to drift)', (cfg.match(/1990-2012/g) || []).length === 2   // the ERAS line + its comment
  && cfg.indexOf("years: '1994-2012'") === -1);

// ── B ──────────────────────────────────────────────────────────────────────
const HH = ['Item Number', 'Item Type', 'Description', 'Gauge', 'Year Produced', 'Variation #', 'Road Name', 'Row ID'];
const TRUCKS = [   // S-Helper Service S rows 3-6, 25, 47-50; NASG Trucks pages give "Year Introduced: 1990"
  ['1', 'Accessory', '70-ton Truck, friction bearing, Code 110, pair', 'S', '1990', '', '', 'JJK2T4KDUP'],
  ['2', 'Accessory', '70-ton Truck, friction bearing, hi-rail, pair', 'S', '1990', '', '', 'MBJ6QCBCY3'],
  ['3', 'Accessory', '70-ton Truck, roller bearing, Code 110, pair', 'S', '1990', '', '', 'UFJ5BTFQDW'],
  ['4', 'Accessory', '70-ton Truck, roller bearing, hi-rail, pair', 'S', '1990', '', '', 'RGDPRMRKMM'],
  ['23', 'Accessory', '70-ton Truck, roller bearing, Code 110, pair', 'S', '1990', '', '', 'HY6XKFPPKV'],
  ['45', 'Accessory', '50-ton Truck, Code 110, pair', 'S', '1990', '', '', 'ZYBR6DS37W'],
  ['46', 'Accessory', '50-ton Truck, hi-rail, pair', 'S', '1990', '', '', 'JXEU43HSD7'],
  ['47', 'Accessory', '50-ton Type Y Truck, Code 110, pair', 'S', '1990', '', '', 'XX6G6K8DR5'],
  ['48', 'Accessory', '50-ton Type Y Truck, hi-rail, pair', 'S', '1990', '', '', 'BVWS38NVPK'],
];
const TAB = { tab: 'S-Helper Service S', era: 'shelper' };
const offEra = res => res.flags.filter(f => f.rule === 'year-off-era');
const yearFlags = res => res.flags.filter(f => /^year-/.test(f.rule));
const now = audit.checkTab(A, TAB, [HH].concat(TRUCKS));
T('B1 the nine 1990 trucks raise no year flag of any kind', yearFlags(now).length === 0, yearFlags(now));
const later = audit.checkTab(A, TAB, [HH, ['1511', 'Hopper', 'Twin Hopper', 'S', '2001', '', 'B&O', 'SHAAAAAAAA'],
  ['9000', 'Boxcar', 'Boxcar', 'S', '2012', '', 'PRR', 'SHBBBBBBBB']]);
T('B2 years already inside the old span still pass (2001, 2012)', yearFlags(later).length === 0, yearFlags(later));

// ── C · PLANTED ────────────────────────────────────────────────────────────
const OLD = Object.assign({}, A, { ERAS: Object.assign({}, A.ERAS, { shelper: Object.assign({}, A.ERAS.shelper, { years: '1994-2012' }) }) });
const old = audit.checkTab(OLD, TAB, [HH].concat(TRUCKS));
T('C1 PLANTED: the old 1994-2012 span flags all nine trucks year-off-era — B1 is what changed', offEra(old).length === 9, offEra(old).length);
const edge = audit.checkTab(A, TAB, [HH, ['5', 'Accessory', 'Truck, pair', 'S', '1989', '', '', 'SHCCCCCCCC'],
  ['6', 'Accessory', 'Truck, pair', 'S', '2013', '', '', 'SHDDDDDDDD']]);
T('C2 PLANTED: 1989 and 2013 are still outside the span and still flagged', offEra(edge).length === 2, offEra(edge));

// ── D ──────────────────────────────────────────────────────────────────────
const browse = fs.readFileSync(path.join(ROOT, 'app', 'browse.js'), 'utf8');
T('D1 browse.js still files S-Helper under Modern', /\bshelper:\s*'modern'/.test(browse));
T('D2 the span starts after 1969 (the app reads 1970+ as Modern)', parseInt(A.ERAS.shelper.years, 10) > 1969);

console.log('\n' + passes + ' passed, ' + fails + ' failed');
process.exit(fails ? 1 : 0);
