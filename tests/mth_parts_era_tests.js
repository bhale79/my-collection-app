// ═══════════════════════════════════════════════════════════════
// mth_parts_era_tests.js — v0.9.1750.
//
// Brad, 2026-09-15: "what about mth parts?" → MTH's official parts arm, MTH
// Parts & Sales (mthpartsandsales.com), publishes exploded-view part lists —
// one mechanical, one electronics — per product family, each with part
// number, name, callout, price and stock. 432 lists were read (364 found by
// product search + 70 more by walking the id range), giving one row per
// part number with "fits" = the list titles and the product names that use
// each list. Nothing invented.
//
// Same shape as Lionel Parts: a LOOKUP-ONLY era. This suite pins the wiring
// and the rows file.
// Run:  node tests/mth_parts_era_tests.js
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

section('The era is wired like lionel_parts');
ok('ERAS carries mth_parts, attributed to MTH, and (v0.9.1759) marked as the maker\'s own parts store', /mth_parts:\s*\{\s*id:\s*'mth_parts',\s*label:\s*'MTH Parts'[^}]*manufacturer:\s*'MTH',\s*partsOfficial:\s*true\s*\}/.test(cfg));
ok('REAL_ERA_IDS lists it', /REAL_ERA_IDS\s*=\s*\[[^\]]*'mth_parts'/.test(cfg));
ok('ERA_SCALE is blank on purpose (MTH parts span O, HO, S, G and tinplate)', /mth_parts:\s*'',\s*\/\/[^\n]*blank on purpose/.test(cfg));
ok('ERA_TABS points at "MTH Parts"', /mth_parts:\s*\{\s*items:\s*'MTH Parts'\s*\}/.test(cfg));
ok('it is LOOKUP-ONLY, beside lionel_parts (v0.9.1755: and traintender_parts)', /const LOOKUP_ONLY_ERAS = \['lionel_parts', 'mth_parts'(, '[a-z_]+')*\];/.test(cfg));
ok('browse period, eraScale and eraColors (by reference to mth_o) stay complete', /mth_parts:\s*'modern'/.test(br) && /mth_parts:\s*'o'/.test(ob) && /WHAT_I_COLLECT\.eraColors\.mth_parts = WHAT_I_COLLECT\.eraColors\.mth_o;/.test(ob));

section('The rows file (harvests/mth-parts-1..3.json)');
const H = path.join(__dirname, '..', 'harvests');
const parts = [1, 2, 3].map(k => JSON.parse(fs.readFileSync(path.join(H, 'mth-parts-' + k + '.json'), 'utf8')));
const rows = parts[0].rows.concat(parts[1].rows, parts[2].rows);
ok('three files, thirds of one row set, same header, tab MTH Parts', parts.every(p => p.totalRows === rows.length && p.tab === 'MTH Parts' && JSON.stringify(p.header) === JSON.stringify(parts[0].header)));
ok('26 columns, the Lionel Parts layout', parts[0].header.length === 26 && parts[0].header[23] === 'Fits' && parts[0].header[24] === 'Diagrams' && parts[0].header[25] === 'Image URL' && rows.every(r => r.length === 26));
ok('a real harvest: more than 18,000 part rows', rows.length > 18000, String(rows.length));
ok('every row has an MTH part number (two letters + digits, e.g. DA1230004) — none filed by name', rows.every(r => /^[A-Z]{2}\d{7}[A-Z]?$|^\d{2}-\d{4}[A-Z]?$|^[A-Z0-9-]{4,}$/.test(r[0])) && !rows.some(r => /No part number printed/.test(r[13])));
ok('every row is typed Part, category Parts, gauge left blank (the lists span MTH\'s lines)', rows.every(r => r[1] === 'Part' && r[18] === 'Parts' && r[8] === ''));
ok('every row carries a price and a stock note', rows.every(r => r[20] && /stock at MTH Parts & Sales when read/.test(r[13])));
ok('every row knows what it fits (list title, then the products that use the list)', rows.every(r => r[23]));
ok('every row links to MTH\'s own service-parts search for that number', rows.every(r => r[12] === 'https://www.mthpartsandsales.com/shop/search/results?type=serviceparts&searchContext=' + r[0]));
ok('every row names which list(s) and callout it came from', rows.every(r => r[24]));
ok('item numbers are unique (one row per part number)', new Set(rows.map(r => r[0])).size === rows.length);
ok('the source names the read', rows.every(r => /MTH Parts & Sales exploded-view part lists/.test(r[15])));
ok('MTH\'s own "Fake List" test page was left out', !rows.some(r => /Fake List/.test(r[24])));
const truck = rows.find(r => r[0] === 'DA1230004');
ok('spot check: DA1230004 (RailKing 4-wheel pilot truck) fits the GS-4 Daylight list', !!truck && /GS-4/.test(truck[23]), truck && truck[23].slice(0, 120));
ok('Fits and Diagrams cells are capped so no cell overflows Sheets', rows.every(r => r[23].length <= 2000 && r[24].length <= 1500));

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
