// ── v0.9.1416 — "Install on this device" reachability ─────────────────────
//
// Brad: "the beta tester does not have it ... its missing on the desktop, its
// on the mobile."
//
// Two things are under test, and the first one matters most: the OLD code must
// FAIL these checks. A test that passes against the broken build is not a test.
// Each assertion below is therefore run twice — once against the shipped file
// and once against a mutated copy with the fix undone (the "drill"). The drill
// half is expected to fail; if it passes, the assertion is not really testing
// anything and the suite says so out loud.
//
// Timing model: the real failure was a race, so time is simulated rather than
// waited on. A fake clock lets the shell appear at t=10s — well past the 3s
// one-shot that caused the bug — which is what a slow desktop sign-in looks
// like.

const fs   = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const APP = function (n) { return path.join(__dirname, '..', 'app', n); };

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

// ── a browser with a clock we control ─────────────────────────────────────
function makeWorld(opts) {
  opts = opts || {};
  const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
    url: 'https://example.test/', pretendToBeVisual: false, runScripts: 'outside-only',
  });
  const win = dom.window;

  // Fake clock. setTimeout queues; tick(ms) fires everything due.
  let now = 0, seq = 0;
  const timers = [];
  win.setTimeout = function (fn, ms) {
    const id = ++seq;
    timers.push({ id, at: now + (ms || 0), fn });
    return id;
  };
  win.clearTimeout = function (id) {
    const i = timers.findIndex(function (t) { return t.id === id; });
    if (i >= 0) timers.splice(i, 1);
  };
  win.tick = function (ms) {
    const target = now + ms;
    for (;;) {
      timers.sort(function (a, b) { return a.at - b.at || a.id - b.id; });
      const nx = timers[0];
      if (!nx || nx.at > target) break;
      timers.shift();
      now = nx.at;
      try { nx.fn(); } catch (e) { /* mirror the browser: a throw kills only this timer */ }
    }
    now = target;
  };

  Object.defineProperty(win.navigator, 'userAgent', {
    value: opts.ua || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126 Safari/537.36',
    configurable: true,
  });
  win.navigator.standalone = false;
  win.matchMedia = function (q) {
    return { matches: !!opts.installed && /standalone/.test(q), media: q,
             addListener: function () {}, removeListener: function () {},
             addEventListener: function () {}, removeEventListener: function () {} };
  };
  win.showToast = function () {};
  win.toggleAccountMenu = function () {
    const m = win.document.getElementById('account-menu');
    if (m) m.style.display = (m.style.display === 'none' ? '' : 'none');
  };
  return win;
}

function run(win, code) { win.eval(code); }

// The account menu exactly as _buildAppShell writes it (the one element that
// matters, with the same id and the same starting display:none).
function buildShell(win, callInit) {
  const d = win.document;
  const menu = d.createElement('div');
  menu.id = 'account-menu';
  menu.style.display = 'none';
  const item = d.createElement('button');
  item.id = 'menu-install-app';
  item.style.display = 'none';
  menu.appendChild(item);
  d.getElementById('app').appendChild(menu);
  // ...and the one line app-setup.js now runs at the end of _buildAppShell.
  if (callInit !== false && typeof win._pwaMenuInit === 'function') win._pwaMenuInit();
}

const MISC_SRC = fs.readFileSync(APP('app-misc.js'), 'utf8');

// The drill: put the two lost behaviours back the way they were.
function undoFix(src) {
  let out = src
    .replace(/if \(!mi\) \{\n\s*if \(_pwaMenuTries < 30\)[\s\S]*?\n\s*return;\n\s*\}/,
             'if (!mi) return;');
  if (out === src) throw new Error('drill did not bite — retry block not found');
  return out;
}

// app-misc.js is a plain script full of other helpers; we only need the PWA
// block, and evaluating the whole file drags in DOM the rest of the app owns.
// Slice the block by its own landmarks so the drill and the real thing are cut
// identically.
function pwaBlock(src) {
  const a = src.indexOf('window._pwaPrompt = null;');
  const b = src.indexOf('setTimeout(_pwaMenuInit, 3000);');
  if (a < 0 || b < 0) throw new Error('could not locate the PWA block');
  return src.slice(a, b + 'setTimeout(_pwaMenuInit, 3000);'.length);
}

// ── 1. Desktop: prompt fires early, shell arrives late ────────────────────
section('Desktop Chrome — beforeinstallprompt at load, sign-in finishes at 10s');

function desktopScenario(src, callInit) {
  const win = makeWorld({});
  run(win, pwaBlock(src));
  // Chrome fires this during page load, long before any menu exists.
  const ev = new win.Event('beforeinstallprompt');
  ev.prompt = function () {};
  ev.userChoice = Promise.resolve({ outcome: 'dismissed' });
  win.dispatchEvent(ev);
  win.tick(3000);              // the old one-shot fires here and finds nothing
  win.tick(7000);              // ...sign-in is still going
  buildShell(win, callInit);   // shell appears at t=10s
  win.tick(2000);              // let anything queued settle
  const mi = win.document.getElementById('menu-install-app');
  return mi ? mi.style.display : '(no element)';
}

// The fix has two halves. Drill BOTH out for the honest pre-fix reproduction,
// then drill each half separately to prove neither half is decoration.
const fixedDesktop  = desktopScenario(MISC_SRC, true);
const brokenDesktop = desktopScenario(undoFix(MISC_SRC), false);
const retryOnly     = desktopScenario(MISC_SRC, false);            // app-setup line removed
const callOnly      = desktopScenario(undoFix(MISC_SRC), true);    // retry chain removed
ok('install item is VISIBLE after a slow desktop sign-in', fixedDesktop === '', 'display=' + JSON.stringify(fixedDesktop));
ok('...and the pre-fix build genuinely failed this (drill, both halves undone)', brokenDesktop === 'none', 'drill showed display=' + JSON.stringify(brokenDesktop));
ok('the retry chain alone is enough (app-setup line drilled out)', retryOnly === '');
ok('the app-setup call alone is enough (retry chain drilled out)', callOnly === '');

// The test simulates app-setup.js calling _pwaMenuInit. Prove the real file
// actually does it, or the four assertions above are checking a fiction.
const SETUP_SRC = fs.readFileSync(APP('app-setup.js'), 'utf8');
ok('app-setup.js really calls _pwaMenuInit when it builds the shell',
   /_pwaMenuInit\s*\(\s*\)/.test(SETUP_SRC));

// ── 2. Retry path alone, with no help from app-setup.js ───────────────────
section('Retry path — shell built by something that does NOT call _pwaMenuInit');

function retryOnlyScenario(src) {
  const win = makeWorld({});
  run(win, pwaBlock(src));
  const ev = new win.Event('beforeinstallprompt');
  ev.prompt = function () {}; ev.userChoice = Promise.resolve({ outcome: 'dismissed' });
  win.dispatchEvent(ev);
  win.tick(4000);
  // shell appears with NO courtesy call — only the retry chain can save this
  const d = win.document;
  const menu = d.createElement('div'); menu.id = 'account-menu'; menu.style.display = 'none';
  const item = d.createElement('button'); item.id = 'menu-install-app'; item.style.display = 'none';
  menu.appendChild(item); d.getElementById('app').appendChild(menu);
  win.tick(5000);
  return d.getElementById('menu-install-app').style.display;
}
ok('retry chain alone still reveals the item', retryOnlyScenario(MISC_SRC) === '');
ok('...and the pre-fix build did not (drill)', retryOnlyScenario(undoFix(MISC_SRC)) === 'none');

// ── 3. Already installed → the item stays hidden ──────────────────────────
section('Already running installed — nothing to offer');
(function () {
  const win = makeWorld({ installed: true });
  run(win, pwaBlock(MISC_SRC));
  const ev = new win.Event('beforeinstallprompt');
  ev.prompt = function () {}; ev.userChoice = Promise.resolve({ outcome: 'dismissed' });
  win.dispatchEvent(ev);
  buildShell(win);
  win.tick(6000);
  ok('install item stays hidden when already installed',
     win.document.getElementById('menu-install-app').style.display === 'none');
})();

// ── 4. _pwaInstall must not POP the account menu open ─────────────────────
section('_pwaInstall called from outside the menu (onboarding)');
(function () {
  const win = makeWorld({});
  run(win, pwaBlock(MISC_SRC));
  buildShell(win);
  const menu = win.document.getElementById('account-menu');
  menu.style.display = 'none';                 // menu is CLOSED, as during onboarding
  win._pwaPrompt = { prompt: function () {}, userChoice: Promise.resolve({ outcome: 'dismissed' }) };
  win._pwaInstall();
  ok('closed account menu stays closed', menu.style.display === 'none',
     'display=' + JSON.stringify(menu.style.display));

  // ...and when it IS open (menu route), it still closes.
  const win2 = makeWorld({});
  run(win2, pwaBlock(MISC_SRC));
  buildShell(win2);
  const m2 = win2.document.getElementById('account-menu');
  m2.style.display = '';                       // open
  win2._pwaPrompt = { prompt: function () {}, userChoice: Promise.resolve({ outcome: 'dismissed' }) };
  win2._pwaInstall();
  ok('open account menu still closes on install', m2.style.display === 'none');
})();

// ── 5. Onboarding screen 4 ────────────────────────────────────────────────
section('Onboarding — the install step');

function onboardWorld(opts) {
  opts = opts || {};
  const win = makeWorld(opts);
  win.ONBOARD_UI = { progressTemplate: 'Step {n} of {total}' };
  win.COMMUNITY_OPTIN = {};
  win.WHAT_I_COLLECT = {};
  win.FEATURE_MAP = [];
  win.TUTORIAL_GIFS = {};
  win.ERAS = { PW: 1 };
  win.state = { user: { name: 'Brad Hale' } };
  win.rrReadyDemos = function () { return []; };
  win._pwaIsInstalled = function () { return !!opts.installed; };
  win._pwaPrompt = opts.canPrompt ? { prompt: function () {}, userChoice: Promise.resolve({}) } : null;
  win.localStorage.clear();
  win.eval(fs.readFileSync(APP('onboarding.js'), 'utf8'));
  return win;
}

(function () {
  const win = onboardWorld({ canPrompt: true });
  win.showFeatureMap();
  win.onboardNext();   // 1 -> 2
  win.onboardNext();   // 2 -> 3
  const panelText3 = win.document.body.textContent;
  ok('counter promises 4 steps when install is on offer', /Step 3 of 4/.test(panelText3),
     panelText3.slice(0, 80));
  win.onboardNext();   // 3 -> 4
  const t4 = win.document.body.textContent;
  ok('screen 4 renders the install offer', /Put it on this device/.test(t4) && /Install now/.test(t4));
  ok('screen 4 offers a way past it', /Not right now/.test(t4));
  win.onboardNext();   // 4 -> done
  ok('finishing screen 4 reaches the done screen', /all set/i.test(win.document.body.textContent));
})();

(function () {
  const win = onboardWorld({ installed: true });
  win.showFeatureMap();
  win.onboardNext(); win.onboardNext();
  ok('counter says 3 steps when already installed', /Step 3 of 3/.test(win.document.body.textContent));
  win.onboardNext();   // 3 -> done, screen 4 skipped entirely
  const t = win.document.body.textContent;
  ok('install step is skipped when already installed',
     /all set/i.test(t) && !/Put it on this device/.test(t));
})();

(function () {
  const win = onboardWorld({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/605.1' });
  win.showFeatureMap();
  win.onboardNext(); win.onboardNext(); win.onboardNext();
  const t = win.document.body.textContent;
  ok('iPhone gets the Safari steps inline, not a dead button',
     /Add to Home Screen/.test(t) && !/Install now/.test(t));
  ok('iPhone steps do not paint a second overlay',
     !win.document.getElementById('ios-install-hint'));
})();

(function () {
  const win = onboardWorld({ ua: 'Mozilla/5.0 (X11; Linux) Firefox/128.0' });
  win.showFeatureMap();
  win.onboardNext(); win.onboardNext(); win.onboardNext();
  const t = win.document.body.textContent;
  ok('a browser with no install route says so honestly',
     /doesn’t support installing|Add to Home screen/.test(t) && !/Install now/.test(t));
})();

(function () {
  // Back out of screen 4 and the tour must still work.
  const win = onboardWorld({ canPrompt: true });
  win.showFeatureMap();
  win.onboardNext(); win.onboardNext(); win.onboardNext();
  win.onboardBack();
  ok('Back from screen 4 lands on screen 3', /Step 3 of 4/.test(win.document.body.textContent));
})();

(function () {
  // Tapping Install swaps the row for a single Continue.
  const win = onboardWorld({ canPrompt: true });
  win.showFeatureMap();
  win.onboardNext(); win.onboardNext(); win.onboardNext();
  win.onboardInstallNow();
  const row = win.document.getElementById('onboard-install-actions');
  ok('after Install, one Continue button remains', !!row && /Continue/.test(row.textContent) && !/Install now/.test(row.textContent));
})();

console.log('\n' + (fail ? 'FAILED' : 'OK') + '  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
