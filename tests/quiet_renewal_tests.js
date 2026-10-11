#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THE QUIET RENEWAL — v0.9.1924 (relay v4.6)
//
// Brad: "when working in the app a google screen flashes up and off before you
// can read it. its super annoying and users have complained." Google's pass
// lasts an hour; a browser-only app renews it by opening Google's window. Now
// every quiet renewal goes through ONE door (_rrWrapTokenClient): the relay
// renews with this device's key (no window); with no key yet, Google's CODE
// window links the device (the same one window); anything else → the window,
// exactly as before. Runs the REAL block from app/app-auth.js.
//   S  the switch: off / owners / all; sign-in and consent never take the door
//   R  renew through the relay, no window; the pass goes to the CURRENT callback
//   L  link: code window, auth_link, device saved, pass delivered; no_key
//   F  fallbacks: relay down → window + back-off; device unknown → forgotten
//   U  sign-out unlinks the device; Google's revoke is never called
//   P  PLANTED: a hard-coded onTokenReceived strands sheets.js's swapped
//      callback; a wrapper without the callback accessor loses the swap
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), vm = require('vm');
const APP = path.join(__dirname, '..', 'app');
const AUTH = fs.readFileSync(path.join(APP, 'app-auth.js'), 'utf8');
const CFG = fs.readFileSync(path.join(APP, 'config.js'), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 700))); cond ? pass++ : fail++; }
const START = '// ═══ v0.9.1924 — THE QUIET RENEWAL';
const END = '// The only place that asks Google for a token outside of first sign-in.';
function block(src) {
  const a = src.indexOf(START), b = src.indexOf(END);
  if (a < 0 || b < 0) throw new Error('quiet renewal block markers moved');
  return src.slice(a, b);
}
const tick = () => new Promise(r => setImmediate(r));
async function settle() { for (let i = 0; i < 6; i++) await tick(); }

function world(o) {
  o = o || {};
  const store = Object.assign({}, o.store || {});
  const posts = [], log = [], windows = [], codeWindows = [], delivered = [];
  const answers = (o.answers || []).slice();
  let now = o.now || 1_800_000_000_000;
  const real = {
    callback: function (resp) { delivered.push({ to: 'onTokenReceived', resp }); },
    requestAccessToken: function (opts) { windows.push(opts); },
  };
  let codeCfg = null;
  const ctx = {
    console: { log() {}, warn() {} }, JSON, String, Promise, parseInt,
    Date: { now: () => now },
    setTimeout: (fn, ms) => { if (ms >= 3000) return 0; return setImmediate(fn); },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    state: { user: { email: o.email === undefined ? 'bhale@ipd-llc.com' : o.email } },
    RR_QUIET_RENEW: o.mode || 'owners',
    RR_OWNER_EMAILS: ['bhale@ipd-llc.com', 'support@therailroster.com'],
    RR_RENEW_DEVICE_KEY: 'lv_renew_device', RR_RENEW_NOKEY_KEY: 'lv_renew_nokey_until',
    CLIENT_ID: 'cid', SCOPES: 'drive.file email profile',
    _rrAuthLog: m => log.push(m),
    _rrArmGestureRenew: () => log.push('ARMED'),
    _rrTokenRenewing: false,
    onTokenReceived: resp => delivered.push({ to: 'onTokenReceived(global)', resp }),
    vaultPost: async body => { posts.push(body); if (o.throws) throw new Error('offline'); return answers.length ? answers.shift() : null; },
    google: { accounts: { oauth2: { initCodeClient: cfg => { codeCfg = cfg; return { requestCode: () => codeWindows.push(cfg) }; } } } },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  ctx.__real = real;
  vm.runInContext((o.src ? block(o.src) : block(AUTH)) + '\nthis.client = _rrWrapTokenClient(__real);', ctx);
  return { ctx, real, client: ctx.client, store, posts, log, windows, codeWindows, delivered,
    code: () => codeCfg, advance: ms => { now += ms; } };
}
const DEV = (email) => JSON.stringify({ device: 'dev-123', email: email || 'bhale@ipd-llc.com' });

(async () => {
  // ── S ────────────────────────────────────────────────────────────────────
  {
    let w = world({ mode: 'off', store: { lv_renew_device: DEV() } });
    w.client.requestAccessToken({ prompt: '', login_hint: 'x' });
    T('S1 switch off → Google\'s window, the relay is never asked', w.windows.length === 1 && w.posts.length === 0, { windows: w.windows.length, posts: w.posts });
    w = world({ mode: 'owners', email: 'stranger@example.com', store: { lv_renew_device: DEV('stranger@example.com') } });
    w.client.requestAccessToken({ prompt: '' });
    T('S2 owners only → a non-owner still gets the window', w.windows.length === 1 && w.posts.length === 0);
    w = world({ mode: 'all', email: 'stranger@example.com', store: { lv_renew_device: DEV('stranger@example.com') }, answers: [{ status: 200, access_token: 'P', expires_in: 3599, email: 'stranger@example.com' }] });
    w.client.requestAccessToken({ prompt: '' });
    await settle();
    T('S3 all → everyone renews through the relay', w.posts.length === 1 && w.posts[0].action === 'auth_renew' && w.windows.length === 0, w.posts);
    for (const p of ['consent', 'select_account', 'none']) {
      w = world({ store: { lv_renew_device: DEV() } });
      w.client.requestAccessToken({ prompt: p });
      T('S4 prompt "' + p + '" (sign-in / consent) always goes straight to Google', w.windows.length === 1 && w.posts.length === 0);
    }
    T('S5 the shipped switch is one of off / owners / all', /const RR_QUIET_RENEW = '(off|owners|all)';/.test(CFG), (CFG.match(/const RR_QUIET_RENEW = [^;]*;/) || [])[0]);
  }

  // ── R ────────────────────────────────────────────────────────────────────
  {
    const w = world({ store: { lv_renew_device: DEV() }, answers: [{ status: 200, access_token: 'fresh', expires_in: 3599, scope: 'drive.file', email: 'bhale@ipd-llc.com' }] });
    w.client.requestAccessToken({ prompt: '', login_hint: 'bhale@ipd-llc.com' });
    await settle();
    T('R1 a device with a key asks the relay (auth_renew, its device key and email)', w.posts.length === 1 && w.posts[0].action === 'auth_renew' && w.posts[0].device === 'dev-123' && w.posts[0].email === 'bhale@ipd-llc.com', w.posts);
    T('R2 …and NO window opens', w.windows.length === 0 && w.codeWindows.length === 0);
    T('R3 the fresh pass goes down the same road as Google\'s', w.delivered.length === 1 && w.delivered[0].resp.access_token === 'fresh' && w.delivered[0].resp.expires_in === 3599, w.delivered);
    T('R4 the call carries no sign-in proof', !('gtoken' in w.posts[0]));
    T('R5 the diary says no window', w.log.some(m => /quiet renewal ok/.test(m)), w.log);
  }
  {
    // sheets.js style: swap the callback for one request, restore it in the swapped one
    const w = world({ store: { lv_renew_device: DEV() }, answers: [{ status: 200, access_token: 'fresh2', expires_in: 3599 }] });
    const prev = w.client.callback;
    let got = null;
    w.client.callback = function (resp) { w.client.callback = prev; got = resp; };
    T('R6 swapping tokenClient.callback lands on the REAL client', w.real.callback !== prev && typeof w.real.callback === 'function');
    w.client.requestAccessToken({ prompt: '' });
    await settle();
    T('R7 the relay\'s pass reaches the SWAPPED callback (sheets.js / drive.js / outbox)', got && got.access_token === 'fresh2' && w.delivered.length === 0, { got, delivered: w.delivered });
    T('R8 …which restored the original', w.real.callback === prev);
  }

  // ── L ────────────────────────────────────────────────────────────────────
  {
    const w = world({ answers: [{ status: 200, device: 'new-dev', email: 'bhale@ipd-llc.com', access_token: 'linked-pass', expires_in: 3599 }] });
    w.client.requestAccessToken({ prompt: '', login_hint: 'bhale@ipd-llc.com' });
    T('L1 no key yet → Google\'s CODE window opens instead of the token window', w.codeWindows.length === 1 && w.windows.length === 0);
    T('L2 …for the signed-in account, in a popup', w.code() && w.code().login_hint === 'bhale@ipd-llc.com' && w.code().ux_mode === 'popup' && w.code().scope === 'drive.file email profile', w.code());
    w.code().callback({ code: 'ONE-TIME', scope: 'x' });
    await settle();
    T('L3 the code goes to the relay with the expected email (auth_link)', w.posts.length === 1 && w.posts[0].action === 'auth_link' && w.posts[0].code === 'ONE-TIME' && w.posts[0].email === 'bhale@ipd-llc.com', w.posts);
    T('L4 the device key is saved for this account', JSON.parse(w.store.lv_renew_device || '{}').device === 'new-dev' && JSON.parse(w.store.lv_renew_device).email === 'bhale@ipd-llc.com', w.store.lv_renew_device);
    T('L5 linking also delivers the pass — no second window', w.delivered.length === 1 && w.delivered[0].resp.access_token === 'linked-pass' && w.windows.length === 0, w.delivered);
  }
  {
    // a key saved for ANOTHER account is not used, and is replaced on the relay when this account links
    const w = world({ store: { lv_renew_device: DEV('someone.else@example.com') }, answers: [{ status: 200, device: 'mine', email: 'bhale@ipd-llc.com', access_token: 'p', expires_in: 1 }] });
    w.client.requestAccessToken({ prompt: '' });
    T('L6 another account\'s device key is never sent', w.posts.length === 0 && w.codeWindows.length === 1);
    w.code().callback({ code: 'C' });
    await settle();
    T('L7 …and is handed back to the relay to forget when this account links', w.posts[0] && w.posts[0].old_device === 'dev-123', w.posts[0]);
  }
  {
    // Google gave no renewal key: the pass still arrives; the window is used for 7 days
    const w = world({ answers: [{ status: 409, message: 'no_key', access_token: 'p-nokey', expires_in: 3599 }] });
    w.client.requestAccessToken({ prompt: '' });
    w.code().callback({ code: 'C' });
    await settle();
    T('L8 no_key → the pass is delivered anyway', w.delivered.length === 1 && w.delivered[0].resp.access_token === 'p-nokey', w.delivered);
    T('L9 …no device is saved, and "try again" waits 7 days', !w.store.lv_renew_device && parseInt(w.store.lv_renew_nokey_until, 10) > 1_800_000_000_000 + 6 * 864e5, w.store);
    w.client.requestAccessToken({ prompt: '' });
    T('L10 …so the next renewal is the plain window, not another link', w.windows.length === 1 && w.codeWindows.length === 1);
  }
  {
    // the code window could not open / was closed
    const w = world();
    w.client.requestAccessToken({ prompt: '' });
    w.code().error_callback({ type: 'popup_failed_to_open' });
    T('L11 code window blocked → wait for a click (the same as the token window failing)', w.log.indexOf('ARMED') >= 0, w.log);
    w.client.requestAccessToken({ prompt: '' });
    T('L12 …and for the next 10 minutes the plain window is used', w.windows.length === 1 && w.codeWindows.length === 1);
  }

  // ── F ────────────────────────────────────────────────────────────────────
  {
    const w = world({ store: { lv_renew_device: DEV() }, answers: [{ status: 503, message: 'google unavailable' }] });
    w.client.requestAccessToken({ prompt: '', login_hint: 'h' });
    await settle();
    T('F1 relay cannot renew → Google\'s window, as before', w.windows.length === 1 && w.windows[0].login_hint === 'h', w.windows);
    w.client.requestAccessToken({ prompt: '' });
    T('F2 …and for 10 minutes the relay is not asked again', w.posts.length === 1 && w.windows.length === 2);
    w.advance(11 * 60 * 1000);
    w.client.requestAccessToken({ prompt: '' });
    await settle();
    T('F3 after 10 minutes it is tried again', w.posts.length === 2, w.posts.length);
  }
  {
    const w = world({ store: { lv_renew_device: DEV() }, answers: [{ status: 503, message: 'not_set_up' }] });
    w.client.requestAccessToken({ prompt: '' });
    await settle();
    w.advance(3 * 60 * 60 * 1000);
    w.client.requestAccessToken({ prompt: '' });
    T('F4 relay not set up yet → left alone for 6 hours', w.posts.length === 1 && w.windows.length === 2);
  }
  for (const st of [404, 410, 409]) {
    const w = world({ store: { lv_renew_device: DEV() }, answers: [{ status: st, message: 'x' }] });
    w.client.requestAccessToken({ prompt: '' });
    await settle();
    T('F5 relay answers ' + st + ' → the device key is forgotten and the window used', !w.store.lv_renew_device && w.windows.length === 1, w.store);
  }
  {
    const w = world({ store: { lv_renew_device: DEV() }, throws: true });
    w.client.requestAccessToken({ prompt: '' });
    await settle();
    T('F6 the relay cannot be reached → the window', w.windows.length === 1);
  }

  // ── U ────────────────────────────────────────────────────────────────────
  {
    const w = world({ store: { lv_renew_device: DEV() }, answers: [{ status: 200, removed: 1 }] });
    await w.ctx._rrQuietUnlink();
    T('U1 sign-out tells the relay to forget this device', w.posts.length === 1 && w.posts[0].action === 'auth_unlink' && w.posts[0].device === 'dev-123', w.posts);
    T('U2 …and forgets the key here', !w.store.lv_renew_device);
    const so = AUTH.slice(AUTH.indexOf('async function handleSignOut('), AUTH.indexOf('async function handleSignOut(') + 2500);
    T('U3 handleSignOut unlinks BEFORE the stored keys are cleared', so.indexOf('_rrQuietUnlink()') > 0 && so.indexOf('_rrQuietUnlink()') < so.indexOf('rrClearAccountStorage()'));
    const code = fs.readdirSync(APP).filter(f => f.endsWith('.js')).map(f => fs.readFileSync(path.join(APP, f), 'utf8').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n')).join('\n');
    T('U4 Google\'s revoke is never called anywhere in the app', !/oauth2\.revoke\s*\(|oauth2\.googleapis\.com\/revoke|accounts\.google\.com\/o\/oauth2\/revoke/.test(code));
  }

  // ── wiring ───────────────────────────────────────────────────────────────
  T('W1 the app\'s token client IS the wrapped one', /tokenClient = _rrWrapTokenClient\(google\.accounts\.oauth2\.initTokenClient\(\{/.test(AUTH));
  const V = fs.readFileSync(path.join(APP, 'vault.js'), 'utf8');
  T('W2 the three calls are listed as device-key calls (never carry the proof)', /DEVICE_KEY_ACTIONS: \['auth_link', 'auth_renew', 'auth_unlink'\]/.test(V));
  T('W3 a slow relay renewal gets 20 s before a click is waited for', /var _waitMs = \(_rrQuietOn\(\) && _rrQuietDevice\(\)\) \? 20000 : 6000;/.test(AUTH));

  // ── P ────────────────────────────────────────────────────────────────────
  {
    const planted = AUTH.replace(/function _rrQuietPass\(out, real\) \{[\s\S]*?\n\}/, "function _rrQuietPass(out, real) { onTokenReceived({ access_token: out.access_token }); }");
    if (planted === AUTH) throw new Error('could not plant 1');
    const w = world({ src: planted, store: { lv_renew_device: DEV() }, answers: [{ status: 200, access_token: 'z' }] });
    let got = null; const prev = w.client.callback;
    w.client.callback = r => { w.client.callback = prev; got = r; };
    w.client.requestAccessToken({ prompt: '' });
    await settle();
    T('P1 PLANTED: a hard-coded onTokenReceived strands the swapped callback', got === null);
  }
  {
    const planted = AUTH.replace(/    get callback\(\) \{ return real\.callback; \},\n    set callback\(fn\) \{ real\.callback = fn; \},\n/, '');
    if (planted === AUTH) throw new Error('could not plant 2');
    const w = world({ src: planted });
    const fn = () => {};
    w.client.callback = fn;
    T('P2 PLANTED: without the accessor the swap never reaches the real client', w.real.callback !== fn);
  }

  console.log('\nquiet_renewal_tests: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + e.stack); process.exit(1); });
