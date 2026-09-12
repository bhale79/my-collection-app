#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// LOOKUP CANARY — v0.9.1483 (Session 78)
// Brad: "we keep running into the, that path grabs the first steam 238 in
// load order, issue."  This file is the tripwire: it extracts the REAL
// resolver functions from app/ and runs the two collision cases —
//   • No. 238  — same number in prewar AND postwar (the era collision)
//   • No. 9099 — fake number planted in O AND HO   (the scale collision)
// against _wizPickMasterRow, _wizRowFitsFilters and _findMasterCore.
// Run from repo root:  node tests/lookup_canary.js   (exit 1 = regression)
// ANY new lookup path must be added here before it ships.
// ═══════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('missing function ' + name);
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); }
  }
  throw new Error('unbalanced ' + name);
}
const wiz = fs.readFileSync(path.join(__dirname, '..', 'app', 'wizard.js'), 'utf8');
const dat = fs.readFileSync(path.join(__dirname, '..', 'app', 'app-data.js'), 'utf8');

// ── stub world ──────────────────────────────────────────────────────────
const ERA_SCALE = { prewar: 'O', pw: 'O', lionel_ho: 'HO' };
const pre238  = { itemNum: '238', _era: 'prewar', yearProd: '1936-1940', itemType: 'Steam Engine', roadName: '', _tab: 'Lionel Prewar - Items' };
const post238 = { itemNum: '238', _era: 'pw',     yearProd: '1963-64',   itemType: 'Steam Engine', roadName: '', _tab: 'Lionel PW - Items' };
const o9099   = { itemNum: '9099', _era: 'pw',        yearProd: '1955', itemType: 'Boxcar', roadName: '', _tab: 'Lionel PW - Items' };
const ho9099  = { itemNum: '9099', _era: 'lionel_ho', yearProd: '1959', itemType: 'Boxcar', roadName: '', _tab: 'Lionel HO - Items' };
const state = { masterData: [pre238, post238, ho9099, o9099], masterByItem: new Map([['238', [pre238, post238]], ['9099', [ho9099, o9099]]]) };
let wizard = { data: {}, matchedItem: null, tab: 'collection' };
const window = { _wizPeriodOfRow: null };
const ERA_TABS = {};

// ── load the real functions ─────────────────────────────────────────────
eval(grab(wiz, '_wizPeriodOfYear'));
eval(grab(wiz, '_wizPeriodOfRow'));
eval(grab(wiz, '_wizScaleOfRow'));
eval(grab(wiz, '_wizMasterPrefer'));
eval(grab(wiz, '_wizPickMasterRow'));
eval(grab(wiz, '_wizRowFitsFilters'));
eval(grab(dat, '_mIsMotive'));
eval(grab(dat, '_mSuffix'));
eval(grab(dat, '_letterKinRows'));
eval(grab(dat, '_findMasterCore'));
const _lkCache = new WeakMap();
window._wizPeriodOfRow = _wizPeriodOfRow;
function baseItemNum(n) { return String(n || '').replace(/-?[PDTC]$/i, ''); }

let fails = 0;
function T(name, got, want) {
  const ok = got === want;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + '  -> ' + got + (ok ? '' : '  (wanted ' + want + ')'));
  if (!ok) fails++;
}

// ── CANARY 1: the 238 era collision ─────────────────────────────────────
wizard.data = { _searchFilterPeriod: 'postwar' };
T('238 pick: Postwar filter -> 1963 row', _wizPickMasterRow('238').yearProd, '1963-64');
wizard.data = { _searchFilterPeriod: 'prewar' };
T('238 pick: Prewar filter -> 1936 row', _wizPickMasterRow('238').yearProd, '1936-1940');
wizard.data = { _typedSearchPeriod: 'postwar' };
T('238 pick: TYPED postwar -> 1963 row', _wizPickMasterRow('238').yearProd, '1963-64');
wizard.data = { _searchFilterPeriod: 'postwar' };
T('predicate: prewar row fails Postwar filter', _wizRowFitsFilters(pre238), false);
T('predicate: postwar row passes', _wizRowFitsFilters(post238), true);
T('findMaster core: period hint -> 1963 row',
  _findMasterCore(state.masterByItem, '238', null, { period: 'postwar' }).yearProd, '1963-64');
T('findMaster core: no hint -> load order (documented)',
  _findMasterCore(state.masterByItem, '238', null, null).yearProd, '1936-1940');

// ── CANARY 2: the 9099 scale collision ──────────────────────────────────
wizard.data = { _searchFilterScale: 'O' };
T('9099 pick: Scale O -> O row', _wizPickMasterRow('9099')._era, 'pw');
wizard.data = { _searchFilterScale: 'HO' };
T('9099 pick: Scale HO -> HO row', _wizPickMasterRow('9099')._era, 'lionel_ho');
T('predicate: O row fails HO filter', _wizRowFitsFilters(o9099), false);
T('findMaster core: scale hint HO -> HO row',
  _findMasterCore(state.masterByItem, '9099', null, { scale: 'HO' })._era, 'lionel_ho');
T('findMaster core: scale hint O -> O row',
  _findMasterCore(state.masterByItem, '9099', null, { scale: 'O' })._era, 'pw');

// ── no-filter behavior unchanged ────────────────────────────────────────
wizard.data = {};
T('no filters: predicate passes everything', _wizRowFitsFilters(pre238) && _wizRowFitsFilters(ho9099), true);
T('no filters: 238 pick unchanged (first row)', _wizPickMasterRow('238').yearProd, '1936-1940');

// ── CANARY 3 (v0.9.1501, task #27): invisible filters stay out ──────────
const cfg = fs.readFileSync(path.join(__dirname, '..', 'app', 'config.js'), 'utf8');
const bar = fs.readFileSync(path.join(__dirname, '..', 'app', 'barcode.js'), 'utf8');
const ERAS = { prewar: { manufacturer: 'Lionel' }, pw: { manufacturer: 'Lionel' }, lionel_ho: { manufacturer: 'Lionel' } };
function rrEraOfRow(r) { return (r && r._era) || ''; }
function rrSameScale(a, b) { return String(a).toUpperCase() === String(b).toUpperCase(); }
function _itemEraPeriod(r) { return _wizPeriodOfRow(r); }
let rrActiveFilter = function () { return { era: '', label: 'Any O', manufacturer: '', scale: 'O', years: '' }; };
eval(grab(cfg, 'rrSplitByFilter'));
const sp = rrSplitByFilter([pre238, post238, ho9099, o9099]);
T('split under O filter: nothing vanishes', sp.inEra.length + sp.offEra.length, 4);
T('split under O filter: HO row demoted, present', sp.offEra.some(r => r._era === 'lionel_ho'), true);
eval(grab(bar, '_rrFilterHits'));
T('scan hits: order untouched by global filter', _rrFilterHits([ho9099, o9099])[0]._era, 'lionel_ho');
_currentEra = 'pw';
wizard.data = { _fromInbox: true };
T('inbox add: global era ignored (load order)', _wizPickMasterRow('238').yearProd, '1936-1940');
wizard.data = {};
T('plain add: global era still honored', _wizPickMasterRow('238').yearProd, '1963-64');

// ── CANARY 4 (v0.9.1730): the letter stamped on the car ─────────────────
// Brad's Erie boxcar read as "3830 — Flatcar with Operating Submarine". The
// scanner HAD read 6454 off the car; the master files that family under the
// car-side mark X6454, and the only plain 6454 in the whole catalog is Atlas.
// So the postwar lookup missed, the era filter correctly refused the Atlas
// row, and the reader went on to assemble a number out of loose digits.
//
// The bridge must do exactly two things, and the second matters as much as
// the first: find the car, and NEVER hand back a letter-prefixed lookalike
// when the plain number is real in the catalog being asked about.
ERA_TABS.pw = { items: 'Lionel PW - Items' };
ERA_TABS.atlas = { items: 'Atlas O' };
const PWTAB = 'Lionel PW - Items', ATTAB = 'Atlas O';
const at6454a = { itemNum: '6454', _era: 'atlas', _tab: ATTAB, variation: '', itemType: 'Boxcar', roadName: 'Undecorated' };
const at6454b = { itemNum: '6454', _era: 'atlas', _tab: ATTAB, variation: '2', itemType: 'Boxcar', roadName: '' };
const x6454br = { itemNum: 'X6454', _era: 'pw', _tab: PWTAB, variation: '1', itemType: 'Boxcar', roadName: 'Baby Ruth' };
const x6454er = { itemNum: 'X6454', _era: 'pw', _tab: PWTAB, variation: '8', itemType: 'Boxcar', roadName: 'Erie' };
const x6454bx = { itemNum: 'X6454', _era: 'pw', _tab: 'Lionel PW - Boxes', variation: '', itemType: 'Paper / Box / Misc', roadName: '' };
// The counter-example: 430 exists BOTH as a real postwar item and as an
// L-prefixed lamp. Someone who types 430 must keep getting the 430.
const pw430   = { itemNum: '430', _era: 'pw', _tab: PWTAB, variation: '', itemType: 'Accessory', roadName: '' };
const l430    = { itemNum: 'L430', _era: 'pw', _tab: PWTAB, variation: '', itemType: 'Lamp', roadName: '' };
// And 191: NO plain postwar row, so the lamp IS the answer there.
const l191    = { itemNum: 'L191', _era: 'pw', _tab: PWTAB, variation: '', itemType: 'Lamp', roadName: '' };
const pre191  = { itemNum: '191', _era: 'prewar', _tab: 'Lionel Prewar - Items', variation: '', itemType: 'Villa', roadName: '' };
const X = new Map([
  ['6454', [at6454a, at6454b]],
  ['X6454', [x6454br, x6454er, x6454bx]],
  ['430', [pw430]],
  ['L430', [l430]],
  ['191', [pre191]],
  ['L191', [l191]],
  ['1234567', []],
]);
const PW = { era: 'pw' }, AT = { era: 'atlas' }, MFR = { manufacturer: 'Lionel' };
const fmX = (n, v, p) => _findMasterCore(X, n, v, p);

T('6454 + Postwar -> a postwar row at all', (fmX('6454', null, PW) || {})._era, 'pw');
T('6454 + Postwar -> the X6454 spelling', (fmX('6454', null, PW) || {}).itemNum, 'X6454');
T('6454 + Postwar + variation 8 -> the Erie car', (fmX('6454', '8', PW) || {}).roadName, 'Erie');
T('6454 + Postwar + variation 1 -> Baby Ruth', (fmX('6454', '1', PW) || {}).roadName, 'Baby Ruth');
T('6454 + maker hint Lionel -> postwar row', (fmX('6454', null, MFR) || {})._era, 'pw');
T('X6454 typed outright still resolves', (fmX('X6454', null, PW) || {}).itemNum, 'X6454');
T('X6454 typed + variation 8 -> Erie', (fmX('X6454', '8', PW) || {}).roadName, 'Erie');

// ── the half that protects what already works ───────────────────────────
T('6454 with NO hint -> Atlas, exactly as before', (fmX('6454', null, null) || {})._era, 'atlas');
T('6454 + Atlas -> Atlas, untouched', (fmX('6454', null, AT) || {})._era, 'atlas');
T('6454 + Atlas -> plain spelling, not X', (fmX('6454', null, AT) || {}).itemNum, '6454');
T('430 + Postwar -> the real 430, NOT the L430 lamp', (fmX('430', null, PW) || {}).itemType, 'Accessory');
T('430 + Postwar -> plain spelling', (fmX('430', null, PW) || {}).itemNum, '430');
T('430 with no hint -> the real 430', (fmX('430', null, null) || {}).itemNum, '430');
T('191 + Postwar -> lamp (no plain postwar 191 exists)', (fmX('191', null, PW) || {}).itemNum, 'L191');
T('191 with no hint -> prewar villa, bridge stays out', (fmX('191', null, null) || {}).itemNum, '191');
T('unknown number invents nothing', fmX('9999', null, PW), null);
T('unknown number invents nothing (no hint)', fmX('9999', null, null), null);

// ── the helper's own edges ──────────────────────────────────────────────
T('kin of 6454 = the three X6454 rows', _letterKinRows(X, '6454').length, 3);
T('kin of 430 = the one lamp', _letterKinRows(X, '430').length, 1);
T('kin lookup is not fooled by a letter key', _letterKinRows(X, 'X6454').length, 0);
T('kin of a 7-digit run: none', _letterKinRows(X, '1234567').length, 0);
T('kin of a single digit: none', _letterKinRows(X, '4').length, 0);
T('kin of empty: none', _letterKinRows(X, '').length, 0);
T('kin of a missing index: none', _letterKinRows(null, '6454').length, 0);
T('repeat call is stable (cache)', _letterKinRows(X, '6454').length, 3);
T('repeat lookup is stable (cache)', (fmX('6454', null, PW) || {}).itemNum, 'X6454');

// ── the Photo Inbox names its catalogs as a LIST, not one era ───────────
T('eras:[pw] -> the postwar car', (fmX('6454', null, { eras: ['pw'] }) || {}).itemNum, 'X6454');
T('eras:[pw] + maker -> the postwar car',
  (fmX('6454', null, { eras: ['pw'], manufacturer: 'Lionel' }) || {}).itemNum, 'X6454');
T('eras:[atlas] -> Atlas, bridge stays out',
  (fmX('6454', null, { eras: ['atlas'] }) || {}).itemNum, '6454');
// A catalog the bridge cannot satisfy adds NOTHING — it does not reach into
// a neighbouring era to find something. The plain bucket is returned exactly
// as it always was, and the caller's own era gate is what refuses it (that
// gate lives in the Photo Inbox, and it is what produced "In another maker's
// catalog: 6454:atlas" in the first place).
T('eras:[prewar] -> bridge adds nothing, plain bucket unchanged',
  (fmX('6454', null, { eras: ['prewar'] }) || {}).itemNum, '6454');
T('eras:[prewar] -> no postwar row smuggled in',
  (fmX('6454', null, { eras: ['prewar'] }) || {})._era, 'atlas');
T('eras:[pw] on 430 -> the real 430, not the lamp',
  (fmX('430', null, { eras: ['pw'] }) || {}).itemNum, '430');
T('eras:[] behaves as no hint', (fmX('6454', null, { eras: [] }) || {})._era, 'atlas');
T('maker Lionel alone cannot reach an Atlas-only number',
  fmX('9999', null, { manufacturer: 'Lionel' }), null);

// ── the REAL object, exactly as _pinPreferOf builds it ──────────────────
// Inferring this shape from the outside is what went wrong on v1721, so it
// is pinned here verbatim: a photo tagged "Lionel Postwar · O" arrives with
// era AND eras AND manufacturer all three set, and a scale that must not
// disturb anything. The Boxes tab also starts with "Lionel", so the ranking
// has to put the Items row on top or Brad gets an empty box for a boxcar.
const LIVE = { era: 'pw', eras: ['pw'], manufacturer: 'Lionel', label: 'Lionel Postwar · O',
               years: '', scale: '', period: 'postwar', type: '', _fromFilter: false };
T('live prefer -> the postwar car', (fmX('6454', null, LIVE) || {}).itemNum, 'X6454');
T('live prefer -> the ITEMS row, not the box', (fmX('6454', null, LIVE) || {})._tab, PWTAB);
T('live prefer -> a boxcar, not paper', (fmX('6454', null, LIVE) || {}).itemType, 'Boxcar');
T('live prefer + variation 8 -> Erie', (fmX('6454', '8', LIVE) || {}).roadName, 'Erie');
T('live prefer on 430 -> the real 430', (fmX('430', null, LIVE) || {}).itemNum, '430');
T('live prefer invents nothing', fmX('9999', null, LIVE), null);
// An untagged photo arrives as null, or as a type-only object with everything
// else blank. Neither may start reaching for letter-prefixed rows.
T('untagged photo (null) -> unchanged', (fmX('6454', null, null) || {})._era, 'atlas');
const TYPEONLY = { era: '', eras: [], manufacturer: '', label: '', years: '', scale: '', type: 'Boxcar', _fromFilter: true };
T('type-only prefer -> unchanged', (fmX('6454', null, TYPEONLY) || {})._era, 'atlas');

// ── the earlier canaries must be unchanged by all of the above ──────────
T('regression: 238 period hint still 1963',
  _findMasterCore(state.masterByItem, '238', null, { period: 'postwar' }).yearProd, '1963-64');
T('regression: 238 no hint still load order',
  _findMasterCore(state.masterByItem, '238', null, null).yearProd, '1936-1940');
T('regression: 9099 scale hint still HO',
  _findMasterCore(state.masterByItem, '9099', null, { scale: 'HO' })._era, 'lionel_ho');

console.log(fails ? ('\n' + fails + ' CANARY FAILURE(S) — a lookup path regressed.') : '\nALL CANARIES GREEN');
process.exit(fails ? 1 : 0);
