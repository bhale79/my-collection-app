// ══ tests/guide-follow.js — v0.9.1374 ═════════════════════════════════════
//
// Brad: "still not keeping up with the clicks on the help add item."
//
// A guide step that WAITS for the user used to open its gate and then sit
// there, showing the same card until Next was pressed. From the user's side
// that is indistinguishable from being stuck — which is exactly what he
// reported, twice, about two different underlying causes.
//
// This gate drives the REAL _guidedTour in real Chromium and asserts what a
// person would SEE: do the thing the card asks for, and the guide moves on by
// itself. It also asserts the boundaries, because an auto-advance that fires
// when it should not is worse than none: a step already satisfied on arrival
// must NOT skip, and a pending advance must never survive the user pressing
// Next, going Back, or closing the tour.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const APP = path.join(__dirname, '..', 'app');
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'rrgf-'));

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}

const html = `<!doctype html><html><head>
<link rel="stylesheet" href="file://${APP}/app.css">
<link rel="stylesheet" href="file://${APP}/tutorial.css">
</head><body>
<div id="target-a" style="position:absolute;left:60px;top:300px;width:200px;height:40px">A</div>
<div id="target-b" style="position:absolute;left:60px;top:400px;width:200px;height:40px">B</div>
<script>
// The app globals the tour touches at the boundary.
window.BackStack = { push: function(){}, pop: function(){} };
window.showToast = function(){};
window._rrGateOpen = false;      // the thing "the user does"
window._rendered = [];
</script>
<script src="file://${APP}/tutorial.js"></script>
<script>
window._startTest = function () {
  window._rendered = [];
  _guidedTour([
    { selector: '#target-a', title: 'Step one', body: 'Do the thing.',
      awaitLabel: 'Next \\u2192', awaitMsg: 'Please do the thing first.',
      awaitUser: function () { window._rendered.push('poll'); return !!window._rrGateOpen; } },
    { selector: '#target-b', title: 'Step two', body: 'Second card.' },
    { title: 'Step three', body: 'Third card.' }
  ]);
};
window._startAlreadyOpen = function () {
  _guidedTour([
    { selector: '#target-a', title: 'Already done', body: 'This one is satisfied on arrival.',
      awaitUser: function () { return true; } },
    { selector: '#target-b', title: 'Step two', body: 'Second card.' }
  ]);
};
window._cardTitle = function () {
  var t = document.querySelector('#gt-callout h3, #gt-callout .gt-title, #gt-callout strong');
  if (t) return (t.textContent || '').trim();
  var c = document.getElementById('gt-callout');
  return c ? (c.innerText || '').split('\\n')[0].trim() : '';
};
</script>
</body></html>`;

(async () => {
  const file = path.join(DIR, 'g.html');
  fs.writeFileSync(file, html);
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto('file://' + file);
    await page.waitForTimeout(200);

    // ── 1. the tour starts and shows step one ──
    await page.evaluate(() => window._startTest());
    await page.waitForTimeout(400);
    let r = await page.evaluate(() => ({ card: window._cardTitle(), next: (document.getElementById('gt-next') || {}).textContent }));
    ok('the guide opens on the waiting step', /Step one/i.test(r.card), JSON.stringify(r));
    ok('its Next says it is waiting', !!r.next, JSON.stringify(r));

    // ── 2. it does NOT advance on its own while the user has not acted ──
    await page.waitForTimeout(1200);
    r = await page.evaluate(() => ({ card: window._cardTitle() }));
    ok('it waits — no user action, no advance', /Step one/i.test(r.card), JSON.stringify(r));

    // ── 3. BRAD'S ASK: the user does the thing, the guide FOLLOWS ──
    await page.evaluate(() => { window._rrGateOpen = true; });
    await page.waitForTimeout(1400);      // 250ms poll + 550ms beat + slack
    r = await page.evaluate(() => ({ card: window._cardTitle() }));
    ok('BRAD\'S ASK: doing the thing advances the guide with no Next press',
       /Step two/i.test(r.card), JSON.stringify(r));

    // ── 4. it advances ONCE, not through the whole tour ──
    await page.waitForTimeout(1200);
    r = await page.evaluate(() => ({ card: window._cardTitle() }));
    ok('…and it advances ONE step, not straight to the end',
       /Step two/i.test(r.card), JSON.stringify(r));

    // ── 5. a step already satisfied on arrival must NOT skip itself ──
    await page.evaluate(() => { try { _gtEnd(); } catch (e) {} });
    await page.waitForTimeout(200);
    await page.evaluate(() => window._startAlreadyOpen());
    await page.waitForTimeout(1500);
    r = await page.evaluate(() => ({ card: window._cardTitle() }));
    ok('a step whose condition is already true stays put (no runaway tour)',
       /Already done/i.test(r.card), JSON.stringify(r));

    // ── 6. a pending advance does not survive the user pressing Next ──
    await page.evaluate(() => { try { _gtEnd(); } catch (e) {} });
    await page.waitForTimeout(150);
    await page.evaluate(() => { window._rrGateOpen = false; window._startTest(); });
    await page.waitForTimeout(300);
    r = await page.evaluate(async () => {
      window._rrGateOpen = true;                 // gate opens…
      await new Promise(r2 => setTimeout(r2, 300));
      document.getElementById('gt-next').click();  // …user presses Next during the beat
      await new Promise(r2 => setTimeout(r2, 1200));
      return { card: window._cardTitle() };
    });
    // MEASURED, not assumed: this goes red only when BOTH protections are
    // removed — render()'s clearTimeout AND the stale-step check inside the
    // timer. Removing either one alone is an EQUIVALENT MUTANT; the other
    // still holds and the drill stays green. That redundancy is deliberate
    // for a timer that would otherwise fire into a screen it was not written
    // for, and this note exists so nobody later reads a green drill as proof
    // that one guard alone is doing the work.
    ok('pressing Next during the beat does not double-advance',
       /Step two/i.test(r.card), JSON.stringify(r));

    // ── 7. closing the tour during the beat must not throw or reopen it ──
    await page.evaluate(() => { try { _gtEnd(); } catch (e) {} });
    await page.waitForTimeout(150);
    await page.evaluate(() => { window._rrGateOpen = false; window._startTest(); });
    await page.waitForTimeout(300);
    r = await page.evaluate(async () => {
      window._rrGateOpen = true;
      await new Promise(r2 => setTimeout(r2, 300));
      _gtEnd();
      await new Promise(r2 => setTimeout(r2, 1200));
      return { gone: !document.getElementById('gt-next') };
    });
    ok('closing the tour during the beat leaves it closed', r.gone, JSON.stringify(r));

    // ── 8. v0.9.1377: an OPTIONAL step with no target skips itself ──
    // Brad's walk: adding a cattle car, the guide explained Engine Only /
    // Engine + Tender. The step's target was correctly absent; the card showed
    // anyway.
    await page.evaluate(() => { try { _gtEnd(); } catch (e) {} });
    await page.waitForTimeout(150);
    r = await page.evaluate(async () => {
      _guidedTour([
        { selector: '#target-a', title: 'First card', body: 'one' },
        { selector: '#does-not-exist', optional: true, title: 'Engines and tenders', body: 'skip me' },
        { selector: '#target-b', title: 'Third card', body: 'three' }
      ]);
      await new Promise(r2 => setTimeout(r2, 400));
      const first = window._cardTitle();
      document.getElementById('gt-next').click();
      await new Promise(r2 => setTimeout(r2, 500));
      return { first, landed: window._cardTitle() };
    });
    ok('an optional step with nothing to point at is SKIPPED, not narrated',
       /Third card/i.test(r.landed), JSON.stringify(r));

    // …and skipping respects the direction of travel, or Back would bounce.
    r = await page.evaluate(async () => {
      document.getElementById('gt-back').click();
      await new Promise(r2 => setTimeout(r2, 600));
      return { landed: window._cardTitle() };
    });
    ok('…and Back skips it the other way instead of bouncing off it',
       /First card/i.test(r.landed), JSON.stringify(r));

    // A REQUIRED step that misses must still show — that is the v1366 net.
    await page.evaluate(() => { try { _gtEnd(); } catch (e) {} });
    await page.waitForTimeout(150);
    r = await page.evaluate(async () => {
      window._gtMisses = [];
      _guidedTour([
        { selector: '#does-not-exist', title: 'Broken required step', body: 'must still show' },
        { selector: '#target-b', title: 'Second', body: 'two' }
      ]);
      await new Promise(r2 => setTimeout(r2, 500));
      return { landed: window._cardTitle(), misses: (window._gtMisses || []).length };
    });
    ok('a REQUIRED step that misses still shows, so real breakage stays visible',
       /Broken required step/i.test(r.landed), JSON.stringify(r));
    ok('…and the miss is still recorded for the audit', r.misses >= 1, JSON.stringify(r));

    // ── 9. v0.9.1378: a WAITING step is never skipped, even if optional ──
    // Re-walking v0.9.1377 live, one Next press jumped from step 3 to step 8:
    // four optional steps in a row had no target yet, and the skip cascaded
    // straight past the one whose job was to WAIT for that very screen.
    await page.evaluate(() => { try { _gtEnd(); } catch (e) {} });
    await page.waitForTimeout(150);
    r = await page.evaluate(async () => {
      window._rrGateOpen = false;
      _guidedTour([
        { selector: '#target-a', title: 'First card', body: 'one' },
        { selector: '#does-not-exist', optional: true, title: 'Waits for a screen',
          body: 'I wait here', awaitUser: function () { return !!window._rrGateOpen; } },
        { selector: '#target-b', title: 'Third card', body: 'three' }
      ]);
      await new Promise(r2 => setTimeout(r2, 400));
      document.getElementById('gt-next').click();
      await new Promise(r2 => setTimeout(r2, 600));
      return { landed: window._cardTitle() };
    });
    ok('an optional step that WAITS is not skipped when its screen is absent',
       /Waits for a screen/i.test(r.landed), JSON.stringify(r));

    ok('no page errors anywhere in the run', errs.length === 0, errs.join(' | '));
  } finally {
    await browser.close();
    try { fs.rmSync(DIR, { recursive: true, force: true }); } catch (e) {}
  }
  console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILED') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})();
