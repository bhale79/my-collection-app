#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// PHOTO ID READS CLOSER + USES THE PICTURE ALREADY ADDED — v0.9.1950
// (real Chromium, the REAL app, the REAL free reader where it matters)
//
// [stated] Brad, 2026-10-14, after v1949, with a screenshot of Photo ID on his
// Woodruff 2-pack box end ("Lettering: no item number read"):
//   "still can't read it"
// and then:
//   "also, if you pick the add photo first, you can't use the free reader, you
//    hit photo id and then you have to select the photo again.  2 things, if i
//    hit photo id, should bring up the reader and google search using the
//    uploaded picture, 2nd, have read picture button under the change/remove
//    buttons"
//
//   A  READS CLOSER. Photo ID on the Woodruff picture (tests/fixtures/
//      woodruff_1927690.jpg — the photo region of Brad's own crop screen) with
//      the REAL Tesseract.js: "Lettering: found 1927690" and the catalog takes
//      it. A number the closer reader does NOT confirm is not kept.
//      PLANTED: without the closer look, the same picture reads "no item
//      number read" — today's failure, reproduced.
//   B  PHOTO ID USES THE PICTURE ALREADY ADDED. Add a picture first, then
//      "Don't know the number? Photo ID": no camera / picker screen — the crop
//      screen opens on THAT picture, with Photo ID and Google Lens. Lens gets
//      that picture. Photo ID fills 1927690, and the picture is not handed
//      back as a second copy. Without a picture added, Photo ID asks for one
//      exactly as before. PLANTED: without the hand-over, the picker screen.
//   C  READ PICTURE. The button sits under Change / Remove; it reads the
//      picture straight away (no crop screen, no picker) and fills the number.
//      PLANTED: the panel without it.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('FAILED  —  photo_closer_1950_tests needs playwright and it is not installed.'); process.exit(1); }
const APP = path.join(__dirname, '..', 'app');
const FIX = path.join(__dirname, 'fixtures');
const PIC = path.join(FIX, 'woodruff_1927690.jpg');
const CROPPER_JS = fs.readFileSync(path.join(FIX, 'cropper-1.6.1.min.js'));
const CROPPER_CSS = fs.readFileSync(path.join(FIX, 'cropper-1.6.1.min.css'));
const read = f => fs.readFileSync(path.join(APP, f), 'utf8');
let pass = 0, fail = 0;
function T(n, cond, detail) { console.log((cond ? 'PASS' : 'FAIL') + '  ' + n + (cond ? '' : '  -> ' + String(JSON.stringify(detail)).slice(0, 700))); cond ? pass++ : fail++; }

const ROWS = [
  { itemNum: '1927690', variation: '', description: "Woodruff Sleeping and Parlor 1860's Coach 2 Pack", manufacturer: 'Lionel', _era: 'mod', _tab: 'Lionel MPC-Modern', itemType: 'Passenger Car' },
  { itemNum: '1927140', variation: '', description: 'Coach', manufacturer: 'Lionel', _era: 'mod', _tab: 'Lionel MPC-Modern', itemType: 'Passenger Car' },
  { itemNum: '6014-85', variation: '1', description: 'Boxcar', manufacturer: 'Lionel', _era: 'pw', _tab: 'Lionel PW - Items', itemType: 'Boxcar' },
];

// ocr: true lets the real Tesseract.js and its language file load
async function boot(browser, o) {
  const pg = await browser.newPage({ viewport: { width: o.w || 1536, height: o.h || 826 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**', r => {
    const u = r.request().url(), base = u.split('?')[0];
    for (const f of Object.keys(o.files || {})) if (base.endsWith('/app/' + f)) return r.fulfill({ body: o.files[f], contentType: 'application/javascript' });
    if (/cropper(\.min)?\.js$/.test(base) && /cropperjs/.test(u)) return r.fulfill({ body: CROPPER_JS, contentType: 'application/javascript' });
    if (/cropper(\.min)?\.css$/.test(base) && /cropperjs/.test(u)) return r.fulfill({ body: CROPPER_CSS, contentType: 'text/css' });
    if (u.startsWith('file://')) return r.continue();
    if (o.ocr && (u.startsWith('https://cdn.jsdelivr.net/') || u.startsWith('https://tessdata.projectnaptha.com/'))) return r.continue();
    return r.abort();
  });
  await pg.goto('file://' + path.join(APP, 'index.html'), { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(900);
  await pg.evaluate(rows => {
    state.masterData = rows.slice();
    try { _rebuildMasterIndex(); } catch (e) {}
    state.masterByItemAll = state.masterByItem; state.masterAllRows = rows.slice(); window._allIdxComplete = true;
    state.personalData = {}; state.personalSheetId = 'SID'; accessToken = 'tok';
    window.__picks = [];
    HTMLInputElement.prototype.click = function () { if (this.type === 'file') window.__picks.push({ accept: this.accept, capture: this.getAttribute('capture') }); };
    window.__lens = [];
    window._identifyOpenWithPhoto = function (f) { window.__lens.push({ name: f && f.name, size: f && f.size, type: f && f.type }); };
    try { _aiUsageMarkSeen(); } catch (e) {}
  }, ROWS);
  return { pg, errs };
}
// Photo ID's real stages on the Woodruff picture
const runPhotoIdOnPic = (pg, b64) => pg.evaluate(async (b64) => {
  const img = new Image(); img.src = 'data:image/jpeg;base64,' + b64; await img.decode();
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  c.getContext('2d').drawImage(img, 0, 0);
  const seen = [];
  window._biPipelineOnCanvas(c, { noAi: true });
  for (let i = 0; i < 1200; i++) {
    await new Promise(r => setTimeout(r, 150));
    const t = (document.getElementById('bi-stages') || {}).textContent || '';
    if (/reading closer/.test(t) && !seen.length) seen.push('closer');
    if (/Lettering:/.test(t) && /Catalog:/.test(t) && !/Catalog: checking/.test(t)) {
      const o = document.getElementById('bi-overlay'); if (o) o.remove();
      return { t: t.replace(/\s+/g, ' '), seen };
    }
  }
  return { t: ((document.getElementById('bi-stages') || {}).textContent || '').replace(/\s+/g, ' '), seen, timedOut: true };
}, b64);
// open the Add screen (collection), add the picture first through the real chooser
async function addScreenWithPicture(pg, withPic) {
  await pg.evaluate(() => { startWizardFor('collection'); });
  await pg.waitForTimeout(900);
  if (!withPic) return;
  await pg.click('#wiz-picfirst-btn');
  await pg.waitForSelector('#wiz-picfirst-choose [data-pfc="local"]');
  // the real file chooser for this one pick
  await pg.evaluate(() => { delete HTMLInputElement.prototype.click; });
  const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('#wiz-picfirst-choose [data-pfc="local"]')]);
  await fc.setFiles(PIC);
  await pg.waitForTimeout(700);
  await pg.evaluate(() => {
    window.__heldFile = wizard.data._idItemPhotoFile;
    HTMLInputElement.prototype.click = function () { if (this.type === 'file') window.__picks.push({ accept: this.accept, capture: this.getAttribute('capture') }); };
  });
}
// fast stand-ins for the read itself (section A proves the real one)
const fastReader = pg => pg.evaluate(() => {
  window.Tesseract = { recognize: async () => ({ data: { text: '' } }) };
  window.rrFreeReadBlob = async () => ({ num: '1927690', matched: true });
});
const screen = pg => pg.evaluate(() => ({
  crop: !!document.getElementById('bi-cropimg'),
  cropW: (document.getElementById('bi-cropimg') || {}).naturalWidth || 0,
  picker: !!document.getElementById('bi-file'),
  go: !!document.querySelector('#bi-overlay [data-bi="go"]'),
  lens: !!document.querySelector('#bi-overlay [data-bi="lens"]'),
  confirm: !!document.querySelector('[data-a="use"]'),
  stages: ((document.getElementById('bi-stages') || {}).textContent || '').replace(/\s+/g, ' '),
}));
async function waitFor(pg, fn, ms) {
  for (let i = 0; i < (ms || 8000) / 150; i++) { const s = await screen(pg); if (fn(s)) return s; await pg.waitForTimeout(150); }
  return screen(pg);
}

(async function () {
  const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
  const b64 = fs.readFileSync(PIC).toString('base64');
  try {
    // ── A · reads closer (real Tesseract.js) ──
    {
      const { pg, errs } = await boot(browser, { ocr: true });
      const a = await runPhotoIdOnPic(pg, b64);
      T('A Photo ID on the Woodruff picture: "Lettering: found 1927690"', /Lettering: ✓ found 1927690/.test(a.t), a);
      T('A …and the catalog takes it', /Catalog: ✓ 1927690/.test(a.t), a);
      T('A …the closer look said so while it read ("reading closer (free)")', a.seen.indexOf('closer') >= 0, a);
      const a2 = await pg.evaluate(async () => {
        window.Tesseract = { recognize: async () => ({ data: { text: 'Woodruff Sleeping Car 2 Pack FOR AGES 14 TO ADULT' } }) };
        window.rrFreeReadBlob = async () => ({ num: '4927690', matched: false });
        const c = document.createElement('canvas'); c.width = 300; c.height = 200;
        window._biPipelineOnCanvas(c, { noAi: true });
        for (let i = 0; i < 80; i++) {
          await new Promise(r => setTimeout(r, 100));
          const t = (document.getElementById('bi-stages') || {}).textContent || '';
          if (/Lettering:/.test(t) && /Catalog:/.test(t) && !/Catalog: checking/.test(t) && !/reading closer/.test(t)) { const o = document.getElementById('bi-overlay'); if (o) o.remove(); return t; }
        }
        return (document.getElementById('bi-stages') || {}).textContent || '';
      });
      T('A a number the closer reader did NOT confirm (4927690) is not kept', /no item number read/.test(a2) && !/4927690/.test(a2), a2);
      T('A page errors', errs.length === 0, errs);
      await pg.close();
    }
    {
      const bc = read('barcode.js');
      // v0.9.1968: the condition also skips it once the barcode named items
      const start = bc.indexOf("    if (!(rawCands || []).length && !_bcNamed && !(opts && opts.ignoreNums) && typeof window.rrFreeReadBlob === 'function') {");
      // v0.9.1955: the reading step moved into _biReadPicture (shared with the
      // Your Picture box); its stop check reads stopped() now
      const END = '      if (stopped()) return { cancel: true };\n    }\n';
      const end = start < 0 ? -1 : bc.indexOf(END, start);
      if (start < 0 || end < 0) T('A PLANTED: could plant Photo ID without the closer look', false, { start, end });
      else {
        const old = bc.slice(0, start) + bc.slice(end + END.length);
        const { pg } = await boot(browser, { ocr: true, files: { 'barcode.js': old } });
        const p = await runPhotoIdOnPic(pg, b64);
        T('A PLANTED: without the closer look, the same picture reads "no item number read" (A would fail)', /no item number read|nothing readable/.test(p.t) && !/found 1927690/.test(p.t), p);
        await pg.close();
      }
    }

    // ── B · Photo ID uses the picture already added ──
    {
      const { pg, errs } = await boot(browser, {});
      await addScreenWithPicture(pg, true);
      await fastReader(pg);
      const held = await pg.evaluate(() => !!(window.__heldFile && wizard.data._picFirst));
      T('B (set-up) the picture is added first', held, held);
      await pg.click('#wiz-photoid-block');
      let s = await waitFor(pg, x => x.crop && x.cropW > 0);
      T('B Photo ID opens the crop screen ON the added picture — no camera / picker screen', s.crop && s.cropW === 839 && !s.picker, s);
      T('B …with Photo ID and Google Lens', s.go && s.lens, s);
      T('B …and no file picker was asked for', (await pg.evaluate(() => window.__picks.length)) === 0);
      await pg.click('#bi-overlay [data-bi="lens"]');
      await pg.waitForTimeout(600);
      const lens = await pg.evaluate(() => window.__lens.slice());
      T('B Google Lens gets that picture', lens.length === 1 && lens[0].size > 0 && /^image\//.test(lens[0].type || 'image/jpeg'), lens);
      // Photo ID through to the number
      await pg.click('#wiz-photoid-block');
      s = await waitFor(pg, x => x.go);
      await pg.click('#bi-overlay [data-bi="go"]');
      s = await waitFor(pg, x => x.confirm, 10000);
      T('B Photo ID on it finds 1927690 and asks to use it', s.confirm, s);
      await pg.click('[data-a="use"]');
      await pg.waitForTimeout(800);
      const after = await pg.evaluate(() => ({
        num: wizard.data.itemNum, sameFile: wizard.data._idItemPhotoFile === window.__heldFile,
        box: !!wizard.data._biBoxPhotoFile, picks: window.__picks.length,
      }));
      T('B …the item number is filled: 1927690', after.num === '1927690', after);
      T('B …and the picture is not handed back as a second copy (still the one added, no box copy)', after.sameFile && !after.box, after);
      T('B page errors', errs.length === 0, errs);
      await pg.close();
    }
    {
      const { pg } = await boot(browser, {});
      await addScreenWithPicture(pg, false);
      await fastReader(pg);
      await pg.click('#wiz-photoid-block');
      const s = await waitFor(pg, x => x.picker || x.crop);
      T('B with NO picture added, Photo ID asks for one exactly as before (the picker screen)', s.picker && !s.crop, s);
      await pg.close();
    }
    {
      const wp = read('wizard-photos.js');
      const old = wp.replace('  }, eraHint, _start);\n}', '  }, eraHint);\n}');
      if (old === wp) T('B PLANTED: could plant Photo ID without the hand-over', false);
      else {
        const { pg } = await boot(browser, { files: { 'wizard-photos.js': old } });
        await addScreenWithPicture(pg, true);
        await fastReader(pg);
        await pg.click('#wiz-photoid-block');
        const s = await waitFor(pg, x => x.picker || x.crop);
        T('B PLANTED: without the hand-over, Photo ID asks for the picture again (B would fail)', s.picker && !s.crop, s);
        await pg.close();
      }
    }

    // ── C · Read picture ──
    {
      const { pg, errs } = await boot(browser, {});
      await addScreenWithPicture(pg, true);
      await fastReader(pg);
      const lay = await pg.evaluate(() => {
        const p = document.getElementById('wiz-picfirst-panel');
        const acts = p && p.querySelector('.wiz-picfirst-acts');
        const rd = p && p.querySelector('[data-pf="read"]');
        const r = e => e ? e.getBoundingClientRect() : null;
        const a = r(acts), b = r(rd);
        return { has: !!rd, text: rd ? rd.textContent : '', below: !!(a && b && b.top >= a.bottom - 1), wide: !!(a && b && b.width >= a.width - 2) };
      });
      T('C a "Read picture" button sits under Change / Remove, full width', lay.has && /Read picture/.test(lay.text) && lay.below && lay.wide, lay);
      await pg.click('#wiz-picfirst-panel [data-pf="read"]');
      // v0.9.1955 (Brad: "have the results pop up under the picture"): the
      // answer shows in the box itself — no crop screen, no picker, no card
      await pg.waitForSelector('#wiz-picfirst-result .wiz-pf-item', { timeout: 10000 }).catch(() => {});
      const s = await screen(pg);
      const inBox = await pg.evaluate(() => (document.querySelector('#wiz-picfirst-result .wiz-pf-item') || {}).textContent || '');
      T('C it reads the picture straight away — the answer is in the box, no crop screen, no picker', /1927690/.test(inBox) && !s.crop && !s.picker && !s.confirm, { s, inBox });
      await pg.click('#wiz-picfirst-result .wiz-pf-item');
      await pg.waitForTimeout(800);
      const num = await pg.evaluate(() => wizard.data.itemNum);
      T('C …and fills the item number: 1927690', num === '1927690', num);
      T('C page errors', errs.length === 0, errs);
      await pg.close();
    }
    {
      const wz = read('wizard.js');
      const old = wz.replace(`'<button type="button" data-pf="read" class="wiz-picfirst-read">' + RR_PIC_FIRST.readBtn + '</button>'`, "''")
                    .replace(`  p.querySelector('[data-pf="read"]').onclick = function () {`, `  if (false) p.querySelector('[data-pf="read"]').onclick = function () {`);
      if (old === wz) T('C PLANTED: could plant the panel without the button', false);
      else {
        const { pg } = await boot(browser, { files: { 'wizard.js': old } });
        await addScreenWithPicture(pg, true);
        const has = await pg.evaluate(() => !!document.querySelector('#wiz-picfirst-panel [data-pf="read"]'));
        T('C PLANTED: the old panel has no Read picture button (C would fail)', !has, has);
        await pg.close();
      }
    }
  } finally { await browser.close(); }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  if (fail) { console.log('PHOTO CLOSER 1950 TESTS FAILING'); process.exit(1); }
  console.log('ALL PHOTO CLOSER 1950 TESTS GREEN (' + pass + ')');
})().catch(e => { console.log('FAIL  crashed: ' + (e && e.stack || e)); process.exit(1); });
