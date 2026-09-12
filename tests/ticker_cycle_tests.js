// ═══════════════════════════════════════════════════════════════
// ticker_cycle_tests.js — v0.9.1720.
//
// Brad: "the pictures scrolling from right to left are the same 18 or so
// pictures. its should be going throught the complete collection of pictures.
// also would be nice to have below the scrolling pictures a speed up down
// arrows".
//
// The cause was a single call: _tickerFill asked for 18 thumbnails once when
// the dashboard built, drew them twice so the CSS loop joins up, and never
// asked again. These pins hold the fix in place — a QUEUE with a cursor that
// survives refills, and a refill bound to the animation's join.
//
// Run:  node tests/ticker_cycle_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const dash = fs.readFileSync(path.join(__dirname, '..', 'app', 'dashboard.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name + (detail ? '  -> ' + detail : '')); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

// ── the queue ───────────────────────────────────────────────────
section('The whole collection, not the same 18');
ok('the ticker draws from a queue, not a fresh random pick each time',
   /_tickerBatch\(18, 8\)/.test(dash) && !/_tickerFill[\s\S]{0,400}?_pickThumbs\(18/.test(dash));
ok('the cursor lives OUTSIDE the batch call, so it survives a refill',
   /window\._tickerAt\s*=\s*0;/.test(dash) && /window\._tickerAt\+\+/.test(dash));
ok('the queue is built once and reused', /if \(!Array\.isArray\(window\._tickerQueue\) \|\| !window\._tickerQueue\.length\)/.test(dash));
ok('a completed cycle reshuffles, so the second pass is not a rerun',
   /window\._tickerAt = 0;[\s\S]{0,260}?Math\.floor\(Math\.random\(\) \* \(a \+ 1\)\)/.test(dash));
ok('the walk is bounded — a spent resolve cap cannot spin forever',
   /scanned < q\.length/.test(dash));
ok('_pickThumbs is left alone for its other callers (the dashboard reels)',
   /_reelStart[\s\S]{0,300}?_pickThumbs\(8, 4\)/.test(dash));

// ── the refill is bound to the join ─────────────────────────────
section('Refilling where the loop joins');
ok('it refills on animationiteration, not on a timer',
   /addEventListener\('animationiteration'/.test(dash) && !/setInterval\([^)]*_tickerFill/.test(dash));
ok('the listener is bound ONCE, not stacked on every refill', /_rrCycleBound/.test(dash));
ok('a refill still in flight cannot start another', /window\._tickerFilling/.test(dash));
ok('a failed refill clears the flag instead of wedging the strip',
   /\.catch\(function \(\) \{\}\)[\s\S]{0,120}?_tickerFilling = false/.test(dash));

// ── the speed arrows ────────────────────────────────────────────
section('The speed arrows');
ok('there are two arrows under the pictures', /_tickerSpeedStep\(-1\)/.test(dash) && /_tickerSpeedStep\(1\)/.test(dash));
ok('they sit OUTSIDE the clipped scroller, or they would be cut off',
   dash.indexOf('rr-ticker-wrap') < dash.indexOf('rr-ticker-slower'));
ok('the choice is remembered per device', /lv_dash_ticker_speed/.test(dash));
ok('speed is a multiplier, so an arrow feels the same whatever is on screen',
   /RR_TICKER_SPEEDS = \[0\.5, 0\.75, 1, 1\.5, 2, 3\]/.test(dash));
ok('the ends of the range disable their arrow rather than doing nothing',
   /slower\.disabled = \(idx === 0\)/.test(dash) && /faster\.disabled = \(idx === RR_TICKER_SPEEDS\.length - 1\)/.test(dash));
ok('a speed change RESUMES where it was — no snap back to the start',
   /animationDelay = '-'/.test(dash) && /frac/.test(dash));

// ── the things that must NOT restart a running animation ────────
// Rewriting an animation property mid-flight restarts it, and the strip jumps
// at the join — the exact ugliness this fix exists to avoid.
section('Nothing makes the strip jump');
ok('the base duration is measured once per strip, not per refill', /window\._tickerBaseSet/.test(dash));
ok('a fresh strip measures it again', /window\._tickerBaseSet = false/.test(dash));
ok('the duration is only written when it actually changes',
   /Math\.abs\(newDur - oldDur\) > 0\.01/.test(dash));

console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
