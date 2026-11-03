#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// PHOTO ID — THE BARCODE'S MAKER NARROWS THE CLOSER LOOK — ITS PLANTED OFFENDER (C, split off so no Chromium suite runs past 180 s)
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
catch (e) { console.log('FAILED  —  photoid_closer_planted_tests needs playwright and it is not installed.'); process.exit(1); }
const { PIC, NUMS, BC, read, boot, runOn, lionelShown } = require('./lib/photoid-harness.js');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 900))); cond ? pass++ : fail++; }

(async function () {
  const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
  const b64 = fs.readFileSync(PIC).toString('base64');
  const bcSrc = read('barcode.js');
  try {
    // ── C PLANTED · the closer look given only the screen's filters (the old code) ──
    {
      const old = bcSrc.replace('var _tPref = _biCloserPrefer(opts, out);', 'var _tPref = _biPreferOf(opts);');
      if (old === bcSrc) T('C PLANTED: build', false, 'anchor missing');
      else {
        const { pg: pg2 } = await boot(browser, { 'barcode.js': old });
        const p = await runOn(pg2, b64, { turn: 90, bc: BC, noTurns: true, closerAs: ['105', '283', '193'] });
        T('C PLANTED: the closer look without the barcode’s maker offers or uses a Lionel number (Mike’s screen; C would fail)', lionelShown(p).length > 0, { t: p.t, btns: p.btns, rec: p.rec });
        await pg2.close();
      }
    }
  } finally { await browser.close(); }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
