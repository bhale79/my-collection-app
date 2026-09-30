#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════
// type_overrides_retired_tests.js — v0.9.1845: a NUMBER never decides a type
//
// type-groups.js used to keep 109 item numbers ("600" → Flatcar, "900" →
// Boxcar …) and force that word onto EVERY row with the number, on every
// maker's tab. Measured 2026-09-30 on the live master: 43 rows on 14 tabs
// were shown as the wrong type because of it, and no row was helped. The
// table is retired; the row's own Item Type decides.
//
// A · the REAL getTypeBucket (type-groups.js run as the page runs it) on the
//     measured rows: each shows as its own type.
// B · a row with no type is not given one by its number.
// C · the scans: no by-number table, no lookup keyed on the item number, no
//     MANUAL_TYPE_OVERRIDES anywhere in app/ — each with a planted offender.
// ════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const APP = path.join(__dirname, '..', 'app');
const SRC = fs.readFileSync(path.join(APP, 'type-groups.js'), 'utf8');

let pass = 0, fail = 0;
function T(n, cond, detail) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail)));
  cond ? pass++ : fail++;
}
function load(src) { const w = {}; new Function('window', src)(w); return w; }

// The rows the old table got wrong, as they stand on the master (tab, number, own type, words) → what they are.
const MEASURED = [
  ['Lionel Pre-War',             '600',   'Passenger Car',     'Passenger Cars',                                   'Passenger Car'],
  ['Lionel PW - Items',          '600',   'Diesel Locomotive', 'NW2 Switcher',                                     'Diesel Locomotive'],
  ['American Flyer S - Gilbert', '600',   'Accessory',         'Crossing Gate with bell',                          'Accessory'],
  ['S-Helper Service S',         '600',   'Caboose',           'Reading Extended Vision Caboose #2',               'Caboose'],
  ['Marx O',                     '600',   'Part',              '600 O Gauge Track Connector Lockon',               'Part'],
  ['American Flyer S - Gilbert', '780',   'Set',               'Trestle Set',                                      'Set'],
  ['S-Helper Service S',         '780',   'Hopper',            'Virginian Composite Side Hopper 3-pack',           'Hopper'],
  ['American Flyer S - Gilbert', '900',   'Passenger Car',     'NP Combination Car',                               'Passenger Car'],
  ['S-Helper Service S',         '900',   'Diesel Locomotive', 'ATSF Passenger F7 Diesel ABA, phase I',            'Diesel Locomotive'],
  ['Lionel Pre-War',             '900',   'Operating Freight', 'Ammunition Car',                                   'Operating Freight'],
  ['S-Helper Service S',         '1519',  'Diesel Locomotive', 'B&M SW8 Diesel #2, AC/DC LocoMatic sound',         'Diesel Locomotive'],
  ['Atlas N',                    '2957',  'Flatcar',           'BALTIMORE & OHIO* (Silver/Blue/Yellow)',           'Flatcar'],
  ['Marx O',                     '6112',  'Accessory',         'Cape Canaveral Rocket Accessories',                'Accessory'],
  ['Atlas O',                    '6575',  'Boxcar',            'BANGOR & AROOSTOOK',                               'Boxcar'],
  ['Bachmann HO',                '16818', 'Caboose',           'Northeast Steel Caboose - Boston & Maine #C-120',  'Caboose'],
  ['LGB G',                      '19913', 'Track',             '19913 G Outdoor Switch Control Set',               'Track'],
  ['American Flyer S - Gilbert', '26122', 'Track',             'Straight Panel with whistle',                      'Track'],
  ['Atlas N',                    '52183', 'Diesel Locomotive', 'ERIE LACKAWANNA (Black/Yellow "Lackawanna")',      'Diesel Locomotive'],
  ['LGB G',                      '52120', 'Transformer',       'Electronic Locomotive Controller, 5 Amps',         'Transformer/Power'],
];
function wrongOn(w) {
  return MEASURED.filter(r => w.getTypeBucket({ itemNum: r[1], itemType: r[2], description: r[3] }) !== r[4])
                 .map(r => r[0] + ' ' + r[1] + ': ' + w.getTypeBucket({ itemNum: r[1], itemType: r[2], description: r[3] }));
}

const W = load(SRC);
console.log('\n== A · each measured row shows as its own type ==');
T('A1  the real getTypeBucket files all ' + MEASURED.length + ' measured rows by their own type', wrongOn(W).length === 0, wrongOn(W));
T('A2  the table is not exposed any more', W.MANUAL_TYPE_OVERRIDES === undefined);
// the offender: the old behaviour put back — a number looked up before the row's type
const OFFENDER = SRC.replace('function getTypeBucket(item) {\n    if (!item) return \'\';',
  'function getTypeBucket(item) {\n    if (!item) return \'\';\n    var _OLD = { \'600\': \'Flatcar\', \'900\': \'Boxcar\', \'16818\': \'Boxcar\' }; if (_OLD[item.itemNum]) return _OLD[item.itemNum];');
T('A3  (offender) the old number-first lookup put back — A1 goes red on it', OFFENDER !== SRC && wrongOn(load(OFFENDER)).length >= 5, wrongOn(load(OFFENDER)).length);

console.log('\n== B · a number alone never names a type ==');
T('B1  a catalog row numbered 900 with no type and no words is not called a Boxcar', W.getTypeBucket({ itemNum: '900', itemType: '', description: '' }) !== 'Boxcar');
T('B2  a collector\'s own row keeps the word they typed', W.getTypeBucket({ itemNum: '900', itemType: 'Caboose', description: 'x', _personalOnly: true }) === 'Caboose');
T('B3  the same number on two tabs can be two types', W.getTypeBucket({ itemNum: '600', itemType: 'Passenger Car', description: '' }) === 'Passenger Car'
  && W.getTypeBucket({ itemNum: '600', itemType: 'Accessory', description: '' }) === 'Accessory');

console.log('\n== C · the scans (full-line comments stripped; every app file) ==');
const code = s => s.replace(/^\s*\/\/[^\n]*$/gm, '');
const BUCKET_WORDS = '(?:Boxcar|Flatcar|Caboose|Hopper|Gondola|Tank Car|Stock Car|Intermodal|Passenger Car|Operating Freight|Set|Accessory|Track|Steam Locomotive|Diesel Locomotive|Electric Locomotive)';
const TABLE = new RegExp("'\\w*\\d{3,}\\w*'\\s*:\\s*'" + BUCKET_WORDS + "'\\s*,\\s*'\\w*\\d{3,}\\w*'\\s*:\\s*'" + BUCKET_WORDS + "'");
const LOOKUP = /\[\s*item\.itemNum\s*\]/;
const hasTable = s => TABLE.test(code(s)), hasLookup = s => LOOKUP.test(code(s));
T('C1  type-groups.js holds no table of item numbers → type words', !hasTable(SRC));
T('C2  …and looks nothing up by item.itemNum', !hasLookup(SRC));
T('C3  (offender) the old table and lookup are both caught', hasTable("var X = { '600': 'Flatcar', '900': 'Boxcar' };") && hasLookup(OFFENDER));
T('C4  (offender) a table written only inside a comment is not an offender', !hasTable("  // '600': 'Flatcar', '900': 'Boxcar'"));
const users = fs.readdirSync(APP).filter(f => /\.(js|html)$/.test(f)).filter(f => /MANUAL_TYPE_OVERRIDES/.test(code(fs.readFileSync(path.join(APP, f), 'utf8'))));
T('C5  no file in app/ uses MANUAL_TYPE_OVERRIDES', users.length === 0, users);
T('C6  (offender) a file that did would be caught', /MANUAL_TYPE_OVERRIDES/.test(code('  if (window.MANUAL_TYPE_OVERRIDES[n]) x();')));

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
