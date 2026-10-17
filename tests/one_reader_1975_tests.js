#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// ONE PICTURE READER, RELEASE 1 — v0.9.1975
//
// Brad, 2026-10-17, Photo ID from the Add screen (Lionel + O set there) on his
// red M-K-T 6556 stock car: "why the wrong suggestion when i say its lionel o
// guage" — it said "Found it — 43725 Marklin HO, Add-On Car for the ICE 4".
// 43725 is the car's LT WT (light weight) stencil. Photo ID handed the picture
// to the Photo Inbox reader with NO filters, and a single wrong row was shown
// as the answer. Then: "all readers, i mean all, should read the same way,
// barcode first because its fast, then switch to the other" → release 1 →
// "yes".
//
//   R1  THE REAL READER (_numberFromText) on the car's lettering, filtered to
//       Lionel O (the Add screen's filters): 6556, confirmed — not 43725, even
//       when OCR garbles "LT WT"
//   R2  "CU FT 2111" (cubic feet) is a stencil, never an item number
//   F1  _wizReaderPrefer: Lionel + O → the Lionel catalogs that carry O
//       (Pre-War, Postwar, MPC/Modern) — never Lionel HO / S, never Marklin;
//       nothing set → no preference (a neutral read)
//   P1  Photo ID from the Add screen hands those filters to the reader
//   P2  the reader says 6556 → straight to 6556, no list
//   P3  the reader says 43725 (only a Marklin HO row) → NOT "Found it": the
//       list opens with it under "Outside your filter" — his choice
//   P4  opened anywhere else (not the Add screen): no filters, as before
//   X*  PLANTED: each undone in the code is caught
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  one_reader_1975_tests needs playwright and it is not installed.'); process.exit(1); }
const APPDIR = path.join(__dirname, '..', 'app');
const SRC = fs.readFileSync(path.join(APPDIR, 'photo-inbox.js'), 'utf8');
const APPJS = fs.readFileSync(path.join(APPDIR, 'app.js'), 'utf8');
const AD = fs.readFileSync(path.join(APPDIR, 'app-data.js'), 'utf8');
const BC = fs.readFileSync(path.join(APPDIR, 'barcode.js'), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail).slice(0, 700))); cond ? pass++ : fail++; }
function planted(src, from, to, what) {
  if (src.indexOf(from) < 0) throw new Error('planted ' + what + ': the line moved; update this test');
  return src.replace(from, to);
}
function grab(src, sig) {
  const i = src.indexOf(sig); if (i < 0) throw new Error('could not find ' + sig);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } }
  throw new Error('unbalanced ' + sig);
}
function grabVar(src, name) { const i = src.indexOf('var ' + name + ' = {'); if (i < 0) throw new Error('no var ' + name); return src.slice(i, src.indexOf('};', i) + 2); }

// ── R · the real reader in a sandbox (the letter_read_tests pattern) ────────
const row = (num, era, road, desc, tab) => ({ itemNum: num, _era: era, roadName: road, description: desc, _tab: tab });
const CAT = {
  '6556':  row('6556', 'pw', 'M-K-T', 'M-K-T Stock Car', 'Lionel PW - Items'),
  '43725': row('43725', 'marklin_h0', '', 'Add-On Car for the ICE 4', 'Marklin H0'),
  '2111':  row('2111', 'pw', '', 'A postwar 2111 (planted to test the CU FT rule)', 'Lionel PW - Items'),
};
const MAKER = { pw: 'lionel', mpc: 'lionel', prewar: 'lionel', marklin_h0: 'marklin' };
function buildReader(src) {
  const sb = {
    console, WeakMap,
    window: { rrDemotedRow: () => false },
    findMaster: (c, x, pref) => {
      const r = CAT[String(c)] || null;
      if (!r || !pref) return r;
      const es = (pref.eras && pref.eras.length) ? pref.eras : (pref.era ? [pref.era] : []);
      return (!es.length || es.indexOf(r._era) >= 0) ? r : r;   // findMaster finds; the reader decides in/out of era
    },
    _manufacturerOfEra: (e) => MAKER[e] || '',
    _pinQuoteMatch: () => null,
    _pinIsSetRow: () => false, _pinDemotedRow: () => false, _photoIsPaper: false,
    _pinKinRowsFor: (n) => CAT[n] ? [CAT[n]] : [],
    state: { masterData: Object.values(CAT), masterByItem: new Map(Object.keys(CAT).map(k => [k, [CAT[k]]])) },
  };
  sb.window.state = sb.state;
  vm.createContext(sb);
  vm.runInContext(grab(src, 'function _prefEras(prefer)'), sb);
  vm.runInContext(grab(APPJS, 'function rrDashedKin(num)'), sb);
  vm.runInContext('var _lkCache = new WeakMap();\n' + grab(AD, 'function _letterKinRows(idx, bare)'), sb);
  vm.runInContext(grabVar(src, '_FAM_STOPWORDS') + '\n' + grab(src, 'function _pinFamilyPick(c, prefer, srcText)') + '\n'
    + grab(src, 'function _pinReadFamily(uniq, prefer, UP, dbg)') + '\n' + grab(src, 'function _numberFromText(text, prefer)') + '\nthis.run = _numberFromText;', sb);
  return sb.run;
}
// what the Add screen's filters (Lionel + O) become — checked against the real builder in F1
const LIONEL_O = { era: '', eras: ['prewar', 'pw', 'mpc'], manufacturer: 'Lionel', scale: 'O', period: '', type: '', kind: '', _fromFilter: true };
const CAR = 'THE KATY SERVES THE SOUTHWEST M-K-T 6556 BLT 1-58 BY LIONEL EXT W 9-1 EW 9-7 H 12-1 IW 9-6 IH 8-7 CAPY 81233 LD LMT 92295 LT WT 43725';
const CAR_GARBLED = 'The Katy SERVES THE SOUTHWEST MKT 6556 BLT 1-58 EW 9-7 IW 9-6 CAPY 81233 LDLMT 92295 IT W1 43725';

(async () => {
  console.log('== R · the real reader on the car\'s lettering ==');
  let run = buildReader(SRC), r;
  r = run(CAR, LIONEL_O);
  T('R1 filtered to Lionel O: 6556, confirmed', r && String(r.num) === '6556' && r.matched === true, r && { num: r.num, matched: r.matched, cand: r.dbg && r.dbg.cand });
  r = run(CAR_GARBLED, LIONEL_O);
  T('R1 "LT WT" garbled to "IT W1": still 6556 — 43725 is only in a Marklin catalog, outside the filters', r && String(r.num) === '6556' && r.matched === true, r && { num: r.num, matched: r.matched, cand: r.dbg && r.dbg.cand });
  r = run('THE KATY 43725 SERVES THE SOUTHWEST', LIONEL_O);
  T('R1 only 43725 read: never a confirmed answer while filtered to Lionel O', !(r && String(r.num) === '43725' && r.matched === true), r && { num: r.num, matched: r.matched });
  r = run('M-K-T CU FT 2111 SERVES THE SOUTHWEST', LIONEL_O);
  T('R2 "CU FT 2111" is a size stencil, never the item (2111 IS in the catalog here)', !(r && String(r.num) === '2111'), r && { num: r.num, matched: r.matched });

  // ── F + P · the browser ──────────────────────────────────────────────────
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const ROWS = [
    { itemNum: '6556', variation: '', _tab: 'Lionel PW - Items', _era: 'pw', manufacturer: 'Lionel', roadName: 'M-K-T', itemType: 'Stock Car', description: 'M-K-T Stock Car', yearProd: '1958' },
    { itemNum: '43725', variation: '', _tab: 'Marklin H0', _era: 'marklin_h0', manufacturer: 'Marklin', roadName: '', itemType: 'Passenger Car', description: 'Add-On Car for the ICE 4', yearProd: '2022' },
  ];
  async function boot(o) {
    const ctx = await browser.newContext({ viewport: { width: 1536, height: 737 } });
    const pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.route('**', rt => {
      const u = rt.request().url(), base = u.split('?')[0];
      if (!u.startsWith('file://')) return rt.abort();
      if (base.endsWith('/app/barcode.js') && o.bcSrc) return rt.fulfill({ body: o.bcSrc, contentType: 'application/javascript' });
      return rt.continue();
    });
    await pg.goto('file://' + path.join(APPDIR, 'index.html'), { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(900);
    await pg.evaluate(([rows, says]) => {
      state.masterData = []; state.masterAllRows = rows.slice(); window._allIdxComplete = true;
      state.personalData = {}; state.personalSheetId = 'SID'; accessToken = 'tok';
      window.__picker = 0; window.__pref = 'never called';
      window.Tesseract = { recognize: async () => ({ data: { text: '' } }) };   // the quick box read finds nothing on a bare car
      window._ensureTesseract = async () => window.Tesseract;
      window.rrFreeReadBlob = async (blob, dim, pref) => { window.__pref = pref; return { num: says, matched: true }; };
      try { _aiUsageMarkSeen(); } catch (e) {}
      wizard.data = wizard.data || {};
      Object.assign(wizard.data, { _searchFilterManufacturer: 'Lionel', _searchFilterScale: 'O', _searchFilterPeriod: '' });
    }, [ROWS, o.says || '6556']);
    return { pg, ctx, errs };
  }
  const runPid = (pg, opts) => pg.evaluate(async (opts) => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 300;
    const g = c.getContext('2d'); g.fillStyle = '#c33'; g.fillRect(0, 0, 400, 300);
    let res = null, done = false, pickerText = '';
    window._biPipelineOnCanvas(c, opts).then(v => { res = v; done = true; });
    for (let i = 0; i < 200 && !done; i++) {
      await new Promise(z => setTimeout(z, 100));
      const pk = document.getElementById('barcode-candidate-overlay');
      if (pk && !pk.__seen) {
        pk.__seen = true; window.__picker++; pickerText = pk.textContent.replace(/\s+/g, ' ');
        const first = pk.querySelector('.bc-cand[data-idx="0"]'); if (first) first.click();
      }
    }
    const o = document.getElementById('bi-overlay'); if (o) o.remove();
    return { item: res && res.itemNum, picker: window.__picker, pickerText, pref: window.__pref };
  }, opts);

  console.log('== F · the Add screen\'s filters as a reader preference ==');
  let b = await boot({});
  let f = await b.pg.evaluate(() => {
    const a = window._wizReaderPrefer();
    Object.assign(wizard.data, { _searchFilterManufacturer: '', _searchFilterScale: '', _searchFilterPeriod: '', _typedSearchPeriod: '', _searchFilterType: '' });
    const none = window._wizReaderPrefer();
    return { a, none };
  });
  T('F1 Lionel + O → the Lionel catalogs that carry O: Pre-War, Postwar, MPC/Modern (not Lionel HO or S, not Marklin)',
    f.a && JSON.stringify(f.a.eras.slice().sort()) === JSON.stringify(['mpc', 'prewar', 'pw']) && f.a.manufacturer === 'Lionel' && f.a.scale === 'O', f.a);
  T('F1 nothing set on the Add screen → no preference (a neutral read)', f.none === null, f.none);
  T('page errors', b.errs.length === 0, b.errs);
  await b.ctx.close();

  console.log('== P · Photo ID from the Add screen ==');
  b = await boot({ says: '6556' });
  let m = await runPid(b.pg, { noAi: true, addFilters: true });
  T('P1 Photo ID hands the reader the Add screen\'s filters (Lionel, O, the O-carrying Lionel catalogs)',
    m.pref && m.pref.manufacturer === 'Lionel' && m.pref.scale === 'O' && m.pref.eras.indexOf('pw') >= 0 && m.pref.eras.indexOf('marklin_h0') < 0, m.pref);
  T('P2 the reader says 6556 → 6556, straight away, no list', m.item === '6556' && m.picker === 0, m);
  await b.ctx.close();

  b = await boot({ says: '43725' });
  m = await runPid(b.pg, { noAi: true, addFilters: true });
  T('P3 the reader says 43725 (only a Marklin HO row) → NOT "Found it": the list opens with it under "Outside your filter"',
    m.picker === 1 && /Outside your filter/.test(m.pickerText) && /43725/.test(m.pickerText), m);
  await b.ctx.close();

  b = await boot({ says: '6556' });
  m = await runPid(b.pg, { noAi: true });
  T('P4 opened anywhere else (not the Add screen): no filters handed to the reader, as before', m.pref === null && m.item === '6556', m);
  await b.ctx.close();

  console.log('== planted offenders ==');
  run = buildReader(planted(SRC, "|CAPACITY|CU\\s*FT|CUFT)[^0-9]{0,10}", "|CAPACITY)[^0-9]{0,10}", 'cu ft'));
  r = run('M-K-T CU FT 2111 SERVES THE SOUTHWEST', LIONEL_O);
  T('X-R2 PLANTED: CU FT not a stencil → 2111 is taken (caught)', r && String(r.num) === '2111', r && { num: r.num });
  run = buildReader(SRC);
  r = run(CAR_GARBLED, null);
  T('X-R1 PLANTED (no filters, the old hand-off): the reader is free to take 43725 — so the filters are what fixes it (caught when it does)', r && String(r.num) === '43725', r && { num: r.num, matched: r.matched, cand: r.dbg && r.dbg.cand });
  b = await boot({ says: '43725', bcSrc: planted(BC, "      if (hits.length && !hits.some(_fitsAdd)) {", "      if (false) {", 'outside guard') });
  m = await runPid(b.pg, { noAi: true, addFilters: true });
  T('X-P3 PLANTED: the outside-the-filters guard removed → 43725 is "Found it" straight away (caught)', m.item === '43725' && m.picker === 0, m);
  await b.ctx.close();
  b = await boot({ says: '6556', bcSrc: planted(BC, "window.rrFreeReadBlob(_frBlob, 2400, _frPref, { barcodeDone: true })", "window.rrFreeReadBlob(_frBlob, 2400, null, { barcodeDone: true })", 'no prefer') });
  m = await runPid(b.pg, { noAi: true, addFilters: true });
  T('X-P1 PLANTED: the filters not handed over → the reader gets nothing (caught)', m.pref === null, m.pref);
  await b.ctx.close();

  await browser.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL  crashed: ' + (e && e.stack || e)); process.exit(1); });
