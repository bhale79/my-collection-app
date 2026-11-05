#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THE ADD SCREEN'S FILTERS REALLY FILTER — the road   (real Chromium, the REAL app)
// 2026-11-01. [stated] Brad 05:30 CT: "i want the filters to actually filter. if
// there is no 1511 for lionel postwar, nothing shows up"; 05:35/05:39/05:41 CT:
// the maker · era tag on every row and the three "nothing found" lines.
// The catalog here is Brad's 1511 rows: Lionel Pre-War (2), American Models S,
// S-Helper S, Atlas O (1511-1/-2), Atlas HO, Weaver O — and NO Lionel Postwar.
//
//   A  Lionel · Postwar · 1511: no suggestion — the three lines instead (exact
//      words, "1511 is in the Master Catalog under other makers or eras"); the
//      banner holds nothing; Next → step 2 with no catalog card and no
//      "View on" link; the save writes no catalog Row ID
//   B  Lionel · Pre-War · 1511: only Pre-War rows, tagged LIONEL · PREWAR; the
//      tapped row = the banner's = step 2's = the saved Row ID
//   C  American Models · 1511 (Era goes Modern by itself): the CSX boxcar on
//      every step, and saved
//   D  Era All · Lionel: only the Lionel rows; Era All, any maker: the three
//      rows read LIONEL · PREWAR / AMERICAN MODELS · S / S-HELPER SERVICE · S;
//      one tag per row
//   E  the empty state: no filter → "No item found in our Master Catalog", no
//      Clear line; a number that exists NOWHERE gets no "elsewhere" note;
//      Clear filters keeps "1511" and shows the list; Add manually opens Manual
//      with 1511 and Lionel
//   L  the layout: on a laptop the tag sits on the number's line, on an iPhone
//      it drops to a small line under it; nothing overlaps, no sideways scroll
//   P  planted offenders in a served copy of the app — the old escapes put back
//      must turn A red
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  add_filters_road_tests needs playwright and it is not installed.'); process.exit(1); }
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
  { itemNum: '1511', variation: '', itemType: 'Steam Locomotive', description: '0-4-0 Locomotive (O)', roadName: '', yearProd: '1936-1937', _era: 'prewar', _tab: 'Lionel Pre-War', gauge: 'O', rowId: 'PRE1511A' },
  { itemNum: '1511', variation: '', itemType: 'Set', description: 'Outfit No. 1511 (O)', roadName: '', yearProd: '1936', _era: 'prewar', _tab: 'Lionel Pre-War', gauge: 'O', rowId: 'PRE1511B' },
  { itemNum: '1511', variation: '', itemType: 'Boxcar', description: "CSX Link 50' Rib-sided Boxcar", roadName: 'CSX', yearProd: '1998', _era: 'am_s', _tab: 'American Models S', gauge: 'S', rowId: 'AMS1511' },
  { itemNum: '1511', variation: '', itemType: 'Hopper', description: 'Twin Hopper', roadName: 'B&O', yearProd: '2003', _era: 'shelper', _tab: 'S-Helper Service S', gauge: 'S', rowId: 'SH1511' },
  { itemNum: '1511-1', variation: '', itemType: 'Boxcar', description: 'Atlas boxcar', roadName: 'Erie', yearProd: '2006', _era: 'atlas', _tab: 'Atlas O', gauge: 'O', trackPower: '3-Rail', rowId: 'AO15111' },
  { itemNum: '1511-2', variation: '', itemType: 'Boxcar', description: 'Atlas boxcar', roadName: 'Erie', yearProd: '2006', _era: 'atlas', _tab: 'Atlas O', gauge: 'O', trackPower: '2-Rail', rowId: 'AO15112' },
  { itemNum: '1511', variation: '', itemType: 'Boxcar', description: 'HO boxcar', roadName: 'Erie', yearProd: '2004', _era: 'atlas_ho', _tab: 'Atlas HO', gauge: 'HO', rowId: 'AHO1511' },
  { itemNum: '1511-L', variation: '', itemType: 'Steam Locomotive', description: 'Weaver loco', roadName: 'PRR', yearProd: '2000', _era: 'weaver', _tab: 'Weaver O', gauge: 'O', trackPower: '2-Rail', rowId: 'WV1511L' },
  { itemNum: '2343', variation: '', itemType: 'Diesel Locomotive', description: 'Santa Fe F3', roadName: 'Santa Fe', yearProd: '1950', _era: 'pw', _tab: 'Lionel PW - Items', gauge: 'O', rowId: 'PW2343' },
];

async function scenario(pg, wantLayout) {
  return pg.evaluate(async ([ROWS, wantLayout]) => {
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
    window.buildDashboard = () => {}; window.renderBrowse = () => {}; window.loadPersonalData = async () => {};
    window.showToast = () => {}; window.rrMaybeShowAddHelp = () => {};
    window._getAllErasMasterForSearch = async () => {}; window._allErasSearchCache = null;
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
    const F = PERSONAL_FIELD_INDEX;
    const cell = (row, f) => String(row[F[f]] == null ? '' : row[F[f]]).replace(/^'/, '');
    const W = RR_ADD_FILTERS;
    const sugg = () => document.getElementById('wiz-suggestions');
    const rows = () => Array.from(sugg().querySelectorAll('[data-idx]'));
    const rowNum = (r) => (r.querySelector('span') || {}).textContent;
    const rowTags = (r) => Array.from(r.querySelectorAll('[data-row-tag]')).map(t => t.textContent);
    const nf = () => sugg().querySelector('[data-nothing-found]');
    const stepType = () => (wizard.steps[wizard.step] || {}).type;
    const setSel = (id, v) => { const s = document.getElementById(id); if (!s) return false; s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); return true; };
    const type = async (v) => {
      const i = document.getElementById('wiz-input'); i.value = v;
      i.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(330);   // the list's own 250 ms debounce, for real
    };
    const fresh = async (mfr, era) => {
      try { localStorage.setItem('lv_add_mfr', mfr || ''); localStorage.setItem('lv_add_era', era || ''); localStorage.removeItem('lv_add_scale'); } catch (e) {}
      if (typeof _doCloseWizard === 'function' && window.wizard && wizard.steps && wizard.steps.length) { try { _doCloseWizard(); } catch (e) {} }
      await openWizard('collection'); wizard.data._era = 'all'; await sleep(150);
      if (stepType() !== 'itemNumGrouping') { for (let k = 0; k < 4 && stepType() !== 'itemNumGrouping'; k++) { await wizardNext(); await sleep(120); } }
    };
    const banner = () => { const b = document.getElementById('wizard-adding-banner'); return b ? b.textContent.replace(/\s+/g, ' ').trim() : ''; };
    const bannerTag = () => { const b = document.getElementById('wizard-adding-banner'); const t = b && b.querySelector('[data-row-tag]'); return t ? t.textContent : ''; };
    const cdHead = () => { const h = document.querySelector('#wizard-modal .cd-head'); return h ? h.textContent.replace(/\s+/g, ' ').trim() : ''; };
    const cdTag = () => { const h = document.querySelector('#wizard-modal .cd-head [data-row-tag]'); return h ? h.textContent : ''; };
    const cdLink = () => { const h = document.querySelector('#wizard-modal .cd-head a'); return h ? h.textContent.trim() : ''; };
    const toStep2 = async () => { for (let k = 0; k < 6 && stepType() !== 'conditionDetails'; k++) { await wizardNext(); await sleep(150); } };
    const save = async () => {
      appended.length = 0;
      Object.assign(wizard.data, { condition: 7, allOriginal: 'Yes', hasBox: 'No', tenderMatch: 'none', setMatch: '', priceItem: '', userEstWorth: '5' });
      try { await saveWizardItem(); } catch (e) { return 'ERR ' + e.message; }
      const r = appended.find(x => cell(x, 'itemNum') === '1511') || appended[0] || [];
      return cell(r, 'masterRowId') + '|' + cell(r, 'itemNum');
    };

    // ── A: Lionel · Postwar · 1511 ──
    await fresh('Lionel', 'postwar');
    R.aFilters = [document.getElementById('wiz-search-mfr').value, document.getElementById('wiz-search-era').value].join('/');
    await type('1511');
    R.aRows = rows().length;
    const n = nf();
    R.aNF = !!n;
    R.aLine1 = n ? n.querySelector('[data-nf-line="none"]').textContent : '';
    R.aExpect1 = W.noneFor.replace('{num}', '1511').replace('{filters}', 'Lionel · Postwar');
    R.aElse = n && n.querySelector('[data-nf-elsewhere]') ? n.querySelector('[data-nf-elsewhere]').textContent : '';
    R.aExpectElse = W.elsewhere.replace('{num}', '1511');
    R.aClear = n ? n.querySelector('[data-nf-line="clear"]').textContent : '';
    R.aManual = n ? n.querySelector('[data-nf-line="manual"]').textContent : '';
    R.aMatched = wizard.matchedItem;
    lookupItem('1511');
    R.aFound = wizard.matchedItem;
    R.aWizMatch = (document.getElementById('wiz-match') || {}).textContent || '';
    await toStep2();
    R.aStep = stepType(); R.aMatched2 = wizard.matchedItem; R.aBanner = banner(); R.aBannerTag = bannerTag();
    R.aCd = cdHead(); R.aCdTag = cdTag(); R.aCdLink = cdLink();
    R.aSave = await save();

    // ── B: Lionel · Pre-War · 1511, tap the engine ──
    await fresh('Lionel', 'prewar');
    await type('1511');
    R.bNums = rows().map(rowNum).join(',');
    R.bTags = rows().map(r => rowTags(r).join('+')).join(',');
    const eng = rows().find(r => /Steam|0-4-0/i.test(r.textContent));
    if (eng) eng.click();
    await sleep(500);
    R.bPicked = wizard.matchedItem && wizard.matchedItem.rowId;
    await toStep2();
    R.bStep = stepType(); R.bBanner = banner(); R.bBannerTag = bannerTag(); R.bCd = cdHead(); R.bCdTag = cdTag(); R.bRow2 = wizard.matchedItem && wizard.matchedItem.rowId;
    R.bSave = await save();

    // ── C: American Models · 1511 — the Era goes Modern by itself ──
    await fresh('', '');
    setSel('wiz-search-mfr', 'American Models');
    R.cEra = document.getElementById('wiz-search-era').value;
    await type('1511');
    R.cNums = rows().map(r => rowNum(r) + ':' + rowTags(r).join('+')).join(',');
    await toStep2();
    R.cStep = stepType(); R.cBanner = banner(); R.cBannerTag = bannerTag(); R.cCd = cdHead(); R.cCdTag = cdTag(); R.cCdLink = cdLink(); R.cRow2 = wizard.matchedItem && wizard.matchedItem.rowId;
    R.cSave = await save();

    // ── D: Era All ──
    await fresh('Lionel', '');
    await type('1511');
    R.dLionel = rows().map(r => rowNum(r) + ':' + rowTags(r).join('+')).join(',');
    await fresh('', '');
    await type('1511');
    R.dAll = rows().filter(r => rowNum(r) === '1511').map(r => r.textContent.indexOf('Set') >= 0 ? null : rowTags(r).join('+')).filter(Boolean);
    R.dOneEach = rows().every(r => rowTags(r).length === 1);
    R.dNoRailChip = rows().every(r => !/^\s*(Atlas|Weaver)?\s*\d-Rail\s*$/i.test(Array.from(r.querySelectorAll('span')).map(s => s.textContent).join('|')));

    // ── L: the layout (whatever this context's screen is) ──
    if (wantLayout) {
      const r0 = rows()[0];
      const box = (el) => el.getBoundingClientRect();
      const num = r0.querySelector('span'), tg = r0.querySelector('[data-row-tag]');
      const bn = box(num), bt = box(tg);
      R.lSameLine = Math.abs((bn.top + bn.bottom) / 2 - (bt.top + bt.bottom) / 2) < 6;
      R.lBelow = bt.top >= bn.bottom - 1;
      // nothing overlaps on ANY row: every pair of visible parts of a row
      R.lOverlap = rows().some(r => {
        const parts = Array.from(r.querySelectorAll('span, a, .wiz-sug-details')).filter(e => !e.classList.contains('wiz-sug-spacer') && e.offsetParent && e.getBoundingClientRect().width > 0 && e.textContent.trim());
        for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
          if (parts[i].contains(parts[j]) || parts[j].contains(parts[i])) continue;
          const a = parts[i].getBoundingClientRect(), b = parts[j].getBoundingClientRect();
          if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) return true;
        }
        return false;
      });
      R.lTagOneLine = rows().every(r => { const t = r.querySelector('[data-row-tag]'); return !t || t.getBoundingClientRect().height < 22; });
      const sg = sugg();
      R.lNoSideScroll = sg.scrollWidth <= sg.clientWidth + 1 && document.documentElement.scrollWidth <= window.innerWidth + 1;
      R.lTagH = Math.round(box(tg).height);
    }

    // ── E: the empty state ──
    await fresh('', '');
    await type('987654');
    R.eNone = nf() ? nf().textContent : '';
    R.eNoClear = !!nf() && !nf().querySelector('[data-nf-line="clear"]');
    await fresh('Lionel', '');
    await type('987654');
    R.eNoElse = !!nf() && !nf().querySelector('[data-nf-elsewhere]') && !!nf().querySelector('[data-nf-line="clear"]');
    // Clear filters keeps 1511
    await fresh('Lionel', 'postwar');
    await type('1511');
    const clr = nf() && nf().querySelector('[data-nf-btn="clear"]');
    if (clr) clr.click();
    await sleep(100);
    R.eClear = { input: document.getElementById('wiz-input').value, rows: rows().length, nf: !!nf(), mfr: document.getElementById('wiz-search-mfr').value, era: document.getElementById('wiz-search-era').value,
      tagged: rows().every(r => rowTags(r).length === 1) };
    // Add manually carries 1511 + Lionel
    await fresh('Lionel', 'postwar');
    await type('1511');
    const man = nf() && nf().querySelector('[data-nf-btn="manual"]');
    if (man) man.click();
    await sleep(500);
    R.eManual = { manual: !!wizard.data._manualEntry, num: wizard.data.manualItemNum, mfr: wizard.data.manualManufacturer, step: (wizard.steps[wizard.step] || {}).id };
    try { _doCloseWizard(); } catch (e) {}
    // the Want list: the same number step, the same one test
    try { localStorage.setItem('lv_add_mfr', 'Lionel'); localStorage.setItem('lv_add_era', 'postwar'); } catch (e) {}
    await openWizard('want'); await sleep(150);
    for (let k = 0; k < 4 && stepType() !== 'itemNumGrouping'; k++) { await wizardNext(); await sleep(120); }
    R.wStep = stepType();
    if (R.wStep === 'itemNumGrouping') { await type('1511'); R.wRows = rows().length; R.wNF = nf() ? nf().querySelector('[data-nf-line="none"]').textContent : ''; }
    try { _doCloseWizard(); } catch (e) {}
    return R;
  }, [ROWS, wantLayout]);
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const t0 = Date.now();

  // ── the laptop: the whole road ──
  {
    const { ctx, pg, errs } = await openApp(browser, LAPTOP, null);
    const R = await scenario(pg, true).catch(e => ({ err: String(e && e.stack || e) }));
    if (R.err) ok('the road runs', false, R.err);
    else {
      ok('A0 the filters read Lionel / Postwar', R.aFilters === 'Lionel/postwar', R.aFilters);
      ok('A1 Lionel · Postwar · 1511: no suggestion at all', R.aRows === 0, R.aRows);
      ok('A2 the first line: "No 1511 found for Lionel · Postwar in our Master Catalog"', R.aNF && R.aLine1 === R.aExpect1 && R.aLine1 === 'No 1511 found for Lionel · Postwar in our Master Catalog', R.aLine1);
      ok('A3 the number is elsewhere, and the line says so', R.aElse === R.aExpectElse && R.aElse === '1511 is in the Master Catalog under other makers or eras', R.aElse);
      ok('A4 "Clear filters?" + its button; "Add manually?" + its button', /Clear filters\?\s*Clear filters$/.test(R.aClear.replace(R.aElse, '').trim()) && /^Add manually\?\s*Add manually$/.test(R.aManual.trim()), JSON.stringify([R.aClear, R.aManual]));
      ok('A5 the "Found" lookup holds nothing (matchedItem null)', R.aMatched == null && R.aFound == null, JSON.stringify(R.aFound));
      ok('A6 …and does not repeat the message under the box', R.aWizMatch.trim() === '', R.aWizMatch);
      ok('A7 Next → step 2, still no row', R.aStep === 'conditionDetails' && R.aMatched2 == null, R.aStep);
      ok('A8 the banner names the number alone — no Pre-War "0-4-0", no tag', /No\.\s*1511/.test(R.aBanner) && !/0-4-0|CSX|Boxcar/.test(R.aBanner) && R.aBannerTag === '', R.aBanner);
      ok('A9 step 2: no catalog card (no CSX boxcar), no tag, no "View on" link', !/CSX|0-4-0|Hopper/.test(R.aCd) && R.aCdTag === '' && R.aCdLink === '', JSON.stringify([R.aCd, R.aCdLink]));
      ok('A10 the save writes no catalog Row ID', /^\|1511$/.test(R.aSave), R.aSave);
      ok('B1 Lionel · Pre-War · 1511: only the Pre-War rows', R.bNums === '1511,1511', R.bNums);
      ok('B2 each tagged LIONEL · PREWAR', R.bTags === 'LIONEL · PREWAR,LIONEL · PREWAR', R.bTags);
      ok('B3 the tapped row = the banner\'s = step 2\'s = the saved Row ID (PRE1511A)', R.bPicked === 'PRE1511A' && R.bRow2 === 'PRE1511A' && R.bSave === 'PRE1511A|1511', JSON.stringify([R.bPicked, R.bRow2, R.bSave]));
      ok('B4 banner and step 2 say the Pre-War engine with the SAME tag', /0-4-0/.test(R.bBanner) && /0-4-0/.test(R.bCd) && R.bBannerTag === 'LIONEL · PREWAR' && R.bCdTag === 'LIONEL · PREWAR', JSON.stringify([R.bBanner, R.bCd, R.bBannerTag, R.bCdTag]));
      ok('C1 picking American Models sets Era to Modern by itself', R.cEra === 'modern', R.cEra);
      ok('C2 American Models · 1511: the CSX boxcar only, tagged AMERICAN MODELS · S', R.cNums === '1511:AMERICAN MODELS · S', R.cNums);
      ok('C3 the CSX boxcar on every step and in the save', R.cStep === 'conditionDetails' && /CSX/.test(R.cBanner) && /CSX/.test(R.cCd) && R.cRow2 === 'AMS1511' && R.cSave === 'AMS1511|1511'
        && R.cBannerTag === 'AMERICAN MODELS · S' && R.cCdTag === 'AMERICAN MODELS · S', JSON.stringify([R.cBanner, R.cCd, R.cSave]));
      ok('D1 Era All + Lionel: only the Lionel rows', R.dLionel === '1511:LIONEL · PREWAR,1511:LIONEL · PREWAR', R.dLionel);
      ok('D2 Era All · 1511: LIONEL · PREWAR / AMERICAN MODELS · S / S-HELPER SERVICE · S (and Atlas HO)',
        ['LIONEL · PREWAR', 'AMERICAN MODELS · S', 'S-HELPER SERVICE · S'].every(t => R.dAll.indexOf(t) >= 0), JSON.stringify(R.dAll));
      ok('D3 exactly one tag on every row; no separate rail chip', R.dOneEach && R.dNoRailChip);
      ok('E1 no filter, a number nowhere: "No item found in our Master Catalog", no Clear line', /^No item found in our Master Catalog/.test(R.eNone) && R.eNoClear, R.eNone);
      ok('E2 a number that exists nowhere never gets the "elsewhere" note', R.eNoElse);
      ok('E3 Clear filters: filters blank, "1511" kept, the list shows, every row tagged', R.eClear.input === '1511' && R.eClear.rows >= 4 && !R.eClear.nf && R.eClear.mfr === '' && R.eClear.era === '' && R.eClear.tagged, JSON.stringify(R.eClear));
      ok('E4 Add manually: Manual, carrying 1511 and Lionel', R.eManual.manual && R.eManual.num === '1511' && R.eManual.mfr === 'Lionel', JSON.stringify(R.eManual));
      ok('W1 the Want list: Lionel · Postwar · 1511 → no suggestion, the same first line', R.wStep === 'itemNumGrouping' && R.wRows === 0 && R.wNF === 'No 1511 found for Lionel · Postwar in our Master Catalog', JSON.stringify([R.wStep, R.wRows, R.wNF]));
      ok('L1 laptop: the tag sits on the number\'s line, on one line', R.lSameLine && R.lTagOneLine, JSON.stringify([R.lSameLine, R.lTagH]));
      ok('L2 laptop: nothing overlaps, no sideways scroll', !R.lOverlap && R.lNoSideScroll, JSON.stringify([R.lOverlap, R.lNoSideScroll]));
      ok('L3 no page errors (laptop)', errs.length === 0, errs.join(' | '));
    }
    await ctx.close();
  }
  // ── the iPhone: the layout, and the road holds there too ──
  {
    const { ctx, pg, errs } = await openApp(browser, PHONE, null);
    const R = await scenario(pg, true).catch(e => ({ err: String(e && e.stack || e) }));
    if (R.err) ok('the phone road runs', false, R.err);
    else {
      ok('L4 iPhone: Lionel · Postwar · 1511 → the three lines, nothing picked', R.aRows === 0 && R.aNF && R.aMatched2 == null && /^\|1511$/.test(R.aSave), JSON.stringify([R.aRows, R.aSave]));
      ok('L5 iPhone: the tag drops to a small line under the number', R.lBelow && !R.lSameLine && R.lTagOneLine, JSON.stringify([R.lBelow, R.lSameLine, R.lTagH]));
      ok('L6 iPhone: nothing overlaps, no sideways scroll', !R.lOverlap && R.lNoSideScroll, JSON.stringify([R.lOverlap, R.lNoSideScroll]));
      ok('L7 no page errors (iPhone)', errs.length === 0, errs.join(' | '));
    }
    await ctx.close();
  }

  // ── P: the old escapes put back must turn A red ──
  const WS = read('wizard-suggestions.js'), WZ = read('wizard.js');
  {
    // the picker's "first row with this number" escape (v0.9.1482's last resort)
    const served = { 'wizard-suggestions.js': plant(WS, "  if (!rows.length) return null;\n  if (prefType) {",
      "  if (!rows.length) return ((typeof state !== 'undefined' && state.masterData) || []).find(function (i) { return String(i.itemNum || '').toLowerCase() === numLC; }) || null;\n  if (prefType) {", 'first-row escape') };
    const { ctx, pg } = await openApp(browser, LAPTOP, served);
    const R = await scenario(pg, false).catch(e => ({ err: String(e) }));
    ok('P1 PLANTED the "first row with the number" escape: A5/A9 can fail (the Pre-War row comes back)', !R.err && (R.aFound != null || R.aMatched2 != null), R.err || JSON.stringify(R.aFound));
    await ctx.close();
  }
  {
    // step 2's second lookup put back
    const served = { 'wizard.js': plant(WZ, 'const _cdMaster = _wizAddRow();', "const _cdMaster = wizard.matchedItem || findMaster(_cdItemNum, '', null);", 'step 2 second lookup') };
    const { ctx, pg } = await openApp(browser, LAPTOP, served);
    const R = await scenario(pg, false).catch(e => ({ err: String(e) }));
    ok('P2 PLANTED step 2\'s second lookup: A9 can fail (another maker\'s 1511 on the card)', !R.err && (/CSX|0-4-0|Hopper|HO boxcar/.test(R.aCd) || R.aCdLink !== ''), R.err || R.aCd);
    await ctx.close();
  }

  {
    // the save's "no catalog row" flag taken away: the row builder borrows the Pre-War row again
    const served = { 'wizard-save.js': plant(read('wizard-save.js'), '_noCatalogRow: _wizNoRow || undefined,', '', 'no-row flag') };
    const { ctx, pg } = await openApp(browser, LAPTOP, served);
    const R = await scenario(pg, false).catch(e => ({ err: String(e) }));
    ok('P3 PLANTED the save without its "no catalog row" flag: A10 can fail (a borrowed Row ID)', !R.err && !/^\|1511$/.test(R.aSave), R.err || R.aSave);
    await ctx.close();
  }

  await browser.close();
  console.log('\n(' + Math.round((Date.now() - t0) / 1000) + ' s) ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
