#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════
// THE APP NEVER FILLS IN A MAKER ON ITS OWN — the road   (real Chromium, the REAL app)
// 2026-11-03. [stated] Brad 06:31 CT: "we dont need to quielty fill anything.
// thats an issue" → 07:30 CT "yes" to PLAN_2026-11-03_NO_QUIET_MAKER.
// Mike Caruso's MTH Hudson and SD40 were saved as LIONEL: typed numbers with no
// catalog row, no maker picked, and the save took "the era on screen".
//
//   A  Add, no filter, a number the catalog lacks → "Who made this item?" (the
//      hand-entry maker buttons); Next refuses with none; tap MTH → Condition &
//      Details → the saved row says MTH (phone AND laptop)
//   B  Add, a catalog number (2343) → no maker step; the save says the ROW's
//      maker (Lionel), the catalog Row ID saved
//   C  Add with the sticky Lionel filter, a number the catalog lacks → the step
//      shows Lionel PRE-SELECTED (on screen); change to MTH → MTH saved — the
//      filter never overrules the tap
//   U  Update Info: an item not tied to a catalog entry shows Manufacturer,
//      typed MTH, Save → the Manufacturer column written MTH; a catalog item
//      shows no Manufacturer line
//   K  Collection Tools → Check Makers (its own section): exactly the no-link Lionel/blank items;
//      typing MTH on the SD40 and Save writes that one copy's Manufacturer only
//   L  My Collection: a copy with no maker shows "—", never LIONEL
//   P  a planted offender — the step taken out of the served app — turns A red
// ═════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  no_quiet_maker_road_tests needs playwright and it is not installed.'); process.exit(1); }
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
  { itemNum: '2343', variation: '', itemType: 'Diesel Locomotive', description: 'Santa Fe F3', roadName: 'Santa Fe', yearProd: '1950', _era: 'pw', _tab: 'Lionel PW - Items', gauge: 'O', rowId: 'PW2343' },
  { itemNum: '20-3526-1E', variation: '', itemType: 'Steam Locomotive', description: 'Dreyfuss Hudson', roadName: 'New York Central', yearProd: '2014', _era: 'mth_o', _tab: 'MTH O', gauge: 'O', rowId: 'U7A525KEFF' },
];

async function scenario(pg, full) {
  return pg.evaluate(async ([ROWS, full]) => {
    const R = {};
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    state.masterData = ROWS.map(r => Object.assign({}, r));
    _rebuildMasterIndex();
    state.personalData = {}; state.isData = {}; state.personalSheetId = 'SHEET'; _currentEra = 'all';
    state.user = { name: 'Brad', email: 'brad@example.com' };
    try { localStorage.clear(); } catch (e) {}
    const appended = [];
    window.sheetsAppend = async (id, range, rows) => { appended.push(rows[0]); return 200 + appended.length; };
    window.rrVerifiedRowUpdate = async () => true; window.rrRowStillIs = async () => true;
    window.rrWhereIsRow = async (sid, tab, row) => ({ ok: true, row: row });   // FIND BY ID (2026-11-04): the gates ask where it is NOW — same stand-in: unmoved
    window.driveEnsureSetup = async () => {}; window.driveEnsureItemFolder = async (n) => 'FOLDER-' + n; window.driveUploadPhoto = async () => ({});
    window.buildDashboard = () => {}; window.loadPersonalData = async () => {};
    const toasts = []; window.showToast = (m) => { toasts.push(String(m)); };
    window.rrMaybeShowAddHelp = () => {};
    window._getAllErasMasterForSearch = async () => {}; window._allErasSearchCache = null;
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
    const F = PERSONAL_FIELD_INDEX;
    const cell = (row, f) => String(row[F[f]] == null ? '' : row[F[f]]).replace(/^'/, '');
    const cur = () => wizard.steps[wizard.step] || {};
    const type = async (v) => {
      const i = document.getElementById('wiz-input'); i.value = v;
      i.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(330);
    };
    const fresh = async (mfr) => {
      try { localStorage.setItem('lv_add_mfr', mfr || ''); localStorage.setItem('lv_add_era', ''); localStorage.removeItem('lv_add_scale'); } catch (e) {}
      if (typeof _doCloseWizard === 'function' && window.wizard && wizard.steps && wizard.steps.length) { try { _doCloseWizard(); } catch (e) {} }
      await openWizard('collection'); wizard.data._era = 'all'; await sleep(150);
      for (let k = 0; k < 4 && cur().type !== 'itemNumGrouping'; k++) { await wizardNext(); await sleep(120); }
    };
    // Next until the maker step or step 2, whichever comes first.
    const walk = async () => { for (let k = 0; k < 6 && cur().id !== 'addMaker' && cur().type !== 'conditionDetails'; k++) { await wizardNext(); await sleep(150); } };
    const chip = (name) => Array.from(document.querySelectorAll('#wizard-body button')).find(b => b.textContent.trim() === name);
    const selectedChip = () => { const b = Array.from(document.querySelectorAll('#wizard-body button')).find(x => /var\(--accent\)22/.test(x.getAttribute('style') || '')); return b ? b.textContent.trim() : ''; };
    const save = async (num) => {
      appended.length = 0;
      Object.assign(wizard.data, { condition: 7, allOriginal: 'Yes', hasBox: 'No', tenderMatch: 'none', setMatch: '', priceItem: '', userEstWorth: '5' });
      try { await saveWizardItem(); } catch (e) { return { err: e.message }; }
      const r = appended.find(x => cell(x, 'itemNum') === num) || appended[0] || [];
      return { mfr: cell(r, 'manufacturer'), rowId: cell(r, 'masterRowId'), num: cell(r, 'itemNum') };
    };

    // ── A: no filter, a number the catalog lacks ──
    await fresh('');
    await type('30-2178-1');
    await walk();
    R.aStep = cur().id; R.aTitle = (document.getElementById('wizard-step-title') || document.querySelector('#wizard-modal h2, #wizard-modal .wizard-title') || {}).textContent || '';
    R.aChips = ['Lionel', 'MTH', 'Other / Unknown'].every(n => !!chip(n));
    R.aPre = selectedChip();
    toasts.length = 0;
    await wizardNext(); await sleep(150);
    R.aRefused = cur().id === 'addMaker' && toasts.some(t => /manufacturer/i.test(t));
    const m = chip('MTH'); if (m) m.click(); await sleep(150);
    R.aPicked = selectedChip();
    await wizardNext(); await sleep(200);
    for (let k = 0; k < 3 && cur().type !== 'conditionDetails'; k++) { await wizardNext(); await sleep(150); }
    R.aStep2 = cur().type;
    R.aSave = await save('30-2178-1');
    if (!full) return R;

    // ── B: a catalog number ──
    await fresh('');
    await type('2343');
    await walk();
    R.bStep = cur().type; R.bAsked = cur().id === 'addMaker';
    R.bSave = await save('2343');

    // ── C: the sticky Lionel filter ──
    await fresh('Lionel');
    await type('30-2178-1');
    await walk();
    R.cStep = cur().id; R.cPre = selectedChip();
    const m2 = chip('MTH'); if (m2) m2.click(); await sleep(150);
    await wizardNext(); await sleep(200);
    for (let k = 0; k < 3 && cur().type !== 'conditionDetails'; k++) { await wizardNext(); await sleep(150); }
    R.cSave = await save('30-2178-1');
    try { _doCloseWizard(); } catch (e) {}

    // ── U: Update Info ──
    state.personalData = {
      sd40: { row: 5, owned: true, itemNum: '30-2178-1', variation: '', era: 'pw', manufacturer: 'Lionel', inventoryId: 'sd40', condition: '8' },
      f3:   { row: 6, owned: true, itemNum: '2343', variation: '', era: 'pw', masterRowId: 'PW2343', manufacturer: 'Lionel', inventoryId: 'f3', condition: '7' },
      toy:  { row: 7, owned: true, itemNum: 'SD9', variation: '', era: 'Manual', manufacturer: '', inventoryId: 'toy', description: 'Tin switcher', condition: '6' },
    };
    const writes = [];
    window.rrPersonalSafeWrite = async (rec, values, base) => { writes.push({ inv: rec.inventoryId, mfr: String(values[F.manufacturer] || '').replace(/^'/, ''), itemNum: String(values[F.itemNum] || '').replace(/^'/, '') }); return true; };
    window._healPdRow = async () => {};
    window._openOwnedByInvId = () => {};
    const panelLabels = () => Array.from(document.querySelectorAll('#item-panel-overlay *')).filter(e => e.children.length === 0).map(e => e.textContent.trim());
    showItemPanel(-1, 'sd40', 'edit'); await sleep(200);
    R.uShown = panelLabels().indexOf('Manufacturer') >= 0;
    // stage the edit the way the panel's own text box does, then Save
    const ov = document.getElementById('item-panel-overlay');
    const mRow = Array.from(ov.querySelectorAll('*')).find(e => e.children.length === 0 && e.textContent.trim() === 'Manufacturer');
    if (mRow) {   // the row's own ✏️ button, the way a collector opens the field
      let host = mRow.parentElement, pen = null;
      for (let k = 0; k < 3 && host && !pen; k++) { pen = host.querySelector('button[title="Edit"]'); if (!pen) host = host.parentElement; }
      if (pen) pen.click(); await sleep(120);
    }
    const inp = document.getElementById('panel-inp-manufacturer');
    R.uInput = !!inp; R.uList = inp ? (inp.getAttribute('list') || '') : '';
    R.uListHasMth = R.uList ? Array.from(document.querySelectorAll('#' + R.uList + ' option')).some(o => o.value === 'MTH') : false;
    if (inp) {
      inp.value = 'MTH';
      const done = inp.parentElement.querySelector('button[aria-label="Done"]') || Array.from(ov.querySelectorAll('button')).find(b => b.textContent === '✓');
      if (done) done.click(); await sleep(120);
    }
    const sb = Array.from(document.querySelectorAll('#item-panel-overlay button')).find(b => /Save All Changes/.test(b.textContent));
    writes.length = 0;
    if (sb) sb.click();
    await sleep(500);
    R.uWrite = writes[0] || null;
    R.uLive = state.personalData.sd40.manufacturer;
    try { const o = document.getElementById('item-panel-overlay'); if (o) o.remove(); } catch (e) {}
    showItemPanel(0, 'f3', 'edit'); await sleep(200);
    R.uCatalogShown = panelLabels().indexOf('Manufacturer') >= 0;
    try { const o = document.getElementById('item-panel-overlay'); if (o) o.remove(); } catch (e) {}

    // ── K: Check Makers ──
    state.personalData.sd40.manufacturer = 'Lionel';
    window.rrFillRowThumbs = () => {};
    buildToolsPage();
    R.kCard = !!Array.from(document.querySelectorAll('#makers-body .tools-card-title')).find(t => /Check Makers/.test(t.textContent));
    R.kFolded = document.getElementById('makers-body').style.display === 'none';
    const kHead = document.getElementById('makers-caret'); if (kHead && kHead.parentElement) kHead.parentElement.click();
    R.kOpened = document.getElementById('makers-body').style.display !== 'none';
    runCheckMakers(); await sleep(50);
    R.kRows = Array.from(document.querySelectorAll('#check-makers-results .ckm-row')).map(r => r.getAttribute('data-key')).sort().join(',');
    const i0 = (window._ckmList || []).findIndex(e => e.key === 'sd40');
    const kin = document.getElementById('ckm-in-' + i0);
    writes.length = 0;
    if (kin) { kin.value = 'MTH'; const b = document.getElementById('ckm-save-' + i0); if (b) b.click(); }
    await sleep(400);
    R.kWrites = writes.slice();
    R.kLive = state.personalData.sd40.manufacturer;
    R.kOthers = [state.personalData.toy.manufacturer, state.personalData.f3.manufacturer].join('|');

    // ── L: the list badge for a copy with no maker ──
    const td = document.createElement('table'); td.innerHTML = '<tr>' + _mfrBadge({ manufacturer: rrMakerOf({ copy: state.personalData.toy }) }) + '</tr>';
    R.lBadge = td.textContent.trim();
    return R;
  }, [ROWS, full]);
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
    ok(t('A1 a number the catalog lacks, no maker named → "Who made this item?"'), R.aStep === 'addMaker', R.aStep);
    ok(t('A2 …with the hand-entry maker buttons (Lionel, MTH, Other / Unknown)'), R.aChips);
    ok(t('A3 …and nothing pre-picked with no filter set'), R.aPre === '', R.aPre);
    ok(t('A4 Next with no maker is refused, and says so'), R.aRefused);
    ok(t('A5 tapping MTH selects it, then on to Condition & Details'), R.aPicked === 'MTH' && R.aStep2 === 'conditionDetails', JSON.stringify([R.aPicked, R.aStep2]));
    ok(t('A6 the saved row says MTH — not Lionel, not blank'), R.aSave && R.aSave.mfr === 'MTH' && R.aSave.rowId === '', JSON.stringify(R.aSave));
    ok(t('B1 a catalog number never sees the maker step'), !R.bAsked && R.bStep === 'conditionDetails', R.bStep);
    ok(t('B2 …and saves the ROW\'s maker and Row ID'), R.bSave && R.bSave.mfr === 'Lionel' && R.bSave.rowId === 'PW2343', JSON.stringify(R.bSave));
    ok(t('C1 the sticky Lionel filter still asks — and shows Lionel pre-selected, on screen'), R.cStep === 'addMaker' && R.cPre === 'Lionel', JSON.stringify([R.cStep, R.cPre]));
    ok(t('C2 changing it to MTH saves MTH — the filter never overrules the tap'), R.cSave && R.cSave.mfr === 'MTH', JSON.stringify(R.cSave));
    ok(t('U1 Update Info on an item not tied to a catalog entry shows Manufacturer'), R.uShown);
    ok(t('U2 …a text box offering the makers the app knows (MTH among them)'), R.uInput && R.uListHasMth, JSON.stringify([R.uInput, R.uList]));
    ok(t('U3 Save writes MTH to that item\'s Manufacturer column, and the item shows it'), R.uWrite && R.uWrite.inv === 'sd40' && R.uWrite.mfr === 'MTH' && R.uLive === 'MTH', JSON.stringify([R.uWrite, R.uLive]));
    ok(t('U4 a catalog item shows no Manufacturer line (its row decides)'), R.uCatalogShown === false);
    ok(t('K1 Check Makers has its own section on Collection Tools'), R.kCard);
    ok(t('K1b …folded at first, and one tap on its heading opens it'), R.kFolded && R.kOpened, JSON.stringify([R.kFolded, R.kOpened]));
    ok(t('K2 it lists exactly the SD40 (Lionel, no link) and the maker-less hand-added item'), R.kRows === 'sd40,toy', R.kRows);
    ok(t('K3 Save on the SD40 writes MTH to that copy only'), R.kWrites.length === 1 && R.kWrites[0].inv === 'sd40' && R.kWrites[0].mfr === 'MTH' && R.kLive === 'MTH' && R.kOthers === '|Lionel',
       JSON.stringify([R.kWrites, R.kLive, R.kOthers]));
    ok(t('L1 a copy with no maker shows "—" in the list, never LIONEL'), R.lBadge === '—', R.lBadge);
    ok(t('L2 no page errors'), errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
  // ── P: the step taken out of the served app → A goes red ──
  {
    const served = { 'wizard-steps.js': plant(read('wizard-steps.js'), "skipIf: (d) => !(typeof _rrAddNeedsMaker === 'function' && _rrAddNeedsMaker(d)) },", "skipIf: (d) => true },", 'step skipped') };
    const { ctx, pg } = await openApp(browser, LAPTOP, served);
    const R = await scenario(pg, false).catch(e => ({ err: String(e) }));
    ok('P1 PLANTED the step skipped: A1 can fail (straight to Condition & Details, nothing asked)', !R.err && R.aStep !== 'addMaker', R.err || R.aStep);
    await ctx.close();
  }
  await browser.close();
  console.log('\n(' + Math.round((Date.now() - t0) / 1000) + ' s) ' + (fail ? 'FAILED' : 'ALL PASS') + '  —  no_quiet_maker_road_tests: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
