// ═══════════════════════════════════════════════════════════════════════════
// query_builders_tests.js — v0.9.1838 (N5 on the release-readiness list)
//
// EVERY SEARCH THE APP BUILDS NAMES THE ITEM THE SAME WAY.
//
// v0.9.1768 taught the catalog link four rules (rrSearchTerms, app.js): the
// brand follows the GAUGE (Lionel S → American Flyer), the dead word "modern"
// stays out, a modern Lionel five-digit number is spelled 6-xxxxx, and the road
// name + the first clause of the description ride along. LINK_WORDING_PLAN
// listed ELEVEN other query builders that never got them — each still decided
// the brand its own way. Measured before this release:
//   want list → Search eBay        'lionel' for EVERY item (MTH, Atlas, AF …)
//   want list → other sites        row looked up by number alone (null hint)
//   research card / wizard price   brand from the TAB; "modern era"; bare
//                                  numbers; the clause chopped "No. 390" to "No"
//   maintenance (YouTube, parts,   maker from the tab → an American Flyer
//     diagram, generic docs)         engine searched as Lionel
//   parts list → Google            number-only engine lookup, bare number
//   photo inbox vendor search      a builder NOTHING called (dead, test-held)
//
// These tests LIFT the real builders out of their files and RUN them with
// four real-shaped rows — American Flyer, modern Lionel five-digit, postwar,
// MTH — plus a manual entry. Section H plants each old habit back and the
// matching check must go red.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const APPDIR = path.join(__dirname, '..', 'app');
const APP = f => fs.readFileSync(path.join(APPDIR, f), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
// brace-matched slice starting at `sig`
function grabAt(src, sig) {
  const i = src.indexOf(sig);
  if (i < 0) throw new Error('could not find ' + sig);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); }
  }
  throw new Error('unbalanced ' + sig);
}
const grab = (src, name) => grabAt(src, 'function ' + name + '(');
const q = url => decodeURIComponent(String(url).split(/[?&](?:q|_nkw)=/)[1].split('&')[0].replace(/\+/g, ' '));

const appjs = APP('app.js'), pages = APP('app-pages.js'), research = APP('research.js');
const wizard = APP('wizard.js'), maint = APP('maintenance.js'), browse = APP('browse.js');
const inbox = APP('photo-inbox.js'), coll = APP('app-collection.js');

// ── the rows ────────────────────────────────────────────────────────────────
const AF   = { _tab: 'Lionel Modern S - Items', _era: 'mod_s', itemNum: '9504',  roadName: 'Erie', description: 'Combination car', manufacturer: 'Lionel', yearProd: '1988', variation: '' };
const MODL = { _tab: 'Lionel MPC-Modern',       _era: 'mod',   itemNum: '84631', roadName: 'Santa Fe', description: 'Boxcar', manufacturer: 'Lionel', yearProd: '2019', variation: '' };
const PW   = { _tab: 'Lionel PW - Items',       _era: 'pw',    itemNum: '6464-100', roadName: 'Western Pacific', description: 'Boxcar, silver', manufacturer: 'Lionel', yearProd: '1954', variation: '' };
const MTH  = { _tab: 'MTH O',                   _era: 'mth_o', itemNum: '20-3001', roadName: 'Pennsylvania', description: 'GG-1 electric', manufacturer: 'MTH', yearProd: '2001', variation: '' };
const ROWS = { '9504': AF, '84631': MODL, '6464-100': PW, '20-3001': MTH };
const SCALE  = { mod_s: 's', mod: 'o', pw: 'o', mth_o: 'o', prewar: 'o' };
const PERIOD = { mod_s: 'modern', mod: 'modern', pw: 'postwar', mth_o: 'modern', prewar: 'prewar' };
const scaleOf  = it => SCALE[it && it._era] || null;
const periodOf = it => PERIOD[it && it._era] || '';
const makerForTab = tab => { const M = [['weaver', 'Weaver'], ['k-line', 'K-Line'], ['williams', 'Williams'], ['marx', 'Marx']]; const t = String(tab || '').toLowerCase(); const hit = M.find(m => t.indexOf(m[0]) === 0); return hit ? hit[1] : ''; };

// ── A · the shared rules, lifted from app.js and run ───────────────────────
section('A · the shared rules ship (app.js)');
const sClause = grab(appjs, '_rrFirstClause'), sBrand = grab(appjs, 'rrSearchBrand'), sNum = grab(appjs, 'rrSearchNumber'), sTerms = grab(appjs, 'rrSearchTerms');
const shared = new Function('_scaleOfItem', '_makerForTab', '_itemEraPeriod', 'window',
  sClause + '\n' + sBrand + '\n' + sNum + '\n' + sTerms + '\nreturn { brand: rrSearchBrand, num: rrSearchNumber, terms: rrSearchTerms, clause: _rrFirstClause };')(scaleOf, makerForTab, periodOf, undefined);
ok('rrSearchBrand: American Flyer for the S row, Lionel for O, MTH for MTH',
   shared.brand(AF) === 'American Flyer' && shared.brand(MODL) === 'Lionel' && shared.brand(PW) === 'Lionel' && shared.brand(MTH) === 'MTH');
ok('rrSearchNumber: 6- goes back on the modern five-digit number, nothing else changes',
   shared.num(MODL) === '6-84631' && shared.num(AF) === '9504' && shared.num(PW) === '6464-100' && shared.num(MTH) === '20-3001');

// ── B · want list — Search eBay and Search other sites (app-pages.js) ───────
section('B · the want list\'s two searches (app-pages.js)');
function wantHarness(src, opts) {
  opts = opts || {};
  const opened = [], lookups = [];
  const state = { wantData: opts.wantData || {} };
  const findMaster = (n, v, hint) => { lookups.push({ n, v, hint }); return opts.rows ? (opts.rows[n] || null) : (ROWS[n] || null); };
  const win = { open: u => opened.push(u) };
  const doc = { getElementById: () => null };
  const code = grab(src, '_wantRowFor') + '\n' + grab(src, '_wantSearchBrand') + '\n' + grab(src, '_ebayDoSearch') + '\n' + grab(src, 'wantSearchOtherSites')
    + '\nreturn { ebay: _ebayDoSearch, other: wantSearchOtherSites, rowFor: _wantRowFor };';
  const api = new Function('state', 'findMaster', 'rrSearchBrand', 'rrSearchTerms', 'rrSearchNumber', 'window', 'document', '_EPN_PARAMS', code)(
    state, findMaster, shared.brand, shared.terms, shared.num, win, doc, '');
  return { api, opened, lookups, state };
}
{
  const h = wantHarness(pages, { wantData: { '9504|': { itemNum: '9504', variation: '', manufacturer: 'Lionel' } } });
  h.api.ebay('9504', 'Erie', '');
  ok('Search eBay on the American Flyer want says American Flyer, not lionel',
     h.opened.length === 1 && q(h.opened[0]) === 'American Flyer 9504 Erie', h.opened[0] && q(h.opened[0]));
  ok('…and the row was found with the WANT ENTRY as the hint (not a null hint)',
     h.lookups.length === 1 && h.lookups[0].hint === h.state.wantData['9504|'] && h.lookups[0].v === '', JSON.stringify(h.lookups[0]));
  ok('…the eBay wording is otherwise untouched: bare number, road name, nothing added (v0.9.740)',
     /_sacat=180250/.test(h.opened[0]) && !/6-9504|Combination/.test(q(h.opened[0])));
}
{
  const h = wantHarness(pages);
  h.api.ebay('20-3001', 'Pennsylvania', ''); h.api.ebay('84631', 'Santa Fe', ''); h.api.ebay('6464-100', 'Western Pacific', '');
  ok('an MTH want searches eBay as MTH; modern and postwar Lionel as Lionel with the bare number',
     q(h.opened[0]) === 'MTH 20-3001 Pennsylvania' && q(h.opened[1]) === 'Lionel 84631 Santa Fe' && q(h.opened[2]) === 'Lionel 6464-100 Western Pacific',
     h.opened.map(q).join(' | '));
}
{
  const h = wantHarness(pages, { rows: {}, wantData: { '1234|': { itemNum: '1234', variation: '', manufacturer: 'Atlas' }, '5678|': { itemNum: '5678', variation: '' } } });
  h.api.ebay('1234', 'Reading', ''); h.api.ebay('5678', '', ''); h.api.other('1234', 'Reading', '');
  ok('a want NOT in the catalog searches with the brand the entry recorded (Atlas)…',
     q(h.opened[0]) === 'Atlas 1234 Reading' && q(h.opened[2]) === 'Atlas 1234 Reading for sale', h.opened.map(q).join(' | '));
  ok('…and only an entry that names no maker falls back to the old default word',
     q(h.opened[1]) === 'lionel 5678', q(h.opened[1]));
}
{
  const h = wantHarness(pages);
  h.api.other('9504', 'Erie', ''); h.api.other('84631', 'Santa Fe', ''); h.api.other('6464-100', 'Western Pacific', ''); h.api.other('20-3001', 'Pennsylvania', '');
  const [af, ml, pw, mth] = h.opened.map(q);
  ok('Search other sites: the American Flyer want says American Flyer, no "Lionel", no "modern", and keeps Erie',
     /American Flyer/.test(af) && !/Lionel/.test(af) && !/modern/i.test(af) && /Erie/.test(af) && /for sale$/.test(af), af);
  ok('…the modern Lionel want carries 6-84631 and no era word', /\b6-84631\b/.test(ml) && !/modern/i.test(ml), ml);
  ok('…the postwar want still says postwar (Brad\'s wording, must not regress)', /\bpostwar\b/.test(pw) && /6464-100/.test(pw), pw);
  ok('…the MTH want says MTH', /^MTH 20-3001/.test(mth), mth);
  ok('…every lookup carried the variation and a hint slot (three arguments)', h.lookups.every(l => l.v === '' && 'hint' in l));
}
ok('the three want-list call sites pass the VARIATION to both searches (phone cards, desktop table, detail page)',
   (pages.match(/wantFindOnEbay\('\$\{u\.itemNum\}','\$\{_?escName\}','\$\{escVar\}'\)/g) || []).length === 2 &&
   (pages.match(/wantSearchOtherSites\('\$\{u\.itemNum\}','\$\{_?escName\}','\$\{escVar\}'\)/g) || []).length === 2 &&
   /wantFindOnEbay\('\$\{it\.itemNum\}','\$\{\(it\.roadName\|\|''\)[\s\S]{0,60}?\}','\$\{\(it\.variation\|\|''\)/.test(coll) &&
   /wantSearchOtherSites\('\$\{it\.itemNum\}','\$\{\(it\.roadName\|\|''\)[\s\S]{0,60}?\}','\$\{\(it\.variation\|\|''\)/.test(coll));
ok('the eBay modal hands the variation on to _ebayDoSearch',
   /function wantFindOnEbay\(itemNum, roadName, variation\)/.test(pages) && /_ebayDoSearch\('\$\{itemNum\}','\$\{\(roadName\|\|''\)[\s\S]{0,60}?\}','\$\{\(variation\|\|''\)/.test(pages));
const noComments = src => src.replace(/^\s*\/\/.*$/gm, '');
ok('neither want-list search names a brand of its own any more (the fallback lives in ONE named helper)',
   !/'lionel'/.test(noComments(grab(pages, '_ebayDoSearch'))) && !/'lionel'/.test(noComments(grab(pages, 'wantSearchOtherSites'))) && /'lionel'/.test(grab(pages, '_wantSearchBrand')));

// ── C · parts list — the Google button (app-pages.js googlePart) ───────────
section('C · the parts list\'s Google button (app-pages.js)');
function partsHarness(src, opts) {
  opts = opts || {};
  const opened = [], lookups = [], brandAsks = [];
  const state = { personalData: opts.personalData || {} };
  const findMaster = (n, v, hint) => { lookups.push({ n, v, hint }); return ROWS[n] || null; };
  const win = Object.assign({ open: u => opened.push(u) }, opts.win || {});
  const api = new Function('state', 'findMaster', 'rrSearchBrand', 'rrSearchNumber', '_brandOfItem', 'window',
    grab(src, 'googlePart') + '\nreturn googlePart;')(state, findMaster, shared.brand, shared.num, n => { brandAsks.push(n); return 'Lionel'; }, win);
  return { api, opened, lookups, brandAsks };
}
{
  const pd = { itemNum: '9504', variation: '', inventoryId: 'inv-af' };
  const h = partsHarness(pages, { personalData: { 'inv-af': pd } });
  h.api('', '9504', 'coupler', 'inv-af');
  ok('a part for an OWNED American Flyer engine searches "part for American Flyer 9504 coupler"',
     h.opened.length === 1 && q(h.opened[0]) === 'part for American Flyer 9504 coupler', h.opened[0] && q(h.opened[0]));
  ok('…the engine was looked up through its owned copy (the hint IS the personal row)',
     h.lookups.length === 1 && h.lookups[0].hint === pd && h.brandAsks.length === 0);
  ok('…as a shopping search, with the where-from picker absent', /tbm=shop/.test(h.opened[0]));
}
{
  const pd = { itemNum: '84631', variation: '', inventoryId: 'inv-ml' };
  const h = partsHarness(pages, { personalData: { 'inv-ml': pd } });
  h.api('', '84631', 'smoke unit', 'inv-ml'); h.api('6101155203', '84631', 'eye dropper', 'inv-ml');
  ok('a modern Lionel engine is spelled 6-84631 when the item number stands in for a part number',
     q(h.opened[0]) === 'part for Lionel 6-84631 smoke unit', q(h.opened[0]));
  ok('…and a real part number still searches on its own, exactly as before',
     q(h.opened[1]) === 'part for Lionel 6101155203 eye dropper', q(h.opened[1]));
}
{
  const h = partsHarness(pages);
  h.api('', '3562-1', 'barrel car man');
  ok('a part with no owned copy keeps the pre-1838 path (the brand of the number alone)',
     q(h.opened[0]) === 'part for Lionel 3562-1 barrel car man' && h.brandAsks.join() === '3562-1' && h.lookups.length === 0, q(h.opened[0]));
}
{
  let picked = null;
  const h = partsHarness(pages, { win: { _pinWhereFrom: fn => { picked = fn; } }, personalData: { 'inv-af': { itemNum: '9504', variation: '' } } });
  h.api('', '9504', 'coupler', 'inv-af');
  ok('with the where-from picker present it asks first…', typeof picked === 'function' && h.opened.length === 0);
  picked({ site: 'trainz.com' });
  ok('…and a picked site narrows the SAME query with site: (this is the vendor search now)',
     h.opened.length === 1 && q(h.opened[0]) === 'site:trainz.com part for American Flyer 9504 coupler', h.opened[0] && q(h.opened[0]));
}
ok('the parts list row hands the button the owned copy\'s inventory id',
   /googlePart\(\\'' \+ esc\(p\.partNum\) \+ '\\',\\'' \+ esc\(p\.forItem\) \+ '\\',\\'' \+ esc\(p\.description\) \+ '\\',\\'' \+ esc\(p\.forInv \|\| ''\) \+ '\\'\)/.test(pages));

// ── D · the research card and its query helpers (research.js) ──────────────
section('D · the research card (research.js)');
const rs = new Function('_rrFirstClause', 'baseItemNum', 'window',
  grab(research, '_searchQuery') + '\n' + grab(research, '_ebayCore') + '\n' + grab(research, '_ebaySoldUrl') + '\n' + grab(research, '_googlePriceUrl') + '\n' + grab(research, '_ebayActiveUrl')
  + '\nreturn { sq: _searchQuery, g: _googlePriceUrl, es: _ebaySoldUrl, ea: _ebayActiveUrl };')(shared.clause, n => String(n).replace(/-?[PTC]$/i, ''), {});
ok('the clause rule reached the research query: "No. 390 Locomotive green" is no longer chopped to "No"',
   rs.sq('11-1005', 'MTH', '', 'No. 390 Locomotive green. Reissue') === 'MTH 11-1005 No. 390 Locomotive green', rs.sq('11-1005', 'MTH', '', 'No. 390 Locomotive green. Reissue'));
ok('…and a sentence end still ends the clause', rs.sq('6464-100', 'Lionel', 'Western Pacific', 'Boxcar. Cataloged 1954') === 'Lionel 6464-100 Western Pacific Boxcar');
ok('the Google price search takes the number and brand it is handed and adds the price words',
   q(rs.g('6-84631', 'Lionel', 'Santa Fe', 'Boxcar', '2019 O gauge')) === 'Lionel 6-84631 Santa Fe Boxcar 2019 O gauge sold prices value');
// the card itself: source pins on the lines that decide what the buttons search
const showCard = grabAt(research, 'function _showCard(res)');
ok('the card takes the brand from rrSearchBrand once a catalog row matched (the gauge rule)…',
   /if \(m\) \{[\s\S]{0,200}mfr = rrSearchBrand\(m\) \|\| mfr;/.test(showCard));
ok('…spells the Google number through rrSearchNumber and hands THAT to the price search',
   /_gNum = rrSearchNumber\(m\) \|\| itemNum;/.test(showCard) && /_googlePriceUrl\(_gNum, mfr, road, desc, _eraTerms\)/.test(showCard));
ok('…while both eBay buttons keep the bare number (v0.9.740)',
   /_ebaySoldUrl\(itemNum, mfr, road, desc\)/.test(showCard) && /_ebayActiveUrl\(itemNum, mfr, road, desc\)/.test(showCard));
ok('…and the era words are prewar / postwar only — "modern era" is gone from the card',
   /_pMap1 = \{ prewar: 'prewar', postwar: 'postwar' \};/.test(showCard) && !/modern era/.test(research));

// ── E · the wizard's price and eBay buttons (wizard.js) ─────────────────────
section('E · the wizard\'s Research and eBay Sold buttons (wizard.js)');
function wizHarness(src, data, matched, extra) {
  extra = extra || {};
  const opened = [], priceArgs = [];
  const win = { open: u => opened.push(u), _googlePriceUrl: extra.noPriceUrl ? undefined : function (n, m, r, d, e) { priceArgs.push({ n, m, r, d, e }); return 'https://www.google.com/search?q=' + encodeURIComponent([m, n, r, d, e].filter(Boolean).join(' ')); } };
  const wiz = { data: data || {}, matchedItem: matched || null };
  const code = grabAt(src, 'window._wizResearchIdentity = function') + ';\n' + grabAt(src, 'window._wizEbaySold = function') + ';\n' + grabAt(src, 'window._wizResearchPrice = function') + ';\nreturn window;';
  const w = new Function('window', 'wizard', 'state', 'findMaster', '_wizMasterPrefer', 'rrSearchBrand', 'rrSearchNumber', '_brandOfItem', 'showToast', '_EPN_PARAMS', 'getMasterDistinct', '_wizPeriodOfRow', '_wizScaleOfRow', 'console', code)(
    win, wiz, { personalData: {} }, (n, v, hint) => ROWS[n] || null, () => null, shared.brand, shared.num, () => '', () => {}, '', () => [], it => PERIOD[it && it._era] || '', it => (SCALE[it && it._era] || '').toUpperCase(), { warn: (...a) => { throw new Error('warn: ' + a.join(' ')); } });
  return { w, opened, priceArgs };
}
{
  const h = wizHarness(wizard, { itemNum: '9504' }, AF);
  const id = h.w._wizResearchIdentity();
  ok('the wizard identity of the American Flyer item says American Flyer (brand from the row\'s gauge)', id.mfr === 'American Flyer' && id.num === '9504' && id.gnum === '9504', JSON.stringify(id));
  h.w._wizEbaySold();
  ok('…so eBay Sold Listings searches "American Flyer 9504 Erie"', q(h.opened[0]) === 'American Flyer 9504 Erie', h.opened[0] && q(h.opened[0]));
  h.w._wizResearchPrice();
  ok('…and the price search carries year and gauge but NOT the word modern',
     h.priceArgs.length === 1 && h.priceArgs[0].m === 'American Flyer' && h.priceArgs[0].e === '1988 S gauge', JSON.stringify(h.priceArgs[0]));
}
{
  const h = wizHarness(wizard, { itemNum: '84631' }, MODL);
  const id = h.w._wizResearchIdentity();
  ok('the modern Lionel item: gnum is 6-84631 for Google, num stays 84631 for eBay', id.gnum === '6-84631' && id.num === '84631' && id.mfr === 'Lionel', JSON.stringify(id));
  h.w._wizEbaySold(); h.w._wizResearchPrice();
  ok('…eBay gets the bare number, Google gets 6-84631',
     q(h.opened[0]) === 'Lionel 84631 Santa Fe' && h.priceArgs[0].n === '6-84631', q(h.opened[0]) + ' | ' + JSON.stringify(h.priceArgs[0]));
}
{
  const h = wizHarness(wizard, { itemNum: '6464-100' }, PW);
  h.w._wizResearchPrice();
  ok('the postwar item still carries "postwar" (must not regress) plus year and gauge', h.priceArgs[0].e === 'postwar 1954 O gauge', JSON.stringify(h.priceArgs[0]));
}
{
  const h = wizHarness(wizard, { manualItemNum: 'CA-SO8912', manualManufacturer: 'K-Line', manualDesc: 'Caboose', manualRoadName: 'Reading' }, null);
  const id = h.w._wizResearchIdentity();
  ok('a manual entry keeps its own maker and number', id.mfr === 'K-Line' && id.num === 'CA-SO8912' && id.gnum === 'CA-SO8912', JSON.stringify(id));
}
ok('the wizard identity names no brand of its own; the eBay fallback for a maker-less manual entry is the one named default',
   !/'lionel'|'Lionel'/i.test(grabAt(wizard, 'window._wizResearchIdentity = function')) &&
   /\[i\.mfr \|\| 'lionel', i\.num, i\.road\]/.test(grabAt(wizard, 'window._wizEbaySold = function')));

// ── F · the Maintenance page (maintenance.js) ───────────────────────────────
section('F · the Maintenance page\'s searches (maintenance.js)');
const mt = new Function('rrSearchBrand', 'rrSearchNumber', '_manufacturerOfItem', '_docsRoute', 'baseItemNum',
  grab(maint, '_makerName') + '\n' + grab(maint, '_shortName') + '\n' + grab(maint, '_baseNum') + '\n' + grab(maint, '_ytUrl')
  + '\nreturn { maker: _makerName, yt: _ytUrl };')(shared.brand, shared.num, it => (it && it.manufacturer ? String(it.manufacturer).toLowerCase() : null), () => 'lionel', n => n);
ok('_makerName: the American Flyer engine is American Flyer; O and MTH unchanged',
   mt.maker(AF, 'mod_s') === 'American Flyer' && mt.maker(MODL, 'mod') === 'Lionel' && mt.maker(MTH, 'mth_o') === 'MTH');
ok('…a row with no tab answers with its own maker as written, and a bare era still falls to the route',
   mt.maker({ manufacturer: 'Atlas' }, 'atlas') === 'Atlas' && mt.maker({}, 'pw') === 'Lionel', mt.maker({ manufacturer: 'Atlas' }, 'atlas') + ' / ' + mt.maker({}, 'pw'));
ok('the YouTube how-to search quotes "American Flyer 9504", not Lionel',
   /%22American%20Flyer%209504%22/.test(mt.yt('', AF, 'e-unit', 'repair')) && !/Lionel/.test(mt.yt('', AF, 'e-unit', 'repair')), mt.yt('', AF, 'e-unit', 'repair'));
ok('the "Google the parts diagram" button spells the number through rrSearchNumber (6-84631), like _partsUrl already does',
   /var _gqNum = num;[\s\S]{0,220}_gqNum = rrSearchNumber\(item\) \|\| num;[\s\S]{0,400}'"' \+ mk \+ '" "' \+ _gqNum \+ '" '/.test(maint));
ok('_partsUrl still takes the item number from rrSearchNumber (v0.9.1770)', /num = \(typeof rrSearchNumber === 'function'\) \? String\(rrSearchNumber\(item\) \|\| ''\) : '';/.test(maint));

// ── G · the catalog link's other-makers branch (browse.js) and the dead builder
section('G · the other makers\' catalog link (browse.js) + the dead builder (photo-inbox.js)');
const link = new Function('window', 'state', '_makerForTab', 'rrSearchTerms', 'rrSearchNumber', 'rrSearchBrand', '_itemEraPeriod',
  grab(browse, '_itemExternalLinkURL') + '\nreturn _itemExternalLinkURL;')({}, {}, makerForTab, shared.terms, shared.num, shared.brand, periodOf);
ok('a Weaver 1055-S still searches "Weaver 1055 B&O" — the pilot wording, the suffix rule now shared',
   q(link({ _tab: 'Weaver - Items', _era: 'weaver', itemNum: '1055-S', roadName: 'B&O', description: 'Boxcar' })) === 'Weaver 1055 B&O',
   q(link({ _tab: 'Weaver - Items', _era: 'weaver', itemNum: '1055-S', roadName: 'B&O', description: 'Boxcar' })));
ok('a Weaver CUSTOM RUN row still searches its road, type and road number, never the words CUSTOM RUN',
   q(link({ _tab: 'Weaver - Items', _era: 'weaver', itemNum: 'CUSTOM RUN', roadName: 'Reading', itemType: 'Boxcar', variation: '1234' })) === 'Weaver Reading Boxcar 1234');
ok('the American Flyer catalog link (the v1768 branch) still says American Flyer',
   /American Flyer 9504/.test(q(link(AF))) && !/Lionel/.test(q(link(AF))));
ok('_pinVendorSearchURL — a builder nothing called — is gone from photo-inbox.js',
   !/_pinVendorSearchURL/.test(inbox.replace(/^\s*\/\/.*$/gm, '')));
ok('no query anywhere carries the era word "modern era" any more',
   ['research.js', 'wizard.js', 'browse.js', 'app-pages.js', 'maintenance.js', 'photo-inbox.js', 'app.js'].every(f => !/'modern era'/.test(APP(f))));

// ── H · planted offenders: every check above can go red ────────────────────
section('H · planted offenders — each old habit put back must fail its check');
{
  // 1. the want-list eBay search with 'lionel' hardcoded again
  const o = pages.replace("const query     = [_wantSearchBrand(_wantRowFor(itemNum, variation)), itemNum, roadName || ''].filter(Boolean).join(' ').trim();",
                          "const query     = ['lionel', itemNum, roadName || ''].filter(Boolean).join(' ').trim();");
  ok('offender 1 changed the source', o !== pages);
  const h = wantHarness(o, { wantData: { '9504|': { itemNum: '9504', variation: '' } } }); h.api.ebay('9504', 'Erie', '');
  ok('OFFENDER 1: eBay hardcoded to lionel → the American Flyer eBay check goes red', q(h.opened[0]) !== 'American Flyer 9504 Erie', q(h.opened[0]));
}
{
  // 2. the row looked up by number alone again (a null hint)
  const o = pages.replace("m = (typeof findMaster === 'function' && itemNum) ? findMaster(itemNum, variation || '', want || null) : null;",
                          "m = (typeof findMaster === 'function' && itemNum) ? findMaster(itemNum, '', null) : null;");
  ok('offender 2 changed the source', o !== pages);
  const h = wantHarness(o, { wantData: { '9504|': { itemNum: '9504', variation: '' } } }); h.api.ebay('9504', 'Erie', '');
  ok('OFFENDER 2: a null hint → "the want entry is the hint" goes red', !(h.lookups[0].hint === h.state.wantData['9504|']));
}
{
  // 3. the wizard identity taking the brand from the tab again
  const o = wizard.replace("mfr: _rowBrand || m.manufacturer ||", "mfr: m.manufacturer ||");
  ok('offender 3 changed the source', o !== wizard);
  const h = wizHarness(o, { itemNum: '9504' }, AF);
  ok('OFFENDER 3: brand from the tab → the American Flyer identity check goes red', h.w._wizResearchIdentity().mfr !== 'American Flyer');
}
{
  // 4. "modern era" back in the wizard's price search
  const o = wizard.replace("var _pMap = { prewar: 'prewar', postwar: 'postwar' };", "var _pMap = { prewar: 'prewar', postwar: 'postwar', modern: 'modern era' };");
  ok('offender 4 changed the source', o !== wizard);
  const h = wizHarness(o, { itemNum: '9504' }, AF); h.w._wizResearchPrice();
  ok('OFFENDER 4: the dead word rides again → the "not modern" check goes red', h.priceArgs[0].e !== '1988 S gauge' && /modern/.test(h.priceArgs[0].e));
  ok('OFFENDER 4b: …and the source scan catches it too', !['x'].every(() => !/'modern era'/.test(o)));
}
{
  // 5. _makerName without the shared rule
  const o = maint.replace(/      if \(item && typeof rrSearchBrand === 'function'\) \{\n        var b = rrSearchBrand\(item\);\n        if \(b\) return String\(b\);\n      \}\n/, '');
  ok('offender 5 changed the source', o !== maint);
  const m5 = new Function('rrSearchBrand', 'rrSearchNumber', '_manufacturerOfItem', '_docsRoute', 'baseItemNum', grab(o, '_makerName') + '\nreturn _makerName;')(
    shared.brand, shared.num, it => (it && it.manufacturer ? String(it.manufacturer).toLowerCase() : null), () => 'lionel', n => n);
  ok('OFFENDER 5: the maker from the tab again → the American Flyer engine check goes red', m5(AF, 'mod_s') !== 'American Flyer', m5(AF, 'mod_s'));
}
{
  // 6. the research query with the old clause splitter
  const o = research.replace("var d = ((typeof _rrFirstClause === 'function') ? _rrFirstClause(_cleaned) : _cleaned.split(/[—|,.;]/)[0])", "var d = (_cleaned.split(/[—|,.;]/)[0])");
  ok('offender 6 changed the source', o !== research);
  const r6 = new Function('_rrFirstClause', 'baseItemNum', 'window', grab(o, '_searchQuery') + '\nreturn _searchQuery;')(shared.clause, n => n, {});
  ok('OFFENDER 6: the old splitter → "No. 390" is chopped to "No" again, the clause check goes red',
     r6('11-1005', 'MTH', '', 'No. 390 Locomotive green. Reissue') !== 'MTH 11-1005 No. 390 Locomotive green', r6('11-1005', 'MTH', '', 'No. 390 Locomotive green. Reissue'));
}
{
  // 7. googlePart without the owned-copy path
  const o = pages.replace("if (_row && typeof rrSearchBrand === 'function') { try { mfr = rrSearchBrand(_row) || ''; } catch (e) { mfr = ''; } }", "");
  ok('offender 7 changed the source', o !== pages);
  const h = partsHarness(o, { personalData: { 'inv-af': { itemNum: '9504', variation: '' } } }); h.api('', '9504', 'coupler', 'inv-af');
  ok('OFFENDER 7: the brand from the number alone again → the owned-engine check goes red', q(h.opened[0]) !== 'part for American Flyer 9504 coupler', q(h.opened[0]));
}
{
  // 8. the dead builder put back
  const o = inbox + "\n  window._pinVendorSearchURL = function (site, num, hints) { return 'x'; };\n";
  ok('OFFENDER 8: the callerless vendor builder back → its tombstone check goes red', /_pinVendorSearchURL/.test(o.replace(/^\s*\/\/.*$/gm, '')));
}

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
