#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// TOUR SAMPLE ROWS — v0.9.1871   (real Chromium, the REAL app, no stubs but Drive)
//
// The second half of the tour-sample rules (Brad's tour item 11 — "drawn by
// each page's own row code so they look exactly like real rows"); the first
// half is tests/tour_samples_tests.js.
//   E · a page that has the collector's own rows shows only those;
//   F · DRAWN BY THE REAL CODE: each page's sample row has exactly the shape
//       of a real row of the same record drawn as a real row (computer + phone,
//       every page, the Photo Inbox tile too) — a copy of a row could not keep up;
//   G · My Collection's "nothing changed" check knows the samples;
//   H · ONE definition (config.js), the photos kept for offline, only the tour.
// Each rule has a PLANTED version of the mistake, served in place of the real
// file, to prove the pin can fail.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  tour_samples_rows_tests needs playwright and it is not installed.'); process.exit(1); }
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

  // ═══ E · pages with the collector's own rows show only those ══════════════
  console.log('\n== E · a page with rows of its own shows no samples (one owned item + one for sale) ==');
  ({ pg, errs } = await openApp(browser, { w: 1568, h: 900, withData: true }));
  await standInDrive(pg, []);
  await pg.evaluate(() => { state.forSaleData = { '1': { itemNum: '6457', variation: '2', inventoryId: '1', askingPrice: '40', condition: '7', row: 3, manufacturer: 'Lionel' } }; });
  const E = await walkWithProbes(pg, 'The Photo Inbox');
  const eOwn = await pg.evaluate(() => ({ fsRows: document.querySelectorAll('#forsale-tbody tr').length }));
  await pg.close();
  T('E1  My Collection (one item owned) shows no samples', E['My Collection'] && E['My Collection'].n === 0, E['My Collection']);
  T('E2  For Sale (one listed) shows no samples — just its own row', E['For Sale'] && E['For Sale'].n === 0 && eOwn.fsRows === 1, [E['For Sale'], eOwn]);
  T('E3  …and its card does not claim any', E['For Sale'] && !ROWS_NOTE.test(E['For Sale'].body), E['For Sale'] && E['For Sale'].body.slice(-120));
  T('E4  the pages that ARE empty still show theirs (Want / Upgrade, Parts, Sold, Photo Inbox)', ['Want / Upgrade', 'Parts Needed', 'Sold Items', 'The Photo Inbox'].every(t => E[t] && E[t].n === 3), ['Want / Upgrade', 'Parts Needed', 'Sold Items', 'The Photo Inbox'].map(t => [t, E[t] && E[t].n]));

  // ═══ F · drawn by the real row code ══════════════════════════════════════
  console.log('\n== F · a sample row has exactly the shape of a real row of the same record (desktop + phone) ==');
  async function shapes(w, h) {
    const r = await openApp(browser, { w, h, withData: false });
    const p = r.pg;
    await p.evaluate(SKEL);
    const out = await p.evaluate(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      const res = {};
      // the record a page draws, taken from the samples themselves, put into state as the collector's own
      const own = (page, k) => { rrSamplesOn(true); const rec = rrSampleRows(page, 0)[k]; rrSamplesOn(false); delete rec._rrSample; if (rec._copyPd) delete rec._copyPd._rrSample; return rec; };
      const last = sel => { const all = Array.from(document.querySelectorAll(sel)).filter(n => n.getClientRects().length > 0); return all[all.length - 1] || null; };
      // the k-th sample row on screen against the collector's own row of the same record
      const pair = async (page, k, put, draw, sel) => {
        put(); rrSamplesOn(false); draw(); await wait(60);
        const real = __skel(last(sel));
        put(true); rrSamplesOn(true); draw(); await wait(60);
        const sampleEl = Array.from(document.querySelectorAll(sel)).filter(n => n.getAttribute('data-rr-sample') && n.getClientRects().length > 0)[k];
        const sample = __skel(sampleEl);
        rrSamplesOn(false);
        res[page] = { same: !!real && real === sample, real: real.slice(0, 160), sample: sample.slice(0, 160) };
      };
      const fsRec = own('forsale', 2), sdRec = own('sold', 2), wuRec = own('want', 0), ugRec = own('want', 2), ptRec = own('parts', 2), cRec = own('collection', 2);
      showPage('forsale');
      await pair('forsale', 2, clear => { state.forSaleData = clear ? {} : { [fsRec.inventoryId]: fsRec }; }, () => buildForSalePage(), window.innerWidth <= 640 ? '#forsale-cards > div' : '#forsale-tbody > tr');
      showPage('sold');
      await pair('sold', 2, clear => { state.soldData = clear ? {} : { [sdRec.key]: Object.assign({}, sdRec) }; }, () => buildSoldPage(), window.innerWidth <= 640 ? '#sold-cards > div' : '#sold-tbody > tr');
      showPage('upgrade');
      await pair('want', 0, clear => { state.wantData = clear ? {} : { [wuRec.itemNum + '|' + wuRec.variation]: wuRec }; }, () => buildUpgradePage(), window.innerWidth <= 640 ? '#upgrade-cards > div' : '#upgrade-tbody > tr');
      await pair('upgrade', 2, clear => { state.wantData = {}; state.upgradeData = clear ? {} : { [ugRec.inventoryId]: ugRec }; }, () => buildUpgradePage(), window.innerWidth <= 640 ? '#upgrade-cards > div' : '#upgrade-tbody > tr');
      showPage('parts');
      await wait(400);   // showPage's own build of this page reads the sheet first (no guide is up here) — let it land before drawing
      await pair('parts', 2, clear => { state.partsData = clear ? {} : { p9: ptRec }; }, () => _renderPartsList(), '#parts-list > div');
      // My Collection: the catalog row the sample stands for, and the collector's own copy of it
      const m = Object.assign({}, cRec); delete m._copyPd;
      if (!state.masterData.some(x => x.itemNum === m.itemNum && x.variation === m.variation)) { state.masterData.push(m); _rebuildMasterIndex(); }
      const pd = Object.assign({}, cRec._copyPd, { inventoryId: 'own-1', row: 4 });
      showPage('browse'); filterOwned();
      await pair('collection', 2, clear => { state.personalData = clear ? {} : { 'own-1': pd }; if (typeof bumpDataRev === 'function') bumpDataRev(); window._rrDataRev = (window._rrDataRev || 0) + 1; }, () => renderBrowse(), window.innerWidth <= 640 ? '#browse-cards > .browse-card' : '#browse-tbody > tr');
      return res;
    });
    await p.close();
    return out;
  }
  const desk = await shapes(1568, 900), phone = await shapes(390, 844);
  Object.keys(desk).forEach(k => T('F1  computer · ' + k + ': the sample row and a real row of the same record have the same shape', desk[k].same, desk[k]));
  Object.keys(phone).forEach(k => T('F2  phone · ' + k + ': the same', phone[k].same, phone[k]));
  // the Photo Inbox: a real waiting photo (one file in the listing) against a sample photo
  async function inboxShapes(files) {
    const r = await openApp(browser, { w: 1568, h: 900, withData: false });
    await standInDrive(r.pg, files);
    await r.pg.evaluate(SKEL);
    const s = await r.pg.evaluate(async (wantSample) => {
      window.loadDriveThumb = function () { return false; };   // Drive's picture loader is not row code — a failed load would rewrite the tile
      if (wantSample) rrSamplesOn(true);
      _pinGo(document.getElementById('nav-photo-inbox'));
      await new Promise(res => setTimeout(res, 500));
      const t = document.querySelector('#pin-grid .pin-tile');
      return t ? { skel: __skel(t), sample: !!t.getAttribute('data-rr-sample') } : null;
    }, !files.length);
    await r.pg.close();
    return s;
  }
  const realTile = await inboxShapes([{ id: 'F1', name: 'a.jpg', createdTime: new Date().toISOString(), appProperties: {} }]);
  const sampleTile = await inboxShapes([]);
  T('F3  Photo Inbox: a sample photo tile and a real one have the same shape', realTile && sampleTile && !realTile.sample && sampleTile.sample && realTile.skel === sampleTile.skel, [realTile, sampleTile]);

  // ═══ G · My Collection's "nothing changed" check knows the samples ════════
  console.log('\n== G · the signature that keeps My Collection\'s drawing lists the samples among what it is drawn from ==');
  ({ pg, errs } = await openApp(browser, { w: 1568, h: 900, withData: false }));
  const sig = await pg.evaluate(async () => {
    showPage('browse'); filterOwned(); await new Promise(r => setTimeout(r, 100));
    const a = window._rrBrowseSig; rrSamplesOn(true); renderBrowse(); const b = window._rrBrowseSig; rrSamplesOn(false); renderBrowse(); const c = window._rrBrowseSig;
    return { a, b, c, drew: true };
  });
  await pg.close();
  T('G1  switching the samples on and off changes the page\'s signature both times', sig.a && sig.b && sig.c && sig.a !== sig.b && sig.b !== sig.c, sig);

  console.log('\n== PLANTED · the rules above catch the mistakes they are about ==');
  // P3: For Sale without the photo skip — C4 must catch the folder look-up by the sample's number
  const p3 = planted('app-pages.js', "if (!rrIsSample(fs)) _fsThumbJobs.push(", "if (true) _fsThumbJobs.push(");
  if (p3) {
    ({ pg, errs } = await openApp(browser, { w: 1568, h: 900, withData: false, files: p3 }));
    await standInDrive(pg, []); await pg.evaluate(WATCH);
    await walkTour(pg, 'For Sale', true);
    await pg.waitForTimeout(300);
    const r = await pg.evaluate(() => window.__rec.photo.slice(0, 6));
    await pg.close();
    T('PLANTED P3: a sample row that looks for a photo folder by its number is caught', r.length > 0 && r.some(x => /6457|2343|6464/.test(x)), r);
  }
  // P4: samples that ignore the page's own rows — E must catch them on a page that has a row
  const p4 = planted('config.js', "if (!_rrSamplesFlag || realCount > 0) return [];", "if (!_rrSamplesFlag) return [];");
  const p4b = p4 && planted('app-pages.js', "if (!Object.keys(state.forSaleData || {}).length && typeof rrSampleRows === 'function') { const _fsSmp = rrSampleRows('forsale', 0);", "if (typeof rrSampleRows === 'function') { const _fsSmp = rrSampleRows('forsale', Object.keys(state.forSaleData || {}).length);");
  if (p4 && p4b) {
    ({ pg, errs } = await openApp(browser, { w: 1568, h: 900, withData: true, files: Object.assign({}, p4, p4b) }));
    await standInDrive(pg, []);
    await pg.evaluate(() => { state.forSaleData = { '1': { itemNum: '6457', variation: '2', inventoryId: '1', askingPrice: '40', condition: '7', row: 3, manufacturer: 'Lionel' } }; });
    const r = await walkWithProbes(pg, 'For Sale');
    await pg.close();
    T('PLANTED P4: samples drawn over a page that has its own row are caught', r['For Sale'] && r['For Sale'].n > 0, r['For Sale']);
  }
  // P5: a For Sale sample drawn by a separate hand-made template — F must catch the different shape
  const p5 = planted('app-pages.js', "    if (tbody) tbody.innerHTML = fsEntries.length ? fsEntries.map((fs, _fsI) => {\n", "    if (tbody) tbody.innerHTML = fsEntries.length ? fsEntries.map((fs, _fsI) => {\n      if (rrIsSample(fs)) return '<tr data-rr-sample=\"1\" inert><td>' + fs.itemNum + rrSampleTag(fs) + '</td><td>' + fs.askingPrice + '</td></tr>';\n");
  if (p5) {
    ({ pg, errs } = await openApp(browser, { w: 1568, h: 900, withData: false, files: p5 }));
    await pg.evaluate(SKEL);
    const r = await pg.evaluate(async () => {
      rrSamplesOn(true); const rec = rrSampleRows('forsale', 0)[2]; rrSamplesOn(false); delete rec._rrSample;
      showPage('forsale');
      state.forSaleData = { [rec.inventoryId]: rec }; buildForSalePage();
      const real = __skel(document.querySelector('#forsale-tbody > tr'));
      state.forSaleData = {}; rrSamplesOn(true); buildForSalePage();
      const sample = __skel(Array.from(document.querySelectorAll('#forsale-tbody > tr[data-rr-sample]')).pop());
      rrSamplesOn(false);
      return { same: real === sample };
    });
    await pg.close();
    T('PLANTED P5: a sample row drawn by its own template instead of the page\'s row code is caught (different shape)', r.same === false, r);
  }
  // P6: My Collection's signature without the samples term — G must catch it
  const p6 = planted('browse.js', "      (typeof rrSamplesRev === 'function' ? rrSamplesRev() : 0),\n", "      0,\n");
  if (p6) {
    ({ pg, errs } = await openApp(browser, { w: 1568, h: 900, withData: false, files: p6 }));
    const r = await pg.evaluate(async () => { showPage('browse'); filterOwned(); await new Promise(res => setTimeout(res, 100)); const a = window._rrBrowseSig; rrSamplesOn(true); renderBrowse(); const b = window._rrBrowseSig; rrSamplesOn(false); return { a, b }; });
    await pg.close();
    T('PLANTED P6: a signature that does not list the samples stays the same when they switch (caught)', r.a === r.b, r);
  }
  console.log('\n== H · source ==');
  const cfg = SRC('config.js');
  T('H1  ONE definition: the three items live in config.js RR_TOUR_SAMPLES, and no other app file types the sample numbers or photos',
    /var RR_TOUR_SAMPLES = \{/.test(cfg) && fs.readdirSync(H.APP).filter(f => /\.js$/.test(f) && f !== 'config.js' && f !== 'sw.js').every(f => !/img\/sample-|sample-2343|sample-6464|sample-6457|rr-sample-(collection|want|forsale|sold|parts|inbox)/.test(SRC(f))), fs.readdirSync(H.APP).filter(f => /\.js$/.test(f) && f !== 'config.js' && f !== 'sw.js' && /img\/sample-|sample-2343|sample-6464|sample-6457|rr-sample-(collection|want|forsale|sold|parts|inbox)/.test(SRC(f))));
  T('H2  the three photos exist and the service worker keeps them for offline', ['sample-2343.jpg', 'sample-6464-1.jpg', 'sample-6457.jpg'].every(f => fs.existsSync(path.join(H.APP, 'img', f)) && SRC('sw.js').indexOf("'./img/" + f + "'") >= 0), '');
  T('H3  only the tour declares samples (no other guide shows them)', (SRC('tutorial.js').match(/^\s*samples: true,/gm) || []).length === 1, (SRC('tutorial.js').match(/^\s*samples: true,/gm) || []).length);

  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
