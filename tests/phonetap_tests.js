#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// PHONE CATALOG TAP — 2026-11-08 phonetap (real Chromium, the REAL app)
//
// [stated] Brad 2026-11-07 20:33 CT "yes" to PLAN_2026-11-07_PHONE_CATALOG_TAP.md.
// Found by the testing chat on Brad's Android phone (v0.9.2126): in the Master
// Catalog, tapping the card of an item he does NOT own (GarGraves 401SW)
// opened the owned-item page — "✓ In Collection", Record Sale, List for Sale,
// Remove — while the same row on the computer opened the catalog details
// screen. The phone card called showItemDetailPage for every card.
//
//   A  phone, Master Catalog: a card you do NOT own opens the details screen
//      (#rr-cat-details), never the owned page
//   B  phone, Master Catalog: a card you DO own opens its own page
//   C  phone, My Collection: an owned card still opens its own page (unchanged)
//   D  rrCatalogCardTap rules: the card's own copy (Row ID aware) wins even when
//      the number lookup misses; a collection-only row (idx <= -1000) opens its
//      page; an owned Science set opens its menu
//   E  desktop row unchanged: browseRowClick — not owned → details screen,
//      owned → the owned menu
//   F  source: the phone card's tap is the shared rule in the catalog view
//   P  PLANTED offenders — each must turn its check red
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  phonetap_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const rd = f => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0, fail = 0;
function T(n, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + n + (ok ? '' : '  -> got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want)));
  ok ? pass++ : fail++;
}

const PHONE = { width: 390, height: 844 };
const DESK = { width: 1400, height: 900 };

async function open(browser, viewport, planted) {
  const pg = await browser.newPage({ viewport });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    const clean = u.split('?')[0];
    const name = Object.keys(planted || {}).find(k => clean.endsWith('/' + k));
    if (name) return r.fulfill({ body: planted[name], contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(800);
  await pg.evaluate(() => {
    localStorage.clear();
    state.masterData = [
      { itemNum: '401SW', variation: '', itemType: 'Track', _era: 'gargraves', _tab: 'GarGraves', manufacturer: 'GarGraves', description: 'Phantom Line switch', roadName: '' },
      { itemNum: '2338', variation: '2', itemType: 'Diesel Locomotive', _era: 'pw', _tab: 'Lionel PW - Items', description: 'GP7 Diesel', roadName: 'Milwaukee Road' },
      { itemNum: '2339', variation: '', itemType: 'Diesel Locomotive', _era: 'pw', _tab: 'Lionel PW - Items', description: 'GP7 Diesel', roadName: 'Wabash' },
      { itemNum: '2343', variation: '', itemType: 'Diesel Locomotive', _era: 'pw', _tab: 'Lionel PW - Items', description: 'F3 Diesel AA', roadName: 'Santa Fe' },
      { itemNum: 'SCI-1', variation: '', itemType: 'Science Set', _era: 'pw', _tab: (window.SHEET_TABS && SHEET_TABS.science) || 'Science', description: 'Chemistry set', roadName: '' },
    ];
    _rebuildMasterIndex();
    state.personalData = {
      '190': { itemNum: '2338', variation: '2', owned: true, inventoryId: '190', era: 'pw', condition: '7', row: 5 },
      // look-alikes a number-only lookup (findPDKey) takes for the catalog row
      // and the card's own resolver (_rrPdForRow) refuses (fresh review, 2026-11-08):
      '300': { itemNum: '2339', variation: '', owned: true, inventoryId: '300', era: 'Manual', row: 6 },   // a Manual-era copy (v0.9.718)
      '301': { itemNum: '2343-P', variation: '', owned: true, inventoryId: '301', era: 'pw', row: 7 },     // owns only the powered unit
    };
    state.scienceData = { s1: { itemNum: 'SCI-1', variation: '' } };
    state.constructionData = {};
    state.wantData = {}; state.upgradeData = {}; state.forSaleData = {}; state.soldData = {};
    _currentEra = 'all';
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
  });
  return { pg, errs };
}

// Tap the phone card whose number is `num`; report what opened.
const TAP = `(async (num) => {
  ['rr-cat-details','owned-item-menu'].forEach(id => { const e = document.getElementById(id); if (e) e.remove(); });
  const dc = document.getElementById('item-detail-content'); if (dc) dc.innerHTML = '';
  const cards = [...document.querySelectorAll('.browse-card')];
  const card = cards.find(c => { const n = c.querySelector('.browse-card-num'); return n && n.textContent.trim().split(/\\s+/)[0] === num; });
  if (!card) return { card: false, cards: cards.length };
  card.click();
  await new Promise(r => setTimeout(r, 120));
  const det = document.getElementById('item-detail-content');
  const detTxt = det ? det.textContent : '';
  return {
    card: true,
    details: !!document.getElementById('rr-cat-details'),
    ownedPage: /In Collection/.test(detTxt) && /Record Sale/.test(detTxt),
  };
})`;

async function scenarioPhone(browser, planted) {
  const { pg, errs } = await open(browser, PHONE, planted);
  const R = {};
  R.isPhone = await pg.evaluate(() => rrIsPhone());
  // the Master Catalog shows cards once something is picked — a search does it
  await pg.evaluate(() => { showPage('browse'); state.filters.owned = false; state.filters.search = '401'; renderBrowse(); });
  await pg.waitForTimeout(200);
  R.unowned = await pg.evaluate(TAP + `('401SW')`);
  await pg.evaluate(() => { showPage('browse'); state.filters.owned = false; state.filters.search = '2338'; renderBrowse(); });
  await pg.waitForTimeout(150);
  R.owned = await pg.evaluate(TAP + `('2338')`);
  await pg.evaluate(() => { showPage('browse'); state.filters.owned = true; state.filters.search = ''; renderBrowse(); });
  await pg.waitForTimeout(150);
  R.mine = await pg.evaluate(TAP + `('2338')`);
  R.navAfterMine = await pg.evaluate(() => !!window._rrNav);
  // straight on to the catalog's OWNED 2338 after that My Collection page: no stale arrows
  await pg.evaluate(() => { showPage('browse'); state.filters.owned = false; state.filters.search = '2338'; renderBrowse(); });
  await pg.waitForTimeout(150);
  R.owned2 = await pg.evaluate(TAP + `('2338')`);
  R.navAfterCatalog = await pg.evaluate(() => window._rrNav === null || window._rrNav === undefined);
  // the look-alikes: what the card says, the tap does
  const lookalike = async (q, num) => {
    await pg.evaluate(q => { showPage('browse'); state.filters.owned = false; state.filters.search = q; renderBrowse(); }, q);
    await pg.waitForTimeout(150);
    return pg.evaluate(TAP + `('` + num + `')`);
  };
  R.manual = await lookalike('2339', '2339');
  R.pUnit = await lookalike('2343', '2343');
  R.errs = errs;
  await pg.close();
  return R;
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  try {
    // ── A/B/C — the phone card ──────────────────────────────────────────
    const R = await scenarioPhone(browser);
    T('setup: the page is a phone', R.isPhone, true);
    T('A  phone catalog, NOT owned (401SW): the details screen opens', R.unowned.details, true);
    T('A  phone catalog, NOT owned (401SW): no "In Collection" owned page', R.unowned.ownedPage, false);
    T('B  phone catalog, owned (2338): its own page opens', R.owned.ownedPage, true);
    T('B  phone catalog, owned (2338): no details screen', R.owned.details, false);
    T('C  phone My Collection, owned (2338): its own page opens (unchanged)', R.mine.ownedPage, true);
    T('C  phone My Collection: no details screen', R.mine.details, false);
    T('A2 a Manual-era copy of 2339 does not make the catalog 2339 open the owned page', [R.manual.card, R.manual.details, R.manual.ownedPage], [true, true, false]);
    T('A2 owning only 2343-P does not make the bare 2343 open the owned page', [R.pUnit.card, R.pUnit.details, R.pUnit.ownedPage], [true, true, false]);
    T('G  setup: the My Collection page had arrows (3 cards)', R.navAfterMine, true);
    T('G  a catalog card opened next: the old list\'s arrows are gone', [R.owned2.ownedPage, R.navAfterCatalog], [true, true]);
    T('no page errors (phone)', R.errs, []);

    // ── D — the rule itself ────────────────────────────────────────────
    {
      const { pg, errs } = await open(browser, PHONE);
      const D = await pg.evaluate(() => {
        const calls = [];
        const keep = { d: window.showItemDetailPage, s: window._showSpecialOwnedMenu, c: window.rrCatalogDetailsPopup };
        window.showItemDetailPage = function (i, inv) { calls.push(['page', i, inv]); };
        window._showSpecialOwnedMenu = function (i) { calls.push(['special', i]); };
        window.rrCatalogDetailsPopup = function (i) { calls.push(['details', i]); };
        const run = (i, inv, owned) => { calls.length = 0; window._rrNav = { stale: 1 }; rrCatalogCardTap(i, inv, owned); return calls.slice().concat(window._rrNav === null ? [] : [['STALE NAV']]); };
        const out = {
          ownedCopy: run(2, '77', true),
          ownedLegacy: run(2, '', true),
          notOwned: run(2, '', false),
          notOwnedWithId: run(2, '300', false),
          personalOnly: run(-1003, '55', true),
          science: run(4, '', false),
          gone: run(99, '', false),
        };
        Object.assign(window, { showItemDetailPage: keep.d, _showSpecialOwnedMenu: keep.s, rrCatalogDetailsPopup: keep.c });
        return out;
      });
      T('D  the card says owned → its page, with the card\'s copy', D.ownedCopy, [['page', 2, '77']]);
      T('D  the card says owned, a pre-ID copy (no id) → its page', D.ownedLegacy, [['page', 2, '']]);
      T('D  the card says not owned → details screen', D.notOwned, [['details', 2]]);
      T('D  not owned even with a look-alike copy id in hand → details screen', D.notOwnedWithId, [['details', 2]]);
      T('D  a collection-only row (idx <= -1000) opens its page', D.personalOnly, [['page', -1003, '55']]);
      T('D  an owned Science set opens its menu', D.science, [['special', 4]]);
      T('D  a row that is gone does nothing (the stale arrows still go)', D.gone, []);
      T('no page errors (rule)', errs, []);
      await pg.close();
    }

    // ── E — the desktop row is unchanged ──────────────────────────────
    {
      const { pg, errs } = await open(browser, DESK);
      const E = await pg.evaluate(() => {
        const calls = [];
        const keep = { m: window.showOwnedItemMenu, c: window.rrCatalogDetailsPopup, s: window._showSpecialOwnedMenu };
        window.showOwnedItemMenu = function (i, k) { calls.push(['menu', i, k]); };
        window.rrCatalogDetailsPopup = function (i) { calls.push(['details', i]); };
        window._showSpecialOwnedMenu = function (i) { calls.push(['special', i]); };
        const ev = { target: document.body };
        const run = i => { calls.length = 0; browseRowClick(ev, i); return calls.slice(); };
        const out = { unowned: run(0), owned: run(1), science: run(4) };
        Object.assign(window, { showOwnedItemMenu: keep.m, rrCatalogDetailsPopup: keep.c, _showSpecialOwnedMenu: keep.s });
        return out;
      });
      T('E  desktop row, NOT owned → details screen (unchanged)', E.unowned, [['details', 0]]);
      T('E  desktop row, owned → the owned menu with its key (unchanged)', E.owned, [['menu', 1, '190']]);
      T('E  desktop row, owned Science set → its menu (unchanged)', E.science, [['special', 4]]);
      T('no page errors (desktop)', errs, []);
      await pg.close();
    }

    // ── F — source ────────────────────────────────────────────────────
    const B = rd('browse.js'), AC = rd('app-collection.js');
    const cardLine = B.split('\n').find(l => l.indexOf('<div class="browse-card"${rrSampleAttrs(item)}') >= 0) || '';
    T('F  the phone card\'s tap is _cardTap (one place decides)', /: _cardTap\}/.test(cardLine), true);
    T('F  _cardTap: My Collection → its page, catalog → rrCatalogCardTap', /const _cardTap = state\.filters\.owned\s*\?\s*'showItemDetailPage\(/.test(B) && /: 'rrCatalogCardTap\(' \+ globalIdx \+ ", '" \+ rrJsArg\(_copyInv\) \+ "', " \+ \(isOwned \? 'true' : 'false'\)/.test(B), true);
    T('F  browseRowClick and rrCatalogCardTap share the Science / Construction test', (AC.match(/rrCatalogRowOwnership\(idx\)/g) || []).length >= 2, true);
    T('F  the tap clears the last list\'s arrows first', /function rrCatalogCardTap\(idx, copyInv, owned\) \{\n  window\._rrNav = null;/.test(AC), true);

    // ── P — planted offenders ─────────────────────────────────────────
    // P1: the old phone card (every card opens the owned page)
    const oldB = B.replace(": _cardTap}", ": 'showItemDetailPage(' + globalIdx + \", '\" + _copyInv + \"')\"}");
    T('P1 plant applied (old phone card)', oldB !== B, true);
    const P1 = await scenarioPhone(browser, { 'browse.js': oldB });
    T('P1 the old phone card is caught: details screen does NOT open for 401SW', P1.unowned.details, false);
    T('P1 the old phone card is caught: the owned page opens for 401SW', P1.unowned.ownedPage, true);
    // P2: a rule that always opens the page
    const badAC = AC.replace("  rrCatalogDetailsPopup(idx);   // not owned: the catalog details screen, as on the computer\n}", "  showItemDetailPage(idx, inv);\n}");
    T('P2 plant applied (rule always opens the page)', badAC !== AC, true);
    const P2 = await scenarioPhone(browser, { 'app-collection.js': badAC });
    T('P2 a rule that always opens the page is caught (401SW gets no details screen)', P2.unowned.details, false);
    // P3: the source checks fail on the old card line
    const oldLine = oldB.split('\n').find(l => l.indexOf('<div class="browse-card"${rrSampleAttrs(item)}') >= 0) || '';
    T('P3 the source check fails on the old card line', /: _cardTap\}/.test(oldLine), false);
    // P4: a tap that does not clear the arrows
    const noNav = AC.replace("function rrCatalogCardTap(idx, copyInv, owned) {\n  window._rrNav = null;", "function rrCatalogCardTap(idx, copyInv, owned) {");
    T('P4 plant applied (no arrow clear)', noNav !== AC, true);
    const P4 = await scenarioPhone(browser, { 'app-collection.js': noNav });
    T('P4 a tap that keeps the old list\'s arrows is caught', P4.navAfterCatalog, false);
    // P6: a tap that clears the arrows only for items you do NOT own (fresh review, 2026-11-08)
    const halfNav = AC.replace("function rrCatalogCardTap(idx, copyInv, owned) {\n  window._rrNav = null;", "function rrCatalogCardTap(idx, copyInv, owned) {\n  if (owned !== true) window._rrNav = null;");
    T('P6 plant applied (clears only when not owned)', halfNav !== AC, true);
    const P6 = await scenarioPhone(browser, { 'app-collection.js': halfNav });
    T('P6 an owned card that keeps the old list\'s arrows is caught', P6.navAfterCatalog, false);
    // P5: a tap that falls back to the number-only lookup (the look-alike bug)
    const numOnly = AC.replace("if (idx <= -1000 || owned === true || owned === 'true') {", "if (idx <= -1000 || owned === true || owned === 'true' || (state.masterData[idx] && findPDKey(state.masterData[idx].itemNum, state.masterData[idx].variation))) {");
    T('P5 plant applied (number-only fallback)', numOnly !== AC, true);
    const P5 = await scenarioPhone(browser, { 'app-collection.js': numOnly });
    T('P5 the number-only fallback is caught (Manual-era 2339 opens the owned page)', P5.manual.ownedPage, true);
    T('P5 the number-only fallback is caught (2343-P makes 2343 open the owned page)', P5.pUnit.ownedPage, true);
  } catch (e) {
    console.log('FAIL  crashed: ' + (e && e.stack || e)); fail++;
  } finally {
    await browser.close();
  }
  console.log((fail ? 'FAILED' : 'ALL PASS') + '  —  phonetap_tests: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
