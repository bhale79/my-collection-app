// ══ tests/short_number_search_tests.js — a ONE-digit item number is a number ══
//
// v0.9.1895. Brad: "add item issue. want to add a 4 trolley. it doesn't show
// up. it only finds the 004 loco". The Add Item search treated anything with
// fewer than two digits as WORDS, so "4" matched descriptions holding a 4
// ("Electric Locomotive 0-4-0", "4-6-4 Locomotive") and the No. 4 Trolley —
// "Trolley (std)", no 4 in its words — never appeared. The same family of
// slip was in two more boxes:
//   * Research an Item: the word search threw every one-character word away,
//     so "4 trolley" searched "trolley" alone (200+ trolleys, first 40 kept);
//     the live suggestions waited for two characters, so "4" showed nothing.
//   * Photo Inbox → attach to an owned item: the search waited for two
//     characters, so "4" could not find your No. 4.
//
// The rows are REAL Pre-War rows (Lionel Pre-War tab, 2026-10-08) in
// tests/fixtures/short-number-rows.json. Every check runs the app's OWN code
// (the function lifted out of its file), and every check is run a second time
// on a PLANTED copy with the old line put back — it must fail there, or it is
// not a check.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const APP = path.join(__dirname, '..', 'app');
const ROWS = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'short-number-rows.json'), 'utf8'))
  .map(r => Object.assign({ _era: 'prewar', _tab: 'Lionel Pre-War' }, r));

let pass = 0, fail = 0;
function T(name, ok, info) {
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (ok ? '' : '  -> ' + (info || '')));
  ok ? pass++ : fail++;
}
function read(f) { return fs.readFileSync(path.join(APP, f), 'utf8'); }
function plant(src, from, to, label) {
  if (src.indexOf(from) < 0) throw new Error('planted offender "' + label + '" no longer matches the source — update the test');
  return src.replace(from, to);
}

// ── A. Add Item — updateItemSuggestions (wizard-suggestions.js) ──────────
function El() {
  return { style: {}, dataset: {}, children: [], innerHTML: '', setAttribute() {}, addEventListener() {},
    appendChild(c) { this.children.push(c); }, set textContent(v) { this._t = v; }, get textContent() { return this._t; } };
}
function addItemList(src, query) {
  const box = El();
  const ctx = { console, window: {}, document: { getElementById: id => id === 'wiz-suggestions' ? box : null, createElement: () => El() },
    state: { masterData: ROWS.map(r => Object.assign({}, r)), personalData: {} }, setTimeout, clearTimeout };
  vm.createContext(ctx);
  vm.runInContext(read('item-search-filters-config.js'), ctx);
  ctx.ITEM_SEARCH_FILTERS = ctx.window.ITEM_SEARCH_FILTERS;
  vm.runInContext(src + '\n;var wizard = { tab: "collection", data: { _era: "all" } };', ctx);
  ctx.updateItemSuggestions(query);
  // each drawn row: line 1 = [number, type chip, ...]; read the number + type
  return box.children.slice(1).map(row => {
    const line1 = row.children[0] || { children: [] };
    return { num: (line1.children[0] || {})._t, type: (line1.children[1] || {})._t };
  });
}
function addItemChecks(src) {
  const r = {};
  const l4 = addItemList(src, '4');
  r.four_trolley = l4.slice(0, 5).some(x => x.num === '4' && x.type === 'Trolley');
  r.four_engine = l4.slice(0, 5).some(x => x.num === '4' && /Electric/.test(x.type));
  r.four_first = !!l4.length && l4[0].num === '4';
  const l4t = addItemList(src, '4 trolley');
  r.four_trolley_words = !!l4t.length && l4t[0].num === '4' && l4t[0].type === 'Trolley';
  const l8 = addItemList(src, '8');
  r.eight_trolley = l8.slice(0, 5).some(x => x.num === '8' && x.type === 'Trolley');
  const lw = addItemList(src, '4-6-4 locomotive');
  r.wheel_words = lw.length > 0 && lw.every(x => x.num !== '4');
  return r;
}
const WIZ = read('wizard-suggestions.js');
{
  const r = addItemChecks(WIZ);
  T('A1 Add Item "4": the No. 4 Trolley is listed at the top', r.four_trolley);
  T('A2 Add Item "4": the No. 4 Electric Locomotive is still listed', r.four_engine);
  T('A3 Add Item "4": the first row is a No. 4', r.four_first);
  T('A4 Add Item "4 trolley": first row is the No. 4 Trolley', r.four_trolley_words);
  T('A5 Add Item "8": the No. 8 Trolley is listed at the top', r.eight_trolley);
  T('A6 Add Item "4-6-4 locomotive": a wheel arrangement is WORDS (finds 4-6-4 engines)', r.wheel_words);
  // unchanged behaviour
  const l238 = addItemList(WIZ, '238');
  T('A7 Add Item "238" unchanged: 238 then 238E', l238.length === 2 && l238[0].num === '238' && l238[1].num === '238E', JSON.stringify(l238));
  const lt = addItemList(WIZ, 'trolley');
  T('A8 Add Item "trolley" (words) still lists trolleys', lt.length > 10 && lt.every(x => x.type === 'Trolley'));
  // planted: the old two-digit rule
  const old = plant(WIZ, "const startsWithDigit = !_rrIsWheelArrangement(_searchNum)\n      && (/^\\d/.test(_searchNum) || /\\d{2,}/.test(_searchNum) || /\\d-\\d/.test(_searchNum));",
    'const startsWithDigit = /\\d{2,}/.test(_searchNum) || /\\d-\\d/.test(_searchNum);', 'old two-digit rule');
  const p = addItemChecks(old);
  T('A9 PLANTED old rule: the No. 4 Trolley goes missing (A1 can fail)', !p.four_trolley);
  T('A10 PLANTED old rule: "4 trolley" finds nothing (A4 can fail)', !p.four_trolley_words);
  T('A11 PLANTED old rule: "4-6-4 locomotive" finds nothing (A6 can fail)', !p.wheel_words);
}

// ── B. Research an Item — _masterTextSearchAllEras (barcode.js) ──────────
const BC = read('barcode.js');
function lift(src, start, end) {
  const i = src.indexOf(start), j = src.indexOf(end, i);
  if (i < 0 || j < 0) throw new Error('could not lift ' + start);
  return src.slice(i, j);
}
async function textSearch(src, rows, q, limit) {
  const fn = lift(src, 'async function _masterTextSearchAllEras(', 'window._masterTextSearchAllEras =');
  const ctx = { state: { masterAllRows: rows.map(r => Object.assign({}, r)) } };
  vm.createContext(ctx);
  vm.runInContext(fn + '\n;this.__ts = _masterTextSearchAllEras;', ctx);
  return ctx.__ts(q, limit);
}
// 60 other trolleys load BEFORE the Pre-War tab — the order that buried the No. 4.
const OTHER_TROLLEYS = Array.from({ length: 60 }, (_, i) => ({ itemNum: '30-' + (2100 + i), itemType: 'Trolley', description: 'Birney Trolley', roadName: '', _era: 'mth', _tab: 'MTH O' }));
async function researchChecks(src) {
  const r = {};
  const hits = await textSearch(src, OTHER_TROLLEYS.concat(ROWS), '4 trolley', 40);
  r.first = hits.length ? hits[0].itemNum : '(none)';
  r.four_first = r.first === '4';
  const one = await textSearch(src, ROWS, 'a trolley', 40);
  r.letter_dropped = one.length > 0;   // a one-LETTER word is still ignored
  const words = await textSearch(src, OTHER_TROLLEYS.concat(ROWS), 'trolley', 40);
  r.words_capped = words.length === 40;
  return r;
}

// ── C. Research's live suggestions wait for… (barcode.js _biQuickSuggest) ──
function quickAllowsOneDigit(src) {
  const body = lift(src, 'function _biQuickSuggest(dd) {', 'var o = {');
  const m = body.match(/if \(([^)]*q\.length < 2[^)]*\)?)\)\s*\{\s*box\.innerHTML = ''; return; \}/);
  if (!m) return false;
  const guard = new Function('q', 'return (' + m[1] + ');');
  return guard('4') === false && guard('a') === true && guard('') === true;
}

// ── D. Photo Inbox → attach to an owned item — _pinAttachSearch ──────────
function attachSearch(src, q) {
  const fn = lift(src, 'window._pinAttachSearch = function (q) {', 'window._pinAttachOwnedGo =');
  let shown = null;
  const pd = {
    a: { owned: true, itemNum: '1666', description: '2-6-2 Steam Locomotive, 4 wheel tender' },
    b: { owned: true, itemNum: '4', description: 'Trolley (std)' },
    c: { owned: true, itemNum: '2', description: 'Trolley, 4 window' },
    d: { owned: true, itemNum: '6464-1', description: 'Western Pacific Boxcar' },
  };
  const ctx = { window: { state: { personalData: pd } }, document: { getElementById: () => ({}) },
    _pinAttachDefault: () => { shown = 'default'; },
    _pinAttachRows: (el, label, hits) => { shown = hits.map(h => h.pd.itemNum); } };
  vm.createContext(ctx);
  vm.runInContext(fn.replace(/;\s*$/, '') + ';\n window._pinAttachSearch(' + JSON.stringify(q) + ');', ctx);
  return shown;
}
function attachChecks(src) {
  const s = attachSearch(src, '4');
  return { searched: Array.isArray(s), first: Array.isArray(s) ? s[0] : s };
}

(async function () {
  const PI = read('photo-inbox.js');
  {
    const r = await researchChecks(BC);
    T('B1 Research "4 trolley": the No. 4 Trolley comes FIRST, though 60 trolleys load before it', r.four_first, 'first = ' + r.first);
    T('B2 Research: a one-LETTER word is still ignored ("a trolley" = "trolley")', r.letter_dropped);
    T('B3 Research words-only search still stops at its limit', r.words_capped);
    const old = plant(BC, "filter(function (t) { return t.length >= 2 || /^\\d$/.test(t); });",
      'filter(function (t) { return t.length >= 2; });', 'old two-character word rule');
    const p = await researchChecks(old);
    T('B4 PLANTED old word rule: the No. 4 is not first (B1 can fail)', !p.four_first, 'first = ' + p.first);
  }
  {
    T('C1 Research live suggestions run for a one-digit number ("4"), not for one letter', quickAllowsOneDigit(BC));
    const old = plant(BC, "if (q.length < 2 && !/^\\d$/.test(q)) { box.innerHTML = ''; return; }",
      "if (q.length < 2) { box.innerHTML = ''; return; }", 'old two-character suggestion guard');
    T('C2 PLANTED old guard: C1 fails', !quickAllowsOneDigit(old));
  }
  {
    const r = attachChecks(PI);
    T('D1 Photo Inbox attach "4": searches, and your No. 4 is first', r.searched && r.first === '4', JSON.stringify(r));
    T('D2 Photo Inbox attach: one LETTER still shows the default list', attachSearch(PI, 'a') === 'default');
    const old1 = plant(PI, "if (q.length < 2 && !/^\\d$/.test(q)) { _pinAttachDefault(el); return; }",
      'if (q.length < 2) { _pinAttachDefault(el); return; }', 'old attach guard');
    T('D3 PLANTED old attach guard: "4" never searches (D1 can fail)', !attachChecks(old1).searched);
    const old2 = plant(PI, "return (_isExact(a) - _isExact(b)) || ", 'return ', 'exact-first sort');
    T('D4 PLANTED no exact-first sort: the No. 4 is not first (D1 can fail)', attachChecks(old2).first !== '4', JSON.stringify(attachChecks(old2)));
  }
  console.log('\nshort_number_search_tests: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
