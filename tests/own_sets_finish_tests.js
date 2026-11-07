#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════
// YOUR OWN SET, FINISHED — 2026-11-03   (Node, the REAL app code)
//
// [stated] Brad 16:46 CT: "the ability for users to add their own unlisted
// sets to My Sets is a real gap" → 17:04 CT "Yes" to PLAN_2026-11-03_OWN_SETS →
// v0.9.2105 shipped the "My set isn't listed" form (another chat) → 21:59 CT
// "yes" to finishing the plan on top of it.
// Measured on v0.9.2105 in the real app: an own set added through Full Entry
// (the only path) reached its final save with NO name, number or own-set mark
// (the per-piece walk rebuilt wizard.data and dropped them), the My Sets reader
// skipped that row, My Sets listed only catalog sets anyway, and the set's 2343
// was saved as Lionel's F3. Own tests of v0.9.2105 stay in own_sets_tests.js.
//
//   R  rrOwnSetRow: a piece of an own set takes only a row FROM THE SET'S MAKER;
//      another maker's row under the same number, or "Other / Unknown", gives none
//   K  rrCopyCatalogRow (app.js): a copy found by its era alone must agree with
//      the maker saved on it
//   G  rrMySetItems / rrMySetMaker: a set's pieces are the copies with its Group
//      ID; its maker is theirs; rrMySetIsOwn reads the Set ID
//   S  scans, each proven able to fail on a planted offender:
//      S1 My Sets files an own set (or a number the catalog lacks) apart from the
//         catalog sets, and lists it
//      S2 the Full Entry walk carries the set's own details (and its number and
//         condition) from piece to piece
//      S3 a piece of an own set is looked up only through rrOwnSetRow (Full and
//         Quick) and saved with no catalog link when it has no row
//      S4 the My Sets reader keeps a row with no set number
//      S5 the Item Type choice says "Lionel Postwar Set" (Brad 2026-11-04: put back; v2106's plain "Set" is retired)
//      S6 no catalog set picked → ONE way on, the own-set form
//      S7 the words live in config.js (RR_OWN_SETS), none says "AI"; removing a
//         set checks its Inventory ID
// The browser half (the real screens) is own_sets_finish_road_tests.js.
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
function code(src) {
  return src.replace(/(^|[\s;{}(),])\/\*[\s\S]*?\*\//g, '$1').replace(/(^|[^:/\\'"*])\/\/[^\n]*/g, '$1');
}

const CFG = read('config.js'), APPJS = read('app.js'), ADATA = read('app-data.js'), WSAVE = read('wizard-save.js');
const BROWSE = read('browse.js'), WIZ = read('wizard.js'), STEPS = read('wizard-steps.js');
const NIDC = read('non-item-detail-config.js'), COLL = read('app-collection.js');

const ctx = { console: { log() {}, warn() {}, error() {} }, setTimeout, clearTimeout,
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
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
    liftFn(APPJS, '_brandLabel'), liftFn(APPJS, '_brandOfItem'),
    liftFn(ADATA, '_preferEraOf'),
    require('./lib/row-kind').rowKindFnSource(),   // 2026-11-07 (onerow): _preferEraOf cleans the era word through _rrPreferEraKey
    makerOfSource(), liftFn(APPJS, 'rrMySetItems'), liftFn(APPJS, 'rrMySetMaker'),
    liftFn(WSAVE, 'rrIsOwnSetAdd'), liftFn(WSAVE, 'rrOwnSetRow'),
  ].join('\n'), ctx, { filename: 'lifted.js' });
} catch (e) { loaded = false; console.log('FAIL  the real pieces load into the sandbox  -> ' + e.message); fail++; }

// A catalog where numbers collide across makers, the way the real one does.
const ROWS = [
  { itemNum: '30-4000-1', variation: '', _era: 'mth_o', rowId: 'MTH4000' },
  { itemNum: '2343', variation: '', _era: 'pw', rowId: 'PW2343' },
  { itemNum: '6464', variation: '', _era: 'atlas', rowId: 'AT6464' },
];
if (loaded) {
  ctx.rrMasterByRowId = (id) => ROWS.find(r => r.rowId === id) || null;
  ctx.findMaster = (n, v, prefer) => {
    if (prefer && String(prefer.era || '') === 'Manual') return null;
    if (prefer && prefer.masterRowId) { const r = ctx.rrMasterByRowId(prefer.masterRowId); if (r && r.itemNum === n) return r; }
    const all = ROWS.filter(r => r.itemNum === String(n));
    const want = prefer && prefer.era;
    return (want && all.find(r => r._era === want)) || all[0] || null;   // a hint is a rank, not a filter
  };
}

section('R  a piece of an own set');
if (loaded) {
  ok('R1 an MTH set\'s MTH piece takes its MTH row', (ctx.rrOwnSetRow('30-4000-1', 'MTH') || {}).rowId === 'MTH4000');
  ok('R2 an MTH set\'s piece numbered like a Lionel postwar item gets NO row (not the Lionel F3)', ctx.rrOwnSetRow('2343', 'MTH') === null);
  ok('R3 a Lionel set\'s 2343 does take the Lionel row', (ctx.rrOwnSetRow('2343', 'Lionel') || {}).rowId === 'PW2343');
  ok('R4 "Other / Unknown" can check no row — none taken', ctx.rrOwnSetRow('30-4000-1', 'Other / Unknown') === null && ctx.rrOwnSetRow('2343', '') === null);
  ok('R5 a number the catalog lacks gets no row', ctx.rrOwnSetRow('30-7777-1', 'MTH') === null);
}

section('K  a copy found by its era alone agrees with its saved maker');
if (loaded) {
  ok('K1 an MTH piece saved with the screen\'s postwar era is NOT the Lionel 2343 row', ctx.rrCopyCatalogRow({ itemNum: '2343', era: 'pw', manufacturer: 'MTH' }) === null);
  ok('K2 …so it reads MTH, and counts as not tied to a catalog entry', ctx.rrMakerOf({ copy: { itemNum: '2343', era: 'pw', manufacturer: 'MTH' } }) === 'MTH'
     && ctx.rrCopyIsUnlinked({ itemNum: '2343', era: 'pw', manufacturer: 'MTH' }) === true);
  ok('K3 a Lionel copy of 2343 (era postwar) still finds its row', (ctx.rrCopyCatalogRow({ itemNum: '2343', era: 'pw', manufacturer: 'Lionel' }) || {}).rowId === 'PW2343');
  ok('K4 a copy with no maker saved still finds its era\'s row (nothing to disagree with)', (ctx.rrCopyCatalogRow({ itemNum: '2343', era: 'pw' }) || {}).rowId === 'PW2343');
  ok('K5 a saved Row ID answers regardless (the link is exact)', (ctx.rrCopyCatalogRow({ itemNum: '2343', masterRowId: 'PW2343', manufacturer: 'MTH' }) || {}).rowId === 'PW2343');
}

section('G  a set\'s pieces and maker');
if (loaded) {
  ctx.state = { personalData: {
    a: { owned: true, itemNum: '30-4000-1', era: 'mth_o', masterRowId: 'MTH4000', groupId: 'G1' },
    b: { owned: true, itemNum: '30-7777-1', era: 'pw', manufacturer: 'MTH', groupId: 'G1' },
    c: { owned: true, itemNum: '2343', era: 'pw', manufacturer: 'Lionel', groupId: 'G2' },
    d: { owned: false, itemNum: '30-1', groupId: 'G1' },
  } };
  const items = ctx.rrMySetItems({ groupId: 'G1' }).map(p => p.itemNum).sort().join(',');
  ok('G1 the pieces are the OWNED copies with the set\'s Group ID', items === '30-4000-1,30-7777-1', items);
  ok('G2 no Group ID → no pieces (never matched by number)', ctx.rrMySetItems({ setNum: '2343' }).length === 0);
  ok('G3 the set\'s maker is its pieces\' maker', ctx.rrMySetMaker({ groupId: 'G1' }) === 'MTH');
  ok('G4 no pieces → no maker, never Lionel', ctx.rrMySetMaker({ groupId: 'NONE' }) === '');
}

// ═══ S — scans ═══
section('S  scans');
{
  ok('G5 rrMySetIsOwn reads the own-set Set ID v0.9.2105 writes (OWN-SET), and no catalog one',
     loaded && ctx.rrMySetIsOwn({ setId: 'OWN-SET' }) && !ctx.rrMySetIsOwn({ setId: 'SET-1467W' }) && !ctx.rrMySetIsOwn({}) && !ctx.rrMySetIsOwn(null));
  ok('G6 an add is "own" only with no catalog set picked', loaded && ctx.rrIsOwnSetAdd({ _ownSet: true }) && !ctx.rrIsOwnSetAdd({ _ownSet: true, _resolvedSet: { setNum: '1' } }) && !ctx.rrIsOwnSetAdd({}));

  const SETS = code(BROWSE.slice(BROWSE.indexOf('function renderSetsTab('), BROWSE.indexOf('function renderCatalogsTab(')));
  const s1 = (src) => /if \(\(typeof rrMySetIsOwn === 'function' && rrMySetIsOwn\(ms\)\) \|\| !setKey \|\| !_catSetNums\.has\(setKey\)\) \{\s*ownRows\.push\(entry\);\s*return;\s*\}/.test(src)
                   && /\+ ownList\.map\(function \(e\)/.test(src) && /showNonItemDetailPage\(\\'sets\\',\\'' \+ rrJsArg\(k\)/.test(src);
  ok('S1 My Sets files an own set (or a number the catalog lacks) apart from the catalog sets, and lists it', s1(SETS));
  const p1 = code(plant(BROWSE.slice(BROWSE.indexOf('function renderSetsTab('), BROWSE.indexOf('function renderCatalogsTab(')),
    "if ((typeof rrMySetIsOwn === 'function' && rrMySetIsOwn(ms)) || !setKey || !_catSetNums.has(setKey)) {", "if (false) {", 'own rows filed as catalog'));
  ok('S1p …and catches own sets filed under catalog sets again', !s1(p1));

  const launch = WSAVE.slice(WSAVE.indexOf('function launchSetItemWizard('), WSAVE.indexOf('function launchSetItemWizard(') + 9000);
  const s2 = (l) => /const _setCarry = \{\s*set_num: d\.set_num, _setCondition: d\._setCondition,\s*\.\.\.\(_ownSet \? \{ _ownSet: true, _ownSetName: d\._ownSetName, _ownSetNum: d\._ownSetNum, _ownSetYear: d\._ownSetYear,\s*_ownSetMaker: d\._ownSetMaker, manualManufacturer: d\._ownSetMaker \} : \{\}\),/.test(l)
                  && /\.\.\._setCarry,/.test(l);
  ok('S2 the Full Entry walk carries the own set\'s name, number, year, maker — and every set\'s number and condition', s2(launch));
  ok('S2p …a walk that drops them again is caught', !s2(plant(launch, '    ..._setCarry,\n', '', 'carry dropped')));

  const quick = WSAVE.slice(WSAVE.indexOf('async function _quickEntrySaveSet('), WSAVE.indexOf('function launchSetItemWizard('));
  const s3 = (l, q, w) => /wizard\.matchedItem = _ownSet \? rrOwnSetRow\(itemNum, d\._ownSetMaker\)/.test(l)
    && /const master = isOwnSet \? rrOwnSetRow\(itemNum, d\._ownSetMaker\)/.test(q) && /_noCatalogRow: \(isOwnSet && !master\) \? true : undefined/.test(q)
    && /\(!d\._setMode \|\| rrIsOwnSetAdd\(d\)\) && !d\._updatePdKey/.test(w);
  ok('S3 a piece of an own set is looked up only through rrOwnSetRow (Full + Quick) and saved with no catalog link when it has none', s3(launch, quick, WSAVE));
  ok('S3p …the old number lookup put back is caught', !s3(plant(launch, 'wizard.matchedItem = _ownSet ? rrOwnSetRow(itemNum, d._ownSetMaker)', 'wizard.matchedItem = false ? 0', 'number lookup'), quick, WSAVE));

  ok('S4 the My Sets reader keeps a row with no set number (its name or Inventory ID keeps it)',
     /if \(!\(r\[0\] \|\| r\[1\] \|\| r\[13\]\) \|\| r\[0\] === 'Set Number'\) return;/.test(ADATA) && !/if \(!r\[0\] \|\| r\[0\] === 'Set Number'\) return;/.test(ADATA));

  // [stated] Brad 2026-11-04 05:18 CT "This should be left alone!" — the choice is the Lionel Postwar
  // set catalog; other makers' sets are "My Own Set — not in our catalogs" right under it (v0.9.2107).
  ok('S5 the Item Type choice says "Lionel Postwar Set" — and "My Own Set" sits beside it', /\{ id: 'set',\s+label: 'Lionel Postwar Set' \}/.test(WIZ) && /id: 'ownset',\s+label: 'My Own Set/.test(WIZ));

  const s6 = (w) => /if \(!_resolvedSet\) \{ window\._startOwnSet\(\); return; \}/.test(w) && /RR_OWN_SETS\.continueBtn/.test(w) && !/Continue without set ID/.test(code(w));
  ok('S6 no catalog set picked → one way on: the continue button opens the own-set form', s6(WIZ));
  ok('S6p …the old "Continue without set ID" path put back is caught', !s6(plant(WIZ, 'if (!_resolvedSet) { window._startOwnSet(); return; }', '', 'old path')));

  const words = CFG.slice(CFG.indexOf('const RR_OWN_SETS = {'), CFG.indexOf('window.RR_OWN_SETS = RR_OWN_SETS'));
  ok('S7 the words live in config.js (RR_OWN_SETS) and none says "AI"', words.length > 100 && !/\bAI\b/.test(words) && /RR_OWN_SETS\.listTag/.test(BROWSE));
  ok('S7b removing a set checks its Inventory ID, not only a number it may not have',
     /\{ num: entry\.setNum \|\| entry\.itemNum \|\| '', invId: entry\.inventoryId \|\| '' \}, 'sets list'/.test(BROWSE));
  ok('S7c a catalog set\'s popup and photo slots never take an own set by its number',
     /if \(typeof rrMySetIsOwn === 'function' && rrMySetIsOwn\(ms\)\) return false;/.test(COLL) && /!\(typeof rrMySetIsOwn === 'function' && rrMySetIsOwn\(e\)\)\)/.test(NIDC));
}

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  own_sets_finish_tests: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
