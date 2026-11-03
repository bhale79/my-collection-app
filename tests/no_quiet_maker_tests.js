#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════
// THE APP NEVER FILLS IN A MAKER ON ITS OWN — 2026-11-03   (Node, the REAL app code)
//
// [stated] Brad 2026-11-03 06:31 CT: "we dont need to quielty fill anything.
// thats an issue" → 07:30 CT "yes" to PLAN_2026-11-03_NO_QUIET_MAKER.
// Mike Caruso's MTH Dreyfuss Hudson and MTH SD40 showed LIONEL: an add with no
// catalog row and no maker picked saved "the era on screen", and with no era
// that answered 'Lionel' (_getEraManufacturer). Reading the sheet back turned a
// BLANK maker cell into "Lionel" too, and 28 places looked a maker up by the
// bare number (MTH, Lionel, Atlas and Weaver reuse numbers).
//
//   R  THE one rule (rrMakerOf, app.js) run for real, with config.js's makers:
//      the item's own catalog row, else the maker the collector chose, else the
//      maker saved on the copy, else BLANK. A copy is looked up only in the
//      catalog it names, never by number alone; no era on screen, no 'Lionel'.
//   U  which items are "not tied to a catalog entry" (rrCopyIsUnlinked) — the
//      ones Update Info and Check makers offer a Manufacturer for
//   A  the Add flow asks (_rrAddNeedsMaker): no catalog row + no maker named →
//      the "Who made this item?" step; a row → never; once asked it stays; the
//      sticky maker filter only pre-selects the answer; the step's answer
//      outranks the filter (_rrAddChosenMaker)
//   C  Check makers lists exactly the no-link, Lionel-or-blank items
//      (rrCheckMakersList, tools.js) of a stand-in collection with every kind
//   S  scans of every app file, each proven able to fail on a planted offender:
//      S1 no `|| 'Lionel'` default anywhere
//      S2 _getEraManufacturer() is called nowhere but the named hint
//         (command-ids.js) — never as an item's maker
//      S3 no _brandOfItem(...) without the row's own hint: one argument only
//         inside the rule itself (rrMakerOf), else number + variation + prefer
//      S4 no maker fallback to the ERA map for a COPY (pd.manufacturer ||
//         ERAS[pd.era]…) — only through rrMakerOf
//      S5 the photo reader's maker picker pre-picks nothing
//      S6 the Add step sits after the number/variation and before Condition &
//         Details, reusing the hand-entry maker buttons
//      S7 Update Info shows Manufacturer only for an unlinked item, and its save
//         keeps the collector's maker (_noCatalogRow)
//      S8 the Market send and Reports go through the rule; a blank is "Maker
//         not set", never Lionel
//      S9 the paper step SAVES the Lionel it shows (written on render)
//   The five deliberate Lionels stay and are named here: command-ids.js's era
//   hint, maintenance.js's word map, barcode.js's Lionel-UPC rules (935, 1063,
//   1493) — Lionel's own barcodes and words, not a default.
// The browser half (the real screens) is no_quiet_maker_road_tests.js.
// ═══════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { makerOfSource, liftFn } = require('./lib/maker-of.js');
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function ok(n, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (extra || ''))); cond ? pass++ : fail++; }
function section(t) { console.log('\n── ' + t + ' ──'); }
function read(f) { return fs.readFileSync(path.join(APP, f), 'utf8'); }
function plant(src, from, to, label) {
  if (src.indexOf(from) < 0) throw new Error('planted offender "' + label + '" no longer matches the source — update the test');
  return src.replace(from, to);
}
// Comments out (line and block), strings kept — the scans read CODE only.
function code(src) {
  // A block comment starts at a line start or after a space/bracket — never the
  // '/*' inside a string such as accept="image/*".
  return src.replace(/(^|[\s;{}(),])\/\*[\s\S]*?\*\//g, '$1').replace(/(^|[^:/\\'"*])\/\/[^\n]*/g, '$1');
}

const CFG = read('config.js'), APPJS = read('app.js'), ADATA = read('app-data.js');
const WSAVE = read('wizard-save.js'), STEPS = read('wizard-steps.js'), TOOLS = read('tools.js');

// ── the REAL pieces in one sandbox: config (ERAS, ERA_TABS, the hand-entry
// maker lists), the maker/era deciders, _preferEraOf, the rule ───────────────
const ctx = { console: { log() {}, warn() {}, error() {} }, setTimeout, clearTimeout,
  localStorage: { _s: {}, getItem(k) { return this._s[k] == null ? null : this._s[k]; }, setItem(k, v) { this._s[k] = String(v); }, removeItem(k) { delete this._s[k]; } },
  navigator: { userAgent: 'node', platform: 'node', maxTouchPoints: 0 },
  location: { href: 'https://therailroster.com/app/', hostname: 'therailroster.com', search: '' } };
ctx.window = ctx; ctx.self = ctx; ctx.addEventListener = ctx.removeEventListener = function () {};
vm.createContext(ctx);
let loaded = true;
try {
  vm.runInContext(CFG, ctx, { filename: 'config.js' });
  const brandVar = APPJS.slice(APPJS.indexOf('var _BRAND_LABELS'), APPJS.indexOf('\n', APPJS.indexOf('var _BRAND_LABELS')));
  vm.runInContext([
    brandVar,
    liftFn(APPJS, '_manufacturerOfEra'), liftFn(APPJS, '_manufacturerOfItem'), liftFn(APPJS, '_itemEraKey'),
    liftFn(APPJS, '_brandLabel'), liftFn(APPJS, '_brandOfItem'), liftFn(APPJS, '_getEraManufacturer'),
    liftFn(ADATA, '_preferEraOf'),
    makerOfSource(),
    liftFn(WSAVE, '_rrAddChosenMaker'), liftFn(WSAVE, '_rrAddNeedsMaker'),
    liftFn(TOOLS, 'rrCheckMakersList'),
  ].join('\n'), ctx, { filename: 'lifted.js' });
} catch (e) { loaded = false; console.log('FAIL  the real pieces load into the sandbox  -> ' + e.message); fail++; }

// The catalog: numbers that COLLIDE across makers, the way the real one does.
const ROWS = [
  { itemNum: '20-3526-1E', variation: '', _era: 'mth_o', rowId: 'U7A525KEFF', description: 'Dreyfuss Hudson' },
  { itemNum: '2343', variation: '', _era: 'pw', rowId: 'PW2343', description: 'Santa Fe F3' },
  { itemNum: '6464', variation: '', _era: 'atlas', rowId: 'AT6464', description: 'Atlas boxcar' },
  { itemNum: '6464', variation: '', _era: 'pw', rowId: 'PW6464', description: 'Lionel boxcar' },
  { itemNum: '3300', variation: '', _era: 'prewar', rowId: 'PRE3300', description: 'Summer trolley trailer' },
];
let lastFind = null;
if (loaded) {
  ctx.rrMasterByRowId = (id) => ROWS.find(r => r.rowId === id) || null;
  // findMaster as the app's: a Row ID answers exactly; else the first row under
  // the number, preferring the named catalog — so a number-only ask CAN return
  // another maker's row, which is exactly what the rule must never trust.
  ctx.findMaster = (n, v, prefer) => {
    lastFind = { n, prefer };
    if (prefer && String(prefer.era || '') === 'Manual') return null;
    if (prefer && prefer.masterRowId) { const r = ctx.rrMasterByRowId(prefer.masterRowId); if (r && r.itemNum === n) return r; }
    const all = ROWS.filter(r => r.itemNum === String(n));
    const want = prefer && prefer.era;
    return (want && all.find(r => r._era === want)) || all[0] || null;
  };
}
const M = (o) => ctx.rrMakerOf(o);

section('R  the one rule');
if (loaded) {
  ok('R1 a catalog row decides: the MTH Hudson row → MTH', M({ row: ROWS[0] }) === 'MTH', M({ row: ROWS[0] }));
  ok('R2 …and outranks a maker the add had chosen (the row is the fact)', M({ row: ROWS[0], chosen: 'Lionel' }) === 'MTH');
  ok('R3 a copy that names its catalog (era MTH O) gets that row\'s maker, even if Lionel was saved on it',
     M({ copy: { itemNum: '20-3526-1E', era: 'mth_o', manufacturer: 'Lionel' } }) === 'MTH');
  ok('R4 a copy found by its saved Row ID gets that row\'s maker',
     M({ copy: { itemNum: '20-3526-1E', masterRowId: 'U7A525KEFF' } }) === 'MTH');
  lastFind = null;
  const noName = M({ copy: { itemNum: '6464', manufacturer: '' } });
  ok('R5 a copy that names NO catalog is never looked up by its number — 6464 is Atlas AND Lionel',
     noName === '' && lastFind === null, noName + ' / looked up: ' + JSON.stringify(lastFind));
  ok('R6 …it keeps the maker saved on it', M({ copy: { itemNum: '6464', manufacturer: 'K-Line' } }) === 'K-Line');
  ok('R7 a lookup that comes back from ANOTHER catalog is not trusted (copy says Lionel Postwar, only Pre-War holds 3300)',
     M({ copy: { itemNum: '3300', era: 'pw', manufacturer: '' } }) === '');
  ok('R8 a hand-added item (era Manual) is never matched to the catalog — Mike\'s MTH stays MTH',
     M({ copy: { itemNum: '2343', era: 'Manual', manufacturer: 'MTH' } }) === 'MTH');
  ok('R9 the collector\'s choice is used when there is no row', M({ row: null, chosen: 'MTH' }) === 'MTH');
  ok('R10 the choice outranks an old saved maker', M({ copy: { itemNum: 'X1', manufacturer: 'Lionel' }, chosen: 'Marx' }) === 'Marx');
  ok('R11 nothing known → BLANK, never Lionel', M({}) === '' && M({ row: null, chosen: '' }) === '' && M({ copy: { itemNum: 'ZZ9' } }) === '');
  ok('R12 an empty row object is no row', M({ row: {}, chosen: '' }) === '');
  ctx._currentEra = undefined;
  ok('R13 the era on screen, with no era, is BLANK now (it answered Lionel)', ctx._getEraManufacturer() === '');
  ctx._currentEra = 'mth_o';
  ok('R14 …and with an era it still names that era\'s maker — for the screen hint only', ctx._getEraManufacturer() === 'MTH');
  ctx._currentEra = undefined;
  ok('R15 a hand-added item with no maker saved has NO maker (was Manual → postwar → Lionel)',
     ctx._manufacturerOfItem({ itemNum: 'X', era: 'Manual', manufacturer: '' }) === null);
  ok('R16 …and one with a maker keeps it', ctx._manufacturerOfItem({ era: 'Manual', manufacturer: 'Marx' }) === 'marx');
}

section('U  not tied to a catalog entry');
if (loaded) {
  const U = (c) => ctx.rrCopyIsUnlinked(c);
  ok('U1 a hand-added item is unlinked', U({ itemNum: 'SD40', era: 'Manual' }) === true);
  ok('U2 a saved Row ID ties it', U({ itemNum: '2343', masterRowId: 'PW2343' }) === false);
  ok('U3 a saved key ties it', U({ itemNum: '2343', masterKey: 'pw|2343|' }) === false);
  ok('U4 its own catalog holding it ties it', U({ itemNum: '20-3526-1E', era: 'mth_o' }) === false);
  ok('U5 a number its catalog lacks is unlinked (Mike\'s SD40 typed under an era)', U({ itemNum: '30-2178-1', era: 'pw' }) === true);
  ok('U6 a number found only in ANOTHER catalog is still unlinked', U({ itemNum: '3300', era: 'pw' }) === true);
  ok('U7 the maker list offers the hand-entry makers, the device\'s own, and extras, once each',
     (function () {
       ctx.localStorage.setItem('rr_custom_makers', JSON.stringify(['Dorfan', 'mth']));
       const k = ctx.rrKnownMakers(['Sunset', 'MTH']);
       ctx.localStorage.removeItem('rr_custom_makers');
       return k.indexOf('MTH') >= 0 && k.indexOf('Dorfan') >= 0 && k.indexOf('Sunset') >= 0
         && k.filter(x => x.toLowerCase() === 'mth').length === 1;
     })());
}

section('A  the Add flow asks instead of guessing');
if (loaded) {
  ctx.wizard = { matchedItem: null, data: {} };
  ctx._wizAddRow = () => ctx.wizard.matchedItem;
  const need = (d, row) => { ctx.wizard.matchedItem = row || null; ctx.wizard.data = d; return ctx._rrAddNeedsMaker(d); };
  ok('A1 a typed number with no catalog row and no maker → asked', need({ itemNum: '30-2178-1' }) === true);
  ok('A2 an add WITH a catalog row → never asked', need({ itemNum: '2343' }, ROWS[1]) === false);
  ok('A3 a hand-added item has its own maker step → not asked twice', need({ itemNum: 'X', _manualEntry: true }) === false);
  ok('A4 sets, updates, boxes, Quick Entry completions → not asked here',
     [{ _setMode: true }, { _updatePdKey: 'k' }, { boxOnly: true }, { _fillItemMode: true }, { _completingQuickEntry: true }]
       .every(x => need(Object.assign({ itemNum: '1' }, x)) === false));
  ok('A5 no number yet → not asked', need({ itemNum: '' }) === false);
  ok('A6 a maker typed with the number counts as named → not asked', need({ itemNum: '1', _typedSearchMfr: 'MTH' }) === false);
  ok('A7 Add a Piece\'s copy names it → not asked', need({ itemNum: '1-BOX', _manufacturer: 'MTH' }) === false);
  const d8 = { itemNum: '30-2178-1', _searchFilterManufacturer: 'Lionel' };
  ok('A8 a sticky Lionel FILTER does not count as naming it — still asked', need(d8) === true);
  ok('A9 …the filter only pre-selects the answer on the step', d8.manualManufacturer === 'Lionel');
  d8.manualManufacturer = 'MTH';
  ok('A10 once asked, the step stays (Back returns to it) while there is still no row', need(d8) === true);
  ok('A11 …and goes the moment a catalog row is picked', need(d8, ROWS[0]) === false);
  ok('A12 the step\'s answer outranks the sticky filter in the save', ctx._rrAddChosenMaker(d8) === 'MTH', ctx._rrAddChosenMaker(d8));
  ok('A13 Add a Piece\'s copy outranks everything chosen', ctx._rrAddChosenMaker({ _manufacturer: 'Atlas', manualManufacturer: 'MTH' }) === 'Atlas');
}

section('C  Check makers lists exactly the right items');
if (loaded) {
  ctx.rrIsAppMadeNumber = (n) => /^PC-\d+$/.test(String(n));
  ctx.state = { personalData: {
    a: { owned: true, itemNum: '30-2178-1', era: 'pw', manufacturer: 'Lionel', inventoryId: 'a' },       // the SD40: unlinked + Lionel → listed
    b: { owned: true, itemNum: 'SD9', era: 'Manual', manufacturer: '', inventoryId: 'b' },              // hand-added, no maker → listed
    c: { owned: true, itemNum: '2343', era: 'pw', masterRowId: 'PW2343', manufacturer: 'Lionel', inventoryId: 'c' },   // catalog item → not listed
    d: { owned: true, itemNum: 'TOY1', era: 'Manual', manufacturer: 'Marx', inventoryId: 'd' },         // has its maker → not listed
    e: { owned: false, itemNum: 'SOLD1', era: 'Manual', manufacturer: '', inventoryId: 'e' },           // not owned → not listed
    f: { owned: true, itemNum: 'PC-1001', era: 'Manual', manufacturer: 'Lionel', inventoryId: 'f' },    // a paper item, typed on screen → not listed
    g: { owned: true, itemNum: '20-3526-1E', era: 'mth_o', manufacturer: 'Lionel', inventoryId: 'g' },  // in its catalog (2.75) → not listed; its row says MTH
    h: { owned: true, itemNum: '3300', era: 'pw', manufacturer: 'lionel', inventoryId: 'h' },           // only another catalog has 3300 → listed
  } };
  const keys = ctx.rrCheckMakersList().map(x => x.key).sort().join(',');
  ok('C1 the list is the SD40, the maker-less hand-added item and the other-catalog 3300 — nothing else', keys === 'a,b,h', keys);
  ok('C2 the Hudson now in the catalog reads MTH everywhere through the rule', M({ copy: ctx.state.personalData.g }) === 'MTH');
}

// ═══ S — scans of every app file, each proven on a planted offender ═══
const FILES = fs.readdirSync(APP).filter(f => /\.js$/.test(f) && f !== 'sw.js');
const SRC = {}; FILES.forEach(f => { SRC[f] = read(f); });

// S1: `|| 'Lionel'` / `|| "Lionel"` in code.
function scanS1(src) {
  const out = [];
  Object.keys(src).forEach(f => {
    code(src[f]).split('\n').forEach((ln, i) => { if (/\|\|\s*['"]Lionel['"]/.test(ln)) out.push(f + ':' + (i + 1)); });
  });
  return out;
}
// S2: _getEraManufacturer() called outside its definition and the named hint.
function scanS2(src) {
  const out = [];
  Object.keys(src).forEach(f => {
    code(src[f]).split('\n').forEach((ln, i) => {
      if (!/_getEraManufacturer\s*\(\s*\)/.test(ln)) return;
      if (/function _getEraManufacturer\s*\(/.test(ln)) return;
      if (f === 'command-ids.js' && /makerKeyOf\(null, null, \[_getEraManufacturer\(\)\]\)/.test(ln)) return;   // the era HINT for the command-ID step
      out.push(f + ':' + (i + 1));
    });
  });
  return out;
}
// S3: every _brandOfItem( call: one argument only inside rrMakerOf; elsewhere 3.
function argCount(s, open) {
  let d = 0, n = 1, k = open, any = false;
  for (; k < s.length; k++) {
    const c = s[k];
    if (c === '(' || c === '[' || c === '{') { d++; if (d === 1) continue; }
    else if (c === ')' || c === ']' || c === '}') { d--; if (d === 0) break; }
    else if (c === ',' && d === 1) n++;
    if (d >= 1 && !/\s/.test(c)) any = true;
  }
  return any ? n : 0;
}
function scanS3(src) {
  const out = [];
  Object.keys(src).forEach(f => {
    const c = code(src[f]);
    const re = /_brandOfItem\s*\(/g; let m;
    while ((m = re.exec(c))) {
      const before = c.slice(Math.max(0, m.index - 30), m.index);
      if (/function\s+$/.test(before)) continue;                         // the definition
      if (/typeof\s+$/.test(before)) continue;
      const n = argCount(c, m.index + m[0].length - 1);
      const inRule = (function () {
        const fi = c.lastIndexOf('function rrMakerOf(', m.index);
        if (fi < 0) return false;
        const next = c.indexOf('\nfunction ', fi + 10);
        return next < 0 || m.index < next;
      })();
      if (n === 3) continue;
      if (inRule && n === 1) continue;
      out.push(f + ':' + (c.slice(0, m.index).split('\n').length) + ' (' + n + ' arg' + (n === 1 ? '' : 's') + ')');
    }
  });
  return out;
}
// S4: a COPY's maker falling back to the era map.
function scanS4(src) {
  const out = [];
  Object.keys(src).forEach(f => {
    code(src[f]).split('\n').forEach((ln, i) => {
      const m = /\b(pd|x|sd|fs|u|copy|entry)\.manufacturer\s*\|\|/.exec(ln);
      if (m && new RegExp('ERAS\\[\\s*' + m[1] + '\\.era\\s*\\]').test(ln.slice(m.index))) out.push(f + ':' + (i + 1));
    });
  });
  return out;
}
const DELIBERATE = [
  ['command-ids.js', /makerKeyOf\(null, null, \[_getEraManufacturer\(\)\]\)/],
  ['barcode.js', /if \(info\.mfr === 'Lionel' && \/\^\\d\{7\}\$\/\.test\(want\)\) return true;/],
  ['barcode.js', /if \(info && info\.mfr === 'Lionel'\) \{/],
  ['barcode.js', /if \(\/\\bLIONEL\\b\/i\.test\(t\)\) return 'Lionel';/],
  ['maintenance.js', /_manufacturerOfItem\(item\)/],
];

section('S  scans of every app file');
{
  const s1 = scanS1(SRC);
  ok('S1 no `|| \'Lionel\'` default anywhere in the app (' + FILES.length + ' files)', s1.length === 0, s1.join(', '));
  const p1 = Object.assign({}, SRC, { 'vault.js': plant(SRC['vault.js'], 'return rrMakerOf({ copy: x });', "return x.manufacturer || 'Lionel';", 'vault default') });
  ok('S1p …and it CATCHES one put back (the Market send defaulting to Lionel)', scanS1(p1).some(x => /^vault\.js:/.test(x)), scanS1(p1).join(', '));

  const s2 = scanS2(SRC);
  ok('S2 _getEraManufacturer() is called only for the command-ID era hint', s2.length === 0, s2.join(', '));
  const p2 = Object.assign({}, SRC, { 'browse.js': plant(SRC['browse.js'], "manufacturer: rrMakerOf({ copy: entry }),", "manufacturer: _getEraManufacturer(),", 'era maker on a sale') });
  ok('S2p …and it CATCHES the era-on-screen maker put back on a sale', scanS2(p2).some(x => /^browse\.js:/.test(x)), scanS2(p2).join(', '));

  const s3 = scanS3(SRC);
  ok('S3 no _brandOfItem by the number alone — the rule itself, or number + variation + the row\'s hint', s3.length === 0, s3.join(', '));
  const p3 = Object.assign({}, SRC, { 'drive.js': plant(SRC['drive.js'], "      if (_own) mfr = String(rrMakerOf({ copy: _own }) || '');", "      if (_own) mfr = String(_brandOfItem(itemNum) || '');", 'number-only photo maker') });
  ok('S3p …and it CATCHES a number-only lookup put back (photo file names)', scanS3(p3).some(x => /^drive\.js:/.test(x)), scanS3(p3).join(', '));
  const p3b = Object.assign({}, SRC, { 'tools.js': plant(SRC['tools.js'], "mfr = String(rrMakerOf({ copy: ownerPd }) || '');", "mfr = String(_brandOfItem(ownerPd.itemNum, ownerPd.variation) || '');", 'two-arg lookup') });
  ok('S3p2 …a number + variation lookup with no hint is caught too', scanS3(p3b).some(x => /^tools\.js:/.test(x)), scanS3(p3b).join(', '));

  const s4 = scanS4(SRC);
  ok('S4 no copy\'s maker falls back to the era map — only through the rule', s4.length === 0, s4.join(', '));
  const p4 = Object.assign({}, SRC, { 'wizard-pickers.js': plant(SRC['wizard-pickers.js'], "      var mf = rrMakerOf({ copy: pd });", "      var mf = pd.manufacturer || ((typeof ERAS !== 'undefined' && ERAS[pd.era]) ? ERAS[pd.era].manufacturer : '');", 'era-map maker') });
  ok('S4p …and it CATCHES the era-map fallback put back (the sell picker\'s maker list)', scanS4(p4).some(x => /^wizard-pickers\.js:/.test(x)), scanS4(p4).join(', '));

  ok('S0 the five deliberate Lionels are still where they are named — each a Lionel barcode, word or the era hint',
     DELIBERATE.every(([f, re]) => re.test(SRC[f] || '')),
     DELIBERATE.filter(([f, re]) => !re.test(SRC[f] || '')).map(x => x[0]).join(', '));

  const PIN = code(SRC['photo-inbox.js']);
  ok('S5 the photo reader\'s maker picker pre-picks nothing', !/pick\.maker\s*=\s*['"]Lionel['"]/.test(PIN));
  const p5 = code(plant(SRC['photo-inbox.js'], "      var makers = uniq(choices.map(function (c) { return c.maker; }));\n",
    "      var makers = uniq(choices.map(function (c) { return c.maker; }));\n      if (!pick.maker && makers.indexOf('Lionel') >= 0) pick.maker = 'Lionel';\n", 'pre-pick'));
  ok('S5p …and the old pre-pick put back is caught', /pick\.maker\s*=\s*['"]Lionel['"]/.test(p5));

  // S6: the Add step's place and shape.
  const iItemPicker = STEPS.indexOf("{ id: 'itemPicker', title: 'Select an item', type: 'itemPicker',\n        skipIf: (d) => !d._partialMatches");
  const iAdd = STEPS.indexOf("{ id: 'addMaker', title: 'Who made this item?', type: 'manualManufacturer',");
  const iCond = STEPS.indexOf("{ id: 'conditionDetails', title: 'Condition & Details', type: 'conditionDetails' }");
  ok('S6 the "Who made this item?" step sits after the number/variation and before Condition & Details',
     iItemPicker > 0 && iAdd > iItemPicker && iCond > iAdd, [iItemPicker, iAdd, iCond].join(' / '));
  ok('S6b …uses the hand-entry maker buttons (type manualManufacturer) and the one rule to decide (_rrAddNeedsMaker)',
     /id: 'addMaker'[^\n]*type: 'manualManufacturer',\s*\n\s*skipIf: \(d\) => !\(typeof _rrAddNeedsMaker === 'function' && _rrAddNeedsMaker\(d\)\) \}/.test(STEPS));
  const WIZ = read('wizard.js');
  ok('S6c Next will not pass the step without a maker (the hand-entry check covers it by TYPE, not id)',
     /if \(s\.type === 'manualManufacturer' && !\(wizard\.data\.manualManufacturer \|\| ''\)\.trim\(\)\)/.test(WIZ));

  // S7: Update Info.
  const COLL = read('app-collection.js');
  ok('S7 Update Info shows Manufacturer only for an item not tied to a catalog entry',
     /\.\.\.\(_panelUnlinked \? \[\{ label: 'Manufacturer', key: 'manufacturer'/.test(COLL)
     && /const _panelUnlinked = \(typeof rrCopyIsUnlinked === 'function'\) \? rrCopyIsUnlinked\(_live\)/.test(COLL));
  ok('S7b …and its save keeps the maker set there (no lookup by number re-picks one)',
     /_noCatalogRow: \(_panelUnlinked && !_entry\) \? true : undefined,/.test(COLL));
  ok('S7c …offering the makers the app knows, and any other can be typed', /f\.suggest === 'makers' && typeof rrKnownMakers === 'function'/.test(COLL));
  const p7 = plant(COLL, '...(_panelUnlinked ? [{ label', '...(true ? [{ label', 'always shown');
  ok('S7p …a Manufacturer line shown on every item is caught', !/\.\.\.\(_panelUnlinked \? \[\{ label: 'Manufacturer'/.test(p7));

  // S8: Market + Reports.
  const VAULT = code(SRC['vault.js']), REP = code(SRC['reports.js']), DASH = code(SRC['dashboard.js']);
  ok('S8 the Market send names the maker through the rule (a blank goes blank)', /const makerOf = function \(x\) \{\s*return rrMakerOf\(\{ copy: x \}\);/.test(VAULT));
  ok('S8b Reports count a blank maker as "Maker not set", never Lionel', /let mfr = rrMakerOf\(\{ copy: pd \}\);\s*if \(!mfr\) mfr = 'Maker not set';/.test(REP));
  ok('S8c the dashboard value-by-maker line does the same', /mk = String\(rrMakerOf\(\{ copy: pd \}\) \|\| ''\)\.trim\(\)/.test(DASH) && /return mk \|\| 'Maker not set';/.test(DASH));
  ok('S8d the sheet readers keep a blank maker blank (no reader defaults one)', !/manufacturer:\s*_\w+\(r\[\d+\]\)\s*\|\|/.test(code(ADATA)));

  // S9: paper.
  const step = WIZ.slice(WIZ.indexOf("} else if (s.type === 'paperExtras') {"), WIZ.indexOf("} else if (s.type === 'pricePaid') {"));
  ok('S9 the paper step SAVES the Lionel it shows — written into the data as the screen draws',
     /if \(wizard\.data\.eph_manufacturer == null\) wizard\.data\.eph_manufacturer = 'Lionel';/.test(step)
     && /const mf  = String\(wizard\.data\.eph_manufacturer \|\| ''\);/.test(step));
  ok('S9b …and the paper save itself fills nothing', /manufacturer: String\(d\.eph_manufacturer \|\| ''\)\.trim\(\),/.test(WSAVE)
     && !/eph_manufacturer \|\| 'Lionel'/.test(code(WSAVE)));

  // Check makers is reachable.
  ok('S10 Check Makers has its own Collection Tools section (every collector, every maker), outside the Universal grid, folded until tapped',
     /html \+= '<div id="makers-body" style="display:none">' \+ CARD_CHECK_MAKERS \+ '<\/div>';/.test(TOOLS)
     && /SECTION_HEADER\('makers', 'Check Makers', 'Items whose maker needs a look', true\)/.test(TOOLS) && !/'<div id="universal-body">'[^\n]*CARD_CHECK_MAKERS/.test(TOOLS));
  ok('S10b …its save writes through the safe write with the copy\'s own key, one guard per save',
     /rrOnce\('check-maker:' \+ e\.key, run, btn \|\| null\)/.test(TOOLS) && /rrPersonalSafeWrite\(pd, newRow, base, \{ out: _out \}\)/.test(TOOLS));
  ok('S10c no "AI" in the new words', !/\bAI\b/.test(TOOLS.slice(TOOLS.indexOf('var CARD_CHECK_MAKERS'), TOOLS.indexOf('var CARD_SET_BUILDER'))));
}

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  no_quiet_maker_tests: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
