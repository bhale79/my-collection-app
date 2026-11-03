#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// PHOTO ID — FILTERED TO ONE MAKER, BARCODE SAYS ANOTHER → ASK (G)
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
catch (e) { console.log('FAILED  —  photoid_filter_ask_tests needs playwright and it is not installed.'); process.exit(1); }
const { PIC, NUMS, BC, read, boot, runOn, lionelShown } = require('./lib/photoid-harness.js');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 900))); cond ? pass++ : fail++; }

(async function () {
  const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
  const b64 = fs.readFileSync(PIC).toString('base64');
  const bcSrc = read('barcode.js');
  try {
    // ── G · filtered to Lionel, barcode MTH → ask (Brad 11:51 CT) ──
    for (const choice of ['fclear', 'fkeep']) {
      const { pg, errs } = await boot(browser);
      const r = await pg.evaluate(async ([b64, bc, choice]) => {
        wizard.data = wizard.data || {}; wizard.data._searchFilterManufacturer = 'Lionel'; wizard.data._searchFilterPeriod = 'postwar';
        const img = new Image(); img.src = 'data:image/jpeg;base64,' + b64; await img.decode();
        const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d').drawImage(img, 0, 0);
        window._biPipelineOnCanvas(c, { noAi: true, addFilters: true, lockedBc: { rawValue: bc, format: 'ean_13' }, source: 'test' });
        let ask = '', t = '';
        for (let i = 0; i < 400; i++) {
          await new Promise(r => setTimeout(r, 100));
          const a = document.querySelector('#bi-actions');
          if (a && a.querySelector('[data-bi="fclear"]')) { ask = a.textContent.replace(/\s+/g, ' ').trim(); t = ((document.getElementById('bi-stages') || {}).textContent || '').replace(/\s+/g, ' '); a.querySelector('[data-bi="' + choice + '"]').click(); break; }
        }
        let fin = '';
        for (let i = 0; i < 1600; i++) {
          await new Promise(r => setTimeout(r, 150));
          fin = ((document.getElementById('bi-stages') || {}).textContent || '').replace(/\s+/g, ' ');
          if (/Lettering:/.test(fin) && /Catalog:/.test(fin) && !/Catalog: checking/.test(fin)) break;
        }
        let rec = null; try { rec = JSON.parse(localStorage.getItem(RR_PHOTO_ID_CLOSER.recordKey) || '[]').slice(-1)[0] || null; } catch (e) {}
        const o = document.getElementById('bi-overlay'); if (o) o.remove();
        return { ask, t, fin, rec, mfr: wizard.data._searchFilterManufacturer, period: wizard.data._searchFilterPeriod };
      }, [b64, BC, choice]);
      T('G (' + choice + ') the question, in Brad\u2019s words', /The barcode says MTH but your filter is Lionel \u2014 clear the filter\?/.test(r.ask) && /Clear the filter/.test(r.ask) && /Keep my filter/.test(r.ask) && /Barcode says MTH \u2014 your filter is Lionel/.test(r.t), r);
      if (choice === 'fclear') T('G Clear the filter: the Add filters are cleared and the read goes on to 20-2471-3', r.mfr === '' && r.period === '' && /20-2471-3/.test(r.fin) && r.rec && /cleared/.test(r.rec.filter), r);
      else T('G Keep my filter: the filter stays, and no MTH number is used under it', r.mfr === 'Lionel' && r.period === 'postwar' && !/Catalog: ✓ 20-2471-3/.test(r.fin) && r.rec && /kept/.test(r.rec.filter), r);
      T('G (' + choice + ') no page errors', !errs.length, errs);
      await pg.close();
    }
    {
      const { pg } = await boot(browser);
      const n = await pg.evaluate(async ([b64, bc]) => {
        wizard.data = wizard.data || {}; wizard.data._searchFilterManufacturer = 'MTH';
        const img = new Image(); img.src = 'data:image/jpeg;base64,' + b64; await img.decode();
        const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d').drawImage(img, 0, 0);
        window._biPipelineOnCanvas(c, { noAi: true, addFilters: true, lockedBc: { rawValue: bc, format: 'ean_13' } });
        let asked = false, fin = '';
        for (let i = 0; i < 1600; i++) {
          await new Promise(r => setTimeout(r, 150));
          if (document.querySelector('#bi-actions [data-bi="fclear"]')) asked = true;
          fin = ((document.getElementById('bi-stages') || {}).textContent || '').replace(/\s+/g, ' ');
          if (/Lettering:/.test(fin) && /Catalog:/.test(fin) && !/Catalog: checking/.test(fin)) break;
        }
        const o = document.getElementById('bi-overlay'); if (o) o.remove();
        return { asked, fin };
      }, [b64, BC]);
      T('G filter and barcode agree (MTH) → no question, reads 20-2471-3', !n.asked && /Catalog: ✓ 20-2471-3/.test(n.fin), n);
      await pg.close();
    }
    // ── H · an upright picture with words but no number costs no extra time ──
    // (Brad's Woodruff screenshot, tests/fixtures/woodruff_screen_1927690.jpg: the
    // quick read finds no number but is sure of many words → no turned read; the
    // closer look is stood in for, fast — photo_choices_1951_tests runs it for real)
    const wood = fs.readFileSync(path.join(__dirname, 'fixtures', 'woodruff_screen_1927690.jpg')).toString('base64');
    for (const planted of [false, true]) {
      const { pg, errs } = await boot(browser);
      const h = await pg.evaluate(async ([b64, planted]) => {
        window.rrFreeReadBlob = async () => ({ num: '', matched: false, dbg: { inEra: [], offEra: [] } });
        if (planted) RR_PHOTO_ID_CLOSER.turnBelowWords = 9999;
        const img = new Image(); img.src = 'data:image/jpeg;base64,' + b64; await img.decode();
        const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d').drawImage(img, 0, 0);
        window._biPipelineOnCanvas(c, { noAi: true });
        let fin = '';
        for (let i = 0; i < 1200; i++) {
          await new Promise(r => setTimeout(r, 150));
          fin = ((document.getElementById('bi-stages') || {}).textContent || '').replace(/\s+/g, ' ');
          if (/Lettering:/.test(fin) && /Catalog:/.test(fin) && !/Catalog: checking/.test(fin)) break;
        }
        let rec = null; try { rec = JSON.parse(localStorage.getItem(RR_PHOTO_ID_CLOSER.recordKey) || '[]').slice(-1)[0] || null; } catch (e) {}
        const o = document.getElementById('bi-overlay'); if (o) o.remove();
        return { rec, fin };
      }, [wood, planted]);
      const sure = h.rec && +((h.rec.quick.match(/\[sure words (\d+)\]/) || [])[1] || -1);
      if (!planted) {
        T('H upright Woodruff screenshot: no number read, but sure of ' + sure + ' words → no turned read', h.rec && /^no number/.test(h.rec.quick) && sure >= 3 && !h.rec.turned, h.rec);
        T('H no page errors', !errs.length, errs);
      } else T('H PLANTED: with the word rule off, the same picture is read turned (H would fail)', h.rec && /90:/.test(h.rec.turned || ''), h.rec);
      await pg.close();
    }
  } finally { await browser.close(); }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
