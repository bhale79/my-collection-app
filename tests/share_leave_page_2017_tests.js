#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// LEAVING THE PAGE ENDS A SHARE SELECTION — v0.9.2017       (real Chromium)
//
// [stated] Brad, 2026-10-23: "when you click share, you can click back to
// dashboard or click another page like sales list and it doesn't cancel the
// share so it just stays up at the bottom" → "go". Only Cancel or a finished
// share ended it. Now showPage (app.js, the one door every page change goes
// through) calls rrShareLeavePage (share.js); the page a selection belongs to
// is ONE map, SHARE_HOME_PAGE.
//
//   L1  My Collection → Dashboard (side menu): the bar goes, selection off
//   L2  For Sale → My Collection: gone, and My Collection draws no checkboxes
//   L3  My Collection → Master Catalog (same page, the list stops being yours)
//   L4  Want/Upgrade → the phone's Back (_rrGoBackTo) to the Dashboard: gone
//   K1  staying on My Collection (a redraw, the My Collection button again):
//       the selection and the picked item stay
//   K2  the For Sale card's "share this one" still opens the Share window
//   K3  Cancel still ends it the old way
//   X*  PLANTED: the hook taken out of showPage → L1 stays up (caught)
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  share_leave_page_2017_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const APPJS = fs.readFileSync(path.join(APP, 'app.js'), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 600))); cond ? pass++ : fail++; }
function planted(src, from, to, what) {
  if (src.indexOf(from) < 0) throw new Error('planted ' + what + ': the line moved; update this test');
  return src.replace(from, to);
}

async function run(browser, files) {
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => { const u = r.request().url(), base = u.split('?')[0];
    for (const f of Object.keys(files || {})) if (base.endsWith('/app/' + f)) return r.fulfill({ body: files[f], contentType: 'application/javascript' });
    return u.startsWith('file://') ? r.continue() : r.abort(); });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1000);
  const out = await pg.evaluate(async () => {
    const wait = ms => new Promise(z => setTimeout(z, ms));
    state.user = { email: 'bhale@ipd-llc.com', name: 'Brad' };
    state.masterData = [{ itemNum: '2343', roadName: 'Santa Fe', itemType: 'Diesel', variation: '' },
                        { itemNum: '6464-1', roadName: 'Western Pacific', itemType: 'Boxcar', variation: '' }];
    try { _rebuildMasterIndex(); } catch (e) {}
    state.personalData = {
      '101': { inventoryId: '101', itemNum: '2343', variation: '', owned: true, condition: 8, row: 2 },
      '102': { inventoryId: '102', itemNum: '6464-1', variation: '', owned: true, condition: 7, row: 3 },
    };
    state.forSaleData = { '102': { inventoryId: '102', itemNum: '6464-1', variation: '', askingPrice: '75', row: 2 } };
    state.upgradeData = {}; state.wantData = {}; state.soldData = {};
    ['auth-screen', 'beta-gate'].forEach(id => { const e = document.getElementById(id); if (e) e.style.display = 'none'; });
    document.getElementById('app').classList.add('active');
    const bar = () => !!document.getElementById('share-bottom-bar');
    const boxes = () => document.querySelectorAll('#page-browse [id^="share-cb-"]').length;
    const nav = sel => { const b = document.querySelector('.nav-item[onclick*="' + sel + '"]'); if (!b) throw new Error('no nav ' + sel); b.click(); };
    const page = () => ((document.querySelector('.page.active') || {}).id || '');
    const myColl = async () => { nav("filterOwned"); await wait(400); };
    const r = {};

    // L1
    await myColl(); startShareMode('collection'); await wait(300);
    r.L1start = { bar: bar(), boxes: boxes(), on: isShareMode('collection') };
    nav("'dashboard'"); await wait(400);
    r.L1 = { page: page(), bar: bar(), on: isShareMode('collection') };

    // L2
    nav("'forsale'"); await wait(400); startShareMode('forsale'); await wait(300);
    r.L2start = { bar: bar(), on: isShareMode('forsale') };
    await myColl();
    r.L2 = { page: page(), bar: bar(), on: isShareMode('forsale') || isShareMode('collection'), boxes: boxes() };

    // L3
    startShareMode('collection'); await wait(300);
    r.L3start = { bar: bar(), boxes: boxes() };
    nav("resetFilters"); await wait(400);
    r.L3 = { page: page(), owned: !!state.filters.owned, bar: bar(), on: isShareMode('collection'), boxes: boxes() };

    // L4
    nav("'upgrade'"); await wait(400); startShareMode('upgrade'); await wait(300);
    r.L4start = { bar: bar(), on: isShareMode('upgrade') };
    _rrGoBackTo('dashboard'); await wait(400);
    r.L4 = { page: page(), bar: bar(), on: isShareMode('upgrade') };

    // K1
    await myColl(); startShareMode('collection'); await wait(300);
    const k = Object.keys(window._shareDataMap || {})[0];
    if (k) toggleShareItem(k);
    renderBrowse(); await wait(200);
    await myColl();
    r.K1 = { bar: bar(), on: isShareMode('collection'), picked: k ? !!document.getElementById('share-cb-' + k) && document.getElementById('share-cb-' + k).checked : null, key: k };

    // K3
    cancelShareMode(); await wait(200);
    r.K3 = { bar: bar(), on: isShareMode('collection'), boxes: boxes() };

    // K2
    nav("'forsale'"); await wait(400);
    _fsShareOne('102'); await wait(400);
    r.K2 = { builder: !!document.getElementById('share-builder-modal'), on: isShareMode('forsale') };
    const m = document.getElementById('share-builder-modal'); if (m) m.remove();
    return r;
  });
  await pg.close();
  return Object.assign(out, { errs });
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const r = await run(browser);
  console.log('== L · leaving ends it ==');
  T('L1 setup: My Collection share shows the bar and checkboxes', r.L1start.bar && r.L1start.boxes > 0 && r.L1start.on, r.L1start);
  T('L1 → Dashboard (side menu): bar gone, selection off', /dashboard/.test(r.L1.page) && !r.L1.bar && !r.L1.on, r.L1);
  T('L2 setup: For Sale share is on', r.L2start.bar && r.L2start.on, r.L2start);
  T('L2 → My Collection: gone, and My Collection draws no checkboxes', /browse/.test(r.L2.page) && !r.L2.bar && !r.L2.on && r.L2.boxes === 0, r.L2);
  T('L3 setup: My Collection share again', r.L3start.bar && r.L3start.boxes > 0, r.L3start);
  T('L3 → Master Catalog (same page, not yours any more): gone, no checkboxes', !r.L3.owned && !r.L3.bar && !r.L3.on && r.L3.boxes === 0, r.L3);
  T('L4 setup: Want/Upgrade share is on', r.L4start.bar && r.L4start.on, r.L4start);
  T('L4 → the phone\'s Back to the Dashboard: gone', /dashboard/.test(r.L4.page) && !r.L4.bar && !r.L4.on, r.L4);
  console.log('== K · what stays the same ==');
  T('K1 staying on My Collection (a redraw, the button again): still on, the picked item still ticked', r.K1.bar && r.K1.on && r.K1.picked === true, r.K1);
  T('K3 Cancel still ends it', !r.K3.bar && !r.K3.on && r.K3.boxes === 0, r.K3);
  T('K2 the For Sale card\'s "share this one" still opens the Share window', r.K2.builder && r.K2.on, r.K2);
  T('page errors', r.errs.length === 0, r.errs);

  console.log('== X · planted ==');
  const NOHOOK = planted(APPJS, "  try { if (typeof rrShareLeavePage === 'function') rrShareLeavePage(name); } catch (eSh) {}\n", '', 'hook');
  const x = await run(browser, { 'app.js': NOHOOK });
  T('X-L1 PLANTED: the hook taken out of showPage → the bar stays up on the Dashboard (caught)', x.L1.bar === true, x.L1);

  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
