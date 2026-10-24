// ═══════════════════════════════════════════════════════════════
// signin_update_loop_2019_tests.js — v0.9.2019.
//
// [stated] Brad 2026-10-23: "the page seems to keep reloading every second.
// this happened earlier today."
//
// ROOT CAUSE (caught live in Brad's Chrome with a navigate-event stack:
// offerIfWaiting → _rrOfferUpdate → location.reload): on the SIGN-IN screen,
// a waiting service worker made index.html do a PLAIN reload. A reload never
// hands over — the old worker stays in charge, the new one keeps waiting — so
// every reloaded sign-in screen found the same waiting worker and reloaded
// again, about once a second.
//
// THE RULE: on the sign-in screen the waiting worker is HANDED OVER
// (_rrActivateUpdate: SKIP_WAITING, reload once it has taken over), and the
// sign-in branch can fire at most once per 30 s per tab — never a loop.
//
// Not a grep test: the real block (from `let _swReloaded` through
// `_rrOfferUpdate`) is lifted out of index.html and driven with a fake window,
// and the suite proves it can FAIL by running the same harness on the old
// plain-reload line and watching it loop.
// Run:  node tests/signin_update_loop_2019_tests.js
// ═══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const ix = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

function liftBlock(src) {
  const start = src.indexOf('let _swReloaded = false;');
  const sig = 'const _rrOfferUpdate = () => {';
  const at = src.indexOf(sig, start);
  if (start < 0 || at < 0) return null;
  let d = 0, end = -1;
  for (let i = src.indexOf('{', at + sig.length - 1); i < src.length; i++) {
    if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (!d) { end = i + 1; break; } }
  }
  return src.slice(start, end) + ';';
}

// One simulated page load of the sign-in screen with a worker waiting.
// `store` is sessionStorage and survives the reload, like the real one.
// `handsOver` = does the waiting worker actually take over when asked?
function loadSignIn(src, store, handsOver, clock) {
  const st = { reloads: 0, posted: 0, timers: [] };
  const reg = { waiting: { postMessage: () => { st.posted++; if (handsOver) reg.waiting = null; } } };
  const win = { location: { reload: () => { st.reloads++; } }, _rrSWReg: reg };
  const doc = {
    getElementById: (id) => id === 'app' ? { classList: { contains: () => false } } : null,
    querySelector: () => null, activeElement: null,
  };
  const ss = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  const setT = (fn, ms) => { st.timers.push({ fn, ms }); return st.timers.length; };
  const nav = { serviceWorker: { controller: {} } };
  const fakeDate = { now: () => clock.t };
  const body = liftBlock(src);
  const api = new Function('window', 'document', 'navigator', 'setTimeout', 'sessionStorage', 'fetch', 'Date',
    body + '\nreturn { offer: _rrOfferUpdate, want: function(){ return _rrWantReload; }, doReload: _rrDoReload };'
  )(win, doc, nav, setT, ss, () => Promise.reject(new Error('no')), fakeDate);
  return { st, api };
}

// Drive N page loads: each load offers once; the first timer (the 4 s safety
// net) is fired as if time passed. Count how many reloads happen in total.
function drive(src, handsOver, loads) {
  const store = {}, clock = { t: 1000000 };
  let reloads = 0, posted = 0;
  for (let i = 0; i < loads; i++) {
    const p = loadSignIn(src, store, handsOver, clock);
    p.api.offer();
    if (p.api.want() && handsOver) p.api.doReload();      // controllerchange after a real handover
    p.st.timers.forEach(t => { if (t.ms === 4000) t.fn(); });   // safety net
    reloads += p.st.reloads; posted += p.st.posted;
    if (!p.st.reloads) break;                              // page stayed put — the loop is over
    clock.t += 1000;                                       // the next load, a second later
  }
  return { reloads, posted };
}

section('The block can be lifted and run');
ok('index.html still has the sign-in branch in _rrOfferUpdate', !!liftBlock(ix));

section('Sign-in screen + a waiting worker that takes over: ONE reload, then quiet');
let r = drive(ix, true, 20);
ok('the waiting worker is asked to take over (SKIP_WAITING)', r.posted >= 1, 'posted ' + r.posted);
ok('the page reloads exactly once', r.reloads === 1, 'reloads ' + r.reloads);

section('Sign-in screen + a worker that NEVER takes over: bounded, not a loop');
r = drive(ix, false, 20);
ok('at most one reload in a 20-load run (was 20 — one a second, forever)', r.reloads <= 1, 'reloads ' + r.reloads);

section('The sign-in branch no longer does a plain reload');
const branch = ix.slice(ix.indexOf("if (!appEl || !appEl.classList.contains('active')) {"), ix.indexOf("if (!appEl || !appEl.classList.contains('active')) {") + 900);
ok('it hands over through _rrActivateUpdate', /window\._rrActivateUpdate\(\);/.test(branch));
ok('it carries the 30 s once-only guard', /rr_signin_handover_at/.test(branch) && /30000/.test(branch));
const before = ix.slice(ix.indexOf("if (!appEl || !appEl.classList.contains('active')) {") - 1400, ix.indexOf("if (!appEl || !appEl.classList.contains('active')) {"));
ok('the comment names the symptom so nobody puts the plain reload back', /once a second, forever/.test(before) && /A reload never hands over/.test(before));

section('The check can FAIL: the old plain-reload line loops');
const OLD = "if (!appEl || !appEl.classList.contains('active')) { _swReloaded = true; window.location.reload(); return; }";
const start = ix.indexOf("if (!appEl || !appEl.classList.contains('active')) {");
const stop = ix.indexOf('        return;\n      }', start) + '        return;\n      }'.length;
const planted = ix.slice(0, start) + OLD + ix.slice(stop);
ok('planting the old line keeps the block runnable', !!liftBlock(planted));
const pr = drive(planted, false, 20);
ok('…and the harness sees the loop: 20 reloads in 20 loads', pr.reloads === 20, 'reloads ' + pr.reloads);
const pr2 = drive(planted, true, 20);
ok('…even when the worker would have taken over (a plain reload never asks it to)', pr2.reloads === 20 && pr2.posted === 0, JSON.stringify(pr2));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
