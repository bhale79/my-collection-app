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


// ═══════════════════════════════════════════════════════════════
// v0.9.1800 — the PARTS-LIST road (Brad, 2026-09-23: MTH parts "so that it
// works like the lionel parts does in the maintenance page").
// MTH files parts the way its site does: item -> parts list -> parts. One screw
// fits 9,495 MTH items, so a Fits list cannot live in a cell (Google: 50,000
// characters; and a Fits list is never capped). The sheet's "Parts Lists"
// column holds list numbers on BOTH sides; _partsFitsIndex joins them.
// The fixture is the REAL data written to the sheet on 2026-09-24:
// harvests/mth-parts-lists-2026-09-24.json.
// ═══════════════════════════════════════════════════════════════
section('The parts-list road (v0.9.1800) — real MTH data');
const ad = rd('app-data.js');
function grabIn(src, sig) { const i = src.indexOf(sig); if (i < 0) return ''; let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } return ''; }
ok("MASTER_COL_SPEC maps 'partsLists' by the header \"Parts Lists\", name-only", /\['partsLists',\s*null,\s*\['partslists'\]\]/.test(ad));
const idxVars = (ad.match(/var _fitsIdx = null, _fitsIdxRows = null, _fitsIdxLen = -1;/) || [''])[0];
function build(srcAd) {
  const src = idxVars + '\n' + grabIn(srcAd, 'function _partsFitsIndex()') + '\n' + grabIn(srcAd, 'function _partsMakerOf(era)') + '\n' + grabIn(srcAd, 'function _partsForItem(itemNum, forEra)') + '\nreturn _partsForItem;';
  return (rows) => new Function('state', 'baseItemNum', 'ERAS', src)({ masterAllRows: rows, masterData: [] }, k => k, ERAS_MFR);
}
const ERAS_MFR = { mth_parts: { manufacturer: 'MTH' }, mth_o: { manufacturer: 'MTH' }, mth_ho: { manufacturer: 'MTH' }, mth_s: { manufacturer: 'MTH' }, mth_tinplate: { manufacturer: 'MTH' }, mth_g: { manufacturer: 'MTH' }, pw: { manufacturer: 'Lionel' }, lionel_parts: { manufacturer: 'Lionel' } };
const PL = JSON.parse(fs.readFileSync(path.join(H, 'mth-parts-lists-2026-09-24.json'), 'utf8'));
const TAB_ERA = { 'MTH O': 'mth_o', 'MTH HO': 'mth_ho', 'MTH S Gauge': 'mth_s', 'MTH Tinplate': 'mth_tinplate', 'MTH G Scale': 'mth_g' };
const REAL = [];
PL.tabs['MTH Parts'].forEach(x => REAL.push({ itemNum: x[1], itemType: 'Part', partsLists: x[2], _era: 'mth_parts', _tab: 'MTH Parts', variation: '' }));
Object.keys(TAB_ERA).forEach(t => PL.tabs[t].forEach((x, i) => REAL.push({ itemNum: x[1], itemType: 'Locomotive', partsLists: x[2], _era: TAB_ERA[t], _tab: t, variation: String(i) })));
ok('the fixture is the real write: 18,769 part rows, 37,635 item rows, header "Parts Lists"', PL.header === 'Parts Lists' && PL.tabs['MTH Parts'].length === 18769 && Object.keys(TAB_ERA).reduce((n, t) => n + PL.tabs[t].length, 0) === 37635);
ok('no Parts Lists cell comes anywhere near the 50,000-character limit (longest under 1,000)', Object.values(PL.tabs).every(rows => rows.every(x => x[2].length < 1000)));
const pfi = build(ad)(REAL);
const tender = pfi('20-3253-1', 'mth_o').map(r => r.itemNum);
ok('20-3253-1 (Premier PRR Decapod) is offered the parts on its list — including its own tender, 20-3253-1', tender.length > 100 && tender.indexOf('20-3253-1') >= 0, String(tender.length));
// Reverse check, the way the 2026-09-22 join counted it: how many items does a part fit?
const seenNums = {}; let axle = 0, goose = 0, screw = 0;
REAL.forEach(r => { if (r.itemType === 'Part' || seenNums[r.itemNum]) return; seenNums[r.itemNum] = 1; const ps = pfi(r.itemNum, r._era).map(p => p.itemNum); if (ps.indexOf('TPSF00010') >= 0) axle++; if (ps.indexOf('DA2230002') >= 0) goose++; if (ps.indexOf('IA0000003') >= 0) screw++; });
ok('TPSF00010 (Standard Gauge axle) fits 287 items — the audited answer', axle === 287, String(axle));
ok('DA2230002 (Galloping Goose pilot truck) fits 22 items — the audited answer', goose === 22, String(goose));
ok('IA0000003 (the screw) fits all 9,495 items — nothing capped', screw === 9495, String(screw));
ok('an MTH number asked about as a LIONEL item gets no MTH parts (maker guard)', pfi('20-3253-1', 'pw').length === 0);
// Synthetic edges, each with its own offender below.
const EDGE = [
  { itemNum: 'P1', itemType: 'Part', partsLists: '7', _era: 'mth_parts', _tab: 'MTH Parts' },
  { itemNum: 'P2', itemType: 'Part', partsLists: '8', _era: 'mth_parts', _tab: 'MTH Parts' },
  { itemNum: 'L1', itemType: 'Part', partsLists: '7', _era: 'lionel_parts', _tab: 'Lionel Parts' },
  { itemNum: '1234', itemType: 'Boxcar', partsLists: '7', _era: 'mth_o', _tab: 'MTH O' },
  { itemNum: '1234', itemType: 'Boxcar', partsLists: '8', _era: 'mth_ho', _tab: 'MTH HO' },
  { itemNum: '1234', itemType: 'Boxcar', partsLists: '7', _era: 'pw', _tab: 'PW Items' },
];
const edge = build(ad)(EDGE);
const nm = a => a.map(r => r.itemNum).sort().join(',');
ok('same number on MTH O and MTH HO: the item\'s OWN era\'s lists answer (HO → P2 only)', nm(edge('1234', 'mth_ho')) === 'P2', nm(edge('1234', 'mth_ho')));
ok('a list number belongs to its MAKER: Lionel part L1 on a "list 7" never answers an MTH item', nm(edge('1234', 'mth_o')) === 'P1', nm(edge('1234', 'mth_o')));
ok('a Lionel item row carrying "7" pulls no MTH part', nm(edge('1234', 'pw')).indexOf('P1') < 0);
ok('the Fits road is untouched: a Fits-only part still answers', nm(build(ad)([{ itemNum: 'F1', itemType: 'Part', fits: '1234; 99', _era: 'mth_parts', _tab: 'MTH Parts' }])('1234', 'mth_o')) === 'F1');
section('Planted offenders — each must turn the matching check red');
function offend(from, to) { if (ad.indexOf(from) < 0) return null; return build(ad.replace(from, to)); }
const o1 = offend("return e.era === forEra; })", "return true; })");
ok('OFFENDER: drop the own-era preference → HO item also gets MTH O\'s part', !!o1 && nm(o1(EDGE)('1234', 'mth_ho')) !== 'P2');
const o2 = offend("var lk = mk + '|' + id", "var lk = '|' + id");
ok('OFFENDER: key lists without the maker → the list is lost or crosses makers', !!o2 && nm(o2(EDGE)('1234', 'mth_o')) !== 'P1');

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
