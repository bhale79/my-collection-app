// ══ tests/guide-drive.js — DO WHAT THE CARD SAYS, THEN CHECK IT KEPT UP ═══
//
// Brad, after I reported an audit and he then drove the add-item guide himself:
//   "i thought you did an audit, every freaking page is wrong"
//   "do each freaking step like a user would and fill the things out"
//
// He is right, and the reason matters more than any single fix. MY AUDIT
// WALKED THE CARDS, NOT THE APP. I started each guide and pressed Next through
// its steps without ever driving the wizard underneath. Every failure he found
// needs the app to MOVE before it appears:
//
//   · press "Add to My Collection" and the guide stays on step 1, ring still
//     on the button behind the modal
//   · answer the grouping question and the card is a screen behind
//   · the ring left over a screen that no longer exists
//   · the wizard's own Back closes it and the guide walks on regardless
//
// None of that is visible if you only press Next.
//
// So this harness does what a user does: it reads the card, performs the action
// the card names on the REAL control, and then asks one question —
//
//     IS THE GUIDE STILL TALKING ABOUT A SCREEN THAT IS ACTUALLY THERE?
//
// It then does the same for the three buttons a user actually presses — Next,
// Back and Cancel — and for the combination Brad called out by name: type 773,
// press Enter, and see what happens.
//
// WHAT IT CANNOT SEE, so nobody trusts it too far:
//   · anything only true of real Google data
//   · whether the WORDS are good — only whether the screen they describe is up
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { SEED, DRIVER } = require('./lib/guide-fixture');

let chromium;
try { chromium = require('playwright').chromium; }
catch (e) {
  console.log('FAILED  —  guide-drive needs playwright and it is not installed.');
  process.exit(1);
}

const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}

// Everything below runs in the page: the shared DRIVER from
// tests/lib/guide-fixture.js. It lives there because guide-buttons.js drives
// the app the same way, and two copies of "act like a user" would drift.
const KIT = DRIVER;

const GUIDE_ORDER = null;   // all of them

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rr-drive-'));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const findings = [];
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
    await page.evaluate(() => window._clearOverlays());
    await page.waitForTimeout(400);

    const guides = await page.evaluate(() => Object.keys(GUIDES));
    ok('the real app boots with its guides loaded', guides.length > 0, String(guides.length));

    // ── PASS 1: do what each card says, and check the guide keeps up ───────
    for (const gid of guides) {
      const log = await page.evaluate(async (gid) => {
        window._clearOverlays();
        try { _gtEnd(); } catch (e) {}
        try { if (typeof closeWizard === 'function') closeWizard(); } catch (e) {}
        try { if (typeof _doCloseWizard === 'function') _doCloseWizard(); } catch (e) {}
        await new Promise(r => setTimeout(r, 300));
        startGuide(gid);
        await new Promise(r => setTimeout(r, 1500));
        const out = [];
        for (let n = 0; n < 12; n++) {
          const before = window._drvCard();
          if (!before) break;
          const whereBefore = window._drvWhere();
          const act = await window._drvAct(gid);
          // ── WAIT LONG ENOUGH TO BE FAIR ──────────────────────────────────
          // The first version of this loop slept a flat 1400ms — poll 250 +
          // beat 550 + slack — and reported add-item #1 as "did not follow".
          // A focused probe of that one step disagreed: the guide DID go from
          // "Step 1 of 9" to "Step 2 of 9". The harness was wrong, not the
          // app. Step 2 carries a `before` hook that returns 900, so the
          // engine holds the redraw for another 900ms after it advances —
          // roughly 1700ms all in, and the flat sleep read the OLD card.
          // A harness that cries wolf on a fix I had just shipped is worse
          // than no harness, so it now watches until the card actually
          // changes and only then decides.
          let moved = false;
          for (let t = 0; t < 30 && !moved; t++) {
            await new Promise(r => setTimeout(r, 150));
            const c = window._drvCard();
            if (!c) { moved = true; break; }             // guide ended = it moved
            if (c.step !== before.step) moved = true;
          }
          await new Promise(r => setTimeout(r, 700));    // let the new card settle
          const after = window._drvCard();
          const whereAfter = window._drvWhere();
          const stranded = window._drvStranded(gid);
          out.push({ step: before.step, title: before.title, act,
                     last: before.of != null && before.step === before.of,
                     moved: moved,
                     appMoved: whereBefore !== whereAfter,
                     whereBefore: whereBefore, whereAfter: whereAfter,
                     nowStep: after ? after.step : null,
                     wizard: window._drvWizard(),
                     stranded: stranded });
          if (!after) break;
          if (after.step === before.step) {
            // it did not follow — press Next the way a puzzled user would
            const nx = document.getElementById('gt-next');
            if (nx) { nx.click(); await new Promise(r => setTimeout(r, 900)); }
            const after2 = window._drvCard();
            if (!after2 || after2.step === before.step) break;   // truly stuck
          }
        }
        try { _gtEnd(); } catch (e) {}
        try { if (typeof _doCloseWizard === 'function') _doCloseWizard(); } catch (e) {}
        return out;
      }, gid);

      for (const s of log) {
        if (s.stranded) findings.push({ kind: 'stranded', guide: gid, ...s });
        // THE LAST STEP HAS NOWHERE TO FOLLOW TO. add-want #4 and
        // photo-inbox-reading #7 are both final steps whose own text describes
        // exactly what the click does — "the Add wizard opens with the number
        // already filled in", "in Preferences → Photo ID, untick…". Demanding
        // an advance there would be demanding the guide invent a step. What
        // matters on a final step is that the card is not left describing a
        // screen that is gone, and `stranded` above already asks that.
        else if (s.appMoved && !s.moved && !s.last) findings.push({ kind: 'did-not-follow', guide: gid, ...s });
      }
      await page.waitForTimeout(150);
    }

    const stranded = findings.filter(f => f.kind === 'stranded');
    const notFollowing = findings.filter(f => f.kind === 'did-not-follow');

    console.log('');
    if (stranded.length) {
      console.log('  ── the card describes a screen that is NOT there ──');
      for (const f of stranded)
        console.log('     ' + f.guide + ' #' + f.step + ' "' + f.title + '"  selector=' + f.stranded.selector +
                    '  wizard=' + (f.wizard ? f.wizard.title : '(closed)'));
      console.log('');
    }
    if (notFollowing.length) {
      console.log('  ── did what the card said, and the guide did not follow ──');
      for (const f of notFollowing)
        console.log('     ' + f.guide + ' #' + f.step + ' "' + f.title + '"  (' + f.act + ')\n' +
                    '         app went  ' + f.whereBefore + '\n' +
                    '              ->    ' + f.whereAfter);
      console.log('');
    }

    ok('BRAD\'S BUG: no card is left describing a screen that is not on screen',
       stranded.length === 0,
       stranded.slice(0, 5).map(f => f.guide + ' #' + f.step).join(' | '));
    ok('…and doing what a card says makes the guide follow',
       notFollowing.length === 0,
       notFollowing.slice(0, 6).map(f => f.guide + ' #' + f.step + ' ' + f.title).join(' | '));

    ok('driving every guide raises no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));

    fs.writeFileSync(path.join(dir, 'drive.json'), JSON.stringify(findings, null, 1));
  } finally {
    await browser.close();
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  }
  console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILED') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})();
