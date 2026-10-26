#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// PIECES, THE ITEM COUNT, AND GOOGLE PHOTOS PERMISSION — v0.9.2026
// (real Chromium, the REAL app; Chrome's pop-up blocker switched ON)
//
// Two York customers (2026-10-25), Brad "yes":
//  • Each added ONE MTH engine and the app said 2 items, the second under
//    Lionel Postwar. Measured: the engine's instruction sheet was saved as its
//    own row with NO era and NO maker; the counter (_ownedNonBox, dashboard.js)
//    counted it, and _eraOf filed a blank row under Postwar. The box row was
//    also saved blank, and an MTH engine's master carton was saved "Lionel".
//  • "Google Photos permission was not granted — where do I give permission?"
//    rrGPhotosPickSession (drive.js) opened its Photos tab first; a browser
//    lets one click open ONE window, so Google's permission window was blocked
//    and the answer came back "not granted" for every account without the
//    permission already.
//
//   A  one MTH engine added with box + sheet + master carton counts ONE item,
//      under MTH; every piece row is saved with the engine's era and maker
//   B  a grouped sheet saved by an older release (blank era) no longer counts;
//      a sheet on its own (no group) still does
//   C  From Google Photos with no permission yet: Google's permission window
//      OPENS (the browser does not block it), our tab is not opened first, and
//      the "Open Google Photos" button is offered with the permission words
//   D  with the permission already on the pass: the Photos tab opens straight
//      from the click, as before, and no permission window is asked for
//   P  planted offenders — each fix undone in a served copy turns its check red
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  piece_count_photos_2026_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
let pass = 0, fail = 0;
function ok(n, cond, extra) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + (extra || ''))); cond ? pass++ : fail++; }

async function openApp(browser, served) {
  const ctx = await browser.newContext();
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await ctx.route('**', r => {
    const u = r.request().url();
    if (/photospicker\.googleapis\.com\/v1\/sessions/.test(u) && r.request().method() === 'POST') {
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'S1', pickerUri: 'https://photos.google.com/picker/S1', pollingConfig: { pollInterval: '2s' } }) });
    }
    if (/photospicker\.googleapis\.com\/v1\/sessions\/S1/.test(u)) {
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'S1', mediaItemsSet: false }) });
    }
    if (!u.startsWith('file://') && !u.startsWith('about:')) return r.abort();
    const name = u.split('?')[0].split('/').pop();
    if (served && served[name] != null) return r.fulfill({ body: served[name], contentType: 'application/javascript' });
    return r.continue();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(800);
  return { ctx, pg, errs };
}

async function counts(pg) {
  return pg.evaluate(async () => {
    const MTH = Object.keys(ERAS).find(k => ERAS[k].manufacturer === 'MTH' && !ERAS[k].partsOfficial);
    state.masterData = [{ itemNum: '30-1234-1', variation: '', itemType: 'Steam', _era: MTH, _tab: ERAS[MTH].prefix, yearProd: '2001', description: '4-6-2 Pacific', roadName: 'Pennsylvania' }];
    _rebuildMasterIndex(); state.personalData = {}; state.isData = {}; state.personalSheetId = 'S'; _currentEra = 'all';
    const rows = [];
    window.sheetsAppend = async (id, r, v) => { rows.push(v[0]); return 10 + rows.length; };
    window.rrVerifiedRowUpdate = async () => true; window.rrRowStillIs = async () => true;
    window.driveEnsureSetup = async () => {}; window.driveEnsureItemFolder = async () => 'F'; window.driveUploadPhoto = async () => ({});
    window.buildDashboard = () => {}; window.renderBrowse = () => {}; window.showToast = () => {}; window.rrMaybeShowAddHelp = () => {};
    document.getElementById('app').classList.add('active');
    await openWizard('collection');
    Object.assign(wizard.data, { itemNum: '30-1234-1', variation: '', _itemGrouping: 'single', condition: 8, allOriginal: 'Yes',
      hasBox: 'Yes', boxCond: 7, hasIS: 'Yes', is_condition: 7, hasMasterBox: 'Yes', masterBoxCond: 6, isError: 'No' });
    wizard.matchedItem = state.masterData[0];
    await saveWizardItem();
    const F = PERSONAL_FIELD_INDEX, c = (r, f) => String(r[F[f]] == null ? '' : r[F[f]]).replace(/^'/, '');
    const R = { mth: MTH, rows: {} };
    rows.forEach(r => { R.rows[c(r, 'itemNum')] = { era: c(r, 'era'), mfr: c(r, 'manufacturer') }; });
    const owned = () => _ownedNonBox(state);
    const byEra = () => { const o = {}; owned().forEach(p => { const e = _eraOf(p); o[e] = (o[e] || 0) + 1; }); return o; };
    R.counted = owned().map(p => p.itemNum); R.byEra = byEra();
    // B — an older release's sheet row: grouped, blank era and maker
    const gid = (Object.values(state.personalData).find(p => p.itemNum === '30-1234-1') || {}).groupId || 'G';
    state.personalData.old = { owned: true, itemNum: '6464-1-IS', era: '', manufacturer: '', groupId: gid, inventoryId: '90' };
    state.personalData.solo = { owned: true, itemNum: '1666-IS', era: 'pw', manufacturer: 'Lionel', groupId: '', inventoryId: '91' };
    R.countedB = owned().map(p => p.itemNum).sort();
    return R;
  });
}

// C/D — click a real button in the page; the "permission window" is a real
// window.open from inside the stand-in permission ask, as Google's library does.
async function photos(pg, hasScope) {
  await pg.evaluate((has) => {
    window._log = []; window._permWin = null;
    window._rrPassHasScope = () => has;
    window._ensurePhotosScope = () => new Promise(res => {
      if (window._rrPassHasScope()) return res(true);   // as the app's own: a pass that has it asks nothing
      const w = window.open('about:blank', 'gperm'); window._permWin = !!w; window._log.push('perm:' + (w ? 'opened' : 'BLOCKED'));
      res(!!w);
    });
    window.accessToken = 'T';
    const _open = window.open.bind(window);
    window.open = function (u, n) { const w = _open(u, n); if (n !== 'gperm') window._log.push('tab:' + (u || 'blank') + ':' + (w ? 'opened' : 'BLOCKED')); return w; };
    const b = document.createElement('button'); b.id = 'gp-test'; b.textContent = 'From Google Photos';
    b.style.cssText = 'position:fixed;top:5px;left:5px;z-index:999999';
    b.onclick = () => {
      window._need = null; window._abort = false;
      rrGPhotosPickSession({ shouldAbort: () => window._abort, onNeedTab: (u, info) => { window._need = { u: u, askedFirst: !!(info && info.askedFirst) }; } })
        .then(r => { window._res = r; });
    };
    document.body.appendChild(b);
  }, hasScope);
  await pg.click('#gp-test');
  await pg.waitForTimeout(1500);
  const R = await pg.evaluate(() => ({ log: window._log.slice(), perm: window._permWin, need: window._need }));
  await pg.evaluate(() => { window._abort = true; });
  if (!hasScope) {
    // the waiting panel's own words when the late tab IS blocked
    await pg.evaluate(() => {
      const _o = window.open; window.open = function (u, n) { if (/photos\.google\.com/.test(String(u || ''))) return null; return _o.apply(window, arguments); };
      const b = document.createElement('button'); b.id = 'gp-files'; b.textContent = 'files'; b.style.cssText = 'position:fixed;top:40px;left:5px;z-index:2147483647';
      b.onclick = () => { window._pfGone = false; rrGPhotosPickFiles({ max: 1, shouldAbort: () => window._pfGone }).then(() => {}); };
      document.body.appendChild(b);
    });
    await pg.click('#gp-files', { force: true });
    await pg.waitForTimeout(1500);
    R.panel = await pg.evaluate(() => {
      const st = document.querySelector('[data-gpw="stage"]'), bt = document.querySelector('[data-gpw="reopen"]');
      const out = { stage: st ? st.textContent : null, want: RR_GPHOTOS_WAIT.permitted, btn: !!(bt && bt.style.display !== 'none') };
      window._pfGone = true; return out;
    });
  }
  return R;
}

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  // Playwright turns Chrome's pop-up blocker OFF by default; switch it back on.
  const browser = await chromium.launch(Object.assign(fs.existsSync(ex) ? { executablePath: ex } : {}, { ignoreDefaultArgs: ['--disable-popup-blocking'] }));
  async function scenario(served) {
    const o = await openApp(browser, served);
    let A = null, C = null, D = null;
    try { A = await counts(o.pg); } catch (e) { A = { err: String(e) }; }
    try { C = await photos(o.pg, false); } catch (e) { C = { err: String(e) }; }
    await o.ctx.close();
    const o2 = await openApp(browser, served);
    try { D = await photos(o2.pg, true); } catch (e) { D = { err: String(e) }; }
    const errs = o.errs.concat(o2.errs);
    await o2.ctx.close();
    return { A, C, D, errs };
  }
  const { A, C, D, errs } = await scenario(null);
  const r = (n) => (A.rows || {})[n] || {};
  const mthEra = (e) => e === A.mth;

  // sanity: the harness really blocks a second window from one click
  ok('harness: Chrome\u2019s pop-up blocker is on (one click cannot open two windows)',
     await (async () => {
       const o = await openApp(browser);
       await o.pg.evaluate(() => { const b = document.createElement('button'); b.id = 'two'; b.textContent = 'two'; b.style.cssText = 'position:fixed;top:5px;left:5px;z-index:999999';
         b.onclick = () => { window._w1 = !!window.open('about:blank', 'a1'); window._w2 = !!window.open('about:blank', 'a2'); }; document.body.appendChild(b); });
       await o.pg.click('#two'); await o.pg.waitForTimeout(300);
       const v = await o.pg.evaluate(() => [window._w1, window._w2]); await o.ctx.close();
       return v[0] === true && v[1] === false;
     })());
  ok('A1 one MTH engine with box, sheet and master carton counts ONE item', JSON.stringify(A.counted) === '["30-1234-1"]', JSON.stringify(A.counted));
  ok('A2 …and it counts under MTH only (nothing under Lionel Postwar)', JSON.stringify(A.byEra) === JSON.stringify({ [A.mth]: 1 }), JSON.stringify(A.byEra));
  ok('A3 the instruction sheet row carries the engine’s era and maker', mthEra(r('30-1234-1-IS').era) && r('30-1234-1-IS').mfr === 'MTH', JSON.stringify(r('30-1234-1-IS')));
  ok('A4 the box row carries the engine’s era and maker', mthEra(r('30-1234-1-BOX').era) && r('30-1234-1-BOX').mfr === 'MTH', JSON.stringify(r('30-1234-1-BOX')));
  ok('A5 the master carton row is MTH, not Lionel', mthEra(r('30-1234-1-MBOX').era) && r('30-1234-1-MBOX').mfr === 'MTH', JSON.stringify(r('30-1234-1-MBOX')));
  ok('A6 the engine row itself is unchanged (MTH, its era)', mthEra(r('30-1234-1').era) && r('30-1234-1').mfr === 'MTH', JSON.stringify(r('30-1234-1')));
  ok('B1 an older release’s grouped sheet (blank era) no longer counts; a sheet on its own still does',
     JSON.stringify(A.countedB) === JSON.stringify(['1666-IS', '30-1234-1']), JSON.stringify(A.countedB));
  ok('C1 no permission yet: Google’s permission window opens (not blocked)', C.perm === true, JSON.stringify(C.log));
  ok('C2 …and our Photos tab was not opened ahead of it', (C.log || [])[0] === 'perm:opened', JSON.stringify(C.log));
  ok('C3 \u2026then Google Photos is reached: its tab opens, or "Open Google Photos" is offered with the permission words',
     (C.log || []).some(l => /^tab:https:\/\/photos\.google\.com\/picker\/S1.*:opened$/.test(l)) || !!(C.need && C.need.askedFirst && /picker\/S1/.test(C.need.u)),
     JSON.stringify(C.need) + ' ' + JSON.stringify(C.log));
  ok('C3b when the browser blocks that tab, the waiting panel says the permission is set and shows the Open button', C.panel && C.panel.stage === C.panel.want && C.panel.btn, JSON.stringify(C.panel));
  ok('C4 the waiting panel has the permission words in RR_GPHOTOS_WAIT', /permission is set/.test(fs.readFileSync(path.join(APP, 'config.js'), 'utf8')));
  ok('D1 permission already on the pass: the Photos tab opens from the click', (D.log || [])[0] === 'tab:blank:opened', JSON.stringify(D.log));
  ok('D2 …and no permission window is asked for', D.perm === null && !(D.log || []).some(l => /^perm/.test(l)), JSON.stringify(D.log));
  const appErrs = errs.filter(e => !/fonts|Failed to fetch|net::|ERR_/i.test(e));
  ok('no page errors', appErrs.length === 0, appErrs.slice(0, 3).join(' | '));

  // ── P — planted offenders ──
  const src = (n) => fs.readFileSync(path.join(APP, n), 'utf8');
  const plant = (n, from, to) => { const s = src(n); if (s.indexOf(from) < 0) throw new Error('plant anchor missing in ' + n + ': ' + from.slice(0, 60)); return { [n]: s.split(from).join(to) }; };
  const plants = [
    ['P1 the grouped sheet counted again (old counter)', plant('dashboard.js', "if (_n176.endsWith('-IS') && String(pd.groupId || '').trim()) return false;", ''), x => JSON.stringify(x.A.counted) === '["30-1234-1"]'],
    ['P2 the sheet saved with no era (old save)', plant('wizard-save.js', "          era: _resolveSaveEra(),   // v0.9.2026: the item's era (its maker follows", "          // v0.9.2026: the item's era (its maker follows"), x => mthEra((x.A.rows['30-1234-1-IS'] || {}).era)],
    ['P3 a piece takes the era view’s maker (old row builder)', plant('app.js', 'if (!_mb && typeof _brandOfItem === \'function\' && _pieceOf) {', 'if (false) {'), x => (x.A.rows['30-1234-1-MBOX'] || {}).mfr === 'MTH'],
    ['P5 each poll overwrites "press Open Google Photos" (old panel)', plant('drive.js', "onStatus: function () { if (!panel.needTab) panel.stage('waiting'); },", "onStatus: function () { panel.stage('waiting'); },"), x => !!(x.C.panel && x.C.panel.stage === x.C.panel.want)],
    ['P4 the Photos tab opened before the permission window (old picker)', plant('drive.js', 'if (!_askFirst) { try { tab = window.open', 'if (true) { try { tab = window.open'), x => x.C.perm === true],
  ];
  for (const [name, served, check] of plants) {
    let x = null;
    try { x = await scenario(served); } catch (e) { x = null; }
    let still = false; try { still = !!(x && check(x)); } catch (e) { still = false; }
    ok(name + ' — caught', !still, 'the check still passed');
  }
  await browser.close();
  console.log((fail ? 'FAILED' : 'GREEN') + '  piece_count_photos_2026_tests  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
