// ══ tests/help-hub.js — THE HELP CENTRE ITSELF, NOT THE GUIDES INSIDE IT ══
//
// Brad: "do it for all the help functions."
//
// Every gate written so far tests the eleven guided walkthroughs. Nothing has
// ever tested the thing you press to REACH them. The Help Centre is a modal
// built from a string of HTML with inline onclick attributes, and four of its
// rows are not guides at all:
//
//   · Show the welcome card again      -> showWelcomeCard(true)
//   · How to undo a mistake            -> _uiShowVersionHistoryHelp()
//   · Reset tips                       -> resetContextualHints()
//   · Send feedback                    -> mailto:ADMIN_EMAIL
//
// Each of those is wrapped in `if (typeof X === 'function')`. That guard is
// sensible and it is also a trapdoor: if the function is ever renamed, the row
// still looks alive, still closes the Help Centre when pressed, and does
// NOTHING. A dead button that behaves like a live one is the exact shape of
// every help bug Brad has reported — "Add Want Item", the inert stat cards,
// the unreachable Engine + Tender. So each row is pressed here and required to
// leave a visible trace.
//
// The mailto row has the same problem in a different suit: with ADMIN_EMAIL
// unset the address builds as "mailto:?subject=…", which opens an empty email
// and looks like the app losing your feedback.
//
// WHAT IT CANNOT SEE, so nobody trusts it too far:
//   · whether the welcome card's WORDS are right — only that it appears
//   · whether a real mail client is installed
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { SEED } = require('./lib/guide-fixture');

let chromium;
try { chromium = require('playwright').chromium; }
catch (e) {
  console.log('FAILED  —  help-hub needs playwright and it is not installed.');
  process.exit(1);
}

const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}

const KIT = `
window._hubClear = function () {
  for (var i = 0; i < 6; i++) {
    var c = document.querySelectorAll('[id^="rr-"][id$="-card"]');
    if (!c.length) break;
    for (var k = 0; k < c.length; k++) {
      var g = c[k].querySelector('[id$="-go"]');
      if (g) { try { g.click(); } catch (e) {} }
      if (c[k].parentNode) c[k].parentNode.removeChild(c[k]);
    }
  }
  var h = document.getElementById('help-hub-modal'); if (h) h.remove();
  try { _gtEnd(); } catch (e) {}
};
// Every row a user can press in the Help Centre, in order.
window._hubRows = function () {
  var m = document.getElementById('help-hub-modal');
  if (!m) return null;
  var out = [];
  m.querySelectorAll('button').forEach(function (b) {
    // The first line of a row is its ICON, on its own line, because the emoji
    // lives in a separate span. Treating that as the label reported every row
    // as blank — a harness fault, and one worth naming here so it does not get
    // re-introduced next time someone reads this file.
    var lines = (b.innerText || '').split('\\n').map(function (x) { return x.trim(); })
                  .filter(function (x) { return x.length; });
    var i0 = (lines.length > 1 && lines[0].length <= 3) ? 1 : 0;
    out.push({ icon: i0 ? lines[0] : '',
               label: lines[i0] || '',
               desc: lines[i0 + 1] || '',
               onclick: b.getAttribute('onclick') || '' });
  });
  return out;
};
window._hubPress = async function (label) {
  var m = document.getElementById('help-hub-modal');
  if (!m) return 'no-hub';
  var hit = null;
  m.querySelectorAll('button').forEach(function (b) {
    if (hit) return;
    if ((b.innerText || '').indexOf(label) >= 0) hit = b;
  });
  if (!hit) return 'no-row';
  // SCROLL TO IT FIRST, like a person would. The Help Centre's list is taller
  // than its own 74vh box, so the four non-guide rows at the bottom start out
  // below the fold of that box. Measuring them where they are NOT is how this
  // harness first reported three perfectly good buttons as unpressable.
  try { hit.scrollIntoView({ block: 'center' }); } catch (e) {}
  await new Promise(res => setTimeout(res, 350));
  // Press the POINT, not the node — a row covered by something else is a row
  // the user cannot press, and node.click() sails straight through any cover.
  var r = hit.getBoundingClientRect();
  var cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
  var top = document.elementFromPoint(cx, cy);
  var covered = !(top === hit || hit.contains(top));
  if (top) top.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: cx, clientY: cy }));
  await new Promise(res => setTimeout(res, 900));
  return { covered: covered, coveredBy: covered && top ? (top.id || top.tagName) : '' };
};
// What is on screen that was not there before? The cheapest honest answer to
// "did pressing that do anything at all".
//
// THE HELP CENTRE ITSELF IS EXCLUDED, and that is the whole point. Every one of
// these rows closes the Help Centre on its way out, so a snapshot that counted
// the modal reported "something changed" even when the row's function had been
// renamed out of existence and nothing whatever happened. A mutation drill
// caught it: the row went dead and the assertion stayed green. What has to
// change is something OTHER than the modal going away.
window._hubSnapshot = function () {
  var ids = [];
  document.querySelectorAll('body > *').forEach(function (n) {
    if (n.id === 'help-hub-modal') return;
    if (n.offsetParent !== null || getComputedStyle(n).position === 'fixed') ids.push(n.id || n.className || n.tagName);
  });
  return ids.join('|');
};
`;

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rr-hub-'));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    const page = await browser.newPage({ viewport: { width: 1844, height: 914 } });
    const errs = [];
    page.on('pageerror', e => errs.push(e.message.slice(0, 140)));
    for (const u of ['**://accounts.google.com/**', '**://apis.google.com/**',
                     '**://*.googleapis.com/**', '**://cdnjs.cloudflare.com/**',
                     '**://*.google.com/**'])
      await page.route(u, r => r.abort());

    await page.goto('file://' + APP + '/index.html');
    await page.waitForTimeout(2200);
    await page.evaluate(SEED);
    await page.evaluate(KIT);
    await page.evaluate(() => window._hubClear());
    await page.waitForTimeout(400);

    // ── 1. THE REAL DOOR ────────────────────────────────────────────────────
    // Open it the way a user does — by pressing the conductor widget in the
    // sidebar — not by calling openHelpHub() directly. A help centre you can
    // only reach from the console is not a help centre.
    const opened = await page.evaluate(async () => {
      const w = document.getElementById('tut-help-widget');
      if (!w) return { noWidget: true };
      const r = w.getBoundingClientRect();
      const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
      const top = document.elementFromPoint(cx, cy);
      const reachable = !!(top && (top === w || w.contains(top)));
      if (top) top.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: cx, clientY: cy }));
      await new Promise(res => setTimeout(res, 800));
      return { reachable, onScreen: r.width > 0 && r.height > 0,
               hub: !!document.getElementById('help-hub-modal') };
    });
    ok('the Need Help? widget is on screen', !opened.noWidget && opened.onScreen, JSON.stringify(opened));
    ok('…and a real click on it lands, rather than hitting something on top',
       opened.reachable, JSON.stringify(opened));
    ok('BRAD\'S ASK: pressing it opens the Help Centre', opened.hub, JSON.stringify(opened));

    // ── 2. EVERY GUIDE HAS A ROW, AND EVERY ROW A GUIDE ─────────────────────
    // v0.9.1357 deleted a second, hardcoded list of guides precisely because a
    // list that can disagree with GUIDES is the bug. This keeps it honest.
    const rows = await page.evaluate(() => ({
      rows: window._hubRows(),
      guides: Object.keys(GUIDES).map(g => ({ id: g, label: GUIDES[g].label, desc: GUIDES[g].desc }))
    }));
    const guideRows = rows.rows.filter(r => /startGuide\('([^']+)'\)/.test(r.onclick));
    const named = guideRows.map(r => r.onclick.match(/startGuide\('([^']+)'\)/)[1]);
    ok('the Help Centre lists every guide exactly once',
       named.length === rows.guides.length && new Set(named).size === named.length,
       'listed ' + named.length + ' of ' + rows.guides.length + ': ' + named.join(','));
    ok('…and every row it lists is a guide that exists',
       named.every(n => rows.guides.some(g => g.id === n)),
       named.filter(n => !rows.guides.some(g => g.id === n)).join(','));
    ok('…and no row is left with a blank label or blank description',
       guideRows.every(r => r.label.length > 2 && r.desc.length > 2),
       JSON.stringify(guideRows.filter(r => r.label.length <= 2 || r.desc.length <= 2)
         .map(r => ({ label: r.label, desc: r.desc }))));
    // The row's words and the guide's own words are two copies of one thing.
    ok('…and each row says what its guide says it is called',
       guideRows.every(r => {
         const id = r.onclick.match(/startGuide\('([^']+)'\)/)[1];
         const g = rows.guides.find(x => x.id === id);
         return g && r.label === g.label && r.desc === g.desc;
       }),
       JSON.stringify(guideRows.slice(0, 3).map(r => r.label)));

    // ── 3. THE FEEDBACK ADDRESS IS A REAL ADDRESS ───────────────────────────
    const mail = rows.rows.find(r => r.onclick.indexOf('mailto:') >= 0);
    const addr = mail ? (mail.onclick.match(/mailto:([^?'"]*)/) || [])[1] : null;
    ok('the Send feedback row builds a mailto with a real recipient',
       !!addr && addr.indexOf('@') > 0, 'address was ' + JSON.stringify(addr));

    // ── 4. THE FOUR NON-GUIDE ROWS ACTUALLY DO SOMETHING ────────────────────
    // The trapdoor: each is guarded by `if (typeof X === 'function')`, so a
    // rename leaves a row that looks alive, closes the Help Centre, and does
    // nothing whatever.
    const NONGUIDE = [
      { label: 'Show the welcome card again', fn: 'showWelcomeCard' },
      { label: 'How to undo a mistake',       fn: '_uiShowVersionHistoryHelp' },
      { label: 'Reset tips',                  fn: 'resetContextualHints' }
    ];
    for (const t of NONGUIDE) {
      const r = await page.evaluate(async (t) => {
        window._hubClear();
        openHelpHub();
        await new Promise(res => setTimeout(res, 500));
        const wired = (typeof window[t.fn] === 'function');
        const before = window._hubSnapshot();
        const press = await window._hubPress(t.label);
        const after = window._hubSnapshot();
        const out = { wired, press, changed: before !== after,
                      hubClosed: !document.getElementById('help-hub-modal') };
        window._hubClear();
        return out;
      }, t);
      ok('"' + t.label + '" is wired to a function that exists', r.wired, JSON.stringify(r));
      ok('…and its row is pressable, not covered', r.press && !r.press.covered, JSON.stringify(r));
      ok('…and pressing it visibly does something', r.changed, JSON.stringify(r));
    }

    // ── 5. THE HELP CENTRE CLOSES, BOTH WAYS ────────────────────────────────
    const closes = await page.evaluate(async () => {
      window._hubClear(); openHelpHub();
      await new Promise(res => setTimeout(res, 400));
      const m = document.getElementById('help-hub-modal');
      let x = null;
      m.querySelectorAll('button').forEach(b => { if (!x && (b.innerText || '').trim() === '×') x = b; });
      if (x) x.click();
      await new Promise(res => setTimeout(res, 400));
      const afterX = !document.getElementById('help-hub-modal');

      window._hubClear(); openHelpHub();
      await new Promise(res => setTimeout(res, 400));
      const m2 = document.getElementById('help-hub-modal');
      // Click the backdrop itself — the listener only closes on e.target === modal
      m2.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise(res => setTimeout(res, 400));
      const afterBackdrop = !document.getElementById('help-hub-modal');

      window._hubClear(); openHelpHub(); openHelpHub(); openHelpHub();
      await new Promise(res => setTimeout(res, 300));
      const copies = document.querySelectorAll('#help-hub-modal').length;
      window._hubClear();
      return { afterX, afterBackdrop, copies };
    });
    ok('the × closes the Help Centre', closes.afterX, JSON.stringify(closes));
    ok('…and so does clicking the dark area around it', closes.afterBackdrop, JSON.stringify(closes));
    ok('…and opening it three times leaves exactly one of it',
       closes.copies === 1, 'found ' + closes.copies);

    // ── 6. A GUIDE STARTED FROM THE HELP CENTRE LEAVES NOTHING BEHIND ───────
    // The row's onclick removes the modal and then calls startGuide. If the
    // order were ever reversed, the tour would run underneath a full-screen
    // dim overlay — visible, and completely unpressable.
    const fromHub = await page.evaluate(async () => {
      window._hubClear(); openHelpHub();
      await new Promise(res => setTimeout(res, 500));
      await window._hubPress('Add an item');
      await new Promise(res => setTimeout(res, 1600));
      const hubGone = !document.getElementById('help-hub-modal');
      const tour = !!document.getElementById('gt-callout');
      // Is the guide's own Next button the thing at its own coordinates?
      let reachable = false;
      const nx = document.getElementById('gt-next');
      if (nx) {
        const r = nx.getBoundingClientRect();
        const top = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
        reachable = !!(top && (top === nx || nx.contains(top)));
      }
      try { _gtEnd(); } catch (e) {}
      window._hubClear();
      return { hubGone, tour, reachable };
    });
    ok('starting a guide from the Help Centre closes the Help Centre', fromHub.hubGone, JSON.stringify(fromHub));
    ok('…and actually starts the guide', fromHub.tour, JSON.stringify(fromHub));
    ok('…and the guide\'s own Next button is pressable, not under a leftover overlay',
       fromHub.reachable, JSON.stringify(fromHub));

    // ── 7. TWO TOURS MUST NEVER RUN AT ONCE ─────────────────────────────────
    // The Help Centre sits above the tour (z-index 99999 against 99992), so it
    // CAN be opened mid-guide and a second guide started from it. One set of
    // tour furniture must survive, not two — two blockers would each swallow
    // the other's clicks.
    const twice = await page.evaluate(async () => {
      window._hubClear();
      startGuide('tour');
      await new Promise(res => setTimeout(res, 1400));
      openHelpHub();
      await new Promise(res => setTimeout(res, 500));
      const hubOnTop = (function () {
        const m = document.getElementById('help-hub-modal');
        if (!m) return false;
        const b = m.querySelector('button');
        if (!b) return false;
        const r = b.getBoundingClientRect();
        const top = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
        return !!(top && (top === b || b.contains(top)));
      })();
      await window._hubPress('Record a sale');
      await new Promise(res => setTimeout(res, 1800));
      const out = {
        hubOnTop,
        blockers: document.querySelectorAll('#gt-blocker').length,
        callouts: document.querySelectorAll('#gt-callout').length,
        holes: document.querySelectorAll('#gt-hole').length,
        hubGone: !document.getElementById('help-hub-modal'),
        card: (document.getElementById('gt-callout') || {}).innerText || ''
      };
      try { _gtEnd(); } catch (e) {}
      window._hubClear();
      return out;
    });
    ok('the Help Centre opens on top of a running guide, not underneath it',
       twice.hubOnTop, JSON.stringify(twice));
    ok('starting a second guide from it leaves exactly one tour running',
       twice.blockers === 1 && twice.callouts === 1 && twice.holes === 1, JSON.stringify(twice));
    ok('…and it is the SECOND guide, the one that was asked for',
       /Find the item/i.test(twice.card), JSON.stringify(twice.card).slice(0, 120));

    ok('exercising the whole Help Centre raises no page errors',
       errs.length === 0, errs.slice(0, 3).join(' | '));
  } finally {
    await browser.close();
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  }
  console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILED') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})();
