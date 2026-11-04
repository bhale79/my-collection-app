#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════
// YOUR OWN SET, FINISHED — the road   (real Chromium, the REAL app)
// 2026-11-03. [stated] Brad: "the ability for users to add their own unlisted
// sets to My Sets is a real gap" → "Yes" to PLAN_2026-11-03_OWN_SETS → v0.9.2105
// shipped the "My set isn't listed" form → 21:59 CT "yes" to finishing it.
// Measured on v0.9.2105: the own set's Full Entry saved a nameless, numberless,
// unmarked My Sets row the reader skipped, and its 2343 became Lionel's F3.
//
//   A  Add → Item Type "Set": an MTH set the catalog doesn't list, three pieces
//      (an MTH catalog piece, a number nobody lists, and 2343 — a number a
//      Lionel postwar item also has) → "My set isn't listed — continue with 3
//      items" → the form (Continue and Next both refuse with no name; a name
//      typed before tapping a maker survives) → the pieces → the summary names
//      it. Saved: name, number, year, condition, OWN-SET; the MTH piece keeps its
//      row, the other two MTH with NO catalog link (2343 is not the Lionel F3)
//   L  My Sets lists it, "Your set", with its pieces and maker; it opens its own
//      page ("Made by MTH"); older unlisted rows show; an own set numbered like a
//      catalog set never shows the catalog set
//   U  Update Info on the own set: Set # open, saves; a catalog set's stays locked
//   C  a Lionel Postwar catalog set adds as before
//   P  the form fits the iPhone
//   X  planted: the form skipped in a served copy → A2 red
// ═════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  own_sets_finish_road_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function ok(n, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (extra || ''))); cond ? pass++ : fail++; }
function read(f) { return fs.readFileSync(path.join(APP, f), 'utf8'); }
function plant(src, from, to, label) {
  if (src.indexOf(from) < 0) throw new Error('planted offender "' + label + '" no longer matches the source — update the test');
  return src.replace(from, to);
}
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' };
const LAPTOP = { viewport: { width: 1366, height: 768 } };

async function openApp(browser, opts, served) {
  const ctx = await browser.newContext(opts);
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await ctx.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://') && !u.startsWith('about:')) return r.abort();
    const name = u.split('?')[0].split('/').pop();
    if (served && served[name] != null) return r.fulfill({ body: served[name], contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(700);
  return { ctx, pg, errs };
}

const ROWS = [
  { itemNum: '30-4000-1', variation: '', itemType: 'Boxcar', description: 'MTH boxcar', _era: 'mth_o', _tab: 'MTH O', gauge: 'O', rowId: 'MTH4000' },
  { itemNum: '2343', variation: '', itemType: 'Diesel Locomotive', description: 'Santa Fe F3', roadName: 'Santa Fe', _era: 'pw', _tab: 'Lionel PW - Items', gauge: 'O', rowId: 'PW2343' },
];
const SETS = [ { setNum: '1467W', setName: 'Freight Set', year: '1955', gauge: 'O27', items: ['2343'], alts: [], _era: 'pw' } ];

async function scenario(pg, full) {
  return pg.evaluate(async ([ROWS, SETS, full]) => {
    const R = {};
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    state.masterData = ROWS.map(r => Object.assign({}, r));
    state.setData = SETS.map(s => Object.assign({}, s));
    _rebuildMasterIndex();
    state.personalData = {}; state.mySetsData = {}; state.isData = {}; state.personalSheetId = 'SHEET'; _currentEra = 'all';
    state.user = { name: 'Brad', email: 'brad@example.com' };
    try { localStorage.clear(); } catch (e) {}
    const appended = [], updates = [];
    window.sheetsAppend = async (id, range, rows) => { appended.push([range, rows[0]]); return 200 + appended.length; };
    window.sheetsUpdate = async (id, range, rows) => { updates.push([range, rows[0]]); return {}; };
    window.rrVerifiedRowUpdate = async () => true; window.rrRowStillIs = async () => true;
    window.driveEnsureSetup = async () => {}; window.driveUploadPhoto = async () => ({});
    window.buildDashboard = () => {}; window.loadPersonalData = async () => {};
    const toasts = []; window.showToast = (m) => { toasts.push(String(m)); };
    window.rrMaybeShowAddHelp = () => {};
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
    const F = PERSONAL_FIELD_INDEX;
    const cell = (row, f) => String(row[F[f]] == null ? '' : row[F[f]]).replace(/^'/, '');
    const cur = () => wizard.steps[wizard.step] || {};
    const btn = (re) => Array.from(document.querySelectorAll('#wizard-body button')).find(b => re.test(b.textContent.trim()));
    const setVal = (id, v) => { const i = document.getElementById(id); if (!i) return false; i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); return true; };
    const startSet = async () => {
      if (typeof _doCloseWizard === 'function' && window.wizard && wizard.steps && wizard.steps.length) { try { _doCloseWizard(); } catch (e) {} }
      await openWizard('collection'); await sleep(150);
      R.kindLabel = (Array.from(document.querySelectorAll('#wiz-kind-select option')).find(o => o.value === 'set') || {}).textContent || '';
      _wizSetKind('set'); await sleep(200);
    };

    // ── A: an MTH set the catalog doesn't list ──
    await startSet();
    wizard.data.set_knowsNum = 'No'; await wizardNext(); await sleep(120);
    wizard.data.set_loco = '30-4000-1'; await wizardNext(); await sleep(150);
    for (const n of ['30-7777-1', '2343']) { const i = document.getElementById('set-id-input'); i.value = n; window._setAddEntered(); await sleep(80); }
    const cont = btn(/isn.t listed/);
    R.aContText = cont ? cont.textContent.trim() : '';
    if (cont) cont.click(); await sleep(200);
    R.aStep1 = cur().id;
    R.aInfoFields = ['own-set-name', 'own-set-num', 'own-set-year'].every(id => !!document.getElementById(id)) && !!btn(/^MTH$/);
    toasts.length = 0;
    const own0 = btn(/^Continue/); if (own0) own0.click(); await sleep(120);
    R.aNoName = cur().id === 'set_ownInfo' && toasts.some(t => /set name/i.test(t));
    toasts.length = 0;
    await wizardNext(); await sleep(120);
    R.aNoNameNext = cur().id === 'set_ownInfo' && toasts.some(t => /set name/i.test(t));
    if (full) {
      const bd = document.getElementById('wizard-body');
      R.pSide = document.documentElement.scrollWidth <= window.innerWidth + 1 && (!bd || bd.scrollWidth <= bd.clientWidth + 1);
      R.pInputsFit = ['own-set-name', 'own-set-num', 'own-set-year'].every(id => { const r = document.getElementById(id).getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth + 1 && r.height >= 30; });
    }
    setVal('own-set-name', 'My MTH Freight'); setVal('own-set-num', '30-4122-1'); setVal('own-set-year', '2004');
    const m = btn(/^MTH$/); if (m) m.click(); await sleep(150);
    R.aNameKept = (document.getElementById('own-set-name') || {}).value === 'My MTH Freight' && (document.getElementById('own-set-year') || {}).value === '2004';
    const own1 = btn(/^Continue/); if (own1) own1.click(); await sleep(200);
    R.aStep3 = cur().type;
    const w = document.getElementById('se-worth'); if (w) w.value = '300';
    const fb = document.getElementById('se-full-btn'); if (fb) fb.click(); await sleep(400);
    R.aWalk = [];
    for (let i = 0; i < 3; i++) {
      R.aWalk.push(wizard.data.itemNum + ':' + ((wizard.matchedItem && wizard.matchedItem.rowId) || '-'));
      Object.assign(wizard.data, { condition: 7, allOriginal: 'Yes', hasBox: 'No', tenderMatch: 'none', setMatch: '' });
      try { await saveWizardItem(); } catch (e) { R.aErr = e.message; }
      await sleep(300);
    }
    for (let k = 0; k < 5 && cur().type !== 'confirm'; k++) { if (cur().id === 'set_hasBox') wizard.data.set_hasBox = 'No'; await wizardNext(); await sleep(150); }
    R.aSummary = (document.getElementById('wizard-body') || {}).textContent || '';
    await wizardNext(); await sleep(500);
    R.aItems = appended.filter(a => !/My Sets/.test(a[0])).map(a => [cell(a[1], 'itemNum'), cell(a[1], 'manufacturer'), cell(a[1], 'masterRowId')].join('|'));
    const ms = appended.find(a => /My Sets/.test(a[0]));
    R.aMySets = ms ? ms[1] : null;
    if (!full) return R;

    // ── L: My Sets ──
    // an older unlisted row (a number the catalog lacks) and one with no number at all
    state.mySetsData['900'] = { row: 50, setNum: '20-9999', setName: '', year: '', groupId: '', setId: 'SET-20-9999', inventoryId: '900' };
    state.mySetsData['901'] = { row: 51, setNum: '', setName: 'Grandpa’s set', year: '', groupId: '', setId: 'SET-', inventoryId: '901' };
    // an own set numbered like the catalog set 1467W
    state.mySetsData['902'] = { row: 52, setNum: '1467W', setName: 'My other 1467W', year: '', groupId: '', setId: 'OWN-SET', inventoryId: '902' };
    state.filters.owned = true; state._browseTab = 'sets';
    try { renderSetsTab(); } catch (e) { R.lErr = e.message; }
    const tb = document.getElementById('browse-sets-tbody');
    const ownTrs = tb ? Array.from(tb.querySelectorAll('tr[data-own-set-key]')) : [];
    R.lKeys = ownTrs.map(t => t.getAttribute('data-own-set-key')).sort().join(',');
    const mine = ownTrs.find(t => /My MTH Freight/.test(t.textContent));
    R.lMine = mine ? mine.textContent.replace(/\s+/g, ' ') : '';
    R.lCatalogRows = tb ? Array.from(tb.querySelectorAll('tr:not([data-own-set-key])')).map(t => t.textContent.replace(/\s+/g, ' ').trim()) : [];
    // tap it → its own page
    if (mine) { mine.click(); await sleep(400); }
    R.lPage = (document.querySelector('.page.active') || document.body).textContent.replace(/\s+/g, ' ');

    // ── U: Update Info ──
    const mineKey = Object.keys(state.mySetsData).find(k => state.mySetsData[k].setName === 'My MTH Freight');
    state.mySetsData[mineKey].row = 60;
    _nonItemDetailEdit('sets', mineKey); await sleep(200);
    const lbls = Array.from(document.querySelectorAll('label')).filter(l => /^Set #/.test(l.textContent));
    const setNumInp = lbls.length ? lbls[lbls.length - 1].parentElement.querySelector('input') : null;
    R.uOpen = !!setNumInp && !setNumInp.disabled;
    if (setNumInp) { setNumInp.value = '30-4122-9'; }
    const save = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Save Changes');
    updates.length = 0;
    if (save) save.click(); await sleep(400);
    R.uWrite = updates[0] || null;
    // a catalog set's Set # stays locked
    state.mySetsData['903'] = { row: 61, setNum: '1467W', setName: 'Freight Set', year: '1955', groupId: 'G', setId: 'SET-1467W', inventoryId: '903' };
    document.querySelectorAll('button').forEach(b => { if (b.textContent === 'Cancel') b.click(); });
    _nonItemDetailEdit('sets', '903'); await sleep(200);
    const lbls2 = Array.from(document.querySelectorAll('label')).filter(l => /^Set #/.test(l.textContent));
    const inp2 = lbls2.length ? lbls2[lbls2.length - 1].parentElement.querySelector('input') : null;
    R.uCatLocked = !!inp2 && inp2.disabled && /locked/.test(lbls2[lbls2.length - 1].textContent);
    document.querySelectorAll('button').forEach(b => { if (b.textContent === 'Cancel') b.click(); });

    // ── C: a Lionel Postwar catalog set ──
    appended.length = 0;
    await startSet();
    wizard.data.set_knowsNum = 'Yes'; await wizardNext(); await sleep(120);
    wizard.data.set_num = '1467W'; await wizardNext(); await sleep(150);
    window._confirmSetMatch('1467W'); await sleep(250);
    R.cStep = cur().type;
    R.cOwn = !!wizard.data._ownSet;
    const w2 = document.getElementById('se-worth'); if (w2) w2.value = '100';
    const fb2 = document.getElementById('se-full-btn'); if (fb2) fb2.click(); await sleep(400);
    Object.assign(wizard.data, { condition: 7, allOriginal: 'Yes', hasBox: 'No', tenderMatch: 'none', setMatch: '' });
    try { await saveWizardItem(); } catch (e) { R.cErr = e.message; }
    await sleep(300);
    for (let k = 0; k < 5 && cur().type !== 'confirm'; k++) { if (cur().id === 'set_hasBox') wizard.data.set_hasBox = 'No'; await wizardNext(); await sleep(150); }
    await wizardNext(); await sleep(500);
    const cms = appended.find(a => /My Sets/.test(a[0]));
    R.cMySets = cms ? cms[1] : null;
    R.cItem = appended.filter(a => !/My Sets/.test(a[0])).map(a => cell(a[1], 'itemNum') + '|' + cell(a[1], 'manufacturer') + '|' + cell(a[1], 'masterRowId')).join(',');
    return R;
  }, [ROWS, SETS, full]);
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const t0 = Date.now();
  for (const [name, dev] of [['laptop', LAPTOP], ['iPhone', PHONE]]) {
    const { ctx, pg, errs } = await openApp(browser, dev, null);
    const R = await scenario(pg, true).catch(e => ({ err: String(e && e.stack || e) }));
    if (R.err) { ok('[' + name + '] the road runs', false, R.err); await ctx.close(); continue; }
    const t = (s) => '[' + name + '] ' + s;
    ok(t('A0 the Item Type choice reads "Set" (any maker)'), R.kindLabel === 'Set', R.kindLabel);
    ok(t('A1 no catalog set picked → "My set isn\'t listed — continue with 3 items"'), /isn.t listed/.test(R.aContText) && /3 items/.test(R.aContText), R.aContText);
    ok(t('A2 → the own-set form: name, number, year and the maker buttons'), R.aStep1 === 'set_ownInfo' && R.aInfoFields, R.aStep1);
    ok(t('A3 its Continue refuses with no name, and says so'), R.aNoName);
    ok(t('A3b …and so does the wizard\'s Next'), R.aNoNameNext);
    ok(t('A4 a name typed before tapping the maker survives the tap'), R.aNameKept);
    ok(t('A5 → the set details, then each piece (2343 is NOT the Lionel F3)'), R.aStep3 === 'setEntryMode' && R.aWalk.join(',') === '30-4000-1:MTH4000,30-7777-1:-,2343:-', JSON.stringify([R.aStep3, R.aWalk]));
    ok(t('A6 the summary names the set, "Your set", its year and maker'), /My MTH Freight/.test(R.aSummary) && /Your set/.test(R.aSummary) && /2004/.test(R.aSummary) && /MTH/.test(R.aSummary), R.aSummary.slice(0, 160));
    ok(t('A7 the MTH piece keeps its MTH row; the other two are MTH with NO catalog link'),
       R.aItems.join(',') === '30-4000-1|MTH|MTH4000,30-7777-1|MTH|,2343|MTH|', JSON.stringify(R.aItems));
    ok(t('A8 My Sets gets the name, number, year, condition, worth and the own-set Set ID (OWN-SET)'),
       !!R.aMySets && R.aMySets[0] === '30-4122-1' && R.aMySets[1] === 'My MTH Freight' && R.aMySets[2] === '2004' && R.aMySets[3] === '7' && R.aMySets[4] === '300'
       && R.aMySets[7] === 'OWN-SET' && R.aMySets[9] === '', JSON.stringify(R.aMySets));
    ok(t('L1 My Sets lists the own set, the two older unlisted rows and the own "1467W" — apart from the catalog'),
       R.lKeys.split(',').length === 4 && ['900', '901', '902'].every(k => R.lKeys.indexOf(k) >= 0), R.lKeys + ' ' + (R.lErr || ''));
    ok(t('L2 the own set reads its number, name, maker, year, pieces and "Your set"'),
       /30-4122-1/.test(R.lMine) && /My MTH Freight/.test(R.lMine) && /MTH/.test(R.lMine) && /2004/.test(R.lMine) && /30-7777-1/.test(R.lMine) && /Your set/.test(R.lMine), R.lMine);
    ok(t('L3 the own set numbered 1467W never shows the catalog set 1467W'), R.lCatalogRows.length === 0, JSON.stringify(R.lCatalogRows));
    ok(t('L4 tapping it opens its own page — name, "Made by MTH"'), /My MTH Freight/.test(R.lPage) && /Made by/.test(R.lPage) && /MTH/.test(R.lPage), R.lPage.slice(0, 200));
    ok(t('U1 Update Info on an own set: the Set # is open'), R.uOpen);
    ok(t('U2 …and a new number saves to that row (its own-set Set ID kept)'), !!R.uWrite && /My Sets!A60:N60/.test(R.uWrite[0]) && R.uWrite[1][0] === '30-4122-9' && R.uWrite[1][7] === 'OWN-SET', JSON.stringify(R.uWrite));
    ok(t('U3 a catalog set\'s Set # stays locked'), R.uCatLocked);
    ok(t('C1 a Lionel Postwar catalog set: no own-set steps, straight to the set details'), R.cStep === 'setEntryMode' && !R.cOwn, R.cStep);
    ok(t('C2 …saved with ITS name, year and SET- id; its piece is the Lionel row'), !!R.cMySets && R.cMySets[0] === '1467W' && R.cMySets[1] === 'Freight Set' && R.cMySets[2] === '1955' && R.cMySets[7] === 'SET-1467W'
       && R.cItem === '2343|Lionel|PW2343', JSON.stringify([R.cMySets, R.cItem]));
    ok(t('P1 the new step fits — no sideways scroll, every box inside the screen'), R.pSide && R.pInputsFit, JSON.stringify([R.pSide, R.pInputsFit]));
    ok(t('P2 no page errors'), errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
  // ── X: the own-set step skipped in a served copy → A2/A8 go red ──
  {
    const served = { 'wizard-steps.js': plant(read('wizard-steps.js'), "skipIf: d => !d._ownSet },", "skipIf: d => true },", 'form skipped') };
    const { ctx, pg } = await openApp(browser, LAPTOP, served);
    const R = await scenario(pg, false).catch(e => ({ err: String(e) }));
    ok('X1 PLANTED the own-set form skipped: A2 can fail', !R.err && R.aStep1 !== 'set_ownInfo', R.err || R.aStep1);
    await ctx.close();
  }
  await browser.close();
  console.log('\n(' + Math.round((Date.now() - t0) / 1000) + ' s) ' + (fail ? 'FAILED' : 'ALL PASS') + '  —  own_sets_finish_road_tests: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
