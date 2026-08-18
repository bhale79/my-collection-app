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
eval(grab(dat, '_findMasterCore'));
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

console.log(fails ? ('\n' + fails + ' CANARY FAILURE(S) — a lookup path regressed.') : '\nALL CANARIES GREEN');
process.exit(fails ? 1 : 0);
