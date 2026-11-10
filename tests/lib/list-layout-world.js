// ══ tests/lib/list-layout-world.js ════════════════════════════════════════
// The shared world of the R7 list-layout suites (listlayout_tests.js — the
// layout at six window sizes; listlayout_sheet_tests.js — the ⋯ sheet, the ☰
// menu, the edges and the planted offenders). One copy, so the two suites test
// the same app. Split 2026-11-08 to keep each real-Chromium suite near a minute.
'use strict';
const fs = require('fs'), path = require('path');
const APP = path.join(__dirname, '..', '..', 'app');
const { SEED } = require('./guide-fixture');
let pw;
try { pw = require('playwright'); } catch (e) { pw = null; }
// ── L / M / C / P ── the real app

const SCENE = `
(function () {
  const W = (n, extra) => Object.assign({ itemNum: n, variation: '1', row: 2, priority: 'High', expectedPrice: '700', manufacturer: 'Lionel', targetCondition: '8', notes: '' }, extra || {});
  // a long note and a long description, so a column that cannot shrink shows
  state.wantData = { a: W('6464-275', { notes: 'Turn of the century orange with the heat-stamped lettering, bought at York' }),
                     b: W('3376', { variation: '2', priority: 'Medium' }), c: W('2333', { priority: 'Low', row: 4 }),
                     e: W('773', { row: 5 }), t: W('773W', { row: 6 }) };   // an engine + its tender, wanted together → ONE row
  const inv = Object.values(state.personalData).find(p => p.itemNum === '773').inventoryId;
  state.upgradeData = { [inv]: Object.assign(W('773'), { inventoryId: inv, maxPrice: '900', row: 2 }) };
  state.forSaleData = { fs1: { itemNum: '6464-275', variation: '1', inventoryId: Object.values(state.personalData).find(p => p.itemNum === '6464-275').inventoryId, askingPrice: '50', dateListed: '2026-08-01', row: 2 },
                        fs2: { itemNum: '3376', variation: '1', inventoryId: Object.values(state.personalData).find(p => p.itemNum === '3376').inventoryId, askingPrice: '1250', dateListed: '2026-08-02', row: 3 } };
  state.partsData = { p1: { id: 'p1', description: 'Motor brushes for the big steam engine', partNum: '610-6211', forItem: '773', status: 'wanted', row: 2, dateAdded: '2026-11-01' },
                      p2: { id: 'p2', description: 'E-unit lever', partNum: '', forItem: '', status: 'wanted', row: 3, dateAdded: '2026-11-02' } };
})();`;

const SIZES = {
  phone:    { opt: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, cards: true, fold: false },
  ipadUp:   { opt: { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true }, cards: true, fold: true },
  ipadSide: { opt: { viewport: { width: 1180, height: 820 }, isMobile: true, hasTouch: true }, cards: true, fold: true },
  narrow:   { opt: { viewport: { width: 1000, height: 800 } }, cards: true, fold: false },
  laptop:   { opt: { viewport: { width: 1280, height: 800 } }, cards: false, fold: false },
  wide:     { opt: { viewport: { width: 2048, height: 1000 } }, cards: false, fold: false }
};

// What the page looks like, measured in the page.
const MEASURE = `(page) => {
  const vis = el => { if (!el) return false; const r = el.getBoundingClientRect(); const c = getComputedStyle(el); return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && c.display !== 'none'; };
  const host = document.getElementById('page-' + page);
  const area = page === 'parts' ? document.getElementById('parts-list') : host;
  const out = { page };
  out.overflow = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth;
  // the content area must not scroll sideways, nor the table inside it
  const main = document.getElementById('main-content');
  out.mainOverflow = main ? main.scrollWidth - main.clientWidth : 0;
  const wrap = page === 'upgrade' ? document.querySelector('#page-upgrade .table-wrap') : page === 'forsale' ? document.getElementById('forsale-table-wrap') : null;
  out.table = !!(wrap && vis(wrap));
  out.tableOverflow = out.table ? (wrap.scrollWidth - wrap.clientWidth) : 0;
  out.cards = page === 'parts' ? true : vis(document.getElementById(page === 'upgrade' ? 'upgrade-cards' : 'forsale-cards')) && !out.table;
  // Item # on screen: every number shown starts inside the window
  const nums = out.table ? [...wrap.querySelectorAll('tbody td[data-col="num"]')] : [...host.querySelectorAll('.rr-lc-acts')].map(a => a.parentElement);
  out.numsOff = nums.filter(n => { const r = n.getBoundingClientRect(); return r.left < -1 || r.left > innerWidth - 20; }).length;
  out.numsN = nums.length;
  // headings never cut
  out.cutHeads = out.table ? [...wrap.querySelectorAll('thead th')].filter(th => th.scrollWidth > th.clientWidth + 1).map(th => th.textContent.trim()) : [];
  // buttons: no wrapped or cut words; the card's are finger-sized
  const btns = [...area.querySelectorAll('.rr-lc-main, .rr-lc-more')].filter(vis);
  out.btnN = btns.length;
  out.wrapped = btns.filter(b => { const r = document.createRange(); r.selectNodeContents(b); return new Set([...r.getClientRects()].filter(x => x.width > 1).map(x => Math.round(x.top))).size > 1; }).map(b => b.textContent);
  out.cut = btns.filter(b => b.scrollWidth > b.clientWidth + 1).map(b => b.textContent);
  out.small = out.table ? [] : btns.filter(b => b.getBoundingClientRect().height < RR_LIST_LAYOUT.tapMin - 0.5).map(b => b.textContent + ':' + Math.round(b.getBoundingClientRect().height));
  // Remove sits only inside the ⋯ sheet on a card
  out.removeOut = out.table ? 0 : [...area.querySelectorAll('button')].filter(b => vis(b) && /^\\s*Remove\\b/.test(b.textContent)).length;
  out.mains = btns.filter(b => b.classList.contains('rr-lc-main')).map(b => b.textContent.trim());
  // the menu: folded behind ☰ on a tablet, beside the page on a computer
  const side = document.querySelector('.sidebar');
  const sr = side ? side.getBoundingClientRect() : null;
  out.fold = document.documentElement.classList.contains('rr-menu-fold');
  out.burger = vis(document.getElementById('rr-menu-btn'));
  out.sideOnScreen = !!(sr && vis(side) && sr.right > 4 && sr.left > -4);
  out.count = (document.getElementById('upgrade-count') || {}).textContent || '';
  return out;
}`;

async function world(browser, size, plants) {
  const S = SIZES[size];
  const ctx = await browser.newContext(S.opt);
  await ctx.addInitScript(() => { try { localStorage.setItem('lv_welcome_seen', '1'); localStorage.setItem('lv_onboarded', '1'); } catch (e) {} });
  await ctx.route('**', r => {
    const u = r.request().url();
    if (!/^(file|data|about|blob):/.test(u)) return r.abort();
    const f = u.replace(/[?#].*$/, '').split('/').pop();
    if (plants && plants.files && plants.files[f] != null) return r.fulfill({ status: 200, contentType: /\.css$/.test(f) ? 'text/css' : 'application/javascript', body: plants.files[f] });
    return r.continue();
  });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message.slice(0, 160)));
  await pg.goto('file://' + path.join(APP, 'index.html'));
  await pg.waitForTimeout(2200);
  await pg.evaluate(SEED); await pg.waitForTimeout(150);
  for (const p of ((plants && plants.scripts) || [])) await pg.addScriptTag({ content: p });
  await pg.evaluate(SCENE);
  await pg.evaluate(() => { try { if (typeof rrMenuFoldSync === 'function') rrMenuFoldSync(); } catch (e) {} });
  return { ctx, pg, errs };
}
async function show(pg, page) {
  await pg.evaluate(page => {
    showPage(page, null);
    if (page === 'upgrade') buildUpgradePage(); else if (page === 'forsale') buildForSalePage(); else _renderPartsList();
  }, page);
  await pg.waitForTimeout(250);
  return pg.evaluate(eval(MEASURE), page);
}



module.exports = { pw, SCENE, SIZES, MEASURE, world, show, APP };
