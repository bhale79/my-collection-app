#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// "LIONEL No. 6120" IS THE ITEM NUMBER — v0.9.1980
//
// Brad, 2026-10-17, Photo Inbox, a yellow work caboose: "the number was found
// but i got this" — the paid reader answered "This model train car is a Lionel
// No. 6120 Unmarked Work Caboose…" and the card said "No number picked up
// automatically". extractIdentifyMetadata (wizard-photos.js) found 6120 as the
// item number; the loose cab-number pattern ("No. ####") found the same 6120 as
// a cab number; and the Weaver Blue Goose defense (item number = cab number →
// a mix-up, drop the item number) threw it away. Brad: "yes".
//
//   M1  "Lionel No. 6120 …" → item number 6120, not hedged, no cab number
//   M2  "Lionel's No. 6120", "Lionel postwar No. 6120", "American Flyer No. 630"
//   K1  two LABELED lines that agree (SKU 3460 / Cab Number 3460) → still a mix-up
//   K2  "A Lionel 2037 …, No. 6110 painted on the cab" → 6110 still kept out
//   K3  "…with No. 6110 painted on the cab" (not straight after the maker) → kept out
//   X*  PLANTED: the fix undone, and a too-loose fix, are both caught
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  maker_no_1980_tests needs playwright and it is not installed.'); process.exit(1); }
const APPDIR = path.join(__dirname, '..', 'app');
const WP = fs.readFileSync(path.join(APPDIR, 'wizard-photos.js'), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + JSON.stringify(detail).slice(0, 500))); cond ? pass++ : fail++; }
function planted(src, from, to, what) {
  if (src.indexOf(from) < 0) throw new Error('planted ' + what + ': the line moved; update this test');
  return src.replace(from, to);
}
const CASES = {
  caboose: "This model train car is a Lionel No. 6120 Unmarked Work Caboose, which was manufactured during Lionel's classic post-war era between 1961 and 1963.",
  apos: 'This is Lionel’s No. 6120 work caboose from 1961.',
  words: 'A Lionel postwar No. 6120 work caboose, 1961-63.',
  flyer: 'This is an American Flyer No. 630 caboose.',
  labeled: 'Manufacturer: Weaver\nManufacturer SKU: 3460\nCab Number: 3460\nDescription: Blue Goose',
  painted: 'A Lionel 2037 steam locomotive, No. 6110 painted on the cab.',
  farOff: 'A Lionel steam engine with No. 6110 painted on the cab.',
};

(async () => {
  const ex = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(ex) ? { executablePath: ex } : {});
  const parse = async (src) => {
    const ctx = await browser.newContext();
    const pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.route('**', rt => {
      const u = rt.request().url();
      if (!u.startsWith('file://')) return rt.abort();
      if (src && u.split('?')[0].endsWith('/app/wizard-photos.js')) return rt.fulfill({ body: src, contentType: 'application/javascript' });
      return rt.continue();
    });
    await pg.goto('file://' + path.join(APPDIR, 'index.html'), { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(900);
    const out = await pg.evaluate((cases) => {
      const r = {};
      Object.keys(cases).forEach(k => { const m = extractIdentifyMetadata(cases[k]); r[k] = { num: m.itemNum || '', cab: m.cabNum || '', hedge: !!m._hedge }; });
      return r;
    }, CASES);
    await ctx.close();
    return { out, errs };
  };

  console.log('== M · "maker No. N" is the item number ==');
  let { out: r, errs } = await parse(null);
  T('M1 "Lionel No. 6120 Unmarked Work Caboose" → 6120, not hedged, no cab number', r.caboose.num === '6120' && !r.caboose.hedge && !r.caboose.cab, r.caboose);
  T('M2 "Lionel’s No. 6120" → 6120', r.apos.num === '6120' && !r.apos.hedge, r.apos);
  T('M2 "Lionel postwar No. 6120" → 6120', r.words.num === '6120' && !r.words.hedge, r.words);
  T('M2 "American Flyer No. 630" → 630', r.flyer.num === '630' && !r.flyer.hedge, r.flyer);
  console.log('== K · the defense still stands where it belongs ==');
  T('K1 labeled SKU 3460 + labeled Cab Number 3460 → still a mix-up: no item number, hedged', !r.labeled.num && r.labeled.hedge && r.labeled.cab === '3460', r.labeled);
  T('K2 "A Lionel 2037 …, No. 6110 painted on the cab" → 6110 is not the item number', r.painted.num !== '6110' && r.painted.hedge, r.painted);
  T('K3 "…with No. 6110 painted on the cab" → 6110 is not the item number', r.farOff.num !== '6110' && r.farOff.hedge, r.farOff);
  T('page errors', errs.length === 0, errs);

  console.log('== X · planted ==');
  let x = await parse(planted(WP, '    if (_makersNo) {\n      delete out.cabNum;', '    if (false) {\n      delete out.cabNum;', 'maker rule'));
  T('X-M1 PLANTED: the fix undone → "Lionel No. 6120" loses its number again (caught)', !x.out.caboose.num && x.out.caboose.hedge, x.out.caboose);
  x = await parse(planted(WP, '    if (_makersNo) {\n      delete out.cabNum;', '    if (true) {\n      delete out.cabNum;', 'too loose'));
  T('X-K PLANTED: keeping every same number → the painted cab number and the labeled mix-up get through (caught)',
    x.out.painted.num === '6110' || x.out.labeled.num === '3460', { painted: x.out.painted, labeled: x.out.labeled });

  await browser.close();
  console.log('\n' + (fail ? 'FAILED' : 'ALL PASS') + '  —  ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAILED  —  ' + (e && e.stack || e)); process.exit(1); });
