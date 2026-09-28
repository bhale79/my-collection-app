// ══ tests/crop_flash_recorder_tests.js ═════════════════════════════════════
//
// v0.9.1700 (Session 93) put a recorder in the crop screen instead of guessing
// at Brad's phone flash a sixth time; v0.9.1826 made its diary ride the
// account file; the diary named the cause (12 MP redrawn on every nudge) and
// v0.9.1827 fixed it. [stated] Brad, 2026-09-28: "yes it works."
//
// v0.9.1830: THE RECORDER IS GONE — the Session 94 rule ("delete it once Brad
// confirms the crop screen is smooth"). This file, which used to hold the
// recorder honest, now proves it STAYS gone: no recorder code, nothing that
// writes or reads its diary key, the problem report no longer prints it, and
// the key is on drive.js's retired list so it leaves the account file too.
// (The file keeps its name because the deploy route adds and updates files;
// it does not delete them. A tombstone with teeth beats a stale suite.)
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}
const APP = path.join(__dirname, '..', 'app');
const code = s => s.replace(/(^|[^:'"`])\/\/[^\n]*/gm, (m, pre) => pre);   // full-line and trailing // comments off; strings kept
const pc = code(fs.readFileSync(path.join(APP, 'photo-crop.js'), 'utf8'));
const er = code(fs.readFileSync(path.join(APP, 'error-report.js'), 'utf8'));
const dr = fs.readFileSync(path.join(APP, 'drive.js'), 'utf8');
const every = fs.readdirSync(APP).filter(f => /\.js$/.test(f)).map(f => ({ f, src: code(fs.readFileSync(path.join(APP, f), 'utf8')) }));

// ── the recorder is gone ──────────────────────────────────────────────────
ok('no recorder code is left in photo-crop.js (_flashStart / _flashStop / _flashRec / _flashLabel)',
   !/_flashStart|_flashStop|_flashRec\b|_flashLabel|_rrFlashStop/.test(pc), '');
ok('…nor the v1826 restamp helper', !/_flashRestampOld/.test(pc), '');
ok('…and the crop screen opens and closes without it (the two flags it hung off are still there)',
   /window\._rrCropOpen = true;/.test(pc) && /window\._rrCropOpen = false;/.test(pc), '');
ok('nothing in the app writes or reads the diary key any more (drive.js retires it — that is the one mention allowed)',
   every.every(x => x.f === 'drive.js' ? true : !/rr_crop_flash/.test(x.src)), every.filter(x => x.f !== 'drive.js' && /rr_crop_flash/.test(x.src)).map(x => x.f).join(','));
ok('the problem report no longer collects or prints it', !/cropFlash|CROP FLASH DIARY/.test(er), '');
ok('the key is on the retired list, so it leaves every device AND the account file',
   /const PREFS_RETIRED = \['rr_crop_flash'\];/.test(dr) && /function _prefsRetire\(remotePrefs\)/.test(dr), '');
ok('the retired-word count in drive.js is the list + the helper\'s use of it, nothing else', (dr.match(/PREFS_RETIRED/g) || []).length === 2, String((dr.match(/PREFS_RETIRED/g) || []).length));

// ── what replaced it stays ───────────────────────────────────────────────
ok('the fix the recorder earned is still in place: the crop screen works on a screen-sized copy',
   /function _rrCropPreview\(img, max, cb\)/.test(pc) && /_rrCropPreview\(img, _RR_CROP_MAX,/.test(pc), '');
ok('…and the history is written where the next reader will see it (measure first)',
   /RETIRED in v0\.9\.1830/.test(fs.readFileSync(path.join(APP, 'photo-crop.js'), 'utf8')) && /measure first/.test(fs.readFileSync(path.join(APP, 'photo-crop.js'), 'utf8')), '');

// ── planted offenders ────────────────────────────────────────────────────
ok('OFFENDER 1: a recorder call creeping back into photo-crop.js -> red', /_flashStart|_flashStop/.test(pc + "\n  try { _flashStart(ov, _phone); } catch (eF) {}"), '');
ok('OFFENDER 2: a diary read creeping back into the problem report -> red', /cropFlash|CROP FLASH DIARY/.test(er + "\n    try { c.cropFlash = localStorage.getItem('rr_crop_flash'); } catch (e) {}"), '');
ok('OFFENDER 3 (negative): the word in a comment is not a hit', !/rr_crop_flash/.test(code("// the old rr_crop_flash diary")), '');

console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
