// ════════════════════════════════════════════════════════════════════════
// crop_layout_tests.js — v0.9.1773
//
// The crop screen's layout contract.
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
  levelRowPinned: s =>
    s.indexOf("'<div style=\"flex:0 0 auto;padding:0.55rem 1rem 0;display:flex;align-items:center") > -1,
  actionsRowPinned: s =>
    s.indexOf("'<div style=\"flex:0 0 auto;padding:0.85rem 1rem;display:flex;gap:0.6rem") > -1,
  stageStillFlexes: s =>
    s.indexOf("id=\"_rrCropStage\" style=\"flex:1;min-height:0;position:relative;overflow:hidden\"") > -1,
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
  gripSquareUnchanged: s => /\.cropper-point\{width:16px!important;height:16px!important/.test(s)
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
      'viewModeStillZero']
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
