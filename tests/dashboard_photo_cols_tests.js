// ════════════════════════════════════════════════════════════════════════
// dashboard_photo_cols_tests.js — v0.9.1776
//
// Brad, 2026-09-19: the full Photo Inbox page showed ONE photo across on his
// phone while the Dashboard's inbox card showed three. "lets just go two wide."
//
// The fix makes both pages ask the SAME helper, which means _dashPhotoCols now
// has a second caller with different numbers. THAT is the risk in this change:
// the Showcase and the Dashboard card have used this helper since v0.9.893 and
// nobody would notice for weeks if their columns quietly moved.
//
// Section A therefore pins the OLD behaviour at a spread of widths — computed
// from the pre-change formula Math.max(3, floor(w / (104 * fs))) — and Section
// B pins the new inbox behaviour. Section E plants five offenders and requires
// each to be caught.
//
// Everything here runs the REAL helper, lifted out of dashboard.js.
// ════════════════════════════════════════════════════════════════════════
const fs_ = require('fs');
const path = require('path');

const DASH  = fs_.readFileSync(path.join(__dirname, '..', 'app', 'dashboard.js'), 'utf8');
const INBOX = fs_.readFileSync(path.join(__dirname, '..', 'app', 'photo-inbox.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}

// The helper is an assignment, not a declaration — brace-match from the '{'
// after the arrow into `window._dashPhotoCols = function (`.
function grabHelper(src) {
  const i = src.indexOf('window._dashPhotoCols = function (');
  if (i < 0) throw new Error('could not find _dashPhotoCols');
  let d = 0; const s0 = src.indexOf('{', i);
  for (let k = s0; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); }
  }
  throw new Error('unbalanced braces in _dashPhotoCols');
}

// Build the real helper with a fake document/getComputedStyle so the text-size
// branch can be driven from a test. Nothing is reimplemented.
function makeCols(src, rootFontPx) {
  const body = grabHelper(src === undefined ? DASH : src);
  return new Function('__FS__',
    'var window = {};' +
    'var document = { documentElement: {} };' +
    'function getComputedStyle() { return { fontSize: __FS__ + "px" }; }' +
    body +
    '\nreturn window._dashPhotoCols;')(rootFontPx === undefined ? 16 : rootFontPx);
}
const grid = (w) => ({ clientWidth: w });

// The formula as it stood BEFORE this change. The expected numbers in section
// A come from here, not from hand-typed constants, so the pin says what it
// means: "the dashboard's answer did not move."
const oldCols = (w, fsPx) => {
  const f = Math.max(1, (fsPx || 16) / 16);
  return Math.max(f > 1.15 ? 2 : 3, Math.floor(w / (104 * f)));
};

console.log('\n== A. THE REGRESSION GUARD: the Dashboard card and Showcase did not move ==');
{
  const cols = makeCols();
  [258, 300, 328, 390, 420, 500, 768, 1000, 1400].forEach(function (w) {
    const want = oldCols(w, 16);
    ok('regular text, ' + w + 'px wide -> ' + want + ' columns, same as before',
       cols(grid(w)) === want, 'got ' + cols(grid(w)));
  });

  // Enlarged accessibility text: the old rule dropped the floor from 3 to 2.
  const big = makeCols(undefined, 20);   // fs = 1.25, above the 1.15 threshold
  [258, 390, 500, 1000].forEach(function (w) {
    const want = oldCols(w, 20);
    ok('enlarged text, ' + w + 'px wide -> ' + want + ' columns, same as before',
       big(grid(w)) === want, 'got ' + big(grid(w)));
  });

  ok('a missing grid still answers (the 500px assumption is unchanged)',
     cols(null) === oldCols(500, 16), 'got ' + cols(null));
  ok('passing no options is the same as the old single-argument call',
     cols(grid(390)) === cols(grid(390), {}), 'options object must not change the defaults');
}

console.log('\n== B. The Photo Inbox page: two across on a phone ==');
{
  const cols = makeCols();
  const PIN = { target: 150, min: 2, minLarge: 2 };

  // Brad's phone. ~320pt viewport, less page margins and the dashed drop-zone's
  // 0.8rem padding, leaves roughly 258px of grid — which is where CSS gave up
  // and drew one tile.
  ok('258px (Brad\'s phone) -> 2 across, the whole point of this change',
     cols(grid(258), PIN) === 2, 'got ' + cols(grid(258), PIN));
  ok('…and never 1, which is the bug being fixed', cols(grid(258), PIN) !== 1);
  ok('200px, narrower still -> still 2', cols(grid(200), PIN) === 2);
  ok('328px -> 2', cols(grid(328), PIN) === 2, 'got ' + cols(grid(328), PIN));
  ok('500px -> 3', cols(grid(500), PIN) === 3, 'got ' + cols(grid(500), PIN));
  ok('1000px desktop -> 6, what auto-fill already gave', cols(grid(1000), PIN) === 6,
     'got ' + cols(grid(1000), PIN));

  // The floor is HARD here on purpose: enlarged text dropping this page back to
  // one column would re-create exactly the thing Brad reported.
  const big = makeCols(undefined, 22);   // fs = 1.375
  ok('enlarged text still gives 2, never 1 (a hard floor, unlike the dashboard)',
     big(grid(258), PIN) === 2, 'got ' + big(grid(258), PIN));
}

console.log('\n== C. The page actually uses it ==');
{
  ok('the inbox declares its own numbers in ONE place',
     /var PIN_COLS = \{ target: 150, min: 2, minLarge: 2 \};/.test(INBOX));
  ok('…and hands them to the SHARED helper, not a second copy of the rule',
     /window\._dashPhotoCols\(grid, PIN_COLS\)/.test(INBOX));
  ok('_render sets the columns every time it draws',
     /function _render\(\) \{[\s\S]{0,400}?_pinApplyCols\(\);/.test(INBOX));
  ok('rotating the phone re-counts them',
     /addEventListener\('resize'[\s\S]{0,200}?_pinApplyCols/.test(INBOX));
  ok('…debounced, so a toolbar sliding away does not thrash the grid',
     /clearTimeout\(_pinColsT\)[\s\S]{0,160}?setTimeout\(_pinApplyCols, 150\)/.test(INBOX));
  ok('…and hooked only once',
     /if \(!window\._pinColsHooked &&/.test(INBOX));
  // This file is EVAL'd whole by photo-inbox-tests.js against a stub window.
  // An unguarded addEventListener threw there and took 3,999 assertions down
  // with it, which is how the guard came to exist. Keep it.
  ok('…and never needs a real browser just to finish loading',
     /window\._pinColsHooked && typeof window\.addEventListener === 'function'/.test(INBOX));
  ok('the helper is reached defensively — a missing dashboard.js cannot blank the grid',
     /typeof window\._dashPhotoCols === 'function'/.test(INBOX));

  // v0.9.1595's phone grouping mode halves the tiles for multi-select by
  // overriding #pin-grid from app.css. Setting the columns from JS creates an
  // INLINE declaration, and the only reason grouping still wins is that the
  // stylesheet rule carries !important. If that ever came off, grouping would
  // silently stop shrinking the tiles — so pin it here, next to the change
  // that made it load-bearing.
  const CSS = fs_.readFileSync(path.join(__dirname, '..', 'app', 'app.css'), 'utf8');
  const at = CSS.indexOf('#page-photo-inbox.pin-grp-slim #pin-grid');
  const rule = at >= 0 ? CSS.slice(at, CSS.indexOf('}', at) + 1) : '';
  ok('phone grouping mode still overrides the JS column count',
     /!important/.test(rule), rule || 'slim #pin-grid rule missing');
  ok('…and the inline 150px minimum it halves is left alone',
     /minmax\(150px,1fr\)/.test(INBOX));
}

console.log('\n== D. The Showcase and the card still call it the old way ==');
{
  const calls = DASH.match(/_dashPhotoCols\(grid[^)]*\)/g) || [];
  ok('dashboard.js passes no options anywhere (so it keeps 104 / 3 / 2)',
     calls.length >= 2 && calls.every(function (c) { return /_dashPhotoCols\(grid\)$/.test(c); }),
     JSON.stringify(calls));
  const panel = INBOX.match(/_dashPhotoCols\(grid\)(?!\s*,)/g) || [];
  ok('the dashboard INBOX CARD inside photo-inbox.js also passes no options',
     panel.length === 1, 'found ' + panel.length + ' — the card must keep 3 across');
}

console.log('\n== E. THE OFFENDERS: break each one, require red ==');
{
  const PIN = { target: 150, min: 2, minLarge: 2 };

  // 1 — someone "simplifies" the default tile width to match the inbox's.
  const bad1 = makeCols(DASH.replace('opts.target   || 104', 'opts.target   || 150'));
  ok('moving the DEFAULT tile width is caught by the dashboard pin',
     bad1(grid(500)) !== oldCols(500, 16), 'the A-section pins would have passed on broken source');

  // 2 — someone drops the default floor back to whatever fits.
  const bad2 = makeCols(DASH.replace('(opts.min      == null) ? 3 : opts.min', 'opts.min || 1'));
  ok('losing the dashboard\'s floor of 3 is caught',
     bad2(grid(258)) !== oldCols(258, 16), 'the A-section pins would have passed on broken source');

  // 3 — the inbox floor is relaxed and a narrow phone goes back to one tile.
  const bad3 = makeCols();
  ok('a floor of 1 on the inbox puts Brad back where he started',
     bad3(grid(258), { target: 150, min: 1, minLarge: 1 }) === 1,
     'if this is not 1, the 258px check below proves nothing');
  ok('…which is exactly what the B-section check would catch',
     bad3(grid(258), PIN) === 2);

  // 4 — the enlarged-text branch stops respecting the caller's floor.
  const bad4 = makeCols(DASH.replace('fs > 1.15 ? minLarge : min', 'fs > 1.15 ? 1 : min'), 22);
  ok('hard-coding the enlarged-text floor is caught',
     bad4(grid(258), PIN) !== 2, 'the enlarged-text check would have passed on broken source');

  // 5 — the call is dropped from _render and the grid goes back to guessing.
  const bad5 = INBOX.replace(/\n    _pinApplyCols\(\);/, '');
  ok('dropping _pinApplyCols() from _render is caught',
     !/function _render\(\) \{[\s\S]{0,400}?_pinApplyCols\(\);/.test(bad5));
}

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
