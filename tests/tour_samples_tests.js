#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// TOUR SAMPLES — v0.9.1871   (real Chromium, the REAL app, no stubs but Drive)
//
// [stated] Brad, tour item 11: "Three well-known items on each list page (My
// Collection, Want/Upgrade, For Sale, Sold, Parts, Photo Inbox) plus three
// sample photos — drawn by each page's own row code so they look exactly like
// real rows, marked as samples, never saved anywhere, gone when the tour ends."
//
// THIS FILE (config.js RR_TOUR_SAMPLES / rrSampleRows; the engine's switch):
//   A · a brand-new collector walking the tour sees, on each of the six pages,
//       exactly three sample rows — the 2343, the 6464-1, the 6457 — each
//       tagged SAMPLE and inert, and the card says they are samples;
//   B · the same on a phone (the card layouts);
//   C · NEVER SAVED: during and after the whole walk not one localStorage,
//       IndexedDB, Sheets or Drive write carries a sample, no photo or folder
//       look-up runs for one, the Parts card makes no "Parts Needed" tab, and
//       every list in state is exactly what it was;
//   D · GONE: after Done, and after Cancel in the middle (on For Sale), no
//       sample is left anywhere and each page shows its own empty look.
// The other half — a page with its own rows, the row SHAPE, My Collection's
// signature, the source — is tests/tour_samples_rows_tests.js (shared helpers:
// tests/lib/tour-samples-lib.js). Each rule has a PLANTED version of the
// mistake, served in place of the real file, to prove the pin can fail.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  tour_samples_tests needs playwright and it is not installed.'); process.exit(1); }
const H = require('./lib/tour-harness.js');
const { openApp, walkTour } = H;
const S = require('./lib/tour-samples-lib.js');
const { SRC, standInDrive, WATCH, PROBE, walkWithProbes, NUMS, ROWS_NOTE, PHOTOS_NOTE, afterTour, SKEL } = S;
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail))); cond ? pass++ : fail++; }
const planted = (file, from, to) => S.planted(T, file, from, to);

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  let pg, errs;

  // ═══ A + C + D · a brand-new collector, the whole tour, on a computer ═════
  console.log('== A · every empty list page shows the three samples, tagged, inert, and the card says so (1568x900, empty account) ==');
  ({ pg, errs } = await openApp(browser, { w: 1568, h: 900, withData: false }));
  await standInDrive(pg, []);
  await pg.evaluate(WATCH);
  const A = await walkWithProbes(pg);
  const aEnd = await afterTour(pg);
  const aErrs = errs.slice();
  const pagesSeen = Object.keys(A);
  T('A1  the walk reached all six list pages', ['My Collection', 'Want / Upgrade', 'For Sale', 'Parts Needed', 'Sold Items', 'The Photo Inbox'].every(t => A[t]), pagesSeen);
  pagesSeen.forEach(t => {
    const p = A[t];
    T('A2  ' + t + ': exactly three sample rows on screen', p.n === 3, p.n);
    T('A3  ' + t + ': every one is tagged SAMPLE and inert (nothing on it can be pressed or focused)', p.tagged && p.inert, { tagged: p.tagged, inert: p.inert });
    if (t === 'The Photo Inbox') T('A4  ' + t + ': the three photos are the 2343, the 6464-1 and the 6457, built into the app', /sample-2343\.jpg/.test(p.imgs) && /sample-6464-1\.jpg/.test(p.imgs) && /sample-6457\.jpg/.test(p.imgs), p.imgs);
    else T('A4  ' + t + ': the three are the 2343, the 6464-1 and the 6457', NUMS.every(n => p.text.indexOf(n) >= 0), p.text.slice(0, 200));
    T('A5  ' + t + ': the card says they are samples and go away', (t === 'The Photo Inbox' ? PHOTOS_NOTE : ROWS_NOTE).test(p.body), p.body.slice(-160));
  });
  T('A6  the Parts card names each part\'s item from the sample\'s own catalog row — "For 2343 (Santa Fe)"', A['Parts Needed'] && /For 2343 \(Santa Fe\)/.test(A['Parts Needed'].text) && /For 6457 \(Lionel Lines\)/.test(A['Parts Needed'].text), A['Parts Needed'] && A['Parts Needed'].text.slice(0, 200));
  console.log('\n== C · never saved ==');
  T('C1  no localStorage write carried a sample', aEnd.rec.ls.length === 0, aEnd.rec.ls);
  T('C2  no IndexedDB write carried a sample (the copy kept on the device)', aEnd.rec.idb.length === 0, aEnd.rec.idb);
  T('C3  no Sheets or Drive call carried a sample', aEnd.rec.writes.length === 0, aEnd.rec.writes);
  T('C4  no photo or folder look-up ran — an empty account has no rows of its own, so any would have been for a sample', aEnd.rec.photo.length === 0, aEnd.rec.photo);
  T('C5  the Parts card did not make a "Parts Needed" tab (the tour promises nothing changes)', aEnd.rec.parts === 0, aEnd.rec.parts);
  T('C6  every list in state is exactly what it was before the tour', aEnd.same, '');
  console.log('\n== D · gone when the tour ends ==');
  T('D1  after Done: no sample left anywhere in the page, the switch is off, the tour is closed', aEnd.left === 0 && aEnd.on === false && !aEnd.callout, aEnd);
  const aBack = await pg.evaluate(async () => {
    const out = {};
    const go = async (name, sel, extra) => { showPage(name); if (extra) extra(); await new Promise(r => setTimeout(r, 250)); out[name] = { samples: document.querySelectorAll(sel + ' [data-rr-sample]').length, text: (document.querySelector(sel) || {}).textContent || '' }; };
    await go('browse', '#page-browse', () => filterOwned());
    await go('upgrade', '#page-upgrade');
    await go('forsale', '#page-forsale');
    await go('sold', '#page-sold');
    await go('parts', '#parts-list');
    return out;
  });
  T('D2  every page opened after the tour draws no sample', Object.values(aBack).every(v => v.samples === 0), Object.keys(aBack).map(k => [k, aBack[k].samples]));
  T('D3  …and shows its own empty look again', /No items match your filters/.test(aBack.browse.text) && /want\/upgrade list is empty/.test(aBack.upgrade.text) && /No items listed for sale/.test(aBack.forsale.text) && /No sold items yet/.test(aBack.sold.text) && /No parts on your list yet/.test(aBack.parts.text),
    Object.keys(aBack).map(k => [k, aBack[k].text.replace(/\s+/g, ' ').slice(-90)]));
  T('E0  no page errors on the walk', aErrs.length === 0, aErrs);
  await pg.close();

  // Cancel in the middle, on For Sale: the page on screen draws itself again at once
  ({ pg, errs } = await openApp(browser, { w: 1568, h: 900, withData: false }));
  await standInDrive(pg, []);
  await walkTour(pg, 'For Sale', true);
  const cancel = await pg.evaluate(async () => {
    const before = document.querySelectorAll('#page-forsale [data-rr-sample]').length;
    document.getElementById('gt-cancel').click();
    await new Promise(r => setTimeout(r, 300));
    return { before, left: document.querySelectorAll('[data-rr-sample]').length, page: (document.querySelector('.page.active') || {}).id, text: document.getElementById('page-forsale').textContent.replace(/\s+/g, ' ') };
  });
  await pg.close();
  T('D4  Cancel on the For Sale card: the three samples that were there are gone at once, and the page shows "No items listed for sale"', cancel.before >= 3 && cancel.left === 0 && cancel.page === 'page-forsale' && /No items listed for sale/.test(cancel.text), { before: cancel.before, left: cancel.left, page: cancel.page });

  // ═══ B · a phone ═════════════════════════════════════════════════════════
  console.log('\n== B · the same on a phone (390x844, the card layouts) ==');
  ({ pg, errs } = await openApp(browser, { w: 390, h: 844, withData: false }));
  await standInDrive(pg, []);
  await pg.evaluate(WATCH);
  const B = await walkWithProbes(pg);
  const bEnd = await afterTour(pg);
  await pg.close();
  ['My Collection', 'Want / Upgrade', 'For Sale', 'Parts Needed', 'Sold Items', 'The Photo Inbox'].forEach(t => {
    const p = B[t];
    T('B1  phone · ' + t + ': three tagged, inert samples', p && p.n === 3 && p.tagged && p.inert, p && { n: p.n, tagged: p.tagged, inert: p.inert });
  });
  T('B2  phone: nothing left after the tour', bEnd.left === 0 && bEnd.on === false, bEnd);
  T('B3  phone: never saved either — no sample in any write, no photo look-up, no Parts tab, every list unchanged',
    bEnd.rec.ls.length === 0 && bEnd.rec.idb.length === 0 && bEnd.rec.writes.length === 0 && bEnd.rec.photo.length === 0 && bEnd.rec.parts === 0 && bEnd.same, bEnd.rec);

  console.log('\n== PLANTED · the rules above catch the mistakes they are about ==');
  // P1: a sample that goes into the collector's list (state) — C6 must catch it
  const p1 = planted('config.js', "    if (r) out.push(r);\n", "    if (r) out.push(r);\n    if (r && page === 'forsale' && typeof state !== 'undefined') state.forSaleData[r.inventoryId] = r;\n");
  if (p1) {
    ({ pg, errs } = await openApp(browser, { w: 1568, h: 900, withData: false, files: p1 }));
    await standInDrive(pg, []); await pg.evaluate(WATCH);
    await walkTour(pg, 'For Sale', true);
    const r = await pg.evaluate(() => ({ same: window.__lists() === window.__before }));
    await pg.close();
    T('PLANTED P1: samples written into the For Sale list are caught (state changed)', r.same === false, r);
  }
  // P2: an engine that never switches them off — D must catch the leftovers
  const p2 = planted('tutorial.js', "  try { if (typeof rrSamplesOn === 'function') rrSamplesOn(false); } catch (e) {}\n}", "}");
  if (p2) {
    ({ pg, errs } = await openApp(browser, { w: 1568, h: 900, withData: false, files: p2 }));
    await standInDrive(pg, []);
    await walkTour(pg, 'For Sale', true);
    const r = await pg.evaluate(async () => { document.getElementById('gt-cancel').click(); await new Promise(res => setTimeout(res, 300)); return { left: document.querySelectorAll('[data-rr-sample]').length, on: rrSamplesShowing() }; });
    await pg.close();
    T('PLANTED P2: an engine that never turns the samples off leaves them on the page (caught)', r.left > 0 && r.on === true, r);
  }
  // P7: the Parts page fetching (and making the tab) under a guide — C5 must catch it
  const p7 = planted('app-pages.js', "if (window._offlineMode || (typeof rrGuideOnScreen === 'function' && rrGuideOnScreen())) { _renderPartsList(); return; }", "if (window._offlineMode) { _renderPartsList(); return; }");
  if (p7) {
    ({ pg, errs } = await openApp(browser, { w: 1568, h: 900, withData: false, files: p7 }));
    await standInDrive(pg, []); await pg.evaluate(WATCH);
    await walkTour(pg, 'Parts Needed', true);
    await pg.waitForTimeout(200);
    const r = await pg.evaluate(() => window.__rec.parts);
    await pg.close();
    T('PLANTED P7: a Parts card that refreshes from the sheet (and makes the tab) is caught', r > 0, r);
  }

  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
