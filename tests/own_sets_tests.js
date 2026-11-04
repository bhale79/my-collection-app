/**
 * own_sets_tests.js  — v0.9.x
 *
 * Verifies the "My set isn't listed" (own-set) feature:
 *   – wizard step insertion and skipIf logic
 *   – _startOwnSet() callback sets the right data flags
 *   – _quickEntrySaveSet() branches correctly on isOwnSet
 *   – saveSet() branches correctly on isOwnSet
 *   – app-pages.js My Sets block: title/subtitle/badge/openFn
 *   – non-item-detail-config.js editFields function: Set # locked/unlocked
 *   – app-collection.js resolves editFields as function
 *
 * Each test must be able to FAIL when a planted offender is present.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const APP = path.resolve(__dirname, '../app');

function readApp(name) {
  return fs.readFileSync(path.join(APP, name), 'utf8');
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('  PASS  ' + name);
    passed++;
  } catch (e) {
    console.log('  FAIL  ' + name);
    console.log('        ' + e.message);
    failed++;
  }
}

// ── 1. wizard-steps.js ──────────────────────────────────────────────────────
console.log('\nwizard-steps.js');
const stepsSource = readApp('wizard-steps.js');

test('set_ownInfo step is defined', () => {
  assert.ok(stepsSource.includes("id: 'set_ownInfo'"), 'set_ownInfo step missing');
});

test('set_ownInfo type is ownSetInfo', () => {
  assert.ok(stepsSource.includes("type: 'ownSetInfo'"), "type 'ownSetInfo' missing");
});

test('set_ownInfo has skipIf referencing _ownSet', () => {
  assert.ok(stepsSource.includes('skipIf: d => !d._ownSet'), 'skipIf !d._ownSet missing');
});

test('set_ownInfo comes before set_entryMode in source order', () => {
  const iOwn = stepsSource.indexOf("id: 'set_ownInfo'");
  const iEntry = stepsSource.indexOf("id: 'set_entryMode'");
  assert.ok(iOwn > 0, 'set_ownInfo not found');
  assert.ok(iEntry > 0, 'set_entryMode not found');
  assert.ok(iOwn < iEntry, 'set_ownInfo must appear before set_entryMode');
});

// planted-offender proof
test('[proof] missing set_ownInfo is detected', () => {
  const planted = stepsSource.replace("id: 'set_ownInfo'", "id: 'set_REMOVED'");
  assert.ok(!planted.includes("id: 'set_ownInfo'"), 'offender not removed');
});

// ── 2. wizard.js ────────────────────────────────────────────────────────────
console.log('\nwizard.js');
const wizSource = readApp('wizard.js');

test('"My set isn\'t listed" button is rendered', () => {
  assert.ok(wizSource.includes("My set isn’t listed"), 'button text missing');
});

test('_startOwnSet sets _ownSet = true', () => {
  assert.ok(wizSource.includes('wizard.data._ownSet = true'), '_ownSet = true missing');
});

test('_startOwnSet sets _setGroupId with OWN- prefix', () => {
  assert.ok(wizSource.includes("'OWN-' + Date.now()"), '_setGroupId OWN- prefix missing');
});

test('_startOwnSet copies _enteredNums into _setFinalItems', () => {
  assert.ok(wizSource.includes('wizard.data._setFinalItems = [...(wizard.data._enteredNums || [])]'),
    '_setFinalItems copy missing');
});

test('ownSetInfo render block exists', () => {
  assert.ok(wizSource.includes("s.type === 'ownSetInfo'"), "ownSetInfo render branch missing");
});

test('ownSetInfo sets _searchFilterManufacturer from _ownSetMaker', () => {
  assert.ok(
    wizSource.includes('_searchFilterManufacturer') && wizSource.includes('_ownSetMaker'),
    '_searchFilterManufacturer / _ownSetMaker wiring missing'
  );
});

// ── 3. wizard-save.js ───────────────────────────────────────────────────────
console.log('\nwizard-save.js');
const saveSource = readApp('wizard-save.js');

test('_quickEntrySaveSet: isOwnSet declared', () => {
  // Both save functions declare isOwnSet; the first occurrence is _quickEntrySaveSet
  assert.ok(saveSource.includes('const isOwnSet = !!d._ownSet'), 'isOwnSet declaration missing');
});

test('_quickEntrySaveSet: setId uses OWN-SET for own sets', () => {
  assert.ok(saveSource.includes("isOwnSet ? 'OWN-SET'"), "OWN-SET branch missing");
});

test('_quickEntrySaveSet: setName uses _ownSetName for own sets', () => {
  assert.ok(saveSource.includes("isOwnSet ? (d._ownSetName || '')"), '_ownSetName branch missing');
});

test('saveSet: year uses _ownSetYear for own sets', () => {
  assert.ok(saveSource.includes('isOwnSet ? (d._ownSetYear || \'\')'), '_ownSetYear branch missing');
});

test('saveSet: state.mySetsData setName uses isOwnSet branch', () => {
  // Both occurrences exist; ensure at least one is present for state.mySetsData
  const idx = saveSource.indexOf('state.mySetsData[');
  assert.ok(idx >= 0, 'state.mySetsData[ not found');
  // After that point, _ownSetName must appear in the setName value
  const afterMs = saveSource.slice(idx);
  assert.ok(afterMs.includes("isOwnSet ? (d._ownSetName || '')"),
    'state.mySetsData setName isOwnSet branch missing');
});

// ── 4. app-pages.js ─────────────────────────────────────────────────────────
console.log('\napp-pages.js');
const pagesSource = readApp('app-pages.js');

test('"Your set" badge is added for own sets', () => {
  assert.ok(pagesSource.includes("extras.unshift('Your set')"), "Your set badge missing");
});

test('My Sets openFn calls showNonItemDetailPage', () => {
  assert.ok(pagesSource.includes("showNonItemDetailPage('sets',"), 'openFn missing or wrong');
});

test('My Sets title falls back to setName then (unnamed set)', () => {
  assert.ok(pagesSource.includes("s.setNum || s.setName || '(unnamed set)'"),
    'title fallback to setName / (unnamed set) missing');
});

test('My Sets subtitle shows setName when both setNum and setName present', () => {
  assert.ok(pagesSource.includes('(s.setNum && s.setName) ? s.setName'),
    'subtitle setName conditional missing');
});

test('[proof] missing "Your set" badge is detected', () => {
  const planted = pagesSource.replace("extras.unshift('Your set')", '// REMOVED');
  assert.ok(!planted.includes("extras.unshift('Your set')"), 'offender not removed');
});

// ── 5. non-item-detail-config.js ────────────────────────────────────────────
console.log('\nnon-item-detail-config.js');
const cfgSource = readApp('non-item-detail-config.js');

test('sets editFields is a function', () => {
  assert.ok(cfgSource.includes('editFields: function(e) {'), 'editFields is not a function');
});

test('Set # locked only when setId !== OWN-SET', () => {
  assert.ok(cfgSource.includes("locked: !(e.setId === 'OWN-SET')"),
    'OWN-SET lock condition missing');
});

test('[proof] plain-array editFields is detected', () => {
  // If someone reverted to a plain array, the function form would be missing
  const planted = cfgSource.replace('editFields: function(e) {', 'editFields: [');
  assert.ok(!planted.includes('editFields: function(e) {'), 'offender not removed');
});

// ── 6. app-collection.js ────────────────────────────────────────────────────
console.log('\napp-collection.js');
const colSource = readApp('app-collection.js');

test('guard uses !cfg.editFields (not Array.isArray)', () => {
  assert.ok(colSource.includes('if (!cfg || !cfg.editFields)'), 'guard not updated');
  assert.ok(!colSource.includes('Array.isArray(cfg.editFields)'), 'old Array.isArray guard still present');
});

test('_editFields resolved with typeof check in render path', () => {
  assert.ok(
    colSource.includes("var _editFields = typeof cfg.editFields === 'function' ? cfg.editFields(entry)"),
    '_editFields resolution missing in render path'
  );
});

test('render forEach uses _editFields', () => {
  assert.ok(colSource.includes('_editFields.forEach(function(f)'), '_editFields.forEach missing in render');
});

test('_ef resolved in _saveNonItemEdit', () => {
  assert.ok(
    colSource.includes("var _ef = typeof cfg.editFields === 'function' ? cfg.editFields(entry)"),
    '_ef resolution missing in _saveNonItemEdit'
  );
});

test('_saveNonItemEdit forEach uses _ef', () => {
  assert.ok(colSource.includes('_ef.forEach(function(f)'), '_ef.forEach missing in _saveNonItemEdit');
});

// ── Summary ─────────────────────────────────────────────────────────────────
console.log('\n────────────────────────────────');
console.log('Own-sets tests: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
