// ═══════════════════════════════════════════════════════════════
// trepro_era_tests.js — v0.9.1747.
//
// Brad, 2026-09-14: "check out what you can find on getting a t-reproductions
// list for our master list" → "yes" to a tab. No maker catalog exists; the
// company is defunct and its domain is parked. But its own website survives
// in the Wayback Machine (readable from Brad's Chrome, not from the cloud),
// and it lists every item they sold 2011–2019 with numbers and prices.
//
// What they made is NOT what collectors assume: the Buddy L 3¼-inch-gauge
// pressed-steel outdoor railroad (under license), accessories, parts. The
// Lionel-pattern tinplate (129 terrace, 840 power house…) shows only on the
// parts list. So the tab is 44 rows: 18 trains, 11 accessories, 15 parts.
//
// A new maker era touches six places; a miss in any one loads a broken tab
// (v1719's lesson). This suite pins all six, the rows file the master tab is
// written from, and that no item number was invented.
// Run:  node tests/trepro_era_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const rd = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
const cfg = rd('config.js'), br = rd('browse.js'), ob = rd('onboarding-config.js');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

section('The era is wired in every place a maker era must be');
ok('ERAS carries trepro, labelled and attributed', /trepro:\s*\{\s*id:\s*'trepro',\s*label:\s*'T-Reproductions'[^}]*manufacturer:\s*'T-Reproductions'\s*\}/.test(cfg));
ok('REAL_ERA_IDS lists it', /REAL_ERA_IDS\s*=\s*\[[^\]]*'trepro'/.test(cfg));
ok('ERA_SCALE says 3¼" — its own gauge, not O, Standard or G', /trepro:\s*'3¼"'/.test(cfg));
ok('ERA_TABS points at the master tab "T-Reproductions"', /trepro:\s*\{\s*items:\s*'T-Reproductions'\s*\}/.test(cfg));
ok('browse.js files it as a modern era', /trepro:\s*'modern'/.test(br));
ok('onboarding: placed in eraOrder', /eraOrder:\s*\[[^\]]*'trepro'/.test(ob));
ok('onboarding: pickable under the G chip (nearest large-scale bucket), with the reason written', /trepro:\s*'g',\s*\/\/[^\n]*no chip of its own/.test(ob));
ok('onboarding: manufacturer key equals ERAS.trepro.manufacturer lowercased', /'t-reproductions':\s*\{\s*id:\s*'t-reproductions',\s*label:\s*'T-Reproductions'/.test(ob));
ok('onboarding: colour by REFERENCE (no new literal for the ratchet)', /WHAT_I_COLLECT\.eraColors\.trepro = WHAT_I_COLLECT\.eraColors\.lgb;/.test(ob) && !/trepro:\s*'#/.test(ob));

section('The rows file the master tab is written from');
const F = path.join(__dirname, '..', 'harvests', 'trep-tab.json');
ok('harvests/trep-tab.json exists', fs.existsSync(F));
const d = JSON.parse(fs.readFileSync(F, 'utf8'));
ok('tab name matches ERA_TABS', d.tab === 'T-Reproductions');
ok('44 rows', d.rows.length === 44, String(d.rows.length));
ok('23 columns, the Micro-Trains N / Kato N layout', d.header.length === 23 && d.header[0] === 'Item Number' && d.header[22] === 'Stamped Markings' && d.rows.every(r => r.length === 23));
ok('every row has an item number', d.rows.every(r => String(r[0]).trim()));
const keys = d.rows.map(r => r[0] + '|' + r[10]);
ok('item number + variation is unique on every row', new Set(keys).size === keys.length);
ok('every row is 3¼" gauge', d.rows.every(r => r[8] === '3¼"'));
ok('every row names its source', d.rows.every(r => /Wayback/.test(r[15])));
ok('every row carries a reference link into the Wayback Machine', d.rows.every(r => /^https:\/\/web\.archive\.org\/web\/20\d\d\//.test(r[12])));
const types = {}; d.rows.forEach(r => { types[r[1]] = (types[r[1]] || 0) + 1; });
ok('item types are the master\'s own strings', Object.keys(types).every(t => ['Steam Locomotive', 'Diesel Locomotive', 'Tender', 'Passenger Car', 'Caboose', 'Reefer', 'Boxcar', 'Motorized Unit', 'Vehicle', 'Accessory', 'Part'].indexOf(t) >= 0), JSON.stringify(types));
ok('18 trains, 11 accessories, 15 parts', d.rows.filter(r => r[18] === 'Trains').length === 18 && d.rows.filter(r => r[18] === 'Accessories').length === 11 && d.rows.filter(r => r[18] === 'Parts').length === 15);

section('Nothing invented: the site\'s own collisions are kept and explained');
const byNum = {}; d.rows.forEach(r => { (byNum[r[0]] = byNum[r[0]] || []).push(r); });
['2011-RX', '3008', '901-W', '1003-P'].forEach(n => {
  const rs = byNum[n] || [];
  ok(n + ' appears more than once, as the site printed it', rs.length >= 2, String(rs.length));
  ok(n + ': all but one copy carry a Variation, and a Notes line explains the collision', rs.filter(r => r[10]).length >= rs.length - 1 && rs.some(r => /site printed/.test(r[13])));
});
ok('the tugboat number is flagged as an auction number, not the maker\'s', /auction listing/.test((byNum['3000'] || [[]])[0][13] || ''));
ok('the Lionel-pattern numbers (114/115/116/840/129/300) are PARTS rows, not reproductions', ['114', '115', '116', '840', '129', '300'].every(n => byNum[n] && byNum[n][0][1] === 'Part' && /price on inquiry/.test(byNum[n][0][7])));
ok('the Hudson is the only powered steam locomotive; the Switch Engine the only diesel', types['Steam Locomotive'] === 1 && types['Diesel Locomotive'] === 1);

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
