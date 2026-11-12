#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// A TYPED LIONEL POSTWAR SET NUMBER MEANS THE SET — 2026-11-11
// (real Chromium, the REAL app, iPhone size)
//
// Hand-test T-2026-11-01-08 notes (WAITING.md, 2026-11-08); [stated] Brad
// 2026-11-11 06:42 CT "yes" to the fix:
//   - typing 1467W listed the set AND its old catalog copy ("Erie Alco Freight
//     Set" — the PW Items tab's Set row): two rows for one set
//   - 2503WS said "Found: Paper" — its only catalog row is the set's BOX
//   - found while checking: Next without a tap took that box row and started
//     adding the set's box as a paper item
// Now: when a Postwar set has exactly the typed number inside the filters, and
// no OTHER catalog row has it, the number IS the set — one row, the green line
// names the set, Next opens the set. A real item with the same number (another
// maker, another kind) still wins and is still listed.
//   L  the list: 1467W → ONE row, the set's; its old copy gone
//   F  the green line: 2500WS → "Found: Lionel Postwar set 2500WS · Freight ·
//      1952 · 5 pieces", never "Paper"; 1467W → the set's words too
//   N  Next without a tap: 2500WS → the set's details screen; 1467W → its
//      "which version?" picker
//   K  kept as before: a real item sharing the number (9999W, MTH) is listed, is
//      the green line, and Next stays an item add; Lionel · Pre-War + 2500WS →
//      Next is no set; Box Only + 2500WS → the box row, no set
//      2026-11-11 review: an unloaded maker's row (all-eras rows) or a TAPPED row
//      still wins;
//      an old "as typed" choice for another number does not stick; "lionel
//      2500WS" works; "1467-w" lists only the set; the sets arriving late
//      still turn the green line into the set
//      (Next on a Box Only add throws inside this test's stand-in step list —
//      the same on the live code; the test only asks that no set opens)
//   P  planted offenders in a served copy, each turns its own check red
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  set_typed_is_set_tests needs playwright and it is not installed.'); process.exit(1); }
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

// The catalog rows as the live sheet has them (checked 2026-11-10 in Brad's app):
// 1467W has a PW Items "Set" row AND a PW Boxes row; 2503WS (here 2500WS) only
// a PW Boxes row. 9999W is a made-up set number that an MTH item shares.
const ROWS = [
  { itemNum: '2343', variation: '', itemType: 'Diesel Locomotive', description: 'Santa Fe F3', roadName: 'Santa Fe', yearProd: '1950', _era: 'pw', _tab: 'Lionel PW - Items', gauge: 'O', rowId: 'PW2343' },
  { itemNum: '1467W', variation: '', itemType: 'Set', description: 'Erie Alco Freight Set', roadName: '', yearProd: '1952', _era: 'pw', _tab: 'Lionel PW - Items', gauge: 'O27', rowId: 'PW1467W' },
  { itemNum: '1467W', variation: '', itemType: 'Paper / Box / Misc', description: 'Union Pacific Freight Set', roadName: '', yearProd: '', _era: 'pw', _tab: 'Lionel PW - Boxes', gauge: '', rowId: 'PWB1467W' },
  { itemNum: '2500WS', variation: '', itemType: 'Paper / Box / Misc', description: 'Super O Steam Freight Set', roadName: '', yearProd: '', _era: 'pw', _tab: 'Lionel PW - Boxes', gauge: '', rowId: 'PWB2500WS' },
  { itemNum: '9999W', variation: '', itemType: 'Accessory', description: 'Test Water Tower', roadName: '', yearProd: '2005', _era: 'mth_o', _tab: 'MTH O', manufacturer: 'MTH', gauge: 'O', rowId: 'MTH9999W' },
];
const SETS = [
  { setNum: '1467W', setName: 'Erie Freight', year: '1952', gauge: 'O27', price: '', items: ['2032', '2032C', '6656', '6456', '6457'], alts: [], notes: '' },
  { setNum: '1467W', setName: 'Erie Freight', year: '1953', gauge: 'O27', price: '', items: ['2032', '2032C', '6656', '6456', '6456', '6457'], alts: [], notes: '' },
  { setNum: '2500WS', setName: 'Freight', year: '1952', gauge: 'O', price: '', items: ['671', '2046W', '2461', '6456', '6457'], alts: [], notes: '' },
  { setNum: '9999W', setName: 'Made-up Freight', year: '1955', gauge: 'O27', price: '', items: ['2343', '6456'], alts: [], notes: '' },
  { setNum: '8888W', setName: 'Another Freight', year: '1956', gauge: 'O27', price: '', items: ['2343'], alts: [], notes: '' },
];
// an MTH item with a set's number, in a catalog the collector has NOT loaded —
// it reaches the list only through the all-eras widening
const OTHER_ERA = [
  { itemNum: '8888W', variation: '', itemType: 'Accessory', description: 'Unloaded Maker Tower', roadName: '', yearProd: '2006', _era: 'mth_o', _tab: 'MTH O', manufacturer: 'MTH', gauge: 'O', rowId: 'MTH8888W' },
];

async function prime(pg) {
  await pg.evaluate(([ROWS, SETS, OTHER_ERA]) => {
    window.__OTHER_ERA = OTHER_ERA;
    state.masterData = ROWS.map(r => Object.assign({}, r)); _rebuildMasterIndex();
    state.setData = SETS.map(s => JSON.parse(JSON.stringify(s)));
    state.personalData = {}; state.isData = {}; state.personalSheetId = 'SHEET'; _currentEra = 'all';
    state.user = { name: 'Brad', email: 'brad@example.com' };
    window.showToast = () => {}; window.rrMaybeShowAddHelp = () => {}; window.buildDashboard = () => {}; window.renderBrowse = () => {};
    window._getAllErasMasterForSearch = async () => {}; window._allErasSearchCache = null;
    var au = document.getElementById('auth-screen'); if (au) au.style.display = 'none';
    document.getElementById('app').classList.add('active');
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const stepType = () => (wizard.steps[wizard.step] || {}).type;
    window.__T = {
      sleep, stepType,
      fresh: async (mfr, era, boxOnly) => {
        try { localStorage.setItem('lv_add_mfr', mfr || ''); localStorage.setItem('lv_add_era', era || ''); localStorage.removeItem('lv_add_scale'); } catch (e) {}
        Array.from(document.body.children).filter(e => /Which version\?/.test(e.textContent || '')).forEach(o => o.remove());
        if (typeof _doCloseWizard === 'function' && window.wizard && wizard.steps && wizard.steps.length) { try { _doCloseWizard(); } catch (e) {} }
        await openWizard('collection'); wizard.data._era = 'all'; await sleep(150);
        for (let k = 0; k < 4 && stepType() !== 'itemNumGrouping'; k++) { await wizardNext(); await sleep(120); }
        if (boxOnly) wizard.data.boxOnly = true;
      },
      type: async (v) => {
        const i = document.getElementById('wiz-input'); i.value = v;
        i.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(800);   // the list's 250 ms debounce and the 400 ms "Found" lookup, for real
      },
      next: async () => { try { await wizardNext(); } catch (e) { window.__nextErr = (window.__nextErr || []).concat(String(e && e.message || e)); } await sleep(600); },
    };
  }, [ROWS, SETS, OTHER_ERA]);
}
const look = (pg) => pg.evaluate(() => {
  const s = document.getElementById('wiz-suggestions');
  const rows = s ? Array.from(s.querySelectorAll('[data-idx]')) : [];
  const m = document.getElementById('wiz-match');
  const ov = Array.from(document.body.children).filter(e => /Which version\?/.test(e.textContent || '')).pop();
  return {
    rows: rows.map(r => r.textContent.replace(/\s+/g, ' ').trim()),
    setRows: rows.filter(r => r.querySelector('[data-set-tag]')).length,
    found: m ? m.textContent.replace(/\s+/g, ' ').trim() : '',
    foundSet: !!(m && m.querySelector('[data-set-found]')),
    tab: wizard.tab, step: (wizard.steps[wizard.step] || {}).id || '', stepType: (wizard.steps[wizard.step] || {}).type || '',
    setNum: wizard.data.set_num || '', resolved: wizard.data._resolvedSet ? wizard.data._resolvedSet.setNum + '/' + wizard.data._resolvedSet.year : '',
    overlay: ov ? ov.textContent.replace(/\s+/g, ' ').trim() : '',
    matched: wizard.matchedItem ? wizard.matchedItem.rowId : '',
    nextErr: (window.__nextErr || []).slice(), 
  };
});

async function road(pg) {
  const R = {};
  await prime(pg);
  await pg.evaluate(async () => { await __T.fresh('', ''); await __T.type('1467W'); });
  R.l1 = await look(pg);
  await pg.evaluate(async () => { await __T.next(); });
  R.n1 = await look(pg);
  await pg.evaluate(async () => { await __T.fresh('', ''); await __T.type('2500WS'); });
  R.f2 = await look(pg);
  await pg.evaluate(async () => { await __T.next(); });
  R.n2 = await look(pg);
  await pg.evaluate(async () => { await __T.fresh('', ''); await __T.type('9999W'); });
  R.k1 = await look(pg);
  await pg.evaluate(async () => { await __T.next(); });
  R.k1n = await look(pg);
  await pg.evaluate(async () => { await __T.fresh('Lionel', 'prewar'); await __T.type('2500WS'); });
  R.k2 = await look(pg);
  await pg.evaluate(async () => { await __T.next(); });
  R.k2n = await look(pg);
  await pg.evaluate(async () => { await __T.fresh('', '', true); await __T.type('2500WS'); });
  R.k3 = await look(pg);
  await pg.evaluate(async () => { await __T.next(); });
  R.k3n = await look(pg);
  // the review's cases (2026-11-11)
  // K6: 8888W is also an MTH item in a catalog the collector has not loaded
  // (the all-eras rows) — asked straight: is the typed number the set?
  R.k6 = await pg.evaluate(async () => { await __T.fresh('', ''); _allErasSearchCache = window.__OTHER_ERA.map(r => Object.assign({}, r));
    const g = _wizTypedPostwarSet('8888W'); _allErasSearchCache = null; const g2 = _wizTypedPostwarSet('8888W'); return { withOther: !!g, without: !!g2 }; });
  // K7: the collector TAPPED that MTH row (held by the add), then Next — theirs, not the set
  await pg.evaluate(async () => { await __T.fresh('', ''); await __T.type('8888W'); wizard.matchedItem = Object.assign({}, window.__OTHER_ERA[0]); wizard.data._suggestedItemType = 'Accessory'; await __T.next(); });
  R.k7 = await look(pg);
  // K8: "Use 1234Z as typed" chosen earlier, then 2500WS typed — the old choice does not stick
  await pg.evaluate(async () => { await __T.fresh('', ''); wizard.data._typedAsIs = '1234z'; await __T.type('2500WS'); await __T.next(); });
  R.k8 = await look(pg);
  // K9: the maker word first
  await pg.evaluate(async () => { await __T.fresh('', ''); await __T.type('lionel 2500WS'); await __T.next(); });
  R.k9 = await look(pg);
  // K10: the set number written with a dash
  await pg.evaluate(async () => { await __T.fresh('', ''); await __T.type('1467-w'); });
  R.k10 = await look(pg);
  // K11: the set list arrives AFTER the number is typed
  await pg.evaluate(async () => {
    await __T.fresh('', '');
    const keep = state.setData; state.setData = [];
    window.__keepEnsure = window.rrEnsurePostwarSets;
    window.rrEnsurePostwarSets = () => new Promise(res => setTimeout(() => { state.setData = keep; res(keep); }, 300));
    await __T.type('2500WS'); await __T.sleep(900);
    window.rrEnsurePostwarSets = window.__keepEnsure;
  });
  R.k11 = await look(pg);
  return R;
}
const J = (o) => JSON.stringify(o).slice(0, 500);

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const t0 = Date.now();
  let R;
  {
    const { ctx, pg, errs } = await openApp(browser, null);
    R = await road(pg).catch(e => ({ err: String(e && e.stack || e) }));
    if (R.err) ok('the road runs', false, R.err);
    else {
      ok('L1 type 1467W → ONE row, the set\'s (two versions) — its old catalog copy "Erie Alco Freight Set" is not listed', R.l1.rows.length === 1 && R.l1.setRows === 1 && !R.l1.rows.some(t => /Erie Alco/.test(t)), J(R.l1.rows));
      ok('F1 … the green line names the set: "Lionel Postwar set 1467W · Erie Freight · 1952, 1953 · 5–6 pieces · 2 versions"', R.l1.foundSet && /Found: Lionel Postwar set 1467W · Erie Freight · 1952, 1953 · 5–6 pieces · 2 versions/.test(R.l1.found), R.l1.found);
      ok('N1 … Next without a tap → the set flow on 1467W, asking which version', R.n1.tab === 'set' && R.n1.setNum === '1467W' && /Which version\?/.test(R.n1.overlay), J([R.n1.tab, R.n1.setNum, R.n1.step, R.n1.overlay.slice(0, 60)]));
      ok('F2 type 2500WS → "Found: Lionel Postwar set 2500WS · Freight · 1952 · 5 pieces" — never "Paper"', R.f2.foundSet && /Found: Lionel Postwar set 2500WS · Freight · 1952 · 5 pieces/.test(R.f2.found) && !/Paper/.test(R.f2.found), R.f2.found);
      ok('F3 … and the add holds no catalog row (the box row never rides along)', R.f2.matched === '', R.f2.matched);
      ok('N2 … Next without a tap → that set\'s details screen (one version), not a paper box', R.n2.tab === 'set' && R.n2.step === 'set_entryMode' && R.n2.resolved === '2500WS/1952', J([R.n2.tab, R.n2.step, R.n2.resolved]));
      ok('K1 9999W, which an MTH item also has → the MTH row is listed and is the green line (no set line)', R.k1.rows.some(t => /9999W/.test(t) && /MTH/i.test(t)) && !R.k1.foundSet && /Test Water Tower|Accessory|2005/.test(R.k1.found), J([R.k1.rows, R.k1.found]));
      ok('K2 … and Next stays an item add (no set flow)', R.k1n.tab === 'collection', J([R.k1n.tab, R.k1n.step]));
      ok('K3 Lionel · Pre-War + 2500WS → no set line, and Next opens no set', !R.k2.foundSet && R.k2n.tab !== 'set', J([R.k2.found, R.k2n.tab]));
      ok('K4 Box Only + 2500WS → the box row as before (no set line), and Next opens no set', !R.k3.foundSet && R.k3n.tab !== 'set', J([R.k3.found, R.k3n.tab]));
      ok('K5 no page errors', errs.length === 0, errs.join(' | '));
      ok('K6 8888W is also an MTH item in a catalog not loaded → not taken as the set (and is, once that row is gone)', R.k6.withOther === false && R.k6.without === true, J(R.k6));
      ok('K7 that MTH row TAPPED, then Next → the MTH item\'s add, not the set', R.k7.tab === 'collection', J([R.k7.tab, R.k7.step]));
      ok('K8 an old "as typed" choice for another number does not stop 2500WS opening its set', R.k8.tab === 'set' && R.k8.resolved === '2500WS/1952', J([R.k8.tab, R.k8.resolved]));
      ok('K9 "lionel 2500WS" (maker word first) → Next opens the set', R.k9.tab === 'set' && R.k9.resolved === '2500WS/1952', J([R.k9.tab, R.k9.resolved]));
      ok('K10 "1467-w" (a dash) → the set\'s row only, no old copy', R.k10.setRows === 1 && !R.k10.rows.some(t => /Erie Alco/.test(t)), J(R.k10.rows));
      ok('K11 the set list arriving late → the green line still turns into the set', R.k11.foundSet && /Lionel Postwar set 2500WS/.test(R.k11.found), R.k11.found);
    }
    await ctx.close();
  }
  // ── P: planted offenders, one served copy each ──
  const SUG = read('wizard-suggestions.js'), WIZ = read('wizard.js');
  async function planted(served, fn) {
    const { ctx, pg } = await openApp(browser, served);
    await prime(pg);
    const out = await fn(pg).catch(e => ({ err: String(e) }));
    await ctx.close();
    return out;
  }
  {
    const P = await planted({ 'wizard-suggestions.js': plant(SUG, "          return !(c && !c._setNum && _wizSetCopyRow(c._row)", "          return true || !(c && !c._setNum && _wizSetCopyRow(c._row)", 'copy row kept') },
      async pg => { await pg.evaluate(async () => { await __T.fresh('', ''); await __T.type('1467W'); }); return look(pg); });
    ok('P1 PLANTED the old catalog copy kept → L1 can fail (two rows for 1467W)', !P.err && P.rows.length === 2, J(P));
  }
  {
    const P = await planted({ 'wizard-suggestions.js': plant(SUG, "    const _setG = (typeof _wizTypedPostwarSet === 'function') ? _wizTypedPostwarSet(_searchNum) : null;", "    const _setG = null;", 'green line off') },
      async pg => { await pg.evaluate(async () => { await __T.fresh('', ''); await __T.type('2500WS'); }); return look(pg); });
    ok('P2 PLANTED the green line not asking the set → F2 can fail ("Found: Paper")', !P.err && !P.foundSet && /Paper/.test(P.found), J(P));
  }
  {
    const P = await planted({ 'wizard.js': plant(WIZ, "      if (_setG) { _wizPickSetRow(_setG.setNum); return; }", "      if (false) { _wizPickSetRow(_setG.setNum); return; }", 'Next off') },
      async pg => { await pg.evaluate(async () => { await __T.fresh('', ''); await __T.type('2500WS'); await __T.next(); }); return look(pg); });
    ok('P3 PLANTED Next not asking the set → N2 can fail (no set flow)', !P.err && P.tab !== 'set', J(P));
  }
  {
    const P = await planted({ 'wizard-suggestions.js': plant(plant(SUG, "  return other ? null : hits[0];", "  return hits[0];", 'other rows ignored'), "  if (held && rrNumSameAsTyped(held.itemNum, t) && !_wizSetCopyRow(held) && !_wizSetBoxRow(held)) return null;", "", 'held row ignored too') },
      async pg => { await pg.evaluate(async () => { await __T.fresh('', ''); await __T.type('9999W'); await __T.next(); }); return look(pg); });
    ok('P4 PLANTED a real item sharing the number ignored → K2 can fail (the MTH item add turned into a set)', !P.err && P.tab === 'set', J(P));
  }
  {
    const P = await planted({ 'wizard-suggestions.js': plant(SUG, "               ((typeof _allErasSearchCache !== 'undefined' && _allErasSearchCache) || [])];", "               []];", 'unloaded makers ignored') },
      async pg => pg.evaluate(async () => { await __T.fresh('', ''); _allErasSearchCache = window.__OTHER_ERA.map(r => Object.assign({}, r)); const g = _wizTypedPostwarSet('8888W'); _allErasSearchCache = null; return { took: !!g }; }));
    ok('P6 PLANTED the unloaded maker\'s row not asked → K6 can fail (8888W taken as the set)', !P.err && P.took === true, J(P));
  }
  {
    const P = await planted({ 'wizard-suggestions.js': plant(SUG, "  if (held && rrNumSameAsTyped(held.itemNum, t) && !_wizSetCopyRow(held) && !_wizSetBoxRow(held)) return null;", "", 'tapped row ignored') },
      async pg => { await pg.evaluate(async () => { await __T.fresh('', ''); await __T.type('8888W'); wizard.matchedItem = Object.assign({}, window.__OTHER_ERA[0]); wizard.data._suggestedItemType = 'Accessory'; await __T.next(); }); return look(pg); });
    ok('P6b PLANTED a tapped row ignored → K7 can fail (the tapped MTH item turned into the set)', !P.err && P.tab === 'set', J(P));
  }
  {
    const P = await planted({ 'wizard.js': plant(WIZ, "    if (wizard.data._typedAsIs !== _setTok && wizard.data._typedAsIs !== _numPart", "    if (!wizard.data._typedAsIs", 'any old as-typed') },
      async pg => { await pg.evaluate(async () => { await __T.fresh('', ''); wizard.data._typedAsIs = '1234z'; await __T.type('2500WS'); await __T.next(); }); return look(pg); });
    ok('P7 PLANTED any old "as typed" stops the set → K8 can fail', !P.err && P.tab !== 'set', J(P));
  }
  {
    const P = await planted({ 'wizard.js': plant(WIZ, "      const _setG = _wizTypedPostwarSet(_setTok);", "      const _setG = _wizTypedPostwarSet(_numPart);", 'first word') },
      async pg => { await pg.evaluate(async () => { await __T.fresh('', ''); await __T.type('lionel 2500WS'); await __T.next(); }); return look(pg); });
    ok('P8 PLANTED Next reading the first word → K9 can fail', !P.err && P.tab !== 'set', J(P));
  }
  {
    const P = await planted({ 'wizard-suggestions.js': plant(SUG, "        if (_exactSet && !_shownSets.some(function (g) { return g.setNum === _exactSet.setNum; })) _shownSets.unshift(_exactSet);", "", 'dash form') },
      async pg => { await pg.evaluate(async () => { await __T.fresh('', ''); await __T.type('1467-w'); }); return look(pg); });
    ok('P9 PLANTED the dash form not matched to its set → K10 can fail (the old copy listed)', !P.err && P.rows.some(t => /Erie Alco/.test(t)), J(P));
  }
  {
    const P = await planted({ 'wizard-suggestions.js': plant(SUG, "              if (typeof lookupItem === 'function') lookupItem(_inp.value);   // 2026-11-11: the green line asks the sets again too", "", 'late sets') },
      async pg => { await pg.evaluate(async () => {
        await __T.fresh('', '');
        const keep = state.setData; state.setData = [];
        window.__keepEnsure = window.rrEnsurePostwarSets;
        window.rrEnsurePostwarSets = () => new Promise(res => setTimeout(() => { state.setData = keep; res(keep); }, 300));
        await __T.type('2500WS'); await __T.sleep(900);
        window.rrEnsurePostwarSets = window.__keepEnsure;
      }); return look(pg); });
    ok('P10 PLANTED the green line not asked again when the sets arrive → K11 can fail', !P.err && !P.foundSet, J(P));
  }
  {
    const P = await planted({ 'wizard-suggestions.js': plant(SUG, "    return !_wizSetCopyRow(i) && !_wizSetBoxRow(i);", "    return !_wizSetCopyRow(i);", 'box row counted as another item') },
      async pg => { await pg.evaluate(async () => { await __T.fresh('', ''); await __T.type('2500WS'); }); return look(pg); });
    ok('P5 PLANTED the set\'s box counted as a different item → F2 can fail', !P.err && !P.foundSet, J(P));
  }
  await browser.close();
  console.log('\n(' + Math.round((Date.now() - t0) / 1000) + ' s) ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
