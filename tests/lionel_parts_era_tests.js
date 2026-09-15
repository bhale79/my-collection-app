// ═══════════════════════════════════════════════════════════════
// lionel_parts_era_tests.js — v0.9.1749.
//
// Brad, 2026-09-14: "i also thought we were going to build a parts master
// list" → scouted trainz.com / lionelsupport.com / others → "yes" to the
// Trainz harvest. 684 exploded parts diagrams (postwar → LTI, plus six
// American Flyer) give one row per part number with the items it fits.
//
// The catch: a parts catalog is for LOOKUPS, not browsing. Nobody wants
// 30,000 screws in Master Catalog. So this release adds the idea of a
// LOOKUP-ONLY era: in REAL_ERA_IDS (the background full-catalog index fetches
// and caches it; the Yardmaster can file rows into its tab), but never loaded
// at startup, never in browse, never a card in What I Collect. findMaster()
// answers from the index — that is what the drawer's "fits" line reads.
// Run:  node tests/lionel_parts_era_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const rd = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
const cfg = rd('config.js'), app = rd('app.js'), data = rd('app-data.js'), br = rd('browse.js'), ob = rd('onboarding-config.js'), obj = rd('onboarding.js'), mt = rd('maintenance.js');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

section('The era is wired everywhere a maker era must be');
ok('ERAS carries lionel_parts, attributed to Lionel', /lionel_parts:\s*\{\s*id:\s*'lionel_parts',\s*label:\s*'Lionel Parts'[^}]*manufacturer:\s*'Lionel'\s*\}/.test(cfg));
ok('REAL_ERA_IDS lists it (so the lookup index fetches it and the Yardmaster can file into it)', /REAL_ERA_IDS\s*=\s*\[[^\]]*'lionel_parts'/.test(cfg));
ok('ERA_SCALE is blank on purpose (parts span O and S; the Gauge column says which)', /lionel_parts:\s*'',\s*\/\/[^\n]*blank on purpose/.test(cfg));
ok('ERA_TABS points at the master tab "Lionel Parts"', /lionel_parts:\s*\{\s*items:\s*'Lionel Parts'\s*\}/.test(cfg));
ok('browse.js gives it a period (never gates it, but the map stays complete)', /lionel_parts:\s*'modern'/.test(br));
ok('onboarding eraScale and eraColors stay complete (colour by reference)', /lionel_parts:\s*'o'/.test(ob) && /WHAT_I_COLLECT\.eraColors\.lionel_parts = WHAT_I_COLLECT\.eraColors\.pw;/.test(ob));

section('LOOKUP-ONLY: in the index, out of the browse');
ok('config declares LOOKUP_ONLY_ERAS with lionel_parts, and exposes it on window', /const LOOKUP_ONLY_ERAS = \['lionel_parts'(, '[a-z_]+')*\];/.test(cfg) && /window\.LOOKUP_ONLY_ERAS = LOOKUP_ONLY_ERAS/.test(cfg));
ok('_isEraEnabled says NO for a lookup-only era before any preference is consulted', /function _isEraEnabled\(era\) \{[^}]*if \(era === 'all'\) return true;\s*\n\s*\/\/[^\n]*\n\s*if \(typeof LOOKUP_ONLY_ERAS !== 'undefined' && LOOKUP_ONLY_ERAS\.indexOf\(era\) >= 0\) return false;/.test(app));
ok('the startup load filters through _isEraEnabled (so the parts tab never loads for display)', /realEras\.filter\(function\(e\) \{ return _isEraEnabled\(e\); \}\)/.test(app));
ok('the background full-catalog index takes REAL_ERA_IDS whole (so the parts tab IS fetched and cached for lookups)', /_buildAllErasLookupIndex[\s\S]*?REAL_ERA_IDS\.slice\(\)/.test(data));
ok('the What I Collect picker skips lookup-only eras', /LOOKUP_ONLY_ERAS\.indexOf\(k\) < 0/.test(obj));
ok('the Yardmaster tab list still comes from REAL_ERA_IDS → ERA_TABS (Lionel Parts is a valid target tab)', /REAL_ERA_IDS\.forEach\(function \(id\) \{\s*var t = ERA_TABS\[id\] && ERA_TABS\[id\]\.items;/.test(rd('yardmaster.js')));

section('The parts catalog columns are read by header');
ok("MASTER_COL_SPEC maps 'fits' by header, name-only", /\['fits',\s*null,\s*\['fits'\]\]/.test(data));
ok("MASTER_COL_SPEC maps 'diagrams' by header, name-only", /\['diagrams',\s*null,\s*\['diagrams'\]\]/.test(data));

section('The drawer reads Fits from a catalog part row');
// lift the real _binFits with a fake findMaster that returns a Lionel Parts row
function grab(sig) { const i = mt.indexOf(sig); let d = 0; for (let k = mt.indexOf('{', i); k < mt.length; k++) { if (mt[k] === '{') d++; else if (mt[k] === '}') { d--; if (!d) return mt.slice(i, k + 1); } } return ''; }
const MASTER = {
  '622-12': { itemNum: '622-12', itemType: 'Part', description: 'Short Cloudy Headlight Lens', fits: '2023; 2031; 2032; 622', refLink: 'https://www.trainz.com/products/lionel-622-12-short-cloudy-headlight-lens', variation: 'Reproduction', _era: 'lionel_parts' },
  '2023': { itemNum: '2023', roadName: 'Union Pacific', itemType: 'Diesel Locomotive' },
  '2031': { itemNum: '2031', roadName: 'Rock Island', itemType: 'Diesel Locomotive' },
  '2032': { itemNum: '2032', roadName: 'Erie', itemType: 'Diesel Locomotive' },
  '622': { itemNum: '622', roadName: 'Santa Fe', itemType: 'Diesel Locomotive' },
};
const st = { personalData: { i1: { inventoryId: 'i1', itemNum: '2031', owned: true } }, partsData: {} };
const fits = new Function('state', 'findMaster', 'baseItemNum',
  grab('function _binItemFromPartNum(partNum)') + '\n' + grab('function _binOwnedCopies(itemNum)') + '\n' + grab('function _binTopicWords(b)') + '\n' + grab('function _binFits(b)') + '\nreturn _binFits;')(
  st, n => MASTER[String(n)] || null, n => String(n || '').replace(/[-]?[PDTC]$/i, ''));
const r = fits({ id: 'b1', partNum: '622-12', desc: 'headlight lens', qty: 2 });
const cat = r.find(x => x.kind === 'catalog');
ok('a loose 622-12 finds the Lionel Parts row and its four fits, each looked up by road name', !!cat && cat.fits.length === 4 && cat.fits.map(x => x.label).join('|') === '2023 Union Pacific|2031 Rock Island|2032 Erie|622 Santa Fe', JSON.stringify(cat));
ok('…the one in the collection is flagged and linkable', cat && cat.fits[1].owned === 1 && cat.fits[1].inv === 'i1' && cat.fits[0].owned === 0);
ok('…and the row\'s variation and diagram link ride along', cat && cat.variation === 'Reproduction' && /trainz\.com/.test(cat.link));
ok('the number rule still fires alongside (622-12 → 622)', r.some(x => x.kind === 'number' && x.item === '622'));
ok('the fits line renders the catalog answer with "fits …" and the diagram link', /Catalog: ' \+ _esc\(f\.label\)/.test(mt) && /fits ' \+ fl\.join/.test(mt) && />diagram<\/a>/.test(mt));

section('The rows file the master tab is written from (harvests/lionel-parts-1.json + -2.json)');
const H = path.join(__dirname, '..', 'harvests');
const parts = [1, 2].map(k => JSON.parse(fs.readFileSync(path.join(H, 'lionel-parts-' + k + '.json'), 'utf8')));
const rows = parts[0].rows.concat(parts[1].rows);
ok('two files, halves of one row set, same header', parts[0].totalRows === rows.length && parts[1].totalRows === rows.length && JSON.stringify(parts[0].header) === JSON.stringify(parts[1].header) && parts[0].tab === 'Lionel Parts');
ok('26 columns: the 23-column layout + Fits + Diagrams + Image URL', parts[0].header.length === 26 && parts[0].header[22] === 'Stamped Markings' && parts[0].header[23] === 'Fits' && parts[0].header[24] === 'Diagrams' && parts[0].header[25] === 'Image URL' && rows.every(r => r.length === 26));
ok('a real harvest: more than 15,000 part rows', rows.length > 15000, String(rows.length));
ok('every row is typed Part, category Parts, gauge O or S', rows.every(r => r[1] === 'Part' && r[18] === 'Parts' && (r[8] === 'O' || r[8] === 'S')));
ok('nothing invented: every item number is printed inside its own original title', rows.every(r => r[17].indexOf(r[0]) >= 0));
ok('at least nine in ten rows carry a part number (the rest are filed by name and say so)', rows.filter(r => /No part number printed/.test(r[13])).length < rows.length * 0.1);
ok('at least 95% of rows know what they fit', rows.filter(r => r[23]).length >= rows.length * 0.95, String(rows.filter(r => r[23]).length));
ok('Fits is a "; " list of item numbers as the diagram titles print them', rows.filter(r => r[23]).every(r => r[23].split('; ').every(x => /^(6-)?\d{2,7}[A-Z]{0,3}$|^\d{7}T\d{2}$|^\d{4}[A-Z]?-\d{1,3}$|^\d{4}-T\d$|^O\d{2}$|^[A-Z]{1,3}\d{0,3}$/.test(x))));
ok('every row links to its Trainz listing and names its source', rows.every(r => /^https:\/\/www\.trainz\.com\/products\//.test(r[12]) && /Trainz exploded parts diagrams/.test(r[15])));
ok('Diagrams names the sheet and callout, capped so a cell never overflows', rows.every(r => r[24].length <= 1500) && rows.some(r => /#\d+/.test(r[24])));
const k = {}; rows.forEach(r => { const key = r[0] + '|' + r[10]; k[key] = (k[key] || 0) + 1; });
ok('item number + variation is unique on every row', Object.values(k).every(n => n === 1));
const lens = rows.find(r => r[0] === '622-12');
ok('spot check: 622-12 (the short headlight lens) fits the Alco AA diagrams', !!lens && /2023/.test(lens[23]) && /2031/.test(lens[23]), lens && lens[23]);

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
