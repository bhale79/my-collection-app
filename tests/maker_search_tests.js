#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════
// MAKER SEARCH — typing a maker's name finds that maker's items
// (makersearch)   (real Chromium, the REAL app)
//
// [stated] Brad 2026-11-26 13:37 CT "Not thrilled with search of already
// entered items. Put in MTH and only showed 3 entries, when there are many
// more" (Bob bobbers800's MTH collection) → 13:38 CT "Emergency fix that now".
//
// The cause: the search box's words (browse.js, _rowPasses `haystack`) never
// held the item's MAKER — "MTH" found only rows whose description said MTH.
// Owner: browse.js rrSearchMakerWords(item, pd) — the row's maker through THE
// ONE maker rule (rrMakerOf, app.js), plus the copy's own saved Manufacturer
// cell when it says something else; remembered per row object (WeakMap).
//
// Proved through the app's own search box (onPageSearch → renderBrowse →
// state.filteredData), only the Sheets / Drive writers stood in for:
//   S  My Collection: "MTH" finds EVERY MTH copy — catalog copies whose
//      descriptions never say MTH, and a hand-entered MTH copy; nothing else
//   T  capitals / spaces typed before or after do not matter ("  Mth ") —
//      the box is trimmed at the one place the list reads it (_rrBrowseCore)
//   U  a hand-entered copy with its own name is found by its maker (Pittman);
//      a catalog copy's own saved spelling of its maker is found too;
//      another maker's name (Lionel, Menards) finds its own
//   V  the Master Catalog search finds unowned MTH rows by maker too
//   W  the old searches are unchanged: a word in the description, an item
//      number, a road name
//   X  the row's maker is asked ONCE per row: a second search over the same
//      catalog does not ask rrMakerOf again (the 165K-row cost guard)
//   P  planted offenders — each rule undone in a served copy must turn red
// ══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  maker_search_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function ok(n, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (extra == null ? '' : String(extra)).slice(0, 400))); cond ? pass++ : fail++; }

async function scenario(pg) {
  return pg.evaluate(async () => {
    const R = {};
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const mk = (n, t, d, era, tab, x) => Object.assign({ itemNum: n, variation: '', itemType: t, _era: era, _tab: tab, yearProd: '2020', description: d, roadName: '', roadNum: '', rowId: 'RID-' + era + '-' + n }, x || {});
    state.masterData = [
      mk('30-74000', 'Boxcar', 'Pennsylvania Boxcar', 'mth_o', 'MTH O', { roadName: 'Pennsylvania' }),
      mk('30-2001', 'Diesel', 'GP-9 Diesel Engine', 'mth_o', 'MTH O', { roadName: 'Santa Fe' }),
      mk('30-7900', 'Reefer', 'MTH Premier Reefer', 'mth_o', 'MTH O'),
      mk('30-8000', 'Caboose', 'Wood Caboose', 'mth_o', 'MTH O'),
      mk('6464-1', 'Boxcar', 'Western Pacific Boxcar', 'pw', 'Lionel PW - Items', { roadName: 'Western Pacific' }),
      mk('275-9388', 'Flatcar', 'BN Flatcar with 1954 GMC truck', 'menards', 'Menards O', { roadName: 'Burlington Northern' }),
    ];
    _rebuildMasterIndex();
    state.isData = {}; state.forSaleData = {}; state.wantData = {}; state.upgradeData = {}; state.soldData = {};
    state.personalSheetId = 'SHEET';
    _currentEra = 'all';
    window.buildDashboard = () => {};
    window.showToast = () => {};
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
    const F = PERSONAL_FIELD_INDEX;
    let rowN = 10;
    const copy = (inv, fields) => {
      const r = new Array(PERSONAL_SCHEMA.length).fill('');
      Object.keys(fields).forEach(k => { if (F[k] !== undefined) r[F[k]] = fields[k]; });
      r[F.inventoryId] = inv;
      return rrPersonalRecordFromRow(r, ++rowN);
    };
    const linked = (inv, row, extra) => copy(inv, Object.assign({ itemNum: row.itemNum, variation: '', era: row._era, masterRowId: row.rowId, condition: '8' }, extra || {}));
    const M = state.masterData;
    state.personalData = {
      'INV1': linked('INV1', M[0]),
      'INV2': linked('INV2', M[1], { manufacturer: 'M.T.H. Electric Trains' }),   // an imported copy's own spelling of its maker
      'INV3': linked('INV3', M[2]),
      'INV4': linked('INV4', M[4]),
      'INV5': linked('INV5', M[5]),
      'INV6': copy('INV6', { itemNum: 'Bobs weathered hood unit', customName: 'Bobs weathered hood unit', era: 'Manual', manufacturer: 'MTH', itemType: 'Diesel', description: 'Repainted', condition: '7' }),
      'INV7': copy('INV7', { itemNum: 'Spare can motor', customName: 'Spare can motor', era: 'Manual', manufacturer: 'Pittman', itemType: 'Motor', description: 'For repowering', condition: '7' }),
    };
    try { showPage('browse'); } catch (e) {}
    const invOf = (it) => String((it._copyPd && it._copyPd.inventoryId) || '') || (function () {
      const k = Object.keys(state.personalData).filter(k => {
        const p = state.personalData[k];
        return p && String(p.itemNum) === String(it.itemNum) && (String(p.masterRowId || '') === String(it.rowId || '') || !it.rowId);
      });
      return k.join('+');
    })();
    const listFor = async (q, owned) => {
      state.filters.owned = !!owned; _currentEra = 'all';
      try { onPageSearch(q, 'browse'); } catch (e) { return { err: String(e && e.message || e) }; }
      await sleep(420);
      const rows = state.filteredData || [];
      return owned ? rows.map(invOf).sort() : rows.map(it => it.itemNum).sort();
    };
    R.sAll = await listFor('', true);
    R.sMth = await listFor('MTH', true);
    R.tMth = await listFor('  Mth ', true);
    R.uPit = await listFor('pittman', true);
    R.uOwn = await listFor('electric trains', true);
    R.uLio = await listFor('lionel', true);
    R.uMen = await listFor('menards', true);
    R.vCat = await listFor('mth', false);
    R.wDesc = await listFor('reefer', true);
    R.wNum = await listFor('30-2001', true);
    R.wRoad = await listFor('santa fe', true);
    // X — count rrMakerOf calls over two searches of the same catalog
    try {
      const real = window.rrMakerOf; let n = 0;
      window.rrMakerOf = function (o) { n++; return real(o); };
      state.masterData = state.masterData.map(r => Object.assign({}, r));   // new row objects — a rebuilt catalog asks afresh
      _rebuildMasterIndex();
      await listFor('caboose', false); R.xFirst = n;
      await listFor('cabooses', false); await listFor('wood', false); R.xAfter = n;
      window.rrMakerOf = real;
    } catch (e) { R.xErr = String(e && e.message || e); }
    return R;
  });
}

async function openApp(browser, served) {
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
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

const J = (a) => JSON.stringify(a);
const RULES = {
  S0: ['the list draws all 7 owned copies with no search', r => Array.isArray(r.sAll) && r.sAll.length === 7],
  S1: ['"MTH" finds every MTH copy — the 3 catalog copies and the hand-entered one — and nothing else', r => J(r.sMth) === J(['INV1', 'INV2', 'INV3', 'INV6'])],
  T1: ['capitals and spaces typed do not matter ("  Mth ")', r => J(r.tMth) === J(['INV1', 'INV2', 'INV3', 'INV6'])],
  U1: ['a hand-entered copy with its own name is found by its maker (Pittman, not in the catalog)', r => J(r.uPit) === J(['INV7'])],
  U3: ['a catalog copy\'s own saved spelling of its maker is found too ("electric trains")', r => J(r.uOwn) === J(['INV2'])],
  U2: ['"lionel" finds the Lionel copy and "menards" the Menards copy, nothing else', r => J(r.uLio) === J(['INV4']) && J(r.uMen) === J(['INV5'])],
  V1: ['the Master Catalog search finds every MTH row by maker, owned or not', r => J(r.vCat) === J(['30-2001', '30-74000', '30-7900', '30-8000'])],
  W1: ['a word in the description still finds its row only ("reefer")', r => J(r.wDesc) === J(['INV3'])],
  W2: ['an item number still finds its row only', r => J(r.wNum) === J(['INV2'])],
  W3: ['a road name still finds its row only ("santa fe")', r => J(r.wRoad) === J(['INV2'])],
  X1: ['the row\'s maker is asked once per row — later searches ask nothing new', r => r.xFirst > 0 && r.xAfter === r.xFirst],
};

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const o = await openApp(browser, null);
  let R = null;
  try { R = await scenario(o.pg); } catch (e) { ok('scenario runs', false, e.message); }
  if (R) Object.keys(RULES).forEach(k => { let v = false; try { v = !!RULES[k][1](R); } catch (e) {} ok(k + ' ' + RULES[k][0], v, J(R)); });
  ok('no page errors', o.errs.length === 0, o.errs.join(' | '));
  await o.pg.close();

  // ── P — planted offenders ──
  const src = (n) => fs.readFileSync(path.join(APP, n), 'utf8');
  const plant = (n, from, to) => { const s = src(n); const c = s.split(from).length - 1; if (c !== 1) throw new Error('plant anchor found ' + c + ' times in ' + n + ': ' + from.slice(0, 60)); return { [n]: s.split(from).join(to) }; };
  const plants = [
    ['P1 the maker left out of the search words', () => plant('browse.js', " ${(typeof rrSearchMakerWords === 'function') ? rrSearchMakerWords(item, pd) : ''}`.toLowerCase();", "`.toLowerCase();"), ['S1', 'T1', 'U1', 'U2', 'V1']],
    ['P2 the copy\'s own saved maker ignored', () => plant('browse.js', "  if (_cm && _cm.toLowerCase() !== _rm.toLowerCase()) return (_rm ? _rm + ' ' : '') + _cm;", ''), ['U3']],
    ['P3 the row\'s maker not asked of the one maker rule', () => plant('browse.js', "_rm = (typeof rrMakerOf === 'function') ? String(rrMakerOf({ row: item }) || '') : '';", "_rm = '';"), ['S1', 'V1', 'U2']],
    ['P5 the search box not trimmed', () => plant('browse.js', "  search = String(search == null ? '' : search).trim();", ''), ['T1']],
    ['P4 the row\'s maker not remembered', () => plant('browse.js', "      if (_rrRowMakerMemo) _rrRowMakerMemo.set(item, _rm);", ''), ['X1']],
  ];
  for (const [name, mkServed, mustRed] of plants) {
    let served; try { served = mkServed(); } catch (e) { ok(name + ' — plant applies', false, e.message); continue; }
    const op = await openApp(browser, served);
    let Rp = null, threw = '';
    try { Rp = await scenario(op.pg); } catch (e) { threw = String(e && e.message || e); }
    const red = mustRed.filter(k => { if (!Rp) return true; try { return !RULES[k][1](Rp); } catch (e) { return true; } });
    ok(name + ' → turns ' + mustRed.join(', ') + ' red', red.length === mustRed.length, 'still green: ' + mustRed.filter(k => red.indexOf(k) < 0).join(', ') + (threw ? ' (scenario threw: ' + threw.slice(0, 120) + ')' : ''));
    await op.pg.close();
  }
  await browser.close();
  console.log((fail ? 'FAILED' : 'PASSED') + '  —  maker_search: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
