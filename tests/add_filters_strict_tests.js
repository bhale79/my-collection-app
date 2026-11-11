#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THE ADD SCREEN'S FILTERS REALLY FILTER — 2026-11-01   (Node, the REAL app code)
//
// [stated] Brad 2026-11-01 05:30 CT: "i want the filters to actually filter. if
// there is no 1511 for lionel postwar, nothing shows up". 05:35 CT: "add
// manufacturer - era to the line selection so we can see if the era or
// manufactuer matches what we think we are picking....but this needs to be
// small". 05:39 / 05:41 CT: the three "nothing found" lines.
//
// What he saw (v0.9.2089): Add → Lionel · Postwar · 1511 → step 1 said the
// Lionel PRE-WAR 1511, step 2 said American Models' 1511 — three escapes in the
// "Found" lookup, then a second lookup on step 2.
//
//   F  THE one filter test (_wizRowFitsFilters) answers Manufacturer, Era, Type,
//      Scale (blank = any) — run for real on Brad's 1511 rows; the one picker
//      (_wizResolveAddRow) and the scorer (_wizPickMasterRow) never answer
//      outside it (Lionel + Postwar + 1511 → nothing)
//   T  the maker · era tag (rrRowTagWords) from the REAL config's makers and
//      periods: Era All · 1511 → LIONEL · PREWAR / AMERICAN MODELS · S /
//      S-HELPER SERVICE · S; ATLAS · O 3-RAIL; A.C. GILBERT · POSTWAR
//   M  a maker whose catalogs sit in one period sets the Era filter to it
//      (_wizMakerOnlyPeriod): Atlas → Modern, A.C. Gilbert → Postwar, Lionel
//      and Marx span periods → left alone
//   S  scans of the source, each proven able to fail on a planted offender:
//      S1 no step after the number step looks the number up again
//         ("matchedItem || findMaster(")
//      S2 every catalog read in the Add screen's number lookups goes through
//         the one filter test
//      S3 no "ignore the filter rather than fail" escape comes back
//      S4 the suggestion list keeps no copy of the filter test
//      S5 the tag is drawn only by rrRowTagHtml, in the list, the banner and
//         the step 2 card — never a second chip
//      S6 the collector's words live only in config.js (RR_ADD_FILTERS), and
//         none says "AI"
// The browser half (the real screen, phone + laptop) is add_filters_road_tests.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), vm = require('vm');
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
const APPJS = read('app.js'), BROWSE = read('browse.js'), STEPS = read('wizard-steps.js'), HAND = read('wizard-handlers.js');

// ── the REAL pieces, in one sandbox: config (ERAS, ERA_SCALE, the words), the
// maker / period deciders, the filter test, the picker, the tag ──────────────
const ctx = { console: { log() {}, warn() {}, error() {} }, navigator: { userAgent: 'node', platform: 'node', maxTouchPoints: 0 },
  location: { href: 'https://therailroster.com/app/', hostname: 'therailroster.com', search: '' }, setTimeout, clearTimeout };
ctx.window = ctx; ctx.self = ctx; ctx.addEventListener = ctx.removeEventListener = function () {};
vm.createContext(ctx);
let loaded = true;
try {
  vm.runInContext(CFG, ctx, { filename: 'config.js' });
  const brandVar = APPJS.slice(APPJS.indexOf('var _BRAND_LABELS'), APPJS.indexOf('\n', APPJS.indexOf('var _BRAND_LABELS')));
  const eraMap = BROWSE.slice(BROWSE.indexOf('var _ERA_KEY_TO_PERIOD'), BROWSE.indexOf('\n};', BROWSE.indexOf('var _ERA_KEY_TO_PERIOD')) + 3);
  vm.runInContext([
    brandVar, eraMap,
    grab(APPJS, 'function _manufacturerOfEra('), grab(APPJS, 'function _manufacturerOfItem('), grab(APPJS, 'function _itemEraKey('),
    grab(APPJS, 'function _brandLabel('), grab(APPJS, 'function rrAlsoSoldAsNames('), grab(APPJS, 'function _rrMakerWord('), grab(APPJS, 'function rrRowAlsoSoldBy('),
    require('./lib/num-rule').numRuleSource(),   // numspell: the ONE prefix rule
    grab(APPJS, 'function normalizeItemNum('), grab(APPJS, 'function baseItemNum('),
    grab(BROWSE, 'function _itemEraPeriod('),
    grab(WIZ, 'function _wizPeriodOfYear('), grab(WIZ, 'function _wizPeriodOfRow('), grab(WIZ, 'function _wizScaleOfRow('),
    grab(WIZ, 'function _wizMasterPrefer('), grab(WIZ, 'function _wizAddFilters('), grab(WIZ, 'function _wizAnyAddFilter('),
    grab(WIZ, 'function _wizRowFitsFilters('), grab(WIZ, 'function _wizSameNum('), grab(WIZ, 'function _wizPickMasterRow('), grab(WIZ, 'function _wizMakerOnlyPeriod('),
    grab(SUG, 'function rrNumLinePrefixOff('), grab(SUG, 'function rrNumSameAsTyped('), grab(SUG, 'function _rrIsWheelArrangement('), grab(SUG, 'function _extractSearchItemNum('),
    grab(SUG, 'function rrRowRailWord('), grab(SUG, 'function rrRowMakerWord('), grab(SUG, 'function rrRowTagWords('),
    grab(SUG, 'function _wizResolveAddRow('),
    'var state = { masterData: [] }; var wizard = { data: {}, matchedItem: null, tab: "collection" }; var _currentEra = "all";',
    'this.__set = function (rows, data, held) { state.masterData = rows; wizard.data = data || {}; wizard.matchedItem = held || null; };',
  ].join('\n'), ctx, { filename: 'add-filters-harness.js' });
} catch (e) { loaded = false; ok('harness loads the real code', false, e.message); }
if (!loaded) { console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(1); }

// Brad's 1511 rows (the catalog has NO Lionel Postwar 1511)
const ROWS = [
  { itemNum: '1511', itemType: 'Steam Locomotive', description: '0-4-0 Locomotive (O)', yearProd: '1936-1937', _era: 'prewar', _tab: 'Lionel Pre-War', gauge: 'O', rowId: 'PRE1511A' },
  { itemNum: '1511', itemType: 'Set', description: 'Outfit with 1511 (O)', yearProd: '1936', _era: 'prewar', _tab: 'Lionel Pre-War', gauge: 'O', rowId: 'PRE1511B' },
  { itemNum: '1511', itemType: 'Boxcar', description: "CSX Link 50' Rib-sided Boxcar", yearProd: '1998', _era: 'am_s', _tab: 'American Models S', gauge: 'S', rowId: 'AMS1511' },
  { itemNum: '1511', itemType: 'Hopper', description: 'Twin Hopper', yearProd: '2003', _era: 'shelper', _tab: 'S-Helper Service S', gauge: 'S', rowId: 'SH1511' },
  { itemNum: '1511-1', itemType: 'Boxcar', description: 'Boxcar', yearProd: '2006', _era: 'atlas', _tab: 'Atlas O', gauge: 'O', trackPower: '3-Rail', rowId: 'AO15111' },
  { itemNum: '1511', itemType: 'Boxcar', description: 'HO Boxcar', yearProd: '2004', _era: 'atlas_ho', _tab: 'Atlas HO', gauge: 'HO', rowId: 'AHO1511' },
  { itemNum: '1511-L', itemType: 'Steam Locomotive', description: 'Weaver loco', yearProd: '2000', _era: 'weaver', _tab: 'Weaver O', gauge: 'O', trackPower: '2-Rail', rowId: 'WV1511L' },
  { itemNum: '200', itemType: 'Hopper', description: 'Gilbert hopper', yearProd: '1950', _era: 'af_gilbert', _tab: 'American Flyer S - Gilbert', gauge: 'S', rowId: 'AF200' },
  { itemNum: '2343', itemType: 'Diesel Locomotive', description: 'Santa Fe F3', yearProd: '1950', _era: 'pw', _tab: 'Lionel PW - Items', gauge: 'O', rowId: 'PW2343' },
];
const F = (o) => Object.assign({ mfr: '', period: '', type: '', scale: '', road: '' }, o);
const fitsOf = (o) => ROWS.filter(r => r.itemNum === '1511' && ctx._wizRowFitsFilters(r, F(o))).map(r => r.rowId).join(',');

// ── F ──
ok('F1 Lionel + Postwar → no 1511 fits', fitsOf({ mfr: 'Lionel', period: 'postwar' }) === '', fitsOf({ mfr: 'Lionel', period: 'postwar' }));
ok('F2 Lionel + Pre-War → only the two Pre-War rows', fitsOf({ mfr: 'Lionel', period: 'prewar' }) === 'PRE1511A,PRE1511B', fitsOf({ mfr: 'Lionel', period: 'prewar' }));
ok('F3 American Models → only the CSX boxcar', fitsOf({ mfr: 'American Models' }) === 'AMS1511', fitsOf({ mfr: 'American Models' }));
ok('F4 Era All + Lionel → only the Lionel rows', fitsOf({ mfr: 'Lionel' }) === 'PRE1511A,PRE1511B', fitsOf({ mfr: 'Lionel' }));
ok('F5 Type filter: Lionel + Pre-War + a type no 1511 has → nothing', fitsOf({ mfr: 'Lionel', period: 'prewar', type: 'Caboose' }) === '');
ok('F6 Scale S → the two S rows', fitsOf({ scale: 'S' }) === 'AMS1511,SH1511', fitsOf({ scale: 'S' }));
ok('F7 no filters → every 1511 fits', fitsOf({}) === 'PRE1511A,PRE1511B,AMS1511,SH1511,AHO1511', fitsOf({}));
ok('F8 a row from no catalog of the picked maker never fits (Atlas HO under Atlas + O)', fitsOf({ mfr: 'Atlas', scale: 'O' }) === '');
// the picker + the scorer
const pick = (data, held) => { ctx.__set(ROWS, data, held); return ctx._wizResolveAddRow('1511'); };
ok('F9 picker: Lionel + Postwar + 1511 → null', pick({ _searchFilterManufacturer: 'Lionel', _searchFilterPeriod: 'postwar' }) === null);
ok('F10 picker: Lionel + Pre-War → the Pre-War engine', (pick({ _searchFilterManufacturer: 'Lionel', _searchFilterPeriod: 'prewar' }) || {}).rowId === 'PRE1511A');
ok('F11 picker: American Models (+ the Modern it sets) → the CSX boxcar', (pick({ _searchFilterManufacturer: 'American Models', _searchFilterPeriod: 'modern' }) || {}).rowId === 'AMS1511');
ok('F12 picker: a held Pre-War row is LET GO under Lionel + Postwar (no "keep rather than fail")', pick({ _searchFilterManufacturer: 'Lionel', _searchFilterPeriod: 'postwar' }, ROWS[0]) === null);
ok('F13 picker: a held row that fits stays (a tapped suggestion)', pick({ _searchFilterManufacturer: 'Lionel' }, ROWS[1]) === ROWS[1]);
ok('F14 picker: typed "lionel 1511" acts as the maker filter', (() => { ctx.__set(ROWS, { _typedSearchMfr: 'Lionel', _searchFilterPeriod: 'postwar' }); return ctx._wizResolveAddRow('lionel 1511'); })() === null);
ok('F15 picker: an inbox add answers to its photo tag, not the Add filters', pick({ _fromInbox: true, _searchFilterManufacturer: 'Lionel', _searchFilterPeriod: 'postwar' }, ROWS[0]) === ROWS[0]);
ctx.__set(ROWS, { _searchFilterManufacturer: 'Lionel', _searchFilterPeriod: 'postwar' });
ok('F16 scorer (_wizPickMasterRow) never answers outside the filters', ctx._wizPickMasterRow('1511') === null);
ctx.__set(ROWS, {});
ok('F17 no filters → the scorer still answers (nothing new is refused)', !!ctx._wizPickMasterRow('1511'));

// ── T — the tag words ──
const tag = (r) => ctx.rrRowTagWords(r);
ok('T1 Lionel Pre-War → "LIONEL · PREWAR"', tag(ROWS[0]) === 'LIONEL · PREWAR', tag(ROWS[0]));
ok('T2 Lionel Postwar → "LIONEL · POSTWAR"', tag(ROWS[8]) === 'LIONEL · POSTWAR', tag(ROWS[8]));
ok('T3 American Models → "AMERICAN MODELS · S"', tag(ROWS[2]) === 'AMERICAN MODELS · S', tag(ROWS[2]));
ok('T4 S-Helper → "S-HELPER SERVICE · S" (the maker word is the one decider\'s)', tag(ROWS[3]) === 'S-HELPER SERVICE · S', tag(ROWS[3]));
ok('T5 Atlas O 3-Rail → "ATLAS · O 3-RAIL"', tag(ROWS[4]) === 'ATLAS · O 3-RAIL', tag(ROWS[4]));
ok('T6 Weaver 2-Rail → "WEAVER · O 2-RAIL"', tag(ROWS[6]) === 'WEAVER · O 2-RAIL', tag(ROWS[6]));
ok('T7 a non-Lionel maker with a real era says it → "A.C. GILBERT · POSTWAR"', tag(ROWS[7]) === 'A.C. GILBERT · POSTWAR', tag(ROWS[7]));
ok('T8 Lionel Modern → "LIONEL · MODERN"', tag({ itemNum: '6-8359', _era: 'mpc', yearProd: '1976', _tab: 'Lionel MPC' }) === 'LIONEL · MODERN', tag({ itemNum: '6-8359', _era: 'mpc', yearProd: '1976' }));
ok('T9 no row → no tag', tag(null) === '');
const eraAll = ROWS.filter(r => r.itemNum === '1511' && ['prewar', 'am_s', 'shelper'].indexOf(r._era) >= 0 && r.itemType !== 'Set').map(tag).join(' / ');
ok('T10 Era All · 1511: the three rows read LIONEL · PREWAR / AMERICAN MODELS · S / S-HELPER SERVICE · S', eraAll === 'LIONEL · PREWAR / AMERICAN MODELS · S / S-HELPER SERVICE · S', eraAll);
ok('T11 tag words come from RR_ADD_FILTERS (change the separator → the tag follows)', (() => {
  const keep = ctx.RR_ADD_FILTERS.tagSep; ctx.RR_ADD_FILTERS.tagSep = ' / '; const t = tag(ROWS[0]); ctx.RR_ADD_FILTERS.tagSep = keep; return t === 'LIONEL / PREWAR';
})());

// ── M — the maker's one period ──
ok('M1 Atlas → Modern', ctx._wizMakerOnlyPeriod('Atlas') === 'modern');
ok('M2 A.C. Gilbert → Postwar (was forced to Modern)', ctx._wizMakerOnlyPeriod('A.C. Gilbert') === 'postwar', ctx._wizMakerOnlyPeriod('A.C. Gilbert'));
ok('M3 Lionel spans periods → left alone', ctx._wizMakerOnlyPeriod('Lionel') === '');
ok('M4 Marx spans periods → left alone', ctx._wizMakerOnlyPeriod('Marx') === '');
ok('M5 American Models / S-Helper / MTH / Weaver → Modern', ['American Models', 'S-Helper Service', 'MTH', 'Weaver'].every(m => ctx._wizMakerOnlyPeriod(m) === 'modern'));
// every maker on the Manufacturer filter: the period it sets, if any, IS the period of its rows
const ERAS = vm.runInContext('ERAS', ctx);   // a top-level const lives in the sandbox's scope, not on its object
const makers = {}; Object.keys(ERAS).forEach(k => { const m = ERAS[k] && ERAS[k].manufacturer; if (m && !ERAS[k]._isAll) makers[m] = 1; });
const wrong = Object.keys(makers).filter(m => {
  const p = ctx._wizMakerOnlyPeriod(m); if (!p) return false;
  return Object.keys(ERAS).some(k => ERAS[k] && ERAS[k].manufacturer === m && ctx._ERA_KEY_TO_PERIOD[k] !== p);
});
ok('M6 no maker is ever given an Era its own catalogs are not in', wrong.length === 0, wrong.join(', '));

// ── S — the scans, each with its planted offender ──
// S1: after the number step nothing looks the number up again
function s1(files) { return Object.keys(files).filter(f => /matchedItem\s*\|\|\s*(\(typeof findMaster[^)]*\)\s*\?\s*)?findMaster\(/.test(files[f])); }
const ADDFILES = { 'wizard.js': WIZ, 'wizard-steps.js': STEPS, 'wizard-suggestions.js': SUG, 'wizard-handlers.js': HAND };
ok('S1 no Add step re-looks the number up ("matchedItem || findMaster(")', s1(ADDFILES).length === 0, s1(ADDFILES).join(', '));
const p1 = Object.assign({}, ADDFILES, { 'wizard.js': plant(WIZ, 'const _cdMaster = _wizAddRow();', "const _cdMaster = wizard.matchedItem || findMaster(_cdItemNum, '', _wizMasterPrefer());", 'step 2 second lookup') });
ok('S1 PLANTED: step 2\'s old second lookup put back → caught', s1(p1).length === 1);
ok('S1b step 2 reads the add\'s one row', /const _cdMaster = _wizAddRow\(\);/.test(WIZ));

// S2: every catalog read inside the Add screen's number lookups answers to the one test
const FITS = /_wizRowFitsFilters|_nFits|\bfits\(|_fits\(|_wizResolveAddRow|_wizPickMasterRow/;
function lookupBodies(w, sg) {
  const nextBlock = (() => { const a = w.indexOf("if (s.type === 'itemNumGrouping') {\n    const _rawInput"); const b = w.indexOf('// conditionDetails: commit slider defaults', a); return a < 0 || b < 0 ? '' : w.slice(a, b); })();
  return {
    _wizResolveAddRow: grab(sg, 'function _wizResolveAddRow('),
    lookupItem: grab(sg, 'function lookupItem('),
    _wizPickMasterRow: grab(w, 'function _wizPickMasterRow('),
    _renderAddingBannerItem: grab(w, 'function _renderAddingBannerItem('),
    'Next (itemNumGrouping)': nextBlock,
  };
}
function s2(w, sg) {
  const bad = [];
  const bodies = lookupBodies(w, sg);
  Object.keys(bodies).forEach(name => {
    const body = bodies[name];
    if (!body) { bad.push(name + ': not found'); return; }
    // each statement that reads the catalog (state.masterData / findMaster) must
    // carry the one test, the one picker, or — the banner only — an owned copy's row
    const re = /(state\.masterData|findMaster\()/g; let m;
    while ((m = re.exec(body))) {
      // the whole statement: from its line to the ';' at bracket depth 0
      const st = Math.max(0, body.lastIndexOf('\n', m.index));
      let dep = 0, end = body.length;
      for (let k = st; k < body.length; k++) {
        const c = body[k];
        if (c === '(' || c === '{' || c === '[') dep++;
        else if (c === ')' || c === '}' || c === ']') { dep--; if (dep < 0) { end = k; break; } }
        else if (c === ';' && dep === 0) { end = k + 1; break; }
      }
      const stmt = body.slice(st, end);
      if (/typeof\s+findMaster/.test(stmt) && !/findMaster\(/.test(stmt.replace(/typeof\s+findMaster/g, ''))) continue;
      if (FITS.test(stmt)) continue;
      if (/state\.personalData\[d\._updatePdKey\]/.test(stmt)) continue;   // editing an owned copy: its own saved row
      if (/sold|forsale|personalData\)/.test(stmt) && !/masterData/.test(stmt)) continue;
      bad.push(name + ': ' + stmt.trim().slice(0, 90));
    }
  });
  return bad;
}
ok('S2 every catalog read in the Add lookups goes through the one filter test', s2(WIZ, SUG).length === 0, s2(WIZ, SUG).join(' | '));
const p2a = plant(SUG, "  if (!rows.length) return null;\n  if (prefType) {", "  if (!rows.length) return state.masterData.find(function (i) { return String(i.itemNum || '').toLowerCase() === numLC; }) || null;\n  if (prefType) {", 'first-row escape');
ok('S2 PLANTED: the "first row with this number" escape put back in the picker → caught', s2(WIZ, p2a).length > 0);
const p2b = plant(WIZ, "    } else if (!d._setMode && !d._resolvedSet && typeof _wizResolveAddRow === 'function') {",
  "    } else if (!d._setMode && typeof findMaster === 'function') {\n      match = findMaster(num, d.variation, _wizMasterPrefer());\n    } else if (!d._setMode && !d._resolvedSet && typeof _wizResolveAddRow === 'function') {", 'banner findMaster');
ok('S2 PLANTED: the banner\'s old findMaster lookup put back → caught', s2(p2b, SUG).length > 0);
const p2c = plant(WIZ, "        if (!_nFits(m)) return false;   // 2026-11-01", "        // 2026-11-01", 'partials unfiltered');
ok('S2 PLANTED: Next\'s "Select an item" scan without the test → caught', s2(p2c, SUG).length > 0);

// S3: the escapes never come back
const ESCAPES = [/ignore period rather than fail/i, /load order last/i, /the unfiltered list stands/i, /catch \(e\) \{ return \(rows && rows\[0\]\)/];
function s3(texts) { return texts.some(t => ESCAPES.some(re => re.test(t.replace(/\/\/[^\n]*/g, '')))); }
ok('S3 no "ignore the filter rather than fail" escape in the Add files', !s3([WIZ, SUG, STEPS, HAND]));
ok('S3 PLANTED: the old "load order last" fallback → caught', s3([plant(SUG, '  return (typeof _wizPickMasterRow', "  var _x = 'load order last';\n  return (typeof _wizPickMasterRow", 'escape')]));

// S4: the list keeps no copy of the filter test
function s4(sg) {
  const fn = grab(sg, 'function updateItemSuggestions(');
  const scan = fn.slice(fn.indexOf('function _scanRows('), fn.indexOf('// Session 157: primary pass'));
  return /_fits\(m, _fset\)/.test(scan) && !/_manufacturerOfItem|_periodOfRow|ERA_SCALE|getTypeBucketLabel|_filterRoad &&/.test(scan);
}
ok('S4 the Add list asks the one test and keeps no copy of it', s4(SUG));
ok('S4 PLANTED: an inline Era test put back in the list → caught', !s4(plant(SUG, '      if (_fits && !_fits(m, _fset)) return;', "      if (_fits && !_fits(m, _fset)) return;\n      if (_effPeriod && _periodOfRow(m) !== _effPeriod) return;", 'inline era')));

// S5: the tag — one helper, three places, never a second chip
function s5(sg, w) {
  const rowCode = grab(sg, 'function updateItemSuggestions(');
  const inList = (rowCode.match(/rrRowTagHtml\(/g) || []).length === 1 && !/railSpan|rrRailChipLabel/.test(rowCode);
  const inBanner = /rrRowTagHtml\(match, 'rr-row-tag-banner'\)/.test(grab(w, 'function _renderAddingBannerItem('));
  const inCard = /rrRowTagHtml\(_cdMaster, 'rr-row-tag-cd'\)/.test(w);
  const builtElsewhere = [sg.replace(grab(sg, 'function rrRowTagHtml('), ''), w].some(t => /class="rr-row-tag/.test(t));
  return inList && inBanner && inCard && !builtElsewhere;
}
ok('S5 the tag is drawn only by rrRowTagHtml — list, banner, step 2 card', s5(SUG, WIZ));
ok('S5 PLANTED: a second maker chip on the row → caught', !s5(plant(SUG, "    if (_tagHtml) line1.insertAdjacentHTML('beforeend', _tagHtml);",
  "    if (_tagHtml) line1.insertAdjacentHTML('beforeend', _tagHtml);\n    line1.insertAdjacentHTML('beforeend', rrRowTagHtml(c._row || c));", 'second chip'), WIZ));
ok('S5 PLANTED: a hand-built tag in the banner → caught', !s5(SUG, plant(WIZ, "rrRowTagHtml(match, 'rr-row-tag-banner')", "('<span class=\"rr-row-tag\">' + rrRowMakerWord(match) + '</span>')", 'hand tag')));

// S6: the words
const W = ctx.RR_ADD_FILTERS;
ok('S6 the three lines\' words are in config.js', !!(W && W.noneFor && W.noneAtAll && W.elsewhere && W.clearAsk && W.clearBtn && W.manualAsk && W.manualBtn));
ok('S6 exact wording Brad agreed', W.noneFor === 'No {num} found for {filters} in our Master Catalog' && W.noneAtAll === 'No item found in our Master Catalog'
  && W.clearAsk === 'Clear filters?' && W.manualAsk === 'Add manually?' && W.elsewhere === '{num} is in the Master Catalog under other makers or eras');
function s6(texts) { return texts.every(t => !/in our Master Catalog|under other makers or eras|Add manually\?/.test(t.replace(/\/\/[^\n]*/g, ''))); }
ok('S6 no Add file types those words itself', s6([WIZ, SUG, STEPS, HAND]));
ok('S6 PLANTED: the words typed into wizard-suggestions.js → caught', !s6([plant(SUG, 'function _wizNothingFoundHtml(num) {', "function _wizNothingFoundHtml(num) {\n  var _t = 'No item found in our Master Catalog';", 'typed words')]));
const noAI = (o) => JSON.stringify(o).split(/[^A-Za-z]+/).indexOf('AI') < 0;
ok('S6 no word "AI" in anything the collector sees here', noAI(W));
ok('S6 PLANTED: an "AI" word → caught', !noAI(Object.assign({}, W, { x: 'AI suggestion' })));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
