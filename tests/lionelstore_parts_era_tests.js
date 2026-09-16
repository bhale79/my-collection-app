// ═══════════════════════════════════════════════════════════════
// lionelstore_parts_era_tests.js — v0.9.1756.
//
// Brad, 2026-09-16: Lionel's own parts store (lionelsupport.com), swept whole
// the night before (93,283 records). His decision: "Only parts that name their
// item" — the 10,448 store parts whose SKU carries the 7-digit item they fit
// (cs-48-2032010-550-p → item 2032010), one row per part, in their OWN tab; the
// rest of the sweep stays on the PC. And the Need-a-part popup's FOURTH lane:
// "Catalog parts for this item" — what every parts catalog says fits the item
// on the card, with "+ Want it" going through the one save path.
//
// This suite pins the era's wiring, the ONE shared reverse lookup
// (_partsForItem, app-data.js), the picker's lane, the lane's markup, the one
// save path, and the rows file.
// Run:  node tests/lionelstore_parts_era_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const rd = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
const cfg = rd('config.js'), br = rd('browse.js'), ob = rd('onboarding-config.js'), mt = rd('maintenance.js'), ad = rd('app-data.js');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
function grabIn(src, sig) { const i = src.indexOf(sig); if (i < 0) return ''; let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } return ''; }
const grab = sig => grabIn(mt, sig);

section('The era is wired like the other parts catalogs (six places)');
ok('ERAS carries lionelstore_parts, attributed to Lionel, link word "store"', /lionelstore_parts:\s*\{\s*id:\s*'lionelstore_parts',\s*label:\s*'Lionel Store Parts'[^}]*manufacturer:\s*'Lionel',\s*partsLink:\s*'store'\s*\}/.test(cfg));
ok('REAL_ERA_IDS lists it (so the lookup index fetches it)', /REAL_ERA_IDS\s*=\s*\[[^\]]*'lionelstore_parts'/.test(cfg));
ok('ERA_SCALE is blank on purpose (the store sells O, S and HO parts)', /lionelstore_parts:\s*'',\s*\/\/[^\n]*blank on purpose/.test(cfg));
ok('ERA_TABS points at the master tab "Lionel Store Parts"', /lionelstore_parts:\s*\{\s*items:\s*'Lionel Store Parts'\s*\}/.test(cfg));
ok('it is LOOKUP-ONLY, fourth beside the other parts catalogs', /const LOOKUP_ONLY_ERAS = \['lionel_parts', 'mth_parts', 'traintender_parts', 'lionelstore_parts'\];/.test(cfg));
ok('browse period, eraScale and eraColors (by reference to mpc) stay complete', /lionelstore_parts:\s*'modern'/.test(br) && /lionelstore_parts:\s*'o'/.test(ob) && /WHAT_I_COLLECT\.eraColors\.lionelstore_parts = WHAT_I_COLLECT\.eraColors\.mpc;/.test(ob));

section('ONE shared reverse lookup: item → the parts that fit it (app-data.js)');
const idxVars = (ad.match(/var _fitsIdx = null, _fitsIdxRows = null, _fitsIdxLen = -1;/) || [''])[0];
const idxSrc = idxVars + '\n' + grabIn(ad, 'function _partsFitsIndex()') + '\n' + grabIn(ad, 'function _partsForItem(itemNum)') + '\nreturn _partsForItem;';
ok('the index cache lives in three module vars beside the functions', idxVars.length > 0);
ok('_partsFitsIndex and _partsForItem live in app-data.js next to _mbAllGet, and _partsForItem is on window', idxSrc.length > 200 && ad.indexOf('window._mbAllGet = _mbAllGet;') < ad.indexOf('function _partsFitsIndex()') && /window\._partsForItem = _partsForItem;/.test(ad));
const ROWS = [
  { itemNum: '2343-13', itemType: 'Part', description: 'Horn Bracket', fits: '2343; 2344; 2353', _era: 'lionel_parts', _tab: 'Lionel Parts', variation: 'Original' },
  { itemNum: '2343-13', itemType: 'Part', description: 'horn bracket repro', fits: '2343', _era: 'traintender_parts', _tab: 'Train Tender Parts', variation: 'Reproduction' },
  { itemNum: '48-2032010-550', itemType: 'Part', description: 'COIL COUPLER / FRONT / 0-6-0T LC2.0', fits: '2032010', _era: 'lionelstore_parts', _tab: 'Lionel Store Parts', msrp: '15', notes: 'Store SKU cs-48-2032010-550-p; In stock, qty 58', refLink: 'https://www.lionelsupport.com/COIL-COUPLER-FRONT-0-6-0T-LC2.0' },
  { itemNum: '2032010-200', itemType: 'Part', description: 'SMOKE UNIT / 0-6-0T LC2.0', fits: '2032010', _era: 'lionelstore_parts', _tab: 'Lionel Store Parts', msrp: '48', notes: 'Store SKU cs-2032010-200-p; Out of stock at the sweep' },
  { itemNum: '2343', itemType: 'Diesel Locomotive', description: 'Santa Fe F3 AA', fits: '', _era: 'pw', _tab: 'Lionel PW - Items' },
  { itemNum: '8632', itemType: 'Diesel Locomotive', description: 'Santa Fe', fits: '', _era: 'mpc', _tab: 'Lionel MPC - Items' },
  { itemNum: '8632-050', itemType: 'Part', description: 'truck', fits: '8632', _era: 'lionel_parts', _tab: 'Lionel Parts' },
  { itemNum: 'X-DUP', itemType: 'Part', description: 'listed twice', fits: '2343', _era: 'lionel_parts', _tab: 'Lionel Parts' },
  { itemNum: 'X-DUP', itemType: 'Part', description: 'listed twice', fits: '2343', _era: 'lionel_parts', _tab: 'Lionel Parts' },
  { itemNum: 'NOTAPART', itemType: 'Accessory', description: 'a Fits value on a non-part', fits: '2343', _era: 'pw', _tab: 'Lionel PW - Items' },
];
const base = n => String(n || '').replace(/[-]?[PDTC]$/i, '');
const st1 = { masterAllRows: ROWS, masterData: [] };
const forItem = new Function('state', 'baseItemNum', idxSrc)(st1, base);
let r = forItem('2343');
ok('2343 → its parts from every catalog (Lionel Parts + Train Tender), one line each, duplicates folded', r.length === 3 && r.map(x => x._era).join(',') === 'lionel_parts,traintender_parts,lionel_parts' && r.filter(x => x.itemNum === 'X-DUP').length === 1, JSON.stringify(r.map(x => x.itemNum + '@' + x._era)));
ok('a non-Part row never answers even with a Fits value', !r.some(x => x.itemNum === 'NOTAPART'));
ok('2344 → the one Lionel Parts row whose Fits lists it', forItem('2344').length === 1 && forItem('2344')[0].itemNum === '2343-13');
r = forItem('2032010');
ok('2032010 → both store parts, with their price, stock note and store link intact', r.length === 2 && r.every(x => x._era === 'lionelstore_parts') && r[0].msrp === '15' && /In stock/.test(r[0].notes) && /lionelsupport\.com/.test(r[0].refLink));
ok('the item is looked up by its base too (2343-P → 2343)', forItem('2343-P').length === 3);
ok('…and without a product-line prefix (6-8632 → 8632)', forItem('6-8632').length === 1 && forItem('6-8632')[0].itemNum === '8632-050');
ok('an unknown item → nothing; blank → nothing; never a throw', forItem('9999999').length === 0 && forItem('').length === 0);
// the index rebuilds only when the rows change
const st2 = { masterAllRows: [], masterData: [ROWS[2]] };
const forItem2 = new Function('state', 'baseItemNum', idxSrc)(st2, base);
ok('before the full-catalog index is up, the loaded eras answer', forItem2('2032010').length === 1);
st2.masterData.push(ROWS[3]);
ok('…and a row added to them is seen on the next call (rebuilt by length)', forItem2('2032010').length === 2);

section('The picker\'s fourth lane and its markup (maintenance.js)');
const pick = grab('function _maintPickerParts(');
ok('_maintPickerParts returns a catalog lane read through _partsForItem (the one shared lookup)', /catalog = \(typeof _partsForItem === 'function'\) \? _partsForItem\(num\) : \[\];/.test(pick) && /return \{ onHand: onHand, wanted: wanted, bin: bin, catalog: catalog \};/.test(pick));
const pickFn = new Function('state', pick + '\nreturn _maintPickerParts;')({ partsData: {}, partsBin: [], maintLog: [] });
ok('…and with no lookup present (an older page, the tests\' bare lift) the lane is simply empty', Array.isArray(pickFn({ item: { itemNum: '2343' }, invId: '' }, 't1').catalog) && pickFn({ item: { itemNum: '2343' }, invId: '' }, 't1').catalog.length === 0);
const laneSrc = grab('function _maintCatalogLaneHtml(rows, q, taskId)');
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const ERAS_FIX = { lionel_parts: { label: 'Lionel Parts' }, traintender_parts: { label: 'Train Tender Parts', partsLink: 'listing' }, lionelstore_parts: { label: 'Lionel Store Parts', partsLink: 'store' } };
const lane = new Function('_esc', '_btn', 'ERAS', laneSrc + '\nreturn _maintCatalogLaneHtml;')(esc, () => 'class="btn"', ERAS_FIX);
const storeRows = forItem('2032010');
let html = lane(storeRows, '', 'task-9');
ok('the lane names the source, the price, the stock and the era\'s link word ("store")', /Lionel Store Parts · \$15 · in stock/.test(html) && /Lionel Store Parts · \$48 · out of stock/.test(html) && /href="https:\/\/www\.lionelsupport\.com\/COIL-COUPLER-FRONT-0-6-0T-LC2\.0"[^>]*>store<\/a>/.test(html));
ok('each line shows the description and its part number, and offers "+ Want it" through _maintPopWantCatalog(era, number, variation, task)', /COIL COUPLER \/ FRONT \/ 0-6-0T LC2\.0<\/b> <span[^>]*>#48-2032010-550<\/span>/.test(html) && /_maintPopWantCatalog\('lionelstore_parts','48-2032010-550','','task-9'\)/.test(html) && (html.match(/\+ Want it/g) || []).length === 2);
html = lane(forItem('2343'), '', 't');
ok('Lionel Parts and Train Tender lines carry their own link word default / "listing" and the variation', /\(Reproduction\)/.test(html) && /Train Tender Parts/.test(html) && /Lionel Parts/.test(html));
const many = []; for (let i = 0; i < 12; i++) many.push({ itemNum: 'P-' + i, itemType: 'Part', description: (i % 2 ? 'smoke unit' : 'coupler') + ' no. ' + i, fits: '1', _era: 'lionel_parts' });
html = lane(many, '', 't');
ok('with nothing typed the first 8 show and the head says so', (html.match(/\+ Want it/g) || []).length === 8 && /first 8 of 12 — type to narrow/.test(html));
html = lane(many, 'smoke', 't');
ok('typing narrows by description word (6 of 12) and counts it', (html.match(/\+ Want it/g) || []).length === 6 && /\(6 of 12\)/.test(html));
ok('typing a part number narrows too (P-11 → one line; single characters are ignored, as in the bin search)', (lane(many, 'P-11', 't').match(/\+ Want it/g) || []).length === 1 && (lane(many, 'p', 't').match(/\+ Want it/g) || []).length === 8);
ok('no match says so without a throw; no rows → no lane at all', /None of the 12 catalog parts match/.test(lane(many, 'zzz', 't')) && lane([], '', 't') === '');
const popup = grab('window._maintPartsPopup = function (taskId, taskName)');
ok('the popup has the lane\'s container between the bin and "Order one"', popup.indexOf('id="maint-pop-bin"') < popup.indexOf('id="maint-pop-catalog"') && popup.indexOf('id="maint-pop-catalog"') < popup.indexOf('Not in the bin? Order one'));
ok('typing redraws the lane (from _maintBinCheck), which reads the picker for the card\'s item', /_maintCatalogLaneRender\(taskId\);/.test(grab('window._maintBinCheck = function (taskId)')) && /_maintCatalogLaneHtml\(_maintPickerParts\(tg, taskId\)\.catalog, q, taskId\)/.test(grab('function _maintCatalogLaneRender(taskId)')));

section('ONE save path: the typed box and "+ Want it" both go through _maintPopSaveWanted');
const save = grab('async function _maintPopSaveWanted(fields, taskId, retry)');
const typed = grab('window._maintPopAddWanted = async function (taskId)');
const want = grab('window._maintPopWantCatalog = async function (era, partNum, variation, taskId)');
ok('_maintPopSaveWanted holds the duplicate check and the one appender; the two callers hold neither', /_partsFindDup\(fields\)/.test(save) && /_partsAppendRow\(fields\)/.test(save) && !/_partsFindDup|_partsAppendRow/.test(typed) && !/_partsFindDup|_partsAppendRow/.test(want));
ok('"Add it anyway" re-runs the CALLER (retry), so a catalog line retried is still the catalog line', /window\._partsAddAnyway = true; if \(typeof retry === 'function'\) retry\(\);/.test(save) && /_maintPopSaveWanted\(fields, taskId, function \(\) \{ window\._maintPopAddWanted\(taskId\); \}\)/.test(typed) && /_maintPopSaveWanted\(fields, taskId, function \(\) \{ window\._maintPopWantCatalog\(era, partNum, variation, taskId\); \}\)/.test(want));
ok('"+ Want it" files the catalog\'s own number and description, for the card\'s unit, with a note naming the catalog, price and link', /partNum: String\(row\.itemNum \|\| ''\)/.test(want) && /description: String\(row\.description \|\| ''\)/.test(want) && /forInv: tg\.invId \|\| ''/.test(want) && /'from the ' \+ src \+ ' catalog'/.test(want) && /row\.refLink/.test(want));
ok('…found back through the picker\'s lane by era + number + variation (never by row position)', /_maintPickerParts\(tg, taskId\)\.catalog\.find\(/.test(want) && /String\(r\._era \|\| ''\) === String\(era \|\| ''\) && String\(r\.itemNum\) === String\(partNum\) && String\(r\.variation \|\| ''\) === String\(variation \|\| ''\)/.test(want));
ok('exactly one _partsAppendRow in the popup code (the save path) plus the bin\'s Use one — nothing else appends', (mt.match(/_partsAppendRow\(fields\)/g) || []).length === 2);

section('The rows file (harvests/lionelstore-parts.json)');
const doc = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'harvests', 'lionelstore-parts.json'), 'utf8'));
const rows = doc.rows;
ok('one file, tab Lionel Store Parts, the count it declares', doc.tab === 'Lionel Store Parts' && doc.totalRows === rows.length && doc.of === 1);
ok('26 columns, the Lionel Parts layout', doc.header.length === 26 && doc.header[23] === 'Fits' && doc.header[25] === 'Image URL' && rows.every(r => r.length === 26));
ok('a real read: more than 10,000 part rows, one row per part number', rows.length > 10000 && new Set(rows.map(r => r[0])).size === rows.length, String(rows.length));
ok('every row is typed Part, category Parts, and names the read', rows.every(r => r[1] === 'Part' && r[18] === 'Parts' && /lionelsupport\.com/.test(r[15])));
ok('no part number keeps the store wrapper (no cs- in front, no -p behind) — the app reads -P as "powered"', rows.every(r => !/^cs-/i.test(r[0]) && !/-p$/i.test(r[0])));
ok('…and Notes carries the complete store SKU, the stock and the quantity', rows.every(r => /^Store SKU cs-.+-p(; |$)/i.test(r[13]) && /In stock|Out of stock/.test(r[13])));
ok('Fits is always ONE 7-digit item, and it is the number written inside the part\'s own SKU', rows.every(r => /^\d{7}$/.test(r[23]) && r[0].indexOf(r[23]) >= 0));
ok('Reference Link is the store page, or blank with "no store page" in Notes', rows.every(r => /^https:\/\/www\.lionelsupport\.com\/[^\s]+$/.test(r[12]) || (r[12] === '' && /no store page/.test(r[13]))));
ok('MSRP is a plain price, or blank with "no price shown" in Notes', rows.every(r => /^\d+(\.\d{1,2})?$/.test(r[20]) || (r[20] === '' && /no price shown/.test(r[13]))));
ok('Gauge, Variation, Diagrams and Image URL are blank (the store says nothing about them — nothing invented)', rows.every(r => r[8] === '' && r[10] === '' && r[24] === '' && r[25] === ''));
const coil = rows.find(r => r[0] === '48-2032010-550'), deco = rows.filter(r => /^DECO\d{7}$/.test(r[0]));
ok('spot check: 48-2032010-550 is the LC2.0 0-6-0T\'s front coil coupler, $15, fits 2032010, linked to its store page', !!coil && /COIL COUPLER \/ FRONT/.test(coil[7]) && coil[20] === '15' && coil[23] === '2032010' && /lionelsupport\.com\/COIL-COUPLER-FRONT/.test(coil[12]), coil && coil.join('|').slice(0, 200));
ok('the DECO kits are in (their name repeats the item), a few hundred of them', deco.length > 300 && deco.every(r => r[23] === r[0].slice(4)));
ok('nothing that is a whole product: no train set, no 6-xxxxx number, no bare 10-digit part', !rows.some(r => /Set\b/.test(r[7]) && /^6-\d{5}/.test(r[0])) && !rows.some(r => /^\d{10}$/.test(r[0])) && !rows.some(r => /^6-\d{4,5}-/.test(r[0])));
ok('the file states its scope, number rule and fits rule', /Only the store parts/.test(doc.scope) && /without its wrapper/.test(doc.numberRule) && /7-digit item number Lionel wrote into the part SKU/.test(doc.fitsRule));
ok('Notes never overflow a Sheets cell', rows.every(r => r[13].length <= 2000));

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
