#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════
// MENARDS CARS — one add, several cars, each with its own car number
// (menardscars)   (real Chromium, the REAL app)
//
// [stated] Brad 2026-11-25 22:00 CT "Menards trains are a pain to enter.
// Multiple units use the same numbers" → 22:01 CT "Menards has the same item
// number but the number on the car is different" → 2026-11-26 07:39 CT "Go"
// to PLAN_2026-11-26_MENARDS_CAR_NUMBERS.md.
//
// Owners: config.js RR_HOW_MANY.carMakers (+ the words) · wizard-save.js
// rrHowManyCarRow / rrCarNumbersOffered / rrCarNumbers, rrHowManyCopies'
// roadNumbers and the ONE append · wizard.js the car lines and the review
// line · app-collection.js the item page line and the edit panel field ·
// browse.js the car-number search (_carQ / _carRows) and rrCopyCarLabel.
//
// Proved through the app's own screens, save and list — only the Google
// Sheets / Drive writers are stood in for, and they RECORD what they write:
//   A  who is asked: a Menards car / engine yes; MTH, Lionel, a Menards
//      building, a hand-typed Menards number no; track asked but no car lines
//   B  the car lines on Purchase & Value: one per car, typed numbers kept
//      when the count changes, none on track; fits a 320 px phone
//   C  the review screen names the cars
//   D  3 cars → 3 rows in ONE append, each its OWN Road Number; a blank line
//      takes the catalog's number; every other cell the same; in memory too
//   E  1 car with a number → one row carrying it; no number → today's row
//   F  the item page shows the copy's Road Number; the edit panel offers it
//   G  searching a car number finds that car only; the item number finds all
//   H  "car 6301" on each copy row of a Menards item — not on a single copy,
//      not on another maker's copies
//   P  planted offenders — each rule undone in a served copy must turn red
// ══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  menards_cars_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function ok(n, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (extra == null ? '' : String(extra)).slice(0, 400))); cond ? pass++ : fail++; }

async function scenario(pg) {
  return pg.evaluate(async () => {
    const R = {};
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const realRender = window.renderBrowse;
    const mk = (n, t, d, era, tab, x) => Object.assign({ itemNum: n, variation: '', itemType: t, _era: era, _tab: tab, yearProd: '2020', description: d, roadName: '', roadNum: '', rowId: 'RID-' + era + '-' + n }, x || {});
    state.masterData = [
      mk('275-9388', 'Flatcar', 'BN Flatcar with 1954 GMC truck', 'menards', 'Menards O', { roadName: 'Burlington Northern' }),
      mk('275-9390', 'Boxcar', 'SF Boxcar', 'menards', 'Menards O', { roadNum: '9000', roadName: 'Santa Fe' }),
      mk('279-1234', 'Building', 'Lighted Grain Elevator', 'menards', 'Menards O'),
      mk('30-74000', 'Boxcar', 'MTH Boxcar', 'mth_o', 'MTH O'),
      mk('6464-1', 'Boxcar', 'Western Pacific Boxcar', 'pw', 'Lionel PW - Items'),
      mk('022', 'Track', 'Remote Control Switches, pair', 'pw', 'Lionel PW - Items'),
    ];
    _rebuildMasterIndex();
    state.personalData = {};
    state.isData = {}; state.forSaleData = {}; state.wantData = {}; state.upgradeData = {}; state.soldData = {};
    state.personalSheetId = 'SHEET';
    try { localStorage.removeItem('lv_inv_hwm'); } catch (e) {}
    _currentEra = 'all';
    const calls = [], toasts = [];
    window.sheetsAppend = async (id, range, rows) => {
      calls.push({ range: String(range), rows: rows.map(r => r.slice()) });
      return 200 + calls.reduce((a, c) => a + c.rows.length, 0) - rows.length + 1;
    };
    window.rrVerifiedRowUpdate = async () => true;
    window.rrRowStillIs = async () => true;
    window.rrWhereIsRow = async (sid, tab, row) => ({ ok: true, row: row });
    window.driveEnsureSetup = async () => {};
    window.driveEnsureItemFolder = async (n) => 'FOLDER-' + n;
    window.driveUploadPhoto = async () => ({});
    window.buildDashboard = () => {}; window.renderBrowse = () => {};
    window.buildSoldPage = () => {}; window.buildForSalePage = () => {};
    window.loadPersonalData = async () => {};
    window.showToast = (m) => { toasts.push(String(m)); };
    window.rrMaybeShowAddHelp = () => {};
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
    const F = PERSONAL_FIELD_INDEX;
    const cell = (row, f) => String(row[F[f]] == null ? '' : row[F[f]]).replace(/^'/, '');
    const coll = () => calls.filter(c => c.range.indexOf(PERSONAL_TAB + '!') === 0 || /^My Collection!/.test(c.range));
    const eraOf = { '275-9388': 'menards', '275-9390': 'menards', '279-1234': 'menards', '30-74000': 'mth_o', '6464-1': 'pw', '022': 'pw' };
    const open = async (num, extra) => {
      try { if (typeof closeWizard === 'function' && window.wizard && wizard.steps) { wizard.data._saveComplete = true; closeWizard(); } } catch (e) {}
      openWizard('collection');
      await sleep(60);
      Object.assign(wizard.data, { itemNum: num, variation: '', condition: 8, allOriginal: 'Yes', hasBox: 'No',
        _itemGrouping: 'single', tenderMatch: 'none', setMatch: '', priceItem: '39.99', userEstWorth: '45', datePurchased: '2026-11-26', hasIS: 'No' }, extra || {});
      wizard.matchedItem = num ? (findMaster(num, '', { era: eraOf[num] || '' }) || null) : null;
    };
    const showStep = async (id) => {
      const i = wizard.steps.findIndex(s => s.id === id);
      if (i < 0) return false;
      wizard.step = i; renderWizardStep(); await sleep(120); return true;
    };
    const typeCount = (v) => { const el = document.getElementById('pv-howmany'); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); return el; };
    const carEls = () => Array.from(document.querySelectorAll('#pv-carnums .pv-carnum'));
    const typeCar = (i, v) => { const el = carEls()[i]; el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };

    // ── A — who is asked ──
    await open('275-9388'); R.aMatched = !!wizard.matchedItem; R.aMaker = rrMakerOf({ row: wizard.matchedItem });
    R.aMenHM = rrHowManyOffered(wizard.data); R.aMenCars = rrCarNumbersOffered(wizard.data);
    await open('30-74000'); R.aMthHM = rrHowManyOffered(wizard.data); R.aMthCars = rrCarNumbersOffered(wizard.data);
    await open('6464-1');   R.aLioHM = rrHowManyOffered(wizard.data);
    await open('279-1234'); R.aBldHM = rrHowManyOffered(wizard.data); R.aBldCars = rrCarNumbersOffered(wizard.data);
    await open('022');      R.aTrkHM = rrHowManyOffered(wizard.data); R.aTrkCars = rrCarNumbersOffered(wizard.data);
    await open('275-9999'); wizard.matchedItem = null; wizard.data.manualManufacturer = 'Menards'; wizard.data.manualItemType = 'Boxcar';
    R.aTypedHM = rrHowManyOffered(wizard.data); R.aTypedCars = rrCarNumbersOffered(wizard.data);
    const flags = { _setMode: true, _fromInbox: true, _alsoListForSale: true, _fillItemMode: true, _updatePdKey: 'k9', _addToGroupInv: '9' };
    R.aFlags = {};
    for (const k of Object.keys(flags)) { await open('275-9388'); wizard.data[k] = flags[k]; R.aFlags[k] = rrCarNumbersOffered(wizard.data); }
    R.cfgMakers = (RR_HOW_MANY.carMakers || []).slice();
    // the numbers the save acts on: one per car, trimmed, a leading # dropped; none when not asked
    await open('275-9388', { _howMany: 3, _carNums: [' 6301 ', '', '#6305', 'EXTRA'] }); R.aNums = rrCarNumbers(wizard.data);
    await open('022', { _howMany: 3, _carNums: ['1', '2', '3'] }); R.aTrkNums = rrCarNumbers(wizard.data);

    // ── B — the car lines ──
    await open('275-9388');
    R.bStep = await showStep('purchaseValue');
    R.bBox = !!document.getElementById('pv-howmany');
    R.bLines1 = carEls().length;
    R.bLabel = (document.getElementById('pv-carnums') || {}).textContent || '';
    typeCount('3'); R.bLines3 = carEls().length;
    typeCar(0, '6301'); typeCar(2, '#6305');
    R.bData = (wizard.data._carNums || []).slice();
    typeCount('2'); R.bLines2 = carEls().length; R.bVals2 = carEls().map(e => e.value);
    typeCount('3'); R.bVals3 = carEls().map(e => e.value);
    renderWizardStep(); await sleep(100); R.bRedraw = carEls().map(e => e.value);
    const fitEl = carEls()[2], pvC = document.querySelector('.wiz-pv');
    if (fitEl && pvC) { const r = fitEl.getBoundingClientRect(), c = pvC.getBoundingClientRect(); R.bFit = { left: r.left, right: r.right, w: r.width, vw: window.innerWidth, inC: r.left >= c.left - 1 && r.right <= c.right + 1, sw: pvC.scrollWidth, cw: pvC.clientWidth }; }
    await open('022'); await showStep('purchaseValue'); R.bTrkBox = !!document.getElementById('pv-howmany'); R.bTrkLines = carEls().length;
    await open('30-74000'); await showStep('purchaseValue'); R.bMthLines = carEls().length; R.bMthBox = !!document.getElementById('pv-howmany');

    // ── C — the review screen ──
    await open('275-9388', { _howMany: 3, _carNums: ['6301', '', '6305'] }); await showStep('confirm');
    R.cCars = (document.getElementById('cf-carnums') || {}).textContent || '';
    R.cHM = (document.getElementById('cf-howmany') || {}).textContent || '';
    await open('275-9388', { _howMany: 1, _carNums: ['6302'] }); await showStep('confirm');
    R.cOne = (document.getElementById('cf-carnums') || {}).textContent || '';
    await open('275-9388', { _howMany: 1 }); await showStep('confirm'); R.cNone = !document.getElementById('cf-carnums');
    await open('022', { _howMany: 3, _carNums: ['1', '2', '3'] }); await showStep('confirm'); R.cTrk = !document.getElementById('cf-carnums');

    // ── D — three cars ──
    await open('275-9388', { _howMany: 3, _carNums: ['6301', '', '#6305'] });
    calls.length = 0; toasts.length = 0;
    await saveWizardItem(); await sleep(50);
    let dc = coll();
    R.dCalls = dc.length; R.dRows = dc[0] ? dc[0].rows.length : 0;
    const dRows = dc[0] ? dc[0].rows : [];
    R.dRoad = dRows.map(x => cell(x, 'roadNumber'));
    R.dRaw = dRows.map(x => String(x[F.roadNumber] == null ? '' : x[F.roadNumber]));
    { const br = buildPersonalRow({ itemNum: 'ZZ-1', roadNumber: '06302', era: 'Manual', manufacturer: 'Menards', _noCatalogRow: true }); R.dLead = String(br[F.roadNumber]); }
    { const pr = new Array(Object.keys(F).length).fill(''); pr[F.itemNum] = 'X'; pr[F.inventoryId] = '1'; const cps = rrHowManyCopies(pr, 3, { roadNumbers: ['', '1-2', '0077'] }); R.dCopyRaw = cps.map(x => x[F.roadNumber]); }
    R.dIds = dRows.map(x => cell(x, 'inventoryId'));
    R.dDiff = [];
    dRows.slice(1).forEach(x => x.forEach((v, i) => { if (i !== F.inventoryId && i !== F.roadNumber && String(v == null ? '' : v) !== String(dRows[0][i] == null ? '' : dRows[0][i]) && R.dDiff.indexOf(i) < 0) R.dDiff.push(i); }));
    R.dPrices = dRows.map(x => cell(x, 'priceItem'));
    R.dMem = R.dIds.map(id => state.personalData[id] ? String(state.personalData[id].roadNumber || '') : 'MISSING');
    R.dToast = toasts.join(' | ');
    // a blank line takes the catalog's number (this catalog row says 9000)
    await open('275-9390', { _howMany: 3, _carNums: ['9101', '', '9103'] });
    calls.length = 0; await saveWizardItem(); await sleep(50);
    dc = coll(); R.dCat = (dc[0] ? dc[0].rows : []).map(x => cell(x, 'roadNumber'));
    // track: every row the same (no car numbers written, whatever was left in the data)
    await open('022', { _howMany: 3, _carNums: ['1', '2', '3'] });
    calls.length = 0; await saveWizardItem(); await sleep(50);
    dc = coll(); R.dTrk = (dc[0] ? dc[0].rows : []).map(x => cell(x, 'roadNumber'));

    // ── E — one car ──
    await open('275-9388', { _howMany: 1, _carNums: ['6302'] });
    calls.length = 0; await saveWizardItem(); await sleep(50);
    dc = coll(); R.eOne = dc.length === 1 && dc[0].rows.length === 1 ? cell(dc[0].rows[0], 'roadNumber') : 'BAD';
    R.eOneId = dc[0] ? cell(dc[0].rows[0], 'inventoryId') : '';
    await open('275-9388', { _howMany: 1 });
    calls.length = 0; await saveWizardItem(); await sleep(50);
    dc = coll(); R.eBlank = dc.length === 1 && dc[0].rows.length === 1 ? cell(dc[0].rows[0], 'roadNumber') : 'BAD';

    try { wizard.data._saveComplete = true; closeWizard(); } catch (e) {}

    // ── F — the item page and the edit panel ──
    // the collection now: three 275-9388 cars (6301, '', 6305), one 275-9388 (6302),
    // one blank 275-9388, three 275-9390, three 022. Add two Lionel copies WITH road numbers.
    state.personalData['L1'] = { owned: true, itemNum: '6464-1', variation: '', inventoryId: 'L1', row: 900, era: 'pw', manufacturer: 'Lionel', roadNumber: '8801', masterRowId: 'RID-pw-6464-1' };
    state.personalData['L2'] = { owned: true, itemNum: '6464-1', variation: '', inventoryId: 'L2', row: 901, era: 'pw', manufacturer: 'Lionel', roadNumber: '8802', masterRowId: 'RID-pw-6464-1' };
    const idxMen = state.masterData.findIndex(m => m.itemNum === '275-9388');
    const id6302 = R.eOneId;
    try {
      showItemDetailPage(idxMen, id6302); await sleep(150);
      const pageTxt = (document.getElementById('item-detail-page') || document.querySelector('.item-detail-page') || document.body).textContent.replace(/\s+/g, ' ');
      R.fPage = /Road Number\s*6302/.test(pageTxt);
      R.fPageSnip = (pageTxt.match(/.{0,40}Road Number.{0,30}/) || [''])[0];
    } catch (e) { R.fErr = String(e && e.message || e); }
    try {
      const blankId = Object.keys(state.personalData).find(k => state.personalData[k].itemNum === '275-9388' && !state.personalData[k].roadNumber);
      showItemDetailPage(idxMen, blankId); await sleep(150);
      const t2 = (document.getElementById('item-detail-page') || document.querySelector('.item-detail-page') || document.body).textContent.replace(/\s+/g, ' ');
      R.fBlankNone = !/Road Number/.test(t2.replace(/Edit fields/g, ''));
    } catch (e) { R.fErr2 = String(e && e.message || e); }
    try {
      showItemPanel(idxMen, id6302); await sleep(150);
      const panels = Array.from(document.querySelectorAll('.item-panel, #item-panel, [id*="panel"]'));
      const pTxt = panels.map(p => p.textContent).join(' ').replace(/\s+/g, ' ');
      R.fPanel = /Road Number/.test(pTxt) && /6302/.test(pTxt);
      R.fPanelSnip = (pTxt.match(/.{0,30}Road Number.{0,30}/) || [''])[0];
    } catch (e) { R.fErr3 = String(e && e.message || e); }
    try { if (typeof closeItemPanel === 'function') closeItemPanel(); } catch (e) {}

    // ── G — searching ──
    window.renderBrowse = realRender;
    const listFor = async (q) => {
      if (!listFor._shown) { try { showPage('browse'); } catch (e) {} listFor._shown = true; }
      state.filters.owned = true; state.filters.search = q; _currentEra = 'all';
      try { realRender(); } catch (e) { return { err: String(e && e.message || e) }; }
      await sleep(80);
      return (state.filteredData || []).map(it => ({ num: it.itemNum, inv: (it._copyPd && it._copyPd.inventoryId) || '', road: (it._copyPd && it._copyPd.roadNumber) || '' }));
    };
    R.gAll = (await listFor('')).length; R.gOwnedN = Object.values(state.personalData).filter(p => p && p.owned).length;
    R.gCar = await listFor('6305');
    R.gHash = await listFor('#6301');
    R.gNum = await listFor('275-9388');
    R.gNone = await listFor('6399');
    R.gLio = await listFor('8802');
    // Boxed on: 6305 has no box, so searching it finds nothing; give 6301 a box → 6301 found, alone
    { const ids = Object.keys(state.personalData).filter(k => state.personalData[k].itemNum === '275-9388');
      ids.forEach(k => { state.personalData[k].hasBox = (state.personalData[k].roadNumber === '6301') ? 'Yes' : 'No'; });
      state.filters.boxed = true;
      R.gBoxNo = await listFor('6305');
      R.gBoxYes = await listFor('6301');
      state.filters.boxed = false;
      ids.forEach(k => { state.personalData[k].hasBox = 'No'; }); }

    // ── H — the car label on the list ──
    await listFor('');
    await sleep(80);
    const labels = () => Array.from(document.querySelectorAll('.rr-car-num')).map(e => e.textContent.trim());
    R.hLabels = labels().sort();
    R.hRows = (state.filteredData || []).length;
    return R;
  });
}

async function openApp(browser, served, viewport) {
  const pg = await browser.newPage({ viewport: viewport || { width: 1400, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    const name = u.split('?')[0].split('/').pop();
    if (served && served[name] != null) return r.fulfill({ body: served[name], contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(800);
  return { pg, errs };
}

const uniq = (a) => a.length === new Set(a).size;
const nums = (l) => (Array.isArray(l) ? l : []).map(x => x.num + ':' + x.road).sort().join(',');
const RULES = {
  A1: ['a Menards catalog flatcar is asked How many AND gets car lines', r => r.aMatched && r.aMaker === 'Menards' && r.aMenHM === true && r.aMenCars === true],
  A2: ['an MTH boxcar and a Lionel boxcar are not asked', r => r.aMthHM === false && r.aMthCars === false && r.aLioHM === false],
  A3: ['a Menards building is not asked (not a car or engine)', r => r.aBldHM === false && r.aBldCars === false],
  A4: ['track is asked How many but never gets car lines', r => r.aTrkHM === true && r.aTrkCars === false],
  A5: ['a hand-typed Menards number (no catalog row) gets no car lines', r => r.aTypedCars === false && r.aTypedHM === false],
  A6: ['no car lines in a set walk, inbox add, listed-for-sale add, fill, edit, add into a group', r => Object.keys(r.aFlags).length === 6 && Object.values(r.aFlags).every(v => v === false)],
  A7: ['the maker list comes from config.js (Menards)', r => JSON.stringify(r.cfgMakers) === '["Menards"]'],
  A8: ['the numbers: one per car, trimmed, # dropped, extras ignored; none for track', r => JSON.stringify(r.aNums) === '["6301","","6305"]' && JSON.stringify(r.aTrkNums) === '["","",""]'],
  B1: ['Purchase & Value: the box and ONE car line at 1 car', r => r.bStep && r.bBox && r.bLines1 === 1 && /Number on the car/.test(r.bLabel)],
  B2: ['3 cars → 3 lines; each typed number lands in its own place', r => r.bLines3 === 3 && r.bData[0] === '6301' && r.bData[2] === '#6305' && !r.bData[1]],
  B3: ['down to 2 then back to 3 keeps every number typed; a re-draw keeps them', r => r.bLines2 === 2 && r.bVals2.join('|') === '6301|' && r.bVals3.join('|') === '6301||#6305' && r.bRedraw.join('|') === '6301||#6305'],
  B4: ['track has the box but no car lines; an MTH boxcar has neither', r => r.bTrkBox === true && r.bTrkLines === 0 && r.bMthLines === 0 && r.bMthBox === false],
  C1: ['the review screen names the cars, a blank shown as a dash', r => r.cCars === 'Cars: 6301, —, 6305' && /3 × 275-9388/.test(r.cHM)],
  C2: ['one car with a number is named; no number or track = no line', r => r.cOne === 'Number on the car: 6302' && r.cNone === true && r.cTrk === true],
  D1: ['3 cars → ONE append of 3 rows, 3 Inventory IDs', r => r.dCalls === 1 && r.dRows === 3 && uniq(r.dIds) && r.dIds.every(Boolean)],
  D2: ['each row carries ITS OWN car number (Road Number)', r => r.dRoad.join('|') === '6301||6305'],
  D3: ['every other cell is the same; the price is each', r => r.dDiff.length === 0 && r.dPrices.every(v => parseFloat(v) === 39.99)],
  D4: ['the three cars are in memory with their own numbers', r => r.dMem.join('|') === '6301||6305'],
  D5: ['a blank line takes the catalog\'s number', r => r.dCat.join('|') === '9101|9000|9103'],
  D7: ['car numbers are written as TEXT (06302 keeps its zero, 1-2 is not a date), first car and copies alike', r => r.dRaw.join('|') === "'6301||'6305" && r.dLead === "'06302" && JSON.stringify(r.dCopyRaw) === JSON.stringify(["'1-2", "'0077"])],
  D6: ['track rows carry no typed numbers', r => r.dTrk.length === 3 && r.dTrk.every(v => v === '')],
  E1: ['one car with a number → one row carrying it; no number → blank (the catalog has none)', r => r.eOne === '6302' && r.eBlank === ''],
  F1: ['the item page shows the copy\'s Road Number', r => r.fPage === true],
  F2: ['a copy with no number shows no Road Number line', r => r.fBlankNone === true],
  F3: ['the edit panel offers Road Number with the copy\'s number', r => r.fPanel === true],
  G1: ['searching 6305 finds that car only', r => Array.isArray(r.gCar) && r.gCar.length === 1 && r.gCar[0].num === '275-9388' && r.gCar[0].road === '6305'],
  G2: ['a leading # is ignored (#6301 finds 6301)', r => Array.isArray(r.gHash) && r.gHash.length === 1 && r.gHash[0].road === '6301'],
  G3: ['the item number still finds every copy', r => Array.isArray(r.gNum) && r.gNum.filter(x => x.num === '275-9388').length === 5],
  G4: ['a number nobody painted finds nothing; another maker\'s copy is found by its number too', r => Array.isArray(r.gNone) && r.gNone.length === 0 && Array.isArray(r.gLio) && r.gLio.length === 1 && r.gLio[0].road === '8802'],
  G5: ['with Boxed on, the number search finds only a copy that carries the number AND has its box', r => Array.isArray(r.gBoxNo) && r.gBoxNo.length === 0 && Array.isArray(r.gBoxYes) && r.gBoxYes.length === 1 && r.gBoxYes[0].road === '6301'],
  H1: ['each Menards copy row with a number says "car N" (typed or the catalog\'s); Lionel copies and blank ones do not', r => JSON.stringify(r.hLabels) === JSON.stringify(['car 6301', 'car 6302', 'car 6305', 'car 9000', 'car 9101', 'car 9103'])],
};

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const { pg, errs } = await openApp(browser);
  let R;
  try { R = await scenario(pg); } catch (e) { console.log('FAIL  the scenario threw  -> ' + String(e && e.message || e).slice(0, 600)); console.log('FAILED  —  menards_cars: the scenario did not run'); await browser.close(); process.exit(1); }
  Object.keys(RULES).forEach(k => { let v = false, x = ''; try { v = !!RULES[k][1](R); } catch (e) { x = String(e); } ok(k + ' ' + RULES[k][0], v, x || JSON.stringify(pick(R, k))); });
  const appErrs = errs.filter(e => !/fonts|Failed to fetch|net::/i.test(e));
  ok('no page errors', appErrs.length === 0, appErrs.slice(0, 3).join(' | '));
  await pg.close();

  // a 320 px phone
  {
    const o = await openApp(browser, null, { width: 320, height: 654 });
    const R3 = await scenario(o.pg);
    ok('B5 on a 320 px phone the third car line is inside the screen and nothing slides sideways', R3.bFit && R3.bFit.left >= 0 && R3.bFit.right <= R3.bFit.vw && R3.bFit.w >= 80 && R3.bFit.inC && R3.bFit.sw <= R3.bFit.cw, JSON.stringify(R3.bFit));
    ok('B6 on a 320 px phone the three cars still save with their own numbers', R3.dRoad && R3.dRoad.join('|') === '6301||6305', JSON.stringify(R3.dRoad));
    await o.pg.close();
  }

  // ── P — planted offenders ──
  const src = (n) => fs.readFileSync(path.join(APP, n), 'utf8');
  const plant = (n, from, to) => { const s = src(n); const c = s.split(from).length - 1; if (c !== 1) throw new Error('plant anchor found ' + c + ' times in ' + n + ': ' + from.slice(0, 60)); return { [n]: s.split(from).join(to) }; };
  const plants = [
    ['P1 every copy given the first car\'s number', () => plant('wizard-save.js', "      c[F.roadNumber] = (_rn && _rn.charAt(0) !== \"'\") ? \"'\" + _rn : _rn;", ''), ['D2', 'D4']],
    ['P12 Road Number written as a plain number (not forced to text)', () => plant('app.js', "  ['itemNum', 'matchedTo', 'roadNumber'].forEach(function (_k) {", "  ['itemNum', 'matchedTo'].forEach(function (_k) {"), ['D7']],
    ['P13 the number search ignores the Boxed filter', () => plant('browse.js', "_carNumHit(p, _carQ) && (!_copyFiltersOn() || _copyPasses(p));", "_carNumHit(p, _carQ);"), ['G5']],
    ['P2 the maker list ignored (an MTH boxcar asked)', () => plant('wizard-save.js', "    return !!m && makers.some(function (x) { return String(x).trim().toLowerCase() === m; });", '    return true;'), ['A2']],
    ['P3 track given car lines', () => plant('wizard-save.js', '    return rrHowManyCarRow(row);\n', '    return true;\n'), ['A4', 'B4']],
    ['P4 the search never asks the painted number', () => plant('browse.js', '    if (!_carQ || !isOwned) return false;', '    return false;'), ['G1', 'G2']],
    ['P5 a row found by its number draws every copy', () => plant('browse.js', '        if (_carCps.length) _copiesFD = _carCps;', ''), ['G1']],
    ['P6 the item page line gone', () => plant('app-collection.js', "val: pd && pd.roadNumber ? rrEsc(String(pd.roadNumber)) : null },", "val: null },"), ['F1']],
    ['P7 the car label on every maker\'s copies', () => plant('browse.js', '    if (!rrHowManyCarRow(item._origItem || item)) return \'\';', ''), ['H1']],
    ['P8 the maker list emptied in config.js', () => plant('config.js', "  carMakers: ['Menards'],", '  carMakers: [],'), ['A1', 'A7']],
    ['P9 the car lines not redrawn when the count changes', () => plant('wizard.js', "  if (rrHowManyCount(wizard.data) !== _was) _rrCarNumsRepaint();   // 2026-11-26 (menardscars): one line per car", ''), ['B2']],
    ['P10 a blank car line left blank instead of the catalog\'s number', () => plant('wizard-save.js', "          _hmCars = rrCarNumbers(d).map(function (v) { return v || _hmCatRoad; });", "          _hmCars = rrCarNumbers(d);"), ['D5']],
    ['P11 the edit panel without Road Number', () => plant('app-collection.js', "[{ label: 'Road Number', key: 'roadNumber', val: pd.roadNumber || '—', type: 'text' }]", '[]'), ['F3']],
  ];
  for (const [name, mkServed, mustRed] of plants) {
    let served; try { served = mkServed(); } catch (e) { ok(name + ' — plant applies', false, e.message); continue; }
    const o = await openApp(browser, served);
    let Rp = null, threw = '';
    try { Rp = await scenario(o.pg); } catch (e) { threw = String(e && e.message || e); }
    const red = mustRed.filter(k => { if (!Rp) return true; try { return !RULES[k][1](Rp); } catch (e) { return true; } });
    ok(name + ' → turns ' + mustRed.join(', ') + ' red', red.length === mustRed.length, 'still green: ' + mustRed.filter(k => red.indexOf(k) < 0).join(', ') + (threw ? ' (scenario threw: ' + threw.slice(0, 120) + ')' : ''));
    await o.pg.close();
  }
  await browser.close();
  console.log((fail ? 'FAILED' : 'PASSED') + '  —  menards_cars: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();

function pick(R, k) {
  const p = k.charAt(0).toLowerCase(), o = {};
  Object.keys(R).forEach(n => { if (n.charAt(0) === p) o[n] = R[n]; });
  return o;
}
