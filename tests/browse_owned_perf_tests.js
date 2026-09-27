#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// BROWSE OWNED PERF — v0.9.1817   (real Chromium, the REAL app, no stubs)
//
// Release readiness S4. MEASURED on Brad's desktop, 2026-09-27: opening My
// Collection took 1.18 s and every redraw 0.77 s, for 50 of 233 owned rows —
// 488,154 _displayItemNum calls per draw, i.e. THREE full walks of the
// 162,000-row catalog. A catalog row can only pass as owned if its display
// number is one the user owns or an adoption seat names it; both sets exist
// before the walk. v1817 gates _rowPasses on that candidate set and caches
// the adoption map on the catalog's identity.
//
// THE RULE: the shortcut changes NOTHING about what is drawn. This renders
// the real My Collection list with the gate OFF (window._rrNoCandidateGate,
// the test-only switch) and ON, on a synthetic 30,000-row catalog with every
// ownership shape the resolver knows — exact number+variation, blank-
// variation adoption among lookalikes, ambiguous variation rows, a stored
// masterKey, a personal-only manual item, a sold item, a suffix (-P) copy —
// and asserts the full filtered list is identical, then that the gate is
// materially faster.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  browse_owned_perf_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail))); cond ? pass++ : fail++; }

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(800);

  const out = await pg.evaluate(() => {
    const PW = 'Lionel PW - Items', MPC = 'Lionel MPC-Modern', AT = 'Atlas O', PAPER = 'Lionel PW - Paper';
    const mk = (n, v, t, era, tab, yr, extra) => Object.assign({ itemNum: n, variation: v, itemType: t, _era: era, _tab: tab, yearProd: yr, description: t + ' ' + n, roadName: 'Road ' + n }, extra || {});
    const md = [];
    // 30,000 filler rows across three eras, numbers 10000..
    for (let i = 0; i < 30000; i++) md.push(mk(String(10000 + i), i % 3 ? '1' : '', i % 2 ? 'Boxcar' : 'Caboose', ['pw', 'mpc', 'atlas'][i % 3], [PW, MPC, AT][i % 3], '1950'));
    // the shapes
    md.push(mk('6457', '1', 'Caboose', 'pw', PW, '1949'), mk('6457', '2', 'Caboose', 'pw', PW, '1950'), mk('6457', '3', 'Caboose', 'pw', PW, '1951'));
    md.push(mk('2444', '', 'Pullman', 'pw', PW, '1954'), mk('2444', '', 'Box', 'pw', PAPER, '1954'));               // blank-variation lookalikes: item vs box
    md.push(mk('2321', '1', 'Diesel', 'pw', PW, '1954'), mk('2321', '1', 'Diesel', 'williams', 'Williams O', '1990'));   // ambiguous same number+variation
    md.push(mk('6464-425', '1', 'Boxcar', 'pw', PW, '1956'));
    md.push(mk('2343P', '1', 'Diesel', 'pw', PW, '1950'), mk('2343T', '1', 'Diesel', 'pw', PW, '1950'));     // suffix rows
    md.push(mk('8359', '', 'Diesel', 'mpc', MPC, '1973'));
    md.push(mk('0326', '', 'Caboose', 'atlas', AT, '2005'));
    state.masterData = md;
    _rebuildMasterIndex();
    let inv = 1;
    const pd = (n, v, era, mfr, x) => Object.assign({ owned: true, itemNum: n, variation: v, era: era, manufacturer: mfr, inventoryId: String(inv++), row: inv + 1, condition: '7' }, x || {});
    state.personalData = {
      a: pd('6457', '2', 'pw', 'Lionel'), b: pd('6457', '2', 'pw', 'Lionel'),      // two copies of one variation
      c: pd('2444', '', 'pw', 'Lionel', { itemType: 'Pullman' }),                   // blank variation → adoption picks the item row
      d: pd('2321', '1', 'pw', 'Lionel'),                                            // ambiguous → era scoring
      e: pd('6464-425', '1', 'pw', 'Lionel'),
      f: pd('2343-P', '1', 'pw', 'Lionel'),                                          // dashed suffix copy
      g: pd('8359', '', 'mpc', 'Lionel'),
      h: pd('0326', '', 'atlas', 'Atlas'),
      i: pd('Ertl 1:64 truck', '', 'Manual', 'Ertl', { itemType: 'Vehicle' }),      // personal-only manual
      j: pd('10005', '', 'pw', 'Lionel'),                                            // owns a filler row
      k: Object.assign(pd('10008', '', 'pw', 'Lionel'), { owned: false }),           // not owned any more
    };
    // stored masterKey on one copy, when the app offers keys
    try { const row = state.masterData.find(m => m.itemNum === '6464-425'); if (typeof rrMasterKeyOf === 'function') state.personalData.e.masterKey = rrMasterKeyOf(row); } catch (e) {}
    state.soldData = { s1: { itemNum: '10008', variation: '', soldDate: '2026-01-01' } };
    state.wantData = state.wantData || {};
    _currentEra = 'all';
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-browse').classList.add('active');
    localStorage.setItem('lv_browse_filter_state', JSON.stringify({ manufacturer: 'any', scale: 'any', era: 'any', section: 'items' }));
    state.filters.ownMaker = ''; state.filters.type = ''; state.filters.subCollection = ''; state.filters.subType = '';
    filterOwned();
    const key = it => (it._personalOnly ? 'P:' : '') + (it.itemNum) + '|' + (it.variation || '') + '|' + (it._era || '') + '|' + (it._tab || '') + (it._copyPd ? '#' + it._copyPd.inventoryId : '');
    const draw = (gateOff) => {
      window._rrNoCandidateGate = !!gateOff;
      window.__rrBvByNum = null;                     // start cold both times — the cache is part of what is measured
      window._rrBrowseSig = null;
      const t0 = performance.now(); renderBrowse(); const ms = performance.now() - t0;
      const listed = (state.filteredData || []).map(key);
      const drawn = Array.from(document.querySelectorAll('#browse-tbody tr')).length;
      window._rrBrowseSig = null;
      const t1 = performance.now(); renderBrowse(); const ms2 = performance.now() - t1;   // warm redraw
      return { ms: Math.round(ms), ms2: Math.round(ms2), listed, drawn };
    };
    const off = draw(true);
    const on = draw(false);
    window._rrNoCandidateGate = false;
    return { off: { ms: off.ms, ms2: off.ms2, n: off.listed.length, drawn: off.drawn }, on: { ms: on.ms, ms2: on.ms2, n: on.listed.length, drawn: on.drawn },
             identical: JSON.stringify(off.listed) === JSON.stringify(on.listed), sample: on.listed.slice(0, 12),
             hasCopies: on.listed.filter(k => /^6457\|2\|/.test(k)).length, hasAdopted: on.listed.some(k => /^2444\|\|pw\|Lionel PW - Items/.test(k)),
             hasManual: on.listed.some(k => /^P:Ertl/.test(k)), soldGone: !on.listed.some(k => /^10008\|/.test(k)), fillerOwned: on.listed.some(k => /^10005\|/.test(k)) };
  });
  await browser.close();

  console.log('== A · the shortcut changes nothing that is drawn ==');
  T('A1  the full filtered list is IDENTICAL with the gate off and on', out.identical, { off: out.off, on: out.on, sample: out.sample });
  T('A2  the list is non-trivial (every ownership shape present)', out.on.n >= 9 && out.on.drawn > 0, out.on);
  T('A3  two copies of one variation both listed', out.hasCopies === 2, out.hasCopies);
  T('A4  the blank-variation item lit its adopted catalog row (not the box)', out.hasAdopted, out.sample);
  T('A5  the personal-only manual item is listed', out.hasManual);
  T('A6  the sold, no-longer-owned item is gone', out.soldGone);
  T('A7  an owned filler row from the 30k is found', out.fillerOwned);
  console.log('\n== B · and it is materially faster ==');
  T('B1  cold draw: gate ON at most half the time of gate OFF', out.on.ms * 2 <= out.off.ms, { off: out.off.ms, on: out.on.ms });
  T('B2  warm redraw: gate ON at most half the time of gate OFF', out.on.ms2 * 2 <= out.off.ms2, { off: out.off.ms2, on: out.on.ms2 });
  T('E1  no page errors', errs.length === 0, errs);
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
