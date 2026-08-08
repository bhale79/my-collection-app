// ══ tests/guide-claims.js — the guide must not name a control that isn't there
//
// Brad's audit, 2026-08-07. The tour's FIRST sentence said:
//   "These show key numbers about your collection. **Tap any card to swap it**"
// Measured on #dash-card-0: no onclick attribute, no onclick property,
// cursor:auto. dashboard.js says it outright on the line that wires the click —
// "Catalog keeps its picker; others stay inert." The first thing a new user
// read asked them to do something that does nothing.
//
// The same walk found "You can show up to 5" when MAX_CARDS has been 6 since
// v0.9.754 — raised at Brad's own request, with the copy never following.
//
// Both are the same class: THE COPY MAKES A CLAIM ABOUT THE APP AND NOBODY
// CHECKS IT. This gate checks the checkable half — when a step tells you to
// press, tap, click or use something BY NAME, that something has to exist as a
// real control on the screen that step opens.
//
// HONEST LIMIT, PROVEN BY DRILL: this general check would NOT have caught the
// stat-card sentence. "Tap any card to swap it" names no label — it is a claim
// about BEHAVIOUR, and "any card" cannot be looked up. Restoring that exact
// copy leaves this gate green. That class needs a named assertion per claim,
// and the one for the stat cards is at the bottom of this file.
//
// WHAT IT CANNOT SEE, so nobody trusts it too far:
//   · whether the named control does what the sentence says it does
//   · a control that only appears after an interaction this harness cannot make
//     (those live in EXPECT_ABSENT below, each with a reason)
//   · claims that are not phrased as an instruction
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { SEED, SHAPE } = require('./lib/guide-fixture');

let chromium;
try { chromium = require('playwright').chromium; }
catch (e) {
  console.log('FAILED  —  guide-claims needs playwright and it is not installed.');
  process.exit(1);
}

const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}

// A bolded phrase is treated as a CONTROL CLAIM when an instruction verb sits
// just before it. "Press <strong>Group photos</strong>" claims a control;
// "<strong>Apply</strong> saves the grouping" is a statement about one, and
// "a stack of <strong>several shots</strong>" is neither.
const VERB = '(?:press|tap|click|hit|use|open|choose|pick)';

// Controls that genuinely are not on the screen the guide opens, each with the
// reason. Anything added here is a decision, not a silencing — it says "this
// claim is true, but only after something the harness cannot do".
const EXPECT_ABSENT = {
  'Photo ID': 'appears on the wizard/review card, not the inbox grid',
  'Add photos': 'label is "Add photos…" with an ellipsis — matched loosely below',
  'Engine + Tender': 'only exists once an engine has been matched in the wizard',
  'Engine Only': 'same as Engine + Tender',
  'Apply': 'only exists while the grouping panel is open',
  'Finished': 'same as Apply',
  'Take with Phone': 'phone-only control',
  'From This Computer': 'inside the Add photos menu, one click deeper',
  'From Google Photos': 'inside the Add photos menu, one click deeper',
};

// A leading + or similar is very often an SVG ICON sitting inside the button,
// which innerText cannot see — the Want list's button reads "ADD" to the DOM
// and "+ ADD" to the eye. Stripping it stopped this gate reporting a copy
// defect that was not one. (Checked in Brad's browser: the button holds two
// SVG children, the plus and the chevron.)
const norm = s => String(s || '').replace(/[…–—]/g, ' ')
  .replace(/[^a-z0-9+/ ]/gi, ' ').replace(/(^|\s)\+(\s|$)/g, ' ')
  .replace(/\s+/g, ' ').trim().toLowerCase();

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rr-claims-'));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    const page = await browser.newPage({ viewport: { width: 1844, height: 914 } });
    const errs = [];
    page.on('pageerror', e => errs.push(e.message.slice(0, 120)));
    for (const u of ['**://accounts.google.com/**', '**://apis.google.com/**',
                     '**://*.googleapis.com/**', '**://cdnjs.cloudflare.com/**',
                     '**://*.google.com/**'])
      await page.route(u, r => r.abort());

    await page.goto('file://' + APP + '/index.html');
    await page.waitForTimeout(2200);
    await page.evaluate(SEED);
    await page.evaluate(() => {
      for (let i = 0; i < 6; i++) {
        const c = document.querySelectorAll('[id^="rr-"][id$="-card"]');
        if (!c.length) break;
        c.forEach(x => { const g = x.querySelector('[id$="-go"]'); if (g) try { g.click(); } catch (e) {} x.remove(); });
      }
    });
    await page.waitForTimeout(400);

    const booted = await page.evaluate(() => typeof GUIDES !== 'undefined' ? Object.keys(GUIDES).length : 0);
    ok('the real app boots with its guides loaded', booted > 0, String(booted));
    if (!booted) throw new Error('no guides');

    const guideIds = await page.evaluate(() => Object.keys(GUIDES));
    const claims = [];
    let skippedTotal = 0;

    for (const gid of guideIds) {
      const found = await page.evaluate(async (args) => {
        const gid = args.gid, VERB = args.VERB;
        const g = GUIDES[gid];
        try { if (typeof g.open === 'function') g.open(); } catch (e) {}
        await new Promise(r => setTimeout(r, 700));
        // Everything the user can see and press on this screen.
        const vis = [];
        document.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [onclick], label')
          .forEach(function (n) {
            if (n.offsetParent === null && getComputedStyle(n).position !== 'fixed') return;
            const t = (n.innerText || n.value || n.placeholder || n.title || '').trim();
            if (t) vis.push(t);
            if (n.title) vis.push(n.title);
          });
        const out = [], skipped = [];
        const re = new RegExp(VERB + '\\s+(?:the\\s+|a\\s+|any\\s+)?<strong>([^<]{2,40})</strong>', 'gi');
        g.steps.forEach(function (st, i) {
          // A step that does not APPLY to this screen is not making a claim
          // about it. The tour has two openings — one for a dashboard with
          // stat cards and one for a brand-new user's empty dashboard — and
          // exactly one of them is live at a time. Checking the dormant one's
          // buttons against the live screen would report a defect that is
          // really just the other branch.
          if (typeof st.needs === 'function') {
            try { if (!st.needs()) { skipped.push({ step: i + 1, why: 'needs' }); return; } } catch (e) {}
          }
          // Same reasoning for an OPTIONAL step whose target is not here: the
          // engine skips it, so it never renders, so it never tells anyone to
          // press anything. On an empty For Sale list there is no row and so no
          // "Mark as Sold" — that step retires itself rather than lying.
          if (st.optional && st.selector && typeof st.awaitUser !== 'function') {
            var cands = document.querySelectorAll(st.selector), seen = false;
            for (var c2 = 0; c2 < cands.length; c2++) if (cands[c2].offsetParent !== null) { seen = true; break; }
            if (!seen) { skipped.push({ step: i + 1, why: 'optional-absent' }); return; }
          }
          const body = String(st.body || '');
          let m;
          while ((m = re.exec(body))) out.push({ step: i + 1, title: st.title || '', phrase: m[1] });
        });
        return { visible: vis, claims: out, skipped: skipped };
      }, { gid, VERB });

      skippedTotal += found.skipped.length;
      const haystack = found.visible.map(norm);
      for (const c of found.claims) {
        const want = norm(c.phrase);
        const hit = haystack.some(h => h === want || h.indexOf(want) >= 0 || want.indexOf(h) >= 0 && h.length > 3);
        claims.push({ guide: gid, ...c, hit });
      }
      await page.waitForTimeout(120);
    }

    // ANTI-VACUITY, STATED HONESTLY. The threshold used to be "at least 8
    // claims checked", calibrated when this gate checked claims from steps the
    // engine SKIPS — a step that never renders cannot tell anyone to press
    // anything, so counting it was counting a check that meant nothing. Those
    // are now skipped, which correctly drops the live count. What must not
    // change is that the COPY still makes plenty of claims and that we look at
    // every one that a user could actually reach.
    ok('the copy actually makes checkable claims, and we checked the live ones',
       claims.length >= 5 && (claims.length + skippedTotal) >= 8,
       claims.length + ' live, ' + skippedTotal + ' in steps the engine skips on this screen');

    const missing = claims.filter(c => !c.hit && !EXPECT_ABSENT[c.phrase]);
    const excused = claims.filter(c => !c.hit && EXPECT_ABSENT[c.phrase]);

    console.log('');
    console.log('  ── ' + claims.length + ' control claims checked, ' +
                claims.filter(c => c.hit).length + ' found on screen, ' +
                excused.length + ' known-absent, ' + missing.length + ' UNACCOUNTED ──');
    if (missing.length) {
      console.log('');
      for (const c of missing)
        console.log('     ' + c.guide + ' #' + c.step + ' "' + c.title + '" names "' + c.phrase + '" — not on that screen');
      console.log('');
    }

    ok('BRAD\'S BUG: every control the copy tells you to press exists on that screen',
       missing.length === 0,
       missing.slice(0, 5).map(c => c.guide + ' #' + c.step + ':' + c.phrase).join(' | '));

    // The exceptions list must not rot into a way of silencing real breakage:
    // anything in it that turns out to BE on screen should be taken back out.
    const staleExcuses = Object.keys(EXPECT_ABSENT)
      .filter(p => claims.some(c => c.phrase === p && c.hit));
    ok('…and the known-absent list has no stale entries',
       staleExcuses.length === 0,
       'these are on screen after all, remove them: ' + staleExcuses.join(', '));

    // ── THE STAT-CARD CLAIM, BY NAME ─────────────────────────────────────
    // The general check above cannot see this one: "Tap any card to swap it"
    // names no control. So it is asserted directly — if the copy tells you to
    // tap a card, a card has to be tappable.
    const statClaim = await page.evaluate(() => {
      // The stat-card step is no longer the tour's first: an empty dashboard
      // gets its own opening card. Find it by what it points at rather than by
      // position, so this assertion cannot quietly start measuring the wrong
      // step the next time the tour gains one.
      const st = GUIDES.tour.steps.find(s => s.selector === '#stats-grid') || GUIDES.tour.steps[0];
      const body = String(st.body || '');
      const saysTap = /\b(tap|click|press)\b[^.]{0,30}\bcard\b/i.test(body.replace(/<[^>]+>/g, ''));
      const card = document.getElementById('dash-card-0');
      const tappable = !!(card && (card.getAttribute('onclick') || typeof card.onclick === 'function' ||
                                   card.getAttribute('role') === 'button' ||
                                   getComputedStyle(card).cursor === 'pointer'));
      const cap = (typeof MAX_CARDS !== 'undefined') ? MAX_CARDS : null;
      const saysUpTo = (body.match(/up to (\d+)/i) || [])[1];
      return { saysTap, tappable, cardFound: !!card, cap, saysUpTo: saysUpTo ? +saysUpTo : null };
    });
    ok('the stat card the tour describes was found' +
       (SHAPE === 'default' ? '' : '  (skipped: fixture is ' + SHAPE + ')'),
       SHAPE !== 'default' || statClaim.cardFound, JSON.stringify(statClaim));
    ok('BRAD\'S BUG: the tour does not tell you to tap a stat card unless one is tappable',
       !statClaim.saysTap || statClaim.tappable, JSON.stringify(statClaim));
    ok('…and the number of stat cards it promises matches MAX_CARDS',
       statClaim.saysUpTo === null || statClaim.saysUpTo === statClaim.cap,
       JSON.stringify(statClaim));

    ok('checking every guide raises no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  } finally {
    await browser.close();
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  }
  console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILED') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})();
