// ══ tests/overlay_hold_tests.js ════════════════════════════════════════════
//
// v0.9.1703 (Session 93). The fix the CROP FLASH RECORDER earned.
//
// Brad, Android phone, twice: "when i go to crop any image on my phone it
// flashes constantly … the whole screen flashes, not just the picture … if
// you wait 30 seconds or so it will stop."
//
// v0.9.1031 fixed this on a theory (URL bar → viewport resize → relayout) and
// it came back. v0.9.1700–1701 measured instead, and the measurement from
// report 5g9mcsm544 settled it:
//
//   0 viewport events, page height moved 0x        <- v1031's theory, dead
//   1258 frames in 45.0s (28.0/sec), 26 over 250ms, worst 1141ms
//   busiest behind the overlay: div#hierarchy-chips x53, tr x27,
//     span#result-count x27, div#browse-cards x27, div#pagination-btns x27
//
// The Master Catalog rebuilt 27 times behind a solid-black overlay. 26 long
// frames, 27 rebuilds — the same events. v1031's RULE ("the page beneath
// holds still while the crop screen is open") was right; it was pointed at
// viewport listeners, which never fire. It belongs on the page builders.
//
// THE RULE THESE PINS DEFEND: while a full-screen overlay is up, a heavy page
// builder does not run. It is DEFERRED — recorded by name, collapsed to one,
// and run when the overlay closes. Deferred, never dropped.
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}
const rd = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
const cfg = rd('config.js'), br = rd('browse.js'), da = rd('dashboard.js'), pc = rd('photo-crop.js');

// ── one hold, in one place ────────────────────────────────────────────────
ok('the hold lives in config.js, not copied into each caller',
   /function rrHoldRepaint\(name, fn\)/.test(cfg) && /function rrFlushRepaints\(\)/.test(cfg), '');
ok('…exposed on window for the files that use it',
   /window\.rrHoldRepaint   = rrHoldRepaint;/.test(cfg) && /window\.rrFlushRepaints = rrFlushRepaints;/.test(cfg), '');
// v0.9.1706 RE-PIN: the hold gained a SECOND reason — the page is off screen
// (tests/page_stale_tests.js). The overlay reason is unchanged: it is still
// decided by _rrCropOpen and still the last word before "carry on".
ok('…and the OVERLAY reason is still exactly the crop flag, checked last before carrying on',
   /function rrOverlayUp\(\)[\s\S]{0,160}?window\._rrCropOpen/.test(cfg)
   && /if \(!rrOverlayUp\(\)\) return false;\s*\n\s*if \(typeof fn === 'function'\) _rrHeldRepaints\[name\] = fn;/.test(cfg), '');
ok('repaints are kept BY NAME, so many rebuilds collapse into one',
   /_rrHeldRepaints\[name\] = fn;/.test(cfg), '');

// ── the flush must be safe: this is where "stale page" bugs come from ────
ok('the flush clears its list BEFORE running, so nothing can re-enter and loop',
   /var held = _rrHeldRepaints;\s*\n\s*_rrHeldRepaints = \{\};/.test(cfg), '');
ok('…and each repaint is isolated, so a thrower cannot cost the others theirs',
   /try \{ held\[names\[i\]\]\(\); \} catch \(e\)/.test(cfg), '');

// ── the two builders the recorder actually caught ────────────────────────
ok('renderBrowse stands down while an overlay is up',
   /function renderBrowse\(\) \{[\s\S]{0,900}?rrHoldRepaint\('browse', renderBrowse\)\) return;/.test(br), '');
ok('…BEFORE its signature cache, which a background data load defeats anyway',
   br.indexOf("rrHoldRepaint('browse'") < br.indexOf('_rrBrowseSig'), '');
ok('buildDashboard stands down too',
   /function buildDashboard\(\) \{[\s\S]{0,700}?rrHoldRepaint\('dashboard', buildDashboard\)\) return;/.test(da), '');
ok('both guards are optional-safe, so a late config.js cannot break the app',
   (br.match(/typeof rrHoldRepaint === 'function'/g) || []).length >= 1
   && (da.match(/typeof rrHoldRepaint === 'function'/g) || []).length >= 1, '');

// ── deferred, NEVER dropped ──────────────────────────────────────────────
ok('the crop screen flushes what it held, on the way out',
   /function done\(\)[\s\S]{0,400}?rrFlushRepaints\(\)/.test(pc), '');
ok('…and clears the overlay flag FIRST, or the repaints would defer again',
   pc.indexOf('window._rrCropOpen = false;') < pc.indexOf('rrFlushRepaints()'), '');

// ── the evidence, written where the next reader will find it ─────────────
ok('config.js records WHY, with the numbers, so this is not re-theorised',
   /busiest behind the overlay/.test(cfg) && /0 viewport events, page height moved 0x/.test(cfg), '');
ok('…including that v1031’s rule was right and only aimed wrong',
   /aimed at the wrong\s*\n\/\/ mechanism/.test(cfg) || /aimed at the wrong/.test(cfg), '');

// ── behaviour, executed ──────────────────────────────────────────────────
(function () {
  global.window = {};
  const src = cfg.match(/var _rrHeldRepaints[\s\S]*?window\.rrFlushRepaints = rrFlushRepaints;/)[0] + '}catch(e){}';
  eval(src);
  let browse = 0, dash = 0;
  const B = () => { browse++; }, D = () => { dash++; };
  window._rrCropOpen = true;
  for (let i = 0; i < 27; i++) if (!window.rrHoldRepaint('browse', B)) B();
  for (let i = 0; i < 5; i++) if (!window.rrHoldRepaint('dashboard', D)) D();
  ok('RUN: 27 browse + 5 dashboard rebuilds behind an overlay do NO work',
     browse === 0 && dash === 0, browse + '/' + dash);
  window._rrCropOpen = false;
  window.rrFlushRepaints();
  ok('RUN: on close they collapse to exactly one each', browse === 1 && dash === 1, browse + '/' + dash);
  window.rrFlushRepaints();
  ok('RUN: flushing again does nothing', browse === 1 && dash === 1, browse + '/' + dash);
  window._rrCropOpen = true;
  window.rrHoldRepaint('boom', () => { throw new Error('x'); });
  window.rrHoldRepaint('browse', B);
  window._rrCropOpen = false;
  window.rrFlushRepaints();
  ok('RUN: a repaint that throws does not cost the others theirs', browse === 2, String(browse));
  ok('RUN: with no overlay up, a builder is NEVER held', window.rrHoldRepaint('browse', B) === false);
})();

console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
