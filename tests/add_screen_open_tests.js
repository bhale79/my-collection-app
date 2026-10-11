#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THE ADD SCREEN OPENS AT THE TOP, FILTERS ON ONE LINE — v0.9.1926
//
// Brad (2026-10-11): "i have to scroll up to the beginning every time for some
// reason when you first click add" and "lets scale down the filters so we fit
// all the filters onto 1 line" (Item Type keeps its own row).
// Cause of the first: the phone-keyboard guard in wizard.js scrolls a focused
// field to the top of the window — and computers have window.visualViewport
// too, so the item-number box's own auto-focus scrolled the filters away.
// Boots the REAL app (app/index.html from disk, real Chromium) and opens Add
// to My Collection at Brad's screen sizes.
//   O1  opens with the window at the very top, cursor in the item-number box
//   O2  Manufacturer / Era / Type / Scale / Clear filters share ONE row
//   O3  the labels do not run into each other; Era shows "Postwar" whole
//   O4  a phone keeps wrapping (too narrow for one line)
//   O5  PLANTED: the guard without its computer check scrolls the filters away
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  add_screen_open_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const WIZ = fs.readFileSync(path.join(APP, 'wizard.js'), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 900))); cond ? pass++ : fail++; }

async function open(browser, o) {
  const pg = await browser.newPage({ viewport: { width: o.w, height: o.h }, deviceScaleFactor: o.scale || 1, userAgent: o.ua });
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    if (o.wiz && u.split('?')[0].endsWith('/app/wizard.js')) return r.fulfill({ body: o.wiz, contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(900);
  await pg.evaluate(() => {
    const mk = (n, t) => ({ itemNum: n, variation: '1', itemType: t, description: t, _era: 'pw', _tab: 'Lionel PW - Items', manufacturer: 'Lionel', roadName: 'Santa Fe', gauge: 'O', yearProd: '1955', varDesc: '' });
    state.masterData = [mk('6014-85', 'Boxcar'), mk('2343', 'Diesel Locomotive'), mk('6017', 'Caboose')];
    _rebuildMasterIndex(); state.masterByItemAll = state.masterByItem; state.masterAllRows = state.masterData.slice(); window._allIdxComplete = true;
    state.personalData = {}; state.personalSheetId = 'SID'; accessToken = 'tok';
    localStorage.setItem('lv_add_mfr', 'Lionel'); localStorage.setItem('lv_add_era', 'postwar'); localStorage.setItem('lv_add_scale', 'O');
    window.fetch = async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => '{}' });
    try { _aiUsageMarkSeen(); } catch (e) {}
    startWizardFor('collection');
  });
  await pg.waitForTimeout(1000);
  const out = await pg.evaluate(() => {
    const body = document.getElementById('wizard-body');
    const ids = ['wiz-search-mfr', 'wiz-search-era', 'wiz-search-type', 'wiz-search-scale'];
    const boxes = ids.map(id => { const e = document.getElementById(id); if (!e) return null; const box = (e.parentNode.querySelector('.road-ty-input') || e); const r = box.getBoundingClientRect(); return { top: Math.round(r.top), left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width), visible: r.width > 0 }; });
    const clr = Array.from(document.querySelectorAll('#wizard-body button')).find(b => b.textContent.trim() === 'Clear filters');
    const cr = clr ? clr.getBoundingClientRect() : null;
    const labels = ids.map(id => { const e = document.getElementById(id); const l = e && e.parentNode.firstElementChild; if (!l) return null; const rg = document.createRange(); rg.selectNodeContents(l); const r = rg.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right) }; });
    const era = document.getElementById('wiz-search-era');
    // does "Postwar" fit? measure the text against the box less its padding + arrow
    let eraFits = null;
    if (era) { const cs = getComputedStyle(era); const c = document.createElement('canvas').getContext('2d'); c.font = cs.fontSize + ' ' + cs.fontFamily; const tw = c.measureText(era.options[era.selectedIndex].text).width; eraFits = { text: era.options[era.selectedIndex].text, tw: Math.round(tw), room: Math.round(era.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 16) }; }
    return { scrollTop: body ? body.scrollTop : -1, focused: document.activeElement && document.activeElement.id, boxes, clear: cr ? { top: Math.round(cr.top), right: Math.round(cr.right) } : null, labels, eraFits, bodyRight: body ? Math.round(body.getBoundingClientRect().right) : 0, mobile: !!window.IS_MOBILE_UA };
  });
  await pg.close();
  return out;
}

(async () => {
  const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
  try {
    for (const sz of [{ name: 'Brad 1920×1032 at 125%', w: 1536, h: 826, scale: 1.25 }, { name: '1920×1080', w: 1920, h: 1080 }, { name: '1280×720', w: 1280, h: 720 }]) {
      const r = await open(browser, sz);
      T('O1 ' + sz.name + ': opens at the very top, cursor in the item-number box', r.scrollTop === 0 && r.focused === 'wiz-input', { scrollTop: r.scrollTop, focused: r.focused });
      const vis = r.boxes.filter(b => b && b.visible);
      const tops = vis.map(b => b.top).concat(r.clear ? [r.clear.top] : []);
      T('O2 ' + sz.name + ': all filters + Clear on ONE row', vis.length >= 3 && r.clear && Math.max(...tops) - Math.min(...tops) <= 6, { tops, n: vis.length });
      const ls = r.labels.filter(l => l && l.right > 0);
      const overlap = ls.some((l, i) => i > 0 && ls[i - 1].right > l.left - 2);
      T('O3 ' + sz.name + ': labels do not run into each other', !overlap, ls);
      T('O3 ' + sz.name + ': Era shows "' + (r.eraFits && r.eraFits.text) + '" whole', r.eraFits && r.eraFits.tw <= r.eraFits.room, r.eraFits);
    }
    // a phone: narrow, wraps
    const ph = await open(browser, { w: 390, h: 800, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
    const ptops = ph.boxes.filter(b => b && b.visible).map(b => b.top);
    T('O4 a phone keeps wrapping (two or more rows)', ph.mobile && new Set(ptops).size >= 2, { mobile: ph.mobile, ptops });
    // PLANTED: the focus guard without its computer check
    const planted = WIZ.replace("      if (!window.IS_MOBILE_UA) return;\n", '');
    if (planted === WIZ) throw new Error('could not plant');
    const pr = await open(browser, { w: 1536, h: 826, scale: 1.25, wiz: planted });
    T('O5 PLANTED: without the computer check the window opens scrolled down', pr.scrollTop > 0, pr.scrollTop);
  } finally { await browser.close(); }
  console.log('\nadd_screen_open_tests: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + e.stack); process.exit(1); });
