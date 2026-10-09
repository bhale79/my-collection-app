#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// PICKER-PREFS TESTS — v0.9.1812   (real Chromium, the REAL app, no stubs)
//
// Brad, release walk-through 2026-09-27: a fresh account unticked S, HO, G, N
// and eleven makers under Preferences → What I Collect, opened the Master
// Catalog's "Pick Manufacturer" list — and every unticked maker was still
// offered. The rows had followed the preference since v0.9.1796; the three
// picker lists (Manufacturer, Scale, Era) never asked.
//
// THE RULE:
//   Master Catalog  — a picker offers only what What I Collect ticks.
//   My Collection   — ticked PLUS anything unticked you actually own something
//                     in, because owned is never hidden (v1796) and the picker
//                     must still reach it.
//
// This opens the real picker after setting the real preferences through the
// app's own setters, and reads the buttons it drew. Section D plants the old
// behaviour back (the gate answering "yes" to everything) and the same reads
// must go red.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  picker_prefs_tests needs playwright and it is not installed.'); process.exit(1); }
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
    const PW = 'Lionel PW - Items', MPC = 'Lionel MPC-Modern', AT = 'Atlas O', MO = 'MTH O';
    const mk = (n, v, t, era, tab, yr) => ({ itemNum: n, variation: v, itemType: t, _era: era, _tab: tab, yearProd: yr, description: t + ' ' + n, roadName: '' });
    state.masterData = [
      mk('6457', '3', 'Caboose', 'pw', PW, '1949'), mk('6464', '1', 'Boxcar', 'pw', PW, '1953'),
      mk('8359', '', 'Diesel', 'mpc', MPC, '1973'),
      mk('0326', '', 'Caboose', 'atlas', AT, '2005'),
      mk('20-3131-1', '', 'Steam', 'mth', MO, '2010'),
    ];
    _rebuildMasterIndex();
    let inv = 1;
    const pd = (n, v, era, mfr, x) => Object.assign({ owned: true, itemNum: n, variation: v, era: era, manufacturer: mfr, inventoryId: String(inv++), row: inv + 1 }, x || {});
    state.personalData = {
      a: pd('6457', '3', 'pw', 'Lionel'), b: pd('6464', '1', 'pw', 'Lionel'),
      c: pd('0326', '', 'atlas', 'Atlas'),                 // OWNED Atlas — will be UNTICKED below
    };
    _currentEra = 'all';
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-browse').classList.add('active');

    const reset = () => {
      localStorage.setItem('lv_browse_filter_state', JSON.stringify({ manufacturer: 'any', scale: 'any', era: 'any', section: 'items' }));
      state.filters.ownMaker = ''; state.filters.type = ''; state.filters.subCollection = ''; state.filters.subType = '';
    };
    // The option id is whatever the button hands to _setHierarchyChoice, so
    // every button is CLICKED with a spy in place of that function — nothing
    // here re-derives an id from a label.
    const realChoice = window._setHierarchyChoice;
    const ids = (level) => {
      reset();
      _openLevelPicker(level);
      const btns = Array.from(document.querySelectorAll('#ph-picker-overlay button'));
      const labels = btns.map(b => b.textContent.trim());
      const n = btns.length;
      document.getElementById('ph-picker-overlay').remove();
      const got = [];
      for (let i = 0; i < n; i++) {
        if (labels[i] === 'Cancel') continue;
        reset();
        _openLevelPicker(level);
        let picked = null;
        window._setHierarchyChoice = function (lv, v) { picked = v; };
        const b = document.querySelectorAll('#ph-picker-overlay button')[i];
        try { b.click(); } finally { window._setHierarchyChoice = realChoice; }
        const ov = document.getElementById('ph-picker-overlay'); if (ov) ov.remove();
        if (picked !== null) got.push(picked);
      }
      return { got, labels: labels.filter(l => l !== 'Cancel') };
    };
    const allMfr = Object.keys(WHAT_I_COLLECT.MANUFACTURERS);
    const allScale = Object.keys(WHAT_I_COLLECT.SCALES);
    const res = { allMfr: allMfr.length, allScale: allScale.length, errs: [] };

    // ── everything ticked (a never-chosen account) ───────────────────────
    localStorage.removeItem('lv_collect_mfrs'); localStorage.removeItem('lv_collect_mfrs_roster');
    localStorage.removeItem('lv_collect_scales'); localStorage.removeItem('lv_collect_scales_roster');
    localStorage.removeItem('lv_collect_eras'); localStorage.removeItem('lv_collect_eras_roster');
    localStorage.removeItem('lv_collect_lines'); localStorage.removeItem('lv_collect_lines_roster');
    resetFilters();
    res.cat_all = { mfr: ids('manufacturer').got, scale: ids('scale').got, era: ids('era').got };

    // ── tick only Lionel + MTH, only O, only Postwar + Modern ─────────────
    // v0.9.1909: "What I collect" is ONE choice — the lines. Lionel Postwar,
    // Lionel MPC/Modern and MTH O are exactly "Lionel + MTH, O, Postwar +
    // Modern", and the pickers' maker / scale / period lists are answered
    // from those lines.
    _setEnabledEras(['pw', 'mpc', 'mth_o']);
    res.enabledMfr = _getEnabledManufacturers();
    resetFilters();                       // Master Catalog view
    res.cat = { mfr: ids('manufacturer').got, scale: ids('scale').got, era: ids('era').got };
    filterOwned();                        // My Collection view — Atlas is owned but unticked
    res.coll = { mfr: ids('manufacturer'), scale: ids('scale').got, era: ids('era').got };

    // ── D: planted offender — the gate says yes to everything ─────────────
    const realGate = window._phPrefAllows;
    // the picker calls the module-level binding, so the offender must be
    // installed where the picker looks; browse.js reads the global name
    window._phPrefAllows = function () { return true; };
    resetFilters();
    res.offender_cat_mfr = ids('manufacturer').got;
    window._phPrefAllows = realGate;
    resetFilters();
    res.after_cat_mfr = ids('manufacturer').got;
    return res;
  });
  await browser.close();

  const has = (arr, id) => arr.indexOf(id) >= 0;
  console.log('== A · nothing chosen yet: everything offered ==');
  T('A1  Manufacturer picker lists every catalog maker', out.cat_all.mfr.filter(x => x !== 'any').length === out.allMfr, out.cat_all.mfr);
  T('A2  Scale picker lists every scale', out.cat_all.scale.filter(x => x !== 'any').length === out.allScale, out.cat_all.scale);
  T('A3  Era picker lists all three periods', out.cat_all.era.filter(x => x !== 'any').length === 3, out.cat_all.era);

  console.log('\n== B · Master Catalog with Lionel+MTH / O / Postwar+Modern ticked ==');
  T('B1  Manufacturer picker = Any + Lionel + MTH only', JSON.stringify(out.cat.mfr) === JSON.stringify(['any', 'lionel', 'mth']), out.cat.mfr);
  T('B2  Atlas (unticked, not owned in catalog view) is gone', !has(out.cat.mfr, 'atlas'), out.cat.mfr);
  T('B3  Scale picker = Any + O only', JSON.stringify(out.cat.scale) === JSON.stringify(['any', 'o']), out.cat.scale);
  T('B4  Era picker drops Pre-War, keeps Postwar + Modern', !has(out.cat.era, 'prewar') && has(out.cat.era, 'postwar') && has(out.cat.era, 'modern'), out.cat.era);

  console.log('\n== C · My Collection with the same ticks — owned is never hidden ==');
  T('C1  Manufacturer picker still offers Atlas (owned, unticked)', has(out.coll.mfr.got, 'atlas'), out.coll.mfr);
  T('C2  …and Lionel (owned + ticked)', has(out.coll.mfr.got, 'lionel'), out.coll.mfr);
  T('C3  …but not Weaver (unticked, nothing owned)', !has(out.coll.mfr.got, 'weaver'), out.coll.mfr);
  T('C4  the Atlas line carries its owned count', out.coll.mfr.labels.some(l => /^Atlas \(1\)/.test(l)), out.coll.mfr.labels);

  console.log('\n== D · planted offender — a gate that says yes to everything ==');
  T('D1  OFFENDER: every maker is offered again in the Master Catalog', out.offender_cat_mfr.filter(x => x !== 'any').length === out.allMfr, out.offender_cat_mfr);
  T('D2  real gate restored: back to Any + Lionel + MTH', JSON.stringify(out.after_cat_mfr) === JSON.stringify(['any', 'lionel', 'mth']), out.after_cat_mfr);

  T('E1  no page errors', errs.length === 0, errs);
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
