#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// v0.9.1979 — WAITING FOR A PASS (Brad, 2026-10-17, "issue 6")
//
//   "it seems on my phone app that i am having to log in alot. … i dont see it
//    on the desktop app."  "its the full screen sign in with google"
//   "also, when i do sign in, its like i have to do it 2 or three times before
//    it lets me in"
//
// The phone sleeps the app, the one-hour pass runs out while it sleeps, and the
// first save after waking found it dead. sheets.js asked for a new pass through
// its own side door and waited 8 s; the quiet renewal goes through the relay,
// which answered its SIMPLEST call in 2–5 s (measured 2026-10-17) before it even
// talks to Google — so the save gave up, and its catch put the FULL sign-in
// screen over an app that was never signed out. Tapping "Sign in with Google"
// there then got a pass that was taken as a background renewal and nothing else:
// the sign-in screen stayed up, so the tap looked dead.
//
// Runs the REAL code out of app/ (app-auth.js, sheets.js, drive.js,
// write-outbox.js, config.js) against a fake clock, fake Google and a fake page.
//
//   W  rrWaitForPass: held → at once; lapsed → waits for the renewal; none →
//      false at RR_RENEW_WAIT_MS; nobody signed in → false at once
//   S  sheets.js _withTokenRetry: renews BEFORE the request; a 401 renews and
//      retries once; no pass → SESSION_EXPIRED with nothing sent
//   D  drive.js driveRequest: the same, through the same door
//   O  ONE door: no file but app-auth.js asks Google for a quiet pass, and no
//      renewal wait is typed anywhere but config.js
//   A  no save puts the sign-in screen over the app
//   T  a pass arriving over the sign-in screen brings the app back; saves kept
//      on the device go up at once
//   M  the words: never "signed out" for a renewal
//   P  PLANTED: the old 8-second wait loses the race to a 12-second relay; the
//      old save catch is caught by A; the old token path is caught by T
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const APP = path.join(__dirname, '..', 'app');
const rd = f => fs.readFileSync(path.join(APP, f), 'utf8');
const AUTH = rd('app-auth.js'), SHEETS = rd('sheets.js'), DRIVE = rd('drive.js'),
      CFG = rd('config.js'), OUTBOX = rd('write-outbox.js');

let pass = 0, fail = 0;
function T(n, cond, detail) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 600)));
  cond ? pass++ : fail++;
}

// ── lifting real code ─────────────────────────────────────────────────────
function between(src, a, b) {
  const i = src.indexOf(a), j = src.indexOf(b, i + 1);
  if (i < 0 || j < 0) throw new Error('marker moved: ' + a.slice(0, 50));
  return src.slice(i, j);
}
// one function by its header, braces matched (strings/comments are rare enough
// in these functions that a plain count is right; the check below proves it parsed)
function lift(src, header) {
  const i = src.indexOf(header);
  if (i < 0) throw new Error('function moved: ' + header);
  let k = src.indexOf('{', i), depth = 0;
  for (; k < src.length; k++) {
    const c = src[k];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(i, k + 1); }
  }
  throw new Error('unbalanced: ' + header);
}
const WAIT_MS = Number((CFG.match(/const RR_RENEW_WAIT_MS = (\d+);/) || [])[1]);

// ── a fake clock: setTimeout queues, run() advances to each timer in turn ──
function clock(start) {
  let now = start || 1_800_000_000_000, seq = 0;
  const q = [];
  return {
    now: () => now,
    setTimeout: (fn, ms) => { q.push({ at: now + (ms || 0), fn, id: ++seq }); return seq; },
    clearTimeout: id => { const i = q.findIndex(t => t.id === id); if (i >= 0) q.splice(i, 1); },
    // run every timer due up to `until` (absolute), letting promises settle between
    async run(until) {
      for (let guard = 0; guard < 100000; guard++) {
        await new Promise(r => setImmediate(r));
        q.sort((a, b) => a.at - b.at || a.id - b.id);
        if (!q.length || q[0].at > until) { now = Math.max(now, until); await new Promise(r => setImmediate(r)); return; }
        const t = q.shift();
        now = Math.max(now, t.at);
        t.fn();
      }
      throw new Error('clock ran away');
    },
  };
}

// ── W: the waiter, from app-auth.js, against a fake renewal ────────────────
// relayMs: when the renewal hands over a pass (null = never)
function authWorld(o) {
  o = o || {};
  const c = clock();
  const store = Object.assign({}, o.store || {});
  const log = [], renewals = [];
  const ctx = {
    console: { log() {}, warn() {} }, JSON, String, Math, Promise, parseInt, Number,
    Date: { now: c.now },
    setTimeout: c.setTimeout, clearTimeout: c.clearTimeout,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    state: { user: o.user === null ? null : { email: 'bhale@ipd-llc.com' } },
    accessToken: o.token === undefined ? 'old-pass' : o.token,
    _RR_TOKEN_USABLE_MS: 60 * 1000,
    tokenClient: o.noGoogle ? undefined : { requestAccessToken() {} },
    navigator: { onLine: o.offline ? false : true },
    _rrAuthLog: m => log.push(m),
    RR_RENEW_WAIT_MS: o.waitMs || WAIT_MS,
    // v0.9.1982: no Google setup window is open in this world (that case is
    // setup_window_once_1982_tests); the waiter asks, so it must be answerable
    _rrLinkWaiting: () => false,
  };
  ctx.window = ctx;
  // the real expiry reader, the real waiter block; rrEnsureFreshToken is the
  // door, faked here as the relay: it hands over a pass after relayMs
  ctx.rrEnsureFreshToken = why => {
    renewals.push(why);
    if (o.relayMs != null) c.setTimeout(() => {
      ctx.accessToken = 'new-pass';
      store.lv_token_expiry = String(c.now() + 55 * 60 * 1000);
    }, o.relayMs);
  };
  vm.createContext(ctx);
  vm.runInContext(lift(AUTH, 'function _rrTokenExpiry()') + '\n' +
    between(AUTH, '// ═══ v0.9.1979 — WAITING FOR A PASS', '// Layer 2. One-shot listeners'), ctx);
  return { ctx, c, store, log, renewals };
}
async function waitResult(w, why) {
  let out = 'pending', at = null;
  w.ctx.rrWaitForPass(why).then(v => { out = v; at = w.c.now(); });
  const t0 = w.c.now();
  await w.c.run(t0 + 120000);
  return { out, after: at == null ? null : at - t0 };
}

(async () => {
  T('W0 RR_RENEW_WAIT_MS is set in config.js, and at least 20 s', WAIT_MS >= 20000, { WAIT_MS });
  {
    const w = authWorld({ store: { lv_token_expiry: String(1_800_000_000_000 + 40 * 60 * 1000) } });
    const r = await waitResult(w, 't');
    T('W1 a held pass → true at once, no renewal asked', r.out === true && r.after === 0 && w.renewals.length === 0, { r, renewals: w.renewals });
  }
  {
    const w = authWorld({ store: { lv_token_expiry: String(1_800_000_000_000 - 1000) }, relayMs: 12000 });
    const r = await waitResult(w, 'sheets');
    T('W2 a lapsed pass + a 12-second relay → waits, true when the pass lands (the old 8 s gave up here)',
      r.out === true && r.after >= 12000 && r.after < 13000 && w.renewals.join() === 'sheets', { r, renewals: w.renewals });
  }
  {
    const w = authWorld({ store: { lv_token_expiry: String(1_800_000_000_000 - 1000) }, relayMs: null });
    const r = await waitResult(w, 'save');
    T('W3 no pass ever → false at RR_RENEW_WAIT_MS, never sooner, and the diary says so',
      r.out === false && r.after >= WAIT_MS && r.after < WAIT_MS + 1000 && w.log.some(l => /no pass after \d+s \(save\)/.test(l)), { r, log: w.log });
  }
  {
    const w = authWorld({ user: null, store: { lv_token_expiry: '1' } });
    const r = await waitResult(w, 'x');
    T('W4 nobody signed in → false at once, nothing renewed', r.out === false && r.after === 0 && w.renewals.length === 0, r);
  }
  {
    const w = authWorld({ store: {} });   // a pass with no stored expiry: held, as before
    const r = await waitResult(w, 'x');
    T('W5 a pass with an unknown expiry counts as held (nothing changes for it)', r.out === true && w.renewals.length === 0, r);
  }
  {
    const w = authWorld({ token: null, store: { lv_token_expiry: String(1_800_000_000_000 + 40 * 60 * 1000) }, relayMs: 3000 });
    const r = await waitResult(w, 'x');
    T('W6 no pass in memory at all → renews and waits for it', r.out === true && r.after >= 3000 && w.renewals.length === 1, r);
  }
  {
    const w = authWorld({ store: { lv_token_expiry: String(1_800_000_000_000 + 40 * 60 * 1000) } });
    w.ctx.rrPassRefused();
    T('W7 rrPassRefused makes a pass Google refused count as lapsed, whatever its clock said', w.ctx.rrPassLapsed() === true && w.store.lv_token_expiry === '1');
  }
  {
    const w = authWorld({ noGoogle: true, store: { lv_token_expiry: '1' }, relayMs: 3000 });
    const r = await waitResult(w, 'x');
    T('W8 Google\'s sign-in never loaded → false at once, no 25-second hang', r.out === false && r.after === 0 && w.renewals.length === 0, r);
  }
  {
    const w = authWorld({ offline: true, store: { lv_token_expiry: '1' }, relayMs: 3000 });
    const r = await waitResult(w, 'x');
    T('W9 offline (show mode) → false at once, nothing renewed', r.out === false && r.after === 0 && w.renewals.length === 0, r);
  }
  {   // P1 — the old wait, planted: the same 12-second relay, 8 seconds of patience
    const w = authWorld({ store: { lv_token_expiry: String(1_800_000_000_000 - 1000) }, relayMs: 12000, waitMs: 8000 });
    const r = await waitResult(w, 'sheets');
    T('P1 PLANTED: an 8-second wait loses to a 12-second relay — THE BUG BRAD HIT', r.out === false, r);
  }

  // ── S: sheets.js ─────────────────────────────────────────────────────────
  function sheetsWorld(o) {
    o = o || {};
    const calls = [], refused = [];
    let token = ('token' in o) ? o.token : 'old-pass';
    const answers = (o.statuses || [200]).slice();
    const ctx = {
      console: { log() {}, warn() {}, error() {} }, Promise, parseInt, isNaN, Math, JSON, Error,
      setTimeout: (fn) => setImmediate(fn),
      get accessToken() { return token; }, set accessToken(v) { token = v; },
      fetchFn: () => { calls.push(token); const s = answers.length ? answers.shift() : 200; return Promise.resolve({ status: s, ok: s >= 200 && s < 300, statusText: '', headers: { get: () => null }, json: async () => ({}) }); },
    };
    if (o.door !== false) {
      ctx.rrPassLapsed = () => o.lapsed === true || refused.length > 0 && !o.renewed;
      ctx.rrPassRefused = () => refused.push(1);
      ctx.rrWaitForPass = async why => { (ctx.waits = ctx.waits || []).push(why); if (o.renews === false) return false; token = 'new-pass'; o.renewed = true; o.lapsed = false; return true; };
    }
    vm.createContext(ctx);
    vm.runInContext(lift(SHEETS, 'async function _withTokenRetry(fetchFn)'), ctx);
    return { ctx, calls, refused };
  }
  {
    const w = sheetsWorld({ lapsed: true });
    await w.ctx._withTokenRetry(w.ctx.fetchFn);
    T('S1 a lapsed pass is renewed BEFORE the request — one request, with the new pass', w.calls.join() === 'new-pass' && w.ctx.waits.join() === 'sheets', { calls: w.calls, waits: w.ctx.waits });
  }
  {
    const w = sheetsWorld({ statuses: [401, 200] });
    await w.ctx._withTokenRetry(w.ctx.fetchFn);
    T('S2 a 401 marks the pass refused, renews through the door, retries ONCE with the new pass',
      w.refused.length === 1 && w.calls.join() === 'old-pass,new-pass' && w.ctx.waits.join() === 'sheets 401', { calls: w.calls, waits: w.ctx.waits });
  }
  {
    const w = sheetsWorld({ lapsed: true, renews: false });
    let err = '';
    try { await w.ctx._withTokenRetry(w.ctx.fetchFn); } catch (e) { err = e.message; }
    T('S3 no pass in time → SESSION_EXPIRED, and nothing was sent', err === 'SESSION_EXPIRED' && w.calls.length === 0, { err, calls: w.calls });
  }
  {
    const w = sheetsWorld({ lapsed: true, renews: false, token: null });
    let err = '';
    try { await w.ctx._withTokenRetry(w.ctx.fetchFn); } catch (e) { err = e.message; }
    T('S3b no pass at all (an offline start) → the same "Not signed in" words as before, nothing sent', /^Not signed in/.test(err) && w.calls.length === 0, err);
  }
  {
    const w = sheetsWorld({ statuses: [200] });
    await w.ctx._withTokenRetry(w.ctx.fetchFn);
    T('S4 a good pass: one request, no wait, no renewal', w.calls.join() === 'old-pass' && !w.ctx.waits && !w.refused.length, { calls: w.calls });
  }
  {
    const w = sheetsWorld({ statuses: [401], door: false });
    let err = '';
    try { await w.ctx._withTokenRetry(w.ctx.fetchFn); } catch (e) { err = e.message; }
    T('S5 without app-auth.js loaded (a unit test): a 401 throws plainly, never hangs', /Cannot refresh token/.test(err), err);
  }

  // ── D: drive.js ──────────────────────────────────────────────────────────
  {
    const drv = between(DRIVE, 'async function driveRequest(', 'async function driveUploadFile');
    const calls = [], refused = [], waits = [];
    let token = 'old-pass';
    const answers = [401, 200];
    const ctx = {
      console: { log() {}, warn() {}, error() {} }, Promise, JSON, Error, parseInt, Date,
      setTimeout: fn => setImmediate(fn),
      get accessToken() { return token; }, set accessToken(v) { token = v; },
      state: { user: { email: 'bhale@ipd-llc.com' } },
      localStorage: { getItem: () => null },
      fetch: async () => { calls.push(token); const s = answers.shift() || 200; return { status: s, ok: s >= 200 && s < 300, text: async () => '{}', json: async () => ({ id: 'x' }) }; },
      rrPassLapsed: () => refused.length > 0 && token === 'old-pass',
      rrPassRefused: () => refused.push(1),
      rrWaitForPass: async why => { waits.push(why); token = 'new-pass'; return true; },
    };
    vm.createContext(ctx);
    vm.runInContext(drv, ctx);
    await ctx.driveRequest('GET', '/files');
    T('D1 Drive: a 401 renews through the same door and retries once with the new pass',
      refused.length === 1 && waits.join() === 'drive 401' && calls.join() === 'old-pass,new-pass', { calls, waits });
  }

  // ── O: one door, one number ──────────────────────────────────────────────
  const files = fs.readdirSync(APP).filter(f => f.endsWith('.js'));
  const quietAsk = /requestAccessToken\(\{\s*prompt:\s*''/;
  const sideDoors = files.filter(f => f !== 'app-auth.js' && f !== 'write-outbox.js' && quietAsk.test(rd(f)));
  T('O1 no file but app-auth.js asks Google for a quiet pass (write-outbox.js\'s is the tap-to-sign-in pill — a tap, kept)', sideDoors.length === 0, sideDoors);
  const plantedSide = SHEETS + "\nfunction x(){ tokenClient.requestAccessToken({ prompt: '', login_hint: h }); }";
  T('O1p PLANTED: a side door written back into sheets.js is caught', quietAsk.test(plantedSide));
  T('O2 sheets.js and drive.js wait through rrWaitForPass, not a timer of their own',
    /rrWaitForPass\('sheets'\)/.test(SHEETS) && /rrWaitForPass\('drive'\)/.test(DRIVE)
    && !/SESSION_EXPIRED'\)\), \d+\)/.test(SHEETS) && !/Token refresh timeout/.test(DRIVE));
  const defs = files.filter(f => /(?:const|let|var)\s+RR_RENEW_WAIT_MS\b/.test(rd(f)));
  T('O3 RR_RENEW_WAIT_MS is defined in ONE place — config.js', defs.join() === 'config.js', defs);
  T('O3b app-auth.js reads it with no number of its own', /function _rrRenewWaitMs\(\) \{ return RR_RENEW_WAIT_MS; \}/.test(AUTH));
  T('O4 the quiet renewal\'s own fallback timer reads the same number', /\? _rrRenewWaitMs\(\) : 6000/.test(AUTH) && !/\? 20000 : 6000/.test(AUTH));

  // ── A: no save puts the sign-in screen over the app ──────────────────────
  // The sign-in screen is shown in app-auth.js only: by the start-up path, and
  // by onTokenReceived when NOTHING is on screen yet. Anywhere else it is the bug.
  const showsAuth = s => /getElementById\(['"]auth-screen['"]\)[\s\S]{0,80}\.style\.display\s*=\s*['"]flex['"]|_au\.style\.display\s*=\s*['"]flex['"]/.test(s);
  const offenders = files.filter(f => f !== 'app-auth.js' && showsAuth(rd(f)));
  T('A1 no file but app-auth.js puts the sign-in screen up (the save catches no longer do)', offenders.length === 0, offenders);
  const oldCatch = "if (e && e.message === 'SESSION_EXPIRED') { var _au = document.getElementById('auth-screen'); if (_au) _au.style.display = 'flex'; }";
  T('A1p PLANTED: the old save catch is caught', showsAuth(oldCatch));
  const WS = rd('wizard-save.js'), AC = rd('app-collection.js');
  T('A2 both save catches say it with rrSaveError and keep the renewal going',
    /showToast\(rrSaveError\(e, 'your item'\), 8000, true\);\s*try \{ if \(rrIsSignInError\(e\) && typeof rrEnsureFreshToken === 'function'\) rrEnsureFreshToken\('save'\)/.test(WS)
    && /rrSaveError\(err, 'your change'\)[\s\S]{0,40}\n\s*try \{ if \(rrIsSignInError\(err\) && typeof rrEnsureFreshToken === 'function'\) rrEnsureFreshToken\('save'\)/.test(AC));

  // ── T: a pass over the sign-in screen brings the app back ────────────────
  function tokenWorld(src, o) {
    const shown = [], retried = [];
    const el = id => ({ id, style: { display: id === 'auth-screen' ? o.auth : '' }, classList: { contains: c => id === 'app' && o.appActive && c === 'active', remove() {}, add() {} }, remove() {} });
    const els = { 'auth-screen': el('auth-screen'), app: el('app') };
    const ctx = {
      console: { log() {}, warn() {}, error() {} }, JSON, String, Date, Promise,
      setTimeout: () => 0, clearTimeout: () => {},
      localStorage: { setItem() {}, getItem: () => null, removeItem() {} },
      document: { getElementById: id => els[id] || null },
      state: { user: { email: 'bhale@ipd-llc.com' }, masterData: [1, 2, 3] },
      accessToken: 'old', _tokenIsInitial: false, _rrTokenRenewing: false, _rrTokenGestureArmed: false,
      _rrAccountGate: () => true, _rrNoteGrantedScopes() {}, _rrAuthLog() {}, _resetSignInButton() {},
      rrEnsureFreshToken() {}, _rrArmGestureRenew() {},
      showApp: () => shown.push(1),
      rrOutboxCount: () => o.queued || 0, rrOutboxRetry: () => { retried.push(1); return Promise.resolve(); },
      loadAllData() {},
    };
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(lift(src, 'function onTokenReceived(resp)'), ctx);
    ctx.onTokenReceived({ access_token: 'new' });
    return { shown, retried };
  }
  {
    const r = tokenWorld(AUTH, { auth: 'flex', appActive: false });
    T('T1 "Sign in with Google" over a loaded app: the pass brings the app back on the FIRST tap', r.shown.length === 1, r);
    const q = tokenWorld(AUTH, { auth: 'none', appActive: true });
    T('T2 an ordinary quiet renewal while working: the screen is left alone', q.shown.length === 0, q);
    const s = tokenWorld(AUTH, { auth: 'none', appActive: false });
    T('T3 the app hidden for another reason (setup, the permission screen): left alone', s.shown.length === 0, s);
    const k = tokenWorld(AUTH, { auth: 'none', appActive: true, queued: 2 });
    T('T4 saves kept on this device go up the moment the pass is back', k.retried.length === 1, k);
    const n = tokenWorld(AUTH, { auth: 'none', appActive: true, queued: 0 });
    T('T5 nothing kept → no extra retry', n.retried.length === 0, n);
    // P3 — the old onTokenReceived (no hand-back), planted from the real one
    const old = AUTH.replace(/\n    \/\/ v0\.9\.1979 \("when i do sign in[\s\S]*?\} catch \(eSA\) \{\}/, '');
    const p = tokenWorld(old, { auth: 'flex', appActive: false });
    T('P3 PLANTED: without the hand-back the sign-in screen stays up — "2 or three times" is caught', old !== AUTH && p.shown.length === 0, { changed: old !== AUTH, p });
  }

  // ── M: the words ─────────────────────────────────────────────────────────
  {
    const ctx = { window: {}, localStorage: { getItem: () => '[]', setItem() {} }, document: { getElementById: () => null, createElement: () => ({ style: {} }), body: { appendChild() {} }, addEventListener() {} }, console: { log() {}, warn() {} }, setInterval: () => 0, setTimeout: () => 0, JSON, String, Date, Math, navigator: {} };
    ctx.window.addEventListener = () => {};
    vm.createContext(ctx);
    let ok = true;
    try { vm.runInContext(OUTBOX, ctx); } catch (e) { ok = false; }
    const say = ok && ctx.window.rrSaveError ? ctx.window.rrSaveError(new Error('SESSION_EXPIRED'), 'your item') : '';
    T('M1 a renewal is never called "signed out" — and says what to do', ok && !/signed out/i.test(say) && /renewing your sign-in/.test(say), say);
    const out = ok && ctx.window.rrSaveError ? ctx.window.rrSaveError(new Error('Not signed in'), 'your item') : '';
    T('M2 really no account on this device still says signed out', /signed out\. Sign in again/.test(out), out);
  }

  console.log('');
  console.log(fail === 0 ? 'ALL SIGN-IN WAIT TESTS GREEN (' + pass + ')' : fail + ' FAILING of ' + (pass + fail));
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.log('FAIL  crashed: ' + (e && e.stack)); process.exit(1); });
