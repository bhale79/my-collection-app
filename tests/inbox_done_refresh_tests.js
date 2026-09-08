// ══ tests/inbox_done_refresh_tests.js ══════════════════════════════════════
//
// v0.9.1699 (Session 93). Brad, on a phone:
//   "i added pictures, i hit done, and the photos were not in there. i had to
//    click dashboard before they showed up. should be instant"
//   "it said to wait or i might lose the pictures. can we not hit done, and
//    it wait till the pictures are loaded so we don't loose them"
//
// ROOT CAUSE, for whoever reads this next: photos reach the inbox by TWO
// paths and only one of them refreshed. _upload() (drag-drop / picker /
// desktop) has always ended in _pinRefresh(). The Quick Capture path
// (_qcShot → _qcUpload → _qcDone) never did, so the only thing that noticed
// new shots was the buildDashboard hook — which is exactly why clicking
// Dashboard "fixed" it.
//
// The rule these pins defend: EVERY path that puts a photo in the inbox ends
// by re-reading it. Add a third path and this file should grow a third pin.
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}
const pi = fs.readFileSync(path.join(__dirname, '..', 'app', 'photo-inbox.js'), 'utf8');
function body(sig, endAt) {
  const i = pi.indexOf(sig);
  if (i < 0) return '';
  const j = pi.indexOf(endAt, i);
  return j < 0 ? pi.slice(i) : pi.slice(i, j);
}

// ── both paths end in a refresh ────────────────────────────────────────────
const upload = body('async function _upload(files)', '\n  // ── Review a photo group');
ok('the drop/picker path still ends by re-reading the inbox',
   /_pinRefresh\(\);\s*\n\s*\} catch \(e\) \{/.test(upload), '');

ok('the Quick Capture path has a landing hook of its own',
   /function _qcAllLanded\(\)/.test(pi), '');
const landed = body('function _qcAllLanded()', '\n  window._qcRetry');
ok('…which refreshes the nav badge',
   /_pinCountRefresh\(\)/.test(landed), '');
ok('…and redraws the grid ONLY when the inbox is the page on screen',
   /#page-photo-inbox\.active/.test(landed) && /window\._pinRefresh\(\)/.test(landed), '');
ok('…and is reached from the upload finally, when the last one settles',
   /_qcFlight--;[\s\S]{0,220}?if \(_qcFlight <= 0\) \{ _qcFlight = 0; _qcAllLanded\(\); \}/.test(pi), '');
ok('…and from Done when nothing was in the air',
   /_qcAllLanded\(\);\s*\n\s*\};/.test(pi), '');

// ── flight is counted OUTSIDE the UI session ──────────────────────────────
// This is what makes "close instantly" safe. _qcDone() nulls _qc; if the
// pending count still lived there, an upload in the air would throw on its
// way out — and a FAILED one would throw before it could be rescued.
ok('uploads in flight are counted outside _qc',
   /var _qcFlight = 0;/.test(pi) && /_qcFlight\+\+;/.test(pi), '');
ok('…and every _qc touch inside the upload is guarded',
   /if \(_qc\) \{ _qc\.pending\+\+; _qcRender\(\); \}/.test(pi)
   && /if \(_qc\) \{ _qc\.pending--; _qcRender\(\); \}/.test(pi), '');
ok('…so a new capture sheet never zeroes a previous sheet’s flight',
   /_qcFlight is deliberately/.test(pi), '');

// ── nothing is lost, so nothing needs warning about ───────────────────────
const done = body('window._qcDone = async function ()', '\n  // ══ v0.9.1699');
ok('Done asks NOTHING — both dialogs are gone',
   !/appConfirm/.test(done), done.slice(0, 120));
ok('…no early return can leave the sheet open',
   !/\breturn;\s*\n\s*\}\s*\n\s*if \(_qc && _qc\.failed/.test(done), '');
ok('…and the overlay is always removed',
   /getElementById\('qc-ov'\)/.test(done) && /ov\.remove\(\)/.test(done), '');
ok('…while _qcDone keeps its async signature (callers and pins rely on it)',
   /window\._qcDone = async function \(\)/.test(pi), '');

const upl = body('async function _qcUpload(file, name, rec)', 'window._qcRetry');
ok('a failed upload is RESCUED to the device store',
   /catch \(e\) \{[\s\S]{0,900}?await _stageOne\(file, name, '', \(rec && rec\.view\) \|\| ''\)/.test(upl), '');
ok('…and only a photo that could not even be saved lands on the failed list',
   /if \(!_saved && _qc\) _qc\.failed\.push/.test(upl), '');
ok('…so the old in-memory-only failure list is gone',
   !/\n      _qc\.failed\.push\(\{ file: file, name: name, rec: rec \}\);\n    \} finally \{/.test(pi), '');
ok('the offline branch is untouched — it staged correctly already',
   /if \(_pinOffline\(\)\) \{[\s\S]{0,400}?await _stageOne\(file, name, '', \(rec && rec\.view\) \|\| ''\);/.test(upl), '');

// ── don't hammer a dead connection ────────────────────────────────────────
ok('the staged drain is only chased when something actually landed',
   /if \(_qcLanded\) \{ try \{ _stageDrain\(\); \} catch \(e\) \{\} \}/.test(landed), '');

console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
