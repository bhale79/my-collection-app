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
ok('what it stores is clipped before it leaves the recorder',
   /var diary = JSON\.stringify\(out\)\.slice\(0, 3200\);/.test(pc), '');

// ── it answers the actual question ────────────────────────────────────────
// v1 skipped the cropper's own DOM entirely. v2 keeps the distinction but
// records BOTH sides — see the v2 block at the foot of this file.
ok('it can tell the cropper’s own work apart from the page behind it',
   /inside = !!\(ov && t && ov\.contains\(t\)\)/.test(pc), '');
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

// ── v2 (v0.9.1701): v1's answer sent the hunt inside the overlay ──────────
// v1 measured: 0 viewport events, page height moved 0x, 27 changes behind in
// 45s. That eliminates the viewport and the page beneath — the two things the
// v0.9.1031 fix was built around — and leaves the crop surface itself, which
// v1 deliberately ignored. These pins hold v2 honest about the difference.
ok('v2 counts what happens INSIDE the overlay too (v1 threw it away)',
   /if \(inside\) \{ R\.inMut\+\+; R\.inBucket\[k\] = \(R\.inBucket\[k\] \|\| 0\) \+ 1; \}/.test(pc), '');
ok('…while still keeping inside and behind APART, so the answer stays readable',
   /else \{ R\.mut\+\+; R\.bucket\[k\] = \(R\.bucket\[k\] \|\| 0\) \+ 1; \}/.test(pc), '');
ok('v2 measures frame timing — the honest test of "it flashes"',
   /requestAnimationFrame\(_tick\)/.test(pc) && /if \(d > 100\) R\.slow100\+\+;/.test(pc)
   && /if \(d > 250\) R\.slow250\+\+;/.test(pc), '');
ok('…and cancels that loop when it stops (no rAF left spinning)',
   /if \(R\.raf\) cancelAnimationFrame\(R\.raf\)/.test(pc), '');
ok('…and the loop stops itself if the recorder was replaced',
   /if \(!_flashRec \|\| _flashRec !== R \|\| R\.stopped\) return;/.test(pc), '');
ok('v2 records how many MEGAPIXELS the phone is being asked to hold',
   /naturalWidth \* _im\.naturalHeight\) \/ 1000000/.test(pc), '');
ok('…read once the photo has decoded, not guessed before',
   /_im\.addEventListener\('load', _grab, \{ once: true \}\)/.test(pc), '');
ok('v1’s finding is written down where the next reader will see it',
   /0 viewport events, 27 changes behind the overlay/.test(pc)
   && /The URL bar NEVER MOVED/.test(pc), '');
ok('the report prints the frame line and the inside ranking',
   /cf\.frames/.test(er) && /busiest INSIDE the crop screen/.test(er), '');

// ── v0.9.1826: THE DIARY RIDES THE ACCOUNT FILE ───────────────────────────
// Brad, 2026-09-27, the THIRD report ("the crazy flashing again … the picture
// itself"). The diary was on his phone and the only way off it was "Report a
// problem" — taps and an email to paste. Now it is written through _prefSet,
// so it syncs to rail-roster-prefs.json like a setting and the desktop can
// read a phone's diary. The lifted functions below run for real on a fake
// store; the planted offender is the old raw write, which the sync never saw.
function grab(src, sig) {
  const i = src.indexOf(sig); if (i < 0) return '';
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  return '';
}
function fakeStore(init) {
  const m = Object.assign({}, init || {}), writes = [];
  return { m, writes, getItem: k => (Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null),
           setItem: (k, v) => { m[k] = String(v); writes.push(k); }, removeItem: k => { delete m[k]; } };
}
function fakeR() {
  return { stopped: false, timer: 1, hWin: function () {}, hVvR: function () {}, hVvS: function () {}, mo: { disconnect: function () {} }, raf: 1,
           bucket: { 'div#browse-cards': 27, 'tr': 27 }, hits: { _pinRenderBar: 2 }, inBucket: { 'img#_rrCropImg': 3 }, t0: Date.now() - 5000,
           ev: 0, mut: 54, bodyH: 0, frames: 140, slow100: 3, slow250: 1, worst: 640, imgWH: '4000x3000', mp: '12.0MP', lines: ['t+0.0  crop opened'] };
}
const stopSrc = grab(pc, 'function _flashStop(why)');
const liftStop = (src, prefSet, ls) => new Function('_flashRec', 'window', 'localStorage', '_prefSet', 'clearTimeout', 'cancelAnimationFrame', src + '\nreturn _flashStop;')
  (fakeR(), { removeEventListener: function () {}, visualViewport: null }, ls, prefSet, function () {}, function () {});
(function () {
  const ls = fakeStore(), calls = [];
  liftStop(stopSrc, function (k, v) { calls.push({ k, v }); }, ls)('closed');
  let parsed = null; try { parsed = JSON.parse(calls[0].v); } catch (e) {}
  ok('v1826  the diary is written through _prefSet — the door the sync watches',
     calls.length === 1 && calls[0].k === 'rr_crop_flash', JSON.stringify(calls.map(c => c.k)));
  ok('…and it is the whole diary, clipped to 3200, still readable JSON (head, frames, at, the ranking)',
     parsed && parsed.head && parsed.frames && parsed.at > 0 && parsed.top[0] === 'div#browse-cards x27' && calls[0].v.length <= 3200, calls[0] && calls[0].v.slice(0, 120));
  ok('…and nothing is written raw beside it (one write, one door)', ls.writes.length === 0, ls.writes.join(','));
})();
(function () {
  const ls = fakeStore();
  liftStop(stopSrc, undefined, ls)('45s cap');
  ok('…with no _prefSet loaded it still lands on the device (the old behaviour, never worse)',
     ls.writes.length === 1 && ls.writes[0] === 'rr_crop_flash' && /45s cap/.test(ls.m.rr_crop_flash), ls.writes.join(','));
})();
const restampSrc = grab(pc, 'function _flashRestampOld()');
const liftRestamp = (ls, pushes) => new Function('localStorage', 'window', restampSrc + '\nreturn _flashRestampOld;')(ls, { rrPrefsQueuePush: function (k) { pushes.push(k); } });
(function () {
  const ls = fakeStore({ rr_crop_flash: JSON.stringify({ at: 1790000000000, head: 'crop 12.0s (closed)' }) }), pushes = [];
  const r = liftRestamp(ls, pushes)();
  ok('v1826  a diary saved before this release is stamped at load with its OWN time, and one push is queued',
     r === true && ls.m.rr_crop_flash__at === '1790000000000' && pushes.length === 1 && pushes[0] === 'rr_crop_flash', JSON.stringify({ r, at: ls.m.rr_crop_flash__at, pushes }));
  const r2 = liftRestamp(ls, pushes)();
  ok('…once: a diary the sync already knows is left alone', r2 === false && pushes.length === 1 && ls.writes.length === 1, JSON.stringify({ r2, pushes, writes: ls.writes }));
})();
(function () {
  const ls = fakeStore(), pushes = [];
  ok('…and with no diary nothing is written and nothing is pushed', liftRestamp(ls, pushes)() === false && ls.writes.length === 0 && pushes.length === 0, ls.writes.join(','));
  const torn = fakeStore({ rr_crop_flash: '{torn' }), p2 = [];
  ok('…a torn diary is stamped 0 (the merge dates it now) rather than lost', liftRestamp(torn, p2)() === true && torn.m.rr_crop_flash__at === '0' && p2.length === 1, JSON.stringify(torn.m));
})();
ok('the restamp runs once at load, guarded (a test rig with no localStorage must not throw)',
   /try \{ if \(typeof localStorage !== 'undefined'\) _flashRestampOld\(\); \} catch \(e\) \{\}/.test(pc), '');
ok('…and it stamps with the diary’s time, never Date.now() (the newest diary must win across devices)',
   !/Date\.now/.test(restampSrc) && /String\(at\)/.test(restampSrc), '');
(function () {
  const old = stopSrc.replace("if (typeof _prefSet === 'function') _prefSet('rr_crop_flash', diary);\n    else localStorage.setItem('rr_crop_flash', diary);", "localStorage.setItem('rr_crop_flash', diary);");
  const ls = fakeStore(), calls = [];
  liftStop(old, function (k, v) { calls.push(k); }, ls)('closed');
  ok('OFFENDER: the old raw write — the diary lands on the device and the sync never sees it → the v1826 pin goes red',
     old !== stopSrc && calls.length === 0 && ls.writes.length === 1, JSON.stringify({ same: old === stopSrc, calls, writes: ls.writes }));
})();

console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
