// ═══════════════════════════════════════════════════════════════
// signin_other_window_2022_tests.js — v0.9.2022.
//
// [stated] Brad 2026-10-24: "now this screen is stuck here" — the installed
// app window stayed on the sign-in screen after he signed in through a Chrome
// tab. Every Rail Roster window shares one saved sign-in, but a window read
// it only once, when it opened.
//
// THE RULE (app-auth.js, "Sign-in / sign-out in ANOTHER window"): when the
// saved sign-in changes in another window, an open window reloads to match —
//   1. sign-in screen up + another window signed in  -> reload
//   2. app up + another window signed out            -> reload
//   3. app up + another window switched account      -> reload
// and NOTHING else: a pass renewal for the same account, half a sign-in
// (pass but no account yet), an expired pass, this window's OWN sign-in, the
// "one more step" Drive screen, unrelated keys. One reload per page, never
// two within 30 s in a tab.
//
// Not a grep test: the real block (from `var RR_XWIN_KEYS` through the
// `_rrXWinListen` IIFE) is lifted out of app-auth.js and run in TWO fake
// windows that share one localStorage, the way two real windows do. The
// suite proves it can FAIL: the same harness on the code before v0.9.2022
// (no block) leaves the window stuck, and three planted mutations of the
// decision are each caught.
// Run:  node tests/signin_other_window_2022_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'app', 'app-auth.js'), 'utf8');
const ix = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

function liftBlock(s) {
  const start = s.indexOf('var RR_XWIN_KEYS');
  const sig = '(function _rrXWinListen() {';
  const at = s.indexOf(sig, start);
  if (start < 0 || at < 0) return null;
  let d = 0, end = -1;
  for (let i = s.indexOf('{', at); i < s.length; i++) {
    if (s[i] === '{') d++; else if (s[i] === '}') { d--; if (!d) { end = i + 1; break; } }
  }
  const close = s.indexOf(')();', end);
  return s.slice(start, close + 4);
}

const BLOCK = liftBlock(src);

// ── harness ──────────────────────────────────────────────────────
const clock = { t: Date.parse('2026-10-24T12:00:00Z') };
const HOUR = 3600 * 1000;

function makeStore() {
  const m = {};
  return {
    m,
    getItem: k => (Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null),
    setItem: (k, v) => { m[k] = String(v); },
    removeItem: k => { delete m[k]; },
  };
}

// One open window. `screen` = 'auth' | 'app' | 'scope' (neither).
function makeWindow(code, shared, opts) {
  const w = {
    reloads: 0, timers: [], listeners: {}, docListeners: {}, logs: [],
    session: makeStore(),
  };
  const appEl = { classList: { contains: c => c === 'active' && w.screen === 'app' } };
  const authEl = { style: {} };
  Object.defineProperty(authEl.style, 'display', { get: () => (w.screen === 'auth' ? 'flex' : 'none') });
  w.screen = opts.screen;
  w.user = opts.user || null;
  w.visibility = 'visible';
  const doc = {
    getElementById: id => (id === 'app' ? appEl : id === 'auth-screen' ? authEl : null),
    addEventListener: (ev, fn) => { (w.docListeners[ev] = w.docListeners[ev] || []).push(fn); },
    get visibilityState() { return w.visibility; },
  };
  const win = {
    addEventListener: (ev, fn) => { (w.listeners[ev] = w.listeners[ev] || []).push(fn); },
  };
  const ctx = {
    window: win, document: doc,
    localStorage: shared, sessionStorage: w.session,
    location: { reload: () => { w.reloads++; } },
    setTimeout: (fn, ms) => { w.timers.push({ fn, ms }); return w.timers.length; },
    Date: { now: () => clock.t },
    JSON, String, parseInt,
    _rrAuthLog: m => { w.logs.push(m); },
  };
  Object.defineProperty(ctx, 'state', { get: () => ({ user: w.user }) });
  vm.createContext(ctx);
  if (code) vm.runInContext(code, ctx);
  w.ctx = ctx;
  w.fire = (ev, arg) => (w.listeners[ev] || []).forEach(f => f(arg));
  w.fireDoc = (ev) => (w.docListeners[ev] || []).forEach(f => f());
  // run() = the next half-second: timers of 400 ms or less. later() = the
  // clock moves on past every waiting timer, which then runs too.
  w.run = () => {
    for (let n = 0; n < 50; n++) {
      const i = w.timers.findIndex(t => t.ms <= 400);
      if (i < 0) return;
      w.timers.splice(i, 1)[0].fn();
    }
  };
  w.later = () => {
    for (let n = 0; n < 50 && w.timers.length; n++) {
      const t = w.timers.shift(); clock.t += t.ms; t.fn();
    }
  };
  return w;
}

// Another window writes `key`; this window gets a storage event for it.
function writeElsewhere(shared, wins, key, val) {
  if (val === null) shared.removeItem(key); else shared.setItem(key, val);
  wins.forEach(w => w.fire('storage', { key }));
}
function signInElsewhere(shared, wins, email) {
  writeElsewhere(shared, wins, 'lv_token', 'ya29.pass-' + email);
  writeElsewhere(shared, wins, 'lv_token_expiry', String(clock.t + HOUR));
  writeElsewhere(shared, wins, 'lv_user', JSON.stringify({ name: 'B', email }));
}
function signedInStore(email, expiry) {
  const s = makeStore();
  s.setItem('lv_user', JSON.stringify({ name: 'B', email }));
  s.setItem('lv_token', 'ya29.old');
  s.setItem('lv_token_expiry', String(expiry == null ? clock.t + HOUR : expiry));
  return s;
}

// Runs one named scenario against `code`; returns the window's reload count.
const SCEN = {
  'signed in elsewhere while this window shows sign-in': code => {
    const sh = makeStore(); const w = makeWindow(code, sh, { screen: 'auth' });
    signInElsewhere(sh, [w], 'bhale@ipd-llc.com'); w.run(); return w.reloads;
  },
  'pass written but no account yet': code => {
    const sh = makeStore(); const w = makeWindow(code, sh, { screen: 'auth' });
    writeElsewhere(sh, [w], 'lv_token', 'ya29.x');
    writeElsewhere(sh, [w], 'lv_token_expiry', String(clock.t + HOUR)); w.run(); return w.reloads;
  },
  'same account renews its pass elsewhere': code => {
    const sh = signedInStore('bhale@ipd-llc.com');
    const w = makeWindow(code, sh, { screen: 'app', user: { email: 'bhale@ipd-llc.com' } });
    signInElsewhere(sh, [w], 'Bhale@IPD-LLC.com '); w.run(); return w.reloads;
  },
  'signed out elsewhere (keys removed)': code => {
    const sh = signedInStore('bhale@ipd-llc.com');
    const w = makeWindow(code, sh, { screen: 'app', user: { email: 'bhale@ipd-llc.com' } });
    ['lv_token', 'lv_token_expiry', 'lv_user'].forEach(k => writeElsewhere(sh, [w], k, null));
    w.run(); return w.reloads;
  },
  'signed out elsewhere (whole store cleared, key null)': code => {
    const sh = signedInStore('bhale@ipd-llc.com');
    const w = makeWindow(code, sh, { screen: 'app', user: { email: 'bhale@ipd-llc.com' } });
    Object.keys(sh.m).forEach(k => sh.removeItem(k)); w.fire('storage', { key: null });
    w.run(); return w.reloads;
  },
  'another account elsewhere': code => {
    const sh = signedInStore('bhale@ipd-llc.com');
    const w = makeWindow(code, sh, { screen: 'app', user: { email: 'bhale@ipd-llc.com' } });
    signInElsewhere(sh, [w], 'support@therailroster.com'); w.run(); return w.reloads;
  },
  'own sign-in in progress, focus returns from the Google pop-up': code => {
    const sh = signedInStore('bhale@ipd-llc.com');
    const w = makeWindow(code, sh, { screen: 'auth' });
    w.session.setItem('lv_signing_in', '1'); w.fire('focus'); w.run(); return w.reloads;
  },
  'saved account but the pass has expired': code => {
    const sh = signedInStore('bhale@ipd-llc.com', clock.t - 1000);
    const w = makeWindow(code, sh, { screen: 'auth' });
    w.fire('focus'); w.fire('storage', { key: 'lv_user' }); w.run(); return w.reloads;
  },
  'Drive "one more step" screen (neither screen up)': code => {
    const sh = signedInStore('bhale@ipd-llc.com');
    const w = makeWindow(code, sh, { screen: 'scope', user: { email: 'bhale@ipd-llc.com' } });
    signInElsewhere(sh, [w], 'bhale@ipd-llc.com'); w.fire('focus'); w.run(); return w.reloads;
  },
  'unrelated key changes': code => {
    const sh = signedInStore('bhale@ipd-llc.com');
    const w = makeWindow(code, sh, { screen: 'auth' });
    w.fire('storage', { key: 'lv_personal_cache' });
    return w.timers.length + w.reloads;          // nothing even scheduled
  },
  'missed event: window shown again (visibilitychange)': code => {
    const sh = signedInStore('bhale@ipd-llc.com');
    const w = makeWindow(code, sh, { screen: 'auth' });
    w.visibility = 'hidden'; w.fireDoc('visibilitychange'); w.run();
    const hiddenReloads = w.reloads;
    w.visibility = 'visible'; w.fireDoc('visibilitychange'); w.run();
    return hiddenReloads === 0 ? w.reloads : -1;
  },
  'missed event: window focused': code => {
    const sh = signedInStore('bhale@ipd-llc.com');
    const w = makeWindow(code, sh, { screen: 'auth' });
    w.fire('focus'); w.run(); return w.reloads;
  },
  'a burst of events and focus = ONE reload': code => {
    const sh = makeStore(); const w = makeWindow(code, sh, { screen: 'auth' });
    signInElsewhere(sh, [w], 'bhale@ipd-llc.com'); w.fire('focus'); w.fireDoc('visibilitychange');
    const scheduled = w.timers.length;
    w.run(); w.fire('focus'); w.run();
    return scheduled === 1 ? w.reloads : 100 + scheduled;
  },
  'a reload under 30 s ago in this tab': code => {
    const sh = makeStore(); const w = makeWindow(code, sh, { screen: 'auth' });
    w.session.setItem('rr_xwin_reload_at', String(clock.t - 5000));
    signInElsewhere(sh, [w], 'bhale@ipd-llc.com'); w.run(); return w.reloads;
  },
  'inside the 30 s, the change is checked again when they end': code => {
    const sh = makeStore(); const w = makeWindow(code, sh, { screen: 'auth' });
    w.session.setItem('rr_xwin_reload_at', String(clock.t - 5000));
    signInElsewhere(sh, [w], 'bhale@ipd-llc.com'); w.run();
    const early = w.reloads; const t0 = clock.t;
    w.later(); const waited = clock.t - t0; clock.t = t0;
    return early === 0 && waited >= 25000 && waited <= 25100 ? w.reloads : 100 + early;
  },
  'a reload over 30 s ago in this tab': code => {
    const sh = makeStore(); const w = makeWindow(code, sh, { screen: 'auth' });
    w.session.setItem('rr_xwin_reload_at', String(clock.t - 31000));
    signInElsewhere(sh, [w], 'bhale@ipd-llc.com'); w.run(); return w.reloads;
  },
};
const EXPECT = {
  'signed in elsewhere while this window shows sign-in': 1,
  'pass written but no account yet': 0,
  'same account renews its pass elsewhere': 0,
  'signed out elsewhere (keys removed)': 1,
  'signed out elsewhere (whole store cleared, key null)': 1,
  'another account elsewhere': 1,
  'own sign-in in progress, focus returns from the Google pop-up': 0,
  'saved account but the pass has expired': 0,
  'Drive "one more step" screen (neither screen up)': 0,
  'unrelated key changes': 0,
  'missed event: window shown again (visibilitychange)': 1,
  'missed event: window focused': 1,
  'a burst of events and focus = ONE reload': 1,
  'a reload under 30 s ago in this tab': 0,
  'a reload over 30 s ago in this tab': 1,
  'inside the 30 s, the change is checked again when they end': 1,
};
function runAll(code) {
  const got = {};
  Object.keys(SCEN).forEach(k => { try { got[k] = SCEN[k](code); } catch (e) { got[k] = 'threw: ' + e.message; } });
  return got;
}
function misses(got) { return Object.keys(EXPECT).filter(k => got[k] !== EXPECT[k]); }

// ── 1. the real block ────────────────────────────────────────────
section('the block is in app-auth.js and app-auth.js is on the page');
ok('block lifted from app-auth.js', !!BLOCK && BLOCK.length > 500, BLOCK ? BLOCK.length + ' chars' : 'not found');
ok('app-auth.js is loaded by index.html', /<script src="\.\/app-auth\.js\?v=/.test(ix));
ok('the block sits once in app-auth.js', src.split('var RR_XWIN_KEYS').length === 2);

section('the real block, two windows sharing one saved sign-in');
const real = runAll(BLOCK);
Object.keys(EXPECT).forEach(k => ok(k + ' -> ' + (EXPECT[k] ? 'reload' : 'leave it'), real[k] === EXPECT[k], 'got ' + real[k]));

section('it logs why it reloaded');
(function () {
  const sh = makeStore(); const w = makeWindow(BLOCK, sh, { screen: 'auth' });
  signInElsewhere(sh, [w], 'bhale@ipd-llc.com'); w.run();
  ok('log names the reason', w.logs.some(m => /signed in in another window/.test(m)), JSON.stringify(w.logs));
})();

// ── 2. proof it can fail ─────────────────────────────────────────
section('PROOF IT CAN FAIL — the code before v0.9.2022 (no block)');
(function () {
  const old = runAll('');
  ok('the old code leaves the window stuck on the sign-in screen',
    old['signed in elsewhere while this window shows sign-in'] === 0);
  ok('this suite would have been RED on the old code', misses(old).length >= 6, misses(old).length + ' misses');
})();

section('PROOF IT CAN FAIL — planted mutations of the decision');
function plant(name, from, to, mustCatch) {
  if (!BLOCK || BLOCK.indexOf(from) === -1) { ok(name + ' (anchor found)', false, 'anchor missing: ' + from); return; }
  const m = misses(runAll(BLOCK.replace(from, to)));
  ok(name + ' is caught', m.indexOf(mustCatch) !== -1, 'misses: ' + JSON.stringify(m));
}
plant('ignoring the account (renewal reloads)', "if (v.storedEmail !== v.myEmail) return", "if (true) return",
  'same account renews its pass elsewhere');
plant('ignoring this window\'s own sign-in', "if (v.ownSignIn) return '';", '',
  'own sign-in in progress, focus returns from the Google pop-up');
plant('ignoring an expired pass', "(v.storedEmail && v.passLive)", "(v.storedEmail)",
  'saved account but the pass has expired');
plant('no 30-second guard', "if (now - last < 30000)", "if (false)", 'a reload under 30 s ago in this tab');
plant('dropping a change inside the 30 s', "_rrXWinTimer = setTimeout(_rrXWinCheck, 30000", "void (0, 30000",
  'inside the 30 s, the change is checked again when they end');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
