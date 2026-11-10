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
// 2026-11-02: the one "same number" check the picker asks (6-8359 = 8359)
{ const _sug0 = fs.readFileSync(path.join(__dirname, '..', 'app', 'wizard-suggestions.js'), 'utf8');
  eval(grab(_sug0, 'rrNumLinePrefixOff').replace('function rrNumLinePrefixOff', 'global.rrNumLinePrefixOff = function'));
  eval(grab(_sug0, 'rrNumSameAsTyped').replace('function rrNumSameAsTyped', 'global.rrNumSameAsTyped = function')); }
eval(grab(wiz, '_wizSameNum'));
eval(grab(wiz, '_wizPickMasterRow'));
eval(grab(wiz, '_wizRowFitsFilters'));
eval(grab(wiz, '_wizAddFilters'));   // 2026-11-01: the filters _wizRowFitsFilters / _wizPickMasterRow answer to
eval(grab(dat, '_mIsMotive'));
eval(grab(dat, '_mSuffix'));
eval(grab(dat, '_letterKinRows'));
eval(grab(dat, '_findMasterCore'));
// 2026-11-07 (onerow): the ONE "is this row the thing itself?" rule + the era cleaner findMaster now asks
eval(require('./lib/row-kind').rowKindSource());
// 2026-11-05: the leading-zero bridge (PLAN_2026-11-05_LEADING_ZEROS) — a new lookup path, so it is here
const _app0 = fs.readFileSync(path.join(__dirname, '..', 'app', 'app.js'), 'utf8');
eval(grab(_app0, 'rrNumZeroKey')); eval(grab(_app0, 'rrNumZeroTwin'));
eval(grab(dat, '_zeroKinRows'));
const _zkCache = new WeakMap();
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
  // a plain number whose own row is already a real item — the gate must not
  // loosen for it, so it proves the v1731 change is narrow
  ['6456', [{ itemNum: '6456', _era: 'pw', _tab: PWTAB, variation: '', itemType: 'Hopper', roadName: 'Lehigh Valley' }]],
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

// ── CANARY 5 (v0.9.1731): a car is not its own empty box ────────────────
// Found by running v1730 against the REAL 165,044-row master, not by reading
// it: five cars were still wrong. X2458, X3464, X3474, X4454 and X6004 each
// have a real boxcar under the X spelling, but the PLAIN number already sits
// in "Lionel PW - Boxes" as a Paper / Box / Misc row. v1730's gate asked "has
// this catalog ANY row for this number?", the box said yes, and a photo of the
// car resolved to the empty box it came in.
//
// The counter-case is the whole reason this is delicate: someone who OWNS the
// box must still get the box. A personal row carries its own itemType, so the
// guard has something real to read.
const BOXTAB = 'Lionel PW - Boxes';
ERA_TABS.pw.boxes = BOXTAB;
const box3464 = { itemNum: '3464', _era: 'pw', _tab: BOXTAB, variation: 'A', itemType: 'Box', roadName: '' };
const car3464 = { itemNum: 'X3464', _era: 'pw', _tab: PWTAB, variation: '1', itemType: 'Boxcar', roadName: 'New York Central' };
X.set('3464', [box3464]);
X.set('X3464', [car3464]);
// Real getTypeBucket, not a stub: the first attempt here used
// rrNormalizeTypeToBucket, which passes "Box" through unchanged and silently
// disarmed the guard. The test must be able to catch that again.
const tg = fs.readFileSync(path.join(__dirname, '..', 'app', 'type-groups.js'), 'utf8');
const _tgWin = {}; (function (window) { eval(tg); })(_tgWin);
const getTypeBucket = _tgWin.getTypeBucket;
T('sanity: the classifier folds Box onto paper', getTypeBucket({ itemType: 'Box' }), 'Paper / Box / Misc');
T('sanity: it does not fold Boxcar onto paper', getTypeBucket({ itemType: 'Boxcar' }), 'Boxcar');

T('3464 tagged postwar -> the CAR, not the box', (fmX('3464', null, LIVE) || {}).itemNum, 'X3464');
T('3464 tagged postwar -> the Items tab', (fmX('3464', null, LIVE) || {})._tab, PWTAB);
T('3464 tagged postwar -> a Boxcar', (fmX('3464', null, LIVE) || {}).itemType, 'Boxcar');
T('3464 by era list alone -> the car', (fmX('3464', null, { eras: ['pw'] }) || {}).itemNum, 'X3464');

// ── and the half that protects the box owner ────────────────────────────
const OWNSBOX = { era: 'pw', itemType: 'Box' };
T('owner of the BOX still gets the box', (fmX('3464', null, OWNSBOX) || {}).itemNum, '3464');
T('owner of the BOX gets the Boxes tab', (fmX('3464', null, OWNSBOX) || {})._tab, BOXTAB);
T('photo tagged type Box -> the box',
  (fmX('3464', null, { era: 'pw', eras: ['pw'], manufacturer: 'Lionel', type: 'Box' }) || {}).itemNum, '3464');
T('photo tagged type Service Manual -> still paper-side',
  (fmX('3464', null, { era: 'pw', type: 'Service Manual' }) || {}).itemNum, '3464');
T('owner of the CAR (itemType Boxcar) gets the car',
  (fmX('3464', null, { era: 'pw', itemType: 'Boxcar' }) || {}).itemNum, 'X3464');
T('3464 with NO hint at all -> unchanged, the plain row', (fmX('3464', null, null) || {}).itemNum, '3464');

// A number whose plain row IS already a real item must not be disturbed: the
// gate only loosens for paper, never for items.
T('6456 untouched: plain row is a real item', (fmX('6456', null, LIVE) || {}).itemNum, '6456');

// ── CANARY 6 (v0.9.1880): the saved ROW ID — the link two products never share ──
// Lionel Pre-War No. 800, no variation, is the 1904 2-7/8" motor car AND the
// 1915 O-gauge boxcar; the old link (era|number|variation) opened the first.
// The REAL findMaster, lifted with its Row ID helpers. Full coverage:
// tests/row_id_tests.js (D) and tests/row_id_collection_tests.js.
{
  const parts = ['function rrMasterKeyOf(', 'function rrMasterByKey(', 'function rrMasterRowIdOf(', 'function _rrIndexByRowId(',
    'function rrMasterByRowId(', 'function _rrRowIdFits(', 'function findMaster(', 'function _preferEraOf(', 'function _rrRealRowsOf('].map(n => grab(dat, n.replace(/^function /, '').replace(/\($/, '')))
    .concat([require('./lib/row-kind').rowKindSource()]);   // 2026-11-07 (onerow)
  const motor = { itemNum: '800', variation: '', _era: 'prewar', _tab: 'Lionel Pre-War', itemType: 'Motorized Unit', rowId: 'MMMMMMMMMM' };
  const boxO  = { itemNum: '800', variation: '', _era: 'prewar', _tab: 'Lionel Pre-War', itemType: 'Boxcar', rowId: 'BBBBBBBBBB' };
  const st6 = { masterByItem: new Map([['800', [motor, boxO]]]), masterByItemAll: null };
  const fm6 = new Function('state', 'ERA_TABS', 'baseItemNum', '_findMasterCore', parts.join('\n')
    + '\nstate.masterByRowId = _rrIndexByRowId([motor, boxO]); return findMaster;'.replace('[motor, boxO]', 'Array.from(state.masterByItem.get("800"))'))
    (st6, { prewar: { items: 'Lionel Pre-War' } }, baseItemNum, (idx, n) => ((idx && idx.get(String(n))) || [])[0] || null);
  T('Row ID: the boxcar collector gets the BOXCAR, not the first 800',
    (fm6('800', '', { masterKey: 'prewar|800|', masterRowId: 'BBBBBBBBBB', era: 'prewar' }) || {}).itemType, 'Boxcar');
  T('Row ID: the key alone still opens the first row (unchanged)',
    (fm6('800', '', { masterKey: 'prewar|800|', era: 'prewar' }) || {}).itemType, 'Motorized Unit');
  T('Row ID: an ID that resolves to nothing falls back, never guesses past the key',
    (fm6('800', '', { masterKey: 'prewar|800|', masterRowId: 'ZZZZZZZZZZ', era: 'prewar' }) || {}).itemType, 'Motorized Unit');
}

// ── CANARY 7 (2026-11-01): No. 1511 under every maker / era pick ────────
// Brad: "i want the filters to actually filter. if there is no 1511 for lionel
// postwar, nothing shows up". 1511 is real on Lionel Pre-War (2 rows),
// American Models S, S-Helper S, Atlas O (1511-1/-2), Atlas HO, Weaver O — and
// NOT on Lionel Postwar. The scorer and the one filter test must never answer
// outside the filters (the old escapes handed back the Pre-War row, then
// American Models'). The maker word is the REAL rrRowMakerWord.
{
  const sug = fs.readFileSync(path.join(__dirname, '..', 'app', 'wizard-suggestions.js'), 'utf8');
  eval(grab(sug, 'rrRowMakerWord'));
  eval(grab(sug, '_wizResolveAddRow'));
  global.ERAS7 = { prewar: 'Lionel', pw: 'Lionel', am_s: 'American Models', shelper: 'S-Helper Service', atlas: 'Atlas', atlas_ho: 'Atlas', weaver: 'Weaver' };
  global._manufacturerOfItem = function (r) { return r && ERAS7[r._era] ? ERAS7[r._era].toLowerCase() : null; };
  global._brandLabel = function (k) { return k ? String(k).replace(/\b\w/g, c => c.toUpperCase()) : ''; };
  const r1511 = [
    { itemNum: '1511', _era: 'prewar', yearProd: '1936-37', itemType: 'Steam Locomotive', _tab: 'Lionel Pre-War' },
    { itemNum: '1511', _era: 'prewar', yearProd: '1936-37', itemType: 'Set', _tab: 'Lionel Pre-War' },
    { itemNum: '1511', _era: 'am_s', yearProd: '1995', itemType: 'Boxcar', _tab: 'American Models S' },
    { itemNum: '1511', _era: 'shelper', yearProd: '2001', itemType: 'Hopper', _tab: 'S-Helper Service S' },
    { itemNum: '1511', _era: 'atlas_ho', yearProd: '2004', itemType: 'Boxcar', _tab: 'Atlas HO' },
  ];
  const saveMD = state.masterData;
  state.masterData = r1511.concat(saveMD);
  const pick = (d) => { wizard.data = d; wizard.matchedItem = null; return _wizPickMasterRow('1511'); };
  T('1511: Lionel + Postwar -> nothing', pick({ _searchFilterManufacturer: 'Lionel', _searchFilterPeriod: 'postwar' }), null);
  T('1511: Lionel + Pre-War -> the Pre-War row', (pick({ _searchFilterManufacturer: 'Lionel', _searchFilterPeriod: 'prewar' }) || {})._era, 'prewar');
  T('1511: American Models -> the American Models row', (pick({ _searchFilterManufacturer: 'American Models' }) || {})._era, 'am_s');
  T('1511: S-Helper Service + Modern -> the S-Helper row', (pick({ _searchFilterManufacturer: 'S-Helper Service', _searchFilterPeriod: 'modern' }) || {})._era, 'shelper');
  T('1511: Atlas + Scale O -> nothing (only Atlas HO here)', pick({ _searchFilterManufacturer: 'Atlas', _searchFilterScale: 'O' }), null);
  T('1511: Era All + Lionel -> a Lionel row', (pick({ _searchFilterManufacturer: 'Lionel' }) || {})._era, 'prewar');
  T('1511: typed "lionel" word with Postwar -> nothing', pick({ _typedSearchMfr: 'Lionel', _searchFilterPeriod: 'postwar' }), null);
  // the held row is let go when it no longer fits — never kept "rather than fail"
  wizard.data = { _searchFilterManufacturer: 'Lionel', _searchFilterPeriod: 'postwar' };
  wizard.matchedItem = r1511[0];
  T('1511: a held Pre-War row under Lionel + Postwar -> resolver gives nothing', _wizResolveAddRow('1511'), null);
  wizard.data = { _searchFilterManufacturer: 'Lionel', _searchFilterPeriod: 'prewar' };
  T('1511: the held row stays while it fits', _wizResolveAddRow('1511'), r1511[0]);
  wizard.data = { _searchFilterManufacturer: 'Lionel', _searchFilterPeriod: 'postwar', _fromInbox: true };
  T('1511: an inbox add keeps its photo-tag rule (no Add filters)', _wizResolveAddRow('1511'), r1511[0]);
  T('predicate: maker filter refuses another maker', _wizRowFitsFilters(r1511[2], { mfr: 'Lionel', period: '', type: '', scale: '', road: '' }), false);
  state.masterData = saveMD;
  wizard.data = {}; wizard.matchedItem = null;
}

// ── the earlier canaries must be unchanged by all of the above ──────────
T('regression: 238 period hint still 1963',
  _findMasterCore(state.masterByItem, '238', null, { period: 'postwar' }).yearProd, '1963-64');
T('regression: 238 no hint still load order',
  _findMasterCore(state.masterByItem, '238', null, null).yearProd, '1936-1940');
T('regression: 9099 scale hint still HO',
  _findMasterCore(state.masterByItem, '9099', null, { scale: 'HO' })._era, 'lionel_ho');

// ── CANARY: the leading zero (2026-11-05) — 022 and 22 are two Lionel items;
// S-Helper's 01511 sits in the catalog as 1511 until step 2 puts the zero back.
{
  const pw022 = { itemNum: '022', _era: 'pw', _tab: 'Lionel PW - Items', itemType: 'Track' };
  const pw22  = { itemNum: '22',  _era: 'pw', _tab: 'Lionel PW - Items', itemType: 'Track' };
  const sh    = { itemNum: '1511', _era: 'shelper', _tab: 'S-Helper Service S', itemType: 'Reefer' };
  const Z = new Map([['022', [pw022]], ['22', [pw22]], ['1511', [sh]]]);
  T('zero: 022 stays 022', (_findMasterCore(Z, '022', null, null) || {}).itemNum, '022');
  T('zero: 22 stays 22', (_findMasterCore(Z, '22', null, null) || {}).itemNum, '22');
  T('zero: 01511 (nothing exact) -> the 1511 twin', (_findMasterCore(Z, '01511', null, null) || {})._tab, 'S-Helper Service S');
  T('zero: 01511 with Postwar named -> nothing', _findMasterCore(Z, '01511', null, { eras: ['pw'] }), null);
}

// ── CANARY: Ross Custom Switches (rosstab, 2026-11-05) — a new catalog, so its
// collisions are here: Ross's 902 Mating Pins and Lionel's 902 Elevated Trestle,
// Ross's 120 and Lionel's 120 Super-O crossing, and Ross's own 0100 / 100 pair.
// Rows as the live master holds them (tests/fixtures/rosstab_tabs_2026-11-05.json).
{
  const L902 = { itemNum: '902', _era: 'pw', _tab: 'Lionel PW - Items', itemType: 'Accessory', description: 'Elevated Trestle Set' };
  const R902 = { itemNum: '902', _era: 'ross', _tab: 'Ross Custom Switches', itemType: 'Accessory', description: '#902 Gauge Mating Pins' };
  const L120 = { itemNum: '120', _era: 'pw', _tab: 'Lionel PW - Items', itemType: 'Track', description: 'Super-O 90-Degree Crossing' };
  const R120 = { itemNum: '120', _era: 'ross', _tab: 'Ross Custom Switches', itemType: 'Track', description: 'Ross 120' };
  const R0100 = { itemNum: '0100', _era: 'ross', _tab: 'Ross Custom Switches', itemType: 'Track', description: 'Ross 0100' };
  const R100 = { itemNum: '100', _era: 'ross', _tab: 'Ross Custom Switches', itemType: 'Track', description: 'Ross 100' };
  const X = new Map([['902', [L902, R902]], ['120', [L120, R120]], ['0100', [R0100]], ['100', [R100]]]);
  ERA_TABS.pw = { items: 'Lionel PW - Items' }; ERA_TABS.ross = { items: 'Ross Custom Switches' };   // as config.js names them
  global.ERAS7.ross = 'Ross Custom Switches';                                                         // canary 7's maker map, + Ross
  T('ross: 902 + maker Ross -> the Ross row', (_findMasterCore(X, '902', null, { manufacturer: 'Ross Custom Switches' }) || {})._era, 'ross');
  T('ross: 902 + maker Lionel -> the Lionel row', (_findMasterCore(X, '902', null, { manufacturer: 'Lionel' }) || {})._era, 'pw');
  T('ross: 902 + Postwar named -> the Lionel row', (_findMasterCore(X, '902', null, { era: 'pw' }) || {})._era, 'pw');
  T('ross: 902 + Ross named -> the Ross row', (_findMasterCore(X, '902', null, { era: 'ross' }) || {})._era, 'ross');
  T('ross: 120 + Ross named -> the Ross row', (_findMasterCore(X, '120', null, { era: 'ross' }) || {})._era, 'ross');
  T('ross: 120 + Postwar named -> the Lionel row', (_findMasterCore(X, '120', null, { era: 'pw' }) || {})._era, 'pw');
  const Y = new Map([['902', [R902, L902]]]);   // Ross FIRST in load order — the answers must not move
  T('ross: 902, Ross loaded first, maker Lionel -> still Lionel', (_findMasterCore(Y, '902', null, { manufacturer: 'Lionel' }) || {})._era, 'pw');
  T('ross: 902, Ross loaded first, Postwar named -> still Lionel', (_findMasterCore(Y, '902', null, { era: 'pw' }) || {})._era, 'pw');
  T('ross: 0100 stays 0100', (_findMasterCore(X, '0100', null, { era: 'ross' }) || {}).itemNum, '0100');
  T('ross: 100 stays 100', (_findMasterCore(X, '100', null, { era: 'ross' }) || {}).itemNum, '100');
  // the Add list's pick under the maker filter
  const saveMD = state.masterData; state.masterData = [L902, R902];
  wizard.data = { _searchFilterManufacturer: 'Ross Custom Switches' };
  T('ross: Add pick 902 under maker Ross -> the Ross row', (_wizPickMasterRow('902') || {})._era, 'ross');
  wizard.data = { _searchFilterManufacturer: 'Lionel' };
  T('ross: Add pick 902 under maker Lionel -> the Lionel row', (_wizPickMasterRow('902') || {})._era, 'pw');
  state.masterData = saveMD; wizard.data = {}; delete ERA_TABS.pw; delete ERA_TABS.ross;
}

// ── CANARY: stdmodern C2 (2026-11-08) — a saved Lionel copy whose row is gone ──
// MTH's licensed Lionel Corporation Tinplate trains live ONCE, on the MTH tab,
// "Also Sold As: Lionel Corporation"; the copies on Lionel MPC-Modern are to be
// deleted (PLAN_2026-11-08_LIONEL_STANDARD_MODERN, Part B). A collector's saved
// copy still names Lionel modern (era mpc / masterKey / masterRowId). 58 of
// those numbers also exist on MTH O, which loads FIRST. The REAL findMaster,
// both layers (tests/lib/findmaster-real.js); full coverage: stdmodern_tests.js.
{
  const { buildFindMaster } = require('./lib/findmaster-real');
  const E = { mpc: { manufacturer: 'Lionel' }, mth_o: { manufacturer: 'MTH' }, mth_tinplate: { manufacturer: 'MTH' } };
  const ET = { mpc: { items: 'Lionel MPC-Modern' }, mth_o: { items: 'MTH O' }, mth_tinplate: { items: 'MTH Tinplate' } };
  const tin = { itemNum: '11-1005', variation: '', _era: 'mth_tinplate', _tab: 'MTH Tinplate', itemType: 'Steam Locomotive', alsoSoldAs: 'Lionel Corporation', rowId: 'TTTTTTTTTT', yearProd: '2004' };
  const mo  = { itemNum: '11-1005', variation: '', _era: 'mth_o', _tab: 'MTH O', itemType: 'Boxcar', rowId: 'OOOOOOOOOO', yearProd: '2006' };
  const lio = { itemNum: '11-1005', variation: '', _era: 'mpc', _tab: 'Lionel MPC-Modern', itemType: 'Steam Locomotive', rowId: 'LLLLLLLLLL', yearProd: '' };
  const pd = { itemNum: '11-1005', variation: '', era: 'mpc', manufacturer: 'Lionel', masterKey: 'mpc|11-1005|', masterRowId: 'LLLLLLLLLL' };
  const datS = fs.readFileSync(path.join(__dirname, '..', 'app', 'app-data.js'), 'utf8');
  const run = (dat) => ({
    one: buildFindMaster({ layer1: [mo, tin], eras: E, eraTabs: ET, dat }).findMaster('11-1005', '', pd),
    two: buildFindMaster({ layer1: [mo], layer2: [mo, tin], eras: E, eraTabs: ET, dat }).findMaster('11-1005', '', pd),
    kept: buildFindMaster({ layer1: [mo, tin, lio], eras: E, eraTabs: ET, dat }).findMaster('11-1005', '', pd),
    bare: buildFindMaster({ layer1: [mo, tin], eras: E, eraTabs: ET, dat }).findMaster('11-1005', '', null),
  });
  const R = run(datS);
  T('C2: Lionel copy, its row gone -> the MTH row sold as Lionel', (R.one || {})._era, 'mth_tinplate');
  T('C2: …from the whole-catalog layer when MTH Tinplate is not loaded', (R.two || {})._era, 'mth_tinplate');
  T('C2: the saved row still there -> that row, unchanged', (R.kept || {})._era, 'mpc');
  T('C2: no copy named (number only) -> load order, unchanged', (R.bare || {})._era, 'mth_o');
  // PLANTED: findMaster / _findMasterCore without the rule
  const noRule = datS.replace("    if (_soldAsLive && _rrRowSoldAsEra(m, _prefSoldEra)) b += 6;   // stdmodern C2\n", '')
    .replace("    if (_r2 && typeof _rrRowSoldAsEra === 'function' && !_rrRowSoldAsEra(_r, _want) && _rrRowSoldAsEra(_r2, _want)) return _r2;\n", '');
  T('C2 PLANT applied (the rule taken out)', noRule !== datS && noRule.indexOf('b += 6;   // stdmodern C2') < 0 && noRule.indexOf('_rrRowSoldAsEra(_r2, _want)') < 0, true);
  const P = run(noRule);
  T('C2 PLANTED: without the rule the copy lands on MTH O (caught)', (P.one || {})._era, 'mth_o');
  T('C2 PLANTED: …and from the whole-catalog layer too (caught)', (P.two || {})._era, 'mth_o');
}

// ── CANARY: zerobridge (2026-11-08) — a saved copy of a deleted book row ──
// [stated] Brad 20:17 CT "yes" (Q7 / Q8): the reference-book copies the master
// deletes wrote MTH's number without its ending (11-1005 vs MTH's 11-1005-0
// Traditional / 11-1005-1 Proto-Sound). A saved copy whose own row is gone lands
// on the keeper the delete record names (RR_BOOK_COPY_REDIRECT, config.js) — and
// stays there once a back-fill writes the keeper's Row ID. Real Row IDs; all 440
// Write-2 copies: zerobridge_tests.js.
{
  const { buildFindMaster } = require('./lib/findmaster-real');
  const E = { mpc: { manufacturer: 'Lionel' }, mth_o: { manufacturer: 'MTH' }, mth_tinplate: { manufacturer: 'MTH' }, atlas: { manufacturer: 'Atlas' } };
  const ET = { mpc: { items: 'Lionel MPC-Modern' }, mth_o: { items: 'MTH O' }, mth_tinplate: { items: 'MTH Tinplate' }, atlas: { items: 'Atlas O' } };
  const R = (n, era, tab, x) => Object.assign({ itemNum: n, variation: '', _era: era, _tab: tab, itemType: 'Steam Locomotive', yearProd: '2004' }, x || {});
  const t0 = R('11-1005-0', 'mth_tinplate', 'MTH Tinplate', { rowId: 'CU89458CGD', alsoSoldAs: 'Lionel Corporation' });
  const t1 = R('11-1005-1', 'mth_tinplate', 'MTH Tinplate', { rowId: 'N4KMFHZKYP', alsoSoldAs: 'Lionel Corporation' });
  const o1 = R('11-1038-1', 'mth_tinplate', 'MTH Tinplate', { rowId: '7CR22SR954', alsoSoldAs: 'Lionel Corporation' });   // MTH has no 11-1038-0
  const mo = R('11-2038-1', 'mth_o', 'MTH O', { rowId: 'BEVQWZQWZJ', alsoSoldAs: 'Lionel Corporation' });               // the keeper sits on MTH O
  const lio = R('11-1005', 'mpc', 'Lionel MPC-Modern', { rowId: 'MRBYH6C8FF', yearProd: '' });                            // the book copy (deleted)
  const lf = R('13100', 'mpc', 'Lionel MPC-Modern', { rowId: 'LIONEL1310' });                                              // the rest of Lionel modern
  const atl = R('1304-1', 'atlas', 'Atlas O', { rowId: 'ATLAS13041', itemType: 'Boxcar' });
  const ALL = [t0, t1, o1, mo, lf, atl];
  const pdL = { itemNum: '11-1005', variation: '', era: 'mpc', manufacturer: 'Lionel', masterKey: 'mpc|11-1005|', masterRowId: 'MRBYH6C8FF' };
  const pdT = { itemNum: '11-1038', variation: '', era: 'mth_tinplate', manufacturer: 'MTH', masterKey: 'mth_tinplate|11-1038|', masterRowId: '75Z5N8MR52' };
  const pdT2 = { itemNum: '11-2038', variation: '', era: 'mth_tinplate', manufacturer: 'MTH', masterKey: 'mth_tinplate|11-2038|', masterRowId: 'BVYK97W45R' };
  const pdA = { itemNum: '1304', variation: '', era: 'atlas', manufacturer: 'Atlas', masterKey: 'atlas|1304|', masterRowId: 'GONEATLAS1' };
  const datS = fs.readFileSync(path.join(__dirname, '..', 'app', 'app-data.js'), 'utf8');
  const id = r => (r ? r.rowId : null);
  const run = (dat) => {
    const F = buildFindMaster({ layer1: ALL, layer2: ALL, eras: E, eraTabs: ET, dat });
    return {
      lio: id(F.findMaster('11-1005', '', pdL)),
      lioOnly: id(buildFindMaster({ layer1: [lf], layer2: ALL, eras: E, eraTabs: ET, dat }).findMaster('11-1005', '', pdL)),
      kept: id(buildFindMaster({ layer1: ALL.concat([lio]), layer2: ALL.concat([lio]), eras: E, eraTabs: ET, dat }).findMaster('11-1005', '', pdL)),
      backfilled: id(F.findMaster('11-1005', '', Object.assign({}, pdL, { masterRowId: 'CU89458CGD', masterKey: 'mth_tinplate|11-1005-0|' }))),
      one: id(F.findMaster('11-1038', '', pdT)),
      cross: id(F.findMaster('11-2038', '', pdT2)),
      atlas: id(F.findMaster('1304', '', pdA)),
      edited: id(F.findMaster('11-1006', '', pdL)),
      noLink: id(F.findMaster('11-1005', '', { itemNum: '11-1005', era: 'mpc', manufacturer: 'Lionel' })),
    };
  };
  const Z = run(datS);
  T('zerobridge: Lionel copy 11-1005, its row gone -> MTH 11-1005-0 (Traditional), the record\'s keeper', Z.lio, 'CU89458CGD');
  T('zerobridge: …a Lionel-only collector (MTH from the whole catalog)', Z.lioOnly, 'CU89458CGD');
  T('zerobridge: the book row still there -> that row, unchanged', Z.kept, 'MRBYH6C8FF');
  T('zerobridge: the keeper\'s Row ID + Master Key back-filled -> still 11-1005-0', Z.backfilled, 'CU89458CGD');
  T('zerobridge: MTH Tinplate Greenberg copy 11-1038 (MTH has no -0) -> 11-1038-1', Z.one, '7CR22SR954');
  T('zerobridge: MTH Tinplate Greenberg copy 11-2038 -> its keeper on MTH O, 11-2038-1', Z.cross, 'BEVQWZQWZJ');
  T('zerobridge: an Atlas copy (not in the table) never reaches Atlas 1304-1', Z.atlas, null);
  T('zerobridge: the Lionel copy looked up under another number (an edit) -> not redirected', Z.edited, null);
  T('zerobridge: no saved link (not a saved copy) -> nothing, as today', Z.noLink, null);
  // PLANTED: findMaster without the table; _rrRowIdFits without the pair
  const noTable = datS.split('    if (_bcK) return _bcK;\n').join('');
  T('zerobridge PLANT applied (findMaster never asks the table)', noTable !== datS, true);
  const P = run(noTable);
  T('zerobridge PLANTED: the Lionel copy finds nothing (caught)', JSON.stringify([P.lio, P.lioOnly]), '[null,null]');
  T('zerobridge PLANTED: …and the MTH Tinplate copies too (caught)', JSON.stringify([P.one, P.cross]), '[null,null]');
  const noPair = datS.split("    return (typeof _rrBookCopyPairFits === 'function') && _rrBookCopyPairFits(row, _in, variation);\n").join('    return false;\n')
    .split("\n          || (typeof _rrBookCopyPairFits === 'function' && _rrBookCopyPairFits(_byKey, _in, variation))) return _byKey;").join('\n          ) return _byKey;');
  T('zerobridge PLANT applied (the back-filled pair refused)', noPair !== datS && noPair.indexOf('_rrBookCopyPairFits(row, _in') < 0 && noPair.indexOf('_rrBookCopyPairFits(_byKey') < 0, true);
  T('zerobridge PLANTED: the back-filled copy is stranded (caught)', run(noPair).backfilled, null);
}

console.log(fails ? ('\n' + fails + ' CANARY FAILURE(S) — a lookup path regressed.') : '\nALL CANARIES GREEN');
process.exit(fails ? 1 : 0);
