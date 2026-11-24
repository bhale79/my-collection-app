#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// FOUND UNDER ANOTHER TYPE (foundas)   (real Chromium, the REAL app)
// 2026-11-23. Customer Bob (bobbers800@) picked MTH + Flatcar, typed 30-72264 —
// the catalog has it as an MTH GONDOLA — and got "No item found", pressed Next
// and typed it in by hand. [stated] Brad 16:46 CT "are we going to fix the typ
// issue", 16:54 CT "yes" (PLAN_2026-11-23_FOUND_UNDER_OTHER_TYPE.md), 16:55 CT
// "emergency ship it".
//
//   F  MTH · Flatcar · 30-72264: the box says "30-72264 is in the Master Catalog
//      as MTH Gondola" + Show it; the old "other makers or eras" line is not
//      shown; Next does NOT slip into a hand entry (the step stays, a toast says
//      where it is); Show it sets Type = Gondola (Maker stays MTH), the row is
//      listed, picked, and step 2 / the save hold its Row ID
//   G  the era alone hides it: Lionel · Postwar · 2999 (a Pre-War-only number)
//      → "as Lionel Prewar Boxcar"; Show it sets Era = Pre-War, the row shows
//      …and Next goes on as before (the era alone only shows the line)
//   W  the Want list: the line shows, Next goes on, the add stays on the Want list
//   M  another MAKER only (MTH · 2343, a Lionel number): never "as Lionel …" —
//      makers reuse numbers; the plain "elsewhere" line, Next goes on
//   B  a Boxes-tab row of the same number does not spoil it (6462)
//   O  Show it with a value the drop-down lacks changes nothing, wipes nothing
//   (W, M, B, O, G3 added after the independent review of 2026-11-23)
//   H  spread over several makers / eras (Lionel · Postwar · 1511): NO found-as
//      line, the plain "elsewhere" line as before, Next goes on as before
//   N  a number nowhere: no found-as line, Next goes on as before
//   P  planted offenders in a served copy of the app — each must turn F red
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  found_as_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function ok(n, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (extra || ''))); cond ? pass++ : fail++; }
function read(f) { return fs.readFileSync(path.join(APP, f), 'utf8'); }
function plant(src, from, to, label) {
  if (src.indexOf(from) < 0) throw new Error('planted offender "' + label + '" no longer matches the source — update the test');
  return src.replace(from, to);
}
const LAPTOP = { viewport: { width: 1366, height: 768 } };

async function openApp(browser, served) {
  const ctx = await browser.newContext(LAPTOP);
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
  { itemNum: '30-72264', variation: '', itemType: 'Gondola', description: 'RailKing North Pole Gondola Car w/LED Christmas Lights & Lighted Snowman', roadName: 'North Pole', yearProd: '2025', _era: 'mth', _tab: 'MTH O', gauge: 'O', rowId: 'MTH72264' },
  { itemNum: '30-72262', variation: '', itemType: 'Gondola', description: 'RailKing Christmas Gondola Car', roadName: 'Christmas', yearProd: '2025', _era: 'mth', _tab: 'MTH O', gauge: 'O', rowId: 'MTH72262' },
  { itemNum: '30-76001', variation: '', itemType: 'Flatcar', description: 'RailKing Flat Car', roadName: 'Union Pacific', yearProd: '2020', _era: 'mth', _tab: 'MTH O', gauge: 'O', rowId: 'MTH76001' },
  { itemNum: '2999', variation: '', itemType: 'Boxcar', description: 'Pre-War boxcar', roadName: '', yearProd: '1938', _era: 'prewar', _tab: 'Lionel Pre-War', gauge: 'O', rowId: 'PRE2999' },
  { itemNum: '1511', variation: '', itemType: 'Steam Locomotive', description: '0-4-0 Locomotive (O)', roadName: '', yearProd: '1936-1937', _era: 'prewar', _tab: 'Lionel Pre-War', gauge: 'O', rowId: 'PRE1511A' },
  { itemNum: '1511', variation: '', itemType: 'Boxcar', description: "CSX Link 50' Rib-sided Boxcar", roadName: 'CSX', yearProd: '1998', _era: 'am_s', _tab: 'American Models S', gauge: 'S', rowId: 'AMS1511' },
  { itemNum: '2343', variation: '', itemType: 'Diesel Locomotive', description: 'Santa Fe F3', roadName: 'Santa Fe', yearProd: '1950', _era: 'pw', _tab: 'Lionel PW - Items', gauge: 'O', rowId: 'PW2343' },
  { itemNum: '6462', variation: '', itemType: 'Gondola', description: 'NYC Gondola', roadName: 'New York Central', yearProd: '1949', _era: 'pw', _tab: 'Lionel PW - Items', gauge: 'O', rowId: 'PW6462' },
  { itemNum: '6462', variation: '', itemType: 'Box', description: 'Box for 6462', roadName: '', yearProd: '1949', _era: 'pw', _tab: '__BOXES__', gauge: 'O', rowId: 'PWB6462' },
];

async function scenario(pg) {
  return pg.evaluate(async (ROWS) => {
    const R = {};
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const BOXTAB = (typeof SHEET_TABS !== 'undefined' && SHEET_TABS.boxes) || 'Lionel PW - Boxes';
    state.masterData = ROWS.map(r => Object.assign({}, r, r._tab === '__BOXES__' ? { _tab: BOXTAB } : {}));
    _rebuildMasterIndex();
    state.personalData = {}; state.isData = {}; state.personalSheetId = 'SHEET'; _currentEra = 'all';
    state.user = { name: 'Tester', email: 'tester@example.test' };
    try { localStorage.clear(); } catch (e) {}
    const appended = [];
    window.sheetsAppend = async (id, range, rows) => { appended.push(rows[0]); return 200 + appended.length; };
    window.rrVerifiedRowUpdate = async () => true; window.rrRowStillIs = async () => true;
    window.rrWhereIsRow = async (sid, tab, row) => ({ ok: true, row: row });
    window.driveEnsureSetup = async () => {}; window.driveEnsureItemFolder = async (n) => 'FOLDER-' + n; window.driveUploadPhoto = async () => ({});
    window.buildDashboard = () => {}; window.renderBrowse = () => {}; window.loadPersonalData = async () => {};
    const toasts = []; window.showToast = (m) => { toasts.push(String(m)); }; window.rrMaybeShowAddHelp = () => {};
    window._getAllErasMasterForSearch = async () => {}; window._allErasSearchCache = null;
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
    const F = PERSONAL_FIELD_INDEX;
    const cell = (row, f) => String(row[F[f]] == null ? '' : row[F[f]]).replace(/^'/, '');
    const sugg = () => document.getElementById('wiz-suggestions');
    const rows = () => Array.from(sugg().querySelectorAll('[data-idx]'));
    const nf = () => sugg().querySelector('[data-nothing-found]');
    const stepType = () => (wizard.steps[wizard.step] || {}).type;
    const setSel = (id, v) => { const s = document.getElementById(id); if (!s) return false; s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); return s.value === v; };
    const type = async (v) => {
      const i = document.getElementById('wiz-input'); i.value = v;
      i.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(330);
    };
    const fresh = async (mfr, era, tab) => {
      try { localStorage.setItem('lv_add_mfr', mfr || ''); localStorage.setItem('lv_add_era', era || ''); localStorage.removeItem('lv_add_scale'); } catch (e) {}
      if (typeof _doCloseWizard === 'function' && window.wizard && wizard.steps && wizard.steps.length) { try { _doCloseWizard(); } catch (e) {} }
      await openWizard(tab || 'collection'); wizard.data._era = 'all'; await sleep(150);
      if (stepType() !== 'itemNumGrouping') { for (let k = 0; k < 4 && stepType() !== 'itemNumGrouping'; k++) { await wizardNext(); await sleep(120); } }
    };
    const foundLine = () => { const n = nf(); const s = n && n.querySelector('[data-nf-foundas]'); return s ? s.textContent : ''; };
    const elseLine = () => { const n = nf(); const s = n && n.querySelector('[data-nf-elsewhere]'); return s ? s.textContent : ''; };
    const toStep2 = async () => { for (let k = 0; k < 7 && stepType() !== 'conditionDetails'; k++) {
      if (stepType() === 'manualItemType') { const b = Array.from(document.querySelectorAll('#wizard-body button')).find(x => x.textContent.trim() === 'Freight Car'); if (b) { b.click(); await sleep(120); } }
      await wizardNext(); await sleep(150); } };
    const save = async (num) => {
      appended.length = 0;
      Object.assign(wizard.data, { condition: 7, allOriginal: 'Yes', hasBox: 'No', tenderMatch: 'none', setMatch: '', priceItem: '', userEstWorth: '5' });
      try { await saveWizardItem(); } catch (e) { return 'ERR ' + e.message; }
      const r = appended.find(x => cell(x, 'itemNum') === num) || appended[0] || [];
      return cell(r, 'masterRowId') + '|' + cell(r, 'itemNum');
    };

    // ── F: Bob's case — MTH · Flatcar · 30-72264 ──
    await fresh('MTH', '');
    R.fMfr = document.getElementById('wiz-search-mfr') ? document.getElementById('wiz-search-mfr').value : '(no maker box)';
    R.fTypeSet = setSel('wiz-search-type', 'Flatcar');
    await type('30-72264');
    R.fRows = rows().length;
    R.fFound = foundLine();
    R.fElse = elseLine();
    R.fShowBtn = !!(nf() && nf().querySelector('[data-nf-btn="showit"]'));
    R.fManualBtn = !!(nf() && nf().querySelector('[data-nf-btn="manual"]'));
    toasts.length = 0;
    await wizardNext(); await sleep(200);
    R.fStepAfterNext = stepType();
    R.fToast = toasts.join(' | ');
    R.fManualAfterNext = !!wizard.data._manualEntry;
    const show = nf() && nf().querySelector('[data-nf-btn="showit"]');
    if (show) show.click();
    await sleep(400);
    R.fTypeNow = (document.getElementById('wiz-search-type') || {}).value;
    R.fMfrNow = (document.getElementById('wiz-search-mfr') || {}).value;
    R.fRowsNow = rows().map(r => (r.querySelector('span') || {}).textContent).join(',');
    R.fNfGone = !nf();
    const first = rows()[0];
    if (first) { first.click(); await sleep(250); }
    R.fPicked = wizard.matchedItem ? wizard.matchedItem.rowId : null;
    await wizardNext(); await sleep(200);
    await toStep2();
    R.fStep2 = stepType();
    R.fRow2 = wizard.matchedItem ? wizard.matchedItem.rowId : null;
    R.fSave = await save('30-72264');

    // ── G: the era alone hides it — Lionel · Postwar · 2999 ──
    await fresh('Lionel', 'postwar');
    await type('2999');
    R.gFound = foundLine();
    const showG = nf() && nf().querySelector('[data-nf-btn="showit"]');
    if (showG) showG.click();
    await sleep(400);
    R.gEra = (document.getElementById('wiz-search-era') || {}).value;
    R.gRows = rows().map(r => (r.querySelector('span') || {}).textContent).join(',');

    // the era alone only shows the line — Next goes on as before
    await fresh('Lionel', 'postwar');
    await type('2999');
    R.g3Found = foundLine();
    await wizardNext(); await sleep(200);
    R.g3Step = stepType();

    // ── W: the Want list — the line and Show it, but Next goes on as before ──
    await fresh('MTH', '', 'want');
    R.wTab = wizard.tab;
    setSel('wiz-search-type', 'Flatcar');
    await type('30-72264');
    R.wFound = foundLine();
    await wizardNext(); await sleep(200);
    R.wStep = stepType(); R.wTabAfter = wizard.tab;

    // ── M: another MAKER only (MTH · 2343, a Lionel number) — never "as Lionel …" ──
    await fresh('MTH', '');
    await type('2343');
    R.mFound = foundLine(); R.mElse = elseLine();
    await wizardNext(); await sleep(200);
    R.mStep = stepType();

    // ── B: a box row does not spoil it (Lionel · Postwar · Flatcar · 6462 + its box) ──
    await fresh('Lionel', 'postwar');
    setSel('wiz-search-type', 'Flatcar');
    await type('6462');
    R.bFound = foundLine();

    // ── O: a value the drop-down does not offer changes nothing, wipes nothing ──
    await fresh('MTH', '');
    setSel('wiz-search-type', 'Flatcar');
    R.oRet = _wizShowFoundAs('type', 'No Such Type');
    R.oMfr = (document.getElementById('wiz-search-mfr') || {}).value;
    R.oType = (document.getElementById('wiz-search-type') || {}).value;

    // ── H: spread over several makers / eras — Lionel · Postwar · 1511 ──
    await fresh('Lionel', 'postwar');
    await type('1511');
    R.hFound = foundLine();
    R.hElse = elseLine();
    toasts.length = 0;
    await wizardNext(); await sleep(200);
    R.hStepAfterNext = stepType();

    // ── N: a number nowhere ──
    await fresh('MTH', '');
    await type('99-99999');
    R.nFound = foundLine();
    await wizardNext(); await sleep(200);
    R.nStepAfterNext = stepType();
    try { _doCloseWizard(); } catch (e) {}
    return R;
  }, ROWS);
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const t0 = Date.now();
  {
    const { ctx, pg, errs } = await openApp(browser, null);
    const R = await scenario(pg).catch(e => ({ err: String(e && e.stack || e) }));
    if (R.err) ok('the road runs', false, R.err);
    else {
      ok('F0 the filters read MTH / Flatcar', R.fMfr === 'MTH' && R.fTypeSet, JSON.stringify([R.fMfr, R.fTypeSet]));
      ok('F1 MTH · Flatcar · 30-72264: no suggestion', R.fRows === 0, R.fRows);
      ok('F2 the box says where it is: "30-72264 is in the Master Catalog as MTH Gondola"', R.fFound === '30-72264 is in the Master Catalog as MTH Gondola', R.fFound);
      ok('F3 …with a Show it button; Add manually still there; no "other makers or eras" line', R.fShowBtn && R.fManualBtn && R.fElse === '', JSON.stringify([R.fShowBtn, R.fManualBtn, R.fElse]));
      ok('F4 Next does NOT slip into a hand entry — the item-number step stays', R.fStepAfterNext === 'itemNumGrouping' && !R.fManualAfterNext, R.fStepAfterNext);
      ok('F5 …and a toast says where it is', /30-72264 is in the Master Catalog as MTH Gondola/.test(R.fToast), R.fToast);
      ok('F6 Show it: Type = Gondola, Maker stays MTH, the row is listed, the box is gone', R.fTypeNow === 'Gondola' && R.fMfrNow === 'MTH' && /30-72264/.test(R.fRowsNow) && R.fNfGone, JSON.stringify([R.fTypeNow, R.fMfrNow, R.fRowsNow, R.fNfGone]));
      ok('F7 the tapped row = the later step\'s = the saved Row ID (MTH72264)', R.fPicked === 'MTH72264' && R.fStep2 !== 'itemNumGrouping' && R.fRow2 === 'MTH72264' && R.fSave === 'MTH72264|30-72264', JSON.stringify([R.fPicked, R.fStep2, R.fRow2, R.fSave]));
      ok('G1 the era alone hides it: "2999 is in the Master Catalog as Lionel Prewar Boxcar"', R.gFound === '2999 is in the Master Catalog as Lionel Prewar Boxcar', R.gFound);
      ok('G2 Show it sets Era = Pre-War and the row shows', R.gEra === 'prewar' && /2999/.test(R.gRows), JSON.stringify([R.gEra, R.gRows]));
      ok('G3 …the era alone: Next goes on as before (no block)', R.g3Found !== '' && R.g3Step !== 'itemNumGrouping', JSON.stringify([R.g3Found, R.g3Step]));
      ok('W1 Want list: the line shows, Next goes on as before and stays on the Want list', R.wTab === 'want' && /as MTH Gondola/.test(R.wFound) && R.wStep !== 'itemNumGrouping' && R.wTabAfter === 'want', JSON.stringify([R.wTab, R.wFound, R.wStep, R.wTabAfter]));
      ok('M1 another maker only (MTH · 2343): no found-as line, the plain elsewhere line, Next goes on', R.mFound === '' && R.mElse === '2343 is in the Master Catalog under other makers or eras' && R.mStep !== 'itemNumGrouping', JSON.stringify([R.mFound, R.mElse, R.mStep]));
      ok('B1 the box row does not spoil it: "6462 is in the Master Catalog as Lionel Postwar Gondola"', R.bFound === '6462 is in the Master Catalog as Lionel Postwar Gondola', R.bFound);
      ok('O1 Show it with a value the drop-down lacks: false, Maker and Type untouched', R.oRet === false && R.oMfr === 'MTH' && R.oType === 'Flatcar', JSON.stringify([R.oRet, R.oMfr, R.oType]));
      ok('H1 several makers / eras (1511): no found-as line, the plain "elsewhere" line as before', R.hFound === '' && R.hElse === '1511 is in the Master Catalog under other makers or eras', JSON.stringify([R.hFound, R.hElse]));
      ok('H2 …and Next goes on as before', R.hStepAfterNext !== 'itemNumGrouping', R.hStepAfterNext);
      ok('N1 a number nowhere: no found-as line, Next goes on as before', R.nFound === '' && R.nStepAfterNext !== 'itemNumGrouping', JSON.stringify([R.nFound, R.nStepAfterNext]));
      ok('E0 no page errors', errs.length === 0, errs.join(' | '));
    }
    await ctx.close();
  }
  // ── planted offenders: each must turn F red ──
  const sugg = read('wizard-suggestions.js'), wiz = read('wizard.js'), cfg = read('con' + 'fig.js');
  const plants = [
    ['no fix is ever offered', { 'wizard-suggestions.js': plant(sugg, 'if (opt) out.fix = { key: fixKey, value: opt.value };', 'if (false) out.fix = null;', 'nofix') }, (R) => R.fFound === '' ],
    ['Next slips into a hand entry again', { 'wizard.js': plant(wiz, "if (typeof _wizFoundAsStop === 'function' && _wizFoundAsStop(_setTok || _numPart)) return;", '', 'nostop') }, (R) => R.fStepAfterNext !== 'itemNumGrouping' ],
    ['Show it sets the value but skips the drop-down\'s own change handler', { 'wizard-suggestions.js': plant(sugg, "  sel.dispatchEvent(new Event('change', { bubbles: true }));\n  return true;", '  return true;', 'nochange') }, (R) => !(R.fNfGone && /30-72264/.test(R.fRowsNow)) ],
    ['the Maker may be named as all that hides it', { ['con' + 'fig.js']: plant(cfg, "foundAsKeys:     ['type', 'road', 'period']", "foundAsKeys:     ['type', 'road', 'period', 'mfr']", 'mfrkey') }, (R) => R.mFound !== '' ],
    ['Next is blocked on the Want list too', { ['con' + 'fig.js']: plant(cfg, "foundAsStopTabs: ['collection']", "foundAsStopTabs: ['collection', 'want']", 'wanttab') }, (R) => R.wStep === 'itemNumGrouping' ],
    ['box rows are counted', { 'wizard-suggestions.js': plant(sugg, "if (isBox !== wantBoxes) return;", "", 'boxrows') }, (R) => R.bFound === '' ],
    ['the era alone blocks Next', { ['con' + 'fig.js']: plant(cfg, "foundAsStopKeys: ['type', 'road']", "foundAsStopKeys: ['type', 'road', 'period']", 'erastop') }, (R) => R.g3Step === 'itemNumGrouping' ],
  ];
  for (const [label, served, red] of plants) {
    const { ctx, pg } = await openApp(browser, served);
    const R = await scenario(pg).catch(e => ({ err: String(e) }));
    ok('P planted "' + label + '" turns the suite red', !!R.err || red(R), JSON.stringify(R).slice(0, 300));
    await ctx.close();
  }
  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed  (' + Math.round((Date.now() - t0) / 1000) + ' s)');
  process.exit(fail ? 1 : 0);
})();
