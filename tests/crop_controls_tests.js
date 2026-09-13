// ══ tests/crop_controls_tests.js ═══════════════════════════════════════════
//
// v0.9.1736 (Brad, on the crop screen): "need the crop angle to adjust by .5
// angle not 1. also can we -90, -.5, +.5, +90 arrows directly under the
// picture, don't need the scroll bar. also need a + / - zoom button."
//
// The slider had already been narrowed once — v0.9.1049 took it from 360° to
// ±15° because "the mouse tends to fling it too far back and forth" and a
// thumb-width moved it thirty degrees. Narrowing a control that cannot be
// aimed only makes it a smaller thing that cannot be aimed; levelling a photo
// is a STEPPING job. Every control on that row now moves a known amount, so a
// result is repeatable and nothing can fling.
//
// These are structural pins on the real source. The cropper needs a DOM, a
// loaded image and cropper.js to run for real, none of which exist in node —
// so what is asserted here is that the controls are present, wired to the
// right step, and that the slider is genuinely gone rather than merely hidden.
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}
const pc = fs.readFileSync(path.join(__dirname, '..', 'app', 'photo-crop.js'), 'utf8');

// ── the scroll bar is gone, not hidden ────────────────────────────────────
ok('the range slider no longer exists in the markup',
   !/type="range"/.test(pc), 'a type="range" input is still being built');
ok('…and nothing is left styling it',
   !/accent-color:var\(--accent/.test(pc), 'slider styling left behind');
ok('the slider handler is defensive about it being absent',
   /if \(rotEl\) rotEl\.addEventListener/.test(pc)
   && /if \(rotEl\) rotEl\.value = _fine;/.test(pc),
   'rotEl is dereferenced without a guard somewhere');

// ── five controls, under the picture, in Brad's order ─────────────────────
const row = pc.slice(pc.indexOf("'<span style=\"color:#ccc;font-size:0.78rem;white-space:nowrap\">Level</span>'"),
                     pc.indexOf("'<div style=\"padding:0.85rem 1rem;display:flex"));
ok('the row is built at all', row.length > 200, 'row markup not found');
['_rrCropRotQtrL', '_rrCropRotMinus', '_rrCropRotV', '_rrCropRotPlus', '_rrCropRotQtrR']
  .forEach(function (id, i) {
    ok('control ' + (i + 1) + ' of 5 is ' + id, row.indexOf(id) >= 0, 'missing ' + id);
  });
ok('they appear in the order -90, -0.5, reading, +0.5, +90',
   row.indexOf('_rrCropRotQtrL') < row.indexOf('_rrCropRotMinus')
   && row.indexOf('_rrCropRotMinus') < row.indexOf('_rrCropRotV')
   && row.indexOf('_rrCropRotV') < row.indexOf('_rrCropRotPlus')
   && row.indexOf('_rrCropRotPlus') < row.indexOf('_rrCropRotQtrR'),
   'controls are out of order');
ok('the two fine buttons are LABELLED half a degree',
   /\\u2212 0\.5\\u00b0/.test(row) && /\+ 0\.5\\u00b0/.test(row),
   'the buttons do not say 0.5');
ok('the two quarter-turn buttons are labelled 90',
   (row.match(/90\\u00b0/g) || []).length >= 2, 'missing the 90° labels');

// ── and they step half a degree, which is the actual request ──────────────
ok('minus steps 0.5, not 1',
   /_minusBtn\.onclick = function \(\) \{ _setFine\(_fine - 0\.5\); \}/.test(pc),
   'minus is not stepping 0.5');
ok('plus steps 0.5, not 1',
   /_plusBtn\.onclick = function \(\) \{ _setFine\(_fine \+ 0\.5\); \}/.test(pc),
   'plus is not stepping 0.5');
ok('_setFine still snaps to the half degree',
   /Math\.round\(v \* 2\) \/ 2/.test(pc), 'the 0.5 snap is gone');
ok('the reading shows one decimal, so 0.5 does not look like a glitch',
   /\.toFixed\(1\) \+ '°'/.test(pc), 'the reading is not fixed to 1dp');

// ── the quarter turns go BOTH ways and stay in range ──────────────────────
ok('one helper does both quarter turns',
   /function _turn\(n\) \{ _quarters = \(\(\(_quarters \+ n\) % 4\) \+ 4\) % 4; _applyRot\(\); \}/.test(pc),
   '_turn is missing or does not wrap negatives');
ok('left turns by -1 and right by +1',
   /_qL\.onclick = function \(\) \{ _turn\(-1\); \}/.test(pc)
   && /_qR\.onclick = function \(\) \{ _turn\(1\); \}/.test(pc), '');
ok('the footer Rotate button shares the same helper, so it cannot drift',
   /_rotateBtn\.onclick = function \(\) \{ _turn\(1\); \}/.test(pc),
   'the footer button still has its own copy of the 90° arithmetic');

// ── zoom by button ────────────────────────────────────────────────────────
ok('a zoom-out and a zoom-in button exist',
   /_rrCropZoomOut/.test(pc) && /_rrCropZoomIn/.test(pc), '');
ok('they call the cropper relatively, so a press is the same nudge anywhere',
   /cropper\.zoom\(-0\.15\)/.test(pc) && /cropper\.zoom\(0\.15\)/.test(pc), '');
ok('…and are guarded, since the cropper may not exist yet',
   /if \(_zOut\) _zOut\.onclick[\s\S]{0,120}if \(cropper\) cropper\.zoom\(-0\.15\)/.test(pc), '');

// ── the row must not cost colour budget or break a phone ──────────────────
ok('every step button shares ONE style string',
   /var stepBtn = btn \+ /.test(pc), 'stepBtn is not derived from the shared btn');
ok('…so the row hand-writes no colour of its own',
   !/_rrCropRotQtrL[\s\S]{0,200}#(?:[0-9a-f]{3}|[0-9a-f]{6})\b/i.test(pc),
   'a hex colour is inlined on the new buttons');
ok('the row wraps rather than overflowing a phone',
   /flex-wrap:wrap;justify-content:center/.test(pc), 'the row cannot wrap');
ok('the buttons stay tappable (44px-ish targets)',
   /min-width:46px;min-height:40px/.test(pc), 'tap targets too small');

console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
