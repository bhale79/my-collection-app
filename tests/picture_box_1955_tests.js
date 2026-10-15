#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// THE YOUR PICTURE BOX — v0.9.1955   (real Chromium, the REAL app)
//
// [stated] Brad, 2026-10-15, on the Add screen with his Woodruff screenshot in
// the Your Picture box: "2 things, 1) need the crop option on the your picture
// box. I don't have a way to make it better from here. 2) lets have a option
// check box that when you load a picture, it automatically starts to read it
// in the background and have the results pop up under the picture where i put
// the red box. move the your picture box up even with the top of the
// collection box". He said "yes" to: Change · ✂ Crop · Remove; a "Read it
// automatically" tick that follows the account; answers in the box (one sure
// answer / several to choose from / none, with Photo ID and Google Lens);
// Read picture answers in the same place; the box as tall as the Add screen;
// Photo ID and the box sharing ONE reading step.
//
//   L  the box's top is level with the Add screen's, and it is as tall
//      (two window sizes). PLANTED: without the fit, the tops differ.
//   K  ✂ Crop sits between Change and Remove and opens the app's crop tool
//      titled "Crop your picture"; the cropped picture REPLACES the one added
//      (it is the one that goes in as the first photo). PLANTED: no button.
//   R  "Read it automatically": unticked to start; ticking it is saved through
//      the account door (_prefSet: value + stamp) and reads at once; with it
//      on, a NEW picture reads with no button pressed; with it off, nothing
//      reads by itself. The sure answer fills the number and moves on.
//   C  several numbers → each with its catalog line, longest first, and "None
//      of these" → the none message with Photo ID and Google Lens.
//   S  a read that finishes AFTER the picture changed is thrown away — the box
//      only ever shows the answer for the picture it is showing.
//   O  ONE reading step: Photo ID's pipeline and the box both call
//      _biReadPicture, and the closer look lives only there. PLANTED.
//   W  the REAL reader (Tesseract.js) in the box: Brad's whole-screen
//      screenshot → choices with 1927690 first; the cropped box photo → one
//      sure answer, 1927690.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  picture_box_1955_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const FIX = path.join(__dirname, 'fixtures');
const PIC = path.join(FIX, 'woodruff_1927690.jpg');
const SCREEN = path.join(FIX, 'woodruff_screen_1927690.jpg');
const CROPPER_JS = fs.readFileSync(path.join(FIX, 'cropper-1.6.1.min.js'));
const CROPPER_CSS = fs.readFileSync(path.join(FIX, 'cropper-1.6.1.min.css'));
const SCREEN_ROWS = JSON.parse(fs.readFileSync(path.join(FIX, 'woodruff_screen_rows.json'), 'utf8'));
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 700))); cond ? pass++ : fail++; }

const ROWS = [
  { itemNum: '1927690', variation: '', description: "Woodruff Sleeping and Parlor 1860's Coach 2 Pack", manufacturer: 'Lionel', _era: 'mod', _tab: 'Lionel MPC-Modern', itemType: 'Passenger Car' },
  { itemNum: '6014-85', variation: '1', description: 'Bosco Boxcar', manufacturer: 'Lionel', _era: 'pw', _tab: 'Lionel PW - Items', itemType: 'Boxcar' },
];

async function boot(browser, o) {
  o = o || {};
  const pg = await browser.newPage({ viewport: { width: o.w || 1536, height: o.h || 826 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url(), base = u.split('?')[0];
    for (const f of Object.keys(o.files || {})) if (base.endsWith('/app/' + f)) return r.fulfill({ body: o.files[f], contentType: f.endsWith('.css') ? 'text/css' : 'application/javascript' });
    if (/cropperjs/.test(u) && /\.js$/.test(base)) return r.fulfill({ body: CROPPER_JS, contentType: 'application/javascript' });
    if (/cropperjs/.test(u) && /\.css$/.test(base)) return r.fulfill({ body: CROPPER_CSS, contentType: 'text/css' });
    if (u.startsWith('file://')) return r.continue();
    if (o.ocr && (u.startsWith('https://cdn.jsdelivr.net/') || u.startsWith('https://tessdata.projectnaptha.com/'))) return r.continue();
    return r.abort();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(900);
  await pg.evaluate(rows => {
    state.masterData = rows.slice(); try { _rebuildMasterIndex(); } catch (e) {}
    state.masterByItemAll = state.masterByItem; state.masterAllRows = rows.slice(); window._allIdxComplete = true;
    state.personalData = {}; state.personalSheetId = 'SID'; accessToken = 'tok';
    window.__lens = []; window._identifyOpenWithPhoto = function (f) { window.__lens.push({ size: f && f.size }); };
    try { localStorage.removeItem('rr_picfirst_autoread'); localStorage.removeItem('rr_picfirst_autoread__at'); } catch (e) {}
    try { _aiUsageMarkSeen(); } catch (e) {}
    startWizardFor('collection');
  }, o.rows || ROWS);
  await pg.waitForTimeout(900);
  return { pg, errs };
}
async function addPicture(pg, file) {
  await pg.click('#wiz-picfirst-btn');
  await pg.waitForSelector('#wiz-picfirst-choose [data-pfc="local"]');
  const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('#wiz-picfirst-choose [data-pfc="local"]')]);
  await fc.setFiles(file || PIC);
  await pg.waitForTimeout(700);
}
// fast stand-ins for the read itself (W runs the real one)
const fastReader = (pg, fr) => pg.evaluate((fr) => {
  window.Tesseract = { recognize: async () => ({ data: { text: '' } }) };
  window.__reads = 0;
  window.rrFreeReadBlob = async () => { window.__reads++; return fr; };
}, fr || { num: '1927690', matched: true });
const box = pg => pg.evaluate(() => {
  const b = document.getElementById('wiz-picfirst-result');
  return { text: b ? b.textContent.replace(/\s+/g, ' ').trim() : null,
           items: b ? [...b.querySelectorAll('.wiz-pf-item b')].map(x => x.textContent) : [],
           busy: !!(b && b.querySelector('.wiz-pf-spin')) };
});
async function waitBox(pg, fn, ms) {
  for (let i = 0; i < (ms || 8000) / 120; i++) { const b = await box(pg); if (fn(b)) return b; await pg.waitForTimeout(120); }
  return box(pg);
}
const level = pg => pg.evaluate(() => {
  const m = document.querySelector('#wizard-modal .modal').getBoundingClientRect();
  const p = document.getElementById('wiz-picfirst-panel'); const r = p ? p.getBoundingClientRect() : null;
  return r ? { mTop: Math.round(m.top), pTop: Math.round(r.top), mH: Math.round(m.height), pH: Math.round(r.height) } : null;
});

(async function () {
  const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
  try {
    // ── L · level with the Add screen ──
    for (const sz of [{ n: 'Brad 1920×1032 at 125%', w: 1536, h: 826 }, { n: '1280×720', w: 1280, h: 720 }]) {
      const { pg, errs } = await boot(browser, { w: sz.w, h: sz.h });
      await addPicture(pg);
      const l = await level(pg);
      T('L ' + sz.n + ': the box\'s top is level with the Add screen\'s', l && Math.abs(l.pTop - l.mTop) <= 2, l);
      T('L ' + sz.n + ': …and it is as tall', l && Math.abs(l.pH - l.mH) <= 2, l);
      T('L ' + sz.n + ': page errors', errs.length === 0, errs);
      await pg.close();
    }
    {
      const wz = read('wizard.js');
      const old = wz.replace("  if (h > 0) p.style.height = Math.round(h / pz) + 'px';\n", '');
      if (old === wz) T('L PLANTED: could plant the box without the fit', false);
      else {
        const { pg } = await boot(browser, { files: { 'wizard.js': old } });
        await addPicture(pg);
        const l = await level(pg);
        T('L PLANTED: without the fit the tops are not level (L would fail)', l && Math.abs(l.pTop - l.mTop) > 2, l);
        await pg.close();
      }
    }

    // ── K · crop ──
    {
      const { pg, errs } = await boot(browser);
      await addPicture(pg);
      const order = await pg.evaluate(() => [...document.querySelectorAll('#wiz-picfirst-panel .wiz-picfirst-acts button')].map(b => b.getAttribute('data-pf')).join(','));
      T('K the buttons read Change · Crop · Remove', order === 'change,crop,remove', order);
      await pg.click('#wiz-picfirst-panel [data-pf="crop"]');
      await pg.waitForTimeout(900);
      const opened = await pg.evaluate(() => /Crop your picture/.test(document.body.innerText) && !!document.querySelector('.cropper-container'));
      T('K Crop opens the app\'s crop tool, titled "Crop your picture"', opened, opened);
      // the crop itself: the tool hands back a smaller picture
      const k = await pg.evaluate(async () => {
        document.querySelectorAll('body > div').forEach(d => { if (/Crop your picture/.test(d.innerText || '') && getComputedStyle(d).position === 'fixed') d.remove(); });
        const before = wizard.data._idItemPhotoFile;
        window._openCropper = function (src, onResult) {
          const c = document.createElement('canvas'); c.width = 200; c.height = 100;
          const x = c.getContext('2d'); x.fillStyle = '#c33'; x.fillRect(0, 0, 200, 100);
          c.toBlob(b => onResult(b), 'image/jpeg', 0.9);
        };
        document.querySelector('#wiz-picfirst-panel [data-pf="crop"]').click();
        await new Promise(r => setTimeout(r, 900));
        const after = wizard.data._idItemPhotoFile;
        const img = document.querySelector('#wiz-picfirst-panel img');
        await new Promise(r => setTimeout(r, 300));
        return { replaced: after && after !== before, name: after && after.name, w: img ? img.naturalWidth : 0, picFirst: !!wizard.data._picFirst };
      });
      T('K the cropped picture REPLACES the one added (and still goes in first)', k.replaced && /-cropped\.jpg$/.test(k.name) && k.picFirst, k);
      T('K …and the box shows it', k.w === 200, k);
      T('K page errors', errs.length === 0, errs);
      await pg.close();
    }
    {
      const wz = read('wizard.js');
      const old = wz.replace(`      '<button type="button" data-pf="crop">' + RR_PIC_FIRST.cropBtn + '</button>' +\n`, '')
                    .replace(`  p.querySelector('[data-pf="crop"]').onclick = function () { _wizPicFirstCrop(); };\n`, '');
      if (old === wz) T('K PLANTED: could plant the box without Crop', false);
      else {
        const { pg } = await boot(browser, { files: { 'wizard.js': old } });
        await addPicture(pg);
        const has = await pg.evaluate(() => !!document.querySelector('#wiz-picfirst-panel [data-pf="crop"]'));
        T('K PLANTED: the old box has no Crop (K would fail)', !has, has);
        await pg.close();
      }
    }

    // ── R · read automatically ──
    {
      const { pg, errs } = await boot(browser);
      await fastReader(pg);
      await addPicture(pg);
      let r0 = await pg.evaluate(() => ({ ticked: document.querySelector('#wiz-picfirst-panel [data-pf="auto"]').checked, label: document.querySelector('.wiz-picfirst-auto').textContent.trim(), reads: window.__reads }));
      const b0 = await box(pg);
      T('R "Read it automatically" is there and starts UNticked', !r0.ticked && /Read it automatically/.test(r0.label), r0);
      T('R …unticked, adding a picture reads nothing by itself', r0.reads === 0 && !b0.text, { r0, b0 });
      await pg.click('#wiz-picfirst-panel [data-pf="auto"]');
      const saved = await pg.evaluate(() => ({ v: localStorage.getItem('rr_picfirst_autoread'), at: Number(localStorage.getItem('rr_picfirst_autoread__at') || 0) }));
      T('R ticking it is saved through the ACCOUNT door (value + stamp)', saved.v === '1' && saved.at > 1700000000000, saved);
      let b = await waitBox(pg, x => x.items.length);
      T('R ticking it reads the picture at once: "Found it" 1927690', /Found it/.test(b.text) && b.items[0] === '1927690', b);
      // a NEW picture with the tick on reads by itself
      await pg.evaluate(() => { window.__reads = 0; });
      await pg.click('#wiz-picfirst-panel [data-pf="change"]');
      await pg.waitForSelector('#wiz-picfirst-choose [data-pfc="local"]');
      const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('#wiz-picfirst-choose [data-pfc="local"]')]);
      await fc.setFiles(SCREEN);
      b = await waitBox(pg, x => x.items.length);
      const n2 = await pg.evaluate(() => window.__reads);
      T('R with the tick on, a NEW picture reads with no button pressed', n2 >= 1 && b.items[0] === '1927690', { n2, b });
      await pg.click('#wiz-picfirst-result .wiz-pf-item');
      await pg.waitForTimeout(800);
      const after = await pg.evaluate(() => ({ num: wizard.data.itemNum, step: wizard.step, same: wizard.data._picFirst }));
      T('R tapping the answer fills the item number and moves on', after.num === '1927690' && after.step >= 1, after);
      T('R page errors', errs.length === 0, errs);
      await pg.close();
    }

    // ── C · several numbers, and none of these ──
    {
      const { pg, errs } = await boot(browser);
      await fastReader(pg, { num: '6014', matched: false, dbg: { inEra: ['6014-85:pw', '1927690:mpc'], offEra: [] } });
      await addPicture(pg);
      await pg.click('#wiz-picfirst-panel [data-pf="read"]');
      const b = await waitBox(pg, x => x.items.length);
      const lines = await pg.evaluate(() => [...document.querySelectorAll('#wiz-picfirst-result .wiz-pf-item span')].map(s => s.textContent));
      T('C several numbers: "Which one is yours?", longest first', /Which one is yours/.test(b.text) && b.items.join(',') === '1927690,6014-85', b);
      T('C …each with its catalog line', /Woodruff/.test(lines[0] || '') && /Lionel MPC-Modern/.test(lines[0] || '') && /Bosco/.test(lines[1] || ''), lines);
      await pg.click('#wiz-picfirst-result [data-pfr="none"]');
      const n = await box(pg);
      const alts = await pg.evaluate(() => [...document.querySelectorAll('#wiz-picfirst-result [data-pfr]')].map(x => x.getAttribute('data-pfr')).join(','));
      T('C "None of these" → couldn\'t read, with Photo ID and Google Lens', /Couldn.t read a number/.test(n.text) && alts === 'photoid,lens', { n, alts });
      await pg.click('#wiz-picfirst-result [data-pfr="lens"]');
      const lens = await pg.evaluate(() => window.__lens.length);
      T('C …Google Lens gets the picture', lens === 1, lens);
      T('C page errors', errs.length === 0, errs);
      await pg.close();
    }

    // ── S · a stale answer is thrown away ──
    {
      const { pg, errs } = await boot(browser);
      await pg.evaluate(() => {
        window.Tesseract = { recognize: async () => ({ data: { text: '' } }) };
        let n = 0;
        window.rrFreeReadBlob = async () => { n++; if (n === 1) { await new Promise(r => setTimeout(r, 2000)); return { num: '6014-85', matched: true }; } return { num: '1927690', matched: true }; };
        window._openCropper = function (src, onResult) { const c = document.createElement('canvas'); c.width = 120; c.height = 80; c.toBlob(b => onResult(b), 'image/jpeg', 0.9); };
        localStorage.setItem('rr_picfirst_autoread', '1');
      });
      await addPicture(pg);                                    // read 1 starts (slow, would say 6014-85)
      await pg.waitForTimeout(300);
      await pg.click('#wiz-picfirst-panel [data-pf="crop"]');  // the picture changes → read 2 (fast, 1927690)
      await pg.waitForTimeout(3000);                            // read 1 finishes last
      const b = await box(pg);
      T('S the box shows only the answer for the picture it shows (the late, stale 6014-85 is dropped)', b.items.join(',') === '1927690', b);
      T('S page errors', errs.length === 0, errs);
      await pg.close();
    }

    // ── O · one reading step ──
    {
      const bc = read('barcode.js');
      const body = (src, head) => { const i = src.indexOf(head); if (i < 0) return ''; let d = 0, s0 = src.indexOf('{', i); for (let k = s0; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } return ''; };
      const core = body(bc, 'async function _biPipelineCore('), boxFn = body(bc, 'async function rrReadPictureFile('), rp = body(bc, 'async function _biReadPicture(');
      const one = (src) => {
        const c = body(src, 'async function _biPipelineCore('), b = body(src, 'async function rrReadPictureFile('), r = body(src, 'async function _biReadPicture(');
        return /await _biReadPicture\(/.test(c) && /await _biReadPicture\(/.test(b) && /RR_PHOTO_ID_CLOSER\.reading/.test(r)
          && (src.match(/window\.rrFreeReadBlob\(/g) || []).length === 1 && !/rrFreeReadBlob/.test(c) && !/rrFreeReadBlob/.test(b);
      };
      T('O Photo ID and the box both read through _biReadPicture; the closer look lives only there', one(bc), { core: core.length, box: boxFn.length, rp: rp.length });
      const planted = bc.replace("    var rp = await _biReadPicture(c, c, null, ctl.eraHint || '', {}, say, stopped);",
        "    var _frB = await new Promise(function (r) { c.toBlob(r, 'image/jpeg', 0.95); }); var _frX = await window.rrFreeReadBlob(_frB, 2400, null);\n    var rp = await _biReadPicture(c, c, null, ctl.eraHint || '', {}, say, stopped);");
      T('O PLANTED: a second reader inside the box is caught', planted !== bc && !one(planted));
    }

    // ── W · the real reader in the box ──
    {
      const { pg, errs } = await boot(browser, { ocr: true, rows: SCREEN_ROWS.concat(ROWS.slice(1)) });
      await pg.evaluate(() => localStorage.setItem('rr_picfirst_autoread', '1'));
      await addPicture(pg, SCREEN);
      const b = await waitBox(pg, x => x.items.length || /Couldn/.test(x.text || ''), 120000);
      T('W REAL reader, Brad\'s whole-screen screenshot: choices, 1927690 first', /Which one is yours/.test(b.text) && b.items[0] === '1927690', b);
      await pg.click('#wiz-picfirst-panel [data-pf="change"]');
      await pg.waitForSelector('#wiz-picfirst-choose [data-pfc="local"]');
      const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('#wiz-picfirst-choose [data-pfc="local"]')]);
      await fc.setFiles(PIC);
      const b2 = await waitBox(pg, x => (x.items.length && !x.busy) || /Couldn/.test(x.text || ''), 120000);
      T('W REAL reader, the cropped box photo: one sure answer, 1927690', /Found it/.test(b2.text) && b2.items.join(',') === '1927690', b2);
      T('W page errors', errs.length === 0, errs);
      await pg.close();
    }
  } finally { await browser.close(); }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  if (fail) { console.log('PICTURE BOX 1955 TESTS FAILING'); process.exit(1); }
  console.log('ALL PICTURE BOX 1955 TESTS GREEN (' + pass + ')');
})().catch(e => { console.log('FAIL  crashed: ' + (e && e.stack || e)); process.exit(1); });
