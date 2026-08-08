// ══ tests/guide-interference.js — THE GUIDES AGAINST THE REST OF THE APP ══
//
// Brad: "do it for all the help functions... until i say good morning."
//
// guide-drive walks a guide sensibly. guide-buttons presses its three buttons.
// guide-chaos presses at random. All three treat the guide as the only thing
// happening. It is not. The app has a wizard, a welcome card, a device Back
// stack, a resizable window and a Help Centre that can be opened at any
// moment, and every one of them can arrive while a tour is up.
//
// This is the collision test. What it checks, in every case, is the same short
// list: ONE set of tour furniture, a card the user can still read, a Next the
// user can still press, and no error.
//
// Each case here is a thing a person can really do, not a synthetic poke:
//   · start a guide while the Add wizard is already open
//   · press Next three times in a row, faster than the guide can redraw
//   · press Cancel twice
//   · start the same guide again while it is already running
//   · resize the window mid-guide — the card must stay on screen
//   · press the device / browser Back button mid-guide
//   · have the welcome card appear over a running guide
//
// WHAT IT CANNOT SEE, so nobody trusts it too far:
//   · anything only true of real Google data
//   · whether the words are right — only whether the screen is usable
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { SEED, DRIVER } = require('./lib/guide-fixture');

let chromium;
try { chromium = require('playwright').chromium; }
catch (e) {
  console.log('FAILED  —  guide-interference needs playwright and it is not installed.');
  process.exit(1);
}

const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}

const KIT = `
// The one health check, asked the same way every time. "Usable" is not a
// matter of opinion: exactly one of each piece of tour furniture, a card with
// words in it, and a Next button that is the thing at its own coordinates.
window._ifState = function () {
  var nx = document.getElementById('gt-next');
  var reachable = false, label = '';
  if (nx) {
    var r = nx.getBoundingClientRect();
    label = (nx.innerText || '').trim();
    var top = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
    reachable = !!(top && (top === nx || nx.contains(top)));
  }
  var c = document.getElementById('gt-callout');
  var cr = c ? c.getBoundingClientRect() : null;
  return {
    blockers: document.querySelectorAll('#gt-blocker').length,
    callouts: document.querySelectorAll('#gt-callout').length,
    holes:    document.querySelectorAll('#gt-hole').length,
    card: c ? (c.innerText || '').split('\\n')[0].trim() : null,
    words: c ? (c.innerText || '').replace(/\\s+/g, ' ').trim().length : 0,
    onScreen: cr ? (cr.left >= -2 && cr.top >= -2 &&
                    cr.right <= window.innerWidth + 2 && cr.bottom <= window.innerHeight + 2) : null,
    nextLabel: label,
    nextReachable: reachable,
    wizardOpen: !!document.querySelector('#wizard-modal.open')
  };
};
window._ifReset = async function () {
  await window._drvReset();
  var w = document.getElementById('rr-welcome-card'); if (w) w.remove();
  var h = document.getElementById('help-hub-modal'); if (h) h.remove();
  await new Promise(r => setTimeout(r, 250));
};
`;

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rr-interf-'));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errs = [];
    page.on('pageerror', e => errs.push(e.message.slice(0, 140)));
    for (const u of ['**://accounts.google.com/**', '**://apis.google.com/**',
                     '**://*.googleapis.com/**', '**://cdnjs.cloudflare.com/**',
                     '**://*.google.com/**'])
      await page.route(u, r => r.abort());

    await page.goto('file://' + APP + '/index.html');
    await page.waitForTimeout(2200);
    await page.evaluate(SEED);
    await page.evaluate(DRIVER);
    await page.evaluate(KIT);
    await page.evaluate(() => window._clearOverlays());
    await page.waitForTimeout(400);
    ok('the real app boots with its guides loaded',
       await page.evaluate(() => typeof GUIDES !== 'undefined' && Object.keys(GUIDES).length > 0));

    // ── 1. A GUIDE STARTED WHILE THE WIZARD IS ALREADY OPEN ─────────────────
    // Perfectly ordinary: you are half way through adding something, you get
    // stuck, you open Help. The tour's furniture and the wizard's modal are
    // separate stacking contexts, and if the card lands under the modal the
    // help you just asked for is invisible.
    const overWizard = await page.evaluate(async () => {
      await window._ifReset();
      if (typeof openWizard === 'function') openWizard('collection');
      await new Promise(r => setTimeout(r, 900));
      const wizardWasOpen = !!document.querySelector('#wizard-modal.open');
      startGuide('add-item');
      await new Promise(r => setTimeout(r, 2200));
      const s = window._ifState();
      await window._ifReset();
      return { wizardWasOpen, ...s };
    });
    ok('the wizard really was open before the guide started', overWizard.wizardWasOpen, JSON.stringify(overWizard));
    ok('a guide started over an open wizard shows exactly one card',
       overWizard.callouts === 1 && overWizard.blockers === 1, JSON.stringify(overWizard));
    ok('…and that card is readable, not buried under the wizard',
       overWizard.words > 20 && overWizard.onScreen !== false, JSON.stringify(overWizard));
    ok('…and its Next button is the thing at its own coordinates',
       overWizard.nextReachable, JSON.stringify(overWizard));

    // ── 2. PRESSING NEXT FASTER THAN THE GUIDE CAN REDRAW ───────────────────
    // The card animates its position over 0.25s and some steps hold their
    // redraw for a before() hook. Three quick presses land inside that window.
    const rapid = await page.evaluate(async () => {
      await window._ifReset();
      startGuide('tour');
      await new Promise(r => setTimeout(r, 1500));
      const total = GUIDES.tour.steps.length;
      for (let k = 0; k < 3; k++) {
        const n = document.getElementById('gt-next');
        if (n) n.click();
        await new Promise(r => setTimeout(r, 60));
      }
      await new Promise(r => setTimeout(r, 1800));
      const s = window._ifState();
      const step = (document.getElementById('gt-callout') || { innerText: '' }).innerText.match(/Step (\d+) of (\d+)/);
      await window._ifReset();
      return { ...s, step: step ? +step[1] : null, total, ended: !s.callouts };
    });
    ok('three fast presses of Next never produce two cards',
       rapid.callouts <= 1 && rapid.blockers <= 1, JSON.stringify(rapid));
    ok('…and land on a real step, or finish the guide cleanly',
       rapid.callouts === 0 || (rapid.step >= 1 && rapid.step <= rapid.total), JSON.stringify(rapid));

    // ── 3. PRESSING CANCEL TWICE ────────────────────────────────────────────
    // The second press lands on a button that has already been removed. It
    // must be a no-op, not an error, and must not leave anything behind.
    const doubleCancel = await page.evaluate(async () => {
      await window._ifReset();
      startGuide('reports');
      await new Promise(r => setTimeout(r, 1500));
      const c1 = document.getElementById('gt-cancel');
      if (c1) c1.click();
      await new Promise(r => setTimeout(r, 200));
      if (c1) c1.click();                       // the same node, now detached
      await new Promise(r => setTimeout(r, 600));
      const s = window._ifState();
      const mid = document.elementFromPoint(Math.round(window.innerWidth / 2), Math.round(window.innerHeight / 2));
      let onTour = false;
      try { onTour = !!(mid && mid.closest && mid.closest('#gt-blocker, #gt-callout, #gt-hole, #gt-mascot')); } catch (e) {}
      await window._ifReset();
      return { ...s, onTour };
    });
    ok('pressing Cancel twice leaves nothing behind',
       doubleCancel.callouts === 0 && doubleCancel.blockers === 0 &&
       doubleCancel.holes === 0 && !doubleCancel.onTour, JSON.stringify(doubleCancel));

    // ── 4. STARTING THE SAME GUIDE WHILE IT IS ALREADY RUNNING ──────────────
    // Two Help Centre presses in quick succession. _guidedTour calls _gtEnd on
    // the way in for exactly this reason; this is the assertion that says so.
    const restart = await page.evaluate(async () => {
      await window._ifReset();
      startGuide('photo-inbox');
      await new Promise(r => setTimeout(r, 1200));
      startGuide('photo-inbox');
      await new Promise(r => setTimeout(r, 1800));
      const s = window._ifState();
      await window._ifReset();
      return s;
    });
    ok('starting a guide twice leaves exactly one tour running',
       restart.callouts === 1 && restart.blockers === 1 && restart.holes === 1,
       JSON.stringify(restart));
    ok('…and it is usable, not two blockers eating each other\'s clicks',
       restart.nextReachable, JSON.stringify(restart));

    // ── 5. RESIZING THE WINDOW MID-GUIDE ────────────────────────────────────
    // A laptop being undocked, or a window dragged narrower. The card is
    // position:fixed at coordinates chosen for the OLD size; there is a resize
    // listener for this, and this is what checks it did its job.
    await page.evaluate(async () => {
      await window._ifReset();
      startGuide('add-item');
      await new Promise(r => setTimeout(r, 1600));
    });
    await page.setViewportSize({ width: 900, height: 620 });
    await page.waitForTimeout(1200);
    const resized = await page.evaluate(() => window._ifState());
    ok('the card is still fully on screen after the window shrinks',
       resized.onScreen === true, JSON.stringify(resized));
    ok('…and its Next button is still pressable at the new size',
       resized.nextReachable, JSON.stringify(resized));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(800);
    const grown = await page.evaluate(() => {
      const s = window._ifState();
      return s;
    });
    ok('…and again after it grows back', grown.onScreen === true && grown.nextReachable,
       JSON.stringify(grown));
    await page.evaluate(() => window._ifReset());

    // ── 6. THE BROWSER / DEVICE BACK BUTTON, MID-GUIDE ──────────────────────
    // The app runs its own BackStack so the phone's Back key does something
    // sensible. Pressing it during a guide is a page change the guide has to
    // survive — either by keeping up, or by standing down, but never by
    // hanging over a screen it was not written for.
    const deviceBack = await page.evaluate(async () => {
      await window._ifReset();
      startGuide('reports');
      await new Promise(r => setTimeout(r, 1600));
      const before = window._drvWhere();
      history.back();
      await new Promise(r => setTimeout(r, 2600));
      const s = window._ifState();
      const after = window._drvWhere();
      const stranded = s.callouts ? window._drvStranded('reports') : null;
      await window._ifReset();
      return { before, after, stranded, ...s };
    });
    ok('the browser Back button during a guide raises nothing untoward',
       deviceBack.callouts <= 1 && deviceBack.blockers <= 1, JSON.stringify(deviceBack));
    ok('…and never leaves a card describing a screen that is gone',
       !deviceBack.stranded, JSON.stringify(deviceBack));

    // ── 7. THE WELCOME CARD ARRIVING OVER A RUNNING GUIDE ───────────────────
    // Reachable for real: Help Centre -> "Show the welcome card again", which a
    // user can press while a tour is up. Whichever ends up on top, the one in
    // front has to be the one you can press.
    const welcome = await page.evaluate(async () => {
      await window._ifReset();
      startGuide('tour');
      await new Promise(r => setTimeout(r, 1500));
      if (typeof showWelcomeCard === 'function') showWelcomeCard(true);
      await new Promise(r => setTimeout(r, 900));
      const w = document.getElementById('rr-welcome-card');
      let goReachable = null;
      if (w) {
        const go = w.querySelector('#rr-welcome-go');
        if (go) {
          const r = go.getBoundingClientRect();
          const top = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
          goReachable = !!(top && (top === go || go.contains(top)));
        }
      }
      const s = window._ifState();
      const out = { shown: !!w, goReachable, ...s };
      await window._ifReset();
      return out;
    });
    ok('the welcome card can be shown while a guide is running', welcome.shown, JSON.stringify(welcome));
    ok('…and its own button is pressable rather than trapped under the tour',
       welcome.goReachable === true, JSON.stringify(welcome));

    ok('none of these collisions raises a page error', errs.length === 0, errs.slice(0, 3).join(' | '));
  } finally {
    await browser.close();
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  }
  console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILED') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})();
