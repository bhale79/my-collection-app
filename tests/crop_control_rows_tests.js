// ════════════════════════════════════════════════════════════════════════
// crop_control_rows_tests.js — v0.9.1778
//
// [stated] Brad, 2026-09-19, after v1777 stopped the labels spilling out of
// their buttons: "the buttons are too big, brainstorm how to arrange these
// buttons so it fits across" → "always 2 clean rows".
//
// v1777 fixed the OVERFLOW. What was left is that the single control row ran
// out of width and WRAPPED, stranding "↻ 90°" on a second line beside the word
// "Zoom" — so the second line read as a mixed row rather than a group.
//
// THE INVARIANT THIS FILE DEFENDS: the two control groups are SEALED. Neither
// can split, so a member can never be orphaned into the other group's row,
// whatever width the device claims to be. That last clause matters: Brad's
// S25 Ultra is a physically large phone that reports a NARROW viewport because
// Samsung's Display size setting scales everything up. Width is not something
// this screen gets to assume.
//
// Section E plants an offender for each rule and requires it to be caught.
// ════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'app', 'photo-crop.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}

// Read one element's own style attribute by its id, rather than searching the
// whole file for a string. A file-wide search matched a DIFFERENT div while
// this suite was being written and let a planted offender through — the same
// family as v1774's check that matched a COMMENT.
function styleOf(src, id) {
  const i = src.indexOf('id="' + id + '"');
  if (i < 0) return null;
  const k = src.indexOf('style="', i);
  if (k < 0) return null;
  const from = k + 'style="'.length;
  return src.slice(from, src.indexOf('"', from));
}
// The MARKUP region only — from the levelling row to the Cancel / Apply row.
// Bounding this matters: a first attempt let the zoom "row" run to the end of
// the file and swept up the event-wiring line 250 lines below, which made an
// orphan check pass that should have failed. Membership is a question about
// MARKUP, so only markup is searched.
function region(src) {
  const a = src.indexOf('id="_rrCropRowLevel"');
  const b = src.indexOf('id="_rrCropCancel"');
  return (a < 0 || b < 0) ? '' : src.slice(a, b);
}
function rowBlock(src, id, nextId) {
  const r = region(src);
  const i = r.indexOf('id="' + id + '"');
  if (i < 0) return '';
  const end = nextId ? r.indexOf('id="' + nextId + '"', i) : r.length;
  return r.slice(i, end < 0 ? r.length : end);
}
// A button's visible label, read off the button itself. Scanning the whole
// file for a label matched the COMMENT that describes the change — the same
// trap as v1774's `revealedBeforeMeasuring`.
function labelOf(src, id) {
  const m = src.match(new RegExp('<button id="' + id + '"[^>]*>([^<]*)</button>'));
  return m ? m[1] : null;
}

const LEVEL = '_rrCropRowLevel', ZOOM = '_rrCropRowZoom';
const STEPPERS = ['_rrCropRotQtrL', '_rrCropRotMinus', '_rrCropRotPlus', '_rrCropRotQtrR'];

console.log('\n== A. There are TWO rows, and each one is sealed ==');
{
  const lvl = styleOf(SRC, LEVEL), zm = styleOf(SRC, ZOOM);
  ok('the levelling row exists as its own element', lvl !== null);
  ok('the zoom row exists as its own element', zm !== null);

  ok('the levelling row CANNOT split', /flex-wrap:nowrap/.test(lvl || ''), lvl);
  ok('the zoom row CANNOT split', /flex-wrap:nowrap/.test(zm || ''), zm);

  // This is the whole bug: one long row with flex-wrap:wrap handed the break
  // point to whatever width the device reported.
  ok('NEITHER row is allowed to wrap',
     !/flex-wrap:wrap/.test(lvl || '') && !/flex-wrap:wrap/.test(zm || ''));

  ok('both rows are laid out as rows and centred',
     /display:flex/.test(lvl || '') && /justify-content:center/.test(lvl || '') &&
     /display:flex/.test(zm || '') && /justify-content:center/.test(zm || ''));
  ok('…and the zoom row is visibly a SECOND row, not a continuation',
     /margin-top:/.test(zm || ''), zm);
}

console.log('\n== B. THE CLAMP: a row too wide scrolls, it does not hide ==');
{
  // Same principle as the wrapper clip in v0.9.1774. Sealing a row means it
  // can no longer relieve pressure by wrapping, so the overflow case has to be
  // made safe deliberately. The worst case must be inconvenient, never
  // invisible.
  const lvl = styleOf(SRC, LEVEL), zm = styleOf(SRC, ZOOM);
  ok('the levelling row scrolls rather than clipping a control',
     /overflow-x:auto/.test(lvl || ''), lvl);
  ok('the zoom row scrolls rather than clipping a control',
     /overflow-x:auto/.test(zm || ''), zm);
  ok('neither row hides an overflow outright',
     !/overflow-x:hidden/.test(lvl || '') && !/overflow-x:hidden/.test(zm || ''));
}

console.log('\n== C. The right controls are in the right group ==');
{
  const lvlBlock = rowBlock(SRC, LEVEL, ZOOM);
  const zmBlock  = rowBlock(SRC, ZOOM, null);

  ['_rrCropRotQtrL', '_rrCropRotMinus', '_rrCropRotV', '_rrCropRotPlus', '_rrCropRotQtrR']
    .forEach(function (id) {
      ok(id + ' is in the levelling row', lvlBlock.indexOf('id="' + id + '"') >= 0);
    });
  ['_rrCropZoomOut', '_rrCropZoomIn'].forEach(function (id) {
    ok(id + ' is in the zoom row', zmBlock.indexOf('id="' + id + '"') >= 0);
  });

  // The exact orphaning Brad photographed: ↻ 90° ending up beside "Zoom".
  ok('the RIGHT 90° button can no longer land beside the word Zoom',
     zmBlock.indexOf('_rrCropRotQtrR') < 0);
  ok('the reading sits BETWEEN the two half-degree steps',
     lvlBlock.indexOf('_rrCropRotMinus') < lvlBlock.indexOf('_rrCropRotV') &&
     lvlBlock.indexOf('_rrCropRotV') < lvlBlock.indexOf('_rrCropRotPlus'));
}

console.log('\n== D. The labels that bought the headroom ==');
{
  // "↺ 90°" → "↺90°" and "− 0.5°" → "−0.5°". Reads the same, noticeably
  // narrower. Together with dropping the word "Level" this takes row one from
  // about 850 points on Brad's phone to about 700, against ~860 available.
  ok('the 90° labels lost their inner space',
     labelOf(SRC, '_rrCropRotQtrL') === '\\u21ba90\\u00b0' &&
     labelOf(SRC, '_rrCropRotQtrR') === '\\u21bb90\\u00b0',
     labelOf(SRC, '_rrCropRotQtrL') + ' / ' + labelOf(SRC, '_rrCropRotQtrR'));
  ok('the half-degree labels lost theirs',
     labelOf(SRC, '_rrCropRotMinus') === '\\u22120.5\\u00b0' &&
     labelOf(SRC, '_rrCropRotPlus') === '+0.5\\u00b0',
     labelOf(SRC, '_rrCropRotMinus') + ' / ' + labelOf(SRC, '_rrCropRotPlus'));
  // Read off the BUTTONS, not the file: the comment above the markup spells
  // out the old forms in order to explain the change, and a file-wide search
  // matched it. Same trap as v1774's comment-matching check.
  ok('no BUTTON carries the old spaced form',
     STEPPERS.every(function (id) { return !/\s/.test(labelOf(SRC, id) || 'x'); }),
     STEPPERS.map(function (id) { return labelOf(SRC, id); }).join(' | '));

  const lvlBlock = rowBlock(SRC, LEVEL, ZOOM);
  ok('the word "Level" is gone — the buttons already say 90° and 0.5°',
     lvlBlock.indexOf('>Level<') < 0);
  // Deliberately NOT symmetrical: a bare − and + says nothing on its own.
  ok('…but the word "Zoom" STAYS, because − and + alone are ambiguous',
     rowBlock(SRC, ZOOM, null).indexOf('>Zoom<') >= 0);
}

console.log('\n== E. THE OFFENDERS: break each one, require red ==');
{
  function styleIn(src, id) { return styleOf(src, id) || ''; }

  // 1 — a row is allowed to wrap again. This is the regression itself.
  const bad1 = SRC.replace('id="_rrCropRowLevel" style="display:flex;align-items:center;gap:0.35rem;flex-wrap:nowrap',
                           'id="_rrCropRowLevel" style="display:flex;align-items:center;gap:0.35rem;flex-wrap:wrap');
  ok('letting the levelling row wrap again is caught',
     !/flex-wrap:nowrap/.test(styleIn(bad1, LEVEL)),
     'the seal check would have passed on broken source');

  // 2 — the clamp is dropped, so an over-wide row hides a control instead.
  const bad2 = SRC.replace(/overflow-x:auto;margin-top/, 'overflow-x:hidden;margin-top');
  ok('turning the zoom row\'s scroll into a clip is caught',
     /overflow-x:hidden/.test(styleIn(bad2, ZOOM)),
     'the clamp check would have passed on broken source');

  // 3 — the two groups are merged back into one row.
  const bad3 = SRC.replace('id="_rrCropRowZoom"', 'id="_rrCropRowGone"');
  ok('collapsing the two rows back into one is caught', styleOf(bad3, ZOOM) === null);

  // 4 — a rotation button drifts into the zoom group, which is exactly what
  //     the wrap used to do visually.
  const bad4 = SRC.replace('<button id="_rrCropRotQtrR"', '<button id="_rrCropZoomStray"')
                  .replace('<span style="color:#ccc;font-size:0.78rem;white-space:nowrap">Zoom</span>',
                           '<button id="_rrCropRotQtrR"></button><span style="color:#ccc;font-size:0.78rem;white-space:nowrap">Zoom</span>');
  ok('a 90° button drifting into the zoom row is caught',
     rowBlock(bad4, ZOOM, null).indexOf('_rrCropRotQtrR') >= 0,
     'the orphan check would have passed on broken source');

  // 5 — the spaced labels come back and eat the headroom. Note this offender
  //     edits the BUTTON, and the check reads the button — a version of this
  //     that edited the file anywhere would have been caught by the comment.
  const bad5 = SRC.replace('>\\u21ba90\\u00b0</button>', '>\\u21ba 90\\u00b0</button>');
  ok('the old wide label form coming back is caught',
     /\s/.test(labelOf(bad5, '_rrCropRotQtrL') || ''),
     'the label check would have passed on broken source');

  // 6 — styleOf must read the element's OWN style. A file-wide search matched
  //     a different div while this suite was being written and let offender 1
  //     walk past; the bug is worth a test of its own.
  ok('the reader takes the element\'s own style, not the first match in the file',
     styleIn(bad1, LEVEL) !== styleIn(SRC, LEVEL));
}

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
