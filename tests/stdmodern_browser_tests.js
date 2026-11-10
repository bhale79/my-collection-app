#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// LIONEL · STANDARD · MODERN — 2026-11-08 stdmodern (real Chromium, the REAL app)
//
// [stated] Brad 2026-11-08 15:40 CT (Master Catalog, Lionel + Standard / OO /
// Tinplate + Modern -> "No items"): "there are many standard guage lionel modern
// trains, they have mth badge. see whats going on" -> "yes" to
// PLAN_2026-11-08_LIONEL_STANDARD_MODERN -> "put a, b, and c together".
//
// The app read EVERY row on the Lionel MPC-Modern tab as O — the tab's one scale
// outranked the row's own Gauge cell (_scalesOfItem, app.js). The fix: a row on a
// one-scale line whose own Gauge names a scale the line may also carry reads as
// that scale (rrRowOwnLineScale; the list is config.js RR_LINE_ROW_SCALES).
//
// A stand-in catalog, shaped like the live tabs: Lionel modern rows with a blank
// Gauge (O), one "Standard O", and Lionel's own 13100 390E with Gauge "Standard";
// MTH Tinplate 11- rows "Also Sold As: Lionel Corporation" (one Standard, one O),
// an MTH-only Tinplate row, an MTH O row sharing 11-1005, and a Pre-War 390E.
//   A  Lionel + Standard + Modern: 13100 and the Standard 11- row (with "as Lionel")
//   B  Lionel + O + Modern: the blank-gauge rows and the O-gauge 11- row, not 13100
//   C  MTH + Standard / O: the MTH rows, each under its own gauge
//   D  Any scale: the same rows as before the fix (blank-gauge rows untouched)
//   E  Lionel + Standard + Pre-War: the 390E (unchanged)
//   F  My Collection: an owned 13100 with no gauge of its own is Standard, an
//      owned blank-gauge 18000 is O (rrChipRowPasses, the owned rule)
//   G  phone (390x844): the same answer as the computer
//   P  PLANTED offenders — each check above must go red on a copy without the fix
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  stdmodern_browser_tests needs playwright and it is not installed.'); process.exit(1); }
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

const CATALOG = [
  { itemNum: '18000', itemType: 'Steam Locomotive', _era: 'mpc', _tab: 'Lionel MPC-Modern', description: 'B6 0-6-0 switcher', roadName: 'Pennsylvania', yearProd: '1989', gauge: '' },
  { itemNum: '18001', itemType: 'Boxcar', _era: 'mpc', _tab: 'Lionel MPC-Modern', description: 'Boxcar', roadName: 'Rock Island', yearProd: '1990', gauge: '' },
  { itemNum: '18002', itemType: 'Boxcar', _era: 'mpc', _tab: 'Lionel MPC-Modern', description: 'Boxcar', roadName: 'Erie', yearProd: '1991', gauge: 'Standard O' },
  { itemNum: '18003', itemType: 'Accessory', _era: 'mpc', _tab: 'Lionel MPC-Modern', description: 'Water tower', roadName: '', yearProd: '1992', gauge: 'G' },   // 2 live rows say G: not a scale the line carries
  { itemNum: '13100', itemType: 'Steam Locomotive', _era: 'mpc', _tab: 'Lionel MPC-Modern', description: '390E 2-4-2 Locomotive', roadName: 'Lionel Lines', yearProd: '1988', gauge: 'Standard' },
  { itemNum: '11-1005', itemType: 'Steam Locomotive', _era: 'mth_tinplate', _tab: 'MTH Tinplate', description: 'No. 390 Locomotive green', roadName: '', yearProd: '2004', gauge: 'Standard', alsoSoldAs: 'Lionel Corporation' },
  { itemNum: '11-2815', itemType: 'Tank Car', _era: 'mth_tinplate', _tab: 'MTH Tinplate', description: 'No. 2815 O Gauge Oil Car', roadName: '', yearProd: '2004', gauge: 'O', alsoSoldAs: 'Lionel Corporation' },
  { itemNum: '10-1020', itemType: 'Track', _era: 'mth_tinplate', _tab: 'MTH Tinplate', description: 'RealTrax Wire Harness', roadName: '', yearProd: '2010', gauge: 'Standard' },
  { itemNum: '11-1005', itemType: 'Boxcar', _era: 'mth_o', _tab: 'MTH O', description: 'Boxcar', roadName: 'Lackawanna', yearProd: '2006', gauge: 'O' },
  // Brad 17:38 CT: one of the 19 Standard gauge trains that stay on MTH O, Gauge "Standard", sold as Lionel
  { itemNum: '11-7001', itemType: 'Steam Locomotive', _era: 'mth_o', _tab: 'MTH O', description: 'No. 400E Locomotive', roadName: '', yearProd: '2005', gauge: 'Standard', alsoSoldAs: 'Lionel Corporation' },
  { itemNum: '20-2001', itemType: 'Diesel Locomotive', _era: 'mth_o', _tab: 'MTH O', description: 'GP-7', roadName: 'Santa Fe', yearProd: '2005', gauge: 'O' },
  { itemNum: '390E', itemType: 'Steam Locomotive', _era: 'prewar', _tab: 'Lionel Pre-War', description: '390E 2-4-2', roadName: '', yearProd: '1929', gauge: 'Standard' },
];

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
  await pg.evaluate((cat) => {
    localStorage.clear();
    state.masterData = cat.map(r => Object.assign({ variation: '' }, r));
    _rebuildMasterIndex();
    state.personalData = {};
    state.scienceData = {}; state.constructionData = {};
    state.wantData = {}; state.upgradeData = {}; state.forSaleData = {}; state.soldData = {};
    _currentEra = 'all';
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
  }, CATALOG);
  return { pg, errs };
}

// What the list shows under these chips: "tab|number" for each row/card, and
// which of them carry the "as Lionel" chip. owned: My Collection instead.
const LIST = `((ch, owned) => {
  localStorage.setItem('lv_browse_filter_state', JSON.stringify(ch));
  showPage('browse'); state.filters.owned = !!owned; state.filters.search = ''; renderBrowse();
  const els = [...document.querySelectorAll('#browse-tbody tr, #browse-cards .browse-card')];
  const out = [], chip = [];
  els.forEach(el => {
    const html = el.outerHTML;
    const m = /(?:browseRowClick\\(event,\\s*|rrCatalogCardTap\\(|showItemDetailPage\\()(-?\\d+)/.exec(html);
    if (!m) return;
    const r = state.masterData[+m[1]];
    if (!r) return;
    const k = r._tab + '|' + r.itemNum;
    if (out.indexOf(k) < 0) out.push(k);
    if (/also-sold-as/.test(html) && chip.indexOf(k) < 0) chip.push(k);
  });
  return { rows: out.sort(), chip: chip.sort() };
})`;
const CH = (manufacturer, scale, era) => ({ manufacturer, scale, era });

async function scenario(browser, viewport, planted) {
  const { pg, errs } = await open(browser, viewport, planted);
  const L = async (ch, owned) => pg.evaluate(LIST + '(' + JSON.stringify(ch) + ', ' + (owned ? 'true' : 'false') + ')');
  const R = {};
  R.lStdMod = await L(CH('lionel', 'standard', 'modern'));
  R.lOMod = await L(CH('lionel', 'o', 'modern'));
  R.mStdMod = await L(CH('mth', 'standard', 'modern'));
  R.mOMod = await L(CH('mth', 'o', 'modern'));
  R.lAnyMod = await L(CH('lionel', 'any', 'modern'));
  // the Master Catalog lists nothing until something is picked, so "every row" is Lionel + MTH, any scale, any era
  { const a = await L(CH('lionel', 'any', 'any')), b = await L(CH('mth', 'any', 'any'));
    R.anyAny = { rows: a.rows.concat(b.rows.filter(k => a.rows.indexOf(k) < 0)).sort() }; }
  R.lStdPre = await L(CH('lionel', 'standard', 'prewar'));
  // My Collection: owned copies carry no gauge of their own (the common case)
  await pg.evaluate(() => {
    state.personalData = {
      '501': { itemNum: '13100', variation: '', owned: true, inventoryId: '501', era: 'mpc', manufacturer: 'Lionel', row: 5 },
      '502': { itemNum: '18000', variation: '', owned: true, inventoryId: '502', era: 'mpc', manufacturer: 'Lionel', row: 6 },
    };
  });
  R.ownStd = await L(CH('lionel', 'standard', 'any'), true);
  R.ownO = await L(CH('lionel', 'o', 'any'), true);
  R.errs = errs;
  await pg.close();
  return R;
}

const K = {
  lion: n => 'Lionel MPC-Modern|' + n, tin: n => 'MTH Tinplate|' + n, mo: n => 'MTH O|' + n, pre: n => 'Lionel Pre-War|' + n,
};

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  try {
    const R = await scenario(browser, DESK);
    T('A  Lionel + Standard + Modern: 13100 and the Standard 11- rows sold as Lionel (MTH Tinplate and MTH O)', R.lStdMod.rows, [K.lion('13100'), K.mo('11-7001'), K.tin('11-1005')]);
    T('A  …the 11- rows wear the "as Lionel" chip', R.lStdMod.chip, [K.mo('11-7001'), K.tin('11-1005')]);
    T('B  Lionel + O + Modern: the blank-gauge rows, "Standard O", the G-marked row, and the O-gauge 11- row — not 13100',
      R.lOMod.rows, [K.lion('18000'), K.lion('18001'), K.lion('18002'), K.lion('18003'), K.tin('11-2815')]);
    T('B  …the O-gauge 11- row wears the "as Lionel" chip', R.lOMod.chip, [K.tin('11-2815')]);
    T('C  MTH + Standard + Modern: the Standard MTH Tinplate rows (not the O one) and MTH O\'s Standard gauge row', R.mStdMod.rows, [K.mo('11-7001'), K.tin('10-1020'), K.tin('11-1005')]);
    T('C  MTH + O + Modern: the O-gauge Tinplate row and MTH O', R.mOMod.rows, [K.mo('11-1005'), K.mo('20-2001'), K.tin('11-2815')]);
    T('E  Lionel + Standard + Pre-War: the 390E, unchanged', R.lStdPre.rows, [K.pre('390E')]);
    T('F  My Collection, Lionel + Standard: the owned 13100 (no gauge of its own)', R.ownStd.rows, [K.lion('13100')]);
    T('F  My Collection, Lionel + O: the owned 18000, not the 13100', R.ownO.rows, [K.lion('18000')]);
    T('no page errors (computer)', R.errs, []);

    // D — Any scale: exactly the rows the app listed before the fix
    const APPJS = rd('app.js');
    const before = APPJS.replace('    return _own ? [_own] : [eraScale];', '    return [eraScale];')
      .replace("  if (eraScale) return ((typeof _rrLineRowScale === 'function') ? _rrLineRowScale(era, eraScale, _scalesOfGauge(item.gauge, era)) : '') || eraScale;", '  if (eraScale) return eraScale;');
    T('P1 plant applied (app.js as it was before the fix)', before !== APPJS && before.indexOf('return _own ? [_own]') < 0, true);
    const P1 = await scenario(browser, DESK, { 'app.js': before });
    T('D  Lionel + Any scale + Modern: the same rows as before the fix', R.lAnyMod.rows, P1.lAnyMod.rows);
    T('D  Lionel / MTH + Any scale + Any era: the same rows as before the fix', R.anyAny.rows, P1.anyAny.rows);
    T('D  …every stand-in row is there', R.anyAny.rows.length, CATALOG.length);
    // P1 — the old rule: each A/B/C/F check goes red
    T('P1 caught (A): Lionel + Standard + Modern loses 13100', P1.lStdMod.rows.indexOf(K.lion('13100')) < 0, true);
    T('P1 caught (B): Lionel + O + Modern lists 13100', P1.lOMod.rows.indexOf(K.lion('13100')) >= 0, true);
    T('P1 caught (B): Lionel + O + Modern loses the O-gauge 11- row', P1.lOMod.rows.indexOf(K.tin('11-2815')) < 0, true);
    T('P1 caught (C): MTH + Standard lists the O-gauge Tinplate row', P1.mStdMod.rows.indexOf(K.tin('11-2815')) >= 0, true);
    T('P1 caught (F): My Collection Lionel + Standard loses the owned 13100', P1.ownStd.rows, []);
    // P2 — the config list emptied: Lionel's own Standard trains vanish again
    const CFG = rd('config.js');
    const noList = CFG.replace("const RR_LINE_ROW_SCALES = { mpc: ['Standard'], mth_o: ['Standard'] };", 'const RR_LINE_ROW_SCALES = {};');
    T('P2 plant applied (config list emptied)', noList !== CFG, true);
    const P2 = await scenario(browser, DESK, { 'config.js': noList });
    T('P2 caught: Lionel + Standard + Modern loses 13100 and MTH O\'s Standard row', P2.lStdMod.rows, [K.tin('11-1005')]);
    T('P2 caught: MTH + Standard loses MTH O\'s Standard row; MTH + O lists it', [P2.mStdMod.rows.indexOf(K.mo('11-7001')) < 0, P2.mOMod.rows.indexOf(K.mo('11-7001')) >= 0], [true, true]);
    const noMthO = CFG.replace("const RR_LINE_ROW_SCALES = { mpc: ['Standard'], mth_o: ['Standard'] };", "const RR_LINE_ROW_SCALES = { mpc: ['Standard'] };");
    T('P5 plant applied (MTH O left off the list)', noMthO !== CFG, true);
    const P5 = await scenario(browser, DESK, { 'config.js': noMthO });
    T('P5 caught: MTH + O lists the Standard gauge 11-7001; Lionel + Standard loses it', [P5.mOMod.rows.indexOf(K.mo('11-7001')) >= 0, P5.lStdMod.rows.indexOf(K.mo('11-7001')) < 0], [true, true]);
    // P3 — a rule that drops the line's scale for a blank Gauge (the 20,000+ rows)
    const blankLoses = APPJS.replace('    return _own ? [_own] : [eraScale];', '    return _own ? [_own] : gs;');
    T('P3 plant applied (blank Gauge no longer the line\'s scale)', blankLoses !== APPJS, true);
    const P3 = await scenario(browser, DESK, { 'app.js': blankLoses });
    T('P3 caught (B): Lionel + O + Modern loses the blank-gauge 18000 / 18001', [P3.lOMod.rows.indexOf(K.lion('18000')) < 0, P3.lOMod.rows.indexOf(K.lion('18001')) < 0], [true, true]);
    // P4 — a rule that lets ANY own Gauge win (no line list): the G-marked Lionel row leaves O
    const anyWins = APPJS.replace("  return rrLineRowScales(era).indexOf(gs[0]) >= 0 ? gs[0] : '';", '  return gs[0];');
    T('P4 plant applied (any own Gauge wins)', anyWins !== APPJS, true);
    const P4 = await scenario(browser, DESK, { 'app.js': anyWins });
    T('P4 caught (B): Lionel + O + Modern loses the G-marked 18003', P4.lOMod.rows.indexOf(K.lion('18003')) < 0, true);

    // G — phone
    const G = await scenario(browser, PHONE);
    T('G  phone, Lionel + Standard + Modern: the same three', G.lStdMod.rows, [K.lion('13100'), K.mo('11-7001'), K.tin('11-1005')]);
    T('G  phone, Lionel + O + Modern: the same five', G.lOMod.rows, [K.lion('18000'), K.lion('18001'), K.lion('18002'), K.lion('18003'), K.tin('11-2815')]);
    T('no page errors (phone)', G.errs, []);
    const PG = await scenario(browser, PHONE, { 'app.js': before });
    T('PG caught: phone Lionel + Standard + Modern loses 13100 on the old rule', PG.lStdMod.rows.indexOf(K.lion('13100')) < 0, true);
  } catch (e) {
    console.log('FAIL  crashed: ' + (e && e.stack || e)); fail++;
  } finally {
    await browser.close();
  }
  console.log((fail ? 'FAILED' : 'ALL PASS') + '  —  stdmodern_browser_tests: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
