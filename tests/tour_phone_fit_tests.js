#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// TOUR ON A PHONE — every card fits the screen   (real Chromium, the REAL app)
//
// Found in the launch walk-through 2026-10-19: tour cards 1 ("Let's go through
// your dashboard") and 22 ran ~42px off the RIGHT edge of a phone (360/390/412
// wide) — the × and part of Next / Done were cut off. Cards 2–21 fit. The tour
// tests only measured computer windows (1844x914, 1568x706), so it was never
// seen. [stated] Brad: "yes" to fixing it before the York show.
//
// Cause: a card with nothing to point at is centred, but the centring kept a
// 72px floor on the LEFT for the conductor — who stands down under 480px, while
// the card takes the full width there. The floor pushed the card right by
// ~56px with nothing holding its right edge.
//
// THE RULE: on any screen, every tour card — and its ×, Back and Next/Done —
// sits fully inside the window, left and right. Planted: the old placement line
// served in place of the real one must make this test fail.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  tour_phone_fit_tests needs playwright and it is not installed.'); process.exit(1); }
const H = require('./lib/tour-harness.js');

let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail))); cond ? pass++ : fail++; }

const PHONES = [{ w: 360, h: 780 }, { w: 390, h: 844 }, { w: 412, h: 915 }];

// Walk the tour and measure, on each card, the card and every button in it.
async function walkMeasure(browser, size, tutorial) {
  const { pg, errs } = await H.openApp(browser, { w: size.w, h: size.h, withData: true, tutorial });
  await pg.evaluate(() => { startGuide('tour'); });
  // the first card is drawn ~320ms after startGuide
  for (let t = 0; t < 40; t++) { if (await pg.evaluate(() => !!document.getElementById('gt-callout'))) break; await pg.waitForTimeout(100); }
  const out = [];
  let prev = null;
  for (let k = 0; k < 40; k++) {
    // wait for the next card to arrive and stop moving
    let snap = null, last = null;
    for (let t = 0; t < 30; t++) {
      await pg.waitForTimeout(150);
      snap = await pg.evaluate(() => {
        const co = document.getElementById('gt-callout'); if (!co) return null;
        const R = el => { const b = el.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; };
        const step = (document.getElementById('gt-step') || {}).textContent || '';
        const btns = Array.from(co.querySelectorAll('button')).filter(b => b.offsetParent !== null)
          .map(b => ({ label: (b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 12), r: R(b) }));
        return { step, title: (document.getElementById('gt-title') || {}).textContent || '', card: R(co), btns, vw: window.innerWidth };
      });
      if (!snap) break;
      const key = snap.step + '|' + snap.card.join(',');
      if (snap.step !== prev && key === last) break;
      last = key;
    }
    if (!snap) break;
    out.push(snap);
    prev = snap.step;
    const more = await pg.evaluate(() => { const n = document.getElementById('gt-next'); if (!n) return false; n.click(); return true; });
    if (!more) break;
  }
  await pg.close();
  return { cards: out, errs };
}

const offScreen = c => {
  const bad = [];
  if (c.card[0] < 0 || c.card[0] + c.card[2] > c.vw) bad.push('card ' + c.card.join(','));
  for (const b of c.btns) if (b.r[0] < 0 || b.r[0] + b.r[2] > c.vw) bad.push('"' + b.label + '" ' + b.r.join(','));
  return bad;
};

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});

  for (const size of PHONES) {
    const { cards, errs } = await walkMeasure(browser, size);
    console.log('== ' + size.w + 'x' + size.h + ' — ' + cards.length + ' cards ==');
    T(size.w + ': the tour runs to the end (20+ cards)', cards.length >= 20, cards.length);
    const bad = cards.map(c => ({ c: c.step + ' ' + c.title, bad: offScreen(c) })).filter(x => x.bad.length);
    T(size.w + ': every card and every button on it is fully on screen, left and right', !bad.length, bad);
    const first = cards[0], last = cards[cards.length - 1];
    const mid = c => c && Math.abs((c.card[0] + c.card[2] / 2) - c.vw / 2) <= 4;
    T(size.w + ': the opener and the closer sit in the middle of the screen', mid(first) && mid(last), [first && first.card, last && last.card]);
    T(size.w + ': no script errors', !errs.length, errs.slice(0, 3));
  }

  // Desktop must not move: the opener stays centred with room for the conductor.
  {
    const { cards } = await walkMeasure(browser, { w: 1844, h: 914 });
    const first = cards[0];
    T('1844: the opener is still in the middle on a computer', first && Math.abs((first.card[0] + first.card[2] / 2) - first.vw / 2) <= 40, first && first.card);
    T('1844: every card on screen on a computer too', cards.every(c => !offScreen(c).length), cards.filter(c => offScreen(c).length).map(c => c.title));
  }

  // PLANTED — the old centring line (72px left floor, no right edge).
  const FIXED = 'var L = Math.max(_gtLeftFloor(cw0), (window.innerWidth - cw0) / 2);';
  const OLD = 'var L = Math.max(72, (window.innerWidth - cw0) / 2);';
  const src = H.plantedSource(FIXED, OLD);
  T('PLANTED the fixed centring line is in tutorial.js', !!src);
  if (src) {
    const src2 = src.split('L = Math.min(L, Math.max(8, window.innerWidth - cw0 - 8));   // never past the right edge').join('');
    const { cards } = await walkMeasure(browser, PHONES[0], src2);
    const bad = cards.filter(c => offScreen(c).length);
    T('PLANTED with the old line, a 360-wide phone has cards off the right edge (the test can fail)', bad.length > 0, cards.length);
  }

  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL TOUR PHONE FIT TESTS GREEN') + ' (' + pass + ' passed, ' + fail + ' failed)');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + e.message); process.exit(1); });
