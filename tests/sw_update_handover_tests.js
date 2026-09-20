// ═══════════════════════════════════════════════════════════════
// sw_update_handover_tests.js — v0.9.1758.
//
// Brad, Session 99: "when there is the Update now or tonight button. i hit
// update now. and it updates, but i get a blank screen, then i have to reset
// it again, and it works fine."
//
// ROOT CAUSE: the new service worker was told to take over the instant it was
// ready, from TWO places at once — `self.skipWaiting()` inside sw.js's own
// install handler, and index.html posting SKIP_WAITING on every statechange.
// Update now reloaded the page, the OLD worker started handing over the ~60
// stamped scripts, and partway through the new worker activated and replaced
// it. Every request the old worker still had in flight died with it, so the
// app booted half-built: the blank screen. A second reload found the new
// worker settled and worked.
//
// THE RULE THIS SUITE PROTECTS: a waiting worker is OFFERED, never forced. It
// takes over only when the page asks — with nothing loading — and the page
// reloads only once the handover is done.
//
// These are not grep tests. The real install/activate/message handlers are run
// in a fake worker scope, and the real _rrActivateUpdate is lifted out of
// index.html and driven with a fake window.
// Run:  node tests/sw_update_handover_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const APP = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
const swSrc = APP('sw.js'), ix = APP('index.html'), cfg = APP('config.js');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

// ── run the REAL service worker in a fake scope ────────────────────────────
// v0.9.1784: these three used to be hand-typed version literals too, and the
// obvious grep for "1783" missed the cache-name PAIR below because only ONE of
// the two is this release. Derived now, like the trio itself.
const VT   = require('./lib/version-trio').trioFacts();
const THIS_CACHE = 'mca-v' + (VT.n + 10);
const PREV_CACHE = 'mca-v' + (VT.n + 9);

function runSW() {
  const calls = { skipWaiting: 0, claim: 0, deleted: [] };
  const handlers = {};
  const cache = { add: () => Promise.resolve(), put: () => Promise.resolve(), match: () => Promise.resolve(undefined) };
  const self_ = {
    location: { href: 'https://therailroster.com/app/sw.js?v=' + VT.n },
    addEventListener: (t, h) => { (handlers[t] = handlers[t] || []).push(h); },
    skipWaiting: () => { calls.skipWaiting++; },
    clients: { claim: () => { calls.claim++; } },
  };
  const caches_ = {
    open: () => Promise.resolve(cache),
    keys: () => Promise.resolve([PREV_CACHE, THIS_CACHE]),
    delete: (k) => { calls.deleted.push(k); return Promise.resolve(true); },
  };
  new Function('self', 'caches', 'fetch', 'console', 'URL', 'Response', 'Promise', swSrc)(
    self_, caches_, () => Promise.resolve({ ok: true, clone() { return this; } }),
    { warn() {}, error() {}, log() {} }, URL, { error: () => ({ ok: false }) }, Promise);
  const fire = (type, ev) => (handlers[type] || []).forEach(h => h(ev));
  return { calls, fire, handlers };
}

section('The worker installs quietly — it does NOT barge in (the blank screen)');
let sw = runSW();
const waits = [];
sw.fire('install', { waitUntil: p => waits.push(p) });
ok('install no longer calls skipWaiting — this is the whole bug', sw.calls.skipWaiting === 0, 'skipWaiting called ' + sw.calls.skipWaiting + '×');
ok('install still precaches the shell (waitUntil given a promise)', waits.length === 1 && typeof waits[0].then === 'function');
ok('…and the source says why, naming the symptom, so nobody puts it back',
   /skipWaiting\(\) used to be called right here/.test(swSrc) && /blank screen/.test(swSrc));

section('The page can still ask for the handover — that is now the ONLY way');
sw = runSW();
sw.fire('message', { data: { type: 'SKIP_WAITING' } });
ok('a SKIP_WAITING message activates the waiting worker', sw.calls.skipWaiting === 1);
sw.fire('message', { data: { type: 'something-else' } });
sw.fire('message', {});
ok('any other message is ignored, and a message with no data never throws', sw.calls.skipWaiting === 1);
ok('exactly ONE skipWaiting call site is left in the worker', (swSrc.match(/self\.skipWaiting\(\)/g) || []).length === 1);

section('Activate is unchanged: clear the old caches, take the page');
sw = runSW();
const actWaits = [];
sw.fire('activate', { waitUntil: p => actWaits.push(p) });
ok('activate claims the clients', sw.calls.claim === 1);

ok('activate deletes every cache that is not this version, and keeps this one',
   actWaits.length === 1);
actWaits[0].then(() => {
  ok('…verified: the previous cache deleted, this one kept',
     sw.calls.deleted.length === 1 && sw.calls.deleted[0] === PREV_CACHE, JSON.stringify(sw.calls.deleted));
  rest();
});

function rest() {
section('index.html no longer forces a takeover the moment one is ready');
const reg = ix.slice(ix.indexOf("navigator.serviceWorker.register('./sw.js"), ix.indexOf('}).catch(() => {});') + 20);
ok('the old trySkipWaiting helper is gone from the registration', !/trySkipWaiting/.test(ix));
ok('a newly INSTALLED worker is offered, not activated', /if \(newWorker\.state === 'installed'\) offerIfWaiting\(\);/.test(reg) && !/postMessage/.test(reg));
ok('a worker already waiting at load is offered too', /if \(reg\.waiting\) offerIfWaiting\(\);/.test(reg));
ok('the offer only happens when a worker is actually in charge (never on a first install)',
   /reg\.waiting && navigator\.serviceWorker\.controller/.test(reg));
ok('the registration is published so the card can reach it', /window\._rrSWReg = reg;/.test(ix));
ok('the worker URL is stamped with this version',
   ix.indexOf("register('./sw.js?v=" + VT.n + "')") >= 0);

section('_rrActivateUpdate, run for real: hand over FIRST, reload after');
function liftActivate() {
  const start = ix.indexOf('let _rrWantReload = false, _rrReloading = false;');
  const sig = 'window._rrActivateUpdate = function () {';
  const at = ix.indexOf(sig, start);
  let d = 0, end = -1;
  for (let i = ix.indexOf('{', at + sig.length - 1); i < ix.length; i++) {
    if (ix[i] === '{') d++; else if (ix[i] === '}') { d--; if (!d) { end = i + 1; break; } }
  }
  return ix.slice(start, end) + ';';
}
function harness(regObj, hasController) {
  const state = { reloads: 0, posted: [], timers: [] };
  const win = { location: { reload: () => { state.reloads++; } }, _rrSWReg: regObj };
  const nav = { serviceWorker: { controller: hasController ? {} : null } };
  const setT = (fn, ms) => { state.timers.push({ fn, ms }); return state.timers.length; };
  const api = new Function('window', 'navigator', 'setTimeout',
    liftActivate() + '\nreturn { activate: window._rrActivateUpdate, doReload: _rrDoReload, want: function(){ return _rrWantReload; } };'
  )(win, nav, setT);
  return { state, api, win };
}
const waiting = (state) => ({ waiting: { postMessage: (m) => state.posted.push(m) } });

let h = harness(null, true); h.api.activate();
ok('no worker waiting → reload straight away, so the button always does something', h.state.reloads === 1);

h = harness({ waiting: null }, true); h.api.activate();
ok('a registration with nothing waiting → the same immediate reload', h.state.reloads === 1);

let st = { reloads: 0, posted: [], timers: [] };
h = harness(waiting(st), true); h.state.posted = st.posted; h.api.activate();
ok('a worker IS waiting → it is asked to take over, and the page does NOT reload yet',
   st.posted.length === 1 && st.posted[0].type === 'SKIP_WAITING' && h.state.reloads === 0);
ok('…and the tab remembers that IT asked, so controllerchange knows to reload', h.api.want() === true);
ok('…with a safety timer, so a worker that never takes over cannot strand the button',
   h.state.timers.length === 1 && h.state.timers[0].ms === 4000);
h.state.timers[0].fn();
ok('…the timer reloads if the handover never lands', h.state.reloads === 1);

h = harness(waiting({ posted: [] }), false); h.api.activate();
ok('no controller yet (a first install) → nothing to hand over, just reload', h.state.reloads === 1);

h = harness(null, true); h.api.doReload(); h.api.doReload(); h.api.doReload();
ok('the reload can only ever happen once — no reload loop', h.state.reloads === 1);

h = harness({ get waiting() { throw new Error('boom'); } }, true); h.api.activate();
ok('if anything throws while handing over, the page still reloads rather than hanging', h.state.reloads === 1);

section('controllerchange: reload the tab that asked, offer to the ones that did not');
const cc = ix.slice(ix.indexOf("addEventListener('controllerchange'"), ix.indexOf("addEventListener('controllerchange'") + 300);
ok('the tab that pressed Update now reloads', /if \(_rrWantReload\) \{ _rrDoReload\(\); return; \}/.test(cc));
ok('another open tab is OFFERED the card instead of being yanked', /_rrOfferUpdate\(\);/.test(cc));
ok('the reload guard is separate from the card-offer guard (_swReloaded)',
   /let _rrWantReload = false, _rrReloading = false;/.test(ix) && /let _swReloaded = false;/.test(ix));

section('Both of Brad\'s buttons go through the handover');
const upNow = cfg.slice(cfg.indexOf('window._rrUpdateNow = function'), cfg.indexOf('window._rrUpdateTonight = function'));
ok('Update now hands over first, then reloads', /window\._rrActivateUpdate\(\); return;/.test(upNow));
ok('…and still remembers the page you were on', /rr_resume_page/.test(upNow));
ok('…and falls back to a plain reload on an older page that has no handover', /location\.reload\(\);/.test(upNow));
const night = cfg.slice(cfg.indexOf('_rrScheduleNightReload = function'), cfg.indexOf('window._rrUpdateNow'));
ok('Tonight (3 AM) takes the same path', /window\._rrActivateUpdate\(\); return;/.test(night));
ok('…and still refuses to reload over unfinished work', /_rrBusyNow/.test(night));

section('The trio moved together');
// v0.9.1784: derived from config.js, never typed here. See tests/lib/version-trio.js.
const TRIO = require('./lib/version-trio');
TRIO.checkTrio(ok, { cfg: cfg, sw: swSrc, ix: ix });

// ── the derived check must be able to FAIL ────────────────────────────────
// This suite owns the proof because it is the version-and-worker suite; the
// other two consumers just call it. A check nobody can break is worth nothing
// (feedback_scan_must_prove_itself), and this one replaced three hand-typed
// regexes, so it has to earn that.
section('The trio check can catch every way the trio drifts');
{
  const probe = (label, src) => TRIO.trioFacts(src);   // label documents the case

  // 1 — the cache name is left on the previous release. THE classic: the
  //     service worker then never swaps, and users sit on stale code.
  const t1 = probe('stale cache', { cfg: cfg, ix: ix,
    sw: swSrc.replace(/const CACHE_NAME = 'mca-v(\d+)';/,
                      (m, n) => "const CACHE_NAME = 'mca-v" + (parseInt(n, 10) - 1) + "';") });
  ok('a CACHE_NAME left on the last release is caught',
     t1.cacheN !== t1.n + 10, String(t1.cacheN));

  // 2 — ONE stamp in index.html is missed. The old check only compared
  //     against N-1, so a stamp stranded at any OTHER version sailed through.
  //     This is the case the old block could not see.
  const t2 = probe('stranded stamp', { cfg: cfg, sw: swSrc,
    ix: ix.replace(/\?v=(\d+)/, '?v=1502') });
  ok('ONE stamp stranded at an OLD, NON-ADJACENT version is caught',
     !(t2.distinctStamps.length === 1), t2.distinctStamps.join(', '));

  // 3 — a new script is added and nobody stamps it. It carries no ?v= at
  //     all, so counting stamps could never find it; this is new coverage.
  const t3 = probe('unstamped asset', { cfg: cfg, sw: swSrc,
    ix: ix.replace('</head>', '<script src="new-thing.js"></script></head>') });
  ok('a newly added script with NO stamp at all is caught',
     t3.unstamped.indexOf('new-thing.js') >= 0, t3.unstamped.join(', '));

  // 4 — config.js stops declaring a version. Everything is derived from it,
  //     so the derivation must not quietly pass on nothing.
  const t4 = probe('no version', { sw: swSrc, ix: ix,
    cfg: cfg.replace(/const APP_VERSION = 'v0\.9\.\d+';/, "const APP_VERSION = 'dev';") });
  ok('config.js with no real version is caught', !t4.version, String(t4.version));

  // 5 — and the opposite guard: an index.html with nothing in it must not
  //     pass just because "all zero stamps agree".
  const t5 = probe('empty index', { cfg: cfg, sw: swSrc, ix: '<html></html>' });
  ok('an emptied index.html cannot pass on a vacuous agreement',
     t5.stampCount < 50, String(t5.stampCount));
}

// ═══════════════════════════════════════════════════════════════
// v0.9.1787 — THE APP HAS TO ASK AGAIN, OR THE OFFER NEVER ARRIVES.
//
// [stated] Brad, on v0.9.1786: "did not get an update box." Twice running,
// with the fix he was waiting for already live on his phone.
//
// Everything above this point protects the HANDOVER — what happens once he
// presses Update now. None of it matters if the card never appears. Two holes
// put it there, and his phone fell down both:
//
//   1. the check ran ONCE, eight seconds after load, and never again, so an
//      app left open never found out;
//   2. if the app was still signing in or still loading the catalog at that
//      eight-second mark, the bar refused to paint (right) and then THREW THE
//      ANSWER AWAY (wrong) for the rest of the session.
//
// These run the REAL functions lifted out of config.js against a fake window,
// the same way _rrActivateUpdate is driven above.
// ═══════════════════════════════════════════════════════════════
section('The offer ARRIVES: the app asks again, and does not forget the answer');
{
  function liftFn(src, sig) {
    const at = src.indexOf(sig);
    if (at < 0) return null;
    let d = 0;
    for (let i = src.indexOf('{', at + sig.length - 1); i < src.length; i++) {
      if (src[i] === '{') d++;
      else if (src[i] === '}') { d--; if (!d) return src.slice(at, i + 1) + ';'; }
    }
    return null;
  }

  // A fake page. `active` says whether the app has finished signing in and
  // loading — the thing the eight-second check kept losing the race with.
  function page(opts) {
    opts = opts || {};
    const st = { appended: [], timers: [], fetched: [], listeners: {} };
    const appEl = { classList: { contains: c => c === 'active' && !!opts.active } };
    const doc = {
      getElementById: id => (id === 'app' ? appEl
                          : (id === 'rr-update-bar' ? (st.appended.length ? st.appended[0] : null) : null)),
      createElement: () => ({ style: {}, set id(v) { this._id = v; }, get id() { return this._id; } }),
      body: { appendChild: el => st.appended.push(el) },
      addEventListener: (ev, fn) => { st.listeners[ev] = fn; },
      visibilityState: opts.visibility || 'visible',
    };
    const store = opts.store || {};
    const win = {
      _rrPendingUpdateVer: null, _rrPendingUpdateTries: 0,
      _RR_UPDATE_RECHECK_MS: 15 * 60 * 1000, _rrLastUpdateCheck: 0,
    };
    const localStorage = { getItem: k => (k in store ? store[k] : null),
                           setItem: (k, v) => { store[k] = String(v); } };
    const setT = (fn, ms) => { st.timers.push({ fn, ms }); return st.timers.length; };
    const fetchFn = (url) => {
      st.fetched.push(url);
      if (opts.offline) return Promise.reject(new Error('offline'));
      return Promise.resolve({ text: () => Promise.resolve(opts.serverSrc || '') });
    };
    const body = liftFn(cfg, 'window._rrShowUpdateBar = function') + '\n'
               + liftFn(cfg, 'window._rrCheckForUpdate = function') + '\n'
               + 'return { show: window._rrShowUpdateBar, check: window._rrCheckForUpdate };';
    const api = new Function('window', 'document', 'localStorage', 'setTimeout',
                             'fetch', 'APP_VERSION', 'Date', body)
      (win, doc, localStorage, setT, fetchFn, opts.running || 'v0.9.1786',
       opts.Date || Date);
    return { st, api, win, store };
  }

  ok('both real functions were found in config.js — nothing here is a stub',
     !!liftFn(cfg, 'window._rrShowUpdateBar = function') &&
     !!liftFn(cfg, 'window._rrCheckForUpdate = function'));

  // ── the bar, when the app is ready ──────────────────────────────────────
  let p = page({ active: true });
  p.api.show('v0.9.1787');
  ok('a newer version with the app ready → the card is shown', p.st.appended.length === 1);

  p = page({ active: true });
  p.api.show('v0.9.1786');
  ok('the SAME version we are running is never offered', p.st.appended.length === 0);

  p = page({ active: true, store: { rr_update_bar_seen: 'v0.9.1787' } });
  p.api.show('v0.9.1787');
  ok('a version he already said "Tonight" to is not asked again', p.st.appended.length === 0);

  p = page({ active: true, store: { rr_update_bar_seen: 'v0.9.1786' } });
  p.api.show('v0.9.1787');
  ok('…but a NEWER version than the one he deferred still gets asked', p.st.appended.length === 1);

  // ── THE BUG: not ready yet ──────────────────────────────────────────────
  p = page({ active: false });
  p.api.show('v0.9.1787');
  ok('app not ready → nothing is painted over the sign-in screen (unchanged)',
     p.st.appended.length === 0);
  ok('…but the answer is HELD, not thrown away — THE BUG BRAD REPORTED',
     p.win._rrPendingUpdateVer === 'v0.9.1787' && p.st.timers.length === 1);
  ok('…and it looks again a few seconds later', p.st.timers[0].ms === 3000);

  // let the app finish loading, then let the retry fire
  {
    let ready = false;
    const st2 = { appended: [], timers: [] };
    const appEl = { classList: { contains: c => c === 'active' && ready } };
    const doc = {
      getElementById: id => (id === 'app' ? appEl
                          : (id === 'rr-update-bar' ? (st2.appended.length ? st2.appended[0] : null) : null)),
      createElement: () => ({ style: {} }),
      body: { appendChild: el => st2.appended.push(el) },
      addEventListener: () => {},
    };
    const win = { _rrPendingUpdateVer: null, _rrPendingUpdateTries: 0 };
    const api = new Function('window', 'document', 'localStorage', 'setTimeout', 'APP_VERSION',
      liftFn(cfg, 'window._rrShowUpdateBar = function') + '\nreturn window._rrShowUpdateBar;')
      (win, doc, { getItem: () => null, setItem: () => {} },
       (fn, ms) => { st2.timers.push({ fn, ms }); }, 'v0.9.1786');
    win._rrShowUpdateBar = api;
    api('v0.9.1787');
    ok('while still loading, nothing is shown', st2.appended.length === 0);
    ready = true;                       // he finishes signing in
    st2.timers[0].fn();                 // the retry fires
    ok('once the app IS ready the held offer finally appears — the whole point',
       st2.appended.length === 1);
  }

  // bounded, so a copy parked on the sign-in screen is not polled forever
  p = page({ active: false });
  for (let i = 0; i < 80; i++) {
    p.win._rrPendingUpdateTries = i;
    p.api.show('v0.9.1787');
  }
  ok('the retry is BOUNDED — a copy left on sign-in is not polled forever',
     p.st.timers.length === 60, String(p.st.timers.length));

  // ── asking again when the app comes back to the front ───────────────────
  const newer = "const APP_VERSION = 'v0.9.1790';";
  p = page({ active: true, serverSrc: newer });
  p.api.check();
  ok('the re-check reaches the network past the service worker (?rr_selfcheck=1)',
     p.st.fetched.length === 1 && /\?rr_selfcheck=1/.test(p.st.fetched[0]), p.st.fetched[0]);

  p = page({ active: true, serverSrc: newer });
  p.api.check();
  p.api.check();
  p.api.check();
  ok('bringing the app forward three times in a row costs ONE check (throttled)',
     p.st.fetched.length === 1, String(p.st.fetched.length));

  p = page({ active: true, serverSrc: newer });
  p.api.check();
  p.api.check(true);
  ok('…and a forced check still goes through', p.st.fetched.length === 2);

  // The rest are ASYNC — the card can only appear after the fetch resolves.
  // Awaiting is the point: asserting synchronously here would read an empty
  // page and pass while proving nothing.
  (async function () {
    let q = page({ active: true, serverSrc: newer });
    q.api.check();
    await new Promise(r => setTimeout(r, 0));
    ok('a newer version on the server raises the card', q.st.appended.length === 1);

    q = page({ active: true, serverSrc: "const APP_VERSION = 'v0.9.1786';" });
    q.api.check();
    await new Promise(r => setTimeout(r, 0));
    ok('the SAME version on the server raises nothing', q.st.appended.length === 0);

    q = page({ active: true, offline: true });
    q.api.check();
    await new Promise(r => setTimeout(r, 0));
    ok('offline is silent, and never breaks the app', q.st.appended.length === 0);

    // ── planted offenders: every rule above must be able to FAIL ──────────
    section('Planted offenders — the new rules can actually fail');

    const noHold = cfg.replace(
      /if \(window\._rrPendingUpdateVer !== netApp\)[\s\S]*?\n      return;\n    \}/,
      'return;   // the v1786 behaviour: forget the answer');
    ok('THE BUG BRAD REPORTED: a bar that forgets the answer is caught',
       !/_rrPendingUpdateVer = netApp/.test(liftFn(noHold, 'window._rrShowUpdateBar = function') || ''));

    const noThrottle = cfg.replace(
      'if (!force && (now - window._rrLastUpdateCheck) < window._RR_UPDATE_RECHECK_MS) return;', '');
    {
      const body = liftFn(noThrottle, 'window._rrCheckForUpdate = function')
                 + '\nreturn window._rrCheckForUpdate;';
      const hits = [];
      const fn = new Function('window', 'fetch', 'APP_VERSION', body)(
        { _RR_UPDATE_RECHECK_MS: 1e9, _rrLastUpdateCheck: 0 },
        u => { hits.push(u); return Promise.resolve({ text: () => Promise.resolve('') }); },
        'v0.9.1786');
      fn(); fn(); fn();
      ok('a lost throttle — the app hammering the network on every glance — is caught',
         hits.length !== 1, String(hits.length));
    }

    // ⚠ THIS OFFENDER WAS PLANTED IN THE WRONG PLACE FIRST TIME, and it is
    // worth keeping the reason. That fetch line appears THREE times in
    // config.js — twice in the older deploy-mismatch self-check — and a plain
    // .replace() takes the FIRST. So the offender landed in a function this
    // rule does not govern, the real one was left untouched, and the check
    // "failed" while the code was correct. Scope the surgery to the function
    // under test, always.
    const checkSrc = liftFn(cfg, 'window._rrCheckForUpdate = function') || '';
    const hasTag = s => /fetch\('\.\/config\.js\?rr_selfcheck=1'/.test(s);
    ok('the re-check itself really does carry ?rr_selfcheck=1', hasTag(checkSrc));
    ok('…and dropping it is caught — without the tag the worker answers from its own cache',
       !hasTag(checkSrc.replace('./config.js?rr_selfcheck=1', './config.js')));

    const unbounded = cfg.replace('window._rrPendingUpdateTries < 60', 'true');
    ok('an UNBOUNDED retry loop is caught',
       !/_rrPendingUpdateTries < 60/.test(liftFn(unbounded, 'window._rrShowUpdateBar = function') || ''));

    ok('the app listens for coming back to the front, and acts only when VISIBLE',
       /addEventListener\('visibilitychange'/.test(cfg) &&
       /visibilityState === 'visible'\) window\._rrCheckForUpdate\(\)/.test(cfg));

    const noListener = cfg.replace(/document\.addEventListener\('visibilitychange'[\s\S]*?\n\}/, '');
    ok('…and losing that listener is caught', !/addEventListener\('visibilitychange'/.test(noListener));

    console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
    process.exit(fail ? 1 : 0);
  })();
}
}
