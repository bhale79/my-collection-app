// ══ tests/crop_flash_recorder_tests.js ═════════════════════════════════════
//
// v0.9.1700 (Session 93). Brad, Android phone, Photo Inbox (Quick Capture and
// re-crop; NOT the Add wizard): "when i go to crop any image on my phone it
// flashes constantly … the whole screen flashes, not just the picture … if
// you wait 30 seconds or so it will stop."
//
// This is the SECOND report of this bug. v0.9.1031 fixed it on a theory and
// it came back, so v0.9.1700 measures before it touches anything. These pins
// hold the recorder honest: cheap, phone-only, self-stopping, and private.
//
// WHEN THE CULPRIT IS NAMED, the recorder can be deleted — and this file with
// it. Leaving it running forever is not the plan.
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}
const pc = fs.readFileSync(path.join(__dirname, '..', 'app', 'photo-crop.js'), 'utf8');
const er = fs.readFileSync(path.join(__dirname, '..', 'app', 'error-report.js'), 'utf8');

// ── it costs nothing on a desktop, or when no crop screen is open ─────────
ok('the recorder only ever starts on a phone',
   /function _flashStart\(ov, phone\) \{\s*\n\s*if \(!phone \|\| _flashRec\) return;/.test(pc), '');
ok('…and only from the crop screen opening',
   /window\._rrCropOpen = true;\s*\n\s*try \{ _flashStart\(ov, _phone\);/.test(pc), '');
ok('…re-entry cannot start a second recorder',
   /if \(!phone \|\| _flashRec\) return;/.test(pc), '');

// ── it always stops: the thing that makes instrumentation safe to ship ────
ok('it stops when the crop screen closes',
   /function done\(\) \{[\s\S]{0,160}?_flashStop\('closed'\)/.test(pc), '');
ok('…and stops itself after 45 seconds even if nothing closes it',
   /setTimeout\(function \(\) \{ _flashStop\('45s cap'\); \}, 45000\)/.test(pc), '');
ok('…removing every listener it added',
   /removeEventListener\('resize', R\.hWin, true\)/.test(pc)
   && /vv\.removeEventListener\('resize', R\.hVvR\)/.test(pc)
   && /vv\.removeEventListener\('scroll', R\.hVvS\)/.test(pc), '');
ok('…disconnecting the observer',
   /if \(R\.mo\) R\.mo\.disconnect\(\)/.test(pc), '');
ok('…and UNWRAPPING the functions it wrapped, so nothing is left monkey-patched',
   /window\[fn\]\.__flashWrapped\) window\[fn\] = window\[fn\]\.__flashOrig/.test(pc), '');
ok('…and a double stop is a no-op',
   /if \(!R \|\| R\.stopped\) return;\s*\n\s*R\.stopped = true;/.test(pc), '');
ok('a wrapper is never applied twice over itself',
   /if \(typeof o !== 'function' \|\| o\.__flashWrapped\) return;/.test(pc), '');

// ── it stays small ────────────────────────────────────────────────────────
ok('the line list is capped',
   /if \(R\.lines\.length < 90\) R\.lines\.push\(s\)/.test(pc), '');
ok('a line is only written when a NUMBER actually changed',
   /if \(h !== R\.lastH \|\| vh !== R\.lastVV \|\| vt !== R\.lastTop \|\| bh !== R\.lastBody\)/.test(pc), '');
ok('what it stores is clipped before it reaches localStorage',
   /localStorage\.setItem\('rr_crop_flash', JSON\.stringify\(out\)\.slice\(0, 3200\)\)/.test(pc), '');

// ── it answers the actual question ────────────────────────────────────────
ok('it ignores the cropper’s own DOM work and watches only what is BEHIND',
   /if \(ov && t && ov\.contains\(t\)\) continue;/.test(pc), '');
ok('…ranking what changed behind the overlay',
   /Object\.keys\(R\.bucket\)\.sort\(/.test(pc), '');
ok('…and counting the named suspects by hand',
   /'_rrFitLogoBackdrop', '_wizOwnedRefresh', '_pinRenderBar', 'rrSyncPill'/.test(pc), '');
ok('…while recording the numbers that prove whether the URL bar moved',
   /innerH=/.test(pc) && /vvH=/.test(pc) && /vvTop=/.test(pc) && /bodyH=/.test(pc), '');

// ── privacy: this ships to a mailbox ──────────────────────────────────────
ok('labels are element names only — no attribute values, no text content',
   /function _flashLabel\(n\)/.test(pc) && !/textContent/.test(pc.slice(pc.indexOf('function _flashLabel'), pc.indexOf('function _flashStart'))), '');
ok('nothing about the image itself is recorded',
   !/\bsrc\b\s*:/.test(pc.slice(pc.indexOf('function _flashStart'), pc.indexOf('function _flashStop'))), '');

// ── it reaches Brad ───────────────────────────────────────────────────────
ok('the report collects it',
   /c\.cropFlash = \(localStorage\.getItem\('rr_crop_flash'\)/.test(er), '');
ok('…and PRINTS it (the v1611 mistake: collected but never printed)',
   /CROP FLASH DIARY/.test(er), '');
ok('…including the busiest-behind-the-overlay line, which is the answer',
   /busiest behind the overlay/.test(er), '');
ok('…and a report with no crop session prints no empty section',
   /if \(cf && cf\.head\) \{/.test(er), '');
ok('…and a torn or missing record cannot break the report',
   /catch \(eCF\) \{ cf = null; \}/.test(er), '');

console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
