#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// TOUR COUNT + THE LIT TAB — v0.9.1869   (real Chromium, the REAL app)
//
// Brad: "first box says step 2". The tour's first card was written for an
// empty dashboard and retired itself on his; the counter kept counting it. A
// card that will never be shown is not a step — the counter now counts the
// cards this user will see, on his window, on an empty account and on a phone.
//
// And the second ring (tests/tour_layout_tests.js says WHERE it is) must light
// the tab, not just outline it: the dark shade is a box-shadow that cuts one
// window, so the tab's own patch is lifted back with a backdrop brightness.
// Only a rendered pixel can prove that, so this file reads one.
//
// Both on tests/lib/tour-harness.js, split from the layout suite so each stays
// well inside run-all's three-minute allowance.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  tour_count_tests needs playwright and it is not installed.'); process.exit(1); }
const H = require('./lib/tour-harness.js');
const { openApp, walkTour, pixelAt } = H;
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail))); cond ? pass++ : fail++; }
function planted(name, from, to) {
  const src = H.plantedSource(from, to);
  if (!src) T('PLANTED ' + name + ': the anchor to cut is in tutorial.js', false, from.slice(0, 80));
  return src;
}
const nums = cards => cards.map(c => (c.stepLabel.match(/Step (\d+) of (\d+)/) || []).slice(1, 3).map(Number));
const consecutive = cards => { const n = nums(cards); return n.length > 0 && n.every((p, k) => p[0] === k + 1 && p[1] === n.length); };
const show = cards => nums(cards).map(p => p.join('/')).join(' ');

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});

  // ═══ A · THE COUNTER ══════════════════════════════════════════════════════
  console.log('== A · "Step 1 of N" first, consecutive after — with a collection, on an empty account, on a phone ==');
  let { pg, errs } = await openApp(browser, { w: 1844, h: 914, withData: true });
  const full = await walkTour(pg, null, true);
  const fullErrs = errs.slice();
  await pg.close();
  T('A1  with a collection: the first card says "Step 1 of N", the numbers run 1..N with no gap, and N is the number of cards shown', consecutive(full) && full.length >= 20, show(full));
  ({ pg, errs } = await openApp(browser, { w: 1400, h: 900, withData: false }));
  const empty = await walkTour(pg, null, true);
  const emptyErrs = errs.slice();
  await pg.close();
  T('A2  a brand-new collector (empty): the same — 1..M with no gap (the photo strip and the large panels are counted out up front)', consecutive(empty) && empty.length >= 20, show(empty));
  T('A3  …and the fourth card is the empty-dashboard version of the data-cards card ("Nothing here yet"); with a collection it is "Your data cards"', empty[3] && /Nothing here yet/.test(empty[3].title) && full[3] && full[3].title === 'Your data cards', [empty[3] && empty[3].title, full[3] && full[3].title]);
  ({ pg, errs } = await openApp(browser, { w: 390, h: 844, withData: true }));
  const phone = await walkTour(pg, null, true);
  const phoneErrs = errs.slice();
  const phoneEnded = await pg.evaluate(() => !document.getElementById('gt-callout'));
  await pg.close();
  T('A4  on a phone (390x844): the tour reaches the end, the numbers run 1..P with no gap (Sync from Sheet, a sidebar button, is counted out), and the menu card rings the bottom bar',
    phoneEnded && consecutive(phone) && phone.length >= 20 && phone[1] && phone[1].title === 'Your main areas' && !!phone[1].hole, { ended: phoneEnded, nums: show(phone), areas: phone[1] });
  T('A5  on the phone, page cards still ring their tab in the bottom bar (My Collection, Want / Upgrade, Reports, Contacts)',
    ['My Collection', 'Want / Upgrade', 'Reports', 'Contacts'].every(t => { const c = phone.find(x => x.title === t); return !!(c && c.hole2); }), phone.filter(c => ['My Collection', 'Want / Upgrade', 'Reports', 'Contacts'].indexOf(c.title) >= 0).map(c => [c.title, c.hole2]));
  T('A6  on the phone the walk reaches every page too (want list and for-sale pages draw cards, not tables, and the tour rings those)',
    ['page-browse', 'page-upgrade', 'page-forsale', 'page-parts', 'page-tools', 'page-reports', 'page-sold', 'page-photo-inbox', 'page-prefs', 'page-dispatch', 'page-contacts'].every(p => phone.some(c => c.page === p && c.hole)), phone.map(c => [c.title, c.page, !!c.hole]));
  // PLANTED: the old counter (the step's index over the whole list) — the empty walk shows a gap
  const srcA = planted('A', "Step ' + _stepNo + ' of ' + _stepTotal", "Step ' + (i + 1) + ' of ' + total");
  if (srcA) {
    ({ pg, errs } = await openApp(browser, { w: 1400, h: 900, withData: false, tutorial: srcA }));
    const emptyOld = await walkTour(pg, 'My Collection', true);   // the gap shows on the dashboard cards
    await pg.close();
    T('PLANTED A: the old counter on an empty dashboard skips numbers (caught)', !consecutive(emptyOld), show(emptyOld));
  }

  // ═══ B · LIT, measured in pixels ═════════════════════════════════════════
  console.log('\n== B · under the second ring the tab is LIT, not merely outlined (one rendered pixel, pngjs) ==');
  // The sample point is the tab's own left padding (no glyph there), measured
  // at the moment of sampling — the tour scrolls the page as it goes.
  const sampleTab = async (pg, sel, scrollFirst) => {
    const b = await pg.evaluate(([sel, scrollFirst]) => { const el = document.querySelector(sel); if (!el) return null; if (scrollFirst) el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }, [sel, !!scrollFirst]);
    if (!b) return null;
    const px = Math.round(b[0] + 10), py = Math.round(b[1] + b[3] / 2);
    const p = await pixelAt(pg, px, py); return p ? Object.assign(p, { at: [px, py] }) : null;
  };
  if (H.PNG) {
    ({ pg, errs } = await openApp(browser, { w: 1844, h: 914, withData: true }));
    const plain = await sampleTab(pg, '.nav-item[onclick*="filterOwned"]', true);          // no tour: the real colour
    await walkTour(pg, 'My Collection');                                                   // measured walk: the ring has settled
    const lit = await sampleTab(pg, '.nav-item[onclick*="filterOwned"]', false);           // under the second ring
    const dimmed = await sampleTab(pg, '.nav-item[onclick*="buildForSalePage"]', false);   // a tab with no ring, under the shade
    await pg.close();
    T('B1  under the second ring the tab is as bright as with no tour at all (within 15%), while an unringed tab is shaded to well under half',
      lit && plain && dimmed && lit.lum >= plain.lum * 0.85 && dimmed.lum <= plain.lum * 0.55, { plain, lit, dimmed });
    // PLANTED: the ring without its brightness lift — outlined but still shaded
    const srcB = planted('B', 'backdrop-filter:brightness(2.63);-webkit-backdrop-filter:brightness(2.63);', '');
    if (srcB) {
      ({ pg, errs } = await openApp(browser, { w: 1844, h: 914, withData: true, tutorial: srcB }));
      await walkTour(pg, 'My Collection');
      const planted2 = await sampleTab(pg, '.nav-item[onclick*="filterOwned"]', false);
      await pg.close();
      T('PLANTED B: the ring without its brightness lift leaves the tab shaded — well under half as bright as the real engine shows it at the same pixel (caught)', planted2 && lit && planted2.lum <= lit.lum * 0.55, { lit, planted2 });
    }
  } else {
    T('B1  pixel read needs pngjs (npm install) — SKIPPED', false, 'pngjs missing');
  }

  console.log('\n== C · no page errors on any walk ==');
  T('C1  no page errors (desktop, empty, phone)', fullErrs.length === 0 && emptyErrs.length === 0 && phoneErrs.length === 0, fullErrs.concat(emptyErrs, phoneErrs));

  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
