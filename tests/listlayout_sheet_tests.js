#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════════════
// THE LIST LAYOUT, part 2 — the ⋯ sheet, the ☰ menu, the edges, the plants (R7
// listlayout; Brad's iPad screenshots: the desktop table squeezed beside the
// menu, Item # pushed off the left edge, "MANUFACTU" / "CONDITION T/" cut,
// 4–6 small buttons stacked per row with "Got / It" wrapping; on his computer
// "Showing 4 of 5" with every filter on All).
//   S  source: the three pages decide table-or-cards ONLY through
//      rrListAsCards; no "+ Collection" / "Bought it" left in app words;
//      ONE helper draws the card and row buttons — each proven on a plant.
//   L  the real app in Chromium at phone (390), iPad upright (820, touch),
//      iPad sideways (1180, touch), a narrow computer window (1000), a laptop
//      (1280) and a wide screen (2048), on all three lists:
//        nothing runs off the side · Item # on screen · no button word wraps
//        or is cut · card buttons ≥ 44px · Remove only inside ⋯ on a card ·
//        tablets fold the menu behind ☰ (phone / computer don't) · a laptop
//        keeps the table, a narrow window gets cards · no heading cut.
//   M  the ⋯ sheet: Remove last and red, a tap outside does nothing, Cancel
//      and the device Back close it, a choice runs for THAT entry.
//   C  the count: an engine + tender wanted together is one row, and the
//      header says "N items", never "Showing N of N+1".
//   P  planted: the OLD app-pages.js + app.css served in their place (the
//      live v0.9.2131 code) — L turns red at the iPad; a wrapping main button,
//      a tablet test that says no, and the old unfolded count each turn their
//      check red.
// ═════════════════════════════════════════════════════════════════════════
// (part 1, the layout at six window sizes + the source rules: listlayout_tests.js)
const fs = require('fs'), path = require('path'), cp = require('child_process');
const APP = path.join(__dirname, '..', 'app');
const { SEED } = require('./lib/guide-fixture');
let pass = 0, fail = 0;
function ok(n, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (extra || ''))); cond ? pass++ : fail++; }
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
const PAGES = read('app-pages.js'), CSS = read('app.css');
function plant(src, from, to, label) {
  if (src.indexOf(from) < 0) throw new Error('planted offender "' + label + '" no longer matches the source — update the test');
  return src.split(from).join(to);
}
function body(src, name) {
  const i = src.indexOf('\nfunction ' + name + '(');
  if (i < 0) throw new Error(name + ' not found');
  return src.slice(i, src.indexOf('\n}\n', i) + 3);
}

// (the source rules S1–S3 run in part 1)
const { pw, SCENE, SIZES, MEASURE, world, show } = require('./lib/list-layout-world');

(async () => {
  if (!pw) { console.log('FAILED  —  this suite needs playwright and it is not installed.'); process.exit(1); }
  const exC = '/opt/pw-browsers/chromium';
  let browser;
  try { browser = await pw.chromium.launch(fs.existsSync(exC) ? { executablePath: exC } : {}); }
  catch (e) { console.log('FAILED  —  Chromium would not start: ' + e.message.split('\n')[0]); process.exit(1); }
  // ── N ── a computer window too narrow for For Sale's chosen columns: cards, and a way
  // back to the columns (the editor lives on the table's headings and keeps the table)
  {
    const W = await world(browser, 'narrow');
    await show(W.pg, 'forsale');
    const N = await W.pg.evaluate(async () => {
      const note = document.querySelector('#forsale-cards .rr-lc-narrow');
      const out = { note: !!note && note.getBoundingClientRect().height > 0 };
      if (note) { note.querySelector('button').click(); await new Promise(r => setTimeout(r, 200)); }
      const wrap = document.getElementById('forsale-table-wrap');
      out.table = !!wrap && getComputedStyle(wrap).display !== 'none' && !!state._fsColEdit;
      return out;
    });
    ok('N1 a narrow computer window says why it shows cards and offers ✎ Edit columns; pressing it shows the table to edit', N.note && N.table, JSON.stringify(N));
    const P = await world(browser, 'ipadUp');
    await show(P.pg, 'forsale');
    ok('N2 …never on a tablet (cards are the tablet layout, not a fallback)', !(await P.pg.evaluate(() => !!document.querySelector('#forsale-cards .rr-lc-narrow'))));
    await P.ctx.close(); await W.ctx.close();
  }

  // ── M ── the ⋯ sheet, on the iPad
  {
    const W = await world(browser, 'ipadUp');
    await show(W.pg, 'upgrade');
    const M = await W.pg.evaluate(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      const out = {};
      window.__calls = [];
      window._upgradeViewMine = k => window.__calls.push('view:' + k);
      window.removeWantItem = (n, v) => window.__calls.push('remove:' + n + '|' + v);
      const card = [...document.querySelectorAll('#upgrade-cards > div')].find(c => /^\s*3376/.test(c.textContent));
      card.querySelector('.rr-lc-more').click(); await wait(80);
      const sheet = document.getElementById('rr-list-menu');
      out.open = !!sheet;
      const words = sheet ? [...sheet.querySelectorAll('button')].map(b => b.textContent.trim()) : [];
      out.words = words;
      const rm = sheet ? sheet.querySelector('.rr-lc-danger') : null;
      out.removeLastRed = !!rm && words[words.length - 2] === 'Remove' && getComputedStyle(rm).color !== getComputedStyle(sheet.querySelector('.rr-lc-sheet-btn')).color;
      out.big = sheet ? [...sheet.querySelectorAll('button')].every(b => b.getBoundingClientRect().height >= 44) : false;
      // a tap on the shade does nothing
      sheet.dispatchEvent(new MouseEvent('click', { bubbles: true })); await wait(50);
      out.outsideStays = !!document.getElementById('rr-list-menu');
      // device Back closes it
      history.back(); await wait(250);
      out.backCloses = !document.getElementById('rr-list-menu');
      // a choice runs for THAT entry
      card.querySelector('.rr-lc-more').click(); await wait(60);
      [...document.querySelectorAll('#rr-list-menu button')].find(b => b.textContent.trim() === 'Remove').click(); await wait(60);
      out.calls = window.__calls.slice();
      out.closedAfter = !document.getElementById('rr-list-menu');
      // Cancel closes
      card.querySelector('.rr-lc-more').click(); await wait(60);
      document.querySelector('#rr-list-menu .rr-lc-cancel').click(); await wait(60);
      out.cancelCloses = !document.getElementById('rr-list-menu');
      // the upgrade card offers View Mine for its own copy
      const up = [...document.querySelectorAll('#upgrade-cards > div')].find(c => /UPGRADE/i.test(c.textContent));
      up.querySelector('.rr-lc-more').click(); await wait(60);
      [...document.querySelectorAll('#rr-list-menu button')].find(b => /View Mine/.test(b.textContent)).click(); await wait(60);
      out.view = window.__calls.slice(-1)[0];
      out.inv = Object.values(state.upgradeData)[0].inventoryId;
      // ☰ folds the menu out and the device Back folds it away
      document.getElementById('rr-menu-btn').click(); await wait(300);
      out.drawerOpen = document.documentElement.classList.contains('rr-menu-open') && document.querySelector('.sidebar').getBoundingClientRect().left >= -1;
      history.back(); await wait(300);
      out.drawerBack = !document.documentElement.classList.contains('rr-menu-open');
      // picking a page from the folded-out menu: that page opens, the menu folds away, and stays on that page
      document.getElementById('rr-menu-btn').click(); await wait(300);
      document.querySelector('.sidebar .nav-item[onclick*="buildForSalePage"]').click(); await wait(400);
      const act = document.querySelector('.page.active');
      out.pick = { page: act && act.id, open: document.documentElement.classList.contains('rr-menu-open') };
      return out;
    });
    ok('M1 ⋯ opens the sheet', M.open, JSON.stringify(M));
    ok('M2 the sheet: eBay, Search, then Remove last (in red), then Cancel', JSON.stringify(M.words) === JSON.stringify(['eBay', 'Search', 'Remove', 'Cancel']) && M.removeLastRed, JSON.stringify(M.words));
    ok('M3 every sheet button is finger-sized', M.big);
    ok('M4 a tap outside does nothing; the device Back closes it', M.outsideStays && M.backCloses, JSON.stringify([M.outsideStays, M.backCloses]));
    ok('M5 Remove runs for THAT entry (3376 var 2) and the sheet closes', M.calls.length === 1 && M.calls[0] === 'remove:3376|2' && M.closedAfter, JSON.stringify(M.calls));
    ok('M6 Cancel closes it', M.cancelCloses);
    ok('M7 📷 View Mine opens YOUR copy (by inventoryId)', M.view === 'view:' + M.inv, M.view + ' vs ' + M.inv);
    ok('M8 ☰ folds the menu out on the iPad; the device Back folds it away', M.drawerOpen && M.drawerBack, JSON.stringify([M.drawerOpen, M.drawerBack]));
    ok('M10 picking For Sale from the folded-out menu opens it, folds the menu away and stays there (no rewind)', M.pick.page === 'page-forsale' && !M.pick.open, JSON.stringify(M.pick));
    ok('M9 no page errors', !W.errs.length, W.errs.join(' | '));
    await W.ctx.close();
  }

  // ── E ── edges the independent review found (2026-11-08): exact words reach the
  // main button's call, two wants with no sheet row yet keep their own sheets, and a
  // filter that hides anything says "Showing".
  const EDGE = async (files) => {
    const W = await world(browser, 'ipadUp', files ? { files } : null);
    const R = await W.pg.evaluate(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      const out = {};
      window.__g = []; window.googlePart = (pn, fi, d) => window.__g.push(d);
      state.partsData = { q: { id: 'q', description: 'Smoke & lamp O\'Brien 3/16" screw', partNum: '', forItem: '', status: 'wanted', row: 9, dateAdded: '2026-11-03' } };
      showPage('parts', null); _renderPartsList();
      document.querySelector('#parts-list .rr-lc-main').click(); await wait(50);
      out.desc = window.__g[0];
      window.__rm = []; window.removeWantItem = (n, v) => window.__rm.push(n + '|' + v);
      state.upgradeData = {};
      state.wantData = { x: { itemNum: '3376', variation: '1', row: 0, priority: 'High' }, y: { itemNum: '6464-275', variation: '1', row: 0, priority: 'Low' } };
      showPage('upgrade', null); buildUpgradePage(); await wait(50);
      const card = [...document.querySelectorAll('#upgrade-cards > div')].find(c => /^\s*3376/.test(c.textContent));
      card.querySelector('.rr-lc-more').click(); await wait(50);
      [...document.querySelectorAll('#rr-list-menu button')].find(b => b.textContent.trim() === 'Remove').click(); await wait(50);
      out.removed = window.__rm.join(',');
      state._upgradePriority = 'High'; buildUpgradePage();
      out.filtered = document.getElementById('upgrade-count').textContent;
      state._upgradePriority = ''; buildUpgradePage();
      out.all = document.getElementById('upgrade-count').textContent;
      return out;
    });
    await W.ctx.close();
    return R;
  };
  {
    const E = await EDGE();
    ok('E1 the main button hands the EXACT words on (& \' " survive — no double escaping)', E.desc === 'Smoke & lamp O\'Brien 3/16" screw', E.desc);
    ok('E2 two wants with no sheet row yet: ⋯ → Remove on the 3376 removes the 3376', E.removed === '3376|1', E.removed);
    ok('E3 a filter that hides an item says "Showing 1 of 2"; every filter on All says "2 items"', E.filtered === 'Showing 1 of 2' && E.all === '2 items', JSON.stringify([E.filtered, E.all]));
    const P7 = await EDGE({ 'app-pages.js': plant(PAGES, "'\" onclick=\"event.stopPropagation();' + main.call + '\">'", "'\" onclick=\"event.stopPropagation();' + rrEsc(main.call) + '\">'", 'P7') });
    ok('P7 the main call escaped twice — E1 turns red', P7.desc !== 'Smoke & lamp O\'Brien 3/16" screw', P7.desc);
    const P8 = await EDGE({ 'app-pages.js': plant(PAGES, "  return 'wu|' + (u.listType || '') + '|' + (u.inventoryId || ((u.itemNum || '') + '|' + (u.variation || '') + '|' + (u.row || 0)));",
      "  return 'wu|' + _ugEntryKey(u) + '|' + (u.listType || '');", 'P8') });
    ok('P8 the old sheet key (legacy-row-0 for both wants) — E2 turns red', P8.removed !== '3376|1', P8.removed);
  }

  // ── P ── planted offenders
  let OLD = null;
  try {
    OLD = { 'app-pages.js': cp.execSync('git show 9cdefb5f:app/app-pages.js', { cwd: path.join(__dirname, '..'), maxBuffer: 64e6 }).toString(),
            'app.css': cp.execSync('git show 9cdefb5f:app/app.css', { cwd: path.join(__dirname, '..'), maxBuffer: 64e6 }).toString() };
  } catch (e) { OLD = null; }
  if (OLD) {
    const W = await world(browser, 'ipadUp', { files: OLD });
    const R = await W.pg.evaluate(() => { showPage('upgrade', null); buildUpgradePage(); return 1; }).then(() => W.pg.waitForTimeout(250)).then(() => W.pg.evaluate(eval(MEASURE), 'upgrade'));
    ok('P1 the OLD list code (v0.9.2131) on the iPad — L3 / L6 turn red (the squeezed table, a Remove on every card)', !(R.cards && !R.table) || R.removeOut > 0 || R.btnN === 0, JSON.stringify({ t: R.table, c: R.cards, rm: R.removeOut }));
    await W.ctx.close();
    const W2 = await world(browser, 'wide', { files: { 'app-pages.js': OLD['app-pages.js'] } });
    const R2 = await show(W2.pg, 'upgrade');
    ok('P2 the OLD count (folded rows against the unfolded total) — C1 turns red', !/^\d+ items?$/.test(R2.count.trim()), R2.count);
    await W2.ctx.close();
  } else {
    ok('P1/P2 the old code is readable from git (9cdefb5f)', false, 'git show failed — a full clone is needed');
  }
  {
    const W = await world(browser, 'ipadUp', { files: { 'app.css': CSS + '\n.rr-lc-main { white-space: normal !important; flex: 0 0 34px !important; overflow: visible !important; }' } });
    const R = await show(W.pg, 'upgrade');
    ok('P3 a main button whose word wraps — L4 turns red', R.wrapped.length > 0 || R.cut.length > 0, JSON.stringify([R.wrapped, R.cut]));
    await W.ctx.close();
  }
  {
    const W = await world(browser, 'ipadUp', { scripts: ['window.rrIsTablet = function () { return false; };'] });
    const R = await show(W.pg, 'upgrade');
    ok('P4 a tablet test that says no — the iPad gets the squeezed table and an unfolded menu, L3 / L8 turn red', R.table || !R.fold, JSON.stringify({ t: R.table, f: R.fold }));
    await W.ctx.close();
  }
  {
    const W = await world(browser, 'ipadUp', { files: { 'app.css': CSS + '\n.rr-lc-main, .rr-lc-more { min-height: 30px !important; height: 30px !important; }' } });
    const R = await show(W.pg, 'forsale');
    ok('P5 card buttons under finger size — L5 turns red', R.small.length > 0, JSON.stringify(R.small));
    await W.ctx.close();
  }
  {
    // P6: no fold-away on a page pick (the listener gone) — M10 turns red (the menu stays over the page)
    const SETUP = plant(read('app-setup.js'), "    _rrMenuShut();\n    if (window.BackStack && typeof BackStack.drop === 'function') BackStack.drop('rr-menu-drawer');", "", 'P6');
    const W = await world(browser, 'ipadUp', { files: { 'app-setup.js': SETUP } });
    await show(W.pg, 'upgrade');
    const pick = await W.pg.evaluate(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      document.getElementById('rr-menu-btn').click(); await wait(300);
      document.querySelector('.sidebar .nav-item[onclick*="buildForSalePage"]').click(); await wait(500);
      const act = document.querySelector('.page.active'); return { page: act && act.id, open: document.documentElement.classList.contains('rr-menu-open') };
    });
    ok('P6 a menu that does not fold away after a page pick — M10 turns red', !(pick.page === 'page-forsale' && !pick.open), JSON.stringify(pick));
    await W.ctx.close();
  }
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + e.stack); process.exit(1); });
