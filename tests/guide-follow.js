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
<!-- target-c sits in the far corner, away from the callout, so the shield
     probe measures the BLOCKER and not the help box sitting on top of B. -->
<div id="target-c" style="position:absolute;right:12px;top:12px;width:120px;height:30px">C</div>
<!-- A real control that starts in the bottom-right corner, so the corner test
     can force the card away from its preferred corner and then check it does
     not snap back when the corner clears. -->
<button id="corner-hog" style="position:absolute;right:20px;bottom:40px;width:100px;height:30px">hog</button>
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
  // The conductor is an <img> that hides itself on error, so without his real
  // artwork beside the fixture he collapses to 0x0 and every measurement of
  // "is he on screen" measures nothing — it passed with the side-choice
  // deliberately broken. Copy the real art so the geometry is real.
  fs.mkdirSync(path.join(DIR, 'img'), { recursive: true });
  for (const f of ['conductor-pointing.png', 'conductor-pointing-left.png'])
    fs.copyFileSync(path.join(APP, 'img', f), path.join(DIR, 'img', f));
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

    // ── 10. v0.9.1383: THE HIGHLIGHTED CONTROL MUST BE PRESSABLE ─────────
    // Brad: "you still can't hit engine + tender." The blocker is a
    // full-screen click swallower; v0.9.1363 taught it to stand aside on steps
    // that WAIT for the user and left it covering everything on every other
    // step. So a step could ring a button, name it, invite the press, and eat
    // it. My own walk had recorded the shape and called it minor polish, which
    // is why this assertion did not exist until he hit it a second time.
    //
    // elementFromPoint is the assertion that matches a finger: "visible" was
    // never the question.
    await page.evaluate(() => { try { _gtEnd(); } catch (e) {} });
    await page.waitForTimeout(150);
    r = await page.evaluate(async () => {
      window._hits = 0;
      const t = document.getElementById('target-a');
      t.onclick = function () { window._hits++; };
      // A step with NO awaitUser — the case that was broken.
      _guidedTour([{ selector: '#target-a', title: 'Press this', body: 'go on' },
                   { title: 'done', body: 'end' }]);
      await new Promise(r2 => setTimeout(r2, 500));
      const b = t.getBoundingClientRect();
      const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
      const top = document.elementFromPoint(cx, cy);
      // Aim the press at the POINT, not at the element. t.click() dispatches
      // straight to the node and sails through any cover — a drill proved that
      // version of this line passed with the hole removed.
      if (top) top.dispatchEvent(new MouseEvent('click',
        { bubbles: true, clientX: cx, clientY: cy }));
      await new Promise(r2 => setTimeout(r2, 150));
      return { onTop: top ? (top.id || top.tagName) : null,
               reachesTarget: !!(top && (top === t || t.contains(top))),
               hits: window._hits };
    });
    ok('the control a step points at is REACHABLE, not just visible',
       r.reachesTarget, 'elementFromPoint hit ' + r.onTop + ' instead of the target');
    ok('…and a real click on it lands', r.hits === 1, JSON.stringify(r));

    // The rest of the app must still be protected, or the hole is just a
    // removed blocker wearing a hat.
    // The probe records the whole stack at that point, because "who is on top"
    // has more than one right answer: the blocker itself, or the callout that
    // sits over the blocker. What must NEVER be true is that the press lands
    // on the un-spotlighted control.
    r = await page.evaluate(async () => {
      window._hitsB = 0;
      const other = document.getElementById('target-c');
      other.onclick = function () { window._hitsB++; };
      const b = other.getBoundingClientRect();
      const stack = document.elementsFromPoint(b.left + b.width / 2, b.top + b.height / 2)
        .map(function (e) { return e.id || (e.className && String(e.className).trim()) || e.tagName; });
      const top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      // A press aimed at that point, not at the element — the finger's view.
      const ev = new MouseEvent('click', { bubbles: true, clientX: b.left + b.width / 2, clientY: b.top + b.height / 2 });
      if (top) top.dispatchEvent(ev);
      await new Promise(r2 => setTimeout(r2, 100));
      return { stack: stack,
               reachesB: !!(top && (top === other || other.contains(top))),
               hitsB: window._hitsB };
    });
    ok('…while everything else on the page is still shielded from stray clicks',
       !r.reachesB && r.hitsB === 0, 'stack at the un-spotlighted control: ' + JSON.stringify(r));

    // ── 11. v0.9.1385: A STEP THAT WAITS PARKS THE CARD IN A CORNER ───────
    // Brad's choice between three fixes: "when a step is waiting on you, the
    // card parks in a fixed screen corner well away from the wizard." While a
    // step waits, the APP is what he is looking at, so the card leaves rather
    // than hovering beside the highlight and shifting as content grows.
    await page.evaluate(() => { try { _gtEnd(); } catch (e) {} });
    await page.waitForTimeout(150);
    r = await page.evaluate(async () => {
      window._rrGateOpen = false;
      _guidedTour([
        { selector: '#target-a', title: 'Waits', body: 'do the thing',
          awaitUser: function () { return !!window._rrGateOpen; } },
        { title: 'end', body: 'end' }
      ]);
      await new Promise(r2 => setTimeout(r2, 500));
      const c = document.getElementById('gt-callout');
      const b = c.getBoundingClientRect();
      const W = window.innerWidth, H = window.innerHeight, tol = 14;
      return { corner: c.dataset.gtCorner || null,
               atLeft: b.left <= tol, atRight: b.right >= W - tol,
               atTop: b.top <= tol, atBottom: b.bottom >= H - tol,
               rect: [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)] };
    });
    ok('a step that WAITS parks the card in a screen corner',
       !!r.corner && (r.atLeft || r.atRight) && (r.atTop || r.atBottom), JSON.stringify(r));

    // The conductor hangs 66px off one side of the card. Against a screen edge
    // the wrong side puts him half off-screen — measured live in Brad's browser
    // at bottom-left: card at x8, mascot at x-57.
    const pinnedCorner = r.corner;
    const mascot = await page.evaluate(() => {
      const m = document.getElementById('gt-mascot');
      if (!m) return { none: true };
      const b = m.getBoundingClientRect();
      return { rect: [Math.round(b.left), Math.round(b.right)],
               onScreen: b.left >= 0 && b.right <= window.innerWidth };
    });
    ok('…with the conductor still fully on screen beside it',
       mascot.none || mascot.onScreen, JSON.stringify(mascot));

    // The case that actually bit: card pinned to a LEFT corner while the thing
    // it points at is far to the RIGHT. Choosing the conductor's side from
    // where the highlight is (rather than from which edge the card hugs) puts
    // him off the screen — Brad's browser, card at x8, conductor at x-57.
    // #target-c lives in the top-right, so this reproduces it.
    r = await page.evaluate(async () => {
      try { _gtEnd(); } catch (e) {}
      window._rrGateOpen = false;
      _guidedTour([
        { selector: '#target-c', title: 'Waits, far right', body: 'do the thing',
          awaitUser: function () { return !!window._rrGateOpen; } },
        { title: 'end', body: 'end' }
      ]);
      await new Promise(r2 => setTimeout(r2, 500));
      const c = document.getElementById('gt-callout'), cb = c.getBoundingClientRect();
      const m = document.getElementById('gt-mascot'), mb = m ? m.getBoundingClientRect() : null;
      return { corner: c.dataset.gtCorner || null,
               cardLeft: Math.round(cb.left),
               mascot: mb ? [Math.round(mb.left), Math.round(mb.right)] : null,
               onScreen: !mb || (mb.left >= 0 && mb.right <= window.innerWidth) };
    });
    ok('…even when the card is pinned left and the highlight is far right',
       r.onScreen, JSON.stringify(r));

    // Predictability was the entire argument for corners over pointing, so the
    // card must not migrate under the user. The hard case is not a resize —
    // it is a corner it was PUSHED OUT OF becoming free again. #corner-hog
    // starts in the bottom-right, so the card is sent elsewhere; move the hog
    // away and the preferred corner is suddenly the cleanest, and a naive
    // score would snap the card back mid-read.
    ok('a busy corner pushes the card to a different one',
       pinnedCorner && pinnedCorner !== 'bottom-right', JSON.stringify({ corner: pinnedCorner }));
    const firstCorner = pinnedCorner;
    r = await page.evaluate(async () => {
      const hog = document.getElementById('corner-hog');
      hog.style.right = 'auto'; hog.style.bottom = 'auto';
      hog.style.left = '430px'; hog.style.top = '200px';   // clear of every corner
      window.dispatchEvent(new Event('resize'));
      await new Promise(r2 => setTimeout(r2, 400));
      const c = document.getElementById('gt-callout');
      const b = c.getBoundingClientRect();
      return { corner: c.dataset.gtCorner || null, rect: [Math.round(b.left), Math.round(b.top)] };
    });
    ok('…and it STAYS there when that corner frees up, instead of snapping back',
       r.corner === firstCorner, 'was ' + firstCorner + ', now ' + JSON.stringify(r));

    // A step that does NOT wait still points, or the guide stops being a guide.
    r = await page.evaluate(async () => {
      try { _gtEnd(); } catch (e) {}
      _guidedTour([{ selector: '#target-a', title: 'Points', body: 'look here' },
                   { title: 'end', body: 'end' }]);
      await new Promise(r2 => setTimeout(r2, 500));
      const c = document.getElementById('gt-callout');
      const b = c.getBoundingClientRect(), t = document.getElementById('target-a').getBoundingClientRect();
      return { corner: c.dataset.gtCorner || null,
               gap: Math.round(Math.min(Math.abs(b.top - t.bottom), Math.abs(t.top - b.bottom),
                                        Math.abs(b.left - t.right), Math.abs(t.left - b.right))) };
    });
    ok('…while a step that does NOT wait still sits beside what it points at',
       !r.corner && r.gap <= 40, JSON.stringify(r));

    // v0.9.1394 — the conductor-on-screen check lives in guide-cover.js, not
    // here. Two assertions were written here first and BOTH passed with the
    // guard deliberately removed: this fixture's viewport and targets never
    // push the card hard against an edge, which is the only condition that
    // fails. The real app's layouts do, so the check belongs where the real
    // app is booted.
    ok('no page errors anywhere in the run', errs.length === 0, errs.join(' | '));
  } finally {
    await browser.close();
    try { fs.rmSync(DIR, { recursive: true, force: true }); } catch (e) {}
  }
  console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILED') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})();
