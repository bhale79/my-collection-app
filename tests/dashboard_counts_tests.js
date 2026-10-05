#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD COUNT TESTS — v0.9.1879   (real Chromium, the REAL app, no stubs)
//
// [stated] Brad: "yes" — plan CATALOG_ROW_ID_PLAN_2026-10-04, Step 1.
//
// THE RULE: every count on the dashboard (Collection by Type, the Total cards,
// Total Sets) and on the Dashboard tab the app writes into the user's sheet
// counts each owned item ONCE, by ITS OWN catalog entry — the row findMaster
// gives for the owned row (its saved link, then its era and maker). An item
// with no catalog entry (a manual one) counts by its own Item Type. Never by
// matching the item NUMBER against every catalog row.
//
// Measured on Brad's collection before the fix: Total Freight Cars 118 (he has
// 67), Total Accessories 51 (18), his 6119/6120 work cabooses counted as
// engines because another maker's 6119 is one. The stand-in catalog below is
// built to trip exactly that: every owned number ALSO belongs to a different
// kind of item in another maker's catalog.
//
// A: the real cards' numbers on the stand-in collection.
// B: the sheet's Dashboard-tab rows are the card's own numbers.
// C: PLANTED — the old number-only code served in place of dashboard.js /
//    sheet-builder.js must FAIL A (so A can tell the difference).
// D: a scan of every app file for the number-set shapes, proven on planted
//    offenders (and silent on a commented-out one).
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  dashboard_counts_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, got, want) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? 'PASS' : 'FAIL') + '  ' + n + (ok ? '' : '  -> got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want))); ok ? pass++ : fail++; }
function OK(n, cond, why) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (why || ''))); cond ? pass++ : fail++; }

// What the stand-in collection holds, and what each item IS (its own entry).
const WANT = {
  breakdown: { Engines: 3, Tenders: 1, Freight: 2, Passenger: 1, Cabooses: 1, Accessories: 2, Other: 2 },
  engines: 3, cabooses: 1, freight: 2, passenger: 1, accessories: 2, sets: 1,
};

// The OLD helpers, word for word as they shipped up to v0.9.1878 — served in
// place of the new decider for the planted run (C).
const OLD_HELPERS = `
function _bucketIs(item, allowed) {
  if (typeof getTypeBucket !== 'function') return false;
  return allowed.indexOf(getTypeBucket(item)) !== -1;
}
function _ownedTypeNumSet(state, buckets) {
  var nums = new Set();
  (state.masterData || []).forEach(function(m) { if (_bucketIs(m, buckets)) nums.add(normalizeItemNum(m.itemNum)); });
  return nums;
}
function _pdMatchSet(pd, nums) {
  if (nums.has(normalizeItemNum(pd.itemNum))) return true;
  if (typeof baseItemNum === 'function') {
    var b = baseItemNum(pd.itemNum);
    if (b && nums.has(normalizeItemNum(b))) return true;
  }
  return false;
}
function _ownedTypeCount(state, buckets) {
  var nums = _ownedTypeNumSet(state, buckets);
  return _ownedNonBox(state).filter(function(pd) { return _pdMatchSet(pd, nums); }).length;
}
function _ownedTypeBreakdown(state, ownedList) {
  var _eS=_ownedTypeNumSet(state,_ENGINE_BUCKETS), _tS=_ownedTypeNumSet(state,_TENDER_BUCKETS), _cS=_ownedTypeNumSet(state,_CABOOSE_BUCKETS), _pS=_ownedTypeNumSet(state,_PASSENGER_BUCKETS), _fS=_ownedTypeNumSet(state,_FREIGHT_BUCKETS), _aS=_ownedTypeNumSet(state,_ACCESSORY_BUCKETS);
  var types = { 'Engines':0, 'Tenders':0, 'Freight':0, 'Passenger':0, 'Cabooses':0, 'Accessories':0, 'Other':0 };
  (ownedList || _ownedNonBox(state)).forEach(function(pd) {
    if (_pdMatchSet(pd, _eS)) types['Engines']++;
    else if (_pdMatchSet(pd, _tS)) types['Tenders']++;
    else if (_pdMatchSet(pd, _cS)) types['Cabooses']++;
    else if (_pdMatchSet(pd, _pS)) types['Passenger']++;
    else if (_pdMatchSet(pd, _fS)) types['Freight']++;
    else if (_pdMatchSet(pd, _aS)) types['Accessories']++;
    else types['Other']++;
  });
  return types;
}
`;

function plantedDashboard() {
  const src = fs.readFileSync(path.join(APP, 'dashboard.js'), 'utf8');
  const a = src.indexOf('var _DASH_GROUPS = ['), b = src.indexOf('function _ownedNonBox(state) {');
  if (a < 0 || b < 0 || b < a) throw new Error('planted dashboard: anchors not found — the decider moved; update this test');
  return src.slice(0, a) + OLD_HELPERS + src.slice(b);
}

async function runCase(browser, planted) {
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    if (planted && u.split('?')[0].endsWith('/app/dashboard.js')) return r.fulfill({ body: planted, contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(800);
  const out = await pg.evaluate(() => {
    const PW = 'Lionel PW - Items', PRE = 'Lionel Pre-War', AT = 'Atlas O', KL = 'K-Line O', MPC = 'Lionel MPC-Modern', WM = 'Williams O';
    const mk = (n, v, t, era, tab, desc) => ({ itemNum: n, variation: v, itemType: t, _era: era, _tab: tab, yearProd: '', description: desc || (t + ' ' + n), roadName: '' });
    // Every owned number is ALSO a different kind of item in another maker's catalog.
    state.masterData = [
      mk('6119', '1', 'Caboose', 'pw', PW, 'Work Caboose'),            mk('6119', '', 'Diesel Locomotive', 'atlas', AT),
      mk('6800', '1', 'Flatcar', 'pw', PW, 'Flatcar with Airplane'),   mk('6800', '', 'Steam Locomotive', 'kline', KL),
      mk('115', '1', 'Accessory', 'pw', PW, 'Passenger Station'),      mk('115', '', 'Electric Locomotive', 'williams', WM),
      mk('6656', '1', 'Stock Car', 'pw', PW, 'Stock Car'),             mk('6656', '', 'Caboose', 'kline', KL),
      mk('2343', '1', 'Diesel Locomotive', 'pw', PW, 'F3 A unit'),     mk('2343', '', 'Accessory', 'atlas', AT),
      mk('2046W', '1', 'Tender', 'pw', PW, 'Whistle Tender'),          mk('2046W', '', 'Caboose', 'kline', KL),
      mk('1050', '1', 'Steam Locomotive', 'pw', PW, 'Scout engine'),   mk('1050', '', 'Set', 'mpc', MPC, 'Set 1050'),
      mk('11450', '', 'Set', 'mpc', MPC, 'Set 11450'),                 mk('11450', '', 'Boxcar', 'atlas', AT),
      mk('600', '', 'Passenger Car', 'prewar', PRE, 'Pullman Car'),    mk('600', '', 'Diesel Locomotive', 'pw', PW, 'NW-2 Switcher'),
      mk('6119-XX', '', 'Caboose', 'pw', PW),                          // only here so a manual '6119…' number could collide
    ];
    _rebuildMasterIndex();
    let inv = 1;
    const pd = (n, v, era, mfr, x) => Object.assign({ owned: true, itemNum: n, variation: v, era: era, manufacturer: mfr, inventoryId: String(inv++), row: inv + 1 }, x || {});
    state.personalData = {
      a: pd('6119', '1', 'pw', 'Lionel'),                 // a caboose — Atlas 6119 is an engine
      b: pd('6800', '1', 'pw', 'Lionel'),                 // a flatcar — K-Line 6800 is an engine
      c: pd('115', '1', 'pw', 'Lionel'),                  // a station — Williams 115 is an engine
      d: pd('6656', '1', 'pw', 'Lionel'),                 // a stock car — K-Line 6656 is a caboose
      e: pd('2343-P', '1', 'pw', 'Lionel'),               // powered A unit: base number in the catalog
      f: pd('2046W', '1', 'pw', 'Lionel'),                // a tender — K-Line 2046W is a caboose
      g: pd('1050', '1', 'pw', 'Lionel'),                 // a steam engine — MPC 1050 is a SET
      h: pd('11450', '', 'mpc', 'Lionel'),                // a set — Atlas 11450 is a boxcar
      i: pd('600', '', 'prewar', 'Lionel'),               // a Pullman — Postwar 600 is a diesel
      j: pd('6119', '', 'Manual', 'Lionel', { itemType: 'Diesel Locomotive' }),   // MANUAL: its own type, never a catalog identity
      k: pd('SIGN-7', '', 'Manual', 'Lionel', { itemType: 'Accessory' }),         // manual, off-catalog
      l: pd('MYSTERY-1', '', 'Manual', 'Lionel', { itemType: '' }),               // manual, no type at all → Other
      m: pd('2343-BOX', '', 'pw', 'Lionel', { hasBox: 'Yes' }),                    // a box row — never counted
      n: pd('6800', '1', 'pw', 'Lionel', { owned: false }),                        // a WANT, not owned — never counted
    };
    const card = id => CARD_CATALOG.find(c => c.id === id);
    const num = id => Number(String(card(id).compute(state).value).replace(/,/g, ''));
    const html = card('collectionByType').compute(state).html || '';
    const shown = {}; html.replace(/<span[^>]*>([^<]+)<\/span><span[^>]*>(\d+)<\/span>/g, (_, k, v) => { shown[k] = Number(v); });
    const full = Object.assign({ Engines: 0, Tenders: 0, Freight: 0, Passenger: 0, Cabooses: 0, Accessories: 0, Other: 0 }, shown);
    const sheet = (typeof _sheetCardModel === 'function') ? _sheetCardModel(card('collectionByType'), state) : null;
    const sheetRows = {}; ((sheet && sheet.rows) || []).forEach(r => { sheetRows[r[0]] = r[1]; });
    return {
      breakdown: full, sheetRows: Object.assign({ Engines: 0, Tenders: 0, Freight: 0, Passenger: 0, Cabooses: 0, Accessories: 0, Other: 0 }, sheetRows),
      engines: num('engines'), cabooses: num('cabooses'), freight: num('freight'), passenger: num('passenger'), accessories: num('accessories'), sets: num('sets'),
    };
  });
  await pg.close();
  return { out, errs };
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});

  // ── A + B: the real app ──
  const real = await runCase(browser, null);
  OK('A0 the page ran without a script error', real.errs.length === 0, real.errs.join(' | '));
  T('A1 Collection by Type — each item counted once, by its own entry', real.out.breakdown, WANT.breakdown);
  T('A2 Total Engines (the steam 1050, the 2343-P, the manual diesel, the Pullman is NOT one)', real.out.engines, WANT.engines);
  T('A3 Total Cabooses', real.out.cabooses, WANT.cabooses);
  T('A4 Total Freight Cars', real.out.freight, WANT.freight);
  T('A5 Total Passenger Cars', real.out.passenger, WANT.passenger);
  T('A6 Total Accessories', real.out.accessories, WANT.accessories);
  T('A7 Total Sets — owned items that ARE sets, not catalog sets sharing an owned number', real.out.sets, WANT.sets);
  const single = real.out.engines + real.out.cabooses + real.out.freight + real.out.passenger + real.out.accessories;
  const owned = Object.values(WANT.breakdown).reduce((a, b) => a + b, 0);
  OK('A8 the Total cards never add up to more than the items owned', single <= owned, single + ' > ' + owned);
  T('B1 the sheet\'s Dashboard tab writes the card\'s own numbers', real.out.sheetRows, real.out.breakdown);

  // ── C: PLANTED — the old number-only helpers served in place ──
  const old = await runCase(browser, plantedDashboard());
  OK('C0 planted page ran (the old helpers load)', old.errs.length === 0, old.errs.join(' | '));
  OK('C1 PLANTED old code: Collection by Type differs — A1 would have caught it', JSON.stringify(old.out.breakdown) !== JSON.stringify(WANT.breakdown), JSON.stringify(old.out.breakdown));
  OK('C2 PLANTED old code: Total Engines differs — A2 would have caught it', old.out.engines !== WANT.engines, String(old.out.engines));
  OK('C3 PLANTED old code: Total Sets differs — A7 would have caught it', old.out.sets !== WANT.sets, String(old.out.sets));
  const oldSingle = old.out.engines + old.out.cabooses + old.out.freight + old.out.passenger + old.out.accessories;
  OK('C4 PLANTED old code: its Total cards overlap — A8 would have caught it', oldSingle > owned, oldSingle + ' vs ' + owned);
  await browser.close();

  // ── D: the scan — no app file counts owned items by matching numbers to catalog rows ──
  // Shapes: (1) a SET of catalog item numbers built from masterData;
  //         (2) catalog rows filtered by "is this number owned".
  const SHAPES = [
    /masterData[^;]{0,200}\.add\(\s*normalizeItemNum\(\s*m\.itemNum\s*\)\s*\)/,
    /masterData[^;]{0,200}\.has\(\s*normalizeItemNum\(\s*m\.itemNum\s*\)\s*\)/,
  ];
  const strip = s => s.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');   // full-line comments only (never /* */ by regex)
  const hits = s => SHAPES.some(re => re.test(strip(s)));
  OK('D1 PLANTED: the old number-set builder is caught', hits("(state.masterData || []).forEach(function(m) { if (_bucketIs(m, buckets)) nums.add(normalizeItemNum(m.itemNum)); });"));
  OK('D2 PLANTED: the old Total Sets filter is caught', hits("var count = state.masterData.filter(function(m) { return _bucketIs(m, _SET_BUCKETS) && owned.has(normalizeItemNum(m.itemNum)); }).length;"));
  OK('D3 a commented-out copy is not an offender', !hits("// (state.masterData || []).forEach(function(m) { nums.add(normalizeItemNum(m.itemNum)); });"));
  const files = fs.readdirSync(APP).filter(f => f.endsWith('.js')).concat(['index.html']);
  const off = files.filter(f => hits(fs.readFileSync(path.join(APP, f), 'utf8')));
  OK('D4 no app file (' + files.length + ' scanned) counts owned items by number against catalog rows', off.length === 0, off.join(', '));
  OK('D5 the dashboard\'s one decider is there and the sheet uses it',
    /function _ownedBucketOf\(pd\)/.test(fs.readFileSync(path.join(APP, 'dashboard.js'), 'utf8'))
    && /_ownedTypeBreakdown\(state\)/.test(fs.readFileSync(path.join(APP, 'sheet-builder.js'), 'utf8')));

  console.log('\n' + (fail ? 'RED' : 'GREEN') + ' — ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + (e && e.stack || e)); process.exit(1); });
