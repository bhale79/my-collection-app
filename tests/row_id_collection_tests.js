#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ROW ID IN THE APP — v0.9.1880   (real Chromium, the REAL app, no stubs)
//
// [stated] Brad: "yes" — CATALOG_ROW_ID_PLAN_2026-10-04, Step 2.
//
// Lionel Pre-War No. 800, no variation, is TWO products: the 1904 2-7/8"
// Electric Boxcar (a motor car) and the 1915 O-gauge boxcar. Their old link
// (Master Key "prewar|800|") is the same, so a collector who owned the boxcar
// was shown the motor car. Here a collector owns BOTH, each saved with its
// row's permanent Row ID (Master Row ID), plus a variation-C boxcar saved the
// old way (no ID) and a powered A unit by its base number.
//
// A  My Collection draws each copy on ITS row — once — and the old-way copy
//    exactly as before; nothing appears twice as a stray personal-only row
// B  the dashboard counts each by its own row (the motor car is an engine)
// C  saving: the Row ID is written into the new last column; the catalog
//    description follows the ID; a stored key with no ID records the row the
//    app shows today; nothing stored records this save's own match
// D  PLANTED: My Collection's Row ID rules cut out → the boxcar collector is
//    shown the wrong rows (A catches it)
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  row_id_collection_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail))); cond ? pass++ : fail++; }

// The planted browse.js: the four v0.9.1880 Row ID rules cut out, each cut asserted.
function plantedBrowse() {
  let s = fs.readFileSync(path.join(APP, 'browse.js'), 'utf8');
  const cuts = [
    [/\n      \/\/ v0\.9\.1880: a saved ROW ID settles it before anything else[\s\S]*?\n      \}\n(?=      \/\/ v0\.9\.1198: a STORED master key)/, '\n'],
    [/\n    if \(_bvById && item\.rowId\) \{[\s\S]*?\n    \}\n/, '\n'],
    [/\n    \/\/ v0\.9\.1880: a found copy whose saved Row ID names a DIFFERENT row[\s\S]*?\n    \}\n/, '\n'],
    [/\n      \/\/ v0\.9\.1880: a saved Row ID names exactly one row — it decides first[\s\S]*?\n      \}\n(?=      if \(p\.masterKey && _itKey\))/, '\n'],
  ];
  cuts.forEach(([re, to], i) => { const before = s; s = s.replace(re, to); if (s === before) throw new Error('planted browse.js: cut ' + (i + 1) + ' not found — the rule moved; update this test'); });
  return s;
}

async function run(browser, planted) {
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    if (planted && u.split('?')[0].endsWith('/app/browse.js')) return r.fulfill({ body: planted, contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(800);
  const out = await pg.evaluate(() => {
    const PRE = 'Lionel Pre-War', PW = 'Lionel PW - Items';
    const mk = (n, v, t, desc, era, tab, id, yr) => ({ itemNum: n, variation: v, itemType: t, description: desc, _era: era, _tab: tab, rowId: id, yearProd: yr || '', roadName: '', gauge: 'O' });
    const motor = mk('800', '', 'Motorized Unit', 'Electric Box Car (2 7/8")', 'prewar', PRE, 'MMMMMMMMMM', '1904-1905');
    const box = mk('800', '', 'Boxcar', 'Box Car (O gauge)', 'prewar', PRE, 'BBBBBBBBBB', '1915-1926');
    const boxC = mk('800', 'C', 'Boxcar', 'Box Car, variation C', 'prewar', PRE, 'CCCCCCCCCC', '1915');
    const alco = mk('2343', '1', 'Diesel Locomotive', 'Santa Fe F3 A unit', 'pw', PW, 'DDDDDDDDDD', '1950');
    state.masterData = [motor, box, boxC, alco];
    _rebuildMasterIndex();
    const r = { indexed: !!(state.masterByRowId && state.masterByRowId.get('BBBBBBBBBB') === box) };
    let inv = 1;
    const pd = (n, v, era, x) => Object.assign({ owned: true, itemNum: n, variation: v, era: era, manufacturer: 'Lionel', inventoryId: String(inv++), row: inv + 1, condition: '7' }, x || {});
    state.personalData = {
      a: pd('800', '', 'prewar', { masterKey: 'prewar|800|', masterRowId: 'BBBBBBBBBB', userEstWorth: '111' }),   // the O-gauge boxcar
      b: pd('800', '', 'prewar', { masterKey: 'prewar|800|', masterRowId: 'MMMMMMMMMM', userEstWorth: '222' }),   // the 1904 motor car
      c: pd('800', 'C', 'prewar', { userEstWorth: '444' }),                                                          // saved the old way
      d: pd('2343-P', '1', 'pw', { masterRowId: 'DDDDDDDDDD', userEstWorth: '333' }),                                // powered unit, base number
    };
    state.soldData = {}; state.wantData = state.wantData || {};
    _currentEra = 'all';
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-browse').classList.add('active');
    localStorage.setItem('lv_browse_filter_state', JSON.stringify({ manufacturer: 'any', scale: 'any', era: 'any', section: 'all' }));
    state.filters.ownMaker = ''; state.filters.type = ''; state.filters.subCollection = ''; state.filters.subType = '';
    filterOwned();
    window._rrBrowseSig = null; renderBrowse();
    // what was DRAWN: each row's description and the worth of the copy it shows
    r.rows = Array.from(document.querySelectorAll('tr')).map(tr => {
      const d = tr.querySelector('td[data-col="desc"]'), w = tr.querySelector('td[data-col="worth"]');
      return d ? { desc: d.textContent.trim(), worth: w ? w.textContent.replace(/[^0-9]/g, '') : '' } : null;
    }).filter(Boolean);
    r.drawnCount = (state.filteredData || []).length;
    r.personalOnly = (state.filteredData || []).filter(x => x._personalOnly).map(x => x.itemNum);
    // B: the dashboard, by each item's own row
    r.breakdown = (typeof _ownedTypeBreakdown === 'function') ? _ownedTypeBreakdown(state) : null;
    // the resolver, for each copy
    r.fm = Object.keys(state.personalData).map(k => { const p = state.personalData[k]; const m = findMaster(p.itemNum, p.variation, p); return k + ':' + (m ? m.rowId : 'none'); });
    // C: saving
    const F = PERSONAL_FIELD_INDEX;
    const rowB = buildPersonalRow({ itemNum: '800', variation: '', era: 'prewar', manufacturer: 'Lionel', masterKey: 'prewar|800|', masterRowId: 'BBBBBBBBBB' });
    const rowK = buildPersonalRow({ itemNum: '800', variation: '', era: 'prewar', manufacturer: 'Lionel', masterKey: 'prewar|800|' });
    const rowN = buildPersonalRow({ itemNum: '800', variation: 'C', era: 'prewar', manufacturer: 'Lionel' });
    const rowM = buildPersonalRow({ itemNum: 'SIGN-1', variation: '', era: 'Manual', manufacturer: 'Lionel', itemType: 'Accessory' });
    r.save = {
      lastField: PERSONAL_SCHEMA[PERSONAL_SCHEMA.length - 1].field, lastHeader: PERSONAL_HEADERS[PERSONAL_HEADERS.length - 1],
      idGiven: rowB[F.masterRowId], descFollowsId: rowB[F.masterDescription], keyGiven: rowB[F.masterKey],
      keyOnly: rowK[F.masterRowId], nothing: rowN[F.masterRowId], manual: rowM[F.masterRowId],
    };
    return r;
  });
  await pg.close();
  return { out, errs };
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const real = await run(browser, null);
  const o = real.out;
  const row = re => o.rows.filter(x => re.test(x.desc));
  console.log('== A · My Collection draws each copy on ITS row ==');
  T('A0 the page ran without a script error', real.errs.length === 0, real.errs);
  T('A1 the Row ID index is built with the catalog', o.indexed);
  T('A2 four rows drawn — the two 800s under one number+variation each once, the variation C, the A unit', o.drawnCount === 4 && o.rows.length === 4, o.rows);
  T('A3 the O-gauge boxcar row shows the boxcar collector\'s copy ($111)', row(/Box Car \(O gauge\)/).length === 1 && row(/Box Car \(O gauge\)/)[0].worth === '111', o.rows);
  T('A4 the 1904 motor car row shows the motor car copy ($222)', row(/Electric Box Car/).length === 1 && row(/Electric Box Car/)[0].worth === '222', o.rows);
  T('A5 the copy saved the old way (variation C, no ID) is drawn exactly as before ($444)', row(/variation C/).length === 1 && row(/variation C/)[0].worth === '444', o.rows);
  T('A6 the powered A unit finds its base row by ID ($333)', row(/F3 A unit/).length === 1 && row(/F3 A unit/)[0].worth === '333', o.rows);
  // (a powered unit like 2343-P is drawn in the personal-only lane, enriched from its base row — that is how
  //  suffix items have always been drawn; what must never happen is an ID-seated 800 drawn there AS WELL)
  T('A7 no ID-seated copy appears again as a stray personal-only row', o.personalOnly.filter(n => n === '800').length === 0, o.personalOnly);
  T('A8 findMaster: each copy opens its own row', JSON.stringify(o.fm) === JSON.stringify(['a:BBBBBBBBBB', 'b:MMMMMMMMMM', 'c:CCCCCCCCCC', 'd:DDDDDDDDDD']), o.fm);
  console.log('\n== B · the dashboard ==');
  T('B1 Collection by Type: the motor car and the A unit are engines, the two boxcars freight',
    o.breakdown && o.breakdown.Engines === 2 && o.breakdown.Freight === 2 && o.breakdown.Other === 0, o.breakdown);
  console.log('\n== C · saving ==');
  T('C1 the collection sheet\'s new column is the LAST one (column rule): Master Row ID', o.save.lastField === 'masterRowId' && o.save.lastHeader === 'Master Row ID', o.save);
  T('C2 a save that knows the row writes its Row ID — and the catalog description follows the ID',
    o.save.idGiven === 'BBBBBBBBBB' && o.save.descFollowsId === 'Box Car (O gauge)' && o.save.keyGiven === 'prewar|800|', o.save);
  T('C3 a stored key with no ID records the row the app shows today (the first — the motor car)', o.save.keyOnly === 'MMMMMMMMMM', o.save);
  T('C4 nothing stored: this save\'s own match (variation C)', o.save.nothing === 'CCCCCCCCCC', o.save);
  T('C5 a manual entry gets no catalog identity', o.save.manual === '', o.save);
  const ac = fs.readFileSync(path.join(APP, 'app-collection.js'), 'utf8');
  T('C6 the edit panel CARRIES the saved Row ID through a full-row update (never re-guessed)',
    /masterRowId: pd\.masterRowId \|\| '',/.test(ac) && /pd\.masterRowId = \(_nm && typeof rrMasterRowIdOf === 'function'\) \? rrMasterRowIdOf\(_nm\) : '';/.test(ac));
  const ws = fs.readFileSync(path.join(APP, 'wizard-save.js'), 'utf8'), iu = fs.readFileSync(path.join(APP, 'import-ui.js'), 'utf8');
  T('C7 the wizard saves the CONFIRMED row\'s ID; the import saves its matched row\'s ID',
    /masterRowId: \(typeof wizard !== 'undefined' && wizard && wizard\.matchedItem && typeof rrMasterRowIdOf === 'function'\)/.test(ws)
    && /fields\.masterRowId = rrMasterRowIdOf\(m\)/.test(iu));

  console.log('\n== D · PLANTED: the Row ID rules cut out of browse.js ==');
  const old = await run(browser, plantedBrowse());
  const orow = re => old.out.rows.filter(x => re.test(x.desc));
  T('D0 the planted page ran', old.errs.length === 0, old.errs);
  T('D1 PLANTED: the boxcar collector is no longer shown his copy on the boxcar row — A3 catches it',
    !(orow(/Box Car \(O gauge\)/).length === 1 && orow(/Box Car \(O gauge\)/)[0].worth === '111'), old.out.rows);
  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + (e && e.stack || e)); process.exit(1); });
