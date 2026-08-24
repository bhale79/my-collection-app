// ═══════════════════════════════════════════════════════════════
// import_photo_tests.js — Session 85. Photos travel WITH the import.
//
// Brad's decisions (S85, over Lyle's fullnumber.xlsx — 2,052 bare .JPG
// filenames in a 'photo' column, all unique):
//   · photos import DURING the import, never later ("that can become
//     a mess") — one atomic job, one batch id, undo removes BOTH
//   · mapping the photo column pulls a required drag-the-folder step
//     into the flow; matching is case-insensitive EXACT filename
//   · photo column detected but NOT mapped → explicit warning, then
//     rows-only
//
// Run:  node tests/import_photo_tests.js
// Proven to FAIL on v0.9.1574 (commit 9795634) before the build.
// ═══════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const core = require('../app/import-core.js');
const uiSrc = fs.readFileSync(path.join(__dirname, '..', 'app', 'import-ui.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('PASS  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
  else { fail++; console.log('FAIL  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
}

// ── 1. The mapper knows a photo column when it reads one ────────
{
  const m = core.rrImpHeuristicMap(['Item #', 'photo', 'Condition']);
  ok("header 'photo' maps to photoFile (Lyle's exact header)", m.map['photo'] === 'photoFile');
  const m2 = core.rrImpHeuristicMap(['Photo Filename', 'Image', 'Picture']);
  ok("'Photo Filename' maps too", m2.map['photo filename'] === 'photoFile');
  ok("second photo-ish column stays unmapped (one column per field)",
     m2.unmapped.length === 2 || Object.values(m2.map).filter(f => f === 'photoFile').length === 1);
  const m3 = core.rrImpHeuristicMap(['Description']);
  ok("'Description' is NOT a photo column", Object.values(m3.map).indexOf('photoFile') < 0);
}

// ── 2. A mapped photo column flows into the staged item ─────────
{
  const tab = { name: 'T', headers: ['Item #', 'photo'], rows: [
    { cells: ['6017', 'ZW250.JPG'], rowIdx: 2 },
    { cells: ['2343', ''], rowIdx: 3 },
  ]};
  const items = core.rrImpApplyMapping(tab, { 'item': 'itemNum', 'photo': 'photoFile' });
  const withP = items.filter(i => i.photoFile);
  ok('photoFile value rides the staged item', withP.length === 1 && withP[0].photoFile === 'ZW250.JPG');
}

// ── 3. Detection: a photo-shaped column that was NOT mapped ─────
{
  ok('rrImpPhotoishShare exists', typeof core.rrImpPhotoishShare === 'function');
  const _sh = core.rrImpPhotoishShare || function () { return -1; };
  const s = _sh(['ZW250.JPG', 'UCS.jpg', 'SPBLUE.png', 'no ext', '']);
  ok('share counts only filename-shaped values', s > 0.7 && s <= 0.76, s);
  ok('descriptions do not read as photos',
     _sh(['Boxcar red', 'Tank car', 'Flatcar w/ logs']) === 0);
  ok('rrImpPhotoColumnCandidates exists', typeof core.rrImpPhotoColumnCandidates === 'function');
  const tab = { name: 'T', headers: ['Item #', 'photo'], rows: [
    { cells: ['6017', 'ZW250.JPG'], rowIdx: 2 },
    { cells: ['2343', 'VW.jpg'], rowIdx: 3 },
    { cells: ['2360', 'LTC.JPG'], rowIdx: 4 },
  ]};
  const _pc = core.rrImpPhotoColumnCandidates || function () { return []; };
  const cands = _pc(tab, { 'item': 'itemNum' });
  ok('unmapped photo column is detected and named', cands.length === 1 && /photo/i.test(cands[0].header));
  const none = _pc(tab, { 'item': 'itemNum', 'photo': 'photoFile' });
  ok('…and NOT flagged once the user maps it', none.length === 0);
}

// ── 4. Matching: exact filename, case-insensitive, shared files ─
{
  ok('rrImpPhotoIndex exists', typeof core.rrImpPhotoIndex === 'function');
  ok('rrImpPhotoMatch exists', typeof core.rrImpPhotoMatch === 'function');
  const _pi = core.rrImpPhotoIndex || function () { return {}; };
  const _pmch = core.rrImpPhotoMatch || function () { return { matched: [], missingNames: [], unclaimedNames: [] }; };
  const idx = _pi([
    { name: 'zw250.jpg' }, { name: 'Sub/SPBLUE.JPG' }, { name: 'extra.png' }, { name: 'not-an-image.txt' },
  ]);
  const items = [
    { srcTab: 'T', srcRow: 2, photoFile: 'ZW250.JPG' },     // case differs from disk
    { srcTab: 'T', srcRow: 3, photoFile: 'SPBLUE.JPG' },    // file sits in a subfolder
    { srcTab: 'T', srcRow: 4, photoFile: 'SPBLUE.JPG' },    // second row, same photo
    { srcTab: 'T', srcRow: 5, photoFile: 'MISSING.JPG' },   // named but not in folder
    { srcTab: 'T', srcRow: 6 },                              // no photo named
  ];
  const r = _pmch(items, idx);
  ok('case-insensitive exact match', r.matched.some(m => m.item.srcRow === 2));
  ok('subfolder files match by BASENAME', r.matched.some(m => m.item.srcRow === 3));
  ok('two rows naming one file BOTH match it (quantity pattern)',
     r.matched.filter(m => /spblue/i.test(m.key)).length === 2);
  ok('matched count = 3', r.matched.length === 3, r.matched.length);
  ok('named-but-not-found is reported', r.missingNames.length === 1 && /missing/i.test(r.missingNames[0]));
  ok('in-folder-but-unclaimed is reported', r.unclaimedNames.length === 1 && /extra/i.test(r.unclaimedNames[0]));
  ok('non-image files never enter the index', !idx['not-an-image.txt']);
}

// ── 5. The AI mapper is offered the field too ───────────────────
{
  const p = core.rrImpBuildAiPayload([{ name: 'T', headers: ['photo'], rows: [] }], [], null);
  ok('AI appFields includes photoFile', (p.appFields || []).indexOf('photoFile') >= 0);
}

// ── 6. UI wiring (source-level, the house pattern) ──────────────
ok('the mapping dropdown has a label for photoFile', /photoFile:\s*'Photo filename/i.test(uiSrc));
ok('…and plain-English help', /_IMP_FIELD_HELP[\s\S]{0,2000}photoFile:/.test(uiSrc));
ok('preview no longer jumps straight to write — the photos step gates it',
   /onclick="_impToPhotosOrWrite\(\)">Import ' \+ ws\.length/.test(uiSrc) &&
   !/onclick="_impWrite\(\)">Import ' \+ ws\.length/.test(uiSrc));
ok('the photos step exists', /_impStepPhotos/.test(uiSrc));
ok('skipping the folder carries the warning Brad specced',
   /cannot be imported automatically later|can.t be imported automatically later/i.test(uiSrc));
ok('the write uploads through the ONE Drive uploader (no second pipeline)',
   /driveUploadItemPhoto\(/.test(uiSrc));
ok('each upload is journaled for undo', /photoIds/.test(uiSrc));
ok('undo trashes the uploaded photos (removes BOTH)',
   /rrImportUndo[\s\S]{0,3000}trashed:\s*true/.test(uiSrc));
ok('the batch record is written BEFORE the write so a partial import stays removable',
   /_impRecordBatch\s*\(/.test(uiSrc));
ok('an interrupted write is detected on the next open',
   /lv_imp_active/.test(uiSrc));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) { console.log('IMPORT-PHOTO TESTS FAILING'); process.exit(1); }
console.log('ALL IMPORT-PHOTO TESTS GREEN (' + pass + ')');
