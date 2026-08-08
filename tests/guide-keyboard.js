// ══ tests/guide-keyboard.js — CAN YOU USE THE HELP WITHOUT A MOUSE? ═══════
//
// Round seven. Every harness before this one clicks. Not everybody clicks.
//
// A first look at the tour engine found NOTHING for the keyboard: no Escape
// handler, no focus management, no roles, no labels. The card is appended to
// the end of <body>, so a keyboard user tabbing forward walks through every
// control on the page behind the dimmer — all of which the blocker has made
// unclickable — before reaching the Next button they are looking for. And a
// screen reader is told nothing has happened at all.
//
// What this checks:
//   · ESCAPE leaves the guide. Every other box in this app closes on Escape.
//   · focus LANDS on the card when a guide starts, so the next Tab is useful.
//   · Tab CYCLES inside the card on an ordinary step, instead of wandering off
//     into a page the user cannot reach anyway.
//   · …but NOT on a step that waits for you to do something, because that step
//     needs you to reach the app. The engine already makes exactly this
//     distinction for the mouse (blocker.pointerEvents), and the keyboard has
//     to make the same one or a waiting step becomes a dead end.
//   · the card announces itself: a role, a name, and step changes spoken.
//
// WHAT IT CANNOT SEE, so nobody trusts it too far:
//   · what a real screen reader actually says
//   · physical key handling in a real browser with a real keyboard layout
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { SEED, DRIVER } = require('./lib/guide-fixture');

let chromium;
try { chromium = require('playwright').chromium; }
catch (e) {
  console.log('FAILED  —  guide-keyboard needs playwright and it is not installed.');
  process.exit(1);
}

const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}

const KIT = `
window._kbWhere = function () {
  var a = document.activeElement;
  if (!a) return 'none';
  var inCard = false;
  try { inCard = !!(a.closest && a.closest('#gt-callout')); } catch (e) {}
  return (inCard ? 'card:' : 'page:') + (a.id || a.tagName) +
         ((a.innerText || '').trim() ? ' "' + (a.innerText || '').trim().slice(0, 18) + '"' : '');
};
window._kbCard = function () {
  var c = document.getElementById('gt-callout');
  if (!c) return null;
  return { role: c.getAttribute('role') || '', label: c.getAttribute('aria-label') || '',
           live: c.getAttribute('aria-live') || (c.querySelector('[aria-live]') ? 'inner' : ''),
           modal: c.getAttribute('aria-modal') || '',
           tabindex: c.getAttribute('tabindex') || '' };
};
`;

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rr-kb-'));
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

    // ── 1. ESCAPE LEAVES ────────────────────────────────────────────────────
    await page.evaluate(async () => { await window._drvReset(); startGuide('reports'); });
    await page.waitForTimeout(1600);
    const before = await page.evaluate(() => !!document.getElementById('gt-callout'));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(700);
    const afterEsc = await page.evaluate(() => ({
      card: !!document.getElementById('gt-callout'),
      blocker: !!document.getElementById('gt-blocker'),
      hole: !!document.getElementById('gt-hole')
    }));
    ok('a guide was running before Escape was pressed', before);
    ok('BRAD\'S ASK: Escape gets you out of a guide',
       !afterEsc.card && !afterEsc.blocker && !afterEsc.hole, JSON.stringify(afterEsc));

    // ── 2. FOCUS LANDS SOMEWHERE USEFUL ─────────────────────────────────────
    await page.evaluate(async () => {
      await window._drvReset();
      document.body.focus();
      startGuide('reports');
    });
    await page.waitForTimeout(1700);
    const focused = await page.evaluate(() => window._kbWhere());
    ok('starting a guide moves focus into the card, not left on the page behind it',
       /^card:/.test(focused), focused);

    // ── 3. TAB STAYS IN THE CARD ON AN ORDINARY STEP ────────────────────────
    // Everything behind the dimmer is unclickable on an ordinary step, so
    // letting Tab walk into it strands the keyboard user in a page that cannot
    // respond. Six presses is more than the card has buttons — if focus is
    // loose, it will have escaped by then.
    // Step ON one first: there is no Back button on the first card of a guide,
    // correctly, so checking for it there would be asking the app for something
    // that should not exist. Step 2 has all three.
    await page.evaluate(() => { const n = document.getElementById('gt-next'); if (n) n.click(); });
    await page.waitForTimeout(900);
    const tabWalk = [];
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(120);
      tabWalk.push(await page.evaluate(() => window._kbWhere()));
    }
    ok('Tab stays inside the card while the page behind is unreachable anyway',
       tabWalk.every(w => /^card:/.test(w)), tabWalk.join(' → '));
    ok('…and it reaches the buttons that matter — Next, Back and Cancel',
       ['gt-next', 'gt-back', 'gt-cancel'].every(id => tabWalk.some(w => w.indexOf(id) >= 0)),
       tabWalk.join(' → '));

    // ── 4. …BUT A WAITING STEP MUST LET YOU REACH THE APP ───────────────────
    // The mirror of the rule the engine already applies to the mouse. A step
    // that waits for you to press something in the app has to let the keyboard
    // get there, or it is a trap with no way forward.
    await page.evaluate(async () => {
      await window._drvReset();
      startGuide('add-item');           // step 1 waits for the wizard to open
    });
    await page.waitForTimeout(1800);
    const waitWalk = [];
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(110);
      waitWalk.push(await page.evaluate(() => window._kbWhere()));
    }
    const waitingGate = await page.evaluate(() => {
      const st = GUIDES['add-item'].steps[0];
      return typeof st.awaitUser === 'function';
    });
    ok('the step used for this check really is one that waits', waitingGate);
    ok('BRAD\'S RULE: on a step that waits, the keyboard can still reach the app',
       waitWalk.some(w => /^page:/.test(w)), waitWalk.join(' → '));

    // ── 5. THE CARD ANNOUNCES ITSELF ────────────────────────────────────────
    await page.evaluate(async () => { await window._drvReset(); startGuide('reports'); });
    await page.waitForTimeout(1600);
    const aria = await page.evaluate(() => window._kbCard());
    ok('the card has a role, so it is not read as anonymous text',
       !!aria && /dialog|region|complementary/.test(aria.role), JSON.stringify(aria));
    ok('…and a name, so what is read out says which card it is',
       !!aria && aria.label.length > 2, JSON.stringify(aria));
    ok('…and its step changes are spoken rather than silently swapped',
       !!aria && aria.live.length > 0, JSON.stringify(aria));

    await page.evaluate(() => { try { _gtEnd(); } catch (e) {} });
    ok('driving the guides from the keyboard raises no page errors',
       errs.length === 0, errs.slice(0, 3).join(' | '));
  } finally {
    await browser.close();
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  }
  console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILED') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})();
