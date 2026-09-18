// ═══════════════════════════════════════════════════════════════
// catalog_part_link_tests.js — v0.9.1759.
//
// Brad, 2026-09-16, looking at 2338's Need-a-part lane ("Brass Idler Gear
// #2023-117 · Lionel Parts · $3.5 · in stock · diagram"):
//   1) "we can't link directly to trainz website or show the price or if its
//      in stock, so remove all that."
//   2) "the store link, should google the part number" — "lionel" "2338"
//      "brass idler gear" "#2023-117".
//   3) a drop-down of the user's favorite online train store — their own list,
//      type to add one ("trainz or trainz.com") — added to the search.
//   4) "we dont need to automatically show lionel, atlas, or whoevers parts
//      either directly unless the user select them in the dropdown … if its
//      selected, the link can go directly there with no google look up."
//
// THE RULES THIS SUITE PROTECTS (maintenance.js):
//   - ONE search builder, _partsUrl, behind the typed box AND every catalog
//     part line. Only the specific thing is quoted; a store with a dot becomes
//     site:; nothing is hardcoded.
//   - ONE link rule, _catalogPartLinkHtml, drawn by the popup lane AND the
//     Workbench drawer: a web search, or the maker's own page ONLY when
//     "The maker's own store" is the pick AND the catalog is the maker's own
//     (ERAS[era].partsOfficial).
//   - The "Any dealer" dropdown is the favorite-store list; it remembers its pick,
//     and NO store is ever pre-loaded into it (Brad, v1760: "i, as a user need to
//     add them first").
//   - No price, no stock, no dealer link on a line; "+ Want it" writes none either.
//
// v0.9.1760 — Brad sent a screenshot of "did not match any documents". v1759's
// line search carried the ENGINE's number and the whole description:
//   lionel 84631 TRACTION TIRE .625 ID x .058 TH x .148 WD "6304678206"
// Google requires every word, and 84631 (the engine) appears nowhere on a page
// selling part 6304678206 — so it could never match. A PART IS FOUND BY ITS OWN
// NUMBER: maker + the part number, nothing else. The checks below hold that line.
// These run the real functions, lifted out of the source, with fakes around them.
// Run:  node tests/catalog_part_link_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const rd = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
const mt = rd('maintenance.js'), cfg = rd('config.js'), sw = rd('sw.js'), ix = rd('index.html');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
function grab(sig) { const i = mt.indexOf(sig); if (i < 0) return ''; let d = 0; for (let k = mt.indexOf('{', i); k < mt.length; k++) { if (mt[k] === '{') d++; else if (mt[k] === '}') { d--; if (!d) return mt.slice(i, k + 1); } } return ''; }

// ── the real functions, in a fake room ────────────────────────────────────
const SRC = [
  'function _partsUrl(dealer, item, quoted, plain, makerWord)',
  'function _dealerSite(d)',
  'function _plainWords(s)',
  'function _dealerPick()',
  'function _catalogPartLinkHtml(r, item)',
  'function _favRow(prefKey, selectId, label)',
  'function _maintCatalogLaneHtml(rows, q, taskId, item)',
].map(grab);
ok('every function the suite needs is in the source', SRC.every(s => s.length > 40), SRC.map(s => s.length).join(','));
const picked = grab('window._maintDealerPicked = function (sel)');
ok('…and the dealer-pick handler too', picked.length > 40);

function room(opts) {
  opts = opts || {};
  const prefs = Object.assign({}, opts.prefs || {});
  const favs = opts.favs || [];
  const sel = opts.select === undefined ? null : opts.select;   // null = the popup is not on screen
  const spy = { renders: [] };
  const MAINT = { PREF_DEALERS: 'maint_parts_dealers', PREF_CHANNELS: 'maint_yt_channels', PREF_DEALER_PICK: 'maint_parts_dealer_pick', MAKER_STORE: '__maker' };
  const ERAS = {
    pw: { label: 'Lionel Postwar', manufacturer: 'Lionel' },
    lionel_parts: { label: 'Lionel Parts', manufacturer: 'Lionel' },
    traintender_parts: { label: 'Train Tender Parts', manufacturer: 'Lionel', partsLink: 'listing' },
    lionelstore_parts: { label: 'Lionel Store Parts', manufacturer: 'Lionel', partsLink: 'store', partsOfficial: true },
    mth_parts: { label: 'MTH Parts', manufacturer: 'MTH', partsOfficial: true },
  };
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const document = {
    getElementById: id => (id === 'maint-pop-dealer' ? sel : (id === 'maint-pop-catalog' && opts.lane ? opts.lane : null)),
  };
  const rrJsArg = v => esc(String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
  const api = new Function('MAINT', 'ERAS', '_esc', 'rrJsArg', '_btn', '_btnQuiet', '_makerName', '_favs', '_prefGet', '_prefSet', 'document', 'window', '_maintCatalogLaneRender',
    SRC.join('\n') + '\n' + picked + ';\nreturn { url: _partsUrl, site: _dealerSite, words: _plainWords, pick: _dealerPick, link: _catalogPartLinkHtml, favRow: _favRow, lane: _maintCatalogLaneHtml, picked: window._maintDealerPicked };'
  )(MAINT, ERAS, esc, rrJsArg, () => 'class="btn"', () => 'class="quiet"', (item) => (item && item.manufacturer) || 'Lionel',
    (key) => (key === MAINT.PREF_DEALERS ? favs.slice() : []), (k, d) => (k in prefs ? prefs[k] : d), (k, v) => { prefs[k] = v; },
    document, {}, (t) => spy.renders.push(t));
  return { api, prefs, spy };
}
const q = url => decodeURIComponent(String(url).replace('https://www.google.com/search?q=', '')).replace(/\+/g, ' ');
const ITEM = { itemNum: '2338', _era: 'pw', manufacturer: 'Lionel' };
const GEAR = { itemNum: '2023-117', description: 'Brass Idler Gear (Repro-Brass)', _era: 'lionel_parts', _tab: 'Lionel Parts', msrp: '3.5', notes: 'In stock', refLink: 'https://www.trainz.com/products/lionel-2023-117-brass-idler-gear' };
const TIRE = { itemNum: '6304678206', description: 'TRACTION TIRE / .625" ID x .058" TH x .148" WD', _era: 'lionelstore_parts', _tab: 'Lionel Store Parts', msrp: '1.99', notes: 'Store SKU cs-6304678206-p; In stock, qty 18083; fits 837 items', refLink: 'https://www.lionelsupport.com/TRACTION-TIRE-625-ID-x-058-TH-x-148-WD' };
const MTHP = { itemNum: 'AA0000001', description: 'WICK / ALL MTH SMOKE UNITS', _era: 'mth_parts', _tab: 'MTH Parts', refLink: 'https://www.mthpartsandsales.com/part/AA0000001' };
const TT = { itemNum: '2343-13', description: 'horn bracket', _era: 'traintender_parts', _tab: 'Train Tender Parts', refLink: 'https://ttender.com/postwar.html' };

section('_partsUrl — the ONE search builder: Brad\'s search, with only the specific thing quoted');
let R = room();
let u = R.api.url('', ITEM, '2023-117', 'Brass Idler Gear (Repro-Brass)');
ok('Any dealer: maker, item number and description as plain words, the part number in quotes',
   q(u) === 'Lionel 2338 Brass Idler Gear (Repro-Brass) "2023-117"', q(u));
ok('…and it is a Google search', /^https:\/\/www\.google\.com\/search\?q=/.test(u));
ok('exactly one quoted phrase — four quoted phrases usually finds nothing', (q(u).match(/"/g) || []).length === 2);
ok('a favorite typed as a NAME ("trainz") is one more word', q(R.api.url('trainz', ITEM, '2023-117', 'Brass Idler Gear')) === 'trainz Lionel 2338 Brass Idler Gear "2023-117"');
ok('a favorite typed as a SITE ("trainz.com") keeps the search on that store', q(R.api.url('trainz.com', ITEM, '2023-117', 'Brass Idler Gear')) === 'site:trainz.com Lionel 2338 Brass Idler Gear "2023-117"');
ok('…so does a pasted address, trimmed to its host', R.api.site('https://www.trainz.com/parts/lionel') === 'trainz.com' && R.api.site('WWW.Trainz.com') === 'trainz.com');
ok('…but a shop NAME with spaces is never a site', R.api.site("Joe's Train Shop") === '' && q(R.api.url("Joe's Train Shop", ITEM, '2023-117')) === "Joe's Train Shop Lionel 2338 \"2023-117\"");
ok('"The maker\'s own store" with nothing to open falls back to the plain search — the key never leaks into the query',
   q(R.api.url('__maker', ITEM, '2023-117', 'Brass Idler Gear')) === 'Lionel 2338 Brass Idler Gear "2023-117"');
ok('inch marks in a description are stripped and slashes become spaces (Google would read .625" as a quote)',
   q(R.api.url('', { itemNum: '84631', manufacturer: 'Lionel' }, TIRE.itemNum, TIRE.description)) === 'Lionel 84631 TRACTION TIRE .625 ID x .058 TH x .148 WD "6304678206"');
ok('the typed box: what the user typed is the quoted thing', q(R.api.url('', ITEM, 'traction tire')) === 'Lionel 2338 "traction tire"');
ok('a loose part with no item (the drawer): the catalog\'s maker stands in, no item number', q(R.api.url('', null, '2343-13', 'horn bracket', 'Lionel')) === 'Lionel horn bracket "2343-13"');
ok('nothing hardcoded: with no dealer, no item and no maker the query is just the part', q(R.api.url('', null, '2343-13')) === '"2343-13"');

section('_dealerPick — the dropdown when it is on screen, else what it remembered');
R = room({ prefs: { maint_parts_dealer_pick: 'trainz.com' }, favs: ['trainz.com', 'Olsen\'s'] });
ok('remembered favorite, popup closed → that favorite', R.api.pick() === 'trainz.com');
R = room({ prefs: { maint_parts_dealer_pick: 'trainz.com' }, favs: [] });
ok('a remembered favorite that was since removed → Any dealer', R.api.pick() === '');
R = room({ prefs: { maint_parts_dealer_pick: '__maker' }, favs: [] });
ok('the built-in choice is always valid', R.api.pick() === '__maker');
R = room({ prefs: { maint_parts_dealer_pick: 'Olsen\'s' }, favs: ['Olsen\'s', 'trainz.com'], select: { value: 'trainz.com' } });
ok('the dropdown on screen wins over the memory', R.api.pick() === 'trainz.com');
R = room({ favs: ['trainz.com'], lane: { getAttribute: () => 'task-7' } });
R.api.picked({ value: 'trainz.com' });
ok('picking saves the choice and redraws the lane for its task', R.prefs.maint_parts_dealer_pick === 'trainz.com' && R.spy.renders.join() === 'task-7');

section('_catalogPartLinkHtml — ONE link rule for a catalog part line');
const href = h => (h.match(/href="([^"]+)"/) || [])[1] || '';
const word = h => (h.match(/>([^<]+)<\/a>/) || [])[1] || '';
R = room();
let h = R.api.link(GEAR, ITEM);
ok('Any dealer, a Trainz part: a web search — never the trainz.com page', /google\.com\/search/.test(href(h)) && !/trainz/.test(href(h)) && word(h) === 'search');
ok('…and it is maker + the PART\'s own number, nothing else (v1760)', q(href(h).replace(/&amp;/g, '&')) === 'Lionel "2023-117"', q(href(h).replace(/&amp;/g, '&')));
ok('…the ENGINE\'s number is NOT in it — 84631/2338 never appears on a page selling that part, and requiring it found nothing',
   !/2338/.test(decodeURIComponent(href(h))));
ok('…nor the description or its dimensions — every extra word is another way to find nothing',
   !/Brass|Idler|Gear|Repro/i.test(decodeURIComponent(href(h))));
h = R.api.link(TIRE, { itemNum: '84631', manufacturer: 'Lionel' });
ok('Any dealer, a Lionel store part: a web search too — the store is NOT linked on its own', /google\.com\/search/.test(href(h)) && !/lionelsupport/.test(href(h)));
ok('…the one that failed for Brad: it is now exactly maker + part number', q(href(h).replace(/&amp;/g, '&')) === 'Lionel "6304678206"', q(href(h).replace(/&amp;/g, '&')));
ok('…with no 84631 and no ".625 ID x .058 TH" soup', !/84631|625|058|148|TRACTION/i.test(decodeURIComponent(href(h))));
ok('a catalog row with NO part number falls back to the item and what the part is called',
   /84631/.test(decodeURIComponent(href(R.api.link(Object.assign({}, TIRE, { itemNum: '' }), { itemNum: '84631', manufacturer: 'Lionel' })))));
R = room({ favs: ['trainz.com'], select: { value: 'trainz.com' } });
h = R.api.link(GEAR, ITEM);
ok('a picked site: the search stays on it and the link says so', /site%3Atrainz\.com/.test(href(h)) && word(h) === 'search trainz.com');
ok('…and it is still just maker + part number behind it', q(href(h).replace(/&amp;/g, '&')) === 'site:trainz.com Lionel "2023-117"');
R = room({ favs: ['Olsen\'s'], select: { value: 'Olsen\'s' } });
h = R.api.link(GEAR, ITEM);
ok('a picked name: one more search word, and the link names it', /Olsen/.test(decodeURIComponent(href(h))) && word(h) === 'search Olsen&#39;s');
R = room({ select: { value: '__maker' } });
h = R.api.link(TIRE, { itemNum: '84631', manufacturer: 'Lionel' });
ok('"The maker\'s own store" + a part from Lionel\'s own store → the part\'s page, worded by the era ("store")', href(h) === TIRE.refLink && word(h) === 'store');
h = R.api.link(MTHP, { itemNum: '20-3045-1', manufacturer: 'MTH' });
ok('…and an MTH part → MTH\'s own page', href(h) === MTHP.refLink);
h = R.api.link(GEAR, ITEM);
ok('…but a Trainz part has no maker page: back to the web search, trainz.com still never linked', /google\.com\/search/.test(href(h)) && !/trainz/.test(href(h)) && word(h) === 'search');
h = R.api.link(TT, null);
ok('…same for a Train Tender part (a dealer, not the maker)', /google\.com\/search/.test(href(h)) && !/ttender/.test(href(h)));
h = R.api.link(Object.assign({}, TIRE, { refLink: '' }), null);
ok('a store part with no page → the search, never a dead link', /google\.com\/search/.test(href(h)));
ok('the link opens in a new tab, safely', /target="_blank" rel="noopener"/.test(h));

section('The lane: description, number, source, ONE link — no price, no stock, no dealer link');
R = room();
h = R.api.lane([GEAR, TIRE], '', 'task-9', ITEM);
ok('no price and no stock anywhere on the lines', !/\$/.test(h) && !/in stock/i.test(h) && !/out of stock/i.test(h));
ok('no dealer or store site is linked on its own', !/trainz\.com/.test(h) && !/lionelsupport\.com/.test(h));
ok('each line: description, #number, the source, then the search link', /Brass Idler Gear \(Repro-Brass\)<\/b> <span[^>]*>#2023-117<\/span>/.test(h) && /Lionel Parts · <a href="https:\/\/www\.google\.com\/search\?q=[^"]+"[^>]*>search<\/a>/.test(h));
ok('"+ Want it" is still there, twice', (h.match(/\+ Want it/g) || []).length === 2 && /_maintPopWantCatalog\('lionel_parts','2023-117','','task-9'\)/.test(h));
ok('the lane still gets the card\'s item (a numberless row needs it) but no line\'s search carries the engine number (v1760)',
   /_maintCatalogLaneHtml\(rows, q, taskId, item\)/.test(mt) && !/2338/.test(decodeURIComponent(h)));
R = room({ favs: ['trainz.com'], select: { value: 'trainz.com' } });
ok('with a store picked every line searches that store', (R.api.lane([GEAR, TIRE], '', 't', ITEM).match(/search trainz\.com/g) || []).length === 2);

section('Nothing is ever pre-loaded into a store list (v1760)');
// the CODE, with the comments stripped — the comment explains what was removed and says those names
const favSrc = grab('function _favs(key)');
const favCode = favSrc.replace(/\/\/[^\n]*/g, '');
ok('_favs seeds NOTHING — no Trainz, no Train Tender, no Henning\'s in the code', !/Trainz|Train Tender|Henning|_touched/.test(favCode), favCode.replace(/\s+/g, ' ').slice(0, 160));
ok('…it returns only what was saved, and an unreadable value is an empty list, never a default',
   /return a;/.test(favSrc) && /catch \(e\) \{ return \[\]; \}/.test(favSrc));
const emptyRoom = room({ favs: [] });
ok('an untouched dealer dropdown offers only Any dealer and the maker\'s own store',
   (emptyRoom.api.favRow('maint_parts_dealers', 'maint-pop-dealer', 'Any dealer').match(/<option/g) || []).length === 2);

section('The dropdown: the favorite-store list, one built-in choice, remembers its pick');
R = room({ favs: ['trainz.com', 'Olsen\'s'], prefs: { maint_parts_dealer_pick: 'Olsen\'s' } });
h = R.api.favRow('maint_parts_dealers', 'maint-pop-dealer', 'Any dealer');
ok('Any dealer first, then "The maker\'s own store", then the user\'s favorites, in that order',
   h.indexOf('>Any dealer<') < h.indexOf('value="__maker">The maker&#39;s own store<') && h.indexOf('__maker') < h.indexOf('>trainz.com<') && h.indexOf('>trainz.com<') < h.indexOf('>Olsen&#39;s<'));
ok('the remembered pick is selected', /value="Olsen&#39;s" selected>/.test(h) && (h.match(/ selected>/g) || []).length === 1);
ok('picking calls the handler; + Add and − are still there', /onchange="_maintDealerPicked\(this\)"/.test(h) && /_maintAddFav\('maint_parts_dealers','maint-pop-dealer'\)/.test(h) && /_maintDelFav\('maint_parts_dealers','maint-pop-dealer'\)/.test(h));
h = R.api.favRow('maint_yt_channels', 'maint-yt-channel', 'All of YouTube');
ok('the YouTube channel row is untouched: no maker choice, no handler', !/__maker/.test(h) && !/onchange/.test(h));

section('Source pins: the two places draw with the same rule; nothing writes price or link');
const drawer = grab('function _binFitsHtml(b)'), fits = grab('function _binFits(b)');
ok('the Workbench drawer\'s catalog line uses _catalogPartLinkHtml with the part number it looked up',
   /_catalogPartLinkHtml\(\{ _era: f\.era, refLink: f\.link, itemNum: f\.partNum, description: f\.label \}, null\)/.test(drawer) && !/partsLink/.test(drawer));
ok('…and _binFits hands it that number', /partNum: String\(pr\.itemNum \|\| pn\)/.test(fits));
const want = grab('window._maintPopWantCatalog = async function (era, partNum, variation, taskId)');
ok('"+ Want it" notes the catalog only — no sweep-day price, no dealer link', /var note = 'from the ' \+ src \+ ' catalog';/.test(want) && !/msrp|refLink/.test(want));
const popSearch = grab('window._maintPopSearch = function ()');
ok('the typed box\'s Search → goes through the same builder', /_partsUrl\(dealer, tg\.item, part\.trim\(\)\)/.test(popSearch));
ok('the lane is redrawn with the card\'s item', /_maintCatalogLaneHtml\(_maintPickerParts\(tg, taskId\)\.catalog, q, taskId, tg\.item\)/.test(grab('function _maintCatalogLaneRender(taskId)')));
ok('the lane\'s container remembers its task so a new pick can redraw it', /id="maint-pop-catalog" data-task="' \+ _esc\(taskId \|\| ''\) \+ '"/.test(grab('window._maintPartsPopup = function (taskId, taskName)')));
ok('− cannot remove the built-in choice, and a removal goes back to Any dealer', /if \(sel\.value === MAINT\.MAKER_STORE\) return;/.test(grab('window._maintDelFav = function (prefKey, selectId)')) && /window\._maintDealerPicked\(sel\)/.test(grab('window._maintDelFav = function (prefKey, selectId)')));
ok('adding a store makes it the pick', /if \(prefKey === MAINT\.PREF_DEALERS\) window\._maintDealerPicked\(sel\);/.test(grab('window._maintAddFav = function (prefKey, selectId)')));
ok('the lane never reads a price or a stock note any more', !/msrp|In stock|Out of stock/.test(grab('function _maintCatalogLaneHtml(rows, q, taskId, item)')));
ok('no catalog row link is drawn anywhere but inside the one rule', !/_esc\((r\.refLink|f\.link)\) \+ '" target="_blank"/.test(mt) && /href="' \+ _esc\(href\) \+ '" target="_blank"/.test(grab('function _catalogPartLinkHtml(r, item)')));

section('config.js: which catalogs are the maker\'s own store');
ok('Lionel\'s store and MTH Parts & Sales are official', /lionelstore_parts: \{[^}]*partsOfficial: true/.test(cfg) && /mth_parts: \{[^}]*partsOfficial: true/.test(cfg));
ok('Trainz and Train Tender are dealers — never official', !/lionel_parts: \{[^}]*partsOfficial/.test(cfg) && !/traintender_parts: \{[^}]*partsOfficial/.test(cfg));

section('The trio moved together');
ok('APP_VERSION v0.9.1767', /const APP_VERSION = 'v0\.9\.1767';/.test(cfg));
ok('CACHE_NAME is the version + 10', /const CACHE_NAME = 'mca-v1777';/.test(sw));
ok('index.html stamps every asset at 1767 and none at 1766', (ix.match(/\?v=1767/g) || []).length === 79 && !/\?v=1766/.test(ix));

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
