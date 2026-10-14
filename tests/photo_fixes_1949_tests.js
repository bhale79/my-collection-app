#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THREE PHOTO FIXES — v0.9.1949   (real Chromium, the REAL app)
//
// [stated] Brad, 2026-10-14, with four phone screenshots:
//   "1) when choosing to add a picture 1st, you cant take a picture, the button
//    just takes you to the google photo picker.  2) you should easily read this
//    number [1927690 on a Woodruff 2-pack box end], however, i think something
//    is broke on this reader as it won't read anything it seems.  3) the auto
//    reader is supposed to be gone"
//
//   A  Add a picture first, on a phone: "Take a picture" opens the CAMERA
//      (capture=environment); "Pick from this phone" opens the pictures; a
//      computer keeps one button. PLANTED: the old chooser has no camera.
//   B  the reader keeps a bare 7-digit number that the catalog knows, with no
//      "Lionel" in the shot (1927690); a 7-digit number the catalog does not
//      know, and a UPC, are still thrown away; Photo ID asks it only when
//      nothing else was read. PLANTED: without the call, 1927690 is lost.
//   C  Auto Read is off for everyone — the owner accounts included — and the
//      other beta features are not touched. PLANTED: the switch on.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  photo_fixes_1949_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 600))); cond ? pass++ : fail++; }

async function boot(browser, files) {
  const pg = await browser.newPage({ viewport: { width: 420, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url(), base = u.split('?')[0];
    for (const f of Object.keys(files || {})) if (base.endsWith('/app/' + f)) return r.fulfill({ body: files[f], contentType: 'application/javascript' });
    return u.startsWith('file://') ? r.continue() : r.abort();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(900);
  await pg.evaluate(() => {
    // file pickers never open in a test: record what the app asked for instead
    window.__picks = [];
    HTMLInputElement.prototype.click = function () { if (this.type === 'file') window.__picks.push({ accept: this.accept, capture: this.getAttribute('capture') }); };
  });
  return { pg, errs };
}
const chooser = (pg, mobile) => pg.evaluate(m => {
  window.IS_MOBILE_UA = m;
  if (typeof wizard === 'undefined' || !wizard.data) { try { wizard = { data: {}, tab: 'collection', step: 0, steps: [] }; } catch (e) {} }
  _wizPicFirstChoose();
  const ov = document.getElementById('wiz-picfirst-choose');
  return { buttons: ov ? [...ov.querySelectorAll('button')].map(b => (b.getAttribute('data-pfc') || '') + ':' + b.textContent.trim()) : [] };
}, mobile);

(async function () {
  const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
  try {
    const { pg, errs } = await boot(browser);

    // ── A · the camera ──
    const a1 = await chooser(pg, true);
    T('A on a phone the box offers Take a picture, Pick from this phone, Google Photos and Cancel',
      a1.buttons.map(b => b.split(':')[0]).join(',') === 'camera,local,gphotos,cancel' && /Take a picture/.test(a1.buttons[0]) && /Pick from this phone/.test(a1.buttons[1]), a1);
    await pg.click('#wiz-picfirst-choose [data-pfc="camera"]');
    const p1 = await pg.evaluate(() => window.__picks.slice(-1)[0]);
    T('A Take a picture opens the CAMERA (capture=environment)', p1 && p1.capture === 'environment' && p1.accept === 'image/*', p1);
    await chooser(pg, true);
    await pg.click('#wiz-picfirst-choose [data-pfc="local"]');
    const p2 = await pg.evaluate(() => window.__picks.slice(-1)[0]);
    T('A Pick from this phone opens the pictures (no camera forced)', p2 && !p2.capture, p2);
    const a3 = await chooser(pg, false);
    T('A on a computer: one "From this computer" button, no camera', a3.buttons.map(b => b.split(':')[0]).join(',') === 'local,gphotos,cancel' && /computer/.test(a3.buttons[0]), a3);
    await pg.evaluate(() => { const o = document.getElementById('wiz-picfirst-choose'); if (o) o.remove(); });

    // ── B · the 7-digit number ──
    const b = await pg.evaluate(async () => {
      state.masterAllRows = [{ itemNum: '1927690', variation: '', description: "Woodruff Sleeping and Parlor 1860's Coach 2 Pack", manufacturer: 'Lionel', _era: 'mod', _tab: 'Lionel MPC-Modern' }];
      state.masterData = state.masterAllRows.slice();
      try { _rebuildMasterIndex(); } catch (e) {}
      const box = "Woodruff Sleeping Car 2 Pack\n* Includes two coaches\n* Die-cast trucks\n* Drawbar couplers\n1927690\nFOR AGES 14 TO ADULT";
      return {
        hit: await window._bcSevenDigitInCatalog(box),
        stray: await window._bcSevenDigitInCatalog('Made in China 7654321 batch'),
        upc: await window._bcSevenDigitInCatalog('0 23922 19276 90 UPC 023922192769'),
      };
    });
    T('B 1927690 is read with no "Lionel" anywhere in the shot — the catalog knows it', JSON.stringify(b.hit) === JSON.stringify([{ raw: '1927690', mfr: 'Lionel' }]), b.hit);
    T('B a 7-digit number the catalog does not know is still thrown away', b.stray.length === 0, b.stray);
    T('B a UPC is still stripped first, never read as an item number', b.upc.length === 0, b.upc);
    const runPhotoId = (page) => page.evaluate(async () => {
      // the real Photo ID stages on a drawn canvas; the free reader hands back
      // exactly the box end's words (Brad's photo, no "Lionel" in it)
      state.masterAllRows = [{ itemNum: '1927690', variation: '', description: "Woodruff Sleeping and Parlor 1860's Coach 2 Pack", manufacturer: 'Lionel', _era: 'mod', _tab: 'Lionel MPC-Modern' }];
      state.masterData = state.masterAllRows.slice(); try { _rebuildMasterIndex(); } catch (e) {}
      window.Tesseract = { recognize: async () => ({ data: { text: "Woodruff Sleeping Car 2 Pack\n* Includes two coaches\n* Die-cast trucks\n1927690\nFOR AGES 14 TO ADULT" } }) };
      const c = document.createElement('canvas'); c.width = 400; c.height = 300;
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 400, 300);
      window._biPipelineOnCanvas(c, { noAi: true });
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 100));
        const t = (document.getElementById('bi-stages') || {}).textContent || '';
        if (/Lettering:/.test(t) && /Catalog:/.test(t) && !/Catalog: checking/.test(t)) return t;
      }
      return (document.getElementById('bi-stages') || {}).textContent || '';
    });
    const stages = await runPhotoId(pg);
    T('B Photo ID on the box end: "Lettering: found 1927690" and the catalog takes it', /Lettering: ✓ found 1927690/.test(stages) && !/no item number read/.test(stages), stages);
    await pg.evaluate(() => { const o = document.getElementById('bi-overlay'); if (o) o.remove(); });

    // ── C · Auto Read ──
    const c = await pg.evaluate(() => {
      state.user = { email: 'support@therailroster.com' };
      return { owner: rrIsRealOwner(), autoRead: rrAutoReadOn(), otherBeta: rrFeatureOn('some_other_beta'), aiGate: null };
    });
    T('C Auto Read is off on an owner account (support@, the demo account)', c.owner === true && c.autoRead === false, c);
    T('C …the other beta features still follow the owner rule', c.otherBeta === true, c);
    const c2 = await pg.evaluate(async () => {
      state.user = { email: 'tester@example.com' };
      window._subState = { features: ['auto_read'] };
      const r = rrAutoReadOn();
      const ai = (typeof aiIdentifyImage === 'function') ? await aiIdentifyImage(document.createElement('canvas'), {}).catch(e => ({ err: String(e) })) : null;
      return { r, reason: ai && ai.reason };
    });
    T('C …and off for a beta tester whose ring includes it — no paid read can start', c2.r === false && c2.reason === 'notbeta', c2);
    T('page errors', errs.length === 0, errs);
    await pg.close();

    // ── PLANTED ──
    const wz = read('wizard.js');
    const oldChooser = wz.replace("      (window.IS_MOBILE_UA ? '<button type=\"button\" data-pfc=\"camera\">' + RR_PIC_FIRST.takePhoto + '</button>' : '') +\n", '');
    if (oldChooser === wz) T('A PLANTED: could plant the old chooser', false);
    else {
      const q = await boot(browser, { 'wizard.js': oldChooser });
      const pa = await chooser(q.pg, true);
      T('A PLANTED: the old chooser has no camera button (A would fail)', !pa.buttons.some(x => /^camera:/.test(x)), pa);
      await q.pg.close();
    }
    const bc = read('barcode.js');
    const bcOld = bc.replace("      try { rawCands = await _bcSevenDigitInCatalog(ocrText); } catch (e7) { rawCands = []; }\n", '');
    if (bcOld === bc) T('B PLANTED: could plant the reader without the catalog check', false);
    else {
      const q = await boot(browser, { 'barcode.js': bcOld });
      const st = await runPhotoId(q.pg);
      T('B PLANTED: without the catalog check the same photo reads "no item number" (B would fail)', /no item number read/.test(st), st);
      await q.pg.close();
    }
    const cf = read('config.js');
    const arOn = cf.replace('var RR_AUTO_READ_ON = false;', 'var RR_AUTO_READ_ON = true;');
    if (arOn === cf) T('C PLANTED: could plant the switch on', false);
    else {
      const q = await boot(browser, { 'config.js': arOn });
      const on = await q.pg.evaluate(() => { state.user = { email: 'support@therailroster.com' }; return rrAutoReadOn(); });
      T('C PLANTED: with the switch on, the owner account gets Auto Read again (C would fail)', on === true, on);
      await q.pg.close();
    }
  } finally { await browser.close(); }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  if (fail) { console.log('PHOTO FIXES 1949 TESTS FAILING'); process.exit(1); }
  console.log('ALL PHOTO FIXES 1949 TESTS GREEN (' + pass + ')');
})().catch(e => { console.log('FAIL  crashed: ' + (e && e.stack || e)); process.exit(1); });
