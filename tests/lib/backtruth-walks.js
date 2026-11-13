// Shared by tests/backtruth_tests.js and tests/backtruth_review_tests.js:
// the real app in a real browser at phone size, and the Back walks.
// (2026-11-11 — one file became two so each stays inside the runner's time.)
const fs = require('fs'), path = require('path');
let chromium, webkit;
try { chromium = require('playwright').chromium; webkit = require('playwright').webkit; }
catch (e) { console.log('FAILED  —  the backtruth suites need playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', '..', 'app');
const rd = f => fs.readFileSync(path.join(APP, f), 'utf8');
const PHONE = { width: 390, height: 844 };
const TYPES = { js: 'application/javascript', css: 'text/css', html: 'text/html' };
const sleep = (pg, ms) => pg.waitForTimeout(ms);

// The real app with a small collection: two cars (one owned twice is not
// needed — two different numbers), an own set and an owned catalog set.
async function open(browser, planted) {
  const pg = await browser.newPage({ viewport: PHONE });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    const clean = u.split('?')[0];                       // the query string is stripped, or every plant passes vacuously
    const name = Object.keys(planted || {}).find(k => clean.endsWith('/' + k));
    if (name) return r.fulfill({ body: planted[name], contentType: TYPES[name.split('.').pop()] || 'text/plain' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(800);
  await pg.evaluate(() => {
    try { localStorage.clear(); } catch (e) {}
    state.masterData = [
      { itemNum: '2343', variation: '', itemType: 'Diesel Locomotive', _era: 'pw', _tab: 'Lionel PW - Items', description: 'F3 Diesel AA', roadName: 'Santa Fe' },
      { itemNum: '6464-1', variation: '', itemType: 'Boxcar', _era: 'pw', _tab: 'Lionel PW - Items', description: 'Boxcar', roadName: 'Western Pacific' },
      { itemNum: '3356', variation: '', itemType: 'Operating Car', _era: 'pw', _tab: 'Lionel PW - Items', description: 'Horse Car', roadName: 'Santa Fe' },
    ];
    _rebuildMasterIndex();
    state.setData = [
      { setNum: '1467W', setName: 'Erie Alco Freight', year: '1955', gauge: 'O27', items: ['2343', '6464-1'], alts: [], notes: '', _era: 'pw' },
    ];
    state.personalData = {
      '101': { itemNum: '6464-1', variation: '', owned: true, inventoryId: '101', row: 5, era: 'pw' },
      '121': { itemNum: '2343', variation: '', owned: true, inventoryId: '121', row: 6, era: 'pw' },
    };
    state.mySetsData = {
      '201': { row: 40, setNum: '30-4621', setName: 'TES DELEEME', year: '', groupId: '', setId: 'OWN-SET', inventoryId: '201', manufacturer: 'MTH' },
      '203': { row: 42, setNum: '1467W', setName: 'Erie Alco Freight', year: '1955', groupId: '', setId: 'SET-1467W', inventoryId: '203' },
    };
    state.wantData = {}; state.upgradeData = {}; state.forSaleData = {};
    state.soldData = { 'S1': { itemNum: '2026', variation: '', description: 'Steam Loco', salePrice: '90', dateSold: '2026-10-01' } };
    state.personalSheetId = 'SHEET';
    _currentEra = 'all';
    window.appConfirm = async () => true;
    window.buildDashboard = () => {};
    window._toasts = [];
    window.showToast = function (m) { window._toasts.push(String(m)); };
    if (typeof _initBackButton === 'function') _initBackButton();   // the app's own Back handling, as at start-up
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
  });
  return { pg, errs };
}
// Where the page is: the exact history step (Chromium's Navigation API), what
// that step says, what is on screen.
const AT = `(() => {
  const st = history.state || {};
  const dc = document.getElementById('item-detail-content');
  return {
    idx: navigation.currentEntry.index,
    page: st.appPage || '', d: st.d, back: st._back || '',
    active: ((document.querySelector('.page.active') || {}).id || '').replace('page-', ''),
    tab: state._browseTab || '',
    sets: !!(document.getElementById('browse-sets-panel') && document.getElementById('browse-sets-panel').getClientRects().length),
    item: dc ? (dc.textContent || '').replace(/\\s+/g, ' ') : '',
    stack: BackStack.size(), noTouch: BackStack.noTouch(),
  };
})()`;
// A Back press on the FLOOR leaves the app — in this page a real navigation
// away — so a walk never presses there (a planted run can end up on it).
const back = async pg => { await pg.evaluate(() => { if ((history.state || {}).appPage !== 'base') history.back(); }); await sleep(pg, 450); return pg.evaluate(AT); };
const at = pg => pg.evaluate(AT);
const openCard = async (pg, sel) => { await pg.click(sel); await sleep(pg, 400); };
const ITEM = n => `#page-browse [onclick*="showItemDetailPage"]`;

// A — a Back press goes down one step and adds none.
async function walkA(browser, planted) {
  const { pg, errs } = await open(browser, planted);
  const R = {};
  await pg.click('#mnav-collection'); await sleep(pg, 350);
  R.list = await at(pg);
  await pg.evaluate(() => _openOwnedByInvId('101')); await sleep(pg, 400);
  // a real touch, as the tap that opened it would be
  await pg.mouse.click(200, 300); await sleep(pg, 100);
  R.item = await at(pg);
  R.b1 = await back(pg);          // → the list
  R.b2 = await back(pg);          // → the Dashboard
  R.b3 = await back(pg);          // → the floor, the toast
  R.toasts = await pg.evaluate(() => window._toasts.slice());
  R.errs = errs;
  await pg.close();
  return R;
}
// B — My Sets.
async function walkB(browser, planted) {
  const { pg, errs } = await open(browser, planted);
  const R = {};
  await pg.click('#mnav-collection'); await sleep(pg, 300);
  await pg.click('#rr-mysets-door'); await sleep(pg, 300);
  await openCard(pg, '#browse-sets-cards [data-my-set-card="203"]');
  R.page = await at(pg);
  R.b1 = await back(pg);          // → My Sets
  R.b2 = await back(pg);          // → My Collection
  R.errs = errs;
  await pg.close();
  return R;
}
// C — each item step shows its own item; a copy that left is passed over.
async function walkC(browser, planted) {
  const { pg, errs } = await open(browser, planted);
  const R = {};
  const title = s => (/No\. ([0-9-]+)/.exec(s) || [])[1] || '';
  await pg.click('#mnav-collection'); await sleep(pg, 300);
  await pg.evaluate(() => _openOwnedByInvId('121')); await sleep(pg, 350);            // the 2343
  await pg.click('#rr-detail-nav button'); await sleep(pg, 350);                       // on-screen Back to Collection
  await pg.evaluate(() => _openOwnedByInvId('101')); await sleep(pg, 350);            // the 6464-1
  await pg.click('#rr-detail-nav button'); await sleep(pg, 350);                       // on-screen Back to Collection
  const a = await back(pg); R.back1 = [a.active, title(a.item)];                       // the 6464-1's own page
  const b = await back(pg); R.back2 = [b.active];                                      // the list before it
  const c = await back(pg); R.back3 = [c.active, title(c.item)];                       // the 2343's own page — NOT the 6464-1 drawn last
  // the T-2026-11-08-06 walk: open the 6464-1 again, sell it, ONE Back
  await pg.click('#mnav-collection'); await sleep(pg, 300);
  await pg.evaluate(() => _openOwnedByInvId('101')); await sleep(pg, 350);
  await pg.evaluate(() => { delete state.personalData['101']; rrGoToCollectionAfterRemove(); }); await sleep(pg, 400);
  await pg.mouse.click(200, 120); await sleep(pg, 100);                                // the Save tap came before; a touch stands in
  const before = await at(pg);
  const d1 = await back(pg);
  R.sold = { from: before.active, to: d1.active, onSoldCar: d1.active === 'itemdetail' && /6464-1/.test(d1.item) };
  R.errs = errs;
  await pg.close();
  return R;
}
// D — the Add window steps back and keeps its step.
async function walkD(browser, planted, closeAfterOne) {
  const { pg, errs } = await open(browser, planted);
  const R = {};
  await pg.click('#mnav-collection'); await sleep(pg, 300);
  await pg.evaluate(async () => { await openWizard('collection'); }); await sleep(pg, 500);
  await pg.evaluate(() => { wizard.step = Math.min(3, wizard.steps.length - 1); renderWizardStep(); }); await sleep(pg, 250);
  const W = `({ open: document.getElementById('wizard-modal').classList.contains('open'), step: wizard.step, idx: navigation.currentEntry.index, stack: BackStack.size(), back: (history.state || {})._back || '' })`;
  R.w0 = await pg.evaluate(W);
  await pg.evaluate(() => history.back()); await sleep(pg, 500);
  R.w1 = await pg.evaluate(W);
  if (!closeAfterOne) { await pg.evaluate(() => history.back()); await sleep(pg, 500); }
  R.w2 = await pg.evaluate(W);
  // close it the ordinary way: the page is back on its own step
  await pg.evaluate(() => { if (typeof _doCloseWizard === 'function') _doCloseWizard(); }); await sleep(pg, 500);
  R.closed = await at(pg);
  R.errs = errs;
  await pg.close();
  return R;
}
// E — the Dashboard's exit.
async function walkE(browser, planted) {
  const { pg, errs } = await open(browser, planted);
  const R = {};
  await pg.click('#mnav-collection'); await sleep(pg, 300);
  await pg.click('#mnav-dashboard'); await sleep(pg, 300);
  R.dash = await at(pg);
  R.b1 = await back(pg);                                   // the toast; on the floor
  R.toast1 = await pg.evaluate(() => window._toasts.length);
  await pg.mouse.click(200, 400); await sleep(pg, 450);    // a touch: staying
  R.touched = await at(pg);
  R.b2 = await back(pg);                                   // asks again
  R.toast2 = await pg.evaluate(() => window._toasts.length);
  R.errs = errs;
  await pg.close();
  return R;
}
// F — a pop-up opened with no touch since a Back; G — a reload inside a session.
async function walkFG(browser, planted) {
  const { pg, errs } = await open(browser, planted);
  const R = {};
  await pg.click('#mnav-collection'); await sleep(pg, 300);
  await pg.evaluate(() => _openOwnedByInvId('101')); await sleep(pg, 350);
  await pg.mouse.click(200, 300); await sleep(pg, 100);
  const onList = await back(pg);                           // on the list, no touch since
  await pg.evaluate(() => { window._pClosed = 0; BackStack.push('bt-pop', function () { window._pClosed++; }); });
  R.opened = await at(pg);
  R.sameStep = R.opened.idx === onList.idx;
  const b = await back(pg);                                // closes the pop-up; the list keeps its step
  R.afterBack = { idx: b.idx, active: b.active, stack: b.stack, closed: await pg.evaluate(() => window._pClosed) };
  R.listIdx = onList.idx;
  // G: steps written by an earlier load are still below after a reload
  R.seed = await pg.evaluate(() => {
    const before = navigation.currentEntry.index, len = history.length;
    history.replaceState({ rr: 1, s: 'an-earlier-load', appPage: 'browse', item: 0, d: 2 }, '', '');
    BackStack.seed({ appPage: 'dashboard', item: 0 });
    const st = history.state;
    return { sameIdx: navigation.currentEntry.index === before, sameLen: history.length === len, page: st.appPage, d: st.d, thisLoad: st.s === BackStack.load() };
  });
  R.errs = errs;
  await pg.close();
  return R;
}

// H — the item under a pop-up changes ("Which copy?" → the other copy).
async function walkH(browser, planted) {
  const { pg, errs } = await open(browser, planted);
  const R = {};
  await pg.evaluate(() => { state.personalData['102'] = { itemNum: '6464-1', variation: '', owned: true, inventoryId: '102', row: 7, era: 'pw' }; });
  await pg.click('#mnav-collection'); await sleep(pg, 300);
  await pg.evaluate(() => _openOwnedByInvId('101')); await sleep(pg, 350);
  R.item = await at(pg);
  const idx = await pg.evaluate(() => _masterIdxOf(findMaster('6464-1', '', { _era: 'pw' })));
  await pg.evaluate(i => rrShowCopyPicker(i), idx); await sleep(pg, 250);
  R.picker = await at(pg);
  await pg.click('#rr-copy-picker button[onclick*="\'102\'"]'); await sleep(pg, 450);   // the real button
  R.picked = await at(pg);
  R.pickedInv = await pg.evaluate(() => String(window._lastDetailCopyInv || ''));
  await pg.click('#rr-detail-nav button'); await sleep(pg, 350);                          // on-screen Back to Collection
  const b = await back(pg);
  R.back = [b.active, await pg.evaluate(() => String(window._lastDetailCopyInv || '')), /Copy 2 of 2/.test(b.item)];
  // the same through pop(): a pop-up closed by its own code, then another item drawn
  await pg.mouse.click(200, 120); await sleep(pg, 100);
  await pg.evaluate(() => { BackStack.push('bt-swap', function () {}); }); await sleep(pg, 100);
  await pg.evaluate(() => { BackStack.pop('bt-swap'); _openOwnedByInvId('121'); }); await sleep(pg, 450);
  await pg.click('#rr-detail-nav button'); await sleep(pg, 350);
  const b2 = await back(pg);
  R.back2 = [b2.active, /No\. 2343/.test(b2.item)];
  R.errs = errs;
  await pg.close();
  return R;
}
// I — the exit hold: what lifts it and what does not.
async function walkI(browser, planted) {
  const ctx = await browser.newContext({ viewport: PHONE, hasTouch: true });
  const { pg, errs } = await open(ctx, planted);
  const R = {};
  await pg.click('#mnav-collection'); await sleep(pg, 300);
  await pg.click('#mnav-dashboard'); await sleep(pg, 300);
  const floor = await back(pg);                                   // the toast; on the floor
  R.floor = [floor.page, floor.d];
  // the app's own el.click() is not the person's finger
  await pg.evaluate(() => document.body.click()); await sleep(pg, 200);
  const u = await at(pg); R.untrusted = [u.page, u.idx - floor.idx, u.noTouch];
  // the START of a swipe (a finger down, moved, taken over by the system) is not a tap
  let swipe = 'not run';
  try {
    const cdp = await ctx.newCDPSession(pg);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 4, y: 400 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 90, y: 402 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await sleep(pg, 300);
    const a = await at(pg); swipe = [a.page, a.idx - floor.idx];
  } catch (e) { swipe = 'CDP: ' + e.message; }
  R.swipe = swipe;
  // a held Alt key (Alt+Left is a Back press) and a mouse button only pressed down are not taps either
  await pg.keyboard.down('Alt'); await sleep(pg, 200);
  const k = await at(pg); R.alt = [k.page, k.idx - floor.idx];
  await pg.keyboard.up('Alt');
  // nobody pressed Back again: after the hold runs out the app steps back up by itself, adding nothing
  const len0 = await pg.evaluate(() => navigation.entries().length);
  await sleep(pg, 2600);
  const t = await at(pg);
  R.timeout = [t.page, t.idx - floor.idx, t.active, (await pg.evaluate(() => navigation.entries().length)) - len0];
  const again = await back(pg);
  R.again = [again.page, await pg.evaluate(() => window._toasts.filter(x => /back again to exit/i.test(x)).length)];
  // a finished tap lifts it
  await pg.mouse.click(200, 400); await sleep(pg, 300);
  const tap = await at(pg); R.tap = [tap.page, tap.idx - again.idx];
  R.errs = errs;
  await ctx.close();
  return R;
}
// J — Back restores every kind of item page, each showing its own.
async function walkJ(browser, planted) {
  const { pg, errs } = await open(browser, planted);
  const R = {};
  const touch = async pg => { await pg.keyboard.press('Shift'); await sleep(pg, 100); };   // a touch that presses nothing on the page
  const away = async () => { await pg.evaluate(() => showPage('prefs')); await sleep(pg, 300); await touch(pg); };
  await pg.click('#mnav-collection'); await sleep(pg, 300);
  // a catalog row with no copy (no Inventory ID: the row itself is the identity)
  await pg.evaluate(() => showItemDetailPage(_masterIdxOf(findMaster('3356', '', { _era: 'pw' })))); await sleep(pg, 350);
  await away();
  let b = await back(pg); R.row = [b.active, /No\. 3356/.test(b.item)]; await touch(pg);
  // the same row from the Want side
  await pg.evaluate(() => showItemDetailPage(_masterIdxOf(findMaster('3356', '', { _era: 'pw' })), '', { wantMode: true })); await sleep(pg, 350);
  await away();
  b = await back(pg); R.want = [b.active, /Wanted: 3356/.test(b.item)]; await touch(pg);
  // a set page
  await pg.evaluate(() => showNonItemDetailPage('sets', '203')); await sleep(pg, 350);
  await away();
  b = await back(pg); R.set = [b.active, /1467W/.test(b.item)]; await touch(pg);
  // a sale record
  await pg.evaluate(() => showSoldDetailPage('S1')); await sleep(pg, 350);
  await away();
  b = await back(pg); R.sold = [b.active, /2026/.test(b.item)]; await touch(pg);
  // a step whose record is gone is passed over, and "the item on screen" is not left pointing at it
  await pg.evaluate(() => showSoldDetailPage('S1')); await sleep(pg, 350);
  await away();
  await pg.evaluate(() => { delete state.soldData['S1']; });
  const cur0 = await pg.evaluate(() => window._rrNavItemCur);
  b = await back(pg);
  R.gone = [b.active !== 'itemdetail' || !/2026/.test(b.item), (await pg.evaluate(() => window._rrNavItemCur)) === cur0 || b.active === 'itemdetail'];
  R.errs = errs;
  await pg.close();
  return R;
}
// K — pop-ups: one with no step closed by its own button; one opened on the
// floor; the Add window closed from the page it was opened on.
async function walkK(browser, planted) {
  const { pg, errs } = await open(browser, planted);
  const R = {};
  await pg.click('#mnav-collection'); await sleep(pg, 300);
  await pg.evaluate(() => _openOwnedByInvId('101')); await sleep(pg, 350);
  await pg.mouse.click(200, 300); await sleep(pg, 100);
  const onList = await back(pg);
  await pg.evaluate(() => { window._pClosed = 0; BackStack.push('bt-own0', function () { window._pClosed++; }); });
  await pg.evaluate(() => BackStack.pop('bt-own0')); await sleep(pg, 400);       // its own button
  const c = await at(pg);
  R.own0 = [c.idx - onList.idx, c.stack, c.active];
  // twice registered = ONE step (the copy picker is wired, then bound for a click outside)
  await pg.mouse.click(200, 120); await sleep(pg, 100);
  const before = await at(pg);
  await pg.evaluate(() => { BackStack.push('bt-twice', function () {}); BackStack.push('bt-twice', function () { window._twice = 1; }); }); await sleep(pg, 150);
  const two = await at(pg);
  await pg.evaluate(() => BackStack.pop('bt-twice')); await sleep(pg, 400);
  const after = await at(pg);
  R.twice = [two.idx - before.idx, two.stack, after.idx - before.idx, after.stack, after.back];
  // a pop-up opened on the floor with no touch, then a tap, then Back at once (review F3)
  await pg.click('#mnav-dashboard'); await sleep(pg, 300);
  const floor = await back(pg);
  await pg.evaluate(() => { window._fClosed = 0; BackStack.push('bt-floor', function () { window._fClosed++; }); });
  await pg.mouse.click(200, 400); await sleep(pg, 60);
  const f = await back(pg);
  R.floorPop = [floor.page, await pg.evaluate(() => window._fClosed), f.stack, f.page !== 'base'];
  // a walk forward asked for at the top of the history (nowhere to go) must not swallow the next real Back (F3)
  await pg.mouse.click(200, 400); await sleep(pg, 200);
  await pg.evaluate(() => { window._gClosed = 0; BackStack.push('bt-blind', function () { window._gClosed++; }); }); await sleep(pg, 150);
  await pg.evaluate(() => { BackStack.stay(); }); await sleep(pg, 60);
  await pg.evaluate(() => history.back()); await sleep(pg, 450);
  R.blind = [await pg.evaluate(() => window._gClosed), (await at(pg)).stack];
  await pg.mouse.click(200, 400); await sleep(pg, 200);
  // the Add window opened on a page other than My Collection and closed: still on that page (v0.9.1191)
  await pg.evaluate(() => showPage('prefs')); await sleep(pg, 300);
  await pg.mouse.click(200, 300); await sleep(pg, 100);
  const pre = await at(pg);
  await pg.evaluate(async () => { await openWizard('collection'); }); await sleep(pg, 500);
  await pg.evaluate(() => { if (typeof _doCloseWizard === 'function') _doCloseWizard(); }); await sleep(pg, 600);
  const post = await at(pg);
  R.wizFrom = [pre.active, post.active, post.page, post.idx - pre.idx, post.stack];
  R.errs = errs;
  await pg.close();
  return R;
}

// ── S — source ────────────────────────────────────────────────────────────
// Full-line // comments are dropped (never a /* */ regex — rules_testing).
const code = src => src.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
function scanAdds(files) {      // every place a history step is ADDED, by file
  const out = [];
  Object.keys(files).forEach(f => {
    const c = code(files[f]);
    const n = (c.match(/\bpushState\s*\(/g) || []).length;
    if (n) out.push(f + ':' + n);
  });
  return out.sort();
}
function scanTrail(files) { return Object.keys(files).filter(f => /\.js$/.test(f)).filter(f => /_rrPageTrail/.test(code(files[f]))).sort(); }
function appFiles(over) {
  const files = {};
  fs.readdirSync(APP).filter(f => /\.(js|html)$/.test(f)).forEach(f => { files[f] = (over && over[f]) || rd(f); });
  return files;
}
// The body of back-stack.js's Back handler.
function popBody(src) {
  const a = src.indexOf('function _onPopState(e) {');
  const b = src.indexOf('\n  }\n', a);
  return a < 0 || b < 0 ? '' : src.slice(a, b);
}
// The body of app.js's Back handler.
function appPopBody(src) {
  const a = src.indexOf("window.addEventListener('popstate', function(e) {", src.indexOf('function _initBackButton()'));
  const b = src.indexOf('\n  });\n}', a);
  return a < 0 || b < 0 ? '' : src.slice(a, b);
}
function plant(src, from, to, what) {
  if (src.split(from).length !== 2) throw new Error('planting "' + what + '": its anchor is not there exactly once');
  return src.replace(from, to);
}
const launch = () => chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
module.exports = { fs, path, APP, rd, chromium, webkit, launch, open, at, back, sleep, walkA, walkB, walkC, walkD, walkE, walkFG, walkH, walkI, walkJ, walkK, code, scanAdds, scanTrail, appFiles, popBody, appPopBody, plant };
