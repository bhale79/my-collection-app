#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ANDROID TAPS THAT MISSED + "6-" NUMBERS — the road   (real Chromium, the REAL
// app, an Android phone) — 2026-11-02
//
// Both found while building Lars's set line (2026-11-01); Brad 2026-11-02 "yes".
//   T  a finger-tap (not a script click) on the "nothing found" box's buttons
//      works: "Add manually" opens Manual with the number; "Clear filters"
//      clears them and keeps the number. Android Chrome focuses a tapped
//      button, and the phone-keyboard helper used to slide it out from under
//      the finger — the tap landed on the background.
//   K  a box you TYPE into still slides up above the keyboard (unchanged)
//   N  "6-31705" typed, catalog "6-31705" → the row shows; tap it → the add
//      holds that row. "6-8359" typed, catalog "8359" → Next holds the 8359 row
//      and the add takes the catalog's form
//   P  planted in served copies: the old focus rule → T red; the old list
//      → N red
// The logic piece by piece is line_prefix_number_tests.js.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  tap_and_prefix_road_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function ok(n, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (extra || ''))); cond ? pass++ : fail++; }
function read(f) { return fs.readFileSync(path.join(APP, f), 'utf8'); }
function plant(src, from, to, label) {
  if (src.indexOf(from) < 0) throw new Error('planted offender "' + label + '" no longer matches the source — update the test');
  return src.replace(from, to);
}
const ANDROID = { viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A136U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36' };

async function openApp(browser, served) {
  const ctx = await browser.newContext(ANDROID);
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
  { itemNum: '6-31705', variation: '', itemType: 'Set', description: 'Hudson Freight Set', roadName: 'New York Central', yearProd: '1999', _era: 'mpc', _tab: 'Lionel MPC-Modern', gauge: 'O', rowId: 'MPCD31705' },
  { itemNum: '8359', variation: '', itemType: 'Diesel Locomotive', description: 'Chessie GP7', roadName: 'Chessie', yearProd: '1976', _era: 'mpc', _tab: 'Lionel MPC-Modern', gauge: 'O', rowId: 'MPC8359' },
];

async function prime(pg) {
  await pg.evaluate((ROWS) => {
    state.masterData = ROWS.map(r => Object.assign({}, r)); _rebuildMasterIndex();
    state.setData = []; state.personalData = {}; state.isData = {}; state.personalSheetId = 'SHEET'; _currentEra = 'all';
    state.user = { name: 'Brad', email: 'brad@example.com' };
    window.showToast = () => {}; window.rrMaybeShowAddHelp = () => {}; window.buildDashboard = () => {}; window.renderBrowse = () => {};
    window._getAllErasMasterForSearch = async () => {}; window._allErasSearchCache = null;
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const stepType = () => (wizard.steps[wizard.step] || {}).type;
    window.__T = {
      sleep, stepType,
      fresh: async (mfr, era) => {
        try { localStorage.setItem('lv_add_mfr', mfr || ''); localStorage.setItem('lv_add_era', era || ''); localStorage.removeItem('lv_add_scale'); } catch (e) {}
        if (typeof _doCloseWizard === 'function' && window.wizard && wizard.steps && wizard.steps.length) { try { _doCloseWizard(); } catch (e) {} }
        await openWizard('collection'); wizard.data._era = 'all'; await sleep(150);
        for (let k = 0; k < 4 && stepType() !== 'itemNumGrouping'; k++) { await wizardNext(); await sleep(120); }
      },
      // A longer Add screen (the nothing-found box with its "elsewhere" note and
      // a set line, or a small phone): room below the box, so the screen can
      // scroll the way it did when "Add as a set" missed on 2026-11-01.
      longer: () => { const b = document.getElementById('wizard-body'); const pad = document.createElement('div'); pad.style.cssText = 'height:900px;flex:none'; b.appendChild(pad); },
      type: async (v) => {
        const i = document.getElementById('wiz-input'); i.value = v;
        i.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(700);   // the list's 250 ms debounce and the 400 ms "Found" lookup, for real
      },
    };
  }, ROWS);
}
const st = (pg) => pg.evaluate(() => ({
  manual: !!wizard.data._manualEntry, manualNum: wizard.data.manualItemNum || '', item: wizard.data.itemNum || '',
  mfr: (document.getElementById('wiz-search-mfr') || {}).value, input: (document.getElementById('wiz-input') || {}).value,
  rows: Array.from(document.querySelectorAll('#wiz-suggestions [data-idx]')).map(r => (r.querySelector('span') || {}).textContent),
  nf: !!document.querySelector('#wiz-suggestions [data-nothing-found]'),
  held: wizard.matchedItem ? wizard.matchedItem.rowId : null, step: (wizard.steps[wizard.step] || {}).type,
  mobile: !!window.IS_MOBILE_UA,
}));

async function road(pg) {
  const R = {};
  await prime(pg);
  // T: Add manually, by finger
  await pg.evaluate(async () => { await __T.fresh('Lionel', 'postwar'); await __T.type('1511'); __T.longer(); });
  R.t0 = await st(pg);
  if (await pg.locator('[data-nf-btn="manual"]').count()) { await pg.tap('[data-nf-btn="manual"]'); await pg.waitForTimeout(600); }
  R.t1 = await st(pg);
  // T: Clear filters, by finger
  await pg.evaluate(async () => { await __T.fresh('Lionel', 'postwar'); await __T.type('1511'); __T.longer(); });
  if (await pg.locator('[data-nf-btn="clear"]').count()) { await pg.tap('[data-nf-btn="clear"]'); await pg.waitForTimeout(700); }
  R.t2 = await st(pg);
  // K: a box you type into still slides up
  R.k = await pg.evaluate(async () => {
    const body = document.getElementById('wizard-body');
    const pad = document.createElement('div'); pad.style.height = '1400px';
    const box = document.createElement('input'); box.type = 'text'; box.id = 'k-box';
    const btn = document.createElement('button'); btn.type = 'button'; btn.id = 'k-btn'; btn.textContent = 'x';
    body.appendChild(pad); body.appendChild(box); body.appendChild(btn); body.appendChild(document.createElement('div')).style.height = '1400px';
    btn.scrollIntoView({ block: 'end' }); const b0 = body.scrollTop;
    btn.focus(); await __T.sleep(60); const btnMoved = body.scrollTop !== b0;
    box.scrollIntoView({ block: 'end' }); const t0 = body.scrollTop;
    box.focus(); await __T.sleep(60); const boxMoved = body.scrollTop !== t0;
    return { btnMoved, boxMoved };
  });
  // N: "6-31705" by finger
  await pg.evaluate(async () => { await __T.fresh('', ''); await __T.type('6-31705'); });
  R.n1 = await st(pg);
  const row = pg.locator('#wiz-suggestions [data-idx]').first();
  if (await row.count()) { await row.tap(); await pg.waitForTimeout(700); }
  R.n2 = await st(pg);
  // N: "6-8359" and Next
  await pg.evaluate(async () => { await __T.fresh('', ''); await __T.type('6-8359'); wizard.data.itemNum = '6-8359'; await wizardNext(); await __T.sleep(300); });
  R.n3 = await st(pg);
  return R;
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const t0 = Date.now();
  {
    const { ctx, pg, errs } = await openApp(browser, null);
    const R = await road(pg).catch(e => ({ err: String(e && e.stack || e) }));
    if (R.err) ok('the road runs', false, R.err);
    else {
      ok('T0 the app takes this for a phone; Lionel · Postwar · 1511 → nothing found', R.t0.mobile && R.t0.nf && R.t0.rows.length === 0, JSON.stringify(R.t0));
      ok('T1 a finger-tap on "Add manually" opens Manual with 1511 (was: the tap missed)', R.t1.manual && R.t1.manualNum === '1511', JSON.stringify(R.t1));
      ok('T2 a finger-tap on "Clear filters" clears them and keeps 1511', R.t2.mfr === '' && R.t2.input === '1511' && R.t2.rows.length >= 1, JSON.stringify(R.t2));
      ok('K1 a box you type into still slides up above the keyboard', R.k.boxMoved, JSON.stringify(R.k));
      ok('K2 a button does not move when it takes focus', !R.k.btnMoved, JSON.stringify(R.k));
      ok('N1 "6-31705" typed, catalog "6-31705" → the row shows (was: nothing found)', R.n1.rows.join() === '6-31705' && !R.n1.nf, JSON.stringify(R.n1));
      ok('N2 tap it → the add holds that row', R.n2.held === 'MPCD31705', JSON.stringify(R.n2));
      ok('N3 "6-8359" typed, catalog "8359" → Next holds the 8359 row, in the catalog\'s form', R.n3.held === 'MPC8359' && R.n3.item === '8359' && R.n3.step !== 'itemPicker', JSON.stringify(R.n3));
      ok('L1 no page errors', errs.length === 0, errs.join(' | '));
    }
    await ctx.close();
  }
  {
    const served = { 'wizard.js': plant(read('wizard.js'), '      if (!_wizIsTypingField(e.target)) return;\n', '', 'old focus rule') };
    const { ctx, pg } = await openApp(browser, served);
    await prime(pg);
    await pg.evaluate(async () => { await __T.fresh('Lionel', 'postwar'); await __T.type('1511'); __T.longer(); });
    if (await pg.locator('[data-nf-btn="manual"]').count()) { await pg.tap('[data-nf-btn="manual"]'); await pg.waitForTimeout(600); }
    const s = await st(pg);
    ok('P1 PLANTED the old focus rule: T1 can fail (the "Add manually" tap misses)', !s.manual, JSON.stringify(s));
    await ctx.close();
  }
  {
    const served = { 'wizard-suggestions.js': plant(read('wizard-suggestions.js'), ' && rrNumLinePrefixOff(p) !== _searchNum', '', 'old list') };
    const { ctx, pg } = await openApp(browser, served);
    await prime(pg);
    await pg.evaluate(async () => { await __T.fresh('', ''); await __T.type('6-31705'); });
    const s = await st(pg);
    ok('P2 PLANTED the old list: N1 can fail ("6-31705" finds nothing)', s.rows.length === 0, JSON.stringify(s));
    await ctx.close();
  }
  await browser.close();
  console.log('\n(' + Math.round((Date.now() - t0) / 1000) + ' s) ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
