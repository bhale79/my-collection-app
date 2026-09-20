// ═══════════════════════════════════════════════════════════════
// onboarding_gate_tests.js — Session 86. The era-picker Save gate.
//
// Brad, live repro: "you select several and then cant move forward.
// its grayed out. you can select all and move forward." The v1415
// blank-start gate (Save disabled until ≥1 era chosen) was only
// re-synced by the BULK buttons and the screen-open call — the
// individual checkboxes never called onboardEraSync, so hand-picking
// eras left Save disabled for exactly the careful users.
//
// Run:  node tests/onboarding_gate_tests.js
// Proven to FAIL on v0.9.1583 before the fix.
// ═══════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const ob = fs.readFileSync(path.join(__dirname, '..', 'app', 'onboarding.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('PASS  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
  else { fail++; console.log('FAIL  ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
}

ok('THE BUG: every era checkbox re-syncs the gate when toggled BY HAND',
   /data-era="' \+ _escape\(eraKey\)[\s\S]{0,700}onchange="onboardEraSync\(\)"/.test(ob));
ok('the gate itself still exists (Save disabled at zero chosen, v1415)',
   /save\.disabled = off/.test(ob) && /n === 0/.test(ob));
ok('…with the honest tooltip naming the way out',
   /Pick at least one, or use Skip/.test(ob));
ok('the bulk buttons still sync (Select all / Clear all)',
   /onboardEraSelectAll[\s\S]{0,200}onboardEraSync\(\)/.test(ob));
ok('the screen-open sync still runs (detached-DOM timing respected)',
   /setTimeout\(function \(\) \{ try \{ onboardEraSync\(\); \}/.test(ob));
ok('the chosen-count label still reports live',
   /onboarding-era-count/.test(ob) && /of ' \+ boxes\.length \+ ' chosen/.test(ob));

// ═══════════════════════════════════════════════════════════════
// v0.9.1793 — THE WELCOME SEQUENCE BELONGS TO THE ACCOUNT, NOT THE MACHINE.
//
// [stated] Brad, after signing out and back in: "it starts me completely
// over", and on what it should do: "it should just go straight to the apps
// dashboard page." But it cannot simply survive a sign-out either — [stated]
// "a user may be at a friends house": a DIFFERENT person signing in on this
// machine must still get the whole sequence.
//
// The three screens are three different KINDS of thing wearing one coat: a
// tour, a setting (which eras), and a consent decision (contribute). Only the
// first is really a tour; the other two are answers this person already gave.
// ═══════════════════════════════════════════════════════════════
console.log('\n== v1793: the welcome sequence is gated per ACCOUNT ==');
{
  const APP = fs.readFileSync(path.join(__dirname, '..', 'app', 'app.js'), 'utf8');
  const SETUP = fs.readFileSync(path.join(__dirname, '..', 'app', 'app-setup.js'), 'utf8');
  const CFG = fs.readFileSync(path.join(__dirname, '..', 'app', 'config.js'), 'utf8');

  // Run the REAL fingerprint and the REAL gate against a fake window.
  function lift(src, name) {
    const i = src.indexOf('function ' + name + '(');
    let d = 0;
    for (let k = src.indexOf('{', i); k < src.length; k++) {
      if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); }
    }
    return '';
  }
  function harness(storedValue, email) {
    const store = {}; if (storedValue !== null) store.lv_onboarded = storedValue;
    const win = { state: { user: email ? { email: email } : null } };
    const ls = { getItem: k => (k in store ? store[k] : null),
                 setItem: (k, v) => { store[k] = String(v); } };
    const api = new Function('window', 'state', 'localStorage',
      "var RR_ONBOARDED_KEY = 'lv_onboarded';\n"
      + lift(APP, 'rrAccountFingerprint') + '\n'
      + lift(APP, 'rrMarkOnboardingSeen') + '\n'
      + lift(APP, 'rrOnboardingSeenByCurrentAccount') + '\n'
      + 'return { fp: rrAccountFingerprint, mark: rrMarkOnboardingSeen, seen: rrOnboardingSeenByCurrentAccount };'
    )(win, win.state, ls);
    return { api, store };
  }

  const BRAD = 'bhale@ipd-llc.com', FRIEND = 'someone.else@gmail.com';

  let h = harness(null, BRAD);
  ok('a brand-new account has not seen it', h.api.seen() === false);
  h.api.mark();
  ok('finishing records something', !!h.store.lv_onboarded);
  ok('…and it is NOT the email address — this key outlives sign-out',
     h.store.lv_onboarded.indexOf('@') < 0 && h.store.lv_onboarded.indexOf('bhale') < 0,
     h.store.lv_onboarded);
  ok('the same account, signing back in, goes straight to the dashboard — THE FIX',
     h.api.seen() === true);

  const mark = h.store.lv_onboarded;
  h = harness(mark, FRIEND);
  ok('a DIFFERENT account on the same machine still gets the whole sequence — the friend\'s house',
     h.api.seen() === false);

  h = harness(mark, '');
  ok('no account known yet → ask, never guess', h.api.seen() === false);

  h = harness('1', BRAD);
  ok('the OLD device-wide "1" is not mistaken for any account', h.api.seen() === false);

  ok('two different addresses do not collide',
     harness(null, BRAD).api.fp(BRAD) !== harness(null, FRIEND).api.fp(FRIEND));
  ok('the same address is stable, and case/space do not matter',
     harness(null, BRAD).api.fp('  BHale@IPD-LLC.com ') === harness(null, BRAD).api.fp(BRAD));

  ok('the gate asks the ACCOUNT question, not the device one',
     /if \(rrOnboardingSeenByCurrentAccount\(\)\) return;/.test(SETUP)
     && !/if \(localStorage\.getItem\('lv_onboarded'\)\) return;/.test(SETUP));
  ok('finishing the tour records it through the one helper',
     /rrMarkOnboardingSeen\(\)/.test(ob) && !/setItem\('lv_onboarded', '1'\)/.test(ob));
  ok('the marker survives sign-out, which is the whole point',
     /'lv_onboarded',/.test(CFG.slice(CFG.indexOf('SIGNOUT_KEEP_KEYS'), CFG.indexOf('SIGNOUT_KEEP_PREFIXES'))));
}

console.log('\n== v1793: planted offenders ==');
{
  const APP = fs.readFileSync(path.join(__dirname, '..', 'app', 'app.js'), 'utf8');
  const SETUP = fs.readFileSync(path.join(__dirname, '..', 'app', 'app-setup.js'), 'utf8');
  const CFG = fs.readFileSync(path.join(__dirname, '..', 'app', 'config.js'), 'utf8');
  ok('going back to the device-wide gate is caught',
     !/rrOnboardingSeenByCurrentAccount/.test(
       SETUP.replace('if (rrOnboardingSeenByCurrentAccount()) return;',
                     "if (localStorage.getItem('lv_onboarded')) return;")));
  ok('storing the EMAIL instead of a fingerprint is caught',
     /return \(h1 >>> 0\)\.toString\(36\)/.test(APP));
  ok('dropping the marker from the keep-list is caught — the tour would replay again',
     !/'lv_onboarded',/.test(CFG.replace("  'lv_onboarded',\n", '')));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) { console.log('ONBOARDING-GATE TESTS FAILING'); process.exit(1); }
console.log('ALL ONBOARDING-GATE TESTS GREEN (' + pass + ')');
