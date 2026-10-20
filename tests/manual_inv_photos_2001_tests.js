// ═══════════════════════════════════════════════════════════════
// manual_inv_photos_2001_tests.js — v0.9.2001. A MANUAL ENTRY IS SAVED UNDER
// THE INVENTORY NUMBER ITS PHOTOS WERE FILED UNDER.
//
// Found while tidying Brad's Drive (2026-10-19): five manual entries had their
// photos in an inventory folder ONE BELOW the saved row — the I. C. RR Lantern
// is 307 with its photos in "306"; RMT-92499-402 305 → "304"; 30-9107
// 159 → "158"; Pittman 157 → "156"; 6-24177 153 → "152". The photo step takes
// the number at the first photo (wizard-photos.js, d._photoInventoryId) and
// _saveManualEntry took a fresh one. Brad: "yes" to the fix.
//
// The REAL _saveManualEntry is sliced out of wizard-save.js and run with the
// Sheets / Drive / screen calls stubbed (each stub named below); what is
// asserted is the inventory number the row and the in-memory record carry.
// Run:  node tests/manual_inv_photos_2001_tests.js
// ═══════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'app', 'wizard-save.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}

function slice(src) {
  const a = src.indexOf('async function _saveManualEntry()');
  const b = src.indexOf('// Save Science Set or Construction Set', a);
  if (a < 0 || b < 0) throw new Error('_saveManualEntry not found');
  return src.slice(a, b);
}

// Runs the real save. nextInventoryId is a stand-in that hands out the next
// number each call, like the real one (it never re-issues a number).
async function save(src, data) {
  let next = 307;
  const rows = [];
  const state = { personalData: {}, personalSheetId: 'SHEET' };
  const fn = new Function('wizard', 'state', 'nextInventoryId', 'buildPersonalRow', 'sheetsAppend', 'rrSavedRecord',
    '_stampSaved', '_cachePersonalData', 'closeWizard', 'showToast', 'buildDashboard', 'renderBrowse',
    '_normalizeEnteredItemNum', '_composeItemName', '_rrUserFieldValues', 'driveUploadItemPhoto',
    'PERSONAL_TAB', 'PERSONAL_FIELD_INDEX', 'window', 'navigator',
    slice(src) + '\nreturn _saveManualEntry;');
  const run = fn(
    { data: data, tab: 'collection' }, state,
    function () { return String(next++); },
    function (o) { rows.push(o); return o; },                // buildPersonalRow: hand back the fields
    async function () { return 42; },                         // sheetsAppend: the row it landed on
    function (row, n, fill) { return Object.assign({}, fill); },
    function () {}, function () {}, function () {}, function () {}, function () {}, function () {},
    function (n) { return String(n || '').trim(); },
    function () { return 'Composed Name'; },
    function () { return {}; },
    async function () { return ''; },
    'My Collection', { priceComplete: 'priceComplete', notes: 'notes' },
    {}, { onLine: true });
  await run();
  return { state: state, rows: rows };
}

(async function () {
  console.log('\n== The saved number is the photos\' number ==');
  {
    // The photo step took 306 at the first photo; the save must use it.
    const r = await save(SRC, { manualItemNum: 'I. C. RR Lantern', _photoInventoryId: '306',
      manualPhotos: { FV: 'https://drive.google.com/drive/folders/X' } });
    ok('1 a manual entry with photos saves under the photos\' number (306, not 307)',
       r.rows[0] && r.rows[0].inventoryId === '306' && Object.keys(r.state.personalData).join() === '306',
       JSON.stringify({ row: r.rows[0] && r.rows[0].inventoryId, mem: Object.keys(r.state.personalData) }));
    ok('2 …and the in-memory record carries the same number', r.state.personalData['306'] && r.state.personalData['306'].inventoryId === '306');
  }
  {
    const r = await save(SRC, { manualItemNum: '30-9107' });
    ok('3 a manual entry with no photos still takes a fresh number', r.rows[0].inventoryId === '307');
  }
  {
    const r = await save(SRC, { manualItemNum: '30-9107', _existingInventoryId: '159', _photoInventoryId: '160' });
    ok('4 an existing copy\'s number wins, the same order as the catalog save', r.rows[0].inventoryId === '159');
  }
  {
    const r = await save(SRC, { manualItemNum: 'X', _photoInventoryId: 306 });
    ok('5 the number is saved as text, like every other inventory id', r.rows[0].inventoryId === '306' && typeof r.rows[0].inventoryId === 'string');
  }

  console.log('\n== Planted offender ==');
  {
    const NEW = 'const invId = String(d._existingInventoryId || d._photoInventoryId || nextInventoryId());';
    ok('P setup: the fixed line is in wizard-save.js exactly once', SRC.split(NEW).length === 2);
    const old = SRC.replace(NEW, 'const invId = nextInventoryId();');
    const r = await save(old, { manualItemNum: 'I. C. RR Lantern', _photoInventoryId: '306',
      manualPhotos: { FV: 'https://drive.google.com/drive/folders/X' } });
    ok('P the old line saves 307 while the photos sit in 306 (test 1 catches it)', r.rows[0].inventoryId === '307');
  }

  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.log('  FAIL  suite crashed: ' + (e && e.stack)); process.exit(1); });
