#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// A LIONEL POSTWAR SET NUMBER TYPED IN THE ITEM BOX FINDS THE SET — 2026-11-01
// (Node + jsdom, the REAL wizard code)
//
// [stated] Brad 2026-11-01 16:11 CT: "no, he tried to enter a set as an item
// number" — Lars typed 1467W in Add → Cataloged Item and got "No item found in
// our Master Catalog". The 472 Lionel Postwar sets live only in the set list
// (state.setData), which the item box never read. 16:12 / 16:25 CT "yes".
//
// The stand-in set list: 1467W (TWO variants) and 2500WS (one). The catalog:
// a Modern Lionel set that IS a catalog row (6-31705) and a Postwar 2343.
//   L  the list: "1467W" → ONE SET row, tagged LIONEL · POSTWAR + SET, with its
//      name · years · piece count · 2 versions; "1467" finds it while typing;
//      Lionel · Postwar keeps it; 6-31705 stays its catalog row, no SET row;
//      a number that is neither → no SET row
//   N  nothing found: Lionel · Pre-War + "1467W" → the three lines AND "1467W is
//      a Lionel Postwar set — add it as a set?"; a number that is not a set →
//      no set line; a number that IS one, unfiltered, has no need of the line
//   C  the carry: choosing 1467W → the set flow on 1467W, its variant picker
//      (_confirmSetMatch with the number alone); 2500WS → the same door, one
//      variant; inbox photos ride along; a non-set number → the set flow as
//      before, nothing carried; 6-31705 chosen → an ordinary item, no switch
//   W  the set list not in yet → fetched once by the ONE loader and the list
//      asks again — never a blank answer from load order
//   S  scans, each with a planted offender: S1 the set check answers to THE
//      one filter test (a hand-written Era match turns it red); S2 the set
//      loader lives once (a second copy in tools.js turns it red); S3 the
//      words live in config.js and none says "AI"; S4 the carry is
//      _wizSetKind's own (a second carry function turns it red)
// The real-browser road (iPhone size) is set_number_item_box_road_tests.js.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let JSDOM;
try { JSDOM = require('jsdom').JSDOM; }
catch (e) { console.log('FAILED  —  set_number_item_box_tests needs jsdom (npm install --no-save jsdom).'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function ok(n, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (extra || ''))); cond ? pass++ : fail++; }
function read(f) { return fs.readFileSync(path.join(APP, f), 'utf8'); }
function grab(src, head) {
  const i = src.indexOf(head);
  if (i < 0) throw new Error('missing ' + head);
  let d = 0;
  const j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); }
  }
  throw new Error('unbalanced ' + head);
}
function plant(src, from, to, label) {
  if (src.indexOf(from) < 0) throw new Error('planted offender "' + label + '" no longer matches the source — update the test');
  return src.replace(from, to);
}

const WIZ = read('wizard.js'), SUG = read('wizard-suggestions.js'), CFG = read('config.js');
const APPJS = read('app.js'), BROWSE = read('browse.js'), TYPES = read('type-groups.js'), DATA = read('app-data.js'), TOOLS = read('tools.js');

// ── the stand-ins ──
const SETS = [
  { setNum: '1467W', setName: 'Erie Freight', year: '1952', gauge: 'O27', items: ['2032', '2032C', '6656', '6456', '6457'], alts: [] },
  { setNum: '1467W', setName: 'Erie Freight', year: '1953', gauge: 'O27', items: ['2032', '2032C', '6656', '6456', '6456', '6457'], alts: [] },
  { setNum: '2500WS', setName: 'Freight', year: '1952', gauge: 'O', items: ['671', '2046W', '2461', '6456', '6457'], alts: [] },
];
const ROWS = [
  { itemNum: '6-31705', itemType: 'Set', description: 'Hudson Freight Set', roadName: 'New York Central', yearProd: '1999', _era: 'mpc', _tab: 'Lionel MPC-Modern', rowId: 'MPC31705' },
  { itemNum: '2343', itemType: 'Diesel Locomotive', description: 'Santa Fe F3', roadName: 'Santa Fe', yearProd: '1950', _era: 'pw', _tab: 'Lionel PW - Items', rowId: 'PW2343' },
  { itemNum: '1467', itemType: 'Accessory', description: 'Prewar-ish accessory', roadName: '', yearProd: '1938', _era: 'prewar', _tab: 'Lionel Pre-War', rowId: 'PRE1467' },
];

// ── the REAL pieces, in one jsdom window ──
function buildWorld(sugSrc, wizSrc, dataSrc) {
  const dom = new JSDOM('<!doctype html><html><body><input id="wiz-input"><div id="wiz-match"></div><div id="wiz-suggestions"></div></body></html>', { runScripts: 'outside-only', url: 'https://therailroster.com/app/' });
  const win = dom.window;
  win.console = { log() {}, warn() {}, error() {} };
  const brandVar = APPJS.slice(APPJS.indexOf('var _BRAND_LABELS'), APPJS.indexOf('\n', APPJS.indexOf('var _BRAND_LABELS')));
  const eraMap = BROWSE.slice(BROWSE.indexOf('var _ERA_KEY_TO_PERIOD'), BROWSE.indexOf('\n};', BROWSE.indexOf('var _ERA_KEY_TO_PERIOD')) + 3);
  const code = [
    CFG, TYPES,
    brandVar, eraMap,
    grab(APPJS, 'function _manufacturerOfEra('), grab(APPJS, 'function _manufacturerOfItem('), grab(APPJS, 'function _itemEraKey('),
    grab(APPJS, 'function _brandLabel('), grab(APPJS, 'function rrAlsoSoldAsNames('), grab(APPJS, 'function _rrMakerWord('), grab(APPJS, 'function rrRowAlsoSoldBy('),
    grab(APPJS, 'function normalizeItemNum('), grab(APPJS, 'function baseItemNum('),
    grab(BROWSE, 'function _itemEraPeriod('),
    grab(WIZ, 'function _wizPeriodOfYear('), grab(WIZ, 'function _wizPeriodOfRow('), grab(WIZ, 'function _wizScaleOfRow('),
    grab(WIZ, 'function _wizMasterPrefer('), grab(WIZ, 'function _wizAddFilters('), grab(WIZ, 'function _wizAnyAddFilter('),
    grab(WIZ, 'function _wizRowFitsFilters('), grab(WIZ, 'function _wizPickMasterRow('),
    grab(WIZ, 'function _wizCurrentKind('), grab(WIZ, 'function _wizSetKind('), grab(WIZ, 'function _wizOpenSetOn('),
    'var _rrPwSetsPromise = null, _rrPwSetsTried = false;', grab(dataSrc, 'function rrEnsurePostwarSets('), grab(DATA, 'function parseSetRows('),
    'var state = { masterData: [], setData: [], personalData: {} }; var wizard = { data: {}, matchedItem: null, tab: "collection", steps: [], step: 0 }; var _currentEra = "all";',
    // the wizard's own world, stubbed: what the flow DID is recorded
    'var LOG = []; function getSteps(t) { return t === "set" ? [{ id: "set_knowsNum" }, { id: "set_num" }, { id: "set_components", type: "setComponents" }, { id: "set_entryMode" }] : [{ id: "itemNumGrouping", type: "itemNumGrouping" }]; }',
    'function renderWizardStep() { LOG.push("render:" + wizard.tab + ":" + ((wizard.steps[wizard.step] || {}).id || "")); if (wizard.tab === "set" && (wizard.steps[wizard.step] || {}).id === "set_components") window._confirmSetMatch = function (n, vi) { LOG.push("confirm:" + n + (vi === undefined ? "" : ":" + vi) + ":" + state.setData.filter(function (s) { return s.setNum === n; }).length); }; }',
    'function wizardChooseCategory(k) { LOG.push("choose:" + k); if (k !== "manual" && k !== "lionel") { wizard.tab = k; wizard.steps = getSteps(k); wizard.step = 0; renderWizardStep(); } return Promise.resolve(); }',
    'function wizardNext() { LOG.push("next"); } function _updateGroupingButtons() {} function _wizOwnedRefresh() {} function _catalogReady() { return true; }',
    'var SHEET_CALLS = 0; var state_masterSheetId = "M"; function sheetsGet() { SHEET_CALLS++; return Promise.resolve({ values: [] }); }',
    sugSrc,
    'this.__set = function (o) { state.masterData = o.rows || []; state.setData = o.sets || []; wizard = { data: o.data || {}, matchedItem: null, tab: o.tab || "collection", steps: getSteps(o.tab || "collection"), step: 0 }; LOG.length = 0; };',
    'this.__wiz = function () { return wizard; }; this.__log = function () { return LOG.slice(); }; this.__state = function () { return state; }; this.__calls = function () { return SHEET_CALLS; };',
  ].join('\n;\n');
  win.eval(code);
  return win;
}

let W;
try { W = buildWorld(SUG, WIZ, DATA); }
catch (e) { ok('the harness loads the real code', false, e.stack); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(1); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const WORDS = W.RR_ADD_FILTERS;

function list(win, q, o) {
  win.__set(Object.assign({ rows: ROWS.map(r => Object.assign({}, r)), sets: SETS.map(s => JSON.parse(JSON.stringify(s))) }, o || {}));
  win.document.getElementById('wiz-input').value = q;
  win.updateItemSuggestions(q);
  const el = win.document.getElementById('wiz-suggestions');
  const rows = Array.from(el.querySelectorAll('[data-idx]'));
  const setRows = rows.filter(r => r.querySelector('[data-set-tag]'));
  const nf = el.querySelector('[data-nothing-found]');
  return { el, rows, setRows, nf,
    nums: rows.map(r => (r.querySelector('span') || {}).textContent),
    setLine: nf && nf.querySelector('[data-nf-line="set"]') };
}
const tagsOf = (r) => Array.from(r.querySelectorAll('[data-row-tag]')).map(t => t.textContent);

(async function main() {
  // ── L — the list ──
  let L = list(W, '1467W');
  ok('L1 "1467W" in Cataloged Item → ONE SET row (two variants, one row)', L.setRows.length === 1 && L.nums.filter(n => n === '1467W').length === 1, L.nums.join(','));
  const r1 = L.setRows[0] || { querySelector() { return null; }, querySelectorAll() { return []; }, textContent: '' };
  ok('L2 the row carries the maker · era tag LIONEL · POSTWAR', tagsOf(r1).join('|') === 'LIONEL · POSTWAR', tagsOf(r1).join('|'));
  ok('L3 … and the SET tag, from the word list', ((r1.querySelector('[data-set-tag]') || {}).textContent) === WORDS.setTag && WORDS.setTag === 'SET');
  const det = ((r1.querySelector('.wiz-sug-details') || {}).textContent) || '';
  ok('L4 its name · years · piece count · versions', det === 'Erie Freight · 1952, 1953 · 5–6 pieces · 2 versions', det);
  ok('L5 no "Use 1467W as typed" row — the set IS the number', !L.el.querySelector('[data-typed-num]'));
  L = list(W, '2500WS');
  const det2 = ((L.setRows[0] && L.setRows[0].querySelector('.wiz-sug-details')) || {}).textContent || '';
  ok('L6 "2500WS" → its SET row: Freight · 1952 · 5 pieces', L.setRows.length === 1 && det2 === 'Freight · 1952 · 5 pieces', det2);
  L = list(W, '1467');
  ok('L7 "1467" while typing → the 1467W set row shows beside the catalog\'s 1467', L.setRows.length === 1 && L.nums.indexOf('1467') >= 0, L.nums.join(','));
  L = list(W, '1467W', { data: { _searchFilterManufacturer: 'Lionel', _searchFilterPeriod: 'postwar' } });
  ok('L8 filters Lionel · Postwar keep the set row (a Postwar set IS Lionel · Postwar)', L.setRows.length === 1);
  L = list(W, '1467W', { data: { _searchFilterType: 'Set' } });
  ok('L9 Type "Set" keeps it', L.setRows.length === 1);
  L = list(W, '1467W', { data: { _searchFilterType: 'Steam' } });
  ok('L10 Type "Steam" hides it (the one filter test decides)', L.setRows.length === 0);
  L = list(W, '31705');
  ok('L11 a Modern Lionel set (6-31705, a catalog row) is found as its one catalog row — no SET row', L.nums.join(',') === '6-31705' && L.setRows.length === 0, L.nums.join(','));
  L = list(W, '2343');
  ok('L12 a number that is no set → no SET row', L.setRows.length === 0 && L.nums.indexOf('2343') >= 0);
  L = list(W, '1467W', { tab: 'sold' });
  ok('L13 the Sold picker (your own copies) never lists sets', L.setRows.length === 0);
  L = list(W, '1467W', { data: { boxOnly: true } });
  ok('L14 a box-only add never lists sets', L.setRows.length === 0);
  L = list(W, '1467W', { data: { _fromInbox: true } });
  ok('L15 an add from the Photo Inbox does list the set', L.setRows.length === 1);
  L = list(W, 'erie freight');
  ok('L16 a search in words is unchanged (sets join number searches only)', L.setRows.length === 0);
  L = list(W, '1467W');
  ok('L17 the exact set row is highlighted like any exact number', /2ecc71|46, ?204, ?113/.test(L.setRows[0].getAttribute('style') || ''));

  // ── N — nothing found ──
  L = list(W, '1467W', { data: { _searchFilterManufacturer: 'Lionel', _searchFilterPeriod: 'prewar' } });
  ok('N1 Lionel · Pre-War + "1467W" → nothing found (no row)', !!L.nf && L.rows.length === 0);
  const ask = WORDS.setAsk.replace('{num}', '1467W');
  ok('N2 … plus "1467W is a Lionel Postwar set — add it as a set?"', !!L.setLine && L.setLine.textContent.indexOf(ask) === 0 && ask === '1467W is a Lionel Postwar set — add it as a set?', L.setLine && L.setLine.textContent);
  const btn = L.setLine && L.setLine.querySelector('[data-nf-btn="set"]');
  ok('N3 … with its button, words from the list', !!btn && btn.textContent === WORDS.setBtn && btn.getAttribute('data-set-num') === '1467W');
  ok('N4 the three lines are still all there', !!(L.nf.querySelector('[data-nf-line="none"]') && L.nf.querySelector('[data-nf-line="clear"]') && L.nf.querySelector('[data-nf-line="manual"]')));
  L = list(W, '9999X', { data: { _searchFilterManufacturer: 'Lionel', _searchFilterPeriod: 'prewar' } });
  ok('N5 a number that is neither → nothing found, NO set line', !!L.nf && !L.setLine);
  L = list(W, '146', { data: { _searchFilterManufacturer: 'Atlas' } });
  ok('N5b only the WHOLE set number earns the line: "146" (start of 1467W) under Atlas → no set line', !!L.nf && !L.setLine);
  const Wn = buildWorld(plant(SUG, '_wizPostwarSetHits(num, null, { exact: true, anyFilter: true })', '_wizPostwarSetHits(num, null, { anyFilter: true })', 'prefix set line'), WIZ, DATA);
  const Ln = list(Wn, '146', { data: { _searchFilterManufacturer: 'Atlas' } });
  ok('N5b PLANTED: the set line asked by the start of a number → a non-set gets the line (caught)', !!Ln.setLine);
  L = list(W, '1467w', { data: { _searchFilterManufacturer: 'Lionel', _searchFilterPeriod: 'prewar' } });
  ok('N6 typed in small letters → the set line names the set as the catalog writes it', !!L.setLine && L.setLine.textContent.indexOf('1467W is a') === 0);
  // the button opens the set flow (same carry)
  W.eval('_wizPickSetRow')('1467W');
  await sleep(20);
  ok('N7 the button → the set flow on 1467W', W.__wiz().tab === 'set' && W.__log().some(x => x === 'confirm:1467W:2'), W.__log().join(' '));

  // ── C — the carry ──
  L = list(W, '1467W', { data: { _addPhotoDriveId: 'PHOTO1', _fromInbox: true } });
  L.setRows[0].click();
  await sleep(20);
  let wz = W.__wiz(), log = W.__log();
  ok('C1 choosing the 1467W row → the set flow (Lionel Postwar Set)', wz.tab === 'set' && log.indexOf('choose:set') >= 0, log.join(' '));
  ok('C2 … opened ON 1467W: set number known, on "Identify your set"', wz.data.set_knowsNum === 'Yes' && wz.data.set_num === '1467W' && (wz.steps[wz.step] || {}).id === 'set_components');
  ok('C3 … its variant picker: _confirmSetMatch with the number alone, two variants', log.indexOf('confirm:1467W:2') >= 0, log.join(' '));
  ok('C4 the inbox photo rode along', wz.data._addPhotoDriveId === 'PHOTO1' && wz.data._fromInbox === true);
  L = list(W, '2500WS');
  L.setRows[0].click();
  await sleep(20);
  log = W.__log();
  ok('C5 "2500WS" → the same door, one variant (straight to that set)', W.__wiz().tab === 'set' && log.indexOf('confirm:2500WS:1') >= 0, log.join(' '));
  // the Item Type drop-down with a number that is NOT a set: as before
  W.__set({ rows: ROWS, sets: SETS, data: { itemNum: '2343' } });
  W.eval('_wizSetKind')('set');
  await sleep(20);
  wz = W.__wiz(); log = W.__log();
  ok('C6 Item Type → Lionel Postwar Set with a non-set number: the set flow from its start, nothing carried', wz.tab === 'set' && wz.step === 0 && !wz.data.set_num && !log.some(x => /^confirm:/.test(x)), log.join(' '));
  // typed with a maker word
  W.__set({ rows: ROWS, sets: SETS, data: { itemNum: 'lionel 1467w' } });
  W.eval('_wizSetKind')('set');
  await sleep(20);
  ok('C7 "lionel 1467w" typed → the set number is found and carried', W.__wiz().data.set_num === '1467W' && W.__log().indexOf('confirm:1467W:2') >= 0, W.__log().join(' '));
  // a Modern set row tapped → an ordinary item
  L = list(W, '31705');
  L.rows[0].click();
  await sleep(150);
  wz = W.__wiz();
  ok('C8 6-31705 chosen → an ordinary one-item add goes on (Next): no switch to the set flow', wz.tab === 'collection' && wz.data.itemNum === '6-31705' && W.__log().indexOf('next') >= 0 && !W.__log().some(x => x === 'choose:set' || /^confirm:/.test(x)), W.__log().join(' '));
  // Cataloged ↔ Manual carry still works (v0.9.2092)
  W.__set({ rows: ROWS, sets: SETS, data: { itemNum: '1511', _searchFilterManufacturer: 'Lionel' } });
  W.eval('_wizSetKind')('manual');
  ok('C9 the v0.9.2092 Manual carry is unchanged (number + maker)', W.__wiz().data.manualItemNum === '1511' && W.__wiz().data.manualManufacturer === 'Lionel');

  // ── W — the set list not in yet ──
  const W2 = buildWorld(SUG, WIZ, DATA);
  W2.__set({ rows: ROWS, sets: [] });
  W2.eval('state').masterSheetId = 'M';
  W2.localStorage.setItem('lv_set_cache_pw', JSON.stringify(SETS));
  W2.document.getElementById('wiz-input').value = '1467W';
  W2.updateItemSuggestions('1467W');
  await sleep(50);
  const el2 = W2.document.getElementById('wiz-suggestions');
  ok('W1 set list empty → fetched (the saved Postwar copy) and the list asks again: the SET row shows', !!el2.querySelector('[data-set-tag]'), el2.textContent.slice(0, 120));
  const W3 = buildWorld(SUG, WIZ, DATA);
  W3.__set({ rows: ROWS, sets: [] });
  W3.eval('state').masterSheetId = 'M';
  W3.document.getElementById('wiz-input').value = '1467W';
  W3.updateItemSuggestions('1467W'); await sleep(30);
  W3.updateItemSuggestions('1467W'); await sleep(30);
  W3.updateItemSuggestions('1467W'); await sleep(30);
  ok('W2 no saved copy → the master\'s Sets tab is read ONCE, not on every keystroke', W3.__calls() === 1, W3.__calls());

  // ── S — the scans ──
  // S1: the set check answers to THE one filter test — no hand-written match
  function s1(sug) {
    const fn = grab(sug, 'function _wizPostwarSetHits(');
    const usesOne = /_wizRowFitsFilters\(row, fset\)/.test(fn);
    const handMade = /_searchFilter|\.period|\.mfr|\.scale|\.type\b|_wizPeriodOfRow|_itemEraPeriod|_manufacturerOf|ERA_SCALE|getTypeBucketLabel|'postwar'|"postwar"/.test(fn);
    const listFn = grab(sug, 'function updateItemSuggestions(');
    const listBlock = listFn.slice(listFn.indexOf('if (startsWithDigit && _wizSetCheckOn())'), listFn.indexOf('// Post-filter: drop "bare"'));
    const listHand = /_filterPeriod|_effPeriod|_filterMfr|_effMfr|_filterType|_filterScale|'postwar'/.test(listBlock) || !/_wizPostwarSetHits\(numPart, _fset\)/.test(listBlock);
    return usesOne && !handMade && !listHand;
  }
  ok('S1 the item box\'s set check goes through THE one filter test, and nothing else', s1(SUG));
  ok('S1 PLANTED: a hand-written Era match in the set check → caught', !s1(plant(SUG, "    var row = rrSetAsRow(s);\n", "    var row = rrSetAsRow(s);\n    if (fset && fset.period && fset.period !== 'postwar') return;\n", 'hand era')));
  ok('S1 PLANTED: the list matching sets on its own Era → caught', !s1(plant(SUG, '    if (startsWithDigit && _wizSetCheckOn()) {', "    if (startsWithDigit && _wizSetCheckOn() && (!_effPeriod || _effPeriod === 'postwar')) {", 'list era')));
  // the planted offender changes behaviour too: a hand-made match that forgets the Type filter lists the set under Steam
  const Wp = buildWorld(plant(SUG, "    if (!opts.anyFilter && typeof _wizRowFitsFilters === 'function' && !_wizRowFitsFilters(row, fset)) return;",
    "    if (!opts.anyFilter && fset && fset.period && fset.period !== 'postwar') return;", 'own match'), WIZ, DATA);
  const Lp = list(Wp, '1467W', { data: { _searchFilterType: 'Steam' } });
  ok('S1 PLANTED (run): its own Era-only match lists the set under Type "Steam" — L10 would go red', Lp.setRows.length === 1);
  // S2: one set loader
  function s2(files) {
    const hits = Object.keys(files).filter(f => /lv_set_cache_pw/.test(files[f]) || (/sheetsGet\([^)]*sets[^)]*A2:U/i.test(files[f]) && f !== 'app-data.js'));
    return hits.length === 1 && hits[0] === 'app-data.js' && /rrEnsurePostwarSets\(/.test(files['tools.js']) && /rrEnsurePostwarSets\(\)/.test(files['wizard-suggestions.js']);
  }
  const LOADFILES = { 'app-data.js': DATA, 'tools.js': TOOLS, 'wizard-suggestions.js': SUG, 'wizard.js': WIZ };
  ok('S2 the Postwar set list has ONE fetch-when-missing (rrEnsurePostwarSets) — Set Builder and item box both ask it', s2(LOADFILES));
  ok('S2 PLANTED: the Set Builder\'s old private copy put back → caught', !s2(Object.assign({}, LOADFILES, { 'tools.js': plant(TOOLS, "    try { if (typeof rrEnsurePostwarSets === 'function') await rrEnsurePostwarSets(true); } catch (e) {}",
    "    try { var _c = localStorage.getItem('lv_set_cache_pw'); if (_c) state.setData = JSON.parse(_c); } catch (e) {}", 'tools copy') })));
  // S3: the words
  const keys = ['setTag', 'setPieces', 'setPieceOne', 'setVersions', 'setAsk', 'setBtn'];
  ok('S3 every new word is in config.js\'s one word list (RR_ADD_FILTERS)', keys.every(k => typeof WORDS[k] === 'string' && WORDS[k]));
  function s3(texts) { return texts.every(t => !/is a Lionel Postwar set|Add as a set|\d+ versions'|' pieces'/.test(t.replace(/\/\/[^\n]*/g, ''))); }
  ok('S3 no Add file types those words itself', s3([WIZ, SUG]));
  ok('S3 PLANTED: the set line typed into wizard-suggestions.js → caught', !s3([plant(SUG, 'function _wizSetRowDetails(g) {', "function _wizSetRowDetails(g) {\n  var _x = ' is a Lionel Postwar set';", 'typed words')]));
  const noAI = (o) => JSON.stringify(o).split(/[^A-Za-z]+/).indexOf('AI') < 0;
  ok('S3 no word "AI" in the words', noAI(keys.map(k => WORDS[k])));
  ok('S3 PLANTED: an "AI" word → caught', !noAI(keys.map(k => WORDS[k]).concat(['AI match'])));
  // S4: the carry is _wizSetKind's own — one carry, never a second copy
  function s4(wiz, sug) {
    const pick = grab(sug, 'function _wizPickSetRow(');
    const kind = grab(wiz, 'function _wizSetKind(kind)');
    return /_wizSetKind\('set'\)/.test(pick) && !/RR_INBOX_CARRY_KEYS|_addPhotoDriveId|wizardChooseCategory|_confirmSetMatch/.test(pick)
      && /RR_INBOX_CARRY_KEYS/.test(kind) && /_carrySet/.test(kind) && /rrPostwarSetVariants\(/.test(kind);
  }
  ok('S4 the set row and the set line go through _wizSetKind\'s one carry', s4(WIZ, SUG));
  ok('S4 PLANTED: a second carry built in the item box → caught', !s4(WIZ, plant(SUG, "  _wizSetKind('set');\n}", "  wizardChooseCategory('set'); window._confirmSetMatch(setNum);\n}", 'second carry')));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + e.stack); process.exit(1); });
