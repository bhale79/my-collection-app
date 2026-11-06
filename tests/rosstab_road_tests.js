#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════
// ROSS CUSTOM SWITCHES + GARGRAVES — the road   (real Chromium, the REAL app)
// rosstab, 2026-11-05. [stated] Brad 17:59 CT "yes" to PLAN_2026-11-05_ROSS_TAB,
// then "Yes, one row per maker" to the Add list question, then "Yes, add
// GarGraves too" (its tab, 521 rows, written by the catalog chat that evening).
// The master's "Ross Custom Switches" tab (215 rows) was never loaded: no list
// named it. This drives the app's REAL start (loadAllErasMode) against a
// stand-in Sheets that serves the tab exactly as the live master holds it
// (tests/fixtures/rosstab_tabs_2026-11-05.json) plus Lionel's 902 and 120.
//
//   S  the start asks Google for "Ross Custom Switches" and loads all 215 rows
//      as the Ross catalog
//   M  Master Catalog search: RB2024 is there, under Ross Custom Switches
//   A  Add: 902 with no maker shows Lionel's AND Ross's (one row per maker);
//      with maker Ross only Ross's; 0100 is Ross's 0100
//   V  Add → RB2024 with maker Ross → saved as maker "Ross Custom Switches",
//      catalog Ross, key ross|RB2024|
//   C  What I Collect: Ross is a line, O gauge; a member who saved their lines
//      BEFORE Ross existed has it on (a new catalog is never hidden)
//   P  the iPhone: the same search finds it; nothing scrolls sideways
//   X  PLANTED: a served config.js without 'ross' in REAL_ERA_IDS → the tab is
//      never asked for and RB2024 is nowhere (the bug as it was)
// Run:  node tests/rosstab_road_tests.js
// ═════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  rosstab_road_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const FX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'rosstab_tabs_2026-11-05.json'), 'utf8'));
let pass = 0, fail = 0;
function ok(n, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(extra === undefined ? '' : extra).slice(0, 500))); cond ? pass++ : fail++; }
function plant(src, from, to, label) {
  if (src.indexOf(from) < 0) throw new Error('planted offender "' + label + '" no longer matches the source — update the test');
  return src.replace(from, to);
}
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' };
const LAPTOP = { viewport: { width: 1366, height: 768 } };

async function start(browser, opts, served, preLines) {
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
  const S = await pg.evaluate(async ([FX, preLines]) => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    window.showToast = function () {};
    if (preLines) {   // a member who saved What I Collect before Ross existed
      _prefSet('lv_collect_lines', JSON.stringify(preLines.lines));
      _prefSet('lv_collect_lines_roster', JSON.stringify(preLines.roster));
    }
    state.masterSheetId = 'MASTER'; state.personalSheetId = 'SID'; window.accessToken = 'tok'; accessToken = 'tok';
    window.loadPersonalData = async function () { state.personalData = {}; state.soldData = {}; state.wantData = {}; state.forSaleData = {}; };
    const TABS = {}; TABS[FX.ross.tab] = FX.ross.values; TABS[FX.gargraves.tab] = FX.gargraves.values; TABS[FX.pw.tab] = FX.pw.values;
    const asked = [];
    window.fetch = async function (url) {
      const u = String(url);
      const okr = b => ({ ok: true, status: 200, json: async () => b, text: async () => JSON.stringify(b) });
      if (/values:batchGet/.test(u)) {
        const ranges = [...u.matchAll(/ranges=([^&]+)/g)].map(m => decodeURIComponent(m[1]));
        const tabs = ranges.map(r => r.split('!')[0].replace(/^'|'$/g, ''));
        tabs.forEach(t => asked.push(t));
        return okr({ valueRanges: ranges.map((r, i) => ({ range: r, values: TABS[tabs[i]] || [] })) });
      }
      const m = /\/values\/([^?]+)\?/.exec(u);
      if (m) {
        const r = decodeURIComponent(m[1]); const t = r.split('!')[0].replace(/^'|'$/g, ''); asked.push(t);
        if (/^'?Master Version'?!/.test(r)) return okr({ values: [['2.80', '2026-11-05', 'x']] });
        return okr({ values: TABS[t] || [] });
      }
      return okr({});
    };
    await loadAllErasMode();
    let w = 0;
    while (w < 20000) { await sleep(250); w += 250; if (window._skipBackgroundRefresh === false && !(state.loading && state.loading.allEras && state.loading.allEras.refreshing) && w > 1500) break; }
    const by = {}; state.masterData.forEach(r => { by[r._era] = (by[r._era] || 0) + 1; });
    const au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
    state.user = { name: 'Brad', email: 'brad@example.com' };
    return { askedRoss: asked.indexOf(FX.ross.tab) >= 0, askedGG: asked.indexOf(FX.gargraves.tab) >= 0, by, rossTabs: [...new Set(state.masterData.filter(r => r._era === 'ross').map(r => r._tab))] };
  }, [FX, preLines || null]);
  return { ctx, pg, errs, S };
}
async function search(pg, q) {
  return pg.evaluate(async (q) => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    showPage('browse'); await sleep(500);
    const inp = document.getElementById('browse-search'); inp.value = q; onPageSearch(q, 'browse'); await sleep(1200);
    const el = document.getElementById('page-browse');
    return { txt: el ? el.innerText : '', side: document.documentElement.scrollWidth <= window.innerWidth + 1 };
  }, q);
}

// The Add list under the review's three findings: typed maker words, the
// Scale filter on a mixed catalog, and the one-row-per-maker key — on the
// REAL functions in the page.
async function addChecks(pg) {
  return pg.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const R = {};
    await openWizard('collection'); await sleep(300);
    const typ = async (v) => { const w = document.getElementById('wiz-input'); w.value = v; w.dispatchEvent(new Event('input', { bubbles: true })); await sleep(900);
      const t = (document.getElementById('wizard-body').innerText || '').replace(/\s+/g, ' '); const i = t.search(/match/); return i < 0 ? '' : t.slice(Math.max(0, i - 20)); };
    R.a902 = await typ('902');
    R.t902ross = await typ('902 ross');
    R.t101gg = await typ('101 gargraves');
    // a Lionel car with Ross in its name, for the word-search check (the review's Betsy Ross case)
    if (!state.masterData.some(r => r.rowId === 'TESTBETSY1')) { state.masterData.push({ itemNum: '19999', itemType: 'Boxcar', description: 'Betsy Ross Bicentennial boxcar', roadName: '', _era: 'mpc', _tab: 'Lionel MPC-Modern', rowId: 'TESTBETSY1', gauge: 'O' }); _rebuildMasterIndex(); }
    R.betsy = await typ('betsy ross');
    R.betsyNum = await typ('19999 betsy ross'); R.betsyNumMfr = wizard.data._typedSearchMfr || '';
    R.rossPhrase = await typ('ross custom switches 902');
    R.rossWords = await typ('ross switches mating pins');
    wizard.data._searchFilterScale = 'O'; R.sO101 = await typ('101');
    wizard.data._searchFilterScale = 'HO'; R.sHO101 = await typ('101');
    wizard.data._searchFilterScale = 'S'; R.sS42 = await typ('42-401SW');
    wizard.data._searchFilterScale = '';
    const row = (era, extra) => Object.assign({ itemNum: 'x', _era: era }, extra || {});
    R.mk = { pw: _sgMakerOfRow(row('pw')), mpc: _sgMakerOfRow(row('mpc')), ross: _sgMakerOfRow(row('ross', { manufacturer: 'Ross Custom Switches' })),
             gg: _sgMakerOfRow(row('gargraves', { manufacturer: 'GarGraves' })), tag: rrRowMakerWord(row('ross', { manufacturer: 'Ross Custom Switches' })) };
    if (typeof _doCloseWizard === 'function') { try { _doCloseWizard(); } catch (e) {} }
    return R;
  });
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  try {
    // ── laptop: the whole road ──
    const L = await start(browser, LAPTOP);
    ok('S1  the start asks Google for the tab "Ross Custom Switches"', L.S.askedRoss);
    ok('S2  all 215 rows load as the Ross catalog, from that tab', L.S.by.ross === 215 && L.S.rossTabs.length === 1 && L.S.rossTabs[0] === 'Ross Custom Switches', JSON.stringify(L.S));
    ok('S4  GarGraves too: the start asks for the tab "GarGraves" and loads all 521 rows', L.S.askedGG && L.S.by.gargraves === 521, JSON.stringify(L.S.by));
    const m = await search(L.pg, 'RB2024');
    ok('M1  Master Catalog search: RB2024 is there, the track-cleaning car, under Ross Custom Switches',
       /1 items?/.test(m.txt) && /ROSS CUSTOM SWITCHES/i.test(m.txt) && /ROSS VOLTMETER\/TRACK CLEANING CAR/.test(m.txt), m.txt.slice(0, 600));
    const g = await search(L.pg, '42-401SW');
    ok('M2  Master Catalog search: GarGraves 42-401SW (S gauge curve) is there, under GarGraves', /1 items?/.test(g.txt) && /GARGRAVES/i.test(g.txt) && /S Gauge sectional curve/.test(g.txt), g.txt.slice(0, 500));
    const A = await L.pg.evaluate(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const R = {};
      await openWizard('collection'); await sleep(300);
      const typ = async (v) => { const w = document.getElementById('wiz-input'); w.value = v; w.dispatchEvent(new Event('input', { bubbles: true })); await sleep(900);
        return (document.getElementById('wizard-body').innerText || '').replace(/\s+/g, ' '); };
      R.makerChoice = /Ross Custom Switches/.test(document.getElementById('wizard-body').innerText);
      R.a902 = await typ('902');
      R.a101 = await typ('101');
      wizard.data._searchFilterManufacturer = 'Ross Custom Switches';
      R.r902 = await typ('902');
      R.r0100 = await typ('0100');
      R.rRB = await typ('RB2024');
      // save it: pick the suggestion, walk the steps with a value each, save
      const appended = [];
      window.sheetsAppend = async (id, range, rows) => { appended.push([range, rows[0]]); return 200 + appended.length; };
      window.sheetsUpdate = async () => ({}); window.rrVerifiedRowUpdate = async () => true; window.rrRowStillIs = async () => true;
      window.rrWhereIsRow = async (a, b, row) => ({ ok: true, row });
      window.driveEnsureSetup = async () => {}; window.driveUploadPhoto = async () => ({}); window.buildDashboard = () => {}; window.rrMaybeShowAddHelp = () => {};
      const toasts = []; window.showToast = m => toasts.push(String(m));
      const pick = Array.from(document.querySelectorAll('#wizard-body .wiz-sug-l1')).find(e => /RB2024/.test(e.textContent));
      if (pick) pick.click(); await sleep(400);
      for (let k = 0; k < 30; k++) {
        const c = wizard.steps[wizard.step] || {};
        if (c.id === 'confirm') break;
        if (c.id === 'conditionDetails') Object.assign(wizard.data, { condition: 7, allOriginal: 'Yes', hasBox: 'No' });
        if (c.id === 'purchaseValue') { wizard.data.userEstWorth = '350'; const w = document.getElementById('wiz-worth') || document.querySelector('#wizard-body input[id*="worth" i]'); if (w) { w.value = '350'; w.dispatchEvent(new Event('input', { bubbles: true })); } }
        await wizardNext(); await sleep(150);
      }
      try { await saveWizardItem(); } catch (e) { R.err = e.message; }
      await sleep(500);
      const F = PERSONAL_FIELD_INDEX;
      const row = ((appended.find(a => /My Collection/.test(a[0])) || [])[1]) || [];
      R.saved = { num: String(row[F.itemNum] || '').replace(/^'/, ''), mfr: row[F.manufacturer], era: row[F.era], key: row[F.masterKey], desc: row[F.masterDescription] };
      R.toast = toasts.filter(t => /added/i.test(t)).pop() || '';
      return R;
    });
    ok('A1  the Add screen offers Ross Custom Switches as a maker', A.makerChoice);
    ok('A2  902 with no maker picked: Lionel\'s Elevated Trestle AND Ross\'s Mating Pins (one row per maker)',
       /2 matches/.test(A.a902) && /LIONEL/.test(A.a902) && /ROSS CUSTOM SWITCHES/.test(A.a902), A.a902.slice(0, 400));
    ok('A2b 101 with no maker: Ross\'s 11-degree switch AND GarGraves\'s flexible track both listed (two makers, two rows; longer numbers like 101-S-12 follow)', /\b101 ROSS CUSTOM SWITCHES ·/.test(A.a101) && /\b101 GARGRAVES ·/.test(A.a101), A.a101.slice(Math.max(0, A.a101.search(/match/) - 20), A.a101.search(/match/) + 500));
    ok('A3  902 with maker Ross: only Ross\'s', /1 match\b/.test(A.r902) && /ROSS CUSTOM SWITCHES/.test(A.r902) && !/Elevated Trestle/.test(A.r902), A.r902.slice(0, 300));
    ok('A4  0100 is Ross\'s 0100 (50" radius), not its 100 twin', /1 match\b/.test(A.r0100) && /0100 50" Radius/.test(A.r0100), A.r0100.slice(0, 300));
    ok('A5  RB2024 with maker Ross: the track-cleaning car', /RB2024/.test(A.rRB) && /TRACK CLEANING CAR/.test(A.rRB), A.rRB.slice(0, 300));
    const B = await addChecks(L.pg);
    ok('A6  the one-row-per-maker key IS the maker tag\'s rule: Lionel postwar = Lionel modern; Lionel, Ross, GarGraves all different', B.mk.pw === B.mk.mpc && B.mk.pw === 'lionel' && B.mk.ross !== B.mk.pw && B.mk.gg !== B.mk.ross && B.mk.ross === B.mk.tag.toLowerCase().replace(/[^a-z0-9]/g, ''), JSON.stringify(B.mk));
    ok('A7  typing "902 ross" filters to Ross\'s 902 ("ross" is a maker word, not a description word)', /^\S* ?1 match\b/.test(B.t902ross.replace(/^.*?(\d+ match)/, '$1')) && /902 ROSS CUSTOM SWITCHES/.test(B.t902ross) && !/Elevated Trestle/.test(B.t902ross), B.t902ross.slice(0, 300));
    ok('A7b typing "betsy ross" still finds the Lionel Betsy Ross boxcar ("ross" alone in a word search is a word, not the maker)', /19999/.test(B.betsy) && /Betsy Ross/i.test(B.betsy), B.betsy.slice(0, 300));
    ok('A7d "19999 betsy ross" (number + description words) still finds the Lionel boxcar, and nothing records Ross as the typed maker', /19999/.test(B.betsyNum) && /Betsy Ross/i.test(B.betsyNum) && !/ross/i.test(B.betsyNumMfr), B.betsyNumMfr + ' | ' + B.betsyNum.slice(0, 250));
    ok('A7e "ross custom switches 902" (the maker\'s full name + number) lists Ross\'s 902 only', /902 ROSS CUSTOM SWITCHES/.test(B.rossPhrase) && !/Elevated Trestle/.test(B.rossPhrase), B.rossPhrase.slice(0, 300));
    ok('A7c "ross switches mating pins" (the maker\'s own words) lists Ross\'s 902 mating pins', /902 ROSS CUSTOM SWITCHES/.test(B.rossWords), B.rossWords.slice(0, 300));
    ok('A8  typing "101 gargraves" lists GarGraves\'s 101 and not Ross\'s', /\b101 GARGRAVES ·/.test(B.t101gg) && !/ROSS CUSTOM SWITCHES/.test(B.t101gg), B.t101gg.slice(0, 300));
    ok('A9  Scale O: GarGraves\'s O-gauge 101 is listed (its row says O Gauge), with Ross\'s', /\b101 GARGRAVES ·/.test(B.sO101) && /\b101 ROSS CUSTOM SWITCHES ·/.test(B.sO101), B.sO101.slice(0, 300));
    ok('A10 Scale HO: GarGraves\'s O-gauge 101 is NOT listed (the row\'s own gauge decides)', !/\b101 GARGRAVES ·/.test(B.sHO101), B.sHO101.slice(0, 300));
    ok('A11 Scale S: GarGraves\'s S-gauge curve 42-401SW is listed', /42-401SW GARGRAVES/.test(B.sS42), B.sS42.slice(0, 300));
    ok('V1  saved: RB2024, maker "Ross Custom Switches", catalog Ross, key ross|RB2024|',
       A.saved.num === 'RB2024' && A.saved.mfr === 'Ross Custom Switches' && A.saved.era === 'ross' && A.saved.key === 'ross|RB2024|' && /TRACK CLEANING/.test(A.saved.desc || ''),
       JSON.stringify(A.saved) + ' ' + (A.err || ''));
    ok('V2  the collector is told it was added', /RB2024 added/.test(A.toast), A.toast);
    ok('S3  no page errors on the laptop', L.errs.length === 0, L.errs.join(' | '));
    await L.ctx.close();

    // ── What I Collect: a member who saved lines before Ross existed ──
    const ids0 = await (async () => {
      const t = await start(browser, LAPTOP);
      const ids = await t.pg.evaluate(() => rrCollectLineIds().filter(k => k !== 'ross' && k !== 'gargraves'));
      await t.ctx.close(); return ids;
    })();
    const C = await start(browser, LAPTOP, null, { lines: ['pw', 'mth_o'], roster: ids0 });
    const c = await C.pg.evaluate(() => ({ line: rrCollectLineIds().indexOf('ross') >= 0, scales: rrLineScales('ross'), ggLine: rrCollectLineIds().indexOf('gargraves') >= 0, ggScales: rrLineScales('gargraves'), mine: rrCollectedLines(),
      summary: (typeof _prefCollectSummaryHtml === 'function') ? _prefCollectSummaryHtml() : '' }));
    const cScales = async (pg) => pg.evaluate(() => { const R = {};
      rrSetCollectedLines(rrCollectLineIds().filter(k => rrLineScales(k).indexOf('ho') >= 0)); R.hoLines = rrCollectedLines(); R.hoScales = _getEnabledScales();
      rrSetCollectedLines(['gargraves']); R.ggScales = _getEnabledScales();
      rrSetCollectedLines(['gargraves', 'ross']); R.ggRoss = _getEnabledScales(); return R; });
    const cs = await cScales(C.pg);

    ok('C1  Ross is a line in What I Collect, O gauge', c.line && c.scales.length === 1 && c.scales[0] === 'o', JSON.stringify(c.scales));
    ok('C1b GarGraves is a line too, under O, S, G, HO, N and Standard', c.ggLine && ['o', 's', 'g', 'ho', 'n', 'standard'].every(x => c.ggScales.indexOf(x) >= 0), JSON.stringify(c.ggScales));
    ok('C2  a member who saved "Postwar + MTH O" before Ross and GarGraves existed: their two lines kept, both new ones ON beside them (a new catalog is never hidden)',
       c.mine.indexOf('pw') >= 0 && c.mine.indexOf('mth_o') >= 0 && c.mine.indexOf('ross') >= 0 && c.mine.indexOf('gargraves') >= 0 && c.mine.length === 4, JSON.stringify(c.mine));
    ok('C3  …so their start loads both, and Preferences names them', C.S.by.ross === 215 && C.S.by.gargraves === 521 && /Ross Custom Switches/.test(c.summary) && /GarGraves/.test(c.summary), JSON.stringify(C.S.by) + ' ' + c.summary.slice(0, 200));
    ok('C4  an HO-only collector (every HO line, GarGraves among them): the Scale picker offers HO alone ([stated] Brad "don\'t add scales")', cs.hoLines.indexOf('gargraves') >= 0 && JSON.stringify(cs.hoScales) === '["ho"]', JSON.stringify(cs.hoScales));
    ok('C5  a collector of GarGraves alone is offered its six scales (never an empty picker); GarGraves + Ross offers O (Ross\'s)', ['o', 's', 'g', 'ho', 'n', 'standard'].every(x => cs.ggScales.indexOf(x) >= 0) && JSON.stringify(cs.ggRoss) === '["o"]', JSON.stringify(cs));
    await C.ctx.close();
    {
      const aj = fs.readFileSync(path.join(APP, 'app.js'), 'utf8');
      const W = await start(browser, LAPTOP, { 'app.js': plant(aj, 'var into = blank ? mixed : out;', 'var into = out;', 'scale picker') });
      const ws = await cScales(W.pg);
      ok('X7  PLANTED (mixed catalogs widen the picker again): the HO-only collector is offered six scales — proof C4 can fail', JSON.stringify(ws.hoScales) !== '["ho"]', JSON.stringify(ws.hoScales));
      await W.ctx.close();
    }

    // ── the iPhone ──
    const Ph = await start(browser, PHONE);
    const p = await search(Ph.pg, 'RB2024');
    ok('P1  iPhone: the Master Catalog search finds RB2024, badged Ross (the phone card shows number, maker, type)', /1 items?/.test(p.txt) && /RB2024\s+ROSS\s+Motorized/.test(p.txt), p.txt.slice(0, 300));
    ok('P2  iPhone: nothing scrolls sideways', p.side);
    ok('P3  no page errors on the iPhone', Ph.errs.length === 0, Ph.errs.join(' | '));
    await Ph.ctx.close();

    // ── PLANTED: the bug as it was ──
    const cfg = fs.readFileSync(path.join(APP, 'config.js'), 'utf8');
    const X = await start(browser, LAPTOP, { 'config.js': plant(cfg, "'bachmann_all', 'ross', 'gargraves'];", "'bachmann_all'];", 'REAL_ERA_IDS') });
    const x = await search(X.pg, 'RB2024');
    ok('X1  PLANTED (Ross and GarGraves left out of REAL_ERA_IDS): neither tab is asked for, no row of either loads, and RB2024 is nowhere',
       !X.S.askedRoss && !X.S.askedGG && !X.S.by.ross && !X.S.by.gargraves && !/TRACK CLEANING CAR/.test(x.txt), JSON.stringify(X.S));
    await X.ctx.close();
    // PLANTED: the review's fixes taken out of served copies
    const sug = fs.readFileSync(path.join(APP, 'wizard-suggestions.js'), 'utf8'), wz = fs.readFileSync(path.join(APP, 'wizard.js'), 'utf8');
    const isf = fs.readFileSync(path.join(APP, 'item-search-filters-config.js'), 'utf8');
    const Y = await start(browser, LAPTOP, {
      'item-search-filters-config.js': plant(isf, "    'gargraves',   //", '    //', 'stop words'),
      'wizard-suggestions.js': plant(plant(plant(sug, "      _dedupeKey += '|' + _sgMakerOfRow(m);\n", '', 'dedupe'), "if (_rossAsMaker && !_typedMfr) _typedMfr = 'Ross Custom Switches';", '', 'typed ross'), "const _rossAsMaker = (_rossBesideNum || _rossPhrase) &&", 'const _rossAsMaker = false &&', 'ross as maker'),
      'wizard.js': plant(wz, "_scalesOfGauge(m.gauge).indexOf(String(f.scale).toLowerCase()) < 0) return false;", "true) return false;", 'scale') });
    const y = await addChecks(Y.pg);
    ok('X2  PLANTED (no maker in the duplicate key): 902 shows ONE row again — Ross\'s hidden behind Lionel\'s', /^1 match\b/.test(y.a902.replace(/^.*?(\d+ match)/, '$1')) && !/ROSS CUSTOM SWITCHES/.test(y.a902), y.a902.slice(0, 200));
    ok('X3  PLANTED (no Ross maker rule): "902 ross" no longer finds Ross\'s 902', !/902 ROSS CUSTOM SWITCHES/.test(y.t902ross), y.t902ross.slice(0, 200));
    ok('X4  PLANTED (no row-gauge rule): under Scale O GarGraves\'s 101 vanishes again', !/\b101 GARGRAVES ·/.test(y.sO101), y.sO101.slice(0, 200));
    await Y.ctx.close();
    // PLANTED: the first version of the fix ("ross" as a plain maker word) — Betsy Ross vanishes
    const Z = await start(browser, LAPTOP, {
      'wizard-suggestions.js': plant(sug, "'k-line':'K-Line', gargraves:'GarGraves' };", "'k-line':'K-Line', gargraves:'GarGraves', ross:'Ross Custom Switches' };", 'ross word'),
      'item-search-filters-config.js': plant(isf, "    'gargraves',   //", "    'ross', 'gargraves',   //", 'ross stop word') });
    const z = await addChecks(Z.pg);
    ok('X5  PLANTED ("ross" as a plain maker word, the review\'s finding): "betsy ross" loses the Betsy Ross boxcar — proof A7b can fail', !/Betsy Ross/i.test(z.betsy), z.betsy.slice(0, 200));
    await Z.ctx.close();
    const V = await start(browser, LAPTOP, { 'wizard-suggestions.js': plant(sug, "const _rossAsMaker = (_rossBesideNum || _rossPhrase) &&", "const _rossAsMaker = (startsWithDigit || _rossPhrase) &&", 'any number-led') });
    const v = await addChecks(V.pg);
    ok('X6  PLANTED ("ross" a maker in ANY number search, the second review\'s finding): "19999 betsy ross" loses the boxcar and records Ross — proof A7d can fail', !/Betsy Ross/i.test(v.betsyNum) || /ross/i.test(v.betsyNumMfr), v.betsyNumMfr);
    await V.ctx.close();
  } finally { await browser.close(); }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + (e && e.stack || e)); process.exit(1); });
