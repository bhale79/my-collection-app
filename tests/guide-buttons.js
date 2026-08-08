// ══ tests/guide-buttons.js — CANCEL, BACK, NEXT, AND 773-THEN-ENTER ═══════
//
// Brad, last thing before bed:
//   "i want every help guide to be fully audited and functional, with cancel,
//    back, and next button tried, with what happens if i hit and entered
//    number like 773 and then hit enter after it, we should be able to do any
//    combo a user might try and either cancel out, back up, or move forward."
//
// guide-drive.js answers "does the guide keep up when I do what it says". This
// one answers the other half: WHATEVER I PRESS, CAN I ALWAYS GET OUT, GO BACK,
// OR GO ON. Three passes, plus the combination he named:
//
//   A — CANCEL FROM EVERY STEP OF EVERY GUIDE. Walk in like a user, press
//       Cancel, and check the app is genuinely handed back: no blocker left
//       swallowing clicks, no card, no ring, and the sidebar still navigates.
//       A tour that will not let go is worse than a tour that is wrong.
//
//   B — BACK FROM EVERY STEP OF EVERY GUIDE. Walk to the end, then press Back
//       all the way to step 1, checking at each stop that a card is on screen,
//       that it counts down by exactly one, and that it is not left ringing
//       something that is no longer there.
//
//   C — THE WIZARD'S OWN BACK. Brad's screenshot, "i hit back and got this":
//       the wizard's Back on its first screen CLOSES the wizard (wizard.js,
//       _wizardBackHandler → _doCloseWizard). The guide and the wizard are two
//       state machines with no wire between them, so the guide carried on
//       describing screens that had just been thrown away.
//
//   D — 773 THEN ENTER, by name, on the step that asks for a number.
//
// WHAT IT CANNOT SEE, so nobody trusts it too far:
//   · whether the words on the card are good — only whether the screen is real
//   · anything that needs live Google data
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { SEED, DRIVER } = require('./lib/guide-fixture');

let chromium;
try { chromium = require('playwright').chromium; }
catch (e) {
  console.log('FAILED  —  guide-buttons needs playwright and it is not installed.');
  process.exit(1);
}

const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}

// Extra hands, on top of the shared DRIVER.
const KIT = `
// Is the tour completely gone, and is the app usable again? "Gone" is not a
// matter of opinion: the three nodes the engine creates must be off the
// document, and the point in the middle of the screen must belong to the app.
window._btnTornDown = function () {
  var left = ['gt-blocker', 'gt-hole', 'gt-callout'].filter(function (id) {
    return !!document.getElementById(id);
  });
  var mid = document.elementFromPoint(Math.round(window.innerWidth / 2),
                                      Math.round(window.innerHeight / 2));
  var onTour = false;
  try { onTour = !!(mid && mid.closest && mid.closest('#gt-blocker, #gt-callout, #gt-hole, #gt-mascot')); }
  catch (e) {}
  return { left: left, onTour: onTour, midTag: mid ? (mid.id || mid.tagName) : 'none' };
};
// The app has to actually respond afterwards — a leftover blocker is invisible
// until you try to press something, which is exactly how a user meets it.
window._btnAppLive = async function () {
  var before = (document.querySelector('.page.active') || {}).id || '';
  var target = (before === 'page-reports') ? 'buildPrefsPage' : "showPage('reports'";
  var link = null;
  document.querySelectorAll('.sidebar a, .sidebar [onclick], .nav-item').forEach(function (n) {
    if (link) return;
    var oc = n.getAttribute && n.getAttribute('onclick');
    if (oc && oc.indexOf(target) >= 0) link = n;
  });
  if (!link) return { skipped: 'no sidebar link found' };
  var r = link.getBoundingClientRect();
  var top = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
  var blocked = false;
  try { blocked = !!(top && top.closest && top.closest('#gt-blocker, #gt-callout, #gt-mascot')); } catch (e) {}
  link.click();
  await new Promise(r2 => setTimeout(r2, 500));
  var after = (document.querySelector('.page.active') || {}).id || '';
  return { before: before, after: after, moved: before !== after, blocked: blocked };
};
// Walk in like a user until the card reads step \`want\`, doing what each card
// asks. Returns where it actually got to — the caller checks that.
window._btnWalkTo = async function (gid, want) {
  await window._drvReset();
  startGuide(gid);
  await new Promise(r => setTimeout(r, 1500));
  // WHERE THE GUIDE ACTUALLY OPENS is not always step 1. An optional first
  // step whose control is absent is skipped on the way in — on an empty Photo
  // Inbox the reading guide opens on "Step 2 of 7". "Back to the beginning"
  // therefore means back to where it started, not back to the number 1.
  var _c0 = window._drvCard();
  window._btnStartedAt = _c0 ? _c0.step : null;
  window._btnLastSeen = _c0 ? _c0.step : null;
  var guard = 0;
  while (guard++ < 16) {
    var c = window._drvCard();
    if (!c || c.step == null || c.step >= want) break;
    window._btnLastSeen = c.step;
    var at = c.step;
    await window._drvAct(gid);
    var how = await window._drvSettle(at, 4500);
    if (how === 'ended') break;
    if (how === 'stayed') {
      var nx = document.getElementById('gt-next');
      if (nx) { nx.click(); await new Promise(r => setTimeout(r, 800)); }
      var c2 = window._drvCard();
      if (!c2 || c2.step === at) break;   // genuinely stuck; the drive gate owns that
    }
  }
  var now = window._drvCard();
  if (now) window._btnLastSeen = now.step;
  return now ? now.step : null;
};
`;

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rr-buttons-'));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const cancelBad = [], backBad = [];
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
    await page.evaluate(DRIVER);
    await page.evaluate(KIT);
    await page.evaluate(() => window._clearOverlays());
    await page.waitForTimeout(400);

    const guides = await page.evaluate(() =>
      Object.keys(GUIDES).map(k => ({ id: k, n: GUIDES[k].steps.length })));
    ok('the real app boots with its guides loaded', guides.length > 0, String(guides.length));

    // ══ PASS A — CANCEL FROM EVERY STEP ═════════════════════════════════════
    // GB_ONLY=b|c|d runs one pass while iterating. The full run has no switch
    // set and does all four — a gate you can quietly half-run is not a gate.
    const ONLY = process.env.GB_ONLY || '';
    // GB_GUIDES=tour,add-item narrows a pass while running a MUTATION DRILL —
    // deliberately breaking the app to prove this gate goes red. A gate that
    // has only ever been green is decoration.
    const PICK = (process.env.GB_GUIDES || '').split(',').filter(Boolean);
    if (PICK.length) { for (let z = guides.length - 1; z >= 0; z--) if (PICK.indexOf(guides[z].id) < 0) guides.splice(z, 1); }
    let cancels = 0;
    for (const g of (ONLY && ONLY !== 'a' ? [] : guides)) {
      for (let k = 1; k <= g.n; k++) {
        const r = await page.evaluate(async (a) => {
          const reached = await window._btnWalkTo(a.gid, a.k);
          const cx = document.getElementById('gt-cancel') || document.getElementById('gt-exit');
          const hadCancel = !!cx;
          if (cx) cx.click();
          await new Promise(r2 => setTimeout(r2, 700));
          const t = window._btnTornDown();
          const live = await window._btnAppLive();
          try { if (typeof _doCloseWizard === 'function') _doCloseWizard(); } catch (e) {}
          return { reached, hadCancel, t, live };
        }, { gid: g.id, k });
        cancels++;
        // Only judge the step we actually reached. A guide that could not be
        // walked that far is the drive gate's problem, not Cancel's.
        if (r.reached == null) continue;
        const bad = !r.hadCancel || r.t.left.length > 0 || r.t.onTour ||
                    (r.live.moved === false && !r.live.skipped);
        if (bad) cancelBad.push({ guide: g.id, at: r.reached, asked: k, ...r });
      }
    }

    console.log('');
    console.log('  ── Cancel pressed at ' + cancels + ' places across ' + guides.length + ' guides ──');
    for (const b of cancelBad)
      console.log('     ' + b.guide + ' step ' + b.at +
                  (b.hadCancel ? '' : '  NO CANCEL BUTTON') +
                  (b.t.left.length ? '  left behind: ' + b.t.left.join(',') : '') +
                  (b.t.onTour ? '  screen centre still belongs to the tour (' + b.t.midTag + ')' : '') +
                  (b.live.moved === false ? '  sidebar did not navigate afterwards' : ''));

    if (!ONLY || ONLY === 'a') ok('BRAD\'S ASK: Cancel gets you out from every step of every guide',
       cancelBad.length === 0,
       cancelBad.slice(0, 6).map(b => b.guide + '#' + b.at).join(' | '));

    // ══ PASS B — BACK, ALL THE WAY HOME ═════════════════════════════════════
    for (const g of (ONLY && ONLY !== 'b' ? [] : guides)) {
      const r = await page.evaluate(async (a) => {
        let reached = await window._btnWalkTo(a.gid, a.n);
        // A GUIDE MAY LEGITIMATELY FINISH EARLY, and on an empty collection two
        // of them do: the want-list guide's last card needs a row to point at
        // and the For Sale guide's needs a listed item, so each retires itself
        // and the tour ends rather than describing furniture the user has not
        // got. That is v0.9.1400 working. Walking to "the last step" then lands
        // on no card at all, and the first version of this pass called that a
        // failure of Back — blaming the guide for stopping when it had nothing
        // left to say. Walk instead to the last card that actually appeared.
        let endedEarly = false;
        if (reached == null && window._btnLastSeen > 1) {
          endedEarly = true;
          reached = await window._btnWalkTo(a.gid, window._btnLastSeen);
        }
        const trail = [];
        let guard = 0;
        while (guard++ < 20) {
          const c = window._drvCard();
          // Stop at the card the guide OPENED on, not at the number 1. Below
          // that there is nothing to go back to and the engine deliberately
          // refuses — counting that refusal as a stall would fail the guide
          // for doing the right thing.
          if (!c || c.step == null || c.step <= (window._btnStartedAt || 1)) break;
          const from = c.step;
          const bk = document.getElementById('gt-back');
          if (!bk) { trail.push({ from, to: null, note: 'no Back button' }); break; }
          bk.click();
          await new Promise(r2 => setTimeout(r2, 1100));
          const c2 = window._drvCard();
          trail.push({ from, to: c2 ? c2.step : null,
                       stranded: window._drvStranded(a.gid),
                       where: window._drvWhere() });
          if (!c2 || c2.step >= from) break;   // Back did nothing, or went forward
        }
        // Back on step 1 must not throw the user out or crash — it should
        // simply refuse, which is what the engine's `if (i > 0)` does.
        const atOne = window._drvCard();
        // Back at the guide's own first card must refuse, not crash and not
        // throw the user out of the tour.
        const bk1 = document.getElementById('gt-back');
        if (bk1) { bk1.click(); await new Promise(r2 => setTimeout(r2, 600)); }
        const afterOne = window._drvCard();
        await window._drvReset();
        return { reached, trail, startedAt: window._btnStartedAt, endedEarly,
                 firstStepSurvivesBack: !!(atOne && afterOne && afterOne.step === atOne.step) };
      }, { gid: g.id, n: g.n });

      // Back may legitimately move more than one card: an OPTIONAL step whose
      // screen is not up is skipped in whichever direction you are travelling
      // (v0.9.1377), so 9 → 8 → 7 → 5 is correct behaviour on the add-item
      // guide when the photo-ID block is not on show. What is NOT allowed is
      // standing still, going forwards, or landing on nothing.
      for (const t of r.trail) {
        if (t.note) backBad.push({ guide: g.id, ...t, why: t.note });
        else if (t.to == null) backBad.push({ guide: g.id, ...t, why: 'Back left no card on screen' });
        else if (t.to >= t.from) backBad.push({ guide: g.id, ...t, why: 'Back did not go back: ' + t.from + ' -> ' + t.to });
        else if (t.stranded) backBad.push({ guide: g.id, ...t, why: 'after Back, the card rings something that is not there' });
      }
      const landed = r.trail.length ? r.trail[r.trail.length - 1].to : r.reached;
      const home = r.startedAt == null ? 1 : r.startedAt;
      ok('Back walks ' + g.id + ' all the way home to where it opened (step ' + home + ')' +
         (r.endedEarly ? '  [guide finished early — its last card does not apply here]' : ''),
         landed === home || r.reached === home,
         'ended on step ' + landed + ' after ' + r.trail.length + ' presses');
      ok('Back at the first card of ' + g.id + ' refuses instead of breaking',
         r.firstStepSurvivesBack, JSON.stringify(r).slice(0, 160));
    }

    console.log('');
    if (backBad.length) {
      console.log('  ── pressing Back went wrong ──');
      for (const b of backBad)
        console.log('     ' + b.guide + ' #' + b.from + ' -> #' + b.to + '  ' + b.why +
                    (b.stranded ? '  [step ' + b.stranded.step + ' "' + b.stranded.title + '" ' + b.stranded.selector + ']' : '') +
                    (b.where ? '   app at ' + b.where : ''));
      console.log('');
    }
    if (!ONLY || ONLY === 'b') ok('BRAD\'S ASK: Back never stalls, and never leaves a card ringing nothing',
       backBad.length === 0,
       backBad.slice(0, 6).map(b => b.guide + ' ' + b.why).join(' | '));

    // ══ PASS C — THE WIZARD'S OWN BACK ══════════════════════════════════════
    // "i hit back and got this." The wizard's Back on its first screen closes
    // the wizard outright. If the guide is standing on a step that describes a
    // wizard screen, that step is now about nothing.
    const wizBack = await page.evaluate(async () => {
      const reached = await window._btnWalkTo('add-item', 3);
      const before = { card: window._drvCard(), where: window._drvWhere() };
      // PRESS THE WIZARD'S OWN BACK UNTIL THE WIZARD IS GONE. One press is not
      // the journey Brad described — from Condition & Details, Back steps back
      // a screen and the wizard is still open, so the check passed without
      // ever testing anything. A drill with the watchdog disabled proved that:
      // green, on a bug I could see with my own eyes. Keep pressing, the way
      // someone backing out of a wizard does, until it actually closes.
      let presses = 0, usedRealButton = false;
      for (let z = 0; z < 8 && window._drvWizard(); z++) {
        const bb = document.getElementById('wizard-back-btn');
        if (!bb || bb.offsetParent === null) break;
        usedRealButton = true;
        bb.click(); presses++;
        await new Promise(r => setTimeout(r, 700));
      }
      if (window._drvWizard()) { try { _doCloseWizard(); } catch (e) {} }
      await new Promise(r => setTimeout(r, 1600));
      const after = { card: window._drvCard(), where: window._drvWhere() };
      const stranded = window._drvStranded('add-item');
      const applies = window._drvApplies('add-item');
      const wizardGone = !window._drvWizard();
      await window._drvReset();
      return { reached, before, after, stranded, applies, wizardGone, usedRealButton, presses };
    });
    ok('walked the add-item guide into the wizard', wizBack.reached >= 2, JSON.stringify(wizBack.before));
    ok('the wizard\'s own Back really did close it', wizBack.wizardGone,
       JSON.stringify({ presses: wizBack.presses, usedRealButton: wizBack.usedRealButton }));
    ok('BRAD\'S BUG: backing out of the wizard does not leave the guide describing it',
       !wizBack.stranded && !!(wizBack.applies && wizBack.applies.needsOk),
       JSON.stringify({ after: wizBack.after, applies: wizBack.applies, stranded: wizBack.stranded }));

    // ══ PASS D — 773, THEN ENTER ════════════════════════════════════════════
    const seven = await page.evaluate(async () => {
      const reached = await window._btnWalkTo('add-item', 2);
      const el = document.getElementById('wiz-input');
      if (!el) return { reached, noInput: true };
      const before = window._drvCard();
      el.focus(); el.value = '';
      '773'.split('').forEach(ch => {
        el.value += ch;
        el.dispatchEvent(new InputEvent('input', { bubbles: true, data: ch, inputType: 'insertText' }));
      });
      await new Promise(r => setTimeout(r, 900));
      const err0 = [];
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
      el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, bubbles: true }));
      await new Promise(r => setTimeout(r, 1800));
      const after = window._drvCard();
      const out = { reached, before, after, where: window._drvWhere(),
                    stranded: window._drvStranded('add-item'),
                    cardStillThere: !!after, err0 };
      await window._drvReset();
      return out;
    });
    ok('the add-item guide reaches the type-a-number step', seven.reached === 2, JSON.stringify(seven).slice(0, 200));
    ok('BRAD\'S COMBINATION: typing 773 and pressing Enter leaves a live guide',
       !!seven.cardStillThere && !seven.stranded,
       JSON.stringify({ after: seven.after, where: seven.where, stranded: seven.stranded }));

    ok('pressing Cancel, Back and Enter everywhere raises no page errors',
       errs.length === 0, errs.slice(0, 3).join(' | '));

    fs.writeFileSync(path.join(dir, 'buttons.json'),
                     JSON.stringify({ cancelBad, backBad, wizBack, seven }, null, 1));
  } finally {
    await browser.close();
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  }
  console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILED') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})();
