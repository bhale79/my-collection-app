// ════════════════════════════════════════════════════════════════════════
// crop_layout_tests.js — v0.9.1774
//
// The crop screen's layout contract.
//
// ── WHY THIS FILE GREW ────────────────────────────────────────────────────
// v0.9.1773 shipped with this suite GREEN and did not fix the bug. Brad, after
// installing it: "the screen covers the rotate buttons completely, it doesn't
// cover the zoom button." Every invariant here passed because they were the
// wrong invariants — they checked that the MEASUREMENT was set up correctly and
// never checked that a wrong measurement could not reach the controls.
//
// That sentence of Brad's is the whole diagnosis. A picture that is merely too
// tall PUSHES the rows below it down and Cancel/Apply go off-screen. His did
// not: every row stayed put and the picture hung OVER the first one. The stage
// had overflow:hidden; the WRAPPER around it did not — so a stage frozen taller
// than its space spilled out of a wrapper that kept its own correct size.
//
// So section G exists, and it is the important one: the picture cannot draw
// over the controls even when the measurement is wrong.
//
// Brad, 2026-09-19: "the picture on the crop page is too big and covers the
// rotate and zoom buttons. one time the crop box captured those buttons." And:
// "the crop box blue grips are too close to the edge and is super hard to get
// sometimes with your fingers and half the time it colapses into a tiny box
// that i have to stretch back out."
//
// Both halves of the first one are the same cause. The overlay is
// position:fixed;inset:0, which sizes to the LAYOUT viewport — taller than what
// a phone can actually show. _freezeStage then measured the picture area inside
// that too-tall box and pinned it there, so the buttons went under the browser
// chrome and the crop box could reach over them.
//
// This is a LAYOUT change, and layout cannot be proven without a device — the
// pixel suite (layout-check.js) needs pngjs, which the build sandbox cannot
// install. So this suite locks the INVARIANTS the fix depends on, and section F
// plants each offender in turn and requires the suite to go red.
// ════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'app', 'photo-crop.js');
const SRC = fs.readFileSync(FILE, 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}

// Pull the Cropper options block out by brace-matching from `new Cropper(`.
// Deliberately NOT a comment-stripping regex: this file is mostly comments and
// a regex that tried to remove them would eat the code (v0.9.1772's lesson).
function cropperOptions(src) {
  const i = src.indexOf('new Cropper(');
  if (i < 0) return '';
  let d = 0; const s0 = src.indexOf('{', i);
  for (let k = s0; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) return src.slice(s0, k + 1); }
  }
  return '';
}
function fnBody(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return '';
  let d = 0; const s0 = src.indexOf('{', i);
  for (let k = s0; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) return src.slice(s0, k + 1); }
  }
  return '';
}

// Every check is a function of the source, so section F can re-run them all
// against a deliberately broken copy.
const CHECKS = {
  headerPinned: s =>
    s.indexOf("'<div style=\"flex:0 0 auto;padding:0.75rem 1rem;display:flex;justify-content:space-between") > -1,
  // v0.9.1778: the control block is now an OUTER container holding two sealed
  // rows (levelling, zoom), so the old check — an exact match on the single
  // row's style string — went stale the moment the rows were restructured.
  // That is the same staleness trap that bit `stageStillFlexes` in v1774.
  // The invariant never changed and is asserted as a PROPERTY now: the control
  // block does not yield, only the picture does.
  // Read the ENCLOSING div's own style attribute. A `lastIndexOf` for the
  // flex string matched a div far earlier in the file and let a planted
  // offender walk straight past — the same "it matched something else"
  // failure as the comment-matching trap in v1774.
  levelRowPinned: s => {
    const i = s.indexOf('id="_rrCropRowLevel"');
    if (i < 0) return false;
    const open = s.lastIndexOf('<div style="', i);
    if (open < 0) return false;
    const from = open + '<div style="'.length;
    const style = s.slice(from, s.indexOf('"', from));
    return /flex:0 0 auto/.test(style) && /padding:0\.55rem 1rem 0/.test(style);
  },
  actionsRowPinned: s =>
    s.indexOf("'<div style=\"flex:0 0 auto;padding:0.85rem 1rem;display:flex;gap:0.6rem") > -1,
  stageStillFlexes: s => {
    const m = s.match(/id="_rrCropStage" style="([^"]*)"/);
    return !!m && /flex:1/.test(m[1]) && /min-height:0/.test(m[1]) && /overflow:hidden/.test(m[1]);
  },
  fitsBeforeMeasuring: s => {
    const body = fnBody(s, '_freezeStage');
    const fit = body.indexOf('_fitOverlayToVisible()');
    const measure = body.indexOf('getBoundingClientRect');
    return fit > -1 && measure > -1 && fit < measure;
  },
  fitUsesVisualViewport: s => {
    const body = fnBody(s, '_fitOverlayToVisible');
    return /visualViewport/.test(body) && /vv\.height/.test(body)
        && /offsetTop/.test(body) && /bottom\s*=\s*'auto'/.test(body);
  },
  minBoxSet: s => {
    const o = cropperOptions(s);
    const w = o.match(/minCropBoxWidth:\s*(\d+)/);
    const h = o.match(/minCropBoxHeight:\s*(\d+)/);
    return !!(w && h) && +w[1] >= 40 && +h[1] >= 40;
  },
  viewModeStillZero: s => /viewMode:\s*0\b/.test(cropperOptions(s)),
  gripTargetGrown: s => {
    const m = s.match(/\.cropper-point:after\{[^}]*width:(\d+)px;height:(\d+)px/);
    return !!m && +m[1] > 16 && +m[2] > 16;
  },
  gripTargetCannotOverlap: s => {
    const m = s.match(/\.cropper-point:after\{[^}]*width:(\d+)px/);
    const o = cropperOptions(s);
    const floor = o.match(/minCropBoxWidth:\s*(\d+)/);
    return !!(m && floor) && +m[1] < +floor[1];
  },
  gripSquareUnchanged: s => /\.cropper-point\{width:16px!important;height:16px!important/.test(s),

  // ── v0.9.1774 — the ones v1773 should have had ──────────────────────────
  wrapperClamped: s =>
    s.indexOf("padding:0 12px 4px;display:flex;overflow:hidden") > -1,
  stageCannotExceedItsSpace: s =>
    s.indexOf('id="_rrCropStage" style="flex:1;min-height:0;max-height:100%') > -1,
  revealedBeforeMeasuring: s => {
    const b = fnBody(s, '_build');
    const reveal = b.indexOf('if (_rrSavedBoxFits(img))');
    const freeze = b.indexOf('_freezeStage()');
    return reveal > -1 && freeze > -1 && reveal < freeze;
  },
  pinchOff: s => /zoomOnTouch:\s*false/.test(cropperOptions(s)),
  hintDoesNotPromisePinch: s => {
    const m = s.match(/opts\.hint \|\| '([^']*)'/);
    return !!m && !/pinch/i.test(m[1]);
  }
};

console.log('\n== A. The buttons can never be squeezed ==');
ok('the header row is pinned', CHECKS.headerPinned(SRC));
ok('the Level row is pinned', CHECKS.levelRowPinned(SRC));
ok('the Cancel / Apply row is pinned', CHECKS.actionsRowPinned(SRC));
ok('…and the PICTURE is still the thing that yields', CHECKS.stageStillFlexes(SRC));

console.log('\n== B. It measures the screen you can SEE ==');
ok('the overlay is fitted BEFORE the picture area is measured and pinned',
   CHECKS.fitsBeforeMeasuring(SRC),
   'order inside _freezeStage decides whether the whole fix works');
ok('…using visualViewport height and offset, with bottom released',
   CHECKS.fitUsesVisualViewport(SRC));

console.log('\n== C. The crop box has a floor ==');
ok('a minimum crop box is set, at least a fingertip', CHECKS.minBoxSet(SRC));

console.log('\n== D. The grips are easier to hit, and look identical ==');
ok('the touch target is larger than the visible square', CHECKS.gripTargetGrown(SRC));
ok('…but smaller than the crop-box floor, so opposite grips cannot overlap',
   CHECKS.gripTargetCannotOverlap(SRC));
ok('…and the visible square is still 16px (v0.9.790)', CHECKS.gripSquareUnchanged(SRC));

console.log('\n== E. A deliberate old decision is NOT undone ==');
ok('viewMode is still 0 — v0.9.904 chose it so a rotated photo is not clamped',
   CHECKS.viewModeStillZero(SRC),
   'changing this to 1 would break the half-degree levelling Brad asked for');

console.log('\n== G. The picture cannot reach the controls, measurement or not ==');
ok('the WRAPPER clips too, not just the stage inside it',
   CHECKS.wrapperClamped(SRC),
   'this is the one v0.9.1773 was missing');
ok('…and the stage cannot be frozen taller than its space',
   CHECKS.stageCannotExceedItsSpace(SRC));
ok('"Whole photo" is revealed BEFORE the measurement, not in the ready callback',
   CHECKS.revealedBeforeMeasuring(SRC),
   'revealing it after is what made the header grow a moment too late');

console.log('\n== H. Pinch no longer fights the drag ==');
ok('zoom on touch is off', CHECKS.pinchOff(SRC));
ok('…and the hint no longer promises it', CHECKS.hintDoesNotPromisePinch(SRC));

console.log('\n== F. THE OFFENDERS: break each one, require red ==');
{
  // Each entry: a name, a mutation of the source, and the check that MUST go
  // false. A check that survives its own offender is not testing anything.
  const offenders = [
    ['the header row loses its pin',
      s => s.replace("'<div style=\"flex:0 0 auto;padding:0.75rem 1rem;display:flex;justify-content:space-between",
                     "'<div style=\"padding:0.75rem 1rem;display:flex;justify-content:space-between"),
      'headerPinned'],
    // The realistic regression is that the call is dropped from _freezeStage
    // — reordering it INSIDE the try still leaves it ahead of the measurement,
    // which is why the first version of this offender was not an offender at
    // all and the check rightly survived it.
    ['the fit is dropped from _freezeStage',
      s => s.replace('    _fitOverlayToVisible();\n', ''),
      'fitsBeforeMeasuring'],
    ['the crop box floor is removed',
      s => s.replace(/minCropBoxWidth: 64, minCropBoxHeight: 64,/, ''),
      'minBoxSet'],
    ['the grip target is shrunk back to the square',
      s => s.replace(/(\.cropper-point:after\{content:"";position:absolute;left:50%;top:50%;')\n\s*\+\s*'width:34px;height:34px/,
                     '$1width:16px;height:16px'),
      'gripTargetGrown'],
    ['someone "fixes" viewMode to 1',
      s => s.replace('viewMode: 0, autoCropArea: 1', 'viewMode: 1, autoCropArea: 1'),
      'viewModeStillZero'],
    ['the wrapper stops clipping (the v1773 miss, put back)',
      s => s.replace('padding:0 12px 4px;display:flex;overflow:hidden',
                     'padding:0 12px 4px;display:flex'),
      'wrapperClamped'],
    ['the stage loses its ceiling',
      s => s.replace('style="flex:1;min-height:0;max-height:100%;position:relative',
                     'style="flex:1;min-height:0;position:relative'),
      'stageCannotExceedItsSpace'],
    ['"Whole photo" goes back to being revealed after the measurement',
      s => { const b = fnBody(s, '_build');
             const i = b.indexOf('    try {\n      if (_rrSavedBoxFits(img)) {');
             const j = b.indexOf('    _freezeStage();');
             if (i < 0 || j < 0) return s;
             return s.replace(b, b.slice(0, i) + b.slice(j)); },
      'revealedBeforeMeasuring'],
    ['pinch zoom is switched back on',
      s => s.replace('zoomOnTouch: false,', ''),
      'pinchOff'],
    ['the hint promises pinch again',
      s => s.replace("opts.hint || 'Drag the box \u00b7 zoom with the buttons'",
                     "opts.hint || 'Drag the box \u00b7 pinch or scroll to zoom'"),
      'hintDoesNotPromisePinch']
  ];
  offenders.forEach(function (o) {
    const broken = o[1](SRC);
    const changed = broken !== SRC;
    const caught = changed && CHECKS[o[2]](broken) === false;
    ok('planting "' + o[0] + '" is caught by ' + o[2],
       caught, changed ? 'the check still passed on broken source' : 'the mutation did not apply');
  });
}

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
