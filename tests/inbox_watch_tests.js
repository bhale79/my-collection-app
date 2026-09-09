// ══ tests/inbox_watch_tests.js ═════════════════════════════════════════════
//
// v0.9.1704 (Session 94). THE INBOX WATCHER.
//
// Brad, 2026-09-09: "when i add photos to the inbox from my app, my desktop
// app has to be refreshed to see them. can we not automatically refresh the
// desktop when we make edits on the phone. i am okay with that happening
// when i hit done or apply."
//
// The design: the photos ARE the signal. About once a minute, while the Photo
// Inbox page (or the Dashboard's inbox card) is on screen, the desktop asks
// Drive for a fingerprint of the inbox folder — every photo's id and
// last-changed time — and reloads only when that fingerprint differs from the
// one the screen was built from.
//
// THE RULES THESE PINS DEFEND (each one has a way to go wrong that would be
// worse than the bug being fixed):
//   1. Reload only on a REAL difference. A watcher that redraws on every tick
//      is the crop flash again, once a minute, forever.
//   2. Hold still while the user is mid-anything, and never DROP a change seen
//      while held — the next idle tick must reload. A stale inbox that never
//      catches up is worse than one that needed a manual Refresh.
//   3. Phones and tablets never poll. The phone is the device making the
//      changes; polling there costs battery and buys nothing.
//   4. One door for the reload: the inbox's own Refresh. A second listing
//      path is a second thing to keep right.
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
const PI = fs.readFileSync(path.join(__dirname, '..', 'app', 'photo-inbox.js'), 'utf8');

// ── 1. The shape of the thing, in the source ─────────────────────────────
section('Source pins — the rules are written where they run');

ok('the watcher lives in photo-inbox.js, next to the listing it fingerprints',
   /THE INBOX WATCHER/.test(PI) && /function _pinWatchTick\(why\)/.test(PI), '');
ok('the cadence is ONE number, and it is a minute',
   /var _WATCH_MS = 60000;/.test(PI) && /setInterval\(function \(\) \{ _pinWatchTick\('timer'\); \}, _WATCH_MS\)/.test(PI), '');
ok('RULE 3: it is never started on a phone or tablet',
   /if \(_pinWatchTimer \|\| window\.IS_MOBILE_UA\) return;\s*\/\/ rule 3/.test(PI), '');
ok('…and the hold check refuses a phone too, in case a tick is ever called by hand',
   /if \(window\.IS_MOBILE_UA\) return 'phone';/.test(PI), '');
ok('it is started at module load, so it needs no page hook to remember',
   /try \{ _pinWatchStart\(\); \} catch \(e\) \{\}\n\}\)\(\);\s*$/.test(PI), '');

ok('the look asks Drive for ids and modifiedTime ONLY — no names, no thumbnail links',
   /files\(id,modifiedTime\)&pageSize=1000/.test(PI) && !/files\(id,modifiedTime,/.test(PI), '');
ok('the refresh listing carries modifiedTime too, so it can be the baseline',
   /files\(id,name,createdTime,modifiedTime,appProperties,thumbnailLink\)/.test(PI), '');
ok('RULE 1: only a COMPLETE listing becomes the baseline',
   /_pinWatchSig = _pinListComplete \? _pinWatchSigOf\(files\) : null;/.test(PI), '');
ok('the fingerprint is order-independent (sorted), so a re-sorted listing is not a change',
   /\.sort\(\)\.join\('\|'\)/.test(PI), '');

const holdFn = PI.slice(PI.indexOf('function _pinWatchHold()'), PI.indexOf('async function _pinWatchProbe()'));
['pin-review-ov', 'pin-rv-slotpick', 'pin-ctx-sheet', 'pin-wf-sheet', 'pin-help-sheet', 'pin-grp-panel',
 'window._rrCropOpen', '_selectMode', 'window._pinInternalDrag', '_pinRefreshFlight', 'document.hidden',
 '_pinOffline()', '_qcToken()', "'wizard'"].forEach(function (needle) {
  ok('RULE 2: holds still for ' + needle, holdFn.indexOf(needle) >= 0, '');
});
ok('RULE 2: a change seen while held leaves the baseline UNMATCHED (deferred, never dropped)',
   /hold = _pinWatchHold\(\);\s*\n\s*if \(hold\) \{[^\n]*return 'held'; \}/.test(PI)
   && PI.indexOf("return 'held'") < PI.indexOf('_pinWatchSig = sig;\n        _navBadge'), '');
ok('RULE 4: the inbox page reloads through the ONE refresh door',
   /if \(screen === 'inbox'\) \{[\s\S]{0,200}?await window\._pinRefresh\(\);/.test(PI), '');
ok('…and the dashboard path updates the badge and the card, nothing else',
   /_navBadge\(files\.length\);\s*\n\s*try \{ _pinPanelFill\(\); \}/.test(PI), '');

ok('the busy flag is READ into a reason, not used as a silent user-facing guard',
   /var job = _busy \? \('busy: ' \+ \(_busyWhat \|\| 'a job'\)\) : '';/.test(holdFn), '');

ok('Refresh is single-flight: a second call rides the one in flight',
   /if \(_pinRefreshFlight\) return _pinRefreshFlight;/.test(PI)
   && /_pinRefreshFlight = _pinRefreshRun\(\);/.test(PI)
   && /finally \{ _pinRefreshFlight = null; \}/.test(PI), '');
ok('closing a review card wakes the watcher (what the phone did while you read shows now)',
   /window\._pinCloseReview = function \(\) \{[\s\S]{0,400}?_pinWatchSoon\('card closed'/.test(PI), '');
ok('tab shown and window focused wake it too, through the same debounced door',
   /_pinWatchSoon\('tab shown'/.test(PI) && /_pinWatchSoon\('window focused'/.test(PI), '');

// ── 2. The behaviour, executed in a stub browser ─────────────────────────
section('Behaviour, executed');

function makeWatcher(init) {
  const start = PI.indexOf('  var _WATCH_MS = 60000;');
  const endMark = '  window._pinWatchTick = _pinWatchTick;';
  const src = PI.slice(start, PI.indexOf(endMark) + endMark.length);
  const ctx = Object.assign({
    activePage: 'page-photo-inbox', dashCard: false, mobile: false, hidden: false, offline: false,
    token: true, wizardOpen: false, open: {}, listing: [], nextTokenForever: false, driveFail: false,
    driveCalls: [], refreshes: 0, badge: null, panelFills: 0, timeouts: [], interval: 0, now: 1000000,
  }, init || {});
  const factory = new Function('ctx', `
    var _busy = false, _busyWhat = '', _pinRefreshFlight = null, _selectMode = false;
    var window = {
      IS_MOBILE_UA: ctx.mobile, _rrCropOpen: false, _pinInternalDrag: false,
      _pinRefresh: async function () { ctx.refreshes++; _pinWatchSig = _pinWatchSigOf(ctx.listing); },
      addEventListener: function () {}
    };
    var document = {
      get hidden() { return ctx.hidden; }, visibilityState: 'visible',
      querySelector: function () { return ctx.activePage ? { id: ctx.activePage } : null; },
      getElementById: function (id) {
        if (id === 'pin-panel-grid' || id === 'pin-card-value') return ctx.dashCard ? {} : null;
        if (id === 'wizard-modal') return { classList: { contains: function () { return ctx.wizardOpen; } } };
        return ctx.open[id] ? {} : null;
      },
      addEventListener: function () {}
    };
    var console = { log: function () {}, warn: function () {} };
    var setInterval = function (fn, ms) { ctx.interval = ms; return 1; };
    var setTimeout = function (fn, ms) { ctx.timeouts.push({ fn: fn, ms: ms }); return 1; };
    var Date = { now: function () { return ctx.now; } };
    function _folder() { return Promise.resolve('FOLDER'); }
    function driveRequest(method, ep) {
      ctx.driveCalls.push(ep);
      if (ctx.driveFail) return Promise.reject(new Error('boom'));
      return Promise.resolve(ctx.nextTokenForever ? { files: ctx.listing, nextPageToken: 'more' } : { files: ctx.listing });
    }
    function _pinOffline() { return ctx.offline; }
    function _qcToken() { return ctx.token; }
    function _navBadge(n) { ctx.badge = n; }
    function _pinPanelFill() { ctx.panelFills++; }
    ${src}
    return {
      tick: _pinWatchTick, start: _pinWatchStart, soon: _pinWatchSoon, hold: _pinWatchHold,
      window: window, sig: function () { return _pinWatchSig; },
      set: function (k, v) { if (k === 'busy') _busy = v; else if (k === 'busyWhat') _busyWhat = v; else if (k === 'flight') _pinRefreshFlight = v; else if (k === 'select') _selectMode = v; }
    };
  `);
  return { api: factory(ctx), ctx: ctx };
}
const L1 = [{ id: 'a', modifiedTime: 't1' }, { id: 'b', modifiedTime: 't1' }];
const L2 = [{ id: 'a', modifiedTime: 't1' }, { id: 'b', modifiedTime: 't1' }, { id: 'c', modifiedTime: 't2' }];   // phone added c
const L2crop = [{ id: 'a', modifiedTime: 't9' }, { id: 'b', modifiedTime: 't1' }];                                 // phone cropped a
const L2gone = [{ id: 'a', modifiedTime: 't1' }];                                                                 // phone filed b

(async function () {
  // RULE 1 — a real difference, and only a real difference
  {
    const w = makeWatcher({ listing: L1 });
    ok('RUN: off screen, Drive is never asked',
       (w.ctx.activePage = 'page-browse', await w.api.tick('t')) === 'off screen' && w.ctx.driveCalls.length === 0, '');
    w.ctx.activePage = 'page-photo-inbox';
    ok('RUN: the first look with no baseline TAKES one and does not reload',
       await w.api.tick('t') === 'baseline' && w.ctx.refreshes === 0 && w.api.sig() !== null, '');
    ok('RUN: same fingerprint → "same", no reload',
       await w.api.tick('t') === 'same' && w.ctx.refreshes === 0, '');
    ok('RUN: a re-sorted listing is NOT a change',
       (w.ctx.listing = L1.slice().reverse(), await w.api.tick('t')) === 'same' && w.ctx.refreshes === 0, '');
    ok('RUN: the phone adds a photo → the inbox page reloads through _pinRefresh, exactly once',
       (w.ctx.listing = L2, await w.api.tick('timer')) === 'reloaded' && w.ctx.refreshes === 1, '');
    ok('RUN: …and the reload set the new baseline, so the next look is "same"',
       await w.api.tick('t') === 'same' && w.ctx.refreshes === 1, '');
    ok('RUN: a crop on the phone (same id, new modifiedTime) is a change',
       (w.ctx.listing = L2crop, await w.api.tick('t')) === 'reloaded' && w.ctx.refreshes === 2, '');
    ok('RUN: a photo filed away on the phone (id gone) is a change',
       (w.ctx.listing = L2gone, await w.api.tick('t')) === 'reloaded' && w.ctx.refreshes === 3, '');
    ok('RUN: the look asked for ids + modifiedTime only',
       w.ctx.driveCalls.every(function (ep) { return /fields=nextPageToken,files\(id,modifiedTime\)/.test(ep); }), w.ctx.driveCalls[0]);
  }
  // RULE 2 — hold still, never drop
  {
    const w = makeWatcher({ listing: L1 });
    await w.api.tick('t');                                    // baseline
    w.ctx.listing = L2;                                       // phone adds a photo…
    w.ctx.open['pin-review-ov'] = true;                       // …while a review card is open
    ok('RUN: a change seen while a review card is open is HELD, not applied',
       await w.api.tick('t') === 'pin-review-ov' && w.ctx.refreshes === 0, '');
    delete w.ctx.open['pin-review-ov'];
    ok('RUN: …and the moment the card is gone, the next look reloads — deferred, never dropped',
       await w.api.tick('card closed') === 'reloaded' && w.ctx.refreshes === 1, '');
    const holds = [
      ['hidden tab', function () { w.ctx.hidden = true; }, function () { w.ctx.hidden = false; }, 'hidden'],
      ['offline', function () { w.ctx.offline = true; }, function () { w.ctx.offline = false; }, 'offline'],
      ['signed out', function () { w.ctx.token = false; }, function () { w.ctx.token = true; }, 'signed out'],
      ['a running job (named)', function () { w.api.set('busy', true); w.api.set('busyWhat', 'tagging 20 photos'); }, function () { w.api.set('busy', false); }, 'busy: tagging 20 photos'],
      ['a refresh in flight', function () { w.api.set('flight', {}); }, function () { w.api.set('flight', null); }, 'refresh in flight'],
      ['the crop screen', function () { w.api.window._rrCropOpen = true; }, function () { w.api.window._rrCropOpen = false; }, 'crop screen'],
      ['select mode', function () { w.api.set('select', true); }, function () { w.api.set('select', false); }, 'select mode'],
      ['a drag', function () { w.api.window._pinInternalDrag = true; }, function () { w.api.window._pinInternalDrag = false; }, 'drag'],
      ['the group panel', function () { w.ctx.open['pin-grp-panel'] = true; }, function () { delete w.ctx.open['pin-grp-panel']; }, 'pin-grp-panel'],
      ['the wizard', function () { w.ctx.wizardOpen = true; }, function () { w.ctx.wizardOpen = false; }, 'wizard'],
    ];
    for (const h of holds) {
      h[1]();
      const before = w.ctx.driveCalls.length;
      const verdict = await w.api.tick('t');
      ok('RUN: holds still for ' + h[0] + ' and does not even ask Drive',
         verdict === h[3] && w.ctx.driveCalls.length === before, verdict);
      h[2]();
    }
    ok('RUN: a card opened WHILE Drive was answering is caught by the second check — held, baseline untouched',
       await (async function () {
         const w2 = makeWatcher({ listing: L1 });
         await w2.api.tick('t');                                  // baseline = L1
         const base = w2.api.sig();
         w2.ctx.listing = L2;                                     // Drive will answer with a change…
         // …but a review card opens after the first hold check has already
         // passed: the tick yields at its first await, this microtask runs.
         Promise.resolve().then(function () { w2.ctx.open['pin-review-ov'] = true; });
         const v = await w2.api.tick('t');
         return v === 'held' && w2.ctx.refreshes === 0 && w2.api.sig() === base;
       })(), '');
  }
  // RULE 3 — phones never poll
  {
    const w = makeWatcher({ listing: L2, mobile: true });
    w.api.start();
    ok('RUN: on a phone, start() installs NO timer', w.ctx.interval === 0, String(w.ctx.interval));
    ok('RUN: on a phone, even a hand-called tick refuses and never asks Drive',
       await w.api.tick('t') === 'phone' && w.ctx.driveCalls.length === 0, '');
    const d = makeWatcher({ listing: L1 });
    d.api.start();
    ok('RUN: on a desktop, start() installs a one-minute timer', d.ctx.interval === 60000, String(d.ctx.interval));
  }
  // The dashboard card
  {
    const w = makeWatcher({ listing: L1, activePage: 'page-dashboard', dashCard: true });
    await w.api.tick('t');
    w.ctx.listing = L2;
    ok('RUN: on the dashboard, a change updates the badge and the card — and does NOT run the page refresh',
       await w.api.tick('t') === 'reloaded' && w.ctx.badge === 3 && w.ctx.panelFills === 1 && w.ctx.refreshes === 0, '');
    ok('RUN: …and takes the new baseline, so the next look is "same"',
       await w.api.tick('t') === 'same', '');
    const n = makeWatcher({ listing: L1, activePage: 'page-dashboard', dashCard: false });
    ok('RUN: a dashboard WITHOUT the inbox card is off screen — nothing to keep fresh, Drive not asked',
       await n.api.tick('t') === 'off screen' && n.ctx.driveCalls.length === 0, '');
  }
  // Safety
  {
    const w = makeWatcher({ listing: L1, nextTokenForever: true });
    ok('RUN: a folder too big to fingerprint says so and never compares a partial list',
       await w.api.tick('t') === 'folder too big' && w.ctx.refreshes === 0 && w.api.sig() === null, '');
    const f = makeWatcher({ listing: L1, driveFail: true });
    ok('RUN: a failed look is swallowed — no reload, no throw, and the flag is released',
       await f.api.tick('t') === 'error' && (f.ctx.driveFail = false, await f.api.tick('t')) === 'baseline', '');
    // v0.9.1705 (measured 2026-09-09): the first look after a tab sat hidden
    // for half an hour failed on a token mid-renewal, and the change waited
    // for the next minute tick. ONE quick retry per failure streak — a fault
    // that persists must not turn into a 15-second hammer on Drive.
    const r = makeWatcher({ listing: L1, driveFail: true });
    await r.api.tick('t');
    const retries = () => r.ctx.timeouts.filter(t => t.ms === 15000).length;
    ok('RUN: a failed look schedules ONE quick retry, 15s out', retries() === 1, String(retries()));
    await r.api.tick('t');
    ok('RUN: a second failure in the same streak schedules NO further quick retry', retries() === 1, String(retries()));
    r.ctx.driveFail = false;
    await r.api.tick('t');                       // Drive answers → the latch re-arms
    r.ctx.driveFail = true;
    await r.api.tick('t');
    ok('RUN: …and after a good look, the next failure earns a fresh quick retry', retries() === 2, String(retries()));
    ok('the retry is one number in the source, and the latch is cleared only by an answer from Drive',
       /var _WATCH_RETRY_MS = 15000;/.test(PI) && /if \(!_pinWatchRetried\) \{ _pinWatchRetried = true; _pinWatchSoon\('retry', _WATCH_RETRY_MS\); \}/.test(PI)
       && /var files = await _pinWatchProbe\(\);\s*\n\s*_pinWatchRetried = false;/.test(PI), '');
    const s = makeWatcher({ listing: L1 });
    await s.api.tick('t');
    s.api.soon('focus', 100); s.api.soon('visible', 100);
    const before = s.ctx.driveCalls.length;
    s.ctx.now += 1000;                                            // 1s later: inside the 5s event gap
    for (const t of s.ctx.timeouts.splice(0)) t.fn();
    await new Promise(function (r) { setImmediate(r); });
    ok('RUN: two wake-up events inside 5s are ONE look, not two', s.ctx.driveCalls.length === before, '');
    s.ctx.now += 10000;
    s.api.soon('focus', 100);
    for (const t of s.ctx.timeouts.splice(0)) t.fn();
    await new Promise(function (r) { setImmediate(r); });
    ok('RUN: …and after the gap a wake-up event does look', s.ctx.driveCalls.length === before + 1, '');
  }
  console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.error(e); process.exit(1); });
