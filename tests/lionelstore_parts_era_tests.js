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
//
// Sept 16 night (S99), the rows files again: Brad typed "tire" on 84631's
// Need-a-part popup and got "None of the 28 catalog parts match". The tire
// (6304678206) fits 837 engines; the evening rebuild had CAPPED every Fits list
// at 100 item numbers and 84631 was not in the tire's first 100. 516 parts were
// over the cap, 7,576 items were missing at least one part — always the common
// ones. The cap is gone: a Fits list is complete, and the checks below say so.
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
const idxSrc = idxVars + '\n' + grabIn(ad, 'function _partsFitsIndex()') + '\n' + grabIn(ad, 'function _partsMakerOf(era)') + '\n' + grabIn(ad, 'function _partsForItem(itemNum, forEra)') + '\nreturn _partsForItem;';
ok('the index cache lives in three module vars beside the functions', idxVars.length > 0);
ok('_partsFitsIndex, _partsMakerOf and _partsForItem live in app-data.js next to _mbAllGet, and _partsForItem is on window', idxSrc.length > 200 && /function _partsMakerOf\(era\)/.test(idxSrc) && ad.indexOf('window._mbAllGet = _mbAllGet;') < ad.indexOf('function _partsFitsIndex()') && /window\._partsForItem = _partsForItem;/.test(ad));
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
const forItem = new Function('state', 'baseItemNum', 'ERAS', idxSrc)(st1, base, {});
let r = forItem('2343');
ok('2343 → its parts from every catalog (Lionel Parts + Train Tender), one line each, duplicates folded', r.length === 3 && r.map(x => x._era).join(',') === 'lionel_parts,traintender_parts,lionel_parts' && r.filter(x => x.itemNum === 'X-DUP').length === 1, JSON.stringify(r.map(x => x.itemNum + '@' + x._era)));
ok('a non-Part row never answers even with a Fits value', !r.some(x => x.itemNum === 'NOTAPART'));
ok('2344 → the one Lionel Parts row whose Fits lists it', forItem('2344').length === 1 && forItem('2344')[0].itemNum === '2343-13');
r = forItem('2032010');
ok('2032010 → both store parts, with their price, stock note and store link intact', r.length === 2 && r.every(x => x._era === 'lionelstore_parts') && r[0].msrp === '15' && /In stock/.test(r[0].notes) && /lionelsupport\.com/.test(r[0].refLink));
ok('the item is looked up by its base too (2343-P → 2343)', forItem('2343-P').length === 3);
ok('…and without a product-line prefix (6-8632 → 8632)', forItem('6-8632').length === 1 && forItem('6-8632')[0].itemNum === '8632-050');
ok('an unknown item → nothing; blank → nothing; never a throw', forItem('9999999').length === 0 && forItem('').length === 0);

// v0.9.1757 — THE MAKER GUARD. Lionel's modern 6-xxxxx line is keyed as the bare
// xxxxx, which collides with the short catalog numbers S-Helper, American Models,
// Atlas N and Maerklin use: on the real catalog 1,641 item numbers matched a part
// from a different maker. A parts catalog now answers only for its own maker's items.
const ERAS_MFR = { lionel_parts: { manufacturer: 'Lionel' }, traintender_parts: { manufacturer: 'Lionel' },
  lionelstore_parts: { manufacturer: 'Lionel' }, mth_parts: { manufacturer: 'MTH' }, kato_parts: { manufacturer: 'Kato' },
  pw: { manufacturer: 'Lionel' }, mpc: { manufacturer: 'Lionel' }, mod_s: { manufacturer: 'Lionel' },
  shelper: { manufacturer: 'S-Helper Service' }, af_gilbert: { manufacturer: 'A.C. Gilbert' }, nomfr: {} };
const COLLIDE = [
  { itemNum: '8632-050', itemType: 'Part', description: 'Lionel truck', fits: '8632', _era: 'lionel_parts', _tab: 'Lionel Parts' },
  { itemNum: 'MTH-1', itemType: 'Part', description: 'MTH truck', fits: '8632', _era: 'mth_parts', _tab: 'MTH Parts' },
  { itemNum: 'K-9', itemType: 'Part', description: 'Kato truck', fits: '8632', _era: 'kato_parts', _tab: 'Kato Parts' },
  { itemNum: 'NM-1', itemType: 'Part', description: 'a catalog with no maker on its era', fits: '8632', _era: 'nomfr', _tab: 'Odd' },
];
const guard = new Function('state', 'baseItemNum', 'ERAS', idxSrc)({ masterAllRows: COLLIDE, masterData: [] }, base, ERAS_MFR);
ok('with no era named, every catalog still answers (the drawer, where the user typed a PART number)', guard('8632').length === 4);
ok('a Lionel item gets Lionel parts only — the MTH and Kato rows drop out', guard('8632', 'mpc').map(r => r._era).sort().join(',') === 'lionel_parts,nomfr');
ok('an MTH item gets the MTH row; a Kato item gets the Kato row', guard('8632', 'mth_o' in ERAS_MFR ? 'mth_o' : 'mth_parts').some(r => r._era === 'mth_parts') && guard('8632', 'kato_parts').some(r => r._era === 'kato_parts'));
ok('an S-Helper item numbered like a Lionel one gets NO Lionel parts (the bug this fixes)',
   guard('8632', 'shelper').every(r => r._era !== 'lionel_parts') && guard('8632', 'shelper').length === 1);
ok('A.C. Gilbert\'s original American Flyer is NOT Lionel, so Lionel store parts stay off it',
   guard('8632', 'af_gilbert').every(r => r._era !== 'lionel_parts'));
ok('Lionel\'s OWN American Flyer line is Lionel, so its parts still match', guard('8632', 'mod_s').some(r => r._era === 'lionel_parts'));
ok('a catalog whose era names no maker is never filtered out — silence is not a mismatch', guard('8632', 'mpc').some(r => r._era === 'nomfr'));
ok('an era with no maker of its own filters nothing', guard('8632', 'nomfr').length === 4);
ok('the guard lives in the shared lookup, not in the lane, and _partsMakerOf is on window',
   /function _partsForItem\(itemNum, forEra\)/.test(ad) && /window\._partsMakerOf = _partsMakerOf;/.test(ad));
ok('the lane tells the lookup which item it is on', /_partsForItem\(num, tg\.item && tg\.item\._era\)/.test(mt));
// the index rebuilds only when the rows change
const st2 = { masterAllRows: [], masterData: [ROWS[2]] };
const forItem2 = new Function('state', 'baseItemNum', 'ERAS', idxSrc)(st2, base, {});
ok('before the full-catalog index is up, the loaded eras answer', forItem2('2032010').length === 1);
st2.masterData.push(ROWS[3]);
ok('…and a row added to them is seen on the next call (rebuilt by length)', forItem2('2032010').length === 2);

section('The picker\'s fourth lane and its markup (maintenance.js)');
const pick = grab('function _maintPickerParts(');
ok('_maintPickerParts returns a catalog lane read through _partsForItem, naming the item\'s era so only its maker answers (v0.9.1757)', /catalog = \(typeof _partsForItem === 'function'\) \? _partsForItem\(num, tg\.item && tg\.item\._era\) : \[\];/.test(pick) && /return \{ onHand: onHand, wanted: wanted, bin: bin, catalog: catalog \};/.test(pick));
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

section('The rows files (harvests/lionelstore-parts-1..3.json)');
// v0.9.1756 shipped ONE file of 10,448 parts — the ones whose SKU named their item.
// Phase 2b (2026-09-16 evening) read all 25,028 assemblies' exploded-view parts
// breakdowns, which say where each part is ACTUALLY used, and the file became three
// (the browser upload takes ~8 MB at a time). Fits is now the UNION of both answers.
const H = path.join(__dirname, '..', 'harvests');
const docs = [1, 2, 3].map(n => JSON.parse(fs.readFileSync(path.join(H, 'lionelstore-parts-' + n + '.json'), 'utf8')));
const rows = docs.reduce((a, d) => a.concat(d.rows), []);
ok('three files, one tab, the same header and total on each, parts 1..3 with no gaps',
   docs.length === 3 && docs.every(d => d.tab === 'Lionel Store Parts' && d.totalRows === rows.length && JSON.stringify(d.header) === JSON.stringify(docs[0].header))
   && JSON.stringify(docs.map(d => d.part)) === '[1,2,3]' && docs.every(d => d.of === 3));
ok('the superseded single file is gone (one source, not two)', !fs.existsSync(path.join(H, 'lionelstore-parts.json')));
ok('26 columns, the Lionel Parts layout', docs[0].header.length === 26 && docs[0].header[23] === 'Fits' && docs[0].header[25] === 'Image URL' && rows.every(r => r.length === 26));
ok('a real read: more than 50,000 part rows, one row per part number', rows.length > 50000 && new Set(rows.map(r => r[0])).size === rows.length, String(rows.length));
ok('every row is typed Part, category Parts, and names the read', rows.every(r => r[1] === 'Part' && r[18] === 'Parts' && /lionelsupport\.com/.test(r[15])));
ok('no part number keeps a store wrapper or any whitespace — the app reads a trailing -P as "powered"',
   rows.every(r => !/^(cs|ca)-/i.test(r[0]) && !/-p$/i.test(r[0]) && !/[\s ]/.test(r[0])));
ok('…and Notes carries the complete store SKU', rows.every(r => /^Store SKU (cs|ca)-\S/i.test(r[13])));
ok('a sold part states its stock; one that is not sold separately says so', rows.every(r => /In stock|Out of stock|not sold separately/.test(r[13])));
ok('Fits is a "; " list of plain item numbers, never repeating one', rows.every(r => r[23] && r[23].split('; ').every(x => /^\d{4,7}$/.test(x)) && new Set(r[23].split('; ')).size === r[23].split('; ').length));
ok('where a part\'s SKU names an item, that item leads its Fits list',
   rows.filter(r => /^(\d{2,3}-)?(\d{7})-[A-Za-z]?\d{2,3}[A-Za-z]?$/.test(r[0])).every(r => r[23].split('; ')[0] === r[0].match(/(\d{7})/)[1]));
ok('NO Fits list is capped any more — no row claims "(N listed)", and a list can run past 100',
   !rows.some(r => /listed\)/.test(r[13])) && rows.some(r => r[23].split('; ').length > 100));
ok('a part that fits more than 100 items says how many in Notes, and the number is the list\'s real length',
   rows.filter(r => r[23].split('; ').length > 100).every(r => parseInt((r[13].match(/fits (\d+) items/) || [])[1], 10) === r[23].split('; ').length)
   && rows.filter(r => /fits \d+ items/.test(r[13])).every(r => r[23].split('; ').length > 100));
ok('every Fits cell still fits a Sheets cell (50,000 characters)', rows.every(r => r[23].length <= 49000));
const tire = rows.find(r => r[0] === '6304678206');
ok('the one that started it: the .625" traction tire lists all its engines, 84631 among them',
   !!tire && /TRACTION TIRE/.test(tire[7]) && tire[23].split('; ').length > 800 && tire[23].split('; ').includes('84631') && /fits 837 items$/.test(tire[13]));
ok('…so 84631 has its full parts list — the popup said 28, the store says more than 60',
   rows.filter(r => r[23].split('; ').includes('84631')).length > 60);
ok('Reference Link is the store page, or blank with "no store page" in Notes', rows.every(r => /^https:\/\/www\.lionelsupport\.com\/[^\s]+$/.test(r[12]) || (r[12] === '' && /no store page/.test(r[13]))));
ok('MSRP is a plain price, or blank with "no price shown" in Notes', rows.every(r => /^\d+(\.\d{1,2})?$/.test(r[20]) || (r[20] === '' && /no price shown/.test(r[13]))));
ok('Gauge, Variation, Diagrams and Image URL are blank (the store says nothing about them — nothing invented)', rows.every(r => r[8] === '' && r[10] === '' && r[24] === '' && r[25] === ''));
ok('the exploded-view callout is only ever stated once per row, in Notes', rows.every(r => (r[13].match(/callout /g) || []).length <= 1));
const coil = rows.find(r => r[0] === '48-2032010-550'), deco = rows.filter(r => /^DECO\d{7}$/.test(r[0])), enc = rows.find(r => r[0] === '6101104135');
ok('spot check: 48-2032010-550 is still the LC2.0 0-6-0T\'s front coil coupler, $15, fits 2032010, linked to its store page',
   !!coil && /COIL COUPLER \/ FRONT/.test(coil[7]) && coil[20] === '15' && coil[23].split('; ')[0] === '2032010' && /lionelsupport\.com\/COIL-COUPLER-FRONT/.test(coil[12]));
ok('spot check: a ten-digit part known only from a breakdown carries ALL its engines and says how many',
   !!enc && /ENCODER RING/.test(enc[7]) && enc[23].split('; ').length > 100 && parseInt(enc[13].match(/fits (\d+) items/)[1], 10) === enc[23].split('; ').length);
ok('the DECO kits are still in (their name repeats the item), a few hundred of them', deco.length > 300 && deco.every(r => r[23].split('; ')[0] === r[0].slice(4)));
ok('the ten-digit part numbers are in now — that was the whole point of reading the breakdowns', rows.filter(r => /^\d{10}$/.test(r[0])).length > 30000);
ok('no service notes and no whole train sets came in as parts',
   !rows.some(r => /SERVICE NOTE/i.test(r[0])) && !rows.some(r => /^6-\d{4,5}-\d+$/.test(r[0])));
ok('the files state their scope, number rule, fits rule and callout rule',
   /exploded-view parts breakdown/.test(docs[0].scope) && /without its wrapper/.test(docs[0].numberRule)
   && /every item whose parts breakdown lists this part/.test(docs[0].fitsRule) && /no cap/.test(docs[0].fitsRule) && /only when every diagram agrees/.test(docs[0].calloutRule));
ok('Notes never overflow a Sheets cell', rows.every(r => r[13].length <= 2000));

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
