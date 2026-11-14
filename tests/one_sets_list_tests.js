#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ONE LIST OF SETS — 2026-11-14 onesets (real Chromium, the REAL app)
//
// Lars Brown, Report a problem, 2026-11-14: "Sets confusion — Total sets Vs My
// sets?? Why do I have one showing separately in My Sets? I want all to show
// under the same Total Sets." → [stated] Brad: "yes and emergency send it".
// His screens: "MY COLLECTION LIST Sets · 9 of 81 items" (nine modern Lionel
// sets, each entered as ONE item whose catalog type is Set) and "My Sets (1)"
// (his 1511S, entered as a set with its twelve pieces). The Total Sets card
// counted the nine and opened them under My Collection's Sets chip; the My Sets
// button counted the one and opened the My Sets list. Neither knew the other.
//
// Now (browse.js rrOwnedSetItems / rrMySetsCount / rrOpenMySets / renderSetsTab;
// dashboard.js the Total Sets card):
//   A  rrOwnedSetItems: the owned copies whose own catalog entry is a set — by
//      _ownedGroupOf, THE decider; a manual row by its own type; never a box, a
//      want, or a PIECE of a My Sets row (same Group ID: that set's, listed once)
//   B  rrMySetsCount = My Sets rows + those items; the My Sets button says it;
//      the Total Sets card says the same number and opens My Sets; Collection by
//      Type's Sets line is still the items by type (a My Sets row is a wrapper
//      around pieces already counted — v0.9.1564)
//   C  the list (phone cards and computer rows): the set rows AND the item
//      rows; an item's card and row open ITS item page by Inventory ID; Back
//      from it lands on My Sets again; the search narrows every kind
//   D  the Total Sets card's tap from the Dashboard: the list, with its Back
//      to Dashboard bar — including when My Collection's filter was left on
//      from an earlier visit (the page used to be drawn hidden)
//   E  My Collection's Sets chip (rrCollGroupOpen('Sets')) is unchanged: the
//      items by type, as every other group chip
//   P  planted offenders (8) — each change undone in a served copy must turn its
//      own check red
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  one_sets_list_tests needs playwright and it is not installed.'); process.exit(1); }
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
const TYPES = { js: 'application/javascript', css: 'text/css', html: 'text/html' };

async function open(browser, viewport, planted) {
  const pg = await browser.newPage({ viewport });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    const clean = u.split('?')[0];
    const name = Object.keys(planted || {}).find(k => clean.endsWith('/' + k));
    if (name) return r.fulfill({ body: planted[name], contentType: TYPES[name.split('.').pop()] || 'text/plain' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(800);
  await pg.evaluate(() => {
    try { localStorage.clear(); } catch (e) {}
    const PW = 'Lionel PW - Items', MPC = 'Lionel MPC-Modern';
    const mk = (n, t, era, tab, yr, desc, gauge) => ({ itemNum: n, variation: '', itemType: t, _era: era, _tab: tab, yearProd: yr || '', description: desc || (t + ' ' + n), roadName: '', gauge: gauge || '' });
    state.masterData = [
      mk('2037', 'Steam Locomotive', 'pw', PW, '1953', '2-6-4 Steam'),
      mk('6464-1', 'Boxcar', 'pw', PW, '1953', 'Western Pacific Boxcar'),
      mk('6-21787', 'Passenger Set', 'mpc', MPC, '1999', 'Blue Comet Passenger Set', 'O'),     // Lars's kind of set: ONE item
      mk('6-31705', 'Passenger Set', 'mpc', MPC, '2000', '50th Anniversary Set', 'O'),
      mk('6-11748', 'Set', 'mpc', MPC, '1994', 'Chessie Freight Set', 'O27'),               // a set that is a PIECE of a My Sets row below
    ];
    _rebuildMasterIndex();
    state.setData = [
      { setNum: '1511S', setName: 'Four-Car Freight', year: '1953', gauge: 'O27', items: ['2037', '6464-1'], alts: [], notes: '', _era: 'pw' },
    ];
    let inv = 100;
    const pd = (n, era, x) => Object.assign({ owned: true, itemNum: n, variation: '', era: era, manufacturer: 'Lionel', inventoryId: String(++inv), row: inv, condition: 8 }, x || {});
    state.personalData = {
      a: pd('2037', 'pw', { groupId: 'SET-1511S-1' }),                 // pieces of the 1511S
      b: pd('6464-1', 'pw', { groupId: 'SET-1511S-1' }),
      c: pd('6-21787', 'mpc', { userEstWorth: '300' }),               // a set entered as one item → listed
      d: pd('6-31705', 'mpc'),                                        // another
      e: pd('6-11748', 'mpc', { groupId: 'OWN-CLUB-1' }),             // a set that is a PIECE of the own set → that set's, not listed twice
      f: pd('SET-99', 'Manual', { itemType: 'Set', description: 'Club Christmas Set', yearMade: '1988', manufacturer: 'Marx' }),   // manual, typed Set by its own cell → listed
      g: pd('6-31705', 'mpc', { owned: false }),                      // a WANT: never
      h: pd('6-21787-BOX', 'mpc', { hasBox: 'Yes', groupId: 'GRP-X' }),   // a box row: never
    };
    state.mySetsData = {
      S1: { row: 40, setNum: '1511S', setName: 'Four-Car Freight', year: '1953', groupId: 'SET-1511S-1', setId: 'SET-1511S', inventoryId: 'S1', estWorth: '400' },
      S2: { row: 41, setNum: '', setName: 'Club Set', year: '2001', groupId: 'OWN-CLUB-1', setId: 'OWN-SET', inventoryId: 'S2', manufacturer: 'Lionel' },
    };
    state.wantData = {}; state.upgradeData = {}; state.forSaleData = {}; state.soldData = {}; state.isData = {}; state.ephemeraData = {};
    state.personalSheetId = 'SHEET';
    _currentEra = 'all';
    window.showRefItemPopup = function (t, i) { window._popups = (window._popups || []).concat([[t, i]]); };
    window.showToast = () => {};
    try { _prefSet('lv_dash_slots', JSON.stringify([{ id: 'sets' }, { id: 'collectionByType' }, null, null, null, null])); } catch (e) {}
    if (typeof _initBackButton === 'function') _initBackButton();
    ['auth-screen', 'beta-gate'].forEach(id => { const e = document.getElementById(id); if (e) e.style.display = 'none'; });
    document.getElementById('app').classList.add('active');
  });
  return { pg, errs };
}

const LOOK = `(() => {
  const vis = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const t = el => (el.textContent || '').replace(/\\s+/g, ' ').trim();
  const door = document.getElementById('rr-mysets-door');
  const cards = [...document.querySelectorAll('#browse-sets-cards [data-my-set-card]')].filter(vis);
  const rows = [...document.querySelectorAll('#browse-sets-tbody tr')].filter(vis);
  const cnt = document.getElementById('browse-sets-count');
  return {
    active: (document.querySelector('.page.active') || {}).id || '',
    tab: state._browseTab,
    owned: !!(state.filters && state.filters.owned),
    door: vis(door) ? t(door) : '',
    count: cnt ? t(cnt) : '',
    cards: cards.map(c => c.getAttribute('data-my-set-card')),
    cardText: Object.fromEntries(cards.map(c => [c.getAttribute('data-my-set-card'), t(c)])),
    rows: rows.map(r => r.getAttribute('data-my-set-key') || r.getAttribute('data-own-set-key') || (r.getAttribute('data-my-set-item') ? 'item:' + r.getAttribute('data-my-set-item') : t(r).slice(0, 30))),
    rowText: rows.map(t),
    backDash: !!document.getElementById('page-back-dash'),
    detail: (document.getElementById('item-detail-content') || {}).textContent ? (document.getElementById('item-detail-content').textContent || '').replace(/\\s+/g, ' ').slice(0, 400) : '',
    detailInv: String(window._lastDetailCopyInv || ''),
    backLabel: (document.querySelector('#page-itemdetail .rr-detail-back') || {}).textContent ? document.querySelector('#page-itemdetail .rr-detail-back').textContent.replace(/\\s+/g, ' ').trim() : '',
  };
})()`;
const sleep = (pg, ms) => pg.waitForTimeout(ms);

// A + B + C (phone) + E, in one page.
async function phoneWalk(browser, planted) {
  const { pg, errs } = await open(browser, PHONE, planted);
  const R = {};
  R.a = await pg.evaluate(() => {
    const items = rrOwnedSetItems();
    const v = _rrOwnedSetItemView(items.find(p => p.itemNum === '6-21787') || {});
    const vm = _rrOwnedSetItemView(items.find(p => p.itemNum === 'SET-99') || {});
    return { nums: items.map(p => p.itemNum), count: rrMySetsCount(), view: v, viewManual: vm,
             card: (() => { const c = CARD_CATALOG.find(x => x.id === 'sets'); const r = c.compute(state); return { value: String(r.value), onclick: String(c.onclick) }; })(),
             byType: (() => { const h = CARD_CATALOG.find(x => x.id === 'collectionByType').compute(state).html || ''; const o = {}; h.replace(/<span[^>]*>([^<]+)<\/span><span[^>]*>(\d+)<\/span>/g, (_, k, n) => { o[k] = Number(n); }); return o; })() };
  });
  await pg.click('#mnav-collection'); await sleep(pg, 300);
  R.coll = await pg.evaluate(LOOK);
  const door = await pg.$('#rr-mysets-door');
  if (door && await door.isVisible()) { await door.click(); await sleep(pg, 300); }
  R.list = await pg.evaluate(LOOK);
  // the search narrows every kind of row
  await pg.evaluate(() => { const s = document.getElementById('browse-sets-search'); s.value = '21787'; renderSetsTab(); });
  R.q1 = await pg.evaluate(LOOK);
  await pg.evaluate(() => { const s = document.getElementById('browse-sets-search'); s.value = 'club'; renderSetsTab(); });
  R.q2 = await pg.evaluate(LOOK);
  await pg.evaluate(() => { const s = document.getElementById('browse-sets-search'); s.value = ''; renderSetsTab(); });
  // tap the item card → its item page, by Inventory ID
  const c = await pg.$('#browse-sets-cards [data-my-set-card="item:103"]');
  if (c && await c.isVisible()) { await c.click(); await sleep(pg, 400); }
  R.itemPage = await pg.evaluate(LOOK);
  // its Back → My Sets again
  await pg.evaluate(() => { if (typeof _detailBackToBrowse === 'function') _detailBackToBrowse(); }); await sleep(pg, 350);
  R.afterBack = await pg.evaluate(LOOK);
  // E — the Sets chip in My Collection: the items by type, unchanged
  await pg.evaluate(() => { rrCollGroupOpen('Sets'); }); await sleep(pg, 350);
  R.chip = await pg.evaluate(() => ({ group: state.filters.group, tab: state._browseTab,
    cards: Array.from(document.querySelectorAll('#browse-cards .browse-card')).filter(c => c.getClientRects().length > 0 && !/SAMPLE/.test(c.textContent)).length }));
  R.errs = errs;
  await pg.close();
  return R;
}

// C (computer rows) + D (the Dashboard card's tap, with the filter left on).
async function deskWalk(browser, planted) {
  const { pg, errs } = await open(browser, DESK, planted);
  const R = {};
  await pg.click('.nav-item[onclick*="filterOwned"]'); await sleep(pg, 300);   // My Collection — leaves state.filters.owned on
  const door = await pg.$('#rr-mysets-door');
  if (door && await door.isVisible()) { await door.click(); await sleep(pg, 300); }
  R.list = await pg.evaluate(LOOK);
  const row = await pg.$('#browse-sets-tbody tr[data-my-set-item="104"]');
  if (row && await row.isVisible()) { await row.click(); await sleep(pg, 400); }
  R.itemPage = await pg.evaluate(LOOK);
  // D — to the Dashboard (the collection filter is still on), tap the Total Sets card
  await pg.evaluate(() => { showPage('dashboard'); if (typeof buildDashboard === 'function') buildDashboard(); }); await sleep(pg, 500);
  R.dash = await pg.evaluate(() => {
    const card = document.querySelector('.stat-card[title="Open Total Sets"]');
    return { active: (document.querySelector('.page.active') || {}).id, card: !!card, value: card ? (card.querySelector('.stat-value') || {}).textContent : '', ownedOn: !!(state.filters && state.filters.owned) };
  });
  const card = await pg.$('.stat-card[title="Open Total Sets"]');
  if (card) { await card.click(); await sleep(pg, 500); }
  R.fromDash = await pg.evaluate(LOOK);
  R.errs = errs;
  await pg.close();
  return R;
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const [P, D] = await Promise.all([phoneWalk(browser), deskWalk(browser)]);

  console.log('== A · every set you own, once ==');
  T('A1 the sets entered as one item: the two modern sets and the manual Set — not the piece of the own set, the want, or the box', P.a.nums, ['6-21787', '6-31705', 'SET-99']);
  T('A2 what the list says about one: the catalog row\'s words', P.a.view, { name: 'Blue Comet Passenger Set', year: '1999', maker: 'Lionel', gauge: 'O' });
  T('A3 a manual one: its own cells', P.a.viewManual, { name: 'Club Christmas Set', year: '1988', maker: 'Marx', gauge: '' });
  T('A4 rrMySetsCount = 2 My Sets rows + 3 items', P.a.count, 5);
  console.log('== B · one number, one list ==');
  T('B1 the Total Sets card says 5 and opens My Sets', P.a.card, { value: '5', onclick: 'rrOpenMySets()' });
  T('B2 Collection by Type\'s Sets line is still the items by type (4: the three and the own set\'s piece) — a My Sets row is a wrapper, never a line', P.a.byType.Sets, 4);
  T('B3 the My Sets button says 5', P.coll.door, '🎁 My Sets (5)');
  console.log('== C · the list ==');
  T('C1 phone: the two set cards, then the three item cards', P.list.cards, ['S1', 'S2', 'item:103', 'item:104', 'item:106']);
  T('C2 the count line says 5 sets', P.list.count, '5 sets');
  T('C3 an item card: number, catalog name, maker · year · gauge, ✓ Owned', P.list.cardText['item:103'], '6-21787Blue Comet Passenger SetLionel · 1999 · O✓ Owned');
  T('C4 the search narrows to one item', [P.q1.cards, P.q1.count], [['item:103'], '1 set']);
  T('C5 the search finds a set row and an item by name alike', P.q2.cards, ['S2', 'item:106']);
  T('C6 tapping an item card opens ITS item page (Inventory ID 103)', [P.itemPage.active, P.itemPage.detailInv], ['page-itemdetail', '103']);
  T('C6b its Back button says "Back to My Sets" (as a set\'s own page does)', P.itemPage.backLabel, 'Back to My Sets');
  T('C7 Back from it lands on My Sets', [P.afterBack.active, P.afterBack.tab, P.afterBack.owned, P.afterBack.cards.length], ['page-browse', 'sets', true, 5]);
  T('C8 computer: the two set rows, then the three item rows', D.list.rows, ['S1', 'S2', 'item:103', 'item:104', 'item:106']);
  T('C9 an item row opens its item page (Inventory ID 104)', [D.itemPage.active, D.itemPage.detailInv], ['page-itemdetail', '104']);
  console.log('== D · from the Dashboard ==');
  T('D1 the Total Sets card is on the Dashboard, saying 5, with My Collection\'s filter still on from the earlier visit', D.dash, { active: 'page-dashboard', card: true, value: '5', ownedOn: true });
  T('D2 its tap opens My Sets — the page shown, the Sets tab, 5 rows, Back to Dashboard bar', [D.fromDash.active, D.fromDash.tab, D.fromDash.owned, D.fromDash.rows.length, D.fromDash.backDash], ['page-browse', 'sets', true, 5, true]);
  console.log('== E · the Sets chip ==');
  T('E1 My Collection\'s Sets chip still lists the 4 items by type — the own set\'s piece too (the group filter, as every other chip)', [P.chip.group, P.chip.tab, P.chip.cards], ['Sets', 'items', 4]);
  T('page errors (phone, computer)', [P.errs, D.errs], [[], []]);

  console.log('== P · planted offenders ==');
  const B = rd('browse.js'), DB = rd('dashboard.js'), AC = rd('app-collection.js');
  const plant = (src, from, to, what) => { if (src.indexOf(from) < 0) throw new Error('plant anchor missing (' + what + '): ' + from.slice(0, 70)); return src.split(from).join(to); };
  const P1 = await phoneWalk(browser, { 'browse.js': plant(B, "  if (typeof _ownedGroupOf !== 'function') return [];\n  const setGids = {};", "  return [];\n  const setGids = {};", 'no items') });
  T('P1 the items left out of the list is caught (A1, A4, B3, C1 red)', [P1.a.nums, P1.a.count, P1.coll.door, P1.list.cards.length], [[], 2, '🎁 My Sets (2)', 2]);
  const P2 = await phoneWalk(browser, { 'browse.js': plant(B, "    if (g && setGids[g]) return false;   // a piece of a set listed above\n", '', 'piece listed twice') });
  T('P2 a set\'s piece listed twice is caught (A1 red: 6-11748 appears)', P2.a.nums.indexOf('6-11748') >= 0 && P2.a.count === 6, true);
  const P3 = await phoneWalk(browser, { 'browse.js': plant(B, "  }).join('') + itemList.map(function (r) {", "  }).join('') + [].map(function (r) {", 'items not drawn') });
  T('P3 the item rows not drawn is caught (C1 red; the count still says 5)', [P3.list.cards, P3.list.count], [['S1', 'S2'], '5 sets']);
  const P4 = await phoneWalk(browser, { 'browse.js': plant(B, ".filter(Boolean).length + rrOwnedSetItems().length;", ".filter(Boolean).length;", 'old count') });
  T('P4 the old count (rows alone) is caught (A4, B1, B3 red)', [P4.a.count, P4.a.card.value, P4.coll.door], [2, '2', '🎁 My Sets (2)']);
  const P5 = await deskWalk(browser, { 'dashboard.js': plant(DB, "id: 'sets', label: 'Total Sets', color: '#d35400', onclick: 'rrOpenMySets()',", "id: 'sets', label: 'Total Sets', color: '#d35400', onclick: _dashGroupTap('Sets'),", 'old card tap') });
  T('P5 the card opening the Sets chip again is caught (D2 red: the Items tab, not My Sets)', [P5.fromDash.active, P5.fromDash.tab], ['page-browse', 'items']);
  const P6 = await deskWalk(browser, { 'browse.js': plant(B, "  if (!(state.filters && state.filters.owned) || !(_pg && _pg.classList.contains('active'))) {", "  if (!(state.filters && state.filters.owned)) {", 'hidden page') });
  T('P6 the list drawn into a hidden page is caught (D2 red: the Dashboard stays on screen)', P6.fromDash.active, 'page-dashboard');
  const P7 = await phoneWalk(browser, { 'browse.js': plant(B, "    const tap = '_openOwnedByInvId(\\'' + rrJsArg(inv) + '\\')';", "    const tap = 'void 0';", 'dead item tap') });
  T('P7 an item card that opens nothing is caught (C6 red)', P7.itemPage.active, 'page-browse');

  const P8 = await phoneWalk(browser, { 'app-collection.js': plant(AC, "    _backLabel = RR_OWN_SETS.pageBack;\n", '', 'old item back label') });
  T('P8 the item page saying "Back to Collection" from My Sets is caught (C6b red)', P8.itemPage.backLabel, 'Back to Collection');
  await browser.close();
  console.log((fail ? 'FAILED' : 'GREEN') + '  one_sets_list_tests  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
