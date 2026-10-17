#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THE LETTERING AND THE NUMBER AGREEING IS AGREEMENT — v0.9.1978
//
// Found while building v0.9.1977 (the one picture reader): a box reading
// "ITEM #0526-1 TRAINMAN BOXCAR" came back UNSURE — the number read was 0526-1,
// the lettering named the 0526-1 Trainman Boxcar, and the reader said the two
// "disagreed" (nameVsNumber: "0526-1 … vs 0526-1"). Two signals pointing at the
// same item were treated as a contradiction. Brad: "yes" to fixing it.
//
//   A1  number confirmed + lettering names the same item → confirmed, nothing
//       "disagreed", the agreement recorded
//   A2  number read but unconfirmed + lettering names the same item → confirmed
//       (two weak signals that agree — like the tail rule)
//   A3  "2343P" read, lettering names 2343-P → the same item (one spelling apart)
//   K1  a REAL disagreement still is one: 2900 read, lettering names the M-K-T
//       engine → unsure, both offered (the v0.9.1166 Lockon case)
//   K2  2343-P and 2343-T are two items — never merged
//   K3  the tail rule still works: 321 read, lettering names 2321 → 2321
//   K4  …but equal digits are not a tail: 2343-P read, lettering names 2343-T —
//       it used to swap the powered unit for the dummy (fixed here too)
//   R1  the real reader in the browser, on the box that found the bug
//   X*  PLANTED: the fix undone is caught
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  lettering_agrees_1978_tests needs playwright and it is not installed.'); process.exit(1); }
const APPDIR = path.join(__dirname, '..', 'app');
const SRC = fs.readFileSync(path.join(APPDIR, 'photo-inbox.js'), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail).slice(0, 600))); cond ? pass++ : fail++; }
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
// the REAL _pinDescArbitrate, with what the lettering names stubbed in
function build(src) {
  const sb = { console, __dm: null, _pinDescMatch: () => sb.__dm, findMaster: () => null };
  vm.createContext(sb);
  vm.runInContext(grab(src, 'function _pinDescArbitrate(best, text, prefer)') + '\nthis.run = _pinDescArbitrate;', sb);
  return (best, dm) => { sb.__dm = dm; return sb.run(best, 'TEXT', null); };
}
const named = (num, desc, extra) => Object.assign({ row: { itemNum: num, description: desc }, words: ['WORD'], score: 2, nearUnique: true }, extra || {});

(async () => {
  console.log('== A · the same item is agreement ==');
  let run = build(SRC), r;
  r = run({ num: '0526-1', matched: true, dbg: {} }, named('0526-1', 'Trainman Boxcar'));
  T('A1 number confirmed + lettering names the same item → confirmed, nothing "disagreed"',
    r && r.num === '0526-1' && r.matched === true && !r.disagreed && r.dbg && /same item/.test(r.dbg.corroborated || ''), r);
  r = run({ num: '0526-1', matched: false, dbg: {}, alts: ['0526'] }, named('0526-1', 'Trainman Boxcar'));
  T('A2 number read but unconfirmed + lettering names the same item → confirmed (and nothing else on it is lost)',
    r && r.num === '0526-1' && r.matched === true && !r.disagreed && r.alts && r.alts[0] === '0526', r);
  r = run({ num: '2343P', matched: true, dbg: {} }, named('2343-P', 'Santa Fe F3 A Unit'));
  T('A3 "2343P" read, lettering names 2343-P → the same item', r && r.matched === true && !r.disagreed, r);

  console.log('== K · what must not change ==');
  r = run({ num: '2900', matched: true, dbg: {} }, named('736', 'M-K-T Berkshire'));
  T('K1 a REAL disagreement still is one: 2900 read, the lettering names the 736 → unsure, both offered',
    r && r.num === '736' && r.matched === false && r.disagreed === '2900', r);
  r = run({ num: '2343-P', matched: true, dbg: {} }, named('2343-T', 'Santa Fe F3 A Dummy'));
  T('K2 2343-P read, lettering names 2343-T → still two items (never merged)', r && r.matched === false && r.disagreed === '2343-P', r);
  r = run({ num: '321', matched: true, dbg: {} }, named('2321', 'Lackawanna FM'));
  T('K3 the tail rule still works: 321 read, lettering names 2321 → 2321, confirmed', r && r.num === '2321' && r.matched === true, r);
  r = run({ num: '2343-P', matched: false, dbg: {} }, named('2343-T', 'Santa Fe F3 A Dummy'));
  T('K4 equal digits are not a tail: unconfirmed 2343-P vs the lettering\'s 2343-T → never a confirmed 2343-T', !(r && r.num === '2343-T' && r.matched === true), r);

  console.log('== R · the real reader, on the box that found it ==');
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const ROWS = [{ itemNum: '0526-1', variation: '', _tab: 'Atlas O', _era: 'atlas', manufacturer: 'Atlas', roadName: '', itemType: 'Boxcar', description: 'Trainman Boxcar', yearProd: '2004' }];
  const readBox = async (src) => {
    const ctx = await browser.newContext();
    const pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.route('**', rt => {
      const u = rt.request().url();
      if (!u.startsWith('file://')) return rt.abort();
      if (src && u.split('?')[0].endsWith('/app/photo-inbox.js')) return rt.fulfill({ body: src, contentType: 'application/javascript' });
      return rt.continue();
    });
    await pg.goto('file://' + path.join(APPDIR, 'index.html'), { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(900);
    const res = await pg.evaluate(async (rows) => {
      state.masterData = rows.slice(); _rebuildMasterIndex(); state.masterAllRows = rows.slice(); window._allIdxComplete = true;
      window.Tesseract = { createWorker: async () => ({ setParameters: async () => {}, recognize: async () => ({ data: { text: 'ATLAS O SCALE ITEM #0526-1 TRAINMAN BOXCAR' } }) }) };
      window._biDetectCanvas = async () => [];
      const c = document.createElement('canvas'); c.width = 300; c.height = 200; c.getContext('2d').fillRect(0, 0, 300, 200);
      const b = await new Promise(r => c.toBlob(r, 'image/jpeg'));
      const r = await window.rrFreeReadBlob(b, 800, window.rrReaderPreferFrom({ manufacturer: 'Atlas' }), { barcodeDone: true });   // the lettering is matched within the screen's catalogs
      return r && { num: r.num, matched: r.matched, disagreed: r.disagreed || '' };
    }, ROWS);
    await ctx.close();
    return { res, errs };
  };
  let o = await readBox(null);
  T('R1 "ITEM #0526-1 TRAINMAN BOXCAR" → 0526-1, confirmed, nothing "disagreed"', o.res && o.res.num === '0526-1' && o.res.matched === true && !o.res.disagreed, o.res);
  T('page errors', o.errs.length === 0, o.errs);

  console.log('== X · planted ==');
  const UNDONE = planted(SRC, '        if (sameItem) {', '        if (false) {', 'same item');
  r = build(UNDONE)({ num: '0526-1', matched: true, dbg: {} }, named('0526-1', 'Trainman Boxcar'));
  T('X-A1 PLANTED: the fix undone → the same item comes out unsure, "disagreeing" with itself (caught)', r && r.matched === false && r.disagreed === '0526-1', r);
  const LOOSE = planted(SRC, ".replace(/-(?=[A-Z]+$)/, '')", ".replace(/-?[A-Z]+$/, '')", 'spelling bridge');
  r = build(LOOSE)({ num: '2343-P', matched: true, dbg: {} }, named('2343-T', 'Santa Fe F3 A Dummy'));
  T('X-K2 PLANTED: a bridge that drops the suffix → 2343-P and 2343-T merged (caught)', r && r.matched === true, r);
  const OLDTAIL = planted(SRC, '_hD && _dD.length > _hD.length &&', '_hD &&', 'tail length');
  r = build(OLDTAIL)({ num: '2343-P', matched: true, dbg: {} }, named('2343-T', 'Santa Fe F3 A Dummy'));
  T('X-K4 PLANTED: the old tail rule → 2343-P swapped for the dummy 2343-T, confirmed (caught)', r && r.num === '2343-T' && r.matched === true, r);
  o = await readBox(UNDONE);
  T('X-R1 PLANTED: in the browser, the fix undone → the box comes out unsure (caught)', o.res && o.res.matched === false, o.res);

  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
