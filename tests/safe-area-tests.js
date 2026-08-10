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
ok('nothing else positions off a bare var(--header-h)',
   (CSS.match(/var\(--header-h\)/g) || []).length === 1,
   'a second reader would now be 0-59px out on an installed iPhone');

console.log('\n== The edge-pinned bars ==');
ok('the offline banner pads under the status bar',
   /'top:0',\n[\s\S]{0,140}'padding-top:env\(safe-area-inset-top, 0px\)',/.test(MISC));
ok('the onboarding return bar clears the status bar',
   /padding:max\(0\.75rem, env\(safe-area-inset-top, 0px\)\) 1rem 0\.75rem;/.test(ONB));
ok('the report-draft restore bar clears the home indicator',
   /bottom:0;padding:0\.85rem 1rem max\(0\.85rem, env\(safe-area-inset-bottom, 0px\)\);/.test(ERR));
ok('the bottom nav still has its v0.9.1053 inset (regression pin)',
   /env\(safe-area-inset-bottom\)/.test(CSS));

console.log('\n== The contract that makes insets exist at all ==');
ok('viewport-fit=cover is still declared (removing it would "fix" this by undoing the look Brad chose)',
   /viewport-fit=cover/.test(IDX));
ok('the translucent status bar is still declared',
   /apple-mobile-web-app-status-bar-style" content="black-translucent"/.test(IDX));

console.log('\n' + (fail ? 'FAILED' : 'OK') + '  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
