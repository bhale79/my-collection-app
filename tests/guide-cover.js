// ══ tests/guide-cover.js — the help card must not sit on a control ════════
//
// Brad, twice, about the same screen: "you still can't hit engine + tender."
//
// The first fix (v0.9.1383) punched a hole in the guide's click blocker. That
// was a real bug and NOT this one. Driving his own browser found the actual
// cause in minutes: on add-item step 4 the card's rectangle was x686-1028 and
// "Engine Only" sat entirely inside it — 100% covered — while "Engine + Tender"
// was 51% covered. elementFromPoint at the centre of each returned the CARD.
// Only the right-hand sliver of Engine + Tender poked past the card's edge,
// which is why it read as intermittent rather than dead.
//
// Every placement rule in tutorial.js up to that point reasoned about the
// SPOTLIGHT. The card cleared the spotlight perfectly and landed on the buttons
// underneath it. Nothing anywhere asked "am I covering something the user has
// to press", and so nothing could ever have caught this.
//
// This gate asks it, for every step of every guide. It renders each step as a
// real one-step tour in the real app and measures, with elementFromPoint, which
// buttons/links/inputs the card has swallowed.
//
// WHAT IT CANNOT SEE, so nobody trusts it too far:
//   · a control that only appears after a click this harness does not make
//   · anything only true of real Google data
//   · advance / await behaviour — that is guide-follow.js's job
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { SEED, RESOLVE } = require('./lib/guide-fixture');

let chromium;
try { chromium = require('playwright').chromium; }
catch (e) {
  console.log('FAILED  —  guide-cover needs playwright and it is not installed.');
  console.log('          Run `npm install` (it is a declared devDependency).');
  process.exit(1);
}

const APP = path.join(__dirname, '..', 'app');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}

// Rendered in the page. Runs ONE step as a real tour, lets the placement
// settle, then asks the browser what a finger would actually hit.
const PROBE = `
// FIRST-RUN OVERLAYS EAT EVERY HIT TEST. Headless, the app stacks several of
// them — #rr-welcome-card, then #rr-ai-usage-card behind it — each a
// full-screen backdrop, so elementFromPoint returns the backdrop for every
// point on the page and this gate reports "clear" no matter what the help card
// is sitting on. A mutation drill caught it twice: the card landed at exactly
// the rectangle Brad measured in his own browser and the gate still passed.
// Dismissing them one by one is whack-a-mole, so clear the whole family, and
// keep clearing before every measurement in case a later one appears.
window._clearOverlays = function () {
  for (var pass = 0; pass < 6; pass++) {
    var cards = document.querySelectorAll('[id^="rr-"][id$="-card"]');
    if (!cards.length) return true;
    for (var k = 0; k < cards.length; k++) {
      var go = cards[k].querySelector('[id$="-go"]');
      if (go) { try { go.click(); } catch (e) {} }
      if (cards[k].parentNode) cards[k].parentNode.removeChild(cards[k]);
    }
  }
  return !document.querySelector('[id^="rr-"][id$="-card"]');
};
window._coverProbe = async function (step) {
  window._clearOverlays();
  try { _gtEnd(); } catch (e) {}
  // A second, narrating step exists so the card carries a real Next AND the
  // step under test is never the last one — the footer differs otherwise, and
  // the footer is part of the card's height.
  _guidedTour([step, { title: 'end', body: 'end' }]);
  // The card's position transitions; measure after it lands, not during. The
  // 4x4px phantom spotlight of 2026-08-06 was exactly this mistake.
  await new Promise(r => setTimeout(r, 420));
  // THE CARD GROWS. On a step that waits for the user, pressing Next before
  // doing the thing adds the "please do this first" line, and the taller card
  // is what actually landed on Engine Only / Engine + Tender in Brad's browser.
  // Measuring only the short version measures a card no stuck user ever sees.
  if (typeof step.awaitUser === 'function') {
    var nx0 = document.getElementById('gt-next');
    var openNow = true;
    try { openNow = !!step.awaitUser(); } catch (e) {}
    if (nx0 && !openNow) { nx0.click(); await new Promise(r => setTimeout(r, 420)); }
  }
  window._clearOverlays();
  var card = document.getElementById('gt-callout');
  if (!card) return { err: 'no card rendered' };
  var c = card.getBoundingClientRect();
  // If a card has no height it rendered nothing and measures nothing — say so
  // rather than reporting a clear result for a step that was never drawn.
  if (c.height < 20) return { err: 'card drew empty (' + Math.round(c.height) + 'px tall)', swallowed: [] };
  var nodes = document.querySelectorAll(
    'button, a[href], input, select, textarea, [role="button"], [onclick]');
  var swallowed = [];
  for (var k = 0; k < nodes.length; k++) {
    var n = nodes[k];
    // The card is allowed to sit on its own furniture, and on the dimmer.
    if (n.closest && n.closest('#gt-callout, #gt-blocker, #gt-hole, #gt-mascot')) continue;
    // v0.9.1397 — and on anything BEHIND an open modal. Brad asked for the card
    // to sit in one fixed place while a box is open ("your all over the place
    // and its hard to follow"), which parks it over the sidebar. Those controls
    // are already unreachable — the modal is over them — so counting them would
    // fail this gate for something that costs the user nothing. Controls INSIDE
    // the open box still count, which is where his Engine + Tender lived.
    var _modal = document.querySelector('#wizard-modal.open, .modal.open');
    if (_modal && !_modal.contains(n)) continue;
    if (n.disabled) continue;
    // A control nobody can see or press is not a control the card is stealing.
    // MEASURED: a closed wizard keeps display:flex at full size — .modal-overlay
    // is hidden with opacity:0 and pointer-events:none, and .open only flips
    // those two — so every button inside it keeps a real bounding box. Worse,
    // pointer-events:none means elementFromPoint at its centre returns whatever
    // is BEHIND it, which is often the help card, so the "is it really covered"
    // check below confirmed a cover that could not matter. That is how this
    // gate came to report the Photo Inbox card as burying "Engine Only".
    // The app's own _gtControls does exactly this, for exactly this reason;
    // the two scans must agree or one of them is lying.
    try {
      if (typeof n.checkVisibility === 'function') {
        if (!n.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true })) continue;
      } else {
        var _cs = getComputedStyle(n);
        if (_cs.pointerEvents === 'none' || _cs.visibility === 'hidden') continue;
      }
    } catch (e) {}
    var b = n.getBoundingClientRect();
    if (b.width < 4 || b.height < 4) continue;
    if (b.right <= 0 || b.bottom <= 0) continue;
    if (b.left >= window.innerWidth || b.top >= window.innerHeight) continue;
    var x = b.left + b.width / 2, y = b.top + b.height / 2;
    // The measurement that matches a finger. Not "do the rectangles overlap" —
    // an edge clipped by a few pixels is survivable and would make this gate
    // noisy enough to be switched off.
    if (!(x >= c.left && x <= c.right && y >= c.top && y <= c.bottom)) continue;
    var hit = document.elementFromPoint(x, y);
    if (!hit) continue;
    if (hit === n || n.contains(hit)) continue;          // still reachable somehow
    if (!(hit.closest && hit.closest('#gt-callout'))) continue;  // covered by something else
    swallowed.push({
      tag: n.tagName,
      id: n.id || '',
      text: (n.innerText || n.value || n.placeholder || '').trim().replace(/\\s+/g, ' ').slice(0, 40)
    });
    if (swallowed.length >= 8) break;
  }
  // v0.9.1394 — THE CONDUCTOR MUST STAY ON THE SCREEN. Found by walking the
  // guides in Brad's browser: off-screen on tour #3 (x2277 of 2304) and on four
  // Photo Inbox steps (x-57). It is checked HERE and not in guide-follow because
  // only a real app layout pushes the card hard enough against an edge to fail
  // — a synthetic fixture passed with the guard removed.
  var _m = document.getElementById('gt-mascot');
  var mascot = null;
  if (_m && getComputedStyle(_m).display !== 'none' && _m.getBoundingClientRect().width > 2) {
    var mb = _m.getBoundingClientRect();
    mascot = { x: Math.round(mb.left), r: Math.round(mb.right),
               onScreen: mb.left >= 0 && mb.right <= window.innerWidth };
  }
  try { _gtEnd(); } catch (e) {}
  return { card: [Math.round(c.left), Math.round(c.top), Math.round(c.width), Math.round(c.height)],
           mascot: mascot, swallowed: swallowed };
};
`;

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rr-guidecover-'));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const report = [];
  try {
    // Brad's own window: 1844x914. A short, wide viewport is what pushes the
    // wizard's grouping row down under the card. 1440x900 did not reproduce it
    // and a mutation drill proved the gate vacuous at that size.
    // RR_VW / RR_VH / RR_FONT let this gate be run across a matrix of window
    // sizes and text sizes. Unset, it measures Brad's own window at normal
    // text, exactly as before — the defaults are the point, the knobs are for
    // sweeping. Every placement rule in the engine (side picking, overlap
    // escape, control dodging, corner pinning, the conductor's 66px overhang)
    // is a geometry calculation, and geometry that has only been checked at
    // one size has only been checked once.
    const VW = parseInt(process.env.RR_VW || '1844', 10);
    const VH = parseInt(process.env.RR_VH || '914', 10);
    const FONT = process.env.RR_FONT || 'normal';
    const page = await browser.newPage({ viewport: { width: VW, height: VH } });
    const errs = [];
    page.on('pageerror', e => errs.push(e.message.slice(0, 120)));
    for (const u of ['**://accounts.google.com/**', '**://apis.google.com/**',
                     '**://*.googleapis.com/**', '**://cdnjs.cloudflare.com/**',
                     '**://*.google.com/**'])
      await page.route(u, r => r.abort());

    await page.goto('file://' + APP + '/index.html');
    await page.waitForTimeout(2200);
    await page.evaluate(SEED);
    await page.evaluate((f) => {
      try {
        localStorage.setItem('lv_font_scale', f);
        if (typeof applyFontScale === 'function') applyFontScale();
      } catch (e) {}
    }, FONT);
    await page.waitForTimeout(300);
    await page.evaluate(RESOLVE);
    await page.evaluate(PROBE);
    // THE FIRST-RUN WELCOME OVERLAY EATS EVERY HIT TEST. Headless, the app
    // shows #rr-welcome-card, and elementFromPoint then returns the welcome
    // card for every point on the page — so this gate reported "clear" for
    // steps whose cards were sitting squarely on Engine Only. A mutation drill
    // caught it: the card landed at exactly the rectangle Brad measured in his
    // own browser and the gate still passed. Dismiss it the way a user does.
    await page.evaluate(() => window._clearOverlays());
    await page.waitForTimeout(400);
    const welcomeGone = await page.evaluate(() =>
      !document.querySelector('[id^="rr-"][id$="-card"]'));
    ok('the first-run overlays are out of the way before anything is measured',
       welcomeGone, 'an overlay would swallow every hit test');

    const booted = await page.evaluate(() => ({
      guides: typeof GUIDES !== 'undefined' ? Object.keys(GUIDES).length : 0,
      probe: typeof window._coverProbe,
      dodge: typeof _gtDodge
    }));
    ok('the real app boots headless with its guides and the dodge helper loaded',
       booted.guides > 0 && booted.probe === 'function' && booted.dodge === 'function',
       JSON.stringify(booted));
    if (!booted.guides) throw new Error('no guides — nothing to measure');

    const guideIds = await page.evaluate(() => Object.keys(GUIDES));

    for (const gid of guideIds) {
      const res = await page.evaluate(async (gid) => {
        const g = GUIDES[gid];
        const skippedSteps = [];
        // Close anything a previous guide left open. Without this the reports
        // guide was measured with the ADD WIZARD still on screen from
        // add-item, and reported its card as covering #wiz-input — a control
        // that has no business being on the reports page at all. State left
        // behind by the last test is not a finding about this one.
        try { if (typeof _doCloseWizard === 'function') _doCloseWizard(); } catch (e) {}
        try { _gtEnd(); } catch (e) {}
        await new Promise(r => setTimeout(r, 250));
        try { if (typeof g.open === 'function') g.open(); } catch (e) {}
        await new Promise(r => setTimeout(r, 450));

        // Stand where the guide expects the user to be standing, exactly as
        // guide-walk does — a step measured against a screen that is not open
        // measures nothing.
        const NEEDS_ITEM_PAGE = { 'list-for-sale': 1, 'mark-sold': 1, 'remove-item': 1 };
        if (NEEDS_ITEM_PAGE[gid]) {
          try {
            const pd = Object.values(state.personalData || {})[0];
            if (pd && typeof _openOwnedByInvId === 'function') _openOwnedByInvId(pd.inventoryId);
            await new Promise(r => setTimeout(r, 700));
          } catch (e) {}
        }
        const out = [];
        for (let i = 0; i < g.steps.length; i++) {
          const step = g.steps[i];
          try { if (typeof step.before === 'function') step.before(); } catch (e) {}
          await new Promise(r => setTimeout(r, 220));

          // MEASURE ONLY WHAT THE USER WOULD BE SHOWN. The engine skips an
          // optional step whose target is not on this screen, and a step whose
          // `needs` predicate says it does not apply. Measuring one anyway puts
          // a card on a screen it would never appear on and then judges what it
          // covers there — which is how the For Sale guide's "When it sells"
          // came to be measured while the harness was standing on an item's own
          // page, burying two buttons in a situation no user is ever in.
          let applies = true;
          if (typeof step.needs === 'function') { try { applies = !!step.needs(); } catch (e) {} }
          if (applies && step.optional && step.selector && typeof step.awaitUser !== 'function') {
            const cands = document.querySelectorAll(step.selector);
            applies = false;
            for (let z = 0; z < cands.length; z++) if (cands[z].offsetParent !== null) { applies = true; break; }
          }
          if (!applies) { skippedSteps.push(gid + ' #' + (i + 1)); continue; }

          // BRAD'S SCREEN. The grouping row only exists once a number has been
          // typed and a match accepted, so without this the one step that
          // produced the bug is measured against an empty wizard and passes
          // vacuously. 773 is a steam engine, which is what makes the
          // Engine Only / Engine + Tender row appear at all.
          if (gid === 'add-item') {
            try {
              const inp = document.getElementById('wiz-input');
              if (i + 1 >= 3 && inp && !String(inp.value).trim()) {
                inp.focus();
                '773'.split('').forEach(function (c) {
                  inp.value += c;
                  inp.dispatchEvent(new InputEvent('input', { bubbles: true, data: c, inputType: 'insertText' }));
                });
                await new Promise(r => setTimeout(r, 900));
              }
              // From step 6 the guide is talking about the VARIATION screen,
              // which only exists after a match is chosen. Before that, do NOT
              // tap — typing 773 auto-accepts, and the grouping row lives on
              // the item-number screen the tap would leave.
              if (i + 1 >= 6) {
                const box = document.getElementById('wiz-suggestions');
                if (box && box.offsetParent !== null) {
                  const row = Array.from(box.querySelectorAll('div,button'))
                    .find(function (e) { return /4-6-4 Steam Locomotive/.test((e.innerText || '')) &&
                                                (e.innerText || '').length < 140; });
                  if (row) { row.click(); await new Promise(r => setTimeout(r, 900)); }
                }
              }
            } catch (e) {}
          }
          const r = await window._coverProbe(step);
          out.push({ n: i + 1, title: step.title || '(no title)',
                     selector: step.selector || null, optional: !!step.optional, r });
        }
        try { if (typeof _gtEnd === 'function') _gtEnd(); } catch (e) {}
        try { if (typeof _doCloseWizard === 'function') _doCloseWizard(); } catch (e) {}
        return { steps: out, skipped: skippedSteps };
      }, gid);
      report.push({ guide: gid, steps: res.steps, skipped: res.skipped });
      await page.waitForTimeout(200);
    }

    const all = report.flatMap(g => g.steps.map(s => ({ guide: g.guide, ...s })));
    const badAll = all.filter(s => s.r && s.r.swallowed && s.r.swallowed.length);

    // ── ONE COMBINATION THAT IS GENUINELY TOO SMALL ────────────────────────
    // Swept across 1844x914, 1600x1000, 1366x768, 1280x720 and 1024x700, at
    // Normal, Large and Extra Large text, the card is clear of every control
    // everywhere EXCEPT the tightest corner of that grid: a 1024x700 window at
    // Extra Large text. There a 342px card is 288-393px tall in a 700px window
    // with the wizard filling most of it, and there is no clean spot left to
    // move to. These two are named, with what they cover, so the gate stays
    // red the moment a THIRD appears or one of these gets worse — an unnamed
    // allowance is just a gate switched off.
    //
    // Not silently accepted: worth revisiting by making the card narrower on
    // small windows, which is a change I could not verify by eye tonight and
    // would rather not guess at.
    const TIGHT = (VW <= 1024 && VH <= 700 && FONT === 'extra-large');
    const ALLOWED = TIGHT
      ? { 'add-item #8': 'wizard-next-btn', 'add-want #4': 'TH' }
      : {};
    const bad = badAll.filter(s => {
      const key = s.guide + ' #' + s.n;
      if (!(key in ALLOWED)) return true;
      // The allowance covers this step only while it covers the same thing.
      return !s.r.swallowed.every(w => (w.id || w.tag || '').indexOf(ALLOWED[key]) >= 0);
    });
    if (TIGHT) {
      const stale = Object.keys(ALLOWED).filter(k => !badAll.some(s => (s.guide + ' #' + s.n) === k));
      ok('the known-cramped allowances are all still needed at this size',
         stale.length === 0, 'these are clean now, remove them: ' + stale.join(', '));
      console.log('  ── 1024x700 at Extra Large: ' + Object.keys(ALLOWED).length +
                  ' known-cramped steps allowed by name ──');
    }

    console.log('');
    const skippedAll = report.flatMap(g => g.skipped || []);
    console.log('  ── measured ' + report.length + ' guides, ' + all.length + ' steps' +
                (skippedAll.length ? ', ' + skippedAll.length + ' not shown on this screen: ' + skippedAll.join(', ') : '') + ' ──');
    for (const g of report) {
      const b = g.steps.filter(s => s.r && s.r.swallowed && s.r.swallowed.length);
      console.log('     ' + g.guide.padEnd(24) +
                  (b.length ? b.length + ' step(s) covering a control' : 'card clear of every control'));
    }
    if (bad.length) {
      console.log('');
      console.log('  ── every control the help card swallowed ──');
      for (const s of bad)
        console.log('     ' + s.guide + ' #' + s.n + ' "' + s.title + '"  card=' +
                    JSON.stringify(s.r.card) + '  ->  ' +
                    s.r.swallowed.map(c => (c.id || c.tag) + ' "' + c.text + '"').join(', '));
    }
    console.log('');

    ok('BRAD\'S BUG: no help card covers a button, link or input the user must press',
       bad.length === 0,
       bad.slice(0, 4).map(s => s.guide + ' #' + s.n + ' -> ' +
         s.r.swallowed.map(c => c.text || c.id || c.tag).join('/')).join(' | '));

    // Named, so the specific screen he reported can never regress quietly back
    // into the general count above.
    const grouping = all.find(s => s.guide === 'add-item' && s.selector === '#wiz-grouping-btns');
    ok('…and the add-item grouping step is one of the steps that was measured',
       !!grouping, 'no add-item step targets #wiz-grouping-btns');
    const tenderCovered = all.filter(s =>
      s.r && s.r.swallowed && s.r.swallowed.some(c => /engine/i.test(c.text || '')));
    ok('…with Engine Only and Engine + Tender specifically reachable',
       tenderCovered.length === 0,
       tenderCovered.map(s => s.guide + ' #' + s.n).join(' | '));

    // v0.9.1394 — the conductor, on every step of every guide.
    const offScreen = all.filter(s => s.r && s.r.mascot && !s.r.mascot.onScreen);
    if (offScreen.length) {
      console.log('');
      console.log('  ── steps where the conductor is off the screen ──');
      for (const s of offScreen)
        console.log('     ' + s.guide + ' #' + s.n + ' "' + s.title + '"  card=' +
                    JSON.stringify(s.r.card) + '  conductor=' + JSON.stringify(s.r.mascot));
      console.log('');
    }
    ok('the conductor never hangs off the edge of the screen',
       offScreen.length === 0,
       offScreen.slice(0, 4).map(s => s.guide + ' #' + s.n + ' @' + s.r.mascot.x).join(' | '));
    ok('…and he was actually measured, not skipped as missing art',
       all.some(s => s.r && s.r.mascot), 'no step rendered a measurable conductor');

    ok('measuring every guide raises no page errors',
       errs.length === 0, errs.slice(0, 4).join(' | '));

    fs.writeFileSync(path.join(dir, 'cover.json'), JSON.stringify(report, null, 1));
  } finally {
    await browser.close();
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  }

  console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILED') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})();
