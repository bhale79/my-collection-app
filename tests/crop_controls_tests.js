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
// v0.9.1778: this slice used to be anchored on the word "Level", which the
// two-row rebuild removed — and that ONE stale anchor cascaded into eleven
// red assertions that were all still perfectly true. Anchor on the row's id
// instead: an id is a handle, a label is copy, and copy changes.
const row = pc.slice(pc.indexOf('id="_rrCropRowLevel"'),
                     pc.indexOf('id="_rrCropCancel"'));
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
   // v0.9.1778 tightened these to "\u22120.5\u00b0" / "+0.5\u00b0" — the inner
   // space came out to buy width. The RULE is that they say half a degree,
   // so match that and not the spacing.
   /\\u22120\.5\\u00b0/.test(row) && /\+0\.5\\u00b0/.test(row),
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
// v0.9.1737 (Brad: "remove that rotate button"). v1736 put ↺ 90° and ↻ 90°
// directly under the picture — both directions, beside the fine steps — so the
// footer button was a second way to do a thing that already had a better one,
// and two controls for one action is how they drift apart.
ok('the footer Rotate button is gone from the markup',
   !/_rrCropRotate/.test(pc), 'the button id is still being built');
ok('…and nothing is left listening for it',
   !/_rotateBtn/.test(pc), 'a dead handler for the removed button remains');
ok('…so the footer is just Cancel and Apply',
   /_rrCropCancel[\s\S]{0,400}_rrCropApply/.test(pc)
   && !/margin-right:auto/.test(pc), 'the footer still has the pushed-left slot');
ok('the 90° turns survive in the row above — this removed a duplicate, not a feature',
   /_rrCropRotQtrL/.test(pc) && /_rrCropRotQtrR/.test(pc)
   && /function _turn\(n\)/.test(pc), 'the quarter turns went with it');

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
// ── v0.9.1778 SUPERSEDES the wrap rule. Read this before "fixing" it. ─────
// This used to assert `flex-wrap:wrap` — the row was allowed to wrap rather
// than overflow a phone. That is now WRONG, at Brad's explicit instruction:
// "always 2 clean rows".
//
// Wrapping hands the break point to whatever width the device reports, and on
// his S25 Ultra — a physically large phone that reports a NARROW viewport
// because Samsung's Display size setting scales everything up — it broke
// between "\u21bb90\u00b0" and the word "Zoom", stranding a rotation button in
// the zoom group. The rule is now TWO SEALED ROWS that cannot split, with a
// sideways scroll as the safety valve, so an over-wide row stays reachable
// instead of hiding a control. Full invariants: crop_control_rows_tests.js.
// Scoped to the CONTROL rows via `row`, not the whole file: the header row
// above (title, hint, "Whole photo") wraps on purpose and should keep doing
// so, and the explanatory comment above the markup spells out the old rule —
// a file-wide check flagged both. Scope the assertion to what it is about.
ok('neither control row may wrap — they are sealed groups now',
   !/flex-wrap:wrap/.test(row), 'a control row can still wrap and orphan a button');
ok('…and an over-wide row scrolls rather than hiding a control',
   (row.match(/overflow-x:auto/g) || []).length >= 2, 'the scroll safety valve is missing');
ok('the buttons stay tappable (44px-ish targets)',
   /min-width:46px;min-height:40px/.test(pc), 'tap targets too small');

console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
