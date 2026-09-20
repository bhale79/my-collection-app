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
ok('...listening for a click OR a keypress (v1696: click, not pointerdown — Safari/touch never counted it)',
   /addEventListener\('click', go, true\)[\s\S]{0,120}addEventListener\('keydown', go, true\)/.test(src));
ok('...and the listeners remove themselves once used',
   /removeEventListener\('click', go, true\)/.test(src));
ok('...and a reader is never nagged: no idle timer to the card (v1696)',
   !/no tap for 90s/.test(src));

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


// ═══════════════════════════════════════════════════════════════
// v0.9.1792 — BRAD'S OWN TIMELINE, RUN AS A TEST.
//
// 2026-09-20, from the sign-in diary he sent:
//   20:12:53  token ok (refresh)          -> good until 21:07:53
//   20:53:17  renewing (heartbeat)        -> 14m36s left. NOT expired.
//   20:54:53  reconnect card SHOWN        <- WHILE HE COULD STILL WORK
//   20:55-20:57  four Reconnect taps, four consent flows, NO result of any kind
//   20:59:02  boot: token restored, 9 min left / token ok   <- SAME TOKEN, fine
//
// Boot said nine minutes was fine. The heartbeat said fourteen meant logged
// out. One function was answering both questions. These run the REAL
// predicates against those real numbers.
// ═══════════════════════════════════════════════════════════════
console.log('');
console.log('== Brad\'s 2026-09-20 timeline, run against the real predicates ==');
{
  function lift(name) {
    const i = src.indexOf('function ' + name + '(');
    let d = 0;
    for (let k = src.indexOf('{', i); k < src.length; k++) {
      if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); }
    }
    return '';
  }
  const MARGIN = (src.match(/_RR_TOKEN_MARGIN_MS = ([^;]+);/) || [])[1];
  const USABLE = (src.match(/_RR_TOKEN_USABLE_MS = ([^;]+);/) || [])[1];
  ok('there are now TWO margins, because there are two questions', !!MARGIN && !!USABLE,
     'renew ' + MARGIN + ' / usable ' + USABLE);

  function predicates(msLeft) {
    const store = { lv_token_expiry: String(Date.now() + msLeft) };
    return new Function('accessToken', 'localStorage', 'Date',
      'var _RR_TOKEN_MARGIN_MS = ' + MARGIN + ';\n' +
      'var _RR_TOKEN_USABLE_MS = ' + USABLE + ';\n' +
      lift('_rrTokenExpiry') + '\n' + lift('_rrTokenFresh') + '\n' + lift('_rrTokenUsable') + '\n' +
      'return { fresh: _rrTokenFresh, usable: _rrTokenUsable };'
    )('a-real-token', { getItem: k => (k in store ? store[k] : null) }, Date);
  }

  const at2053 = predicates(14 * 60000 + 36000);   // 14m36s left — the heartbeat moment
  ok('14m36s left: a renewal is DUE...', at2053.fresh() === false);
  ok('…but he is NOT locked out, so no banner — THE BUG HE REPORTED', at2053.usable() === true);

  const at2059 = predicates(9 * 60000);            // 9 min left — what boot called fine
  ok('9 min left: boot called this fine, and now the heartbeat agrees', at2059.usable() === true);
  ok('…and a renewal is still due, which is right', at2059.fresh() === false);

  const dead = predicates(-60000);                 // actually expired
  ok('an EXPIRED token is not usable — the banner is correct then', dead.usable() === false);
  const fresh = predicates(55 * 60000);
  ok('a brand-new token is both fresh and usable', fresh.fresh() === true && fresh.usable() === true);

  ok('the banner asks "can he work?", never "is a renewal due?"',
     /if \(_rrTokenUsable\(\)\) return;\s*\n\s*if \(document\.getElementById\('rr-reconnect-bar'\)\) return;/.test(src));
  ok('a failed renewal stays QUIET while the old token still works',
     /if \(!_rrTokenUsable\(\)\) _rrShowReconnect\(\);/.test(src));
}

console.log('');
console.log('== The six-minute silence: four popups, no answer of any kind ==');
{
  // `callback` only fires for a token RESPONSE. A popup that is blocked,
  // dismissed or cannot open is reported through error_callback — which this
  // client did not have, so four failures were dropped on the floor.
  ok('the main token client now reports popup failures at all',
     /callback: onTokenReceived,[\s\S]{0,2200}error_callback: function \(err\)/.test(src));
  ok('…and writes them to the diary Brad can send',
     /_rrAuthLog\('token popup FAILED: ' \+ type\)/.test(src));
  ok('…and re-enables the button, so it is not left saying "Reconnecting…" forever',
     /b\.disabled = false; b\.textContent = 'Reconnect';/.test(src));
  ok('a BLOCKED popup says what to do instead of leaving him tapping',
     /popup_failed_to_open[\s\S]{0,200}Allow pop-ups/.test(src));
  ok('the extra-scope client has one too — same blind spot',
     /extra-scope popup FAILED: /.test(src));
  ok('an ABSENT answer is recorded, so a silence is never again a blank gap',
     /consent returned NOTHING after 90s/.test(src));
  ok('…and it waits long enough for two Google screens and a considered click',
     /\}, 90000\);/.test(src));
  ok('a consent request that THROWS is recorded too',
     /consent request THREW: /.test(src));
}

console.log('');
console.log('== Planted offenders — these rules can actually fail ==');
{
  // ⚠ SCOPED ON PURPOSE. `if (_rrTokenUsable()) return;` appears TWICE — in
  // _rrShowReconnect and in the 90-second silence check — and a bare
  // src.replace() takes the FIRST, planting the offender in a function this
  // rule does not govern and leaving the real one untouched. The suite then
  // "failed" while the code was correct. This is the recorded rule (a rule
  // written twice defeats its own offender) arriving again; the answer is to
  // operate on the function under test, not on the whole file.
  const showFn = (function () {
    const i = src.indexOf('function _rrShowReconnect(');
    let d = 0;
    for (let k = src.indexOf('{', i); k < src.length; k++) {
      if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); }
    }
    return '';
  })();
  ok('the offender is planted in _rrShowReconnect itself', /_rrTokenUsable\(\)/.test(showFn));
  const conflated = showFn.replace('if (_rrTokenUsable()) return;', 'if (_rrTokenFresh()) return;');
  ok('going back to ONE question for both is caught — the original bug',
     !/_rrTokenUsable\(\)/.test(conflated) && /_rrTokenFresh\(\)/.test(conflated));
  const noErr = src.replace(/error_callback: function \(err\)/g, 'xx_callback: function (err)');
  ok('losing error_callback is caught — the six-minute silence returns',
     !/callback: onTokenReceived,[\s\S]{0,2200}error_callback:/.test(noErr));
  const impatient = src.replace(/\}, 90000\);/, '}, 6000);');
  ok('shortening the silence check to 6s is caught — he cannot read two screens that fast',
     !/\}, 90000\);/.test(impatient));
}

console.log('');
console.log(fail === 0 ? 'ALL TOKEN-KEEPER TESTS GREEN (' + pass + ')' : fail + ' FAILING of ' + (pass + fail));
process.exit(fail === 0 ? 0 : 1);
