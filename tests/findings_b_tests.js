#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════
// AUDIT FIXES B — four-platform audit findings 13 and 14 (2026-11-04 night,
// [stated] Brad 21:32 CT "start the next fix if there is one, then ship it,
// and repeat"). Real Chromium, the REAL app.
//
//   F13 a phone that opens the app and goes straight to the Master Catalog
//       saw an EMPTY white box and NO Filters button (the only way to search
//       on a phone) — the prompt went into the table a phone hides, and the
//       button was only made at the end of a full render this page skips.
//       Now: the prompt (phone words) is in the card list a phone shows, and
//       the Filters button is there. A computer is unchanged.
//   F14 the app's OWN set-up write (the Dashboard tab, a header row) that
//       failed was queued and shown as "A change you made has not reached
//       your Google Sheet" / "1 change has not saved". Now it is not queued
//       (it is written again on the next start) and, offline, it no longer
//       says "saved on this device". A person's own change is unchanged.
// Every fix is planted back (text-replaced in the CURRENT source) and caught.
// ═════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  findings_b_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail))); cond ? pass++ : fail++; }
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');

async function open(browser, viewport, swap) {
  const pg = await browser.newPage(viewport && viewport.isMobile ? { viewport: { width: viewport.width, height: viewport.height }, hasTouch: true, isMobile: true } : { viewport });
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  pg.on('dialog', d => d.dismiss());
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    const name = decodeURIComponent(u.split('?')[0]).split('/').pop();
    if (swap && swap[name] != null) return r.fulfill({ status: 200, contentType: name.endsWith('.css') ? 'text/css' : 'application/javascript', body: swap[name] });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(700);
  await pg.evaluate(() => {
    const mk = (n) => ({ itemNum: n, variation: '1', itemType: 'Boxcar', description: 'x', _era: 'pw', _tab: 'Lionel PW - Items', rowId: 'R' + n, yearProd: '1950', roadName: 'Santa Fe', gauge: 'O', varDesc: '' });
    state.masterData = [mk('6464-1'), mk('2343')]; _rebuildMasterIndex();
    state.personalSheetId = 'SID'; window.accessToken = 'tok'; accessToken = 'tok';
    state.personalData = {}; state.forSaleData = {}; state.soldData = {}; state.wantData = {}; state.upgradeData = {};
    document.getElementById('app').classList.add('active');
  });
  return { pg, errs };
}

// F13: straight to the Master Catalog, the way the phone nav button does it
async function catalogFirst(pg) {
  return pg.evaluate(() => {
    _currentEra = 'all';
    showPage('browse'); resetFilters(); renderBrowse();
    const cards = document.getElementById('browse-cards');
    const tb = document.getElementById('browse-tbody');
    const vis = el => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0;
    const btn = document.getElementById('rr-filter-btn');
    return { phone: rrIsPhone(), cardsShown: vis(cards), cardsText: cards ? cards.innerText : '', tableText: tb ? tb.innerText : '',
             filterBtn: !!btn && vis(btn), tableShown: vis(document.querySelector('.item-table')) };
  });
}
// F14: one set-up write and one person's write, both failing; what does the outbox show?
async function failedWrites(pg, offline) {
  return pg.evaluate(async (offline) => {
    try { localStorage.clear(); } catch (e) {}
    window.__toasts = []; window.showToast = m => window.__toasts.push(String(m));
    window.fetch = async () => ({ ok: false, status: 503, json: async () => ({ error: { code: 503, message: 'The service is currently unavailable.' } }), text: async () => 'unavailable' });
    if (offline) window._offlineMode = true;
    const before = rrOutboxCount();
    let a = '', b = '';
    try { await sheetsSetupUpdate('SID', 'Dashboard!A1:I3', [['=IMAGE("x")', '', '', '', '', 'QUICK TAB BUTTONS', '', '', '']]); } catch (e) { a = e.message; }
    const afterSetup = rrOutboxCount();
    const toastsSetup = window.__toasts.slice();
    try { await sheetsUpdate('SID', 'My Collection!C5', [['8']]); } catch (e) { b = e.message; }
    const afterMine = rrOutboxCount();
    window._offlineMode = false;
    return { before, afterSetup, afterMine, a, b, toastsSetup, badge: (document.getElementById('rr-outbox-badge') || {}).textContent || '' };
  }, !!offline);
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const BR = read('browse.js'), SH = read('sheets.js'), WO = read('write-outbox.js');
  const PHONE = { width: 390, height: 844 }, DESK = { width: 1400, height: 900 };

  // ── F13 ──
  {
    const { pg, errs } = await open(browser, PHONE);
    const r = await catalogFirst(pg);
    T('F13  phone, straight to the Master Catalog: the prompt shows (not an empty box)', r.phone && r.cardsShown && /select a filter to start viewing the catalog/i.test(r.cardsText), r);
    T('F13b …in phone words (the filters are behind the Filters button)', /Tap Filters/.test(r.cardsText) && !/above/.test(r.cardsText), r.cardsText);
    T('F13c …and the Filters button is there, before My Collection was ever opened', r.filterBtn, r);
    T('F13d no page errors', errs.length === 0, errs);
    await pg.close();
  }
  {
    // review 2026-11-05: a phone held sideways (short + touch → rrIsPhone, but too wide for the Filters button)
    const { pg, errs } = await open(browser, { width: 844, height: 390, hasTouch: true, isMobile: true });
    const r = await catalogFirst(pg);
    T('F13g phone sideways: the prompt shows, and never says "Tap Filters" when there is no Filters button', r.cardsShown && /select a filter/i.test(r.cardsText) && (r.filterBtn || !/Tap Filters/.test(r.cardsText)), r);
    T('F13h no page errors', errs.length === 0, errs);
    await pg.close();
  }
  {
    const { pg, errs } = await open(browser, DESK);
    const r = await catalogFirst(pg);
    T('F13e computer unchanged: the prompt in the table, the card list hidden, no phone Filters button',
      !r.phone && r.tableShown && /Pick an era, manufacturer, or scale above/.test(r.tableText) && !r.cardsShown && !r.filterBtn, r);
    T('F13f no page errors', errs.length === 0, errs);
    await pg.close();
  }
  // ── F14 ──
  {
    const { pg, errs } = await open(browser, DESK);
    const r = await failedWrites(pg, false);
    T('F14  a failed set-up write (the Dashboard tab) is NOT queued as the person\'s change', r.before === 0 && r.afterSetup === 0 && !!r.a, r);
    T('F14b a failed change the PERSON made is still kept and counted (unchanged)', r.afterMine === 1 && !!r.b, r);
    const o = await failedWrites(pg, true);
    T('F14c offline: the set-up write says nothing about "saved on this device", and is not kept', o.afterSetup === 0 && !o.toastsSetup.some(t => /saved on this device/.test(t)), o);
    T('F14d offline: the person\'s change is still kept', o.afterMine === 1, o);
    T('F14e no page errors', errs.length === 0, errs);
    await pg.close();
  }

  // ── PLANTED ──
  {
    const a = "    try { if (typeof _rrFilterBtnSync === 'function') _rrFilterBtnSync(); } catch (eFb) {}";
    T('P-F13 anchor present (once)', BR.split(a).length === 2);
    const { pg } = await open(browser, PHONE, { 'browse.js': BR.replace(a, '') });
    const r = await catalogFirst(pg);
    T('P-F13 PLANTED no Filters button on the early return → F13c would fail', !r.filterBtn, r);
    await pg.close();
  }
  {
    const a = "    if (_gcards && typeof rrIsPhone === 'function') _gcards.style.display = rrIsPhone() ? 'flex' : 'none';";
    T('P-F13b anchor present (once)', BR.split(a).length === 2);
    const { pg } = await open(browser, PHONE, { 'browse.js': BR.replace(a, '') });
    const r = await catalogFirst(pg);
    T('P-F13b PLANTED the card list left hidden → F13 would fail (the empty box)', !r.cardsShown, r);
    await pg.close();
  }
  {
    const a = "  if (opts && opts.setup) _args.setup = true;";
    T('P-F14 anchor present (once)', SH.split(a).length === 2);
    const { pg } = await open(browser, DESK, { 'sheets.js': SH.replace(a, '') });
    const r = await failedWrites(pg, false);
    T('P-F14 PLANTED the set-up mark dropped → F14 would fail (it is queued)', r.afterSetup === 1, r);
    await pg.close();
  }
  {
    const a = "      if (args && args.setup) {";
    T('P-F14b anchor present (once)', WO.split(a).length === 2);
    const { pg } = await open(browser, DESK, { 'write-outbox.js': WO.replace(a, '      if (false) {') });
    const r = await failedWrites(pg, false);
    T('P-F14b PLANTED the outbox keeping set-up writes → F14 would fail', r.afterSetup === 1, r);
    await pg.close();
  }

  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  crashed: ' + (e && e.stack || e)); process.exit(1); });
