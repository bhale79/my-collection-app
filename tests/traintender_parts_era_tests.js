// ═══════════════════════════════════════════════════════════════
// traintender_parts_era_tests.js — v0.9.1755.
//
// Brad, 2026-09-15 evening: "run the crawl" → The Train Tender (ttender.com),
// Jeff Kane's postwar / prewar / OO / LTI parts lists — 48 Word-exported
// pages, read one request per 30 s. His four decisions: Lionel sections
// only; its OWN tab (not merged into Lionel Parts); Fits = the part-number
// prefix ONLY when the app's own catalog lookup resolved it to a Lionel item
// in the list's era (checked in his signed-in tab on v1754); bulk-list rows
// folded into Notes. Nothing invented.
//
// Same shape as Lionel Parts / MTH Parts: a LOOKUP-ONLY era. This suite pins
// the wiring, the drawer's "every parts catalog answers" step, and the rows file.
// Run:  node tests/traintender_parts_era_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const rd = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
const cfg = rd('config.js'), br = rd('browse.js'), ob = rd('onboarding-config.js'), mt = rd('maintenance.js');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
function grab(sig) { const i = mt.indexOf(sig); let d = 0; for (let k = mt.indexOf('{', i); k < mt.length; k++) { if (mt[k] === '{') d++; else if (mt[k] === '}') { d--; if (!d) return mt.slice(i, k + 1); } } return ''; }

section('The era is wired like lionel_parts and mth_parts');
ok('ERAS carries traintender_parts, attributed to Lionel, with the drawer\'s link word', /traintender_parts:\s*\{\s*id:\s*'traintender_parts',\s*label:\s*'Train Tender Parts'[^}]*manufacturer:\s*'Lionel',\s*partsLink:\s*'listing'\s*\}/.test(cfg));
ok('REAL_ERA_IDS lists it (so the lookup index fetches it and the Yardmaster can file into it)', /REAL_ERA_IDS\s*=\s*\[[^\]]*'traintender_parts'/.test(cfg));
ok('ERA_SCALE is blank on purpose (O, OO and G; the row\'s Gauge column says which)', /traintender_parts:\s*'',\s*\/\/[^\n]*blank on purpose/.test(cfg));
ok('ERA_TABS points at the master tab "Train Tender Parts"', /traintender_parts:\s*\{\s*items:\s*'Train Tender Parts'\s*\}/.test(cfg));
ok('it is LOOKUP-ONLY, beside the other two parts catalogs', /const LOOKUP_ONLY_ERAS = \['lionel_parts', 'mth_parts', 'traintender_parts'(, '[a-z_]+')*\];/.test(cfg));
ok('browse period, eraScale and eraColors (by reference to pw) stay complete', /traintender_parts:\s*'modern'/.test(br) && /traintender_parts:\s*'o'/.test(ob) && /WHAT_I_COLLECT\.eraColors\.traintender_parts = WHAT_I_COLLECT\.eraColors\.pw;/.test(ob));

section('The drawer: every parts catalog that carries the number answers, one line per source');
const MASTER = {
  '2343-13': [
    { itemNum: '2343-13', itemType: 'Part', description: 'Horn Bracket', fits: '2343; 2344; 2353', refLink: 'https://www.trainz.com/products/lionel-2343-13', variation: 'Original', _era: 'lionel_parts' },
    { itemNum: '2343-13', itemType: 'Part', description: 'horn bracket reproduction', fits: '2343', refLink: 'https://www.ttender.com/list/num8.htm', variation: 'Reproduction', _era: 'traintender_parts' },
  ],
  '2343': [{ itemNum: '2343', roadName: 'Santa Fe', itemType: 'Diesel Locomotive' }],
  '2344': [{ itemNum: '2344', roadName: 'New York Central', itemType: 'Diesel Locomotive' }],
  '2353': [{ itemNum: '2353', roadName: 'Santa Fe', itemType: 'Diesel Locomotive' }],
};
const st = { personalData: { i1: { inventoryId: 'i1', itemNum: '2343', owned: true } }, partsData: {} };
const ERAS_FIX = { lionel_parts: { label: 'Lionel Parts' }, traintender_parts: { label: 'Train Tender Parts', partsLink: 'listing' } };
const body = grab('function _binItemFromPartNum(partNum)') + '\n' + grab('function _binOwnedCopies(itemNum)') + '\n' + grab('function _binTopicWords(b)') + '\n' + grab('function _binFits(b)') + '\nreturn _binFits;';
const findOne = n => (MASTER[String(n)] || [null])[0];
const base = n => String(n || '').replace(/[-]?[PDTC]$/i, '');
// with the shared bucket lookup present (the app):
const fitsAll = new Function('state', 'findMaster', 'baseItemNum', '_mbAllGet', 'ERAS', body)(st, findOne, base, n => MASTER[String(n)] || [], ERAS_FIX);
let r = fitsAll({ id: 'b1', partNum: '2343-13', desc: 'horn bracket', qty: 1 });
const cats = r.filter(x => x.kind === 'catalog');
ok('both catalog rows answer — Trainz first (loaded order), Train Tender second', cats.length === 2 && cats[0].era === 'lionel_parts' && cats[1].era === 'traintender_parts', JSON.stringify(cats.map(c => c.era)));
ok('each line names its source from ERAS (the one place for labels)', cats[0].source === 'Lionel Parts' && cats[1].source === 'Train Tender Parts');
ok('each line keeps its own fits, variation and link', cats[0].fits.length === 3 && cats[1].fits.length === 1 && cats[1].variation === 'Reproduction' && /ttender\.com/.test(cats[1].link));
ok('the owned 2343 is flagged on both lines', cats[0].fits[0].owned === 1 && cats[1].fits[0].owned === 1 && cats[1].fits[0].inv === 'i1');
ok('the number rule still fires alongside (2343-13 → 2343)', r.some(x => x.kind === 'number' && x.item === '2343'));
// without it (the tests\' bare lift, an older page): findMaster alone, one line, as before v1755
const fitsOne = new Function('state', 'findMaster', 'baseItemNum', body)(st, findOne, base);
r = fitsOne({ id: 'b2', partNum: '2343-13', desc: 'horn bracket', qty: 1 });
ok('with no shared lookup the drawer falls back to findMaster — one catalog line, never a throw', r.filter(x => x.kind === 'catalog').length === 1 && r.find(x => x.kind === 'catalog').era === 'lionel_parts');
r = fitsAll({ id: 'b3', partNum: '2343', desc: 'a whole engine?', qty: 1 });
ok('a non-Part row never becomes a catalog line', !r.some(x => x.kind === 'catalog'));
const html = grab('function _binFitsHtml(b)');
ok('the fits line names the source in brackets and takes the link word from the era (default "diagram")', /Catalog' \+ \(f\.source \? ' \(' \+ _esc\(f\.source\) \+ '\)' : ''\) \+ ': '/.test(html) && /ERAS\[f\.era\]\.partsLink\) \|\| 'diagram'/.test(html) && /">' \+ _lw \+ '<\/a>'/.test(html));

section('The rows file (harvests/traintender-parts.json)');
const doc = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'harvests', 'traintender-parts.json'), 'utf8'));
const rows = doc.rows;
ok('one file, tab Train Tender Parts, the count it declares', doc.tab === 'Train Tender Parts' && doc.totalRows === rows.length && doc.of === 1);
ok('26 columns, the Lionel Parts layout', doc.header.length === 26 && doc.header[23] === 'Fits' && doc.header[24] === 'Diagrams' && doc.header[25] === 'Image URL' && rows.every(r => r.length === 26));
ok('a real read: more than 6,000 part rows, one row per part number', rows.length > 6000 && new Set(rows.map(r => r[0])).size === rows.length, String(rows.length));
ok('every row is typed Part, category Parts, gauge O / OO / G', rows.every(r => r[1] === 'Part' && r[18] === 'Parts' && /^(O|OO|G)$/.test(r[8])));
ok('every row has a description, a price and a note naming its list', rows.every(r => r[7] && /^\d+(\.\d{1,2})?$/.test(r[20]) && /^List: /.test(r[13])));
ok('every row links to the Train Tender list page it came from and names the read', rows.every(r => /^https:\/\/www\.ttender\.com\/list\/[A-Za-z0-9]+\.htm$/.test(r[12]) && /Train Tender parts lists \(ttender\.com\)/.test(r[15])));
ok('Fits is a single catalog item or blank — and a blank one says why in Notes', rows.every(r => (r[23] === '' && /no catalog item matched the number prefix/.test(r[13])) || (r[23] && !/;/.test(r[23]) && !/no catalog item matched/.test(r[13]))));
ok('Fits, where present, is the number\'s own prefix or the catalog\'s spelling of it (zeros dropped, an L/X prefix, a T/C/P suffix off)', rows.filter(r => r[23]).every(r => { const p = (r[0].match(/^([0-9A-Za-z]+)-/) || [])[1] || ''; const f = r[23]; return f === p || f === p.replace(/^0+(?=\d)/, '') || f === 'L' + p || f === 'X' + p || (/[TCP]$/.test(p) && f === p.slice(0, -1)); }));
ok('the Diagrams column is empty (the site has none) and the Variation is a word from the description or blank', rows.every(r => r[24] === '' && /^(Reproduction|Original|Used|)$/.test(r[10]) && r[10] === r[11]));
ok('more than half the rows have a fits item; the rule is stated in the file', rows.filter(r => r[23]).length > rows.length / 2 && /only when the master catalog knows/.test(doc.fitsRule));
const fcb = rows.find(r => r[0] === '1-FCB5'), horn = rows.find(r => r[0] === '2343-13') || rows.find(r => /^2343-/.test(r[0]));
ok('spot check: 1-FCB5 (an elastic band) fits nothing and says so; a 2343- part fits 2343', !!fcb && fcb[23] === '' && /prefix 1\b/.test(fcb[13]) && !!horn && horn[23] === '2343', (horn || [])[0]);
ok('spot check: a bulk listing is folded into its regular row\'s Notes, not a second row', !!fcb && /Bulk Numeric Postwar at \$0\.60/.test(fcb[13]));
ok('nothing from the lists Brad said no to: no Flyer, Marx, Plasticville, hardware, tools, paint, wire or books', !rows.some(r => /American Flyer|Marx|Plasticville|Handrail|Tools|Paint|Wire|Reference Books|Bulk Light Bulbs/.test(r[13].split(';')[0])));
ok('Notes never overflow a Sheets cell', rows.every(r => r[13].length <= 2000));

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
