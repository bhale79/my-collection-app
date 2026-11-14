// ── v0.9.1420 — the installed iPhone's status bar (Cooper) ────────────────
//
// "Cooper can't hit his name on the app because it's underneath his battery
// thingy." Installed as an app on an iPhone, the page draws under the status
// bar (viewport-fit=cover + black-translucent — both deliberate, both years
// old). The bottom nav learned env(safe-area-inset-bottom) in v0.9.1053; the
// header never got the top-side lesson, so the account chip sat beneath the
// clock and battery. Same for the three bars that pin to a screen edge.
//
// env(safe-area-inset-top) is 0 everywhere except installed notched phones,
// so these are no-ops on desktop and Android — the layout suites prove that
// side; THIS suite pins the shape so the padding cannot quietly fall out.

const fs = require('fs');
const path = require('path');
const APP = n => path.join(__dirname, '..', 'app', n);

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}

const CSS  = fs.readFileSync(APP('app.css'), 'utf8');
const MISC = fs.readFileSync(APP('app-misc.js'), 'utf8');
const ONB  = fs.readFileSync(APP('onboarding.js'), 'utf8');
const ERR  = fs.readFileSync(APP('error-report.js'), 'utf8');
const IDX  = fs.readFileSync(APP('index.html'), 'utf8');

console.log('\n== The header clears the status bar ==');
const header = CSS.slice(CSS.indexOf('.header {'), CSS.indexOf('.header-logo'));
ok('the header grows by the top inset',
   /height: calc\(var\(--header-h\) \+ env\(safe-area-inset-top, 0px\)\);/.test(header));
ok('...and pads its content below the inset',
   /padding-top: env\(safe-area-inset-top, 0px\);/.test(header));
// The old `padding: 0 1.25rem` shorthand would RESET padding-top to zero if it
// ever came back after the padding-top line — the drill for this whole fix.
ok('no padding shorthand survives to clobber the top inset',
   !/padding:\s*0 1\.25rem/.test(header),
   'a `padding: 0 1.25rem` shorthand would zero the safe-area padding');
ok('...the sides are padded longhand instead',
   /padding-left: 1\.25rem; padding-right: 1\.25rem;/.test(header));
// 2026-11-14 (filtersheet): a second reader IS allowed — the phone Filters sheet
// caps its panel below the top bar — but only when it adds the top inset in the
// same breath, the way the header itself does. A bare var(--header-h) anywhere
// would be 0-59px out on an installed iPhone, and still turns this red.
const hdrReaders = CSS.split('\n').filter(l => /var\(--header-h\)/.test(l));
ok('every reader of var(--header-h) adds env(safe-area-inset-top) on the same line (header + the Filters sheet cap)',
   hdrReaders.length >= 1 && hdrReaders.every(l => /env\(safe-area-inset-top, 0px\)/.test(l)),
   'a bare reader would be 0-59px out on an installed iPhone: ' + hdrReaders.filter(l => !/env\(safe-area-inset-top, 0px\)/.test(l)).map(l => l.trim().slice(0, 60)).join(' | '));
{ // the guard can fail: a reader without the inset, planted
  const planted = (CSS + '\n.rr-planted { top: var(--header-h); }\n').split('\n').filter(l => /var\(--header-h\)/.test(l));
  ok('...and a bare reader planted at the end turns it red', !planted.every(l => /env\(safe-area-inset-top, 0px\)/.test(l)));
}

console.log('\n== The edge-pinned bars ==');
ok('the offline banner pads under the status bar',
   /'top:0',\n[\s\S]{0,140}'padding-top:env\(safe-area-inset-top, 0px\)',/.test(MISC));
// v0.9.1893: the onboarding "Back to the tour" bar is gone with the card-list
// welcome screen it served (Brad: "more clutter than help"). Nothing in
// onboarding.js pins itself to the top edge any more — pinned to stay that way,
// so a bar that comes back has to come back with its safe-area padding.
ok('onboarding.js pins no bar to the top edge (the return bar is gone)',
   !/position:fixed;top:0/.test(ONB) && !/onboarding-return-bar/.test(ONB));
// v0.9.2055 (sweep A1): the home-bar room is read ONCE, as --rr-safe-b in app.css's
// :root; every bottom-pinned bar adds it (the whole-app rule is home_bar_2055_tests).
ok('the report-draft restore bar clears the home indicator',
   /bottom:0;padding:0\.85rem 1rem calc\(0\.85rem \+ var\(--rr-safe-b, 0px\)\);/.test(ERR));
// 2026-11-01 (Brad's iPhone, PLAN_2026-11-01_APPLE_SCREENS.md): the bar counted the home strip TWICE —
// height 68px + strip AND padding-bottom = strip (content-box: 145px on an iPhone, a dead band). It is now
// added ONCE, as the bottom padding; the height is the 68px of buttons. Seen red against the old pin first.
ok('the bottom nav still clears the home strip — ONCE, as its bottom padding (regression pin, through --rr-safe-b)',
   /:root \{ --rr-safe-b: env\(safe-area-inset-bottom, 0px\); \}/.test(CSS) &&
   /\.mobile-nav \{\s*padding-bottom: max\(0\.5rem, var\(--rr-safe-b\)\);\s*height: 68px;\s*\}/.test(CSS) &&
   !/height: calc\(68px \+ var\(--rr-safe-b\)\)/.test(CSS));

console.log('\n== The contract that makes insets exist at all ==');
ok('viewport-fit=cover is still declared (removing it would "fix" this by undoing the look Brad chose)',
   /viewport-fit=cover/.test(IDX));
ok('the translucent status bar is still declared',
   /apple-mobile-web-app-status-bar-style" content="black-translucent"/.test(IDX));

console.log('\n' + (fail ? 'FAILED' : 'OK') + '  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
