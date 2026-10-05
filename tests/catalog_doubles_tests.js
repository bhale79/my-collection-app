#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// CATALOG DOUBLES — v0.9.1884
//
// [stated] Brad: "yes" — the first start after Master Version 2.20 loaded ten
// makers' catalogs twice (10,245 Row IDs doubled); it could not be made to
// happen again, so the loaded list is now checked at the one place every
// change passes through (_rebuildMasterIndex): a Row ID seen twice keeps its
// LAST copy and the doubles are counted per maker, into the console and
// window._rrCatalogDoubles.
//
// A  the real rrDropDoubledCatalogRows, lifted: a clean list is the SAME
//    array (nothing copied on a normal reindex); a doubled maker loses its
//    earlier copy and keeps the later one; two makers counted apart; rows
//    with no Row ID are never touched; the console names the maker
// B  the real _rebuildMasterIndex, lifted: it runs the check and replaces
//    state.masterData only when something was doubled
// C  the REAL app in Chromium, the whole all-eras start with a stand-in
//    Sheets, the holding pen PLANTED to add a maker without dropping its old
//    rows: the catalog still ends up clean, and _rrCatalogDoubles names what
//    was caught; PLANTED again with the check cut out of the reindex: the
//    doubles stay — proof the guard is what cleans it
// Run:  node tests/catalog_doubles_tests.js
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const APP = path.join(__dirname, '..', 'app');
const AD = fs.readFileSync(path.join(APP, 'app-data.js'), 'utf8');
const AJ = fs.readFileSync(path.join(APP, 'app.js'), 'utf8');
let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + JSON.stringify(detail) : '')); }
}
function section(t) { console.log('\n== ' + t + ' =='); }
function grab(src, sig) { const i = src.indexOf(sig); if (i < 0) return ''; let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } return ''; }

const row = (id, era, x) => Object.assign({ itemNum: '100', rowId: id, _era: era }, x || {});

section('A — rrDropDoubledCatalogRows, the real function');
{
  const warns = [];
  const f = new Function('window', 'console', grab(AD, 'function rrDropDoubledCatalogRows(rows)') + '\nreturn rrDropDoubledCatalogRows;')({ _rrCatalogDoubles: [] }, { warn: s => warns.push(s) });
  const clean = [row('AAAAAAAAAA', 'pw'), row('BBBBBBBBBB', 'pw'), row('CCCCCCCCCC', 'mth_o'), { itemNum: '7', _era: 'pw' }, { itemNum: '7', _era: 'pw' }];
  const out = f(clean);
  ok('A1  a clean list comes back as the SAME array — a normal reindex copies nothing', out === clean && warns.length === 0);
  const old = row('AAAAAAAAAA', 'mth_g', { mark: 'old' }), fresh = row('AAAAAAAAAA', 'mth_g', { mark: 'fresh' });
  const doubled = [old, row('BBBBBBBBBB', 'pw'), row('CCCCCCCCCC', 'mth_g', { mark: 'old' }), fresh, row('CCCCCCCCCC', 'mth_g', { mark: 'fresh' }), row('DDDDDDDDDD', 'weaver'), row('DDDDDDDDDD', 'weaver'), { itemNum: '7', _era: 'pw' }, { itemNum: '7', _era: 'pw' }];
  const out2 = f(doubled);
  ok('A2  a doubled Row ID keeps ONE row', out2 !== doubled && out2.filter(r => r.rowId === 'AAAAAAAAAA').length === 1 && out2.filter(r => r.rowId === 'CCCCCCCCCC').length === 1 && out2.filter(r => r.rowId === 'DDDDDDDDDD').length === 1);
  ok('A3  the LAST copy is the one kept (the freshest — new rows are appended)', out2.find(r => r.rowId === 'AAAAAAAAAA') === fresh && out2.find(r => r.rowId === 'CCCCCCCCCC').mark === 'fresh');
  ok('A4  the order of everything else is unchanged', out2.map(r => r.rowId || 'none').join(',') === 'BBBBBBBBBB,AAAAAAAAAA,CCCCCCCCCC,DDDDDDDDDD,none,none');
  ok('A5  rows with no Row ID are never touched (two of them stay two)', out2.filter(r => !r.rowId).length === 2);
  ok('A6  the console names each maker and its count', warns.length === 2 && /^\[catalog\] mth_g: 2 rows were loaded twice/.test(warns[0]) && /^\[catalog\] weaver: 1 rows were loaded twice/.test(warns[1]), warns);
  const win = { _rrCatalogDoubles: [] };
  const g = new Function('window', 'console', grab(AD, 'function rrDropDoubledCatalogRows(rows)') + '\nreturn rrDropDoubledCatalogRows;')(win, { warn() {} });
  g(doubled);
  ok('A7  the evidence is kept on window._rrCatalogDoubles (maker, rows, when)', win._rrCatalogDoubles.length === 2 && win._rrCatalogDoubles[0].era === 'mth_g' && win._rrCatalogDoubles[0].rows === 2 && typeof win._rrCatalogDoubles[0].at === 'number');
  ok('A8  an empty or missing list is fine', Array.isArray(f([])) && Array.isArray(f(undefined)));
}

section('B — _rebuildMasterIndex runs the check');
{
  const state = { masterData: [row('AAAAAAAAAA', 'pw'), row('AAAAAAAAAA', 'pw', { mark: 'fresh' }), row('BBBBBBBBBB', 'mpc')] };
  const body = grab(AD, 'function rrDropDoubledCatalogRows(rows)') + '\n' + grab(AD, 'function _rrIndexByRowId(rows)') + '\n' + grab(AD, 'function _rebuildMasterIndex()') + '\nreturn _rebuildMasterIndex;';
  const rebuild = new Function('state', 'window', 'console', body)(state, { _rrCatalogDoubles: [] }, { warn() {} });
  const before = state.masterData;
  rebuild();
  ok('B1  a doubled list is replaced by the cleaned one', state.masterData !== before && state.masterData.length === 2 && state.masterData[0].mark === 'fresh');
  ok('B2  the indexes are built from the cleaned list', state.masterByItem.get('100').length === 2 && state.masterByRowId.size === 2 && state._masterIdxMap.get(state.masterData[0]) === 0);
  const clean = state.masterData;
  rebuild();
  ok('B3  a clean list is left as the same array (the index map keys the row objects)', state.masterData === clean);
  ok('B4  the guard sits in the reindex, before the index loop', /const rows0 = state\.masterData \|\| \[\];\s*const rows = rrDropDoubledCatalogRows\(rows0\);\s*if \(rows !== rows0\) state\.masterData = rows;/.test(grab(AD, 'function _rebuildMasterIndex()')));
  ok('B5  the holding pen and the on-demand load still reindex after every change (the guard rides on that)',
    /state\.masterData = \(state\.masterData \|\| \[\]\)\.filter\(function \(m\) \{ return !drop\.has\(m\._era\); \}\)\.concat\(incoming\);[\s\S]{0,900}_rebuildMasterIndex\(\);/.test(AJ)
    && /state\.masterData = \(state\.masterData \|\| \[\]\)\.concat\(arr\);\s*if \(typeof _rebuildMasterIndex === 'function'\) _rebuildMasterIndex\(\);/.test(AJ));
}

// ── C: the real app, the real all-eras start, a planted pen ─────────────────
function plantedPen() {
  const s = AJ;
  const out = s.replace("state.masterData = (state.masterData || []).filter(function (m) { return !drop.has(m._era); }).concat(incoming);", 'state.masterData = (state.masterData || []).concat(incoming);');
  if (out === s) throw new Error('planted app.js: the pen line moved; update this test');
  return out;
}
function plantedNoGuard() {
  const s = AD;
  const out = s.replace('const rows = rrDropDoubledCatalogRows(rows0);', 'const rows = rows0;');
  if (out === s) throw new Error('planted app-data.js: the guard line moved; update this test');
  return out;
}
async function startApp(browser, planted) {
  const pg = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url();
    if (!u.startsWith('file://')) return r.abort();
    const bare = u.split('?')[0];
    if (planted.app && bare.endsWith('/app/app.js')) return r.fulfill({ body: planted.app, contentType: 'application/javascript' });
    if (planted.data && bare.endsWith('/app/app-data.js')) return r.fulfill({ body: planted.data, contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(600);
  const out = await pg.evaluate(async () => {
    const ERAS = ['pw', 'prewar', 'mth_g', 'marklin_z', 'weaver', 'trepro'];
    const SIZE = { pw: 300, prewar: 120, mth_g: 60, marklin_z: 40, weaver: 50, trepro: 30 };
    window._isEraEnabled = function (e) { return e === 'all' || ERAS.indexOf(e) >= 0; };
    window.showToast = function () {};
    const AL = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
    const rid = (era, i) => { let x = (ERAS.indexOf(era) + 1) * 100003 + i; let o = ''; for (let k = 0; k < 10; k++) { o = AL[x % AL.length] + o; x = Math.floor(x / AL.length) + k * 7; } return o; };
    const HDR = ['Item Number', 'Item Type', 'Variation', 'Description', 'Road Name', 'Year Produced', 'Gauge', 'Row ID'];
    const tabRows = era => { const rows = [HDR]; for (let i = 0; i < SIZE[era]; i++) rows.push([String(1000 + i), 'Boxcar', '', era + ' item ' + i, '', '1950', 'O', rid(era, i)]); return rows; };
    const cacheRows = era => { const rows = []; for (let i = 0; i < SIZE[era]; i++) rows.push({ itemNum: String(1000 + i), itemType: 'Boxcar', variation: '', description: era + ' item ' + i, roadName: '', yearProd: '1950', gauge: 'O', rowId: rid(era, i), _era: era, _tab: ERA_TABS[era].items }); return rows; };
    for (const e of ERAS) { await idbSet('lv_master_cache_' + e, cacheRows(e)); localStorage.setItem('lv_master_cache_ts_' + e, String(Date.now())); }
    localStorage.setItem('lv_master_ver_seen', '2.20');   // the sheet says 2.21 below → every catalog refreshes
    localStorage.setItem('lv_cache_ver', String(CATALOG_CACHE_VER));
    localStorage.setItem('lv_owned_eras', JSON.stringify(['pw']));
    state.masterSheetId = 'MASTER'; state.personalSheetId = 'SID'; window.accessToken = 'tok'; accessToken = 'tok';
    window.loadPersonalData = async function () { state.personalData = { a: { owned: true, itemNum: '1001', variation: '', era: 'pw', inventoryId: 'INV-A', row: 3, masterRowId: rid('pw', 1) } }; state.soldData = {}; state.wantData = {}; state.forSaleData = {}; };
    const tabEra = {}; ERAS.forEach(e => { Object.values(ERA_TABS[e]).forEach(t => { tabEra[t] = e; }); });
    window.fetch = async function (url) {
      const u = String(url);
      const ok = b => ({ ok: true, status: 200, json: async () => b, text: async () => JSON.stringify(b) });
      if (/values:batchGet/.test(u)) {
        const ranges = [...u.matchAll(/ranges=([^&]+)/g)].map(m => decodeURIComponent(m[1]));
        const tabs = ranges.map(r => r.split('!')[0].replace(/^'|'$/g, ''));
        const era = tabEra[tabs[0]];
        if (era) { await new Promise(r => setTimeout(r, 30 + SIZE[era] / 4)); return ok({ valueRanges: ranges.map((r, i) => ({ range: r, values: tabs[i] === ERA_TABS[era].items ? tabRows(era) : [] })) }); }
        return ok({ valueRanges: ranges.map(r => ({ range: r, values: [] })) });
      }
      const m = /\/values\/([^?]+)\?/.exec(u);
      if (m) { const r = decodeURIComponent(m[1]); if (/^'?Master Version'?!/.test(r)) return ok({ values: [['2.21', '2026-10-05', 'x'], ['2.20', '2026-10-04', 'y']] }); return ok({ values: [] }); }
      return ok({});
    };
    await loadAllErasMode();
    let waited = 0;
    while (waited < 20000) { await new Promise(r => setTimeout(r, 250)); waited += 250; if (window._skipBackgroundRefresh === false && !(state.loading && state.loading.allEras && state.loading.allEras.refreshing) && waited > 1500) break; }
    await new Promise(r => setTimeout(r, 700));   // the last pen window
    const seen = new Set(); const dupBy = {}; let dups = 0;
    state.masterData.forEach(r => { if (!r.rowId) return; if (seen.has(r.rowId)) { dups++; dupBy[r._era] = (dupBy[r._era] || 0) + 1; } else seen.add(r.rowId); });
    const expect = Object.values(SIZE).reduce((a, b) => a + b, 0);
    return { rows: state.masterData.length, expect, dups, dupBy, caught: (window._rrCatalogDoubles || []).map(d => d.era + ':' + d.rows), idxRows: state.masterByRowId.size, firstRow: state.masterData[0] && state.masterData[0]._era, waited };
  });
  await pg.close();
  return { out, errs };
}

(async () => {
  let chromium;
  try { chromium = require('playwright').chromium; } catch (e) { chromium = null; }
  section('C — the real app, a version-change start, the holding pen planted to double every maker');
  if (!chromium) { ok('C0  playwright is installed', false, 'npm is blocked in the cloud — run this tier where playwright exists'); }
  else {
    const browser = await chromium.launch({ executablePath: process.env.RR_CHROMIUM || '/opt/pw-browsers/chromium' });
    try {
      const a = await startApp(browser, { app: plantedPen() });
      ok('C1  the planted pen doubled makers, and the catalog still ends up clean (0 Row IDs twice)', a.out.dups === 0 && a.out.rows === a.out.expect, a.out);
      ok('C2  the guard reports what it caught — every refreshed maker, by name', a.out.caught.length >= 5 && a.out.caught.some(c => /^mth_g:60$/.test(c)) && a.out.caught.some(c => /^weaver:50$/.test(c)), a.out.caught);
      ok('C3  the Row ID index holds every row once', a.out.idxRows === a.out.expect, a.out);
      ok('C4  no page errors', a.errs.length === 0, a.errs);
      const b = await startApp(browser, { app: plantedPen(), data: plantedNoGuard() });
      ok('C5  PLANTED: with the check cut out of the reindex, the doubles stay (proof the guard is what cleans it)', b.out.dups > 0 && b.out.rows > b.out.expect, b.out);
      const c = await startApp(browser, {});
      ok('C6  the real code, unplanted: a version-change start is clean and the guard has nothing to report', c.out.dups === 0 && c.out.rows === c.out.expect && c.out.caught.length === 0, c.out);
    } finally { await browser.close(); }
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
