// ══ tests/offline_photo_honesty_tests.js ═══════════════════════════════════
//
// v0.9.1592 (Session 87, the offline audit): a photo a user attached must
// NEVER vanish behind a bare console.warn. The audit found two silent
// swallows (Quick Entry, Manual save) and one confusing late toast (the
// wizard attach path, which spoke sheet-words about a Drive upload). These
// checks pin the honest behavior into the source the way §224/§296 do:
// the guard must exist, sit BEFORE the machinery it protects, and the old
// silent patterns must stay gone.
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}
const rd = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');

// ── 1. the wizard attach path refuses offline BEFORE the spinner dance ──
const wp = rd('wizard-photos.js');
const fnStart = wp.indexOf('async function uploadWizardPhoto');
const fnSeg = wp.slice(fnStart, fnStart + 9000);   // wide: the thumbnail/zone work sits between guard and counter
const guardAt = fnSeg.search(/window\._offlineMode \|\| \(typeof navigator !== 'undefined' && navigator\.onLine === false\)/);
const counterAt = fnSeg.indexOf('_photoUploadsInFlight');
ok('uploadWizardPhoto has the dual offline check', guardAt >= 0, 'no guard in the function');
ok('...and it sits BEFORE the in-flight counter, not after the failure',
   guardAt >= 0 && counterAt > guardAt, 'guard at ' + guardAt + ', counter at ' + counterAt);
ok('...and it speaks about PHOTOS, not sheets',
   /photos can\\u2019t upload right now/.test(fnSeg.slice(guardAt, guardAt + 500)), '');

// ── 2. Quick Entry: the silent swallow is gone ──
const qe = rd('wizard-quickentry.js');
const qeBlock = qe.slice(qe.indexOf('_qePhotoFile'), qe.indexOf('_qeEstWorth'));
ok('QE: the photo block checks offline before trying',
   /window\._offlineMode \|\|/.test(qeBlock), '');
ok('QE: a failed photo upload TOASTS, in the same catch that warns',
   /catch\s*\(photoErr\)\s*\{[\s\S]{0,400}showToast\(/.test(qeBlock), '');
ok('QE: the old silent catch (console.warn alone) is gone',
   !/catch\s*\(photoErr\)\s*\{\s*console\.warn\([^)]*\);\s*\}/.test(qeBlock), '');

// ── 3. Manual save: the silent swallow is gone ──
const ws = rd('wizard-save.js');
const wsAt = ws.indexOf("d._drivePhotos && d._drivePhotos.length > 0");
const wsBlock = ws.slice(wsAt, wsAt + 1600);
ok('Manual: the photo block checks offline before trying',
   /window\._offlineMode \|\|/.test(wsBlock), '');
ok('Manual: a failed photo upload TOASTS',
   /catch\s*\(e\)\s*\{[\s\S]{0,400}showToast\(/.test(wsBlock), '');
ok('Manual: the old one-line silent catch is gone',
   !/catch\s*\(e\)\s*\{ console\.warn\('\[Manual\] Photo upload failed:', e\); \}/.test(ws), '');

// ── 4. both say how to recover, in the same words ──
ok('both name the recovery: add it from the item’s page',
   /item\\u2019s page/.test(qeBlock) && /item\\u2019s page/.test(wsBlock), '');

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
