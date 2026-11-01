#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// A LIONEL POSTWAR SET NUMBER TYPED IN THE ITEM BOX — the road
// (real Chromium, the REAL app, iPhone size) — 2026-11-01
//
// [stated] Brad 16:11 CT: "no, he tried to enter a set as an item number" —
// Lars typed 1467W in Add → Cataloged Item and got nowhere. 16:12 / 16:25 CT
// "yes". The set list here: 1467W (two variants) and 2500WS (one).
//   R  Lars's road: type 1467W → the SET row (LIONEL · POSTWAR + SET) → tap it →
//      the set flow on 1467W, its "which version?" picker → tap a version →
//      the set's details screen with its pieces (nothing retyped)
//   O  2500WS → tap → straight to that set's details screen (one variant)
//   N  Lionel · Pre-War + 1467W → nothing found + "1467W is a Lionel Postwar set
//      — add it as a set?" → press "Add as a set" → the set flow on 1467W
//   L  the SET row fits an iPhone: no sideways scroll, nothing overlaps
//   P  planted: the item box's set check switched off in a served copy → R red
// The logic, piece by piece, is set_number_item_box_tests.js.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  set_number_item_box_road_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function ok(n, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (extra || ''))); cond ? pass++ : fail++; }
function read(f) { return fs.readFileSync(path.join(APP, f), 'utf8'); }
function plant(src, from, to, label) {
  if (src.indexOf(from) < 0) throw new Error('planted offender "' + label + '" no longer matches the source — update the test');
  return src.replace(from, to);
}
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' };

async function openApp(browser, served) {
  const ctx = await browser.newContext(PHONE);
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
  { itemNum: '2343', variation: '', itemType: 'Diesel Locomotive', description: 'Santa Fe F3', roadName: 'Santa Fe', yearProd: '1950', _era: 'pw', _tab: 'Lionel PW - Items', gauge: 'O', rowId: 'PW2343' },
  { itemNum: '1467', variation: '', itemType: 'Accessory', description: 'Pre-War accessory', roadName: '', yearProd: '1938', _era: 'prewar', _tab: 'Lionel Pre-War', gauge: 'O', rowId: 'PRE1467' },
];
const SETS = [
  { setNum: '1467W', setName: 'Erie Freight', year: '1952', gauge: 'O27', price: '', items: ['2032', '2032C', '6656', '6456', '6457'], alts: [], notes: '' },
  { setNum: '1467W', setName: 'Erie Freight', year: '1953', gauge: 'O27', price: '', items: ['2032', '2032C', '6656', '6456', '6456', '6457'], alts: [], notes: '' },
  { setNum: '2500WS', setName: 'Freight', year: '1952', gauge: 'O', price: '', items: ['671', '2046W', '2461', '6456', '6457'], alts: [], notes: '' },
];

// the page's own helpers, installed once per page
async function prime(pg) {
  await pg.evaluate(([ROWS, SETS]) => {
    state.masterData = ROWS.map(r => Object.assign({}, r)); _rebuildMasterIndex();
    state.setData = SETS.map(s => JSON.parse(JSON.stringify(s)));
    state.personalData = {}; state.isData = {}; state.personalSheetId = 'SHEET'; _currentEra = 'all';
    state.user = { name: 'Lars', email: 'lars@example.com' };
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
        Array.from(document.body.children).filter(e => /Which version\?/.test(e.textContent || '')).forEach(o => o.remove());
        if (typeof _doCloseWizard === 'function' && window.wizard && wizard.steps && wizard.steps.length) { try { _doCloseWizard(); } catch (e) {} }
        await openWizard('collection'); wizard.data._era = 'all'; await sleep(150);
        for (let k = 0; k < 4 && stepType() !== 'itemNumGrouping'; k++) { await wizardNext(); await sleep(120); }
      },
      type: async (v) => {
        const i = document.getElementById('wiz-input'); i.value = v;
        i.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(700);   // the list's own 250 ms debounce and the 400 ms "Found" lookup, for real
      },
    };
  }, [ROWS, SETS]);
}
const look = (pg) => pg.evaluate(() => {
  const s = document.getElementById('wiz-suggestions');
  const setRow = s && s.querySelector('[data-set-tag]') ? s.querySelector('[data-set-tag]').closest('[data-idx]') : null;
  const ov = Array.from(document.body.children).filter(e => /Which version\?/.test(e.textContent || '')).pop();
  const body = document.getElementById('wizard-body') || document.getElementById('wizard-modal');
  return {
    step: (wizard.steps[wizard.step] || {}).id || '', tab: wizard.tab,
    setRow: setRow ? { num: (setRow.querySelector('span') || {}).textContent, tags: Array.from(setRow.querySelectorAll('[data-row-tag]')).map(t => t.textContent),
      set: (setRow.querySelector('[data-set-tag]') || {}).textContent, details: ((setRow.querySelector('.wiz-sug-details') || {}).textContent || '') } : null,
    rows: s ? s.querySelectorAll('[data-idx]').length : -1,
    nfSet: s && s.querySelector('[data-nf-line="set"]') ? s.querySelector('[data-nf-line="set"]').textContent : '',
    overlay: ov ? ov.textContent.replace(/\s+/g, ' ').trim() : '',
    screen: body ? body.textContent.replace(/\s+/g, ' ').trim().slice(0, 400) : '',
    setNum: wizard.data.set_num || '', resolved: wizard.data._resolvedSet ? wizard.data._resolvedSet.setNum + '/' + wizard.data._resolvedSet.year : '',
    pieces: (wizard.data._setFinalItems || []).length,
    sideScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
    rowWide: setRow ? setRow.getBoundingClientRect().right > window.innerWidth + 1 : false,
    overlap: (() => {
      if (!setRow) return false;
      const parts = Array.from(setRow.querySelectorAll('.wiz-sug-l1 > *')).filter(e => e.offsetWidth && !e.classList.contains('wiz-sug-spacer')).map(e => e.getBoundingClientRect());
      for (let a = 0; a < parts.length; a++) for (let b = a + 1; b < parts.length; b++) {
        const A = parts[a], B = parts[b];
        if (A.left < B.right - 1 && B.left < A.right - 1 && A.top < B.bottom - 1 && B.top < A.bottom - 1) return true;
      }
      return false;
    })(),
  };
});

async function road(pg) {
  const R = {};
  await prime(pg);
  // ── R: Lars's road ──
  await pg.evaluate(async () => { await __T.fresh('', ''); await __T.type('1467W'); });
  R.r1 = await look(pg);
  if (R.r1.setRow) {
    await pg.tap('[data-set-tag="1467W"]');
    await pg.waitForTimeout(500);
    R.r2 = await look(pg);
    const v = pg.locator('button', { hasText: '1953 · O27' }).first();
    if (await v.count()) { await v.tap(); await pg.waitForTimeout(500); }
    R.r3 = await look(pg);
  }
  // ── O: one variant ──
  await pg.evaluate(async () => { await __T.fresh('', ''); await __T.type('2500WS'); });
  R.o1 = await look(pg);
  if (R.o1.setRow) { await pg.tap('[data-set-tag="2500WS"]'); await pg.waitForTimeout(600); }
  R.o2 = await look(pg);
  // ── N: hidden by a filter ──
  await pg.evaluate(async () => { await __T.fresh('Lionel', 'prewar'); await __T.type('1467W'); });
  R.n1 = await look(pg);
  // Pressed, not tapped: Chromium focuses a tapped <button> (iPhone Safari does
  // not), and the wizard's phone keyboard helper (focusin → _wizScrollFieldIntoView,
  // wizard.js) then scrolls it out from under the finger — the click lands on the
  // wizard body. That is older than this build and hits "Clear filters" / "Add
  // manually" the same way; it is reported to Brad on its own, not changed here.
  if (R.n1.nfSet) { await pg.evaluate(() => document.querySelector('[data-nf-btn="set"]').click()); await pg.waitForTimeout(500); }
  R.n2 = await look(pg);
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
      const r1 = R.r1.setRow || {};
      ok('R1 iPhone: type 1467W → a SET row for 1467W', r1.num === '1467W' && r1.set === 'SET', JSON.stringify(R.r1.setRow));
      ok('R2 … tagged LIONEL · POSTWAR, with name · years · pieces · versions', (r1.tags || []).join('|') === 'LIONEL · POSTWAR' && r1.details === 'Erie Freight · 1952, 1953 · 5–6 pieces · 2 versions', JSON.stringify(r1));
      ok('R3 tap it → the set flow on 1467W, asking which version', R.r2 && R.r2.tab === 'set' && R.r2.setNum === '1467W' && /Set 1467W — Which version\?/.test(R.r2.overlay), JSON.stringify(R.r2 && [R.r2.tab, R.r2.setNum, R.r2.overlay.slice(0, 80)]));
      ok('R4 tap the 1953 version → the set\'s details screen with its 6 pieces, nothing retyped', R.r3 && R.r3.step === 'set_entryMode' && R.r3.resolved === '1467W/1953' && R.r3.pieces === 6
        && /1467W — Erie Freight/.test(R.r3.screen) && /6 items/.test(R.r3.screen), JSON.stringify(R.r3 && [R.r3.step, R.r3.resolved, R.r3.pieces, R.r3.screen.slice(0, 120)]));
      ok('O1 2500WS → tap → straight to that set\'s details screen (one version, no picker)', R.o2.step === 'set_entryMode' && R.o2.resolved === '2500WS/1952' && R.o2.pieces === 5 && !R.o2.overlay && /2500WS — Freight/.test(R.o2.screen),
        JSON.stringify([R.o2.step, R.o2.resolved, R.o2.pieces, R.o2.overlay.slice(0, 60)]));
      ok('N1 Lionel · Pre-War + 1467W → nothing found + "1467W is a Lionel Postwar set — add it as a set?"', R.n1.rows === 0 && /^1467W is a Lionel Postwar set — add it as a set\?\s*Add as a set$/.test(R.n1.nfSet.trim()), R.n1.nfSet);
      ok('N2 press "Add as a set" → the set flow on 1467W (its version picker)', R.n2.tab === 'set' && R.n2.setNum === '1467W' && /Which version\?/.test(R.n2.overlay), JSON.stringify([R.n2.tab, R.n2.setNum]));
      ok('L1 the SET row fits the iPhone: no sideways scroll, nothing overlaps', !R.r1.sideScroll && !R.r1.rowWide && !R.r1.overlap, JSON.stringify([R.r1.sideScroll, R.r1.rowWide, R.r1.overlap]));
      ok('L2 no page errors', errs.length === 0, errs.join(' | '));
    }
    await ctx.close();
  }
  // ── P: the set check switched off in a served copy → R goes red ──
  {
    const served = { 'wizard-suggestions.js': plant(read('wizard-suggestions.js'), '    if (startsWithDigit && _wizSetCheckOn()) {', '    if (false) {', 'set check off') };
    const { ctx, pg } = await openApp(browser, served);
    await prime(pg);
    await pg.evaluate(async () => { await __T.fresh('', ''); await __T.type('1467W'); });
    const L = await look(pg);
    ok('P1 PLANTED the item box without its set check: R1 can fail (no SET row for 1467W)', !L.setRow);
    await ctx.close();
  }
  await browser.close();
  console.log('\n(' + Math.round((Date.now() - t0) / 1000) + ' s) ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
