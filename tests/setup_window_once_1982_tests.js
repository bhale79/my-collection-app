#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// v0.9.1982 — GOOGLE'S SETUP WINDOW OPENS ONCE, AND IS WAITED FOR
//
// Brad, 2026-10-18, support@ in his Work Chrome profile: "this popped up on me,
// i hit continue and then continue again. then it asked me again, like 10
// seconds later. i thought we fixed this in another thread."
//
// His sign-in diary (rr_sync_log) that morning:
//   13:29:40 renewing (resume)
//   13:29:40 quiet renewal: linking this device (Google's window, once)
//   13:29:47 quiet renew silent after 6s          ← he was still clicking Continue
//   13:29:47 armed: retry on next tap
//   13:29:58 tap retry: requesting token
//   13:29:58 quiet renewal: linking this device   ← the SECOND window
//   13:29:59 this device is linked                ← the first window's answer
//   13:30:59 this device is linked                ← the second window's answer
//
// v0.9.1979 gave a device WITH a renewal key 25 s; a device being linked for the
// first time still got 6 s, and nothing stopped a second window while the first
// was open. Runs the REAL code out of app/app-auth.js against a fake clock, a
// fake Google and a fake relay.
//
//   O  one window: a second request while it is open opens nothing; its answer
//      or its closing clears it; the outer limit (RR_LINK_WINDOW_MAX_MS) frees it
//   B  Brad's morning replayed: one window, no "silent after 6s", no click-retry
//      window, the pass lands when he answers
//   W  rrWaitForPass keeps waiting past RR_RENEW_WAIT_MS while the window is open
//   R  Reconnect never puts a consent window on top of the setup window
//   C  the outer limit is ONE number in config.js
//   P  PLANTED: the shipped v0.9.1981 code opens the window twice (B) and gives
//      up on the wait at 25 s (W) — so this suite can fail
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'app');
const AUTH = fs.readFileSync(path.join(APP, 'app-auth.js'), 'utf8');
const CFG = fs.readFileSync(path.join(APP, 'config.js'), 'utf8');
// The shipped code before this release, for the planted checks.
let OLD = null;
try { OLD = cp.execSync('git show 197dfda4:app/app-auth.js', { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
catch (e) { OLD = null; }

let pass = 0, fail = 0;
function T(n, cond, detail) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 700)));
  cond ? pass++ : fail++;
}

const START = '// ═══ v0.9.1924 — THE QUIET RENEWAL';
const END = '// The only place that asks Google for a token outside of first sign-in.';
function block(src) {
  const a = src.indexOf(START), b = src.indexOf(END);
  if (a < 0 || b < 0) throw new Error('quiet renewal block markers moved');
  return src.slice(a, b);
}
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
const LINK_MS = Number((CFG.match(/const RR_LINK_WINDOW_MAX_MS = (\d+);/) || [])[1]);

const tick = () => new Promise(r => setImmediate(r));
async function settle() { for (let i = 0; i < 8; i++) await tick(); }

// A world: the real quiet-renewal block + the real renewal / wait / click-retry
// / Reconnect functions, a fake clock, a fake Google, a fake relay.
function world(src, o) {
  o = o || {};
  const store = {};
  const log = [], codeWindows = [], tokenWindows = [], posts = [], listeners = { click: [], keydown: [] };
  let now = 1_800_000_000_000, seq = 0;
  const timers = [];
  let codeCfg = null;
  const real = {
    callback: null,
    requestAccessToken: opts => tokenWindows.push(opts),
  };
  const ctx = {
    console: { log() {}, warn() {} }, JSON, String, Number, Promise, parseInt, Math,
    Date: { now: () => now },
    setTimeout: (fn, ms) => { timers.push({ at: now + (ms || 0), fn, id: ++seq }); return seq; },
    clearTimeout: id => { const i = timers.findIndex(t => t.id === id); if (i >= 0) timers.splice(i, 1); },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    navigator: { onLine: true },
    document: {
      addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
      removeEventListener: (t, fn) => { listeners[t] = (listeners[t] || []).filter(f => f !== fn); },
      getElementById: () => null,
    },
    state: { user: { email: 'support@therailroster.com' } },
    RR_QUIET_RENEW: 'all',
    RR_OWNER_EMAILS: ['bhale@ipd-llc.com', 'support@therailroster.com'],
    RR_RENEW_DEVICE_KEY: 'lv_renew_device', RR_RENEW_NOKEY_KEY: 'lv_renew_nokey_until',
    RR_RENEW_WAIT_MS: WAIT_MS, RR_LINK_WINDOW_MAX_MS: LINK_MS || 180000,
    CLIENT_ID: 'cid', SCOPES: 'drive.file email profile',
    _rrAuthLog: m => log.push(m),
    vaultPost: async body => {
      posts.push(body);
      if (body.action === 'auth_link') return { status: 200, device: 'dev-new', email: 'support@therailroster.com', access_token: 'linked-' + posts.length, expires_in: 3599 };
      return null;
    },
    google: { accounts: { oauth2: { initCodeClient: cfg => { codeCfg = cfg; return { requestCode: () => { if (o.throwOnOpen) throw new Error('blocked'); codeWindows.push({ at: now }); } }; } } } },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  const prelude = [
    'var accessToken = "old-pass"; var _tokExp = ' + (now - 60000) + ';',   // the pass ran out while the tab slept
    'function _rrTokenExpiry() { return _tokExp; }',
    'var _RR_TOKEN_MARGIN_MS = 5 * 60 * 1000, _RR_TOKEN_USABLE_MS = 60 * 1000;',
    'var _rrAccountHold = null, _rrTokenRenewing = false, _rrTokenGestureArmed = false;',
    'var shown = 0; function _rrShowReconnect() { shown++; }',
    // what onTokenReceived does that matters here: take the pass, clear the flag
    'function onTokenReceived(resp) { accessToken = resp.access_token; _tokExp = Date.now() + resp.expires_in * 1000; _rrTokenRenewing = false; delivered.push(resp.access_token); }',
    'var delivered = [];',
  ].join('\n');
  const body = [
    block(src),
    lift(src, 'function _rrTokenFresh()'),
    lift(src, 'function _rrTokenUsable()'),
    lift(src, 'function _rrTokenHealthy()'),
    lift(src, 'function rrEnsureFreshToken('),
    lift(src, 'function _rrRenewWaitMs()'),
    lift(src, 'function rrPassLapsed()'),
    lift(src, 'function rrWaitForPass('),
    lift(src, 'function _rrArmGestureRenew()'),
    lift(src, 'function rrReconnectNow()'),
  ].join('\n');
  vm.runInContext(prelude + '\n' + body + '\n__real.callback = onTokenReceived; var tokenClient = _rrWrapTokenClient(__real);'.replace('__real', 'this.__real'), Object.assign(ctx, { __real: real }));
  vm.runInContext('this.api = { ensure: rrEnsureFreshToken, wait: rrWaitForPass, reconnect: rrReconnectNow, client: tokenClient, waiting: function(){ return typeof _rrLinkWaiting === "function" ? _rrLinkWaiting() : null; }, renewing: function(){ return _rrTokenRenewing; }, delivered: delivered, shown: function(){ return shown; } };', ctx);
  return {
    ctx, api: ctx.api, log, codeWindows, tokenWindows, posts, store,
    code: () => codeCfg,
    click: () => { (listeners.click || []).slice().forEach(fn => fn({ target: { closest: () => null } })); },
    // advance the clock to `ms` after the start, running every timer due on the way
    async until(ms, start) {
      const end = (start || 1_800_000_000_000) + ms;
      for (let g = 0; g < 100000; g++) {
        await settle();
        timers.sort((a, b) => a.at - b.at || a.id - b.id);
        const t = timers[0];
        if (!t || t.at > end) break;
        timers.shift(); now = Math.max(now, t.at); t.fn();
      }
      now = Math.max(now, end); await settle();
    },
    answer: async () => { codeCfg.callback({ code: 'ONE-TIME', scope: 'x' }); await settle(); },
    closeWindow: async () => { codeCfg.error_callback({ type: 'popup_closed' }); await settle(); },
  };
}

(async () => {
  // ── O: one window ─────────────────────────────────────────────────────────
  {
    const w = world(AUTH);
    w.api.client.requestAccessToken({ prompt: '', login_hint: 'support@therailroster.com' });
    T('O1 no renewal key yet → Google\'s setup window opens', w.codeWindows.length === 1 && w.tokenWindows.length === 0, { code: w.codeWindows.length, token: w.tokenWindows.length });
    T('O2 …and the app knows it is open', w.api.waiting() === true);
    w.api.client.requestAccessToken({ prompt: '', login_hint: 'support@therailroster.com' });
    w.api.client.requestAccessToken({ prompt: '' });
    T('O3 two more quiet requests while it is open open NOTHING (no setup window, no token window)', w.codeWindows.length === 1 && w.tokenWindows.length === 0, { code: w.codeWindows.length, token: w.tokenWindows.length });
    T('O4 …and the diary says why', w.log.some(m => /setup window is already open/.test(m)), w.log);
    await w.answer();
    T('O5 its answer links the device ONCE and clears the wait', w.posts.filter(p => p.action === 'auth_link').length === 1 && w.api.waiting() === false && JSON.parse(w.store.lv_renew_device || '{}').device === 'dev-new', { posts: w.posts, store: w.store });
  }
  {
    const w = world(AUTH);
    w.api.client.requestAccessToken({ prompt: '' });
    await w.closeWindow();
    T('O6 closing the window (popup_closed) clears the wait too', w.api.waiting() === false);
  }
  {
    const w = world(AUTH);
    w.api.client.requestAccessToken({ prompt: '' });
    await w.until(LINK_MS + 1000);
    T('O7 a window that never answers stops blocking at the outer limit', w.api.waiting() === false);
    w.api.client.requestAccessToken({ prompt: '' });
    T('O8 …after which a request may open one again', w.codeWindows.length === 2, w.codeWindows.length);
  }
  {
    const w = world(AUTH, { throwOnOpen: true });
    let threw = false;
    try { w.api.client.requestAccessToken({ prompt: '' }); } catch (e) { threw = true; }
    T('O9 a window that never opened (it threw) leaves nothing to wait for', threw && w.api.waiting() === false);
  }
  {
    const w = world(AUTH);
    w.api.client.requestAccessToken({ prompt: 'consent' });
    w.api.client.requestAccessToken({ prompt: 'select_account' });
    T('O10 sign-in and consent screens still go straight to Google (the guard is for the quiet door only)', w.tokenWindows.length === 2 && w.codeWindows.length === 0);
  }

  // ── B: Brad's morning, replayed ───────────────────────────────────────────
  async function morning(src) {
    const w = world(src);
    w.api.ensure('resume');                    // 13:29:40
    await w.until(11000);                      // he reads it, clicks Continue … Continue
    w.click();                                 // 13:29:58 — a click in the app
    await w.until(19000);
    if (w.code()) { w.code().callback({ code: 'ONE-TIME' }); await w.until(20000); }   // the window answers
    w.click();
    await w.until(80000);
    return w;
  }
  {
    const w = await morning(AUTH);
    T('B1 ONE setup window for the whole morning', w.codeWindows.length === 1, w.codeWindows.length);
    T('B2 no "quiet renew silent after 6s" while he was answering it', !w.log.some(m => /silent after 6s/.test(m)), w.log);
    T('B3 no click-retry window while it was open', !w.log.some(m => /^tap retry: requesting token/.test(m)), w.log);
    T('B4 the pass landed when he answered — once', w.api.delivered.length === 1 && /^linked-/.test(w.api.delivered[0]), w.api.delivered);
    T('B5 no "reconnect" card, no Google token window', w.api.shown() === 0 && w.tokenWindows.length === 0, { shown: w.api.shown(), token: w.tokenWindows.length });
    T('B6 the diary says the app waited for the window', w.log.some(m => /waiting for Google.s setup window/.test(m)), w.log);
  }

  // ── W: a save waiting for a pass waits for the window ─────────────────────
  {
    const w = world(AUTH);
    let got = 'pending';
    w.api.wait('save').then(v => { got = v; });
    await w.until(WAIT_MS + 5000);
    T('W1 past RR_RENEW_WAIT_MS with the window still open → still waiting, not "session expired"', got === 'pending', got);
    await w.answer();
    await w.until(WAIT_MS + 6000);
    T('W2 …and the save goes on the moment he answers', got === true, got);
    T('W3 still ONE window', w.codeWindows.length === 1, w.codeWindows.length);
  }
  {
    // a device that HAS a key and a relay that never answers still gives up at RR_RENEW_WAIT_MS
    const w = world(AUTH);
    w.store.lv_renew_device = JSON.stringify({ device: 'dev-1', email: 'support@therailroster.com' });
    w.ctx.vaultPost = async body => { w.posts.push(body); return new Promise(() => {}); };
    let got = 'pending';
    w.api.wait('save').then(v => { got = v; });
    await w.until(WAIT_MS + 1000);
    T('W4 with no setup window open the wait is RR_RENEW_WAIT_MS, as before', got === false, got);
  }

  // ── R: Reconnect never stacks a consent window on the setup window ───────
  {
    const w = world(AUTH);
    w.api.reconnect();
    await w.until(7000);
    T('R1 Reconnect opened the setup window and, while it is open, NO consent window on top', w.codeWindows.length === 1 && !w.tokenWindows.some(o => o && o.prompt === 'consent'), { code: w.codeWindows.length, token: w.tokenWindows });
  }

  // ── C: one number ─────────────────────────────────────────────────────────
  T('C1 RR_LINK_WINDOW_MAX_MS is declared once, in config.js, at least two minutes', LINK_MS >= 120000 && (CFG.match(/const RR_LINK_WINDOW_MAX_MS =/g) || []).length === 1, LINK_MS);
  const others = fs.readdirSync(APP).filter(f => f.endsWith('.js') && f !== 'config.js')
    .filter(f => /RR_LINK_WINDOW_MAX_MS\s*=/.test(fs.readFileSync(path.join(APP, f), 'utf8')));
  T('C2 no other file sets it', others.length === 0, others);

  // ── P: planted — the shipped v0.9.1981 code fails B and W ────────────────
  if (!OLD) {
    T('P0 the v0.9.1981 copy of app-auth.js could be read from git (197dfda4)', false, 'git show failed');
  } else {
    const w = await morning(OLD);
    T('P1 PLANTED: v0.9.1981 opens the setup window TWICE on the same morning', w.codeWindows.length === 2, w.codeWindows.length);
    T('P2 PLANTED: …and logs "silent after 6s" while he was answering', w.log.some(m => /silent after 6s/.test(m)), w.log);
    const w2 = world(OLD);
    let got = 'pending';
    w2.api.wait('save').then(v => { got = v; });
    await w2.until(WAIT_MS + 5000);
    T('P3 PLANTED: v0.9.1981 gives up on the save at RR_RENEW_WAIT_MS with the window still open', got === false, got);
  }

  console.log('\nsetup_window_once_1982_tests: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); console.log('\nsetup_window_once_1982_tests: ' + pass + ' passed, ' + (fail + 1) + ' failed'); process.exit(1); });
