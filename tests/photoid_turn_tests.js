#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// PHOTO ID — A SIDEWAYS LABEL, THE MAKER HELPERS, AND A RECORD OF EVERY READ (A B D E F)
// (real Chromium, the REAL app, the REAL Tesseract.js, real catalog numbers)
// PLAN_2026-11-03_PHOTO_ID_IPHONE.md
//
// [stated] Mike Caruso (email, 2026-11-03): Photo ID on the end flap of his MTH
// SD90MAC (Item No. 20-2471-3) showed "Barcode: ✓ 0658081069753 → MTH" and then
// "which number is YOUR item? 105 · 283 · 193" — "I had no idea so I ended up
// entering the item number manually". [stated] Brad: "that was the picture he
// took and i took the picture of his picture and it worked so what gives" →
// "yes" to the plan → "yes" to build.
//
// Measured before building: his picture reads 20-2471-3 upright (Chromium AND
// WebKit as an iPhone, 1440 px and full 24 MP size); turned sideways the quick
// look reads no number and the closer look offers stray 3-digit LIONEL numbers
// the catalog knows — his screen's pattern. 105 and 193 are Lionel numbers.
//
//   A  UPRIGHT. His picture + his barcode → "found 20-2471-3", no turned read,
//      no closer look; one record saved; Report a problem prints it.
//   B  SIDEWAYS → the turned read finds 20-2471-3. PLANTED: with no turns, the
//      same picture reads no number at all (today's failure reproduced).
//   C  SIDEWAYS, turns off, barcode MTH → no Lionel number is offered anywhere;
//      the honest "couldn't read a MTH item number" line. PLANTED: the closer
//      look given only the screen's filters (the old code) → a Lionel number
//      appears (Mike's screen reproduced).
//   D  The choices helper: one argument = as before (in + out of the filters);
//      narrowed = only the numbers inside. _biCloserPrefer: barcode MTH → MTH's
//      catalogs only; no barcode → the screen's own filters, untouched.
//   E  The record never holds an email. PLANTED: the cleaner without its email
//      rule → red.
//   F  Scans (each with a planted offender): the turned read and the closer look
//      take their preference ONLY from _biCloserPrefer; the record's read text
//      goes through rrPhotoIdRecordText; the words live in RR_PHOTO_ID_CLOSER.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  photoid_turn_tests needs playwright and it is not installed.'); process.exit(1); }
const { PIC, NUMS, BC, read, boot, runOn, lionelShown } = require('./lib/photoid-harness.js');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 900))); cond ? pass++ : fail++; }

(async function () {
  const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
  const b64 = fs.readFileSync(PIC).toString('base64');
  const bcSrc = read('barcode.js');
  try {
    // ── A · upright ──
    {
      const { pg, errs } = await boot(browser);
      const r = await runOn(pg, b64, { turn: 0, bc: BC });
      T('A upright + barcode: "found 20-2471-3" and the catalog takes it', /Barcode: ✓ 0658081069753 → MTH/.test(r.t) && /Lettering: ✓ found 20-2471-3/.test(r.t) && /Catalog: ✓ 20-2471-3/.test(r.t), r.t);
      T('A upright: no turned read, no closer look (nothing slower than before)', r.rec && !r.rec.turned && !r.rec.closer, r.rec);
      T('A one record saved: device, sizes, barcode → MTH, the quick read, the result', r.rec && r.rec.work === '1475x1108' && /0658081069753 → MTH/.test(r.rec.bc) && /^20-2471-3/.test(r.rec.quick) && /read 20-2471-3/.test(r.rec.got) && r.rec.src === 'test' && !!r.rec.dev, r.rec);
      T('A Report a problem prints PHOTO ID READS with that read', /PHOTO ID READS/.test(r.report) && /read 1475x1108/.test(r.report) && /barcode 0658081069753 → MTH/.test(r.report) && /=>  read 20-2471-3/.test(r.report), r.report.slice(r.report.indexOf('PHOTO ID'), r.report.indexOf('PHOTO ID') + 500));
      console.log('      (upright read took ' + r.ms + ' ms in the cloud Chromium)');
      T('A no page errors', !errs.length, errs);
      await pg.close();
    }
    // ── B · sideways → the turned read ──
    {
      const { pg, errs } = await boot(browser);
      const r = await runOn(pg, b64, { turn: 90, bc: BC });
      T('B sideways + barcode: the turned read finds 20-2471-3 and the catalog takes it', /Lettering: ✓ found 20-2471-3/.test(r.t) && /Catalog: ✓ 20-2471-3/.test(r.t) && lionelShown(r).length === 0, { t: r.t, btns: r.btns });
      T('B the record says the upright read missed and the turned read kept it', r.rec && /^no number/.test(r.rec.quick) && /kept 20-2471-3/.test(r.rec.turned) && /turned/.test(r.rec.got), r.rec);
      console.log('      (sideways read took ' + r.ms + ' ms in the cloud Chromium)');
      T('B no page errors', !errs.length, errs);
      await pg.close();
      const { pg: pg2 } = await boot(browser);
      const p = await runOn(pg2, b64, { turn: 90, bc: BC, noTurns: true, stubCloser: true });
      T('B PLANTED: with no turns the same sideways picture never reads 20-2471-3 (B would fail)', !/20-2471-3/.test(p.t), p.t);
      await pg2.close();
    }
    // ── D · the helpers ──
    {
      const { pg, errs } = await boot(browser);
      const d = await pg.evaluate(() => {
        const fr = { num: '222', matched: false, dbg: { inEra: ['20-2471-3:mth_o'], offEra: ['105:prewar', '193:pw', '283:pw'] } };
        const pMth = window._biCloserPrefer({}, { bcMaker: 'MTH' });
        const pOut = window._biCloserPrefer({}, { bcMaker: 'MTH', bcOutsideCrop: true });
        const pNone = window._biCloserPrefer({ prefer: { era: 'pw', eras: ['pw'], manufacturer: 'Lionel' } }, { bcMaker: '' });
        return {
          one: window._bcCloserChoices(fr), narrowed: window._bcCloserChoices(fr, true),
          mthEras: pMth && pMth.eras, mthFrom: pMth && pMth._fromBarcode,
          lionelRow: pMth ? rrRowFitsPrefer({ itemNum: '193', _era: 'pw' }, pMth) : null,
          mthRow: pMth ? rrRowFitsPrefer({ itemNum: '20-2471-3', _era: 'mth_o' }, pMth) : null,
          outside: pOut, none: pNone,
        };
      });
      T('D one argument = as before: in AND out of the filters', JSON.stringify(d.one) === JSON.stringify(['20-2471-3', '105', '193', '283']), d);
      T('D narrowed = only the numbers inside', JSON.stringify(d.narrowed) === JSON.stringify(['20-2471-3']), d);
      T('D barcode MTH → only MTH catalogs (193 Lionel out, 20-2471-3 in)', Array.isArray(d.mthEras) && d.mthEras.length > 0 && d.mthEras.every(e => /^mth/.test(e)) && d.mthFrom === 'MTH' && d.lionelRow === false && d.mthRow === true, d);
      T('D a barcode found OUTSIDE the crop narrows nothing', d.outside === null, d);
      T('D no barcode → the screen’s own filters, untouched', d.none && d.none.manufacturer === 'Lionel' && !d.none._fromBarcode, d);
      T('D no page errors', !errs.length, errs);
      await pg.close();
    }
    // ── E · the record never holds an email ──
    {
      const probe = 'ORDER bob.smith@aol.com\nItem No. 20-2471-3';
      const { pg } = await boot(browser);
      const e = await pg.evaluate(p => window.rrPhotoIdRecordText(p), probe);
      T('E the record’s read text never holds an email', !/@/.test(e) && /\[email\]/.test(e) && /20-2471-3/.test(e), e);
      await pg.close();
      const off = bcSrc.replace(".replace(/[^\\s@]+@[^\\s@]+\\.[^\\s@]+/g, '[email]')", '');
      if (off === bcSrc) T('E PLANTED: build', false, 'anchor missing');
      else {
        const { pg: pg2 } = await boot(browser, { 'barcode.js': off });
        const e2 = await pg2.evaluate(p => window.rrPhotoIdRecordText(p), probe);
        T('E PLANTED: the cleaner without its email rule lets the email through (E would fail)', /@/.test(e2), e2);
        await pg2.close();
      }
    }
  } finally { await browser.close(); }

  // ── F · scans, each proven on a planted offender ──
  {
    const fn = (src) => { const a = src.indexOf('async function _biReadPicture('); const b = src.indexOf('async function _biPipelineCore('); return a > 0 && b > a ? src.slice(a, b) : ''; };
    const scanPref = (src) => {
      const body = fn(src); if (!body) return ['no _biReadPicture'];
      const bad = [];
      if (!/var _tPref = _biCloserPrefer\(opts, out\);/.test(body)) bad.push('_tPref not from _biCloserPrefer');
      if (!/var _frPref = _tPref;/.test(body)) bad.push('closer look preference not _tPref');
      // the ONE allowed read of the screen's own filter: the filter question (var _fp)
      if (/_biPreferOf\(/.test(body.replace('var _fp = _biPreferOf(opts);', ''))) bad.push('_biPreferOf called inside _biReadPicture');
      if (!/_biTurnedKeep\(_tc, _tPref, out\)/.test(body)) bad.push('turned read not kept through _tPref');
      return bad;
    };
    // every rec.<field> = … statement that carries text read off the picture
    // (ocrText) wraps it in rrPhotoIdRecordText
    const scanRec = (src) => {
      const body = fn(src); const bad = [];
      const stmts = body.split(/\brec\.(?=[a-z]+ = )/).slice(1).map(x => x.slice(0, x.indexOf(';\n') > 0 ? x.indexOf(';\n') : 400));
      if (!stmts.some(x => /^quick = /.test(x))) bad.push('no rec.quick');
      stmts.forEach(x => { const raw = x.replace(/rrPhotoIdRecordText\(ocrText\)/g, ''); if (/ocrText\)?\s*[+)]|String\(ocrText|\bocrText\b(?!\s*\?)/.test(raw.replace(/\(ocrText \? /g, ''))) bad.push('rec.' + x.slice(0, 120)); });
      return bad;
    };
    const scanWords = (src) => {
      const bad = [];
      ['turning', 'noneOfMaker'].forEach(k => { if (!new RegExp('RR_PHOTO_ID_CLOSER\\.' + k).test(src)) bad.push('RR_PHOTO_ID_CLOSER.' + k + ' unused'); });
      if (/'Lettering: reading the picture turned|couldn\\u2019t read a/.test(src)) bad.push('the words typed into barcode.js');
      return bad;
    };
    const bc = read('barcode.js');
    const p1 = scanPref(bc), r1 = scanRec(bc), w1 = scanWords(bc);
    T('F the turned read and the closer look take their maker ONLY from _biCloserPrefer', p1.length === 0, p1);
    T('F the record’s read text goes through rrPhotoIdRecordText', r1.length === 0, r1);
    T('F the words live in RR_PHOTO_ID_CLOSER (config.js), not typed into barcode.js', w1.length === 0 && /turning:/.test(read('config.js')) && /noneOfMaker:/.test(read('config.js')), w1);
    const plantP = bc.replace('var _frPref = _tPref;', 'var _frPref = _biPreferOf(opts);');
    T('F PLANTED: a closer look given _biPreferOf is caught', plantP !== bc && scanPref(plantP).length > 0, scanPref(plantP));
    const plantR = bc.replace('rrPhotoIdRecordText(ocrText)', 'String(ocrText)');
    T('F PLANTED: raw read text in the record is caught', plantR !== bc && scanRec(plantR).length > 0, scanRec(plantR));
    const plantW = bc.replace('RR_PHOTO_ID_CLOSER.turning', "'Lettering: reading the picture turned sideways…'");
    T('F PLANTED: the words typed into barcode.js are caught', plantW !== bc && scanWords(plantW).length > 0, scanWords(plantW));
  }


  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
