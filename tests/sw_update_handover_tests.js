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
function runSW() {
  const calls = { skipWaiting: 0, claim: 0, deleted: [] };
  const handlers = {};
  const cache = { add: () => Promise.resolve(), put: () => Promise.resolve(), match: () => Promise.resolve(undefined) };
  const self_ = {
    location: { href: 'https://therailroster.com/app/sw.js?v=1765' },
    addEventListener: (t, h) => { (handlers[t] = handlers[t] || []).push(h); },
    skipWaiting: () => { calls.skipWaiting++; },
    clients: { claim: () => { calls.claim++; } },
  };
  const caches_ = {
    open: () => Promise.resolve(cache),
    keys: () => Promise.resolve(['mca-v1774', 'mca-v1775']),
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
  ok('…verified: mca-v1774 deleted, mca-v1775 kept',
     sw.calls.deleted.length === 1 && sw.calls.deleted[0] === 'mca-v1774', JSON.stringify(sw.calls.deleted));
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
ok('the worker URL is stamped with this version', /register\('\.\/sw\.js\?v=1765'\)/.test(ix));

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
ok('APP_VERSION v0.9.1765', /const APP_VERSION = 'v0\.9\.1765';/.test(cfg));
ok('CACHE_NAME is the version + 10', /const CACHE_NAME = 'mca-v1775';/.test(swSrc));
ok('index.html stamps every asset at 1765 and none at 1764',
   (ix.match(/\?v=1765/g) || []).length === 79 && !/\?v=1764/.test(ix));

console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
}
