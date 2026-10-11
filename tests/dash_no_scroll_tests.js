#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THE DASHBOARD FITS BRAD'S SCREEN WITHOUT A SCROLL BAR — v0.9.1931
//
// Brad (2026-10-11): "why is there a scroll bar again. do whatever to get rid
// of the scoll on my large screen, i guess we have to keep it for the smaller
// screens". Measured live on his screen: the page ran ~150px past the window —
// the big cards' 260px minimum, the "Add a stat card" row, the speed-arrow row
// under the photo strip, and a fit that left 16px where the page needs 24.
// Boots the REAL app (app/index.html from disk, real Chromium) with a filled
// dashboard — stat cards, the photo strip with real-height tiles, the four big
// cards with rows in them — at Brad's window and others:
//   S1  1920×1080 at 125% (window 1536×738): NO scroll bar
//   S2  1920×1080 at 100% (1920×938) and 2560×1440 at 125% (2048×1090): none
//   S3  every big card is the same height and nothing in one is cut in half
//   S4  the speed arrows sit to the RIGHT of the photos, not under them
//   S5  a small window (1280×560) still scrolls — Brad: keep it there
//   S6  PLANTED: the old 260px card minimum brings the scroll bar back at S1
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  dash_no_scroll_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const CSS = fs.readFileSync(path.join(APP, 'app.css'), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 900))); cond ? pass++ : fail++; }

async function measure(browser, o) {
  const pg = await browser.newPage({ viewport: { width: o.w, height: o.h } });
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    if (o.css && u.split('?')[0].endsWith('/app/app.css')) return r.fulfill({ body: o.css, contentType: 'text/css' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(900);
  const out = await pg.evaluate(async () => {
    state.user = { email: 'tester@example.com', name: 'Tester' };
    // the signed-in app shell (the sign-in screen is what a fresh page shows)
    ['beta-gate', 'auth-screen', 'setup-screen'].forEach(id => { const e = document.getElementById(id); if (e) e.style.display = 'none'; });
    document.getElementById('app').classList.add('active');
    const pd = {};
    for (let i = 0; i < 40; i++) pd['k' + i] = { itemNum: String(6000 + i), inventoryId: String(i + 1), owned: true, priceItem: String(20 + i), userEstWorth: String(40 + i), manufacturer: i % 3 ? 'Lionel' : 'MTH', roadName: 'Santa Fe', itemType: 'Boxcar', datePurchased: '2026-10-0' + (1 + i % 9) };
    state.personalData = pd;
    state.wantData = {}; for (let i = 0; i < 6; i++) state.wantData['w' + i] = { itemNum: String(700 + i), priority: 'High', expectedPrice: '100', description: 'Steam Locomotive' };
    state.forSaleData = state.forSaleData || {}; state.soldData = state.soldData || {};
    try { _prefSet('lv_dash_ticker', '1'); } catch (e) {}
    // Brad's own stat cards, from his screenshot: Collection Value, Activity, From My Collection
    window._getSlots = function () { return [{ id: 'value' }, { id: 'activity' }, { id: 'photoReel' }, null, null, null]; };
    window._tickerFill = async function () {   // the strip, with photo-height tiles (Drive is not reachable here)
      const t = document.getElementById('rr-ticker-track'); if (!t) return;
      t.innerHTML = Array.from({ length: 12 }, (_, i) => '<div data-tk="' + i + '" style="display:inline-block;width:130px;height:86px;margin-right:8px;background:#8fa2b5;border-radius:6px"></div>').join('');
    };
    try { showPage('dashboard'); } catch (e) {}
    buildDashboard();
    await new Promise(r => setTimeout(r, 900));
    if (window._dashFitPanelsNow) window._dashFitPanelsNow();
    await new Promise(r => setTimeout(r, 300));
    const main = document.querySelector('.main');
    const host = document.getElementById('dash-panels-host');
    const panels = Array.from(host.querySelectorAll('.panel')).filter(p => p.offsetParent).map(p => Math.round(p.getBoundingClientRect().height));
    // anything in a big card cut by its bottom edge?
    let cut = 0;
    host.querySelectorAll('[id^="dash-panel-body-"]').forEach(b => {
      const lim = b.getBoundingClientRect().bottom + 0.5;
      b.querySelectorAll('*').forEach(el => { const r = el.getBoundingClientRect(); if (r.height > 0 && el.offsetParent && r.top < lim && r.bottom > lim + 1 && !el.contains(b)) cut++; });
    });
    const strip = document.querySelector('.rr-ticker-wrap'), speed = document.getElementById('rr-ticker-speedbox');
    const sb = strip && strip.getBoundingClientRect(), pb = speed && speed.getBoundingClientRect();
    const de = document.documentElement;
    return { scrollH: main.scrollHeight, clientH: main.clientHeight, docH: de.scrollHeight, winH: innerHeight, docW: de.scrollWidth, winW: de.clientWidth, mainW: [main.scrollWidth, main.clientWidth], panels, cut,
             speedRight: !!(sb && pb && pb.left >= sb.right - 1 && pb.top < sb.bottom && pb.bottom > sb.top),
             tiles: document.querySelectorAll('#rr-ticker-track [data-tk]').length, rows: host.querySelectorAll('[id^="dash-panel-body-"] *').length };
  });
  await pg.close();
  return out;
}

(async () => {
  const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
  try {
    const brad = await measure(browser, { w: 1536, h: 738 });
    T('S1 Brad\'s screen (1920×1080 at 125%, window 1536×738): NO scroll bar on the dashboard', brad.tiles > 0 && brad.panels.length >= 3 && brad.scrollH <= brad.clientH, brad);
    T('S1 …and none on the page around it (the browser\'s own 8px margin is gone)', brad.docH <= brad.winH, { docH: brad.docH, winH: brad.winH });
    T('S1 …and nothing scrolls sideways', brad.docW <= brad.winW && brad.mainW[0] <= brad.mainW[1], { doc: [brad.docW, brad.winW], main: brad.mainW });
    T('S3 …every big card is the same height', brad.panels.length >= 3 && new Set(brad.panels).size === 1, brad.panels);
    T('S3 …and nothing in one is cut in half', brad.cut === 0, brad.cut);
    T('S4 the speed arrows sit to the RIGHT of the photos', brad.speedRight, brad);
    for (const s of [{ n: '1920×1080 at 100%', w: 1920, h: 938 }, { n: '2560×1440 at 125%', w: 2048, h: 1090 }]) {
      const m = await measure(browser, s);
      T('S2 ' + s.n + ': no scroll bar', m.scrollH <= m.clientH, m);
    }
    const small = await measure(browser, { w: 1280, h: 560 });
    T('S5 a small window (1280×560) still scrolls', small.scrollH > small.clientH, small);
    const planted = CSS.replace('#dash-panels-host { --dash-panel-min-h: 160px; }', '#dash-panels-host { --dash-panel-min-h: 260px; }');
    if (planted === CSS) throw new Error('could not plant');
    const old = await measure(browser, { w: 1536, h: 738, css: planted });
    T('S6 PLANTED: the old 260px minimum brings the scroll bar back on Brad\'s screen', old.scrollH > old.clientH, old);
  } finally { await browser.close(); }
  console.log('\ndash_no_scroll_tests: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + e.stack); process.exit(1); });
