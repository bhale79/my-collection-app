#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// MY SETS — 2026-11-08 mysets (real Chromium, the REAL app)
//
// Hand-test T-2026-11-04-03 FAILED (testing chat, 2026-11-07, Brad's Android
// phone and Work Chrome): an own set saved and its page worked, but "no screen
// in the app shows the My Sets list. The phone's SETS button opens Complete
// Sets (the 472 catalog sets) … My Collection's Show chips, Type list and More
// menu have no Sets; nothing on the page reads 'My Sets'."
// The list existed — renderSetsTab in My Collection mode — with no door to it,
// and on a phone it drew nothing (the app hides every table on a phone).
//
//   A  phone: from My Collection (bottom-bar Collection) a visible "My Sets"
//      button opens the list; an own set and an owned catalog set are both
//      cards, the own set badged "Your set"; tapping each opens its set page
//      (its Back button says "Back to My Sets" and goes there); "Back to My
//      Collection" works; a key and a name with quotes still open
//   B  computer: the same from the sidebar's My Collection, as table rows
//   C  every set you own is a row (a second copy, a set saved with a year the
//      catalog doesn't print) and the button's number is the number of rows;
//      a number the catalog holds twice shows the right record
//   E  (review) the button and the list follow every repaint: a set arriving
//      with a later sheet load, a save, a removal on the My Sets list
//   F  (review) the phone's device Back (a real history.back()): from My Sets
//      to My Collection; from a set's page to My Sets, then to My Collection
//   G  (review) no button while picking rows to share
//   D  the Master Catalog's sets are unchanged: its Sets list shows every
//      catalog set, opens the catalog popup, shows no own set and no My Sets
//      frame; no door there; the phone's bottom-bar Sets still opens Complete
//      Sets (the catalog)
//   S  source: words in config.js, every set key escaped (rrJsArg)
//   P  PLANTED offenders — each must turn its check red
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  mysets_tests needs playwright and it is not installed.'); process.exit(1); }
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
const QKEY = "q'7";                       // a key with a quote in it (the escaping, in the running app)
const QNAME = 'Club\'s "Big" Train';

async function open(browser, viewport, planted, opts) {
  opts = opts || {};
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
  await pg.evaluate(([QKEY, QNAME, noSets]) => {
    try { localStorage.clear(); } catch (e) {}
    state.masterData = [
      { itemNum: '2343', variation: '', itemType: 'Diesel Locomotive', _era: 'pw', _tab: 'Lionel PW - Items', description: 'F3 Diesel AA', roadName: 'Santa Fe' },
      { itemNum: '6464-1', variation: '', itemType: 'Boxcar', _era: 'pw', _tab: 'Lionel PW - Items', description: 'Boxcar', roadName: 'Western Pacific' },
    ];
    _rebuildMasterIndex();
    state.setData = [
      // the same number in another era's set list, FIRST — a number-only pick takes it
      { setNum: '1467W', setName: 'Wrong Era Set', year: '1955', gauge: 'HO', items: ['X1'], alts: [], notes: '', _era: 'mpc' },
      { setNum: '1467W', setName: 'Erie Alco Freight', year: '1955', gauge: 'O27', items: ['2343', '6464-1'], alts: [], notes: '', _era: 'pw' },
      { setNum: '2124W', setName: 'Passenger Set', year: '1950', gauge: 'O', items: ['2332'], alts: [], notes: '', _era: 'pw' },
      { setNum: '2503WS', setName: 'Five-Car Hudson Steam Freight', year: '1954', gauge: 'O', items: ['2055'], alts: [], notes: '', _era: 'pw' },
    ];
    state.personalData = {
      '101': { itemNum: '6464-1', variation: '', owned: true, inventoryId: '101', row: 5, era: 'pw', groupId: 'OWN-A', manufacturer: 'MTH' },
      '121': { itemNum: '2343', variation: '', owned: true, inventoryId: '121', row: 6, era: 'pw', groupId: 'SET-1467W-1' },
    };
    state.mySetsData = noSets ? {} : {
      // the collector's own set (Brad's test: 30-4621 "TES DELEEME", Made by MTH)
      '201': { row: 40, setNum: '30-4621', setName: 'TES DELEEME', year: '', groupId: 'OWN-A', setId: 'OWN-SET', inventoryId: '201', manufacturer: 'MTH', condition: '7', estWorth: '1' },
      // a catalog set he owns (its piece is a Postwar 2343)
      '203': { row: 42, setNum: '1467W', setName: 'Erie Alco Freight', year: '1955', groupId: 'SET-1467W-1', setId: 'SET-1467W', inventoryId: '203' },
      // a second copy of it, saved with a year the catalog doesn't print
      '204': { row: 43, setNum: '1467W', setName: 'Erie Alco Freight', year: '1956', groupId: 'SET-1467W-2', setId: 'SET-1467W', inventoryId: '204' },
      // a key and a name with quotes in them
      [QKEY]: { row: 44, setNum: '', setName: QNAME, year: '1999', groupId: '', setId: 'OWN-SET', inventoryId: '205', manufacturer: 'Atlas' },
    };
    state.wantData = {}; state.upgradeData = {}; state.forSaleData = {}; state.soldData = {};
    state.personalSheetId = 'SHEET';
    _currentEra = 'all';
    window.showRefItemPopup = function (t, i) { window._popups = (window._popups || []).concat([[t, i]]); };
    window.appConfirm = async () => true;
    window.rrRemoveRowConfirmed = async () => true;
    window.buildDashboard = () => {};
    window.showToast = () => {};
    if (typeof _initBackButton === 'function') _initBackButton();   // the app's own Back handling, as at start-up
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
  }, [QKEY, QNAME, !!opts.noSets]);
  return { pg, errs };
}

// What is on screen now (visible = has a box and is not display:none up the tree).
const LOOK = `(() => {
  const vis = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const door = document.getElementById('rr-mysets-door');
  const panel = document.getElementById('browse-sets-panel');
  const head = document.getElementById('rr-mysets-head');
  const cards = [...document.querySelectorAll('#browse-sets-cards [data-my-set-card]')].filter(vis);
  const rows = [...document.querySelectorAll('#browse-sets-tbody tr')].filter(vis);
  const active = (document.querySelector('.page.active') || {}).id || '';
  const t = el => (el.textContent || '').replace(/\\s+/g, ' ').trim();
  const cnt = document.getElementById('browse-sets-count');
  return {
    active,
    tab: state._browseTab,
    door: vis(door) ? t(door) : '',
    panel: vis(panel),
    head: vis(head) ? t(head) : '',
    count: cnt ? t(cnt) : '',
    cards: cards.map(t),
    cardByKey: Object.fromEntries(cards.map(c => [c.getAttribute('data-my-set-card'), t(c)])),
    rows: rows.map(t),
    ownBadgeCards: cards.filter(c => c.querySelector('[data-own-set]')).map(t),
    ownBadgeRows: rows.filter(r => r.querySelector('[data-own-set]')).map(t),
  };
})()`;
const sleep = (pg, ms) => pg.waitForTimeout(ms);
const doorN = d => { const m = String(d || '').match(/\((\d+)\)/); return m ? +m[1] : -1; };
const PAGE = () => ({ active: (document.querySelector('.page.active') || {}).id,
  page: (document.getElementById('item-detail-content').textContent || '').replace(/\s+/g, ' '), popups: window._popups || [] });

// `part` (planted runs): walk only as far as the checks it must turn red —
// 'list', 'own', 'quoted', 'back' (Back to My Collection), 'bottom' (bottom-bar Sets).
async function phoneWalk(browser, planted, part) {
  const { pg, errs } = await open(browser, PHONE, planted);
  const R = { isPhone: await pg.evaluate(() => rrIsPhone()) };
  const done = async () => { R.errs = errs; await pg.close(); return R; };
  await pg.click('#mnav-collection'); await sleep(pg, 250);
  R.coll = await pg.evaluate(LOOK);
  if (part === 'bottom') return bottomSets();
  const door = await pg.$('#rr-mysets-door');
  if (door && await door.isVisible()) { await door.click(); await sleep(pg, 250); }
  R.list = await pg.evaluate(LOOK);
  const tapCard = async (key) => {
    await pg.evaluate(() => { document.getElementById('item-detail-content').innerHTML = ''; window._popups = []; });
    const c = await pg.$('#browse-sets-cards [data-my-set-card="' + key.replace(/"/g, '\\"') + '"]');
    if (!c || !(await c.isVisible())) return { tapped: false };
    await c.click(); await sleep(pg, 350);
    return Object.assign({ tapped: true }, await pg.evaluate(PAGE));
  };
  const headBack = async () => {
    const back = await pg.$('#rr-mysets-head button');
    if (back && await back.isVisible()) { await back.click(); await sleep(pg, 250); }
    R.backToColl = await pg.evaluate(LOOK);
  };
  if (part === 'list') return done();
  if (part === 'quoted') { R.quoted = await tapCard(QKEY); return done(); }
  if (part === 'back') { await headBack(); return done(); }
  R.own = await tapCard('201');
  // the page's own Back button → My Sets again
  R.ownBackLabel = await pg.evaluate(() => { const b = document.querySelector('#rr-detail-nav button'); return b ? b.textContent.replace(/\s+/g, ' ').trim() : ''; });
  if (part === 'own') return done();
  const pb = await pg.$('#rr-detail-nav button');
  if (pb) { await pb.click(); await sleep(pg, 300); }
  R.afterBack = await pg.evaluate(LOOK);
  R.cat = await tapCard('203');
  await pg.evaluate(() => { if (typeof _detailBackToBrowse === 'function') _detailBackToBrowse(); }); await sleep(pg, 300);
  R.quoted = await tapCard(QKEY);
  await pg.evaluate(() => { if (typeof _detailBackToBrowse === 'function') _detailBackToBrowse(); }); await sleep(pg, 300);
  // Back to My Collection
  await headBack();
  return bottomSets();
  // the phone's bottom-bar Sets: Complete Sets, the catalog — unchanged
  async function bottomSets() {
    await pg.evaluate(() => { const m = document.getElementById('mnav-sets'); if (m) m.scrollIntoView(); });
    await pg.click('#mnav-sets'); await sleep(pg, 300);
    R.bottomSets = await pg.evaluate(() => ({ active: (document.querySelector('.page.active') || {}).id,
      text: ((document.getElementById('sets-cards') || {}).textContent || '').replace(/\s+/g, ' ') }));
    return done();
  }
}

// F — the device Back button, with real history traversals.
async function backWalk(browser, planted) {
  const { pg, errs } = await open(browser, PHONE, planted);
  const R = {};
  // LEDGER 2026-11-11 (backtruth): a Back press on the FLOOR leaves the app
  // (that is "press back again to exit" working) — in this page that is a real
  // navigation away. A planted walk can reach the floor (P14: no Back entry →
  // the Dashboard → the floor), so the walk stops pressing there.
  const back = async () => { await pg.evaluate(() => { if ((history.state || {}).appPage !== 'base') history.back(); }); await sleep(pg, 450); return pg.evaluate(LOOK); };
  await pg.click('#mnav-dashboard'); await sleep(pg, 150);
  await pg.click('#mnav-collection'); await sleep(pg, 250);
  const door = await pg.$('#rr-mysets-door');
  if (door && await door.isVisible()) { await door.click(); await sleep(pg, 250); }
  R.opened = await pg.evaluate(LOOK);
  R.back1 = await back();                                   // My Sets → My Collection
  const door2 = await pg.$('#rr-mysets-door');
  if (door2 && await door2.isVisible()) { await door2.click(); await sleep(pg, 250); }
  const c = await pg.$('#browse-sets-cards [data-my-set-card="201"]');
  if (c && await c.isVisible()) { await c.click(); await sleep(pg, 350); }
  R.onPage = await pg.evaluate(LOOK);
  R.back2 = await back();                                   // the set's page → My Sets
  R.back3 = await back();                                   // My Sets → My Collection
  R.errs = errs;
  await pg.close();
  return R;
}

// E — the button and the list follow every repaint.
async function followWalk(browser, planted) {
  const R = {};
  {
    const { pg, errs } = await open(browser, DESK, planted, { noSets: true });
    await pg.click('.nav-item[onclick*="filterOwned"]'); await sleep(pg, 250);
    R.coldBefore = await pg.evaluate(LOOK);
    // the sheet load that brings the sets in later ends with a repaint (app-data.js → renderBrowse)
    await pg.evaluate(() => { state.mySetsData = { '203': { row: 42, setNum: '1467W', setName: 'Erie Alco Freight', year: '1955', groupId: 'SET-1467W-1', setId: 'SET-1467W', inventoryId: '203' } }; renderBrowse(); });
    await sleep(pg, 200);
    R.coldAfter = await pg.evaluate(LOOK);
    // a set saved (the wizard's save ends with renderBrowse)
    await pg.evaluate(() => { state.mySetsData['301'] = { row: 50, setNum: '', setName: 'Saved Now', year: '', groupId: '', setId: 'OWN-SET', inventoryId: '301' }; renderBrowse(); });
    await sleep(pg, 200);
    R.saved = await pg.evaluate(LOOK);
    R.errsA = errs;
    await pg.close();
  }
  {
    const { pg, errs } = await open(browser, DESK, planted);
    await pg.click('.nav-item[onclick*="filterOwned"]'); await sleep(pg, 250);
    await pg.click('#rr-mysets-door').catch(() => {}); await sleep(pg, 250);
    R.beforeRemove = await pg.evaluate(LOOK);
    await pg.evaluate(async () => { await _removeOwnedSet('204'); }); await sleep(pg, 300);
    R.afterRemove = await pg.evaluate(LOOK);
    // a background refresh while My Sets is open: a set gone from the sheet
    await pg.evaluate(() => { delete state.mySetsData['201']; renderBrowse(); }); await sleep(pg, 200);
    R.afterRefresh = await pg.evaluate(LOOK);
    const b = await pg.$('#rr-mysets-head button'); if (b) { await b.click(); await sleep(pg, 250); }
    R.collAfter = await pg.evaluate(LOOK);
    // G — share mode hides the button; ending it brings it back
    await pg.evaluate(() => startShareMode('collection')); await sleep(pg, 250);
    R.sharing = await pg.evaluate(LOOK);
    await pg.evaluate(() => cancelShareMode()); await sleep(pg, 250);
    R.shareDone = await pg.evaluate(LOOK);
    R.errsB = errs;
    await pg.close();
  }
  return R;
}

// `part` (planted runs): 'list' (My Collection and My Sets), 'cat' (+ a catalog
// set's tap), 'master' (My Collection, then straight to the Master Catalog).
async function deskWalk(browser, planted, part) {
  const { pg, errs } = await open(browser, DESK, planted);
  const R = { isPhone: await pg.evaluate(() => rrIsPhone()) };
  const done = async () => { R.errs = errs; await pg.close(); return R; };
  await pg.click('.nav-item[onclick*="filterOwned"]'); await sleep(pg, 250);
  R.coll = await pg.evaluate(LOOK);
  if (part === 'master') return master();
  const door = await pg.$('#rr-mysets-door');
  if (door && await door.isVisible()) { await door.click(); await sleep(pg, 250); }
  R.list = await pg.evaluate(LOOK);
  const tapRow = async (attr, key) => {
    await pg.evaluate(() => { document.getElementById('item-detail-content').innerHTML = ''; window._popups = []; });
    const r = await pg.$('#browse-sets-tbody tr[' + attr + '="' + key + '"] td:nth-child(2)');
    if (!r || !(await r.isVisible())) return { tapped: false };
    await r.click(); await sleep(pg, 350);
    return Object.assign({ tapped: true }, await pg.evaluate(PAGE));
  };
  if (part === 'list') return done();
  if (part === 'cat') { R.cat = await tapRow('data-my-set-key', '204'); return done(); }
  R.own = await tapRow('data-own-set-key', '201');
  await pg.evaluate(() => { if (typeof _detailBackToBrowse === 'function') _detailBackToBrowse(); }); await sleep(pg, 300);
  R.afterBack = await pg.evaluate(LOOK);
  R.cat = await tapRow('data-my-set-key', '204');
  return master();
  // ── D: the Master Catalog ──
  async function master() {
    await pg.click('.nav-item[onclick*="resetFilters"]'); await sleep(pg, 250);
    R.mCatalog = await pg.evaluate(LOOK);
    await pg.evaluate(() => { const s = document.getElementById('browse-sets-search'); if (s) s.value = ''; renderBrowseTab('sets'); }); await sleep(pg, 200);
    R.mSets = await pg.evaluate(LOOK);
    await pg.evaluate(() => { window._popups = []; });
    const first = await pg.$('#browse-sets-tbody tr td:nth-child(2)');
    if (first) { await first.click(); await sleep(pg, 200); }
    R.mPopup = await pg.evaluate(() => ({ popups: window._popups || [], active: (document.querySelector('.page.active') || {}).id }));
    return done();
  }
}

// Every set opener in browse.js: `showNonItemDetailPage(\'sets\',\'' + <X> + '\')` — X must be rrJsArg(…).
const SET_OPENERS = src => (src.match(/showNonItemDetailPage\(\\'sets\\',\\'' \+ ([^']*?) \+ '\\'\)/g) || []);
const ALL_ESCAPED = src => { const o = SET_OPENERS(src); return o.length >= 3 && o.every(x => /\+ rrJsArg\(/.test(x)); };

// Walks run side by side (a few pages at once) so the suite stays well inside
// the quick tier's time limit; every check still reads its own walk's result.
function pool(n) {
  let live = 0; const q = [];
  const next = () => { if (live >= n || !q.length) return; live++; const [fn, ok, bad] = q.shift(); fn().then(ok, bad).finally(() => { live--; next(); }); };
  return fn => new Promise((ok, bad) => { q.push([fn, ok, bad]); next(); });
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const B = rd('browse.js'), CSS = rd('app.css'), HTML = rd('index.html'), CFG = rd('config.js'), AC = rd('app-collection.js'), BS = rd('back-stack.js');
  const run = pool(6);
  try {
    // start every walk now; read each one where its checks are
    const pA = run(() => phoneWalk(browser)), pF = run(() => backWalk(browser)), pE = run(() => followWalk(browser)), pD = run(() => deskWalk(browser));
    // ── A — the phone ─────────────────────────────────────────────────
    const A = await pA;
    T('setup: the page is a phone', A.isPhone, true);
    T('A1 phone, My Collection: a visible button reads "My Sets (4)"', /My Sets \(4\)/.test(A.coll.door), true);
    T('A2 phone: the button opens the My Sets list, headed "My Sets" with a way back', [A.list.panel, /My Sets/.test(A.list.head), /Back to My Collection/.test(A.list.head)], [true, true, true]);
    T('A3 phone: every set you own is a card (4)', A.list.cards.length, 4);
    T('A4 phone: the own set is a card with its name, badged "Your set"', /30-4621/.test(A.list.cardByKey['201'] || '') && /TES DELEEME/.test(A.list.cardByKey['201']) && /Your set/.test(A.list.cardByKey['201']) && /MTH/.test(A.list.cardByKey['201']), true);
    T('A5 phone: the owned catalog set is a card with its name, "✓ Owned", not "Your set"', A.list.cards.filter(c => /1467W/.test(c) && /Erie Alco Freight/.test(c) && /✓ Owned/.test(c) && !/Your set/.test(c)).length, 2);
    T('A5b phone: a catalog set\'s card counts the pieces you saved with it (1 piece; the other copy none)', [/1 piece/.test(A.list.cardByKey['203'] || ''), /piece/.test(A.list.cardByKey['204'] || '')], [true, false]);
    T('A6 phone: the door hides while the list is open', A.list.door, '');
    T('A7 phone: tapping the own set opens ITS page (name, Made by MTH)', [A.own.tapped, A.own.active, /TES DELEEME/.test(A.own.page || ''), /Made by\s*MTH/.test(A.own.page || '')], [true, 'page-itemdetail', true, true]);
    T('A7b phone: the set page\'s Back button says "Back to My Sets"', A.ownBackLabel, 'Back to My Sets');
    T('A8 phone: that Back button comes back to My Sets', [A.afterBack.panel, A.afterBack.cards.length], [true, 4]);
    T('A9 phone: tapping the owned catalog set opens its set page, not the catalog popup', [A.cat.tapped, A.cat.active, /Erie Alco Freight|1467W/.test(A.cat.page || ''), /In Collection/.test(A.cat.page || ''), (A.cat.popups || []).length], [true, 'page-itemdetail', true, true, 0]);
    T('A11 phone: a set whose key and name hold quotes shows its name and opens its page', [/Club's "Big" Train/.test(A.list.cardByKey[QKEY] || ''), A.quoted.tapped, A.quoted.active, /Club's "Big" Train/.test(A.quoted.page || '')], [true, true, 'page-itemdetail', true]);
    T('A10 phone: "Back to My Collection" returns to the list, and the door is back', [A.backToColl.tab, A.backToColl.panel, /My Sets \(4\)/.test(A.backToColl.door)], ['items', false, true]);
    T('D1 phone: the bottom-bar Sets still opens Complete Sets — the catalog, not your sets', [A.bottomSets.active, /2124W/.test(A.bottomSets.text), /2503WS/.test(A.bottomSets.text), /TES DELEEME/.test(A.bottomSets.text)], ['page-sets', true, true, false]);
    T('no page errors (phone)', A.errs, []);

    // ── F — the device Back button ───────────────────────────────────
    const F = await pF;
    T('F0 setup: My Sets opened', [F.opened.tab, F.opened.panel], ['sets', true]);
    T('F1 device Back on My Sets → My Collection (not the Dashboard)', [F.back1.active, F.back1.tab, F.back1.panel, /My Sets/.test(F.back1.door)], ['page-browse', 'items', false, true]);
    T('F2 setup: a set\'s page opened from My Sets', F.onPage.active, 'page-itemdetail');
    T('F3 device Back on the set\'s page → My Sets', [F.back2.active, F.back2.tab, F.back2.panel], ['page-browse', 'sets', true]);
    T('F4 device Back again → My Collection', [F.back3.active, F.back3.tab, F.back3.panel], ['page-browse', 'items', false]);
    T('no page errors (device Back)', F.errs, []);

    // ── E / G — follows every repaint; hidden while sharing ──────────
    const E = await pE;
    T('E1 cold start, no sets yet: no button', E.coldBefore.door, '');
    T('E2 the sets arrive with a later load (renderBrowse): the button appears, "My Sets (1)"', doorN(E.coldAfter.door), 1);
    T('E3 a set saved (renderBrowse after the save): the number follows, "My Sets (2)"', doorN(E.saved.door), 2);
    T('E4 setup: My Sets open with 4 rows', [E.beforeRemove.panel, E.beforeRemove.rows.length], [true, 4]);
    T('E5 Remove on the My Sets list: the row leaves the list at once, and the count says 3', [E.afterRemove.panel, E.afterRemove.rows.length, E.afterRemove.rows.some(r => /1956/.test(r)), E.afterRemove.count], [true, 3, false, '3 sets']);
    T('E6 a background refresh while My Sets is open: a set gone from the sheet leaves the list', [E.afterRefresh.rows.length, E.afterRefresh.rows.some(r => /TES DELEEME/.test(r))], [2, false]);
    T('E7 back on My Collection the button says "My Sets (2)"', doorN(E.collAfter.door), 2);
    T('G1 picking rows to share: no My Sets button', E.sharing.door, '');
    T('G2 sharing ended: the button is back', doorN(E.shareDone.door), 2);
    T('no page errors (follow)', [E.errsA, E.errsB], [[], []]);

    // ── B/C/D — the computer ──────────────────────────────────────────
    const D = await pD;
    T('setup: the page is a computer', D.isPhone, false);
    T('B1 computer, My Collection: a visible button reads "My Sets (4)"', /My Sets \(4\)/.test(D.coll.door), true);
    T('B2 computer: it opens the list, headed "My Sets"', [D.list.panel, /My Sets/.test(D.list.head)], [true, true]);
    T('B3 computer: the own set is a row with its name, badged "Your set"', D.list.ownBadgeRows.filter(r => /TES DELEEME/.test(r) && /Your set/.test(r)).length, 1);
    T('B4 computer: the owned catalog set is a row, "✓ Owned", not "Your set"', D.list.rows.filter(r => /1467W/.test(r) && /Erie Alco Freight/.test(r) && /✓ Owned/.test(r) && !/Your set/.test(r)).length, 2);
    T('B5 computer: the phone cards stay hidden (the table is the list)', D.list.cards.length, 0);
    T('B6 computer: tapping the own set opens its page', [D.own.tapped, D.own.active, /TES DELEEME/.test(D.own.page || '')], [true, 'page-itemdetail', true]);
    T('B7 computer: Back from the set page comes back to My Sets', [D.afterBack.panel, D.afterBack.rows.length], [true, 4]);
    T('B8 computer: tapping a catalog set you own opens its set page, not the catalog popup', [D.cat.tapped, D.cat.active, /In Collection/.test(D.cat.page || ''), (D.cat.popups || []).length], [true, 'page-itemdetail', true, 0]);
    T('C1 every set you own is a row: the second copy and the 1956 one both list (4 rows)', D.list.rows.length, 4);
    T('C2 the button\'s number is the number of rows', doorN(D.coll.door), D.list.rows.length);
    T('C3 a number the set catalog holds twice shows the record the set was saved from (O27, not the other era\'s HO)', [D.list.rows.filter(r => /1467W/.test(r)).every(r => /O27/.test(r) && !/HO|Wrong Era/.test(r))], [true]);
    T('D2 Master Catalog: no My Sets button', D.mCatalog.door, '');
    T('D3 Master Catalog Sets list: the catalog\'s sets, no own set, no My Sets frame',
      [['2124W', '2503WS'].every(n => D.mSets.rows.some(r => r.indexOf(n) >= 0)), D.mSets.rows.some(r => /TES DELEEME|Big/.test(r)), D.mSets.head, D.mSets.ownBadgeRows.length], [true, false, '', 0]);
    T('D4 Master Catalog Sets list: the set you own still says "✓ Owned"', D.mSets.rows.some(r => /Erie Alco Freight/.test(r) && /✓ Owned/.test(r)), true);
    T('D5 Master Catalog Sets list: a tap still opens the catalog popup', [D.mPopup.popups.length, (D.mPopup.popups[0] || [])[0], D.mPopup.active], [1, 'set', 'page-browse']);
    T('no page errors (computer)', D.errs, []);

    // ── S — source ────────────────────────────────────────────────────
    const words = CFG.slice(CFG.indexOf('const RR_OWN_SETS = {'), CFG.indexOf('window.RR_OWN_SETS = RR_OWN_SETS'));
    T('S1 the words live in config.js RR_OWN_SETS (door, heading, back, page back, mark) and none says "AI"',
      [/door:\s+'(?:\u{1F381}|\\ud83c\\udf81) My Sets \(\{n\}\)'/u.test(words), /myTitle:\s+'My Sets'/.test(words), /back:\s+'(?:\u2190|\\u2190) Back to My Collection'/.test(words), /pageBack:\s+'Back to My Sets'/.test(words), /ownedTag:/.test(words), /\bAI\b/.test(words)], [true, true, true, true, true, false]);
    T('S2 the door\'s words come from RR_OWN_SETS.door', /btn\.textContent = RR_OWN_SETS\.door\.replace\('\{n\}', n\);/.test(B), true);
    T('S3 every set opener in browse.js passes its key through rrJsArg (at least the 3 kinds of row)', ALL_ESCAPED(B), true);
    T('S4 the bottom-bar Sets button is untouched (Complete Sets)', /id="mnav-sets" onclick="showPage\('sets', this\); buildSetsPage\(\);"/.test(HTML), true);
    T('S5 My Sets\' Back goes through the ONE back stack (BackStack.push / pop / drop)', /BackStack\.push\(_RR_MYSETS_BACK,/.test(B) && /BackStack\.pop\(_RR_MYSETS_BACK\)/.test(B) && /function drop\(id\)/.test(BS) && /drop:  drop,/.test(BS), true);

    // ── P — planted offenders ─────────────────────────────────────────
    // every plant made and every planted walk started first (they run side by side), then checked in turn
    const plant = (src, from, to, label) => { const out = src.replace(from, to); T('P  plant applied (' + label + ')', out !== src, true); return out; };
    const noDoor = plant(B, "function _rrMySetsDoorSync() {\n  const title = document.querySelector('#page-browse > .page-title');", "function _rrMySetsDoorSync() {\n  const title = null;", 'no door');
    const P1ap = run(() => phoneWalk(browser, { 'browse.js': noDoor }, 'list'));
    const P1bp = run(() => deskWalk(browser, { 'browse.js': noDoor }, 'list'));
    const noCards = plant(CSS, '#browse-sets-panel.rr-mysets #browse-sets-cards { display: flex;', '#browse-sets-panel.rr-mysets #browse-sets-cards { display: none;', 'phone cards hidden');
    const P2p = run(() => phoneWalk(browser, { 'app.css': noCards }, 'list'));
    const noBadge = plant(B, "? '<span data-own-set=\"1\" style=\"color:var(--green);font-size:0.75rem;font-weight:700;white-space:nowrap\">' + rrEsc(RR_OWN_SETS.listTag) + '</span>'", "? ''", 'no badge on the card');
    const P3p = run(() => phoneWalk(browser, { 'browse.js': noBadge }, 'list'));
    const noPieces = plant(B, "const mine = (typeof rrMySetItems === 'function') ? rrMySetItems(ms) : [];", 'const mine = [];', 'catalog card piece count');
    const P3bp = run(() => phoneWalk(browser, { 'browse.js': noPieces }, 'list'));
    // 2026-11-14 (onesets): the card's opener is `tap || showNonItemDetailPage(…)` now — a set entered as one item hands its own tap in.
    const deadCard = plant(B, "data-my-set-card=\"' + rrEsc(k) + '\" onclick=\"' + (tap || 'showNonItemDetailPage(\\'sets\\',\\'' + rrJsArg(k) + '\\')') + '\"", "data-my-set-card=\"' + rrEsc(k) + '\"", 'dead card');
    const P4p = run(() => phoneWalk(browser, { 'browse.js': deadCard }, 'own'));
    const oldCatRow = plant(B, "'<tr data-my-set-key=\"' + rrEsc(k) + '\" onclick=\"showNonItemDetailPage(\\'sets\\',\\'' + rrJsArg(k) + '\\')\"", "'<tr data-my-set-key=\"' + rrEsc(k) + '\" onclick=\"showRefItemPopup(\\'set\\',0)\"", 'catalog row → popup');
    const P5p = run(() => deskWalk(browser, { 'browse.js': oldCatRow }, 'cat'));
    const oneEach = plant(B, '    catRows.push(entry);\n', '    if (!catRows.some(function (x) { return String(x[1].setNum || \'\').toLowerCase() === setKey; })) catRows.push(entry);\n', 'second copy dropped');
    const P6p = run(() => deskWalk(browser, { 'browse.js': oneEach }, 'list'));
    const leak = plant(B, 'const ownList = !inColl ? [] : ownRows.filter(', 'const ownList = ownRows.filter(', 'own sets in the catalog');
    const P7p = run(() => deskWalk(browser, { 'browse.js': leak }, 'master'));
    const mTap = plant(B, 'onclick="showRefItemPopup(&apos;set&apos;,${si})"', 'onclick="void 0"', 'catalog tap changed');
    const P8p = run(() => deskWalk(browser, { 'browse.js': mTap }, 'master'));
    // 2026-11-14 (onesets, review): the cheap conditions are asked first (`here`), the count only where the door could show.
    const doorEverywhere = plant(B, "const here = !!(state.filters && state.filters.owned) && (state._browseTab || 'items') === 'items' && !picking;", "const here = true;", 'door everywhere');
    const P9p = run(() => deskWalk(browser, { 'browse.js': doorEverywhere }, 'master'));
    const bottom = plant(HTML, `id="mnav-sets" onclick="showPage('sets', this); buildSetsPage();"`, `id="mnav-sets" onclick="rrOpenMySets();"`, 'bottom bar Sets → My Sets');
    const P10p = run(() => phoneWalk(browser, { 'index.html': bottom }, 'bottom'));
    const noBack = plant(B, "head.innerHTML = '<button type=\"button\" class=\"btn\" onclick=\"renderBrowseTab(\\'items\\')\"", "head.innerHTML = '<button type=\"button\" class=\"btn\"", 'dead back button');
    const P11p = run(() => phoneWalk(browser, { 'browse.js': noBack }, 'back'));
    const raw = B.split("showNonItemDetailPage(\\'sets\\',\\'' + rrJsArg(k) + '\\')").join("showNonItemDetailPage(\\'sets\\',\\'' + k + '\\')");   // 2026-11-14 (onesets): every opener, row or card, with or without the `tap ||` in front
    const P12p = run(() => phoneWalk(browser, { 'browse.js': raw }, 'quoted'));
    const noFollow = plant(B, '  _rrMySetsFollow();\n  // v0.9.985 (perf)', '  // v0.9.985 (perf)', 'repaint forgets My Sets');
    const P13p = run(() => followWalk(browser, { 'browse.js': noFollow }));
    const noBackEntry = plant(B, "function _rrMySetsBackSync() {\n  if (typeof BackStack === 'undefined' || !BackStack) return;", "function _rrMySetsBackSync() {\n  return;", 'no Back entry');
    const P14p = run(() => backWalk(browser, { 'browse.js': noBackEntry }));
    const noDrop = plant(B, "if (!pg.classList.contains('active') && BackStack.has(_RR_MYSETS_BACK) && typeof BackStack.drop === 'function') BackStack.drop(_RR_MYSETS_BACK);", 'void 0;', 'entry not dropped');
    const P15p = run(() => backWalk(browser, { 'browse.js': noDrop }));
    const shareDoor = plant(B, "=== 'items' && !picking;\n  const n = here", "=== 'items';\n  const n = here", 'door while sharing');
    const P16p = run(() => followWalk(browser, { 'browse.js': shareDoor }));
    const oldLabel = plant(AC, "(fromMySets && typeof RR_OWN_SETS !== 'undefined') ? RR_OWN_SETS.pageBack : 'Back to Collection'", "'Back to Collection'", 'old back label');
    const P17p = run(() => phoneWalk(browser, { 'app-collection.js': oldLabel }, 'own'));
    const numOnly = plant(B, "  if (Object.keys(eras).length) narrow(function (s) { return !!s._era && !!eras[s._era]; });\n  const nm = String((ms && ms.setName) || '').trim().toLowerCase();\n  if (nm) narrow(", "  const nm = '';\n  if (nm) narrow(", 'number-only pick');
    const P18p = run(() => deskWalk(browser, { 'browse.js': numOnly }, 'list'));
    // P1 the door never shown (the old app: no way in)
    const P1a = await P1ap;
    T('P1 no door is caught on the phone (A1 red)', /My Sets \(4\)/.test(P1a.coll.door), false);
    T('P1 …and the list is never reached on the phone (A2 red)', P1a.list.panel, false);
    const P1b = await P1bp;
    T('P1 no door is caught on the computer (B1 red)', /My Sets \(4\)/.test(P1b.coll.door), false);
    // P2 the phone draws no cards (the old app: the table, hidden on a phone)
    const P2 = await P2p;
    T('P2 a phone with no cards is caught (A3 red)', P2.list.cards.length, 0);
    // P3 the own set's card loses its "Your set" badge
    const P3 = await P3p;
    T('P3 an own set card with no "Your set" is caught (A4 red)', /Your set/.test(P3.list.cardByKey['201'] || ''), false);
    // P3b the catalog card counts nothing again
    const P3b = await P3bp;
    T('P3b a catalog card without your pieces is caught (A5b red)', /1 piece/.test(P3b.list.cardByKey['203'] || ''), false);
    // P4 a card that opens nothing
    const P4 = await P4p;
    T('P4 a card that opens nothing is caught (A7 red)', P4.own.active === 'page-itemdetail', false);
    // P5 the catalog set you own opens the catalog popup again (the old row)
    const P5 = await P5p;
    T('P5 the catalog popup on a set you own is caught (B8 red)', [P5.cat.active === 'page-itemdetail', (P5.cat.popups || []).length > 0], [false, true]);
    // P6 one row per catalog set number again (a second copy dropped)
    const P6 = await P6p;
    T('P6 a dropped second copy is caught (C1 red)', P6.list.rows.length === 4, false);
    T('P6 …and the button\'s number no longer matches the rows (C2 red)', doorN(P6.coll.door) === P6.list.rows.length, false);
    // P7 own sets leak into the Master Catalog's list
    const P7 = await P7p;
    T('P7 an own set in the Master Catalog\'s list is caught (D3 red)', P7.mSets.rows.some(r => /TES DELEEME/.test(r)), true);
    // P8 the Master Catalog's row tap changed
    const P8 = await P8p;
    T('P8 a changed Master Catalog tap is caught (D5 red)', P8.mPopup.popups.length, 0);
    // P9 the door shown on the Master Catalog too
    const P9 = await P9p;
    T('P9 a door on the Master Catalog is caught (D2 red)', P9.mCatalog.door !== '', true);
    // P10 the bottom-bar Sets turned into My Sets (Complete Sets lost)
    const P10 = await P10p;
    T('P10 a bottom-bar Sets that no longer opens Complete Sets is caught (D1 red)', P10.bottomSets.active === 'page-sets', false);
    T('P10 …and S4 goes red on it', /id="mnav-sets" onclick="showPage\('sets', this\); buildSetsPage\(\);"/.test(bottom), false);
    // P11 the way back does nothing
    const P11 = await P11p;
    T('P11 a dead "Back to My Collection" is caught (A10 red)', P11.backToColl.tab === 'items' && !P11.backToColl.panel, false);
    // P12 an unescaped key: the source check AND the running app go red
    T('P  plant applied (unescaped key)', raw !== B, true);
    T('P12 an unescaped key is caught by the source check (S3 red)', ALL_ESCAPED(raw), false);
    const P12 = await P12p;
    T('P12 …and in the running app the quoted set no longer opens (A11 red)', P12.quoted.active === 'page-itemdetail', false);
    // P13 (review 1/2) the repaint path forgets My Sets: no button after a later load, a save; a removed row stays
    const P13 = await P13p;
    T('P13 no button after the sets arrive later is caught (E2 red)', doorN(P13.coldAfter.door) === 1, false);
    T('P13 a stale number after a save is caught (E3 red)', doorN(P13.saved.door) === 2, false);
    T('P13 a removed row left on the list is caught (E5 red)', P13.afterRemove.rows.length === 3, false);
    // P14 (review 3) no Back entry: device Back leaves My Sets for the page before My Collection
    const P14 = await P14p;
    T('P14 device Back that skips My Collection is caught (F1 red)', P14.back1.active === 'page-browse' && P14.back1.tab === 'items', false);
    // P15 (review 3) the entry not dropped when a set's page opens on top: Back on that page is swallowed
    const P15 = await P15p;
    T('P15 a stale Back entry under the set\'s page is caught (F3 red)', P15.back2.active === 'page-browse' && P15.back2.tab === 'sets', false);
    // P16 (review 4) the button shown while sharing
    const P16 = await P16p;
    T('P16 a My Sets button while picking rows to share is caught (G1 red)', P16.sharing.door === '', false);
    // P17 (review 5) the set page's Back says "Back to Collection" again
    const P17 = await P17p;
    T('P17 the old "Back to Collection" from My Sets is caught (A7b red)', P17.ownBackLabel === 'Back to My Sets', false);
    // P18 (review 6) the catalog record picked by number alone (the first 1467W in the catalog)
    const P18 = await P18p;
    T('P18 a number-only pick of the catalog record is caught (C3 red)', P18.list.rows.filter(r => /1467W/.test(r)).every(r => /O27/.test(r) && !/HO|Wrong Era/.test(r)), false);
  } catch (e) {
    console.log('FAIL  crashed: ' + (e && e.stack || e)); fail++;
  } finally {
    await browser.close();
  }
  console.log((fail ? 'FAILED' : 'ALL PASS') + '  —  mysets_tests: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
