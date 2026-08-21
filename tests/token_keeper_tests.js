// ═══════════════════════════════════════════════════════════════
// token_keeper_tests.js — Session 82.
//
// Brad's second account showed an empty Master Catalog. Cause: a Google
// access token expires after an hour, the quiet renewal needs an active
// Google session for that account, and when it cannot get one it falls back
// to a popup — which the browser blocks because nobody clicked anything. The
// app then rendered "No items match your filters" over 3,370 items.
//
// Brad: "we don't ever need a token to fail... i don't want the user to have
// to sign out and sign back in for a stupid token. they won't understand
// that."
//
// Run:  node tests/token_keeper_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'app', 'app-auth.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('PASS  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
  else { fail++; console.log('FAIL  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
}

// Layer 1 — renew early, and keep checking while the app is open.
ok('there is ONE owner for renewals', /function rrEnsureFreshToken/.test(src));
ok('it renews with time to spare, not at the last minute',
   /_RR_TOKEN_MARGIN_MS = 15 \* 60 \* 1000/.test(src));
ok('a heartbeat checks while the app is open', /setInterval\(function \(\) \{ rrEnsureFreshToken\('heartbeat'\)/.test(src));
ok('coming back to the tab checks too', /rrEnsureFreshToken\('resume'\)/.test(src));
ok('the scheduled renewal runs at 45 minutes, not 55',
   /rrEnsureFreshToken\('scheduled'\);\s*\}, 45 \* 60 \* 1000\)/.test(src));
ok('a healthy token means no request at all',
   /if \(_rrTokenHealthy\(\) \|\| _rrTokenRenewing\) return;/.test(src));

// Layer 2 — the click retry, which is the fix for the case Brad hit.
ok('a blocked renewal waits for the next click', /function _rrArmGestureRenew/.test(src));
ok('...listening for a click OR a keypress',
   /addEventListener\('pointerdown', go, true\)[\s\S]{0,120}addEventListener\('keydown', go, true\)/.test(src));
ok('...and the listeners remove themselves once used',
   /removeEventListener\('pointerdown', go, true\)/.test(src));

// Layer 3 — asking, only as a last resort, and never a sign-out.
ok('the banner is the LAST resort', /function _rrShowReconnect/.test(src));
ok('...it says the collection is safe', /your collection is safe in your Google Sheet/.test(src));
ok('...and offers Reconnect, never Sign out', /Reconnect<\/button>/.test(src) && !/Sign out.*reconnect/i.test(src));
ok('the app is NOT thrown back to sign-in while it is open and showing data',
   /if \(_appOpen && _appOpen\.classList\.contains\('active'\)\) \{\s*_rrArmGestureRenew\(\);\s*return;/.test(src));
ok('...but a cold start with no token still gets the sign-in screen',
   /Nothing on screen yet — the sign-in screen IS the right answer here/.test(src));

// Getting the token back has to bring the data back.
ok('a token restored over an empty app reloads the data',
   /_empty && typeof loadAllData === 'function'[\s\S]{0,160}loadAllData\(\)/.test(src));
ok('a successful token clears the banner and the flags',
   /_rrTokenRenewing = false;\s*_rrTokenGestureArmed = false;[\s\S]{0,140}rr-reconnect-bar/.test(src));

console.log('');
console.log(fail === 0 ? 'ALL TOKEN-KEEPER TESTS GREEN (' + pass + ')' : fail + ' FAILING of ' + (pass + fail));
process.exit(fail === 0 ? 0 : 1);
