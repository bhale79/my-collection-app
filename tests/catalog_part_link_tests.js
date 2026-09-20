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
  'function _partPhrase(desc)',
  'function _dealerPick()',
  'function _catalogPartLinkHtml(r, item)',
  'function _partLinkA(href, word)',
  'function _favRow(prefKey, selectId, label)',
  'function _maintCatalogLaneHtml(rows, q, taskId, item)',
].map(grab);
// v0.9.1770: the part line now offers the MAKER'S page as well as the store's,
// and the lookups behind that live in app-data.js. They are lifted in for real —
// leave them out and _catalogPartLinkHtml silently draws one link instead of
// two, and this whole file would go on passing while the feature was gone.
const dataSrc = (() => {
  const d = rd('app-data.js');
  const one = n => { const i = d.indexOf('function ' + n + '('); if (i < 0) return ''; let k = d.indexOf('{', i), depth = 0;
    for (; k < d.length; k++) { if (d[k] === '{') depth++; else if (d[k] === '}') { depth--; if (!depth) return d.slice(i, k + 1); } } return ''; };
  return ['_linkHost', '_partLinksIndex', '_partLinkOn', '_partOfficialLink'].map(one);
})();
ok('the maker-link lookups were lifted out of app-data.js', dataSrc.every(x => x.length > 40),
   dataSrc.map(x => x.length).join(','));
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
  const api = new Function('MAINT', 'ERAS', '_esc', 'rrJsArg', '_btn', '_btnQuiet', '_makerName', '_favs', '_prefGet', '_prefSet', 'document', 'window', '_maintCatalogLaneRender', 'state', '_partsMakerOf',
    'var _plIdx = null, _plIdxRows = null, _plIdxLen = -1;\n' + dataSrc.join('\n') + '\n'
    + SRC.join('\n') + '\n' + picked + ';\nreturn { url: _partsUrl, site: _dealerSite, words: _plainWords, phrase: _partPhrase, pick: _dealerPick, link: _catalogPartLinkHtml, favRow: _favRow, lane: _maintCatalogLaneHtml, picked: window._maintDealerPicked };'
  )(MAINT, ERAS, esc, rrJsArg, () => 'class="btn"', () => 'class="quiet"', (item) => (item && item.manufacturer) || 'Lionel',
    (key) => (key === MAINT.PREF_DEALERS ? favs.slice() : []), (k, d) => (k in prefs ? prefs[k] : d), (k, v) => { prefs[k] = v; },
    document, {}, (t) => spy.renders.push(t),
    // real parts rows carry itemType "Part"; the link index only indexes those
    { masterAllRows: (opts.catalog || []).map(r => Object.assign({ itemType: 'Part' }, r)),
      masterData:    (opts.catalog || []).map(r => Object.assign({ itemType: 'Part' }, r)) },
    (era) => (ERAS[era] && ERAS[era].manufacturer) || '');
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
ok('Any dealer: maker, item number, the quoted thing, then the plain words',
   q(u) === 'Lionel 2338 "2023-117" Brass Idler Gear (Repro-Brass)', q(u));
ok('…and it is a Google search', /^https:\/\/www\.google\.com\/search\?q=/.test(u));
ok('exactly one quoted phrase — four quoted phrases usually finds nothing', (q(u).match(/"/g) || []).length === 2);
ok('a favorite typed as a NAME ("trainz") is one more word', q(R.api.url('trainz', ITEM, '2023-117', 'Brass Idler Gear')) === 'trainz Lionel 2338 "2023-117" Brass Idler Gear');
// v0.9.1770 — site: is gone. It is a hard filter, so it returned a blank page
// every time the store did not carry the part, which is the usual case (896 of
// 55,955 Lionel store parts exist at Trainz). As a plain word the store still
// steers the search and a near miss still comes back with something to click.
ok('a favorite typed as a SITE ("trainz.com") is the store as a WORD, not site:',
   q(R.api.url('trainz.com', ITEM, '2023-117', 'Brass Idler Gear')) === 'trainz.com Lionel 2338 "2023-117" Brass Idler Gear',
   q(R.api.url('trainz.com', ITEM, '2023-117', 'Brass Idler Gear')));
ok('…so does a pasted address, trimmed to its host', R.api.site('https://www.trainz.com/parts/lionel') === 'trainz.com' && R.api.site('WWW.Trainz.com') === 'trainz.com');
ok('…but a shop NAME with spaces is never a site', R.api.site("Joe's Train Shop") === '' && q(R.api.url("Joe's Train Shop", ITEM, '2023-117')) === "Joe's Train Shop Lionel 2338 \"2023-117\"");
ok('"The maker\'s own store" with nothing to open falls back to the plain search — the key never leaks into the query',
   q(R.api.url('__maker', ITEM, '2023-117', 'Brass Idler Gear')) === 'Lionel 2338 "2023-117" Brass Idler Gear');
ok('inch marks in a description are stripped and slashes become spaces (Google would read .625" as a quote)',
   q(R.api.url('', { itemNum: '84631', manufacturer: 'Lionel' }, TIRE.itemNum, TIRE.description)) === 'Lionel 84631 "6304678206" TRACTION TIRE .625 ID x .058 TH x .148 WD',
   q(R.api.url('', { itemNum: '84631', manufacturer: 'Lionel' }, TIRE.itemNum, TIRE.description)));
ok('the typed box: what the user typed is the quoted thing', q(R.api.url('', ITEM, 'traction tire')) === 'Lionel 2338 "traction tire"');
ok('a loose part with no item (the drawer): the catalog\'s maker stands in, no item number', q(R.api.url('', null, '2343-13', 'horn bracket', 'Lionel')) === 'Lionel "2343-13" horn bracket');
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

section('_catalogPartLinkHtml — v0.9.1770: TWO links on a part line');
// Brad, 2026-09-19, replacing the v0.9.1759 rule above ("we dont need to
// automatically show lionel, atlas, or whoevers parts directly unless the user
// select them"):
//   "we should always show the link for the mfr part link. if they select
//    trainz, then we should show the trainz parts lists, if another, the search
//    that with google"
//   "so a part should have 2 links always, in this case, lionel link, no trainz
//    direct link, but a google search to search trainz for the part"
// The maker's page is no longer gated on the dropdown. A DEALER's page still is
// — that half of the Sept 16 rule stands.
const hrefs = h => (h.match(/href="([^"]*)"/g) || []).map(x => x.slice(6, -1).replace(/&amp;/g, '&'));
const words = h => (h.match(/>([^<]+)<\/a>/g) || []).map(x => x.slice(1, -4));
const href = h => hrefs(h)[0] || '';
const word = h => words(h)[0] || '';
// The same part, carried by BOTH catalogs — the 1.6% case where a second
// direct link is possible at all.
const TWIN = { itemNum: TIRE.itemNum, description: 'TRACTION TIRE', _era: 'lionel_parts', _tab: 'Lionel Parts',
               refLink: 'https://www.trainz.com/products/lionel-traction-tire' };
const SHELF = [GEAR, TIRE, MTHP, TT, TWIN];

R = room({ catalog: SHELF });
let h = R.api.link(TIRE, { itemNum: '84631', manufacturer: 'Lionel' });
ok('a Lionel store part, Any dealer: TWO links', hrefs(h).length === 2, words(h).join(' / '));
ok('…the first is Lionel\'s own page, WITHOUT the user picking anything', hrefs(h)[0] === TIRE.refLink, hrefs(h)[0]);
ok('…worded by the era', words(h)[0] === 'store', words(h)[0]);
ok('…the second is a search', /google\.com\/search/.test(hrefs(h)[1]) && words(h)[1] === 'search');
ok('…carrying the item number, the part number and what the part is called (Brad, Sept 19)',
   q(hrefs(h)[1]) === 'Lionel 84631 6304678206 TRACTION TIRE', q(hrefs(h)[1]));
ok('…with nothing quoted — quotes demand a page that the other store never wrote',
   q(hrefs(h)[1]).indexOf('"') < 0, q(hrefs(h)[1]));
ok('…and without the ".625 ID x .058 TH" soup (the v0.9.1760 lesson, now in _partPhrase)',
   !/625|058|148/.test(q(hrefs(h)[1])), q(hrefs(h)[1]));

h = R.api.link(GEAR, ITEM);
ok('a Trainz part with no Lionel page: one link, the search — and trainz.com is NOT linked',
   hrefs(h).length === 1 && /google\.com\/search/.test(hrefs(h)[0]) && !/trainz\.com\/products/.test(hrefs(h)[0]));

R = room({ catalog: SHELF, favs: ['trainz.com'], select: { value: 'trainz.com' } });
h = R.api.link(TIRE, { itemNum: '84631', manufacturer: 'Lionel' });
ok('Trainz picked, and Trainz HAS this part: Lionel\'s page and Trainz\'s own page',
   hrefs(h).length === 2 && hrefs(h)[0] === TIRE.refLink && hrefs(h)[1] === TWIN.refLink, hrefs(h).join(' '));
ok('…the second link is named for the store', words(h)[1] === 'trainz.com', words(h)[1]);
h = R.api.link(Object.assign({}, TIRE, { itemNum: '6304678299' }), { itemNum: '84631', manufacturer: 'Lionel' });
ok('Trainz picked but Trainz does NOT have this part: Lionel\'s page and a search of Trainz',
   hrefs(h).length === 2 && /google\.com\/search/.test(hrefs(h)[1]) && words(h)[1] === 'search trainz.com', hrefs(h)[1]);
ok('…and the search names the store as a word', q(hrefs(h)[1]).indexOf('trainz.com ') === 0, q(hrefs(h)[1]));

R = room({ catalog: SHELF, favs: ['Olsen\'s'], select: { value: 'Olsen\'s' } });
h = R.api.link(TIRE, { itemNum: '84631', manufacturer: 'Lionel' });
ok('a picked NAME (no web address): Lionel\'s page and a search naming the shop',
   hrefs(h).length === 2 && /Olsen/.test(q(hrefs(h)[1])) && words(h)[1] === 'search Olsen&#39;s');
ok('…and Trainz is never slipped in just because we hold its address',
   hrefs(h).every(u => !/trainz\.com/.test(u)), hrefs(h).join(' '));

R = room({ catalog: SHELF, select: { value: '__maker' } });
h = R.api.link(MTHP, { itemNum: '20-3045-1', manufacturer: 'MTH' });
ok('an MTH part still opens MTH\'s own page', hrefs(h)[0] === MTHP.refLink);
h = R.api.link(TT, null);
ok('a Train Tender part (a dealer, not the maker) is never opened on its own',
   hrefs(h).every(u => !/ttender/.test(u)), hrefs(h).join(' '));
h = R.api.link(Object.assign({}, TIRE, { refLink: '', itemNum: 'ZZZ1' }), null);
ok('a store part with no page → the search, never a dead link', hrefs(h).length === 1 && /google\.com\/search/.test(hrefs(h)[0]));
ok('every link opens in a new tab, safely', (h.match(/target="_blank" rel="noopener"/g) || []).length === hrefs(h).length);

section('The lane: every part, scrollable — no price, no stock, no unpicked dealer link');
R = room({ catalog: SHELF });
h = R.api.lane([GEAR, TIRE], '', 'task-9', ITEM);
ok('no price and no stock anywhere on the lines', !/\$/.test(h) && !/in stock/i.test(h) && !/out of stock/i.test(h));
ok('the maker\'s own page IS linked now (v0.9.1770)', /lionelsupport\.com/.test(h));
ok('…but a dealer\'s is still not, with none picked', !/trainz\.com\/products/.test(h) && !/ttender/.test(h));
ok('each line: description, #number, the source, then its links',
   /Brass Idler Gear \(Repro-Brass\)<\/b> <span[^>]*>#2023-117<\/span>/.test(h)
   && /Lionel Parts · <a href="https:\/\/www\.google\.com\/search\?q=[^"]+"[^>]*>search<\/a>/.test(h));
ok('"+ Want it" is still there, twice', (h.match(/\+ Want it/g) || []).length === 2 && /_maintPopWantCatalog\('lionel_parts','2023-117','','task-9'\)/.test(h));
// v0.9.1770 — Brad asked for the item number back ("also add the item number
// too"). v1760 had removed it; it is a plain word now, not one more quoted term
// Google must match, and the measurements it was piled on top of are gone.
ok('the lane gets the card\'s item, and the item number rides along in the search',
   /_maintCatalogLaneHtml\(rows, q, taskId, item\)/.test(mt) && /2338/.test(decodeURIComponent(h)));
R = room({ catalog: SHELF, favs: ['trainz.com'], select: { value: 'trainz.com' } });
ok('with a store picked every line offers that store', (R.api.lane([GEAR, TIRE], '', 't', ITEM).match(/trainz\.com/g) || []).length >= 2);
// Brad, 2026-09-19: "you can't scroll down the parts". The lane drew 8 of 60.
R = room({ catalog: SHELF });
const MANY = Array.from({ length: 60 }, (_, i) => Object.assign({}, TIRE, { itemNum: 'P' + i, description: 'WIDGET ' + i }));
const laneAll = R.api.lane(MANY, '', 't', ITEM);
ok('every part is drawn, not the first 8', (laneAll.match(/\+ Want it/g) || []).length === 60,
   String((laneAll.match(/\+ Want it/g) || []).length));
ok('…inside a box that scrolls, so the popup keeps its height', /overflow-y:auto/.test(laneAll));
ok('…and the heading says how many there are', /\(60 — scroll, or type to narrow\)/.test(laneAll),
   (laneAll.match(/Catalog parts for this item[^<]*/) || [''])[0]);
ok('typing still narrows', (R.api.lane(MANY, 'widget 42', 't', ITEM).match(/\+ Want it/g) || []).length === 1,
   String((R.api.lane(MANY, 'widget 42', 't', ITEM).match(/\+ Want it/g) || []).length));

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
// v0.9.1770: the anchor itself moved into _partLinkA, because there are two of
// them now. Still exactly ONE place that writes a catalog row's link.
ok('no catalog row link is drawn anywhere but inside the one rule',
   !/_esc\((r\.refLink|f\.link)\) \+ '" target="_blank"/.test(mt)
   && /href="' \+ _esc\(href\) \+ '" target="_blank"/.test(grab('function _partLinkA(href, word)'))
   && (mt.match(/target="_blank" rel="noopener" style="color:var\(--accent2\)"/g) || []).length === 1);

section('config.js: which catalogs are the maker\'s own store');
ok('Lionel\'s store and MTH Parts & Sales are official', /lionelstore_parts: \{[^}]*partsOfficial: true/.test(cfg) && /mth_parts: \{[^}]*partsOfficial: true/.test(cfg));
ok('Trainz and Train Tender are dealers — never official', !/lionel_parts: \{[^}]*partsOfficial/.test(cfg) && !/traintender_parts: \{[^}]*partsOfficial/.test(cfg));

section('The trio moved together');
ok('APP_VERSION v0.9.1782', /const APP_VERSION = 'v0\.9\.1782';/.test(cfg));
ok('CACHE_NAME is the version + 10', /const CACHE_NAME = 'mca-v1792';/.test(sw));
ok('index.html stamps every asset at 1782 and none at 1781', (ix.match(/\?v=1782/g) || []).length === 79 && !/\?v=1781/.test(ix));

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
