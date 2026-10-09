#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// WHAT I COLLECT = THE LINES — v0.9.1909   (real Chromium, the REAL app)
//
// Brad, 2026-10-09: the "What do you collect" screen turned on 38 lines for a
// member who ticked only Bachmann On30 — it saved the PERIOD ("Modern"), and
// three separate filters (period, maker, scale) did the rest. Preferences
// edited those three filters directly, so the setup screen and Preferences
// never agreed. His answer: one choice, everywhere.
//
//   A. one pick on the setup screen turns on exactly that line — the catalog,
//      the Master Catalog's maker / scale / period pickers and the Tools page
//      all follow it
//   B. a scale button turns on exactly that scale's lines
//   C. NOBODY'S VIEW CHANGES ON UPDATE: a save made the old way (period /
//      maker / scale lists) comes out as exactly the lines the old rule showed
//   D. setup and Preferences are the same picker: a change in one shows in
//      the other, Cancel keeps what was there, the Preferences summary says it
//   E. what a member OWNS still loads, ticked or not
//   P. planted offenders — the old period filter, a second picker list
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  collect_lines_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const rd = f => fs.readFileSync(path.join(APP, f), 'utf8');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/[^\n]*/g, '$1');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail === undefined ? null : detail)).slice(0, 500))); cond ? pass++ : fail++; }

// ── source rules, each also run on a planted offender in P ────────────────
function eraFilterIsLines(appSrc) {             // the one filter asks the lines, nothing else
  const m = strip(appSrc).match(/function _isEraEnabled\(era\) \{([\s\S]*?)\n\}/);
  return !!m && /rrCollectedLines\(\)\.indexOf\(era\)/.test(m[1]) && !/_isPeriodEnabled|_isManufacturerEnabled|_isScaleEnabled/.test(m[1]);
}
function pickerUsesOneList(obSrc) {             // the setup screen reads the SAME list + picks
  const s = strip(obSrc);
  return /rrCollectLineIds\(\)/.test(s) && /rrCollectedLines\(\)/.test(s) && !/REAL_ERA_IDS\.slice\(\)/.test(s);
}
function prefsHasNoSecondPicker(prefsSrc) {     // Preferences opens the same picker, no lists of its own
  const s = strip(prefsSrc);
  return /rrOpenCollectPicker\(\)/.test(s) && !/_togglePref(Scale|Mfr|Era)\b/.test(s) && !/Scales I Collect|Manufacturers I Collect|Eras I Collect/.test(s);
}

(async () => {
  console.log('\n== S · source rules ==');
  T('S1  _isEraEnabled asks the saved lines and nothing else', eraFilterIsLines(rd('app.js')));
  T('S2  the setup screen lists and ticks from the one owner (rrCollectLineIds / rrCollectedLines)', pickerUsesOneList(rd('onboarding.js')));
  T('S3  Preferences opens that same picker — no scale / maker / period lists of its own', prefsHasNoSecondPicker(rd('prefs.js')));

  console.log('\n== P · planted offenders ==');
  const oldFilter = rd('app.js').replace(/return rrCollectedLines\(\)\.indexOf\(era\) >= 0;/,
    "if (!_isPeriodEnabled(_eraPeriod(era))) return false; return true;");
  T('P1  the old period filter back in _isEraEnabled is caught', oldFilter !== rd('app.js') && !eraFilterIsLines(oldFilter));
  T('P2  a picker building its own list from REAL_ERA_IDS is caught', !pickerUsesOneList("var k = REAL_ERA_IDS.slice(); rrCollectedLines();"));
  T('P3  a Preferences scale list coming back is caught', !prefsHasNoSecondPicker(rd('prefs.js') + "\nfunction _togglePrefScale(s, on) {}"));

  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const pg = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(900);
  await pg.evaluate(() => {
    window.state = window.state || {};
    state.user = { email: 'lines.test@gmail.com', name: 'Lines Test' };
    state.personalData = {};
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
    window.showToast = function () {};
    window._clearCollect = function () {
      ['lv_collect_lines', 'lv_collect_lines_roster', 'lv_collect_eras', 'lv_collect_eras_roster',
       'lv_collect_mfrs', 'lv_collect_mfrs_roster', 'lv_collect_scales', 'lv_collect_scales_roster']
        .forEach(function (k) { localStorage.removeItem(k); localStorage.removeItem(k + '__at'); });
    };
    window._shown = function () { return rrCollectLineIds().filter(function (k) { return _isEraEnabled(k); }); };
  });

  // ── A. one pick ─────────────────────────────────────────────────────────
  console.log('\n== A · one pick on the setup screen ==');
  const a = await pg.evaluate(() => {
    _clearCollect();
    showFeatureMap(); onboardOptInNo();                         // step 2: What do you collect
    const box = document.querySelector('#onboarding-era-rows input[data-era="bachmann_on30"]');
    box.checked = true; onboardEraSync();
    document.getElementById('onboarding-era-save').click();     // → step 3 (install) or finish
    const ov = document.getElementById('onboarding-map-overlay'); if (ov) ov.remove();
    try { BackStack.pop('onboarding-tour'); } catch (e) {}
    return {
      saved: JSON.parse(localStorage.getItem('lv_collect_lines') || 'null'),
      shown: _shown(),
      mfrs: _getEnabledManufacturers(), scales: _getEnabledScales(), periods: _getEnabledPeriods(),
      lionelTools: _isManufacturerEnabled('lionel'),
      pickMfr: Object.keys(WHAT_I_COLLECT.MANUFACTURERS).filter(function (m) { return _phPrefAllows('manufacturer', m); }),
      pickScale: Object.keys(WHAT_I_COLLECT.SCALES).filter(function (s) { return _phPrefAllows('scale', s); }),
      pickEra: ['prewar', 'postwar', 'modern'].filter(function (p) { return _phPrefAllows('era', p); }),
    };
  });
  T('A1  ticking ONLY Bachmann On30 saves exactly that line', JSON.stringify(a.saved) === '["bachmann_on30"]', a.saved);
  T('A2  …and the catalog shows exactly ONE line (it was 43)', JSON.stringify(a.shown) === '["bachmann_on30"]', a.shown);
  T('A3  Master Catalog maker picker offers only Bachmann', JSON.stringify(a.pickMfr) === '["bachmann"]', a.pickMfr);
  T('A4  …scale picker only On30', JSON.stringify(a.pickScale) === '["on30"]', a.pickScale);
  T('A5  …period picker only Modern', JSON.stringify(a.pickEra) === '["modern"]', a.pickEra);
  T('A6  the Tools page\'s Lionel section follows too (no Lionel line collected)', a.lionelTools === false, a);

  // ── B. a scale button ───────────────────────────────────────────────────
  console.log('\n== B · a scale button picks exactly that scale ==');
  const b = await pg.evaluate(() => {
    _clearCollect();
    rrOpenCollectPicker();
    onboardScaleToggle('HO');
    rrCollectPickerSave();
    const want = rrCollectLineIds().filter(function (k) { return rrLineScales(k).indexOf('ho') >= 0; });
    return { shown: _shown(), want: want, scales: _getEnabledScales() };
  });
  T('B1  HO turns on every HO line', b.want.length > 3 && b.want.every(k => b.shown.indexOf(k) >= 0), b);
  T('B2  …and nothing else', b.shown.length === b.want.length, b.shown.filter(k => b.want.indexOf(k) < 0));
  T('B3  the scale picker then offers HO only', JSON.stringify(b.scales) === '["ho"]', b.scales);

  // ── C. the old saves convert to the SAME view ───────────────────────────
  // The old rule, written out here on its own (not borrowed from app.js): a
  // line was shown when its period, its maker and its scale were all ticked;
  // a saved period list could also hold line keys, read as their period; a
  // line with no single scale (Pre-War, Bachmann All Scales) passed the scale
  // test; a maker or scale the member never saw counted as ticked.
  console.log('\n== C · an old-style save shows the same lines it did ==');
  const c = await pg.evaluate(() => {
    function period(e) { return e === 'prewar' ? 'prewar' : ((e === 'pw' || e === 'pw_ho') ? 'pw' : 'modern'); }
    function oldRule(store) {
      const P = store.eras ? store.eras.map(function (e) { return (e === 'prewar' || e === 'pw' || e === 'modern') ? e : period(e); }) : ['prewar', 'pw', 'modern'];
      return rrCollectLineIds().filter(function (k) {
        if (P.indexOf(period(k)) < 0) return false;
        const m = (ERAS[k].manufacturer || '').toLowerCase();
        if (store.mfrs && m && store.mfrs.indexOf(m) < 0 && (store.mfrRoster || []).indexOf(m) >= 0) return false;
        const s = WHAT_I_COLLECT.ERA_TO_SCALE[k];
        if (store.scales && s && store.scales.indexOf(s) < 0 && (store.scaleRoster || []).indexOf(s) >= 0) return false;
        return true;
      });
    }
    const allM = Object.keys(WHAT_I_COLLECT.MANUFACTURERS), allS = Object.keys(WHAT_I_COLLECT.SCALES);
    const cases = {
      'setup tick, old style (Bachmann On30 only)': { eras: ['bachmann_on30'] },
      'Preferences: Postwar + Modern, Lionel + MTH, O': { eras: ['pw', 'modern'], mfrs: ['lionel', 'mth'], mfrRoster: allM, scales: ['o'], scaleRoster: allS },
      'Preferences: Pre-War only': { eras: ['prewar'] },
      'Preferences: makers only (Atlas)': { mfrs: ['atlas'], mfrRoster: allM },
      'Preferences: scales only (S + G)': { scales: ['s', 'g'], scaleRoster: allS },
    };
    const out = {};
    Object.keys(cases).forEach(function (name) {
      const st = cases[name];
      _clearCollect();
      if (st.eras) { localStorage.setItem('lv_collect_eras', JSON.stringify(st.eras)); localStorage.setItem('lv_collect_eras_roster', JSON.stringify(Object.keys(ERAS))); }
      if (st.mfrs) { localStorage.setItem('lv_collect_mfrs', JSON.stringify(st.mfrs)); localStorage.setItem('lv_collect_mfrs_roster', JSON.stringify(st.mfrRoster)); }
      if (st.scales) { localStorage.setItem('lv_collect_scales', JSON.stringify(st.scales)); localStorage.setItem('lv_collect_scales_roster', JSON.stringify(st.scaleRoster)); }
      out[name] = { now: _shown(), before: oldRule(st), wroteLines: localStorage.getItem('lv_collect_lines') };
    });
    _clearCollect();
    out.never = { now: _shown().length, all: rrCollectLineIds().length };
    return out;
  });
  Object.keys(c).filter(k => k !== 'never').forEach(function (name) {
    const r = c[name];
    T('C  ' + name + ': same ' + r.before.length + ' lines as before', JSON.stringify(r.now) === JSON.stringify(r.before), { now: r.now, before: r.before });
  });
  T('C9  converting never writes on its own (no start-up race with the account copy)', Object.keys(c).filter(k => k !== 'never').every(k => c[k].wroteLines === null));
  T('C10 a member who never chose sees everything', c.never.now === c.never.all, c.never);

  // ── D. one picker, two doors ────────────────────────────────────────────
  console.log('\n== D · setup and Preferences are the same picker ==');
  const d = await pg.evaluate(async () => {
    _clearCollect();
    rrSetCollectedLines(['pw', 'prewar']);
    document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
    document.getElementById('page-prefs').classList.add('active');
    buildPrefsPage();
    const sum1 = (document.getElementById('pref-collect-summary') || {}).innerText || '';
    const hasOld = /Scales I Collect|Manufacturers I Collect|Eras I Collect/.test(document.getElementById('page-prefs').innerText);
    document.getElementById('pref-collect-change').click();
    const ov = document.getElementById('onboarding-map-overlay');
    const head = ov ? ov.innerText.replace(/\s+/g, ' ') : '';
    const ticked1 = Array.from(document.querySelectorAll('#onboarding-era-rows input[data-era]')).filter(function (x) { return x.checked; }).map(function (x) { return x.getAttribute('data-era'); });
    // Cancel keeps what was there
    document.querySelector('#onboarding-era-rows input[data-era="atlas"]').checked = true;
    rrCollectPickerCancel();
    const afterCancel = rrCollectedLines();
    // change it from Preferences, then look through the setup door
    document.getElementById('pref-collect-change').click();
    document.querySelector('#onboarding-era-rows input[data-era="atlas"]').checked = true;
    document.querySelector('#onboarding-era-rows input[data-era="prewar"]').checked = false;
    onboardEraSync();
    document.getElementById('onboarding-era-save').click();
    const closed = !document.getElementById('onboarding-map-overlay');
    const sum2 = (document.getElementById('pref-collect-summary') || {}).innerText || '';
    showFeatureMap(); onboardOptInNo();
    const ticked2 = Array.from(document.querySelectorAll('#onboarding-era-rows input[data-era]')).filter(function (x) { return x.checked; }).map(function (x) { return x.getAttribute('data-era'); });
    const ov2 = document.getElementById('onboarding-map-overlay'); if (ov2) ov2.remove();
    return { sum1, hasOld, head, ticked1, afterCancel, closed, sum2, ticked2, saved: rrCollectedLines() };
  });
  T('D1  Preferences says what is collected', /2 of \d+ lines/.test(d.sum1) && /Lionel Postwar/.test(d.sum1) && /Lionel Pre-War/.test(d.sum1), d.sum1);
  T('D2  …and the three old lists are gone', d.hasOld === false);
  T('D3  "Change what I collect" opens the picker titled "What I collect", no step counter', /What I collect/.test(d.head) && !/STEP \d OF/i.test(d.head), d.head.slice(0, 120));
  T('D4  …with the saved lines ticked', JSON.stringify(d.ticked1.sort()) === '["prewar","pw"]', d.ticked1);
  T('D5  Cancel keeps what was there', JSON.stringify(d.afterCancel.sort()) === '["prewar","pw"]', d.afterCancel);
  T('D6  Save closes the picker and updates the summary', d.closed && /Atlas O/.test(d.sum2) && !/Pre-War/.test(d.sum2), d.sum2);
  T('D7  the setup screen then shows exactly the same ticks', JSON.stringify(d.ticked2.sort()) === JSON.stringify(d.saved.slice().sort()) && JSON.stringify(d.saved.slice().sort()) === '["atlas","pw"]', d);

  // ── E. owned always loads ───────────────────────────────────────────────
  console.log('\n== E · what you own still loads ==');
  const e = await pg.evaluate(() => {
    _clearCollect();
    rrSetCollectedLines(['pw']);
    state.personalData = { a: { owned: true, itemNum: '0326', era: 'atlas', _era: 'atlas', manufacturer: 'Atlas', inventoryId: '1' } };
    window._preferEraOf = window._preferEraOf || function (pd) { return pd.era; };
    const load = _erasToLoad(rrCollectLineIds());
    state.personalData = {};
    return { load: load, off: Array.from(_offShelfEras()).indexOf('atlas') >= 0 };
  });
  T('E1  an owned Atlas item loads Atlas O though only Postwar is ticked', e.load.indexOf('atlas') >= 0 && e.load.indexOf('pw') >= 0, e.load);
  T('E2  …while Atlas stays off the catalog shelf', e.off === true, e);

  T('Z  no page errors', errs.length === 0, errs);
  await browser.close();
  console.log('\n' + (fail ? 'FAILED  —  ' : 'ALL PASS  —  ') + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  crashed: ' + (e && e.stack || e)); process.exit(1); });
